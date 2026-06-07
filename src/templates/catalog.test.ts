import { describe, expect, it } from 'vitest';
import { BUILTIN_TEMPLATES } from './catalog';

describe('built-in template catalog', () => {
  it('declares source/license/verification metadata and smoke-test inputs', () => {
    expect(BUILTIN_TEMPLATES.length).toBeGreaterThan(0);
    for (const template of BUILTIN_TEMPLATES) {
      expect(template.id).toBeTruthy();
      expect(template.mainFile).toBeTruthy();
      expect(template.license?.name).toBeTruthy();
      expect(template.lastCheckedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(template.smokeTest?.mainFile).toBe(template.mainFile);
      expect(template.files.some((file) => file.path === template.mainFile)).toBe(true);
      for (const required of template.smokeTest?.requiredFiles || []) {
        expect(template.files.some((file) => file.path === required)).toBe(true);
      }
      if (template.id.includes('isprs')) {
        expect(template.files.some((file) => file.path === 'isprs.cls')).toBe(true);
        expect(template.files.some((file) => file.path === 'isprs.bst')).toBe(true);
      }
    }
  });
});
