import { useState, useEffect, useRef } from 'react';
import { theme } from '../styles/theme';
import BountyCard from '../components/bounty/BountyCard';
import { PageLoader } from '../components/common/Spinner';
import EmptyState from '../components/common/EmptyState';
import { useBounties } from '../hooks/useBounties';
import { NETWORK_LABEL } from '../config/network.js';
import { IconArrowDown, IconTarget, IconClock, IconGrid, IconList, IconX, IconWarning, IconBounties } from '../components/icons';

// ── Constants ────────────────────────────────────────────────────────────────
const CATEGORIES  = ['All', 'Dev', 'Design', 'Content', 'Research', 'Other'];
const STATUSES    = ['All', 'Active', 'Reviewing', 'Completed', 'Expired'];
const TOP_SKILLS  = [
  'Solidity', 'React', 'TypeScript', 'UI/UX', 'Smart Contract',
  'DeFi', 'Figma', 'Python', 'Rust', 'Technical Writing',
];

const SORTS = [
  { key: 'newest', label: 'Newest',         Icon: IconArrowDown },
  { key: 'reward', label: 'Highest Reward', Icon: IconTarget },
  { key: 'ending', label: 'Ending Soon',    Icon: IconClock },
];

const SORT_MAP = {
  newest: 'newest',
  reward: 'reward',
  ending: 'ending',
};

const CAT_COLORS = {
  dev:      { color: theme.colors.cyan,  dim: theme.colors.cyanDim,  border: theme.colors.cyanBorder },
  design:   { color: theme.colors.pink,  dim: theme.colors.pinkDim,  border: theme.colors.pinkBorder },
  content:  { color: theme.colors.amber, dim: theme.colors.amberDim, border: theme.colors.amberBorder },
  research: { color: theme.colors.lavender?.[300] || '#c4b5fd', dim: 'rgba(196,181,253,0.08)', border: 'rgba(196,181,253,0.20)' },
  other:    { color: theme.colors.text.muted, dim: 'rgba(120,120,120,0.08)', border: 'rgba(120,120,120,0.20)' },
};

const getCatStyle = (cat) => CAT_COLORS[(cat || 'other').toLowerCase()] || CAT_COLORS.other;

// ── Sub-components ────────────────────────────────────────────────────────────
function FilterPill({ label, active, color, onClick }) {
  const [hov, setHov] = useState(false);
  const activeColor = color || theme.colors.primary;
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '6px 14px',
        background: active
          ? `${activeColor}18`
          : hov ? theme.colors.bg.elevated : 'transparent',
        color: active ? activeColor : hov ? theme.colors.text.secondary : theme.colors.text.muted,
        border: `1px solid ${active ? `${activeColor}40` : hov ? theme.colors.border.default : theme.colors.border.subtle}`,
        borderRadius: theme.radius.full,
        fontSize: 12, fontFamily: theme.fonts.body, fontWeight: active ? 600 : 400,
        cursor: 'pointer', transition: theme.transition,
        whiteSpace: 'nowrap',
        width: '100%', textAlign: 'left',
      }}
    >
      {label}
    </button>
  );
}

function SortButton({ item, active, onClick }) {
  const [hov, setHov] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '7px 14px',
        background: active ? theme.colors.primaryDim : hov ? theme.colors.bg.elevated : 'transparent',
        color: active ? theme.colors.primary : hov ? theme.colors.text.secondary : theme.colors.text.muted,
        border: `1px solid ${active ? theme.colors.primaryBorder : hov ? theme.colors.border.default : theme.colors.border.subtle}`,
        borderRadius: theme.radius.md,
        fontSize: 12, fontFamily: theme.fonts.body, fontWeight: active ? 600 : 400,
        cursor: 'pointer', transition: theme.transition,
        whiteSpace: 'nowrap', letterSpacing: '-0.01em',
      }}
    >
      <item.Icon size={12} color="currentColor" style={{ opacity: 0.7 }} />
      {item.label}
    </button>
  );
}

