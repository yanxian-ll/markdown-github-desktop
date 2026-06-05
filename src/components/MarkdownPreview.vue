<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, watch } from 'vue';
import mermaid from 'mermaid';
import { renderMarkdown } from '../services/markdown';
import { readWorkspaceDataUrl } from '../services/tauriBridge';
import type { PaperAnnotation, PaperAnnotationRect } from '../types/app';

const props = defineProps<{
  text: string;
  darkMode?: boolean;
  rootDir?: string;
  currentPath?: string;
  annotations?: PaperAnnotation[];
  activeAnnotationId?: string;
  activeSourceLine?: number | null;
}>();

const emit = defineEmits<{
  createAnnotation: [payload: { selectedText: string; rects: PaperAnnotationRect[]; body: string }];
  focusAnnotation: [annotation: PaperAnnotation];
  sourceClick: [payload: { line: number }];
}>();

const previewRoot = ref<HTMLElement | null>(null);
const contentRoot = ref<HTMLElement | null>(null);
const html = ref('');
const selectionToolbar = ref<{
  x: number;
  y: number;
  selectedText: string;
  rects: PaperAnnotationRect[];
  context: 'selection' | 'context';
} | null>(null);

let renderTimer = 0;
let assetRenderToken = 0;
let hideSelectionTimer = 0;
let sourceFlashTimer = 0;

mermaid.initialize({
  startOnLoad: false,
  securityLevel: 'strict',
  theme: props.darkMode ? 'dark' : 'default',
});


function markdownSourceBlocks() {
  const root = contentRoot.value;
  if (!root) return [] as HTMLElement[];
  return Array.from(root.querySelectorAll<HTMLElement>('[data-source-line]'));
}

function numberAttr(element: HTMLElement, name: string) {
  const value = Number(element.dataset[name]);
  return Number.isFinite(value) ? value : undefined;
}

function sourceRangeOf(element: HTMLElement) {
  const start = Number(element.dataset.sourceLine);
  const end = Number(element.dataset.sourceEndLine || element.dataset.sourceLine);
  if (!Number.isFinite(start)) return null;
  return {
    start,
    end: Number.isFinite(end) ? Math.max(start, end) : start,
  };
}

function blockForSourceLine(line: number) {
  const blocks = markdownSourceBlocks();
  if (!blocks.length) return null;
  let nearest: HTMLElement | null = null;
  let nearestDistance = Number.POSITIVE_INFINITY;
  for (const block of blocks) {
    const range = sourceRangeOf(block);
    if (!range) continue;
    if (line >= range.start && line <= range.end) return block;
    const distance = line < range.start ? range.start - line : line - range.end;
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearest = block;
    }
  }
  return nearest;
}

function sourceLineFromTarget(target: EventTarget | null) {
  const root = contentRoot.value;
  if (!root || !(target instanceof Element)) return null;
  const block = target.closest<HTMLElement>('[data-source-line]');
  if (!block || !root.contains(block)) return null;
  const range = sourceRangeOf(block);
  return range?.start ?? null;
}

function flashSourceBlock(element: HTMLElement) {
  window.clearTimeout(sourceFlashTimer);
  contentRoot.value
    ?.querySelectorAll('.markdown-source-flash')
    .forEach((node) => node.classList.remove('markdown-source-flash'));
  element.classList.add('markdown-source-flash');
  sourceFlashTimer = window.setTimeout(() => {
    element.classList.remove('markdown-source-flash');
  }, 1100);
}

function focusSourceLine(line?: number | null) {
  if (!line) return;
  const block = blockForSourceLine(line);
  if (!block) return;
  block.scrollIntoView({ block: 'center', behavior: 'smooth' });
  flashSourceBlock(block);
}

function currentMarkdownAnnotations() {
  return (props.annotations ?? []).filter((item) => {
    if (item.status === 'ignored') return false;
    if (props.currentPath && item.documentPath && item.documentPath !== props.currentPath) return false;
    return !!(item.selectedText || item.markdownAnchor?.textQuote || item.texAnchor?.sourceText || item.sourceText);
  });
}

