import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { env } from '../lib/env';
import { journeyClock } from './clock';
import { ET, WELCOME } from './earthTimeline';

/**
 * Little original space creatures who come along for the planets' welcome: they float
 * near the edges of the view (never over the planets), bob, wave whenever a planet says hi,
 * and leave soft glowing trails behind them.
 */

type Kind = 'blip' | 'jelly' | 'twinkle' | 'mochi';

function paint(kind: Kind) {
  const S = 256;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d')!;
  const cx = S / 2;
  const cy = S / 2 + 8;
  const glow = (col: string, r: number) => {
    const gr = g.createRadialGradient(cx, cy, 0, cx, cy, r);
    gr.addColorStop(0, col);
    gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, S, S);
  };
  const face = (y: number, spread: number, size: number) => {
    for (const s of [-1, 1]) {
      g.fillStyle = '#2a1840';
      g.beginPath();
      g.ellipse(cx + s * spread, y, size * 0.8, size, 0, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#ffffff';
      g.beginPath();
      g.arc(cx + s * spread + size * 0.3, y - size * 0.4, size * 0.32, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = 'rgba(255,130,170,0.55)';
      g.beginPath();
      g.ellipse(cx + s * (spread + size * 1.6), y + size * 1.4, size * 0.9, size * 0.5, 0, 0, Math.PI * 2);
      g.fill();
    }
    g.strokeStyle = '#2a1840';
    g.lineWidth = 4;
    g.lineCap = 'round';
    g.beginPath();
    g.arc(cx, y + size * 1.2, size * 0.7, 0.2 * Math.PI, 0.8 * Math.PI);
    g.stroke();
  };
  const body = (path: () => void, a: string, b: string) => {
    const gr = g.createRadialGradient(cx - 20, cy - 26, 6, cx, cy, 90);
    gr.addColorStop(0, a);
    gr.addColorStop(1, b);
    g.fillStyle = gr;
    path();
    g.fill();
  };
  if (kind === 'blip') {
    glow('rgba(180,150,255,0.55)', 120);
    g.strokeStyle = '#cdb8ff';
    g.lineWidth = 5;
    g.beginPath();
    g.moveTo(cx, cy - 52);
    g.quadraticCurveTo(cx + 10, cy - 80, cx + 4, cy - 92);
    g.stroke();
    glow('rgba(0,0,0,0)', 1);
    g.fillStyle = '#ff9ad5';
    g.beginPath();
    g.arc(cx + 4, cy - 96, 10, 0, Math.PI * 2);
    g.fill();
    body(() => {
      g.beginPath();
      g.arc(cx, cy, 56, 0, Math.PI * 2);
    }, '#efe6ff', '#9b7cf2');
    face(cy - 4, 20, 9);
  } else if (kind === 'jelly') {
    glow('rgba(130,230,255,0.5)', 120);
    g.strokeStyle = 'rgba(160,235,255,0.85)';
    g.lineWidth = 6;
    for (let i = -2; i <= 2; i++) {
      g.beginPath();
      g.moveTo(cx + i * 16, cy + 10);
      g.bezierCurveTo(cx + i * 16 + 10, cy + 40, cx + i * 16 - 10, cy + 60, cx + i * 18, cy + 86);
      g.stroke();
    }
    body(() => {
      g.beginPath();
      g.moveTo(cx - 54, cy + 14);
      g.bezierCurveTo(cx - 60, cy - 70, cx + 60, cy - 70, cx + 54, cy + 14);
      g.quadraticCurveTo(cx, cy + 26, cx - 54, cy + 14);
    }, '#e9fbff', '#5fc8ee');
    face(cy - 18, 18, 8);
  } else if (kind === 'twinkle') {
    glow('rgba(255,225,150,0.6)', 120);
    body(() => {
      g.beginPath();
      for (let i = 0; i < 10; i++) {
        const r = i % 2 ? 30 : 64;
        const a = -Math.PI / 2 + (i * Math.PI) / 5;
        const x = cx + Math.cos(a) * r;
        const y = cy + Math.sin(a) * r;
        if (i) g.lineTo(x, y);
        else g.moveTo(x, y);
      }
      g.closePath();
      g.lineJoin = 'round';
    }, '#fffbe6', '#ffc95c');
    face(cy + 2, 14, 7);
  } else {
    glow('rgba(255,170,210,0.55)', 120);
    // little ears
    g.fillStyle = '#ffc2dd';
    for (const s of [-1, 1]) {
      g.beginPath();
      g.ellipse(cx + s * 34, cy - 44, 14, 18, s * 0.4, 0, Math.PI * 2);
      g.fill();
    }
    body(() => {
      g.beginPath();
      g.ellipse(cx, cy, 64, 50, 0, 0, Math.PI * 2);
    }, '#fff0f7', '#f58fbd');
    face(cy - 4, 22, 8);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Where each one hangs out, as a fraction of the half-screen (corners, away from the planets). */
const SPOTS: { kind: Kind; fx: number; fy: number; color: string; phase: number }[] = [
  { kind: 'twinkle', fx: -0.82, fy: 0.6, color: '#ffd98a', phase: 0 },
  { kind: 'jelly', fx: 0.82, fy: 0.56, color: '#8fe6ff', phase: 1.7 },
  { kind: 'blip', fx: -0.8, fy: -0.56, color: '#c3a8ff', phase: 3.1 },
  { kind: 'mochi', fx: 0.8, fy: -0.6, color: '#ffa8cf', phase: 4.4 },
];
const TRAIL = 26;
const DEPTH = 3;

export function CosmicCreatures() {
  const res = useMemo(() => {
    const items = SPOTS.map((s) => {
      const map = paint(s.kind);
      const mat = new THREE.SpriteMaterial({ map, transparent: true, depthTest: false, depthWrite: false });
      const pos = new Float32Array(TRAIL * 3);
      const fade = new Float32Array(TRAIL);
      for (let i = 0; i < TRAIL; i++) fade[i] = 1 - i / TRAIL;
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      geo.setAttribute('aFade', new THREE.BufferAttribute(fade, 1));
      const trailMat = new THREE.ShaderMaterial({
        uniforms: { uColor: { value: new THREE.Color(s.color) }, uSize: { value: 26 }, uOpacity: { value: 0 } },
        vertexShader: /* glsl */ `
          attribute float aFade;
          uniform float uSize;
          varying float vFade;
          void main() {
            vFade = aFade;
            vec4 mv = modelViewMatrix * vec4(position, 1.0);
            gl_PointSize = uSize * aFade * (3.0 / max(-mv.z, 0.1));
            gl_Position = projectionMatrix * mv;
          }
        `,
        fragmentShader: /* glsl */ `
          uniform vec3 uColor;
          uniform float uOpacity;
          varying float vFade;
          void main() {
            float r = length(gl_PointCoord - 0.5) * 2.0;
            float a = exp(-r * r * 4.0) * vFade * vFade * uOpacity;
            gl_FragColor = vec4(uColor * a, a);
          }
        `,
        transparent: true,
        depthTest: false,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      return { ...s, map, mat, geo, pos, trailMat, filled: false };
    });
    return items;
  }, []);
  useEffect(
    () => () =>
      res.forEach((r) => {
        r.map.dispose();
        r.mat.dispose();
        r.geo.dispose();
        r.trailMat.dispose();
      }),
    [res],
  );

  const group = useRef<THREE.Group>(null);
  const sprites = useRef<(THREE.Sprite | null)[]>([]);
  const tmp = useMemo(() => new THREE.Vector3(), []);

  useFrame(({ camera, size, clock }) => {
    const g = group.current;
    if (!g) return;
    const t = journeyClock.t;
    // they arrive with the first planet and leave after the "psst"
    const k = Math.min(1, Math.max(0, (t - (ET.exploreFrom - 0.5)) / 1.5)) * (1 - Math.min(1, Math.max(0, (t - ET.psstTo) / 1.5)));
    g.visible = k > 0.001;
    if (!g.visible) return;
    g.position.copy(camera.position);
    g.quaternion.copy(camera.quaternion);
    const cam = camera as THREE.PerspectiveCamera;
    const halfH = DEPTH * Math.tan((cam.fov * Math.PI) / 360);
    const aspect = size.width / Math.max(1, size.height);
    const halfW = halfH * aspect;
    const portrait = aspect < 1;
    // someone is saying hi right now: everyone waves
    const waving = WELCOME.some((w) => t >= w.from && t < w.from + 1.4);
    const time = clock.elapsedTime;
    const calm = env.reducedMotion;
    res.forEach((r, i) => {
      const sp = sprites.current[i];
      if (!sp) return;
      const ease = k * k * (3 - 2 * k);
      // float in from just outside the edges
      const fx = r.fx * (portrait ? 0.72 : 1) * (1 + (1 - ease) * 0.6);
      const fy = r.fy * (portrait ? 0.78 : 1) * (1 + (1 - ease) * 0.4);
      const bob = calm ? 0 : Math.sin(time * 1.3 + r.phase) * 0.06;
      const wander = calm ? 0 : Math.sin(time * 0.45 + r.phase * 2) * 0.12;
      const hop = waving && !calm ? Math.abs(Math.sin(time * 7 + r.phase)) * 0.08 : 0;
      tmp.set(fx * halfW + wander, fy * halfH + bob + hop, -DEPTH);
      sp.position.copy(tmp);
      const s = (portrait ? 0.42 : 0.56) * (0.9 + 0.1 * ease);
      sp.scale.set(s, s, 1);
      r.mat.opacity = ease;
      r.mat.rotation = waving && !calm ? Math.sin(time * 9 + r.phase) * 0.22 : Math.sin(time * 0.8 + r.phase) * 0.06;
      // the trail: where it has just been, fading
      if (!r.filled) {
        for (let j = 0; j < TRAIL; j++) r.pos.set([tmp.x, tmp.y, tmp.z], j * 3);
        r.filled = true;
      }
      r.pos.copyWithin(3, 0, (TRAIL - 1) * 3);
      r.pos.set([tmp.x, tmp.y - s * 0.12, tmp.z - 0.01], 0);
      // a gentle drift backward, so the trail streams away behind them
      for (let j = 1; j < TRAIL; j++) {
        r.pos[j * 3] += (r.fx > 0 ? 1 : -1) * 0.004;
        r.pos[j * 3 + 1] -= 0.002;
      }
      (r.geo.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
      r.trailMat.uniforms.uOpacity.value = 0.7 * ease;
      r.trailMat.uniforms.uSize.value = 26 * (size.height / 900) * (window.devicePixelRatio || 1);
    });
  });

  return (
    <group ref={group} visible={false}>
      {res.map((r, i) => (
        <group key={r.kind}>
          <points geometry={r.geo} material={r.trailMat} frustumCulled={false} renderOrder={40} />
          <sprite ref={(el) => (sprites.current[i] = el)} material={r.mat} renderOrder={41} />
        </group>
      ))}
    </group>
  );
}
