<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import * as pdfjsLib from 'pdfjs-dist';
import workerSrc from 'pdfjs-dist/build/pdf.worker.mjs?url';
import type { PaperAnnotation, PaperAnnotationRect, PdfSyncPoint } from '../types/app';

pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;

const props = defineProps<{
  dataUrl?: string;
  syncPoint?: PdfSyncPoint | null;
  renderQuality?: number;
  annotations?: PaperAnnotation[];
  activeAnnotationId?: string;
}>();

const emit = defineEmits<{
  reverseClick: [payload: { page: number; x: number; y: number }];
  createAnnotation: [payload: { page: number; rect: PaperAnnotationRect; body: string; x: number; y: number }];
  focusAnnotation: [annotation: PaperAnnotation];
}>();

type RenderTaskLike = { promise: Promise<unknown>; cancel: () => void };
type PageMeta = { width: number; height: number; scale: number };
type DraftDrag = { page: number; startX: number; startY: number; pointerId: number };

const PRELOAD_PX = 900;
const renderQuality = computed(() => Math.min(1.6, Math.max(0.45, props.renderQuality ?? 0.9)));
const viewMode = ref<'sync' | 'annotate'>('sync');
const isAnnotateMode = computed(() => viewMode.value === 'annotate');

const loading = ref(false);
const rendering = ref(false);
const error = ref('');
const container = ref<HTMLDivElement | null>(null);
const currentPage = ref(1);
const pageCount = ref(0);
const scale = ref(0.95);
const pageMetas = ref<Record<number, PageMeta>>({});
const draftRect = ref<{ page: number; rect: PaperAnnotationRect } | null>(null);
const pages = computed(() => Array.from({ length: pageCount.value }, (_, index) => index + 1));

let renderToken = 0;
let pdfDocument: pdfjsLib.PDFDocumentProxy | null = null;
let lastDataUrl = '';
let loadingTask: ReturnType<typeof pdfjsLib.getDocument> | null = null;
let scrollRaf = 0;
let renderRaf = 0;
let scaleTimer = 0;
let activeRenderCount = 0;
let drag: DraftDrag | null = null;

const pageCanvases = new Map<number, HTMLCanvasElement>();
const textLayers = new Map<number, HTMLDivElement>();
const renderedKeys = new Map<number, string>();
const renderTasks = new Map<number, RenderTaskLike>();

function clampScale(value: number) {
  return Math.min(2.6, Math.max(0.35, Number(value.toFixed(2))));
}

function toggleAnnotateView() {
  viewMode.value = isAnnotateMode.value ? 'sync' : 'annotate';
}

function zoomIn() {
  scale.value = clampScale(scale.value + 0.1);
}

function zoomOut() {
  scale.value = clampScale(scale.value - 0.1);
}

function resetZoom() {
  scale.value = 0.95;
}

function goPage(delta: number) {
  if (!pageCount.value) return;
  scrollToPage(Math.min(pageCount.value, Math.max(1, currentPage.value + delta)));
}

function setCanvasRef(page: number, el: Element | null) {
  if (el instanceof HTMLCanvasElement) pageCanvases.set(page, el);
  else pageCanvases.delete(page);
}

function setTextLayerRef(page: number, el: Element | null) {
  if (el instanceof HTMLDivElement) textLayers.set(page, el);
  else textLayers.delete(page);
}

function renderKey(page: number) {
  return `${page}:${scale.value}:${renderQuality.value}`;
}

function isPdfCancelError(err: unknown) {
  return err instanceof Error && (
    err.name === 'RenderingCancelledException' ||
    err.message.includes('Worker was destroyed') ||
    err.message.includes('Rendering cancelled')
  );
}

function cancelRenderTask(page?: number) {
  const entries = page == null ? Array.from(renderTasks.entries()) : [[page, renderTasks.get(page)] as const];
  entries.forEach(([pageNumber, task]) => {
    if (!task) return;
    try {
      task.cancel();
    } catch {
      // Ignore pdf.js cancellation errors.
    }
    renderTasks.delete(pageNumber);
  });
}

function clearRenderedPages() {
  cancelRenderTask();
  renderedKeys.clear();
  pageMetas.value = {};
  pageCanvases.forEach((canvas) => {
    const ctx = canvas.getContext('2d');
    if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    canvas.width = 1;
    canvas.height = 1;
  });
  textLayers.forEach((layer) => { layer.replaceChildren(); });
}

