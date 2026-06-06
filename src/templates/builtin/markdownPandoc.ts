import type { BuiltinTemplate } from '../types';

export function createMarkdownPandocTemplate(): BuiltinTemplate {
  return {
    id: 'markdown-pandoc-paper',
    name: 'Markdown + Pandoc 论文',
    kind: 'markdown',
    description: '适合 Markdown 写作，通过 Pandoc 导出 PDF/DOCX/HTML。',
    mainFile: 'paper.md',
    engine: 'pandoc + xelatex',
    bibliography: 'refs.bib',
    provider: {
      id: 'scholia',
      name: 'Scholia Studio',
      description: '内置轻量模板',
    },
    tags: ['论文', 'Markdown', 'Pandoc'],
    files: [
      {
        path: 'paper.md',
        content: `---\ntitle: Markdown + LaTeX 混合论文\nauthor: 作者\nbibliography: refs.bib\n---\n\n# Introduction\n\n这里写引言，支持行内公式 $E=mc^2$。\n\n## Figure 示例\n\n\`\`\`figure\nsrc: figures/demo.png\ncaption: Demo figure\nlabel: fig:demo\n\`\`\`\n\n# Method\n\n这里写方法。\n`,
      },
      { path: 'refs.bib', content: '@article{sample2026,\n  title={A Sample Paper},\n  author={Author, Alice},\n  year={2026},\n  journal={Journal}\n}\n' },
      { path: 'figures/.gitkeep', content: '' },
    ],
    roadmap: ['后续支持导出配置 profile。', '支持 CSL 样式和自定义 Pandoc 模板。'],
  };
}
