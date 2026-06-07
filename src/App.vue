<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { storeToRefs } from "pinia";
import Explorer from "./components/Explorer.vue";
import GitPanel from "./components/GitPanel.vue";
import EditorOutlinePanel from "./components/EditorOutlinePanel.vue";
import MarkdownEditor from "./components/MarkdownEditor.vue";
import MarkdownPreview from "./components/MarkdownPreview.vue";
import PdfPreview from "./components/PdfPreview.vue";
import AnnotationSidebar from "./components/AnnotationSidebar.vue";
import Toolbar from "./components/Toolbar.vue";
import BibPreviewPopover from "./components/BibPreviewPopover.vue";
import BuildPanel from './components/BuildPanel.vue';
import BibManagerPanel from './components/BibManagerPanel.vue';
import SnippetPanel from './components/SnippetPanel.vue';
import HistoryPanel from './components/HistoryPanel.vue';
import WelcomeStart from './components/WelcomeStart.vue';
import TemplateGallery from './components/TemplateGallery.vue';
import ResearchFlowPanel from './components/ResearchFlowPanel.vue';
import { useAppStore } from "./stores/appStore";
import type { DocumentKind, FileNode, PaperAnnotationRect, FirstRunMode } from "./types/app";
import type { ResearchFlowActionId } from './config/workbench';

const store = useAppStore();
const {
  documents,
  activeDocument,
  activeDocumentId,
  busy,
  darkMode,
  dirtyCount,
  error,
  explorerVisible,
  fileTree,
  selectedNodePath,
  activeNodePath,
  gitDirtyCount,
  gitBusy,
  latexBusy,
  workspaceBusy,
  gitEntries,
  gitPanelVisible,
  githubUserHint,
  isLatexActive,
  latexResult,
  pdfPreviewUrl,
  pdfSyncPoint,
  pdfRenderQuality,
  markdownRenderPreset,
  editorGotoLine,
  editorCursorLine,
  annotations,
  markdownPreviewLine,
  activeAnnotationId,
  visibleAnnotations,
  visiblePdfAnnotations,
  previewVisible,
  status,
  workspace,
  commentAuthorName,
  latexIndex,
  activeBibPreview,
  activeDocumentDiagnostics,
  activeWritingStatsLabel,
  hasWorkspace,
  toolPaths,
  environmentChecks,
  layoutSettings,
  recoveryWarning,
  draftCount,
  projectSettings,
  exportProfiles,
  researchFlowStatuses,
} = storeToRefs(store);

const activeText = computed({
  get: () => activeDocument.value?.text ?? "",
  set: (value: string) => store.updateActiveText(value),
});

const openDocumentTabs = computed(() => documents.value);
const primaryDocument = computed(() => activeDocument.value);
const primaryText = computed({
  get: () => primaryDocument.value?.text ?? '',
  set: (value: string) => {
    const id = primaryDocument.value?.id;
    if (id) store.updateDocumentText(id, value);
  },
});

const editorPaneVisible = ref(true);
const activeKind = computed(() => activeDocument.value?.kind);
const editorAreaVisible = computed(
  () => activeKind.value !== "image" && activeKind.value !== "pdf",
);
const previewCapable = computed(() =>
  ["markdown", "latex", "image", "pdf"].includes(activeKind.value || ""),
);
const previewOnlyDocument = computed(
  () => activeKind.value === "image" || activeKind.value === "pdf",
);
const effectivePreviewVisible = computed(
  () => previewCapable.value && (previewVisible.value || previewOnlyDocument.value),
);
const effectiveEditorVisible = computed(
  () => editorAreaVisible.value && (editorPaneVisible.value || !effectivePreviewVisible.value),
);
const splitLayoutActive = computed(
  () => effectiveEditorVisible.value && effectivePreviewVisible.value,
);
const annotationPanelAvailable = computed(() =>
  ["markdown", "latex", "pdf"].includes(activeKind.value || ""),
);
const pdfPreviewActive = computed(() =>
  activeKind.value === "pdf" ||
  (activeKind.value === "latex" && !!pdfPreviewUrl.value) ||
  (activeKind.value === "markdown" && markdownPdfPreviewMode.value && !!pdfPreviewUrl.value),
);
const editorOutlineAvailable = computed(() =>
  activeKind.value === "latex" || activeKind.value === "markdown",
);
function normalizeDisplayPath(path?: string) {
  return (path || "").replace(/\\/g, "/").replace(/^\/+/, "");
}
const activeFileOutlineCount = computed(() => {
  if (!editorOutlineAvailable.value || !activeDocument.value?.relativePath) return 0;
  const activePath = normalizeDisplayPath(activeDocument.value.relativePath);
  return latexIndex.value.outline.filter((item) => {
    const itemPath = normalizeDisplayPath(item.file);
    return itemPath === activePath || itemPath.endsWith(`/${activePath}`) || activePath.endsWith(`/${itemPath}`);
  }).length;
});

const activeDiagnosticCount = computed(() => activeDocumentDiagnostics.value.length);
const activeDiagnosticErrorCount = computed(() => activeDocumentDiagnostics.value.filter((item) => item.severity === 'error').length);

const explorerWidth = ref(280);
const settingsWidth = ref(360);
const previewWidth = ref(560);
const bottomPanelHeight = ref(260);
const imageZoom = ref(1);
const markdownPdfPreviewMode = ref(false);
const previewExportMenuVisible = ref(false);
const annotationPanelVisible = ref(false);
const annotationPanelWidth = ref(300);
const editorSidePanelWidth = ref(280);
const editorFontSize = ref(14);
const editorOutlineVisible = ref(false);
const sideWorkPanel = ref<'workflow' | 'outline' | 'bib' | 'snippets' | 'history' | null>(null);
const bottomPanelVisible = ref(false);
const templatePanelVisible = ref(false);
const templatePanelWidth = ref(340);
const scratchEditorVisible = ref(false);
let resizeTarget: "explorer" | "template" | "settings" | "preview" | "annotation" | "editorSide" | "bottom" | null =
  null;
let annotationResizeRight = 0;
let editorSideResizeLeft = 0;

const startPageVisible = computed(() => !hasWorkspace.value && !scratchEditorVisible.value);

const layoutClass = computed(() => ({
  "explorer-hidden": !explorerVisible.value,
  "git-hidden": !gitPanelVisible.value,
  "preview-hidden": !effectivePreviewVisible.value,
  resizing: !!resizeTarget,
}));

