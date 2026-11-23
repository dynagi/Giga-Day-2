import * as THREE from 'three';
import { SATURN_POS, SATURN_R } from '../journey/voyageLayout';
import { SATURN_BASIS } from '../journey/voyageTimeline';
import { saturnDir } from './saturnScript';

/**
 * Saturn's own frame: A is its spin axis (the real 26.7° tilt), U0 and W0 lie in the ring plane.
 * Angles go around the planet; negative angles are on the sunlit side where we arrived.
 */
export const S = SATURN_POS;
export const R = SATURN_R;
const { A, U0, W0 } = SATURN_BASIS;
export { A, U0, W0 };

/** A point at angle θ around Saturn, `dist` planet radii out in the ring plane, `h` radii above it. */
export function polar(theta: number, dist: number, h: number, out = new THREE.Vector3()) {
  return out
    .copy(S)
    .addScaledVector(U0, Math.cos(theta) * dist * R)
    .addScaledVector(W0, Math.sin(theta) * dist * R)
    .addScaledVector(A, h * R);
}

const smooth = (x: number) => {
  const k = Math.min(1, Math.max(0, x));
  return k * k * (3 - 2 * k);
};

/** Where Enceladus settles for the reveal: just outside the rings, in front of Saturn. */
export const ENCELADUS_AT = polar(-0.8, 3.95, 0.3);
export const ENCELADUS_R = 0.055 * R;
/** Where the little light first appears, near the rings. */
export const LIGHT_FROM = polar(-0.62, 2.45, 0.06);

/** The light's path in the secret: appears near the rings, drifts in front of Saturn, settles. */
export function lightPos(partT: number, out = new THREE.Vector3()) {
  const k = smooth((partT - 1.2) / 6.5);
  out.copy(LIGHT_FROM).lerp(ENCELADUS_AT, k);
  // a gentle arc and the same little bob it had at the beginning
  out.addScaledVector(A, Math.sin(k * Math.PI) * 0.35 * R + Math.sin(partT * 2.4) * 0.03 * R * (1 - k * 0.6));
  return out;
}

/** The glide angle along the rings (keeps moving through chapter 1, so the shots join up). */
export function glideTheta(partT: number) {
  return -1.02 - 0.0105 * Math.max(0, partT - 5);
}

/** The screen's shape (set by the camera): tall phone screens step back so Saturn fits. */
export const view = { aspect: 16 / 9 };

/** The camera shot for the current moment of the story: where the eyes are, and where they look. */
export function shot(out: { pos: THREE.Vector3; look: THREE.Vector3 }) {
  const d = saturnDir;
  const T = d.partT;
  const tall = view.aspect < 1;
  switch (d.part) {
    case 'rings': {
      if (d.kind === 'title') {
        polar(-0.85, 6.4, 1.35, out.pos);
        out.look.copy(S).addScaledVector(A, -0.1 * R);
      } else if (d.line === 0) {
        polar(-0.98, 3.3, 0.36, out.pos);
        polar(-1.32, 2.05, -0.05, out.look);
      } else if (d.line >= 1 && d.line < 99 && d.kind === 'line') {
        const th = glideTheta(T);
        polar(th, 2.16, 0.055, out.pos);
        polar(th - 0.3, 2.04, -0.02, out.look);
      } else {
        // the Cassini Division: the dark gap between the rings
        const th = glideTheta(T);
        polar(th, 1.99, 0.02, out.pos);
        polar(th - 0.26, 1.99, -0.006, out.look);
      }
      break;
    }
    case 'shani': {
      polar(-0.72, 3.3, 2.9, out.pos);
      // Shani backs off a little ("khud tumse bach raha hai"), then comes back
      const back = d.line >= 3 && d.line < 99 ? 1.17 : d.kind === 'soft' ? 1.06 : 1;
      out.pos.sub(S).multiplyScalar(back).add(S);
      out.look.copy(S);
      break;
    }
    case 'moons': {
      polar(-0.52, 12.5, 2.7, out.pos);
      out.look.copy(S).addScaledVector(U0, -0.4 * R);
      break;
    }
    case 'gravity': {
      polar(-1.22, 8.6, 3.2, out.pos);
      out.look.copy(S);
      break;
    }
    case 'final': {
      // slowly pull back until all of Saturn and its rings are in view
      polar(-0.95, 5.2 + 3.4 * smooth(T / 32), 1.25 + 0.6 * smooth(T / 32), out.pos);
      out.look.copy(S);
      break;
    }
    case 'secret': {
      const lp = lightPos(T);
      polar(-1.04, 5.5, 0.62, out.pos);
      // on a tall screen, keep the little light in the middle of the view
      out.look.copy(S).lerp(lp, tall ? 0.97 : 0.72);
      break;
    }
    default: {
      polar(-0.98, 8.2, 1.8, out.pos);
      out.look.copy(S).addScaledVector(A, 0.45 * R);
    }
  }
  // tall screens: step back (except while gliding inside the rings)
  const inside = d.part === 'rings' && d.kind !== 'title';
  if (tall && !inside) {
    const back = Math.min(1.6, 0.95 / Math.sqrt(view.aspect));
    out.pos.sub(out.look).multiplyScalar(back).add(out.look);
  }
  return out;
}
