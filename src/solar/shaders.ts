import * as THREE from 'three';

/** Fresnel rim on the planet's surface, brighter on the sun-lit side. */
export function makeAtmosphereRim(color: string, intensity: number) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(color) },
      uIntensity: { value: intensity },
      uSun: { value: new THREE.Vector3(0, 0, 0) },
    },
    vertexShader: /* glsl */ `
      varying vec3 vWorldPos;
      varying vec3 vWorldNormal;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorldPos = wp.xyz;
        vWorldNormal = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform float uIntensity;
      uniform vec3 uSun;
      varying vec3 vWorldPos;
      varying vec3 vWorldNormal;
      void main() {
        vec3 viewDir = normalize(cameraPosition - vWorldPos);
        float fres = pow(1.0 - clamp(dot(viewDir, vWorldNormal), 0.0, 1.0), 3.0);
        float lit = clamp(dot(vWorldNormal, normalize(uSun - vWorldPos)) * 0.75 + 0.35, 0.06, 1.0);
        gl_FragColor = vec4(uColor * 1.15, fres * uIntensity * lit);
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
}

/** Soft halo just outside the planet (rendered on back faces). */
export function makeAtmosphereHalo(color: string, intensity: number) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(color) },
      uIntensity: { value: intensity },
      uSun: { value: new THREE.Vector3(0, 0, 0) },
    },
    vertexShader: /* glsl */ `
      varying vec3 vViewNormal;
      varying vec3 vWorldPos;
      varying vec3 vWorldNormal;
      void main() {
        vViewNormal = normalize(normalMatrix * normal);
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorldPos = wp.xyz;
        vWorldNormal = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform float uIntensity;
      uniform vec3 uSun;
      varying vec3 vViewNormal;
      varying vec3 vWorldPos;
      varying vec3 vWorldNormal;
      void main() {
        float d = clamp(-vViewNormal.z, 0.0, 1.0);
        float glow = pow(d, 2.2);
        float lit = clamp(dot(-vWorldNormal, normalize(uSun - vWorldPos)) * 0.6 + 0.45, 0.08, 1.0);
        gl_FragColor = vec4(uColor, glow * uIntensity * lit * 0.55);
      }
    `,
    side: THREE.BackSide,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
}

/**
 * Dreamy deep-lavender galaxy: navy-purple space, a glowing band of violet
 * and rich-lavender nebula with pink and cream wisps, and dark dust lanes.
 */
export function makeNebulaMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uDeep: { value: 0 },
      uSpace: { value: 0 },
      uBand: { value: 0 },
      uGalN: { value: new THREE.Vector3(0, 1, 0) },
      uGalC: { value: new THREE.Vector3(0, 0, -1) },
    },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform float uDeep;
      uniform float uSpace;
      uniform float uBand;
      uniform vec3 uGalN;
      uniform vec3 uGalC;
      varying vec3 vDir;
      float hash(vec3 p) {
        p = fract(p * 0.3183099 + 0.1);
        p *= 17.0;
        return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
      }
      float noise(vec3 x) {
        vec3 i = floor(x);
        vec3 f = fract(x);
        f = f * f * (3.0 - 2.0 * f);
        return mix(mix(mix(hash(i + vec3(0,0,0)), hash(i + vec3(1,0,0)), f.x),
                       mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
                   mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x),
                       mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z);
      }
      float fbm(vec3 p) {
        float s = 0.0;
        float a = 0.5;
        for (int i = 0; i < 5; i++) { s += a * noise(p); p *= 2.02; a *= 0.5; }
        return s;
      }
      void main() {
        vec3 d = normalize(vDir);
        vec3 deep   = vec3(0.063, 0.043, 0.125); // #100B20 deep space
        vec3 navy   = vec3(0.075, 0.071, 0.180); // deep navy-purple
        vec3 dark   = vec3(0.129, 0.082, 0.212); // #211536 dark lavender
        vec3 violet = vec3(0.224, 0.141, 0.329); // #392454 violet
        vec3 rich   = vec3(0.447, 0.325, 0.608); // #72539B rich lavender
        vec3 lilac  = vec3(0.655, 0.545, 0.808); // #A78BCE soft lilac
        vec3 pink   = vec3(0.945, 0.851, 0.933); // #F1D9EE pastel pink
        vec3 cream  = vec3(1.0, 0.941, 0.788);   // #FFF0C9 warm cream

        vec3 blue   = vec3(0.17, 0.20, 0.42);    // soft navy-blue nebula
        float t = uTime * 0.006;
        float h = d.y;
        // Base: deep navy-purple, a touch lighter near the horizon.
        vec3 col = mix(dark * 0.85, deep, smoothstep(0.0, 0.7, abs(h - 0.06)));

        float n1 = fbm(d * 2.0 + vec3(t, 0.0, -t));
        float n2 = fbm(d * 4.3 + vec3(5.2, 1.3 + t, 2.7));
        float n3 = fbm(d * 6.5 + 9.0);
        float n4 = fbm(d * 2.6 + vec3(13.0, -4.0, 7.0));
        // A tilted galactic band of nebula clouds.
        float band = exp(-pow((h - d.x * 0.22 - 0.05) * 2.4 + (n2 - 0.5) * 1.4, 2.0));
        float cloud = smoothstep(0.42, 0.82, n1);
        col = mix(col, violet, cloud * (0.35 + band * 0.55));
        col = mix(col, rich, smoothstep(0.55, 0.88, n1) * band * 0.7);
        col = mix(col, lilac, smoothstep(0.68, 0.95, n1 * (0.6 + n2 * 0.8)) * band * 0.45);
        col += pink * smoothstep(0.62, 0.95, n2) * band * smoothstep(0.5, 0.8, n1) * 0.18;
        col += cream * pow(smoothstep(0.72, 1.0, n1), 2.0) * band * 0.1;
        // Navy-blue nebula clouds drifting off the band (like distant galaxies).
        float bl = smoothstep(0.5, 0.85, n4) * (1.0 - band * 0.6);
        col = mix(col, blue, bl * 0.75);
        col += vec3(0.35, 0.42, 0.8) * pow(smoothstep(0.66, 0.95, n4), 2.0) * 0.18;
        // Dark dust lanes and empty pockets give it depth.
        col *= 1.0 - smoothstep(0.5, 0.8, n3) * band * 0.45;
        col *= mix(0.65, 1.0, smoothstep(0.25, 0.55, n1 + n4 * 0.4));

        // During a journey the sky sinks a little deeper so flybys stand out.
        col = mix(col, col * vec3(0.72, 0.7, 0.85), uDeep * 0.6);
        // The cinematic: near-black deep space with only a whisper of navy-violet.
        col = mix(col, vec3(0.012, 0.011, 0.024) + col * 0.06, uSpace);
        // The Milky Way seen from inside its disc: a glowing band along the galactic
        // plane, widest and warmest towards the centre, split by a dark dust rift.
        if (uBand > 0.001) {
          float sb = clamp(dot(d, uGalN), -1.0, 1.0);
          float b = asin(sb);
          vec3 inPlane = normalize(d - uGalN * sb + 1e-5);
          float l = acos(clamp(dot(inPlane, uGalC), -1.0, 1.0));
          float centre = exp(-l * l / 0.8);
          float w = 0.06 + 0.12 * centre;
          float band = exp(-(b * b) / (w * w));
          float m1 = fbm(d * 7.0 + 3.0);
          float m2 = fbm(d * 18.0 + 11.0);
          vec3 bandCol = mix(vec3(0.62, 0.66, 0.9), vec3(1.0, 0.8, 0.55), centre);
          float glow = band * (0.07 + 0.42 * centre) * (0.45 + 0.8 * m1);
          float riftW = 0.018 + 0.03 * centre;
          float rift = exp(-pow((b - 0.015 * sin(l * 3.0) * (1.0 - centre)) / riftW, 2.0)) * smoothstep(0.3, 0.62, m2) * (0.45 + 0.55 * centre);
          glow *= 1.0 - rift * 0.9;
          vec3 add = bandCol * glow;
          add += vec3(1.0, 0.35, 0.5) * smoothstep(0.66, 0.84, m2) * band * (1.0 - rift) * 0.07;
          col += add * uBand;
        }
        gl_FragColor = vec4(col, 1.0);
      }
    `,
    side: THREE.BackSide,
    depthWrite: false,
  });
}

