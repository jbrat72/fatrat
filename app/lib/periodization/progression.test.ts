import { describe, it, expect } from 'vitest';
import {
  nextLinear,
  nextRIRBased,
  nextSetProgression,
  nextPrescription,
  roundToPlate,
} from './progression';
import type { PriorPerformance } from './progression';
import type { SetEntry } from '@/types';

function mkSet(weight: number, reps: number, rpe?: number): SetEntry {
  return { setIndex: 0, weightKg: weight, reps, rpe, completed: true };
}

const basePrior: PriorPerformance = {
  sets: [mkSet(100, 8, 7), mkSet(100, 8, 7.5), mkSet(100, 8, 8)],
  prescribedRepsLow: 8,
  prescribedRepsHigh: 10,
  prescribedRIR: 2,
};

describe('linear progression', () => {
  it('adds weight when reps were met and effort was not hard', () => {
    const out = nextLinear(basePrior);
    expect(out.weightKg).toBe(102.5);
    expect(out.note).toMatch(/added/i);
  });

  it('holds weight when last set was hard but reps were met', () => {
    const prior: PriorPerformance = { ...basePrior, sets: [mkSet(100, 8, 9.5)] };
    const out = nextLinear(prior);
    expect(out.weightKg).toBe(100);
    expect(out.note).toMatch(/hold/i);
  });

  it('reduces load after consecutive hard sessions', () => {
    const out = nextLinear(basePrior, 2);
    expect(out.weightKg).toBe(97.5);
    expect(out.note).toMatch(/reduced/i);
  });

  it('reduces when reps missed and effort was high', () => {
    const prior: PriorPerformance = { ...basePrior, sets: [mkSet(100, 6, 9.5)] };
    const out = nextLinear(prior);
    expect(out.weightKg).toBe(97.5);
  });
});

describe('RIR-based progression', () => {
  it('drops target RIR by week (3 -> 2 -> 1 -> 0)', () => {
    expect(nextRIRBased(basePrior, 0, 4).targetRIR).toBe(3);
    expect(nextRIRBased(basePrior, 1, 4).targetRIR).toBe(2);
    expect(nextRIRBased(basePrior, 2, 4).targetRIR).toBe(1);
    expect(nextRIRBased(basePrior, 3, 4).targetRIR).toBe(0);
  });

  it('flags final week note', () => {
    const out = nextRIRBased(basePrior, 3, 4);
    expect(out.note).toMatch(/final push/i);
  });
});

describe('set-progression', () => {
  it('adds a set per week capped at MRV', () => {
    expect(nextSetProgression(basePrior, 0, 3, 6).sets).toBe(3);
    expect(nextSetProgression(basePrior, 1, 3, 6).sets).toBe(4);
    expect(nextSetProgression(basePrior, 5, 3, 6).sets).toBe(6);
    expect(nextSetProgression(basePrior, 10, 3, 6).sets).toBe(6);
  });
});

describe('dispatcher', () => {
  it('routes to the right scheme', () => {
    const ctx = { prior: basePrior, weekIndex: 1, weeksInMeso: 4, dayOfWeekIndex: 0 };
    expect(nextPrescription({ ...ctx, scheme: 'linear' }).note).toBeTruthy();
    expect(nextPrescription({ ...ctx, scheme: 'rir-based' }).targetRIR).toBe(2);
    expect(nextPrescription({ ...ctx, scheme: 'set-progression', mev: 3, mrv: 6 }).sets).toBe(4);
    expect(nextPrescription({ ...ctx, scheme: 'undulating' }).reps).toBeGreaterThan(0);
  });
});

describe('roundToPlate', () => {
  it('rounds to nearest 2.5', () => {
    expect(roundToPlate(101.2)).toBe(100);
    expect(roundToPlate(103.7)).toBe(102.5);
    expect(roundToPlate(104.0)).toBe(105);
    expect(roundToPlate(102.5)).toBe(102.5);
    expect(roundToPlate(-5)).toBe(0);
  });
});
