import { create } from 'zustand';

/** The phase machine. Single source of truth for where the story is. */
export type Phase = 'gate' | 'garden' | 'intro' | 'atmosphere' | 'thoughts' | 'identity' | 'light' | 'poem' | 'ask' | 'transition' | 'story' | 'earth' | 'voyage' | 'saturn' | 'next';

export const PHASES: Phase[] = ['gate', 'garden', 'intro', 'atmosphere', 'thoughts', 'identity', 'light', 'poem', 'ask', 'transition', 'story', 'earth', 'voyage', 'saturn', 'next'];

interface StoryState {
  phase: Phase;
  phaseStartedAt: number;
  muted: boolean;
  hint: boolean;
  webgl: boolean;
  goTo: (p: Phase) => void;
  setMuted: (m: boolean) => void;
  setHint: (h: boolean) => void;
  setWebgl: (w: boolean) => void;
}

export const useStory = create<StoryState>((set, get) => ({
  phase: 'gate',
  phaseStartedAt: performance.now(),
  muted: false,
  hint: false,
  webgl: true,
  goTo: (p) => {
    if (get().phase === p) return;
    set({ phase: p, phaseStartedAt: performance.now() });
  },
  setMuted: (muted) => set({ muted }),
  setHint: (hint) => {
    if (get().hint !== hint) set({ hint });
  },
  setWebgl: (webgl) => set({ webgl }),
}));

/**
 * Plug-in point for the next stage.
 * `goTo('next')` is entered automatically when the transition finishes;
 * the next stage renders where <Continued /> renders in App.tsx.
 */
export const goTo = (p: Phase) => useStory.getState().goTo(p);
export const getPhase = () => useStory.getState().phase;
