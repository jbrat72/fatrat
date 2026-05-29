/**
 * Firestore-backed DataRepository.
 *
 * Data layout:
 *   exercises/{id}                           — global library, read-only for users
 *   users/{uid}                              — profile doc
 *   users/{uid}/bodyWeight/{date}            — body weight entries, doc id = ISO date
 *   users/{uid}/macrocycles/{macroId}
 *   users/{uid}/mesocycles/{mesoId}
 *   users/{uid}/microcycles/{microId}
 *   users/{uid}/sessions/{sessionId}
 *   users/{uid}/customExercises/{exId}       — user-created custom exercises
 *   users/{uid}/templates/{templateId}       — user-saved custom templates
 *   users/{uid}/exercisePrefs/main           — single doc: favorites + hidden
 *
 * Methods that take explicit userId use that path. Methods that don't (e.g.
 * getMesocycle, listTemplates) operate on the currently signed-in user via
 * Firebase Auth's currentUser.uid. Throws if no user is signed in.
 */
import {
  getFirestore, collection, collectionGroup, doc, getDoc, getDocs,
  setDoc, query, where, orderBy, limit as limitFn, type Firestore,
} from 'firebase/firestore';
import { getApps } from 'firebase/app';
import { getFirebaseAuth } from '@/lib/firebase/client';
import type { DataRepository } from './repository';
import type {
  UserProfile, BodyWeightEntry, Macrocycle, Mesocycle, Microcycle,
  WorkoutSession, ExerciseDefinition, UserExercisePrefs, ProgramTemplate,
} from '@/types';
import { GLOBAL_EXERCISES, GLOBAL_TEMPLATES } from './seed';

let _db: Firestore | null = null;
function db(): Firestore {
  if (_db) return _db;
  const apps = getApps();
  if (apps.length === 0) {
    throw new Error('Firebase app not initialized. Import @/lib/firebase/client first.');
  }
  _db = getFirestore(apps[0]!);
  return _db;
}

function currentUid(): string {
  const auth = getFirebaseAuth();
  const uid = auth?.currentUser?.uid;
  if (!uid) throw new Error('No signed-in user');
  return uid;
}

/** Firestore rejects undefined values — strip them recursively before writing. */
function stripUndefined<T>(value: T): T {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map((v) => stripUndefined(v)) as unknown as T;
  if (typeof value !== 'object') return value;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (v === undefined) continue;
    out[k] = stripUndefined(v);
  }
  return out as T;
}

// Path helpers
const userDoc = (uid: string) => doc(db(), 'users', uid);
const subCol = (uid: string, name: string) => collection(db(), 'users', uid, name);
const subDoc = (uid: string, name: string, id: string) => doc(db(), 'users', uid, name, id);

