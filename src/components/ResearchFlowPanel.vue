<script setup lang="ts">
import { computed } from 'vue';
import type { PaperAnnotation } from '../types/app';
import type { ProjectLatexIndex } from '../types/latexIntelligence';
import { RESEARCH_FLOW_STEPS, WORKBENCH_ZONES, type ResearchFlowActionId } from '../config/workbench';

const props = defineProps<{
  activePath?: string;
  writingStatsLabel?: string;
  latexIndex: ProjectLatexIndex;
  annotations: PaperAnnotation[];
  busy?: boolean;
}>();

const emit = defineEmits<{
  close: [];
  action: [id: ResearchFlowActionId];
}>();

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
        </div>
        <button :disabled="props.busy" @click="emit('action', step.id)">{{ step.label }}</button>
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
