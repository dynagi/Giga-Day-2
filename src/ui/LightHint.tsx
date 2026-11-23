import { copy } from '../data/copy';
import { useStory } from '../state/store';

export function LightHint() {
  const hint = useStory((s) => s.hint);
  return (
    <p className={`light-hint${hint ? ' is-shown' : ''}`} aria-hidden={!hint}>
      {copy.light.hint}
    </p>
  );
}
