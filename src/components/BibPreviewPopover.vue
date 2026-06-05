<script setup lang="ts">
import type { BibEntryItem } from '../types/latexIntelligence';

const props = defineProps<{
  entry?: BibEntryItem;
}>();

const emit = defineEmits<{
  open: [key: string];
  close: [];
}>();

function shortAuthors(author?: string) {
  if (!author) return '未知作者';
  const first = author.split(/\s+and\s+/i)[0]?.trim() || author;
  const last = first.includes(',') ? first.split(',')[0] : first.split(/\s+/).pop();
  return `${last || first}${author.includes(' and ') ? ' et al.' : ''}`;
}
</script>

<template>
  <div v-if="props.entry" class="bib-preview-popover">
    <button class="bib-preview-close" title="关闭" @click="emit('close')">×</button>
    <div class="bib-preview-kicker">BibTeX 预览</div>
    <strong>{{ shortAuthors(props.entry.author) }}{{ props.entry.year ? `, ${props.entry.year}` : '' }}</strong>
    <p v-if="props.entry.title">{{ props.entry.title }}</p>
    <small v-if="props.entry.journal || props.entry.booktitle">{{ props.entry.journal || props.entry.booktitle }}</small>
    <code>{{ props.entry.key }}</code>
    <div class="bib-preview-actions">
      <button @click="emit('open', props.entry.key)">打开条目</button>
    </div>
  </div>
</template>
