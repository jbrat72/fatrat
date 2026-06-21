/**
 * Retry an async read a couple of times before giving up. Firestore reads in
 * this app go straight to the server (no offline cache), so a single transient
 * network hiccup would otherwise reject and blank the screen. Reads are
 * idempotent, so retrying is safe.
 */
export async function withRetry<T>(fn: () => Promise<T>, attempts = 3, delayMs = 350): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try { return await fn(); }
    catch (e) {
      lastErr = e;
      if (i < attempts - 1) await new Promise((r) => setTimeout(r, delayMs * (i + 1)));
    }
  }
  throw lastErr;
}
