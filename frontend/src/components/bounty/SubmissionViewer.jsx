import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { theme as t } from '../../styles/theme.js';
import { fetchJSON, GATEWAY } from '../../config/pinata.js';
import RevisionSection from './RevisionSection.jsx';
import { shortAddr } from '../../utils/format.js';
import { IconGithub, IconFigma, IconBolt, IconExternalLink, IconChevronUp, IconChevronDown, IconX, IconShield, IconRefresh } from '../../components/icons';

// ── SafeLink ──────────────────────────────────────────────────────────────────
function SafeLink({ href, children, ...props }) {
  const isSafe = href && (href.startsWith('https://') || href.startsWith('http://') || href.startsWith('#'));
  if (!isSafe) return <span style={{ textDecoration: 'underline', opacity: 0.5 }}>{children}</span>;
  return <a href={href} target="_blank" rel="noopener noreferrer" {...props}>{children}</a>;
}
const MD_COMPONENTS = { a: SafeLink };

const LINK_META = {
  github:  { Icon: IconGithub,      label: 'GitHub',  color: '#e2e8f0' },
  figma:   { Icon: IconFigma,       label: 'Figma',   color: '#a78bfa' },
  demo:    { Icon: IconBolt,        label: 'Demo',    color: '#34d399' },
  url:     { Icon: IconExternalLink, label: 'Link',   color: '#818cf8' },
};

function detectType(url) {
  if (!url) return 'url';
  if (url.includes('github.com')) return 'github';
  if (url.includes('figma.com'))  return 'figma';
  if (url.includes('vercel.app') || url.includes('netlify.app')) return 'demo';
  return 'url';
}

function DeliverableLink({ item }) {
  const type = item.type || detectType(item.value || item.url || '');
  const m    = LINK_META[type] || LINK_META.url;
  const href = item.value || item.url || '';
  if (!href) return null;
  return (
    <SafeLink href={href}
      style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', borderRadius: t.radius.md, background: t.colors.bg.elevated, border: '1px solid ' + t.colors.border.default, textDecoration: 'none', transition: t.transition }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = t.colors.border.hover; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = t.colors.border.default; }}>
      <span style={{ flexShrink: 0, display: 'flex', alignItems: 'center' }}><m.Icon size={16} color={m.color} /></span>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: '12px', fontWeight: 600, color: m.color }}>{item.label || m.label}</div>
        <div style={{ fontSize: '11px', color: t.colors.text.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{href}</div>
      </div>
      <IconExternalLink size={12} color={t.colors.text.muted} style={{ flexShrink: 0 }} />
    </SafeLink>
  );
}

function SLabel({ children }) {
  return (
    <div style={{ fontSize: '11px', fontWeight: 600, color: t.colors.text.muted, letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: '8px' }}>
      {children}
    </div>
  );
}

function formatMon(wei) {
  if (!wei && wei !== 0n) return '0';
  try { return (Number(BigInt(wei)) / 1e18).toFixed(4).replace(/\.?0+$/, '') || '0'; }
  catch { return '0'; }
}

// ── Status badge ──────────────────────────────────────────────────────────────
const SUB_STATUS = { 0: 'pending', 1: 'approved', 2: 'rejected' };
function subStatusLabel(n) { return SUB_STATUS[n] || 'unknown'; }

function SubStatusBadge({ status, disputed }) {
  const n = Number(status);
  const label = disputed ? 'disputed' : subStatusLabel(n);
  const colors = {
    pending:  { color: t.colors.amber,       bg: t.colors.amberDim,        border: t.colors.amberBorder },
    approved: { color: t.colors.green[400],  bg: t.colors.green.dim,       border: t.colors.green.border },
    rejected: { color: t.colors.red[400],    bg: t.colors.red.dim,         border: t.colors.red.border },
    disputed: { color: t.colors.primaryLight, bg: t.colors.primaryDim,     border: t.colors.primaryBorder },
    unknown:  { color: t.colors.text.faint,  bg: t.colors.bg.elevated,     border: t.colors.border.subtle },
  };
  const c = colors[label] || colors.unknown;
  return (
    <span style={{
      padding: '4px 10px',
      background: c.bg, border: `1px solid ${c.border}`, borderRadius: t.radius.full,
      fontFamily: t.fonts.mono, fontSize: 10, fontWeight: 600, color: c.color,
      letterSpacing: '0.04em', textTransform: 'uppercase',
    }}>{label}</span>
  );
}

