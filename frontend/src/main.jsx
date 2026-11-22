// Renders StudentSetu screens and handles student actions.
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { AppProvider } from './context/AppContext';
import './index.css';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AppProvider>
      <App />
    </AppProvider>
  </React.StrictMode>
);

// PWA: the offline shell is only registered for production builds so the dev
// server keeps hot reloading normally.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
}
