import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App.tsx';
import './index.css';

registerSW({
  immediate: true,
  onNeedRefresh() {
    window.dispatchEvent(new Event('cobea:sw-update'));
  },
  onRegisteredSW(_swUrl, registration) {
    if (!registration) return;
    const hour = 60 * 60 * 1000;
    window.setInterval(() => {
      void registration.update();
    }, hour);
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
