<script setup lang="ts">
import { computed, ref } from 'vue';
import { BUILTIN_TEMPLATES } from '../services/templates';

const props = withDefaults(defineProps<{
  disabledReason?: string;
  compact?: boolean;
  showIntro?: boolean;
  highlightFirst?: boolean;
}>(), {
  disabledReason: '',
  compact: false,
  showIntro: false,
  highlightFirst: false,
});

const emit = defineEmits<{
  create: [templateId: string];
}>();

const query = ref('');
const activeTag = ref('全部');

const templates = computed(() => BUILTIN_TEMPLATES);
const priorityTags = ['全部', '期刊', '会议', '毕业论文', '遥感', '摄影测量', '官方来源', '中文', 'IEEE', 'Elsevier', 'ISPRS', 'TGRS', 'RSE', 'Markdown', 'Beamer'];

const tags = computed(() => {
  const set = new Set<string>();
  for (const template of templates.value) {
    for (const tag of template.tags || []) set.add(tag);
  }
  const sorted = [...set].sort((a, b) => {
    const ai = priorityTags.indexOf(a);
    const bi = priorityTags.indexOf(b);
    if (ai !== -1 || bi !== -1) return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
    return a.localeCompare(b, 'zh-Hans-CN');
  });
  return ['全部', ...sorted];
});

const filteredTemplates = computed(() => {
  const keyword = query.value.trim().toLowerCase();
  return templates.value.filter((template) => {
    const tagMatched = activeTag.value === '全部' || template.tags?.includes(activeTag.value);
    if (!tagMatched) return false;
    if (!keyword) return true;
    const haystack = [
      template.name,
      template.description,
      template.mainFile,
      template.engine,
      template.bibliography,
      template.provider?.name,
      ...(template.tags || []),
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return haystack.includes(keyword);
  });
});

function templateMeta(template: (typeof BUILTIN_TEMPLATES)[number]) {
  return [template.kind.toUpperCase(), template.engine || '默认引擎'].filter(Boolean).join(' · ');
}
</script>

<template>
  <section class="template-gallery" :class="{ compact: props.compact }">
    <div v-if="props.showIntro" class="template-gallery-intro">
      <strong>模板中心</strong>
      <small>{{ filteredTemplates.length }} / {{ templates.length }}</small>
    </div>

    <div class="template-filter-bar">
      <input v-model="query" type="search" placeholder="搜索模板、期刊、标签" />
      <div class="template-filter-tags" aria-label="模板标签">
        <button
          v-for="tag in tags"
          :key="tag"
          class="tag-filter-button"
          :class="{ active: activeTag === tag }"
          @click="activeTag = tag"
        >
          {{ tag }}
        </button>
      </div>
    </div>

    <div v-if="filteredTemplates.length" class="template-card-grid">
      <article
        v-for="(template, index) in filteredTemplates"
        :key="template.id"
        class="template-card"
        :class="{ featured: props.highlightFirst && index === 0 }"
      >
        <div class="template-card-header">
          <div>
            <strong>{{ template.name }}</strong>
            <span>{{ template.description }}</span>
          </div>
          <em>{{ template.provider?.name || 'Built-in' }}</em>
        </div>

        <div class="template-meta-line">
          <small>{{ template.mainFile }}</small>
          <small>{{ templateMeta(template) }}</small>
        </div>

        <div v-if="template.tags?.length" class="template-tag-row">
          <span v-for="tag in template.tags.slice(0, 8)" :key="tag" class="template-tag">{{ tag }}</span>
        </div>

        <div class="template-card-actions">
          <button
            class="primary"
            :disabled="!!props.disabledReason"
            :title="props.disabledReason || '从模板创建项目'"
            @click="emit('create', template.id)"
          >
            使用
          </button>
        </div>
      </article>
    </div>

    <p v-else class="empty-state small">没有匹配的模板。</p>
  </section>
</template>
