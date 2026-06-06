<script setup lang="ts">
import type { GitStatusEntry } from '../types/app';
const props = defineProps<{ entries: GitStatusEntry[]; local?: boolean }>();
const emit = defineEmits<{ close: [] }>();
</script>
<template>
  <section class="side-work-panel history-panel">
    <header class="side-work-panel-header">
      <div>
        <h3>历史</h3>
        <small>{{ props.local ? '本地快照框架已预留；Git 历史后续增强。' : '当前变更列表' }}</small>
      </div>
      <button class="toolbar-icon" @click="emit('close')">×</button>
    </header>
    <p class="empty-state small">v1.x 将继续实现提交时间线、双版本 diff、逐块接受/拒绝和自动快照清理。</p>
    <div v-if="entries.length" class="history-change-list">
      <div v-for="entry in entries" :key="`${entry.code}:${entry.path}`" class="status-entry">
        <code>{{ entry.code }}</code><span>{{ entry.path }}</span>
      </div>
    </div>
  </section>
</template>
