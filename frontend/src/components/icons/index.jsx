import React from 'react';

// ── Base wrapper ──────────────────────────────────────────────────────────────
function Icon({ size = 20, color = 'currentColor', strokeWidth = 1.5, fill = 'none', style, className, children }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox='0 0 24 24'
      fill={fill}
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap='round'
      strokeLinejoin='round'
      style={style}
      className={className}
      aria-hidden='true'
    >
      {children}
    </svg>
  );
}

export function IconNadWork({ size = 28, style, className }) {
  return (
    <svg width={size} height={size} viewBox='0 0 32 32' fill='none' style={style} className={className} aria-hidden='true'>
      <defs>
        <radialGradient id='nw-glow' cx='50%' cy='50%' r='60%'>
          <stop offset='0%' stopColor='#7c3aed' stopOpacity='0.28'/>
          <stop offset='100%' stopColor='#7c3aed' stopOpacity='0'/>
        </radialGradient>
      </defs>
      <rect width='32' height='32' rx='8' fill='#0c0018'/>
      <rect width='32' height='32' rx='8' fill='url(#nw-glow)'/>
      <line x1='9' y1='22' x2='9' y2='10' stroke='#f0f0f0' strokeWidth='2.5' strokeLinecap='round'/>
      <line x1='9' y1='10' x2='23' y2='22' stroke='#a78bfa' strokeWidth='2.5' strokeLinecap='round'/>
      <line x1='23' y1='10' x2='23' y2='22' stroke='#f0f0f0' strokeWidth='2.5' strokeLinecap='round'/>
      <circle cx='23' cy='10' r='2' fill='#c4b5fd'/>
    </svg>
  );
}

// ── Navigation / Actions ──────────────────────────────────────────────────────

export function IconBounties({ size = 20, color = 'currentColor', style, className, strokeWidth = 1.5 }) {
  return (
    <Icon size={size} color={color} style={style} className={className} strokeWidth={strokeWidth}>
      <circle cx='12' cy='12' r='9'/>
      <circle cx='12' cy='12' r='4'/>
      <line x1='12' y1='3' x2='12' y2='6'/>
      <line x1='12' y1='18' x2='12' y2='21'/>
      <line x1='3' y1='12' x2='6' y2='12'/>
      <line x1='18' y1='12' x2='21' y2='12'/>
    </Icon>
  );
}

export function IconPlus({ size = 20, color = 'currentColor', style, className, strokeWidth = 1.5 }) {
  return (
    <Icon size={size} color={color} style={style} className={className} strokeWidth={strokeWidth}>
      <line x1='12' y1='5' x2='12' y2='19'/>
      <line x1='5' y1='12' x2='19' y2='12'/>
    </Icon>
  );
}

export function IconSearch({ size = 20, color = 'currentColor', style, className, strokeWidth = 1.5 }) {
  return (
    <Icon size={size} color={color} style={style} className={className} strokeWidth={strokeWidth}>
      <circle cx='10.5' cy='10.5' r='6'/>
      <line x1='15' y1='15' x2='20' y2='20'/>
    </Icon>
  );
}

export function IconFilter({ size = 20, color = 'currentColor', style, className, strokeWidth = 1.5 }) {
  return (
    <Icon size={size} color={color} style={style} className={className} strokeWidth={strokeWidth}>
      <polygon points='22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3'/>
    </Icon>
  );
}

export function IconCheck({ size = 20, color = 'currentColor', style, className, strokeWidth = 1.5 }) {
  return (
    <Icon size={size} color={color} style={style} className={className} strokeWidth={strokeWidth}>
      <polyline points='20 6 9 17 4 12'/>
    </Icon>
  );
}

export function IconX({ size = 20, color = 'currentColor', style, className, strokeWidth = 1.5 }) {
  return (
    <Icon size={size} color={color} style={style} className={className} strokeWidth={strokeWidth}>
      <line x1='18' y1='6' x2='6' y2='18'/>
      <line x1='6' y1='6' x2='18' y2='18'/>
    </Icon>
  );
}

export function IconChevronDown({ size = 20, color = 'currentColor', style, className, strokeWidth = 1.5 }) {
  return (
    <Icon size={size} color={color} style={style} className={className} strokeWidth={strokeWidth}>
      <polyline points='6 9 12 15 18 9'/>
    </Icon>
  );
}

