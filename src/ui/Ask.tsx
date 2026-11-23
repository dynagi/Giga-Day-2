import { CSSProperties, useEffect, useRef, useState } from 'react';
import { copy } from '../data/copy';
import { light } from '../light/lightSim';
import { fx } from '../state/fx';
import { env } from '../lib/env';
import { isControl } from './input';

// ---------------------------------------------------------------------------
// Timing (ms). Pacing for this scene lives only here.
// ---------------------------------------------------------------------------
const T = {
  requestAt: 700,
  requestWordStagger: 110,
  choicesAfterRequest: 1300, // after the last word of the request has settled
  idleNudge: 7000, // if she hasn't chosen yet, the options breathe a little
  chosenOut: 1300, // options + request fade away

  // only after "Bas bhi kariye…"
  tease: 4100, // the dramatic plea, before "Accha thik hai"
  okay: 2600, // "Accha thik hai" holds
  teaseOut: 1100,

  // shared preamble
  simple: 1900, // "In simple words I say," alone
  compliment: 3000, // + "Acchi lag rahi ho"
  simpleOut: 1100,
  fromHeart: 2500, // "But jab mai dil se bolu to,"
  fromHeartOut: 1100,

  // the poem
  lineAnim: 1300,
  fullHold: 5600,
  tapMinGap: 650, // a quick double tap still reveals lines one by one
  nextHintAfter: 1800,
  poemOut: 1700,
};

/** Whether the "enough" path also gets the "In simple words…" preamble before the poem. */
const ENOUGH_PATH_INCLUDES_PREAMBLE = true;

type Step =
  | 'request'
  | 'choices'
  | 'chosen'
  | 'tease'
  | 'okay'
  | 'teaseOut'
  | 'simple'
  | 'compliment'
  | 'simpleOut'
  | 'fromHeart'
  | 'fromHeartOut'
  | 'poem'
  | 'poemOut'
  | 'end';

type Choice = 'yes' | 'enough';

function Words({ text, base, stagger, className = 'ak-word' }: { text: string; base: number; stagger: number; className?: string }) {
  const words = text.split(' ');
  return (
    <>
      {words.map((w, i) => (
        <span key={i}>
          <span className={className} style={{ '--d': `${base + i * stagger}ms`, '--k': i } as CSSProperties}>
            {w}
          </span>
          {i < words.length - 1 ? ' ' : ''}
        </span>
      ))}
    </>
  );
}

