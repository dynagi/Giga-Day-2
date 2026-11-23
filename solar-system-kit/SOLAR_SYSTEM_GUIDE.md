# Realistic Solar System: kit and guide

This is the Solar System from Day 1 of the COSMIC site, taken out of that site so it runs on its own. It has been tested: it builds with no TypeScript errors and renders correctly on desktop (1440×900) and on a phone (390×844), with no console errors.

**Start here:**

```bash
npm install
npm run dev      # open the localhost URL it prints
```

Before writing any new code, look at it running. **Copy the files and approach in this kit as they are.** If you rewrite the scene from scratch, the result looks like cartoon plastic balls. The realism comes from the specific choices listed below, and they all have to be used together.

---

## 1. What's in the kit

| Path | What it is | Change it? |
|---|---|---|
| `src/SolarSystem.tsx` | The whole scene: canvas, sky, stars, Sun, orbit lines, planets, rings and atmospheres. About 330 lines. | Yes, this is the file to build on |
| `src/solar/three/shaders.ts` | The GLSL shaders: atmosphere rim, atmosphere halo, nebula sky, twinkling stars, Sun surface, Sun corona | Copied exactly from Day 1. Only tune the numbers. |
| `src/solar/three/textures.ts` | Loads the photo textures (2K on desktop, 1K on phones). If an image fails to load, it paints a stand-in texture in code. Also paints the moon textures and the Sun glow. | Copied exactly |
| `src/solar/data/planets.ts` | Size, orbit, speed, real axial tilt, spin direction, atmosphere colour and ring layout for each planet | You can tune these |
| `src/solar/types.ts` | Types | Copied exactly |
| `public/textures/2k/`, `public/textures/1k/` | 14 photo textures, about 4.8 MB in total | Don't rename them |
| `reference-day1/` | The **original, complete** Day 1 files, for reading only. They aren't compiled. | Read them to add moons, hotspots or camera flights |

The library versions are fixed and should not be upgraded: `three@0.169.0`, `@react-three/fiber@8.17.10`, `@react-three/drei@9.117.3`, `react@18.3.1` and `vite@5.4.11`.

---

## 2. Resources used

### Textures: Solar System Scope, CC BY 4.0
- **Source:** https://www.solarsystemscope.com/textures/
- **What they are:** planet maps built from NASA mission imagery and elevation data.
- **Licence:** Creative Commons Attribution 4.0, so **credit them** somewhere on the site, for example a small "Planet textures: Solar System Scope (CC BY 4.0)" in the credits or science notes.

| File | Used for |
|---|---|
| `sun.jpg` | Sun surface, which the shader animates |
| `mercury.jpg` | Mercury, with bump relief |
| `venus_atmosphere.jpg` | Venus cloud tops, plus a see-through cloud layer drifting the opposite way |
| `venus_surface.jpg` | The radar map of Venus's surface (optional) |
| `earth_daymap.jpg` | Earth during the day |
| `earth_nightmap.jpg` | Earth's city lights, which **glow only on the night side** |
| `earth_clouds.jpg` | Earth's cloud layer (used as a transparency map), slightly bigger than Earth and spinning faster |
| `mars.jpg` | Mars, with bump relief |
| `jupiter.jpg` | Jupiter |
| `saturn.jpg` | Saturn |
| `saturn_ring_alpha.png` | Saturn's rings: a 1D strip from the inner to the outer edge, with transparency |
| `uranus.jpg` | Uranus |
| `neptune.jpg` | Neptune |
| `moon.jpg` | Earth's Moon |

Other moons are painted in code from colour palettes, not photos. That covers Titan, **Enceladus**, Io, Europa, Ganymede, Callisto, Rhea, Miranda, Ariel, Umbriel, Titania, Oberon, Pluto, Ceres, Phobos, Deimos and Triton (`BODY_PAINT` in `textures.ts`).

### Everything else is made in code
- The sky, stars, Sun animation, corona, atmospheres and ring shadows are all shaders in `shaders.ts` and `SolarSystem.tsx`.
- The only library extras used are `OrbitControls` and `Billboard` from drei.
- There is **no** post-processing or bloom library. The glow comes from additive blending plus filmic tone mapping.

---

## 3. Why it looks real: the recipe

All 10 of these matter. Each item says what goes wrong if you leave it out.

1. **Real photo textures, in the right colour space.**
   - Every colour map is set to `texture.colorSpace = THREE.SRGBColorSpace` and `anisotropy = 8`.
   - Use 2K on desktop and 1K on phones.
   - Without this: the colours look washed out or too dark, and textures blur at an angle.

2. **Filmic tone mapping.**
   - `gl.toneMapping = THREE.ACESFilmicToneMapping` with `toneMappingExposure = 1.05`.
   - This gives soft highlights like a real camera, and lets the Sun look blindingly bright without flat white areas.

3. **One real light, at the Sun.**
   - `<pointLight position={[0,0,0]} intensity={3.3} decay={0} color="#fff1dc" />`.
   - Each planet has a lit day side and a dark night side that faces correctly towards the Sun.
   - `decay={0}` means Neptune is lit as well as Mercury. The model's distances are compressed, so real falloff would make the outer planets black.

4. **A very faint fill light.**
   - `ambientLight 0.15 #eadcff` plus `hemisphereLight('#fff0fa', '#b9a1df', 0.14)`.
   - Night sides become deep lavender shadow instead of pure black holes.
   - Don't raise these values: the day/night contrast is what makes the planets look like spheres.

