# Scholia Studio 研究工作台架构说明

版本：v0.10.0-research-workbench-foundation

## 1. 产品主线

Scholia Studio 不以“直接生成论文”为中心，而以“研究过程可追溯”为中心：

```text
日常记录 → 周报总结 → 证据索引 → 论文大纲 / 草稿 → PDF/源码审阅 → 可投稿项目
```

这个闭环决定后续所有模块的位置、命名和数据结构。

## 2. 工作区分层

| 区域 | 放置位置 | 职责 | 不应该承担的职责 |
| --- | --- | --- | --- |
| 文档树 | 最左侧 | 项目文件、每日笔记、周报、证据索引、论文大纲、图片、PDF 的入口 | 不放复杂设置，不放长流程配置 |
| 模板库 | 文档树右侧，可隐藏 | 创建官方或公开可复用模板项目 | 不做日常写作工具，不做模板市场之前的复杂管理 |
| 研究流 | 编辑器左侧工作面板第一入口 | 串联记录、周报、证据、大纲、审阅清单 | 不替代文档树，不直接生成最终论文 |
| 源码编辑 | 中间主区域 | Markdown、LaTeX、BibTeX、文本编辑 | 不放批注列表，不放项目环境设置 |
| 预览与审阅 | 编辑器右侧 | Markdown/PDF 预览、导出、批注、SyncTeX 校准 | 不放文献管理，不放模板创建 |
| 设置与构建 | 最右侧，可隐藏 | Git、作者、依赖检测、构建、PDF 分辨率 | 不承载日常研究记录 |
| 状态栏 | 底部 | 任务状态、错误、问题、历史入口 | 不堆叠主要功能按钮 |

这些定义写在 `src/config/workbench.ts` 中，后续新功能应优先挂载到已有区域，而不是继续向 `App.vue` 堆硬编码。

## 3. 当前新增文件

```text
src/config/workbench.ts
  - WORKBENCH_ZONES：底层工作区定义
  - RESEARCH_FLOW_STEPS：研究流步骤定义
  - PRODUCT_BACKLOG_PRIORITIES：产品优先级定义

src/components/ResearchFlowPanel.vue
  - 编辑区左侧研究流面板
  - 触发每日笔记、周报、证据索引、论文大纲、审阅清单
  - 展示引用、label、未处理批注统计

TODO.md
  - 按 P0/P1/P2/P3 重写
  - 以“上线前必须完成”和“差异化闭环”为中心
```

## 4. Store 当前职责与后续拆分

当前 `src/stores/appStore.ts` 仍然是大一统 Store。短期为了兼容已有功能没有强行拆分，但后续应按下面结构拆开：

```text
src/stores/workspaceStore.ts
  - 打开文件夹 / 文件
  - 文档树
  - 文件创建、删除、移动、重命名
  - 工作区 project.json

src/stores/editorStore.ts
  - 当前文档
  - dirty 状态
  - 保存、自动保存、光标、跳转

src/stores/researchStore.ts
  - 每日笔记
  - 周报
  - 证据索引
  - 论文大纲
  - 论文素材池

src/stores/previewStore.ts
  - PDF / Markdown 预览
  - 图片预览
  - PDF 渲染质量
  - SyncTeX 正反向定位

src/stores/annotationStore.ts
  - 批注 JSONL
  - review-items
  - review-summary
  - 批注状态、回复、导出

src/stores/buildStore.ts
  - LaTeX 构建
  - Pandoc 导出
  - 日志诊断
  - 依赖检测

src/stores/settingsStore.ts
  - 主题
  - 面板宽度
  - 外部依赖路径
  - 作者、GitHub token 状态
```

推荐拆分顺序：

1. `annotationStore`：批注数据独立，最容易从 appStore 中拆出。
2. `buildStore`：构建和导出任务独立，便于做依赖检测。
3. `researchStore`：研究流是核心差异化，应独立演进。
4. `workspaceStore` / `editorStore`：拆分前需要先梳理打开文件、选中文档树、保存和刷新之间的耦合。

## 5. 研究流文件路径约定

| 类型 | 路径 | 用途 |
| --- | --- | --- |
| 每日笔记 | `notes/daily/YYYY-MM-DD.md` | 日常实验、阅读、图表、结论、证据、风险 |
| 周报 | `notes/weekly/YYYY-Www.md` | 一周进展、关键证据、风险、论文推进 |
| 证据索引 | `research/evidence-index.md` | Claim 到证据来源的矩阵 |
| 论文大纲 | `paper/paper-outline.md` | 从证据进入论文结构 |
| 审阅汇总 | `.paper-notes/review-summary.md` | 批注与修改任务摘要 |
| 审阅任务 | `.paper-notes/review-items.jsonl` | 给 AI 或后续自动修改使用的结构化审阅数据 |

这些路径需要保持稳定，因为后续本地索引和 AI 检索会依赖它们。

## 6. 交互放置规则

### 6.1 文档区

文档区是“材料入口”。适合放：

- 打开文件夹 / 文件
- 新建文件 / 文件夹
- 今日笔记、周报、证据索引、论文大纲快捷入口
- 文件树、拖拽、重命名、删除

不适合放：

- GitHub token
- Pandoc 参数
- PDF 分辨率
- 文献详情编辑

### 6.2 编辑区左侧工作面板

这里是“围绕当前文件的辅助工作区”。适合放：

- 研究流
- 当前文件大纲
- BibTeX 搜索
- Snippet
- 历史 / diff

不适合放：

- 模板创建
- 预览导出
- 环境设置

### 6.3 预览区

预览区是“可视化结果和审阅”。适合放：

- Markdown 预览
- PDF 预览
- 导出菜单
- 查看 Pandoc PDF
- 批注开关
- PDF/TeX 双向定位

不适合放：

- 每日笔记入口
- 文献管理入口
- 模板市场

### 6.4 设置与构建区

这里是“低频但重要的配置”。适合放：

- 依赖检测
- GitHub 设置
- 作者名
- PDF 渲染质量
- LaTeX 构建和清理
- Pandoc / LaTeX 路径设置

不适合放：

- 日常写作入口
- 论文证据索引入口
- 复杂审阅列表

## 7. 后续底层数据建议

建议新增 `.paper-notes/project.json`：

```json
{
  "schemaVersion": 1,
  "projectType": "paper",
  "mainTex": "main.tex",
  "mainMarkdown": "paper.md",
  "research": {
    "dailyDir": "notes/daily",
    "weeklyDir": "notes/weekly",
    "evidenceIndex": "research/evidence-index.md",
    "paperOutline": "paper/paper-outline.md"
  },
  "exportProfiles": ".paper-notes/export-profiles.json",
  "reviewItems": ".paper-notes/review-items.jsonl"
}
```

这可以让后续功能避免到处硬编码路径。

## 8. 近期技术债

- `App.vue` 仍然承载大量布局和事件转发，需要继续拆成 `WorkbenchLayout.vue`、`EditorWorkspace.vue`、`PreviewWorkspace.vue`。
- `appStore.ts` 仍然过大，后续新增 AI 和索引前必须拆分。
- `ProjectToolsPanel.vue` 已不再是主交互入口，后续应删除或改成设置区的低频工具。
- 面板宽度目前仍在组件局部状态，需要写入持久化设置。
- 文档区研究快捷入口目前只是创建稳定路径文件，后续应自动聚合已有内容。
