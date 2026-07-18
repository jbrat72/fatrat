import { describe, it, expect } from 'vitest';
import { isPerformedSet, isWorkingSet, performedSets } from './performedSets';
import type { SetEntry } from '@/types';

const mk = (over: Partial<SetEntry>): SetEntry => ({
  setIndex: 0,
  completed: true,
  ...over,
});

describe('isPerformedSet', () => {
  it('accepts a plain completed set', () => {
    expect(isPerformedSet(mk({ weightKg: 100, reps: 8 }))).toBe(true);
  });
  it('rejects an unlogged set', () => {
    expect(isPerformedSet(mk({ completed: false, weightKg: 100, reps: 8 }))).toBe(false);
  });
  it('rejects a skipped set even though it is completed:true with values', () => {
    expect(isPerformedSet(mk({ setType: 'skip', weightKg: 100, reps: 8 }))).toBe(false);
  });
  it('accepts drop/warmup/myorep sets (performed, just typed)', () => {
    expect(isPerformedSet(mk({ setType: 'drop' }))).toBe(true);
    expect(isPerformedSet(mk({ setType: 'warmup' }))).toBe(true);
    expect(isPerformedSet(mk({ setType: 'myorep' }))).toBe(true);
  });
});

describe('isWorkingSet', () => {
  it('excludes warmups and skips, keeps working sets', () => {
    expect(isWorkingSet(mk({}))).toBe(true);
    expect(isWorkingSet(mk({ setType: 'drop' }))).toBe(true);
    expect(isWorkingSet(mk({ setType: 'warmup' }))).toBe(false);
    expect(isWorkingSet(mk({ setType: 'skip' }))).toBe(false);
  });
});

describe('performedSets', () => {
  it('filters a mixed list', () => {
    const sets = [
      mk({ setIndex: 0 }),
      mk({ setIndex: 1, setType: 'skip' }),
      mk({ setIndex: 2, completed: false }),
      mk({ setIndex: 3, setType: 'drop' }),
    ];
    expect(performedSets(sets).map((s) => s.setIndex)).toEqual([0, 3]);
  });
});
