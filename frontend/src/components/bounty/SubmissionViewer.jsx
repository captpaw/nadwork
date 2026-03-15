import React, { useEffect, useMemo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { theme as t } from '../../styles/theme.js';
import { fetchJSON, GATEWAY } from '../../config/pinata.js';
import RevisionSection from './RevisionSection.jsx';
import { shortAddr } from '../../utils/format.js';
import {
  IconGithub,
  IconFigma,
  IconBolt,
  IconExternalLink,
  IconChevronUp,
  IconChevronDown,
  IconX,
  IconShield,
  IconRefresh,
  IconClock,
  IconClipboard,
  IconPackage,
  IconLink,
  IconEye,
} from '../../components/icons';

function SafeLink({ href, children, ...props }) {
  const isSafe = href && (href.startsWith('https://') || href.startsWith('http://') || href.startsWith('#') || href.startsWith('ipfs://'));
  if (!isSafe) {
    return <span style={{ textDecoration: 'underline', opacity: 0.5 }}>{children}</span>;
  }
  const resolved = href.startsWith('ipfs://')
    ? (GATEWAY || 'https://gateway.pinata.cloud/ipfs/') + href.replace('ipfs://', '')
    : href;
  return (
    <a href={resolved} target="_blank" rel="noopener noreferrer" {...props}>
      {children}
    </a>
  );
}

const MD_COMPONENTS = { a: SafeLink };

const LINK_META = {
  github: { Icon: IconGithub, label: 'GitHub', color: '#e2e8f0' },
  figma: { Icon: IconFigma, label: 'Figma', color: '#a78bfa' },
  demo: { Icon: IconBolt, label: 'Demo', color: '#34d399' },
  url: { Icon: IconExternalLink, label: 'Link', color: '#818cf8' },
};

const SECTION_CARD_STYLE = {
  background: 'linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0))',
  border: `1px solid ${t.colors.border.subtle}`,
  borderRadius: t.radius.lg,
  padding: '16px 18px',
};

const INFO_CARD_STYLE = {
  background: t.colors.bg.elevated,
  border: `1px solid ${t.colors.border.subtle}`,
  borderRadius: t.radius.md,
  padding: '12px 14px',
};

function detectType(url) {
  if (!url) return 'url';
  if (url.includes('github.com')) return 'github';
  if (url.includes('figma.com')) return 'figma';
  if (url.includes('vercel.app') || url.includes('netlify.app')) return 'demo';
  return 'url';
}

function DeliverableLink({ item }) {
  const type = item.type || detectType(item.value || item.url || '');
  const meta = LINK_META[type] || LINK_META.url;
  const href = item.value || item.url || '';
  if (!href) return null;

  return (
    <SafeLink
      href={href}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '12px 14px',
        borderRadius: t.radius.md,
        background: t.colors.bg.elevated,
        border: `1px solid ${t.colors.border.default}`,
        textDecoration: 'none',
        transition: t.transition,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = t.colors.border.hover;
        e.currentTarget.style.transform = 'translateY(-1px)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = t.colors.border.default;
        e.currentTarget.style.transform = 'translateY(0)';
      }}
    >
      <span
        style={{
          width: 34,
          height: 34,
          borderRadius: t.radius.md,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgba(255,255,255,0.02)',
          border: `1px solid ${t.colors.border.subtle}`,
          flexShrink: 0,
        }}
      >
        <meta.Icon size={15} color={meta.color} />
      </span>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: meta.color, marginBottom: 2 }}>
          {item.label || meta.label}
        </div>
        <div
          style={{
            fontSize: 11,
            color: t.colors.text.muted,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {href}
        </div>
      </div>
      <IconExternalLink size={12} color={t.colors.text.muted} style={{ flexShrink: 0 }} />
    </SafeLink>
  );
}

function SectionLabel({ icon: IconComp, children }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        fontSize: 11,
        fontWeight: 600,
        color: t.colors.text.muted,
        letterSpacing: '0.07em',
        textTransform: 'uppercase',
        marginBottom: 10,
      }}
    >
      {IconComp ? <IconComp size={12} color={t.colors.text.muted} /> : null}
      <span>{children}</span>
    </div>
  );
}

