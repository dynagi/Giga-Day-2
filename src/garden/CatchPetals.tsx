import { CSSProperties, useEffect, useRef, useState } from 'react';

/**
 * While the flowers speak: a few petals drift down. Tapping one bursts it into
 * sparkles and a little butterfly flutters out. Purely playful; the petals are the
 * only things that take a tap, so the poem itself is never blocked.
 */

interface Petal {
  id: number;
  x: number; // vw
  dur: number; // s
  drift: number; // px
  size: number;
  hue: string;
  rot: number;
}
interface Pop {
  id: number;
  x: number;
  y: number;
  hue: string;
}

const HUES = ['#f2bdd6', '#dccbf6', '#c4afeb', '#f6eee0', '#eca8c9'];
const MAX_ALIVE = 3;

export function CatchPetals({ active, onCatch }: { active: boolean; onCatch: () => void }) {
  const [petals, setPetals] = useState<Petal[]>([]);
  const [pops, setPops] = useState<Pop[]>([]);
  const nextId = useRef(1);

  // spawn a petal every few seconds while active
  useEffect(() => {
    if (!active) return;
    const spawn = () =>
      setPetals((list) => {
        if (list.length >= MAX_ALIVE) return list;
        // keep away from the very middle column where the poem is densest
        const side = Math.random() < 0.5 ? -1 : 1;
        const x = 50 + side * (14 + Math.random() * 30);
        return [
          ...list,
          {
            id: nextId.current++,
            x,
            dur: 9 + Math.random() * 4,
            drift: (Math.random() - 0.5) * 140,
            size: 16 + Math.random() * 8,
            hue: HUES[(Math.random() * HUES.length) | 0],
            rot: Math.random() * 360,
          },
        ];
      });
    const first = window.setTimeout(spawn, 900);
    const id = window.setInterval(spawn, 2600);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(id);
    };
  }, [active]);

  const remove = (id: number) => setPetals((list) => list.filter((p) => p.id !== id));

  const catchIt = (p: Petal, e: React.PointerEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    const r = e.currentTarget.getBoundingClientRect();
    const pop = { id: p.id, x: r.left + r.width / 2, y: r.top + r.height / 2, hue: p.hue };
    remove(p.id);
    setPops((list) => [...list, pop]);
    window.setTimeout(() => setPops((list) => list.filter((q) => q.id !== pop.id)), 3200);
    onCatch();
  };

  return (
    <div className={`cp${active ? '' : ' is-done'}`} aria-hidden="true">
      {petals.map((p) => (
        <button
          key={p.id}
          type="button"
          tabIndex={-1}
          className="cp-petal"
          style={
            {
              left: `${p.x}vw`,
              '--dur': `${p.dur}s`,
              '--drift': `${p.drift}px`,
              '--size': `${p.size}px`,
              '--hue': p.hue,
              '--rot': `${p.rot}deg`,
            } as CSSProperties
          }
          onPointerDown={(e) => catchIt(p, e)}
          onAnimationEnd={() => remove(p.id)}
        >
          <span className="cp-petal-shape" />
        </button>
      ))}
      {pops.map((q) => (
        <div key={q.id} className="cp-pop" style={{ left: q.x, top: q.y, '--hue': q.hue } as CSSProperties}>
          {Array.from({ length: 8 }, (_, i) => (
            <span key={i} className="cp-spark" style={{ '--a': `${i * 45}deg` } as CSSProperties} />
          ))}
          <span className="cp-fly">
            <svg viewBox="-20 -20 40 40" width="34" height="34">
              <g className="cp-wings">
                <ellipse cx="-8" cy="-5" rx="9" ry="7" fill={q.hue} opacity="0.95" transform="rotate(-25 -8 -5)" />
                <ellipse cx="8" cy="-5" rx="9" ry="7" fill={q.hue} opacity="0.95" transform="rotate(25 8 -5)" />
                <ellipse cx="-6" cy="5" rx="6" ry="5" fill={q.hue} opacity="0.8" />
                <ellipse cx="6" cy="5" rx="6" ry="5" fill={q.hue} opacity="0.8" />
              </g>
              <ellipse cx="0" cy="0" rx="1.4" ry="8" fill="#2e1e48" />
            </svg>
          </span>
        </div>
      ))}
    </div>
  );
}
