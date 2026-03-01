import React, { useState, useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';
import { theme as t } from '@/styles/theme.js';
import { useBounties } from '@/hooks/useBounties.js';
import { useGlobalStats } from '@/hooks/useGlobalStats.js';
import BountyFilter from '@/components/bounty/BountyFilter.jsx';
import Button from '@/components/common/Button.jsx';
import Badge from '@/components/common/Badge.jsx';
import { PageLoader } from '@/components/common/Spinner.jsx';
import DeadlineTimer from '@/components/bounty/DeadlineTimer.jsx';
import { formatReward, categoryLabel } from '@/utils/format.js';
import { fetchJSON } from '@/config/pinata.js';
import { BOUNTY_STATUS, CATEGORY_LABELS } from '@/config/contracts.js';
import {
  IconPlus, IconSearch, IconChevronRight, IconArrowRight,
  IconShield, IconMonad, IconCheck, IconTarget, IconUpload,
} from '@/components/icons/index.jsx';

// ── Animation variants ──────────────────────────────────────────────────────
const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 18 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.45, delay, ease: [0.16, 1, 0.3, 1] },
});

const fadeIn = (delay = 0) => ({
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  transition: { duration: 0.35, delay },
});

// ── BountyFeedItem: compact row in hero live-feed panel ─────────────────────
function BountyFeedItem({ bounty, onClick }) {
  const [meta, setMeta] = useState(null);
  useEffect(() => {
    if (bounty.ipfsHash) fetchJSON(bounty.ipfsHash).then(setMeta).catch(() => {});
  }, [bounty.ipfsHash]);

  const title = meta?.title || bounty.title || '…';
  const cat   = meta?.category || bounty.category || '';

  return (
    <button
      onClick={onClick}
      style={{
        width: '100%',
        padding: '12px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '5px',
        cursor: 'pointer',
        background: 'none',
        border: 'none',
        borderBottom: '1px solid ' + t.colors.border.faint,
        textAlign: 'left',
        transition: 'background 0.1s ease',
      }}
      onMouseEnter={e => e.currentTarget.style.background = t.colors.bg.elevated}
      onMouseLeave={e => e.currentTarget.style.background = 'none'}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
        <span style={{
          fontSize: '12.5px',
          fontWeight: 500,
          color: t.colors.text.primary,
          letterSpacing: '-0.01em',
          lineHeight: 1.35,
          flex: 1,
          overflow: 'hidden',
          display: '-webkit-box',
          WebkitLineClamp: 1,
          WebkitBoxOrient: 'vertical',
        }}>{title}</span>
        <span style={{
          fontFamily: t.fonts.mono,
          fontSize: '11.5px',
          fontWeight: 700,
          color: t.colors.violet[400],
          flexShrink: 0,
        }}>{formatReward(bounty.totalReward, bounty.rewardType)}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        {cat && (
          <span style={{ fontSize: '10px', color: t.colors.text.muted, fontFamily: t.fonts.mono }}>
            {CATEGORY_LABELS[cat] || categoryLabel(cat)}
          </span>
        )}
        <span style={{ color: t.colors.border.strong, fontSize: '10px' }}>·</span>
        <DeadlineTimer deadline={bounty.deadline} />
      </div>
    </button>
  );
}