export function IconChevronUp({ size = 20, color = 'currentColor', style, className, strokeWidth = 1.5 }) {
  return (
    <Icon size={size} color={color} style={style} className={className} strokeWidth={strokeWidth}>
      <polyline points='18 15 12 9 6 15'/>
    </Icon>
  );
}

export function IconChevronRight({ size = 20, color = 'currentColor', style, className, strokeWidth = 1.5 }) {
  return (
    <Icon size={size} color={color} style={style} className={className} strokeWidth={strokeWidth}>
      <polyline points='9 18 15 12 9 6'/>
    </Icon>
  );
}

export function IconChevronLeft({ size = 20, color = 'currentColor', style, className, strokeWidth = 1.5 }) {
  return (
    <Icon size={size} color={color} style={style} className={className} strokeWidth={strokeWidth}>
      <polyline points='15 18 9 12 15 6'/>
    </Icon>
  );
}

export function IconExternalLink({ size = 20, color = 'currentColor', style, className, strokeWidth = 1.5 }) {
  return (
    <Icon size={size} color={color} style={style} className={className} strokeWidth={strokeWidth}>
      <path d='M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6'/>
      <polyline points='15 3 21 3 21 9'/>
      <line x1='10' y1='14' x2='21' y2='3'/>
    </Icon>
  );
}

export function IconCopy({ size = 20, color = 'currentColor', style, className, strokeWidth = 1.5 }) {
  return (
    <Icon size={size} color={color} style={style} className={className} strokeWidth={strokeWidth}>
      <rect x='9' y='9' width='13' height='13' rx='2'/>
      <path d='M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1'/>
    </Icon>
  );
}

export function IconShare({ size = 20, color = 'currentColor', style, className, strokeWidth = 1.5 }) {
  return (
    <Icon size={size} color={color} style={style} className={className} strokeWidth={strokeWidth}>
      <circle cx='18' cy='5' r='2.5'/>
      <circle cx='6' cy='12' r='2.5'/>
      <circle cx='18' cy='19' r='2.5'/>
      <line x1='8.4' y1='10.9' x2='15.6' y2='6.1'/>
      <line x1='8.4' y1='13.1' x2='15.6' y2='17.9'/>
    </Icon>
  );
}

// ── Achievement ───────────────────────────────────────────────────────────────

export function IconStar({ size = 20, color = 'currentColor', style, className, strokeWidth = 1.5 }) {
  return (
    <Icon size={size} color={color} style={style} className={className} strokeWidth={strokeWidth}>
      <polygon points='12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2'/>
    </Icon>
  );
}

export function IconTrophy({ size = 20, color = 'currentColor', style, className, strokeWidth = 1.5 }) {
  return (
    <Icon size={size} color={color} style={style} className={className} strokeWidth={strokeWidth}>
      <path d='M6 9H4a2 2 0 000 4 6 6 0 004 5.66V20H8a2 2 0 000 4h8a2 2 0 000-4h-1v-1.34A6 6 0 0020 13a2 2 0 000-4h-2'/>
      <rect x='6' y='3' width='12' height='10' rx='2'/>
    </Icon>
  );
}

export function IconMedal({ size = 20, color = 'currentColor', style, className, strokeWidth = 1.5 }) {
  return (
    <Icon size={size} color={color} style={style} className={className} strokeWidth={strokeWidth}>
      <circle cx='12' cy='14' r='7'/>
      <path d='M8.21 4.37L6 2 5 9.12'/>
      <path d='M15.79 4.37L18 2l1 7.12'/>
      <path d='M12 7v4l2.5 1.5'/>
    </Icon>
  );
}

// ── Energy / Concept ──────────────────────────────────────────────────────────

export function IconBolt({ size = 20, color = 'currentColor', style, className, strokeWidth = 1.5 }) {
  return (
    <Icon size={size} color={color} style={style} className={className} strokeWidth={strokeWidth}>
      <polygon points='13 2 3 14 12 14 11 22 21 10 12 10 13 2'/>
    </Icon>
  );
}

