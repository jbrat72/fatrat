/**
 * One-shot migration: copy `users/{uid}/sessions/*` to `users/{uid}/days/*`
 * and denormalize `planName` (mesocycle.name) onto each day doc.
 *
 * The collection rename and planName denorm make the Firestore console
 * browsable — each day row is now self-describing instead of a random slug.
 *
 * Idempotent — gated by `profile.migratedSessionsToDays`. The orphan
 * `sessions` subcollection is left in place after migration; delete it
 * manually in the Firestore console once the user has been migrated. The
 * `days` collection is the authoritative source from this point on.
 *
 * Mock mode does not need this — the localStorage key was bumped on each
 * structural change to force a clean re-seed.
 */
import {
  getFirestore, collection, doc, getDocs, setDoc, type Firestore,
} from 'firebase/firestore';
import { getApps } from 'firebase/app';
import type { UserProfile } from '@/types';

interface LegacySession {
  id: string;
  userId: string;
  mesocycleId?: string;
  planName?: string;
  [k: string]: unknown;
}

interface LegacyMeso {
  id: string;
  name?: string;
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
 * Copy every session doc to the `days` collection, filling in planName from
 * the parent mesocycle when the field is missing. Idempotent. Safe to call
 * on every sign-in until it succeeds — re-runs after a partial failure
 * simply re-copy.
 */
export async function migrateSessionsToDaysForUser(profile: UserProfile): Promise<UserProfile> {
  if (profile.migratedSessionsToDays) return profile;
  try {
    const uid = profile.userId;

    // Build a lookup of mesocycle.name keyed by id so we can fill planName.
    const mesoSnap = await getDocs(collection(db(), 'users', uid, 'mesocycles'));
    const mesoNameById = new Map<string, string>();
    for (const d of mesoSnap.docs) {
      const meso = d.data() as LegacyMeso;
      if (meso.name) mesoNameById.set(meso.id, meso.name);
    }

    // Copy each session doc to the new `days` collection. Same doc id for
    // round-trip safety — anything that still references the old id keeps
    // working until the next read.
    const sessionSnap = await getDocs(collection(db(), 'users', uid, 'sessions'));
    for (const d of sessionSnap.docs) {
      const session = d.data() as LegacySession;
      const planName = session.planName
        ?? (session.mesocycleId ? mesoNameById.get(session.mesocycleId) : undefined);
      const next: LegacySession = { ...session, planName };
      await setDoc(doc(db(), 'users', uid, 'days', session.id), stripUndefined(next));
    }

    const migrated: UserProfile = {
      ...profile,
      migratedSessionsToDays: true,
      updatedAt: new Date().toISOString(),
    };
    await setDoc(doc(db(), 'users', uid), stripUndefined(migrated));
    return migrated;
  } catch (err) {
    if (typeof console !== 'undefined') {
      console.warn('[migrateSessionsToDaysForUser] failed — leaving user un-migrated', err);
    }
    return profile;
  }
}
