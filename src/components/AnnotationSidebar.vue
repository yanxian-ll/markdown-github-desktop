<script setup lang="ts">
import { computed, ref } from "vue";
import type { PaperAnnotation, PaperAnnotationStatus } from "../types/app";

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
}>();

type StatusFilter = "all" | PaperAnnotationStatus;
type TimeFilter = "all" | "today" | "yesterday" | "3d";

const filter = ref<StatusFilter>("open");
const timeFilter = ref<TimeFilter>("all");

function timestampOf(item: PaperAnnotation) {
  const value = Date.parse(item.updatedAt || item.createdAt || "");
  return Number.isFinite(value) ? value : 0;
}

function isSameLocalDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function startOfLocalDay(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime();
}

function inTimeRange(item: PaperAnnotation) {
  if (timeFilter.value === "all") return true;
  const stamp = timestampOf(item);
  if (!stamp) return false;
  const now = new Date();
  const date = new Date(stamp);
  if (timeFilter.value === "today") return isSameLocalDay(now, date);
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (timeFilter.value === "yesterday") return isSameLocalDay(yesterday, date);
  const todayStart = startOfLocalDay(now);
  const dateStart = startOfLocalDay(date);
  return todayStart - dateStart <= 2 * 24 * 60 * 60 * 1000 && dateStart <= todayStart;
}

type AnchorState = "stable" | "unstable" | "unbound";

function anchorState(item: PaperAnnotation): AnchorState {
  if (!item.texAnchor) return "unbound";
  if (item.needsReview || item.anchorConfidence === "unstable") return "unstable";
  return "stable";
}

const filtered = computed(() => {
  const list = [...props.annotations].sort(
    (a, b) => timestampOf(b) - timestampOf(a),
  );
  return list.filter((item) => {
    if (filter.value !== "all" && item.status !== filter.value) return false;
    return inTimeRange(item);
  });
});

const grouped = computed(() => {
  const groups: Array<{
    key: string;
    label: string;
    items: PaperAnnotation[];
  }> = [];
  const byKey = new Map<
    string,
    { key: string; label: string; items: PaperAnnotation[] }
  >();
  for (const item of filtered.value) {
    const stamp = timestampOf(item);
    const key = stamp ? new Date(stamp).toISOString().slice(0, 10) : "unknown";
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
  open: props.annotations.filter((item) => item.status === "open").length,
  resolved: props.annotations.filter((item) => item.status === "resolved")
    .length,
  ignored: props.annotations.filter((item) => item.status === "ignored").length,
}));

function dateGroupLabel(stamp: number) {
  if (!stamp) return "未知时间";
  const date = new Date(stamp);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (isSameLocalDay(date, today)) return "今天";
  if (isSameLocalDay(date, yesterday)) return "昨天";
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function formatTime(value: string) {
  const stamp = Date.parse(value || "");
  if (!Number.isFinite(stamp)) return "未知时间";
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(stamp));
}

function labelFor(item: PaperAnnotation) {
  if (item.texAnchor) {
    const end = item.texAnchor.lineEnd && item.texAnchor.lineEnd !== item.texAnchor.line
      ? `-${item.texAnchor.lineEnd}`
      : "";
    return `${item.texAnchor.file}:${item.texAnchor.line}${end}`;
  }
  if (item.pdfAnchor) return `PDF 第 ${item.pdfAnchor.page} 页`;
  return item.documentPath || "未定位批注";
}

function typeLabel(type: PaperAnnotation["type"]) {
  const labels: Record<PaperAnnotation["type"], string> = {
    highlight: "高亮",
    text: "文字",
    comment: "源码",
    area: "区域",
    freehand: "手写",
    todo: "TODO",
    replace: "改写",
  };
  return labels[type];
}

function anchorLabel(item: PaperAnnotation) {
  const state = anchorState(item);
  if (state === "stable") return "稳定";
  if (state === "unstable") return "需复核";
  return "未绑定";
}

function quoteFor(item: PaperAnnotation) {
  return item.selectedText || item.pdfAnchor?.textQuote || item.texAnchor?.sourceText || item.sourceText;
}
</script>

