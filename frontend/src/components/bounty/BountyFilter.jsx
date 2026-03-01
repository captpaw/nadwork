import React from 'react';
import { theme as t } from '@/styles/theme.js';
import { CATEGORIES, CATEGORY_LABELS } from '@/config/contracts.js';
import { IconSearch, IconClose } from '@/components/icons/index.jsx';

function Chip({ label, active, onClick }) {
  const [hov, setHov] = React.useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: active
          ? t.colors.violet[600]
          : hov
          ? 'rgba(124,58,237,0.08)'
          : 'transparent',
        border: '1px solid ' + (
          active
            ? t.colors.violet[600]
            : hov
            ? 'rgba(124,58,237,0.22)'
            : t.colors.border.default
        ),
        color: active
          ? '#fff'
          : hov
          ? t.colors.violet[300]
          : t.colors.text.muted,
        fontSize: '11.5px',
        fontWeight: active ? 500 : 400,
        letterSpacing: active ? '-0.01em' : '0',
        padding: '3px 10px',
        borderRadius: t.radius.sm,
        cursor: 'pointer',
        transition: 'background 0.1s ease, border-color 0.1s ease, color 0.1s ease',
        whiteSpace: 'nowrap',
        lineHeight: '18px',
        height: '26px',
        display: 'inline-flex',
        alignItems: 'center',
      }}
    >
      {label}
    </button>
  );
}

export default function BountyFilter({ filters, onChange }) {
  return (
    <div style={{
      background: t.colors.bg.card,
      border: '1px solid ' + t.colors.border.default,
      borderRadius: t.radius.lg,
      padding: '12px 14px',
      display: 'flex',
      flexDirection: 'column',
      gap: '10px',
    }}>

      {/* Search */}
      <div style={{ position: 'relative' }}>
        <div style={{
          position: 'absolute',
          left: '11px',
          top: '50%',
          transform: 'translateY(-50%)',
          pointerEvents: 'none',
          display: 'flex',
          color: t.colors.text.faint,
        }}>
          <IconSearch size={14} />
        </div>
        <input
          type="text"
          placeholder="Search bounties…"
          value={filters.search || ''}
          onChange={e => onChange({ ...filters, search: e.target.value })}
          style={{
            width: '100%',
            padding: '7px 34px 7px 32px',
            background: t.colors.bg.base,
            border: '1px solid ' + t.colors.border.default,
            borderRadius: t.radius.md,
            color: t.colors.text.primary,
            fontFamily: t.fonts.body,
            fontSize: '13px',
            outline: 'none',
            transition: 'border-color 0.12s ease',
          }}
          onFocus={e  => { e.target.style.borderColor = t.colors.border.active; }}
          onBlur={e   => { e.target.style.borderColor = t.colors.border.default; }}
        />
        {filters.search && (
          <button
            onClick={() => onChange({ ...filters, search: '' })}
            style={{
              position: 'absolute',
              right: '10px',
              top: '50%',
              transform: 'translateY(-50%)',
              background: 'none',
              border: 'none',
              color: t.colors.text.muted,
              cursor: 'pointer',
              display: 'flex',
              padding: '2px',
            }}
          >
            <IconClose size={13} />
          </button>
        )}
      </div>

      {/* Divider */}
      <div style={{ height: '1px', background: t.colors.border.subtle, margin: '0 -2px' }} />

      {/* Category row */}
      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{
          fontSize: '10px',
          color: t.colors.text.faint,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          fontWeight: 600,
          marginRight: '4px',
          flexShrink: 0,
        }}>
          Category
        </span>
        <Chip
          label="All"
          active={filters.category === 'all'}
          onClick={() => onChange({ ...filters, category: 'all' })}
        />
        {CATEGORIES.map(cat => (
          <Chip
            key={cat}
            label={CATEGORY_LABELS[cat] || cat}
            active={filters.category === cat}
            onClick={() => onChange({ ...filters, category: cat })}
          />
        ))}
      </div>

      {/* Status + Sort row */}
      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{
          fontSize: '10px',
          color: t.colors.text.faint,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          fontWeight: 600,
          marginRight: '4px',
          flexShrink: 0,
        }}>
          Status
        </span>
        {[
          { v: 'all',       l: 'All' },
          { v: 'active',    l: 'Active' },
          { v: 'completed', l: 'Completed' },
          { v: 'expired',   l: 'Expired' },
          { v: 'disputed',  l: 'Disputed' },
        ].map(s => (
          <Chip
            key={s.v}
            label={s.l}
            active={filters.status === s.v}
            onClick={() => onChange({ ...filters, status: s.v })}
          />
        ))}

        <div style={{ flex: 1 }} />

        <span style={{
          fontSize: '10px',
          color: t.colors.text.faint,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          fontWeight: 600,
          marginRight: '4px',
          flexShrink: 0,
        }}>
          Sort
        </span>
        {[
          { v: 'newest', l: 'Newest' },
          { v: 'reward', l: 'Top Reward' },
          { v: 'ending', l: 'Ending Soon' },
        ].map(s => (
          <Chip
            key={s.v}
            label={s.l}
            active={filters.sort === s.v}
            onClick={() => onChange({ ...filters, sort: s.v })}
          />
        ))}
      </div>

    </div>
  );
}
