import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { env } from '../lib/env';
import { hex3, now } from '../lib/ease';
import { journeyClock } from './clock';
import { NOISE_GLSL } from './noise.glsl';
import { along, DUST_AT, NEBULA_AT, TRAVEL_DIR } from './voyageLayout';

/* ------------------------------------------------------------------ travel stars */
// Stars scattered along the route. Each is a tiny segment whose tail stretches back
// along our motion as we speed up: gentle light streaks, never a warp tunnel.
const streakVert = /* glsl */ `
  attribute float aTail;   // 0 = head, 1 = tail
  attribute vec3 aColor;
  uniform vec3 uVel;
  uniform float uLen;
  uniform float uOn;
  varying vec3 vColor;
  varying float vA;
  void main() {
    vec3 p = position - uVel * uLen * aTail;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    float d = -mv.z;
    vColor = aColor;
    vA = uOn * (1.0 - aTail * 0.9) * smoothstep(900.0, 250.0, d) * smoothstep(1.0, 12.0, d);
  }
`;
const streakFrag = /* glsl */ `
  varying vec3 vColor;
  varying float vA;
  void main() { gl_FragColor = vec4(vColor, vA); }
`;

export function TravelStars() {
  const res = useMemo(() => {
    const n = env.lowPower ? 1800 : 3600;
    const pos = new Float32Array(n * 6);
    const tail = new Float32Array(n * 2);
    const col = new Float32Array(n * 6);
    const cols = ['#ffffff', '#e8e0ff', '#dccbf6', '#f3d9a4'].map(hex3);
    const side = new THREE.Vector3().crossVectors(TRAVEL_DIR, new THREE.Vector3(0, 1, 0)).normalize();
    const up = new THREE.Vector3().crossVectors(side, TRAVEL_DIR).normalize();
    for (let i = 0; i < n; i++) {
      const d = -100 + Math.random() * 4400;
      const a = Math.random() * Math.PI * 2;
      const r = 18 + Math.pow(Math.random(), 0.6) * 260;
      const p = along(d).add(side.clone().multiplyScalar(Math.cos(a) * r)).add(up.clone().multiplyScalar(Math.sin(a) * r));
      pos.set([p.x, p.y, p.z, p.x, p.y, p.z], i * 6);
      tail.set([0, 1], i * 2);
      const c = cols[Math.random() < 0.1 ? 3 : (Math.random() * 3) | 0];
      col.set([...c, ...c], i * 6);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aTail', new THREE.BufferAttribute(tail, 1));
    geo.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
    const mat = new THREE.ShaderMaterial({
      vertexShader: streakVert,
      fragmentShader: streakFrag,
      uniforms: { uVel: { value: new THREE.Vector3(0, 0, -1) }, uLen: { value: 0 }, uOn: { value: 0 } },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    return { geo, mat };
  }, []);
  useEffect(() => () => (res.geo.dispose(), res.mat.dispose()), [res]);
  useFrame(() => {
    res.mat.uniforms.uVel.value.copy(journeyClock.vel);
    // streak length follows speed (and grows a little more when she holds to go faster)
    res.mat.uniforms.uLen.value = Math.min(46, journeyClock.speed * (0.03 + 0.03 * journeyClock.boost));
    res.mat.uniforms.uOn.value = journeyClock.voyage;
  });
  return <lineSegments geometry={res.geo} material={res.mat} frustumCulled={false} />;
}

/* ------------------------------------------------------------------ cosmic dust */
const dustVert = /* glsl */ `
  attribute float aSeed;
  attribute vec3 aColor;
  uniform float uTime;
  uniform float uPixelRatio;
  uniform float uOn;
  varying vec3 vColor;
  varying float vA;
  void main() {
    vec3 p = position + vec3(sin(uTime * 0.2 + aSeed * 30.0), cos(uTime * 0.17 + aSeed * 21.0), sin(uTime * 0.13 + aSeed * 11.0)) * 4.0;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    float d = max(-mv.z, 0.5);
    gl_PointSize = clamp((2.0 + aSeed * 5.0) * 60.0 / d, 0.0, 15.0) * uPixelRatio;
    vColor = aColor;
    vA = uOn * smoothstep(600.0, 120.0, d) * smoothstep(2.0, 10.0, d) * (0.45 + 0.55 * aSeed);
  }
`;
const softFrag = /* glsl */ `
  varying vec3 vColor;
  varying float vA;
  void main() {
    float r = length(gl_PointCoord - 0.5) * 2.0;
    if (r > 1.0) discard;
    gl_FragColor = vec4(vColor, exp(-r * r * 3.5) * vA);
  }
`;

export function CosmicDust() {
  const res = useMemo(() => {
    const n = env.lowPower ? 1500 : 2800;
    const pos = new Float32Array(n * 3);
    const col = new Float32Array(n * 3);
    const seed = new Float32Array(n);
    const cols = ['#f3d9a4', '#dccbf6', '#b49ddc', '#f2bdd6', '#fff0d6'].map(hex3);
    for (let i = 0; i < n; i++) {
      // a long, soft cloud the route runs through, thicker toward its middle
      const d = DUST_AT + (Math.random() + Math.random() + Math.random() - 1.5) * 420;
      const p = along(d, (Math.random() - 0.5) * 220, (Math.random() - 0.5) * 140);
      pos.set([p.x, p.y, p.z], i * 3);
      col.set(cols[(Math.random() * cols.length) | 0], i * 3);
      seed[i] = Math.random();
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
    geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
    const mat = new THREE.ShaderMaterial({
      vertexShader: dustVert,
      fragmentShader: softFrag,
      uniforms: { uTime: { value: 0 }, uPixelRatio: { value: 1 }, uOn: { value: 0 } },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    return { geo, mat };
  }, []);
  useEffect(() => () => (res.geo.dispose(), res.mat.dispose()), [res]);
  useFrame(({ viewport }) => {
    res.mat.uniforms.uTime.value = now();
    res.mat.uniforms.uPixelRatio.value = viewport.dpr;
    res.mat.uniforms.uOn.value = journeyClock.voyage;
  });
  return <points geometry={res.geo} material={res.mat} frustumCulled={false} />;
}

/* ------------------------------------------------------------------ nebula */
// A handful of huge soft cloud sheets (lavender, violet, deep blue, a little pink)
// beside the route. Each always faces the camera; the camera swings past them.
const nebVert = /* glsl */ `
  varying vec2 vUv;
  varying float vDist;
  void main() {
    vUv = uv;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vDist = -mv.z;
    gl_Position = projectionMatrix * mv;
  }
`;
const nebFrag = /* glsl */ `
  uniform vec3 uA;
  uniform vec3 uB;
  uniform float uSeed;
  uniform float uTime;
  uniform float uOn;
  varying vec2 vUv;
  varying float vDist;
  ${NOISE_GLSL}
  void main() {
    vec2 c = vUv - 0.5;
    float r = length(c) * 2.0;
    vec3 q = vec3(c * 3.0, uSeed) + vec3(0.0, 0.0, uTime * 0.01);
    float n = fbm3(q + fbm3(q * 1.8 + 4.0, 2) * 0.9, 4);
    float cloud = smoothstep(0.42, 0.85, n) * (1.0 - smoothstep(0.45, 1.0, r));
    vec3 col = mix(uA, uB, smoothstep(0.5, 0.9, n));
    // fade when the camera is very close or inside, so passing through stays soft
    float a = cloud * 0.55 * uOn * smoothstep(20.0, 140.0, vDist);
    gl_FragColor = vec4(col, a);
  }
`;

const NEB = [
  { d: NEBULA_AT - 120, sx: 170, sy: 30, size: 420, a: '#3a2a63', b: '#b49ddc', seed: 1.3 },
  { d: NEBULA_AT + 40, sx: 230, sy: -60, size: 520, a: '#1c2a5e', b: '#8d6bc9', seed: 4.1 },
  { d: NEBULA_AT + 180, sx: 120, sy: 90, size: 360, a: '#4a2a5e', b: '#f2bdd6', seed: 7.7 },
  { d: NEBULA_AT - 260, sx: -160, sy: -40, size: 340, a: '#2a1d4d', b: '#c4afeb', seed: 2.9 },
  { d: NEBULA_AT + 360, sx: 60, sy: -120, size: 460, a: '#18234f', b: '#a9b8f0', seed: 9.2 },
];

export function NebulaClouds() {
  const res = useMemo(() => {
    const plane = new THREE.PlaneGeometry(1, 1);
    const mats = NEB.map(
      (nb) =>
        new THREE.ShaderMaterial({
          vertexShader: nebVert,
          fragmentShader: nebFrag,
          uniforms: {
            uA: { value: new THREE.Vector3(...hex3(nb.a)) },
            uB: { value: new THREE.Vector3(...hex3(nb.b)) },
            uSeed: { value: nb.seed },
            uTime: { value: 0 },
            uOn: { value: 0 },
          },
          transparent: true,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
          side: THREE.DoubleSide,
        }),
    );
    const positions = NEB.map((nb) => along(nb.d, nb.sx, nb.sy));
    return { plane, mats, positions };
  }, []);
  useEffect(() => () => (res.plane.dispose(), res.mats.forEach((m) => m.dispose())), [res]);
  useFrame(({ camera, scene }) => {
    const t = now();
    res.mats.forEach((m, i) => {
      m.uniforms.uTime.value = t;
      m.uniforms.uOn.value = journeyClock.voyage;
      const mesh = scene.getObjectByName(`neb-${i}`);
      if (mesh) mesh.quaternion.copy(camera.quaternion);
    });
  });
  return (
    <group>
      {NEB.map((nb, i) => (
        <mesh key={i} name={`neb-${i}`} geometry={res.plane} material={res.mats[i]} position={res.positions[i]} scale={nb.size} frustumCulled={false} renderOrder={1} />
      ))}
    </group>
  );
}
