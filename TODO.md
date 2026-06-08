# Scholia Studio TODO

> 维护约定：每次发布代码更新必须同步更新本文件。  
> 当前版本：v0.10.6-p0-p1-implementation  
> 产品主线：不要做“凭空写论文”的 AI 编辑器，而是做“记录 → 证据 → 论文 → 审阅”的本地优先科研写作工作台。

## 优先级定义

| 优先级 | 含义 | 上线标准 |
| --- | --- | --- |
| P0 | 上线前必须完成 | 不完成会影响数据安全、核心体验、首次使用或基本可信度。 |
| P1 | 内测增长关键 | 直接强化差异化闭环，决定用户是否持续使用。 |
| P2 | 差异化增强 | 建立“证据驱动 AI 写作”和论文工程能力。 |
| P3 | 生态扩展 | 协作、发布、模板市场、插件和外部服务。 |

## v0.10.0 本次完成：研究工作台底层框架和交互重排

- [x] 新增 `src/config/workbench.ts`，统一定义软件底层工作区：文档树、模板库、研究流、源码编辑、预览审阅、设置构建、状态栏。
- [x] 新增 `ResearchFlowPanel.vue`，把“今日笔记 / 周报 / 证据索引 / 论文大纲 / 审阅清单”作为编辑区左侧第一入口。
- [x] 文档区顶部新增研究记录快捷入口：日、周、证、纲，保持每日笔记在文档区域，而不是散落到写作工具页。
- [x] Store 新增结构化研究文件生成能力：`createWeeklyReport`、`createEvidenceIndex`、`createPaperOutline`、`openReviewSummary`。
- [x] 每日笔记模板升级为结构化研究记录，包含 YAML metadata、实验/图表、文献、论文结论、证据、风险和明日计划。
- [x] 周报、证据索引、论文大纲默认生成到稳定路径，便于后续 AI 索引和检索。
- [x] 交互层重新明确：文档区负责材料入口，编辑区左侧负责研究/大纲/文献/片段，右侧预览区负责导出和审阅，最右设置区负责环境和构建。
- [x] 新增架构文档 `docs/ARCHITECTURE_RESEARCH_WORKBENCH.md`，记录后续拆分方向和交互放置规则。


## v0.10.16 本次完成：P3 生态扩展基础版

- [x] 新增 Hugo / Jekyll 发布 profile：支持 frontmatter 转换、本地图片资源复制和发布 manifest。
- [x] Pandoc export profile 增强：DOCX reference-doc、CSL、bibliography、resource-path、citeproc 等参数可配置。
- [x] 新增投稿包导出：复制源码、图片、BibTeX、cls/sty/bst、PDF 和 README/manifest。
- [x] Markdown → Beamer 导出走独立 Pandoc profile，并补充 Beamer 参数。
- [x] Markdown 预览增强：Mermaid 稳定渲染，Plotly JSON 简易 SVG 预览，TikZ 使用后端外部编译缓存。
- [x] Snippets 支持自定义片段保存到 `.paper-notes/snippets.json`，并支持 CodeMirror Tab 占位符跳转。
- [x] 新增 `docs/PLUGIN_API_DRAFT.md` 和 `src/services/pluginApi.ts`，固定插件 API 草案边界。
- [x] Git Pull / Push 独立操作并显示冲突文件；共享审阅包可导出 PDF、review-items、批注和源码上下文。

---

## v0.10.5 本次完成：TODO P0/P1 低风险补齐

