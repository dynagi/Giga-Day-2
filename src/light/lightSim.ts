// The guide light's behaviour, independent of how it is drawn.
// Works in CSS pixels of the stage. Both the WebGL GuideLight and the
// CSS fallback dot render from this one object.

import { useStory } from '../state/store';
import { fx } from '../state/fx';
import { env } from '../lib/env';
import { chime } from '../audio/music';
import { clamp, clamp01, damp, easeInCubic, easeInOutCubic, easeInOutSine, easeOutCubic, now } from '../lib/ease';

export type LightMode =
  | 'off'
  | 'appearing'
  | 'drifting'
  | 'caught'
  | 'settling'
  | 'resting'
  | 'reforming'
  | 'flying'
  | 'done';
export type LightEvent = { type: 'sparkle' | 'catch' | 'twinkle'; x: number; y: number };

const HINT_AFTER = 4;
const COME_AFTER = 8;
const SELF_CATCH_AFTER = 15;
const REDUCED_AUTO = 4;

/** Base distance (world units) of the light in front of the camera. */
export const BASE_DEPTH = 6;

class LightSim {
  mode: LightMode = 'off';
  reduced = env.reducedMotion;

  // stage size in CSS px
  w = 1;
  h = 1;

  // rendered state
  x = 0;
  y = 0;
  scale = 0;
  opacity = 0;
  /** Extra glow, 0..~1.5 (waiting pulse, catch swell, final twinkle). */
  glow = 0;
  /** Whether the "come to me" pulse is on. */
  waiting = false;
  depth = BASE_DEPTH;
  trailBoost = 1;

  touches = 0;

  private modeT = 0;
  private aliveT = 0;
  private idle = 0;
  private s = 0;
  private speedBoost = 0;
  private offX = 0;
  private offY = 0;
  private offTX = 0;
  private offTY = 0;
  private leanX = 0;
  private leanY = 0;
  private come = 0;
  private fromX = 0;
  private fromY = 0;
  private twinkled = false;
  private listeners = new Set<(e: LightEvent) => void>();

  cursor = { x: 0, y: 0, active: false };

  on(fn: (e: LightEvent) => void) {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }

  private emit(e: LightEvent) {
    this.listeners.forEach((f) => f(e));
  }

  resize(w: number, h: number) {
    this.w = Math.max(1, w);
    this.h = Math.max(1, h);
  }

  get hitRadius() {
    return Math.max(56, 0.12 * Math.min(this.w, this.h));
  }

  get ndcX() {
    return (this.x / this.w) * 2 - 1;
  }
  get ndcY() {
    return -((this.y / this.h) * 2 - 1);
  }

  /** Smooth wandering path inside the central 70% of the stage. */
  private path(s: number): [number, number] {
    const ax = this.reduced ? 0.05 * this.w : 0.35 * this.w;
    const ay = this.reduced ? 0.04 * this.h : 0.35 * this.h;
    const px = 0.62 * Math.sin(0.71 * s + Math.PI / 2) + 0.38 * Math.sin(1.37 * s + Math.PI / 2);
    const py = 0.58 * Math.sin(0.53 * s - 0.9) + 0.42 * Math.sin(1.13 * s + 0.4);
    return [this.w / 2 + ax * px, this.h / 2 + ay * py];
  }

  start() {
    this.mode = 'appearing';
    this.modeT = 0;
    this.aliveT = 0;
    this.idle = 0;
    this.touches = 0;
    this.s = 0;
    this.speedBoost = 0;
    this.offX = this.offY = this.offTX = this.offTY = 0;
    this.leanX = this.leanY = 0;
    this.come = 0;
    this.waiting = false;
    this.depth = BASE_DEPTH;
    this.trailBoost = 1;
    this.glow = 0;
    this.scale = 0;
    this.opacity = 0;
    this.twinkled = false;
    [this.x, this.y] = this.path(0);
  }

  reset() {
    this.mode = 'off';
    this.opacity = 0;
    this.scale = 0;
  }

  /** A tap/click at stage coordinates during the light phase. */
  pointerDown(px: number, py: number) {
    if (this.mode !== 'drifting' && this.mode !== 'appearing') return;
    if (this.reduced || this.waiting) {
      this.catch();
      return;
    }
    const d = Math.hypot(px - this.x, py - this.y);
    if (d > this.hitRadius) return; // a miss: nothing happens, timers keep running
    this.idle = 0;
    this.touches++;
    useStory.getState().setHint(false);
    if (this.touches >= 3) this.catch();
    else this.dodge(px, py);
  }

