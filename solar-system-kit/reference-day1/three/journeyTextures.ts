import * as THREE from 'three';

/** Small procedural sprites for the journey (generated once, cached). */

let softDot: THREE.Texture | null = null;
export function getSoftDot() {
  if (softDot) return softDot;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.25, 'rgba(255,255,255,0.7)');
  grad.addColorStop(0.6, 'rgba(255,255,255,0.15)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  softDot = new THREE.CanvasTexture(c);
  softDot.colorSpace = THREE.SRGBColorSpace;
  return softDot;
}

const clouds: THREE.Texture[] = [];
/** Soft, lumpy cloud puffs (white; tinted by the sprite colour). */
export function getCloud(variant: number) {
  const i = variant % 3;
  if (clouds[i]) return clouds[i];
  const size = 256;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d')!;
  let seed = 17 + i * 31;
  const rnd = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  g.globalCompositeOperation = 'lighter';
  for (let k = 0; k < 42; k++) {
    const a = rnd() * Math.PI * 2;
    const d = Math.pow(rnd(), 0.8) * size * 0.28;
    const x = size / 2 + Math.cos(a) * d;
    const y = size / 2 + Math.sin(a) * d * 0.7;
    const r = size * (0.08 + rnd() * 0.2);
    const grad = g.createRadialGradient(x, y, 0, x, y, r);
    const alpha = 0.05 + rnd() * 0.07;
    grad.addColorStop(0, `rgba(255,255,255,${alpha})`);
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, size, size);
  }
  // Fade the square's edges completely.
  g.globalCompositeOperation = 'destination-in';
  const mask = g.createRadialGradient(size / 2, size / 2, size * 0.2, size / 2, size / 2, size / 2);
  mask.addColorStop(0, 'rgba(0,0,0,1)');
  mask.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = mask;
  g.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  clouds[i] = tex;
  return tex;
}

/** An irregular rock: a subdivided icosahedron pushed in and out by smooth noise. */
export function makeRockGeometry(seed = 1, detail = 1) {
  const g = new THREE.IcosahedronGeometry(1, detail);
  const pos = g.attributes.position;
  const v = new THREE.Vector3();
  const s = seed * 12.9898;
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).normalize();
    const n =
      Math.sin(v.x * 3.1 + s) * 0.18 +
      Math.sin(v.y * 4.3 + s * 1.7) * 0.14 +
      Math.sin(v.z * 5.7 + s * 0.6) * 0.1 +
      Math.sin((v.x + v.y) * 9.1 + s) * 0.05;
    v.multiplyScalar(1 + n);
    v.y *= 0.82;
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  return g;
}
