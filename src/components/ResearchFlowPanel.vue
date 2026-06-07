<script setup lang="ts">
import { computed } from 'vue';
import type { PaperAnnotation, ResearchFlowStepStatus } from '../types/app';
import type { ProjectLatexIndex } from '../types/latexIntelligence';
import { RESEARCH_FLOW_STEPS, WORKBENCH_ZONES, type ResearchFlowActionId } from '../config/workbench';

const props = defineProps<{
  activePath?: string;
  writingStatsLabel?: string;
  latexIndex: ProjectLatexIndex;
  annotations: PaperAnnotation[];
  flowStatuses?: ResearchFlowStepStatus[];
  busy?: boolean;
}>();

const emit = defineEmits<{
  close: [];
  action: [id: ResearchFlowActionId];
  openLatest: [id: ResearchFlowStepStatus['id']];
}>();


const openAnnotationCount = computed(() => props.annotations.filter((item) => item.status === 'open').length);
const resolvedAnnotationCount = computed(() => props.annotations.filter((item) => item.status === 'resolved').length);

const flowStepStatuses = computed(() => {
  const hasActivePath = !!props.activePath;
  const hasCitations = props.latexIndex.citations.length > 0;
  const hasLabels = props.latexIndex.labels.length > 0;
  const hasAnnotations = props.annotations.length > 0;
  const statusById: Record<ResearchFlowActionId, { state: 'ready' | 'todo' | 'blocked'; label: string; detail: string }> = {
    'daily-note': hasActivePath
      ? { state: 'ready', label: '可生成', detail: '会带入当前文件、批注和参考文献线索。' }
      : { state: 'todo', label: '待打开文件', detail: '先打开一个研究材料或论文源文件。' },
    'weekly-report': hasAnnotations || hasCitations
      ? { state: 'ready', label: '可汇总', detail: `已有 ${props.annotations.length} 条批注、${props.latexIndex.citations.length} 条引用线索。` }
      : { state: 'todo', label: '资料较少', detail: '积累日记、批注或引用后生成效果更好。' },
    'evidence-index': hasAnnotations || hasCitations
      ? { state: 'ready', label: '可抽取', detail: `未处理批注 ${openAnnotationCount.value} 条。` }
      : { state: 'todo', label: '待积累证据', detail: '从 PDF/Markdown/LaTeX 批注中提取证据。' },
    'paper-outline': hasCitations || hasLabels || resolvedAnnotationCount.value > 0
      ? { state: 'ready', label: '可起草', detail: `标签 ${props.latexIndex.labels.length} 个，已处理批注 ${resolvedAnnotationCount.value} 条。` }
      : { state: 'blocked', label: '证据不足', detail: '建议先生成证据索引或整理批注。' },
    'review-summary': hasAnnotations
      ? { state: 'ready', label: '可审阅', detail: `批注总数 ${props.annotations.length} 条。` }
      : { state: 'todo', label: '待批注', detail: '在预览或 PDF 中添加批注后再汇总。' },
  };
  return statusById;
});

const detailedStatusById = computed(() => {
  const map: Partial<Record<ResearchFlowStepStatus['id'], ResearchFlowStepStatus>> = {};
  (props.flowStatuses || []).forEach((item) => { map[item.id] = item; });
  return map;
});

const actionToDetailedId: Record<ResearchFlowActionId, ResearchFlowStepStatus['id']> = {
  'daily-note': 'daily',
  'weekly-report': 'weekly',
  'evidence-index': 'evidence',
  'paper-outline': 'outline',
  'review-summary': 'review',
};

const evidenceStats = computed(() => [
  { label: '引用', value: props.latexIndex.citations.length },
  { label: '标签', value: props.latexIndex.labels.length },
  { label: '未处理批注', value: props.annotations.filter((item) => item.status === 'open').length },
]);

const layoutZones = computed(() => WORKBENCH_ZONES.filter((zone) => ['documents', 'research-flow', 'editor', 'preview-review'].includes(zone.id)));

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
  <section class="side-work-panel research-flow-panel">
    <header class="side-work-panel-header" title="双击关闭" @dblclick="onHeaderDblclick">
      <div>
        <strong>研究流</strong>
        <small>记录 → 证据 → 论文 → 审阅</small>
      </div>
      <button class="toolbar-icon" title="关闭" @click="emit('close')">×</button>
    </header>

    <div class="research-flow-summary">
      <span class="eyebrow">Research OS</span>
      <strong>{{ props.activePath || '未打开文档' }}</strong>
      <small>当前文件：{{ props.writingStatsLabel || '0 字' }}</small>
    </div>

    <div class="tool-stats-grid research-stats-grid">
      <div v-for="item in evidenceStats" :key="item.label">
        <strong>{{ item.value }}</strong>
        <span>{{ item.label }}</span>
      </div>
    </div>

    <div class="research-flow-list">
      <article v-for="step in RESEARCH_FLOW_STEPS" :key="step.id" class="research-flow-card">
        <div class="research-flow-index">{{ step.shortLabel }}</div>
        <div class="research-flow-card-main">
          <strong>{{ step.title }}</strong>
          <span>{{ step.description }}</span>
          <code>{{ step.targetPathHint }}</code>
          <small class="research-flow-status" :class="detailedStatusById[actionToDetailedId[step.id]]?.state || flowStepStatuses[step.id].state">
            {{ detailedStatusById[actionToDetailedId[step.id]]?.label || flowStepStatuses[step.id].label }} ·
            {{ detailedStatusById[actionToDetailedId[step.id]]?.detail || flowStepStatuses[step.id].detail }}
          </small>
          <small v-if="detailedStatusById[actionToDetailedId[step.id]]?.missing.length" class="research-flow-missing">
            缺失：{{ detailedStatusById[actionToDetailedId[step.id]]?.missing.join('、') }}
          </small>
        </div>
        <div class="research-flow-actions">
          <button
            v-if="detailedStatusById[actionToDetailedId[step.id]]?.path"
            class="ghost"
            :disabled="props.busy"
            @click="emit('openLatest', actionToDetailedId[step.id])"
          >最近</button>
          <button :disabled="props.busy" @click="emit('action', step.id)">{{ step.label }}</button>
        </div>
      </article>
    </div>

    <details class="architecture-details">
      <summary>当前交互架构</summary>
      <article v-for="zone in layoutZones" :key="zone.id" class="architecture-zone-card">
        <strong>{{ zone.name }}</strong>
        <span>{{ zone.role }}</span>
        <small>{{ zone.placement }}</small>
      </article>
    </details>
  </section>
</template>
