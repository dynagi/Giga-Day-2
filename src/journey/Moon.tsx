import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { env } from '../lib/env';
import { now } from '../lib/ease';
import { NOISE_GLSL } from './noise.glsl';
import { journeyInput, MOON_POS, MOON_R, SUN_DIR } from './space';
import { useJourneyTextures } from '../solar/textures';
import { RealMoon } from '../solar/realBodies';

/** A procedural Moon: dark maria, craters of many sizes, crisp light and shadow, and a shy blush when tapped. */

const vert = /* glsl */ `
  varying vec3 vPos;
  varying vec3 vWorldPos;
  varying vec3 vWorldN;
  void main() {
    vPos = position;
    vec4 w = modelMatrix * vec4(position, 1.0);
    vWorldPos = w.xyz;
    vWorldN = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`;

const frag = /* glsl */ `
  uniform vec3 uSun;
  uniform vec3 uCam;
  uniform float uBlush;
  varying vec3 vPos;
  varying vec3 vWorldPos;
  varying vec3 vWorldN;
  ${NOISE_GLSL}
  float crater(vec3 p) {
    vec2 c = cell3(p);
    float r = 0.18 + 0.22 * c.y;
    float d = c.x / r;
    float bowl = (1.0 - smoothstep(0.0, 1.0, d)) * -0.6;
    float rim = exp(-pow((d - 1.0) * 5.0, 2.0)) * 0.35;
    return (bowl + rim) * step(0.35, c.y);
  }
  float height(vec3 n) {
    float h = (fbm3(n * 2.4, 4) - 0.5) * 0.6;
    h += crater(n * 4.0) * 0.9 + crater(n * 9.0) * 0.45 + crater(n * 20.0) * 0.2;
    return h;
  }
  void main() {
    vec3 n = normalize(vPos);
    float h = height(n);
    float maria = smoothstep(0.5, 0.62, fbm3(n * 1.6 + 7.0, 4));
    vec3 col = mix(vec3(0.78, 0.77, 0.80), vec3(0.42, 0.41, 0.46), maria);
    col *= 0.9 + h * 0.35;
    // bump: perturb the normal with the screen-space slope of the height
    vec3 N = normalize(vWorldN);
    vec3 dpx = dFdx(vWorldPos);
    vec3 dpy = dFdy(vWorldPos);
    float dhx = dFdx(h);
    float dhy = dFdy(h);
    vec3 r1 = cross(dpy, N);
    vec3 r2 = cross(N, dpx);
    float det = dot(dpx, r1);
    vec3 grad = sign(det) * (dhx * r1 + dhy * r2);
    vec3 Nb = normalize(abs(det) * N - grad * 0.06);
    float ndl = max(dot(Nb, uSun), 0.0);
    vec3 lit = col * (0.015 + 1.15 * ndl);
    // a soft moonlight rim, and a pink blush when she taps it
    vec3 V = normalize(uCam - vWorldPos);
    float rim = pow(1.0 - max(dot(N, V), 0.0), 2.5);
    lit += vec3(0.85, 0.82, 1.0) * rim * 0.12 * smoothstep(-0.2, 0.4, dot(N, uSun));
    lit = mix(lit, lit * vec3(1.25, 0.82, 0.95) + vec3(0.32, 0.08, 0.16) * (0.4 + rim), uBlush * 0.75);
    gl_FragColor = vec4(lit, 1.0);
  }
`;

const glowFrag = /* glsl */ `
  uniform float uBlush;
  varying vec3 vWorldPos;
  varying vec3 vWorldN;
  uniform vec3 uCam;
  void main() {
    vec3 N = normalize(vWorldN);
    vec3 dir = normalize(vWorldPos - uCam);
    // fades to nothing at the outer edge, strongest at the Moon's own edge
    float f = clamp(dot(N, dir), 0.0, 1.0);
    float glow = pow(smoothstep(0.0, 0.47, f), 3.0);
    vec3 col = mix(vec3(0.85, 0.82, 1.0), vec3(1.0, 0.55, 0.75), uBlush);
    gl_FragColor = vec4(col, glow * (0.12 + 0.6 * uBlush));
  }
`;

export function Moon() {
  const tex = useJourneyTextures();
  const res = useMemo(() => {
    const geo = new THREE.SphereGeometry(MOON_R, env.lowPower ? 96 : 144, env.lowPower ? 48 : 72);
    const glowGeo = new THREE.SphereGeometry(MOON_R * 1.12, 64, 32);
    const cam = { value: new THREE.Vector3() };
    const blush = { value: 0 };
    const mat = new THREE.ShaderMaterial({
      vertexShader: vert,
      fragmentShader: frag,
      uniforms: { uSun: { value: SUN_DIR.clone() }, uCam: cam, uBlush: blush },
    });
    const glow = new THREE.ShaderMaterial({
      vertexShader: vert,
      fragmentShader: glowFrag,
      uniforms: { uCam: cam, uBlush: blush },
      side: THREE.BackSide,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    return { geo, glowGeo, mat, glow, cam, blush };
  }, []);

  useEffect(
    () => () => {
      res.geo.dispose();
      res.glowGeo.dispose();
      res.mat.dispose();
      res.glow.dispose();
    },
    [res],
  );

  useFrame(({ camera }) => {
    res.cam.value.copy(camera.position);
    // the blush rises quickly, then fades over a few seconds
    const since = now() - journeyInput.blushAt;
    res.blush.value = since < 0 ? 0 : Math.min(1, since / 0.35) * Math.exp(-Math.max(0, since - 0.6) / 2.2);
  });

  return (
    <group position={MOON_POS}>
      {tex?.moon ? <RealMoon tex={tex} radius={MOON_R} blush={res.blush} /> : <mesh geometry={res.geo} material={res.mat} rotation={[0.2, 2.2, 0]} />}
      <mesh geometry={res.glowGeo} material={res.glow} />
    </group>
  );
}
