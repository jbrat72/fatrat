/**
 * Streak + consistency calculations.
 *   consecutiveWeeks:       consecutive ISO weeks (Mon..Sun) with >= 1 active session.
 *   currentStreak:          legacy — consecutive weeks hitting `daysPerWeek`.
 *   totalCompleted:         total completed sessions in history.
 *   thisWeek.done/planned:  for the current ISO week.
 *   cardioMinutesThisWeek:  sum of cardio durations in the current ISO week.
 *   liftingDaysThisWeek:    distinct dates with >=1 completed lifting session this week.
 */
import type { WorkoutSession, UserProfile } from '@/types';

export interface StreakStats {
  consecutiveWeeks: number;
  currentStreak: number;
  totalCompleted: number;
  thisWeek: { done: number; planned: number };
  cardioMinutesThisWeek: number;
  liftingDaysThisWeek: number;
}

/** ISO Monday-anchored week stamp ("YYYY-MM-DD" of the Monday).
 *  Uses LOCAL date components so we don't drift across midnight in non-UTC timezones. */
export function isoWeekStamp(d: Date): string {
  const day = d.getDay() || 7;
  const monday = new Date(d);
  monday.setDate(d.getDate() - day + 1);
  const y = monday.getFullYear();
  const m = String(monday.getMonth() + 1).padStart(2, '0');
  const dd = String(monday.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

/** A session is "active" (counts toward a week) when it's completed OR has any cardio/lifting logged. */
function isActive(s: WorkoutSession): boolean {
  if (s.completed) return true;
  if (s.cardio && s.cardio.length > 0) return true;
  if (s.exercises && s.exercises.some((e) => e.sets.some((set) => set.completed))) return true;
  return false;
}

export function streakStats(
  sessions: WorkoutSession[],
  profile: UserProfile,
  today: Date = new Date(),
): StreakStats {
  const planned = profile.daysPerWeek;

  const completedCounts = new Map<string, number>();
  const activeWeeks = new Set<string>();
  let totalCompleted = 0;

  for (const s of sessions) {
    const stamp = isoWeekStamp(new Date(s.date + 'T00:00:00'));
    if (s.completed) {
      totalCompleted += 1;
      completedCounts.set(stamp, (completedCounts.get(stamp) ?? 0) + 1);
    }
    if (isActive(s)) activeWeeks.add(stamp);
  }

  // Legacy currentStreak (planned-target-hit).
  let currentStreak = 0;
  {
    const cursor = new Date(today);
    let firstWeekChecked = true;
    for (;;) {
      const stamp = isoWeekStamp(cursor);
      const done = completedCounts.get(stamp) ?? 0;
      if (done >= planned) {
        currentStreak += 1;
        cursor.setDate(cursor.getDate() - 7);
        firstWeekChecked = false;
        continue;
      }
      if (firstWeekChecked) {
        cursor.setDate(cursor.getDate() - 7);
        firstWeekChecked = false;
        continue;
      }
      break;
    }
  }

  // consecutiveWeeks: walk back, allow this week to be empty without breaking the chain.
  let consecutiveWeeks = 0;
  {
    const cursor = new Date(today);
    const thisStamp = isoWeekStamp(cursor);
    if (!activeWeeks.has(thisStamp)) {
      cursor.setDate(cursor.getDate() - 7);
    }
    for (;;) {
      const stamp = isoWeekStamp(cursor);
      if (activeWeeks.has(stamp)) {
        consecutiveWeeks += 1;
        cursor.setDate(cursor.getDate() - 7);
        continue;
      }
      break;
    }
  }

  // This-week aggregates.
  const thisWeekStamp = isoWeekStamp(today);
  const inThisWeek = (s: WorkoutSession) =>
    isoWeekStamp(new Date(s.date + 'T00:00:00')) === thisWeekStamp;

  const thisWeekSessions = sessions.filter(inThisWeek);
  const thisWeek = {
    done: completedCounts.get(thisWeekStamp) ?? 0,
    planned,
  };

  let cardioMinutesThisWeek = 0;
  const liftingDates = new Set<string>();
  for (const s of thisWeekSessions) {
    for (const c of s.cardio ?? []) cardioMinutesThisWeek += c.durationMin || 0;
    const hasLifting = (s.exercises ?? []).some((e) => e.sets.some((set) => set.completed));
    if (hasLifting) liftingDates.add(s.date);
  }
  const liftingDaysThisWeek = liftingDates.size;

  return {
    consecutiveWeeks,
    currentStreak,
    totalCompleted,
    thisWeek,
    cardioMinutesThisWeek,
    liftingDaysThisWeek,
  };
}
