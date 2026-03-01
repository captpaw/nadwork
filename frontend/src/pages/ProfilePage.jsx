import React, { useState, useEffect, useCallback } from 'react';
import { useAccount } from 'wagmi';
import { useConnectModal } from '@rainbow-me/rainbowkit';
import { motion } from 'framer-motion';
import { theme as t } from '@/styles/theme.js';
import { useProfile } from '@/hooks/useProfile.js';
import { useSubmissionNotifications } from '@/hooks/useSubmissionNotifications.js';
import { useIdentity } from '@/hooks/useIdentity.js';
import { getReadContract } from '@/utils/ethers.js';
import { ADDRESSES, REGISTRY_ABI, BOUNTY_STATUS, SUB_STATUS } from '@/config/contracts.js';
import { fetchJSON } from '@/config/pinata.js';
import Card from '@/components/common/Card.jsx';
import Badge from '@/components/common/Badge.jsx';
import { PageLoader } from '@/components/common/Spinner.jsx';
import EmptyState from '@/components/common/EmptyState.jsx';
import { formatMON, formatDate, formatReward, explorerUrl } from '@/utils/format.js';
import { toast } from '@/utils/toast.js';
import IdentityModal from '@/components/identity/IdentityModal.jsx';
import { AvatarEditable, AvatarDisplay } from '@/components/common/Avatar.jsx';
import {
  IconTrophy, IconNote, IconUser, IconSettings, IconTarget,
  IconExternal, IconCheck, IconPlus,
} from '@/components/icons/index.jsx';

function SubmissionRow({ sub }) {
  const [bountyTitle, setBountyTitle] = useState(null);

  useEffect(() => {
    if (!ADDRESSES.registry) return;
    (async () => {
      try {
        const reg = getReadContract(ADDRESSES.registry, REGISTRY_ABI);
        const b = await reg.getBounty(sub.bountyId);
        if (b.ipfsHash) {
          const meta = await fetchJSON(b.ipfsHash);
          if (meta?.title) { setBountyTitle(meta.title); return; }
        }
        if (b.title) setBountyTitle(b.title);
      } catch {}
    })();
  }, [sub.bountyId]);

  const statusIdx = Number(sub.status);
  const isWon = statusIdx === 1;
  const statusMap = {
    0: { type: 'reviewing', label: 'Pending' },
    1: { type: 'active',    label: 'Won'     },
    2: { type: 'cancelled', label: 'Rejected'},
  };
  const sInfo = statusMap[statusIdx] || { type: 'reviewing', label: 'Pending' };

  return (
    <div
      onClick={() => window.location.hash = '#/bounty/' + String(sub.bountyId)}
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '12px',
        padding: '10px 13px',
        cursor: 'pointer',
        background: isWon ? 'rgba(16,185,129,0.04)' : t.colors.bg.elevated,
        border: '1px solid ' + (isWon ? 'rgba(52,211,153,0.18)' : t.colors.border.default),
        borderRadius: t.radius.md,
        transition: 'border-color 0.12s ease',
        flexWrap: 'wrap',
      }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = isWon ? 'rgba(52,211,153,0.35)' : t.colors.border.strong; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = isWon ? 'rgba(52,211,153,0.18)' : t.colors.border.default; }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1 }}>
        <div style={{
          width: '28px',
          height: '28px',
          borderRadius: t.radius.sm,
          flexShrink: 0,
          background: isWon ? 'rgba(16,185,129,0.1)' : 'rgba(124,58,237,0.08)',
          border: '1px solid ' + (isWon ? 'rgba(52,211,153,0.2)' : 'rgba(124,58,237,0.12)'),
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: isWon ? t.colors.green[400] : t.colors.violet[400],
        }}>
          {isWon ? <IconTrophy size={13} /> : <IconNote size={13} />}
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{
            fontSize: '13px',
            fontWeight: 500,
            color: t.colors.text.primary,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            maxWidth: '340px',
          }}>
            {bountyTitle || 'Bounty #' + String(sub.bountyId)}
          </div>
          <div style={{ fontSize: '11px', color: t.colors.text.muted, marginTop: '2px' }}>
            Submitted {formatDate(sub.submittedAt)}
          </div>
        </div>
      </div>
      <Badge type={sInfo.type} label={sInfo.label} />
    </div>
  );
}

