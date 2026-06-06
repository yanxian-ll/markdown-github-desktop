# 项目 TODO

> 维护约定：每次发布代码更新时必须同步更新本文件。最后更新：v0.9.2-brand-ui-polish.


## v0.9.2 本次完成：命名和文档区打开按钮视觉统一

- [x] 软件名称从描述型 `Markdown / LaTeX 批注写作` 调整为 `Scholia Studio`。
- [x] Tauri `productName`、窗口标题、`package.json`、README、测试文档同步更新为 `Scholia Studio`。
- [x] 左侧“文档”区域的打开按钮从 emoji 文件夹改为与现有圆形按钮一致的线性 SVG 图标。
- [x] 顶部品牌 logo 从装饰符号改为 `S` 字母标识，便于后续品牌化。
- [ ] 后续可继续设计正式应用图标、启动页和品牌配色。
- [ ] 后续可支持用户在设置中切换显示名称/工作区标题格式。

## v0.9.0 本次完成：后续功能框架与 v0.9 模板系统基础

### A. 项目工具统一入口

- [x] 编辑区 topbar 新增“项目工具”入口。
- [x] 新增 `ProjectToolsPanel.vue`，把模板、导出配置、文献集成、写作工具、发布框架和长期路线集中到一个可扩展面板。
- [x] 新增 `src/services/templates.ts`，统一维护内置模板、导出 profile 和未来功能框架定义。
- [x] 保持现有补全、批注、预览、构建、导出功能兼容。

### B. 模板系统基础

- [x] 内置 `LaTeX 基础论文` 模板：`main.tex`、`chapters/`、`refs.bib`、`figures/`。
- [x] 内置 `Markdown + Pandoc 论文` 模板：`paper.md`、`refs.bib`、`figures/`。
- [x] 内置 `Beamer 演示文稿` 模板：`slides.md`。
- [x] 模板可以写入当前工作区的子目录，并自动打开主文件。
- [ ] 用户模板目录：从本地文件夹读取 `template.json`。
- [ ] 模板市场/模板管理器：导入、删除、更新用户模板。
- [ ] 内置 ACM、IEEE、Springer、中文学位论文等真实模板包。

### C. 导出配置 Profile 框架

- [x] 新增默认导出 profile 列表：PDF、DOCX、HTML、Beamer。
- [x] 当前可从项目工具面板触发 Pandoc 导出。
- [ ] 将 profile 保存到 `.paper-notes/export-profiles.json`。
- [ ] 每个 profile 支持模板、CSL、bibliography、pdf-engine、自定义参数。
- [ ] 不同目标记住上次导出路径。

### D. 写作工具框架

- [x] 项目工具中显示当前文件字数/行数统计。
- [x] 一键创建/打开每日笔记：`notes/daily/YYYY-MM-DD.md`。
- [x] 一键创建轻量快照 manifest：`.paper-notes/snapshots/<time>/manifest.md`。
- [ ] 每日写作目标：`.paper-notes/writing-stats.jsonl`。
- [ ] 日历热力图。
- [ ] 保存时自动快照，快照包含文件内容并支持恢复。

### E. 文献管理和外部生态框架

- [x] 在项目工具中新增 Zotero / Better BibTeX 框架说明入口。
- [x] 在项目工具中新增 DOI / ISBN / URL 导入框架说明入口。
- [ ] 设置 Better BibTeX 自动导出的 `.bib` 路径。
- [ ] 监听外部 `.bib` 变化并刷新索引。
- [ ] `Ctrl/Cmd+Shift+R` 引用搜索弹窗。
- [ ] CrossRef DOI 查询、ISBN 查询、URL 元数据抓取。
- [ ] 自动写入 `refs.bib` 并生成 citation key。

### F. 发布、图表和 PDF 笔记框架

- [x] 项目工具中新增 Hugo/Jekyll 发布框架说明入口。
- [x] 项目工具中新增 Beamer 导出入口。
- [x] 项目工具中新增 Mermaid/Plotly/TikZ 可视化预览框架说明入口。
- [x] 项目工具中新增 PDF 批注数据库/笔记互联框架说明入口。
- [ ] Hugo/Jekyll 发布 profile、资源复制、frontmatter 转换。
- [ ] Mermaid/Plotly 稳定渲染和 TikZ 外部编译缓存。
- [ ] PDF 批注转 Markdown 引用块。
- [ ] 批注导出 todonotes / CSV / 按章节整理笔记。

## v0.8.0 已完成：剩余功能分批集成与框架落地

### A. 编辑与 LaTeX 智能

- [x] 保留 `Ctrl/Cmd+C` 选区复制；仅在没有选区时复制当前整行，保持 VS Code 复制逻辑。
- [x] 继续保留 `\cite{}`、`\ref{}`、`\input{}`、`\includegraphics{}` 补全和跳转。
- [x] 新增 Snippet 补全源：LaTeX `fig/table/eq/align/algo/theorem`，Markdown `/figure`、`/table`、`/todo`、`/note`。
- [x] 编辑区新增“片段”面板，可查看内置片段内容和触发词。
- [x] LaTeX / Markdown 公式 hover 预览框架：悬停 `$...$`、`$$...$$`、`equation/align` 环境时用 KaTeX 渲染。
- [x] 当前文件字数/行数统计显示在编辑区 topbar。

### B. 编译错误与问题面板

- [x] 新增底部“问题 / 输出 / 日志”面板。
- [x] 问题面板合并静态索引 diagnostics 与构建日志 diagnostics。
- [x] 点击问题项尝试跳转到对应文件和行。
- [x] 输出页显示当前构建命令；日志页显示完整构建日志。
- [ ] LaTeX 日志解析仍为基础能力；后续继续细化 overfull hbox、undefined reference/citation、多文件 include 路径栈。

