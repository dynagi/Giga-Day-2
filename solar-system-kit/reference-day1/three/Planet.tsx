import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { Billboard, Html } from '@react-three/drei';
import { moonsOf, type MoonData } from '../data/moons';
import { planetPosition, runtime } from '../state/runtime';
import { isUnlocked, useCosmic } from '../state/store';
import type { PlanetData } from '../types';
import { makeAtmosphereHalo, makeAtmosphereRim } from './shaders';
import { sceneRefs } from './sceneRefs';
import type { TextureSet } from './textures';

interface Props {
  data: PlanetData;
  textures: TextureSet;
  hero: boolean;
  quality: 'high' | 'low';
}

/** Ring geometry with radial UVs (u = inner → outer edge). */
function useRingGeometry(inner: number, outer: number) {
  return useMemo(() => {
    const g = new THREE.RingGeometry(inner, outer, 192, 1);
    const pos = g.attributes.position;
    const uv = g.attributes.uv;
    const v = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      uv.setXY(i, (v.length() - inner) / (outer - inner), 0.5);
    }
    return g;
  }, [inner, outer]);
}

/**
 * Rings lit by the Sun, with the planet's shadow falling across them
 * (a ray from each ring point towards the Sun is tested against the planet).
 */
function makeRingMaterial(map: THREE.Texture, brightness: number, opacity: number) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uMap: { value: map },
      uPlanet: { value: new THREE.Vector3() },
      uRadius: { value: 1 },
      uSun: { value: new THREE.Vector3() },
      uLight: { value: 1 },
      uBright: { value: brightness },
      uOpacity: { value: opacity },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      varying vec3 vWorld;
      void main() {
        vUv = uv;
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorld = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D uMap;
      uniform vec3 uPlanet;
      uniform float uRadius;
      uniform vec3 uSun;
      uniform float uLight;
      uniform float uBright;
      uniform float uOpacity;
      varying vec2 vUv;
      varying vec3 vWorld;
      void main() {
        vec4 c = texture2D(uMap, vUv);
        vec3 d = normalize(uSun - vWorld);
        vec3 oc = vWorld - uPlanet;
        float b = dot(oc, d);
        float h = b * b - (dot(oc, oc) - uRadius * uRadius);
        // In shadow when the ray towards the Sun passes through the planet.
        float shadow = (b < 0.0) ? smoothstep(-uRadius * 0.08, uRadius * 0.08, -h) : 1.0;
        shadow = mix(0.12, 1.0, shadow);
        vec3 col = c.rgb * uBright * shadow * uLight;
        gl_FragColor = vec4(col, c.a * uOpacity);
        #include <colorspace_fragment>
      }
    `,
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
}

/** Earth: city lights glow only on the night side, fading across the terminator. */
function nightSideLights(mat: THREE.MeshStandardMaterial) {
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uSunPos = { value: new THREE.Vector3(0, 0, 0) };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWN;\nvarying vec3 vWP;')
      .replace(
        '#include <project_vertex>',
        '#include <project_vertex>\nvWN = normalize(mat3(modelMatrix) * objectNormal);\nvWP = (modelMatrix * vec4(transformed, 1.0)).xyz;',
      );
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 uSunPos;\nvarying vec3 vWN;\nvarying vec3 vWP;')
      .replace(
        '#include <emissivemap_fragment>',
        '#include <emissivemap_fragment>\nfloat sunK = dot(normalize(vWN), normalize(uSunPos - vWP));\ntotalEmissiveRadiance *= smoothstep(0.12, -0.18, sunK);',
      );
  };
}

/** How much larger each planet is drawn in the wide overview. */
const OVERVIEW_BOOST: Record<string, number> = {
  mercury: 2.6,
  venus: 2.0,
  earth: 2.0,
  mars: 2.5,
  jupiter: 1.45,
  saturn: 1.4,
  uranus: 2.0,
  neptune: 2.05,
};

const PLANET_ORDER = ['mercury', 'venus', 'earth', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune'];

/** Relief from the colour map on rocky worlds. */
const BUMP: Partial<Record<string, number>> = { mercury: 2.2, mars: 1.4 };

const moonSpeed = (m: MoonData) => (Math.sign(m.periodDays) * 0.55) / Math.sqrt(Math.abs(m.periodDays));

function Moon({ m, r, texture, showOrbit, clock }: { m: MoonData; r: number; texture: THREE.Texture; showOrbit: boolean; clock: { current: number } }) {
  const body = useRef<THREE.Group>(null!);
  const ring = useMemo(() => {
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 128; i++) {
      const a = (i / 128) * Math.PI * 2;
      pts.push(new THREE.Vector3(Math.cos(a) * m.orbit * r, 0, Math.sin(a) * m.orbit * r));
    }
    return new THREE.BufferGeometry().setFromPoints(pts);
  }, [m.orbit, r]);
  useEffect(() => {
    sceneRefs.bodies[m.id] = body.current;
    if (m.id === 'triton') sceneRefs.triton = body.current;
    return () => {
      delete sceneRefs.bodies[m.id];
      if (m.id === 'triton') sceneRefs.triton = null;
    };
  }, [m.id]);
  useFrame(() => {
    const a = m.phase + clock.current * moonSpeed(m);
    body.current.position.set(Math.cos(a) * m.orbit * r, 0, -Math.sin(a) * m.orbit * r);
    // Tidally locked: the same face keeps pointing at the planet.
    body.current.rotation.y = a;
  });
  return (
    <group rotation={[THREE.MathUtils.degToRad(m.inclination), 0, 0]}>
      <lineLoop geometry={ring} visible={showOrbit}>
        <lineBasicMaterial color="#cdb6f2" transparent opacity={0.28} depthWrite={false} />
      </lineLoop>
      <group ref={body}>
        <mesh>
          <sphereGeometry args={[m.size * r, 32, 20]} />
          <meshStandardMaterial map={texture} roughness={1} />
        </mesh>
      </group>
    </group>
  );
}

export function Planet({ data, textures, hero, quality }: Props) {
  const group = useRef<THREE.Group>(null!);
  const tilt = useRef<THREE.Group>(null!);
  const spin = useRef<THREE.Mesh>(null!);
  const clouds = useRef<THREE.Mesh>(null);

  const phase = useCosmic((s) => s.phase);
  const hovered = useCosmic((s) => s.hovered === data.id);
  const selected = useCosmic((s) => s.selected === data.id);
  const destination = useCosmic((s) => s.destination);
  const discovered = useCosmic((s) => s.discovered);
  const venusRadar = useCosmic((s) => s.venusRadar);
  const hover = useCosmic((s) => s.hover);
  const select = useCosmic((s) => s.select);

  const inMission = !['solar', 'cockpit', 'complete', 'loading'].includes(phase);
  const messageOpen = useCosmic((s) => s.messageOpen);
  const interactive = (phase === 'solar' && !messageOpen) || phase === 'cockpit';
  const unlocked = isUnlocked(data.id, discovered);
  const isDayOne = data.id === 'neptune' || data.id === 'uranus';
  const isDiscovered = discovered.includes(data.id);
  const closeUp = selected || (destination === data.id && inMission);

  const segments = hero || data.id === 'earth' || data.id === 'jupiter' || data.id === 'saturn' ? (quality === 'high' ? 128 : 64) : quality === 'high' ? 72 : 40;
  const r = data.radius;
  const tiltRad = THREE.MathUtils.degToRad(data.tiltDeg);
  const moons = useMemo(() => moonsOf(data.id), [data.id]);

  const rim = useMemo(() => (data.atmosphere ? makeAtmosphereRim(data.atmosphere.color, data.atmosphere.intensity) : null), [data]);
  const halo = useMemo(() => (data.atmosphere ? makeAtmosphereHalo(data.atmosphere.color, data.atmosphere.intensity) : null), [data]);
  const ringGeo = useRingGeometry(r * (data.rings?.inner ?? 1.2), r * (data.rings?.outer ?? 1.5));
  const ringMat = useMemo(() => {
    const map = data.rings && textures.rings[data.id];
    if (!map) return null;
    // Saturn's photographic ring map is stored dark; the procedural ones are not.
    return data.id === 'saturn' && textures.photographic ? makeRingMaterial(map, 2.1, 1) : makeRingMaterial(map, 1.15, 1);
  }, [data.id, data.rings, textures]);

  const surface = useMemo(() => {
    const m = new THREE.MeshStandardMaterial({ map: textures.planets[data.id], roughness: 0.92, metalness: 0 });
    const bump = BUMP[data.id];
    if (bump && textures.photographic) {
      m.bumpMap = textures.planets[data.id];
      m.bumpScale = bump;
      m.roughness = 1;
    }
    if (data.id === 'earth') {
      m.roughness = 0.78;
      if (textures.earthNight) {
        m.emissiveMap = textures.earthNight;
        m.emissive = new THREE.Color('#ffd9a0');
        m.emissiveIntensity = 1.35;
        nightSideLights(m);
      }
    }
    return m;
  }, [data.id, textures]);

  // Venus: switch between the cloud tops and the radar-mapped surface beneath them.
  useEffect(() => {
    if (data.id !== 'venus') return;
    const next = venusRadar && textures.venusSurface ? textures.venusSurface : textures.planets.venus;
    if (surface.map !== next) {
      surface.map = next;
      surface.needsUpdate = true;
    }
  }, [venusRadar, data.id, surface, textures]);

  useEffect(() => {
    sceneRefs.planets[data.id] = { group: group.current, tilt: tilt.current, spin: spin.current };
    return () => {
      delete sceneRefs.planets[data.id];
    };
  }, [data.id]);

  const pos = useMemo(() => new THREE.Vector3(), []);
  const lastLight = useRef(1);
  const labelEl = useRef<HTMLDivElement>(null);
  const ndc = useMemo(() => new THREE.Vector3(), []);
  const world = useMemo(() => new THREE.Vector3(), []);
  const boost = useRef(1);
  const moonClock = useRef(0);
  useFrame((state, dt) => {
    planetPosition(data, runtime.simTime, pos);
    group.current.position.copy(pos);
    // In the wide overview the planets are drawn larger (a visual model, not to
    // scale) so they read as real little worlds; true size for close-ups and journeys.
    const { phase: ph, selected: sel, spinOn } = useCosmic.getState();
    const wide = (ph === 'solar' || ph === 'cockpit' || ph === 'complete' || ph === 'loading' || ph === 'intro' || ph === 'earth' || ph === 'homecoming') && !sel && !runtime.journey;
    const portraitBoost = state.size.width < state.size.height ? 1.6 : 1;
    const want = wide ? (OVERVIEW_BOOST[data.id] ?? 1) * portraitBoost : 1;
    boost.current += (want - boost.current) * Math.min(1, dt * 2.4);
    // Opening cinematic: inner planets first, then outwards (Saturn's rings arrive with Saturn).
    const order = PLANET_ORDER.indexOf(data.id);
    const pop = THREE.MathUtils.smoothstep(runtime.intro.reveal, 0.12 + order * 0.09, 0.26 + order * 0.09);
    group.current.scale.setScalar(boost.current * Math.max(0.0001, pop));
    // During a journey the model Solar System disappears; only the destination
    // exists, out at the end of the corridor, and only once it may be revealed.
    const j = runtime.journey;
    let light = 1;
    let glow = 1;
    if (j && !j.swapped) {
      const isDest = j.dest === data.id;
      group.current.visible = isDest && j.destVisible;
      if (isDest) {
        group.current.position.add(j.offset);
        light = j.destLight;
        glow = j.destGlow;
      }
    } else {
      group.current.visible = !runtime.intro.hideSolar && pop > 0.001;
    }
    if (light !== lastLight.current) {
      lastLight.current = light;
      surface.color.setScalar(light);
    }
    if (ringMat) {
      group.current.getWorldPosition(world);
      ringMat.uniforms.uPlanet.value.copy(world);
      ringMat.uniforms.uRadius.value = r * boost.current;
      ringMat.uniforms.uLight.value = light;
    }
    // Panels near the right edge flip to the planet's left so they're never clipped.
    if (labelEl.current) {
      const cam = state.camera as THREE.PerspectiveCamera;
      const dist = cam.position.distanceTo(group.current.position);
      const px = ((r * boost.current * 1.5) / (2 * dist * Math.tan(THREE.MathUtils.degToRad(cam.fov / 2)))) * state.size.height;
      labelEl.current.style.setProperty('--pr', `${Math.round(px + 8)}px`);
      ndc.copy(group.current.position).project(cam);
      labelEl.current.classList.toggle('is-flip', ndc.x > 0.62);
    }
    if (rim) rim.uniforms.uIntensity.value = data.atmosphere!.intensity * glow;
    if (halo) halo.uniforms.uIntensity.value = data.atmosphere!.intensity * glow * (0.6 + 0.4 * (2 - light));
    // Rotation: real direction (retrograde for Venus and Uranus), gentler in close-up
    // so surface details can be studied; she can pause it.
    const spinK = (spinOn ? 1 : 0) * (sel === data.id ? 0.35 : runtime.spinScale);
    const angle = (runtime.spinAngle[data.id] ?? 0) + dt * data.spin * spinK;
    runtime.spinAngle[data.id] = angle;
    spin.current.rotation.y = angle;
    // Clouds drift a little faster than the ground (Venus: super-rotating cloud tops).
    if (clouds.current) clouds.current.rotation.y += dt * (data.id === 'venus' ? -0.05 : 0.012) * (spinOn ? 1 : 0);
    moonClock.current += dt * (closeUp ? 0.35 : 1);
  });

  const onOver = (e: ThreeEvent<PointerEvent>) => {
    if (!interactive) return;
    e.stopPropagation();
    hover(data.id);
    document.body.style.cursor = 'pointer';
  };
  const onOut = () => {
    hover(null);
    document.body.style.cursor = '';
  };
  const onClick = (e: ThreeEvent<MouseEvent>) => {
    if (!interactive || e.delta > 6) return; // ignore drags
    e.stopPropagation();
    select(data.id);
  };

  // A name on hover only; never while she's exploring the planet up close.
  const showLabel = interactive && hovered && !selected;
  const status = isDayOne ? (isDiscovered ? 'visited ♡' : unlocked ? 'today’s destination ✨' : 'today’s second stop 💫') : 'tap to explore';
  const segs = Math.round(segments * 0.66);

  return (
    <group ref={group}>
      <group ref={tilt} rotation={[0, 0, tiltRad]}>
        <mesh ref={spin} material={surface}>
          <sphereGeometry args={[r, segments, segs]} />
        </mesh>
        {data.id === 'earth' && textures.earthClouds && (
          <mesh ref={clouds} scale={1.012}>
            <sphereGeometry args={[r, segments, segs]} />
            <meshStandardMaterial color="#ffffff" alphaMap={textures.earthClouds} transparent depthWrite={false} roughness={1} opacity={0.95} />
          </mesh>
        )}
        {data.id === 'venus' && !venusRadar && (
          <mesh ref={clouds} scale={1.006}>
            <sphereGeometry args={[r, 64, 40]} />
            <meshStandardMaterial map={textures.planets.venus} transparent opacity={0.32} depthWrite={false} roughness={1} />
          </mesh>
        )}
        {ringMat && <mesh geometry={ringGeo} material={ringMat} rotation={[-Math.PI / 2, 0, 0]} />}
        {/* Moons in the equatorial plane tilt with the planet. */}
        {moons
          .filter((m) => m.equatorial)
          .map((m) => (
            <Moon key={m.id} m={m} r={r} texture={textures.bodies[m.id] ?? textures.triton} showOrbit={closeUp} clock={moonClock} />
          ))}
      </group>
      {moons
        .filter((m) => !m.equatorial)
        .map((m) => (
          <Moon key={m.id} m={m} r={r} texture={textures.bodies[m.id] ?? textures.triton} showOrbit={closeUp} clock={moonClock} />
        ))}

      {rim && (
        <mesh material={rim} scale={1.012}>
          <sphereGeometry args={[r, segments, segs]} />
        </mesh>
      )}
      {halo && (quality === 'high' || hero) && (
        <mesh material={halo} scale={1.16}>
          <sphereGeometry args={[r, 48, 32]} />
        </mesh>
      )}

      {/* Generous invisible hit area so small planets are easy to tap. */}
      <mesh onPointerOver={onOver} onPointerOut={onOut} onClick={onClick} visible={!inMission && !selected}>
        <sphereGeometry args={[Math.max(r * 1.5, 1.6), 16, 12]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} colorWrite={false} />
      </mesh>

      {showLabel && (
        <Billboard>
          <mesh>
            <ringGeometry args={[r * 1.45 + 0.35, r * 1.45 + 0.45, 64]} />
            <meshBasicMaterial color={isDayOne ? '#ffe7c4' : '#f6b8d6'} transparent opacity={0.9} toneMapped={false} />
          </mesh>
        </Billboard>
      )}

      {showLabel && (
        <Html zIndexRange={[18, 10]} style={{ pointerEvents: 'none' }}>
          <div ref={labelEl} className={`planet-label is-hot${isDayOne ? ' is-day-one' : ''}`}>
            <span className="planet-label__icon" aria-hidden="true">
              <span className="planet-label__orb" style={{ background: data.texture.palette[1] }} />
            </span>
            <span className="planet-label__text">
              <span className="planet-label__name">{data.name}</span>
              <span className="planet-label__blurb">{data.blurb}</span>
              <span className="planet-label__status">{status}</span>
            </span>
          </div>
        </Html>
      )}
    </group>
  );
}
