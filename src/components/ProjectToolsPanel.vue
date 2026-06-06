<script setup lang="ts">
import { computed, ref } from 'vue';
import type { GitWorkspace } from '../types/app';
import type { BibEntryItem, LatexDiagnosticItem, ProjectLatexIndex } from '../types/latexIntelligence';
import { BUILTIN_TEMPLATES, DEFAULT_EXPORT_PROFILES, FUTURE_FEATURE_FRAMEWORKS } from '../services/templates';

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
  createTemplate: [templateId: string];
  createDailyNote: [];
  createSnapshot: [];
  exportFormat: [format: 'pdf' | 'docx' | 'html' | 'epub' | 'latex' | 'beamer'];
}>();

const tab = ref<'templates' | 'profiles' | 'research' | 'writing' | 'publish' | 'roadmap'>('templates');

const tabItems = [
  { key: 'templates', label: '模板' },
  { key: 'profiles', label: '导出' },
  { key: 'research', label: '文献' },
  { key: 'writing', label: '写作' },
  { key: 'publish', label: '发布' },
  { key: 'roadmap', label: '框架' },
] as const;

const bibCount = computed(() => props.latexIndex.citations.length);
const labelCount = computed(() => props.latexIndex.labels.length);
const problemCount = computed(() => props.diagnostics.length);
const templateDisabledReason = computed(() => props.workspace?.localDir ? '' : '请先打开本地文件夹或 GitHub 工作区');

function formatAuthors(entry: BibEntryItem) {
  return entry.author || '未知作者';
}
</script>

<template>
  <section class="side-work-panel project-tools-panel">
    <header class="side-work-panel-header">
      <div>
        <strong>项目工具</strong>
        <small>模板、导出、文献、写作和后续扩展框架</small>
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

    <div v-if="tab === 'templates'" class="tool-section-stack">
      <p class="empty-state small">从内置模板初始化项目骨架。第一版会把模板文件写入当前工作区的子目录，后续可扩展为模板市场和用户模板目录。</p>
      <article v-for="template in BUILTIN_TEMPLATES" :key="template.id" class="tool-card">
        <div class="tool-card-main">
          <strong>{{ template.name }}</strong>
          <span>{{ template.description }}</span>
          <small>主文件：{{ template.mainFile }} · {{ template.engine || '默认引擎' }}</small>
        </div>
        <button class="primary" :disabled="!!templateDisabledReason" :title="templateDisabledReason || '从模板创建项目'" @click="emit('createTemplate', template.id)">使用</button>
        <ul v-if="template.roadmap?.length" class="tool-roadmap-list">
          <li v-for="item in template.roadmap" :key="item">{{ item }}</li>
        </ul>
      </article>
    </div>

    <div v-else-if="tab === 'profiles'" class="tool-section-stack">
      <p class="empty-state small">导出配置 Profile 的框架已建立。当前可直接触发 Pandoc 导出；后续会保存不同目标的参数组合到 <code>.paper-notes/export-profiles.json</code>。</p>
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
        <div><strong>{{ bibCount }}</strong><span>BibTeX 条目</span></div>
        <div><strong>{{ labelCount }}</strong><span>Label</span></div>
        <div><strong>{{ problemCount }}</strong><span>问题</span></div>
      </div>
      <article class="tool-card">
        <div class="tool-card-main">
          <strong>Zotero / Better BibTeX</strong>
          <span>框架入口已预留。建议第一阶段支持 Better BibTeX 自动导出的 .bib 文件路径，并监听它变化。</span>
          <small>TODO：设置路径、引用搜索弹窗、插入引用并同步 refs.bib。</small>
        </div>
      </article>
      <article class="tool-card">
        <div class="tool-card-main">
          <strong>DOI / ISBN / URL 导入</strong>
          <span>预留元数据导入服务。后续通过 CrossRef / ISBN / 网页解析生成 BibTeX。</span>
          <small>TODO：Rust 命令 metadata.rs、cite key 规则、写入 refs.bib。</small>
        </div>
      </article>
      <article v-if="latexIndex.citations.slice(0, 3).length" class="tool-card soft">
        <div class="tool-card-main">
          <strong>最近索引到的文献</strong>
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
          <span>创建或打开今天的写作记录，后续可自动聚合当天批注、编辑文件和 TODO。</span>
        </div>
        <button @click="emit('createDailyNote')">打开今天</button>
      </article>
      <article class="tool-card">
        <div class="tool-card-main">
          <strong>轻量快照</strong>
          <span>当前版本先写入快照 manifest，后续扩展为文件内容快照、diff 和恢复。</span>
        </div>
        <button @click="emit('createSnapshot')">创建快照</button>
      </article>
      <article class="tool-card soft">
        <div class="tool-card-main">
          <strong>写作目标</strong>
          <span>TODO：每日目标、项目字数统计、日历热力图、writing-stats.jsonl。</span>
        </div>
      </article>
    </div>

    <div v-else-if="tab === 'publish'" class="tool-section-stack">
      <article class="tool-card">
        <div class="tool-card-main">
          <strong>Hugo / Jekyll 发布</strong>
          <span>发布框架已预留。后续将 Markdown、图片和 frontmatter 转换并复制到博客目录。</span>
          <small>TODO：发布 profile、资源路径重写、数学公式兼容。</small>
        </div>
      </article>
      <article class="tool-card">
        <div class="tool-card-main">
          <strong>Beamer 幻灯片</strong>
          <span>当前可通过 Pandoc Beamer 导出；后续增加模板、主题预览和演示文稿模式。</span>
        </div>
        <button :disabled="props.activeKind !== 'markdown' || props.busy" @click="emit('exportFormat', 'beamer')">导出 Beamer</button>
      </article>
    </div>

    <div v-else class="tool-section-stack">
      <p class="empty-state small">这些是后续功能的代码级框架和扩展入口，详细任务已同步到 TODO.md。</p>
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
