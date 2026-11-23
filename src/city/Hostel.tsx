import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { copy } from '../data/copy';
import { CT, cityClock } from './cityClock';
import { HOSTEL, HOSTEL_H } from './cityLayout';
import { makeFacadeMaterial } from './cityMaterials';

/**
 * Richa's hostel: a five-storey building set back behind a low wall and a gate,
 * a lit canopy over glass doors, a warm lobby behind them, the sign above, plants, trees.
 * The doors slide open when she comes out.
 */

export const LOBBY_DEPTH = 2.2;
export const PLINTH = 0.45;

function lobbyTexture() {
  const W = 512;
  const H = 384;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d')!;
  const bg = g.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#f6d9b4');
  bg.addColorStop(0.65, '#e9b98a');
  bg.addColorStop(1, '#9c6c4c');
  g.fillStyle = bg;
  g.fillRect(0, 0, W, H);
  // a reception counter, a notice board, a plant, a ceiling lamp's pool of light
  g.fillStyle = '#6b4a3a';
  g.fillRect(W * 0.52, H * 0.58, W * 0.36, H * 0.2);
  g.fillStyle = '#8b6450';
  g.fillRect(W * 0.52, H * 0.56, W * 0.36, H * 0.03);
  g.fillStyle = '#c9b49a';
  g.fillRect(W * 0.12, H * 0.25, W * 0.22, H * 0.24);
  g.fillStyle = 'rgba(255,255,255,0.55)';
  for (let i = 0; i < 6; i++) g.fillRect(W * (0.14 + (i % 3) * 0.065), H * (0.28 + Math.floor(i / 3) * 0.1), W * 0.05, H * 0.07);
  g.fillStyle = '#3f6b45';
  g.beginPath();
  g.ellipse(W * 0.42, H * 0.6, W * 0.05, H * 0.12, 0, 0, Math.PI * 2);
  g.fill();
  const pool = g.createRadialGradient(W * 0.5, 0, 0, W * 0.5, 0, H * 0.8);
  pool.addColorStop(0, 'rgba(255,248,230,0.7)');
  pool.addColorStop(1, 'rgba(255,248,230,0)');
  g.fillStyle = pool;
  g.fillRect(0, 0, W, H);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function signTexture(text: string) {
  const W = 1024;
  const H = 200;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d')!;
  g.clearRect(0, 0, W, H);
  g.font = '600 120px "Trebuchet MS", system-ui, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.shadowColor = 'rgba(255,214,160,0.9)';
  g.shadowBlur = 26;
  g.fillStyle = '#fff3e0';
  // letter-spaced
  const letters = text.split('');
  const gap = 108;
  letters.forEach((ch, i) => g.fillText(ch, W / 2 + (i - (letters.length - 1) / 2) * gap, H / 2 + 4));
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function pavingTexture() {
  const S = 256;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d')!;
  g.fillStyle = '#6e6670';
  g.fillRect(0, 0, S, S);
  g.strokeStyle = 'rgba(30,26,34,0.6)';
  g.lineWidth = 3;
  for (let i = 0; i <= 4; i++) {
    g.beginPath();
    g.moveTo(0, (i * S) / 4);
    g.lineTo(S, (i * S) / 4);
    g.stroke();
    g.beginPath();
    g.moveTo((i * S) / 4, 0);
    g.lineTo((i * S) / 4, S);
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(14, 3);
  return t;
}

export function Hostel() {
  const res = useMemo(() => {
    const facade = makeFacadeMaterial();
    const box = new THREE.BoxGeometry(1, 1, 1);
    box.translate(0, 0.5, 0);
    const F = HOSTEL.front;
    const parts = [
      // the main block behind the lobby, and the two front wings either side of it
      { x: HOSTEL.x, z: F + LOBBY_DEPTH + (HOSTEL.depth - LOBBY_DEPTH) / 2, w: HOSTEL.halfW * 2, d: HOSTEL.depth - LOBBY_DEPTH },
      { x: HOSTEL.x - 7.7, z: F + LOBBY_DEPTH / 2, w: 10.6, d: LOBBY_DEPTH },
      { x: HOSTEL.x + 7.7, z: F + LOBBY_DEPTH / 2, w: 10.6, d: LOBBY_DEPTH },
    ];
    const mesh = new THREE.InstancedMesh(box, facade, parts.length);
    const m = new THREE.Matrix4();
    parts.forEach((p, i) => mesh.setMatrixAt(i, m.makeScale(p.w, HOSTEL_H, p.d).setPosition(p.x, 0, p.z)));
    box.setAttribute('aSeed', new THREE.InstancedBufferAttribute(new Float32Array([41.3, 41.3, 41.3]), 1));
    box.setAttribute('aKind', new THREE.InstancedBufferAttribute(new Float32Array([3, 3, 3]), 1));
    box.setAttribute('aAccent', new THREE.InstancedBufferAttribute(new Float32Array(9), 3));

    const stone = new THREE.MeshStandardMaterial({ color: '#d8cbbb', roughness: 0.85 });
    const darkStone = new THREE.MeshStandardMaterial({ color: '#5d5560', roughness: 0.8 });
    const wallMat = new THREE.MeshStandardMaterial({ color: '#cfc2b4', roughness: 0.9 });
    const lobby = new THREE.MeshBasicMaterial({ map: lobbyTexture(), color: new THREE.Color(1, 1, 1).multiplyScalar(1.15) });
    const lobbyFloor = new THREE.MeshStandardMaterial({ color: '#b89574', roughness: 0.4, emissive: '#3a2412', emissiveIntensity: 0.6 });
    const ceilingPanel = new THREE.MeshBasicMaterial({ color: new THREE.Color('#fff2dc').multiplyScalar(2.2) });
    const glass = new THREE.MeshPhysicalMaterial({
      color: '#c9d8e6',
      roughness: 0.08,
      metalness: 0.1,
      transparent: true,
      opacity: 0.28,
      depthWrite: false,
    });
    const frame = new THREE.MeshStandardMaterial({ color: '#2a2a30', roughness: 0.4, metalness: 0.8 });
    const downlight = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffe2b8').multiplyScalar(3) });
    const globe = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffe9c9').multiplyScalar(2.4) });
    const sign = new THREE.MeshBasicMaterial({ map: signTexture(copy.story.hostelSign), transparent: true, depthWrite: false, color: new THREE.Color(1, 1, 1).multiplyScalar(1.6) });
    const paving = new THREE.MeshStandardMaterial({ map: pavingTexture(), roughness: 0.75 });
    const pot = new THREE.MeshStandardMaterial({ color: '#7a5a48', roughness: 0.8 });
    const leaf = new THREE.MeshStandardMaterial({ color: '#3f6b40', roughness: 0.85 });
    const bark = new THREE.MeshStandardMaterial({ color: '#3a2c24', roughness: 0.95 });
    return { facade, box, mesh, stone, darkStone, wallMat, lobby, lobbyFloor, ceilingPanel, glass, frame, downlight, globe, sign, paving, pot, leaf, bark };
  }, []);
  useEffect(
    () => () =>
      Object.values(res).forEach((x) => {
        if (x instanceof THREE.Material) {
          const map = (x as THREE.MeshBasicMaterial).map;
          map?.dispose();
        }
        (x as { dispose?: () => void }).dispose?.();
      }),
    [res],
  );

  const left = useRef<THREE.Mesh>(null);
  const right = useRef<THREE.Mesh>(null);
  useFrame(() => {
    // the doors slide open as she comes out, and close behind her
    const t = cityClock.t;
    const o = Math.min(1, Math.max(0, (t - CT.doorOpen) / 1.1)) * (1 - Math.min(1, Math.max(0, (t - (CT.richaOut + 3.6)) / 1.4)));
    const e = o * o * (3 - 2 * o);
    if (left.current) left.current.position.x = HOSTEL.x - 0.62 - e * 1.1;
    if (right.current) right.current.position.x = HOSTEL.x + 0.62 + e * 1.1;
  });

  const F = HOSTEL.front;
  const X = HOSTEL.x;
  const lobbyW = 4.8;
  const lobbyH = 3.4;
  return (
    <group>
      <primitive object={res.mesh} />
      {/* the stone entrance bay above the lobby, with the sign */}
      <mesh position={[X, lobbyH + (HOSTEL_H + 0.6 - lobbyH) / 2, F + LOBBY_DEPTH / 2]} material={res.stone}>
        <boxGeometry args={[lobbyW, HOSTEL_H + 0.6 - lobbyH, LOBBY_DEPTH]} />
      </mesh>
      <mesh position={[X, lobbyH + 1.35, F - 0.03]} rotation={[0, Math.PI, 0]} material={res.sign}>
        <planeGeometry args={[4.4, 0.86]} />
      </mesh>
      {/* the lobby: back wall, ceiling light, floor, side walls */}
      <mesh position={[X, PLINTH + (lobbyH - PLINTH) / 2, F + LOBBY_DEPTH - 0.01]} rotation={[0, Math.PI, 0]} material={res.lobby}>
        <planeGeometry args={[lobbyW, lobbyH - PLINTH]} />
      </mesh>
      <mesh position={[X, lobbyH - 0.01, F + LOBBY_DEPTH / 2]} rotation={[Math.PI / 2, 0, 0]} material={res.stone}>
        <planeGeometry args={[lobbyW, LOBBY_DEPTH]} />
      </mesh>
      <mesh position={[X, lobbyH - 0.03, F + LOBBY_DEPTH / 2]} rotation={[Math.PI / 2, 0, 0]} material={res.ceilingPanel}>
        <planeGeometry args={[1.6, 0.9]} />
      </mesh>
      <mesh position={[X, PLINTH, F + LOBBY_DEPTH / 2]} rotation={[-Math.PI / 2, 0, 0]} material={res.lobbyFloor}>
        <planeGeometry args={[lobbyW, LOBBY_DEPTH]} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[X + (s * lobbyW) / 2, lobbyH / 2, F + LOBBY_DEPTH / 2]} rotation={[0, -s * (Math.PI / 2), 0]} material={res.wallMat}>
          <planeGeometry args={[LOBBY_DEPTH, lobbyH]} />
        </mesh>
      ))}
      <pointLight position={[X, lobbyH - 0.4, F + LOBBY_DEPTH / 2]} color="#ffe2bd" intensity={6} distance={7} decay={2} />

      {/* plinth and steps */}
      <mesh position={[X, PLINTH / 2, F - 0.3]} material={res.darkStone}>
        <boxGeometry args={[HOSTEL.halfW * 2, PLINTH, 0.6]} />
      </mesh>
      {[0, 1, 2].map((i) => (
        <mesh key={i} position={[X, ((PLINTH / 3) * (i + 1)) / 2 - 0.001, F - 0.6 - (2 - i) * 0.34 - 0.17]} material={res.stone}>
          <boxGeometry args={[3.6, (PLINTH / 3) * (i + 1), 0.34]} />
        </mesh>
      ))}

      {/* glass doors in a dark frame */}
      <mesh ref={left} position={[X - 0.62, PLINTH + 1.28, F - 0.02]} material={res.glass}>
        <boxGeometry args={[1.2, 2.5, 0.03]} />
      </mesh>
      <mesh ref={right} position={[X + 0.62, PLINTH + 1.28, F - 0.02]} material={res.glass}>
        <boxGeometry args={[1.2, 2.5, 0.03]} />
      </mesh>
      <mesh position={[X, PLINTH + 2.6, F - 0.03]} material={res.frame}>
        <boxGeometry args={[lobbyW, 0.16, 0.08]} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[X + s * 2.38, PLINTH + 1.3, F - 0.03]} material={res.frame}>
          <boxGeometry args={[0.1, 2.6, 0.08]} />
        </mesh>
      ))}

      {/* the canopy and its warm downlights */}
      <mesh position={[X, lobbyH + 0.1, F - 0.9]} material={res.stone}>
        <boxGeometry args={[5.8, 0.2, 1.9]} />
      </mesh>
      {[-1.3, 1.3].map((dx) => (
        <mesh key={dx} position={[X + dx, lobbyH - 0.005, F - 1.1]} rotation={[Math.PI / 2, 0, 0]} material={res.downlight}>
          <circleGeometry args={[0.12, 20]} />
        </mesh>
      ))}
      <pointLight position={[X - 1.3, lobbyH - 0.3, F - 1.3]} color="#ffcf98" intensity={10} distance={11} decay={2} />
      <pointLight position={[X + 1.3, lobbyH - 0.3, F - 1.3]} color="#ffcf98" intensity={10} distance={11} decay={2} />

      {/* the street light behind him, falling softly on whoever stands at the gate */}
      <pointLight position={[X + 0.8, 4.2, F - 8.6]} color="#ffe6cc" intensity={14} distance={12} decay={2} />

      {/* forecourt paving */}
      <mesh position={[X, 0.015, (F + HOSTEL.wallZ) / 2]} rotation={[-Math.PI / 2, 0, 0]} material={res.paving}>
        <planeGeometry args={[30, F - HOSTEL.wallZ + 0.4]} />
      </mesh>
      {/* the low boundary wall and the gate posts with lamp globes */}
      {[-1, 1].map((s) => (
        <group key={s}>
          <mesh position={[X + s * 8.9, 0.55, HOSTEL.wallZ]} material={res.wallMat}>
            <boxGeometry args={[13.4, 1.1, 0.28]} />
          </mesh>
          <mesh position={[X + s * 8.9, 1.13, HOSTEL.wallZ]} material={res.darkStone}>
            <boxGeometry args={[13.5, 0.07, 0.34]} />
          </mesh>
          <mesh position={[X + s * 2.25, 0.75, HOSTEL.wallZ]} material={res.darkStone}>
            <boxGeometry args={[0.45, 1.5, 0.45]} />
          </mesh>
          <mesh position={[X + s * 2.25, 1.66, HOSTEL.wallZ]} material={res.globe}>
            <sphereGeometry args={[0.16, 20, 14]} />
          </mesh>
          <pointLight position={[X + s * 2.25, 1.75, HOSTEL.wallZ - 0.4]} color="#ffe2c0" intensity={2.2} distance={6} decay={2} />
          {/* planters by the steps */}
          <mesh position={[X + s * 3.2, 0.35, F - 1.2]} material={res.pot}>
            <cylinderGeometry args={[0.32, 0.25, 0.7, 20]} />
          </mesh>
          <mesh position={[X + s * 3.2, 0.95, F - 1.2]} material={res.leaf}>
            <icosahedronGeometry args={[0.45, 1]} />
          </mesh>
          {/* a tree in each corner of the forecourt */}
          <mesh position={[X + s * 10.5, 1.4, F - 2.6]} material={res.bark}>
            <cylinderGeometry args={[0.1, 0.16, 2.8, 10]} />
          </mesh>
          <mesh position={[X + s * 10.5, 3.4, F - 2.6]} material={res.leaf}>
            <icosahedronGeometry args={[1.5, 1]} />
          </mesh>
          <mesh position={[X + s * 10.1, 4.1, F - 2.2]} material={res.leaf}>
            <icosahedronGeometry args={[1.0, 1]} />
          </mesh>
        </group>
      ))}
    </group>
  );
}
