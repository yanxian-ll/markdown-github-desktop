<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { EditorView, basicSetup } from 'codemirror';
import { markdown } from '@codemirror/lang-markdown';
import { keymap } from '@codemirror/view';
import { oneDark } from '@codemirror/theme-one-dark';

const props = defineProps<{
  modelValue: string;
  darkMode?: boolean;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: string];
  save: [];
}>();

const host = ref<HTMLDivElement | null>(null);
let view: EditorView | null = null;
let applyingExternalUpdate = false;

function createExtensions() {
  return [
    basicSetup,
    markdown(),
    keymap.of([
      {
        key: 'Mod-s',
        preventDefault: true,
        run: () => {
          emit('save');
          return true;
        },
      },
    ]),
    EditorView.updateListener.of((update) => {
      if (update.docChanged && !applyingExternalUpdate) {
        emit('update:modelValue', update.state.doc.toString());
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

onMounted(() => {
  if (!host.value) return;
  view = new EditorView({
    doc: props.modelValue,
    extensions: createExtensions(),
    parent: host.value,
  });
});

watch(
  () => props.modelValue,
  (value) => {
    if (!view || view.state.doc.toString() === value) return;
    applyingExternalUpdate = true;
    view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: value } });
    applyingExternalUpdate = false;
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
