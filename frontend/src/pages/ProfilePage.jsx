import { useState, useEffect, useCallback, useMemo, lazy, Suspense } from 'react';
import { theme } from '../styles/theme';
import { useAccount } from 'wagmi';
import Badge from '../components/common/Badge';
import { IconBounties, IconTarget, IconEdit, IconSettings, IconTwitter, IconGithub } from '../components/icons';
import { PageLoader } from '../components/common/Spinner';
import EmptyState from '../components/common/EmptyState';
import { AvatarDisplay, AvatarEditable } from '../components/common/Avatar';
import { useProfile } from '../hooks/useProfile';
import { fetchJSON } from '../config/pinata';
import { getCachedBountySnapshots, getResolvedRegistryContract } from '../utils/registry.js';
import { useIdentity } from '../hooks/useIdentity';
import { useProfileMeta } from '../hooks/useProfileMeta';
import { getAvatarSrc } from '../hooks/useAvatar';
import { hasIndexer, querySubgraph, GQL_GET_CREATOR_BOUNTIES } from '../hooks/useIndexer';
function getDeliverableLinks(deliverables) {
  const items = Array.isArray(deliverables) ? deliverables : [];
  const links = [];
  const seen = new Set();

  for (const item of items) {
    let url = '';
    if (typeof item === 'string') {
      url = item.trim();
    } else if (item && typeof item === 'object') {
      const candidate = [item.url, item.value, item.href, item.link].find(
        (value) => typeof value === 'string' && value.trim()
      );
      url = candidate ? candidate.trim() : '';
    }

    if (!/^https?:\/\//i.test(url) || seen.has(url)) continue;
    seen.add(url);
    links.push(url);
  }

  return links;
}

// Portfolio card
function PortfolioCard({ submission, meta, bountyTitle, bountyReward }) {
  const [hov, setHov] = useState(false);
  const desc   = meta?.description || meta?.fullDescription || null;
  const links  = getDeliverableLinks(meta?.deliverables);

  const linkLabel = (url) => {
    if (url.includes('github.com'))   return 'GitHub';
    if (url.includes('figma.com'))    return 'Figma';
    if (url.includes('youtu'))        return 'Video';
    return 'Link';
  };

  return (
    <div
      onClick={() => { window.location.hash = `#/bounty/${submission.bountyId}`; }}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        padding: '18px 20px',
        background: hov ? theme.colors.bg.elevated : theme.colors.bg.card,
        border: `1px solid ${hov ? theme.colors.border.default : theme.colors.border.subtle}`,
        borderRadius: theme.radius.lg, cursor: 'pointer',
        transition: theme.transition,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <span style={{
            display: 'inline-block', padding: '2px 8px',
            background: theme.colors.green.dim, border: `1px solid ${theme.colors.green.border}`,
            borderRadius: theme.radius.full, fontFamily: theme.fonts.mono,
            fontSize: 9.5, color: theme.colors.green[400],
            textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6,
          }}>Approved</span>
          <div style={{
            fontFamily: theme.fonts.body, fontWeight: 600, fontSize: 14,
            color: theme.colors.text.primary, letterSpacing: '-0.02em',
            overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis',
          }}>
            {bountyTitle || `Bounty #${submission.bountyId}`}
          </div>
        </div>
        {bountyReward != null && (
          <div style={{
            fontFamily: theme.fonts.mono, fontSize: 13, fontWeight: 600,
            color: theme.colors.primary, flexShrink: 0,
          }}>
            {(Number(BigInt(bountyReward)) / 1e18).toFixed(4).replace(/\.?0+$/, '') || '0'} MON
          </div>
        )}
      </div>

      {desc && (
        <p style={{
          fontFamily: theme.fonts.body, fontSize: 12.5, color: theme.colors.text.muted,
          lineHeight: 1.6, margin: '0 0 10px',
          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
        }}>{desc}</p>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', gap: 6 }}>
          {links.slice(0, 3).map((url, i) => (
            <a key={i} href={url} target="_blank" rel="noopener noreferrer"
              onClick={e => e.stopPropagation()}
              style={{
                padding: '3px 10px',
                background: theme.colors.bg.panel,
                border: `1px solid ${theme.colors.border.subtle}`,
                borderRadius: theme.radius.full,
                fontFamily: theme.fonts.body, fontSize: 11.5,
                color: theme.colors.text.muted, textDecoration: 'none',
                transition: theme.transition,
              }}
              onMouseEnter={e => { e.currentTarget.style.color = theme.colors.primary; e.currentTarget.style.borderColor = theme.colors.primaryBorder; }}
              onMouseLeave={e => { e.currentTarget.style.color = theme.colors.text.muted; e.currentTarget.style.borderColor = theme.colors.border.subtle; }}
            >{linkLabel(url)}</a>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {submission.submittedAt && (
            <span style={{ fontFamily: theme.fonts.mono, fontSize: 9.5, color: theme.colors.text.faint }}>
              {new Date(Number(submission.submittedAt) * 1000).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
            </span>
          )}
          <span style={{ fontFamily: theme.fonts.body, fontSize: 11, color: theme.colors.primary }}>View bounty {'->'}</span>
        </div>
      </div>
    </div>
  );
}

const IdentityModal  = lazy(() => import('../components/identity/IdentityModal'));
const EditProfileModal = lazy(() => import('../components/profile/EditProfileModal'));

function getAddressFromHash() {
  const hash = window.location.hash;
  const match = hash.match(/#\/profile\/?(0x[a-fA-F0-9]{40})?/);
  return match?.[1] || null;
}



function parseTs(value) {
  if (value == null) return 0;
  try {
    return Number(BigInt(value));
  } catch {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
}

function formatMon(wei) {
  if (wei == null) return '0';
  try {
    const numeric = Number(wei);
    if (!Number.isFinite(numeric)) return '0';
    const mon = numeric / 1e18;
    if (!Number.isFinite(mon)) return '0';
    return mon.toFixed(4).replace(/\.?0+$/, '') || '0';
  } catch {
    return '0';
  }
}


const SUB_STATUS = { 0: 'pending', 1: 'approved', 2: 'rejected' };
const BOUNTY_STATUS = { 0: 'active', 1: 'reviewing', 2: 'completed', 3: 'expired', 4: 'cancelled', 5: 'disputed' };
function normSubStatus(s) {
  if (s == null) return 'pending';
  return SUB_STATUS[Number(s)] || String(s).toLowerCase();
}
function normBountyStatus(s) {
  if (s == null) return 'active';
  return BOUNTY_STATUS[Number(s)] || 'active';
}

// Skill pill
function SkillPill({ label }) {
  return (
    <span style={{
      padding: '3px 10px',
      background: theme.colors.bg.elevated,
      border: `1px solid ${theme.colors.border.subtle}`,
      borderRadius: theme.radius.full,
      fontFamily: theme.fonts.body, fontSize: 11.5, fontWeight: 500,
      color: theme.colors.text.secondary,
    }}>{label}</span>
  );
}

// Social link
function SocialLink({ icon: IconOrNode, href, label }) {
  return (
    <a
      href={href} target="_blank" rel="noopener noreferrer"
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 5,
        padding: '3px 10px',
        background: 'none',
        border: `1px solid ${theme.colors.border.subtle}`,
        borderRadius: theme.radius.full,
        fontFamily: theme.fonts.body, fontSize: 11.5,
        color: theme.colors.text.muted,
        textDecoration: 'none',
        transition: theme.transition,
      }}
      onMouseEnter={e => { e.currentTarget.style.color = theme.colors.text.secondary; e.currentTarget.style.borderColor = theme.colors.border.default; }}
      onMouseLeave={e => { e.currentTarget.style.color = theme.colors.text.muted; e.currentTarget.style.borderColor = theme.colors.border.subtle; }}
    >
      <span style={{ display: 'flex', alignItems: 'center' }}>{typeof IconOrNode === 'string' ? IconOrNode : <IconOrNode size={14} color="currentColor" />}</span>
      <span>{label}</span>
    </a>
  );
}

export default function ProfilePage() {
  const { address: myAddress } = useAccount();
  const profileAddress = getAddressFromHash() || myAddress;
  const isSelf = myAddress && profileAddress?.toLowerCase() === myAddress?.toLowerCase();

  const { builderStats, score, submissions = [], bountyIds = [], loading } = useProfile(profileAddress);
  const { username, linkedWallets, reload: reloadIdentity } = useIdentity(profileAddress);
  const { meta, save: saveMeta } = useProfileMeta(profileAddress);

  const [identityOpen,    setIdentityOpen]    = useState(false);
  const [editProfileOpen, setEditProfileOpen] = useState(false);
  const [activeTab,        setActiveTab]        = useState('submissions');
  const [portfolioLoaded,  setPortfolioLoaded]  = useState(false);
  const [portfolioLoading, setPortfolioLoading] = useState(false);
  const [portfolioMeta,    setPortfolioMeta]    = useState({});
  const [bountyData,       setBountyData]       = useState({});
  const [submissionBounties, setSubmissionBounties] = useState({});
  const [postedBounties, setPostedBounties] = useState([]);
  const [postedLoading, setPostedLoading] = useState(false);
  
  const [postedSort, setPostedSort] = useState('newest');
  const [submissionSort, setSubmissionSort] = useState('newest');
  const [notifPermission,  setNotifPermission]  = useState(
    typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'denied'
  );

  
  const sortedPostedBounties = useMemo(() => {
    const list = [...postedBounties];
    list.sort((a, b) => {
      const ta = parseTs(a?.createdAt) || Number(a?.id) || 0;
      const tb = parseTs(b?.createdAt) || Number(b?.id) || 0;
      return postedSort === 'oldest' ? ta - tb : tb - ta;
    });
    return list;
  }, [postedBounties, postedSort]);

  const sortedSubmissions = useMemo(() => {
    const list = [...submissions];
    list.sort((a, b) => {
      const ta = parseTs(a?.submittedAt) || Number(a?.id) || 0;
      const tb = parseTs(b?.submittedAt) || Number(b?.id) || 0;
      return submissionSort === 'oldest' ? ta - tb : tb - ta;
    });
    return list;
  }, [submissions, submissionSort]);
  const approvedSubs = useMemo(() => (
    submissions.filter((s) => normSubStatus(s?.status) === 'approved')
  ), [submissions]);


  const sortSelectStyle = {
    height: 30,
    padding: '0 10px',
    background: theme.colors.bg.input,
    color: theme.colors.text.secondary,
    border: '1px solid ' + theme.colors.border.default,
    borderRadius: theme.radius.md,
    fontFamily: theme.fonts.mono,
    fontSize: 11,
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
    outline: 'none',
  };

  // Fetch bounty details for submissions tab
  useEffect(() => {
    if (!submissions?.length) return;
    let cancelled = false;

    const load = async () => {
      try {
        const { contract: reg } = await getResolvedRegistryContract();
        if (!reg) return;

        const uniqueIds = [...new Set(submissions.map((s) => String(s.bountyId)))];
        const rowMap = await getCachedBountySnapshots(reg, uniqueIds);
        if (cancelled) return;

        const map = {};
        uniqueIds.forEach((id) => {
          const b = rowMap[String(id)] ?? null;
          map[id] = b ? { title: b.title, totalReward: b.totalReward } : null;
        });
        setSubmissionBounties(map);
      } catch {
        // non-fatal
      }
    };

    void load();
    return () => { cancelled = true; };
  }, [(submissions ?? []).map(s => String(s.bountyId)).join(',')]);

  // Fetch bounties posted by this profile
  useEffect(() => {
    if (!bountyIds?.length) {
      setPostedBounties([]);
      setPostedLoading(false);
      return;
    }

    let cancelled = false;
    setPostedLoading(true);

    const load = async () => {
      const fallbackRows = bountyIds.map((id) => ({ id: String(id), title: null, totalReward: null, status: null }));
      try {
        const { contract: reg } = await getResolvedRegistryContract();
        if (!reg) {
          if (!cancelled) setPostedBounties(fallbackRows);
          return;
        }

        const rowMap = await getCachedBountySnapshots(reg, bountyIds);
        if (cancelled) return;

        setPostedBounties(bountyIds.map((id) => {
          const b = rowMap[String(id)] ?? null;
          return {
            id: String(id),
            title: b?.title || null,
            totalReward: b?.totalReward ?? null,
            status: b?.status != null ? Number(b.status) : null,
            createdAt: b?.createdAt != null ? parseTs(b.createdAt) : null,
          };
        }));
      } catch {
        if (!cancelled) setPostedBounties(fallbackRows);
      } finally {
        if (!cancelled) setPostedLoading(false);
      }
    };

    void load();
    return () => { cancelled = true; };
  }, [bountyIds?.join(',')]);


  // Enrich posted bounty rows from indexer when registry detail is unavailable (legacy/migrated rows)
  useEffect(() => {
    if (!profileAddress || !postedBounties.length || !hasIndexer()) return;

    const needsEnrich = postedBounties.some((b) => !b?.title || b?.totalReward == null || b?.status == null);
    if (!needsEnrich) return;

    let cancelled = false;

    const run = async () => {
      const raw = String(profileAddress);
      const lower = raw.toLowerCase();

      const dataLower = await querySubgraph(GQL_GET_CREATOR_BOUNTIES, { creator: lower }).catch(() => null);
      let rows = dataLower?.bounties || [];

      if (rows.length === 0 && raw !== lower) {
        const dataRaw = await querySubgraph(GQL_GET_CREATOR_BOUNTIES, { creator: raw }).catch(() => null);
        rows = dataRaw?.bounties || [];
      }

      if (cancelled || !rows.length) return;

      const byId = Object.fromEntries(rows.map((r) => [String(r?.id), r]));

      setPostedBounties((prev) => {
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
  }, [profileAddress, postedBounties.map((b) => String(b.id) + ':' + (b.title ? '1' : '0') + ':' + (b.totalReward == null ? '0' : '1') + ':' + (b.status == null ? '0' : '1')).join('|')]);
  const handleRequestNotifPermission = async () => {
    if (!('Notification' in window)) return;
    const result = await Notification.requestPermission();
    setNotifPermission(result);
  };

  const handlePortfolioTabOpen = useCallback(async () => {
    setActiveTab('portfolio');
    if (portfolioLoaded || approvedSubs.length === 0) return;
    setPortfolioLoading(true);
    try {
      const { contract: reg } = await getResolvedRegistryContract();
      if (!reg) return;
      const uniqueBountyIds = [...new Set(approvedSubs.map(s => String(s.bountyId)))];
      const bountyMap = await getCachedBountySnapshots(reg, uniqueBountyIds);
      await Promise.allSettled([
        ...approvedSubs.map(s =>
          s.metaCid
            ? fetchJSON(s.metaCid).then(meta => {
                if (meta) setPortfolioMeta(prev => ({ ...prev, [String(s.id)]: meta }));
              }).catch(() => {})
            : Promise.resolve()
        ),
      ]);
      setBountyData((prev) => {
        const next = { ...prev };
        uniqueBountyIds.forEach((bid) => {
          const b = bountyMap[String(bid)] ?? null;
          next[bid] = b ? { title: b.title, reward: b.totalReward } : null;
        });
        return next;
      });
    } finally {
      setPortfolioLoading(false);
      setPortfolioLoaded(true);
    }
  }, [portfolioLoaded, approvedSubs]);

  const profile = builderStats ? {
    totalEarned:    formatMon(builderStats.totalEarned ?? builderStats[2]),
    completedCount: Number(builderStats.winCount       ?? builderStats[1] ?? 0),
    score:          Number(score ?? 0),
  } : null;

  if (!profileAddress) {
    return (
      <div style={{ maxWidth: 520, margin: '0 auto', padding: 'clamp(64px,10vh,120px) 24px', textAlign: 'center' }}>
        <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'center' }}><IconBounties size={36} color={theme.colors.text.faint} /></div>
        <h2 style={{ fontFamily: theme.fonts.body, fontWeight: 700, fontSize: 20, letterSpacing: '-0.03em', color: theme.colors.text.primary, marginBottom: 8 }}>No wallet connected</h2>
        <p style={{ fontSize: 13, color: theme.colors.text.muted, fontWeight: 300 }}>Connect your wallet to view your profile.</p>
      </div>
    );
  }

  if (loading) return <PageLoader />;

  const shortAddr = profileAddress ? profileAddress.slice(0, 6) + '...' + profileAddress.slice(-4) : '';
  const displayName = meta?.displayName || username ? (meta?.displayName || `@${username}`) : shortAddr;
  const avatarSrc   = getAvatarSrc(profileAddress);

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: 'clamp(32px,5vw,64px) clamp(16px,4vw,48px)' }}>
      {/* Page title */}
      <div style={{ marginBottom: 28 }}>
        <div className="page-eyebrow">{isSelf ? 'My Account' : 'Profile'}</div>
        <h1 className="page-title">{isSelf ? 'Account' : (username ? `@${username}` : displayName)}</h1>
      </div>

      {/* Profile header card */}
      <div style={{
        padding: '24px 28px', marginBottom: 24,
        background: theme.colors.bg.card,
        border: `1px solid ${theme.colors.border.subtle}`,
        borderRadius: theme.radius['2xl'],
      }}>
        {/* Top row: avatar + info + stats */}
        <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          {/* Avatar */}
          {isSelf
            ? <AvatarEditable address={profileAddress} size={72} />
            : <AvatarDisplay  address={profileAddress} size={72} />
          }

          {/* Info */}
          <div style={{ flex: 1, minWidth: 0 }}>
            {/* Name row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 4 }}>
              <h2 style={{
                fontFamily: theme.fonts.body, fontWeight: 700, fontSize: 20,
                letterSpacing: '-0.03em', color: theme.colors.text.primary,
              }}>
                {meta?.displayName || (username ? `@${username}` : null) || shortAddr}
              </h2>
              {isSelf && <Badge type="other" label="You" />}
              {username && (
                <span style={{
                  fontFamily: theme.fonts.mono, fontSize: 10,
                  color: theme.colors.green[400],
                  background: theme.colors.green.dim,
                  border: `1px solid ${theme.colors.green.border}`,
                  borderRadius: theme.radius.full,
                  padding: '2px 8px', letterSpacing: '0.04em',
                }}>on-chain</span>
              )}
            </div>

            {/* Address (shown once, compact) */}
            <div style={{ fontFamily: theme.fonts.mono, fontSize: 11, color: theme.colors.text.faint, letterSpacing: '0.02em', marginBottom: 6 }}>
              {shortAddr}
            </div>

            {/* Bio */}
            {meta?.bio && (
              <p style={{
                fontFamily: theme.fonts.body, fontSize: 13,
                color: theme.colors.text.secondary,
                lineHeight: 1.65, margin: '0 0 8px',
                maxWidth: 480,
              }}>{meta.bio}</p>
            )}

            {/* Skills */}
            {meta?.skills?.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 8 }}>
                {meta.skills.map((s, i) => <SkillPill key={i} label={s} />)}
              </div>
            )}

            {/* Social links */}
            {(meta?.twitter || meta?.github) && (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {meta.twitter && (
                  <SocialLink icon={IconTwitter} href={`https://twitter.com/${meta.twitter}`} label={`@${meta.twitter}`} />
                )}
                {meta.github && (
                  <SocialLink icon={IconGithub} href={`https://github.com/${meta.github}`} label={meta.github} />
                )}
              </div>
            )}

            {/* Rep score */}
            {profile && profile.score > 0 && (
              <div style={{ fontFamily: theme.fonts.mono, fontSize: 11, color: theme.colors.text.muted, marginTop: 6 }}>
                Rep score: <span style={{ color: theme.colors.primary }}>{profile.score}</span>
              </div>
            )}

            {/* Prompt: no identity + no bio */}
            {isSelf && !username && !meta?.bio && (
              <div style={{
                marginTop: 10, display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '5px 10px',
                background: theme.colors.primaryDim,
                border: `1px solid ${theme.colors.primaryBorder}`,
                borderRadius: theme.radius.md,
                fontFamily: theme.fonts.body, fontSize: 11.5,
                color: theme.colors.primaryLight,
              }}>
                <IconBounties size={14} color={theme.colors.primary} style={{ flexShrink: 0 }} />
                <span>Complete your profile - add a bio and claim your username</span>
              </div>
            )}
          </div>

          {/* Stats */}
          <div style={{
            display: 'flex', gap: 0,
            border: `1px solid ${theme.colors.border.subtle}`,
            borderRadius: theme.radius.md, overflow: 'hidden', flexShrink: 0,
            alignSelf: 'flex-start',
          }}>
            {[
              { label: 'Earned',    value: `${profile?.totalEarned ?? '0'} MON`, accent: theme.colors.primary },
              { label: 'Won',       value: profile?.completedCount ?? 0 },
              { label: 'Submitted', value: submissions.length },
            ].map(({ label, value, accent }, i, arr) => (
              <div key={label} style={{
                padding: '12px 18px', textAlign: 'center',
                borderRight: i < arr.length - 1 ? `1px solid ${theme.colors.border.subtle}` : 'none',
              }}>
                <div style={{ fontFamily: theme.fonts.mono, fontSize: 16, fontWeight: 500, color: accent || theme.colors.text.primary, letterSpacing: '-0.02em', lineHeight: 1, marginBottom: 3 }}>
                  {value}
                </div>
                <div style={{ fontFamily: theme.fonts.body, fontSize: 10, color: theme.colors.text.muted }}>{label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom bar: identity status + action buttons */}
        {isSelf && (
          <div style={{ marginTop: 20, paddingTop: 18, borderTop: `1px solid ${theme.colors.border.faint}` }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
              {/* Status chips */}
              <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                {/* Username */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontFamily: theme.fonts.mono, fontSize: 10, color: theme.colors.text.faint, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Username</span>
                  {username ? (
                    <span style={{ fontFamily: theme.fonts.mono, fontSize: 11, fontWeight: 600, color: theme.colors.green[400], background: theme.colors.green.dim, border: `1px solid ${theme.colors.green.border}`, borderRadius: theme.radius.full, padding: '2px 10px' }}>@{username}</span>
                  ) : (
                    <span style={{ fontFamily: theme.fonts.mono, fontSize: 11, color: theme.colors.amber, background: theme.colors.amberDim, border: `1px solid ${theme.colors.amberBorder}`, borderRadius: theme.radius.full, padding: '2px 10px' }}>Not set</span>
                  )}
                </div>
                {/* Backup */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontFamily: theme.fonts.mono, fontSize: 10, color: theme.colors.text.faint, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Backup</span>
                  {linkedWallets.length > 0 ? (
                    <span style={{ fontFamily: theme.fonts.mono, fontSize: 11, fontWeight: 600, color: theme.colors.green[400], background: theme.colors.green.dim, border: `1px solid ${theme.colors.green.border}`, borderRadius: theme.radius.full, padding: '2px 10px' }}>
                      {`${linkedWallets[0].slice(0, 6)}...${linkedWallets[0].slice(-4)}`}
                    </span>
                  ) : (
                    <span style={{ fontFamily: theme.fonts.mono, fontSize: 11, color: theme.colors.text.faint, background: theme.colors.bg.elevated, border: `1px solid ${theme.colors.border.subtle}`, borderRadius: theme.radius.full, padding: '2px 10px' }}>None</span>
                  )}
                </div>
              </div>

              {/* Action buttons */}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                {notifPermission === 'default' && (
                  <button
                    onClick={handleRequestNotifPermission}
                    title="Get browser notifications when you receive submissions, payments, or approvals"
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      padding: '8px 14px',
                      background: theme.colors.bg.elevated,
                      border: `1px solid ${theme.colors.border.default}`,
                      borderRadius: theme.radius.md,
                      fontFamily: theme.fonts.body, fontSize: 12, fontWeight: 500,
                      color: theme.colors.text.muted, cursor: 'pointer',
                      transition: theme.transition,
                    }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = theme.colors.primary; e.currentTarget.style.color = theme.colors.primaryLight; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = theme.colors.border.default; e.currentTarget.style.color = theme.colors.text.muted; }}
                  >Enable Notifications</button>
                )}
                <button
                  onClick={() => setEditProfileOpen(true)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 7,
                    padding: '8px 16px',
                    background: theme.colors.bg.elevated,
                    border: `1px solid ${theme.colors.border.default}`,
                    borderRadius: theme.radius.md,
                    fontFamily: theme.fonts.body, fontSize: 13, fontWeight: 500,
                    color: theme.colors.text.secondary,
                    cursor: 'pointer', transition: theme.transition,
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = theme.colors.border.hover; e.currentTarget.style.color = theme.colors.text.primary; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = theme.colors.border.default; e.currentTarget.style.color = theme.colors.text.secondary; }}
                >
                  <IconEdit size={14} style={{ marginRight: 4, flexShrink: 0 }} /> Edit Profile
                </button>
                <button
                  onClick={() => setIdentityOpen(true)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 7,
                    padding: '8px 16px',
                    background: theme.colors.primaryDim,
                    border: `1px solid ${theme.colors.primaryBorder}`,
                    borderRadius: theme.radius.md,
                    fontFamily: theme.fonts.body, fontSize: 13, fontWeight: 600,
                    color: theme.colors.primaryLight,
                    cursor: 'pointer', transition: theme.transition,
                    whiteSpace: 'nowrap',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(110,84,255,0.15)'; e.currentTarget.style.borderColor = theme.colors.primary; }}
                  onMouseLeave={e => { e.currentTarget.style.background = theme.colors.primaryDim; e.currentTarget.style.borderColor = theme.colors.primaryBorder; }}
                >
                  <IconSettings size={14} style={{ marginRight: 4, flexShrink: 0 }} /> Identity Settings
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      {isSelf && (
        <Suspense fallback={null}>
          <EditProfileModal
            open={editProfileOpen}
            onClose={() => setEditProfileOpen(false)}
            address={profileAddress}
            onSaved={() => setEditProfileOpen(false)}
          />
          <IdentityModal
            open={identityOpen}
            onClose={() => setIdentityOpen(false)}
            address={profileAddress}
            onSuccess={() => { setIdentityOpen(false); reloadIdentity?.(); }}
          />
        </Suspense>
      )}

      {/* Tabs */}
      <div>
        {/* Tab headers */}
        <div style={{ display: 'flex', gap: 0, borderBottom: `1px solid ${theme.colors.border.subtle}`, marginBottom: 24 }}>
          {[
            { id: 'posted',      label: 'Posted',      count: Math.max(postedBounties.length, bountyIds.length) },
            { id: 'submissions', label: 'Submissions', count: submissions.length },
            { id: 'portfolio',   label: 'Portfolio',   count: approvedSubs.length },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => tab.id === 'portfolio' ? handlePortfolioTabOpen() : setActiveTab(tab.id)}
              style={{
                padding: '10px 18px', background: 'none',
                border: 'none', borderBottom: `2px solid ${activeTab === tab.id ? theme.colors.primary : 'transparent'}`,
                fontFamily: theme.fonts.body, fontSize: 14, fontWeight: activeTab === tab.id ? 600 : 400,
                color: activeTab === tab.id ? theme.colors.primary : theme.colors.text.muted,
                cursor: 'pointer', transition: theme.transition, display: 'flex', alignItems: 'center', gap: 7,
                marginBottom: -1,
              }}
            >
              {tab.label}
              {tab.count > 0 && (
                <span style={{
                  padding: '1px 7px',
                  background: activeTab === tab.id ? theme.colors.primaryDim : theme.colors.bg.elevated,
                  border: `1px solid ${activeTab === tab.id ? theme.colors.primaryBorder : theme.colors.border.subtle}`,
                  borderRadius: theme.radius.full,
                  fontFamily: theme.fonts.mono, fontSize: 10,
                  color: activeTab === tab.id ? theme.colors.primary : theme.colors.text.faint,
                }}>{tab.count}</span>
              )}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
          {activeTab === 'posted' && sortedPostedBounties.length > 1 && (
            <select value={postedSort} onChange={(e) => setPostedSort(e.target.value)} style={sortSelectStyle}>
              <option value='newest'>Newest</option>
              <option value='oldest'>Oldest</option>
            </select>
          )}
          {activeTab === 'submissions' && sortedSubmissions.length > 1 && (
            <select value={submissionSort} onChange={(e) => setSubmissionSort(e.target.value)} style={sortSelectStyle}>
              <option value='newest'>Newest</option>
              <option value='oldest'>Oldest</option>
            </select>
          )}
        </div>

        {/* Posted tab */}
        {activeTab === 'posted' && (
          postedLoading && sortedPostedBounties.length === 0 ? (
            <div style={{ paddingTop: 48, textAlign: 'center', fontFamily: theme.fonts.mono, fontSize: 12, color: theme.colors.text.faint }}>Loading posted bounties...</div>
          ) : sortedPostedBounties.length === 0 ? (
            <EmptyState
              icon={<IconBounties size={32} color={theme.colors.text.faint} />}
              title="No bounties posted yet"
              message={isSelf ? 'Post your first bounty to start receiving submissions.' : 'This creator has not posted any bounties yet.'}
              action={isSelf ? (() => { window.location.hash = '#/post'; }) : undefined}
              actionLabel={isSelf ? 'Post a Bounty' : undefined}
            />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {sortedPostedBounties.map((b) => (
                <div
                  key={String(b.id)}
                  onClick={() => { window.location.hash = `#/bounty/${b.id}`; }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px',
                    background: theme.colors.bg.card, border: `1px solid ${theme.colors.border.subtle}`,
                    borderRadius: theme.radius.md, cursor: 'pointer', transition: theme.transition,
                    flexWrap: 'wrap',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = theme.colors.border.default; e.currentTarget.style.background = theme.colors.bg.elevated; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = theme.colors.border.subtle; e.currentTarget.style.background = theme.colors.bg.card; }}
                >
                  <Badge type={normBountyStatus(b.status)} />
                  <span style={{ flex: 1, minWidth: 0, fontFamily: theme.fonts.body, fontWeight: 500, fontSize: 13.5, color: theme.colors.text.primary, letterSpacing: '-0.01em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {b.title || `Bounty #${b.id}`}
                  </span>
                  {b.totalReward != null && (
                    <span style={{ fontFamily: theme.fonts.mono, fontSize: 12, fontWeight: 600, color: theme.colors.primary }}>
                      {formatMon(b.totalReward)} MON
                    </span>
                  )}
                </div>
              ))}
            </div>
          )
        )}
        {/* Submissions tab */}
        {activeTab === 'submissions' && (
          sortedSubmissions.length === 0 ? (
            <EmptyState icon={<IconTarget size={32} color={theme.colors.text.faint} />} title="No submissions yet" message={isSelf ? 'Start submitting work to bounties to build your history.' : 'This builder has not submitted any work yet.'} />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {sortedSubmissions.map(s => {
                const bountyInfo = submissionBounties[String(s.bountyId)];
                const bountyTitle = bountyInfo?.title || s.bountyTitle || `Bounty #${s.bountyId}`;
                const isApproved = normSubStatus(s.status) === 'approved';
                const reward = bountyInfo?.totalReward ?? s.reward;
                return (
                  <div
                    key={s.id}
                    onClick={() => { window.location.hash = `#/bounty/${s.bountyId}`; }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px',
                      background: theme.colors.bg.card, border: `1px solid ${theme.colors.border.subtle}`,
                      borderRadius: theme.radius.md, cursor: 'pointer', transition: theme.transition,
                      flexWrap: 'wrap',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = theme.colors.border.default; e.currentTarget.style.background = theme.colors.bg.elevated; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = theme.colors.border.subtle; e.currentTarget.style.background = theme.colors.bg.card; }}
                  >
                    <Badge type={normSubStatus(s.status)} />
                    <span style={{ flex: 1, fontFamily: theme.fonts.body, fontWeight: 500, fontSize: 13.5, color: theme.colors.text.primary, letterSpacing: '-0.01em', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {bountyTitle}
                    </span>
                    <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexShrink: 0 }}>
                      {isApproved && reward != null && (
                        <span style={{ fontFamily: theme.fonts.mono, fontSize: 12, fontWeight: 600, color: theme.colors.green[400] }}>
                          +{typeof reward === 'bigint' || typeof reward === 'number' ? formatMon(reward) : reward} MON
                        </span>
                      )}
                      {s.submittedAt && (
                        <span style={{ fontFamily: theme.fonts.mono, fontSize: 9.5, color: theme.colors.text.faint }}>
                          {new Date(Number(s.submittedAt) * 1000).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )
        )}

        {/* Portfolio tab */}
        {activeTab === 'portfolio' && (
          portfolioLoading ? (
            <div style={{ paddingTop: 48, textAlign: 'center', fontFamily: theme.fonts.mono, fontSize: 12, color: theme.colors.text.faint }}>Loading portfolio...</div>
          ) : approvedSubs.length === 0 ? (
            <EmptyState
              icon={<IconTarget size={32} color={theme.colors.text.faint} />}
              title="No portfolio yet"
              message={isSelf ? 'Win a bounty to showcase your work here.' : 'This builder has not completed any bounties yet.'}
            />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {approvedSubs.map(s => (
                <PortfolioCard
                  key={s.id}
                  submission={s}
                  meta={portfolioMeta[String(s.id)]}
                  bountyTitle={bountyData[String(s.bountyId)]?.title}
                  bountyReward={bountyData[String(s.bountyId)]?.reward}
                />
              ))}
            </div>
          )
        )}
      </div>
    </div>
  );
}









