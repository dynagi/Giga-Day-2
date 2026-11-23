import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { env } from '../lib/env';
import { makeAtmosphereHalo, makeAtmosphereRim } from './shaders';
import type { JourneyTextures } from './textures';

/**
 * Photo-textured Earth, Moon and Saturn, built with the Solar System kit's recipe:
 * matte MeshStandardMaterial, one warm sunlight, a faint lavender fill, filmic tone mapping,
 * a two-layer atmosphere (Fresnel rim + back-face halo), Earth's night lights only on the
 * night side, a drifting cloud layer, and Saturn's photo rings with the planet's shadow on them.
 */

/** The Sun, far away in a fixed direction (the kit used a point light at the origin). */
export function sunFar(dir: THREE.Vector3) {
  return dir.clone().multiplyScalar(20000);
}

/** Earth: city lights glow only on the night side, fading across the terminator (from the kit). */
function nightSideLights(mat: THREE.MeshStandardMaterial, sunPos: THREE.Vector3) {
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uSunPos = { value: sunPos };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWN;\nvarying vec3 vWP;')
      .replace(
        '#include <project_vertex>',
        '#include <project_vertex>\nvWN = normalize(mat3(modelMatrix) * objectNormal);\nvWP = (modelMatrix * vec4(transformed, 1.0)).xyz;',
      );
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 uSunPos;\nvarying vec3 vWN;\nvarying vec3 vWP;')
      .replace(
        '#include <emissivemap_fragment>',
        '#include <emissivemap_fragment>\nfloat sunK = dot(normalize(vWN), normalize(uSunPos - vWP));\ntotalEmissiveRadiance *= smoothstep(0.12, -0.18, sunK);',
      );
  };
}

function useDispose(...items: { dispose: () => void }[]) {
  useEffect(() => () => items.forEach((i) => i.dispose()), items); // eslint-disable-line react-hooks/exhaustive-deps
}

/* ------------------------------------------------------------------ Earth */
export function RealEarth({ tex, radius, sun }: { tex: JourneyTextures; radius: number; sun: THREE.Vector3 }) {
  const seg = env.lowPower ? 64 : 128;
  const res = useMemo(() => {
    const geo = new THREE.SphereGeometry(radius, seg, Math.round(seg * 0.66));
    const surface = new THREE.MeshStandardMaterial({ map: tex.earthDay, roughness: 0.78, metalness: 0 });
    if (tex.earthNight) {
      surface.emissiveMap = tex.earthNight;
      surface.emissive = new THREE.Color('#ffd9a0');
      surface.emissiveIntensity = 1.35;
      nightSideLights(surface, sun);
    }
    const clouds = tex.earthClouds
      ? new THREE.MeshStandardMaterial({ color: '#ffffff', alphaMap: tex.earthClouds, transparent: true, depthWrite: false, roughness: 1, opacity: 0.95 })
      : null;
    const rim = makeAtmosphereRim('#86b8ff', 0.75);
    const halo = makeAtmosphereHalo('#86b8ff', 0.75);
    rim.uniforms.uSun.value.copy(sun);
    halo.uniforms.uSun.value.copy(sun);
    const haloGeo = new THREE.SphereGeometry(radius, 48, 32);
    return { geo, surface, clouds, rim, halo, haloGeo };
  }, [tex, radius, sun, seg]);
  useDispose(res.geo, res.surface, res.rim, res.halo, res.haloGeo, ...(res.clouds ? [res.clouds] : []));

  const spin = useRef<THREE.Mesh>(null);
  const cloudRef = useRef<THREE.Mesh>(null);
  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.1);
    if (spin.current) spin.current.rotation.y += dt * 0.012;
    if (cloudRef.current) cloudRef.current.rotation.y += dt * 0.016;
  });

  return (
    <group>
      {/* the real 23.4° tilt */}
      <group rotation={[0, 0, THREE.MathUtils.degToRad(23.4)]}>
        <mesh ref={spin} geometry={res.geo} material={res.surface} />
        {res.clouds && <mesh ref={cloudRef} geometry={res.geo} material={res.clouds} scale={1.012} />}
      </group>
      <mesh geometry={res.geo} material={res.rim} scale={1.012} />
      <mesh geometry={res.haloGeo} material={res.halo} scale={1.16} />
    </group>
  );
}

/* ------------------------------------------------------------------ Moon */
export function RealMoon({ tex, radius, blush }: { tex: JourneyTextures; radius: number; blush: { value: number } }) {
  const res = useMemo(() => {
    const geo = new THREE.SphereGeometry(radius, env.lowPower ? 64 : 96, env.lowPower ? 40 : 64);
    const mat = new THREE.MeshStandardMaterial({
      map: tex.moon,
      bumpMap: tex.moon,
      bumpScale: 1.4,
      roughness: 1,
      metalness: 0,
      emissive: new THREE.Color('#ff7fb2'),
      emissiveIntensity: 0,
    });
    return { geo, mat };
  }, [tex, radius]);
  useDispose(res.geo, res.mat);
  useFrame(() => {
    // when she taps the Moon, it blushes pink
    res.mat.emissiveIntensity = blush.value * 0.42;
  });
  return <mesh geometry={res.geo} material={res.mat} rotation={[0.2, 2.2, 0]} />;
}

