import * as THREE from 'three';
import { BLOCK, LAMP_SPACING, ROAD } from './cityLayout';

/**
 * Shaders for the night city. Everything is drawn from world position, so a few draw calls
 * cover thousands of buildings, every street, every lamp. Far away, the detail is averaged
 * (not aliased), so windows and lamps melt into a soft glow, like a real city at night.
 */

/** Haze over the city: warm-violet near the ground (the city's own light), darker higher up. */
const FOG = /* glsl */ `
  uniform float uFogD;
  vec3 cityFog(vec3 col, vec3 wpos) {
    float d = distance(cameraPosition, wpos);
    float f = 1.0 - exp(-pow(d * uFogD, 1.3));
    float hy = max(wpos.y, 0.0) * 0.6 + cameraPosition.y * 0.4;
    vec3 fc = mix(vec3(0.17, 0.095, 0.15), vec3(0.06, 0.05, 0.11), smoothstep(0.0, 420.0, hy));
    return mix(col, fc, f);
  }
`;

const HASH = /* glsl */ `
  float h21(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }
`;

export const FOG_D = 1 / 1500;

/* ------------------------------------------------------------------ buildings */

export function makeFacadeMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {
      uFogD: { value: FOG_D },
      uMoon: { value: new THREE.Vector3(-0.35, 0.62, -0.7).normalize() },
      uWin: { value: 2.1 },
    },
    vertexShader: /* glsl */ `
      attribute float aSeed;
      attribute float aKind;
      attribute vec3 aAccent;
      varying vec3 vW;
      varying vec3 vN;
      varying vec3 vL;
      varying vec3 vSize;
      varying float vSeed;
      varying float vKind;
      varying vec3 vAccent;
      void main() {
        vec4 w = modelMatrix * instanceMatrix * vec4(position, 1.0);
        vW = w.xyz;
        vN = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * normal);
        vSize = vec3(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz), length(instanceMatrix[2].xyz));
        vL = position * vSize;
        vSeed = aSeed;
        vKind = aKind;
        vAccent = aAccent;
        gl_Position = projectionMatrix * viewMatrix * w;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uMoon;
      uniform float uWin;
      varying vec3 vW;
      varying vec3 vN;
      varying vec3 vL;
      varying vec3 vSize;
      varying float vSeed;
      varying float vKind;
      varying vec3 vAccent;
      ${HASH}
      ${FOG}
      float boxMask(vec2 f, vec2 c, vec2 hs, vec2 aa) {
        vec2 d = abs(f - c) - hs;
        vec2 m = 1.0 - smoothstep(-aa, aa, d);
        return m.x * m.y;
      }
      vec3 litColor(float k) {
        if (k < 0.52) return vec3(1.0, 0.70, 0.40);
        if (k < 0.78) return vec3(1.0, 0.88, 0.70);
        if (k < 0.95) return vec3(0.62, 0.78, 1.0);
        return vec3(0.86, 0.64, 1.0);
      }
      void main() {
        vec3 N = normalize(vN);
        vec3 V = normalize(cameraPosition - vW);
        float y = vL.y;
        bool res = (vKind > 0.5 && vKind < 1.5) || vKind > 2.5;
        vec3 col;
        if (N.y > 0.5) {
          // the roof: dark, with a little texture
          col = vec3(0.03, 0.028, 0.036) * (0.8 + 0.4 * h21(floor(vW.xz * 0.5)));
        } else if (N.y < -0.5) {
          col = vec3(0.01);
        } else {
          bool sideX = abs(N.x) > 0.5;
          float W = sideX ? vSize.z : vSize.x;
          float u = (sideX ? vL.z : vL.x) + W * 0.5;
          float face = sideX ? (N.x > 0.0 ? 1.0 : 2.0) : (N.z > 0.0 ? 3.0 : 4.0);
          float cw = res ? 3.0 : 1.7;
          float fh = res ? 3.1 : 3.7;
          vec2 cell = vec2(floor(u / cw), floor(y / fh));
          vec2 f = vec2(fract(u / cw), fract(y / fh));
          vec2 fw = fwidth(vec2(u / cw, y / fh));
          vec2 aa = max(fw, vec2(0.002));
          float win = res ? boxMask(f, vec2(0.5, 0.52), vec2(0.25, 0.24), aa) : boxMask(f, vec2(0.5, 0.5), vec2(0.45, 0.37), aa);
          // no windows on the corner columns or the ground floor
          win *= smoothstep(0.5, 0.8, u) * smoothstep(0.5, 0.8, W - u);
          float ground = 1.0 - step(4.4, y);
          win *= 1.0 - ground;
          win *= 1.0 - smoothstep(vSize.y - 1.6, vSize.y - 1.2, y);

          float seed = vSeed + face * 17.0;
          float litFrac = res ? 0.22 + 0.34 * h21(vec2(vSeed, 1.7)) : 0.18 + 0.4 * h21(vec2(vSeed, 3.1));
          // offices are lit floor by floor; homes window by window
          float floorOn = res ? 1.0 : step(h21(vec2(cell.y, seed)), 0.62);
          float lit = step(h21(cell + seed), litFrac * (res ? 1.0 : 1.4)) * floorOn;
          float k = h21(cell + seed + 9.1);
          float inten = (0.55 + 0.7 * h21(cell + seed + 3.3)) * uWin;
          vec3 room = litColor(k) * inten * (0.72 + 0.28 * f.y);
          if (res) {
            // curtains half drawn, and a window frame
            float cx = (f.x - 0.25) / 0.5;
            float curtain = step(h21(cell + 1.3), 0.5) * (1.0 - smoothstep(0.28, 0.32, abs(cx - 0.5) - 0.18 + 0.2 * h21(cell + 2.1)));
            room *= 0.55 + 0.45 * (1.0 - curtain * 0.6);
            float mull = 1.0 - (1.0 - smoothstep(0.004, 0.012, abs(f.x - 0.5))) * (1.0 - smoothstep(0.4, 0.9, fw.x * 30.0));
            room *= mull;
          }
          float fres = pow(1.0 - max(dot(N, V), 0.0), 3.0);
          vec3 glass = vec3(0.016, 0.02, 0.034) + vec3(0.11, 0.07, 0.15) * fres;
          vec3 wall = res ? vec3(0.05, 0.044, 0.05) : vec3(0.026, 0.03, 0.045);
          wall *= 0.82 + 0.3 * h21(floor(vec2(u * 1.5, y * 1.5)) + seed);
          // the slab edge of each floor
          float slab = (1.0 - smoothstep(0.0, 0.035, abs(f.y - 0.02))) * (1.0 - smoothstep(0.3, 0.9, fw.y * 20.0));
          wall *= 1.0 + slab * 0.6;
          // light from the street below, and a little moonlight
          wall += vec3(0.32, 0.17, 0.08) * exp(-y / 12.0) * 0.32;
          wall += vec3(0.16, 0.18, 0.3) * max(dot(N, uMoon), 0.0) * 0.12;
          vec3 detail = mix(wall, mix(glass, room, lit), win);

          // shop fronts along the street
          if (y < 4.4 && vKind < 2.5) {
            float sc = floor(u / 6.0);
            float shop = step(h21(vec2(sc, seed + 5.0)), 0.55);
            float band = smoothstep(0.35, 0.5, y) * (1.0 - smoothstep(3.1, 3.3, y));
            float sign_ = smoothstep(3.45, 3.55, y) * (1.0 - smoothstep(4.0, 4.1, y)) * step(h21(vec2(sc, seed + 8.0)), 0.4);
            vec3 shopCol = mix(vec3(1.0, 0.78, 0.5), vec3(0.95, 0.95, 1.0), step(0.6, h21(vec2(sc, seed + 2.0)))) * 1.5;
            float edge = smoothstep(0.2, 0.6, fract(u / 6.0)) * (1.0 - smoothstep(5.4 / 6.0, 5.8 / 6.0, fract(u / 6.0)));
            detail = mix(detail, shopCol, shop * band * edge * 0.9);
            vec3 signCol = vec3(1.0, 0.45, 0.7);
            if (h21(vec2(sc, seed + 4.0)) < 0.5) signCol = vec3(0.4, 0.75, 1.0);
            detail = mix(detail, signCol * 2.2, sign_ * edge);
          }

          // towers wear coloured light on their crowns and corners
          if (vKind > 1.5 && vKind < 2.5) {
            float crown = smoothstep(vSize.y - 2.6, vSize.y - 2.3, y) * (1.0 - smoothstep(vSize.y - 1.5, vSize.y - 1.2, y));
            float corner = (1.0 - smoothstep(0.18, 0.4, u)) + (1.0 - smoothstep(0.18, 0.4, W - u));
            detail += vAccent * (crown * 3.2 + corner * 1.4 * smoothstep(0.3, 1.0, y / vSize.y));
          }

          // far away: the average glow instead of shimmering detail
          float fp = max(fwidth(u), fwidth(y));
          float far = smoothstep(cw * 0.3, cw * 1.1, fp);
          float area = res ? 0.25 : 0.6;
          vec3 avgRoom = vec3(1.0, 0.78, 0.55) * uWin * 0.9 * 0.86;
          vec3 avg = mix(wall, avgRoom * litFrac * (res ? 1.0 : 0.9) + glass * (1.0 - litFrac), area);
          if (vKind > 1.5 && vKind < 2.5) avg += vAccent * 0.1;
          col = mix(detail, avg, far);
        }
        gl_FragColor = vec4(cityFog(col, vW), 1.0);
      }
    `,
  });
}