// ── Compact action button ─────────────────────────────────────────────────────
function Btn({ onClick, loading, disabled, children, variant = 'default' }) {
  const styles = {
    default: { bg: t.colors.bg.elevated, border: t.colors.border.default, color: t.colors.text.secondary },
    success: { bg: t.colors.green.dim, border: t.colors.green.border, color: t.colors.green[400] },
    danger:  { bg: t.colors.red.dim, border: t.colors.red.border, color: t.colors.red[400] },
    amber:   { bg: t.colors.amberDim,      border: t.colors.amberBorder,   color: t.colors.amber       },
    primary: { bg: t.colors.primaryDim,    border: t.colors.primaryBorder, color: t.colors.primaryLight },
  };
  const s = (disabled || loading)
    ? { bg: t.colors.bg.elevated, border: t.colors.border.subtle, color: t.colors.text.faint }
    : (styles[variant] || styles.default);

  return (
    <button
      onClick={disabled || loading ? undefined : onClick}
      disabled={disabled || loading}
      style={{
        padding: '7px 14px', borderRadius: t.radius.md,
        background: s.bg, border: `1px solid ${s.border}`, color: s.color,
        fontFamily: t.fonts.body, fontSize: 12, fontWeight: 600,
        cursor: disabled || loading ? 'not-allowed' : 'pointer',
        transition: t.transition, opacity: disabled ? 0.5 : 1, whiteSpace: 'nowrap',
      }}
    >{loading ? '…' : children}</button>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
// Props:
//   submission      - full Submission struct from contract
//   isCreator       - current user is the bounty creator
//   isActive        - bounty status is ACTIVE or REVIEWING
//   onApprove       - () => void
//   onReject        - () => void
//   onDispute       - () => void (builder, in-grace-period rejected submission)
//   onWithdrawStake - () => void (builder, post-grace-period rejected submission)
//   actioning       - current action key loading
//   connectedAddress- current user address
//   graceRejSec     - GRACE_PERIOD_REJECT in seconds (default 7200)
//   disputeDep      - DISPUTE_DEPOSIT BigInt (default 0.01 MON)
export default function SubmissionViewer({
  // New API: full submission data
  submission,
  isCreator,
  isActive,
  onApprove,
  onReject,
  onDispute,
  onWithdrawStake,
  onRequestRevisionOpen,
  onUploadRevisionOpen,
  bountyId,
  canViewContent = true,
  actioning,
  connectedAddress,
  graceRejSec = 7200,
  disputeDep,
  // Legacy API (kept for compatibility)
  ipfsHash: legacyIpfsHash,
  builder: legacyBuilder,
  canApprove: legacyCanApprove,
  onApprove: legacyOnApprove,
  approving: legacyApproving,
  compact,
}) {
  const [open,    setOpen]  = useState(false);
  const [meta,    setMeta]  = useState(null);
  const [loading, setLoad]  = useState(false);

  // Support both new API (submission object) and legacy API (individual props)
  const sub       = submission || { ipfsHash: legacyIpfsHash, builder: legacyBuilder, status: 0n };
  const ipfsHash  = sub.ipfsHash;
  const builder   = sub.builder || legacyBuilder;
  const subStatus = Number(sub.status ?? 0);
  const disputed  = !!sub.disputed;
  const isApproved = subStatus === 1;
  const isRejected = subStatus === 2;
  const isPending  = subStatus === 0;

  const nowSec = Math.floor(Date.now() / 1000);
  const rejectedAt = sub.rejectedAt ? Number(sub.rejectedAt) : 0;
  const inGrace  = isRejected && !disputed && rejectedAt > 0 && nowSec < rejectedAt + graceRejSec;
  const postGrace = isRejected && !disputed && rejectedAt > 0 && nowSec >= rejectedAt + graceRejSec;

  const isMySubmission = connectedAddress && builder?.toLowerCase() === connectedAddress.toLowerCase();

  // Current actioning keys
  const subId = sub.id != null ? String(sub.id) : '';
  const isApproving       = actioning === 'approve-' + subId;
  const isRejecting       = actioning === 'reject-' + subId;
  const isDisputing       = actioning === 'dispute-' + subId;
  const isWithdrawStaking = actioning === 'withdrawstake-' + subId;

  // Creator can approve/reject pending submissions when bounty is live
  const canApprove = (legacyCanApprove != null)
    ? legacyCanApprove
    : isCreator && isActive && isPending;
  const canReject  = isCreator && isActive && isPending;

  // Builder can dispute in-grace rejected submission
  const canDispute = isMySubmission && inGrace && !disputed;
  // Builder can withdraw stake after grace period
  const canWithdraw = isMySubmission && postGrace && !disputed && (sub.submissionStake > 0n);

  useEffect(() => {
    if (!open || !ipfsHash || meta || !canViewContent) return;
    setLoad(true);
    fetchJSON(ipfsHash)
      .then(d => setMeta(d))
      .catch(() => setMeta(null))
      .finally(() => setLoad(false));
  }, [open, ipfsHash, meta, canViewContent]);

  if (!ipfsHash) return null;

  return (
    <div style={{
      background: t.colors.bg.card,
      border: `1px solid ${t.colors.border.subtle}`,
      borderRadius: t.radius.md,
      overflow: 'hidden',
      transition: t.transition,
    }}>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', flexWrap: 'wrap' }}>
        {/* Toggle — only show View Work when user can view content */}
        {canViewContent ? (
          <button
            onClick={() => setOpen(p => !p)}
            style={{
              fontSize: '12px', color: t.colors.primary,
              background: 'transparent', border: `1px solid ${t.colors.primaryBorder}`,
              borderRadius: t.radius.sm, padding: '4px 10px', cursor: 'pointer', transition: t.transition,
            }}
            onMouseEnter={e => { e.currentTarget.style.background = t.colors.primaryDim; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}>
            {open ? <><IconChevronUp size={12} style={{ marginRight: 4, verticalAlign: 'middle' }} /> Hide</> : <><IconChevronDown size={12} style={{ marginRight: 4, verticalAlign: 'middle' }} /> View Work</>}
          </button>
        ) : (
          <span style={{ fontSize: 11, color: t.colors.text.muted, fontStyle: 'italic' }}>
            Visible to creator and submitter only
          </span>
        )}

        {/* Builder address */}
        <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: t.colors.text.faint }}>
          by {shortAddr(builder)}
        </span>

        {/* Status badge */}
        <SubStatusBadge status={subStatus} disputed={disputed} />

        {/* Submission stake */}
        {sub.submissionStake > 0n && (
          <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: t.colors.text.faint }}>
            stake: {formatMon(sub.submissionStake)} MON
          </span>
        )}

        {/* In-grace notice */}
        {inGrace && (
          <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 10.5, color: t.colors.amber, background: t.colors.amberDim, border: `1px solid ${t.colors.amberBorder}`, borderRadius: t.radius.full, padding: '2px 8px' }}>
            grace period
          </span>
        )}

        {/* Action buttons */}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {/* Creator: approve */}
          {canApprove && (
            <Btn onClick={legacyOnApprove || onApprove} loading={isApproving || legacyApproving} variant="success">
              Approve &amp; Pay
            </Btn>
          )}

          {/* Creator: request revision (Opsi B) */}
          {canReject && onRequestRevisionOpen && (
            <Btn onClick={onRequestRevisionOpen} variant="amber">
              Request Revision
            </Btn>
          )}

          {/* Creator: reject */}
          {canReject && (
            <Btn onClick={onReject} loading={isRejecting} variant="danger">
              <IconX size={12} style={{ marginRight: 4, verticalAlign: 'middle' }} /> Reject
            </Btn>
          )}

          {/* Builder: dispute in-grace rejection */}
          {canDispute && onDispute && (
            <Btn onClick={onDispute} loading={isDisputing} variant="primary">
              <IconShield size={12} style={{ marginRight: 4, verticalAlign: 'middle' }} /> Dispute ({disputeDep ? formatMon(disputeDep) : '0.01'} MON deposit)
            </Btn>
          )}

          {/* Builder: withdraw stake post-grace */}
          {canWithdraw && onWithdrawStake && (
            <Btn onClick={onWithdrawStake} loading={isWithdrawStaking} variant="amber">
              <IconRefresh size={12} style={{ marginRight: 4, verticalAlign: 'middle' }} /> Withdraw Stake
            </Btn>
          )}
        </div>
      </div>

      {/* Expanded content — only render when canViewContent */}
      {open && canViewContent && (
        <div style={{ padding: '0 14px 14px' }}>
          <div style={{ borderTop: `1px solid ${t.colors.border.faint}`, paddingTop: 14 }}>

            {loading && (
              <div style={{ fontSize: '13px', color: t.colors.text.muted, padding: '8px 0' }}>Loading submission…</div>
            )}

            {!loading && !meta && (
              <div style={{ fontSize: '13px', color: t.colors.text.muted }}>
                Could not load submission.{' '}
                <a href={GATEWAY + ipfsHash} target="_blank" rel="noopener noreferrer" style={{ color: t.colors.primary }}>Open raw JSON ↗</a>
              </div>
            )}

            {!loading && meta && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px', flexWrap: 'wrap' }}>
                  <div>
                    {meta.title && (
                      <div style={{ fontSize: '14px', fontWeight: 600, color: t.colors.text.primary, marginBottom: '3px' }}>{meta.title}</div>
                    )}
                    {(builder || meta.builderAddress || meta.hunterAddress) && (
                      <div style={{ fontSize: '11px', color: t.colors.text.muted, fontFamily: "'DM Mono', monospace" }}>
                        by {shortAddr(builder || meta.builderAddress || meta.hunterAddress)}
                      </div>
                    )}
                  </div>
                  <a href={GATEWAY + ipfsHash} target="_blank" rel="noopener noreferrer"
                    style={{ fontSize: '11px', color: t.colors.text.muted, textDecoration: 'none' }}>Raw ↗</a>
                </div>

                {/* Description */}
                {meta.description && (
                  <div>
                    <SLabel>Description</SLabel>
                    <div className="md-body" style={{ fontSize: '13px', color: t.colors.text.secondary, lineHeight: 1.75 }}>
                      <ReactMarkdown components={MD_COMPONENTS}>{meta.description}</ReactMarkdown>
                    </div>
                  </div>
                )}

                {/* Deliverables */}
                {meta.deliverables && meta.deliverables.length > 0 && (
                  <div>
                    <SLabel>Deliverables</SLabel>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {meta.deliverables.map((d, i) => <DeliverableLink key={i} item={d} />)}
                    </div>
                  </div>
                )}

                {/* Notes */}
                {meta.notes && (
                  <div>
                    <SLabel>Notes</SLabel>
                    <p style={{ fontSize: '13px', color: t.colors.text.secondary, lineHeight: 1.7, margin: 0 }}>{meta.notes}</p>
                  </div>
                )}

                {/* Opsi B: Revision section (off-chain) */}
                {bountyId && (
                  <RevisionSection
                    bountyId={bountyId}
                    submissionId={subId}
                    isCreator={isCreator}
                    isBuilder={isMySubmission}
                    isPending={isPending}
                    onRequestRevisionOpen={onRequestRevisionOpen}
                    onUploadRevisionOpen={onUploadRevisionOpen}
                  />
                )}

                {/* Legacy fallback */}
                {!meta.description && !meta.deliverables && meta.submissionText && (
                  <p style={{ fontSize: '13px', color: t.colors.text.secondary, lineHeight: 1.7, margin: 0 }}>{meta.submissionText}</p>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
