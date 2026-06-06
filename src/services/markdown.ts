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

export const sampleMarkdown = `# Welcome.md — Markdown / LaTeX / Git 测试文档

这是一个用于测试编辑器能力的综合 Markdown 文档。你可以用它检查实时预览、代码高亮、数学公式、Mermaid、表格、脚注、任务列表和 Git 提交流程。

## 1. 基础排版

普通段落支持 **加粗**、*斜体*、~~删除线~~、==高亮==、上标 x^2^、下标 H~2~O，以及 :sparkles: emoji。

> 引用块：适合放提示、摘要或长文档中的重点。
>
> - 引用内也可以有列表
> - 也可以包含 \`inline code\`

[GitHub](https://github.com/) 会自动识别链接，裸链接也会 linkify：https://github.com/yanxian-ll/test-markdown-notes

## 2. 列表和任务

- 无序列表 A
  - 子项 A.1
  - 子项 A.2
- 无序列表 B

1. 第一步：连接 GitHub
2. 第二步：clone 到本地目录
3. 第三步：Ctrl+S 保存本地
4. 第四步：手动提交并 push

- [x] Markdown 编辑
- [x] 实时预览
- [x] 本地 Git 工作区
- [ ] 完整 LaTeX Workshop 级别功能

## 3. 表格

| 功能 | 状态 | 说明 |
| --- | ---: | --- |
| Markdown | ✅ | markdown-it 渲染 |
| LaTeX 公式 | ✅ | KaTeX 渲染 |
| Mermaid | ✅ | 流程图预览 |
| GitHub | ✅ | 本地 clone + 手动 push |

## 4. 代码高亮

\`\`\`ts
interface Note {
  title: string;
  body: string;
  tags: string[];
}

export function save(note: Note) {
  console.log('saving', note.title);
}
\`\`\`

\`\`\`bash
git clone --depth=1 https://github.com/yanxian-ll/test-markdown-notes.git
git status --porcelain
git add -A && git commit -m "docs: update notes" && git push
\`\`\`

## 5. 数学公式

行内公式：$E = mc^2$，$a^2 + b^2 = c^2$。

块级公式：

$$
\\int_{-\\infty}^{\\infty} e^{-x^2} dx = \\sqrt{\\pi}
$$

矩阵：

$$
A = \\begin{bmatrix}
1 & 2 \\\\
3 & 4
\\end{bmatrix}
$$

## 6. Mermaid 图表

\`\`\`mermaid
graph TD
  A[连接 GitHub] --> B[clone --depth=1 到本地]
  B --> C[打开 Markdown / LaTeX 文件]
  C --> D[Ctrl+S 保存本地]
  D --> E[手动提交 GitHub]
  E --> F[git push]
\`\`\`

\`\`\`mermaid
sequenceDiagram
  participant User as 用户
  participant App as 桌面软件
  participant Git as 本地 Git
  participant GH as GitHub
  User->>App: Ctrl+S
  App->>Git: 写入本地文件
  User->>App: 点击提交 GitHub
  App->>Git: git add / commit
  Git->>GH: git push
\`\`\`

## 7. 脚注和定义列表

Markdown[^md] 很适合技术写作。

[^md]: Markdown 是轻量标记语言。

术语 1
: 定义说明 1

术语 2
: 定义说明 2

## 8. 图片

如果仓库里有图片，可以使用相对路径：

\`\`\`markdown
![示例图片](./assets/example.png)
\`\`\`

## 9. LaTeX 文件支持说明

除了 \`.md\`，左侧文件树也会显示 \`.tex\`、\`.bib\`、\`.sty\`、\`.cls\`。打开 \`.tex\` 后可以使用 LaTeX 语法高亮，并通过右侧 LaTeX 面板调用本机 \`latexmk\` 或 \`pdflatex\` 构建 PDF。
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
