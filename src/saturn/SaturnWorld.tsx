import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { damp } from '../lib/ease';
import { env } from '../lib/env';
import { SUN_DIR } from '../journey/space';
import { makeAtmosphereHalo, makeAtmosphereRim } from '../solar/shaders';
import { sunFar } from '../solar/realBodies';
import { PART_ORDER, saturnDir, type Part } from './saturnScript';
import { A, ENCELADUS_AT, ENCELADUS_R, R, S, U0, W0, lightPos, polar } from './saturnSpace';

/**
 * Everything that happens around Saturn while it talks: icy pieces in the rings, paper shapes
 * made of light, its glow warming as "Shani" looks at her, a "hmm" drifting by, moons and their
 * orbits, gravity pulling things into orbit, and at the end the little light becoming Enceladus.
 */

const partIdx = (p: Part) => PART_ORDER.indexOf(p);
const at = (p: Part) => partIdx(saturnDir.part) === partIdx(p);
const after = (p: Part) => partIdx(saturnDir.part) >= partIdx(p);
const LOW = env.lowPower;

/** Ring-frame basis (x → U0, y → A, z → −W0) as a quaternion, for things that live in the ring plane. */
const RING_Q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(U0, A, W0.clone().negate()));

function canvasTex(S: number, draw: (g: CanvasRenderingContext2D) => void) {
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d')!;
  draw(g);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function seeded(seed: number) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
}

/* ------------------------------------------------------------------ Saturn's glow */

function Glow() {
  const res = useMemo(() => {
    const map = canvasTex(256, (g) => {
      const gr = g.createRadialGradient(128, 128, 0, 128, 128, 128);
      gr.addColorStop(0, 'rgba(255,255,255,0.9)');
      gr.addColorStop(0.35, 'rgba(255,255,255,0.35)');
      gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr;
      g.fillRect(0, 0, 256, 256);
    });
    const mat = new THREE.SpriteMaterial({ map, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.25 });
    return { map, mat };
  }, []);
  useEffect(() => () => (res.map.dispose(), res.mat.dispose()), [res]);
  const lav = useMemo(() => new THREE.Color('#a58cff'), []);
  const amber = useMemo(() => new THREE.Color('#ffae55'), []);
  const purple = useMemo(() => new THREE.Color('#9b6bff'), []);
  const st = useRef({ warm: 0, bright: 0 });
  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.1);
    const d = saturnDir;
    // Shani looks at her: warmer; the soft line brings the balance back
    const warm = d.part === 'shani' ? (d.kind === 'soft' || d.kind === 'pause' ? 0.35 : d.kind === 'title' ? 0.2 : 1) : 0;
    // the final question: the purple glow brightens
    const bright = (d.part === 'final' && d.line >= 6) || d.part === 'secret' || d.part === 'complete' ? 1 : 0;
    st.current.warm += (warm - st.current.warm) * damp(0.9, dt);
    st.current.bright += (bright - st.current.bright) * damp(0.7, dt);
    res.mat.color.copy(lav).lerp(amber, st.current.warm).lerp(purple, st.current.bright * 0.8);
    res.mat.opacity = 0.2 + 0.4 * st.current.warm + 0.26 * st.current.bright;
  });
  return <sprite material={res.mat} position={S} scale={[R * 5.6, R * 5.6, 1]} renderOrder={2} />;
}

/* ------------------------------------------------------------------ the hexagon at the north pole */

function HexCap() {
  const res = useMemo(() => {
    const geo = new THREE.SphereGeometry(R * 1.004, 96, 24, 0, Math.PI * 2, 0, 0.42);
    const mat = new THREE.ShaderMaterial({
      uniforms: { uAlpha: { value: 0.45 } },
      vertexShader: /* glsl */ `
        varying vec3 vN;
        void main() {
          vN = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uAlpha;
        varying vec3 vN;
        void main() {
          float th = acos(clamp(vN.y, -1.0, 1.0));
          float ph = atan(vN.z, vN.x);
          float sector = mod(ph + 0.5236, 1.0472) - 0.5236;
          float hexR = 0.2 / cos(sector);
          float line = 1.0 - smoothstep(0.0, 0.014, abs(th - hexR));
          float inside = (1.0 - smoothstep(hexR - 0.01, hexR, th)) * 0.12;
          vec3 col = mix(vec3(0.55, 0.62, 0.72), vec3(0.98, 0.9, 0.72), line);
          gl_FragColor = vec4(col, (line * 0.9 + inside) * uAlpha);
        }
      `,
      transparent: true,
      depthWrite: false,
    });
    return { geo, mat };
  }, []);
  useEffect(() => () => (res.geo.dispose(), res.mat.dispose()), [res]);
  const q = useMemo(() => new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), A), []);
  useFrame(() => {
    res.mat.uniforms.uAlpha.value += ((saturnHot.open === 'hexagon' ? 1 : 0.4) - res.mat.uniforms.uAlpha.value) * 0.05;
  });
  return <mesh geometry={res.geo} material={res.mat} position={S} quaternion={q} renderOrder={3} />;
}

/* ------------------------------------------------------------------ chapter 1: icy pieces in the rings, paper shapes of light */

