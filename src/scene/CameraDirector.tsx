import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import { env } from '../lib/env';
import { damp } from '../lib/ease';
import { fx } from '../state/fx';
import { useStory } from '../state/store';

const MAX_TILT = (1.5 * Math.PI) / 180;
const FLY_DISTANCE = env.reducedMotion ? 14 : 34;
const DRIFT_SPEED = env.reducedMotion ? 0.015 : 0.035;
const DRIFT_LIMIT = 8;

/** Almost-still camera: slow forward drift, tiny parallax, and the transition flight. */
export function CameraDirector() {
  const s = useRef({ drift: 0, yaw: 0, pitch: 0, lastZ: 0 });

  useFrame(({ camera }, delta) => {
    const dt = Math.min(delta, 0.1);
    const st = s.current;
    const phase = useStory.getState().phase;

    // scene reveal (gate/garden/intro → atmosphere), ~3s ease
    const dim = phase === 'gate' || phase === 'garden' || phase === 'intro';
    const target = dim ? 0 : 1;
    fx.reveal += (target - fx.reveal) * damp(1.1, dt);
    fx.hush.v += (fx.hush.target - fx.hush.v) * damp(0.9, dt);

    if (!dim) st.drift = Math.min(DRIFT_LIMIT, st.drift + DRIFT_SPEED * (1 - fx.hush.v) * dt);
    const z = -st.drift - fx.flight * FLY_DISTANCE;

    // star stretch follows forward speed (gentle; never a warp)
    const speed = dt > 0 ? (st.lastZ - z) / dt : 0;
    st.lastZ = z;
    const stretchTarget = env.reducedMotion ? 0 : Math.min(1, Math.max(0, speed / 16));
    fx.stretch += (stretchTarget - fx.stretch) * damp(4, dt);

    // pointer / tilt parallax
    const k = damp(1.4, dt);
    const yawT = env.reducedMotion ? 0 : -fx.pointer.x * MAX_TILT;
    const pitchT = env.reducedMotion ? 0 : fx.pointer.y * MAX_TILT;
    st.yaw += (yawT - st.yaw) * k;
    st.pitch += (pitchT - st.pitch) * k;

    camera.position.set(0, 0, z);
    camera.rotation.set(st.pitch, st.yaw, 0);
    camera.updateMatrixWorld();
  });

  return null;
}
