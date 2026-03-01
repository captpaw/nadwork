/* eslint-disable */
const fs = require("fs");
const path = require("path");
const src = path.join(__dirname, "..", "frontend", "src");

function write(relPath, content) {
  const fullPath = path.join(src, relPath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, content, "utf8");
  console.log("  wrote:", relPath);
}

// ─── theme.js ────────────────────────────────────────────
write("styles/theme.js", `export const theme = {
  colors: {
    primary:   '#6366f1',
    secondary: '#8b5cf6',
    accent:    '#10b981',
    danger:    '#ef4444',
    warning:   '#f59e0b',

    bg: {
      darkest: '#09090b',
      dark:    '#111113',
      card:    '#18181b',
      overlay: 'rgba(0,0,0,0.75)',
      surface: 'rgba(99,102,241,0.06)',
      hover:   '#1f1f23',
    },

    text: {
      primary:   '#fafafa',
      secondary: '#a1a1aa',
      muted:     '#52525b',
      white:     '#ffffff',
      accent:    '#6366f1',
    },

    border: {
      default: '#27272a',
      hover:   '#3f3f46',
      active:  '#6366f1',
      subtle:  '#1c1c1f',
    },

    glow: {
      gold: 'none', goldStrong: 'none',
      violet: 'none', emerald: 'none', red: 'none',
    },

    status: {
      active:    '#10b981',
      reviewing: '#f59e0b',
      completed: '#6366f1',
      expired:   '#52525b',
      cancelled: '#ef4444',
      open:      '#10b981',
      firstCome: '#f59e0b',
    },
  },

  fonts: {
    display: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    body:    "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    mono:    "'DM Mono', 'Fira Code', monospace",
    number:  "'Inter', sans-serif",
  },

  radius: { sm: '6px', md: '10px', lg: '14px', xl: '18px' },

  shadow: {
    sm: '0 1px 3px rgba(0,0,0,0.3)',
    md: '0 4px 12px rgba(0,0,0,0.4)',
    lg: '0 8px 32px rgba(0,0,0,0.5)',
  },

  transition: 'all 0.15s ease',
};

export default theme;
`);

// ─── index.css ────────────────────────────────────────────
write("styles/index.css", `*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

:root {
  --bg:        #09090b;
  --bg-card:   #18181b;
  --bg-hover:  #1f1f23;
  --primary:   #6366f1;
  --text:      #fafafa;
  --text-2:    #a1a1aa;
  --text-3:    #52525b;
  --border:    #27272a;
  --border-h:  #3f3f46;
  --font:      'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
  --mono:      'DM Mono', 'Fira Code', monospace;
}

html { scroll-behavior: smooth; }

body {
  background: var(--bg);
  color: var(--text);
  font-family: var(--font);
  font-size: 14px;
  line-height: 1.6;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  overflow-x: hidden;
}

/* Scrollbar */
::-webkit-scrollbar       { width: 5px; }
::-webkit-scrollbar-track { background: var(--bg); }
::-webkit-scrollbar-thumb { background: #3f3f46; border-radius: 99px; }
::-webkit-scrollbar-thumb:hover { background: #52525b; }

/* Selection */
::selection { background: rgba(99,102,241,0.2); color: #fafafa; }

/* App layout */
.app         { min-height: 100vh; display: flex; flex-direction: column; }
.app-content { flex: 1; padding-top: 65px; }

/* Container */
.container    { max-width: 1200px; margin: 0 auto; padding: 0 clamp(1rem, 4vw, 2rem); }
.container-sm { max-width: 760px;  margin: 0 auto; padding: 0 clamp(1rem, 4vw, 2rem); }

/* RainbowKit override */
[data-rk] { font-family: var(--font) !important; }

/* Animations */
@keyframes fadeUp {
  from { opacity: 0; transform: translateY(12px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes fadeIn {
  from { opacity: 0; }
  to   { opacity: 1; }
}
@keyframes spin {
  to { transform: rotate(360deg); }
}
`);

// ─── index.html ────────────────────────────────────────────
const fontsUrl =
  "https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=DM+Mono:wght@400;500&display=swap";

