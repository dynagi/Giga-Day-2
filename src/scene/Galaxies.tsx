import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { env } from '../lib/env';
import { hex3, now } from '../lib/ease';
import { fx } from '../state/fx';

/**
 * Far-away galaxies filling the sky: spirals, a barred spiral, a fluffy many-armed
 * spiral, soft ellipticals and an irregular cloud. Each is a cloud of points that
 * slowly rotates. One draw call for all of them.
 * Nothing ring-shaped and nothing planet-like.
 */

type Kind = 'spiral' | 'barred' | 'flocculent' | 'elliptical' | 'irregular';

interface GalaxyDef {
  kind: Kind;
  dir: [number, number]; // yaw, pitch in degrees from straight ahead
  dist: number;
  radius: number;
  tilt: [number, number]; // disk orientation (degrees)
  arms: number;
  twist: number;
  spin: number;
  core: string;
  arm: string;
  accent: string;
  share: number; // relative particle count
}

// Placed around the edges of the view so the middle (where words appear) stays calm.
const ALL: GalaxyDef[] = [
  // top and bottom bands (visible on phones too)
  { kind: 'spiral', dir: [7, 23], dist: 150, radius: 19, tilt: [58, -30], arms: 2, twist: 3.0, spin: 0.05, core: '#fff1d6', arm: '#c4afeb', accent: '#f2bdd6', share: 1.1 },
  { kind: 'barred', dir: [-9, -23], dist: 150, radius: 20, tilt: [50, 25], arms: 2, twist: 2.4, spin: -0.045, core: '#f3d9a4', arm: '#a9b8f0', accent: '#f2bdd6', share: 1.15 },
  { kind: 'elliptical', dir: [15, -26], dist: 170, radius: 11, tilt: [0, 0], arms: 0, twist: 0, spin: 0, core: '#f6e4c4', arm: '#e6d2f0', accent: '#f3d9a4', share: 0.45 },
  { kind: 'irregular', dir: [-7, 27], dist: 175, radius: 12, tilt: [30, 10], arms: 0, twist: 0, spin: 0.02, core: '#dccbf6', arm: '#f2bdd6', accent: '#a9b8f0', share: 0.5 },
  // the wider sky (desktop)
  { kind: 'spiral', dir: [-34, 13], dist: 150, radius: 25, tilt: [62, 20], arms: 2, twist: 3.2, spin: 0.05, core: '#fff1d6', arm: '#b49ddc', accent: '#f2bdd6', share: 1.4 },
  { kind: 'flocculent', dir: [32, -13], dist: 160, radius: 22, tilt: [30, -40], arms: 5, twist: 2.0, spin: -0.05, core: '#fff6ea', arm: '#f2bdd6', accent: '#dccbf6', share: 1.25 },
  { kind: 'spiral', dir: [37, 18], dist: 170, radius: 17, tilt: [70, 55], arms: 3, twist: 2.8, spin: 0.05, core: '#fff1d6', arm: '#a9b8f0', accent: '#f3d9a4', share: 0.95 },
  { kind: 'elliptical', dir: [-29, -20], dist: 165, radius: 13, tilt: [0, 0], arms: 0, twist: 0, spin: 0, core: '#f3d9a4', arm: '#dccbf6', accent: '#ffffff', share: 0.5 },
  { kind: 'irregular', dir: [-47, -3], dist: 170, radius: 15, tilt: [20, 0], arms: 0, twist: 0, spin: 0.02, core: '#c4afeb', arm: '#a9b8f0', accent: '#f2bdd6', share: 0.6 },
  { kind: 'barred', dir: [52, 3], dist: 180, radius: 16, tilt: [40, 70], arms: 2, twist: 3.4, spin: -0.04, core: '#f6eee0', arm: '#dccbf6', accent: '#f2bdd6', share: 0.85 },
];