function formatMon(wei) {
  if (!wei && wei !== 0n) return '0';
  try {
    return (Number(BigInt(wei)) / 1e18).toFixed(4).replace(/\.?0+$/, '') || '0';
  } catch {
    return '0';
  }
}

function formatIpfsHash(hash) {
  if (!hash) return '-';
  return hash.length > 18 ? `${hash.slice(0, 8)}...${hash.slice(-8)}` : hash;
}

const SUB_STATUS = { 0: 'pending', 1: 'approved', 2: 'rejected' };
function subStatusLabel(value) {
  return SUB_STATUS[value] || 'unknown';
}

function SubStatusBadge({ status, disputed }) {
  const value = Number(status);
  const label = disputed ? 'disputed' : subStatusLabel(value);
  const colors = {
    pending: { color: t.colors.amber, bg: t.colors.amberDim, border: t.colors.amberBorder },
    approved: { color: t.colors.green[400], bg: t.colors.green.dim, border: t.colors.green.border },
    rejected: { color: t.colors.red[400], bg: t.colors.red.dim, border: t.colors.red.border },
    disputed: { color: t.colors.primaryLight, bg: t.colors.primaryDim, border: t.colors.primaryBorder },
    unknown: { color: t.colors.text.faint, bg: t.colors.bg.elevated, border: t.colors.border.subtle },
  };
  const palette = colors[label] || colors.unknown;

  return (
    <span
      style={{
        padding: '5px 10px',
        background: palette.bg,
        border: `1px solid ${palette.border}`,
        borderRadius: t.radius.full,
        fontFamily: t.fonts.mono,
        fontSize: 10,
        fontWeight: 600,
        color: palette.color,
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
      }}
    >
      {label}
    </span>
  );
}

function SignalChip({ label, tone = 'neutral' }) {
  const tones = {
    neutral: { color: t.colors.text.muted, bg: t.colors.bg.elevated, border: t.colors.border.subtle },
    primary: { color: t.colors.primaryLight, bg: t.colors.primaryDim, border: t.colors.primaryBorder },
    amber: { color: t.colors.amber, bg: t.colors.amberDim, border: t.colors.amberBorder },
    success: { color: t.colors.green[400], bg: t.colors.green.dim, border: t.colors.green.border },
  };
  const palette = tones[tone] || tones.neutral;

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '5px 9px',
        borderRadius: t.radius.full,
        background: palette.bg,
        border: `1px solid ${palette.border}`,
        color: palette.color,
        fontSize: 10.5,
        fontWeight: 600,
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
      }}
    >
      {label}
    </span>
  );
}

function SummaryCard({ label, value, accent = t.colors.text.primary }) {
  return (
    <div style={INFO_CARD_STYLE}>
      <div style={{ fontSize: 10.5, color: t.colors.text.muted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 5 }}>
        {label}
      </div>
      <div style={{ fontSize: 14, fontWeight: 600, color: accent }}>{value}</div>
    </div>
  );
}

function EmptyPanel({ title, body, linkHref, linkLabel }) {
  return (
    <div
      style={{
        ...SECTION_CARD_STYLE,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        color: t.colors.text.secondary,
      }}
    >
      <div style={{ fontSize: 14, fontWeight: 600, color: t.colors.text.primary }}>{title}</div>
      <div style={{ fontSize: 13, lineHeight: 1.7 }}>{body}</div>
      {linkHref && linkLabel ? (
        <SafeLink href={linkHref} style={{ color: t.colors.primary, fontSize: 12, fontWeight: 600, textDecoration: 'none' }}>
          {linkLabel}
        </SafeLink>
      ) : null}
    </div>
  );
}

