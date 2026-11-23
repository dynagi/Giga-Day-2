import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame } from '@react-three/fiber';
import { Billboard, OrbitControls } from '@react-three/drei';
import { PLANETS, SUN_RADIUS } from './solar/data/planets';
import type { PlanetData, Quality } from './solar/types';
import { loadTextures, type TextureSet } from './solar/three/textures';
import { makeAtmosphereHalo, makeAtmosphereRim, makeCorona, makeNebulaMaterial, makeSunSurface, makeTwinkleMaterial } from './solar/three/shaders';

/**
 * Standalone, realistic Solar System (stripped out of the Day 1 COSMIC site).
 * The realism comes from: real NASA-based texture maps, a shader Sun with
 * granulation + corona, a single warm point light at the Sun, ACES tone mapping,
 * Fresnel atmosphere rims/halos, ring shadows, Earth night lights + clouds,
 * and a procedural nebula sky with twinkling tinted stars.
 */

const STAR_TINTS = ['#ffffff', '#ffffff', '#ffffff', '#e8dbff', '#d6bff0', '#f1d9ee', '#fff0c9', '#cfd8ff'];

/** Planets are drawn larger in the wide view so they read as worlds (not to scale). */
const OVERVIEW_BOOST: Record<string, number> = {
  mercury: 2.6, venus: 2.0, earth: 2.0, mars: 2.5, jupiter: 1.45, saturn: 1.4, uranus: 2.0, neptune: 2.05,
};
/** Relief from the colour map on rocky worlds. */
const BUMP: Partial<Record<string, number>> = { mercury: 2.2, mars: 1.4 };

const planetPos = (p: PlanetData, t: number, out: THREE.Vector3) => {
  const a = p.phase + p.orbitSpeed * t;
  return out.set(p.orbit * Math.cos(a), 0, -p.orbit * Math.sin(a));
};

function detectQuality(): Quality {
  const mobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || window.innerWidth < 700;
  const cores = navigator.hardwareConcurrency ?? 4;
  return mobile || cores <= 4 ? 'low' : 'high';
}

/* --------------------------------------------------------------- page --- */
export function SolarSystem() {
  const quality = useMemo(detectQuality, []);
  const [textures, setTextures] = useState<TextureSet | null>(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let off = false;
    loadTextures(quality, (p) => !off && setProgress(p)).then((t) => !off && setTextures(t));
    return () => {
      off = true;
    };
  }, [quality]);

  if (!textures) {
    return (
      <div style={{ position: 'fixed', inset: 0, display: 'grid', placeItems: 'center', color: '#d9c8f5', font: '14px system-ui' }}>
        Loading the Solar System… {Math.round(progress * 100)}%
      </div>
    );
  }

  return (
    <Canvas
      dpr={quality === 'high' ? [1, 1.75] : [1, 1.15]}
      gl={{ antialias: quality === 'high', powerPreference: 'high-performance', alpha: false }}
      // Portrait phones need the camera further back to fit the outer planets.
      camera={{ fov: 45, near: 0.05, far: 2400, position: window.innerWidth < window.innerHeight ? [0, 95, 170] : [0, 44, 88] }}
      onCreated={({ gl }) => {
        // Filmic tone mapping is a big part of the "real" look: bright Sun, soft highlights.
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.05;
      }}
    >
      <Nebula />
      <Stars quality={quality} />
      {/* Very soft fill so night sides are deep lavender shadow, not pure black. */}
      <ambientLight intensity={0.15} color="#eadcff" />
      <hemisphereLight args={['#fff0fa', '#b9a1df', 0.14]} />
      <Sun textures={textures} quality={quality} />
      <OrbitLines />
      {PLANETS.map((p) => (
        <Planet key={p.id} data={p} textures={textures} quality={quality} />
      ))}
      <OrbitControls makeDefault enablePan={false} enableDamping dampingFactor={0.08} rotateSpeed={0.55} zoomSpeed={0.8} minDistance={6} maxDistance={260} maxPolarAngle={Math.PI * 0.86} />
    </Canvas>
  );
}