const vert = /* glsl */ `
  attribute vec3 aCenter;
  attribute vec3 aU;
  attribute vec3 aV;
  attribute vec3 aW;
  attribute vec4 aPolar;   // r (world), theta0, height, spin
  attribute vec3 aColor;
  attribute vec2 aSizeAlpha;
  uniform float uTime;
  uniform float uIntensity;
  uniform float uPixelRatio;
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    float r = aPolar.x;
    // each galaxy turns slowly as one piece, so its arms keep their shape
    float th = aPolar.y + uTime * aPolar.w * 0.4;
    vec3 p = aCenter + (aU * cos(th) + aV * sin(th)) * r + aW * aPolar.z;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    float d = max(-mv.z, 1.0);
    gl_PointSize = aSizeAlpha.x * uPixelRatio * clamp(150.0 / d, 0.6, 2.2);
    vColor = aColor;
    vAlpha = aSizeAlpha.y * uIntensity;
  }
`;

const frag = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    float r = length(gl_PointCoord - 0.5) * 2.0;
    if (r > 1.0) discard;
    float a = exp(-r * r * 4.0) * vAlpha;
    gl_FragColor = vec4(vColor, a);
  }
`;

function mulberry(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const gauss = (rnd: () => number) => {
  const u = Math.max(1e-6, rnd());
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rnd());
};
const mix = (a: [number, number, number], b: [number, number, number], t: number): [number, number, number] => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];

function build(defs: GalaxyDef[], perUnit: number) {
  const rnd = mulberry(0x9a1a);
  const centers: number[] = [];
  const us: number[] = [];
  const vs: number[] = [];
  const ws: number[] = [];
  const polar: number[] = [];
  const cols: number[] = [];
  const sa: number[] = [];
  const DEG = Math.PI / 180;

  for (const g of defs) {
    // where in the sky
    const yaw = g.dir[0] * DEG;
    const pitch = g.dir[1] * DEG;
    const c = new THREE.Vector3(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch)).multiplyScalar(g.dist);
    // disk orientation: start facing the camera, then tilt
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(g.tilt[0] * DEG, g.tilt[1] * DEG, 0, 'XYZ'));
    const look = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), c.clone().normalize().negate());
    q.premultiply(look);
    const U = new THREE.Vector3(1, 0, 0).applyQuaternion(q);
    const V = new THREE.Vector3(0, 1, 0).applyQuaternion(q);
    const W = new THREE.Vector3(0, 0, 1).applyQuaternion(q);
    const core = hex3(g.core);
    const arm = hex3(g.arm);
    const accent = hex3(g.accent);
    const n = Math.round(perUnit * g.share);
    const R = g.radius;

    const push = (r: number, th: number, h: number, col: [number, number, number], size: number, alpha: number, spin = g.spin) => {
      centers.push(c.x, c.y, c.z);
      us.push(U.x, U.y, U.z);
      vs.push(V.x, V.y, V.z);
      ws.push(W.x, W.y, W.z);
      polar.push(r, th, h, spin);
      cols.push(...col);
      sa.push(size, alpha);
    };

    for (let i = 0; i < n; i++) {
      const roll = rnd();
      if (g.kind === 'elliptical') {
        // a soft, smooth glow of old stars
        const r = Math.abs(gauss(rnd)) * R * 0.42;
        push(r, rnd() * Math.PI * 2, gauss(rnd) * R * 0.28 * (1 - Math.min(1, r / R)), mix(core, arm, Math.min(1, r / (R * 0.8))), 1.4 + rnd() * 1.4, 0.32 * (1 - Math.min(0.85, r / R)));
        continue;
      }
      if (g.kind === 'irregular') {
        // a few clumps, no arms
        const k = Math.floor(rnd() * 4);
        const cx = Math.cos(k * 1.9) * R * 0.45;
        const cy = Math.sin(k * 2.7) * R * 0.3;
        const x = cx + gauss(rnd) * R * 0.2;
        const y = cy + gauss(rnd) * R * 0.16;
        const glow = rnd() < 0.12;
        push(Math.hypot(x, y), Math.atan2(y, x), gauss(rnd) * 0.6, rnd() < 0.18 ? accent : mix(arm, core, rnd() * 0.4), glow ? 7 + rnd() * 6 : 1.3 + rnd() * 1.6, glow ? 0.06 : 0.36 + rnd() * 0.28);
        continue;
      }
      if (roll < 0.22) {
        // bright core
        const r = Math.abs(gauss(rnd)) * R * 0.1;
        push(r, rnd() * Math.PI * 2, gauss(rnd) * R * 0.04, mix(core, [1, 1, 1], rnd() * 0.3), 1.6 + rnd() * 1.8, 0.4);
        continue;
      }
      if (roll < 0.3) {
        // faint halo glow around the core
        const r = Math.abs(gauss(rnd)) * R * 0.28;
        push(r, rnd() * Math.PI * 2, gauss(rnd) * R * 0.06, mix(core, arm, 0.4), 6 + rnd() * 6, 0.06);
        continue;
      }
      if (g.kind === 'barred' && roll < 0.42) {
        // the bar through the middle
        const t = (rnd() * 2 - 1) * R * 0.38;
        push(Math.abs(t), (t < 0 ? Math.PI : 0) + gauss(rnd) * 0.08, gauss(rnd) * 0.3, mix(core, arm, Math.abs(t) / (R * 0.4)), 1.3 + rnd() * 1.2, 0.38);
        continue;
      }
      // spiral arms
      const a = Math.floor(rnd() * g.arms);
      const t = Math.pow(rnd(), 0.75);
      const r = (g.kind === 'barred' ? 0.36 + t * 0.64 : 0.08 + t * 0.92) * R;
      const spread = (g.kind === 'flocculent' ? 0.55 : 0.32) * (0.4 + t);
      const th = (a / g.arms) * Math.PI * 2 + Math.log(1 + r / (R * 0.12)) * g.twist + gauss(rnd) * spread;
      const knot = rnd() < 0.07; // pink star-forming knots
      if (rnd() < 0.12) {
        // soft coloured glow along the arm
        push(r, th, gauss(rnd) * R * 0.03, mix(arm, accent, rnd() * 0.5), 7 + rnd() * 7, 0.06);
        continue;
      }
      push(r, th, gauss(rnd) * R * 0.025, knot ? accent : mix(core, arm, Math.min(1, 0.25 + t * 1.3)), knot ? 2.2 + rnd() * 1.6 : 1.2 + rnd() * 1.7, knot ? 0.6 : 0.32 + rnd() * 0.3);
    }
  }

  const geo = new THREE.BufferGeometry();
  const f3 = (a: number[]) => new THREE.BufferAttribute(new Float32Array(a), 3);
  geo.setAttribute('position', f3(centers)); // bounding only; real position built in the shader
  geo.setAttribute('aCenter', f3(centers));
  geo.setAttribute('aU', f3(us));
  geo.setAttribute('aV', f3(vs));
  geo.setAttribute('aW', f3(ws));
  geo.setAttribute('aPolar', new THREE.BufferAttribute(new Float32Array(polar), 4));
  geo.setAttribute('aColor', f3(cols));
  geo.setAttribute('aSizeAlpha', new THREE.BufferAttribute(new Float32Array(sa), 2));
  return geo;
}

export function Galaxies() {
  const { geo, mat } = useMemo(() => {
    // phones: the four top/bottom-band galaxies plus the two big side spirals
    const defs = env.lowPower ? [...ALL.slice(0, 4), ALL[4], ALL[5]] : ALL;
    const perUnit = (env.lowPower ? 800 : 1500) * (env.reducedMotion ? 0.7 : 1);
    const geo = build(defs, perUnit);
    const mat = new THREE.ShaderMaterial({
      vertexShader: vert,
      fragmentShader: frag,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: THREE.AdditiveBlending,
      uniforms: { uTime: { value: 0 }, uIntensity: { value: 0.3 }, uPixelRatio: { value: 1 } },
    });
    return { geo, mat };
  }, []);

  useEffect(
    () => () => {
      geo.dispose();
      mat.dispose();
    },
    [geo, mat],
  );

  useFrame(({ viewport }) => {
    mat.uniforms.uTime.value = env.reducedMotion ? 0 : now();
    mat.uniforms.uPixelRatio.value = viewport.dpr;
    // fade in with the sky, and quiet down a little for the poems
    mat.uniforms.uIntensity.value = (0.25 + 0.75 * fx.reveal) * (1 - 0.35 * fx.hush.v);
  });

  return <points geometry={geo} material={mat} frustumCulled={false} renderOrder={-5} />;
}