const html = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="description" content="NadWork — The on-chain bounty platform for Monad builders. Hunt. Submit. Earn." />
    <meta property="og:title" content="NadWork — Hunt. Submit. Earn." />
    <meta property="og:description" content="Post tasks, submit work, earn MON on Monad." />
    <meta property="og:url" content="https://NadWork.xyz" />
    <title>NadWork — Hunt. Submit. Earn.</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="${fontsUrl}" rel="stylesheet" />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
`;
fs.writeFileSync(path.join(__dirname, "..", "frontend", "index.html"), html, "utf8");
console.log("  wrote: index.html");

// ─── AppHeader.jsx ────────────────────────────────────────
write("components/layout/AppHeader.jsx", `import React, { useState, useEffect } from 'react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { theme as t } from '@/styles/theme.js';

function NavLink({ href, label, active }) {
  const [hov, setHov] = useState(false);
  return (
    <a href={href} style={{
      fontFamily: t.fonts.body,
      fontWeight: 500,
      fontSize: '14px',
      color: active ? t.colors.text.primary : hov ? t.colors.text.secondary : t.colors.text.muted,
      textDecoration: 'none',
      padding: '4px 0',
      transition: t.transition,
      borderBottom: active ? '2px solid ' + t.colors.primary : '2px solid transparent',
    }}
    onMouseEnter={() => setHov(true)}
    onMouseLeave={() => setHov(false)}>
      {label}
    </a>
  );
}

export default function AppHeader() {
  const [scrolled, setScrolled] = useState(false);
  const hash = typeof window !== 'undefined' ? window.location.hash : '';

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', fn, { passive: true });
    return () => window.removeEventListener('scroll', fn);
  }, []);

  return (
    <header style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
      height: '65px',
      background: scrolled ? 'rgba(9,9,11,0.95)' : '#09090b',
      borderBottom: '1px solid ' + (scrolled ? t.colors.border.default : 'transparent'),
      backdropFilter: scrolled ? 'blur(12px)' : 'none',
      transition: t.transition,
    }}>
      <div className="container" style={{ height: '100%', display: 'flex', alignItems: 'center', gap: '40px' }}>
        {/* Logo */}
        <a href="/#/" style={{ textDecoration: 'none', flexShrink: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{
            width: '28px', height: '28px', borderRadius: '8px',
            background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '14px', fontWeight: 700, color: '#fff',
            fontFamily: t.fonts.body,
          }}>N</div>
          <span style={{
            fontFamily: t.fonts.body, fontWeight: 700, fontSize: '16px',
            color: t.colors.text.primary, letterSpacing: '-0.02em',
          }}>NadWork</span>
        </a>

        {/* Nav */}
        <nav style={{ display: 'flex', gap: '28px', flex: 1 }}>
          <NavLink href="/#/"            label="Bounties"   active={hash === '#/' || hash === '' || hash === '#'} />
          <NavLink href="/#/post"        label="Post"       active={hash === '#/post'} />
          <NavLink href="/#/leaderboard" label="Leaderboard"active={hash === '#/leaderboard'} />
          <NavLink href="/#/dashboard"   label="Dashboard"  active={hash === '#/dashboard'} />
        </nav>

        {/* Wallet */}
        <div style={{ flexShrink: 0 }}>
          <ConnectButton />
        </div>
      </div>
    </header>
  );
}
`);

// ─── AppFooter.jsx ────────────────────────────────────────
write("components/layout/AppFooter.jsx", `import React from 'react';
import { theme as t } from '@/styles/theme.js';

export default function AppFooter() {
  return (
    <footer style={{
      borderTop: '1px solid ' + t.colors.border.default,
      padding: 'clamp(1.5rem, 3vw, 2rem) 0',
      marginTop: 'auto',
    }}>
      <div className="container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ width: '20px', height: '20px', borderRadius: '6px', background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700, color: '#fff' }}>N</div>
          <span style={{ fontWeight: 600, fontSize: '14px', color: t.colors.text.secondary }}>NadWork</span>
        </div>
        <span style={{ fontSize: '13px', color: t.colors.text.muted }}>
          Hunt. Submit. Earn. — Built on{' '}
          <a href="https://monad.xyz" target="_blank" rel="noopener" style={{ color: t.colors.text.secondary, textDecoration: 'none' }}>Monad</a>
        </span>
        <span style={{ fontSize: '12px', color: t.colors.text.muted }}>© 2026 NadWork</span>
      </div>
    </footer>
  );
}
`);

// ─── Button.jsx ────────────────────────────────────────────
write("components/common/Button.jsx", `import React, { useState } from 'react';
import { theme as t } from '@/styles/theme.js';

