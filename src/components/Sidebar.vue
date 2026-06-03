<script setup lang="ts">
import type { MarkdownDocument } from '../types/app';

const props = defineProps<{
  documents: MarkdownDocument[];
  activeId?: string;
  dirtyCount: number;
}>();

const emit = defineEmits<{
  select: [id: string];
  close: [id: string];
  newFile: [];
}>();
</script>

<template>
  <aside class="sidebar">
    <div class="sidebar-header">
      <div>
        <strong>文档</strong>
        <small>{{ props.dirtyCount ? `${props.dirtyCount} 个未保存` : '全部已保存' }}</small>
      </div>
      <button class="icon-button" title="新建" @click="emit('newFile')">＋</button>
    </div>

    <button
      v-for="doc in props.documents"
      :key="doc.id"
      class="doc-item"
      :class="{ active: doc.id === props.activeId }"
      @click="emit('select', doc.id)"
    >
      <span class="doc-source" :title="doc.source">{{ doc.source === 'github' ? 'GH' : doc.source === 'local' ? 'FS' : 'MD' }}</span>
      <span class="doc-title">
        {{ doc.title }}
        <small>{{ doc.github?.path || doc.localPath || '草稿' }}</small>
      </span>
      <span v-if="doc.dirty" class="dirty-dot" title="未保存" />
      <span class="close" title="关闭" @click.stop="emit('close', doc.id)">×</span>
    </button>
  </aside>
</template>