function BountyRow({ bountyId }) {
  const [bounty, setBounty] = useState(null);
  const [meta,   setMeta]   = useState(null);

  useEffect(() => {
    if (!ADDRESSES.registry) return;
    (async () => {
      try {
        const reg = getReadContract(ADDRESSES.registry, REGISTRY_ABI);
        const b   = await reg.getBounty(bountyId);
        setBounty(b);
        if (b.ipfsHash) { const m = await fetchJSON(b.ipfsHash); setMeta(m); }
      } catch {}
    })();
  }, [bountyId]);

  if (!bounty) return (
    <div style={{ height: '58px', borderRadius: t.radius.md, background: t.colors.bg.elevated, border: '1px solid ' + t.colors.border.subtle }} className="skeleton" />
  );

  const title     = meta?.title || bounty.title || 'Bounty #' + String(bountyId);
  const statusKey = BOUNTY_STATUS[Number(bounty.status)]?.toLowerCase() || 'active';

  return (
    <div
      onClick={() => window.location.hash = '#/bounty/' + String(bountyId)}
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '12px',
        padding: '10px 13px',
        cursor: 'pointer',
        background: t.colors.bg.elevated,
        border: '1px solid ' + t.colors.border.default,
        borderRadius: t.radius.md,
        transition: 'border-color 0.12s ease',
        flexWrap: 'wrap',
      }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = t.colors.border.strong; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = t.colors.border.default; }}
    >
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{
          fontSize: '13px',
          fontWeight: 500,
          color: t.colors.text.primary,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          maxWidth: '340px',
        }}>
          {title}
        </div>
        <div style={{ fontSize: '11px', color: t.colors.text.muted, marginTop: '3px' }}>
          {String(bounty.submissionCount)} submissions · {formatDate(bounty.createdAt)}
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '7px', flexShrink: 0 }}>
        <span style={{
          fontFamily: t.fonts.mono,
          fontSize: '13px',
          fontWeight: 600,
          color: t.colors.violet[400],
        }}>
          {formatReward(bounty.totalReward, bounty.rewardType)}
        </span>
        <Badge type={statusKey} label={BOUNTY_STATUS[Number(bounty.status)]} />
      </div>
    </div>
  );
}

