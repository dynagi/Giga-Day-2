import * as THREE from 'three';
import { PLANETS } from '../data/planets';
import type { PlanetData, PlanetId, Quality, RingSpec } from '../types';

/* ------------------------------------------------------------------ */
/* Procedural textures: generated on a canvas at load time, so the     */
/* experience needs no large image downloads. Noise is sampled in 3D   */
/* on the sphere, which makes every texture seamless.                  */
/* ------------------------------------------------------------------ */

function hash(x: number, y: number, z: number, seed: number) {
  let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(z, 1103515245) ^ Math.imul(seed, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h & 0xffffff) / 0xffffff;
}

const fade = (t: number) => t * t * (3 - 2 * t);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

function noise3(x: number, y: number, z: number, seed: number) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const zi = Math.floor(z);
  const xf = fade(x - xi);
  const yf = fade(y - yi);
  const zf = fade(z - zi);
  const c000 = hash(xi, yi, zi, seed);
  const c100 = hash(xi + 1, yi, zi, seed);
  const c010 = hash(xi, yi + 1, zi, seed);
  const c110 = hash(xi + 1, yi + 1, zi, seed);
  const c001 = hash(xi, yi, zi + 1, seed);
  const c101 = hash(xi + 1, yi, zi + 1, seed);
  const c011 = hash(xi, yi + 1, zi + 1, seed);
  const c111 = hash(xi + 1, yi + 1, zi + 1, seed);
  return lerp(
    lerp(lerp(c000, c100, xf), lerp(c010, c110, xf), yf),
    lerp(lerp(c001, c101, xf), lerp(c011, c111, xf), yf),
    zf,
  );
}

function fbm(x: number, y: number, z: number, seed: number, octaves = 5) {
  let sum = 0;
  let amp = 0.5;
  let f = 1;
  for (let i = 0; i < octaves; i++) {
    sum += amp * noise3(x * f, y * f, z * f, seed + i * 17);
    f *= 2.03;
    amp *= 0.5;
  }
  return sum / (1 - Math.pow(0.5, octaves));
}