function RingDebris() {
  const res = useMemo(() => {
    const r = seeded(17);
    const N = LOW ? 700 : 1500;
    const pos = new Float32Array(N * 3);
    const size = new Float32Array(N);
    const shade = new Float32Array(N);
    const v = new THREE.Vector3();
    for (let i = 0; i < N; i++) {
      let rad = 1.88 + r() * 0.42;
      // keep the Cassini Division clear
      if (rad > 1.95 && rad < 2.03) rad = r() < 0.5 ? 1.94 - r() * 0.05 : 2.04 + r() * 0.05;
      const th = -1.0 - r() * 0.85;
      const h = (r() + r() + r() - 1.5) * 0.007;
      polar(th, rad, h, v);
      pos.set([v.x, v.y, v.z], i * 3);
      size[i] = 0.05 + Math.pow(r(), 3) * 0.22;
      shade[i] = 0.7 + r() * 0.3;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
    geo.setAttribute('aShade', new THREE.BufferAttribute(shade, 1));
    const mat = new THREE.ShaderMaterial({
      uniforms: { uScale: { value: 600 }, uOpacity: { value: 0 } },
      vertexShader: /* glsl */ `
        attribute float aSize;
        attribute float aShade;
        uniform float uScale;
        varying float vShade;
        void main() {
          vShade = aShade;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = clamp(uScale * aSize / max(-mv.z, 0.1), 1.0, 14.0);
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uOpacity;
        varying float vShade;
        void main() {
          vec2 c = gl_PointCoord - 0.5;
          float r = length(c) * 2.0;
          if (r > 1.0) discard;
          // a little sunlit side on each piece of ice
          float lit = 0.75 + 0.25 * (c.x * -0.8 + c.y * -0.6) * 2.0;
          gl_FragColor = vec4(vec3(0.92, 0.9, 0.86) * vShade * lit, (1.0 - smoothstep(0.6, 1.0, r)) * uOpacity);
        }
      `,
      transparent: true,
      depthWrite: false,
    });
    // bigger chunks of ice and rock, near the glide
    const rocksN = LOW ? 24 : 48;
    const rockGeo = new THREE.IcosahedronGeometry(1, 1);
    const p = rockGeo.getAttribute('position');
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i).multiplyScalar(0.75 + r() * 0.45);
      p.setXYZ(i, v.x, v.y, v.z);
    }
    rockGeo.computeVertexNormals();
    const rockMat = new THREE.MeshStandardMaterial({ color: '#d9d3ca', roughness: 0.95, transparent: true, opacity: 0 });
    const rocks = new THREE.InstancedMesh(rockGeo, rockMat, rocksN);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    for (let i = 0; i < rocksN; i++) {
      let rad = 2.04 + r() * 0.22;
      if (Math.abs(rad - 2.16) < 0.05) rad = rad < 2.16 ? rad - 0.05 : rad + 0.05; // never right in the camera's way
      polar(-1.06 - r() * 0.5, rad, (r() - 0.5) * 0.02, v);
      q.setFromEuler(new THREE.Euler(r() * 6, r() * 6, r() * 6));
      const s = 0.12 + Math.pow(r(), 2) * 0.5;
      m.compose(v, q, new THREE.Vector3(s, s * (0.7 + r() * 0.5), s));
      rocks.setMatrixAt(i, m);
    }
    rocks.frustumCulled = false;
    return { geo, mat, rockGeo, rockMat, rocks };
  }, []);
  useEffect(() => () => { res.geo.dispose(); res.mat.dispose(); res.rockGeo.dispose(); res.rockMat.dispose(); res.rocks.dispose(); }, [res]);
  const vis = useRef(0);
  const grp = useRef<THREE.Group>(null);
  useFrame(({ size, camera, gl }, delta) => {
    const want = at('rings') && saturnDir.partT > 3 ? 1 : 0;
    vis.current += (want - vis.current) * damp(0.8, Math.min(delta, 0.1));
    if (grp.current) grp.current.visible = vis.current > 0.01;
    res.mat.uniforms.uOpacity.value = vis.current;
    res.rockMat.opacity = vis.current;
    const cam = camera as THREE.PerspectiveCamera;
    res.mat.uniforms.uScale.value = (size.height * gl.getPixelRatio()) / 2 / Math.tan((cam.fov * Math.PI) / 360);
  });
  return (
    <group ref={grp} visible={false}>
      <points geometry={res.geo} material={res.mat} frustumCulled={false} renderOrder={6} />
      <primitive object={res.rocks} />
    </group>
  );
}

function paperTexture(kind: number) {
  return canvasTex(256, (g) => {
    g.strokeStyle = 'rgba(236,226,255,0.95)';
    g.fillStyle = 'rgba(200,180,255,0.10)';
    g.lineWidth = 4;
    g.shadowColor = 'rgba(190,160,255,0.95)';
    g.shadowBlur = 16;
    const line = (x1: number, y1: number, x2: number, y2: number) => {
      g.beginPath();
      g.moveTo(x1, y1);
      g.lineTo(x2, y2);
      g.stroke();
    };
    if (kind === 0) {
      // a sheet of notes, its corner folded
      g.beginPath();
      g.moveTo(64, 30);
      g.lineTo(170, 30);
      g.lineTo(196, 56);
      g.lineTo(196, 226);
      g.lineTo(64, 226);
      g.closePath();
      g.fill();
      g.stroke();
      line(170, 30, 170, 56);
      line(170, 56, 196, 56);
      for (let i = 0; i < 6; i++) line(84, 80 + i * 22, i === 5 ? 140 : 176, 80 + i * 22);
    } else if (kind === 1) {
      // a slide with a little chart
      g.beginPath();
      g.rect(28, 58, 200, 140);
      g.fill();
      g.stroke();
      line(48, 82, 150, 82);
      [40, 70, 55, 95].forEach((h, i) => {
        g.beginPath();
        g.rect(60 + i * 36, 178 - h, 22, h);
        g.stroke();
      });
    } else {
      // a little circuit board
      g.beginPath();
      g.rect(40, 40, 176, 176);
      g.fill();
      g.stroke();
      g.beginPath();
      g.rect(102, 102, 52, 52);
      g.stroke();
      for (let i = 0; i < 4; i++) {
        line(110 + i * 12, 102, 110 + i * 12, 70);
        line(110 + i * 12, 154, 110 + i * 12, 186);
      }
      line(102, 128, 60, 128);
      line(154, 128, 196, 128);
      for (const [x, y] of [[60, 128], [196, 128], [110, 70], [146, 186]]) {
        g.beginPath();
        g.arc(x, y, 6, 0, Math.PI * 2);
        g.stroke();
      }
    }
  });
}

