export interface EditorSnippet {
  trigger: string;
  label: string;
  detail: string;
  language: 'latex' | 'markdown' | 'both';
  insert: string;
}

export const editorSnippets: EditorSnippet[] = [
  {
    trigger: 'fig',
    label: 'fig',
    detail: 'LaTeX figure 环境',
    language: 'latex',
    insert: '\\begin{figure}[htbp]\n  \\centering\n  \\includegraphics[width=${1:0.9}\\linewidth]{${2:figures/filename}}\n  \\caption{Caption}\n  \\label{fig:label}\n\\end{figure}',
  },
  {
    trigger: 'table',
    label: 'table',
    detail: 'LaTeX table 环境',
    language: 'latex',
    insert: '\\begin{table}[htbp]\n  \\centering\n  \\caption{Caption}\n  \\label{tab:label}\n  \\begin{tabular}{cc}\n    A & B \\\\\n    1 & 2\n  \\end{tabular}\n\\end{table}',
  },
  {
    trigger: 'eq',
    label: 'eq',
    detail: 'LaTeX equation 环境',
    language: 'latex',
    insert: '\\begin{equation}\n  E = mc^2\n  \\label{eq:label}\n\\end{equation}',
  },
  {
    trigger: 'align',
    label: 'align',
    detail: 'LaTeX align 环境',
    language: 'latex',
    insert: '\\begin{align}\n  a &= b + c \\\\\n  d &= e + f\n\\end{align}',
  },
  {
    trigger: 'algo',
    label: 'algo',
    detail: 'LaTeX algorithm 环境',
    language: 'latex',
    insert: '\\begin{algorithm}\n  \\caption{Algorithm}\n  \\label{alg:label}\n  \\begin{verbatim}\n  for item in items:\n      process(item)\n  \\end{verbatim}\n\\end{algorithm}',
  },
  {
    trigger: 'theorem',
    label: 'theorem',
    detail: 'LaTeX theorem 环境',
    language: 'latex',
    insert: '\\begin{theorem}\n  Statement.\n  \\label{thm:label}\n\\end{theorem}',
  },
  {
    trigger: '/figure',
    label: '/figure',
    detail: 'Markdown figure 扩展块',
    language: 'markdown',
    insert: '```figure\nsrc: figures/demo.png\ncaption: Demo figure\nlabel: fig:demo\nwidth: 0.9\\linewidth\n```',
  },
  {
    trigger: '/table',
    label: '/table',
    detail: 'Markdown table 扩展块',
    language: 'markdown',
    insert: '```table\ncaption: Results\nlabel: tab:results\n---\n\\begin{tabular}{cc}\nA & B \\\\\n1 & 2\n\\end{tabular}\n```',
  },
  {
    trigger: '/todo',
    label: '/todo',
    detail: 'Markdown TODO',
    language: 'markdown',
    insert: '- [ ] TODO: ${1:task}',
  },
  {
    trigger: '/note',
    label: '/note',
    detail: 'Markdown note',
    language: 'markdown',
    insert: '> [!note]\n> ',
  },
];
