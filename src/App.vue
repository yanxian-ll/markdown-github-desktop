<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { storeToRefs } from 'pinia';
import Explorer from './components/Explorer.vue';
import GitPanel from './components/GitPanel.vue';
import MarkdownEditor from './components/MarkdownEditor.vue';
import MarkdownPreview from './components/MarkdownPreview.vue';
import PdfPreview from './components/PdfPreview.vue';
import AnnotationSidebar from './components/AnnotationSidebar.vue';
import Toolbar from './components/Toolbar.vue';
import { useAppStore } from './stores/appStore';
import type { FileNode } from './types/app';

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
  activeAnnotationId,
  visibleAnnotations,
  visiblePdfAnnotations,
  visibleSourceAnnotations,
  previewVisible,
  status,
  workspace,
} = storeToRefs(store);

const activeText = computed({
  get: () => activeDocument.value?.text ?? '',
  set: (value: string) => store.updateActiveText(value),
});

const explorerWidth = ref(280);
const settingsWidth = ref(360);
const previewWidth = ref(560);
const imageZoom = ref(1);
let resizeTarget: 'explorer' | 'settings' | 'preview' | null = null;

const layoutClass = computed(() => ({
  'explorer-hidden': !explorerVisible.value,
  'git-hidden': !gitPanelVisible.value,
  'preview-hidden': !previewVisible.value,
  resizing: !!resizeTarget,
}));

const workspaceStyle = computed(() => {
  const columns: string[] = [];
  if (explorerVisible.value) columns.push(`${explorerWidth.value}px`, '6px');
  columns.push('minmax(360px, 1fr)');
  if (gitPanelVisible.value) columns.push('6px', `${settingsWidth.value}px`);
  return { gridTemplateColumns: columns.join(' ') };
});

const editorLayoutStyle = computed(() => {
  if (!previewVisible.value) return { gridTemplateColumns: '1fr' };
  return { gridTemplateColumns: `minmax(220px, 1fr) 6px ${previewWidth.value}px` };
});

let imageGestureBaseZoom = 1;
let persistTimer: number | undefined;
watch(
  () => [darkMode.value, previewVisible.value, explorerVisible.value, gitPanelVisible.value, activeDocumentId.value],
  () => {
    window.clearTimeout(persistTimer);
    persistTimer = window.setTimeout(() => store.persist(), 500);
  },
);

watch(
  () => activeDocument.value?.relativePath,
  () => {
    imageZoom.value = 1;
  },
);

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function startResize(target: 'explorer' | 'settings' | 'preview', event: MouseEvent) {
  resizeTarget = target;
  event.preventDefault();
  document.body.classList.add('drag-resizing');
}

function onResizeMove(event: MouseEvent) {
  if (!resizeTarget) return;
  const width = window.innerWidth;
  if (resizeTarget === 'explorer') {
    explorerWidth.value = clamp(event.clientX, 190, Math.min(560, width - 720));
  } else if (resizeTarget === 'settings') {
    settingsWidth.value = clamp(width - event.clientX, 280, Math.min(620, width - 720));
  } else if (resizeTarget === 'preview') {
    const rightPanelWidth = gitPanelVisible.value ? settingsWidth.value + 14 : 0;
    const leftWorkspaceWidth = explorerVisible.value ? explorerWidth.value + 6 : 0;
    const minEditorWidth = 220;
    const maxPreviewWidth = Math.max(360, width - leftWorkspaceWidth - rightPanelWidth - minEditorWidth - 24);
    previewWidth.value = clamp(width - event.clientX - rightPanelWidth, 320, maxPreviewWidth);
  }
}

function stopResize() {
  resizeTarget = null;
  document.body.classList.remove('drag-resizing');
}

function zoomImage(delta: number) {
  imageZoom.value = clamp(Number((imageZoom.value + delta).toFixed(2)), 0.2, 3);
}

