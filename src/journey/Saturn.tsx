import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { env } from '../lib/env';
import { NOISE_GLSL } from './noise.glsl';
import { journeyClock } from './clock';
import { VT } from './voyageTimeline';
import { SUN_DIR } from './space';
import { SATURN_AXIS, SATURN_POS, SATURN_R } from './voyageLayout';
import { useJourneyTextures } from '../solar/textures';
import { RealSaturn, sunFar } from '../solar/realBodies';

/**
 * Saturn: soft golden bands, a six-sided storm at the north pole, the ring system with
 * its gaps, the rings' shadow across the planet and the planet's shadow across the rings.
 * Everything is in Saturn's own frame (spin axis = local +Y, rings in the local XZ plane).
 */

export const RING_IN = 1.24;
export const RING_OUT = 2.27;

const RING_DENSITY = /* glsl */ `
  // ring density by radius (in planet radii): bands, the Cassini Division, the Encke Gap
  float ringDensity(float r) {
    if (r < ${RING_IN.toFixed(3)} || r > ${RING_OUT.toFixed(3)}) return 0.0;
    float d = 0.72 + 0.12 * sin(r * 47.0) + 0.07 * sin(r * 131.0 + 1.3) + 0.05 * sin(r * 307.0);
    d *= smoothstep(1.24, 1.3, r);                         // faint inner C ring
    d *= mix(0.35, 1.0, smoothstep(1.50, 1.53, r));        // the bright B ring
    d *= 1.0 - 0.92 * (smoothstep(1.94, 1.955, r) - smoothstep(2.02, 2.035, r)); // Cassini Division
    d *= 1.0 - 0.85 * (smoothstep(2.205, 2.21, r) - smoothstep(2.222, 2.227, r)); // Encke Gap
    d *= 1.0 - smoothstep(2.2, 2.27, r) * 0.6;
    return clamp(d, 0.0, 1.0);
  }
`;

const planetVert = /* glsl */ `
  varying vec3 vN;
  varying vec3 vWorldN;
  varying vec3 vWorldPos;
  void main() {
    vN = normalize(position);
    vWorldN = normalize(mat3(modelMatrix) * normal);
    vec4 w = modelMatrix * vec4(position, 1.0);
    vWorldPos = w.xyz;
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`;
const planetFrag = /* glsl */ `
  uniform vec3 uSunLocal;
  uniform vec3 uSun;
  uniform vec3 uCam;
  uniform float uTime;
  uniform float uHex; // how visible the polar hexagon is
  uniform float uFade;
  varying vec3 vN;
  varying vec3 vWorldN;
  varying vec3 vWorldPos;
  ${NOISE_GLSL}
  ${RING_DENSITY}
  void main() {
    vec3 n = normalize(vN);
    float lat = n.y;
    float lon = atan(n.z, n.x);
    // soft turbulent bands
    float wobble = vnoise(vec3(lon * 2.0 + uTime * 0.01, lat * 8.0, 1.0)) - 0.5 + (vnoise(vec3(lon * 5.0, lat * 22.0, 2.0)) - 0.5) * 0.4;
    float b = lat * 9.0 + wobble * 0.6;
    float band = 0.5 + 0.5 * sin(b * 3.1) * 0.6 + 0.2 * sin(b * 7.3 + 1.0);
    vec3 cream = vec3(0.95, 0.88, 0.72);
    vec3 beige = vec3(0.85, 0.74, 0.55);
    vec3 gold = vec3(0.84, 0.69, 0.42);
    vec3 brown = vec3(0.64, 0.49, 0.33);
    vec3 col = mix(beige, cream, smoothstep(0.35, 0.75, band));
    col = mix(col, gold, smoothstep(0.55, 0.9, vnoise(vec3(lat * 14.0, lon * 0.5, 3.0))) * 0.5);
    col = mix(col, brown, smoothstep(0.62, 0.95, abs(lat)) * 0.45);
    // the north polar hexagon: a six-sided band around the pole, with a darker blue-grey centre
    float polar = acos(clamp(lat, -1.0, 1.0));
    float sector = mod(lon + 3.14159, 1.0472) - 0.5236;
    float hexR = 0.42 / cos(sector);
    float edge = exp(-pow((polar - hexR) / 0.025, 2.0));
    float inside = 1.0 - smoothstep(hexR - 0.02, hexR + 0.02, polar);
    float north = step(0.0, lat);
    col = mix(col, vec3(0.55, 0.6, 0.66), inside * north * 0.55 * uHex + inside * north * 0.25);
    col = mix(col, vec3(0.98, 0.93, 0.82), edge * north * (0.35 + 0.5 * uHex));
    float eye = exp(-polar * polar * 90.0) * north;
    col = mix(col, vec3(0.32, 0.36, 0.44), eye * 0.7);

    // light, with a soft terminator and a little limb darkening
    vec3 N = normalize(vWorldN);
    float ndl = dot(N, uSun);
    float light = smoothstep(-0.05, 0.35, ndl) * (0.25 + 0.75 * max(ndl, 0.0)) + 0.02;
    vec3 V = normalize(uCam - vWorldPos);
    float limb = pow(max(dot(N, V), 0.0), 0.35);
    // the rings' shadow on the planet
    float shadow = 0.0;
    if (abs(uSunLocal.y) > 0.001) {
      float t = -n.y / uSunLocal.y;
      if (t > 0.0) {
        vec3 hit = n + uSunLocal * t;
        shadow = ringDensity(length(hit.xz)) * 0.8;
      }
    }
    vec3 lit = col * light * limb * (1.0 - shadow);
    // a faint warm haze at the edge
    float rim = pow(1.0 - max(dot(N, V), 0.0), 3.0) * smoothstep(-0.2, 0.5, ndl);
    lit += vec3(0.95, 0.82, 0.6) * rim * 0.18;
    gl_FragColor = vec4(lit * uFade, 1.0);
  }
`;

