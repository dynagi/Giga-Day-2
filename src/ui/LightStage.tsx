import { useEffect, useRef, useState } from 'react';
import { copy } from '../data/copy';
import { light } from '../light/lightSim';
import { BASE_DEPTH } from '../light/lightSim';
import { useStory } from '../state/store';
import { isControl } from './input';
import { LightHint } from './LightHint';

/**
 * Runs the light simulation for the light → transition → next phases,
 * owns the hit area and keyboard, and draws the CSS light when WebGL is missing.
 */
export function LightStage() {
  const phase = useStory((s) => s.phase);
  const webgl = useStory((s) => s.webgl);
  const stageRef = useRef<HTMLDivElement>(null);
  const dotRef = useRef<HTMLDivElement>(null);
  const pulseRef = useRef<HTMLDivElement>(null);
  const [caught, setCaught] = useState(false);
  const interactive = phase === 'light';

  // simulation loop
  useEffect(() => {
    const el = stageRef.current!;
    const measure = () => {
      const r = el.getBoundingClientRect();
      light.resize(r.width, r.height);
    };
    measure();
    light.start();
    const ro = new ResizeObserver(measure);
    ro.observe(el);

    let raf = 0;
    let last = performance.now();
    const loop = (t: number) => {
      light.tick((t - last) / 1000);
      last = t;
      const dot = dotRef.current;
      if (dot) {
        const breath = 1 + 0.04 * (1 - Math.cos((t / 1000) * (Math.PI * 2) / 2.5));
        const s = light.scale * breath * (BASE_DEPTH / light.depth) * (1 + 0.35 * light.glow);
        dot.style.transform = `translate3d(${light.x}px, ${light.y}px, 0) translate(-50%, -50%) scale(${s})`;
        dot.style.opacity = String(light.opacity);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    const off = light.on((e) => {
      if (e.type === 'catch') setCaught(true);
      const pulse = pulseRef.current;
      if (pulse && e.type !== 'twinkle') {
        pulse.style.left = `${e.x}px`;
        pulse.style.top = `${e.y}px`;
        pulse.classList.remove('go', 'go-big');
        void pulse.offsetWidth; // restart the CSS animation
        pulse.classList.add(e.type === 'catch' ? 'go-big' : 'go');
      }
    });

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      off();
      light.reset();
      useStory.getState().setHint(false);
    };
  }, []);

  // pointer: hit-testing taps, curious lean toward a mouse, keyboard catch
  useEffect(() => {
    if (!interactive) return;
    const el = stageRef.current!;
    const local = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      return [e.clientX - r.left, e.clientY - r.top] as const;
    };
    const down = (e: PointerEvent) => {
      if (e.button > 0 || isControl(e.target)) return;
      const [x, y] = local(e);
      light.pointerDown(x, y);
    };
    const move = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return;
      const [x, y] = local(e);
      light.cursor.x = x;
      light.cursor.y = y;
      light.cursor.active = true;
    };
    const leave = () => (light.cursor.active = false);
    const key = (e: KeyboardEvent) => {
      if (e.repeat || isControl(e.target)) return;
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        light.keyCatch();
      }
    };
    window.addEventListener('pointerdown', down);
    window.addEventListener('pointermove', move);
    document.documentElement.addEventListener('pointerleave', leave);
    window.addEventListener('keydown', key);
    return () => {
      window.removeEventListener('pointerdown', down);
      window.removeEventListener('pointermove', move);
      document.documentElement.removeEventListener('pointerleave', leave);
      window.removeEventListener('keydown', key);
      light.cursor.active = false;
    };
  }, [interactive]);

  return (
    <div ref={stageRef} className={`light-stage${interactive ? ' is-interactive' : ''}`}>
      {!webgl && (
        <>
          <div ref={dotRef} className="css-light" aria-hidden="true" />
          <div ref={pulseRef} className="css-pulse" aria-hidden="true" />
        </>
      )}
      {interactive && <LightHint />}
      <div className="sr-only" aria-live="polite">
        {caught ? copy.light.srCaught : interactive ? copy.light.srIntro : ''}
      </div>
    </div>
  );
}
