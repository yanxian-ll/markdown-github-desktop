import type { BuiltinTemplate } from '../types';

export function createBeamerTemplate(): BuiltinTemplate {
  return {
    id: 'beamer-basic',
    name: 'Beamer 演示文稿',
    kind: 'beamer',
    description: 'Markdown/LaTeX 演示文稿框架，后续可接 Pandoc Beamer 导出。',
    mainFile: 'slides.md',
    engine: 'pandoc beamer + xelatex',
    provider: {
      id: 'scholia',
      name: 'Scholia Studio',
      description: '内置轻量模板',
    },
    tags: ['演示', 'Beamer', 'Markdown'],
    files: [
      {
        path: 'slides.md',
        content: `---\ntitle: 演示文稿标题\nauthor: 作者\ntheme: Madrid\n---\n\n# 背景\n\n- 研究问题\n- 主要贡献\n\n# 方法\n\n$$\na^2+b^2=c^2\n$$\n`,
      },
    ],
    roadmap: ['后续支持内置主题预览。', '支持 Markdown → Beamer PDF 一键导出配置。'],
  };
}
