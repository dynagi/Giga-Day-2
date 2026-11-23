import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { env } from '../lib/env';
import { NOISE_GLSL } from './noise.glsl';
import { EARTH_R, SUN_DIR } from './space';
import { useJourneyTextures } from '../solar/textures';
import { RealEarth, sunFar } from '../solar/realBodies';

/**
 * A procedural Earth: oceans, continents, ice caps, drifting clouds, city lights on the
 * night side, and a blue atmosphere that glows at the limb, and that the camera can
 * rise up through at the start of the journey.
 */

const surfaceVert = /* glsl */ `
  varying vec3 vPos;
  varying vec3 vWorldN;
  varying vec3 vWorldPos;
  void main() {
    vPos = position;
    vWorldN = normalize(mat3(modelMatrix) * normal);
    vec4 w = modelMatrix * vec4(position, 1.0);
    vWorldPos = w.xyz;
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`;

const surfaceFrag = (oct: number) => /* glsl */ `
  uniform vec3 uSun;
  uniform vec3 uCam;
  varying vec3 vPos;
  varying vec3 vWorldN;
  varying vec3 vWorldPos;
  ${NOISE_GLSL}
  void main() {
    vec3 n = normalize(vPos);
    // continents from layered noise
    float c = fbm3(n * 2.2 + vec3(3.1, 0.7, 5.3), ${oct});
    float detail = fbm3(n * 9.0, 4);
    float land = smoothstep(0.5, 0.53, c + (detail - 0.5) * 0.08);
    float coast = smoothstep(0.47, 0.52, c) * (1.0 - land);
    float lat = abs(n.y);
    vec3 deep = vec3(0.02, 0.10, 0.25);
    vec3 shallow = vec3(0.05, 0.27, 0.45);
    vec3 ocean = mix(deep, shallow, coast * 0.8 + smoothstep(0.35, 0.5, c) * 0.3);
    vec3 green = vec3(0.18, 0.33, 0.16);
    vec3 dry = vec3(0.52, 0.45, 0.30);
    vec3 earth = mix(green, dry, smoothstep(0.45, 0.7, detail) * (1.0 - smoothstep(0.55, 0.85, lat)));
    earth = mix(earth, vec3(0.35, 0.38, 0.30), smoothstep(0.62, 0.72, c));
    vec3 col = mix(ocean, earth, land);
    // ice caps
    float ice = smoothstep(0.84, 0.9, lat + (detail - 0.5) * 0.12);
    col = mix(col, vec3(0.9, 0.93, 0.97), ice);

    vec3 N = normalize(vWorldN);
    float ndl = dot(N, uSun);
    float day = smoothstep(-0.08, 0.25, ndl);
    vec3 V = normalize(uCam - vWorldPos);
    // sun glint on the oceans
    vec3 H = normalize(uSun + V);
    float spec = pow(max(dot(N, H), 0.0), 140.0) * (1.0 - land) * (1.0 - ice) * day;
    vec3 lit = col * (0.05 + 1.05 * max(ndl, 0.0)) + vec3(1.0, 0.92, 0.8) * spec * 0.16;
    // city lights on the night side
    float cityN = vnoise(n * 90.0) * vnoise(n * 23.0 + 4.0);
    float city = smoothstep(0.42, 0.6, cityN) * land * (1.0 - ice) * (1.0 - smoothstep(-0.15, 0.05, ndl));
    lit += vec3(1.0, 0.78, 0.45) * city * 1.4;
    // thin blue haze toward the edge
    float rim = pow(1.0 - max(dot(N, V), 0.0), 3.0);
    lit = mix(lit, vec3(0.35, 0.6, 1.0) * (0.25 + day), rim * 0.55);
    gl_FragColor = vec4(lit, 1.0);
  }
`;

const cloudFrag = /* glsl */ `
  uniform vec3 uSun;
  uniform float uTime;
  varying vec3 vPos;
  varying vec3 vWorldN;
  ${NOISE_GLSL}
  void main() {
    vec3 n = normalize(vPos);
    float t = uTime * 0.004;
    vec3 q = n * 3.0 + vec3(t, 0.0, -t * 0.6);
    float c = fbm3(q + fbm3(q * 1.7, 3) * 0.8, 5);
    float a = smoothstep(0.54, 0.76, c) * 0.8;
    float ndl = dot(normalize(vWorldN), uSun);
    float light = smoothstep(-0.12, 0.3, ndl);
    gl_FragColor = vec4(vec3(1.0) * (0.06 + 0.95 * light), a * (0.25 + 0.75 * light));
  }
`;

