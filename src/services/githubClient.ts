import type { GitHubTreeFile, GitHubWorkspace } from '../types/app';

const GITHUB_API = 'https://api.github.com';

export class GitHubApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly payload?: unknown,
  ) {
    super(message);
    this.name = 'GitHubApiError';
  }
}

function encodePath(path: string): string {
  return path
    .split('/')
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join('/');
}

function normalizeRoot(rootPath: string): string {
  return rootPath.trim().replace(/^\/+/, '').replace(/\/+$/, '');
}

function toBase64Utf8(input: string): string {
  const bytes = new TextEncoder().encode(input);
  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}

function fromBase64Utf8(input: string): string {
  const binary = atob(input.replace(/\n/g, ''));
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

async function request<T>(token: string, path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${GITHUB_API}${path}`, {
    ...init,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...(init.headers ?? {}),
    },
  });

  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;
  if (!response.ok) {
    const message = payload?.message ? `GitHub ${response.status}: ${payload.message}` : `GitHub ${response.status}`;
    throw new GitHubApiError(message, response.status, payload);
  }
  return payload as T;
}

export interface GitHubRepository {
  full_name: string;
  private: boolean;
  default_branch: string;
  html_url: string;
  updated_at: string;
}

interface GitHubCommitResponse {
  commit: {
    tree: {
      sha: string;
    };
  };
}

interface GitTreeResponse {
  truncated: boolean;
  tree: Array<{
    path: string;
    mode: string;
    type: 'blob' | 'tree' | 'commit';
    sha: string;
    size?: number;
    url?: string;
  }>;
}

interface GitHubContentResponse {
  type: string;
  encoding?: string;
  content?: string;
  sha: string;
  html_url?: string;
}

interface PutContentResponse {
  content: {
    path: string;
    sha: string;
    html_url?: string;
  };
  commit: {
    sha: string;
    html_url?: string;
  };
}

export async function getCurrentUser(token: string): Promise<{ login: string; avatar_url?: string }> {
  return request(token, '/user');
}

export async function listRepositories(token: string): Promise<GitHubRepository[]> {
  return request(token, '/user/repos?sort=updated&per_page=100');
}

export async function listMarkdownFiles(token: string, workspace: GitHubWorkspace): Promise<GitHubTreeFile[]> {
  const commit = await request<GitHubCommitResponse>(
    token,
    `/repos/${encodeURIComponent(workspace.owner)}/${encodeURIComponent(workspace.repo)}/commits/${encodeURIComponent(workspace.branch)}`,
  );
  const tree = await request<GitTreeResponse>(
    token,
    `/repos/${encodeURIComponent(workspace.owner)}/${encodeURIComponent(workspace.repo)}/git/trees/${encodeURIComponent(commit.commit.tree.sha)}?recursive=1`,
  );
  if (tree.truncated) {
    throw new Error('GitHub 返回的文件树被截断，请缩小同步目录或仓库范围。');
  }
  const root = normalizeRoot(workspace.rootPath);
  return tree.tree
    .filter((entry) => entry.type === 'blob')
    .filter((entry) => /\.(md|markdown|mdx)$/i.test(entry.path))
    .filter((entry) => !root || entry.path === root || entry.path.startsWith(`${root}/`))
    .map((entry) => ({ path: entry.path, sha: entry.sha, size: entry.size, url: entry.url }))
    .sort((a, b) => a.path.localeCompare(b.path));
}

export async function getMarkdownFile(token: string, workspace: GitHubWorkspace, path: string) {
  const encoded = encodePath(path);
  const content = await request<GitHubContentResponse>(
    token,
    `/repos/${encodeURIComponent(workspace.owner)}/${encodeURIComponent(workspace.repo)}/contents/${encoded}?ref=${encodeURIComponent(workspace.branch)}`,
  );
  if (content.type !== 'file' || !content.content || content.encoding !== 'base64') {
    throw new Error(`GitHub 内容不是可读取的文本文件：${path}`);
  }
  return {
    path,
    sha: content.sha,
    text: fromBase64Utf8(content.content),
    htmlUrl: content.html_url,
  };
}

export async function saveMarkdownFile(args: {
  token: string;
  workspace: GitHubWorkspace;
  path: string;
  text: string;
  sha?: string;
  message?: string;
}) {
  const encoded = encodePath(args.path);
  const body = {
    message: args.message || `docs: update ${args.path}`,
    content: toBase64Utf8(args.text),
    branch: args.workspace.branch,
    ...(args.sha ? { sha: args.sha } : {}),
  };
  return request<PutContentResponse>(
    args.token,
    `/repos/${encodeURIComponent(args.workspace.owner)}/${encodeURIComponent(args.workspace.repo)}/contents/${encoded}`,
    {
      method: 'PUT',
      body: JSON.stringify(body),
    },
  );
}
