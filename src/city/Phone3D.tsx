import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { copy } from '../data/copy';
import { damp } from '../lib/ease';
import { env } from '../lib/env';
import { cityClock } from './cityClock';
import { phoneChat } from './phoneChat';

/**
 * Giga's phone, in his right hand, raised in front of his eyes. A real object: rounded body,
 * glass screen that glows onto his fingers, the chat drawn live onto the screen.
 * His thumb rests on the edge and taps the keys while he types.
 */

const PW = 0.072;
const PH = 0.152;
const PD = 0.0085;
const SW = PW - 0.0052;
const SH = PH - 0.0058;
const CW = 720;
const CH = Math.round((CW * SH) / SW);

/* ------------------------------------------------------------------ the screen */

const KEYS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'];

function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

function wrap(g: CanvasRenderingContext2D, text: string, max: number) {
  const words = text.split(' ');
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    const tryLine = line ? `${line} ${w}` : w;
    if (g.measureText(tryLine).width > max && line) {
      lines.push(line);
      line = w;
    } else line = tryLine;
  }
  if (line) lines.push(line);
  return lines;
}

/** Where each key is drawn (so his thumb can reach for it). */
function keyRect(ch: string) {
  const kbTop = CH * 0.64;
  const rowH = (CH - kbTop - 120) / 4;
  for (let r = 0; r < KEYS.length; r++) {
    const i = KEYS[r].indexOf(ch);
    if (i >= 0) {
      const n = KEYS[r].length;
      const kw = (CW - 30) / 10;
      const x0 = (CW - n * kw) / 2;
      return { x: x0 + i * kw, y: kbTop + 16 + r * rowH, w: kw, h: rowH };
    }
  }
  if (ch === ' ') return { x: CW * 0.25, y: kbTop + 16 + 3 * rowH, w: CW * 0.5, h: rowH };
  return null;
}

