/**
 * In-memory DataRepository implementation, optionally persisted to localStorage
 * so a refresh during dev doesn't blow away changes.
 *
 * Seeded with the 3 demo users + global exercises + templates on first load.
 */
import type {
  DataRepository,
} from './repository';
import type {
  UserProfile,
  BodyWeightEntry,
  Mesocycle,
  Microcycle,
  WorkoutSession,
  ExerciseDefinition,
  UserExercisePrefs,
  ProgramTemplate,
} from '@/types';
import {
  GLOBAL_EXERCISES,
  GLOBAL_TEMPLATES,
  DEMO_USERS,
  DEMO_MESOCYCLES,
  DEMO_MICROCYCLES,
  DEMO_SESSIONS,
  DEMO_BODYWEIGHT,
} from './seed';

// Bump this when the demo seed changes so existing stores re-seed. v5 ships
// the post-Macrocycle data model — mesos now own goal/startDate/targetDate
// directly and sessions no longer carry macrocycleId.
const STORAGE_KEY = 'fatrat:mock:v5';

interface Store {
  users: Record<string, UserProfile>;
  bodyWeight: Record<string, BodyWeightEntry[]>;
  mesocycles: Record<string, Mesocycle>;
  microcycles: Record<string, Microcycle>;
  sessions: Record<string, WorkoutSession>;
  userExercises: Record<string, ExerciseDefinition[]>;
  exercisePrefs: Record<string, UserExercisePrefs>;
  customTemplates: Record<string, ProgramTemplate>;
}

function seedStore(): Store {
  const store: Store = {
    users: {},
    bodyWeight: {},
    mesocycles: {},
    microcycles: {},
    sessions: {},
    userExercises: {},
    exercisePrefs: {},
    customTemplates: {},
  };
  for (const u of DEMO_USERS) store.users[u.userId] = u;
  for (const [uid, entries] of Object.entries(DEMO_BODYWEIGHT)) store.bodyWeight[uid] = entries;
  for (const m of DEMO_MESOCYCLES) store.mesocycles[m.id] = m;
  for (const m of DEMO_MICROCYCLES) store.microcycles[m.id] = m;
  for (const s of DEMO_SESSIONS) store.sessions[s.id] = s;
  return store;
}

function loadStore(): Store {
  if (typeof window === 'undefined') return seedStore();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const s = JSON.parse(raw) as Store;
      if (!s.customTemplates) s.customTemplates = {}; // migrate older saved stores
      if (!s.exercisePrefs) s.exercisePrefs = {};     // migrate older saved stores
      return s;
    }
  } catch {/* ignore */}
  const fresh = seedStore();
  saveStore(fresh);
  return fresh;
}

function saveStore(s: Store) {
  if (typeof window === 'undefined') return;
  try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); } catch {/* ignore */}
}

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v));
}

let _store: Store | null = null;
function store(): Store {
  if (!_store) _store = loadStore();
  return _store;
}
function persist() { if (_store) saveStore(_store); }

/** Wipe localStorage + reseed (useful for `Reset demo data` button in Settings). */
export function resetMockRepository() {
  _store = seedStore();
  persist();
}