function LightPapers() {
  const res = useMemo(() => {
    const maps = [0, 1, 2].map(paperTexture);
    const r = seeded(5);
    const items = Array.from({ length: 12 }, (_, i) => {
      const mat = new THREE.SpriteMaterial({ map: maps[i % 3], transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 });
      return { mat, th: -1.1 - i * 0.045 - r() * 0.02, rad: 2.04 + (i % 3) * 0.08 + r() * 0.04, h: 0.03 + ((i * 7) % 5) * 0.035 + r() * 0.02, size: 1.3 + r() * 0.9, spin: (r() - 0.5) * 0.4, ph: r() * 6 };
    });
    return { maps, items };
  }, []);
  useEffect(() => () => (res.maps.forEach((m) => m.dispose()), res.items.forEach((i) => i.mat.dispose())), [res]);
  const refs = useRef<(THREE.Sprite | null)[]>([]);
  const v = useMemo(() => new THREE.Vector3(), []);
  useFrame(({ clock }, delta) => {
    const dt = Math.min(delta, 0.1);
    const d = saturnDir;
    // they build up as the roast goes on, and thin out in the quiet of the gap
    let count = 0;
    if (at('rings')) {
      if (d.kind === 'line' && d.line >= 1) count = [0, 3, 6, 9, 12][Math.min(4, d.line)];
      else if (d.kind === 'soft' || (d.kind === 'pause' && d.beatT < 2 && d.partT > 20)) count = 3;
    }
    const time = clock.elapsedTime;
    res.items.forEach((it, i) => {
      const sp = refs.current[i];
      if (!sp) return;
      const want = i < count ? 0.34 : 0;
      it.mat.opacity += (want - it.mat.opacity) * damp(1.2, dt);
      sp.visible = it.mat.opacity > 0.005;
      if (!sp.visible) return;
      // drifting along in orbit with the ring, bobbing, turning slowly
      polar(it.th - time * 0.0016, it.rad, it.h + Math.sin(time * 0.6 + it.ph) * 0.008, v);
      sp.position.copy(v);
      it.mat.rotation = Math.sin(time * 0.3 + it.ph) * 0.4 + time * it.spin * 0.1;
      sp.scale.set(it.size, it.size, 1);
    });
  });
  return (
    <>
      {res.items.map((it, i) => (
        <sprite key={i} ref={(el) => (refs.current[i] = el)} material={it.mat} visible={false} renderOrder={9} />
      ))}
    </>
  );
}

/* ------------------------------------------------------------------ chapter 2: a "hmm" made of light */

function HmmGlyph() {
  const res = useMemo(() => {
    const map = canvasTex(512, (g) => {
      g.font = '600 150px "Dancing Script", "Segoe Script", cursive';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.shadowColor = 'rgba(200,170,255,1)';
      g.shadowBlur = 30;
      g.fillStyle = 'rgba(246,238,255,0.95)';
      g.fillText('hmm', 256, 256);
      g.shadowBlur = 60;
      g.fillStyle = 'rgba(214,190,255,0.5)';
      g.fillText('hmm', 256, 256);
    });
    const mat = new THREE.SpriteMaterial({ map, transparent: true, depthTest: false, depthWrite: false, opacity: 0 });
    return { map, mat };
  }, []);
  useEffect(() => () => (res.map.dispose(), res.mat.dispose()), [res]);
  const sp = useRef<THREE.Sprite>(null);
  const v = useMemo(() => new THREE.Vector3(), []);
  useFrame(({ camera, size }, delta) => {
    const s = sp.current;
    if (!s) return;
    const d = saturnDir;
    const on = at('shani') && d.kind === 'line' && (d.line === 5 || d.line === 6);
    res.mat.opacity += ((on ? 0.95 : 0) - res.mat.opacity) * damp(1.4, Math.min(delta, 0.1));
    s.visible = res.mat.opacity > 0.005;
    if (!s.visible) return;
    // it drifts slowly across the upper part of the view
    const k = d.line === 5 ? d.beatT / 7 : 0.45 + d.beatT / 9;
    const cam = camera as THREE.PerspectiveCamera;
    const z = 8;
    const halfH = z * Math.tan((cam.fov * Math.PI) / 360);
    const halfW = halfH * (size.width / Math.max(1, size.height));
    v.set((-0.55 + Math.min(1.1, k * 1.1)) * halfW, halfH * 0.42 + Math.sin(d.t * 1.1) * 0.08, -z).applyQuaternion(camera.quaternion).add(camera.position);
    s.position.copy(v);
    const w = Math.min(halfW * 0.7, 2.6);
    s.scale.set(w, w, 1);
  });
  return <sprite ref={sp} material={res.mat} visible={false} renderOrder={50} />;
}

/* ------------------------------------------------------------------ chapter 3: moons, and their orbits */

interface MoonDef {
  id: string;
  dist: number;
  size: number;
  speed: number;
  incl: number;
  phase: number;
  /** which line of chapter 3 brings it in */
  from: number;
  tint: string;
  two?: boolean;
}

const MOONS: MoonDef[] = [
  { id: 'titan', dist: 6.2, size: 0.21, speed: 0.05, incl: 0.006, phase: -0.6, from: 0, tint: '#e3a65a' },
  { id: 'rhea', dist: 4.5, size: 0.08, speed: 0.085, incl: 0.01, phase: 0.9, from: 0, tint: '#d9d6d2' },
  { id: 'iapetus', dist: 8.7, size: 0.075, speed: 0.032, incl: 0.14, phase: 2.2, from: 1, tint: '#cfc6b8', two: true },
  { id: 'dione', dist: 3.75, size: 0.065, speed: 0.11, incl: 0.01, phase: -2.0, from: 2, tint: '#e2e0dc' },
  { id: 'tethys', dist: 3.25, size: 0.062, speed: 0.13, incl: 0.02, phase: 3.0, from: 3, tint: '#efece8' },
  { id: 'mimas', dist: 2.75, size: 0.042, speed: 0.17, incl: 0.03, phase: 1.4, from: 4, tint: '#d6d2cc' },
  { id: 'hyperion', dist: 7.4, size: 0.036, speed: 0.045, incl: 0.01, phase: -1.4, from: 5, tint: '#c7b8a4' },
];

