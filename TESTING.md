# v0.9.0 测试记录与步骤

## 1. 安装和静态检查

```bash
npm install
npx vue-tsc --noEmit
```

本次容器中 `vue-tsc` 已通过。建议本机继续执行：

```bash
npx vite build
npm test
cd src-tauri
cargo check
```

Pandoc/LaTeX 相关测试前确认：

```bash
pandoc --version
xelatex --version
latexmk --version
```

## 2. 基础打开和编辑

1. 运行：`npm run tauri:dev`。
2. 点击左侧文档区的打开按钮。
3. 测试打开文件夹和打开单个文件。
4. 打开 `.tex`、`.md`、`.bib`、图片、PDF，确认布局自动切换。
5. 选中文字按 `Ctrl/Cmd+C`，确认复制选区；不选文字按 `Ctrl/Cmd+C`，确认复制当前行。

## 3. LaTeX 智能测试

在 `.tex` 文件中测试：

```tex
\cite{
\ref{
\input{
\includegraphics{
```

期望：分别出现 BibTeX、label、TeX 文件、图片补全。

测试 hover：

```tex
\ref{fig:demo}
\cite{somekey}
\includegraphics{demo}
$E=mc^2$
```

期望：hover 显示 label/cite/图片/公式预览。

## 4. Snippet 测试

在 `.tex` 中输入：

```txt
fig
eq
align
```

触发补全，确认可插入 LaTeX 模板。

在 `.md` 中输入：

```txt
/figure
/table
/todo
/note
```

触发补全，确认可插入 Markdown 扩展块。

## 5. 问题面板测试

在 `.tex` 中写入：

```tex
\ref{missing:label}
\cite{missingKey}
\includegraphics{figures/missing.png}
```

1. 点击编辑区 topbar 的 ⚠ 或底部状态栏“问题”。
2. 查看“问题 / 输出 / 日志”。
3. 点击问题项，确认会跳到对应文件和行。

## 6. Markdown + Pandoc 测试

Markdown 内容：

````md
# Demo

Inline math $E=mc^2$.

$$
a^2+b^2=c^2
$$

```figure
src: figures/demo.png
caption: Demo figure
label: fig:demo
```
````

测试：

1. Markdown 预览中公式应实时渲染。
2. 按 `Ctrl/Cmd+B` 或点击预览工具栏构建 PDF。
3. 如果 Pandoc 不在 PATH，会出现明确错误；安装 Pandoc 和 XeLaTeX 后重试。

## 7. 多格式导出测试

1. 打开 `.md` 文件。
2. 点击编辑区 topbar 的 ⇪。
3. 选择 PDF / DOCX / HTML / EPUB / LaTeX / Beamer。
4. 系统弹出保存文件框。
5. 保存后检查导出文件是否生成。

依赖：系统需安装 Pandoc；PDF/Beamer 还需要 XeLaTeX。

## 8. BibTeX 管理测试

1. 打开含 `.bib` 的工作区。
2. 点击编辑区 topbar 的参考文献按钮。
3. 搜索 key/作者/标题/年份。
4. 点击条目，确认跳转到 `.bib` 对应行。

## 9. v0.9 项目工具测试

1. 点击编辑区 topbar 的 ⚙ 项目工具按钮。
2. 在“模板”页选择 `LaTeX 基础论文`。
3. 输入目录名，例如 `demo-paper`。
4. 确认工作区中生成 `demo-paper/main.tex`、`chapters/`、`refs.bib`、`figures/`。
5. 确认自动打开 `demo-paper/main.tex`。
6. 在“导出”页打开 Markdown 文件后测试默认导出 profile。
7. 在“写作”页点击“打开今天”，确认生成或打开 `notes/daily/YYYY-MM-DD.md`。
8. 在“写作”页点击“创建快照”，确认生成 `.paper-notes/snapshots/<time>/manifest.md`。
9. 在“框架”页确认 Zotero、DOI 导入、发布、可视化、PDF 笔记等后续框架入口存在。

## 10. 历史框架测试

1. GitHub 工作区修改文件后，点击底部“历史”。
2. 面板应显示当前 Git 变更列表。
3. 本地非 Git 工作区会显示本地快照框架提示。

## 11. 批注测试

1. PDF 中选中文字，点击“批注”。
2. Markdown 预览中选中文字，点击“批注”。
3. 添加回复、编辑评论、解决/重新打开。
4. 导出当前文件批注 Markdown。


## Scholia Studio 命名和打开图标检查

1. 启动应用后，窗口标题和顶部品牌应显示 `Scholia Studio`。
2. 左侧“文档”栏的打开入口应为线性文件夹图标，不再使用 emoji 文件夹。
3. 点击打开入口仍应弹出“打开文件夹 / 打开文件”菜单。
4. 打开文件或文件夹后，原有编辑、预览、批注功能应保持可用。
