import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { journeyFor } from '../data/journeys';
import { PLANET_BY_ID } from '../data/planets';
import { alignSurfacePoint, planetPositionById, runtime } from '../state/runtime';
import { destinationFor, MISSION_ORDER, useCosmic, type CameraRequest } from '../state/store';
import type { PlanetId } from '../types';
import { getFlight } from './journey/flight';
import { sceneRefs } from './sceneRefs';

const UP = new THREE.Vector3(0, 1, 0);
const BASE_FOV = 45;
/** The journey corridor is flown this far beyond the destination (radially outward), away from the model Solar System. */
const JOURNEY_OFFSET = 1500;
const FOG_OFF = { near: 1e5, far: 2e5 };

type Vec = THREE.Vector3;
type Getter = () => Vec;

interface Tween {
  kind: 'tween';
  t: number;
  dur: number;
  fromPos: Vec;
  fromTarget: Vec;
  toPos: Getter;
  toTarget: Getter;
  fromFov: number;
  done: () => void;
}
interface JourneyAnim {
  kind: 'journey';
  elapsed: number;
  dur: number;
  hold: number;
  held: number;
  /** World offset of the corridor from the real destination. */
  D: Vec;
  dest: PlanetId;
  approach: Vec;
  aligned: boolean;
  /** Seamless start: the orientation we come in with, eased into the flight's own over `blendDur`. */
  blendFrom: THREE.Quaternion | null;
  blend: number;
  done: () => void;
}
type Anim = Tween | JourneyAnim;

const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

const P = (id: PlanetId) => planetPositionById(id, new THREE.Vector3());
const sunDir = (p: Vec) => p.clone().negate().normalize();
const sideOf = (p: Vec) => sunDir(p).cross(UP).normalize();

/** Direction (from the planet) we arrive from: on the sun-lit side, angled for a 3/4 view. */
function approachDir(id: PlanetId) {
  const p = P(id);
  const s = sunDir(p);
  const side = sideOf(p);
  if (destinationFor(id)?.travel.style === 'warp') {
    // Arrive slightly below the ecliptic, looking up at the sideways planet and its rings.
    return s.multiplyScalar(Math.cos(0.55)).addScaledVector(side, -Math.sin(0.55)).addScaledVector(UP, -0.32).normalize();
  }
  return s.multiplyScalar(Math.cos(0.7)).addScaledVector(side, Math.sin(0.7)).addScaledVector(UP, 0.22).normalize();
}

/** Portrait screens have a narrow horizontal view, so pull the camera back. */
let viewAspect = 16 / 9;
const portraitScale = () => (viewAspect < 0.85 ? 1.75 : viewAspect < 1.2 ? 1.35 : 1);
const orbitDistance = (id: PlanetId) => PLANET_BY_ID[id].radius * 4.4 * portraitScale();

/**
 * The hero view: the whole system fills the screen, gently angled for depth.
 * Landscape looks across the system; portrait looks down more steeply so the
 * orbits stack vertically, and pulls back with the narrower width.
 */
export function overviewTarget(aspect: number) {
  return aspect < 1 ? new THREE.Vector3(0, 0, 20) : new THREE.Vector3(0, -1, 12);
}
export function overviewPos(aspect: number) {
  if (aspect < 1) {
    const k = Math.min(1.25, 0.46 / Math.max(0.3, aspect));
    return overviewTarget(aspect).add(new THREE.Vector3(0, 225, 175).multiplyScalar(Math.max(0.62, k)));
  }
  const k = Math.max(1, 1.55 / aspect);
  return overviewTarget(aspect).add(new THREE.Vector3(0, 34, 88).multiplyScalar(k));
}

/** Where the camera rests after arriving at a planet (used as the next leg's departure). */
function arrivalPos(id: PlanetId) {
  return P(id).addScaledVector(approachDir(id), orbitDistance(id));
}

