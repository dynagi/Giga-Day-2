import { useEffect, useRef } from 'react';
import { copy } from '../data/copy';
import { startMusic } from '../audio/music';
import { useStory } from '../state/store';

export function Gate() {
  const phase = useStory((s) => s.phase);
  const leaving = phase !== 'gate';
  const ref = useRef<HTMLButtonElement>(null);

  const begin = () => {
    if (useStory.getState().phase !== 'gate') return;
    startMusic();
    useStory.getState().goTo('garden');
  };

  useEffect(() => {
    ref.current?.focus({ preventScroll: true });
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        begin();
      }
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, []);

  return (
    <button
      ref={ref}
      type="button"
      className={`gate${leaving ? ' is-leaving' : ''}`}
      aria-label={copy.gate.aria}
      tabIndex={leaving ? -1 : 0}
      onClick={begin}
    >
      <span className="gate-hello">{copy.gate.hello}</span>
      <span className="gate-point" aria-hidden="true" />
      <span className="gate-line" aria-hidden="true">
        {copy.gate.line}
      </span>
    </button>
  );
}
