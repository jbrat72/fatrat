/**
 * Returns the currently-configured DataRepository singleton.
 *
 * When Firebase env vars are present we use the Firestore-backed repo;
 * otherwise we fall back to the in-memory mock so local dev (and the
 * fake login flow) keeps working with zero configuration.
 */
import type { DataRepository } from './repository';
import { mockRepository } from './mock';
import { firestoreRepository } from './firestoreRepository';
import { isFirebaseEnabled } from '@/lib/firebase/client';

let _repo: DataRepository | null = null;

export function getRepository(): DataRepository {
  if (_repo) return _repo;
  _repo = isFirebaseEnabled() ? firestoreRepository() : mockRepository();
  return _repo;
}
