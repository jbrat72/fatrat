/**
 * Today dashboard ring metrics. Each ring is a percentage-of-goal donut.
 * Defaults: workouts this week, cardio minutes vs goal, program completion.
 * The user picks which three show (profile.dashboardRings) in Settings.
 */
import type { WorkoutSession, UserProfile, Mesocycle, Microcycle, DashboardMetricKey } from '@/types';
import { streakStats, isoWeekStamp } from './streak';

export interface RingMetric {
  key: DashboardMetricKey;
  label: string;
  value: number;
  goal: number;          // 0 = no goal/total
  pct: number;           // 0..1, clamped
  center: string;        // big center text
  color: string;         // arc hex
  needsGoalLink?: boolean; // true → render the "set a goal" empty state
}

export const RING_COLORS: Record<DashboardMetricKey, string> = {
  workouts: '#ef4444', cardio: '#1d9e75', program: '#ef9f27', volume: '#7f77dd',
};
export const RING_LABELS: Record<DashboardMetricKey, string> = {
  workouts: 'Workouts', cardio: 'Cardio', program: 'Program', volume: 'Volume',
};
export const DASHBOARD_METRIC_OPTIONS: { key: DashboardMetricKey; label: string; hint: string }[] = [
  { key: 'workouts', label: 'Workouts', hint: 'Days trained vs planned this week' },
  { key: 'cardio',   label: 'Cardio',   hint: 'Cardio minutes vs weekly goal' },
  { key: 'program',  label: 'Program',  hint: 'Workouts done vs total in the block' },
  { key: 'volume',   label: 'Volume',   hint: 'Hard sets done vs prescribed this week' },
];
export const DEFAULT_RINGS: DashboardMetricKey[] = ['workouts', 'cardio', 'program'];

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

export function computeRingMetric(
  key: DashboardMetricKey,
  ctx: { sessions: WorkoutSession[]; user: UserProfile; meso: Mesocycle | null; micros: Microcycle[]; today?: Date },
): RingMetric {
  const today = ctx.today ?? new Date();
  const base = { key, label: RING_LABELS[key], color: RING_COLORS[key] };

  if (key === 'workouts') {
    // Completed vs scheduled PROGRAMMED workouts in the current ISO week — the
    // plan's lifting days (cardio-only / ad-hoc sessions are excluded). Falls
    // back to days-per-week when no plan sessions are scheduled this week.
    const stamp = isoWeekStamp(today);
    const mid = ctx.meso?.id;
    const wk = mid
      ? ctx.sessions.filter((s) => s.mesocycleId === mid && isoWeekStamp(new Date(s.date + 'T00:00:00')) === stamp)
      : [];
    let goal = wk.length;
    let value = wk.filter((s) => s.completed).length;
    if (goal === 0) {
      const s = streakStats(ctx.sessions, ctx.user, today);
      goal = s.thisWeek.planned || ctx.user.daysPerWeek || 0;
      value = s.liftingDaysThisWeek;
    }
    return { ...base, value, goal, pct: goal ? clamp01(value / goal) : 0, center: goal ? `${value}/${goal}` : `${value}` };
  }

  if (key === 'cardio') {
    const s = streakStats(ctx.sessions, ctx.user, today);
    const goal = ctx.user.cardioWeeklyGoalMin ?? 0;
    const value = s.cardioMinutesThisWeek;
    if (goal <= 0) return { ...base, value, goal: 0, pct: 0, center: '+', needsGoalLink: true };
    return { ...base, value, goal, pct: clamp01(value / goal), center: `${value}` };
  }

  if (key === 'program') {
    const mid = ctx.meso?.id;
    const inMeso = mid ? ctx.sessions.filter((s) => s.mesocycleId === mid) : [];
    const goal = inMeso.length;
    const value = inMeso.filter((s) => s.completed).length;
    return { ...base, value, goal, pct: goal ? clamp01(value / goal) : 0, center: goal ? `${Math.round((value / goal) * 100)}%` : '—' };
  }

  // volume — hard (completed, non-skip) sets vs prescribed sets in the active week
  const activeMicro = ctx.micros.find((m) => m.status === 'active') ?? null;
  const weekSessions = activeMicro ? ctx.sessions.filter((s) => s.microcycleId === activeMicro.id) : [];
  let done = 0, planned = 0;
  for (const s of weekSessions) {
    for (const ex of s.exercises) {
      planned += ex.prescribedSets ?? ex.sets.length;
      done += ex.sets.filter((set) => set.completed && set.setType !== 'skip').length;
    }
  }
  return { ...base, value: done, goal: planned, pct: planned ? clamp01(done / planned) : 0, center: planned ? `${done}/${planned}` : `${done}` };
}
