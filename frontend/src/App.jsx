import React, { useState, useEffect, Suspense, lazy, Component } from 'react';
import { theme as t } from './styles/theme.js';
import AppHeader from './components/layout/AppHeader.jsx';
import { IconWarning, IconChevronLeft } from './components/icons/index.jsx';
import AppFooter from './components/layout/AppFooter.jsx';
import { ToastContainer } from './components/common/Toast.jsx';
import { PageLoader } from './components/common/Spinner.jsx';
import { useDeploymentHealth } from './hooks/useDeploymentHealth.js';

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
          <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'center' }}><IconWarning size={40} color={t.colors.amber} /></div>
          <h2 style={{ color: '#f0f0f0', fontWeight: 600, fontSize: '20px', marginBottom: '8px' }}>Something went wrong</h2>
          <p style={{ color: '#58585e', fontSize: '14px', marginBottom: '24px', maxWidth: '400px', margin: '0 auto 24px' }}>
            {this.state.error?.message || 'An unexpected error occurred.'}
          </p>
          <button
            onClick={() => { this.setState({ hasError: false, error: null }); window.location.hash = '#/'; }}
            style={{ background: '#6E54FF', color: '#fff', border: 'none', borderRadius: '7px', padding: '10px 20px', cursor: 'pointer', fontSize: '14px', fontWeight: 500 }}
          >
            <IconChevronLeft size={16} color="#fff" style={{ marginRight: 8, verticalAlign: 'middle' }} /> Go Home
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

const HomePage = lazy(() => import('./pages/HomePage.jsx'));
const BountiesPage = lazy(() => import('./pages/BountiesPage.jsx'));
const BountyDetailPage = lazy(() => import('./pages/BountyDetailPage.jsx'));
const PostBountyPage = lazy(() => import('./pages/PostBountyPage.jsx'));
const ProfilePage = lazy(() => import('./pages/ProfilePage.jsx'));
const DashboardPage = lazy(() => import('./pages/DashboardPage.jsx'));
const LeaderboardPage = lazy(() => import('./pages/LeaderboardPage.jsx'));
const HelpPage = lazy(() => import('./pages/HelpPage.jsx'));
const AdminPage = lazy(() => import('./pages/AdminPage.jsx'));

function useHashRoute() {
  const [hash, setHash] = useState(window.location.hash || '#/');
  useEffect(() => {
    const handler = () => setHash(window.location.hash || '#/');
    window.addEventListener('hashchange', handler);
    return () => window.removeEventListener('hashchange', handler);
  }, []);
  return hash;
}

function Router({ hash, deploymentReady }) {
  if (hash.startsWith('#/bounty/')) {
    const id = hash.replace('#/bounty/', '');
    return <BountyDetailPage bountyId={id} />;
  }
  if (hash.startsWith('#/profile/')) {
    const addr = hash.replace('#/profile/', '').trim();
    const target = /^0x[0-9a-fA-F]{40}$/.test(addr) ? addr : null;
    return <ProfilePage targetAddress={target} />;
  }
  if (hash === '#/profile') return <ProfilePage targetAddress={null} />;
  if (hash === '#/bounties') return <BountiesPage />;
  if (hash === '#/post') return deploymentReady ? <PostBountyPage /> : <HelpPage />;
  if (hash === '#/dashboard') return <DashboardPage />;
  if (hash === '#/leaderboard') return <LeaderboardPage />;
  if (hash === '#/help') return <HelpPage />;
  if (hash === '#/admin') return <AdminPage />;
  return <HomePage />;
}

export default function App() {
  const hash = useHashRoute();
  const deployment = useDeploymentHealth();

  return (
    <div className="app" style={{ background: t.colors.bg.base, minHeight: '100vh' }}>
      <AppHeader />
      <main className="app-content">
        {!deployment.loading && !deployment.ok && (
          <div style={{ maxWidth: 1200, margin: '16px auto 0', padding: '0 16px' }}>
            <div style={{ border: `1px solid ${t.colors.amber}`, background: 'rgba(255,174,69,0.08)', borderRadius: 12, padding: '12px 14px' }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', color: t.colors.amber, fontWeight: 600, fontSize: 13 }}>
                <IconWarning size={16} color={t.colors.amber} /> Deployment Guard
              </div>
              <div style={{ color: t.colors.text.primary, fontSize: 13, marginTop: 6 }}>{deployment.message}</div>
              <div style={{ color: t.colors.text.muted, fontSize: 12, marginTop: 4 }}>{deployment.details}</div>
            </div>
          </div>
        )}
        <ErrorBoundary>
          <Suspense fallback={<PageLoader />}>
            <Router hash={hash} deploymentReady={deployment.ok} />
          </Suspense>
        </ErrorBoundary>
      </main>
      <AppFooter />
      <ToastContainer />
    </div>
  );
}
