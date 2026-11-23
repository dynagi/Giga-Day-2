import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { damp } from '../lib/ease';
import { env } from '../lib/env';
import { CT, cityClock } from './cityClock';
import { HOSTEL } from './cityLayout';
import { PLINTH } from './Hostel';

/**
 * Richa, coming out of her hostel: pink kurti with a white print and lace hem, baggy light
 * jeans, white shoes, a lavender bindi, one bangle on her right wrist, a watch on her left.
 * She walks out, waves, stops in front of him, looks at him while she talks, blinks,
 * breathes, tilts her head, smiles, and finally looks up at the sky with him.
 */

/** Where she is on screen (for her floating words). */
export const richaScreen = { x: 0, y: 0, on: false };

/**
 * Her walk: [time, x, distance out from the hostel front (negative = inside the lobby),
 * height of the floor under her, walking 0..1]. She comes from the corridor at the side of the lobby.
 */
const PATH: [number, number, number, number, number][] = [
  [59.4, -3.0, -1.3, PLINTH, 1],
  [60.6, -1.2, -1.15, PLINTH, 1],
  [61.5, -0.15, -0.6, PLINTH, 1],
  [62.4, 0.0, 0.25, PLINTH, 1],
  [63.4, 0.0, 1.5, 0, 1],
  [65.2, 0.02, 3.1, 0, 0.85],
  [66.4, 0.04, 3.9, 0, 0.3],
  [66.9, 0.05, 4.0, 0, 0],
];

function pathAt(t: number) {
  const f = PATH[0];
  if (t <= f[0]) return { x: f[1], z: f[2], y: f[3], walk: 0, turn: Math.PI / 2 };
  for (let i = 0; i < PATH.length - 1; i++) {
    const a = PATH[i];
    const b = PATH[i + 1];
    if (t <= b[0]) {
      const k = (t - a[0]) / (b[0] - a[0]);
      const s = k * k * (3 - 2 * k);
      // she faces the way she walks; her height follows the stairs
      const turn = Math.atan2(b[1] - a[1], b[2] - a[2]);
      return { x: a[1] + (b[1] - a[1]) * k, z: a[2] + (b[2] - a[2]) * k, y: a[3] + (b[3] - a[3]) * s, walk: a[4] + (b[4] - a[4]) * k, turn };
    }
  }
  const l = PATH[PATH.length - 1];
  return { x: l[1], z: l[2], y: l[3], walk: 0, turn: 0 };
}

/* ------------------------------------------------------------------ textures */

function kurtiTexture() {
  const S = 512;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d')!;
  g.fillStyle = '#e2559a';
  g.fillRect(0, 0, S, S);
  // a soft woven feel
  for (let i = 0; i < 2200; i++) {
    g.fillStyle = `rgba(255,255,255,${Math.random() * 0.035})`;
    g.fillRect(Math.random() * S, Math.random() * S, 2, 1);
  }
  // white block-print motifs (a small lotus), in an offset grid
  const motif = (x: number, y: number, s: number) => {
    g.save();
    g.translate(x, y);
    g.strokeStyle = 'rgba(255,240,246,0.92)';
    g.fillStyle = 'rgba(255,240,246,0.85)';
    g.lineWidth = s * 0.09;
    for (let p = -2; p <= 2; p++) {
      g.save();
      g.rotate(p * 0.42);
      g.beginPath();
      g.ellipse(0, -s * 0.42, s * 0.16, s * 0.42, 0, 0, Math.PI * 2);
      g.stroke();
      g.restore();
    }
    g.beginPath();
    g.arc(0, s * 0.06, s * 0.11, 0, Math.PI * 2);
    g.fill();
    g.beginPath();
    g.moveTo(-s * 0.4, s * 0.2);
    g.quadraticCurveTo(0, s * 0.45, s * 0.4, s * 0.2);
    g.stroke();
    g.restore();
  };
  const step = S / 4;
  for (let r = 0; r < 5; r++) for (let q = 0; q < 5; q++) motif(q * step + (r % 2 ? step / 2 : 0), r * step + step / 2, step * 0.5);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(5, 3);
  t.anisotropy = 8;
  return t;
}

