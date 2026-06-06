import type { BuiltinTemplate, BuiltinTemplateFactory, TemplateFile } from './types';

export function templateFile(path: string, content: string): TemplateFile {
  return { path, content };
}

export function cloneTemplate(template: BuiltinTemplate): BuiltinTemplate {
  return {
    ...template,
    provider: template.provider ? { ...template.provider } : undefined,
    source: template.source ? { ...template.source } : undefined,
    license: template.license ? { ...template.license } : undefined,
    tags: template.tags ? [...template.tags] : undefined,
    files: template.files.map((file) => ({ ...file })),
    roadmap: template.roadmap ? [...template.roadmap] : undefined,
  };
}

export function materializeTemplate(factory: BuiltinTemplateFactory): BuiltinTemplate {
  return cloneTemplate(factory());
}

export function materializeTemplates(factories: BuiltinTemplateFactory[]): BuiltinTemplate[] {
  return factories.map((factory) => materializeTemplate(factory));
}