/* ---------------------------------------------------------------- sky --- */
function Nebula() {
  const mat = useMemo(() => makeNebulaMaterial(), []);
  const mesh = useRef<THREE.Mesh>(null!);
  useFrame((state) => {
    mat.uniforms.uTime.value = state.clock.elapsedTime;
    mesh.current.position.copy(state.camera.position); // sky sphere always surrounds the camera
  });
  return (
    <mesh ref={mesh} material={mat} renderOrder={-10}>
      <sphereGeometry args={[900, 48, 32]} />
    </mesh>
  );
}

function Stars({ quality }: { quality: Quality }) {
  const sky = useRef<THREE.Group>(null!);
  const geo = useMemo(() => {
    const n = quality === 'high' ? 2600 : 1200;
    const big = quality === 'high' ? 180 : 90;
    const pos = new Float32Array((n + big) * 3);
    const col = new Float32Array((n + big) * 3);
    const size = new Float32Array(n + big);
    const ph = new Float32Array(n + big);
    const v = new THREE.Vector3();
    const c = new THREE.Color();
    for (let i = 0; i < n + big; i++) {
      v.set(Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1).normalize().multiplyScalar(380 + Math.random() * 120);
      pos.set([v.x, v.y, v.z], i * 3);
      c.set(STAR_TINTS[Math.floor(Math.random() * STAR_TINTS.length)]);
      col.set([c.r, c.g, c.b], i * 3);
      size[i] = i < n ? 0.8 + Math.random() * 1.1 : 2.2 + Math.random() * 1.8;
      ph[i] = Math.random();
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
    g.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
    g.setAttribute('aPhase', new THREE.BufferAttribute(ph, 1));
    return g;
  }, [quality]);
  const mat = useMemo(() => makeTwinkleMaterial({ size: 3.4, opacity: 1 }), []);
  useFrame((state) => {
    sky.current.position.copy(state.camera.position);
    mat.uniforms.uTime.value = state.clock.elapsedTime;
  });
  return (
    <group ref={sky}>
      <points geometry={geo} material={mat} renderOrder={-9} frustumCulled={false} />
    </group>
  );
}

/* ---------------------------------------------------------------- sun --- */
function Sun({ textures, quality }: { textures: TextureSet; quality: Quality }) {
  const mesh = useRef<THREE.Mesh>(null!);
  const surface = useMemo(() => makeSunSurface(textures.sun, quality === 'high'), [textures.sun, quality]);
  const corona = useMemo(() => makeCorona(), []);
  useFrame((state, dt) => {
    mesh.current.rotation.y += dt * 0.02;
    surface.uniforms.uTime.value = state.clock.elapsedTime;
    corona.uniforms.uTime.value = state.clock.elapsedTime;
  });
  return (
    <group>
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
      {/* The ONLY real light: warm, from the Sun's centre, no distance falloff. */}
      <pointLight position={[0, 0, 0]} intensity={3.3} decay={0} color="#fff1dc" />
    </group>
  );
}

/* ------------------------------------------------------------- orbits --- */
function OrbitLines() {
  const lines = useMemo(
    () =>
      PLANETS.map((p) => {
        const pts: THREE.Vector3[] = [];
        for (let i = 0; i <= 256; i++) {
          const a = (i / 256) * Math.PI * 2;
          pts.push(new THREE.Vector3(Math.cos(a) * p.orbit, 0, Math.sin(a) * p.orbit));
        }
        return new THREE.BufferGeometry().setFromPoints(pts);
      }),
    [],
  );
  return (
    <>
      {lines.map((g, i) => (
        <lineLoop key={i} geometry={g}>
          <lineBasicMaterial color="#b9a1df" transparent opacity={0.22} depthWrite={false} />
        </lineLoop>
      ))}
    </>
  );
}

/* ------------------------------------------------------------- planet --- */
/** Ring geometry with radial UVs (u = inner → outer edge) so a 1D ring strip maps correctly. */
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

/** Sun-lit rings with the planet's shadow falling across them (ray-sphere test per pixel). */
function makeRingMaterial(map: THREE.Texture, brightness: number) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uMap: { value: map },
      uPlanet: { value: new THREE.Vector3() },
      uRadius: { value: 1 },
      uSun: { value: new THREE.Vector3() },
      uBright: { value: brightness },
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
      uniform float uBright;
      varying vec2 vUv;
      varying vec3 vWorld;
      void main() {
        vec4 c = texture2D(uMap, vUv);
        vec3 d = normalize(uSun - vWorld);
        vec3 oc = vWorld - uPlanet;
        float b = dot(oc, d);
        float h = b * b - (dot(oc, oc) - uRadius * uRadius);
        float shadow = (b < 0.0) ? smoothstep(-uRadius * 0.08, uRadius * 0.08, -h) : 1.0;
        shadow = mix(0.12, 1.0, shadow);
        gl_FragColor = vec4(c.rgb * uBright * shadow, c.a);
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

function Planet({ data, textures, quality }: { data: PlanetData; textures: TextureSet; quality: Quality }) {
  const group = useRef<THREE.Group>(null!);
  const spin = useRef<THREE.Mesh>(null!);
  const clouds = useRef<THREE.Mesh>(null);
  const r = data.radius;
  const big = ['earth', 'jupiter', 'saturn', 'uranus', 'neptune'].includes(data.id);
  const seg = big ? (quality === 'high' ? 128 : 64) : quality === 'high' ? 72 : 40;
  const segV = Math.round(seg * 0.66);

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

  const rim = useMemo(() => (data.atmosphere ? makeAtmosphereRim(data.atmosphere.color, data.atmosphere.intensity) : null), [data]);
  const halo = useMemo(() => (data.atmosphere ? makeAtmosphereHalo(data.atmosphere.color, data.atmosphere.intensity) : null), [data]);
  const ringGeo = useRingGeometry(r * (data.rings?.inner ?? 1.2), r * (data.rings?.outer ?? 1.5));
  const ringMat = useMemo(() => {
    const map = data.rings && textures.rings[data.id];
    if (!map) return null;
    // Saturn's photographic ring map is stored dark, so it gets a brightness lift.
    return makeRingMaterial(map, data.id === 'saturn' && textures.photographic ? 2.1 : 1.15);
  }, [data.id, data.rings, textures]);

  const pos = useMemo(() => new THREE.Vector3(), []);
  const world = useMemo(() => new THREE.Vector3(), []);
  useFrame((state, dt) => {
    planetPos(data, state.clock.elapsedTime, pos);
    group.current.position.copy(pos);
    const boost = (OVERVIEW_BOOST[data.id] ?? 1) * (state.size.width < state.size.height ? 1.6 : 1);
    group.current.scale.setScalar(boost);
    spin.current.rotation.y += dt * data.spin; // negative spin = retrograde (Venus, Uranus)
    if (clouds.current) clouds.current.rotation.y += dt * (data.id === 'venus' ? -0.05 : 0.012);
    if (ringMat) {
      group.current.getWorldPosition(world);
      ringMat.uniforms.uPlanet.value.copy(world);
      ringMat.uniforms.uRadius.value = r * boost;
    }
  });

  return (
    <group ref={group}>
      {/* Real axial tilt (Uranus ≈ 98°, Venus ≈ 177°). Rings sit in the tilted equator. */}
      <group rotation={[0, 0, THREE.MathUtils.degToRad(data.tiltDeg)]}>
        <mesh ref={spin} material={surface}>
          <sphereGeometry args={[r, seg, segV]} />
        </mesh>
        {data.id === 'earth' && textures.earthClouds && (
          <mesh ref={clouds} scale={1.012}>
            <sphereGeometry args={[r, seg, segV]} />
            <meshStandardMaterial color="#ffffff" alphaMap={textures.earthClouds} transparent depthWrite={false} roughness={1} opacity={0.95} />
          </mesh>
        )}
        {data.id === 'venus' && (
          <mesh ref={clouds} scale={1.006}>
            <sphereGeometry args={[r, 64, 40]} />
            <meshStandardMaterial map={textures.planets.venus} transparent opacity={0.32} depthWrite={false} roughness={1} />
          </mesh>
        )}
        {ringMat && <mesh geometry={ringGeo} material={ringMat} rotation={[-Math.PI / 2, 0, 0]} />}
      </group>
      {rim && (
        <mesh material={rim} scale={1.012}>
          <sphereGeometry args={[r, seg, segV]} />
        </mesh>
      )}
      {halo && (
        <mesh material={halo} scale={1.16}>
          <sphereGeometry args={[r, 48, 32]} />
        </mesh>
      )}
    </group>
  );
}