/** Where Titan is right now (for its hotspot). */
export const titanAt = new THREE.Vector3();

function moonTexture(two: boolean, seed: number) {
  return canvasTex(256, (g) => {
    const r = seeded(seed);
    g.fillStyle = '#bdbab6';
    g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 260; i++) {
      const x = r() * 256;
      const y = r() * 256;
      const rad = 2 + Math.pow(r(), 3) * 16;
      g.fillStyle = `rgba(${r() < 0.5 ? '70,66,62' : '235,232,228'},${0.12 + r() * 0.2})`;
      g.beginPath();
      g.arc(x, y, rad, 0, Math.PI * 2);
      g.fill();
    }
    if (two) {
      // Iapetus: one side dark, one side bright
      g.fillStyle = 'rgba(40,30,22,0.75)';
      g.fillRect(0, 0, 128, 256);
    }
  });
}

function titanTexture() {
  return canvasTex(256, (g) => {
    const gr = g.createLinearGradient(0, 0, 0, 256);
    gr.addColorStop(0, '#c7883e');
    gr.addColorStop(0.5, '#e8b26a');
    gr.addColorStop(1, '#b97a35');
    g.fillStyle = gr;
    g.fillRect(0, 0, 256, 256);
    const r = seeded(207);
    for (let i = 0; i < 40; i++) {
      g.fillStyle = `rgba(${r() < 0.5 ? '170,110,50' : '245,200,140'},0.12)`;
      g.fillRect(0, r() * 256, 256, 2 + r() * 10);
    }
  });
}

function Moons() {
  const sun = useMemo(() => sunFar(SUN_DIR), []);
  const res = useMemo(() => {
    const sphere = new THREE.SphereGeometry(1, 40, 28);
    const items = MOONS.map((m, i) => {
      const map = m.id === 'titan' ? titanTexture() : moonTexture(!!m.two, 31 + i * 7);
      const mat = new THREE.MeshStandardMaterial({ map, color: m.id === 'titan' ? '#ffffff' : m.tint, roughness: 0.95, transparent: true, opacity: 0 });
      // the orbit, drawn as a faint line
      const pts: number[] = [];
      for (let k = 0; k <= 160; k++) {
        const a = (k / 160) * Math.PI * 2;
        pts.push(Math.cos(a) * m.dist * R, 0, Math.sin(a) * m.dist * R);
      }
      const lg = new THREE.BufferGeometry();
      lg.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
      const lm = new THREE.LineBasicMaterial({ color: '#c9b6ff', transparent: true, opacity: 0, depthWrite: false });
      return { m, map, mat, lg, lm };
    });
    // Titan wears a thick orange haze
    const rim = makeAtmosphereRim('#f0b060', 1.1);
    const halo = makeAtmosphereHalo('#f0b060', 1.1);
    rim.uniforms.uSun.value.copy(sun);
    halo.uniforms.uSun.value.copy(sun);
    // tiny moonlets, up to 20
    const N = 20;
    const r = seeded(77);
    const lets = Array.from({ length: N }, () => ({ dist: 2.6 + r() * 7, speed: 0.05 + r() * 0.12, phase: r() * 6.28, incl: (r() - 0.5) * 0.2, size: 0.012 + r() * 0.015 }));
    const letMat = new THREE.MeshStandardMaterial({ color: '#cfc9c0', roughness: 1, transparent: true, opacity: 0 });
    const letGeo = new THREE.IcosahedronGeometry(1, 1);
    const letMesh = new THREE.InstancedMesh(letGeo, letMat, N);
    letMesh.frustumCulled = false;
    return { sphere, items, rim, halo, lets, letMat, letGeo, letMesh };
  }, [sun]);
  useEffect(
    () => () => {
      res.sphere.dispose();
      res.items.forEach((i) => (i.map.dispose(), i.mat.dispose(), i.lg.dispose(), i.lm.dispose()));
      res.rim.dispose();
      res.halo.dispose();
      res.letMat.dispose();
      res.letGeo.dispose();
      res.letMesh.dispose();
    },
    [res],
  );

  const groups = useRef<(THREE.Group | null)[]>([]);
  const meshes = useRef<(THREE.Group | null)[]>([]);
  const st = useRef({ chaos: 0, t: 0, angles: MOONS.map((m) => m.phase), letAngles: [] as number[] });
  const tmp = useMemo(() => ({ q: new THREE.Quaternion(), qi: new THREE.Quaternion(), m: new THREE.Matrix4(), v: new THREE.Vector3(), e: new THREE.Euler() }), []);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.1);
    const d = saturnDir;
    const inMoons = at('moons');
    const shown = inMoons;
    // the orbits get busier and a little chaotic with each line, then settle on the soft line
    const chaos = inMoons && d.kind === 'line' && d.line >= 3 ? Math.min(1, (d.line - 2) / 4) : 0;
    st.current.chaos += (chaos - st.current.chaos) * damp(0.8, dt);
    const c = st.current.chaos;
    const level = inMoons ? (d.kind === 'title' ? -1 : d.kind === 'line' ? d.line : 99) : after('moons') ? 99 : -1;
    MOONS.forEach((m, i) => {
      const it = res.items[i];
      const g = groups.current[i];
      const mesh = meshes.current[i];
      if (!g || !mesh) return;
      const want = shown && level >= m.from ? 1 : 0;
      it.mat.opacity += (want - it.mat.opacity) * damp(1.0, dt);
      const vis = it.mat.opacity > 0.005;
      g.visible = vis;
      if (!vis) return;
      if (it.mat.opacity > 0.995 && it.mat.transparent) {
        it.mat.transparent = false;
        it.mat.needsUpdate = true;
      } else if (it.mat.opacity <= 0.995 && !it.mat.transparent) {
        it.mat.transparent = true;
        it.mat.needsUpdate = true;
      }
      // the orbit line: only while Saturn talks about its moons
      const lineWant = inMoons && level >= m.from ? 0.28 + 0.2 * c : 0;
      it.lm.opacity += (lineWant - it.lm.opacity) * damp(1.0, dt);
      st.current.angles[i] -= dt * m.speed * (1 + 2.4 * c) * (env.reducedMotion ? 0.4 : 1);
      // tilt: a little wilder while the topics pile up
      const incl = m.incl + c * 0.32 * Math.sin(i * 2.3 + 1);
      tmp.e.set(incl, i * 0.9, 0);
      tmp.qi.setFromEuler(tmp.e);
      g.quaternion.copy(RING_Q).multiply(tmp.qi);
      g.position.copy(S);
      const a = st.current.angles[i];
      mesh.position.set(Math.cos(a) * m.dist * R, 0, Math.sin(a) * m.dist * R);
      mesh.scale.setScalar(m.size * R);
      if (m.id === 'titan') {
        mesh.getWorldPosition(titanAt);
      }
    });
    // moonlets
    const letsWant = inMoons && level >= 1 ? 0.95 : 0;
    res.letMat.opacity += (letsWant - res.letMat.opacity) * damp(0.8, dt);
    res.letMesh.visible = res.letMat.opacity > 0.01;
    if (res.letMesh.visible) {
      const n = level >= 5 ? 20 : level >= 1 ? 6 : 0;
      if (!st.current.letAngles.length) st.current.letAngles = res.lets.map((l) => l.phase);
      res.lets.forEach((l, i) => {
        st.current.letAngles[i] -= dt * l.speed * (1 + 2 * c);
        const a = st.current.letAngles[i];
        tmp.v.set(Math.cos(a) * l.dist * R, Math.sin(a) * l.incl * l.dist * R * (1 + c), Math.sin(a) * l.dist * R).applyQuaternion(RING_Q).add(S);
        const s = i < n ? l.size * R : 0.0001;
        tmp.m.compose(tmp.v, tmp.q.identity(), new THREE.Vector3(s, s, s));
        res.letMesh.setMatrixAt(i, tmp.m);
      });
      res.letMesh.instanceMatrix.needsUpdate = true;
    }
    res.rim.uniforms.uIntensity.value = 1.1 * res.items[0].mat.opacity;
    res.halo.uniforms.uIntensity.value = 1.1 * res.items[0].mat.opacity;
  });

  return (
    <>
      {res.items.map((it, i) => (
        <group key={it.m.id} ref={(el) => (groups.current[i] = el)} visible={false}>
          <lineLoop geometry={it.lg} material={it.lm} renderOrder={5} />
          <group ref={(el) => (meshes.current[i] = el)}>
            <mesh geometry={res.sphere} material={it.mat} />
            {it.m.id === 'titan' && (
              <>
                <mesh geometry={res.sphere} material={res.rim} scale={1.03} />
                <mesh geometry={res.sphere} material={res.halo} scale={1.22} />
              </>
            )}
          </group>
        </group>
      ))}
      <primitive object={res.letMesh} />
    </>
  );
}

