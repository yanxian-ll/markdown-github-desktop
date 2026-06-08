import type { PluginApiDescriptor } from '../types/app';

export const pluginApiDraft: PluginApiDescriptor = {
  version: '0.1-draft',
  extensionPoints: ['fileIndex', 'editorCommand', 'previewExtension', 'exportProfile'],
  manifestExample: JSON.stringify({
    id: 'example.preview-extension',
    name: 'Example Preview Extension',
    version: '0.1.0',
    scholia: '>=0.10.16',
    contributes: {
      fileIndex: [{ match: '**/*.md', kind: 'evidence' }],
      editorCommand: [{ id: 'example.insert', title: 'Insert Example' }],
      previewExtension: [{ language: 'plotly', renderer: 'renderPlotly' }],
      exportProfile: [{ id: 'journal-docx', format: 'docx' }],
    },
  }, null, 2),
};
