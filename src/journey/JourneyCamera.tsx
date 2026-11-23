import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { env } from '../lib/env';
import { damp } from '../lib/ease';
import { journeyClock, resetJourneyClock } from './clock';
import type { Key } from './earthTimeline';
import { journeyInput } from './space';

const UP = new THREE.Vector3(0, 1, 0);

/**
 * Giga's eyes on the journey: they glide along a smooth path of shots (position + look target),
 * on the journey's own clock. Her drag turns his head (the camera stays where he is, it never
 * orbits) and eases back when she lets go; holding to go faster runs the clock (and widens the view) a little.
 */
export function JourneyCamera({ keys }: { keys: Key[] }) {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;

  const { posCurve, lookCurve, times } = useMemo(
    () => ({
      posCurve: new THREE.CatmullRomCurve3(keys.map((k) => k.pos), false, 'centripetal'),
      lookCurve: new THREE.CatmullRomCurve3(keys.map((k) => k.look), false, 'centripetal'),
      times: keys.map((k) => k.t),
    }),
    [keys],
  );

  useEffect(() => {
    resetJourneyClock();
    camera.far = 9000;
    camera.near = 0.05;
    camera.updateProjectionMatrix();
    return () => {
      camera.far = 700;
      camera.near = 0.1;
      camera.fov = 60;
      camera.updateProjectionMatrix();
    };
  }, [camera]);

  const tmpP = useMemo(() => new THREE.Vector3(), []);
  const tmpL = useMemo(() => new THREE.Vector3(), []);
  const offset = useMemo(() => new THREE.Vector3(), []);
  const right = useMemo(() => new THREE.Vector3(), []);
  const prev = useMemo(() => new THREE.Vector3(NaN, 0, 0), []);
  const look = useRef({ yaw: 0, pitch: 0 });

  useFrame(({ size }, delta) => {
    const dt = Math.min(delta, 0.1);
    // the journey clock: real time, faster while she holds
    journeyClock.boost += (journeyClock.boostTarget - journeyClock.boost) * damp(2.5, dt);
    journeyClock.rate = 1 + 0.9 * journeyClock.boost;
    journeyClock.t += dt * journeyClock.rate;
    journeyClock.tick = performance.now();
    const t = journeyClock.t;

    // time → position along the path (linear between keys, smooth through them)
    const n = times.length;
    let i = 0;
    while (i < n - 2 && t > times[i + 1]) i++;
    const local = Math.min(1, Math.max(0, (t - times[i]) / (times[i + 1] - times[i])));
    const u = (i + local) / (n - 1);
    posCurve.getPoint(u, tmpP);
    lookCurve.getPoint(u, tmpL);

    // portrait screens: step back a little so planets fit the narrow view
    const aspect = size.width / Math.max(1, size.height);
    const back = aspect < 1 ? Math.min(1.55, (1 / Math.sqrt(aspect)) * 0.95) : 1;
    if (back > 1) {
      offset.copy(tmpP).sub(tmpL);
      if (offset.length() < 600) {
        offset.multiplyScalar(back);
        tmpP.copy(tmpL).add(offset);
      }
    }

    // her drag turns his head (around his own eyes), then eases back
    const k = damp(journeyInput.dragging ? 12 : 1.6, dt);
    if (!journeyInput.dragging) {
      journeyInput.dragYaw *= Math.exp(-dt * 0.9);
      journeyInput.dragPitch *= Math.exp(-dt * 0.9);
    }
    look.current.yaw += (journeyInput.dragYaw - look.current.yaw) * k;
    look.current.pitch += (journeyInput.dragPitch - look.current.pitch) * k;
    if (!env.reducedMotion && (Math.abs(look.current.yaw) > 1e-4 || Math.abs(look.current.pitch) > 1e-4)) {
      offset.copy(tmpL).sub(tmpP);
      offset.applyAxisAngle(UP, look.current.yaw);
      right.crossVectors(offset, UP).normalize();
      offset.applyAxisAngle(right, look.current.pitch);
      tmpL.copy(tmpP).add(offset);
    }

    // speed and direction of travel, for the star streaks
    if (!Number.isNaN(prev.x) && dt > 0) {
      const sp = tmpP.distanceTo(prev) / dt;
      journeyClock.speed += (sp - journeyClock.speed) * damp(4, dt);
      if (sp > 0.01) journeyClock.vel.copy(tmpP).sub(prev).normalize();
    }
    prev.copy(tmpP);

    const fov = 60 + 8 * journeyClock.boost;
    if (Math.abs(camera.fov - fov) > 0.01) {
      camera.fov = fov;
      camera.updateProjectionMatrix();
    }
    camera.position.copy(tmpP);
    camera.lookAt(tmpL);
    camera.updateMatrixWorld();
  });

  return null;
}
