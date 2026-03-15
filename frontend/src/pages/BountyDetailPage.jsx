import { useState, useEffect } from 'react';
import { useAccount, useWalletClient } from 'wagmi';
import { ethers } from 'ethers';
import { theme } from '../styles/theme';
import Badge from '../components/common/Badge';
import Button from '../components/common/Button';
import { PageLoader } from '../components/common/Spinner';
import DeadlineTimer from '../components/bounty/DeadlineTimer';
import SubmissionViewer from '../components/bounty/SubmissionViewer';
import SubmitWorkModal from '../components/bounty/SubmitWorkModal';
import ApplyModal from '../components/bounty/ApplyModal';
import RequestRevisionModal from '../components/bounty/RequestRevisionModal';
import RevisionResponseModal from '../components/bounty/RevisionResponseModal';
import ProposalViewModal from '../components/bounty/ProposalViewModal';
import { saveRevisionLink, getRevisionLink } from '../components/bounty/RequestRevisionModal';
import { AvatarDisplay } from '../components/common/Avatar';
import { useBounty } from '../hooks/useBounty';
import { getFactoryCapabilities } from '../utils/factoryCapabilities';
import { getContract, getReadContractWithFallback, getReadContractFast } from '../utils/ethers';
import { clearRegistryResolutionCache } from '../utils/registry';
import { ADDRESSES, FACTORY_ABI, REGISTRY_ABI } from '../config/contracts';
import { toast } from '../utils/toast';
import { invalidateBountiesCache } from '../hooks/useBounties';
import { requestNotificationRefresh } from '../hooks/useNotifications';
import { getProfileMeta } from '../hooks/useProfileMeta';
import { useDisplayName } from '../hooks/useIdentity';
import { IconWarning, IconChevronLeft, IconExternalLink, IconChevronRight, IconTarget, IconClock } from '../components/icons';
import ReactMarkdown from 'react-markdown';
import { GATEWAY } from '../config/pinata';

function SafeLink({ href, children, ...props }) {
  const isSafe = href && (href.startsWith('https://') || href.startsWith('http://') || href.startsWith('#') || href.startsWith('ipfs://'));
  if (!isSafe) return <span style={{ textDecoration: 'underline', opacity: 0.5 }}>{children}</span>;
  const resolved = href.startsWith('ipfs://')
    ? (GATEWAY || 'https://gateway.pinata.cloud/ipfs/') + href.replace('ipfs://', '')
    : href;
  return <a href={resolved} target="_blank" rel="noopener noreferrer" {...props}>{children}</a>;
}
const MD_COMPONENTS = { a: SafeLink };

// ── Creator mini-card ─────────────────────────────────────────────────────────
function CreatorCard({ address }) {
  const meta       = getProfileMeta(address);
  const { displayName } = useDisplayName(address); // on-chain username
  const shortAddr  = `${address.slice(0, 6)}…${address.slice(-4)}`;
  const name       = meta?.displayName || displayName || shortAddr;

  return (
    <div
      onClick={() => { window.location.hash = `#/profile/${address}`; }}
      style={{
        padding: '14px 16px', cursor: 'pointer',
        background: theme.colors.bg.card,
        border: `1px solid ${theme.colors.border.subtle}`,
        borderRadius: theme.radius.lg, transition: theme.transition,
      }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = theme.colors.border.default; e.currentTarget.style.background = theme.colors.bg.elevated; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = theme.colors.border.subtle; e.currentTarget.style.background = theme.colors.bg.card; }}
    >
      <div style={{ fontFamily: theme.fonts.mono, fontSize: 9.5, color: theme.colors.text.faint, letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 10 }}>Posted by</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <AvatarDisplay address={address} size={36} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: theme.fonts.body, fontWeight: 600, fontSize: 13, color: theme.colors.text.primary }}>{name}</div>
          {(meta?.displayName || displayName) && <div style={{ fontFamily: theme.fonts.mono, fontSize: 10, color: theme.colors.text.faint }}>{shortAddr}</div>}
        </div>
        <IconExternalLink size={12} color={theme.colors.text.faint} style={{ flexShrink: 0 }} />
      </div>
      {meta?.bio && (
        <p style={{ fontFamily: theme.fonts.body, fontSize: 12, color: theme.colors.text.muted, lineHeight: 1.6, margin: '10px 0 0', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{meta.bio}</p>
      )}
      {meta?.skills?.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 8 }}>
          {meta.skills.slice(0, 4).map((s, i) => (
            <span key={i} style={{ padding: '2px 7px', background: theme.colors.bg.elevated, border: `1px solid ${theme.colors.border.subtle}`, borderRadius: theme.radius.full, fontFamily: theme.fonts.body, fontSize: 10.5, color: theme.colors.text.secondary }}>{s}</span>
          ))}
          {meta.skills.length > 4 && <span style={{ fontFamily: theme.fonts.body, fontSize: 10.5, color: theme.colors.text.faint, padding: '2px 4px' }}>+{meta.skills.length - 4}</span>}
        </div>
      )}
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function getIdFromHash() {
  const m = window.location.hash.match(/#\/bounty\/(.+)/);
  return m?.[1] || null;
}

const STATUS_STR = { 0: 'active', 1: 'reviewing', 2: 'completed', 3: 'expired', 4: 'cancelled', 5: 'disputed' };
function normalizeStatus(s) {
  if (s == null) return 'unknown';
  return STATUS_STR[Number(s)] || String(s).toLowerCase();
}

function formatMon(wei) {
  if (wei == null) return '0';
  return (Number(wei) / 1e18).toFixed(4).replace(/\.?0+$/, '') || '0';
}

function deadlineToDate(dl) {
  if (!dl) return '';
  const ms = typeof dl === 'bigint' ? Number(dl) * 1000 : dl < 1e12 ? dl * 1000 : Number(dl);
  return new Date(ms).toLocaleDateString();
}

function nowSec() { return Math.floor(Date.now() / 1000); }

function InfoRow({ label, value, mono }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, padding: '11px 0', borderBottom: `1px solid ${theme.colors.border.faint}` }}>
      <span style={{ fontFamily: theme.fonts.mono, fontSize: 9.5, color: theme.colors.text.muted, textTransform: 'uppercase', letterSpacing: '0.06em', flexShrink: 0 }}>{label}</span>
      <span style={{ fontFamily: mono ? theme.fonts.mono : theme.fonts.body, fontSize: mono ? 12 : 13, color: theme.colors.text.secondary, textAlign: 'right' }}>{value}</span>
    </div>
  );
}

// ── Section card wrapper (consistent header + content) ─────────────────────────
function SectionCard({ title, children, style = {} }) {
  return (
    <div style={{
      padding: '18px 20px', marginBottom: 24,
      background: theme.colors.bg.card,
      border: `1px solid ${theme.colors.border.subtle}`,
      borderRadius: theme.radius.lg,
      ...style,
    }}>
      <div style={{
        fontFamily: theme.fonts.mono, fontSize: 10, fontWeight: 600,
        color: theme.colors.text.faint, letterSpacing: '0.08em',
        textTransform: 'uppercase', marginBottom: 14,
      }}>
        {title}
      </div>
      {children}
    </div>
  );
}

