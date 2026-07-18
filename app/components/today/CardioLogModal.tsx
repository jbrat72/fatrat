'use client';
import { useEffect, useRef, useState } from 'react';
import { useUser } from '@/components/app';
import { Button, ChoicePill, InlineNumber } from '@/components/ui';
import { cn } from '@/lib/ui/cn';
import { getRepository } from '@/lib/firestore';
import {
  kmToDisplayDistance, displayDistanceToKm,
  kphToDisplaySpeed, displaySpeedToKph,
  distanceLabel, speedLabel, paceLabel, formatPace,
} from '@/lib/ui/units';
import type { CardioActivity, CardioEntry, WorkoutSession } from '@/types';
import { todayIso } from '@/lib/ui/date';
import { CARDIO_ACTIVITIES } from '@/lib/cardio/activities';

// Duration is stored in minutes; the field is entered/shown as m:ss with the
// colon auto-inserted (digits fill from the right — no ":" key needed).
const clockFromDigits = (digits: string): string => {
  const d = digits.replace(/\D/g, '');
  if (!d) return '';
  const ss = d.slice(-2);
  const mm = d.slice(0, -2);
  return `${mm || '0'}:${ss.padStart(2, '0')}`;
};
const minutesFromDigits = (digits: string): number | undefined => {
  const d = digits.replace(/\D/g, '');
  if (!d) return undefined;
  const ss = parseInt(d.slice(-2) || '0', 10);
  const mm = parseInt(d.slice(0, -2) || '0', 10);
  return mm + ss / 60;
};
const digitsFromMinutes = (min: number): string => {
  const total = Math.round(min * 60);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}${String(s).padStart(2, '0')}`;
};

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved?: () => void;
  dateOverride?: string;
  microcycleId?: string;
  mesocycleId?: string;
  /** Denormalized parent plan name (Mesocycle.name). */
  planName?: string;
}

type InputMode = 'treadmill' | 'distance' | 'resistance' | 'simple';

function inputModeFor(a: CardioActivity): InputMode {
  if (a === 'treadmill') return 'treadmill';
  if (a === 'bike' || a === 'walking' || a === 'running-outdoor' || a === 'swimming') return 'distance';
  if (a === 'elliptical' || a === 'rower' || a === 'stair-climber') return 'resistance';
  // 'pickleball' and 'other' fall through to 'simple' -- time-based with avg HR.
  return 'simple';
}

export function CardioLogModal({
  open, onClose, onSaved, dateOverride, microcycleId, mesocycleId, planName,
}: Props) {
  const { user } = useUser();
  const [activity, setActivity] = useState<CardioActivity>('treadmill');
  const [duration, setDuration] = useState<number | undefined>(20);
  const [durationStr, setDurationStr] = useState(digitsFromMinutes(20));
  const [durFocused, setDurFocused] = useState(false);
  const [distance, setDistance] = useState<number | undefined>();
  const [speed, setSpeed] = useState<number | undefined>();
  const [incline, setIncline] = useState<number | undefined>(0);
  const [resistance, setResistance] = useState<number | undefined>(5);
  const [hr, setHr] = useState<number | undefined>();
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [showAll, setShowAll] = useState(false);

  // Once the user has typed anything, the async history prefill (which can
  // land AFTER they started typing) must not overwrite their input. Reset on
  // open and on activity change — those are deliberate prefill moments.
  const touched = useRef(false);
  const touch = <A extends unknown[]>(fn: (...a: A) => void) => (...a: A) => { touched.current = true; fn(...a); };

  const favorites = user?.cardioFavorites ?? [];
  const hasFavorites = favorites.length > 0;
  // Favorites first; "Show all" reveals the rest. With no favorites set, show all.
  const visibleActivities = hasFavorites && !showAll
    ? CARDIO_ACTIVITIES.filter((a) => favorites.includes(a.value))
    : CARDIO_ACTIVITIES;

  // Most-recent CardioEntry per activity, computed from user history when the modal opens.
  const [lastByActivity, setLastByActivity] = useState<Partial<Record<CardioActivity, CardioEntry>>>({});

  useEffect(() => {
    if (!open || !user) return;
    let cancelled = false;
    (async () => {
      const sessions = await getRepository().listSessions(user.userId, { limit: 200 });
      // Walk newest-first (listSessions returns sorted desc by date), keep first hit per activity.
      const map: Partial<Record<CardioActivity, CardioEntry>> = {};
      for (const s of sessions) {
        for (const c of s.cardio ?? []) {
          if (!map[c.activityType]) map[c.activityType] = c;
        }
      }
      if (!cancelled) setLastByActivity(map);
    })();
    return () => { cancelled = true; };
  }, [open, user]);

  // On open, default the selection to the first favorite (if any) so a hidden
  // non-favorite activity isn't the active choice. Reset the "show all" toggle.
  useEffect(() => {
    if (!open) return;
    setShowAll(false);
    touched.current = false;
    const favs = user?.cardioFavorites ?? [];
    if (favs.length && !favs.includes(activity)) setActivity(favs[0]);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // When the activity selection changes, prefill from the most-recent entry of that type.
  const prevActivity = useRef(activity);
  useEffect(() => {
    if (!user) return;
    const activityChanged = prevActivity.current !== activity;
    prevActivity.current = activity;
    if (activityChanged) touched.current = false;
    // A late-resolving fetch re-runs this effect via lastByActivity — bail if
    // the user already typed, instead of clobbering their entry.
    if (touched.current) return;
    const last = lastByActivity[activity];
    if (!last) {
      // No history yet — reset to sensible blank defaults for this mode.
      setDuration(20);
      setDurationStr(digitsFromMinutes(20));
      setDistance(undefined);
      setSpeed(undefined);
      setIncline(0);
      setResistance(5);
      setHr(undefined);
      setNotes('');
      return;
    }
    setDuration(last.durationMin ?? 20);
    setDurationStr(digitsFromMinutes(last.durationMin ?? 20));
    setDistance(last.distanceKm != null ? kmToDisplayDistance(last.distanceKm, user.units) : undefined);
    setSpeed(last.speedKph != null ? kphToDisplaySpeed(last.speedKph, user.units) : undefined);
    setIncline(last.inclinePct ?? 0);
    setResistance(last.resistanceLevel ?? 5);
    setHr(last.avgHR);
    setNotes(last.notes ?? '');
  }, [activity, lastByActivity, user]);

  if (!open || !user) return null;
  const units = user.units;
  const mode = inputModeFor(activity);

  let derivedDistanceKm: number | undefined;
  let derivedSpeedKph: number | undefined;
  let derivedPaceMinPerDispUnit: number | undefined;

  if (mode === 'treadmill') {
    const speedKph = displaySpeedToKph(speed, units);
    if (duration && speedKph) {
      derivedDistanceKm = +((duration / 60) * speedKph).toFixed(3);
    }
  } else if (mode === 'distance') {
    derivedDistanceKm = displayDistanceToKm(distance, units);
    if (duration && distance && distance > 0) {
      const distKm = derivedDistanceKm ?? 0;
      if (distKm > 0) derivedSpeedKph = distKm / (duration / 60);
      derivedPaceMinPerDispUnit = duration / distance;
    }
  }

  const save = async () => {
    if (!duration) return;
    setSaving(true);
    try {
    const repo = getRepository();
    const date = dateOverride ?? todayIso();
    const dow = new Date(date + 'T00:00:00').getDay() as 0|1|2|3|4|5|6;

    const entry: CardioEntry = {
      activityType: activity,
      durationMin: duration,
      distanceKm: derivedDistanceKm,
      avgHR: hr,
      speedKph:
        mode === 'treadmill'
          ? displaySpeedToKph(speed, units)
          : mode === 'distance'
            ? derivedSpeedKph
            : undefined,
      inclinePct: mode === 'treadmill' ? incline : undefined,
      resistanceLevel: mode === 'resistance' ? resistance : undefined,
      notes: notes.trim() || undefined,
    };

    let session: WorkoutSession | null = await repo.getTodaySession(user.userId, date);
    if (!session) {
      session = {
        id: 'cardio-' + Math.random().toString(36).slice(2, 9),
        userId: user.userId,
        date,
        dayOfWeek: dow,
        completed: true,
        exercises: [],
        cardio: [entry],
        completedAt: new Date().toISOString(),
        microcycleId,
        mesocycleId,
        planName,
      };
    } else {
      session = {
        ...session,
        cardio: [...session.cardio, entry],
        microcycleId: session.microcycleId ?? microcycleId,
        mesocycleId: session.mesocycleId ?? mesocycleId,
        planName: session.planName ?? planName,
      };
    }
    await repo.upsertSession(session);
    onSaved?.();
    onClose();
    } catch (e) {
      console.warn('cardio save failed', e);
    } finally {
      // Always release the flag — a rejected write used to leave the button
      // stuck on "Saving…" forever.
      setSaving(false);
    }
  };

  const derivedDistanceDisp = kmToDisplayDistance(derivedDistanceKm, units);
  const derivedSpeedDisp = kphToDisplaySpeed(derivedSpeedKph, units);

  return (
    <div className="fixed inset-0 z-40 bg-black/60 flex items-end" onClick={onClose}>
      <div className="mx-auto max-w-md w-full bg-bg-card rounded-t-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-bg-card border-b border-ink-line px-4 py-3 flex items-center justify-between">
          <div className="section-head">LOG CARDIO</div>
          <button type="button" onClick={onClose} className="w-9 h-9 rounded-md border border-ink-line text-ink-dim hover:text-ink" aria-label="Close">✕</button>
        </div>

        <div className="px-4 py-3 space-y-4 pb-8">
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="section-head">ACTIVITY</div>
              {hasFavorites && (
                <button type="button" onClick={() => setShowAll((s) => !s)} className="text-[11px] text-accent font-semibold">
                  {showAll ? 'Show favorites' : 'Show all'}
                </button>
              )}
            </div>
            <div className="flex gap-2 flex-wrap">
              {visibleActivities.map((a) => (
                <ChoicePill key={a.value} value={a.value} label={a.label} selected={activity === a.value} onSelect={(v) => setActivity(v as CardioActivity)} />
              ))}
            </div>
          </div>

          <div className={cn('grid gap-3', mode === 'treadmill' ? 'grid-cols-3' : 'grid-cols-2')}>
            <div>
              <div className="section-head mb-2">DURATION</div>
              <input
                type="text"
                inputMode="numeric"
                value={durFocused ? durationStr : clockFromDigits(durationStr)}
                onFocus={() => setDurFocused(true)}
                onBlur={() => setDurFocused(false)}
                onChange={(e) => {
                  touched.current = true;
                  const digits = e.target.value.replace(/\D/g, '').slice(0, 5);
                  setDurationStr(digits);
                  setDuration(minutesFromDigits(digits));
                }}
                placeholder="m:ss"
                aria-label="Duration"
                className="w-full bg-bg-input border border-ink-line rounded-lg px-3 py-2 text-sm text-center tnum focus:border-accent outline-none"
              />
            </div>

            {mode === 'treadmill' && (
              <>
                <div>
                  <div className="section-head mb-2">SPEED</div>
                  <InlineNumber value={speed} onChange={touch(setSpeed)} step={0.1} decimals={1} unit={speedLabel(units)} ariaLabel="Speed" />
                </div>
                <div>
                  <div className="section-head mb-2">INCLINE</div>
                  <InlineNumber value={incline} onChange={touch(setIncline)} step={0.5} decimals={1} unit="%" ariaLabel="Incline" />
                </div>
              </>
            )}

            {mode === 'distance' && (
              <div>
                <div className="section-head mb-2">DISTANCE</div>
                <InlineNumber value={distance} onChange={touch(setDistance)} step={0.1} decimals={2} unit={distanceLabel(units)} ariaLabel="Distance" />
              </div>
            )}

            {mode === 'resistance' && (
              <div>
                <div className="section-head mb-2">RESISTANCE</div>
                <InlineNumber value={resistance} onChange={touch(setResistance)} step={1} decimals={0} min={1} max={10} unit="/10" ariaLabel="Resistance" />
              </div>
            )}
          </div>

          <div className={cn('grid gap-3', (mode === 'treadmill' || mode === 'distance') ? 'grid-cols-2' : 'grid-cols-1')}>
            {(mode === 'treadmill' || mode === 'distance') && (
              <div className="rounded-lg border border-ink-line bg-bg-elev/40 px-3 py-2 text-[11px] text-ink-dim space-y-1 tnum self-end">
                {mode === 'treadmill' && derivedDistanceDisp != null && (
                  <div className="flex justify-between">
                    <span>Distance</span>
                    <span className="font-medium text-ink">{derivedDistanceDisp.toFixed(2)} {distanceLabel(units)}</span>
                  </div>
                )}
                {mode === 'distance' && derivedSpeedDisp != null && (
                  <div className="flex justify-between">
                    <span>Avg speed</span>
                    <span className="font-medium text-ink">{derivedSpeedDisp.toFixed(1)} {speedLabel(units)}</span>
                  </div>
                )}
                {mode === 'distance' && derivedPaceMinPerDispUnit != null && (
                  <div className="flex justify-between">
                    <span>Pace</span>
                    <span className="font-medium text-ink">{formatPace(derivedPaceMinPerDispUnit)} {paceLabel(units)}</span>
                  </div>
                )}
                {mode === 'treadmill' && derivedDistanceDisp == null && (
                  <div className="text-ink-mute">Enter duration + speed.</div>
                )}
                {mode === 'distance' && (derivedSpeedDisp == null || derivedPaceMinPerDispUnit == null) && (
                  <div className="text-ink-mute">Enter duration + distance.</div>
                )}
              </div>
            )}

            <div>
              <div className="section-head mb-2">AVG HEART RATE</div>
              <InlineNumber value={hr} onChange={touch(setHr)} step={1} decimals={0} unit="bpm" ariaLabel="Heart rate" />
            </div>
          </div>

          <div>
            <div className="section-head mb-2">NOTES</div>
            <textarea
              value={notes}
              onChange={(e) => { touched.current = true; setNotes(e.target.value); }}
              className="w-full min-h-[64px] px-3 py-2 rounded-lg bg-bg-input text-ink border border-ink-line focus:border-accent outline-none text-sm"
              placeholder="Anything to remember about this session…"
            />
          </div>

          <div className="flex gap-2 pt-2">
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
            <div className="flex-1" />
            <Button onClick={save} disabled={!duration || saving}>{saving ? 'Saving…' : 'Save cardio'}</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
