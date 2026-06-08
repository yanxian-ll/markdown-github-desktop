export type EvidenceSourceType =
  | 'markdown'
  | 'tex'
  | 'bibtex'
  | 'pdf_annotation'
  | 'review_item'
  | 'evidence_index'
  | 'note'
  | 'task';

export type AiGroundingMode = 'normal' | 'prefer_evidence' | 'evidence_only';

export type AiTaskType =
  | 'answer_question'
  | 'write_paragraph'
  | 'rewrite_text'
  | 'edit_source'
  | 'summarize_evidence'
  | 'find_missing_evidence';

export interface EvidenceCitation {
  evidenceId: string;
  label: string;
  filePath: string;
  lineStart?: number;
  lineEnd?: number;
  annotationId?: string;
  bibKey?: string;
}

export interface EvidenceItem {
  id: string;
  sourceType: EvidenceSourceType;
  filePath: string;
  title?: string;
  lineStart?: number;
  lineEnd?: number;
  charStart?: number;
  charEnd?: number;
  annotationId?: string;
  bibKey?: string;
  reviewItemId?: string;
  text: string;
  normalizedText: string;
  tags: string[];
  sectionPath?: string[];
  createdAt?: string;
  updatedAt?: string;
  contentHash: string;
  sourceHash: string;
}

export interface AiEvidencePack {
  id: string;
  mode: AiGroundingMode;
  task: AiTaskType;
  targetFile?: string;
  query: string;
  evidence: EvidenceItem[];
  createdAt: string;
}

export interface AiIndexStats {
  total: number;
  markdown: number;
  tex: number;
  bibtex: number;
  pdfAnnotation: number;
  reviewItem: number;
  evidenceIndex: number;
  indexedAt?: string;
  status: 'idle' | 'indexing' | 'ready' | 'error';
  message?: string;
}

export interface AiConversationMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  text: string;
  createdAt: string;
  taskType?: AiTaskType;
  citations?: EvidenceCitation[];
  missingEvidence?: string[];
}

export interface ProposedPatch {
  id: string;
  summary: string;
  targetFiles: string[];
  baseHashes: Record<string, string>;
  unifiedDiff: string;
  evidenceUsed: EvidenceCitation[];
  risks: string[];
  createdAt: string;
}