/**
 * Twinkling, tinted points (stars, sparkles). Needs aColor, aSize and aPhase
 * attributes. `attenuate` > 0 makes points shrink with distance.
 */
export function makeTwinkleMaterial({ size, opacity, attenuate = 0 }: { size: number; opacity: number; attenuate?: number }) {
  return new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uSize: { value: size }, uOpacity: { value: opacity }, uAtten: { value: attenuate } },
    vertexShader: /* glsl */ `
      attribute vec3 aColor;
      attribute float aSize;
      attribute float aPhase;
      uniform float uTime;
      uniform float uSize;
      uniform float uAtten;
      varying vec3 vColor;
      varying float vTw;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        float tw = 0.5 + 0.5 * sin(uTime * (0.7 + fract(aPhase * 7.31) * 2.2) + aPhase * 6.2832);
        vTw = 0.35 + 0.65 * tw;
        vColor = aColor;
        float s = uSize * aSize * (0.75 + 0.4 * tw);
        if (uAtten > 0.0) s *= clamp(uAtten / -mv.z, 0.25, 2.5);
        gl_PointSize = s;
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uOpacity;
      varying vec3 vColor;
      varying float vTw;
      void main() {
        vec2 p = gl_PointCoord - 0.5;
        float d = length(p);
        float core = smoothstep(0.5, 0.0, d);
        core *= core;
        // A faint four-point glint on the brighter ones.
        float glint = max(smoothstep(0.06, 0.0, abs(p.x)), smoothstep(0.06, 0.0, abs(p.y))) * smoothstep(0.5, 0.1, d) * 0.5;
        float a = (core + glint * vTw) * vTw * uOpacity;
        if (a < 0.01) discard;
        gl_FragColor = vec4(vColor, a);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
}

const NOISE_GLSL = /* glsl */ `
  float h3(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
  float n3(vec3 x) {
    vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(h3(i), h3(i + vec3(1,0,0)), f.x), mix(h3(i + vec3(0,1,0)), h3(i + vec3(1,1,0)), f.x), f.y),
               mix(mix(h3(i + vec3(0,0,1)), h3(i + vec3(1,0,1)), f.x), mix(h3(i + vec3(0,1,1)), h3(i + vec3(1,1,1)), f.x), f.y), f.z);
  }
  float fbm3(vec3 p) { float s = 0.0, a = 0.5; for (int i = 0; i < 4; i++) { s += a * n3(p); p *= 2.03; a *= 0.5; } return s; }
  // Cellular (Worley) noise: distance to the nearest feature point -> convection cells.
  float cells(vec3 p) {
    vec3 i = floor(p); vec3 f = fract(p); float d = 1.0;
    for (int x = -1; x <= 1; x++) for (int y = -1; y <= 1; y++) for (int z = -1; z <= 1; z++) {
      vec3 g = vec3(float(x), float(y), float(z));
      vec3 o = vec3(h3(i + g), h3(i + g + 17.0), h3(i + g + 41.0));
      vec3 r = g + o - f; d = min(d, dot(r, r));
    }
    return sqrt(d);
  }
