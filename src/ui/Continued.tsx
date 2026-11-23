import { useEffect, useState } from 'react';
import { copy } from '../data/copy';

/** Placeholder hold for phase `next`. The next stage replaces this. */
export function Continued() {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const id = window.setTimeout(() => setShown(true), 60);
    return () => window.clearTimeout(id);
  }, []);
  return (
    <p className={`continued${shown ? ' is-shown' : ''}`} role="status">
      {copy.continued}
    </p>
  );
}
