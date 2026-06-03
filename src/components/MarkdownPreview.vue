<script setup lang="ts">
import { computed, nextTick, watch } from 'vue';
import mermaid from 'mermaid';
import { renderMarkdown } from '../services/markdown';

const props = defineProps<{
  text: string;
  darkMode?: boolean;
}>();

const html = computed(() => renderMarkdown(props.text));

mermaid.initialize({
  startOnLoad: false,
  securityLevel: 'strict',
  theme: props.darkMode ? 'dark' : 'default',
});

async function renderMermaid() {
  await nextTick();
  mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', theme: props.darkMode ? 'dark' : 'default' });
  const nodes = Array.from(document.querySelectorAll<HTMLElement>('.markdown-preview .mermaid'));
  if (nodes.length) {
    try {
      await mermaid.run({ nodes });
    } catch (error) {
      console.warn('Mermaid render failed', error);
    }
  }
}

watch(() => [props.text, props.darkMode], renderMermaid, { immediate: true });
</script>

<template>
  <article class="markdown-preview" v-html="html" />
</template>
