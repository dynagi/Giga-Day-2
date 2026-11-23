import * as THREE from 'three';
import { CITY_N, EARTH_R, SUN_DIR } from '../journey/space';
import { EYE, HOSTEL, ROOF, STREET } from './cityLayout';

/**
 * The first-person story, from deep space down to the rooftop, the phone, the walk,
 * Richa at her hostel, and rising up again. The camera is Giga's eyes the whole time.
 *
 * Times are story-clock seconds. The clock pauses while the phone chat is on screen
 * (the chat runs at its own reading pace), then continues.
 */
export const CT = {
  // 1. deep space → Earth → into the clouds (planet scale)
  spaceEnd: 13,
  whiteFrom: 11.4, // clouds rush past and fill the view
  whiteTo: 14.6,
  // 2. down through the clouds over the city, onto the rooftop (metres)
  roofArrive: 26.5,
  notify: 30, // the phone buzzes in his pocket
  phoneAuto: 33.5, // raised on its own if she doesn't tap
  afterChat: 34, // the clock jumps here once the chat is over
  doorWalk: 37,
  darkFrom: 41.6, // into the stairwell
  stair: 43, // the switch to the street, hidden in the dark
  darkTo: 44.6,
  // 3. the street, the hostel, Richa
  arrive: 58.5,
  doorOpen: 61,
  richaOut: 61.6,
  richaStop: 66.6,
  ask: 67.2,
  reply: 71.6,
  replyOut: 76,
  rise: 78,
  cloudFrom: 85,
  end: 88.5,
};

export const cityClock = {
  t: 0,
  /** true while the chat is on screen (the story clock waits) */
  hold: false,
  /** 0 → 1 → 0: the phone in front of his eyes */
  phoneTarget: 0,
  phone: 0,
  /** her drag turns his head (radians), eased back when she lets go */
  lookYaw: 0,
  lookPitch: 0,
  dragging: false,
  /** when the 3D camera last ticked (if the 3D stops, the overlay keeps the story going) */
  tick: 0,
  /** for the `?scene=hostel` check link: start past the phone chat */
  skipChat: false,
};

export function resetCityClock() {
  cityClock.t = 0;
  cityClock.hold = false;
  cityClock.phoneTarget = 0;
  cityClock.phone = 0;
  cityClock.lookYaw = cityClock.lookPitch = 0;
  cityClock.dragging = false;
}

/* ------------------------------------------------------------------ camera keys */

/** A first-person key: where the eyes are, and where they look (heading + up/down), plus how much he's walking. */
export interface FPKey {
  t: number;
  pos: THREE.Vector3;
  /** heading in radians: 0 looks toward −Z, +π/2 toward −X (turning left) */
  yaw?: number;
  pitch?: number;
  /** or simply a point to look at (used in space) */
  look?: THREE.Vector3;
  /** 0..1 walking (head bob) */
  walk?: number;
}

export interface FPSegment {
  from: number;
  to: number;
  keys: FPKey[];
  /** world scale: planet units in space, metres in the city */
  world: 'space' | 'city';
}

const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

// 1. space: a wide look at the galaxies, turning toward Earth, falling toward the city's night side
const n = CITY_N.clone();
const tang = SUN_DIR.clone().sub(n.clone().multiplyScalar(SUN_DIR.dot(n))).normalize(); // toward the sunrise
const side = new THREE.Vector3().crossVectors(n, tang).normalize();
const P = (up: number, along: number, across: number) => n.clone().multiplyScalar(up).add(tang.clone().multiplyScalar(along)).add(side.clone().multiplyScalar(across));

const SPACE: FPKey[] = [
  { t: 0, pos: P(300, -170, 60), look: P(300, -170, 60).add(P(0.3, -0.25, -1).multiplyScalar(100)) },
  { t: 3.6, pos: P(215, -110, 34), look: P(215, -110, 34).add(P(-0.45, 0.15, -1).multiplyScalar(100)) },
  { t: 7.2, pos: P(70, -32, 8), look: v(0, 0, 0).add(tang.clone().multiplyScalar(2)) },
  { t: 10.4, pos: P(EARTH_R + 2.6, -3.2, 0.6), look: P(EARTH_R, 2.5, 0) },
  { t: 13, pos: P(EARTH_R + 0.35, -0.6, 0.1), look: P(EARTH_R - 0.2, 1.6, 0) },
];