### C. BibTeX 管理

- [x] 新增“参考文献”侧栏面板。
- [x] 支持搜索 BibTeX key、作者、标题、年份、来源。
- [x] 点击条目跳转到 `.bib` 对应行。
- [x] 保留 cite key hover 和右下角 BibTeX 预览。
- [ ] BibTeX 卡片编辑、字段表格编辑、删除/新增条目尚为后续细化。

### D. Pandoc 多格式导出

- [x] 新增 Markdown 多格式导出面板。
- [x] Rust 后端新增 `export_markdown_pandoc` 命令。
- [x] 支持通过系统保存文件框导出：PDF、DOCX、HTML、EPUB、LaTeX、Beamer PDF。
- [x] 导出继续复用 Markdown fenced block 到 LaTeX 的预处理链路。
- [ ] DOCX 模板、CSL、bibliography 参数组合后续通过 export profile 实现。

## v0.7.0 已完成：Markdown + LaTeX 混合写作

- [x] Markdown `$...$` / `$$...$$` KaTeX 实时渲染。
- [x] Markdown fenced block 支持 `figure/table/algorithm/theorem`。
- [x] Markdown → LaTeX → PDF Pandoc 编译链路。
- [x] Pandoc 错误基础定位到 Markdown 源码行。

## v0.6.x 已完成：LaTeX 智能写作

- [x] 项目索引器、大纲、依赖图基础。
- [x] 当前文件大纲面板。
- [x] `\cite{}` / `\ref{}` / `\input{}` / `\includegraphics{}` 补全。
- [x] 断链检测：不存在的 label、citation、input、graphics。
- [x] 重复 label / BibTeX key 检测。
- [x] hover 显示 label / cite / 图片预览。
- [x] 图片路径相对于当前 `.tex` 文件目录、figure/figures 目录解析。

## 后续高优先级 TODO

### P0：稳定性和产品化

- [ ] 把 `appStore.ts` 拆成 `workspaceStore/editorStore/previewStore/annotationStore/buildStore/settingsStore`。
- [ ] 把 `PdfPreview.vue` 拆成 `PdfToolbar/PdfPage/PdfTextSelection/PdfAnnotationOverlay/PdfSyncController`。
- [ ] 给 Pandoc 路径增加设置项，支持手动选择 `pandoc.exe`，避免依赖 PATH。
- [ ] 为 Windows/macOS/Linux 增加外部依赖检查面板：Pandoc、XeLaTeX、latexmk、synctex、Git。
- [ ] 增加自动化测试项目样例：单文件 tex、多文件 tex、Markdown + Pandoc、PDF 批注、Markdown 批注。

### P1：写作增强

- [ ] 大纲搜索与过滤。
- [ ] 当前章节随光标滚动自动居中。
- [ ] 大纲拖拽调整章节结构。
- [ ] 大纲折叠状态按文件持久化。
- [ ] `\label{}` 跳转到引用列表。
- [ ] includegraphics hover 支持 PDF 首页缩略图。
- [ ] BibTeX 卡片/表格视图的增删改。
- [ ] 自定义 snippets 和 Tab 占位符跳转。

### P2：论文工程能力

- [ ] 底部问题面板增强 LaTeX 日志解析。
- [ ] Git 历史面板：log、diff、tag、恢复文件。
- [ ] 本地自动快照：保存时写入完整 `.paper-notes/snapshots/`。
- [ ] 批注导出 todonotes / JSONL / CSV。
- [ ] 批注转 Markdown 引用块。

### P3：外部生态

- [ ] Zotero / Better BibTeX 连接。
- [ ] DOI / ISBN / URL 导入 BibTeX。
- [ ] 导出 profile：PDF / DOCX / HTML / EPUB / Beamer。
- [ ] Hugo / Jekyll 博客发布。
- [ ] Mermaid / Plotly / TikZ 实时预览。
- [ ] 字数目标、每日笔记、日历热力图。

## v0.9.1 完成：编辑侧栏统一和可调整宽度

- [x] 将大纲、参考文献、片段、导出、项目工具入口统一移动到编辑区左侧按钮组。
- [x] 所有编辑相关侧栏统一显示在编辑区左侧，与大纲同一位置。
- [x] 新增编辑侧栏拖拽条，可通过鼠标调整侧栏宽度。
- [x] 保留右侧预览栏和批注栏原有交互，不再让编辑工具按钮分散在编辑区右侧。

后续待优化：

- [ ] 将编辑侧栏宽度持久化到本地设置。
- [ ] 为不同侧栏记忆独立宽度，例如大纲 260px、项目工具 380px。
- [ ] 支持侧栏最小化为仅图标竖条。

## v0.9.3 完成：模板注册表与 CSUthesis 内置骨架

- [x] 将模板从单个 `services/templates.ts` 拆到 `src/templates/`，形成类型、注册表、模板工厂三层结构。
- [x] 新增 CSUthesis 中南大学研究生学位论文模板入口，内置主文件、content 分章、README、latexmkrc、Makefile、BibTeX 示例和轻量兼容 `CSUthesis.cls`。
- [x] LaTeX 构建支持识别 `% !TEX program = xelatex`，并在 fallback 时使用相同引擎。
- [x] 模板 UI 显示 provider 和 tags，便于后续模板库扩展。
- [ ] 后续接入完整上游 vendor 包，并保留上游 LICENSE/NOTICE。
- [ ] 增加模板变量创建向导与模板校验单元测试。
