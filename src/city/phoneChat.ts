import { copy } from '../data/copy';
import { chatPing, chatPop } from '../audio/music';

/**
 * The chat on Giga's phone. Parth's messages arrive after a "typing…" moment; Giga's replies
 * are typed into the box letter by letter (his thumb taps the keys), then sent.
 * A tap hurries things along (finishes the typing, skips the wait), so she reads at her own pace.
 * The phone's screen is drawn from this state (see Phone3D).
 */

export type Msg = { from: 'them' | 'me'; text: string };

export const phoneChat = {
  msgs: [] as Msg[],
  theirTyping: false,
  draft: '',
  /** the key his thumb is pressing (for the little key highlight and the thumb's position) */
  key: '',
  keyAt: 0,
  /** bumps whenever the screen needs redrawing */
  version: 0,
  running: false,
  done: false,
};

const T = {
  start: 900,
  theirTyping: 1300,
  readShort: 2000,
  readLong: 3400,
  typeChar: 42,
  beforeSend: 450,
  lastHold: 2600,
};

let rush: (() => void) | null = null;
let rushing = false;

/** A tap: finish what's happening now (typing or waiting). */
export function hurryChat() {
  rushing = true;
  rush?.();
}

export function resetChat() {
  phoneChat.msgs = [];
  phoneChat.theirTyping = false;
  phoneChat.draft = '';
  phoneChat.key = '';
  phoneChat.running = false;
  phoneChat.done = false;
  phoneChat.version++;
}

/** Runs the whole conversation; resolves after the last message has been read. Returns a cancel function. */
export function runChat(onDone: () => void) {
  let cancelled = false;
  const timers: number[] = [];
  const wait = (ms: number) =>
    new Promise<void>((res) => {
      if (rushing && ms > 300) {
        rushing = false;
        ms = 250;
      }
      const id = window.setTimeout(() => {
        rush = null;
        res();
      }, ms);
      timers.push(id);
      rush = () => {
        window.clearTimeout(id);
        rush = null;
        rushing = false;
        res();
      };
    });
  const bump = () => phoneChat.version++;
  const chat = copy.story.chat as readonly Msg[];

  resetChat();
  phoneChat.running = true;
  (async () => {
    await wait(T.start);
    for (let i = 0; i < chat.length; i++) {
      if (cancelled) return;
      const m = chat[i];
      if (m.from === 'them') {
        phoneChat.theirTyping = true;
        bump();
        await wait(T.theirTyping);
        if (cancelled) return;
        phoneChat.theirTyping = false;
        phoneChat.msgs = [...phoneChat.msgs, m];
        bump();
        chatPing();
        navigator.vibrate?.(18);
        await wait(m.text.length > 24 ? T.readLong : T.readShort);
      } else {
        // his thumb types the reply, with a natural, slightly uneven rhythm
        for (let k = 1; k <= m.text.length; k++) {
          if (cancelled) return;
          if (rushing) {
            k = m.text.length;
          }
          phoneChat.draft = m.text.slice(0, k);
          phoneChat.key = m.text[k - 1].toLowerCase();
          phoneChat.keyAt = performance.now();
          bump();
          if (k < m.text.length) {
            const ch = m.text[k - 1];
            await new Promise<void>((r) => timers.push(window.setTimeout(r, T.typeChar + (ch === ' ' ? 50 : 0) + (ch === ',' ? 180 : 0) + Math.random() * 40)));
          }
        }
        rushing = false;
        await wait(T.beforeSend);
        if (cancelled) return;
        phoneChat.draft = '';
        phoneChat.key = '';
        phoneChat.msgs = [...phoneChat.msgs, m];
        bump();
        chatPop();
        if (i === chat.length - 1) {
          await wait(T.lastHold);
          if (cancelled) return;
          phoneChat.running = false;
          phoneChat.done = true;
          bump();
          onDone();
          return;
        }
        await wait(m.text.length > 40 ? T.readLong : T.readShort);
      }
    }
  })();
  return () => {
    cancelled = true;
    rush = null;
    rushing = false;
    timers.forEach((id) => window.clearTimeout(id));
  };
}
