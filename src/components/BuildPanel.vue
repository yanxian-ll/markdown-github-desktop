<script setup lang="ts">
import { computed, ref } from 'vue';
import type { LatexBuildResult } from '../types/app';
import type { LatexDiagnosticItem } from '../types/latexIntelligence';

const props = defineProps<{
  diagnostics: LatexDiagnosticItem[];
  latexResult?: LatexBuildResult | null;
}>();

const emit = defineEmits<{
  openDiagnostic: [payload: { file: string; line: number }];
  close: [];
  resizeStart: [event: MouseEvent];
}>();

const tab = ref<'problems' | 'output' | 'log'>('problems');

function isInteractiveHeaderTarget(event: MouseEvent) {
  const target = event.target as HTMLElement | null;
  return !!target?.closest('button, input, textarea, select, a, [role="button"]');
}

function onHeaderDblclick(event: MouseEvent) {
  if (isInteractiveHeaderTarget(event)) return;
  emit('close');
}
const buildDiagnostics = computed(() => props.latexResult?.diagnostics || []);
const allProblems = computed(() => [
  ...props.diagnostics.map((item) => ({
    key: item.id,
    level: item.severity,
    file: item.file,
    line: item.line,
    message: item.message,
  })),
  ...buildDiagnostics.value.map((item, index) => ({
    key: `build-${index}`,
    level: item.level,
    file: item.file || '',
    line: item.line || 1,
    message: item.message,
  })),
]);
</script>

<template>
  <section class="bottom-panel build-panel">
    <div class="bottom-panel-resize-grip" title="拖动调整日志面板高度" @mousedown="emit('resizeStart', $event)" />
    <div class="bottom-panel-header" title="双击关闭日志栏" @dblclick="onHeaderDblclick">
      <div class="bottom-panel-tabs">
        <button :class="{ active: tab === 'problems' }" @click="tab = 'problems'">问题 {{ allProblems.length }}</button>
        <button :class="{ active: tab === 'output' }" @click="tab = 'output'">输出</button>
        <button :class="{ active: tab === 'log' }" @click="tab = 'log'">日志</button>
      </div>
      <button class="toolbar-icon" title="关闭面板" @click="emit('close')">×</button>
    </div>
    <div class="bottom-panel-body">
      <div v-if="tab === 'problems'" class="problem-list">
        <p v-if="!allProblems.length" class="empty-state small">当前没有问题。</p>
        <button
          v-for="problem in allProblems"
          :key="problem.key"
          class="problem-row"
          :class="problem.level"
          @click="problem.file && emit('openDiagnostic', { file: problem.file, line: problem.line || 1 })"
        >
          <span>{{ problem.level === 'error' ? '●' : '▲' }}</span>
          <code>{{ problem.file || '构建日志' }}{{ problem.line ? `:${problem.line}` : '' }}</code>
          <span>{{ problem.message }}</span>
        </button>
      </div>
      <pre v-else-if="tab === 'output'" class="build-log">{{ latexResult?.command || '尚未构建。' }}</pre>
      <pre v-else class="build-log">{{ latexResult?.log || '尚无构建日志。' }}</pre>
    </div>
  </section>
</template>