export function IconTarget({ size = 20, color = 'currentColor', style, className, strokeWidth = 1.5 }) {
  return (
    <Icon size={size} color={color} style={style} className={className} strokeWidth={strokeWidth}>
      <circle cx='12' cy='12' r='9'/>
      <circle cx='12' cy='12' r='5'/>
      <circle cx='12' cy='12' r='1' fill='currentColor' stroke='none'/>
    </Icon>
  );
}

export function IconShield({ size = 20, color = 'currentColor', style, className, strokeWidth = 1.5 }) {
  return (
    <Icon size={size} color={color} style={style} className={className} strokeWidth={strokeWidth}>
      <path d='M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z'/>
    </Icon>
  );
}

export function IconLock({ size = 20, color = 'currentColor', style, className, strokeWidth = 1.5 }) {
  return (
    <Icon size={size} color={color} style={style} className={className} strokeWidth={strokeWidth}>
      <rect x='3' y='11' width='18' height='11' rx='2'/>
      <path d='M7 11V7a5 5 0 0110 0v4'/>
    </Icon>
  );
}

export function IconUnlock({ size = 20, color = 'currentColor', style, className, strokeWidth = 1.5 }) {
  return (
    <Icon size={size} color={color} style={style} className={className} strokeWidth={strokeWidth}>
      <rect x='3' y='11' width='18' height='11' rx='2'/>
      <path d='M7 11V7a5 5 0 019.9-1'/>
    </Icon>
  );
}

// ── Visibility ────────────────────────────────────────────────────────────────

export function IconEye({ size = 20, color = 'currentColor', style, className, strokeWidth = 1.5 }) {
  return (
    <Icon size={size} color={color} style={style} className={className} strokeWidth={strokeWidth}>
      <path d='M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z'/>
      <circle cx='12' cy='12' r='3'/>
    </Icon>
  );
}

export function IconEyeOff({ size = 20, color = 'currentColor', style, className, strokeWidth = 1.5 }) {
  return (
    <Icon size={size} color={color} style={style} className={className} strokeWidth={strokeWidth}>
      <path d='M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94'/>
      <path d='M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19'/>
      <line x1='1' y1='1' x2='23' y2='23'/>
    </Icon>
  );
}

// ── People ────────────────────────────────────────────────────────────────────

export function IconUser({ size = 20, color = 'currentColor', style, className, strokeWidth = 1.5 }) {
  return (
    <Icon size={size} color={color} style={style} className={className} strokeWidth={strokeWidth}>
      <path d='M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2'/>
      <circle cx='12' cy='7' r='4'/>
    </Icon>
  );
}

export function IconUsers({ size = 20, color = 'currentColor', style, className, strokeWidth = 1.5 }) {
  return (
    <Icon size={size} color={color} style={style} className={className} strokeWidth={strokeWidth}>
      <path d='M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2'/>
      <circle cx='9' cy='7' r='4'/>
      <path d='M23 21v-2a4 4 0 00-3-3.87'/>
      <path d='M16 3.13a4 4 0 010 7.75'/>
    </Icon>
  );
}

export function IconWallet({ size = 20, color = 'currentColor', style, className, strokeWidth = 1.5 }) {
  return (
    <Icon size={size} color={color} style={style} className={className} strokeWidth={strokeWidth}>
      <path d='M20 7H4a2 2 0 00-2 2v10a2 2 0 002 2h16a2 2 0 002-2V9a2 2 0 00-2-2z'/>
      <path d='M16 3l-4-1-4 1v4h8V3z'/>
      <circle cx='17' cy='14' r='1.5' fill='currentColor' stroke='none'/>
    </Icon>
  );
}

// ── Direction ─────────────────────────────────────────────────────────────────

export function IconArrowUp({ size = 20, color = 'currentColor', style, className, strokeWidth = 1.5 }) {
  return (
    <Icon size={size} color={color} style={style} className={className} strokeWidth={strokeWidth}>
      <line x1='12' y1='19' x2='12' y2='5'/>
      <polyline points='5 12 12 5 19 12'/>
    </Icon>
  );
}

export function IconArrowDown({ size = 20, color = 'currentColor', style, className, strokeWidth = 1.5 }) {
  return (
    <Icon size={size} color={color} style={style} className={className} strokeWidth={strokeWidth}>
      <line x1='12' y1='5' x2='12' y2='19'/>
      <polyline points='19 12 12 19 5 12'/>
    </Icon>
  );
}

