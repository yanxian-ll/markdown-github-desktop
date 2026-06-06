<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { EditorView, basicSetup } from 'codemirror';
import { Prec, StateEffect, StateField } from '@codemirror/state';
import { markdown } from '@codemirror/lang-markdown';
import { StreamLanguage } from '@codemirror/language';
import { stex } from '@codemirror/legacy-modes/mode/stex';
import { keymap, Decoration, hoverTooltip, type DecorationSet } from '@codemirror/view';
import { snippetCompletion, type CompletionContext, type CompletionResult } from '@codemirror/autocomplete';
import katex from 'katex';
import { autocompletion } from '@codemirror/autocomplete';
import { oneDark } from '@codemirror/theme-one-dark';
import type { DocumentKind } from '../types/app';
import type { BibEntryItem, LatexDiagnosticItem, LatexLabelItem, ProjectLatexIndex } from '../types/latexIntelligence';
import {
  CITE_COMMANDS,
  INPUT_COMMANDS,
  REF_COMMANDS,
  commandArgumentAtText,
  latexCompletionSource,
  splitLatexArgumentKeys,
} from '../services/codeMirrorLatexIntelligence';
import { readWorkspaceDataUrl } from '../services/tauriBridge';
import { resolveGraphicPath, resolveIndexedFilePath } from '../services/latexIntelligence';
import { editorSnippets } from '../services/snippets';

const props = defineProps<{
  modelValue: string;
  darkMode?: boolean;
  kind?: DocumentKind;
  gotoLine?: number | null;
  latexIndex?: ProjectLatexIndex;
  diagnostics?: LatexDiagnosticItem[];
  rootDir?: string;
  currentPath?: string;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: string];
  save: [];
  build: [];
  sourceDblclick: [payload: { line: number; column: number }];
  markdownSourceClick: [payload: { line: number; column: number }];
  latexNavigate: [payload: { kind: 'label' | 'bib' | 'file'; key: string }];
  bibPreview: [key?: string];
  cursorLine: [line: number];
}>();

const host = ref<HTMLDivElement | null>(null);
let view: EditorView | null = null;
let applyingExternalUpdate = false;
let lastEmittedValue: string | null = null;
let flashTimer = 0;


const flashLineEffect = StateEffect.define<{ from: number }>();
const clearFlashLineEffect = StateEffect.define<void>();
const setDiagnosticsEffect = StateEffect.define<LatexDiagnosticItem[]>();

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


const diagnosticLineField = StateField.define<DecorationSet>({
  create() {
    return Decoration.none;
  },
  update(value, transaction) {
    let next = value.map(transaction.changes);
    for (const effect of transaction.effects) {
      if (effect.is(setDiagnosticsEffect)) {
        const byLine = new Map<number, LatexDiagnosticItem[]>();
        for (const item of effect.value) {
          if (!item.line || item.line < 1 || item.line > transaction.state.doc.lines) continue;
          byLine.set(item.line, [...(byLine.get(item.line) || []), item]);
        }
        const decorations = [...byLine.entries()].map(([lineNumber, items]) => {
          const line = transaction.state.doc.line(lineNumber);
          const hasError = items.some((item) => item.severity === 'error');
          const title = items.map((item) => `${item.severity === 'error' ? '错误' : '警告'}：${item.message}`).join('\\n');
          return Decoration.line({
            class: hasError ? 'cm-latex-diagnostic-line error' : 'cm-latex-diagnostic-line warning',
            attributes: { title },
          }).range(line.from);
        });
        next = Decoration.set(decorations, true);
      }
    }
    return next;
  },
  provide: (field) => EditorView.decorations.from(field),
});

function applyDiagnostics() {
  if (!view) return;
  view.dispatch({ effects: setDiagnosticsEffect.of(props.diagnostics || []) });
}

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


function emitCursorLine(pos?: number) {
  if (!view) return;
  const cursor = pos ?? view.state.selection.main.head;
  emit('cursorLine', view.state.doc.lineAt(cursor).number);
}

function latexNavigationFromMouse(event: MouseEvent) {
  if (!view || props.kind !== 'latex') return null;
  const pos = view.posAtCoords({ x: event.clientX, y: event.clientY });
  if (pos == null) return null;
  const target = latexTargetAtPosition(pos);
  if (!target) return null;
  return { kind: target.kind, key: target.key };
}

function updateBibPreviewFromCursor(pos?: number) {
  if (!view || props.kind !== 'latex') return;
  const cursor = pos ?? view.state.selection.main.head;
  const line = view.state.doc.lineAt(cursor);
  const context = commandArgumentAtText(line.text, Math.max(1, cursor - line.from + 1));
  if (!context || !CITE_COMMANDS.has(context.command)) {
    emit('bibPreview', undefined);
    return;
  }
  const keys = splitLatexArgumentKeys(context.query);
  emit('bibPreview', keys[0]);
}

