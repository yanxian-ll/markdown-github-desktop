import { invoke } from '@tauri-apps/api/core';
import type { EnvironmentToolCheck, ExportProfile, FileNode, GitHubTokenProfile, GitStatusEntry, GitSyncResult, GitWorkspace, LatexBuildResult, PackageExportResult, PersistedAppState, PdfSyncPoint, PublishProfile, TexSourcePoint, ToolPathSettings } from '../types/app';

export const isTauriRuntime = () => typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

const browserMemory = new Map<string, unknown>();
const browserSecrets = new Map<string, string>();

export async function loadAppState(): Promise<Partial<PersistedAppState>> {
  if (!isTauriRuntime()) return (browserMemory.get('appState') as Partial<PersistedAppState>) ?? {};
  return invoke<Partial<PersistedAppState>>('load_app_state');
}

export async function saveAppState(state: PersistedAppState): Promise<void> {
  if (!isTauriRuntime()) {
    browserMemory.set('appState', state);
    return;
  }
  await invoke('save_app_state', { state });
}

export async function readTextFile(path: string): Promise<string> {
  if (!isTauriRuntime()) throw new Error('本地文件读取需要在 Tauri 桌面环境中运行。');
  return invoke<string>('read_text_file', { path });
}

export async function writeTextFile(path: string, text: string): Promise<void> {
  if (!isTauriRuntime()) throw new Error('本地文件保存需要在 Tauri 桌面环境中运行。');
  await invoke('write_text_file', { path, text });
}

