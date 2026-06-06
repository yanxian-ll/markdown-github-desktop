<script setup lang="ts">
import type { MarkdownDocument } from '../types/app';

const props = defineProps<{
  active?: MarkdownDocument;
  busy?: boolean;
  previewVisible?: boolean;
  explorerVisible?: boolean;
  gitPanelVisible?: boolean;
  gitDirtyCount?: number;
  githubWorkspace?: boolean;
}>();

const emit = defineEmits<{
  submitGithub: [];
  togglePreview: [];
  toggleExplorer: [];
  toggleGitPanel: [];
}>();
</script>

<template>
  <header class="toolbar">
    <div class="brand">
      <button class="toolbar-icon" :title="props.explorerVisible ? '隐藏文档树' : '显示文档树'" @click="emit('toggleExplorer')">
        {{ props.explorerVisible ? '☰' : '▣' }}
      </button>
      <span class="logo">S</span>
      <div>
        <strong>Scholia Studio</strong>
        <small>{{ props.active?.relativePath || props.active?.title || '未选择文档' }}{{ props.active?.dirty ? ' · 未保存' : '' }}</small>
      </div>
    </div>
    <div class="actions compact-actions">
      <button
        :disabled="props.busy || !props.githubWorkspace || !props.gitDirtyCount"
        :title="props.githubWorkspace ? '提交源码、资源和批注到 GitHub' : '本地工作区无需 GitHub 提交'"
        @click="emit('submitGithub')"
      >
        提交{{ props.githubWorkspace && props.gitDirtyCount ? `(${props.gitDirtyCount})` : '' }}
      </button>
      <button class="toolbar-icon" :class="{ ghost: !props.previewVisible }" :title="props.previewVisible ? '隐藏预览' : '显示预览'" @click="emit('togglePreview')">
        {{ props.previewVisible ? '◫' : '◧' }}
      </button>
      <button class="toolbar-icon" :class="{ ghost: !props.gitPanelVisible }" :title="props.gitPanelVisible ? '隐藏设置' : '显示设置'" @click="emit('toggleGitPanel')">
        ⚙
      </button>
    </div>
  </header>
</template>
