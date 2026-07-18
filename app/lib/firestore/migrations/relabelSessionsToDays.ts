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
  getFirestore, collection, doc, getDocs, setDoc, writeBatch, type Firestore,
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
 * the parent mesocycle when the field is missing. Idempotent AND
 * copy-forward-safe: any id already present in `days` is skipped, so a
 * re-run after a partial failure can never overwrite a workout the user
 * has since logged/edited in `days` with its stale legacy copy.
 *
 * Errors propagate to UserProvider's error path (visible retry screen) —
 * silently proceeding un-migrated used to leave reads pointed at `days`
 * while the data sat in `sessions` (an empty-looking history).
 */
export async function migrateSessionsToDaysForUser(profile: UserProfile): Promise<UserProfile> {
  if (profile.migratedSessionsToDays) return profile;
  const uid = profile.userId;

  // Build a lookup of mesocycle.name keyed by id so we can fill planName.
  const mesoSnap = await getDocs(collection(db(), 'users', uid, 'mesocycles'));
  const mesoNameById = new Map<string, string>();
  for (const d of mesoSnap.docs) {
    const meso = d.data() as LegacyMeso;
    if (meso.name) mesoNameById.set(meso.id, meso.name);
  }

  // Ids already in `days` — never overwrite them (see docblock).
  const daysSnap = await getDocs(collection(db(), 'users', uid, 'days'));
  const existingDayIds = new Set(daysSnap.docs.map((d) => d.id));

  // Copy each session doc to the new `days` collection in write batches.
  // Same doc id for round-trip safety.
  const sessionSnap = await getDocs(collection(db(), 'users', uid, 'sessions'));
  const toCopy = sessionSnap.docs
    .map((d) => d.data() as LegacySession)
    .filter((s) => !existingDayIds.has(s.id));
  const OPS = 450;
  for (let i = 0; i < toCopy.length; i += OPS) {
    const batch = writeBatch(db());
    for (const session of toCopy.slice(i, i + OPS)) {
      const planName = session.planName
        ?? (session.mesocycleId ? mesoNameById.get(session.mesocycleId) : undefined);
      const next: LegacySession = { ...session, planName };
      batch.set(doc(db(), 'users', uid, 'days', session.id), stripUndefined(next));
    }
    await batch.commit();
  }

  const migrated: UserProfile = {
    ...profile,
    migratedSessionsToDays: true,
    updatedAt: new Date().toISOString(),
  };
  await setDoc(doc(db(), 'users', uid), stripUndefined(migrated));
  return migrated;
}
