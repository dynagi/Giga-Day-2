import { copy } from '../data/copy';

/**
 * Saturn's script, as a list of beats: chapter title cards, lines (grouped into stanzas),
 * the small pause before each soft line, the soft line itself, then the final thought, the secret,
 * and the completion card. Lines advance on their own (about 2.5–3.5 s, longer for long lines);
 * a tap shows the next line at once. The 3D scene reads the director state to stay in sync.
 */

export type Part = 'rings' | 'shani' | 'moons' | 'gravity' | 'final' | 'secret' | 'complete';

export interface Beat {
  part: Part;
  kind: 'title' | 'line' | 'pause' | 'soft' | 'last' | 'card';
  /** stanza key (lines of the same stanza stay on screen together) */
  stanza: string;
  text: string;
  /** index of this line within its part (0, 1, 2…), −1 for titles/pauses, 99 for the soft line */
  line: number;
  ms: number;
  /** a tap can hurry it */
  tappable: boolean;
}

function lineMs(text: string, lastOfStanza: boolean) {
  const base = Math.min(5200, Math.max(2700, 2300 + text.length * 38));
  return base + (lastOfStanza ? 600 : 0);
}

function build(): Beat[] {
  const s = copy.saturn;
  const beats: Beat[] = [];
  const stanzas = (part: Part, list: readonly (readonly string[])[], extra: (text: string, i: number) => number = () => 0) => {
    let i = 0;
    list.forEach((st, k) => {
      st.forEach((text, j) => {
        beats.push({ part, kind: 'line', stanza: `${part}-${k}`, text, line: i, ms: lineMs(text, j === st.length - 1) + extra(text, i), tappable: true });
        i++;
      });
    });
  };
  for (const ch of s.chapters) {
    const part = ch.id as Part;
    beats.push({ part, kind: 'title', stanza: `${part}-title`, text: ch.title, line: -1, ms: part === 'rings' ? 4200 : 3600, tappable: true });
    stanzas(part, ch.stanzas, (text) => (text.includes('Giga') ? 2600 : 0)); // the comedy pause
    beats.push({ part, kind: 'pause', stanza: `${part}-pause`, text: '', line: -1, ms: 1100, tappable: false });
    beats.push({ part, kind: 'soft', stanza: `${part}-soft`, text: ch.soft, line: 99, ms: 5600, tappable: true });
    beats.push({ part, kind: 'pause', stanza: `${part}-gap`, text: '', line: -1, ms: 1400, tappable: false });
  }
  beats.push({ part: 'final', kind: 'pause', stanza: 'final-in', text: '', line: -1, ms: 2400, tappable: false });
  stanzas('final', s.final, (text) => (text.endsWith('💜') ? 3600 : 0)); // pause on the final question
  // the secret: the little light appears first
  beats.push({ part: 'secret', kind: 'pause', stanza: 'secret-in', text: '', line: -1, ms: 4200, tappable: false });
  stanzas('secret', s.secret, (text) => (text.includes('Enceladus') ? 1400 : 0));
  beats.push({ part: 'secret', kind: 'pause', stanza: 'secret-pause', text: '', line: -1, ms: 1800, tappable: false });
  beats.push({ part: 'secret', kind: 'last', stanza: 'secret-last', text: s.secretLast, line: 98, ms: 6000, tappable: true });
  beats.push({ part: 'complete', kind: 'card', stanza: 'complete', text: s.complete.title, line: -1, ms: 14000, tappable: true });
  return beats;
}

export const BEATS = build();

/** Where Saturn's story is right now (written by the overlay, read by the 3D scene). */
export const saturnDir = {
  index: 0,
  /** seconds since this beat began */
  beatT: 0,
  /** seconds since this part (chapter) began */
  partT: 0,
  part: BEATS[0].part as Part,
  line: -1,
  kind: BEATS[0].kind as Beat['kind'],
  /** overall seconds in the Saturn phase */
  t: 0,
};

export function firstBeatOf(part: Part) {
  return BEATS.findIndex((b) => b.part === part);
}

export const PART_ORDER: Part[] = ['rings', 'shani', 'moons', 'gravity', 'final', 'secret', 'complete'];

export function resetSaturnDir() {
  saturnDir.index = 0;
  saturnDir.beatT = 0;
  saturnDir.partT = 0;
  saturnDir.part = BEATS[0].part;
  saturnDir.line = -1;
  saturnDir.kind = BEATS[0].kind;
  saturnDir.t = 0;
}
