import { describe, it, expect } from 'vitest';
import { previewModeDiff } from './modeDiff';

describe('previewModeDiff', () => {
  it('empty diff for same mode', () => {
    const out = previewModeDiff('BASIC','BASIC');
    expect(out.gained).toEqual([]);
    expect(out.hidden).toEqual([]);
  });

  it('upgrading reveals more features', () => {
    const out = previewModeDiff('BASIC','ADVANCED');
    expect(out.gained.length).toBeGreaterThan(0);
    expect(out.hidden.length).toBeGreaterThan(0); // BASIC-only friendliness is hidden
  });

  it('downgrading hides advanced features', () => {
    const out = previewModeDiff('ADVANCED','BASIC');
    expect(out.hidden.some((s) => /RPE|RIR|MEV|e1RM/i.test(s))).toBe(true);
  });
});
