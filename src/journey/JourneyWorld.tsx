import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { makeCorona, makeNebulaMaterial } from '../solar/shaders';
import { SUN_DIR } from './space';
import { damp } from '../lib/ease';
import type { Phase } from '../state/store';
import { journeyClock } from './clock';
import { Earth } from './Earth';
import { EARTH_KEYS } from './earthTimeline';
import { JourneyCamera } from './JourneyCamera';
import { Moon } from './Moon';
import { Saturn } from './Saturn';
import { SpaceSky } from './SpaceSky';
import { CosmicDust, NebulaClouds, TravelStars } from './VoyageFx';
import { VOYAGE_KEYS } from './voyageTimeline';
import { WelcomePlanets } from './WelcomePlanets';
import { SaturnCamera } from '../saturn/SaturnCamera';
import { SaturnWorld } from '../saturn/SaturnWorld';
import { CosmicCreatures } from './CosmicCreatures';

/**
 * The journey's world, shared by the Earth part and the voyage so nothing reloads in between.
 * Everything is mounted from the start (and compiled once), and simply switched on when needed.
 */
export function JourneyWorld({ phase }: { phase: Phase }) {
  const { gl, scene, camera } = useThree();
  const voyage = phase === 'voyage' || phase === 'saturn';
  const saturn = phase === 'saturn';

  // the kit's look for space: filmic tone mapping and real colour space
  // (set once here; the earlier scenes never come back after this)
  useMemo(() => {
    gl.toneMapping = THREE.ACESFilmicToneMapping;
    gl.toneMappingExposure = 1.05;
    gl.outputColorSpace = THREE.SRGBColorSpace;
    THREE.ColorManagement.enabled = true;
  }, [gl]);

  // the kit's nebula sky (lavender band, Milky Way) and a living Sun's corona
  const sky = useMemo(() => {
    const nebula = makeNebulaMaterial();
    nebula.uniforms.uDeep.value = 0.35;
    nebula.uniforms.uBand.value = 1;
    nebula.uniforms.uGalN.value.set(0.3, 1, -0.4).normalize();
    nebula.uniforms.uGalC.value.copy(SUN_DIR).multiplyScalar(-1);
    const corona = makeCorona();
    const sunPos = SUN_DIR.clone().multiplyScalar(780);
    return { nebula, corona, sunPos };
  }, []);
  useEffect(() => () => (sky.nebula.dispose(), sky.corona.dispose()), [sky]);

  // compile every shader up front, so the turn toward Saturn never stutters
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      // hidden things (like Saturn before it appears) are compiled too
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

  useFrame(({ camera, clock, scene: sc }, delta) => {
    sky.nebula.uniforms.uTime.value = clock.elapsedTime;
    sky.corona.uniforms.uTime.value = clock.elapsedTime;
    const neb = sc.getObjectByName('kit-nebula');
    if (neb) neb.position.copy(camera.position);
    const cor = sc.getObjectByName('kit-corona');
    if (cor) {
      cor.position.copy(camera.position).add(sky.sunPos);
      cor.quaternion.copy(camera.quaternion);
    }
    journeyClock.voyage += ((voyage ? 1 : 0) - journeyClock.voyage) * damp(0.8, Math.min(delta, 0.1));
  });

  return (
    <>
      {saturn ? <SaturnCamera /> : <JourneyCamera key={phase} keys={voyage ? VOYAGE_KEYS : EARTH_KEYS} />}
      <mesh name="kit-nebula" material={sky.nebula} renderOrder={-30} frustumCulled={false}>
        <sphereGeometry args={[880, 48, 32]} />
      </mesh>
      <SpaceSky />
      <mesh name="kit-corona" material={sky.corona} renderOrder={-18} frustumCulled={false}>
        <planeGeometry args={[520, 520]} />
      </mesh>
      {/* one warm sunlight and a very faint lavender fill (the kit's recipe) */}
      <directionalLight position={SUN_DIR.clone().multiplyScalar(100)} intensity={3.3} color="#fff1dc" />
      <ambientLight intensity={0.15} color="#eadcff" />
      <hemisphereLight args={['#fff0fa', '#b9a1df', 0.14]} />
      <Earth />
      <Moon />
      {!voyage && <WelcomePlanets />}
      {!voyage && <CosmicCreatures />}
      <TravelStars />
      <CosmicDust />
      <NebulaClouds />
      <Saturn always={saturn} />
      {saturn && <SaturnWorld />}
    </>
  );
}
