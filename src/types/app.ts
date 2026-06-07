export type DocumentSource = "scratch" | "workspace";
export type DocumentKind =
  | "markdown"
  | "latex"
  | "bibtex"
  | "text"
  | "image"
  | "pdf";

export interface GitWorkspace {
  /** github: 从 GitHub 获取/更新；local: 直接打开本地文件夹或文件。 */
  source?: "github" | "local";
  /** local 模式下用于区分“打开文件夹”和“只打开一个文件”。 */
  localOpenKind?: "folder" | "file";
  /** localOpenKind=file 时，只在文档区显示和操作这个文件。 */
  localFileName?: string;
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

export type EnvironmentToolId = "pandoc" | "xelatex" | "latexmk" | "synctex" | "git";

export interface EnvironmentToolCheck {
  id: EnvironmentToolId;
  label: string;
  ok: boolean;
  required: boolean;
  command: string;
  version?: string;
  error?: string;
  installHint: string;
}

export interface ToolPathSettings {
  pandoc?: string;
  xelatex?: string;
  latexmk?: string;
  synctex?: string;
  git?: string;
}

export type FirstRunMode = "paper" | "notes" | "review" | "weekly";
export type BuildCommandPreference = "auto" | "latexmk" | "xelatex" | "pdflatex" | "lualatex";

export interface PrivacySettings {
  /** 是否允许把较大的预览文本写入 appState；默认 false。 */
  persistLargePreviews?: boolean;
  /** 单个草稿文档允许写入 appState 的最大字符数。 */
  maxPersistedTextChars?: number;
}

export interface ProjectSettings {
  projectType?: "paper" | "notes" | "review" | "mixed" | "plain";
  firstRunMode?: FirstRunMode;
  mainTexFile?: string;
  mainMarkdownFile?: string;
  exportProfile?: string;
  pandocProfileId?: string;
  buildCommand?: BuildCommandPreference;
  pdfRenderQuality?: number;
  authorName?: string;
  privacy?: PrivacySettings;
  toolPaths?: ToolPathSettings;
  researchFlowPaths?: {
    dailyDir?: string;
    weeklyDir?: string;
    evidenceIndex?: string;
    paperOutline?: string;
    reviewSummary?: string;
  };
}

export interface ExportProfile {
  id: string;
  name: string;
  format: "pdf" | "docx" | "html" | "epub" | "latex" | "beamer";
  args: string[];
  outputDir?: string;
  description?: string;
  lastUsedAt?: string;
}

export interface ResearchFlowStepStatus {
  id: "daily" | "weekly" | "evidence" | "outline" | "review";
  label: string;
  state: "done" | "ready" | "missing" | "blocked";
  path?: string;
  updatedAt?: string;
  detail: string;
  missing: string[];
}

export type AnnotationExportFormat = "markdown" | "jsonl" | "csv" | "latex-todonotes";

export type BibEntryType = "article" | "inproceedings" | "book" | "phdthesis" | "mastersthesis" | "misc";

export interface BibEntryPayload {
  type: BibEntryType | string;
  key: string;
  title: string;
  author: string;
  year: string;
  journal?: string;
  booktitle?: string;
  publisher?: string;
  doi?: string;
  url?: string;
  note?: string;
}

export interface LayoutSettings {
  explorerWidth: number;
  templatePanelWidth: number;
  settingsWidth: number;
  previewWidth: number;
  annotationPanelWidth: number;
  bottomPanelHeight: number;
  /** 编辑器字体大小，支持 Ctrl/Cmd + 鼠标滚轮缩放。 */
  editorFontSize: number;
  editorSidePanelWidths: Partial<Record<"workflow" | "outline" | "bib" | "snippets" | "history", number>>;
}

export interface RecoveryState {
  shutdownClean: boolean;
  lastStartedAt?: number;
  lastClosedAt?: number;
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

export interface PaperAnnotationMessage {
  id: string;
  body: string;
  author?: string;
  replyToMessageId?: string;
  replyToAuthor?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface PaperAnnotationTaskMarker {
  file: string;
  line: number;
  marker: string;
}

export interface PaperAnnotation {
  id: string;
  type: PaperAnnotationType;
  status: PaperAnnotationStatus;
  /**
   * First message body kept for compatibility with v0.4.x annotations.
   * New v0.5.0 comments use messages[] as the source of truth.
   */
  body: string;
  messages?: PaperAnnotationMessage[];
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
  taskMarker?: PaperAnnotationTaskMarker;
  resolvedAt?: string;
  resolvedBy?: string;
  resolvedRevision?: string;
  resolutionNote?: string;
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
  task_marker?: PaperAnnotationTaskMarker;
  resolved_at?: string;
  resolved_by?: string;
  resolved_revision?: string;
  resolution_note?: string;
  created_at: string;
  updated_at: string;
}

export type MarkdownRenderPreset = "default" | "academic" | "compact" | "reading" | "manuscript";

export interface PersistedAppState {
  documents: MarkdownDocument[];
  activeDocumentId?: string;
  fileTree: FileNode[];
  workspace?: GitWorkspace;
  /** 设置中的用户名，也作为本地文件/文件夹批注作者。 */
  commentAuthorName?: string;
  gitStatus: GitStatusEntry[];
  editor: {
    darkMode: boolean;
    vimMode: boolean;
    previewVisible: boolean;
    explorerVisible: boolean;
    gitPanelVisible: boolean;
    pdfPanelVisible: boolean;
    pdfRenderQuality?: number;
    markdownRenderPreset?: MarkdownRenderPreset;
    toolPaths?: ToolPathSettings;
  };
  layout?: Partial<LayoutSettings>;
  projectSettings?: ProjectSettings;
  exportProfiles?: ExportProfile[];
  recovery?: RecoveryState;
}
