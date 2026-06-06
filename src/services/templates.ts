export type {
  BuiltinTemplate,
  BuiltinTemplateFactory,
  TemplateFile,
  TemplateKind,
  TemplateLicense,
  TemplateProvider,
  TemplateSource,
} from '../templates';
export { BUILTIN_TEMPLATES, getBuiltinTemplate, listBuiltinTemplateFactories } from '../templates';

export interface ExportProfile {
  id: string;
  name: string;
  format: 'pdf' | 'docx' | 'html' | 'epub' | 'latex' | 'beamer';
  description: string;
  commandHint: string;
}

export const DEFAULT_EXPORT_PROFILES: ExportProfile[] = [
  { id: 'pdf-xelatex', name: 'PDF 投稿版', format: 'pdf', description: 'Markdown → PDF，适合快速预览和投稿前检查。', commandHint: 'pandoc input.md -o output.pdf --pdf-engine=xelatex' },
  { id: 'word-review', name: 'Word 审阅版', format: 'docx', description: '导出 DOCX 给不使用 LaTeX 的合作者审阅。', commandHint: 'pandoc input.md -o output.docx' },
  { id: 'html-web', name: 'HTML 网页版', format: 'html', description: '导出单页 HTML，适合博客或网页预览。', commandHint: 'pandoc input.md -o output.html --standalone' },
  { id: 'beamer-talk', name: 'Beamer 演示版', format: 'beamer', description: 'Markdown → Beamer PDF 演示文稿。', commandHint: 'pandoc slides.md -t beamer -o slides.pdf' },
];

export interface RoadmapFeature {
  id: string;
  title: string;
  stage: 'framework' | 'basic' | 'todo';
  description: string;
  next: string[];
}

export const FUTURE_FEATURE_FRAMEWORKS: RoadmapFeature[] = [
  {
    id: 'zotero',
    title: 'Zotero / Better BibTeX 集成',
    stage: 'framework',
    description: '先预留设置入口和引用库搜索面板，后续读取 Better BibTeX 自动导出的 .bib。',
    next: ['设置 Better BibTeX .bib 路径', '监听文件变化', '引用搜索弹窗 Ctrl/Cmd+Shift+R'],
  },
  {
    id: 'doi-import',
    title: 'DOI / ISBN / URL 元数据导入',
    stage: 'framework',
    description: '预留元数据导入表单和 refs.bib 写入服务。',
    next: ['CrossRef DOI 查询', 'ISBN 查询', '自动生成 cite key'],
  },
  {
    id: 'snapshots',
    title: '自动快照与版本对比',
    stage: 'basic',
    description: '当前实现轻量 manifest 快照；后续复制文件内容并做 diff。',
    next: ['保存时自动快照', '快照清理策略', '双版本 diff'],
  },
  {
    id: 'daily-notes',
    title: '每日笔记与写作目标',
    stage: 'basic',
    description: '当前可一键创建每日笔记；后续接入字数目标和日历热力图。',
    next: ['writing-stats.jsonl', '每日目标进度', 'GitHub 风格热力图'],
  },
  {
    id: 'visualizations',
    title: '公式 / Mermaid / Plotly / TikZ 预览',
    stage: 'framework',
    description: '公式 hover 已有基础；预留图表和 TikZ 外部编译框架。',
    next: ['Mermaid 代码块稳定渲染', 'Plotly JSON/YAML', 'TikZ 编译 SVG 缓存'],
  },
  {
    id: 'publishing',
    title: 'Hugo / Jekyll 博客发布',
    stage: 'framework',
    description: '预留发布 profile，后续把 Markdown、图片和 frontmatter 复制到博客目录。',
    next: ['Hugo profile', 'Jekyll profile', '资源复制和路径重写'],
  },
  {
    id: 'pdf-notes-db',
    title: 'PDF 批注数据库与笔记互联',
    stage: 'framework',
    description: '现有批注 JSONL 已可搜索和导出；后续增加引用块和双链。',
    next: ['PDF 选区转 Markdown 引用块', '按标签/页码/文献导出', 'todonotes 导出'],
  },
];
