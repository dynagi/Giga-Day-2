import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { Billboard, Html } from '@react-three/drei';
import { DWARFS } from '../data/moons';
import { PLANETS, SUN_RADIUS } from '../data/planets';
import { useCosmic } from '../state/store';
import { runtime } from '../state/runtime';
import { getSoftDot } from './journey/journeyTextures';
import { makeCorona, makeNebulaMaterial, makeSunSurface, makeTwinkleMaterial } from './shaders';

const STAR_TINTS = ['#ffffff', '#ffffff', '#ffffff', '#e8dbff', '#d6bff0', '#f1d9ee', '#fff0c9', '#cfd8ff'];
import type { TextureSet } from './textures';

/* ---------------------------------- Sun ---------------------------------- */
export function Sun({ textures, quality }: { textures: TextureSet; quality: 'high' | 'low' }) {
  const mesh = useRef<THREE.Mesh>(null!);
  const body = useRef<THREE.Group>(null!);
  const surface = useMemo(() => makeSunSurface(textures.sun, quality === 'high'), [textures.sun, quality]);
  const corona = useMemo(() => makeCorona(), []);
  useFrame((state, dt) => {
    mesh.current.rotation.y += dt * 0.02;
    surface.uniforms.uTime.value = state.clock.elapsedTime;
    corona.uniforms.uTime.value = state.clock.elapsedTime;
    // The Sun keeps lighting everything, but is not drawn while we fly the journey.
    body.current.visible = !(runtime.journey && !runtime.journey.swapped) && !runtime.intro.hideSolar;
  });
  return (
    <group>
      <group ref={body}>
        <mesh ref={mesh} material={surface}>
          <sphereGeometry args={[SUN_RADIUS, 96, 64]} />
        </mesh>
        <Billboard>
          <mesh material={corona} renderOrder={2}>
            <planeGeometry args={[SUN_RADIUS * 8, SUN_RADIUS * 8]} />
          </mesh>
        </Billboard>
        <sprite scale={SUN_RADIUS * 14}>
          <spriteMaterial map={textures.sunGlow} blending={THREE.AdditiveBlending} transparent depthWrite={false} toneMapped={false} opacity={0.14} />
        </sprite>
      </group>
      {/* Warm sunlight: lights the planets from the centre of the system. */}
      <pointLight position={[0, 0, 0]} intensity={3.3} decay={0} color="#fff1dc" />
    </group>
  );
}

/* --------------------------------- Nebula -------------------------------- */
const FOG_LIGHT = new THREE.Color('#241739');
const FOG_DEEP = new THREE.Color('#1a1130');
/** Soft pink-lavender haze over the town on Earth. */
const TOWN_HAZE = new THREE.Color('#f1d6e2');

export function Nebula() {
  const mat = useMemo(() => makeNebulaMaterial(), []);
  const mesh = useRef<THREE.Mesh>(null!);
  useFrame((state, dt) => {
    mat.uniforms.uTime.value = state.clock.elapsedTime;
    mesh.current.position.copy(state.camera.position);
    const deep = runtime.journey && !runtime.journey.swapped ? 1 - THREE.MathUtils.smoothstep(runtime.journey.t, runtime.journey.leg.revealAt, 1) * 0.6 : 0;
    const u = mat.uniforms.uDeep;
    u.value += (deep - u.value) * Math.min(1, dt * 2.5);
    mat.uniforms.uSpace.value = runtime.intro.dark;
    mat.uniforms.uBand.value = runtime.intro.band;
    mat.uniforms.uGalN.value.copy(runtime.intro.galN);
    mat.uniforms.uGalC.value.copy(runtime.intro.galC);
    // Keep the fog the same colour as the sky behind it.
    const fog = state.scene.fog as THREE.Fog | null;
    if (fog) {
      if (runtime.earth.inTown) fog.color.copy(TOWN_HAZE);
      else fog.color.copy(FOG_LIGHT).lerp(FOG_DEEP, u.value);
    }
  });
  return (
    <mesh ref={mesh} material={mat} renderOrder={-10}>
      <sphereGeometry args={[900, 48, 32]} />
    </mesh>
  );
}

