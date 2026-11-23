import * as THREE from 'three';

/**
 * The journey's own clock. It normally runs at real time; when she holds to go faster,
 * its rate rises, so the camera, the set pieces and the overlays all speed up together.
 */
export const journeyClock = {
  t: 0,
  rate: 1,
  /** 0..1, eased: how much "go faster" is on */
  boost: 0,
  /** what the overlay asks for (0 or 1) */
  boostTarget: 0,
  /** camera speed (world units / s) and direction of motion, for the star streaks */
  speed: 0,
  vel: new THREE.Vector3(0, 0, -1),
  /** 0..1: how much the voyage set pieces are switched on (0 during the Earth part) */
  voyage: 0,
};

export function resetJourneyClock() {
  journeyClock.t = 0;
  journeyClock.rate = 1;
  journeyClock.boost = 0;
  journeyClock.boostTarget = 0;
  journeyClock.speed = 0;
}
