<script setup lang="ts">
import { computed, ref } from 'vue';
import type { PaperAnnotation, PaperAnnotationStatus } from '../types/app';

const props = defineProps<{
  annotations: PaperAnnotation[];
  activeId?: string;
  latexActive?: boolean;
  activePath?: string;
}>();

const emit = defineEmits<{
  jump: [annotation: PaperAnnotation];
  status: [payload: { id: string; status: PaperAnnotationStatus }];
  remove: [id: string];
  createSource: [];
}>();

type StatusFilter = 'all' | PaperAnnotationStatus;
type TimeFilter = 'all' | 'today' | '7d' | '30d';

const filter = ref<StatusFilter>('open');
const timeFilter = ref<TimeFilter>('all');

function timestampOf(item: PaperAnnotation) {
  const value = Date.parse(item.updatedAt || item.createdAt || '');
  return Number.isFinite(value) ? value : 0;
}

function isSameLocalDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}

function inTimeRange(item: PaperAnnotation) {
  if (timeFilter.value === 'all') return true;
  const stamp = timestampOf(item);
  if (!stamp) return false;
  const now = new Date();
  const date = new Date(stamp);
  if (timeFilter.value === 'today') return isSameLocalDay(now, date);
  const days = timeFilter.value === '7d' ? 7 : 30;
  return now.getTime() - stamp <= days * 24 * 60 * 60 * 1000;
}

const filtered = computed(() => {
  const list = [...props.annotations].sort((a, b) => timestampOf(b) - timestampOf(a));
  return list.filter((item) => {
    if (filter.value !== 'all' && item.status !== filter.value) return false;
    return inTimeRange(item);
  });
});

const grouped = computed(() => {
  const groups: Array<{ key: string; label: string; items: PaperAnnotation[] }> = [];
  const byKey = new Map<string, { key: string; label: string; items: PaperAnnotation[] }>();
  for (const item of filtered.value) {
    const stamp = timestampOf(item);
    const key = stamp ? new Date(stamp).toISOString().slice(0, 10) : 'unknown';
    let group = byKey.get(key);
    if (!group) {
      group = { key, label: dateGroupLabel(stamp), items: [] };
      byKey.set(key, group);
      groups.push(group);
    }
    group.items.push(item);
  }
  return groups;
});

const counts = computed(() => ({
  all: props.annotations.length,
  open: props.annotations.filter((item) => item.status === 'open').length,
  resolved: props.annotations.filter((item) => item.status === 'resolved').length,
  ignored: props.annotations.filter((item) => item.status === 'ignored').length,
}));

function dateGroupLabel(stamp: number) {
  if (!stamp) return '未知时间';
  const date = new Date(stamp);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (isSameLocalDay(date, today)) return '今天';
  if (isSameLocalDay(date, yesterday)) return '昨天';
  return new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}

function formatTime(value: string) {
  const stamp = Date.parse(value || '');
  if (!Number.isFinite(stamp)) return '未知时间';
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(stamp));
}

function labelFor(item: PaperAnnotation) {
  if (item.texAnchor) return `${item.texAnchor.file}:${item.texAnchor.line}`;
  if (item.pdfAnchor) return `PDF 第 ${item.pdfAnchor.page} 页`;
  return item.documentPath || '未定位批注';
}

function typeLabel(type: PaperAnnotation['type']) {
  const labels: Record<PaperAnnotation['type'], string> = {
    highlight: '高亮',
    comment: '评论',
    area: '区域',
    freehand: '手写',
    todo: 'TODO',
    replace: '改写',
  };
  return labels[type];
}
</script>

<template>
  <aside class="annotation-sidebar">
    <header class="annotation-header">
      <div>
        <h3>论文批注</h3>
        <small>{{ activePath || '当前工作区' }}</small>
      </div>
      <button
        class="toolbar-icon"
        :disabled="!latexActive"
        title="给当前 TeX 光标行添加批注：也可按 Ctrl/⌘ + Alt + C"
        @click="emit('createSource')"
      >＋</button>
    </header>

    <div class="annotation-git-hint">
      批注保存到 <code>.paper-notes/annotations.jsonl</code>；提交 Git 后，其他设备用本软件打开同一项目即可看到。GitHub 网页直接预览 PDF 时不会显示这些批注。
    </div>

    <div class="annotation-filters">
      <button :class="{ active: filter === 'open' }" @click="filter = 'open'">未处理 {{ counts.open }}</button>
      <button :class="{ active: filter === 'resolved' }" @click="filter = 'resolved'">已解决 {{ counts.resolved }}</button>
      <button :class="{ active: filter === 'ignored' }" @click="filter = 'ignored'">忽略 {{ counts.ignored }}</button>
      <button :class="{ active: filter === 'all' }" @click="filter = 'all'">全部 {{ counts.all }}</button>
    </div>

    <div class="annotation-time-filters">
      <span>时间</span>
      <button :class="{ active: timeFilter === 'today' }" @click="timeFilter = 'today'">今天</button>
      <button :class="{ active: timeFilter === '7d' }" @click="timeFilter = '7d'">近 7 天</button>
      <button :class="{ active: timeFilter === '30d' }" @click="timeFilter = '30d'">近 30 天</button>
      <button :class="{ active: timeFilter === 'all' }" @click="timeFilter = 'all'">全部时间</button>
    </div>

    <div v-if="!filtered.length" class="empty-state small">
      暂无符合条件的批注。PDF 批注模式下拖拽框选区域，或在源码中按 <kbd>Ctrl/⌘</kbd> + <kbd>Alt</kbd> + <kbd>C</kbd>。
    </div>

    <section v-for="group in grouped" :key="group.key" class="annotation-date-group">
      <div class="annotation-date-title">
        <span>{{ group.label }}</span>
        <small>{{ group.items.length }} 条</small>
      </div>
      <article
        v-for="item in group.items"
        :key="item.id"
        class="annotation-card"
        :class="[{ active: item.id === activeId }, item.status]"
        @click="emit('jump', item)"
      >
        <div class="annotation-card-top">
          <span class="annotation-type">{{ typeLabel(item.type) }}</span>
          <span class="annotation-location">{{ labelFor(item) }}</span>
        </div>
        <p>{{ item.body || '无正文' }}</p>
        <div v-if="item.pdfAnchor?.textQuote" class="annotation-quote">“{{ item.pdfAnchor.textQuote }}”</div>
        <div class="annotation-meta">
          创建 {{ formatTime(item.createdAt) }}<template v-if="item.updatedAt !== item.createdAt"> · 更新 {{ formatTime(item.updatedAt) }}</template>
        </div>
        <div class="annotation-actions" @click.stop>
          <button v-if="item.status !== 'open'" @click="emit('status', { id: item.id, status: 'open' })">重开</button>
          <button v-if="item.status !== 'resolved'" @click="emit('status', { id: item.id, status: 'resolved' })">解决</button>
          <button v-if="item.status !== 'ignored'" @click="emit('status', { id: item.id, status: 'ignored' })">忽略</button>
          <button class="danger" title="删除批注" @click="emit('remove', item.id)">删除</button>
        </div>
      </article>
    </section>
  </aside>
</template>