/* ------------------------------------------------------------------ chapter 4: gravity pulls things into orbit; a work file gets pulled off course */

function Gravity() {
  const res = useMemo(() => {
    const N = LOW ? 380 : 750;
    const r = seeded(404);
    const rad = new Float32Array(N);
    const phase = new Float32Array(N);
    const incl = new Float32Array(N);
    const speed = new Float32Array(N);
    const dir = new Float32Array(N * 3);
    const size = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      rad[i] = 2.6 + Math.pow(r(), 0.8) * 4.2;
      phase[i] = r() * Math.PI * 2;
      incl[i] = (r() - 0.5) * 0.12;
      speed[i] = 0.55 / Math.pow(rad[i], 1.5);
      const a = r() * Math.PI * 2;
      dir.set([Math.cos(a), (r() - 0.5) * 0.4, Math.sin(a)], i * 3);
      size[i] = 0.5 + Math.pow(r(), 3) * 1.6;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3));
    geo.setAttribute('aRad', new THREE.BufferAttribute(rad, 1));
    geo.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1));
    geo.setAttribute('aIncl', new THREE.BufferAttribute(incl, 1));
    geo.setAttribute('aSpeed', new THREE.BufferAttribute(speed, 1));
    geo.setAttribute('aDir', new THREE.BufferAttribute(dir, 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
    const basis = new THREE.Matrix3().setFromMatrix4(new THREE.Matrix4().makeBasis(U0, A, W0.clone().negate()));
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uT: { value: 0 },
        uG: { value: 0 },
        uJ: { value: 0 },
        uOpacity: { value: 0 },
        uR: { value: R },
        uC: { value: S.clone() },
        uB: { value: basis },
        uScale: { value: 600 },
      },
      vertexShader: /* glsl */ `
        attribute float aRad;
        attribute float aPhase;
        attribute float aIncl;
        attribute float aSpeed;
        attribute vec3 aDir;
        attribute float aSize;
        uniform float uT;
        uniform float uG;
        uniform float uJ;
        uniform float uR;
        uniform vec3 uC;
        uniform mat3 uB;
        uniform float uScale;
        varying float vA;
        void main() {
          float a = aPhase - uT * aSpeed;
          vec3 orbit = vec3(cos(a) * aRad, sin(a) * aRad * aIncl, sin(a) * aRad);
          // before gravity takes hold: drifting in straight lines
          vec3 start = vec3(cos(aPhase) * aRad, aIncl * aRad, sin(aPhase) * aRad);
          float run = mod(uT * 0.12 + aPhase * 3.0, 6.0) - 3.0;
          vec3 free = start + aDir * run;
          vec3 p = mix(free, orbit, uG);
          p += aDir * sin(uT * 2.0 + aPhase * 5.0) * 0.06 * uJ;
          vec3 w = uC + uB * (p * uR);
          vec4 mv = viewMatrix * vec4(w, 1.0);
          vA = 1.0 - smoothstep(2.8, 3.0, abs(run)) * (1.0 - uG);
          gl_PointSize = clamp(uScale * aSize / max(-mv.z, 0.1), 1.0, 24.0);
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uOpacity;
        varying float vA;
        void main() {
          float r = length(gl_PointCoord - 0.5) * 2.0;
          if (r > 1.0) discard;
          gl_FragColor = vec4(vec3(0.93, 0.88, 0.8), (1.0 - smoothstep(0.5, 1.0, r)) * uOpacity * vA);
        }
      `,
      transparent: true,
      depthWrite: false,
    });
    const fileMap = canvasTex(256, (g) => {
      g.strokeStyle = 'rgba(255,240,214,0.95)';
      g.fillStyle = 'rgba(255,214,150,0.12)';
      g.lineWidth = 5;
      g.shadowColor = 'rgba(255,200,130,1)';
      g.shadowBlur = 22;
      g.beginPath();
      g.moveTo(72, 34);
      g.lineTo(156, 34);
      g.lineTo(188, 66);
      g.lineTo(188, 222);
      g.lineTo(72, 222);
      g.closePath();
      g.fill();
      g.stroke();
      g.beginPath();
      g.moveTo(156, 34);
      g.lineTo(156, 66);
      g.lineTo(188, 66);
      g.stroke();
      for (let i = 0; i < 5; i++) {
        g.beginPath();
        g.moveTo(92, 96 + i * 24);
        g.lineTo(i % 2 ? 150 : 168, 96 + i * 24);
        g.stroke();
      }
    });
    const fileMat = new THREE.SpriteMaterial({ map: fileMap, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 });
    return { geo, mat, fileMap, fileMat };
  }, []);
  useEffect(() => () => (res.geo.dispose(), res.mat.dispose(), res.fileMap.dispose(), res.fileMat.dispose()), [res]);
  const pts = useRef<THREE.Points>(null);
  const file = useRef<THREE.Sprite>(null);
  const st = useRef({ g: 0, j: 0, vis: 0, path: null as THREE.CatmullRomCurve3 | null, startT: -1 });
  useFrame(({ clock, camera, size, gl }, delta) => {
    const dt = Math.min(delta, 0.1);
    const d = saturnDir;
    const inG = at('gravity');
    const want = inG || (at('final') && d.partT < 4) ? 1 : 0;
    st.current.vis += (want - st.current.vis) * damp(0.9, dt);
    if (pts.current) pts.current.visible = st.current.vis > 0.01;
    // gravity takes hold as Saturn explains it
    const g = inG ? (d.kind === 'title' ? 0 : d.kind === 'line' && d.line === 0 ? 0.35 : 1) : 1;
    st.current.g += (g - st.current.g) * damp(0.5, dt);
    // a little restless while the work gets abandoned, calm on the soft line
    const j = inG && d.kind === 'line' && d.line >= 4 ? 1 : 0;
    st.current.j += (j - st.current.j) * damp(1, dt);
    res.mat.uniforms.uT.value = clock.elapsedTime;
    res.mat.uniforms.uG.value = st.current.g;
    res.mat.uniforms.uJ.value = st.current.j;
    res.mat.uniforms.uOpacity.value = st.current.vis * 0.9;
    const cam = camera as THREE.PerspectiveCamera;
    res.mat.uniforms.uScale.value = (size.height * gl.getPixelRatio()) / 2 / Math.tan((cam.fov * Math.PI) / 360);

    // the work file: it floats in from the side, then gets pulled off course into a curve
    const f = file.current;
    if (!f) return;
    const fileOn = inG && d.kind === 'line' && d.line >= 4;
    if (fileOn && !st.current.path) {
      const toCam = camera.position.clone().sub(S).normalize();
      const right = new THREE.Vector3().crossVectors(toCam, new THREE.Vector3(0, 1, 0)).normalize().negate();
      const up = new THREE.Vector3().crossVectors(right, toCam).normalize().negate();
      const P = (x: number, y: number, z: number) => S.clone().addScaledVector(right, x * R).addScaledVector(up, y * R).addScaledVector(toCam, z * R);
      st.current.path = new THREE.CatmullRomCurve3([P(-9, 1.6, 1.5), P(-6, 1.3, 1.6), P(-3.6, 1.0, 1.7), P(-2.2, 0.6, 1.9), P(-0.4, 0.2, 2.6), P(1.6, -0.1, 2.4), P(2.9, -0.2, 1.0), P(2.8, -0.15, -1.2)]);
      st.current.startT = d.t;
    }
    const fWant = fileOn || (inG && d.kind !== 'title' && st.current.path && d.line >= 4) ? 1 : 0;
    res.fileMat.opacity += ((fWant ? 0.95 : 0) - res.fileMat.opacity) * damp(1.2, dt);
    f.visible = !!st.current.path && res.fileMat.opacity > 0.01;
    if (f.visible && st.current.path) {
      const e = Math.min(1, (d.t - st.current.startT) / 13);
      const k = 1 - Math.pow(1 - e, 1.6);
      st.current.path.getPoint(k, f.position);
      const s = 0.85 * R;
      f.scale.set(s, s, 1);
      res.fileMat.rotation = Math.sin(d.t * 1.3) * 0.15 - k * 0.8;
    }
    if (!inG) st.current.path = null;
  });
  return (
    <>
      <points ref={pts} geometry={res.geo} material={res.mat} frustumCulled={false} visible={false} renderOrder={6} />
      <sprite ref={file} material={res.fileMat} visible={false} renderOrder={10} />
    </>
  );
}

