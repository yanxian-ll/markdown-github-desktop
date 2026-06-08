<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import type { EnvironmentToolCheck, EnvironmentToolId, GitStatusEntry, GitWorkspace, LatexBuildResult, MarkdownRenderPreset, ToolPathSettings, ProjectSettings, ExportProfile, PackageExportResult, GitSyncResult, PublishProfile } from '../types/app';

const props = defineProps<{
  visible: boolean;
  userHint?: string;
  githubLogin?: string;
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
  markdownRenderPreset?: MarkdownRenderPreset;
  toolPaths?: ToolPathSettings;
  environmentChecks?: EnvironmentToolCheck[];
  recoveryWarning?: string;
  draftCount?: number;
  projectSettings?: ProjectSettings;
  exportProfiles?: ExportProfile[];
  lastPackageExport?: PackageExportResult | null;
  lastGitSyncResult?: GitSyncResult | null;
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
  updateMarkdownRenderPreset: [value: MarkdownRenderPreset];
  setToolPath: [id: EnvironmentToolId, value: string];
  checkEnvironment: [];
  createSnapshot: [];
  exportDebug: [];
  updateProjectSetting: [key: keyof ProjectSettings, value: ProjectSettings[keyof ProjectSettings]];
  updateExportProfile: [profile: ExportProfile];
  updatePublishProfile: [profile: PublishProfile];
  publishActive: [profileId?: string];
  exportSubmissionPackage: [];
  exportSharedReviewPackage: [];
  openPackageFolder: [path: string];
  gitPull: [];
  gitPush: [];
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
const activeTab = ref<'environment' | 'git' | 'author' | 'pdf' | 'export' | 'publish' | 'collaboration' | 'privacy'>('environment');
const settingsTabs: Array<{ id: typeof activeTab.value; label: string }> = [
  { id: 'environment', label: '环境' },
  { id: 'git', label: 'Git' },
  { id: 'author', label: '作者' },
  { id: 'pdf', label: 'PDF/LaTeX' },
  { id: 'export', label: '导出' },
  { id: 'publish', label: '发布' },
  { id: 'collaboration', label: '协作' },
  { id: 'privacy', label: '隐私' },
];

const publishProfiles = computed(() => props.projectSettings?.publishing?.profiles || []);
const activePublishProfile = computed(() => {
  const id = props.projectSettings?.publishing?.activeProfileId;
  return publishProfiles.value.find((item) => item.id === id) || publishProfiles.value[0];
});
const publishForm = reactive<PublishProfile>({
  id: 'hugo-default',
  name: 'Hugo 内容包',
  engine: 'hugo',
  contentDir: 'content/posts',
  assetDir: 'static/images',
  frontmatterMode: 'yaml',
  resourceStrategy: 'copy-local',
  draft: true,
  baseUrl: '',
});

function syncPublishForm(profile?: PublishProfile) {
  if (!profile) return;
  Object.assign(publishForm, profile);
}

function selectPublishProfile(event: Event) {
  const id = (event.target as HTMLSelectElement | null)?.value;
  const profile = publishProfiles.value.find((item) => item.id === id);
  if (profile) syncPublishForm(profile);
}

function savePublishProfile() {
  emit('updatePublishProfile', { ...publishForm });
}

function onExportProfileText(profile: ExportProfile, key: keyof ExportProfile, event: Event) {
  const target = event.target as HTMLInputElement | null;
  if (!target) return;
  emit('updateExportProfile', { ...profile, [key]: target.value });
}

function onExportProfileCiteproc(profile: ExportProfile, event: Event) {
  const target = event.target as HTMLInputElement | null;
  emit('updateExportProfile', { ...profile, citeproc: !!target?.checked });
}

function updateProjectText(key: keyof ProjectSettings, event: Event) {
  const target = event.target as HTMLInputElement | HTMLSelectElement | null;
  if (!target) return;
  emit('updateProjectSetting', key, target.value as ProjectSettings[keyof ProjectSettings]);
}

function onAuthorNameInput(event: Event) {
  const target = event.target as HTMLInputElement | null;
  emit('updateAuthorName', target?.value || '');
}

const environmentToolFields: Array<{ id: EnvironmentToolId; label: string; placeholder: string }> = [
  { id: 'pandoc', label: 'Pandoc', placeholder: 'pandoc 或完整路径，例如 C:/Program Files/Pandoc/pandoc.exe' },
  { id: 'xelatex', label: 'XeLaTeX', placeholder: 'xelatex 或完整路径' },
  { id: 'latexmk', label: 'latexmk', placeholder: 'latexmk 或完整路径' },
  { id: 'synctex', label: 'SyncTeX', placeholder: 'synctex 或完整路径' },
  { id: 'git', label: 'Git', placeholder: 'git 或完整路径' },
];

function onToolPathInput(id: EnvironmentToolId, event: Event) {
  const target = event.target as HTMLInputElement | null;
  if (!target) return;
  emit('setToolPath', id, target.value);
}

function environmentCheckClass(check: EnvironmentToolCheck) {
  if (check.ok) return 'ok';
  return check.required ? 'error' : 'warning';
}

const markdownRenderPresets: Array<{ id: MarkdownRenderPreset; name: string; description: string }> = [
  { id: 'default', name: '默认', description: '均衡的编辑预览风格，适合日常记录。' },
  { id: 'academic', name: '学术论文', description: '较窄版心、衬线正文、标题层级清晰。' },
  { id: 'reading', name: '长文阅读', description: '更舒展的行距和段距，适合审阅长笔记。' },
  { id: 'compact', name: '紧凑', description: '减少边距和段距，适合并排预览。' },
  { id: 'manuscript', name: '手稿', description: '接近投稿草稿，强调段落、引用和表格。' },
];

function onMarkdownPresetChange(event: Event) {
  const target = event.target as HTMLSelectElement | null;
  if (!target) return;
  emit('updateMarkdownRenderPreset', target.value as MarkdownRenderPreset);
}

function onPdfQualityInput(event: Event) {
  const target = event.target as HTMLInputElement | null;
  if (!target) return;
  emit('updatePdfRenderQuality', Number(target.value));
}

watch(
  () => props.workspace,
  (workspace) => {
    if (!workspace) {
      form.owner = props.githubLogin || props.commentAuthorName || form.owner;
      return;
    }
    form.owner = workspace.owner || props.githubLogin || props.commentAuthorName || form.owner;
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
    if (!props.workspace?.owner && !props.githubLogin && name) form.owner = name;
  },
);

watch(
  () => props.githubLogin,
  (login) => {
    if (!login) return;
    // token 验证得到的 GitHub login 是可信账号名，应直接覆盖工作区用户名输入框，
    // 即使之前已经填过 owner，也要让界面与新 token 绑定的账号保持一致。
    form.owner = login;
  },
);

watch(
  () => props.userHint,
  (hint) => {
    if (hint?.includes('已验证')) tokenForm.token = '';
  },
);

watch(activePublishProfile, (profile) => syncPublishForm(profile), { immediate: true });

function onOwnerInput() {
  emit('updateAuthorName', form.owner);
}

function isInteractiveHeaderTarget(event: MouseEvent) {
  const target = event.target as HTMLElement | null;
  return !!target?.closest('button, input, textarea, select, a, [role="button"]');
}

function onHeaderDblclick(event: MouseEvent) {
  if (isInteractiveHeaderTarget(event)) return;
  emit('hide');
}
</script>

<template>
  <aside v-if="props.visible" class="git-panel settings-panel">
    <div class="settings-header" title="双击关闭设置栏" @dblclick="onHeaderDblclick">
      <div>
        <h2>设置</h2>
        <small>环境、Git、作者、PDF/LaTeX、导出、隐私</small>
      </div>
    </div>
    <nav class="settings-tabs" aria-label="设置分类">
      <button v-for="tab in settingsTabs" :key="tab.id" :class="{ active: activeTab === tab.id }" @click="activeTab = tab.id">{{ tab.label }}</button>
    </nav>
    <section v-show="activeTab === 'git'" class="panel-section">
      <h3>GitHub Token</h3>
      <p v-if="props.userHint" class="connected">{{ props.userHint }}</p>
      <div class="field-stack">
        <label>GitHub Token（Fine-grained / classic PAT）</label>
        <input v-model="tokenForm.token" type="password" placeholder="github_pat_..." @keydown.enter="emit('setToken', tokenForm.token)" />
        <div class="button-row">
          <button :disabled="!tokenForm.token || props.gitBusy || props.workspaceBusy" @click="emit('setToken', tokenForm.token)">
            {{ props.gitBusy ? '验证中…' : '验证并保存' }}
          </button>
        </div>
        <button v-if="props.userHint" class="danger" @click="emit('forgetToken')">移除 token</button>
        <p class="hint">保存前会请求 GitHub /user 验证 token，并自动把 GitHub 用户名填入下方工作区。私有仓库建议 Fine-grained PAT：Contents 读写 + Metadata 读取。</p>
      </div>
    </section>

    <section v-show="activeTab === 'git'" class="panel-section">
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
      <p class="hint">用于从 GitHub 获取项目并推送修改。本地文件请在左侧“文档”栏点击打开按钮。</p>
    </section>

    <section v-show="activeTab === 'git'" class="panel-section">
      <div class="tree-header">
        <h3>Git 状态</h3>
        <span>{{ props.gitEntries.length }}</span>
      </div>
      <div v-if="!props.gitEntries.length" class="empty-state small">没有待提交变更。</div>
      <div v-for="entry in props.gitEntries" :key="entry.path" class="status-entry">
        <code>{{ entry.code || '??' }}</code><span>{{ entry.path }}</span>
      </div>
      <div class="button-row wrap">
        <button class="ghost" :disabled="props.gitBusy || props.workspaceBusy || !props.workspace" @click="emit('gitPull')">Pull + 冲突检测</button>
        <button class="ghost" :disabled="props.gitBusy || props.workspaceBusy || !props.workspace" @click="emit('gitPush')">Push 当前分支</button>
      </div>
      <div v-if="props.lastGitSyncResult" class="latex-result" :class="{ ok: props.lastGitSyncResult.ok }">
        <strong>{{ props.lastGitSyncResult.ok ? '同步完成' : '需要处理冲突/错误' }}</strong>
        <small>{{ props.lastGitSyncResult.command }}</small>
        <div v-if="props.lastGitSyncResult.conflictedFiles.length" class="conflict-list">
          <span v-for="file in props.lastGitSyncResult.conflictedFiles" :key="file" class="status-entry"><code>CONFLICT</code><span>{{ file }}</span></span>
        </div>
        <details><summary>Git 日志</summary><pre>{{ props.lastGitSyncResult.log }}</pre></details>
      </div>
    </section>

    <section v-show="activeTab === 'author'" class="panel-section author-section">
      <h3>作者与批注身份</h3>
      <div class="grid-form one-col">
        <label>作者 / 批注用户名<input :value="props.commentAuthorName || ''" placeholder="你的名字" @input="onAuthorNameInput" /></label>
      </div>
      <p class="hint">用于每日记录、批注回复、解决说明和项目元数据。</p>
    </section>

    <section v-show="activeTab === 'export'" class="panel-section project-settings-section">
      <h3>项目主文件与 Pandoc profiles</h3>
      <div class="grid-form one-col">
        <label>主 TeX 文件<input :value="props.projectSettings?.mainTexFile || ''" placeholder="paper/main.tex" @input="updateProjectText('mainTexFile', $event)" /></label>
        <label>主 Markdown 文件<input :value="props.projectSettings?.mainMarkdownFile || ''" placeholder="paper/paper.md" @input="updateProjectText('mainMarkdownFile', $event)" /></label>
        <label>构建命令
          <select :value="props.projectSettings?.buildCommand || 'auto'" @change="updateProjectText('buildCommand', $event)">
            <option value="auto">自动</option>
            <option value="latexmk">latexmk</option>
            <option value="xelatex">xelatex</option>
            <option value="pdflatex">pdflatex</option>
            <option value="lualatex">lualatex</option>
          </select>
        </label>
        <label>Pandoc profile<input :value="props.projectSettings?.pandocProfileId || props.projectSettings?.exportProfile || 'pdf'" placeholder="pdf / docx / html" @input="updateProjectText('pandocProfileId', $event)" /></label>
      </div>
      <div class="export-profile-list">
        <article v-for="profile in props.exportProfiles || []" :key="profile.id" class="export-profile-card">
          <header class="tree-header"><strong>{{ profile.name }}</strong><code>{{ profile.format.toUpperCase() }}</code></header>
          <small>{{ profile.description || profile.args.join(' ') || '默认参数' }}</small>
          <div class="grid-form one-col compact-form">
            <label>Bibliography<input :value="profile.bibliography || ''" placeholder="refs.bib" @change="onExportProfileText(profile, 'bibliography', $event)" /></label>
            <label>CSL<input :value="profile.csl || ''" placeholder="ieee.csl / acm.csl" @change="onExportProfileText(profile, 'csl', $event)" /></label>
            <label>DOCX reference-doc<input :value="profile.referenceDoc || ''" placeholder="reference.docx" @change="onExportProfileText(profile, 'referenceDoc', $event)" /></label>
            <label>输出目录<input :value="profile.outputDir || ''" placeholder="dist / export" @change="onExportProfileText(profile, 'outputDir', $event)" /></label>
            <label class="checkbox-row"><input type="checkbox" :checked="!!profile.citeproc" @change="onExportProfileCiteproc(profile, $event)" /> 启用 citeproc</label>
          </div>
        </article>
      </div>
    </section>

    <section v-show="activeTab === 'publish'" class="panel-section project-settings-section">
      <h3>静态站点发布 Profile</h3>
      <div v-if="publishProfiles.length" class="grid-form one-col">
        <label>Profile
          <select :value="publishForm.id" @change="selectPublishProfile">
            <option v-for="profile in publishProfiles" :key="profile.id" :value="profile.id">{{ profile.name }}</option>
          </select>
        </label>
        <label>名称<input v-model="publishForm.name" /></label>
        <label>引擎
          <select v-model="publishForm.engine">
            <option value="hugo">Hugo</option>
            <option value="jekyll">Jekyll</option>
          </select>
        </label>
        <label>内容目录<input v-model="publishForm.contentDir" placeholder="content/posts" /></label>
        <label>资源目录<input v-model="publishForm.assetDir" placeholder="static/images" /></label>
        <label>Frontmatter
          <select v-model="publishForm.frontmatterMode">
            <option value="yaml">YAML</option>
            <option value="toml">TOML</option>
          </select>
        </label>
        <label>资源策略
          <select v-model="publishForm.resourceStrategy">
            <option value="copy-local">复制本地资源</option>
            <option value="keep-path">保留原路径</option>
          </select>
        </label>
        <label>Base URL<input v-model="publishForm.baseUrl" placeholder="https://example.com" /></label>
        <label class="checkbox-row"><input v-model="publishForm.draft" type="checkbox" /> 标记为 draft</label>
      </div>
      <div class="button-row wrap">
        <button class="ghost" @click="savePublishProfile">保存 Profile</button>
        <button :disabled="props.workspaceBusy || props.busy || !props.workspace" @click="emit('publishActive', publishForm.id)">发布当前 Markdown</button>
      </div>
      <p class="hint">会把当前 Markdown 转换到 Hugo/Jekyll 内容目录，生成 frontmatter，并可复制本地图片到静态资源目录。</p>
      <div v-if="props.lastPackageExport" class="latex-result" :class="{ ok: props.lastPackageExport.ok }">
        <strong>{{ props.lastPackageExport.ok ? '包已生成' : '包已生成，但有跳过项' }}</strong>
        <button class="path-link" type="button" title="打开导出文件夹" @click="emit('openPackageFolder', props.lastPackageExport.outputDir)">{{ props.lastPackageExport.outputDir }}</button>
        <small>Manifest: {{ props.lastPackageExport.manifestPath }}</small>
      </div>
    </section>

    <section v-show="activeTab === 'collaboration'" class="panel-section safety-section">
      <h3>协作与共享审阅包</h3>
      <div class="button-row wrap">
        <button class="ghost" :disabled="props.workspaceBusy || !props.workspace" @click="emit('exportSubmissionPackage')">导出投稿包</button>
        <button class="ghost" :disabled="props.workspaceBusy || !props.workspace" @click="emit('exportSharedReviewPackage')">导出共享审阅包</button>
      </div>
      <p class="hint">点击导出后会先选择保存位置；投稿包会复制源码、图片、BibTeX、cls/sty/bst、README 和编译说明；共享审阅包会复制 PDF、review-items、批注 JSONL 和源码上下文。导出完成后可点击下方路径打开文件夹。</p>
      <div v-if="props.lastPackageExport" class="export-profile-card">
        <strong>最近导出</strong>
        <button class="path-link" type="button" title="打开导出文件夹" @click="emit('openPackageFolder', props.lastPackageExport.outputDir)">{{ props.lastPackageExport.outputDir }}</button>
        <small>复制 {{ props.lastPackageExport.copiedFiles.length }} 个，跳过 {{ props.lastPackageExport.skippedFiles.length }} 个。</small>
      </div>
    </section>

    <section v-if="props.recoveryWarning" v-show="activeTab === 'privacy'" class="panel-section recovery-section">
      <h3>异常恢复</h3>
      <p class="warning-text">{{ props.recoveryWarning }}</p>
      <p class="hint">检测到 {{ props.draftCount || 0 }} 份可恢复草稿。打开对应文件后可继续编辑，正常保存会自动清理该文件的草稿。</p>
    </section>

    <section v-show="activeTab === 'environment'" class="panel-section environment-section">
      <div class="tree-header">
        <h3>构建环境</h3>
        <button class="ghost mini" :disabled="props.busy || props.latexBusy" @click="emit('checkEnvironment')">检查</button>
      </div>
      <div class="field-stack">
        <label v-for="tool in environmentToolFields" :key="tool.id">
          {{ tool.label }} 路径
          <input :value="props.toolPaths?.[tool.id] || ''" :placeholder="tool.placeholder" @input="onToolPathInput(tool.id, $event)" />
        </label>
      </div>
      <div v-if="props.environmentChecks?.length" class="environment-checks">
        <div v-for="check in props.environmentChecks" :key="check.id" class="status-entry tool-check" :class="environmentCheckClass(check)">
          <code>{{ check.ok ? 'OK' : (check.required ? 'ERR' : 'MISS') }}</code>
          <span>
            <strong>{{ check.label }}</strong>
            <small>{{ check.command }}</small>
            <small v-if="check.version">{{ check.version }}</small>
            <small v-else-if="check.error">{{ check.error }}</small>
            <small v-if="!check.ok" class="install-hint">{{ check.installHint }}</small>
          </span>
        </div>
      </div>
      <p class="hint">留空时使用系统 PATH。手动路径会持久保存，并用于 Pandoc、LaTeX 构建和 SyncTeX 定位。</p>
    </section>

    <section v-show="activeTab === 'privacy'" class="panel-section safety-section">
      <h3>安全与诊断</h3>
      <div class="button-row wrap">
        <button class="ghost" :disabled="props.workspaceBusy" @click="emit('createSnapshot')">创建本地快照</button>
        <button class="ghost" :disabled="props.workspaceBusy" @click="emit('exportDebug')">导出诊断包</button>
      </div>
      <p class="hint">快照会备份文本源文件和批注元数据；诊断包包含应用状态、环境检查、构建日志和系统信息，便于排查问题。</p>
    </section>

    <section v-show="activeTab === 'pdf'" class="panel-section">
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


    <section v-show="activeTab === 'export'" class="panel-section markdown-render-section">
      <h3>Markdown 渲染</h3>
      <label class="select-field">
        <span>预设风格</span>
        <select :value="props.markdownRenderPreset || 'default'" @change="onMarkdownPresetChange">
          <option v-for="preset in markdownRenderPresets" :key="preset.id" :value="preset.id">{{ preset.name }}</option>
        </select>
      </label>
      <div class="preset-description-list">
        <button
          v-for="preset in markdownRenderPresets"
          :key="preset.id"
          class="preset-chip"
          :class="{ active: (props.markdownRenderPreset || 'default') === preset.id }"
          :title="preset.description"
          @click="emit('updateMarkdownRenderPreset', preset.id)"
        >
          <strong>{{ preset.name }}</strong>
          <small>{{ preset.description }}</small>
        </button>
      </div>
      <p class="hint">只影响软件内 Markdown 预览，不改动源文件，也不影响 Pandoc 导出。</p>
    </section>

    <section v-show="activeTab === 'pdf'" class="panel-section latex-section">
      <h3>LaTeX 构建</h3>
      <p class="hint">支持 .tex、.bib、.cls/.sty 和图片资源。建议安装 latexmk；未安装时会自动回退到 pdflatex 构建流程。快捷键：构建 <kbd>Ctrl/Cmd+B</kbd>，清理辅助文件 <kbd>Ctrl/Cmd+Alt+K</kbd>。</p>
      <div class="button-row wrap">
        <button :disabled="props.latexBusy || !props.latexActive" @click="emit('buildLatex')">{{ props.latexBusy ? '构建中…' : '构建 PDF' }}</button>
        <button class="ghost" :disabled="props.latexBusy || !props.latexActive" title="快捷键 Ctrl/Cmd+Alt+K" @click="emit('cleanLatex')">清理辅助文件</button>
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
