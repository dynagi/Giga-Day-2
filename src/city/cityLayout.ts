import * as THREE from 'three';
import { env } from '../lib/env';

/**
 * The night city, in metres. Streets run on a 74 m grid (roads centred on 37 + 74k, in X and Z);
 * every block is filled with buildings, taller toward the downtown that the rooftop looks out on.
 * Giga's rooftop is the building in the middle of block (0, 0); Richa's hostel is one block over.
 */
export const BLOCK = 74;
export const ROAD_OFFSET = 37;
/** half widths from a road's centre line */
export const ROAD = { carriage: 5, lamp: 5.6, walk: 6.6, block: 7.5 };
export const LAMP_SPACING = 24;
export const EYE = 1.68;

export const ROOF = {
  halfX: 15,
  halfZ: 12,
  top: 42,
  /** where he stands, near the parapet, looking out at the skyline (−Z) */
  stand: new THREE.Vector3(0, 0, -7.6),
  /** the stairwell door, behind him */
  door: new THREE.Vector3(-8, 42, 6),
};

export const STREET = {
  roadZ: -111,
  walkZ: -111 + ROAD.walk,
};

export const HOSTEL = {
  x: 0,
  front: -98,
  halfW: 13,
  depth: 18,
  floors: 5,
  floorH: 3.3,
  /** the low boundary wall with the gate */
  wallZ: -103.2,
};
export const HOSTEL_H = HOSTEL.floors * HOSTEL.floorH + 0.9;

/** where the downtown towers rise, out ahead of the rooftop */
const DOWNTOWN = new THREE.Vector2(70, -640);

export interface Building {
  x: number;
  z: number;
  w: number;
  d: number;
  h: number;
  /** 0 office glass, 1 residential, 2 tower with coloured accent lights */
  kind: number;
  seed: number;
  accent: [number, number, number];
}

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const ACCENTS: [number, number, number][] = [
  [0.35, 0.6, 1.0], // blue
  [0.85, 0.35, 1.0], // violet
  [1.0, 0.4, 0.75], // pink
  [0.3, 0.95, 1.0], // cyan
  [0.7, 0.55, 1.0], // lavender
];

function overlaps(x0: number, x1: number, z0: number, z1: number, r: [number, number, number, number]) {
  return x1 > r[0] && x0 < r[1] && z1 > r[2] && z0 < r[3];
}

/** Areas kept free: the hostel and its forecourt, and the rooftop's own block. */
const KEEP_OUT: [number, number, number, number][] = [
  [-18, 18, -104, -76],
  [-30, 30, -30, 30],
];

export const CITY_RADIUS = env.lowPower ? 760 : 1150;

export function makeCity(): Building[] {
  const r = rng(20251123);
  const out: Building[] = [];
  const n = Math.ceil(CITY_RADIUS / BLOCK);
  for (let i = -n; i <= n; i++) {
    for (let j = -n; j <= n; j++) {
      const cx = i * BLOCK;
      const cz = j * BLOCK;
      const dist = Math.hypot(cx, cz);
      if (dist > CITY_RADIUS) continue;
      const half = BLOCK / 2 - ROAD.block - 0.8;
      // split the block into lots
      const nx = 1 + Math.floor(r() * 3);
      const nz = 1 + Math.floor(r() * 3);
      const near = Math.hypot(cx - 0, cz + 50) < 170; // the streets around the rooftop and the hostel stay low
      for (let a = 0; a < nx; a++) {
        for (let b = 0; b < nz; b++) {
          const gap = 1.2 + r() * 2.5;
          const x0 = cx - half + ((2 * half) / nx) * a + gap / 2;
          const x1 = cx - half + ((2 * half) / nx) * (a + 1) - gap / 2;
          const z0 = cz - half + ((2 * half) / nz) * b + gap / 2;
          const z1 = cz - half + ((2 * half) / nz) * (b + 1) - gap / 2;
          if (KEEP_OUT.some((k) => overlaps(x0, x1, z0, z1, k))) continue;
          if (r() < 0.06 && !near) continue; // the odd empty lot
          const dd = Math.hypot(cx - DOWNTOWN.x, cz - DOWNTOWN.y);
          const tall = Math.exp(-(dd * dd) / (300 * 300));
          let h = 9 + r() * 22 + Math.pow(r(), 1.6) * 30;
          h += tall * (60 + Math.pow(r(), 0.8) * 200);
          if (near) h = Math.min(h, 14 + r() * 20);
          const kind = h > 75 ? (r() < 0.55 ? 2 : 0) : r() < 0.62 ? 1 : 0;
          out.push({
            x: (x0 + x1) / 2,
            z: (z0 + z1) / 2,
            w: x1 - x0,
            d: z1 - z0,
            h,
            kind,
            seed: r() * 1000,
            accent: ACCENTS[Math.floor(r() * ACCENTS.length)],
          });
        }
      }
    }
  }
  // Giga's building, and the lower ones around it, so the view over the parapet falls to the street
  out.push({ x: 0, z: 0, w: ROOF.halfX * 2, d: ROOF.halfZ * 2, h: ROOF.top, kind: 1, seed: 7.7, accent: ACCENTS[4] });
  out.push({ x: -22.5, z: 0, w: 11, d: 54, h: 26, kind: 1, seed: 3.1, accent: ACCENTS[0] });
  out.push({ x: 22.5, z: 4, w: 11, d: 46, h: 31, kind: 0, seed: 5.3, accent: ACCENTS[0] });
  out.push({ x: 0, z: 21, w: 28, d: 14, h: 18, kind: 1, seed: 9.4, accent: ACCENTS[0] });
  out.push({ x: 0, z: -21.5, w: 28, d: 13, h: 12, kind: 0, seed: 2.2, accent: ACCENTS[0] });
  return out;
}

/** Street lamps near where he walks get real poles; all the others are just their glow. */
export function lampsNear(cx: number, cz: number, radius: number) {
  const out: { x: number; z: number; dx: number; dz: number }[] = [];
  const n = Math.ceil(radius / BLOCK) + 1;
  const k0 = Math.round(cx / BLOCK);
  const m0 = Math.round(cz / BLOCK);
  for (let k = k0 - n; k <= k0 + n; k++) {
    const road = k * BLOCK + ROAD_OFFSET;
    for (let s = -1; s <= 1; s += 2) {
      for (let a = -Math.ceil(radius / LAMP_SPACING); a <= Math.ceil(radius / LAMP_SPACING); a++) {
        const along = Math.round(cz / LAMP_SPACING) * LAMP_SPACING + a * LAMP_SPACING + LAMP_SPACING / 2;
        // roads along Z (x = road)
        const p1 = { x: road + s * ROAD.lamp, z: along, dx: -s, dz: 0 };
        if (Math.hypot(p1.x - cx, p1.z - cz) < radius) out.push(p1);
      }
    }
  }
  for (let m = m0 - n; m <= m0 + n; m++) {
    const road = m * BLOCK + ROAD_OFFSET;
    for (let s = -1; s <= 1; s += 2) {
      for (let a = -Math.ceil(radius / LAMP_SPACING); a <= Math.ceil(radius / LAMP_SPACING); a++) {
        const along = Math.round(cx / LAMP_SPACING) * LAMP_SPACING + a * LAMP_SPACING + LAMP_SPACING / 2;
        const p2 = { x: along, z: road + s * ROAD.lamp, dx: 0, dz: -s };
        if (Math.hypot(p2.x - cx, p2.z - cz) < radius) out.push(p2);
      }
    }
  }
  return out;
}
