'use client';
import { useEffect, useState } from 'react';
import { useUser } from '@/components/app';
import { Button, ChoicePill, InlineNumber } from '@/components/ui';
import { getRepository } from '@/lib/firestore';
import {
  kmToDisplayDistance, displayDistanceToKm,
  kphToDisplaySpeed, displaySpeedToKph,
  distanceLabel, speedLabel, paceLabel, formatPace,
} from '@/lib/ui/units';
import type { CardioActivity, CardioEntry, WorkoutSession } from '@/types';
import { todayIso } from '@/lib/ui/date';

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved?: () => void;
  dateOverride?: string;
  microcycleId?: string;
  mesocycleId?: string;
}

const ACTIVITIES: { value: CardioActivity; label: string }[] = [
  { value: 'treadmill', label: 'Treadmill' },
  { value: 'bike', label: 'Bike' },
  { value: 'walking', label: 'Walking' },
  { value: 'running-outdoor', label: 'Running' },
  { value: 'elliptical', label: 'Elliptical' },
  { value: 'rower', label: 'Rower' },
  { value: 'stair-climber', label: 'Stair climber' },
  { value: 'swimming', label: 'Swimming' },
  { value: 'other', label: 'Other' },
];

type InputMode = 'treadmill' | 'distance' | 'resistance' | 'simple';

function inputModeFor(a: CardioActivity): InputMode {
  if (a === 'treadmill') return 'treadmill';
  if (a === 'bike' || a === 'walking' || a === 'running-outdoor' || a === 'swimming') return 'distance';
  if (a === 'elliptical' || a === 'rower' || a === 'stair-climber') return 'resistance';
  return 'simple';
}

export function CardioLogModal({
  open, onClose, onSaved, dateOverride, microcycleId, mesocycleId,
}: Props) {
  const { user } = useUser();
  const [activity, setActivity] = useState<CardioActivity>('treadmill');
  const [duration, setDuration] = useState<number | undefined>(20);
  const [distance, setDistance] = useState<number | undefined>();
  const [speed, setSpeed] = useState<number | undefined>();
  const [incline, setIncline] = useState<number | undefined>(0);
  const [resistance, setResistance] = useState<number | undefined>(5);
  const [hr, setHr] = useState<number | undefined>();
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

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

  // When the activity selection changes, prefill from the most-recent entry of that type.
  useEffect(() => {
    if (!user) return;
    const last = lastByActivity[activity];
    if (!last) {
      // No history yet — reset to sensible blank defaults for this mode.
      setDuration(20);
      setDistance(undefined);
      setSpeed(undefined);
      setIncline(0);
      setResistance(5);
      setHr(undefined);
      setNotes('');
      return;
    }
    setDuration(last.durationMin ?? 20);
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
      };
    } else {
      session = {
        ...session,
        cardio: [...session.cardio, entry],
        microcycleId: session.microcycleId ?? microcycleId,
        mesocycleId: session.mesocycleId ?? mesocycleId,
      };
    }
    await repo.upsertSession(session);
    setSaving(false);
    onSaved?.();
    onClose();
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
            <div className="section-head mb-2">ACTIVITY</div>
            <div className="flex gap-2 flex-wrap">
              {ACTIVITIES.map((a) => (
                <ChoicePill key={a.value} value={a.value} label={a.label} selected={activity === a.value} onSelect={(v) => setActivity(v as CardioActivity)} />
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="section-head mb-2">DURATION</div>
              <InlineNumber value={duration} onChange={setDuration} step={5} decimals={0} unit="min" ariaLabel="Duration" />
            </div>

            {mode === 'treadmill' && (
              <>
                <div>
                  <div className="section-head mb-2">SPEED</div>
                  <InlineNumber value={speed} onChange={setSpeed} step={0.1} decimals={1} unit={speedLabel(units)} ariaLabel="Speed" />
                </div>
                <div>
                  <div className="section-head mb-2">INCLINE</div>
                  <InlineNumber value={incline} onChange={setIncline} step={0.5} decimals={1} unit="%" ariaLabel="Incline" />
                </div>
              </>
            )}

            {mode === 'distance' && (
              <div>
                <div className="section-head mb-2">DISTANCE</div>
                <InlineNumber value={distance} onChange={setDistance} step={0.1} decimals={2} unit={distanceLabel(units)} ariaLabel="Distance" />
              </div>
            )}

            {mode === 'resistance' && (
              <div>
                <div className="section-head mb-2">RESISTANCE</div>
                <InlineNumber value={resistance} onChange={setResistance} step={1} decimals={0} min={1} max={10} unit="/10" ariaLabel="Resistance" />
              </div>
            )}
          </div>

          {(mode === 'treadmill' || mode === 'distance') && (
            <div className="rounded-lg border border-ink-line bg-bg-elev/40 px-3 py-2 text-xs text-ink-dim space-y-1 tnum">
              {mode === 'treadmill' && derivedDistanceDisp != null && (
                <div className="flex justify-between">
                  <span>Distance (calculated)</span>
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
                <div className="text-ink-mute">Enter duration + speed and we&apos;ll compute the distance.</div>
              )}
              {mode === 'distance' && (derivedSpeedDisp == null || derivedPaceMinPerDispUnit == null) && (
                <div className="text-ink-mute">Enter duration + distance for speed and pace.</div>
              )}
            </div>
          )}

          <div>
            <div className="section-head mb-2">AVG HEART RATE</div>
            <InlineNumber value={hr} onChange={setHr} step={1} decimals={0} unit="bpm" ariaLabel="Heart rate" />
          </div>

          <div>
            <div className="section-head mb-2">NOTES</div>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
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
