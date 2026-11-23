import { Canvas } from '@react-three/fiber';
import { env } from '../lib/env';
import { useStory } from '../state/store';
import { CameraDirector } from './CameraDirector';
import { Nebula } from './Nebula';
import { Galaxies } from './Galaxies';
import { Starfield } from './Starfield';
import { Dust } from './Dust';
import { GuideLight } from './GuideLight';
import { JourneyWorld } from '../journey/JourneyWorld';
import { CityWorld } from '../city/CityWorld';

/** The one persistent canvas for the whole experience. */
export function OpeningCanvas() {
  // the journey (Earth onward) has its own camera and world in the same canvas
  const phase = useStory((s) => s.phase);
  const journey = phase === 'earth' || phase === 'voyage' || phase === 'saturn';
  return (
    <Canvas
      className="sky"
      dpr={[1, env.dprCap]}
      flat
      linear
      gl={{ antialias: false, alpha: false, depth: true, stencil: false, powerPreference: 'high-performance' }}
      camera={{ fov: 60, near: 0.1, far: 700, position: [0, 0, 0] }}
      onCreated={({ gl }) => {
        gl.setClearColor('#0e0a1a', 1);
        gl.domElement.addEventListener('webglcontextlost', (e) => {
          e.preventDefault();
          useStory.getState().setWebgl(false);
        });
      }}
    >
      {phase === 'story' ? (
        // the first-person story: down from the stars to the city, the phone, the hostel
        <CityWorld />
      ) : journey ? (
        <JourneyWorld phase={phase} />
      ) : (
        <>
          {/* CameraDirector first so the camera is updated before anything reads it */}
          <CameraDirector />
          <Nebula />
          <Galaxies />
          <Starfield />
          <Dust />
          <GuideLight />
        </>
      )}
    </Canvas>
  );
}
