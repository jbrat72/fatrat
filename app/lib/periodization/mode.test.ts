import { describe, it, expect } from 'vitest';
import { recommendMode } from './mode';

describe('recommendMode', () => {
  it('beginner with no familiarity -> BASIC', () => {
    expect(recommendMode('lt6mo', 'none').mode).toBe('BASIC');
  });

  it('mid-experience + fuzzy familiarity -> INTERMEDIATE', () => {
    expect(recommendMode('6mo-2yr', 'fuzzy').mode).toBe('INTERMEDIATE');
  });

  it('experienced + fluent -> ADVANCED', () => {
    expect(recommendMode('2yr-plus', 'fluent').mode).toBe('ADVANCED');
  });

  it('fluent familiarity nudges a beginner up from BASIC', () => {
    expect(recommendMode('lt6mo', 'fluent').mode).toBe('INTERMEDIATE');
  });

  it('long experience without periodization knowledge -> INTERMEDIATE', () => {
    expect(recommendMode('2yr-plus', 'none').mode).toBe('INTERMEDIATE');
  });

  it('reason text is non-empty and matches mode', () => {
    const r = recommendMode('lt6mo', 'none');
    expect(r.reason).toMatch(/simple|jargon|new/i);
    const a = recommendMode('2yr-plus', 'fluent');
    expect(a.reason).toMatch(/RPE|RIR|periodization|MEV/i);
  });
});
