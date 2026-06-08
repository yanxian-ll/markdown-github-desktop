import { defineStore } from "pinia";
import { computed, ref, watch } from "vue";
import { sampleLatex, sampleMarkdown } from "../services/markdown";
import isprsCls from "../templates/vendor/isprs/isprs.cls?raw";
import isprsBst from "../templates/vendor/isprs/isprs.bst?raw";
import { makeId } from "../services/hash";
import {
  buildLatex as buildLatexFile,
  buildMarkdownPandoc as buildMarkdownPandocFile,
  exportMarkdownPandoc as exportMarkdownPandocFile,
  cleanLatex as cleanLatexFiles,
  cloneOrUpdateRepository,
  commitAndPush,
  currentSystemUsername,
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
  pickLocalFile,
  pickLocalFolder,
  renameWorkspaceItem,
  saveAppState,
  setSecret,
  validateGithubToken,
  synctexForward,
  synctexReverse,
  writeWorkspaceAnnotations,
  writeWorkspaceFile,
  saveTextFileWithDialog,
  checkEnvironment,
  createSampleWorkspace,
  publishMarkdownProfile,
  exportSubmissionPackage,
  exportSharedReviewPackage,
  gitPullWithConflictStatus,
  gitPushCurrentBranch,
  openLocalPath as openTauriPath,
} from "../services/tauriBridge";
import type {
  DocumentKind,
  FileNode,
  GitStatusEntry,
  GitWorkspace,
  LatexBuildResult,
  MarkdownDocument,
  PaperAnnotation,
  PaperAnnotationMessage,
  PaperAnnotationRect,
  PaperPdfAnchor,
  PaperAnnotationStatus,
  PaperReviewItem,
  PdfSyncPoint,
  TexSourcePoint,
  PersistedAppState,
  MarkdownRenderPreset,
  EnvironmentToolCheck,
  ToolPathSettings,
  LayoutSettings,
  ProjectSettings,
  ExportProfile,
  PublishProfile,
  CustomSnippet,
  PackageExportResult,
  GitSyncResult,
  FirstRunMode,
  ResearchFlowStepStatus,
  AnnotationExportFormat,
  BibEntryPayload,
} from "../types/app";
import type {
  AiConversationMessage,
  AiEvidencePack,
  AiGroundingMode,
  AiIndexStats,
  ProposedPatch,
} from "../types/ai";
import {
  buildAnnotationEvidenceSeed,
  buildDocumentEvidenceSeed,
  createEmptyAiIndexStats,
  createEvidencePack,
} from "../services/ai/evidenceIndex";
import type {
  BibEntryItem,
  LatexOutlineItem,
  ProjectLatexIndex,
} from "../types/latexIntelligence";
import { emptyLatexIndex } from "../types/latexIntelligence";
import { computeWritingStats, formatWritingStats } from '../services/writingStats';
import { getBuiltinTemplate } from '../services/templates';
import {
  buildProjectLatexIndex,
  resolveIndexedFilePath,
  resolveTexLikePath,
} from "../services/latexIntelligence";

const GITHUB_TOKEN_ACCOUNT = "github-token";
const MAX_PERSISTED_DOCUMENT_CHARS = 500_000;
const MAX_INLINE_PREVIEW_CHARS = 300_000;

const COMMON_EXTENSIONS = [
  "md",
  "markdown",
  "tex",
  "txt",
  "bib",
  "sty",
  "cls",
  "bst",
  "png",
  "jpg",
  "jpeg",
  "svg",
  "pdf",
];

function kindFromPath(path: string): DocumentKind {
  const ext = path.split(".").pop()?.toLowerCase();
  if (["md", "markdown", "mdown", "mkd"].includes(ext || "")) return "markdown";
  if (["tex", "ltx"].includes(ext || "")) return "latex";
  if (ext === "bib") return "bibtex";
  if (["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp"].includes(ext || ""))
    return "image";
  if (ext === "pdf") return "pdf";
  return "text";
}

function titleFromPath(path: string): string {
  return path.split(/[\\/]/).pop() || path || "Untitled.md";
}

function normalizePath(path: string): string {
  return path
    .trim()
    .replace(/\\/g, "/")
    .replace(/^\/+/, "")
    .replace(/\/+$/, "");
}

function normalizeWorkspace(workspace: GitWorkspace): GitWorkspace {
  return {
    source: workspace.source || "github",
    localOpenKind: workspace.localOpenKind,
    localFileName: workspace.localFileName,
    owner: workspace.owner.trim(),
    repo: workspace.repo
      .trim()
      .replace(/^.*\//, "")
      .replace(/\.git$/, ""),
    branch: workspace.branch.trim() || "main",
    localDir: workspace.localDir.trim(),
    rootPath: normalizePath(workspace.rootPath || ""),
  };
}

function stripTrailingSeparators(path: string): string {
  return path.replace(/[\\/]+$/, "");
}

function baseNameOfPath(path: string): string {
  const cleaned = stripTrailingSeparators(path.replace(/\\/g, "/"));
  return cleaned.split("/").filter(Boolean).pop() || cleaned || "本地工作区";
}

function parentDirOfAbsolutePath(path: string): string {
  const cleaned = stripTrailingSeparators(path.replace(/\\/g, "/"));
  const index = cleaned.lastIndexOf("/");
  return index > 0 ? cleaned.slice(0, index) : cleaned;
}

function singleFileNodeFromName(name: string): FileNode {
  return {
    name,
    path: name,
    kind: "file",
    documentKind: kindFromPath(name),
    children: [],
  };
}

function defaultDocument(): MarkdownDocument {
  return {
    id: makeId(),
    title: "Welcome.md",
    text: sampleMarkdown,
    source: "scratch",
    kind: "markdown",
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
      previewVisible: false,
      explorerVisible: true,
      gitPanelVisible: true,
      pdfPanelVisible: true,
      pdfRenderQuality: 0.72,
      markdownRenderPreset: "default",
      toolPaths: {},
    },
    layout: defaultLayoutSettings(),
    projectSettings: defaultProjectSettings(),
    exportProfiles: defaultExportProfiles(),
    recovery: { shutdownClean: true },
  };
}

function textTemplateForPath(path: string): string {
  const kind = kindFromPath(path);
  const name = titleFromPath(path);
  if (kind === "latex") return sampleLatex;
  if (kind === "bibtex") {
    return `@article{example2026,\n  title   = {Example BibTeX Entry},\n  author  = {Doe, Jane},\n  journal = {Journal of Examples},\n  year    = {2026}\n}\n`;
  }
  if (kind === "markdown")
    return `# ${name.replace(/\.(md|markdown|mdown|mkd)$/i, "")}\n\n开始写作。\n`;
  if (kind === "pdf") return "PDF 文件可从预览区打开。";
  if (kind === "image") return "";
  return "";
}

function findNodeByPath(
  nodes: FileNode[],
  path?: string,
): FileNode | undefined {
  if (!path) return undefined;
  for (const node of nodes) {
    if (node.path === path) return node;
    const child = findNodeByPath(node.children, path);
    if (child) return child;
  }
  return undefined;
}

function findFirstFileNode(nodes: FileNode[]): FileNode | undefined {
  const preferred = nodes.flatMap((node) =>
    node.kind === "file" && ["markdown", "latex"].includes(node.documentKind)
      ? [node]
      : [],
  )[0];
  if (preferred) return preferred;
  for (const node of nodes) {
    if (node.kind === "file") return node;
    const child = findFirstFileNode(node.children);
    if (child) return child;
  }
  return undefined;
}

function parentPathOf(path: string): string {
  const normalized = normalizePath(path);
  const index = normalized.lastIndexOf("/");
  return index === -1 ? "" : normalized.slice(0, index);
}

function joinDisplayPath(base: string, child: string): string {
  const normalizedBase = normalizePath(base);
  const normalizedChild = child.trim().replace(/\\/g, "/").replace(/^\/+/, "");
  return normalizedBase
    ? `${normalizedBase}/${normalizedChild}`
    : normalizedChild;
}

function targetDirectoryFromNode(node?: FileNode): string {
  if (!node) return "";
  if (node.kind === "folder") return normalizePath(node.path);
  return parentPathOf(node.path);
}

function nowIso() {
  return new Date().toISOString();
}

function formatLocalDate(date: Date) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function isoWeekLabel(date: Date) {
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const dayNumber = (target.getDay() + 6) % 7;
  target.setDate(target.getDate() - dayNumber + 3);
  const firstThursday = new Date(target.getFullYear(), 0, 4);
  const firstDayNumber = (firstThursday.getDay() + 6) % 7;
  firstThursday.setDate(firstThursday.getDate() - firstDayNumber + 3);
  const week = 1 + Math.round((target.getTime() - firstThursday.getTime()) / (7 * 24 * 60 * 60 * 1000));
  return `${target.getFullYear()}-W${String(week).padStart(2, "0")}`;
}

function defaultLayoutSettings(): LayoutSettings {
  return {
    explorerWidth: 280,
    templatePanelWidth: 340,
    settingsWidth: 360,
    previewWidth: 560,
    annotationPanelWidth: 300,
    bottomPanelHeight: 260,
    bottomDockVisible: false,
    bottomDockActiveTab: 'problems',
    aiPanelHeight: 320,
    editorFontSize: 14,
    editorSidePanelWidths: {
      workflow: 340,
      outline: 280,
      bib: 360,
      snippets: 320,
      history: 320,
    },
  };
}

function mergeLayoutSettings(saved?: Partial<LayoutSettings>): LayoutSettings {
  const fallback = defaultLayoutSettings();
  return {
    ...fallback,
    ...saved,
    editorSidePanelWidths: {
      ...fallback.editorSidePanelWidths,
      ...(saved?.editorSidePanelWidths || {}),
    },
  };
}

function defaultProjectSettings(): ProjectSettings {
  return {
    projectType: "plain",
    exportProfile: "pdf",
    pandocProfileId: "pdf",
    buildCommand: "auto",
    pdfRenderQuality: 0.72,
    privacy: {
      persistLargePreviews: false,
      maxPersistedTextChars: MAX_PERSISTED_DOCUMENT_CHARS,
    },
    researchFlowPaths: {
      dailyDir: "notes/daily",
      weeklyDir: "notes/weekly",
      evidenceIndex: "research/evidence-index.md",
      paperOutline: "paper/paper-outline.md",
      reviewSummary: ".paper-notes/review-summary.md",
    },
    publishing: {
      activeProfileId: "hugo-default",
      profiles: defaultPublishProfiles(),
    },
    collaboration: {
      includeSourceContext: true,
      includeResolvedAnnotations: false,
    },
  };
}

function defaultPublishProfiles(): PublishProfile[] {
  return [
    { id: "hugo-default", name: "Hugo 内容包", engine: "hugo", contentDir: "publication/hugo/content/posts", assetDir: "publication/hugo/static/assets", frontmatterMode: "yaml", resourceStrategy: "copy-local", draft: true },
    { id: "jekyll-default", name: "Jekyll 文章", engine: "jekyll", contentDir: "publication/jekyll/_posts", assetDir: "publication/jekyll/assets", frontmatterMode: "yaml", resourceStrategy: "copy-local", draft: true },
  ];
}

function defaultExportProfiles(): ExportProfile[] {
  return [
    { id: "pdf", name: "PDF", format: "pdf", args: ["--pdf-engine=xelatex"], bibliography: "refs.bib", citeproc: true, description: "Pandoc PDF，默认使用 XeLaTeX，可绑定 CSL/BibTeX" },
    { id: "docx", name: "Word DOCX", format: "docx", args: [], bibliography: "refs.bib", csl: "", referenceDoc: "", citeproc: true, description: "导出给导师/合作者审阅；支持 reference-doc、CSL、bibliography" },
    { id: "html", name: "HTML", format: "html", args: ["--standalone"], bibliography: "refs.bib", citeproc: true, description: "单文件网页预览" },
    { id: "epub", name: "EPUB", format: "epub", args: [], bibliography: "refs.bib", citeproc: true, description: "电子书草稿" },
    { id: "latex", name: "LaTeX", format: "latex", args: ["-t", "latex"], description: "从 Markdown 生成 .tex" },
    { id: "beamer", name: "Beamer PDF", format: "beamer", args: ["-t", "beamer", "--pdf-engine=xelatex", "--slide-level=2"], bibliography: "refs.bib", citeproc: true, description: "Markdown 到 Beamer 幻灯片" },
  ];
}

function safeDraftKey(relativePath: string) {
  return normalizePath(relativePath).replace(/[^a-zA-Z0-9._-]+/g, "__");
}

function isTextDocumentKind(kind?: DocumentKind) {
  return ["markdown", "latex", "bibtex", "text"].includes(kind || "");
}

function flattenFileNodes(nodes: FileNode[]): FileNode[] {
  return nodes.flatMap((node) => [node, ...flattenFileNodes(node.children)]);
}

function yamlList(values: string[]) {
  return values.length ? values.map((value) => `  - ${value}`).join("\n") : "  - ";
}

function makeAnnotationMessage(
  body: string,
  createdAt = nowIso(),
  author?: string,
  replyTo?: PaperAnnotationMessage,
): PaperAnnotationMessage {
  return {
    id: makeId("msg"),
    body,
    author,
    replyToMessageId: replyTo?.id,
    replyToAuthor: replyTo?.author,
    createdAt,
    updatedAt: createdAt,
  };
}

function threadMessages(item: PaperAnnotation): PaperAnnotationMessage[] {
  const createdAt = item.createdAt || nowIso();
  const messages = Array.isArray(item.messages)
    ? item.messages
        .filter((message) => typeof message?.body === "string")
        .map((message) => ({
          id: message.id || makeId("msg"),
          body: message.body,
          author: message.author,
          replyToMessageId: message.replyToMessageId,
          replyToAuthor: message.replyToAuthor,
          createdAt: message.createdAt || createdAt,
          updatedAt: message.updatedAt || message.createdAt || createdAt,
        }))
    : [];
  if (!messages.length && item.body) {
    messages.push({
      id: `${item.id}-msg-1`,
      body: item.body,
      author: undefined,
      replyToMessageId: undefined,
      replyToAuthor: undefined,
      createdAt,
      updatedAt: item.updatedAt || createdAt,
    });
  }
  return messages;
}

function normalizeAnnotationThread(item: PaperAnnotation): PaperAnnotation {
  const messages = threadMessages(item);
  const body = messages[0]?.body || item.body || "";
  return {
    ...item,
    body,
    messages,
  };
}

function annotationCommentText(item: PaperAnnotation) {
  const messages = threadMessages(item);
  if (!messages.length) return item.body || "";
  return messages
    .map((message, index) =>
      messages.length === 1 ? message.body : `${index + 1}. ${message.body}`,
    )
    .join("\n");
}

function normalizeAnnotationRect(
  rect: PaperAnnotationRect,
): PaperAnnotationRect {
  const x = Math.min(1, Math.max(0, rect.x));
  const y = Math.min(1, Math.max(0, rect.y));
  const width = Math.min(1 - x, Math.max(0, rect.width));
  const height = Math.min(1 - y, Math.max(0, rect.height));
  return { x, y, width, height };
}

function syncPointFromPdfAnchor(
  anchor: PaperPdfAnchor,
  annotationId?: string,
): PdfSyncPoint | undefined {
  if (anchor.rects.length) {
    const rect = anchor.rects[0];
    return {
      page: anchor.page,
      x: 0,
      y: 0,
      normalizedX: rect.x + rect.width / 2,
      normalizedY: rect.y + rect.height / 2,
      pdfPath: anchor.pdfPath || anchor.syncPoint?.pdfPath,
      annotationId,
      source: "annotation",
    };
  }
  if (anchor.syncPoint) {
    return {
      ...anchor.syncPoint,
      page: anchor.page || anchor.syncPoint.page,
      pdfPath: anchor.pdfPath || anchor.syncPoint.pdfPath,
      annotationId,
      source: "annotation",
    };
  }
  return undefined;
}

function pdfAnchorFromSyncPoint(
  point: PdfSyncPoint,
  fallbackPdfPath?: string,
  textQuote?: string,
): PaperPdfAnchor {
  return {
    pdfPath: point.pdfPath || fallbackPdfPath,
    page: point.page,
    rects: [],
    syncPoint: {
      ...point,
      pdfPath: point.pdfPath || fallbackPdfPath,
      source: "synctex",
    },
    textQuote,
  };
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
        return [
          normalizeAnnotationThread({
            ...item,
            status: item.status || "open",
            tags: Array.isArray(item.tags) ? item.tags : [],
            selectedText:
              item.selectedText ||
              item.markdownAnchor?.textQuote ||
              item.pdfAnchor?.textQuote ||
              item.texAnchor?.sourceText,
            sourceText: item.sourceText || item.texAnchor?.sourceText,
            anchorConfidence:
              item.anchorConfidence ||
              (item.texAnchor
                ? "stable"
                : item.type === "area"
                  ? "unstable"
                  : "unknown"),
            needsReview:
              item.needsReview ?? (!item.texAnchor && item.type === "area"),
          }),
        ];
      } catch {
        return [];
      }
    });
}

function lineRangeForSourceText(
  text: string,
  startLine: number,
  endLine?: number,
) {
  const lines = text.split(/\r?\n/);
  const safeStart = Math.max(1, Math.min(lines.length || 1, startLine));
  const safeEnd = Math.max(
    safeStart,
    Math.min(lines.length || safeStart, endLine || safeStart),
  );
  const sourceText = lines.slice(safeStart - 1, safeEnd).join("\n");
  const contextBefore = lines
    .slice(Math.max(0, safeStart - 4), safeStart - 1)
    .join("\n")
    .trim();
  const contextAfter = lines
    .slice(safeEnd, Math.min(lines.length, safeEnd + 3))
    .join("\n")
    .trim();
  return { safeStart, safeEnd, sourceText, contextBefore, contextAfter };
}

function lineNumberAtOffset(text: string, offset: number) {
  return text.slice(0, Math.max(0, offset)).split(/\r?\n/).length;
}

function findMarkdownSourceRange(source: string, selectedText: string) {
  const trimmed = selectedText.trim();
  if (!trimmed) return lineRangeForSourceText(source, 1);

  let index = source.indexOf(trimmed);
  let matchLength = trimmed.length;

  if (index < 0) {
    const normalizedSelected = trimmed.replace(/\s+/g, " ").trim();
    const map: number[] = [];
    let normalized = "";
    let previousWasSpace = false;
    for (let i = 0; i < source.length; i += 1) {
      const char = source[i];
      if (/\s/.test(char)) {
        if (!previousWasSpace) {
          normalized += " ";
          map.push(i);
          previousWasSpace = true;
        }
      } else {
        normalized += char;
        map.push(i);
        previousWasSpace = false;
      }
    }
    const normalizedIndex = normalized.indexOf(normalizedSelected);
    if (normalizedIndex >= 0) {
      index = map[normalizedIndex] ?? 0;
      const normalizedEnd = normalizedIndex + normalizedSelected.length - 1;
      const endOffset = map[Math.min(map.length - 1, normalizedEnd)] ?? index;
      matchLength = Math.max(1, endOffset - index + 1);
    }
  }

  if (index < 0) return lineRangeForSourceText(source, 1);
  const startLine = lineNumberAtOffset(source, index);
  const endLine = lineNumberAtOffset(source, index + matchLength);
  return lineRangeForSourceText(source, startLine, endLine);
}

