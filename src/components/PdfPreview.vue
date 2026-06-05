<script setup lang="ts">
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
} from "vue";
import * as pdfjsLib from "pdfjs-dist";
import workerSrc from "pdfjs-dist/build/pdf.worker.mjs?url";
import type {
  PaperAnnotation,
  PaperAnnotationRect,
  PdfSyncPoint,
} from "../types/app";

pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;

const props = defineProps<{
  dataUrl?: string;
  syncPoint?: PdfSyncPoint | null;
  renderQuality?: number;
  annotations?: PaperAnnotation[];
  activeAnnotationId?: string;
}>();

const emit = defineEmits<{
  reverseClick: [payload: { page: number; x: number; y: number }];
  createAnnotation: [
    payload: {
      page: number;
      rect?: PaperAnnotationRect;
      rects?: PaperAnnotationRect[];
      body: string;
      x: number;
      y: number;
      textQuote?: string;
      kind?: "area" | "text" | "highlight";
    },
  ];
  focusAnnotation: [annotation: PaperAnnotation];
}>();

type RenderTaskLike = { promise: Promise<unknown>; cancel: () => void };
type PageMeta = {
  width: number;
  height: number;
  scale: number;
  baseWidth: number;
  baseHeight: number;
};
type DraftDrag = {
  page: number;
  startX: number;
  startY: number;
  pointerId: number;
};
type SelectionGesture = {
  page: number;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
};
type TextSelectionSegment = {
  rect: DOMRect;
  text: string;
};

const PRELOAD_PX = 900;
const renderQuality = computed(() =>
  Math.min(1.6, Math.max(0.45, props.renderQuality ?? 0.9)),
);
const viewMode = ref<"sync" | "annotate">("sync");
const isAnnotateMode = computed(() => viewMode.value === "annotate");
const fitMode = ref<"width" | "manual">("width");
const isAutoFit = computed(() => fitMode.value === "width");

const loading = ref(false);
const rendering = ref(false);
const error = ref("");
const container = ref<HTMLDivElement | null>(null);
const currentPage = ref(1);
const pageCount = ref(0);
const scale = ref(1);
const pageMetas = ref<Record<number, PageMeta>>({});
const pageBaseSizes = ref<Record<number, { width: number; height: number }>>(
  {},
);
const draftRect = ref<{ page: number; rect: PaperAnnotationRect } | null>(null);
const textSelection = ref<{
  page: number;
  rects: PaperAnnotationRect[];
  text: string;
  x: number;
  y: number;
  menuX: number;
  menuY: number;
  contextMenu: boolean;
} | null>(null);
const syncFlash = ref<{ point: PdfSyncPoint; nonce: number } | null>(null);
const pages = computed(() =>
  Array.from({ length: pageCount.value }, (_, index) => index + 1),
);

let renderToken = 0;
let pdfDocument: pdfjsLib.PDFDocumentProxy | null = null;
let lastDataUrl = "";
let loadingTask: ReturnType<typeof pdfjsLib.getDocument> | null = null;
let scrollRaf = 0;
let renderRaf = 0;
let scaleTimer = 0;
let syncFlashTimer = 0;
let activeRenderCount = 0;
let drag: DraftDrag | null = null;
let selectionGestureStart: { page: number; x: number; y: number } | null = null;
let resizeObserver: ResizeObserver | null = null;
let fitRaf = 0;

const pageCanvases = new Map<number, HTMLCanvasElement>();
const textLayers = new Map<number, HTMLDivElement>();
const renderedKeys = new Map<number, string>();
const renderTasks = new Map<number, RenderTaskLike>();
const pageRenderLocks = new Map<number, Promise<void>>();

function clampScale(value: number) {
  return Math.min(2.6, Math.max(0.35, Number(value.toFixed(2))));
}

function toggleAnnotateView() {
  viewMode.value = isAnnotateMode.value ? "sync" : "annotate";
}

function zoomIn() {
  fitMode.value = "manual";
  scale.value = clampScale(scale.value + 0.1);
}

function zoomOut() {
  fitMode.value = "manual";
  scale.value = clampScale(scale.value - 0.1);
}

function resetZoom() {
  fitMode.value = "manual";
  scale.value = 1;
}

function autoFitWidth() {
  fitMode.value = "width";
  updateAutoFitScale();
}

function goPage(delta: number) {
  if (!pageCount.value) return;
  scrollToPage(
    Math.min(pageCount.value, Math.max(1, currentPage.value + delta)),
  );
}

function setCanvasRef(page: number, el: Element | null) {
  if (el instanceof HTMLCanvasElement) pageCanvases.set(page, el);
  else pageCanvases.delete(page);
}

function setTextLayerRef(page: number, el: Element | null) {
  if (el instanceof HTMLDivElement) textLayers.set(page, el);
  else textLayers.delete(page);
}

function renderKey(page: number) {
  return `${page}:${scale.value}:${renderQuality.value}`;
}

function isPdfCancelError(err: unknown) {
  return (
    err instanceof Error &&
    (err.name === "RenderingCancelledException" ||
      err.message.includes("Worker was destroyed") ||
      err.message.includes("Rendering cancelled"))
  );
}

function cancelRenderTask(page?: number) {
  const entries =
    page == null
      ? Array.from(renderTasks.entries())
      : [[page, renderTasks.get(page)] as const];
  entries.forEach(([pageNumber, task]) => {
    if (!task) return;
    try {
      task.cancel();
    } catch {
      // Ignore pdf.js cancellation errors.
    }
  });
}

async function waitForRenderTasksToSettle() {
  const tasks = Array.from(renderTasks.values());
  await Promise.all(tasks.map((task) => task.promise.catch(() => undefined)));
}

async function clearRenderedPages(options: { resetCanvas?: boolean } = {}) {
  cancelRenderTask();
  renderedKeys.clear();
  textLayers.forEach((layer) => {
    layer.replaceChildren();
  });

  // pdf.js keeps a canvas locked until the previous render task has either
  // completed or its cancellation promise has settled.  During normal zoom /
  // resize invalidation we intentionally avoid touching the canvas size here;
  // the next queued render will resize it after the old task has settled.
  if (!options.resetCanvas) return;

  await waitForRenderTasksToSettle();
  pageCanvases.forEach((canvas) => {
    const ctx = canvas.getContext("2d");
    if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    canvas.width = 1;
    canvas.height = 1;
  });
}

function resetPageMetadata() {
  pageMetas.value = {};
  pageBaseSizes.value = {};
}

async function disposeDocument() {
  await clearRenderedPages({ resetCanvas: true });
  if (loadingTask) {
    try {
      await loadingTask.destroy();
    } catch {
      // Ignore cancellation while switching files.
    }
    loadingTask = null;
  }
  if (pdfDocument) {
    try {
      await pdfDocument.destroy();
    } catch {
      // Ignore destroy races.
    }
    pdfDocument = null;
  }
  resetPageMetadata();
}