export function Ask() {
  const c = copy.ask;
  const [step, setStep] = useState<Step>('request');
  const [choice, setChoice] = useState<Choice | null>(null);
  const [nudge, setNudge] = useState(false);
  const locked = useRef(false);
  const timers = useRef<number[]>([]);

  const requestWords = c.request.split(' ').length;
  const requestDone = T.requestAt + (requestWords - 1) * T.requestWordStagger + 1200;


  const at = (ms: number, fn: () => void) => timers.current.push(window.setTimeout(fn, ms));

  // intro: the request, then the two choices
  useEffect(() => {
    fx.hush.target = 1; // stay quiet and intimate, like the poem before
    at(requestDone + T.choicesAfterRequest - 1200, () => setStep('choices'));
    return () => {
      timers.current.forEach((id) => window.clearTimeout(id));
      timers.current = [];
      fx.hush.target = 0;
    };
  }, []);

  // a gentle nudge if she waits (no auto-focus: neither option should look pre-selected)
  useEffect(() => {
    if (step !== 'choices') return;
    const id = window.setTimeout(() => setNudge(true), T.idleNudge);
    return () => window.clearTimeout(id);
  }, [step]);

  function choose(which: Choice) {
    if (locked.current || step !== 'choices') return; // no double triggers
    locked.current = true;
    setChoice(which);
    setStep('chosen');

    let t = T.chosenOut;
    const go = (s: Step, dur: number) => {
      at(t, () => setStep(s));
      t += dur;
    };
    if (which === 'enough') {
      go('tease', T.tease);
      go('okay', T.okay);
      go('teaseOut', T.teaseOut);
    }
    if (which === 'yes' || ENOUGH_PATH_INCLUDES_PREAMBLE) {
      go('simple', T.simple);
      go('compliment', T.compliment);
      go('simpleOut', T.simpleOut);
      go('fromHeart', T.fromHeart);
      go('fromHeartOut', T.fromHeartOut);
    }
    // the poem now unfolds tap by tap; it hands over to finishPoem() when every line is out
    at(t, () => setStep('poem'));
  }

  function finishPoem() {
    at(T.lineAnim + T.fullHold, () => setStep('poemOut'));
    at(T.lineAnim + T.fullHold + T.poemOut, () => {
      setStep('end');
      // the light is born again at the center, and the journey continues
      fx.hush.target = 0;
      light.reform();
    });
  }

  // tap to bloom the next line (with a little burst of petals where she taps)
  const totalLines = c.poem.flat().length;
  const [shownLines, setShownLines] = useState(0);
  const [nextHint, setNextHint] = useState(false);
  const petalsRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (step !== 'poem') return;
    let shown = 0;
    let lastAt = 0;
    let auto = 0;
    let hintT = 0;
    let tapped = false;
    const reveal = () => {
      if (shown >= totalLines) return;
      shown++;
      lastAt = performance.now();
      setShownLines(shown);
      setNextHint(false);
      window.clearTimeout(auto);
      window.clearTimeout(hintT);
      if (shown >= totalLines) {
        finishPoem();
        return;
      }
      // the next line waits for her tap
      if (!tapped) hintT = window.setTimeout(() => setNextHint(true), T.nextHintAfter);
    };
    const tap = (x: number, y: number) => {
      if (shown >= totalLines || (shown > 0 && performance.now() - lastAt < T.tapMinGap)) return;
      tapped = true;
      burst(x, y);
      reveal();
    };
    const down = (e: PointerEvent) => {
      if (e.button > 0 || isControl(e.target)) return;
      tap(e.clientX, e.clientY);
    };
    const key = (e: KeyboardEvent) => {
      if ((e.key === 'Enter' || e.key === ' ') && !e.repeat && !isControl(e.target)) {
        e.preventDefault();
        tap(window.innerWidth / 2, window.innerHeight * 0.75);
      }
    };
    // the first line also waits for her tap
    const first = window.setTimeout(() => setNextHint(true), 600);
    window.addEventListener('pointerdown', down);
    window.addEventListener('keydown', key);
    return () => {
      window.clearTimeout(first);
      window.clearTimeout(auto);
      window.clearTimeout(hintT);
      window.removeEventListener('pointerdown', down);
      window.removeEventListener('keydown', key);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  /** A small burst of petals at (x, y): plain DOM, removed after its animation. */
  function burst(x: number, y: number) {
    const host = petalsRef.current;
    if (!host || env.reducedMotion) return;
    const hues = ['#f2bdd6', '#dccbf6', '#c4afeb', '#f6eee0', '#eca8c9'];
    for (let k = 0; k < 9; k++) {
      const el = document.createElement('span');
      el.className = 'ak-petal';
      const a = (k / 9) * Math.PI * 2 + Math.random() * 0.5;
      const d = 40 + Math.random() * 60;
      el.style.left = `${x}px`;
      el.style.top = `${y}px`;
      el.style.setProperty('--dx', `${Math.cos(a) * d}px`);
      el.style.setProperty('--dy', `${Math.sin(a) * d * 0.7 + 40}px`);
      el.style.setProperty('--r', `${Math.random() * 360}deg`);
      el.style.background = hues[(Math.random() * hues.length) | 0];
      host.appendChild(el);
      window.setTimeout(() => el.remove(), 1700);
    }
  }

  const is = (...s: Step[]) => s.includes(step);
  const showRequest = is('request', 'choices', 'chosen');
  const showTease = is('tease', 'okay', 'teaseOut');
  const showSimple = is('simple', 'compliment', 'simpleOut');
  const showHeartLine = is('fromHeart', 'fromHeartOut');
  const showPoem = is('poem', 'poemOut');

  const announce = showRequest
    ? c.request
    : showTease
      ? is('okay', 'teaseOut') ? c.okay : c.tease
      : showSimple
        ? is('compliment', 'simpleOut') ? c.compliment : c.simple
        : showHeartLine
          ? c.fromHeart
          : showPoem
            ? c.poem.flat().join(' ')
            : '';

  return (
    <section className={`ak step-${step}`} aria-label="A request">
      <div className="ak-glow" aria-hidden="true" />

      {showRequest && (
        <div className={`ak-block ak-request-block${step === 'chosen' ? ' is-out' : ''}`}>
          <p className="ak-request" aria-hidden="true">
            <Words text={c.request} base={T.requestAt} stagger={T.requestWordStagger} />
          </p>
          <div
            className={`ak-options${is('choices', 'chosen') ? ' is-shown' : ''}${nudge ? ' is-nudge' : ''}`}
            role="group"
            aria-label="Choose one"
          >
            <button
              type="button"
              className={`ak-option${choice === 'yes' ? ' is-chosen' : ''}${choice === 'enough' ? ' is-dropped' : ''}`}
              onClick={() => choose('yes')}
              disabled={step !== 'choices'}
              tabIndex={step === 'choices' ? 0 : -1}
            >
              <span className="ak-option-shine" aria-hidden="true" />
              {c.yes}
            </button>
            <button
              type="button"
              className={`ak-option${choice === 'enough' ? ' is-chosen' : ''}${choice === 'yes' ? ' is-dropped' : ''}`}
              onClick={() => choose('enough')}
              disabled={step !== 'choices'}
              tabIndex={step === 'choices' ? 0 : -1}
            >
              <span className="ak-option-shine" aria-hidden="true" />
              {c.enough}
            </button>
          </div>
        </div>
      )}

      {showTease && (
        <div className={`ak-block${step === 'teaseOut' ? ' is-out' : ''}`} aria-hidden="true">
          <p className="ak-tease">
            <Words text={c.tease} base={150} stagger={95} className="ak-pop" />
          </p>
          {is('okay', 'teaseOut') && <p className="ak-okay">{c.okay}</p>}
        </div>
      )}

      {showSimple && (
        <div className={`ak-block${step === 'simpleOut' ? ' is-out' : ''}`} aria-hidden="true">
          <p className="ak-small ak-enter">{c.simple}</p>
          {is('compliment', 'simpleOut') && <p className="ak-compliment ak-enter">{c.compliment}</p>}
        </div>
      )}

      {showHeartLine && (
        <div className={`ak-block${step === 'fromHeartOut' ? ' is-out' : ''}`} aria-hidden="true">
          <p className="ak-small ak-enter">{c.fromHeart}</p>
        </div>
      )}

      {showPoem && (
        <div className={`ak-block ak-poem-block${step === 'poemOut' ? ' is-out' : ''}`} aria-hidden="true">
          <div className="ak-poem">
            {c.poem.map((pair, pi) => (
              <div className="ak-pair" key={pi}>
                {pair.map((line, li) => (
                  <p key={li} className={`ak-line${pi * 2 + li < shownLines ? ' is-on' : ''}`}>
                    {line}
                  </p>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      <div ref={petalsRef} className="ak-petals" aria-hidden="true" />
      <p className={`hint-line${nextHint && step === 'poem' ? ' is-shown' : ''}`} aria-hidden="true">
        {copy.hints.nextLine}
      </p>
      <div className="sr-only" aria-live="polite">
        {announce}
      </div>
    </section>
  );
}
