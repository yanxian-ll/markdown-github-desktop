import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { sampleMarkdown } from '../services/markdown';
import { fastHash, makeId } from '../services/hash';
import {
  deleteSecret,
  getSecret,
  loadAppState,
  readTextFile,
  saveAppState,
  setSecret,
  writeTextFile,
} from '../services/tauriBridge';
import {
  getCurrentUser,
  getMarkdownFile,
  GitHubApiError,
  listMarkdownFiles,
  saveMarkdownFile,
} from '../services/githubClient';
import type { GitHubTreeFile, GitHubWorkspace, MarkdownDocument, PersistedAppState, SaveConflict } from '../types/app';

const GITHUB_TOKEN_ACCOUNT = 'github-token';

function defaultDocument(): MarkdownDocument {
  return {
    id: makeId(),
    title: 'Welcome.md',
    text: sampleMarkdown,
    source: 'scratch',
    dirty: false,
    lastSyncedText: sampleMarkdown,
    updatedAt: Date.now(),
  };
}

function emptyState(): PersistedAppState {
  const doc = defaultDocument();
  return {
    documents: [doc],
    activeDocumentId: doc.id,
    githubTree: [],
    editor: {
      darkMode: true,
      vimMode: false,
      previewVisible: true,
    },
  };
}

function titleFromPath(path: string): string {
  return path.split(/[\\/]/).pop() || path || 'Untitled.md';
}

