import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { damp } from '../lib/ease';
import { env } from '../lib/env';
import { SEGMENTS, cityClock, resetCityClock, segmentAt, type FPSegment } from './cityClock';

/**
 * Giga's eyes. The camera is always where his eyes are: it glides down from space,
 * stands on the roof, turns his head, walks (with a gentle, human bob), stops, looks at her.
 * Her drag turns his head (it never orbits around anything) and eases back when she lets go.
 */

/** Catmull-Rom through four values (for headings and up/down angles). */
function cr(p0: number, p1: number, p2: number, p3: number, s: number) {
  const s2 = s * s;
  const s3 = s2 * s;
  return 0.5 * (2 * p1 + (-p0 + p2) * s + (2 * p0 - 5 * p1 + 4 * p2 - p3) * s2 + (-p0 + 3 * p1 - 3 * p2 + p3) * s3);
}

interface Track {
  seg: FPSegment;
  pos: THREE.CatmullRomCurve3;
  look: THREE.CatmullRomCurve3 | null;
}

export function CityCamera() {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const tracks = useMemo<Track[]>(
    () =>
      SEGMENTS.map((seg) => ({
        seg,
        pos: new THREE.CatmullRomCurve3(
          seg.keys.map((k) => k.pos),
          false,
          'centripetal',
        ),
        look: seg.keys[0].look ? new THREE.CatmullRomCurve3(seg.keys.map((k) => k.look!), false, 'centripetal') : null,
      })),
    [],
  );

  useEffect(() => {
    resetCityClock();
    return () => {
      camera.far = 700;
      camera.near = 0.1;
      camera.fov = 60;
      camera.updateProjectionMatrix();
    };
  }, [camera]);

  const tmp = useMemo(() => ({ p: new THREE.Vector3(), l: new THREE.Vector3(), e: new THREE.Euler(0, 0, 0, 'YXZ'), right: new THREE.Vector3() }), []);
  const bob = useRef({ phase: 0, w: 0 });
  const world = useRef<'space' | 'city' | ''>('');

  useFrame(({ clock }, delta) => {
    const dt = Math.min(delta, 0.1);
    if (!cityClock.hold) cityClock.t += dt;
    const t = cityClock.t;
    const seg = segmentAt(t);
    const tr = tracks[SEGMENTS.indexOf(seg)];
    const keys = seg.keys;
    const n = keys.length;
    let i = 0;
    while (i < n - 2 && t > keys[i + 1].t) i++;
    const local = Math.min(1, Math.max(0, (t - keys[i].t) / (keys[i + 1].t - keys[i].t)));
    const u = (i + local) / (n - 1);
    tr.pos.getPoint(u, tmp.p);

    // each world has its own scale: planets far apart, or a city in metres
    if (world.current !== seg.world) {
      world.current = seg.world;
      camera.near = seg.world === 'space' ? 0.05 : 0.03;
      camera.far = seg.world === 'space' ? 9000 : 6000;
      camera.updateProjectionMatrix();
    }

    // drag turns his head; let go and it eases back
    if (!cityClock.dragging) {
      cityClock.lookYaw *= Math.exp(-dt * 1.1);
      cityClock.lookPitch *= Math.exp(-dt * 1.1);
    }

    if (tr.look) {
      tr.look.getPoint(u, tmp.l);
      camera.position.copy(tmp.p);
      camera.up.set(0, 1, 0);
      camera.lookAt(tmp.l);
    } else {
      const k0 = keys[Math.max(0, i - 1)];
      const k1 = keys[i];
      const k2 = keys[i + 1];
      const k3 = keys[Math.min(n - 1, i + 2)];
      let yaw = cr(k0.yaw!, k1.yaw!, k2.yaw!, k3.yaw!, local);
      let pitch = cr(k0.pitch!, k1.pitch!, k2.pitch!, k3.pitch!, local);
      const walk = (k1.walk ?? 0) + ((k2.walk ?? 0) - (k1.walk ?? 0)) * local;

      // the walk: a soft rise and fall with each step, a slight sway; nothing jerky
      const calm = env.reducedMotion;
      bob.current.w += ((calm ? 0 : walk) - bob.current.w) * damp(3, dt);
      const w = bob.current.w;
      bob.current.phase += dt * Math.PI * 1.85 * (w > 0.01 ? 1 : 0);
      const ph = bob.current.phase;
      const time = clock.elapsedTime;
      // standing still, a person still breathes and their gaze drifts a little
      const still = calm ? 0 : 1 - w;
      yaw += Math.sin(time * 0.37) * 0.008 * still + Math.sin(ph) * 0.006 * w;
      pitch += Math.sin(time * 0.9) * 0.004 * still + Math.sin(ph * 2) * 0.006 * w;
      yaw += cityClock.lookYaw;
      pitch = Math.max(-1.35, Math.min(1.35, pitch + cityClock.lookPitch));
      const roll = Math.sin(ph) * 0.006 * w;

      tmp.e.set(pitch, yaw, roll, 'YXZ');
      camera.quaternion.setFromEuler(tmp.e);
      tmp.right.set(1, 0, 0).applyQuaternion(camera.quaternion);
      camera.position
        .copy(tmp.p)
        .addScaledVector(tmp.right, Math.sin(ph) * 0.016 * w)
        .add(tmp.l.set(0, -Math.abs(Math.sin(ph)) * 0.038 * w + 0.019 * w, 0));
    }
    camera.updateMatrixWorld();
  });

  return null;
}

