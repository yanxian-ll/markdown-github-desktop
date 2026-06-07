import MarkdownIt from 'markdown-it';
import abbr from 'markdown-it-abbr';
import deflist from 'markdown-it-deflist';
import { full as emoji } from 'markdown-it-emoji';
import footnote from 'markdown-it-footnote';
import katex from 'markdown-it-katex';
import mark from 'markdown-it-mark';
import sub from 'markdown-it-sub';
import sup from 'markdown-it-sup';
import Prism from 'prismjs';
import 'prismjs/components/prism-bash';
import 'prismjs/components/prism-css';
import 'prismjs/components/prism-json';
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-latex';
import 'prismjs/components/prism-markdown';
import 'prismjs/components/prism-python';
import 'prismjs/components/prism-rust';
import 'prismjs/components/prism-typescript';
import 'prismjs/components/prism-yaml';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const md = new MarkdownIt({
  html: false,
  linkify: true,
  typographer: true,
  breaks: false,
  highlight(code, language) {
    if (language && language.toLowerCase() === 'mermaid') {
      return `<pre class="mermaid">${escapeHtml(code)}</pre>`;
    }
    const languageAliases: Record<string, string> = {
      js: 'javascript',
      ts: 'typescript',
      sh: 'bash',
      shell: 'bash',
      yml: 'yaml',
      tex: 'latex',
      latex: 'latex',
    };
    const normalizedLanguage = languageAliases[(language || '').toLowerCase()] || (language || '').toLowerCase();
    const grammar = normalizedLanguage ? Prism.languages[normalizedLanguage] : undefined;
    if (grammar) return Prism.highlight(code, grammar, normalizedLanguage);
    return escapeHtml(code);
  },
})
  .use(abbr)
  .use(deflist)
  .use(emoji)
  .use(footnote)
  .use(katex)
  .use(mark)
  .use(sub)
  .use(sup);


// Attach source-line metadata to block-level opening tokens so the rendered
// Markdown preview can synchronize clicks with the source editor.
md.core.ruler.push('source_line_attrs', (state) => {
  for (const token of state.tokens) {
    if (token.nesting !== 1 || !token.map) continue;
    const [start, end] = token.map;
    token.attrSet('data-source-line', String(start + 1));
    token.attrSet('data-source-end-line', String(Math.max(start + 1, end)));
    token.attrJoin('class', 'md-source-block');
  }
});


const LATEX_FENCE_TYPES = new Set(['figure', 'table', 'algorithm', 'theorem']);

function splitFenceFrontMatter(content: string): { attrs: Record<string, string>; body: string } {
  const lines = content.replace(/\r\n/g, '\n').split('\n');
  const attrs: Record<string, string> = {};
  let index = 0;
  for (; index < lines.length; index += 1) {
    const line = lines[index];
    if (!line.trim()) continue;
    if (/^---+$/.test(line.trim())) {
      index += 1;
      break;
    }
    const match = line.match(/^([A-Za-z_][\w-]*)\s*:\s*(.*)$/);
    if (!match) break;
    attrs[match[1].toLowerCase()] = match[2].trim();
  }
  return { attrs, body: lines.slice(index).join('\n').trim() };
}

function renderLatexFence(type: string, content: string): string {
  const { attrs, body } = splitFenceFrontMatter(content);
  const title = attrs.title || attrs.caption || '';
  const label = attrs.label || '';
  if (type === 'figure') {
    const src = attrs.src || attrs.image || attrs.path || body.split(/\n/).find(Boolean)?.trim() || '';
    const width = attrs.width || '0.9\\linewidth';
    return `<figure class="md-latex-block md-latex-figure" data-block-type="figure">${src ? `<img src="${escapeHtml(src)}" alt="${escapeHtml(title || src)}" style="max-width:${escapeHtml(width.includes('\\') ? '90%' : width)}">` : ''}${title ? `<figcaption>${escapeHtml(title)}</figcaption>` : ''}${label ? `<small>${escapeHtml(label)}</small>` : ''}</figure>`;
  }
  if (type === 'table') {
    return `<section class="md-latex-block md-latex-table" data-block-type="table">${title ? `<header>${escapeHtml(title)}</header>` : ''}<pre>${escapeHtml(body || content)}</pre>${label ? `<small>${escapeHtml(label)}</small>` : ''}</section>`;
  }
  if (type === 'algorithm') {
    return `<section class="md-latex-block md-latex-algorithm" data-block-type="algorithm">${title ? `<header>${escapeHtml(title)}</header>` : '<header>Algorithm</header>'}<pre>${escapeHtml(body || content)}</pre>${label ? `<small>${escapeHtml(label)}</small>` : ''}</section>`;
  }
  return `<section class="md-latex-block md-latex-theorem" data-block-type="theorem">${title ? `<header>${escapeHtml(title)}</header>` : '<header>Theorem</header>'}<div>${escapeHtml(body || content).replace(/\n/g, '<br>')}</div>${label ? `<small>${escapeHtml(label)}</small>` : ''}</section>`;
}

