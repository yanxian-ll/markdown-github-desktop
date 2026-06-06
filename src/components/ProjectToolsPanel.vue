<script setup lang="ts">
import { computed, ref } from 'vue';
import type { GitWorkspace } from '../types/app';
import type { BibEntryItem, LatexDiagnosticItem, ProjectLatexIndex } from '../types/latexIntelligence';
import { DEFAULT_EXPORT_PROFILES, FUTURE_FEATURE_FRAMEWORKS } from '../services/templates';

const props = defineProps<{
  activeKind?: string;
  workspace?: GitWorkspace;
  writingStatsLabel?: string;
  latexIndex: ProjectLatexIndex;
  diagnostics: LatexDiagnosticItem[];
  busy?: boolean;
}>();

const emit = defineEmits<{
  close: [];
  createDailyNote: [];
  createSnapshot: [];
  exportFormat: [format: 'pdf' | 'docx' | 'html' | 'epub' | 'latex' | 'beamer'];
}>();

const tab = ref<'profiles' | 'research' | 'writing' | 'publish' | 'roadmap'>('profiles');

const tabItems = [
  { key: 'profiles', label: '导出' },
  { key: 'research', label: '文献' },
  { key: 'writing', label: '写作' },
  { key: 'publish', label: '发布' },
  { key: 'roadmap', label: '框架' },
] as const;

const bibCount = computed(() => props.latexIndex.citations.length);
const labelCount = computed(() => props.latexIndex.labels.length);
const problemCount = computed(() => props.diagnostics.length);

function formatAuthors(entry: BibEntryItem) {
  return entry.author || '未知作者';
}
</script>

<template>
  <section class="side-work-panel project-tools-panel">
    <header class="side-work-panel-header">
      <div>
        <strong>项目工具</strong>
        <small>导出、文献、写作和发布</small>
      </div>
      <button class="toolbar-icon" title="关闭" @click="emit('close')">×</button>
    </header>

    <div class="panel-tabs compact project-tool-tabs">
      <button
        v-for="item in tabItems"
        :key="item.key"
        :class="{ active: tab === item.key }"
        @click="tab = item.key"
      >
        {{ item.label }}
      </button>
    </div>

    <div v-if="tab === 'profiles'" class="tool-section-stack">
      <article v-for="profile in DEFAULT_EXPORT_PROFILES" :key="profile.id" class="tool-card">
        <div class="tool-card-main">
          <strong>{{ profile.name }}</strong>
          <span>{{ profile.description }}</span>
          <code>{{ profile.commandHint }}</code>
        </div>
        <button :disabled="props.activeKind !== 'markdown' || props.busy" @click="emit('exportFormat', profile.format)">导出</button>
      </article>
    </div>

    <div v-else-if="tab === 'research'" class="tool-section-stack">
      <div class="tool-stats-grid">
        <div><strong>{{ bibCount }}</strong><span>BibTeX</span></div>
        <div><strong>{{ labelCount }}</strong><span>Label</span></div>
        <div><strong>{{ problemCount }}</strong><span>问题</span></div>
      </div>
      <article class="tool-card">
        <div class="tool-card-main">
          <strong>Zotero / Better BibTeX</strong>
          <span>预留引用库路径、搜索和插入入口。</span>
        </div>
      </article>
      <article class="tool-card">
        <div class="tool-card-main">
          <strong>DOI / ISBN / URL 导入</strong>
          <span>预留元数据导入和 refs.bib 写入服务。</span>
        </div>
      </article>
      <article v-if="latexIndex.citations.slice(0, 3).length" class="tool-card soft">
        <div class="tool-card-main">
          <strong>最近文献</strong>
          <span v-for="entry in latexIndex.citations.slice(0, 3)" :key="entry.key">{{ entry.key }} · {{ formatAuthors(entry) }} · {{ entry.year || '无年份' }}</span>
        </div>
      </article>
    </div>

    <div v-else-if="tab === 'writing'" class="tool-section-stack">
      <div class="tool-stats-grid">
        <div><strong>{{ writingStatsLabel || '0 字' }}</strong><span>当前文件</span></div>
      </div>
      <article class="tool-card">
        <div class="tool-card-main">
          <strong>每日笔记</strong>
          <span>创建或打开今天的写作记录。</span>
        </div>
        <button @click="emit('createDailyNote')">打开今天</button>
      </article>
      <article class="tool-card">
        <div class="tool-card-main">
          <strong>轻量快照</strong>
          <span>写入当前工作区快照 manifest。</span>
        </div>
        <button @click="emit('createSnapshot')">创建快照</button>
      </article>
    </div>

    <div v-else-if="tab === 'publish'" class="tool-section-stack">
      <article class="tool-card">
        <div class="tool-card-main">
          <strong>Hugo / Jekyll 发布</strong>
          <span>预留发布 profile 和资源路径重写。</span>
        </div>
      </article>
      <article class="tool-card">
        <div class="tool-card-main">
          <strong>Beamer 幻灯片</strong>
          <span>Markdown → Beamer PDF。</span>
        </div>
        <button :disabled="props.activeKind !== 'markdown' || props.busy" @click="emit('exportFormat', 'beamer')">导出</button>
      </article>
    </div>

    <div v-else class="tool-section-stack">
      <article v-for="feature in FUTURE_FEATURE_FRAMEWORKS" :key="feature.id" class="tool-card roadmap-card">
        <div class="tool-card-main">
          <strong>{{ feature.title }}</strong>
          <span>{{ feature.description }}</span>
          <small>阶段：{{ feature.stage }}</small>
        </div>
        <ul class="tool-roadmap-list">
          <li v-for="item in feature.next" :key="item">{{ item }}</li>
        </ul>
      </article>
    </div>
  </section>
</template>