/* ------------------------------ Stars + dust ----------------------------- */
export function Starfield({ quality }: { quality: 'high' | 'low' }) {
  const dust = useRef<THREE.Points>(null!);
  const geo = useMemo(() => {
    const n = quality === 'high' ? 2200 : 900;
    const arr = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 7 + Math.pow(Math.random(), 0.8) * 70;
      arr[i * 3] = Math.cos(a) * r;
      arr[i * 3 + 1] = (Math.random() - 0.5) * (1 + r * 0.06);
      arr[i * 3 + 2] = Math.sin(a) * r;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(arr, 3));
    return g;
  }, [quality]);

  const sky = useRef<THREE.Group>(null!);
  const phase = useCosmic((s) => s.phase);
  const starGeo = useMemo(() => {
    const n = quality === 'high' ? 2600 : 1200;
    const big = quality === 'high' ? 180 : 90;
    const pos = new Float32Array((n + big) * 3);
    const col = new Float32Array((n + big) * 3);
    const size = new Float32Array(n + big);
    const phaseA = new Float32Array(n + big);
    const v = new THREE.Vector3();
    const c = new THREE.Color();
    for (let i = 0; i < n + big; i++) {
      v.set(Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1).normalize().multiplyScalar(380 + Math.random() * 120);
      pos.set([v.x, v.y, v.z], i * 3);
      c.set(STAR_TINTS[Math.floor(Math.random() * STAR_TINTS.length)]);
      col.set([c.r, c.g, c.b], i * 3);
      size[i] = i < n ? 0.8 + Math.random() * 1.1 : 2.2 + Math.random() * 1.8;
      phaseA[i] = Math.random();
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
    g.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
    g.setAttribute('aPhase', new THREE.BufferAttribute(phaseA, 1));
    return g;
  }, [quality]);
  const starMat = useMemo(() => makeTwinkleMaterial({ size: 3.4, opacity: 1 }), []);
  useEffect(() => {
    // Dust belongs to the wide views; in close-ups it would sit right in front of the lens.
    if (dust.current) dust.current.visible = phase === 'solar' || phase === 'cockpit' || phase === 'complete' || phase === 'loading';
  }, [phase]);
  useFrame((state, dt) => {
    dust.current.rotation.y += dt * 0.004;
    if ((runtime.journey && !runtime.journey.swapped) || useCosmic.getState().selected || runtime.intro.reveal < 0.95) dust.current.visible = false;
    else dust.current.visible = phase === 'solar' || phase === 'cockpit' || phase === 'complete' || phase === 'loading';
    sky.current.position.copy(state.camera.position);
    starMat.uniforms.uTime.value = state.clock.elapsedTime;
    // Out in the galaxy the background stars give way to the galaxy's own.
    starMat.uniforms.uOpacity.value = 1 - runtime.intro.dark * 0.65;
  });

  return (
    <>
      <group ref={sky}>
        <points geometry={starGeo} material={starMat} renderOrder={-9} frustumCulled={false} />
      </group>
      <points ref={dust} geometry={geo}>
        <pointsMaterial map={getSoftDot()} size={0.26} color="#e9dcff" transparent opacity={0.8} depthWrite={false} blending={THREE.AdditiveBlending} sizeAttenuation fog={false} />
      </points>
    </>
  );
}

/* ------------------------------ Belts (overview) --------------------------- */
/**
 * The main asteroid belt (between Mars and Jupiter) and a sparse Kuiper belt
 * beyond Neptune, drifting slowly with the model's clock. Hidden on journeys.
 */
