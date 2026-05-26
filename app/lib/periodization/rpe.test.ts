import { describe, it, expect } from 'vitest';
import {
  rpeFromBasicFeel,
  rpeFromIntermediateFeel,
  basicFeelFromRPE,
  intermediateFeelFromRPE,
  rirFromRPE,
  rpeFromRIR,
} from './rpe';

describe('rpe mapping', () => {
  it('maps BASIC feels to documented RPE values', () => {
    expect(rpeFromBasicFeel('easy')).toBe(6);
    expect(rpeFromBasicFeel('just-right')).toBe(7.5);
    expect(rpeFromBasicFeel('hard')).toBe(9);
  });

  it('maps INTERMEDIATE feels to 6..10', () => {
    expect(rpeFromIntermediateFeel('smooth')).toBe(6);
    expect(rpeFromIntermediateFeel('solid')).toBe(7);
    expect(rpeFromIntermediateFeel('tough')).toBe(8);
    expect(rpeFromIntermediateFeel('grinding')).toBe(9);
    expect(rpeFromIntermediateFeel('failed')).toBe(10);
  });

  it('round-trips RPE -> feel labels in a reasonable bucketing', () => {
    expect(basicFeelFromRPE(6)).toBe('easy');
    expect(basicFeelFromRPE(7.5)).toBe('just-right');
    expect(basicFeelFromRPE(9)).toBe('hard');

    expect(intermediateFeelFromRPE(6)).toBe('smooth');
    expect(intermediateFeelFromRPE(7)).toBe('solid');
    expect(intermediateFeelFromRPE(8)).toBe('tough');
    expect(intermediateFeelFromRPE(9)).toBe('grinding');
    expect(intermediateFeelFromRPE(10)).toBe('failed');
  });

  it('RIR <-> RPE inversion holds', () => {
    expect(rirFromRPE(10)).toBe(0);
    expect(rirFromRPE(8)).toBe(2);
    expect(rirFromRPE(6)).toBe(4);
    expect(rpeFromRIR(2)).toBe(8);
    expect(rpeFromRIR(0)).toBe(10);
    expect(rpeFromRIR(99)).toBe(1); // clamp lower
  });
});