function normalizeWorkspace(workspace: GitHubWorkspace): GitHubWorkspace {
  return {
    owner: workspace.owner.trim(),
    repo: workspace.repo.trim().replace(/^.*\//, ''),
    branch: workspace.branch.trim() || 'main',
    rootPath: workspace.rootPath.trim().replace(/^\/+/, '').replace(/\/+$/, ''),
  };
}

export const useAppStore = defineStore('app', () => {
  const documents = ref<MarkdownDocument[]>([]);
  const activeDocumentId = ref<string>();
  const githubWorkspace = ref<GitHubWorkspace>();
  const githubTree = ref<GitHubTreeFile[]>([]);
  const darkMode = ref(true);
  const previewVisible = ref(true);
  const githubToken = ref<string | null>(null);
  const githubUser = ref<string>('');
  const busy = ref(false);
  const status = ref('准备就绪');
  const error = ref<string>('');
  const saveConflict = ref<SaveConflict | null>(null);

  const activeDocument = computed(() => documents.value.find((doc) => doc.id === activeDocumentId.value));
  const dirtyCount = computed(() => documents.value.filter((doc) => doc.dirty).length);
  const canSaveToGitHub = computed(() => !!activeDocument.value?.github && !!githubToken.value);

  function snapshot(): PersistedAppState {
    return {
      documents: documents.value,
      activeDocumentId: activeDocumentId.value,
      githubWorkspace: githubWorkspace.value,
      githubTree: githubTree.value,
      editor: {
        darkMode: darkMode.value,
        vimMode: false,
        previewVisible: previewVisible.value,
      },
    };
  }

  async function persist() {
    await saveAppState(snapshot());
  }

  async function initialize() {
    busy.value = true;
    error.value = '';
    try {
      const saved = await loadAppState();
      const initial = { ...emptyState(), ...saved } as PersistedAppState;
      documents.value = initial.documents?.length ? initial.documents : [defaultDocument()];
      activeDocumentId.value = initial.activeDocumentId ?? documents.value[0]?.id;
      githubWorkspace.value = initial.githubWorkspace;
      githubTree.value = initial.githubTree ?? [];
      darkMode.value = initial.editor?.darkMode ?? true;
      previewVisible.value = initial.editor?.previewVisible ?? true;
      githubToken.value = await getSecret(GITHUB_TOKEN_ACCOUNT);
      if (githubToken.value) {
        try {
          const user = await getCurrentUser(githubToken.value);
          githubUser.value = user.login;
          status.value = `已连接 GitHub：${user.login}`;
        } catch {
          githubUser.value = '';
          status.value = '已加载本地状态，GitHub token 需要重新验证';
        }
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : String(err);
      const fallback = emptyState();
      documents.value = fallback.documents;
      activeDocumentId.value = fallback.activeDocumentId;
      githubTree.value = [];
    } finally {
      busy.value = false;
    }
  }

  async function setGithubToken(token: string) {
    const trimmed = token.trim();
    if (!trimmed) throw new Error('GitHub token 不能为空。');
    busy.value = true;
    error.value = '';
    try {
      const user = await getCurrentUser(trimmed);
      await setSecret(GITHUB_TOKEN_ACCOUNT, trimmed);
      githubToken.value = trimmed;
      githubUser.value = user.login;
      status.value = `已连接 GitHub：${user.login}`;
    } catch (err) {
      error.value = err instanceof Error ? err.message : String(err);
      throw err;
    } finally {
      busy.value = false;
    }
  }

  async function forgetGithubToken() {
    await deleteSecret(GITHUB_TOKEN_ACCOUNT);
    githubToken.value = null;
    githubUser.value = '';
    status.value = '已移除 GitHub token';
  }

  async function configureGithubWorkspace(workspace: GitHubWorkspace) {
    if (!githubToken.value) throw new Error('请先保存 GitHub token。');
    busy.value = true;
    error.value = '';
    try {
      const normalized = normalizeWorkspace(workspace);
      githubTree.value = await listMarkdownFiles(githubToken.value, normalized);
      githubWorkspace.value = normalized;
      status.value = `已加载 ${githubTree.value.length} 个 Markdown 文件`;
      await persist();
    } catch (err) {
      error.value = err instanceof Error ? err.message : String(err);
      throw err;
    } finally {
      busy.value = false;
    }
  }

  function setActiveDocument(id: string) {
    activeDocumentId.value = id;
    persist().catch(() => undefined);
  }

  function updateActiveText(text: string) {
    const doc = activeDocument.value;
    if (!doc) return;
    doc.text = text;
    doc.updatedAt = Date.now();
    doc.dirty = fastHash(doc.text) !== fastHash(doc.lastSyncedText ?? '');
  }

  async function flushActiveDocument() {
    const doc = activeDocument.value;
    if (!doc) return;
    doc.lastSyncedText = doc.text;
    doc.dirty = false;
    await persist();
  }

  async function newScratchDocument() {
    const doc: MarkdownDocument = {
      id: makeId(),
      title: `Untitled-${documents.value.length + 1}.md`,
      text: '# Untitled\n',
      source: 'scratch',
      dirty: true,
      lastSyncedText: '',
      updatedAt: Date.now(),
    };
    documents.value.unshift(doc);
    activeDocumentId.value = doc.id;
    await persist();
  }

  async function openLocalPath(path: string) {
    const text = await readTextFile(path);
    const existing = documents.value.find((doc) => doc.localPath === path);
    const doc: MarkdownDocument = existing ?? {
      id: makeId('local'),
      title: titleFromPath(path),
      text,
      source: 'local',
      localPath: path,
      dirty: false,
      lastSyncedText: text,
      updatedAt: Date.now(),
    };
    if (existing) {
      existing.text = text;
      existing.lastSyncedText = text;
      existing.dirty = false;
      existing.updatedAt = Date.now();
    } else {
      documents.value.unshift(doc);
    }
    activeDocumentId.value = doc.id;
    status.value = `已打开本地文件：${path}`;
    await persist();
  }

  async function saveActiveLocal(path?: string) {
    const doc = activeDocument.value;
    if (!doc) return;
    const targetPath = path || doc.localPath;
    if (!targetPath) throw new Error('请提供本地保存路径。');
    await writeTextFile(targetPath, doc.text);
    doc.source = 'local';
    doc.localPath = targetPath;
    doc.title = titleFromPath(targetPath);
    doc.lastSyncedText = doc.text;
    doc.dirty = false;
    doc.updatedAt = Date.now();
    status.value = `已保存本地文件：${targetPath}`;
    await persist();
  }

  async function openGithubFile(file: GitHubTreeFile) {
    if (!githubToken.value || !githubWorkspace.value) throw new Error('GitHub workspace 未配置。');
    busy.value = true;
    error.value = '';
    try {
      const loaded = await getMarkdownFile(githubToken.value, githubWorkspace.value, file.path);
      const existing = documents.value.find((doc) => doc.github?.path === file.path && doc.github?.repo === githubWorkspace.value?.repo);
      const github = { ...githubWorkspace.value, path: file.path, sha: loaded.sha, htmlUrl: loaded.htmlUrl };
      if (existing) {
        existing.text = loaded.text;
        existing.github = github;
        existing.lastSyncedText = loaded.text;
        existing.dirty = false;
        existing.updatedAt = Date.now();
        activeDocumentId.value = existing.id;
      } else {
        const doc: MarkdownDocument = {
          id: makeId('github'),
          title: titleFromPath(file.path),
          text: loaded.text,
          source: 'github',
          github,
          dirty: false,
          lastSyncedText: loaded.text,
          updatedAt: Date.now(),
        };
        documents.value.unshift(doc);
        activeDocumentId.value = doc.id;
      }
      status.value = `已打开 GitHub 文件：${file.path}`;
      await persist();
    } catch (err) {
      error.value = err instanceof Error ? err.message : String(err);
      throw err;
    } finally {
      busy.value = false;
    }
  }

  async function saveActiveToGithub(message?: string) {
    const doc = activeDocument.value;
    if (!doc?.github || !githubToken.value) throw new Error('当前文件不是 GitHub 文件，或 token 不存在。');
    busy.value = true;
    error.value = '';
    saveConflict.value = null;
    try {
      const currentRemote = await getMarkdownFile(githubToken.value, doc.github, doc.github.path);
      if (doc.github.sha && currentRemote.sha !== doc.github.sha && currentRemote.text !== doc.lastSyncedText) {
        saveConflict.value = {
          path: doc.github.path,
          remoteSha: currentRemote.sha,
          localSha: doc.github.sha,
          remoteText: currentRemote.text,
        };
        status.value = '检测到 GitHub 远端冲突，请选择拉取远端或覆盖远端。';
        return;
      }
      const result = await saveMarkdownFile({
        token: githubToken.value,
        workspace: doc.github,
        path: doc.github.path,
        text: doc.text,
        sha: currentRemote.sha,
        message: message || `docs: update ${doc.github.path}`,
      });
      doc.github.sha = result.content.sha;
      doc.github.htmlUrl = result.content.html_url;
      doc.lastSyncedText = doc.text;
      doc.dirty = false;
      doc.updatedAt = Date.now();
      status.value = `已提交到 GitHub：${doc.github.path}`;
      await refreshGithubTree();
      await persist();
    } catch (err) {
      if (err instanceof GitHubApiError && err.status === 409) {
        status.value = 'GitHub 返回 409 冲突，请刷新远端后重试。';
      }
      error.value = err instanceof Error ? err.message : String(err);
      throw err;
    } finally {
      busy.value = false;
    }
  }

  async function pullRemoteConflict() {
    const doc = activeDocument.value;
    if (!doc || !saveConflict.value) return;
    doc.text = saveConflict.value.remoteText;
    doc.lastSyncedText = saveConflict.value.remoteText;
    if (doc.github) doc.github.sha = saveConflict.value.remoteSha;
    doc.dirty = false;
    saveConflict.value = null;
    status.value = '已拉取远端版本。';
    await persist();
  }

  async function overwriteRemoteConflict(message?: string) {
    const doc = activeDocument.value;
    if (!doc?.github || !saveConflict.value || !githubToken.value) return;
    const result = await saveMarkdownFile({
      token: githubToken.value,
      workspace: doc.github,
      path: doc.github.path,
      text: doc.text,
      sha: saveConflict.value.remoteSha,
      message: message || `docs: overwrite ${doc.github.path}`,
    });
    doc.github.sha = result.content.sha;
    doc.lastSyncedText = doc.text;
    doc.dirty = false;
    saveConflict.value = null;
    status.value = '已覆盖 GitHub 远端版本。';
    await refreshGithubTree();
    await persist();
  }

  async function refreshGithubTree() {
    if (!githubToken.value || !githubWorkspace.value) return;
    githubTree.value = await listMarkdownFiles(githubToken.value, githubWorkspace.value);
  }

  async function closeDocument(id: string) {
    const index = documents.value.findIndex((doc) => doc.id === id);
    if (index < 0) return;
    documents.value.splice(index, 1);
    if (!documents.value.length) {
      documents.value.push(defaultDocument());
    }
    if (activeDocumentId.value === id) {
      activeDocumentId.value = documents.value[Math.max(0, index - 1)]?.id ?? documents.value[0]?.id;
    }
    await persist();
  }

  return {
    documents,
    activeDocumentId,
    activeDocument,
    githubWorkspace,
    githubTree,
    darkMode,
    previewVisible,
    githubToken,
    githubUser,
    busy,
    status,
    error,
    saveConflict,
    dirtyCount,
    canSaveToGitHub,
    initialize,
    persist,
    setGithubToken,
    forgetGithubToken,
    configureGithubWorkspace,
    setActiveDocument,
    updateActiveText,
    flushActiveDocument,
    newScratchDocument,
    openLocalPath,
    saveActiveLocal,
    openGithubFile,
    saveActiveToGithub,
    pullRemoteConflict,
    overwriteRemoteConflict,
    refreshGithubTree,
    closeDocument,
  };
});
