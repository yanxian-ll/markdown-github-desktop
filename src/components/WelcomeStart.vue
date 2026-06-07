<script setup lang="ts">
import type { DocumentKind, FirstRunMode } from '../types/app';

const props = defineProps<{
  busy?: boolean;
}>();

const emit = defineEmits<{
  openLocal: [kind: 'folder' | 'file'];
  newScratch: [kind: DocumentKind];
  quickStart: [mode: FirstRunMode];
  openSample: [];
}>();

const flows: Array<{ id: FirstRunMode; title: string; description: string; action: string }> = [
  { id: 'paper', title: '写论文', description: '设置主 TeX/Markdown，建立论文大纲和证据索引。', action: '创建论文起步草稿' },
  { id: 'notes', title: '做研究记录', description: '从每日笔记开始，沉淀实验、图表、结论和风险。', action: '创建研究记录' },
  { id: 'review', title: '审阅 PDF', description: '打开 PDF 或论文工作区，将批注统一进入审阅清单。', action: '选择 PDF/文件' },
  { id: 'weekly', title: '写周报', description: '从每日记录和批注汇总本周完成、证据和计划。', action: '创建周报草稿' },
];
</script>

<template>
  <section class="welcome-start-page">
    <div class="welcome-hero-card">
      <div class="welcome-hero-copy">
        <span class="eyebrow">Scholia Studio</span>
        <h1>本地优先的科研写作工作台</h1>
        <p class="welcome-subtitle">
          先记录研究过程，再沉淀证据，最后进入论文写作和 PDF 审阅。所有核心文件都保存在你的本地工作区。
        </p>
        <div class="welcome-action-row">
          <button class="primary large" :disabled="props.busy" @click="emit('openLocal', 'folder')">打开文件夹</button>
          <button :disabled="props.busy" @click="emit('openLocal', 'file')">打开单个文件/PDF</button>
          <button class="ghost" :disabled="props.busy" @click="emit('openSample')">打开示例工作区</button>
          <button class="ghost" :disabled="props.busy" @click="emit('newScratch', 'markdown')">临时 Markdown</button>
        </div>
      </div>
    </div>

    <div class="welcome-flow-grid">
      <button v-for="flow in flows" :key="flow.id" class="welcome-flow-card" :disabled="props.busy" @click="emit('quickStart', flow.id)">
        <strong>{{ flow.title }}</strong>
        <span>{{ flow.description }}</span>
        <small>{{ flow.action }} →</small>
      </button>
    </div>

    <div class="welcome-shortcuts-card">
      <strong>常用快捷键</strong>
      <span><kbd>Ctrl/Cmd+S</kbd> 保存，<kbd>Ctrl/Cmd+B</kbd> 构建，<kbd>Ctrl/Cmd+Alt+V</kbd> 切换预览，双击栏标题可收起/展开。</span>
    </div>
  </section>
</template>
