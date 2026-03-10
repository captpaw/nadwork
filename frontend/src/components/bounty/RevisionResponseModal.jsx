import React, { useState } from 'react';
import Modal from '@/components/common/Modal.jsx';
import { IconCheck } from '@/components/icons/index.jsx';
import Button from '@/components/common/Button.jsx';
import { theme as t } from '@/styles/theme.js';
import { uploadJSON, buildRevisionResponseMeta } from '@/config/pinata.js';
import { toast } from '@/utils/toast.js';
import { saveRevisionLink } from './RequestRevisionModal.jsx';

function parseLinks(links) {
  return links
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean)
    .map(url => ({ type: 'url', value: url, url, label: 'Link' }));
}

export default function RevisionResponseModal({
  open,
  onClose,
  bountyId,
  submissionId,
  requestIpfs,
  builderAddress,
  onSuccess,
}) {
  const [form, setForm] = useState({ title: '', description: '', links: '', notes: '' });
  const [uploading, setUploading] = useState(false);
  const [ipfsHash, setIpfsHash] = useState('');
  const [copied, setCopied] = useState(false);

  const handleReset = () => {
    setForm({ title: '', description: '', links: '', notes: '' });
    setIpfsHash('');
    setCopied(false);
  };

  const handleClose = () => {
    handleReset();
    onClose?.();
  };

  const handleSubmit = async () => {
    if (!form.title.trim()) {
      toast('Please enter a title for your revision.', 'error');
      return;
    }
    const deliverables = parseLinks(form.links);
    if (deliverables.length === 0) {
      toast('Please add at least one deliverable link.', 'error');
      return;
    }
    if (!bountyId || !submissionId || !requestIpfs || !builderAddress) return;
    setUploading(true);
    try {
      const meta = buildRevisionResponseMeta({
        bountyId,
        submissionId,
        requestIpfs,
        builderAddress,
        title: form.title.trim(),
        description: form.description.trim(),
        deliverables,
        notes: form.notes.trim(),
      });
      const hash = await uploadJSON(meta, `revision-response-${bountyId}-${submissionId}-${Date.now()}`);
      setIpfsHash(hash);
      saveRevisionLink(bountyId, submissionId, 'response', hash);
      onSuccess?.(hash);
      toast('Revision uploaded. Share the link with the creator.', 'success');
    } catch (err) {
      toast(err.message || 'Upload failed', 'error');
    } finally {
      setUploading(false);
    }
  };

  const shareUrl = ipfsHash
    ? `${window.location.origin}${window.location.pathname}#/bounty/${bountyId}?revisionResponse=${ipfsHash}&submissionId=${submissionId}`
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
    <Modal open={open} onClose={handleClose} title="Upload Revision" maxWidth={500}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {!ipfsHash ? (
          <>
            <p style={{ fontSize: 13, color: t.colors.text.muted, lineHeight: 1.6 }}>
              Upload your revised work. This is stored on IPFS (off-chain). Share the link with the creator so they can review and decide to approve or reject.
            </p>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: t.colors.text.muted, marginBottom: 6, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                Title *
              </label>
              <input
                type="text"
                value={form.title}
                onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
                placeholder="e.g. Revised layout — mobile responsive"
                disabled={uploading}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  fontSize: 13,
                  fontFamily: t.fonts.body,
                  color: t.colors.text.primary,
                  background: t.colors.bg.elevated,
                  border: `1px solid ${t.colors.border.default}`,
                  borderRadius: t.radius.md,
                  boxSizing: 'border-box',
                }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: t.colors.text.muted, marginBottom: 6, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                Description
              </label>
              <textarea
                value={form.description}
                onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                placeholder="Describe the changes you made..."
                rows={3}
                disabled={uploading}
                style={{
                  width: '100%',
                  padding: '10px 14px',
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
                Deliverable links *
              </label>
              <textarea
                value={form.links}
                onChange={e => setForm(p => ({ ...p, links: e.target.value }))}
                placeholder={'https://github.com/...\nhttps://figma.com/...\nhttps://demo.xyz/'}
                rows={3}
                disabled={uploading}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  fontSize: 12,
                  fontFamily: t.fonts.mono,
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
                Notes (optional)
              </label>
              <input
                type="text"
                value={form.notes}
                onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
                placeholder="Anything else the creator should know"
                disabled={uploading}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  fontSize: 13,
                  fontFamily: t.fonts.body,
                  color: t.colors.text.primary,
                  background: t.colors.bg.elevated,
                  border: `1px solid ${t.colors.border.default}`,
                  borderRadius: t.radius.md,
                  boxSizing: 'border-box',
                }}
              />
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
              <Button variant="outline" onClick={handleClose} disabled={uploading}>
                Cancel
              </Button>
              <Button variant="primary" onClick={handleSubmit} disabled={uploading || !form.title.trim() || !form.links.trim()}>
                {uploading ? 'Uploading…' : 'Upload & Get Link'}
              </Button>
            </div>
          </>
        ) : (
          <>
            <div style={{ padding: '14px 16px', background: t.colors.green.dim, border: `1px solid ${t.colors.green.border}`, borderRadius: t.radius.md }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: t.colors.green[400], marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}><IconCheck size={14} color={t.colors.green[400]} /> Revision uploaded</div>
              <p style={{ fontSize: 11.5, color: t.colors.text.muted, margin: 0, lineHeight: 1.6 }}>
                Share the link below with the creator. They can review your work and approve or reject on the bounty page.
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
