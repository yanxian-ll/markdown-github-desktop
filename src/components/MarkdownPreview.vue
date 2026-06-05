<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, watch } from 'vue';
import mermaid from 'mermaid';
import { renderMarkdown } from '../services/markdown';
import { readWorkspaceDataUrl } from '../services/tauriBridge';

const props = defineProps<{
  text: string;
  darkMode?: boolean;
  rootDir?: string;
  currentPath?: string;
}>();

const previewRoot = ref<HTMLElement | null>(null);
const html = ref('');
let renderTimer = 0;
let assetRenderToken = 0;

mermaid.initialize({
  startOnLoad: false,
  securityLevel: 'strict',
  theme: props.darkMode ? 'dark' : 'default',
});

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
  const root = previewRoot.value;
  if (!root) return;
  const token = ++assetRenderToken;
  await renderMermaid(root, token);
  await renderLocalImages(root, token);
}

function scheduleRender() {
  window.clearTimeout(renderTimer);
  renderTimer = window.setTimeout(async () => {
    html.value = renderMarkdown(props.text);
    await refreshPreviewAssets();
  }, 220);
}

watch(() => [props.text, props.darkMode, props.rootDir, props.currentPath], scheduleRender, { immediate: true });

onBeforeUnmount(() => {
  window.clearTimeout(renderTimer);
  assetRenderToken += 1;
});
</script>

<template>
  <article ref="previewRoot" class="markdown-preview" v-html="html" />
</template>
