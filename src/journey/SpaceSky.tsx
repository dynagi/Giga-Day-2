import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { env } from '../lib/env';
import { hex3 } from '../lib/ease';
import { SUN_DIR } from './space';

/**
 * Deep space around the journey: a sphere of stars (with a faint Milky Way band)
 * far behind everything, and the Sun as a soft bright glow in its direction.
 * Both follow the camera, so they always stay infinitely far away.
 */

const starVert = /* glsl */ `
  attribute float aSize;
  attribute vec3 aColor;
  attribute float aSeed;
  uniform float uTime;
  uniform float uPixelRatio;
  varying vec3 vColor;
  varying float vA;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = aSize * uPixelRatio;
    vColor = aColor;
    vA = 0.65 + 0.35 * sin(uTime * (0.6 + aSeed) + aSeed * 40.0);
  }
`;
const starFrag = /* glsl */ `
  varying vec3 vColor;
  varying float vA;
  void main() {
    float r = length(gl_PointCoord - 0.5) * 2.0;
    if (r > 1.0) discard;
    gl_FragColor = vec4(vColor, exp(-r * r * 5.0) * vA);
  }
`;

const sunFrag = /* glsl */ `
  varying vec2 vUv;
  void main() {
    float r = length(vUv - 0.5) * 2.0;
    float core = exp(-r * r * 60.0);
    float halo = exp(-r * r * 6.0) * 0.35 + exp(-r * 2.6) * 0.12;
    vec3 col = mix(vec3(1.0, 0.86, 0.62), vec3(1.0, 0.98, 0.92), core);
    gl_FragColor = vec4(col, (core * 1.5 + halo) * (1.0 - smoothstep(0.8, 1.0, r)));
  }
`;
const sunVert = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const R = 900;

export function SpaceSky() {
  const res = useMemo(() => {
    const n = env.lowPower ? 2600 : 4800;
    const pos = new Float32Array(n * 3);
    const col = new Float32Array(n * 3);
    const size = new Float32Array(n);
    const seed = new Float32Array(n);
    const cols = ['#ffffff', '#f2ecff', '#dccbf6', '#e4e8ff', '#f3d9a4'].map(hex3);
    // the Milky Way band: a great circle tilted across the sky
    const bandN = new THREE.Vector3(0.3, 1, -0.4).normalize();
    for (let i = 0; i < n; i++) {
      let v = new THREE.Vector3().randomDirection();
      const inBand = i < n * 0.35;
      if (inBand) {
        // squash toward the band plane
        const d = v.dot(bandN);
        v = v.sub(bandN.clone().multiplyScalar(d * 0.88)).normalize();
      }
      pos.set([v.x * R, v.y * R, v.z * R], i * 3);
      const c = cols[Math.random() < 0.06 ? 4 : (Math.random() * 4) | 0];
      col.set(c, i * 3);
      size[i] = (inBand ? 0.8 : 1) + Math.pow(Math.random(), 4) * 2.6;
      seed[i] = Math.random();
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
    geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
    const mat = new THREE.ShaderMaterial({
      vertexShader: starVert,
      fragmentShader: starFrag,
      uniforms: { uTime: { value: 0 }, uPixelRatio: { value: 1 } },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const sunGeo = new THREE.PlaneGeometry(1, 1);
    const sunMat = new THREE.ShaderMaterial({
      vertexShader: sunVert,
      fragmentShader: sunFrag,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    return { geo, mat, sunGeo, sunMat };
  }, []);

  useEffect(
    () => () => {
      res.geo.dispose();
      res.mat.dispose();
      res.sunGeo.dispose();
      res.sunMat.dispose();
    },
    [res],
  );

  const sunPos = useMemo(() => SUN_DIR.clone().multiplyScalar(R * 0.8), []);

  useFrame(({ camera, clock, viewport, scene }) => {
    res.mat.uniforms.uTime.value = clock.elapsedTime;
    res.mat.uniforms.uPixelRatio.value = viewport.dpr;
    const sky = scene.getObjectByName('space-sky');
    if (sky) sky.position.copy(camera.position);
    const sun = scene.getObjectByName('space-sun');
    if (sun) sun.quaternion.copy(camera.quaternion);
  });

  return (
    <group name="space-sky" renderOrder={-20}>
      <points geometry={res.geo} material={res.mat} frustumCulled={false} renderOrder={-20} />
      <mesh name="space-sun" geometry={res.sunGeo} material={res.sunMat} position={sunPos} scale={260} renderOrder={-19} frustumCulled={false} />
    </group>
  );
}
