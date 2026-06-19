/**
 * Simple Web Audio double-beep used by the rest timer and exercise timer.
 *
 * Two short sine-wave pulses at 880 Hz, ~150 ms each, separated by ~30 ms.
 * Does not repeat. Silent if the AudioContext can't be created (SSR, very
 * old browsers) or if the user has muted sounds in their profile.
 *
 * MOBILE UNLOCK: iOS Safari and Android Chrome start an AudioContext in the
 * 'suspended' state and only allow it to produce sound if it is created AND
 * resumed inside a real user-gesture call stack. The timer fires its beep
 * from a setInterval callback — NOT a gesture — so the context must be
 * unlocked earlier. We install one-time gesture listeners on first import
 * (browser only) that resume the context and play an inaudible blip on the
 * user's first tap/keypress, so later timer beeps are allowed to sound.
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
function pulse(c: AudioContext, when: number, freq: number, gainPeak = 0.22) {
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = 'sine';
  osc.frequency.value = freq;
  // Quick attack, gentle decay — feels like a clean beep, not a click.
  gain.gain.setValueAtTime(0, when);
  gain.gain.linearRampToValueAtTime(gainPeak, when + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, when + 0.15);
  osc.connect(gain);
  gain.connect(c.destination);
  osc.start(when);
  osc.stop(when + 0.18);
}

/**
 * Unlock audio for mobile. Must run inside a user gesture: resumes the context
 * and plays a zero-gain blip so iOS marks it as user-activated. Safe to call
 * repeatedly. Returns true once the context is (or becomes) running.
 */
export function unlockAudio(): void {
  const c = ctx();
  if (!c) return;
  if (c.state === 'suspended') c.resume().catch(() => {});
  // Inaudible blip — some iOS versions only unlock after a node actually plays.
  try { pulse(c, c.currentTime, 880, 0); } catch { /* ignore */ }
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

// Install one-time gesture listeners (browser only) to unlock audio on the
// first interaction anywhere in the app, so timer beeps can play on mobile.
if (typeof window !== 'undefined') {
  const events: Array<keyof WindowEventMap> = ['pointerdown', 'touchend', 'keydown'];
  const onGesture = () => {
    unlockAudio();
    const c = _ctx;
    // Stop listening once the context is actually running; otherwise keep
    // trying on the next gesture (e.g. if the first resume was rejected).
    if (c && c.state === 'running') {
      events.forEach((e) => window.removeEventListener(e, onGesture));
    }
  };
  events.forEach((e) => window.addEventListener(e, onGesture));
}
