import { describe, expect, it } from 'vitest';
import { renderMarkdown } from './markdown';

describe('renderMarkdown', () => {
  it('renders headings and code fences', () => {
    const html = renderMarkdown('# Hello\n\n```ts\nconst a = 1\n```');
    expect(html).toContain('<h1>Hello</h1>');
    expect(html).toContain('language-ts');
  });
});