const variants = {
  primary: {
    bg: '#6366f1', color: '#fff', border: 'none',
    hover: { bg: '#4f46e5' },
  },
  secondary: {
    bg: 'transparent', color: t.colors.text.primary,
    border: '1px solid ' + t.colors.border.hover,
    hover: { bg: t.colors.bg.hover },
  },
  ghost: {
    bg: 'transparent', color: t.colors.text.secondary,
    border: '1px solid transparent',
    hover: { bg: t.colors.bg.hover, color: t.colors.text.primary },
  },
  danger: {
    bg: 'transparent', color: t.colors.danger,
    border: '1px solid rgba(239,68,68,0.3)',
    hover: { bg: 'rgba(239,68,68,0.08)' },
  },
  violet: {
    bg: '#8b5cf6', color: '#fff', border: 'none',
    hover: { bg: '#7c3aed' },
  },
};

const sizes = {
  sm: { padding: '6px 14px',  fontSize: '13px', height: '34px' },
  md: { padding: '8px 18px',  fontSize: '14px', height: '40px' },
  lg: { padding: '11px 24px', fontSize: '15px', height: '46px' },
};

export default function Button({ children, variant = 'primary', size = 'md', disabled, loading, fullWidth, style, onClick, ...props }) {
  const [hov, setHov] = useState(false);
  const v = variants[variant] || variants.primary;
  const s = sizes[size] || sizes.md;

  return (
    <button
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
        fontFamily: t.fonts.body, fontWeight: 500, letterSpacing: '-0.01em',
        cursor: disabled || loading ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.45 : 1,
        borderRadius: t.radius.md,
        transition: t.transition,
        whiteSpace: 'nowrap',
        width: fullWidth ? '100%' : 'auto',
        border: v.border || 'none',
        background: hov && !disabled ? (v.hover.bg || v.bg) : v.bg,
        color: hov && !disabled ? (v.hover.color || v.color) : v.color,
        boxShadow: 'none',
        ...s, ...style,
      }}
      disabled={disabled || loading}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      onClick={onClick}
      {...props}
    >
      {loading ? (
        <svg width="16" height="16" viewBox="0 0 24 24" style={{ animation: 'spin 0.7s linear infinite' }}>
          <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="2.5" strokeDasharray="31" strokeDashoffset="8" strokeLinecap="round" />
        </svg>
      ) : children}
    </button>
  );
}
`);

// ─── Card.jsx ────────────────────────────────────────────
write("components/common/Card.jsx", `import React, { useState } from 'react';
import { theme as t } from '@/styles/theme.js';

export default function Card({ children, style, hoverable, onClick, padding, glow }) {
  const [hov, setHov] = useState(false);

  return (
    <div
      style={{
        background: t.colors.bg.card,
        border: '1px solid ' + (hov && hoverable ? t.colors.border.hover : t.colors.border.default),
        borderRadius: t.radius.lg,
        padding: padding !== undefined ? padding : 'clamp(1rem, 3vw, 1.5rem)',
        transition: t.transition,
        cursor: onClick ? 'pointer' : 'default',
        boxShadow: t.shadow.sm,
        transform: hoverable && hov ? 'translateY(-1px)' : 'none',
        ...style,
      }}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      onClick={onClick}
    >
      {children}
    </div>
  );
}
`);

// ─── Badge.jsx ────────────────────────────────────────────
write("components/common/Badge.jsx", `import React from 'react';

