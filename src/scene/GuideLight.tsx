import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { env } from '../lib/env';
import { easeOutCubic, hex3, now } from '../lib/ease';
import { BASE_DEPTH, light } from '../light/lightSim';

// ---------- core + halo (billboard) ----------
const glowVert = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const glowFrag = /* glsl */ `
  uniform float uOpacity;
  uniform float uGlow;
  uniform vec3 uGold;
  uniform vec3 uCore;
  varying vec2 vUv;
  void main() {
    float r = length(vUv - 0.5) * 2.0;
    if (r > 1.0) discard;
    float core = exp(-r * r * 160.0);
    float inner = exp(-r * r * 30.0) * 0.55;
    float halo = exp(-r * r * 5.0) * (0.3 + 0.2 * uGlow);
    float fade = 1.0 - smoothstep(0.75, 1.0, r);
    vec3 col = mix(uGold, uCore, clamp(core * 1.4 + inner * 0.5, 0.0, 1.0));
    float a = (core * 1.3 + inner + halo) * fade * uOpacity;
    gl_FragColor = vec4(col, a);
  }
`;

// ---------- pulse of light on catch ----------
const pulseFrag = /* glsl */ `
  uniform float uP;
  uniform vec3 uGold;
  varying vec2 vUv;
  void main() {
    float r = length(vUv - 0.5) * 2.0;
    float R = 0.12 + 0.86 * uP;
    float w = 0.035 + 0.07 * uP;
    float pulse = exp(-pow((r - R) / w, 2.0));
    float fill = exp(-r * r * 6.0) * 0.25 * (1.0 - uP);
    float a = (pulse * 0.6 + fill) * pow(1.0 - uP, 1.6);
    gl_FragColor = vec4(uGold, a);
  }
`;

// ---------- trail + burst particles (one pool) ----------
const partVert = /* glsl */ `
  attribute vec3 aVel;
  attribute float aBirth;
  attribute float aLife;
  attribute float aSize;
  attribute float aGold;
  uniform float uTime;
  uniform float uPixelRatio;
  uniform vec3 uGold;
  uniform vec3 uLilac;
  varying float vA;
  varying vec3 vCol;
  void main() {
    float age = uTime - aBirth;
    float k = clamp(age / aLife, 0.0, 1.0);
    float alive = step(0.0, age) * step(age, aLife);
    vec3 p = position + aVel * (1.0 - exp(-3.0 * age)) / 3.0;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    float d = max(-mv.z, 0.1);
    gl_PointSize = alive * aSize * uPixelRatio * clamp(${BASE_DEPTH.toFixed(1)} / d, 0.15, 3.5) * (1.0 - 0.45 * k);
    vA = alive * (1.0 - k) * (1.0 - k);
    vCol = mix(uLilac, uGold, aGold);
  }
`;
const partFrag = /* glsl */ `
  varying float vA;
  varying vec3 vCol;
  void main() {
    float r = length(gl_PointCoord - 0.5) * 2.0;
    if (r > 1.0) discard;
    float a = (exp(-r * r * 5.0) * 0.9 + (1.0 - r) * 0.15) * vA;
    gl_FragColor = vec4(vCol, a);
  }
`;

const POOL = 420;
const GOLD = hex3('#f3d9a4');
const CORE = hex3('#fffaf0');
const LILAC = hex3('#dccbf6');

/** Desired on-screen diameter of the halo (CSS px) at the base depth. */
const HALO_PX = env.isMobile ? 120 : 140;

const _dir = new THREE.Vector3();
const _right = new THREE.Vector3();
const _up = new THREE.Vector3();
const _fwd = new THREE.Vector3();

