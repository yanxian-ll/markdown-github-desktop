<script setup lang="ts">
import { reactive, ref, watch } from 'vue';
import type { GitHubTreeFile, GitHubWorkspace } from '../types/app';

const props = defineProps<{
  user?: string;
  workspace?: GitHubWorkspace;
  tree: GitHubTreeFile[];
  busy?: boolean;
}>();

const emit = defineEmits<{
  setToken: [token: string];
  forgetToken: [];
  loadWorkspace: [workspace: GitHubWorkspace];
  openFile: [file: GitHubTreeFile];
  refresh: [];
}>();

const token = ref('');
const workspaceForm = reactive<GitHubWorkspace>({ owner: '', repo: '', branch: 'main', rootPath: '' });
const filter = ref('');

watch(
  () => props.workspace,
  (workspace) => {
    if (!workspace) return;
    workspaceForm.owner = workspace.owner;
    workspaceForm.repo = workspace.repo;
    workspaceForm.branch = workspace.branch;
    workspaceForm.rootPath = workspace.rootPath;
  },
  { immediate: true },
);

function filteredTree() {
  const q = filter.value.trim().toLowerCase();
  if (!q) return props.tree;
  return props.tree.filter((file) => file.path.toLowerCase().includes(q));
}
</script>

<template>
  <aside class="github-panel">
    <section class="panel-section">
      <h2>GitHub</h2>
      <p v-if="props.user" class="connected">已连接：{{ props.user }}</p>
      <div v-else class="field-stack">
        <label>Fine-grained / classic PAT</label>
        <input v-model="token" type="password" placeholder="github_pat_..." @keydown.enter="emit('setToken', token)" />
        <button :disabled="!token || props.busy" @click="emit('setToken', token)">保存到系统凭据</button>
        <p class="hint">token 只存到系统 Keychain / Credential Manager / Secret Service，不写入状态 JSON。</p>
      </div>
      <button v-if="props.user" class="danger" @click="emit('forgetToken')">移除 token</button>
    </section>

    <section class="panel-section">
      <h3>同步目录</h3>
      <div class="grid-form">
        <label>Owner<input v-model="workspaceForm.owner" placeholder="openai" /></label>
        <label>Repo<input v-model="workspaceForm.repo" placeholder="docs" /></label>
        <label>Branch<input v-model="workspaceForm.branch" placeholder="main" /></label>
        <label>Path<input v-model="workspaceForm.rootPath" placeholder="docs/articles" /></label>
      </div>
      <button :disabled="props.busy || !workspaceForm.owner || !workspaceForm.repo" @click="emit('loadWorkspace', { ...workspaceForm })">
        加载 Markdown 文件树
      </button>
      <button :disabled="props.busy || !props.workspace" class="ghost" @click="emit('refresh')">刷新</button>
    </section>

    <section class="panel-section file-tree">
      <div class="tree-header">
        <h3>仓库文件</h3>
        <span>{{ filteredTree().length }}</span>
      </div>
      <input v-model="filter" placeholder="过滤文件路径" />
      <button v-for="file in filteredTree()" :key="file.path" class="tree-item" @click="emit('openFile', file)">
        <span>📄</span>
        <span>{{ file.path }}</span>
      </button>
    </section>
  </aside>
</template>
