## v0.8.0-integrated-framework

- 集成剩余规划功能的第一批可运行框架：问题/输出/日志底部面板、参考文献管理侧栏、Snippet 面板、Markdown 多格式导出面板、历史框架面板。
- 编辑器新增 LaTeX/Markdown Snippet 补全：`fig/table/eq/align/algo/theorem` 与 `/figure`、`/table`、`/todo`、`/note`。
- 新增公式 hover 预览：悬停 `$...$`、`$$...$$`、`equation/align` 环境时通过 KaTeX 渲染。
- Markdown 多格式导出通过 Pandoc 支持 PDF、DOCX、HTML、EPUB、LaTeX、Beamer PDF，并弹出保存路径。
- 编辑区显示当前文件字数/行数统计；`Ctrl/Cmd+C` 保留选区复制，仅在无选区时复制整行。
- 复杂功能如 Zotero、DOI 导入、Git diff、修订追踪、模板市场、导出 profile 已落到 `TODO.md`，本版先实现 UI/服务框架和可继续迭代的入口。

## v0.5.0

## v0.6.2 更新说明

- 重构 LaTeX 智能索引为 `src/services/latex/` 子模块。
- 文档栏新增“文件 / 大纲”切换。
- 大纲支持单文件、多文件、`% !TEX root`、`\input`、`\include` 和 Markdown 标题。
- 新增 `\input` / `\include` 依赖列表，缺失依赖会被标记。
- 项目根目录新增 `TODO.md`，后续每次更新必须同步维护。


- 批注系统升级为 Overleaf 式评论线程：一条批注可包含首条评论和多条回复。
- 支持回复评论、编辑评论、解决/重新打开、忽略和删除线程。
- 批注栏新增搜索、按文件筛选、按 PDF 页筛选、按时间和状态筛选。
- 支持导出 Markdown：生成 `.paper-notes/annotations-export.md`。
- 兼容旧版 `.paper-notes/annotations.jsonl`：旧单条批注会自动转换为只有一条评论的线程。

## v0.4.11

- 按文件类型自动切换布局：`.tex` / `.md` 默认显示编辑区和预览区；图片/PDF 只显示预览区；`.txt`、`.bib`、`.sty`、`.cls` 等纯文本文件只显示编辑区。
- Markdown 文件支持源码选区批注：在 `.md` 编辑器中选中文本后按 `Ctrl/Cmd + Alt + C` 创建批注，批注会进入右侧批注栏和 `.paper-notes/review-items.jsonl`。
- Markdown 预览区接入批注栏，可隐藏、调整宽度，并与源码 gutter 批注联动。
- 保留 v0.4.10-selection-fix 的 PDF 双栏文字选择修复。

## v0.4.10

- 修复 PDF 批注、文字批注、源码批注之间的双向跳转：点击批注时会同时定位 TeX 行和 PDF 对应位置，不再错误回到第一页。
- 源码选中批注现在会用 SyncTeX 建立 PDF 侧锚点，并在 PDF 中显示一个可点击的源批注标注。
- 批注栏点击同一条批注时，PDF 端优先使用批注自身的 PDF rect 或 SyncTeX 点滚动到中间偏上位置。
- PDF 端对源码批注的标注优先吸附真实 text layer，找不到文字时才使用紧凑的 SyncTeX 点位提示。

## v0.4.8

- 修复 PDF 文字选中后“批注”浮动按钮跑到 PDF 页面外的问题：现在按钮按 PDF 页面内坐标定位，贴近鼠标释放/右键位置。
- TeX 双击正向定位到 PDF 时，目标位置会滚动到预览区中间偏上，便于快速继续阅读。
- TeX → PDF 定位提示从圆圈改为短暂闪动的高亮区域，优先使用 SyncTeX 返回的宽高，缺失时使用合理的行级高亮矩形。

## v0.4.7