export function IconArrowRight({ size = 20, color = 'currentColor', style, className, strokeWidth = 1.5 }) {
  return (
    <Icon size={size} color={color} style={style} className={className} strokeWidth={strokeWidth}>
      <line x1='5' y1='12' x2='19' y2='12'/>
      <polyline points='12 5 19 12 12 19'/>
    </Icon>
  );
}

// ── Time ──────────────────────────────────────────────────────────────────────

export function IconClock({ size = 20, color = 'currentColor', style, className, strokeWidth = 1.5 }) {
  return (
    <Icon size={size} color={color} style={style} className={className} strokeWidth={strokeWidth}>
      <circle cx='12' cy='12' r='9'/>
      <polyline points='12 7 12 12 15.5 14.5'/>
    </Icon>
  );
}

export function IconCalendar({ size = 20, color = 'currentColor', style, className, strokeWidth = 1.5 }) {
  return (
    <Icon size={size} color={color} style={style} className={className} strokeWidth={strokeWidth}>
      <rect x='3' y='4' width='18' height='18' rx='2'/>
      <line x1='16' y1='2' x2='16' y2='6'/>
      <line x1='8' y1='2' x2='8' y2='6'/>
      <line x1='3' y1='10' x2='21' y2='10'/>
      <rect x='8' y='14' width='2' height='2' rx='0.5' fill='currentColor' stroke='none'/>
      <rect x='13' y='14' width='2' height='2' rx='0.5' fill='currentColor' stroke='none'/>
    </Icon>
  );
}

// ── Data ──────────────────────────────────────────────────────────────────────

export function IconDollar({ size = 20, color = 'currentColor', style, className, strokeWidth = 1.5 }) {
  return (
    <Icon size={size} color={color} style={style} className={className} strokeWidth={strokeWidth}>
      <line x1='12' y1='1' x2='12' y2='23'/>
      <path d='M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6'/>
    </Icon>
  );
}

export function IconTag({ size = 20, color = 'currentColor', style, className, strokeWidth = 1.5 }) {
  return (
    <Icon size={size} color={color} style={style} className={className} strokeWidth={strokeWidth}>
      <path d='M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z'/>
      <line x1='7' y1='7' x2='7.01' y2='7'/>
    </Icon>
  );
}

export function IconChart({ size = 20, color = 'currentColor', style, className, strokeWidth = 1.5 }) {
  return (
    <svg width={size} height={size} viewBox='0 0 24 24' fill='none' stroke='none' aria-hidden='true' style={style} className={className}>
      <rect x='3' y='14' width='4' height='7' rx='1' fill='currentColor' opacity='0.5'/>
      <rect x='10' y='9' width='4' height='12' rx='1' fill='currentColor' opacity='0.75'/>
      <rect x='17' y='5' width='4' height='16' rx='1' fill='currentColor'/>
      <line x1='2' y1='21' x2='22' y2='21' stroke='currentColor' strokeWidth={strokeWidth} strokeLinecap='round'/>
    </svg>
  );
}

// ── Dev ───────────────────────────────────────────────────────────────────────

export function IconCode({ size = 20, color = 'currentColor', style, className, strokeWidth = 1.5 }) {
  return (
    <Icon size={size} color={color} style={style} className={className} strokeWidth={strokeWidth}>
      <polyline points='16 18 22 12 16 6'/>
      <polyline points='8 6 2 12 8 18'/>
    </Icon>
  );
}

// ── Web ───────────────────────────────────────────────────────────────────────

export function IconGlobe({ size = 20, color = 'currentColor', style, className, strokeWidth = 1.5 }) {
  return (
    <Icon size={size} color={color} style={style} className={className} strokeWidth={strokeWidth}>
      <circle cx='12' cy='12' r='9'/>
      <path d='M2 12h20'/>
      <path d='M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z'/>
    </Icon>
  );
}

export function IconLink({ size = 20, color = 'currentColor', style, className, strokeWidth = 1.5 }) {
  return (
    <Icon size={size} color={color} style={style} className={className} strokeWidth={strokeWidth}>
      <path d='M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71'/>
      <path d='M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71'/>
    </Icon>
  );
}

