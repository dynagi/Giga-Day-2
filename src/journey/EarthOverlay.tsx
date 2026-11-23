import { useEffect, useState } from 'react';
import { copy } from '../data/copy';
import { chime } from '../audio/music';
import { env } from '../lib/env';
import { now } from '../lib/ease';
import { useStory } from '../state/store';
import { isControl } from '../ui/input';
import { ET } from './earthTimeline';
import { journeyInput } from './space';
import { journeyClock } from './clock';
import { WelcomeBubbles } from './WelcomeBubbles';

/**
 * The screen layer over the Earth → Moon journey: clouds rushing past as we rise,
 * her drag to look around Earth, the Moon line (no box behind it), and tapping the Moon.
 */
export function EarthOverlay() {
  const [t, setT] = useState(0);
  const [dragged, setDragged] = useState(false);
  const [tapped, setTapped] = useState(0);
  const [pop, setPop] = useState<{ x: number; y: number; id: number } | null>(null);

  // a coarse clock for the overlay (the 3D camera uses the same start time)
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const sec = journeyClock.t;
      setT(Math.floor(sec * 10) / 10);
      if (sec >= ET.end) {
        // onward: the voyage to Saturn
        useStory.getState().goTo('voyage');
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      journeyInput.dragYaw = journeyInput.dragPitch = 0;
      journeyInput.dragging = false;
    };
  }, []);

  const canDrag = t >= ET.exploreFrom - 1 && t < ET.end - 1;
  const moonTime = t >= ET.moonArrive && t < ET.moonTapUntil;

  // drag to orbit; a tap near the middle during the Moon moment makes it blush
  useEffect(() => {
    if (!canDrag) return;
    let down: { x: number; y: number; yaw: number; pitch: number; at: number } | null = null;
    const pd = (e: PointerEvent) => {
      if (e.button > 0 || isControl(e.target)) return;
      down = { x: e.clientX, y: e.clientY, yaw: journeyInput.dragYaw, pitch: journeyInput.dragPitch, at: performance.now() };
      journeyInput.dragging = true;
    };
    const pm = (e: PointerEvent) => {
      if (!down) return;
      const w = window.innerWidth;
      journeyInput.dragYaw = Math.max(-1.6, Math.min(1.6, down.yaw + ((e.clientX - down.x) / w) * Math.PI * 0.9));
      journeyInput.dragPitch = Math.max(-0.75, Math.min(0.75, down.pitch + ((e.clientY - down.y) / w) * Math.PI * 0.6));
      if (Math.hypot(e.clientX - down.x, e.clientY - down.y) > 12) setDragged(true);
    };
    const pu = (e: PointerEvent) => {
      if (!down) return;
      const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
      const quick = performance.now() - down.at < 350;
      down = null;
      journeyInput.dragging = false;
      const sec = journeyClock.t;
      if (moved < 12 && quick && sec >= ET.moonArrive && sec < ET.moonTapUntil) {
        // the Moon is in the middle of the screen: a tap there makes it blush
        const dx = e.clientX - window.innerWidth / 2;
        const dy = e.clientY - window.innerHeight / 2;
        if (Math.hypot(dx, dy) < Math.min(window.innerWidth, window.innerHeight) * 0.38) {
          journeyInput.blushAt = now();
          journeyInput.blushCount++;
          setTapped((n) => n + 1);
          setPop({ x: e.clientX, y: e.clientY, id: Date.now() });
          chime();
          navigator.vibrate?.(12);
        }
      }
    };
    window.addEventListener('pointerdown', pd);
    window.addEventListener('pointermove', pm);
    window.addEventListener('pointerup', pu);
    window.addEventListener('pointercancel', pu);
    return () => {
      window.removeEventListener('pointerdown', pd);
      window.removeEventListener('pointermove', pm);
      window.removeEventListener('pointerup', pu);
      window.removeEventListener('pointercancel', pu);
      journeyInput.dragging = false;
    };
  }, [canDrag]);

  const ascent = t < ET.ascentEnd + 1.2;
  const lineShown = t >= ET.lineIn && t < ET.lineOut;
  const lineOut = t >= ET.lineOut;
  const showDragHint = t >= ET.revealAt + 0.5 && t < ET.exploreFrom + 0.4 && !dragged;
  const showMoonHint = moonTime && t >= ET.lineOut + 0.6 && tapped === 0;

  return (
    <section className={`eo${env.reducedMotion ? ' is-calm' : ''}`} aria-label={copy.journey.earthLabel}>
      {ascent && (
        <div className={`eo-ascent${t >= ET.ascentEnd - 0.8 ? ' is-out' : ''}`} aria-hidden="true">
          <div className="eo-sky" />
          <div className="eo-clouds eo-c1" />
          <div className="eo-clouds eo-c2" />
          <div className="eo-clouds eo-c3" />
        </div>
      )}

      {/* we come up out of the clouds over the city */}
      {t < 2 && <div className="eo-whitein" aria-hidden="true" />}

      {/* the planets welcome her, one by one */}
      <WelcomeBubbles t={t} />

      {(lineShown || (lineOut && t < ET.lineOut + 2)) && (
        <p className={`eo-line${lineOut ? ' is-out' : ''}`}>{copy.journey.moonLine}</p>
      )}

      {pop && (
        <div key={pop.id} className="eo-blush" style={{ left: pop.x, top: pop.y }} aria-hidden="true">
          {Array.from({ length: 8 }, (_, i) => (
            <i key={i} style={{ ['--a' as string]: `${i * 45}deg` }} />
          ))}
          <span>{copy.journey.moonBlush[(tapped - 1) % copy.journey.moonBlush.length]}</span>
        </div>
      )}

      <p className={`hint-line${showDragHint ? ' is-shown' : ''}`} aria-hidden={!showDragHint}>
        {copy.journey.dragHint}
      </p>
      <p className={`hint-line${showMoonHint ? ' is-shown' : ''}`} aria-hidden={!showMoonHint}>
        {copy.journey.moonHint}
      </p>
      <p className="tex-credit">{copy.journey.credit}</p>
      <div className="sr-only" aria-live="polite">
        {lineShown ? copy.journey.moonLine : ''}
      </div>
    </section>
  );
}