/* ------------------------------------------------------------------ streets */

export function makeGroundMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { uFogD: { value: FOG_D }, uTime: { value: 0 } },
    vertexShader: /* glsl */ `
      varying vec3 vW;
      void main() {
        vec4 w = modelMatrix * vec4(position, 1.0);
        vW = w.xyz;
        gl_Position = projectionMatrix * viewMatrix * w;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      varying vec3 vW;
      ${HASH}
      ${FOG}
      const float B = ${BLOCK.toFixed(1)};
      const float SP = ${LAMP_SPACING.toFixed(1)};
      const float LAMP = ${ROAD.lamp.toFixed(2)};
      const float CAR = ${ROAD.carriage.toFixed(2)};
      const float WALK = ${ROAD.block.toFixed(2)};
      vec3 lampCol(float id) {
        return h21(vec2(id, 7.0)) < 0.78 ? vec3(1.0, 0.56, 0.24) : vec3(0.85, 0.88, 1.0);
      }
      // the lamps and traffic along the roads that run in one direction
      vec3 roads(float across, float along, float fp, float dirSeed) {
        float s = mod(across, B) - B * 0.5;
        float road = floor(across / B);
        float side = s >= 0.0 ? 1.0 : -1.0;
        float dx = s - side * LAMP;
        float sig = 5.2;
        float sig2 = sig * sig + fp * fp;
        float ax = exp(-dx * dx / sig2) * sig / sqrt(sig2);
        float a = mod(along, SP) - SP * 0.5;
        float lampId = floor(along / SP) + road * 31.0 + side * 7.0 + dirSeed;
        float ay = mix(exp(-a * a / (sig * sig)), sig * 1.772 / SP, smoothstep(3.0, 12.0, fp));
        vec3 col = lampCol(mix(lampId, road + dirSeed, smoothstep(3.0, 12.0, fp))) * ax * ay * 0.55;
        // traffic: long-exposure streaks of headlights and taillights
        float lane = abs(s);
        float inLane = smoothstep(0.6, 1.4, lane) * (1.0 - smoothstep(3.6, 4.4, lane));
        float dir = side;
        float spd = 11.0 + 6.0 * h21(vec2(road, dirSeed + side));
        float m = along + dir * uTime * spd + h21(vec2(road, side + dirSeed)) * 400.0;
        float L = 34.0;
        float seg = floor(m / L);
        float car = step(h21(vec2(seg, road + side * 3.0 + dirSeed)), 0.55);
        float fm = fract(m / L);
        float streak = smoothstep(0.0, 0.05, fm) * (1.0 - smoothstep(0.28, 0.36, fm)) * car;
        streak = mix(streak, 0.17, smoothstep(2.0, 10.0, fp));
        vec3 light = side > 0.0 ? vec3(1.0, 0.92, 0.8) * 0.9 : vec3(1.0, 0.16, 0.1) * 0.75;
        col += light * streak * inLane;
        return col;
      }
      void main() {
        float fp = max(fwidth(vW.x), fwidth(vW.z));
        float dX = abs(mod(vW.x, B) - B * 0.5);
        float dZ = abs(mod(vW.z, B) - B * 0.5);
        float d = min(dX, dZ);
        vec3 col = vec3(0.028, 0.026, 0.03);
        float side = smoothstep(CAR - 0.05, CAR + 0.05, d) * (1.0 - smoothstep(WALK - 0.05, WALK + 0.05, d));
        float asphalt = 1.0 - smoothstep(CAR - 0.05, CAR + 0.05, d);
        col = mix(col, vec3(0.05, 0.046, 0.05), side);
        col = mix(col, vec3(0.016, 0.016, 0.02), asphalt);
        // lane markings, near only
        float mark = (1.0 - smoothstep(0.06, 0.12, min(dX, dZ))) * step(0.5, fract((dX < dZ ? vW.z : vW.x) / 6.0)) * (1.0 - smoothstep(0.4, 1.0, fp));
        col += vec3(0.12, 0.11, 0.09) * mark * asphalt;
        vec3 glow = vec3(0.0);
        if (dX < 14.0 + fp * 2.0) glow += roads(vW.x, vW.z, fp, 0.0);
        if (dZ < 14.0 + fp * 2.0) glow += roads(vW.z, vW.x, fp, 50.0);
        col += glow;
        gl_FragColor = vec4(cityFog(col, vW), 1.0);
      }
    `,
  });
}

