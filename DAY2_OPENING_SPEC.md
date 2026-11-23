# COSMIC: Day 2 Opening ("A Little More Wonder")

Build spec for a **new, standalone website**. Read all of it before writing code.

---

## 0. Context

- This is a personal birthday gift for **Richa**, from the site owner (signs as **Giga**).
- It is Day 2 of a 6-day story called **"COSMIC: An Unordinary Journey"** (22–27 November 2026).
- Day 1 (22 Nov) is a separate, finished website. Do not reference its code; this project starts from scratch.
- **Day 2's destination is Saturn**, but this spec covers only the **opening**, before Saturn is revealed.
- **Saturn must not appear or be named anywhere in this build.** No ring shapes, no ringed-planet silhouettes, no "Saturn" in text, alt text, code comments shown to users, page title or metadata.

### Recipient and voice
- The sender talks to her in **Hinglish**: a playful roast mixed with quiet care.
- Day 2 is a **quieter, more wondrous** day than Day 1. It is still personal, not a generic space screensaver.
- **Never put these on the site:** health issues, mental health, family matters, exes or friends' drama, money, contact details.

### What Day 1 looked like (keep Day 2 in the same universe, but visibly a new chapter)
- Dark lavender space, pastel pink and lilac, soft glows, violin music.
- Fonts: Playfair Display (italic serif for emotional lines), Space Grotesk (body), Michroma (small spaced-out labels), Dancing Script (small handwritten touches).
- **Day 2's difference:** lavender **plus warm pale gold**, slower and calmer motion, fewer elements.

---

## 1. Scope

### Build
1. A tap-to-begin gate (needed so music is allowed to play).
2. The Day 2 cosmic background.
3. Three opening thoughts, one at a time.
4. The Day 2 identity/title reveal.
5. The "Follow the Light" interaction.
6. A transition that flies after the light, ending on a soft hold (placeholder for the next stage).

### Do NOT build
Saturn, rings, the planet reveal, science panels, hotspots, personality chapters, a goodbye scene, Day 3, HUDs, menus or extra buttons.

---

## 2. Tech stack

Use this so the later Saturn stage can be added **in the same 3D canvas without reloading**:

| Purpose | Package (exact versions used on Day 1; fine to reuse) |
|---|---|
| Build | `vite@5.4.11`, `@vitejs/plugin-react@4.3.4` |
| UI | `react@18.3.1`, `react-dom@18.3.1`, TypeScript `5.6.3` |
| 3D | `three@0.169.0`, `@react-three/fiber@8.17.10`, `@react-three/drei@9.117.3` (only if truly needed) |
| State | `zustand@4.5.5` |

- **No other dependencies** (no GSAP, Framer Motion or postprocessing). Use CSS transitions for text, and `useFrame` plus custom shaders or points for the scene.
- One persistent `<Canvas>` for the whole experience. Text and buttons are HTML layered on top.
- Deploy target: Vercel (static Vite build).

### Suggested structure
```
src/
  main.tsx, App.tsx
  state/store.ts            # phase machine (zustand)
  scene/OpeningCanvas.tsx   # the one <Canvas>
  scene/Nebula.tsx          # shader nebula
  scene/Starfield.tsx       # points + twinkle
  scene/Dust.tsx            # drifting particles
  scene/GuideLight.tsx      # the light + trail + burst
  scene/CameraDirector.tsx  # camera moves per phase
  ui/Gate.tsx, ui/Thoughts.tsx, ui/Identity.tsx, ui/LightHint.tsx, ui/Continued.tsx
  audio/music.ts            # violin loop with fades
  data/copy.ts              # ALL user-facing text in one file
  styles/tokens.css, styles/opening.css
public/audio/violin.mp3     # already in this folder: assets/violin.mp3, move it here
```

### Phase machine (single source of truth)
`gate → atmosphere → thoughts → identity → light → transition → next`

- Every phase has an entry and an exit, and a skip path (tap/Enter advances where noted).
- `next` is a placeholder: hold on the "to be continued" frame. The Saturn stage will plug in here later. Expose a clear `goTo('next')` hook.
- Revisiting or reloading always starts cleanly from `gate`. No half-finished animation state.

---

## 3. Look and feel

### Palette (CSS variables in `tokens.css`)
| Token | Hex | Use |
|---|---|---|
| `--space-0` | `#0e0a1a` | deepest background |
| `--space-1` | `#1a1230` | base space |
| `--violet` | `#3a2a63` | nebula body |
| `--lavender` | `#b49ddc` | nebula highlights, text accents |
| `--lilac` | `#dccbf6` | soft light |
| `--pink` | `#f2bdd6` | rare warm accents (sparingly) |
| `--gold` | `#f3d9a4` | **Day 2 signature**: the light, title sweep, a few stars |
| `--gold-deep` | `#c9a45c` | gold shading |
| `--text` | `#f6effd` | main text |

Body background must be `--space-0` even before the canvas loads, so there is never a white flash.