function normalizedRectsFromClientRects(rectList: DOMRectList | DOMRect[]): PaperAnnotationRect[] {
  const root = previewRoot.value;
  if (!root) return [];
  const rootBox = root.getBoundingClientRect();
  const width = Math.max(1, rootBox.width);
  const height = Math.max(1, root.scrollHeight || root.offsetHeight || rootBox.height || 1);
  return Array.from(rectList)
    .filter((rect) => rect.width >= 2 && rect.height >= 2)
    .map((rect) => ({
      x: Math.max(0, Math.min(1, (rect.left - rootBox.left) / width)),
      y: Math.max(0, Math.min(1, (rect.top - rootBox.top + root.scrollTop) / height)),
      width: Math.max(0, Math.min(1, rect.width / width)),
      height: Math.max(0, Math.min(1, rect.height / height)),
    }))
    .filter((rect) => rect.width > 0 && rect.height > 0);
}

function toolbarPositionFromEvent(event: MouseEvent, rects: PaperAnnotationRect[]) {
  const root = previewRoot.value;
  if (!root) return { x: 12, y: 12 };
  const rootBox = root.getBoundingClientRect();
  const rootWidth = Math.max(1, rootBox.width);
  const rootHeight = Math.max(1, root.scrollHeight || root.offsetHeight || rootBox.height || 1);
  const fallback = rects[rects.length - 1];
  const rawX = event.clientX - rootBox.left;
  const rawY = event.clientY - rootBox.top + root.scrollTop;
  const x = Number.isFinite(rawX) && rawX >= 0 && rawX <= rootWidth
    ? rawX
    : fallback
      ? (fallback.x + fallback.width) * rootWidth
      : 12;
  const y = Number.isFinite(rawY) && rawY >= 0 && rawY <= rootHeight
    ? rawY
    : fallback
      ? (fallback.y + fallback.height) * rootHeight
      : 12;
  return {
    x: Math.max(8, Math.min(rootWidth - 80, x + 8)),
    y: Math.max(8, Math.min(rootHeight - 44, y + 8)),
  };
}

function selectionWithinPreview(selection: Selection) {
  const root = contentRoot.value;
  if (!root || selection.rangeCount === 0) return false;
  const range = selection.getRangeAt(0);
  return root.contains(range.commonAncestorContainer);
}

function updateSelectionToolbar(event: MouseEvent, context: 'selection' | 'context' = 'selection') {
  window.clearTimeout(hideSelectionTimer);
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed || !selectionWithinPreview(selection)) {
    if (context !== 'context') selectionToolbar.value = null;
    return;
  }
  const selectedText = selection.toString().replace(/\s+/g, ' ').trim();
  if (!selectedText) {
    selectionToolbar.value = null;
    return;
  }
  const range = selection.getRangeAt(0);
  const rects = normalizedRectsFromClientRects(range.getClientRects());
  if (!rects.length) {
    selectionToolbar.value = null;
    return;
  }
  const position = toolbarPositionFromEvent(event, rects);
  selectionToolbar.value = {
    x: position.x,
    y: position.y,
    selectedText,
    rects,
    context,
  };
}


function onPreviewClick(event: MouseEvent) {
  const target = event.target as Element | null;
  if (
    target?.closest('.markdown-selection-toolbar') ||
    target?.closest('.markdown-annotation-box')
  ) {
    return;
  }
  const selection = window.getSelection();
  if (selection && !selection.isCollapsed && selectionWithinPreview(selection)) return;
  const line = sourceLineFromTarget(event.target);
  if (line) emit('sourceClick', { line });
}

function onMouseUp(event: MouseEvent) {
  window.setTimeout(() => updateSelectionToolbar(event, 'selection'), 0);
}

function onContextMenu(event: MouseEvent) {
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed || !selectionWithinPreview(selection)) return;
  event.preventDefault();
  updateSelectionToolbar(event, 'context');
}

function createPreviewAnnotation() {
  const current = selectionToolbar.value;
  if (!current?.selectedText) return;
  const body = window.prompt('添加批注', `检查：${current.selectedText.slice(0, 80)}`)?.trim();
  if (!body) return;
  emit('createAnnotation', {
    selectedText: current.selectedText,
    rects: current.rects,
    body,
  });
  window.getSelection()?.removeAllRanges();
  selectionToolbar.value = null;
}

function rectStyle(rect: PaperAnnotationRect) {
  const root = previewRoot.value;
  const rootBox = root?.getBoundingClientRect();
  const height = Math.max(1, root?.scrollHeight || root?.offsetHeight || rootBox?.height || 1);
  return {
    left: `${rect.x * 100}%`,
    top: `${rect.y * height}px`,
    width: `${rect.width * 100}%`,
    height: `${rect.height * height}px`,
  };
}