async function primePageBaseSize(pageNumber = 1) {
  if (!pdfDocument || pageBaseSizes.value[pageNumber]) return;
  const page = await pdfDocument.getPage(pageNumber);
  const viewport = page.getViewport({ scale: 1 });
  pageBaseSizes.value = {
    ...pageBaseSizes.value,
    [pageNumber]: { width: viewport.width, height: viewport.height },
  };
}

function computeFitWidthScale(pageNumber = currentPage.value || 1) {
  const root = container.value;
  const base = pageBaseSizes.value[pageNumber] || pageBaseSizes.value[1];
  if (!root || !base?.width) return scale.value;
  const toolbarReserve = 0;
  const horizontalBreathingRoom = 24;
  const available = Math.max(
    260,
    root.clientWidth - toolbarReserve - horizontalBreathingRoom,
  );
  return clampScale(available / base.width);
}

function updateAutoFitScale() {
  if (fitMode.value !== "width") return;
  const next = computeFitWidthScale();
  if (Math.abs(next - scale.value) > 0.01) scale.value = next;
}

function scheduleAutoFit() {
  if (fitMode.value !== "width") return;
  window.cancelAnimationFrame(fitRaf);
  fitRaf = window.requestAnimationFrame(updateAutoFitScale);
}

async function loadDocument(force = false) {
  renderToken += 1;
  const token = renderToken;
  error.value = "";

  const preservedPage = Math.max(1, currentPage.value || 1);

  if (!props.dataUrl) {
    pageCount.value = 0;
    currentPage.value = 1;
    lastDataUrl = "";
    await disposeDocument();
    if (token === renderToken) loading.value = false;
    return;
  }

  if (!force && props.dataUrl === lastDataUrl && pdfDocument) {
    scheduleVisibleRender();
    return;
  }

  loading.value = true;
  try {
    await disposeDocument();
    if (token !== renderToken) return;
    loadingTask = pdfjsLib.getDocument(props.dataUrl);
    const doc = await loadingTask.promise;
    if (token !== renderToken) {
      await doc.destroy().catch(() => undefined);
      return;
    }
    pdfDocument = doc;
    lastDataUrl = props.dataUrl;
    pageCount.value = pdfDocument.numPages;
    currentPage.value = Math.min(pageCount.value || 1, preservedPage);
    await primePageBaseSize(1);
    updateAutoFitScale();
    await nextTick();
    scheduleVisibleRender();
    window.setTimeout(() => {
      if (token === renderToken) void scrollToPage(currentPage.value);
    }, 0);
  } catch (err) {
    if (token === renderToken && !isPdfCancelError(err)) {
      error.value = err instanceof Error ? err.message : String(err);
    }
  } finally {
    if (token === renderToken) loading.value = false;
  }
}

async function renderPage(pageNumber: number, expectedToken = renderToken) {
  const requestedKey = renderKey(pageNumber);
  if (
    !pdfDocument ||
    !pageCanvases.has(pageNumber) ||
    renderedKeys.get(pageNumber) === requestedKey
  )
    return;

  const previousLock = pageRenderLocks.get(pageNumber) ?? Promise.resolve();
  let trackedJob: Promise<void>;
  trackedJob = previousLock
    .catch(() => undefined)
    .then(() => renderPageLocked(pageNumber, expectedToken, requestedKey))
    .finally(() => {
      if (pageRenderLocks.get(pageNumber) === trackedJob)
        pageRenderLocks.delete(pageNumber);
    });
  pageRenderLocks.set(pageNumber, trackedJob);
  await trackedJob;
}

async function renderPageLocked(
  pageNumber: number,
  expectedToken: number,
  requestedKey: string,
) {
  if (!pdfDocument || !pageCanvases.has(pageNumber)) return;
  if (expectedToken !== renderToken || requestedKey !== renderKey(pageNumber))
    return;
  if (renderedKeys.get(pageNumber) === requestedKey) return;

  activeRenderCount += 1;
  rendering.value = true;
  let task: RenderTaskLike | null = null;
  try {
    const page = await pdfDocument.getPage(pageNumber);
    if (expectedToken !== renderToken || requestedKey !== renderKey(pageNumber))
      return;
    const canvas = pageCanvases.get(pageNumber);
    if (!canvas) return;
    const baseViewport = page.getViewport({ scale: 1 });
    if (!pageBaseSizes.value[pageNumber]) {
      pageBaseSizes.value = {
        ...pageBaseSizes.value,
        [pageNumber]: {
          width: baseViewport.width,
          height: baseViewport.height,
        },
      };
    }
    const displayViewport = page.getViewport({ scale: scale.value });
    const renderViewport = page.getViewport({
      scale: scale.value * renderQuality.value,
    });
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return;
    canvas.width = Math.max(1, Math.floor(renderViewport.width));
    canvas.height = Math.max(1, Math.floor(renderViewport.height));
    canvas.style.width = `${displayViewport.width}px`;
    canvas.style.height = `${displayViewport.height}px`;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    pageMetas.value = {
      ...pageMetas.value,
      [pageNumber]: {
        width: displayViewport.width,
        height: displayViewport.height,
        scale: scale.value,
        baseWidth: baseViewport.width,
        baseHeight: baseViewport.height,
      },
    };
    task = page.render({ canvasContext: ctx, viewport: renderViewport });
    renderTasks.set(pageNumber, task);
    await task.promise;
    if (expectedToken !== renderToken || requestedKey !== renderKey(pageNumber))
      return;
    await renderTextLayer(page, pageNumber, displayViewport, expectedToken);
    if (expectedToken !== renderToken || requestedKey !== renderKey(pageNumber))
      return;
    renderedKeys.set(pageNumber, requestedKey);
  } catch (err) {
    if (expectedToken === renderToken && !isPdfCancelError(err)) {
      error.value = err instanceof Error ? err.message : String(err);
    }
  } finally {
    if (task && renderTasks.get(pageNumber) === task)
      renderTasks.delete(pageNumber);
    activeRenderCount = Math.max(0, activeRenderCount - 1);
    rendering.value = activeRenderCount > 0;
  }
}