export function IconMail({ size = 20, color = 'currentColor', style, className, strokeWidth = 1.5 }) {
  return (
    <Icon size={size} color={color} style={style} className={className} strokeWidth={strokeWidth}>
      <path d='M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z'/>
      <polyline points='22 6 12 13 2 6'/>
    </Icon>
  );
}

export function IconBell({ size = 20, color = 'currentColor', style, className, strokeWidth = 1.5 }) {
  return (
    <Icon size={size} color={color} style={style} className={className} strokeWidth={strokeWidth}>
      <path d='M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9'/>
      <path d='M13.73 21a2 2 0 01-3.46 0'/>
    </Icon>
  );
}

export function IconSettings({ size = 20, color = 'currentColor', style, className, strokeWidth = 1.5 }) {
  return (
    <Icon size={size} color={color} style={style} className={className} strokeWidth={strokeWidth}>
      <line x1='4' y1='7' x2='20' y2='7'/>
      <line x1='4' y1='12' x2='20' y2='12'/>
      <line x1='4' y1='17' x2='20' y2='17'/>
      <circle cx='8' cy='7' r='2' fill='currentColor' stroke='none'/>
      <circle cx='16' cy='12' r='2' fill='currentColor' stroke='none'/>
      <circle cx='10' cy='17' r='2' fill='currentColor' stroke='none'/>
    </Icon>
  );
}

// ── Feedback ──────────────────────────────────────────────────────────────────

export function IconInfo({ size = 20, color = 'currentColor', style, className, strokeWidth = 1.5 }) {
  return (
    <Icon size={size} color={color} style={style} className={className} strokeWidth={strokeWidth}>
      <circle cx='12' cy='12' r='9'/>
      <line x1='12' y1='16' x2='12' y2='12'/>
      <line x1='12' y1='8' x2='12.01' y2='8'/>
    </Icon>
  );
}

export function IconWarning({ size = 20, color = 'currentColor', style, className, strokeWidth = 1.5 }) {
  return (
    <Icon size={size} color={color} style={style} className={className} strokeWidth={strokeWidth}>
      <path d='M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z'/>
      <line x1='12' y1='9' x2='12' y2='13'/>
      <line x1='12' y1='17' x2='12.01' y2='17'/>
    </Icon>
  );
}

// ── Files ─────────────────────────────────────────────────────────────────────

export function IconUpload({ size = 20, color = 'currentColor', style, className, strokeWidth = 1.5 }) {
  return (
    <Icon size={size} color={color} style={style} className={className} strokeWidth={strokeWidth}>
      <path d='M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4'/>
      <polyline points='17 8 12 3 7 8'/>
      <line x1='12' y1='3' x2='12' y2='15'/>
    </Icon>
  );
}

export function IconDownload({ size = 20, color = 'currentColor', style, className, strokeWidth = 1.5 }) {
  return (
    <Icon size={size} color={color} style={style} className={className} strokeWidth={strokeWidth}>
      <path d='M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4'/>
      <polyline points='7 10 12 15 17 10'/>
      <line x1='12' y1='15' x2='12' y2='3'/>
    </Icon>
  );
}

export function IconEdit({ size = 20, color = 'currentColor', style, className, strokeWidth = 1.5 }) {
  return (
    <Icon size={size} color={color} style={style} className={className} strokeWidth={strokeWidth}>
      <path d='M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7'/>
      <path d='M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z'/>
    </Icon>
  );
}

export function IconTrash({ size = 20, color = 'currentColor', style, className, strokeWidth = 1.5 }) {
  return (
    <Icon size={size} color={color} style={style} className={className} strokeWidth={strokeWidth}>
      <polyline points='3 6 5 6 21 6'/>
      <path d='M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a1 1 0 011-1h4a1 1 0 011 1v2'/>
    </Icon>
  );
}

export function IconRefresh({ size = 20, color = 'currentColor', style, className, strokeWidth = 1.5 }) {
  return (
    <Icon size={size} color={color} style={style} className={className} strokeWidth={strokeWidth}>
      <polyline points='23 4 23 10 17 10'/>
      <path d='M20.49 15a9 9 0 11-2.12-9.36L23 10'/>
    </Icon>
  );
}