export function firestoreRepository(): DataRepository {
  return {
    /* ---- Profile ---- */
    async getProfile(userId) {
      const snap = await getDoc(userDoc(userId));
      return snap.exists() ? (snap.data() as UserProfile) : null;
    },
    async upsertProfile(profile) {
      await setDoc(userDoc(profile.userId), stripUndefined(profile));
      return profile;
    },
    async listUsers() {
      // Not exposed in Firebase mode — DemoUserPicker is hidden anyway.
      return [];
    },

    /* ---- Body weight ---- */
    async listBodyWeight(userId) {
      const snap = await getDocs(query(subCol(userId, 'bodyWeight'), orderBy('date', 'asc')));
      return snap.docs.map((d) => d.data() as BodyWeightEntry);
    },
    async addBodyWeight(userId, entry) {
      await setDoc(subDoc(userId, 'bodyWeight', entry.date), stripUndefined(entry));
    },

    /* ---- Macrocycles ---- */
    async listMacrocycles(userId) {
      const snap = await getDocs(subCol(userId, 'macrocycles'));
      return snap.docs.map((d) => d.data() as Macrocycle);
    },
    async getActiveMacrocycle(userId) {
      const q = query(subCol(userId, 'macrocycles'), where('status', '==', 'active'), limitFn(1));
      const snap = await getDocs(q);
      return snap.empty ? null : (snap.docs[0]!.data() as Macrocycle);
    },
    async upsertMacrocycle(m) {
      await setDoc(subDoc(m.userId, 'macrocycles', m.id), stripUndefined(m));
      return m;
    },

    /* ---- Mesocycles ---- */
    async listMesocycles(macroId) {
      const uid = currentUid();
      const q = query(subCol(uid, 'mesocycles'), where('macrocycleId', '==', macroId));
      const snap = await getDocs(q);
      return snap.docs.map((d) => d.data() as Mesocycle);
    },
    async getMesocycle(mesoId) {
      const uid = currentUid();
      const snap = await getDoc(subDoc(uid, 'mesocycles', mesoId));
      return snap.exists() ? (snap.data() as Mesocycle) : null;
    },
    async upsertMesocycle(m) {
      await setDoc(subDoc(m.userId, 'mesocycles', m.id), stripUndefined(m));
      return m;
    },

    /* ---- Microcycles ---- */
    async listMicrocycles(mesoId) {
      const uid = currentUid();
      const q = query(subCol(uid, 'microcycles'), where('mesocycleId', '==', mesoId));
      const snap = await getDocs(q);
      return snap.docs.map((d) => d.data() as Microcycle);
    },
    async getMicrocycle(microId) {
      const uid = currentUid();
      const snap = await getDoc(subDoc(uid, 'microcycles', microId));
      return snap.exists() ? (snap.data() as Microcycle) : null;
    },
    async upsertMicrocycle(m) {
      await setDoc(subDoc(m.userId, 'microcycles', m.id), stripUndefined(m));
      return m;
    },

    /* ---- Sessions ---- */
    async listSessions(userId, opts) {
      const q = opts?.limit
        ? query(subCol(userId, 'sessions'), orderBy('date', 'desc'), limitFn(opts.limit))
        : query(subCol(userId, 'sessions'), orderBy('date', 'desc'));
      const snap = await getDocs(q);
      return snap.docs.map((d) => d.data() as WorkoutSession);
    },
    async listSessionsInMicrocycle(microId) {
      const uid = currentUid();
      // Firestore would require a composite index for where + orderBy on
      // different fields. Sort client-side instead — session counts per
      // micro are tiny (3-6), and this skips an index roundtrip.
      const q = query(subCol(uid, 'sessions'), where('microcycleId', '==', microId));
      const snap = await getDocs(q);
      const out = snap.docs.map((d) => d.data() as WorkoutSession);
      out.sort((a, b) => a.date.localeCompare(b.date));
      return out;
    },
    async getSession(sessionId) {
      const uid = currentUid();
      const snap = await getDoc(subDoc(uid, 'sessions', sessionId));
      return snap.exists() ? (snap.data() as WorkoutSession) : null;
    },
    async upsertSession(s) {
      await setDoc(subDoc(s.userId, 'sessions', s.id), stripUndefined(s));
      return s;
    },
    async getTodaySession(userId, isoDate) {
      const q = query(subCol(userId, 'sessions'), where('date', '==', isoDate), limitFn(1));
      const snap = await getDocs(q);
      return snap.empty ? null : (snap.docs[0]!.data() as WorkoutSession);
    },

    /* ---- Exercise library ---- */
    async listGlobalExercises() {
      const snap = await getDocs(collection(db(), 'exercises'));
      if (snap.empty) {
        // Migration not yet run — fall back to the in-code seed so the app
        // still works. Remove this fallback once the global library is
        // confidently populated in Firestore.
        if (typeof console !== 'undefined') {
          console.warn('[firestoreRepository] /exercises collection is empty — falling back to GLOBAL_EXERCISES seed.');
        }
        return GLOBAL_EXERCISES;
      }
      return snap.docs.map((d) => d.data() as ExerciseDefinition);
    },
    async listUserExercises(userId) {
      const snap = await getDocs(subCol(userId, 'customExercises'));
      return snap.docs.map((d) => d.data() as ExerciseDefinition);
    },
    async upsertUserExercise(userId, e) {
      const payload: ExerciseDefinition = { ...e, isCustom: true, ownerUserId: userId };
      await setDoc(subDoc(userId, 'customExercises', e.id), stripUndefined(payload));
      return payload;
    },
    async deleteUserExercise(userId, exerciseId) {
      const { deleteDoc } = await import('firebase/firestore');
      await deleteDoc(subDoc(userId, 'customExercises', exerciseId));
      // Also drop from prefs so we don't keep dangling ids.
      const prefsSnap = await getDoc(subDoc(userId, 'exercisePrefs', 'main'));
      if (prefsSnap.exists()) {
        const prefs = prefsSnap.data() as UserExercisePrefs;
        const next: UserExercisePrefs = {
          favorites: prefs.favorites.filter((id) => id !== exerciseId),
          hidden: prefs.hidden.filter((id) => id !== exerciseId),
        };
        await setDoc(subDoc(userId, 'exercisePrefs', 'main'), next);
      }
    },
    async getExercisePrefs(userId) {
      const snap = await getDoc(subDoc(userId, 'exercisePrefs', 'main'));
      return snap.exists()
        ? (snap.data() as UserExercisePrefs)
        : { favorites: [], hidden: [] };
    },
    async upsertExercisePrefs(userId, prefs) {
      await setDoc(subDoc(userId, 'exercisePrefs', 'main'), stripUndefined(prefs));
      return prefs;
    },

    /* ---- Templates ---- */
    async listTemplates() {
      const uid = currentUid();
      const snap = await getDocs(subCol(uid, 'templates'));
      const userTpls = snap.docs.map((d) => d.data() as ProgramTemplate);
      // GLOBAL_TEMPLATES still ships in code (not migrated to Firestore).
      return [...GLOBAL_TEMPLATES, ...userTpls];
    },
    async getTemplate(id) {
      // Try the in-code global library first; it's free and synchronous.
      const global = GLOBAL_TEMPLATES.find((t) => t.id === id);
      if (global) return global;
      const uid = currentUid();
      const snap = await getDoc(subDoc(uid, 'templates', id));
      return snap.exists() ? (snap.data() as ProgramTemplate) : null;
    },
    async upsertTemplate(t) {
      const uid = currentUid();
      await setDoc(subDoc(uid, 'templates', t.id), stripUndefined(t));
      return t;
    },
  };
}