<template>
  <aside class="annotation-sidebar v046">
    <header class="annotation-header compact">
      <div>
        <h3>批注</h3>
        <small>{{ activePath || "当前工作区" }}</small>
      </div>
    </header>

    <div class="annotation-filter-block">
      <label>状态</label>
      <div class="annotation-chip-row status-chip-row">
        <button
          class="status-chip"
          :class="{ active: filter === 'open' }"
          title="未处理"
          aria-label="未处理"
          @click="filter = 'open'"
        >
          <span class="status-icon" aria-hidden="true">○</span>
          <span class="status-count">{{ counts.open }}</span>
        </button>
        <button
          class="status-chip"
          :class="{ active: filter === 'resolved' }"
          title="已解决"
          aria-label="已解决"
          @click="filter = 'resolved'"
        >
          <span class="status-icon" aria-hidden="true">✓</span>
          <span class="status-count">{{ counts.resolved }}</span>
        </button>
        <button
          class="status-chip"
          :class="{ active: filter === 'ignored' }"
          title="忽略"
          aria-label="忽略"
          @click="filter = 'ignored'"
        >
          <span class="status-icon" aria-hidden="true">⊘</span>
          <span class="status-count">{{ counts.ignored }}</span>
        </button>
        <button
          class="status-chip"
          :class="{ active: filter === 'all' }"
          title="全部"
          aria-label="全部"
          @click="filter = 'all'"
        >
          <span class="status-icon" aria-hidden="true">☰</span>
          <span class="status-count">{{ counts.all }}</span>
        </button>
      </div>
    </div>

    <div class="annotation-filter-block compact-time">
      <label>时间</label>
      <div class="annotation-chip-row">
        <button
          :class="{ active: timeFilter === 'today' }"
          @click="timeFilter = 'today'"
        >
          今天
        </button>
        <button
          :class="{ active: timeFilter === 'yesterday' }"
          @click="timeFilter = 'yesterday'"
        >
          昨天
        </button>
        <button
          :class="{ active: timeFilter === '3d' }"
          @click="timeFilter = '3d'"
        >
          近三天
        </button>
        <button
          :class="{ active: timeFilter === 'all' }"
          @click="timeFilter = 'all'"
        >
          全部
        </button>
      </div>
    </div>

    <div v-if="!filtered.length" class="empty-state small annotation-empty">
      暂无符合条件的批注。可在 PDF 或 Markdown 预览中选中文字后点击“批注”；图表、公式和版式问题可使用“区域批注”。
    </div>

    <section
      v-for="group in grouped"
      :key="group.key"
      class="annotation-date-group"
    >
      <div class="annotation-date-title">
        <span>{{ group.label }}</span>
        <small>{{ group.items.length }} 条</small>
      </div>
      <article
        v-for="item in group.items"
        :key="item.id"
        class="annotation-card"
        :class="[{ active: item.id === activeId }, item.status, anchorState(item)]"
        @click="emit('jump', item)"
      >
        <div class="annotation-card-top">
          <span class="annotation-type">{{ typeLabel(item.type) }}</span>
          <span class="annotation-anchor-badge" :class="anchorState(item)">{{ anchorLabel(item) }}</span>
        </div>
        <div class="annotation-location" :title="labelFor(item)">{{ labelFor(item) }}</div>
        <p>{{ item.body || "无正文" }}</p>
        <div v-if="quoteFor(item)" class="annotation-quote">
          “{{ quoteFor(item) }}”
        </div>
        <div v-if="item.needsReviewReason" class="annotation-review-warning">
          {{ item.needsReviewReason }}
        </div>
        <div class="annotation-meta">
          创建 {{ formatTime(item.createdAt)
          }}<template v-if="item.updatedAt !== item.createdAt">
            · 更新 {{ formatTime(item.updatedAt) }}</template
          >
        </div>
        <div class="annotation-actions" @click.stop>
          <button
            v-if="item.status !== 'open'"
            @click="emit('status', { id: item.id, status: 'open' })"
          >
            重开
          </button>
          <button
            v-if="item.status !== 'resolved'"
            @click="emit('status', { id: item.id, status: 'resolved' })"
          >
            解决
          </button>
          <button
            v-if="item.status !== 'ignored'"
            @click="emit('status', { id: item.id, status: 'ignored' })"
          >
            忽略
          </button>
          <button
            class="danger"
            title="删除批注"
            @click="emit('remove', item.id)"
          >
            删除
          </button>
        </div>
      </article>
    </section>
  </aside>
</template>