function targetKeyFromContext(context: ReturnType<typeof commandArgumentAtText>, oneBasedColumn: number) {
  if (!context) return '';
  const keys = splitLatexArgumentKeys(context.query);
  if (!keys.length) return context.query.trim();
  const charOffset = Math.max(0, oneBasedColumn - 1);
  const inArgumentOffset = charOffset - context.from;
  let running = 0;
  for (const key of keys) {
    const index = context.query.indexOf(key, running);
    if (index <= inArgumentOffset && inArgumentOffset <= index + key.length) return key;
    running = Math.max(index + key.length, running + key.length);
  }
  return keys[0] || context.query.trim();
}

function latexTargetAtPosition(position: number) {
  if (!view || props.kind !== 'latex') return null;
  const line = view.state.doc.lineAt(position);
  const column = Math.max(1, position - line.from + 1);
  const context = commandArgumentAtText(line.text, column);
  if (!context) return null;
  const key = targetKeyFromContext(context, column);
  if (!key) return null;
  if (REF_COMMANDS.has(context.command)) return { kind: 'label' as const, key, command: context.command, lineFrom: line.from };
  if (CITE_COMMANDS.has(context.command)) return { kind: 'bib' as const, key, command: context.command, lineFrom: line.from };
  if (INPUT_COMMANDS.has(context.command) || context.command === 'includegraphics') return { kind: 'file' as const, key, command: context.command, lineFrom: line.from };
  return null;
}

function shortAuthors(entry?: BibEntryItem) {
  if (!entry?.author) return '未知作者';
  const first = entry.author.split(/\s+and\s+/i)[0]?.trim() || entry.author;
  const last = first.includes(',') ? first.split(',')[0] : first.split(/\s+/).pop();
  return `${last || first}${entry.author.includes(' and ') ? ' et al.' : ''}`;
}

function labelSummary(label?: LatexLabelItem) {
  if (!label) return undefined;
  return [label.kind, `${label.file}:${label.line}`].filter(Boolean).join(' · ');
}

function isPreviewableImagePath(path: string) {
  return /\.(png|jpe?g|gif|webp|svg|bmp)$/i.test(path);
}

function appendText(parent: HTMLElement, tag: string, text: string, className?: string) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  element.textContent = text;
  parent.appendChild(element);
  return element;
}

function createLatexHoverDom(target: NonNullable<ReturnType<typeof latexTargetAtPosition>>) {
  const index = props.latexIndex;
  const dom = document.createElement('div');
  dom.className = 'cm-latex-hover-card';
  if (!index) {
    appendText(dom, 'strong', 'LaTeX 索引未就绪');
    return dom;
  }

  if (target.kind === 'label') {
    const label = index.labels.find((item) => item.key === target.key);
    appendText(dom, 'span', 'label / ref', 'cm-latex-hover-kicker');
    appendText(dom, 'strong', target.key);
    appendText(dom, 'small', label ? labelSummary(label)! : '未找到对应 label');
    if (label?.context) appendText(dom, 'p', label.context);
    return dom;
  }

  if (target.kind === 'bib') {
    const entry = index.citations.find((item) => item.key === target.key);
    appendText(dom, 'span', 'citation', 'cm-latex-hover-kicker');
    appendText(dom, 'strong', target.key);
    if (!entry) {
      appendText(dom, 'small', '未找到对应 BibTeX 条目');
      return dom;
    }
    appendText(dom, 'small', `${shortAuthors(entry)}${entry.year ? `, ${entry.year}` : ''} · ${entry.file}:${entry.line}`);
    if (entry.title) appendText(dom, 'p', entry.title);
    if (entry.journal || entry.booktitle) appendText(dom, 'small', entry.journal || entry.booktitle || '');
    return dom;
  }

  const sourceFile = props.currentPath;
  const resolvedPath = target.command === 'includegraphics'
    ? resolveGraphicPath(target.key, sourceFile, index.imageFiles)
    : resolveIndexedFilePath(target.key, index, sourceFile);
  appendText(dom, 'span', target.command === 'includegraphics' ? 'image' : 'file', 'cm-latex-hover-kicker');
  appendText(dom, 'strong', target.key);
  appendText(dom, 'small', resolvedPath ? `解析到：${resolvedPath}` : '未找到对应文件');

  if (target.command === 'includegraphics' && resolvedPath && isPreviewableImagePath(resolvedPath)) {
    const frame = document.createElement('div');
    frame.className = 'cm-latex-image-preview';
    frame.textContent = '正在加载图片…';
    dom.appendChild(frame);
    if (props.rootDir) {
      readWorkspaceDataUrl(props.rootDir, '', resolvedPath)
        .then((src) => {
          frame.textContent = '';
          const img = document.createElement('img');
          img.src = src;
          img.alt = resolvedPath;
          frame.appendChild(img);
        })
        .catch((error) => {
          frame.textContent = error instanceof Error ? error.message : String(error);
        });
    }
  } else if (target.command === 'includegraphics' && resolvedPath) {
    appendText(dom, 'small', '该图片格式不支持内嵌缩略图，可 Ctrl/⌘ 点击打开预览。');
  }

  return dom;
}