const workspaceStyle = computed(() => {
  const columns: string[] = [];
  if (explorerVisible.value) columns.push(`${explorerWidth.value}px`, "6px");
  if (templatePanelVisible.value) columns.push(`${templatePanelWidth.value}px`, "6px");
  columns.push("minmax(360px, 1fr)");
  if (gitPanelVisible.value) columns.push("6px", `${settingsWidth.value}px`);
  return { gridTemplateColumns: columns.join(" ") };
});

const editorLayoutStyle = computed(() => {
  if (!splitLayoutActive.value) return { gridTemplateColumns: "1fr" };
  return {
    gridTemplateColumns: `minmax(220px, 1fr) 6px ${previewWidth.value}px`,
  };
});

const paperReviewLayoutStyle = computed(() => {
  if (!annotationPanelVisible.value)
    return { gridTemplateColumns: "minmax(320px, 1fr)" };
  return {
    gridTemplateColumns: `minmax(320px, 1fr) 6px ${annotationPanelWidth.value}px`,
  };
});

const editorBodyLayoutStyle = computed(() => {
  if (!sideWorkPanel.value) return { gridTemplateColumns: 'minmax(0, 1fr)' };
  return {
    gridTemplateColumns: `${editorSidePanelWidth.value}px 6px minmax(0, 1fr)`,
  };
});

const bottomPanelStyle = computed(() => ({ height: `${bottomPanelHeight.value}px` }));
const editorHeaderTitle = computed(() => {
  if (!previewCapable.value || previewOnlyDocument.value) return '编辑栏';
  return splitLayoutActive.value
    ? '双击关闭编辑栏，保留预览栏（Ctrl/Cmd+Alt+E）'
    : '双击打开预览栏，恢复左右双栏（Ctrl/Cmd+Alt+V）';
});
const previewHeaderTitle = computed(() => {
  if (previewOnlyDocument.value) return '预览栏';
  return splitLayoutActive.value
    ? '双击关闭预览栏，保留编辑栏（Ctrl/Cmd+Alt+V）'
    : '双击打开编辑栏，恢复左右双栏（Ctrl/Cmd+Alt+E）';
});

let imageGestureBaseZoom = 1;
let persistTimer: number | undefined;
let layoutPersistTimer: number | undefined;
let applyingPersistedLayout = false;

watch(
  layoutSettings,
  (layout) => {
    applyingPersistedLayout = true;
    explorerWidth.value = layout.explorerWidth;
    templatePanelWidth.value = layout.templatePanelWidth;
    settingsWidth.value = layout.settingsWidth;
    previewWidth.value = layout.previewWidth;
    annotationPanelWidth.value = layout.annotationPanelWidth;
    bottomPanelHeight.value = layout.bottomPanelHeight;
    editorFontSize.value = clamp(layout.editorFontSize || 14, 11, 28);
    if (sideWorkPanel.value) {
      editorSidePanelWidth.value = layout.editorSidePanelWidths[sideWorkPanel.value] || editorSidePanelWidth.value;
    }
    window.setTimeout(() => { applyingPersistedLayout = false; }, 0);
  },
  { immediate: true, deep: true },
);

watch(
  () => sideWorkPanel.value,
  (panel) => {
    if (!panel) return;
    editorSidePanelWidth.value = layoutSettings.value.editorSidePanelWidths[panel] || editorSidePanelWidth.value;
  },
);

watch(
  () => [explorerWidth.value, templatePanelWidth.value, settingsWidth.value, previewWidth.value, annotationPanelWidth.value, bottomPanelHeight.value, editorFontSize.value],
  () => {
    if (applyingPersistedLayout) return;
    window.clearTimeout(layoutPersistTimer);
    layoutPersistTimer = window.setTimeout(() => {
      store.setLayoutSettings({
        explorerWidth: explorerWidth.value,
        templatePanelWidth: templatePanelWidth.value,
        settingsWidth: settingsWidth.value,
        previewWidth: previewWidth.value,
        annotationPanelWidth: annotationPanelWidth.value,
        bottomPanelHeight: bottomPanelHeight.value,
        editorFontSize: editorFontSize.value,
      });
    }, 500);
  },
);

watch(
  () => editorSidePanelWidth.value,
  (width) => {
    if (applyingPersistedLayout || !sideWorkPanel.value) return;
    window.clearTimeout(layoutPersistTimer);
    layoutPersistTimer = window.setTimeout(() => {
      if (sideWorkPanel.value) store.setEditorSidePanelWidth(sideWorkPanel.value, width);
    }, 500);
  },
);
watch(
  () => [
    darkMode.value,
    previewVisible.value,
    explorerVisible.value,
    gitPanelVisible.value,
    editorPaneVisible.value,
    bottomPanelHeight.value,
    activeDocumentId.value,
  ],
  () => {
    window.clearTimeout(persistTimer);
    persistTimer = window.setTimeout(() => store.persist(), 500);
  },
);

watch(
  () => activeDocument.value?.relativePath,
  () => {
    imageZoom.value = 1;
    markdownPdfPreviewMode.value = false;
    previewExportMenuVisible.value = false;
    annotationPanelVisible.value = false;
    editorOutlineVisible.value = false;
    editorPaneVisible.value = true;
    if (sideWorkPanel.value === 'outline' && !editorOutlineAvailable.value) sideWorkPanel.value = null;
  },
);

watch(
  () => workspace.value?.localDir,
  (localDir) => {
    if (localDir) scratchEditorVisible.value = false;
  },
);

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function startResize(
  target: "explorer" | "template" | "settings" | "preview" | "annotation" | "editorSide" | "bottom",
  event: MouseEvent,
) {
  resizeTarget = target;
  if (target === "annotation") {
    const layout = (event.currentTarget as HTMLElement).closest(
      ".paper-review-layout",
    ) as HTMLElement | null;
    annotationResizeRight =
      layout?.getBoundingClientRect().right ?? window.innerWidth;
  }
  if (target === "editorSide") {
    const layout = (event.currentTarget as HTMLElement).closest(
      ".editor-body-layout",
    ) as HTMLElement | null;
    editorSideResizeLeft = layout?.getBoundingClientRect().left ?? 0;
  }
  event.preventDefault();
  document.body.classList.add("drag-resizing", target === "bottom" ? "drag-resizing-y" : "drag-resizing-x");
}

