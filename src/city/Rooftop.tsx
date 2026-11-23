import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { ROOF } from './cityLayout';

/**
 * Giga's rooftop: gravel underfoot, a low parapet with a railing toward the skyline,
 * the stairwell hut with its door open and warm light spilling out, a water tank, AC units,
 * an antenna with a blinking light.
 */

function gravelTexture() {
  const S = 512;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d')!;
  g.fillStyle = '#4a4650';
  g.fillRect(0, 0, S, S);
  let s = 3;
  const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 9000; i++) {
    const v = 50 + r() * 70;
    g.fillStyle = `rgb(${v},${v * 0.96},${v * 1.04})`;
    const rad = 0.6 + r() * 2.2;
    g.beginPath();
    g.arc(r() * S, r() * S, rad, 0, Math.PI * 2);
    g.fill();
  }
  // damp patches
  for (let i = 0; i < 14; i++) {
    const x = r() * S;
    const y = r() * S;
    const grd = g.createRadialGradient(x, y, 0, x, y, 40 + r() * 80);
    grd.addColorStop(0, 'rgba(20,18,30,0.35)');
    grd.addColorStop(1, 'rgba(20,18,30,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, S, S);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(7, 6);
  t.anisotropy = 8;
  return t;
}

export function Rooftop() {
  const res = useMemo(() => {
    const gravel = gravelTexture();
    const floor = new THREE.MeshStandardMaterial({ map: gravel, roughness: 1, metalness: 0 });
    const concrete = new THREE.MeshStandardMaterial({ color: '#57525c', roughness: 0.92 });
    const metal = new THREE.MeshStandardMaterial({ color: '#3b3a42', roughness: 0.45, metalness: 0.8 });
    const tank = new THREE.MeshStandardMaterial({ color: '#2f3340', roughness: 0.7, metalness: 0.2 });
    const doorGlow = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffc58a').multiplyScalar(1.6) });
    const lamp = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffe0b8').multiplyScalar(3) });
    const red = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ff2a1a').multiplyScalar(3) });
    return { gravel, floor, concrete, metal, tank, doorGlow, lamp, red };
  }, []);
  useEffect(() => () => Object.values(res).forEach((x) => x.dispose()), [res]);

  useFrame(({ clock }) => {
    // the antenna's light blinks slowly
    res.red.color.setRGB(1, 0.16, 0.1).multiplyScalar(Math.sin(clock.elapsedTime * 2.2) > 0.2 ? 3 : 0.15);
  });

  const T = ROOF.top;
  const X = ROOF.halfX;
  const Z = ROOF.halfZ;
  const pH = 0.55; // parapet height
  const posts = useMemo(() => {
    const out: number[] = [];
    for (let x = -X + 0.4; x <= X - 0.4; x += 1.6) out.push(x);
    return out;
  }, [X]);

  return (
    <group>
      {/* the roof surface */}
      <mesh position={[0, T + 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]} material={res.floor}>
        <planeGeometry args={[X * 2 - 0.4, Z * 2 - 0.4]} />
      </mesh>
      {/* parapet on all four sides */}
      <mesh position={[0, T + pH / 2, -Z + 0.15]} material={res.concrete}>
        <boxGeometry args={[X * 2, pH, 0.3]} />
      </mesh>
      <mesh position={[0, T + pH / 2, Z - 0.15]} material={res.concrete}>
        <boxGeometry args={[X * 2, pH, 0.3]} />
      </mesh>
      <mesh position={[-X + 0.15, T + pH / 2, 0]} material={res.concrete}>
        <boxGeometry args={[0.3, pH, Z * 2]} />
      </mesh>
      <mesh position={[X - 0.15, T + pH / 2, 0]} material={res.concrete}>
        <boxGeometry args={[0.3, pH, Z * 2]} />
      </mesh>
      {/* a railing on top of the parapet, toward the skyline */}
      {posts.map((x) => (
        <mesh key={x} position={[x, T + pH + 0.28, -Z + 0.15]} material={res.metal}>
          <boxGeometry args={[0.05, 0.56, 0.05]} />
        </mesh>
      ))}
      <mesh position={[0, T + pH + 0.56, -Z + 0.15]} material={res.metal}>
        <boxGeometry args={[X * 2 - 0.6, 0.06, 0.08]} />
      </mesh>
      <mesh position={[0, T + pH + 0.3, -Z + 0.15]} material={res.metal}>
        <boxGeometry args={[X * 2 - 0.6, 0.03, 0.03]} />
      </mesh>

      {/* the stairwell hut, its door open, warm light inside */}
      <mesh position={[ROOF.door.x, T + 1.5, ROOF.door.z + 2.5]} material={res.concrete}>
        <boxGeometry args={[6, 3, 5]} />
      </mesh>
      <mesh position={[ROOF.door.x, T + 1.08, ROOF.door.z - 0.012]} rotation={[0, Math.PI, 0]} material={res.doorGlow}>
        <planeGeometry args={[1.05, 2.15]} />
      </mesh>
      <mesh position={[ROOF.door.x + 0.62, T + 1.08, ROOF.door.z - 0.45]} rotation={[0, -1.1, 0]} material={res.metal}>
        <boxGeometry args={[1.0, 2.1, 0.05]} />
      </mesh>
      <mesh position={[ROOF.door.x, T + 2.42, ROOF.door.z - 0.08]} material={res.lamp}>
        <boxGeometry args={[0.32, 0.08, 0.14]} />
      </mesh>
      <pointLight position={[ROOF.door.x, T + 2.2, ROOF.door.z - 0.9]} color="#ffc68f" intensity={9} distance={16} decay={2} />
      <pointLight position={[ROOF.door.x, T + 1.2, ROOF.door.z + 0.8]} color="#ffb877" intensity={5} distance={7} decay={2} />

      {/* water tank on its stand */}
      <mesh position={[9.5, T + 2.2, 7.5]} material={res.tank}>
        <cylinderGeometry args={[1.25, 1.25, 2.2, 28]} />
      </mesh>
      {[-0.8, 0.8].map((dx) =>
        [-0.8, 0.8].map((dz) => (
          <mesh key={`${dx}${dz}`} position={[9.5 + dx, T + 0.55, 7.5 + dz]} material={res.metal}>
            <boxGeometry args={[0.1, 1.1, 0.1]} />
          </mesh>
        )),
      )}
      {/* AC units */}
      {[
        [6.5, -1.5],
        [10.4, -1.2],
        [-11.5, -4],
      ].map(([x, z]) => (
        <group key={`${x}${z}`} position={[x, T, z]}>
          <mesh position={[0, 0.45, 0]} material={res.concrete}>
            <boxGeometry args={[1.4, 0.9, 0.9]} />
          </mesh>
          <mesh position={[0, 0.48, 0.46]} rotation={[0, 0, 0]} material={res.metal}>
            <circleGeometry args={[0.32, 24]} />
          </mesh>
        </group>
      ))}
      {/* antenna with a blinking light */}
      <mesh position={[12.6, T + 3, 10]} material={res.metal}>
        <cylinderGeometry args={[0.04, 0.06, 6, 8]} />
      </mesh>
      <mesh position={[12.6, T + 6.05, 10]} material={res.red}>
        <sphereGeometry args={[0.09, 12, 8]} />
      </mesh>
    </group>
  );
}
