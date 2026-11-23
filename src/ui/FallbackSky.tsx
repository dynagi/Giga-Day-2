import { CSSProperties, useMemo } from 'react';
import { env } from '../lib/env';

/** CSS-only background for devices without WebGL. */
export function FallbackSky() {
  const stars = useMemo(
    () =>
      Array.from({ length: env.lowPower ? 60 : 110 }, () => ({
        x: Math.random() * 100,
        y: Math.random() * 100,
        s: 1 + Math.random() * 2,
        d: Math.random() * 6,
        gold: Math.random() < 0.06,
      })),
    [],
  );
  return (
    <div className="fallback-sky" aria-hidden="true">
      {stars.map((st, i) => (
        <span
          key={i}
          className={`fs${st.gold ? ' gold' : ''}`}
          style={{ left: `${st.x}%`, top: `${st.y}%`, width: st.s, height: st.s, animationDelay: `${-st.d}s` } as CSSProperties}
        />
      ))}
    </div>
  );
}