/**
 * The corridor for a journey leg, placed in the world: flown far outside the model
 * (radially outward, so the Sun lights the destination from exactly the same
 * direction as at its real position).
 */
function journeyFrame(from: PlanetId, dest: PlanetId, aspect: number) {
  viewAspect = aspect;
  const leg = journeyFor(from, dest);
  const real = P(dest);
  const approach = approachDir(dest);
  const flight = getFlight(leg, aspect, orbitDistance(dest));
  const D = real.clone().setY(0).normalize().multiplyScalar(JOURNEY_OFFSET);
  const J = real.clone().add(D);
  const z = approach.clone();
  const y = UP.clone().addScaledVector(z, -UP.dot(z)).normalize();
  const x = new THREE.Vector3().crossVectors(y, z);
  const destLocal = flight.destination();
  const matrix = new THREE.Matrix4()
    .makeTranslation(J.x, J.y, J.z)
    .multiply(new THREE.Matrix4().makeBasis(x, y, z))
    .multiply(new THREE.Matrix4().makeTranslation(-destLocal.x, -destLocal.y, -destLocal.z));
  return { leg, flight, D, matrix, approach };
}

/**
 * Where a seamless journey joins the corridor (seconds into the leg): past the
 * corridor's own "leaving Earth" part and the launch shake, already at full speed.
 */
export const SEAMLESS_START = 8.6;
const BLEND_DUR = 1.4;

/**
 * The world-space view direction and up vector the journey will have at
 * SEAMLESS_START, so a shot leading into it can end looking the same way.
 */
export function journeyJoinView(from: PlanetId, dest: PlanetId, aspect: number) {
  const { leg, flight, matrix } = journeyFrame(from, dest, aspect);
  const local = new THREE.Vector3();
  const look = new THREE.Vector3();
  const roll = flight.camera(SEAMLESS_START / (leg.durationMs / 1000), 0, local, look);
  const fwd = look.clone().transformDirection(matrix);
  const up = new THREE.Vector3(0, 1, 0).transformDirection(matrix).applyAxisAngle(fwd, roll);
  return { fwd, up };
}

function nextTarget(discovered: PlanetId[]) {
  return MISSION_ORDER.find((p) => !discovered.includes(p)) ?? MISSION_ORDER[0];
}

let journeySeq = 0;

/** Hard cinematic cut: the screen drops to deep space and fades back in. */
function cut() {
  const el = runtime.dom.fade;
  if (!el) return;
  el.classList.remove('is-cut', 'is-flash');
  void el.offsetWidth;
  el.classList.add('is-cut');
}

function flash() {
  const el = runtime.dom.fade;
  if (!el) return;
  el.classList.remove('is-flash');
  void el.offsetWidth;
  el.classList.add('is-flash');
}

