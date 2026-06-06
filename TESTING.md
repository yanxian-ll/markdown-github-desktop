# v0.8.0 测试记录与步骤

## 1. 安装和静态检查

```bash
npm install
npx vue-tsc --noEmit
```

本次容器中 `vue-tsc` 已通过。`vite build` 在当前容器环境的 transforming 阶段超时；`vitest run` 在当前容器中也未能退出，初步判断与测试运行环境/异步渲染依赖有关，需要本机复核。建议本机继续执行：

```bash
npx vite build
npm test
cd src-tauri
cargo check
```

## 2. 基础打开和编辑

1. 运行：`npm run tauri:dev`。
2. 点击左侧文档区 📂。
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

```md
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
```

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

## 9. 历史框架测试

1. GitHub 工作区修改文件后，点击底部“历史”。
2. 面板应显示当前 Git 变更列表。
3. 本地非 Git 工作区会显示本地快照框架提示。

## 10. 批注测试

1. PDF 中选中文字，点击“批注”。
2. Markdown 预览中选中文字，点击“批注”。
3. 添加回复、编辑评论、解决/重新打开。
4. 导出当前文件批注 Markdown。