async function disposeDocument() {
  clearRenderedPages();
  if (loadingTask) {
    try {
      await loadingTask.destroy();
    } catch {
      // Ignore cancellation while switching files.
    }
    loadingTask = null;
  }
  if (pdfDocument) {
    try {
      await pdfDocument.destroy();
    } catch {
      // Ignore destroy races.
    }
    pdfDocument = null;
  }
}

async function loadDocument(force = false) {
  renderToken += 1;
  const token = renderToken;
  error.value = '';


  if (!props.dataUrl) {
    pageCount.value = 0;
    currentPage.value = 1;
    lastDataUrl = '';
    await disposeDocument();
    if (token === renderToken) loading.value = false;
    return;
  }

  if (!force && props.dataUrl === lastDataUrl && pdfDocument) {
    scheduleVisibleRender();
    return;
  }

  loading.value = true;
  try {
    await disposeDocument();
    if (token !== renderToken) return;
    loadingTask = pdfjsLib.getDocument(props.dataUrl);
    const doc = await loadingTask.promise;
    if (token !== renderToken) {
      await doc.destroy().catch(() => undefined);
      return;
    }
    pdfDocument = doc;
    lastDataUrl = props.dataUrl;
    pageCount.value = pdfDocument.numPages;
    currentPage.value = 1;
    await nextTick();
    scheduleVisibleRender();
  } catch (err) {
    if (token === renderToken && !isPdfCancelError(err)) {
      error.value = err instanceof Error ? err.message : String(err);
    }
  } finally {
    if (token === renderToken) loading.value = false;
  }
}

async function renderPage(pageNumber: number, expectedToken = renderToken) {
  if (!pdfDocument || !pageCanvases.has(pageNumber) || renderedKeys.get(pageNumber) === renderKey(pageNumber)) return;
  cancelRenderTask(pageNumber);
  activeRenderCount += 1;
  rendering.value = true;
  try {
    const page = await pdfDocument.getPage(pageNumber);
    if (expectedToken !== renderToken) return;
    const canvas = pageCanvases.get(pageNumber);
    if (!canvas) return;
    const displayViewport = page.getViewport({ scale: scale.value });
    const renderViewport = page.getViewport({ scale: scale.value * renderQuality.value });
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;
    canvas.width = Math.max(1, Math.floor(renderViewport.width));
    canvas.height = Math.max(1, Math.floor(renderViewport.height));
    canvas.style.width = `${Math.floor(displayViewport.width)}px`;
    canvas.style.height = `${Math.floor(displayViewport.height)}px`;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    pageMetas.value = {
      ...pageMetas.value,
      [pageNumber]: {
        width: displayViewport.width,
        height: displayViewport.height,
        scale: scale.value,
      },
    };
    const task = page.render({ canvasContext: ctx, viewport: renderViewport });
    renderTasks.set(pageNumber, task);
    await task.promise;
    if (expectedToken !== renderToken) return;
    renderTasks.delete(pageNumber);
    await renderTextLayer(page, pageNumber, displayViewport, expectedToken);
    renderedKeys.set(pageNumber, renderKey(pageNumber));
  } catch (err) {
    if (expectedToken === renderToken && !isPdfCancelError(err)) {
      error.value = err instanceof Error ? err.message : String(err);
    }
  } finally {
    activeRenderCount = Math.max(0, activeRenderCount - 1);
    rendering.value = activeRenderCount > 0;
  }
}

