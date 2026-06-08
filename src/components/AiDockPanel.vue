<script setup lang="ts">
import { computed, ref } from 'vue';
import type { AiConversationMessage, AiEvidencePack, AiGroundingMode, AiIndexStats, ProposedPatch } from '../types/ai';

const props = defineProps<{
  groundingMode: AiGroundingMode;
  indexStats: AiIndexStats;
  evidencePack?: AiEvidencePack | null;
  messages: AiConversationMessage[];
  patches: ProposedPatch[];
  activePath?: string;
}>();

const emit = defineEmits<{
  close: [];
  resizeStart: [event: MouseEvent];
  updateGroundingMode: [mode: AiGroundingMode];
  sendPrompt: [prompt: string];
  rebuildEvidence: [];
}>();

const tab = ref<'chat' | 'evidence' | 'diff' | 'settings'>('chat');
const prompt = ref('');

const groundingLabel = computed(() => {
  if (props.groundingMode === 'evidence_only') return '只使用证据库';
  if (props.groundingMode === 'prefer_evidence') return '优先使用证据';
  return '普通模式';
});

const sourceSummary = computed(() => [
  { label: 'Markdown', value: props.indexStats.markdown },
  { label: 'TeX', value: props.indexStats.tex },
  { label: 'BibTeX', value: props.indexStats.bibtex },
  { label: 'PDF 批注', value: props.indexStats.pdfAnnotation },
  { label: 'Review', value: props.indexStats.reviewItem },
  { label: 'Evidence Index', value: props.indexStats.evidenceIndex },
]);

function isInteractiveHeaderTarget(event: MouseEvent) {
  const target = event.target as HTMLElement | null;
  return !!target?.closest('button, input, textarea, select, a, [role="button"]');
}

function onHeaderDblclick(event: MouseEvent) {
  if (isInteractiveHeaderTarget(event)) return;
  emit('close');
}

function submitPrompt() {
  const text = prompt.value.trim();
  if (!text) return;
  emit('sendPrompt', text);
  prompt.value = '';
}
</script>