function denimTexture() {
  const S = 256;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d')!;
  g.fillStyle = '#b8cbdb';
  g.fillRect(0, 0, S, S);
  // the diagonal twill, and a lighter wash
  for (let i = -S; i < S * 2; i += 3) {
    g.strokeStyle = `rgba(80,105,135,${0.1 + Math.random() * 0.08})`;
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(i, 0);
    g.lineTo(i + S, S);
    g.stroke();
  }
  for (let i = 0; i < 400; i++) {
    g.fillStyle = `rgba(255,255,255,${Math.random() * 0.08})`;
    g.fillRect(Math.random() * S, Math.random() * S, 6, 2);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(2, 4);
  return t;
}

/* ------------------------------------------------------------------ head and hair */

/** A head shaped from a sphere: a softer jaw and chin, cheekbones, a nose, gentle eye sockets. */
function sculptedHead() {
  const g = new THREE.SphereGeometry(0.1, 64, 48);
  const p = g.getAttribute('position');
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i).divideScalar(0.1);
    let { x, y, z } = v;
    const front = Math.max(0, z);
    // the jaw narrows toward a small chin
    if (y < 0) {
      const k = Math.pow(-y, 1.6);
      x *= 1 - 0.3 * k;
      z *= 1 - 0.12 * k;
    }
    // chin, forward a touch
    z += 0.06 * Math.exp(-((y + 0.78) ** 2) / 0.02) * front;
    // cheekbones
    x *= 1 + 0.04 * Math.exp(-((y + 0.12) ** 2) / 0.04);
    // the nose: bridge and tip
    const nx = x * x;
    z += 0.13 * Math.exp(-nx / 0.006 - ((y + 0.18) ** 2) / 0.03) * front;
    z += 0.05 * Math.exp(-nx / 0.004 - ((y + 0.0) ** 2) / 0.05) * front;
    // soft eye sockets, and a brow above them
    z -= 0.045 * Math.exp(-((Math.abs(x) - 0.34) ** 2) / 0.018 - ((y - 0.08) ** 2) / 0.012) * front;
    z += 0.02 * Math.exp(-((y - 0.24) ** 2) / 0.006) * front;
    // lips: a little fullness
    z += 0.035 * Math.exp(-nx / 0.03 - ((y + 0.46) ** 2) / 0.006) * front;
    p.setXYZ(i, x * 0.1, y * 0.1, z * 0.1);
  }
  g.computeVertexNormals();
  return g;
}

/** Long hair: many soft strands from a side parting, framing her face and falling past her shoulders. */
function hairStrands() {
  const parts: THREE.BufferGeometry[] = [];
  const strand = (pts: number[][], r: number) => {
    const curve = new THREE.CatmullRomCurve3(pts.map(([x, y, z]) => new THREE.Vector3(x, y, z)));
    parts.push(new THREE.TubeGeometry(curve, 28, r, 6, false));
  };
  let s = 3;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  // around the back of the head
  for (let i = 0; i < 16; i++) {
    const a = Math.PI * (0.18 + (i / 15) * 0.64); // from her left side, round the back, to her right
    const cx = Math.cos(a);
    const sz = -Math.sin(a);
    const w = (rnd() - 0.5) * 0.012;
    strand(
      [
        [0.012 + cx * 0.02, 0.118, 0.02 + sz * 0.02],
        [cx * 0.085, 0.085, sz * 0.085],
        [cx * 0.104, 0.0, sz * 0.1],
        [cx * 0.112 + w, -0.12, sz * 0.105],
        [cx * 0.12 + w, -0.24, sz * 0.11 - 0.01],
        [cx * 0.125 - w, -0.36 - rnd() * 0.04, sz * 0.11 - 0.02],
      ],
      0.016 + rnd() * 0.004,
    );
  }
  // in front: framing her face, resting over her shoulders
  for (const sd of [-1, 1]) {
    for (let k = 0; k < 4; k++) {
      const o = k * 0.012;
      strand(
        [
          [0.014 * sd + 0.012, 0.118, 0.035 - o],
          [sd * (0.06 + o), 0.1, 0.07 - o],
          [sd * (0.09 + o * 0.5), 0.035, 0.055 - o],
          [sd * (0.098 + o * 0.4), -0.05, 0.035 - o],
          [sd * (0.11 + o * 0.3), -0.15, 0.02 - o * 0.5],
          [sd * (0.13 + o * 0.3), -0.25, 0.03 - o * 0.6],
          [sd * (0.135 + o * 0.2), -0.33, 0.035 - o],
        ],
        0.013 + rnd() * 0.003,
      );
    }
  }
  // a soft sweep across the forehead from the parting
  strand([[0.02, 0.118, 0.03], [-0.02, 0.105, 0.075], [-0.06, 0.075, 0.08], [-0.088, 0.03, 0.06]], 0.014);
  strand([[0.024, 0.116, 0.035], [0.05, 0.1, 0.075], [0.075, 0.07, 0.075], [0.092, 0.03, 0.058]], 0.013);
  const merged = mergeGeometries(parts);
  parts.forEach((g) => g.dispose());
  return merged;
}

