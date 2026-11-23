// Mutable, render-loop-only signals shared between UI timelines and the scene.
// Kept outside React/zustand so writing them never triggers re-renders.

export const fx = {
  /** 0 at the gate, eased to 1 during atmosphere (driven by CameraDirector). */
  reveal: 0,
  /** A few stars near a point brighten slightly. x/y in NDC, r radius (aspect-corrected), band selects which stars. */
  focus: { x: 0, y: 0.05, r: 0.75, lo: 0, hi: 0, target: 0, s: 0 },
  /** Star twinkle wave on catch. */
  wave: { t0: -100, x: 0, y: 0, amp: 1 },
  /** Star stretch amount (0..1), from camera speed. */
  stretch: 0,
  /** Camera forward flight progress 0..1 (transition). */
  flight: 0,
  /** Quiet, intimate mood for the poem: dims stars a little and stops the camera drift. */
  hush: { target: 0, v: 0 },
  /** Pointer / tilt for parallax, NDC-ish -1..1. */
  pointer: { x: 0, y: 0 },
};

export function resetFx() {
  fx.reveal = 0;
  fx.focus.target = 0;
  fx.focus.s = 0;
  fx.wave.t0 = -100;
  fx.stretch = 0;
  fx.flight = 0;
  fx.hush.target = 0;
  fx.hush.v = 0;
  fx.pointer.x = 0;
  fx.pointer.y = 0;
}