// ── Status badge (consistent pill) ───────────────────────────────────────────
function StatusBadge({ label, color, bg, borderColor }) {
  return (
    <span style={{
      fontFamily: theme.fonts.mono, fontSize: 10, fontWeight: 600,
      color: color, letterSpacing: '0.04em', textTransform: 'uppercase',
      padding: '4px 10px', borderRadius: theme.radius.full,
      background: bg, border: `1px solid ${borderColor}`,
    }}>
      {label}
    </span>
  );
}

// ── Action button (compact, theme-aligned) ────────────────────────────────────
function ActionBtn({ onClick, loading, disabled, children, variant = 'default', fullWidth = false }) {
  const [hov, setHov] = useState(false);
  const styles = {
    default: { bg: theme.colors.bg.elevated, border: theme.colors.border.default, color: theme.colors.text.secondary },
    danger:  { bg: theme.colors.red.dim, border: theme.colors.red.border, color: theme.colors.red[400] },
    primary: { bg: theme.colors.primaryDim, border: theme.colors.primaryBorder, color: theme.colors.primaryLight },
    success: { bg: theme.colors.green.dim, border: theme.colors.green.border, color: theme.colors.green[400] },
    amber:   { bg: theme.colors.amberDim, border: theme.colors.amberBorder, color: theme.colors.amber },
  };
  const s = (disabled || loading) ? styles.default : (styles[variant] || styles.default);
  return (
    <button
      onClick={disabled || loading ? undefined : onClick}
      disabled={disabled || loading}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        width: fullWidth ? '100%' : undefined,
        padding: '7px 14px', borderRadius: theme.radius.md,
        background: hov && !disabled && !loading ? s.bg : s.bg,
        border: `1px solid ${s.border}`, color: s.color,
        fontFamily: theme.fonts.body, fontSize: 12, fontWeight: 600,
        cursor: disabled || loading ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        transition: theme.transition, whiteSpace: 'nowrap',
        display: 'inline-flex', alignItems: 'center', gap: 6,
      }}
    >
      {loading ? '…' : children}
    </button>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function BountyDetailPage() {
  const { address } = useAccount();
  const { data: walletClient } = useWalletClient();
  const id = getIdFromHash();
  const { bounty, meta, submissions = [], loading, error, refetch } = useBounty(id);

  const [submitOpen,     setSubmitOpen]     = useState(false);
  const [actioning,      setActioning]      = useState(null);   // which action is loading
  const [cancelCompData, setCancelCompData] = useState(null);   // { amount } pending claim
  const [timeoutData,    setTimeoutData]    = useState(null);
  const [stakeRefund,    setStakeRefund]    = useState(null);
  const [disputeRefund,  setDisputeRefund]  = useState(null);
  const [constants,      setConstants]      = useState({});     // on-chain constants

  // V4: Application system state
  const [applyOpen,      setApplyOpen]      = useState(false);
  const [applications,   setApplications]   = useState([]);    // creator sees all
  const [myApplication,  setMyApplication]  = useState(null);  // builder sees own
  const [approvingAddr,  setApprovingAddr]  = useState(null);  // address being approved
  const [applicationFlowEnabled, setApplicationFlowEnabled] = useState(false);

  // Opsi B: Revision (off-chain) modals
  const [requestRevisionSubId, setRequestRevisionSubId] = useState(null);
  const [revisionResponseSubId, setRevisionResponseSubId] = useState(null);
  const [revisionRefresh, setRevisionRefresh] = useState(0);

  // Proposal view modal (creator reviewing builder application)
  const [proposalViewApp, setProposalViewApp] = useState(null);

  const requiresApplication = applicationFlowEnabled && !!bounty?.requiresApplication;

  // Opsi B: Parse URL params ?revisionRequest= & ?revisionResponse= & submissionId= and persist
  useEffect(() => {
    if (!id) return;
    const hash = window.location.hash;
    const qStart = hash.indexOf('?');
    if (qStart < 0) return;
    const params = new URLSearchParams(hash.slice(qStart));
    const req = params.get('revisionRequest');
    const res = params.get('revisionResponse');
    const subId = params.get('submissionId');
    if (req && subId) saveRevisionLink(id, subId, 'request', req);
    if (res && subId) saveRevisionLink(id, subId, 'response', res);
  }, [id]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const caps = await getFactoryCapabilities().catch(() => null);
      if (cancelled) return;
      setApplicationFlowEnabled(!(caps?.openOnlyLegacy || caps?.supportsApplications === false));
    })();
    return () => { cancelled = true; };
  }, []);

  // Fetch on-chain constants + pending pull-payment amounts for connected user
  useEffect(() => {
    if (!ADDRESSES.factory) return;

    async function load() {
      try {
        const f = await getReadContractWithFallback(ADDRESSES.factory, FACTORY_ABI);
        const [
          disputeDep, cancelBps, graceRej,
          minReview,
        ] = await Promise.all([
          f.DISPUTE_DEPOSIT().catch(() => ethers.parseEther('0.01')),
          f.CANCEL_COMP_BPS().catch(() => 200n),
          f.GRACE_PERIOD_REJECT().catch(() => 7200n),
          f.MIN_REVIEW_WINDOW().catch(() => 86400n),
        ]);
        setConstants({ disputeDep, cancelBps, graceRej, minReview });
      } catch {}
    }
    load();
  }, []);

  // Fetch pending pull-payments for connected user
  useEffect(() => {
    if (!address || !ADDRESSES.factory) return;
    async function loadPending() {
      try {
        const f = await getReadContractWithFallback(ADDRESSES.factory, FACTORY_ABI);
        const [cc, tp, sr, dr] = await Promise.all([
          f.pendingCancelComps(address).catch(() => 0n),
          f.pendingTimeoutPayouts(address).catch(() => 0n),
          f.pendingStakeRefunds(address).catch(() => 0n),
          f.pendingDisputeRefunds(address).catch(() => 0n),
        ]);
        setCancelCompData(cc > 0n ? cc : null);
        setTimeoutData(tp > 0n ? tp : null);
        setStakeRefund(sr > 0n ? sr : null);
        setDisputeRefund(dr > 0n ? dr : null);
      } catch {}
    }
    loadPending();
  }, [address]);

  // V4: Fetch application data when bounty is loaded
  useEffect(() => {
    if (!bounty || !requiresApplication || !ADDRESSES.factory) return;
    const f = getReadContractFast(ADDRESSES.factory, FACTORY_ABI);
    const _isCreator = address && bounty.creator?.toLowerCase() === address.toLowerCase();

    if (_isCreator) {
      // Creator: load all applications for this bounty
      f.getBountyApplications(BigInt(id))
        .then(apps => setApplications(apps ?? []))
        .catch(() => setApplications([]));
    } else if (address) {
      // Builder: check own application
      f.getBuilderApplications(address)
        .then(apps => {
          const mine = (apps ?? []).find(a => String(a.bountyId) === String(id));
          setMyApplication(mine || null);
        })
        .catch(() => setMyApplication(null));
    }
  }, [requiresApplication, bounty?.creator, id, address]);

  if (loading) return <PageLoader />;
  if (error || !bounty) {
    return (
      <div style={{ maxWidth: 600, margin: '0 auto', padding: 'clamp(64px,10vh,120px) 24px', textAlign: 'center' }}>
        <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'center' }}><IconWarning size={32} color={theme.colors.amber} /></div>
        <h2 style={{ fontFamily: theme.fonts.body, fontWeight: 700, fontSize: 20, color: theme.colors.text.primary, marginBottom: 8 }}>Bounty not found</h2>
        <p style={{ fontSize: 13, color: theme.colors.text.muted, marginBottom: 24 }}>This bounty may have been removed or the ID is invalid.</p>
        <Button variant="secondary" size="sm" icon={<IconChevronLeft size={14} color="currentColor" />} onClick={() => { window.location.hash = '#/bounties'; }}>Back to Bounties</Button>
      </div>
    );
  }

  // ── Derived state ──────────────────────────────────────────────────────────
  const status       = normalizeStatus(bounty.status);
  const isCreator    = address && bounty.creator?.toLowerCase() === address.toLowerCase();
  const isActive     = status === 'active';
  const isReviewing  = status === 'reviewing';
  const isLive       = isActive || isReviewing;
  const isDisputed   = status === 'disputed';
  const isSettled    = ['completed', 'expired', 'cancelled'].includes(status);

  const now          = nowSec();
  const deadline     = Number(bounty.deadline || 0);
  const reviewDl     = Number(bounty.reviewDeadline || 0);
  const deadlinePast = now >= deadline;
  const reviewDlPast = reviewDl > 0 ? now > reviewDl : false;

  // Who can do what — must declare mySubmission before canApply references it
  const pendingCount = submissions.filter(s => Number(s.status) === 0).length;
  const mySubmission = address ? submissions.find(s => s.builder?.toLowerCase() === address.toLowerCase()) : null;

  // Block apply/submit when bounty has ever had a disputed submission (dispute raised)
  const hasDisputedSubmission = submissions.some((s) => !!s.disputed);
  // canSubmit: active OR reviewing, not creator, connected, before deadline, approved (if curated), no disputed, no existing submission
  const isApprovedApplicant = requiresApplication
    ? (myApplication != null && Number(myApplication.status) === 1)
    : true;
  const canSubmit = isLive && !isCreator && !!address && !deadlinePast && isApprovedApplicant && !hasDisputedSubmission && !mySubmission;
  // Builder can apply if: curated, active, not creator, before deadline, no application yet, no submission yet, no disputed submission
  const canApply = requiresApplication && isActive && !isCreator && !!address
    && !deadlinePast && !myApplication && !mySubmission && !hasDisputedSubmission;
  const mySubStatus  = mySubmission ? Number(mySubmission.status) : -1; // 0=pending 1=approved 2=rejected

  // Grace period: within GRACE_PERIOD_REJECT of rejection
  const graceRejSec = Number(constants.graceRej || 7200);
  const mySubInGrace = mySubmission && mySubStatus === 2 && !mySubmission.disputed
    && (mySubmission.rejectedAt > 0
      ? now < Number(mySubmission.rejectedAt) + graceRejSec
      : false);
  const mySubPostGrace = mySubmission && mySubStatus === 2 && !mySubmission.disputed
    && (mySubmission.rejectedAt > 0
      ? now >= Number(mySubmission.rejectedAt) + graceRejSec
      : false);

  // Dispute deposit
  const disputeDep = constants.disputeDep || ethers.parseEther('0.01');
  const cancelBps  = Number(constants.cancelBps || 200);

  // Cancel compensation per builder
  const compPerBuilder = bounty.totalReward
    ? (BigInt(bounty.totalReward) * BigInt(cancelBps)) / 10000n
    : 0n;
  const validSubCount = submissions.filter(s => {
    const st = Number(s.status);
    return st === 0 || (st === 2 && s.gracePeriodExpired);
  }).length;
  const totalComp = compPerBuilder * BigInt(validSubCount);

  // ── Action handlers ────────────────────────────────────────────────────────

  const withFactory = async (fn, actionKey) => {
    if (!walletClient || !ADDRESSES.factory) return;
    setActioning(actionKey);
    try {
      const factory = await getContract(ADDRESSES.factory, FACTORY_ABI, walletClient);
      const tx = await fn(factory);
      await tx.wait();
      clearRegistryResolutionCache();
      invalidateBountiesCache();
      refetch();
      requestNotificationRefresh();
    } catch (err) {
      toast((err.reason || err.shortMessage || err.message || 'Transaction failed'), 'error');
    } finally {
      setActioning(null);
    }
  };

  // ── Cancel bounty ──────────────────────────────────────────────────────────
  // No subs → free; subs → must send totalComp as msg.value
  const handleCancel = () => withFactory(async (factory) => {
    const opts = validSubCount > 0 ? { value: totalComp } : {};
    const tx = await factory.cancelBounty(BigInt(id), opts);
    toast('Bounty cancelled.', 'success');
    return tx;
  }, 'cancel');

  // ── Approve winner(s) ──────────────────────────────────────────────────────
  // For simplicity: approve single submission with rank [1]. Full multi-winner
  // flow is handled inside SubmissionViewer via onApprove callback.
  const handleApprove = async (submissionId) => {
    if (!walletClient || !id || !ADDRESSES.factory) return;
    setActioning('approve-' + submissionId);
    try {
      const factory = await getContract(ADDRESSES.factory, FACTORY_ABI, walletClient);
      const tx = await factory.approveWinners(BigInt(id), [BigInt(submissionId)], [1]);
      await tx.wait();
      clearRegistryResolutionCache();
      invalidateBountiesCache();
      toast('Winner approved! Payment released.', 'success');
      refetch();
      requestNotificationRefresh();
    } catch (err) {
      toast((err.reason || err.shortMessage || err.message), 'error');
    } finally {
      setActioning(null);
    }
  };

  // ── Reject submission ──────────────────────────────────────────────────────
  const handleReject = async (submissionId) => {
    await withFactory(async (factory) => {
      const tx = await factory.rejectSubmission(BigInt(id), BigInt(submissionId));
      toast('Submission rejected.', 'info');
      return tx;
    }, 'reject-' + submissionId);
  };

  // ── Raise dispute (builder) ────────────────────────────────────────────────
  const handleDispute = async (submissionId) => {
    await withFactory(async (factory) => {
      const tx = await factory.raiseDispute(BigInt(id), BigInt(submissionId), { value: disputeDep });
      toast('Dispute raised! Deposited ' + formatMon(disputeDep) + ' MON.', 'info');
      return tx;
    }, 'dispute-' + submissionId);
  };

  // ── Withdraw rejected stake (builder, after grace period) ─────────────────
  const handleWithdrawStake = async (submissionId) => {
    await withFactory(async (factory) => {
      const tx = await factory.withdrawRejectedStake(BigInt(id), BigInt(submissionId));
      toast('Stake withdrawn.', 'success');
      return tx;
    }, 'withdrawstake-' + submissionId);
  };

  // ── Transition to reviewing (anyone, after deadline if pending subs) ───────
  const handleTransitionReview = () => withFactory(async (factory) => {
    const tx = await factory.transitionToReviewing(BigInt(id));
    toast('Bounty entered review window.', 'info');
    return tx;
  }, 'transition');

  // ── Expire bounty (no subs, deadline passed) ──────────────────────────────
  const handleExpire = () => withFactory(async (factory) => {
    const tx = await factory.expireBounty(BigInt(id));
    toast('Bounty expired. Reward refunded.', 'info');
    return tx;
  }, 'expire');

  // ── Trigger timeout (anyone, after review deadline, pending subs exist) ───
  const handleTriggerTimeout = () => withFactory(async (factory) => {
    const tx = await factory.triggerTimeout(BigInt(id));
    toast('Timeout triggered. Builders can now claim payouts.', 'info');
    return tx;
  }, 'timeout');

  // ── Pull-payment claims ────────────────────────────────────────────────────
  const claimCancelComp = () => withFactory(async (factory) => {
    const tx = await factory.claimCancelComp();
    setCancelCompData(null);
    toast('Cancel compensation claimed!', 'success');
    return tx;
  }, 'claimcancel');

  const claimTimeoutPayout = () => withFactory(async (factory) => {
    const tx = await factory.claimTimeoutPayout();
    setTimeoutData(null);
    toast('Timeout payout claimed!', 'success');
    return tx;
  }, 'claimtimeout');

  const claimStakeRefund = () => withFactory(async (factory) => {
    const tx = await factory.claimStakeRefund();
    setStakeRefund(null);
    toast('Stake refund claimed!', 'success');
    return tx;
  }, 'claimstake');

  const claimDisputeRefund = () => withFactory(async (factory) => {
    const tx = await factory.claimDisputeRefund();
    setDisputeRefund(null);
    toast('Dispute deposit refunded!', 'success');
    return tx;
  }, 'claimdispute');

  // ── V4: Application action handlers ──────────────────────────────────────
  const handleApproveApp = async (builderAddr) => {
    setApprovingAddr(builderAddr);
    await withFactory(async (factory) => {
      const tx = await factory.approveApplication(BigInt(id), builderAddr);
      toast('Application approved!', 'success');
      return tx;
    }, 'approveapp-' + builderAddr);
    // Refresh applications list
    const f = getReadContractFast(ADDRESSES.factory, FACTORY_ABI);
    const apps = await f.getBountyApplications(BigInt(id)).catch(() => []);
    setApplications(apps ?? []);
    setApprovingAddr(null);
  };

  const handleRejectApp = async (builderAddr) => {
    await withFactory(async (factory) => {
      const tx = await factory.rejectApplication(BigInt(id), builderAddr);
      toast('Application rejected.', 'info');
      return tx;
    }, 'rejectapp-' + builderAddr);
    const f = getReadContractFast(ADDRESSES.factory, FACTORY_ABI);
    const apps = await f.getBountyApplications(BigInt(id)).catch(() => []);
    setApplications(apps ?? []);
  };

  // ── Derived UI flags ───────────────────────────────────────────────────────
  const showCancelBtn = isCreator && isLive && !isSettled;
  const showTransitionBtn = !isCreator && isActive && deadlinePast && pendingCount > 0 && !isDisputed;
  const showExpireBtn = isActive && deadlinePast && submissions.length === 0;
  const showTimeoutBtn = (isActive || isReviewing) && reviewDlPast && pendingCount > 0 && !isDisputed;

  const hasPendingClaims = cancelCompData || timeoutData || stakeRefund || disputeRefund;

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: 'clamp(32px,5vw,56px) clamp(16px,4vw,48px)' }}>
      {/* Back */}
      <button
        onClick={() => window.history.back()}
        style={{ fontFamily: theme.fonts.body, fontSize: 12, color: theme.colors.text.muted, background: 'none', border: 'none', cursor: 'pointer', marginBottom: 28, padding: 0, display: 'flex', alignItems: 'center', gap: 5 }}
      ><IconChevronLeft size={14} color="currentColor" style={{ marginRight: 4 }} /> Back</button>

      {/* ── Pending claims banner ────────────────────────────────────────────── */}
      {hasPendingClaims && address && (
        <div style={{
          padding: '14px 18px', marginBottom: 20,
          background: 'rgba(255,174,69,0.06)',
          border: `1px solid ${theme.colors.amberBorder}`,
          borderRadius: theme.radius.lg,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexWrap: 'wrap', gap: 12,
        }}>
          <div>
            <span style={{ fontFamily: theme.fonts.body, fontWeight: 600, fontSize: 13, color: theme.colors.amber, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <IconTarget size={14} color={theme.colors.amber} /> You have pending payouts to claim
            </span>
            <div style={{ fontFamily: theme.fonts.body, fontSize: 11.5, color: theme.colors.text.muted, marginTop: 3 }}>
              {[
                cancelCompData && `Cancel comp: ${formatMon(cancelCompData)} MON`,
                timeoutData    && `Timeout payout: ${formatMon(timeoutData)} MON`,
                stakeRefund    && `Stake refund: ${formatMon(stakeRefund)} MON`,
                disputeRefund  && `Dispute deposit: ${formatMon(disputeRefund)} MON`,
              ].filter(Boolean).join(' · ')}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {cancelCompData  && <ActionBtn onClick={claimCancelComp}    loading={actioning === 'claimcancel'}  variant="amber">Claim Comp {formatMon(cancelCompData)} MON</ActionBtn>}
            {timeoutData     && <ActionBtn onClick={claimTimeoutPayout} loading={actioning === 'claimtimeout'} variant="amber">Claim Payout {formatMon(timeoutData)} MON</ActionBtn>}
            {stakeRefund     && <ActionBtn onClick={claimStakeRefund}   loading={actioning === 'claimstake'}   variant="amber">Claim Stake {formatMon(stakeRefund)} MON</ActionBtn>}
            {disputeRefund   && <ActionBtn onClick={claimDisputeRefund} loading={actioning === 'claimdispute'} variant="amber">Claim Deposit {formatMon(disputeRefund)} MON</ActionBtn>}
          </div>
        </div>
      )}

      <style>{`@media (max-width: 768px) { .bounty-detail-grid { grid-template-columns: 1fr !important; } }`}</style>
      <style>{`
        .bounty-detail-description .markdown-body { max-width: 100%; word-wrap: break-word; }
        .bounty-detail-description .markdown-body > *:first-child { margin-top: 0; }
        .bounty-detail-description .markdown-body > *:last-child { margin-bottom: 0; }
        .bounty-detail-description .markdown-body p { margin: 0 0 0.85em; line-height: 1.75; }
        .bounty-detail-description .markdown-body p:last-child { margin-bottom: 0; }
        .bounty-detail-description .markdown-body h2 { font-size: 1.05em; font-weight: 700; color: ${theme.colors.text.primary}; margin: 1.25em 0 0.5em; line-height: 1.4; }
        .bounty-detail-description .markdown-body h2:first-child { margin-top: 0; }
        .bounty-detail-description .markdown-body h3 { font-size: 1em; font-weight: 600; color: ${theme.colors.text.primary}; margin: 1em 0 0.4em; line-height: 1.4; }
        .bounty-detail-description .markdown-body ul, .bounty-detail-description .markdown-body ol { margin: 0.5em 0 0.85em; padding-left: 1.6em; line-height: 1.7; }
        .bounty-detail-description .markdown-body li { margin: 0.35em 0; padding-left: 0.25em; }
        .bounty-detail-description .markdown-body strong { font-weight: 600; color: ${theme.colors.text.primary}; }
        .bounty-detail-description .markdown-body a { color: ${theme.colors.primary}; text-decoration: none; }
        .bounty-detail-description .markdown-body a:hover { text-decoration: underline; }
        .bounty-detail-markdown-inline ul, .bounty-detail-markdown-inline ol { margin: 0.4em 0; padding-left: 1.4em; }
        .bounty-detail-markdown-inline li { margin: 0.25em 0; padding-left: 0.2em; }
      `}</style>
      <div className="bounty-detail-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 24, alignItems: 'start' }}>
        {/* ── LEFT ─────────────────────────────────────────────────────────── */}
        <div>
          {/* Badges */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
            <Badge type={status} />
            <Badge type={meta?.category || bounty.category || 'other'} />
            {bounty.featured && <Badge type="featured" label="Featured" />}
            {requiresApplication && (
              <span style={{
                fontFamily: theme.fonts.mono, fontSize: 9.5, fontWeight: 500,
                color: theme.colors.amber, letterSpacing: '0.06em', textTransform: 'uppercase',
                padding: '2px 7px',
                background: theme.colors.amberDim,
                border: `1px solid ${theme.colors.amberBorder}`,
                borderRadius: theme.radius.full,
              }}><IconTarget size={9} color={theme.colors.amber} style={{ marginRight: 4, verticalAlign: 'middle' }} /> Curated</span>
            )}
          </div>

          {/* Title */}
          <h1 style={{ fontFamily: theme.fonts.body, fontWeight: 800, fontSize: 'clamp(22px,4vw,36px)', letterSpacing: '-0.04em', color: theme.colors.text.primary, lineHeight: 1.15, marginBottom: 16 }}>
            {meta?.title || bounty.title || 'Untitled Bounty'}
          </h1>

          {/* Reward + deadline */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 28, flexWrap: 'wrap' }}>
            <span style={{ fontFamily: theme.fonts.mono, fontSize: 24, fontWeight: 500, color: theme.colors.primary, letterSpacing: '-0.03em' }}>
              {formatMon(bounty.totalReward)} MON
            </span>
            {bounty.deadline && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontFamily: theme.fonts.mono, fontSize: 10, color: theme.colors.text.faint, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Deadline</span>
                <DeadlineTimer deadline={bounty.deadline} />
              </div>
            )}
          </div>

          {/* Prominent CTA for builders — visible immediately, no scroll */}
          {!isCreator && (canSubmit || canApply || !address) && (
            <div style={{
              padding: '16px 20px',
              marginBottom: 28,
              background: theme.colors.primaryDim,
              border: `1px solid ${theme.colors.primaryBorder}`,
              borderRadius: theme.radius.lg,
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}>
              <div style={{ fontFamily: theme.fonts.body, fontWeight: 600, fontSize: 14, color: theme.colors.primaryLight }}>
                {canSubmit && 'Ready to deliver? Submit your work.'}
                {canApply && !canSubmit && 'This project requires an application. Submit your proposal first.'}
                {!address && 'Connect your wallet to participate.'}
              </div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {canSubmit && (
                  <Button variant="primary" size="sm" iconRight={<IconChevronRight size={12} color="currentColor" />} onClick={() => setSubmitOpen(true)}>
                    Submit Work
                  </Button>
                )}
                {canApply && !canSubmit && (
                  <Button variant="primary" size="sm" iconRight={<IconChevronRight size={12} color="currentColor" />} onClick={() => setApplyOpen(true)}>
                    Apply / Submit Proposal
                  </Button>
                )}
                {!address && (
                  <span style={{ fontFamily: theme.fonts.body, fontSize: 13, color: theme.colors.text.muted }}>
                    Connect wallet to see actions
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Description — supports Markdown from Post Bounty overview */}
          {(meta?.fullDescription || meta?.description) && (
            <div className="bounty-detail-description" style={{ marginBottom: 32 }}>
              <h2 style={{ fontFamily: theme.fonts.body, fontWeight: 700, fontSize: 15, letterSpacing: '-0.02em', color: theme.colors.text.primary, marginBottom: 12 }}>Description</h2>
              <div style={{ fontFamily: theme.fonts.body, fontSize: 14, color: theme.colors.text.secondary, lineHeight: 1.75 }} className="markdown-body">
                <ReactMarkdown components={MD_COMPONENTS}>{meta.fullDescription || meta.description}</ReactMarkdown>
              </div>
            </div>
          )}

          {/* Requirements — each item may contain Markdown */}
          {meta?.requirements?.length > 0 && (
            <div style={{ marginBottom: 28 }}>
              <h2 style={{ fontFamily: theme.fonts.mono, fontSize: 10, fontWeight: 600, color: theme.colors.text.faint, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 12 }}>Requirements</h2>
              <div style={{ border: `1px solid ${theme.colors.border.subtle}`, borderRadius: theme.radius.md, overflow: 'hidden' }}>
                {meta.requirements.map((r, i) => (
                  <div key={i} style={{ display: 'flex', gap: 12, padding: '12px 16px', background: i % 2 === 0 ? 'transparent' : `${theme.colors.bg.elevated}60`, borderBottom: i < meta.requirements.length - 1 ? `1px solid ${theme.colors.border.faint}` : 'none', alignItems: 'flex-start' }}>
                    <span style={{ fontFamily: theme.fonts.mono, fontSize: 10, color: theme.colors.primary, flexShrink: 0, marginTop: 2, minWidth: 20, textAlign: 'right' }}>{i + 1}.</span>
                    <div className="bounty-detail-markdown-inline" style={{ flex: 1, fontFamily: theme.fonts.body, fontSize: 13.5, color: theme.colors.text.secondary, lineHeight: 1.65, minWidth: 0 }}>
                      <ReactMarkdown components={MD_COMPONENTS}>{String(r)}</ReactMarkdown>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Deliverables / Evaluation criteria — may contain Markdown */}
          {meta?.evaluationCriteria?.length > 0 && (
            <div style={{ marginBottom: 28 }}>
              <h2 style={{ fontFamily: theme.fonts.mono, fontSize: 10, fontWeight: 600, color: theme.colors.text.faint, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 12 }}>Deliverables</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {meta.evaluationCriteria.map((d, i) => (
                  <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '10px 0' }}>
                    <IconChevronRight size={12} color={theme.colors.cyan} style={{ flexShrink: 0, marginTop: 4 }} />
                    <div className="bounty-detail-markdown-inline" style={{ flex: 1, fontFamily: theme.fonts.body, fontSize: 13.5, color: theme.colors.text.secondary, lineHeight: 1.65, minWidth: 0 }}>
                      <ReactMarkdown components={MD_COMPONENTS}>{String(d)}</ReactMarkdown>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Skills */}
          {meta?.skills?.length > 0 && (
            <div style={{ marginBottom: 28 }}>
              <h3 style={{ fontFamily: theme.fonts.mono, fontSize: 10, fontWeight: 600, color: theme.colors.text.faint, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10 }}>Required Skills</h3>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {meta.skills.map(s => (
                  <span
                    key={s}
                    style={{
                      fontFamily: theme.fonts.body, fontSize: 12, fontWeight: 500,
                      color: theme.colors.text.secondary,
                      background: theme.colors.bg.elevated,
                      border: `1px solid ${theme.colors.border.subtle}`,
                      borderRadius: theme.radius.full,
                      padding: '5px 12px',
                    }}
                  >
                    {s}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* ── Creator action buttons ────────────────────────────────────── */}
          {isCreator && isLive && (
            <SectionCard title="Creator Actions">
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                {showCancelBtn && (
                  <ActionBtn onClick={handleCancel} loading={actioning === 'cancel'} variant="danger">
                    {validSubCount > 0
                      ? `Cancel (pay ${formatMon(totalComp)} MON comp)`
                      : 'Cancel Bounty'
                    }
                  </ActionBtn>
                )}
              </div>
              {showCancelBtn && validSubCount > 0 && (
                <p style={{ fontFamily: theme.fonts.body, fontSize: 12, color: theme.colors.text.muted, marginTop: 12, lineHeight: 1.6 }}>
                  {validSubCount} valid submission{validSubCount > 1 ? 's' : ''}. Cancelling requires paying <strong style={{ color: theme.colors.amber }}>{formatMon(totalComp)} MON</strong> ({cancelBps / 100}% per submission) as compensation. Creator stake will be slashed 50% to builders.
                </p>
              )}
            </SectionCard>
          )}

          {/* ── Anyone actions (post-deadline transitions) ────────────────── */}
          {(showTransitionBtn || showExpireBtn || showTimeoutBtn) && !isCreator && (
            <SectionCard title="State Transitions">
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {showTransitionBtn && (
                  <ActionBtn onClick={handleTransitionReview} loading={actioning === 'transition'} variant="amber">
                    <IconChevronRight size={12} color="currentColor" style={{ marginRight: 4 }} /> Move to Review
                  </ActionBtn>
                )}
                {showExpireBtn && (
                  <ActionBtn onClick={handleExpire} loading={actioning === 'expire'} variant="default">
                    Expire &amp; Refund
                  </ActionBtn>
                )}
                {showTimeoutBtn && (
                  <ActionBtn onClick={handleTriggerTimeout} loading={actioning === 'timeout'} variant="danger">
                    <IconClock size={12} color="currentColor" style={{ marginRight: 4 }} /> Trigger Timeout
                  </ActionBtn>
                )}
              </div>
              <p style={{ fontFamily: theme.fonts.body, fontSize: 12, color: theme.colors.text.muted, marginTop: 12, lineHeight: 1.6 }}>
                {showTransitionBtn && 'Creator\'s deadline has passed. Move bounty to review window.'}
                {showExpireBtn && 'No submissions & deadline passed. Refunds reward to creator.'}
                {showTimeoutBtn && 'Review window expired — triggers payout split to pending builders.'}
              </p>
            </SectionCard>
          )}

          {/* ── V4: Builder Apply Panel (curated, not creator) ────────────── */}
          {requiresApplication && !isCreator && address && (
            <SectionCard title={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><IconTarget size={12} color={theme.colors.amber} /> Curated Project — Application Required</span>} style={{ borderColor: theme.colors.amberBorder }}>

              {!myApplication && (
                <>
                  <div style={{ fontFamily: theme.fonts.body, fontSize: 13, color: theme.colors.text.secondary, lineHeight: 1.65, marginBottom: 12 }}>
                    This is a curated project. Submit a short proposal explaining why you're the right fit.
                    The creator will review and approve eligible builders.
                  </div>
                  {canApply ? (
                    <Button variant="primary" size="sm" iconRight={<IconChevronRight size={12} color="currentColor" />} onClick={() => setApplyOpen(true)}>
                      Submit Application
                    </Button>
                  ) : (
                    <div style={{ fontFamily: theme.fonts.body, fontSize: 12, color: theme.colors.text.muted }}>
                      {hasDisputedSubmission ? 'This bounty has a dispute. Applications are closed.' : deadlinePast ? 'Deadline has passed.' : !isActive ? 'Bounty is not accepting applications.' : ''}
                    </div>
                  )}
                </>
              )}

              {myApplication && Number(myApplication.status) === 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <StatusBadge label="Pending" color={theme.colors.amber} bg={theme.colors.amberDim} borderColor={theme.colors.amberBorder} />
                  <span style={{ fontFamily: theme.fonts.body, fontSize: 12, color: theme.colors.text.muted }}>Your application is under review.</span>
                </div>
              )}

              {myApplication && Number(myApplication.status) === 1 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <StatusBadge label="Approved" color={theme.colors.green[400]} bg={theme.colors.green.dim} borderColor={theme.colors.green.border} />
                    <span style={{ fontFamily: theme.fonts.body, fontSize: 12, color: theme.colors.text.muted }}>
                      {hasDisputedSubmission ? 'Submissions paused due to dispute.' : 'You may now submit your work.'}
                    </span>
                  </div>
                  {canSubmit && !hasDisputedSubmission && (
                    <Button variant="primary" size="sm" iconRight={<IconChevronRight size={12} color="currentColor" />} onClick={() => setSubmitOpen(true)}>
                      Submit Work
                    </Button>
                  )}
                </div>
              )}

              {myApplication && Number(myApplication.status) === 2 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <StatusBadge label="Not selected" color={theme.colors.red[400]} bg={theme.colors.red.dim} borderColor={theme.colors.red.border} />
                  <span style={{ fontFamily: theme.fonts.body, fontSize: 12, color: theme.colors.text.muted }}>Your application was not approved for this project.</span>
                </div>
              )}
            </SectionCard>
          )}

          {/* ── V4: Creator Applications Panel ────────────────────────────── */}
          {requiresApplication && isCreator && (
            <SectionCard title={`Applications (${applications.length})`}>
              {applications.length === 0 ? (
                <p style={{ fontFamily: theme.fonts.body, fontSize: 13, color: theme.colors.text.muted, margin: 0 }}>
                  No applications yet. Share this bounty to attract builders.
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {applications.map(app => {
                    const appStatus = Number(app.status);
                    const statusLabel = ['Pending', 'Approved', 'Rejected'][appStatus] || 'Pending';
                    const statusColor = appStatus === 1 ? theme.colors.green[400] : appStatus === 2 ? theme.colors.red[400] : theme.colors.amber;
                    const statusBg = appStatus === 1 ? theme.colors.green.dim : appStatus === 2 ? theme.colors.red.dim : theme.colors.amberDim;
                    const statusBorder = appStatus === 1 ? theme.colors.green.border : appStatus === 2 ? theme.colors.red.border : theme.colors.amberBorder;

                    return (
                      <div
                        key={app.id}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 16,
                          padding: '14px 16px',
                          background: theme.colors.bg.elevated,
                          border: `1px solid ${theme.colors.border.subtle}`,
                          borderRadius: theme.radius.md,
                          flexWrap: 'wrap',
                        }}
                      >
                        <AvatarDisplay address={app.builder} size={36} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <a
                            href={`#/profile/${app.builder}`}
                            onClick={(e) => { e.preventDefault(); window.location.hash = `#/profile/${app.builder}`; }}
                            style={{
                              fontFamily: theme.fonts.mono, fontSize: 12, fontWeight: 500,
                              color: theme.colors.text.primary, textDecoration: 'none',
                              display: 'block', marginBottom: 4,
                            }}
                          >
                            {app.builder.slice(0, 6)}…{app.builder.slice(-4)}
                          </a>
                          {app.proposalIpfsHash && (
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); setProposalViewApp(app); }}
                              style={{
                                fontFamily: theme.fonts.body, fontSize: 12, color: theme.colors.primary,
                                background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                                textDecoration: 'underline', textUnderlineOffset: 2,
                              }}
                            >
                              View proposal <IconChevronRight size={10} color={theme.colors.primary} style={{ marginLeft: 2, verticalAlign: 'middle' }} />
                            </button>
                          )}
                        </div>
                        <StatusBadge label={statusLabel} color={statusColor} bg={statusBg} borderColor={statusBorder} />
                        {appStatus === 0 && isActive && (
                          <div style={{ display: 'flex', gap: 8 }}>
                            <ActionBtn
                              onClick={() => handleApproveApp(app.builder)}
                              loading={actioning === 'approveapp-' + app.builder}
                              variant="success"
                            >
                              Approve
                            </ActionBtn>
                            <ActionBtn
                              onClick={() => handleRejectApp(app.builder)}
                              loading={actioning === 'rejectapp-' + app.builder}
                              variant="danger"
                            >
                              Reject
                            </ActionBtn>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </SectionCard>
          )}

          {/* ── Submissions ───────────────────────────────────────────────── */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
              <h2 style={{ fontFamily: theme.fonts.mono, fontSize: 10, fontWeight: 600, color: theme.colors.text.faint, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                Submissions ({submissions.length})
              </h2>
              {canSubmit && (
                <Button variant="primary" size="sm" iconRight={<IconChevronRight size={12} color="currentColor" />} onClick={() => setSubmitOpen(true)}>
                  Submit Work
                </Button>
              )}
            </div>

            {!isCreator && address && submissions.some(s => s.builder?.toLowerCase() === address.toLowerCase() && getRevisionLink(id, String(s.id), 'request')) && (
              <div style={{
                padding: '12px 16px', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 10,
                background: theme.colors.amberDim, border: `1px solid ${theme.colors.amberBorder}`, borderRadius: theme.radius.md,
                fontSize: 13, fontWeight: 500, color: theme.colors.amber,
              }}>
                <span>Creator requested revision. Expand your submission below to view feedback and upload response.</span>
              </div>
            )}

            {submissions.length === 0 ? (
              <div style={{ padding: '32px', textAlign: 'center', border: `1px dashed ${theme.colors.border.subtle}`, borderRadius: theme.radius.lg }}>
                <p style={{ fontFamily: theme.fonts.body, fontSize: 13, color: theme.colors.text.muted, fontWeight: 300 }}>
                  No submissions yet. Be the first to submit work.
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {submissions.map(s => (
                  <SubmissionViewer
                    key={s.id}
                    submission={s}
                    bountyId={id}
                    isCreator={isCreator}
                    isActive={isLive}
                    canViewContent={isCreator || (address && s.builder?.toLowerCase() === address.toLowerCase())}
                    hasPendingRevision={!!(address && s.builder?.toLowerCase() === address.toLowerCase() && getRevisionLink(id, String(s.id), 'request'))}
                    revisionRefresh={revisionRefresh}
                    onApprove={() => handleApprove(s.id)}
                    onReject={() => handleReject(s.id)}
                    onDispute={() => handleDispute(s.id)}
                    onWithdrawStake={() => handleWithdrawStake(s.id)}
                    onRequestRevisionOpen={() => setRequestRevisionSubId(String(s.id))}
                    onUploadRevisionOpen={() => setRevisionResponseSubId(String(s.id))}
                    actioning={actioning}
                    connectedAddress={address}
                    graceRejSec={graceRejSec}
                    disputeDep={disputeDep}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── RIGHT SIDEBAR ─────────────────────────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Primary CTA */}
          {mySubmission && !isCreator && (
            <div style={{
              padding: '14px 16px',
              background: mySubStatus === 1 ? theme.colors.green.dim : theme.colors.bg.elevated,
              border: `1px solid ${mySubStatus === 1 ? theme.colors.green.border : theme.colors.border.subtle}`,
              borderRadius: theme.radius.lg,
              fontFamily: theme.fonts.body,
              fontSize: 13,
              color: mySubStatus === 1 ? theme.colors.green[400] : theme.colors.text.primary,
              fontWeight: 600,
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
            }}>
              <span>
                {mySubStatus === 0 && '✓ Work submitted'}
                {mySubStatus === 1 && '✓ Approved & Won'}
                {mySubStatus === 2 && 'Submission rejected'}
              </span>
              <span style={{ fontSize: 11, fontWeight: 400, color: theme.colors.text.muted }}>
                {mySubStatus === 0 && 'Pending review'}
                {mySubStatus === 1 && bounty?.totalReward && (
                  <>You won <strong style={{ color: theme.colors.primary }}>{formatMon(bounty.totalReward)} MON</strong></>
                )}
                {mySubStatus === 1 && !bounty?.totalReward && 'Payment released'}
                {mySubStatus === 2 && 'Rejected'}
              </span>
            </div>
          )}
          {canSubmit && !requiresApplication && (
            <Button variant="primary" fullWidth iconRight={<IconChevronRight size={12} color="currentColor" />} onClick={() => setSubmitOpen(true)}>
              Submit Work
            </Button>
          )}
          {canSubmit && requiresApplication && (
            <Button variant="primary" fullWidth iconRight={<IconChevronRight size={12} color="currentColor" />} onClick={() => setSubmitOpen(true)}>
              Submit Work
            </Button>
          )}
          {canApply && (
            <Button variant="outline" fullWidth iconRight={<IconChevronRight size={12} color="currentColor" />} onClick={() => setApplyOpen(true)}>
              Apply for This Project
            </Button>
          )}
          {!address && (
            <div style={{ padding: '14px', textAlign: 'center', background: theme.colors.primaryDim, border: `1px solid ${theme.colors.primaryBorder}`, borderRadius: theme.radius.md, fontFamily: theme.fonts.body, fontSize: 12.5, color: theme.colors.primaryLight }}>
              Connect wallet to participate
            </div>
          )}

          {/* Builder's own pending stake withdrawal */}
          {mySubPostGrace && mySubmission && (
            <div style={{ padding: '12px 14px', background: 'rgba(255,174,69,0.06)', border: `1px solid ${theme.colors.amberBorder}`, borderRadius: theme.radius.md }}>
              <div style={{ fontFamily: theme.fonts.body, fontSize: 12, fontWeight: 600, color: theme.colors.amber, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}><IconWarning size={14} color={theme.colors.amber} /> Stake locked after rejection</div>
              <div style={{ fontFamily: theme.fonts.body, fontSize: 11.5, color: theme.colors.text.muted, marginBottom: 10, lineHeight: 1.6 }}>Grace period has passed. Withdraw your submission stake.</div>
              <ActionBtn onClick={() => handleWithdrawStake(mySubmission.id)} loading={actioning === 'withdrawstake-' + mySubmission.id} variant="amber" fullWidth>
                Withdraw {formatMon(mySubmission.submissionStake)} MON Stake
              </ActionBtn>
            </div>
          )}

          {/* Creator card */}
          {bounty.creator && <CreatorCard address={bounty.creator} />}

          {/* Bounty details card */}
          <div style={{ background: theme.colors.bg.card, border: `1px solid ${theme.colors.border.subtle}`, borderRadius: theme.radius.lg, overflow: 'hidden' }}>
            <div style={{ padding: '14px 16px', borderBottom: `1px solid ${theme.colors.border.faint}` }}>
              <span style={{ fontFamily: theme.fonts.mono, fontSize: 9.5, color: theme.colors.text.faint, letterSpacing: '0.07em', textTransform: 'uppercase' }}>Bounty Details</span>
            </div>
            <div style={{ padding: '0 16px' }}>
              <InfoRow label="Reward"      value={`${formatMon(bounty.totalReward)} MON`} mono />
              <InfoRow label="Status"      value={status} />
              <InfoRow label="Submissions" value={submissions.length} />
              <InfoRow label="Winners"     value={`${Number(bounty.winnerCount)} max`} />
              {bounty.deadline      && <InfoRow label="Deadline"       value={deadlineToDate(bounty.deadline)} />}
              {reviewDl > 0         && <InfoRow label="Review Ends"    value={deadlineToDate(reviewDl)} />}
              {bounty.creatorStake   && <InfoRow label="Creator Stake"  value={`${formatMon(bounty.creatorStake)} MON`} mono />}
            </div>
          </div>

          {/* On-chain info */}
          <div style={{ padding: '14px 16px', background: theme.colors.bg.card, border: `1px solid ${theme.colors.border.subtle}`, borderRadius: theme.radius.lg }}>
            <div style={{ fontFamily: theme.fonts.mono, fontSize: 9.5, color: theme.colors.text.faint, letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 10 }}>
              On-chain
            </div>
            <div style={{ fontFamily: theme.fonts.mono, fontSize: 10.5, color: theme.colors.text.muted, lineHeight: 1.7 }}>
              Reward locked in contract.<br />
              3% platform fee on completion.
            </div>
            {bounty.txHash && (
              <a href={`https://testnet.monadexplorer.com/tx/${bounty.txHash}`} target="_blank" rel="noopener noreferrer"
                style={{ fontFamily: theme.fonts.mono, fontSize: 10, color: theme.colors.primary, display: 'block', marginTop: 8 }}>
                View tx <IconExternalLink size={10} color={theme.colors.primary} style={{ marginLeft: 4, verticalAlign: 'middle' }} />
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Submit modal */}
      <SubmitWorkModal
        open={submitOpen}
        onClose={() => setSubmitOpen(false)}
        bountyId={id}
        bountyReward={bounty.totalReward}
        onSuccess={() => { setSubmitOpen(false); refetch(); }}
      />

      {/* V4: Apply modal */}
      <ApplyModal
        open={applyOpen}
        onClose={() => setApplyOpen(false)}
        bountyId={id}
        bountyTitle={meta?.title || bounty.title}
        onSuccess={() => {
          setApplyOpen(false);
          // Refresh own application status
          if (ADDRESSES.factory) {
            const f = getReadContractFast(ADDRESSES.factory, FACTORY_ABI);
            f.getBuilderApplications(address)
              .then(apps => {
                const mine = (apps ?? []).find(a => String(a.bountyId) === String(id));
                setMyApplication(mine || null);
              })
              .catch(() => {});
          }
        }}
      />

      {/* Opsi B: Request Revision modal (creator) */}
      <RequestRevisionModal
        open={!!requestRevisionSubId}
        onClose={() => setRequestRevisionSubId(null)}
        bountyId={id}
        submissionId={requestRevisionSubId}
        creatorAddress={address}
        onSuccess={() => setRevisionRefresh(r => r + 1)}
      />

      {/* Opsi B: Revision Response modal (builder) */}
      <RevisionResponseModal
        open={!!revisionResponseSubId}
        onClose={() => setRevisionResponseSubId(null)}
        bountyId={id}
        submissionId={revisionResponseSubId}
        requestIpfs={revisionResponseSubId ? (getRevisionLink(id, revisionResponseSubId, 'request') || '') : ''}
        builderAddress={address}
        onSuccess={() => setRevisionRefresh(r => r + 1)}
      />

      {/* Proposal view modal (creator reviewing curated applications) */}
      <ProposalViewModal
        open={!!proposalViewApp}
        onClose={() => setProposalViewApp(null)}
        proposalIpfsHash={proposalViewApp?.proposalIpfsHash}
        builderAddress={proposalViewApp?.builder}
      />
    </div>
  );
}








