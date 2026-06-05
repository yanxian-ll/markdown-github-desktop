import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { sampleLatex, sampleMarkdown } from '../services/markdown';
import { makeId } from '../services/hash';
import {
  buildLatex as buildLatexFile,
  cleanLatex as cleanLatexFiles,
  cloneOrUpdateRepository,
  commitAndPush,
  createWorkspaceFile,
  createWorkspaceFolder,
  deleteSecret,
  deleteWorkspaceItem,
  getSecret,
  gitStatus,
  listWorkspaceFiles,
  loadAppState,
  readWorkspaceFile,
  readWorkspaceDataUrl,
  readWorkspaceAnnotations,
  readFileDataUrl,
  findLatexPdf,
  renameWorkspaceItem,
  saveAppState,
  setSecret,
  synctexForward,
  synctexReverse,
  writeWorkspaceAnnotations,
  writeWorkspaceFile,
} from '../services/tauriBridge';
import type {
  DocumentKind,
  FileNode,
  GitStatusEntry,
  GitWorkspace,
  LatexBuildResult,
  MarkdownDocument,
  PaperAnnotation,
  PaperAnnotationRect,
  PaperAnnotationStatus,
  PdfSyncPoint,
  TexSourcePoint,
  PersistedAppState,
} from '../types/app';

const GITHUB_TOKEN_ACCOUNT = 'github-token';
const COMMON_EXTENSIONS = ['md', 'markdown', 'tex', 'txt', 'bib', 'sty', 'cls', 'bst', 'png', 'jpg', 'jpeg', 'svg', 'pdf'];

function kindFromPath(path: string): DocumentKind {
  const ext = path.split('.').pop()?.toLowerCase();
  if (['md', 'markdown', 'mdown', 'mkd'].includes(ext || '')) return 'markdown';
  if (['tex', 'ltx'].includes(ext || '')) return 'latex';
  if (ext === 'bib') return 'bibtex';
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp'].includes(ext || '')) return 'image';
  if (ext === 'pdf') return 'pdf';
  return 'text';
}

function titleFromPath(path: string): string {
  return path.split(/[\\/]/).pop() || path || 'Untitled.md';
}

function normalizePath(path: string): string {
  return path.trim().replace(/\\/g, '/').replace(/^\/+/, '').replace(/\/+$/, '');
}

