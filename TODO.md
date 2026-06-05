# 项目 TODO

> 维护约定：每次发布代码更新时必须同步更新本文件，记录已完成、进行中和下一步任务。最后更新：v0.7.0。


## v0.7.0 本次完成

- [x] Markdown 预览确认支持 `$...$` 与 `$$...$$` KaTeX 实时渲染。
- [x] Markdown fenced block 新增 `figure` / `table` / `algorithm` / `theorem` 预览样式。
- [x] 新增 Pandoc 构建链路：Markdown → 预处理 LaTeX 扩展块 → PDF。
- [x] Markdown 预览栏新增 Pandoc PDF 构建入口；`Ctrl/Cmd+B` 在 Markdown 文件中构建 PDF。
- [x] Pandoc 构建结果可在内置 PDF 预览中查看，并可切回 Markdown 预览。
- [x] Pandoc stderr 基础解析为当前 Markdown 文件 diagnostics，能显示在编辑器问题计数和行标记中。
- [x] 修复 `Ctrl/Cmd+C`：有选区时保持普通复制；无选区时才复制当前整行。
- [x] `TODO.md` 已按本次版本更新同步维护。

## v0.6.5 本次完成

- [x] 将编辑区“大纲”开关移动到编辑标题栏左侧，更接近结构导航入口。
- [x] 大纲树默认折叠，只显示顶层章节；需要查看 subsection 时手动展开。
- [x] 增强 `\includegraphics{}` 路径解析：支持相对于当前 `.tex` 文件目录、同级 `figure/`、同级 `figures/`、项目根 `figure/`、项目根 `figures/`。
- [x] LaTeX 编辑器 hover 支持 `\ref{}` / `\cite{}` / `\includegraphics{}` 预览。
- [x] hover label 显示目标类型、文件、行号和上下文。
- [x] hover cite 显示 BibTeX 作者、年份、标题和来源。
- [x] hover image 对 png/jpg/gif/webp/svg/bmp 显示缩略图；pdf/eps 等格式提示 Ctrl/Cmd 点击打开预览。
- [x] 实现 VS Code 风格空选区 `Ctrl/Cmd+C`：未选中文本时直接复制当前整行。
- [x] `TODO.md` 已按本次版本更新同步维护。

## v0.6.4 本次完成

- [x] 将大纲面板从编辑器右侧移动到编辑器左侧，更接近文档结构导航的阅读习惯。
- [x] 大纲面板默认不打开；批注面板默认不打开，避免首次打开文件时挤占编辑/预览空间。
- [x] 保留编辑区 topbar 的大纲入口，后续编辑相关功能继续在这里扩展。
- [x] 为 LaTeX 索引新增 diagnostics：缺失 `\ref{}`、缺失 `\cite{}`、缺失 `\input/\include/\subfile`、缺失 `\includegraphics`、重复 label、重复 BibTeX key。
- [x] 当前 `.tex` 文件的问题会在编辑器中以行内红/黄标记显示，并在编辑区 topbar 显示问题数量。
- [x] `Ctrl/Cmd + 点击 \includegraphics{...}` 现在可打开对应图片/PDF 文件预览。
- [x] `TODO.md` 已按本次版本更新同步维护。

## v0.6.3 本次完成

- [x] 将“大纲”从左侧文档文件树中移出，避免文件导航和结构导航混在一起。
- [x] 在编辑区新增顶部工具栏，作为后续编辑相关功能入口。
- [x] 在编辑区顶部工具栏新增“大纲”按钮，可显示/隐藏当前文件大纲侧栏。
- [x] 新增 `src/components/EditorOutlinePanel.vue`，大纲面板采用类似批注栏的右侧结构。
- [x] 大纲只显示当前打开文件，不再显示整个项目所有 `.tex` / `.md` 的结构。
- [x] 大纲仅在 `.tex` 和 `.md` 文档中显示；图片、PDF、普通文本不显示大纲入口。
- [x] 大纲视觉改为接近文件树：层级缩进、展开/折叠箭头、当前章节高亮、行号提示。
- [x] 默认展开当前文件的章节树，确保 `subsection` / `subsubsection` 可见。
- [x] 点击大纲项跳转到对应源码行；LaTeX 文档继续尝试同步 PDF。

## v0.6.2 已完成

- [x] 重构 LaTeX 智能索引相关代码，新增 `src/services/latex/` 子模块：
  - [x] `path.ts`：路径归一化、扩展名、相对路径处理。
  - [x] `outline.ts`：LaTeX / Markdown 大纲扫描。
  - [x] `dependencyGraph.ts`：`\input` / `\include` / `\subfile` 依赖边生成和文件排序。
- [x] 大纲不再依赖固定 `sections/` 目录。
- [x] 支持单文件 `.tex`、多文件 `.tex`、`% !TEX root`、`\input` / `\include` 项目。
- [x] 支持 Markdown 标题大纲。
- [x] 新增依赖列表，显示 `\input` / `\include` 依赖和缺失文件。
- [x] 单文件打开时也参与索引，保证大纲、补全、引用预览可用。

## v0.6.x 待办：LaTeX 智能写作

- [ ] 大纲搜索与过滤。
- [ ] 当前章节随光标滚动自动居中显示。
- [ ] 大纲拖拽调整章节结构。
- [ ] 大纲折叠状态持久化。当前默认折叠，后续再持久化每个文件的折叠状态。
- [ ] 依赖图从大纲面板中独立为“项目结构/依赖”面板。
- [x] 断链检测：不存在的 `\ref{}` / `\cite{}` / `\input{}` / `\includegraphics{}`。
- [x] 重复 label / BibTeX key 检测。
- [x] 行内问题标记。
- [x] hover 显示 label / cite / 图片预览。
- [ ] `\label{}` 跳转到引用列表。
- [x] 图片路径 hover 缩略图。当前已支持 Ctrl/Cmd + 点击图片路径打开预览。
- [ ] BibTeX 卡片/表格视图。

## v0.7.x 待办：Markdown + LaTeX 混合写作

- [x] Markdown `$...$` / `$$...$$` 数学实时渲染。
- [x] Markdown fenced block 支持 figure/table/algorithm/theorem。
- [x] Markdown → LaTeX → PDF Pandoc 编译链路。
- [x] Pandoc 错误定位到 Markdown 源码行。当前为基础 stderr 行号解析，复杂 Pandoc 中间 TeX source map 后续增强。

## v0.8.x 待办：编译错误面板

- [ ] 底部“问题 / 输出 / 日志”面板。
- [ ] LaTeX error/warning/overfull/undefined citation/reference 日志解析。
- [ ] 点击错误跳源码行。
- [ ] 编辑器 gutter 红点/黄点。

## v0.9.x 待办：模板与 Snippet

- [ ] 内置 ACM / IEEE / Springer / 中文论文模板。
- [ ] 用户自定义模板目录。
- [ ] LaTeX snippets：fig/table/eq/align/algo/theorem。
- [ ] Markdown snippets：/table、/figure、/todo、/note。

## v1.x 长期待办

- [ ] Zotero / Better BibTeX 集成。
- [ ] DOI / ISBN / URL 导入 BibTeX。
- [ ] 批注导出 todonotes / 阅读笔记 / JSONL / CSV。
- [ ] Git 历史面板和自动快照。
- [ ] 修订追踪、接受/拒绝修改。
- [ ] 字数统计、每日目标、日历热力图。
- [ ] Pandoc 多格式导出：PDF / DOCX / HTML / EPUB / Beamer。
