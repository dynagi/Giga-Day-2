import { create } from 'zustand';
import { CURRENT_MISSION } from '../data/missions';
import type { CameraModeLabel, Destination, Phase, PlanetId, Quality } from '../types';

const QUALITY_KEY = 'cosmic.quality';

function initialQuality(): Quality {
  try {
    const saved = sessionStorage.getItem(QUALITY_KEY);
    if (saved === 'high' || saved === 'low') return saved;
  } catch {
    /* storage blocked */
  }
  const coarse = window.matchMedia('(pointer: coarse)').matches;
  const cores = navigator.hardwareConcurrency ?? 4;
  return coarse || cores <= 4 ? 'low' : 'high';
}

/** What the camera rig should do next. `id` changes on every request. */
export type CameraRequest =
  | { id: number; kind: 'overview' }
  | { id: number; kind: 'cockpit' }
  | { id: number; kind: 'inspect'; planet: PlanetId }
  /** `seamless`: continue straight on from the camera's current flight (no cut, the corridor joins mid-way). */
  | { id: number; kind: 'travel'; planet: PlanetId; from: PlanetId; seamless?: boolean }
  | { id: number; kind: 'orbit'; planet: PlanetId }
  | { id: number; kind: 'final'; planet: PlanetId }
  | { id: number; kind: 'complete' };

type CameraRequestInput = CameraRequest extends infer R ? (R extends { id: number } ? Omit<R, 'id'> : never) : never;

interface CosmicState {
  phase: Phase;
  quality: Quality;
  webglOk: boolean;
  /** Destination currently being visited (Neptune → Uranus). */
  destination: PlanetId | null;
  /** Planet inspected in the overview. */
  selected: PlanetId | null;
  hovered: PlanetId | null;
  hotspot: string | null;
  chapter: number;
  discovered: PlanetId[];
  camera: CameraRequest;
  cameraMode: CameraModeLabel;
  /** Increments to ask the rig to finish the current cinematic immediately. */
  skipToken: number;
  scienceOpen: boolean;
  previewOpen: boolean;
  /** Id of the journey being flown (set by the camera rig once the corridor exists). */
  journeyId: number;
  setJourneyId: (id: number) => void;

  setWebgl: (ok: boolean) => void;
  setQuality: (q: Quality) => void;
  ready: () => void;
  /** Shaders compiled and textures uploaded (so nothing hitches later). */
  warm: boolean;
  setWarm: (v: boolean) => void;
  /** End of the opening cinematic: settle into the Solar System and say hello. */
  finishIntro: () => void;
  /** Watch the opening cinematic again. */
  replayIntro: () => void;
  /** The personal "Hi, Astronomy Lover!" message panel. */
  messageOpen: boolean;
  setMessageOpen: (v: boolean) => void;
  /** Documentary caption shown during the cinematic (null = none). */
  introCaption: string | null;
  setIntroCaption: (c: string | null) => void;
  hover: (id: PlanetId | null) => void;
  select: (id: PlanetId | null) => void;
  resetCamera: () => void;
  /** Fly back to the default close-up of the planet being explored. */
  recenter: () => void;
  initialize: () => void;
  backToWelcome: () => void;
  travelTo: (id: PlanetId, opts?: { seamless?: boolean }) => void;
  /** The Earth story (first departure) has been seen. */
  earthStoryDone: boolean;
  /** The return home (after Uranus) has been seen. */
  homeDone: boolean;
  /** The camera is resting at the hostel after coming home. */
  atHome: boolean;
  finishEarth: () => void;
  finishHomecoming: () => void;
  replayTravel: () => void;
  skipTravel: () => void;
  arrive: () => void;
  setCameraMode: (m: CameraModeLabel) => void;
  openHotspot: (id: string | null) => void;
  beginObservation: () => void;
  nextChapter: () => void;
  finishDestination: () => void;
  continueFromFinal: () => void;
  /** After the scanner: the lavender meadow grows before the mission summary. */
  growGarden: () => void;
  completeMission: () => void;
  returnToSolarSystem: () => void;
  showSummary: () => void;
  setScienceOpen: (v: boolean) => void;
  setPreviewOpen: (v: boolean) => void;

