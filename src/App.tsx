import { Component, ReactNode, Suspense, useEffect } from 'react';
import { env, hasWebGL } from './lib/env';
import { clamp } from './lib/ease';
import { fx, resetFx } from './state/fx';
import { getPhase, goTo, useStory, type Phase } from './state/store';
import { OpeningCanvas } from './scene/OpeningCanvas';
import { Gate } from './ui/Gate';
import { PlayfulIntro } from './ui/PlayfulIntro';
import { GardenStory } from './garden/GardenStory';
import { Thoughts } from './ui/Thoughts';
import { Identity } from './ui/Identity';
import { LightStage } from './ui/LightStage';
import { Continued } from './ui/Continued';
import { Poem } from './ui/Poem';
import { Ask } from './ui/Ask';
import { SoundToggle } from './ui/SoundToggle';
import { FallbackSky } from './ui/FallbackSky';
import { Stardust } from './ui/Stardust';
import { SpaceFriends } from './ui/SpaceFriends';
import { CityOverlay } from './city/CityOverlay';
import { cityClock } from './city/cityClock';
import { EarthOverlay } from './journey/EarthOverlay';
import { VoyageOverlay } from './journey/VoyageOverlay';
import { SaturnOverlay } from './saturn/SaturnOverlay';
import { saturnDir } from './saturn/saturnScript';
import { light } from './light/lightSim';
import { journeyClock } from './journey/clock';
import { preloadJourneyTextures } from './solar/textures';

class GLBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    useStory.getState().setWebgl(false);
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

// the cosmic opening: the sky reveals itself and the space friends come to say hi
const ATMOSPHERE_MS = 9500;
const LIGHT_PHASES: Phase[] = ['light', 'poem', 'ask', 'transition', 'next'];

export default function App() {
  const phase = useStory((s) => s.phase);
  const webgl = useStory((s) => s.webgl);

  useEffect(() => {
    resetFx();
    if (!hasWebGL()) useStory.getState().setWebgl(false);
    // expose the phase machine for the next stage / testing
    (window as unknown as { cosmic: unknown }).cosmic = { goTo, getPhase, light, journeyClock, cityClock, saturnDir };
    // always start clean, even when restored from the back/forward cache
    const onShow = (e: PageTransitionEvent) => {
      if (e.persisted) location.reload();
    };
    window.addEventListener('pageshow', onShow);
    return () => window.removeEventListener('pageshow', onShow);
  }, []);

  // start fetching the planet photos early, while the opening plays
  useEffect(() => {
    if (phase !== 'gate') preloadJourneyTextures();
  }, [phase]);

  // atmosphere: no text, just let her look for a moment
  useEffect(() => {
    if (phase !== 'atmosphere') return;
    const id = window.setTimeout(() => goTo('thoughts'), ATMOSPHERE_MS);
    return () => window.clearTimeout(id);
  }, [phase]);

  // pointer / tilt parallax input
  useEffect(() => {
    if (env.reducedMotion) return;
    const move = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return;
      fx.pointer.x = clamp((e.clientX / window.innerWidth) * 2 - 1, -1, 1);
      fx.pointer.y = clamp(-((e.clientY / window.innerHeight) * 2 - 1), -1, 1);
    };
    const tilt = (e: DeviceOrientationEvent) => {
      if (e.gamma == null || e.beta == null) return;
      fx.pointer.x = clamp(e.gamma / 25, -1, 1);
      fx.pointer.y = clamp((e.beta - 45) / 25, -1, 1);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('deviceorientation', tilt);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('deviceorientation', tilt);
    };
  }, []);

  return (
    <div className={`app phase-${phase}${env.reducedMotion ? ' reduced' : ''}`}>
      {webgl ? (
        <GLBoundary>
          <Suspense fallback={null}>
            <OpeningCanvas />
          </Suspense>
        </GLBoundary>
      ) : (
        <FallbackSky />
      )}
      <div className="atmo" aria-hidden="true" />

      <main className="layer">
        {phase === 'garden' && <GardenStory />}
        {phase === 'intro' && <PlayfulIntro />}
        {phase === 'atmosphere' && <SpaceFriends />}
        {phase === 'thoughts' && <Thoughts />}
        {phase === 'identity' && <Identity />}
        {phase === 'poem' && <Poem />}
        {phase === 'ask' && <Ask />}
        {LIGHT_PHASES.includes(phase) && <LightStage />}
        {phase === 'story' && <CityOverlay />}
        {phase === 'earth' && <EarthOverlay />}
        {phase === 'voyage' && <VoyageOverlay />}
        {phase === 'saturn' && <SaturnOverlay />}
      </main>

      <div className="dusk" aria-hidden="true" />
      <Stardust />

      {/* phase `next`: the next stage plugs in here */}
      {phase === 'next' && <Continued />}

      {phase !== 'gate' && <SoundToggle />}
      {(phase === 'gate' || phase === 'garden') && <Gate />}
    </div>
  );
}