function onImageWheel(event: WheelEvent) {
  const shouldZoom = event.ctrlKey || event.metaKey || event.altKey || Math.abs(event.deltaZ || 0) > 0;
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
  if (typeof gesture.scale !== 'number') return;
  imageZoom.value = clamp(Number((imageGestureBaseZoom * gesture.scale).toFixed(2)), 0.2, 3);
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

async function buildLatex() {
  try {
    await store.buildLatex();
  } catch (err) {
    store.error = err instanceof Error ? err.message : String(err);
  }
}

async function syncTexForward(payload: { line: number; column: number }) {
  try {
    await store.syncTexForwardFromEditor(payload.line, payload.column);
  } catch (err) {
    store.error = err instanceof Error ? err.message : String(err);
  }
}

async function syncTexReverse(payload: { page: number; x: number; y: number }) {
  try {
    await store.syncTexReverseFromPdf(payload.page, payload.x, payload.y);
  } catch (err) {
    store.error = err instanceof Error ? err.message : String(err);
  }
}


async function createPdfAnnotation(payload: { page: number; rect: { x: number; y: number; width: number; height: number }; body: string; x: number; y: number }) {
  try {
    await store.createPdfAnnotation(payload);
  } catch (err) {
    store.error = err instanceof Error ? err.message : String(err);
  }
}

async function createSourceAnnotation(payload?: { line: number; column: number }) {
  try {
    await store.createSourceAnnotation(payload?.line, payload?.column ?? 1);
  } catch (err) {
    store.error = err instanceof Error ? err.message : String(err);
  }
}

function onKeydown(event: KeyboardEvent) {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
    event.preventDefault();
    saveLocal();
  }
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'b' && isLatexActive.value) {
    event.preventDefault();
    buildLatex();
  }
}

onMounted(async () => {
  window.addEventListener('keydown', onKeydown);
  window.addEventListener('mousemove', onResizeMove);
  window.addEventListener('mouseup', stopResize);
  await store.initialize();
});

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown);
  window.removeEventListener('mousemove', onResizeMove);
  window.removeEventListener('mouseup', stopResize);
});
</script>