/* ------------------------------------------------------------------ the night sky over the city */

export function makeCitySkyMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {
      uMoon: { value: new THREE.Vector3(-0.35, 0.62, -0.7).normalize() },
      uTime: { value: 0 },
    },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize((modelMatrix * vec4(position, 1.0)).xyz - cameraPosition);
        vec4 p = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.0);
        gl_Position = p.xyww;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uMoon;
      uniform float uTime;
      varying vec3 vDir;
      ${HASH}
      float vn(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(mix(h21(i), h21(i + vec2(1, 0)), f.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), f.x), f.y);
      }
      void main() {
        vec3 d = normalize(vDir);
        float e = d.y;
        // the city's glow on the horizon, deep violet-blue overhead
        vec3 horizon = vec3(0.30, 0.15, 0.21);
        vec3 mid = vec3(0.09, 0.06, 0.16);
        vec3 zenith = vec3(0.016, 0.018, 0.05);
        vec3 col = mix(horizon, mid, smoothstep(0.0, 0.16, e));
        col = mix(col, zenith, smoothstep(0.12, 0.65, e));
        col = mix(col, vec3(0.12, 0.07, 0.11), smoothstep(0.0, -0.08, e));
        // thin high clouds, lit faintly from below
        vec2 cp = d.xz / max(e + 0.08, 0.05) * 1.6 + vec2(uTime * 0.01, 0.0);
        float c = vn(cp) * 0.6 + vn(cp * 2.3) * 0.4;
        c = smoothstep(0.55, 0.85, c) * smoothstep(0.02, 0.2, e) * (1.0 - smoothstep(0.5, 0.9, e));
        col += vec3(0.16, 0.1, 0.16) * c * 0.5;
        // the moon
        float md = dot(d, uMoon);
        float disc = smoothstep(0.99978, 0.99984, md);
        float mott = vn(d.xy * 900.0) * 0.5 + vn(d.yz * 2200.0) * 0.5;
        col = mix(col, vec3(1.0, 0.96, 0.9) * (1.5 - 0.4 * mott), disc);
        col += vec3(0.5, 0.45, 0.6) * (pow(max(md, 0.0), 900.0) * 0.5 + pow(max(md, 0.0), 40.0) * 0.06) * (1.0 - disc);
        gl_FragColor = vec4(col, 1.0);
      }
    `,
    side: THREE.BackSide,
    depthWrite: false,
  });
}

/* ------------------------------------------------------------------ glowing points (lamps, stars, aviation lights) */

export function makeGlowPointsMaterial({ size, min = 1.2, blink = false }: { size: number; min?: number; blink?: boolean }) {
  return new THREE.ShaderMaterial({
    uniforms: { uScale: { value: 800 }, uSize: { value: size }, uMin: { value: min }, uTime: { value: 0 }, uFogD: { value: FOG_D } },
    vertexShader: /* glsl */ `
      attribute vec3 aColor;
      uniform float uScale;
      uniform float uSize;
      uniform float uMin;
      uniform float uTime;
      uniform float uFogD;
      varying vec3 vColor;
      varying float vFade;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        float px = uScale * uSize / max(-mv.z, 0.1);
        float d = -mv.z;
        float b = 1.0;
        ${blink ? 'b = step(0.55, fract(uTime * 0.7 + position.x * 0.013 + position.z * 0.007));' : ''}
        vFade = b * exp(-pow(d * uFogD * 0.8, 1.3));
        vColor = aColor;
        gl_PointSize = clamp(px, uMin, 90.0);
        // keep tiny points from vanishing: dim them instead of shrinking
        vFade *= min(1.0, px / uMin);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec3 vColor;
      varying float vFade;
      void main() {
        vec2 c = gl_PointCoord - 0.5;
        float r = length(c) * 2.0;
        float a = exp(-r * r * 5.0) + 0.35 * exp(-r * r * 40.0);
        gl_FragColor = vec4(vColor * a * vFade, 1.0);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
}

