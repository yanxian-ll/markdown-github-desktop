# Markdown LaTeX Git Desktop

一个基于 Tauri 2 + Vue 3 + Vite 的跨平台 Markdown / LaTeX 桌面编辑器。

这个版本把原来的 GitHub Contents API 同步模型改成了更符合桌面软件的工作流：

1. 连接 GitHub token。
2. 指定本地目录。
3. 点击 `clone / 更新 --depth=1`，仓库会浅克隆到本地。
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
Local directory: C:/Users/21078/Documents/test-markdown-notes
Sub path: 留空
```

如果 Markdown / LaTeX 文件在仓库子目录，例如 `docs/`，则 `Sub path` 填 `docs`。

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

## v0.4.1 论文批注使用说明

- PDF 默认就是“定位/文字模式”：可以选择 PDF 文本，也可以双击 PDF 反向定位到 TeX 源码。
- 需要添加 PDF 区域批注时，点击 PDF 顶部工具条的“批注”，然后拖拽框选区域。再次点击“退出批注”会回到默认定位/文字模式。
- 批注保存到项目目录的 `.paper-notes/annotations.jsonl`，提交 GitHub 时会随 `git add -A` 一起提交。
- 在其他电脑 clone/pull 后，用本软件打开同一项目即可看到批注；GitHub 网页直接打开 PDF 不会显示这些批注，因为它们不是写入 PDF 本体的。
- 批注侧栏支持按状态和时间筛选，并按日期分组，适合论文多轮修改后的大量批注浏览。
