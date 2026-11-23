import { CSSProperties, useEffect, useMemo, useRef, useState } from 'react';
import { copy } from '../data/copy';
import { fx } from '../state/fx';
import { useStory } from '../state/store';
import { useTapAnywhere } from './input';

const STAGGER = 40;
const LETTER_MS = 900;
const SWEEP_MS = 1400;
const HOLD_MS = 3500;
const EXIT_MS = 1200;

type Step = 'pre' | 'label' | 'letters' | 'swipe' | 'sweep' | 'subtitle' | 'exit';
const ORDER: Step[] = ['pre', 'label', 'letters', 'swipe', 'sweep', 'subtitle', 'exit'];
/** If she doesn't swipe across the title, the gold light sweeps by itself, as before. */
const AUTO_SWEEP_AFTER = 3500;

function Letters({ text }: { text: string }) {
  let idx = 0;
  const words = text.split(' ');
  return (
    <>
      {words.map((w, wi) => (
        <span key={wi}>
          <span className="word">
            {Array.from(w).map((ch, ci) => (
              <span key={ci} className="ch" style={{ '--i': idx++ } as CSSProperties}>
                {ch}
              </span>
            ))}
          </span>
          {wi < words.length - 1 ? ' ' : ''}
        </span>
      ))}
    </>
  );
}

export function Identity() {
  const { label, title, subtitle } = copy.identity;
  const [step, setStep] = useState<Step>('pre');
  const exiting = useRef(false);
  const letterCount = useMemo(() => title.replace(/ /g, '').length, [title]);

  const exit = () => {
    if (exiting.current) return;
    exiting.current = true;
    setStep('exit');
  };

  const titleRef = useRef<HTMLHeadingElement>(null);
  const timers = useRef<number[]>([]);
  const at = (ms: number, fn: () => void) => timers.current.push(window.setTimeout(fn, ms));
  const [hint, setHint] = useState(false);
  const [mode, setMode] = useState<'auto' | 'hand' | null>(null);
  const [hand, setHand] = useState<number | null>(null); // her finger across the title, 0..1
  const swept = useRef(false);
  const stepRef = useRef<Step>('pre');
  stepRef.current = step;

  /** Everything after the sweep begins, exactly as before. */
  function afterSweep() {
    // a few stars around the title gently brighten…
    Object.assign(fx.focus, { x: 0, y: 0.08, r: 1.0, lo: 0.4, hi: 0.56, target: 1 });
    at(800, () => setStep((s) => (s === 'exit' ? s : 'subtitle')));
    // …then settle
    at(2400, () => (fx.focus.target = 0));
    at(800 + 1000 + HOLD_MS, exit);
  }
  function autoSweep() {
    if (swept.current) return;
    swept.current = true;
    setHint(false);
    setMode('auto');
    setStep((s) => (s === 'exit' ? s : 'sweep'));
    afterSweep();
  }
  function handSweepDone(from: number) {
    if (swept.current) return;
    swept.current = true;
    setHint(false);
    setMode('hand');
    setStep((s) => (s === 'exit' ? s : 'sweep'));
    // carry the light off the far edge
    const t0 = performance.now();
    const run = (now: number) => {
      const k = Math.min(1, (now - t0) / 450);
      setHand(from + (1.45 - from) * k);
      if (k < 1) requestAnimationFrame(run);
      else setHand(null);
    };
    requestAnimationFrame(run);
    afterSweep();
  }

  useEffect(() => {
    const lettersDone = 600 + letterCount * STAGGER + LETTER_MS;
    at(40, () => setStep('label'));
    at(640, () => setStep((s) => (s === 'exit' ? s : 'letters')));
    at(100 + lettersDone, () => {
      setStep((s) => (s === 'exit' ? s : 'swipe'));
      setHint(true);
    });
    at(100 + lettersDone + AUTO_SWEEP_AFTER, autoSweep);
    return () => {
      timers.current.forEach((id) => window.clearTimeout(id));
      timers.current = [];
      fx.focus.target = 0;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [letterCount]);

  // her swipe: the gold light follows her finger (or a gliding mouse) across the title
  useEffect(() => {
    if (step !== 'swipe') return;
    let pressed = false;
    let lo = 1;
    let hi = 0;
    const track = (e: PointerEvent) => {
      const el = titleRef.current;
      if (!el || swept.current) return;
      if (!pressed && e.pointerType !== 'mouse') return;
      const r = el.getBoundingClientRect();
      if (e.clientY < r.top - 70 || e.clientY > r.bottom + 70) return;
      const f = (e.clientX - r.left) / r.width;
      setHand(f);
      const c = Math.max(0, Math.min(1, f));
      lo = Math.min(lo, c);
      hi = Math.max(hi, c);
      if (hi - lo >= 0.7) handSweepDone(f);
    };
    const down = (e: PointerEvent) => {
      pressed = true;
      lo = 1;
      hi = 0;
      track(e);
    };
    const up = () => (pressed = false);
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') autoSweep();
    };
    window.addEventListener('pointerdown', down);
    window.addEventListener('pointermove', track);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    window.addEventListener('keydown', key);
    return () => {
      window.removeEventListener('pointerdown', down);
      window.removeEventListener('pointermove', track);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      window.removeEventListener('keydown', key);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  useEffect(() => {
    if (step !== 'exit') return;
    fx.focus.target = 0;
    const id = window.setTimeout(() => useStory.getState().goTo('light'), EXIT_MS);
    return () => window.clearTimeout(id);
  }, [step]);

  // a tap skips ahead as before, but only once the sweep has happened (before that, a touch is the swipe)
  useTapAnywhere(() => {
    if (swept.current) exit();
  });

  const reached = (s: Step) => ORDER.indexOf(step) >= ORDER.indexOf(s);
  const cls = [
    'identity',
    reached('label') && 'show-label',
    reached('letters') && 'show-letters',
    reached('sweep') && step !== 'exit' && mode === 'auto' && 'do-sweep',
    reached('subtitle') && 'show-subtitle',
    step === 'exit' && 'is-exit',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <section className={cls} style={{ '--sweep': `${SWEEP_MS}ms` } as CSSProperties}>
      <p className="id-label">{label}</p>
      <h1 className="id-title" aria-label={title} ref={titleRef}>
        <span className="id-title-base" aria-hidden="true">
          <Letters text={title} />
        </span>
        <span
          className="id-title-sweep"
          aria-hidden="true"
          style={
            hand === null
              ? undefined
              : ({
                  opacity: 1,
                  animation: 'none',
                  maskPosition: `${(1.5 - hand) * 50}% 0`,
                  WebkitMaskPosition: `${(1.5 - hand) * 50}% 0`,
                } as CSSProperties)
          }
        >
          <Letters text={title} />
        </span>
      </h1>
      <p className="id-subtitle">{subtitle}</p>
      <p className={`hint-line${hint ? ' is-shown' : ''}`} aria-hidden={!hint}>
        {copy.hints.swipe}
      </p>
    </section>
  );
}
