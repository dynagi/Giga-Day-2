import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { SolarSystem } from './SolarSystem';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SolarSystem />
    <p className="hint">Drag to orbit · scroll / pinch to zoom</p>
  </StrictMode>,
);
