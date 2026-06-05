export interface LatexIndexedFile {
  path: string;
  title: string;
  kind: 'tex' | 'bib' | 'image' | 'markdown';
}

export type LatexLabelKind =
  | 'section'
  | 'figure'
  | 'table'
  | 'equation'
  | 'algorithm'
  | 'listing'
  | 'unknown';

export interface LatexLabelItem {
  key: string;
  file: string;
  line: number;
  column: number;
  kind: LatexLabelKind;
  context?: string;
}

export interface BibEntryItem {
  key: string;
  type: string;
  file: string;
  line: number;
  title?: string;
  author?: string;
  year?: string;
  journal?: string;
  booktitle?: string;
  raw?: string;
}

export interface LatexInputRef {
  path: string;
  file: string;
  line: number;
  command: 'input' | 'include' | 'subfile';
  resolvedPath?: string;
  missing?: boolean;
}

export interface LatexGraphicRef {
  path: string;
  file: string;
  line: number;
  resolvedPath?: string;
  missing?: boolean;
}

export type OutlineSource = 'latex' | 'markdown';

export interface LatexOutlineItem {
  id: string;
  file: string;
  line: number;
  level: number;
  displayLevel?: number;
  kind: 'part' | 'chapter' | 'section' | 'subsection' | 'subsubsection' | 'paragraph' | 'heading';
  title: string;
  source?: OutlineSource;
}

export interface LatexDependencyEdge {
  id: string;
  source: string;
  target?: string;
  rawTarget: string;
  line: number;
  command: LatexInputRef['command'];
  missing: boolean;
}


export type LatexDiagnosticSeverity = 'error' | 'warning';

export interface LatexDiagnosticItem {
  id: string;
  severity: LatexDiagnosticSeverity;
  code:
    | 'missing-label'
    | 'missing-citation'
    | 'missing-input'
    | 'missing-graphic'
    | 'duplicate-label'
    | 'duplicate-bib-key';
  file: string;
  line: number;
  column?: number;
  message: string;
  target?: string;
  related?: Array<{ file: string; line: number; message?: string }>;
}

export interface ProjectLatexIndex {
  rootFile?: string;
  texFiles: LatexIndexedFile[];
  bibFiles: LatexIndexedFile[];
  imageFiles: LatexIndexedFile[];
  markdownFiles: LatexIndexedFile[];
  labels: LatexLabelItem[];
  citations: BibEntryItem[];
  inputs: LatexInputRef[];
  graphics: LatexGraphicRef[];
  outline: LatexOutlineItem[];
  dependencies: LatexDependencyEdge[];
  diagnostics: LatexDiagnosticItem[];
  updatedAt: number;
}

export function emptyLatexIndex(): ProjectLatexIndex {
  return {
    texFiles: [],
    bibFiles: [],
    imageFiles: [],
    markdownFiles: [],
    labels: [],
    citations: [],
    inputs: [],
    graphics: [],
    outline: [],
    dependencies: [],
    diagnostics: [],
    updatedAt: Date.now(),
  };
}