### Background (3D)
- **Nebula:** 2–3 large soft cloud layers (fragment-shader noise on big planes or a backdrop sphere) in violet and lavender, with a faint gold warmth in one region. Very slow drift (a full cycle takes minutes). No hard edges.
- **Stars:** about 1,500 on desktop and 700 on phones (`THREE.Points`), varying in size. Most are cool white or lilac; about 5% are pale gold. Gentle individual twinkle.
- **Dust:** about 150 desktop / 70 phone tiny particles drifting slowly with depth (parallax as the camera moves).
- **Light and depth:** a soft radial glow in the lower-center third, plus a faint vignette.
- **Camera:** almost still. A very slow forward drift and a tiny parallax that follows pointer or device tilt (max about 1.5°, disabled with reduced motion).
- **Nothing round and planet-like. Nothing with rings.**

### Typography
- **Thoughts:** Playfair Display italic, `clamp(1.5rem, 4.2vw, 2.6rem)`, line-height 1.3, max-width about 20em, centered, `text-wrap: balance`, color `--text` with a faint lavender glow.
- **Small label:** Michroma, about 0.72rem, letter-spacing 0.32em, uppercase, `--gold`.
- **Title:** Playfair Display, upright, weight 500, `clamp(2.2rem, 7vw, 4.6rem)`, letter-spacing 0.06em, uppercase.
- **Subtitle:** Space Grotesk 300, about 1rem, `--lilac`.
- Load fonts from Google Fonts with `display=swap`.

### Motion rules
- Ease everything (`cubic-bezier(.22,.61,.36,1)` or similar). Nothing snaps, bounces hard or flashes.
- Glow stays subtle: if it looks like "bloom", it's too much.

---

## 4. Sequence, step by step

### 4.1 Gate (tap to begin)
- Dark screen with stars already faintly visible and a tiny pulsing gold point in the center.
- One line under it: **"tap anywhere to begin ✨"** (Space Grotesk, small, `--lilac`, slow breathing opacity).
- The first tap/click/Enter starts the violin (fade in over about 2s) and moves to `atmosphere`.
- Why it exists: browsers block audio until the user interacts.

### 4.2 Atmosphere (about 4s)
- The gate text fades. The nebula and glow brighten from about 30% to full over about 3s. Stars twinkle in. Dust starts drifting.
- No text. Let her just look for a moment.

### 4.3 Thoughts
Show **one at a time**, centered, never two on screen together.

| # | Text |
|---|---|
| 1 | Not everything extraordinary needs to be loud. |
| 2 | Some things just exist in their own way. |
| 3 | **Bilkul tumhari tarah. 💜** |

> Line 3 is the personal twist that makes the sequence about *her*. If the owner prefers English, the alternative is "And somehow, that's what makes them special." Keep all text in `data/copy.ts` so it's a one-line change.

- Timing per line: fade in 1.4s (opacity, plus blur 6px → 0 and translateY 8px → 0), **hold 3.4s**, fade out 1.1s, then a 0.7s gap.
- A tap (or Space/Enter) skips to the next line: the current line fades out quickly (0.4s).
- While each line is up, 3–5 nearby stars brighten very slightly.
- Screen readers: an `aria-live="polite"` region announces each line.

### 4.4 Identity
1. Small label fades in: **COSMIC · 23 NOVEMBER** (gold, Michroma).
2. 0.6s later, the title materializes letter by letter (staggered about 40ms, each letter going from blur and transparency to sharp): **A LITTLE MORE WONDER**
3. Once all letters are in, a **soft gold light sweep** passes across the title once (a moving gradient mask, about 1.4s).
4. Subtitle fades in: **"Today's journey is going to be a little different."**
5. A few stars around the title gently brighten, then settle.
6. Hold about 3.5s (tap skips), then the whole block drifts up 12px and fades out over 1.2s.

### 4.5 Follow the Light (signature interaction)
**Secret for later (do not show or name it now):** this light is **Enceladus**, Saturn's icy moon and one of the most reflective objects in the Solar System. That's why it glows so bright. At the later Saturn reveal, this same light will fly back and settle into orbit around Saturn, with the line *"Ye tumhe yahan tak laaya tha. ✨"* Name the component neutrally (`GuideLight`) and keep its look consistent so the later stage can reuse it.

**Look**
- A small bright core (white-gold) with a soft gold halo, breathing gently (scale 1 → 1.08, about 2.5s).
- A particle trail: short-lived gold and lilac specks shed behind it as it moves, fading over about 1.2s.

**Appearance**
- After the identity fades: a faint point at the far side of the screen grows into the light over about 2s, then begins drifting.

**Movement**
- A smooth noise-based path inside a safe area (the central 70% of the screen, away from edges and notches). Slow speed, about 8–12% of the screen width per second. Never jittery.

