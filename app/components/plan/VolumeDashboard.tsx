'use client';
import { useEffect, useState } from 'react';
import { useUser } from '@/components/app';
import { Card } from '@/components/ui';
import { VolumeBars, VolumeTrafficLights } from '@/components/charts';
import { getRepository } from '@/lib/firestore';
import { weeklyVolume, muscleAtMRVRisk, type WeeklyVolumeEntry } from '@/lib/progress';
import { terminologyMode } from '@/lib/periodization';
import type { Microcycle } from '@/types';

interface Props {
  microcycle: Microcycle | null;
}

export function VolumeDashboard({ microcycle }: Props) {
  const { user } = useUser();
  const [entries, setEntries] = useState<WeeklyVolumeEntry[]>([]);

  useEffect(() => {
    if (!microcycle) { setEntries([]); return; }
    getRepository().listSessionsInMicrocycle(microcycle.id).then((sessions) => {
      setEntries(weeklyVolume(sessions));
    });
  }, [microcycle?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!user) return null;
  // Terminology, not feature depth, decides volume presentation: an ADVANCED
  // user on plain terminology sees the traffic-light view, not MEV/MAV/MRV.
  const tmode = terminologyMode(user);
  if (tmode === 'BASIC') return null;
  if (!microcycle) return null;

  const risk = muscleAtMRVRisk(entries);

  if (tmode === 'INTERMEDIATE') {
    return (
      <Card>
        <div className="flex items-center justify-between mb-1">
          <div className="section-head">THIS WEEK&apos;S TRAINING BALANCE</div>
          <div className="text-xs text-ink-dim tnum">Week {microcycle.weekNumber}</div>
        </div>
        <p className="text-xs text-ink-dim mb-2">
          How much each muscle group was worked this week.
        </p>
        <VolumeTrafficLights entries={entries} />
        <div className="mt-2.5 grid grid-cols-2 gap-1.5 text-[11px] text-ink-mute">
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-ok" /> Just right</span>
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-warn" /> Low or high</span>
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-danger" /> Too much</span>
        </div>
      </Card>
    );
  }

  // ADVANCED
  return (
    <Card>
      <div className="flex items-center justify-between mb-2">
        <div className="section-head">VOLUME · MEV / MAV / MRV</div>
        <div className="text-xs text-ink-dim tnum">Week {microcycle.weekNumber}</div>
      </div>
      {risk.length > 0 && (
        <div className="mb-3 px-3 py-2 rounded-lg border border-warn/30 bg-warn/10 text-warn text-xs">
          <span className="font-semibold uppercase tracking-wider2">Heads up: </span>
          {risk.map((r) => r.muscle).join(', ')} approaching/over MRV.
        </div>
      )}
      <VolumeBars entries={entries} />
    </Card>
  );
}
