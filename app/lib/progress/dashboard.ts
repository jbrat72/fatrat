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
  center: string;        // big center text (percent)
  sub: string;           // small secondary text (n/n)
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
  let value = 0;
  let goal = 0;
  let unit = '';

  if (key === 'workouts') {
    // Completed vs scheduled PROGRAMMED workouts in the current ISO week — the
    // plan's lifting days (cardio-only / ad-hoc sessions excluded). Falls back
    // to days-per-week when no plan sessions are scheduled this week.
    const stamp = isoWeekStamp(today);
    const mid = ctx.meso?.id;
    const wk = mid
      ? ctx.sessions.filter((s) => s.mesocycleId === mid && isoWeekStamp(new Date(s.date + 'T00:00:00')) === stamp)
      : [];
    goal = wk.length;
    value = wk.filter((s) => s.completed).length;
    if (goal === 0) {
      const s = streakStats(ctx.sessions, ctx.user, today);
      goal = s.thisWeek.planned || ctx.user.daysPerWeek || 0;
      value = s.liftingDaysThisWeek;
    }
  } else if (key === 'cardio') {
    const s = streakStats(ctx.sessions, ctx.user, today);
    goal = ctx.user.cardioWeeklyGoalMin ?? 0;
    value = s.cardioMinutesThisWeek;
    unit = 'm';
    if (goal <= 0) return { ...base, value, goal: 0, pct: 0, center: '+', sub: '', needsGoalLink: true };
  } else if (key === 'program') {
    const mid = ctx.meso?.id;
    const inMeso = mid ? ctx.sessions.filter((s) => s.mesocycleId === mid) : [];
    goal = inMeso.length;
    value = inMeso.filter((s) => s.completed).length;
  } else {
    // volume — hard (completed, non-skip) sets vs prescribed sets this week
    const activeMicro = ctx.micros.find((m) => m.status === 'active') ?? null;
    const weekSessions = activeMicro ? ctx.sessions.filter((s) => s.microcycleId === activeMicro.id) : [];
    for (const s of weekSessions) {
      for (const ex of s.exercises) {
        goal += ex.prescribedSets ?? ex.sets.length;
        value += ex.sets.filter((set) => set.completed && set.setType !== 'skip').length;
      }
    }
  }

  const pct = goal ? clamp01(value / goal) : 0;
  const center = goal ? `${Math.round(pct * 100)}%` : '—';
  const shown = Math.round(value);
  const sub = goal ? `${shown}/${goal}${unit}` : `${shown}${unit}`;
  return { ...base, value, goal, pct, center, sub };
}
