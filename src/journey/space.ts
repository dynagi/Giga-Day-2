import * as THREE from 'three';

/** Shared layout of the Earth–Moon part of the journey (world units). */
export const EARTH_R = 10;
export const MOON_R = 2.7;
/** Light comes from here (the Sun is far away in this direction). */
export const SUN_DIR = new THREE.Vector3(0.87, 0.22, 0.44).normalize();
/** The Moon sits on the sunny side, so both it and Earth behind it are lit for the moon shot. */
export const MOON_POS = new THREE.Vector3(50, 10, 38);

/** Interactive state for the journey (written by input handlers, read in the frame loop). */
export const journeyInput = {
  dragYaw: 0,
  dragPitch: 0,
  dragging: false,
  /** time (s) of the last moon tap, for the blush */
  blushAt: -100,
  blushCount: 0,
};

/**
 * Where the city is on Earth: on the night side, near the line where morning begins,
 * so the descent sees city lights below and the sunrise glowing on the horizon,
 * and leaving Earth rises toward that same sunrise.
 */
const SIDE = new THREE.Vector3().crossVectors(SUN_DIR, new THREE.Vector3(0, 1, 0)).normalize();
export const CITY_N = SUN_DIR.clone().multiplyScalar(-0.32).add(SIDE.multiplyScalar(0.9)).add(new THREE.Vector3(0, 0.28, 0)).normalize();