async function renderTextLayer(page: pdfjsLib.PDFPageProxy, pageNumber: number, viewport: unknown, expectedToken: number) {
  const layer = textLayers.get(pageNumber);
  if (!layer) return;
  layer.replaceChildren();
  layer.style.width = `${Math.floor(pageMetas.value[pageNumber]?.width ?? 0)}px`;
  layer.style.height = `${Math.floor(pageMetas.value[pageNumber]?.height ?? 0)}px`;
  try {
    const textContent = await page.getTextContent();
    if (expectedToken !== renderToken) return;
    const TextLayerCtor = (pdfjsLib as unknown as { TextLayer?: new (args: unknown) => { render: () => Promise<void> | void } }).TextLayer;
    if (TextLayerCtor) {
      const textLayer = new TextLayerCtor({ textContentSource: textContent, container: layer, viewport });
      await textLayer.render();
      return;
    }
    // Fallback for environments where pdf.js TextLayer is not exported: keep a transparent selectable text dump.
    const fallback = document.createElement('div');
    fallback.className = 'pdf-text-layer-fallback';
    fallback.textContent = textContent.items.map((item) => ('str' in item ? item.str : '')).join(' ');
    layer.appendChild(fallback);
  } catch {
    // Text layer is optional; canvas and annotation overlay should remain usable.
  }
}

function scheduleVisibleRender() {
  window.cancelAnimationFrame(renderRaf);
  renderRaf = window.requestAnimationFrame(renderVisiblePages);
}

function renderVisiblePages() {
  const root = container.value;
  if (!root || !pdfDocument) return;
  const rootRect = root.getBoundingClientRect();
  const pageEls = Array.from(root.querySelectorAll<HTMLElement>('.pdf-page[data-page]'));
  let nearestPage = currentPage.value;
  let nearestDistance = Number.POSITIVE_INFINITY;

  for (const el of pageEls) {
    const pageNumber = Number(el.dataset.page);
    const rect = el.getBoundingClientRect();
    const inRenderRange = rect.bottom >= rootRect.top - PRELOAD_PX && rect.top <= rootRect.bottom + PRELOAD_PX;
    const inView = rect.bottom >= rootRect.top && rect.top <= rootRect.bottom;
    if (inRenderRange) void renderPage(pageNumber);
    if (inView) {
      const distance = Math.abs(rect.top - rootRect.top - 48);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestPage = pageNumber;
      }
    }
  }
  if (nearestPage !== currentPage.value) currentPage.value = nearestPage;
}

function onScroll() {
  window.cancelAnimationFrame(scrollRaf);
  scrollRaf = window.requestAnimationFrame(renderVisiblePages);
}

function onWheel(event: WheelEvent) {
  const shouldZoom = event.ctrlKey || event.metaKey || event.altKey || Math.abs(event.deltaZ || 0) > 0;
  if (!shouldZoom) return;
  event.preventDefault();
  const direction = event.deltaY > 0 || event.deltaZ > 0 ? -1 : 1;
  const next = clampScale(scale.value + direction * 0.08);
  if (next !== scale.value) scale.value = next;
}

let gestureBaseScale = 1;
function onGestureStart(event: Event) {
  event.preventDefault();
  gestureBaseScale = scale.value;
}

function onGestureChange(event: Event) {
  event.preventDefault();
  const gesture = event as Event & { scale?: number };
  if (typeof gesture.scale !== 'number') return;
  scale.value = clampScale(gestureBaseScale * gesture.scale);
}

function pageBoxStyle(page: number) {
  const meta = pageMetas.value[page];
  if (meta) {
    return {
      width: `${Math.floor(meta.width)}px`,
      minHeight: `${Math.floor(meta.height)}px`,
    };
  }
  return {
    width: `${Math.floor(650 * scale.value)}px`,
    minHeight: `${Math.floor(920 * scale.value)}px`,
  };
}

function normalizedPoint(event: PointerEvent | MouseEvent, page: number) {
  const wrap = container.value?.querySelector<HTMLElement>(`.pdf-page[data-page="${page}"] .pdf-canvas-wrap`);
  const meta = pageMetas.value[page];
  if (!wrap || !meta) return null;
  const rect = wrap.getBoundingClientRect();
  const nx = Math.min(1, Math.max(0, (event.clientX - rect.left) / meta.width));
  const ny = Math.min(1, Math.max(0, (event.clientY - rect.top) / meta.height));
  return { nx, ny, meta };
}

function onCanvasDblclick(event: MouseEvent, page: number) {
  if (isAnnotateMode.value) return;
  const point = normalizedPoint(event, page);
  if (!point) return;
  emit('reverseClick', { page, x: point.nx * point.meta.width / point.meta.scale, y: point.ny * point.meta.height / point.meta.scale });
}

