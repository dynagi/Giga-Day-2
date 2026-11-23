import { useEffect, useRef } from 'react';
import { env } from '../lib/env';

/**
 * A trail of little glowing "r"s (gold and lilac) that drift out of her finger or cursor,
 * and a little burst of them on every tap. Drawn on one small 2D canvas above the scene;
 * the loop sleeps whenever no particles are alive.
 */

interface P {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  age: number;
  size: number;
  gold: boolean;
  star: boolean;
  rot: number;
  spin: number;
}

const MAX = env.lowPower ? 140 : 240;

export function Stardust() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current!;
    const c = canvas.getContext('2d');
    if (!c) return;
    const dpr = Math.min(window.devicePixelRatio || 1, env.dprCap);
    const parts: P[] = [];
    let raf = 0;
    let last = 0;
    let lx = NaN;
    let ly = NaN;
    const reduced = env.reducedMotion;

    const resize = () => {
      canvas.width = Math.round(window.innerWidth * dpr);
      canvas.height = Math.round(window.innerHeight * dpr);
    };
    resize();
    window.addEventListener('resize', resize);

    const add = (x: number, y: number, burst: boolean) => {
      if (parts.length >= MAX) parts.shift();
      const a = Math.random() * Math.PI * 2;
      const sp = burst ? 40 + Math.random() * 70 : 6 + Math.random() * 14;
      parts.push({
        x: x + (burst ? 0 : (Math.random() - 0.5) * 6),
        y: y + (burst ? 0 : (Math.random() - 0.5) * 6),
        vx: reduced ? 0 : Math.cos(a) * sp,
        vy: reduced ? 0 : Math.sin(a) * sp - (burst ? 10 : 8),
        life: reduced ? 0.5 : burst ? 0.7 + Math.random() * 0.4 : 0.7 + Math.random() * 0.5,
        age: 0,
        size: burst ? 2.2 + Math.random() * 1.8 : 1.6 + Math.random() * 1.6,
        gold: Math.random() < 0.55,
        star: burst && Math.random() < 0.5,
        rot: (Math.random() - 0.5) * 0.6,
        spin: reduced ? 0 : (Math.random() - 0.5) * 2.4,
      });
      if (!raf) {
        last = performance.now();
        raf = requestAnimationFrame(frame);
      }
    };

    const move = (e: PointerEvent) => {
      // touch only moves while pressed; a mouse leaves dust as it glides
      const x = e.clientX;
      const y = e.clientY;
      if (Number.isNaN(lx)) {
        lx = x;
        ly = y;
        return;
      }
      const d = Math.hypot(x - lx, y - ly);
      const n = Math.min(4, Math.floor(d / (reduced ? 22 : 9)));
      for (let i = 1; i <= n; i++) add(lx + ((x - lx) * i) / n, ly + ((y - ly) * i) / n, false);
      if (n > 0) {
        lx = x;
        ly = y;
      }
    };
    const down = (e: PointerEvent) => {
      lx = e.clientX;
      ly = e.clientY;
      const n = reduced ? 4 : 10;
      for (let i = 0; i < n; i++) add(e.clientX, e.clientY, true);
    };
    const up = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') lx = ly = NaN;
    };

    function frame(now: number) {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      c!.setTransform(dpr, 0, 0, dpr, 0, 0);
      c!.clearRect(0, 0, canvas.width, canvas.height);
      c!.globalCompositeOperation = 'lighter';
      for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i];
        p.age += dt;
        if (p.age >= p.life) {
          parts.splice(i, 1);
          continue;
        }
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vx *= 1 - 2.2 * dt;
        p.vy *= 1 - 2.2 * dt;
        const k = p.age / p.life;
        const a = (1 - k) * (1 - k);
        const col = p.gold ? '243,217,164' : '220,203,246';
        const r = p.size * (1 - 0.4 * k);
        // soft glow
        const g = c!.createRadialGradient(p.x, p.y, 0, p.x, p.y, r * 4);
        g.addColorStop(0, `rgba(255,250,240,${0.9 * a})`);
        g.addColorStop(0.3, `rgba(${col},${0.45 * a})`);
        g.addColorStop(1, `rgba(${col},0)`);
        c!.fillStyle = g;
        c!.beginPath();
        c!.arc(p.x, p.y, r * 4, 0, Math.PI * 2);
        c!.fill();
        // the little "r" itself, turning gently as it floats away
        p.rot += p.spin * dt;
        c!.save();
        c!.translate(p.x, p.y);
        c!.rotate(p.rot);
        c!.font = `italic 600 ${Math.round(r * 7)}px 'Playfair Display', Georgia, serif`;
        c!.textAlign = 'center';
        c!.textBaseline = 'middle';
        c!.fillStyle = p.gold ? `rgba(255,236,196,${0.95 * a})` : `rgba(236,224,255,${0.95 * a})`;
        c!.fillText('r', 0, 0);
        c!.restore();
        if (p.star) {
          // a tiny four-point twinkle
          const s = r * 3.2;
          c!.fillStyle = `rgba(255,248,230,${0.85 * a})`;
          c!.beginPath();
          c!.moveTo(p.x, p.y - s);
          c!.lineTo(p.x + s * 0.18, p.y);
          c!.lineTo(p.x, p.y + s);
          c!.lineTo(p.x - s * 0.18, p.y);
          c!.closePath();
          c!.moveTo(p.x - s, p.y);
          c!.lineTo(p.x, p.y + s * 0.18);
          c!.lineTo(p.x + s, p.y);
          c!.lineTo(p.x, p.y - s * 0.18);
          c!.closePath();
          c!.fill();
        }
      }
      c!.globalCompositeOperation = 'source-over';
      raf = parts.length ? requestAnimationFrame(frame) : 0;
      if (!raf) c!.clearRect(0, 0, canvas.width, canvas.height);
    }

    window.addEventListener('pointermove', move, { passive: true });
    window.addEventListener('pointerdown', down, { passive: true });
    window.addEventListener('pointerup', up, { passive: true });
    window.addEventListener('pointercancel', up, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerdown', down);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
    };
  }, []);

  return <canvas ref={ref} className="stardust" aria-hidden="true" />;
}
