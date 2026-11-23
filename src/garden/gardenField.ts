export type Quality = 'low' | 'high';

/**
 * The lavender meadow: a procedural 2D-canvas flower field that grows in sequence
 * (ground → grass → stems → blooms) and then sways gently in the breeze.
 *
 * Everything is generated from a fixed seed, so the field looks the same on every
 * visit and survives a resize mid-growth without jumping. Fully bloomed heads are
 * cached as small sprites; only flowers that are still opening are drawn petal by petal.
 *
 * Day 2 additions: a second wave of flowers that stays dormant until `bloom()` is
 * called, then grows live; plus butterflies, drifting petals and warm fireflies.
 */

/* ------------------------------------------------------------------ utils */

type RGB = [number, number, number];

const hex = (h: string): RGB => {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const mix = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const css = (c: RGB, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
const DEEP: RGB = [30, 18, 48];
const LIGHT: RGB = [255, 249, 255];
/** Negative darkens toward deep violet (never black); positive lightens. */
const shade = (c: RGB, t: number): RGB => (t < 0 ? mix(c, DEEP, -t) : mix(c, LIGHT, t));
const HAZE: RGB = hex('#7d68a8');

const TAU = Math.PI * 2;
const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const easeOutCubic = (p: number) => 1 - (1 - p) ** 3;
const easeInOutSine = (p: number) => -(Math.cos(Math.PI * p) - 1) / 2;
const easeOutBack = (p: number, s = 1.25) => 1 + (s + 1) * (p - 1) ** 3 + s * (p - 1) ** 2;
const smooth = (a: number, b: number, v: number) => {
  const p = clamp01((v - a) / (b - a));
  return p * p * (3 - 2 * p);
};

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ---------------------------------------------------------------- palette */

const COLORS = {
  lavender: ['#b49ddc', '#a68bd8', '#c4afeb', '#9d86d2'],
  purple: ['#8d6bc9', '#7b5abd', '#9878d0'],
  lilac: ['#dccbf6', '#cdb8f0'],
  pink: ['#f2bdd6', '#eca8c9'],
  rose: ['#d695a8', '#c88698'],
  cream: ['#f6eee0', '#fff6ec'],
  yellow: ['#e5cc7f', '#d8bd6a'],
} as const;
type Hue = keyof typeof COLORS;

/** Lavender leads; the rest keep the meadow varied. */
const HUE_WEIGHTS: [Hue, number][] = [
  ['lavender', 30],
  ['purple', 14],
  ['lilac', 14],
  ['pink', 13],
  ['rose', 10],
  ['cream', 12],
  ['yellow', 7],
];

type Kind = 'spike' | 'daisy' | 'cosmos' | 'round' | 'peony' | 'cluster';

const KIND_WEIGHTS: [Kind, number][] = [
  ['spike', 28],
  ['daisy', 16],
  ['cosmos', 17],
  ['round', 16],
  ['peony', 9],
  ['cluster', 17],
];

const KIND_HUES: Partial<Record<Kind, [Hue, number][]>> = {
  spike: [['lavender', 65], ['purple', 35]],
  daisy: [['cream', 35], ['lilac', 25], ['lavender', 20], ['yellow', 10], ['pink', 10]],
  round: [['pink', 25], ['rose', 20], ['lavender', 25], ['lilac', 15], ['cream', 15]],
  peony: [['pink', 30], ['rose', 20], ['lavender', 25], ['cream', 15], ['lilac', 10]],
  cluster: [['cream', 30], ['lilac', 30], ['pink', 20], ['lavender', 20]],
};

const KIND_SIZE: Record<Kind, number> = { spike: 1.2, daisy: 1, cosmos: 1.05, round: 0.95, peony: 1.45, cluster: 0.85 };

/* ------------------------------------------------------------------ layers */

interface LayerDef {
  share: number;
  ground: number; // top of this ground band, fraction of H
  base: [number, number];
  height: [number, number];
  size: number;
  alpha: number;
  haze: number; // how far colours fade toward the haze (depth)
  stemW: number;
  stemCol: string;
  leafCol: string;
  groundTop: string;
  groundBottom: string;
  grassSpacing: number;
  grassH: [number, number];
  grassW: [number, number];
  grassCols: string[];
}

const LAYERS: LayerDef[] = [
  {
    share: 0.34,
    ground: 0.79,
    base: [0.8, 0.84],
    height: [0.1, 0.3],
    size: 0.58,
    alpha: 0.72,
    haze: 0.3,
    stemW: 1.1,
    stemCol: '#58705f',
    leafCol: '#5d7663',
    groundTop: '#384a44',
    groundBottom: '#2a3236',
    grassSpacing: 5.2,
    grassH: [0.025, 0.065],
    grassW: [2, 3.4],
    grassCols: ['#4d6457', '#566f61', '#5f6b6e'],
  },
  {
    share: 0.36,
    ground: 0.858,
    base: [0.865, 0.91],
    height: [0.13, 0.4],
    size: 0.82,
    alpha: 0.92,
    haze: 0.14,
    stemW: 1.5,
    stemCol: '#5a8662',
    leafCol: '#5f8f64',
    groundTop: '#2c4739',
    groundBottom: '#1f2d29',
    grassSpacing: 4.4,
    grassH: [0.035, 0.085],
    grassW: [2.6, 4.2],
    grassCols: ['#4f7a58', '#5e8a63', '#3f6a4d', '#6b9367'],
  },
  {
    share: 0.3,
    ground: 0.94,
    base: [0.95, 1.01],
    height: [0.09, 0.32],
    size: 1.08,
    alpha: 1,
    haze: 0,
    stemW: 2,
    stemCol: '#4e7e56',
    leafCol: '#558b5b',
    groundTop: '#243a2f',
    groundBottom: '#121b18',
    grassSpacing: 3.9,
    grassH: [0.04, 0.095],
    grassW: [3.4, 6],
    grassCols: ['#365d42', '#467352', '#2d5038', '#5a895c'],
  },
];

/* ------------------------------------------------------------------- types */

interface Blade {
  x: number;
  by: number;
  h: number;
  w: number;
  lean: number;
  curve: number;
  start: number;
  dur: number;
  phase: number;
  freq: number;
  amp: number;
}

interface Leaf {
  at: number;
  side: number;
  len: number;
}

interface Spark {
  a: number;
  dist: number;
  size: number;
  delay: number;
}

interface Floret {
  dx: number;
  dy: number;
  r: number;
}

interface Flower {
  kind: Kind;
  x: number;
  by: number;
  h: number;
  curve: number;
  lean: number;
  r: number;
  petals: number;
  rot: number;
  tilt: number;
  squash: number;
  col: RGB;
  center: RGB;
  stemStart: number;
  stemDur: number;
  bloomStart: number;
  bloomDur: number;
  phase: number;
  freq: number;
  amp: number;
  leaves: Leaf[];
  sparks: Spark[] | null;
  florets: Floret[] | null;
  buds: number;
  sprite: HTMLCanvasElement | null;
  ext: number;
  /** Second-wave flowers: seconds after `bloom()` when the stem starts (-1 for the first wave). */
  rel: number;
  // per-frame
  hx: number;
  hy: number;
  ang: number;
  /** Stem growth 0..1 and current sway offset. */
  g: number;
  sw: number;
}

interface Band {
  pts: number[]; // y for each x step
  step: number;
  fill: CanvasGradient;
  start: number;
}

interface Layer {
  def: LayerDef;
  band: Band;
  grassBack: Blade[][];
  grassFront: Blade[][];
  flowers: Flower[];
}

interface Mote {
  x: number;
  y: number;
  speed: number;
  phase: number;
  r: number;
  tw: number;
}

interface Butterfly {
  fore: boolean;
  size: number;
  col: RGB;
  col2: RGB;
  alpha: number;
  delay: number;
  fromX: number;
  fromY: number;
  cx: number;
  cy: number;
  ax: number;
  ay: number;
  w: [number, number, number, number];
  p: [number, number, number, number];
  flap: number;
  phase: number;
}

interface Petal {
  x: number;
  y: number;
  vy: number;
  vx: number;
  size: number;
  rot: number;
  spin: number;
  phase: number;
  col: RGB;
  delay: number;
}

interface Firefly {
  x: number;
  y: number;
  ax: number;
  ay: number;
  w: number;
  phase: number;
  blink: number;
  r: number;
  delay: number;
}

interface Field {
  W: number;
  H: number;
  u: number;
  layers: Layer[];
  motes: Mote[];
  haze: CanvasGradient;
  settleAt: number;
  /** Seconds from `bloom()` until the second wave is fully open. */
  bloomSpan: number;
  butterflies: Butterfly[];
  petals: Petal[];
  fireflies: Firefly[];
}

/* ------------------------------------------------------------- generation */

/** Timeline (seconds). Background + glow fade in via CSS during the first ~2.5 s. */
const GROUND_FROM = 0.9;
const GRASS_FROM = 2.0;
const GRASS_SPAN = 3.6;
const STEM_FROM = 3.3;
const STEM_SPAN = 4.3;
const GOLDEN = 0.6180339887;
/** Second wave: spread of stem starts after `bloom()`, and its size relative to the first wave. */
const WAVE2_SPAN = 6.5;
const WAVE2_SHARE = 0.65;

function build(ctx: CanvasRenderingContext2D, W: number, H: number, quality: Quality): Field {
  const rnd = mulberry32(0x1a7e4d3);
  const R = (a: number, b: number) => a + (b - a) * rnd();
  const pickW = <T,>(list: [T, number][]): T => {
    let total = 0;
    for (const [, w] of list) total += w;
    let v = rnd() * total;
    for (const [item, w] of list) if ((v -= w) <= 0) return item;
    return list[list.length - 1][0];
  };
  const pick = <T,>(arr: readonly T[]): T => arr[Math.floor(rnd() * arr.length)];

  const low = quality === 'low';
  const u = clamp(Math.max(Math.min(W, H) * 0.026, Math.sqrt(W * H) * 0.021), 9, 21);
  // Portrait screens are tall and narrow: keep stems from looking spindly.
  const hScale = clamp(0.6 + 0.4 * (W / H), 0.78, 1);
  const nFlowers = Math.round(clamp(W / 9, 64, low ? 110 : 170));
  const grassDensity = low ? 0.7 : 1;
  let settleAt = 0;
  let bloomSpan = 0;

  const layers: Layer[] = LAYERS.map((def, k) => {
    /* Ground band with a soft, rolling top edge. */
    const step = 20;
    const p1 = R(0, TAU);
    const p2 = R(0, TAU);
    const pts: number[] = [];
    for (let x = 0; x <= W + step; x += step) {
      pts.push(H * def.ground + H * 0.011 * Math.sin(x * 0.0055 + p1) + H * 0.006 * Math.sin(x * 0.017 + p2));
    }
    const top = def.ground - 0.022;
    const fill = ctx.createLinearGradient(0, H * top, 0, H);
    const [r0, g0, b0] = hex(def.groundTop);
    fill.addColorStop(0, `rgba(${r0},${g0},${b0},0)`);
    fill.addColorStop(clamp(0.045 / (1 - top), 0, 0.5), def.groundTop);
    fill.addColorStop(1, def.groundBottom);
    const band: Band = { pts, step, fill, start: GROUND_FROM + k * 0.28 };

    /* Grass: spread evenly, grown in a balanced, random-looking order. */
    const nb = Math.round((W / def.grassSpacing) * grassDensity);
    const grassBack: Blade[][] = def.grassCols.map(() => []);
    const grassFront: Blade[][] = def.grassCols.map(() => []);
    for (let i = 0; i < nb; i++) {
      const frac = (i * GOLDEN + rnd() * 0.2) % 1;
      const b: Blade = {
        x: ((i + R(0, 1)) / nb) * (W + 20) - 10,
        by: H * R(def.base[0] - 0.005, def.base[1] + 0.01),
        h: H * (def.grassH[0] + (def.grassH[1] - def.grassH[0]) * rnd() ** 1.3) * hScale,
        w: R(def.grassW[0], def.grassW[1]),
        lean: R(-0.28, 0.28),
        curve: R(-0.22, 0.22),
        start: GRASS_FROM + frac * GRASS_SPAN + k * 0.2,
        dur: R(0.9, 1.7),
        phase: R(0, TAU),
        freq: R(0.7, 1.25),
        amp: R(0.05, 0.11),
      };
      settleAt = Math.max(settleAt, b.start + b.dur);
      const ci = Math.floor(rnd() * def.grassCols.length);
      (rnd() < 0.38 ? grassFront : grassBack)[ci].push(b);
    }

    /* Flowers. */
    const n = Math.round(nFlowers * def.share);
    const nx = Math.round(n * WAVE2_SHARE);
    const flowers: Flower[] = [];
    for (let i = 0; i < n + nx; i++) {
      const extra = i >= n;
      const ii = extra ? i - n : i;
      const nn = extra ? nx : n;
      const kind = pickW(KIND_WEIGHTS);
      const hue = pickW(KIND_HUES[kind] ?? HUE_WEIGHTS);
      const base = hex(pick(COLORS[hue]));
      const col = mix(base, HAZE, def.haze);
      const r = u * def.size * KIND_SIZE[kind] * R(0.8, 1.2);
      const frac = (ii * GOLDEN + k * 0.29 + rnd() * 0.12) % 1;
      const stemDur = R(1.5, 2.3);
      const bloomDur = kind === 'spike' ? R(1.3, 1.8) : R(0.95, 1.4);
      // The second wave sleeps (Infinity) until bloom() wakes it.
      const rel = extra ? frac * WAVE2_SPAN + k * 0.35 : -1;
      const stemStart = extra ? Infinity : STEM_FROM + frac * STEM_SPAN + k * 0.15;
      const bloomStart = stemStart + stemDur * 0.86;
      if (extra) bloomSpan = Math.max(bloomSpan, rel + stemDur * 0.86 + bloomDur);
      else settleAt = Math.max(settleAt, bloomStart + bloomDur);

      const leaves: Leaf[] = [];
      if (rnd() < 0.62) {
        leaves.push({ at: R(0.15, 0.4), side: rnd() < 0.5 ? -1 : 1, len: u * def.size * R(0.55, 0.95) });
        if (rnd() < 0.45) leaves.push({ at: R(0.35, 0.55), side: -leaves[0].side, len: u * def.size * R(0.45, 0.8) });
      }

      const sparks: Spark[] | null =
        k > 0 && kind !== 'spike' && rnd() < (extra ? 0.32 : 0.22)
          ? Array.from({ length: 6 }, (_, j) => ({ a: (j / 6) * TAU + R(-0.4, 0.4), dist: r * R(1.4, 2.6), size: R(1.4, 3), delay: R(0, 0.25) }))
          : null;

      const florets: Floret[] | null =
        kind === 'cluster'
          ? Array.from({ length: 5 + Math.floor(rnd() * 3) }, (_, j) => j).map((j, _, arr) => {
              const a = -Math.PI / 2 + (j / (arr.length - 1) - 0.5) * 2.2 + R(-0.2, 0.2);
              const d = r * R(0.35, 0.85);
              return { dx: Math.cos(a) * d, dy: Math.sin(a) * d, r: r * R(0.26, 0.36) };
            })
          : null;

      const petals =
        kind === 'daisy' ? 12 + Math.floor(rnd() * 7) : kind === 'cosmos' ? 5 + Math.floor(rnd() * 4) : kind === 'round' ? 9 + Math.floor(rnd() * 3) : 7;

      const centerByHue: Record<Hue, string> = {
        lavender: '#e8c46a',
        purple: '#f0d58a',
        lilac: '#e3be6b',
        pink: '#f3d28a',
        rose: '#7a4a5e',
        cream: '#e2b44f',
        yellow: '#8a5c3e',
      };

      flowers.push({
        kind,
        x: ((ii + R(0.12, 0.88)) / nn) * (W + 40) - 20,
        by: H * R(def.base[0], def.base[1]),
        // the second wave includes taller stems reaching toward the middle of the screen
        h: H * (def.height[0] + (def.height[1] - def.height[0]) * rnd() ** (extra ? 1.1 : 1.5)) * hScale * (extra && k < 2 ? R(1.05, 1.4) : 1),
        curve: R(-0.2, 0.2),
        lean: R(-0.09, 0.09),
        r,
        petals,
        rot: R(0, TAU),
        tilt: R(-0.3, 0.3),
        squash: kind === 'spike' || kind === 'cluster' ? 1 : R(0.72, 1),
        col,
        center: mix(hex(centerByHue[hue]), HAZE, def.haze),
        stemStart,
        stemDur,
        bloomStart,
        bloomDur,
        phase: R(0, TAU),
        freq: R(0.5, 0.9),
        amp: R(0.022, 0.045),
        leaves,
        sparks,
        florets,
        buds: 9 + Math.floor(rnd() * 5),
        sprite: null,
        ext: r * 1.45 + 2,
        rel,
        hx: 0,
        hy: 0,
        ang: 0,
        g: 0,
        sw: 0,
      });
    }
    return { def, band, grassBack, grassFront, flowers };
  });

  /* Glowing dust drifting up through the meadow and into the open sky. */
  const nm = low ? 22 : Math.round(clamp(W / 30, 26, 48));
  const motes: Mote[] = Array.from({ length: nm }, () => ({
    x: R(0, W),
    y: R(H * 0.25, H),
    speed: R(4, 12),
    phase: R(0, TAU),
    r: R(0.8, 2.2),
    tw: R(0.6, 1.6),
  }));

  // Pushes the far layer back into the lavender air.
  const haze = ctx.createLinearGradient(0, H * 0.6, 0, H);
  haze.addColorStop(0, 'rgba(74,54,112,0)');
  haze.addColorStop(0.45, 'rgba(74,54,112,0.2)');
  haze.addColorStop(1, 'rgba(46,32,70,0.16)');

  /* Second-wave life: butterflies (some far, some close), drifting petals, warm fireflies. */
  const butterflyCols: [string, string][] = [
    ['#c4afeb', '#f0e6ff'],
    ['#f2bdd6', '#fff0f6'],
    ['#b49ddc', '#e8dcff'],
    ['#f6eee0', '#fffaf2'],
    ['#e5cc7f', '#fff2cc'],
    ['#dccbf6', '#ffffff'],
  ];
  const nb = low ? 6 : 10;
  const butterflies: Butterfly[] = Array.from({ length: nb }, (_, i) => {
    const fore = i % 3 !== 0;
    const fromLeft = rnd() < 0.5;
    const [a, b] = butterflyCols[i % butterflyCols.length];
    return {
      fore,
      size: u * (fore ? R(1.05, 1.45) : R(0.5, 0.75)),
      col: hex(a),
      col2: hex(b),
      alpha: fore ? 0.95 : 0.7,
      delay: 0.6 + i * R(0.5, 0.9),
      fromX: fromLeft ? -W * 0.12 : W * 1.12,
      fromY: H * R(0.35, 0.7),
      cx: W * R(0.2, 0.8),
      cy: H * (fore ? R(0.55, 0.78) : R(0.45, 0.68)),
      ax: W * R(0.16, 0.3),
      ay: H * R(0.05, 0.11),
      w: [R(0.09, 0.16), R(0.21, 0.33), R(0.13, 0.22), R(0.3, 0.45)],
      p: [R(0, TAU), R(0, TAU), R(0, TAU), R(0, TAU)],
      flap: R(7, 10.5),
      phase: R(0, TAU),
    };
  });
  const petalCols = ['#f2bdd6', '#dccbf6', '#c4afeb', '#f6eee0', '#eca8c9'];
  const petals: Petal[] = Array.from({ length: low ? 9 : 16 }, () => ({
    x: R(-0.05, 1) * W,
    y: R(-0.2, 0.6) * H,
    vy: R(14, 26),
    vx: R(6, 16),
    size: u * R(0.28, 0.45),
    rot: R(0, TAU),
    spin: R(-1.2, 1.2),
    phase: R(0, TAU),
    col: hex(pick(petalCols)),
    delay: R(1, 6),
  }));
  const fireflies: Firefly[] = Array.from({ length: low ? 10 : 20 }, () => ({
    x: R(0.04, 0.96) * W,
    y: R(0.42, 0.93) * H,
    ax: R(14, 40),
    ay: R(8, 22),
    w: R(0.18, 0.4),
    phase: R(0, TAU),
    blink: R(0.5, 1.1),
    r: R(1.2, 2.4),
    delay: R(0, 4),
  }));

  return { W, H, u, layers, motes, haze, settleAt: settleAt + 0.5, bloomSpan: bloomSpan + 0.3, butterflies, petals, fireflies };
}

/* --------------------------------------------------------------- drawing */

function petalRing(c: CanvasRenderingContext2D, n: number, dist: number, rx: number, ry: number, rot: number) {
  for (let i = 0; i < n; i++) {
    const a = rot + (i / n) * TAU;
    const cx = Math.cos(a) * dist;
    const cy = Math.sin(a) * dist;
    c.moveTo(cx + Math.cos(a) * rx, cy + Math.sin(a) * rx);
    c.ellipse(cx, cy, rx, ry, a, 0, TAU);
  }
}

function petalFill(c: CanvasRenderingContext2D, col: RGB, len: number) {
  const g = c.createRadialGradient(0, 0, 0, 0, 0, Math.max(len, 0.1));
  g.addColorStop(0, css(shade(col, -0.32)));
  g.addColorStop(0.38, css(col));
  g.addColorStop(1, css(shade(col, 0.14)));
  return g;
}

/** One flower head at the origin, `open` 0 (closed) → 1 (fully bloomed). */
function drawHead(c: CanvasRenderingContext2D, f: Flower, open: number) {
  const R = f.r;
  const o = open;
  const twist = (1 - o) * 0.55;
  switch (f.kind) {
    case 'daisy': {
      const len = R * (0.42 + 0.58 * o);
      c.fillStyle = petalFill(c, f.col, len);
      c.beginPath();
      petalRing(c, f.petals, len * 0.52, len * 0.5, R * 0.12 * (0.6 + 0.4 * o), f.rot + twist);
      c.fill();
      c.fillStyle = css(f.center);
      c.beginPath();
      c.arc(0, 0, R * 0.23 * (0.7 + 0.3 * o), 0, TAU);
      c.fill();
      c.fillStyle = css(shade(f.center, -0.25), 0.7);
      c.beginPath();
      c.arc(R * 0.05, R * 0.05, R * 0.13 * (0.7 + 0.3 * o), 0, TAU);
      c.fill();
      break;
    }
    case 'cosmos': {
      const len = R * (0.38 + 0.62 * o);
      c.fillStyle = petalFill(c, f.col, len);
      c.beginPath();
      petalRing(c, f.petals, len * 0.5, len * 0.5, len * 0.31, f.rot + twist);
      c.fill();
      // Fine veins.
      c.strokeStyle = css(shade(f.col, -0.18), 0.45);
      c.lineWidth = Math.max(0.5, R * 0.03);
      c.beginPath();
      for (let i = 0; i < f.petals; i++) {
        const a = f.rot + twist + (i / f.petals) * TAU;
        c.moveTo(Math.cos(a) * R * 0.16, Math.sin(a) * R * 0.16);
        c.lineTo(Math.cos(a) * len * 0.78, Math.sin(a) * len * 0.78);
      }
      c.stroke();
      c.fillStyle = css(f.center);
      c.beginPath();
      c.arc(0, 0, R * 0.17, 0, TAU);
      c.fill();
      break;
    }
    case 'round':
    case 'peony': {
      const peony = f.kind === 'peony';
      const rings = 3;
      for (let j = 0; j < rings; j++) {
        const oj = clamp01(o * 1.3 - j * 0.2);
        const rj = R * (1 - j * (peony ? 0.26 : 0.3)) * (0.32 + 0.68 * oj);
        const n = Math.max(5, f.petals - j * 2);
        const cj = peony ? mix(shade(f.col, 0.16), shade(f.col, -0.2), j / (rings - 1)) : mix(shade(f.col, 0.1), shade(f.col, -0.28), j / (rings - 1));
        c.fillStyle = peony ? petalFill(c, cj, rj) : css(cj);
        c.beginPath();
        petalRing(c, n, rj * (peony ? 0.52 : 0.5), rj * (peony ? 0.55 : 0.5), rj * (peony ? 0.47 : 0.42), f.rot + j * 0.55 + twist * (j + 1));
        c.fill();
        c.strokeStyle = css(shade(f.col, -0.35), 0.22);
        c.lineWidth = 0.6;
        c.stroke();
      }
      c.fillStyle = peony ? css(hex('#f4e2ad'), 0.9) : css(shade(f.col, -0.42));
      c.beginPath();
      c.arc(0, 0, R * (peony ? 0.15 : 0.12) * (0.6 + 0.4 * o), 0, TAU);
      c.fill();
      break;
    }
    case 'cluster': {
      const fl = f.florets!;
      c.strokeStyle = 'rgba(96,138,100,0.9)';
      c.lineWidth = Math.max(0.6, R * 0.05);
      c.beginPath();
      for (const p of fl) {
        c.moveTo(0, 0);
        c.lineTo(p.dx * (0.4 + 0.6 * o), p.dy * (0.4 + 0.6 * o));
      }
      c.stroke();
      c.fillStyle = css(f.col);
      c.beginPath();
      for (const p of fl) {
        const x = p.dx * (0.4 + 0.6 * o);
        const y = p.dy * (0.4 + 0.6 * o);
        const pr = p.r * 0.42 * (0.45 + 0.55 * o);
        for (let i = 0; i < 5; i++) {
          const a = f.rot + (i / 5) * TAU;
          const px = x + Math.cos(a) * p.r * 0.48 * (0.5 + 0.5 * o);
          const py = y + Math.sin(a) * p.r * 0.48 * (0.5 + 0.5 * o);
          c.moveTo(px + pr, py);
          c.arc(px, py, pr, 0, TAU);
        }
      }
      c.fill();
      c.fillStyle = css(f.center);
      c.beginPath();
      for (const p of fl) {
        const x = p.dx * (0.4 + 0.6 * o);
        const y = p.dy * (0.4 + 0.6 * o);
        c.moveTo(x + p.r * 0.2, y);
        c.arc(x, y, p.r * 0.2, 0, TAU);
      }
      c.fill();
      break;
    }
    case 'spike':
      break; // drawn along the stem
  }
}

function makeSprite(f: Flower, dpr: number): HTMLCanvasElement {
  const s = document.createElement('canvas');
  const px = Math.ceil(f.ext * 2 * dpr) + 2;
  s.width = px;
  s.height = px;
  const c = s.getContext('2d')!;
  c.setTransform(dpr, 0, 0, dpr, px / 2, px / 2);
  drawHead(c, f, 1);
  return s;
}

function makeGlow(): HTMLCanvasElement {
  const s = document.createElement('canvas');
  s.width = s.height = 64;
  const c = s.getContext('2d')!;
  const g = c.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,244,255,1)');
  g.addColorStop(0.28, 'rgba(232,206,255,0.45)');
  g.addColorStop(1, 'rgba(210,180,255,0)');
  c.fillStyle = g;
  c.fillRect(0, 0, 64, 64);
  return s;
}

function makeWarmGlow(): HTMLCanvasElement {
  const s = document.createElement('canvas');
  s.width = s.height = 64;
  const c = s.getContext('2d')!;
  const g = c.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,248,224,1)');
  g.addColorStop(0.25, 'rgba(243,217,164,0.5)');
  g.addColorStop(1, 'rgba(243,217,164,0)');
  c.fillStyle = g;
  c.fillRect(0, 0, 64, 64);
  return s;
}

