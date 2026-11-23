import { CSSProperties, useEffect, useMemo, useRef, useState } from 'react';
import { copy } from '../data/copy';
import { useStory } from '../state/store';
import { fx } from '../state/fx';
import { env } from '../lib/env';
import { isControl } from './input';

// ---------------------------------------------------------------------------
// Timing (ms). Everything about pacing lives here.
// ---------------------------------------------------------------------------
const T = {
  settle: 2400, // light rests, stars dim, camera stops
  introIn: 1500,
  introHold: [2600, 2400],
  introOut: 1100,
  introGap: 700,
  beforePoem: 400,
  perChar: 52, // letter-by-letter reveal speed
  comma: 260, // extra pause after , and .
  dot: 140, // extra pause per "." in "..."
  linePause: 420, // between the two lines of a couplet
  coupletPause: 750, // between couplets
  letterAnim: 900, // each letter's own settle animation
  fullHold: 3800, // whole poem stays after the last letter
  poemOut: 1600,
  heartIn: 2200,
  heartHold: 2900, // includes two soft pulses
  heartAutoAfter: 2600, // if she doesn't hold the heart, it fills with light by itself
  heartFillHeld: 2.0, // seconds of holding to fill it
  heartFillAuto: 1.8,
  dissolve: 1300,
};

type Step = 'settle' | 'intro' | 'poem' | 'hold' | 'poemOut' | 'heart' | 'dissolve';

// ---------------------------------------------------------------------------
// Letter schedule: when each letter starts.
// ---------------------------------------------------------------------------
interface Letter {
  ch: string;
  delay: number;
}
interface Line {
  words: Letter[][];
  start: number;
  end: number;
}

function schedule(couplets: readonly (readonly string[])[]) {
  let t = 0;
  const out: Line[][] = [];
  couplets.forEach((pair, ci) => {
    const lines: Line[] = [];
    pair.forEach((text, li) => {
      if (ci > 0 || li > 0) t += li === 0 ? T.coupletPause : T.linePause;
      const start = t;
      const words: Letter[][] = [];
      for (const w of text.split(' ')) {
        const letters: Letter[] = [];
        for (const ch of Array.from(w)) {
          letters.push({ ch, delay: t });
          t += T.perChar;
          if (ch === ',' || ch === '.' || ch === '?') t += ch === '.' ? T.dot : T.comma;
        }
        words.push(letters);
        t += T.perChar; // the space
      }
      t -= T.perChar;
      lines.push({ words, start, end: t });
    });
    out.push(lines);
  });
  return { couplets: out, total: t };
}

// ---------------------------------------------------------------------------
// Heart shape (classic parametric heart), used for its glow motes and dissolve.
// ---------------------------------------------------------------------------
function heartPoint(t: number): [number, number] {
  const x = 16 * Math.pow(Math.sin(t), 3);
  const y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
  // map onto the drawn SVG heart: x ±16 → ±0.42, y 12..-17 → -0.36..0.34 (y down)
  return [x * 0.0263, -0.0241 * y - 0.07];
}

function useHeartParticles() {
  return useMemo(() => {
    const motes = Array.from({ length: 9 }, (_, i) => {
      const [x, y] = heartPoint((i / 9) * Math.PI * 2 + 0.3);
      return { x: x * 1.32, y: y * 1.32, d: Math.random() * 4, s: 2 + Math.random() * 1.6, gold: i % 4 === 0 };
    });
    const dust = Array.from({ length: 34 }, (_, i) => {
      const inner = i % 3 === 0 ? 0.55 + Math.random() * 0.4 : 1;
      const [x, y] = heartPoint(Math.random() * Math.PI * 2);
      return {
        x: x * inner,
        y: y * inner,
        s: 1.6 + Math.random() * 2.4,
        delay: Math.random() * 260,
        gold: Math.random() < 0.25,
      };
    });
    return { motes, dust };
  }, []);
}

// ---------------------------------------------------------------------------

