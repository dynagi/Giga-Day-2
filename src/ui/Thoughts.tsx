import { useEffect, useRef, useState } from 'react';
import { copy } from '../data/copy';
import { env } from '../lib/env';
import { fx } from '../state/fx';
import { useStory } from '../state/store';
import { isControl } from './input';

type Stage = 'pre' | 'gather' | 'hold' | 'out' | 'gap';

const T_HOLD = 3400;
const T_OUT = 1100;
const T_OUT_FAST = 400;
const T_GAP = 700;
/** Seconds for the stars to form a line: while she holds, and on their own. */
const GATHER_HELD = 1.25;
const GATHER_IDLE = 3.2;
const GATHER_REDUCED = 1.4;

interface Star {
  sx: number;
  sy: number;
  tx: number;
  ty: number;
  d: number;
  size: number;
  gold: boolean;
  tw: number;
}

/** Three thoughts, strictly one at a time; each gathers from stars into words. */
export function Thoughts() {
  const lines = copy.thoughts;
  const [i, setI] = useState(0);
  const [stage, setStage] = useState<Stage>('pre');
  const [fast, setFast] = useState(false);
  const [hint, setHint] = useState(false);
  const pRef = useRef<HTMLParagraphElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const held = useRef(false);
  const everHeld = useRef(false);
  const stageRef = useRef<Stage>('pre');
  stageRef.current = stage;

  // timed stages (hold → out → gap → next line), as before
  useEffect(() => {
    let id = 0;
    const after = (ms: number, fn: () => void) => (id = window.setTimeout(fn, ms));
    switch (stage) {
      case 'pre':
        after(40, () => setStage('gather'));
        break;
      case 'hold':
        after(T_HOLD, () => setStage('out'));
        break;
      case 'out':
        fx.focus.target = 0;
        after(fast ? T_OUT_FAST : T_OUT, () => setStage('gap'));
        break;
      case 'gap':
        after(T_GAP, () => {
          if (i < lines.length - 1) {
            setFast(false);
            setI(i + 1);
            setStage('pre');
          } else {
            useStory.getState().goTo('identity');
          }
        });
        break;
    }
    return () => window.clearTimeout(id);
  }, [stage, i, fast, lines.length]);

  // the gathering: stars fly from all over the sky into the letters of the line
  useEffect(() => {
    if (stage !== 'gather') return;
    const p = pRef.current!;
    const canvas = canvasRef.current!;
    const c = canvas.getContext('2d')!;
    const dpr = Math.min(window.devicePixelRatio || 1, env.dprCap);
    const W = window.innerWidth;
    const H = window.innerHeight;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    Object.assign(fx.focus, { lo: i * 0.12, hi: i * 0.12 + 0.12, x: 0, y: 0.05, r: 0.8, target: 1 });
    if (i === 0) window.setTimeout(() => !everHeld.current && stageRef.current === 'gather' && setHint(true), 700);

    // targets: a few points inside every letter's box
    const stars: Star[] = [];
    const chars = Array.from(p.querySelectorAll<HTMLSpanElement>('.tch'));
    const perChar = Math.max(1, Math.min(3, Math.floor(200 / Math.max(1, chars.length))));
    for (const ch of chars) {
      if (!ch.textContent?.trim()) continue;
      const r = ch.getBoundingClientRect();
      for (let k = 0; k < perChar; k++) {
        stars.push({
          sx: Math.random() * W,
          sy: Math.random() * H,
          tx: r.left + r.width * (0.25 + Math.random() * 0.5),
          ty: r.top + r.height * (0.3 + Math.random() * 0.45),
          d: Math.random() * 0.35,
          size: 0.9 + Math.random() * 1.4,
          gold: Math.random() < 0.35,
          tw: Math.random() * 6,
        });
      }
    }

    let prog = 0;
    let last = performance.now();
    let raf = 0;
    const ease = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const dur = env.reducedMotion ? GATHER_REDUCED : held.current ? GATHER_HELD : GATHER_IDLE;
      prog = Math.min(1, prog + dt / dur);

      // the words themselves appear as the stars arrive
      const textA = Math.max(0, Math.min(1, (prog - 0.55) / 0.45));
      p.style.opacity = String(textA);
      p.style.filter = `blur(${(1 - textA) * 6}px)`;
      p.style.transform = `translateY(${(1 - textA) * 8}px)`;

      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      c.clearRect(0, 0, W, H);
      if (!env.reducedMotion) {
        const fade = 1 - Math.max(0, Math.min(1, (prog - 0.82) / 0.18));
        c.globalCompositeOperation = 'lighter';
        for (const s of stars) {
          const q = ease(Math.max(0, Math.min(1, (prog - s.d) / 0.65)));
          const x = s.sx + (s.tx - s.sx) * q;
          const y = s.sy + (s.ty - s.sy) * q;
          const a = (0.45 + 0.55 * Math.abs(Math.sin(now / 400 + s.tw))) * fade * Math.min(1, prog * 4);
          const col = s.gold ? '243,217,164' : '220,203,246';
          const rad = s.size * 3.2;
          const g = c.createRadialGradient(x, y, 0, x, y, rad);
          g.addColorStop(0, `rgba(255,250,240,${a})`);
          g.addColorStop(0.35, `rgba(${col},${a * 0.5})`);
          g.addColorStop(1, `rgba(${col},0)`);
          c.fillStyle = g;
          c.beginPath();
          c.arc(x, y, rad, 0, Math.PI * 2);
          c.fill();
        }
        c.globalCompositeOperation = 'source-over';
      }
      if (prog >= 1) {
        c.clearRect(0, 0, W, H);
        p.style.opacity = '';
        p.style.filter = '';
        p.style.transform = '';
        setStage('hold');
        return;
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [stage, i]);

  useEffect(() => () => void (fx.focus.target = 0), []);

  // hold to gather (finger, mouse or Space/Enter); a tap once the line is formed skips, as before
  useEffect(() => {
    const press = () => {
      const s = stageRef.current;
      if (s === 'gather' || s === 'pre') {
        held.current = true;
        everHeld.current = true;
        setHint(false);
      } else if (s === 'hold') {
        setFast(true);
        setStage('out');
      }
    };
    const release = () => (held.current = false);
    const down = (e: PointerEvent) => {
      if (e.button > 0 || isControl(e.target)) return;
      press();
    };
    const keyDown = (e: KeyboardEvent) => {
      if (isControl(e.target) || (e.key !== 'Enter' && e.key !== ' ')) return;
      e.preventDefault();
      if (!e.repeat) press();
    };
    const keyUp = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') release();
    };
    window.addEventListener('pointerdown', down);
    window.addEventListener('pointerup', release);
    window.addEventListener('pointercancel', release);
    window.addEventListener('keydown', keyDown);
    window.addEventListener('keyup', keyUp);
    return () => {
      window.removeEventListener('pointerdown', down);
      window.removeEventListener('pointerup', release);
      window.removeEventListener('pointercancel', release);
      window.removeEventListener('keydown', keyDown);
      window.removeEventListener('keyup', keyUp);
    };
  }, []);

  const shown = stage === 'hold';

  return (
    <section className="thoughts" aria-label="Opening">
      <canvas ref={canvasRef} className="thought-stars" aria-hidden="true" />
      {stage !== 'gap' && (
        <p
          ref={pRef}
          key={i}
          className={`thought is-gathering${shown ? ' is-shown' : ''}${stage === 'out' ? (fast ? ' is-out-fast' : ' is-out') : ''}`}
          aria-hidden="true"
        >
          {Array.from(lines[i]).map((ch, k) => (
            <span key={k} className="tch">
              {ch}
            </span>
          ))}
        </p>
      )}
      <p className={`hint-line${hint ? ' is-shown' : ''}`} aria-hidden={!hint}>
        {copy.hints.gather}
      </p>
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {stage !== 'pre' ? lines[i] : ''}
      </div>
    </section>
  );
}
