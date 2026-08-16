import { createRoot } from 'react-dom/client';
import { App } from './App';
import './styles/index.css';
import './styles/legacy.css';

const container = document.getElementById('root');
if (!container) throw new Error('Root container #root not found');

/**
 * StrictMode is deliberately NOT enabled.
 *
 * In development it double-invokes effects, which for this app means the legacy
 * game modules would register their socket listeners twice, run `cleanupGame`
 * between the two mounts, and tear down DOM nodes the second pass then expects
 * to find. The immutable modules cannot be made idempotent, so the safest
 * arrangement is a single mount pass in both dev and production.
 */
createRoot(container).render(<App />);