export function SolarBelts({ quality }: { quality: 'high' | 'low' }) {
  const group = useRef<THREE.Group>(null!);
  const belts = useMemo(() => {
    const make = (n: number, inner: number, outer: number, thick: number, seed: number) => {
      let s = seed;
      const rnd = () => {
        s = (s * 16807) % 2147483647;
        return s / 2147483647;
      };
      const g = new THREE.IcosahedronGeometry(1, 0);
      const dummy = new THREE.Object3D();
      const mats: THREE.Matrix4[] = [];
      for (let i = 0; i < n; i++) {
        const a = rnd() * Math.PI * 2;
        const r = inner + (outer - inner) * (0.5 + (rnd() + rnd() - 1) * 0.5);
        dummy.position.set(Math.cos(a) * r, (rnd() - 0.5) * thick, Math.sin(a) * r);
        dummy.rotation.set(rnd() * 6, rnd() * 6, rnd() * 6);
        const k = 0.05 + Math.pow(rnd(), 3) * 0.16;
        dummy.scale.set(k, k * (0.6 + rnd() * 0.5), k * (0.7 + rnd() * 0.5));
        dummy.updateMatrix();
        mats.push(dummy.matrix.clone());
      }
      return { g, mats };
    };
    const hi = quality === 'high';
    return { main: make(hi ? 900 : 420, 20.8, 23.0, 0.9, 7), kuiper: make(hi ? 600 : 260, 58, 70, 2.4, 13) };
  }, [quality]);

  const refs = useRef<(THREE.InstancedMesh | null)[]>([]);
  useEffect(() => {
    [belts.main, belts.kuiper].forEach((b, i) => {
      const im = refs.current[i];
      if (!im) return;
      b.mats.forEach((m, k) => im.setMatrixAt(k, m));
      im.instanceMatrix.needsUpdate = true;
    });
  }, [belts]);

  useFrame(() => {
    group.current.visible = !(runtime.journey && !runtime.journey.swapped) && !useCosmic.getState().selected && runtime.intro.reveal > 0.85;
    group.current.children[0].rotation.y = runtime.simTime * 0.03;
    group.current.children[1].rotation.y = runtime.simTime * 0.006;
  });

  return (
    <group ref={group}>
      <instancedMesh ref={(el) => (refs.current[0] = el)} args={[belts.main.g, undefined, belts.main.mats.length]}>
        <meshStandardMaterial color="#c3b3dd" roughness={1} flatShading />
      </instancedMesh>
      <instancedMesh ref={(el) => (refs.current[1] = el)} args={[belts.kuiper.g, undefined, belts.kuiper.mats.length]}>
        <meshStandardMaterial color="#f6c9e0" roughness={1} flatShading transparent opacity={0.6} />
      </instancedMesh>
    </group>
  );
}

