import { useState, useEffect } from 'react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount } from 'wagmi';
import { theme } from '../../styles/theme';
import { ADDRESSES } from '../../config/contracts';
import { NETWORK_LABEL } from '../../config/network.js';
import { useGlobalStats } from '../../hooks/useGlobalStats';
import { usePendingClaims } from '../../hooks/usePendingClaims';
import { LogoLockup } from '../common/Logo';
import NotificationBell from '../common/NotificationBell';

// ── Ticker item ───────────────────────────────────────────────────────────────
function TickerItem({ label, value }) {
  return (
    <span style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
      <span style={{
        fontFamily: theme.fonts.mono, fontSize: 11,
        color: theme.colors.text.muted,
        letterSpacing: '0.07em', textTransform: 'uppercase',
      }}>{label}</span>
      <span style={{
        fontFamily: theme.fonts.mono, fontSize: 11,
        color: theme.colors.text.secondary, letterSpacing: '0.03em',
      }}>{value}</span>
    </span>
  );
}

// ── Nav link ──────────────────────────────────────────────────────────────────
function NavLink({ label, href, active, onClick }) {
  const [hov, setHov] = useState(false);
  return (
    <a
      href={href}
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        fontFamily: theme.fonts.body,
        fontSize: 14,
        fontWeight: active ? 600 : 400,
        color: active ? theme.colors.text.primary : hov ? theme.colors.text.primary : theme.colors.text.secondary,
        letterSpacing: '-0.01em',
        transition: theme.transition,
        cursor: 'pointer',
        position: 'relative',
        paddingBottom: 2,
      }}
    >
      {label}
      {active && (
        <span style={{
          position: 'absolute', bottom: -2, left: 0, right: 0,
          height: 1.5, background: theme.colors.primary,
          borderRadius: 999,
        }} />
      )}
    </a>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function AppHeader() {
  const { address } = useAccount();
  const [route, setRoute] = useState(window.location.hash || '#/');
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { bountyCount, submissionCount } = useGlobalStats();
  const { hasPending, totalPending, formatMon } = usePendingClaims();

  // Config / env validation (critical contract addresses)
  const requiredKeys = ['factory', 'registry', 'escrow', 'reputation', 'identity'];
  const missingKeys = requiredKeys.filter((key) => {
    const val = ADDRESSES[key];
    if (!val) return true;
    const lower = String(val).toLowerCase();
    return lower === '0x0000000000000000000000000000000000000000';
  });
  const hasConfigError = missingKeys.length > 0;

  // Short factory address for ticker display
  const factoryAddr = ADDRESSES.factory
    ? `${ADDRESSES.factory.slice(0, 6)}…${ADDRESSES.factory.slice(-4)}`
    : '—';

  // Track route
  useEffect(() => {
    const onHash = () => setRoute(window.location.hash || '#/');
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  // Track scroll for subtle header shadow
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const adminWallets = (import.meta.env.VITE_ADMIN_WALLETS || '')
    .split(',')
    .map((a) => a.trim().toLowerCase())
    .filter(Boolean);
  const isAdmin = address && adminWallets.includes(address.toLowerCase());

  const nav = [
    { label: 'Explore',     href: '#/bounties'     },
    { label: 'Leaderboard', href: '#/leaderboard'  },
    { label: 'Dashboard',   href: '#/dashboard'    },
    ...(address ? [{ label: 'Account', href: `#/profile/${address}` }] : []),
    ...(isAdmin ? [{ label: 'Admin', href: '#/admin' }] : []),
    { label: 'Help',        href: '#/help'         },
  ];

  const isActive = (href) => {
    if (href === '#/') return route === '#/' || route === '#' || route === '';
    if (href.startsWith('#/profile/')) return route.startsWith('#/profile');
    if (href === '#/bounties') return route === '#/bounties';
    return route.startsWith(href);
  };

  return (
    <>
      {hasConfigError && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: theme.z.header + 1,
          background: '#3b0d0d',
          borderBottom: '1px solid #7f1d1d',
          color: '#fecaca',
          fontFamily: theme.fonts.mono,
          fontSize: 11,
          padding: '6px 20px',
          textAlign: 'center',
        }}>
          Config error: missing contract addresses&nbsp;
          <span style={{ opacity: 0.9 }}>({missingKeys.join(', ') || 'unknown'})</span>. Check VITE_* env or addresses.json.
        </div>
      )}

      {/* ── Fixed header ── */}
      <header style={{
        position: 'fixed',
        top: hasConfigError ? 24 : 0,
        left: 0,
        right: 0,
        zIndex: theme.z.header,
        background: scrolled
          ? 'rgba(15,15,15,0.96)'
          : 'rgba(15,15,15,0.92)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        borderBottom: `1px solid ${scrolled ? theme.colors.border.subtle : theme.colors.border.faint}`,
        transition: theme.transition,
      }}>

        {/* Main nav row */}
        <div style={{
          height: 68,
          display: 'flex', alignItems: 'center', gap: 36,
          padding: '0 clamp(20px,4vw,56px)',
          maxWidth: 1440, margin: '0 auto',
        }}>
          {/* Logo */}
          <a href="#/" style={{ textDecoration: 'none', flexShrink: 0 }}>
            <LogoLockup sealSize={26} fontSize={17} color={theme.colors.text.primary} />
          </a>

          {/* Nav links — desktop */}
          <nav className="hide-mobile" style={{ display: 'flex', gap: 28, flex: 1 }}>
            {nav.map(n => (
              <NavLink key={n.href} {...n} active={isActive(n.href)} />
            ))}
          </nav>

          {/* Spacer on mobile */}
          <div style={{ flex: 1 }} className="hide-desktop" />

          {/* Right side */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
            {/* Claim pill — when user has pending payouts */}
            {address && hasPending && (
              <a
                href="#/dashboard"
                onClick={(e) => { e.preventDefault(); window.location.hash = '#/dashboard'; }}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '6px 12px',
                  background: theme.colors.amberDim,
                  border: `1px solid ${theme.colors.amberBorder}`,
                  borderRadius: theme.radius.md,
                  fontFamily: theme.fonts.mono, fontSize: 11, fontWeight: 600,
                  color: theme.colors.amber,
                  textDecoration: 'none',
                  transition: theme.transition,
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(251,191,36,0.15)'; e.currentTarget.style.borderColor = theme.colors.amber; }}
                onMouseLeave={e => { e.currentTarget.style.background = theme.colors.amberDim; e.currentTarget.style.borderColor = theme.colors.amberBorder; }}
              >
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: theme.colors.amber, flexShrink: 0 }} />
                Claim {formatMon(totalPending)} MON
              </a>
            )}
            {/* Notification bell — only when wallet is connected */}
            {address && <NotificationBell />}

            {/* RainbowKit connect button — custom styled */}
            <ConnectButton.Custom>
              {({ account, chain, openAccountModal, openChainModal, openConnectModal, mounted: rkMounted }) => {
                const ready = rkMounted;
                const connected = ready && account && chain;
                return (
                  <button
                    onClick={connected ? openAccountModal : openConnectModal}
                    style={{
                      padding: connected ? '8px 16px' : '8px 20px',
                      background: connected ? theme.colors.bg.elevated : theme.colors.primary,
                      color: connected ? theme.colors.text.primary : '#ffffff',
                      border: connected ? `1px solid ${theme.colors.border.strong}` : 'none',
                      borderRadius: theme.radius.md,
                      fontSize: 13,
                      fontFamily: theme.fonts.body,
                      fontWeight: 600,
                      letterSpacing: '-0.01em',
                      cursor: 'pointer',
                      boxShadow: connected ? 'none' : `0 2px 16px ${theme.colors.primaryGlow}`,
                      transition: theme.transition,
                      display: 'flex', alignItems: 'center', gap: 7,
                    }}
                    onMouseEnter={e => {
                      if (connected) { e.currentTarget.style.borderColor = theme.colors.primary; e.currentTarget.style.color = '#fff'; e.currentTarget.style.background = theme.colors.bg.hover; }
                      else { e.currentTarget.style.background = theme.colors.primaryHover; }
                    }}
                    onMouseLeave={e => {
                      if (connected) { e.currentTarget.style.borderColor = theme.colors.border.strong; e.currentTarget.style.color = theme.colors.text.primary; e.currentTarget.style.background = theme.colors.bg.elevated; }
                      else { e.currentTarget.style.background = theme.colors.primary; }
                    }}
                  >
                    {connected ? (
                      <>
                        <span style={{ width: 7, height: 7, borderRadius: '50%', background: theme.colors.green[400], boxShadow: `0 0 6px ${theme.colors.green[400]}` }} />
                        {account.displayName}
                        <span style={{ color: theme.colors.text.muted, fontSize: 11 }}>▾</span>
                      </>
                    ) : 'Connect Wallet'}
                  </button>
                );
              }}
            </ConnectButton.Custom>

            {/* Mobile hamburger */}
            <button
              className="hide-desktop"
              onClick={() => setMobileOpen(o => !o)}
              style={{
                width: 38, height: 38, display: 'flex',
                flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                gap: 5, background: 'none', border: 'none', cursor: 'pointer', padding: 4,
              }}
            >
              {[0,1,2].map(i => (
                <span key={i} style={{
                  display: 'block', width: 20, height: 1.5,
                  background: theme.colors.text.secondary,
                  borderRadius: 999,
                  transition: theme.transition,
                  transformOrigin: 'center',
                  transform: mobileOpen
                    ? i === 0 ? 'rotate(45deg) translate(4px, 4px)'
                    : i === 2 ? 'rotate(-45deg) translate(4px, -4px)'
                    : 'scaleX(0)'
                    : 'none',
                }} />
              ))}
            </button>
          </div>
        </div>

        {/* ── Ticker strip ── */}
        <div style={{
          borderTop: `1px solid ${theme.colors.border.subtle}`,
          padding: '0 clamp(20px,4vw,56px)',
          height: 38,
          display: 'flex', alignItems: 'center', gap: 16,
          overflow: 'hidden',
          maxWidth: 1440, margin: '0 auto',
        }}
          className="hide-mobile"
        >
          {/* Live dot */}
          <div style={{
            width: 6, height: 6, borderRadius: '50%',
            background: theme.colors.primary, flexShrink: 0,
            boxShadow: `0 0 8px ${theme.colors.primaryGlow}`,
            animation: 'livePulse 2s ease infinite',
          }} />

          <div style={{ display: 'flex', gap: 28, alignItems: 'center', overflow: 'hidden' }}>
            <TickerItem label="Contract"    value={factoryAddr} />
            <TickerItem label="Network" value={NETWORK_LABEL} />
            <TickerItem label="Bounties"    value={bountyCount    != null ? String(bountyCount)    : '—'} />
            <TickerItem label="Submissions" value={submissionCount != null ? String(submissionCount) : '—'} />
          </div>
        </div>

        {/* ── Mobile nav dropdown ── */}
        {mobileOpen && (
          <div style={{
            borderTop: `1px solid ${theme.colors.border.subtle}`,
            padding: '16px 20px 24px',
            display: 'flex', flexDirection: 'column', gap: 4,
            background: theme.colors.bg.glass,
          }}>
            {nav.map(n => (
              <a
                key={n.href}
                href={n.href}
                onClick={() => setMobileOpen(false)}
                style={{
                  fontFamily: theme.fonts.body, fontSize: 15,
                  fontWeight: isActive(n.href) ? 600 : 400,
                  color: isActive(n.href) ? theme.colors.text.primary : theme.colors.text.secondary,
                  padding: '11px 14px', borderRadius: theme.radius.md,
                  background: isActive(n.href) ? theme.colors.bg.elevated : 'transparent',
                  transition: theme.transition,
                }}
              >
                {n.label}
              </a>
            ))}
          </div>
        )}
      </header>

      <style>{`
        @media (min-width: 769px) { .hide-desktop { display: none !important; } }
        @media (max-width: 768px) { .hide-mobile  { display: none !important; } }
      `}</style>
    </>
  );
}