<template>
  <div class="app-shell" :class="[{ light: !darkMode }, layoutClass]">
    <Toolbar
      :active="activeDocument"
      :busy="gitBusy"
      :preview-visible="previewVisible"
      :explorer-visible="explorerVisible"
      :git-panel-visible="gitPanelVisible"
      :git-dirty-count="gitDirtyCount"
      @submit-github="submitGithub"
      @toggle-preview="previewVisible = !previewVisible"
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
        @hide="explorerVisible = false"
      />
      <div v-if="explorerVisible" class="resize-handle vertical" title="拖动调整文档栏宽度" @mousedown="startResize('explorer', $event)" />

      <section class="editor-layout" :class="{ 'preview-hidden': !previewVisible }" :style="editorLayoutStyle">
        <div class="editor-column">
          <div v-if="activeDocument?.kind === 'image' || activeDocument?.kind === 'pdf'" class="asset-editor-placeholder">
            <h2>{{ activeDocument?.kind === 'image' ? '图片资源' : 'PDF 文件' }}</h2>
            <p><code>{{ activeDocument?.relativePath || activeDocument?.title }}</code></p>
            <p>此类文件作为论文/Markdown 资源管理，不在文本编辑器中编辑。图片/PDF 会在右侧预览。</p>
          </div>
          <MarkdownEditor
            v-else
            v-model="activeText"
            :dark-mode="darkMode"
            :kind="activeDocument?.kind"
            :goto-line="editorGotoLine"
            :source-annotations="visibleSourceAnnotations"
            :active-annotation-id="activeAnnotationId"
            @save="saveLocal"
            @build="buildLatex"
            @source-dblclick="syncTexForward"
            @source-annotate="createSourceAnnotation"
            @focus-annotation="store.focusAnnotation"
          />
        </div>
        <div v-if="previewVisible" class="resize-handle vertical in-editor" title="拖动调整预览宽度" @mousedown="startResize('preview', $event)" />
        <div v-if="previewVisible" class="preview-column">
          <div class="preview-header">
            <span>预览</span>
            <button class="toolbar-icon" title="隐藏预览" @click="previewVisible = false">◫</button>
          </div>
          <MarkdownPreview
            v-if="activeDocument?.kind === 'markdown'"
            :text="activeText"
            :dark-mode="darkMode"
            :root-dir="workspace?.localDir"
            :current-path="activeDocument?.relativePath"
          />
          <div v-else-if="activeDocument?.kind === 'image'" class="image-preview">
            <div class="asset-toolbar">
              <button class="toolbar-icon" title="缩小图片" @click="zoomImage(-0.15)">−</button>
              <span class="zoom-label">{{ Math.round(imageZoom * 100) }}%</span>
              <button class="toolbar-icon" title="放大图片" @click="zoomImage(0.15)">＋</button>
              <button class="toolbar-icon" title="重置缩放" @click="imageZoom = 1">1:1</button>
            </div>
            <div class="image-canvas" @wheel="onImageWheel" @gesturestart="onImageGestureStart" @gesturechange="onImageGestureChange">
              <img :src="activeText" :alt="activeDocument?.title" :style="{ transform: `scale(${imageZoom})` }" />
            </div>
            <p>{{ activeDocument?.relativePath }}</p>
          </div>
          <div v-else-if="activeDocument?.kind === 'pdf'" class="paper-review-layout">
            <PdfPreview
              :data-url="activeText"
              :sync-point="pdfSyncPoint"
              :render-quality="pdfRenderQuality"
              :annotations="visiblePdfAnnotations"
              :active-annotation-id="activeAnnotationId"
              @reverse-click="syncTexReverse"
              @create-annotation="createPdfAnnotation"
              @focus-annotation="store.focusAnnotation"
            />
            <AnnotationSidebar
              :annotations="visibleAnnotations"
              :active-id="activeAnnotationId"
              :latex-active="isLatexActive"
              :active-path="activeDocument?.relativePath"
              @jump="store.focusAnnotation"
              @status="store.updateAnnotationStatus"
              @remove="store.removeAnnotation"
              @create-source="createSourceAnnotation"
            />
          </div>
          <div v-else-if="activeDocument?.kind === 'latex' && pdfPreviewUrl" class="paper-review-layout">
            <PdfPreview
              :data-url="pdfPreviewUrl"
              :sync-point="pdfSyncPoint"
              :render-quality="pdfRenderQuality"
              :annotations="visiblePdfAnnotations"
              :active-annotation-id="activeAnnotationId"
              @reverse-click="syncTexReverse"
              @create-annotation="createPdfAnnotation"
              @focus-annotation="store.focusAnnotation"
            />
            <AnnotationSidebar
              :annotations="visibleAnnotations"
              :active-id="activeAnnotationId"
              :latex-active="isLatexActive"
              :active-path="activeDocument?.relativePath"
              @jump="store.focusAnnotation"
              @status="store.updateAnnotationStatus"
              @remove="store.removeAnnotation"
              @create-source="createSourceAnnotation"
            />
          </div>
          <div v-else class="latex-placeholder">
            <h2>{{ activeDocument?.kind === 'latex' ? 'LaTeX / PDF 预览' : '文本文件' }}</h2>
            <p v-if="activeDocument?.kind === 'latex'">打开 <code>.tex</code> 时会优先显示同名已构建 PDF；没有 PDF 时按 <kbd>Ctrl/Cmd+B</kbd> 构建。</p>
            <p v-if="activeDocument?.kind === 'latex'">构建成功后：双击左侧 TeX 源码会定位到 PDF 对应页；双击右侧 PDF 会尝试反向定位到 TeX 源文件。</p>
            <p>当前文件：<code>{{ activeDocument?.relativePath || activeDocument?.title }}</code></p>
          </div>
        </div>
      </section>

      <div v-if="gitPanelVisible" class="resize-handle vertical" title="拖动调整设置栏宽度" @mousedown="startResize('settings', $event)" />
      <GitPanel
        v-if="gitPanelVisible"
        :visible="gitPanelVisible"
        :user-hint="githubUserHint"
        :workspace="workspace"
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
        @refresh="store.refreshWorkspace"
        @submit="submitGithub"
        @build-latex="buildLatex"
        @clean-latex="store.cleanLatex"
        @open-pdf="store.openCurrentPdf"
        @update-pdf-render-quality="store.setPdfRenderQuality"
        @hide="gitPanelVisible = false"
      />
    </main>

    <footer class="statusbar">
      <button class="link-button" @click="darkMode = !darkMode">{{ darkMode ? '浅色' : '深色' }}</button>
      <button class="link-button" @click="store.refreshWorkspace">刷新工作区</button>
      <span>{{ busy ? '处理中…' : status }}</span>
      <span v-if="activeDocumentId">当前：{{ activeDocument?.relativePath || activeDocument?.title }}</span>
      <span v-if="error" class="error">{{ error }}</span>
    </footer>
  </div>
</template>