type RGB = [number, number, number];
const hex = (h: string): RGB => {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const mix = (a: RGB, b: RGB, t: number): RGB => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const clamp01 = (t: number) => Math.min(1, Math.max(0, t));
const smooth = (e0: number, e1: number, x: number) => {
  const t = clamp01((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
};

function ramp(palette: RGB[], t: number): RGB {
  const x = clamp01(t) * (palette.length - 1);
  const i = Math.min(palette.length - 2, Math.floor(x));
  return mix(palette[i], palette[i + 1], x - i);
}

/** Same mapping as THREE.SphereGeometry, so texture features line up with geometry maths. */
function spherePoint(u: number, v: number): [number, number, number] {
  const phi = u * Math.PI * 2;
  const theta = v * Math.PI;
  return [-Math.cos(phi) * Math.sin(theta), Math.cos(theta), Math.sin(phi) * Math.sin(theta)];
}

function makeCanvas(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function toTexture(canvas: HTMLCanvasElement) {
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return t;
}

function paintPlanet(p: PlanetData, w: number, h: number) {
  const canvas = makeCanvas(w, h);
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(w, h);
  const spec = p.texture;
  const pal = spec.palette.map(hex);
  const seed = spec.seed;
  const storms = (spec.storms ?? []).map((s) => ({ ...s, c: spherePoint(s.u, s.v), col: hex(s.color), comp: s.companion ? hex(s.companion) : null }));
  const white: RGB = [244, 247, 252];

  for (let j = 0; j < h; j++) {
    const v = (j + 0.5) / h;
    for (let i = 0; i < w; i++) {
      const u = (i + 0.5) / w;
      const [x, y, z] = spherePoint(u, v);
      let col: RGB;

      switch (spec.kind) {
        case 'banded':
        case 'ice': {
          const turb = spec.turbulence ?? 0.2;
          const bands = spec.bands ?? 8;
          // Warp latitude with noise stretched along longitude: zonal cloud bands.
          const warp = (fbm(x * 2.2, y * 9, z * 2.2, seed, 5) - 0.5) * turb * 1.6;
          const lat = y + warp * 0.35;
          const b = 0.5 + 0.5 * Math.sin(lat * bands * Math.PI * 0.5 + fbm(x * 1.5, y * 3, z * 1.5, seed + 5, 3) * 2);
          const fine = fbm(x * 6, y * 26, z * 6, seed + 9, 4);
          let t = spec.kind === 'ice' ? 0.25 + (1 - Math.abs(y)) * 0.35 + (b - 0.5) * 0.25 + (fine - 0.5) * turb * 0.6 : b * 0.85 + (fine - 0.5) * 0.35;
          if (spec.kind === 'ice') t = clamp01(t + (1 - Math.abs(y) ** 0.7) * 0.15);
          col = ramp(pal.slice(0, 4), t);
          // Bright high-altitude streak clouds (Neptune).
          if (spec.kind === 'ice' && turb > 0.2) {
            const streak = fbm(x * 3, y * 34, z * 3, seed + 21, 4);
            col = mix(col, white, smooth(0.66, 0.8, streak) * 0.75);
            // a slightly lighter polar haze
            col = mix(col, pal[pal.length - 1], smooth(0.65, 1, Math.abs(y)) * 0.35);
          }
          break;
        }
        case 'cloudy': {
          const n = fbm(x * 2 + fbm(x, y * 4, z, seed) * 1.5, y * 5, z * 2, seed + 3, 5);
          col = ramp(pal, n);
          break;
        }
        case 'rocky': {
          const n = fbm(x * 3, y * 3, z * 3, seed, 6);
          const m = fbm(x * 0.9, y * 0.9, z * 0.9, seed + 40, 3);
          col = ramp(pal, n * 0.7 + m * 0.5 - 0.1);
          // craters: speckled darker pits
          const cr = noise3(x * 40, y * 40, z * 40, seed + 77);
          if (cr > 0.93) col = mix(col, pal[pal.length - 1], (cr - 0.93) * 8);
          if (p.id === 'mars') col = mix(col, white, smooth(0.9, 0.97, Math.abs(y)));
          break;
        }
        case 'earth':
        default: {
          const land = fbm(x * 1.8, y * 1.8, z * 1.8, seed, 6);
          const isLand = land > 0.53;
          if (isLand) {
            const veg = fbm(x * 5, y * 5, z * 5, seed + 3, 4);
            col = mix(pal[2], pal[3], clamp01((veg - 0.35) * 1.6 + Math.abs(y) * 0.2));
          } else {
            col = mix(pal[0], pal[1], smooth(0.35, 0.53, land));
          }
          col = mix(col, pal[4], smooth(0.8, 0.9, Math.abs(y)));
          const cloud = fbm(x * 3 + 7, y * 6, z * 3, seed + 50, 5);
          col = mix(col, white, smooth(0.55, 0.75, cloud) * 0.7);
          break;
        }
      }

      for (const s of storms) {
        // Oval: compare in a frame stretched along longitude.
        const dx = x - s.c[0];
        const dy = (y - s.c[1]) * 1.7;
        const dz = z - s.c[2];
        const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
        const k = 1 - smooth(s.size * 0.55, s.size * 1.6, d);
        if (k > 0) col = mix(col, s.col, k * 0.85);
        if (s.comp) {
          const cy = y - (s.c[1] - s.size * 0.9);
          const d2 = Math.sqrt(dx * dx + (cy * 2.6) ** 2 + dz * dz);
          col = mix(col, s.comp, (1 - smooth(s.size * 0.25, s.size * 0.9, d2)) * 0.8);
        }
      }

      const o = (j * w + i) * 4;
      img.data[o] = col[0];
      img.data[o + 1] = col[1];
      img.data[o + 2] = col[2];
      img.data[o + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return toTexture(canvas);
}

function paintSun(w: number, h: number) {
  const canvas = makeCanvas(w, h);
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(w, h);
  const pal = ['#fff6d6', '#ffd27a', '#ffad42', '#f07a22'].map(hex);
  for (let j = 0; j < h; j++) {
    const v = (j + 0.5) / h;
    for (let i = 0; i < w; i++) {
      const [x, y, z] = spherePoint((i + 0.5) / w, v);
      const n = fbm(x * 6, y * 6, z * 6, 7, 5);
      const col = ramp(pal, 1 - n * 1.15 + 0.05);
      const o = (j * w + i) * 4;
      img.data[o] = col[0];
      img.data[o + 1] = col[1];
      img.data[o + 2] = col[2];
      img.data[o + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return toTexture(canvas);
}

/** Radial ring texture: x axis = inner → outer edge. */
function paintRing(ring: RingSpec, seed: number) {
  const w = 512;
  const canvas = makeCanvas(w, 4);
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(w, 4);
  const [r, g, b] = hex(ring.color);
  for (let i = 0; i < w; i++) {
    const t = i / (w - 1);
    let a = 0;
    for (let k = 0; k < ring.bands.length - 1; k++) {
      const [p0, a0] = ring.bands[k];
      const [p1, a1] = ring.bands[k + 1];
      if (t >= p0 && t <= p1) a = lerp(a0, a1, (t - p0) / Math.max(1e-6, p1 - p0));
    }
    a *= 0.75 + 0.25 * noise3(t * 160, 0.5, 0.5, seed);
    const shade = 0.85 + 0.15 * noise3(t * 60, 1.5, 0.5, seed + 3);
    for (let j = 0; j < 4; j++) {
      const o = (j * w + i) * 4;
      img.data[o] = r * shade;
      img.data[o + 1] = g * shade;
      img.data[o + 2] = b * shade;
      img.data[o + 3] = clamp01(a * ring.opacity) * 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Soft radial glow for sprites (sun corona, highlights). */
export function paintGlow(inner: string, outer: string) {
  const s = 256;
  const canvas = makeCanvas(s, s);
  const ctx = canvas.getContext('2d')!;
  const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  g.addColorStop(0, inner);
  g.addColorStop(0.25, inner.replace(/[\d.]+\)$/, '0.55)'));
  g.addColorStop(1, outer);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, s, s);
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export interface TextureSet {
  planets: Record<PlanetId, THREE.Texture>;
  rings: Partial<Record<PlanetId, THREE.Texture>>;
  sun: THREE.Texture;
  sunGlow: THREE.Texture;
  triton: THREE.Texture;
  /** City lights for Earth's night side (image maps only). */
  earthNight: THREE.Texture | null;
  /** Cloud cover for Earth (white = cloud). */
  earthClouds: THREE.Texture | null;
  /** Radar-derived surface of Venus (Magellan), shown on request. */
  venusSurface: THREE.Texture | null;
  /** Moons and dwarf planets, by id. */
  bodies: Record<string, THREE.Texture>;
  /** True when the photographic maps loaded (false = procedural fallback). */
  photographic: boolean;
}

const yieldFrame = () => new Promise<void>((r) => setTimeout(r, 0));

/*
 * Planet maps: Solar System Scope (solarsystemscope.com), CC BY 4.0, built
 * from NASA mission imagery and elevation data. 2K on capable screens,
 * 1K on phones / low quality. Anything that fails to load falls back to
 * the procedural painter, so the scene always works offline.
 */
const MAPS: Record<PlanetId, string> = {
  mercury: 'mercury.jpg',
  venus: 'venus_atmosphere.jpg',
  earth: 'earth_daymap.jpg',
  mars: 'mars.jpg',
  jupiter: 'jupiter.jpg',
  saturn: 'saturn.jpg',
  uranus: 'uranus.jpg',
  neptune: 'neptune.jpg',
};

/** Small worlds painted in code, with colours based on spacecraft imagery. */
const BODY_PAINT: Record<string, { kind: PlanetData['texture']['kind']; palette: string[]; seed: number; bands?: number; turbulence?: number }> = {
  phobos: { kind: 'rocky', palette: ['#8a7f76', '#6d645d', '#544c47', '#3d3734'], seed: 201 },
  deimos: { kind: 'rocky', palette: ['#968b80', '#7a7068', '#5e5650', '#45403b'], seed: 202 },
  io: { kind: 'rocky', palette: ['#f6e98c', '#e8c35a', '#cf8a3e', '#8f5a2c'], seed: 203 },
  europa: { kind: 'rocky', palette: ['#f4efe4', '#e2d3bb', '#c4a483', '#94735a'], seed: 204 },
  ganymede: { kind: 'rocky', palette: ['#cbc3b8', '#a0968a', '#7a7066', '#5a524a'], seed: 205 },
  callisto: { kind: 'rocky', palette: ['#948a7e', '#70665c', '#524a43', '#3a332e'], seed: 206 },
  titan: { kind: 'cloudy', palette: ['#edbd72', '#dba252', '#c4873d', '#a66c2d'], seed: 207, turbulence: 0.25 },
  enceladus: { kind: 'ice', palette: ['#ffffff', '#f3f7fb', '#e2ecf4', '#cfdeea'], seed: 208, bands: 3, turbulence: 0.05 },
  rhea: { kind: 'rocky', palette: ['#dcd8d3', '#bcb7b0', '#9b968f', '#7a756f'], seed: 209 },
  miranda: { kind: 'rocky', palette: ['#c9c6c2', '#a9a6a2', '#8a8784', '#6a6866'], seed: 210 },
  ariel: { kind: 'rocky', palette: ['#d8d6d3', '#bab8b5', '#9a9895', '#7b7977'], seed: 211 },
  umbriel: { kind: 'rocky', palette: ['#7d7a77', '#64615f', '#4d4b49', '#393837'], seed: 212 },
  titania: { kind: 'rocky', palette: ['#c4bdb6', '#a39c95', '#837d77', '#635e59'], seed: 213 },
  oberon: { kind: 'rocky', palette: ['#b2a89f', '#91877e', '#71685f', '#544d46'], seed: 214 },
  pluto: { kind: 'rocky', palette: ['#f3e3cb', '#dcb894', '#ac7d58', '#6f4b36'], seed: 215 },
  ceres: { kind: 'rocky', palette: ['#a6a09a', '#86807a', '#67625d', '#4b4743'], seed: 216 },
};

function loadImage(url: string, srgb = true): Promise<THREE.Texture | null> {
  return new THREE.TextureLoader()
    .loadAsync(url)
    .then((t) => {
      if (srgb) t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = 8;
      return t;
    })
    .catch(() => null);
}

function paintBody(id: string, w: number) {
  const b = BODY_PAINT[id];
  return paintPlanet(
    { ...PLANETS[0], id: 'mercury', texture: { kind: b.kind, palette: b.palette, seed: b.seed, bands: b.bands, turbulence: b.turbulence } },
    w,
    w / 2,
  );
}

/** Load every texture (images in parallel), reporting progress for the loader. */
export async function loadTextures(quality: Quality, onProgress: (p: number) => void): Promise<TextureSet> {
  const hi = quality === 'high' && window.innerWidth > 700;
  const dir = `${import.meta.env.BASE_URL}textures/${hi ? '2k' : '1k'}/`;
  const bodyIds = Object.keys(BODY_PAINT);
  const steps = PLANETS.length + 6 + bodyIds.length;
  let done = 0;
  const step = () => {
    done += 1;
    onProgress(Math.min(1, done / steps));
  };
  const track = <T,>(p: Promise<T>) => p.then((v) => (step(), v));

  const [maps, sunMap, night, clouds, venusSurface, moonMap, saturnRing] = await Promise.all([
    Promise.all(PLANETS.map((p) => track(loadImage(dir + MAPS[p.id])))),
    track(loadImage(dir + 'sun.jpg')),
    track(loadImage(dir + 'earth_nightmap.jpg')),
    track(loadImage(dir + 'earth_clouds.jpg', false)),
    track(loadImage(dir + 'venus_surface.jpg')),
    track(loadImage(dir + 'moon.jpg')),
    track(loadImage(dir + 'saturn_ring_alpha.png')),
  ]);

  const planets = {} as Record<PlanetId, THREE.Texture>;
  const rings: Partial<Record<PlanetId, THREE.Texture>> = {};
  let photographic = true;
  for (let i = 0; i < PLANETS.length; i++) {
    const p = PLANETS[i];
    const img = maps[i];
    if (!img) photographic = false;
    planets[p.id] = img ?? paintPlanet(p, hi ? 512 : 256, hi ? 256 : 128);
    if (p.rings) rings[p.id] = p.id === 'saturn' && saturnRing ? saturnRing : paintRing(p.rings, p.texture.seed);
  }

  const bodies: Record<string, THREE.Texture> = {};
  for (const id of bodyIds) {
    bodies[id] = paintBody(id, hi ? 256 : 128);
    step();
    await yieldFrame();
  }
  bodies.moon = moonMap ?? paintBody('rhea', 256);
  bodies.triton = paintPlanet(
    { ...PLANETS[0], id: 'mercury', texture: { kind: 'rocky', palette: ['#efe2dc', '#d3b9b2', '#a98f8c', '#7c6866'], seed: 101 } },
    256,
    128,
  );

  const sun = sunMap ?? paintSun(hi ? 512 : 256, hi ? 256 : 128);
  const sunGlow = paintGlow('rgba(255, 214, 140, 1)', 'rgba(255, 150, 60, 0)');
  onProgress(1);
  return {
    planets,
    rings,
    sun,
    sunGlow,
    triton: bodies.triton,
    earthNight: night,
    earthClouds: clouds,
    venusSurface,
    bodies,
    photographic,
  };
}
