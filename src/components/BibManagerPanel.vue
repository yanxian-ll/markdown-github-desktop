<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import type { BibEntryItem } from '../types/latexIntelligence';
import type { BibEntryPayload, BibEntryType } from '../types/app';

const props = defineProps<{ entries: BibEntryItem[] }>();
const emit = defineEmits<{
  open: [key: string];
  create: [payload: BibEntryPayload];
  edit: [key: string, payload: BibEntryPayload];
  remove: [key: string];
  close: [];
}>();

const query = ref('');
const editorOpen = ref(false);
const editingKey = ref<string | null>(null);
const form = reactive<BibEntryPayload>({
  type: 'article',
  key: '',
  title: '',
  author: '',
  year: String(new Date().getFullYear()),
  journal: '',
  booktitle: '',
  publisher: '',
  doi: '',
  url: '',
  note: '',
});

const entryTypes: Array<{ id: BibEntryType; label: string; required: string[] }> = [
  { id: 'article', label: '期刊 article', required: ['key', 'title', 'author', 'year', 'journal'] },
  { id: 'inproceedings', label: '会议 inproceedings', required: ['key', 'title', 'author', 'year', 'booktitle'] },
  { id: 'book', label: '书籍 book', required: ['key', 'title', 'author', 'year', 'publisher'] },
  { id: 'phdthesis', label: '博士论文 phdthesis', required: ['key', 'title', 'author', 'year'] },
  { id: 'mastersthesis', label: '硕士论文 mastersthesis', required: ['key', 'title', 'author', 'year'] },
  { id: 'misc', label: '其他 misc', required: ['key', 'title', 'year'] },
];

const filtered = computed(() => {
  const q = query.value.trim().toLowerCase();
  if (!q) return props.entries;
  return props.entries.filter((entry) => [entry.key, entry.type, entry.title, entry.author, entry.year, entry.journal, entry.booktitle]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
    .includes(q));
});

const requiredFields = computed(() => entryTypes.find((item) => item.id === form.type)?.required || ['key', 'title', 'year']);
const missingRequired = computed(() => requiredFields.value.filter((field) => !String((form as unknown as Record<string, string>)[field] || '').trim()));
const submitLabel = computed(() => editingKey.value ? '保存参考文献' : '添加参考文献');

function resetForm() {
  form.type = 'article';
  form.key = '';
  form.title = '';
  form.author = '';
  form.year = String(new Date().getFullYear());
  form.journal = '';
  form.booktitle = '';
  form.publisher = '';
  form.doi = '';
  form.url = '';
  form.note = '';
}

function parseField(raw: string | undefined, field: string) {
  if (!raw) return '';
  const escaped = field.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`${escaped}\\s*=\\s*(?:\\{([^{}]*(?:\\{[^{}]*\\}[^{}]*)*)\\}|"([^"]*)")`, 'i');
  const match = raw.match(regex);
  return (match?.[1] || match?.[2] || '').replace(/\s+/g, ' ').trim();
}

function startCreate() {
  resetForm();
  editingKey.value = null;
  editorOpen.value = true;
}

function startEdit(entry: BibEntryItem) {
  resetForm();
  editingKey.value = entry.key;
  form.type = entry.type || 'article';
  form.key = entry.key;
  form.title = entry.title || parseField(entry.raw, 'title');
  form.author = entry.author || parseField(entry.raw, 'author');
  form.year = entry.year || parseField(entry.raw, 'year');
  form.journal = entry.journal || parseField(entry.raw, 'journal');
  form.booktitle = entry.booktitle || parseField(entry.raw, 'booktitle');
  form.publisher = parseField(entry.raw, 'publisher');
  form.doi = parseField(entry.raw, 'doi');
  form.url = parseField(entry.raw, 'url');
  form.note = parseField(entry.raw, 'note');
  editorOpen.value = true;
}

function autoFillMissing() {
  const now = String(new Date().getFullYear());
  if (!form.key.trim()) form.key = `ref${now}`;
  if (!form.title.trim()) form.title = 'Untitled Reference';
  if (!form.author.trim() && form.type !== 'misc') form.author = 'Unknown';
  if (!form.year.trim()) form.year = now;
  if (form.type === 'article' && !form.journal?.trim()) form.journal = 'Unknown Journal';
  if (form.type === 'inproceedings' && !form.booktitle?.trim()) form.booktitle = 'Unknown Proceedings';
  if (form.type === 'book' && !form.publisher?.trim()) form.publisher = 'Unknown Publisher';
}

