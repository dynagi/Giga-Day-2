import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { counts } from '../lib/env';
import { hex3, now } from '../lib/ease';
import { fx } from '../state/fx';

const vert = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const frag = (octaves: number) => /* glsl */ `
  #define OCTAVES ${octaves}
  uniform float uTime;
  uniform float uIntensity;
  uniform float uSeed;
  uniform float uScale;
  uniform float uOpacity;
  uniform vec3 uColA;
  uniform vec3 uColB;
  uniform vec3 uGold;
  uniform float uGoldAmt;
  uniform vec2 uGoldPos;
  uniform vec2 uLo;
  varying vec2 vUv;

  float hash(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }
  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
               mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
  }
  float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
    for (int i = 0; i < OCTAVES; i++) {
      v += a * noise(p);
      p = m * p;
      a *= 0.5;
    }
    return v;
  }

  void main() {
    vec2 p = (vUv - 0.5) * uScale + uSeed;
    float t = uTime * 0.0035;
    vec2 q = vec2(fbm(p + vec2(0.0, t)), fbm(p + vec2(5.2, 1.3) - t));
    float n = fbm(p + 1.8 * q + vec2(t * 0.6, -t * 0.4));
    float cloud = smoothstep(uLo.x, uLo.y, n);
    vec3 col = mix(uColA, uColB, smoothstep(0.35, 0.85, n + (q.x - 0.5) * 0.35));
    vec2 gd = vUv - uGoldPos;
    float g = exp(-dot(gd, gd) * 140.0) * uGoldAmt;
    col = mix(col, uGold, clamp(g * (0.4 + cloud), 0.0, 1.0));
    float edge = 1.0 - smoothstep(0.28, 0.5, length(vUv - 0.5));
    float a = cloud * edge * uOpacity * uIntensity;
    gl_FragColor = vec4(col, a);
  }
`;

interface Layer {
  z: number;
  size: number;
  scale: number;
  seed: number;
  opacity: number;
  a: string;
  b: string;
  goldAmt: number;
  goldPos: [number, number];
  lo: [number, number];
}

const LAYERS: Layer[] = [
  // deep body, with the one warm gold region (lower-left of view)
  { z: -150, size: 600, scale: 7, seed: 3.1, opacity: 0.78, a: '#251a46', b: '#3a2a63', goldAmt: 0.42, goldPos: [0.455, 0.465], lo: [0.3, 0.8] },
  // mid violet → lavender clouds
  { z: -105, size: 430, scale: 6, seed: 11.7, opacity: 0.32, a: '#3a2a63', b: '#b49ddc', goldAmt: 0, goldPos: [0, 0], lo: [0.42, 0.88] },
  // faint lilac wisps, nearest
  { z: -72, size: 320, scale: 5, seed: 27.4, opacity: 0.08, a: '#b49ddc', b: '#dccbf6', goldAmt: 0, goldPos: [0, 0], lo: [0.5, 0.92] },
];

/** 3 large soft cloud layers. Very slow drift; parallax comes from the camera flight. */
export function Nebula() {
  const { geos, mats } = useMemo(() => {
    const fragSrc = frag(counts.octaves);
    const geos = LAYERS.map((l) => new THREE.PlaneGeometry(l.size, l.size));
    const mats = LAYERS.map(
      (l) =>
        new THREE.ShaderMaterial({
          vertexShader: vert,
          fragmentShader: fragSrc,
          transparent: true,
          depthWrite: false,
          depthTest: false,
          blending: THREE.AdditiveBlending,
          uniforms: {
            uTime: { value: 0 },
            uIntensity: { value: 0.3 },
            uSeed: { value: l.seed },
            uScale: { value: l.scale },
            uOpacity: { value: l.opacity },
            uColA: { value: new THREE.Vector3(...hex3(l.a)) },
            uColB: { value: new THREE.Vector3(...hex3(l.b)) },
            uGold: { value: new THREE.Vector3(...hex3('#f3d9a4')) },
            uGoldAmt: { value: l.goldAmt },
            uGoldPos: { value: new THREE.Vector2(...l.goldPos) },
            uLo: { value: new THREE.Vector2(...l.lo) },
          },
        }),
    );
    return { geos, mats };
  }, []);

  useEffect(
    () => () => {
      geos.forEach((g) => g.dispose());
      mats.forEach((m) => m.dispose());
    },
    [geos, mats],
  );

  useFrame(() => {
    const t = now();
    const intensity = (0.3 + 0.7 * fx.reveal) * (1 - 0.18 * fx.hush.v);
    for (const m of mats) {
      m.uniforms.uTime.value = t;
      m.uniforms.uIntensity.value = intensity;
    }
  });

  return (
    <group>
      {LAYERS.map((l, i) => (
        <mesh key={i} geometry={geos[i]} material={mats[i]} position={[0, 0, l.z]} renderOrder={-10 + i} frustumCulled={false} />
      ))}
    </group>
  );
}
