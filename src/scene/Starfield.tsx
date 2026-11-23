import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { counts, env } from '../lib/env';
import { damp, hex3, now } from '../lib/ease';
import { fx } from '../state/fx';

const vert = /* glsl */ `
  attribute float aSize;
  attribute vec3 aColor;
  attribute float aSeed;
  attribute float aPick;
  uniform float uTime;
  uniform float uReveal;
  uniform float uHush;
  uniform float uPixelRatio;
  uniform float uAspect;
  uniform float uStretch;
  uniform float uTwinkle;
  uniform vec4 uFocus;   // x, y, radius, strength
  uniform vec2 uBand;    // which stars respond to focus
  uniform vec3 uWave;    // x, y, seconds since start
  uniform float uWaveAmp;
  varying vec3 vColor;
  varying float vAlpha;
  varying vec2 vDir;
  varying float vS;

  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vec4 clip = projectionMatrix * mv;
    gl_Position = clip;
    vec2 ndc = clip.xy / max(clip.w, 0.0001);
    vec2 asp = vec2(uAspect, 1.0);

    float tw = 0.72 + 0.28 * sin(uTime * (0.5 + aSeed * 1.5) * uTwinkle + aSeed * 41.0);
    tw *= 0.9 + 0.1 * sin(uTime * 0.23 * uTwinkle + aSeed * 13.0);
    float b = tw;

    // a few nearby stars brighten very slightly
    float inBand = step(uBand.x, aPick) * step(aPick, uBand.y);
    float fd = length((ndc - uFocus.xy) * asp);
    float focus = inBand * uFocus.w * (1.0 - smoothstep(uFocus.z * 0.4, uFocus.z, fd));
    b += focus * 0.75;

    // twinkle wave across the screen
    float wt = uWave.z;
    if (wt > 0.0 && wt < 3.2) {
      float d = length((ndc - uWave.xy) * asp);
      float r = wt * 1.45;
      b += uWaveAmp * 0.95 * exp(-pow((d - r) * 4.5, 2.0)) * (1.0 - smoothstep(1.8, 3.2, wt));
    }

    // twinkle in during the atmosphere phase
    float rev = mix(0.3, 1.0, smoothstep(aSeed * 0.65, aSeed * 0.65 + 0.35, uReveal));

    float dist = length(mv.xyz);
    float sizeK = clamp(70.0 / dist, 0.85, 2.2);
    float s = uStretch * smoothstep(0.05, 0.9, length(ndc * asp)) * 1.6;
    vS = s;
    vDir = normalize(ndc * asp + vec2(0.0001, 0.0));
    vColor = aColor;
    vAlpha = clamp(b, 0.0, 1.7) * rev * (1.0 - 0.32 * uHush);
    gl_PointSize = aSize * sizeK * uPixelRatio * (1.0 + 0.2 * focus) * (1.0 + s);
  }
`;

const frag = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;
  varying vec2 vDir;
  varying float vS;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    c.y = -c.y;
    float along = dot(c, vDir);
    float across = dot(c, vec2(-vDir.y, vDir.x)) * (1.0 + vS);
    float r = length(vec2(along, across)) * 2.0;
    if (r > 1.0) discard;
    float core = exp(-r * r * 9.0);
    float soft = (1.0 - r) * (1.0 - r) * 0.3;
    gl_FragColor = vec4(vColor, (core + soft) * vAlpha);
  }
`;

const COOL = ['#f6effd', '#f6effd', '#dccbf6', '#e4e8ff'].map(hex3);
const GOLD = hex3('#f3d9a4');

function buildStars(n: number) {
  const pos = new Float32Array(n * 3);
  const col = new Float32Array(n * 3);
  const size = new Float32Array(n);
  const seed = new Float32Array(n);
  const pick = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    // 75% in a forward cone (where the camera looks), the rest spread around
    let z: number;
    if (Math.random() < 0.75) z = -(0.45 + Math.random() * 0.55);
    else z = Math.random() * 1.3 - 1;
    const phi = Math.random() * Math.PI * 2;
    const rr = Math.sqrt(Math.max(0, 1 - z * z));
    const near = Math.random() < 0.18;
    const dist = near ? 16 + Math.random() * 26 : 45 + Math.pow(Math.random(), 0.7) * 140;
    let x = rr * Math.cos(phi) * dist;
    let y = rr * Math.sin(phi) * dist;
    const zz = z * dist;
    // keep the camera's flight corridor clear
    const radial = Math.hypot(x, y);
    if (zz > -70 && radial < 8) {
      const k = (8 + Math.random() * 6) / Math.max(radial, 0.01);
      x *= k;
      y *= k;
    }
    pos.set([x, y, zz], i * 3);
    const gold = Math.random() < 0.05;
    col.set(gold ? GOLD : COOL[(Math.random() * COOL.length) | 0], i * 3);
    size[i] = (gold ? 1.6 : 1.0) + Math.pow(Math.random(), 3) * 2.6;
    seed[i] = Math.random();
    pick[i] = Math.random();
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
  g.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
  g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
  g.setAttribute('aPick', new THREE.BufferAttribute(pick, 1));
  return g;
}

export function Starfield() {
  const { geo, mat } = useMemo(() => {
    const geo = buildStars(counts.stars);
    const mat = new THREE.ShaderMaterial({
      vertexShader: vert,
      fragmentShader: frag,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uTime: { value: 0 },
        uReveal: { value: 0 },
        uHush: { value: 0 },
        uPixelRatio: { value: 1 },
        uAspect: { value: 1 },
        uStretch: { value: 0 },
        uTwinkle: { value: env.reducedMotion ? 0.4 : 1 },
        uFocus: { value: new THREE.Vector4(0, 0, 0.7, 0) },
        uBand: { value: new THREE.Vector2(0, 0) },
        uWave: { value: new THREE.Vector3(0, 0, -1) },
        uWaveAmp: { value: 1 },
      },
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

  useFrame(({ size, viewport }, delta) => {
    const dt = Math.min(delta, 0.1);
    const u = mat.uniforms;
    const t = now();
    const f = fx.focus;
    f.s += (f.target - f.s) * damp(1.6, dt);
    u.uTime.value = t;
    u.uReveal.value = fx.reveal;
    u.uHush.value = fx.hush.v;
    u.uPixelRatio.value = viewport.dpr;
    u.uAspect.value = size.width / Math.max(1, size.height);
    u.uStretch.value = fx.stretch;
    (u.uFocus.value as THREE.Vector4).set(f.x, f.y, f.r, f.s);
    (u.uBand.value as THREE.Vector2).set(f.lo, f.hi);
    (u.uWave.value as THREE.Vector3).set(fx.wave.x, fx.wave.y, t - fx.wave.t0);
    u.uWaveAmp.value = fx.wave.amp;
  });

  return <points geometry={geo} material={mat} frustumCulled={false} renderOrder={0} />;
}
