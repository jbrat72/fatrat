'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { APP_VERSION } from '@/lib/version';

const DISMISSED_KEY = 'fatrat:dismissedUpdateFor:v1';
const POLL_INTERVAL_MS = 5 * 60 * 1000; // every 5 minutes while the tab is active

/**
 * Polls /api/version and shows a toast when the deployed version is newer
 * than the one this bundle was built with. Click Update → clears caches and
 * reloads. Dismiss → suppresses the toast for that specific server version
 * (persisted in localStorage) so it doesn't keep popping back up.
 */
export function UpdateChecker() {
  const [latestVersion, setLatestVersion] = useState<string | null>(null);
  const [dismissedVersion, setDismissedVersion] = useState<string | null>(null);
  const inFlight = useRef(false);

  // Hydrate the dismissed-version cache from localStorage on mount.
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(DISMISSED_KEY);
      if (stored) setDismissedVersion(stored);
    } catch { /* ignore */ }
  }, []);

  const check = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      const res = await fetch('/api/version', { cache: 'no-store' });
      if (!res.ok) return;
      const data = (await res.json()) as { version?: string };
      if (typeof data.version === 'string') setLatestVersion(data.version);
    } catch {
      // Network blip — try again on the next tick.
    } finally {
      inFlight.current = false;
    }
  }, []);

  // Check on mount, on tab focus, on visibility change, and on a slow interval.
  useEffect(() => {
    check();
    const onFocus = () => check();
    const onVisible = () => { if (document.visibilityState === 'visible') check(); };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisible);
    const id = window.setInterval(check, POLL_INTERVAL_MS);
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisible);
      window.clearInterval(id);
    };
  }, [check]);

  const needRefresh =
    latestVersion != null &&
    latestVersion !== APP_VERSION &&
    latestVersion !== dismissedVersion;

  if (!needRefresh || latestVersion == null) return null;

  const applyUpdate = async () => {
    // Wipe any caches the browser might have stored for this origin, then reload.
    try {
      if ('caches' in window) {
        const names = await caches.keys();
        await Promise.all(names.map((n) => caches.delete(n)));
      }
    } catch { /* ignore */ }
    window.location.reload();
  };

  const dismiss = () => {
    try { window.localStorage.setItem(DISMISSED_KEY, latestVersion); } catch { /* ignore */ }
    setDismissedVersion(latestVersion);
  };

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed left-1/2 -translate-x-1/2 bottom-20 z-40 mx-auto w-[calc(100%-1.5rem)] max-w-md
                 rounded-xl border border-accent/40 bg-bg-card shadow-glow
                 flex items-center gap-2 px-3 py-2.5"
    >
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium text-ink">A new version is available</div>
        <div className="text-[11px] text-ink-mute tnum">
          v{APP_VERSION} → v{latestVersion}
        </div>
      </div>
      <button
        type="button"
        onClick={applyUpdate}
        className="shrink-0 inline-flex items-center justify-center h-9 px-3 rounded-md bg-accent text-white text-sm font-semibold"
      >
        Update
      </button>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss"
        className="shrink-0 w-9 h-9 rounded-md border border-ink-line text-ink-dim hover:text-ink"
      >
        ✕
      </button>
    </div>
  );
}
