import { theme } from '../../styles/theme';

const BADGE_MAP = {
  // Status
  active:    { color: theme.colors.green[400],    bg: theme.colors.green.dim,    border: theme.colors.green.border    },
  open:      { color: theme.colors.green[400],    bg: theme.colors.green.dim,    border: theme.colors.green.border    },
  approved:  { color: theme.colors.green[400],    bg: theme.colors.green.dim,    border: theme.colors.green.border    },
  completed: { color: theme.colors.lavender[400], bg: theme.colors.lavender.dim, border: theme.colors.lavender.border },
  reviewing: { color: theme.colors.amber,         bg: theme.colors.amberDim,     border: theme.colors.amberBorder     },
  pending:   { color: theme.colors.amber,         bg: theme.colors.amberDim,     border: theme.colors.amberBorder     },
  featured:  { color: theme.colors.amber,         bg: theme.colors.amberDim,     border: theme.colors.amberBorder     },
  expired:   { color: theme.colors.red[400],      bg: theme.colors.red.dim,      border: theme.colors.red.border      },
  cancelled: { color: theme.colors.red[400],      bg: theme.colors.red.dim,      border: theme.colors.red.border      },
  disputed:  { color: theme.colors.red[400],      bg: theme.colors.red.dim,      border: theme.colors.red.border      },
  // Category
  dev:       { color: theme.colors.primary,       bg: theme.colors.primaryDim,   border: theme.colors.primaryBorder   },
  design:    { color: theme.colors.pink,           bg: theme.colors.pinkDim,      border: theme.colors.pinkBorder      },
  content:   { color: theme.colors.amber,         bg: theme.colors.amberDim,     border: theme.colors.amberBorder     },
  research:  { color: theme.colors.cyan,          bg: theme.colors.cyanDim,      border: theme.colors.cyanBorder      },
  other:     { color: theme.colors.text.muted,    bg: theme.colors.bg.elevated,  border: theme.colors.border.default  },
};

export default function Badge({ type = 'other', label, style: extraStyle = {} }) {
  // Guard against BigInt, objects, etc. from ethers v6 contract data
  const t = (type != null && typeof type !== 'object' && typeof type !== 'bigint')
    ? String(type).toLowerCase()
    : 'other';
  const map = BADGE_MAP[t] || BADGE_MAP.other;
  const display = label || (typeof type === 'string' ? type : t);

  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      fontFamily: theme.fonts.mono,
      fontSize: 9.5, fontWeight: 500,
      letterSpacing: '0.05em', textTransform: 'uppercase',
      color: map.color,
      background: map.bg,
      border: `1px solid ${map.border}`,
      borderRadius: theme.radius.xs,
      padding: '2px 7px',
      whiteSpace: 'nowrap',
      lineHeight: 1.6,
      ...extraStyle,
    }}>
      {display}
    </span>
  );
}