export function CameraRig({ reducedMotion }: { reducedMotion: boolean }) {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const controls = useThree((s) => s.controls) as unknown as OrbitControlsImpl | null;
  const request = useCosmic((s) => s.camera);
  const skipToken = useCosmic((s) => s.skipToken);
  const phase = useCosmic((s) => s.phase);

  const anim = useRef<Anim | null>(null);
  const follow = useRef<{ id: PlanetId | null; last: Vec }>({ id: null, last: new THREE.Vector3() });
  const framing = useRef({ x: 0, y: 0 });
  const handled = useRef(-1);
  const tmp = useRef({
    a: new THREE.Vector3(),
    b: new THREE.Vector3(),
    c: new THREE.Vector3(),
    local: new THREE.Vector3(),
    look: new THREE.Vector3(),
    q: new THREE.Quaternion(),
  }).current;
  const scene = useThree((s) => s.scene);

  const setControls = (opts: { target: Vec; min: number; max: number; autoRotate?: number }) => {
    if (!controls) return;
    camera.up.copy(UP);
    controls.target.copy(opts.target);
    controls.minDistance = opts.min;
    controls.maxDistance = opts.max;
    controls.autoRotate = !reducedMotion && !!opts.autoRotate;
    controls.autoRotateSpeed = opts.autoRotate ?? 0;
    controls.enabled = true;
    controls.update();
  };

  const startFollow = (id: PlanetId | null) => {
    follow.current.id = id;
    if (id) planetPositionById(id, follow.current.last);
  };

  const tween = (toPos: Getter, toTarget: Getter, seconds: number, done: () => void) => {
    anim.current = {
      kind: 'tween',
      t: 0,
      dur: reducedMotion ? 0 : seconds,
      fromPos: camera.position.clone(),
      fromTarget: controls ? controls.target.clone() : new THREE.Vector3(),
      toPos,
      toTarget,
      fromFov: camera.fov,
      done,
    };
    if (reducedMotion) flash();
    if (controls) controls.enabled = false;
  };

  /* ----------------------------- handle requests ----------------------------- */
  const handle = (req: CameraRequest) => {
    viewAspect = camera.aspect;
    const { setCameraMode, arrive } = useCosmic.getState();
    const seamless = req.kind === 'travel' && !!req.seamless && !reducedMotion;
    // A seamless journey keeps the speed (warp streaks) it arrives with.
    if (!seamless) runtime.speed = 0;
    camera.up.copy(UP);

    switch (req.kind) {
      case 'overview':
      case 'cockpit': {
        startFollow(null);
        const pos = overviewPos(camera.aspect);
        const target = overviewTarget(camera.aspect);
        // Coming back from the town on Earth: a soft cut straight to the overview.
        const fromTown = runtime.earth.inTown || camera.position.length() > 5000;
        if (fromTown) {
          runtime.earth.inTown = false;
          const f = scene.fog as THREE.Fog | null;
          if (f) {
            f.near = 1e5;
            f.far = 2e5;
          }
          cut();
          camera.position.copy(pos);
          camera.lookAt(target);
          if (controls) controls.target.copy(target);
        }
        tween(() => pos, () => target, fromTown ? 0.01 : 2.4, () => {
          // A slow drift around the system makes its depth easy to feel (off for reduced motion).
          setControls({ target, min: 18, max: 420, autoRotate: 0.3 });
          setCameraMode('OVERVIEW');
        });
        setCameraMode('CINEMATIC');
        break;
      }
      case 'inspect': {
        const r = PLANET_BY_ID[req.planet].radius;
        startFollow(req.planet);
        const start = P(req.planet);
        const dir = camera.position.clone().sub(start).normalize().lerp(sunDir(start), 0.5).addScaledVector(UP, 0.3).normalize();
        // Planets with rings or wide moon systems are framed a little wider.
        const wideFrame = req.planet === 'saturn' || req.planet === 'uranus' || req.planet === 'jupiter' ? 1.25 : 1;
        const dist = (r * 3.6 + 2.2) * wideFrame * portraitScale();
        tween(
          () => P(req.planet).addScaledVector(dir, dist),
          () => P(req.planet),
          3.2,
          () => {
            setControls({ target: P(req.planet), min: r * 1.6 + 0.6, max: r * 14 + 14 });
            setCameraMode('INSPECT');
          },
        );
        setCameraMode('CINEMATIC');
        break;
      }
      case 'travel': {
        startFollow(null);
        const dest = req.planet;
        const { leg, flight, D, matrix, approach } = journeyFrame(req.from, dest, camera.aspect);
        runtime.journey = {
          id: ++journeySeq,
          leg,
          flight,
          matrix,
          offset: D.clone(),
          dest,
          t: 0,
          camLocal: new THREE.Vector3(),
          destVisible: false,
          destLight: 0,
          destGlow: 0,
          swapped: false,
        };
        runtime.travelProgress = 0;
        useCosmic.getState().setJourneyId(journeySeq);
        if (controls) controls.enabled = false;
        anim.current = {
          kind: 'journey',
          // Seamless (straight on from the Earth story): join the corridor already under way.
          elapsed: reducedMotion ? leg.durationMs / 1000 : seamless ? SEAMLESS_START : 0,
          dur: leg.durationMs / 1000,
          hold: reducedMotion ? 1.6 : leg.holdMs / 1000,
          held: 0,
          D,
          dest,
          approach,
          aligned: false,
          blendFrom: seamless ? camera.quaternion.clone() : null,
          blend: 0,
          done: () => {
            runtime.journey = null;
            arrive();
          },
        };
        if (!seamless) cut();
        setCameraMode('CINEMATIC');
        break;
      }
      case 'orbit': {
        const r = PLANET_BY_ID[req.planet].radius;
        startFollow(req.planet);
        const finish = () => {
          setControls({ target: P(req.planet), min: r * 1.7, max: r * 12 });
          setCameraMode('ORBIT');
        };
        if (camera.position.distanceTo(P(req.planet)) > r * 8) {
          tween(() => arrivalPos(req.planet), () => P(req.planet), 1.6, finish);
        } else finish();
        break;
      }
      case 'final': {
        const r = PLANET_BY_ID[req.planet].radius;
        startFollow(req.planet);
        const dir = camera.position.clone().sub(P(req.planet)).normalize();
        tween(
          () => P(req.planet).addScaledVector(dir, r * 4.6 * portraitScale()),
          () => P(req.planet),
          2.2,
          () => {
            setControls({ target: P(req.planet), min: r * 1.8, max: r * 10, autoRotate: 0.35 });
            setCameraMode('AUTO');
          },
        );
        setCameraMode('CINEMATIC');
        break;
      }
      case 'complete': {
        startFollow(null);
        const n = P('neptune');
        const u = P('uranus');
        const mid = n.clone().add(u).multiplyScalar(0.5);
        const sep = n.distanceTo(u);
        const dir = sunDir(mid).multiplyScalar(0.85).addScaledVector(UP, 0.45).addScaledVector(sideOf(mid), 0.3).normalize();
        const pos = mid.clone().addScaledVector(dir, (sep * 1.4 + 16) * portraitScale());
        tween(() => pos, () => mid, 3, () => {
          setControls({ target: mid, min: 8, max: 150, autoRotate: 0.18 });
          setCameraMode('AUTO');
        });
        setCameraMode('CINEMATIC');
        break;
      }
    }
  };

  useEffect(() => {
    if (!controls || handled.current === request.id) return;
    handled.current = request.id;
    handle(request);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request, controls]);

  useEffect(() => {
    const a = anim.current;
    if (a?.kind === 'journey' && runtime.journey && !runtime.journey.swapped && a.elapsed < a.dur) {
      a.elapsed = a.dur;
      a.hold = Math.min(a.hold, 1.8);
      cut();
    }
  }, [skipToken]);

  const fog = (near: number, far: number) => {
    const f = scene.fog as THREE.Fog | null;
    if (!f) return;
    f.near = near;
    f.far = far;
  };

  /** Fly one frame of the journey. */
  const flyJourney = (a: JourneyAnim, dt: number, time: number) => {
    const j = runtime.journey;
    if (!j) return;
    if (j.swapped) {
      a.held += dt;
      if (a.held >= a.hold) {
        anim.current = null;
        a.done();
      }
      return;
    }
    a.elapsed = Math.min(a.dur, a.elapsed + dt * runtime.journeyRate);
    const t = a.dur > 0 ? a.elapsed / a.dur : 1;
    const { flight, leg } = j;
    j.t = t;
    const roll = flight.camera(t, time, tmp.local, tmp.look);
    j.camLocal.copy(tmp.local);
    camera.position.copy(tmp.local).applyMatrix4(j.matrix);
    const lookW = tmp.a.copy(tmp.local).addScaledVector(tmp.look, 10).applyMatrix4(j.matrix);
    const fwd = tmp.b.copy(lookW).sub(camera.position).normalize();
    camera.up.set(0, 1, 0).transformDirection(j.matrix).applyAxisAngle(fwd, roll);
    camera.lookAt(lookW);
    if (a.blendFrom) {
      // Ease from the view we arrived with into the flight's own (no snap).
      a.blend = Math.min(1, a.blend + dt / BLEND_DUR);
      tmp.q.copy(camera.quaternion);
      camera.quaternion.slerpQuaternions(a.blendFrom, tmp.q, easeInOutCubic(a.blend));
      if (a.blend >= 1) a.blendFrom = null;
    }
    if (controls) controls.target.copy(lookW);

    const speed = t < 1 ? flight.speedAt(t) : 0;
    runtime.speed = speed;
    runtime.travelProgress = t;
    const portrait = camera.aspect < 0.85;
    camera.fov = BASE_FOV + speed * (portrait ? 16 : 10);
    camera.updateProjectionMatrix();

    // Depth: during the flight anything beyond ~350 units melts into the dark;
    // for the reveal the fog lifts and the destination emerges from it.
    // Just before the reveal the fog thickens, so the destination first shows only
    // its atmospheric glow and a dark silhouette, then lifts as we close in.
    const pre = THREE.MathUtils.smoothstep(t, leg.revealAt - 0.07, leg.revealAt);
    const r = Math.pow(THREE.MathUtils.smoothstep(t, leg.revealAt, 1), 1.6);
    fog(THREE.MathUtils.lerp(THREE.MathUtils.lerp(70, 40, pre), 260, r), THREE.MathUtils.lerp(THREE.MathUtils.lerp(620, 240, pre), 2600, r));
    j.destVisible = t >= leg.revealAt;
    // First a faint atmospheric glow, then the silhouette, then the lit face.
    j.destGlow = THREE.MathUtils.smoothstep(t, leg.revealAt, leg.revealAt + 0.05);
    j.destLight = 0.12 + 0.88 * Math.pow(THREE.MathUtils.smoothstep(t, leg.revealAt + 0.03, 0.97), 1.3);

    if (!a.aligned && t >= leg.revealAt - 0.02) {
      a.aligned = true;
      // Turn the Great-Dark-Spot region toward where we will arrive, for the "Storms" hotspot.
      if (a.dest === 'neptune') alignSurfacePoint(PLANET_BY_ID.neptune, 0.62, 0.62, a.approach, -0.25);
    }

    if (t >= 1) {
      // Hand over to the real destination: same view, real coordinates.
      camera.position.sub(a.D);
      j.swapped = true;
      j.offset.set(0, 0, 0);
      j.destLight = 1;
      j.destGlow = 1;
      const g = sceneRefs.planets[a.dest]?.group;
      if (g) {
        g.position.sub(a.D);
        g.visible = true;
      }
      if (runtime.dom.journeyGroup) runtime.dom.journeyGroup.visible = false;
      const target = P(a.dest);
      camera.up.copy(UP);
      camera.lookAt(target);
      if (controls) controls.target.copy(target);
      camera.fov = BASE_FOV;
      camera.updateProjectionMatrix();
      fog(FOG_OFF.near, FOG_OFF.far);
      runtime.speed = 0;
    }
  };

  /* --------------------------------- per frame -------------------------------- */
  useFrame((state, dt) => {
    const { selected } = useCosmic.getState();
    const closeUp = phase === 'explore' || phase === 'observe' || phase === 'final' || phase === 'travel';
    runtime.spinScale += ((closeUp ? 0.06 : 1) - runtime.spinScale) * Math.min(1, dt * 2);

    // Orbits move only in the free overview; they freeze for inspection and the mission.
    const targetScale = (phase === 'solar' || phase === 'intro') && !selected ? 1 : 0;
    runtime.timeScale += (targetScale - runtime.timeScale) * Math.min(1, dt * 1.6);
    runtime.simTime += dt * runtime.timeScale;
    // The opening cinematic and the Earth journeys drive the camera themselves;
    // back home at the hostel (summary screens) the camera simply rests there.
    if (phase === 'intro' || phase === 'earth' || phase === 'homecoming' || (runtime.earth.inTown && useCosmic.getState().atHome)) {
      anim.current = null;
      if (camera.view) camera.clearViewOffset();
      return;
    }

    const a = anim.current;
    if (a?.kind === 'journey') {
      flyJourney(a, dt, state.clock.elapsedTime);
    } else if (a) {
      a.t = a.dur <= 0 ? 1 : Math.min(1, a.t + dt / a.dur);
      {
        const e = easeInOutCubic(a.t);
        camera.position.lerpVectors(a.fromPos, a.toPos(), e);
        const target = tmp.a.copy(a.fromTarget).lerp(a.toTarget(), e);
        if (controls) controls.target.copy(target);
        camera.lookAt(target);
        camera.fov = THREE.MathUtils.lerp(a.fromFov, BASE_FOV, e);
      }
      camera.updateProjectionMatrix();
      if (a.t >= 1) {
        anim.current = null;
        camera.up.copy(UP);
        camera.fov = BASE_FOV;
        camera.updateProjectionMatrix();
        a.done();
      }
    } else if (follow.current.id) {
      // Keep the camera locked to a (slowly drifting) planet.
      const now = planetPositionById(follow.current.id, tmp.c);
      const delta = tmp.b.copy(now).sub(follow.current.last);
      if (delta.lengthSq() > 0) {
        camera.position.add(delta);
        if (controls) controls.target.add(delta);
        follow.current.last.copy(now);
      }
    }

    // Composition: shift the rendered view so the subject sits beside the UI panel.
    const { width: W, height: H } = state.size;
    const portrait = W < 760 || H > W * 1.05;
    let fx = 0;
    let fy = 0;
    if (portrait) {
      fy = { intro: 0, earth: 0, homecoming: 0, solar: 0, cockpit: 0, travel: 0, explore: 0.24, observe: 0.24, final: 0.26, scanner: 0.2, garden: 0.26, complete: 0.26, loading: 0 }[phase];
    } else {
      fx = { intro: 0, earth: 0, homecoming: 0, solar: 0, cockpit: 0, travel: 0, explore: 0.17, observe: -0.2, final: 0, scanner: 0.26, garden: 0, complete: 0, loading: 0 }[phase];
      // With the science panel open on the right, the planet moves to the left of it.
      if (useCosmic.getState().discoverOpen && (phase === 'solar' || phase === 'cockpit' || phase === 'explore')) fx = 0.2;
      fy = phase === 'final' ? 0.2 : phase === 'complete' ? 0.2 : 0;
    }
    const k = Math.min(1, dt * 2.2);
    framing.current.x += (fx - framing.current.x) * k;
    framing.current.y += (fy - framing.current.y) * k;
    if (Math.abs(framing.current.x) > 0.001 || Math.abs(framing.current.y) > 0.001) {
      camera.setViewOffset(W, H, framing.current.x * W, framing.current.y * H, W, H);
    } else if (camera.view) {
      camera.clearViewOffset();
    }

    // Cockpit reticle around the next destination.
    const reticle = runtime.dom.reticle;
    if (reticle) {
      if (phase === 'cockpit' && !a) {
        const v = P(nextTarget(useCosmic.getState().discovered)).project(camera);
        const visible = v.z < 1 && Math.abs(v.x) < 1.1 && Math.abs(v.y) < 1.1;
        reticle.style.opacity = visible ? '1' : '0';
        reticle.style.transform = `translate(${((v.x + 1) / 2) * W}px, ${((1 - v.y) / 2) * H}px)`;
      } else {
        reticle.style.opacity = '0';
      }
    }
  });

  return null;
}