function normalizeWorkspace(workspace: GitWorkspace): GitWorkspace {
  return {
    owner: workspace.owner.trim(),
    repo: workspace.repo.trim().replace(/^.*\//, '').replace(/\.git$/, ''),
    branch: workspace.branch.trim() || 'main',
    localDir: workspace.localDir.trim(),
    rootPath: normalizePath(workspace.rootPath || ''),
  };
}

function defaultDocument(): MarkdownDocument {
  return {
    id: makeId(),
    title: 'Welcome.md',
    text: sampleMarkdown,
    source: 'scratch',
    kind: 'markdown',
    dirty: false,
    lastSavedText: sampleMarkdown,
    updatedAt: Date.now(),
  };
}

function emptyState(): PersistedAppState {
  const doc = defaultDocument();
  return {
    documents: [doc],
    activeDocumentId: doc.id,
    fileTree: [],
    gitStatus: [],
    editor: {
      darkMode: true,
      vimMode: false,
      previewVisible: true,
      explorerVisible: true,
      gitPanelVisible: true,
      pdfPanelVisible: true,
      pdfRenderQuality: 0.72,
    },
  };
}

function textTemplateForPath(path: string): string {
  const kind = kindFromPath(path);
  const name = titleFromPath(path);
  if (kind === 'latex') return sampleLatex;
  if (kind === 'bibtex') {
    return `@article{example2026,\n  title   = {Example BibTeX Entry},\n  author  = {Doe, Jane},\n  journal = {Journal of Examples},\n  year    = {2026}\n}\n`;
  }
  if (kind === 'markdown') return `# ${name.replace(/\.(md|markdown|mdown|mkd)$/i, '')}\n\n开始写作。\n`;
  if (kind === 'pdf') return 'PDF 文件可从预览区打开。';
  if (kind === 'image') return '';
  return '';
}


function findNodeByPath(nodes: FileNode[], path?: string): FileNode | undefined {
  if (!path) return undefined;
  for (const node of nodes) {
    if (node.path === path) return node;
    const child = findNodeByPath(node.children, path);
    if (child) return child;
  }
  return undefined;
}

function parentPathOf(path: string): string {
  const normalized = normalizePath(path);
  const index = normalized.lastIndexOf('/');
  return index === -1 ? '' : normalized.slice(0, index);
}

function joinDisplayPath(base: string, child: string): string {
  const normalizedBase = normalizePath(base);
  const normalizedChild = child.trim().replace(/\\/g, '/').replace(/^\/+/, '');
  return normalizedBase ? `${normalizedBase}/${normalizedChild}` : normalizedChild;
}

function targetDirectoryFromNode(node?: FileNode): string {
  if (!node) return '';
  if (node.kind === 'folder') return normalizePath(node.path);
  return parentPathOf(node.path);
}


function nowIso() {
  return new Date().toISOString();
}

function normalizeAnnotationRect(rect: PaperAnnotationRect): PaperAnnotationRect {
  const x = Math.min(1, Math.max(0, rect.x));
  const y = Math.min(1, Math.max(0, rect.y));
  const width = Math.min(1 - x, Math.max(0, rect.width));
  const height = Math.min(1 - y, Math.max(0, rect.height));
  return { x, y, width, height };
}

function parseAnnotationsJsonl(content: string): PaperAnnotation[] {
  return content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .flatMap((line) => {
      try {
        const item = JSON.parse(line) as PaperAnnotation;
        if (!item.id || !item.createdAt || !item.updatedAt) return [];
        return [{
          ...item,
          status: item.status || 'open',
          tags: Array.isArray(item.tags) ? item.tags : [],
        }];
      } catch {
        return [];
      }
    });
}

function serializeAnnotationsJsonl(items: PaperAnnotation[]): string {
  return items
    .slice()
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .map((item) => JSON.stringify(item))
    .join('\n') + (items.length ? '\n' : '');
}

function supportedPathOrDefault(rawPath: string): string {
  const wantsFolder = /[\\/]$/.test(rawPath.trim());
  const normalized = normalizePath(rawPath);
  if (!normalized) return 'Untitled.md';
  if (wantsFolder) return `${normalized}/`;
  const name = titleFromPath(normalized);
  const hasExt = /\.[^/.]+$/.test(name);
  if (!hasExt) return `${normalized}.md`;
  const ext = name.split('.').pop()?.toLowerCase() || '';
  if (!COMMON_EXTENSIONS.includes(ext)) {
    const ok = window.confirm(`扩展名 .${ext} 不在常用列表中，仍然创建吗？\n常用：${COMMON_EXTENSIONS.map((item) => `.${item}`).join('、')}`);
    if (!ok) throw new Error('已取消创建文件。');
  }
  return normalized;
}

export const useAppStore = defineStore('app', () => {
  const documents = ref<MarkdownDocument[]>([]);
  const activeDocumentId = ref<string>();
  const fileTree = ref<FileNode[]>([]);
  const selectedNodePath = ref<string>();
  const workspace = ref<GitWorkspace>();
  const gitEntries = ref<GitStatusEntry[]>([]);
  const githubToken = ref<string | null>(null);
  const githubUserHint = ref<string>('');
  const darkMode = ref(true);
  const previewVisible = ref(true);
  const explorerVisible = ref(true);
  const gitPanelVisible = ref(true);
  const busy = ref(false);
  const runningTasks = ref<Record<string, boolean>>({});
  const status = ref('准备就绪');
  const error = ref<string>('');
  const latexResult = ref<LatexBuildResult | null>(null);
  const pdfPreviewUrl = ref<string>('');
  const pdfPreviewPath = ref<string>('');
  const pdfSyncPoint = ref<PdfSyncPoint | null>(null);
  const pdfRenderQuality = ref(0.72);
  const editorGotoLine = ref<number | null>(null);
  const annotations = ref<PaperAnnotation[]>([]);
  const activeAnnotationId = ref<string>();

  let openRequestId = 0;
  let pdfPreviewRequestId = 0;

  function nextOpenRequest() {
    openRequestId += 1;
    return openRequestId;
  }

  function isLatestOpenRequest(requestId?: number) {
    return requestId == null || requestId === openRequestId;
  }

  function nextPdfPreviewRequest() {
    pdfPreviewRequestId += 1;
    return pdfPreviewRequestId;
  }

  const activeDocument = computed(() => documents.value.find((doc) => doc.id === activeDocumentId.value));
  const selectedNode = computed(() => findNodeByPath(fileTree.value, selectedNodePath.value));
  const dirtyCount = computed(() => documents.value.filter((doc) => doc.dirty).length);
  const hasWorkspace = computed(() => !!workspace.value?.localDir);
  const isLatexActive = computed(() => activeDocument.value?.kind === 'latex');
  const isMarkdownActive = computed(() => activeDocument.value?.kind === 'markdown');
  const gitDirtyCount = computed(() => gitEntries.value.length);
  const latexBusy = computed(() => !!runningTasks.value['latex-build']);
  const gitBusy = computed(() => !!runningTasks.value['git-submit'] || !!runningTasks.value['git-clone']);
  const workspaceBusy = computed(() => !!runningTasks.value['workspace-refresh'] || !!runningTasks.value['git-clone']);

  const visibleAnnotations = computed(() => {
    const doc = activeDocument.value;
    const activeRelativePath = doc?.relativePath;
    const activePdf = pdfPreviewPath.value;
    return annotations.value.filter((item) => {
      if (activeRelativePath && item.documentPath === activeRelativePath) return true;
      if (activePdf && item.pdfAnchor?.pdfPath === activePdf) return true;
      if (activeRelativePath && item.texAnchor?.file === activeRelativePath) return true;
      return false;
    });
  });
  const visiblePdfAnnotations = computed(() => visibleAnnotations.value.filter((item) => item.pdfAnchor));
  const visibleSourceAnnotations = computed(() => {
    const relativePath = activeDocument.value?.relativePath;
    if (!relativePath) return [];
    return annotations.value.filter((item) => item.texAnchor?.file === relativePath);
  });


  async function runExclusive<T>(key: string, label: string, action: () => Promise<T>): Promise<T | undefined> {
    if (runningTasks.value[key]) {
      status.value = `${label}正在进行，请稍候。`;
      return undefined;
    }
    runningTasks.value = { ...runningTasks.value, [key]: true };
    // 先让 Vue 完成一帧界面更新，再启动可能较慢的后端任务，避免按钮连点和 UI 假死。
    await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
    try {
      return await action();
    } finally {
      const next = { ...runningTasks.value };
      delete next[key];
      runningTasks.value = next;
    }
  }

  function snapshot(): PersistedAppState {
    // 只持久化轻量状态。工作区文件、图片和 PDF 都能从磁盘重新打开，
    // 不能把它们的全文/base64 data URL 写入 appState，否则 PDF 或图片一旦打开，
    // 之后编辑普通 txt/Markdown 也会因为序列化巨大 JSON 而卡顿。
    const scratchDocuments = documents.value
      .filter((doc) => doc.source === 'scratch' && doc.kind !== 'image' && doc.kind !== 'pdf')
      .map((doc) => ({ ...doc }));
    const activeId = scratchDocuments.some((doc) => doc.id === activeDocumentId.value)
      ? activeDocumentId.value
      : scratchDocuments[0]?.id;

    return {
      documents: scratchDocuments,
      activeDocumentId: activeId,
      fileTree: [],
      workspace: workspace.value,
      gitStatus: [],
      editor: {
        darkMode: darkMode.value,
        vimMode: false,
        previewVisible: previewVisible.value,
        explorerVisible: explorerVisible.value,
        gitPanelVisible: gitPanelVisible.value,
        pdfPanelVisible: true,
        pdfRenderQuality: pdfRenderQuality.value,
      },
    };
  }

  async function persist() {
    await saveAppState(snapshot());
  }


  async function loadAnnotations() {
    if (!workspace.value?.localDir) {
      annotations.value = [];
      activeAnnotationId.value = undefined;
      return;
    }
    const content = await readWorkspaceAnnotations(workspace.value.localDir);
    annotations.value = parseAnnotationsJsonl(content);
  }

  async function saveAnnotations() {
    if (!workspace.value?.localDir) return;
    await writeWorkspaceAnnotations(workspace.value.localDir, serializeAnnotationsJsonl(annotations.value));
    await refreshGitStatus();
  }

  function upsertAnnotation(item: PaperAnnotation) {
    const index = annotations.value.findIndex((annotation) => annotation.id === item.id);
    if (index >= 0) {
      annotations.value.splice(index, 1, item);
    } else {
      annotations.value.unshift(item);
    }
    activeAnnotationId.value = item.id;
  }

  async function initialize() {
    busy.value = true;
    error.value = '';
    try {
      const saved = await loadAppState();
      const initial = { ...emptyState(), ...saved } as PersistedAppState;
      const lightweightDocuments = (initial.documents ?? [])
        .filter((doc) => doc.source === 'scratch' && doc.kind !== 'image' && doc.kind !== 'pdf');
      documents.value = lightweightDocuments.length ? lightweightDocuments : [defaultDocument()];
      activeDocumentId.value = documents.value.some((doc) => doc.id === initial.activeDocumentId)
        ? initial.activeDocumentId
        : documents.value[0]?.id;
      fileTree.value = [];
      workspace.value = initial.workspace;
      gitEntries.value = [];
      darkMode.value = initial.editor?.darkMode ?? true;
      previewVisible.value = initial.editor?.previewVisible ?? true;
      explorerVisible.value = initial.editor?.explorerVisible ?? true;
      gitPanelVisible.value = initial.editor?.gitPanelVisible ?? true;
      pdfRenderQuality.value = Math.min(1.25, Math.max(0.45, initial.editor?.pdfRenderQuality ?? 0.72));
      githubToken.value = await getSecret(GITHUB_TOKEN_ACCOUNT);
      githubUserHint.value = githubToken.value ? '已保存 token' : '';
      if (workspace.value?.localDir) {
        await loadAnnotations();
        await refreshWorkspace();
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : String(err);
      const fallback = emptyState();
      documents.value = fallback.documents;
      activeDocumentId.value = fallback.activeDocumentId;
      fileTree.value = [];
    } finally {
      busy.value = false;
    }
  }

  async function setGithubToken(token: string) {
    const trimmed = token.trim();
    if (!trimmed) throw new Error('GitHub token 不能为空。');
    await setSecret(GITHUB_TOKEN_ACCOUNT, trimmed);
    githubToken.value = trimmed;
    githubUserHint.value = '已保存 token';
    status.value = 'GitHub token 已保存到系统凭据。';
  }

  async function forgetGithubToken() {
    await deleteSecret(GITHUB_TOKEN_ACCOUNT);
    githubToken.value = null;
    githubUserHint.value = '';
    status.value = '已移除 GitHub token。';
  }

  async function cloneWorkspace(nextWorkspace: GitWorkspace) {
    return runExclusive('git-clone', 'clone / 更新', async () => {
      if (!githubToken.value) throw new Error('请先粘贴 GitHub Token 并点击“保存凭据”。');
      busy.value = true;
      error.value = '';
      try {
        const normalized = normalizeWorkspace(nextWorkspace);
        status.value = '正在后台 clone / 更新仓库，界面仍可继续操作…';
        const output = await cloneOrUpdateRepository(normalized, githubToken.value);
        workspace.value = normalized;
        status.value = output.trim() || 'Git 仓库已准备好，左侧目录树已刷新。';
        await loadAnnotations();
        await refreshWorkspace();
        await persist();
      } catch (err) {
        error.value = err instanceof Error ? err.message : String(err);
        throw err;
      } finally {
        busy.value = false;
      }
    });
  }

  async function refreshWorkspace() {
    if (!workspace.value?.localDir) return;
    return runExclusive('workspace-refresh', '刷新工作区', async () => {
      await loadAnnotations();
      fileTree.value = await listWorkspaceFiles(workspace.value!.localDir, workspace.value!.rootPath || '');
      if (selectedNodePath.value && !findNodeByPath(fileTree.value, selectedNodePath.value)) selectedNodePath.value = undefined;
      await refreshGitStatus();
      await persist();
    });
  }

  async function refreshGitStatus() {
    if (!workspace.value?.localDir) return;
    try {
      gitEntries.value = await gitStatus(workspace.value.localDir);
    } catch (err) {
      gitEntries.value = [];
      error.value = err instanceof Error ? err.message : String(err);
    }
  }

  function setActiveDocument(id: string) {
    activeDocumentId.value = id;
    persist().catch(() => undefined);
  }

  function updateActiveText(text: string) {
    const doc = activeDocument.value;
    if (!doc || doc.text === text) return;
    doc.text = text;
    doc.updatedAt = Date.now();
    // 不再每个按键对全文做 hash。大文件中 hash 是明显的 O(n) 主线程开销。
    // 简化为“编辑后置脏”，保存时再清除。
    if (!doc.dirty) doc.dirty = true;
  }

  function makeRelativePath(path: string): string {
    const root = workspace.value?.rootPath ? normalizePath(workspace.value.rootPath) : '';
    const normalized = normalizePath(path);
    return root ? `${root}/${normalized}` : normalized;
  }

  function displayPathFromRelative(relativePath?: string): string | undefined {
    if (!relativePath) return undefined;
    const root = workspace.value?.rootPath ? normalizePath(workspace.value.rootPath) : '';
    if (root && relativePath.startsWith(`${root}/`)) return relativePath.slice(root.length + 1);
    return relativePath;
  }

  async function previewExistingPdfForTex(relativePath: string, expectedDocumentId?: string, expectedOpenRequestId?: number) {
    if (!workspace.value?.localDir || !isLatestOpenRequest(expectedOpenRequestId)) return;
    try {
      const pdfPath = await findLatexPdf(workspace.value.localDir, relativePath);
      if (!isLatestOpenRequest(expectedOpenRequestId) || (expectedDocumentId && activeDocumentId.value !== expectedDocumentId)) return;
      if (!pdfPath) {
        pdfPreviewUrl.value = '';
        pdfPreviewPath.value = '';
        pdfSyncPoint.value = null;
        status.value = `已打开：${relativePath}。未找到同名 PDF，按 Ctrl/Cmd+B 构建。`;
        return;
      }
      await loadPdfPreview(pdfPath, false, expectedOpenRequestId);
      if (!isLatestOpenRequest(expectedOpenRequestId) || (expectedDocumentId && activeDocumentId.value !== expectedDocumentId)) return;
      status.value = `已打开：${relativePath}，右侧显示已有 PDF。`;
    } catch (err) {
      if (!isLatestOpenRequest(expectedOpenRequestId) || (expectedDocumentId && activeDocumentId.value !== expectedDocumentId)) return;
      pdfPreviewUrl.value = '';
      pdfPreviewPath.value = '';
      error.value = err instanceof Error ? err.message : String(err);
    }
  }

  async function openWorkspaceFile(node: FileNode) {
    const requestId = nextOpenRequest();
    selectedNodePath.value = node.path;
    if (node.kind !== 'file') return;
    if (!workspace.value?.localDir) throw new Error('请先设置本地工作区。');

    busy.value = true;
    error.value = '';
    status.value = `正在打开：${node.path}`;

    try {
      const relativePath = makeRelativePath(node.path);
      const absolutePath = `${workspace.value.localDir.replace(/[\\/]$/, '')}/${relativePath}`;

      if (node.documentKind === 'pdf') {
        const text = await readFileDataUrl(absolutePath);
        if (!isLatestOpenRequest(requestId)) return;

        const existing = documents.value.find((doc) => doc.relativePath === relativePath && doc.source === 'workspace');
        if (existing) {
          existing.text = text;
          existing.lastSavedText = text;
          existing.dirty = false;
          existing.updatedAt = Date.now();
          existing.kind = 'pdf';
          existing.absolutePath = absolutePath;
          activeDocumentId.value = existing.id;
        } else {
          const doc: MarkdownDocument = {
            id: makeId('file'),
            title: titleFromPath(node.path),
            text,
            source: 'workspace',
            kind: 'pdf',
            relativePath,
            absolutePath,
            dirty: false,
            lastSavedText: text,
            updatedAt: Date.now(),
          };
          documents.value.unshift(doc);
          activeDocumentId.value = doc.id;
        }
        if (!isLatestOpenRequest(requestId)) return;
        pdfPreviewUrl.value = text;
        pdfPreviewPath.value = absolutePath;
        pdfSyncPoint.value = null;
        status.value = `已预览 PDF：${relativePath}`;
        await persist();
        return;
      }

      const text = node.documentKind === 'image'
        ? await readWorkspaceDataUrl(workspace.value.localDir, relativePath, node.name)
        : await readWorkspaceFile(workspace.value.localDir, relativePath);
      if (!isLatestOpenRequest(requestId)) return;

      const existing = documents.value.find((doc) => doc.relativePath === relativePath && doc.source === 'workspace');
      if (existing) {
        existing.text = text;
        existing.lastSavedText = text;
        existing.dirty = false;
        existing.updatedAt = Date.now();
        existing.kind = node.documentKind;
        existing.absolutePath = absolutePath;
        activeDocumentId.value = existing.id;
      } else {
        const doc: MarkdownDocument = {
          id: makeId('file'),
          title: titleFromPath(node.path),
          text,
          source: 'workspace',
          kind: node.documentKind,
          relativePath,
          absolutePath,
          dirty: false,
          lastSavedText: text,
          updatedAt: Date.now(),
        };
        documents.value.unshift(doc);
        activeDocumentId.value = doc.id;
      }

      latexResult.value = null;
      pdfSyncPoint.value = null;
      if (node.documentKind === 'latex') {
        pdfPreviewUrl.value = '';
        pdfPreviewPath.value = '';
        status.value = `已打开：${relativePath}，正在查找已有 PDF…`;
        const expected = activeDocumentId.value;
        void previewExistingPdfForTex(relativePath, expected, requestId);
      } else {
        pdfPreviewUrl.value = '';
        pdfPreviewPath.value = '';
        status.value = node.documentKind === 'image' ? `已预览图片：${relativePath}` : `已打开：${relativePath}`;
      }
      await persist();
    } catch (err) {
      if (!isLatestOpenRequest(requestId)) return;
      error.value = err instanceof Error ? err.message : String(err);
      throw err;
    } finally {
      if (isLatestOpenRequest(requestId)) busy.value = false;
    }
  }

  async function saveActiveLocal() {
    const doc = activeDocument.value;
    if (!doc) return;
    if (doc.kind === 'image' || doc.kind === 'pdf') throw new Error('图片/PDF 不能在文本编辑器中保存。');
    if (!workspace.value?.localDir) throw new Error('请先 clone 或打开一个本地工作区。');
    if (!doc.relativePath) {
      const defaultName = doc.kind === 'latex' ? 'Untitled.tex' : doc.kind === 'text' ? 'Untitled.txt' : 'Untitled.md';
      const target = window.prompt('输入工作区内的相对路径，例如 notes/new.md、paper/main.tex、draft.txt', defaultName);
      if (!target) return;
      doc.relativePath = makeRelativePath(supportedPathOrDefault(target));
      doc.title = titleFromPath(target);
      doc.source = 'workspace';
      doc.kind = kindFromPath(doc.relativePath);
    }
    await writeWorkspaceFile(workspace.value.localDir, doc.relativePath, doc.text);
    doc.lastSavedText = doc.text;
    doc.dirty = false;
    doc.updatedAt = Date.now();
    status.value = `已保存本地：${doc.relativePath}`;
    await refreshWorkspace();
    await persist();
  }

  async function newScratchDocument(kind: DocumentKind = 'markdown') {
    const extension = kind === 'latex' ? 'tex' : kind === 'bibtex' ? 'bib' : kind === 'text' ? 'txt' : 'md';
    const title = `Untitled-${documents.value.length + 1}.${extension}`;
    const text = textTemplateForPath(title);
    const doc: MarkdownDocument = {
      id: makeId('scratch'),
      title,
      text,
      source: 'scratch',
      kind,
      dirty: true,
      lastSavedText: '',
      updatedAt: Date.now(),
    };
    documents.value.unshift(doc);
    activeDocumentId.value = doc.id;
    await persist();
  }

  function selectNode(node?: FileNode) {
    selectedNodePath.value = node?.path;
  }

  async function createItemFromPrompt(parent?: FileNode) {
    if (!workspace.value?.localDir) throw new Error('请先 clone 或打开一个本地工作区。');
    const contextNode = parent ?? selectedNode.value;
    const base = targetDirectoryFromNode(contextNode);
    const defaultPath = joinDisplayPath(base, 'Untitled.md');
    const raw = window.prompt(
      base
        ? `在 ${base} 下新建。输入文件名或相对路径；文件夹以 / 结尾。`
        : '在根目录下新建。输入文件名或相对路径；文件夹以 / 结尾。',
      defaultPath,
    );
    if (!raw) return;
    const typedAsAbsoluteFromRoot = normalizePath(raw).startsWith(`${base}/`);
    const candidate = base && !typedAsAbsoluteFromRoot ? joinDisplayPath(base, raw) : raw;
    const displayPath = supportedPathOrDefault(candidate);
    if (displayPath.endsWith('/')) {
      await createWorkspaceFolder(workspace.value.localDir, makeRelativePath(displayPath));
      status.value = `已创建文件夹：${displayPath}`;
      await refreshWorkspace();
      selectedNodePath.value = normalizePath(displayPath);
      await persist();
      return;
    }
    const relativePath = makeRelativePath(displayPath);
    await createWorkspaceFile(workspace.value.localDir, relativePath, textTemplateForPath(displayPath));
    status.value = `已创建文件：${relativePath}`;
    await refreshWorkspace();
    const node: FileNode = {
      name: titleFromPath(displayPath),
      path: displayPath,
      kind: 'file',
      documentKind: kindFromPath(displayPath),
      children: [],
    };
    selectedNodePath.value = displayPath;
    await openWorkspaceFile(node);
  }

  async function renameItem(node?: FileNode) {
    if (!workspace.value?.localDir) throw new Error('请先 clone 或打开一个本地工作区。');
    const doc = activeDocument.value;
    const oldDisplayPath = node?.path || displayPathFromRelative(doc?.relativePath);
    if (!oldDisplayPath) return;
    const next = window.prompt('输入新的相对路径', oldDisplayPath);
    if (!next || next === oldDisplayPath) return;
    const oldRelativePath = makeRelativePath(oldDisplayPath);
    const newDisplayPath = node?.kind === 'folder' ? normalizePath(next) : supportedPathOrDefault(next);
    const newRelativePath = makeRelativePath(newDisplayPath);
    await renameWorkspaceItem(workspace.value.localDir, oldRelativePath, newRelativePath);
    documents.value.forEach((item) => {
      if (item.relativePath === oldRelativePath) {
        item.relativePath = newRelativePath;
        item.title = titleFromPath(newRelativePath);
        item.kind = kindFromPath(newRelativePath);
      } else if (node?.kind === 'folder' && item.relativePath?.startsWith(`${oldRelativePath}/`)) {
        item.relativePath = `${newRelativePath}/${item.relativePath.slice(oldRelativePath.length + 1)}`;
      }
    });
    status.value = `已重命名：${oldRelativePath} → ${newRelativePath}`;
    await refreshWorkspace();
    await persist();
  }

  async function moveItemToTarget(source: FileNode, target?: FileNode) {
    if (!workspace.value?.localDir) throw new Error('请先 clone 或打开一个本地工作区。');
    const targetDir = targetDirectoryFromNode(target);
    if (source.kind === 'folder') {
      const sourcePath = normalizePath(source.path);
      if (targetDir === sourcePath || targetDir.startsWith(`${sourcePath}/`)) {
        throw new Error('不能把文件夹移动到它自己或它的子目录中。');
      }
    }
    const newDisplayPath = joinDisplayPath(targetDir, source.name);
    if (normalizePath(newDisplayPath) === normalizePath(source.path)) return;
    const oldRelativePath = makeRelativePath(source.path);
    const newRelativePath = makeRelativePath(newDisplayPath);
    await renameWorkspaceItem(workspace.value.localDir, oldRelativePath, newRelativePath);
    documents.value.forEach((item) => {
      if (item.relativePath === oldRelativePath) {
        item.relativePath = newRelativePath;
        item.title = titleFromPath(newRelativePath);
        item.kind = kindFromPath(newRelativePath);
      } else if (source.kind === 'folder' && item.relativePath?.startsWith(`${oldRelativePath}/`)) {
        item.relativePath = `${newRelativePath}/${item.relativePath.slice(oldRelativePath.length + 1)}`;
      }
    });
    selectedNodePath.value = normalizePath(newDisplayPath);
    status.value = `已移动：${oldRelativePath} → ${newRelativePath}`;
    await refreshWorkspace();
    await persist();
  }


  async function removeItem(node: FileNode) {
    if (!workspace.value?.localDir) throw new Error('请先 clone 或打开一个本地工作区。');
    const relativePath = makeRelativePath(node.path);
    const ok = window.confirm(`确定删除 ${node.kind === 'folder' ? '文件夹' : '文件'}？\n${relativePath}`);
    if (!ok) return;
    await deleteWorkspaceItem(workspace.value.localDir, relativePath);
    documents.value = documents.value.filter((doc) => {
      if (!doc.relativePath) return true;
      if (node.kind === 'file') return doc.relativePath !== relativePath;
      return !doc.relativePath.startsWith(`${relativePath}/`);
    });
    if (!documents.value.length) documents.value.push(defaultDocument());
    if (!documents.value.find((doc) => doc.id === activeDocumentId.value)) {
      activeDocumentId.value = documents.value[0]?.id;
    }
    if (selectedNodePath.value === node.path || (node.kind === 'folder' && selectedNodePath.value?.startsWith(`${node.path}/`))) {
      selectedNodePath.value = undefined;
    }
    status.value = `已删除：${relativePath}`;
    await refreshWorkspace();
    await persist();
  }

  async function submitGithub(message?: string) {
    return runExclusive('git-submit', '提交', async () => {
      if (!workspace.value?.localDir) throw new Error('请先 clone 或打开一个本地工作区。');
      if (!githubToken.value) throw new Error('请先粘贴 GitHub Token 并点击“保存凭据”。');
      const defaultMessage = message || window.prompt('Git commit message', 'docs: update notes') || 'docs: update notes';
      busy.value = true;
      error.value = '';
      try {
        status.value = '正在后台提交并 push，界面仍可继续操作…';
        const output = await commitAndPush(workspace.value.localDir, workspace.value.branch, defaultMessage, githubToken.value);
        status.value = output.trim() || '已提交并 push 到 GitHub。';
        await refreshWorkspace();
        documents.value.forEach((doc) => {
          if (doc.source === 'workspace' && !doc.dirty) doc.lastSavedText = doc.text;
        });
        await persist();
      } catch (err) {
        error.value = err instanceof Error ? err.message : String(err);
        throw err;
      } finally {
        busy.value = false;
      }
    });
  }

  async function loadPdfPreview(path?: string | null, force = false, expectedOpenRequestId?: number) {
    if (!path || !isLatestOpenRequest(expectedOpenRequestId)) return;
    if (!force && pdfPreviewPath.value === path && pdfPreviewUrl.value) return;
    const requestId = nextPdfPreviewRequest();
    const dataUrl = await readFileDataUrl(path);
    if (requestId !== pdfPreviewRequestId || !isLatestOpenRequest(expectedOpenRequestId)) return;
    pdfPreviewUrl.value = dataUrl;
    pdfPreviewPath.value = path;
    pdfSyncPoint.value = null;
  }

  async function buildLatex() {
    return runExclusive('latex-build', 'LaTeX 构建', async () => {
      const doc = activeDocument.value;
      if (!doc || doc.kind !== 'latex' || !doc.relativePath || !workspace.value?.localDir) {
        throw new Error('当前文件不是工作区内的 .tex 文件。');
      }
      await saveActiveLocal();
      error.value = '';
      try {
        const buildForDocumentId = doc.id;
        status.value = 'LaTeX 正在后台构建 PDF，设置/隐藏/切换文件等界面操作不会被锁住…';
        const result = await buildLatexFile(workspace.value.localDir, doc.relativePath);
        if (activeDocumentId.value !== buildForDocumentId) {
          latexResult.value = result;
          status.value = `LaTeX 构建完成，但当前已切换到其他文件。`;
          return;
        }
        latexResult.value = result;
        status.value = result.ok ? `LaTeX 构建成功：${result.pdfPath}` : 'LaTeX 构建失败，请查看日志。';
        if (result.ok && result.pdfPath) {
          await loadPdfPreview(result.pdfPath, true);
        }
      } catch (err) {
        error.value = err instanceof Error ? err.message : String(err);
        throw err;
      }
    });
  }

  async function cleanLatex() {
    const doc = activeDocument.value;
    if (!doc || doc.kind !== 'latex' || !doc.relativePath || !workspace.value?.localDir) {
      throw new Error('当前文件不是工作区内的 .tex 文件。');
    }
    status.value = await cleanLatexFiles(workspace.value.localDir, doc.relativePath);
    await refreshWorkspace();
  }

  async function openCurrentPdf() {
    const doc = activeDocument.value;
    if (!doc?.relativePath || !workspace.value?.localDir) return;
    const pdf = latexResult.value?.pdfPath || `${workspace.value.localDir.replace(/[\\/]$/, '')}/${doc.relativePath.replace(/\.[^.]+$/, '.pdf')}`;
    await loadPdfPreview(pdf);
    status.value = `已在右侧预览 PDF：${pdf}`;
  }

  function relativeFromAbsolute(input: string): string | undefined {
    if (!workspace.value?.localDir) return undefined;
    const root = workspace.value.localDir.replace(/\\/g, '/').replace(/\/+$/, '');
    const normalized = input.replace(/\\/g, '/');
    if (normalized.startsWith(`${root}/`)) return normalized.slice(root.length + 1);
    return undefined;
  }

  async function openWorkspacePathAtLine(relativePath: string, line: number) {
    if (!workspace.value?.localDir) throw new Error('请先 clone 或打开一个本地工作区。');
    const displayPath = displayPathFromRelative(relativePath) || relativePath;
    const absolutePath = `${workspace.value.localDir.replace(/[\\/]$/, '')}/${relativePath}`;
    const text = await readWorkspaceFile(workspace.value.localDir, relativePath);

    // 反向 SyncTeX 只应该切换/定位源码，不能走 openWorkspaceFile 的完整打开流程，
    // 否则会清空并重新加载当前 PDF，造成“PDF 自动关闭又重新渲染”的闪烁和卡顿。
    let doc = documents.value.find((item) => item.relativePath === relativePath && item.source === 'workspace');
    if (doc) {
      doc.text = text;
      doc.lastSavedText = text;
      doc.dirty = false;
      doc.updatedAt = Date.now();
      doc.kind = kindFromPath(relativePath);
      doc.absolutePath = absolutePath;
    } else {
      doc = {
        id: makeId('file'),
        title: titleFromPath(displayPath),
        text,
        source: 'workspace',
        kind: kindFromPath(relativePath),
        relativePath,
        absolutePath,
        dirty: false,
        lastSavedText: text,
        updatedAt: Date.now(),
      };
      documents.value.unshift(doc);
    }
    selectedNodePath.value = displayPath;
    activeDocumentId.value = doc.id;
    editorGotoLine.value = Math.max(1, line);
    status.value = `已反向定位到 ${relativePath}:${line}`;
    await persist();
  }

  async function syncTexForwardFromEditor(line: number, column = 1) {
    const doc = activeDocument.value;
    if (!doc || doc.kind !== 'latex' || !doc.relativePath || !workspace.value?.localDir) return;
    if (!pdfPreviewPath.value) {
      await previewExistingPdfForTex(doc.relativePath, doc.id);
    }
    if (!pdfPreviewPath.value) {
      throw new Error('未找到可用于 SyncTeX 的 PDF。请先按 Ctrl/Cmd+B 构建当前 TeX。');
    }
    const point = await synctexForward(workspace.value.localDir, doc.relativePath, line, column);
    pdfSyncPoint.value = point;
    if (point.pdfPath && point.pdfPath !== pdfPreviewPath.value) {
      await loadPdfPreview(point.pdfPath);
      pdfSyncPoint.value = point;
    }
    status.value = `SyncTeX 正向定位：第 ${point.page} 页`;
  }

  async function syncTexReverseFromPdf(page: number, x: number, y: number) {
    if (!workspace.value?.localDir || !pdfPreviewPath.value) return;
    const source: TexSourcePoint = await synctexReverse(workspace.value.localDir, pdfPreviewPath.value, page, x, y);
    const relativePath = source.relativePath || relativeFromAbsolute(source.input);
    if (!relativePath) throw new Error(`SyncTeX 返回的源文件不在当前工作区：${source.input}`);
    await openWorkspacePathAtLine(relativePath, source.line);
  }



  async function createPdfAnnotation(payload: { page: number; rect: PaperAnnotationRect; body: string; x: number; y: number }) {
    const doc = activeDocument.value;
    if (!workspace.value?.localDir || !pdfPreviewPath.value) throw new Error('需要先打开工作区 PDF。');
    const timestamp = nowIso();
    const annotation: PaperAnnotation = {
      id: makeId('ann'),
      type: 'area',
      status: 'open',
      body: payload.body,
      tags: [],
      documentPath: doc?.relativePath,
      pdfAnchor: {
        pdfPath: pdfPreviewPath.value,
        page: payload.page,
        rects: [normalizeAnnotationRect(payload.rect)],
      },
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    try {
      const source = await synctexReverse(workspace.value.localDir, pdfPreviewPath.value, payload.page, payload.x, payload.y);
      const relativePath = source.relativePath || relativeFromAbsolute(source.input);
      if (relativePath) {
        annotation.texAnchor = {
          file: relativePath,
          line: source.line,
          column: source.column,
        };
        annotation.documentPath = annotation.documentPath || relativePath;
      }
    } catch {
      // 区域批注仍然保存，SyncTeX 不可用时只缺少源码锚点。
    }

    upsertAnnotation(annotation);
    await saveAnnotations();
    status.value = annotation.texAnchor
      ? `已创建 PDF 批注，并锚定到 ${annotation.texAnchor.file}:${annotation.texAnchor.line}`
      : '已创建 PDF 批注。未能建立 SyncTeX 源码锚点。';
  }

  async function createSourceAnnotation(line?: number, column = 1) {
    const doc = activeDocument.value;
    if (!workspace.value?.localDir || !doc || doc.kind !== 'latex' || !doc.relativePath) {
      throw new Error('源码批注需要打开工作区内的 .tex 文件。');
    }
    const defaultLine = line || editorGotoLine.value || 1;
    const lineText = doc.text.split(/\r?\n/)[Math.max(0, defaultLine - 1)]?.trim();
    const body = window.prompt(`给 ${doc.relativePath}:${defaultLine} 添加批注`, lineText ? `检查：${lineText.slice(0, 80)}` : '需要修改这里：')?.trim();
    if (!body) return;
    const timestamp = nowIso();
    const annotation: PaperAnnotation = {
      id: makeId('ann'),
      type: 'comment',
      status: 'open',
      body,
      tags: [],
      documentPath: doc.relativePath,
      texAnchor: {
        file: doc.relativePath,
        line: Math.max(1, defaultLine),
        column: Math.max(1, column),
      },
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    upsertAnnotation(annotation);
    await saveAnnotations();
    status.value = `已创建源码批注：${doc.relativePath}:${defaultLine}`;
  }

  async function updateAnnotationStatus(payload: { id: string; status: PaperAnnotationStatus }) {
    const item = annotations.value.find((annotation) => annotation.id === payload.id);
    if (!item) return;
    item.status = payload.status;
    item.updatedAt = nowIso();
    activeAnnotationId.value = item.id;
    await saveAnnotations();
  }

  async function removeAnnotation(id: string) {
    const item = annotations.value.find((annotation) => annotation.id === id);
    if (!item) return;
    const ok = window.confirm('确定删除这条批注吗？删除后无法从 JSONL 中恢复。');
    if (!ok) return;
    annotations.value = annotations.value.filter((annotation) => annotation.id !== id);
    if (activeAnnotationId.value === id) activeAnnotationId.value = undefined;
    await saveAnnotations();
    status.value = '已删除批注。';
  }

  async function focusAnnotation(annotation: PaperAnnotation) {
    activeAnnotationId.value = annotation.id;
    if (annotation.pdfAnchor?.pdfPath) {
      await loadPdfPreview(annotation.pdfAnchor.pdfPath);
      const rect = annotation.pdfAnchor.rects[0];
      if (rect) {
        // x/y 使用归一化中心点仅用于滚动到页，真正渲染位置由 PDF overlay 中的 rect 显示。
        pdfSyncPoint.value = {
          page: annotation.pdfAnchor.page,
          x: 0,
          y: 0,
          pdfPath: annotation.pdfAnchor.pdfPath,
        };
      }
    }
    if (annotation.texAnchor) {
      await openWorkspacePathAtLine(annotation.texAnchor.file, annotation.texAnchor.line);
      try {
        await syncTexForwardFromEditor(annotation.texAnchor.line, annotation.texAnchor.column || 1);
      } catch {
        // 跳源码成功即可；PDF 定位依赖已构建的 SyncTeX。
      }
    }
  }

  async function setPdfRenderQuality(value: number) {
    pdfRenderQuality.value = Math.min(1.25, Math.max(0.45, Number(value) || 0.72));
    status.value = `PDF 预览分辨率：${Math.round(pdfRenderQuality.value * 100)}%`;
    await persist();
  }

  async function closeDocument(id: string) {
    const index = documents.value.findIndex((doc) => doc.id === id);
    if (index < 0) return;
    documents.value.splice(index, 1);
    if (!documents.value.length) documents.value.push(defaultDocument());
    if (activeDocumentId.value === id) {
      activeDocumentId.value = documents.value[Math.max(0, index - 1)]?.id ?? documents.value[0]?.id;
    }
    await persist();
  }

  return {
    documents,
    activeDocumentId,
    activeDocument,
    fileTree,
    selectedNodePath,
    workspace,
    gitEntries,
    gitDirtyCount,
    gitBusy,
    latexBusy,
    workspaceBusy,
    githubToken,
    githubUserHint,
    darkMode,
    previewVisible,
    explorerVisible,
    gitPanelVisible,
    busy,
    status,
    error,
    latexResult,
    pdfPreviewUrl,
    pdfPreviewPath,
    pdfSyncPoint,
    pdfRenderQuality,
    editorGotoLine,
    annotations,
    activeAnnotationId,
    visibleAnnotations,
    visiblePdfAnnotations,
    visibleSourceAnnotations,
    dirtyCount,
    hasWorkspace,
    isLatexActive,
    isMarkdownActive,
    initialize,
    persist,
    setGithubToken,
    forgetGithubToken,
    cloneWorkspace,
    refreshWorkspace,
    refreshGitStatus,
    setActiveDocument,
    selectNode,
    updateActiveText,
    openWorkspaceFile,
    previewExistingPdfForTex,
    saveActiveLocal,
    newScratchDocument,
    createItemFromPrompt,
    renameItem,
    moveItemToTarget,
    removeItem,
    submitGithub,
    buildLatex,
    cleanLatex,
    openCurrentPdf,
    loadPdfPreview,
    setPdfRenderQuality,
    createPdfAnnotation,
    createSourceAnnotation,
    updateAnnotationStatus,
    removeAnnotation,
    focusAnnotation,
    syncTexForwardFromEditor,
    syncTexReverseFromPdf,
    closeDocument,
  };
});
