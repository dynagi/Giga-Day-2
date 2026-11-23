import { CSSProperties, useEffect, useMemo, useRef, useState } from 'react';
import { copy } from '../data/copy';
import { env } from '../lib/env';
import { useStory } from '../state/store';
import { createGarden, type GardenHandle } from './gardenField';
import { CatchPetals } from './CatchPetals';

// ---------------------------------------------------------------------------
// Timing (ms). All pacing for the garden sequence lives here.
// ---------------------------------------------------------------------------
const T = {
  rememberIn: 600, // after the tap, the first words begin
  rememberWordStagger: 85,
  rememberHold: 4300, // after the last word has settled
  rememberOut: 1400,
  gap: 500,
  saysAfterGrowth: 6200, // the garden establishes itself first
  saysHold: 3400, // "Garden want to say something to you" (incl. its fade-in)
  saysOut: 1200,
  beforePoem: 500,
  lineStep: 2300,
  stanzaGap: 1100,
  lineAnim: 1500,
  poemHold: 6000,
  poemOut: 1700,
  seeHold: 5200,
  seeOut: 1500,
  bloomHoldAfter: 4500, // enjoy the full bloom before moving on
  touchHintAt: 1300, // "touch the garden" appears if she hasn't touched yet
  autoBloomIfIdle: 3000, // no touch at all → the garden blooms by itself, as before
  touchWindow: 6500, // after her first touch, how long she paints before the rest blooms by itself
  petalHintAt: 3500,
  petalHintFor: 6000,
  leave: 2200,
};

type Step = 'remember' | 'rememberOut' | 'grow' | 'says' | 'saysOut' | 'poem' | 'poemOut' | 'see' | 'seeOut' | 'leave';