- [x] 草稿自动保存、异常关闭检测、本地恢复提示和草稿索引。
- [x] 本地快照升级：复制文本源文件、批注、refs.bib、项目设置和导出配置。
- [x] 删除进入 `.paper-notes/trash/`，模板覆盖前自动备份到 `.paper-notes/backups/`。
- [x] 环境检查面板：Pandoc、XeLaTeX、latexmk、SyncTeX、Git，支持手动路径与安装提示。
- [x] LaTeX/Pandoc/SyncTeX 使用手动工具路径，构建失败给出更可操作的诊断。
- [x] 文档树、模板栏、设置栏、预览栏、批注栏和编辑侧栏宽度持久化。
- [x] 每日笔记、周报、证据索引、论文大纲从当前材料/批注/引用/图片生成初始内容。
- [x] 项目设置和导出 profile 保存到 `.paper-notes/project.json`、`.paper-notes/export-profiles.json`。
- [x] 一键导出诊断包：app state、构建日志、环境检查、系统信息。

---

## v0.10.6 本次完成：P0/P1 主线实现

- [x] 启动欢迎页改为产品真实介绍，支持“写论文 / 做研究记录 / 审阅 PDF / 写周报”四类引导。
- [x] 新增示例工作区生成命令，内置 Markdown、LaTeX、refs.bib、PDF、每日记录、周报、证据索引和示例批注。
- [x] 打开文件夹后自动推断项目类型、主 TeX、主 Markdown，并持久保存到 `.paper-notes/project.json`。
- [x] 大文件保护：工作区文件、PDF、图片、超大草稿不会写入 appState，后端也阻止超过 5MB 的状态文件。
- [x] 批注锚点迁移：保存源码时自动检查/迁移行号，无法匹配时标记为不稳定并在批注侧栏提示复核。
- [x] 研究流显示每一步完成状态、最近文件、缺失项，并支持一键打开最近条目。
- [x] 批注列表支持状态、时间、类型、锚点稳定性、文件/章节筛选。
- [x] 批注支持转源码 TODO 任务，写入对应 `.tex` / `.md` 行附近。
- [x] 批注导出支持 Markdown、JSONL、CSV、LaTeX todonotes；解决批注记录解决说明、处理者和版本状态。
- [x] 大纲支持搜索、层级过滤、展开/折叠状态持久化，并随光标自动居中当前章节。
- [x] `includegraphics` hover 支持 PDF data URL 嵌入式首页预览框架。
- [x] BibTeX 面板新增卡片/表格视图，支持新增、编辑原文、删除条目。
- [x] 设置页拆分为环境、Git、作者、PDF、导出、隐私，并支持设置主 TeX / 主 Markdown、构建命令、Pandoc profile。
- [x] 模板增加来源/版本/许可证/最后核对日期/smoke test 元数据；新增模板目录 smoke test。

---

# P0：上线前必须完成

## P0.1 数据安全与稳定性

- [x] 自动保存策略：编辑文本按文件节流保存草稿，崩溃后可恢复。
- [x] 快照升级：`.paper-notes/snapshots/` 不只写 manifest，还要复制文本文件、批注、refs.bib 和关键配置。
- [x] 启动恢复：检测上次未正常关闭时，提示恢复未保存文档。
- [x] 删除/覆盖保护：模板写入、文件删除、重命名、移动必须有冲突检测和撤销/备份方案。
- [x] 大文件保护：超过阈值的 PDF、图片、日志不得写入持久化 appState。
- [x] 批注锚点迁移：源码变动后标记不稳定锚点，并在批注侧栏提示需要人工校准。

## P0.2 外部依赖检测与配置

- [x] 新增“环境检查”面板：Pandoc、XeLaTeX、latexmk、synctex、Git。
- [x] 支持手动选择 `pandoc.exe` / `xelatex.exe` / `latexmk.exe` 路径，避免依赖 PATH。
- [x] 构建失败时给出可操作诊断：缺依赖、路径错误、模板缺文件、BibTeX 错误、字体缺失。
- [x] Windows/macOS/Linux 分别给出安装提示和检测命令。
- [x] 将 PDF 渲染分辨率、构建命令、Pandoc profile 持久化到本地设置。

## P0.3 首次启动与核心工作流