<template>
  <section class="bottom-panel ai-dock-panel" aria-label="AI 证据写作面板">
    <div class="bottom-panel-resize-grip" title="拖动调整 AI 面板高度" @mousedown="emit('resizeStart', $event)" />
    <div class="bottom-panel-header ai-dock-header" title="双击关闭 AI 面板" @dblclick="onHeaderDblclick">
      <div class="bottom-panel-tabs">
        <button :class="{ active: tab === 'chat' }" @click="tab = 'chat'">AI 对话</button>
        <button :class="{ active: tab === 'evidence' }" @click="tab = 'evidence'">证据库 {{ indexStats.total }}</button>
        <button :class="{ active: tab === 'diff' }" @click="tab = 'diff'">Diff 审批 {{ patches.length }}</button>
        <button :class="{ active: tab === 'settings' }" @click="tab = 'settings'">模型</button>
      </div>
      <div class="ai-dock-header-meta">
        <span class="ai-grounding-pill">{{ groundingLabel }}</span>
        <button class="toolbar-icon" title="关闭 AI 面板" @click="emit('close')">×</button>
      </div>
    </div>

    <div class="bottom-panel-body ai-dock-body">
      <div v-if="tab === 'chat'" class="ai-chat-layout">
        <aside class="ai-context-card">
          <strong>证据约束</strong>
          <select :value="groundingMode" @change="emit('updateGroundingMode', ($event.target as HTMLSelectElement).value as AiGroundingMode)">
            <option value="evidence_only">不要凭空写，只使用我的证据库</option>
            <option value="prefer_evidence">优先使用证据，缺失时提示风险</option>
            <option value="normal">普通 AI 模式</option>
          </select>
          <p>
            当前文件：<code>{{ activePath || '未打开文件' }}</code>
          </p>
          <p v-if="groundingMode === 'evidence_only'" class="ai-mode-warning">
            此模式下，正式回答必须绑定来源文件、行号、批注 ID 或 BibTeX key；没有证据时只能列出缺失证据。
          </p>
        </aside>

        <section class="ai-chat-main">
          <div class="ai-message-list">
            <p v-if="!messages.length" class="empty-state small">
              AI 底部对话框框架已就绪。下一步会接入本地证据索引、Evidence Pack、带来源回答和 Diff 审批执行。
            </p>
            <article v-for="message in messages" :key="message.id" class="ai-message" :class="message.role">
              <header>
                <strong>{{ message.role === 'user' ? '你' : message.role === 'assistant' ? 'AI' : '系统' }}</strong>
                <small>{{ new Date(message.createdAt).toLocaleString() }}</small>
              </header>
              <p>{{ message.text }}</p>
              <div v-if="message.citations?.length" class="ai-citation-list">
                <span v-for="citation in message.citations" :key="citation.evidenceId" class="ai-citation-chip">
                  {{ citation.label }}
                </span>
              </div>
              <div v-if="message.missingEvidence?.length" class="ai-missing-evidence">
                <strong>缺失证据</strong>
                <ul>
                  <li v-for="item in message.missingEvidence" :key="item">{{ item }}</li>
                </ul>
              </div>
            </article>
          </div>
          <form class="ai-prompt-box" @submit.prevent="submitPrompt">
            <textarea v-model="prompt" rows="3" placeholder="例如：只根据我的证据库，写一段 related work；或：检查当前段落缺少哪些证据。" />
            <button type="submit">发送</button>
          </form>
        </section>
      </div>

      <div v-else-if="tab === 'evidence'" class="ai-evidence-layout">
        <section class="ai-evidence-summary">
          <header>
            <div>
              <strong>本地证据索引框架</strong>
              <small>{{ indexStats.indexedAt ? `最后更新：${new Date(indexStats.indexedAt).toLocaleString()}` : indexStats.message }}</small>
            </div>
            <button @click="emit('rebuildEvidence')">重建索引（框架）</button>
          </header>
          <div class="ai-evidence-stats">
            <div v-for="item in sourceSummary" :key="item.label" class="ai-stat-card">
              <strong>{{ item.value }}</strong>
              <span>{{ item.label }}</span>
            </div>
          </div>
        </section>

        <section class="ai-evidence-pack-card">
          <strong>Evidence Pack</strong>
          <p v-if="!evidencePack" class="empty-state small">暂无检索结果。发送问题后会把命中的证据打包给 AI。</p>
          <div v-else class="ai-evidence-pack-list">
            <p><code>{{ evidencePack.id }}</code> · {{ evidencePack.task }} · {{ evidencePack.mode }}</p>
            <article v-for="item in evidencePack.evidence" :key="item.id" class="ai-evidence-item">
              <strong>{{ item.filePath }}<span v-if="item.lineStart">:L{{ item.lineStart }}{{ item.lineEnd && item.lineEnd !== item.lineStart ? `-L${item.lineEnd}` : '' }}</span></strong>
              <small>{{ item.sourceType }} {{ item.annotationId ? `· 批注 ${item.annotationId}` : '' }} {{ item.bibKey ? `· @${item.bibKey}` : '' }}</small>
              <p>{{ item.text }}</p>
            </article>
          </div>
        </section>
      </div>

      <div v-else-if="tab === 'diff'" class="ai-diff-layout">
        <p v-if="!patches.length" class="empty-state small">
          AI 修改源码时不会直接写文件。后续会在这里显示 unified diff、使用证据、风险提示和“确认后应用”。
        </p>
        <article v-for="patch in patches" :key="patch.id" class="ai-patch-card">
          <header>
            <strong>{{ patch.summary }}</strong>
            <small>{{ patch.targetFiles.join(', ') }}</small>
          </header>
          <pre>{{ patch.unifiedDiff }}</pre>
        </article>
      </div>

      <div v-else class="ai-settings-layout">
        <section class="ai-context-card">
          <strong>模型接入预留</strong>
          <p>第一阶段只搭建 UI 与数据流，不把项目证据发送到外部服务。</p>
          <ul>
            <li>本地索引：SQLite/FTS5 预留。</li>
            <li>远程模型：OpenAI-compatible API 预留。</li>
            <li>证据模式：normal / prefer_evidence / evidence_only。</li>
            <li>源码修改：先生成 diff，确认后应用。</li>
          </ul>
        </section>
      </div>
    </div>
  </section>
</template>
