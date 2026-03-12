import React, { Suspense, lazy } from 'react';
import ReactDOM from 'react-dom/client';
import './styles/index.css';
import App from './App.jsx';

const AppProviders = lazy(() => import('./providers/AppProviders.jsx'));
const forceComingSoon = String(import.meta.env.VITE_COMING_SOON || '').toLowerCase() === 'true';

function BootFallback() {
  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#0f0f0f',
      }}
    />
  );
}

const appNode = forceComingSoon ? (
  <App />
) : (
  <Suspense fallback={<BootFallback />}>
    <AppProviders>
      <App />
    </AppProviders>
  </Suspense>
);

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>{appNode}</React.StrictMode>
);
