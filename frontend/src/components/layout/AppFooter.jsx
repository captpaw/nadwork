import React from 'react';
import { theme as t } from '@/styles/theme.js';

function FooterMark({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <defs>
        <radialGradient id="fw-glow" cx="50%" cy="60%" r="55%">
          <stop offset="0%" stopColor="#7c3aed" stopOpacity="0.3"/>
          <stop offset="100%" stopColor="#7c3aed" stopOpacity="0"/>
        </radialGradient>
      </defs>
      <rect width="32" height="32" rx="8" fill="#0c0018"/>
      <rect width="32" height="32" rx="8" fill="url(#fw-glow)"/>
      <line x1="9"  y1="22" x2="9"  y2="10" stroke="#f0f0f0" strokeWidth="2.5" strokeLinecap="round"/>
      <line x1="9"  y1="10" x2="23" y2="22" stroke="#a78bfa" strokeWidth="2.5" strokeLinecap="round"/>
      <line x1="23" y1="10" x2="23" y2="22" stroke="#f0f0f0" strokeWidth="2.5" strokeLinecap="round"/>
      <circle cx="23" cy="10" r="2" fill="#c4b5fd"/>
    </svg>
  );
}

export default function AppFooter() {
  const links = [
    { label: 'Help & FAQ',   href: '/#/help' },
    { label: 'Telegram',     href: 'https://t.me/nadwork', external: true },
    { label: 'Twitter / X',  href: 'https://twitter.com/nadwork', external: true },
  ];

  return (
    <footer style={{
      borderTop: '1px solid ' + t.colors.border.subtle,
      background: t.colors.bg.base,
      padding: '20px 0',
      marginTop: 'auto',
    }}>
      <div className="container" style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px',
      }}>

        {/* Logo + tagline */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <FooterMark size={18} />
          <span style={{
            fontWeight: 200, fontSize: '13px', letterSpacing: '-0.03em',
            color: 'rgba(240,240,240,0.28)', lineHeight: 1,
          }}>nad</span>
          <span style={{
            fontWeight: 800, fontSize: '13px', letterSpacing: '-0.03em',
            color: 'rgba(240,240,240,0.6)', lineHeight: 1, marginLeft: '-6px',
          }}>work</span>
          <span style={{ fontSize: '11px', color: t.colors.text.muted, marginLeft: '4px' }}>
            Work. Win. Earn. — Built on Monad
          </span>
        </div>

        {/* Links + copyright */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap' }}>
          {links.map(l => (
            <a
              key={l.label}
              href={l.href}
              target={l.external ? '_blank' : undefined}
              rel={l.external ? 'noopener noreferrer' : undefined}
              style={{
                fontSize: '11.5px', color: t.colors.text.muted,
                textDecoration: 'none', letterSpacing: '-0.005em',
                transition: 'color 0.12s ease',
              }}
              onMouseEnter={e => e.currentTarget.style.color = t.colors.text.secondary}
              onMouseLeave={e => e.currentTarget.style.color = t.colors.text.muted}
            >
              {l.label}
            </a>
          ))}
          <span style={{ fontSize: '11px', color: t.colors.text.muted, fontFamily: t.fonts.mono }}>
            © 2026 NadWork
          </span>
        </div>

      </div>
    </footer>
  );
}
