import React from 'react';
import { theme as t } from '@/styles/theme.js';

const BADGE_MAP = {
  active:    { color: '#4ade80', bg: 'rgba(74,222,128,0.08)', border: 'rgba(74,222,128,0.16)' },
  open:      { color: '#4ade80', bg: 'rgba(74,222,128,0.08)', border: 'rgba(74,222,128,0.16)' },
  approved:  { color: '#4ade80', bg: 'rgba(74,222,128,0.08)', border: 'rgba(74,222,128,0.16)' },
  you:       { color: '#4ade80', bg: 'rgba(74,222,128,0.08)', border: 'rgba(74,222,128,0.16)' },
  growth:    { color: '#4ade80', bg: 'rgba(74,222,128,0.08)', border: 'rgba(74,222,128,0.16)' },
  completed: { color: '#a78bfa', bg: 'rgba(167,139,250,0.08)', border: 'rgba(167,139,250,0.16)' },
  dev:       { color: '#a78bfa', bg: 'rgba(167,139,250,0.08)', border: 'rgba(167,139,250,0.16)' },
  development:{ color: '#a78bfa', bg: 'rgba(167,139,250,0.08)', border: 'rgba(167,139,250,0.16)' },
  reviewing: { color: '#fbbf24', bg: 'rgba(251,191,36,0.08)', border: 'rgba(251,191,36,0.16)' },
  pending:   { color: '#fbbf24', bg: 'rgba(251,191,36,0.08)', border: 'rgba(251,191,36,0.16)' },
  featured:  { color: '#fbbf24', bg: 'rgba(251,191,36,0.08)', border: 'rgba(251,191,36,0.16)' },
  expired:   { color: '#f87171', bg: 'rgba(248,113,113,0.08)', border: 'rgba(248,113,113,0.14)' },
  cancelled: { color: '#f87171', bg: 'rgba(248,113,113,0.08)', border: 'rgba(248,113,113,0.14)' },
  closed:    { color: '#f87171', bg: 'rgba(248,113,113,0.08)', border: 'rgba(248,113,113,0.14)' },
  disputed:  { color: '#f87171', bg: 'rgba(248,113,113,0.08)', border: 'rgba(248,113,113,0.14)' },
  design:    { color: '#60a5fa', bg: 'rgba(96,165,250,0.08)', border: 'rgba(96,165,250,0.14)' },
  new:       { color: '#60a5fa', bg: 'rgba(96,165,250,0.08)', border: 'rgba(96,165,250,0.14)' },
  content:   { color: '#fb923c', bg: 'rgba(251,146,60,0.08)', border: 'rgba(251,146,60,0.14)' },
  research:  { color: '#34d399', bg: 'rgba(52,211,153,0.08)', border: 'rgba(52,211,153,0.14)' },
  security:  { color: '#f87171', bg: 'rgba(248,113,113,0.08)', border: 'rgba(248,113,113,0.14)' },
  other:     { color: t.colors.text.muted, bg: t.colors.bg.elevated, border: t.colors.border.default },
};

const DEFAULT = { color: t.colors.text.muted, bg: t.colors.bg.elevated, border: t.colors.border.default };

export default function Badge({ type = 'other', label }) {
  const s = BADGE_MAP[type?.toLowerCase()] || DEFAULT;
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      padding: '2px 7px',
      fontSize: '9.5px',
      fontWeight: 600,
      fontFamily: t.fonts.mono,
      letterSpacing: '0.05em',
      textTransform: 'uppercase',
      color: s.color,
      background: s.bg,
      border: '1px solid ' + s.border,
      borderRadius: '3px',
      whiteSpace: 'nowrap',
      lineHeight: '16px',
    }}>
      {label}
    </span>
  );
}