const STYLES = {
  active:    { bg: 'rgba(16,185,129,0.12)',  color: '#34d399', border: 'rgba(16,185,129,0.2)'  },
  completed: { bg: 'rgba(99,102,241,0.12)',  color: '#818cf8', border: 'rgba(99,102,241,0.2)'  },
  expired:   { bg: 'rgba(82,82,91,0.15)',    color: '#71717a', border: 'rgba(82,82,91,0.2)'    },
  cancelled: { bg: 'rgba(239,68,68,0.1)',    color: '#f87171', border: 'rgba(239,68,68,0.2)'   },
  reviewing: { bg: 'rgba(245,158,11,0.1)',   color: '#fbbf24', border: 'rgba(245,158,11,0.2)'  },
  open:      { bg: 'rgba(16,185,129,0.12)',  color: '#34d399', border: 'rgba(16,185,129,0.2)'  },
  first_come:{ bg: 'rgba(245,158,11,0.1)',   color: '#fbbf24', border: 'rgba(245,158,11,0.2)'  },
  pending:   { bg: 'rgba(245,158,11,0.1)',   color: '#fbbf24', border: 'rgba(245,158,11,0.2)'  },
  approved:  { bg: 'rgba(16,185,129,0.12)',  color: '#34d399', border: 'rgba(16,185,129,0.2)'  },
  rejected:  { bg: 'rgba(239,68,68,0.1)',    color: '#f87171', border: 'rgba(239,68,68,0.2)'   },
  dev:       { bg: 'rgba(99,102,241,0.12)',  color: '#818cf8', border: 'rgba(99,102,241,0.2)'  },
  design:    { bg: 'rgba(236,72,153,0.1)',   color: '#f472b6', border: 'rgba(236,72,153,0.2)'  },
  content:   { bg: 'rgba(6,182,212,0.1)',    color: '#22d3ee', border: 'rgba(6,182,212,0.2)'   },
  research:  { bg: 'rgba(245,158,11,0.1)',   color: '#fbbf24', border: 'rgba(245,158,11,0.2)'  },
  marketing: { bg: 'rgba(16,185,129,0.12)',  color: '#34d399', border: 'rgba(16,185,129,0.2)'  },
};

export default function Badge({ type, label, style }) {
  const key = (type || '').toLowerCase().replace(/[-\s]/g, '_');
  const s   = STYLES[key] || { bg: 'rgba(255,255,255,0.06)', color: '#71717a', border: 'rgba(255,255,255,0.1)' };

  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      background: s.bg, color: s.color,
      border: '1px solid ' + s.border,
      padding: '2px 9px', borderRadius: '99px',
      fontSize: '11px', fontWeight: 500,
      whiteSpace: 'nowrap', letterSpacing: '0.01em',
      ...style,
    }}>
      {label || type}
    </span>
  );
}
`);

// ─── Input.jsx ────────────────────────────────────────────
write("components/common/Input.jsx", `import React, { useState } from 'react';
import { theme as t } from '@/styles/theme.js';

export default function Input({ label, error, hint, style, textarea, rows, ...props }) {
  const [focused, setFocused] = useState(false);

  const base = {
    width: '100%',
    background: t.colors.bg.darkest,
    border: '1px solid ' + (error ? t.colors.danger : focused ? t.colors.primary : t.colors.border.default),
    borderRadius: t.radius.md,
    padding: '9px 13px',
    color: t.colors.text.primary,
    fontFamily: t.fonts.body,
    fontSize: '14px',
    outline: 'none',
    transition: t.transition,
    boxShadow: focused && !error ? '0 0 0 3px rgba(99,102,241,0.15)' : 'none',
    resize: textarea ? 'vertical' : undefined,
    minHeight: textarea ? (rows ? rows * 22 + 20 + 'px' : '96px') : undefined,
    ...style,
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
      {label && <label style={{ fontSize: '13px', fontWeight: 500, color: t.colors.text.secondary }}>{label}</label>}
      {textarea
        ? <textarea style={base} rows={rows || 4} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} {...props} />
        : <input    style={base}                  onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} {...props} />
      }
      {error && <span style={{ fontSize: '12px', color: t.colors.danger }}>{error}</span>}
      {hint  && !error && <span style={{ fontSize: '12px', color: t.colors.text.muted }}>{hint}</span>}
    </div>
  );
}
`);

// ─── Modal.jsx ────────────────────────────────────────────
write("components/common/Modal.jsx", `import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { theme as t } from '@/styles/theme.js';

