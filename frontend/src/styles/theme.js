// ── NadWork Design System v2 ─────────────────────────────────────────────────
// Concept: Precision Board — ultra-minimal, editorial, data-forward.
// Palette: Near-black base + single violet accent (#7c3aed).
// 2026 aesthetic: no noise, no gradients in UI, high contrast, sharp type.

export const theme = {
  colors: {
    // ── Brand accent ──────────────────────────────────────────────────────────
    primary:   '#7c3aed',
    secondary: '#8b5cf6',
    accent:    '#22c55e',
    danger:    '#ef4444',
    warning:   '#f59e0b',

    // Violet tonal ramp
    violet: {
      100: '#ede9fe',
      200: '#ddd6fe',
      300: '#c4b5fd',
      400: '#a78bfa',
      500: '#8b5cf6',
      600: '#7c3aed',   // PRIMARY
      700: '#6d28d9',   // hover
      800: '#5b21b6',   // active / logo
      900: '#4c1d95',
    },

    // Green
    green: {
      300: '#86efac',
      400: '#4ade80',
      500: '#22c55e',
      600: '#16a34a',
    },

    // Red
    red: {
      300: '#fca5a5',
      400: '#f87171',
      500: '#ef4444',
      600: '#dc2626',
    },

    // Amber
    amber: {
      400: '#fbbf24',
      500: '#f59e0b',
    },

    // Slate
    slate: {
      400: '#94a3b8',
      500: '#64748b',
    },

    bronze: '#cd7c3d',

    // ── Backgrounds ───────────────────────────────────────────────────────────
    bg: {
      base:     '#080808',          // app root — near-pure black
      darkest:  '#080808',          // alias
      dark:     '#0b0b0e',
      card:     '#0e0e12',          // default card surface
      elevated: '#141418',          // hover / lifted state
      hover:    '#141418',          // alias
      panel:    '#0a0a0d',          // live-feed panels, side panels
      glass:    'rgba(8,8,8,0.85)', // glass overlays
      overlay:  'rgba(0,0,0,0.88)',
      surface:  'rgba(124,58,237,0.06)',
      violet:   'rgba(124,58,237,0.06)',
      input:    '#0c0c10',
    },

    // ── Text ──────────────────────────────────────────────────────────────────
    text: {
      primary:   '#f0f0f0',
      secondary: '#a0a0a8',
      muted:     '#58585e',
      faint:     '#2a2a2e',
      white:     '#ffffff',
      accent:    '#a78bfa',
      inverse:   '#080808',
    },

    // ── Borders ───────────────────────────────────────────────────────────────
    border: {
      faint:   '#0f0f14',
      subtle:  '#16161c',
      default: '#1e1e26',
      strong:  '#2a2a34',
      hover:   '#363640',
      active:  '#7c3aed',
      focus:   'rgba(124,58,237,0.35)',
    },

    // ── Status ────────────────────────────────────────────────────────────────
    status: {
      active:    '#22c55e',
      reviewing: '#f59e0b',
      completed: '#8b5cf6',
      expired:   '#3f3f46',
      cancelled: '#ef4444',
      disputed:  '#ef4444',
      open:      '#22c55e',
    },
  },

  // ── Fonts ─────────────────────────────────────────────────────────────────
  fonts: {
    display: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    body:    "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    mono:    "'DM Mono', 'Fira Code', 'JetBrains Mono', monospace",
    number:  "'Inter', sans-serif",
  },

  // ── Letter-spacing ────────────────────────────────────────────────────────
  tracking: {
    display: '-0.055em',
    tight:   '-0.038em',
    normal:  '-0.016em',
    wide:    '0.04em',
    wider:   '0.09em',
    mono:    '0.02em',
  },

  // ── Border radius ─────────────────────────────────────────────────────────
  radius: {
    xs:   '3px',
    sm:   '5px',
    md:   '8px',
    lg:   '12px',
    xl:   '16px',
    '2xl':'22px',
    '3xl':'28px',
    full: '9999px',
  },

  // ── Shadows ───────────────────────────────────────────────────────────────
  shadow: {
    xs:        '0 1px 2px rgba(0,0,0,0.55)',
    sm:        '0 1px 4px rgba(0,0,0,0.65)',
    md:        '0 4px 16px rgba(0,0,0,0.72)',
    lg:        '0 8px 32px rgba(0,0,0,0.82)',
    xl:        '0 16px 48px rgba(0,0,0,0.88)',
    glow:      '0 0 0 3px rgba(124,58,237,0.28)',
    glowSm:    '0 0 0 2px rgba(124,58,237,0.22)',
    glowGreen: '0 0 0 3px rgba(34,197,94,0.22)',
    violetMd:  '0 8px 40px rgba(124,58,237,0.18)',
    violetLg:  '0 16px 64px rgba(124,58,237,0.22)',
  },

  // ── Transitions ───────────────────────────────────────────────────────────
  duration: {
    instant: '70ms',
    fast:    '110ms',
    normal:  '170ms',
    slow:    '280ms',
    slower:  '420ms',
  },

  ease: {
    out:      'cubic-bezier(0.0, 0, 0.2, 1)',
    in:       'cubic-bezier(0.4, 0, 1, 1)',
    inOut:    'cubic-bezier(0.4, 0, 0.2, 1)',
    spring:   'cubic-bezier(0.34, 1.56, 0.64, 1)',
    standard: 'cubic-bezier(0.16, 1, 0.3, 1)',
    expo:     'cubic-bezier(0.87, 0, 0.13, 1)',
  },

  // ── Z-index ───────────────────────────────────────────────────────────────
  z: {
    base:     0,
    raised:   10,
    dropdown: 100,
    sticky:   200,
    header:   300,
    modal:    400,
    toast:    500,
    tooltip:  600,
  },

  transition: 'all 0.15s cubic-bezier(0.16, 1, 0.3, 1)',
};

export default theme;
