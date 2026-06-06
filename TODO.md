# 项目 TODO

> 维护约定：每次发布代码更新时必须同步更新本文件。最后更新：v0.8.0-integrated-framework。

## v0.8.0 本次完成：剩余功能分批集成与框架落地

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
- [ ] 导出 profile（不同目标保存不同参数组合）已预留到后续版本。
- [ ] DOCX 模板、CSL、bibliography 参数组合后续通过 export profile 实现。

### E. 历史、快照与修订追踪框架

- [x] 新增“历史”侧栏框架，当前展示 Git 工作区变更列表。
- [x] 本地项目显示自动快照/历史框架提示。
- [ ] Git commit 时间线、文件 diff、恢复文件版本、自动快照清理尚未完整实现。
- [ ] 修订追踪、接受/拒绝修改尚未完整实现。

### F. 模板、Zotero、文献导入框架

- [x] 通过 TODO 和面板结构保留模板、文献管理、导出、历史等后续入口。
- [ ] ACM / IEEE / Springer / 中文论文模板市场和用户模板目录尚未完整实现。
- [ ] Zotero / Better BibTeX 集成、DOI/ISBN/URL 自动导入需要外部 API 或本地 Zotero 数据库授权，本版先保留规划。

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
- [ ] 本地自动快照：保存时写入 `.paper-notes/snapshots/`。
- [ ] 批注导出 todonotes / JSONL / CSV。
- [ ] 批注转 Markdown 引用块。

### P3：外部生态

- [ ] Zotero / Better BibTeX 连接。
- [ ] DOI / ISBN / URL 导入 BibTeX。
- [ ] 导出 profile：PDF / DOCX / HTML / EPUB / Beamer。
- [ ] Hugo / Jekyll 博客发布。
- [ ] Mermaid / Plotly / TikZ 实时预览。
- [ ] 字数目标、每日笔记、日历热力图。
