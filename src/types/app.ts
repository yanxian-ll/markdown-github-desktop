export type DocumentSource = 'scratch' | 'workspace';
export type DocumentKind = 'markdown' | 'latex' | 'bibtex' | 'text' | 'image' | 'pdf';

export interface GitWorkspace {
  owner: string;
  repo: string;
  branch: string;
  localDir: string;
  rootPath: string;
}

export interface MarkdownDocument {
  id: string;
  title: string;
  text: string;
  source: DocumentSource;
  kind: DocumentKind;
  relativePath?: string;
  absolutePath?: string;
  dirty: boolean;
  lastSavedText?: string;
  updatedAt: number;
}

export interface FileNode {
  name: string;
  path: string;
  kind: 'file' | 'folder';
  documentKind: DocumentKind;
  children: FileNode[];
}

export interface GitStatusEntry {
  code: string;
  path: string;
}

export interface LatexDiagnostic {
  level: 'error' | 'warning';
  message: string;
  file?: string;
  line?: number;
}

export interface LatexBuildResult {
  ok: boolean;
  command: string;
  pdfPath?: string;
  log: string;
  diagnostics: LatexDiagnostic[];
}

export interface PdfSyncPoint {
  page: number;
  x: number;
  y: number;
  h?: number;
  v?: number;
  width?: number;
  height?: number;
  pdfPath?: string;
}

export interface TexSourcePoint {
  input: string;
  relativePath?: string;
  line: number;
  column?: number;
}

export type PaperAnnotationType = 'highlight' | 'comment' | 'area' | 'freehand' | 'todo' | 'replace';
export type PaperAnnotationStatus = 'open' | 'resolved' | 'ignored';

export interface PaperAnnotationRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PaperPdfAnchor {
  pdfPath?: string;
  pdfFingerprint?: string;
  page: number;
  rects: PaperAnnotationRect[];
  textQuote?: string;
  contextBefore?: string;
  contextAfter?: string;
}

export interface PaperTexAnchor {
  root?: string;
  file: string;
  line: number;
  column?: number;
  sourceRange?: {
    start: number;
    end: number;
  };
  surroundingTextHash?: string;
}

export interface PaperAnnotation {
  id: string;
  type: PaperAnnotationType;
  status: PaperAnnotationStatus;
  body: string;
  tags: string[];
  documentPath?: string;
  pdfAnchor?: PaperPdfAnchor;
  texAnchor?: PaperTexAnchor;
  createdAt: string;
  updatedAt: string;
}

export interface PersistedAppState {
  documents: MarkdownDocument[];
  activeDocumentId?: string;
  fileTree: FileNode[];
  workspace?: GitWorkspace;
  gitStatus: GitStatusEntry[];
  editor: {
    darkMode: boolean;
    vimMode: boolean;
    previewVisible: boolean;
    explorerVisible: boolean;
    gitPanelVisible: boolean;
    pdfPanelVisible: boolean;
    pdfRenderQuality?: number;
  };
}
