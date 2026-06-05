<script setup lang="ts">
import { computed, defineComponent, h, ref } from 'vue';
import type { PropType } from 'vue';
import type { FileNode, MarkdownDocument } from '../types/app';

const props = defineProps<{
  tree: FileNode[];
  active?: MarkdownDocument;
  dirtyCount: number;
  visible: boolean;
  selectedPath?: string;
}>();

const emit = defineEmits<{
  open: [node: FileNode];
  create: [parent?: FileNode];
  rename: [node?: FileNode];
  delete: [node: FileNode];
  refresh: [];
  openLocal: [kind: 'folder' | 'file'];
  hide: [];
  select: [node?: FileNode];
  move: [payload: { source: FileNode; target?: FileNode }];
}>();

const draggedNode = ref<FileNode | null>(null);
const rootDragOver = ref(false);
const openMenuVisible = ref(false);

function createFromSelection() {
  emit('create');
}

function clearSelection() {
  emit('select', undefined);
}

function dropToRoot() {
  rootDragOver.value = false;
  if (!draggedNode.value) return;
  emit('move', { source: draggedNode.value });
  draggedNode.value = null;
}

function dropOnNode(target: FileNode) {
  if (!draggedNode.value) return;
  emit('move', { source: draggedNode.value, target });
  draggedNode.value = null;
  rootDragOver.value = false;
}

function displayPath(path?: string) {
  return (path || '').replace(/^\/+/, '').replace(/\\/g, '/');
}

const activeDisplayPath = computed(() => displayPath(props.active?.relativePath));


const TreeNode: any = defineComponent({
  name: 'TreeNode',
  props: {
    node: { type: Object as PropType<FileNode>, required: true },
    activePath: { type: String, required: false },
    selectedPath: { type: String, required: false },
    draggedPath: { type: String, required: false },
  },
  emits: ['open', 'create', 'rename', 'delete', 'select', 'dragstart-node', 'dragend-node', 'drop-node'],
  setup(componentProps, { emit: componentEmit }) {
    const expanded = ref(false);
    const dragOver = ref(false);

    const icon = () => {
      if (componentProps.node.kind === 'folder') return expanded.value ? '▾' : '▸';
      if (componentProps.node.documentKind === 'latex') return 'TEX';
      if (componentProps.node.documentKind === 'bibtex') return 'BIB';
      if (componentProps.node.documentKind === 'markdown') return 'MD';
      if (componentProps.node.documentKind === 'image') return 'IMG';
      if (componentProps.node.documentKind === 'pdf') return 'PDF';
      return 'TXT';
    };

    const onClick = () => {
      componentEmit('select', componentProps.node);
      if (componentProps.node.kind === 'folder') expanded.value = !expanded.value;
      else componentEmit('open', componentProps.node);
    };

    const onDragStart = (event: DragEvent) => {
      event.stopPropagation();
      event.dataTransfer?.setData('text/plain', componentProps.node.path);
      if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
      componentEmit('dragstart-node', componentProps.node);
    };

    const onDragOver = (event: DragEvent) => {
      if (!componentProps.draggedPath || componentProps.draggedPath === componentProps.node.path) return;
      event.preventDefault();
      event.stopPropagation();
      dragOver.value = true;
      if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
    };

    const onDrop = (event: DragEvent) => {
      if (!componentProps.draggedPath) return;
      event.preventDefault();
      event.stopPropagation();
      dragOver.value = false;
      componentEmit('drop-node', componentProps.node);
    };

    const stop = (event: MouseEvent) => event.stopPropagation();

    return (): any => h('li', [
      h('div', {
        class: {
          'tree-row': true,
          active: componentProps.node.kind === 'file' && !!componentProps.activePath && componentProps.activePath.endsWith(componentProps.node.path),
          selected: componentProps.selectedPath === componentProps.node.path,
          folder: componentProps.node.kind === 'folder',
          dragging: componentProps.draggedPath === componentProps.node.path,
          'drag-over': dragOver.value,
        },
        draggable: true,
        onClick,
        onDragstart: onDragStart,
        onDragend: () => componentEmit('dragend-node'),
        onDragover: onDragOver,
        onDragleave: () => { dragOver.value = false; },
        onDrop,
      }, [
        h('span', { class: 'tree-icon' }, icon()),
        h('span', { class: 'tree-name', title: componentProps.node.path }, componentProps.node.name),
        h('span', { class: 'tree-actions' }, [
          componentProps.node.kind === 'folder'
            ? h('button', { class: 'tree-action', title: '在此文件夹中新建', onClick: (event: MouseEvent) => { stop(event); componentEmit('create', componentProps.node); } }, '＋')
            : null,
          h('button', { class: 'tree-action', title: '重命名', onClick: (event: MouseEvent) => { stop(event); componentEmit('rename', componentProps.node); } }, '✎'),
          h('button', { class: 'tree-action danger', title: '删除', onClick: (event: MouseEvent) => { stop(event); componentEmit('delete', componentProps.node); } }, '×'),
        ]),
      ]),
      componentProps.node.kind === 'folder' && expanded.value
        ? h('ul', { class: 'tree-children' }, componentProps.node.children.map((child) => h(TreeNode, {
          key: child.path,
          node: child,
          activePath: componentProps.activePath,
          selectedPath: componentProps.selectedPath,
          draggedPath: componentProps.draggedPath,
          onOpen: (node: FileNode) => componentEmit('open', node),
          onCreate: (node: FileNode) => componentEmit('create', node),
          onRename: (node: FileNode) => componentEmit('rename', node),
          onDelete: (node: FileNode) => componentEmit('delete', node),
          onSelect: (node?: FileNode) => componentEmit('select', node),
          onDragstartNode: (node: FileNode) => componentEmit('dragstart-node', node),
          onDragendNode: () => componentEmit('dragend-node'),
          onDropNode: (node: FileNode) => componentEmit('drop-node', node),
        })))
        : null,
    ]);
  },
});
</script>