/* ------------------------------------------------------------------ the figure */

export function Richa3D() {
  const res = useMemo(() => {
    const kurtiMap = kurtiTexture();
    const denimMap = denimTexture();
    const M = {
      skin: new THREE.MeshPhysicalMaterial({ color: '#d39a76', roughness: 0.58, emissive: '#4a1e10', emissiveIntensity: 0.1, sheen: 0.25, sheenColor: new THREE.Color('#ffb8a0') }),
      kurti: new THREE.MeshPhysicalMaterial({ map: kurtiMap, roughness: 0.8, sheen: 0.6, sheenColor: new THREE.Color('#ffc2dc'), sheenRoughness: 0.6, side: THREE.DoubleSide }),
      lace: new THREE.MeshStandardMaterial({ color: '#f4ead8', roughness: 0.85, side: THREE.DoubleSide }),
      denim: new THREE.MeshStandardMaterial({ map: denimMap, roughness: 0.92 }),
      shoe: new THREE.MeshStandardMaterial({ color: '#f5f5f2', roughness: 0.55 }),
      sole: new THREE.MeshStandardMaterial({ color: '#d8d8d4', roughness: 0.7 }),
      hair: new THREE.MeshPhysicalMaterial({ color: '#1d1310', roughness: 0.48, metalness: 0.0, sheen: 0.6, sheenColor: new THREE.Color('#6b4a3c'), sheenRoughness: 0.4, side: THREE.DoubleSide }),
      eyeW: new THREE.MeshStandardMaterial({ color: '#f3eee8', roughness: 0.3 }),
      iris: new THREE.MeshStandardMaterial({ color: '#2c1a12', roughness: 0.2 }),
      shine: new THREE.MeshBasicMaterial({ color: '#ffffff' }),
      lash: new THREE.MeshStandardMaterial({ color: '#120b09', roughness: 0.6 }),
      lips: new THREE.MeshStandardMaterial({ color: '#b5566a', roughness: 0.4 }),
      blush: new THREE.MeshBasicMaterial({ color: '#ff8fa8', transparent: true, opacity: 0.07, depthWrite: false }),
      bindi: new THREE.MeshStandardMaterial({ color: '#b39cf0', roughness: 0.3, emissive: '#7a5fd6', emissiveIntensity: 0.25 }),
      gold: new THREE.MeshStandardMaterial({ color: '#d9ae55', roughness: 0.28, metalness: 0.95 }),
      strap: new THREE.MeshStandardMaterial({ color: '#2b2224', roughness: 0.6 }),
      dial: new THREE.MeshStandardMaterial({ color: '#e9d7c8', roughness: 0.2, metalness: 0.7 }),
      shadow: new THREE.MeshBasicMaterial({ color: '#000000', transparent: true, opacity: 0.35, depthWrite: false }),
    };

    // the kurti: a fitted top, flaring to a hem just above the knee
    const prof = [
      [0.058, 1.372],
      [0.118, 1.356],
      [0.162, 1.33],
      [0.171, 1.28],
      [0.166, 1.19],
      [0.149, 1.07],
      [0.152, 1.0],
      [0.171, 0.9],
      [0.196, 0.78],
      [0.216, 0.67],
    ].map(([r, y]) => new THREE.Vector2(r, y));
    const kurti = new THREE.LatheGeometry(prof, 40);
    const lace = new THREE.LatheGeometry([new THREE.Vector2(0.2165, 0.675), new THREE.Vector2(0.221, 0.64)], 40);
    const neckLace = new THREE.LatheGeometry([new THREE.Vector2(0.06, 1.376), new THREE.Vector2(0.071, 1.37)], 24);
    // the lace trim along her V neckline (like the kurti in the picture)
    const vLace = new THREE.TubeGeometry(
      new THREE.CatmullRomCurve3([new THREE.Vector3(-0.07, 1.37, 0.1), new THREE.Vector3(-0.03, 1.31, 0.122), new THREE.Vector3(0, 1.265, 0.127), new THREE.Vector3(0.03, 1.31, 0.122), new THREE.Vector3(0.07, 1.37, 0.1)]),
      30,
      0.005,
      6,
      false,
    );
    // and a little skin showing inside the V
    const vSkin = new THREE.ShapeGeometry(new THREE.Shape([new THREE.Vector2(-0.062, 0), new THREE.Vector2(0.062, 0), new THREE.Vector2(0, -0.098)]));

    // her shape: the hair falls behind, long
    const hairBack = new THREE.CylinderGeometry(0.092, 0.13, 0.42, 28, 6, true, Math.PI * 0.5, Math.PI * 1.0);
    {
      // soft waves along the length
      const p = hairBack.getAttribute('position');
      for (let i = 0; i < p.count; i++) {
        const y = p.getY(i);
        const x = p.getX(i);
        const z = p.getZ(i);
        const a = Math.atan2(x, z);
        const w = 1 + 0.05 * Math.sin(a * 9 + y * 18) * (0.5 - y);
        p.setXYZ(i, x * w, y, z * w);
      }
      hairBack.computeVertexNormals();
    }
    return {
      M,
      maps: [kurtiMap, denimMap],
      geo: {
        kurti,
        lace,
        neckLace,
        hairBack,
        hairCap: new THREE.SphereGeometry(0.109, 32, 20, 0, Math.PI * 2, 0, 1.28),
        hairBackHead: new THREE.SphereGeometry(0.112, 28, 18, Math.PI, Math.PI, 0, Math.PI * 0.78),
        head: sculptedHead(),
        strands: hairStrands(),
        vLace,
        vSkin,
        lid: new THREE.TorusGeometry(0.0182, 0.0021, 6, 20, Math.PI),
        cuff: new THREE.TorusGeometry(0.06, 0.0045, 6, 28),
        sphere: new THREE.SphereGeometry(1, 20, 14),
        leg: new THREE.CylinderGeometry(0.085, 0.104, 0.8, 18, 1),
        sleeve: new THREE.CylinderGeometry(0.044, 0.06, 0.34, 18, 1, true),
        forearm: new THREE.CylinderGeometry(0.031, 0.026, 0.25, 14),
        neck: new THREE.CylinderGeometry(0.037, 0.041, 0.1, 16),
        bangle: new THREE.TorusGeometry(0.036, 0.0055, 10, 36),
        strap: new THREE.TorusGeometry(0.031, 0.0075, 8, 30),
        dial: new THREE.CylinderGeometry(0.014, 0.014, 0.006, 24),
        disc: new THREE.CircleGeometry(1, 24),
        lash: new THREE.BoxGeometry(1, 1, 1),
      },
    };
  }, []);
  useEffect(
    () => () => {
      Object.values(res.M).forEach((m) => m.dispose());
      Object.values(res.geo).forEach((g) => g.dispose());
      res.maps.forEach((m) => m.dispose());
    },
    [res],
  );

  const root = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);
  const legL = useRef<THREE.Group>(null);
  const legR = useRef<THREE.Group>(null);
  const armL = useRef<THREE.Group>(null);
  const armR = useRef<THREE.Group>(null);
  const foreR = useRef<THREE.Group>(null);
  const foreL = useRef<THREE.Group>(null);
  const hair = useRef<THREE.Mesh>(null);
  const eyes = useRef<THREE.Group>(null);
  const mouth = useRef<THREE.Mesh>(null);
  const st = useRef({ phase: 0, yaw: 0, pitch: 0, tilt: 0, blinkAt: 2, wave: 0, turn: Math.PI / 2 });
  const tmp = useMemo(() => ({ v: new THREE.Vector3(), w: new THREE.Vector3(), m: new THREE.Matrix4() }), []);

  useFrame(({ camera, size }, delta) => {
    const g = root.current;
    if (!g) return;
    const dt = Math.min(delta, 0.1);
    const t = cityClock.t;
    const shown = t > PATH[0][0] && t < CT.rise + 1.5;
    g.visible = shown;
    richaScreen.on = false;
    if (!shown) return;
    const s = st.current;
    const calm = env.reducedMotion;
    const p = pathAt(t);
    g.position.set(HOSTEL.x + p.x, p.y, HOSTEL.front - p.z);
    s.turn += (p.turn - s.turn) * damp(4, dt);
    g.rotation.y = Math.PI - s.turn;
    const walk = calm ? Math.min(p.walk, 0.4) : p.walk;
    s.phase += dt * 2 * Math.PI * 0.95 * (walk > 0.02 ? 1 : 0);
    const sw = Math.sin(s.phase);
    const time = performance.now() / 1000;

    // walking: legs and arms swing, the body bobs and sways a little; idle: she breathes and shifts her weight
    const legSwing = 0.36 * walk;
    if (legL.current) legL.current.rotation.x = sw * legSwing;
    if (legR.current) legR.current.rotation.x = -sw * legSwing;
    const waving = t > 63.6 && t < 65.4;
    s.wave += ((waving ? 1 : 0) - s.wave) * damp(5, dt);
    if (armL.current) armL.current.rotation.set(-sw * 0.3 * walk + 0.04, 0, 0.09);
    if (armR.current) {
      // a small friendly wave as she sees him
      armR.current.rotation.set(sw * 0.3 * walk * (1 - s.wave) - s.wave * 2.5, 0, -0.09 - s.wave * 0.35);
    }
    if (foreR.current) foreR.current.rotation.set(-0.12 - s.wave * (0.9 + 0.25 * Math.sin(time * 9)), 0, s.wave * 0.25 * Math.sin(time * 9));
    if (foreL.current) foreL.current.rotation.set(-0.15 - walk * 0.15, 0, 0);
    if (body.current) {
      body.current.position.y = Math.abs(Math.cos(s.phase)) * 0.018 * walk + Math.sin(time * 1.6) * 0.0025;
      body.current.rotation.z = sw * 0.025 * walk + Math.sin(time * 0.35) * 0.012 * (1 - walk);
      body.current.rotation.y = sw * 0.06 * walk;
    }
    if (hair.current) hair.current.rotation.x = -0.05 - Math.abs(sw) * 0.04 * walk + Math.sin(time * 1.1) * 0.01;

    // her head: she looks at him (within what a neck can do), tilts it while she asks, nods, looks up at the end
    const h = head.current;
    if (h) {
      h.updateWorldMatrix(true, false);
      tmp.v.setFromMatrixPosition(h.matrixWorld);
      tmp.w.copy(camera.position).sub(tmp.v);
      // into her own frame (she faces −Z in the world: her front is her local +Z, turned by π)
      const yawWorld = Math.atan2(tmp.w.x, tmp.w.z);
      let yaw = yawWorld - g.rotation.y;
      yaw = Math.atan2(Math.sin(yaw), Math.cos(yaw));
      let pitch = Math.atan2(tmp.w.y, Math.hypot(tmp.w.x, tmp.w.z));
      const looking = t > 62.4;
      yaw = looking ? Math.max(-0.9, Math.min(0.9, yaw)) : 0;
      pitch = looking ? Math.max(-0.4, Math.min(0.45, pitch)) : -0.08;
      let tilt = 0;
      if (t >= CT.ask && t < CT.reply) tilt = 0.12 + Math.sin(time * 1.4) * 0.02; // curious
      if (t >= CT.reply + 2.8 && t < CT.reply + 3.6) pitch -= 0.16 * Math.sin(((t - CT.reply - 2.8) / 0.8) * Math.PI); // a nod
      if (t >= CT.replyOut) pitch = 0.75; // looking up, at the sky
      const k = damp(4, dt);
      s.yaw += (yaw - s.yaw) * k;
      s.pitch += (pitch - s.pitch) * k;
      s.tilt += (tilt - s.tilt) * damp(3, dt);
      h.rotation.set(-s.pitch, s.yaw, s.tilt, 'YXZ');
    }
    // blinking
    if (eyes.current) {
      if (time > s.blinkAt) s.blinkAt = time + 2.4 + Math.random() * 2.8;
      const b = s.blinkAt - time;
      const closed = b > 0 && b < 0.13 ? 1 - Math.abs(b - 0.065) / 0.065 : 0;
      eyes.current.scale.y = 1 - closed * 0.9;
    }
    // talking: the lips part gently (no exaggeration)
    if (mouth.current) {
      const talking = t >= CT.ask + 0.2 && t < CT.ask + 2.4;
      mouth.current.scale.y = 0.007 * (1 + (talking ? Math.abs(Math.sin(time * 11)) * 0.55 : 0));
    }

    // where her head is on screen, for her words
    if (h) {
      tmp.v.setFromMatrixPosition(h.matrixWorld).add(new THREE.Vector3(0, 0.36, 0)).project(camera);
      richaScreen.x = (tmp.v.x * 0.5 + 0.5) * size.width;
      richaScreen.y = (-tmp.v.y * 0.5 + 0.5) * size.height;
      richaScreen.on = tmp.v.z < 1 && Math.abs(tmp.v.x) < 1.2;
    }
  });

  const { M, geo } = res;
  const S = (x: number, y: number, z: number) => [x, y, z] as [number, number, number];
  return (
    // she faces the street (−Z in the world)
    <group ref={root} rotation={[0, Math.PI, 0]} visible={false}>
      {/* a soft contact shadow */}
      <mesh geometry={geo.disc} material={M.shadow} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.012, 0]} scale={S(0.32, 0.26, 1)} />
      <group ref={body}>
        {/* legs: baggy jeans and white shoes, swinging from the hips */}
        {([-1, 1] as const).map((sd) => (
          <group key={sd} ref={sd < 0 ? legL : legR} position={[sd * 0.085, 0.86, 0]}>
            <mesh geometry={geo.leg} material={M.denim} position={[0, -0.42, 0]} />
            <mesh geometry={geo.sphere} material={M.shoe} position={[0, -0.81, 0.035]} scale={S(0.05, 0.042, 0.125)} />
            <mesh geometry={geo.sphere} material={M.sole} position={[0, -0.835, 0.035]} scale={S(0.052, 0.016, 0.128)} />
          </group>
        ))}
        {/* the kurti */}
        <mesh geometry={geo.kurti} material={M.kurti} scale={S(1, 1, 0.74)} />
        <mesh geometry={geo.lace} material={M.lace} scale={S(1, 1, 0.74)} />
        <mesh geometry={geo.neckLace} material={M.lace} scale={S(1, 1, 0.8)} />
        <mesh geometry={geo.vSkin} material={M.skin} position={[0, 1.366, 0.1205]} rotation={[-0.2, 0, 0]} />
        <mesh geometry={geo.vLace} material={M.lace} />
        {/* arms: kurti sleeves, forearms; a bangle on the right wrist, a watch on the left */}
        {([-1, 1] as const).map((sd) => (
          <group key={sd} ref={sd < 0 ? armL : armR} position={[sd * 0.176, 1.315, 0]}>
            <mesh geometry={geo.sphere} material={M.kurti} scale={S(0.045, 0.04, 0.042)} />
            <mesh geometry={geo.sleeve} material={M.kurti} position={[0, -0.17, 0]} />
            <mesh geometry={geo.cuff} material={M.lace} position={[0, -0.338, 0]} rotation={[Math.PI / 2, 0, 0]} />
            <group ref={sd < 0 ? foreL : foreR} position={[0, -0.29, 0]}>
              <mesh geometry={geo.forearm} material={M.skin} position={[0, -0.12, 0]} />
              <mesh geometry={geo.sphere} material={M.skin} position={[0, -0.3, 0.004]} scale={S(0.026, 0.058, 0.014)} />
              <mesh geometry={geo.sphere} material={M.skin} position={[0, -0.36, 0.006]} scale={S(0.022, 0.034, 0.011)} />
              <mesh geometry={geo.sphere} material={M.skin} position={[-sd * 0.0, -0.29, 0.02]} rotation={[0.3, 0, -sd * 0.4]} scale={S(0.009, 0.026, 0.009)} />
              {/* facing +Z in her own frame, her right side is −X: the bangle goes there, the watch on her left */}
              {sd < 0 ? (
                <mesh geometry={geo.bangle} material={M.gold} position={[0, -0.225, 0]} rotation={[Math.PI / 2, 0, 0]} />
              ) : (
                <group position={[0, -0.215, 0]}>
                  <mesh geometry={geo.strap} material={M.strap} rotation={[Math.PI / 2, 0, 0]} />
                  <mesh geometry={geo.dial} material={M.dial} position={[0, 0, 0.033]} rotation={[Math.PI / 2, 0, 0]} />
                </group>
              )}
            </group>
          </group>
        ))}
        {/* neck and head */}
        <mesh geometry={geo.neck} material={M.skin} position={[0, 1.405, 0]} />
        <group ref={head} position={[0, 1.44, 0.005]}>
          <group position={[0, 0.065, 0]}>
            <mesh geometry={geo.head} material={M.skin} scale={S(0.88, 1.1, 0.95)} />
            {/* ears */}
            {[-1, 1].map((sd) => (
              <mesh key={sd} geometry={geo.sphere} material={M.skin} position={[sd * 0.087, 0, -0.004]} scale={S(0.011, 0.021, 0.01)} />
            ))}
            {/* eyes, with lashes and a little shine */}
            <group ref={eyes} position={[0, 0.01, 0]}>
              {[-1, 1].map((sd) => (
                <group key={sd} position={[sd * 0.034, 0, 0.083]}>
                  <mesh geometry={geo.sphere} material={M.eyeW} scale={S(0.0185, 0.0108, 0.006)} />
                  <mesh geometry={geo.sphere} material={M.iris} position={[0, -0.0005, 0.0045]} scale={S(0.0084, 0.0088, 0.003)} />
                  <mesh geometry={geo.sphere} material={M.shine} position={[0.0026, 0.0026, 0.0078]} scale={S(0.0018, 0.0018, 0.001)} />
                  <mesh geometry={geo.lid} material={M.lash} position={[0, -0.002, 0.0035]} scale={S(1, 0.62, 1)} rotation={[0, 0, sd * 0.06]} />
                </group>
              ))}
            </group>
            {/* brows */}
            {[-1, 1].map((sd) => (
              <mesh key={sd} geometry={geo.lash} material={M.lash} position={[sd * 0.034, 0.036, 0.087]} rotation={[0, 0, -sd * 0.13]} scale={S(0.032, 0.0042, 0.004)} />
            ))}
            {/* lips, softly smiling */}
            <mesh geometry={geo.sphere} material={M.lips} position={[0, -0.048, 0.087]} scale={S(0.019, 0.0055, 0.007)} />
            <mesh ref={mouth} geometry={geo.sphere} material={M.lips} position={[0, -0.057, 0.085]} scale={S(0.016, 0.007, 0.007)} />
            {[-1, 1].map((sd) => (
              <mesh key={sd} geometry={geo.sphere} material={M.lips} position={[sd * 0.019, -0.046, 0.083]} scale={S(0.004, 0.0035, 0.004)} />
            ))}
            {/* a little blush */}
            {[-1, 1].map((sd) => (
              <mesh key={sd} geometry={geo.disc} material={M.blush} position={[sd * 0.05, -0.024, 0.08]} rotation={[0, sd * 0.5, 0]} scale={S(0.017, 0.011, 1)} />
            ))}
            {/* the lavender bindi */}
            <mesh geometry={geo.sphere} material={M.bindi} position={[0, 0.047, 0.096]} scale={S(0.0048, 0.0048, 0.0016)} />
            {/* hair: the crown, the back, and long hair falling past her shoulders */}
            <mesh geometry={geo.hairCap} material={M.hair} position={[0, 0.012, -0.006]} scale={S(0.93, 1.08, 1.0)} rotation={[-0.18, 0, 0]} />
            <mesh geometry={geo.hairBackHead} material={M.hair} position={[0, 0.006, -0.008]} scale={S(0.95, 1.06, 1)} />
            <mesh geometry={geo.strands} material={M.hair} scale={S(0.93, 1.0, 0.98)} position={[0, 0.0, -0.004]} />
          </group>
          <mesh ref={hair} geometry={geo.hairBack} material={M.hair} position={[0, -0.13, -0.022]} />
        </group>
      </group>
    </group>
  );
}
