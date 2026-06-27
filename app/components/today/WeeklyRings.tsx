'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useUser } from '@/components/app';
import { Card } from '@/components/ui';
import { getRepository } from '@/lib/firestore';
import { computeRingMetric, DEFAULT_RINGS, type RingMetric } from '@/lib/progress';
import { withRetry } from '@/lib/util/retry';
import type { Mesocycle, Microcycle, WorkoutSession } from '@/types';

const CIRC = 2 * Math.PI * 42; // r = 42

export function WeeklyRings({ refreshKey = 0 }: { refreshKey?: number }) {
  const { user } = useUser();
  const [metrics, setMetrics] = useState<RingMetric[] | null>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const repo = getRepository();
      try {
        const sessions = await withRetry(() => repo.listSessions(user.userId, { limit: 1000 }));
        const meso = await repo.getActivePlan(user.userId).catch(() => null);
        const micros = meso ? await repo.listMicrocycles(meso.id).catch(() => [] as Microcycle[]) : [];
        const keys = (user.dashboardRings?.length ? user.dashboardRings : DEFAULT_RINGS).slice(0, 3);
        setMetrics(keys.map((k) => computeRingMetric(k, { sessions, user, meso: meso as Mesocycle | null, micros })));
      } catch { /* keep last-good */ }
    })();
  }, [user, refreshKey]);

  if (!user || !metrics) return null;

  return (
    <Card>
      <div className="section-head mb-3">THIS WEEK</div>
      <div className="flex justify-between gap-2 text-center">
        {metrics.map((m) => <Ring key={m.key} m={m} />)}
      </div>
    </Card>
  );
}

function Ring({ m }: { m: RingMetric }) {
  const dash = Math.max(0, Math.min(1, m.pct)) * CIRC;
  const body = (
    <>
      <svg viewBox="0 0 100 100" width="86" height="86" className="mx-auto" role="img" aria-label={`${m.label}: ${m.center}`}>
        <circle cx="50" cy="50" r="42" fill="none" className="text-ink-line" stroke="currentColor" strokeWidth="10" {...(m.needsGoalLink ? { strokeDasharray: '6 8' } : {})} />
        {!m.needsGoalLink && (
          <circle cx="50" cy="50" r="42" fill="none" stroke={m.color} strokeWidth="10" strokeLinecap="round" strokeDasharray={`${dash} ${CIRC}`} transform="rotate(-90 50 50)" />
        )}
        {m.needsGoalLink ? (
          <text x="50" y="58" textAnchor="middle" className="text-ink-mute" fill="currentColor" style={{ fontSize: '28px', fontWeight: 500 }}>{m.center}</text>
        ) : (
          <>
            <text x="50" y="48" textAnchor="middle" className={m.pct > 0 ? 'text-ok' : 'text-danger'} fill="currentColor" style={{ fontSize: '17px', fontWeight: 500 }}>{m.center}</text>
            <text x="50" y="63" textAnchor="middle" className="text-ink-dim" fill="currentColor" style={{ fontSize: '10px' }}>{m.sub}</text>
          </>
        )}
      </svg>
      <div className="text-2xs text-ink-dim mt-1">{m.needsGoalLink ? `${m.label} goal` : m.label}</div>
    </>
  );
  if (m.needsGoalLink) {
    return <Link href="/plan" className="flex-1" aria-label={`Set a ${m.label.toLowerCase()} goal`}>{body}</Link>;
  }
  return <div className="flex-1">{body}</div>;
}