/** A butterfly at the origin, body vertical. `open` 0..1 is how far the wings are spread. */
function drawButterfly(c: CanvasRenderingContext2D, b: Butterfly, open: number) {
  const s = b.size;
  const k = 0.18 + 0.82 * open;
  for (const side of [-1, 1]) {
    // upper wing
    const g = c.createRadialGradient(side * s * 0.15 * k, -s * 0.1, 0, side * s * 0.5 * k, -s * 0.3, s * 0.75);
    g.addColorStop(0, css(b.col2, 0.95));
    g.addColorStop(0.55, css(b.col, 0.92));
    g.addColorStop(1, css(shade(b.col, -0.25), 0.85));
    c.fillStyle = g;
    c.beginPath();
    c.ellipse(side * s * 0.5 * k, -s * 0.28, s * 0.52 * k, s * 0.4, side * -0.55, 0, TAU);
    c.fill();
    // lower wing
    c.fillStyle = css(shade(b.col, -0.08), 0.88);
    c.beginPath();
    c.ellipse(side * s * 0.36 * k, s * 0.22, s * 0.34 * k, s * 0.28, side * 0.5, 0, TAU);
    c.fill();
    // a soft spot on each upper wing
    c.fillStyle = css(b.col2, 0.55);
    c.beginPath();
    c.arc(side * s * 0.6 * k, -s * 0.34, s * 0.09, 0, TAU);
    c.fill();
  }
  c.fillStyle = 'rgba(46,30,72,0.95)';
  c.beginPath();
  c.ellipse(0, 0, s * 0.07, s * 0.4, 0, 0, TAU);
  c.fill();
  c.strokeStyle = 'rgba(46,30,72,0.8)';
  c.lineWidth = Math.max(0.6, s * 0.035);
  c.beginPath();
  c.moveTo(0, -s * 0.36);
  c.quadraticCurveTo(-s * 0.1, -s * 0.6, -s * 0.2, -s * 0.66);
  c.moveTo(0, -s * 0.36);
  c.quadraticCurveTo(s * 0.1, -s * 0.6, s * 0.2, -s * 0.66);
  c.stroke();
}

