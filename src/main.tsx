import { createRoot } from 'react-dom/client';
import App from './App';
import './styles/tokens.css';
import './styles/opening.css';
import './styles/poem.css';
import './styles/intro.css';
import './styles/ask.css';
import './garden/garden.css';
import './styles/interact.css';
import './styles/friends.css';
import './city/city.css';
import './saturn/saturn.css';
import './journey/journey.css';

createRoot(document.getElementById('root')!).render(<App />);
