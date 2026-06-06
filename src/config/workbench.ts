export type WorkbenchZoneId =
  | 'documents'
  | 'templates'
  | 'research-flow'
  | 'editor'
  | 'preview-review'
  | 'build-settings'
  | 'status';

export interface WorkbenchZoneDefinition {
  id: WorkbenchZoneId;
  name: string;
  role: string;
  placement: string;
  interaction: string;
}

export const WORKBENCH_ZONES: WorkbenchZoneDefinition[] = [
  {
    id: 'documents',
    name: '文档树',
    role: '项目文件、每日记录、周报、论文草稿、图片和 PDF 的统一入口。',
    placement: '固定在最左侧，和模板库并列，可拖拽调宽。',
    interaction: '打开文件后自动展开并选中对应节点；常用研究记录操作放在文档区顶部。',
  },
  {
    id: 'templates',
    name: '模板库',
    role: '创建官方或复用模板项目，不参与日常编辑流。',
    placement: '停靠在文档树右侧，只在需要创建项目时打开。',
    interaction: '搜索模板后写入当前工作区，并自动打开主文件。',
  },
  {
    id: 'research-flow',
    name: '研究流',
    role: '把日常笔记、周报、证据索引、论文大纲和审阅任务串成闭环。',
    placement: '放在编辑器左侧工作面板的第一入口，和大纲、文献、片段同级。',
    interaction: '从当前文件和工作区状态生成结构化 Markdown 文件，方便后续 AI 检索。',
  },
  {
    id: 'editor',
    name: '源码编辑',
    role: 'Markdown、LaTeX、BibTeX 与普通文本的主编辑区域。',
    placement: '主工作区中间，保持最稳定的视觉位置。',
    interaction: '保存、构建、定位、诊断和补全围绕当前文件触发。',
  },
  {
    id: 'preview-review',
    name: '预览与审阅',
    role: 'Markdown/PDF 预览、导出、PDF 批注和源码定位校准。',
    placement: '编辑器右侧，可拖拽调宽；批注栏在预览内部右侧。',
    interaction: '导出放在预览顶部；批注和 PDF/TeX 双向定位围绕可视化结果操作。',
  },
  {
    id: 'build-settings',
    name: '设置与构建',
    role: 'GitHub、作者名、LaTeX 构建、PDF 分辨率和后续依赖检测。',
    placement: '最右侧设置栏，默认可隐藏，避免干扰写作。',
    interaction: '只放跨项目配置和构建环境，不承载日常写作任务。',
  },
  {
    id: 'status',
    name: '状态栏',
    role: '展示当前任务、错误、问题面板、历史和主题切换。',
    placement: '底部，保持轻量。',
    interaction: '用于反馈，不再堆叠主流程按钮。',
  },
];

export type ResearchFlowActionId =
  | 'daily-note'
  | 'weekly-report'
  | 'evidence-index'
  | 'paper-outline'
  | 'review-summary';

export interface ResearchFlowStep {
  id: ResearchFlowActionId;
  label: string;
  shortLabel: string;
  title: string;
  description: string;
  targetPathHint: string;
  stage: 'record' | 'synthesize' | 'evidence' | 'draft' | 'review';
}

export const RESEARCH_FLOW_STEPS: ResearchFlowStep[] = [
  {
    id: 'daily-note',
    label: '今日笔记',
    shortLabel: '日',
    title: '记录今天的研究过程',
    description: '沉淀实验、阅读、图表、待办和可进入论文的结论。',
    targetPathHint: 'notes/daily/YYYY-MM-DD.md',
    stage: 'record',
  },
  {
    id: 'weekly-report',
    label: '周报',
    shortLabel: '周',
    title: '把一周工作整理成报告',
    description: '汇总进展、证据、风险、导师反馈和下周计划。',
    targetPathHint: 'notes/weekly/YYYY-Www.md',
    stage: 'synthesize',
  },
  {
    id: 'evidence-index',
    label: '证据索引',
    shortLabel: '证',
    title: '建立论文证据入口',
    description: '列出结论、来源文件、图片、数据、文献和缺失证据。',
    targetPathHint: 'research/evidence-index.md',
    stage: 'evidence',
  },
  {
    id: 'paper-outline',
    label: '论文大纲',
    shortLabel: '纲',
    title: '从材料进入论文结构',
    description: '生成问题、贡献、章节、图表、引用和待补实验清单。',
    targetPathHint: 'paper/paper-outline.md',
    stage: 'draft',
  },
  {
    id: 'review-summary',
    label: '审阅清单',
    shortLabel: '审',
    title: '把批注转成修改任务',
    description: '打开或生成批注汇总，供人工校准和 AI 修改时使用。',
    targetPathHint: '.paper-notes/review-summary.md',
    stage: 'review',
  },
];

export const PRODUCT_BACKLOG_PRIORITIES = [
  { id: 'P0', title: '上线前必须完成', focus: '稳定、数据安全、清晰主流程、依赖检测。' },
  { id: 'P1', title: '内测增长关键', focus: '研究记录闭环、证据索引、审阅任务和模板校验。' },
  { id: 'P2', title: '差异化增强', focus: '可追溯 AI、本地索引、Zotero/Better BibTeX 和论文素材池。' },
  { id: 'P3', title: '生态和扩展', focus: '发布、协作、云同步、模板市场和可视化扩展。' },
] as const;