export function GuideLight() {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;

  const res = useMemo(() => {
    const plane = new THREE.PlaneGeometry(1, 1);
    const glowMat = new THREE.ShaderMaterial({
      vertexShader: glowVert,
      fragmentShader: glowFrag,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uOpacity: { value: 0 },
        uGlow: { value: 0 },
        uGold: { value: new THREE.Vector3(...GOLD) },
        uCore: { value: new THREE.Vector3(...CORE) },
      },
    });
    const pulseMat = new THREE.ShaderMaterial({
      vertexShader: glowVert,
      fragmentShader: pulseFrag,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: THREE.AdditiveBlending,
      uniforms: { uP: { value: 1 }, uGold: { value: new THREE.Vector3(...GOLD) } },
    });

    const pos = new Float32Array(POOL * 3);
    const vel = new Float32Array(POOL * 3);
    const birth = new Float32Array(POOL).fill(-1000);
    const life = new Float32Array(POOL).fill(1);
    const size = new Float32Array(POOL);
    const gold = new Float32Array(POOL);
    const pgeo = new THREE.BufferGeometry();
    const attrs = {
      position: new THREE.BufferAttribute(pos, 3),
      aVel: new THREE.BufferAttribute(vel, 3),
      aBirth: new THREE.BufferAttribute(birth, 1),
      aLife: new THREE.BufferAttribute(life, 1),
      aSize: new THREE.BufferAttribute(size, 1),
      aGold: new THREE.BufferAttribute(gold, 1),
    };
    for (const [k, a] of Object.entries(attrs)) {
      a.setUsage(THREE.DynamicDrawUsage);
      pgeo.setAttribute(k, a);
    }
    const partMat = new THREE.ShaderMaterial({
      vertexShader: partVert,
      fragmentShader: partFrag,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uTime: { value: 0 },
        uPixelRatio: { value: 1 },
        uGold: { value: new THREE.Vector3(...GOLD) },
        uLilac: { value: new THREE.Vector3(...LILAC) },
      },
    });
    return { plane, glowMat, pulseMat, pgeo, partMat, pos, vel, birth, life, size, gold, attrs };
  }, []);

  useEffect(
    () => () => {
      res.plane.dispose();
      res.glowMat.dispose();
      res.pulseMat.dispose();
      res.pgeo.dispose();
      res.partMat.dispose();
    },
    [res],
  );

  const glowRef = useRef<THREE.Mesh>(null);
  const pulseRef = useRef<THREE.Mesh>(null);
  const st = useRef({
    cursor: 0,
    dirty: false,
    lastX: NaN,
    lastY: NaN,
    acc: 0,
    worldPos: new THREE.Vector3(),
    pxWorld: 0.01,
    pulseT0: -100,
    pulsePos: new THREE.Vector3(),
    pulsePx: 300,
    pending: [] as { type: string }[],
  });

  // queue sim events; handled inside the frame loop where the camera is current
  useEffect(() => light.on((e) => st.current.pending.push(e)), []);

  useFrame(({ size, viewport }) => {
    const s = st.current;
    const t = now();
    const glow = glowRef.current!;
    const pulse = pulseRef.current!;
    res.partMat.uniforms.uTime.value = t;
    res.partMat.uniforms.uPixelRatio.value = viewport.dpr;

    const visible = light.mode !== 'off' && light.opacity > 0.001;
    glow.visible = visible;

    // world size of one CSS pixel at the base depth
    const vh = 2 * BASE_DEPTH * Math.tan((camera.fov * Math.PI) / 360);
    s.pxWorld = vh / Math.max(1, size.height);

    // light position: project its screen position out to its depth
    _dir.set(light.ndcX, light.ndcY, 0.5).unproject(camera).sub(camera.position).normalize();
    s.worldPos.copy(camera.position).addScaledVector(_dir, light.depth);
    _right.set(1, 0, 0).applyQuaternion(camera.quaternion);
    _up.set(0, 1, 0).applyQuaternion(camera.quaternion);
    _fwd.set(0, 0, -1).applyQuaternion(camera.quaternion);

    // events
    while (s.pending.length) {
      const e = s.pending.shift()!;
      if (e.type === 'sparkle') burst(12, 30, 70, 0.9, 2.5, 5);
      else if (e.type === 'catch') {
        if (env.reducedMotion) burst(10, 10, 30, 1.6, 2, 4);
        else {
          burst(40, 60, 190, 1.7, 3, 7);
          s.pulseT0 = t;
          s.pulsePos.copy(s.worldPos);
          s.pulsePx = 0.62 * Math.min(size.width, size.height);
        }
      } else if (e.type === 'twinkle') burst(8, 6, 20, 0.7, 2, 4, light.depth / BASE_DEPTH);
    }

    if (visible) {
      const breath = 1 + 0.04 * (1 - Math.cos((t * Math.PI * 2) / 2.5)); // 1 → 1.08
      const pulse = light.waiting ? 1 + 0.09 * (1 - Math.cos(t * Math.PI * 2 * 0.9)) : 1;
      const k = HALO_PX * s.pxWorld * light.scale * breath * pulse * (1 + 0.35 * light.glow);
      glow.position.copy(s.worldPos);
      glow.quaternion.copy(camera.quaternion);
      glow.scale.setScalar(k);
      res.glowMat.uniforms.uOpacity.value = light.opacity;
      res.glowMat.uniforms.uGlow.value = light.glow;

      // trail: shed specks proportional to movement, plus a gentle trickle
      if (!Number.isNaN(s.lastX)) {
        const moved = Math.hypot(light.x - s.lastX, light.y - s.lastY);
        const rate = env.reducedMotion ? 0.4 : 1;
        s.acc += (moved / 7 + 0.05) * light.trailBoost * rate * light.opacity;
        let n = Math.min(6, Math.floor(s.acc));
        s.acc -= n;
        while (n-- > 0) emitTrail(t);
      }
      s.lastX = light.x;
      s.lastY = light.y;
    } else {
      s.lastX = s.lastY = NaN;
    }

    // pulse
    const rp = (t - s.pulseT0) / 1.4;
    pulse.visible = rp >= 0 && rp < 1;
    if (pulse.visible) {
      (res.pulseMat.uniforms.uP as { value: number }).value = easeOutCubic(rp);
      pulse.position.copy(s.pulsePos);
      pulse.quaternion.copy(camera.quaternion);
      pulse.scale.setScalar(s.pulsePx * s.pxWorld);
    }

    if (s.dirty) {
      for (const a of Object.values(res.attrs)) a.needsUpdate = true;
      s.dirty = false;
    }

    function slot() {
      const i = s.cursor;
      s.cursor = (s.cursor + 1) % POOL;
      s.dirty = true;
      return i;
    }

    function emitTrail(time: number) {
      const i = slot();
      const j = 10 * s.pxWorld * (light.depth / BASE_DEPTH);
      const p = s.worldPos;
      res.pos[i * 3] = p.x + (Math.random() - 0.5) * j;
      res.pos[i * 3 + 1] = p.y + (Math.random() - 0.5) * j;
      res.pos[i * 3 + 2] = p.z + (Math.random() - 0.5) * j;
      const sp = (6 + Math.random() * 16) * s.pxWorld;
      const a = Math.random() * Math.PI * 2;
      res.vel[i * 3] = (_right.x * Math.cos(a) + _up.x * Math.sin(a)) * sp;
      res.vel[i * 3 + 1] = (_right.y * Math.cos(a) + _up.y * Math.sin(a)) * sp - 4 * s.pxWorld;
      res.vel[i * 3 + 2] = (_right.z * Math.cos(a) + _up.z * Math.sin(a)) * sp;
      res.birth[i] = time;
      res.life[i] = (0.85 + Math.random() * 0.5) * (light.trailBoost > 1.2 ? 1.6 : 1);
      res.size[i] = 2.2 + Math.random() * 3 * (light.trailBoost > 1.2 ? 1.3 : 1);
      res.gold[i] = Math.random() < 0.62 ? 1 : 0;
    }

    function burst(n: number, minPx: number, maxPx: number, lifeS: number, minSize: number, maxSize: number, scale = 1) {
      for (let q = 0; q < n; q++) {
        const i = slot();
        const p = s.worldPos;
        res.pos[i * 3] = p.x;
        res.pos[i * 3 + 1] = p.y;
        res.pos[i * 3 + 2] = p.z;
        const a = (q / n) * Math.PI * 2 + Math.random() * 0.5;
        // travel distance = v / drag(3)
        const travel = (minPx + Math.random() * (maxPx - minPx)) * s.pxWorld * scale;
        const v = travel * 3;
        const z = (Math.random() - 0.5) * 0.4;
        res.vel[i * 3] = (_right.x * Math.cos(a) + _up.x * Math.sin(a) + _fwd.x * z) * v;
        res.vel[i * 3 + 1] = (_right.y * Math.cos(a) + _up.y * Math.sin(a) + _fwd.y * z) * v;
        res.vel[i * 3 + 2] = (_right.z * Math.cos(a) + _up.z * Math.sin(a) + _fwd.z * z) * v;
        res.birth[i] = t;
        res.life[i] = lifeS * (0.7 + Math.random() * 0.5);
        res.size[i] = minSize + Math.random() * (maxSize - minSize);
        res.gold[i] = Math.random() < 0.7 ? 1 : 0;
      }
    }
  });

  return (
    <group>
      <points geometry={res.pgeo} material={res.partMat} frustumCulled={false} renderOrder={5} />
      <mesh ref={pulseRef} geometry={res.plane} material={res.pulseMat} visible={false} frustumCulled={false} renderOrder={6} />
      <mesh ref={glowRef} geometry={res.plane} material={res.glowMat} visible={false} frustumCulled={false} renderOrder={7} />
    </group>
  );
}