- PDF 选中文字后的浮动批注按钮改为贴近鼠标释放/右键位置显示。
- 文字选择浮动菜单只保留“批注”，移除“高亮”“定位源码”和关闭按钮，减少干扰。
- 右键选中文字时同样只显示“批注”。

# Markdown LaTeX Git Desktop

一个基于 Tauri 2 + Vue 3 + Vite 的跨平台 Markdown / LaTeX 桌面编辑器。

这个版本把原来的 GitHub Contents API 同步模型改成了更符合桌面软件的工作流：

1. 连接 GitHub token。
2. 指定本地目录。
3. 点击 `获取/更新`，仓库会同步到本地。
4. 左侧显示本地目录树，支持文件夹、Markdown、LaTeX、BibTeX 文件。
5. `Ctrl/Cmd+S` 只保存到本地文件。
6. 手动点击 `提交并 push` 才会执行 `git add -A`、`git commit`、`git push`。
7. 提交或 push 失败会在状态栏显示错误。

## 技术栈

- Tauri 2
- Vue 3
- Vite
- Pinia
- CodeMirror 6
- markdown-it
- KaTeX
- Mermaid
- Prism
- 本地 JSON 状态存储
- 系统凭据存储：Windows Credential Manager / macOS Keychain / Linux Secret Service
- Git CLI：clone、status、commit、push
- LaTeX CLI：latexmk / pdflatex
- Vitest + Playwright

## 开发运行

```bash
npm install
npm run tauri:dev
```

只看前端：

```bash
npm run dev
```

## Windows 运行前置条件

1. Node.js 20 或 22。
2. Rust + Cargo。
3. Git CLI，并确保 `git --version` 可用。
4. 若要构建 LaTeX PDF，需要 TeX Live 或 MiKTeX，并确保 `latexmk` 或 `pdflatex` 在 PATH 中。

## GitHub 私有仓库配置

Fine-grained PAT 建议权限：

- Repository access：只选你的目标仓库。
- Metadata：Read。
- Contents：Read and write。

Classic PAT 可用 `repo` scope。

## 你的测试仓库填写示例

仓库 URL：

```txt
https://github.com/yanxian-ll/test-markdown-notes
```

填写：

```txt
Owner: yanxian-ll
Repo: test-markdown-notes
Branch: main
本地目录: C:/Users/21078/Documents/test-markdown-notes
子目录: 留空
```

如果 Markdown / LaTeX 文件在仓库子目录，例如 `docs/`，则“子目录”填 `docs`。

## LaTeX 功能范围

参考 LaTeX Workshop 的核心方向实现了桌面版基础功能：

- `.tex` / `.bib` / `.sty` / `.cls` 文件树识别。
- LaTeX 语法高亮。
- 保存 `.tex` 到本地。
- 调用 `latexmk` 或 `pdflatex` 构建 PDF。
- 构建后打开 PDF。
- 解析基础 warning / error 日志。
- 清理常见辅助文件。

注意：LaTeX Workshop 是成熟 VS Code 扩展，包含完整 IntelliSense、SyncTeX、反向搜索、复杂 recipe、lint、hover、引用跳转等大量功能。本项目当前实现的是可运行的核心子集，后续可以继续增量补齐。

## 快捷键

- `Ctrl/Cmd+S`：保存当前文件到本地。
- `Ctrl/Cmd+B`：当前为 `.tex` 文件时构建 PDF。

## 打包

```bash
npm run tauri:build
```

## GitHub token 模式说明

从 0.2.3 起，应用只使用 GitHub Personal Access Token 鉴权，不再提供网页登录入口。填写 token 并点击“保存凭据”后，clone / pull / push 会通过临时 Git HTTP Authorization header 使用该 token，不会把 token 写入仓库 remote URL。

Private 仓库建议使用 Fine-grained PAT：选择目标仓库，授予 `Contents: Read and write` 与 `Metadata: Read`。

## 0.2.4 文件树交互说明