function onAnnotationPointerDown(event: PointerEvent, page: number) {
  if (!isAnnotateMode.value) return;
  const point = normalizedPoint(event, page);
  if (!point) return;
  event.preventDefault();
  (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  drag = { page, startX: point.nx, startY: point.ny, pointerId: event.pointerId };
  draftRect.value = { page, rect: { x: point.nx, y: point.ny, width: 0, height: 0 } };
}

function onAnnotationPointerMove(event: PointerEvent, page: number) {
  if (!drag || drag.page !== page || !isAnnotateMode.value) return;
  const point = normalizedPoint(event, page);
  if (!point) return;
  const x = Math.min(drag.startX, point.nx);
  const y = Math.min(drag.startY, point.ny);
  const width = Math.abs(point.nx - drag.startX);
  const height = Math.abs(point.ny - drag.startY);
  draftRect.value = { page, rect: { x, y, width, height } };
}

function onAnnotationPointerUp(event: PointerEvent, page: number) {
  if (!drag || drag.page !== page || !isAnnotateMode.value) return;
  const current = draftRect.value;
  const meta = pageMetas.value[page];
  drag = null;
  draftRect.value = null;
  if (!current || !meta || current.rect.width < 0.006 || current.rect.height < 0.006) return;
  const body = window.prompt('输入这条 PDF 区域批注', '需要修改这里：')?.trim();
  if (!body) return;
  const centerX = (current.rect.x + current.rect.width / 2) * meta.width / meta.scale;
  const centerY = (current.rect.y + current.rect.height / 2) * meta.height / meta.scale;
  emit('createAnnotation', { page, rect: current.rect, body, x: centerX, y: centerY });
}

function annotationsForPage(page: number) {
  return (props.annotations ?? []).filter((item) => item.pdfAnchor?.page === page && item.pdfAnchor.rects.length);
}

function rectStyle(rect: PaperAnnotationRect) {
  return {
    left: `${rect.x * 100}%`,
    top: `${rect.y * 100}%`,
    width: `${rect.width * 100}%`,
    height: `${rect.height * 100}%`,
  };
}

async function scrollToPage(page: number) {
  currentPage.value = Math.min(pageCount.value || page, Math.max(1, page));
  await nextTick();
  const el = container.value?.querySelector<HTMLElement>(`.pdf-page[data-page="${currentPage.value}"]`);
  el?.scrollIntoView({ block: 'start', inline: 'center', behavior: 'smooth' });
  void renderPage(currentPage.value);
}

async function scrollToSyncPoint() {
  const point = props.syncPoint;
  if (!point || !container.value) return;
  await scrollToPage(point.page);
  await nextTick();
  const wrap = container.value.querySelector<HTMLElement>(`.pdf-page[data-page="${point.page}"] .pdf-canvas-wrap`);
  wrap?.scrollIntoView({ block: 'center', inline: 'center', behavior: 'smooth' });
}

async function scrollToAnnotation(id?: string) {
  if (!id) return;
  const annotation = (props.annotations ?? []).find((item) => item.id === id);
  const page = annotation?.pdfAnchor?.page;
  if (!page) return;
  await nextTick();
  await loadDocument(false);
  await scrollToPage(page);
}

watch(() => props.dataUrl, () => {
  void loadDocument(true);
}, { immediate: true });
watch([scale, renderQuality], () => {
  window.clearTimeout(scaleTimer);
  clearRenderedPages();
  scaleTimer = window.setTimeout(() => {
    void nextTick().then(scheduleVisibleRender);
  }, 90);
});
watch(() => props.syncPoint, async (point) => {
  if (!point) return;
  await scrollToSyncPoint();
}, { deep: true });
watch(() => props.activeAnnotationId, (id) => void scrollToAnnotation(id));

onMounted(() => {
  void nextTick(() => {
    container.value?.addEventListener('gesturestart', onGestureStart as EventListener, { passive: false });
    container.value?.addEventListener('gesturechange', onGestureChange as EventListener, { passive: false });
  });
});

onBeforeUnmount(() => {
  renderToken += 1;
  window.cancelAnimationFrame(scrollRaf);
  window.cancelAnimationFrame(renderRaf);
  window.clearTimeout(scaleTimer);
  container.value?.removeEventListener('gesturestart', onGestureStart as EventListener);
  container.value?.removeEventListener('gesturechange', onGestureChange as EventListener);
  void disposeDocument();
});
</script>\n\n<template>
  <div ref="container" class="pdf-preview-pane" @scroll.passive="onScroll" @wheel="onWheel">
    <div class="pdf-toolbar pdf-main-toolbar">
      <button
        class="toolbar-icon"
        :class="{ active: isAnnotateMode }"
        title="点击后进入/退出批注模式；开启后拖拽框选 PDF 区域创建批注"
        @click="toggleAnnotateView"
      >{{ isAnnotateMode ? '退出批注' : '批注' }}</button>
      <span class="toolbar-separator" />
      <button class="toolbar-icon" :disabled="currentPage <= 1" title="上一页" @click="goPage(-1)">‹</button>
      <span class="pdf-page-input">{{ currentPage }} / {{ pageCount || '-' }}</span>
      <button class="toolbar-icon" :disabled="!pageCount || currentPage >= pageCount" title="下一页" @click="goPage(1)">›</button>
      <span class="toolbar-separator" />
      <button class="toolbar-icon" title="缩小 PDF（也可 Ctrl/⌘ + 鼠标滚轮）" @click="zoomOut">−</button>
      <span class="zoom-label">{{ Math.round(scale * 100) }}%</span>
      <button class="toolbar-icon" title="放大 PDF（也可 Ctrl/⌘ + 鼠标滚轮）" @click="zoomIn">＋</button>
      <button class="toolbar-icon" title="重置缩放" @click="resetZoom">1:1</button>
      <span class="toolbar-separator" />
      <span class="pdf-quality-hint">{{ isAnnotateMode ? '批注模式 · 拖拽框选区域' : '定位/文字模式 · 可选文本 · 双击 PDF 反向定位' }}</span>
    </div>

    <div v-if="!props.dataUrl && !loading" class="empty-state small">
      尚未找到 PDF。打开主 .tex 后按 Ctrl/Cmd+B 构建。
    </div>
    <template v-else>
      <div v-if="loading" class="empty-state small">正在加载 PDF 页面…</div>
      <div v-else-if="rendering" class="empty-state small subtle">正在按需渲染可见页面…</div>
      <div v-if="error" class="empty-state small error">PDF 渲染失败：{{ error }}</div>
      <div v-if="props.dataUrl" class="pdf-scroll-stack">
        <div
          v-for="page in pages"
          :key="page"
          class="pdf-page"
          :class="{ highlighted: props.syncPoint?.page === page }"
          :data-page="page"
        >
          <div class="pdf-page-label">Page {{ page }}</div>
          <div class="pdf-canvas-wrap" :style="pageBoxStyle(page)">
            <canvas :ref="(el) => setCanvasRef(page, el as Element | null)" :data-pdf-page="page" @dblclick="onCanvasDblclick($event, page)" />
            <div :ref="(el) => setTextLayerRef(page, el as Element | null)" class="pdf-text-layer" />
            <div
              v-if="isAnnotateMode"
              class="pdf-annotation-input-layer"
              @pointerdown="onAnnotationPointerDown($event, page)"
              @pointermove="onAnnotationPointerMove($event, page)"
              @pointerup="onAnnotationPointerUp($event, page)"
              @pointercancel="draftRect = null"
            />
            <div class="pdf-annotation-layer" aria-hidden="false">
              <template v-for="item in annotationsForPage(page)" :key="item.id">
                <button
                  v-for="(rect, index) in item.pdfAnchor?.rects || []"
                  :key="`${item.id}-${index}`"
                  class="pdf-annotation-box"
                  :class="[{ active: item.id === activeAnnotationId }, item.status]"
                  :style="rectStyle(rect)"
                  :title="item.body"
                  @click.stop="emit('focusAnnotation', item)"
                />
              </template>
              <div
                v-if="draftRect?.page === page"
                class="pdf-annotation-box draft"
                :style="rectStyle(draftRect.rect)"
              />
            </div>
            <div
              v-if="props.syncPoint?.page === page && pageMetas[page]"
              class="pdf-sync-marker"
              :style="{ left: `${props.syncPoint.x * pageMetas[page].scale}px`, top: `${props.syncPoint.y * pageMetas[page].scale}px` }"
              title="SyncTeX 定位点"
            />
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
