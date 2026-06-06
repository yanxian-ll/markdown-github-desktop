<script setup lang="ts">
import type { DocumentKind } from '../types/app';

const props = defineProps<{
  busy?: boolean;
}>();

const emit = defineEmits<{
  openLocal: [kind: 'folder' | 'file'];
  newScratch: [kind: DocumentKind];
}>();
</script>

<template>
  <section class="welcome-start-page">
    <div class="welcome-hero-card">
      <div class="welcome-hero-copy">
        <span class="eyebrow">Scholia Studio</span>
        <h1>开始工作</h1>
        <div class="welcome-action-row">
          <button class="primary large" :disabled="props.busy" @click="emit('openLocal', 'folder')">打开文件夹</button>
          <button :disabled="props.busy" @click="emit('openLocal', 'file')">打开单个文件</button>
          <button class="ghost" :disabled="props.busy" @click="emit('newScratch', 'markdown')">临时 Markdown</button>
        </div>
      </div>
    </div>
  </section>
</template>