export async function saveTextFileWithDialog(options: { defaultDir?: string; defaultFilename?: string; text: string }): Promise<string | null> {
  if (!isTauriRuntime()) {
    const name = options.defaultFilename || 'annotations.md';
    const blob = new Blob([options.text], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
    return name;
  }
  return invoke<string | null>('save_text_file_with_dialog', {
    defaultDir: options.defaultDir,
    defaultFilename: options.defaultFilename,
    text: options.text,
  });
}

export async function setSecret(account: string, value: string): Promise<void> {
  if (!isTauriRuntime()) {
    browserSecrets.set(account, value);
    return;
  }
  await invoke('set_secret', { account, value });
}

export async function getSecret(account: string): Promise<string | null> {
  if (!isTauriRuntime()) return browserSecrets.get(account) ?? null;
  return invoke<string | null>('get_secret', { account });
}

export async function deleteSecret(account: string): Promise<void> {
  if (!isTauriRuntime()) {
    browserSecrets.delete(account);
    return;
  }
  await invoke('delete_secret', { account });
}

export async function validateGithubToken(token: string): Promise<GitHubTokenProfile> {
  const trimmed = token.trim();
  if (!trimmed) throw new Error('GitHub token 不能为空。');
  const response = await fetch('https://api.github.com/user', {
    method: 'GET',
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${trimmed}`,
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });
  const scopes = (response.headers.get('x-oauth-scopes') || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  if (!response.ok) {
    let detail = '';
    try {
      const body = (await response.json()) as { message?: string };
      detail = body.message ? `GitHub 返回：${body.message}` : '';
    } catch {
      detail = await response.text().catch(() => '');
    }
    if (response.status === 401) throw new Error(`GitHub token 无效或已过期。${detail}`.trim());
    if (response.status === 403) throw new Error(`GitHub token 被拒绝，请检查权限、SSO 或访问限制。${detail}`.trim());
    throw new Error(`GitHub token 验证失败（HTTP ${response.status}）。${detail}`.trim());
  }
  const data = (await response.json()) as {
    login?: string;
    id?: number;
    name?: string | null;
    html_url?: string;
    avatar_url?: string;
  };
  if (!data.login) throw new Error('GitHub token 已通过请求，但响应中没有账号名。');
  return {
    login: data.login,
    id: data.id,
    name: data.name ?? null,
    htmlUrl: data.html_url,
    avatarUrl: data.avatar_url,
    scopes,
  };
}

export async function openExternalUrl(url: string): Promise<void> {
  if (!isTauriRuntime()) {
    window.open(url, '_blank', 'noopener,noreferrer');
    return;
  }
  await invoke('open_external_url', { url });
}

export async function currentSystemUsername(): Promise<string | null> {
  if (!isTauriRuntime()) return null;
  return invoke<string | null>('current_system_username');
}

export async function pickLocalFolder(): Promise<string | null> {
  if (!isTauriRuntime()) throw new Error('打开本地文件夹需要在 Tauri 桌面环境中运行。');
  return invoke<string | null>('pick_local_folder');
}

export async function pickLocalFile(): Promise<string | null> {
  if (!isTauriRuntime()) throw new Error('打开本地文件需要在 Tauri 桌面环境中运行。');
  return invoke<string | null>('pick_local_file');
}

export async function createSampleWorkspace(): Promise<string> {
  if (!isTauriRuntime()) throw new Error('示例工作区需要在 Tauri 桌面环境中创建。');
  return invoke<string>('create_sample_workspace');
}

export async function listWorkspaceFiles(rootDir: string, rootPath = ''): Promise<FileNode[]> {
  if (!isTauriRuntime()) return [];
  return invoke<FileNode[]>('list_workspace_files', { rootDir, rootPath });
}

export async function readWorkspaceFile(rootDir: string, relativePath: string): Promise<string> {
  if (!isTauriRuntime()) throw new Error('工作区文件读取需要在 Tauri 桌面环境中运行。');
  return invoke<string>('read_workspace_file', { rootDir, relativePath });
}

export async function readWorkspaceDataUrl(rootDir: string, currentRelativePath: string, assetSrc: string): Promise<string> {
  if (!isTauriRuntime()) throw new Error('本地资源预览需要在 Tauri 桌面环境中运行。');
  return invoke<string>('read_workspace_data_url', { rootDir, currentRelativePath, assetSrc });
}

export async function readFileDataUrl(path: string): Promise<string> {
  if (!isTauriRuntime()) throw new Error('本地文件预览需要在 Tauri 桌面环境中运行。');
  return invoke<string>('read_file_data_url', { path });
}

export async function writeWorkspaceFile(rootDir: string, relativePath: string, text: string): Promise<void> {
  if (!isTauriRuntime()) throw new Error('工作区文件保存需要在 Tauri 桌面环境中运行。');
  await invoke('write_workspace_file', { rootDir, relativePath, text });
}

export async function readWorkspaceAnnotations(rootDir: string): Promise<string> {
  if (!isTauriRuntime()) return (browserMemory.get(`annotations:${rootDir}`) as string) ?? '';
  return invoke<string>('read_workspace_annotations', { rootDir });
}

export async function writeWorkspaceAnnotations(rootDir: string, content: string): Promise<void> {
  if (!isTauriRuntime()) {
    browserMemory.set(`annotations:${rootDir}`, content);
    return;
  }
  await invoke('write_workspace_annotations', { rootDir, content });
}

export async function createWorkspaceFile(rootDir: string, relativePath: string, text: string): Promise<void> {
  if (!isTauriRuntime()) throw new Error('创建文件需要在 Tauri 桌面环境中运行。');
  await invoke('create_workspace_file', { rootDir, relativePath, text });
}

export async function createWorkspaceFolder(rootDir: string, relativePath: string): Promise<void> {
  if (!isTauriRuntime()) throw new Error('创建文件夹需要在 Tauri 桌面环境中运行。');
  await invoke('create_workspace_folder', { rootDir, relativePath });
}

export async function renameWorkspaceItem(rootDir: string, oldRelativePath: string, newRelativePath: string): Promise<void> {
  if (!isTauriRuntime()) throw new Error('重命名需要在 Tauri 桌面环境中运行。');
  await invoke('rename_workspace_item', { rootDir, oldRelativePath, newRelativePath });
}

export async function deleteWorkspaceItem(rootDir: string, relativePath: string): Promise<void> {
  if (!isTauriRuntime()) throw new Error('删除需要在 Tauri 桌面环境中运行。');
  await invoke('delete_workspace_item', { rootDir, relativePath });
}

export async function cloneOrUpdateRepository(workspace: GitWorkspace, token?: string | null): Promise<string> {
  if (!isTauriRuntime()) throw new Error('Git clone 需要在 Tauri 桌面环境中运行。');
  return invoke<string>('clone_or_update_repository', { workspace, token });
}

export async function gitStatus(rootDir: string): Promise<GitStatusEntry[]> {
  if (!isTauriRuntime()) return [];
  return invoke<GitStatusEntry[]>('git_status', { rootDir });
}

export async function commitAndPush(rootDir: string, branch: string, message: string, token?: string | null): Promise<string> {
  if (!isTauriRuntime()) throw new Error('Git 提交需要在 Tauri 桌面环境中运行。');
  return invoke<string>('commit_and_push', { rootDir, branch, message, token });
}

export async function buildLatex(rootDir: string, relativePath: string, toolPaths?: ToolPathSettings): Promise<LatexBuildResult> {
  if (!isTauriRuntime()) throw new Error('LaTeX 构建需要在 Tauri 桌面环境中运行。');
  return invoke<LatexBuildResult>('build_latex', { rootDir, relativePath, toolPaths });
}

export async function buildMarkdownPandoc(rootDir: string, relativePath: string, toolPaths?: ToolPathSettings): Promise<LatexBuildResult> {
  if (!isTauriRuntime()) throw new Error('Markdown → PDF 需要在 Tauri 桌面环境中运行，并安装 Pandoc。');
  return invoke<LatexBuildResult>('build_markdown_pandoc', { rootDir, relativePath, toolPaths });
}

export type PandocExportFormat = 'pdf' | 'docx' | 'html' | 'epub' | 'latex' | 'beamer';

export async function exportMarkdownPandoc(rootDir: string, relativePath: string, format: PandocExportFormat, toolPaths?: ToolPathSettings, profile?: ExportProfile): Promise<LatexBuildResult> {
  if (!isTauriRuntime()) throw new Error('Pandoc 多格式导出需要在 Tauri 桌面环境中运行，并安装 Pandoc。');
  return invoke<LatexBuildResult>('export_markdown_pandoc', { rootDir, relativePath, format, toolPaths, profile });
}

export async function publishMarkdownProfile(rootDir: string, relativePath: string, profile: PublishProfile): Promise<PackageExportResult> {
  if (!isTauriRuntime()) throw new Error('发布 profile 需要在 Tauri 桌面环境中运行。');
  return invoke<PackageExportResult>('publish_markdown_profile', { rootDir, relativePath, profile });
}

export async function exportSubmissionPackage(rootDir: string, mainTex?: string, mainMarkdown?: string, pdfPath?: string, outputRoot?: string): Promise<PackageExportResult> {
  if (!isTauriRuntime()) throw new Error('投稿包导出需要在 Tauri 桌面环境中运行。');
  return invoke<PackageExportResult>('export_submission_package', { rootDir, mainTex, mainMarkdown, pdfPath, outputRoot });
}

export async function exportSharedReviewPackage(rootDir: string, pdfPath?: string, includeResolved = false, outputRoot?: string): Promise<PackageExportResult> {
  if (!isTauriRuntime()) throw new Error('共享审阅包导出需要在 Tauri 桌面环境中运行。');
  return invoke<PackageExportResult>('export_shared_review_package', { rootDir, pdfPath, includeResolved, outputRoot });
}

export async function compileTikzPreview(rootDir: string, currentRelativePath: string, source: string, toolPaths?: ToolPathSettings): Promise<string> {
  if (!isTauriRuntime()) throw new Error('TikZ 预览需要在 Tauri 桌面环境中运行，并安装 XeLaTeX。');
  return invoke<string>('compile_tikz_preview', { rootDir, currentRelativePath, source, toolPaths });
}

export async function gitPullWithConflictStatus(rootDir: string, branch: string, token?: string | null): Promise<GitSyncResult> {
  if (!isTauriRuntime()) throw new Error('Git Pull 需要在 Tauri 桌面环境中运行。');
  return invoke<GitSyncResult>('git_pull_with_conflict_status', { rootDir, branch, token });
}

export async function gitPushCurrentBranch(rootDir: string, branch: string, token?: string | null): Promise<GitSyncResult> {
  if (!isTauriRuntime()) throw new Error('Git Push 需要在 Tauri 桌面环境中运行。');
  return invoke<GitSyncResult>('git_push_current_branch', { rootDir, branch, token });
}

export async function checkEnvironment(toolPaths?: ToolPathSettings): Promise<EnvironmentToolCheck[]> {
  if (!isTauriRuntime()) {
    return ([
      ['pandoc', 'Pandoc'],
      ['xelatex', 'XeLaTeX'],
      ['latexmk', 'latexmk'],
      ['synctex', 'SyncTeX'],
      ['git', 'Git'],
    ] as const).map(([id, label]) => ({
      id,
      label,
      ok: false,
      required: id === 'pandoc' || id === 'xelatex' || id === 'git',
      command: toolPaths?.[id] || id,
      error: '浏览器预览模式无法检测本机命令，请在 Tauri 桌面应用中使用。',
      installHint: '请在桌面应用中运行环境检查。',
    }));
  }
  return invoke<EnvironmentToolCheck[]>('check_environment', { toolPaths });
}

export async function findLatexPdf(rootDir: string, relativePath: string): Promise<string | null> {
  if (!isTauriRuntime()) return null;
  return invoke<string | null>('find_latex_pdf', { rootDir, relativePath });
}

export async function cleanLatex(rootDir: string, relativePath: string): Promise<string> {
  if (!isTauriRuntime()) throw new Error('清理 LaTeX 产物需要在 Tauri 桌面环境中运行。');
  return invoke<string>('clean_latex', { rootDir, relativePath });
}

export async function openPdf(path: string): Promise<void> {
  if (!isTauriRuntime()) throw new Error('打开 PDF 需要在 Tauri 桌面环境中运行。');
  await invoke('open_pdf', { path });
}

export async function openLocalPath(path: string): Promise<void> {
  if (!isTauriRuntime()) throw new Error('打开本地路径需要在 Tauri 桌面环境中运行。');
  await invoke('open_path', { path });
}

export async function synctexForward(rootDir: string, relativePath: string, line: number, column: number, toolPaths?: ToolPathSettings): Promise<PdfSyncPoint> {
  if (!isTauriRuntime()) throw new Error('SyncTeX 正向定位需要在 Tauri 桌面环境中运行。');
  return invoke<PdfSyncPoint>('synctex_forward', { rootDir, relativePath, line, column, toolPaths });
}

export async function synctexReverse(rootDir: string, pdfPath: string, page: number, x: number, y: number, toolPaths?: ToolPathSettings): Promise<TexSourcePoint> {
  if (!isTauriRuntime()) throw new Error('SyncTeX 反向定位需要在 Tauri 桌面环境中运行。');
  return invoke<TexSourcePoint>('synctex_reverse', { rootDir, pdfPath, page, x, y, toolPaths });
}