// ── Brand social ──────────────────────────────────────────────────────────────

export function IconMonad({ size = 20, color = 'currentColor', style, className, strokeWidth = 1.5 }) {
  return (
    <Icon size={size} color={color} style={style} className={className} strokeWidth={strokeWidth}>
      <hexagon cx='12' cy='12' r='9'/>
      <path d='M12 3 L20.5 8 L20.5 16 L12 21 L3.5 16 L3.5 8 Z'/>
      <circle cx='12' cy='12' r='2.5' fill='currentColor' stroke='none'/>
    </Icon>
  );
}

export function IconTelegram({ size = 20, color = 'currentColor', style, className, strokeWidth = 1.5 }) {
  return (
    <Icon size={size} color={color} style={style} className={className} strokeWidth={strokeWidth}>
      <path d='M22 2L11 13'/>
      <path d='M22 2L15 22 11 13 2 9l20-7z'/>
    </Icon>
  );
}

export function IconYoutube({ size = 20, color = 'currentColor', style, className, strokeWidth = 1.5 }) {
  return (
    <Icon size={size} color={color} style={style} className={className} strokeWidth={strokeWidth}>
      <rect x='2' y='5' width='20' height='14' rx='4'/>
      <polygon points='10 9 10 15 16 12' fill='currentColor' stroke='none'/>
    </Icon>
  );
}

// ── Layout ────────────────────────────────────────────────────────────────────

export function IconGrid({ size = 20, color = 'currentColor', style, className, strokeWidth = 1.5 }) {
  return (
    <Icon size={size} color={color} style={style} className={className} strokeWidth={strokeWidth}>
      <rect x='3' y='3' width='7' height='7' rx='1'/>
      <rect x='14' y='3' width='7' height='7' rx='1'/>
      <rect x='14' y='14' width='7' height='7' rx='1'/>
      <rect x='3' y='14' width='7' height='7' rx='1'/>
    </Icon>
  );
}

export function IconList({ size = 20, color = 'currentColor', style, className, strokeWidth = 1.5 }) {
  return (
    <Icon size={size} color={color} style={style} className={className} strokeWidth={strokeWidth}>
      <line x1='8' y1='6' x2='21' y2='6'/>
      <line x1='8' y1='12' x2='21' y2='12'/>
      <line x1='8' y1='18' x2='21' y2='18'/>
      <circle cx='4' cy='6' r='1.5' fill='currentColor' stroke='none'/>
      <circle cx='4' cy='12' r='1.5' fill='currentColor' stroke='none'/>
      <circle cx='4' cy='18' r='1.5' fill='currentColor' stroke='none'/>
    </Icon>
  );
}

export function IconDashboard({ size = 20, color = 'currentColor', style, className, strokeWidth = 1.5 }) {
  return (
    <Icon size={size} color={color} style={style} className={className} strokeWidth={strokeWidth}>
      <rect x='3' y='3' width='7' height='7' rx='1'/>
      <rect x='14' y='3' width='7' height='7' rx='1'/>
      <rect x='3' y='14' width='7' height='7' rx='1'/>
      <rect x='14' y='14' width='7' height='7' rx='1'/>
    </Icon>
  );
}

export function IconFolder({ size = 20, color = 'currentColor', style, className, strokeWidth = 1.5 }) {
  return (
    <Icon size={size} color={color} style={style} className={className} strokeWidth={strokeWidth}>
      <path d='M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z'/>
    </Icon>
  );
}

export function IconSave({ size = 20, color = 'currentColor', style, className, strokeWidth = 1.5 }) {
  return (
    <Icon size={size} color={color} style={style} className={className} strokeWidth={strokeWidth}>
      <path d='M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z'/>
      <polyline points='17 21 17 13 7 13 7 21'/>
      <polyline points='7 3 7 8 15 8'/>
    </Icon>
  );
}

export function IconArrowLeft({ size = 20, color = 'currentColor', style, className, strokeWidth = 1.5 }) {
  return (
    <Icon size={size} color={color} style={style} className={className} strokeWidth={strokeWidth}>
      <line x1='19' y1='12' x2='5' y2='12'/>
      <polyline points='12 19 5 12 12 5'/>
    </Icon>
  );
}

