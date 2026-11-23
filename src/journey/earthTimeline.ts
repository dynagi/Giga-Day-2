import * as THREE from 'three';
import type { WelcomePlanet } from '../solar/textures';
import { CITY_N, EARTH_R, MOON_POS, SUN_DIR } from './space';

/**
 * The Earth → Moon timeline (journey-clock seconds from the start of the `earth` phase).
 * HTML overlays (ascent clouds, the planets' welcome lines, hints, the Moon line) and the
 * 3D camera read the same numbers.
 */
export const ET = {
  ascentEnd: 3.4, // clouds rush past, the sky darkens
  revealAt: 9, // the whole Earth comes into view
  exploreFrom: 13, // the planets welcome her, one by one, as we look around Earth
  exploreTo: 39,
  psstFrom: 37.6, // "psst… someone else is waiting"
  psstTo: 41,
  moonTurn: 40,
  moonArrive: 51,
  lineIn: 53, // the Moon line fades in
  lineOut: 63,
  moonTapUntil: 69, // tap the Moon (it blushes)
  end: 71,
};

const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const sph = (azDeg: number, dist: number, y: number) => {
  const a = (azDeg * Math.PI) / 180;
  return v(Math.sin(a) * dist, y, Math.cos(a) * dist);
};
const UP = v(0, 1, 0);

/**
 * Place a planet on the far side of Earth from the camera, offset to one side (and a little
 * up or down) so Earth and the planet share the frame. Returns where it sits and where the
 * camera should look to hold both.
 */
function beside(cam: THREE.Vector3, dist: number, side: number, lift: number) {
  const u = cam.clone().normalize();
  const lateral = new THREE.Vector3().crossVectors(UP, u).normalize();
  const pos = u.clone().multiplyScalar(-dist).add(lateral.multiplyScalar(side)).add(UP.clone().multiplyScalar(lift));
  const look = pos.clone().multiplyScalar(0.5);
  return { pos, look };
}

export interface WelcomeSpot {
  id: WelcomePlanet;
  from: number;
  to: number;
  radius: number;
  cam: THREE.Vector3;
  pos: THREE.Vector3;
  look: THREE.Vector3;
}

const spots: [WelcomePlanet, number, number, number, number, number, number][] = [
  // id, camera azimuth, camera distance, camera height, planet distance, sideways, up/down, (radius below)
  ['mercury', 26, 37, 8, 56, 46, 22],
  ['venus', 46, 38, 9, 58, -50, -20],
  ['mars', 66, 38, 10, 56, 48, 22],
  ['jupiter', 86, 40, 11, 78, -62, -18],
  ['uranus', 104, 42, 12, 64, 52, 24],
  ['neptune', 120, 44, 13, 66, -54, -20],
];
const RADII: Record<WelcomePlanet, number> = { mercury: 3, venus: 4.2, mars: 3.6, jupiter: 9, uranus: 6, neptune: 6 };

/** Tall phone screens: planets sit above or below Earth instead of beside it, so both stay in the narrow view. */
const PORTRAIT = typeof window !== 'undefined' && window.innerWidth < window.innerHeight;

export const WELCOME: WelcomeSpot[] = spots.map(([id, az, d, y, pd, side, lift], i) => {
  const cam = sph(az, d, y);
  const s = PORTRAIT ? side * 0.25 : side;
  const l = PORTRAIT ? Math.sign(lift) * Math.max(Math.abs(lift) * 2.4, 48) : lift;
  const { pos, look } = beside(cam, pd, s, l);
  const from = ET.exploreFrom + 0.6 + i * 4;
  return { id, from, to: from + 3.8, radius: RADII[id], cam, pos, look };
});

// rising from just above the city's night side, looking along the surface toward the sunrise
const n0 = CITY_N.clone();
const toSun = SUN_DIR.clone().sub(n0.clone().multiplyScalar(SUN_DIR.dot(n0))).normalize();
const at = (h: number) => n0.clone().multiplyScalar(EARTH_R + h);

// the moon shot: beyond the Moon on the sunny side, Earth small in the background
const u = MOON_POS.clone().normalize();
const side = v(-u.z, 0, u.x).normalize();
const moonCam = MOON_POS.clone().add(u.clone().multiplyScalar(8.5)).add(side.clone().multiplyScalar(-6)).add(v(0, 2.2, 0));
const moonLook = MOON_POS.clone().add(side.clone().multiplyScalar(2.6)).add(v(0, -0.6, 0)).lerp(v(0, 0, 0), 0.12);

export interface Key {
  t: number;
  pos: THREE.Vector3;
  look: THREE.Vector3;
}

export const EARTH_KEYS: Key[] = [
  { t: 0, pos: at(0.25), look: at(0.25).add(toSun.clone().multiplyScalar(10)).add(n0.clone().multiplyScalar(2.2)) },
  { t: 3.4, pos: at(0.9), look: at(0.9).add(toSun.clone().multiplyScalar(10)).add(n0.clone().multiplyScalar(0.6)) },
  { t: 6.2, pos: at(3.2), look: at(0).add(toSun.clone().multiplyScalar(12)).add(n0.clone().multiplyScalar(-1.5)) },
  { t: 9, pos: at(12).add(toSun.clone().multiplyScalar(-6)), look: toSun.clone().multiplyScalar(3) },
  { t: 13, pos: sph(14, 35, 8), look: v(0, 0, 0) },
  // the welcome: the camera meets each planet beside Earth
  ...WELCOME.map((w) => ({ t: w.from + 1.6, pos: w.cam, look: w.look })),
  // a moment looking up into the stars
  { t: 39.2, pos: sph(130, 46, 13), look: v(4, 30, -6) },
  { t: 42, pos: sph(124, 47, 14), look: MOON_POS.clone().multiplyScalar(0.55) },
  // travel to the Moon
  { t: 46, pos: MOON_POS.clone().multiplyScalar(0.55).add(v(6, 8, 14)), look: MOON_POS.clone() },
  { t: 51, pos: moonCam, look: moonLook },
  // settle, with a slow drift while the line is on screen
  { t: 61, pos: moonCam.clone().add(side.clone().multiplyScalar(-1.2)).add(v(0, 0.5, 0)), look: moonLook.clone().add(v(0, 0.2, 0)) },
  { t: 71, pos: moonCam.clone().add(side.clone().multiplyScalar(-2.2)).add(v(0, 0.9, 0)), look: moonLook.clone().add(v(0, 0.3, 0)) },
];
