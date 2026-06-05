'use client';
import { Fragment, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/ui/cn';
import type { Microcycle, WorkoutSession, UserMode } from '@/types';

type Variant = 'paged' | 'expandable';

interface Props {
  micros: Microcycle[];
  sessions: WorkoutSession[];
  todayIso: string;
  mode: UserMode;
  /** Total weeks defined for the meso. Use to render the meso's full length. */
  totalWeeks?: number;
  /**
   * Weekday the calendar grid starts on (0 = Sunday, 1 = Monday …).
   * Display only — defaults to Monday.
   */
  weekStartsOn?: number;
  onSelectSession: (sessionId: string) => void;
  /** Called when the user clicks a day with no session — used for "add cardio / a workout". */
  onSelectDay: (info: { date: string; weekNumber: number; dayOfWeek: 0 | 1 | 2 | 3 | 4 | 5 | 6 }) => void;
  /**
   * 'paged' (default) — one week at a time, with prev/next arrows.
   * 'expandable' — one week with a toggle that expands to the whole plan.
   */
  variant?: Variant;
  /** Is the block being viewed the user's currently active program?
   *  When false (e.g. an archived block in History):
   *    - "This week" / today highlights are suppressed
   *    - Future planned cells render as rest (the block isn't actually
   *      scheduling work anymore)
   *    - For weeks entirely in the future, the "Week N of N" header swaps
   *      to "No Active Plan" but the calendar grid still renders, naturally
   *      showing all-rest cells so the user sees a real off-day schedule.
   *    - The default visible week is Week 1 (start of the archived block)
   *      instead of "today's week", which is meaningless for an old block.
   */
  isCurrent?: boolean;
  /** Optional list of completed sessions from OTHER blocks (e.g. an archived
   *  plan the user already cancelled) to overlay onto this calendar by date.
   *  Lets the History view surface the user's full training timeline instead
   *  of a per-block silo. Sessions that already belong to the selected block
   *  take precedence; extras fill empty cells. */
  extraCompletedSessions?: WorkoutSession[];
  /** Maps the calendar's weekNumber to the source block (mesocycle) name.
   *  When present, the paged header shows the block name in place of the
   *  intensity badge so the user can tell which plan a given week belonged
   *  to as they page through "All blocks" mode in History. */
  blockNameByWeek?: Map<number, string>;
}

const DOW_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function addDays(iso: string, days: number) {
  const d = new Date(iso + 'T00:00:00');
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

function dayNumOf(iso: string) {
  return new Date(iso + 'T00:00:00').getDate();
}

/** Week-level effort label. ADVANCED shows raw RIR; other modes show a plain word. */
function intensityLabel(mode: UserMode, rir: number | undefined): string | null {
  if (rir == null) return null;
  if (mode === 'ADVANCED') return `${rir} RIR`;
  if (rir >= 3) return 'Easy';
  if (rir === 2) return 'Moderate';
  if (rir === 1) return 'Hard';
  return 'Peak';
}

/**
 * - completed: session done, on/before today (green)
 * - skipped:   a past session that was never completed (orange)
 * - planned:   a scheduled training day, future or no session (outlined)
 * - rest:      an off-day with no session (cross-hatch)
 *
 * "Today" is NOT a state — it is drawn as a red circle around the day number,
 * on top of whatever the day's real state is.
 */
type CellState = 'completed' | 'skipped' | 'planned' | 'rest';

export function WeekCalendar(props: Props) {
  const { micros, sessions, todayIso, mode, totalWeeks, onSelectSession, onSelectDay, isCurrent = true, extraCompletedSessions = [], blockNameByWeek } = props;
  const variant: Variant = props.variant ?? 'paged';
  // Normalised week-start weekday (0–6); defaults to Monday.
  const weekStartsOn = (((props.weekStartsOn ?? 1) % 7) + 7) % 7;

  // Column → day-of-week, and the labels for each column, given the week start.
  const dowForCol = (col: number) => (weekStartsOn + col) % 7;
  const dayLabels = useMemo(
    () => Array.from({ length: 7 }, (_, col) => DOW_NAMES[(weekStartsOn + col) % 7]!),
    [weekStartsOn],
  );

  const sortedMicros = useMemo(
    () => [...micros].sort((a, b) => a.weekNumber - b.weekNumber),
    [micros],
  );

  const maxScheduled = sortedMicros.reduce((m, x) => Math.max(m, x.weekNumber), 0);
  const weekCount = Math.max(totalWeeks ?? maxScheduled, 1);

  const microByWeek = useMemo(() => {
    const map = new Map<number, Microcycle>();
    for (const m of sortedMicros) map.set(m.weekNumber, m);
    return map;
  }, [sortedMicros]);

  const sessionsByMicroId = useMemo(() => {
    const map = new Map<string, WorkoutSession[]>();
    for (const s of sessions) {
      if (!s.microcycleId) continue;
      const arr = map.get(s.microcycleId) ?? [];
      arr.push(s);
      map.set(s.microcycleId, arr);
    }
    return map;
  }, [sessions]);

  /** Completed sessions from other blocks, keyed by their ISO date. Used to
   *  overlay onto cells that wouldn't otherwise have a session for this block. */
  const extrasByDate = useMemo(() => {
    const map = new Map<string, WorkoutSession>();
    for (const s of extraCompletedSessions) {
      if (!s.completed) continue;
      map.set(s.date, s);
    }
    return map;
  }, [extraCompletedSessions]);

  // Each week's start date (on the chosen week-start weekday), derived from the
  // earliest session in that week's micro.
  const startOfWeekByWeek = useMemo(() => {
    const map = new Map<number, string>();
    for (const m of sortedMicros) {
      const ss = (sessionsByMicroId.get(m.id) ?? []).slice().sort((a, b) => a.date.localeCompare(b.date));
      if (ss.length === 0) continue;
      const first = ss[0]!;
      map.set(m.weekNumber, addDays(first.date, -((first.dayOfWeek - weekStartsOn + 7) % 7)));
    }
    return map;
  }, [sortedMicros, sessionsByMicroId, weekStartsOn]);

  const anchorWeek = [...startOfWeekByWeek.keys()].sort((a, b) => a - b)[0];
  const anchorStart = anchorWeek != null ? startOfWeekByWeek.get(anchorWeek)! : null;

  const startOfWeekFor = (week: number): string | null => {
    const known = startOfWeekByWeek.get(week);
    if (known) return known;
    if (anchorWeek != null && anchorStart != null) return addDays(anchorStart, (week - anchorWeek) * 7);
    return null;
  };

  // A DOW counts as "scheduled" when it appears in >=2 micros (or >=1 if only one).
  const scheduledDows = useMemo(() => {
    const dowMicroSets = new Map<number, Set<string>>();
    const microsWithSessions = new Set<string>();
    for (const s of sessions) {
      if (!s.microcycleId) continue;
      microsWithSessions.add(s.microcycleId);
      const set = dowMicroSets.get(s.dayOfWeek) ?? new Set<string>();
      set.add(s.microcycleId);
      dowMicroSets.set(s.dayOfWeek, set);
    }
    const minOccurrences = microsWithSessions.size >= 2 ? 2 : 1;
    const out = new Set<number>();
    for (const [d, ms] of dowMicroSets) {
      if (ms.size >= minOccurrences) out.add(d);
    }
    return out;
  }, [sessions]);

  // The week containing today, if any.
  const currentWeekNum = useMemo(() => {
    for (let w = 1; w <= weekCount; w++) {
      const start = startOfWeekFor(w);
      if (start && todayIso >= start && todayIso <= addDays(start, 6)) return w;
    }
    return null;
  }, [weekCount, todayIso, startOfWeekByWeek]); // eslint-disable-line react-hooks/exhaustive-deps

  // Where the calendar opens.
  //   - Current/active block: today's week → active micro → first-with-sessions → 1
  //   - Archived block: Week 1 (start at the beginning so you can scroll
  //     through the block's actual history; "today's week" is irrelevant
  //     to a block that has ended)
  const defaultWeek = useMemo(() => {
    if (!isCurrent) return 1;
    if (currentWeekNum != null) return currentWeekNum;
    const activeMicro = sortedMicros.find((m) => m.status === 'active');
    if (activeMicro) return Math.min(activeMicro.weekNumber, weekCount);
    const withSessions = [...startOfWeekByWeek.keys()].sort((a, b) => a - b);
    if (withSessions.length) return Math.min(withSessions[0]!, weekCount);
    return 1;
  }, [isCurrent, currentWeekNum, sortedMicros, startOfWeekByWeek, weekCount]);

  const [viewWeek, setViewWeek] = useState(defaultWeek);
  // Until the user pages manually, keep snapping to the default ("this week").
  // Sessions often load after mount, so defaultWeek settles a beat later.
  const [userPaged, setUserPaged] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!userPaged) setViewWeek(defaultWeek);
  }, [defaultWeek, userPaged]);

  const week = Math.min(Math.max(viewWeek, 1), weekCount);

  const goWeek = (next: number) => {
    setUserPaged(true);
    setViewWeek(Math.min(weekCount, Math.max(1, next)));
  };

  function cellState(session: WorkoutSession | null, cellDate: string | null, dow: number): CellState {
    if (session) {
      if (session.completed && (cellDate == null || cellDate <= todayIso)) return 'completed';
      if (cellDate != null && cellDate < todayIso) return 'skipped';
      // Future / today non-completed: only "planned" if the block is current.
      // For archived blocks, future planned-but-not-done sessions render as
      // rest so the calendar doesn't lie about upcoming work.
      if (!isCurrent) return 'rest';
      return 'planned';
    }
    if (scheduledDows.has(dow) && isCurrent) return 'planned';
    return 'rest';
  }

  function weekByDay(weekNum: number): (WorkoutSession | null)[] {
    const micro = microByWeek.get(weekNum) ?? null;
    const arr: (WorkoutSession | null)[] = [null, null, null, null, null, null, null];
    if (micro) {
      for (const s of sessionsByMicroId.get(micro.id) ?? []) arr[s.dayOfWeek] = s;
    }
    // Overlay completed sessions from other blocks (e.g. cancelled plans)
    // onto any still-empty cells whose calendar date matches an extra.
    const startOfWeek = startOfWeekFor(weekNum);
    if (startOfWeek && extrasByDate.size > 0) {
      for (let col = 0; col < 7; col++) {
        const dow = dowForCol(col);
        if (arr[dow]) continue;
        const cellDate = addDays(startOfWeek, col);
        const cross = extrasByDate.get(cellDate);
        if (cross) arr[dow] = cross;
      }
    }
    return arr;
  }

  function caption(session: WorkoutSession | null, cellDate: string | null, dow: number): string {
    const state = cellState(session, cellDate, dow);
    if (state === 'completed') {
      if (session?.exercises.length) return 'Lift';
      if (session?.cardio.length) return 'Cardio';
      return 'Done';
    }
    if (state === 'skipped') return 'Skip';
    if (state === 'planned') {
      if (session?.exercises.length) return 'Lift';
      if (session?.cardio.length) return 'Cardio';
      return 'Planned';
    }
    return 'Rest';
  }

  // One day tile (a button). Today is marked with a red circle around the number.
  function dayTile(weekNum: number, col: number): ReactNode {
    const startOfWeek = startOfWeekFor(weekNum);
    const dow = dowForCol(col);
    const session = weekByDay(weekNum)[dow] ?? null;
    const cellDate = startOfWeek ? addDays(startOfWeek, col) : null;
    const state = cellState(session, cellDate, dow);
    const isToday = cellDate === todayIso;
    const clickable = !!session || !!cellDate;

    const handleClick = () => {
      if (session) { onSelectSession(session.id); return; }
      if (cellDate) onSelectDay({ date: cellDate, weekNumber: weekNum, dayOfWeek: dow as 0 | 1 | 2 | 3 | 4 | 5 | 6 });
    };

    return (
      <button
        key={`${weekNum}-${col}`}
        type="button"
        onClick={handleClick}
        disabled={!clickable}
        className={cn(
          'h-12 rounded-md flex items-center justify-center font-mono text-sm font-semibold transition min-w-0',
          state === 'completed' && 'bg-ok/15 border border-ok/40 text-ok hover:bg-ok/25',
          state === 'skipped' && 'bg-warn/15 border border-warn/50 text-warn hover:bg-warn/25',
          state === 'planned' && 'bg-bg-input border border-ink-line text-ink-dim hover:border-ink-dim hover:text-ink',
          state === 'rest' && 'bg-crosshatch border border-ink-line/60 text-ink-mute hover:border-ink-dim',
        )}
        aria-label={
          session
            ? `Session on ${session.date}`
            : cellDate
              ? `Add a workout on ${dayLabels[col]}, ${cellDate}`
              : `${dayLabels[col]}, no date`
        }
      >
        {isToday ? (
          <span className="w-7 h-7 rounded-full bg-accent text-white flex items-center justify-center">
            {cellDate ? dayNumOf(cellDate) : ''}
          </span>
        ) : (
          cellDate ? dayNumOf(cellDate) : '–'
        )}
      </button>
    );
  }

  /* ----- expandable variant (Plan screen) ----- */
  if (variant === 'expandable') {
    const weeksToShow = expanded
      ? Array.from({ length: weekCount }, (_, i) => i + 1)
      : [week];

    return (
      <div>
        <div className="grid gap-1" style={{ gridTemplateColumns: '3.25rem repeat(7, minmax(0, 1fr))' }}>
          <div />
          {dayLabels.map((label, col) => (
            <div key={col} className="text-2xs text-center text-ink-dim pb-1">{label}</div>
          ))}

          {weeksToShow.map((wn) => {
            const intensity = intensityLabel(mode, microByWeek.get(wn)?.targetRIR);
            const isCurrent = currentWeekNum === wn;
            return (
              <Fragment key={wn}>
                <div className="flex flex-col justify-center pr-1 min-w-0">
                  <span className={cn('text-xs font-semibold leading-tight truncate', isCurrent ? 'text-accent' : 'text-ink')}>
                    Week {wn}
                  </span>
                  {intensity && (
                    <span className="font-mono text-2xs text-ink-dim leading-tight mt-0.5 truncate">{intensity}</span>
                  )}
                </div>
                {dayLabels.map((_, col) => dayTile(wn, col))}
              </Fragment>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          aria-label={expanded ? 'Collapse to the current week' : 'Expand to the full plan'}
          className="mt-2 w-full h-7 flex items-center justify-center rounded-md border border-ink-line text-ink-dim hover:text-ink hover:border-ink-dim transition"
        >
          <svg
            viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor"
            strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
            className={cn('transition-transform', expanded && 'rotate-180')}
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>
      </div>
    );
  }

  /* ----- paged variant (History screen) ----- */
  const startOfWeek = startOfWeekFor(week);
  const intensity = intensityLabel(mode, microByWeek.get(week)?.targetRIR);
  const isCurrentWeek = !!startOfWeek && todayIso >= startOfWeek && todayIso <= addDays(startOfWeek, 6);
  // Future weeks of a non-current block don't represent any real schedule —
  // swap the "Week N of N" header out for a "No Active Plan" label. The grid
  // still renders normally; because !isCurrent makes cellState fall through
  // to 'rest' for empty days, the user sees a real off-day calendar instead
  // of a placeholder card.
  const isFutureWeek = !!startOfWeek && startOfWeek > todayIso;
  const showNoPlan = !isCurrent && isFutureWeek;

  let rangeLabel = '';
  if (startOfWeek) {
    const a = new Date(startOfWeek + 'T00:00:00');
    const b = new Date(addDays(startOfWeek, 6) + 'T00:00:00');
    const left = `${MONTHS[a.getMonth()]} ${a.getDate()}`;
    const right = a.getMonth() === b.getMonth() ? `${b.getDate()}` : `${MONTHS[b.getMonth()]} ${b.getDate()}`;
    rangeLabel = `${left} – ${right}`;
  }

  const byDay = weekByDay(week);

  return (
    <div>
      <div className="flex items-baseline gap-2 flex-wrap">
        {showNoPlan ? (
          <span className="text-base font-semibold leading-none">No Active Plan</span>
        ) : (
          <>
            <span className="text-base font-semibold leading-none">Week {week} of {weekCount}</span>
            {blockNameByWeek?.get(week) ? (
              <span className="text-2xs uppercase tracking-wider2 text-ink-dim bg-bg-elev rounded px-1.5 py-0.5 truncate max-w-[60%]">
                {blockNameByWeek.get(week)}
              </span>
            ) : intensity ? (
              <span className="font-mono text-2xs uppercase tracking-wider2 text-ink-dim bg-bg-elev rounded px-1.5 py-0.5">
                {intensity}
              </span>
            ) : null}
          </>
        )}
      </div>
      <div className="text-xs text-ink-mute tnum mt-0.5">
        {rangeLabel || 'No dates for this week'}
        {isCurrent && isCurrentWeek && <span className="text-accent"> · This week</span>}
      </div>

      <div className="flex items-center gap-1.5 mt-3">
        <button
          type="button"
          onClick={() => goWeek(week - 1)}
          disabled={week <= 1}
          className="h-12 w-7 shrink-0 rounded-md border border-ink-line bg-bg-input text-ink-dim flex items-center justify-center transition hover:border-accent hover:text-accent disabled:opacity-30 disabled:pointer-events-none"
          aria-label="Previous week"
        >
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
        </button>

        <div className="grid grid-cols-7 gap-1 flex-1">
          {dayLabels.map((label, col) => {
            const dow = dowForCol(col);
            const session = byDay[dow] ?? null;
            const cellDate = startOfWeek ? addDays(startOfWeek, col) : null;
            const isToday = cellDate === todayIso;
            return (
              <div key={col} className="flex flex-col min-w-0">
                <div className={cn('text-2xs text-center mb-1', isToday ? 'text-accent font-semibold' : 'text-ink-dim')}>
                  {label}
                </div>
                {dayTile(week, col)}
                <div className={cn('text-2xs text-center mt-1 truncate', session ? 'text-ink-dim' : 'text-ink-mute')}>
                  {caption(session, startOfWeek ? addDays(startOfWeek, col) : null, dow)}
                </div>
              </div>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => goWeek(week + 1)}
          disabled={week >= weekCount}
          className="h-12 w-7 shrink-0 rounded-md border border-ink-line bg-bg-input text-ink-dim flex items-center justify-center transition hover:border-accent hover:text-accent disabled:opacity-30 disabled:pointer-events-none"
          aria-label="Next week"
        >
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg>
        </button>
      </div>
    </div>
  );
}
