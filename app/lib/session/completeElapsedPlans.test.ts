import { describe, it, expect } from 'vitest';
import { isPlanElapsed } from './completeElapsedPlans';

describe('isPlanElapsed', () => {
  const meso = { startDate: '2026-01-05', weeks: 8 }; // 8 weeks = 56 days → ends 2026-03-02

  it('is not elapsed during the plan window', () => {
    expect(isPlanElapsed(meso, '2026-01-05')).toBe(false); // day 0
    expect(isPlanElapsed(meso, '2026-02-28')).toBe(false); // still in week 8
    expect(isPlanElapsed(meso, '2026-03-01')).toBe(false); // last day (day 55)
  });

  it('is elapsed once the full window has passed', () => {
    expect(isPlanElapsed(meso, '2026-03-02')).toBe(true);  // day 56 — window over
    expect(isPlanElapsed(meso, '2026-03-20')).toBe(true);  // well past
  });

  it('never elapses a plan without a start date', () => {
    expect(isPlanElapsed({ startDate: undefined, weeks: 8 }, '2027-01-01')).toBe(false);
  });
});
