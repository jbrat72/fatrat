/**
 * Public entry point for the data layer.
 *
 * For now this exports the in-memory mock backed by localStorage. Swap to a
 * Firebase implementation by changing the import here — every UI call site
 * keeps working because it only depends on the DataRepository interface.
 */
export type { DataRepository } from './repository';
export { mockRepository, resetMockRepository } from './mock';
export { getRepository } from './client';
