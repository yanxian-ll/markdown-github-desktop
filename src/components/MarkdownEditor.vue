<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { EditorView, basicSetup } from 'codemirror';
import { StateEffect, StateField } from '@codemirror/state';
import { markdown } from '@codemirror/lang-markdown';
import { StreamLanguage } from '@codemirror/language';
import { stex } from '@codemirror/legacy-modes/mode/stex';
import { keymap, Decoration, type DecorationSet } from '@codemirror/view';
import { oneDark } from '@codemirror/theme-one-dark';
import type { DocumentKind } from '../types/app';

const props = defineProps<{
  modelValue: string;
  darkMode?: boolean;
  kind?: DocumentKind;
  gotoLine?: number | null;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: string];
  save: [];
  build: [];
  sourceDblclick: [payload: { line: number; column: number }];
  markdownSourceClick: [payload: { line: number; column: number }];
}>();

const host = ref<HTMLDivElement | null>(null);
let view: EditorView | null = null;
let applyingExternalUpdate = false;
let lastEmittedValue: string | null = null;
let flashTimer = 0;


const flashLineEffect = StateEffect.define<{ from: number }>();
const clearFlashLineEffect = StateEffect.define<void>();

const flashLineField = StateField.define<DecorationSet>({
  create() {
    return Decoration.none;
  },
  update(value, transaction) {
    let next = value.map(transaction.changes);
    for (const effect of transaction.effects) {
      if (effect.is(flashLineEffect)) {
        next = Decoration.set([Decoration.line({ class: 'cm-line-flash' }).range(effect.value.from)]);
      }
      if (effect.is(clearFlashLineEffect)) {
        next = Decoration.none;
      }
    }
    return next;
  },
  provide: (field) => EditorView.decorations.from(field),
});

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


function goToLine(lineNumber?: number | null) {
  if (!view || !lineNumber) return;
  const safeLine = Math.max(1, Math.min(lineNumber, view.state.doc.lines));
  const line = view.state.doc.line(safeLine);
  window.clearTimeout(flashTimer);
  view.dispatch({
    selection: { anchor: line.from },
    effects: [
      EditorView.scrollIntoView(line.from, { y: 'center' }),
      flashLineEffect.of({ from: line.from }),
    ],
  });
  flashTimer = window.setTimeout(() => {
    view?.dispatch({ effects: clearFlashLineEffect.of() });
  }, 1200);
  view.focus();
}

function createExtensions() {
  return [
    basicSetup,
    languageExtension(),
    flashLineField,
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
    ]),
    EditorView.domEventHandlers({
      click: (event) => {
        if (props.kind !== 'markdown') return false;
        const point = editorLineColumnFromMouse(event);
        if (point) emit('markdownSourceClick', point);
        return false;
      },
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

watch(() => [props.darkMode, props.kind], recreateEditor);

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
  window.clearTimeout(flashTimer);
  view?.destroy();
  view = null;
});
</script>

<template>
  <div ref="host" class="editor-host" />
</template>
