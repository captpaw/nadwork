import React, { useState } from 'react';
import Modal from '@/components/common/Modal.jsx';
import { IconCheck } from '@/components/icons/index.jsx';
import Button from '@/components/common/Button.jsx';
import { theme as t } from '@/styles/theme.js';
import { uploadJSON, buildRevisionRequestMeta } from '@/config/pinata.js';
import { toast } from '@/utils/toast.js';

const REVISION_STORAGE = 'nadwork_revision';

function getLegacyKey(bountyId, submissionId, kind) {
  return `${REVISION_STORAGE}_${bountyId}_${submissionId}_${kind}`;
}

function getRequestsKey(bountyId, submissionId) {
  return `${REVISION_STORAGE}_${bountyId}_${submissionId}_requests`;
}

function getResponsesKey(bountyId, submissionId) {
  return `${REVISION_STORAGE}_${bountyId}_${submissionId}_responses`;
}

/** Returns array of request IPFS hashes (oldest first). */
export function getRevisionRequests(bountyId, submissionId) {
  try {
    const raw = localStorage.getItem(getRequestsKey(bountyId, submissionId));
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) return arr;
    }
    const legacy = localStorage.getItem(getLegacyKey(bountyId, submissionId, 'request'));
    if (legacy) return [legacy];
    return [];
  } catch { return []; }
}

/** Returns array of response IPFS hashes (oldest first). */
export function getRevisionResponses(bountyId, submissionId) {
  try {
    const raw = localStorage.getItem(getResponsesKey(bountyId, submissionId));
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) return arr;
    }
    const legacy = localStorage.getItem(getLegacyKey(bountyId, submissionId, 'response'));
    if (legacy) return [legacy];
    return [];
  } catch { return []; }
}

function appendRevisionRequest(bountyId, submissionId, ipfsHash) {
  const arr = getRevisionRequests(bountyId, submissionId);
  if (arr.includes(ipfsHash)) return;
  const next = [...arr, ipfsHash];
  localStorage.setItem(getRequestsKey(bountyId, submissionId), JSON.stringify(next));
  localStorage.setItem(getLegacyKey(bountyId, submissionId, 'request'), ipfsHash);
}

function appendRevisionResponse(bountyId, submissionId, ipfsHash) {
  const arr = getRevisionResponses(bountyId, submissionId);
  if (arr.includes(ipfsHash)) return;
  const next = [...arr, ipfsHash];
  localStorage.setItem(getResponsesKey(bountyId, submissionId), JSON.stringify(next));
  localStorage.setItem(getLegacyKey(bountyId, submissionId, 'response'), ipfsHash);
}

export function saveRevisionLink(bountyId, submissionId, kind, ipfsHash) {
  try {
    if (kind === 'request') appendRevisionRequest(bountyId, submissionId, ipfsHash);
    else if (kind === 'response') appendRevisionResponse(bountyId, submissionId, ipfsHash);
  } catch {}
}

/** Returns latest request hash (for backward compat). */
export function getRevisionLink(bountyId, submissionId, kind) {
  const arr = kind === 'request' ? getRevisionRequests(bountyId, submissionId) : getRevisionResponses(bountyId, submissionId);
  return arr.length > 0 ? arr[arr.length - 1] : '';
}

