import { copy } from '../data/copy';
import { setMusicMuted } from '../audio/music';
import { useStory } from '../state/store';

export function SoundToggle() {
  const muted = useStory((s) => s.muted);
  const toggle = () => {
    const m = !useStory.getState().muted;
    useStory.getState().setMuted(m);
    setMusicMuted(m);
  };
  return (
    <button
      type="button"
      className="sound"
      data-control
      aria-label={muted ? copy.sound.play : copy.sound.mute}
      aria-pressed={muted}
      onClick={toggle}
    >
      <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 9.5h3.2L12 5.5v13l-4.8-4H4z" fill="currentColor" fillOpacity="0.18" />
        {muted ? (
          <path d="M16 9.5l4.5 5M20.5 9.5l-4.5 5" />
        ) : (
          <>
            <path d="M15.5 9.2a4 4 0 0 1 0 5.6" />
            <path d="M18 6.8a7.5 7.5 0 0 1 0 10.4" opacity="0.7" />
          </>
        )}
      </svg>
    </button>
  );
}