function onResizeMove(event: MouseEvent) {
  if (!resizeTarget) return;
  const width = window.innerWidth;
  if (resizeTarget === "explorer") {
    explorerWidth.value = clamp(event.clientX, 190, Math.min(560, width - 720));
  } else if (resizeTarget === "template") {
    const leftReserve = explorerVisible.value ? explorerWidth.value + 6 : 0;
    const maxTemplateWidth = Math.max(260, Math.min(520, width - leftReserve - 620));
    templatePanelWidth.value = clamp(event.clientX - leftReserve, 260, maxTemplateWidth);
  } else if (resizeTarget === "settings") {
    settingsWidth.value = clamp(
      width - event.clientX,
      280,
      Math.min(620, width - 720),
    );
  } else if (resizeTarget === "preview") {
    const rightPanelWidth = gitPanelVisible.value
      ? settingsWidth.value + 14
      : 0;
    const leftWorkspaceWidth = (explorerVisible.value ? explorerWidth.value + 6 : 0) +
      (templatePanelVisible.value ? templatePanelWidth.value + 6 : 0);
    const minEditorWidth = 220;
    const maxPreviewWidth = Math.max(
      360,
      width - leftWorkspaceWidth - rightPanelWidth - minEditorWidth - 24,
    );
    previewWidth.value = clamp(
      width - event.clientX - rightPanelWidth,
      320,
      maxPreviewWidth,
    );
  } else if (resizeTarget === "annotation") {
    const maxAnnotationWidth = Math.max(220, annotationResizeRight - 300);
    annotationPanelWidth.value = clamp(
      annotationResizeRight - event.clientX,
      220,
      Math.min(620, maxAnnotationWidth),
    );
  } else if (resizeTarget === "editorSide") {
    const editorRightReserve = effectivePreviewVisible.value ? previewWidth.value + 220 : 420;
    const maxEditorSideWidth = Math.max(260, width - editorSideResizeLeft - editorRightReserve);
    editorSidePanelWidth.value = clamp(
      event.clientX - editorSideResizeLeft,
      220,
      Math.min(560, maxEditorSideWidth),
    );
  } else if (resizeTarget === "bottom") {
    bottomPanelHeight.value = clamp(window.innerHeight - event.clientY - 32, 160, Math.min(620, window.innerHeight - 120));
  }
}

function stopResize() {
  const finishedTarget = resizeTarget;
  resizeTarget = null;
  document.body.classList.remove("drag-resizing", "drag-resizing-x", "drag-resizing-y");
  if (finishedTarget === "editorSide" && sideWorkPanel.value) {
    store.setEditorSidePanelWidth(sideWorkPanel.value, editorSidePanelWidth.value);
  } else if (finishedTarget) {
    store.setLayoutSettings({
      explorerWidth: explorerWidth.value,
      templatePanelWidth: templatePanelWidth.value,
      settingsWidth: settingsWidth.value,
      previewWidth: previewWidth.value,
      annotationPanelWidth: annotationPanelWidth.value,
      bottomPanelHeight: bottomPanelHeight.value,
      editorFontSize: editorFontSize.value,
    });
  }
}

function zoomImage(delta: number) {
  imageZoom.value = clamp(Number((imageZoom.value + delta).toFixed(2)), 0.2, 3);
}

function onImageWheel(event: WheelEvent) {
  const shouldZoom =
    event.ctrlKey ||
    event.metaKey ||
    event.altKey ||
    Math.abs(event.deltaZ || 0) > 0;
  if (!shouldZoom) return;
  event.preventDefault();
  const direction = event.deltaY > 0 || event.deltaZ > 0 ? -1 : 1;
  zoomImage(direction * 0.1);
}

function onImageGestureStart(event: Event) {
  event.preventDefault();
  imageGestureBaseZoom = imageZoom.value;
}

function onImageGestureChange(event: Event) {
  event.preventDefault();
  const gesture = event as Event & { scale?: number };
  if (typeof gesture.scale !== "number") return;
  imageZoom.value = clamp(
    Number((imageGestureBaseZoom * gesture.scale).toFixed(2)),
    0.2,
    3,
  );
}

function setEditorFontSize(value: number) {
  editorFontSize.value = clamp(Math.round(value), 11, 28);
}

function eventTargetsEditor(event: Event) {
  const target = event.target as HTMLElement | null;
  if (target?.closest('.editor-code-pane, .cm-editor')) return true;
  const active = document.activeElement as HTMLElement | null;
  return !!active?.closest('.editor-code-pane, .cm-editor');
}

function onEditorWheelZoom(event: WheelEvent) {
  if (!(event.ctrlKey || event.metaKey) || !eventTargetsEditor(event)) return;
  event.preventDefault();
  event.stopPropagation();
  setEditorFontSize(editorFontSize.value + (event.deltaY > 0 ? -1 : 1));
}

function activateDocumentTab(id: string) {
  store.setActiveDocument(id);
}

async function closeDocumentTab(id: string) {
  await store.closeDocument(id);
}

function focusEditorDocument(id?: string) {
  if (id && activeDocumentId.value !== id) store.setActiveDocument(id);
}

async function saveLocal() {
  try {
    await store.saveActiveLocal();
  } catch (err) {
    store.error = err instanceof Error ? err.message : String(err);
  }
}

async function submitGithub() {
  try {
    await store.submitGithub();
  } catch (err) {
    store.error = err instanceof Error ? err.message : String(err);
  }
}

function isInteractiveHeaderTarget(event: MouseEvent) {
  const target = event.target as HTMLElement | null;
  return !!target?.closest('button, input, textarea, select, a, [role="button"]');
}

function togglePreviewPane() {
  if (!previewCapable.value || previewOnlyDocument.value) return;
  if (effectivePreviewVisible.value && effectiveEditorVisible.value) previewVisible.value = false;
  else previewVisible.value = true;
}

function toggleEditorPane() {
  if (!editorAreaVisible.value) return;
  if (effectiveEditorVisible.value && effectivePreviewVisible.value) editorPaneVisible.value = false;
  else editorPaneVisible.value = true;
}

function restoreDualPane() {
  if (!editorAreaVisible.value || !previewCapable.value || previewOnlyDocument.value) return;
  editorPaneVisible.value = true;
  previewVisible.value = true;
}

function onEditorHeaderDblclick(event: MouseEvent) {
  if (isInteractiveHeaderTarget(event)) return;
  if (splitLayoutActive.value) editorPaneVisible.value = false;
  else if (previewCapable.value && !previewOnlyDocument.value) previewVisible.value = true;
}

