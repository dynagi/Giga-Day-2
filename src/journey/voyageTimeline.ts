import * as THREE from 'three';
import type { Key } from './earthTimeline';
import { along, NEBULA_AT, SATURN_AXIS, SATURN_POS, TRAVEL_DIR, VOYAGE_START, VOYAGE_START_LOOK } from './voyageLayout';

/** The opening line holds the view on the Moon for a few seconds, then the travel begins. */
const PRE = 7;

/** The voyage timeline, in journey-clock seconds (holding to go faster runs this clock quicker). */
export const VT = {
  preludeIn: 0.8,
  preludeOut: 5.4,
  titleIn: PRE + 4.5,
  titleOut: PRE + 10.5,
  boostFrom: PRE + 10,
  boostTo: PRE + 37,
  saturnSeen: PRE + 38, // a faint point ahead
  arrive: PRE + 50,
  dragFrom: PRE + 44,
  // the arrival settles, then Saturn starts talking (the gold light is saved for the very end)
  end: PRE + 57,
};

/** A point on a circle around Saturn's axis, starting from the side we arrive on. */
const A = SATURN_AXIS.clone();
const U0 = TRAVEL_DIR.clone().negate().projectOnPlane(A).normalize();
const W0 = new THREE.Vector3().crossVectors(A, U0).normalize();
export function aroundSaturn(theta: number, dist: number, height: number) {
  return SATURN_POS.clone()
    .add(U0.clone().multiplyScalar(Math.cos(theta) * dist))
    .add(W0.clone().multiplyScalar(Math.sin(theta) * dist))
    .add(A.clone().multiplyScalar(height));
}
export const SATURN_BASIS = { A, U0, W0 };

const S = SATURN_POS;

export const VOYAGE_KEYS: Key[] = [
  { t: 0, pos: VOYAGE_START.clone(), look: VOYAGE_START_LOOK.clone() },
  // a quiet moment by the Moon while the line is on screen
  { t: PRE, pos: VOYAGE_START.clone().add(VOYAGE_START.clone().sub(VOYAGE_START_LOOK).normalize().multiplyScalar(1.2)), look: VOYAGE_START_LOOK.clone() },
  // turn away from the Moon, toward the road ahead
  { t: PRE + 3.5, pos: along(4, 0, 1), look: along(300) },
  { t: PRE + 7, pos: along(40), look: along(500) },
  { t: PRE + 10, pos: along(160), look: along(800) },
  // through the stars
  { t: PRE + 14, pos: along(620, 6, 2), look: along(1200) },
  // into the glowing dust
  { t: PRE + 18, pos: along(1080, -10, 0), look: along(1500, 20, 10) },
  { t: PRE + 22, pos: along(1480, 15, 8), look: along(1900) },
  // swing sideways past the nebula
  { t: PRE + 26, pos: along(1850, 40, 20), look: along(NEBULA_AT, 170, 30) },
  { t: PRE + 30, pos: along(2150, 90, 10), look: along(NEBULA_AT + 100, 220, -40) },
  { t: PRE + 34, pos: along(2500, 60, -20), look: along(3200) },
  // the vastness, and a faint point ahead
  { t: PRE + 38, pos: along(2900, 20, 0), look: S.clone() },
  { t: PRE + 44, pos: along(3600, 40, 40), look: S.clone() },
  // arrival at an angle that shows the rings, then a slow orbital pass
  { t: PRE + 50, pos: aroundSaturn(0, 240, 70), look: S.clone() },
  { t: PRE + 56, pos: aroundSaturn(-0.55, 215, 55), look: S.clone() },
  { t: PRE + 62, pos: aroundSaturn(-1.0, 235, 72), look: S.clone() },
  { t: PRE + 71, pos: aroundSaturn(-1.35, 260, 88), look: S.clone() },
];
