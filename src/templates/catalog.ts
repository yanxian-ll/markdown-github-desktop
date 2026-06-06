import type { BuiltinTemplate, BuiltinTemplateFactory } from './types';
import { materializeTemplate, materializeTemplates } from './utils';
import { createBasicLatexTemplate } from './builtin/basicLatex';
import { createMarkdownPandocTemplate } from './builtin/markdownPandoc';
import { createBeamerTemplate } from './builtin/beamer';
import { createCsuThesisTemplate } from './builtin/csuthesis';
import {
  createIeeeTgrsTemplate,
  createIsprsFullPaperTemplate,
  createRemoteSensingOfEnvironmentTemplate,
} from './builtin/remoteSensing';

interface BuiltinTemplateRegistration {
  id: string;
  factory: BuiltinTemplateFactory;
}

const BUILTIN_TEMPLATE_REGISTRY: BuiltinTemplateRegistration[] = [
  { id: 'csu-thesis-graduate', factory: createCsuThesisTemplate },
  { id: 'isprs-archives-annals-full-paper', factory: createIsprsFullPaperTemplate },
  { id: 'ieee-transactions-geoscience-remote-sensing', factory: createIeeeTgrsTemplate },
  { id: 'elsevier-remote-sensing-of-environment', factory: createRemoteSensingOfEnvironmentTemplate },
  { id: 'latex-basic-paper', factory: createBasicLatexTemplate },
  { id: 'markdown-pandoc-paper', factory: createMarkdownPandocTemplate },
  { id: 'beamer-basic', factory: createBeamerTemplate },
];

const BUILTIN_TEMPLATE_FACTORIES = BUILTIN_TEMPLATE_REGISTRY.map((item) => item.factory);

export const BUILTIN_TEMPLATES: BuiltinTemplate[] = materializeTemplates(BUILTIN_TEMPLATE_FACTORIES);

export function getBuiltinTemplate(templateId: string): BuiltinTemplate | undefined {
  const registration = BUILTIN_TEMPLATE_REGISTRY.find((item) => item.id === templateId);
  return registration ? materializeTemplate(registration.factory) : undefined;
}

export function listBuiltinTemplateFactories(): BuiltinTemplateFactory[] {
  return [...BUILTIN_TEMPLATE_FACTORIES];
}
