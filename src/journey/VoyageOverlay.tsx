import { CSSProperties, useEffect, useState } from 'react';
import { copy } from '../data/copy';
import { env } from '../lib/env';
import { useStory } from '../state/store';
import { isControl } from '../ui/input';
import { journeyClock } from './clock';
import { journeyInput } from './space';
import { VT } from './voyageTimeline';

/**
 * The screen layer over the voyage: the destination title, "hold to go faster" while
 * travelling, and dragging to look around Saturn as we arrive. Then Saturn takes over.
 */
export function VoyageOverlay() {
  const [t, setT] = useState(0);
  const [boosted, setBoosted] = useState(false);
  const [dragged, setDragged] = useState(false);

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const sec = journeyClock.t;
      setT(Math.floor(sec * 10) / 10);
      if (sec >= VT.end) {
        useStory.getState().goTo('saturn');
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      journeyClock.boostTarget = 0;
      journeyInput.dragYaw = journeyInput.dragPitch = 0;
      journeyInput.dragging = false;
    };
  }, []);

  const boostWindow = t >= VT.boostFrom && t < VT.boostTo;
  const dragWindow = t >= VT.dragFrom && t < VT.end - 1;

  // hold anywhere (or Space) to go faster
  useEffect(() => {
    if (!boostWindow) {
      journeyClock.boostTarget = 0;
      return;
    }
    const on = (e: PointerEvent) => {
      if (e.button > 0 || isControl(e.target)) return;
      journeyClock.boostTarget = env.reducedMotion ? 0.5 : 1;
      setBoosted(true);
    };
    const off = () => (journeyClock.boostTarget = 0);
    const kd = (e: KeyboardEvent) => {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        journeyClock.boostTarget = env.reducedMotion ? 0.5 : 1;
        setBoosted(true);
      }
    };
    const ku = (e: KeyboardEvent) => {
      if (e.key === ' ' || e.key === 'Enter') off();
    };
    window.addEventListener('pointerdown', on);
    window.addEventListener('pointerup', off);
    window.addEventListener('pointercancel', off);
    window.addEventListener('keydown', kd);
    window.addEventListener('keyup', ku);
    return () => {
      journeyClock.boostTarget = 0;
      window.removeEventListener('pointerdown', on);
      window.removeEventListener('pointerup', off);
      window.removeEventListener('pointercancel', off);
      window.removeEventListener('keydown', kd);
      window.removeEventListener('keyup', ku);
    };
  }, [boostWindow]);

  // drag to look around Saturn
  useEffect(() => {
    if (!dragWindow) return;
    let down: { x: number; y: number; yaw: number; pitch: number } | null = null;
    const pd = (e: PointerEvent) => {
      if (e.button > 0 || isControl(e.target)) return;
      down = { x: e.clientX, y: e.clientY, yaw: journeyInput.dragYaw, pitch: journeyInput.dragPitch };
      journeyInput.dragging = true;
    };
    const pm = (e: PointerEvent) => {
      if (!down) return;
      const w = window.innerWidth;
      journeyInput.dragYaw = Math.max(-1.6, Math.min(1.6, down.yaw + ((e.clientX - down.x) / w) * Math.PI * 0.9));
      journeyInput.dragPitch = Math.max(-0.7, Math.min(0.7, down.pitch + ((e.clientY - down.y) / w) * Math.PI * 0.6));
      if (Math.hypot(e.clientX - down.x, e.clientY - down.y) > 12) setDragged(true);
    };
    const pu = () => {
      down = null;
      journeyInput.dragging = false;
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
  }, [dragWindow]);

  const preOn = t >= VT.preludeIn && t < VT.preludeOut + 1.8;
  const preOut = t >= VT.preludeOut;
  const titleOn = t >= VT.titleIn && t < VT.titleOut + 1.6;
  const titleOut = t >= VT.titleOut;
  const showBoostHint = boostWindow && t >= VT.boostFrom + 1 && !boosted;
  const showDragHint = t >= VT.arrive + 1 && t < VT.end - 1 && !dragged;
  const v = copy.voyage;
  const letters = Array.from(v.title);

  return (
    <section className={`vo${env.reducedMotion ? ' is-calm' : ''}`} aria-label={v.label}>
      {preOn && <p className={`vo-prelude${preOut ? ' is-out' : ''}`}>{v.prelude}</p>}
      {titleOn && (
        <div className={`vo-title${titleOut ? ' is-out' : ''}`}>
          <p className="vo-date">{v.date}</p>
          <h2 className="vo-dest" aria-label={v.title}>
            {letters.map((ch, i) => (
              <span key={i} aria-hidden="true" style={{ '--i': i } as CSSProperties}>
                {ch === ' ' ? ' ' : ch}
              </span>
            ))}
          </h2>
        </div>
      )}
      <p className={`hint-line${showBoostHint ? ' is-shown' : ''}`} aria-hidden={!showBoostHint}>
        {v.boostHint}
      </p>
      <p className={`hint-line${showDragHint ? ' is-shown' : ''}`} aria-hidden={!showDragHint}>
        {v.dragHint}
      </p>
      <div className="sr-only" aria-live="polite">
        {preOn && !preOut ? v.prelude : titleOn && !titleOut ? `${v.date}. ${v.title}` : ''}
      </div>
    </section>
  );
}