function onPreviewHeaderDblclick(event: MouseEvent) {
  if (isInteractiveHeaderTarget(event)) return;
  if (previewOnlyDocument.value) return;
  if (splitLayoutActive.value) previewVisible.value = false;
  else editorPaneVisible.value = true;
}

async function createItem(parent?: FileNode) {
  try {
    await store.createItemFromPrompt(parent);
  } catch (err) {
    store.error = err instanceof Error ? err.message : String(err);
  }
}

async function removeItem(node: FileNode) {
  try {
    await store.removeItem(node);
  } catch (err) {
    store.error = err instanceof Error ? err.message : String(err);
  }
}

async function moveItem(payload: { source: FileNode; target?: FileNode }) {
  try {
    await store.moveItemToTarget(payload.source, payload.target);
  } catch (err) {
    store.error = err instanceof Error ? err.message : String(err);
  }
}

async function buildActiveDocument() {
  try {
    if (activeDocument.value?.kind === "markdown") {
      await store.buildMarkdownPandoc();
      if (pdfPreviewUrl.value) markdownPdfPreviewMode.value = true;
      return;
    }
    await store.buildLatex();
  } catch (err) {
    store.error = err instanceof Error ? err.message : String(err);
  }
}

const buildLatex = buildActiveDocument;

async function syncTexForward(payload: { line: number; column: number }) {
  try {
    await store.syncTexForwardFromEditor(payload.line, payload.column);
  } catch (err) {
    store.error = err instanceof Error ? err.message : String(err);
  }
}


function syncMarkdownPreview(payload: { line: number }) {
  store.syncMarkdownPreviewFromEditor(payload.line);
}

function syncMarkdownEditor(payload: { line: number }) {
  store.syncMarkdownEditorFromPreview(payload.line);
}

async function syncTexReverse(payload: { page: number; x: number; y: number }) {
  try {
    await store.syncTexReverseFromPdf(payload.page, payload.x, payload.y);
  } catch (err) {
    store.error = err instanceof Error ? err.message : String(err);
  }
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
  try {
    await store.createPdfAnnotation(payload);
  } catch (err) {
    store.error = err instanceof Error ? err.message : String(err);
  }
}

async function createMarkdownPreviewAnnotation(payload: {
  selectedText: string;
  rects?: PaperAnnotationRect[];
  body: string;
}) {
  try {
    await store.createMarkdownPreviewAnnotation(payload);
  } catch (err) {
    store.error = err instanceof Error ? err.message : String(err);
  }
}

async function exportMarkdownFormat(format: 'pdf' | 'docx' | 'html' | 'epub' | 'latex' | 'beamer') {
  previewExportMenuVisible.value = false;
  try {
    await store.exportMarkdownFormat(format);
    if ((format === 'pdf' || format === 'beamer') && pdfPreviewUrl.value) markdownPdfPreviewMode.value = true;
  } catch (err) {
    store.error = err instanceof Error ? err.message : String(err);
  }
}

async function handleDiagnosticOpen(payload: { file: string; line: number }) {
  try {
    await store.openLatexIndexedPath(payload.file);
    store.editorGotoLine = payload.line;
  } catch (err) {
    store.error = err instanceof Error ? err.message : String(err);
  }
}


async function createProjectFromTemplate(templateId: string) {
  try {
    const created = await store.createProjectFromTemplate(templateId);
    if (created !== false) {
      templatePanelVisible.value = false;
      sideWorkPanel.value = null;
    }
  } catch (err) {
    store.error = err instanceof Error ? err.message : String(err);
  }
}

async function createScratchDocument(kind: DocumentKind = 'markdown') {
  await store.newScratchDocument(kind);
  scratchEditorVisible.value = true;
}

async function startGuidedWorkflow(mode: FirstRunMode) {
  try {
    await store.startGuidedWorkflow(mode);
    if (!workspace.value?.localDir) scratchEditorVisible.value = true;
  } catch (err) {
    store.error = err instanceof Error ? err.message : String(err);
  }
}

async function openSampleWorkspace() {
  try {
    await store.openSampleWorkspace();
  } catch (err) {
    store.error = err instanceof Error ? err.message : String(err);
  }
}

async function createDailyNote() {
  try {
    await store.createDailyNote();
  } catch (err) {
    store.error = err instanceof Error ? err.message : String(err);
  }
}

async function runResearchFlowAction(action: ResearchFlowActionId) {
  try {
    if (action === 'daily-note') await store.createDailyNote();
    else if (action === 'weekly-report') await store.createWeeklyReport();
    else if (action === 'evidence-index') await store.createEvidenceIndex();
    else if (action === 'paper-outline') await store.createPaperOutline();
    else if (action === 'review-summary') await store.openReviewSummary();
  } catch (err) {
    store.error = err instanceof Error ? err.message : String(err);
  }
}

async function handleLatexNavigate(payload: { kind: 'label' | 'bib' | 'file'; key: string }) {
  try {
    if (payload.kind === 'label') await store.jumpToLatexLabel(payload.key);
    else if (payload.kind === 'bib') await store.jumpToBibEntry(payload.key);
    else await store.openLatexIndexedPath(payload.key);
  } catch (err) {
    store.error = err instanceof Error ? err.message : String(err);
  }
}

function onKeydown(event: KeyboardEvent) {
  if ((event.metaKey || event.ctrlKey) && eventTargetsEditor(event)) {
    if (["=", "+"].includes(event.key)) {
      event.preventDefault();
      setEditorFontSize(editorFontSize.value + 1);
      return;
    }
    if (event.key === "-") {
      event.preventDefault();
      setEditorFontSize(editorFontSize.value - 1);
      return;
    }
    if (event.key === "0") {
      event.preventDefault();
      setEditorFontSize(14);
      return;
    }
  }
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
    event.preventDefault();
    saveLocal();
  }
  if (
    (event.metaKey || event.ctrlKey) &&
    event.key.toLowerCase() === "b" &&
    ["latex", "markdown"].includes(activeDocument.value?.kind || "")
  ) {
    event.preventDefault();
    buildLatex();
  }
  if ((event.metaKey || event.ctrlKey) && event.altKey && event.key.toLowerCase() === "v") {
    event.preventDefault();
    togglePreviewPane();
  }
  if ((event.metaKey || event.ctrlKey) && event.altKey && event.key.toLowerCase() === "e") {
    event.preventDefault();
    toggleEditorPane();
  }
  if ((event.metaKey || event.ctrlKey) && event.altKey && event.key === "\\") {
    event.preventDefault();
    restoreDualPane();
  }
}

