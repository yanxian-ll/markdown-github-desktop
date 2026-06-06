# v0.10.0-research-workbench-foundation

本版本把产品方向从“编辑器功能堆叠”调整为“研究记录到论文审阅的工作台闭环”。

## 新增

- 新增 `src/config/workbench.ts`：统一定义工作区区域、研究流步骤和产品优先级。
- 新增 `ResearchFlowPanel.vue`：编辑区左侧新增“研究流”入口。
- 文档区新增研究记录快捷入口：今日笔记、周报、证据索引、论文大纲。
- Store 新增：
  - `createWeeklyReport()`
  - `createEvidenceIndex()`
  - `createPaperOutline()`
  - `openReviewSummary()`
- 每日笔记模板升级为结构化研究记录。
- 新增架构文档 `docs/ARCHITECTURE_RESEARCH_WORKBENCH.md`。

## 调整

- TODO 按 P0/P1/P2/P3 重新整理。
- 明确交互放置规则：
  - 文档区：材料入口和研究记录快捷入口。
  - 编辑区左侧：研究流、大纲、文献、片段。
  - 预览区：导出、PDF/Markdown 预览、批注审阅。
  - 设置区：环境、构建、Git 和 PDF 质量。

## 后续

- 拆分 `appStore.ts`。
- 增加依赖检测面板。
- 自动聚合每日笔记生成周报和证据索引。
- 做本地索引和证据驱动 AI 写作。
