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
import { cachedRepository } from './cachedRepository';
import { isFirebaseEnabled } from '@/lib/firebase/client';

let _repo: DataRepository | null = null;

export function getRepository(): DataRepository {
  if (_repo) return _repo;
  // Wrapped in the read-cache decorator: in-flight dedup + 30s TTL + write-
  // through invalidation. See cachedRepository.ts for the rationale.
  _repo = cachedRepository(isFirebaseEnabled() ? firestoreRepository() : mockRepository());
  return _repo;
}
