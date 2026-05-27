/**
 * One-shot script — copies the in-code GLOBAL_EXERCISES seed into Firestore
 * at /exercises/{id}. Uses firebase-admin (bypasses security rules) so it
 * needs a service-account JSON key.
 *
 * USAGE (from app/ directory):
 *   1. In Firebase Console → Project settings → Service accounts → "Generate
 *      new private key". Save as scripts/serviceAccountKey.json (gitignored).
 *   2. npm install --save-dev firebase-admin tsx
 *   3. npx tsx scripts/migrate-exercises.ts
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { GLOBAL_EXERCISES } from '../lib/firestore/seed';

const keyPath = resolve('scripts/serviceAccountKey.json');
const serviceAccount = JSON.parse(readFileSync(keyPath, 'utf-8'));

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

async function main() {
  const total = GLOBAL_EXERCISES.length;
  console.log(`Migrating ${total} exercises → /exercises/...`);

  // Firestore batches max out at 500 writes. Our seed is well under, but keep
  // it batched for forward-compatibility.
  const CHUNK = 400;
  for (let i = 0; i < total; i += CHUNK) {
    const slice = GLOBAL_EXERCISES.slice(i, i + CHUNK);
    const batch = db.batch();
    for (const ex of slice) {
      const ref = db.collection('exercises').doc(ex.id);
      const data: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(ex)) {
        if (v !== undefined) data[k] = v;
      }
      batch.set(ref, data);
    }
    await batch.commit();
    console.log(`  wrote ${Math.min(i + CHUNK, total)} / ${total}`);
  }
  console.log('Done.');
}

main().catch((e) => {
  console.error('Migration failed:', e);
  process.exit(1);
});
