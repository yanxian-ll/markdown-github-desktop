export interface TemplateFile {
  path: string;
  content: string;
}

export type TemplateKind = 'latex' | 'markdown' | 'beamer';

export interface TemplateProvider {
  id: string;
  name: string;
  description?: string;
  homepage?: string;
}

export interface TemplateSource {
  repository?: string;
  upstreamPath?: string;
  documentation?: string;
  note?: string;
}

export interface TemplateLicense {
  name: string;
  url?: string;
}

export interface BuiltinTemplate {
  id: string;
  name: string;
  kind: TemplateKind;
  description: string;
  mainFile: string;
  engine?: string;
  bibliography?: string;
  provider?: TemplateProvider;
  source?: TemplateSource;
  license?: TemplateLicense;
  tags?: string[];
  files: TemplateFile[];
  roadmap?: string[];
}

export type BuiltinTemplateFactory = () => BuiltinTemplate;
