import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { Earth } from '../journey/Earth';
import { SpaceSky } from '../journey/SpaceSky';
import { SUN_DIR } from '../journey/space';
import { makeCorona, makeNebulaMaterial } from '../solar/shaders';
import { CityCamera } from './CityCamera';
import { CityScape } from './CityScape';
import { cityClock, segmentAt } from './cityClock';
import { makeCloudTexture } from './cityMaterials';
import { Hostel } from './Hostel';
import { Phone3D } from './Phone3D';
import { Richa3D } from './Richa3D';
import { Rooftop } from './Rooftop';

/**
 * The first-person story world: deep space with galaxies and Earth (for the descent),
 * and the night city (the rooftop, the street, the hostel). One is shown at a time.
 */

/** A spiral galaxy, painted once: a warm core, two blue-white arms of stars and dust. */
function galaxyTexture(seed: number, hue: number) {
  const S = 256;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d')!;
  let s = seed;
  const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const core = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S * 0.2);
  core.addColorStop(0, 'rgba(255,240,220,0.95)');
  core.addColorStop(0.4, 'rgba(255,205,170,0.35)');
  core.addColorStop(1, 'rgba(255,190,160,0)');
  g.fillStyle = core;
  g.fillRect(0, 0, S, S);
  for (let i = 0; i < 2600; i++) {
    const arm = i % 2;
    const t = Math.pow(r(), 0.75) * 3.2;
    const a = t * 1.9 + arm * Math.PI + (r() - 0.5) * 0.55;
    const d = (S * 0.06 + t * S * 0.13) * (0.9 + r() * 0.2);
    const x = S / 2 + Math.cos(a) * d;
    const y = S / 2 + Math.sin(a) * d;
    const b = 1 - t / 3.4;
    const col = r() < 0.2 ? `hsla(${hue + 300},80%,80%,${b * 0.35})` : `hsla(${hue},70%,${78 + r() * 18}%,${b * 0.5})`;
    g.fillStyle = col;
    g.fillRect(x, y, 1.4, 1.4);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function SpacePart() {
  const res = useMemo(() => {
    const nebula = makeNebulaMaterial();
    nebula.uniforms.uDeep.value = 0.45;
    nebula.uniforms.uBand.value = 1;
    nebula.uniforms.uGalN.value.set(0.3, 1, -0.4).normalize();
    nebula.uniforms.uGalC.value.copy(SUN_DIR).multiplyScalar(-1);
    const corona = makeCorona();
    const sunPos = SUN_DIR.clone().multiplyScalar(780);
    // galaxies scattered across the far sky, and soft cosmic clouds near the way in
    const galaxies = [
      { tex: galaxyTexture(3, 220), dir: [0.06, 0.12, 1], size: 300, rot: 0.6, squash: 0.45 },
      { tex: galaxyTexture(8, 265), dir: [-0.55, 0.32, 0.8], size: 210, rot: -0.4, squash: 0.7 },
      { tex: galaxyTexture(14, 200), dir: [0.62, -0.25, 0.75], size: 150, rot: 1.2, squash: 0.35 },
      { tex: galaxyTexture(21, 290), dir: [-0.15, 0.62, 0.78], size: 240, rot: 2.2, squash: 0.85 },
      { tex: galaxyTexture(30, 230), dir: [-0.45, -0.3, 0.85], size: 130, rot: 0.1, squash: 0.5 },
      { tex: galaxyTexture(41, 250), dir: [0.45, 0.42, 0.8], size: 170, rot: -1.0, squash: 0.6 },
    ].map((gx) => {
      const mat = new THREE.SpriteMaterial({ map: gx.tex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, rotation: gx.rot, opacity: 1, color: new THREE.Color(1.6, 1.6, 1.7) });
      return { ...gx, mat };
    });
    const cloudTex = makeCloudTexture();
    const wisps = [
      ['#a98cff', 0.32],
      ['#ff8fc8', 0.24],
      ['#8fb8ff', 0.26],
      ['#c69cff', 0.3],
      ['#ff9fd6', 0.2],
      ['#9a8cff', 0.26],
    ].map(([c, o]) => new THREE.SpriteMaterial({ map: cloudTex, color: c as string, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: o as number }));
    return { nebula, corona, sunPos, galaxies, cloudTex, wisps };
  }, []);
  useEffect(
    () => () => {
      res.nebula.dispose();
      res.corona.dispose();
      res.galaxies.forEach((g) => (g.tex.dispose(), g.mat.dispose()));
      res.cloudTex.dispose();
      res.wisps.forEach((w) => w.dispose());
    },
    [res],
  );

  // galaxies sit in directions around where the journey starts looking
  const start = useMemo(() => {
    const seg = segmentAt(0);
    const p = seg.keys[0].pos.clone();
    const l = seg.keys[0].look!.clone().sub(p).normalize();
    const up = new THREE.Vector3(0, 1, 0);
    const right = new THREE.Vector3().crossVectors(l, up).normalize();
    const up2 = new THREE.Vector3().crossVectors(right, l).normalize();
    // cosmic clouds along the first seconds of the way
    const k1 = seg.keys[1].pos;
    const k2 = seg.keys[2].pos;
    const wisp = [0.15, 0.32, 0.5, 0.62, 0.78, 0.9].map((f, i) => {
      const at = f < 0.5 ? p.clone().lerp(k1, f * 2) : k1.clone().lerp(k2, (f - 0.5) * 2);
      return at.add(right.clone().multiplyScalar((i % 2 ? 1 : -1) * (18 + i * 4))).add(up2.clone().multiplyScalar((i % 3) * 8 - 8));
    });
    return { p, l, right, up2, wisp };
  }, []);

  const groupRef = useRef<THREE.Group>(null);
  useFrame(({ camera, clock }) => {
    res.nebula.uniforms.uTime.value = clock.elapsedTime;
    res.corona.uniforms.uTime.value = clock.elapsedTime;
    const g = groupRef.current;
    if (!g) return;
    const neb = g.getObjectByName('cw-nebula');
    if (neb) neb.position.copy(camera.position);
    const cor = g.getObjectByName('cw-corona');
    if (cor) {
      cor.position.copy(camera.position).add(res.sunPos);
      cor.quaternion.copy(camera.quaternion);
    }
    const gal = g.getObjectByName('cw-galaxies');
    if (gal) gal.position.copy(camera.position);
  });

  return (
    <group ref={groupRef}>
      <mesh name="cw-nebula" material={res.nebula} renderOrder={-30} frustumCulled={false}>
        <sphereGeometry args={[880, 48, 32]} />
      </mesh>
      <group name="cw-galaxies">
        {res.galaxies.map((gx, i) => {
          const d = start.l
            .clone()
            .multiplyScalar(gx.dir[2])
            .add(start.right.clone().multiplyScalar(gx.dir[0]))
            .add(start.up2.clone().multiplyScalar(gx.dir[1]))
            .normalize()
            .multiplyScalar(820);
          return <sprite key={i} material={gx.mat} position={d} scale={[gx.size, gx.size * gx.squash, 1]} renderOrder={-25} />;
        })}
      </group>
      <SpaceSky />
      <mesh name="cw-corona" material={res.corona} renderOrder={-18} frustumCulled={false}>
        <planeGeometry args={[520, 520]} />
      </mesh>
      {start.wisp.map((p, i) => (
        <sprite key={i} material={res.wisps[i]} position={p} scale={[60 + i * 12, 40 + i * 8, 1]} renderOrder={5} />
      ))}
      <directionalLight position={SUN_DIR.clone().multiplyScalar(100)} intensity={3.3} color="#fff1dc" />
      <ambientLight intensity={0.15} color="#eadcff" />
      <Earth />
    </group>
  );
}

function CityPart() {
  return (
    <group>
      {/* night light: a dim violet sky, the city's warm glow from below, the moon */}
      <hemisphereLight args={['#6a5f9a', '#3a2418', 0.55]} />
      <directionalLight position={[-35, 62, -70]} intensity={0.35} color="#b9c4ff" />
      <directionalLight position={[0, -20, -100]} intensity={0.25} color="#ffb27a" />
      <CityScape />
      <Rooftop />
      <Hostel />
      <Richa3D />
    </group>
  );
}

export function CityWorld() {
  const { gl, scene, camera } = useThree();
  // the same filmic look as the rest of the journey
  useMemo(() => {
    gl.toneMapping = THREE.ACESFilmicToneMapping;
    gl.toneMappingExposure = 1.05;
    gl.outputColorSpace = THREE.SRGBColorSpace;
    THREE.ColorManagement.enabled = true;
  }, [gl]);

  const space = useRef<THREE.Group>(null);
  const city = useRef<THREE.Group>(null);

  // compile every shader up front (hidden parts too), so nothing stutters later
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      const hidden: { visible: boolean }[] = [];
      scene.traverse((o) => {
        if (!o.visible) {
          hidden.push(o);
          o.visible = true;
        }
      });
      gl.compile(scene, camera);
      hidden.forEach((o) => (o.visible = false));
    });
    return () => cancelAnimationFrame(id);
  }, [gl, scene, camera]);

  useFrame(() => {
    const w = segmentAt(cityClock.t).world;
    if (space.current) space.current.visible = w === 'space';
    if (city.current) city.current.visible = w === 'city';
  });

  return (
    <>
      <CityCamera />
      <group ref={space}>
        <SpacePart />
      </group>
      <group ref={city} visible={false}>
        <CityPart />
      </group>
      <Phone3D />
    </>
  );
}