`;

/**
 * The Sun's photosphere: the photographic map, animated granulation
 * (bright convection cells with darker lanes), slow large-scale flow and
 * limb darkening (the disc is dimmer and redder towards its edge).
 */
export function makeSunSurface(map: THREE.Texture, detailed: boolean) {
  return new THREE.ShaderMaterial({
    uniforms: { uMap: { value: map }, uTime: { value: 0 } },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      varying vec3 vObj;
      varying vec3 vN;
      varying vec3 vView;
      void main() {
        vUv = uv;
        vObj = normalize(position);
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vN = normalize(mat3(modelMatrix) * normal);
        vView = normalize(cameraPosition - wp.xyz);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D uMap;
      uniform float uTime;
      varying vec2 vUv;
      varying vec3 vObj;
      varying vec3 vN;
      varying vec3 vView;
      ${NOISE_GLSL}
      void main() {
        float t = uTime;
        vec3 p = vObj;
        // Slow, swirling large-scale flow distorts the map a little.
        vec2 flow = vec2(fbm3(p * 2.0 + t * 0.02), fbm3(p * 2.0 + 7.0 - t * 0.02)) - 0.5;
        vec3 base = texture2D(uMap, vUv + flow * 0.012).rgb;
        ${detailed ? `
        float c = cells(p * 22.0 + vec3(0.0, t * 0.05, 0.0));
        float c2 = cells(p * 46.0 - vec3(t * 0.04));
        float gran = smoothstep(0.05, 0.75, c) * 0.65 + smoothstep(0.1, 0.8, c2) * 0.35;
        ` : `float gran = fbm3(p * 30.0 + t * 0.05);`}
        float g = 1.0 - gran * 0.32;
        // Darker, cooler patches drifting slowly (sunspot-like regions).
        float spots = smoothstep(0.66, 0.78, fbm3(p * 3.2 + vec3(t * 0.004, 0.0, 0.0)));
        // The map is deep orange; lift it towards the golden white of the real photosphere.
        vec3 col = mix(base, vec3(1.0, 0.86, 0.55), 0.45) * vec3(1.45, 1.28, 1.0) * g;
        col = mix(col, col * vec3(0.55, 0.32, 0.18), spots * 0.75);
        // Limb darkening.
        float mu = clamp(dot(normalize(vN), normalize(vView)), 0.0, 1.0);
        col *= mix(vec3(0.62, 0.4, 0.2), vec3(1.0), pow(mu, 0.45));
        gl_FragColor = vec4(col * 1.35, 1.0);
      }
    `,
  });
}

