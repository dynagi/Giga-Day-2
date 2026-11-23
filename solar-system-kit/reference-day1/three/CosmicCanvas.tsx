import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { PLANETS } from '../data/planets';
import { useCosmic } from '../state/store';
import { CameraRig } from './CameraRig';
import { DwarfPlanets, Nebula, OrbitPaths, SolarBelts, Starfield, Sun, WarpField } from './Environment';
import { FeatureMarkers, Hotspots } from './Hotspots';
import { JourneyScene } from './journey/JourneyScene';
import { IntroScene } from './intro/IntroScene';
import { Prewarm } from './Prewarm';
import { EarthDirector } from './earth/EarthDirector';
import { Town } from './earth/Town';
import { Planet } from './Planet';
import type { TextureSet } from './textures';

interface Props {
  textures: TextureSet;
  reducedMotion: boolean;
}

/** The single, persistent 3D scene. The camera travels; the scene never reloads. */
export default function CosmicCanvas({ textures, reducedMotion }: Props) {
  const quality = useCosmic((s) => s.quality);
  const setWebgl = useCosmic((s) => s.setWebgl);
  const phase = useCosmic((s) => s.phase);

  return (
    <Canvas
      className="cosmic__canvas"
      dpr={quality === 'high' ? [1, 1.75] : [1, 1.15]}
      gl={{ antialias: quality === 'high', powerPreference: 'high-performance', alpha: false }}
      camera={{ fov: 45, near: 0.05, far: 2400, position: [0, 44, 88] }}
      onCreated={({ gl, camera }) => {
        // Dev-only: lets automated checks inspect the renderer and camera (stripped from production builds).
        if (import.meta.env.DEV) Object.assign(((window as unknown as Record<string, Record<string, unknown>>).__cosmic ??= {}), { gl, camera });
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.05;
        gl.domElement.addEventListener('webglcontextlost', (e) => {
          e.preventDefault();
          setWebgl(false);
        });
      }}
      aria-label="Interactive 3D model of the Solar System"
      role="img"
    >
      {/* Always present (pushed far away) so materials never recompile; the journey pulls it in. */}
      <fog attach="fog" args={['#241739', 1e5, 2e5]} />
      <Nebula />
      <Starfield quality={quality} />
      {/* Soft pastel fill so night sides read as lavender shadow, never black. */}
      <ambientLight intensity={0.15} color="#eadcff" />
      <hemisphereLight args={['#fff0fa', '#b9a1df', 0.14]} />
      <Sun textures={textures} quality={quality} />
      <OrbitPaths />
      <SolarBelts quality={quality} />
      <DwarfPlanets textures={textures} />
      {PLANETS.map((p) => (
        <Planet key={p.id} data={p} textures={textures} hero={p.id === 'neptune' || p.id === 'uranus'} quality={quality} />
      ))}
      <JourneyScene textures={textures} quality={quality} reducedMotion={reducedMotion} />
      {(phase === 'loading' || phase === 'intro') && <IntroScene quality={quality} reducedMotion={reducedMotion} running={phase === 'intro'} />}
      <Town />
      <EarthDirector reducedMotion={reducedMotion} />
      <Prewarm />
      <WarpField quality={quality} />
      <Hotspots />
      <FeatureMarkers />
      <OrbitControls
        makeDefault
        enablePan={false}
        enableDamping
        dampingFactor={0.08}
        rotateSpeed={0.55}
        zoomSpeed={0.8}
        maxPolarAngle={Math.PI * 0.86}
      />
      <CameraRig reducedMotion={reducedMotion} />
    </Canvas>
  );
}