export default function RequestRevisionModal({
  open,
  onClose,
  bountyId,
  submissionId,
  creatorAddress,
  onSuccess,
}) {
  const [message, setMessage] = useState('');
  const [refLink, setRefLink] = useState('');
  const [uploading, setUploading] = useState(false);
  const [ipfsHash, setIpfsHash] = useState('');
  const [copied, setCopied] = useState(false);

  const handleReset = () => {
    setMessage('');
    setRefLink('');
    setIpfsHash('');
    setCopied(false);
  };

  const handleClose = () => {
    handleReset();
    onClose?.();
  };

  const handleSubmit = async () => {
    if (!message.trim()) {
      toast('Please enter your feedback for the builder.', 'error');
      return;
    }
    if (!bountyId || !submissionId || !creatorAddress) return;
    setUploading(true);
    try {
      const meta = buildRevisionRequestMeta({
        bountyId,
        submissionId,
        creatorAddress,
        message: message.trim(),
        refLink: refLink.trim(),
      });
      const hash = await uploadJSON(meta, `revision-request-${bountyId}-${submissionId}-${Date.now()}`);
      setIpfsHash(hash);
      saveRevisionLink(bountyId, submissionId, 'request', hash);
      onSuccess?.(hash);
      toast('Revision request uploaded. Share the link with the builder.', 'success');
    } catch (err) {
      toast(err.message || 'Upload failed', 'error');
    } finally {
      setUploading(false);
    }
  };

  const shareUrl = ipfsHash
    ? `${window.location.origin}${window.location.pathname}#/bounty/${bountyId}?revisionRequest=${ipfsHash}&submissionId=${submissionId}`
    : '';

  const handleCopy = () => {
    if (!shareUrl) return;
    navigator.clipboard.writeText(shareUrl).then(() => {
      setCopied(true);
      toast('Link copied to clipboard', 'success');
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <Modal open={open} onClose={handleClose} title="Request Revision" maxWidth={480}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {!ipfsHash ? (
          <>
            <p style={{ fontSize: 13, color: t.colors.text.muted, lineHeight: 1.6 }}>
              Describe what you want the builder to modify. This will be uploaded to IPFS. Share the generated link with the builder (e.g. via Discord).
            </p>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: t.colors.text.muted, marginBottom: 6, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                Feedback *
              </label>
              <textarea
                value={message}
                onChange={e => setMessage(e.target.value)}
                placeholder="e.g. Please adjust the layout on mobile. Add more contrast for the CTA button..."
                rows={4}
                disabled={uploading}
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  fontSize: 13,
                  fontFamily: t.fonts.body,
                  color: t.colors.text.primary,
                  background: t.colors.bg.elevated,
                  border: `1px solid ${t.colors.border.default}`,
                  borderRadius: t.radius.md,
                  resize: 'vertical',
                  boxSizing: 'border-box',
                }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: t.colors.text.muted, marginBottom: 6, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                Reference link (optional)
              </label>
              <input
                type="url"
                value={refLink}
                onChange={e => setRefLink(e.target.value)}
                placeholder="https://..."
                disabled={uploading}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  fontSize: 13,
                  fontFamily: t.fonts.mono,
                  color: t.colors.text.primary,
                  background: t.colors.bg.elevated,
                  border: `1px solid ${t.colors.border.default}`,
                  borderRadius: t.radius.md,
                  boxSizing: 'border-box',
                }}
              />
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
              <Button variant="outline" onClick={handleClose} disabled={uploading}>
                Cancel
              </Button>
              <Button variant="primary" onClick={handleSubmit} disabled={uploading || !message.trim()}>
                {uploading ? 'Uploading…' : 'Upload & Get Link'}
              </Button>
            </div>
          </>
        ) : (
          <>
            <div style={{ padding: '14px 16px', background: t.colors.green.dim, border: `1px solid ${t.colors.green.border}`, borderRadius: t.radius.md }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: t.colors.green[400], marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}><IconCheck size={14} color={t.colors.green[400]} /> Revision request ready</div>
              <p style={{ fontSize: 11.5, color: t.colors.text.muted, margin: 0, lineHeight: 1.6 }}>
                Share the link below with the builder. When they open it, they’ll see your feedback and can upload their revised work.
              </p>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                readOnly
                value={shareUrl}
                style={{
                  flex: 1,
                  padding: '10px 12px',
                  fontSize: 11,
                  fontFamily: t.fonts.mono,
                  color: t.colors.text.secondary,
                  background: t.colors.bg.elevated,
                  border: `1px solid ${t.colors.border.subtle}`,
                  borderRadius: t.radius.sm,
                }}
              />
              <Button variant="primary" size="sm" onClick={handleCopy}>
                {copied ? 'Copied!' : 'Copy'}
              </Button>
            </div>
            <Button variant="outline" onClick={handleClose} fullWidth>
              Done
            </Button>
          </>
        )}
      </div>
    </Modal>
  );
}
