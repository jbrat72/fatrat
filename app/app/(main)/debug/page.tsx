'use client';
/**
 * TEMPORARY diagnostics page (/debug) — read-only dump of the user's data to
 * debug Today/Plan inconsistencies, wrong current-week, and duplicate ad-hoc
 * sessions. Lives under (main) so it renders inside the normal app shell.
 * Remove once the bugs are fixed.
 */
import { useEffect, useState } from 'react';
import { useUser } from '@/components/app';
import { PageTitle } from '@/components/ui';
import { getRepository } from '@/lib/firestore';
import { todayIso } from '@/lib/ui/date';

const short = (s: string | null | undefined) => (s ? s.slice(0, 10) : '—');

export default function DebugPage() {
  const { user, loading } = useUser();
  const [out, setOut] = useState<string>('');

  useEffect(() => {
    if (!user) return;
    setOut('Running…');
    (async () => {
      const repo = getRepository();
      const today = todayIso();
      const L: string[] = [];
      const log = (s = '') => L.push(s);
      async function tryGet<T>(label: string, fn: () => Promise<T>): Promise<T | null> {
        try { return await fn(); } catch (e) { log(`  !! ${label} ERROR: ${(e as Error)?.message ?? e}`); return null; }
      }

      log(`today: ${today}   uid: ${short(user.userId)}   mode: ${user.mode}`);
      log(`migrated: weekRepair=${!!(user as { migratedWeekStatusRepair?: boolean }).migratedWeekStatusRepair} fixed=${!!user.migratedFixedExercises}`);
      log('');

      const mesos = (await tryGet('listMesocycles', () => repo.listMesocycles(user.userId))) ?? [];
      const actives = mesos.filter((m) => m.status === 'active');
      log(`## Mesocycles: ${mesos.length} total, ${actives.length} ACTIVE${actives.length > 1 ? '  <-- PROBLEM' : ''}`);
      for (const m of mesos) log(`  [${m.status}] ${short(m.id)} "${m.name}" weekIndex=${m.weekIndex} weeks=${m.weeks} start=${m.startDate ?? '—'}`);
      log('');

      const active = await tryGet('getActivePlan', () => repo.getActivePlan(user.userId));
      log(`## getActivePlan -> ${active ? `${short(active.id)} "${active.name}" weekIndex=${active.weekIndex} start=${active.startDate ?? '—'}` : 'NULL'}`);
      if (active) {
        if (active.startDate) {
          const byDate = Math.floor((Date.parse(today) - Date.parse(active.startDate)) / (7 * 86400000)) + 1;
          log(`   current week BY DATE = ${byDate}  |  BY weekIndex = ${active.weekIndex + 1}`);
        }
        const micros = (await tryGet('listMicrocycles', () => repo.listMicrocycles(active.id))) ?? [];
        const sorted = [...micros].sort((a, b) => a.weekNumber - b.weekNumber);
        log(`   microcycles: ${micros.length}`);
        for (const mi of sorted) {
          const ss = (await tryGet(`wk${mi.weekNumber}`, () => repo.listSessionsInMicrocycle(mi.id))) ?? [];
          log(`     wk${mi.weekNumber} [${mi.status}] sessions=${ss.length} done=${ss.filter((s) => s.completed).length} dates=${ss.map((s) => s.date).sort().join(',') || '—'}`);
        }
      }
      log('');

      const todays = (await tryGet('listSessionsOnDate', () => repo.listSessionsOnDate(user.userId, today))) ?? [];
      log(`## Sessions dated TODAY (${today}): ${todays.length}`);
      for (const s of todays) log(`  ${short(s.id)} "${s.name}" done=${s.completed} meso=${short(s.mesocycleId)} micro=${short(s.microcycleId)} started=${s.startedAt ? 'y' : 'n'} ex=${s.exercises.length}`);
      log('');

      const all = (await tryGet('listSessions(1000)', () => repo.listSessions(user.userId, { limit: 1000 }))) ?? [];
      const pending = all.filter((s) => !s.completed);
      log(`## All sessions: ${all.length}  pending=${pending.length}  ad-hoc pending=${pending.filter((s) => s.mesocycleId == null).length}`);
      const counts = new Map<string, number>();
      for (const s of pending) { const k = `${s.date}|${s.name}`; counts.set(k, (counts.get(k) ?? 0) + 1); }
      const dupes = [...counts.entries()].filter(([, n]) => n > 1);
      if (dupes.length) { log(`  DUPLICATE pending:`); for (const [k, n] of dupes) log(`    ${k} -> ${n}`); }

      setOut(L.join('\n'));
    })();
  }, [user]);

  return (
    <div>
      <PageTitle title="Diagnostics" />
      <div className="px-4">
        <pre className="text-[11px] leading-snug whitespace-pre-wrap break-words bg-bg-input border border-ink-line rounded p-3">
          {!user ? (loading ? 'Loading user…' : 'Not signed in.') : (out || 'Running…')}
        </pre>
      </div>
    </div>
  );
}