export default function Modal({ open, onClose, title, children, maxWidth = '560px' }) {
  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden';
    else      document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: t.colors.bg.overlay, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <motion.div
            onClick={e => e.stopPropagation()}
            initial={{ opacity: 0, scale: 0.97, y: 10 }}
            animate={{ opacity: 1, scale: 1,    y: 0  }}
            exit={{    opacity: 0, scale: 0.97, y: 10 }}
            transition={{ duration: 0.15 }}
            style={{
              background: '#111113',
              border: '1px solid ' + t.colors.border.default,
              borderRadius: t.radius.xl,
              padding: 'clamp(1.25rem, 4vw, 1.75rem)',
              width: '100%', maxWidth,
              maxHeight: '90vh', overflowY: 'auto',
              boxShadow: t.shadow.xl,
            }}
          >
            {title && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                <h2 style={{ fontWeight: 600, fontSize: '16px', color: t.colors.text.primary }}>{title}</h2>
                <button onClick={onClose} style={{ background: 'none', border: 'none', color: t.colors.text.muted, cursor: 'pointer', fontSize: '20px', lineHeight: 1, padding: '2px 6px', borderRadius: '4px' }}>×</button>
              </div>
            )}
            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
`);

// ─── Spinner.jsx ────────────────────────────────────────────
write("components/common/Spinner.jsx", `import React from 'react';
import { theme as t } from '@/styles/theme.js';

export default function Spinner({ size = 22, color }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{ animation: 'spin 0.7s linear infinite', display: 'block' }}>
      <circle cx="12" cy="12" r="10" fill="none" stroke={color || t.colors.primary} strokeWidth="2.5" strokeDasharray="31" strokeDashoffset="8" strokeLinecap="round" />
    </svg>
  );
}

export function PageLoader() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '50vh', flexDirection: 'column', gap: '14px' }}>
      <Spinner size={36} />
      <span style={{ fontSize: '13px', color: '#52525b' }}>Loading...</span>
    </div>
  );
}
`);

// ─── EmptyState.jsx ────────────────────────────────────────
write("components/common/EmptyState.jsx", `import React from 'react';
import { theme as t } from '@/styles/theme.js';
import Button from './Button.jsx';

