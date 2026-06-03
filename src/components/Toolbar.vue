<script setup lang="ts">
import type { MarkdownDocument } from '../types/app';

const props = defineProps<{
  active?: MarkdownDocument;
  busy?: boolean;
  canSaveToGitHub?: boolean;
  previewVisible?: boolean;
}>();

const emit = defineEmits<{
  newFile: [];
  saveLocal: [];
  saveGithub: [];
  togglePreview: [];
  flush: [];
}>();
</script>

<template>
  <header class="toolbar">
    <div class="brand">
      <span class="logo">✦</span>
      <div>
        <strong>Markdown GitHub Desktop</strong>
        <small>{{ props.active?.title || '未选择文档' }}</small>
      </div>
    </div>
    <div class="actions">
      <button @click="emit('newFile')">新建</button>
      <button :disabled="!props.active || props.busy" @click="emit('saveLocal')">保存本地</button>
      <button :disabled="!props.canSaveToGitHub || props.busy" @click="emit('saveGithub')">提交 GitHub</button>
      <button :class="{ ghost: !props.previewVisible }" @click="emit('togglePreview')">
        {{ props.previewVisible ? '隐藏预览' : '显示预览' }}
      </button>
    </div>
  </header>
</template>
