<script setup lang="ts">
import { computed, ref } from 'vue';
import { editorSnippets } from '../services/snippets';

const props = defineProps<{ kind?: string }>();
const emit = defineEmits<{ close: [] }>();
const query = ref('');
const snippets = computed(() => {
  const lang = props.kind === 'latex' ? 'latex' : props.kind === 'markdown' ? 'markdown' : 'both';
  const q = query.value.trim().toLowerCase();
  return editorSnippets.filter((item) => (item.language === lang || item.language === 'both') && (!q || `${item.trigger} ${item.detail}`.toLowerCase().includes(q)));
});
</script>

<template>
  <section class="side-work-panel snippet-panel">
    <header class="side-work-panel-header">
      <div>
        <h3>片段</h3>
        <small>在编辑器输入触发词后使用补全插入。</small>
      </div>
      <button class="toolbar-icon" @click="emit('close')">×</button>
    </header>
    <input v-model="query" placeholder="搜索片段" />
    <div class="snippet-list">
      <article v-for="snippet in snippets" :key="snippet.trigger" class="snippet-card">
        <strong>{{ snippet.trigger }}</strong>
        <small>{{ snippet.detail }}</small>
        <pre>{{ snippet.insert }}</pre>
      </article>
    </div>
  </section>
</template>
