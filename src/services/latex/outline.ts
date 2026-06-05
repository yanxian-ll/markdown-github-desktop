import type { LatexOutlineItem } from '../../types/latexIntelligence';
import { normalizePath } from './path';

const SECTION_LEVEL: Record<string, number> = {
  part: 0,
  chapter: 1,
  section: 2,
  subsection: 3,
  subsubsection: 4,
  paragraph: 5,
};

export function stripComments(line: string) {
  let escaped = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '\\') {
      escaped = !escaped;
      continue;
    }
    if (ch === '%' && !escaped) return line.slice(0, i);
    escaped = false;
  }
  return line;
}

export function stripLatexCommentsPreserveOffsets(content: string) {
  return content
    .split(/(\r?\n)/)
    .map((part) => {
      if (/^\r?\n$/.test(part)) return part;
      const stripped = stripComments(part);
      return stripped + ' '.repeat(Math.max(0, part.length - stripped.length));
    })
    .join('');
}

export function lineNumberAt(content: string, offset: number) {
  return content.slice(0, Math.max(0, offset)).split(/\r?\n/).length;
}

function readBalancedBraceContent(content: string, openBraceIndex: number) {
  if (content[openBraceIndex] !== '{') return undefined;
  let depth = 0;
  for (let i = openBraceIndex; i < content.length; i += 1) {
    const ch = content[i];
    if (ch === '\\') {
      i += 1;
      continue;
    }
    if (ch === '{') depth += 1;
    else if (ch === '}') {
      depth -= 1;
      if (depth === 0) {
        return { value: content.slice(openBraceIndex + 1, i), end: i + 1 };
      }
    }
  }
  return undefined;
}

function cleanLatexTitle(value: string) {
  return value
    .replace(/\\texorpdfstring\s*\{([^{}]*)\}\s*\{([^{}]*)\}/g, '$1')
    .replace(/\\[a-zA-Z*]+(?:\[[^\]]*\])?\{([^{}]*)\}/g, '$1')
    .replace(/\\[a-zA-Z*]+/g, '')
    .replace(/[{}]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function scanLatexOutline(file: string, content: string): LatexOutlineItem[] {
  const outline: LatexOutlineItem[] = [];
  const normalizedFile = normalizePath(file);
  const stripped = stripLatexCommentsPreserveOffsets(content);
  const commandRegex = /\\(part|chapter|section|subsection|subsubsection|paragraph)\*?\s*(?:\[[\s\S]*?\])?\s*\{/g;
  let match: RegExpExecArray | null;
  while ((match = commandRegex.exec(stripped))) {
    const kind = match[1] as LatexOutlineItem['kind'];
    const openBraceIndex = match.index + match[0].lastIndexOf('{');
    const parsed = readBalancedBraceContent(stripped, openBraceIndex);
    if (!parsed) continue;
    const title = cleanLatexTitle(parsed.value);
    if (title) {
      const line = lineNumberAt(stripped, match.index);
      outline.push({
        id: `${normalizedFile}:${line}:${kind}:${title}`,
        file: normalizedFile,
        line,
        level: SECTION_LEVEL[kind] ?? 2,
        kind,
        title,
        source: 'latex',
      });
    }
    commandRegex.lastIndex = Math.max(commandRegex.lastIndex, parsed.end);
  }
  return normalizeOutlineDisplayLevels(outline);
}

export function scanMarkdownOutline(file: string, content: string): LatexOutlineItem[] {
  const normalizedFile = normalizePath(file);
  const outline: LatexOutlineItem[] = [];
  const lines = content.split(/\r?\n/);
  let fenced = false;
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (/^\s*```/.test(line)) {
      fenced = !fenced;
      continue;
    }
    if (fenced) continue;
    const match = line.match(/^(#{1,6})\s+(.+?)\s*#*\s*$/);
    if (!match) continue;
    const title = match[2]
      .replace(/`([^`]+)`/g, '$1')
      .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
      .replace(/[*_~]/g, '')
      .trim();
    if (!title) continue;
    outline.push({
      id: `${normalizedFile}:${i + 1}:heading:${title}`,
      file: normalizedFile,
      line: i + 1,
      level: match[1].length,
      kind: 'heading',
      title,
      source: 'markdown',
    });
  }
  return normalizeOutlineDisplayLevels(outline);
}

export function normalizeOutlineDisplayLevels(items: LatexOutlineItem[]) {
  const minByFile = new Map<string, number>();
  for (const item of items) {
    minByFile.set(item.file, Math.min(minByFile.get(item.file) ?? item.level, item.level));
  }
  return items.map((item) => ({
    ...item,
    displayLevel: Math.max(0, item.level - (minByFile.get(item.file) ?? item.level)),
  }));
}
