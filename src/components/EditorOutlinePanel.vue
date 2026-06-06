<script setup lang="ts">
import { computed, defineComponent, h, ref, watch } from 'vue';
import type { PropType } from 'vue';
import type { MarkdownDocument } from '../types/app';
import type { LatexOutlineItem } from '../types/latexIntelligence';

const props = defineProps<{
  outline: LatexOutlineItem[];
  active?: MarkdownDocument;
  activeLine?: number | null;
}>();

const emit = defineEmits<{
  open: [item: LatexOutlineItem];
  close: [];
}>();

interface OutlineTreeNode {
  item: LatexOutlineItem;
  children: OutlineTreeNode[];
}

const collapsedIds = ref(new Set<string>());
const userToggled = ref(false);

function normalize(path?: string) {
  return (path || '').replace(/\\/g, '/').replace(/^\/+/, '');
}

function isOutlineCapable(kind?: string) {
  return kind === 'latex' || kind === 'markdown';
}

const activePath = computed(() => normalize(props.active?.relativePath));
const activeOutline = computed(() => {
  if (!isOutlineCapable(props.active?.kind) || !activePath.value) return [];
  return (props.outline || [])
    .filter((item) => {
      const itemPath = normalize(item.file);
      return itemPath === activePath.value || itemPath.endsWith(`/${activePath.value}`) || activePath.value.endsWith(`/${itemPath}`);
    })
    .slice()
    .sort((a, b) => a.line - b.line);
});

const activeOutlineId = computed(() => {
  const line = props.activeLine || 1;
  let active: LatexOutlineItem | undefined;
  for (const item of activeOutline.value) {
    if (item.line <= line) active = item;
    else break;
  }
  return active?.id;
});

function itemLevel(item: LatexOutlineItem) {
  return item.displayLevel ?? item.level ?? 0;
}

const outlineTree = computed<OutlineTreeNode[]>(() => {
  const roots: OutlineTreeNode[] = [];
  const stack: OutlineTreeNode[] = [];
  for (const item of activeOutline.value) {
    const node: OutlineTreeNode = { item, children: [] };
    const level = itemLevel(item);
    while (stack.length) {
      const parentLevel = itemLevel(stack[stack.length - 1].item);
      if (parentLevel < level) break;
      stack.pop();
    }
    if (stack.length) stack[stack.length - 1].children.push(node);
    else roots.push(node);
    stack.push(node);
  }
  return roots;
});

function collectCollapsibleIds(nodes: OutlineTreeNode[], result = new Set<string>()) {
  for (const node of nodes) {
    if (node.children.length) result.add(node.item.id);
    collectCollapsibleIds(node.children, result);
  }
  return result;
}

watch(
  () => [activePath.value, activeOutline.value.map((item) => item.id).join('|')],
  () => {
    userToggled.value = false;
    collapsedIds.value = collectCollapsibleIds(outlineTree.value);
  },
  { immediate: true },
);

function toggle(item: LatexOutlineItem) {
  userToggled.value = true;
  const next = new Set(collapsedIds.value);
  if (next.has(item.id)) next.delete(item.id);
  else next.add(item.id);
  collapsedIds.value = next;
}

function kindIcon(item: LatexOutlineItem) {
  if (item.source === 'markdown') {
    const level = Math.min(6, Math.max(1, item.level || 1));
    return `H${level}`;
  }
  if (item.kind === 'part') return 'P';
  if (item.kind === 'chapter') return 'C';
  if (item.kind === 'section') return 'S1';
  if (item.kind === 'subsection') return 'S2';
  if (item.kind === 'subsubsection') return 'S3';
  if (item.kind === 'paragraph') return '¶';
  return '§';
}

const OutlineNode: any = defineComponent({
  name: 'OutlineNode',
  props: {
    node: { type: Object as PropType<OutlineTreeNode>, required: true },
    depth: { type: Number, required: true },
    activeId: { type: String, required: false },
    collapsedIds: { type: Object as PropType<Set<string>>, required: true },
    kindIcon: { type: Function as PropType<(item: LatexOutlineItem) => string>, required: true },
  },
  emits: ['toggle', 'open'],
  setup(componentProps, { emit: componentEmit }) {
    return (): any => {
      const hasChildren = componentProps.node.children.length > 0;
      const collapsed = componentProps.collapsedIds.has(componentProps.node.item.id);
      return h('li', { class: 'editor-outline-node' }, [
        h('div', {
          class: {
            'editor-outline-row': true,
            active: componentProps.activeId === componentProps.node.item.id,
          },
          style: { paddingLeft: `${8 + componentProps.depth * 14}px` },
          title: `${componentProps.node.item.file}:${componentProps.node.item.line}`,
          onClick: () => componentEmit('open', componentProps.node.item),
        }, [
          h('button', {
            class: 'editor-outline-toggle',
            title: hasChildren ? (collapsed ? '展开' : '折叠') : '',
            onClick: (event: MouseEvent) => {
              event.stopPropagation();
              if (hasChildren) componentEmit('toggle', componentProps.node.item);
            },
          }, hasChildren ? (collapsed ? '▸' : '▾') : '·'),
          h('span', { class: 'editor-outline-kind' }, componentProps.kindIcon(componentProps.node.item)),
          h('span', { class: 'editor-outline-title' }, componentProps.node.item.title),
          h('span', { class: 'editor-outline-line' }, String(componentProps.node.item.line)),
        ]),
        hasChildren && !collapsed
          ? h('ul', { class: 'editor-outline-children' }, componentProps.node.children.map((child) => h(OutlineNode, {
            key: child.item.id,
            node: child,
            depth: componentProps.depth + 1,
            activeId: componentProps.activeId,
            collapsedIds: componentProps.collapsedIds,
            kindIcon: componentProps.kindIcon,
            onToggle: (item: LatexOutlineItem) => componentEmit('toggle', item),
            onOpen: (item: LatexOutlineItem) => componentEmit('open', item),
          })))
          : null,
      ]);
    };
  },
});

function isInteractiveHeaderTarget(event: MouseEvent) {
  const target = event.target as HTMLElement | null;
  return !!target?.closest('button, input, textarea, select, a, [role="button"]');
}

function onHeaderDblclick(event: MouseEvent) {
  if (isInteractiveHeaderTarget(event)) return;
  emit('close');
}
</script>

<template>
  <aside class="editor-outline-panel">
    <header class="editor-outline-header" title="双击关闭大纲" @dblclick="onHeaderDblclick">
      <div>
        <strong>大纲</strong>
        <small>{{ active?.relativePath || '当前文档' }}</small>
      </div>
      <button class="toolbar-icon" title="隐藏大纲" @click="emit('close')">×</button>
    </header>

    <div v-if="!isOutlineCapable(active?.kind)" class="empty-state compact">
      仅 TeX 和 Markdown 文档显示大纲。
    </div>
    <div v-else-if="!activeOutline.length" class="empty-state compact">
      当前文件没有识别到章节。TeX 支持 \section、\subsection；Markdown 支持 #、## 标题。
    </div>
    <ul v-else class="editor-outline-tree">
      <OutlineNode
        v-for="node in outlineTree"
        :key="node.item.id"
        :node="node"
        :depth="0"
        :active-id="activeOutlineId"
        :collapsed-ids="collapsedIds"
        :kind-icon="kindIcon"
        @toggle="toggle"
        @open="emit('open', $event)"
      />
    </ul>
  </aside>
</template>
