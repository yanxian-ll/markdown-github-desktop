export type DocumentSource = 'scratch' | 'local' | 'github';

export interface GitHubWorkspace {
  owner: string;
  repo: string;
  branch: string;
  rootPath: string;
}

export interface GitHubFileRef extends GitHubWorkspace {
  path: string;
  sha?: string;
  htmlUrl?: string;
}

export interface MarkdownDocument {
  id: string;
  title: string;
  text: string;
  source: DocumentSource;
  localPath?: string;
  github?: GitHubFileRef;
  dirty: boolean;
  lastSyncedText?: string;
  updatedAt: number;
}

export interface GitHubTreeFile {
  path: string;
  sha: string;
  size?: number;
  url?: string;
}

export interface PersistedAppState {
  documents: MarkdownDocument[];
  activeDocumentId?: string;
  githubWorkspace?: GitHubWorkspace;
  githubTree: GitHubTreeFile[];
  editor: {
    darkMode: boolean;
    vimMode: boolean;
    previewVisible: boolean;
  };
}

export interface SaveConflict {
  path: string;
  remoteSha: string;
  localSha?: string;
  remoteText: string;
}
