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
    const languageAliases: Record<string, string> = { js: 'javascript', ts: 'typescript', sh: 'bash', shell: 'bash', yml: 'yaml' };
    const normalizedLanguage = languageAliases[(language || '').toLowerCase()] || (language || '').toLowerCase();
    const grammar = normalizedLanguage ? Prism.languages[normalizedLanguage] : undefined;
    if (grammar) {
      return Prism.highlight(code, grammar, normalizedLanguage);
    }
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

const defaultFence = md.renderer.rules.fence?.bind(md.renderer.rules);
md.renderer.rules.fence = (tokens, idx, options, env, self) => {
  const token = tokens[idx];
  const language = token.info.trim().split(/\s+/)[0]?.toLowerCase();
  if (language === 'mermaid') {
    return `<pre class="mermaid">${escapeHtml(token.content)}</pre>`;
  }
  return defaultFence ? defaultFence(tokens, idx, options, env, self) : self.renderToken(tokens, idx, options);
};

export function renderMarkdown(text: string): string {
  return md.render(text);
}

export const sampleMarkdown = `# Markdown GitHub Desktop

一个从 StackEdit 核心思路重构而来的跨平台 Markdown 编辑器。

## 功能

- **Markdown 编辑**：基于 CodeMirror 6
- **实时预览**：markdown-it + Prism
- **数学公式**：$E = mc^2$
- **Mermaid 图表**
- **GitHub 同步**：仓库、分支、目录、文件

\`\`\`mermaid
graph TD
  A[编辑 Markdown] --> B[实时预览]
  B --> C[保存到 GitHub]
\`\`\`

\`\`\`ts
export const hello = 'world';
\`\`\`
`;