  /** Keyboard (Enter/Space) catches it directly. */
  keyCatch() {
    if (this.mode === 'drifting' || this.mode === 'appearing') this.catch();
  }

  private dodge(px: number, py: number) {
    this.emit({ type: 'sparkle', x: this.x, y: this.y });
    let dx = this.x - px;
    let dy = this.y - py;
    let d = Math.hypot(dx, dy);
    if (d < 6) {
      const a = Math.random() * Math.PI * 2;
      dx = Math.cos(a);
      dy = Math.sin(a);
      d = 1;
    }
    dx /= d;
    dy /= d;
    const dist = 0.16 * Math.min(this.w, this.h) + 40;
    const minX = 0.17 * this.w, maxX = 0.83 * this.w;
    const minY = 0.17 * this.h, maxY = 0.83 * this.h;
    // try the "away" direction first, then rotate until it stays inside the safe area
    const tries = [0, 0.7, -0.7, 1.4, -1.4, 2.2, -2.2, Math.PI];
    let tx = this.x, ty = this.y;
    for (const r of tries) {
      const c = Math.cos(r), s = Math.sin(r);
      const nx = this.x + (dx * c - dy * s) * dist;
      const ny = this.y + (dx * s + dy * c) * dist;
      if (nx > minX && nx < maxX && ny > minY && ny < maxY) {
        tx = nx;
        ty = ny;
        break;
      }
    }
    this.offTX += tx - this.x;
    this.offTY += ty - this.y;
    this.speedBoost = 1.4;
  }

  /** Called by the poem scene when its heart dissolves: the light re-forms and the flight resumes. */
  reform() {
    if (this.mode !== 'resting' && this.mode !== 'settling') return;
    this.mode = 'reforming';
    this.modeT = 0;
    this.depth = BASE_DEPTH;
    this.x = this.w / 2;
    this.y = this.h / 2;
  }

  private catch() {
    this.mode = 'caught';
    this.modeT = 0;
    this.waiting = false;
    useStory.getState().setHint(false);
    this.emit({ type: 'catch', x: this.x, y: this.y });
    fx.wave.t0 = now();
    fx.wave.x = this.ndcX;
    fx.wave.y = this.ndcY;
    fx.wave.amp = this.reduced ? 0.45 : 1;
    chime();
  }

  tick(dtRaw: number) {
    const dt = Math.min(dtRaw, 0.1);
    this.modeT += dt;
    switch (this.mode) {
      case 'appearing': {
        const a = clamp01(this.modeT / 2);
        this.scale = 0.12 + 0.88 * easeOutCubic(a);
        this.opacity = 0.25 + 0.75 * easeInOutSine(a);
        if (a >= 1) {
          this.mode = 'drifting';
          this.modeT = 0;
        }
        break;
      }
      case 'drifting':
        this.drift(dt);
        break;
      case 'caught': {
        // a soft swell while the burst plays
        const t = this.modeT;
        this.glow += ((t < 0.5 ? 1 : 0.4) - this.glow) * damp(4, dt);
        if (t >= 1.1) {
          // the journey pauses: the light stays where she caught it and quietly rests
          this.mode = 'settling';
          this.modeT = 0;
          useStory.getState().goTo('poem');
        }
        break;
      }
      case 'settling': {
        const t = this.modeT;
        this.glow += (0 - this.glow) * damp(1.5, dt);
        this.trailBoost += (0.25 - this.trailBoost) * damp(2, dt);
        this.scale = 1 - 0.35 * easeInOutSine(t / 2.6);
        this.opacity = 1 - easeInOutSine((t - 0.4) / 2.2);
        if (t >= 2.6) {
          this.mode = 'resting';
          this.opacity = 0;
        }
        break;
      }
      case 'reforming': {
        // born again from the heart, at the center
        const a = clamp01(this.modeT / 0.9);
        this.x = this.w / 2;
        this.y = this.h / 2;
        this.scale = 0.25 + 0.75 * easeOutCubic(a);
        this.opacity = easeOutCubic(a * 1.4);
        this.glow = 0.9 * (1 - a) + 0.3 * a;
        this.trailBoost = 1;
        if (a >= 1) {
          this.mode = 'flying';
          this.modeT = 0;
          this.fromX = this.x;
          this.fromY = this.y;
          useStory.getState().goTo('transition');
        }
        break;
      }
      case 'flying':
        this.fly(dt);
        break;
      default:
        break;
    }
  }