<template>
  <aside v-if="props.visible" class="sidebar explorer-panel">
    <div class="sidebar-header">
      <div>
        <strong>文档</strong>
        <small>{{ props.dirtyCount ? `${props.dirtyCount} 个未保存` : '项目文件与结构' }}</small>
      </div>
      <div class="sidebar-header-actions">
        <div class="open-local-menu-wrap">
          <button class="icon-button primary" title="打开本地文档" @click.stop="openMenuVisible = !openMenuVisible">📂</button>
          <div v-if="openMenuVisible" class="open-local-menu" @click.stop>
            <button @click="openMenuVisible = false; emit('openLocal', 'folder')">打开文件夹</button>
            <button @click="openMenuVisible = false; emit('openLocal', 'file')">打开文件</button>
          </div>
        </div>
        <button class="icon-button" title="在当前选中目录中新建；未选中时在根目录新建" @click="createFromSelection">＋</button>
        <button class="icon-button" title="刷新目录树和大纲索引" @click="emit('refresh')">↻</button>
        <button class="icon-button" title="隐藏文档树" @click="emit('hide')">☰</button>
      </div>
    </div>

    <div class="tree-drop-root" :class="{ 'drag-over': rootDragOver }" @click="clearSelection" @dragover.prevent="rootDragOver = !!draggedNode" @dragleave="rootDragOver = false" @drop.prevent="dropToRoot">
      <div v-if="!props.tree.length" class="empty-state">
        当前没有打开文档。点击上方 📂 打开本地文件或文件夹，也可以在设置中获取/更新 GitHub 工作区。
      </div>

      <ul v-else class="tree-root" @click.stop>
        <TreeNode
          v-for="node in props.tree"
          :key="node.path"
          :node="node"
          :active-path="props.active?.relativePath"
          :selected-path="props.selectedPath"
          :dragged-path="draggedNode?.path"
          @open="emit('open', $event)"
          @create="emit('create', $event)"
          @rename="emit('rename', $event)"
          @delete="emit('delete', $event)"
          @select="emit('select', $event)"
          @dragstart-node="draggedNode = $event"
          @dragend-node="draggedNode = null; rootDragOver = false"
          @drop-node="dropOnNode"
        />
      </ul>
    </div>
  </aside>
</template>