export default function EmptyState({ icon, title, message, action, onAction }) {
  return (
    <div style={{ textAlign: 'center', padding: 'clamp(2.5rem, 8vw, 5rem)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
      {icon && <div style={{ fontSize: '2.5rem', marginBottom: '4px', opacity: 0.5 }}>{icon}</div>}
      <h3 style={{ fontWeight: 600, fontSize: '16px', color: t.colors.text.secondary }}>{title}</h3>
      {message && <p style={{ color: t.colors.text.muted, fontSize: '14px', maxWidth: '380px', lineHeight: 1.7 }}>{message}</p>}
      {action && onAction && <Button variant="secondary" style={{ marginTop: '8px' }} onClick={onAction}>{action}</Button>}
    </div>
  );
}
`);

// ─── Toast.jsx ────────────────────────────────────────────
write("components/common/Toast.jsx", `import React, { useState } from 'react';
import { theme as t } from '@/styles/theme.js';

let _set = null;
let _id  = 0;

export function toast(message, type = 'info', duration = 4500) {
  if (_set) {
    const id = ++_id;
    _set(p => [...p, { id, message, type }]);
    setTimeout(() => _set(p => p.filter(x => x.id !== id)), duration);
  }
}

export function ToastContainer() {
  const [items, setItems] = useState([]);
  _set = setItems;

  const icons   = { success: '✓', error: '✕', warning: '⚠', info: 'ℹ' };
  const colors  = { success: '#34d399', error: '#f87171', warning: '#fbbf24', info: '#818cf8' };
  const bgColor = { success: 'rgba(16,185,129,0.08)', error: 'rgba(239,68,68,0.08)', warning: 'rgba(245,158,11,0.08)', info: 'rgba(99,102,241,0.08)' };

  return (
    <div style={{ position: 'fixed', top: '76px', right: '16px', zIndex: 9998, display: 'flex', flexDirection: 'column', gap: '8px', maxWidth: '360px', width: 'calc(100vw - 32px)' }}>
      {items.map(item => (
        <div key={item.id} style={{
          display: 'flex', alignItems: 'flex-start', gap: '10px',
          background: '#18181b',
          border: '1px solid ' + t.colors.border.default,
          borderLeft: '3px solid ' + colors[item.type],
          borderRadius: t.radius.md,
          padding: '12px 14px',
          boxShadow: t.shadow.lg,
          animation: 'fadeUp 0.2s ease',
          background: bgColor[item.type],
        }}>
          <span style={{ color: colors[item.type], fontSize: '14px', flexShrink: 0, marginTop: '1px' }}>{icons[item.type]}</span>
          <span style={{ fontSize: '13px', color: t.colors.text.secondary, lineHeight: 1.5 }}>{item.message}</span>
        </div>
      ))}
    </div>
  );
}
`);

// ─── DeadlineTimer.jsx ────────────────────────────────────
write("components/bounty/DeadlineTimer.jsx", `import React, { useState, useEffect } from 'react';
import { theme as t } from '@/styles/theme.js';
import { isUrgent } from '@/utils/format.js';

export default function DeadlineTimer({ deadline }) {
  const [label, setLabel] = useState('');

  useEffect(() => {
    function update() {
      const diff = Number(deadline) - Math.floor(Date.now() / 1000);
      if (diff <= 0) { setLabel('Expired'); return; }
      const d = Math.floor(diff / 86400);
      const h = Math.floor((diff % 86400) / 3600);
      const m = Math.floor((diff % 3600) / 60);
      const s = diff % 60;
      if (d > 1) setLabel(d + 'd ' + h + 'h');
      else if (d === 1) setLabel('1d ' + h + 'h ' + m + 'm');
      else if (h > 0)   setLabel(h + 'h ' + m + 'm');
      else              setLabel(m + 'm ' + s + 's');
    }
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [deadline]);

  const urgent = isUrgent(deadline);
  return (
    <span style={{
      fontFamily: t.fonts.mono,
      fontSize: '12px',
      color: urgent ? '#f87171' : t.colors.text.muted,
      fontWeight: 500,
    }}>
      {label}
    </span>
  );
}
`);

// ─── BountyCard.jsx ────────────────────────────────────────
write("components/bounty/BountyCard.jsx", `import React, { useState, useEffect } from 'react';
import { theme as t } from '@/styles/theme.js';
import Card from '@/components/common/Card.jsx';
import Badge from '@/components/common/Badge.jsx';
import DeadlineTimer from './DeadlineTimer.jsx';
import { formatReward, shortAddr, categoryLabel } from '@/utils/format.js';
import { fetchJSON } from '@/config/pinata.js';
import { BOUNTY_STATUS } from '@/config/contracts.js';

export default function BountyCard({ bounty, onClick }) {
  const [meta, setMeta] = useState(null);

  useEffect(() => {
    if (bounty.ipfsHash) fetchJSON(bounty.ipfsHash).then(setMeta).catch(() => {});
  }, [bounty.ipfsHash]);

  const title     = meta?.title    || bounty.title    || 'Untitled Bounty';
  const category  = meta?.category || bounty.category || '';
  const statusKey = BOUNTY_STATUS[bounty.status]?.toLowerCase() || 'active';

  return (
    <Card hoverable onClick={onClick} style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {/* Top row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', flex: 1 }}>
          <Badge type={statusKey} label={statusKey.charAt(0).toUpperCase() + statusKey.slice(1)} />
          {category && <Badge type={category} label={categoryLabel(category)} />}
          <Badge type={bounty.bountyType === 1 ? 'first_come' : 'open'} label={bounty.bountyType === 1 ? 'First-Come' : 'Open'} />
        </div>
      </div>

      {/* Title */}
      <h3 style={{ fontWeight: 600, fontSize: '15px', color: t.colors.text.primary, lineHeight: 1.4, letterSpacing: '-0.01em' }}>
        {title.length > 72 ? title.slice(0, 72) + '…' : title}
      </h3>

      {/* Reward */}
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: '6px',
        background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)',
        borderRadius: t.radius.sm, padding: '4px 10px',
        fontSize: '14px', fontWeight: 600, color: '#818cf8',
        fontFamily: t.fonts.mono, alignSelf: 'flex-start',
      }}>
        {formatReward(bounty.totalReward, bounty.rewardType)}
        {bounty.winnerCount > 1 && <span style={{ fontSize: '11px', fontWeight: 400, color: '#6366f1' }}>·{bounty.winnerCount} winners</span>}
      </div>

      {/* Footer */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto', paddingTop: '4px', borderTop: '1px solid ' + t.colors.border.subtle }}>
        <span style={{ fontSize: '12px', color: t.colors.text.muted, fontFamily: t.fonts.mono }}>
          {shortAddr(bounty.poster)}
        </span>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <span style={{ fontSize: '12px', color: t.colors.text.muted }}>{String(bounty.submissionCount)} subs</span>
          {bounty.status === 0 && <DeadlineTimer deadline={bounty.deadline} />}
        </div>
      </div>
    </Card>
  );
}
`);

// ─── BountyFilter.jsx ────────────────────────────────────
write("components/bounty/BountyFilter.jsx", `import React from 'react';
import { theme as t } from '@/styles/theme.js';
import { CATEGORIES } from '@/config/contracts.js';
import { categoryLabel } from '@/utils/format.js';

function Chip({ label, active, onClick }) {
  const [hov, setHov] = React.useState(false);
  return (
    <button onClick={onClick} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)} style={{
      background: active ? '#6366f1' : hov ? t.colors.bg.hover : 'transparent',
      border: '1px solid ' + (active ? '#6366f1' : t.colors.border.default),
      color: active ? '#fff' : hov ? t.colors.text.primary : t.colors.text.secondary,
      fontSize: '13px', fontWeight: active ? 500 : 400,
      padding: '5px 13px', borderRadius: '99px',
      cursor: 'pointer', transition: t.transition,
      whiteSpace: 'nowrap',
    }}>{label}</button>
  );
}

