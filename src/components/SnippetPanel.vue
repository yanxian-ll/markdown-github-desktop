<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import { editorSnippets } from '../services/snippets';
import { makeId } from '../services/hash';
import type { CustomSnippet } from '../types/app';

const props = defineProps<{ kind?: string; customSnippets?: CustomSnippet[] }>();
const emit = defineEmits<{ close: []; updateCustomSnippets: [snippets: CustomSnippet[]] }>();
const query = ref('');
const form = reactive({ trigger: '', label: '', detail: '', language: 'both' as CustomSnippet['language'], insert: '' });

const snippets = computed(() => {
  const lang = props.kind === 'latex' ? 'latex' : props.kind === 'markdown' ? 'markdown' : 'both';
  const q = query.value.trim().toLowerCase();
  return [...editorSnippets, ...(props.customSnippets || [])].filter((item) =>
    (item.language === lang || item.language === 'both') && (!q || `${item.trigger} ${item.detail} ${item.insert}`.toLowerCase().includes(q)),
  );
});

function resetForm() {
  form.trigger = '';
  form.label = '';
  form.detail = '';
  form.language = props.kind === 'latex' ? 'latex' : props.kind === 'markdown' ? 'markdown' : 'both';
  form.insert = '';
}

function addCustomSnippet() {
  if (!form.trigger.trim() || !form.insert.trim()) return;
  const now = new Date().toISOString();
  const snippet: CustomSnippet = {
    id: makeId('snippet'),
    trigger: form.trigger.trim(),
    label: form.label.trim() || form.trigger.trim(),
    detail: form.detail.trim() || '自定义片段',
    language: form.language,
    insert: form.insert,
    updatedAt: now,
  };
  emit('updateCustomSnippets', [...(props.customSnippets || []), snippet]);
  resetForm();
}

function removeCustomSnippet(id: string) {
  emit('updateCustomSnippets', (props.customSnippets || []).filter((item) => item.id !== id));
}

function isCustomSnippet(snippet: { trigger: string }) {
  return (props.customSnippets || []).some((item) => item.trigger === snippet.trigger);
}

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
  <section class="side-work-panel snippet-panel">
    <header class="side-work-panel-header" title="双击关闭" @dblclick="onHeaderDblclick">
      <div>
        <h3>片段</h3>
        <small>支持 CodeMirror Tab 占位符，例如 <code>${1:caption}</code>。</small>
      </div>
      <button class="toolbar-icon" @click="emit('close')">×</button>
    </header>
    <input v-model="query" placeholder="搜索片段" />

    <details class="snippet-editor">
      <summary>新增自定义片段</summary>
      <div class="grid-form one-col">
        <label>触发词<input v-model="form.trigger" placeholder="/claim 或 fig2" /></label>
        <label>名称<input v-model="form.label" placeholder="可留空，默认使用触发词" /></label>
        <label>说明<input v-model="form.detail" placeholder="这个片段用于什么" /></label>
        <label>语言
          <select v-model="form.language">
            <option value="both">通用</option>
            <option value="markdown">Markdown</option>
            <option value="latex">LaTeX</option>
          </select>
        </label>
        <label>插入内容<textarea v-model="form.insert" rows="7" placeholder="支持 ${1:占位符}，按 Tab 跳转。" /></label>
      </div>
      <div class="button-row">
        <button :disabled="!form.trigger.trim() || !form.insert.trim()" @click="addCustomSnippet">保存片段</button>
      </div>
    </details>

    <div class="snippet-list">
      <article v-for="snippet in snippets" :key="snippet.trigger" class="snippet-card">
        <div class="tree-header">
          <strong>{{ snippet.trigger }}</strong>
          <button v-if="isCustomSnippet(snippet)" class="ghost mini danger" @click="removeCustomSnippet((snippet as CustomSnippet).id)">删除</button>
        </div>
        <small>{{ snippet.detail }}</small>
        <pre>{{ snippet.insert }}</pre>
      </article>
    </div>
  </section>
</template>
