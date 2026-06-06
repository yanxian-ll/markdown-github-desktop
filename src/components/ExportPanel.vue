<script setup lang="ts">
const props = defineProps<{ activeKind?: string; busy?: boolean }>();
const emit = defineEmits<{ exportFormat: [format: 'pdf' | 'docx' | 'html' | 'epub' | 'latex' | 'beamer']; close: [] }>();
const formats = [
  { key: 'pdf', label: 'PDF', hint: 'Pandoc + LaTeX 引擎' },
  { key: 'docx', label: 'DOCX', hint: 'Word 投稿/协作' },
  { key: 'html', label: 'HTML', hint: '网页预览/博客' },
  { key: 'epub', label: 'EPUB', hint: '电子书' },
  { key: 'latex', label: 'LaTeX', hint: '导出 .tex' },
  { key: 'beamer', label: 'Beamer', hint: 'Markdown → 幻灯片 PDF' },
] as const;
</script>

<template>
  <section class="side-work-panel export-panel">
    <header class="side-work-panel-header">
      <div>
        <h3>导出</h3>
        <small>当前第一版支持 Markdown 通过 Pandoc 多格式导出。</small>
      </div>
      <button class="toolbar-icon" @click="emit('close')">×</button>
    </header>
    <p v-if="activeKind !== 'markdown'" class="empty-state small">多格式导出当前仅对 Markdown 文件开放；LaTeX 可继续用构建 PDF。</p>
    <div class="export-grid">
      <button v-for="format in formats" :key="format.key" :disabled="activeKind !== 'markdown' || busy" @click="emit('exportFormat', format.key)">
        <strong>{{ format.label }}</strong>
        <small>{{ format.hint }}</small>
      </button>
    </div>
  </section>
</template>