function cleanPayload(): BibEntryPayload {
  autoFillMissing();
  return {
    type: form.type.trim() || 'misc',
    key: form.key.trim().replace(/\s+/g, '-'),
    title: form.title.trim(),
    author: form.author.trim(),
    year: form.year.trim(),
    journal: form.journal?.trim(),
    booktitle: form.booktitle?.trim(),
    publisher: form.publisher?.trim(),
    doi: form.doi?.trim(),
    url: form.url?.trim(),
    note: form.note?.trim(),
  };
}

function submit() {
  const payload = cleanPayload();
  if (editingKey.value) emit('edit', editingKey.value, payload);
  else emit('create', payload);
  editorOpen.value = false;
}

function isInteractiveHeaderTarget(event: MouseEvent) {
  const target = event.target as HTMLElement | null;
  return !!target?.closest('button, input, textarea, select, a, [role="button"]');
}

function onHeaderDblclick(event: MouseEvent) {
  if (isInteractiveHeaderTarget(event)) return;
  emit('close');
}

watch(() => form.type, () => {
  if (form.type !== 'article') form.journal ||= '';
  if (form.type !== 'inproceedings') form.booktitle ||= '';
});
</script>

<template>
  <section class="side-work-panel bib-manager-panel">
    <header class="side-work-panel-header" title="双击关闭" @dblclick="onHeaderDblclick">
      <div>
        <h3>参考文献</h3>
        <small>{{ filtered.length }} / {{ entries.length }} 条 · 默认卡片视图</small>
      </div>
      <button class="toolbar-icon" @click="emit('close')">×</button>
    </header>

    <div class="bib-toolbar-row compact">
      <input v-model="query" placeholder="搜索 key / 作者 / 标题 / 年份" />
      <button class="primary" @click="startCreate">新增</button>
    </div>

    <form v-if="editorOpen" class="bib-entry-editor" @submit.prevent="submit">
      <div class="bib-entry-editor-head">
        <strong>{{ editingKey ? '编辑参考文献' : '新增参考文献' }}</strong>
        <button type="button" class="toolbar-icon" title="关闭编辑器" @click="editorOpen = false">×</button>
      </div>
      <label>类型
        <select v-model="form.type">
          <option v-for="type in entryTypes" :key="type.id" :value="type.id">{{ type.label }}</option>
        </select>
      </label>
      <label>BibTeX key *<input v-model="form.key" placeholder="smith2026method" /></label>
      <label>标题 *<textarea v-model="form.title" rows="2" placeholder="论文 / 书籍标题" /></label>
      <label>作者<input v-model="form.author" placeholder="Smith, John and Doe, Jane" /></label>
      <label>年份 *<input v-model="form.year" placeholder="2026" /></label>
      <label v-if="form.type === 'article'">期刊 journal *<input v-model="form.journal" placeholder="Remote Sensing" /></label>
      <label v-if="form.type === 'inproceedings'">会议 booktitle *<input v-model="form.booktitle" placeholder="Proceedings of ..." /></label>
      <label v-if="form.type === 'book'">出版社 publisher *<input v-model="form.publisher" placeholder="Springer" /></label>
      <label>DOI<input v-model="form.doi" placeholder="10.xxxx/xxxxx" /></label>
      <label>URL<input v-model="form.url" placeholder="https://..." /></label>
      <label>备注 note<input v-model="form.note" placeholder="可选" /></label>
      <p class="hint">缺少必填项时会自动填补占位值，避免写入不可用的 BibTeX。</p>
      <div class="button-row wrap">
        <button type="submit" class="primary">{{ submitLabel }}</button>
        <button type="button" class="ghost" @click="autoFillMissing">自动补齐缺失项</button>
        <span v-if="missingRequired.length" class="warning-text">待补：{{ missingRequired.join('、') }}</span>
      </div>
    </form>

    <div class="bib-card-list">
      <article v-for="entry in filtered" :key="`${entry.file}:${entry.line}:${entry.key}`" class="bib-card editable">
        <button class="bib-card-main" @click="emit('open', entry.key)">
          <strong>{{ entry.key }}</strong>
          <small>{{ entry.type }} · {{ entry.author || '未知作者' }}{{ entry.year ? ` · ${entry.year}` : '' }}</small>
          <span v-if="entry.title">{{ entry.title }}</span>
          <span v-else class="muted-text">没有标题，建议补充 title 字段。</span>
          <code>{{ entry.file }}:{{ entry.line }}</code>
        </button>
        <div class="bib-card-actions">
          <button @click.stop="startEdit(entry)">编辑</button>
          <button class="danger" @click.stop="emit('remove', entry.key)">删除</button>
        </div>
      </article>
      <div v-if="!filtered.length" class="empty-state compact">没有匹配的参考文献。</div>
    </div>
  </section>
</template>