async function markCleanShutdown() {
  await store.persistCleanShutdown();
}

onMounted(async () => {
  window.addEventListener("keydown", onKeydown);
  window.addEventListener("mousemove", onResizeMove);
  window.addEventListener("mouseup", stopResize);
  window.addEventListener("beforeunload", markCleanShutdown);
  await store.initialize();
});

onBeforeUnmount(() => {
  window.removeEventListener("keydown", onKeydown);
  window.removeEventListener("mousemove", onResizeMove);
  window.removeEventListener("mouseup", stopResize);
  window.removeEventListener("beforeunload", markCleanShutdown);
  void store.persistCleanShutdown();
});
</script>

<template>
  <div class="app-shell" :class="[{ light: !darkMode }, layoutClass]">
    <Toolbar
      :active="activeDocument"
      :busy="gitBusy"
      :explorer-visible="explorerVisible"
      :git-panel-visible="gitPanelVisible"
      :template-panel-visible="templatePanelVisible"
      :git-dirty-count="gitDirtyCount"
      :github-workspace="workspace?.source !== 'local' && !!workspace?.localDir"
      :preview-available="previewCapable && !previewOnlyDocument"
      :preview-visible="effectivePreviewVisible"
      @submit-github="submitGithub"
      @toggle-explorer="explorerVisible = !explorerVisible"
      @toggle-git-panel="gitPanelVisible = !gitPanelVisible"
      @open-templates="templatePanelVisible = !templatePanelVisible"
      @toggle-preview="togglePreviewPane"
    />

    <main class="workspace" :style="workspaceStyle">
      <Explorer
        v-if="explorerVisible"
        :visible="explorerVisible"
        :tree="fileTree"
        :active="activeDocument"
        :dirty-count="dirtyCount"
        :selected-path="selectedNodePath"
        :active-path="activeNodePath"
        @open="store.openWorkspaceFile"
        @rename="store.renameItem"
        @create="createItem"
        @delete="removeItem"
        @select="store.selectNode"
        @move="moveItem"
        @refresh="store.refreshWorkspace"
        @open-local="store.openLocalEntry"
        @daily-note="createDailyNote"
        @research-action="runResearchFlowAction"
        @hide="explorerVisible = false"
      />
      <div
        v-if="explorerVisible"
        class="resize-handle vertical"
        title="拖动调整文档栏宽度"
        @mousedown="startResize('explorer', $event)"
      />

      <section v-if="templatePanelVisible" class="template-side-panel">
        <header class="template-side-panel-header">
          <div>
            <strong>模板</strong>
            <small>搜索并创建学术项目</small>
          </div>
          <button class="toolbar-icon" title="关闭模板" @click="templatePanelVisible = false">×</button>
        </header>
        <TemplateGallery compact @create="createProjectFromTemplate" />
      </section>
      <div
        v-if="templatePanelVisible"
        class="resize-handle vertical"
        title="拖动调整模板栏宽度"
        @mousedown="startResize('template', $event)"
      />

      <WelcomeStart
        v-if="startPageVisible"
        :busy="busy || workspaceBusy"
        @open-local="store.openLocalEntry"
        @new-scratch="createScratchDocument"
        @quick-start="startGuidedWorkflow"
        @open-sample="openSampleWorkspace"
      />

      <section
        v-else
        class="editor-layout"
        :class="{ 'preview-hidden': !effectivePreviewVisible, 'editor-hidden': !effectiveEditorVisible }"
        :style="editorLayoutStyle"
      >
        <div v-if="effectiveEditorVisible" class="editor-column">
          <div class="document-tabs-bar">
            <div
              v-for="doc in openDocumentTabs"
              :key="doc.id"
              class="document-tab"
              :class="{ active: activeDocumentId === doc.id, dirty: doc.dirty }"
              :title="`${doc.relativePath || doc.title}${doc.dirty ? ' · 未保存' : ''}`"
              @click="activateDocumentTab(doc.id)"
            >
              <span class="document-tab-kind">{{ doc.kind === 'latex' ? 'TEX' : doc.kind === 'markdown' ? 'MD' : doc.kind === 'bibtex' ? 'BIB' : doc.kind.toUpperCase() }}</span>
              <span class="document-tab-title">{{ doc.relativePath || doc.title }}</span>
              <span v-if="doc.dirty" class="document-tab-dot">●</span>
              <button class="document-tab-close" title="关闭文件" @click.stop="closeDocumentTab(doc.id)">×</button>
            </div>
          </div>
          <div class="editor-header pane-header" :title="editorHeaderTitle" @dblclick="onEditorHeaderDblclick">
            <div class="editor-header-left">
              <div class="editor-sidebar-buttons" aria-label="编辑侧栏">
                <button
                  class="toolbar-icon research-flow-toggle-button"
                  :class="{ active: sideWorkPanel === 'workflow' }"
                  :title="sideWorkPanel === 'workflow' ? '隐藏研究流' : '显示研究流：记录、证据、论文、审阅'"
                  @click="sideWorkPanel = sideWorkPanel === 'workflow' ? null : 'workflow'"
                >
                  研
                </button>
                <button
                  v-if="editorOutlineAvailable"
                  class="toolbar-icon outline-toggle-button"
                  :class="{ active: sideWorkPanel === 'outline' }"
                  :title="sideWorkPanel === 'outline' ? '隐藏大纲' : '显示当前文件大纲'"
                  @click="sideWorkPanel = sideWorkPanel === 'outline' ? null : 'outline'"
                >
                  ☷<small v-if="activeFileOutlineCount">{{ activeFileOutlineCount }}</small>
                </button>
                <button v-if="isLatexActive || activeDocument?.kind === 'bibtex'" class="toolbar-icon" :class="{ active: sideWorkPanel === 'bib' }" title="参考文献" @click="sideWorkPanel = sideWorkPanel === 'bib' ? null : 'bib'">📚</button>
                <button v-if="['latex','markdown'].includes(activeDocument?.kind || '')" class="toolbar-icon" :class="{ active: sideWorkPanel === 'snippets' }" title="片段" @click="sideWorkPanel = sideWorkPanel === 'snippets' ? null : 'snippets'">⌘</button>
              </div>
              <div class="editor-title">
                <span>编辑</span>
                <small>{{ activeDocument?.relativePath || activeDocument?.title || '未打开文档' }}</small>
              </div>
            </div>
            <div class="editor-header-actions">
              <span class="writing-stats-pill" :title="'当前文件统计：' + activeWritingStatsLabel">{{ activeWritingStatsLabel }}</span>
              <button
                v-if="previewCapable && !previewOnlyDocument"
                class="toolbar-icon"
                :class="{ active: effectivePreviewVisible }"
                title="切换预览栏（Ctrl/Cmd+Alt+V，双击标题栏也可切换）"
                @click="togglePreviewPane"
              >
                ◫
              </button>
              <button class="toolbar-icon" :class="{ active: bottomPanelVisible }" title="问题 / 输出 / 日志" @click="bottomPanelVisible = !bottomPanelVisible">⚠</button>
              <span
                v-if="activeDiagnosticCount"
                class="editor-diagnostic-pill"
                :class="{ error: activeDiagnosticErrorCount }"
                :title="`${activeDiagnosticErrorCount} 个错误，${activeDiagnosticCount - activeDiagnosticErrorCount} 个警告`"
              >
                {{ activeDiagnosticErrorCount ? '●' : '▲' }} {{ activeDiagnosticCount }}
              </span>
            </div>
          </div>
          <div
            class="editor-body-layout"
            :class="{ 'side-panel-visible': !!sideWorkPanel }"
            :style="editorBodyLayoutStyle"
          >
            <div v-if="sideWorkPanel" class="editor-side-panel-slot">
              <ResearchFlowPanel
                v-if="sideWorkPanel === 'workflow'"
                :active-path="activeDocument?.relativePath || activeDocument?.title"
                :writing-stats-label="activeWritingStatsLabel"
                :latex-index="latexIndex"
                :annotations="annotations"
                :flow-statuses="researchFlowStatuses"
                :busy="busy"
                @action="runResearchFlowAction"
                @open-latest="store.openResearchFlowEntry"
                @close="sideWorkPanel = null"
              />
              <EditorOutlinePanel
                v-else-if="editorOutlineAvailable && sideWorkPanel === 'outline'"
                :outline="latexIndex.outline"
                :active="activeDocument"
                :active-line="editorCursorLine"
                @open="store.openLatexOutlineItem"
                @close="sideWorkPanel = null"
              />
              <BibManagerPanel
                v-else-if="sideWorkPanel === 'bib'"
                :entries="latexIndex.citations"
                @open="store.jumpToBibEntry"
                @create="store.createBibEntry"
                @edit="store.updateBibEntryRaw"
                @remove="store.removeBibEntry"
                @close="sideWorkPanel = null"
              />
              <SnippetPanel v-else-if="sideWorkPanel === 'snippets'" :kind="activeDocument?.kind" @close="sideWorkPanel = null" />
              <HistoryPanel v-else-if="sideWorkPanel === 'history'" :entries="gitEntries" :local="workspace?.source === 'local'" @close="sideWorkPanel = null" />
            </div>
            <div
              v-if="sideWorkPanel"
              class="resize-handle vertical editor-side-resize"
              title="拖动调整编辑侧栏宽度"
              @mousedown="startResize('editorSide', $event)"
            />
            <div class="editor-stack">
              <div class="editor-code-pane editor-group" @mousedown="focusEditorDocument(primaryDocument?.id)" @wheel.capture="onEditorWheelZoom">
                <MarkdownEditor
                  :key="primaryDocument?.id || 'empty-editor'"
                  v-model="primaryText"
                  :dark-mode="darkMode"
                  :kind="primaryDocument?.kind"
                  :goto-line="activeDocumentId === primaryDocument?.id ? editorGotoLine : null"
                  :latex-index="latexIndex"
                  :diagnostics="activeDocumentId === primaryDocument?.id ? activeDocumentDiagnostics : []"
                  :root-dir="workspace?.localDir"
                  :current-path="primaryDocument?.relativePath"
                  :font-size="editorFontSize"
                  @save="saveLocal"
                  @build="buildLatex"
                  @source-dblclick="syncTexForward"
                  @markdown-source-click="syncMarkdownPreview"
                  @latex-navigate="handleLatexNavigate"
                  @bib-preview="store.setActiveBibPreviewKey"
                  @cursor-line="store.setEditorCursorLine"
                />
                <BibPreviewPopover
                  v-if="sideWorkPanel !== 'bib' && activeDocumentId === primaryDocument?.id"
                  :entry="activeBibPreview"
                  @open="store.jumpToBibEntry"
                  @close="store.setActiveBibPreviewKey(undefined)"
                />
              </div>
            </div>
          </div>
        </div>
        <div
          v-if="splitLayoutActive"
          class="resize-handle vertical in-editor"
          title="拖动调整预览宽度"
          @mousedown="startResize('preview', $event)"
        />
        <div v-if="effectivePreviewVisible" class="preview-column">
          <div v-if="!pdfPreviewActive" class="preview-header pane-header" :title="previewHeaderTitle" @dblclick="onPreviewHeaderDblclick">
            <span>预览</span>
            <div class="preview-header-actions">
              <button
                v-if="editorAreaVisible"
                class="toolbar-icon preview-action-button icon-only"
                :class="{ active: effectiveEditorVisible }"
                title="切换编辑栏（Ctrl/Cmd+Alt+E，双击标题栏也可切换）"
                aria-label="切换编辑栏"
                @click="toggleEditorPane"
              >
                ✎
              </button>
              <div v-if="activeDocument?.kind === 'markdown'" class="preview-export-control">
                <button
                  class="preview-export-button"
                  :class="{ active: previewExportMenuVisible }"
                  title="导出 Markdown"
                  @click.stop="previewExportMenuVisible = !previewExportMenuVisible"
                >
                  导出
                </button>
                <div v-if="previewExportMenuVisible" class="preview-export-menu" @click.stop>
                  <button :disabled="busy" @click="exportMarkdownFormat('pdf')"><strong>PDF</strong><small>Pandoc + LaTeX</small></button>
                  <button :disabled="busy" @click="exportMarkdownFormat('docx')"><strong>DOCX</strong><small>Word 协作</small></button>
                  <button :disabled="busy" @click="exportMarkdownFormat('html')"><strong>HTML</strong><small>网页发布</small></button>
                  <button :disabled="busy" @click="exportMarkdownFormat('latex')"><strong>LaTeX</strong><small>生成 .tex</small></button>
                  <button :disabled="busy" @click="exportMarkdownFormat('beamer')"><strong>Beamer</strong><small>幻灯片 PDF</small></button>
                  <button :disabled="busy" @click="exportMarkdownFormat('epub')"><strong>EPUB</strong><small>电子书</small></button>
                </div>
              </div>
              <button
                v-if="activeDocument?.kind === 'markdown' && pdfPreviewUrl"
                class="toolbar-icon preview-action-button"
                title="查看 Pandoc 生成的 PDF"
                @click="previewExportMenuVisible = false; markdownPdfPreviewMode = true"
              >
                查看 PDF
              </button>
              <button
                v-if="annotationPanelAvailable"
                class="toolbar-icon"
                :class="{ active: annotationPanelVisible }"
                :title="annotationPanelVisible ? '隐藏批注' : '显示批注'"
                @click="annotationPanelVisible = !annotationPanelVisible"
              >
                {{ annotationPanelVisible ? '▥' : '▤' }}
              </button>
            </div>
          </div>
          <div
            v-if="activeDocument?.kind === 'markdown' && !markdownPdfPreviewMode"
            class="paper-review-layout markdown-review-layout"
            :class="{ 'annotation-hidden': !annotationPanelVisible }"
            :style="paperReviewLayoutStyle"
          >
            <div class="markdown-review-pane">
              <MarkdownPreview
                :text="activeText"
                :dark-mode="darkMode"
                :root-dir="workspace?.localDir"
                :current-path="activeDocument?.relativePath"
                :annotations="visibleAnnotations"
                :active-annotation-id="activeAnnotationId"
                :active-source-line="markdownPreviewLine"
                :render-preset="markdownRenderPreset"
                @create-annotation="createMarkdownPreviewAnnotation"
                @focus-annotation="store.focusAnnotation"
                @source-click="syncMarkdownEditor"
              />
            </div>
            <div
              v-if="annotationPanelVisible"
              class="resize-handle vertical annotation-resize"
              title="拖动调整批注栏宽度"
              @mousedown="startResize('annotation', $event)"
            />
            <AnnotationSidebar
              v-if="annotationPanelVisible"
              :annotations="visibleAnnotations"
              :active-id="activeAnnotationId"
              :latex-active="isLatexActive"
              :active-path="activeDocument?.relativePath"
              @jump="store.focusAnnotation"
              @status="store.updateAnnotationStatus"
              @reply="store.addAnnotationReply"
              @edit-message="store.updateAnnotationMessage"
              @export="store.exportAnnotations"
              @export-markdown="store.exportAnnotationsMarkdown"
              @task="store.convertAnnotationToTask"
              @remove="store.removeAnnotation"
              @close="annotationPanelVisible = false"
            />
          </div>

          <div
            v-else-if="activeDocument?.kind === 'markdown' && markdownPdfPreviewMode && pdfPreviewUrl"
            class="paper-review-layout"
            :class="{ 'annotation-hidden': !annotationPanelVisible }"
            :style="paperReviewLayoutStyle"
          >
            <div class="markdown-pdf-preview-shell">
              <div class="markdown-pdf-return-bar pane-header" :title="previewHeaderTitle" @dblclick="onPreviewHeaderDblclick">
                <button class="toolbar-icon" title="返回 Markdown 预览" @click="markdownPdfPreviewMode = false">MD</button>
                <span>Pandoc PDF</span>
              </div>
              <PdfPreview
                :data-url="pdfPreviewUrl"
                :sync-point="pdfSyncPoint"
                :render-quality="pdfRenderQuality"
                :annotations="visiblePdfAnnotations"
                :active-annotation-id="activeAnnotationId"
                :annotation-panel-visible="annotationPanelVisible"
                :annotation-panel-available="annotationPanelAvailable"
                @topbar-dblclick="onPreviewHeaderDblclick"
                @toggle-annotation-panel="annotationPanelVisible = !annotationPanelVisible"
                @create-annotation="createPdfAnnotation"
                @focus-annotation="store.focusAnnotation"
              />
            </div>
            <div
              v-if="annotationPanelVisible"
              class="resize-handle vertical annotation-resize"
              title="拖动调整批注栏宽度"
              @mousedown="startResize('annotation', $event)"
            />
            <AnnotationSidebar
              v-if="annotationPanelVisible"
              :annotations="visibleAnnotations"
              :active-id="activeAnnotationId"
              :latex-active="isLatexActive"
              :active-path="activeDocument?.relativePath"
              @jump="store.focusAnnotation"
              @status="store.updateAnnotationStatus"
              @reply="store.addAnnotationReply"
              @edit-message="store.updateAnnotationMessage"
              @export="store.exportAnnotations"
              @export-markdown="store.exportAnnotationsMarkdown"
              @task="store.convertAnnotationToTask"
              @remove="store.removeAnnotation"
              @close="annotationPanelVisible = false"
            />
          </div>
          <div
            v-else-if="activeDocument?.kind === 'image'"
            class="image-preview"
          >
            <div class="asset-toolbar pane-header" :title="previewHeaderTitle" @dblclick="onPreviewHeaderDblclick">
              <button
                class="toolbar-icon"
                title="缩小图片"
                @click="zoomImage(-0.15)"
              >
                −
              </button>
              <span class="zoom-label">{{ Math.round(imageZoom * 100) }}%</span>
              <button
                class="toolbar-icon"
                title="放大图片"
                @click="zoomImage(0.15)"
              >
                ＋
              </button>
              <button
                class="toolbar-icon"
                title="重置缩放"
                @click="imageZoom = 1"
              >
                1:1
              </button>
            </div>
            <div
              class="image-canvas"
              @wheel="onImageWheel"
              @gesturestart="onImageGestureStart"
              @gesturechange="onImageGestureChange"
            >
              <img
                :src="activeText"
                :alt="activeDocument?.title"
                :style="{ transform: `scale(${imageZoom})` }"
              />
            </div>
            <p>{{ activeDocument?.relativePath }}</p>
          </div>
          <div
            v-else-if="activeDocument?.kind === 'pdf'"
            class="paper-review-layout"
            :class="{ 'annotation-hidden': !annotationPanelVisible }"
            :style="paperReviewLayoutStyle"
          >
            <PdfPreview
              :data-url="activeText"
              :sync-point="pdfSyncPoint"
              :render-quality="pdfRenderQuality"
              :annotations="visiblePdfAnnotations"
              :active-annotation-id="activeAnnotationId"
              :annotation-panel-visible="annotationPanelVisible"
              :annotation-panel-available="annotationPanelAvailable"
              @topbar-dblclick="onPreviewHeaderDblclick"
              @toggle-annotation-panel="annotationPanelVisible = !annotationPanelVisible"
              @reverse-click="syncTexReverse"
              @create-annotation="createPdfAnnotation"
              @focus-annotation="store.focusAnnotation"
            />
            <div
              v-if="annotationPanelVisible"
              class="resize-handle vertical annotation-resize"
              title="拖动调整批注栏宽度"
              @mousedown="startResize('annotation', $event)"
            />
            <AnnotationSidebar
              v-if="annotationPanelVisible"
              :annotations="visibleAnnotations"
              :active-id="activeAnnotationId"
              :latex-active="isLatexActive"
              :active-path="activeDocument?.relativePath"
              @jump="store.focusAnnotation"
              @status="store.updateAnnotationStatus"
              @reply="store.addAnnotationReply"
              @edit-message="store.updateAnnotationMessage"
              @export="store.exportAnnotations"
              @export-markdown="store.exportAnnotationsMarkdown"
              @task="store.convertAnnotationToTask"
              @remove="store.removeAnnotation"
              @close="annotationPanelVisible = false"
            />
          </div>
          <div
            v-else-if="activeDocument?.kind === 'latex' && pdfPreviewUrl"
            class="paper-review-layout"
            :class="{ 'annotation-hidden': !annotationPanelVisible }"
            :style="paperReviewLayoutStyle"
          >
            <PdfPreview
              :data-url="pdfPreviewUrl"
              :sync-point="pdfSyncPoint"
              :render-quality="pdfRenderQuality"
              :annotations="visiblePdfAnnotations"
              :active-annotation-id="activeAnnotationId"
              :annotation-panel-visible="annotationPanelVisible"
              :annotation-panel-available="annotationPanelAvailable"
              @topbar-dblclick="onPreviewHeaderDblclick"
              @toggle-annotation-panel="annotationPanelVisible = !annotationPanelVisible"
              @reverse-click="syncTexReverse"
              @create-annotation="createPdfAnnotation"
              @focus-annotation="store.focusAnnotation"
            />
            <div
              v-if="annotationPanelVisible"
              class="resize-handle vertical annotation-resize"
              title="拖动调整批注栏宽度"
              @mousedown="startResize('annotation', $event)"
            />
            <AnnotationSidebar
              v-if="annotationPanelVisible"
              :annotations="visibleAnnotations"
              :active-id="activeAnnotationId"
              :latex-active="isLatexActive"
              :active-path="activeDocument?.relativePath"
              @jump="store.focusAnnotation"
              @status="store.updateAnnotationStatus"
              @reply="store.addAnnotationReply"
              @edit-message="store.updateAnnotationMessage"
              @export="store.exportAnnotations"
              @export-markdown="store.exportAnnotationsMarkdown"
              @task="store.convertAnnotationToTask"
              @remove="store.removeAnnotation"
              @close="annotationPanelVisible = false"
            />
          </div>
          <div v-else class="latex-placeholder">
            <h2>
              {{
                activeDocument?.kind === "latex"
                  ? "LaTeX / PDF 预览"
                  : "文本文件"
              }}
            </h2>
            <p v-if="activeDocument?.kind === 'latex'">
              打开 <code>.tex</code> 时会优先显示同名已构建 PDF；没有 PDF 时按
              <kbd>Ctrl/Cmd+B</kbd> 构建。
            </p>
            <p v-if="activeDocument?.kind === 'latex'">
              构建成功后：双击左侧 TeX 源码会定位到 PDF 对应页；双击右侧 PDF
              会尝试反向定位到 TeX 源文件。
            </p>
            <p>
              当前文件：<code>{{
                activeDocument?.relativePath || activeDocument?.title
              }}</code>
            </p>
          </div>
        </div>
      </section>

      <div
        v-if="gitPanelVisible"
        class="resize-handle vertical"
        title="拖动调整设置栏宽度"
        @mousedown="startResize('settings', $event)"
      />
      <GitPanel
        v-if="gitPanelVisible"
        :visible="gitPanelVisible"
        :user-hint="githubUserHint"
        :workspace="workspace"
        :comment-author-name="commentAuthorName"
        :git-entries="gitEntries"
        :busy="busy"
        :git-busy="gitBusy"
        :workspace-busy="workspaceBusy"
        :latex-busy="latexBusy"
        :latex-active="isLatexActive"
        :latex-result="latexResult"
        :pdf-render-quality="pdfRenderQuality"
        :markdown-render-preset="markdownRenderPreset"
        :tool-paths="toolPaths"
        :environment-checks="environmentChecks"
        :recovery-warning="recoveryWarning"
        :draft-count="draftCount"
        :project-settings="projectSettings"
        :export-profiles="exportProfiles"
        @set-token="store.setGithubToken"
        @forget-token="store.forgetGithubToken"
        @clone="store.cloneWorkspace"
        @update-author-name="store.setCommentAuthorName"
        @refresh="store.refreshWorkspace"
        @submit="submitGithub"
        @build-latex="buildLatex"
        @clean-latex="store.cleanLatex"
        @open-pdf="store.openCurrentPdf"
        @update-pdf-render-quality="store.setPdfRenderQuality"
        @update-markdown-render-preset="store.setMarkdownRenderPreset"
        @set-tool-path="store.setToolPath"
        @check-environment="store.runEnvironmentCheck"
        @create-snapshot="store.createLocalSnapshot"
        @export-debug="store.exportDebugBundle"
        @update-project-setting="store.setProjectSetting"
        @hide="gitPanelVisible = false"
      />
    </main>

    <BuildPanel
      v-if="bottomPanelVisible"
      :diagnostics="activeDocumentDiagnostics"
      :latex-result="latexResult"
      :style="bottomPanelStyle"
      @resize-start="startResize('bottom', $event)"
      @open-diagnostic="handleDiagnosticOpen"
      @close="bottomPanelVisible = false"
    />



    <footer class="statusbar">
      <button class="link-button" @click="darkMode = !darkMode">
        {{ darkMode ? "浅色" : "深色" }}
      </button>
      <button class="link-button" @click="store.refreshWorkspace">刷新工作区</button>
      <button class="link-button" @click="sideWorkPanel = sideWorkPanel === 'history' ? null : 'history'">历史</button>
      <button class="link-button" @click="bottomPanelVisible = !bottomPanelVisible">问题</button>
      <span>{{ busy ? "处理中…" : status }}</span>
      <span v-if="activeDocumentId"
        >当前：{{ activeDocument?.relativePath || activeDocument?.title }}</span
      >
      <span v-if="error" class="error">{{ error }}</span>
    </footer>
  </div>
</template>