async function renderTextLayer(
  page: pdfjsLib.PDFPageProxy,
  pageNumber: number,
  viewport: unknown,
  expectedToken: number,
) {
  const layer = textLayers.get(pageNumber);
  if (!layer) return;
  layer.replaceChildren();
  const meta = pageMetas.value[pageNumber];
  const layerWidth = meta?.width ?? 0;
  const layerHeight = meta?.height ?? 0;
  layer.style.width = `${layerWidth}px`;
  layer.style.height = `${layerHeight}px`;
  // pdf.js text-layer geometry depends on this CSS variable in recent
  // versions.  Without it, text spans can align only at one accidental zoom
  // level, which makes saved annotation rectangles scale-dependent.
  layer.style.setProperty("--scale-factor", String(meta?.scale ?? scale.value));
  try {
    const textContent = await page.getTextContent();
    if (expectedToken !== renderToken) return;
    const TextLayerCtor = (
      pdfjsLib as unknown as {
        TextLayer?: new (args: unknown) => {
          render: () => Promise<void> | void;
        };
      }
    ).TextLayer;
    if (TextLayerCtor) {
      const textLayer = new TextLayerCtor({
        textContentSource: textContent,
        container: layer,
        viewport,
      });
      await textLayer.render();
      return;
    }
    // Fallback for environments where pdf.js TextLayer is not exported: keep a transparent selectable text dump.
    const fallback = document.createElement("div");
    fallback.className = "pdf-text-layer-fallback";
    fallback.textContent = textContent.items
      .map((item) => ("str" in item ? item.str : ""))
      .join(" ");
    layer.appendChild(fallback);
  } catch {
    // Text layer is optional; canvas and annotation overlay should remain usable.
  }
}

function scheduleVisibleRender() {
  window.cancelAnimationFrame(renderRaf);
  renderRaf = window.requestAnimationFrame(renderVisiblePages);
}

function renderVisiblePages() {
  const root = container.value;
  if (!root || !pdfDocument) return;
  const rootRect = root.getBoundingClientRect();
  const pageEls = Array.from(
    root.querySelectorAll<HTMLElement>(".pdf-page[data-page]"),
  );
  let nearestPage = currentPage.value;
  let nearestDistance = Number.POSITIVE_INFINITY;

  for (const el of pageEls) {
    const pageNumber = Number(el.dataset.page);
    const rect = el.getBoundingClientRect();
    const inRenderRange =
      rect.bottom >= rootRect.top - PRELOAD_PX &&
      rect.top <= rootRect.bottom + PRELOAD_PX;
    const inView = rect.bottom >= rootRect.top && rect.top <= rootRect.bottom;
    if (inRenderRange) void renderPage(pageNumber);
    if (inView) {
      const distance = Math.abs(rect.top - rootRect.top - 48);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestPage = pageNumber;
      }
    }
  }
  if (nearestPage !== currentPage.value) currentPage.value = nearestPage;
}

function onScroll() {
  window.cancelAnimationFrame(scrollRaf);
  scrollRaf = window.requestAnimationFrame(renderVisiblePages);
}

function onWheel(event: WheelEvent) {
  const shouldZoom =
    event.ctrlKey ||
    event.metaKey ||
    event.altKey ||
    Math.abs(event.deltaZ || 0) > 0;
  if (!shouldZoom) return;
  event.preventDefault();
  const direction = event.deltaY > 0 || event.deltaZ > 0 ? -1 : 1;
  fitMode.value = "manual";
  const next = clampScale(scale.value + direction * 0.08);
  if (next !== scale.value) scale.value = next;
}

let gestureBaseScale = 1;
function onGestureStart(event: Event) {
  event.preventDefault();
  gestureBaseScale = scale.value;
}

function onGestureChange(event: Event) {
  event.preventDefault();
  const gesture = event as Event & { scale?: number };
  if (typeof gesture.scale !== "number") return;
  fitMode.value = "manual";
  scale.value = clampScale(gestureBaseScale * gesture.scale);
}

function pageBoxStyle(page: number) {
  const meta = pageMetas.value[page];
  if (meta) {
    return {
      width: `${meta.width}px`,
      minHeight: `${meta.height}px`,
    };
  }
  const base = pageBaseSizes.value[page] || pageBaseSizes.value[1];
  if (base) {
    return {
      width: `${base.width * scale.value}px`,
      minHeight: `${base.height * scale.value}px`,
    };
  }
  return {
    width: `${Math.floor(650 * scale.value)}px`,
    minHeight: `${Math.floor(920 * scale.value)}px`,
  };
}

function normalizedPoint(event: PointerEvent | MouseEvent, page: number) {
  const wrap = container.value?.querySelector<HTMLElement>(
    `.pdf-page[data-page="${page}"] .pdf-canvas-wrap`,
  );
  const meta = pageMetas.value[page];
  if (!wrap || !meta) return null;
  const rect = wrap.getBoundingClientRect();
  const nx = Math.min(1, Math.max(0, (event.clientX - rect.left) / meta.width));
  const ny = Math.min(1, Math.max(0, (event.clientY - rect.top) / meta.height));
  return { nx, ny, meta };
}

function onPdfDblclick(event: MouseEvent, page: number) {
  if (isAnnotateMode.value) return;
  const target = event.target as HTMLElement | null;
  if (target?.closest(".pdf-annotation-box")) return;
  const point = normalizedPoint(event, page);
  if (!point) return;
  emit("reverseClick", {
    page,
    x: (point.nx * point.meta.width) / point.meta.scale,
    y: (point.ny * point.meta.height) / point.meta.scale,
  });
}

