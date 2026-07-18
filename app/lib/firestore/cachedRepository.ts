/**
 * Transparent read-cache decorator over a DataRepository.
 *
 * Why: every page (and several leaf components) fetches its own data on every
 * mount, so a Today → Plan → History → Today loop re-paid hundreds of
 * Firestore doc reads with no sharing. This wrapper gives all consumers:
 *   - in-flight dedup — concurrent identical reads (e.g. the Today page and
 *     WeeklyRings both listing sessions on the same render) share one fetch;
 *   - a short TTL — repeat reads within 30s (navigation loops, refreshTicks)
 *     are served from memory;
 *   - write-through invalidation — every mutating method drops the related
 *     keys BOTH synchronously at call time and again when the server write
 *     resolves, so a page never reads its own stale data. (The synchronous
 *     drop matters offline: the underlying Firestore local cache reflects a
 *     pending write immediately, and this layer must not mask that.)
 *
 * Results are deep-cloned per hit so consumers can sort/mutate what they get
 * without corrupting the shared cached copy (same contract as the mock repo).
 *
 * getProfile / listUsers are deliberately NOT cached — sign-in migrations
 * gate on fresh profile flags.
 */
import type { DataRepository } from './repository';

const TTL_MS = 30_000;
/** The global exercise library changes ~never at runtime — cache it longer. */
const LIBRARY_TTL_MS = 10 * 60_000;

interface Entry { at: number; promise: Promise<unknown> }

/** All live caches, so resetMockRepository (demo data reset) can nuke them. */
const registry = new Set<Map<string, Entry>>();
export function invalidateAllRepositoryCaches(): void {
  for (const cache of registry) cache.clear();
}

function clone<T>(v: T): T {
  return v == null ? v : (JSON.parse(JSON.stringify(v)) as T);
}

export function cachedRepository(base: DataRepository): DataRepository {
  const cache = new Map<string, Entry>();
  registry.add(cache);

  const invalidate = (...prefixes: string[]) => {
    for (const key of [...cache.keys()]) {
      if (prefixes.some((p) => key.startsWith(p))) cache.delete(key);
    }
  };

  function cached<T>(key: string, ttl: number, fetcher: () => Promise<T>): Promise<T> {
    const hit = cache.get(key);
    const now = Date.now();
    if (hit && now - hit.at < ttl) return (hit.promise as Promise<T>).then(clone);
    const promise = fetcher().catch((e) => {
      // Never cache a rejection.
      if (cache.get(key)?.promise === promise) cache.delete(key);
      throw e;
    });
    cache.set(key, { at: now, promise });
    return promise.then(clone);
  }

  /** Invalidate now (so post-write reads go to the source, which reflects the
   *  pending write immediately) and again on server ack (belt-and-suspenders
   *  for anything cached between the two). */
  const writeThrough = <T>(p: Promise<T>, ...prefixes: string[]): Promise<T> => {
    invalidate(...prefixes);
    p.then(() => invalidate(...prefixes)).catch(() => { /* caller handles */ });
    return p;
  };

  return {
    /* ---- Uncached ---- */
    getProfile: (uid) => base.getProfile(uid),
    upsertProfile: (p) => base.upsertProfile(p),
    listUsers: () => base.listUsers(),

    /* ---- Cached reads ---- */
    listBodyWeight: (uid) => cached(`bw:${uid}`, TTL_MS, () => base.listBodyWeight(uid)),
    listMesocycles: (uid) => cached(`mesos:list:${uid}`, TTL_MS, () => base.listMesocycles(uid)),
    getActivePlan: (uid) => cached(`mesos:active:${uid}`, TTL_MS, () => base.getActivePlan(uid)),
    getMesocycle: (id) => cached(`mesos:one:${id}`, TTL_MS, () => base.getMesocycle(id)),
    listMicrocycles: (mesoId) => cached(`micros:meso:${mesoId}`, TTL_MS, () => base.listMicrocycles(mesoId)),
    getMicrocycle: (id) => cached(`micros:one:${id}`, TTL_MS, () => base.getMicrocycle(id)),
    listSessions: (uid, opts) => cached(`sessions:list:${uid}:${opts?.limit ?? 'all'}`, TTL_MS, () => base.listSessions(uid, opts)),
    listSessionsOnDate: (uid, d) => cached(`sessions:date:${uid}:${d}`, TTL_MS, () => base.listSessionsOnDate(uid, d)),
    listSessionsInMicrocycle: (id) => cached(`sessions:micro:${id}`, TTL_MS, () => base.listSessionsInMicrocycle(id)),
    listSessionsForMeso: (id) => cached(`sessions:meso:${id}`, TTL_MS, () => base.listSessionsForMeso(id)),
    getSession: (id) => cached(`sessions:one:${id}`, TTL_MS, () => base.getSession(id)),
    getTodaySession: (uid, d) => cached(`sessions:today:${uid}:${d}`, TTL_MS, () => base.getTodaySession(uid, d)),
    listGlobalExercises: () => cached('exlib:global', LIBRARY_TTL_MS, () => base.listGlobalExercises()),
    listUserExercises: (uid) => cached(`exlib:user:${uid}`, TTL_MS, () => base.listUserExercises(uid)),
    getExercisePrefs: (uid) => cached(`exprefs:${uid}`, TTL_MS, () => base.getExercisePrefs(uid)),
    listTemplates: () => cached('templates:list', TTL_MS, () => base.listTemplates()),
    getTemplate: (id) => cached(`templates:one:${id}`, TTL_MS, () => base.getTemplate(id)),

    /* ---- Writes (pass through + invalidate) ---- */
    addBodyWeight: (uid, e) => writeThrough(base.addBodyWeight(uid, e), 'bw:'),
    upsertMesocycle: (m) => writeThrough(base.upsertMesocycle(m), 'mesos:'),
    upsertMicrocycle: (m) => writeThrough(base.upsertMicrocycle(m), 'micros:'),
    upsertSession: (s) => writeThrough(base.upsertSession(s), 'sessions:'),
    deleteSession: (id) => writeThrough(base.deleteSession(id), 'sessions:'),
    upsertUserExercise: (uid, e) => writeThrough(base.upsertUserExercise(uid, e), 'exlib:user:'),
    deleteUserExercise: (uid, id) => writeThrough(base.deleteUserExercise(uid, id), 'exlib:user:', 'exprefs:'),
    upsertExercisePrefs: (uid, p) => writeThrough(base.upsertExercisePrefs(uid, p), 'exprefs:'),
    upsertTemplate: (t) => writeThrough(base.upsertTemplate(t), 'templates:'),
    deleteTemplate: (id) => writeThrough(base.deleteTemplate(id), 'templates:'),
    // A plan batch can touch every plan-shaped collection.
    commitPlanBatch: (uid, b) => writeThrough(base.commitPlanBatch(uid, b), 'sessions:', 'mesos:', 'micros:', 'templates:'),
  };
}
