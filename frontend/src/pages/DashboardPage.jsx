import { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { theme } from '../styles/theme';
import Button from '../components/common/Button';
import Badge from '../components/common/Badge';
import EmptyState from '../components/common/EmptyState';
import { PageLoader } from '../components/common/Spinner';
import { IconBounties, IconTarget, IconChevronRight, IconChevronUp, IconChevronDown, IconWallet } from '../components/icons';
import SubmissionViewer from '../components/bounty/SubmissionViewer';
import { useProfile } from '../hooks/useProfile';
import { usePendingClaims } from '../hooks/usePendingClaims';
import { hasIndexer, querySubgraph, GQL_GET_CREATOR_BOUNTIES } from '../hooks/useIndexer';
import { ADDRESSES, FACTORY_ABI } from '../config/contracts';
import { getReadContractFast } from '../utils/ethers';
import { getFactoryCapabilities } from '../utils/factoryCapabilities';
import { getResolvedRegistryContract } from '../utils/registry.js';
import { toast } from '../utils/toast';

const BOUNTY_STATUS = { 0: 'active', 1: 'reviewing', 2: 'completed', 3: 'expired', 4: 'cancelled', 5: 'disputed' };
const SUB_STATUS    = { 0: 'pending', 1: 'approved', 2: 'rejected' };
const normStatus  = (s) => s == null ? 'unknown' : BOUNTY_STATUS[Number(s)] || String(s).toLowerCase();
const normSubStatus = (s) => s == null ? 'pending' : SUB_STATUS[Number(s)] || String(s).toLowerCase();
const formatMon  = (wei) => wei != null ? (Number(wei) / 1e18).toFixed(4).replace(/\.?0+$/, '') || '0' : '0';

function StatCard({ label, value, sub, accent }) {
  return (
    <div style={{
      padding: '20px',
      background: theme.colors.bg.card,
      border: `1px solid ${theme.colors.border.subtle}`,
      borderRadius: theme.radius.lg,
    }}>
      <div style={{ fontFamily: theme.fonts.mono, fontSize: 9.5, color: theme.colors.text.faint, letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 10 }}>
        {label}
      </div>
      <div style={{
        fontFamily: theme.fonts.mono, fontSize: 28, fontWeight: 500,
        color: accent || theme.colors.text.primary, letterSpacing: '-0.03em', lineHeight: 1, marginBottom: 4,
      }}>
        {value}
      </div>
      {sub && <div style={{ fontFamily: theme.fonts.body, fontSize: 11, color: theme.colors.text.muted }}>{sub}</div>}
    </div>
  );
}

// ── App status map ────────────────────────────────────────────────────────────
const APP_STATUS_MAP = { 0: 'pending', 1: 'approved', 2: 'rejected' };
function normAppStatus(s) { return s == null ? 'pending' : APP_STATUS_MAP[Number(s)] || 'pending'; }

export default function DashboardPage() {
  const { address, isConnected } = useAccount();
  const { builderStats, creatorStats, score, bountyIds = [], submissions = [], loading } = useProfile(address);
  const { claims, hasPending, formatMon: fmtMon, claim, claiming } = usePendingClaims();
  const [tab,          setTab]         = useState('posted');
  const [expandedSub,  setExpandedSub] = useState(null);
  const [myApplications, setMyApplications] = useState([]);
  const [appsLoading,  setAppsLoading] = useState(false);
  const [myBounties,   setMyBounties]  = useState([]);
  const [, setBountiesLoading] = useState(false);
  const [submissionBounties, setSubmissionBounties] = useState({});

  // Fetch creator bounty details (title, reward, status)
  useEffect(() => {
    if (!bountyIds?.length) {
      setMyBounties([]);
      return;
    }

    let cancelled = false;
    setBountiesLoading(true);

    const load = async () => {
      const fallbackRows = bountyIds.map((id) => ({ id: String(id), title: null, totalReward: null, status: null }));

      try {
        const { contract: reg } = await getResolvedRegistryContract();
        if (!reg) {
          if (!cancelled) setMyBounties(fallbackRows);
          return;
        }

        const rows = await Promise.all(bountyIds.map((bid) => reg.getBounty(bid).catch(() => null)));
        if (cancelled) return;

        setMyBounties(bountyIds.map((id, i) => {
          const b = rows[i];
          return {
            id: String(id),
            title: b?.title || null,
            totalReward: b?.totalReward ?? null,
            status: b?.status != null ? Number(b.status) : null,
          };
        }));
      } catch {
        if (!cancelled) setMyBounties(fallbackRows);
      } finally {
        if (!cancelled) setBountiesLoading(false);
      }
    };

    void load();
    return () => { cancelled = true; };
  }, [bountyIds?.join(',')]);


  // Enrich posted bounty rows from indexer when registry detail is unavailable (legacy/migrated rows)
  useEffect(() => {
    if (!address || !myBounties.length || !hasIndexer()) return;

    const needsEnrich = myBounties.some((b) => !b?.title || b?.totalReward == null || b?.status == null);
    if (!needsEnrich) return;

    let cancelled = false;

    const run = async () => {
      const raw = String(address);
      const lower = raw.toLowerCase();

      const dataLower = await querySubgraph(GQL_GET_CREATOR_BOUNTIES, { creator: lower }).catch(() => null);
      let rows = dataLower?.bounties || [];

      if (rows.length === 0 && raw !== lower) {
        const dataRaw = await querySubgraph(GQL_GET_CREATOR_BOUNTIES, { creator: raw }).catch(() => null);
        rows = dataRaw?.bounties || [];
      }

      if (cancelled || !rows.length) return;

      const byId = Object.fromEntries(rows.map((r) => [String(r?.id), r]));

      setMyBounties((prev) => {
        let changed = false;
        const next = prev.map((b) => {
          const row = byId[String(b.id)];
          if (!row) return b;

          const merged = {
            ...b,
            title: b.title || row.title || null,
            totalReward: b.totalReward ?? row.totalReward ?? null,
            status: b.status != null ? b.status : (row.status != null ? Number(row.status) : null),
          };

          if (merged.title !== b.title || merged.totalReward !== b.totalReward || merged.status !== b.status) {
            changed = true;
          }
          return merged;
        });

        return changed ? next : prev;
      });
    };

    void run();
    return () => { cancelled = true; };
  }, [address, myBounties.map((b) => String(b.id) + ':' + (b.title ? '1' : '0') + ':' + (b.totalReward == null ? '0' : '1') + ':' + (b.status == null ? '0' : '1')).join('|')]);
  // Fetch bounty details for submissions (title, reward)
  useEffect(() => {
    if (!submissions?.length) return;
    let cancelled = false;

    const load = async () => {
      try {
        const { contract: reg } = await getResolvedRegistryContract();
        if (!reg) return;

        const uniqueIds = [...new Set(submissions.map((s) => String(s.bountyId)))];
        const rows = await Promise.all(uniqueIds.map((bid) => reg.getBounty(bid).catch(() => null)));
        if (cancelled) return;

        const map = {};
        uniqueIds.forEach((id, i) => {
          const b = rows[i];
          map[id] = b ? { title: b.title, totalReward: b.totalReward } : null;
        });
        setSubmissionBounties(map);
      } catch {
        // non-fatal: keep existing map
      }
    };

    void load();
    return () => { cancelled = true; };
  }, [submissions?.map(s => String(s.bountyId)).join(',')]);

  // Fetch builder applications (skip on open-only/legacy deployments)
  useEffect(() => {
    if (!address || !ADDRESSES.factory) return;
    let cancelled = false;
    setAppsLoading(true);

    const load = async () => {
      const caps = await getFactoryCapabilities().catch(() => null);
      if (caps?.openOnlyLegacy || caps?.supportsApplications === false) {
        if (!cancelled) {
          setMyApplications([]);
          setAppsLoading(false);
        }
        return;
      }

      const f = getReadContractFast(ADDRESSES.factory, FACTORY_ABI);
      f.getBuilderApplications(address)
        .then((apps) => { if (!cancelled) setMyApplications(apps ?? []); })
        .catch(() => { if (!cancelled) setMyApplications([]); })
        .finally(() => { if (!cancelled) setAppsLoading(false); });
    };

    void load();
    return () => { cancelled = true; };
  }, [address]);

  // Map raw hook data → display shape
  const profile = (builderStats || creatorStats) ? {
    totalEarned:    formatMon(builderStats?.totalEarned ?? builderStats?.[2]),
    completedCount: Number(builderStats?.winCount       ?? builderStats?.[1] ?? 0),
    postedCount:    Number(creatorStats?.bountiesPosted    ?? creatorStats?.[0] ?? 0),
    completedPosts: Number(creatorStats?.bountiesCompleted ?? creatorStats?.[1] ?? 0),
    score:          Number(score ?? 0),
  } : null;

  const handleClaim = async (type) => {
    const result = await claim(type);
    if (result?.success) toast('Claimed successfully!', 'success');
    else if (result?.error) toast(result.error, 'error');
  };

  if (!isConnected) {
    return (
      <div style={{ maxWidth: 600, margin: '0 auto', padding: 'clamp(64px,10vh,120px) 24px', textAlign: 'center' }}>
        <div style={{ marginBottom: 20, display: 'flex', justifyContent: 'center' }}><IconBounties size={36} color={theme.colors.text.faint} /></div>
        <h2 style={{ fontFamily: theme.fonts.body, fontWeight: 700, fontSize: 22, letterSpacing: '-0.03em', color: theme.colors.text.primary, marginBottom: 10 }}>
          Connect your wallet
        </h2>
        <p style={{ fontSize: 13, color: theme.colors.text.muted, fontWeight: 300 }}>
          Connect to view your bounties and submission history.
        </p>
      </div>
    );
  }

  if (loading) return <PageLoader />;

  const postedRows = myBounties.length > 0
    ? myBounties
    : (bountyIds?.map(id => ({ id: String(id), title: null, totalReward: null, status: null })) || []);

  const stats = [
    { label: 'MON Earned',    value: `${profile?.totalEarned ?? '0'}`,            sub: 'all time',          accent: theme.colors.primary },
    { label: 'Bounties Won',  value: profile?.completedCount ?? 0,                sub: 'completed'          },
    { label: 'Total Posted',  value: profile?.postedCount    ?? bountyIds.length,  sub: 'as creator'         },
    { label: 'Submissions',   value: submissions.length,                           sub: 'total submitted'    },
  ];

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: 'clamp(32px,5vw,64px) clamp(16px,4vw,48px)' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16, marginBottom: 36 }}>
        <div>
          <div className="page-eyebrow">My Dashboard</div>
          <h1 className="page-title">Overview</h1>
          <div style={{ fontFamily: theme.fonts.mono, fontSize: 12, color: theme.colors.text.muted, marginTop: 4 }}>
            {address?.slice(0, 6)}…{address?.slice(-4)}
          </div>
        </div>
        <Button variant="primary" size="sm" onClick={() => { window.location.hash = '#/post'; }}>
          + Post Bounty
        </Button>
      </div>

      {/* Claim section — prominent when user has pending payouts */}
      {hasPending && (
        <div className="dashboard-claim-section" style={{
          padding: '18px 20px', marginBottom: 24,
          background: 'rgba(255,174,69,0.08)',
          border: `1px solid ${theme.colors.amberBorder}`,
          borderRadius: theme.radius.lg,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexWrap: 'wrap', gap: 14,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 40, height: 40, borderRadius: theme.radius.md,
              background: theme.colors.amberDim,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <IconWallet size={20} color={theme.colors.amber} />
            </div>
            <div>
              <div style={{ fontFamily: theme.fonts.body, fontWeight: 600, fontSize: 14, color: theme.colors.text.primary }}>
                You have payouts to claim
              </div>
              <div style={{ fontFamily: theme.fonts.body, fontSize: 12, color: theme.colors.text.muted, marginTop: 2 }}>
                {[
                  claims.cancelComp > 0n && `Cancel comp: ${fmtMon(claims.cancelComp)} MON`,
                  claims.timeoutPayout > 0n && `Timeout: ${fmtMon(claims.timeoutPayout)} MON`,
                  claims.stakeRefund > 0n && `Stake refund: ${fmtMon(claims.stakeRefund)} MON`,
                  claims.disputeRefund > 0n && `Dispute deposit: ${fmtMon(claims.disputeRefund)} MON`,
                ].filter(Boolean).join(' · ')}
              </div>
            </div>
          </div>
          <div className="dashboard-claim-btns" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {claims.cancelComp > 0n && (
              <Button variant="amber" size="sm" onClick={() => handleClaim('cancelComp')} disabled={!!claiming}>
                {claiming === 'cancelComp' ? 'Claiming…' : `Claim comp ${fmtMon(claims.cancelComp)} MON`}
              </Button>
            )}
            {claims.timeoutPayout > 0n && (
              <Button variant="amber" size="sm" onClick={() => handleClaim('timeoutPayout')} disabled={!!claiming}>
                {claiming === 'timeoutPayout' ? 'Claiming…' : `Claim payout ${fmtMon(claims.timeoutPayout)} MON`}
              </Button>
            )}
            {claims.stakeRefund > 0n && (
              <Button variant="amber" size="sm" onClick={() => handleClaim('stakeRefund')} disabled={!!claiming}>
                {claiming === 'stakeRefund' ? 'Claiming…' : `Claim stake ${fmtMon(claims.stakeRefund)} MON`}
              </Button>
            )}
            {claims.disputeRefund > 0n && (
              <Button variant="amber" size="sm" onClick={() => handleClaim('disputeRefund')} disabled={!!claiming}>
                {claiming === 'disputeRefund' ? 'Claiming…' : `Claim deposit ${fmtMon(claims.disputeRefund)} MON`}
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Stats grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10, marginBottom: 36 }}>
        {stats.map(s => <StatCard key={s.label} {...s} />)}
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', borderBottom: `1px solid ${theme.colors.border.subtle}`, marginBottom: 24, gap: 0, overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
        {[
          { key: 'posted',       label: `My Bounties (${Math.max(myBounties.length, bountyIds?.length || 0)})` },
          { key: 'submissions',  label: `My Submissions (${submissions.length})` },
          { key: 'applications', label: `Applications (${myApplications.length})` },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              padding: '10px 20px',
              fontFamily: theme.fonts.body, fontSize: 13,
              fontWeight: tab === t.key ? 600 : 400,
              color: tab === t.key ? theme.colors.text.primary : theme.colors.text.muted,
              background: 'none', border: 'none', cursor: 'pointer',
              borderBottom: `2px solid ${tab === t.key ? theme.colors.primary : 'transparent'}`,
              transition: theme.transition, letterSpacing: '-0.01em',
              whiteSpace: 'nowrap',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'posted' && (
        postedRows.length === 0 ? (
          <EmptyState icon={<IconBounties size={32} color={theme.colors.text.faint} />} title="No bounties posted" message="Post your first bounty to start receiving submissions." action={() => { window.location.hash = '#/post'; }} actionLabel="Post a Bounty" />
        ) : (

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {postedRows.map(b => (
              <div
                key={String(b.id)}
                onClick={() => { window.location.hash = `#/bounty/${b.id}`; }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 16, padding: '14px 18px',
                  background: theme.colors.bg.card,
                  border: `1px solid ${theme.colors.border.subtle}`,
                  borderRadius: theme.radius.md, cursor: 'pointer',
                  transition: theme.transition,
                  flexWrap: 'wrap',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = theme.colors.border.default; e.currentTarget.style.background = theme.colors.bg.elevated; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = theme.colors.border.subtle; e.currentTarget.style.background = theme.colors.bg.card; }}
              >
                <span style={{ fontFamily: theme.fonts.mono, fontSize: 10, color: theme.colors.text.faint, flexShrink: 0 }}>#{b.id}</span>
                <span style={{ flex: 1, minWidth: 0, fontFamily: theme.fonts.body, fontWeight: 500, fontSize: 13, color: theme.colors.text.primary, letterSpacing: '-0.01em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {b.title || `Bounty #${b.id}`}
                </span>
                {b.totalReward != null && (
                  <span style={{ fontFamily: theme.fonts.mono, fontSize: 12, color: theme.colors.primary, flexShrink: 0 }}>
                    {formatMon(b.totalReward)} MON
                  </span>
                )}
                <Badge type={normStatus(b.status)} />
                <span style={{ fontFamily: theme.fonts.mono, fontSize: 11, color: theme.colors.primary, flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  View <IconChevronRight size={12} color={theme.colors.primary} />
                </span>
              </div>
            ))}
          </div>
        )
      )}

      {tab === 'applications' && (
        appsLoading ? <PageLoader /> :
        myApplications.length === 0 ? (
          <EmptyState icon={<IconTarget size={32} color={theme.colors.text.faint} />} title="No applications yet" message="Apply to curated projects to appear here." action={() => { window.location.hash = '#/bounties'; }} actionLabel="Browse Bounties" />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {myApplications.map(app => {
              const appStatus = normAppStatus(app.status);
              const statusColor = appStatus === 'approved' ? theme.colors.green[400] : appStatus === 'rejected' ? theme.colors.red[400] : theme.colors.amber;
              const statusBg = appStatus === 'approved' ? theme.colors.green.dim : appStatus === 'rejected' ? theme.colors.red.dim : theme.colors.amberDim;
              const statusBorder = appStatus === 'approved' ? theme.colors.green.border : appStatus === 'rejected' ? theme.colors.red.border : theme.colors.amberBorder;

              return (
                <div
                  key={app.id}
                  onClick={() => { window.location.hash = `#/bounty/${app.bountyId}`; }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 16,
                    padding: '14px 18px',
                    background: theme.colors.bg.card,
                    border: `1px solid ${theme.colors.border.subtle}`,
                    borderRadius: theme.radius.md, cursor: 'pointer',
                    transition: theme.transition, flexWrap: 'wrap',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = theme.colors.border.default; e.currentTarget.style.background = theme.colors.bg.elevated; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = theme.colors.border.subtle; e.currentTarget.style.background = theme.colors.bg.card; }}
                >
                  <span style={{
                    fontFamily: theme.fonts.mono, fontSize: 10, fontWeight: 600,
                    color: statusColor, letterSpacing: '0.04em', textTransform: 'uppercase',
                    padding: '4px 10px', borderRadius: theme.radius.full,
                    background: statusBg, border: `1px solid ${statusBorder}`,
                    flexShrink: 0,
                  }}>
                    {appStatus}
                  </span>
                  <span style={{ flex: 1, fontFamily: theme.fonts.body, fontWeight: 500, fontSize: 13, color: theme.colors.text.primary, letterSpacing: '-0.01em', minWidth: 0 }}>
                    Bounty #{String(app.bountyId)}
                  </span>

                  {/* Applied date */}
                  <span style={{ fontFamily: theme.fonts.mono, fontSize: 11, color: theme.colors.text.faint, flexShrink: 0 }}>
                    {new Date(Number(app.appliedAt) * 1000).toLocaleDateString()}
                  </span>

                  <span style={{ fontFamily: theme.fonts.mono, fontSize: 11, color: theme.colors.primary, flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    View <IconChevronRight size={11} color={theme.colors.primary} />
                  </span>
                </div>
              );
            })}
          </div>
        )
      )}

      {tab === 'submissions' && (
        submissions.length === 0 ? (
          <EmptyState icon={<IconTarget size={32} color={theme.colors.text.faint} />} title="No submissions yet" message="Find a bounty and submit your work to start earning." action={() => { window.location.hash = '#/bounties'; }} actionLabel="Browse Bounties" />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {submissions.map(s => {
              const bountyInfo = submissionBounties[String(s.bountyId)];
              const bountyTitle = bountyInfo?.title || s.bountyTitle || `Bounty #${s.bountyId}`;
              const isApproved = normSubStatus(s.status) === 'approved';
              const reward = bountyInfo?.totalReward;
              return (
                <div key={s.id} style={{
                  background: theme.colors.bg.card,
                  border: `1px solid ${theme.colors.border.subtle}`,
                  borderRadius: theme.radius.md, overflow: 'hidden',
                }}>
                  <div
                    onClick={() => setExpandedSub(expandedSub === s.id ? null : s.id)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 16, padding: '14px 18px',
                      cursor: 'pointer', transition: theme.transition, flexWrap: 'wrap',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = theme.colors.bg.elevated; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                  >
                    <Badge type={normSubStatus(s.status)} />
                    <span
                      onClick={e => { e.stopPropagation(); window.location.hash = `#/bounty/${s.bountyId}`; }}
                      style={{ flex: 1, minWidth: 0, fontFamily: theme.fonts.body, fontWeight: 500, fontSize: 13.5, color: theme.colors.text.primary, letterSpacing: '-0.01em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', cursor: 'pointer' }}
                      title={`View bounty #${s.bountyId}`}
                    >
                      {bountyTitle}
                    </span>
                    {isApproved && reward != null && (
                      <span style={{ fontFamily: theme.fonts.mono, fontSize: 12, color: theme.colors.green[400], fontWeight: 600, flexShrink: 0 }}>
                        +{formatMon(reward)} MON
                      </span>
                    )}
                    <span style={{ fontFamily: theme.fonts.mono, fontSize: 11, color: theme.colors.text.muted, flexShrink: 0, display: 'inline-flex', alignItems: 'center' }}>
                      {expandedSub === s.id ? <IconChevronUp size={14} color={theme.colors.text.secondary} /> : <IconChevronDown size={14} color={theme.colors.text.secondary} />}
                    </span>
                  </div>
                  {expandedSub === s.id && (
                    <div style={{ padding: '0 18px 18px', borderTop: `1px solid ${theme.colors.border.faint}` }}>
                      <SubmissionViewer
                        submission={s}
                        ipfsHash={s.ipfsHash}
                        builder={s.builder}
                        bountyId={s.bountyId}
                        canViewContent={true}
                        compact
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )
      )}
    </div>
  );
}