const defaultFence = md.renderer.rules.fence?.bind(md.renderer.rules);
md.renderer.rules.fence = (tokens, idx, options, env, self) => {
  const token = tokens[idx];
  const language = token.info.trim().split(/\s+/)[0]?.toLowerCase();
  if (language === 'mermaid') return `<pre class="mermaid">${escapeHtml(token.content)}</pre>`;
  if (LATEX_FENCE_TYPES.has(language)) return renderLatexFence(language, token.content);
  return defaultFence ? defaultFence(tokens, idx, options, env, self) : self.renderToken(tokens, idx, options);
};

export function renderMarkdown(text: string): string {
  return md.render(text);
}

export const sampleMarkdown = `# 欢迎使用 Scholia Studio

> **Scholia Studio 是一个本地优先的研究写作工作台。**  
> 它不是单纯的 Markdown / LaTeX 编辑器，而是把每日记录、周报、证据索引、论文草稿、PDF 预览和批注审阅放在同一个工作流里，帮助你从“平时做了什么”逐步走到“可以检查和投稿的论文”。

## 1. 它适合做什么？

Scholia Studio 当前重点服务这几类任务：

| 场景 | 你可以怎么用 |
| --- | --- |
| 研究日志 | 每天记录实验、阅读、问题、结论和下一步计划。 |
| 周报总结 | 从每日记录整理本周进展、风险、结论和下周计划。 |
| 证据索引 | 把笔记、图表、实验结果、文献和批注集中到一个可追溯清单。 |
| Markdown 写作 | 写笔记、技术文档、周报、论文初稿，并实时预览。 |
| LaTeX 写作 | 编辑 \`.tex\`、\`.bib\`、\`.cls\`、\`.sty\`，调用本机 LaTeX 构建 PDF。 |
| PDF 审阅 | 预览 PDF、进行批注、在源码和预览之间校准修改。 |
| 模板起稿 | 使用内置模板创建论文、毕业论文、Beamer 或 Markdown + Pandoc 项目。 |

推荐的核心流程：

1. **记录**：每天写研究日志，保留实验、数据、图片、问题和结论。
2. **汇总**：每周生成周报，把零散记录压缩成阶段性成果。
3. **索引**：把能支撑论文的结论整理到证据索引。
4. **起稿**：根据证据索引生成论文大纲和章节草稿。
5. **审阅**：在源码、预览和 PDF 批注之间反复校准。
6. **导出 / 投稿**：用 LaTeX、Pandoc 或模板项目生成最终成果。

## 2. 界面快速认识

Scholia Studio 的界面可以理解为几个可收起、可调整的工作区：

| 区域 | 位置 | 作用 |
| --- | --- | --- |
| 文档栏 | 最左侧 | 打开工作区文件、创建每日笔记、周报、证据索引和论文大纲。 |
| 模板栏 | 文档栏旁边 | 从内置模板创建论文工程。 |
| 研究流 / 大纲 / 片段 / 批注 | 编辑区左侧 | 管理研究记录、文件结构、常用片段和审阅任务。 |
| 编辑栏 | 中间 | 编辑 Markdown、LaTeX、BibTeX、普通文本。 |
| 预览栏 | 右侧 | 预览 Markdown、图片、PDF 或 LaTeX 构建结果。 |
| 设置栏 | 右侧工具区 | 切换主题、Markdown 渲染风格、PDF 清晰度、构建选项等。 |
| 日志栏 | 底部 | 查看问题、输出、构建日志和运行状态。 |

小技巧：

- 多数面板都可以拖动边界调整宽度或高度。
- 文档栏、设置栏、日志栏、研究流、大纲、片段、批注等面板支持**双击标题栏关闭**。
- Markdown 和 LaTeX 文件默认打开“编辑 + 预览”双栏。
- 编辑栏和预览栏是对等区域：双击任一栏顶部可以快速切换单栏 / 双栏。

## 3. 第一次怎么用？

### 3.1 只写 Markdown 笔记

1. 打开或创建一个本地工作区。
2. 在文档栏点击 **日** 创建今日笔记。
3. 在编辑栏写内容，右侧会实时预览。
4. 按 \`Ctrl/Cmd + S\` 保存。
5. 需要导出时，可使用 Pandoc 导出 PDF、DOCX、HTML 等格式。

### 3.2 写周报和工作总结

1. 每天使用今日笔记记录工作。
2. 在文档栏点击 **周**，生成本周周报模板。
3. 把本周完成、问题、结论和下周计划整理进去。
4. 后续可以把周报中的关键结论加入证据索引。

### 3.3 写论文

1. 用模板栏创建 LaTeX 论文项目，或打开已有 \`.tex\` 项目。
2. 在文档栏点击 **证** 创建 \`research/evidence-index.md\`。
3. 在文档栏点击 **纲** 创建 \`paper/paper-outline.md\`。
4. 先把“能被证据支撑的结论”写到证据索引，再组织论文大纲。
5. 编辑 \`.tex\` 文件，按 \`Ctrl/Cmd + B\` 构建 PDF。
6. 在 PDF 预览和批注栏中检查格式、引用、图表和表述问题。

### 3.4 审阅 PDF / LaTeX

1. 打开主 \`.tex\` 文件。
2. 按 \`Ctrl/Cmd + B\` 构建 PDF。
3. 在预览栏查看 PDF。
4. 通过批注栏记录问题、修改意见和已解决状态。
5. 在源码和预览之间来回校准，直到批注全部处理完成。

## 4. 常用快捷键和鼠标操作

| 操作 | 快捷键 / 鼠标 |
| --- | --- |
| 保存当前文件 | \`Ctrl/Cmd + S\` |
| 构建当前 Markdown / LaTeX | \`Ctrl/Cmd + B\` |
| 切换预览栏 | \`Ctrl/Cmd + Alt + V\` |
| 切换编辑栏 | \`Ctrl/Cmd + Alt + E\` |
| 恢复编辑 + 预览双栏 | \`Ctrl/Cmd + Alt + 反斜杠\` |
| 编辑 / 预览双栏切换 | 双击编辑栏或预览栏顶部 |
| 关闭文档栏、设置栏、研究流、大纲、片段、批注、日志栏 | 双击对应面板顶部标题区域 |
| 调整侧栏宽度 | 拖动面板边界 |
| 调整底部日志高度 | 拖动日志栏顶部边界 |
| PDF / 图片缩放 | \`Ctrl/Cmd + 鼠标滚轮\` |

> 如果某个快捷键被系统、输入法或浏览器占用，可以优先使用双击标题栏和拖拽边界完成同样的操作。

## 5. Markdown 渲染风格

在右侧设置栏可以切换 Markdown 预览风格。当前内置：

- **默认**：通用写作和预览。
- **学术论文**：更接近论文阅读排版，适合长段落和公式。
- **长文阅读**：增加行距和阅读舒适度。
- **紧凑**：适合小屏幕、密集笔记和快速检查。
- **手稿**：适合早期草稿和写作构思。

这些预设只影响软件内预览，不会修改你的 Markdown 源文件，也不会直接改变 Pandoc 导出样式。

## 6. 命令行依赖安装

如果你只是使用已经打包好的桌面应用，通常不需要安装前端开发依赖。  
如果你要从源码运行或继续开发，需要安装以下环境。

### 6.1 必需依赖

| 依赖 | 用途 | 检查命令 |
| --- | --- | --- |
| Node.js 20 或 22 | 前端开发、构建 | \`node -v\`、\`npm -v\` |
| Rust + Cargo | Tauri 桌面应用构建 | \`rustc --version\`、\`cargo --version\` |
| Git | 本地仓库、提交、推送 | \`git --version\` |

### 6.2 可选但推荐依赖

| 依赖 | 用途 | 检查命令 |
| --- | --- | --- |
| Pandoc | Markdown 导出 PDF、DOCX、HTML、EPUB、Beamer 等 | \`pandoc --version\` |
| TeX Live / MiKTeX | LaTeX PDF 构建 | \`latexmk -v\`、\`xelatex --version\` |
| latexmk | 自动构建 LaTeX 项目 | \`latexmk -v\` |

### 6.3 Windows 示例

如果你使用 Windows 11，可以先尝试 \`winget\`：

~~~powershell
winget install OpenJS.NodeJS.LTS
winget install Rustlang.Rustup
winget install Git.Git
winget install JohnMacFarlane.Pandoc
winget install MiKTeX.MiKTeX
~~~

安装后重新打开 PowerShell，检查：

~~~powershell
node -v
npm -v
rustc --version
cargo --version
git --version
pandoc --version
latexmk -v
xelatex --version
~~~

如果 \`latexmk\` 不可用，打开 MiKTeX Console 安装缺失包，或安装 TeX Live 并确保命令加入 PATH。

### 6.4 macOS 示例

~~~bash
brew install node git pandoc rustup-init
rustup-init
brew install --cask mactex-no-gui
~~~

安装后检查：

~~~bash
node -v
npm -v
rustc --version
cargo --version
git --version
pandoc --version
latexmk -v
xelatex --version
~~~

### 6.5 Ubuntu / Debian 示例

~~~bash
sudo apt update
sudo apt install -y nodejs npm git pandoc curl build-essential
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
sudo apt install -y texlive-full latexmk
~~~

安装后检查：

~~~bash
node -v
npm -v
rustc --version
cargo --version
git --version
pandoc --version
latexmk -v
xelatex --version
~~~

## 7. 从源码运行

在项目根目录执行：

~~~bash
npm install
npm run dev
~~~

这会启动前端开发服务器。  
如果要运行桌面版：

~~~bash
npm run tauri:dev
~~~

构建前端：

~~~bash
npm run build
~~~

构建桌面安装包：

~~~bash
npm run tauri:build
~~~

运行测试：

~~~bash
npm run test
~~~

## 8. 常见问题

### 8.1 为什么按构建后没有 PDF？

通常是以下原因之一：

- 没有安装 LaTeX 发行版。
- \`latexmk\`、\`xelatex\` 或 \`pdflatex\` 不在 PATH 中。
- 当前打开的不是主 \`.tex\` 文件。
- 模板依赖的 \`.cls\`、\`.sty\`、图片或 \`.bib\` 文件缺失。
- LaTeX 源码本身有错误。

可以先在终端里进入论文目录，手动运行。中文论文、CTeX、fontspec 或 CSUthesis 模板优先使用 XeLaTeX：

~~~bash
latexmk -xelatex -interaction=nonstopmode -synctex=1 -file-line-error main.tex
~~~

如果是纯英文且模板明确要求 pdfLaTeX，再使用：

~~~bash
latexmk -pdf -interaction=nonstopmode -synctex=1 -file-line-error main.tex
~~~

如果日志只显示 “gave an error in previous invocation of latexmk”，先清理辅助文件后重建；应用内快捷键是 Ctrl/Cmd+Alt+K。

### 8.2 Pandoc 导出失败怎么办？

先检查：

~~~bash
pandoc --version
~~~

再确认输出格式是否需要额外依赖。例如 Markdown 导出 PDF 通常仍需要 LaTeX 引擎。

### 8.3 为什么切换文件后某些面板会关闭？

研究流会尽量保持打开，因为它是项目级工作流。  
大纲、片段、批注等面板和当前文件关系更强，后续版本会继续优化它们的状态保持策略。

### 8.4 这个软件和普通 AI 写论文有什么不同？

普通 AI 写论文容易“凭空生成”。Scholia Studio 的目标是先帮你沉淀研究过程，再让后续 AI 能基于你的笔记、周报、PDF 批注、文献和实验结果生成内容。也就是说，重点不是“一键写论文”，而是：

- 每个结论都能回到来源。
- 每个段落都能被审阅。
- 每次修改都能通过 PDF / 源码 / 批注校准。
- 最终输出的是可检查、可维护、可投稿的论文工程。

---

你可以直接修改这个 \`Welcome.md\` 作为自己的项目首页，也可以把它保留下来作为 Scholia Studio 的使用说明。
`;

export const sampleLatex = `\\documentclass{article}
\\usepackage[utf8]{inputenc}
\\usepackage{amsmath}
\\usepackage{graphicx}
\\usepackage{hyperref}

\\title{LaTeX Test Document}
\\author{Scholia Studio}
\\date{\\today}

\\begin{document}
\\maketitle

\\section{Introduction}
This is a sample \\LaTeX{} document for testing syntax highlighting and PDF build.

\\section{Mathematics}
Inline math: $E = mc^2$.

Displayed equation:
\\[
  \\int_{-\\infty}^{\\infty} e^{-x^2} \\, dx = \\sqrt{\\pi}
\\]

\\begin{align}
  a^2 + b^2 &= c^2 \\\\
  e^{i\\pi} + 1 &= 0
\\end{align}

\\section{Lists}
\\begin{itemize}
  \\item First item
  \\item Second item
\\end{itemize}

\\section{References}
See Section~\\ref{sec:conclusion}.

\\section{Conclusion}
\\label{sec:conclusion}
Build this file with latexmk or pdflatex.

\\end{document}
`;