  private drift(dt: number) {
    this.aliveT += dt;
    this.idle += dt;
    const store = useStory.getState();

    if (this.reduced) {
      if (this.idle > REDUCED_AUTO) return this.catch();
    } else {
      if (this.touches === 0 && this.aliveT > HINT_AFTER) store.setHint(true);
      if (this.idle > COME_AFTER) {
        this.waiting = true;
        this.come = Math.min(1, this.come + dt / 2.2);
      }
      if (this.idle > SELF_CATCH_AFTER) return this.catch();
    }

    // advance along the path at a steady screen speed
    const speed =
      Math.max(40, 0.1 * this.w) * (1 + this.speedBoost) * (this.reduced ? 0.3 : 1) * (1 - this.come);
    const [x0, y0] = this.path(this.s);
    const [x1, y1] = this.path(this.s + 0.001);
    const dlen = Math.hypot(x1 - x0, y1 - y0) / 0.001;
    this.s += Math.min((speed * dt) / Math.max(dlen, 1e-3), 0.6 * dt);
    this.speedBoost *= Math.exp(-dt * 1.6);

    // dodge offset: springs in quickly, relaxes back very slowly
    const k = damp(5, dt);
    this.offX += (this.offTX - this.offX) * k;
    this.offY += (this.offTY - this.offY) * k;
    const decay = Math.exp(-dt * 0.08);
    this.offTX *= decay;
    this.offTY *= decay;

    const [px, py] = this.path(this.s);
    let bx = px + this.offX;
    let by = py + this.offY;

    // curious lean toward a nearby mouse cursor
    let lx = 0, ly = 0;
    if (this.cursor.active && !this.reduced && !this.waiting) {
      const dx = this.cursor.x - bx, dy = this.cursor.y - by;
      const d = Math.hypot(dx, dy);
      const R = 220;
      if (d < R && d > 1) {
        const m = Math.min(34, d * 0.25) * (1 - d / R);
        lx = (dx / d) * m;
        ly = (dy / d) * m;
      }
    }
    const kl = damp(2.5, dt);
    this.leanX += (lx - this.leanX) * kl;
    this.leanY += (ly - this.leanY) * kl;
    bx += this.leanX;
    by += this.leanY;

    // after a while, it comes to her
    const c = easeInOutCubic(this.come);
    bx += (this.w / 2 - bx) * c;
    by += (this.h / 2 - by) * c;

    this.x = clamp(bx, 0.15 * this.w, 0.85 * this.w);
    this.y = clamp(by, 0.15 * this.h, 0.85 * this.h);
    this.scale = 1;
    this.opacity = 1;
    this.glow += ((this.come >= 1 ? 0.55 : 0) - this.glow) * damp(2, dt);
  }

  private fly(dt: number) {
    const t = this.modeT;
    const r = this.reduced;
    // 1. glide to the center, slightly into the distance
    const m = easeInOutCubic(t / 1.3);
    this.x = this.fromX + (this.w / 2 - this.fromX) * m;
    this.y = this.fromY + (this.h / 2 - this.fromY) * m;
    // 2. recede far ahead while the camera follows (4s)
    const near = BASE_DEPTH + 1.5 * easeOutCubic(t / 1.3);
    this.depth = near + (r ? 40 : 95) * easeInCubic((t - 0.9) / 3.9);
    fx.flight = easeInOutSine((t - 0.8) / 4.0);
    this.trailBoost = 1 + 2.2 * clamp01(t / 1.4);
    // 3. one twinkle when it's a bright point far ahead
    if (t >= 4.85 && !this.twinkled) {
      this.twinkled = true;
      this.emit({ type: 'twinkle', x: this.x, y: this.y });
    }
    const flash = Math.exp(-Math.pow((t - 5.0) / 0.16, 2)) * 1.6;
    this.glow += (0.3 - this.glow) * damp(2, dt);
    this.glow = Math.max(this.glow, flash);
    this.opacity = 1 - clamp01((t - 5.3) / 0.8);
    this.trailBoost *= 1 - clamp01((t - 4.6) / 0.6);
    // 4. hand over to the next phase
    if (t >= 6.2) {
      this.mode = 'done';
      this.opacity = 0;
      // the journey continues: Giga's rooftop, the phone, the hostel…
      useStory.getState().goTo('story');
    }
  }
}

export const light = new LightSim();
