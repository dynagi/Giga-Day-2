import { useEffect, useState } from 'react';
import * as THREE from 'three';
import { env } from '../lib/env';

/**
 * Photo textures for the journey, from the Solar System kit.
 * Planet maps: Solar System Scope (solarsystemscope.com), CC BY 4.0, built from NASA imagery.
 * 2K on capable screens, 1K on phones. Started early so they're ready when we leave Earth;
 * anything that fails to load is simply null, and the scene falls back to its code-drawn version.
 */
export interface JourneyTextures {
  earthDay: THREE.Texture | null;
  earthNight: THREE.Texture | null;
  earthClouds: THREE.Texture | null;
  moon: THREE.Texture | null;
  saturn: THREE.Texture | null;
  saturnRing: THREE.Texture | null;
  /** The planets that welcome her as she leaves Earth. */
  planets: Record<WelcomePlanet, THREE.Texture | null>;
}

export type WelcomePlanet = 'mercury' | 'venus' | 'mars' | 'jupiter' | 'uranus' | 'neptune';
const PLANET_FILES: Record<WelcomePlanet, string> = {
  mercury: 'mercury.jpg',
  venus: 'venus_atmosphere.jpg',
  mars: 'mars.jpg',
  jupiter: 'jupiter.jpg',
  uranus: 'uranus.jpg',
  neptune: 'neptune.jpg',
};

function loadImage(url: string, srgb = true): Promise<THREE.Texture | null> {
  return new THREE.TextureLoader()
    .loadAsync(url)
    .then((t) => {
      if (srgb) t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = 8;
      return t;
    })
    .catch(() => null);
}

let pending: Promise<JourneyTextures> | null = null;
let ready: JourneyTextures | null = null;

/** Begin downloading (safe to call many times). */
export function preloadJourneyTextures() {
  if (pending) return pending;
  const hi = !env.lowPower && window.innerWidth > 700;
  const dir = `${import.meta.env.BASE_URL}textures/${hi ? '2k' : '1k'}/`;
  pending = Promise.all([
    loadImage(dir + 'earth_daymap.jpg'),
    loadImage(dir + 'earth_nightmap.jpg'),
    loadImage(dir + 'earth_clouds.jpg', false),
    loadImage(dir + 'moon.jpg'),
    loadImage(dir + 'saturn.jpg'),
    loadImage(dir + 'saturn_ring_alpha.png'),
    Promise.all((Object.keys(PLANET_FILES) as WelcomePlanet[]).map((id) => loadImage(dir + PLANET_FILES[id]).then((t) => [id, t] as const))),
  ]).then(([earthDay, earthNight, earthClouds, moon, saturn, saturnRing, planetList]) => {
    const planets = Object.fromEntries(planetList) as Record<WelcomePlanet, THREE.Texture | null>;
    ready = { earthDay, earthNight, earthClouds, moon, saturn, saturnRing, planets };
    return ready;
  });
  return pending;
}

/** The loaded textures, or null while they are still on their way. */
export function useJourneyTextures() {
  const [tex, setTex] = useState<JourneyTextures | null>(ready);
  useEffect(() => {
    if (ready) return;
    let off = false;
    preloadJourneyTextures().then((t) => !off && setTex(t));
    return () => {
      off = true;
    };
  }, []);
  return tex;
}