export function GardenStory() {
  const g = copy.garden;
  const [step, setStep] = useState<Step>('remember');
  const [gardenOn, setGardenOn] = useState(false);
  const [blooming, setBlooming] = useState(false);
  const [touchHint, setTouchHint] = useState(false);
  const [petalHint, setPetalHint] = useState(false);
  const touched = useRef(false);
  const fullBloom = useRef(false);
  const caught = useRef(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const garden = useRef<GardenHandle | null>(null);
  const timers = useRef<number[]>([]);
  const at = (ms: number, fn: () => void) => timers.current.push(window.setTimeout(fn, ms));

  const rememberWords = g.remember.split(' ');
  const rememberDone = (rememberWords.length - 1) * T.rememberWordStagger + 1300;

  const lineStarts = useMemo(() => {
    const out: number[] = [];
    let t = 200;
    g.poem.forEach((stanza, si) =>
      stanza.forEach((_, li) => {
        if (si > 0 || li > 0) t += T.lineStep + (li === 0 ? T.stanzaGap : 0);
        out.push(t);
      }),
    );
    return out;
  }, [g.poem]);
  const poemDone = lineStarts[lineStarts.length - 1] + T.lineAnim;

  // the whole sequence, start to finish
  useEffect(() => {
    let t = T.rememberIn;
    t += rememberDone + T.rememberHold;
    at(t, () => setStep('rememberOut'));
    t += T.rememberOut + T.gap;
    at(t, () => {
      setStep('grow');
      setGardenOn(true); // the garden only appears once both texts are gone
    });
    t += T.saysAfterGrowth;
    at(t, () => setStep('says'));
    t += T.saysHold;
    at(t, () => setStep('saysOut'));
    t += T.saysOut + T.beforePoem;
    at(t, () => setStep('poem'));
    t += poemDone + T.poemHold;
    at(t, () => setStep('poemOut'));
    t += T.poemOut;
    at(t, () => {
      setStep('see');
      setBlooming(true);
      // "See what you do with us" holds, then lets the garden have the stage
      at(T.seeHold, () => setStep('seeOut'));
      at(T.touchHintAt, () => !touched.current && setTouchHint(true));
      at(T.autoBloomIfIdle, () => !touched.current && bloomAll());
    });
    return () => {
      timers.current.forEach((id) => window.clearTimeout(id));
      timers.current = [];
    };
    // runs once per mount
  }, []);

  /** The rest of the garden blooms by itself; then the scene moves on after the full bloom. */
  function bloomAll() {
    if (fullBloom.current) return;
    fullBloom.current = true;
    setTouchHint(false);
    const span = garden.current?.bloom() ?? 0;
    const until = Math.max(T.seeHold + T.seeOut, span * 1000) + T.bloomHoldAfter;
    at(until, () => setStep('leave'));
    at(until + T.leave, () => useStory.getState().goTo('intro'));
  }

  // her touch on the garden during "See what you do with us": flowers spring up under her finger
  const touchable = step === 'see' || step === 'seeOut';
  useEffect(() => {
    if (!touchable) return;
    let pressed = false;
    let lastX = -999;
    const local = (e: PointerEvent) => {
      const el = canvasRef.current;
      if (!el) return null;
      const r = el.getBoundingClientRect(); // includes the pull-back scale
      return [((e.clientX - r.left) * el.clientWidth) / r.width, ((e.clientY - r.top) * el.clientHeight) / r.height] as const;
    };
    const grow = (e: PointerEvent) => {
      const p = local(e);
      if (!p || !garden.current) return;
      garden.current.touchBloom(p[0], p[1]);
      lastX = p[0];
      if (!touched.current) {
        touched.current = true;
        setTouchHint(false);
        at(T.touchWindow, bloomAll);
      }
    };
    const down = (e: PointerEvent) => {
      if (e.button > 0) return;
      pressed = true;
      grow(e);
    };
    const move = (e: PointerEvent) => {
      const p = local(e);
      if (!p || !garden.current) return;
      if (pressed && Math.abs(p[0] - lastX) > 40) grow(e);
      else garden.current.lure(p[0], p[1]); // a gliding mouse: butterflies follow it
    };
    const up = () => (pressed = false);
    window.addEventListener('pointerdown', down);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    return () => {
      window.removeEventListener('pointerdown', down);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [touchable]);

  // a gentle hint to catch a petal while the flowers speak
  const petalTime = step === 'poem';
  useEffect(() => {
    if (!petalTime || env.reducedMotion) return;
    const a = window.setTimeout(() => !caught.current && setPetalHint(true), T.petalHintAt);
    const b = window.setTimeout(() => setPetalHint(false), T.petalHintAt + T.petalHintFor);
    return () => {
      window.clearTimeout(a);
      window.clearTimeout(b);
      setPetalHint(false);
    };
  }, [petalTime]);

  // the garden engine, from Day 1, mounted fresh each time so it always regrows
  useEffect(() => {
    if (!gardenOn || !canvasRef.current) return;
    const handle = createGarden(canvasRef.current, { quality: env.lowPower ? 'low' : 'high', reduced: env.reducedMotion }, () => {});
    garden.current = handle;
    return () => {
      handle.destroy();
      garden.current = null;
    };
  }, [gardenOn]);

  const is = (...s: Step[]) => s.includes(step);
  const showPoem = is('poem', 'poemOut');
  const showSays = is('says', 'saysOut');
  const showSee = is('see', 'seeOut');

  const announce = is('remember')
      ? g.remember
      : showPoem
        ? g.poem.flat().join(' ')
        : showSays
          ? g.says
          : showSee
          ? g.see
          : '';

  return (
    <section className={`gs gs-step-${step}${env.reducedMotion ? ' is-still' : ''}`} aria-label={g.label}>
      {/* before the garden: the cosmic sky, a lavender glow, a few floating motes */}
      <div className="gs-backdrop" aria-hidden="true" />
      <div className="gs-motes" aria-hidden="true">
        {Array.from({ length: 12 }, (_, i) => (
          <span key={i} className="gs-mote" style={{ '--i': i, left: `${6 + i * 7.7}%`, top: `${18 + ((i * 37) % 64)}%` } as CSSProperties} />
        ))}
      </div>

      {gardenOn && (
        <div className={`garden${blooming ? ' is-blooming' : ''}`} aria-hidden="true">
          <div className="garden__sky" />
          <div className="garden__glow" />
          <div className="garden__warm" />
          <canvas ref={canvasRef} className="garden__canvas" />
          <div className="garden__mist" />
        </div>
      )}

      {is('remember', 'rememberOut') && (
        <div className="gs-center" aria-hidden="true">
          <p className={`gs-remember${step === 'rememberOut' ? ' is-out' : ''}`}>
            {rememberWords.map((w, i) => (
              <span key={i}>
                <span className="gs-word" style={{ '--d': `${T.rememberIn + i * T.rememberWordStagger}ms` } as CSSProperties}>
                  {w}
                </span>
                {i < rememberWords.length - 1 ? ' ' : ''}
              </span>
            ))}
          </p>
        </div>
      )}

      {/* the flowers speak: no panel behind the words, just the garden */}
      {showPoem && (
        <div className={`gs-poem${step === 'poemOut' ? ' is-out' : ''}`} aria-hidden="true">
          {g.poem.map((stanza, si) => (
            <div className="gs-stanza" key={si}>
              {stanza.map((line, li) => (
                <p className="gs-line" key={li} style={{ animationDelay: `${lineStarts[si * 4 + li]}ms` }}>
                  {line}
                </p>
              ))}
            </div>
          ))}
        </div>
      )}

      {showSays && (
        <div className="gs-says-wrap" aria-hidden="true">
          <p className={`gs-says${step === 'saysOut' ? ' is-out' : ''}`}>{g.says}</p>
        </div>
      )}

      {showSee && (
        <div className="gs-see-wrap" aria-hidden="true">
          <p className={`gs-see${step === 'seeOut' ? ' is-out' : ''}`}>{g.see}</p>
        </div>
      )}

      {gardenOn && !env.reducedMotion && (
        <CatchPetals
          active={petalTime}
          onCatch={() => {
            caught.current = true;
            setPetalHint(false);
          }}
        />
      )}

      <p className={`hint-line${touchHint ? ' is-shown' : ''}`} aria-hidden={!touchHint}>
        {g.touchHint}
      </p>
      <p className={`hint-line${petalHint ? ' is-shown' : ''}`} aria-hidden={!petalHint}>
        {g.petalHint}
      </p>

      <div className="sr-only" aria-live="polite">
        {announce}
      </div>
    </section>
  );
}