function onAnnotationPointerDown(event: PointerEvent, page: number) {
  if (!isAnnotateMode.value) return;
  clearTextSelectionToolbar();
  window.getSelection()?.removeAllRanges();
  const point = normalizedPoint(event, page);
  if (!point) return;
  event.preventDefault();
  (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  drag = {
    page,
    startX: point.nx,
    startY: point.ny,
    pointerId: event.pointerId,
  };
  draftRect.value = {
    page,
    rect: { x: point.nx, y: point.ny, width: 0, height: 0 },
  };
}

function onAnnotationPointerMove(event: PointerEvent, page: number) {
  if (!drag || drag.page !== page || !isAnnotateMode.value) return;
  const point = normalizedPoint(event, page);
  if (!point) return;
  const x = Math.min(drag.startX, point.nx);
  const y = Math.min(drag.startY, point.ny);
  const width = Math.abs(point.nx - drag.startX);
  const height = Math.abs(point.ny - drag.startY);
  draftRect.value = { page, rect: { x, y, width, height } };
}

function onAnnotationPointerUp(event: PointerEvent, page: number) {
  if (!drag || drag.page !== page || !isAnnotateMode.value) return;
  const current = draftRect.value;
  const meta = pageMetas.value[page];
  drag = null;
  draftRect.value = null;
  if (
    !current ||
    !meta ||
    current.rect.width < 0.006 ||
    current.rect.height < 0.006
  )
    return;
  const body = window.prompt("输入这条 PDF 区域批注", "需要修改这里：")?.trim();
  if (!body) return;
  const centerX =
    ((current.rect.x + current.rect.width / 2) * meta.width) / meta.scale;
  const centerY =
    ((current.rect.y + current.rect.height / 2) * meta.height) / meta.scale;
  emit("createAnnotation", {
    page,
    rect: current.rect,
    body,
    x: centerX,
    y: centerY,
    kind: "area",
  });
}

function annotationsForPage(page: number) {
  return (props.annotations ?? []).filter(
    (item) =>
      item.pdfAnchor?.page === page &&
      (item.pdfAnchor.rects.length || item.pdfAnchor.syncPoint),
  );
}

function rectStyle(rect: PaperAnnotationRect) {
  return {
    left: `${rect.x * 100}%`,
    top: `${rect.y * 100}%`,
    width: `${rect.width * 100}%`,
    height: `${rect.height * 100}%`,
  };
}

function clampNumber(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function rectFromDomRect(rect: DOMRect, wrapRect: DOMRect) {
  const left = rect.left - wrapRect.left;
  const top = rect.top - wrapRect.top;
  const width = rect.width;
  const height = rect.height;
  if (width < 2 || height < 2) return null;
  return { left, top, width, height };
}

function nearestTextLayerRectForSyncPoint(
  page: number,
  markerX: number,
  markerY: number,
) {
  const wrap = container.value?.querySelector<HTMLElement>(
    `.pdf-page[data-page="${page}"] .pdf-canvas-wrap`,
  );
  const layer = textLayers.get(page);
  const meta = pageMetas.value[page];
  if (!wrap || !layer || !meta) return null;

  const wrapRect = wrap.getBoundingClientRect();
  const items = Array.from(
    layer.querySelectorAll<HTMLElement>("span, .pdf-text-layer-fallback"),
  );
  let best: {
    left: number;
    top: number;
    width: number;
    height: number;
    distance: number;
  } | null = null;

  for (const item of items) {
    const rects = Array.from(item.getClientRects());
    for (const domRect of rects) {
      const rect = rectFromDomRect(domRect, wrapRect);
      if (!rect) continue;
      // Extremely wide rectangles usually come from fallback text dumps or
      // transformed containers; they are bad visual targets for SyncTeX.
      if (rect.width > meta.width * 0.72 || rect.height > 60) continue;
      const closestX = clampNumber(markerX, rect.left, rect.left + rect.width);
      const closestY = clampNumber(markerY, rect.top, rect.top + rect.height);
      const dx = markerX - closestX;
      const dy = (markerY - closestY) * 1.25;
      const distance = Math.sqrt(dx * dx + dy * dy);
      if (!best || distance < best.distance) {
        best = { ...rect, distance };
      }
    }
  }

  // SyncTeX forward points often land on a TeX box baseline or margin, not on
  // the exact glyph rectangle.  Nearby text-layer geometry is still a better
  // flash target than trusting W/H from SyncTeX, but reject very remote matches.
  const maxDistance = Math.max(42, Math.min(90, meta.width * 0.12));
  if (!best || best.distance > maxDistance) return null;

  const padX = 3;
  const padY = 2;
  return {
    left: clampNumber(best.left - padX, 2, Math.max(2, meta.width - 4)),
    top: clampNumber(best.top - padY, 2, Math.max(2, meta.height - 4)),
    width: clampNumber(
      best.width + padX * 2,
      18,
      Math.max(18, meta.width - best.left - 2),
    ),
    height: clampNumber(best.height + padY * 2, 12, 42),
    source: "text-layer" as const,
  };
}

function markerPixelsFromSyncPoint(point: PdfSyncPoint, meta: PageMeta) {
  return {
    x:
      typeof point.normalizedX === "number"
        ? point.normalizedX * meta.width
        : point.x * meta.scale,
    y:
      typeof point.normalizedY === "number"
        ? point.normalizedY * meta.height
        : point.y * meta.scale,
  };
}

function compactSyncPointRect(point: PdfSyncPoint, page: number) {
  const meta = pageMetas.value[page];
  if (!meta) return null;
  const marker = markerPixelsFromSyncPoint(point, meta);

  const textRect = nearestTextLayerRectForSyncPoint(page, marker.x, marker.y);
  if (textRect) return textRect;

  const rawWidth =
    point.width && point.width > 0 && point.width < meta.baseWidth * 0.45
      ? point.width * meta.scale
      : 96;
  const rawHeight =
    point.height && point.height > 0 && point.height < 36
      ? point.height * meta.scale
      : 20;
  const width = clampNumber(rawWidth, 38, Math.min(150, meta.width * 0.32));
  const height = clampNumber(rawHeight, 14, 32);
  return {
    left: clampNumber(
      marker.x - width * 0.16,
      2,
      Math.max(2, meta.width - width - 2),
    ),
    top: clampNumber(
      marker.y - height * 0.78,
      2,
      Math.max(2, meta.height - height - 2),
    ),
    width,
    height,
    source: "synctex" as const,
  };
}

function syncPointPixelStyle(point: PdfSyncPoint, page: number) {
  const rect = compactSyncPointRect(point, page);
  if (!rect) return {};
  return {
    left: `${rect.left}px`,
    top: `${rect.top}px`,
    width: `${rect.width}px`,
    height: `${rect.height}px`,
  };
}

function syncPointAnnotationStyle(item: PaperAnnotation, page: number) {
  const point = item.pdfAnchor?.syncPoint;
  if (!point) return {};
  return syncPointPixelStyle(point, page);
}

function syncHighlightStyle(page: number) {
  const point = syncFlash.value?.point;
  if (!point) return {};
  return syncPointPixelStyle(point, page);
}

function showSyncFlash(point: PdfSyncPoint) {
  window.clearTimeout(syncFlashTimer);
  syncFlash.value = { point: { ...point }, nonce: Date.now() };
  syncFlashTimer = window.setTimeout(() => {
    syncFlash.value = null;
  }, 820);
}

function clearTextSelectionToolbar() {
  textSelection.value = null;
}

function selectionRectToAnnotationRect(
  clientRect: DOMRect,
  pageRect: DOMRect,
): PaperAnnotationRect | null {
  const left = Math.max(clientRect.left, pageRect.left);
  const top = Math.max(clientRect.top, pageRect.top);
  const right = Math.min(clientRect.right, pageRect.right);
  const bottom = Math.min(clientRect.bottom, pageRect.bottom);
  if (right - left < 2 || bottom - top < 2) return null;
  return {
    x: Math.min(1, Math.max(0, (left - pageRect.left) / pageRect.width)),
    y: Math.min(1, Math.max(0, (top - pageRect.top) / pageRect.height)),
    width: Math.min(1, Math.max(0, (right - left) / pageRect.width)),
    height: Math.min(1, Math.max(0, (bottom - top) / pageRect.height)),
  };
}

function mergeSelectionRects(rects: PaperAnnotationRect[]) {
  const rounded = new Map<string, PaperAnnotationRect>();
  for (const rect of rects) {
    if (rect.width < 0.002 || rect.height < 0.002) continue;
    const key = [rect.x, rect.y, rect.width, rect.height]
      .map((value) => Math.round(value * 10000))
      .join(":");
    rounded.set(key, rect);
  }
  return Array.from(rounded.values()).slice(0, 60);
}

function normalizeSelectionText(text: string) {
  return text.replace(/\s+/g, " ").trim();
}

function safeRangeIntersectsNode(range: Range, node: Node) {
  try {
    return range.intersectsNode(node);
  } catch {
    return false;
  }
}

function pageLocalX(clientX: number, pageRect: DOMRect) {
  return (clientX - pageRect.left) / Math.max(1, pageRect.width);
}

function pageLocalY(clientY: number, pageRect: DOMRect) {
  return (clientY - pageRect.top) / Math.max(1, pageRect.height);
}

function selectionSideForGesture(
  page: number,
  pageRect: DOMRect,
  gesture?: SelectionGesture,
  menuPoint?: { x: number; y: number },
) {
  const samePageGesture = gesture?.page === page ? gesture : null;
  if (samePageGesture) {
    const startX = pageLocalX(samePageGesture.startX, pageRect);
    const endX = pageLocalX(samePageGesture.endX, pageRect);
    const startY = pageLocalY(samePageGesture.startY, pageRect);
    const endY = pageLocalY(samePageGesture.endY, pageRect);
    const movedMostlyInsidePage =
      startY >= -0.08 && startY <= 1.08 && endY >= -0.08 && endY <= 1.08;
    // In two-column papers, browser selection often leaks into the other
    // column although the drag starts and ends inside one column.  Only
    // enforce a column when the physical gesture itself stays on one side,
    // so deliberate full-width selections remain possible.
    if (movedMostlyInsidePage && startX < 0.48 && endX < 0.52) return "left";
    if (movedMostlyInsidePage && startX > 0.52 && endX > 0.48) return "right";
  }
  if (menuPoint) {
    const x = pageLocalX(menuPoint.x, pageRect);
    if (x < 0.46) return "left";
    if (x > 0.54) return "right";
  }
  return null;
}

function segmentCenterX(segment: TextSelectionSegment, pageRect: DOMRect) {
  return (
    segment.rect.left + segment.rect.width / 2 - pageRect.left
  ) / Math.max(1, pageRect.width);
}

function pageHasCrossColumnLeak(segments: TextSelectionSegment[], pageRect: DOMRect) {
  const left = segments.filter((segment) => segmentCenterX(segment, pageRect) < 0.48).length;
  const right = segments.filter((segment) => segmentCenterX(segment, pageRect) > 0.52).length;
  // A few opposite-side boxes can happen near section headings, but several
  // boxes on both sides is almost always the two-column selection leak.
  return left >= 1 && right >= 1;
}

function selectedColumnFallback(
  segments: TextSelectionSegment[],
  pageRect: DOMRect,
) {
  if (!segments.length) return null;
  const leftArea = segments
    .filter((segment) => segmentCenterX(segment, pageRect) < 0.5)
    .reduce((sum, segment) => sum + segment.rect.width * segment.rect.height, 0);
  const rightArea = segments
    .filter((segment) => segmentCenterX(segment, pageRect) >= 0.5)
    .reduce((sum, segment) => sum + segment.rect.width * segment.rect.height, 0);
  if (!leftArea && !rightArea) return null;
  if (leftArea > rightArea * 1.35) return "left";
  if (rightArea > leftArea * 1.35) return "right";
  return null;
}

function filterSegmentsToGestureColumn(
  segments: TextSelectionSegment[],
  page: number,
  pageRect: DOMRect,
  gesture?: SelectionGesture,
  menuPoint?: { x: number; y: number },
) {
  const hasCrossColumnLeak = pageHasCrossColumnLeak(segments, pageRect);
  const side =
    selectionSideForGesture(page, pageRect, gesture, menuPoint) ||
    (hasCrossColumnLeak ? selectedColumnFallback(segments, pageRect) : null);
  if (!side || !hasCrossColumnLeak) return segments;
  const kept = segments.filter((segment) => {
    const center = segmentCenterX(segment, pageRect);
    return side === "left" ? center < 0.54 : center > 0.46;
  });
  return kept.length ? kept : segments;
}

function collectTextSegmentsFromLayer(
  range: Range,
  layer: HTMLElement | undefined,
  pageRect: DOMRect,
): TextSelectionSegment[] {
  if (!layer) return [];
  const spans = Array.from(layer.querySelectorAll<HTMLElement>("span"));
  return spans.flatMap((span) => {
    const text = normalizeSelectionText(span.textContent || "");
    if (!text || !safeRangeIntersectsNode(range, span)) return [];
    return Array.from(span.getClientRects())
      .filter((rect) => {
        if (rect.width < 1.5 || rect.height < 1.5) return false;
        if (rect.right <= pageRect.left || rect.left >= pageRect.right)
          return false;
        if (rect.bottom <= pageRect.top || rect.top >= pageRect.bottom)
          return false;
        // Text spans that span most of the page are usually fallback or
        // transform artifacts, not useful for annotation geometry.
        return rect.width < pageRect.width * 0.72;
      })
      .map((rect) => ({ rect, text }));
  });
}

function fallbackSegmentsFromRange(range: Range, pageRect: DOMRect) {
  return Array.from(range.getClientRects())
    .filter((rect) => {
      if (rect.width < 1.5 || rect.height < 1.5) return false;
      if (rect.right <= pageRect.left || rect.left >= pageRect.right) return false;
      if (rect.bottom <= pageRect.top || rect.top >= pageRect.bottom) return false;
      return rect.width < pageRect.width * 0.72;
    })
    .map((rect) => ({ rect, text: "" }));
}

function groupSegmentsByLine(segments: TextSelectionSegment[], pageRect: DOMRect) {
  const sorted = [...segments].sort((a, b) => {
    const dy = a.rect.top - b.rect.top;
    return Math.abs(dy) > 3 ? dy : a.rect.left - b.rect.left;
  });
  const groups: TextSelectionSegment[][] = [];
  for (const segment of sorted) {
    const centerY = segment.rect.top + segment.rect.height / 2;
    const group = groups.find((line) => {
      const sample = line[0];
      const sampleCenterY = sample.rect.top + sample.rect.height / 2;
      const tolerance = Math.max(4, Math.min(9, sample.rect.height * 0.72));
      return Math.abs(centerY - sampleCenterY) <= tolerance;
    });
    if (group) group.push(segment);
    else groups.push([segment]);
  }
  return groups
    .map((line) => line.sort((a, b) => a.rect.left - b.rect.left))
    .filter((line) => {
      const left = Math.min(...line.map((segment) => segment.rect.left));
      const right = Math.max(...line.map((segment) => segment.rect.right));
      return right > pageRect.left && left < pageRect.right;
    });
}

function splitLineByHorizontalGaps(
  line: TextSelectionSegment[],
  pageRect: DOMRect,
) {
  if (line.length <= 1) return [line];
  const sorted = [...line].sort((a, b) => a.rect.left - b.rect.left);
  const groups: TextSelectionSegment[][] = [];
  let current: TextSelectionSegment[] = [];
  let previousRight = Number.NaN;
  for (const segment of sorted) {
    const medianHeight = Math.max(
      1,
      sorted.reduce((sum, item) => sum + item.rect.height, 0) / sorted.length,
    );
    const gap = Number.isFinite(previousRight)
      ? segment.rect.left - previousRight
      : 0;
    const previousCenter = current.length
      ? segmentCenterX(current[current.length - 1], pageRect)
      : segmentCenterX(segment, pageRect);
    const currentCenter = segmentCenterX(segment, pageRect);
    const crossesColumnGutter =
      (previousCenter < 0.48 && currentCenter > 0.52) ||
      (previousCenter > 0.52 && currentCenter < 0.48);
    // Browser PDF selections in two-column papers can report same-baseline
    // rectangles from both columns.  Never draw one annotation rectangle across
    // a large non-text gap; split into separate visual runs instead.
    const largeVisualGap = gap > Math.max(18, medianHeight * 3.2, pageRect.width * 0.035);
    if (current.length && (crossesColumnGutter || largeVisualGap)) {
      groups.push(current);
      current = [];
    }
    current.push(segment);
    previousRight = Math.max(previousRight, segment.rect.right);
  }
  if (current.length) groups.push(current);
  return groups;
}

function lineGroupsToRects(
  lineGroups: TextSelectionSegment[][],
  pageRect: DOMRect,
) {
  return mergeSelectionRects(
    lineGroups.flatMap((line) =>
      splitLineByHorizontalGaps(line, pageRect).flatMap((run) => {
        const left = Math.min(...run.map((segment) => segment.rect.left));
        const top = Math.min(...run.map((segment) => segment.rect.top));
        const right = Math.max(...run.map((segment) => segment.rect.right));
        const bottom = Math.max(...run.map((segment) => segment.rect.bottom));
        const expanded = DOMRect.fromRect({
          x: left - 1,
          y: top - 1,
          width: right - left + 2,
          height: bottom - top + 2,
        });
        const converted = selectionRectToAnnotationRect(expanded, pageRect);
        return converted ? [converted] : [];
      }),
    ),
  );
}

function lineGroupsToText(lineGroups: TextSelectionSegment[][], pageRect: DOMRect) {
  return normalizeSelectionText(
    lineGroups
      .flatMap((line) => splitLineByHorizontalGaps(line, pageRect))
      .map((line) =>
        line
          .map((segment) => segment.text)
          .filter(Boolean)
          .join(" "),
      )
      .filter(Boolean)
      .join(" "),
  );
}

function collectPdfTextSelection(
  preferredPage?: number,
  menuPoint?: { x: number; y: number },
  asContextMenu = false,
  gesture?: SelectionGesture,
) {
  if (isAnnotateMode.value) return null;
  const selection = window.getSelection();
  const rawSelectedText =
    selection?.toString().replace(/\s+/g, " ").trim() || "";
  if (!selection || selection.rangeCount === 0 || rawSelectedText.length < 1)
    return null;

  const range = selection.getRangeAt(0);
  const pageEls = Array.from(
    container.value?.querySelectorAll<HTMLElement>(
      ".pdf-page[data-page] .pdf-canvas-wrap",
    ) ?? [],
  );
  const candidates = pageEls.flatMap((wrap) => {
    const pageEl = wrap.closest<HTMLElement>(".pdf-page[data-page]");
    const page = Number(pageEl?.dataset.page || 0);
    const meta = pageMetas.value[page];
    if (!page || !meta) return [];
    const pageRect = wrap.getBoundingClientRect();
    const layer = textLayers.get(page);
    let segments = collectTextSegmentsFromLayer(range, layer, pageRect);
    if (!segments.length) segments = fallbackSegmentsFromRange(range, pageRect);
    segments = filterSegmentsToGestureColumn(
      segments,
      page,
      pageRect,
      gesture,
      menuPoint,
    );
    const lineGroups = groupSegmentsByLine(segments, pageRect);
    const rects = lineGroupsToRects(lineGroups, pageRect);
    if (!rects.length) return [];
    const text = lineGroupsToText(lineGroups, pageRect) || rawSelectedText;
    return [{ page, rects, pageRect, meta, text }];
  });

  const selected =
    candidates.find((item) => item.page === preferredPage) || candidates[0];
  if (!selected) return null;

  const firstRect = selected.rects[0];
  const centerX =
    ((firstRect.x + firstRect.width / 2) * selected.meta.width) /
    selected.meta.scale;
  const centerY =
    ((firstRect.y + firstRect.height / 2) * selected.meta.height) /
    selected.meta.scale;
  const lastRect = selected.rects[selected.rects.length - 1] || firstRect;
  const rawMenuX = menuPoint
    ? (menuPoint.x - selected.pageRect.left) / selected.pageRect.width
    : lastRect.x + lastRect.width / 2;
  const rawMenuY = menuPoint
    ? (menuPoint.y - selected.pageRect.top) / selected.pageRect.height
    : lastRect.y + lastRect.height + 0.012;
  const menuX = Math.min(0.96, Math.max(0.04, rawMenuX));
  const menuY = Math.min(0.965, Math.max(0.025, rawMenuY));

  return {
    page: selected.page,
    rects: selected.rects,
    text: selected.text,
    x: centerX,
    y: centerY,
    menuX,
    menuY,
    contextMenu: asContextMenu,
  };
}

function updateTextSelectionToolbar(
  page?: number,
  menuPoint?: { x: number; y: number },
  asContextMenu = false,
  gesture?: SelectionGesture,
) {
  window.setTimeout(() => {
    const next = collectPdfTextSelection(
      page,
      menuPoint,
      asContextMenu,
      gesture,
    );
    textSelection.value = next;
    if (next) window.getSelection()?.removeAllRanges();
  }, 0);
}

function onPdfMouseDown(event: MouseEvent, page: number) {
  if (isAnnotateMode.value || event.button !== 0) return;
  if ((event.target as HTMLElement | null)?.closest(".pdf-text-selection-toolbar"))
    return;
  clearTextSelectionToolbar();
  selectionGestureStart = { page, x: event.clientX, y: event.clientY };
}

function onPdfMouseUp(event: MouseEvent, page: number) {
  if (isAnnotateMode.value) return;
  const start = selectionGestureStart;
  selectionGestureStart = null;
  const gesture = start
    ? {
        page: start.page,
        startX: start.x,
        startY: start.y,
        endX: event.clientX,
        endY: event.clientY,
      }
    : undefined;
  updateTextSelectionToolbar(
    page,
    { x: event.clientX, y: event.clientY },
    false,
    gesture,
  );
}

function onPdfContextMenu(event: MouseEvent, page: number) {
  const next = collectPdfTextSelection(
    page,
    { x: event.clientX, y: event.clientY },
    true,
    selectionGestureStart
      ? {
          page: selectionGestureStart.page,
          startX: selectionGestureStart.x,
          startY: selectionGestureStart.y,
          endX: event.clientX,
          endY: event.clientY,
        }
      : undefined,
  );
  selectionGestureStart = null;
  if (!next) return;
  event.preventDefault();
  textSelection.value = next;
  window.getSelection()?.removeAllRanges();
}

function createSelectedTextAnnotation(kind: "text" | "highlight") {
  const selection = textSelection.value;
  if (!selection) return;
  const body =
    kind === "highlight"
      ? `高亮：${selection.text.slice(0, 80)}`
      : window
          .prompt(
            "给选中的 PDF 文字添加批注",
            `检查：${selection.text.slice(0, 80)}`,
          )
          ?.trim();
  if (!body) return;
  emit("createAnnotation", {
    page: selection.page,
    rects: selection.rects,
    body,
    x: selection.x,
    y: selection.y,
    textQuote: selection.text,
    kind,
  });
  window.getSelection()?.removeAllRanges();
  clearTextSelectionToolbar();
}

function locateSelectedTextInSource() {
  const selection = textSelection.value;
  if (!selection) return;
  emit("reverseClick", {
    page: selection.page,
    x: selection.x,
    y: selection.y,
  });
}

async function scrollToPage(page: number) {
  currentPage.value = Math.min(pageCount.value || page, Math.max(1, page));
  await nextTick();
  const el = container.value?.querySelector<HTMLElement>(
    `.pdf-page[data-page="${currentPage.value}"]`,
  );
  el?.scrollIntoView({ block: "start", inline: "center", behavior: "smooth" });
  void renderPage(currentPage.value);
}

function syncPointFromAnnotationAnchor(
  anchor: NonNullable<PaperAnnotation["pdfAnchor"]>,
  annotationId?: string,
): PdfSyncPoint | null {
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
  return null;
}

async function scrollToSyncPointLike(point: PdfSyncPoint) {
  const root = container.value;
  if (!root) return;
  currentPage.value = Math.min(
    pageCount.value || point.page,
    Math.max(1, point.page),
  );
  await nextTick();
  await renderPage(point.page);
  await nextTick();
  const wrap = root.querySelector<HTMLElement>(
    `.pdf-page[data-page="${point.page}"] .pdf-canvas-wrap`,
  );
  const meta = pageMetas.value[point.page];
  if (!wrap || !meta) {
    await scrollToPage(point.page);
    showSyncFlash(point);
    return;
  }
  const rootRect = root.getBoundingClientRect();
  const wrapRect = wrap.getBoundingClientRect();
  const marker = markerPixelsFromSyncPoint(point, meta);
  root.scrollTo({
    top: Math.max(
      0,
      root.scrollTop +
        (wrapRect.top - rootRect.top) +
        marker.y -
        root.clientHeight * 0.34,
    ),
    left: Math.max(
      0,
      root.scrollLeft +
        (wrapRect.left - rootRect.left) +
        marker.x -
        root.clientWidth * 0.5,
    ),
    behavior: "smooth",
  });
  await renderPage(point.page);
  await nextTick();
  showSyncFlash(point);
}

async function scrollToSyncPoint() {
  const point = props.syncPoint;
  const root = container.value;
  if (!point || !root) return;
  currentPage.value = Math.min(
    pageCount.value || point.page,
    Math.max(1, point.page),
  );
  await nextTick();
  await renderPage(point.page);
  await nextTick();
  const wrap = root.querySelector<HTMLElement>(
    `.pdf-page[data-page="${point.page}"] .pdf-canvas-wrap`,
  );
  const meta = pageMetas.value[point.page];
  if (!wrap || !meta) {
    await scrollToPage(point.page);
    showSyncFlash(point);
    return;
  }

  const rootRect = root.getBoundingClientRect();
  const wrapRect = wrap.getBoundingClientRect();
  const marker = markerPixelsFromSyncPoint(point, meta);
  const nextTop =
    root.scrollTop +
    (wrapRect.top - rootRect.top) +
    marker.y -
    root.clientHeight * 0.34;
  const nextLeft =
    root.scrollLeft +
    (wrapRect.left - rootRect.left) +
    marker.x -
    root.clientWidth * 0.5;

  root.scrollTo({
    top: Math.max(0, nextTop),
    left: Math.max(0, nextLeft),
    behavior: "smooth",
  });
  await renderPage(point.page);
  await nextTick();
  showSyncFlash(point);
}

async function scrollToAnnotation(id?: string) {
  if (!id) return;
  const annotation = (props.annotations ?? []).find((item) => item.id === id);
  const anchor = annotation?.pdfAnchor;
  if (!anchor) return;
  await nextTick();
  await loadDocument(false);

  const point = syncPointFromAnnotationAnchor(anchor, id);
  if (point) {
    await scrollToSyncPointLike(point);
    return;
  }
  await scrollToPage(anchor.page);
}

watch(
  () => props.dataUrl,
  () => {
    void loadDocument(true);
  },
  { immediate: true },
);
watch([scale, renderQuality], () => {
  window.clearTimeout(scaleTimer);
  void clearRenderedPages();
  scaleTimer = window.setTimeout(() => {
    void nextTick().then(scheduleVisibleRender);
  }, 90);
});
watch(
  () => props.syncPoint,
  async (point) => {
    if (!point) return;
    await scrollToSyncPoint();
  },
  { deep: true },
);
watch(
  () => props.activeAnnotationId,
  (id) => void scrollToAnnotation(id),
);

onMounted(() => {
  void nextTick(() => {
    container.value?.addEventListener(
      "gesturestart",
      onGestureStart as EventListener,
      { passive: false },
    );
    container.value?.addEventListener(
      "gesturechange",
      onGestureChange as EventListener,
      { passive: false },
    );
    if (container.value) {
      resizeObserver = new ResizeObserver(() => scheduleAutoFit());
      resizeObserver.observe(container.value);
      scheduleAutoFit();
    }
  });
});

onBeforeUnmount(() => {
  renderToken += 1;
  window.cancelAnimationFrame(scrollRaf);
  window.cancelAnimationFrame(renderRaf);
  window.clearTimeout(scaleTimer);
  window.clearTimeout(syncFlashTimer);
  window.cancelAnimationFrame(fitRaf);
  resizeObserver?.disconnect();
  resizeObserver = null;
  container.value?.removeEventListener(
    "gesturestart",
    onGestureStart as EventListener,
  );
  container.value?.removeEventListener(
    "gesturechange",
    onGestureChange as EventListener,
  );
  void disposeDocument();
});
</script>

<template>
  <div
    ref="container"
    class="pdf-preview-pane"
    @scroll.passive="onScroll"
    @wheel="onWheel"
  >
    <div class="pdf-toolbar pdf-main-toolbar">
      <button
        class="toolbar-icon"
        :class="{ active: isAnnotateMode }"
        title="点击后进入/退出区域批注模式；开启后拖拽框选图表、公式或版式区域"
        @click="toggleAnnotateView"
      >
        {{ isAnnotateMode ? "退出区域批注" : "区域批注" }}
      </button>
      <span class="toolbar-separator" />
      <button
        class="toolbar-icon"
        :disabled="currentPage <= 1"
        title="上一页"
        @click="goPage(-1)"
      >
        ‹
      </button>
      <span class="pdf-page-input"
        >{{ currentPage }} / {{ pageCount || "-" }}</span
      >
      <button
        class="toolbar-icon"
        :disabled="!pageCount || currentPage >= pageCount"
        title="下一页"
        @click="goPage(1)"
      >
        ›
      </button>
      <span class="toolbar-separator" />
      <button
        class="toolbar-icon"
        title="缩小 PDF（也可 Ctrl/⌘ + 鼠标滚轮）"
        @click="zoomOut"
      >
        −
      </button>
      <span class="zoom-label">{{ Math.round(scale * 100) }}%</span>
      <button
        class="toolbar-icon"
        title="放大 PDF（也可 Ctrl/⌘ + 鼠标滚轮）"
        @click="zoomIn"
      >
        ＋
      </button>
      <button
        class="toolbar-icon"
        title="重置为 PDF 原始大小"
        @click="resetZoom"
      >
        1:1
      </button>
      <button
        class="toolbar-icon"
        :class="{ active: isAutoFit }"
        title="自动适应预览宽度并居中"
        @click="autoFitWidth"
      >
        适宽
      </button>
      <span class="toolbar-separator" />
      <span class="pdf-quality-hint">{{
        isAnnotateMode
          ? "区域批注模式 · 拖拽框选图表/公式/版式"
          : "定位/文字模式 · 选中文字可批注 · 右键可批注 · 双击 PDF 反向定位"
      }}</span>
    </div>

    <div v-if="!props.dataUrl && !loading" class="empty-state small">
      尚未找到 PDF。打开主 .tex 后按 Ctrl/Cmd+B 构建。
    </div>
    <template v-else>
      <div v-if="loading" class="empty-state small">正在加载 PDF 页面…</div>
      <div v-else-if="rendering" class="empty-state small subtle">
        正在按需渲染可见页面…
      </div>
      <div v-if="error" class="empty-state small error">
        PDF 渲染失败：{{ error }}
      </div>
      <div v-if="props.dataUrl" class="pdf-scroll-stack">
        <div
          v-for="page in pages"
          :key="page"
          class="pdf-page"
          :class="{ highlighted: props.syncPoint?.page === page }"
          :data-page="page"
        >
          <div class="pdf-page-label">Page {{ page }}</div>
          <div
            class="pdf-canvas-wrap"
            :style="pageBoxStyle(page)"
            @dblclick="onPdfDblclick($event, page)"
            @mousedown="onPdfMouseDown($event, page)"
            @mouseup="onPdfMouseUp($event, page)"
            @contextmenu="onPdfContextMenu($event, page)"
          >
            <canvas
              :ref="(el) => setCanvasRef(page, el as Element | null)"
              :data-pdf-page="page"
            />
            <div
              :ref="(el) => setTextLayerRef(page, el as Element | null)"
              class="pdf-text-layer"
            />
            <div
              v-if="isAnnotateMode"
              class="pdf-annotation-input-layer"
              @pointerdown="onAnnotationPointerDown($event, page)"
              @pointermove="onAnnotationPointerMove($event, page)"
              @pointerup="onAnnotationPointerUp($event, page)"
              @pointercancel="draftRect = null"
            />
            <div class="pdf-annotation-layer" aria-hidden="false">
              <template v-for="item in annotationsForPage(page)" :key="item.id">
                <button
                  v-for="(rect, index) in item.pdfAnchor?.rects || []"
                  :key="`${item.id}-${index}`"
                  class="pdf-annotation-box"
                  :class="[
                    { active: item.id === activeAnnotationId },
                    item.status,
                    item.type,
                    item.anchorConfidence ||
                      (item.texAnchor ? 'stable' : 'unbound'),
                  ]"
                  :style="rectStyle(rect)"
                  :title="item.body"
                  @click.stop="emit('focusAnnotation', item)"
                />
                <button
                  v-if="
                    !item.pdfAnchor?.rects.length && item.pdfAnchor?.syncPoint
                  "
                  :key="`${item.id}-syncpoint`"
                  class="pdf-annotation-box source-sync"
                  :class="[
                    { active: item.id === activeAnnotationId },
                    item.status,
                    item.type,
                    item.anchorConfidence ||
                      (item.texAnchor ? 'stable' : 'unbound'),
                  ]"
                  :style="syncPointAnnotationStyle(item, page)"
                  :title="item.body"
                  @click.stop="emit('focusAnnotation', item)"
                />
              </template>
              <div
                v-if="draftRect?.page === page"
                class="pdf-annotation-box draft"
                :style="rectStyle(draftRect.rect)"
              />
            </div>
            <div
              v-if="syncFlash?.point.page === page && pageMetas[page]"
              :key="syncFlash.nonce"
              class="pdf-sync-highlight"
              :style="syncHighlightStyle(page)"
              title="SyncTeX 短暂定位提示"
            />
            <template v-if="textSelection?.page === page">
              <div
                v-for="(rect, index) in textSelection.rects"
                :key="`selection-preview-${index}`"
                class="pdf-current-text-selection-preview"
                :style="rectStyle(rect)"
              />
            </template>
            <div
              v-if="textSelection?.page === page"
              class="pdf-text-selection-toolbar"
              :class="{ context: textSelection.contextMenu }"
              :style="{
                left: `${textSelection.menuX * 100}%`,
                top: `${textSelection.menuY * 100}%`,
              }"
              @mousedown.prevent
              @click.stop
            >
              <button
                class="primary"
                @click="createSelectedTextAnnotation('text')"
              >
                批注
              </button>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
