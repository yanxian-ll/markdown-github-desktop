import type { BuiltinTemplate } from '../types';

export function createBasicLatexTemplate(): BuiltinTemplate {
  return {
    id: 'latex-basic-paper',
    name: 'LaTeX 基础论文',
    kind: 'latex',
    description: '适合普通论文草稿：main.tex、refs.bib、figures/ 和 chapters/。',
    mainFile: 'main.tex',
    engine: 'xelatex/latexmk',
    bibliography: 'refs.bib',
    provider: {
      id: 'scholia',
      name: 'Scholia Studio',
      description: '内置轻量模板',
    },
    tags: ['论文', '中文', 'LaTeX', '基础'],
    files: [
      {
        path: 'main.tex',
        content: String.raw`% !TEX root = main.tex
% !TEX program = xelatex
\documentclass[11pt]{article}
\usepackage[UTF8]{ctex}
\usepackage{graphicx}
\usepackage{amsmath,amssymb}
\usepackage{hyperref}
\usepackage{cite}
\title{论文标题}
\author{作者}
\date{\today}

\begin{document}
\maketitle

\begin{abstract}
这里写摘要。
\end{abstract}

\input{chapters/introduction}
\input{chapters/method}
\input{chapters/experiments}
\input{chapters/conclusion}

\bibliographystyle{plain}
\bibliography{refs}
\end{document}
`,
      },
      { path: 'chapters/introduction.tex', content: '\\section{Introduction}\n这里写引言。\\label{sec:introduction}\n' },
      { path: 'chapters/method.tex', content: '\\section{Method}\n这里写方法。\\label{sec:method}\n' },
      { path: 'chapters/experiments.tex', content: '\\section{Experiments}\n这里写实验。\\label{sec:experiments}\n' },
      { path: 'chapters/conclusion.tex', content: '\\section{Conclusion}\n这里写结论。\\label{sec:conclusion}\n' },
      { path: 'refs.bib', content: '@article{sample2026,\n  title={A Sample Paper},\n  author={Author, Alice},\n  year={2026},\n  journal={Journal}\n}\n' },
      {
        path: 'latexmkrc',
        content: String.raw`# This template uses CTeX and should be built with XeLaTeX.
$pdf_mode = 5;
$xelatex = 'xelatex -interaction=nonstopmode -synctex=1 -file-line-error %O %S';
$bibtex_use = 2;
`,
      },
      { path: 'figures/.gitkeep', content: '' },
    ],
    roadmap: ['后续可增加 ACM/IEEE/Springer 原始模板导入。', '支持用户模板目录和模板市场。'],
  };
}
