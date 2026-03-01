import React, { useState } from 'react';
import { theme as t } from '@/styles/theme.js';

export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  icon,
  iconRight,
  loading = false,
  disabled = false,
  onClick,
  type = 'button',
  style,
  fullWidth = false,
}) {
  const [pressed, setPressed] = useState(false);

  const heights = { sm: '30px', md: '36px', lg: '42px' };
  const paddings = { sm: '0 12px', md: '0 16px', lg: '0 22px' };
  const fontSizes = { sm: '12px', md: '13px', lg: '14px' };

  const base = {
    height: heights[size],
    padding: paddings[size],
    fontSize: fontSizes[size],
    fontWeight: 550,
    letterSpacing: '-0.01em',
    borderRadius: t.radius.md,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    cursor: disabled || loading ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.4 : 1,
    transition: 'background 0.12s ease, border-color 0.12s ease, opacity 0.12s ease, transform 0.08s ease, box-shadow 0.12s ease',
    transform: pressed && !disabled ? 'scale(0.97)' : 'scale(1)',
    userSelect: 'none',
    whiteSpace: 'nowrap',
    width: fullWidth ? '100%' : undefined,
    border: 'none',
    outline: 'none',
    fontFamily: t.fonts.body,
    textDecoration: 'none',
  };

  const variants = {
    primary: {
      background: t.colors.violet[600],
      color: '#ffffff',
      boxShadow: pressed ? 'none' : '0 1px 0 rgba(0,0,0,0.5)',
    },
    secondary: {
      background: t.colors.bg.elevated,
      color: t.colors.text.secondary,
      border: '1px solid ' + t.colors.border.default,
    },
    ghost: {
      background: 'transparent',
      color: t.colors.text.muted,
      border: '1px solid transparent',
    },
    danger: {
      background: 'rgba(239,68,68,0.12)',
      color: t.colors.red[400],
      border: '1px solid rgba(239,68,68,0.2)',
    },
    success: {
      background: 'rgba(34,197,94,0.1)',
      color: t.colors.green[400],
      border: '1px solid rgba(34,197,94,0.18)',
    },
  };

  const [hov, setHov] = useState(false);

  const hoverMap = {
    primary:   { background: t.colors.violet[700] },
    secondary: { background: t.colors.bg.hover, borderColor: t.colors.border.strong },
    ghost:     { background: t.colors.bg.elevated, color: t.colors.text.secondary },
    danger:    { background: 'rgba(239,68,68,0.18)' },
    success:   { background: 'rgba(34,197,94,0.16)' },
  };

  const variantStyle = { ...variants[variant], ...(hov && !disabled && !loading ? hoverMap[variant] : {}) };

  return (
    <button
      type={type}
      onClick={!disabled && !loading ? onClick : undefined}
      onMouseEnter={() => { if (!disabled && !loading) setHov(true); }}
      onMouseLeave={() => { setHov(false); setPressed(false); }}
      onMouseDown={() => { if (!disabled && !loading) setPressed(true); }}
      onMouseUp={() => setPressed(false)}
      style={{ ...base, ...variantStyle, ...style }}
    >
      {loading ? (
        <svg width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' style={{ animation: 'spin 0.7s linear infinite', flexShrink: 0 }}>
          <circle cx='12' cy='12' r='9' strokeOpacity='0.25'/>
          <path d='M12 3a9 9 0 019 9' strokeLinecap='round'/>
        </svg>
      ) : icon ? (
        <span style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>{icon}</span>
      ) : null}
      {children}
      {!loading && iconRight && (
        <span style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>{iconRight}</span>
      )}
    </button>
  );
}
