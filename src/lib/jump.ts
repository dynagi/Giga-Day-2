import { cityClock } from '../city/cityClock';
import { journeyClock } from '../journey/clock';
import { VT } from '../journey/voyageTimeline';
import { goTo } from '../state/store';

/**
 * For checking: `?scene=…` jumps straight to a part of the journey after the first tap
 * (the tap is still needed so the music can start).
 *   story   – down from the stars, the rooftop, the phone
 *   hostel  – the walk to the hostel and Richa
 *   earth   – leaving Earth, the planets, the Moon
 *   voyage  – the trip to Saturn
 *   saturn  – arriving at Saturn, then Saturn's chapters
 */
const SCENES = ['story', 'hostel', 'earth', 'voyage', 'saturn'] as const;
type Scene = (typeof SCENES)[number];

export const startScene: Scene | null = (() => {
  const s = new URLSearchParams(location.search).get('scene');
  return s && (SCENES as readonly string[]).includes(s) ? (s as Scene) : null;
})();

export function jumpToStart() {
  switch (startScene) {
    case 'story':
      goTo('story');
      break;
    case 'hostel':
      goTo('story');
      // after the 3D has started: skip ahead to the stairwell, just before the street
      window.setTimeout(() => {
        cityClock.skipChat = true;
        cityClock.t = 41.5;
      }, 900);
      break;
    case 'earth':
      goTo('earth');
      break;
    case 'voyage':
      goTo('voyage');
      break;
    case 'saturn':
      goTo('voyage');
      // straight to the arrival; Saturn starts talking a few seconds later
      window.setTimeout(() => (journeyClock.t = VT.end - 5), 900);
      break;
  }
}