export default function BountyFilter({ filters, onChange }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {/* Categories */}
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
        {['all', ...CATEGORIES].map(cat => (
          <Chip key={cat} label={cat === 'all' ? 'All' : categoryLabel(cat)} active={filters.category === cat} onClick={() => onChange({ ...filters, category: cat })} />
        ))}
      </div>

      {/* Status + Type + Sort */}
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
        {['all', 'active', 'completed', 'expired'].map(s => (
          <Chip key={s} label={s === 'all' ? 'All Status' : s.charAt(0).toUpperCase() + s.slice(1)} active={filters.status === s} onClick={() => onChange({ ...filters, status: s })} />
        ))}
        <div style={{ width: '1px', height: '20px', background: t.colors.border.default, margin: '0 2px' }} />
        {[{ v: 'all', l: 'All Types' }, { v: 'open', l: 'Open' }, { v: 'first_come', l: 'First-Come' }].map(tp => (
          <Chip key={tp.v} label={tp.l} active={filters.type === tp.v} onClick={() => onChange({ ...filters, type: tp.v })} />
        ))}
        <div style={{ flex: 1 }} />
        {[{ v: 'newest', l: 'Newest' }, { v: 'reward', l: 'Highest Reward' }, { v: 'ending', l: 'Ending Soon' }].map(s => (
          <Chip key={s.v} label={s.l} active={filters.sort === s.v} onClick={() => onChange({ ...filters, sort: s.v })} />
        ))}
      </div>
    </div>
  );
}
`);

// ─── HomePage.jsx ────────────────────────────────────────
write("pages/HomePage.jsx", `import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { theme as t } from '@/styles/theme.js';
import { useBounties } from '@/hooks/useBounties.js';
import { useGlobalStats } from '@/hooks/useGlobalStats.js';
import BountyCard from '@/components/bounty/BountyCard.jsx';
import BountyFilter from '@/components/bounty/BountyFilter.jsx';
import Button from '@/components/common/Button.jsx';
import { PageLoader } from '@/components/common/Spinner.jsx';
import EmptyState from '@/components/common/EmptyState.jsx';

