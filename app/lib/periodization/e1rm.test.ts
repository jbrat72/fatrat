import { describe, it, expect } from 'vitest';
import { epley1RM, brzycki1RM, estimate1RM, isReliableE1RM } from './e1rm';

describe('e1RM formulas', () => {
  it('returns 0 on bad inputs', () => {
    expect(epley1RM(0, 5)).toBe(0);
    expect(brzycki1RM(100, 0)).toBe(0);
    expect(estimate1RM({ weight: 0, reps: 5 })).toBe(0);
  });

  it('matches a known reference (100 lb x 5 reps)', () => {
    // Epley: 100 * (1 + 5/30) = 116.67
    expect(epley1RM(100, 5)).toBeCloseTo(116.667, 2);
    // Brzycki: 100 * 36/(37-5) = 112.5
    expect(brzycki1RM(100, 5)).toBeCloseTo(112.5, 2);
    // Average ~114.58
    expect(estimate1RM({ weight: 100, reps: 5 })).toBeCloseTo(114.583, 2);
  });

  it('RPE adjusts effective reps upward', () => {
    // 100 x 5 @ RPE 8 (2 RIR) -> effective 7 reps
    const eAtTopSet = estimate1RM({ weight: 100, reps: 5 });
    const eAtRPE8   = estimate1RM({ weight: 100, reps: 5, rpe: 8 });
    expect(eAtRPE8).toBeGreaterThan(eAtTopSet);
  });

  it('reliability band: 3..10 effective reps', () => {
    expect(isReliableE1RM(5)).toBe(true);
    expect(isReliableE1RM(2)).toBe(false);
    expect(isReliableE1RM(12)).toBe(false);
    // Reps + RIR = 5 + 0 = 5 reliable
    expect(isReliableE1RM(5, 10)).toBe(true);
    // Reps + RIR = 5 + 4 = 9 reliable
    expect(isReliableE1RM(5, 6)).toBe(true);
    // Reps + RIR = 10 + 3 = 13 unreliable
    expect(isReliableE1RM(10, 7)).toBe(false);
  });
});
