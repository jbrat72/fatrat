/**
 * Returns the currently-configured DataRepository singleton.
 * Swap to Firebase later by replacing the body of this function.
 */
import { mockRepository } from './mock';
import type { DataRepository } from './repository';

let _repo: DataRepository | null = null;

export function getRepository(): DataRepository {
  if (_repo) return _repo;
  _repo = mockRepository();
  return _repo;
}
