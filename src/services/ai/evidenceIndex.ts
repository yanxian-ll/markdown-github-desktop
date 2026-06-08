import type { MarkdownDocument, PaperAnnotation } from '../../types/app';
import type { AiEvidencePack, AiGroundingMode, AiIndexStats, AiTaskType, EvidenceItem } from '../../types/ai';
import { makeId } from '../hash';

export function createEmptyAiIndexStats(): AiIndexStats {
  return {
    total: 0,
    markdown: 0,
    tex: 0,
    bibtex: 0,
    pdfAnnotation: 0,
    reviewItem: 0,
    evidenceIndex: 0,
    status: 'idle',
    message: '尚未建立本地证据索引。',
  };
}

function normalizeEvidenceText(text: string) {
  return text.replace(/\s+/g, ' ').trim().toLowerCase();
}

function simpleHash(text: string) {
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16);
}

function sourceTypeFromDocument(doc: MarkdownDocument): EvidenceItem['sourceType'] | undefined {
  if (doc.kind === 'markdown') return doc.relativePath?.includes('evidence-index') ? 'evidence_index' : 'markdown';
  if (doc.kind === 'latex') return 'tex';
  if (doc.kind === 'bibtex') return 'bibtex';
  return undefined;
}

export function buildDocumentEvidenceSeed(doc?: MarkdownDocument | null): EvidenceItem[] {
  const sourceType = doc ? sourceTypeFromDocument(doc) : undefined;
  if (!doc || !sourceType) return [];
  const preview = doc.text.split('\n').slice(0, 24).join('\n').trim();
  if (!preview) return [];
  const filePath = doc.relativePath || doc.title;
  return [
    {
      id: `seed_${simpleHash(`${filePath}:${preview}`)}`,
      sourceType,
      filePath,
      title: doc.title,
      lineStart: 1,
      lineEnd: Math.min(24, doc.text.split('\n').length),
      text: preview,
      normalizedText: normalizeEvidenceText(preview),
      tags: ['active-document', 'seed'],
      updatedAt: new Date(doc.updatedAt || Date.now()).toISOString(),
      contentHash: simpleHash(preview),
      sourceHash: simpleHash(`${filePath}:${doc.updatedAt || 0}`),
    },
  ];
}

export function buildAnnotationEvidenceSeed(annotations: PaperAnnotation[], activePath?: string): EvidenceItem[] {
  return annotations
    .filter((annotation) => {
      const filePath = annotation.documentPath || annotation.markdownAnchor?.file || annotation.texAnchor?.file || annotation.pdfAnchor?.pdfPath || activePath || '';
      return !activePath || filePath === activePath || filePath.endsWith(activePath) || activePath.endsWith(filePath);
    })
    .slice(0, 8)
    .map((annotation) => {
      const messages = annotation.messages || [];
      const text = messages.map((message) => message.body).filter(Boolean).join('\n').trim() || annotation.body || annotation.selectedText || annotation.sourceText || annotation.id;
      const filePath = annotation.documentPath || annotation.markdownAnchor?.file || annotation.texAnchor?.file || annotation.pdfAnchor?.pdfPath || activePath || 'annotations';
      return {
        id: `ann_${annotation.id}`,
        sourceType: 'pdf_annotation' as const,
        filePath,
        title: annotation.selectedText?.slice(0, 80) || annotation.sourceText?.slice(0, 80) || 'PDF 批注',
        annotationId: annotation.id,
        text,
        normalizedText: normalizeEvidenceText(text),
        tags: ['annotation', annotation.status || 'open'],
        createdAt: annotation.createdAt,
        updatedAt: annotation.updatedAt,
        contentHash: simpleHash(text),
        sourceHash: simpleHash(`${filePath}:${annotation.id}:${annotation.updatedAt || ''}`),
      };
    });
}

export function createEvidencePack(params: {
  mode: AiGroundingMode;
  task: AiTaskType;
  query: string;
  targetFile?: string;
  evidence: EvidenceItem[];
}): AiEvidencePack {
  return {
    id: makeId(),
    mode: params.mode,
    task: params.task,
    query: params.query,
    targetFile: params.targetFile,
    evidence: params.evidence,
    createdAt: new Date().toISOString(),
  };
}
