import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { theme as t } from '../../styles/theme.js';
import { fetchJSON } from '../../config/pinata.js';
import { IconExternalLink, IconEdit } from '../../components/icons';
import { getRevisionRequests, getRevisionResponses, getRevisionLink, saveRevisionLink } from './RequestRevisionModal.jsx';

function SafeLink({ href, children, ...props }) {
  const isSafe = href && (href.startsWith('https://') || href.startsWith('http://') || href.startsWith('#') || href.startsWith('ipfs://'));
  if (!isSafe) return <span style={{ textDecoration: 'underline', opacity: 0.5 }}>{children}</span>;
  const resolved = href.startsWith('ipfs://') ? (import.meta.env.VITE_PINATA_GATEWAY || 'https://gateway.pinata.cloud/ipfs/') + href.replace('ipfs://', '') : href;
  return <a href={resolved} target="_blank" rel="noopener noreferrer" {...props}>{children}</a>;
}

function SLabel({ children }) {
  return (
    <div style={{ fontSize: 11, fontWeight: 600, color: t.colors.text.muted, letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 8 }}>
      {children}
    </div>
  );
}

function DeliverableLink({ item }) {
  const href = item.value || item.url || '';
  if (!href) return null;
  return (
    <a href={href} target="_blank" rel="noopener noreferrer"
      style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: t.radius.sm, background: t.colors.bg.elevated, border: `1px solid ${t.colors.border.default}`, textDecoration: 'none', color: t.colors.primary, fontSize: 12 }}>
      <IconExternalLink size={12} color={t.colors.primary} style={{ flexShrink: 0, marginRight: 4 }} /> {item.label || 'Link'}
    </a>
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

  const reqHashes = React.useMemo(() => {
    const fromStorage = getRevisionRequests(bountyId, submissionId);
    if (revisionRequestIpfs && !fromStorage.includes(revisionRequestIpfs)) return [...fromStorage, revisionRequestIpfs];
    return fromStorage;
  }, [bountyId, submissionId, revisionRequestIpfs, refreshKey, revisionRefresh]);
  const resHashes = React.useMemo(() => {
    const fromStorage = getRevisionResponses(bountyId, submissionId);
    if (revisionResponseIpfs && !fromStorage.includes(revisionResponseIpfs)) return [...fromStorage, revisionResponseIpfs];
    return fromStorage;
  }, [bountyId, submissionId, revisionResponseIpfs, refreshKey, revisionRefresh]);
  const reqHash = reqHashes.length > 0 ? reqHashes[reqHashes.length - 1] : '';

  // Load from URL params on mount (e.g. when builder opens shared link)
  useEffect(() => {
    if (!bountyId || !submissionId) return;
    const hash = window.location.hash;
    const qStart = hash.indexOf('?');
    if (qStart < 0) return;
    const params = new URLSearchParams(hash.slice(qStart));
    const urlSubId = params.get('submissionId');
    if (urlSubId !== String(submissionId)) return;
    const req = params.get('revisionRequest');
    const res = params.get('revisionResponse');
    if (req) saveRevisionLink(bountyId, submissionId, 'request', req);
    if (res) saveRevisionLink(bountyId, submissionId, 'response', res);
    if (req || res) setRefreshKey(k => k + 1);
  }, [bountyId, submissionId]);

  // Load all revision requests
  useEffect(() => {
    if (!reqHashes.length) {
      setRequestDatas([]);
      return;
    }
    setLoadingReqs(true);
    Promise.all(reqHashes.map(h => fetchJSON(h).catch(() => null)))
      .then(results => setRequestDatas(results))
      .finally(() => setLoadingReqs(false));
  }, [reqHashes.join(',')]);

  // Load all revision responses
  useEffect(() => {
    if (!resHashes.length) {
      setResponseDatas([]);
      return;
    }
    setLoadingRess(true);
    Promise.all(resHashes.map(h => fetchJSON(h).catch(() => null)))
      .then(results => setResponseDatas(results))
      .finally(() => setLoadingRess(false));
  }, [resHashes.join(',')]);

  function extractIpfsHash(input) {
    const s = input.trim();
    if (!s) return '';
    try {
      const url = new URL(s.includes('://') ? s : 'https://x/' + s);
      let params = url.searchParams;
      if (url.hash && url.hash.includes('?')) {
        const hashQuery = url.hash.split('?')[1] || '';
        params = new URLSearchParams(hashQuery);
      }
      const req = params.get('revisionRequest') || params.get('revisionResponse');
      if (req) return req;
    } catch {}
    const fromPath = s.replace(/^ipfs:\/\//, '').replace(/.*\/ipfs\//, '').split('?')[0].split('/')[0].trim();
    if (/^Qm[1-9A-HJ-NP-Za-km-z]{44,}$/.test(fromPath)) return fromPath;
    if (/^Qm[1-9A-HJ-NP-Za-km-z]{44,}$/.test(s)) return s;
    return fromPath || '';
  }

  const handlePasteRequest = () => {
    const hash = extractIpfsHash(pasteReq);
    if (!hash) return;
    saveRevisionLink(bountyId, submissionId, 'request', hash);
    setPasteReq('');
    setRefreshKey(k => k + 1);
    onRevisionRequestIpfsChange?.(hash);
  };

  const handlePasteResponse = () => {
    const hash = extractIpfsHash(pasteRes);
    if (!hash) return;
    saveRevisionLink(bountyId, submissionId, 'response', hash);
    setPasteRes('');
    setRefreshKey(k => k + 1);
    onRevisionResponseIpfsChange?.(hash);
  };

  const showRevision = isPending && (isCreator || isBuilder);

  if (!showRevision || !bountyId || !submissionId) return null;

  return (
    <div style={{ marginTop: 16, paddingTop: 14, borderTop: `1px solid ${t.colors.border.faint}` }}>
      <SLabel>Revision (off-chain)</SLabel>

      {/* Creator: Request Revision button */}
      {isCreator && (
        <div style={{ marginBottom: 12 }}>
          <button
            onClick={onRequestRevisionOpen}
            style={{
              padding: '8px 14px',
              fontSize: 12,
              fontWeight: 600,
              fontFamily: t.fonts.body,
              color: t.colors.amber,
              background: t.colors.amberDim,
              border: `1px solid ${t.colors.amberBorder}`,
              borderRadius: t.radius.sm,
              cursor: 'pointer',
            }}
          >
            <IconEdit size={12} color={t.colors.amber} style={{ marginRight: 6, verticalAlign: 'middle' }} /> Request Revision
          </button>
        </div>
      )}

      {/* Builder: Paste revision request */}
      {isBuilder && reqHashes.length === 0 && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 11.5, color: t.colors.text.muted, marginBottom: 6 }}>
            Creator sent a revision request? Paste the link:
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="text"
              value={pasteReq}
              onChange={e => setPasteReq(e.target.value)}
              placeholder="https://... or ipfs://..."
              style={{
                flex: 1,
                padding: '8px 12px',
                fontSize: 12,
                fontFamily: t.fonts.mono,
                background: t.colors.bg.elevated,
                border: `1px solid ${t.colors.border.default}`,
                borderRadius: t.radius.sm,
                color: t.colors.text.primary,
              }}
            />
            <button
              onClick={handlePasteRequest}
              disabled={!pasteReq.trim()}
              style={{
                padding: '8px 14px',
                fontSize: 11,
                fontWeight: 600,
                color: t.colors.primary,
                background: t.colors.primaryDim,
                border: `1px solid ${t.colors.primaryBorder}`,
                borderRadius: t.radius.sm,
                cursor: pasteReq.trim() ? 'pointer' : 'not-allowed',
                opacity: pasteReq.trim() ? 1 : 0.5,
              }}
            >
              Load
            </button>
          </div>
        </div>
      )}

      {/* Display all revision requests */}
      {reqHashes.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: t.colors.amber, marginBottom: 8, letterSpacing: '0.05em' }}>Revision requests ({reqHashes.length})</div>
          {loadingReqs && <div style={{ fontSize: 12, color: t.colors.text.muted, padding: 8 }}>Loading…</div>}
          {!loadingReqs && requestDatas.map((requestData, idx) => (
            <div key={idx} style={{ marginBottom: idx < requestDatas.length - 1 ? 12 : 0, padding: 12, background: t.colors.bg.elevated, border: `1px solid ${t.colors.border.subtle}`, borderRadius: t.radius.md }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: t.colors.text.muted, marginBottom: 8 }}>Request #{idx + 1}</div>
              {requestData ? (
                <div>
                  {requestData.message && (
                    <div style={{ fontSize: 13, color: t.colors.text.secondary, lineHeight: 1.6, marginBottom: 8 }}>
                      <ReactMarkdown components={{ a: SafeLink }}>{requestData.message}</ReactMarkdown>
                    </div>
                  )}
                  {requestData.refLink && (
                    <a href={requestData.refLink} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: t.colors.primary }}>Reference ↗</a>
                  )}
                </div>
              ) : (
                <div style={{ fontSize: 12, color: t.colors.text.muted }}>Could not load.</div>
              )}
            </div>
          ))}
          {/* Builder: Upload Revision button when at least one request is loaded */}
          {isBuilder && requestDatas.some(Boolean) && (
            <div style={{ marginTop: 12 }}>
              <button
                onClick={onUploadRevisionOpen}
                style={{
                  padding: '8px 14px',
                  fontSize: 12,
                  fontWeight: 600,
                  fontFamily: t.fonts.body,
                  color: t.colors.green[400],
                  background: t.colors.green.dim,
                  border: `1px solid ${t.colors.green.border}`,
                  borderRadius: t.radius.sm,
                  cursor: 'pointer',
                }}
              >
                ↑ Upload Revision
              </button>
            </div>
          )}
        </div>
      )}

      {/* Creator: Paste revision response */}
      {isCreator && reqHashes.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 11.5, color: t.colors.text.muted, marginBottom: 6 }}>
            Builder sent a revision? Paste the link:
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="text"
              value={pasteRes}
              onChange={e => setPasteRes(e.target.value)}
              placeholder="https://... or ipfs://..."
              style={{
                flex: 1,
                padding: '8px 12px',
                fontSize: 12,
                fontFamily: t.fonts.mono,
                background: t.colors.bg.elevated,
                border: `1px solid ${t.colors.border.default}`,
                borderRadius: t.radius.sm,
                color: t.colors.text.primary,
              }}
            />
            <button
              onClick={handlePasteResponse}
              disabled={!pasteRes.trim()}
              style={{
                padding: '8px 14px',
                fontSize: 11,
                fontWeight: 600,
                color: t.colors.primary,
                background: t.colors.primaryDim,
                border: `1px solid ${t.colors.primaryBorder}`,
                borderRadius: t.radius.sm,
                cursor: pasteRes.trim() ? 'pointer' : 'not-allowed',
                opacity: pasteRes.trim() ? 1 : 0.5,
              }}
            >
              Load
            </button>
          </div>
        </div>
      )}

      {/* Display all revision responses */}
      {resHashes.length > 0 && (
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: t.colors.green[400], marginBottom: 8, letterSpacing: '0.05em' }}>Revision responses ({resHashes.length})</div>
          {loadingRess && <div style={{ fontSize: 12, color: t.colors.text.muted, padding: 8 }}>Loading…</div>}
          {!loadingRess && responseDatas.map((responseData, idx) => (
            <div key={idx} style={{ marginBottom: idx < responseDatas.length - 1 ? 12 : 0, padding: 12, background: t.colors.bg.elevated, border: `1px solid ${t.colors.border.subtle}`, borderRadius: t.radius.md }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: t.colors.text.muted, marginBottom: 8 }}>Response #{idx + 1}</div>
              {responseData ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {responseData.title && (
                    <div style={{ fontSize: 14, fontWeight: 600, color: t.colors.text.primary }}>{responseData.title}</div>
                  )}
                  {responseData.description && (
                    <div style={{ fontSize: 13, color: t.colors.text.secondary, lineHeight: 1.6 }}>
                      <ReactMarkdown components={{ a: SafeLink }}>{responseData.description}</ReactMarkdown>
                    </div>
                  )}
                  {responseData.deliverables && responseData.deliverables.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <SLabel>Deliverables</SLabel>
                      {responseData.deliverables.map((d, i) => (
                        <DeliverableLink key={i} item={d} />
                      ))}
                    </div>
                  )}
                  {responseData.notes && (
                    <div style={{ fontSize: 12, color: t.colors.text.muted, fontStyle: 'italic' }}>{responseData.notes}</div>
                  )}
                </div>
              ) : (
                <div style={{ fontSize: 12, color: t.colors.text.muted }}>Could not load.</div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
