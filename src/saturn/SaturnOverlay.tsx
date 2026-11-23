import { useEffect, useRef, useState } from 'react';
import { copy } from '../data/copy';
import { chime } from '../audio/music';
import { env } from '../lib/env';
import { useStory } from '../state/store';
import { isControl } from '../ui/input';
import { journeyInput } from '../journey/space';
import { BEATS, PART_ORDER, firstBeatOf, resetSaturnDir, saturnDir, type Beat } from './saturnScript';
import { saturnHot } from './SaturnWorld';

/**
 * Saturn's words, floating in the scene (no cards behind them): chapter titles, lines that
 * appear one by one, the soft lines, the secret, and the completion card. A tap (or Space)
 * shows the next line; "Skip chapter ›" is always there; drag to look around. The science
 * panel and the tappable hotspots (like Day 1) pause the story while she reads them.
 */

type HotId = 'rings' | 'hexagon' | 'titan' | 'enceladus';
const HOTS: HotId[] = ['rings', 'hexagon', 'titan', 'enceladus'];

export function SaturnOverlay() {
  const [index, setIndex] = useState(0);
  const [facts, setFacts] = useState(false);
  const [open, setOpen] = useState<HotId | ''>('');
  const [tapped, setTapped] = useState(false);
  const idx = useRef(0);
  const beatStart = useRef(performance.now());
  const partStart = useRef(performance.now());
  const phaseStart = useRef(performance.now());
  const paused = useRef(false);
  const pausedAt = useRef(0);
  const hotRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const go = (i: number) => {
    if (i >= BEATS.length) {
      useStory.getState().goTo('next');
      return;
    }
    const prev = BEATS[idx.current];
    const next = BEATS[i];
    idx.current = i;
    beatStart.current = performance.now();
    if (next.part !== prev.part || i === 0) partStart.current = performance.now();
    if (next.part === 'complete') chime();
    setIndex(i);
  };

  // the story clock
  useEffect(() => {
    resetSaturnDir();
    let raf = 0;
    const tick = () => {
      const now = performance.now();
      if (paused.current) {
        // hold the clocks still while a panel is open
        const held = now - pausedAt.current;
        beatStart.current += held;
        partStart.current += held;
        pausedAt.current = now;
      }
      const b = BEATS[idx.current];
      const beatT = (now - beatStart.current) / 1000;
      saturnDir.index = idx.current;
      saturnDir.beatT = beatT;
      saturnDir.partT = (now - partStart.current) / 1000;
      saturnDir.part = b.part;
      saturnDir.line = b.line;
      saturnDir.kind = b.kind;
      saturnDir.t = (now - phaseStart.current) / 1000;
      if (!paused.current && beatT * 1000 >= b.ms) go(idx.current + 1);
      // hotspots follow their places in the scene
      for (const id of HOTS) {
        const el = hotRefs.current[id];
        const s = saturnHot.spots[id];
        if (!el) continue;
        el.style.transform = `translate(${s.x}px, ${s.y}px)`;
        el.classList.toggle('is-on', s.on);
        el.tabIndex = s.on ? 0 : -1;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      journeyInput.dragYaw = journeyInput.dragPitch = 0;
      journeyInput.dragging = false;
      saturnHot.open = '';
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // a panel open = the story waits
  useEffect(() => {
    const p = facts || open !== '';
    if (p && !paused.current) pausedAt.current = performance.now();
    paused.current = p;
    saturnHot.open = open;
  }, [facts, open]);

  const next = () => {
    const b = BEATS[idx.current];
    // with a panel open, a tap outside it just closes it
    if (paused.current) {
      setFacts(false);
      setOpen('');
      return;
    }
    if (!b.tappable) return;
    setTapped(true);
    go(idx.current + 1);
  };
  const skipChapter = () => {
    const part = BEATS[idx.current].part;
    const order = PART_ORDER.indexOf(part);
    const nextPart = PART_ORDER[order + 1];
    if (!nextPart) {
      useStory.getState().goTo('next');
      return;
    }
    setFacts(false);
    setOpen('');
    go(firstBeatOf(nextPart));
  };

  // tap = next line; drag = look around
  useEffect(() => {
    let down: { x: number; y: number; yaw: number; pitch: number; at: number } | null = null;
    const pd = (e: PointerEvent) => {
      if (e.button > 0 || isControl(e.target)) return;
      down = { x: e.clientX, y: e.clientY, yaw: journeyInput.dragYaw, pitch: journeyInput.dragPitch, at: performance.now() };
    };
    const pm = (e: PointerEvent) => {
      if (!down) return;
      const w = Math.max(1, window.innerWidth);
      if (Math.hypot(e.clientX - down.x, e.clientY - down.y) > 10) journeyInput.dragging = true;
      if (!journeyInput.dragging) return;
      journeyInput.dragYaw = Math.max(-1.6, Math.min(1.6, down.yaw + ((e.clientX - down.x) / w) * Math.PI * 0.9));
      journeyInput.dragPitch = Math.max(-0.7, Math.min(0.7, down.pitch + ((e.clientY - down.y) / w) * Math.PI * 0.6));
    };
    const pu = (e: PointerEvent) => {
      if (!down) return;
      const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
      const quick = performance.now() - down.at < 450;
      down = null;
      const wasDrag = journeyInput.dragging;
      journeyInput.dragging = false;
      if (!wasDrag && moved < 10 && quick) next();
    };
    const kd = (e: KeyboardEvent) => {
      if (isControl(e.target)) return;
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        next();
      } else if (e.key === 'Escape') {
        setFacts(false);
        setOpen('');
      }
    };
    window.addEventListener('pointerdown', pd);
    window.addEventListener('pointermove', pm);
    window.addEventListener('pointerup', pu);
    window.addEventListener('pointercancel', pu);
    window.addEventListener('keydown', kd);
    return () => {
      window.removeEventListener('pointerdown', pd);
      window.removeEventListener('pointermove', pm);
      window.removeEventListener('pointerup', pu);
      window.removeEventListener('pointercancel', pu);
      window.removeEventListener('keydown', kd);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const s = copy.saturn;
  const beat = BEATS[index];
  // during a pause, the stanza just read fades away
  let shown: Beat = beat;
  let out = false;
  if (beat.kind === 'pause' && index > 0) {
    shown = BEATS[index - 1];
    out = true;
  }
  const stanzaLines = shown.kind === 'line' ? BEATS.slice(0, (out ? index - 1 : index) + 1).filter((b) => b.stanza === shown.stanza) : [];
  const chapter = s.chapters.find((c) => c.id === shown.part);
  const hot = open ? s.hotspots[open] : null;

  return (
    <section className={`sx${env.reducedMotion ? ' is-calm' : ''}`} aria-label={s.label}>
      {/* the words */}
      <div className="sx-words">
        {shown.kind === 'title' && chapter && (
          <div key={shown.stanza} className={`sx-title${out ? ' is-out' : ''}`}>
            <p className="sx-num">{chapter.num}</p>
            <h2 className="sx-chapter">{chapter.title}</h2>
            <p className="sx-inspired">{chapter.inspired}</p>
          </div>
        )}
        {shown.kind === 'line' && (
          <div key={shown.stanza} className={`sx-stanza${out ? ' is-out' : ''}`}>
            {stanzaLines.map((b) => (
              <p key={b.text} className="sx-line">
                {b.text}
              </p>
            ))}
          </div>
        )}
        {shown.kind === 'soft' && (
          <p key={shown.stanza} className={`sx-soft${out ? ' is-out' : ''}`}>
            {shown.text}
          </p>
        )}
        {shown.kind === 'last' && (
          <p key={shown.stanza} className={`sx-last${out ? ' is-out' : ''}`}>
            {shown.text}
          </p>
        )}
        {shown.kind === 'card' && (
          <div className="sx-card" role="group" aria-label={s.complete.title}>
            <h2 className="sx-card-title">{s.complete.title}</h2>
            <p className="sx-card-quote">{s.complete.quote}</p>
            <p className="sx-card-badge">{s.complete.badge}</p>
          </div>
        )}
      </div>

      {/* tappable hotspots, anchored to the scene */}
      {HOTS.map((id) => (
        <button
          key={id}
          type="button"
          data-control
          ref={(el) => (hotRefs.current[id] = el)}
          className={`sx-hot${open === id ? ' is-open' : ''}`}
          aria-label={s.hotspots[id].title}
          onClick={() => setOpen((o) => (o === id ? '' : id))}
        >
          <i aria-hidden="true" />
          <span>{s.hotspots[id].title}</span>
        </button>
      ))}

      {hot && (
        <div className="sx-panel sx-hot-card" data-control role="dialog" aria-label={hot.title}>
          <h3>{hot.title}</h3>
          <ul>
            {hot.points.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
          <button type="button" className="sx-close" data-control onClick={() => setOpen('')}>
            {s.close}
          </button>
        </div>
      )}

      {/* the facts panel */}
      <button type="button" className="sx-facts-btn" data-control aria-expanded={facts} onClick={() => setFacts((f) => !f)}>
        🪐 {s.factsButton}
      </button>
      {facts && (
        <div className="sx-panel sx-facts" data-control role="dialog" aria-label={s.factsTitle}>
          <h3>{s.factsTitle}</h3>
          <dl>
            {s.facts.map((f) => (
              <div key={f.label} className="sx-fact">
                <dt>
                  <span aria-hidden="true">{f.icon}</span> {f.label}
                </dt>
                <dd>
                  {f.value}
                  {f.note && <small>{f.note}</small>}
                </dd>
              </div>
            ))}
          </dl>
          <button type="button" className="sx-close" data-control onClick={() => setFacts(false)}>
            {s.close}
          </button>
        </div>
      )}

      <button type="button" className="sx-skip" data-control onClick={skipChapter}>
        {s.skip}
      </button>
      <p className={`hint-line sx-hint${!tapped && beat.kind === 'line' && beat.part === 'rings' && beat.line <= 1 ? ' is-shown' : ''}`} aria-hidden="true">
        {s.tapHint}
      </p>

      <div className="sr-only" aria-live="polite">
        {beat.kind === 'title' && chapter ? `${chapter.num}: ${chapter.title}` : beat.kind === 'card' ? `${s.complete.title} ${s.complete.quote} ${s.complete.badge}` : beat.text}
      </div>
    </section>
  );
}