/* ------------------------------------------------------------------ clouds (instanced soft billboards) */

/** A soft cloud puff, painted once: lit warmly from the city below, cooler on top. */
export function makeCloudTexture() {
  const S = 256;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d')!;
  let s = 11;
  const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 46; i++) {
    const a = r() * Math.PI * 2;
    const d = Math.pow(r(), 0.7) * S * 0.28;
    const x = S / 2 + Math.cos(a) * d * 1.25;
    const y = S / 2 + Math.sin(a) * d * 0.7;
    const rad = S * (0.08 + r() * 0.14);
    const grd = g.createRadialGradient(x, y, 0, x, y, rad);
    // lower puffs carry the city's warm light, upper ones are cooler
    const warm = y > S / 2 ? 1 : 0;
    const col = warm ? '238,214,226' : '200,198,232';
    grd.addColorStop(0, `rgba(${col},0.32)`);
    grd.addColorStop(0.6, `rgba(${col},0.12)`);
    grd.addColorStop(1, `rgba(${col},0)`);
    g.fillStyle = grd;
    g.fillRect(0, 0, S, S);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function makeCloudMaterial(map: THREE.Texture) {
  return new THREE.ShaderMaterial({
    uniforms: { uMap: { value: map }, uTime: { value: 0 }, uOpacity: { value: 1 }, uFogD: { value: FOG_D } },
    vertexShader: /* glsl */ `
      attribute vec3 aCenter;
      attribute vec3 aInfo; // size, rotation, brightness
      uniform float uTime;
      varying vec2 vUv;
      varying float vBright;
      varying float vFade;
      void main() {
        vec3 c = aCenter + vec3(uTime * 2.2, 0.0, uTime * 0.6);
        vec4 mv = modelViewMatrix * vec4(c, 1.0);
        float cs = cos(aInfo.y);
        float sn = sin(aInfo.y);
        vec2 p = vec2(position.x * cs - position.y * sn, position.x * sn + position.y * cs) * aInfo.x;
        mv.xy += p;
        float d = -mv.z;
        // fade out as the camera flies into a puff (no flat edges), and far away into the haze
        vFade = smoothstep(aInfo.x * 0.05, aInfo.x * 0.55, d) * exp(-pow(d / 2600.0, 2.0));
        vBright = aInfo.z;
        vUv = uv;
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D uMap;
      uniform float uOpacity;
      varying vec2 vUv;
      varying float vBright;
      varying float vFade;
      void main() {
        vec4 t = texture2D(uMap, vUv);
        float a = t.a * vFade * uOpacity;
        gl_FragColor = vec4(t.rgb * vBright * 0.36, a);
      }
    `,
    transparent: true,
    depthWrite: false,
  });
}