function drawScreen(g: CanvasRenderingContext2D, dots: number) {
  const s = copy.story;
  // background
  const bg = g.createLinearGradient(0, 0, 0, CH);
  bg.addColorStop(0, '#16111f');
  bg.addColorStop(1, '#0d0a14');
  g.fillStyle = bg;
  g.fillRect(0, 0, CW, CH);
  g.textBaseline = 'middle';
  // status bar
  g.fillStyle = '#e9e4f2';
  g.font = '600 30px system-ui, -apple-system, "Segoe UI", sans-serif';
  g.textAlign = 'left';
  g.fillText(s.phoneTime, 44, 44);
  g.textAlign = 'right';
  g.fillText('▮▮▮  ◔ 76%', CW - 40, 44);
  // header
  g.fillStyle = '#1f1830';
  g.fillRect(0, 84, CW, 120);
  g.fillStyle = '#b9a3ff';
  g.font = '400 44px system-ui, sans-serif';
  g.textAlign = 'left';
  g.fillText('‹', 26, 144);
  const av = g.createLinearGradient(80, 110, 150, 180);
  av.addColorStop(0, '#7b61ff');
  av.addColorStop(1, '#ff7eb6');
  g.fillStyle = av;
  g.beginPath();
  g.arc(112, 144, 36, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#fff';
  g.font = '600 34px system-ui, sans-serif';
  g.textAlign = 'center';
  g.fillText(s.contact[0], 112, 146);
  g.textAlign = 'left';
  g.fillStyle = '#f4f0fa';
  g.font = '600 36px system-ui, sans-serif';
  g.fillText(s.contact, 166, 128);
  g.fillStyle = phoneChat.theirTyping ? '#9fe3b0' : '#a59bb8';
  g.font = '400 26px system-ui, sans-serif';
  g.fillText(phoneChat.theirTyping ? 'typing…' : 'online', 166, 166);

  // keyboard (while he types)
  const typing = phoneChat.draft.length > 0;
  const kbTop = CH * 0.64;
  const inputY = typing ? kbTop - 104 : CH - 140;
  if (typing) {
    g.fillStyle = '#1b1724';
    g.fillRect(0, kbTop, CW, CH - kbTop);
    g.font = '400 34px system-ui, sans-serif';
    g.textAlign = 'center';
    const hot = performance.now() - phoneChat.keyAt < 140 ? phoneChat.key : '';
    for (const row of KEYS) {
      for (const ch of row) {
        const r = keyRect(ch)!;
        g.fillStyle = ch === hot ? '#8f78ff' : '#3a3448';
        roundRect(g, r.x + 4, r.y + 5, r.w - 8, r.h - 10, 10);
        g.fill();
        g.fillStyle = '#ece8f5';
        g.fillText(ch, r.x + r.w / 2, r.y + r.h / 2);
      }
    }
    const sp = keyRect(' ')!;
    g.fillStyle = hot === ' ' ? '#8f78ff' : '#3a3448';
    roundRect(g, sp.x, sp.y + 5, sp.w, sp.h - 10, 10);
    g.fill();
  }

  // messages, newest at the bottom
  g.save();
  g.beginPath();
  g.rect(0, 210, CW, inputY - 220);
  g.clip();
  const maxW = CW * 0.66;
  g.font = '400 36px system-ui, -apple-system, "Segoe UI", sans-serif';
  type Block = { lines: string[]; me: boolean; typing?: boolean };
  const blocks: Block[] = phoneChat.msgs.map((m) => ({ lines: wrap(g, m.text, maxW - 48), me: m.from === 'me' }));
  if (phoneChat.theirTyping) blocks.push({ lines: [''], me: false, typing: true });
  let y = inputY - 34;
  for (let b = blocks.length - 1; b >= 0; b--) {
    const blk = blocks[b];
    const lh = 46;
    const h = blk.typing ? 70 : blk.lines.length * lh + 54;
    const w = blk.typing ? 130 : Math.max(...blk.lines.map((l) => g.measureText(l).width)) + 52;
    const bw = Math.max(w, blk.me ? 150 : 110);
    const x = blk.me ? CW - 28 - bw : 28;
    y -= h;
    g.fillStyle = blk.me ? '#6d4fd8' : '#2a2338';
    roundRect(g, x, y, bw, h, 26);
    g.fill();
    if (blk.typing) {
      for (let k = 0; k < 3; k++) {
        const up = Math.max(0, Math.sin(dots * 2 - k * 0.9));
        g.fillStyle = `rgba(230,222,245,${0.45 + 0.5 * up})`;
        g.beginPath();
        g.arc(x + 38 + k * 28, y + h / 2 - up * 6, 8, 0, Math.PI * 2);
        g.fill();
      }
    } else {
      g.fillStyle = '#f7f4fc';
      g.textAlign = 'left';
      blk.lines.forEach((l, i) => g.fillText(l, x + 24, y + 30 + lh / 2 + i * lh - 6));
      g.fillStyle = blk.me ? 'rgba(235,228,255,0.75)' : 'rgba(200,190,220,0.7)';
      g.font = '400 22px system-ui, sans-serif';
      g.textAlign = 'right';
      g.fillText(blk.me ? `${copy.story.phoneTime.replace(' PM', '')} ✓✓` : copy.story.phoneTime.replace(' PM', ''), x + bw - 18, y + h - 20);
      g.font = '400 36px system-ui, -apple-system, "Segoe UI", sans-serif';
    }
    y -= 18;
  }
  // the day chip
  g.fillStyle = 'rgba(60,50,80,0.8)';
  roundRect(g, CW / 2 - 64, Math.min(y - 60, 240), 128, 44, 22);
  g.fill();
  g.fillStyle = '#cfc6e2';
  g.font = '500 24px system-ui, sans-serif';
  g.textAlign = 'center';
  g.fillText(s.chatDay, CW / 2, Math.min(y - 60, 240) + 23);
  g.restore();

  // the input box
  g.fillStyle = '#231d30';
  roundRect(g, 24, inputY, CW - 140, 86, 43);
  g.fill();
  g.textAlign = 'left';
  g.font = '400 34px system-ui, sans-serif';
  if (typing) {
    g.fillStyle = '#f4f0fa';
    // show the end of a long draft
    let d = phoneChat.draft;
    while (g.measureText(d).width > CW - 210 && d.length > 1) d = d.slice(1);
    g.fillText(d, 56, inputY + 44);
    if (Math.floor(performance.now() / 480) % 2 === 0) g.fillRect(58 + g.measureText(d).width, inputY + 24, 3, 40);
  } else {
    g.fillStyle = '#6f6683';
    g.fillText('Message', 56, inputY + 44);
  }
  g.fillStyle = typing ? '#8f78ff' : '#3a3448';
  g.beginPath();
  g.arc(CW - 64, inputY + 43, 40, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#fff';
  g.font = '600 34px system-ui, sans-serif';
  g.textAlign = 'center';
  g.fillText('➤', CW - 62, inputY + 45);
}

/* ------------------------------------------------------------------ the hand */

const UPV = new THREE.Vector3(0, 1, 0);

/** A rounded segment from a to b (a finger bone, a thumb, a wrist). */
function bone(a: THREE.Vector3, b: THREE.Vector3, r: number, mat: THREE.Material) {
  const len = a.distanceTo(b);
  const geo = new THREE.CapsuleGeometry(r, Math.max(0.0001, len), 6, 14);
  const m = new THREE.Mesh(geo, mat);
  m.position.copy(a).add(b).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(UPV, b.clone().sub(a).normalize());
  return m;
}

const v3 = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

export function Phone3D() {
  const res = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = CW;
    canvas.height = CH;
    const ctx = canvas.getContext('2d')!;
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    const screen = new THREE.MeshBasicMaterial({ map: tex, toneMapped: false });
    const body = new THREE.MeshStandardMaterial({ color: '#101016', roughness: 0.28, metalness: 0.75 });
    const glassEdge = new THREE.MeshStandardMaterial({ color: '#050508', roughness: 0.1, metalness: 0.2 });
    const skin = new THREE.MeshStandardMaterial({ color: '#a8714f', roughness: 0.7, metalness: 0 });
    const nail = new THREE.MeshStandardMaterial({ color: '#b98a74', roughness: 0.4 });
    const sleeve = new THREE.MeshStandardMaterial({ color: '#1d1a26', roughness: 0.95 });
    const bodyGeo = new RoundedBoxGeometry(PW, PH, PD, 4, 0.0095);
    // the screen: a rounded rectangle, its UVs spanning the canvas
    const shape = new THREE.Shape();
    const r0 = 0.0068;
    shape.moveTo(-SW / 2 + r0, -SH / 2);
    shape.lineTo(SW / 2 - r0, -SH / 2);
    shape.quadraticCurveTo(SW / 2, -SH / 2, SW / 2, -SH / 2 + r0);
    shape.lineTo(SW / 2, SH / 2 - r0);
    shape.quadraticCurveTo(SW / 2, SH / 2, SW / 2 - r0, SH / 2);
    shape.lineTo(-SW / 2 + r0, SH / 2);
    shape.quadraticCurveTo(-SW / 2, SH / 2, -SW / 2, SH / 2 - r0);
    shape.lineTo(-SW / 2, -SH / 2 + r0);
    shape.quadraticCurveTo(-SW / 2, -SH / 2, -SW / 2 + r0, -SH / 2);
    const screenGeo = new THREE.ShapeGeometry(shape, 6);
    const sp = screenGeo.getAttribute('position');
    const suv = screenGeo.getAttribute('uv');
    for (let i = 0; i < sp.count; i++) suv.setXY(i, sp.getX(i) / SW + 0.5, sp.getY(i) / SH + 0.5);

    // the right hand, around the phone (phone-local metres: x right, y up, z toward his eyes)
    const hand = new THREE.Group();
    const palm = new THREE.Mesh(new RoundedBoxGeometry(0.084, 0.092, 0.03, 4, 0.012), skin);
    palm.position.set(0.012, -0.062, -0.024);
    palm.rotation.z = -0.12;
    hand.add(palm);
    // four fingers curl round the left edge; their tips show on the front
    const fy = [-0.006, -0.03, -0.054, -0.076];
    const fr = [0.0082, 0.008, 0.0076, 0.0068];
    fy.forEach((y, i) => {
      const a = v3(-0.012, y - 0.004, -0.02);
      const b = v3(-0.0385, y, -0.009);
      const c = v3(-0.0362, y + 0.004, 0.0062);
      hand.add(bone(a, b, fr[i], skin));
      hand.add(bone(b, c, fr[i] * 0.92, skin));
      const n = new THREE.Mesh(new THREE.SphereGeometry(fr[i] * 0.55, 10, 8), nail);
      n.position.copy(c).add(v3(0.0012, 0.0015, fr[i] * 0.62));
      n.scale.set(1, 1.15, 0.3);
      hand.add(n);
    });
    // wrist and forearm, out of the bottom of the view, into a dark sleeve
    hand.add(bone(v3(0.022, -0.1, -0.03), v3(0.07, -0.26, 0.03), 0.027, skin));
    const sl = bone(v3(0.058, -0.21, 0.012), v3(0.12, -0.42, 0.1), 0.045, sleeve);
    hand.add(sl);
    // the thumb (moves while typing)
    // (unit-length cylinders stretched to fit each frame, with round joints)
    const thumbBase = new THREE.Mesh(new THREE.CylinderGeometry(0.0108, 0.0112, 1, 14, 1, true), skin);
    const thumbTip = new THREE.Mesh(new THREE.CylinderGeometry(0.0094, 0.0104, 1, 14, 1, true), skin);
    const joints = [0.0112, 0.0106, 0.0094].map((r) => new THREE.Mesh(new THREE.SphereGeometry(r, 14, 10), skin));
    hand.add(thumbBase, thumbTip, ...joints);
    const thumbNail = new THREE.Mesh(new THREE.SphereGeometry(0.0068, 10, 8), nail);
    thumbNail.scale.set(1, 1.25, 0.35);
    hand.add(thumbNail);

    return { canvas, ctx, tex, screen, body, glassEdge, skin, nail, sleeve, bodyGeo, screenGeo, hand, thumbBase, thumbTip, thumbNail, joints };
  }, []);
  useEffect(
    () => () => {
      res.tex.dispose();
      [res.screen, res.body, res.glassEdge, res.skin, res.nail, res.sleeve, res.bodyGeo, res.screenGeo].forEach((x) => x.dispose());
      res.hand.traverse((o) => (o as THREE.Mesh).geometry?.dispose());
    },
    [res],
  );

  const group = useRef<THREE.Group>(null);
  const drawn = useRef({ v: -1, dots: -1 });
  const thumb = useRef({ x: 0.03, y: -0.032, z: 0.0 });
  const tmp = useMemo(() => ({ off: new THREE.Vector3(), q: new THREE.Quaternion(), e: new THREE.Euler() }), []);

  useFrame(({ camera, size, clock }, delta) => {
    const g = group.current;
    if (!g) return;
    const dt = Math.min(delta, 0.1);
    cityClock.phone += (cityClock.phoneTarget - cityClock.phone) * damp(cityClock.phoneTarget > cityClock.phone ? 3.2 : 2.6, dt);
    const k = cityClock.phone;
    g.visible = k > 0.004;
    if (!g.visible) return;

    // redraw the screen when something changed (and for the typing dots / caret)
    const animating = phoneChat.theirTyping || phoneChat.draft.length > 0;
    const dots = animating ? Math.floor(clock.elapsedTime * 8) : 0;
    if (drawn.current.v !== phoneChat.version || drawn.current.dots !== dots) {
      drawScreen(res.ctx, clock.elapsedTime * 4);
      res.tex.needsUpdate = true;
      drawn.current = { v: phoneChat.version, dots };
    }

    // place it in front of his eyes: big enough to read, a little low, tilted toward him
    const cam = camera as THREE.PerspectiveCamera;
    const aspect = size.width / Math.max(1, size.height);
    const tanH = Math.tan((cam.fov * Math.PI) / 360);
    // how far away it is so the phone fills ~70% of the height (or of the width, on a tall phone screen)
    const byH = PH / (0.7 * 2 * tanH);
    const byW = PW / (0.74 * 2 * tanH * aspect);
    const dist = Math.max(byH, byW);
    const ease = k * k * (3 - 2 * k);
    const breathe = env.reducedMotion ? 0 : Math.sin(clock.elapsedTime * 1.3) * 0.0012;
    tmp.off.set(0.004 * (1 - ease), -0.012 * dist / 0.2 - (1 - ease) * 0.32 + breathe, -dist - (1 - ease) * 0.05);
    tmp.off.applyQuaternion(camera.quaternion);
    g.position.copy(camera.position).add(tmp.off);
    tmp.e.set(-0.1 - (1 - ease) * 0.9, 0.0, 0.035 + (1 - ease) * 0.25);
    tmp.q.setFromEuler(tmp.e);
    g.quaternion.copy(camera.quaternion).multiply(tmp.q);

    // the thumb: resting on the right edge, or reaching for the key being typed
    const typing = phoneChat.draft.length > 0;
    let tx = 0.03;
    let ty = -0.032;
    let tz = 0.0;
    if (typing && phoneChat.key) {
      const r = keyRect(phoneChat.key);
      if (r) {
        tx = ((r.x + r.w / 2) / CW - 0.5) * SW;
        ty = (0.5 - (r.y + r.h / 2) / CH) * SH;
        const since = performance.now() - phoneChat.keyAt;
        tz = since < 90 ? 0 : 0.006;
      }
    }
    const th = thumb.current;
    const kk = damp(18, dt);
    th.x += (tx - th.x) * kk;
    th.y += (ty - th.y) * kk;
    th.z += (tz - th.z) * damp(30, dt);
    const tip = v3(th.x + 0.004, th.y - 0.004, PD / 2 + 0.0085 + th.z);
    const joint = v3(0.046 + (th.x - 0.03) * 0.35, -0.06 + (th.y + 0.032) * 0.4, 0.001 + th.z * 0.5);
    const root = v3(0.044, -0.088, -0.016);
    const place = (m: THREE.Mesh, a: THREE.Vector3, b: THREE.Vector3) => {
      m.position.copy(a).add(b).multiplyScalar(0.5);
      m.quaternion.setFromUnitVectors(UPV, b.clone().sub(a).normalize());
      m.scale.set(1, a.distanceTo(b), 1);
    };
    place(res.thumbBase, root, joint);
    place(res.thumbTip, joint, tip);
    res.joints[0].position.copy(root);
    res.joints[1].position.copy(joint);
    res.joints[2].position.copy(tip);
    res.thumbNail.position.copy(tip).add(v3(-0.001, 0.004, 0.006));
    res.thumbNail.quaternion.copy(res.thumbTip.quaternion);
  });

  return (
    <group ref={group} visible={false}>
      <mesh geometry={res.bodyGeo} material={res.body} />
      <mesh geometry={res.screenGeo} material={res.screen} position={[0, 0, PD / 2 + 0.0002]} />
      <primitive object={res.hand} />
      {/* the screen's glow on his fingers */}
      <pointLight position={[0, -0.01, 0.06]} color="#cfd6ff" intensity={0.012} distance={0.3} decay={2} />
    </group>
  );
}
