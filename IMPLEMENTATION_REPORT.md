# Scholia Studio v0.10.6 P0/P1 实现报告

本次在 v0.10.5 基础上继续实现 TODO 中 P0/P1 主线，重点按“低风险稳定性 → 工作流 → 批注/论文工程 → 设置与模板可信度”的顺序推进。

## 已实现

### P0 数据安全与稳定性

- appState 大文件保护：仅持久化轻量 scratch 文档；工作区文件、PDF、图片不会写入状态文件。
- 超大草稿保护：超过阈值时保存保护性占位内容，避免状态文件拖慢启动。
- Tauri 后端二次保护：`save_app_state` 阻止超过 5MB 的异常状态写入。
- 批注锚点迁移：保存 Markdown/TeX 时检查原始 sourceText；能匹配则迁移行号，不能匹配则标记 unstable/needsReview。

### P0 首次启动与核心工作流

- 欢迎页改为真实产品引导，不再是旧的简单 “开始工作”。
- 支持“写论文 / 做研究记录 / 审阅 PDF / 写周报”四类快速入口。
- 新增示例工作区创建命令：包含 Markdown 论文、LaTeX 论文、refs.bib、示例 PDF、每日记录、周报、证据索引、论文大纲和示例批注。
- 打开文件夹后自动推断项目类型、主 TeX、主 Markdown，并写入 `.paper-notes/project.json`。
- 研究流面板显示每一步状态、最近文件、缺失项，并支持打开最近条目。

### P0/P1 批注审阅流

- 批注侧栏支持状态、时间、类型、锚点稳定性、文件/章节和全文搜索筛选。
- 批注支持 Markdown、JSONL、CSV、LaTeX todonotes 导出。
- 批注可转为源码 TODO 任务，自动写入对应 `.tex` / `.md` 文件行附近。
- 批注解决后记录解决说明、处理者、解决时间和当前 Git 工作区状态。
- PDF/Markdown/源码批注继续统一写入 `.paper-notes/annotations.jsonl` 和 `.paper-notes/review-items.jsonl`。

### P1 论文工程体验

- 大纲面板支持搜索、层级过滤、展开/折叠持久化。
- 当前章节随光标自动滚动居中。
- includegraphics hover 支持 PDF data URL 预览框架。
- BibTeX 面板新增卡片/表格视图，支持新增、编辑原始 BibTeX、删除条目。

### P1 设置与模板可信度

- 设置页拆分为：环境、Git、作者、PDF、导出、隐私。
- 项目设置支持主 TeX、主 Markdown、构建命令、Pandoc profile。
- 模板增加 `official/version/upstreamUrl/lastCheckedAt/smokeTest` 元数据。
- 新增模板目录 smoke test，校验主文件、必要文件、ISPRS vendor 文件存在。

## 测试结果

- `npm ci`：通过。
- `npx vue-tsc --noEmit`：通过。
- `npm run test`：通过，2 个测试文件 / 2 个测试用例通过。
- `npm run build`：TypeScript 阶段通过，Vite 在 `transforming...` 阶段超过 300 秒超时，未生成最终 dist。该问题在 v0.10.5 环境中也出现过。
- `cargo check` / `npm run tauri:build`：当前容器没有安装 Rust/Cargo，无法执行。

## 仍需真实桌面环境复核

- 示例工作区 PDF 在不同系统 WebView 中的 embed 首页缩略显示。
- Tauri 示例工作区创建命令在 Windows/macOS/Linux 的实际文件权限。
- LaTeX/Pandoc 构建命令在已安装 TeX Live/MiKTeX/Pandoc 的真实机器上端到端验证。


---

# Scholia Studio v0.10.8 修正报告

## 本次目标

根据反馈移除 v0.10.7 中效果不稳定的编辑器上下分栏/拖拽分栏功能，保留顶部文件 Tab，并调整 Markdown/LaTeX 的预览保持逻辑。

## 已完成

1. 移除顶部 Tab 的“⇣ 向下分栏”按钮。
2. 移除“拖动标签到编辑区底部，或点 ⇣ 上下分栏”的提示文字。
3. 移除 Tab 拖拽到编辑区底部创建上下分栏的交互。
4. 移除下方编辑组、上下分栏高度拖动、分栏关闭按钮等相关模板逻辑。
5. 保留顶部 Tab 的打开、切换、关闭和未保存状态显示。
6. 调整 md/tex 打开策略：
   - 第一次打开 Markdown/LaTeX/普通文本/BibTeX 时默认编辑优先，不自动打开预览；
   - 如果当前工作区内已经打开了预览栏，再打开新的 Markdown/LaTeX 文件时保持预览栏，不再强制关闭；
   - PDF/图片仍保持预览优先。
7. 清理与已移除分栏功能相关的样式和提示。

## 验证

- `npx vue-tsc --noEmit`：通过。
- `npm run test`：通过，2 个测试文件 / 2 个测试用例通过。
- `npm run build`：`vue-tsc` 阶段通过，Vite 在 `transforming...` 阶段 600 秒超时，未生成最终 dist；本次改动未触及构建配置。

- `cargo check`：当前容器未安装 Cargo，无法执行 Tauri Rust 编译检查。
