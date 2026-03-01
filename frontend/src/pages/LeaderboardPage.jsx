import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { theme as t } from '@/styles/theme.js';
import { useLeaderboard } from '@/hooks/useLeaderboard.js';
import Card from '@/components/common/Card.jsx';
import { formatMON } from '@/utils/format.js';
import { useDisplayName } from '@/hooks/useIdentity.js';
import { AvatarDisplay } from '@/components/common/Avatar.jsx';
import { IconMedal, IconTarget, IconDashboard, IconTrophy } from '@/components/icons/index.jsx';

const PODIUM_COLORS = [t.colors.violet[400], t.colors.slate[400], '#a07850'];

function RankBadge({ rank }) {
  if (rank <= 3) return <IconMedal rank={rank} size={20} />;
  return (
    <span style={{
      fontFamily: t.fonts.mono,
      fontSize: '11px',
      fontWeight: 600,
      color: t.colors.text.muted,
      minWidth: '22px',
      textAlign: 'right',
    }}>
      #{rank}
    </span>
  );
}

function SkeletonRow() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 14px', borderBottom: '1px solid ' + t.colors.border.subtle }}>
      <div className="skeleton" style={{ width: '22px', height: '12px', borderRadius: t.radius.xs }} />
      <div className="skeleton" style={{ width: '28px', height: '28px', borderRadius: t.radius.sm }} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '5px' }}>
        <div className="skeleton" style={{ width: '110px', height: '11px', borderRadius: t.radius.xs }} />
        <div className="skeleton" style={{ width: '70px', height: '9px', borderRadius: t.radius.xs }} />
      </div>
      <div className="skeleton" style={{ width: '44px', height: '16px', borderRadius: t.radius.xs }} />
    </div>
  );
}

function PodiumCard({ rank, data, type }) {
  // FIX I-FE-2: Rules of Hooks — hooks must be called unconditionally before any early return
  const { displayName } = useDisplayName(data?.address);
  if (!data) return null;
  const color = PODIUM_COLORS[rank - 1];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: rank * 0.08 }}
      style={{
        flex: rank === 1 ? '1.15' : '1',
        padding: '18px 14px',
        textAlign: 'center',
        background: rank === 1 ? 'rgba(124,58,237,0.07)' : t.colors.bg.card,
        border: '1px solid ' + (rank === 1 ? 'rgba(124,58,237,0.22)' : t.colors.border.default),
        borderRadius: t.radius.xl,
        order: rank === 1 ? 0 : rank === 2 ? -1 : 1,
        marginTop: rank === 1 ? '0' : '20px',
      }}
    >
      {/* Medal */}
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '10px' }}>
        <IconMedal rank={rank} size={28} />
      </div>

      {/* Avatar */}
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '10px' }}>
        <AvatarDisplay address={data.address} size={36} />
      </div>

      <a
        href={'#/profile/' + data.address}
        style={{
          fontFamily: t.fonts.mono,
          fontSize: '12.5px',
          fontWeight: 600,
          color,
          textDecoration: 'none',
          display: 'block',
          marginBottom: '6px',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {displayName}
      </a>

      <div style={{
        fontFamily: t.fonts.mono,
        fontSize: '20px',
        fontWeight: 700,
        color: t.colors.text.primary,
        letterSpacing: '-0.04em',
      }}>
        {data.score}
      </div>
      <div style={{
        fontSize: '9.5px',
        color: t.colors.text.muted,
        marginTop: '2px',
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
      }}>
        Score
      </div>

      {type === 'hunter' && (
        <div style={{ marginTop: '8px', fontSize: '10.5px', color: t.colors.text.muted }}>
          {data.winCount} wins · {data.winRate}% win rate
        </div>
      )}
      {type === 'project' && (
        <div style={{ marginTop: '8px', fontSize: '10.5px', color: t.colors.text.muted }}>
          {data.completed}/{data.posted} completed
        </div>
      )}
    </motion.div>
  );
}

function TableRow({ rank, data, type }) {
  const [hov, setHov] = useState(false);
  const { displayName } = useDisplayName(data.address);

  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        padding: '11px 14px',
        borderBottom: '1px solid ' + t.colors.border.subtle,
        transition: 'background 0.12s ease',
        background: hov ? t.colors.bg.elevated : 'transparent',
        cursor: 'pointer',
      }}
      onClick={() => window.location.hash = '#/profile/' + data.address}
    >
      <div style={{ minWidth: '26px', display: 'flex', justifyContent: 'flex-end' }}>
        <RankBadge rank={rank} />
      </div>
      <AvatarDisplay address={data.address} size={28} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontFamily: t.fonts.mono,
          fontSize: '12px',
          fontWeight: 500,
          color: t.colors.text.primary,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {displayName}
        </div>
        {type === 'hunter' && (
          <div style={{ fontSize: '10.5px', color: t.colors.text.muted, marginTop: '2px' }}>
            {data.winCount} wins · {data.winCount + data.subCount > 0 ? Math.round(data.winRate) + '% win rate' : ''}
          </div>
        )}
        {type === 'project' && (
          <div style={{ fontSize: '10.5px', color: t.colors.text.muted, marginTop: '2px' }}>
            {data.completed} completed · {data.posted} posted
          </div>
        )}
      </div>
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <div style={{
          fontFamily: t.fonts.mono,
          fontSize: '13px',
          fontWeight: 700,
          color: t.colors.text.primary,
        }}>
          {data.score}
        </div>
        <div style={{ fontSize: '9.5px', color: t.colors.text.muted, marginTop: '1px' }}>pts</div>
      </div>
      {type === 'hunter' && data.totalEarned > 0n && (
        <div style={{ textAlign: 'right', minWidth: '75px', flexShrink: 0 }}>
          <div style={{ fontFamily: t.fonts.mono, fontSize: '11.5px', color: t.colors.violet[300] }}>
            {formatMON(data.totalEarned)}
          </div>
          <div style={{ fontSize: '9.5px', color: t.colors.text.muted }}>earned</div>
        </div>
      )}
    </div>
  );
}

