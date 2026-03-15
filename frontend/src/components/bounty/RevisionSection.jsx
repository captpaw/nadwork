import React, { useEffect, useMemo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { theme as t } from '../../styles/theme.js';
import { fetchJSON, GATEWAY } from '../../config/pinata.js';
import Button from '../common/Button.jsx';
import {
  IconExternalLink,
  IconEdit,
  IconMessage,
  IconPackage,
  IconLink,
  IconClipboard,
  IconCalendar,
  IconChevronRight,
} from '../../components/icons';
import { getRevisionRequests, getRevisionResponses, saveRevisionLink } from './RequestRevisionModal.jsx';

const PANEL_STYLE = {
  background: 'linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0))',
  border: `1px solid ${t.colors.border.subtle}`,
  borderRadius: t.radius.lg,
  padding: '14px 16px',
};

function SafeLink({ href, children, ...props }) {
  const isSafe = href && (href.startsWith('https://') || href.startsWith('http://') || href.startsWith('#') || href.startsWith('ipfs://'));
  if (!isSafe) {
    return <span style={{ textDecoration: 'underline', opacity: 0.5 }}>{children}</span>;
  }
  const resolved = href.startsWith('ipfs://')
    ? (import.meta.env.VITE_PINATA_GATEWAY || 'https://gateway.pinata.cloud/ipfs/') + href.replace('ipfs://', '')
    : href;
  return (
    <a href={resolved} target="_blank" rel="noopener noreferrer" {...props}>
      {children}
    </a>
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

function DeliverableLink({ item }) {
  const href = item.value || item.url || '';
  if (!href) return null;

  return (
    <SafeLink
      href={href}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '10px 12px',
        borderRadius: t.radius.md,
        background: t.colors.bg.elevated,
        border: `1px solid ${t.colors.border.default}`,
        textDecoration: 'none',
        color: t.colors.text.secondary,
        fontSize: 12,
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
          width: 28,
          height: 28,
          borderRadius: t.radius.sm,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgba(255,255,255,0.02)',
          border: `1px solid ${t.colors.border.subtle}`,
          flexShrink: 0,
        }}
      >
        <IconExternalLink size={12} color={t.colors.primary} />
      </span>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: t.colors.text.primary }}>{item.label || 'Link'}</div>
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
    </SafeLink>
  );
}

function formatTimestamp(unixSeconds) {
  if (!unixSeconds) return 'Unknown time';
  try {
    return new Date(Number(unixSeconds) * 1000).toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return 'Unknown time';
  }
}

