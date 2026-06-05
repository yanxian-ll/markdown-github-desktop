<script setup lang="ts">
import { reactive, watch } from 'vue';
import type { GitStatusEntry, GitWorkspace, LatexBuildResult } from '../types/app';

const props = defineProps<{
  visible: boolean;
  userHint?: string;
  workspace?: GitWorkspace;
  commentAuthorName?: string;
  gitEntries: GitStatusEntry[];
  latexResult?: LatexBuildResult | null;
  busy?: boolean;
  gitBusy?: boolean;
  workspaceBusy?: boolean;
  latexBusy?: boolean;
  latexActive?: boolean;
  pdfRenderQuality?: number;
}>();

const emit = defineEmits<{
  setToken: [token: string];
  forgetToken: [];
  clone: [workspace: GitWorkspace];
  updateAuthorName: [value: string];
  refresh: [];
  submit: [];
  buildLatex: [];
  cleanLatex: [];
  openPdf: [];
  updatePdfRenderQuality: [value: number];
  hide: [];
}>();

const form = reactive<GitWorkspace>({
  owner: 'yanxian-ll',
  repo: 'test-markdown-notes',
  branch: 'main',
  localDir: 'C:/Users/21078/Documents/test-markdown-notes',
  rootPath: '',
});
const tokenForm = reactive({ token: '' });

function onPdfQualityInput(event: Event) {
  const target = event.target as HTMLInputElement | null;
  if (!target) return;
  emit('updatePdfRenderQuality', Number(target.value));
}

watch(
  () => props.workspace,
  (workspace) => {
    if (!workspace) {
      form.owner = props.commentAuthorName || form.owner;
      return;
    }
    form.owner = workspace.owner || props.commentAuthorName || form.owner;
    form.repo = workspace.repo;
    form.branch = workspace.branch;
    form.localDir = workspace.localDir;
    form.rootPath = workspace.rootPath;
  },
  { immediate: true },
);

watch(
  () => props.commentAuthorName,
  (name) => {
    if (!props.workspace?.owner && name) form.owner = name;
  },
);

function onOwnerInput() {
  emit('updateAuthorName', form.owner);
}
</script>

<template>
  <aside v-if="props.visible" class="git-panel settings-panel">
    <div class="settings-header">
      <div>
        <h2>设置</h2>
        <small>GitHub、本地工作区、LaTeX 构建</small>
      </div>
    </div>
    <section class="panel-section">
      <h3>GitHub Token</h3>
      <p v-if="props.userHint" class="connected">{{ props.userHint }}</p>
      <div class="field-stack">
        <label>GitHub Token（Fine-grained / classic PAT）</label>
        <input v-model="tokenForm.token" type="password" placeholder="github_pat_..." @keydown.enter="emit('setToken', tokenForm.token)" />
        <div class="button-row">
          <button :disabled="!tokenForm.token || props.gitBusy || props.workspaceBusy" @click="emit('setToken', tokenForm.token)">保存凭据</button>
        </div>
        <button v-if="props.userHint" class="danger" @click="emit('forgetToken')">移除 token</button>
        <p class="hint">只使用 token 鉴权；私有仓库建议 Fine-grained PAT：Contents 读写 + Metadata 读取。</p>
      </div>
    </section>

    <section class="panel-section">
      <h3>GitHub 工作区</h3>
      <div class="grid-form one-col">
        <label>用户名<input v-model="form.owner" placeholder="用于 GitHub，也作为批注作者" @input="onOwnerInput" /></label>
        <label>仓库<input v-model="form.repo" placeholder="test-markdown-notes" /></label>
        <label>分支<input v-model="form.branch" placeholder="main" /></label>
        <label>本地目录<input v-model="form.localDir" placeholder="C:/Users/你/Documents/test-markdown-notes" /></label>
        <label>子目录<input v-model="form.rootPath" placeholder="可留空，例如 docs" /></label>
      </div>
      <div class="button-row wrap">
        <button :disabled="props.workspaceBusy || props.gitBusy || !form.owner || !form.repo || !form.localDir" @click="emit('clone', { ...form })">
          {{ props.workspaceBusy ? '同步中…' : '获取/更新' }}
        </button>
        <button class="ghost" :disabled="props.workspaceBusy || !props.workspace" @click="emit('refresh')">刷新</button>
      </div>
      <p class="hint">用于从 GitHub 获取项目并推送修改。本地文件请在左侧“文档”栏点击 📂 打开。</p>
    </section>

    <section class="panel-section">
      <div class="tree-header">
        <h3>Git 状态</h3>
        <span>{{ props.gitEntries.length }}</span>
      </div>
      <div v-if="!props.gitEntries.length" class="empty-state small">没有待提交变更。</div>
      <div v-for="entry in props.gitEntries" :key="entry.path" class="status-entry">
        <code>{{ entry.code || '??' }}</code><span>{{ entry.path }}</span>
      </div>
    </section>

    <section class="panel-section">
      <h3>PDF 预览</h3>
      <label class="range-field">
        <span>预览分辨率：{{ Math.round((props.pdfRenderQuality ?? 0.72) * 100) }}%</span>
        <input
          type="range"
          min="0.45"
          max="1.25"
          step="0.05"
          :value="props.pdfRenderQuality ?? 0.72"
          @input="onPdfQualityInput"
        />
      </label>
      <p class="hint">低倍率更流畅，适合长论文；高倍率更清晰，但 PDF 渲染会更慢。只影响软件内预览，不影响导出的 PDF。</p>
    </section>

    <section class="panel-section latex-section">
      <h3>LaTeX</h3>
      <p class="hint">支持 .tex、.bib、.cls/.sty 和图片资源。建议安装 latexmk；未安装时会自动回退到 pdflatex 构建流程。</p>
      <div class="button-row wrap">
        <button :disabled="props.latexBusy || !props.latexActive" @click="emit('buildLatex')">{{ props.latexBusy ? '构建中…' : '构建 PDF' }}</button>
        <button class="ghost" :disabled="props.latexBusy || !props.latexActive" @click="emit('cleanLatex')">清理辅助文件</button>
      </div>
      <div v-if="props.latexResult" class="latex-result" :class="{ ok: props.latexResult.ok }">
        <strong>{{ props.latexResult.ok ? '构建成功' : '构建失败' }}</strong>
        <small>{{ props.latexResult.command }}</small>
        <small v-if="props.latexResult.pdfPath">{{ props.latexResult.pdfPath }}</small>
        <div v-for="(diag, index) in props.latexResult.diagnostics" :key="index" class="diagnostic" :class="diag.level">
          {{ diag.level }}: {{ diag.message }}
        </div>
        <details>
          <summary>构建日志</summary>
          <pre>{{ props.latexResult.log }}</pre>
        </details>
      </div>
    </section>
  </aside>
</template>
