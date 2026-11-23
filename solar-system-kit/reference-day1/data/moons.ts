import type { PlanetId } from '../types';

/**
 * Major moons shown in the model. Sizes and orbit distances are enlarged so
 * they can be seen (the whole model is not to scale); orbital periods are
 * real and only set the relative speeds. Retrograde moons have a negative
 * period. Moons that orbit in their planet's equatorial plane tilt with it.
 * Sources: NASA Solar System Exploration and NSSDCA satellite fact sheets.
 */
export interface MoonData {
  id: string;
  name: string;
  parent: PlanetId;
  /** Display radius, in parent radii. */
  size: number;
  /** Display orbit radius, in parent radii. */
  orbit: number;
  /** Real sidereal orbital period in days (negative = retrograde). */
  periodDays: number;
  /** Display inclination of the orbit (deg) relative to its reference plane. */
  inclination: number;
  /** Orbits in the planet's equatorial plane (follows the axial tilt). */
  equatorial: boolean;
  phase: number;
  fact: string;
}

export const MOONS: MoonData[] = [
  {
    id: 'moon',
    name: 'The Moon',
    parent: 'earth',
    size: 0.27,
    orbit: 3.6,
    periodDays: 27.32,
    inclination: 5.1,
    equatorial: false,
    phase: 1.2,
    fact: 'Earth’s only natural satellite. It is tidally locked, so the same face always points towards Earth.',
  },
  {
    id: 'phobos',
    name: 'Phobos',
    parent: 'mars',
    size: 0.09,
    orbit: 1.9,
    periodDays: 0.319,
    inclination: 1.1,
    equatorial: true,
    phase: 0.3,
    fact: 'The larger, inner moon of Mars. It circles Mars faster than Mars rotates, and its orbit is slowly shrinking.',
  },
  {
    id: 'deimos',
    name: 'Deimos',
    parent: 'mars',
    size: 0.07,
    orbit: 2.9,
    periodDays: 1.263,
    inclination: 1.8,
    equatorial: true,
    phase: 2.6,
    fact: 'The smaller, outer moon of Mars, only about 12 km across.',
  },
  {
    id: 'io',
    name: 'Io',
    parent: 'jupiter',
    size: 0.1,
    orbit: 1.9,
    periodDays: 1.769,
    inclination: 0.05,
    equatorial: true,
    phase: 0.4,
    fact: 'The most volcanically active world in the Solar System, heated by tides raised by Jupiter.',
  },
  {
    id: 'europa',
    name: 'Europa',
    parent: 'jupiter',
    size: 0.09,
    orbit: 2.4,
    periodDays: 3.551,
    inclination: 0.47,
    equatorial: true,
    phase: 2.1,
    fact: 'Its icy crust is thought to cover a global ocean of salty liquid water.',
  },
  {
    id: 'ganymede',
    name: 'Ganymede',
    parent: 'jupiter',
    size: 0.14,
    orbit: 3.0,
    periodDays: 7.155,
    inclination: 0.2,
    equatorial: true,
    phase: 3.9,
    fact: 'The largest moon in the Solar System (larger than Mercury) and the only moon known to have its own magnetic field.',
  },
  {
    id: 'callisto',
    name: 'Callisto',
    parent: 'jupiter',
    size: 0.13,
    orbit: 3.8,
    periodDays: 16.69,
    inclination: 0.3,
    equatorial: true,
    phase: 5.4,
    fact: 'One of the most heavily cratered surfaces known: an ancient, icy world.',
  },
  {
    id: 'enceladus',
    name: 'Enceladus',
    parent: 'saturn',
    size: 0.045,
    orbit: 2.7,
    periodDays: 1.37,
    inclination: 0.02,
    equatorial: true,
    phase: 1.0,
    fact: 'Jets of water vapour and ice particles erupt from its south polar region, fed by a subsurface ocean (Cassini).',
  },
  {
    id: 'rhea',
    name: 'Rhea',
    parent: 'saturn',
    size: 0.06,
    orbit: 3.3,
    periodDays: 4.518,
    inclination: 0.35,
    equatorial: true,
    phase: 3.3,
    fact: 'Saturn’s second-largest moon: a cold, icy and heavily cratered world.',
  },
  {
    id: 'titan',
    name: 'Titan',
    parent: 'saturn',
    size: 0.12,
    orbit: 4.4,
    periodDays: 15.95,
    inclination: 0.35,
    equatorial: true,
    phase: 5.0,
    fact: 'Saturn’s largest moon, with a thick nitrogen atmosphere and lakes and seas of liquid methane and ethane.',
  },
  {
    id: 'miranda',
    name: 'Miranda',
    parent: 'uranus',
    size: 0.05,
    orbit: 2.4,
    periodDays: 1.413,
    inclination: 4.3,
    equatorial: true,
    phase: 0.6,
    fact: 'A small moon with a patchwork surface of grooves and cliffs, including Verona Rupes, one of the tallest cliffs known.',
  },
  {
    id: 'ariel',
    name: 'Ariel',
    parent: 'uranus',
    size: 0.06,
    orbit: 2.8,
    periodDays: 2.52,
    inclination: 0.3,
    equatorial: true,
    phase: 2.2,
    fact: 'Has the brightest and possibly youngest surface of Uranus’s large moons.',
  },
  {
    id: 'umbriel',
    name: 'Umbriel',
    parent: 'uranus',
    size: 0.06,
    orbit: 3.2,
    periodDays: 4.144,
    inclination: 0.1,
    equatorial: true,
    phase: 3.7,
    fact: 'The darkest of Uranus’s large moons.',
  },
  {
    id: 'titania',
    name: 'Titania',
    parent: 'uranus',
    size: 0.08,
    orbit: 3.7,
    periodDays: 8.706,
    inclination: 0.1,
    equatorial: true,
    phase: 4.8,
    fact: 'Uranus’s largest moon, crossed by enormous fault canyons.',
  },
  {
    id: 'oberon',
    name: 'Oberon',
    parent: 'uranus',
    size: 0.08,
    orbit: 4.2,
    periodDays: 13.46,
    inclination: 0.1,
    equatorial: true,
    phase: 0.1,
    fact: 'The outermost of Uranus’s large moons: old and heavily cratered.',
  },
  {
    id: 'triton',
    name: 'Triton',
    parent: 'neptune',
    size: 0.2,
    orbit: 3.3,
    periodDays: -5.877,
    // Triton's orbit is inclined ~157° to Neptune's equator, i.e. retrograde:
    // drawn as a 23° tilt with backwards motion.
    inclination: 23,
    equatorial: true,
    phase: 1.2,
    fact: 'Orbits Neptune backwards (retrograde), a strong sign it was captured, probably from the Kuiper Belt. Voyager 2 saw nitrogen geyser plumes in 1989.',
  },
];

export const moonsOf = (planet: PlanetId) => MOONS.filter((m) => m.parent === planet);

/** Dwarf planets marked in the model. */
export const DWARFS = [
  {
    id: 'ceres',
    name: 'Ceres',
    // Display orbit inside the asteroid belt; real: ~2.77 AU, inclination 10.6°.
    orbit: 21.9,
    eccentricity: 0.08,
    inclination: 10.6,
    size: 0.42,
    speed: 0.028,
    phase: 4.2,
    fact: 'The largest object in the asteroid belt, and the only dwarf planet in the inner Solar System. Visited by NASA’s Dawn (2015–2018).',
  },
  {
    id: 'pluto',
    name: 'Pluto',
    // Display orbit with Pluto's real eccentricity (0.244) and inclination (17.2°),
    // so it crosses inside Neptune's orbit near perihelion as the real one does.
    orbit: 62,
    eccentricity: 0.244,
    inclination: 17.2,
    size: 0.7,
    speed: 0.004,
    phase: 1.4,
    fact: 'A dwarf planet in the Kuiper Belt, reclassified in 2006. New Horizons flew past in 2015 and revealed nitrogen-ice plains and mountains of water ice.',
  },
] as const;