const ringVert = /* glsl */ `
  varying vec3 vLocal;
  varying vec3 vWorldPos;
  void main() {
    vLocal = position;
    vec4 w = modelMatrix * vec4(position, 1.0);
    vWorldPos = w.xyz;
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`;
const ringFrag = /* glsl */ `
  uniform vec3 uSunLocal;
  uniform float uR;
  uniform float uFade;
  varying vec3 vLocal;
  varying vec3 vWorldPos;
  ${RING_DENSITY}
  void main() {
    vec3 p = vLocal / uR;          // in planet radii, ring plane = local XZ
    float r = length(p.xz);
    float d = ringDensity(r);
    if (d < 0.01) discard;
    float grain = fract(sin(dot(floor(p.xz * 400.0), vec2(12.9898, 78.233))) * 43758.5453);
    vec3 col = mix(vec3(0.74, 0.64, 0.5), vec3(0.97, 0.91, 0.8), smoothstep(0.35, 0.95, d));
    col *= 0.94 + grain * 0.08;
    // the planet's shadow across the rings
    float b = dot(p, uSunLocal);
    vec3 closest = p - uSunLocal * b;
    float inShadow = (b < 0.0 && length(closest) < 1.0) ? 1.0 : 0.0;
    float lit = 0.25 + 0.85 * abs(uSunLocal.y) * 3.0;
    lit = clamp(lit, 0.35, 1.0) * (1.0 - inShadow * 0.88);
    gl_FragColor = vec4(col * lit, d * 0.92 * uFade);
  }
`;

export function Saturn({ hex = 0, always = false }: { hex?: number; always?: boolean }) {
  const group = useRef<THREE.Group>(null);
  const tex = useJourneyTextures();
  const real = !!tex?.saturn;
  const sun = useMemo(() => sunFar(SUN_DIR), []);
  const fadeU = useMemo(() => ({ value: 0 }), []);
  const res = useMemo(() => {
    const segs = env.lowPower ? 96 : 160;
    const planet = new THREE.SphereGeometry(SATURN_R, segs, segs / 2);
    // flatten a touch at the poles, like the real thing
    planet.scale(1, 0.92, 1);
    const ring = new THREE.RingGeometry(SATURN_R * RING_IN, SATURN_R * RING_OUT, 360, 1);
    ring.rotateX(-Math.PI / 2);
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), SATURN_AXIS);
    const sunLocal = SUN_DIR.clone().applyQuaternion(q.clone().invert()).normalize();
    const cam = { value: new THREE.Vector3() };
    const planetMat = new THREE.ShaderMaterial({
      vertexShader: planetVert,
      fragmentShader: planetFrag,
      uniforms: {
        uSunLocal: { value: sunLocal },
        uSun: { value: SUN_DIR.clone() },
        uCam: cam,
        uTime: { value: 0 },
        uHex: { value: 0 },
        uFade: { value: 0 },
      },
    });
    const ringMat = new THREE.ShaderMaterial({
      vertexShader: ringVert,
      fragmentShader: ringFrag,
      uniforms: { uSunLocal: { value: sunLocal }, uR: { value: SATURN_R }, uFade: { value: 0 } },
      side: THREE.DoubleSide,
      transparent: true,
      depthWrite: false,
    });
    return { planet, ring, planetMat, ringMat, q, cam };
  }, []);

  useEffect(
    () => () => {
      res.planet.dispose();
      res.ring.dispose();
      res.planetMat.dispose();
      res.ringMat.dispose();
    },
    [res],
  );

  useFrame(({ camera, clock }) => {
    res.cam.value.copy(camera.position);
    res.planetMat.uniforms.uTime.value = clock.elapsedTime;
    const u = res.planetMat.uniforms.uHex;
    u.value += (hex - u.value) * 0.03;
    // hidden until late in the voyage, then a faint point that slowly becomes Saturn
    const f = journeyClock.voyage > 0.5 || always ? Math.min(1, Math.max(0, (journeyClock.t - (VT.saturnSeen - 3)) / 6)) : 0;
    const fade = always ? 1 : f;
    res.planetMat.uniforms.uFade.value = fade;
    res.ringMat.uniforms.uFade.value = fade;
    fadeU.value = fade;
    group.current && (group.current.visible = fade > 0.001);
  });

  return (
    <group ref={group} position={SATURN_POS} quaternion={res.q} visible={false}>
      {real && tex ? (
        <RealSaturn tex={tex} radius={SATURN_R} sun={sun} worldPos={SATURN_POS} fade={fadeU} />
      ) : (
        <>
          <mesh geometry={res.planet} material={res.planetMat} />
          <mesh geometry={res.ring} material={res.ringMat} renderOrder={4} />
        </>
      )}
    </group>
  );
}