/* ------------------------------------------------------------------ the secret: the light becomes Enceladus */

const glowVert = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
// the same glow as the gold light she chased at the very beginning
const glowFrag = /* glsl */ `
  uniform float uOpacity;
  varying vec2 vUv;
  void main() {
    float r = length(vUv - 0.5) * 2.0;
    if (r > 1.0) discard;
    float core = exp(-r * r * 140.0);
    float inner = exp(-r * r * 26.0) * 0.6;
    float halo = exp(-r * r * 5.0) * 0.32;
    vec3 col = mix(vec3(0.95, 0.85, 0.64), vec3(1.0, 0.98, 0.94), clamp(core * 1.4 + inner * 0.5, 0.0, 1.0));
    gl_FragColor = vec4(col, (core * 1.3 + inner + halo) * (1.0 - smoothstep(0.75, 1.0, r)) * uOpacity);
  }
`;

/** Where the light / Enceladus is (for the hotspot). */
export const enceladusAt = new THREE.Vector3();

function Enceladus() {
  const res = useMemo(() => {
    const plane = new THREE.PlaneGeometry(1, 1);
    const glow = new THREE.ShaderMaterial({
      vertexShader: glowVert,
      fragmentShader: glowFrag,
      uniforms: { uOpacity: { value: 0 } },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const iceMap = canvasTex(256, (g) => {
      g.fillStyle = '#f4f8fc';
      g.fillRect(0, 0, 256, 256);
      const r = seeded(208);
      for (let i = 0; i < 160; i++) {
        g.fillStyle = `rgba(190,210,228,${0.08 + r() * 0.12})`;
        g.beginPath();
        g.arc(r() * 256, r() * 200, 2 + r() * 8, 0, Math.PI * 2);
        g.fill();
      }
      // the "tiger stripes" near the south pole
      g.strokeStyle = 'rgba(140,180,210,0.55)';
      g.lineWidth = 3;
      for (let i = 0; i < 4; i++) {
        g.beginPath();
        g.moveTo(40 + i * 10, 214 + i * 8);
        g.bezierCurveTo(100, 200 + i * 8, 160, 228 + i * 6, 220 - i * 8, 210 + i * 8);
        g.stroke();
      }
    });
    const ice = new THREE.MeshStandardMaterial({ map: iceMap, roughness: 0.35, emissive: '#bcd6ff', emissiveIntensity: 0.12, transparent: true, opacity: 0 });
    const sphere = new THREE.SphereGeometry(ENCELADUS_R, 48, 32);
    // the plumes: soft particles spraying from the south pole
    const N = LOW ? 220 : 420;
    const r = seeded(9);
    const life = new Float32Array(N);
    const dir = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      life[i] = r();
      const a = r() * Math.PI * 2;
      const s = r() * 0.32;
      dir.set([Math.cos(a) * s, -1, Math.sin(a) * s], i * 3);
    }
    const pg = new THREE.BufferGeometry();
    pg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3));
    pg.setAttribute('aLife', new THREE.BufferAttribute(life, 1));
    pg.setAttribute('aDir', new THREE.BufferAttribute(dir, 3));
    const pm = new THREE.ShaderMaterial({
      uniforms: { uT: { value: 0 }, uOpacity: { value: 0 }, uLen: { value: ENCELADUS_R * 6 }, uScale: { value: 600 } },
      vertexShader: /* glsl */ `
        attribute float aLife;
        attribute vec3 aDir;
        uniform float uT;
        uniform float uLen;
        uniform float uScale;
        varying float vA;
        void main() {
          float k = fract(aLife + uT * 0.12);
          vec3 p = aDir * k * uLen;
          p.y -= 0.8 * uLen * 0.12;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          vA = (1.0 - k) * smoothstep(0.0, 0.08, k);
          gl_PointSize = clamp(uScale * (0.25 + k * 0.9) / max(-mv.z, 0.1), 1.0, 30.0);
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uOpacity;
        varying float vA;
        void main() {
          float r = length(gl_PointCoord - 0.5) * 2.0;
          if (r > 1.0) discard;
          gl_FragColor = vec4(vec3(0.82, 0.9, 1.0), exp(-r * r * 3.0) * vA * uOpacity * 0.45);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    // the faint E ring it feeds
    const ringGeo = new THREE.RingGeometry(R * 3.0, R * 4.9, 180, 1);
    const ringMat = new THREE.ShaderMaterial({
      uniforms: { uOpacity: { value: 0 }, uC: { value: S.clone() }, uR: { value: R } },
      vertexShader: /* glsl */ `
        varying vec3 vW;
        void main() {
          vec4 w = modelMatrix * vec4(position, 1.0);
          vW = w.xyz;
          gl_Position = projectionMatrix * viewMatrix * w;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uOpacity;
        uniform vec3 uC;
        uniform float uR;
        varying vec3 vW;
        void main() {
          float r = distance(vW, uC) / uR;
          float d = exp(-pow((r - 3.95) / 0.45, 2.0));
          gl_FragColor = vec4(vec3(0.7, 0.82, 1.0), d * uOpacity);
        }
      `,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    });
    return { plane, glow, iceMap, ice, sphere, pg, pm, ringGeo, ringMat };
  }, []);
  useEffect(() => () => Object.values(res).forEach((x) => x.dispose()), [res]);
  const glowRef = useRef<THREE.Mesh>(null);
  const moon = useRef<THREE.Group>(null);
  const ringQ = useMemo(() => new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), A), []);
  const poleQ = useMemo(() => new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), A), []);
  const st = useRef({ light: 0, moon: 0 });
  const v = useMemo(() => new THREE.Vector3(), []);

  useFrame(({ camera, clock, size, gl }, delta) => {
    const dt = Math.min(delta, 0.1);
    const d = saturnDir;
    const inSecret = at('secret');
    const done = at('complete');
    // the light appears near the rings, drifts in front of Saturn…
    const lightWant = inSecret && d.partT > 0.6 ? 1 : 0;
    // …and once Saturn says its name, it resolves into a small, bright, icy moon
    const resolved = (inSecret && d.kind !== 'pause' && d.line >= 2) || (inSecret && d.kind === 'last') || done || (inSecret && d.kind === 'pause' && d.partT > 20);
    st.current.light += (lightWant - st.current.light) * damp(1.2, dt);
    st.current.moon += ((resolved ? 1 : 0) - st.current.moon) * damp(0.6, dt);
    const L = st.current.light;
    const M = st.current.moon;
    const pos = inSecret ? lightPos(d.partT, v) : v.copy(ENCELADUS_AT);
    enceladusAt.copy(pos);
    const g = glowRef.current;
    if (g) {
      g.visible = L > 0.01 && M < 0.98;
      g.position.copy(pos);
      g.quaternion.copy(camera.quaternion);
      // a constant size on screen, like the little light she remembers; it fades as the moon appears
      const dist = camera.position.distanceTo(pos);
      g.scale.setScalar(dist * 0.09 * (1 + M * 0.6));
      res.glow.uniforms.uOpacity.value = L * (1 - M * 0.75) * (0.9 + 0.1 * Math.sin(clock.elapsedTime * 3));
    }
    const m = moon.current;
    if (m) {
      const show = M > 0.01 && (inSecret || done);
      m.visible = show;
      m.position.copy(pos);
      m.quaternion.copy(poleQ);
      m.scale.setScalar(0.2 + 0.8 * M);
      res.ice.opacity = M;
    }
    res.pm.uniforms.uT.value = clock.elapsedTime;
    res.pm.uniforms.uOpacity.value = M;
    const cam = camera as THREE.PerspectiveCamera;
    res.pm.uniforms.uScale.value = (size.height * gl.getPixelRatio()) / 2 / Math.tan((cam.fov * Math.PI) / 360);
    res.ringMat.uniforms.uOpacity.value = M * 0.16;
  });

  return (
    <>
      <mesh ref={glowRef} geometry={res.plane} material={res.glow} visible={false} renderOrder={20} />
      <group ref={moon} visible={false}>
        <mesh geometry={res.sphere} material={res.ice} />
        <points geometry={res.pg} material={res.pm} frustumCulled={false} renderOrder={12} />
      </group>
      <mesh geometry={res.ringGeo} material={res.ringMat} position={S} quaternion={ringQ} renderOrder={4} />
    </>
  );
}

/* ------------------------------------------------------------------ hotspots: where they are on screen */

type HotId = 'rings' | 'hexagon' | 'titan' | 'enceladus';
export const saturnHot: { open: HotId | ''; spots: Record<HotId, { x: number; y: number; on: boolean }> } = {
  open: '',
  spots: {
    rings: { x: 0, y: 0, on: false },
    hexagon: { x: 0, y: 0, on: false },
    titan: { x: 0, y: 0, on: false },
    enceladus: { x: 0, y: 0, on: false },
  },
};

/** Is the point hidden behind the planet? */
function behindPlanet(cam: THREE.Vector3, p: THREE.Vector3) {
  const d = p.clone().sub(cam);
  const len = d.length();
  d.divideScalar(len);
  const oc = cam.clone().sub(S);
  const b = oc.dot(d);
  const c = oc.lengthSq() - R * R;
  const disc = b * b - c;
  if (disc < 0) return false;
  const t = -b - Math.sqrt(disc);
  return t > 0 && t < len - 1;
}

function Hotspots() {
  const v = useMemo(() => new THREE.Vector3(), []);
  const p = useMemo(() => new THREE.Vector3(), []);
  useFrame(({ camera, size }) => {
    const put = (id: HotId, world: THREE.Vector3, allowed: boolean) => {
      const s = saturnHot.spots[id];
      v.copy(world).project(camera);
      s.x = (v.x * 0.5 + 0.5) * size.width;
      s.y = (-v.y * 0.5 + 0.5) * size.height;
      s.on = allowed && v.z < 1 && Math.abs(v.x) < 0.86 && Math.abs(v.y) < 0.8 && !behindPlanet(camera.position, world);
    };
    // the rings: the point of the outer ring nearest the camera's right
    const toCam = camera.position.clone().sub(S).projectOnPlane(A).normalize();
    const right = new THREE.Vector3().crossVectors(A, toCam).normalize();
    p.copy(S).addScaledVector(right, 2.1 * R).addScaledVector(toCam, 0.6 * R);
    const wide = (saturnDir.part !== 'rings' || saturnDir.kind === 'title') && !at('complete');
    put('rings', p, wide && saturnDir.part !== 'secret');
    put('hexagon', p.copy(S).addScaledVector(A, R * 1.05), wide && saturnDir.part !== 'secret');
    put('titan', p.copy(titanAt).addScaledVector(A, R * 0.32), at('moons') && saturnDir.kind !== 'title');
    put('enceladus', p.copy(enceladusAt).addScaledVector(A, R * 0.12), at('secret') && saturnDir.kind === 'line' && saturnDir.line >= 2);
  });
  return null;
}

/* ------------------------------------------------------------------ all together */

export function SaturnWorld() {
  return (
    <>
      <Glow />
      <HexCap />
      <RingDebris />
      <LightPapers />
      <HmmGlyph />
      <Moons />
      <Gravity />
      <Enceladus />
      <Hotspots />
    </>
  );
}