/** A slow travelling breeze, so neighbouring plants never move in lockstep. */
const wind = (t: number, x: number) => Math.sin(t * 0.45 - x * 0.0035) * 0.7 + Math.sin(t * 1.1 - x * 0.009 + 1.3) * 0.3;

function stemAt(f: Flower, s: number, sway: number, out: [number, number]) {
  const x0 = f.x;
  const y0 = f.by;
  const x1 = f.x + f.curve * f.h + sway * 0.35;
  const y1 = f.by - f.h * 0.55;
  const x2 = f.x + f.lean * f.h + sway;
  const y2 = f.by - f.h;
  const a = (1 - s) * (1 - s);
  const b = 2 * (1 - s) * s;
  const d = s * s;
  out[0] = a * x0 + b * x1 + d * x2;
  out[1] = a * y0 + b * y1 + d * y2;
  // Direction (lean from vertical).
  const dx = 2 * (1 - s) * (x1 - x0) + 2 * s * (x2 - x1);
  const dy = 2 * (1 - s) * (y1 - y0) + 2 * s * (y2 - y1);
  return Math.atan2(dx, -dy);
}

/* ---------------------------------------------------------------- engine */

export interface GardenHandle {
  destroy: () => void;
  /** Wake the second wave: more flowers, butterflies, petals, fireflies. Returns seconds until fully bloomed. */
  bloom: () => number;
  /** Her touch at (x, y) in canvas CSS px: second-wave flowers near x spring up right there. */
  touchBloom: (x: number, y: number) => void;
  /** Butterflies drift toward (x, y) for a moment, as if following her finger. */
  lure: (x: number, y: number) => void;
}

