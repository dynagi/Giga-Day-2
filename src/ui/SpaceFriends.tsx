import { CSSProperties, useEffect, useState } from 'react';
import { copy } from '../data/copy';
import { env } from '../lib/env';

/**
 * Four little space friends float in, say hi to Richa, wave, and float away.
 * Tap one and it does a happy bounce with tiny hearts.
 */

type Kind = 'blip' | 'jelly' | 'twinkle' | 'mochi';

interface Friend {
  kind: Kind;
  x: number; // % of the screen
  y: number;
  from: [number, number]; // entry offset, in vmin
  side: 'left' | 'right'; // which way the speech bubble leans
}

const FRIENDS: Friend[] = [
  { kind: 'twinkle', x: 20, y: 22, from: [-40, -30], side: 'left' },
  { kind: 'jelly', x: 80, y: 21, from: [40, -34], side: 'right' },
  { kind: 'blip', x: 22, y: 70, from: [-46, 30], side: 'left' },
  { kind: 'mochi', x: 78, y: 71, from: [44, 34], side: 'right' },
];

// timing (ms) from the moment the cosmic opening begins
const T = {
  enter: 1300,
  enterStagger: 380,
  hi: 3100,
  hiStagger: 520,
  leave: 7900,
  leaveStagger: 140,
};