export default function LeaderboardPage() {
  const { hunters, projects, loading, error } = useLeaderboard();
  const [tab, setTab] = useState('hunters');

  const data = tab === 'hunters' ? hunters : projects;
  const top3 = data.slice(0, 3);
  const rest = data.slice(3);

  return (
    <div>
      <div className="container" style={{ padding: 'clamp(1.5rem, 4vw, 3rem) clamp(1rem, 4vw, 2rem)' }}>
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
        >

          <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <h1 style={{
              fontWeight: 700,
              fontSize: 'clamp(22px, 4vw, 32px)',
              color: t.colors.text.primary,
              letterSpacing: '-0.035em',
              marginBottom: '8px',
            }}>
              Leaderboard
            </h1>
            <p style={{ fontSize: '13.5px', color: t.colors.text.muted, maxWidth: '400px', margin: '0 auto' }}>
              Top hunters and projects ranked by on-chain reputation score.
            </p>
          </div>

          {/* Tabs */}
          <div style={{
            display: 'flex',
            gap: '3px',
            marginBottom: '2rem',
            background: t.colors.bg.card,
            padding: '3px',
            borderRadius: t.radius.md,
            border: '1px solid ' + t.colors.border.default,
            maxWidth: '260px',
            margin: '0 auto 2rem',
          }}>
            {[
              { v: 'hunters',  l: 'Hunters',  Icon: IconTarget    },
              { v: 'projects', l: 'Projects', Icon: IconDashboard },
            ].map(tp => (
              <button
                key={tp.v}
                onClick={() => setTab(tp.v)}
                style={{
                  flex: 1,
                  padding: '7px 12px',
                  borderRadius: '6px',
                  background: tab === tp.v ? 'rgba(124,58,237,0.12)' : 'transparent',
                  border: '1px solid ' + (tab === tp.v ? 'rgba(124,58,237,0.25)' : 'transparent'),
                  color: tab === tp.v ? t.colors.violet[300] : t.colors.text.muted,
                  fontSize: '12.5px',
                  fontWeight: tab === tp.v ? 600 : 400,
                  cursor: 'pointer',
                  transition: 'background 0.12s ease, color 0.12s ease',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '5px',
                }}
              >
                <tp.Icon size={13} />
                {tp.l}
              </button>
            ))}
          </div>

          {error && (
            <div style={{ padding: '20px', textAlign: 'center', color: t.colors.text.muted, fontSize: '13.5px' }}>
              Failed to load leaderboard: {error}
            </div>
          )}

          {/* Podium — top 3 */}
          {!loading && data.length > 0 && (
            <div style={{
              display: 'flex',
              gap: '10px',
              marginBottom: '24px',
              alignItems: 'flex-end',
              justifyContent: 'center',
              maxWidth: '640px',
              margin: '0 auto 24px',
            }}>
              {[top3[1], top3[0], top3[2]].filter(Boolean).map((d) => {
                const rank = d === top3[0] ? 1 : d === top3[1] ? 2 : 3;
                return (
                  <PodiumCard
                    key={d.address}
                    rank={rank}
                    data={d}
                    type={tab === 'hunters' ? 'hunter' : 'project'}
                  />
                );
              })}
            </div>
          )}

          {/* Table — ranks 4–20 */}
          <div style={{ maxWidth: '640px', margin: '0 auto' }}>
            <Card style={{ padding: 0, overflow: 'hidden' }}>
              {loading ? (
                Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} />)
              ) : rest.length === 0 && data.length === 0 ? (
                <div style={{
                  padding: '48px 24px',
                  textAlign: 'center',
                  color: t.colors.text.muted,
                  fontSize: '13.5px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '12px',
                }}>
                  <IconTrophy size={32} color={t.colors.text.faint} />
                  No data yet. Complete bounties to appear here!
                </div>
              ) : (
                rest.map((d, i) => (
                  <TableRow
                    key={d.address}
                    rank={i + 4}
                    data={d}
                    type={tab === 'hunters' ? 'hunter' : 'project'}
                  />
                ))
              )}
            </Card>

            {/* Scoring legend */}
            <Card style={{ marginTop: '16px' }}>
              <div style={{
                fontSize: '10.5px',
                color: t.colors.text.muted,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                marginBottom: '12px',
                fontWeight: 600,
              }}>
                How scores are calculated
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '10px' }}>
                {(tab === 'hunters'
                  ? [
                      { label: 'Win a bounty',   pts: '+30 pts' },
                      { label: 'Submit work',     pts: '+5 pts'  },
                      { label: 'Earn 0.001 MON', pts: '+1 pt'   },
                    ]
                  : [
                      { label: 'Post a bounty',     pts: '+10 pts' },
                      { label: 'Complete a bounty', pts: '+20 pts' },
                      { label: 'Pay out 0.001 MON', pts: '+1 pt'   },
                    ]
                ).map(({ label, pts }) => (
                  <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px' }}>
                    <span style={{ color: t.colors.text.secondary }}>{label}</span>
                    <span style={{ fontFamily: t.fonts.mono, color: t.colors.violet[400], fontWeight: 600 }}>{pts}</span>
                  </div>
                ))}
              </div>
            </Card>
          </div>

        </motion.div>
      </div>
    </div>
  );
}