function snippetSource(context: CompletionContext): CompletionResult | null {
  const word = context.matchBefore(/[\\/]?[A-Za-z][\w-]*$/);
  if (!word || (word.from === word.to && !context.explicit)) return null;
  const language = props.kind === 'latex' ? 'latex' : props.kind === 'markdown' ? 'markdown' : 'both';
  const options = editorSnippets
    .filter((snippet) => snippet.language === language || snippet.language === 'both')
    .filter((snippet) => snippet.trigger.startsWith(word.text) || context.explicit)
    .map((snippet) => snippetCompletion(snippet.insert, {
      label: snippet.label,
      detail: snippet.detail,
      type: 'snippet',
    }));
  if (!options.length) return null;
  return { from: word.from, options, validFor: /^[\\/]?[\w-]*$/ };
}

function mathRangeAt(text: string, offset: number) {
  const candidates: Array<{ from: number; to: number; value: string; displayMode: boolean }> = [];
  const block = /\$\$([\s\S]*?)\$\$/g;
  let match: RegExpExecArray | null;
  while ((match = block.exec(text))) {
    candidates.push({ from: match.index, to: match.index + match[0].length, value: match[1], displayMode: true });
  }
  const inline = /(^|[^$])\$([^$\n]+?)\$/g;
  while ((match = inline.exec(text))) {
    const start = match.index + match[1].length;
    candidates.push({ from: start, to: start + match[0].length - match[1].length, value: match[2], displayMode: false });
  }
  const env = /\\begin\{(equation|align|gather|multline)\*?\}([\s\S]*?)\\end\{\1\*?\}/g;
  while ((match = env.exec(text))) {
    candidates.push({ from: match.index, to: match.index + match[0].length, value: match[2], displayMode: true });
  }
  return candidates.find((item) => offset >= item.from && offset <= item.to) || null;
}

function createMathHoverDom(value: string, displayMode: boolean) {
  const dom = document.createElement('div');
  dom.className = 'cm-latex-hover-card cm-math-hover-card';
  const title = document.createElement('span');
  title.className = 'cm-latex-hover-kicker';
  title.textContent = 'formula preview';
  dom.appendChild(title);
  const container = document.createElement('div');
  try {
    katex.render(value.trim(), container, { displayMode, throwOnError: false, strict: false });
  } catch (error) {
    container.textContent = error instanceof Error ? error.message : String(error);
  }
  dom.appendChild(container);
  return dom;
}

function copyCurrentLine(editorView: EditorView) {
  const selection = editorView.state.selection.main;
  if (!selection.empty) return false;
  const line = editorView.state.doc.lineAt(selection.head);
  const text = `${line.text}
`;
  if (navigator.clipboard?.writeText) {
    void navigator.clipboard.writeText(text);
  } else {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    textarea.remove();
  }
  return true;
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
    props.kind === 'latex'
      ? autocompletion({ override: [latexCompletionSource(() => props.latexIndex), snippetSource] })
      : props.kind === 'markdown'
        ? autocompletion({ override: [snippetSource] })
        : [],
    flashLineField,
    diagnosticLineField,
    Prec.highest(keymap.of([
      {
        key: 'Mod-c',
        run: copyCurrentLine,
      },
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
    ])),
    hoverTooltip((editorView, pos) => {
      if (props.kind === 'latex' || props.kind === 'markdown') {
        const math = mathRangeAt(editorView.state.doc.toString(), pos);
        if (math) {
          return { pos: math.from, end: math.to, above: true, create: () => ({ dom: createMathHoverDom(math.value, math.displayMode) }) };
        }
      }
      if (props.kind !== 'latex') return null;
      const target = latexTargetAtPosition(pos);
      if (!target) return null;
      return {
        pos,
        above: true,
        create: () => ({ dom: createLatexHoverDom(target) }),
      };
    }),
    EditorView.domEventHandlers({
      click: (event) => {
        if (props.kind === 'latex') {
          const nav = latexNavigationFromMouse(event);
          if (nav && (event.metaKey || event.ctrlKey)) {
            event.preventDefault();
            emit('latexNavigate', nav);
            return true;
          }
          if (nav?.kind === 'bib') emit('bibPreview', nav.key);
          return false;
        }
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
      if (update.selectionSet) {
        emitCursorLine(update.state.selection.main.head);
      }
      if (props.kind === 'latex' && update.selectionSet) {
        updateBibPreviewFromCursor(update.state.selection.main.head);
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

onMounted(() => {
  recreateEditor();
  window.setTimeout(() => {
    emitCursorLine();
    applyDiagnostics();
  }, 0);
});

watch(() => [props.darkMode, props.kind], () => {
  recreateEditor();
  window.setTimeout(applyDiagnostics, 0);
});

watch(
  () => props.diagnostics,
  () => applyDiagnostics(),
  { deep: true },
);

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
