/** Shared GLSL: 3D value noise, fbm and a cellular (crater) function. */
export const NOISE_GLSL = /* glsl */ `
  float h31(vec3 p) {
    p = fract(p * 0.3183099 + vec3(0.71, 0.113, 0.419));
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }
  float vnoise(vec3 x) {
    vec3 i = floor(x);
    vec3 f = fract(x);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(mix(h31(i + vec3(0, 0, 0)), h31(i + vec3(1, 0, 0)), f.x), mix(h31(i + vec3(0, 1, 0)), h31(i + vec3(1, 1, 0)), f.x), f.y),
      mix(mix(h31(i + vec3(0, 0, 1)), h31(i + vec3(1, 0, 1)), f.x), mix(h31(i + vec3(0, 1, 1)), h31(i + vec3(1, 1, 1)), f.x), f.y),
      f.z);
  }
  float fbm3(vec3 p, int oct) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 7; i++) {
      if (i >= oct) break;
      v += a * vnoise(p);
      p = p * 2.03 + vec3(1.7, 9.2, 3.1);
      a *= 0.5;
    }
    return v;
  }
  // distance to the nearest random point in a 3D cell grid (for craters)
  vec2 cell3(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    float d1 = 8.0;
    float rr = 0.0;
    for (int z = -1; z <= 1; z++)
      for (int y = -1; y <= 1; y++)
        for (int x = -1; x <= 1; x++) {
          vec3 g = vec3(float(x), float(y), float(z));
          vec3 o = vec3(h31(i + g), h31(i + g + 13.1), h31(i + g + 27.7));
          vec3 r = g + o - f;
          float d = dot(r, r);
          if (d < d1) { d1 = d; rr = h31(i + g + 41.3); }
        }
    return vec2(sqrt(d1), rr);
  }
`;
