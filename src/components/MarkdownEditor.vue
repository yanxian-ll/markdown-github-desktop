<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { EditorView, basicSetup } from 'codemirror';
import { markdown } from '@codemirror/lang-markdown';
import { StreamLanguage } from '@codemirror/language';
import { stex } from '@codemirror/legacy-modes/mode/stex';
import { keymap, gutter, GutterMarker } from '@codemirror/view';
import { oneDark } from '@codemirror/theme-one-dark';
import type { DocumentKind, PaperAnnotation } from '../types/app';

const props = defineProps<{
  modelValue: string;
  darkMode?: boolean;
  kind?: DocumentKind;
  gotoLine?: number | null;
  sourceAnnotations?: PaperAnnotation[];
  activeAnnotationId?: string;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: string];
  save: [];
  build: [];
  sourceDblclick: [payload: { line: number; column: number }];
  sourceAnnotate: [payload: { line: number; column: number }];
  focusAnnotation: [annotation: PaperAnnotation];
}>();

const host = ref<HTMLDivElement | null>(null);
let view: EditorView | null = null;
let applyingExternalUpdate = false;
let lastEmittedValue: string | null = null;

class AnnotationMarker extends GutterMarker {
  constructor(private readonly count: number, private readonly annotations: PaperAnnotation[]) { super(); }

  toDOM() {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'cm-annotation-marker';
    button.textContent = this.count > 1 ? String(this.count) : '●';
    button.title = this.annotations.map((item) => item.body).join('\n---\n');
    button.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      const first = this.annotations[0];
      if (first) emit('focusAnnotation', first);
    });
    return button;
  }
}

const annotationKey = computed(() => (props.sourceAnnotations ?? [])
  .map((item) => `${item.id}:${item.status}:${item.texAnchor?.line}:${item.updatedAt}:${item.id === props.activeAnnotationId}`)
  .join('|'));

function languageExtension() {
  if (props.kind === 'latex' || props.kind === 'bibtex') return StreamLanguage.define(stex);
  return markdown();
}

function editorLineColumnFromMouse(event: MouseEvent) {
  if (!view) return null;
  const pos = view.posAtCoords({ x: event.clientX, y: event.clientY });
  if (pos == null) return null;
  const line = view.state.doc.lineAt(pos);
  return { line: line.number, column: Math.max(1, pos - line.from + 1) };
}

function editorCursorLineColumn() {
  if (!view) return { line: 1, column: 1 };
  const pos = view.state.selection.main.head;
  const line = view.state.doc.lineAt(pos);
  return { line: line.number, column: Math.max(1, pos - line.from + 1) };
}

function goToLine(lineNumber?: number | null) {
  if (!view || !lineNumber) return;
  const safeLine = Math.max(1, Math.min(lineNumber, view.state.doc.lines));
  const line = view.state.doc.line(safeLine);
  view.dispatch({
    selection: { anchor: line.from },
    effects: EditorView.scrollIntoView(line.from, { y: 'center' }),
  });
  view.focus();
}

function annotationGutter() {
  return gutter({
    class: 'cm-annotation-gutter',
    lineMarker(view, line) {
      if (props.kind !== 'latex') return null;
      const lineNumber = view.state.doc.lineAt(line.from).number;
      const matches = (props.sourceAnnotations ?? [])
        .filter((item) => item.texAnchor?.line === lineNumber && item.status !== 'ignored');
      if (!matches.length) return null;
      return new AnnotationMarker(matches.length, matches);
    },
    initialSpacer: () => new AnnotationMarker(1, []),
  });
}

function createExtensions() {
  return [
    basicSetup,
    languageExtension(),
    annotationGutter(),
    keymap.of([
      {
        key: 'Mod-s',
        preventDefault: true,
        run: () => {
          emit('save');
          return true;
        },
      },
      {
        key: 'Mod-b',
        preventDefault: true,
        run: () => {
          emit('build');
          return true;
        },
      },
      {
        key: 'Mod-Alt-c',
        preventDefault: true,
        run: () => {
          if (props.kind !== 'latex') return false;
          emit('sourceAnnotate', editorCursorLineColumn());
          return true;
        },
      },
    ]),
    EditorView.domEventHandlers({
      dblclick: (event) => {
        if (props.kind !== 'latex') return false;
        const point = editorLineColumnFromMouse(event);
        if (point) emit('sourceDblclick', point);
        return false;
      },
    }),
    EditorView.updateListener.of((update) => {
      if (update.docChanged && !applyingExternalUpdate) {
        const value = update.state.doc.toString();
        lastEmittedValue = value;
        emit('update:modelValue', value);
      }
    }),
    EditorView.theme({
      '&': { height: '100%' },
      '.cm-scroller': { fontFamily: 'var(--font-mono)', fontSize: '14px', lineHeight: '1.65' },
      '.cm-content': { padding: '24px 20px 60px' },
      '.cm-gutters': { borderRight: '1px solid var(--border)' },
      '.cm-annotation-gutter': { minWidth: '28px' },
      '.cm-annotation-marker': {
        width: '20px',
        height: '20px',
        padding: '0',
        border: '0',
        borderRadius: '999px',
        background: 'rgba(250, 204, 21, 0.25)',
        color: 'var(--warn)',
        fontSize: '11px',
        cursor: 'pointer',
      },
    }),
    props.darkMode ? oneDark : [],
  ];
}

function recreateEditor() {
  if (!host.value) return;
  const currentText = view?.state.doc.toString() ?? props.modelValue;
  view?.destroy();
  view = new EditorView({
    doc: currentText,
    extensions: createExtensions(),
    parent: host.value,
  });
}

onMounted(() => recreateEditor());

watch(() => [props.darkMode, props.kind, annotationKey.value], recreateEditor);

watch(
  () => props.gotoLine,
  (line) => goToLine(line),
);

watch(
  () => props.modelValue,
  (value) => {
    if (!view) return;
    // 这是 CodeMirror 自己刚刚 emit 出去的值，父组件回流回来时不需要再
    // view.state.doc.toString() 比较。大文件每个按键都 toString 会非常卡。
    if (value === lastEmittedValue) return;
    if (view.state.doc.toString() === value) return;
    applyingExternalUpdate = true;
    view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: value } });
    applyingExternalUpdate = false;
    lastEmittedValue = null;
  },
);

onBeforeUnmount(() => {
  view?.destroy();
  view = null;
});
</script>

<template>
  <div ref="host" class="editor-host" />
</template>
