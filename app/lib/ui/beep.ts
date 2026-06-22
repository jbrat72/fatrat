/**
 * Web Audio alarm for the rest + exercise timers.
 *
 * MOBILE/desktop unlock: browsers start an AudioContext 'suspended' and only
 * let it make sound after it's resumed inside a user gesture. The timer beep
 * fires from a setInterval (not a gesture), so we resume on every interaction
 * and, critically, when the beep fires we resume FIRST and schedule the tones
 * only after resume resolves (scheduling on a still-suspended context is
 * silently dropped — the bug that kept the alarm quiet).
 *
 * Note: on iOS the hardware silent/mute switch still mutes Web Audio — that's
 * outside our control.
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

/** One short pulse scheduled at `when`. */
function pulse(c: AudioContext, when: number, freq: number, gainPeak = 0.5) {
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = 'sine';
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0, when);
  gain.gain.linearRampToValueAtTime(gainPeak, when + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, when + 0.18);
  osc.connect(gain);
  gain.connect(c.destination);
  osc.start(when);
  osc.stop(when + 0.2);
}

/** Resume the context inside a user gesture; play an inaudible blip to unlock. */
export function unlockAudio(): void {
  const c = ctx();
  if (!c) return;
  if (c.state === 'suspended') c.resume().catch(() => {});
  try { pulse(c, c.currentTime, 880, 0); } catch { /* ignore */ }
}

/** Timer-done alarm: three rising pulses. Resumes first, then schedules. */
export function doubleBeep(enabled = true): void {
  if (!enabled) return;
  const c = ctx();
  if (!c) return;
  const play = () => {
    const t = c.currentTime + 0.02;
    pulse(c, t, 880);
    pulse(c, t + 0.22, 880);
    pulse(c, t + 0.44, 1175);
  };
  if (c.state === 'suspended') c.resume().then(play).catch(() => {});
  else play();
}

// Resume audio on every user interaction (browser only) so the context is live
// when a timer later fires its beep. Kept attached for the whole session.
if (typeof window !== 'undefined') {
  const resume = () => { const c = ctx(); if (c && c.state === 'suspended') c.resume().catch(() => {}); };
  for (const e of ['pointerdown', 'touchend', 'keydown', 'click'] as const) {
    window.addEventListener(e, resume, { passive: true });
  }
}