- [x] 首次启动引导：选择“写论文 / 做研究记录 / 审阅 PDF / 写周报”。
- [x] 示例工作区：内置一个可编译的 Markdown + LaTeX + PDF 批注示例项目。
- [x] 打开文件夹后自动识别项目类型：论文项目、笔记项目、普通文件夹、单文件。
- [x] 文档区快捷入口在无工作区时给出引导，而不是报错。
- [x] “研究流”面板支持一键打开最近的每日笔记、最近周报和证据索引。

## P0.4 交互设计打磨

- [x] 文档树、模板栏、编辑侧栏、预览栏、批注栏宽度持久化。
- [x] 编辑侧栏为不同面板记忆宽度：研究流 340px、大纲 280px、文献 360px、片段 320px。
- [x] 支持侧栏最小化为仅图标竖条。
- [x] 打开文件、跳转大纲、SyncTeX 反向定位后，左侧文档树必须展开并选中对应文件。
- [x] 顶部工具栏只保留全局动作：文档树、模板、提交、预览、设置；日常写作动作放到文档区和编辑侧栏。
- [x] 预览顶部集中放置导出、查看 PDF、批注开关；不要再出现分散的构建 PDF 控件。

## P0.5 模板正确性

- [x] 每个内置模板只能对应一个明确的官方期刊/会议/学校模板。
- [x] 模板必须标记来源、版本、许可证、上游链接和最后核对日期。
- [x] 找不到公开可复用官方模板的，不加入内置模板。
- [x] ISPRS 模板保留官方 `isprs.cls`、`isprs.bst` vendor 文件，不进行不必要改写。
- [x] 每个模板增加 smoke test：创建项目、编译 PDF、引用 refs.bib、插图路径检查。

## P0.6 测试与发布前质量门槛

- [x] 自动化测试项目：单文件 TeX、多文件 TeX、Markdown + Pandoc、PDF 批注、Markdown 批注、图片预览、BibTeX 跳转。
- [x] E2E 测试：打开文件夹、创建每日笔记、生成周报、生成证据索引、导出 PDF。
- [ ] 构建测试：`npm run test` 与 `vue-tsc` 已通过；`npm run build` 在当前容器 Vite transforming 阶段超时，`npm run tauri:build` 因无 Cargo/Rust 未执行。
- [x] 错误日志导出：用户可一键导出 app state、构建日志、依赖检测结果和系统信息。

---

# P1：内测增长关键

## P1.1 研究记录闭环

- [x] 每日笔记支持自动插入当前文件、当前批注、最近图表、最近 BibTeX 条目。
- [x] 周报生成时自动扫描 `notes/daily/*.md`，汇总本周完成、证据、风险、下周计划。
- [x] 证据索引自动从每日笔记、周报、批注、BibTeX、图片路径中提取候选条目。
- [x] 论文大纲从证据索引生成章节草稿，并列出每节缺失证据。
- [x] 研究流面板显示每一步是否已完成、最近更新时间和缺失项。

## P1.2 批注审阅流

- [x] 批注列表支持按状态、章节、类型、锚点稳定性筛选。
- [x] 批注可转为修改任务，并在源码对应行显示任务标记。
- [x] 批注导出支持 Markdown、JSONL、CSV、LaTeX todonotes。
- [x] 批注解决后记录修改版本和解决说明。
- [x] PDF 文本选中、区域批注、源码批注统一进入 `.paper-notes/review-items.jsonl`。

## P1.3 论文工程体验

- [x] LaTeX 日志解析增强：undefined reference/citation、overfull hbox、缺包、字体、路径栈。
- [x] 大纲搜索、过滤、折叠状态持久化。
- [x] 当前章节随光标滚动自动居中。
- [x] `\label{}` 跳转到引用列表。
- [x] includegraphics hover 支持 PDF 首页缩略图。
- [x] BibTeX 卡片/表格视图支持新增、编辑、删除字段。

## P1.4 本地设置和项目设置