function ViewToggle({ view, onChange }) {
  return (
    <div style={{
      display: 'flex', gap: 2,
      background: theme.colors.bg.card,
      border: `1px solid ${theme.colors.border.subtle}`,
      borderRadius: theme.radius.md, padding: 3,
    }}>
      {[
        { v: 'grid', Icon: IconGrid },
        { v: 'list', Icon: IconList },
      ].map(({ v, Icon }) => (
        <button
          key={v}
          onClick={() => onChange(v)}
          style={{
            width: 32, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: view === v ? theme.colors.bg.elevated : 'transparent',
            color: view === v ? theme.colors.text.primary : theme.colors.text.muted,
            border: `1px solid ${view === v ? theme.colors.border.default : 'transparent'}`,
            borderRadius: 6, fontSize: 14, cursor: 'pointer', transition: theme.transition,
          }}
        >
          <Icon size={14} color="currentColor" />
        </button>
      ))}
    </div>
  );
}

// ── Sidebar filter panel ──────────────────────────────────────────────────────
function SidebarFilters({ filters, onChange, counts, selectedSkills, onSkillToggle, onClearSkills }) {
  const { category = 'All', status = 'All' } = filters;
  const update = (key, val) => onChange({ ...filters, [key]: val });

  return (
    <aside style={{
      width: 200, flexShrink: 0,
      display: 'flex', flexDirection: 'column', gap: 28,
    }}>
      {/* Category */}
      <div>
        <div style={{
          fontFamily: theme.fonts.mono, fontSize: 10, letterSpacing: '0.1em',
          textTransform: 'uppercase', color: theme.colors.text.faint,
          marginBottom: 10,
        }}>Category</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {CATEGORIES.map(c => {
            const cs = c === 'All' ? null : getCatStyle(c);
            return (
              <FilterPill
                key={c}
                label={c}
                active={category === c}
                color={cs?.color}
                onClick={() => update('category', c)}
              />
            );
          })}
        </div>
      </div>

      {/* Status */}
      <div>
        <div style={{
          fontFamily: theme.fonts.mono, fontSize: 10, letterSpacing: '0.1em',
          textTransform: 'uppercase', color: theme.colors.text.faint,
          marginBottom: 10,
        }}>Status</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {STATUSES.map(s => (
            <FilterPill
              key={s}
              label={s}
              active={status === s}
              onClick={() => update('status', s)}
            />
          ))}
        </div>
      </div>

      {/* Skills */}
      <div>
        <div style={{
          fontFamily: theme.fonts.mono, fontSize: 10, letterSpacing: '0.1em',
          textTransform: 'uppercase', color: theme.colors.text.faint,
          marginBottom: 10,
        }}>Skills</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {TOP_SKILLS.map(s => (
            <FilterPill
              key={s}
              label={s}
              active={selectedSkills.includes(s)}
              color={theme.colors.cyan}
              onClick={() => onSkillToggle(s)}
            />
          ))}
        </div>
        {selectedSkills.length > 0 && (
          <button
            onClick={onClearSkills}
            style={{
              marginTop: 8, width: '100%', padding: '5px 10px',
              background: 'transparent',
              border: `1px dashed ${theme.colors.border.subtle}`,
              borderRadius: theme.radius.md,
              fontFamily: theme.fonts.body, fontSize: 11,
              color: theme.colors.text.faint, cursor: 'pointer',
              transition: theme.transition,
            }}
            onMouseEnter={e => e.currentTarget.style.color = theme.colors.text.secondary}
            onMouseLeave={e => e.currentTarget.style.color = theme.colors.text.faint}
          >Clear skills</button>
        )}
      </div>

      {/* Quick stats */}
      {counts && (
        <div style={{
          padding: '14px 16px',
          background: theme.colors.bg.card,
          border: `1px solid ${theme.colors.border.subtle}`,
          borderRadius: theme.radius.lg,
        }}>
          {[
            { label: 'Total',     val: counts.total     ?? '—' },
            { label: 'Active',    val: counts.active    ?? '—' },
            { label: 'Completed', val: counts.completed ?? '—' },
          ].map(({ label, val }) => (
            <div key={label} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '5px 0',
              borderBottom: label !== 'Completed' ? `1px solid ${theme.colors.border.faint}` : 'none',
            }}>
              <span style={{ fontFamily: theme.fonts.body, fontSize: 12, color: theme.colors.text.muted }}>{label}</span>
              <span style={{ fontFamily: theme.fonts.mono, fontSize: 12, color: theme.colors.text.secondary }}>{val}</span>
            </div>
          ))}
        </div>
      )}
    </aside>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function BountiesPage() {
  const [filters, setFilters] = useState({
    search: '', category: 'All', status: 'All', sort: 'newest',
  });
  const [selectedSkills, setSelectedSkills] = useState([]);
  const [view, setView]   = useState('grid');
  const [mounted, setMounted] = useState(false);
  const searchRef = useRef(null);

  const toggleSkill = (s) => setSelectedSkills(prev =>
    prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]
  );

  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 40);
    return () => clearTimeout(timer);
  }, []);

  const normalizedFilters = {
    search:   filters.search,
    category: (filters.category || 'All').toLowerCase(),
    status:   (filters.status   || 'All').toLowerCase(),
    sort:     SORT_MAP[filters.sort] || 'newest',
  };

  const { bounties = [], total: totalFromHook, loading, error } = useBounties({ ...normalizedFilters, skills: selectedSkills });

  // Derive sidebar counts from data already fetched — no second hook call
  const sidebarCounts = {
    total:     totalFromHook ?? bounties.length,
    active:    bounties.filter(b => Number(b.status) === 0).length,
    completed: bounties.filter(b => Number(b.status) === 2).length,
  };

  const hasActiveFilters = filters.category !== 'All' || filters.status !== 'All' || filters.search || selectedSkills.length > 0;
  const resetFilters = () => { setFilters({ search: '', category: 'All', status: 'All', sort: filters.sort }); setSelectedSkills([]); };

  return (
    <div style={{
      maxWidth: 1320, margin: '0 auto',
      padding: 'clamp(28px,4vw,56px) clamp(20px,4vw,56px)',
      opacity: mounted ? 1 : 0, transition: 'opacity 0.3s ease',
    }}>

      {/* ── Page header ── */}
      <div style={{ marginBottom: 32 }}>
        <div style={{
          display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
          flexWrap: 'wrap', gap: 16,
        }}>
          <div>
            <div className="page-eyebrow">On-chain · {NETWORK_LABEL}</div>
            <h1 className="page-title" style={{ marginBottom: 8 }}>Bounties</h1>
            <p style={{ fontSize: 14, color: theme.colors.text.muted, fontWeight: 300, maxWidth: 400 }}>
              Pick a task, deliver the work, get paid in MON — on-chain, trustless.
            </p>
          </div>

          <a
            href="#/post"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '11px 24px',
              background: theme.colors.primary, color: '#fff',
              borderRadius: theme.radius.lg, fontSize: 14,
              fontFamily: theme.fonts.body, fontWeight: 600,
              letterSpacing: '-0.01em', textDecoration: 'none',
              boxShadow: `0 4px 24px ${theme.colors.primaryGlow}`,
              flexShrink: 0, marginTop: 4,
            }}
          >
            <span style={{ fontSize: 16, lineHeight: 1 }}>+</span>
            Post Bounty
          </a>
        </div>
      </div>

      {/* ── Search + Sort bar ── */}
      <div style={{
        display: 'flex', gap: 10, alignItems: 'center',
        marginBottom: 28, flexWrap: 'wrap',
      }}>
        {/* Search */}
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <span style={{
            position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
            color: theme.colors.text.muted, fontSize: 15, pointerEvents: 'none',
          }}>⌕</span>
          <input
            ref={searchRef}
            type="text"
            value={filters.search}
            onChange={e => setFilters(f => ({ ...f, search: e.target.value }))}
            placeholder="Search by title, category…"
            style={{
              width: '100%', padding: '10px 36px 10px 38px',
              background: theme.colors.bg.card,
              border: `1px solid ${theme.colors.border.subtle}`,
              borderRadius: theme.radius.lg,
              color: theme.colors.text.primary,
              fontSize: 14, fontFamily: theme.fonts.body,
              outline: 'none', transition: theme.transition,
              boxSizing: 'border-box',
            }}
            onFocus={e => {
              e.target.style.borderColor = theme.colors.primary;
              e.target.style.boxShadow = `0 0 0 3px ${theme.colors.primaryDim}`;
            }}
            onBlur={e => {
              e.target.style.borderColor = theme.colors.border.subtle;
              e.target.style.boxShadow = 'none';
            }}
          />
          {filters.search && (
            <button
              onClick={() => setFilters(f => ({ ...f, search: '' }))}
              style={{
                position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                background: 'none', border: 'none', cursor: 'pointer',
                color: theme.colors.text.muted, fontSize: 12, padding: 4, lineHeight: 1,
              }}
            ><IconX size={14} color="currentColor" /></button>
          )}
        </div>

        {/* Sort pills */}
        <div style={{ display: 'flex', gap: 5, flexShrink: 0, flexWrap: 'wrap' }}>
          {SORTS.map(s => (
            <SortButton
              key={s.key}
              item={s}
              active={filters.sort === s.key}
              onClick={() => setFilters(f => ({ ...f, sort: s.key }))}
            />
          ))}
        </div>

        <ViewToggle view={view} onChange={setView} />
      </div>

      {/* ── Body: sidebar + content ── */}
      <div style={{ display: 'flex', gap: 28, alignItems: 'flex-start' }}>

        {/* Sidebar — hidden on mobile via CSS class */}
        <div className="bounties-sidebar">
          <SidebarFilters
            filters={filters}
            onChange={setFilters}
            counts={sidebarCounts}
            selectedSkills={selectedSkills}
            onSkillToggle={toggleSkill}
            onClearSkills={() => setSelectedSkills([])}
          />
        </div>

        {/* Main content */}
        <div style={{ flex: 1, minWidth: 0 }}>

          {/* Result meta row */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            marginBottom: 16, flexWrap: 'wrap', gap: 8,
          }}>
            <div style={{
              fontFamily: theme.fonts.mono, fontSize: 11,
              color: theme.colors.text.faint, letterSpacing: '0.05em',
            }}>
              {loading ? 'Loading…' : `${bounties.length} result${bounties.length !== 1 ? 's' : ''}`}
              {!loading && (filters.category !== 'All' || filters.status !== 'All') && (
                <span style={{ color: theme.colors.text.muted }}>
                  {' · '}
                  {[filters.category !== 'All' && filters.category, filters.status !== 'All' && filters.status]
                    .filter(Boolean).join(' · ')}
                </span>
              )}
            </div>

            {/* Mobile filter toggle + active filter clear */}
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {hasActiveFilters && (
                <button
                  onClick={resetFilters}
                  style={{
                    padding: '4px 10px',
                    background: 'transparent',
                    border: `1px solid ${theme.colors.border.default}`,
                    borderRadius: theme.radius.full,
                    color: theme.colors.text.muted,
                    fontSize: 11, fontFamily: theme.fonts.mono,
                    cursor: 'pointer', transition: theme.transition,
                    letterSpacing: '0.03em',
                  }}
                  onMouseEnter={e => e.currentTarget.style.color = theme.colors.text.primary}
                  onMouseLeave={e => e.currentTarget.style.color = theme.colors.text.muted}
                >
                  <IconX size={10} style={{ marginRight: 4, verticalAlign: 'middle' }} /> Clear filters
                </button>
              )}
            </div>
          </div>

          {/* Active filter chips (mobile / quick remove) */}
          {hasActiveFilters && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
              {filters.category !== 'All' && (
                <ActiveChip
                  label={`Cat: ${filters.category}`}
                  onRemove={() => setFilters(f => ({ ...f, category: 'All' }))}
                  color={getCatStyle(filters.category).color}
                />
              )}
              {filters.status !== 'All' && (
                <ActiveChip
                  label={`Status: ${filters.status}`}
                  onRemove={() => setFilters(f => ({ ...f, status: 'All' }))}
                />
              )}
              {filters.search && (
                <ActiveChip
                  label={`"${filters.search}"`}
                  onRemove={() => setFilters(f => ({ ...f, search: '' }))}
                />
              )}
              {selectedSkills.map(s => (
                <ActiveChip
                  key={s}
                  label={s}
                  color={theme.colors.cyan}
                  onRemove={() => toggleSkill(s)}
                />
              ))}
            </div>
          )}

          {/* Content */}
          {loading ? (
            <div style={{ paddingTop: 60 }}><PageLoader /></div>
          ) : error ? (
            <EmptyState
              icon={<IconWarning size={32} color={theme.colors.amber} />}
              title="Failed to load bounties"
              message={error || 'Could not fetch from the contract. Please try again.'}
              action={() => window.location.reload()}
              actionLabel="Retry"
            />
          ) : bounties.length === 0 ? (
            <EmptyState
              icon={<IconBounties size={32} color={theme.colors.text.faint} />}
              title="No bounties match"
              message={hasActiveFilters ? 'Try adjusting your filters.' : 'Be the first to post a bounty on Monad.'}
              action={hasActiveFilters ? resetFilters : () => { window.location.hash = '#/post'; }}
              actionLabel={hasActiveFilters ? 'Clear Filters' : 'Post a Bounty'}
            />
          ) : view === 'grid' ? (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(280px,1fr))',
              gap: 12,
            }}>
              {bounties.map(b => (
                <BountyCard
                  key={String(b.id)} bounty={b} view="grid"
                  onClick={() => { window.location.hash = `#/bounty/${b.id}`; }}
                />
              ))}
            </div>
          ) : (
            <div style={{
              border: `1px solid ${theme.colors.border.subtle}`,
              borderRadius: theme.radius.xl, overflow: 'hidden',
              background: theme.colors.bg.card,
            }}>
              {/* List header */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 110px 90px 80px',
                gap: 8, padding: '8px 20px',
                borderBottom: `1px solid ${theme.colors.border.subtle}`,
                background: theme.colors.bg.panel,
              }}>
                {['Bounty', 'Reward', 'Deadline', 'Subs'].map(h => (
                  <span key={h} style={{
                    fontFamily: theme.fonts.mono, fontSize: 10,
                    color: theme.colors.text.faint, letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                  }}>{h}</span>
                ))}
              </div>

              {bounties.map((b, i) => (
                <ListRow
                  key={String(b.id)}
                  bounty={b}
                  last={i === bounties.length - 1}
                  onClick={() => { window.location.hash = `#/bounty/${b.id}`; }}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <style>{`
        .bounties-sidebar { display: flex; }
        @media (max-width: 768px) {
          .bounties-sidebar { display: none; }
        }
      `}</style>
    </div>
  );
}

// ── Active filter chip ────────────────────────────────────────────────────────
function ActiveChip({ label, onRemove, color }) {
  const c = color || theme.colors.text.muted;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '3px 10px 3px 12px',
      background: `${c}14`,
      border: `1px solid ${c}30`,
      borderRadius: theme.radius.full,
      fontSize: 11, fontFamily: theme.fonts.body,
      color: c,
    }}>
      {label}
      <button
        onClick={onRemove}
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: c, padding: 0, fontSize: 10, lineHeight: 1,
          opacity: 0.6, marginLeft: 2,
        }}
        onMouseEnter={e => e.currentTarget.style.opacity = '1'}
        onMouseLeave={e => e.currentTarget.style.opacity = '0.6'}
      ><IconX size={10} color="currentColor" /></button>
    </span>
  );
}