function reviewItemFromAnnotation(item: PaperAnnotation): PaperReviewItem {
  const selected =
    item.selectedText ||
    item.markdownAnchor?.textQuote ||
    item.pdfAnchor?.textQuote ||
    item.texAnchor?.sourceText ||
    item.sourceText;
  return {
    id: item.id,
    status: item.status,
    type: item.type,
    file: item.texAnchor?.file || item.documentPath,
    line_start: item.texAnchor?.line,
    line_end: item.texAnchor?.lineEnd || item.texAnchor?.line,
    selected_text: selected,
    source_text: item.texAnchor?.sourceText || item.sourceText,
    context_before:
      item.contextBefore ||
      item.texAnchor?.contextBefore ||
      item.markdownAnchor?.contextBefore ||
      item.pdfAnchor?.contextBefore,
    context_after:
      item.contextAfter ||
      item.texAnchor?.contextAfter ||
      item.markdownAnchor?.contextAfter ||
      item.pdfAnchor?.contextAfter,
    comment: annotationCommentText(item),
    suggested_change: item.suggestedChange,
    pdf_page: item.pdfAnchor?.page,
    anchor_confidence:
      item.anchorConfidence || (item.texAnchor ? "stable" : "unknown"),
    needs_review: !!item.needsReview,
    needs_review_reason: item.needsReviewReason,
    task_marker: item.taskMarker,
    resolved_at: item.resolvedAt,
    resolved_by: item.resolvedBy,
    resolved_revision: item.resolvedRevision,
    resolution_note: item.resolutionNote,
    created_at: item.createdAt,
    updated_at: item.updatedAt,
  };
}

function serializeReviewItemsJsonl(items: PaperAnnotation[]): string {
  const reviewItems = items
    .slice()
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .map(reviewItemFromAnnotation);
  return (
    reviewItems.map((item) => JSON.stringify(item)).join("\n") +
    (reviewItems.length ? "\n" : "")
  );
}

function serializeReviewSummary(items: PaperAnnotation[]): string {
  const sorted = items
    .slice()
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const open = sorted.filter((item) => item.status === "open").length;
  const resolved = sorted.filter((item) => item.status === "resolved").length;
  const ignored = sorted.filter((item) => item.status === "ignored").length;
  const unstable = sorted.filter(
    (item) => item.anchorConfidence !== "stable" || item.needsReview,
  ).length;
  const lines = [
    "# Paper Review Notes",
    "",
    `- Total: ${sorted.length}`,
    `- Open: ${open}`,
    `- Resolved: ${resolved}`,
    `- Ignored: ${ignored}`,
    `- Needs review / unstable anchor: ${unstable}`,
    "",
    "> This file is generated from `.paper-notes/annotations.jsonl`. For AI-assisted editing, prefer `.paper-notes/review-items.jsonl` because it contains file, line, selected text, context, and comments.",
    "",
  ];
  for (const item of sorted) {
    const file = item.texAnchor?.file || item.documentPath || "unknown file";
    const line = item.texAnchor?.line
      ? `:${item.texAnchor.line}${item.texAnchor.lineEnd && item.texAnchor.lineEnd !== item.texAnchor.line ? `-${item.texAnchor.lineEnd}` : ""}`
      : "";
    const quote =
      item.selectedText ||
      item.pdfAnchor?.textQuote ||
      item.texAnchor?.sourceText ||
      item.sourceText;
    lines.push(
      `## ${item.status.toUpperCase()} · ${item.type} · ${file}${line}`,
    );
    lines.push("");
    if (item.anchorConfidence !== "stable" || item.needsReview) {
      lines.push(
        `> ⚠️ Anchor: ${item.anchorConfidence || "unknown"}${item.needsReviewReason ? ` · ${item.needsReviewReason}` : ""}`,
      );
      lines.push("");
    }
    if (quote) {
      lines.push("```tex");
      lines.push(quote.trim());
      lines.push("```");
      lines.push("");
    }
    lines.push(annotationCommentText(item) || "无正文");
    lines.push("");
  }
  return lines.join("\n");
}

function serializeAnnotationExportMarkdown(
  items: PaperAnnotation[],
  title = "当前文件批注",
): string {
  const sorted = items
    .slice()
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const lines = [
    `# ${title}`,
    "",
    `- 导出时间：${new Intl.DateTimeFormat("zh-CN", { dateStyle: "medium", timeStyle: "short" }).format(new Date())}`,
    `- 批注数量：${sorted.length}`,
    "",
  ];
  for (const item of sorted) {
    const file =
      item.texAnchor?.file ||
      item.markdownAnchor?.file ||
      item.documentPath ||
      "未知文件";
    const line = item.texAnchor?.line
      ? `:${item.texAnchor.line}${item.texAnchor.lineEnd && item.texAnchor.lineEnd !== item.texAnchor.line ? `-${item.texAnchor.lineEnd}` : ""}`
      : item.pdfAnchor?.page
        ? ` · PDF 第 ${item.pdfAnchor.page} 页`
        : "";
    const quote =
      item.selectedText ||
      item.markdownAnchor?.textQuote ||
      item.pdfAnchor?.textQuote ||
      item.texAnchor?.sourceText ||
      item.sourceText;
    lines.push(
      `## ${item.status === "open" ? "未处理" : item.status === "resolved" ? "已解决" : "忽略"} · ${file}${line}`,
    );
    lines.push("");
    if (quote) {
      lines.push("> 选中内容：");
      lines.push("");
      lines.push("```");
      lines.push(quote.trim());
      lines.push("```");
      lines.push("");
    }
    const messages = threadMessages(item);
    if (!messages.length) {
      lines.push("无评论内容。", "");
      continue;
    }
    messages.forEach((message, index) => {
      const author = message.author || "未知用户";
      const time = message.updatedAt || message.createdAt;
      const prefix =
        index === 0
          ? `${author} 评论`
          : `${author} 回复${message.replyToAuthor ? ` ${message.replyToAuthor}` : ""}`;
      lines.push(`- **${prefix}**（${time}）：${message.body}`);
    });
    lines.push("");
  }
  return lines.join("\n");
}

function serializeAnnotationsJsonl(items: PaperAnnotation[]): string {
  return (
    items
      .slice()
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .map((item) => JSON.stringify(normalizeAnnotationThread(item)))
      .join("\n") + (items.length ? "\n" : "")
  );
}

