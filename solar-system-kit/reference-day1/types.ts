/* ------------------------------------------------------------------ */
/* Core types for COSMIC — An Unordinary Journey.                      */
/* Content lives in /data; UI and 3D read it through these types so    */
/* future missions (Day 2+) are added as data, not as new code paths.  */
/* ------------------------------------------------------------------ */

export type PlanetId =
  | 'mercury'
  | 'venus'
  | 'earth'
  | 'mars'
  | 'jupiter'
  | 'saturn'
  | 'uranus'
  | 'neptune';

/** Parameters for the procedural (canvas-generated) planet texture. */
export interface PlanetTextureSpec {
  kind: 'rocky' | 'cloudy' | 'earth' | 'banded' | 'ice';
  /** Base palette, light → dark. */
  palette: string[];
  /** Number of latitude bands (gas/ice giants). */
  bands?: number;
  /** Turbulence strength 0–1. */
  turbulence?: number;
  /** Storms: u/v texture position (0–1), size, colour. */
  storms?: { u: number; v: number; size: number; color: string; companion?: string }[];
  seed: number;
}

export interface RingSpec {
  inner: number; // × planet radius
  outer: number; // × planet radius
  /** Ring bands from inner → outer: [position 0–1, opacity 0–1]. */
  bands: [number, number][];
  color: string;
  opacity: number;
}

export interface PlanetData {
  id: PlanetId;
  name: string;
  /** Display radius in scene units (NOT to scale). */
  radius: number;
  /** Display orbit radius in scene units (NOT to scale). */
  orbit: number;
  /** Display orbital speed in rad / sim-second (NOT to scale). */
  orbitSpeed: number;
  /** Starting orbital angle (radians). */
  phase: number;
  /** Axial tilt in degrees (real value, used for visual orientation). */
  tiltDeg: number;
  /** Spin speed in rad/s for display; negative = retrograde. */
  spin: number;
  texture: PlanetTextureSpec;
  atmosphere?: { color: string; intensity: number };
  rings?: RingSpec;
  /** Short line for the inspection card. */
  blurb: string;
}

export type MissionStatus = 'active' | 'locked';

export interface Fact {
  /** Small emoji shown on the discovery card. */
  icon?: string;
  label: string;
  value: string;
  note?: string;
}

export type HotspotAnchor =
  /** On the spinning surface at a texture location (moves with the planet). */
  | { type: 'surface'; u: number; v: number }
  /** On the rotation pole (in the tilted frame). */
  | { type: 'pole' }
  /** On the opposite (south) pole. */
  | { type: 'southPole' }
  /** On the ring plane edge facing the camera at arrival. */
  | { type: 'ring' }
  /** On the planet's limb, to the camera's right at arrival. */
  | { type: 'limb' }
  /** On the sun-facing side. */
  | { type: 'subsolar' }
  /** Attached to a moon. */
  | { type: 'moon'; moonId: string };

export interface Hotspot {
  id: string;
  title: string;
  anchor: HotspotAnchor;
  body: string[];
}

export type ChapterArtId =
  | 'winds'
  | 'mystery'
  | 'server'
  | 'tilt'
  | 'food'
  | 'professor'
  | 'classified'
  | 'helpdesk';

export interface PersonalityChapter {
  id: string;
  title: string;
  inspiredBy: string;
  art: ChapterArtId;
  paragraphs: string[];
  /** Softer, supportive line shown after the joke. */
  softLine?: string;
  /** Sound accent played on reveal (Uranus chapters). */
  sfx?: SfxName;
}

export interface Destination {
  planet: PlanetId;
  chapterTitle: string;
  tagline: string;
  facts: Fact[];
  factsFootnote?: string;
  hotspots: Hotspot[];
  observationIntro: string;
  chapters: PersonalityChapter[];
  /** Tone controls presentation energy. */
  tone: 'calm' | 'playful';
  final: { paragraphs: string[]; cta: string };
  /** Distinct travel style for the approach. */
  travel: { style: 'glide' | 'warp'; durationMs: number; label: string };
}

export interface ScannerMetric {
  label: string;
  value: string;
  /** Visual fill 0–1+ (values above 1 overflow, deliberately). */
  fill: number;
  effect?: 'overflow' | 'redacted' | 'glitch' | 'pulse';
}

export interface MissionData {
  id: string;
  number: string; // "01"
  title: string; // "THE OUTER WORLDS"
  dateISO: string;
  dateLabel: string; // "22 NOVEMBER 2026"
  status: MissionStatus;
  destinations: Destination[];
  scanner?: {
    disclaimer: string;
    metrics: ScannerMetric[];
    result: string;
    resultLine: string;
  };
  completion?: {
    title: string;
    summaries: { planet: PlanetId; text: string }[];
    quote: string;
    badge: string[];
  };
}

/** A mission that is announced but not built yet. */
export interface MissionPreview {
  id: string;
  number: string;
  dateLabel: string;
  planet: PlanetId;
  title: string;
  status: 'locked';
}

export type SfxName =
  | 'whoosh'
  | 'warp'
  | 'arrive'
  | 'chime'
  | 'click'
  | 'boing'
  | 'munch'
  | 'ping'
  | 'alert'
  | 'blip'
  | 'success'
  | 'engine'
  | 'thrust'
  | 'flyby'
  | 'rumble'
  | 'comet'
  | 'drone'
  | 'reveal';

export type Phase =
  | 'loading'
  | 'intro' // cinematic: the Milky Way → our Solar System
  | 'solar' // opening: free exploration of the Solar System
  | 'cockpit' // spacecraft initialised, choosing a destination
  | 'earth' // first departure: down to Earth, Giga House → JNU → hostel, and back up
  | 'homecoming' // after Uranus: back to Earth and the same hostel
  | 'travel' // cinematic flight
  | 'explore' // science + hotspots, orbit inspection
  | 'observe' // personality chapters
  | 'final' // final observation shot
  | 'scanner' // fictional personality scanner
  | 'garden' // lavender meadow grows and blooms (after the scanner)
  | 'complete'; // mission complete

export type Quality = 'high' | 'low';

export type CameraModeLabel = 'OVERVIEW' | 'INSPECT' | 'CINEMATIC' | 'ORBIT' | 'AUTO';