function Creature({ kind }: { kind: Kind }) {
  switch (kind) {
    case 'blip':
      return (
        <svg viewBox="0 0 100 100" className="sf-svg">
          <defs>
            <radialGradient id="sf-blip" cx="40%" cy="35%" r="70%">
              <stop offset="0%" stopColor="#efe4ff" />
              <stop offset="60%" stopColor="#b49ddc" />
              <stop offset="100%" stopColor="#8d6bc9" />
            </radialGradient>
          </defs>
          {/* antenna with a glowing tip */}
          <path d="M50 30 Q46 16 54 8" stroke="#b49ddc" strokeWidth="3" fill="none" strokeLinecap="round" />
          <circle className="sf-glow" cx="54" cy="8" r="5" fill="#f3d9a4" />
          {/* waving arm */}
          <g className="sf-wave" style={{ transformOrigin: '78px 58px' }}>
            <rect x="76" y="40" width="9" height="22" rx="4.5" fill="#a68bd8" />
          </g>
          <ellipse cx="22" cy="64" rx="5" ry="9" fill="#a68bd8" transform="rotate(20 22 64)" />
          <path d="M50 28 C74 28 84 46 82 64 C80 82 66 90 50 90 C34 90 20 82 18 64 C16 46 26 28 50 28 Z" fill="url(#sf-blip)" />
          <ellipse cx="40" cy="92" rx="6" ry="3.5" fill="#8d6bc9" />
          <ellipse cx="60" cy="92" rx="6" ry="3.5" fill="#8d6bc9" />
          <g className="sf-eyes">
            <ellipse cx="40" cy="56" rx="7" ry="9" fill="#fff" />
            <ellipse cx="60" cy="56" rx="7" ry="9" fill="#fff" />
            <circle cx="41" cy="58" r="4" fill="#2e1e48" />
            <circle cx="61" cy="58" r="4" fill="#2e1e48" />
            <circle cx="42.5" cy="56" r="1.4" fill="#fff" />
            <circle cx="62.5" cy="56" r="1.4" fill="#fff" />
          </g>
          <circle cx="31" cy="68" r="4.5" fill="#f2bdd6" opacity="0.8" />
          <circle cx="69" cy="68" r="4.5" fill="#f2bdd6" opacity="0.8" />
          <path d="M44 72 Q50 78 56 72" stroke="#2e1e48" strokeWidth="2.4" fill="none" strokeLinecap="round" />
        </svg>
      );
    case 'jelly':
      return (
        <svg viewBox="0 0 100 100" className="sf-svg">
          <defs>
            <radialGradient id="sf-jelly" cx="45%" cy="30%" r="75%">
              <stop offset="0%" stopColor="#fff0f6" />
              <stop offset="60%" stopColor="#f2bdd6" stopOpacity="0.95" />
              <stop offset="100%" stopColor="#d695a8" stopOpacity="0.9" />
            </radialGradient>
          </defs>
          <g className="sf-tentacles" stroke="#eca8c9" strokeWidth="3.4" fill="none" strokeLinecap="round" opacity="0.9">
            <path d="M30 58 Q26 72 32 84 Q36 92 30 98" />
            <path d="M42 60 Q40 76 46 88" />
            <path d="M58 60 Q60 76 54 88" />
            <path d="M70 58 Q74 72 68 84 Q64 92 70 98" />
          </g>
          {/* one tentacle waving */}
          <g className="sf-wave" style={{ transformOrigin: '80px 52px' }}>
            <path d="M80 52 Q92 44 92 30" stroke="#eca8c9" strokeWidth="3.6" fill="none" strokeLinecap="round" />
          </g>
          <path d="M18 58 C18 30 34 16 50 16 C66 16 82 30 82 58 C74 62 68 56 62 60 C56 64 44 64 38 60 C32 56 26 62 18 58 Z" fill="url(#sf-jelly)" />
          <ellipse cx="38" cy="30" rx="8" ry="4" fill="#fff" opacity="0.45" transform="rotate(-20 38 30)" />
          <g className="sf-eyes">
            <ellipse cx="40" cy="42" rx="4.2" ry="5.4" fill="#2e1e48" />
            <ellipse cx="60" cy="42" rx="4.2" ry="5.4" fill="#2e1e48" />
            <circle cx="41.3" cy="40.4" r="1.4" fill="#fff" />
            <circle cx="61.3" cy="40.4" r="1.4" fill="#fff" />
          </g>
          <circle cx="32" cy="50" r="3.6" fill="#d695a8" opacity="0.7" />
          <circle cx="68" cy="50" r="3.6" fill="#d695a8" opacity="0.7" />
          <path d="M45 50 Q50 55 55 50" stroke="#2e1e48" strokeWidth="2.2" fill="none" strokeLinecap="round" />
        </svg>
      );
    case 'twinkle':
      return (
        <svg viewBox="0 0 100 100" className="sf-svg">
          <defs>
            <radialGradient id="sf-star" cx="45%" cy="40%" r="65%">
              <stop offset="0%" stopColor="#fff8e6" />
              <stop offset="65%" stopColor="#f3d9a4" />
              <stop offset="100%" stopColor="#c9a45c" />
            </radialGradient>
          </defs>
          <g className="sf-wave" style={{ transformOrigin: '50px 55px' }}>
            <path
              d="M50 10 L61 38 L91 40 L67 59 L76 89 L50 72 L24 89 L33 59 L9 40 L39 38 Z"
              fill="url(#sf-star)"
              stroke="#f3d9a4"
              strokeWidth="7"
              strokeLinejoin="round"
            />
            <g className="sf-eyes">
              <ellipse cx="42" cy="50" rx="3.6" ry="4.8" fill="#4a3410" />
              <ellipse cx="58" cy="50" rx="3.6" ry="4.8" fill="#4a3410" />
              <circle cx="43" cy="48.6" r="1.2" fill="#fff" />
              <circle cx="59" cy="48.6" r="1.2" fill="#fff" />
            </g>
            <circle cx="35" cy="58" r="3.4" fill="#f2bdd6" opacity="0.8" />
            <circle cx="65" cy="58" r="3.4" fill="#f2bdd6" opacity="0.8" />
            <path d="M45 59 Q50 64 55 59" stroke="#4a3410" strokeWidth="2.2" fill="none" strokeLinecap="round" />
          </g>
          <path className="sf-glow" d="M86 14 l2 6 6 2 -6 2 -2 6 -2 -6 -6 -2 6 -2z" fill="#fff6e4" />
        </svg>
      );
    case 'mochi':
      return (
        <svg viewBox="0 0 100 100" className="sf-svg">
          <defs>
            <radialGradient id="sf-mochi" cx="45%" cy="30%" r="75%">
              <stop offset="0%" stopColor="#ffffff" />
              <stop offset="70%" stopColor="#ece2ff" />
              <stop offset="100%" stopColor="#c4afeb" />
            </radialGradient>
          </defs>
          {/* tiny sprout */}
          <path d="M50 22 Q50 14 50 10" stroke="#8fbf8a" strokeWidth="2.6" fill="none" strokeLinecap="round" />
          <ellipse cx="44" cy="10" rx="6" ry="3.4" fill="#a8d6a0" transform="rotate(-25 44 10)" />
          <ellipse cx="56" cy="9" rx="6" ry="3.4" fill="#a8d6a0" transform="rotate(25 56 9)" />
          <g className="sf-wave" style={{ transformOrigin: '22px 60px' }}>
            <ellipse cx="14" cy="50" rx="5" ry="10" fill="#dccbf6" transform="rotate(-30 14 50)" />
          </g>
          <path d="M20 60 C20 34 34 22 50 22 C66 22 80 34 80 60 L80 82 C74 88 70 80 64 86 C58 92 54 82 50 88 C46 82 42 92 36 86 C30 80 26 88 20 82 Z" fill="url(#sf-mochi)" />
          <g className="sf-eyes">
            <ellipse cx="41" cy="52" rx="4.4" ry="5.6" fill="#2e1e48" />
            <ellipse cx="59" cy="52" rx="4.4" ry="5.6" fill="#2e1e48" />
            <circle cx="42.3" cy="50.2" r="1.5" fill="#fff" />
            <circle cx="60.3" cy="50.2" r="1.5" fill="#fff" />
          </g>
          <circle cx="32" cy="62" r="4" fill="#f2bdd6" opacity="0.85" />
          <circle cx="68" cy="62" r="4" fill="#f2bdd6" opacity="0.85" />
          <ellipse cx="50" cy="63" rx="3.6" ry="3" fill="#2e1e48" />
        </svg>
      );
  }
}

