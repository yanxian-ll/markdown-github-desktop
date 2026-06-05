import type { FileNode } from '../types/app';
import type {
  BibEntryItem,
  LatexDiagnosticItem,
  LatexGraphicRef,
  LatexIndexedFile,
  LatexInputRef,
  LatexLabelItem,
  LatexLabelKind,
  ProjectLatexIndex,
} from '../types/latexIntelligence';
import { emptyLatexIndex } from '../types/latexIntelligence';
import { baseName, dirName, extension, joinPath, normalizePath, withoutKnownImageExtension, withoutTexExtension } from './latex/path';
import { lineNumberAt, normalizeOutlineDisplayLevels, scanLatexOutline, scanMarkdownOutline, stripComments } from './latex/outline';
import { buildLatexDependencyEdges, enrichInputReferences, orderTexFilesByDependency } from './latex/dependencyGraph';

const TEX_EXTENSIONS = new Set(['tex', 'ltx']);
const MARKDOWN_EXTENSIONS = new Set(['md', 'markdown', 'mdown', 'mkd']);
const BIB_EXTENSIONS = new Set(['bib']);
const IMAGE_EXTENSIONS = new Set(['pdf', 'png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'eps']);

const REF_COMMANDS = new Set(['ref', 'eqref', 'pageref', 'autoref', 'cref', 'Cref', 'vref']);
const CITE_COMMANDS = new Set(['cite', 'citep', 'citet', 'citealp', 'citeauthor', 'citeyear', 'autocite', 'parencite', 'textcite']);

interface LatexReferenceUse {
  key: string;
  file: string;
  line: number;
  column: number;
  command: string;
}

interface LatexCitationUse extends LatexReferenceUse {}


function guessLabelKind(lines: string[], lineIndex: number): LatexLabelKind {
  const start = Math.max(0, lineIndex - 12);
  const end = Math.min(lines.length, lineIndex + 4);
  const context = lines.slice(start, end).join('\n').toLowerCase();
  if (/\\begin\s*\{figure\*?\}/.test(context)) return 'figure';
  if (/\\begin\s*\{table\*?\}/.test(context)) return 'table';
  if (/\\begin\s*\{(?:equation|align|gather|multline|eqnarray)\*?\}/.test(context)) return 'equation';
  if (/\\begin\s*\{algorithm\*?\}/.test(context)) return 'algorithm';
  if (/\\begin\s*\{(?:lstlisting|minted)\}/.test(context)) return 'listing';
  if (/\\(?:part|chapter|section|subsection|subsubsection|paragraph)\*?\s*(?:\[[^\]]*\])?\s*\{/.test(context)) return 'section';
  return 'unknown';
}

function normalizeRootDirective(rootValue: string, file: string) {
  const trimmed = rootValue.trim().replace(/^['"]|['"]$/g, '');
  if (!trimmed) return undefined;
  return normalizePath(trimmed.startsWith('/') ? trimmed : joinPath(dirName(file), trimmed));
}

function scanTexFile(file: string, content: string) {
  const labels: LatexLabelItem[] = [];
  const inputs: LatexInputRef[] = [];
  const graphics: LatexGraphicRef[] = [];
  const refs: LatexReferenceUse[] = [];
  const cites: LatexCitationUse[] = [];
  let rootFile: string | undefined;
  const lines = content.split(/\r?\n/);

  for (let i = 0; i < lines.length; i += 1) {
    const rawLine = lines[i];
    const rootMatch = rawLine.match(/^\s*%\s*!TEX\s+root\s*=\s*(.+?)\s*$/i);
    if (rootMatch) rootFile = normalizeRootDirective(rootMatch[1], file);

    const line = stripComments(rawLine);
    const lineNumber = i + 1;

    for (const match of line.matchAll(/\\label\s*\{([^{}]+)\}/g)) {
      labels.push({
        key: match[1],
        file,
        line: lineNumber,
        column: (match.index ?? 0) + 1,
        kind: guessLabelKind(lines, i),
        context: rawLine.trim(),
      });
    }

    for (const match of line.matchAll(/\\(input|include|subfile)\s*\{([^{}]+)\}/g)) {
      inputs.push({
        path: normalizePath(match[2]),
        file,
        line: lineNumber,
        command: match[1] as LatexInputRef['command'],
      });
    }

    for (const match of line.matchAll(/\\includegraphics\s*(?:\[[^\]]*\])?\s*\{([^{}]+)\}/g)) {
      graphics.push({ path: normalizePath(match[1]), file, line: lineNumber });
    }

    for (const match of line.matchAll(/\\([A-Za-z]+)\*?(?:\[[^\]]*\])?\s*\{([^{}]+)\}/g)) {
      const command = match[1];
      const rawArgument = match[2] || '';
      const column = (match.index ?? 0) + 1;
      if (REF_COMMANDS.has(command)) {
        rawArgument.split(',').map((item) => item.trim()).filter(Boolean).forEach((key) => {
          refs.push({ key, file, line: lineNumber, column, command });
        });
      } else if (CITE_COMMANDS.has(command)) {
        rawArgument.split(',').map((item) => item.trim()).filter(Boolean).forEach((key) => {
          cites.push({ key, file, line: lineNumber, column, command });
        });
      }
    }
  }

  return { labels, inputs, graphics, refs, cites, outline: scanLatexOutline(file, content), rootFile };
}

function fieldFromBibBody(body: string, field: string) {
  const regex = new RegExp(`${field}\\s*=\\s*(?:\\{((?:[^{}]|\\{[^{}]*\\})*)\\}|"([^"]*)")`, 'i');
  const match = body.match(regex);
  const value = match?.[1] ?? match?.[2];
  return value?.replace(/[{}]/g, '').replace(/\s+/g, ' ').trim();
}

function findEntryEnd(content: string, start: number) {
  const openIndex = content.indexOf('{', start);
  if (openIndex < 0) return -1;
  let depth = 0;
  for (let i = openIndex; i < content.length; i += 1) {
    const ch = content[i];
    if (ch === '{') depth += 1;
    if (ch === '}') depth -= 1;
    if (depth === 0) return i + 1;
  }
  return -1;
}

function scanBibFile(file: string, content: string): BibEntryItem[] {
  const items: BibEntryItem[] = [];
  const entryRegex = /@([a-zA-Z]+)\s*\{\s*([^,\s{}]+)\s*,/g;
  let match: RegExpExecArray | null;
  while ((match = entryRegex.exec(content))) {
    const start = match.index;
    const end = findEntryEnd(content, start);
    if (end < 0) continue;
    const raw = content.slice(start, end);
    const bodyStart = raw.indexOf(',');
    const body = bodyStart >= 0 ? raw.slice(bodyStart + 1) : raw;
    items.push({
      key: match[2],
      type: match[1].toLowerCase(),
      file,
      line: lineNumberAt(content, start),
      title: fieldFromBibBody(body, 'title'),
      author: fieldFromBibBody(body, 'author'),
      year: fieldFromBibBody(body, 'year'),
      journal: fieldFromBibBody(body, 'journal'),
      booktitle: fieldFromBibBody(body, 'booktitle'),
      raw,
    });
    entryRegex.lastIndex = end;
  }
  return items;
}

export function flattenFileTree(nodes: FileNode[]): FileNode[] {
  const result: FileNode[] = [];
  const visit = (node: FileNode) => {
    result.push(node);
    node.children.forEach(visit);
  };
  nodes.forEach(visit);
  return result;
}

export function classifyLatexFiles(nodes: FileNode[]) {
  const texFiles: LatexIndexedFile[] = [];
  const bibFiles: LatexIndexedFile[] = [];
  const imageFiles: LatexIndexedFile[] = [];
  const markdownFiles: LatexIndexedFile[] = [];

  for (const node of flattenFileTree(nodes)) {
    if (node.kind !== 'file') continue;
    const ext = extension(node.path);
    const base = { path: normalizePath(node.path), title: baseName(node.path) };
    if (TEX_EXTENSIONS.has(ext)) texFiles.push({ ...base, kind: 'tex' });
    else if (BIB_EXTENSIONS.has(ext)) bibFiles.push({ ...base, kind: 'bib' });
    else if (IMAGE_EXTENSIONS.has(ext)) imageFiles.push({ ...base, kind: 'image' });
    else if (MARKDOWN_EXTENSIONS.has(ext)) markdownFiles.push({ ...base, kind: 'markdown' });
  }

  return {
    texFiles: texFiles.sort((a, b) => a.path.localeCompare(b.path)),
    bibFiles: bibFiles.sort((a, b) => a.path.localeCompare(b.path)),
    imageFiles: imageFiles.sort((a, b) => a.path.localeCompare(b.path)),
    markdownFiles: markdownFiles.sort((a, b) => a.path.localeCompare(b.path)),
  };
}

function addOpenBuffersToIndex(index: ProjectLatexIndex, activeTextByPath?: Map<string, string>) {
  for (const [path] of activeTextByPath ?? new Map<string, string>()) {
    const normalized = normalizePath(path);
    const ext = extension(normalized);
    const item = { path: normalized, title: baseName(normalized) };
    if (TEX_EXTENSIONS.has(ext) && !index.texFiles.some((file) => file.path === normalized)) {
      index.texFiles.push({ ...item, kind: 'tex' });
    } else if (BIB_EXTENSIONS.has(ext) && !index.bibFiles.some((file) => file.path === normalized)) {
      index.bibFiles.push({ ...item, kind: 'bib' });
    } else if (MARKDOWN_EXTENSIONS.has(ext) && !index.markdownFiles.some((file) => file.path === normalized)) {
      index.markdownFiles.push({ ...item, kind: 'markdown' });
    }
  }
}

function resolveRootFile(rootFile: string | undefined, texFiles: LatexIndexedFile[]) {
  if (!rootFile) return undefined;
  const normalized = normalizePath(rootFile);
  const candidates = new Set([normalized, `${normalized}.tex`, withoutTexExtension(normalized)]);
  return texFiles.find((file) => candidates.has(file.path) || candidates.has(withoutTexExtension(file.path)))?.path || normalized;
}

function unique<T>(items: T[], keyOf: (item: T) => string) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = keyOf(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function duplicateDiagnostics<T extends { key: string; file: string; line: number }>(
  items: T[],
  code: 'duplicate-label' | 'duplicate-bib-key',
  label: string,
): LatexDiagnosticItem[] {
  const groups = new Map<string, T[]>();
  for (const item of items) groups.set(item.key, [...(groups.get(item.key) || []), item]);
  const diagnostics: LatexDiagnosticItem[] = [];
  for (const [key, group] of groups) {
    if (group.length < 2) continue;
    const related = group.map((item) => ({ file: item.file, line: item.line, message: `${label} “${key}” 的定义位置` }));
    for (const item of group) {
      diagnostics.push({
        id: `${code}:${item.file}:${item.line}:${key}`,
        severity: 'warning',
        code,
        file: item.file,
        line: item.line,
        target: key,
        message: `重复的 ${label}：${key}`,
        related,
      });
    }
  }
  return diagnostics;
}

function buildLatexDiagnostics(options: {
  refs: LatexReferenceUse[];
  cites: LatexCitationUse[];
  labels: LatexLabelItem[];
  citations: BibEntryItem[];
  inputs: LatexInputRef[];
  graphics: LatexGraphicRef[];
}): LatexDiagnosticItem[] {
  const labelKeys = new Set(options.labels.map((item) => item.key));
  const citationKeys = new Set(options.citations.map((item) => item.key));
  const diagnostics: LatexDiagnosticItem[] = [];

  for (const ref of options.refs) {
    if (!labelKeys.has(ref.key)) {
      diagnostics.push({
        id: `missing-label:${ref.file}:${ref.line}:${ref.key}`,
        severity: 'error',
        code: 'missing-label',
        file: ref.file,
        line: ref.line,
        column: ref.column,
        target: ref.key,
        message: `未找到引用标签：${ref.key}`,
      });
    }
  }

  for (const cite of options.cites) {
    if (!citationKeys.has(cite.key)) {
      diagnostics.push({
        id: `missing-citation:${cite.file}:${cite.line}:${cite.key}`,
        severity: 'warning',
        code: 'missing-citation',
        file: cite.file,
        line: cite.line,
        column: cite.column,
        target: cite.key,
        message: `未找到 BibTeX 条目：${cite.key}`,
      });
    }
  }

  for (const input of options.inputs) {
    if (input.missing) {
      diagnostics.push({
        id: `missing-input:${input.file}:${input.line}:${input.path}`,
        severity: 'error',
        code: 'missing-input',
        file: input.file,
        line: input.line,
        target: input.path,
        message: `未找到 ${input.command} 文件：${input.path}`,
      });
    }
  }

  for (const graphic of options.graphics) {
    if (graphic.missing) {
      diagnostics.push({
        id: `missing-graphic:${graphic.file}:${graphic.line}:${graphic.path}`,
        severity: 'warning',
        code: 'missing-graphic',
        file: graphic.file,
        line: graphic.line,
        target: graphic.path,
        message: `未找到图片文件：${graphic.path}`,
      });
    }
  }

  diagnostics.push(...duplicateDiagnostics(options.labels, 'duplicate-label', 'label'));
  diagnostics.push(...duplicateDiagnostics(options.citations, 'duplicate-bib-key', 'BibTeX key'));
  return diagnostics.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line || a.message.localeCompare(b.message));
}

export function resolveGraphicPath(rawPath: string, sourceFile: string | undefined, imageFiles: LatexIndexedFile[]) {
  const normalized = normalizePath(rawPath);
  const sourceDir = sourceFile ? dirName(sourceFile) : '';
  const baseCandidates = [normalized];
  if (sourceDir) {
    baseCandidates.push(joinPath(sourceDir, normalized));
    // Many paper templates keep graphics in a figure/ or figures/ directory
    // next to the current .tex file. Support \includegraphics{foo} in
    // chapters/method.tex -> chapters/figure/foo.png and chapters/figures/foo.png.
    if (!/^figures?\//i.test(normalized)) {
      baseCandidates.push(joinPath(joinPath(sourceDir, 'figure'), normalized));
      baseCandidates.push(joinPath(joinPath(sourceDir, 'figures'), normalized));
    }
  }
  if (!/^figures?\//i.test(normalized)) {
    baseCandidates.push(joinPath('figure', normalized));
    baseCandidates.push(joinPath('figures', normalized));
  }

  const candidates = new Set<string>();
  for (const candidate of baseCandidates) {
    candidates.add(candidate);
    candidates.add(withoutKnownImageExtension(candidate));
  }
  return imageFiles.find((file) => candidates.has(file.path) || candidates.has(withoutKnownImageExtension(file.path)))?.path;
}

export async function buildProjectLatexIndex(options: {
  fileTree: FileNode[];
  readFile: (relativePath: string) => Promise<string>;
  activeTextByPath?: Map<string, string>;
}): Promise<ProjectLatexIndex> {
  const index = emptyLatexIndex();
  Object.assign(index, classifyLatexFiles(options.fileTree));
  addOpenBuffersToIndex(index, options.activeTextByPath);
  const refs: LatexReferenceUse[] = [];
  const cites: LatexCitationUse[] = [];

  index.texFiles = unique(index.texFiles, (file) => file.path).sort((a, b) => a.path.localeCompare(b.path));
  index.bibFiles = unique(index.bibFiles, (file) => file.path).sort((a, b) => a.path.localeCompare(b.path));
  index.imageFiles = unique(index.imageFiles, (file) => file.path).sort((a, b) => a.path.localeCompare(b.path));
  index.markdownFiles = unique(index.markdownFiles, (file) => file.path).sort((a, b) => a.path.localeCompare(b.path));

  for (const file of index.texFiles) {
    try {
      const content = options.activeTextByPath?.get(file.path) ?? (await options.readFile(file.path));
      const scanned = scanTexFile(file.path, content);
      index.labels.push(...scanned.labels);
      index.inputs.push(...scanned.inputs);
      index.graphics.push(...scanned.graphics);
      refs.push(...scanned.refs);
      cites.push(...scanned.cites);
      index.outline.push(...scanned.outline);
      if (scanned.rootFile) index.rootFile = resolveRootFile(scanned.rootFile, index.texFiles);
    } catch {
      // Unreadable files should not block the editor.
    }
  }

  for (const file of index.markdownFiles) {
    try {
      const content = options.activeTextByPath?.get(file.path) ?? (await options.readFile(file.path));
      index.outline.push(...scanMarkdownOutline(file.path, content));
    } catch {
      // Ignore unreadable Markdown files.
    }
  }

  for (const file of index.bibFiles) {
    try {
      const content = options.activeTextByPath?.get(file.path) ?? (await options.readFile(file.path));
      index.citations.push(...scanBibFile(file.path, content));
    } catch {
      // Ignore unreadable .bib files.
    }
  }

  if (!index.rootFile) {
    index.rootFile = index.texFiles.find((file) => /(^|\/)main\.tex$/i.test(file.path))?.path || index.texFiles[0]?.path;
  }

  index.inputs = enrichInputReferences(index.inputs, index.texFiles);
  index.dependencies = buildLatexDependencyEdges(index.inputs, index.texFiles);
  index.graphics = index.graphics.map((graphic) => {
    const resolvedPath = resolveGraphicPath(graphic.path, graphic.file, index.imageFiles);
    return { ...graphic, resolvedPath, missing: !resolvedPath };
  });

  index.diagnostics = buildLatexDiagnostics({
    refs,
    cites,
    labels: index.labels,
    citations: index.citations,
    inputs: index.inputs,
    graphics: index.graphics,
  });

  const texOrder = orderTexFilesByDependency(index.rootFile, index.texFiles, index.dependencies);
  const fileOrder = new Map<string, number>();
  [...texOrder, ...index.markdownFiles.map((file) => file.path).sort((a, b) => a.localeCompare(b))].forEach((file, indexInOrder) => {
    if (!fileOrder.has(file)) fileOrder.set(file, indexInOrder);
  });

  index.labels = unique(index.labels, (item) => `${item.file}:${item.key}`).sort((a, b) => a.key.localeCompare(b.key));
  index.citations = unique(index.citations, (item) => item.key).sort((a, b) => a.key.localeCompare(b.key));
  index.outline = normalizeOutlineDisplayLevels(index.outline).sort(
    (a, b) => (fileOrder.get(a.file) ?? 9999) - (fileOrder.get(b.file) ?? 9999) || a.line - b.line,
  );
  index.updatedAt = Date.now();
  return index;
}

export function resolveTexLikePath(inputPath: string, texFiles: LatexIndexedFile[]) {
  const normalized = normalizePath(inputPath);
  const candidates = new Set([normalized, `${normalized}.tex`, withoutTexExtension(normalized)]);
  return texFiles.find((file) => candidates.has(file.path) || candidates.has(withoutTexExtension(file.path)))?.path;
}

export function resolveIndexedFilePath(inputPath: string, index: ProjectLatexIndex, sourceFile?: string) {
  const tex = resolveTexLikePath(inputPath, index.texFiles);
  if (tex) return tex;
  const image = resolveGraphicPath(inputPath, sourceFile, index.imageFiles);
  if (image) return image;
  const normalized = normalizePath(inputPath);
  return normalized;
}