export function Poem() {
  const { intro, couplets, heartLabel } = copy.poem;
  const plan = useMemo(() => schedule(couplets), [couplets]);
  const { motes, dust } = useHeartParticles();

  const [step, setStep] = useState<Step>('settle');
  const [introIdx, setIntroIdx] = useState(0);
  const [introStage, setIntroStage] = useState<'none' | 'pre' | 'in' | 'out'>('none');
  const poemDone = useRef(false);
  const heartRef = useRef<HTMLDivElement>(null);
  const [heartReady, setHeartReady] = useState(false);
  const [holding, setHolding] = useState(false);
  const autoFill = useRef(false);

  // ---- the scene's timeline ------------------------------------------------
  useEffect(() => {
    const ids: number[] = [];
    const at = (ms: number, fn: () => void) => ids.push(window.setTimeout(fn, ms));

    switch (step) {
      case 'settle':
        fx.hush.target = 1;
        fx.focus.target = 0;
        at(T.settle, () => setStep('intro'));
        break;

      case 'intro': {
        // two lines, one at a time
        let t = 60;
        intro.forEach((_, i) => {
          at(t, () => {
            setIntroIdx(i);
            setIntroStage('pre');
          });
          at(t + 50, () => setIntroStage('in'));
          t += 50 + T.introIn + T.introHold[i];
          at(t, () => setIntroStage('out'));
          t += T.introOut;
          at(t, () => setIntroStage('none'));
          t += T.introGap;
        });
        at(t + T.beforePoem - T.introGap, () => setStep('poem'));
        break;
      }

      case 'poem': {
        // the sky answers each line with a few stars softly brightening, then dimming
        plan.couplets.flat().forEach((line, i) => {
          at(line.start, () => {
            Object.assign(fx.focus, {
              x: i % 2 ? 0.35 : -0.35,
              y: 0.1 - (i % 5) * 0.05,
              r: 1.2,
              lo: (i * 0.09) % 0.9,
              hi: ((i * 0.09) % 0.9) + 0.1,
              target: 0.8,
            });
          });
          at(line.end + 500, () => (fx.focus.target = 0));
        });
        // safety net: if the last letter's animationend never fires (e.g. a hidden tab), still move on
        at(plan.total + T.letterAnim + 2500, finishPoem);
        break;
      }

      case 'hold':
        at(T.fullHold, () => setStep('poemOut'));
        break;

      case 'poemOut':
        fx.focus.target = 0;
        at(T.poemOut, () => setStep('heart'));
        break;

      case 'heart':
        // she can hold the heart to fill it with light; if not, it fills by itself
        at(T.heartIn, () => setHeartReady(true));
        at(T.heartIn + T.heartAutoAfter, () => (autoFill.current = true));
        break;

      case 'dissolve':
        // the heart fades into the sky; the permission scene (`ask`) takes over from here
        at(T.dissolve + 150, () => useStory.getState().goTo('ask'));
        break;
    }
    return () => {
      ids.forEach((x) => window.clearTimeout(x));
    };
  }, [step]);

  useEffect(
    () => () => {
      fx.hush.target = 0;
      fx.focus.target = 0;
    },
    [],
  );

  function finishPoem() {
    if (poemDone.current) return;
    poemDone.current = true;
    setStep('hold');
  }

  const poemVisible = step === 'poem' || step === 'hold' || step === 'poemOut';
  // hold the heart: it fills with light and beats faster; full → it gathers into light (the dissolve)
  useEffect(() => {
    if (!heartReady || step !== 'heart') return;
    let held = false;
    let fill = 0;
    let last = performance.now();
    let raf = 0;
    let beatAt = 0;
    const set = (v: boolean) => {
      held = v;
      setHolding(v);
      if (v) autoFill.current = false;
    };
    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (held) fill += dt / T.heartFillHeld;
      else if (autoFill.current) fill += dt / T.heartFillAuto;
      else fill = Math.max(0, fill - dt * 0.45);
      fill = Math.min(1, fill);
      heartRef.current?.style.setProperty('--fill', fill.toFixed(3));
      // a soft heartbeat under her finger (phones that support it)
      if (held && now - beatAt > 820 - fill * 360) {
        beatAt = now;
        navigator.vibrate?.(fill > 0.6 ? [14, 90, 10] : 12);
      }
      if (fill >= 1) {
        setHolding(false);
        setStep('dissolve');
        return;
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    const down = (e: PointerEvent) => {
      if (e.button > 0 || isControl(e.target)) return;
      set(true);
    };
    const up = () => set(false);
    const keyDown = (e: KeyboardEvent) => {
      if ((e.key === 'Enter' || e.key === ' ') && !e.repeat && !isControl(e.target)) {
        e.preventDefault();
        set(true);
      }
    };
    const keyUp = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') set(false);
    };
    window.addEventListener('pointerdown', down);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    window.addEventListener('keydown', keyDown);
    window.addEventListener('keyup', keyUp);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('pointerdown', down);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      window.removeEventListener('keydown', keyDown);
      window.removeEventListener('keyup', keyUp);
    };
  }, [heartReady, step]);

  const heartVisible = step === 'heart' || step === 'dissolve';
  const lastLetterDelay = plan.total - T.perChar;

  const rootStyle = {
    '--poem-total': `${plan.total + T.letterAnim}ms`,
    '--letter-ms': `${T.letterAnim}ms`,
    '--heart-in': `${T.heartIn}ms`,
    '--dissolve': `${T.dissolve}ms`,
  } as CSSProperties;

  return (
    <section className={`poem-scene step-${step}`} style={rootStyle} aria-label="A poem">
      {/* soft lavender light that builds as the poem is written */}
      <div className="poem-glow" aria-hidden="true" />
      <div className="poem-veil" aria-hidden="true" />

      {/* intro lines, one at a time (same feel as the opening thoughts) */}
      {step === 'intro' && introStage !== 'none' && (
        <div className="poem-intro-wrap">
          <p
            key={introIdx}
            aria-hidden="true"
            className={`thought poem-intro${introStage === 'in' ? ' is-shown' : ''}${introStage === 'out' ? ' is-out' : ''}`}
          >
            {intro[introIdx]}
          </p>
        </div>
      )}
      <p className={`hint-line${heartReady && step === 'heart' && !holding ? ' is-shown' : ''}`} aria-hidden="true">
        {copy.hints.heart}
      </p>
      <div className="sr-only" aria-live="polite">
        {step === 'intro' && introStage !== 'none' ? intro[introIdx] : ''}
      </div>

      {/* the poem, written into the sky one letter at a time */}
      {poemVisible && (
        <div className={`poem${step === 'poemOut' ? ' is-out' : ''}`}>
          <div className="sr-only">{couplets.map((c) => c.join(' ')).join(' ')}</div>
          {plan.couplets.map((lines, ci) => (
            <div className="couplet" key={ci} aria-hidden="true">
              {lines.map((line, li) => (
                <p
                  className="pline"
                  key={li}
                  style={{ '--line-end': `${line.end + T.letterAnim}ms` } as CSSProperties}
                >
                  {line.words.map((word, wi) => (
                    <span key={wi}>
                      <span className="pword">
                        {word.map((l, k) => (
                          <span
                            key={k}
                            className="pl"
                            style={{ animationDelay: `${l.delay}ms` }}
                            onAnimationEnd={l.delay === lastLetterDelay ? finishPoem : undefined}
                          >
                            {l.ch}
                          </span>
                        ))}
                        {wi === line.words.length - 1 && (
                          <span className="pspark" style={{ animationDelay: `${line.end + 150}ms` }} />
                        )}
                      </span>
                      {wi < line.words.length - 1 ? ' ' : ''}
                    </span>
                  ))}
                </p>
              ))}
            </div>
          ))}
        </div>
      )}

      {/* the closing heart */}
      {heartVisible && (
        <div
          ref={heartRef}
          className={`heart-stage${holding ? ' is-holding' : ''}${env.reducedMotion ? ' is-calm' : ''}`}
          role="img"
          aria-label={heartLabel}
        >
          <div className="heart-bloom" />
          <svg className="heart" viewBox="0 0 100 100" aria-hidden="true">
            <defs>
              <radialGradient id="hfill" cx="50%" cy="42%" r="62%">
                <stop offset="0%" stopColor="#f7f0ff" stopOpacity="0.78" />
                <stop offset="38%" stopColor="#dccbf6" stopOpacity="0.55" />
                <stop offset="78%" stopColor="#b49ddc" stopOpacity="0.32" />
                <stop offset="100%" stopColor="#9a80d0" stopOpacity="0.24" />
              </radialGradient>
              <radialGradient id="hshine" cx="36%" cy="30%" r="30%">
                <stop offset="0%" stopColor="#ffffff" stopOpacity="0.4" />
                <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
              </radialGradient>
            </defs>
            <path
              className="heart-fill"
              d="M50 84 C 20 64, 8 46, 15 30 C 21 16, 41 13, 50 29 C 59 13, 79 16, 85 30 C 92 46, 80 64, 50 84 Z"
              fill="url(#hfill)"
            />
            <path
              className="heart-shine"
              d="M50 84 C 20 64, 8 46, 15 30 C 21 16, 41 13, 50 29 C 59 13, 79 16, 85 30 C 92 46, 80 64, 50 84 Z"
              fill="url(#hshine)"
            />
            <path
              className="heart-line"
              pathLength={1}
              d="M50 29 C 59 13, 79 16, 85 30 C 92 46, 80 64, 50 84 C 20 64, 8 46, 15 30 C 21 16, 41 13, 50 29 Z"
            />
          </svg>
          {motes.map((m, i) => (
            <span
              key={`m${i}`}
              className={`heart-mote${m.gold ? ' gold' : ''}`}
              style={
                {
                  left: `${50 + m.x * 100}%`,
                  top: `${50 + m.y * 100}%`,
                  width: m.s,
                  height: m.s,
                  animationDelay: `${T.heartIn * 0.5 + i * 140}ms, ${-m.d}s`,
                } as CSSProperties
              }
            />
          ))}
          {step === 'dissolve' &&
            dust.map((d, i) => (
              <span
                key={`d${i}`}
                className={`heart-dust${d.gold ? ' gold' : ''}`}
                style={
                  {
                    left: `${50 + d.x * 100}%`,
                    top: `${50 + d.y * 100}%`,
                    width: d.s,
                    height: d.s,
                    '--dx': -d.x,
                    '--dy': -d.y,
                    animationDelay: `${d.delay}ms`,
                  } as CSSProperties
                }
              />
            ))}
        </div>
      )}
    </section>
  );
}