const atmoVert = /* glsl */ `
  varying vec3 vWorldPos;
  varying vec3 vWorldN;
  void main() {
    vec4 w = modelMatrix * vec4(position, 1.0);
    vWorldPos = w.xyz;
    vWorldN = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`;
// Seen from outside: a glow at the limb. From inside (camera below its radius): a blue sky
// that fades to black as the camera climbs.
const atmoFrag = /* glsl */ `
  uniform vec3 uSun;
  uniform vec3 uCam;
  uniform float uR;
  uniform float uRa;
  uniform float uOutside;
  varying vec3 vWorldPos;
  varying vec3 vWorldN;
  void main() {
    vec3 dir = normalize(vWorldPos - uCam);
    float camR = length(uCam);
    vec3 N = normalize(vWorldN);
    float sunSide = smoothstep(-0.3, 0.6, dot(N, uSun));
    vec3 blue = vec3(0.32, 0.58, 1.0);
    if (camR < uRa) {
      vec3 up = normalize(uCam);
      float horizon = 1.0 - abs(dot(dir, up));
      float depth = clamp((uRa - camR) / (uRa - uR), 0.0, 1.0);
      float a = (0.25 + 0.6 * horizon) * depth * (0.3 + 0.7 * sunSide);
      vec3 col = mix(blue * 0.6, vec3(0.75, 0.85, 1.0), horizon * 0.5);
      gl_FragColor = vec4(col, a);
    } else {
      // 0 at the outer edge of the air, strongest right at the planet's limb
      float f = clamp(dot(N, dir), 0.0, 1.0);
      float limb = sqrt(max(0.0, 1.0 - (uR * uR) / (uRa * uRa)));
      float glow = pow(smoothstep(0.0, limb, f), 2.2) * (0.12 + 0.88 * sunSide);
      gl_FragColor = vec4(blue * 1.15, glow * 0.9 * uOutside);
    }
  }
`;

export function Earth() {
  const res = useMemo(() => {
    const segs = env.lowPower ? 96 : 160;
    const sphere = new THREE.SphereGeometry(EARTH_R, segs, segs / 2);
    const cloudSphere = new THREE.SphereGeometry(EARTH_R * 1.012, segs, segs / 2);
    const atmoSphere = new THREE.SphereGeometry(EARTH_R * 1.05, 96, 48);
    const sun = { value: SUN_DIR.clone() };
    const cam = { value: new THREE.Vector3() };
    const surface = new THREE.ShaderMaterial({
      vertexShader: surfaceVert,
      fragmentShader: surfaceFrag(env.lowPower ? 5 : 6),
      uniforms: { uSun: sun, uCam: cam },
    });
    const clouds = new THREE.ShaderMaterial({
      vertexShader: surfaceVert,
      fragmentShader: cloudFrag,
      uniforms: { uSun: sun, uTime: { value: 0 } },
      transparent: true,
      depthWrite: false,
    });
    const atmo = new THREE.ShaderMaterial({
      vertexShader: atmoVert,
      fragmentShader: atmoFrag,
      uniforms: { uSun: sun, uCam: cam, uR: { value: EARTH_R }, uRa: { value: EARTH_R * 1.05 }, uOutside: { value: 1 } },
      side: THREE.BackSide,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    return { sphere, cloudSphere, atmoSphere, surface, clouds, atmo, cam };
  }, []);

  useEffect(
    () => () => {
      for (const k of ['sphere', 'cloudSphere', 'atmoSphere', 'surface', 'clouds', 'atmo'] as const) res[k].dispose();
    },
    [res],
  );

  const tex = useJourneyTextures();
  const real = !!tex?.earthDay;
  const sun = useMemo(() => sunFar(SUN_DIR), []);
  const spin = useRef<THREE.Group>(null);
  useFrame(({ camera, clock }, delta) => {
    res.cam.value.copy(camera.position);
    // with the photo Earth, the kit's rim + halo do the outside glow; this shell only does the sky inside
    res.atmo.uniforms.uOutside.value = real ? 0 : 1;
    if (spin.current) spin.current.rotation.y += Math.min(delta, 0.1) * 0.012; // Earth turns, slowly
    res.clouds.uniforms.uTime.value = clock.elapsedTime;
  });

  return (
    <>
      {real && tex ? (
        <RealEarth tex={tex} radius={EARTH_R} sun={sun} />
      ) : (
        <group rotation={[0.41, 0, 0]}>
          <group ref={spin}>
            <mesh geometry={res.sphere} material={res.surface} />
            <mesh geometry={res.cloudSphere} material={res.clouds} renderOrder={2} />
          </group>
        </group>
      )}
      <mesh geometry={res.atmoSphere} material={res.atmo} renderOrder={3} />
    </>
  );
}
