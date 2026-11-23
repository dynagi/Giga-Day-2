import { CSSProperties, useEffect, useMemo, useRef, useState } from 'react';
import { copy } from '../data/copy';
import { useStory } from '../state/store';
import { FogGlass } from './FogGlass';

// ---------------------------------------------------------------------------
// Timing (ms). The comedy lives in these numbers.
// ---------------------------------------------------------------------------
const T = {
  line1: 500, // "Teko pata hai kya" words
  wordStagger: 120,
  nameAt: 1050, // "Richaaaaa" letter wave
  nameStagger: 80,
  dotsAt: 2050, // "........." trailing off
  dotStagger: 115,
  line2: 4500, // the setup
  line2Stagger: 85,
  line3: 8300, // the punchline's moment: a misty glass appears over it, after a beat of silence
  fogMelt: 550, // the fog melts away, then the punchline pops (as before)
  glintAfter: 900, // a little reflection passes over the last word
  outAfter: 3600, // hold the full message, then let it go
  outDur: 1500,
};

type Step = 'pre' | 'l1' | 'l2' | 'fog' | 'l3' | 'glint' | 'out';
const ORDER: Step[] = ['pre', 'l1', 'l2', 'fog', 'l3', 'glint', 'out'];

function Words({ text, stagger, from = 0 }: { text: string; stagger: number; from?: number }) {
  const words = text.split(' ');
  return (
    <>
      {words.map((w, i) => (
        <span key={i}>
          <span className="pi-word" style={{ '--d': `${from + i * stagger}ms` } as CSSProperties}>
            {w}
          </span>
          {i < words.length - 1 ? ' ' : ''}
        </span>
      ))}
    </>
  );
}

/** Small drifting sparkles, kept away from the text band. */
function useSparkles() {
  return useMemo(
    () =>
      Array.from({ length: 11 }, (_, i) => {
        const top = i % 2 ? 8 + Math.random() * 22 : 70 + Math.random() * 22;
        return {
          left: 6 + Math.random() * 88,
          top,
          size: 6 + Math.random() * 8,
          delay: Math.random() * 2.5,
          dur: 5 + Math.random() * 4,
          tone: i % 4 === 0 ? 'gold' : i % 5 === 0 ? 'pink' : 'lilac',
        };
      }),
    [],
  );
}

export function PlayfulIntro() {
  const [l1, l2, l3] = copy.playful;
  const [step, setStep] = useState<Step>('pre');
  const [melting, setMelting] = useState(false);
  const [rubHint, setRubHint] = useState(false);
  const revealed = useRef(false);
  const timers = useRef<number[]>([]);
  const sparkles = useSparkles();

  // Split line 1 into "Teko pata hai kya " + "Richaaaaa" + "........." without changing the text.
  const parts = useMemo(() => {
    const m = l1.match(/^(.*\s)(\S*?)(\.+)$/);
    return m ? { lead: m[1].trimEnd(), name: m[2], dots: m[3] } : { lead: l1, name: '', dots: '' };
  }, [l1]);
  // Line 3: the last word gets the reflection glint.
  const punch = useMemo(() => {
    const i = l3.lastIndexOf(' ');
    return { lead: l3.slice(0, i), last: l3.slice(i + 1) };
  }, [l3]);

  const at = (ms: number, fn: () => void) => timers.current.push(window.setTimeout(fn, ms));

  /** She has rubbed the fog away: the punchline lands. */
  function reveal() {
    if (revealed.current) return;
    revealed.current = true;
    setRubHint(false);
    setMelting(true);
    at(T.fogMelt, () => setStep('l3'));
    at(T.fogMelt + T.glintAfter, () => setStep('glint'));
    at(T.fogMelt + T.outAfter, () => setStep('out'));
    at(T.fogMelt + T.outAfter + T.outDur, () => useStory.getState().goTo('atmosphere'));
  }

  useEffect(() => {
    at(40, () => setStep('l1'));
    at(T.line2, () => setStep('l2'));
    at(T.line3, () => setStep('fog'));
    at(T.line3 + 1100, () => !revealed.current && setRubHint(true));
    return () => {
      timers.current.forEach((id) => window.clearTimeout(id));
      timers.current = [];
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // without a pointer (keyboard only), Enter or Space wipes the fog
  useEffect(() => {
    if (step !== 'fog') return;
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        reveal();
      }
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  const reached = (s: Step) => ORDER.indexOf(step) >= ORDER.indexOf(s);
  const announce = reached('l3') ? l3 : reached('l2') ? l2 : reached('l1') ? l1 : '';

  return (
    <section
      className={[
        'pi',
        reached('l1') && 'pi-l1',
        reached('l2') && 'pi-l2',
        reached('fog') && 'pi-fog',
        reached('l3') && 'pi-l3',
        reached('glint') && 'pi-glint',
        step === 'out' && 'pi-out',
      ]
        .filter(Boolean)
        .join(' ')}
      aria-label="A message"
    >
      <div className="pi-backdrop" aria-hidden="true" />
      <div className="pi-sparkles" aria-hidden="true">
        {sparkles.map((s, i) => (
          <span
            key={i}
            className={`pi-sparkle ${s.tone}`}
            style={
              {
                left: `${s.left}%`,
                top: `${s.top}%`,
                width: s.size,
                height: s.size,
                animationDelay: `${0.6 + s.delay}s, ${s.delay}s`,
                '--float': `${s.dur}s`,
              } as CSSProperties
            }
          />
        ))}
      </div>

      <div className="pi-text" aria-hidden="true">
        <p className="pi-line pi-line1">
          <Words text={parts.lead} stagger={T.wordStagger} from={T.line1} />{' '}
          <span className="pi-trail">
          <span className="pi-name">
            {Array.from(parts.name).map((ch, i) => (
              <span
                key={i}
                className="pi-ch"
                style={{ '--d': `${T.nameAt + i * T.nameStagger}ms`, '--k': i } as CSSProperties}
              >
                {ch}
              </span>
            ))}
          </span>
          <span className="pi-dots">
            {Array.from(parts.dots).map((ch, i) => (
              <span key={i} className="pi-dot" style={{ '--d': `${T.dotsAt + i * T.dotStagger}ms` } as CSSProperties}>
                {ch}
              </span>
            ))}
          </span>
          </span>
        </p>

        <p className="pi-line pi-line2">
          <Words text={l2} stagger={T.line2Stagger} />
        </p>

        <p className="pi-line pi-line3">
          <span className="pi-fog-wrap">
            <span className="pi-punch">
              {punch.lead}{' '}
              <span className="pi-mirror" data-text={punch.last}>
                {punch.last}
              </span>
            </span>
            {reached('fog') && (
              <span className={`pi-fog-glass${melting ? ' is-melting' : ''}`}>
                <FogGlass onClear={reveal} onFirstRub={() => setRubHint(false)} />
              </span>
            )}
          </span>
        </p>
        <p className={`pi-rub-hint${rubHint ? ' is-shown' : ''}`}>{copy.playfulHint}</p>
      </div>

      <div className="sr-only" aria-live="polite">
        {announce}
      </div>
    </section>
  );
}
