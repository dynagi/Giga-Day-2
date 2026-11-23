// Background music loop ("Melody of Nature") with gain fades (Web Audio, so fades also work on iOS),
// plus a tiny synthesized chime.

const SRC = '/audio/melody-of-nature.mp3';
const VOLUME = 0.5;

let el: HTMLAudioElement | null = null;
let ctx: AudioContext | null = null;
let gain: GainNode | null = null;
let started = false;
let muted = false;
let pauseTimer = 0;

type ACtor = typeof AudioContext;

function ensureContext(): AudioContext | null {
  if (ctx) return ctx;
  const AC: ACtor | undefined =
    window.AudioContext ?? (window as unknown as { webkitAudioContext?: ACtor }).webkitAudioContext;
  if (!AC) return null;
  try {
    ctx = new AC();
  } catch {
    ctx = null;
  }
  return ctx;
}

function fadeTo(target: number, seconds: number) {
  if (ctx && gain) {
    const g = gain.gain;
    const t = ctx.currentTime;
    g.cancelScheduledValues(t);
    g.setValueAtTime(g.value, t);
    g.linearRampToValueAtTime(target, t + seconds);
  } else if (el) {
    el.volume = target;
  }
}

function play() {
  window.clearTimeout(pauseTimer);
  ctx?.resume().catch(() => {});
  el?.play().catch(() => {});
}

function pauseAfter(ms: number) {
  window.clearTimeout(pauseTimer);
  pauseTimer = window.setTimeout(() => el?.pause(), ms);
}

/** Call from the first user gesture. */
export function startMusic() {
  if (started) return;
  started = true;
  try {
    el = new Audio(SRC);
    el.loop = true;
    el.preload = 'auto';
    const c = ensureContext();
    if (c) {
      const node = c.createMediaElementSource(el);
      gain = c.createGain();
      gain.gain.value = 0;
      node.connect(gain).connect(c.destination);
    } else {
      el.volume = VOLUME;
    }
    play();
    fadeTo(VOLUME, 2);
  } catch {
    /* audio is optional; the story continues silently */
  }
}

export function setMusicMuted(m: boolean) {
  muted = m;
  if (!started) return;
  if (m) {
    fadeTo(0, 0.5);
    pauseAfter(600);
  } else {
    play();
    fadeTo(VOLUME, 1.2);
  }
}

document.addEventListener('visibilitychange', () => {
  if (!started) return;
  if (document.hidden) {
    fadeTo(0, 0.6);
    pauseAfter(700);
  } else if (!muted) {
    play();
    fadeTo(VOLUME, 1.5);
  }
});

/** A short two-note message ping (incoming). */
export function chatPing() {
  tone([[880, 0, 0.035], [1318.5, 0.09, 0.03]], 0.5);
}
/** A tiny soft "sent" blip. */
export function chatPop() {
  tone([[660, 0, 0.025]], 0.25);
}
function tone(notes: [number, number, number][], len: number) {
  if (muted) return;
  const c = ensureContext();
  if (!c) return;
  try {
    const t = c.currentTime + 0.01;
    for (const [f, d, peak] of notes) {
      const o = c.createOscillator();
      const g = c.createGain();
      o.type = 'sine';
      o.frequency.value = f;
      g.gain.setValueAtTime(0, t + d);
      g.gain.linearRampToValueAtTime(peak, t + d + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, t + d + len);
      o.connect(g).connect(c.destination);
      o.start(t + d);
      o.stop(t + d + len + 0.05);
    }
  } catch {
    /* ignore */
  }
}

/** Soft, quiet sine chime. */
export function chime() {
  if (muted) return;
  const c = ensureContext();
  if (!c) return;
  try {
    const t = c.currentTime + 0.02;
    const out = c.createGain();
    out.gain.value = 1;
    out.connect(c.destination);
    const notes: [number, number, number][] = [
      // freq, peak gain, delay
      [1318.5, 0.05, 0],
      [1975.5, 0.025, 0.06],
      [2637, 0.012, 0.12],
    ];
    for (const [f, peak, d] of notes) {
      const o = c.createOscillator();
      const g = c.createGain();
      o.type = 'sine';
      o.frequency.value = f;
      g.gain.setValueAtTime(0, t + d);
      g.gain.linearRampToValueAtTime(peak, t + d + 0.05);
      g.gain.exponentialRampToValueAtTime(0.0001, t + d + 1.8);
      o.connect(g).connect(out);
      o.start(t + d);
      o.stop(t + d + 1.9);
    }
  } catch {
    /* ignore */
  }
}