/**
 * The corona and limb, drawn on a camera-facing quad behind the Sun:
 * a soft glow with radial streamers, magenta-red prominences arcing above
 * the limb (as seen in hydrogen-alpha light), and an occasional flare that
 * brightens a spot on the limb and fades. The shimmer is the corona's
 * slowly changing structure.
 */
export function makeCorona() {
  return new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uScale: { value: 4.0 } },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform float uScale;
      varying vec2 vUv;
      ${NOISE_GLSL}
      void main() {
        vec2 q = (vUv - 0.5) * 2.0 * uScale; // in solar radii
        float r = length(q);
        float a = atan(q.y, q.x);
        vec2 ang = vec2(cos(a), sin(a));
        float t = uTime;
        // Corona: falls off with distance, broken into streamers.
        float streak = fbm3(vec3(ang * 3.0, t * 0.03)) * 0.8 + fbm3(vec3(ang * 9.0, t * 0.05)) * 0.4;
        float corona = pow(max(0.0, 1.0 / max(r, 1.0)), 3.2) * (0.55 + streak * 0.9);
        vec3 col = vec3(1.0, 0.78, 0.48) * corona * 1.4;
        // Prominences: flame-like loops just above the limb.
        float lift = r - 1.0;
        float flame = fbm3(vec3(ang * 5.5, lift * 5.0 - t * 0.12));
        float loops = smoothstep(0.58, 0.78, flame) * smoothstep(0.32, 0.02, lift) * smoothstep(-0.01, 0.02, lift);
        col += vec3(1.0, 0.38, 0.48) * loops * 1.6;
        // Flares: every ~11 s a random spot on the limb flashes and fades.
        float cyc = floor(t / 11.0);
        float ph = fract(t / 11.0);
        float fa = h3(vec3(cyc, 3.1, 7.7)) * 6.2832;
        float near = max(0.0, cos(a - fa));
        float pulse = smoothstep(0.0, 0.04, ph) * (1.0 - smoothstep(0.04, 0.35, ph));
        col += vec3(1.0, 0.95, 0.85) * pow(near, 40.0) * smoothstep(0.35, 0.0, abs(lift - 0.05)) * pulse * 2.2;
        float alpha = clamp(max(max(col.r, col.g), col.b), 0.0, 1.0);
        gl_FragColor = vec4(col, alpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
}