// 2. the city: down through the clouds onto the rooftop; the phone; then toward the stairwell door
const E = ROOF.stand.clone().setY(ROOF.top + EYE);
const doorDir = Math.atan2(-(ROOF.door.x - E.x), -(ROOF.door.z - E.z)); // heading toward the door
const ROOFTOP: FPKey[] = [
  { t: 13, pos: v(150, 980, 560), yaw: 0.22, pitch: -0.78 },
  { t: 16.6, pos: v(96, 640, 360), yaw: 0.18, pitch: -0.72 },
  { t: 20.2, pos: v(44, 310, 160), yaw: 0.12, pitch: -0.46 },
  { t: 23.6, pos: v(9, 108, 28), yaw: 0.04, pitch: -0.2 },
  { t: 26.5, pos: E.clone(), yaw: 0, pitch: -0.04 },
  { t: 29, pos: E.clone(), yaw: 0.42, pitch: 0.03 },
  { t: 31.6, pos: E.clone(), yaw: -0.3, pitch: -0.06 },
  { t: 34, pos: E.clone(), yaw: -0.05, pitch: -0.1 },
  { t: 36.6, pos: E.clone().add(v(-0.3, 0, 0.4)), yaw: doorDir, pitch: -0.05 },
  { t: 39.2, pos: E.clone().lerp(ROOF.door.clone().setY(E.y), 0.5), yaw: doorDir, pitch: -0.04, walk: 1 },
  { t: 41.8, pos: E.clone().lerp(ROOF.door.clone().setY(E.y), 0.9), yaw: doorDir + 0.03, pitch: -0.02, walk: 1 },
  { t: 43, pos: ROOF.door.clone().setY(E.y).add(v(0, -0.25, 0.6)), yaw: doorDir, pitch: -0.15, walk: 1 },
];

// 3. the street: walking along the pavement to her hostel, turning to face its door; she comes out; rising up
const S = STREET.walkZ;
const H = HOSTEL;
const face = Math.PI; // facing +Z, toward the hostel
const stopZ = H.front - 6.3;
const STREETWALK: FPKey[] = [
  { t: 43, pos: v(-30, EYE, S), yaw: -Math.PI / 2, pitch: -0.02, walk: 1 },
  { t: 49, pos: v(-17.5, EYE, S), yaw: -1.78, pitch: 0.02, walk: 1 },
  { t: 54.2, pos: v(-5.6, EYE, S + 0.2), yaw: -2.2, pitch: 0.05, walk: 1 },
  { t: 57, pos: v(-0.8, EYE, stopZ - 0.6), yaw: -face + 0.05, pitch: 0.1, walk: 0.6 },
  { t: 58.5, pos: v(H.x, EYE, stopZ), yaw: -face, pitch: 0.16, walk: 0 },
  { t: 61, pos: v(H.x, EYE, stopZ), yaw: -face - 0.04, pitch: 0.06 },
  { t: 63.5, pos: v(H.x, EYE, stopZ), yaw: -face + 0.02, pitch: -0.02 },
  { t: 66.6, pos: v(H.x, EYE, stopZ), yaw: -face, pitch: -0.15 },
  { t: 71.6, pos: v(H.x, EYE, stopZ), yaw: -face + 0.03, pitch: -0.14 },
  { t: 76, pos: v(H.x, EYE, stopZ), yaw: -face - 0.02, pitch: -0.12 },
  // they look up together… and rise
  { t: 78, pos: v(H.x, EYE + 0.05, stopZ), yaw: -face, pitch: 1.05 },
  { t: 80, pos: v(H.x, 9, stopZ - 1), yaw: -face, pitch: 0.8 },
  { t: 82.2, pos: v(H.x, 48, stopZ - 6), yaw: -face + 0.1, pitch: 0.1 },
  { t: 84.4, pos: v(H.x + 10, 170, stopZ - 30), yaw: -face + 0.25, pitch: -0.85 },
  { t: 86.6, pos: v(H.x + 24, 420, stopZ - 70), yaw: -face + 0.35, pitch: -0.7 },
  { t: 88.5, pos: v(H.x + 36, 700, stopZ - 110), yaw: -face + 0.4, pitch: -0.2 },
];

export const SEGMENTS: FPSegment[] = [
  { from: 0, to: CT.spaceEnd, keys: SPACE, world: 'space' },
  { from: CT.spaceEnd, to: CT.stair, keys: ROOFTOP, world: 'city' },
  { from: CT.stair, to: CT.end + 5, keys: STREETWALK, world: 'city' },
];

export function segmentAt(t: number) {
  for (const s of SEGMENTS) if (t < s.to) return s;
  return SEGMENTS[SEGMENTS.length - 1];
}
