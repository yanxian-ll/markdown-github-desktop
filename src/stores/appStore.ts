import { defineStore } from "pinia";
import { computed, ref } from "vue";
import { sampleLatex, sampleMarkdown } from "../services/markdown";
import { makeId } from "../services/hash";
import {
  buildLatex as buildLatexFile,
  buildMarkdownPandoc as buildMarkdownPandocFile,
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
  synctexForward,
  synctexReverse,
  writeWorkspaceAnnotations,
  writeWorkspaceFile,
  saveTextFileWithDialog,
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
} from "../types/app";
import type {
  BibEntryItem,
  LatexOutlineItem,
  ProjectLatexIndex,
} from "../types/latexIntelligence";
import { emptyLatexIndex } from "../types/latexIntelligence";
import {
  buildProjectLatexIndex,
  resolveIndexedFilePath,
  resolveTexLikePath,
} from "../services/latexIntelligence";

const GITHUB_TOKEN_ACCOUNT = "github-token";
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
  const githubUserHint = ref<string>("");
  const commentAuthorName = ref<string>("");
  const darkMode = ref(true);
  const previewVisible = ref(true);
  const explorerVisible = ref(true);
  const gitPanelVisible = ref(true);
  const busy = ref(false);
  const runningTasks = ref<Record<string, boolean>>({});
  const status = ref("准备就绪");
  const error = ref<string>("");
  const latexResult = ref<LatexBuildResult | null>(null);
  const pdfPreviewUrl = ref<string>("");
  const pdfPreviewPath = ref<string>("");
  const pdfSyncPoint = ref<PdfSyncPoint | null>(null);
  const pdfRenderQuality = ref(0.72);
  const editorGotoLine = ref<number | null>(null);
  const markdownPreviewLine = ref<number | null>(null);
  const editorCursorLine = ref<number | null>(null);
  const annotations = ref<PaperAnnotation[]>([]);
  const activeAnnotationId = ref<string>();
  const latexIndex = ref<ProjectLatexIndex>(emptyLatexIndex());
  const activeBibPreviewKey = ref<string>();

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

  function applyLayoutForDocumentKind(kind?: DocumentKind) {
    if (!kind) return;
    if (["markdown", "latex", "image", "pdf"].includes(kind)) {
      previewVisible.value = true;
    } else {
      previewVisible.value = false;
    }
  }

  const gitDirtyCount = computed(() => gitEntries.value.length);
  const latexBusy = computed(() => !!runningTasks.value["latex-build"]);
  const gitBusy = computed(
    () =>
      !!runningTasks.value["git-submit"] || !!runningTasks.value["git-clone"],
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

  function snapshot(): PersistedAppState {
    // 只持久化轻量状态。工作区文件、图片和 PDF 都能从磁盘重新打开，
    // 不能把它们的全文/base64 data URL 写入 appState，否则 PDF 或图片一旦打开，
    // 之后编辑普通 txt/Markdown 也会因为序列化巨大 JSON 而卡顿。
    const scratchDocuments = documents.value
      .filter(
        (doc) =>
          doc.source === "scratch" &&
          doc.kind !== "image" &&
          doc.kind !== "pdf",
      )
      .map((doc) => ({ ...doc }));
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
      documents.value = lightweightDocuments.length
        ? lightweightDocuments
        : [defaultDocument()];
      activeDocumentId.value = documents.value.some(
        (doc) => doc.id === initial.activeDocumentId,
      )
        ? initial.activeDocumentId
        : documents.value[0]?.id;
      fileTree.value = [];
      workspace.value = initial.workspace;
      commentAuthorName.value =
        initial.commentAuthorName || initial.workspace?.owner || "";
      if (!commentAuthorName.value.trim()) {
        try {
          commentAuthorName.value = (await currentSystemUsername()) || "";
        } catch {
          commentAuthorName.value = "";
        }
      }
      gitEntries.value = [];
      darkMode.value = initial.editor?.darkMode ?? true;
      previewVisible.value = initial.editor?.previewVisible ?? true;
      explorerVisible.value = initial.editor?.explorerVisible ?? true;
      gitPanelVisible.value = initial.editor?.gitPanelVisible ?? true;
      pdfRenderQuality.value = Math.min(
        1.25,
        Math.max(0.45, initial.editor?.pdfRenderQuality ?? 0.72),
      );
      githubToken.value = await getSecret(GITHUB_TOKEN_ACCOUNT);
      githubUserHint.value = githubToken.value ? "已保存 token" : "";
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
    if (!trimmed) throw new Error("GitHub token 不能为空。");
    await setSecret(GITHUB_TOKEN_ACCOUNT, trimmed);
    githubToken.value = trimmed;
    githubUserHint.value = "已保存 token";
    status.value = "GitHub token 已保存到系统凭据。";
  }

  async function forgetGithubToken() {
    await deleteSecret(GITHUB_TOKEN_ACCOUNT);
    githubToken.value = null;
    githubUserHint.value = "";
    status.value = "已移除 GitHub token。";
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
        workspace.value = normalized;
        status.value = output.trim() || "Git 仓库已准备好，左侧目录树已刷新。";
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
      const first = findFirstFileNode(fileTree.value);
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
    applyLayoutForDocumentKind(activeDocument.value?.kind);
    persist().catch(() => undefined);
  }

  function setEditorCursorLine(line?: number | null) {
    editorCursorLine.value = line || null;
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
          applyLayoutForDocumentKind(existing.kind);
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
          applyLayoutForDocumentKind(doc.kind);
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
        applyLayoutForDocumentKind(existing.kind);
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
        applyLayoutForDocumentKind(doc.kind);
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
    await writeWorkspaceFile(
      workspace.value.localDir,
      doc.relativePath,
      doc.text,
    );
    doc.lastSavedText = doc.text;
    doc.dirty = false;
    doc.updatedAt = Date.now();
    status.value = `已保存本地：${doc.relativePath}`;
    await refreshWorkspace();
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
          "LaTeX 正在后台构建 PDF，设置/隐藏/切换文件等界面操作不会被锁住…";
        const result = await buildLatexFile(
          workspace.value.localDir,
          doc.relativePath,
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
        const result = await buildMarkdownPandocFile(
          workspace.value.localDir,
          doc.relativePath,
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
    status.value = await cleanLatexFiles(
      workspace.value.localDir,
      doc.relativePath,
    );
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
  }) {
    const item = annotations.value.find(
      (annotation) => annotation.id === payload.id,
    );
    if (!item) return;
    item.status = payload.status;
    item.updatedAt = nowIso();
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

  async function exportAnnotationsMarkdown() {
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
    const savedPath = await saveTextFileWithDialog({
      defaultDir: `${workspace.value.localDir.replace(/[\/]$/, "")}/.paper-notes`,
      defaultFilename: `${baseName}-批注.md`,
      text: serializeAnnotationExportMarkdown(currentItems, title),
    });
    if (!savedPath) {
      status.value = "已取消导出。";
      return;
    }
    status.value = `已导出当前文件批注：${savedPath}`;
    await refreshGitStatus();
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
    activeBibPreviewKey.value = key;
    await openWorkspacePathAtLine(makeRelativePath(entry.file), entry.line);
  }

  async function setPdfRenderQuality(value: number) {
    pdfRenderQuality.value = Math.min(
      1.25,
      Math.max(0.45, Number(value) || 0.72),
    );
    status.value = `PDF 预览分辨率：${Math.round(pdfRenderQuality.value * 100)}%`;
    await persist();
  }

  async function closeDocument(id: string) {
    const index = documents.value.findIndex((doc) => doc.id === id);
    if (index < 0) return;
    documents.value.splice(index, 1);
    if (!documents.value.length) documents.value.push(defaultDocument());
    if (activeDocumentId.value === id) {
      activeDocumentId.value =
        documents.value[Math.max(0, index - 1)]?.id ?? documents.value[0]?.id;
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
    commentAuthorName,
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
    markdownPreviewLine,
    editorCursorLine,
    annotations,
    activeAnnotationId,
    latexIndex,
    activeBibPreviewKey,
    activeBibPreview,
    activeDocumentDiagnostics,
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
    setCommentAuthorName,
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
    createPdfAnnotation,
    createMarkdownPreviewAnnotation,
    createSourceAnnotation,
    updateAnnotationStatus,
    addAnnotationReply,
    updateAnnotationMessage,
    exportAnnotationsMarkdown,
    removeAnnotation,
    focusAnnotation,
    syncMarkdownPreviewFromEditor,
    syncMarkdownEditorFromPreview,
    syncTexForwardFromEditor,
    syncTexReverseFromPdf,
    setActiveBibPreviewKey,
    openLatexOutlineItem,
    openLatexIndexedPath,
    jumpToLatexLabel,
    jumpToBibEntry,
    closeDocument,
  };
});