export default function ProfilePage({ targetAddress = null }) {
  const { address: selfAddr } = useAccount();
  const { openConnectModal } = useConnectModal();
  const profileAddr = targetAddress || selfAddr;
  const isSelf      = !targetAddress || selfAddr?.toLowerCase() === profileAddr?.toLowerCase();
  const [tab, setTab]               = useState('submissions');
  const [showIdentity, setShowIdentity] = useState(false);

  const { username, linkedWallets, reload: reloadIdentity } = useIdentity(profileAddr);
  const { hunterStats, projectStats, score, winRate, submissions, bountyIds, loading } = useProfile(profileAddr);

  const handleNotify = useCallback((changed) => {
    if (!isSelf) return;
    for (const { sub } of changed) {
      if (Number(sub.status) === 1) toast('Your submission was approved!', 'success');
      else if (Number(sub.status) === 2) toast('Your submission was rejected. You may raise a dispute.', 'warning');
    }
  }, [isSelf]);
  useSubmissionNotifications(isSelf ? submissions : null, handleNotify);

  if (!profileAddr) return (
    <div style={{ padding: '6rem 1rem', textAlign: 'center' }}>
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px', color: t.colors.text.faint }}>
        <IconUser size={40} />
      </div>
      <h2 style={{ fontWeight: 700, fontSize: '20px', color: t.colors.text.primary, marginBottom: '8px', letterSpacing: '-0.02em' }}>
        Your Profile
      </h2>
      <p style={{ color: t.colors.text.muted, fontSize: '14px', maxWidth: '360px', margin: '0 auto 24px', lineHeight: 1.7 }}>
        Connect your wallet to view your submissions, earnings, and on-chain reputation score.
      </p>
      <button
        onClick={openConnectModal}
        style={{
          background: t.colors.violet[600],
          color: '#fff',
          border: 'none',
          borderRadius: t.radius.md,
          padding: '10px 24px',
          fontSize: '13.5px',
          fontWeight: 600,
          cursor: 'pointer',
          letterSpacing: '-0.01em',
          transition: 'background 0.12s ease',
        }}
        onMouseEnter={e => e.currentTarget.style.background = t.colors.violet[700]}
        onMouseLeave={e => e.currentTarget.style.background = t.colors.violet[600]}
      >
        Connect Wallet
      </button>
    </div>
  );

  if (loading) return <PageLoader />;

  const wins           = hunterStats ? Number(hunterStats[1]) : 0;
  const subs           = hunterStats ? Number(hunterStats[0]) : 0;
  const earned         = hunterStats ? hunterStats[2] : 0n;
  const wr             = Number(winRate);
  const sc             = Number(score);
  const postedCount    = projectStats ? Number(projectStats[0]) : 0;
  const completedCount = projectStats ? Number(projectStats[1]) : 0;

  // Derive identity tier (mirrors BountyFactory._getHunterTier logic)
  const tier = !username ? 0 : subs === 0 ? 1 : wins < 5 ? 2 : 3;
  const TIER_META = {
    0: { label: 'Anonymous',  color: '#6b7280', bg: 'rgba(107,114,128,0.1)',  border: 'rgba(107,114,128,0.2)',  desc: 'No username — cannot submit bounties.' },
    1: { label: 'Registered', color: '#fbbf24', bg: 'rgba(251,191,36,0.08)', border: 'rgba(251,191,36,0.15)', desc: 'Set username ✓ — submission stake ×1.5. Can submit bounties under 1 MON. Make 1 submission to reach Active.' },
    2: { label: 'Active',     color: '#818cf8', bg: 'rgba(99,102,241,0.08)', border: 'rgba(99,102,241,0.15)', desc: 'At least 1 submission ✓ — submission stake ×1.0. Can submit any bounty. Win 5 bounties to reach Trusted.' },
    3: { label: 'Trusted',    color: '#34d399', bg: 'rgba(52,211,153,0.08)', border: 'rgba(52,211,153,0.15)', desc: '5+ wins ✓ — submission stake ×0.75 (discount). Highest trust tier.' },
  };
  const tierInfo = TIER_META[tier];

  // Next-tier requirement for self view
  const nextTierHint = tier === 0
    ? 'Claim a username to unlock submission access.'
    : tier === 1
    ? `Make your first submission to become Active.`
    : tier === 2
    ? `Win ${5 - wins} more bounty${5 - wins !== 1 ? 'ies' : ''} to reach Trusted tier.`
    : null;

  return (
    <div>
      <div className="container-sm" style={{ padding: 'clamp(1.5rem, 4vw, 3rem) clamp(1rem, 4vw, 2rem)' }}>
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
        >

          {isSelf && (
            <IdentityModal
              open={showIdentity}
              onClose={() => setShowIdentity(false)}
              address={selfAddr}
              onSuccess={reloadIdentity}
            />
          )}

          {/* ── Profile hero ── */}
          <div style={{
            marginBottom: '20px',
            background: 'rgba(124,58,237,0.04)',
            border: '1px solid ' + t.colors.border.default,
            borderRadius: t.radius.xl,
            padding: 'clamp(1.125rem, 3vw, 1.75rem)',
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px', flexWrap: 'wrap' }}>
              {isSelf
                ? <AvatarEditable address={profileAddr} size={60} onEdit={() => setShowIdentity(true)} />
                : <AvatarDisplay  address={profileAddr} size={60} />
              }

              <div style={{ flex: 1, minWidth: 0 }}>
                {/* Username row */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', flexWrap: 'wrap' }}>
                  {username && (
                    <span style={{
                      fontSize: '17px',
                      fontWeight: 700,
                      color: t.colors.text.primary,
                      letterSpacing: '-0.025em',
                    }}>
                      {username}
                    </span>
                  )}
                  {isSelf && (
                    <Badge type="you" label="You" />
                  )}
                  {linkedWallets?.length > 0 && (
                    <span style={{
                      fontSize: '10.5px',
                      color: t.colors.violet[400],
                      background: 'rgba(124,58,237,0.07)',
                      border: '1px solid rgba(124,58,237,0.12)',
                      padding: '1px 7px',
                      borderRadius: t.radius.xs,
                      letterSpacing: '0.02em',
                    }}>
                      {linkedWallets.length} backup wallet{linkedWallets.length > 1 ? 's' : ''}
                    </span>
                  )}
                </div>

                {/* Address */}
                <div style={{ marginBottom: '8px' }}>
                  <span style={{
                    fontFamily: t.fonts.mono,
                    fontSize: '11.5px',
                    color: t.colors.text.muted,
                    wordBreak: 'break-all',
                  }}>
                    {profileAddr}
                  </span>
                </div>

                {/* Action links */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                  <a
                    href={explorerUrl(profileAddr, 'address')}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      fontSize: '12px',
                      color: t.colors.violet[400],
                      textDecoration: 'none',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    <IconExternal size={11} />
                    Explorer
                  </a>
                  {isSelf && (
                    <button
                      onClick={() => setShowIdentity(true)}
                      style={{
                        fontSize: '12px',
                        color: t.colors.violet[400],
                        background: 'rgba(124,58,237,0.07)',
                        border: '1px solid rgba(124,58,237,0.15)',
                        borderRadius: t.radius.sm,
                        padding: '3px 9px',
                        cursor: 'pointer',
                        transition: 'border-color 0.12s ease',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '5px',
                      }}
                      onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(124,58,237,0.3)'}
                      onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(124,58,237,0.15)'}
                    >
                      {username
                        ? <><IconSettings size={11} /> Identity Settings</>
                        : <><IconPlus size={11} /> Claim Username</>
                      }
                    </button>
                  )}
                </div>
              </div>

              {/* Score + Tier badges */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flexShrink: 0, alignItems: 'center' }}>
                <div style={{
                  textAlign: 'center',
                  padding: '10px 16px',
                  background: 'rgba(124,58,237,0.08)',
                  border: '1px solid rgba(124,58,237,0.15)',
                  borderRadius: t.radius.md,
                  width: '100%',
                }}>
                  <div style={{
                    fontFamily: t.fonts.mono,
                    fontSize: 'clamp(20px, 4vw, 28px)',
                    fontWeight: 700,
                    color: t.colors.violet[300],
                    letterSpacing: '-0.04em',
                    lineHeight: 1,
                  }}>
                    {sc.toLocaleString()}
                  </div>
                  <div style={{
                    fontSize: '9.5px',
                    color: t.colors.violet[400],
                    marginTop: '4px',
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    fontWeight: 600,
                  }}>
                    Hunter Score
                  </div>
                </div>

                {/* Tier badge */}
                <div style={{
                  padding: '5px 12px',
                  background: tierInfo.bg,
                  border: '1px solid ' + tierInfo.border,
                  borderRadius: t.radius.sm,
                  fontSize: '11px',
                  fontWeight: 700,
                  color: tierInfo.color,
                  letterSpacing: '0.05em',
                  textTransform: 'uppercase',
                  textAlign: 'center',
                  width: '100%',
                }}>
                  {tierInfo.label}
                </div>
              </div>
            </div>

            {/* Win rate bar */}
            {subs > 0 && (
              <div style={{ marginTop: '14px', paddingTop: '14px', borderTop: '1px solid ' + t.colors.border.subtle }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '11.5px' }}>
                  <span style={{ color: t.colors.text.muted }}>Win Rate</span>
                  <span style={{
                    fontFamily: t.fonts.mono,
                    fontWeight: 600,
                    color: wr >= 50 ? t.colors.green[400] : t.colors.violet[400],
                  }}>
                    {wr}%
                  </span>
                </div>
                <div style={{ height: '3px', borderRadius: '99px', background: t.colors.border.default, overflow: 'hidden' }}>
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: Math.min(wr, 100) + '%' }}
                    transition={{ duration: 0.7, ease: 'easeOut' }}
                    style={{
                      height: '100%',
                      borderRadius: '99px',
                      background: wr >= 50
                        ? `linear-gradient(90deg,${t.colors.green[500]},${t.colors.green[400]})`
                        : `linear-gradient(90deg,${t.colors.violet[600]},${t.colors.violet[400]})`,
                    }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* ── Stats grid ── */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(90px, 1fr))',
            gap: '8px',
            marginBottom: '24px',
          }}>
            {[
              { label: 'Submissions', value: subs,                  color: t.colors.text.primary  },
              { label: 'Wins',        value: wins,                  color: t.colors.green[400]    },
              { label: 'Earned',      value: formatMON(earned),     color: t.colors.violet[300]   },
              { label: 'Posted',      value: postedCount,           color: t.colors.text.primary  },
              { label: 'Completed',   value: completedCount,        color: t.colors.green[400]    },
            ].map(s => (
              <div key={s.label} style={{
                padding: '12px 10px',
                background: t.colors.bg.card,
                border: '1px solid ' + t.colors.border.default,
                borderRadius: t.radius.md,
                textAlign: 'center',
              }}>
                <div style={{
                  fontFamily: t.fonts.mono,
                  fontSize: 'clamp(15px, 2.5vw, 20px)',
                  fontWeight: 700,
                  color: s.color,
                  letterSpacing: '-0.03em',
                  lineHeight: 1,
                }}>
                  {String(s.value)}
                </div>
                <div style={{
                  fontSize: '9.5px',
                  color: t.colors.text.muted,
                  marginTop: '5px',
                  letterSpacing: '0.07em',
                  textTransform: 'uppercase',
                }}>
                  {s.label}
                </div>
              </div>
            ))}
          </div>

          {/* ── Tier info (self-view only) ── */}
          {isSelf && (
            <div style={{
              marginBottom: '20px',
              padding: '12px 14px',
              background: tierInfo.bg,
              border: '1px solid ' + tierInfo.border,
              borderRadius: t.radius.md,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px', flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: tierInfo.color, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '3px' }}>
                    Your Tier: {tierInfo.label}
                  </div>
                  <div style={{ fontSize: '12px', color: t.colors.text.muted, lineHeight: 1.6 }}>
                    {tierInfo.desc}
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', fontSize: '11px', color: t.colors.text.muted, flexShrink: 0, textAlign: 'right' }}>
                  <span>Stake multiplier: <strong style={{ color: tierInfo.color }}>{tier <= 1 ? '×1.5' : tier === 2 ? '×1.0' : '×0.75'}</strong></span>
                </div>
              </div>
              {nextTierHint && (
                <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid ' + tierInfo.border, fontSize: '11.5px', color: t.colors.text.muted }}>
                  Next tier: {nextTierHint}
                </div>
              )}
            </div>
          )}

          {/* ── Tabs ── */}
          <div style={{
            display: 'flex',
            gap: '2px',
            marginBottom: '14px',
            background: t.colors.bg.elevated,
            padding: '3px',
            borderRadius: t.radius.md,
            border: '1px solid ' + t.colors.border.subtle,
          }}>
            {[
              { key: 'submissions', label: 'Submissions', count: submissions.length },
              { key: 'bounties',    label: 'Posted',      count: bountyIds.length   },
            ].map(({ key, label, count }) => (
              <button key={key} onClick={() => setTab(key)} style={{
                flex: 1,
                padding: '7px 12px',
                fontSize: '13px',
                fontWeight: tab === key ? 500 : 400,
                cursor: 'pointer',
                transition: 'background 0.12s ease, color 0.12s ease',
                outline: 'none',
                border: 'none',
                borderRadius: '6px',
                background: tab === key ? t.colors.bg.card : 'transparent',
                color: tab === key ? t.colors.text.primary : t.colors.text.muted,
                boxShadow: tab === key ? t.shadow.sm : 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
              }}>
                {label}
                <span style={{
                  fontSize: '10.5px',
                  background: tab === key ? 'rgba(124,58,237,0.12)' : 'transparent',
                  color: tab === key ? t.colors.violet[400] : t.colors.text.muted,
                  padding: '1px 5px',
                  borderRadius: t.radius.xs,
                }}>
                  {count}
                </span>
              </button>
            ))}
          </div>

          {/* ── Submissions tab ── */}
          {tab === 'submissions' && (
            submissions.length === 0 ? (
              <EmptyState
                icon={IconNote}
                title="No submissions yet"
                message="Browse open bounties and submit your work to build your on-chain reputation."
                action="Browse Bounties"
                onAction={() => window.location.hash = '#/'}
              />
            ) : (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {wins > 0 && (
                  <div style={{
                    fontSize: '12.5px',
                    color: t.colors.green[400],
                    fontWeight: 500,
                    marginBottom: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}>
                    <IconTrophy size={13} color={t.colors.green[400]} />
                    {wins} win{wins > 1 ? 's' : ''} out of {subs} submission{subs > 1 ? 's' : ''}
                  </div>
                )}
                {submissions.map(s => <SubmissionRow key={String(s.id)} sub={s} />)}
              </motion.div>
            )
          )}

          {/* ── Bounties tab ── */}
          {tab === 'bounties' && (
            bountyIds.length === 0 ? (
              <EmptyState
                icon={IconTarget}
                title="No bounties posted"
                message="Post a bounty to find talent in the Monad ecosystem."
                action="Post a Bounty"
                onAction={() => window.location.hash = '#/post'}
              />
            ) : (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {bountyIds.map(id => <BountyRow key={String(id)} bountyId={id} />)}
              </motion.div>
            )
          )}

        </motion.div>
      </div>
    </div>
  );
}
