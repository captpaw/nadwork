import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useAccount, useWalletClient } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import ReactMarkdown from 'react-markdown';
import { ethers } from 'ethers';
import { theme as t } from '@/styles/theme.js';
import { useBounty } from '@/hooks/useBounty.js';
import Card from '@/components/common/Card.jsx';
import Badge from '@/components/common/Badge.jsx';
import Button from '@/components/common/Button.jsx';
import DeadlineTimer from '@/components/bounty/DeadlineTimer.jsx';
import SubmitWorkModal from '@/components/bounty/SubmitWorkModal.jsx';
import SubmissionViewer from '@/components/bounty/SubmissionViewer.jsx';
import { AvatarDisplay } from '@/components/common/Avatar.jsx';
import { PageLoader } from '@/components/common/Spinner.jsx';
import { formatReward, formatDate, explorerUrl } from '@/utils/format.js';
import { useDisplayName } from '@/hooks/useIdentity.js';
import { BOUNTY_STATUS, ADDRESSES, FACTORY_ABI, CATEGORY_LABELS, DISPUTE_DEPOSIT_MON } from '@/config/contracts.js';
import { getContract, getReadContract } from '@/utils/ethers.js';
import { toast } from '@/utils/toast.js';
import {
  IconGithub, IconFigma, IconTwitter, IconYoutube, IconBolt, IconExternal,
  IconBack, IconCheck, IconWarning, IconMessage, IconStar, IconSearch,
} from '@/components/icons/index.jsx';

function HunterName({ address: addr }) {
  const { displayName } = useDisplayName(addr);
  return <>{displayName}</>;
}

function detectLinkType(url) {
  if (!url) return 'url';
  if (url.includes('github.com'))  return 'github';
  if (url.includes('figma.com'))   return 'figma';
  if (url.includes('twitter.com') || url.includes('x.com')) return 'twitter';
  if (url.includes('youtube.com') || url.includes('youtu.be')) return 'youtube';
  if (url.includes('vercel.app') || url.includes('netlify.app')) return 'demo';
  return 'url';
}

const LINK_META = {
  github:  { Icon: IconGithub,   label: 'GitHub',   color: t.colors.text.secondary },
  figma:   { Icon: IconFigma,    label: 'Figma',    color: t.colors.violet[400] },
  twitter: { Icon: IconTwitter,  label: 'Twitter',  color: '#60a5fa' },
  youtube: { Icon: IconYoutube,  label: 'YouTube',  color: t.colors.red[400] },
  demo:    { Icon: IconBolt,     label: 'Demo',     color: t.colors.green[400] },
  url:     { Icon: IconExternal, label: 'Link',     color: t.colors.violet[400] },
};

function DeliverableCard({ url, label }) {
  const type = detectLinkType(url);
  const meta = LINK_META[type] || LINK_META.url;
  const { Icon } = meta;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        padding: '9px 13px',
        borderRadius: t.radius.md,
        background: t.colors.bg.elevated,
        border: '1px solid ' + t.colors.border.default,
        textDecoration: 'none',
        transition: 'border-color 0.12s ease',
      }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = t.colors.border.strong; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = t.colors.border.default; }}
    >
      <span style={{ color: meta.color, display: 'flex', flexShrink: 0 }}>
        <Icon size={15} color={meta.color} />
      </span>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: '12px', fontWeight: 600, color: meta.color }}>{label || meta.label}</div>
        <div style={{
          fontSize: '11px',
          color: t.colors.text.muted,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          maxWidth: '260px',
        }}>{url}</div>
      </div>
      <span style={{ marginLeft: 'auto', flexShrink: 0, color: t.colors.text.muted, display: 'flex' }}>
        <IconExternal size={12} />
      </span>
    </a>
  );
}

function SectionLabel({ children }) {
  return (
    <div style={{
      fontSize: '10.5px',
      fontWeight: 600,
      color: t.colors.text.muted,
      letterSpacing: '0.09em',
      textTransform: 'uppercase',
      marginBottom: '12px',
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
    }}>
      <span style={{ display: 'inline-block', width: '12px', height: '1px', background: t.colors.border.strong }} />
      {children}
    </div>
  );
}

function InfoRow({ label, value }) {
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '8px 0',
      borderBottom: '1px solid ' + t.colors.border.subtle,
    }}>
      <span style={{ fontSize: '12px', color: t.colors.text.muted }}>{label}</span>
      <span style={{ fontSize: '12.5px', color: t.colors.text.secondary, fontWeight: 500 }}>{value}</span>
    </div>
  );
}

// FIX M-FE-1: Sanitize links in ReactMarkdown to prevent XSS via javascript: URIs
function SafeLink({ href, children, ...props }) {
  const isSafe = href && (href.startsWith('https://') || href.startsWith('http://') || href.startsWith('#'));
  if (!isSafe) return <span style={{ textDecoration: 'underline', opacity: 0.5 }}>{children}</span>;
  return <a href={href} target="_blank" rel="noopener noreferrer" {...props}>{children}</a>;
}

const MD_COMPONENTS = { a: SafeLink };

function MarkdownBody({ content }) {
  if (!content) return null;
  return (
    <div style={{ color: t.colors.text.secondary, fontSize: '14px', lineHeight: 1.85 }} className="md-body">
      <ReactMarkdown components={MD_COMPONENTS}>{content}</ReactMarkdown>
    </div>
  );
}

