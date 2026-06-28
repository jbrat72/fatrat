/**
 * Timer alarm for the rest + exercise timers. Two independent paths fire
 * together for reliability:
 *   1. Web Audio (resumed on every interaction; resumes-then-schedules so a
 *      still-suspended context doesn't drop the tones).
 *   2. An HTML5 <audio> element playing a synthesized WAV — primed on the first
 *      user gesture. This often plays where Web Audio is muted/suspended.
 *
 * Both are gated by the user's Sounds setting. On iOS the hardware silent
 * switch can still mute everything — that's outside our control.
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

/* ---------- HTML5 <audio> fallback (synthesized WAV) ---------- */

function buildBeepWavUrl(): string {
  const sr = 44100, dur = 0.6, n = Math.floor(sr * dur);
  const buf = new ArrayBuffer(44 + n * 2);
  const dv = new DataView(buf);
  const ws = (off: number, s: string) => { for (let i = 0; i < s.length; i++) dv.setUint8(off + i, s.charCodeAt(i)); };
  ws(0, 'RIFF'); dv.setUint32(4, 36 + n * 2, true); ws(8, 'WAVE');
  ws(12, 'fmt '); dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 1, true);
  dv.setUint32(24, sr, true); dv.setUint32(28, sr * 2, true); dv.setUint16(32, 2, true); dv.setUint16(34, 16, true);
  ws(36, 'data'); dv.setUint32(40, n * 2, true);
  const env = (t: number, s: number, e: number) => (t >= s && t < e ? Math.sin(Math.PI * (t - s) / (e - s)) : 0);
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    let a = 0;
    a += Math.sin(2 * Math.PI * 880 * t) * env(t, 0.00, 0.16);
    a += Math.sin(2 * Math.PI * 880 * t) * env(t, 0.20, 0.36);
    a += Math.sin(2 * Math.PI * 1175 * t) * env(t, 0.40, 0.58);
    dv.setInt16(44 + i * 2, Math.max(-1, Math.min(1, a)) * 0.7 * 32767, true);
  }
  return URL.createObjectURL(new Blob([buf], { type: 'audio/wav' }));
}

let _audio: HTMLAudioElement | null = null;
let _audioPrimed = false;
function audioEl(): HTMLAudioElement | null {
  if (typeof window === 'undefined') return null;
  if (_audio) return _audio;
  try { _audio = new Audio(buildBeepWavUrl()); _audio.preload = 'auto'; } catch { _audio = null; }
  return _audio;
}

/** Resume Web Audio + prime the <audio> element. Must run in a user gesture. */
export function unlockAudio(): void {
  const c = ctx();
  if (c) {
    if (c.state === 'suspended') c.resume().catch(() => {});
    try { pulse(c, c.currentTime, 880, 0); } catch { /* ignore */ }
  }
  if (!_audioPrimed) {
    const a = audioEl();
    if (a) {
      _audioPrimed = true;
      // iOS ignores `volume`, so mute (which it honors) to prime silently, then
      // unmute once paused so the real alarm is audible later.
      a.muted = true;
      a.play().then(() => { a.pause(); a.currentTime = 0; a.muted = false; }).catch(() => { a.muted = false; });
    }
  }
}

/** Timer-done alarm. Fires both audio paths. */
export function doubleBeep(enabled = true): void {
  if (!enabled) return;
  const c = ctx();
  if (c) {
    const play = () => { const t = c.currentTime + 0.02; pulse(c, t, 880); pulse(c, t + 0.22, 880); pulse(c, t + 0.44, 1175); };
    if (c.state === 'suspended') c.resume().then(play).catch(() => {}); else play();
  }
  const a = audioEl();
  if (a) { try { a.muted = false; a.currentTime = 0; a.play().catch(() => {}); } catch { /* ignore */ } }
}

// Resume + prime audio on every interaction so a later timer beep can sound.
if (typeof window !== 'undefined') {
  for (const e of ['pointerdown', 'touchend', 'keydown', 'click'] as const) {
    window.addEventListener(e, unlockAudio, { passive: true });
  }
}