function ActionButton({ onClick, loading, disabled, children, variant = 'default', icon = null }) {
  const styles = {
    default: { bg: t.colors.bg.elevated, border: t.colors.border.default, color: t.colors.text.secondary },
    success: { bg: t.colors.green.dim, border: t.colors.green.border, color: t.colors.green[400] },
    danger: { bg: t.colors.red.dim, border: t.colors.red.border, color: t.colors.red[400] },
    amber: { bg: t.colors.amberDim, border: t.colors.amberBorder, color: t.colors.amber },
    primary: { bg: t.colors.primaryDim, border: t.colors.primaryBorder, color: t.colors.primaryLight },
  };
  const palette = disabled || loading
    ? { bg: t.colors.bg.elevated, border: t.colors.border.subtle, color: t.colors.text.faint }
    : (styles[variant] || styles.default);

  return (
    <button
      onClick={disabled || loading ? undefined : onClick}
      disabled={disabled || loading}
      style={{
        padding: '8px 14px',
        borderRadius: t.radius.md,
        background: palette.bg,
        border: `1px solid ${palette.border}`,
        color: palette.color,
        fontFamily: t.fonts.body,
        fontSize: 12,
        fontWeight: 600,
        cursor: disabled || loading ? 'not-allowed' : 'pointer',
        transition: t.transition,
        opacity: disabled ? 0.5 : 1,
        whiteSpace: 'nowrap',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
      }}
    >
      {loading ? '...' : (
        <>
          {icon}
          <span>{children}</span>
        </>
      )}
    </button>
  );
}