export function IconBook({ size = 20, color = 'currentColor', style, className, strokeWidth = 1.5 }) {
  return (
    <Icon size={size} color={color} style={style} className={className} strokeWidth={strokeWidth}>
      <path d='M4 19.5A2.5 2.5 0 0 1 6.5 17H20'/>
      <path d='M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z'/>
    </Icon>
  );
}

export function IconMessage({ size = 20, color = 'currentColor', style, className, strokeWidth = 1.5 }) {
  return (
    <Icon size={size} color={color} style={style} className={className} strokeWidth={strokeWidth}>
      <path d='M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z'/>
    </Icon>
  );
}

export function IconNote({ size = 20, color = 'currentColor', style, className, strokeWidth = 1.5 }) {
  return (
    <Icon size={size} color={color} style={style} className={className} strokeWidth={strokeWidth}>
      <path d='M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z'/>
      <polyline points='14 2 14 8 20 8'/>
      <line x1='16' y1='13' x2='8' y2='13'/>
      <line x1='16' y1='17' x2='8' y2='17'/>
      <polyline points='10 9 9 9 8 9'/>
    </Icon>
  );
}

export function IconQuestion({ size = 20, color = 'currentColor', style, className, strokeWidth = 1.5 }) {
  return (
    <Icon size={size} color={color} style={style} className={className} strokeWidth={strokeWidth}>
      <circle cx='12' cy='12' r='9'/>
      <path d='M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3'/>
      <line x1='12' y1='17' x2='12.01' y2='17' strokeWidth='2.5' strokeLinecap='round'/>
    </Icon>
  );
}

export function IconGithub({ size = 20, color = 'currentColor', style, className }) {
  return (
    <svg width={size} height={size} viewBox='0 0 24 24' fill={color} style={style} className={className} aria-hidden='true'>
      <path d='M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0 1 12 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z'/>
    </svg>
  );
}

export function IconTwitter({ size = 20, color = 'currentColor', style, className }) {
  return (
    <svg width={size} height={size} viewBox='0 0 24 24' fill={color} style={style} className={className} aria-hidden='true'>
      <path d='M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z'/>
    </svg>
  );
}

export function IconFigma({ size = 20, color = 'currentColor', style, className }) {
  return (
    <svg width={size} height={size} viewBox='0 0 24 24' fill={color} style={style} className={className} aria-hidden='true'>
      <path d='M15.852 8.981h-4.588V0h4.588c2.476 0 4.49 2.014 4.49 4.49s-2.014 4.491-4.49 4.491zM12.735 7.51h3.117c1.665 0 3.019-1.355 3.019-3.019s-1.354-3.019-3.019-3.019h-3.117V7.51zm0 1.471H8.148c-2.476 0-4.49-2.014-4.49-4.49S5.672 0 8.148 0h4.588v8.981zm-4.587-7.51c-1.665 0-3.019 1.355-3.019 3.019s1.354 3.019 3.019 3.019h3.117V1.471H8.148zm4.587 15.019H8.148c-2.476 0-4.49-2.014-4.49-4.49s2.014-4.49 4.49-4.49h4.588v8.98zM8.148 8.981c-1.665 0-3.019 1.355-3.019 3.019s1.354 3.019 3.019 3.019h3.117V8.981H8.148zM8.172 24c-2.489 0-4.515-2.014-4.515-4.49s2.026-4.49 4.515-4.49c2.489 0 4.515 2.014 4.515 4.49S10.661 24 8.172 24zm0-7.509c-1.665 0-3.019 1.355-3.019 3.019s1.354 3.019 3.019 3.019 3.019-1.355 3.019-3.019-1.354-3.019-3.019-3.019zm7.703 7.509c-2.476 0-4.49-2.014-4.49-4.49v-4.49h4.49c2.476 0 4.49 2.014 4.49 4.49S18.375 24 15.875 24zm0-7.509h-3.019v3.019c0 1.665 1.355 3.019 3.019 3.019s3.019-1.354 3.019-3.019-1.354-3.019-3.019-3.019z'/>
    </svg>
  );
}

// ── Aliases ──────────────────────────────────────────────────────────────────
export { IconX as IconClose };
export { IconArrowLeft as IconBack };
export { IconExternalLink as IconExternal };
export { IconChevronRight as IconChevron };
