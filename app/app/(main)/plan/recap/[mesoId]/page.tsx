'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useUser } from '@/components/app';
import { Button, Card, PageTitle, BackButton } from '@/components/ui';
import { getRepository } from '@/lib/firestore';
import { recapMesocycle, type MesoRecap } from '@/lib/progress';
import { terminologyMode } from '@/lib/periodization';
import { kgToDisplay, weightLabel } from '@/lib/ui/units';
import type { Mesocycle, Microcycle, WorkoutSession } from '@/types';

export default function MesoRecapPage() {
  const { mesoId } = useParams<{ mesoId: string }>();
  const router = useRouter();
  const { user } = useUser();
  const [meso, setMeso] = useState<Mesocycle | null>(null);
  const [recap, setRecap] = useState<MesoRecap | null>(null);

  useEffect(() => {
    if (!user || !mesoId) return;
    const load = async () => {
      const repo = getRepository();
      const m = await repo.getMesocycle(mesoId);
      setMeso(m);
      if (!m) return;
      const micros: Microcycle[] = await repo.listMicrocycles(m.id);
      // One query for the whole block (was one per week).
      const sessions: WorkoutSession[] = await repo.listSessionsForMeso(m.id);
      const targetRIRs = micros.map((mc) => mc.targetRIR ?? 2);
      setRecap(recapMesocycle(sessions, targetRIRs));
    };
    load();
  }, [user, mesoId]);

  if (!user || !meso || !recap) return <div className="p-6 text-ink-dim">Loading…</div>;

  const units = user.units;
  // Recap depth follows terminology, not raw mode: an ADVANCED user on plain
  // language gets the plain-English recap.
  const rmode = terminologyMode(user);
  const heading =
    rmode === 'BASIC' ? 'Last month' :
    rmode === 'INTERMEDIATE' ? 'Training block recap' :
    'Mesocycle review';

  const bestLift = recap.liftGains[0];

  return (
    <div>
      <div className="px-4 pt-4"><BackButton href="/plan" label="Plan" /></div>
      <PageTitle title={heading} subtitle={meso.name} />
      <div className="px-4 space-y-3">
        {/* Mode-specific top callout */}
        {rmode === 'BASIC' && (
          <Card>
            <div className="text-base">
              {recap.totalSessions > 0 ? (
                <>You finished <span className="font-semibold text-ink">{recap.totalSessions} workouts</span> this block. {bestLift && (
                  <>Your biggest jump was <span className="font-semibold text-ink">{bestLift.exerciseName}</span>{' '}
                  — up <span className="font-semibold text-accent">{kgToDisplay(Math.max(0, bestLift.delta), units)} {weightLabel(units)}</span>. Nice work! 💪</>
                )}</>
              ) : 'Block complete. Ready for the next one.'}
            </div>
          </Card>
        )}

        {rmode === 'INTERMEDIATE' && (
          <Card>
            <div className="section-head mb-2">SUMMARY</div>
            <ul className="space-y-1.5 text-sm">
              <li>You finished <b>{recap.totalSessions} workouts</b> across this block.</li>
              <li>Logged <b className="tnum">{recap.totalSets} sets</b> totalling <b className="tnum">{recap.totalReps} reps</b>.</li>
              {bestLift && bestLift.delta > 0 && (
                <li>Biggest gain: <b>{bestLift.exerciseName}</b> +<b className="tnum">{kgToDisplay(bestLift.delta, units)} {weightLabel(units)}</b>.</li>
              )}
            </ul>
          </Card>
        )}

        {rmode === 'ADVANCED' && (
          <Card>
            <div className="section-head mb-2">MESO STATS</div>
            <div className="grid grid-cols-3 gap-3 text-center">
              <Stat label="Sessions" value={`${recap.totalSessions}`} />
              <Stat label="Hard sets" value={`${recap.totalSets}`} />
              <Stat label="Volume" value={`${Math.round(recap.totalVolumeKg).toLocaleString()}`} suffix="kg" />
            </div>
            <div className="grid grid-cols-2 gap-3 mt-3 text-center">
              <Stat label="Mean RPE" value={recap.rpeMean != null ? recap.rpeMean.toFixed(1) : '—'} />
              <Stat label="RPE compliance" value={recap.rpeCompliance != null ? `${Math.round(recap.rpeCompliance * 100)}%` : '—'} />
            </div>
          </Card>
        )}

        {/* Lift gains list (visible in INTERMEDIATE+) */}
        {rmode !== 'BASIC' && recap.liftGains.length > 0 && (
          <Card>
            <div className="section-head mb-2">e1RM CHANGES</div>
            <ul className="divide-y divide-ink-line">
              {recap.liftGains.map((g) => (
                <li key={g.exerciseId} className="py-2.5 flex items-center justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium truncate">{g.exerciseName}</div>
                    <div className="text-xs text-ink-dim tnum">
                      {kgToDisplay(g.startE1RM, units)} → {kgToDisplay(g.endE1RM, units)} {weightLabel(units)}
                    </div>
                  </div>
                  <span className={'text-sm font-semibold tnum ' + (g.delta >= 0 ? 'text-ok' : 'text-danger')}>
                    {g.delta >= 0 ? '+' : ''}{kgToDisplay(g.delta, units)}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        )}

        {/* Suggested next-meso adjustments — ADVANCED */}
        {rmode === 'ADVANCED' && (
          <Card>
            <div className="section-head mb-2">SUGGESTED NEXT BLOCK</div>
            <ul className="text-sm text-ink-dim space-y-1.5 list-disc list-inside">
              {recap.rpeCompliance != null && recap.rpeCompliance < 0.5 && (
                <li>RPE compliance was below 50% — consider tightening target effort cues next block.</li>
              )}
              {recap.liftGains.some((g) => g.delta < 0) && (
                <li>Some lifts regressed — start the next block with a 1-week deload before pushing volume.</li>
              )}
              {bestLift && bestLift.delta > 0 && (
                <li>{bestLift.exerciseName} responded well — keep it in the next block.</li>
              )}
              <li>Consider rotating accessory work to avoid stagnation.</li>
            </ul>
          </Card>
        )}

        <div className="pt-2">
          <Button block size="lg" onClick={() => router.push('/plan/templates')}>Start next block</Button>
          <div className="mt-2 text-center">
            <Button variant="ghost" onClick={() => router.push('/today')}>Back to Today</Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, suffix }: { label: string; value: string; suffix?: string }) {
  return (
    <div>
      <div className="text-[10px] tracking-wider2 text-ink-mute uppercase">{label}</div>
      <div className="text-xl font-semibold numeric mt-0.5">
        {value}
        {suffix && <span className="text-ink-dim text-xs font-normal ml-1">{suffix}</span>}
      </div>
    </div>
  );
}