function extractIpfsHash(input) {
  const value = input.trim();
  if (!value) return '';

  try {
    const url = new URL(value.includes('://') ? value : `https://x/${value}`);
    let params = url.searchParams;
    if (url.hash && url.hash.includes('?')) {
      params = new URLSearchParams(url.hash.split('?')[1] || '');
    }
    const linked = params.get('revisionRequest') || params.get('revisionResponse');
    if (linked) return linked;
  } catch {
    // fall through to path parsing
  }

  const pathHash = value.replace(/^ipfs:\/\//, '').replace(/.*\/ipfs\//, '').split('?')[0].split('/')[0].trim();
  if (/^Qm[1-9A-HJ-NP-Za-km-z]{44,}$/.test(pathHash)) return pathHash;
  if (/^Qm[1-9A-HJ-NP-Za-km-z]{44,}$/.test(value)) return value;
  return pathHash || '';
}

function PastePanel({
  title,
  description,
  value,
  onChange,
  onSubmit,
  disabled,
}) {
  return (
    <div style={PANEL_STYLE}>
      <div style={{ fontSize: 13, fontWeight: 600, color: t.colors.text.primary, marginBottom: 6 }}>{title}</div>
      <div style={{ fontSize: 12.5, color: t.colors.text.muted, lineHeight: 1.7, marginBottom: 12 }}>{description}</div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="https://... or ipfs://..."
          style={{
            flex: '1 1 280px',
            minWidth: 0,
            padding: '10px 12px',
            fontSize: 12,
            fontFamily: t.fonts.mono,
            background: t.colors.bg.elevated,
            border: `1px solid ${t.colors.border.default}`,
            borderRadius: t.radius.md,
            color: t.colors.text.primary,
          }}
        />
        <Button variant="outline" size="sm" onClick={onSubmit} disabled={disabled || !value.trim()}>
          Fetch
        </Button>
      </div>
    </div>
  );
}

function ActivityCard({
  tone,
  index,
  title,
  subtitle,
  hash,
  children,
}) {
  const palette = tone === 'request'
    ? { accent: t.colors.amber, bg: t.colors.amberDim, border: t.colors.amberBorder }
    : { accent: t.colors.green[400], bg: t.colors.green.dim, border: t.colors.green.border };

  return (
    <div style={{ ...PANEL_STYLE, position: 'relative' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span
            style={{
              padding: '5px 9px',
              borderRadius: t.radius.full,
              background: palette.bg,
              border: `1px solid ${palette.border}`,
              color: palette.accent,
              fontSize: 10.5,
              fontWeight: 600,
              letterSpacing: '0.05em',
              textTransform: 'uppercase',
            }}
          >
            {tone === 'request' ? `Request ${index}` : `Response ${index}`}
          </span>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: t.colors.text.primary }}>{title}</div>
            {subtitle ? <div style={{ fontSize: 12, color: t.colors.text.muted, marginTop: 2 }}>{subtitle}</div> : null}
          </div>
        </div>
        <SafeLink
          href={`${GATEWAY}${hash}`}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            color: t.colors.primary,
            fontSize: 11.5,
            fontWeight: 600,
            textDecoration: 'none',
          }}
        >
          <IconExternalLink size={12} color={t.colors.primary} />
          Raw IPFS
        </SafeLink>
      </div>
      {children}
    </div>
  );
}

