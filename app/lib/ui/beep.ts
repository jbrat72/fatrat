/**
 * Simple Web Audio double-beep used by the rest timer and exercise timer.
 *
 * Two short sine-wave pulses at 880 Hz, ~150 ms each, separated by ~30 ms.
 * Does not repeat. Silent if the AudioContext can't be created (SSR, very
 * old browsers) or if the user has muted sounds in their profile.
 *
 * The first call creates a shared AudioContext. iOS/Safari requires audio
 * to be unlocked by a user gesture before it can play — the workout page
 * always has user taps before any timer fires, so context resume usually
 * succeeds. If it doesn't, the beep is silently skipped.
 */
let _ctx: AudioContext | null = null;

function ctx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (_ctx) return _ctx;
  const C = (window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext }).AudioContext
    ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!C) return null;
  try { _ctx = new C(); } catch { _ctx = null; }
  return _ctx;
}

/** Play a single short pulse. Internal. */
function pulse(c: AudioContext, when: number, freq: number) {
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = 'sine';
  osc.frequency.value = freq;
  // Quick attack, gentle decay — feels like a clean beep, not a click.
  gain.gain.setValueAtTime(0, when);
  gain.gain.linearRampToValueAtTime(0.22, when + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, when + 0.15);
  osc.connect(gain);
  gain.connect(c.destination);
  osc.start(when);
  osc.stop(when + 0.18);
}

/**
 * Play the timer-done double-beep. Two short pulses, then silence.
 * `enabled` should reflect the user's profile preference — pass `false` to
 * skip the beep entirely without callers having to gate the call.
 */
export function doubleBeep(enabled = true): void {
  if (!enabled) return;
  const c = ctx();
  if (!c) return;
  // Try to resume a suspended context (post-user-gesture); ignore failure.
  if (c.state === 'suspended') { c.resume().catch(() => {}); }
  const t = c.currentTime;
  pulse(c, t, 880);
  pulse(c, t + 0.20, 880);
}
