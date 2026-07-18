/**
 * One-shot migration: retire `Macrocycle` for a user's real Firestore data.
 *
 * Reads `users/{uid}/macrocycles/*`, copies the `goal`, `startDate`,
 * `targetDate`, and `name` onto each matching mesocycle (one macro → one
 * meso under the new model), and strips `macrocycleId` from sessions.
 *
 * Idempotent — gated by `profile.migratedMacroDrop`. The orphan macrocycles
 * subcollection is left in place; delete it manually in the Firestore
 * console once a user has been migrated. Sessions inside an archived plan
 * keep their `mesocycleId` so History still resolves them.
 *
 * Mock mode does not need this — bumping the localStorage seed key forces
 * a clean re-seed. Only call this when Firebase is enabled.
 */
import {
  getFirestore, collection, doc, getDocs, setDoc, type Firestore,
} from 'firebase/firestore';
import { getApps } from 'firebase/app';
import type { UserProfile } from '@/types';

interface LegacyMacrocycle {
  id: string;
  userId: string;
  name?: string;
  goal?: string;
  startDate?: string;
  targetDate?: string;
  status?: string;
}

interface LegacyMeso {
  id: string;
  userId: string;
  name: string;
  goal?: string;
  startDate?: string;
  targetDate?: string;
  macrocycleId?: string;
  [k: string]: unknown;
}

interface LegacySession {
  id: string;
  userId: string;
  macrocycleId?: string;
  [k: string]: unknown;
}

function db(): Firestore {
  const apps = getApps();
  if (apps.length === 0) throw new Error('Firebase app not initialized.');
  return getFirestore(apps[0]!);
}

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

/**
 * Run the macrocycle-retirement migration for a single user. No-op if the
 * profile already has `migratedMacroDrop`. Errors propagate to UserProvider's
 * error path (visible retry screen) — silently proceeding un-migrated hid
 * real data problems behind a working-looking app.
 */
export async function migrateMacrocyclesForUser(profile: UserProfile): Promise<UserProfile> {
  if (profile.migratedMacroDrop) return profile;
  {
    const uid = profile.userId;
    const macroSnap = await getDocs(collection(db(), 'users', uid, 'macrocycles'));
    const macros: LegacyMacrocycle[] = macroSnap.docs.map((d) => d.data() as LegacyMacrocycle);
    const byMacroId = new Map(macros.map((m) => [m.id, m]));

    if (macros.length > 0) {
      // For every meso, fold in the parent macro's name/goal/dates if missing,
      // then drop the macrocycleId field.
      const mesoSnap = await getDocs(collection(db(), 'users', uid, 'mesocycles'));
      for (const d of mesoSnap.docs) {
        const meso = d.data() as LegacyMeso;
        const parent = meso.macrocycleId ? byMacroId.get(meso.macrocycleId) : undefined;
        const next: LegacyMeso = {
          ...meso,
          name: parent?.name ?? meso.name,
          goal: meso.goal ?? parent?.goal ?? 'build-muscle',
          startDate: meso.startDate ?? parent?.startDate ?? new Date().toISOString().slice(0, 10),
          targetDate: meso.targetDate ?? parent?.targetDate,
        };
        delete next.macrocycleId;
        await setDoc(doc(db(), 'users', uid, 'mesocycles', meso.id), stripUndefined(next));
      }

      // Strip macrocycleId from every session. Sessions also reference
      // mesocycleId/microcycleId which stay intact.
      const sessionSnap = await getDocs(collection(db(), 'users', uid, 'sessions'));
      for (const d of sessionSnap.docs) {
        const s = d.data() as LegacySession;
        if (s.macrocycleId == null) continue;
        const next: LegacySession = { ...s };
        delete next.macrocycleId;
        await setDoc(doc(db(), 'users', uid, 'sessions', s.id), stripUndefined(next));
      }
    }

    const migrated: UserProfile = {
      ...profile,
      migratedMacroDrop: true,
      updatedAt: new Date().toISOString(),
    };
    await setDoc(doc(db(), 'users', uid), stripUndefined(migrated));
    return migrated;
  }
}
