<script setup lang="ts">
import { computed, ref } from 'vue';
import type { BibEntryItem } from '../types/latexIntelligence';

const props = defineProps<{ entries: BibEntryItem[] }>();
const emit = defineEmits<{ open: [key: string]; close: [] }>();
const query = ref('');
const filtered = computed(() => {
  const q = query.value.trim().toLowerCase();
  if (!q) return props.entries;
  return props.entries.filter((entry) => [entry.key, entry.type, entry.title, entry.author, entry.year, entry.journal, entry.booktitle]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
    .includes(q));
});

function isInteractiveHeaderTarget(event: MouseEvent) {
  const target = event.target as HTMLElement | null;
  return !!target?.closest('button, input, textarea, select, a, [role="button"]');
}

function onHeaderDblclick(event: MouseEvent) {
  if (isInteractiveHeaderTarget(event)) return;
  emit('close');
}
</script>

<template>
  <section class="side-work-panel bib-manager-panel">
    <header class="side-work-panel-header" title="双击关闭" @dblclick="onHeaderDblclick">
      <div>
        <h3>参考文献</h3>
        <small>{{ filtered.length }} / {{ entries.length }} 条</small>
      </div>
      <button class="toolbar-icon" @click="emit('close')">×</button>
    </header>
    <input v-model="query" placeholder="搜索 key / 作者 / 标题 / 年份" />
    <div class="bib-card-list">
      <button v-for="entry in filtered" :key="`${entry.file}:${entry.line}:${entry.key}`" class="bib-card" @click="emit('open', entry.key)">
        <strong>{{ entry.key }}</strong>
        <small>{{ entry.type }} · {{ entry.author || '未知作者' }}{{ entry.year ? ` · ${entry.year}` : '' }}</small>
        <span v-if="entry.title">{{ entry.title }}</span>
        <code>{{ entry.file }}:{{ entry.line }}</code>
      </button>
    </div>
  </section>
</template>
