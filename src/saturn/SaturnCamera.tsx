import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { damp } from '../lib/ease';
import { env } from '../lib/env';
import { journeyClock } from '../journey/clock';
import { journeyInput } from '../journey/space';
import { shot, view } from './saturnSpace';

/**
 * Giga's eyes at Saturn. Each moment of the story has a shot; the eyes glide from one to the
 * next (never a cut), starting exactly where the voyage left them. Her drag turns the head.
 */
export function SaturnCamera() {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const cur = useMemo(() => ({ pos: new THREE.Vector3(), look: new THREE.Vector3(), ready: false }), []);
  const target = useMemo(() => ({ pos: new THREE.Vector3(), look: new THREE.Vector3() }), []);
  const tmp = useMemo(() => ({ off: new THREE.Vector3(), right: new THREE.Vector3(), up: new THREE.Vector3(0, 1, 0) }), []);
  const look = useRef({ yaw: 0, pitch: 0 });

  useEffect(() => {
    camera.far = 9000;
    camera.near = 0.05;
    camera.fov = 60;
    camera.updateProjectionMatrix();
    journeyClock.speed = 0;
    journeyClock.boost = journeyClock.boostTarget = 0;
  }, [camera]);

  useFrame(({ size }, delta) => {
    const dt = Math.min(delta, 0.1);
    view.aspect = size.width / Math.max(1, size.height);
    if (!cur.ready) {
      // start from wherever the voyage's camera is
      cur.pos.copy(camera.position);
      tmp.off.set(0, 0, -1).applyQuaternion(camera.quaternion);
      cur.look.copy(camera.position).addScaledVector(tmp.off, 200);
      cur.ready = true;
    }
    shot(target);
    // slow, cinematic easing between shots (calmer still with reduced motion: just a soft settle)
    const k = damp(env.reducedMotion ? 2.2 : 0.55, dt);
    cur.pos.lerp(target.pos, k);
    cur.look.lerp(target.look, damp(env.reducedMotion ? 2.2 : 0.8, dt));
    // never inside the planet
    camera.position.copy(cur.pos);

    // her drag turns his head
    const kk = damp(journeyInput.dragging ? 12 : 1.6, dt);
    if (!journeyInput.dragging) {
      journeyInput.dragYaw *= Math.exp(-dt * 0.9);
      journeyInput.dragPitch *= Math.exp(-dt * 0.9);
    }
    look.current.yaw += (journeyInput.dragYaw - look.current.yaw) * kk;
    look.current.pitch += (journeyInput.dragPitch - look.current.pitch) * kk;
    tmp.off.copy(cur.look).sub(cur.pos);
    if (Math.abs(look.current.yaw) > 1e-4 || Math.abs(look.current.pitch) > 1e-4) {
      tmp.off.applyAxisAngle(tmp.up, look.current.yaw);
      tmp.right.crossVectors(tmp.off, tmp.up).normalize();
      tmp.off.applyAxisAngle(tmp.right, look.current.pitch);
    }
    camera.up.set(0, 1, 0);
    camera.lookAt(tmp.off.add(cur.pos));
    camera.updateMatrixWorld();
    journeyClock.speed *= 0.9;
  });

  return null;
}