5. **Matte surfaces.**
   - `MeshStandardMaterial` with `roughness 0.92` and `metalness 0`.
   - Mercury and Mars also use their own map as a bump map (scales 2.2 and 1.4).
   - Earth uses roughness 0.78, so the oceans catch a little light.
   - Never use `MeshBasicMaterial` or `MeshPhongMaterial` for planets.

6. **An atmosphere made of two layers** (`makeAtmosphereRim` and `makeAtmosphereHalo`).
   - **Rim:** a sphere at 1.012× the planet's size with a Fresnel glow at the edges. It's brighter on the side facing the Sun, and uses additive blending.
   - **Halo:** a sphere at 1.16× that renders only its back faces, giving a soft glow outside the planet's edge.
   - The colour and strength for each planet are in `planets.ts`, for example Neptune `#6ea6ff` at 1.05 and Earth `#86b8ff` at 0.75.

7. **A Sun that's alive** (`makeSunSurface`, `makeCorona` and a sprite).
   - Animated convection cells using cellular noise, slow swirling flow, drifting darker spots, and **edge darkening** (the disc gets dimmer and redder towards its edge).
   - The corona is drawn on a flat panel that always faces the camera, at 8× the Sun's radius. It has radial streamers, pinkish flame loops just above the edge, and a flare about every 11 seconds.
   - A large additive glow sprite at 14× the radius, opacity 0.14.

8. **Rings with the planet's shadow on them.**
   - `RingGeometry` with its UVs rewritten so u runs from the inner edge to the outer edge, which makes the strip texture map correctly.
   - The shader checks, for each pixel, whether the line towards the Sun passes through the planet. If it does, that part of the ring is dark.
   - The rings sit inside the **tilted** group, so they line up with the planet's equator.

9. **Earth's details.**
   - Night lights come in through `emissiveMap`, using a small shader patch (`nightSideLights`) that fades them out across the day/night line.
   - A cloud layer sits at 1.012× Earth's size and spins a little faster than the ground.

10. **A real sky.**
    - A 900-unit sphere centred on the camera with the procedural nebula shader: deep navy-purple, a tilted lavender band of nebula, and dark dust lanes.
    - About 2,600 small and 180 large tinted stars on a 380–500-unit shell. They twinkle and some have a faint four-point glint.
    - Both follow the camera, so you can never fly "out" of the sky.

Smaller details:
- Spheres use **128 segments** for the big planets and 40–72 for the small ones, so the outlines stay smooth.
- The axial tilts are real: Uranus 97.8° (it rolls on its side), Venus 177.4°.
- Negative spin values make Venus and Uranus rotate backwards.
- In the wide view the planets are drawn **larger** (the `OVERVIEW_BOOST` multipliers, ×1.6 on portrait phones) so they read as worlds. Sizes and distances are **not to scale**; Day 1 said so in a small note.

---

## 4. Common mistakes that make it look fake

- Using `MeshBasicMaterial` or emissive planets, or bright ambient light, so the planets have no shading. → Keep one point light and a faint fill.
- No `SRGBColorSpace` on the textures, so the colours look grey or washed out.
- No tone mapping, so the Sun is a flat white circle.
- A bloom library on a phone, which drops the frame rate. It isn't needed here.
- Stars as one flat image texture, which looks pixelated. Use the points shader instead.
- Real scale, which leaves everything invisible. Use the compressed values in `planets.ts`.
- Light falloff on (`decay` above 0), which makes the outer planets black.
- Rings that aren't inside the tilted group, so they're sideways compared with the planet.
- Low-poly spheres (16–32 segments), which give visible corners on the outline.

---

## 5. Performance (it has to run well on her phone)

- `quality` is `'low'` on phones or devices with 4 or fewer CPU cores. Low quality means:
  - 1K textures
  - fewer stars
  - fewer sphere segments
  - pixel ratio capped at 1.15 (`[1, 1.75]` on high)
  - no antialiasing
- If the WebGL context is lost, Day 1 showed a 2D fallback. See `reference-day1/three/CosmicCanvas.tsx`.
- Create every material once with `useMemo`. Never create objects inside `useFrame`.

---

## 6. Adding the rest of Day 1's features (see `reference-day1/`)

| Feature | Where to look |
|---|---|
| Moons orbiting planets (Triton retrograde, Saturn's moons, Enceladus) | `reference-day1/three/Planet.tsx` (the `Moon` component) and `reference-day1/data/moons.ts` |
| Asteroid belt, Kuiper belt, glowing orbits, dwarf planets | `reference-day1/three/Environment.tsx` (`SolarBelts`, `OrbitPaths`, `DwarfPlanets`) |
| Smooth camera flights and close-ups of a planet | `reference-day1/three/CameraRig.tsx` |
| Tappable hotspots on a planet's surface | `reference-day1/three/Hotspots.tsx` |
| Planet positions over time | `reference-day1/state/runtime.ts` (`planetPosition`) |

Those files use Day 1's store (`useCosmic`) and `runtime`. Replace them with your own state instead of copying the store across.

### For the Day 2 Saturn reveal
- Saturn is already set up in the kit, with the photo ring texture, ring shadow and real 26.7° tilt.
- For a close-up, move the camera to about 3–4× Saturn's radius from it (the camera flights in `CameraRig.tsx` show how).
- Turn the overview boost down to 1 while close.
- Add Enceladus as a small white moon. Its painted texture is already in `textures.bodies.enceladus`.

---

## 7. Tips for whoever builds on this

1. Run the kit first and keep it working. Change one thing at a time.
2. When adding scenes, keep **one `<Canvas>`**, and move the camera rather than reloading the scene.
3. Check the result with real screenshots at 1440×900 and 390×844, not just by reading the code.
4. Keep the texture credit (CC BY 4.0) on the site.