// ── Dedicated list row (richer than BountyCard list) ─────────────────────────
function ListRow({ bounty, last, onClick }) {
  const [hov, setHov] = useState(false);

  const title    = bounty?.title || (bounty?.id != null ? `Bounty #${bounty.id}` : 'Untitled Bounty');
  const category = (bounty?.category || 'other').toLowerCase();
  const rawReward = bounty?.totalReward;
  const reward   = bounty?.reward || bounty?.rewardAmount
    || (rawReward != null ? (Number(rawReward) / 1e18).toFixed(4).replace(/\.?0+$/, '') : '0');
  const _STATUS  = { 0: 'active', 1: 'reviewing', 2: 'completed', 3: 'expired', 4: 'cancelled', 5: 'disputed' };
  const status   = bounty?.status != null ? (_STATUS[Number(bounty.status)] || 'active') : 'active';
  const submCount = Number(bounty?.submissionCount ?? 0);
  const deadline  = bounty?.deadline || bounty?.expiresAt;
  const cs = getCatStyle(category);

  let timeLeft = null;
  if (deadline) {
    const ms = Number(deadline) * 1000 - Date.now();
    if (ms > 0) {
      const d = Math.floor(ms / 86400000);
      const h = Math.floor((ms % 86400000) / 3600000);
      timeLeft = d > 0 ? `${d}d ${h}h` : `${h}h`;
    } else {
      timeLeft = 'Ended';
    }
  }

  const statusColors = {
    active:    { color: theme.colors.green[400],  bg: theme.colors.green.dim  },
    reviewing: { color: theme.colors.amber,       bg: theme.colors.amberDim   },
    completed: { color: theme.colors.text.muted,  bg: 'transparent'           },
    expired:   { color: theme.colors.text.faint,  bg: 'transparent'           },
    cancelled: { color: theme.colors.red[400],    bg: theme.colors.red.dim    },
    disputed:  { color: theme.colors.pink,        bg: theme.colors.pinkDim    },
  };
  const sc = statusColors[status] || statusColors.active;

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr 110px 90px 80px',
        gap: 8, padding: '14px 20px',
        borderBottom: last ? 'none' : `1px solid ${theme.colors.border.faint}`,
        background: hov ? theme.colors.bg.elevated : 'transparent',
        cursor: 'pointer', transition: theme.transition,
        alignItems: 'center',
      }}
    >
      {/* Bounty info */}
      <div style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3, flexWrap: 'wrap' }}>
          {/* Status dot */}
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            padding: '2px 7px',
            background: sc.bg,
            borderRadius: theme.radius.full,
            fontSize: 10, fontFamily: theme.fonts.mono,
            color: sc.color, textTransform: 'uppercase', letterSpacing: '0.05em',
            flexShrink: 0,
          }}>{status}</span>
          {/* Category */}
          <span style={{
            display: 'inline-block',
            padding: '2px 7px',
            background: `${cs.color}14`,
            border: `1px solid ${cs.border}`,
            borderRadius: theme.radius.full,
            fontSize: 10, fontFamily: theme.fonts.mono,
            color: cs.color, textTransform: 'uppercase', letterSpacing: '0.05em',
            flexShrink: 0,
          }}>{category}</span>
        </div>
        <div style={{
          fontFamily: theme.fonts.body, fontWeight: 500, fontSize: 14,
          color: hov ? theme.colors.text.white : theme.colors.text.primary,
          letterSpacing: '-0.015em',
          overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis',
          transition: theme.transition,
        }}>{title}</div>
      </div>

      {/* Reward */}
      <div style={{
        fontFamily: theme.fonts.mono, fontSize: 14,
        fontWeight: 600, color: theme.colors.primary,
        letterSpacing: '-0.02em',
      }}>
        {reward}
        <span style={{ fontSize: 10, color: theme.colors.text.muted, marginLeft: 3 }}>MON</span>
      </div>

      {/* Deadline */}
      <div style={{
        fontFamily: theme.fonts.mono, fontSize: 11,
        color: timeLeft === 'Ended' ? theme.colors.text.faint : theme.colors.text.muted,
      }}>
        {timeLeft || '—'}
      </div>

      {/* Submissions */}
      <div style={{
        fontFamily: theme.fonts.mono, fontSize: 11,
        color: submCount > 0 ? theme.colors.text.secondary : theme.colors.text.faint,
      }}>
        {submCount}
        <span style={{ fontSize: 10, color: theme.colors.text.faint, marginLeft: 3 }}>subs</span>
      </div>
    </div>
  );
}