export function mockRepository(): DataRepository {
  return {
    /* ----- Profile ----- */
    async getProfile(userId) {
      return clone(store().users[userId] ?? null);
    },
    async upsertProfile(profile) {
      store().users[profile.userId] = clone(profile);
      persist();
      return clone(profile);
    },
    async listUsers() {
      return Object.values(store().users).map(clone);
    },

    /* ----- Body weight ----- */
    async listBodyWeight(userId) {
      return clone(store().bodyWeight[userId] ?? []);
    },
    async addBodyWeight(userId, entry) {
      const list = store().bodyWeight[userId] ?? [];
      const filtered = list.filter((e) => e.date !== entry.date);
      filtered.push(entry);
      filtered.sort((a, b) => a.date.localeCompare(b.date));
      store().bodyWeight[userId] = filtered;
      persist();
    },

    /* ----- Plans (Meso) ----- */
    async listMesocycles(userId) {
      return Object.values(store().mesocycles)
        .filter((m) => m.userId === userId)
        .map(clone);
    },
    async getActivePlan(userId) {
      return clone(
        Object.values(store().mesocycles)
          .find((m) => m.userId === userId && m.status === 'active') ?? null,
      );
    },
    async getMesocycle(mesoId) {
      return clone(store().mesocycles[mesoId] ?? null);
    },
    async upsertMesocycle(m) {
      store().mesocycles[m.id] = clone(m); persist();
      return clone(m);
    },

    /* ----- Micro ----- */
    async listMicrocycles(mesoId) {
      return Object.values(store().microcycles)
        .filter((m) => m.mesocycleId === mesoId)
        .sort((a, b) => a.weekNumber - b.weekNumber)
        .map(clone);
    },
    async getMicrocycle(microId) {
      return clone(store().microcycles[microId] ?? null);
    },
    async upsertMicrocycle(m) {
      store().microcycles[m.id] = clone(m); persist();
      return clone(m);
    },

    /* ----- Sessions ----- */
    async listSessions(userId, opts) {
      const all = Object.values(store().sessions)
        .filter((s) => s.userId === userId)
        .sort((a, b) => b.date.localeCompare(a.date));
      return clone(opts?.limit ? all.slice(0, opts.limit) : all);
    },
    async listSessionsInMicrocycle(microId) {
      return Object.values(store().sessions)
        .filter((s) => s.microcycleId === microId)
        .sort((a, b) => a.date.localeCompare(b.date))
        .map(clone);
    },
    async listSessionsOnDate(userId, isoDate) {
      return Object.values(store().sessions)
        .filter((s) => s.userId === userId && s.date === isoDate)
        .sort((a, b) => (a.startedAt ?? '').localeCompare(b.startedAt ?? ''))
        .map(clone);
    },
    async listSessionsForMeso(mesoId) {
      return Object.values(store().sessions)
        .filter((s) => s.mesocycleId === mesoId)
        .sort((a, b) => a.date.localeCompare(b.date))
        .map(clone);
    },
    async getSession(sessionId) {
      return clone(store().sessions[sessionId] ?? null);
    },
    async upsertSession(s) {
      store().sessions[s.id] = clone(s); persist();
      return clone(s);
    },
    async deleteSession(sessionId) {
      delete store().sessions[sessionId]; persist();
    },
    async getTodaySession(userId, isoDate) {
      const todays = Object.values(store().sessions).find(
        (s) => s.userId === userId && s.date === isoDate,
      );
      return clone(todays ?? null);
    },

    /* ----- Exercise library ----- */
    async listGlobalExercises() {
      return clone(GLOBAL_EXERCISES);
    },
    async listUserExercises(userId) {
      return clone(store().userExercises[userId] ?? []);
    },
    async upsertUserExercise(userId, e) {
      const list = store().userExercises[userId] ?? [];
      const filtered = list.filter((x) => x.id !== e.id);
      filtered.push({ ...e, isCustom: true, ownerUserId: userId });
      store().userExercises[userId] = filtered; persist();
      return clone(e);
    },
    async deleteUserExercise(userId, exerciseId) {
      const list = store().userExercises[userId] ?? [];
      store().userExercises[userId] = list.filter((x) => x.id !== exerciseId);
      // also drop it from this user's prefs so we don't keep dangling ids
      const prefs = store().exercisePrefs[userId];
      if (prefs) {
        prefs.favorites = prefs.favorites.filter((id) => id !== exerciseId);
        prefs.hidden = prefs.hidden.filter((id) => id !== exerciseId);
      }
      persist();
    },
    async getExercisePrefs(userId) {
      return clone(store().exercisePrefs[userId] ?? { favorites: [], hidden: [] });
    },
    async upsertExercisePrefs(userId, prefs) {
      store().exercisePrefs[userId] = clone(prefs); persist();
      return clone(prefs);
    },

    /* ----- Templates ----- */
    async listTemplates() {
      return clone([...GLOBAL_TEMPLATES, ...Object.values(store().customTemplates)]);
    },
    async getTemplate(id) {
      return clone(
        store().customTemplates[id] ?? GLOBAL_TEMPLATES.find((t) => t.id === id) ?? null,
      );
    },
    async upsertTemplate(t) {
      store().customTemplates[t.id] = clone(t); persist();
      return clone(t);
    },
    async deleteTemplate(id) {
      delete store().customTemplates[id]; persist();
    },

    /* ----- Batched writes ----- */
    async commitPlanBatch(_userId, planBatch) {
      const s = store();
      for (const m of planBatch.mesocycles ?? []) s.mesocycles[m.id] = clone(m);
      for (const mi of planBatch.microcycles ?? []) s.microcycles[mi.id] = clone(mi);
      for (const ss of planBatch.sessions ?? []) s.sessions[ss.id] = clone(ss);
      for (const t of planBatch.templates ?? []) s.customTemplates[t.id] = clone(t);
      for (const id of planBatch.deleteSessionIds ?? []) delete s.sessions[id];
      persist(); // single flush — the whole batch lands together
    },
  };
}
