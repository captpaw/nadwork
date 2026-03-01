import React, { useState, useEffect, Suspense, lazy, Component } from 'react';
import { theme as t } from './styles/theme.js';
import AppHeader from './components/layout/AppHeader.jsx';
import AppFooter from './components/layout/AppFooter.jsx';
import { ToastContainer } from './components/common/Toast.jsx';
import { PageLoader } from './components/common/Spinner.jsx';

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, info) {
    console.error('[NadWork ErrorBoundary]', error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '5rem 1rem', textAlign: 'center' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '16px' }}>⚠️</div>
          <h2 style={{ color: '#f0f0f0', fontWeight: 600, fontSize: '20px', marginBottom: '8px' }}>Something went wrong</h2>
          <p style={{ color: '#58585e', fontSize: '14px', marginBottom: '24px', maxWidth: '400px', margin: '0 auto 24px' }}>
            {this.state.error?.message || 'An unexpected error occurred.'}
          </p>
          <button
            onClick={() => { this.setState({ hasError: false, error: null }); window.location.hash = '#/'; }}
            style={{ background: '#7c3aed', color: '#fff', border: 'none', borderRadius: '7px', padding: '10px 20px', cursor: 'pointer', fontSize: '14px', fontWeight: 500 }}
          >
            ← Go Home
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

const HomePage         = lazy(() => import('./pages/HomePage.jsx'));
const BountyDetailPage = lazy(() => import('./pages/BountyDetailPage.jsx'));
const PostBountyPage   = lazy(() => import('./pages/PostBountyPage.jsx'));
const ProfilePage      = lazy(() => import('./pages/ProfilePage.jsx'));
const DashboardPage    = lazy(() => import('./pages/DashboardPage.jsx'));
const LeaderboardPage  = lazy(() => import('./pages/LeaderboardPage.jsx'));
const HelpPage         = lazy(() => import('./pages/HelpPage.jsx'));

function useHashRoute() {
  const [hash, setHash] = useState(window.location.hash || '#/');
  useEffect(() => {
    const handler = () => setHash(window.location.hash || '#/');
    window.addEventListener('hashchange', handler);
    return () => window.removeEventListener('hashchange', handler);
  }, []);
  return hash;
}

function Router({ hash }) {
  if (hash.startsWith('#/bounty/')) {
    const id = hash.replace('#/bounty/', '');
    return <BountyDetailPage bountyId={id} />;
  }
  if (hash.startsWith('#/profile/')) {
    // Parse address from route: #/profile/0x1234...
    const addr = hash.replace('#/profile/', '').trim();
    const target = /^0x[0-9a-fA-F]{40}$/.test(addr) ? addr : null;
    return <ProfilePage targetAddress={target} />;
  }
  if (hash === '#/profile') return <ProfilePage targetAddress={null} />;
  if (hash === '#/post')       return <PostBountyPage />;
  if (hash === '#/dashboard')  return <DashboardPage />;
  if (hash === '#/leaderboard')return <LeaderboardPage />;
  if (hash === '#/help')       return <HelpPage />;
  return <HomePage />;
}

export default function App() {
  const hash = useHashRoute();

  return (
    <div className="app" style={{ background: t.colors.bg.base, minHeight: '100vh' }}>
      <AppHeader />
      <main className="app-content" style={{ minHeight: 'calc(100vh - 72px - 80px)' }}>
        <ErrorBoundary>
          <Suspense fallback={<PageLoader />}>
            <Router hash={hash} />
          </Suspense>
        </ErrorBoundary>
      </main>
      <AppFooter />
      <ToastContainer />
    </div>
  );
}