export function createGarden(
  canvas: HTMLCanvasElement,
  opts: { quality: Quality; reduced: boolean },
  onSettled: () => void,
): GardenHandle {
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    onSettled();
    return { destroy: () => undefined, bloom: () => 0, touchBloom: () => undefined, lure: () => undefined };
  }
  const c = ctx;
  const glow = makeGlow();
  const warm = makeWarmGlow();
  let bloomAt = Infinity;
  const lureAt = { x: 0, y: 0, until: -1, since: -1 };
  const maxDpr = opts.quality === 'high' ? 1.75 : 1.25;
  let dpr = 1;
  let field: Field | null = null;
  let t = 0;
  let last = performance.now();
  let lastDraw = 0;
  let raf = 0;
  let settled = false;
  const pt: [number, number] = [0, 0];

  const settle = () => {
    if (settled) return;
    settled = true;
    onSettled();
  };

  function resize() {
    // client size ignores CSS transforms, so the scene's slow pull-back never triggers a rebuild
    const W = Math.max(1, Math.round(canvas.clientWidth));
    const H = Math.max(1, Math.round(canvas.clientHeight));
    if (field && field.W === W && field.H === H) return;
    dpr = Math.min(window.devicePixelRatio || 1, maxDpr);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    field = build(c, W, H, opts.quality);
    if (bloomAt < Infinity) wake(field, bloomAt);
    if (opts.reduced) {
      t = field.settleAt + 30;
      draw();
      settle();
    }
  }

  function wake(f: Field, at: number) {
    for (const layer of f.layers)
      for (const fl of layer.flowers)
        if (fl.rel >= 0 && fl.stemStart === Infinity) {
          fl.stemStart = at + fl.rel;
          fl.bloomStart = fl.stemStart + fl.stemDur * 0.86;
        }
  }

  /** Butterflies, petals and fireflies of the second wave. `fore` picks the depth band. */
  function drawLife(f: Field, fore: boolean) {
    if (bloomAt === Infinity) return;
    const since = t - bloomAt;
    const { W, H } = f;
    for (const b of f.butterflies) {
      if (b.fore !== fore) continue;
      const tt = since - b.delay;
      if (tt <= 0) continue;
      const px = b.cx + b.ax * (0.65 * Math.sin(b.w[0] * tt + b.p[0]) + 0.35 * Math.sin(b.w[1] * tt + b.p[1]));
      const py = b.cy + b.ay * (0.6 * Math.sin(b.w[2] * tt + b.p[2]) + 0.4 * Math.sin(b.w[3] * tt + b.p[3]));
      // fly in from the side, then follow the meandering path
      const e = easeInOutSine(clamp01(tt / 4.5));
      let x = b.fromX + (px - b.fromX) * e;
      let y = b.fromY + (py - b.fromY) * e + Math.sin(tt * 2.1 + b.phase) * b.size * 0.25;
      // her finger: nearby butterflies circle it for a moment, then wander off again
      if (lureAt.until > t) {
        const w = smooth(0, 0.9, t - lureAt.since) * smooth(0, 1.2, lureAt.until - t) * (b.fore ? 0.85 : 0.45);
        const orbit = b.size * (2.2 + (b.phase % 1.5));
        const ox = lureAt.x + Math.cos(t * 1.3 + b.phase * 3) * orbit;
        const oy = lureAt.y + Math.sin(t * 1.7 + b.phase * 2) * orbit * 0.6;
        x += (ox - x) * w;
        y += (oy - y) * w;
      }
      const vx = b.ax * (0.65 * b.w[0] * Math.cos(b.w[0] * tt + b.p[0]) + 0.35 * b.w[1] * Math.cos(b.w[1] * tt + b.p[1]));
      // flutter in bursts, with short glides
      const burst = 0.55 + 0.45 * Math.sin(tt * 0.9 + b.phase);
      const open = 0.5 + 0.5 * Math.cos(tt * b.flap) * burst + (1 - burst) * 0.3;
      c.save();
      c.globalAlpha = b.alpha * smooth(0, 0.8, tt);
      c.translate(x, y);
      c.rotate(clamp(vx * 0.004, -0.45, 0.45));
      drawButterfly(c, b, clamp01(open));
      c.restore();
    }
    c.globalAlpha = 1;
    if (!fore) return;

    // drifting petals
    for (const p of f.petals) {
      const tt = since - p.delay;
      if (tt <= 0) continue;
      const span = H * 1.3;
      const y = ((p.y + tt * p.vy) % span) - H * 0.15;
      const x = ((p.x + tt * p.vx + Math.sin(tt * 0.8 + p.phase) * 22) % (W * 1.1)) - W * 0.05;
      c.save();
      c.globalAlpha = 0.72 * smooth(0, 1.5, tt);
      c.translate(x, y);
      c.rotate(p.rot + tt * p.spin);
      c.scale(1, 0.55 + 0.45 * Math.sin(tt * 1.7 + p.phase));
      c.fillStyle = css(p.col);
      c.beginPath();
      c.ellipse(0, 0, p.size, p.size * 0.6, 0, 0, TAU);
      c.fill();
      c.restore();
    }

    // warm fireflies
    c.globalCompositeOperation = 'lighter';
    for (const fl of f.fireflies) {
      const tt = since - fl.delay;
      if (tt <= 0) continue;
      const x = fl.x + Math.sin(tt * fl.w + fl.phase) * fl.ax;
      const y = fl.y + Math.sin(tt * fl.w * 1.3 + fl.phase * 2) * fl.ay;
      const blink = 0.35 + 0.65 * Math.max(0, Math.sin(tt * fl.blink + fl.phase)) ** 2;
      c.globalAlpha = blink * smooth(0, 2, tt);
      const s = fl.r * 9;
      c.drawImage(warm, x - s / 2, y - s / 2, s, s);
    }
    c.globalCompositeOperation = 'source-over';
    c.globalAlpha = 1;
  }

  function drawBand(band: Band, W: number, H: number, rimAlpha: number) {
    const e = easeOutCubic(clamp01((t - band.start) / 1.5));
    if (e <= 0) return 0;
    c.save();
    c.globalAlpha = e;
    c.translate(0, (1 - e) * H * 0.06);
    c.beginPath();
    c.moveTo(0, H + 12);
    for (let i = 0; i < band.pts.length; i++) c.lineTo(i * band.step, band.pts[i]);
    c.lineTo(W, H + 12);
    c.closePath();
    c.fillStyle = band.fill;
    c.fill();
    if (rimAlpha > 0) {
      // A faint back-lit rim where the ground meets the glow.
      c.beginPath();
      for (let i = 0; i < band.pts.length; i++) c[i ? 'lineTo' : 'moveTo'](i * band.step, band.pts[i]);
      c.strokeStyle = `rgba(206,178,246,${rimAlpha})`;
      c.lineWidth = 1.5;
      c.stroke();
    }
    c.restore();
    return e;
  }

  function drawGrass(buckets: Blade[][], cols: string[], ramp: number) {
    for (let ci = 0; ci < buckets.length; ci++) {
      const list = buckets[ci];
      if (!list.length) continue;
      c.beginPath();
      let any = false;
      for (const b of list) {
        const p = (t - b.start) / b.dur;
        if (p <= 0) continue;
        any = true;
        const g = easeOutCubic(clamp01(p));
        const hh = b.h * g;
        const sway = ramp ? (Math.sin(t * b.freq + b.phase) * 0.6 + wind(t, b.x) * 0.4) * b.amp * hh * ramp : 0;
        const tipX = b.x + b.lean * hh + sway;
        const tipY = b.by - hh;
        const cx = b.x + b.curve * hh + sway * 0.4;
        const cy = b.by - hh * 0.55;
        const w = b.w * (0.5 + 0.5 * g);
        c.moveTo(b.x - w / 2, b.by);
        c.quadraticCurveTo(cx - w * 0.2, cy, tipX, tipY);
        c.quadraticCurveTo(cx + w * 0.2, cy, b.x + w / 2, b.by);
        c.closePath();
      }
      if (any) {
        c.fillStyle = cols[ci];
        c.fill();
      }
    }
  }

  function drawLayer(layer: Layer, ramp: number) {
    const { def, flowers } = layer;
    drawGrass(layer.grassBack, def.grassCols, ramp);

    /* Stems + leaves (batched), recording where each head sits. */
    c.globalAlpha = def.alpha;
    c.beginPath();
    for (const f of flowers) {
      const p = (t - f.stemStart) / f.stemDur;
      if (p <= 0) {
        f.hx = -1;
        continue;
      }
      const g = easeInOutSine(clamp01(p));
      const sway = ramp ? (Math.sin(t * f.freq + f.phase) * 0.6 + wind(t, f.x) * 0.4) * f.amp * f.h * ramp : 0;
      const N = 10;
      c.moveTo(f.x, f.by);
      for (let i = 1; i <= N; i++) {
        f.ang = stemAt(f, (g * i) / N, sway, pt);
        c.lineTo(pt[0], pt[1]);
      }
      f.hx = pt[0];
      f.hy = pt[1];
      f.g = g;
      f.sw = sway;
    }
    c.strokeStyle = def.stemCol;
    c.lineWidth = def.stemW;
    c.lineCap = 'round';
    c.lineJoin = 'round';
    c.stroke();

    c.beginPath();
    for (const f of flowers) {
      if (f.hx < 0) continue;
      const { g, sw } = f;
      for (const lf of f.leaves) {
        const grow = easeOutCubic(clamp01((g - lf.at - 0.05) / 0.25));
        if (grow <= 0) continue;
        const ang = stemAt(f, lf.at, sw, pt) + lf.side * 0.95;
        const bx = pt[0];
        const by = pt[1];
        const len = lf.len * grow;
        const tx = bx + Math.sin(ang) * len;
        const ty = by - Math.cos(ang) * len;
        const nx = Math.cos(ang) * len * 0.22;
        const ny = Math.sin(ang) * len * 0.22;
        const mx = (bx + tx) / 2;
        const my = (by + ty) / 2;
        c.moveTo(bx, by);
        c.quadraticCurveTo(mx + nx, my + ny, tx, ty);
        c.quadraticCurveTo(mx - nx, my - ny, bx, by);
      }
    }
    c.fillStyle = def.leafCol;
    c.fill();

    /* Lavender spikes: buds open from the bottom of the spike to the top. */
    for (const f of flowers) {
      if (f.kind !== 'spike' || f.hx < 0) continue;
      const b = clamp01((t - f.bloomStart) / f.bloomDur);
      const { g, sw } = f;
      const dark = shade(f.col, -0.22);
      for (let pass = 0; pass < 2; pass++) {
        c.beginPath();
        for (let j = 0; j < f.buds; j++) {
          const s = 0.6 + (0.4 * j) / (f.buds - 1);
          if (s > g) break;
          // Green nubs first, then colour opening upward.
          const local = clamp01((b * 1.45 - (j / f.buds) * 0.45) / 0.55);
          const nub = clamp01((g - s) / 0.08);
          const sc = b > 0 ? 0.35 + 0.65 * easeOutBack(local, 1.1) : 0.35 * nub;
          if (sc <= 0) continue;
          const ang = stemAt(f, s, sw, pt);
          const sz = f.r * 0.25 * (1 - (0.4 * j) / f.buds) * sc;
          const ox = Math.cos(ang) * sz * 0.55;
          const oy = Math.sin(ang) * sz * 0.55;
          if (pass === 0) {
            c.moveTo(pt[0] - ox + sz * 0.5, pt[1] - oy);
            c.ellipse(pt[0] - ox, pt[1] - oy, sz * 0.5, sz * 0.85, ang - 0.5, 0, TAU);
          } else {
            c.moveTo(pt[0] + ox + sz * 0.5, pt[1] + oy);
            c.ellipse(pt[0] + ox, pt[1] + oy, sz * 0.5, sz * 0.85, ang + 0.5, 0, TAU);
          }
        }
        const budCol = b > 0 ? (pass ? f.col : dark) : hex(def.leafCol);
        c.fillStyle = css(b > 0 && b < 0.35 ? mix(hex(def.leafCol), budCol, b / 0.35) : budCol);
        c.fill();
      }
    }
    c.globalAlpha = 1;

    drawGrass(layer.grassFront, def.grassCols, ramp);

    /* Heads, bloom glow and sparkles. */
    c.globalAlpha = def.alpha;
    for (const f of flowers) {
      if (f.kind === 'spike' || f.hx < 0) continue;
      const { g } = f;
      const b = (t - f.bloomStart) / f.bloomDur;
      const rot = f.ang * 0.8 + f.tilt + (ramp ? Math.sin(t * f.freq * 1.3 + f.phase) * 0.05 * ramp : 0);
      if (b < 0.3 && g > 0.7) {
        // Closed bud, fading out as the petals take over.
        const bp = clamp01((g - 0.7) / 0.3) * (b > 0 ? 1 - b / 0.3 : 1);
        c.fillStyle = css(mix(hex(def.leafCol), f.col, 0.45));
        c.beginPath();
        c.ellipse(f.hx, f.hy, f.r * 0.16 * bp + 0.01, f.r * 0.25 * bp + 0.01, f.ang, 0, TAU);
        c.fill();
      }
      if (b <= 0) continue;
      const bb = clamp01(b);
      const end = f.bloomStart + f.bloomDur;
      if (f.sparks && t > end - 0.4 && t < end + 2) {
        const ga = Math.sin(clamp01((t - end + 0.4) / 2.4) * Math.PI) * 0.55;
        const gs = f.r * 4.2;
        c.globalCompositeOperation = 'lighter';
        c.globalAlpha = ga;
        c.drawImage(glow, f.hx - gs / 2, f.hy - gs / 2, gs, gs);
        c.globalCompositeOperation = 'source-over';
        c.globalAlpha = def.alpha;
      }
      const sc = 0.28 + 0.72 * easeOutBack(bb, 1.2);
      c.save();
      c.translate(f.hx, f.hy);
      c.rotate(rot);
      c.scale(sc, sc * f.squash);
      if (bb >= 1) {
        if (!f.sprite) f.sprite = makeSprite(f, dpr);
        c.drawImage(f.sprite, -f.ext, -f.ext, f.ext * 2, f.ext * 2);
      } else {
        drawHead(c, f, easeOutCubic(clamp01((bb - 0.08) / 0.92)));
      }
      c.restore();

      if (f.sparks && t > end - 0.1 && t < end + 1.8) {
        c.fillStyle = 'rgba(255,246,252,1)';
        for (const s of f.sparks) {
          const p = (t - end + 0.1 - s.delay) / 1.4;
          if (p <= 0 || p >= 1) continue;
          const d = s.dist * easeOutCubic(p);
          const x = f.hx + Math.cos(s.a) * d;
          const y = f.hy + Math.sin(s.a) * d - p * 6;
          const z = s.size * (1 - p * 0.5);
          c.globalAlpha = Math.sin(p * Math.PI) * 0.9;
          c.beginPath();
          c.moveTo(x, y - z * 2);
          c.lineTo(x + z * 0.4, y);
          c.lineTo(x, y + z * 2);
          c.lineTo(x - z * 0.4, y);
          c.closePath();
          c.moveTo(x - z * 2, y);
          c.lineTo(x, y + z * 0.4);
          c.lineTo(x + z * 2, y);
          c.lineTo(x, y - z * 0.4);
          c.closePath();
          c.fill();
        }
        c.globalAlpha = def.alpha;
      }
    }
    c.globalAlpha = 1;
  }

  function draw() {
    if (!field) return;
    const { W, H } = field;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.clearRect(0, 0, W, H);
    // Sway builds as the meadow grows, then settles into a gentle breeze.
    const ramp = opts.reduced ? 0 : 0.25 + 0.75 * smooth(3, 10, t);

    for (let k = 0; k < field.layers.length; k++) {
      const layer = field.layers[k];
      const e = drawBand(layer.band, W, H, k === 0 ? 0.12 : 0);
      if (e > 0) drawLayer(layer, ramp);
      if (k === 0 && e > 0) {
        c.globalAlpha = e;
        c.fillStyle = field.haze;
        c.fillRect(0, H * 0.6, W, H * 0.4);
        c.globalAlpha = 1;
      }
      if (k === 1) drawLife(field, false);
    }
    drawLife(field, true);

    /* Floating dust. */
    const fade = opts.reduced ? 1 : smooth(0.6, 2.6, t);
    if (fade > 0) {
      c.globalCompositeOperation = 'lighter';
      const top = H * 0.18;
      const span = H * 1.02 - top;
      for (const m of field.motes) {
        const y = H * 1.02 - ((H * 1.02 - m.y + t * m.speed) % span);
        const x = m.x + Math.sin(t * 0.3 + m.phase) * 12;
        const tw = 0.25 + 0.45 * (0.5 + 0.5 * Math.sin(t * m.tw + m.phase));
        c.globalAlpha = tw * fade * smooth(top, H * 0.36, y);
        const s = m.r * 6;
        c.drawImage(glow, x - s / 2, y - s / 2, s, s);
      }
      c.globalCompositeOperation = 'source-over';
      c.globalAlpha = 1;
    }
  }

  function frame(now: number) {
    raf = requestAnimationFrame(frame);
    // Clamped so a backgrounded tab resumes where it left off instead of jumping.
    t += Math.min((now - last) / 1000, 0.1);
    last = now;
    if (!field) return;
    // Once settled on low-power devices, ~30 fps is plenty for a gentle breeze.
    if (settled && (bloomAt === Infinity || t > bloomAt + field.bloomSpan) && opts.quality === 'low' && now - lastDraw < 32) return;
    lastDraw = now;
    draw();
    if (t >= field.settleAt) settle();
  }

  function doLure(x: number, y: number) {
    if (lureAt.until < t) lureAt.since = t;
    lureAt.x = x;
    lureAt.y = y;
    lureAt.until = t + 2.4;
  }

  const ro = new ResizeObserver(() => resize());
  ro.observe(canvas);
  resize();
  if (!opts.reduced) {
    last = performance.now();
    raf = requestAnimationFrame(frame);
  }

  return {
    destroy() {
      cancelAnimationFrame(raf);
      ro.disconnect();
    },
    touchBloom(x: number, y: number) {
      if (!field) return;
      if (bloomAt === Infinity) bloomAt = opts.reduced ? t - 60 : t; // her first touch wakes the life too
      const reach = Math.max(70, field.W * 0.07);
      let n = 0;
      for (const layer of field.layers)
        for (const fl of layer.flowers) {
          if (fl.rel < 0 || fl.stemStart !== Infinity) continue;
          const d = Math.abs(fl.x - x);
          if (d > reach) continue;
          // closest first, rippling outward from her finger
          fl.stemStart = opts.reduced ? t - 30 : t + (d / reach) * 0.55 + Math.random() * 0.15;
          fl.bloomStart = fl.stemStart + fl.stemDur * 0.86;
          if (++n >= 9) break;
        }
      doLure(x, y);
      if (opts.reduced) draw();
    },
    lure: doLure,
    bloom() {
      if (bloomAt === Infinity) {
        // reduced motion: the second wave appears fully grown right away
        bloomAt = opts.reduced ? t - 60 : t;
      }
      // whatever she hasn't grown yet now grows by itself, starting from this moment
      if (field) wake(field, opts.reduced ? t - 60 : t);
      if (opts.reduced) draw();
      return opts.reduced || !field ? 0 : field.bloomSpan;
    },
  };
}