**Interaction (must work with touch and mouse; there is no hover on phones)**
- The hit area is generous: a radius of at least 48px, or 10% of the short side of the screen.
- **Touch 1 and touch 2:** it reacts with a small sparkle burst (about 12 particles) and playfully **slips away** a short distance, like a shy firefly.
- **Touch 3:** she catches it. A big soft burst (about 40 particles), an expanding gold ring of light that fades, a short soft chime (Web Audio sine with gentle attack/decay, quiet), and the stars across the screen twinkle in a wave.
- Desktop extra: when the cursor comes near, the light leans slightly toward it (curious), then drifts on.
- **Hint:** if she hasn't touched it after about 4s, a tiny line fades in near the bottom: **"psst… follow the light ✨"** (Dancing Script). It disappears on the first touch.
- **Never let her get stuck:** if she does nothing for about 8s, the light comes to the center on its own and pulses; any tap anywhere then catches it. After about 15s with no input, it catches itself.
- Keyboard: Enter/Space catches it.
- **Reduced motion:** no dodging. It stays near the center; one tap catches it, or it auto-continues after about 4s. No big bursts, just a soft glow.

### 4.6 Transition (toward the next stage)
1. After the catch, the light moves forward to the center and slightly into the distance. Its trail brightens and lengthens.
2. The camera follows it: a smooth forward move over about 4s. Stars stream past gently (slight stretch, **not** a hyperspace warp effect). The nebula layers parallax.
3. The light shrinks to a bright point far ahead, which then twinkles once.
4. The screen eases to near-black lavender. Hold a small, soft line: **"to be continued… ✨"** (Dancing Script, `--lilac`).
5. Enter phase `next`. **This is the plug-in point for the Saturn journey later.** For now it just holds there quietly, with the music still playing.

---

## 5. Audio
- `violin.mp3` loops for the whole experience: fade in at the gate (about 2s to 50% volume), and fade out if the tab is hidden and back in when it returns.
- A small sound toggle (top-right, icon only, `aria-label` "Mute music"/"Play music") is the **only** persistent control.
- The chime on catch is generated with Web Audio (no extra files) and stays very quiet.

---

## 6. Performance, devices, accessibility
- **Device pixel ratio cap:** 1.75 on desktop, 1.25 on phones. Lower particle counts on phones and low-core devices (`navigator.hardwareConcurrency <= 4`).
- **No memory leaks:** reuse geometries and materials; nothing should be created in every frame.
- Pause heavy work when the tab is hidden.
- **Layout:** full screen with `100dvh`, no scrollbars and no horizontal overflow at 360px width, respecting `env(safe-area-inset-*)`.
- `prefers-reduced-motion`: as described in each section (fewer and slower particles, no camera parallax, no dodging).
- **No WebGL:** fall back to a CSS gradient background, still run the text sequence, and turn the light into a CSS-animated glowing dot. The flow must still complete.
- Page `<title>`: **"COSMIC · Day 2"**. Favicon: a small gold star (inline SVG).

---

## 7. Acceptance checklist
- [ ] Opens on a dark gate with no white flash. The first tap starts the music.
- [ ] The background is dark lavender/violet with gold accents, with nebula, stars and dust, and looks calm, not cluttered.
- [ ] Three thoughts appear one at a time. Tapping advances. None overlap.
- [ ] The identity block animates in order: label → title letters → gold sweep → subtitle.
- [ ] The light drifts smoothly with a trail. It dodges twice and is caught on the third touch, with a burst, ring, chime and star wave.
- [ ] The hint appears after about 4s idle. The light comes to her after about 8s and auto-catches after about 15s.
- [ ] Works with mouse, touch and keyboard, and with reduced motion.
- [ ] The camera follows the light forward and ends on "to be continued…" with no glitches.
- [ ] **No planet, no ring shape and no destination name anywhere.**
- [ ] Smooth (about 60fps on desktop, steady on a mid-range phone). No console errors. No overflow at 360×640, 390×844 or 1440×900.
- [ ] Reloading restarts cleanly from the gate.

### How to test
Run the dev server and drive it with a headless browser (Playwright) at 1440×900 and 390×844 (touch enabled), plus once with reduced motion. Screenshot each phase and check: overflow, console errors, frame times during the light phase, and that the flow reaches `next` (including the 15s auto-catch with no input).

---

## 8. Publishing
- New GitHub repo and a new Vercel project (Vite preset, build `npm run build`, output `dist`).
- Commits are authored by the owner. **Do not add Claude as a co-author or contributor** (no `Co-Authored-By` lines).
- `.gitignore`: `node_modules/`, `dist/`, `.vercel/`, `.env*`.

---

## 9. Later (not now): how this connects
- `next` → the space journey → **Saturn reveal**: the GuideLight (Enceladus) flies back, circles and settles into orbit around Saturn, with "Ye tumhe yahan tak laaya tha. ✨". Then Saturn's facts, hotspots, personality chapters and goodbye.
- Keep the canvas, camera director, palette and GuideLight reusable for that.