// ── BountyRow: table-style row for the bounty list ──────────────────────────
function BountyRow({ bounty, onClick, index }) {
  const [meta, setMeta] = useState(null);
  const [hov,  setHov]  = useState(false);
  useEffect(() => {
    if (bounty.ipfsHash) fetchJSON(bounty.ipfsHash).then(setMeta).catch(() => {});
  }, [bounty.ipfsHash]);

  const title     = meta?.title    || bounty.title    || '—';
  const cat       = meta?.category || bounty.category || '';
  const statusNum = Number(bounty.status);
  const statusKey = BOUNTY_STATUS[statusNum]?.toLowerCase() || 'active';
  const isActive  = statusNum === 0;

  return (
    <motion.div
      {...fadeUp(index * 0.04)}
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr 108px 88px 90px',
        alignItems: 'center',
        padding: '0',
        borderBottom: '1px solid ' + (hov ? t.colors.border.subtle : t.colors.border.faint),
        cursor: 'pointer',
        background: hov ? t.colors.bg.elevated : 'transparent',
        borderRadius: hov ? t.radius.md : '0',
        transition: 'background 0.12s ease, border-color 0.12s ease',
        marginLeft: hov ? '-12px' : '0',
        marginRight: hov ? '-12px' : '0',
        paddingLeft: hov ? '12px' : '0',
        paddingRight: hov ? '12px' : '0',
      }}
    >
      {/* Title + meta */}
      <div style={{ padding: '16px 16px 16px 0' }}>
        <div style={{
          fontSize: '13.5px',
          fontWeight: 550,
          color: t.colors.text.primary,
          letterSpacing: '-0.018em',
          lineHeight: 1.3,
          marginBottom: '3px',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          maxWidth: '480px',
        }}>{title}</div>
        <div style={{
          fontSize: '11px',
          color: t.colors.text.muted,
          fontFamily: t.fonts.mono,
          display: 'flex',
          gap: '6px',
          alignItems: 'center',
        }}>
          <span>{String(bounty.poster).slice(0,6)}…{String(bounty.poster).slice(-4)}</span>
          {cat && <><span style={{ color: t.colors.border.strong }}>·</span><span>{CATEGORY_LABELS[cat] || categoryLabel(cat)}</span></>}
          <span style={{ color: t.colors.border.strong }}>·</span>
          <span>{String(bounty.submissionCount)} sub{Number(bounty.submissionCount) !== 1 ? 's' : ''}</span>
        </div>
      </div>

      {/* Reward */}
      <div style={{ padding: '16px 8px' }}>
        <span style={{
          fontFamily: t.fonts.mono,
          fontSize: '13px',
          fontWeight: 700,
          color: t.colors.violet[300],
          letterSpacing: '-0.01em',
        }}>{formatReward(bounty.totalReward, bounty.rewardType)}</span>
      </div>

      {/* Status */}
      <div style={{ padding: '16px 8px' }}>
        <Badge type={statusKey} label={statusKey.charAt(0).toUpperCase() + statusKey.slice(1)} />
      </div>

      {/* Deadline */}
      <div style={{ padding: '16px 0 16px 8px' }}>
        {isActive
          ? <DeadlineTimer deadline={bounty.deadline} />
          : <span style={{ fontSize: '11px', color: t.colors.text.muted, fontFamily: t.fonts.mono }}>—</span>
        }
      </div>
    </motion.div>
  );
}

// ── Steps data ──────────────────────────────────────────────────────────────
const STEPS = [
  { n: '01', Icon: IconTarget,  title: 'Post a Bounty',   desc: 'Lock MON or USDC in escrow. Define the task, deadline, and prize structure.' },
  { n: '02', Icon: IconUpload,  title: 'Workers Submit',  desc: 'Anyone can submit work. Deliverables are stored permanently on IPFS.' },
  { n: '03', Icon: IconSearch,  title: 'Review & Select', desc: 'Poster reviews submissions and picks winner(s) directly on-chain.' },
  { n: '04', Icon: IconCheck,   title: 'Auto-Release',    desc: 'Smart contract releases funds to winners instantly. 3% platform fee.' },
];

