<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, watch } from 'vue';
import { storeToRefs } from 'pinia';
import MarkdownEditor from './components/MarkdownEditor.vue';
import MarkdownPreview from './components/MarkdownPreview.vue';
import Sidebar from './components/Sidebar.vue';
import Toolbar from './components/Toolbar.vue';
import GitHubPanel from './components/GitHubPanel.vue';
import { useAppStore } from './stores/appStore';
import type { GitHubWorkspace } from './types/app';

const store = useAppStore();
const {
  documents,
  activeDocument,
  activeDocumentId,
  githubWorkspace,
  githubTree,
  githubUser,
  busy,
  status,
  error,
  saveConflict,
  dirtyCount,
  canSaveToGitHub,
  darkMode,
  previewVisible,
} = storeToRefs(store);

const activeText = computed({
  get: () => activeDocument.value?.text ?? '',
  set: (value: string) => store.updateActiveText(value),
});

let persistTimer: number | undefined;
watch(
  () => activeDocument.value?.text,
  () => {
    window.clearTimeout(persistTimer);
    persistTimer = window.setTimeout(() => store.persist(), 700);
  },
);

async function saveLocal() {
  const current = activeDocument.value;
  const fallback = current?.localPath || current?.title || 'Untitled.md';
  const target = window.prompt('输入本地保存路径（绝对路径）', fallback);
  if (!target) return;
  await store.saveActiveLocal(target);
}

async function openLocal() {
  const target = window.prompt('输入本地 Markdown 文件路径（绝对路径）');
  if (!target) return;
  await store.openLocalPath(target);
}

async function saveGithub() {
  const current = activeDocument.value;
  const defaultMessage = current?.github ? `docs: update ${current.github.path}` : 'docs: update markdown';
  const message = window.prompt('Git commit message', defaultMessage) || defaultMessage;
  await store.saveActiveToGithub(message);
}

async function loadWorkspace(workspace: GitHubWorkspace) {
  await store.configureGithubWorkspace(workspace);
}

function onKeydown(event: KeyboardEvent) {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'o') {
    event.preventDefault();
    openLocal();
  }
}

onMounted(async () => {
  window.addEventListener('keydown', onKeydown);
  await store.initialize();
});

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown);
});
</script>

<template>
  <div class="app-shell" :class="{ light: !darkMode }">
    <Toolbar
      :active="activeDocument"
      :busy="busy"
      :can-save-to-git-hub="canSaveToGitHub"
      :preview-visible="previewVisible"
      @new-file="store.newScratchDocument()"
      @save-local="saveLocal"
      @save-github="saveGithub"
      @toggle-preview="previewVisible = !previewVisible"
    />

    <main class="workspace">
      <Sidebar
        :documents="documents"
        :active-id="activeDocumentId"
        :dirty-count="dirtyCount"
        @select="store.setActiveDocument"
        @close="store.closeDocument"
        @new-file="store.newScratchDocument()"
      />

      <section class="editor-layout" :class="{ 'preview-hidden': !previewVisible }">
        <div class="editor-column">
          <MarkdownEditor v-model="activeText" :dark-mode="darkMode" @save="saveGithub" />
        </div>
        <div v-if="previewVisible" class="preview-column">
          <MarkdownPreview :text="activeText" :dark-mode="darkMode" />
        </div>
      </section>

      <GitHubPanel
        :user="githubUser"
        :workspace="githubWorkspace"
        :tree="githubTree"
        :busy="busy"
        @set-token="store.setGithubToken"
        @forget-token="store.forgetGithubToken"
        @load-workspace="loadWorkspace"
        @open-file="store.openGithubFile"
        @refresh="store.refreshGithubTree"
      />
    </main>

    <footer class="statusbar">
      <button class="link-button" @click="openLocal">打开本地文件</button>
      <button class="link-button" @click="darkMode = !darkMode">{{ darkMode ? '浅色' : '深色' }}</button>
      <span>{{ busy ? '处理中…' : status }}</span>
      <span v-if="error" class="error">{{ error }}</span>
    </footer>

    <div v-if="saveConflict" class="modal-backdrop">
      <div class="modal-card">
        <h2>检测到远端冲突</h2>
        <p>GitHub 上的 <code>{{ saveConflict.path }}</code> 已经被其他地方更新。请选择处理方式。</p>
        <div class="modal-actions">
          <button @click="store.pullRemoteConflict()">拉取远端覆盖本地</button>
          <button class="danger" @click="store.overwriteRemoteConflict()">覆盖 GitHub 远端</button>
        </div>
      </div>
    </div>
  </div>
</template>
