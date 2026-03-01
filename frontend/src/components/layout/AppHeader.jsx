import React, { useState, useEffect } from 'react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount } from 'wagmi';
import { theme as t } from '@/styles/theme.js';
import { useDisplayName } from '@/hooks/useIdentity.js';
import { getAvatarSrc } from '@/hooks/useAvatar.js';

// ── Logo Mark — new design: deep purple square with gradient glow + N mark ────
function LogoMark({ size = 30 }) {
  const id = 'nwglow';
  return (
    <svg width={size} height={size} viewBox='0 0 32 32' fill='none' aria-hidden='true'>
      <defs>
        <radialGradient id={id} cx='50%' cy='60%' r='55%'>
          <stop offset='0%' stopColor='#7c3aed' stopOpacity='0.3'/>
          <stop offset='100%' stopColor='#7c3aed' stopOpacity='0'/>
        </radialGradient>
      </defs>
      {/* Background — near-black with deep purple undertone */}
      <rect width='32' height='32' rx='8' fill='#0c0018'/>
      <rect width='32' height='32' rx='8' fill={'url(#' + id + ')'}/>
      {/* N letterform: left=white, diagonal=violet, right=white */}
      <line x1='9'  y1='22' x2='9'  y2='10' stroke='#f0f0f0' strokeWidth='2.5' strokeLinecap='round'/>
      <line x1='9'  y1='10' x2='23' y2='22' stroke='#a78bfa' strokeWidth='2.5' strokeLinecap='round'/>
      <line x1='23' y1='10' x2='23' y2='22' stroke='#f0f0f0' strokeWidth='2.5' strokeLinecap='round'/>
      {/* Accent dot — top-right of N */}
      <circle cx='23' cy='10' r='2' fill='#c4b5fd'/>
    </svg>
  );
}

// ── Nav Link ──────────────────────────────────────────────────────────────────────────────
function NavLink({ href, label, active }) {
  const [hov, setHov] = useState(false);
  return (
    <a
      href={href}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        fontSize: '13px',
        fontWeight: active ? 500 : 420,
        letterSpacing: '-0.015em',
        color: active ? '#f0f0f0' : hov ? '#c0c0c8' : '#58585e',
        textDecoration: 'none',
        padding: '4px 0',
        position: 'relative',
        whiteSpace: 'nowrap',
        transition: 'color 0.12s ease',
      }}
    >
      {label}
      {active && (
        <span style={{
          position: 'absolute',
          bottom: '-1px',
          left: 0,
          width: '100%',
          height: '1px',
          background: t.colors.violet[600],
          borderRadius: '1px',
        }}/>
      )}
    </a>
  );
}

// ── Profile Avatar ────────────────────────────────────────────────────────────────────────
function ProfileAvatar({ address }) {
  const [hov, setHov] = useState(false);
  const [imgErr, setImgErr] = useState(false);
  const { username } = useDisplayName(address);
  const avatarSrc = getAvatarSrc(address);
  const initials = username
    ? username.slice(0, 2).toUpperCase()
    : address ? address.slice(2, 4).toUpperCase() : '??';
  const hue = address ? parseInt(address.slice(2, 6), 16) % 360 : 200;

  return (
    <button
      onClick={() => { window.location.hash = '#/profile'; }}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      title='My Profile'
      style={{
        width: '32px',
        height: '32px',
        borderRadius: '7px',
        background: hov ? `hsl(${hue},38%,18%)` : `hsl(${hue},30%,12%)`,
        border: `1px solid ${hov ? `hsl(${hue},48%,38%)` : `hsl(${hue},25%,22%)`}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: t.fonts.mono,
        fontSize: '10px',
        fontWeight: 700,
        color: `hsl(${hue},60%,60%)`,
        cursor: 'pointer',
        transition: t.transition,
        flexShrink: 0,
        outline: 'none',
        overflow: 'hidden',
        padding: 0,
      }}
    >
      {avatarSrc && !imgErr ? (
        <img
          src={avatarSrc}
          alt=""
          onError={() => setImgErr(true)}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
      ) : initials}
    </button>
  );
}

// ── AppHeader ─────────────────────────────────────────────────────────────────────────────────
export default function AppHeader() {
  const [scrolled, setScrolled] = useState(false);
  const [hash, setHash]         = useState(typeof window !== 'undefined' ? window.location.hash : '');
  const { address, isConnected } = useAccount();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    const onHash   = () => setHash(window.location.hash || '#/');
    window.addEventListener('scroll',     onScroll, { passive: true });
    window.addEventListener('hashchange', onHash);
    return () => {
      window.removeEventListener('scroll',     onScroll);
      window.removeEventListener('hashchange', onHash);
    };
  }, []);

  const isRoot    = hash === '#/' || hash === '' || hash === '#';
  const isProfile = hash.startsWith('#/profile');

  return (
    <header style={{
      position: 'fixed',
      top: 0, left: 0, right: 0,
      zIndex: t.z.header,
      height: '60px',
      background: scrolled ? 'rgba(8,8,8,0.96)' : 'rgba(8,8,8,0)',
      borderBottom: `1px solid ${scrolled ? '#1e1e26' : 'transparent'}`,
      backdropFilter: scrolled ? 'blur(20px) saturate(180%)' : 'none',
      transition: 'background 0.22s ease, border-color 0.22s ease, backdrop-filter 0.22s ease',
    }}>
      <div className='container' style={{
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '24px',
      }}>

        {/* Logo */}
        <a href='/#/' style={{
          textDecoration: 'none',
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
        }}>
          <LogoMark size={30} />
          <div style={{ display: 'flex', alignItems: 'baseline', userSelect: 'none' }}>
            <span style={{
              fontFamily: t.fonts.body,
              fontWeight: 200,
              fontSize: '17px',
              letterSpacing: '-0.03em',
              color: 'rgba(240,240,240,0.35)',
              lineHeight: 1,
            }}>nad</span>
            <span style={{
              fontFamily: t.fonts.body,
              fontWeight: 860,
              fontSize: '17px',
              letterSpacing: '-0.04em',
              color: '#f0f0f0',
              lineHeight: 1,
            }}>work</span>
          </div>
        </a>

        {/* Right side: nav + connect + avatar */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '20px',
          flexShrink: 0,
        }}>
          {/* Nav links */}
          <nav style={{ display: 'flex', gap: '18px', alignItems: 'center' }}>
            <NavLink href='/#/'            label='Bounties'    active={isRoot} />
            <NavLink href='/#/post'        label='Post'        active={hash === '#/post'} />
            <NavLink href='/#/leaderboard' label='Leaderboard' active={hash.startsWith('#/leaderboard')} />
            <NavLink href='/#/dashboard'   label='Dashboard'   active={hash.startsWith('#/dashboard')} />
            {isConnected && (
              <NavLink href='/#/profile' label='Profile' active={isProfile} />
            )}
          </nav>

          {/* Divider */}
          <div style={{
            width: '1px', height: '18px',
            background: '#1e1e26',
            flexShrink: 0,
          }}/>

          {/* Connect + Avatar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ConnectButton
              showBalance={false}
              chainStatus='icon'
              accountStatus='address'
            />
            {isConnected && address && (
              <ProfileAvatar address={address} />
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
