import { useEffect, useRef } from 'react';
import { copy } from '../data/copy';
import { journeyClock } from './clock';
import { ET, WELCOME } from './earthTimeline';
import { planetScreen } from './WelcomePlanets';

/**
 * The planets' welcome lines, each in a speech bubble that follows its planet on screen,
 * and the little "psst" afterwards. Positions are read from the 3D scene every frame.
 */
export function WelcomeBubbles({ t }: { t: number }) {
  const refs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      for (const w of WELCOME) {
        const el = refs.current[w.id];
        const s = planetScreen[w.id];
        if (!el || !s) continue;
        const W = window.innerWidth;
        const H = window.innerHeight;
        // above the planet, kept fully inside the screen (by the bubble's own width)
        const bw = (el.firstElementChild as HTMLElement | null)?.offsetWidth ?? 200;
        const half = bw / 2 + 10;
        const x = Math.min(W - half, Math.max(half, s.x));
        const y = Math.min(H - 120, Math.max(90, s.y - Math.max(18, s.r) - 14));
        el.style.transform = `translate(${x}px, ${y}px)`;
        // the bubble's tail still points at the planet when the bubble is nudged inside the screen
        el.style.setProperty('--tail', `${Math.max(-half + 24, Math.min(half - 24, s.x - x))}px`);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const lines = copy.journey.welcome;
  const psst = t >= ET.psstFrom && t < ET.psstTo;

  return (
    <div className="wb" aria-live="polite">
      {WELCOME.map((w) => {
        const on = t >= w.from && t < w.to;
        const line = lines.find((l) => l.id === w.id)!;
        const shown = on && journeyClock.t < w.to;
        return (
          <div key={w.id} className="wb-anchor" ref={(el) => (refs.current[w.id] = el)}>
            {shown && (
              <div className="wb-bubble">
                <span className="wb-name">{line.name}</span>
                <span className="wb-line">{line.line}</span>
              </div>
            )}
          </div>
        );
      })}
      {psst && <p className="wb-psst">{copy.journey.psst}</p>}
    </div>
  );
}
