import { theme } from '../styles/theme';
import { PageLoader } from '../components/common/Spinner';
import EmptyState from '../components/common/EmptyState';
import { IconWarning, IconTarget } from '../components/icons';
import { useLeaderboard } from '../hooks/useLeaderboard';

// Format Wei BigInt → MON string
function formatMon(wei) {
  if (!wei && wei !== 0n) return '0';
  try { return (Number(BigInt(wei)) / 1e18).toFixed(4).replace(/\.?0+$/, '') || '0'; }
  catch { return '0'; }
}

function RankBadge({ rank }) {
  // Silver and bronze from theme amber/cyan to stay consistent
  const medals = {
    1: { color: theme.colors.amber,      label: '①' },
    2: { color: theme.colors.text.muted, label: '②' },
    3: { color: theme.colors.cyan,       label: '③' },
  };
  const m = medals[rank];
  return (
    <span style={{
      fontFamily: theme.fonts.mono, fontSize: rank <= 3 ? 14 : 11,
      color: m ? m.color : theme.colors.text.muted,
      fontWeight: rank <= 3 ? 700 : 400,
      minWidth: 24, display: 'inline-block', textAlign: 'center',
    }}>
      {m ? m.label : rank}
    </span>
  );
}

export default function LeaderboardPage() {
  const { builders = [], loading, error } = useLeaderboard();

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: 'clamp(32px,5vw,64px) clamp(16px,4vw,48px)' }}>
      {/* Header */}
      <div style={{ marginBottom: 40 }}>
        <div className="page-eyebrow">NadWork · Leaderboard</div>
        <h1 className="page-title">Top Builders</h1>
        <p style={{ fontSize: 14, color: theme.colors.text.muted, fontWeight: 300, marginTop: 8 }}>
          Ranked by total MON earned across all completed bounties.
        </p>
      </div>

      {loading ? <PageLoader /> : error ? (
        <EmptyState icon={<IconWarning size={32} color={theme.colors.amber} />} title="Failed to load" message="Could not fetch leaderboard." />
      ) : builders.length === 0 ? (
        <EmptyState icon={<IconTarget size={32} color={theme.colors.text.faint} />} title="No builders yet" message="Complete a bounty to appear on the leaderboard." />
      ) : (
        <div style={{ border: `1px solid ${theme.colors.border.subtle}`, borderRadius: theme.radius.lg, overflow: 'hidden' }}>
          {/* Table header */}
          <div className="lb-grid" style={{
            padding: '10px 20px',
            borderBottom: `1px solid ${theme.colors.border.default}`,
            background: theme.colors.bg.panel,
          }}>
            {['#', 'Builder', 'Earned', 'Wins'].map((h, hi) => (
              <span key={h} className={hi === 3 ? 'lb-wins' : ''} style={{ fontFamily: theme.fonts.mono, fontSize: 11, color: theme.colors.text.muted, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{h}</span>
            ))}
          </div>

          {builders.map((builder, i) => {
            const rank   = i + 1;
            const isTop  = rank <= 3;
            const wins   = builder.winCount ?? 0;
            const earned = formatMon(builder.totalEarned);
            const topBg  = `${theme.colors.primaryDim}`;
            return (
              <div
                key={builder.address}
                onClick={() => { window.location.hash = `#/profile/${builder.address}`; }}
                className="lb-grid"
                style={{
                  padding: '14px 20px', alignItems: 'center',
                  borderBottom: i < builders.length - 1 ? `1px solid ${theme.colors.border.faint}` : 'none',
                  background: isTop ? topBg : 'transparent',
                  cursor: 'pointer', transition: theme.transition,
                }}
                onMouseEnter={e => { e.currentTarget.style.background = theme.colors.bg.elevated; }}
                onMouseLeave={e => { e.currentTarget.style.background = isTop ? topBg : 'transparent'; }}
              >
                <RankBadge rank={rank} />

                {/* Builder */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: '50%',
                    background: `hsl(${parseInt(builder.address.slice(2, 6), 16) % 360},50%,20%)`,
                    border: `1px solid ${theme.colors.border.default}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontFamily: theme.fonts.mono, fontSize: 11, color: theme.colors.text.secondary,
                    flexShrink: 0,
                  }}>
                    {builder.address.slice(2, 4).toUpperCase()}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontFamily: theme.fonts.body, fontWeight: 500, fontSize: 13, color: theme.colors.text.primary, letterSpacing: '-0.01em' }}>
                      {`${builder.address.slice(0, 6)}…${builder.address.slice(-4)}`}
                    </div>
                    <div style={{ fontFamily: theme.fonts.mono, fontSize: 9.5, color: theme.colors.text.faint }}>
                      {builder.address.slice(0, 10)}…
                    </div>
                  </div>
                </div>

                {/* Earned */}
                <span style={{ fontFamily: theme.fonts.mono, fontSize: 13, fontWeight: 500, color: theme.colors.primary }}>
                  {earned} MON
                </span>

                {/* Wins */}
                <span className="lb-wins" style={{ fontFamily: theme.fonts.mono, fontSize: 12, color: theme.colors.text.secondary }}>
                  {wins}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
