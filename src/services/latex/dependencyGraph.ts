import type { LatexDependencyEdge, LatexIndexedFile, LatexInputRef } from '../../types/latexIntelligence';
import { dirName, joinPath, normalizePath, withoutTexExtension } from './path';

function resolveRelativeTexPath(rawPath: string, sourceFile: string, texFiles: LatexIndexedFile[]) {
  const normalized = normalizePath(rawPath);
  const sourceDir = dirName(sourceFile);
  const candidates = new Set<string>([
    normalized,
    `${normalized}.tex`,
    withoutTexExtension(normalized),
    joinPath(sourceDir, normalized),
    joinPath(sourceDir, `${normalized}.tex`),
    withoutTexExtension(joinPath(sourceDir, normalized)),
  ]);
  return texFiles.find((file) => candidates.has(file.path) || candidates.has(withoutTexExtension(file.path)))?.path;
}

export function enrichInputReferences(inputs: LatexInputRef[], texFiles: LatexIndexedFile[]) {
  return inputs.map((input) => {
    const resolvedPath = resolveRelativeTexPath(input.path, input.file, texFiles);
    return {
      ...input,
      resolvedPath,
      missing: !resolvedPath,
    };
  });
}

export function buildLatexDependencyEdges(inputs: LatexInputRef[], texFiles: LatexIndexedFile[]): LatexDependencyEdge[] {
  const enriched = enrichInputReferences(inputs, texFiles);
  return enriched.map((input) => ({
    id: `${input.file}:${input.line}:${input.command}:${input.path}`,
    source: input.file,
    target: input.resolvedPath,
    rawTarget: input.path,
    line: input.line,
    command: input.command,
    missing: !!input.missing,
  }));
}

export function orderTexFilesByDependency(rootFile: string | undefined, texFiles: LatexIndexedFile[], edges: LatexDependencyEdge[]) {
  if (!rootFile) return texFiles.map((file) => file.path);
  const adjacency = new Map<string, string[]>();
  for (const edge of edges) {
    if (!edge.target || edge.missing) continue;
    const list = adjacency.get(edge.source) ?? [];
    list.push(edge.target);
    adjacency.set(edge.source, list);
  }
  const ordered: string[] = [];
  const seen = new Set<string>();
  const visit = (file: string) => {
    if (seen.has(file)) return;
    seen.add(file);
    ordered.push(file);
    for (const child of adjacency.get(file) ?? []) visit(child);
  };
  visit(rootFile);
  for (const file of texFiles.map((item) => item.path).sort((a, b) => a.localeCompare(b))) visit(file);
  return ordered;
}