export default function HomePage() {
  const [filters, setFilters] = useState({ category: 'all', status: 'all', type: 'all', sort: 'newest' });
  const { bounties, loading } = useBounties(filters);
  const { bountyCount } = useGlobalStats();

  return (
    <div className="app-content">
      {/* Hero */}
      <section style={{ padding: 'clamp(3rem, 8vw, 5rem) 0 clamp(2rem, 5vw, 3rem)', borderBottom: '1px solid ' + t.colors.border.default }}>
        <div className="container">
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: '99px', padding: '4px 12px', fontSize: '12px', color: '#818cf8', marginBottom: '20px' }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#6366f1', display: 'inline-block', animation: 'fadeIn 1s ease infinite alternate' }} />
              Live on Monad Mainnet
            </div>

            <h1 style={{ fontWeight: 700, fontSize: 'clamp(28px, 5vw, 48px)', color: t.colors.text.primary, letterSpacing: '-0.03em', lineHeight: 1.15, marginBottom: '16px', maxWidth: '640px' }}>
              The bounty platform for Monad builders
            </h1>
            <p style={{ color: t.colors.text.secondary, maxWidth: '520px', fontSize: 'clamp(14px, 2vw, 16px)', lineHeight: 1.7, marginBottom: '28px' }}>
              Projects post tasks and lock rewards in escrow. Hunters submit work stored on IPFS.
              Funds auto-release on approval — fully on-chain, no middleman.
            </p>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              <Button size="lg" onClick={() => document.getElementById('bounty-list')?.scrollIntoView({ behavior: 'smooth' })}>
                Browse Bounties
              </Button>
              <Button size="lg" variant="secondary" onClick={() => window.location.hash = '#/post'}>
                Post a Bounty
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Stats */}
      <section style={{ borderBottom: '1px solid ' + t.colors.border.default, background: '#0d0d10' }}>
        <div className="container" style={{ padding: 'clamp(1rem, 3vw, 1.5rem) clamp(1rem, 4vw, 2rem)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '24px' }}>
            {[
              { label: 'Bounties',          value: String(bountyCount || 0) },
              { label: 'Platform fee',      value: '3%' },
              { label: 'Dispute protection',value: '7-day' },
              { label: 'Max winners',       value: '5' },
            ].map(s => (
              <div key={s.label} style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <span style={{ fontFamily: t.fonts.mono, fontSize: 'clamp(18px, 3vw, 24px)', fontWeight: 600, color: t.colors.text.primary, letterSpacing: '-0.02em' }}>{s.value}</span>
                <span style={{ fontSize: '12px', color: t.colors.text.muted }}>{s.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Bounty list */}
      <section id="bounty-list" style={{ padding: 'clamp(1.5rem, 4vw, 2.5rem) 0' }}>
        <div className="container">
          <div style={{ marginBottom: '20px' }}>
            <BountyFilter filters={filters} onChange={setFilters} />
          </div>
          {loading ? (
            <PageLoader />
          ) : bounties.length === 0 ? (
            <EmptyState
              icon="🎯"
              title="No bounties yet"
              message="Be the first to post a bounty for the Monad ecosystem."
              action="Post a Bounty"
              onAction={() => window.location.hash = '#/post'}
            />
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 320px), 1fr))', gap: '14px' }}>
              {bounties.map((b, i) => (
                <motion.div key={String(b.id)} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
                  <BountyCard bounty={b} onClick={() => window.location.hash = '#/bounty/' + String(b.id)} />
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* How it works */}
      <section style={{ padding: 'clamp(2rem, 5vw, 4rem) 0', borderTop: '1px solid ' + t.colors.border.default, background: '#0d0d10' }}>
        <div className="container">
          <h2 style={{ fontWeight: 700, fontSize: 'clamp(18px, 3vw, 24px)', color: t.colors.text.primary, letterSpacing: '-0.02em', marginBottom: '2rem' }}>
            How it works
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1px', background: t.colors.border.default, borderRadius: t.radius.lg, overflow: 'hidden', border: '1px solid ' + t.colors.border.default }}>
            {[
              { n: '01', title: 'Post Bounty',    desc: 'Deposit MON or USDC into escrow. Define the task, deadline, and prize split.' },
              { n: '02', title: 'Submit Work',    desc: 'Hunters upload deliverables — stored permanently on IPFS.' },
              { n: '03', title: 'Review',         desc: 'Project reviews submissions and selects winner(s).' },
              { n: '04', title: 'Auto-Release',   desc: 'Escrow releases to winners. 3% fee to treasury. Fully verifiable on-chain.' },
            ].map((step, i) => (
              <div key={step.n} style={{ padding: 'clamp(1.25rem, 3vw, 1.75rem)', background: t.colors.bg.card, display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <span style={{ fontFamily: t.fonts.mono, fontSize: '11px', color: '#6366f1', fontWeight: 500 }}>{step.n}</span>
                <h3 style={{ fontWeight: 600, fontSize: '15px', color: t.colors.text.primary }}>{step.title}</h3>
                <p style={{ fontSize: '13px', color: t.colors.text.muted, lineHeight: 1.7 }}>{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
`);

console.log("\n✓ Theme refresh complete. All files written.");
