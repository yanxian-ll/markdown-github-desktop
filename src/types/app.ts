export type DocumentSource = "scratch" | "workspace";
export type DocumentKind =
  | "markdown"
  | "latex"
  | "bibtex"
  | "text"
  | "image"
  | "pdf";

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
  kind: "file" | "folder";
  documentKind: DocumentKind;
  children: FileNode[];
}

export interface GitStatusEntry {
  code: string;
  path: string;
}

export interface LatexDiagnostic {
  level: "error" | "warning";
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
  // PDF-space coordinates returned by SyncTeX.  These are in the
  // unscaled PDF coordinate system used by pdf.js viewport scale=1.
  x: number;
  y: number;
  h?: number;
  v?: number;
  width?: number;
  height?: number;
  pdfPath?: string;
  // For annotation jumps we often only know a normalized PDF rect, not raw
  // SyncTeX coordinates.  PdfPreview prefers these fields when present.
  normalizedX?: number;
  normalizedY?: number;
  annotationId?: string;
  source?: "synctex" | "annotation";
}

export interface TexSourcePoint {
  input: string;
  relativePath?: string;
  line: number;
  column?: number;
}

export type PaperAnnotationType =
  | "highlight"
  | "text"
  | "comment"
  | "area"
  | "freehand"
  | "todo"
  | "replace";
export type PaperAnnotationAnchorConfidence = "stable" | "unstable" | "unknown";
export type PaperAnnotationStatus = "open" | "resolved" | "ignored";

export interface PaperAnnotationRect {
  x: number;
  y: number;
  width: number;
  height: number;
}


export interface PaperMarkdownAnchor {
  file: string;
  rects: PaperAnnotationRect[];
  textQuote?: string;
  contextBefore?: string;
  contextAfter?: string;
}

export interface PaperPdfAnchor {
  pdfPath?: string;
  pdfFingerprint?: string;
  page: number;
  // Normalized visual rectangles.  Text/PDF annotations normally have these.
  // Source-only annotations may not have stable rectangles; in that case
  // syncPoint is used to render and jump near the matching PDF text.
  rects: PaperAnnotationRect[];
  syncPoint?: PdfSyncPoint;
  textQuote?: string;
  contextBefore?: string;
  contextAfter?: string;
}

export interface PaperTexAnchor {
  root?: string;
  file: string;
  line: number;
  lineEnd?: number;
  column?: number;
  columnEnd?: number;
  sourceRange?: {
    start: number;
    end: number;
  };
  sourceText?: string;
  contextBefore?: string;
  contextAfter?: string;
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
  markdownAnchor?: PaperMarkdownAnchor;
  texAnchor?: PaperTexAnchor;
  selectedText?: string;
  sourceText?: string;
  contextBefore?: string;
  contextAfter?: string;
  suggestedChange?: string;
  targetType?:
    | "text"
    | "figure"
    | "table"
    | "equation"
    | "layout"
    | "source"
    | "unknown";
  anchorConfidence?: PaperAnnotationAnchorConfidence;
  needsReview?: boolean;
  needsReviewReason?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PaperReviewItem {
  id: string;
  status: PaperAnnotationStatus;
  type: PaperAnnotationType;
  file?: string;
  line_start?: number;
  line_end?: number;
  selected_text?: string;
  source_text?: string;
  context_before?: string;
  context_after?: string;
  comment: string;
  suggested_change?: string;
  pdf_page?: number;
  anchor_confidence?: PaperAnnotationAnchorConfidence;
  needs_review?: boolean;
  needs_review_reason?: string;
  created_at: string;
  updated_at: string;
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