/* ------------------------------------------------------------------ Saturn */
/** Ring geometry with radial UVs (u = inner → outer edge) so the 1D ring strip maps correctly (from the kit). */
function ringGeometry(inner: number, outer: number) {
  const g = new THREE.RingGeometry(inner, outer, 256, 1);
  const pos = g.attributes.position;
  const uv = g.attributes.uv;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    uv.setXY(i, (v.length() - inner) / (outer - inner), 0.5);
  }
  return g;
}

/** Sun-lit rings with the planet's shadow across them (ray–sphere test per pixel), from the kit, plus a fade. */
function makeRingMaterial(map: THREE.Texture, brightness: number) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uMap: { value: map },
      uPlanet: { value: new THREE.Vector3() },
      uRadius: { value: 1 },
      uSun: { value: new THREE.Vector3() },
      uBright: { value: brightness },
      uFade: { value: 1 },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      varying vec3 vWorld;
      void main() {
        vUv = uv;
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorld = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D uMap;
      uniform vec3 uPlanet;
      uniform float uRadius;
      uniform vec3 uSun;
      uniform float uBright;
      uniform float uFade;
      varying vec2 vUv;
      varying vec3 vWorld;
      void main() {
        vec4 c = texture2D(uMap, vUv);
        vec3 d = normalize(uSun - vWorld);
        vec3 oc = vWorld - uPlanet;
        float b = dot(oc, d);
        float h = b * b - (dot(oc, oc) - uRadius * uRadius);
        float shadow = (b < 0.0) ? smoothstep(-uRadius * 0.08, uRadius * 0.08, -h) : 1.0;
        shadow = mix(0.12, 1.0, shadow);
        gl_FragColor = vec4(c.rgb * uBright * shadow, c.a * uFade);
        #include <colorspace_fragment>
      }
    `,
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
}

export function RealSaturn({
  tex,
  radius,
  sun,
  worldPos,
  fade,
}: {
  tex: JourneyTextures;
  radius: number;
  sun: THREE.Vector3;
  worldPos: THREE.Vector3;
  fade: { value: number };
}) {
  const seg = env.lowPower ? 64 : 128;
  const res = useMemo(() => {
    const geo = new THREE.SphereGeometry(radius, seg, Math.round(seg * 0.66));
    const surface = new THREE.MeshStandardMaterial({ map: tex.saturn, roughness: 0.92, metalness: 0, transparent: true, opacity: 0 });
    const rim = makeAtmosphereRim('#f7e6bf', 0.28);
    const halo = makeAtmosphereHalo('#f7e6bf', 0.28);
    rim.uniforms.uSun.value.copy(sun);
    halo.uniforms.uSun.value.copy(sun);
    const ring = tex.saturnRing ? makeRingMaterial(tex.saturnRing, 2.1) : null;
    if (ring) {
      ring.uniforms.uSun.value.copy(sun);
      ring.uniforms.uPlanet.value.copy(worldPos);
      ring.uniforms.uRadius.value = radius;
    }
    const ringGeo = ringGeometry(radius * 1.24, radius * 2.3);
    const haloGeo = new THREE.SphereGeometry(radius, 48, 32);
    return { geo, surface, rim, halo, ring, ringGeo, haloGeo };
  }, [tex, radius, sun, worldPos, seg]);
  useDispose(res.geo, res.surface, res.rim, res.halo, res.ringGeo, res.haloGeo, ...(res.ring ? [res.ring] : []));

  const spin = useRef<THREE.Mesh>(null);
  useFrame((_, delta) => {
    if (spin.current) spin.current.rotation.y += Math.min(delta, 0.1) * 0.02;
    const f = fade.value;
    // fully opaque once it has faded in (so it sorts and shades like a solid planet)
    const solid = f >= 0.999;
    if (res.surface.transparent === solid) {
      res.surface.transparent = !solid;
      res.surface.needsUpdate = true;
    }
    res.surface.opacity = f;
    res.rim.uniforms.uIntensity.value = 0.28 * f;
    res.halo.uniforms.uIntensity.value = 0.28 * f;
    if (res.ring) res.ring.uniforms.uFade.value = f;
  });

  return (
    <group>
      <mesh ref={spin} geometry={res.geo} material={res.surface} />
      {res.ring && <mesh geometry={res.ringGeo} material={res.ring} rotation={[-Math.PI / 2, 0, 0]} renderOrder={4} />}
      <mesh geometry={res.geo} material={res.rim} scale={1.012} />
      <mesh geometry={res.haloGeo} material={res.halo} scale={1.16} />
    </group>
  );
}