export default function RevisionSection({
  bountyId,
  submissionId,
  isCreator,
  isBuilder,
  isPending,
  revisionRequestIpfs,
  revisionResponseIpfs,
  onRevisionRequestIpfsChange,
  onRevisionResponseIpfsChange,
  onRequestRevisionOpen,
  onUploadRevisionOpen,
  revisionRefresh = 0,
}) {
  const [requestDatas, setRequestDatas] = useState([]);
  const [responseDatas, setResponseDatas] = useState([]);
  const [loadingReqs, setLoadingReqs] = useState(false);
  const [loadingRess, setLoadingRess] = useState(false);
  const [pasteReq, setPasteReq] = useState('');
  const [pasteRes, setPasteRes] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  const reqHashes = useMemo(() => {
    const fromStorage = getRevisionRequests(bountyId, submissionId);
    if (revisionRequestIpfs && !fromStorage.includes(revisionRequestIpfs)) return [...fromStorage, revisionRequestIpfs];
    return fromStorage;
  }, [bountyId, submissionId, revisionRequestIpfs, refreshKey, revisionRefresh]);

  const resHashes = useMemo(() => {
    const fromStorage = getRevisionResponses(bountyId, submissionId);
    if (revisionResponseIpfs && !fromStorage.includes(revisionResponseIpfs)) return [...fromStorage, revisionResponseIpfs];
    return fromStorage;
  }, [bountyId, submissionId, revisionResponseIpfs, refreshKey, revisionRefresh]);

  useEffect(() => {
    if (!bountyId || !submissionId) return;
    const hash = window.location.hash;
    const queryStart = hash.indexOf('?');
    if (queryStart < 0) return;
    const params = new URLSearchParams(hash.slice(queryStart));
    const urlSubmissionId = params.get('submissionId');
    if (urlSubmissionId !== String(submissionId)) return;

    const requestHash = params.get('revisionRequest');
    const responseHash = params.get('revisionResponse');
    if (requestHash) saveRevisionLink(bountyId, submissionId, 'request', requestHash);
    if (responseHash) saveRevisionLink(bountyId, submissionId, 'response', responseHash);
    if (requestHash || responseHash) setRefreshKey((value) => value + 1);
  }, [bountyId, submissionId]);

  const reqHashesKey = reqHashes.join(',');
  const resHashesKey = resHashes.join(',');

  useEffect(() => {
    if (!reqHashes.length) {
      setRequestDatas([]);
      return;
    }
    setLoadingReqs(true);
    Promise.all(reqHashes.map((hash) => fetchJSON(hash).catch(() => null)))
      .then((results) => setRequestDatas(results))
      .finally(() => setLoadingReqs(false));
  }, [reqHashesKey]);

  useEffect(() => {
    if (!resHashes.length) {
      setResponseDatas([]);
      return;
    }
    setLoadingRess(true);
    Promise.all(resHashes.map((hash) => fetchJSON(hash).catch(() => null)))
      .then((results) => setResponseDatas(results))
      .finally(() => setLoadingRess(false));
  }, [resHashesKey]);

  const handlePasteRequest = () => {
    const hash = extractIpfsHash(pasteReq);
    if (!hash) return;
    saveRevisionLink(bountyId, submissionId, 'request', hash);
    setPasteReq('');
    setRefreshKey((value) => value + 1);
    onRevisionRequestIpfsChange?.(hash);
  };

  const handlePasteResponse = () => {
    const hash = extractIpfsHash(pasteRes);
    if (!hash) return;
    saveRevisionLink(bountyId, submissionId, 'response', hash);
    setPasteRes('');
    setRefreshKey((value) => value + 1);
    onRevisionResponseIpfsChange?.(hash);
  };

  const showRevision = isPending && (isCreator || isBuilder);
  if (!showRevision || !bountyId || !submissionId) return null;

  const hasRequestData = requestDatas.some(Boolean);
  const hasAnyActivity = reqHashes.length > 0 || resHashes.length > 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <SectionLabel icon={IconMessage}>Revision flow</SectionLabel>
          <div style={{ fontSize: 13.5, color: t.colors.text.secondary, lineHeight: 1.7, maxWidth: 760 }}>
            Keep revision feedback and updated work linked to the same submission so creator and builder can review a clean audit trail.
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {isCreator ? (
            <Button variant="amber" size="sm" onClick={onRequestRevisionOpen} icon={<IconEdit size={12} color={t.colors.amber} />}>
              Request Revision
            </Button>
          ) : null}
          {isBuilder && hasRequestData ? (
            <Button variant="success" size="sm" onClick={onUploadRevisionOpen} icon={<IconChevronRight size={12} color={t.colors.green[400]} />}>
              Upload Revision
            </Button>
          ) : null}
        </div>
      </div>

      {isBuilder && reqHashes.length === 0 ? (
        <PastePanel
          title="Load creator feedback"
          description="If the creator sent you a revision link outside the app, paste it here to attach the request to this submission view."
          value={pasteReq}
          onChange={setPasteReq}
          onSubmit={handlePasteRequest}
        />
      ) : null}

      {isCreator && reqHashes.length > 0 ? (
        <PastePanel
          title="Load builder revision link"
          description="If the builder replies outside the app, paste the revision link here so the updated package appears in this timeline."
          value={pasteRes}
          onChange={setPasteRes}
          onSubmit={handlePasteResponse}
        />
      ) : null}

      {!hasAnyActivity ? (
        <div style={PANEL_STYLE}>
          <div style={{ fontSize: 13, fontWeight: 600, color: t.colors.text.primary, marginBottom: 6 }}>
            No revision activity yet
          </div>
          <div style={{ fontSize: 12.5, color: t.colors.text.muted, lineHeight: 1.7 }}>
            Revision requests and updated work will appear here as soon as they are attached to this submission.
          </div>
        </div>
      ) : null}

      {reqHashes.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {loadingReqs ? (
            <div style={PANEL_STYLE}>
              <div style={{ fontSize: 12.5, color: t.colors.text.muted }}>Loading revision requests...</div>
            </div>
          ) : null}

          {!loadingReqs && requestDatas.map((requestData, index) => (
            <ActivityCard
              key={`request-${reqHashes[index]}-${index}`}
              tone="request"
              index={index + 1}
              title="Creator feedback"
              subtitle={requestData?.timestamp ? formatTimestamp(requestData.timestamp) : 'Timestamp unavailable'}
              hash={reqHashes[index]}
            >
              {requestData ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {requestData.message ? (
                    <div>
                      <SectionLabel icon={IconClipboard}>Feedback</SectionLabel>
                      <div className="md-body" style={{ fontSize: 13, color: t.colors.text.secondary, lineHeight: 1.7 }}>
                        <ReactMarkdown components={{ a: SafeLink }}>{requestData.message}</ReactMarkdown>
                      </div>
                    </div>
                  ) : null}

                  {requestData.refLink ? (
                    <div>
                      <SectionLabel icon={IconLink}>Reference</SectionLabel>
                      <SafeLink
                        href={requestData.refLink}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 8,
                          color: t.colors.primary,
                          fontSize: 12.5,
                          fontWeight: 600,
                          textDecoration: 'none',
                        }}
                      >
                        <IconExternalLink size={12} color={t.colors.primary} />
                        Open reference link
                      </SafeLink>
                    </div>
                  ) : null}
                </div>
              ) : (
                <div style={{ fontSize: 12.5, color: t.colors.text.muted }}>Request payload could not be loaded.</div>
              )}
            </ActivityCard>
          ))}
        </div>
      ) : null}

      {resHashes.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {loadingRess ? (
            <div style={PANEL_STYLE}>
              <div style={{ fontSize: 12.5, color: t.colors.text.muted }}>Loading revision responses...</div>
            </div>
          ) : null}

          {!loadingRess && responseDatas.map((responseData, index) => (
            <ActivityCard
              key={`response-${resHashes[index]}-${index}`}
              tone="response"
              index={index + 1}
              title={responseData?.title || 'Builder revision response'}
              subtitle={responseData?.timestamp ? formatTimestamp(responseData.timestamp) : 'Timestamp unavailable'}
              hash={resHashes[index]}
            >
              {responseData ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {responseData.description ? (
                    <div>
                      <SectionLabel icon={IconMessage}>Update summary</SectionLabel>
                      <div className="md-body" style={{ fontSize: 13, color: t.colors.text.secondary, lineHeight: 1.7 }}>
                        <ReactMarkdown components={{ a: SafeLink }}>{responseData.description}</ReactMarkdown>
                      </div>
                    </div>
                  ) : null}

                  {responseData.deliverables && responseData.deliverables.length > 0 ? (
                    <div>
                      <SectionLabel icon={IconPackage}>Updated deliverables</SectionLabel>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 8 }}>
                        {responseData.deliverables.map((item, deliverableIndex) => (
                          <DeliverableLink key={`${item.label || item.url || item.value}-${deliverableIndex}`} item={item} />
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {responseData.notes ? (
                    <div>
                      <SectionLabel icon={IconClipboard}>Builder notes</SectionLabel>
                      <div style={{ fontSize: 12.5, color: t.colors.text.secondary, lineHeight: 1.7 }}>
                        {responseData.notes}
                      </div>
                    </div>
                  ) : null}

                  {responseData.requestIpfs ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', fontSize: 11.5, color: t.colors.text.muted }}>
                      <IconCalendar size={12} color={t.colors.text.muted} />
                      <span>Linked to request {responseData.requestIpfs.slice(0, 8)}...{responseData.requestIpfs.slice(-8)}</span>
                    </div>
                  ) : null}
                </div>
              ) : (
                <div style={{ fontSize: 12.5, color: t.colors.text.muted }}>Response payload could not be loaded.</div>
              )}
            </ActivityCard>
          ))}
        </div>
      ) : null}
    </div>
  );
}
