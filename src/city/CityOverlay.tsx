import { useEffect, useRef, useState } from 'react';
import { copy } from '../data/copy';
import { chatPing } from '../audio/music';
import { env } from '../lib/env';
import { useStory } from '../state/store';
import { isControl } from '../ui/input';
import { CT, cityClock } from './cityClock';
import { hurryChat, phoneChat, resetChat, runChat } from './phoneChat';
import { richaScreen } from './Richa3D';

/**
 * The screen layer over the first-person story: clouds rushing past during the descent,
 * the dark of the stairwell, a soft glow when the phone buzzes, Richa's words floating by her,
 * Giga's own words (as his voice, at the bottom), hints, and her taps and drags.
 */

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

export function CityOverlay() {
  const [t, setT] = useState(0);
  const [chatOn, setChatOn] = useState(false);
  const [chatLines, setChatLines] = useState(0);
  const [dragged, setDragged] = useState(false);
  const white = useRef<HTMLDivElement>(null);
  const dark = useRef<HTMLDivElement>(null);
  const say = useRef<HTMLDivElement>(null);
  const buzzed = useRef(false);
  const chatStarted = useRef(false);
  const cancelChat = useRef<(() => void) | null>(null);

  // the phone comes up, the chat plays; when it's over, the phone goes down and the story continues
  const startChat = () => {
    if (chatStarted.current) return;
    chatStarted.current = true;
    cityClock.hold = true;
    cityClock.phoneTarget = 1;
    setChatOn(true);
    window.setTimeout(() => {
      cancelChat.current = runChat(() => {
        cityClock.phoneTarget = 0;
        window.setTimeout(() => {
          setChatOn(false);
          cityClock.t = Math.max(cityClock.t, CT.afterChat);
          cityClock.hold = false;
        }, 1300);
      });
    }, 700);
  };

  useEffect(() => {
    resetChat();
    let raf = 0;
    let lastVersion = -1;
    const tick = () => {
      const sec = cityClock.t;
      setT(Math.floor(sec * 10) / 10);
      // the clouds of the descent, and of the rise at the end
      const w1 = clamp01((sec - CT.whiteFrom) / 1.3) * (1 - clamp01((sec - (CT.spaceEnd + 0.3)) / (CT.whiteTo - CT.spaceEnd - 0.3)));
      const w2 = clamp01((sec - CT.cloudFrom) / (CT.end - CT.cloudFrom - 0.3));
      if (white.current) {
        white.current.style.opacity = String(Math.max(w1, w2));
        white.current.style.setProperty('--rush', String(sec));
      }
      // the stairwell
      const d = clamp01((sec - CT.darkFrom) / 1.0) * (1 - clamp01((sec - (CT.stair + 0.2)) / (CT.darkTo - CT.stair - 0.2)));
      if (dark.current) dark.current.style.opacity = String(d);
      // her words follow her
      if (say.current) {
        say.current.style.transform = `translate(${Math.max(140, Math.min(window.innerWidth - 140, richaScreen.x))}px, ${Math.max(90, richaScreen.y)}px)`;
      }
      if (phoneChat.version !== lastVersion) {
        lastVersion = phoneChat.version;
        setChatLines(phoneChat.msgs.length);
      }
      // the buzz in his pocket
      if (sec >= CT.notify && !buzzed.current) {
        buzzed.current = true;
        chatPing();
        navigator.vibrate?.([30, 60, 30]);
      }
      if (sec >= CT.phoneAuto && !chatStarted.current) startChat();
      if (sec >= CT.end) {
        useStory.getState().goTo('earth');
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      cancelChat.current?.();
      cityClock.dragging = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // drag: turn his head. tap: pick up the phone, hurry the chat, or move the conversation along
  useEffect(() => {
    let down: { x: number; y: number; yaw: number; pitch: number; at: number } | null = null;
    const pd = (e: PointerEvent) => {
      if (e.button > 0 || isControl(e.target)) return;
      down = { x: e.clientX, y: e.clientY, yaw: cityClock.lookYaw, pitch: cityClock.lookPitch, at: performance.now() };
    };
    const pm = (e: PointerEvent) => {
      if (!down) return;
      const sec = cityClock.t;
      const canLook = sec > CT.spaceEnd + 0.5 && !cityClock.hold;
      if (!canLook) return;
      const w = Math.max(window.innerWidth, 1);
      if (Math.hypot(e.clientX - down.x, e.clientY - down.y) > 10) {
        cityClock.dragging = true;
        setDragged(true);
      }
      cityClock.lookYaw = Math.max(-1.6, Math.min(1.6, down.yaw + ((e.clientX - down.x) / w) * Math.PI * 1.2));
      cityClock.lookPitch = Math.max(-0.7, Math.min(0.7, down.pitch + ((e.clientY - down.y) / w) * Math.PI * 0.8));
    };
    const pu = (e: PointerEvent) => {
      if (!down) return;
      const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
      const quick = performance.now() - down.at < 400;
      down = null;
      cityClock.dragging = false;
      if (moved > 10 || !quick) return;
      const sec = cityClock.t;
      if (sec >= CT.notify && !chatStarted.current) startChat();
      else if (cityClock.hold) hurryChat();
      else if (sec >= CT.ask + 1.4 && sec < CT.reply) cityClock.t = CT.reply;
      else if (sec >= CT.reply + 1.4 && sec < CT.replyOut) cityClock.t = CT.replyOut;
    };
    const key = (e: KeyboardEvent) => {
      if (e.key !== ' ' && e.key !== 'Enter') return;
      const sec = cityClock.t;
      if (sec >= CT.notify && !chatStarted.current) startChat();
      else if (cityClock.hold) hurryChat();
    };
    window.addEventListener('pointerdown', pd);
    window.addEventListener('pointermove', pm);
    window.addEventListener('pointerup', pu);
    window.addEventListener('pointercancel', pu);
    window.addEventListener('keydown', key);
    return () => {
      window.removeEventListener('pointerdown', pd);
      window.removeEventListener('pointermove', pm);
      window.removeEventListener('pointerup', pu);
      window.removeEventListener('pointercancel', pu);
      window.removeEventListener('keydown', key);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const s = copy.story;
  const asking = t >= CT.ask && t < CT.reply;
  const askOut = t >= CT.reply - 0.6;
  const replying = t >= CT.reply && t < CT.replyOut + 0.8;
  const replyOut = t >= CT.replyOut;
  const showLook = t >= CT.roofArrive + 0.3 && t < CT.notify - 0.2 && !dragged;
  const showPhone = t >= CT.notify + 0.6 && !chatStarted.current;
  const showRead = chatOn && chatLines >= 1 && chatLines <= 2;
  const lastMsg = phoneChat.msgs[phoneChat.msgs.length - 1];

  return (
    <section className={`cy${env.reducedMotion ? ' is-calm' : ''}`} aria-label={s.label}>
      {/* clouds rushing past */}
      <div ref={white} className="cy-white" aria-hidden="true">
        <i className="cy-puff cy-p1" />
        <i className="cy-puff cy-p2" />
        <i className="cy-puff cy-p3" />
        <i className="cy-puff cy-p4" />
      </div>
      <div ref={dark} className="cy-dark" aria-hidden="true" />

      {/* the buzz: a soft glow rising from his pocket */}
      {t >= CT.notify && t < CT.notify + 4 && !chatOn && <div className="cy-buzz" aria-hidden="true" />}

      {/* her words, floating beside her */}
      <div ref={say} className="cy-say-anchor" aria-hidden="true">
        {asking && <p className={`cy-say${askOut ? ' is-out' : ''}`}>{s.richaAsks}</p>}
      </div>
      {/* his words: his own voice, at the bottom of what he sees */}
      {replying && (
        <p className={`cy-me${replyOut ? ' is-out' : ''}`}>
          <span className="cy-me-name">{s.you}</span>
          {s.gigaSays}
        </p>
      )}

      <p className={`hint-line${showLook ? ' is-shown' : ''}`} aria-hidden={!showLook}>
        {s.lookHint}
      </p>
      <p className={`hint-line${showPhone ? ' is-shown' : ''}`} aria-hidden={!showPhone}>
        {s.phoneHint}
      </p>
      <p className={`hint-line cy-read${showRead ? ' is-shown' : ''}`} aria-hidden={!showRead}>
        {s.readHint}
      </p>

      <div className="sr-only" aria-live="polite">
        {chatOn && lastMsg ? `${lastMsg.from === 'them' ? s.contact : s.you}: ${lastMsg.text}` : ''}
        {asking ? `Richa: ${s.richaAsks}` : ''}
        {replying ? `${s.you}: ${s.gigaSays}` : ''}
      </div>
    </section>
  );
}