左侧文档栏现在使用单一 `＋ 新建` 入口。输入 `notes/a.md`、`paper/main.tex`、`draft.txt` 会创建对应文件；输入 `notes/` 会创建文件夹。Git clone / pull 完成后会自动刷新目录树。

## 0.2.5 目录树创建/重命名/拖拽说明

- 左侧顶部只有一个 `＋`，未选中任何节点时默认在工作区根目录创建。
- 单击目录树中的文件或文件夹会选中该节点。
- 选中文件夹后点击 `＋`，默认在该文件夹下创建文件或文件夹。
- 选中文件后点击 `＋`，默认在该文件的父目录下创建文件或文件夹。
- 文件夹以 `/` 结尾，例如 `notes/`；普通文件可直接输入 `demo.md`、`main.tex`、`draft.txt`、`refs.bib` 等。
- 点击节点右侧 `✎` 可重命名；拖动文件或文件夹到另一个文件夹可移动位置，拖到左侧空白区域可移动到根目录。
- Git clone / pull 成功后会自动刷新左侧目录树。

## v0.2.7 论文写作与界面优化

- GitHub 改为设置面板，通过右上角 ⚙ 图标显示/隐藏。
- 顶部只保留提交和显示/隐藏图标；新建在左侧目录树的 + 中完成，Ctrl/Cmd+S 保存本地。
- 支持在目录树中显示并预览图片资源，Markdown 预览会解析本地相对图片路径。
- LaTeX 面向论文模板工作流：可以把期刊/会议模板中的 `.tex/.bib/.cls/.sty/.bst/images` 等复制到项目目录中，软件会显示目录结构并调用本机 TeX 工具链构建 PDF。
- LaTeX 构建优先使用 `latexmk`；没有 `latexmk` 时回退到 `pdflatex + bibtex/biber + pdflatex x2`。
- 支持 `% !TEX root = main.tex`，便于多文件论文项目从子文件构建主文件。

## LaTeX PDF preview and SyncTeX

For paper-writing workflows, copy the full journal/conference template into the workspace, including `.tex`, `.bib`, `.cls`, `.sty`, `.bst`, and image folders. Open the main `.tex` file and press `Ctrl/Cmd+B` to build. The generated PDF is rendered in the right preview pane.

When the TeX distribution provides `synctex`, double-clicking a source position in the left editor attempts to jump to the corresponding PDF page. Double-clicking the PDF preview attempts reverse navigation back to the TeX source line. This requires building with SyncTeX enabled, which the app does by default using `-synctex=1`.

### v0.3.0 文件打开性能优化

快速点击多个文件时，软件会自动忽略旧打开任务的结果：只有最后一次点击的文件会更新编辑器、图片/PDF 预览和状态栏。PDF 预览也会取消旧的 pdf.js 渲染任务，避免大 PDF 或图片切换时界面被旧渲染结果覆盖。

## v0.3.1 性能与 PDF 预览优化

- PDF 预览改为连续滚动浏览，保留上一页/下一页按钮但不再强制单页模式。
- 支持普通鼠标滚轮滚动浏览 PDF，Ctrl/⌘ + 鼠标滚轮缩放。
- PDF 使用低清晰度按需渲染，只渲染当前可视区域附近页面，减少卡顿。
- 图片预览支持 Ctrl/⌘ + 鼠标滚轮缩放。
- LaTeX 构建改为 Tauri 后端 spawn_blocking 后台任务，避免阻塞设置/隐藏面板等界面操作。
- clone、刷新、提交、LaTeX 构建增加任务锁，快速连点不会重复运行同一任务。

## v0.3.4 PDF 预览改动

- PDF 默认使用 WebView 原生 PDF 阅读器，优先支持文本选择、复制、原生滚动和原生缩放。
- 保留 `定位` 模式：需要 SyncTeX 双向定位时，可切换到轻量 pdf.js canvas 定位视图。
- 默认不再加载 pdf.js canvas，减少打开 PDF 时的卡顿和“浏览器不像浏览器”的问题。

## v0.4.1 批注使用说明

