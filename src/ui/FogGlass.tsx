import { useEffect, useRef } from 'react';
import { env } from '../lib/env';

/**
 * A misty, frosted glass over the punchline. She rubs it clear (finger drag, or a
 * mouse just gliding over it). Calls `onClear` once most of it is wiped.
 */
export function FogGlass({ onClear, onFirstRub }: { onClear: () => void; onFirstRub: () => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const done = useRef(false);
  const rubbed = useRef(false);

  useEffect(() => {
    const canvas = ref.current!;
    const c = canvas.getContext('2d', { willReadFrequently: true });
    if (!c) return;
    const SCALE = 0.5; // the fog is soft anyway; half resolution keeps checks cheap
    let w = 0;
    let h = 0;
    let strokes = 0;
    let lx = NaN;
    let ly = NaN;
    let pressed = false;

    const paintFog = () => {
      const r = canvas.getBoundingClientRect();
      w = Math.max(1, Math.round(r.width * SCALE));
      h = Math.max(1, Math.round(r.height * SCALE));
      canvas.width = w;
      canvas.height = h;
      const g = c.createLinearGradient(0, 0, w, h);
      g.addColorStop(0, 'rgba(232,222,250,0.72)');
      g.addColorStop(0.5, 'rgba(212,196,240,0.66)');
      g.addColorStop(1, 'rgba(236,226,250,0.72)');
      c.fillStyle = g;
      c.fillRect(0, 0, w, h);
      // misty speckles
      // misty clouds and droplets, like breath on glass
      for (let i = 0; i < 14; i++) {
        const cx = Math.random() * w;
        const cy = Math.random() * h;
        const rr = h * (0.4 + Math.random() * 0.6);
        const m = c.createRadialGradient(cx, cy, 0, cx, cy, rr);
        m.addColorStop(0, `rgba(255,255,255,${0.12 + Math.random() * 0.12})`);
        m.addColorStop(1, 'rgba(255,255,255,0)');
        c.fillStyle = m;
        c.fillRect(cx - rr, cy - rr, rr * 2, rr * 2);
      }
      for (let i = 0; i < (w * h) / 60; i++) {
        c.fillStyle = `rgba(255,255,255,${Math.random() * 0.22})`;
        c.beginPath();
        c.arc(Math.random() * w, Math.random() * h, 0.4 + Math.random() * 0.9, 0, Math.PI * 2);
        c.fill();
      }
      // a soft diagonal shine, like glass
      const s = c.createLinearGradient(0, 0, w, h);
      s.addColorStop(0.3, 'rgba(255,255,255,0)');
      s.addColorStop(0.42, 'rgba(255,255,255,0.22)');
      s.addColorStop(0.5, 'rgba(255,255,255,0)');
      c.fillStyle = s;
      c.fillRect(0, 0, w, h);
    };
    paintFog();

    const wipeAt = (x: number, y: number) => {
      const rad = Math.max(14, h * 0.55) ;
      c.globalCompositeOperation = 'destination-out';
      const steps = Number.isNaN(lx) ? 1 : Math.max(1, Math.ceil(Math.hypot(x - lx, y - ly) / (rad * 0.4)));
      for (let i = 1; i <= steps; i++) {
        const px = Number.isNaN(lx) ? x : lx + ((x - lx) * i) / steps;
        const py = Number.isNaN(ly) ? y : ly + ((y - ly) * i) / steps;
        const g = c.createRadialGradient(px, py, 0, px, py, rad);
        g.addColorStop(0, 'rgba(0,0,0,1)');
        g.addColorStop(0.6, 'rgba(0,0,0,0.75)');
        g.addColorStop(1, 'rgba(0,0,0,0)');
        c.fillStyle = g;
        c.beginPath();
        c.arc(px, py, rad, 0, Math.PI * 2);
        c.fill();
      }
      c.globalCompositeOperation = 'source-over';
      lx = x;
      ly = y;
      if (!rubbed.current) {
        rubbed.current = true;
        onFirstRub();
      }
      if (++strokes % 5 === 0) check();
    };

    const check = () => {
      if (done.current) return;
      const data = c.getImageData(0, 0, w, h).data;
      let clear = 0;
      let n = 0;
      for (let i = 3; i < data.length; i += 16) {
        n++;
        if (data[i] < 90) clear++;
      }
      if (clear / n > (env.isMobile ? 0.45 : 0.5)) {
        done.current = true;
        onClear();
      }
    };

    const local = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      return [((e.clientX - r.left) / r.width) * w, ((e.clientY - r.top) / r.height) * h] as const;
    };
    const down = (e: PointerEvent) => {
      pressed = true;
      lx = ly = NaN;
      canvas.setPointerCapture?.(e.pointerId);
      const [x, y] = local(e);
      wipeAt(x, y);
    };
    const move = (e: PointerEvent) => {
      if (done.current) return;
      if (!pressed && e.pointerType !== 'mouse') return;
      const [x, y] = local(e);
      wipeAt(x, y);
    };
    const up = () => {
      pressed = false;
      lx = ly = NaN;
    };
    const leave = () => {
      lx = ly = NaN;
    };
    canvas.addEventListener('pointerdown', down);
    canvas.addEventListener('pointermove', move);
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointercancel', up);
    canvas.addEventListener('pointerleave', leave);
    return () => {
      canvas.removeEventListener('pointerdown', down);
      canvas.removeEventListener('pointermove', move);
      canvas.removeEventListener('pointerup', up);
      canvas.removeEventListener('pointercancel', up);
      canvas.removeEventListener('pointerleave', leave);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <canvas ref={ref} className="fog-glass" aria-hidden="true" />;
}