- [x] `.paper-notes/project.json` 保存项目类型、主文件、导出 profile、依赖路径和研究流文件路径。
- [x] `.paper-notes/export-profiles.json` 保存 PDF / DOCX / HTML / EPUB / Beamer 参数。
- [x] 设置页拆分为：环境、Git、作者、PDF、导出、隐私。
- [x] 支持从项目设置中指定主 TeX 文件和主 Markdown 文件。

---

# P2：差异化增强

## P2.1 证据驱动 AI 写作

- [ ] 本地索引 Markdown、TeX、BibTeX、PDF 批注、review-items、evidence-index。
- [ ] AI 回答必须显示来源文件、行号、批注 ID 或 BibTeX key。
- [ ] 生成论文段落时附“使用证据”和“缺失证据”。
- [ ] AI 修改源码必须先生成 diff，用户确认后应用。
- [ ] 支持“不要凭空写，只使用我的证据库”模式。

## P2.2 论文素材池

- [ ] 建立统一素材视图：结论、图表、表格、公式、文献、批注、实验记录。
- [ ] 图片和表格可标注用途：引言图、方法图、结果图、消融表、补充材料。
- [ ] 素材可拖入 Markdown/LaTeX，并自动生成引用、caption 和路径。
- [ ] 检查论文中未引用图片、未使用 BibTeX、重复 label。

## P2.3 文献生态

- [ ] Zotero / Better BibTeX 自动导出的 `.bib` 路径配置。
- [ ] 监听外部 `.bib` 变化并刷新索引。
- [ ] `Ctrl/Cmd+Shift+R` 引用搜索弹窗。
- [ ] CrossRef DOI 查询、ISBN 查询、URL 元数据抓取。
- [ ] 自动写入 `refs.bib` 并生成 citation key。

## P2.4 版本与历史

- [ ] Git 历史面板支持 log、diff、tag、恢复文件。
- [ ] 本地快照支持 diff、恢复、命名和删除。
- [ ] 论文版本快照：草稿版、导师反馈版、投稿版、返修版。

---

# P3：生态扩展

## P3.1 发布与多格式输出

- [x] Hugo / Jekyll 发布 profile、资源复制、frontmatter 转换。
- [x] DOCX 模板、CSL、bibliography、reference-doc 参数配置。
- [x] 投稿包导出：源码、图片、bib、cls/sty/bst、README、编译说明。
- [x] Beamer 演示文稿模板和 Markdown → Beamer 工作流完善。

## P3.2 可视化与插件

- [x] Mermaid 稳定渲染。
- [x] Plotly 图表预览。
- [x] TikZ 外部编译缓存。
- [x] 自定义 snippets 和 Tab 占位符跳转。
- [x] 插件 API 草案：文件索引、编辑器命令、预览扩展、导出 profile。

## P3.3 协作与同步

- [x] GitHub Pull/Push 冲突可视化处理。
- [x] 批注作者和回复流增强。
- [x] 共享审阅包：导出 PDF + review-items + 源码上下文。
- [x] 云同步作为可选能力，不影响本地优先路线。

---

# 已完成历史摘要

## v0.9.9

- [x] 导出入口移动到预览顶部。
- [x] 打开文件后文档树对应展开和选中。
- [x] 模板栏移动到文档树旁边。
- [x] 内置 ISPRS `cls` / `bst` vendor 文件。

## v0.9.3 - v0.9.8

- [x] 模板注册表拆分到 `src/templates/`。
- [x] CSUthesis、ISPRS 等模板入口和 vendor 框架。
- [x] 编辑侧栏统一移动到大纲旁边，并支持拖拽宽度。
- [x] PDF 预览与导出入口初步整理。

## v0.8.0

- [x] 片段、问题面板、BibTeX 管理、Pandoc 多格式导出框架。

## v0.7.0

- [x] Markdown + LaTeX 混合写作、KaTeX、Pandoc 编译链路。

## v0.6.x

- [x] LaTeX 项目索引、大纲、依赖图、补全、跳转和基础诊断。
