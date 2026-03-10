// ── NadWork Design System v3 ─────────────────────────────────────────────────
// Base : Clean Dark  #0f0f0f
// Accent: Monad Purple  #6E54FF  (official brand color)
// Secondary accents: Monad Cyan #85E6FF · Pink #FF8EE4 · Amber #FFAE45
// Fonts : Outfit (display/body) · DM Mono (data/addresses/labels)

export const theme = {
  colors: {
    // ── Primary — Monad Purple ────────────────────────────────────────────────
    primary:        '#6E54FF',
    primaryDim:     'rgba(110,84,255,0.08)',
    primaryBorder:  'rgba(110,84,255,0.20)',
    primaryGlow:    'rgba(110,84,255,0.30)',
    primaryHover:   '#7d65ff',
    primaryDark:    '#5a42e0',
    primaryLight:   '#DDD7FE',   // Monad light purple

    // ── Monad secondary palette ───────────────────────────────────────────────
    cyan:           '#85E6FF',
    cyanDim:        'rgba(133,230,255,0.08)',
    cyanBorder:     'rgba(133,230,255,0.20)',

    pink:           '#FF8EE4',
    pinkDim:        'rgba(255,142,228,0.08)',
    pinkBorder:     'rgba(255,142,228,0.20)',

    amber:          '#FFAE45',
    amberDim:       'rgba(255,174,69,0.08)',
    amberBorder:    'rgba(255,174,69,0.20)',

    // ── Status ────────────────────────────────────────────────────────────────
    red: {
      300: '#fca5a5',
      400: '#f87171',
      500: '#ef4444',
      600: '#dc2626',
      dim: 'rgba(239,68,68,0.08)',
      border: 'rgba(239,68,68,0.20)',
    },
    green: {
      400: '#34d399',
      500: '#10b981',
      dim: 'rgba(16,185,129,0.08)',
      border: 'rgba(16,185,129,0.20)',
    },
    lavender: {
      300: '#c4b5fd',
      400: '#a78bfa',
      dim: 'rgba(167,139,250,0.08)',
      border: 'rgba(167,139,250,0.20)',
    },

    // ── Backgrounds ───────────────────────────────────────────────────────────
    bg: {
      base:     '#0f0f0f',
      darkest:  '#0a0a0a',
      card:     '#161616',
      elevated: '#1c1c1c',
      hover:    '#1e1e1e',
      panel:    '#131313',
      input:    '#141414',
      glass:    'rgba(15,15,15,0.92)',
      overlay:  'rgba(0,0,0,0.85)',
      surface:  'rgba(110,84,255,0.04)',
    },

    // ── Text ──────────────────────────────────────────────────────────────────
    text: {
      primary:   '#f0f0f0',
      secondary: '#b0b0b0',
      muted:     '#787878',
      faint:     '#585858',
      white:     '#ffffff',
      accent:    '#6E54FF',
      inverse:   '#0f0f0f',
    },

    // ── Borders ───────────────────────────────────────────────────────────────
    border: {
      faint:   '#1e1e1e',
      subtle:  '#242424',
      default: '#303030',
      strong:  '#404040',
      hover:   '#505050',
      active:  '#6E54FF',
      focus:   'rgba(110,84,255,0.35)',
    },
  },

  fonts: {
    display: "'Outfit', -apple-system, BlinkMacSystemFont, sans-serif",
    body:    "'Outfit', -apple-system, BlinkMacSystemFont, sans-serif",
    mono:    "'DM Mono', 'Fira Code', 'JetBrains Mono', monospace",
  },

  radius: {
    xs:    '4px',
    sm:    '6px',
    md:    '8px',
    lg:    '12px',
    xl:    '14px',
    '2xl': '18px',
    '3xl': '24px',
    full:  '9999px',
  },

  shadow: {
    xs:   '0 1px 2px rgba(0,0,0,0.6)',
    sm:   '0 1px 4px rgba(0,0,0,0.7)',
    md:   '0 4px 16px rgba(0,0,0,0.75)',
    lg:   '0 8px 32px rgba(0,0,0,0.82)',
    xl:   '0 16px 48px rgba(0,0,0,0.9)',
    glow: '0 0 0 3px rgba(110,84,255,0.18)',
  },

  transition: 'all 0.15s cubic-bezier(0.16, 1, 0.3, 1)',

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
};

export default theme;