// ── HomePage ─────────────────────────────────────────────────────────────────
export default function HomePage() {
  const [filters, setFilters] = useState({ category: 'all', status: 'all', sort: 'newest', search: '', page: 0 });
  const [page, setPage] = useState(0);

  const { bounties, hasMore, loading, total } = useBounties({ ...filters, page });
  const { bountyCount, submissionCount }       = useGlobalStats();

  const handleFilterChange = useCallback((next) => { setFilters(next); setPage(0); }, []);

  const listTitle = filters.search
    ? `Results for "${filters.search}"`
    : filters.category !== 'all'
      ? (CATEGORY_LABELS[filters.category] || filters.category) + ' Bounties'
      : filters.status !== 'all'
        ? filters.status.charAt(0).toUpperCase() + filters.status.slice(1) + ' Bounties'
        : 'All Bounties';

  return (
    <div>

      {/* ══════════════════════════════════════════════════════════════════════
          SECTION 1 — HERO (split: text left, live feed right)
      ══════════════════════════════════════════════════════════════════════ */}
      <section style={{
        minHeight: '100vh',
        position: 'relative',
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
      }}>

        {/* Subtle radial glow — center-left */}
        <div aria-hidden style={{
          position: 'absolute',
          top: '10%',
          left: '-10%',
          width: '60%',
          height: '70%',
          background: 'radial-gradient(ellipse at center, rgba(124,58,237,0.07) 0%, transparent 70%)',
          pointerEvents: 'none',
        }}/>

        {/* Fine dot grid */}
        <div aria-hidden style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: 'radial-gradient(circle, rgba(124,58,237,0.055) 1px, transparent 1px)',
          backgroundSize: '32px 32px',
          maskImage: 'radial-gradient(ellipse 80% 80% at 30% 40%, black 30%, transparent 100%)',
          WebkitMaskImage: 'radial-gradient(ellipse 80% 80% at 30% 40%, black 30%, transparent 100%)',
          pointerEvents: 'none',
        }}/>

        <div style={{
          width: '100%',
          maxWidth: '1160px',
          margin: '0 auto',
          padding: 'clamp(48px,8vh,80px) clamp(20px,5vw,48px)',
          display: 'grid',
          gridTemplateColumns: '1fr min(420px, 37%)',
          gap: 'clamp(32px, 5vw, 64px)',
          alignItems: 'center',
          position: 'relative',
        }}>

          {/* ── Left: editorial text ────────────────────────────────────── */}
          <div>

            {/* Live pill */}
            <motion.div {...fadeIn(0)} style={{ marginBottom: '36px' }}>
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '7px',
                border: '1px solid ' + t.colors.border.default,
                borderRadius: t.radius.full,
                padding: '4px 13px 4px 9px',
                fontSize: '10px',
                fontFamily: t.fonts.mono,
                fontWeight: 500,
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
                color: t.colors.text.muted,
              }}>
                <span style={{
                  width: '5px', height: '5px', borderRadius: '50%',
                  background: t.colors.green[500], flexShrink: 0,
                  animation: 'livePulse 2.5s ease-in-out infinite',
                }}/>
                Live on Monad Mainnet
              </span>
            </motion.div>

            {/* Massive headline — 3 lines, each animated */}
            <div style={{ marginBottom: '28px' }}>
              {['Work.', 'Win.', 'Earn.'].map((word, i) => (
                <motion.div
                  key={word}
                  {...fadeUp(0.08 + i * 0.1)}
                  style={{
                    display: 'block',
                    fontWeight: 900,
                    fontSize: 'clamp(60px, 9vw, 108px)',
                    lineHeight: 0.9,
                    letterSpacing: t.tracking.display,
                    color: i < 2 ? t.colors.text.primary : t.colors.violet[400],
                    marginBottom: '4px',
                  }}
                >{word}</motion.div>
              ))}
            </div>

            {/* Subtitle */}
            <motion.p
              {...fadeIn(0.42)}
              style={{
                fontSize: 'clamp(13px, 1.6vw, 15px)',
                color: t.colors.text.muted,
                lineHeight: 1.75,
                maxWidth: '400px',
                marginBottom: '36px',
                letterSpacing: '-0.005em',
              }}
            >
              The on-chain bounty platform for Monad. Projects post tasks, workers deliver — funds auto-release via smart contract. No middleman.
            </motion.p>

            {/* Inline stats strip */}
            <motion.div
              {...fadeIn(0.5)}
              style={{
                display: 'flex',
                width: 'fit-content',
                border: '1px solid ' + t.colors.border.subtle,
                borderRadius: t.radius.md,
                overflow: 'hidden',
                marginBottom: '32px',
              }}
            >
              {[
                { v: String(bountyCount ?? '—'), l: 'Bounties' },
                { v: '3%',                       l: 'Fee' },
                { v: 'MON',                      l: 'Rewards' },
              ].map((s, i, arr) => (
                <div key={s.l} style={{
                  padding: '9px 18px',
                  borderRight: i < arr.length - 1 ? '1px solid ' + t.colors.border.subtle : 'none',
                  textAlign: 'center',
                }}>
                  <div style={{
                    fontFamily: t.fonts.mono,
                    fontSize: '17px',
                    fontWeight: 700,
                    color: t.colors.text.primary,
                    letterSpacing: '-0.03em',
                    lineHeight: 1,
                    marginBottom: '2px',
                  }}>{s.v}</div>
                  <div style={{
                    fontSize: '9px',
                    color: t.colors.text.muted,
                    textTransform: 'uppercase',
                    letterSpacing: '0.07em',
                    fontWeight: 500,
                  }}>{s.l}</div>
                </div>
              ))}
            </motion.div>

            {/* CTA buttons */}
            <motion.div {...fadeUp(0.56)} style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
              <Button
                size="lg"
                onClick={() => document.getElementById('bounty-list')?.scrollIntoView({ behavior: 'smooth' })}
              >
                Browse Bounties
              </Button>
              <Button
                size="lg"
                variant="secondary"
                icon={<IconPlus size={13} />}
                onClick={() => { window.location.hash = '#/post'; }}
              >
                Post a Bounty
              </Button>
            </motion.div>

          </div>

          {/* ── Right: live bounty feed panel ───────────────────────────── */}
          <motion.div
            initial={{ opacity: 0, x: 24, y: 8 }}
            animate={{ opacity: 1, x: 0, y: 0 }}
            transition={{ duration: 0.55, delay: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="hide-mobile"
            style={{
              background: t.colors.bg.panel,
              border: '1px solid ' + t.colors.border.subtle,
              borderRadius: t.radius.xl,
              overflow: 'hidden',
              boxShadow: t.shadow.violetMd,
            }}
          >
            {/* Panel header */}
            <div style={{
              padding: '11px 16px',
              borderBottom: '1px solid ' + t.colors.border.faint,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                <span style={{
                  width: '5px', height: '5px', borderRadius: '50%',
                  background: t.colors.green[500],
                  animation: 'livePulse 2.5s ease-in-out infinite',
                }}/>
                <span style={{
                  fontSize: '9.5px',
                  fontFamily: t.fonts.mono,
                  fontWeight: 600,
                  color: t.colors.text.muted,
                  letterSpacing: '0.09em',
                  textTransform: 'uppercase',
                }}>Live Bounties</span>
              </div>
              {total > 0 && (
                <span style={{ fontSize: '10px', fontFamily: t.fonts.mono, color: t.colors.text.muted }}>
                  {total} total
                </span>
              )}
            </div>

            {/* Feed rows */}
            {loading && bounties.length === 0 ? (
              [...Array(3)].map((_, i) => (
                <div key={i} style={{ padding: '14px 16px', borderBottom: '1px solid ' + t.colors.border.faint }}>
                  <div className="skeleton" style={{ height: '12px', borderRadius: '3px', width: '75%', marginBottom: '8px' }}/>
                  <div className="skeleton" style={{ height: '9px',  borderRadius: '3px', width: '45%' }}/>
                </div>
              ))
            ) : bounties.length === 0 ? (
              <div style={{ padding: '28px 16px', textAlign: 'center', color: t.colors.text.muted, fontSize: '12px' }}>
                No bounties yet — be the first.
              </div>
            ) : (
              bounties.slice(0, 4).map(b => (
                <BountyFeedItem
                  key={String(b.id)}
                  bounty={b}
                  onClick={() => { window.location.hash = '#/bounty/' + String(b.id); }}
                />
              ))
            )}

            {/* Panel footer */}
            <button
              onClick={() => document.getElementById('bounty-list')?.scrollIntoView({ behavior: 'smooth' })}
              style={{
                width: '100%',
                padding: '11px 16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: 'transparent',
                cursor: 'pointer',
                color: t.colors.violet[400],
                fontSize: '11.5px',
                fontWeight: 500,
                letterSpacing: '-0.005em',
                transition: 'background 0.1s ease',
                border: 'none',
                borderTop: '1px solid ' + t.colors.border.faint,
              }}
              onMouseEnter={e => e.currentTarget.style.background = t.colors.bg.elevated}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <span>View all bounties</span>
              <IconChevronRight size={14} color={t.colors.violet[400]} />
            </button>
          </motion.div>

        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════════
          SECTION 2 — BOUNTY LIST (table format)
      ══════════════════════════════════════════════════════════════════════ */}
      <section id="bounty-list" style={{
        padding: 'clamp(3rem, 7vw, 5.5rem) 0',
        borderTop: '1px solid ' + t.colors.border.subtle,
      }}>
        <div className="container">

          {/* Header */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            flexWrap: 'wrap',
            gap: '16px',
            marginBottom: '20px',
          }}>
            <div>
              <h2 style={{
                fontWeight: 800,
                fontSize: 'clamp(18px, 3vw, 26px)',
                letterSpacing: t.tracking.tight,
                color: t.colors.text.primary,
                lineHeight: 1.1,
                marginBottom: '3px',
              }}>{listTitle}</h2>
              {!loading && total > 0 && (
                <span style={{ fontSize: '11px', color: t.colors.text.muted, fontFamily: t.fonts.mono }}>
                  {bounties.length}{total > bounties.length ? ' / ' + total : ''} bounties
                </span>
              )}
            </div>
            <Button size="sm" variant="secondary" icon={<IconPlus size={12} />}
              onClick={() => { window.location.hash = '#/post'; }}>
              Post Bounty
            </Button>
          </div>

          {/* Filter */}
          <BountyFilter filters={filters} onChange={handleFilterChange} />

          {/* Table */}
          <div style={{ marginTop: '28px' }}>
            {loading && bounties.length === 0 ? (
              <div>
                {/* Skeleton header */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 108px 88px 90px',
                  paddingBottom: '10px',
                  borderBottom: '1px solid ' + t.colors.border.default,
                  marginBottom: '4px',
                }}>
                  {['Title', 'Reward', 'Status', 'Deadline'].map(h => (
                    <div key={h} style={{
                      fontSize: '9.5px', fontFamily: t.fonts.mono,
                      fontWeight: 500, letterSpacing: '0.08em',
                      textTransform: 'uppercase', color: t.colors.text.muted,
                    }}>{h}</div>
                  ))}
                </div>
                {[...Array(6)].map((_, i) => (
                  <div key={i} style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 108px 88px 90px',
                    padding: '16px 0',
                    borderBottom: '1px solid ' + t.colors.border.faint,
                    gap: '16px',
                    alignItems: 'center',
                  }}>
                    <div>
                      <div className="skeleton" style={{ height: '13px', borderRadius: '3px', width: '65%', marginBottom: '7px' }}/>
                      <div className="skeleton" style={{ height: '9px',  borderRadius: '3px', width: '38%' }}/>
                    </div>
                    <div className="skeleton" style={{ height: '12px', borderRadius: '3px', width: '60px' }}/>
                    <div className="skeleton" style={{ height: '18px', borderRadius: '3px', width: '54px' }}/>
                    <div className="skeleton" style={{ height: '11px', borderRadius: '3px', width: '50px' }}/>
                  </div>
                ))}
              </div>
            ) : bounties.length === 0 ? (
              <div style={{
                padding: '64px 0',
                textAlign: 'center',
                color: t.colors.text.muted,
              }}>
                <div style={{ fontSize: '28px', marginBottom: '12px', opacity: 0.3 }}>○</div>
                <p style={{ fontSize: '13px', marginBottom: '16px' }}>
                  {filters.search || filters.category !== 'all' || filters.status !== 'all'
                    ? 'No bounties match these filters'
                    : 'No bounties yet'}
                </p>
                <Button size="sm" onClick={() => { window.location.hash = '#/post'; }}>
                  Post the first bounty
                </Button>
              </div>
            ) : (
              <>
                {/* Table header */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 108px 88px 90px',
                  paddingBottom: '10px',
                  borderBottom: '1px solid ' + t.colors.border.default,
                  marginBottom: '4px',
                }}>
                  {['Title', 'Reward', 'Status', 'Deadline'].map(h => (
                    <div key={h} style={{
                      fontSize: '9.5px', fontFamily: t.fonts.mono,
                      fontWeight: 500, letterSpacing: '0.08em',
                      textTransform: 'uppercase', color: t.colors.text.muted,
                    }}>{h}</div>
                  ))}
                </div>

                {/* Rows */}
                {bounties.map((b, i) => (
                  <BountyRow
                    key={String(b.id)}
                    bounty={b}
                    index={i}
                    onClick={() => { window.location.hash = '#/bounty/' + String(b.id); }}
                  />
                ))}

                {hasMore && (
                  <div style={{ textAlign: 'center', marginTop: '32px' }}>
                    <Button variant="secondary" loading={loading} onClick={() => setPage(p => p + 1)}>
                      Load more
                    </Button>
                    <div style={{ fontSize: '10.5px', color: t.colors.text.muted, marginTop: '8px', fontFamily: t.fonts.mono }}>
                      {bounties.length} of {total}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════════
          SECTION 3 — HOW IT WORKS (horizontal numbered timeline)
      ══════════════════════════════════════════════════════════════════════ */}
      <section style={{
        padding: 'clamp(3.5rem, 8vw, 6rem) 0',
        borderTop: '1px solid ' + t.colors.border.subtle,
        background: t.colors.bg.panel,
        position: 'relative',
        overflow: 'hidden',
      }}>

        {/* Background accent */}
        <div aria-hidden style={{
          position: 'absolute',
          bottom: 0, right: 0,
          width: '40%',
          height: '100%',
          background: 'radial-gradient(ellipse at bottom right, rgba(124,58,237,0.05) 0%, transparent 60%)',
          pointerEvents: 'none',
        }}/>

        <div className="container" style={{ position: 'relative' }}>

          {/* Section label + title */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.35 }}
            style={{ marginBottom: 'clamp(2.5rem, 5vw, 4rem)' }}
          >
            <div style={{
              fontSize: '9px',
              fontFamily: t.fonts.mono,
              fontWeight: 600,
              color: t.colors.violet[600],
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              marginBottom: '12px',
            }}>How it works</div>
            <h2 style={{
              fontWeight: 800,
              fontSize: 'clamp(22px, 3.5vw, 34px)',
              letterSpacing: t.tracking.tight,
              color: t.colors.text.primary,
              lineHeight: 1.1,
              maxWidth: '480px',
            }}>
              From task to payout —{' '}
              <span style={{ color: t.colors.text.muted, fontWeight: 400 }}>fully on-chain</span>
            </h2>
          </motion.div>

          {/* Steps grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '0',
            position: 'relative',
          }}>

            {/* Horizontal connecting line */}
            <div aria-hidden style={{
              position: 'absolute',
              top: '19px',
              left: '36px',
              right: '36px',
              height: '1px',
              background: 'linear-gradient(90deg, transparent, ' + t.colors.border.default + ' 15%, ' + t.colors.border.default + ' 85%, transparent)',
              zIndex: 0,
            }}/>

            {STEPS.map((step, i) => (
              <motion.div
                key={step.n}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-40px' }}
                transition={{ delay: i * 0.1, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                style={{
                  position: 'relative',
                  zIndex: 1,
                  paddingRight: 'clamp(8px, 2.5vw, 32px)',
                }}
              >
                {/* Circle number */}
                <div style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '50%',
                  background: t.colors.bg.elevated,
                  border: '1px solid ' + t.colors.border.strong,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontFamily: t.fonts.mono,
                  fontSize: '10.5px',
                  fontWeight: 700,
                  color: t.colors.violet[400],
                  letterSpacing: '0.02em',
                  marginBottom: '22px',
                }}>
                  {step.n}
                </div>

                {/* Icon */}
                <div style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: t.radius.md,
                  background: 'rgba(124,58,237,0.07)',
                  border: '1px solid rgba(124,58,237,0.14)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: '14px',
                }}>
                  <step.Icon size={16} color={t.colors.violet[400]} />
                </div>

                <h3 style={{
                  fontWeight: 650,
                  fontSize: '14px',
                  color: t.colors.text.primary,
                  letterSpacing: '-0.02em',
                  marginBottom: '8px',
                }}>{step.title}</h3>
                <p style={{
                  fontSize: '12.5px',
                  color: t.colors.text.muted,
                  lineHeight: 1.7,
                  maxWidth: '200px',
                }}>{step.desc}</p>
              </motion.div>
            ))}
          </div>

        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════════
          SECTION 4 — CTA (solid violet — biggest visual contrast)
      ══════════════════════════════════════════════════════════════════════ */}
      <section style={{
        background: t.colors.violet[600],
        padding: 'clamp(4rem, 9vw, 7rem) 0',
        position: 'relative',
        overflow: 'hidden',
      }}>

        {/* Noise texture overlay (subtle) */}
        <div aria-hidden style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.04) 1px, transparent 1px)',
          backgroundSize: '24px 24px',
          pointerEvents: 'none',
        }}/>

        {/* Glow top */}
        <div aria-hidden style={{
          position: 'absolute',
          top: '-40%',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '60%',
          height: '100%',
          background: 'radial-gradient(ellipse at center, rgba(255,255,255,0.08) 0%, transparent 60%)',
          pointerEvents: 'none',
        }}/>

        <div className="container" style={{ textAlign: 'center', position: 'relative' }}>

          <motion.h2
            initial={{ opacity: 0, y: 14 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4 }}
            style={{
              fontWeight: 900,
              fontSize: 'clamp(28px, 6vw, 52px)',
              letterSpacing: t.tracking.display,
              color: '#ffffff',
              lineHeight: 0.95,
              marginBottom: '16px',
            }}
          >
            Start earning<br />
            <span style={{ opacity: 0.75 }}>today.</span>
          </motion.h2>

          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.35, delay: 0.1 }}
            style={{
              fontSize: 'clamp(13px, 1.8vw, 15px)',
              color: 'rgba(255,255,255,0.58)',
              marginBottom: '40px',
              lineHeight: 1.65,
              maxWidth: '360px',
              margin: '0 auto 40px',
            }}
          >
            The on-chain bounty platform for Monad. No middleman. No trust required.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.35, delay: 0.16 }}
            style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}
          >
            {/* White filled button */}
            <button
              onClick={() => document.getElementById('bounty-list')?.scrollIntoView({ behavior: 'smooth' })}
              style={{
                height: '44px',
                padding: '0 28px',
                borderRadius: t.radius.md,
                background: '#ffffff',
                color: t.colors.violet[700],
                fontWeight: 700,
                fontSize: '13.5px',
                letterSpacing: '-0.015em',
                cursor: 'pointer',
                border: 'none',
                transition: 'opacity 0.1s ease, transform 0.08s ease',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                fontFamily: t.fonts.body,
              }}
              onMouseEnter={e => { e.currentTarget.style.opacity = '0.92'; }}
              onMouseLeave={e => { e.currentTarget.style.opacity = '1'; }}
              onMouseDown={e => { e.currentTarget.style.transform = 'scale(0.97)'; }}
              onMouseUp={e => { e.currentTarget.style.transform = 'scale(1)'; }}
            >
              Browse Bounties
            </button>

            {/* Ghost white button */}
            <button
              onClick={() => { window.location.hash = '#/post'; }}
              style={{
                height: '44px',
                padding: '0 28px',
                borderRadius: t.radius.md,
                background: 'rgba(255,255,255,0.1)',
                color: '#ffffff',
                fontWeight: 600,
                fontSize: '13.5px',
                letterSpacing: '-0.015em',
                cursor: 'pointer',
                border: '1px solid rgba(255,255,255,0.22)',
                transition: 'background 0.12s ease, transform 0.08s ease',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                fontFamily: t.fonts.body,
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.16)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; }}
              onMouseDown={e => { e.currentTarget.style.transform = 'scale(0.97)'; }}
              onMouseUp={e => { e.currentTarget.style.transform = 'scale(1)'; }}
            >
              <IconPlus size={13} color="white" />
              Post a Bounty
            </button>
          </motion.div>

        </div>
      </section>

    </div>
  );
}