export default function BountyDetailPage({ bountyId }) {
  const { address }            = useAccount();
  const { data: walletClient } = useWalletClient();
  const { bounty, meta, submissions, loading, refetch } = useBounty(bountyId);
  const [showSubmit,    setShowSubmit]    = useState(false);
  const [approving,     setApproving]     = useState(false);
  const [cancelling,    setCancelling]    = useState(false);
  const [disputing,     setDisputing]     = useState(false);
  const [claiming,      setClaiming]      = useState(false);
  // FIX-4: track which submission IDs are currently being rejected
  const [rejecting,     setRejecting]     = useState(new Set());
  // FIX-9: transitioning to REVIEWING state
  const [transitioning, setTransitioning] = useState(false);
  const [withdrawing,   setWithdrawing]   = useState(false);
  const [pendingRefund, setPendingRefund] = useState(0n);
  const [selected,      setSelected]      = useState([]);
  // FIX-10: live nowTs updated every 30 seconds for accurate countdown display
  const [nowTs, setNowTs] = useState(() => Math.floor(Date.now() / 1000));
  const { displayName: posterDisplayName } = useDisplayName(bounty?.poster);

  // FIX-10: update nowTs every 30 seconds
  useEffect(() => {
    const id = setInterval(() => setNowTs(Math.floor(Date.now() / 1000)), 30_000);
    return () => clearInterval(id);
  }, []);

  // Fetch pending dispute refund for the connected hunter
  useEffect(() => {
    if (!address || !ADDRESSES.factory) return;
    let cancelled = false;
    (async () => {
      try {
        const factoryRead = getReadContract(ADDRESSES.factory, FACTORY_ABI);
        const v = await factoryRead.pendingDisputeRefunds(address);
        if (!cancelled) setPendingRefund(BigInt(v));
      } catch {}
    })();
    return () => { cancelled = true; };
  }, [address, bounty]);

  if (loading) return <PageLoader />;

  if (!bounty) return (
    <div style={{ padding: '5rem 1rem', textAlign: 'center' }}>
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px', color: t.colors.text.faint }}>
        <IconSearch size={36} />
      </div>
      <h2 style={{ fontWeight: 600, fontSize: '20px', color: t.colors.text.primary, marginBottom: '8px' }}>
        Bounty #{bountyId} not found
      </h2>
      <p style={{ color: t.colors.text.muted, fontSize: '14px', maxWidth: '380px', margin: '0 auto 28px', lineHeight: 1.7 }}>
        This bounty may not exist, or there was a network issue loading the data.
      </p>
      <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
        <Button onClick={refetch}>Retry</Button>
        <Button variant="secondary" icon={<IconBack size={14} />} onClick={() => window.location.hash = '#/'}>
          Back
        </Button>
      </div>
    </div>
  );

  const statusNum  = Number(bounty.status);
  const statusKey  = BOUNTY_STATUS[statusNum]?.toLowerCase() || 'active';
  const isPoster   = address?.toLowerCase() === bounty.poster?.toLowerCase();
  const isActive   = statusNum === 0;
  const isReviewing = statusNum === 1;
  const isDisputed = statusNum === 5;
  const alreadySub = submissions.some(s => s.hunter?.toLowerCase() === address?.toLowerCase());
  const canSubmit  = !isPoster && isActive && !alreadySub && address;
  const winnerCount = Number(bounty.winnerCount);
  const mySub      = submissions.find(s => s.hunter?.toLowerCase() === address?.toLowerCase());

  // V3: review window data (nowTs is live state — updated every 30s by FIX-10)
  const reviewDeadlineTs    = bounty.reviewDeadline ? Number(bounty.reviewDeadline) : null;
  const reviewWindowActive  = reviewDeadlineTs && nowTs < reviewDeadlineTs && nowTs >= Number(bounty.deadline);
  const reviewWindowExpired = reviewDeadlineTs && nowTs >= reviewDeadlineTs;
  const reviewSecsLeft      = reviewDeadlineTs ? Math.max(0, reviewDeadlineTs - nowTs) : 0;
  // Can transition to REVIEWING if: ACTIVE, past deadline, has pending submissions
  const canTransitionToReviewing = isActive && nowTs >= Number(bounty.deadline) &&
    submissions.some(s => Number(s.status) === 0);

  function fmtDuration(secs) {
    if (secs <= 0) return 'Expired';
    const d = Math.floor(secs / 86400);
    const h = Math.floor((secs % 86400) / 3600);
    const m = Math.floor((secs % 3600) / 60);
    if (d > 0) return `${d}d ${h}h`;
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  }

  const handleShare = () => {
    // FIX L-FE-7: Use dynamic origin instead of hardcoded domain
    const url   = `${window.location.origin}${window.location.pathname}#/bounty/${bountyId}`;
    const title = meta?.title || bounty.title || 'Bounty';
    const reward = formatReward(bounty.totalReward, bounty.rewardType);
    const text  = encodeURIComponent(`${title}\n\nReward: ${reward}\n\nWork on it on NadWork — the on-chain bounty platform for Monad.\n\n${url}`);
    window.open(`https://twitter.com/intent/tweet?text=${text}`, '_blank');
  };

  const handleApprove = async () => {
    if (!walletClient || selected.length < 1) { toast('Select at least 1 winner', 'warning'); return; }
    if (selected.length > winnerCount) { toast('Cannot select more than ' + winnerCount + ' winner(s)', 'warning'); return; }
    try {
      setApproving(true);
      const factory = await getContract(ADDRESSES.factory, FACTORY_ABI, walletClient);
      const submissionIds = selected.map(id => BigInt(id));
      const ranks         = selected.map((_, i) => i + 1);
      await (await factory.approveWinners(BigInt(bountyId), submissionIds, ranks)).wait();
      toast('Winners approved! Funds released.', 'success');
      setSelected([]);
      refetch();
    } catch (err) {
      toast('Approval failed: ' + (err.reason || err.shortMessage || err.message), 'error');
    } finally { setApproving(false); }
  };

  const handleCancel = async () => {
    if (!walletClient) { toast('Connect wallet first', 'warning'); return; }
    const subCount = Number(bounty.submissionCount);
    const isERC20  = Number(bounty.rewardType) === 1;

    // FIX-6: send totalReward as upper-bound msg.value for native bounties.
    // Contract counts only validSubCount (PENDING + post-grace REJECTED) — which may be less
    // than subCount if some were grace-period rejected. Contract always returns excess to caller.
    // For ERC20, compensation is paid in MON: 0.005 MON per submission (flat, capped at totalReward).
    const FLAT_ERC20_COMP_WEI = ethers.parseEther('0.005');
    let msgValue = 0n;
    if (subCount > 0) {
      if (isERC20) {
        // Upper-bound: 0.005 MON × all submissions (contract refunds excess)
        msgValue = FLAT_ERC20_COMP_WEI * BigInt(subCount);
      } else {
        // Upper-bound = totalReward (worst case: all submissions are valid)
        msgValue = bounty.totalReward;
      }
    }

    const compDisplay = subCount > 0
      ? isERC20
        ? `up to ${ethers.formatEther(msgValue)} MON (excess refunded)`
        : `up to ${ethers.formatEther(msgValue)} MON (excess refunded)`
      : '0 MON';

    const msg = subCount > 0
      ? `This bounty has ${subCount} submission(s).\n\nCancellation fee: ${compDisplay}.\n\nAny unused MON will be refunded to your wallet. Confirm cancel?`
      : 'Cancel this bounty and receive a full refund?';
    if (!window.confirm(msg)) return;

    try {
      setCancelling(true);
      const factory = await getContract(ADDRESSES.factory, FACTORY_ABI, walletClient);
      await (await factory.cancelBounty(BigInt(bountyId), { value: msgValue })).wait();
      toast('Bounty cancelled. Funds refunded.', 'success');
      window.location.hash = '#/dashboard';
    } catch (err) {
      toast('Cancel failed: ' + (err.reason || err.shortMessage || err.message), 'error');
    } finally { setCancelling(false); }
  };

  const handleTimeout = async () => {
    if (!walletClient) { toast('Connect wallet first', 'warning'); return; }
    try {
      const factory = await getContract(ADDRESSES.factory, FACTORY_ABI, walletClient);
      await (await factory.triggerTimeout(BigInt(bountyId))).wait();
      toast('Timeout triggered. Funds distributed.', 'success');
      refetch();
    } catch (err) {
      toast('Failed: ' + (err.reason || err.shortMessage || err.message), 'error');
    }
  };

  const handleRaiseDispute = async (submissionId) => {
    if (!walletClient) { toast('Connect wallet first', 'warning'); return; }
    // Fetch actual DISPUTE_DEPOSIT from contract at runtime
    let depositWei;
    try {
      const factoryRead = getReadContract(ADDRESSES.factory, FACTORY_ABI);
      depositWei = await factoryRead.DISPUTE_DEPOSIT();
    } catch {
      depositWei = ethers.parseEther(String(DISPUTE_DEPOSIT_MON));
    }
    const depositDisplay = ethers.formatEther(depositWei);
    const confirmed = window.confirm(
      `Raise a dispute for this submission?\n\nYou will pay a ${depositDisplay} MON deposit.\n` +
      `If upheld, your deposit is refunded and escrow is split equally.`
    );
    if (!confirmed) return;
    try {
      setDisputing(true);
      const factory = await getContract(ADDRESSES.factory, FACTORY_ABI, walletClient);
      await (await factory.raiseDispute(BigInt(bountyId), BigInt(submissionId), { value: depositWei })).wait();
      toast('Dispute raised. Platform team has been notified.', 'success');
      refetch();
    } catch (err) {
      toast('Dispute failed: ' + (err.reason || err.shortMessage || err.message), 'error');
    } finally { setDisputing(false); }
  };

  const handleClaimDisputeRefund = async () => {
    if (!walletClient) { toast('Connect wallet first', 'warning'); return; }
    try {
      setClaiming(true);
      const factory = await getContract(ADDRESSES.factory, FACTORY_ABI, walletClient);
      await (await factory.claimDisputeRefund()).wait();
      toast('Dispute deposit refunded to your wallet.', 'success');
      refetch();
    } catch (err) {
      toast('Claim failed: ' + (err.reason || err.shortMessage || err.message), 'error');
    } finally { setClaiming(false); }
  };

  // FIX-4: reject a specific submission (poster only)
  const handleReject = async (submissionId) => {
    if (!walletClient) { toast('Connect wallet first', 'warning'); return; }
    const subIdStr = String(submissionId);
    if (!window.confirm('Reject this submission? The hunter\'s stake will be refunded. This action cannot be undone.')) return;
    setRejecting(prev => new Set(prev).add(subIdStr));
    try {
      const factory = await getContract(ADDRESSES.factory, FACTORY_ABI, walletClient);
      await (await factory.rejectSubmission(BigInt(bountyId), BigInt(submissionId))).wait();
      toast('Submission rejected. Hunter\'s stake refunded.', 'success');
      refetch();
    } catch (err) {
      toast('Reject failed: ' + (err.reason || err.shortMessage || err.message), 'error');
    } finally {
      setRejecting(prev => { const n = new Set(prev); n.delete(subIdStr); return n; });
    }
  };

  // FIX-9: transition bounty from ACTIVE to REVIEWING after deadline
  const handleTransitionToReviewing = async () => {
    if (!walletClient) { toast('Connect wallet first', 'warning'); return; }
    try {
      setTransitioning(true);
      const factory = await getContract(ADDRESSES.factory, FACTORY_ABI, walletClient);
      await (await factory.transitionToReviewing(BigInt(bountyId))).wait();
      toast('Bounty is now in Review state. Complete your reviews before the review window expires.', 'success');
      refetch();
    } catch (err) {
      toast('Failed: ' + (err.reason || err.shortMessage || err.message), 'error');
    } finally { setTransitioning(false); }
  };

  // U1: withdraw submission stake after rejection once grace period has elapsed and hunter chose not to dispute
  const handleWithdrawRejectedStake = async (submissionId) => {
    if (!walletClient) { toast('Connect wallet first', 'warning'); return; }
    try {
      setWithdrawing(true);
      const factory = await getContract(ADDRESSES.factory, FACTORY_ABI, walletClient);
      await (await factory.withdrawRejectedStake(BigInt(bountyId), BigInt(submissionId))).wait();
      toast('Submission stake refunded to your wallet.', 'success');
      refetch();
    } catch (err) {
      toast('Withdraw failed: ' + (err.reason || err.shortMessage || err.message), 'error');
    } finally { setWithdrawing(false); }
  };

  return (
    <div>
      {/* Markdown body styles */}
      <style>{`
        .md-body p    { margin-bottom: 12px; }
        .md-body h1, .md-body h2, .md-body h3 { color: ${t.colors.text.primary}; font-weight: 600; margin: 16px 0 8px; letter-spacing: -0.02em; }
        .md-body h1   { font-size: 18px; }
        .md-body h2   { font-size: 16px; }
        .md-body h3   { font-size: 14px; }
        .md-body ul, .md-body ol { padding-left: 20px; margin-bottom: 12px; }
        .md-body li   { margin-bottom: 4px; }
        .md-body a    { color: ${t.colors.violet[400]}; text-decoration: none; }
        .md-body a:hover { text-decoration: underline; }
        .md-body code { background: rgba(124,58,237,0.1); color: ${t.colors.violet[300]}; padding: 1px 6px; border-radius: 4px; font-family: 'DM Mono', monospace; font-size: 12px; }
        .md-body pre  { background: ${t.colors.bg.base}; border: 1px solid ${t.colors.border.default}; border-radius: 8px; padding: 14px; overflow-x: auto; margin-bottom: 12px; }
        .md-body pre code { background: none; padding: 0; }
        .md-body blockquote { border-left: 2px solid ${t.colors.violet[600]}; margin: 0 0 12px; padding-left: 14px; color: ${t.colors.text.muted}; }
        .md-body strong { color: ${t.colors.text.secondary}; }
        .md-body hr { border: none; border-top: 1px solid ${t.colors.border.default}; margin: 16px 0; }
        .md-body table { width: 100%; border-collapse: collapse; margin-bottom: 12px; font-size: 13px; }
        .md-body th, .md-body td { border: 1px solid ${t.colors.border.default}; padding: 6px 10px; text-align: left; }
        .md-body th { background: ${t.colors.bg.elevated}; color: ${t.colors.text.muted}; }
      `}</style>

      <div className="container" style={{ padding: 'clamp(1.25rem, 4vw, 2.5rem) clamp(1rem, 4vw, 2rem)' }}>

        {/* Back */}
        <button
          onClick={() => window.location.hash = '#/'}
          style={{
            background: 'none',
            border: 'none',
            color: t.colors.text.muted,
            cursor: 'pointer',
            fontSize: '13px',
            marginBottom: '1.5rem',
            padding: 0,
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            transition: 'color 0.12s ease',
          }}
          onMouseEnter={e => e.currentTarget.style.color = t.colors.text.secondary}
          onMouseLeave={e => e.currentTarget.style.color = t.colors.text.muted}
        >
          <IconBack size={14} />
          Bounties
        </button>

        <div
          style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,330px)', gap: '24px', alignItems: 'start' }}
          className="detail-grid"
        >

          {/* ── LEFT ── */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}
          >

            {/* Title block */}
            <div>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '12px', alignItems: 'center' }}>
                <Badge type={statusKey} label={BOUNTY_STATUS[statusNum] || 'ACTIVE'} />
                {bounty.category && <Badge type={bounty.category} label={CATEGORY_LABELS[bounty.category] || bounty.category} />}
                {bounty.featured && (
                  <Badge
                    type="featured"
                    label={
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                        <IconStar size={9} color="#fbbf24" />
                        Featured
                      </span>
                    }
                  />
                )}
              </div>
              <h1 style={{
                fontWeight: 700,
                fontSize: 'clamp(20px, 3.5vw, 30px)',
                color: t.colors.text.primary,
                lineHeight: 1.2,
                letterSpacing: '-0.03em',
                marginBottom: '12px',
              }}>
                {meta?.title || bounty.title || 'Loading…'}
              </h1>
              <div style={{
                display: 'flex',
                gap: '14px',
                flexWrap: 'wrap',
                color: t.colors.text.muted,
                fontSize: '12.5px',
                alignItems: 'center',
              }}>
                <span>
                  By{' '}
                  <a href={'#/profile/' + bounty.poster} style={{ color: t.colors.violet[400], textDecoration: 'none', fontWeight: 500 }}>
                    {posterDisplayName}
                  </a>
                </span>
                <span style={{ color: t.colors.border.strong }}>·</span>
                <span>{formatDate(bounty.createdAt)}</span>
                <span style={{ color: t.colors.border.strong }}>·</span>
                <span>{String(bounty.submissionCount)} submission{Number(bounty.submissionCount) !== 1 ? 's' : ''}</span>
                <button
                  onClick={handleShare}
                  style={{
                    background: 'transparent',
                    border: '1px solid ' + t.colors.border.default,
                    color: t.colors.text.muted,
                    borderRadius: t.radius.sm,
                    padding: '2px 8px',
                    fontSize: '11px',
                    cursor: 'pointer',
                    transition: 'border-color 0.12s ease, color 0.12s ease',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontWeight: 400,
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = t.colors.border.strong; e.currentTarget.style.color = t.colors.text.secondary; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = t.colors.border.default; e.currentTarget.style.color = t.colors.text.muted; }}
                >
                  <IconExternal size={10} />
                  Share
                </button>
              </div>
            </div>

            {/* Disputed banner */}
            {isDisputed && (
              <div style={{
                padding: '12px 14px',
                background: 'rgba(239,68,68,0.06)',
                border: '1px solid rgba(239,68,68,0.2)',
                borderRadius: t.radius.md,
                display: 'flex',
                gap: '10px',
                alignItems: 'flex-start',
              }}>
                <span style={{ color: t.colors.red[400], display: 'flex', flexShrink: 0, marginTop: '1px' }}>
                  <IconWarning size={15} color={t.colors.red[400]} />
                </span>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: t.colors.red[400], marginBottom: '3px' }}>
                    This bounty is under dispute
                  </div>
                  <div style={{ fontSize: '12px', color: t.colors.text.muted, lineHeight: 1.6 }}>
                    A hunter has raised a dispute. The platform team is reviewing. No further submissions are accepted until resolved.
                  </div>
                </div>
              </div>
            )}

            {/* Skills & estimated hours */}
            {(meta?.skills?.length > 0 || meta?.estimatedHours) && (
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                {meta?.skills?.map(sk => (
                  <span key={sk} style={{
                    fontSize: '11px',
                    fontWeight: 500,
                    color: t.colors.violet[400],
                    background: 'rgba(124,58,237,0.07)',
                    border: '1px solid rgba(124,58,237,0.12)',
                    padding: '2px 7px',
                    borderRadius: t.radius.xs,
                  }}>{sk}</span>
                ))}
                {meta?.estimatedHours && (
                  <span style={{ fontSize: '12px', color: t.colors.text.muted }}>~{meta.estimatedHours}h estimated</span>
                )}
              </div>
            )}

            {/* Description */}
            <Card>
              <SectionLabel>Description</SectionLabel>
              {meta?.fullDescription
                ? <MarkdownBody content={meta.fullDescription} />
                : <p style={{ color: t.colors.text.muted, fontSize: '13px', fontStyle: 'italic' }}>Loading description…</p>
              }
            </Card>

            {/* Requirements */}
            {meta?.requirements?.filter(Boolean).length > 0 && (
              <Card>
                <SectionLabel>Requirements</SectionLabel>
                <ul style={{ margin: 0, paddingLeft: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {meta.requirements.filter(Boolean).map((r, i) => (
                    <li key={i} style={{ display: 'flex', gap: '10px', fontSize: '13.5px', color: t.colors.text.secondary, lineHeight: 1.6 }}>
                      <span style={{
                        color: t.colors.violet[600],
                        fontFamily: t.fonts.mono,
                        fontSize: '10.5px',
                        flexShrink: 0,
                        marginTop: '4px',
                        letterSpacing: '0.05em',
                      }}>
                        {String(i + 1).padStart(2, '0')}
                      </span>
                      {r}
                    </li>
                  ))}
                </ul>
              </Card>
            )}

            {/* Evaluation criteria */}
            {meta?.evaluationCriteria?.filter(Boolean).length > 0 && (
              <Card>
                <SectionLabel>Evaluation Criteria</SectionLabel>
                <ul style={{ margin: 0, paddingLeft: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {meta.evaluationCriteria.filter(Boolean).map((c, i) => (
                    <li key={i} style={{ display: 'flex', gap: '10px', fontSize: '13px', color: t.colors.text.secondary, lineHeight: 1.6 }}>
                      <span style={{ color: t.colors.green[400], display: 'flex', flexShrink: 0, marginTop: '3px' }}>
                        <IconCheck size={13} color={t.colors.green[400]} />
                      </span>
                      {c}
                    </li>
                  ))}
                </ul>
              </Card>
            )}

            {/* Resources */}
            {meta?.resources?.filter(r => r.url).length > 0 && (
              <Card>
                <SectionLabel>Resources</SectionLabel>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
                  {meta.resources.filter(r => r.url).map((r, i) => (
                    <DeliverableCard key={i} url={r.url} label={r.label} />
                  ))}
                </div>
              </Card>
            )}

            {/* Contact info */}
            {meta?.contactInfo && (
              <div style={{
                padding: '11px 14px',
                background: 'rgba(124,58,237,0.05)',
                borderRadius: t.radius.md,
                border: '1px solid rgba(124,58,237,0.12)',
                display: 'flex',
                gap: '10px',
                alignItems: 'flex-start',
              }}>
                <span style={{ color: t.colors.violet[400], display: 'flex', flexShrink: 0, marginTop: '1px' }}>
                  <IconMessage size={14} color={t.colors.violet[400]} />
                </span>
                <div>
                  <div style={{ fontWeight: 600, color: t.colors.violet[300], marginBottom: '2px', fontSize: '12.5px' }}>
                    Questions? Contact the poster
                  </div>
                  <div style={{ fontSize: '11.5px', color: t.colors.text.muted, marginBottom: '4px' }}>Reach them on Telegram or Discord:</div>
                  <strong style={{ color: t.colors.violet[400], fontFamily: t.fonts.mono, fontSize: '12px' }}>{meta.contactInfo}</strong>
                </div>
              </div>
            )}

            {/* Prize split */}
            {winnerCount > 1 && (
              <Card>
                <SectionLabel>Prize Distribution</SectionLabel>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {bounty.prizeWeights.map((w, i) => {
                    const pct = Number(w);
                    return (
                      <div key={i}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px', marginBottom: '5px' }}>
                          <span style={{ color: t.colors.text.secondary }}>#{i + 1} Place</span>
                          <span style={{
                            color: t.colors.violet[300],
                            fontWeight: 600,
                            fontFamily: t.fonts.mono,
                          }}>{pct}%</span>
                        </div>
                        <div style={{ height: '3px', background: t.colors.border.default, borderRadius: '99px', overflow: 'hidden' }}>
                          <div style={{
                            height: '100%',
                            width: pct + '%',
                            background: `linear-gradient(90deg,${t.colors.violet[600]},${t.colors.violet[500]})`,
                            borderRadius: '99px',
                          }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>
            )}

            {/* Submissions — poster view */}
            {isPoster && (
              <Card>
                <SectionLabel>Submissions ({submissions.length})</SectionLabel>
                {submissions.length === 0 ? (
                  <p style={{ fontSize: '13.5px', color: t.colors.text.muted, textAlign: 'center', padding: '20px 0' }}>
                    No submissions yet. Share this bounty to attract hunters!
                  </p>
                ) : (
                  <>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {submissions.map(s => {
                        const isSelected = selected.includes(String(s.id));
                        const subStatus  = Number(s.status);
                        return (
                          <div key={String(s.id)} style={{
                            padding: '12px 14px',
                            background: isSelected ? 'rgba(124,58,237,0.07)' : t.colors.bg.elevated,
                            borderRadius: t.radius.md,
                            border: '1px solid ' + (isSelected ? t.colors.border.active : t.colors.border.default),
                            transition: 'border-color 0.12s ease, background 0.12s ease',
                          }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <AvatarDisplay address={s.hunter} size={30} />
                                <div>
                                  <div style={{ fontSize: '13px', fontWeight: 500, color: t.colors.text.primary }}>
                                    <HunterName address={s.hunter} />
                                  </div>
                                  <div style={{ display: 'flex', gap: '5px', alignItems: 'center', marginTop: '3px', flexWrap: 'wrap' }}>
                                    <Badge type={['pending', 'approved', 'rejected'][subStatus]} label={['Pending', 'Approved', 'Rejected'][subStatus]} />
                                    {s.disputed && <Badge type="disputed" label="Disputed" />}
                                    {/* V3: grace period indicator */}
                                    {subStatus === 0 && s.submittedAt && (() => {
                                      const graceEnd = Number(s.submittedAt) + 7200; // 2h
                                      const inGrace  = nowTs < graceEnd;
                                      const graceLeft = Math.max(0, graceEnd - nowTs);
                                      return inGrace ? (
                                        <span style={{ fontSize: '10px', color: '#fbbf24', background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.15)', padding: '1px 6px', borderRadius: '3px', fontFamily: t.fonts.mono }}>
                                          {fmtDuration(graceLeft)} grace
                                        </span>
                                      ) : null;
                                    })()}
                                    {subStatus === 2 && s.gracePeriodExpired && (
                                      <span style={{ fontSize: '10px', color: '#f87171', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)', padding: '1px 6px', borderRadius: '3px' }}>
                                        post-grace rejection
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                              {/* FIX-4 + FIX-5: Select/Reject shown for ACTIVE or REVIEWING, only for PENDING submissions */}
                              <div style={{ display: 'flex', gap: '7px', alignItems: 'center', flexWrap: 'wrap' }}>
                                {(isActive || isReviewing) && subStatus === 0 && (
                                  <>
                                    <Button
                                      size="sm"
                                      variant={isSelected ? 'primary' : 'secondary'}
                                      icon={isSelected ? <IconCheck size={12} /> : null}
                                      onClick={() => setSelected(p => p.includes(String(s.id)) ? p.filter(x => x !== String(s.id)) : [...p, String(s.id)])}
                                    >
                                      {isSelected ? 'Selected' : 'Select'}
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="danger"
                                      loading={rejecting.has(String(s.id))}
                                      onClick={() => handleReject(s.id)}
                                    >
                                      Reject
                                    </Button>
                                  </>
                                )}
                              </div>
                            </div>
                            {s.ipfsHash && (
                              <div style={{ marginTop: '10px' }}>
                                <SubmissionViewer ipfsHash={s.ipfsHash} hunter={s.hunter} />
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* FIX-5: Approve panel shown for ACTIVE or REVIEWING */}
                    {(isActive || isReviewing) && selected.length > 0 && (
                      <div style={{
                        marginTop: '12px',
                        padding: '12px',
                        background: 'rgba(124,58,237,0.07)',
                        borderRadius: t.radius.md,
                        border: '1px solid rgba(124,58,237,0.18)',
                      }}>
                        <div style={{ fontSize: '12px', color: t.colors.violet[400], marginBottom: '10px' }}>
                          {selected.length} of up to {winnerCount} winner{winnerCount > 1 ? 's' : ''} selected
                          {selected.length < winnerCount && ` — prize redistributed equally among ${selected.length}`}
                        </div>
                        <Button fullWidth loading={approving} onClick={handleApprove} disabled={selected.length < 1}>
                          Approve &amp; Release Funds
                        </Button>
                      </div>
                    )}
                  </>
                )}
              </Card>
            )}

            {/* Hunter's own submission */}
            {!isPoster && mySub && (() => {
              const subStatus = Number(mySub.status);
              const submittedAt = Number(mySub.submittedAt);
              const graceEnd = submittedAt + 7200; // GRACE_PERIOD_REJECT = 2h
              const inGrace  = nowTs < graceEnd;
              const graceSecsLeft = Math.max(0, graceEnd - nowTs);

              // Dispute allowed: rejected, not yet disputed, still in grace, bounty still live (ACTIVE or REVIEWING)
              const canDispute = subStatus === 2 && !mySub.disputed && inGrace &&
                (statusNum === 0 || statusNum === 1);

              // Withdraw allowed: rejected, not disputed, grace period elapsed, stake not yet claimed
              // We detect stake availability via submissionStake > 0 stored on the submission struct
              const graceElapsed = subStatus === 2 && !mySub.disputed && !inGrace;
              const hasStake = mySub.submissionStake && BigInt(mySub.submissionStake) > 0n;
              const canWithdrawStake = graceElapsed && hasStake;

              return (
                <Card>
                  <SectionLabel>Your Submission</SectionLabel>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                    <div style={{ display: 'flex', gap: '7px', alignItems: 'center', flexWrap: 'wrap' }}>
                      <Badge type={['pending', 'approved', 'rejected'][subStatus]} label={['Pending review', 'Approved — you won!', 'Rejected'][subStatus]} />
                      {mySub.disputed && <Badge type="disputed" label="Dispute filed" />}
                      {subStatus === 2 && inGrace && !mySub.disputed && (
                        <span style={{ fontSize: '10px', color: '#fbbf24', background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.15)', padding: '1px 7px', borderRadius: '3px', fontFamily: t.fonts.mono }}>
                          {fmtDuration(graceSecsLeft)} to dispute
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: '7px', flexWrap: 'wrap' }}>
                      {canDispute && (
                        <Button size="sm" variant="danger" loading={disputing} onClick={() => handleRaiseDispute(String(mySub.id))}>
                          Raise Dispute
                        </Button>
                      )}
                      {canWithdrawStake && (
                        <Button size="sm" variant="secondary" loading={withdrawing} onClick={() => handleWithdrawRejectedStake(String(mySub.id))}>
                          Withdraw Stake
                        </Button>
                      )}
                    </div>
                  </div>
                  {mySub.ipfsHash && (
                    <div style={{ marginTop: '10px' }}>
                      <SubmissionViewer ipfsHash={mySub.ipfsHash} hunter={address} />
                    </div>
                  )}
                  {canDispute && (
                    <div style={{ marginTop: '10px', padding: '10px 13px', borderRadius: t.radius.md, background: 'rgba(251,191,36,0.05)', border: '1px solid rgba(251,191,36,0.15)' }}>
                      <div style={{ fontSize: '12px', fontWeight: 600, color: '#fbbf24', marginBottom: '4px' }}>Dispute window open — {fmtDuration(graceSecsLeft)} remaining</div>
                      <div style={{ fontSize: '11.5px', color: t.colors.text.muted, lineHeight: 1.7 }}>
                        If your work was unfairly rejected, raise a dispute within the 2-hour window.
                        Requires a <strong style={{ color: t.colors.text.secondary }}>{DISPUTE_DEPOSIT_MON} MON deposit</strong> — refunded in full if the dispute is upheld.{' '}
                        <strong style={{ color: '#f87171' }}>If the dispute is denied, your submission stake AND the deposit are both slashed to treasury.</strong>
                      </div>
                    </div>
                  )}
                  {graceElapsed && !mySub.disputed && (
                    <div style={{ marginTop: '10px', fontSize: '11.5px', color: t.colors.text.muted, lineHeight: 1.6 }}>
                      The 2-hour dispute window has passed. {canWithdrawStake
                        ? 'Click "Withdraw Stake" above to reclaim your submission stake.'
                        : 'Your submission stake has been refunded.'}
                    </div>
                  )}
                  {mySub.disputed && (
                    <div style={{ marginTop: '10px', padding: '10px 13px', borderRadius: t.radius.md, background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.12)' }}>
                      <div style={{ fontSize: '11.5px', color: t.colors.text.muted, lineHeight: 1.7 }}>
                        <strong style={{ color: '#f87171' }}>Dispute filed.</strong> An admin will review and resolve this.{' '}
                        If upheld: your stake + deposit are returned, poster's stake is slashed to you.{' '}
                        <strong style={{ color: '#f87171' }}>If denied: your submission stake and dispute deposit are both forfeited to treasury.</strong>
                      </div>
                    </div>
                  )}
                  {pendingRefund > 0n && (
                    <div style={{
                      marginTop: '12px',
                      padding: '10px 14px',
                      borderRadius: t.radius.md,
                      background: 'rgba(34,197,94,0.07)',
                      border: '1px solid rgba(34,197,94,0.22)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: '10px',
                      flexWrap: 'wrap',
                    }}>
                      <div>
                        <div style={{ fontSize: '12px', fontWeight: 600, color: t.colors.green[400] }}>
                          Dispute Refund Available
                        </div>
                        <div style={{ fontSize: '11.5px', color: t.colors.text.muted, marginTop: '2px' }}>
                          {ethers.formatEther(pendingRefund)} MON deposit ready to claim
                        </div>
                      </div>
                      <Button size="sm" variant="success" loading={claiming} onClick={handleClaimDisputeRefund}>
                        Claim Refund
                      </Button>
                    </div>
                  )}
                </Card>
              );
            })()}

          </motion.div>

          {/* ── RIGHT ── */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05, duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            style={{ position: 'sticky', top: '80px', display: 'flex', flexDirection: 'column', gap: '14px' }}
          >
            {/* Reward hero */}
            <div style={{
              background: 'rgba(124,58,237,0.07)',
              border: '1px solid rgba(124,58,237,0.18)',
              borderRadius: t.radius.xl,
              padding: '22px',
              textAlign: 'center',
            }}>
              <div style={{
                fontSize: '10.5px',
                color: t.colors.violet[400],
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                marginBottom: '8px',
                fontWeight: 600,
              }}>
                Total Prize Pool
              </div>
              <div style={{
                fontFamily: t.fonts.mono,
                fontSize: 'clamp(26px, 4vw, 38px)',
                fontWeight: 700,
                color: t.colors.violet[300],
                letterSpacing: '-0.04em',
                lineHeight: 1,
              }}>
                {formatReward(bounty.totalReward, bounty.rewardType)}
              </div>
              {winnerCount > 1 && (
                <div style={{ marginTop: '6px', fontSize: '12px', color: t.colors.violet[400] }}>
                  Split between {winnerCount} winners
                </div>
              )}
            </div>

            {/* Info rows */}
            <Card>
              <InfoRow label="Deadline"     value={<DeadlineTimer deadline={bounty.deadline} />} />
              <InfoRow label="Submissions"  value={String(bounty.submissionCount) + ' total'} />
              <InfoRow label="Winners"      value={winnerCount + (winnerCount > 1 ? ' places' : ' winner')} />
              <InfoRow label="Platform fee" value="3%" />
              {/* V3: poster stake */}
              {bounty.posterStake && bounty.posterStake > 0n && (
                <InfoRow
                  label="Poster stake"
                  value={
                    <span style={{ color: '#86efac', fontFamily: t.fonts.mono }}>
                      {parseFloat(ethers.formatEther(bounty.posterStake)).toFixed(4)} MON
                    </span>
                  }
                />
              )}
              <div style={{ padding: '8px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', color: t.colors.text.muted }}>Posted by</span>
                <a
                  href={'#/profile/' + bounty.poster}
                  style={{ fontSize: '12px', color: t.colors.violet[400], textDecoration: 'none', fontFamily: t.fonts.mono }}
                >
                  {posterDisplayName}
                </a>
              </div>
            </Card>

            {/* V3: Review window countdown */}
            {reviewDeadlineTs && (isActive || isReviewing) && (
              <div style={{
                padding: '14px',
                borderRadius: t.radius.md,
                border: `1px solid ${reviewWindowActive ? 'rgba(251,191,36,0.25)' : reviewWindowExpired ? 'rgba(239,68,68,0.25)' : 'rgba(124,58,237,0.18)'}`,
                background: reviewWindowActive ? 'rgba(251,191,36,0.05)' : reviewWindowExpired ? 'rgba(239,68,68,0.05)' : 'rgba(124,58,237,0.05)',
              }}>
                <div style={{ fontSize: '10px', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '6px', color: reviewWindowExpired ? '#f87171' : reviewWindowActive ? '#fbbf24' : t.colors.violet[400] }}>
                  {reviewWindowExpired ? '⚠ Review Overdue' : reviewWindowActive ? '⏱ Review Window' : '📋 Review Window'}
                </div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: reviewWindowExpired ? '#f87171' : '#fbbf24', fontFamily: t.fonts.mono, marginBottom: '4px' }}>
                  {reviewWindowExpired ? 'Expired — timeout claimable' : reviewWindowActive ? fmtDuration(reviewSecsLeft) + ' remaining' : 'Starts after deadline'}
                </div>
                <div style={{ fontSize: '11px', color: t.colors.text.muted, lineHeight: 1.6 }}>
                  {reviewWindowExpired
                    ? 'Poster did not respond. Hunters can trigger timeout to claim funds.'
                    : reviewWindowActive
                    ? 'Poster must approve or reject submissions within this window.'
                    : `Poster has ${fmtDuration(reviewSecsLeft)} after deadline to review.`}
                </div>
              </div>
            )}

            {/* CTAs */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
              {canSubmit && (
                <Button fullWidth size="lg" onClick={() => setShowSubmit(true)}>
                  Submit Work
                </Button>
              )}
              {!address && (
                <div style={{ display: 'flex', justifyContent: 'center' }}>
                  <ConnectButton />
                </div>
              )}
              {alreadySub && !isPoster && (
                <div style={{
                  padding: '10px',
                  textAlign: 'center',
                  background: 'rgba(16,185,129,0.06)',
                  border: '1px solid rgba(52,211,153,0.2)',
                  borderRadius: t.radius.md,
                  fontSize: '12.5px',
                  color: t.colors.green[400],
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                }}>
                  <IconCheck size={13} color={t.colors.green[400]} />
                  Work submitted
                </div>
              )}
              {!isActive && !isDisputed && (
                <div style={{
                  padding: '10px',
                  textAlign: 'center',
                  background: t.colors.bg.elevated,
                  border: '1px solid ' + t.colors.border.default,
                  borderRadius: t.radius.md,
                  fontSize: '12.5px',
                  color: t.colors.text.muted,
                }}>
                  This bounty is {statusKey}
                </div>
              )}
              {/* FIX-9: Transition to REVIEWING — available to poster after deadline with pending subs */}
              {isPoster && canTransitionToReviewing && (
                <Button fullWidth variant="secondary" size="sm" loading={transitioning} onClick={handleTransitionToReviewing}>
                  Mark as In Review
                </Button>
              )}
              {/* V3: Trigger timeout only after reviewDeadline has passed */}
              {address && !isPoster && (isActive || isReviewing) && submissions.length > 0 && reviewWindowExpired && (
                <Button fullWidth variant="ghost" size="sm" onClick={handleTimeout}>Trigger Timeout</Button>
              )}
              {/* FIX-5: Cancel available for both ACTIVE and REVIEWING */}
              {isPoster && (isActive || isReviewing) && (
                <Button fullWidth variant="danger" size="sm" loading={cancelling} onClick={handleCancel}>
                  Cancel Bounty
                </Button>
              )}
              {isPoster && (
                <a
                  href={explorerUrl(ADDRESSES.factory, 'address')}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    textAlign: 'center',
                    fontSize: '11.5px',
                    color: t.colors.text.muted,
                    textDecoration: 'none',
                    padding: '5px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '4px',
                  }}
                >
                  <IconExternal size={11} />
                  View Contract on Explorer
                </a>
              )}
            </div>

          </motion.div>
        </div>
      </div>

      <SubmitWorkModal open={showSubmit} onClose={() => setShowSubmit(false)} bountyId={bountyId} bountyReward={bounty?.totalReward} onSuccess={refetch} />
    </div>
  );
}
