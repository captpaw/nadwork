import React from 'react';
import { theme as t } from '@/styles/theme.js';

export function Spinner({ size = 20, color }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox='0 0 24 24'
      fill='none'
      stroke={color || t.colors.violet[400]}
      strokeWidth='2'
      style={{ animation: 'spin 0.75s linear infinite', flexShrink: 0 }}
      aria-hidden='true'
    >
      <circle cx='12' cy='12' r='9' strokeOpacity='0.2'/>
      <path d='M12 3a9 9 0 019 9' strokeLinecap='round'/>
    </svg>
  );
}

export function PageLoader() {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '40vh',
      flexDirection: 'column',
      gap: '16px',
    }}>
      <Spinner size={28} />
      <span style={{
        fontSize: '12px',
        color: t.colors.text.muted,
        fontFamily: t.fonts.mono,
        letterSpacing: '0.04em',
      }}>Loading…</span>
    </div>
  );
}

export default Spinner;
