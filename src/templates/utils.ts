import type { BuiltinTemplate, BuiltinTemplateFactory, TemplateFile } from './types';

export function templateFile(path: string, content: string): TemplateFile {
  return { path, content };
}

export function cloneTemplate(template: BuiltinTemplate): BuiltinTemplate {
  const official = template.official ?? !!template.source?.repository;
  return {
    ...template,
    official,
    version: template.version || 'local-v0.10.6',
    upstreamUrl: template.upstreamUrl || template.source?.repository || template.provider?.homepage,
    lastCheckedAt: template.lastCheckedAt || '2026-06-06',
    smokeTest: template.smokeTest || {
      mainFile: template.mainFile,
      requiredFiles: template.files.map((file) => file.path).filter((path) => /\.(tex|cls|sty|bst|bib|md)$/i.test(path)),
      bibliography: template.bibliography,
      expectedEngine: template.engine,
    },
    provider: template.provider ? { ...template.provider } : undefined,
    source: template.source ? { ...template.source } : undefined,
    license: template.license ? { ...template.license } : { name: 'Scholia Studio starter template; project license applies.' },
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
