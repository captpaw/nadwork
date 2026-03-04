import { useState, lazy, Suspense } from 'react';
import { theme } from '../styles/theme';
import { useAccount } from 'wagmi';
import Badge from '../components/common/Badge';
import { IconBounties, IconTarget, IconEdit, IconSettings, IconTwitter, IconGithub } from '../components/icons';
import { PageLoader } from '../components/common/Spinner';
import EmptyState from '../components/common/EmptyState';
import { AvatarDisplay, AvatarEditable } from '../components/common/Avatar';
import { useProfile } from '../hooks/useProfile';
import { useIdentity } from '../hooks/useIdentity';
import { useProfileMeta } from '../hooks/useProfileMeta';
import { getAvatarSrc } from '../hooks/useAvatar';

const IdentityModal  = lazy(() => import('../components/identity/IdentityModal'));
const EditProfileModal = lazy(() => import('../components/profile/EditProfileModal'));

function getAddressFromHash() {
  const hash = window.location.hash;
  const match = hash.match(/#\/profile\/?(0x[a-fA-F0-9]{40})?/);
  return match?.[1] || null;
}

function formatMon(wei) {
  if (!wei && wei !== 0n) return '0';
  try { return (Number(BigInt(wei)) / 1e18).toFixed(4).replace(/\.?0+$/, '') || '0'; }
  catch { return '0'; }
}

const SUB_STATUS = { 0: 'pending', 1: 'approved', 2: 'rejected' };
function normSubStatus(s) {
  if (s == null) return 'pending';
  return SUB_STATUS[Number(s)] || String(s).toLowerCase();
}

// ── Skill pill ────────────────────────────────────────────────────────────────
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

// ── Social link ───────────────────────────────────────────────────────────────
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

  const { builderStats, score, submissions = [], loading } = useProfile(profileAddress);
  const { username, linkedWallets, reload: reloadIdentity } = useIdentity(profileAddress);
  const { meta, save: saveMeta } = useProfileMeta(profileAddress);

  const [identityOpen,    setIdentityOpen]    = useState(false);
  const [editProfileOpen, setEditProfileOpen] = useState(false);

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

  const shortAddr = `${profileAddress.slice(0, 6)}…${profileAddress.slice(-4)}`;
  const displayName = meta?.displayName || username ? (meta?.displayName || `@${username}`) : shortAddr;
  const avatarSrc   = getAvatarSrc(profileAddress);

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: 'clamp(32px,5vw,64px) clamp(16px,4vw,48px)' }}>
      {/* Page title */}
      <div style={{ marginBottom: 28 }}>
        <div className="page-eyebrow">{isSelf ? 'My Account' : 'Builder Profile'}</div>
        <h1 className="page-title">{isSelf ? 'Account' : shortAddr}</h1>
      </div>

      {/* ── Profile header card ── */}
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
              <h1 style={{
                fontFamily: theme.fonts.body, fontWeight: 800, fontSize: 22,
                letterSpacing: '-0.04em', color: theme.colors.text.primary,
              }}>
                {meta?.displayName
                  ? meta.displayName
                  : username ? `@${username}` : shortAddr
                }
              </h1>
              {isSelf && <Badge type="other" label="You" />}
              {username && (
                <span style={{
                  fontFamily: theme.fonts.mono, fontSize: 10,
                  color: theme.colors.green[400],
                  background: theme.colors.green.dim,
                  border: `1px solid ${theme.colors.green.border}`,
                  borderRadius: theme.radius.full,
                  padding: '2px 8px', letterSpacing: '0.04em',
                }}>on-chain ID</span>
              )}
            </div>

            {/* Address / username sub-label */}
            <div style={{ fontFamily: theme.fonts.mono, fontSize: 11, color: theme.colors.text.faint, letterSpacing: '0.02em', marginBottom: 6 }}>
              {meta?.displayName ? (username ? `@${username} · ` : '') + shortAddr : (username ? shortAddr : profileAddress)}
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
                <span>Complete your profile — add a bio and claim your username</span>
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

        {/* ── Bottom bar: identity status + action buttons ── */}
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
                      {`${linkedWallets[0].slice(0, 6)}…${linkedWallets[0].slice(-4)}`}
                    </span>
                  ) : (
                    <span style={{ fontFamily: theme.fonts.mono, fontSize: 11, color: theme.colors.text.faint, background: theme.colors.bg.elevated, border: `1px solid ${theme.colors.border.subtle}`, borderRadius: theme.radius.full, padding: '2px 10px' }}>None</span>
                  )}
                </div>
              </div>

              {/* Action buttons */}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
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

      {/* ── Modals ── */}
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

      {/* ── Submission history ── */}
      <div>
        <h2 style={{ fontFamily: theme.fonts.body, fontWeight: 700, fontSize: 17, letterSpacing: '-0.025em', color: theme.colors.text.primary, marginBottom: 20 }}>
          Submission History
        </h2>

        {submissions.length === 0 ? (
          <EmptyState icon={<IconTarget size={32} color={theme.colors.text.faint} />} title="No submissions yet" message={isSelf ? 'Start submitting work to bounties to build your history.' : 'This builder has not submitted any work yet.'} />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {submissions.map(s => (
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
                  {s.bountyTitle || `Bounty #${s.bountyId}`}
                </span>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexShrink: 0 }}>
                  {s.reward && (
                    <span style={{ fontFamily: theme.fonts.mono, fontSize: 13, fontWeight: 500, color: normSubStatus(s.status) === 'approved' ? theme.colors.primary : theme.colors.text.muted }}>
                      {normSubStatus(s.status) === 'approved' ? '+' : ''}{s.reward} MON
                    </span>
                  )}
                  {s.submittedAt && (
                    <span style={{ fontFamily: theme.fonts.mono, fontSize: 9.5, color: theme.colors.text.faint }}>
                      {new Date(Number(s.submittedAt) * 1000).toLocaleDateString()}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
