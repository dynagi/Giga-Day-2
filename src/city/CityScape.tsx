import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { env } from '../lib/env';
import { BLOCK, CITY_RADIUS, HOSTEL, LAMP_SPACING, ROAD, ROAD_OFFSET, lampsNear, makeCity } from './cityLayout';
import {
  makeCitySkyMaterial,
  makeCloudMaterial,
  makeCloudTexture,
  makeFacadeMaterial,
  makeGlowPointsMaterial,
  makeGroundMaterial,
} from './cityMaterials';

/**
 * The city at night: thousands of buildings with lit windows (one draw call), streets of
 * lamps and long-exposure traffic, coloured crowns on the downtown towers, clouds drifting
 * over it all, and the night sky with the moon.
 */

/** A unit box standing on the ground (y from 0 to 1), for the instanced buildings. */
function unitBox() {
  const g = new THREE.BoxGeometry(1, 1, 1);
  g.translate(0, 0.5, 0);
  return g;
}

function seeded(seed: number) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
}

export function CityScape() {
  const city = useMemo(() => {
    const list = makeCity();
    const geo = unitBox();
    const mat = makeFacadeMaterial();
    const mesh = new THREE.InstancedMesh(geo, mat, list.length);
    const seed = new Float32Array(list.length);
    const kind = new Float32Array(list.length);
    const accent = new Float32Array(list.length * 3);
    const m = new THREE.Matrix4();
    list.forEach((b, i) => {
      m.makeScale(b.w, b.h, b.d).setPosition(b.x, 0, b.z);
      mesh.setMatrixAt(i, m);
      seed[i] = b.seed;
      kind[i] = b.kind;
      accent.set(b.accent, i * 3);
    });
    geo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seed, 1));
    geo.setAttribute('aKind', new THREE.InstancedBufferAttribute(kind, 1));
    geo.setAttribute('aAccent', new THREE.InstancedBufferAttribute(accent, 3));
    mesh.frustumCulled = false;

    // red aviation lights on the tall towers
    const tops = list.filter((b) => b.h > 70);
    const avPos = new Float32Array(tops.length * 3);
    const avCol = new Float32Array(tops.length * 3);
    tops.forEach((b, i) => {
      avPos.set([b.x, b.h + 1.2, b.z], i * 3);
      avCol.set([1, 0.12, 0.08], i * 3);
    });
    const avGeo = new THREE.BufferGeometry();
    avGeo.setAttribute('position', new THREE.BufferAttribute(avPos, 3));
    avGeo.setAttribute('aColor', new THREE.BufferAttribute(avCol, 3));
    const avMat = makeGlowPointsMaterial({ size: 3.2, min: 1.6, blink: true });
    return { list, geo, mat, mesh, avGeo, avMat };
  }, []);

  // every street lamp's glow (the poles near the hostel are real meshes, see below)
  const lamps = useMemo(() => {
    const R = CITY_RADIUS + 500;
    const n = Math.ceil(R / BLOCK);
    const pos: number[] = [];
    const col: number[] = [];
    const r = seeded(5);
    const push = (x: number, z: number) => {
      if (Math.hypot(x, z) > R) return;
      pos.push(x, 7.3, z);
      const led = r() > 0.78;
      const k = 0.8 + r() * 0.4;
      if (led) col.push(0.75 * k, 0.8 * k, 1.0 * k);
      else col.push(1.0 * k, 0.55 * k, 0.22 * k);
    };
    for (let k = -n; k <= n; k++) {
      const road = k * BLOCK + ROAD_OFFSET;
      for (let a = -Math.ceil(R / LAMP_SPACING); a <= Math.ceil(R / LAMP_SPACING); a++) {
        const along = a * LAMP_SPACING + LAMP_SPACING / 2;
        for (const s of [-1, 1]) {
          push(road + s * ROAD.lamp, along);
          push(along, road + s * ROAD.lamp);
        }
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('aColor', new THREE.Float32BufferAttribute(col, 3));
    const mat = makeGlowPointsMaterial({ size: 1.5, min: 1.3 });
    return { geo, mat };
  }, []);

  // real lamp posts along the street he walks, and by the hostel
  const poles = useMemo(() => {
    const list = lampsNear(HOSTEL.x, HOSTEL.front - 8, 95);
    const metal = new THREE.MeshStandardMaterial({ color: '#2b2a30', roughness: 0.55, metalness: 0.7 });
    const head = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.0, 0.78, 0.5).multiplyScalar(2.2), toneMapped: true });
    const poleGeo = new THREE.CylinderGeometry(0.06, 0.09, 7.4, 10);
    poleGeo.translate(0, 3.7, 0);
    const armGeo = new THREE.BoxGeometry(1.3, 0.07, 0.07);
    armGeo.translate(0.65, 7.3, 0);
    const headGeo = new THREE.BoxGeometry(0.55, 0.06, 0.22);
    headGeo.translate(1.2, 7.24, 0);
    const n = list.length;
    const pm = new THREE.InstancedMesh(poleGeo, metal, n);
    const am = new THREE.InstancedMesh(armGeo, metal, n);
    const hm = new THREE.InstancedMesh(headGeo, head, n);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    list.forEach((l, i) => {
      // the arm reaches out over the road
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.atan2(-l.dz, l.dx));
      m.compose(new THREE.Vector3(l.x, 0, l.z), q, new THREE.Vector3(1, 1, 1));
      pm.setMatrixAt(i, m);
      am.setMatrixAt(i, m);
      hm.setMatrixAt(i, m);
    });
    return { pm, am, hm, all: [metal, head, poleGeo, armGeo, headGeo] };
  }, []);

  const ground = useMemo(() => makeGroundMaterial(), []);
  const sky = useMemo(() => makeCitySkyMaterial(), []);

  // the sky's stars: a far shell of points that follows the camera
  const stars = useMemo(() => {
    const N = env.lowPower ? 900 : 1800;
    const r = seeded(99);
    const pos = new Float32Array(N * 3);
    const col = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      const y = Math.pow(r(), 0.8) * 0.95 + 0.04;
      const a = r() * Math.PI * 2;
      const s = Math.sqrt(1 - y * y);
      pos.set([Math.cos(a) * s * 2500, y * 2500, Math.sin(a) * s * 2500], i * 3);
      const b = (0.25 + Math.pow(r(), 3) * 1.3) * Math.min(1, y * 3);
      const tint = r();
      col.set(tint < 0.2 ? [b * 0.8, b * 0.85, b] : tint > 0.9 ? [b, b * 0.85, b * 0.7] : [b, b, b], i * 3);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
    const mat = makeGlowPointsMaterial({ size: 4.2, min: 1.4 });
    mat.uniforms.uFogD.value = 0;
    return { geo, mat };
  }, []);

  // clouds: a layer the descent falls through, mist around the downtown towers, and the ones he rises through
  const clouds = useMemo(() => {
    const r = seeded(31);
    const items: number[][] = [];
    const add = (x: number, y: number, z: number, size: number, bright: number) => items.push([x, y, z, size, r() * Math.PI * 2, bright]);
    const layer = env.lowPower ? 26 : 48;
    for (let i = 0; i < layer; i++) add((r() - 0.5) * 3200, 440 + r() * 380, (r() - 0.5) * 3200, 260 + r() * 300, 0.75 + r() * 0.4);
    // right along the way down…
    for (let i = 0; i < 9; i++) {
      const k = i / 8;
      add(150 - 110 * k + (r() - 0.5) * 140, 860 - 420 * k + (r() - 0.5) * 60, 560 - 400 * k + (r() - 0.5) * 140, 180 + r() * 160, 0.9 + r() * 0.3);
    }
    // …and the way up from the hostel
    for (let i = 0; i < 9; i++) {
      const k = i / 8;
      add(HOSTEL.x + 20 + (r() - 0.5) * 160, 330 + 400 * k, HOSTEL.front - 60 - 70 * k + (r() - 0.5) * 160, 170 + r() * 170, 0.9 + r() * 0.3);
    }
    // low mist weaving between the towers
    const mist = env.lowPower ? 10 : 22;
    for (let i = 0; i < mist; i++) add(70 + (r() - 0.5) * 900, 70 + r() * 110, -640 + (r() - 0.5) * 700, 140 + r() * 160, 1.15 + r() * 0.35);

    const base = new THREE.PlaneGeometry(1, 1);
    const geo = new THREE.InstancedBufferGeometry();
    geo.index = base.index;
    geo.setAttribute('position', base.getAttribute('position'));
    geo.setAttribute('uv', base.getAttribute('uv'));
    const center = new Float32Array(items.length * 3);
    const info = new Float32Array(items.length * 3);
    items.forEach((c, i) => {
      center.set([c[0], c[1], c[2]], i * 3);
      info.set([c[3], c[4], c[5]], i * 3);
    });
    geo.setAttribute('aCenter', new THREE.InstancedBufferAttribute(center, 3));
    geo.setAttribute('aInfo', new THREE.InstancedBufferAttribute(info, 3));
    geo.instanceCount = items.length;
    const tex = makeCloudTexture();
    const mat = makeCloudMaterial(tex);
    return { geo, mat, tex, base };
  }, []);

  useEffect(
    () => () => {
      city.geo.dispose();
      city.mat.dispose();
      city.mesh.dispose();
      city.avGeo.dispose();
      city.avMat.dispose();
      lamps.geo.dispose();
      lamps.mat.dispose();
      poles.all.forEach((x) => x.dispose());
      ground.dispose();
      sky.dispose();
      stars.geo.dispose();
      stars.mat.dispose();
      clouds.geo.dispose();
      clouds.mat.dispose();
      clouds.tex.dispose();
      clouds.base.dispose();
    },
    [city, lamps, poles, ground, sky, stars, clouds],
  );

  useFrame(({ camera, clock, size, gl, scene }) => {
    const t = clock.elapsedTime;
    const cam = camera as THREE.PerspectiveCamera;
    // points are sized in screen pixels: keep them right at any resolution and field of view
    const scale = (size.height * gl.getPixelRatio()) / 2 / Math.tan((cam.fov * Math.PI) / 360);
    for (const m of [lamps.mat, city.avMat, stars.mat]) {
      m.uniforms.uScale.value = scale;
      m.uniforms.uTime.value = t;
    }
    ground.uniforms.uTime.value = t;
    sky.uniforms.uTime.value = t;
    clouds.mat.uniforms.uTime.value = t;
    // the ground and sky go wherever the camera goes
    const g = scene.getObjectByName('city-ground');
    if (g) g.position.set(Math.round(camera.position.x / BLOCK) * BLOCK, 0, Math.round(camera.position.z / BLOCK) * BLOCK);
    const s = scene.getObjectByName('city-sky');
    if (s) s.position.copy(camera.position);
    const st = scene.getObjectByName('city-stars');
    if (st) st.position.copy(camera.position);
  });

  return (
    <group>
      <mesh name="city-sky" material={sky} renderOrder={-20} frustumCulled={false}>
        <sphereGeometry args={[100, 32, 16]} />
      </mesh>
      <points name="city-stars" geometry={stars.geo} material={stars.mat} renderOrder={-19} frustumCulled={false} />
      <mesh name="city-ground" material={ground} rotation={[-Math.PI / 2, 0, 0]} frustumCulled={false}>
        <planeGeometry args={[9000, 9000]} />
      </mesh>
      <primitive object={city.mesh} />
      <primitive object={poles.pm} />
      <primitive object={poles.am} />
      <primitive object={poles.hm} />
      <points geometry={lamps.geo} material={lamps.mat} frustumCulled={false} renderOrder={4} />
      <points geometry={city.avGeo} material={city.avMat} frustumCulled={false} renderOrder={4} />
      <mesh geometry={clouds.geo} material={clouds.mat} frustumCulled={false} renderOrder={8} />
    </group>
  );
}
