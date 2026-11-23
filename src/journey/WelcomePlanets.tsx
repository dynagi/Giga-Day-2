import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { env } from '../lib/env';
import { makeAtmosphereHalo, makeAtmosphereRim } from '../solar/shaders';
import { sunFar } from '../solar/realBodies';
import { useJourneyTextures, type WelcomePlanet } from '../solar/textures';
import { journeyClock } from './clock';
import { ET, WELCOME } from './earthTimeline';
import { SUN_DIR } from './space';

/**
 * The planets welcoming her as she leaves Earth (Saturn stays a surprise for later).
 * Each is a photo-textured world built with the kit's recipe, gathered around Earth so
 * the camera meets them one by one; the one speaking does a small happy bob.
 * Their on-screen positions are shared with the overlay, which draws their speech bubbles.
 */

const LOOK: Record<WelcomePlanet, { color: string; tilt: number; atmo?: [string, number]; bump?: number; spin: number }> = {
  mercury: { color: '#a8a29c', tilt: 0.03, bump: 2.2, spin: 0.05 },
  venus: { color: '#e6c88f', tilt: 177.4, atmo: ['#ffe0a3', 0.55], spin: -0.03 },
  mars: { color: '#c0623a', tilt: 25.2, atmo: ['#ff9e72', 0.25], bump: 1.4, spin: 0.15 },
  jupiter: { color: '#d8b48a', tilt: 3.1, atmo: ['#f3d8b2', 0.3], spin: 0.18 },
  uranus: { color: '#9fe3ee', tilt: 97.8, atmo: ['#8ff0ff', 0.9], spin: -0.12 },
  neptune: { color: '#4f7fe6', tilt: 28.3, atmo: ['#6ea6ff', 1.05], spin: 0.14 },
};

/** Where each planet is on screen right now (written here, read by the overlay). */
export const planetScreen: Record<string, { x: number; y: number; r: number; on: boolean }> = {};

function Planet({ id }: { id: WelcomePlanet }) {
  const tex = useJourneyTextures();
  const w = WELCOME.find((p) => p.id === id)!;
  const look = LOOK[id];
  const sun = useMemo(() => sunFar(SUN_DIR), []);
  const res = useMemo(() => {
    const seg = env.lowPower ? 48 : 96;
    const geo = new THREE.SphereGeometry(w.radius, seg, Math.round(seg * 0.66));
    const map = tex?.planets[id] ?? null;
    const mat = new THREE.MeshStandardMaterial({ map, color: map ? '#ffffff' : look.color, roughness: 0.92, metalness: 0 });
    if (map && look.bump) {
      mat.bumpMap = map;
      mat.bumpScale = look.bump;
      mat.roughness = 1;
    }
    const rim = look.atmo ? makeAtmosphereRim(look.atmo[0], look.atmo[1]) : null;
    const halo = look.atmo ? makeAtmosphereHalo(look.atmo[0], look.atmo[1]) : null;
    rim?.uniforms.uSun.value.copy(sun);
    halo?.uniforms.uSun.value.copy(sun);
    const haloGeo = new THREE.SphereGeometry(w.radius, 40, 28);
    return { geo, mat, rim, halo, haloGeo };
  }, [tex, id, w.radius, look, sun]);
  useEffect(
    () => () => {
      res.geo.dispose();
      res.mat.dispose();
      res.rim?.dispose();
      res.halo?.dispose();
      res.haloGeo.dispose();
    },
    [res],
  );

  const group = useRef<THREE.Group>(null);
  const spin = useRef<THREE.Mesh>(null);
  const v = useMemo(() => new THREE.Vector3(), []);
  useFrame(({ camera, size }, delta) => {
    const g = group.current;
    if (!g) return;
    if (spin.current) spin.current.rotation.y += Math.min(delta, 0.1) * look.spin;
    // a small happy bob while it speaks
    const t = journeyClock.t;
    const speaking = t >= w.from && t < w.to;
    const k = speaking ? Math.sin(((t - w.from) / (w.to - w.from)) * Math.PI) : 0;
    // after the welcome they politely shrink away, so the Moon has the stage
    const away = Math.min(1, Math.max(0, (t - ET.psstTo) / 3));
    const bye = 1 - away * away * (3 - 2 * away);
    g.visible = bye > 0.001;
    g.scale.setScalar((1 + k * 0.06 * Math.abs(Math.sin(t * 5))) * Math.max(0.001, bye));
    // share the on-screen position for the speech bubble
    v.copy(w.pos).project(camera);
    const inFront = v.z < 1;
    const dist = camera.position.distanceTo(w.pos);
    const rPx = (w.radius / (dist * Math.tan(((camera as THREE.PerspectiveCamera).fov * Math.PI) / 360))) * (size.height / 2);
    planetScreen[id] = {
      x: (v.x * 0.5 + 0.5) * size.width,
      y: (-v.y * 0.5 + 0.5) * size.height,
      r: rPx,
      on: inFront && Math.abs(v.x) < 1.1 && Math.abs(v.y) < 1.1,
    };
  });

  return (
    <group ref={group} position={w.pos}>
      <group rotation={[0, 0, THREE.MathUtils.degToRad(look.tilt)]}>
        <mesh ref={spin} geometry={res.geo} material={res.mat} />
      </group>
      {res.rim && <mesh geometry={res.geo} material={res.rim} scale={1.012} />}
      {res.halo && <mesh geometry={res.haloGeo} material={res.halo} scale={1.16} />}
    </group>
  );
}

export function WelcomePlanets() {
  return (
    <>
      {WELCOME.map((p) => (
        <Planet key={p.id} id={p.id} />
      ))}
    </>
  );
}
