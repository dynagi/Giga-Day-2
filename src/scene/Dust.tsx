import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { counts, env } from '../lib/env';
import { hex3, now } from '../lib/ease';
import { fx } from '../state/fx';

const vert = /* glsl */ `
  attribute float aSeed;
  attribute vec3 aColor;
  uniform float uTime;
  uniform float uPixelRatio;
  uniform float uReveal;
  uniform float uSpeed;
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    float t = uTime * uSpeed;
    vec3 p = position;
    p.x += sin(t * 0.05 + aSeed * 6.28) * 0.7 + t * 0.012;
    p.y += cos(t * 0.04 + aSeed * 5.1) * 0.5 + sin(t * 0.017 + aSeed) * 0.3;
    p.x = mod(p.x + 12.0, 24.0) - 12.0;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    float d = max(-mv.z, 0.05);
    gl_PointSize = (1.2 + aSeed * 1.8) * uPixelRatio * clamp(6.0 / d, 0.5, 5.0);
    // fade very close and very far
    float fade = smoothstep(0.4, 2.5, d) * (1.0 - smoothstep(30.0, 45.0, d));
    vColor = aColor;
    vAlpha = (0.22 + 0.3 * aSeed) * fade * smoothstep(0.15, 1.0, uReveal);
  }
`;

const frag = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    float r = length(gl_PointCoord - 0.5) * 2.0;
    if (r > 1.0) discard;
    gl_FragColor = vec4(vColor, (1.0 - r) * (1.0 - r) * vAlpha);
  }
`;

const COLORS = ['#dccbf6', '#b49ddc', '#f6effd', '#f3d9a4'].map(hex3);

/** Tiny drifting particles through the camera's path, for depth and parallax. */
export function Dust() {
  const { geo, mat } = useMemo(() => {
    const n = counts.dust;
    const pos = new Float32Array(n * 3);
    const col = new Float32Array(n * 3);
    const seed = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      pos.set([(Math.random() * 2 - 1) * 12, (Math.random() * 2 - 1) * 7, 3 - Math.random() * 50], i * 3);
      col.set(COLORS[Math.random() < 0.15 ? 3 : (Math.random() * 3) | 0], i * 3);
      seed[i] = Math.random();
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
    geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
    const mat = new THREE.ShaderMaterial({
      vertexShader: vert,
      fragmentShader: frag,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uTime: { value: 0 },
        uPixelRatio: { value: 1 },
        uReveal: { value: 0 },
        uSpeed: { value: env.reducedMotion ? 0.5 : 1 },
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

  useFrame(({ viewport }) => {
    mat.uniforms.uTime.value = now();
    mat.uniforms.uPixelRatio.value = viewport.dpr;
    mat.uniforms.uReveal.value = fx.reveal;
  });

  return <points geometry={geo} material={mat} frustumCulled={false} renderOrder={1} />;
}