export function SpaceFriends() {
  const lines = copy.friends;
  const [stage, setStage] = useState<'pre' | 'in' | 'hi' | 'out'>('pre');
  const [hiCount, setHiCount] = useState(0);
  const [happy, setHappy] = useState<Record<number, number>>({});

  useEffect(() => {
    const ids = [
      window.setTimeout(() => setStage('in'), T.enter),
      window.setTimeout(() => setStage('hi'), T.hi),
      ...FRIENDS.map((_, i) => window.setTimeout(() => setHiCount(i + 1), T.hi + i * T.hiStagger)),
      window.setTimeout(() => setStage('out'), T.leave),
    ];
    return () => ids.forEach((id) => window.clearTimeout(id));
  }, []);

  const boop = (i: number) => {
    setHappy((h) => ({ ...h, [i]: (h[i] ?? 0) + 1 }));
    navigator.vibrate?.(10);
  };

  return (
    <div className={`sf sf-${stage}${env.reducedMotion ? ' is-calm' : ''}`} aria-live="polite">
      {FRIENDS.map((f, i) => {
        const taps = happy[i] ?? 0;
        const said = taps > 0 ? lines.boop[(i + taps - 1) % lines.boop.length] : lines.hi[i % lines.hi.length];
        return (
          <div
            key={f.kind}
            className={`sf-friend sf-${f.kind} sf-side-${f.side}`}
            style={
              {
                left: `${f.x}%`,
                top: `${f.y}%`,
                '--fx': `${f.from[0]}vmin`,
                '--fy': `${f.from[1]}vmin`,
                '--i': i,
                '--enter-delay': `${i * T.enterStagger}ms`,
                '--leave-delay': `${i * T.leaveStagger}ms`,
              } as CSSProperties
            }
          >
            <button
              type="button"
              className="sf-body"
              aria-label={`Say hi back to the ${f.kind}`}
              onClick={() => boop(i)}
            >
              <span key={taps} className={`sf-bounce${taps ? ' is-happy' : ''}`}>
                <Creature kind={f.kind} />
              </span>
              {taps > 0 && (
                <span key={`h${taps}`} className="sf-hearts" aria-hidden="true">
                  <span>💜</span>
                  <span>💜</span>
                  <span>✨</span>
                </span>
              )}
            </button>
            {(hiCount > i || taps > 0) && stage !== 'out' && (
              <p key={`${taps}`} className="sf-bubble">
                {said}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
