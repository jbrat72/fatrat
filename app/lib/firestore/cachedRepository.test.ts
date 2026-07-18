import { describe, it, expect, vi } from 'vitest';
import { cachedRepository } from './cachedRepository';
import type { DataRepository } from './repository';
import type { WorkoutSession } from '@/types';

const mkSession = (id: string): WorkoutSession => ({
  id, userId: 'u1', date: '2026-07-01', dayOfWeek: 3, completed: false, exercises: [], cardio: [],
});

/** Minimal stub — only the methods a given test touches are real. */
function stubRepo(overrides: Partial<DataRepository>): DataRepository {
  const nope = () => { throw new Error('not stubbed'); };
  return new Proxy({} as DataRepository, {
    get: (_t, prop: string) => (overrides as Record<string, unknown>)[prop] ?? nope,
  });
}

describe('cachedRepository', () => {
  it('dedupes concurrent identical reads into one fetch', async () => {
    const listSessions = vi.fn(async () => [mkSession('a')]);
    const repo = cachedRepository(stubRepo({ listSessions }));
    const [r1, r2] = await Promise.all([
      repo.listSessions('u1', { limit: 100 }),
      repo.listSessions('u1', { limit: 100 }),
    ]);
    expect(listSessions).toHaveBeenCalledTimes(1);
    expect(r1[0]!.id).toBe('a');
    expect(r2[0]!.id).toBe('a');
  });

  it('serves repeat reads within the TTL from cache', async () => {
    const listMesocycles = vi.fn(async () => []);
    const repo = cachedRepository(stubRepo({ listMesocycles }));
    await repo.listMesocycles('u1');
    await repo.listMesocycles('u1');
    expect(listMesocycles).toHaveBeenCalledTimes(1);
  });

  it('different args are different cache keys', async () => {
    const listSessions = vi.fn(async () => []);
    const repo = cachedRepository(stubRepo({ listSessions }));
    await repo.listSessions('u1', { limit: 100 });
    await repo.listSessions('u1', { limit: 200 });
    expect(listSessions).toHaveBeenCalledTimes(2);
  });

  it('a write invalidates the related keys synchronously', async () => {
    const listSessions = vi.fn(async () => [mkSession('a')]);
    const upsertSession = vi.fn(async (s: WorkoutSession) => s);
    const repo = cachedRepository(stubRepo({ listSessions, upsertSession }));
    await repo.listSessions('u1');
    await repo.upsertSession(mkSession('b'));
    await repo.listSessions('u1');
    expect(listSessions).toHaveBeenCalledTimes(2); // cache was dropped by the write
  });

  it('a write does NOT invalidate unrelated keys', async () => {
    const listMesocycles = vi.fn(async () => []);
    const addBodyWeight = vi.fn(async () => undefined);
    const repo = cachedRepository(stubRepo({ listMesocycles, addBodyWeight }));
    await repo.listMesocycles('u1');
    await repo.addBodyWeight('u1', { date: '2026-07-01', weightKg: 80 });
    await repo.listMesocycles('u1');
    expect(listMesocycles).toHaveBeenCalledTimes(1);
  });

  it('commitPlanBatch invalidates sessions, mesos, micros and templates', async () => {
    const listSessions = vi.fn(async () => []);
    const listMicrocycles = vi.fn(async () => []);
    const commitPlanBatch = vi.fn(async () => undefined);
    const repo = cachedRepository(stubRepo({ listSessions, listMicrocycles, commitPlanBatch }));
    await repo.listSessions('u1');
    await repo.listMicrocycles('m1');
    await repo.commitPlanBatch('u1', { sessions: [] });
    await repo.listSessions('u1');
    await repo.listMicrocycles('m1');
    expect(listSessions).toHaveBeenCalledTimes(2);
    expect(listMicrocycles).toHaveBeenCalledTimes(2);
  });

  it('cache hits are cloned — mutating a result never corrupts the cache', async () => {
    const listSessions = vi.fn(async () => [mkSession('a')]);
    const repo = cachedRepository(stubRepo({ listSessions }));
    const first = await repo.listSessions('u1');
    first.pop(); // consumer mangles its copy
    const second = await repo.listSessions('u1');
    expect(second).toHaveLength(1);
  });

  it('rejections are not cached — the next read retries', async () => {
    let calls = 0;
    const listSessions = vi.fn(async () => {
      calls += 1;
      if (calls === 1) throw new Error('transient');
      return [mkSession('a')];
    });
    const repo = cachedRepository(stubRepo({ listSessions }));
    await expect(repo.listSessions('u1')).rejects.toThrow('transient');
    const r = await repo.listSessions('u1');
    expect(r).toHaveLength(1);
  });
});