  /* Planet discovery (close-up exploration). */
  /** Planet surfaces rotate (she can pause them to study a feature). */
  spinOn: boolean;
  toggleSpin: () => void;
  /** Venus: show the radar-mapped surface instead of the cloud tops. */
  venusRadar: boolean;
  toggleVenusRadar: () => void;
  /** Feature marker opened on the planet being explored. */
  feature: string | null;
  setFeature: (id: string | null) => void;
  /** The detailed science panel ("Discover this planet"). */
  discoverOpen: boolean;
  setDiscoverOpen: (v: boolean) => void;
}

let requestId = 0;
const req = (r: CameraRequestInput): CameraRequest => ({ ...r, id: ++requestId }) as CameraRequest;

export const destinationFor = (planet: PlanetId | null): Destination | undefined =>
  CURRENT_MISSION.destinations.find((d) => d.planet === planet);

/** Mission order: Neptune, then Uranus. */
export const MISSION_ORDER: PlanetId[] = CURRENT_MISSION.destinations.map((d) => d.planet);

export function isUnlocked(id: PlanetId, discovered: PlanetId[]) {
  const i = MISSION_ORDER.indexOf(id);
  if (i < 0) return false; // not part of this mission → future destination
  return MISSION_ORDER.slice(0, i).every((p) => discovered.includes(p));
}