export default function SubmissionViewer({
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
  hasPendingRevision = false,
  revisionRefresh = 0,
  actioning,
  connectedAddress,
  graceRejSec = 7200,
  disputeDep,
  ipfsHash: legacyIpfsHash,
  builder: legacyBuilder,
  canApprove: legacyCanApprove,
  onApprove: legacyOnApprove,
  approving: legacyApproving,
}) {
  const sub = submission || { ipfsHash: legacyIpfsHash, builder: legacyBuilder, status: 0n };
  const ipfsHash = sub.ipfsHash;
  const builder = sub.builder || legacyBuilder;
  const subStatus = Number(sub.status ?? 0);
  const disputed = !!sub.disputed;
  const isRejected = subStatus === 2;
  const isPending = subStatus === 0;

  const nowSec = Math.floor(Date.now() / 1000);
  const rejectedAt = sub.rejectedAt ? Number(sub.rejectedAt) : 0;
  const inGrace = isRejected && !disputed && rejectedAt > 0 && nowSec < rejectedAt + graceRejSec;
  const postGrace = isRejected && !disputed && rejectedAt > 0 && nowSec >= rejectedAt + graceRejSec;

  const isMySubmission = connectedAddress && builder?.toLowerCase() === connectedAddress.toLowerCase();
  const subId = sub.id != null ? String(sub.id) : '';

  const isApproving = actioning === `approve-${subId}`;
  const isRejecting = actioning === `reject-${subId}`;
  const isDisputing = actioning === `dispute-${subId}`;
  const isWithdrawStaking = actioning === `withdrawstake-${subId}`;

  const canApprove = legacyCanApprove != null
    ? legacyCanApprove
    : isCreator && isActive && isPending;
  const canReject = isCreator && isActive && isPending;
  const canDispute = isMySubmission && inGrace && !disputed;
  const canWithdraw = isMySubmission && postGrace && !disputed && (sub.submissionStake > 0n);

  const [open, setOpen] = useState(
    hasPendingRevision && connectedAddress && builder?.toLowerCase() === connectedAddress.toLowerCase()
  );
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (hasPendingRevision && connectedAddress && builder?.toLowerCase() === connectedAddress.toLowerCase()) {
      setOpen(true);
    }
  }, [hasPendingRevision, connectedAddress, builder]);

  useEffect(() => {
    if (!open || !ipfsHash || meta || !canViewContent) return;
    setLoading(true);
    fetchJSON(ipfsHash)
      .then((data) => setMeta(data))
      .catch(() => setMeta(null))
      .finally(() => setLoading(false));
  }, [open, ipfsHash, meta, canViewContent]);

  const summarySignals = useMemo(() => {
    const chips = [];
    if (sub.submissionStake > 0n) chips.push({ label: `${formatMon(sub.submissionStake)} MON stake`, tone: 'primary' });
    if (inGrace) chips.push({ label: 'Grace period', tone: 'amber' });
    if (hasPendingRevision) chips.push({ label: 'Revision requested', tone: 'amber' });
    if (disputed) chips.push({ label: 'In dispute', tone: 'primary' });
    if (canWithdraw) chips.push({ label: 'Stake withdrawable', tone: 'success' });
    return chips;
  }, [sub.submissionStake, inGrace, hasPendingRevision, disputed, canWithdraw]);

  if (!ipfsHash) return null;

  return (
    <div
      style={{
        background: t.colors.bg.card,
        border: `1px solid ${t.colors.border.subtle}`,
        borderRadius: t.radius.lg,
        overflow: 'hidden',
        transition: t.transition,
      }}
    >
      <div style={{ padding: '16px 18px' }}>
        <div style={{ display: 'flex', gap: 14, justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0, flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              {canViewContent ? (
                <button
                  onClick={() => setOpen((prev) => !prev)}
                  style={{
                    fontSize: 12,
                    color: t.colors.primary,
                    background: t.colors.primaryDim,
                    border: `1px solid ${t.colors.primaryBorder}`,
                    borderRadius: t.radius.full,
                    padding: '7px 12px',
                    cursor: 'pointer',
                    transition: t.transition,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    fontWeight: 600,
                  }}
                >
                  {open ? <IconChevronUp size={13} color={t.colors.primary} /> : <IconEye size={13} color={t.colors.primary} />}
                  <span>{open ? 'Hide Work' : 'View Work'}</span>
                </button>
              ) : (
                <SignalChip label="Visible to creator and builder only" />
              )}

              <SubStatusBadge status={subStatus} disputed={disputed} />

              {summarySignals.map((chip) => (
                <SignalChip key={chip.label} label={chip.label} tone={chip.tone} />
              ))}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 5, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: t.colors.text.primary }}>
                  Submission by {shortAddr(builder)}
                </span>
                <span style={{ fontFamily: t.fonts.mono, fontSize: 11, color: t.colors.text.faint }}>
                  IPFS {formatIpfsHash(ipfsHash)}
                </span>
              </div>
              <div style={{ fontSize: 12.5, color: t.colors.text.muted, lineHeight: 1.6, maxWidth: 760 }}>
                {canViewContent
                  ? 'Review the full work package, deliverables, notes, and revision history from one place.'
                  : 'Work content is protected. Only the creator and the submitting builder can expand the full payload.'}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            {canApprove && (
              <ActionButton
                onClick={legacyOnApprove || onApprove}
                loading={isApproving || legacyApproving}
                variant="success"
              >
                Approve & Pay
              </ActionButton>
            )}

            {canReject && onRequestRevisionOpen && (
              <ActionButton onClick={onRequestRevisionOpen} variant="amber">
                Request Revision
              </ActionButton>
            )}

            {canReject && (
              <ActionButton
                onClick={onReject}
                loading={isRejecting}
                variant="danger"
                icon={<IconX size={12} color={t.colors.red[400]} />}
              >
                Reject
              </ActionButton>
            )}

            {canDispute && onDispute && (
              <ActionButton
                onClick={onDispute}
                loading={isDisputing}
                variant="primary"
                icon={<IconShield size={12} color={t.colors.primaryLight} />}
              >
                Dispute ({disputeDep ? formatMon(disputeDep) : '0.01'} MON)
              </ActionButton>
            )}

            {canWithdraw && onWithdrawStake && (
              <ActionButton
                onClick={onWithdrawStake}
                loading={isWithdrawStaking}
                variant="amber"
                icon={<IconRefresh size={12} color={t.colors.amber} />}
              >
                Withdraw Stake
              </ActionButton>
            )}
          </div>
        </div>
      </div>

      {open && canViewContent ? (
        <div style={{ padding: '0 18px 18px' }}>
          <div style={{ borderTop: `1px solid ${t.colors.border.faint}`, paddingTop: 16 }}>
            {loading ? (
              <EmptyPanel
                title="Loading submission"
                body="Work metadata is being fetched from IPFS. This can take a moment depending on gateway availability."
              />
            ) : null}

            {!loading && !meta ? (
              <EmptyPanel
                title="Submission content could not be loaded"
                body="The structured submission payload is unavailable from the current gateway set. The raw file can still be inspected directly."
                linkHref={GATEWAY + ipfsHash}
                linkLabel="Open raw JSON"
              />
            ) : null}

            {!loading && meta ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ ...SECTION_CARD_STYLE, display: 'grid', gridTemplateColumns: 'minmax(0, 1.5fr) minmax(280px, 0.9fr)', gap: 14 }}>
                  <div style={{ minWidth: 0 }}>
                    <SectionLabel icon={IconClipboard}>Submission snapshot</SectionLabel>
                    <div style={{ fontSize: 22, fontWeight: 700, color: t.colors.text.primary, lineHeight: 1.2, marginBottom: 8 }}>
                      {meta.title || 'Untitled submission'}
                    </div>
                    {(meta.description || meta.submissionText) && (
                      <div style={{ fontSize: 13.5, color: t.colors.text.secondary, lineHeight: 1.7 }}>
                        {(meta.description || meta.submissionText).replace(/\s+/g, ' ').slice(0, 200)}
                        {(meta.description || meta.submissionText).length > 200 ? '...' : ''}
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10 }}>
                    <SummaryCard label="Builder" value={shortAddr(builder || meta.builderAddress || meta.hunterAddress)} />
                    <SummaryCard label="Status" value={disputed ? 'Disputed' : subStatusLabel(subStatus)} accent={disputed ? t.colors.primaryLight : t.colors.text.primary} />
                    <SummaryCard label="Stake" value={`${formatMon(sub.submissionStake || 0n)} MON`} accent={t.colors.primary} />
                    <SummaryCard label="Payload" value={formatIpfsHash(ipfsHash)} />
                  </div>
                </div>

                {meta.description ? (
                  <div style={SECTION_CARD_STYLE}>
                    <SectionLabel icon={IconClipboard}>Description</SectionLabel>
                    <div className="md-body" style={{ fontSize: 13.5, color: t.colors.text.secondary, lineHeight: 1.75 }}>
                      <ReactMarkdown components={MD_COMPONENTS}>{meta.description}</ReactMarkdown>
                    </div>
                  </div>
                ) : null}

                {meta.deliverables && meta.deliverables.length > 0 ? (
                  <div style={SECTION_CARD_STYLE}>
                    <SectionLabel icon={IconPackage}>Deliverables</SectionLabel>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 10 }}>
                      {meta.deliverables.map((item, index) => (
                        <DeliverableLink key={`${item.label || item.url || item.value}-${index}`} item={item} />
                      ))}
                    </div>
                  </div>
                ) : null}

                {meta.notes ? (
                  <div style={SECTION_CARD_STYLE}>
                    <SectionLabel icon={IconLink}>Notes</SectionLabel>
                    <div style={{ fontSize: 13, color: t.colors.text.secondary, lineHeight: 1.75, margin: 0 }}>
                      {meta.notes}
                    </div>
                  </div>
                ) : null}

                {!meta.description && !meta.deliverables && meta.submissionText ? (
                  <div style={SECTION_CARD_STYLE}>
                    <SectionLabel icon={IconClipboard}>Submission text</SectionLabel>
                    <p style={{ fontSize: 13.5, color: t.colors.text.secondary, lineHeight: 1.75, margin: 0 }}>
                      {meta.submissionText}
                    </p>
                  </div>
                ) : null}

                {bountyId ? (
                  <div style={SECTION_CARD_STYLE}>
                    <RevisionSection
                      bountyId={bountyId}
                      submissionId={subId}
                      isCreator={isCreator}
                      isBuilder={isMySubmission}
                      isPending={isPending}
                      revisionRefresh={revisionRefresh}
                      onRequestRevisionOpen={onRequestRevisionOpen}
                      onUploadRevisionOpen={onUploadRevisionOpen}
                    />
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
