import * as THREE from 'three';
import { PLANETS } from '../data/planets';
import type { JourneyLeg } from '../data/journeys';
import type { Flight } from '../three/journey/flight';
import type { PlanetData, PlanetId } from '../types';

/** The journey currently flying (set by the camera rig, read by scenery, planets and HUD). */
export interface ActiveJourney {
  id: number;
  leg: JourneyLeg;
  flight: Flight;
  /** Corridor frame → world. */
  matrix: THREE.Matrix4;
  /** The destination is drawn this far from its real position until arrival. */
  offset: THREE.Vector3;
  dest: PlanetId;
  /** Journey time 0–1. */
  t: number;
  /** Camera position in the corridor frame. */
  camLocal: THREE.Vector3;
  destVisible: boolean;
  /** 0 = dark silhouette, 1 = fully lit (destination reveal). */
  destLight: number;
  /** 0–1 strength of the destination's atmospheric glow. */
  destGlow: number;
  /** True once the camera has been handed over to the real destination. */
  swapped: boolean;
}

/**
 * Per-frame mutable state shared by the 3D scene and the DOM overlay.
 * Lives outside React so 60 fps updates never trigger re-renders.
 */
export const runtime = {
  /** Simulation clock for orbits (advances with timeScale). */
  simTime: 0,
  /** 1 = orbits move, 0 = frozen (lerped). */
  timeScale: 1,
  /** Journey indicator 0–1 during travel (visual only). */
  travelProgress: 0,
  /** Camera speed 0–1, drives star streaks. */
  speed: 0,
  /** Accumulated surface rotation per planet (radians). */
  spinAngle: {} as Partial<Record<PlanetId, number>>,
  /** 1 = display spin speed; slowed down for close-ups so features stay in view. */
  spinScale: 1,
  /** Elements the scene positions directly (reticle, labels). */
  dom: {
    reticle: null as HTMLElement | null,
    fade: null as HTMLElement | null,
    journeyGroup: null as THREE.Object3D | null,
    veil: null as HTMLElement | null,
    /** The phone held up at the hostel ("Richa come out…"), driven by the Earth director. */
    phone: null as HTMLElement | null,
  },
  journey: null as ActiveJourney | null,
  /** Journey clock rate (1 = real time). Only changed by automated checks. */
  journeyRate: 1,
  /** Journey time used by the 2D fallback (no WebGL). */
  fallbackT: 0,
  /** The opening cinematic (Milky Way → Solar System). */
  intro: {
    /** Seconds into the cinematic. */
    t: 0,
    /** The Solar System is hidden while we are out in the galaxy. */
    hideSolar: false,
    /** 0 → 1: Sun, orbits and planets appearing (inner to outer). */
    reveal: 1,
    /** 0 → 1: how deep-space dark the sky is (1 = galaxy view). */
    dark: 0,
    /** Set by the Skip control; the director jumps to the end. */
    skip: false,
    /** 0 → 1: the Milky Way band painted on the sky while we are inside the disc. */
    band: 0,
    /** Galactic plane normal and the direction of the galactic centre (world). */
    galN: new THREE.Vector3(0, 1, 0),
    galC: new THREE.Vector3(0, 0, -1),
  },
  /** The journey on Earth (Giga House → JNU → hostel) and the return home. */
  earth: {
    /** The camera is down in the town (sky, haze and town lights on). */
    inTown: false,
    /** 0 → 1: the cloud white-out covering the hand-over between space and town. */
    veil: 0,
    /**
     * Her scene. Departure: inside → toCamera (walks up to the camera) → withUs
     * (she rides along, out of view). Return: withUs → toBench → sitting → seated.
     */
    girlMode: 'inside' as 'inside' | 'toCamera' | 'withUs' | 'toBench' | 'sitting' | 'seated',
    /** 0 → 1 progress through the current girlMode. */
    girlU: 0,
    /** Set by Skip / Escape. */
    skip: false,
  },
};

const tmp = new THREE.Vector3();

/** World position of a planet at the given sim time. */
export function planetPosition(p: PlanetData, t = runtime.simTime, out = new THREE.Vector3()) {
  const a = p.phase + p.orbitSpeed * t;
  return out.set(p.orbit * Math.cos(a), 0, -p.orbit * Math.sin(a));
}

export function planetPositionById(id: PlanetId, out = new THREE.Vector3()) {
  const p = PLANETS.find((x) => x.id === id)!;
  return planetPosition(p, runtime.simTime, out);
}

/** Unit vector on a three.js SphereGeometry for texture coords (u, v). */
export function uvToLocal(u: number, v: number, out = new THREE.Vector3()) {
  const phi = u * Math.PI * 2;
  const theta = v * Math.PI;
  return out.set(-Math.cos(phi) * Math.sin(theta), Math.cos(theta), Math.sin(phi) * Math.sin(theta));
}

/** Rotate a planet so texture point (u, v) faces `towardWorld` (a direction from the planet centre). */
export function alignSurfacePoint(p: PlanetData, u: number, v: number, towardWorld: THREE.Vector3, lead = -0.35) {
  const tilt = THREE.MathUtils.degToRad(p.tiltDeg);
  // Undo the axial tilt (rotation about Z).
  tmp.copy(towardWorld).applyAxisAngle(new THREE.Vector3(0, 0, 1), -tilt);
  const local = uvToLocal(u, v);
  const want = Math.atan2(tmp.x, tmp.z);
  const have = Math.atan2(local.x, local.z);
  const spinNeeded = want - have + lead;
  runtime.spinAngle[p.id] = spinNeeded;
}