export const useCosmic = create<CosmicState>((set, get) => ({
  phase: 'loading',
  quality: initialQuality(),
  webglOk: true,
  destination: null,
  selected: null,
  hovered: null,
  hotspot: null,
  chapter: 0,
  discovered: [],
  camera: req({ kind: 'overview' }),
  cameraMode: 'OVERVIEW',
  skipToken: 0,
  scienceOpen: false,
  previewOpen: false,
  journeyId: 0,
  setJourneyId: (id) => set({ journeyId: id }),

  setWebgl: (ok) => set({ webglOk: ok }),
  setQuality: (q) => {
    try {
      sessionStorage.setItem(QUALITY_KEY, q);
    } catch {
      /* ignore */
    }
    set({ quality: q });
  },
  // WebGL: the cinematic plays first. Without it, straight to the Solar System.
  ready: () => (get().webglOk ? set({ phase: 'intro', introCaption: null }) : set({ phase: 'solar', messageOpen: true })),
  finishIntro: () => {
    if (get().phase !== 'intro') return;
    set({ phase: 'solar', introCaption: null, messageOpen: true, camera: req({ kind: 'overview' }) });
  },
  replayIntro: () => {
    if (!get().webglOk) return;
    set({ phase: 'intro', selected: null, hovered: null, discoverOpen: false, feature: null, messageOpen: false, introCaption: null });
  },
  warm: false,
  setWarm: (v) => set({ warm: v }),
  messageOpen: false,
  setMessageOpen: (v) => set({ messageOpen: v }),
  introCaption: null,
  setIntroCaption: (c) => set({ introCaption: c }),
  hover: (id) => set({ hovered: id }),
  select: (id) => {
    const { phase } = get();
    if (phase !== 'solar' && phase !== 'cockpit') return;
    set({
      selected: id,
      feature: null,
      discoverOpen: false,
      venusRadar: false,
      spinOn: true,
      camera: id ? req({ kind: 'inspect', planet: id }) : req({ kind: phase === 'solar' ? 'overview' : 'cockpit' }),
    });
  },
  resetCamera: () => {
    const { phase, destination } = get();
    if (phase === 'solar') set({ selected: null, discoverOpen: false, feature: null, camera: req({ kind: 'overview' }) });
    else if (phase === 'cockpit') set({ selected: null, camera: req({ kind: 'cockpit' }) });
    else if (destination && (phase === 'explore' || phase === 'observe' || phase === 'final'))
      set({ camera: req({ kind: phase === 'final' ? 'final' : 'orbit', planet: destination }) });
    else if (phase === 'complete') set({ camera: req({ kind: 'complete' }) });
  },
  recenter: () => {
    const { selected } = get();
    if (selected) set({ camera: req({ kind: 'inspect', planet: selected }) });
  },
  initialize: () => set({ phase: 'cockpit', selected: null, camera: req({ kind: 'cockpit' }) }),
  backToWelcome: () => set({ phase: 'solar', selected: null, camera: req({ kind: 'overview' }) }),
  earthStoryDone: false,
  homeDone: false,
  atHome: false,
  finishEarth: () => {
    set({ earthStoryDone: true });
    // The Earth story ends already flying out at warp: the Neptune journey picks up from there.
    get().travelTo('neptune', { seamless: true });
  },
  finishHomecoming: () => set({ phase: 'scanner', homeDone: true, atHome: true }),
  travelTo: (id, opts) => {
    const { discovered, phase, destination, earthStoryDone, webglOk } = get();
    if (!isUnlocked(id, discovered)) return; // never enter an unfinished / locked destination
    // The very first trip to Neptune starts on Earth: Giga House → JNU → the hostel → up into space.
    if (id === 'neptune' && !earthStoryDone && webglOk && phase !== 'final' && phase !== 'earth') {
      set({ phase: 'earth', selected: null, hotspot: null, discoverOpen: false, feature: null, messageOpen: false });
      return;
    }
    // Every first journey departs from Earth; later legs leave from the planet just explored.
    const from: PlanetId = phase === 'final' && destination ? destination : 'earth';
    set({
      phase: 'travel',
      destination: id,
      selected: null,
      discoverOpen: false,
      feature: null,
      hotspot: null,
      chapter: 0,
      camera: req({ kind: 'travel', planet: id, from, seamless: !!opts?.seamless && from === 'earth' }),
    });
  },
  replayTravel: () => {
    const { destination } = get();
    if (!destination) return;
    const i = MISSION_ORDER.indexOf(destination);
    const from: PlanetId = i > 0 ? MISSION_ORDER[i - 1] : 'earth';
    set({ phase: 'travel', hotspot: null, chapter: 0, camera: req({ kind: 'travel', planet: destination, from }) });
  },
  skipTravel: () => set((s) => ({ skipToken: s.skipToken + 1 })),
  arrive: () => {
    const { destination } = get();
    if (!destination) return;
    set({ phase: 'explore', camera: req({ kind: 'orbit', planet: destination }) });
  },
  setCameraMode: (m) => set({ cameraMode: m }),
  openHotspot: (id) => set({ hotspot: id }),
  beginObservation: () => set({ phase: 'observe', chapter: 0, hotspot: null }),
  nextChapter: () => set((s) => ({ chapter: s.chapter + 1 })),
  finishDestination: () => {
    const { destination, discovered } = get();
    if (!destination) return;
    set({
      phase: 'final',
      discovered: discovered.includes(destination) ? discovered : [...discovered, destination],
      camera: req({ kind: 'final', planet: destination }),
    });
  },
  continueFromFinal: () => {
    const { destination } = get();
    const i = destination ? MISSION_ORDER.indexOf(destination) : -1;
    const next = MISSION_ORDER[i + 1];
    if (next) get().travelTo(next);
    // After the last planet of the day, the camera flies home to the hostel first.
    else if (!get().homeDone && get().webglOk) set({ phase: 'homecoming' });
    else set({ phase: 'scanner' });
  },
  growGarden: () => set({ phase: 'garden' }),
  // Back home at the hostel, the summary appears where we are (no flight away).
  completeMission: () => (get().atHome ? set({ phase: 'complete' }) : set({ phase: 'complete', camera: req({ kind: 'complete' }) })),
  returnToSolarSystem: () =>
    set({ phase: 'cockpit', selected: null, hotspot: null, atHome: false, camera: req({ kind: 'cockpit' }) }),
  showSummary: () => (get().atHome ? set({ phase: 'complete' }) : set({ phase: 'complete', camera: req({ kind: 'complete' }) })),
  setScienceOpen: (v) => set({ scienceOpen: v }),
  setPreviewOpen: (v) => set({ previewOpen: v }),

  spinOn: true,
  toggleSpin: () => set((s) => ({ spinOn: !s.spinOn })),
  venusRadar: false,
  toggleVenusRadar: () => set((s) => ({ venusRadar: !s.venusRadar })),
  feature: null,
  setFeature: (id) => set({ feature: id }),
  discoverOpen: false,
  setDiscoverOpen: (v) => set({ discoverOpen: v, feature: null }),
}));