/* ------------------------------- Orbit paths ----------------------------- */
/** Soft glowing ribbon along an orbit: a flat ring whose alpha falls off across its width. */
function makeOrbitGlow(radius: number, width: number, color: string, opacity: number) {
  return new THREE.ShaderMaterial({
    uniforms: { uR: { value: radius }, uW: { value: width }, uColor: { value: new THREE.Color(color) }, uOpacity: { value: opacity } },
    vertexShader: /* glsl */ `
      varying vec2 vLocal;
      void main() {
        vLocal = position.xy;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uR;
      uniform float uW;
      uniform vec3 uColor;
      uniform float uOpacity;
      varying vec2 vLocal;
      void main() {
        float x = (length(vLocal) - uR) / uW;
        float a = exp(-x * x * 3.0) * 0.5 + exp(-x * x * 60.0) * 0.65;
        gl_FragColor = vec4(uColor, a * uOpacity);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
}

const ORBIT_SPARKLE_TINTS = ['#ffffff', '#fff0c9', '#d6bff0', '#f1d9ee', '#a78bce'];

export function OrbitPaths() {
  const phase = useCosmic((s) => s.phase);
  const discovered = useCosmic((s) => s.discovered);
  const selected = useCosmic((s) => s.selected);
  const visible = (phase === 'solar' || phase === 'cockpit' || phase === 'complete' || phase === 'loading' || phase === 'intro') && !selected;
  const sparkGroup = useRef<THREE.Group>(null!);

  const orbits = useMemo(
    () =>
      PLANETS.map((p) => {
        const r = p.orbit;
        const w = 0.14 + r * 0.007;
        const ring = new THREE.RingGeometry(r - w * 1.6, r + w * 1.6, 256, 1);
        // Tiny stars and cosmic dust scattered along the path.
        const n = Math.round(14 + r * 1.6);
        const pos = new Float32Array(n * 3);
        const col = new Float32Array(n * 3);
        const size = new Float32Array(n);
        const ph = new Float32Array(n);
        const c = new THREE.Color();
        for (let i = 0; i < n; i++) {
          const a = Math.random() * Math.PI * 2;
          const rr = r + (Math.random() - 0.5) * w * 3;
          pos.set([Math.cos(a) * rr, (Math.random() - 0.5) * 0.3, Math.sin(a) * rr], i * 3);
          c.set(ORBIT_SPARKLE_TINTS[i % ORBIT_SPARKLE_TINTS.length]);
          col.set([c.r, c.g, c.b], i * 3);
          size[i] = Math.random() < 0.12 ? 2.2 + Math.random() : 0.7 + Math.random() * 0.8;
          ph[i] = Math.random();
        }
        const sparks = new THREE.BufferGeometry();
        sparks.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        sparks.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
        sparks.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
        sparks.setAttribute('aPhase', new THREE.BufferAttribute(ph, 1));
        return { id: p.id, r, w, ring, sparks };
      }),
    [],
  );
  const sparkMat = useMemo(() => makeTwinkleMaterial({ size: 3.2, opacity: 0.95, attenuate: 26 }), []);
  const glowMats = useMemo(
    () =>
      Object.fromEntries(
        orbits.map((o) => {
          const today = o.id === 'neptune' || o.id === 'uranus';
          return [o.id, makeOrbitGlow(o.r, o.w, today ? '#ffe7c4' : '#cdb6f2', today ? 1 : 0.75)];
        }),
      ),
    [orbits],
  );

  useEffect(() => {
    // Today's destinations glow warm cream; places already visited turn pink.
    orbits.forEach((o) => {
      if (discovered.includes(o.id)) glowMats[o.id].uniforms.uColor.value.set('#f1b6dc');
    });
  }, [discovered, orbits, glowMats]);

  useFrame((state) => {
    sparkMat.uniforms.uTime.value = state.clock.elapsedTime;
    // During the cinematic the orbits draw in from the Sun outwards.
    const rv = runtime.intro.reveal;
    orbits.forEach((o, i) => {
      const k = THREE.MathUtils.smoothstep(rv, 0.1 + i * 0.09, 0.22 + i * 0.09);
      const m = glowMats[o.id];
      m.uniforms.uOpacity.value = (o.id === 'neptune' || o.id === 'uranus' ? 1 : 0.75) * k;
    });
    sparkMat.uniforms.uOpacity.value = 0.95 * rv;
    if (!visible) return;
    sparkGroup.current.children.forEach((c, i) => {
      c.rotation.y = state.clock.elapsedTime * (0.02 - i * 0.0018);
    });
  });

  return (
    <group visible={visible}>
      {orbits.map((o) => (
        <mesh key={o.id} geometry={o.ring} material={glowMats[o.id]} rotation-x={-Math.PI / 2} renderOrder={-1} />
      ))}
      <group ref={sparkGroup}>
        {orbits.map((o) => (
          <points key={o.id} geometry={o.sparks} material={sparkMat} frustumCulled={false} />
        ))}
      </group>
    </group>
  );
}

/* ------------------------------- Warp field ------------------------------ */
/**
 * Star streaks + (for 'warp' travel) tunnel rings, attached to the camera.
 * Strength follows runtime.speed, so it is invisible when not travelling.
 */
export function WarpField({ quality }: { quality: 'high' | 'low' }) {
  const group = useRef<THREE.Group>(null!);
  const lines = useRef<THREE.LineSegments>(null!);
  const rings = useRef<THREE.Group>(null!);
  const journeyId = useCosmic((s) => s.journeyId);
  const isWarp = !!runtime.journey?.leg.tunnel && journeyId > 0;

  const N = quality === 'high' ? 520 : 260;
  const data = useMemo(() => {
    const seeds = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 2.2 + Math.random() * 26;
      seeds[i * 3] = Math.cos(a) * r;
      seeds[i * 3 + 1] = Math.sin(a) * r;
      seeds[i * 3 + 2] = -Math.random() * 220;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 6), 3));
    return { seeds, geo };
  }, [N]);

  const ringGeo = useMemo(() => {
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 96; i++) {
      const a = (i / 96) * Math.PI * 2;
      pts.push(new THREE.Vector3(Math.cos(a) * 9, Math.sin(a) * 9, 0));
    }
    return new THREE.BufferGeometry().setFromPoints(pts);
  }, []);
  const RINGS = 18;

  useFrame((state, dt) => {
    const cam = state.camera;
    group.current.position.copy(cam.position);
    group.current.quaternion.copy(cam.quaternion);
    const s = runtime.speed;
    group.current.visible = s > 0.01;
    if (!group.current.visible) return;

    const pos = data.geo.attributes.position as THREE.BufferAttribute;
    const len = 0.4 + s * (isWarp ? 22 : 16);
    const adv = dt * s * (isWarp ? 220 : 170);
    for (let i = 0; i < N; i++) {
      let z = data.seeds[i * 3 + 2] + adv;
      if (z > 4) z -= 224;
      data.seeds[i * 3 + 2] = z;
      const x = data.seeds[i * 3];
      const y = data.seeds[i * 3 + 1];
      pos.setXYZ(i * 2, x, y, z);
      pos.setXYZ(i * 2 + 1, x, y, z - len);
    }
    pos.needsUpdate = true;
    (lines.current.material as THREE.LineBasicMaterial).opacity = Math.min(0.85, s * 0.9);

    rings.current.visible = isWarp;
    if (isWarp) {
      rings.current.children.forEach((child, i) => {
        const r = child as THREE.LineLoop;
        r.position.z += adv * 0.8;
        if (r.position.z > 4) r.position.z -= RINGS * 14;
        r.rotation.z += dt * (i % 2 ? 0.4 : -0.3);
        (r.material as THREE.LineBasicMaterial).opacity = Math.min(0.55, s * 0.6) * (1 - Math.abs(r.position.z) / (RINGS * 14));
      });
    }
  });

  return (
    <group ref={group} renderOrder={5}>
      <lineSegments ref={lines} geometry={data.geo} frustumCulled={false}>
        <lineBasicMaterial color="#d6bff0" transparent opacity={0} depthWrite={false} fog={false} />
      </lineSegments>
      <group ref={rings}>
        {Array.from({ length: RINGS }, (_, i) => (
          <lineLoop key={i} geometry={ringGeo} position={[0, 0, -i * 14]} frustumCulled={false}>
            <lineBasicMaterial color={i % 3 === 0 ? '#f6a8cf' : '#9b7fd4'} transparent opacity={0} depthWrite={false} fog={false} />
          </lineLoop>
        ))}
      </group>
    </group>
  );
}

/* ----------------------------- Dwarf planets ------------------------------ */
/**
 * Ceres (in the asteroid belt) and Pluto (in the Kuiper Belt), each on an
 * eccentric, inclined orbit with the Sun at one focus, and clearly labelled
 * as dwarf planets. Shown in the wide views only.
 */
export function DwarfPlanets({ textures }: { textures: TextureSet }) {
  const phase = useCosmic((s) => s.phase);
  const selected = useCosmic((s) => s.selected);
  const wide = (phase === 'solar' || phase === 'cockpit' || phase === 'complete') && !selected;
  const [openLabel, setOpenLabel] = useState<string | null>(null);
  const root = useRef<THREE.Group>(null!);
  const bodies = useRef<(THREE.Group | null)[]>([]);
  const orbits = useMemo(
    () =>
      DWARFS.map((d) => {
        const b = d.orbit * Math.sqrt(1 - d.eccentricity ** 2);
        const pts: THREE.Vector3[] = [];
        for (let i = 0; i <= 256; i++) {
          const E = (i / 256) * Math.PI * 2;
          pts.push(new THREE.Vector3(d.orbit * Math.cos(E) - d.orbit * d.eccentricity, 0, b * Math.sin(E)));
        }
        return { b, geo: new THREE.BufferGeometry().setFromPoints(pts) };
      }),
    [],
  );
  useFrame(() => {
    root.current.visible = !(runtime.journey && !runtime.journey.swapped) && runtime.intro.reveal > 0.9;
    DWARFS.forEach((d, i) => {
      const g = bodies.current[i];
      if (!g) return;
      const E = d.phase + runtime.simTime * d.speed;
      g.position.set(d.orbit * Math.cos(E) - d.orbit * d.eccentricity, 0, -orbits[i].b * Math.sin(E));
      g.rotation.y += 0.004;
    });
  });
  return (
    <group ref={root}>
      {DWARFS.map((d, i) => (
        <group key={d.id} rotation={[THREE.MathUtils.degToRad(d.inclination), 0.6 * i, 0]}>
          <lineLoop geometry={orbits[i].geo} visible={wide} ref={(l) => void l?.computeLineDistances()}>
            <lineDashedMaterial color="#b9a1df" transparent opacity={0.35} dashSize={0.6} gapSize={0.9} depthWrite={false} fog={false} />
          </lineLoop>
          <group ref={(el) => (bodies.current[i] = el)}>
            <mesh>
              <sphereGeometry args={[d.size, 32, 20]} />
              <meshStandardMaterial map={textures.bodies[d.id]} roughness={1} />
            </mesh>
            {wide && (
              <Html center zIndexRange={[12, 8]} position={[0, d.size + 0.9, 0]}>
                {/* Just the name; "dwarf planet" shows on hover (desktop) or tap (touch). */}
                <button
                  type="button"
                  className={`dwarf-label${openLabel === d.id ? ' is-open' : ''}`}
                  aria-label={`${d.name}, dwarf planet`}
                  aria-expanded={openLabel === d.id}
                  onClick={() => setOpenLabel(openLabel === d.id ? null : d.id)}
                >
                  {d.name}
                  <i aria-hidden="true"> · dwarf planet</i>
                </button>
              </Html>
            )}
          </group>
        </group>
      ))}
    </group>
  );
}