- PDF 默认就是“定位/文字模式”：可以选择 PDF 文本，也可以双击 PDF 反向定位到 TeX 源码。
- 需要添加 PDF 区域批注时，点击 PDF 顶部工具条的“批注”，然后拖拽框选区域。再次点击“退出批注”会回到默认定位/文字模式。
- 批注保存到项目目录的 `.paper-notes/annotations.jsonl`，提交 GitHub 时会随 `git add -A` 一起提交。
- 在其他电脑 clone/pull 后，用本软件打开同一项目即可看到批注；GitHub 网页直接打开 PDF 不会显示这些批注，因为它们不是写入 PDF 本体的。
- 批注侧栏支持按状态和时间筛选，并按日期分组，适合论文多轮修改后的大量批注浏览。

## v0.4.2 修复

PDF 默认模式下双击反向定位现在绑定到整页 PDF 视图容器，不再被 pdf.js 文本层遮挡；批注模式下仍然只用于拖拽创建批注。

## v0.4.3 Paper Review 更新

- PDF 默认自动适应预览宽度并居中，保留手动缩放、1:1 和适宽按钮。
- PDF 页周围空白进一步压缩，页码改为浮层显示。
- 浅色模式对比度提升，工具栏、侧栏和批注文字更清晰。
- PDF/TeX 定位增加目标闪烁提示，重新编译后尽量保持当前 PDF 页。

## v0.4.5 Paper Review：文字批注与可调批注栏

- PDF 默认模式下直接选中文字，会出现浮动工具条：`批注 / 高亮 / 定位源码`。
- 选中文字后右键，也会显示同一套文字批注操作。
- 顶部按钮改为 `区域批注`，用于图、表、公式和页面版式问题。
- 批注栏现在可以拖拽调整宽度，也可以隐藏；隐藏后 PDF 会占满剩余空间。
- 批注仍保存到 `.paper-notes/annotations.jsonl`，可以和论文源码一起提交到 Git/GitHub。

## v0.4.4 Paper Review 修复

- 修复 PDF 自动适宽、窗口拖拽、滚轮缩放和按需渲染同时触发时，pdf.js 对同一 canvas 并发 render 导致的 `Cannot use the same canvas during multiple render() operations` 错误。
- 每一页 PDF 现在都有独立的渲染队列：旧任务会先取消并等待完全释放 canvas，再启动新的渲染。
- 普通缩放/适宽刷新时不再立即重置 canvas 尺寸，避免取消中的 render task 与新 render task 抢占同一 canvas。

## v0.6.0 LaTeX 写作增强测试步骤

1. 启动桌面版：
   ```bash
   npm install
   npm run tauri:dev
   ```
2. 左侧“文档”点击 📂，选择一个包含 `.tex`、`.bib`、`figures/` 的论文文件夹。
3. 打开主 `.tex` 文件，等待左侧“大纲”出现；点击大纲条目应跳转到对应源码行，若已有 PDF/SyncTeX 会同步定位预览。
4. 在 `.tex` 中测试补全：
   - 输入 `\cite{`，应出现 `.bib` 中的 cite key，并显示作者、年份、标题。
   - 输入 `\ref{` 或 `\cref{`，应出现项目里的 `\label{...}`。
   - 输入 `\input{` / `\include{`，应出现项目中的 `.tex` 文件路径。
   - 输入 `\includegraphics{`，应出现图片/PDF 资源路径。
5. 在 `\cite{key}` 的 key 上点击或把光标放入引用内，编辑区右下角应显示 BibTeX 预览；点击“打开条目”应跳转到 `.bib` 对应行。
6. 按住 Ctrl/Cmd 点击 `\ref{label}` 应跳转到对应 `\label{label}`；Ctrl/Cmd 点击 `\input{...}` 应打开对应 `.tex` 文件。
7. 新增或修改 `.bib`、`\label{}`、`\section{}` 后保存文件，索引会随工作区刷新更新。
