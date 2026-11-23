// Device / capability detection, read once at startup.

const params = new URLSearchParams(location.search);

function mq(q: string): boolean {
  try {
    return window.matchMedia(q).matches;
  } catch {
    return false;
  }
}

const coarse = mq('(pointer: coarse)');
const isMobile = coarse || window.innerWidth < 768;
const lowCore = (navigator.hardwareConcurrency ?? 8) <= 4;
const reducedMotion = mq('(prefers-reduced-motion: reduce)') || params.has('reduced');

export const env = {
  coarse,
  isMobile,
  lowPower: isMobile || lowCore,
  reducedMotion,
  dprCap: isMobile ? 1.25 : 1.75,
  /** `?nogl` forces the no-WebGL fallback (for testing). */
  forceNoGL: params.has('nogl'),
};

const motionScale = reducedMotion ? 0.65 : 1;

export const counts = {
  stars: Math.round((env.lowPower ? 700 : 1500) * motionScale),
  dust: Math.round((env.lowPower ? 70 : 150) * motionScale),
  octaves: env.lowPower ? 3 : 5,
};

export function hasWebGL(): boolean {
  if (env.forceNoGL) return false;
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}