function csvCell(value: unknown): string {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

function serializeAnnotationsCsv(items: PaperAnnotation[]): string {
  const header = [
    "id",
    "status",
    "type",
    "file",
    "line",
    "anchor_confidence",
    "needs_review",
    "comment",
    "selected_text",
    "resolution_note",
    "updated_at",
  ];
  const rows = items
    .slice()
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .map((item) => [
      item.id,
      item.status,
      item.type,
      item.texAnchor?.file || item.markdownAnchor?.file || item.documentPath || item.pdfAnchor?.pdfPath || "",
      item.texAnchor?.line || item.pdfAnchor?.page || "",
      item.anchorConfidence || "unknown",
      item.needsReview ? "true" : "false",
      annotationCommentText(item),
      item.selectedText || item.markdownAnchor?.textQuote || item.pdfAnchor?.textQuote || item.texAnchor?.sourceText || item.sourceText || "",
      item.resolutionNote || "",
      item.updatedAt,
    ]);
  return [header.map(csvCell).join(","), ...rows.map((row) => row.map(csvCell).join(","))].join("\n") + "\n";
}

function escapeLatexTodo(text: string): string {
  return text
    .replace(/\\/g, "\\textbackslash{}")
    .replace(/[{}]/g, (char) => `\\${char}`)
    .replace(/#/g, "\\#")
    .replace(/%/g, "\\%")
    .replace(/&/g, "\\&")
    .replace(/_/g, "\\_")
    .replace(/\$/g, "\\$")
    .replace(/\^/g, "\\textasciicircum{}")
    .replace(/~/g, "\\textasciitilde{}");
}

function serializeAnnotationsLatexTodos(items: PaperAnnotation[]): string {
  const lines = [
    "% Generated by Scholia Studio. Add \\usepackage{todonotes} in your preamble.",
    "",
  ];
  items
    .slice()
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .forEach((item) => {
      const location = item.texAnchor?.file
        ? `${item.texAnchor.file}${item.texAnchor.line ? `:${item.texAnchor.line}` : ""}`
        : item.documentPath || item.pdfAnchor?.pdfPath || "PDF";
      const body = `${location} · ${annotationCommentText(item) || item.type}`;
      lines.push(`\\todo[inline]{${escapeLatexTodo(body)}}`);
    });
  return lines.join("\n") + "\n";
}

function supportedPathOrDefault(rawPath: string): string {
  const wantsFolder = /[\\/]$/.test(rawPath.trim());
  const normalized = normalizePath(rawPath);
  if (!normalized) return "Untitled.md";
  if (wantsFolder) return `${normalized}/`;
  const name = titleFromPath(normalized);
  const hasExt = /\.[^/.]+$/.test(name);
  if (!hasExt) return `${normalized}.md`;
  const ext = name.split(".").pop()?.toLowerCase() || "";
  if (!COMMON_EXTENSIONS.includes(ext)) {
    const ok = window.confirm(
      `扩展名 .${ext} 不在常用列表中，仍然创建吗？\n常用：${COMMON_EXTENSIONS.map((item) => `.${item}`).join("、")}`,
    );
    if (!ok) throw new Error("已取消创建文件。");
  }
  return normalized;
}

export const useAppStore = defineStore("app", () => {
  const documents = ref<MarkdownDocument[]>([]);
  const activeDocumentId = ref<string>();
  const fileTree = ref<FileNode[]>([]);
  const selectedNodePath = ref<string>();
  const workspace = ref<GitWorkspace>();
  const gitEntries = ref<GitStatusEntry[]>([]);
  const githubToken = ref<string | null>(null);
  const githubLogin = ref<string>("");
  const githubUserHint = ref<string>("");
  const commentAuthorName = ref<string>("");
  const darkMode = ref(true);
  const previewVisible = ref(false);
  const explorerVisible = ref(true);
  const gitPanelVisible = ref(true);
  const busy = ref(false);
  const runningTasks = ref<Record<string, boolean>>({});
  const status = ref("准备就绪");
  const error = ref<string>("");
  const appLogLines = ref<string[]>([]);
  const appLog = computed(() => appLogLines.value.join("\n"));
  const latexResult = ref<LatexBuildResult | null>(null);
  const pdfPreviewUrl = ref<string>("");
  const pdfPreviewPath = ref<string>("");
  const pdfSyncPoint = ref<PdfSyncPoint | null>(null);
  const pdfRenderQuality = ref(0.72);
  const markdownRenderPreset = ref<MarkdownRenderPreset>("default");
  const editorGotoLine = ref<number | null>(null);
  const markdownPreviewLine = ref<number | null>(null);
  const editorCursorLine = ref<number | null>(null);
  const annotations = ref<PaperAnnotation[]>([]);
  const activeAnnotationId = ref<string>();
  const latexIndex = ref<ProjectLatexIndex>(emptyLatexIndex());
  const activeBibPreviewKey = ref<string>();
  const toolPaths = ref<ToolPathSettings>({});
  const environmentChecks = ref<EnvironmentToolCheck[]>([]);
  const layoutSettings = ref<LayoutSettings>(defaultLayoutSettings());
  const projectSettings = ref<ProjectSettings>(defaultProjectSettings());
  const exportProfiles = ref<ExportProfile[]>(defaultExportProfiles());
  const customSnippets = ref<CustomSnippet[]>([]);
  const lastPackageExport = ref<PackageExportResult | null>(null);
  const lastGitSyncResult = ref<GitSyncResult | null>(null);
  const recoveryWarning = ref("");
  const draftCount = ref(0);
  const aiGroundingMode = ref<AiGroundingMode>("evidence_only");
  const aiMessages = ref<AiConversationMessage[]>([]);
  const aiIndexStats = ref<AiIndexStats>(createEmptyAiIndexStats());
  const aiEvidencePack = ref<AiEvidencePack | null>(null);
  const aiProposedPatches = ref<ProposedPatch[]>([]);
  let draftSaveTimer: number | undefined;

  function refreshAiFrameworkIndex() {
    const markdown = documents.value.filter((doc) => doc.kind === "markdown").length;
    const tex = documents.value.filter((doc) => doc.kind === "latex").length;
    const bibtex = documents.value.filter((doc) => doc.kind === "bibtex").length + latexIndex.value.bibFiles.length;
    const pdfAnnotation = annotations.value.length;
    const evidenceIndex = documents.value.filter((doc) => doc.relativePath?.includes("evidence-index")).length;
    const reviewItem = annotations.value.filter((annotation) => annotation.taskMarker || annotation.needsReview).length;
    const total = markdown + tex + bibtex + pdfAnnotation + evidenceIndex + reviewItem;
    aiIndexStats.value = {
      total,
      markdown,
      tex,
      bibtex,
      pdfAnnotation,
      reviewItem,
      evidenceIndex,
      status: "ready",
      indexedAt: new Date().toISOString(),
      message: total ? "已根据当前打开文档和批注建立框架级索引统计。" : "尚未发现可索引证据。",
    };
    return aiIndexStats.value;
  }

  function setAiGroundingMode(mode: AiGroundingMode) {
    aiGroundingMode.value = mode;
  }

  function sendAiFrameworkPrompt(prompt: string) {
    const trimmed = prompt.trim();
    if (!trimmed) return;
    const now = new Date().toISOString();
    const userMessage: AiConversationMessage = {
      id: makeId(),
      role: "user",
      text: trimmed,
      createdAt: now,
    };
    const activePath = activeDocument.value?.relativePath || activeDocument.value?.title;
    const evidence = [
      ...buildDocumentEvidenceSeed(activeDocument.value),
      ...buildAnnotationEvidenceSeed(annotations.value, activePath),
    ];
    aiEvidencePack.value = createEvidencePack({
      mode: aiGroundingMode.value,
      task: trimmed.includes("diff") || trimmed.includes("修改") ? "edit_source" : "answer_question",
      query: trimmed,
      targetFile: activePath,
      evidence,
    });
    const citations = evidence.slice(0, 6).map((item) => ({
      evidenceId: item.id,
      label: item.annotationId
        ? `${item.filePath}#${item.annotationId}`
        : item.bibKey
          ? `${item.filePath}:@${item.bibKey}`
          : `${item.filePath}${item.lineStart ? `:L${item.lineStart}${item.lineEnd && item.lineEnd !== item.lineStart ? `-L${item.lineEnd}` : ""}` : ""}`,
      filePath: item.filePath,
      lineStart: item.lineStart,
      lineEnd: item.lineEnd,
      annotationId: item.annotationId,
      bibKey: item.bibKey,
    }));
    const assistantMessage: AiConversationMessage = {
      id: makeId(),
      role: "assistant",
      createdAt: new Date().toISOString(),
      taskType: aiEvidencePack.value.task,
      text: evidence.length
        ? "已生成 Evidence Pack 框架。正式 AI 接入后，回答会只引用本次证据包中的 evidenceId，并在源码修改前生成 diff。"
        : "当前没有检索到可用证据。只使用证据库模式下，正式 AI 接入后会拒绝编写正文，并列出需要补充的证据。",
      citations,
      missingEvidence: evidence.length ? [] : ["需要先索引 Markdown、TeX、BibTeX、PDF 批注、review-items 或 evidence-index。"],
    };
    aiMessages.value = [...aiMessages.value, userMessage, assistantMessage];
    refreshAiFrameworkIndex();
  }

  function currentAnnotationAuthor() {
    return (
      commentAuthorName.value.trim() || workspace.value?.owner?.trim() || "我"
    );
  }

  async function setCommentAuthorName(value: string) {
    const next = value.trim();
    commentAuthorName.value = next;
    if (workspace.value && !workspace.value.owner) {
      workspace.value = { ...workspace.value, owner: next };
    }
    await persist();
  }

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

  const activeDocument = computed(() =>
    documents.value.find((doc) => doc.id === activeDocumentId.value),
  );
  const selectedNode = computed(() =>
    findNodeByPath(fileTree.value, selectedNodePath.value),
  );
  const activeNodePath = computed(() => displayPathFromRelative(activeDocument.value?.relativePath));
  const dirtyCount = computed(
    () => documents.value.filter((doc) => doc.dirty).length,
  );
  const hasWorkspace = computed(() => !!workspace.value?.localDir);
  const isLatexActive = computed(() => activeDocument.value?.kind === "latex");
  const isMarkdownActive = computed(
    () => activeDocument.value?.kind === "markdown",
  );
  const activeBibPreview = computed<BibEntryItem | undefined>(() =>
    activeBibPreviewKey.value
      ? latexIndex.value.citations.find(
          (item) => item.key === activeBibPreviewKey.value,
        )
      : undefined,
  );

  const activeDocumentDiagnostics = computed(() => {
    const doc = activeDocument.value;
    const displayPath = displayPathFromRelative(doc?.relativePath);
    if (!displayPath || !['latex', 'markdown'].includes(doc?.kind || '')) return [];
    const normalized = normalizePath(displayPath);
    return latexIndex.value.diagnostics.filter((item) => normalizePath(item.file) === normalized);
  });

  const activeWritingStats = computed(() =>
    computeWritingStats(activeDocument.value?.text || '', activeDocument.value?.kind),
  );
  const activeWritingStatsLabel = computed(() =>
    formatWritingStats(activeWritingStats.value),
  );

  function applyLayoutForDocumentKind(kind?: DocumentKind, keepExistingTextPreview = false) {
    if (!kind) return;
    // 图片和 PDF 只能预览；文本文件第一次打开保持编辑优先。
    // 如果用户已经在当前工作区手动打开了预览栏，再切换/打开新的 md/tex 时保留预览，
    // 避免每次打开文件都把右侧预览强制关掉。
    if (["image", "pdf"].includes(kind)) {
      previewVisible.value = true;
    } else if (["markdown", "latex"].includes(kind)) {
      if (!keepExistingTextPreview) previewVisible.value = false;
    } else if (["bibtex", "text"].includes(kind)) {
      previewVisible.value = false;
    }
  }

  function shouldKeepTextPreviewOnNextWorkspaceOpen() {
    return !!(
      previewVisible.value &&
      activeDocument.value?.source === "workspace" &&
      workspace.value?.localDir
    );
  }


  const gitDirtyCount = computed(() => gitEntries.value.length);
  const latexBusy = computed(() => !!runningTasks.value["latex-build"]);
  const gitBusy = computed(
    () =>
      !!runningTasks.value["git-submit"] ||
      !!runningTasks.value["git-clone"] ||
      !!runningTasks.value["git-token"],
  );
  const workspaceBusy = computed(
    () =>
      !!runningTasks.value["workspace-refresh"] ||
      !!runningTasks.value["git-clone"],
  );

  const visibleAnnotations = computed(() => {
    const doc = activeDocument.value;
    const activeRelativePath = doc?.relativePath;
    const activePdf = pdfPreviewPath.value;
    return annotations.value.filter((item) => {
      if (activeRelativePath && item.documentPath === activeRelativePath)
        return true;
      if (activePdf && item.pdfAnchor?.pdfPath === activePdf) return true;
      if (activeRelativePath && item.texAnchor?.file === activeRelativePath)
        return true;
      return false;
    });
  });
  const visiblePdfAnnotations = computed(() =>
    visibleAnnotations.value.filter((item) => item.pdfAnchor),
  );
  const visibleSourceAnnotations = computed(() => [] as PaperAnnotation[]);

  const researchFlowStatuses = computed<ResearchFlowStepStatus[]>(() => {
    const nodes = flattenFileNodes(fileTree.value).filter((node) => node.kind === "file");
    const byPath = new Map(nodes.map((node) => [normalizePath(node.path), node]));
    const settings = projectSettings.value.researchFlowPaths || {};
    const latestUnder = (dir?: string, suffix = ".md") => {
      const prefix = normalizePath(dir || "");
      return nodes
        .filter((node) => node.documentKind === "markdown" && (!prefix || normalizePath(node.path).startsWith(`${prefix}/`)) && node.name.endsWith(suffix))
        .sort((a, b) => normalizePath(b.path).localeCompare(normalizePath(a.path)))[0];
    };
    const daily = latestUnder(settings.dailyDir || "notes/daily");
    const weekly = latestUnder(settings.weeklyDir || "notes/weekly");
    const evidence = byPath.get(normalizePath(settings.evidenceIndex || "research/evidence-index.md"));
    const outline = byPath.get(normalizePath(settings.paperOutline || "paper/paper-outline.md"));
    const review = byPath.get(normalizePath(settings.reviewSummary || ".paper-notes/review-summary.md"));
    const hasOpenReviews = annotations.value.some((item) => item.status === "open");
    return [
      {
        id: "daily",
        label: "每日记录",
        state: daily ? "done" : "ready",
        path: daily?.path,
        detail: daily ? `最近：${daily.path}` : "尚未创建今日/最近每日笔记",
        missing: daily ? [] : ["创建一篇 notes/daily/*.md"],
      },
      {
        id: "weekly",
        label: "周报",
        state: weekly ? "done" : daily ? "ready" : "missing",
        path: weekly?.path,
        detail: weekly ? `最近：${weekly.path}` : "可从每日记录汇总生成",
        missing: weekly ? [] : [daily ? "生成 notes/weekly/*.md" : "先创建每日记录"],
      },
      {
        id: "evidence",
        label: "证据索引",
        state: evidence ? "done" : (daily || annotations.value.length) ? "ready" : "missing",
        path: evidence?.path,
        detail: evidence ? `已建立：${evidence.path}` : "可从笔记、批注、BibTeX、图片提取候选证据",
        missing: evidence ? [] : ["生成 research/evidence-index.md"],
      },
      {
        id: "outline",
        label: "论文大纲",
        state: outline ? "done" : evidence ? "ready" : "missing",
        path: outline?.path,
        detail: outline ? `已建立：${outline.path}` : "可从证据索引生成章节骨架",
        missing: outline ? [] : [evidence ? "生成 paper/paper-outline.md" : "先建立证据索引"],
      },
      {
        id: "review",
        label: "审阅清单",
        state: review ? "done" : hasOpenReviews ? "ready" : "missing",
        path: review?.path,
        detail: review ? `已建立：${review.path}` : hasOpenReviews ? "有未处理批注，可生成审阅清单" : "暂无批注/审阅条目",
        missing: review ? [] : [hasOpenReviews ? "生成 .paper-notes/review-summary.md" : "创建批注"],
      },
    ];
  });

  function appendAppLog(scope: string, message: string, detail?: string) {
    const stamp = new Date().toLocaleString();
    const lines = [`[${stamp}] [${scope}] ${message}`];
    const cleanedDetail = detail?.trim();
    if (cleanedDetail) {
      lines.push(
        ...cleanedDetail
          .split(/\r?\n/)
          .map((line) => `  ${line}`),
      );
    }
    appLogLines.value = [...appLogLines.value, ...lines].slice(-1200);
  }

  function appendPackageLog(scope: string, result: PackageExportResult) {
    appendAppLog(
      scope,
      result.ok ? `完成：${result.outputDir}` : `完成但存在跳过项：${result.outputDir}`,
      [
        `manifest: ${result.manifestPath}`,
        `copied: ${result.copiedFiles.length}`,
        result.copiedFiles.length ? result.copiedFiles.map((file) => `  + ${file}`).join("\n") : "",
        `skipped: ${result.skippedFiles.length}`,
        result.skippedFiles.length ? result.skippedFiles.map((file) => `  - ${file}`).join("\n") : "",
      ].filter(Boolean).join("\n"),
    );
  }

  watch(status, (next) => {
    if (next) appendAppLog("状态", next);
  });

  watch(error, (next) => {
    if (next) appendAppLog("错误", next);
  });

  async function runExclusive<T>(
    key: string,
    label: string,
    action: () => Promise<T>,
  ): Promise<T | undefined> {
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

  function sanitizeDocumentForPersistence(doc: MarkdownDocument): MarkdownDocument | null {
    if (doc.source !== "scratch") return null;
    if (doc.kind === "image" || doc.kind === "pdf") return null;
    const maxChars = projectSettings.value.privacy?.maxPersistedTextChars || MAX_PERSISTED_DOCUMENT_CHARS;
    const textLooksLikeInlineAsset = doc.text.startsWith("data:") && doc.text.length > MAX_INLINE_PREVIEW_CHARS;
    if (textLooksLikeInlineAsset || doc.text.length > maxChars) {
      return {
        ...doc,
        text: `<!-- Scholia Studio 已保护性移除超大草稿内容（${doc.text.length} 字符），避免 appState 卡顿。原工作区文件不会受影响。 -->
`,
        dirty: false,
        lastSavedText: undefined,
      };
    }
    return { ...doc };
  }

  function snapshot(): PersistedAppState {
    // 只持久化轻量状态。工作区文件、图片和 PDF 都能从磁盘重新打开，
    // 不能把它们的全文/base64 data URL 写入 appState，否则 PDF 或图片一旦打开，
    // 之后编辑普通 txt/Markdown 也会因为序列化巨大 JSON 而卡顿。
    const scratchDocuments = documents.value
      .map(sanitizeDocumentForPersistence)
      .filter((doc): doc is MarkdownDocument => !!doc);
    const activeId = scratchDocuments.some(
      (doc) => doc.id === activeDocumentId.value,
    )
      ? activeDocumentId.value
      : scratchDocuments[0]?.id;

    return {
      documents: scratchDocuments,
      activeDocumentId: activeId,
      fileTree: [],
      workspace: workspace.value,
      commentAuthorName: commentAuthorName.value,
      githubLogin: githubLogin.value,
      gitStatus: [],
      editor: {
        darkMode: darkMode.value,
        vimMode: false,
        previewVisible: previewVisible.value,
        explorerVisible: explorerVisible.value,
        gitPanelVisible: gitPanelVisible.value,
        pdfPanelVisible: true,
        pdfRenderQuality: pdfRenderQuality.value,
        markdownRenderPreset: markdownRenderPreset.value,
        toolPaths: toolPaths.value,
      },
      layout: layoutSettings.value,
      projectSettings: projectSettings.value,
      exportProfiles: exportProfiles.value,
      recovery: {
        shutdownClean: false,
        lastStartedAt: Date.now(),
      },
    };
  }

  async function persist() {
    await saveAppState(snapshot());
  }

  async function persistCleanShutdown() {
    await saveAppState({
      ...snapshot(),
      recovery: {
        shutdownClean: true,
        lastStartedAt: Date.now(),
        lastClosedAt: Date.now(),
      },
    });
  }

  async function setLayoutSettings(next: Partial<LayoutSettings>) {
    layoutSettings.value = mergeLayoutSettings({ ...layoutSettings.value, ...next });
    await persist();
  }

  async function setEditorSidePanelWidth(
    panel: keyof LayoutSettings["editorSidePanelWidths"],
    width: number,
  ) {
    layoutSettings.value = mergeLayoutSettings({
      ...layoutSettings.value,
      editorSidePanelWidths: {
        ...layoutSettings.value.editorSidePanelWidths,
        [panel]: Math.round(width),
      },
    });
    await persist();
  }

  async function setToolPath(id: keyof ToolPathSettings, value: string) {
    toolPaths.value = { ...toolPaths.value, [id]: value.trim() || undefined };
    await persist();
  }

  async function runEnvironmentCheck() {
    environmentChecks.value = await checkEnvironment(toolPaths.value);
    const missingRequired = environmentChecks.value.filter((item) => item.required && !item.ok);
    status.value = missingRequired.length
      ? `环境检查完成：${missingRequired.length} 个必需依赖缺失。`
      : "环境检查通过：必需依赖可用。";
    appendAppLog(
      "环境检查",
      status.value,
      environmentChecks.value
        .map((item) => `${item.ok ? "OK" : item.required ? "MISSING" : "WARN"} ${item.label}: ${item.version || item.error || item.command}`)
        .join("\n"),
    );
    await persist();
  }

  async function persistProjectSettings() {
    if (!workspace.value?.localDir) return;
    await writeWorkspaceFile(
      workspace.value.localDir,
      ".paper-notes/project.json",
      `${JSON.stringify(projectSettings.value, null, 2)}\n`,
    );
    await writeWorkspaceFile(
      workspace.value.localDir,
      ".paper-notes/export-profiles.json",
      `${JSON.stringify(exportProfiles.value, null, 2)}\n`,
    );
  }

  async function loadProjectSettings() {
    if (!workspace.value?.localDir) {
      projectSettings.value = defaultProjectSettings();
      exportProfiles.value = defaultExportProfiles();
      customSnippets.value = [];
      return;
    }
    try {
      const content = await readWorkspaceFile(workspace.value.localDir, ".paper-notes/project.json");
      {
        const parsed = JSON.parse(content) as ProjectSettings;
        const defaults = defaultProjectSettings();
        projectSettings.value = {
          ...defaults,
          ...parsed,
          privacy: { ...(defaults.privacy || {}), ...(parsed.privacy || {}) },
          researchFlowPaths: { ...(defaults.researchFlowPaths || {}), ...(parsed.researchFlowPaths || {}) },
          publishing: {
            ...(defaults.publishing || {}),
            ...(parsed.publishing || {}),
            profiles: parsed.publishing?.profiles?.length ? parsed.publishing.profiles : defaults.publishing?.profiles,
          },
          collaboration: { ...(defaults.collaboration || {}), ...(parsed.collaboration || {}) },
        };
        if (parsed.toolPaths) toolPaths.value = { ...toolPaths.value, ...parsed.toolPaths };
        if (parsed.pdfRenderQuality) pdfRenderQuality.value = parsed.pdfRenderQuality;
      }
    } catch {
      projectSettings.value = defaultProjectSettings();
    }
    try {
      const content = await readWorkspaceFile(workspace.value.localDir, ".paper-notes/export-profiles.json");
      const parsed = JSON.parse(content);
      exportProfiles.value = Array.isArray(parsed) ? parsed : defaultExportProfiles();
    } catch {
      exportProfiles.value = defaultExportProfiles();
    }
    try {
      const content = await readWorkspaceFile(workspace.value.localDir, ".paper-notes/snippets.json");
      const parsed = JSON.parse(content);
      customSnippets.value = Array.isArray(parsed) ? parsed : [];
    } catch {
      customSnippets.value = [];
    }
  }

  async function setProjectSetting<K extends keyof ProjectSettings>(key: K, value: ProjectSettings[K]) {
    projectSettings.value = { ...projectSettings.value, [key]: value };
    if (key === "pdfRenderQuality" && typeof value === "number") pdfRenderQuality.value = value;
    if (key === "authorName" && typeof value === "string") commentAuthorName.value = value;
    await persistProjectSettings();
    await persist();
  }

  async function updateResearchFlowPath(key: keyof NonNullable<ProjectSettings["researchFlowPaths"]>, value: string) {
    projectSettings.value = {
      ...projectSettings.value,
      researchFlowPaths: {
        ...(projectSettings.value.researchFlowPaths || {}),
        [key]: value.trim() || undefined,
      },
    };
    await persistProjectSettings();
    await persist();
  }

  async function inferProjectSettingsFromWorkspace() {
    if (!workspace.value?.localDir) return;
    const files = flattenFileNodes(fileTree.value).filter((node) => node.kind === "file");
    const hasTex = files.some((node) => node.documentKind === "latex");
    const hasMarkdown = files.some((node) => node.documentKind === "markdown");
    const hasBib = files.some((node) => node.documentKind === "bibtex");
    const hasPdf = files.some((node) => node.documentKind === "pdf");
    const hasDaily = files.some((node) => normalizePath(node.path).startsWith("notes/daily/"));
    const next: ProjectSettings = {
      ...defaultProjectSettings(),
      ...projectSettings.value,
      researchFlowPaths: {
        ...(defaultProjectSettings().researchFlowPaths || {}),
        ...(projectSettings.value.researchFlowPaths || {}),
      },
    };
    if (!next.mainTexFile && hasTex) {
      next.mainTexFile = latexIndex.value.rootFile || files.find((node) => /(^|\/)main\.tex$/i.test(node.path))?.path || files.find((node) => node.documentKind === "latex")?.path;
    }
    if (!next.mainMarkdownFile && hasMarkdown) {
      next.mainMarkdownFile = files.find((node) => /(^|\/)(paper|manuscript|README)\.md$/i.test(node.path))?.path || files.find((node) => node.documentKind === "markdown")?.path;
    }
    if (workspace.value.localOpenKind === "file") next.projectType = "plain";
    else if (hasTex && (hasBib || latexIndex.value.citations.length)) next.projectType = hasDaily ? "mixed" : "paper";
    else if (hasDaily || files.some((node) => normalizePath(node.path).startsWith("notes/"))) next.projectType = "notes";
    else if (hasPdf && annotations.value.length) next.projectType = "review";
    else next.projectType = hasMarkdown || hasTex ? "plain" : "review";
    projectSettings.value = next;
  }

  async function startGuidedWorkflow(mode: FirstRunMode) {
    projectSettings.value = { ...projectSettings.value, firstRunMode: mode };
    if (mode === "review") {
      await openLocalFile();
      return;
    }
    if (!workspace.value?.localDir) {
      const doc = defaultDocument();
      doc.id = makeId("doc");
      doc.title = mode === "paper" ? "paper-plan.md" : mode === "weekly" ? "weekly-plan.md" : "research-note.md";
      doc.kind = "markdown";
      doc.text = mode === "paper"
        ? "# 论文项目起步\n\n1. 打开或创建本地论文文件夹。\n2. 设置主 TeX / 主 Markdown 文件。\n3. 从每日记录沉淀证据索引。\n"
        : mode === "weekly"
          ? "# 周报起步\n\n- 本周完成：\n- 证据沉淀：\n- 风险：\n- 下周计划：\n"
          : "# 研究记录起步\n\n## 工作记录\n- \n\n## 可能进入论文的结论\n- \n";
      documents.value = [doc];
      activeDocumentId.value = doc.id;
      status.value = "已创建引导草稿；也可以打开示例工作区快速体验完整流程。";
      await persist();
      return;
    }
    if (mode === "paper") await createPaperOutline();
    else if (mode === "weekly") await createWeeklyReport();
    else await createDailyNote();
  }

  async function openSampleWorkspace() {
    const dir = await createSampleWorkspace();
    const cleaned = stripTrailingSeparators(dir);
    workspace.value = {
      source: "local",
      localOpenKind: "folder",
      owner: commentAuthorName.value.trim(),
      repo: "sample-workspace",
      branch: "",
      localDir: cleaned,
      rootPath: "",
    };
    selectedNodePath.value = undefined;
    gitEntries.value = [];
    clearWorkspaceDocumentsForNewRoot();
    await loadProjectSettings();
    await loadAnnotations();
    await refreshWorkspace();
    const main = projectSettings.value.mainMarkdownFile || projectSettings.value.mainTexFile;
    const node = main ? findNodeByPath(fileTree.value, main) : findFirstFileNode(fileTree.value);
    if (node) await openWorkspaceFile(node);
    status.value = `已打开示例工作区：${cleaned}`;
    await persistProjectSettings();
    await persist();
  }

  function latestResearchNode(id: ResearchFlowStepStatus["id"]): FileNode | undefined {
    const current = researchFlowStatuses.value.find((item) => item.id === id);
    return current?.path ? findNodeByPath(fileTree.value, current.path) : undefined;
  }

  async function openResearchFlowEntry(id: ResearchFlowStepStatus["id"]) {
    const node = latestResearchNode(id);
    if (node) {
      await openWorkspaceFile(node);
      return;
    }
    if (id === "daily") await createDailyNote();
    else if (id === "weekly") await createWeeklyReport();
    else if (id === "evidence") await createEvidenceIndex();
    else if (id === "outline") await createPaperOutline();
    else await openReviewSummary();
  }

  function recentResearchContext() {
    const activePath = activeDocument.value?.relativePath || activeDocument.value?.title || "未打开";
    const currentAnnotations = annotations.value
      .filter((item) => item.status === "open" && (item.documentPath === activeDocument.value?.relativePath || item.texAnchor?.file === activeDocument.value?.relativePath))
      .slice(0, 8)
      .map((item) => `${item.texAnchor?.file || item.documentPath || "PDF"}${item.texAnchor?.line ? `:${item.texAnchor.line}` : item.pdfAnchor?.page ? ` 第 ${item.pdfAnchor.page} 页` : ""} — ${annotationCommentText(item).split(/\n/)[0] || item.type}`);
    const recentFigures = flattenFileNodes(fileTree.value)
      .filter((node) => node.kind === "file" && node.documentKind === "image")
      .slice(0, 8)
      .map((node) => node.path);
    const recentBib = latexIndex.value.citations
      .slice(0, 8)
      .map((item) => `${item.key} (${item.file}:${item.line})`);
    return { activePath, currentAnnotations, recentFigures, recentBib };
  }

  function extractBulletsByHeading(markdown: string, heading: string) {
    const lines = markdown.replace(/\r\n/g, "\n").split("\n");
    const start = lines.findIndex((line) => line.trim().replace(/^#+\s*/, "") === heading);
    if (start < 0) return [] as string[];
    const result: string[] = [];
    for (let index = start + 1; index < lines.length; index += 1) {
      const line = lines[index];
      if (/^#{1,3}\s+/.test(line)) break;
      if (/^\s*[-*+]\s+/.test(line) && !line.includes("[ ]")) result.push(line.replace(/^\s*[-*+]\s+/, "").trim());
    }
    return result.filter(Boolean).slice(0, 12);
  }

  async function readMarkdownCandidates(prefixes: string[]) {
    if (!workspace.value?.localDir) return [] as Array<{ path: string; text: string }>;
    const nodes = flattenFileNodes(fileTree.value)
      .filter((node) => node.kind === "file" && node.documentKind === "markdown" && prefixes.some((prefix) => node.path.startsWith(prefix)))
      .sort((a, b) => b.path.localeCompare(a.path))
      .slice(0, 20);
    const items: Array<{ path: string; text: string }> = [];
    for (const node of nodes) {
      try {
        items.push({ path: node.path, text: await readWorkspaceFile(workspace.value.localDir, makeRelativePath(node.path)) });
      } catch {}
    }
    return items;
  }

  async function generateWeeklyReportContent(weekLabel: string) {
    const dailyNotes = await readMarkdownCandidates(["notes/daily/"]);
    const done = dailyNotes.flatMap((item) => extractBulletsByHeading(item.text, "工作记录").map((line) => `${line}（${item.path}）`));
    const evidence = dailyNotes.flatMap((item) => extractBulletsByHeading(item.text, "可能进入论文的结论").map((line) => `${line}（${item.path}）`));
    const risks = dailyNotes.flatMap((item) => extractBulletsByHeading(item.text, "问题与风险").map((line) => `${line}（${item.path}）`));
    const plans = dailyNotes.flatMap((item) => extractBulletsByHeading(item.text, "明日计划").map((line) => `${line}（${item.path}）`));
    return `---
type: weekly-report
week: ${weekLabel}
project: ${workspace.value?.repo || ''}
source_pattern: notes/daily/*.md
generated_at: ${nowIso()}
---

# ${weekLabel} 周报

## 本周完成

${yamlList(done)}

## 本周关键证据

| 结论 | 证据来源 | 相关文件 | 可进入论文位置 |
| --- | --- | --- | --- |
${evidence.length ? evidence.map((line) => `| ${line} | notes/daily |  |  |`).join("\n") : "|  | notes/daily/ |  |  |"}

## 本周阅读与参考文献

${yamlList(latexIndex.value.citations.slice(0, 10).map((item) => `@${item.key}（${item.file}:${item.line}）`))}

## 论文推进

- 摘要：
- 引言：
- 方法：
- 实验：
- 结果：
- 讨论：

## 风险与待验证内容

${yamlList(risks)}

## 下周计划

${yamlList(plans)}
`;
  }

  async function generateEvidenceIndexContent() {
    const notes = await readMarkdownCandidates(["notes/daily/", "notes/weekly/"]);
    const noteEvidence = notes.flatMap((item) => [
      ...extractBulletsByHeading(item.text, "可能进入论文的结论"),
      ...extractBulletsByHeading(item.text, "本周关键证据"),
    ].map((line) => ({ line, path: item.path }))).slice(0, 40);
    const openAnnotations = annotations.value.filter((item) => item.status === "open").slice(0, 20);
    const images = flattenFileNodes(fileTree.value).filter((node) => node.kind === "file" && node.documentKind === "image").slice(0, 20);
    return `---
type: evidence-index
project: ${workspace.value?.repo || ''}
updated_at: ${nowIso()}
source_pattern:
  - notes/daily/*.md
  - notes/weekly/*.md
  - .paper-notes/review-items.jsonl
---

# 论文证据索引

> 目标：让 AI 和人工审阅都能知道每个论文结论来自哪里，而不是凭空生成。

## 结论与证据矩阵

| 论文结论 / Claim | 证据来源 | 文件 / 数据 / 图表 | 支持文献 | 缺失项 | 状态 |
| --- | --- | --- | --- | --- | --- |
${noteEvidence.length ? noteEvidence.map((item) => `| ${item.line} | 研究记录 | ${item.path} |  | 需要人工校准 | 待验证 |`).join("\n") : "|  | notes/daily/ |  |  |  | 待验证 |"}

## 图表候选

| 图表 | 来源文件 | 对应章节 | 需要补充 |
| --- | --- | --- | --- |
${images.length ? images.map((item) => `| ${item.name} | ${item.path} |  | caption / 引用位置 |`).join("\n") : "|  |  |  |  |"}

## 文献证据

${yamlList(latexIndex.value.citations.slice(0, 30).map((item) => `@${item.key} — ${item.file}:${item.line}`))}

## 批注与审阅证据

${yamlList(openAnnotations.map((item) => `${item.texAnchor?.file || item.documentPath || 'PDF'}${item.texAnchor?.line ? `:${item.texAnchor.line}` : ''} — ${annotationCommentText(item).split(/\n/)[0] || item.type}`))}
`;
  }

  async function generatePaperOutlineContent() {
    let evidence = "";
    if (workspace.value?.localDir) {
      try {
        evidence = await readWorkspaceFile(workspace.value.localDir, "research/evidence-index.md");
      } catch {}
    }
    const claims = evidence
      .split(/\r?\n/)
      .filter((line) => line.startsWith("|") && !line.includes("---") && !line.includes("论文结论"))
      .map((line) => line.split("|")[1]?.trim())
      .filter(Boolean)
      .slice(0, 12);
    return `---
type: paper-outline
project: ${workspace.value?.repo || ''}
evidence_index: research/evidence-index.md
generated_at: ${nowIso()}
---

# 论文大纲

## 题目候选

1. 
2. 
3. 

## 核心问题

- 研究问题：
- 为什么重要：
- 现有方法不足：

## 贡献点

${yamlList(claims.length ? claims.slice(0, 3) : ["贡献点 1", "贡献点 2", "贡献点 3"])}

## 章节结构

### 1. Introduction

- 背景：
- 问题：
- 贡献：
- 证据来源：research/evidence-index.md

### 2. Related Work

- 主题分组：
- 当前 BibTeX 条目数：${latexIndex.value.citations.length}

### 3. Method

- 方法概述：
- 关键公式 / 模块：
- 图示候选：

### 4. Experiments

- 数据集：
- Baseline：
- Ablation：
- 指标：

### 5. Results and Discussion

- 主要结果：
- 失败案例：
- 局限性：

## 待补证据

${yamlList(claims.map((claim) => `${claim}：补充来源、图表或引用`))}
`;
  }

  function scheduleDraftSave(doc: MarkdownDocument) {
    if (!workspace.value?.localDir || doc.source !== "workspace" || !doc.relativePath || !isTextDocumentKind(doc.kind)) return;
    window.clearTimeout(draftSaveTimer);
    const rootDir = workspace.value.localDir;
    const relativePath = doc.relativePath;
    const text = doc.text;
    const kind = doc.kind;
    draftSaveTimer = window.setTimeout(async () => {
      try {
        const key = safeDraftKey(relativePath);
        const draftPath = `.paper-notes/drafts/${key}.draft`;
        const manifestPath = `.paper-notes/drafts/${key}.json`;
        await writeWorkspaceFile(rootDir, draftPath, text);
        const entry = { relativePath, kind, updatedAt: nowIso(), draftPath };
        await writeWorkspaceFile(
          rootDir,
          manifestPath,
          `${JSON.stringify(entry, null, 2)}\n`,
        );
        let index: Array<typeof entry> = [];
        try {
          const indexContent = await readWorkspaceFile(rootDir, ".paper-notes/drafts/index.json");
          const parsed = JSON.parse(indexContent);
          index = Array.isArray(parsed) ? parsed : [];
        } catch {}
        index = [entry, ...index.filter((item) => item.relativePath !== relativePath)].slice(0, 80);
        await writeWorkspaceFile(rootDir, ".paper-notes/drafts/index.json", `${JSON.stringify(index, null, 2)}\n`);
      } catch {
        // 草稿保存不能打断编辑。
      }
    }, 900);
  }

  async function removeDraftForDocument(doc: MarkdownDocument) {
    if (!workspace.value?.localDir || !doc.relativePath) return;
    // 当前后端删除会移动到 .paper-notes/trash；草稿清理失败不影响保存主文件。
    const key = safeDraftKey(doc.relativePath);
    try { await deleteWorkspaceItem(workspace.value.localDir, `.paper-notes/drafts/${key}.draft`); } catch {}
    try { await deleteWorkspaceItem(workspace.value.localDir, `.paper-notes/drafts/${key}.json`); } catch {}
  }

  async function detectRecoverableDrafts(wasCleanShutdown: boolean) {
    draftCount.value = 0;
    recoveryWarning.value = "";
    if (!workspace.value?.localDir || wasCleanShutdown) return;
    let index: Array<{ relativePath: string; draftPath: string; updatedAt?: string }> = [];
    try {
      const content = await readWorkspaceFile(workspace.value.localDir, ".paper-notes/drafts/index.json");
      const parsed = JSON.parse(content);
      index = Array.isArray(parsed) ? parsed : [];
    } catch {}
    draftCount.value = index.length;
    if (index.length) {
      recoveryWarning.value = `检测到上次可能未正常关闭，并发现 ${index.length} 个自动保存草稿；请在 .paper-notes/drafts/index.json 中核对恢复。`;
      status.value = recoveryWarning.value;
    } else {
      recoveryWarning.value = "检测到上次可能未正常关闭，但没有发现可恢复草稿。";
    }
  }

  async function exportDebugBundle() {
    if (!workspace.value?.localDir) throw new Error("请先打开一个本地文件夹或 GitHub 工作区。");
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const base = `.paper-notes/debug-export/${timestamp}`;
    const checks = environmentChecks.value.length
      ? environmentChecks.value
      : await checkEnvironment(toolPaths.value);
    await writeWorkspaceFile(workspace.value.localDir, `${base}/app-state.json`, `${JSON.stringify(snapshot(), null, 2)}\n`);
    await writeWorkspaceFile(workspace.value.localDir, `${base}/environment-check.json`, `${JSON.stringify(checks, null, 2)}\n`);
    await writeWorkspaceFile(workspace.value.localDir, `${base}/build-log.txt`, latexResult.value?.log || "尚无构建日志。\n");
    await writeWorkspaceFile(
      workspace.value.localDir,
      `${base}/system-info.md`,
      [
        "# Scholia Studio Debug Export",
        "",
        `- Time: ${nowIso()}`,
        `- Workspace: ${workspace.value.localDir}`,
        `- Active file: ${activeDocument.value?.relativePath || activeDocument.value?.title || "none"}`,
        `- Status: ${status.value}`,
        `- Error: ${error.value || "none"}`,
        "",
      ].join("\n"),
    );
    status.value = `已导出诊断包：${base}`;
    await refreshWorkspace();
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
    await writeWorkspaceAnnotations(
      workspace.value.localDir,
      serializeAnnotationsJsonl(annotations.value),
    );
    await writeWorkspaceFile(
      workspace.value.localDir,
      ".paper-notes/review-items.jsonl",
      serializeReviewItemsJsonl(annotations.value),
    );
    await writeWorkspaceFile(
      workspace.value.localDir,
      ".paper-notes/review-summary.md",
      serializeReviewSummary(annotations.value),
    );
    await refreshGitStatus();
  }

  function upsertAnnotation(item: PaperAnnotation) {
    const index = annotations.value.findIndex(
      (annotation) => annotation.id === item.id,
    );
    if (index >= 0) {
      annotations.value.splice(index, 1, item);
    } else {
      annotations.value.unshift(item);
    }
    activeAnnotationId.value = item.id;
  }

  async function initialize() {
    busy.value = true;
    error.value = "";
    try {
      const saved = await loadAppState();
      const initial = { ...emptyState(), ...saved } as PersistedAppState;
      const lightweightDocuments = (initial.documents ?? []).filter(
        (doc) =>
          doc.source === "scratch" &&
          doc.kind !== "image" &&
          doc.kind !== "pdf",
      );
      const savedHadDocumentList = Array.isArray(saved.documents);
      documents.value = lightweightDocuments.length
        ? lightweightDocuments
        : savedHadDocumentList
          ? []
          : [defaultDocument()];
      activeDocumentId.value = documents.value.some(
        (doc) => doc.id === initial.activeDocumentId,
      )
        ? initial.activeDocumentId
        : documents.value[0]?.id;
      fileTree.value = [];
      workspace.value = initial.workspace;
      toolPaths.value = initial.editor?.toolPaths || {};
      layoutSettings.value = mergeLayoutSettings(initial.layout);
      {
        const defaults = defaultProjectSettings();
        const savedProject = initial.projectSettings || {};
        projectSettings.value = {
          ...defaults,
          ...savedProject,
          privacy: { ...(defaults.privacy || {}), ...(savedProject.privacy || {}) },
          researchFlowPaths: { ...(defaults.researchFlowPaths || {}), ...(savedProject.researchFlowPaths || {}) },
        };
      }
      exportProfiles.value = initial.exportProfiles?.length ? initial.exportProfiles : defaultExportProfiles();
      const wasCleanShutdown = initial.recovery?.shutdownClean ?? true;
      githubLogin.value = initial.githubLogin || "";
      commentAuthorName.value =
        initial.commentAuthorName || githubLogin.value || initial.workspace?.owner || "";
      if (!commentAuthorName.value.trim()) {
        try {
          commentAuthorName.value = (await currentSystemUsername()) || "";
        } catch {
          commentAuthorName.value = "";
        }
      }
      gitEntries.value = [];
      darkMode.value = initial.editor?.darkMode ?? true;
      previewVisible.value = initial.editor?.previewVisible ?? false;
      explorerVisible.value = initial.editor?.explorerVisible ?? true;
      gitPanelVisible.value = initial.editor?.gitPanelVisible ?? true;
      pdfRenderQuality.value = Math.min(
        1.25,
        Math.max(0.45, initial.editor?.pdfRenderQuality ?? 0.72),
      );
      const savedMarkdownPreset = initial.editor?.markdownRenderPreset;
      markdownRenderPreset.value = ["default", "academic", "compact", "reading", "manuscript"].includes(savedMarkdownPreset || "")
        ? (savedMarkdownPreset as MarkdownRenderPreset)
        : "default";
      githubToken.value = await getSecret(GITHUB_TOKEN_ACCOUNT);
      githubUserHint.value = githubToken.value
        ? githubLogin.value
          ? `已保存 token：${githubLogin.value}`
          : "已保存 token（未验证）"
        : "";
      if (githubToken.value) void refreshSavedGithubTokenProfile();
      if (workspace.value?.localDir) {
        await loadAnnotations();
        await refreshWorkspace();
        await loadProjectSettings();
        await detectRecoverableDrafts(wasCleanShutdown);
      }
      await persist();
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

  function applyGithubProfile(login: string) {
    const normalizedLogin = login.trim();
    if (!normalizedLogin) return;
    githubLogin.value = normalizedLogin;
    // 当前界面里“GitHub 用户名”同时作为默认批注作者。验证 token 后优先使用真实 GitHub login，
    // 用户仍然可以在“作者”页单独改成自己的中文名或其他署名。
    commentAuthorName.value = normalizedLogin;
    if (workspace.value && workspace.value.source !== "local") {
      workspace.value = { ...workspace.value, owner: normalizedLogin };
    }
  }

  async function refreshSavedGithubTokenProfile() {
    if (!githubToken.value) return;
    try {
      const profile = await validateGithubToken(githubToken.value);
      applyGithubProfile(profile.login);
      githubUserHint.value = `已验证：${profile.login}`;
      appendAppLog("GitHub Token", `已验证已保存 token，用户名更新为 ${profile.login}。`);
      await persist();
    } catch (err) {
      githubUserHint.value = githubLogin.value
        ? `已保存 token：${githubLogin.value}（本次验证失败）`
        : "已保存 token（本次验证失败）";
      appendAppLog("GitHub Token", "后台验证失败。", err instanceof Error ? err.message : String(err));
      console.warn("GitHub token background validation failed", err);
    }
  }

  async function setGithubToken(token: string) {
    return runExclusive("git-token", "GitHub token 验证", async () => {
      const trimmed = token.trim();
      if (!trimmed) {
        error.value = "GitHub token 不能为空。";
        status.value = "GitHub token 未保存。";
        return;
      }
      error.value = "";
      status.value = "正在验证 GitHub token…";
      try {
        const profile = await validateGithubToken(trimmed);
        await setSecret(GITHUB_TOKEN_ACCOUNT, trimmed);
        githubToken.value = trimmed;
        applyGithubProfile(profile.login);
        githubUserHint.value = `已验证：${profile.login}`;
        status.value = `GitHub token 已验证并保存，用户名已填入为 ${profile.login}。`;
        appendAppLog("GitHub Token", `验证成功，GitHub 工作区用户名已更新为 ${profile.login}。`);
        await persist();
      } catch (err) {
        error.value = err instanceof Error ? err.message : String(err);
        status.value = "GitHub token 验证失败，未保存新 token。";
        appendAppLog("GitHub Token", "验证失败，未保存新 token。", error.value);
      }
    });
  }

  async function forgetGithubToken() {
    await deleteSecret(GITHUB_TOKEN_ACCOUNT);
    githubToken.value = null;
    githubLogin.value = "";
    githubUserHint.value = "";
    status.value = "已移除 GitHub token。";
    appendAppLog("GitHub Token", "已移除保存的 token 和 GitHub 用户名。");
    await persist();
  }

  async function cloneWorkspace(nextWorkspace: GitWorkspace) {
    return runExclusive("git-clone", "获取/更新", async () => {
      if (!githubToken.value)
        throw new Error("请先粘贴 GitHub Token 并点击“保存凭据”。");
      busy.value = true;
      error.value = "";
      try {
        const normalized = {
          ...normalizeWorkspace(nextWorkspace),
          source: "github" as const,
        };
        if (normalized.owner) commentAuthorName.value = normalized.owner;
        status.value = "正在后台获取/更新仓库，界面仍可继续操作…";
        const output = await cloneOrUpdateRepository(
          normalized,
          githubToken.value,
        );
        appendAppLog("Git", `获取/更新仓库完成：${normalized.owner}/${normalized.repo}#${normalized.branch}`, output);
        workspace.value = normalized;
        status.value = output.trim() || "Git 仓库已准备好，左侧目录树已刷新。";
        await loadAnnotations();
        await refreshWorkspace();
        await loadProjectSettings();
        await persistProjectSettings();
        await persist();
      } catch (err) {
        error.value = err instanceof Error ? err.message : String(err);
        throw err;
      } finally {
        busy.value = false;
      }
    });
  }

  function clearWorkspaceDocumentsForNewRoot() {
    documents.value = documents.value.filter((doc) => doc.source === "scratch");
    if (!documents.value.length) documents.value.push(defaultDocument());
    activeDocumentId.value = documents.value[0]?.id;
    pdfPreviewUrl.value = "";
    pdfPreviewPath.value = "";
    pdfSyncPoint.value = null;
    latexResult.value = null;
  }

  async function openLocalEntry(kind: "folder" | "file") {
    return kind === "folder" ? openLocalFolder() : openLocalFile();
  }

  async function openLocalFolder() {
    const folder = await pickLocalFolder();
    if (!folder) {
      status.value = "已取消打开本地文件夹。";
      return;
    }
    busy.value = true;
    error.value = "";
    try {
      const cleaned = stripTrailingSeparators(folder);
      workspace.value = {
        source: "local",
        localOpenKind: "folder",
        localFileName: undefined,
        owner: commentAuthorName.value.trim(),
        repo: baseNameOfPath(cleaned),
        branch: "",
        localDir: cleaned,
        rootPath: "",
      };
      selectedNodePath.value = undefined;
      gitEntries.value = [];
      clearWorkspaceDocumentsForNewRoot();
      await loadAnnotations();
      await refreshWorkspace();
      await loadProjectSettings();
      await persistProjectSettings();
      const preferredPath = projectSettings.value.mainMarkdownFile || projectSettings.value.mainTexFile;
      const first = preferredPath ? findNodeByPath(fileTree.value, preferredPath) || findFirstFileNode(fileTree.value) : findFirstFileNode(fileTree.value);
      if (first) {
        await openWorkspaceFile(first);
      } else {
        status.value = `已打开本地文件夹：${cleaned}`;
      }
      await persist();
    } finally {
      busy.value = false;
    }
  }

  async function openLocalFile() {
    const file = await pickLocalFile();
    if (!file) {
      status.value = "已取消打开本地文件。";
      return;
    }
    busy.value = true;
    error.value = "";
    try {
      const cleanedFile = file.replace(/\\/g, "/");
      const folder = parentDirOfAbsolutePath(cleanedFile);
      const name = baseNameOfPath(cleanedFile);
      workspace.value = {
        source: "local",
        localOpenKind: "file",
        localFileName: name,
        owner: commentAuthorName.value.trim(),
        repo: name,
        branch: "",
        localDir: folder,
        rootPath: "",
      };
      gitEntries.value = [];
      clearWorkspaceDocumentsForNewRoot();
      await loadAnnotations();
      await loadProjectSettings();
      await persistProjectSettings();
      fileTree.value = [singleFileNodeFromName(name)];
      selectedNodePath.value = name;
      await openWorkspaceFile(singleFileNodeFromName(name));
      status.value = `已打开本地文件：${cleanedFile}`;
      await persist();
    } finally {
      busy.value = false;
    }
  }

  async function refreshWorkspace() {
    if (!workspace.value?.localDir) return;
    return runExclusive("workspace-refresh", "刷新工作区", async () => {
      await loadAnnotations();
      if (
        workspace.value?.source === "local" &&
        workspace.value.localOpenKind === "file"
      ) {
        const name = workspace.value.localFileName;
        fileTree.value = name ? [singleFileNodeFromName(name)] : [];
      } else {
        fileTree.value = await listWorkspaceFiles(
          workspace.value!.localDir,
          workspace.value!.rootPath || "",
        );
      }
      if (
        selectedNodePath.value &&
        !findNodeByPath(fileTree.value, selectedNodePath.value)
      )
        selectedNodePath.value = undefined;
      await refreshGitStatus();
      await refreshLatexIndex();
      await inferProjectSettingsFromWorkspace();
      await persistProjectSettings();
      await persist();
    });
  }

  async function refreshLatexIndex() {
    if (!workspace.value?.localDir) {
      latexIndex.value = emptyLatexIndex();
      return;
    }
    const activeTextByPath = new Map<string, string>();
    for (const doc of documents.value) {
      const display = displayPathFromRelative(doc.relativePath);
      if (display && ["latex", "bibtex", "markdown"].includes(doc.kind)) {
        activeTextByPath.set(display, doc.text);
      }
    }
    latexIndex.value = await buildProjectLatexIndex({
      fileTree: fileTree.value,
      activeTextByPath,
      readFile: async (displayPath: string) =>
        readWorkspaceFile(
          workspace.value!.localDir,
          makeRelativePath(displayPath),
        ),
    });
  }

  async function refreshGitStatus() {
    if (!workspace.value?.localDir) return;
    if (workspace.value.source === "local") {
      gitEntries.value = [];
      return;
    }
    try {
      gitEntries.value = await gitStatus(workspace.value.localDir);
    } catch {
      // 普通本地目录可能不是 Git 仓库。这里不把 Git 状态失败当作编辑/批注错误。
      gitEntries.value = [];
    }
  }

  function setActiveDocument(id: string) {
    activeDocumentId.value = id;
    editorCursorLine.value = 1;
    const displayPath = activeNodePath.value;
    if (displayPath && findNodeByPath(fileTree.value, displayPath)) {
      selectedNodePath.value = displayPath;
    }
    persist().catch(() => undefined);
  }

  function setEditorCursorLine(line?: number | null) {
    editorCursorLine.value = line || null;
  }

  function updateAnchorsForDocument(doc: MarkdownDocument): boolean {
    if (!doc.relativePath || !["latex", "markdown"].includes(doc.kind)) return false;
    const lines = doc.text.replace(/\r\n/g, "\n").split("\n");
    let changed = false;
    for (const item of annotations.value) {
      const anchor = item.texAnchor;
      if (!anchor || normalizePath(anchor.file) !== normalizePath(doc.relativePath)) continue;
      const quote = (anchor.sourceText || item.sourceText || "").trim();
      if (!quote) continue;
      const start = Math.max(1, anchor.line || 1);
      const end = Math.max(start, anchor.lineEnd || start);
      const current = lines.slice(start - 1, end).join("\n").trim();
      if (current.includes(quote) || quote.includes(current)) {
        if (item.anchorConfidence !== "stable" || item.needsReview) {
          item.anchorConfidence = "stable";
          item.needsReview = false;
          item.needsReviewReason = undefined;
          item.updatedAt = nowIso();
          changed = true;
        }
        continue;
      }
      const full = doc.text;
      const index = full.indexOf(quote);
      if (index >= 0) {
        const nextLine = lineNumberAtOffset(full, index);
        const nextEnd = lineNumberAtOffset(full, index + quote.length);
        if (anchor.line !== nextLine || anchor.lineEnd !== nextEnd || item.anchorConfidence !== "stable") {
          anchor.line = nextLine;
          anchor.lineEnd = nextEnd;
          item.anchorConfidence = "stable";
          item.needsReview = false;
          item.needsReviewReason = undefined;
          item.updatedAt = nowIso();
          changed = true;
        }
      } else if (item.anchorConfidence !== "unstable" || !item.needsReview) {
        item.anchorConfidence = "unstable";
        item.needsReview = true;
        item.needsReviewReason = "源码已变更，原始选中文本无法在当前文件中自动匹配；需要人工校准锚点。";
        item.updatedAt = nowIso();
        changed = true;
      }
    }
    return changed;
  }

  function updateActiveText(text: string) {
    const doc = activeDocument.value;
    if (!doc || doc.text === text) return;
    doc.text = text;
    doc.updatedAt = Date.now();
    // 不再每个按键对全文做 hash。大文件中 hash 是明显的 O(n) 主线程开销。
    // 简化为“编辑后置脏”，保存时再清除。
    if (!doc.dirty) doc.dirty = true;
    scheduleDraftSave(doc);
  }

  function updateDocumentText(id: string, text: string) {
    const doc = documents.value.find((item) => item.id === id);
    if (!doc || doc.text === text) return;
    doc.text = text;
    doc.updatedAt = Date.now();
    if (!doc.dirty) doc.dirty = true;
    scheduleDraftSave(doc);
    if (["latex", "markdown", "bibtex"].includes(doc.kind)) {
      void refreshLatexIndex();
    }
  }

  function makeRelativePath(path: string): string {
    const root = workspace.value?.rootPath
      ? normalizePath(workspace.value.rootPath)
      : "";
    const normalized = normalizePath(path);
    return root ? `${root}/${normalized}` : normalized;
  }

  function displayPathFromRelative(relativePath?: string): string | undefined {
    if (!relativePath) return undefined;
    const root = workspace.value?.rootPath
      ? normalizePath(workspace.value.rootPath)
      : "";
    if (root && relativePath.startsWith(`${root}/`))
      return relativePath.slice(root.length + 1);
    return relativePath;
  }

  async function previewExistingPdfForTex(
    relativePath: string,
    expectedDocumentId?: string,
    expectedOpenRequestId?: number,
  ) {
    if (
      !workspace.value?.localDir ||
      !isLatestOpenRequest(expectedOpenRequestId)
    )
      return;
    try {
      const pdfPath = await findLatexPdf(
        workspace.value.localDir,
        relativePath,
      );
      if (
        !isLatestOpenRequest(expectedOpenRequestId) ||
        (expectedDocumentId && activeDocumentId.value !== expectedDocumentId)
      )
        return;
      if (!pdfPath) {
        pdfPreviewUrl.value = "";
        pdfPreviewPath.value = "";
        pdfSyncPoint.value = null;
        status.value = `已打开：${relativePath}。未找到同名 PDF，按 Ctrl/Cmd+B 构建。`;
        return;
      }
      await loadPdfPreview(pdfPath, false, expectedOpenRequestId);
      if (
        !isLatestOpenRequest(expectedOpenRequestId) ||
        (expectedDocumentId && activeDocumentId.value !== expectedDocumentId)
      )
        return;
      status.value = `已打开：${relativePath}，右侧显示已有 PDF。`;
    } catch (err) {
      if (
        !isLatestOpenRequest(expectedOpenRequestId) ||
        (expectedDocumentId && activeDocumentId.value !== expectedDocumentId)
      )
        return;
      pdfPreviewUrl.value = "";
      pdfPreviewPath.value = "";
      error.value = err instanceof Error ? err.message : String(err);
    }
  }

  async function openWorkspaceFile(node: FileNode) {
    const requestId = nextOpenRequest();
    selectedNodePath.value = node.path;
    if (node.kind !== "file") return;
    if (!workspace.value?.localDir) throw new Error("请先设置本地工作区。");

    busy.value = true;
    error.value = "";
    status.value = `正在打开：${node.path}`;

    try {
      const keepTextPreview = shouldKeepTextPreviewOnNextWorkspaceOpen();
      const relativePath = makeRelativePath(node.path);
      const absolutePath = `${workspace.value.localDir.replace(/[\\/]$/, "")}/${relativePath}`;

      if (node.documentKind === "pdf") {
        const text = await readFileDataUrl(absolutePath);
        if (!isLatestOpenRequest(requestId)) return;

        const existing = documents.value.find(
          (doc) =>
            doc.relativePath === relativePath && doc.source === "workspace",
        );
        if (existing) {
          existing.text = text;
          existing.lastSavedText = text;
          existing.dirty = false;
          existing.updatedAt = Date.now();
          existing.kind = "pdf";
          existing.absolutePath = absolutePath;
          activeDocumentId.value = existing.id;
          applyLayoutForDocumentKind(existing.kind, keepTextPreview);
        } else {
          const doc: MarkdownDocument = {
            id: makeId("file"),
            title: titleFromPath(node.path),
            text,
            source: "workspace",
            kind: "pdf",
            relativePath,
            absolutePath,
            dirty: false,
            lastSavedText: text,
            updatedAt: Date.now(),
          };
          documents.value.unshift(doc);
          activeDocumentId.value = doc.id;
          applyLayoutForDocumentKind(doc.kind, keepTextPreview);
        }
        if (!isLatestOpenRequest(requestId)) return;
        pdfPreviewUrl.value = text;
        pdfPreviewPath.value = absolutePath;
        pdfSyncPoint.value = null;
        status.value = `已预览 PDF：${relativePath}`;
        await persist();
        return;
      }

      const text =
        node.documentKind === "image"
          ? await readWorkspaceDataUrl(
              workspace.value.localDir,
              relativePath,
              node.name,
            )
          : await readWorkspaceFile(workspace.value.localDir, relativePath);
      if (!isLatestOpenRequest(requestId)) return;

      const existing = documents.value.find(
        (doc) =>
          doc.relativePath === relativePath && doc.source === "workspace",
      );
      if (existing) {
        existing.text = text;
        existing.lastSavedText = text;
        existing.dirty = false;
        existing.updatedAt = Date.now();
        existing.kind = node.documentKind;
        existing.absolutePath = absolutePath;
        activeDocumentId.value = existing.id;
        applyLayoutForDocumentKind(existing.kind, keepTextPreview);
      } else {
        const doc: MarkdownDocument = {
          id: makeId("file"),
          title: titleFromPath(node.path),
          text,
          source: "workspace",
          kind: node.documentKind,
          relativePath,
          absolutePath,
          dirty: false,
          lastSavedText: text,
          updatedAt: Date.now(),
        };
        documents.value.unshift(doc);
        activeDocumentId.value = doc.id;
        applyLayoutForDocumentKind(doc.kind, keepTextPreview);
      }

      latexResult.value = null;
      pdfSyncPoint.value = null;
      if (node.documentKind === "latex") {
        pdfPreviewUrl.value = "";
        pdfPreviewPath.value = "";
        status.value = `已打开：${relativePath}，正在查找已有 PDF…`;
        const expected = activeDocumentId.value;
        void previewExistingPdfForTex(relativePath, expected, requestId);
      } else {
        pdfPreviewUrl.value = "";
        pdfPreviewPath.value = "";
        status.value =
          node.documentKind === "image"
            ? `已预览图片：${relativePath}`
            : `已打开：${relativePath}`;
      }
      if (["latex", "bibtex"].includes(node.documentKind)) {
        await refreshLatexIndex();
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
    if (doc.kind === "image" || doc.kind === "pdf")
      throw new Error("图片/PDF 不能在文本编辑器中保存。");
    if (!workspace.value?.localDir)
      throw new Error("请先获取 GitHub 仓库，或打开本地文件夹/文件。");
    if (!doc.relativePath) {
      const defaultName =
        doc.kind === "latex"
          ? "Untitled.tex"
          : doc.kind === "text"
            ? "Untitled.txt"
            : "Untitled.md";
      const target = window.prompt(
        "输入工作区内的相对路径，例如 notes/new.md、paper/main.tex、draft.txt",
        defaultName,
      );
      if (!target) return;
      doc.relativePath = makeRelativePath(supportedPathOrDefault(target));
      doc.title = titleFromPath(target);
      doc.source = "workspace";
      doc.kind = kindFromPath(doc.relativePath);
    }
    const anchorsChanged = updateAnchorsForDocument(doc);
    await writeWorkspaceFile(
      workspace.value.localDir,
      doc.relativePath,
      doc.text,
    );
    if (anchorsChanged) await saveAnnotations();
    doc.lastSavedText = doc.text;
    doc.dirty = false;
    doc.updatedAt = Date.now();
    status.value = `已保存本地：${doc.relativePath}`;
    await removeDraftForDocument(doc);
    await refreshWorkspace();
    const savedDisplayPath = displayPathFromRelative(doc.relativePath);
    if (savedDisplayPath && findNodeByPath(fileTree.value, savedDisplayPath)) {
      selectedNodePath.value = savedDisplayPath;
    }
    await persist();
  }

  async function newScratchDocument(kind: DocumentKind = "markdown") {
    const extension =
      kind === "latex"
        ? "tex"
        : kind === "bibtex"
          ? "bib"
          : kind === "text"
            ? "txt"
            : "md";
    const title = `Untitled-${documents.value.length + 1}.${extension}`;
    const text = textTemplateForPath(title);
    const doc: MarkdownDocument = {
      id: makeId("scratch"),
      title,
      text,
      source: "scratch",
      kind,
      dirty: true,
      lastSavedText: "",
      updatedAt: Date.now(),
    };
    documents.value.unshift(doc);
    activeDocumentId.value = doc.id;
    applyLayoutForDocumentKind(doc.kind);
    await persist();
  }

  function selectNode(node?: FileNode) {
    selectedNodePath.value = node?.path;
  }

  async function createItemFromPrompt(parent?: FileNode) {
    if (!workspace.value?.localDir)
      throw new Error("请先获取 GitHub 仓库，或打开本地文件夹/文件。");
    const contextNode = parent ?? selectedNode.value;
    const base = targetDirectoryFromNode(contextNode);
    const defaultPath = joinDisplayPath(base, "Untitled.md");
    const raw = window.prompt(
      base
        ? `在 ${base} 下新建。输入文件名或相对路径；文件夹以 / 结尾。`
        : "在根目录下新建。输入文件名或相对路径；文件夹以 / 结尾。",
      defaultPath,
    );
    if (!raw) return;
    const typedAsAbsoluteFromRoot = normalizePath(raw).startsWith(`${base}/`);
    const candidate =
      base && !typedAsAbsoluteFromRoot ? joinDisplayPath(base, raw) : raw;
    const displayPath = supportedPathOrDefault(candidate);
    if (displayPath.endsWith("/")) {
      await createWorkspaceFolder(
        workspace.value.localDir,
        makeRelativePath(displayPath),
      );
      status.value = `已创建文件夹：${displayPath}`;
      await refreshWorkspace();
      selectedNodePath.value = normalizePath(displayPath);
      await persist();
      return;
    }
    const relativePath = makeRelativePath(displayPath);
    await createWorkspaceFile(
      workspace.value.localDir,
      relativePath,
      textTemplateForPath(displayPath),
    );
    status.value = `已创建文件：${relativePath}`;
    await refreshWorkspace();
    const node: FileNode = {
      name: titleFromPath(displayPath),
      path: displayPath,
      kind: "file",
      documentKind: kindFromPath(displayPath),
      children: [],
    };
    selectedNodePath.value = displayPath;
    await openWorkspaceFile(node);
  }

  async function renameItem(node?: FileNode) {
    if (!workspace.value?.localDir)
      throw new Error("请先获取 GitHub 仓库，或打开本地文件夹/文件。");
    const doc = activeDocument.value;
    const oldDisplayPath =
      node?.path || displayPathFromRelative(doc?.relativePath);
    if (!oldDisplayPath) return;
    const next = window.prompt("输入新的相对路径", oldDisplayPath);
    if (!next || next === oldDisplayPath) return;
    const oldRelativePath = makeRelativePath(oldDisplayPath);
    const newDisplayPath =
      node?.kind === "folder"
        ? normalizePath(next)
        : supportedPathOrDefault(next);
    const newRelativePath = makeRelativePath(newDisplayPath);
    await renameWorkspaceItem(
      workspace.value.localDir,
      oldRelativePath,
      newRelativePath,
    );
    documents.value.forEach((item) => {
      if (item.relativePath === oldRelativePath) {
        item.relativePath = newRelativePath;
        item.title = titleFromPath(newRelativePath);
        item.kind = kindFromPath(newRelativePath);
      } else if (
        node?.kind === "folder" &&
        item.relativePath?.startsWith(`${oldRelativePath}/`)
      ) {
        item.relativePath = `${newRelativePath}/${item.relativePath.slice(oldRelativePath.length + 1)}`;
      }
    });
    status.value = `已重命名：${oldRelativePath} → ${newRelativePath}`;
    await refreshWorkspace();
    await persist();
  }

  async function moveItemToTarget(source: FileNode, target?: FileNode) {
    if (!workspace.value?.localDir)
      throw new Error("请先获取 GitHub 仓库，或打开本地文件夹/文件。");
    const targetDir = targetDirectoryFromNode(target);
    if (source.kind === "folder") {
      const sourcePath = normalizePath(source.path);
      if (targetDir === sourcePath || targetDir.startsWith(`${sourcePath}/`)) {
        throw new Error("不能把文件夹移动到它自己或它的子目录中。");
      }
    }
    const newDisplayPath = joinDisplayPath(targetDir, source.name);
    if (normalizePath(newDisplayPath) === normalizePath(source.path)) return;
    const oldRelativePath = makeRelativePath(source.path);
    const newRelativePath = makeRelativePath(newDisplayPath);
    await renameWorkspaceItem(
      workspace.value.localDir,
      oldRelativePath,
      newRelativePath,
    );
    documents.value.forEach((item) => {
      if (item.relativePath === oldRelativePath) {
        item.relativePath = newRelativePath;
        item.title = titleFromPath(newRelativePath);
        item.kind = kindFromPath(newRelativePath);
      } else if (
        source.kind === "folder" &&
        item.relativePath?.startsWith(`${oldRelativePath}/`)
      ) {
        item.relativePath = `${newRelativePath}/${item.relativePath.slice(oldRelativePath.length + 1)}`;
      }
    });
    selectedNodePath.value = normalizePath(newDisplayPath);
    status.value = `已移动：${oldRelativePath} → ${newRelativePath}`;
    await refreshWorkspace();
    await persist();
  }

  async function removeItem(node: FileNode) {
    if (!workspace.value?.localDir)
      throw new Error("请先获取 GitHub 仓库，或打开本地文件夹/文件。");
    const relativePath = makeRelativePath(node.path);
    const ok = window.confirm(
      `确定删除 ${node.kind === "folder" ? "文件夹" : "文件"}？\n${relativePath}`,
    );
    if (!ok) return;
    await deleteWorkspaceItem(workspace.value.localDir, relativePath);
    documents.value = documents.value.filter((doc) => {
      if (!doc.relativePath) return true;
      if (node.kind === "file") return doc.relativePath !== relativePath;
      return !doc.relativePath.startsWith(`${relativePath}/`);
    });
    if (!documents.value.length) documents.value.push(defaultDocument());
    if (!documents.value.find((doc) => doc.id === activeDocumentId.value)) {
      activeDocumentId.value = documents.value[0]?.id;
    }
    if (
      selectedNodePath.value === node.path ||
      (node.kind === "folder" &&
        selectedNodePath.value?.startsWith(`${node.path}/`))
    ) {
      selectedNodePath.value = undefined;
    }
    status.value = `已删除：${relativePath}`;
    await refreshWorkspace();
    await persist();
  }

  async function submitGithub(message?: string) {
    return runExclusive("git-submit", "提交", async () => {
      if (!workspace.value?.localDir)
        throw new Error("请先获取 GitHub 仓库，或打开本地文件夹/文件。");
      if (workspace.value.source === "local")
        throw new Error(
          "当前是本地工作区，不需要 GitHub 提交；请直接保存文件，批注会写入本地 .paper-notes。",
        );
      if (!githubToken.value)
        throw new Error("请先粘贴 GitHub Token 并点击“保存凭据”。");
      const defaultMessage =
        message ||
        window.prompt("Git commit message", "docs: update notes") ||
        "docs: update notes";
      busy.value = true;
      error.value = "";
      try {
        status.value = "正在后台提交并 push，界面仍可继续操作…";
        const output = await commitAndPush(
          workspace.value.localDir,
          workspace.value.branch,
          defaultMessage,
          githubToken.value,
        );
        appendAppLog("Git", `提交并推送完成：${defaultMessage}`, output);
        status.value = output.trim() || "已提交并 push 到 GitHub。";
        await refreshWorkspace();
        documents.value.forEach((doc) => {
          if (doc.source === "workspace" && !doc.dirty)
            doc.lastSavedText = doc.text;
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

  async function loadPdfPreview(
    path?: string | null,
    force = false,
    expectedOpenRequestId?: number,
  ) {
    if (!path || !isLatestOpenRequest(expectedOpenRequestId)) return;
    if (!force && pdfPreviewPath.value === path && pdfPreviewUrl.value) return;
    const requestId = nextPdfPreviewRequest();
    const dataUrl = await readFileDataUrl(path);
    if (
      requestId !== pdfPreviewRequestId ||
      !isLatestOpenRequest(expectedOpenRequestId)
    )
      return;
    pdfPreviewUrl.value = dataUrl;
    pdfPreviewPath.value = path;
    pdfSyncPoint.value = null;
  }


  async function workspaceFileExists(relativePath: string): Promise<boolean> {
    if (!workspace.value?.localDir) return false;
    try {
      await readWorkspaceFile(workspace.value.localDir, relativePath);
      return true;
    } catch {
      return false;
    }
  }

  async function ensureLatexTemplateVendorFiles(texRelativePath: string): Promise<number> {
    if (!workspace.value?.localDir) return 0;
    let tex = "";
    try {
      tex = await readWorkspaceFile(workspace.value.localDir, texRelativePath);
    } catch {
      return 0;
    }
    const lower = tex.toLowerCase();
    const usesIsprsClass = /\\documentclass(?:\[[^\]]*\])?\{isprs\}/i.test(tex);
    if (!usesIsprsClass && !lower.includes("\\bibliographystyle{isprs}")) {
      return 0;
    }
    const dir = parentPathOf(texRelativePath);
    const clsPath = dir ? `${dir}/isprs.cls` : "isprs.cls";
    const bstPath = dir ? `${dir}/isprs.bst` : "isprs.bst";
    let added = 0;
    if (!(await workspaceFileExists(clsPath))) {
      await writeWorkspaceFile(workspace.value.localDir, clsPath, isprsCls.endsWith("\n") ? isprsCls : `${isprsCls}\n`);
      added += 1;
    }
    if (!(await workspaceFileExists(bstPath))) {
      await writeWorkspaceFile(workspace.value.localDir, bstPath, isprsBst.endsWith("\n") ? isprsBst : `${isprsBst}\n`);
      added += 1;
    }
    if (added > 0) {
      status.value = `已为 ISPRS 模板补齐 ${added} 个 vendor 文件。`;
    }
    return added;
  }

  async function buildLatex() {
    return runExclusive("latex-build", "LaTeX 构建", async () => {
      const doc = activeDocument.value;
      if (
        !doc ||
        doc.kind !== "latex" ||
        !doc.relativePath ||
        !workspace.value?.localDir
      ) {
        throw new Error("当前文件不是工作区内的 .tex 文件。");
      }
      await saveActiveLocal();
      error.value = "";
      try {
        const buildForDocumentId = doc.id;
        status.value =
          "LaTeX 正在后台构建当前打开的 TeX 文件，设置/隐藏/切换文件等界面操作不会被锁住…";
        const targetPath = doc.relativePath;
        const repairedVendorFiles = await ensureLatexTemplateVendorFiles(targetPath);
        if (repairedVendorFiles > 0) {
          await refreshWorkspace();
        }
        const result = await buildLatexFile(
          workspace.value.localDir,
          targetPath,
          toolPaths.value,
        );
        appendAppLog(
          "LaTeX/PDF",
          result.ok ? `构建成功：${result.pdfPath || targetPath}` : `构建失败：${targetPath}`,
          `${result.command}\n\n${result.log}`,
        );
        if (activeDocumentId.value !== buildForDocumentId) {
          latexResult.value = result;
          status.value = `LaTeX 构建完成，但当前已切换到其他文件。`;
          return;
        }
        latexResult.value = result;
        status.value = result.ok
          ? `LaTeX 构建成功：${result.pdfPath}`
          : "LaTeX 构建失败，请查看日志。";
        if (result.ok && result.pdfPath) {
          await loadPdfPreview(result.pdfPath, true);
        }
      } catch (err) {
        error.value = err instanceof Error ? err.message : String(err);
        throw err;
      }
    });
  }

  async function buildMarkdownPandoc() {
    return runExclusive("markdown-pandoc-build", "Markdown PDF 构建", async () => {
      const doc = activeDocument.value;
      if (
        !doc ||
        doc.kind !== "markdown" ||
        !doc.relativePath ||
        !workspace.value?.localDir
      ) {
        throw new Error("当前文件不是工作区内的 Markdown 文件。");
      }
      await saveActiveLocal();
      error.value = "";
      try {
        const buildForDocumentId = doc.id;
        status.value = "Pandoc 正在后台将 Markdown 构建为 PDF…";
        const targetPath = projectSettings.value.mainMarkdownFile || doc.relativePath;
        const result = await buildMarkdownPandocFile(
          workspace.value.localDir,
          targetPath,
          toolPaths.value,
        );
        appendAppLog(
          "Markdown/Pandoc",
          result.ok ? `PDF 构建成功：${result.pdfPath || targetPath}` : `PDF 构建失败：${targetPath}`,
          `${result.command}\n\n${result.log}`,
        );
        if (activeDocumentId.value !== buildForDocumentId) {
          latexResult.value = result;
          status.value = "Markdown PDF 构建完成，但当前已切换到其他文件。";
          return;
        }
        latexResult.value = result;
        status.value = result.ok
          ? `Markdown PDF 构建成功：${result.pdfPath}`
          : "Markdown PDF 构建失败，请查看日志。";
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
    if (
      !doc ||
      doc.kind !== "latex" ||
      !doc.relativePath ||
      !workspace.value?.localDir
    ) {
      throw new Error("当前文件不是工作区内的 .tex 文件。");
    }
    const cleanOutput = await cleanLatexFiles(
      workspace.value.localDir,
      doc.relativePath,
    );
    status.value = cleanOutput;
    appendAppLog("LaTeX/PDF", `清理构建产物：${doc.relativePath}`, cleanOutput);
    await refreshWorkspace();
  }

  async function openCurrentPdf() {
    const doc = activeDocument.value;
    if (!doc?.relativePath || !workspace.value?.localDir) return;
    const pdf =
      latexResult.value?.pdfPath ||
      `${workspace.value.localDir.replace(/[\\/]$/, "")}/${doc.relativePath.replace(/\.[^.]+$/, ".pdf")}`;
    await loadPdfPreview(pdf);
    status.value = `已在右侧预览 PDF：${pdf}`;
  }

  function relativeFromAbsolute(input: string): string | undefined {
    if (!workspace.value?.localDir) return undefined;
    const root = workspace.value.localDir
      .replace(/\\/g, "/")
      .replace(/\/+$/, "");
    const normalized = input.replace(/\\/g, "/");
    if (normalized.startsWith(`${root}/`))
      return normalized.slice(root.length + 1);
    return undefined;
  }

  async function openWorkspacePathAtLine(relativePath: string, line: number) {
    if (!workspace.value?.localDir)
      throw new Error("请先获取 GitHub 仓库，或打开本地文件夹/文件。");
    const displayPath = displayPathFromRelative(relativePath) || relativePath;
    const absolutePath = `${workspace.value.localDir.replace(/[\\/]$/, "")}/${relativePath}`;
    const text = await readWorkspaceFile(
      workspace.value.localDir,
      relativePath,
    );

    // 反向 SyncTeX 只应该切换/定位源码，不能走 openWorkspaceFile 的完整打开流程，
    // 否则会清空并重新加载当前 PDF，造成“PDF 自动关闭又重新渲染”的闪烁和卡顿。
    let doc = documents.value.find(
      (item) =>
        item.relativePath === relativePath && item.source === "workspace",
    );
    if (doc) {
      doc.text = text;
      doc.lastSavedText = text;
      doc.dirty = false;
      doc.updatedAt = Date.now();
      doc.kind = kindFromPath(relativePath);
      doc.absolutePath = absolutePath;
    } else {
      doc = {
        id: makeId("file"),
        title: titleFromPath(displayPath),
        text,
        source: "workspace",
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
    setEditorGotoLine(line);
    status.value = `已定位到 ${relativePath}:${line}`;
    await persist();
  }

  function setEditorGotoLine(line: number) {
    const safeLine = Math.max(1, line);
    editorGotoLine.value = null;
    window.setTimeout(() => {
      editorGotoLine.value = safeLine;
    }, 0);
  }

  function setMarkdownPreviewLine(line: number) {
    const safeLine = Math.max(1, line);
    markdownPreviewLine.value = null;
    window.setTimeout(() => {
      markdownPreviewLine.value = safeLine;
    }, 0);
  }

  function syncMarkdownPreviewFromEditor(line: number) {
    const doc = activeDocument.value;
    if (!doc || doc.kind !== "markdown") return;
    setMarkdownPreviewLine(line);
    status.value = `Markdown 预览定位：第 ${Math.max(1, line)} 行`;
  }

  function syncMarkdownEditorFromPreview(line: number) {
    const doc = activeDocument.value;
    if (!doc || doc.kind !== "markdown") return;
    setEditorGotoLine(line);
    status.value = `Markdown 源码定位：第 ${Math.max(1, line)} 行`;
  }

  async function syncTexForwardFromEditor(
    line: number,
    column = 1,
  ): Promise<PdfSyncPoint | undefined> {
    const doc = activeDocument.value;
    if (
      !doc ||
      doc.kind !== "latex" ||
      !doc.relativePath ||
      !workspace.value?.localDir
    )
      return undefined;
    if (!pdfPreviewPath.value) {
      await previewExistingPdfForTex(doc.relativePath, doc.id);
    }
    if (!pdfPreviewPath.value) {
      throw new Error(
        "未找到可用于 SyncTeX 的 PDF。请先按 Ctrl/Cmd+B 构建当前 TeX。",
      );
    }
    const point = await synctexForward(
      workspace.value.localDir,
      doc.relativePath,
      line,
      column,
      toolPaths.value,
    );
    const nextPoint: PdfSyncPoint = { ...point, source: "synctex" };
    if (nextPoint.pdfPath && nextPoint.pdfPath !== pdfPreviewPath.value) {
      await loadPdfPreview(nextPoint.pdfPath);
    }
    pdfSyncPoint.value = { ...nextPoint };
    status.value = `SyncTeX 正向定位：第 ${nextPoint.page} 页`;
    return nextPoint;
  }

  async function syncTexReverseFromPdf(page: number, x: number, y: number) {
    if (!workspace.value?.localDir || !pdfPreviewPath.value) return;
    const source: TexSourcePoint = await synctexReverse(
      workspace.value.localDir,
      pdfPreviewPath.value,
      page,
      x,
      y,
      toolPaths.value,
    );
    const relativePath =
      source.relativePath || relativeFromAbsolute(source.input);
    if (!relativePath)
      throw new Error(`SyncTeX 返回的源文件不在当前工作区：${source.input}`);
    await openWorkspacePathAtLine(relativePath, source.line);
  }

  async function createPdfAnnotation(payload: {
    page: number;
    rect?: PaperAnnotationRect;
    rects?: PaperAnnotationRect[];
    body: string;
    x: number;
    y: number;
    textQuote?: string;
    kind?: "area" | "text" | "highlight";
  }) {
    const doc = activeDocument.value;
    if (!workspace.value?.localDir || !pdfPreviewPath.value)
      throw new Error("需要先打开工作区 PDF。");
    const timestamp = nowIso();
    const isArea = payload.kind === "area" || !payload.kind;
    const isHighlight = payload.kind === "highlight";
    const annotation: PaperAnnotation = {
      id: makeId("ann"),
      type: isHighlight ? "highlight" : isArea ? "area" : "text",
      status: "open",
      body: payload.body,
      messages: [
        makeAnnotationMessage(
          payload.body,
          timestamp,
          currentAnnotationAuthor(),
        ),
      ],
      tags: [],
      documentPath: doc?.relativePath,
      selectedText: payload.textQuote,
      targetType: isArea ? "unknown" : "text",
      anchorConfidence: isArea ? "unstable" : "unknown",
      needsReview: isArea,
      needsReviewReason: isArea
        ? "区域批注主要依赖 PDF 坐标；论文重排后位置可能漂移。系统会尝试绑定源码锚点。"
        : undefined,
      pdfAnchor: {
        pdfPath: pdfPreviewPath.value,
        page: payload.page,
        rects: (payload.rects?.length
          ? payload.rects
          : payload.rect
            ? [payload.rect]
            : []
        ).map(normalizeAnnotationRect),
        textQuote: payload.textQuote,
      },
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    if (!annotation.pdfAnchor?.rects.length)
      throw new Error("没有可保存的 PDF 批注位置。");

    try {
      const source = await synctexReverse(
        workspace.value.localDir,
        pdfPreviewPath.value,
        payload.page,
        payload.x,
        payload.y,
        toolPaths.value,
      );
      const relativePath =
        source.relativePath || relativeFromAbsolute(source.input);
      if (relativePath) {
        const sourceContext = await readWorkspaceFile(
          workspace.value.localDir,
          relativePath,
        ).then((text) => lineRangeForSourceText(text, source.line));
        annotation.texAnchor = {
          file: relativePath,
          line: source.line,
          column: source.column,
          sourceText: sourceContext.sourceText,
          contextBefore: sourceContext.contextBefore,
          contextAfter: sourceContext.contextAfter,
        };
        annotation.documentPath = annotation.documentPath || relativePath;
        annotation.sourceText = sourceContext.sourceText;
        annotation.contextBefore = sourceContext.contextBefore;
        annotation.contextAfter = sourceContext.contextAfter;
        annotation.anchorConfidence = isArea ? "unstable" : "stable";
        annotation.needsReview = isArea;
        annotation.needsReviewReason = isArea
          ? "已绑定到源码行，但区域批注仍是视觉锚点；重排后请复核位置。"
          : undefined;
      }
    } catch {
      annotation.anchorConfidence = "unknown";
      annotation.needsReview = true;
      annotation.needsReviewReason = isArea
        ? "未能建立 SyncTeX 源码锚点；该区域批注只能按 PDF 坐标显示。"
        : "未能建立 SyncTeX 源码锚点；AI 修改时只能参考选中文字和 PDF 页码。";
    }

    upsertAnnotation(annotation);
    await saveAnnotations();
    status.value = annotation.texAnchor
      ? `已创建 ${annotation.type === "area" ? "PDF 区域批注" : "PDF 文字批注"}，并锚定到 ${annotation.texAnchor.file}:${annotation.texAnchor.line}。`
      : `已创建 ${annotation.type === "area" ? "PDF 区域批注" : "PDF 文字批注"}，但没有稳定源码锚点。`;
  }

  async function createMarkdownPreviewAnnotation(payload: {
    selectedText: string;
    rects?: PaperAnnotationRect[];
    body: string;
  }) {
    const doc = activeDocument.value;
    if (
      !workspace.value?.localDir ||
      !doc ||
      doc.kind !== "markdown" ||
      !doc.relativePath
    ) {
      throw new Error("Markdown 预览批注需要打开工作区内的 .md 文件。");
    }
    const selectedText = payload.selectedText.trim();
    if (!selectedText) throw new Error("请先在 Markdown 预览中选中文字。");

    const range = findMarkdownSourceRange(doc.text, selectedText);
    const timestamp = nowIso();
    const annotation: PaperAnnotation = {
      id: makeId("ann"),
      type: "text",
      status: "open",
      body: payload.body,
      messages: [
        makeAnnotationMessage(
          payload.body,
          timestamp,
          currentAnnotationAuthor(),
        ),
      ],
      tags: [],
      documentPath: doc.relativePath,
      selectedText,
      sourceText: range.sourceText,
      contextBefore: range.contextBefore,
      contextAfter: range.contextAfter,
      targetType: "text",
      anchorConfidence: "stable",
      markdownAnchor: {
        file: doc.relativePath,
        rects: (payload.rects || []).map(normalizeAnnotationRect),
        textQuote: selectedText,
        contextBefore: range.contextBefore,
        contextAfter: range.contextAfter,
      },
      texAnchor: {
        file: doc.relativePath,
        line: range.safeStart,
        lineEnd: range.safeEnd,
        column: 1,
        sourceText: range.sourceText,
        contextBefore: range.contextBefore,
        contextAfter: range.contextAfter,
      },
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    upsertAnnotation(annotation);
    await saveAnnotations();
    activeAnnotationId.value = annotation.id;
    status.value = `已创建 Markdown 预览批注：${doc.relativePath}:${range.safeStart}${range.safeEnd !== range.safeStart ? `-${range.safeEnd}` : ""}。`;
  }

  async function createSourceAnnotation(payload?: {
    line?: number;
    lineEnd?: number;
    column?: number;
    columnEnd?: number;
    selectedText?: string;
  }) {
    const doc = activeDocument.value;
    if (
      !workspace.value?.localDir ||
      !doc ||
      !["latex", "markdown"].includes(doc.kind) ||
      !doc.relativePath
    ) {
      throw new Error("源码批注需要打开工作区内的 .tex 或 .md 文件。");
    }
    const defaultLine = payload?.line || editorGotoLine.value || 1;
    const range = lineRangeForSourceText(
      doc.text,
      defaultLine,
      payload?.lineEnd || defaultLine,
    );
    const selectedText = (
      payload?.selectedText ||
      range.sourceText ||
      ""
    ).trim();
    const sourceLabel = doc.kind === "markdown" ? "Markdown" : "TeX";
    const body = window
      .prompt(
        payload?.selectedText
          ? `给选中的 ${sourceLabel} 源码添加批注（${doc.relativePath}:${range.safeStart}-${range.safeEnd}）`
          : `给 ${doc.relativePath}:${range.safeStart} 添加批注`,
        selectedText ? `检查：${selectedText.slice(0, 80)}` : "需要修改这里：",
      )
      ?.trim();
    if (!body) return;
    const timestamp = nowIso();
    const annotation: PaperAnnotation = {
      id: makeId("ann"),
      type: "comment",
      status: "open",
      body,
      messages: [
        makeAnnotationMessage(body, timestamp, currentAnnotationAuthor()),
      ],
      tags: [],
      documentPath: doc.relativePath,
      selectedText,
      sourceText: range.sourceText,
      contextBefore: range.contextBefore,
      contextAfter: range.contextAfter,
      targetType: "source",
      anchorConfidence: "stable",
      texAnchor: {
        file: doc.relativePath,
        line: Math.max(1, range.safeStart),
        lineEnd: Math.max(1, range.safeEnd),
        column: Math.max(1, payload?.column || 1),
        columnEnd: payload?.columnEnd,
        sourceText: range.sourceText,
        contextBefore: range.contextBefore,
        contextAfter: range.contextAfter,
      },
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    if (doc.kind === "latex") {
      try {
        const point = await syncTexForwardFromEditor(
          range.safeStart,
          payload?.column || 1,
        );
        if (point) {
          annotation.pdfAnchor = pdfAnchorFromSyncPoint(
            point,
            pdfPreviewPath.value,
            selectedText || range.sourceText,
          );
          annotation.anchorConfidence = "stable";
          annotation.needsReview = false;
        }
      } catch {
        // 源码批注已经创建；PDF 标注/定位依赖已构建的 SyncTeX。
        annotation.needsReview = true;
        annotation.needsReviewReason =
          "创建源码批注时未能建立 PDF 锚点；请先构建 PDF 并保留 .synctex.gz。";
      }
    }
    upsertAnnotation(annotation);
    await saveAnnotations();
    if (annotation.pdfAnchor?.syncPoint) {
      pdfSyncPoint.value = {
        ...annotation.pdfAnchor.syncPoint,
        annotationId: annotation.id,
        source: "annotation",
      };
    }
    status.value = annotation.pdfAnchor
      ? `已创建源码批注：${doc.relativePath}:${range.safeStart}${range.safeEnd !== range.safeStart ? `-${range.safeEnd}` : ""}，并在 PDF 中建立对应标注。`
      : doc.kind === "markdown"
        ? `已创建 Markdown 批注：${doc.relativePath}:${range.safeStart}${range.safeEnd !== range.safeStart ? `-${range.safeEnd}` : ""}。`
        : `已创建源码批注：${doc.relativePath}:${range.safeStart}${range.safeEnd !== range.safeStart ? `-${range.safeEnd}` : ""}，但未能建立 PDF 标注。`;
  }

  async function updateAnnotationStatus(payload: {
    id: string;
    status: PaperAnnotationStatus;
    resolutionNote?: string;
  }) {
    const item = annotations.value.find(
      (annotation) => annotation.id === payload.id,
    );
    if (!item) return;
    const previousStatus = item.status;
    item.status = payload.status;
    item.updatedAt = nowIso();
    if (payload.status === "resolved" && previousStatus !== "resolved") {
      const note = payload.resolutionNote ?? window.prompt("记录这条批注的解决说明（可留空）：", item.resolutionNote || "") ?? "";
      item.resolvedAt = nowIso();
      item.resolvedBy = currentAnnotationAuthor();
      item.resolutionNote = note.trim() || "已解决，未填写说明。";
      item.resolvedRevision = gitEntries.value.length ? `dirty:${gitEntries.value.length}` : "clean-or-no-git";
      item.needsReview = false;
    }
    if (payload.status !== "resolved") {
      item.resolvedAt = undefined;
      item.resolvedBy = undefined;
      item.resolvedRevision = undefined;
      item.resolutionNote = undefined;
    }
    item.messages = threadMessages(item);
    item.body = item.messages[0]?.body || item.body || "";
    activeAnnotationId.value = item.id;
    await saveAnnotations();
  }

  async function addAnnotationReply(payload: { id: string; body: string }) {
    const item = annotations.value.find(
      (annotation) => annotation.id === payload.id,
    );
    const body = payload.body.trim();
    if (!item || !body) return;
    const timestamp = nowIso();
    const existingMessages = threadMessages(item);
    const firstMessage = existingMessages[0];
    item.messages = [
      ...existingMessages,
      makeAnnotationMessage(
        body,
        timestamp,
        currentAnnotationAuthor(),
        firstMessage,
      ),
    ];
    item.updatedAt = timestamp;
    item.body = item.messages[0]?.body || item.body || "";
    activeAnnotationId.value = item.id;
    await saveAnnotations();
    status.value = "已添加回复。";
  }

  async function updateAnnotationMessage(payload: {
    id: string;
    messageId: string;
    body: string;
  }) {
    const item = annotations.value.find(
      (annotation) => annotation.id === payload.id,
    );
    const body = payload.body.trim();
    if (!item || !body) return;
    const timestamp = nowIso();
    item.messages = threadMessages(item).map((message) =>
      message.id === payload.messageId
        ? { ...message, body, updatedAt: timestamp }
        : message,
    );
    item.body = item.messages[0]?.body || item.body || "";
    item.updatedAt = timestamp;
    activeAnnotationId.value = item.id;
    await saveAnnotations();
    status.value = "已更新评论。";
  }

  async function exportAnnotations(format: AnnotationExportFormat = "markdown") {
    if (!workspace.value?.localDir)
      throw new Error("请先获取/打开一个本地工作区。");
    const doc = activeDocument.value;
    const currentItems = visibleAnnotations.value;
    if (!currentItems.length) {
      throw new Error("当前文件没有可导出的批注。");
    }
    const baseName =
      (doc?.relativePath || doc?.title || "annotations")
        .replace(/\.[^/.]+$/, "")
        .split(/[\/]/)
        .filter(Boolean)
        .join("-")
        .replace(/[<>:"/\\|?*]+/g, "-")
        .replace(/^-+|-+$/g, "") || "annotations";
    const title = `${doc?.relativePath || doc?.title || "当前文件"} 批注`;
    const formatConfig: Record<AnnotationExportFormat, { ext: string; text: string }> = {
      markdown: { ext: "md", text: serializeAnnotationExportMarkdown(currentItems, title) },
      jsonl: { ext: "jsonl", text: serializeAnnotationsJsonl(currentItems) },
      csv: { ext: "csv", text: serializeAnnotationsCsv(currentItems) },
      "latex-todonotes": { ext: "tex", text: serializeAnnotationsLatexTodos(currentItems) },
    };
    const selected = formatConfig[format];
    const savedPath = await saveTextFileWithDialog({
      defaultDir: `${workspace.value.localDir.replace(/[\/]$/, "")}/.paper-notes`,
      defaultFilename: `${baseName}-批注.${selected.ext}`,
      text: selected.text,
    });
    if (!savedPath) {
      status.value = "已取消导出。";
      return;
    }
    status.value = `已导出当前文件批注：${savedPath}`;
    await refreshGitStatus();
  }

  async function exportAnnotationsMarkdown() {
    await exportAnnotations("markdown");
  }

  async function convertAnnotationToTask(id: string) {
    if (!workspace.value?.localDir) throw new Error("请先打开本地工作区。");
    const item = annotations.value.find((annotation) => annotation.id === id);
    if (!item) return;
    const file = item.texAnchor?.file || item.markdownAnchor?.file || item.documentPath;
    if (!file) throw new Error("这条批注没有源码文件锚点，无法转为源码任务。");
    const line = Math.max(1, item.texAnchor?.line || 1);
    const text = await readWorkspaceFile(workspace.value.localDir, file);
    const lines = text.replace(/\r\n/g, "\n").split("\n");
    const comment = annotationCommentText(item).split("\n")[0]?.slice(0, 160) || item.type;
    const marker = kindFromPath(file) === "latex"
      ? `% TODO[${item.id}]: ${comment}`
      : `<!-- TODO[${item.id}]: ${comment} -->`;
    const insertionIndex = Math.min(lines.length, Math.max(0, line - 1));
    if (!lines.some((value) => value.includes(`TODO[${item.id}]`))) {
      lines.splice(insertionIndex, 0, marker);
      const nextText = lines.join("\n");
      await writeWorkspaceFile(workspace.value.localDir, file, nextText);
      const openDoc = documents.value.find((doc) => doc.relativePath === file);
      if (openDoc) {
        openDoc.text = nextText;
        openDoc.lastSavedText = nextText;
        openDoc.dirty = false;
        openDoc.updatedAt = Date.now();
      }
    }
    item.type = "todo";
    item.status = "open";
    item.taskMarker = { file, line, marker };
    item.updatedAt = nowIso();
    activeAnnotationId.value = item.id;
    await saveAnnotations();
    await refreshWorkspace();
    status.value = `已将批注转为源码任务：${file}:${line}`;
  }

  async function removeAnnotation(id: string) {
    const item = annotations.value.find((annotation) => annotation.id === id);
    if (!item) return;
    const ok = window.confirm(
      "确定删除这条批注吗？删除后无法从 JSONL 中恢复。",
    );
    if (!ok) return;
    annotations.value = annotations.value.filter(
      (annotation) => annotation.id !== id,
    );
    if (activeAnnotationId.value === id) activeAnnotationId.value = undefined;
    await saveAnnotations();
    status.value = "已删除批注。";
  }

  async function focusAnnotation(annotation: PaperAnnotation) {
    activeAnnotationId.value = annotation.id;

    // 先确保 TeX 端跳到对应源码。不能为了跳 PDF 重新打开文件，
    // 否则容易触发预览重载并回到第一页。
    if (annotation.texAnchor) {
      await openWorkspacePathAtLine(
        annotation.texAnchor.file,
        annotation.texAnchor.line,
      );
      if (
        annotation.markdownAnchor ||
        annotation.texAnchor.file.toLowerCase().endsWith(".md")
      ) {
        setMarkdownPreviewLine(annotation.texAnchor.line);
      }
    }

    // 再处理 PDF 端。PDF 批注优先用自身保存的 rect/syncPoint，
    // 源码批注如果还没有 PDF 锚点，则即时用 SyncTeX 补建。
    let pdfAnchor = annotation.pdfAnchor;
    if (!pdfAnchor && annotation.texAnchor) {
      try {
        const point = await syncTexForwardFromEditor(
          annotation.texAnchor.line,
          annotation.texAnchor.column || 1,
        );
        if (point) {
          pdfAnchor = pdfAnchorFromSyncPoint(
            point,
            pdfPreviewPath.value,
            annotation.selectedText || annotation.sourceText,
          );
          annotation.pdfAnchor = pdfAnchor;
          annotation.updatedAt = nowIso();
          annotation.anchorConfidence = "stable";
          annotation.needsReview = false;
          await saveAnnotations();
        }
      } catch {
        // 源码跳转已经完成；缺少 PDF/SyncTeX 时不应误跳到第 1 页。
      }
    }

    if (pdfAnchor) {
      const targetPdf = pdfAnchor.pdfPath || pdfAnchor.syncPoint?.pdfPath;
      if (targetPdf) await loadPdfPreview(targetPdf);
      const point = syncPointFromPdfAnchor(pdfAnchor, annotation.id);
      if (point) {
        pdfSyncPoint.value = {
          ...point,
          annotationId: annotation.id,
          source: "annotation",
        };
      }
    }

    activeAnnotationId.value = annotation.id;
  }

  function setActiveBibPreviewKey(key?: string) {
    activeBibPreviewKey.value = key || undefined;
  }

  function defaultBibFile(): string {
    return latexIndex.value.bibFiles[0]?.path || "paper/refs.bib";
  }

  function escapeBibValue(value?: string) {
    return (value || "")
      .replace(/\r?\n/g, " ")
      .replace(/\s+/g, " ")
      .replace(/[{}]/g, "")
      .trim();
  }

  function makeBibEntryRaw(payload: BibEntryPayload) {
    const type = escapeBibValue(payload.type).toLowerCase() || "misc";
    const key = escapeBibValue(payload.key).replace(/\s+/g, "-") || `ref${new Date().getFullYear()}`;
    const fields: Array<[string, string | undefined]> = [
      ["title", payload.title || "Untitled Reference"],
      ["author", payload.author || (type === "misc" ? undefined : "Unknown")],
      ["year", payload.year || String(new Date().getFullYear())],
      ["journal", type === "article" ? (payload.journal || "Unknown Journal") : payload.journal],
      ["booktitle", type === "inproceedings" ? (payload.booktitle || "Unknown Proceedings") : payload.booktitle],
      ["publisher", type === "book" ? (payload.publisher || "Unknown Publisher") : payload.publisher],
      ["doi", payload.doi],
      ["url", payload.url],
      ["note", payload.note],
    ];
    const body = fields
      .map(([name, value]) => [name, escapeBibValue(value)] as const)
      .filter(([, value]) => value)
      .map(([name, value]) => `  ${name} = {${value}}`)
      .join(",\n");
    return `@${type}{${key},\n${body}\n}\n`;
  }

  async function createBibEntry(payload: BibEntryPayload) {
    if (!workspace.value?.localDir) throw new Error("请先打开本地工作区。");
    const file = defaultBibFile();
    const key = escapeBibValue(payload.key).replace(/\s+/g, "-");
    if (!key) throw new Error("BibTeX key 不能为空。");
    let current = "";
    try { current = await readWorkspaceFile(workspace.value.localDir, makeRelativePath(file)); } catch {}
    const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const keyPattern = new RegExp(`@\\w+\\s*\\{\\s*${escapedKey}\\s*,`, "i");
    if (keyPattern.test(current)) throw new Error(`BibTeX key 已存在：${key}`);
    const raw = makeBibEntryRaw({ ...payload, key });
    await writeWorkspaceFile(workspace.value.localDir, makeRelativePath(file), current.replace(/\s*$/, "\n") + raw);
    await refreshWorkspace();
    await refreshLatexIndex();
    status.value = `已新增 BibTeX 条目：${key}`;
  }

  async function updateBibEntryRaw(key: string, payload?: BibEntryPayload) {
    if (!workspace.value?.localDir) throw new Error("请先打开本地工作区。");
    const entry = latexIndex.value.citations.find((item) => item.key === key);
    if (!entry?.file || !entry.raw) throw new Error(`未找到 BibTeX 条目：${key}`);
    const nextRaw = payload ? makeBibEntryRaw(payload).trim() : window.prompt("编辑 BibTeX 原文", entry.raw)?.trim();
    if (!nextRaw) return;
    const text = await readWorkspaceFile(workspace.value.localDir, makeRelativePath(entry.file));
    if (!text.includes(entry.raw)) throw new Error("BibTeX 文件已变化，无法安全替换；请刷新后重试。");
    await writeWorkspaceFile(workspace.value.localDir, makeRelativePath(entry.file), text.replace(entry.raw, nextRaw));
    await refreshLatexIndex();
    status.value = `已更新 BibTeX 条目：${payload?.key || key}`;
  }

  async function removeBibEntry(key: string) {
    if (!workspace.value?.localDir) throw new Error("请先打开本地工作区。");
    const entry = latexIndex.value.citations.find((item) => item.key === key);
    if (!entry?.file || !entry.raw) throw new Error(`未找到 BibTeX 条目：${key}`);
    if (!window.confirm(`确定删除 BibTeX 条目 ${key} 吗？`)) return;
    const text = await readWorkspaceFile(workspace.value.localDir, makeRelativePath(entry.file));
    await writeWorkspaceFile(workspace.value.localDir, makeRelativePath(entry.file), text.replace(entry.raw, "").replace(/\n{3,}/g, "\n\n"));
    await refreshLatexIndex();
    status.value = `已删除 BibTeX 条目：${key}`;
  }

  async function openLatexOutlineItem(item: LatexOutlineItem) {
    await openWorkspacePathAtLine(makeRelativePath(item.file), item.line);
    if (activeDocument.value?.kind === "latex") {
      try {
        await syncTexForwardFromEditor(item.line, 1);
      } catch {
        // 大纲跳转不要求一定有已构建 PDF。
      }
    }
  }

  async function openLatexIndexedPath(displayPath: string) {
    if (!workspace.value?.localDir) return;
    const sourceFile = activeDocument.value?.relativePath ? displayPathFromRelative(activeDocument.value.relativePath) : undefined;
    const path = resolveIndexedFilePath(displayPath, latexIndex.value, sourceFile);
    const node = findNodeByPath(fileTree.value, path) || {
      name: titleFromPath(path),
      path,
      kind: "file" as const,
      documentKind: kindFromPath(path),
      children: [],
    };
    await openWorkspaceFile(node);
  }

  async function jumpToLatexLabel(key: string) {
    const label = latexIndex.value.labels.find((item) => item.key === key);
    if (!label) {
      status.value = `未找到 label：${key}`;
      return;
    }
    await openWorkspacePathAtLine(makeRelativePath(label.file), label.line);
  }

  async function jumpToBibEntry(key: string) {
    const entry = latexIndex.value.citations.find((item) => item.key === key);
    if (!entry) {
      status.value = `未找到 BibTeX 条目：${key}`;
      return;
    }
    activeBibPreviewKey.value = undefined;
    await openWorkspacePathAtLine(makeRelativePath(entry.file), entry.line);
  }


  function exportProfileForFormat(format: ExportProfile["format"]) {
    const requested = projectSettings.value.pandocProfileId || format;
    return exportProfiles.value.find((profile) => profile.id === requested && profile.format === format)
      || exportProfiles.value.find((profile) => profile.format === format)
      || defaultExportProfiles().find((profile) => profile.format === format);
  }

  async function updateExportProfile(profile: ExportProfile) {
    const next = exportProfiles.value.slice();
    const index = next.findIndex((item) => item.id === profile.id);
    if (index >= 0) next[index] = { ...next[index], ...profile };
    else next.push(profile);
    exportProfiles.value = next;
    await persistProjectSettings();
    await persist();
  }

  async function updatePublishProfile(profile: PublishProfile) {
    const current = projectSettings.value.publishing?.profiles || defaultPublishProfiles();
    const next = current.slice();
    const index = next.findIndex((item) => item.id === profile.id);
    if (index >= 0) next[index] = { ...next[index], ...profile };
    else next.push(profile);
    projectSettings.value = {
      ...projectSettings.value,
      publishing: {
        ...(projectSettings.value.publishing || {}),
        activeProfileId: profile.id,
        profiles: next,
      },
    };
    await persistProjectSettings();
    await persist();
  }

  async function saveCustomSnippets(snippets: CustomSnippet[]) {
    customSnippets.value = snippets
      .filter((item) => item.trigger.trim() && item.insert.trim())
      .map((item) => ({ ...item, updatedAt: item.updatedAt || nowIso() }));
    if (workspace.value?.localDir) {
      await writeWorkspaceFile(
        workspace.value.localDir,
        '.paper-notes/snippets.json',
        `${JSON.stringify(customSnippets.value, null, 2)}\n`,
      );
      await refreshWorkspace();
    }
    status.value = `已保存 ${customSnippets.value.length} 个自定义片段。`;
    await persist();
  }

  async function exportMarkdownFormat(format: 'pdf' | 'docx' | 'html' | 'epub' | 'latex' | 'beamer') {
    const doc = activeDocument.value;
    if (!workspace.value?.localDir || !doc?.relativePath || doc.kind !== 'markdown') {
      throw new Error('多格式导出需要打开工作区内的 Markdown 文件。');
    }
    const exportTargetPath = projectSettings.value.mainMarkdownFile || doc.relativePath!;
    const result = await runExclusive('pandoc-export', 'Pandoc 导出', async () => {
      status.value = `正在导出 ${format.toUpperCase()}…`;
      const targetPath = exportTargetPath;
      const profile = exportProfileForFormat(format);
      projectSettings.value = {
        ...projectSettings.value,
        exportProfile: format,
        pandocProfileId: profile?.id || format,
      };
      if (profile) {
        await updateExportProfile({ ...profile, lastUsedAt: nowIso() });
      } else {
        await persistProjectSettings();
      }
      return exportMarkdownPandocFile(workspace.value!.localDir, targetPath, format, toolPaths.value, profile);
    });
    if (!result) return;
    appendAppLog(
      "Pandoc 导出",
      result.ok ? `${format.toUpperCase()} 导出成功：${result.pdfPath || exportTargetPath}` : `${format.toUpperCase()} 导出失败：${exportTargetPath}`,
      `${result.command}\n\n${result.log}`,
    );
    latexResult.value = result;
    if (result.ok) {
      status.value = `已导出：${result.pdfPath || format.toUpperCase()}`;
      if ((format === 'pdf' || format === 'beamer') && result.pdfPath) {
        await loadPdfPreview(result.pdfPath);
      }
    } else {
      status.value = result.log || '已取消导出。';
    }
  }

  async function publishActiveMarkdown(profileId?: string) {
    const doc = activeDocument.value;
    if (!workspace.value?.localDir || !doc?.relativePath || doc.kind !== 'markdown') {
      throw new Error('发布 profile 需要打开工作区内的 Markdown 文件。');
    }
    const profiles = projectSettings.value.publishing?.profiles || defaultPublishProfiles();
    const id = profileId || projectSettings.value.publishing?.activeProfileId || profiles[0]?.id;
    const profile = profiles.find((item) => item.id === id) || profiles[0];
    if (!profile) throw new Error('没有可用的发布 profile。');
    await saveActiveLocal();
    const result = await runExclusive('publish-profile', '发布 profile', async () => {
      status.value = `正在生成 ${profile.name}…`;
      return publishMarkdownProfile(workspace.value!.localDir, doc.relativePath!, profile);
    });
    if (!result) return;
    lastPackageExport.value = result;
    appendPackageLog("发布", result);
    status.value = result.ok ? `已生成发布内容：${result.outputDir}` : `发布内容已生成，但有资源跳过：${result.outputDir}`;
    await refreshWorkspace();
  }

  async function choosePackageExportRoot(label: string) {
    status.value = `请选择${label}的导出位置…`;
    const outputRoot = await pickLocalFolder();
    if (!outputRoot) {
      status.value = `已取消${label}。`;
      return null;
    }
    return outputRoot;
  }

  async function exportSubmissionPackageAction() {
    if (!workspace.value?.localDir) throw new Error('请先打开一个本地文件夹或 GitHub 工作区。');
    const activeRelative = activeDocument.value?.relativePath;
    const activeLatex = activeDocument.value?.kind === 'latex' ? activeRelative : undefined;
    const activeMarkdown = activeDocument.value?.kind === 'markdown' ? activeRelative : undefined;
    const mainTex = activeLatex || projectSettings.value.mainTexFile;
    const mainMarkdown = mainTex ? undefined : (projectSettings.value.mainMarkdownFile || activeMarkdown);
    if (!mainTex && !mainMarkdown) {
      throw new Error('投稿包导出需要打开当前 TeX 文件，或在项目设置中指定主 TeX 文件。');
    }
    await saveActiveLocal();
    const outputRoot = await choosePackageExportRoot('投稿包导出');
    if (!outputRoot) return;
    const result = await runExclusive('submission-package', '投稿包导出', async () => {
      status.value = mainTex ? `正在按依赖收集导出投稿包：${mainTex}…` : `正在导出 Markdown 投稿包：${mainMarkdown}…`;
      return exportSubmissionPackage(
        workspace.value!.localDir,
        mainTex,
        mainMarkdown,
        pdfPreviewPath.value,
        outputRoot,
      );
    });
    if (!result) return;
    lastPackageExport.value = result;
    appendPackageLog("投稿包导出", result);
    status.value = `已导出投稿包：${result.outputDir}`;
    await refreshWorkspace();
  }

  async function exportSharedReviewPackageAction() {
    if (!workspace.value?.localDir) throw new Error('请先打开一个本地文件夹或 GitHub 工作区。');
    const outputRoot = await choosePackageExportRoot('共享审阅包导出');
    if (!outputRoot) return;
    await saveAnnotations();
    const includeResolved = !!projectSettings.value.collaboration?.includeResolvedAnnotations;
    const result = await runExclusive('shared-review-package', '共享审阅包导出', async () => {
      status.value = '正在导出共享审阅包…';
      return exportSharedReviewPackage(workspace.value!.localDir, pdfPreviewPath.value, includeResolved, outputRoot);
    });
    if (!result) return;
    lastPackageExport.value = result;
    appendPackageLog("共享审阅包导出", result);
    status.value = `已导出共享审阅包：${result.outputDir}`;
    await refreshWorkspace();
  }

  async function openExportedPackageFolder(path: string) {
    const target = path?.trim();
    if (!target) return;
    await openTauriPath(target);
    status.value = `已打开导出文件夹：${target}`;
    appendAppLog("导出", `已打开导出文件夹：${target}`);
  }

  async function gitPullWorkspace() {
    if (!workspace.value?.localDir) throw new Error('请先打开 Git 工作区。');
    const result = await runExclusive('git-pull', 'Git Pull', async () => {
      status.value = '正在 pull，并检测冲突…';
      return gitPullWithConflictStatus(workspace.value!.localDir, workspace.value!.branch || 'main', githubToken.value || undefined);
    });
    if (!result) return;
    lastGitSyncResult.value = result;
    appendAppLog(
      "Git Pull",
      result.ok ? "完成" : `完成但存在 ${result.conflictedFiles.length} 个冲突/错误`,
      `${result.command}\n\n${result.log}${result.conflictedFiles.length ? `\n\nConflicts:\n${result.conflictedFiles.join("\n")}` : ""}`,
    );
    status.value = result.ok ? 'Git pull 完成。' : `Git pull 完成但存在 ${result.conflictedFiles.length} 个冲突。`;
    await refreshWorkspace();
  }

  async function gitPushWorkspace() {
    if (!workspace.value?.localDir) throw new Error('请先打开 Git 工作区。');
    const result = await runExclusive('git-push', 'Git Push', async () => {
      status.value = '正在 push 当前分支…';
      return gitPushCurrentBranch(workspace.value!.localDir, workspace.value!.branch || 'main', githubToken.value || undefined);
    });
    if (!result) return;
    lastGitSyncResult.value = result;
    appendAppLog(
      "Git Push",
      result.ok ? "完成" : `未完成：${result.conflictedFiles.length} 个冲突/错误`,
      `${result.command}\n\n${result.log}${result.conflictedFiles.length ? `\n\nConflicts:\n${result.conflictedFiles.join("\n")}` : ""}`,
    );
    status.value = result.ok ? 'Git push 完成。' : `Git push 未完成：${result.conflictedFiles.length} 个冲突/错误。`;
    await refreshGitStatus();
  }


  async function prepareTemplateWorkspace() {
    if (workspace.value?.localDir && workspace.value.localOpenKind !== 'file') return true;
    const folder = await pickLocalFolder();
    if (!folder) {
      status.value = '已取消选择模板目标文件夹。';
      return false;
    }
    const cleaned = stripTrailingSeparators(folder);
    workspace.value = {
      source: 'local',
      localOpenKind: 'folder',
      localFileName: undefined,
      owner: commentAuthorName.value.trim(),
      repo: baseNameOfPath(cleaned),
      branch: '',
      localDir: cleaned,
      rootPath: '',
    };
    selectedNodePath.value = undefined;
    gitEntries.value = [];
    clearWorkspaceDocumentsForNewRoot();
    await loadAnnotations();
    await refreshWorkspace();
    await loadProjectSettings();
    await persistProjectSettings();
    await persist();
    return true;
  }

  async function createProjectFromTemplate(templateId: string) {
    const template = getBuiltinTemplate(templateId);
    if (!template) throw new Error(`未找到模板：${templateId}`);
    busy.value = true;
    error.value = '';
    try {
      const workspaceReady = await prepareTemplateWorkspace();
      if (!workspaceReady || !workspace.value?.localDir) return false;
      const defaultFolder = template.id;
      const rawFolder = window.prompt('输入模板创建目录。留空会取消。', defaultFolder);
      if (!rawFolder) return false;
      const baseFolder = normalizePath(rawFolder).replace(/^\/+|\/+$/g, '');
      if (!baseFolder) return false;
      const targetPaths = template.files.map((file) => `${baseFolder}/${normalizePath(file.path)}`);
      const conflicts = targetPaths.filter((path) => findNodeByPath(fileTree.value, path));
      if (conflicts.length) {
        const ok = window.confirm(
          `模板目标中有 ${conflicts.length} 个同名文件。继续写入前会自动备份到 .paper-notes/backups/template-overwrites，是否继续？\n\n${conflicts.slice(0, 8).join("\n")}`,
        );
        if (!ok) return false;
      }
      const backupStamp = new Date().toISOString().replace(/[:.]/g, '-');
      for (const file of template.files) {
        const displayPath = `${baseFolder}/${normalizePath(file.path)}`;
        const relativePath = makeRelativePath(displayPath);
        if (conflicts.includes(displayPath)) {
          try {
            const oldContent = await readWorkspaceFile(workspace.value.localDir, relativePath);
            await writeWorkspaceFile(
              workspace.value.localDir,
              `.paper-notes/backups/template-overwrites/${backupStamp}/${displayPath}`,
              oldContent,
            );
          } catch {}
        }
        await writeWorkspaceFile(workspace.value.localDir, relativePath, file.content);
      }
      status.value = `已从模板创建项目：${template.name}`;
      await refreshWorkspace();
      const mainPath = `${baseFolder}/${template.mainFile}`;
      const node = findNodeByPath(fileTree.value, mainPath) || {
        name: titleFromPath(mainPath),
        path: mainPath,
        kind: 'file' as const,
        documentKind: kindFromPath(mainPath),
        children: [],
      };
      await openWorkspaceFile(node);
      await persist();
      return true;
    } finally {
      busy.value = false;
    }
  }

  async function openOrCreateWorkspaceMarkdown(
    displayPath: string,
    createContent: () => string,
    labels: { created: string; opened: string },
  ) {
    if (!workspace.value?.localDir) throw new Error('请先打开一个本地文件夹或 GitHub 工作区。');
    const existing = findNodeByPath(fileTree.value, displayPath);
    if (!existing) {
      await writeWorkspaceFile(workspace.value.localDir, makeRelativePath(displayPath), createContent());
      await refreshWorkspace();
    }
    const node = findNodeByPath(fileTree.value, displayPath) || {
      name: titleFromPath(displayPath),
      path: displayPath,
      kind: 'file' as const,
      documentKind: 'markdown' as const,
      children: [],
    };
    await openWorkspaceFile(node);
    status.value = existing ? `${labels.opened}：${displayPath}` : `${labels.created}：${displayPath}`;
  }

  async function createDailyNote() {
    const now = new Date();
    const dateLabel = formatLocalDate(now);
    const dailyDir = normalizePath(projectSettings.value.researchFlowPaths?.dailyDir || 'notes/daily');
    const displayPath = `${dailyDir}/${dateLabel}.md`;
    const context = recentResearchContext();
    await openOrCreateWorkspaceMarkdown(
      displayPath,
      () => `---
type: daily-note
date: ${dateLabel}
project: ${workspace.value?.repo || ''}
tags: [research-log]
related_files:
  - ${context.activePath}
claims: []
evidence: []
---

# ${dateLabel} 研究记录

## 今日目标

- [ ] 

## 工作记录

- 当前文件：${context.activePath}
- 

## 当前批注

${yamlList(context.currentAnnotations)}

## 实验 / 数据 / 图表

| 项目 | 文件或路径 | 结论 | 是否可写入论文 |
| --- | --- | --- | --- |
${context.recentFigures.length ? context.recentFigures.map((path) => `|  | ${path} |  | 待判断 |`).join("\n") : "|  |  |  |  |"}

## 阅读文献

${yamlList(context.recentBib)}

## 可能进入论文的结论

- 结论：
  - 证据：
  - 可信度：待验证 / 可用 / 已确认

## 问题与风险

- 

## 明日计划

- [ ] 
`,
      { created: '已创建每日笔记', opened: '已打开每日笔记' },
    );
  }

  async function createWeeklyReport() {
    const now = new Date();
    const weekLabel = isoWeekLabel(now);
    const weeklyDir = normalizePath(projectSettings.value.researchFlowPaths?.weeklyDir || 'notes/weekly');
    const displayPath = `${weeklyDir}/${weekLabel}.md`;
    await openOrCreateWorkspaceMarkdown(
      displayPath,
      () => '',
      { created: '已创建周报', opened: '已打开周报' },
    );
    const doc = activeDocument.value;
    if (doc?.relativePath === makeRelativePath(displayPath) && !doc.dirty) {
      doc.text = await generateWeeklyReportContent(weekLabel);
      doc.lastSavedText = '';
      doc.dirty = true;
      scheduleDraftSave(doc);
    }
  }

  async function createEvidenceIndex() {
    const displayPath = projectSettings.value.researchFlowPaths?.evidenceIndex || 'research/evidence-index.md';
    await openOrCreateWorkspaceMarkdown(
      displayPath,
      () => '',
      { created: '已创建证据索引', opened: '已打开证据索引' },
    );
    const doc = activeDocument.value;
    if (doc?.relativePath === makeRelativePath(displayPath) && !doc.dirty) {
      doc.text = await generateEvidenceIndexContent();
      doc.lastSavedText = '';
      doc.dirty = true;
      scheduleDraftSave(doc);
    }
  }

  async function createPaperOutline() {
    const displayPath = projectSettings.value.researchFlowPaths?.paperOutline || 'paper/paper-outline.md';
    await openOrCreateWorkspaceMarkdown(
      displayPath,
      () => '',
      { created: '已创建论文大纲', opened: '已打开论文大纲' },
    );
    const doc = activeDocument.value;
    if (doc?.relativePath === makeRelativePath(displayPath) && !doc.dirty) {
      doc.text = await generatePaperOutlineContent();
      doc.lastSavedText = '';
      doc.dirty = true;
      scheduleDraftSave(doc);
    }
  }

  async function openReviewSummary() {
    if (!workspace.value?.localDir) throw new Error('请先打开一个本地文件夹或 GitHub 工作区。');
    const displayPath = projectSettings.value.researchFlowPaths?.reviewSummary || '.paper-notes/review-summary.md';
    await writeWorkspaceFile(workspace.value.localDir, displayPath, serializeReviewSummary(annotations.value));
    await refreshWorkspace();
    const node = findNodeByPath(fileTree.value, displayPath) || {
      name: titleFromPath(displayPath),
      path: displayPath,
      kind: 'file' as const,
      documentKind: 'markdown' as const,
      children: [],
    };
    await openWorkspaceFile(node);
    status.value = `已打开审阅清单：${displayPath}`;
  }

  async function createLocalSnapshot() {
    if (!workspace.value?.localDir) throw new Error('请先打开一个本地文件夹或 GitHub 工作区。');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const active = activeDocument.value;
    const base = `.paper-notes/snapshots/${timestamp}`;
    const copied: string[] = [];
    const skipped: string[] = [];
    const textKinds: DocumentKind[] = ['markdown', 'latex', 'bibtex', 'text'];
    const nodes = flattenFileNodes(fileTree.value).filter((node) => node.kind === 'file' && textKinds.includes(node.documentKind));

    for (const node of nodes) {
      try {
        const content = await readWorkspaceFile(workspace.value.localDir, makeRelativePath(node.path));
        await writeWorkspaceFile(workspace.value.localDir, `${base}/files/${node.path}`, content);
        copied.push(node.path);
      } catch {
        skipped.push(node.path);
      }
    }

    const extraFiles = [
      '.paper-notes/annotations.jsonl',
      '.paper-notes/review-items.jsonl',
      '.paper-notes/review-summary.md',
      '.paper-notes/project.json',
      '.paper-notes/export-profiles.json',
      'refs.bib',
    ];
    for (const path of extraFiles) {
      try {
        const content = await readWorkspaceFile(workspace.value.localDir, path);
        await writeWorkspaceFile(workspace.value.localDir, `${base}/meta/${path}`, content);
        copied.push(path);
      } catch {}
    }

    const lines = [
      '# 本地快照',
      '',
      `- 时间：${new Date().toLocaleString()}`,
      `- 工作区：${workspace.value.localDir}`,
      `- 当前文件：${active?.relativePath || active?.title || '未打开'}`,
      `- 当前字数：${activeWritingStatsLabel.value}`,
      `- 已复制文本/配置文件：${copied.length}`,
      `- 跳过文件：${skipped.length}`,
      '',
      '## 说明',
      '',
      '该快照会复制 Markdown、LaTeX、BibTeX、文本文件、批注、refs.bib 和关键项目配置；PDF、图片和日志等大文件不会复制到快照中。',
      '',
      '## 已复制文件',
      '',
      ...copied.map((item) => `- ${item}`),
      '',
      '## 跳过文件',
      '',
      ...(skipped.length ? skipped.map((item) => `- ${item}`) : ['- 无']),
      '',
      '## 未提交/变更',
      '',
      ...(gitEntries.value.length ? gitEntries.value.map((entry) => `- ${entry.code} ${entry.path}`) : ['- 当前没有 Git 变更记录，或这是非 Git 本地工作区。']),
      '',
    ];
    const path = `${base}/manifest.md`;
    await writeWorkspaceFile(workspace.value.localDir, path, lines.join('\n'));
    status.value = `已创建本地快照：${path}`;
    await refreshWorkspace();
  }

  async function setPdfRenderQuality(value: number) {
    pdfRenderQuality.value = Math.min(
      1.25,
      Math.max(0.45, Number(value) || 0.72),
    );
    projectSettings.value = { ...projectSettings.value, pdfRenderQuality: pdfRenderQuality.value };
    status.value = `PDF 预览分辨率：${Math.round(pdfRenderQuality.value * 100)}%`;
    await persistProjectSettings();
    await persist();
  }


  async function setMarkdownRenderPreset(value: MarkdownRenderPreset) {
    const allowed: MarkdownRenderPreset[] = ["default", "academic", "compact", "reading", "manuscript"];
    markdownRenderPreset.value = allowed.includes(value) ? value : "default";
    status.value = `Markdown 渲染风格：${markdownRenderPreset.value}`;
    await persist();
  }

  async function closeDocument(id: string) {
    const index = documents.value.findIndex((doc) => doc.id === id);
    if (index < 0) return;
    documents.value.splice(index, 1);
    if (activeDocumentId.value === id) {
      activeDocumentId.value =
        documents.value[Math.max(0, index - 1)]?.id ?? documents.value[0]?.id;
    }
    if (!documents.value.length) {
      activeDocumentId.value = undefined;
      previewVisible.value = false;
      pdfPreviewUrl.value = "";
      pdfPreviewPath.value = "";
      activeBibPreviewKey.value = undefined;
      status.value = "所有文件已关闭。可从左侧文档树或顶部入口重新打开文件。";
    }
    await persist();
  }

  return {
    documents,
    activeDocumentId,
    activeDocument,
    fileTree,
    selectedNodePath,
    activeNodePath,
    workspace,
    gitEntries,
    gitDirtyCount,
    gitBusy,
    latexBusy,
    workspaceBusy,
    githubToken,
    githubLogin,
    githubUserHint,
    commentAuthorName,
    darkMode,
    previewVisible,
    explorerVisible,
    gitPanelVisible,
    busy,
    status,
    error,
    appLog,
    latexResult,
    pdfPreviewUrl,
    pdfPreviewPath,
    pdfSyncPoint,
    pdfRenderQuality,
    markdownRenderPreset,
    editorGotoLine,
    markdownPreviewLine,
    editorCursorLine,
    annotations,
    activeAnnotationId,
    latexIndex,
    activeBibPreviewKey,
    activeBibPreview,
    toolPaths,
    environmentChecks,
    layoutSettings,
    projectSettings,
    exportProfiles,
    customSnippets,
    lastPackageExport,
    lastGitSyncResult,
    researchFlowStatuses,
    aiGroundingMode,
    aiMessages,
    aiIndexStats,
    aiEvidencePack,
    aiProposedPatches,
    recoveryWarning,
    draftCount,
    activeDocumentDiagnostics,
    activeWritingStats,
    activeWritingStatsLabel,
    visibleAnnotations,
    visiblePdfAnnotations,
    visibleSourceAnnotations,
    dirtyCount,
    hasWorkspace,
    isLatexActive,
    isMarkdownActive,
    initialize,
    persist,
    persistCleanShutdown,
    setLayoutSettings,
    setEditorSidePanelWidth,
    setToolPath,
    runEnvironmentCheck,
    exportDebugBundle,
    persistProjectSettings,
    setProjectSetting,
    updateResearchFlowPath,
    updateExportProfile,
    updatePublishProfile,
    saveCustomSnippets,
    startGuidedWorkflow,
    openSampleWorkspace,
    openResearchFlowEntry,
    setGithubToken,
    forgetGithubToken,
    cloneWorkspace,
    setCommentAuthorName,
    setAiGroundingMode,
    refreshAiFrameworkIndex,
    sendAiFrameworkPrompt,
    openLocalEntry,
    openLocalFolder,
    openLocalFile,
    refreshWorkspace,
    refreshGitStatus,
    refreshLatexIndex,
    setActiveDocument,
    setEditorCursorLine,
    selectNode,
    updateActiveText,
    updateDocumentText,
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
    buildMarkdownPandoc,
    cleanLatex,
    openCurrentPdf,
    loadPdfPreview,
    setPdfRenderQuality,
    setMarkdownRenderPreset,
    createPdfAnnotation,
    createMarkdownPreviewAnnotation,
    createSourceAnnotation,
    updateAnnotationStatus,
    addAnnotationReply,
    updateAnnotationMessage,
    exportAnnotationsMarkdown,
    exportAnnotations,
    convertAnnotationToTask,
    exportMarkdownFormat,
    publishActiveMarkdown,
    exportSubmissionPackageAction,
    exportSharedReviewPackageAction,
    openExportedPackageFolder,
    gitPullWorkspace,
    gitPushWorkspace,
    createProjectFromTemplate,
    createDailyNote,
    createWeeklyReport,
    createEvidenceIndex,
    createPaperOutline,
    openReviewSummary,
    createLocalSnapshot,
    removeAnnotation,
    focusAnnotation,
    syncMarkdownPreviewFromEditor,
    syncMarkdownEditorFromPreview,
    syncTexForwardFromEditor,
    syncTexReverseFromPdf,
    setActiveBibPreviewKey,
    createBibEntry,
    updateBibEntryRaw,
    removeBibEntry,
    openLatexOutlineItem,
    openLatexIndexedPath,
    jumpToLatexLabel,
    jumpToBibEntry,
    closeDocument,
  };
});
