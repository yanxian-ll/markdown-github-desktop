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
import ExportPanel from './components/ExportPanel.vue';
import HistoryPanel from './components/HistoryPanel.vue';
import { useAppStore } from "./stores/appStore";
import type { FileNode, PaperAnnotationRect } from "./types/app";

const store = useAppStore();
const {
  activeDocument,
  activeDocumentId,
  busy,
  darkMode,
  dirtyCount,
  error,
  explorerVisible,
  fileTree,
  selectedNodePath,
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
  editorGotoLine,
  editorCursorLine,
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
} = storeToRefs(store);

const activeText = computed({
  get: () => activeDocument.value?.text ?? "",
  set: (value: string) => store.updateActiveText(value),
});

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
const splitLayoutActive = computed(
  () => editorAreaVisible.value && effectivePreviewVisible.value,
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
const imageZoom = ref(1);
const markdownPdfPreviewMode = ref(false);
const annotationPanelVisible = ref(false);
const annotationPanelWidth = ref(300);
const editorOutlineVisible = ref(false);
const sideWorkPanel = ref<'outline' | 'bib' | 'snippets' | 'export' | 'history' | null>(null);
const bottomPanelVisible = ref(false);
let resizeTarget: "explorer" | "settings" | "preview" | "annotation" | null =
  null;
let annotationResizeRight = 0;

const layoutClass = computed(() => ({
  "explorer-hidden": !explorerVisible.value,
  "git-hidden": !gitPanelVisible.value,
  "preview-hidden": !previewVisible.value,
  resizing: !!resizeTarget,
}));

const workspaceStyle = computed(() => {
  const columns: string[] = [];
  if (explorerVisible.value) columns.push(`${explorerWidth.value}px`, "6px");
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

let imageGestureBaseZoom = 1;
let persistTimer: number | undefined;
watch(
  () => [
    darkMode.value,
    previewVisible.value,
    explorerVisible.value,
    gitPanelVisible.value,
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
    annotationPanelVisible.value = false;
    editorOutlineVisible.value = false;
    sideWorkPanel.value = null;
  },
);

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function startResize(
  target: "explorer" | "settings" | "preview" | "annotation",
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
  event.preventDefault();
  document.body.classList.add("drag-resizing");
}

function onResizeMove(event: MouseEvent) {
  if (!resizeTarget) return;
  const width = window.innerWidth;
  if (resizeTarget === "explorer") {
    explorerWidth.value = clamp(event.clientX, 190, Math.min(560, width - 720));
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
    const leftWorkspaceWidth = explorerVisible.value
      ? explorerWidth.value + 6
      : 0;
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
  }
}

function stopResize() {
  resizeTarget = null;
  document.body.classList.remove("drag-resizing");
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

function togglePreviewPane() {
  if (!previewCapable.value || previewOnlyDocument.value) return;
  previewVisible.value = !previewVisible.value;
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
}

onMounted(async () => {
  window.addEventListener("keydown", onKeydown);
  window.addEventListener("mousemove", onResizeMove);
  window.addEventListener("mouseup", stopResize);
  await store.initialize();
});

onBeforeUnmount(() => {
  window.removeEventListener("keydown", onKeydown);
  window.removeEventListener("mousemove", onResizeMove);
  window.removeEventListener("mouseup", stopResize);
});
</script>

<template>
  <div class="app-shell" :class="[{ light: !darkMode }, layoutClass]">
    <Toolbar
      :active="activeDocument"
      :busy="gitBusy"
      :preview-visible="effectivePreviewVisible"
      :explorer-visible="explorerVisible"
      :git-panel-visible="gitPanelVisible"
      :git-dirty-count="gitDirtyCount"
      :github-workspace="workspace?.source !== 'local' && !!workspace?.localDir"
      @submit-github="submitGithub"
      @toggle-preview="togglePreviewPane"
      @toggle-explorer="explorerVisible = !explorerVisible"
      @toggle-git-panel="gitPanelVisible = !gitPanelVisible"
    />

    <main class="workspace" :style="workspaceStyle">
      <Explorer
        v-if="explorerVisible"
        :visible="explorerVisible"
        :tree="fileTree"
        :active="activeDocument"
        :dirty-count="dirtyCount"
        :selected-path="selectedNodePath"
        @open="store.openWorkspaceFile"
        @rename="store.renameItem"
        @create="createItem"
        @delete="removeItem"
        @select="store.selectNode"
        @move="moveItem"
        @refresh="store.refreshWorkspace"
        @open-local="store.openLocalEntry"
        @hide="explorerVisible = false"
      />
      <div
        v-if="explorerVisible"
        class="resize-handle vertical"
        title="拖动调整文档栏宽度"
        @mousedown="startResize('explorer', $event)"
      />

      <section
        class="editor-layout"
        :class="{ 'preview-hidden': !effectivePreviewVisible, 'editor-hidden': !editorAreaVisible }"
        :style="editorLayoutStyle"
      >
        <div v-if="editorAreaVisible" class="editor-column">
          <div class="editor-header">
            <div class="editor-header-left">
              <button
                v-if="editorOutlineAvailable"
                class="toolbar-icon outline-toggle-button"
                :class="{ active: sideWorkPanel === 'outline' }"
                :title="sideWorkPanel === 'outline' ? '隐藏大纲' : '显示当前文件大纲'"
                @click="sideWorkPanel = sideWorkPanel === 'outline' ? null : 'outline'"
              >
                ☷<small v-if="activeFileOutlineCount">{{ activeFileOutlineCount }}</small>
              </button>
              <div class="editor-title">
                <span>编辑</span>
                <small>{{ activeDocument?.relativePath || activeDocument?.title || '未打开文档' }}</small>
              </div>
            </div>
            <div class="editor-header-actions">
              <span class="writing-stats-pill" :title="'当前文件统计：' + activeWritingStatsLabel">{{ activeWritingStatsLabel }}</span>
              <button v-if="isLatexActive || activeDocument?.kind === 'bibtex'" class="toolbar-icon" :class="{ active: sideWorkPanel === 'bib' }" title="参考文献" @click="sideWorkPanel = sideWorkPanel === 'bib' ? null : 'bib'">☷</button>
              <button v-if="['latex','markdown'].includes(activeDocument?.kind || '')" class="toolbar-icon" :class="{ active: sideWorkPanel === 'snippets' }" title="片段" @click="sideWorkPanel = sideWorkPanel === 'snippets' ? null : 'snippets'">⌘</button>
              <button v-if="activeDocument?.kind === 'markdown'" class="toolbar-icon" :class="{ active: sideWorkPanel === 'export' }" title="导出" @click="sideWorkPanel = sideWorkPanel === 'export' ? null : 'export'">⇪</button>
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
            :class="{ 'outline-visible': !!sideWorkPanel }"
          >
            <EditorOutlinePanel
              v-if="editorOutlineAvailable && sideWorkPanel === 'outline'"
              :outline="latexIndex.outline"
              :active="activeDocument"
              :active-line="editorCursorLine"
              @open="store.openLatexOutlineItem"
              @close="sideWorkPanel = null"
            />
            <BibManagerPanel v-if="sideWorkPanel === 'bib'" :entries="latexIndex.citations" @open="store.jumpToBibEntry" @close="sideWorkPanel = null" />
            <SnippetPanel v-if="sideWorkPanel === 'snippets'" :kind="activeDocument?.kind" @close="sideWorkPanel = null" />
            <ExportPanel v-if="sideWorkPanel === 'export'" :active-kind="activeDocument?.kind" :busy="busy" @export-format="exportMarkdownFormat" @close="sideWorkPanel = null" />
            <HistoryPanel v-if="sideWorkPanel === 'history'" :entries="gitEntries" :local="workspace?.source === 'local'" @close="sideWorkPanel = null" />
            <div class="editor-code-pane">
              <MarkdownEditor
                v-model="activeText"
                :dark-mode="darkMode"
                :kind="activeDocument?.kind"
                :goto-line="editorGotoLine"
                :latex-index="latexIndex"
                :diagnostics="activeDocumentDiagnostics"
                :root-dir="workspace?.localDir"
                :current-path="activeDocument?.relativePath"
                @save="saveLocal"
                @build="buildLatex"
                @source-dblclick="syncTexForward"
                @markdown-source-click="syncMarkdownPreview"
                @latex-navigate="handleLatexNavigate"
                @bib-preview="store.setActiveBibPreviewKey"
                @cursor-line="store.setEditorCursorLine"
              />
              <BibPreviewPopover
                :entry="activeBibPreview"
                @open="store.jumpToBibEntry"
                @close="store.setActiveBibPreviewKey(undefined)"
              />
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
          <div v-if="!pdfPreviewActive" class="preview-header">
            <span>预览</span>
            <div class="preview-header-actions">
              <button
                v-if="activeDocument?.kind === 'markdown'"
                class="toolbar-icon"
                title="使用 Pandoc 构建 Markdown PDF（Ctrl/⌘+B）"
                @click="buildActiveDocument"
              >
                ⎙
              </button>
              <button
                v-if="activeDocument?.kind === 'markdown' && pdfPreviewUrl"
                class="toolbar-icon"
                title="查看 Pandoc 生成的 PDF"
                @click="markdownPdfPreviewMode = true"
              >
                PDF
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
              @export-markdown="store.exportAnnotationsMarkdown"
              @remove="store.removeAnnotation"
            />
          </div>

          <div
            v-else-if="activeDocument?.kind === 'markdown' && markdownPdfPreviewMode && pdfPreviewUrl"
            class="paper-review-layout"
            :class="{ 'annotation-hidden': !annotationPanelVisible }"
            :style="paperReviewLayoutStyle"
          >
            <div class="markdown-pdf-preview-shell">
              <div class="markdown-pdf-return-bar">
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
              @export-markdown="store.exportAnnotationsMarkdown"
              @remove="store.removeAnnotation"
            />
          </div>
          <div
            v-else-if="activeDocument?.kind === 'image'"
            class="image-preview"
          >
            <div class="asset-toolbar">
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
              @export-markdown="store.exportAnnotationsMarkdown"
              @remove="store.removeAnnotation"
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
              @export-markdown="store.exportAnnotationsMarkdown"
              @remove="store.removeAnnotation"
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
        @hide="gitPanelVisible = false"
      />
    </main>

    <BuildPanel
      v-if="bottomPanelVisible"
      :diagnostics="activeDocumentDiagnostics"
      :latex-result="latexResult"
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