function markdownRects(item: PaperAnnotation): PaperAnnotationRect[] {
  return item.markdownAnchor?.rects ?? [];
}

async function renderMermaid(root: HTMLElement, token: number) {
  if (!html.value.includes('class="mermaid"')) return;
  await nextTick();
  if (token !== assetRenderToken) return;
  mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', theme: props.darkMode ? 'dark' : 'default' });
  const nodes = Array.from(root.querySelectorAll<HTMLElement>('.mermaid'));
  if (!nodes.length) return;
  try {
    await mermaid.run({ nodes });
  } catch (error) {
    console.warn('Mermaid render failed', error);
  }
}

async function renderLocalImages(root: HTMLElement, token: number) {
  if (!props.rootDir || !props.currentPath || !html.value.includes('<img')) return;
  await nextTick();
  if (token !== assetRenderToken) return;
  const images = Array.from(root.querySelectorAll<HTMLImageElement>('img'));
  await Promise.all(images.map(async (image) => {
    if (token !== assetRenderToken) return;
    const src = image.getAttribute('src') || '';
    if (!src || /^(https?:|data:|asset:|blob:)/i.test(src)) return;
    try {
      const dataUrl = await readWorkspaceDataUrl(props.rootDir!, props.currentPath!, src);
      if (token === assetRenderToken) image.src = dataUrl;
    } catch (error) {
      if (token !== assetRenderToken) return;
      image.alt = `${image.alt || src}（图片无法加载）`;
      image.classList.add('broken-local-image');
      console.warn('Local image render failed', src, error);
    }
  }));
}

async function refreshPreviewAssets() {
  const root = contentRoot.value;
  if (!root) return;
  const token = ++assetRenderToken;
  await renderMermaid(root, token);
  await renderLocalImages(root, token);
}

function scheduleRender() {
  window.clearTimeout(renderTimer);
  renderTimer = window.setTimeout(async () => {
    html.value = renderMarkdown(props.text);
    selectionToolbar.value = null;
    await nextTick();
    await refreshPreviewAssets();
  }, 220);
}

watch(() => [props.text, props.darkMode, props.rootDir, props.currentPath], scheduleRender, { immediate: true });


watch(
  () => props.activeSourceLine,
  async (line) => {
    if (!line) return;
    await nextTick();
    focusSourceLine(line);
  },
);

watch(
  () => props.activeAnnotationId,
  async (id) => {
    if (!id) return;
    await nextTick();
    const root = previewRoot.value;
    if (!root) return;
    const target = root.querySelector<HTMLElement>(`.markdown-annotation-box[data-annotation-id="${CSS.escape(id)}"]`);
    if (target) {
      target.scrollIntoView({ block: 'center', behavior: 'smooth' });
      flashSourceBlock(target);
    }
  },
  { immediate: true },
);

onBeforeUnmount(() => {
  window.clearTimeout(renderTimer);
  window.clearTimeout(hideSelectionTimer);
  window.clearTimeout(sourceFlashTimer);
  assetRenderToken += 1;
});
</script>

<template>
  <article
    ref="previewRoot"
    class="markdown-preview markdown-preview-annotatable"
    @click="onPreviewClick"
    @mouseup="onMouseUp"
    @contextmenu="onContextMenu"
  >
    <div ref="contentRoot" class="markdown-preview-content" v-html="html" />

    <div class="markdown-annotation-layer" aria-hidden="false">
      <template v-for="item in currentMarkdownAnnotations()" :key="item.id">
        <button
          v-for="(rect, index) in markdownRects(item)"
          :key="`${item.id}-${index}`"
          type="button"
          class="markdown-annotation-box"
          :class="[item.status, { active: item.id === activeAnnotationId }]"
          :data-annotation-id="item.id"
          :title="item.body"
          :style="rectStyle(rect)"
          @click.stop="emit('focusAnnotation', item)"
        />
      </template>
    </div>

    <div
      v-if="selectionToolbar"
      class="pdf-text-selection-toolbar markdown-selection-toolbar"
      :class="selectionToolbar.context"
      :style="{ left: `${selectionToolbar.x}px`, top: `${selectionToolbar.y}px` }"
      @mousedown.prevent
    >
      <button class="primary" type="button" @click="createPreviewAnnotation">
        批注
      </button>
    </div>
  </article>
</template>
