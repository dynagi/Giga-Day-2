import * as THREE from 'three';
import { EARTH_KEYS } from './earthTimeline';

/** Where things are on the way to Saturn (world units). */

/** The travel direction: away from the Moon, with the Sun a little behind us so Saturn arrives sunlit. */
export const TRAVEL_DIR = new THREE.Vector3(-0.6, 0.12, 0.79).normalize();
/** The voyage starts exactly where the Moon shot ended. */
export const VOYAGE_START = EARTH_KEYS[EARTH_KEYS.length - 1].pos.clone();
export const VOYAGE_START_LOOK = EARTH_KEYS[EARTH_KEYS.length - 1].look.clone();

export const SATURN_R = 40;
export const SATURN_POS = VOYAGE_START.clone().add(TRAVEL_DIR.clone().multiplyScalar(4200));
/** Saturn's spin axis (its rings lie across it), tilted so the rings show beautifully on approach. */
export const SATURN_AXIS = new THREE.Vector3(0.28, 1, 0.42).normalize();

/** A point along the route, `d` units from the start, pushed sideways by (sx, sy). */
const SIDE = new THREE.Vector3().crossVectors(TRAVEL_DIR, new THREE.Vector3(0, 1, 0)).normalize();
const UPV = new THREE.Vector3().crossVectors(SIDE, TRAVEL_DIR).normalize();
export function along(d: number, sx = 0, sy = 0) {
  return VOYAGE_START.clone()
    .add(TRAVEL_DIR.clone().multiplyScalar(d))
    .add(SIDE.clone().multiplyScalar(sx))
    .add(UPV.clone().multiplyScalar(sy));
}
export const ROUTE_SIDE = SIDE;
export const ROUTE_UP = UPV;

/** Set pieces along the route. */
export const DUST_AT = 1300; // the glowing dust region
export const NEBULA_AT = 2250; // the nebula the camera swings past
/** Where the gold light settles: an orbit just outside the rings. */
export const LIGHT_ORBIT_R = SATURN_R * 3.6;
