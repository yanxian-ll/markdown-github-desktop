export interface WritingStats {
  rawCharacters: number;
  cjkCharacters: number;
  latinWords: number;
  totalWords: number;
  lines: number;
}

function stripLatexCommands(text: string) {
  return text
    .replace(/%.*$/gm, '')
    .replace(/\\(begin|end)\{[^}]+\}/g, ' ')
    .replace(/\\[A-Za-z]+\*?(?:\[[^\]]*\])?(?:\{([^{}]*)\})?/g, '$1 ')
    .replace(/[{}\\]/g, ' ');
}

function stripMarkdownSyntax(text: string) {
  return text
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`]*`/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')
    .replace(/^\s{0,3}>\s?/gm, '')
    .replace(/[*_~>#\-]+/g, ' ');
}

export function computeWritingStats(text: string, kind?: string): WritingStats {
  const normalized = text || '';
  const cleaned = kind === 'latex' ? stripLatexCommands(normalized) : stripMarkdownSyntax(normalized);
  const cjkMatches = cleaned.match(/[\u3400-\u9fff\uf900-\ufaff]/g) || [];
  const withoutCjk = cleaned.replace(/[\u3400-\u9fff\uf900-\ufaff]/g, ' ');
  const latinMatches = withoutCjk.match(/[A-Za-z0-9]+(?:[-'][A-Za-z0-9]+)*/g) || [];
  return {
    rawCharacters: normalized.length,
    cjkCharacters: cjkMatches.length,
    latinWords: latinMatches.length,
    totalWords: cjkMatches.length + latinMatches.length,
    lines: normalized.split(/\r?\n/).length,
  };
}

export function formatWritingStats(stats: WritingStats) {
  return `${stats.totalWords} 字词 · ${stats.lines} 行`;
}
