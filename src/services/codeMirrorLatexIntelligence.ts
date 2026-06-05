import type { Completion, CompletionContext, CompletionResult } from '@codemirror/autocomplete';
import type { BibEntryItem, ProjectLatexIndex } from '../types/latexIntelligence';

const CITE_COMMANDS = new Set(['cite', 'citep', 'citet', 'citealp', 'citeauthor', 'citeyear', 'autocite', 'parencite', 'textcite']);
const REF_COMMANDS = new Set(['ref', 'eqref', 'pageref', 'autoref', 'cref', 'Cref', 'vref']);
const INPUT_COMMANDS = new Set(['input', 'include', 'subfile']);

export interface LatexCommandArgumentContext {
  command: string;
  from: number;
  to: number;
  query: string;
  lineFrom: number;
}

function displayAuthors(entry: BibEntryItem) {
  if (!entry.author) return undefined;
  const first = entry.author.split(/\s+and\s+/i)[0]?.trim();
  if (!first) return entry.author;
  const last = first.includes(',') ? first.split(',')[0] : first.split(/\s+/).pop();
  const suffix = entry.author.includes(' and ') ? ' et al.' : '';
  return `${last}${suffix}`;
}

function completionBoost(query: string, value: string) {
  const q = query.toLowerCase();
  const v = value.toLowerCase();
  if (!q) return 0;
  if (v.startsWith(q)) return 99;
  if (v.includes(q)) return 50;
  return 0;
}

export function commandArgumentContext(context: CompletionContext | { state: CompletionContext['state']; pos: number }): LatexCommandArgumentContext | null {
  const line = context.state.doc.lineAt(context.pos);
  const before = line.text.slice(0, context.pos - line.from);
  const commandMatch = before.match(/\\([A-Za-z]+)\*?(?:\[[^\]]*\])?\s*\{([^{}]*)$/);
  if (!commandMatch) return null;
  const command = commandMatch[1];
  const query = commandMatch[2] || '';
  const from = context.pos - query.length;
  return { command, from, to: context.pos, query, lineFrom: line.from };
}

export function latexCompletionSource(indexRef: () => ProjectLatexIndex | undefined) {
  return (context: CompletionContext): CompletionResult | null => {
    const index = indexRef();
    if (!index) return null;
    const commandContext = commandArgumentContext(context);
    if (!commandContext) return null;
    const { command, from, query } = commandContext;
    let options: Completion[] = [];

    if (CITE_COMMANDS.has(command)) {
      options = index.citations.map((entry) => {
        const author = displayAuthors(entry);
        const detail = [author, entry.year].filter(Boolean).join(', ');
        const infoLines = [
          entry.title ? `Title: ${entry.title}` : undefined,
          entry.author ? `Author: ${entry.author}` : undefined,
          entry.year ? `Year: ${entry.year}` : undefined,
          entry.journal || entry.booktitle ? `Source: ${entry.journal || entry.booktitle}` : undefined,
          `${entry.file}:${entry.line}`,
        ].filter(Boolean);
        return {
          label: entry.key,
          type: 'constant',
          detail: detail || entry.type,
          info: infoLines.join('\n'),
          boost: completionBoost(query, `${entry.key} ${entry.title || ''} ${entry.author || ''}`),
        };
      });
    } else if (REF_COMMANDS.has(command)) {
      options = index.labels.map((label) => ({
        label: label.key,
        type: 'reference',
        detail: `${label.kind} · ${label.file}:${label.line}`,
        info: label.context || `${label.file}:${label.line}`,
        boost: completionBoost(query, `${label.key} ${label.context || ''}`),
      }));
    } else if (INPUT_COMMANDS.has(command)) {
      options = index.texFiles.map((file) => ({
        label: file.path.replace(/\.(tex|ltx)$/i, ''),
        type: 'file',
        detail: file.path,
        boost: completionBoost(query, file.path),
      }));
    } else if (command === 'includegraphics') {
      options = index.imageFiles.map((file) => ({
        label: file.path,
        type: 'file',
        detail: file.title,
        boost: completionBoost(query, file.path),
      }));
    } else if (command === 'label') {
      options = [
        { label: 'sec:', type: 'keyword', detail: 'section label prefix' },
        { label: 'fig:', type: 'keyword', detail: 'figure label prefix' },
        { label: 'tab:', type: 'keyword', detail: 'table label prefix' },
        { label: 'eq:', type: 'keyword', detail: 'equation label prefix' },
        { label: 'alg:', type: 'keyword', detail: 'algorithm label prefix' },
      ];
    }

    if (!options.length) return null;
    return {
      from,
      options,
      validFor: /^[^{}]*$/,
    };
  };
}

export function commandArgumentAtText(lineText: string, oneBasedColumn: number): LatexCommandArgumentContext | null {
  const cursor = Math.max(0, oneBasedColumn - 1);
  const before = lineText.slice(0, cursor);
  const match = before.match(/\\([A-Za-z]+)\*?(?:\[[^\]]*\])?\s*\{([^{}]*)$/);
  if (!match) return null;
  const closeIndex = lineText.indexOf('}', cursor);
  const commandStart = before.lastIndexOf(`\\${match[1]}`);
  const command = match[1];
  const queryStart = cursor - (match[2] || '').length;
  const queryEnd = closeIndex >= 0 ? closeIndex : cursor;
  const query = lineText.slice(queryStart, queryEnd);
  return { command, from: queryStart, to: queryEnd, query, lineFrom: 0 };
}

export function splitLatexArgumentKeys(argument: string) {
  return argument
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

export { CITE_COMMANDS, REF_COMMANDS, INPUT_COMMANDS };
