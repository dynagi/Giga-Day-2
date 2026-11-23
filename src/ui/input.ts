import { useEffect, useRef } from 'react';

/** Ignore taps/keys that land on a persistent control (the sound toggle). */
export function isControl(target: EventTarget | null) {
  return target instanceof Element && !!target.closest('[data-control]');
}

/**
 * Calls `onTap` for any tap/click anywhere, or Space/Enter,
 * while the component using it is mounted.
 */
export function useTapAnywhere(onTap: () => void, enabled = true) {
  const cb = useRef(onTap);
  cb.current = onTap;
  useEffect(() => {
    if (!enabled) return;
    const down = (e: PointerEvent) => {
      if (e.button > 0 || isControl(e.target)) return;
      cb.current();
    };
    const key = (e: KeyboardEvent) => {
      if (e.repeat || isControl(e.target)) return;
      if (e.key === 'Enter' || e.key === ' ' || e.code === 'Space') {
        e.preventDefault();
        cb.current();
      }
    };
    window.addEventListener('pointerdown', down);
    window.addEventListener('keydown', key);
    return () => {
      window.removeEventListener('pointerdown', down);
      window.removeEventListener('keydown', key);
    };
  }, [enabled]);
}
