import { useState } from 'react';
import { useWalletClient, useAccount } from 'wagmi';
import Modal from '../common/Modal';
import Button from '../common/Button';
import { theme } from '../../styles/theme';
import { uploadJSON, buildProposalMeta } from '../../config/pinata';
import { getContract } from '../../utils/ethers';
import { ADDRESSES, FACTORY_ABI } from '../../config/contracts';
import { toast } from '../../utils/toast';
import { requestNotificationRefresh } from '../../hooks/useNotifications';
import { IconCheck } from '../icons';

const MIN_PROPOSAL_LEN = 80;
const MAX_PROPOSAL_LEN = 1200;

const PLACEHOLDER = `Tell the creator why you're the right fit for this project.

Suggest covering:
• Relevant experience or past work
• Your approach to this specific task
• Estimated timeline (optional)`;

export default function ApplyModal({ open, onClose, bountyId, bountyTitle, onSuccess }) {
  const { address }             = useAccount();
  const { data: walletClient }  = useWalletClient();

  const [proposal,  setProposal]  = useState('');
  const [loading,   setLoading]   = useState(false);
  const [done,      setDone]      = useState(false);
  const [charErr,   setCharErr]   = useState('');

  const charCount = proposal.length;
  const isValid   = charCount >= MIN_PROPOSAL_LEN && charCount <= MAX_PROPOSAL_LEN;

  const handleChange = (e) => {
    const val = e.target.value;
    setProposal(val);
    if (val.length > 0 && val.length < MIN_PROPOSAL_LEN) {
      setCharErr(`At least ${MIN_PROPOSAL_LEN} characters required`);
    } else if (val.length > MAX_PROPOSAL_LEN) {
      setCharErr(`Maximum ${MAX_PROPOSAL_LEN} characters`);
    } else {
      setCharErr('');
    }
  };

  const handleClose = () => {
    if (loading) return;
    setProposal('');
    setCharErr('');
    setDone(false);
    onClose();
  };

  const handleSubmit = async () => {
    if (!walletClient || !address) { toast('Connect your wallet first.', 'error'); return; }
    if (!ADDRESSES.factory)        { toast('Contract not configured.', 'error'); return; }
    if (!isValid)                  { toast(`Proposal must be ${MIN_PROPOSAL_LEN}–${MAX_PROPOSAL_LEN} characters.`, 'error'); return; }

    setLoading(true);
    try {
      toast('Uploading proposal to IPFS…', 'info');
      const meta = buildProposalMeta({ bountyId, builderAddress: address, proposal });
      const ipfsHash = await uploadJSON(meta, `proposal-${bountyId}-${Date.now()}`);

      toast('Confirm transaction in your wallet…', 'info');
      const factory = await getContract(ADDRESSES.factory, FACTORY_ABI, walletClient);
      const tx = await factory.applyToBounty(BigInt(bountyId), ipfsHash);
      toast('Submitting application…', 'info');
      await tx.wait();
      requestNotificationRefresh();
      toast('Application submitted!', 'success');
      setDone(true);
      onSuccess?.();
    } catch (err) {
      console.error('[ApplyModal]', err);
      toast(err.reason || err.shortMessage || err.message || 'Transaction failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open={open} onClose={handleClose} title="Apply for Project" maxWidth={540}>
      {done ? (
        // ── Success state ─────────────────────────────────────────────────
        <div style={{ textAlign: 'center', padding: '8px 0 4px' }}>
          <div style={{
            width: 56, height: 56, borderRadius: '50%',
            background: theme.colors.green.dim,
            border: `1px solid ${theme.colors.green.border}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 22, margin: '0 auto 18px',
          }}><IconCheck size={28} color={theme.colors.green[400]} strokeWidth={2.5} /></div>
          <h3 style={{
            fontFamily: theme.fonts.body, fontWeight: 700, fontSize: 16,
            color: theme.colors.text.primary, marginBottom: 8, letterSpacing: '-0.025em',
          }}>Application Submitted!</h3>
          <p style={{
            fontFamily: theme.fonts.body, fontSize: 13, color: theme.colors.text.muted,
            lineHeight: 1.6, maxWidth: 360, margin: '0 auto 24px',
          }}>
            Your proposal has been saved on IPFS and recorded on-chain. The creator will review
            applications and notify approved builders.
          </p>
          <Button variant="secondary" size="sm" onClick={handleClose}>
            Close
          </Button>
        </div>
      ) : (
        // ── Form state ────────────────────────────────────────────────────
        <>
          {/* Bounty context */}
          {bountyTitle && (
            <div style={{
              padding: '10px 14px', marginBottom: 18,
              background: theme.colors.primaryDim,
              border: `1px solid ${theme.colors.primaryBorder}`,
              borderRadius: theme.radius.lg,
            }}>
              <div style={{ fontFamily: theme.fonts.mono, fontSize: 9.5, color: theme.colors.text.faint, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 3 }}>
                Applying for
              </div>
              <div style={{ fontFamily: theme.fonts.body, fontWeight: 600, fontSize: 13, color: theme.colors.primaryLight }}>
                {bountyTitle}
              </div>
            </div>
          )}

          {/* Label */}
          <label style={{
            display: 'block',
            fontFamily: theme.fonts.body, fontWeight: 600, fontSize: 12.5,
            color: theme.colors.text.secondary, marginBottom: 8,
          }}>
            Your Proposal <span style={{ color: theme.colors.text.faint, fontWeight: 400 }}>(required)</span>
          </label>

          {/* Textarea */}
          <textarea
            value={proposal}
            onChange={handleChange}
            placeholder={PLACEHOLDER}
            rows={8}
            disabled={loading}
            style={{
              width: '100%', boxSizing: 'border-box',
              padding: '12px 14px',
              background: theme.colors.bg.input,
              border: `1px solid ${charErr ? 'rgba(239,68,68,0.4)' : theme.colors.border.subtle}`,
              borderRadius: theme.radius.lg,
              color: theme.colors.text.primary,
              fontFamily: theme.fonts.body, fontSize: 13,
              lineHeight: 1.65, resize: 'vertical',
              outline: 'none', transition: theme.transition,
              opacity: loading ? 0.6 : 1,
            }}
            onFocus={e => { e.target.style.borderColor = charErr ? 'rgba(239,68,68,0.4)' : theme.colors.border.focus; }}
            onBlur={e => { e.target.style.borderColor = charErr ? 'rgba(239,68,68,0.4)' : theme.colors.border.subtle; }}
          />

          {/* Character count & validation feedback */}
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            marginTop: 6,
          }}>
            <span style={{
              fontFamily: theme.fonts.body, fontSize: 11.5,
              color: charErr ? theme.colors.red[400] : theme.colors.text.faint,
            }}>
              {charErr || (charCount < MIN_PROPOSAL_LEN
                ? `${MIN_PROPOSAL_LEN - charCount} more characters needed`
                : '')}
            </span>
            <span style={{
              fontFamily: theme.fonts.mono, fontSize: 10.5,
              color: charCount > MAX_PROPOSAL_LEN
                ? theme.colors.red[400]
                : charCount >= MIN_PROPOSAL_LEN
                ? theme.colors.green[400]
                : theme.colors.text.faint,
            }}>
              {charCount}/{MAX_PROPOSAL_LEN}
            </span>
          </div>

          {/* Info note */}
          <div style={{
            marginTop: 16, padding: '9px 13px',
            background: theme.colors.bg.elevated,
            border: `1px solid ${theme.colors.border.faint}`,
            borderRadius: theme.radius.md,
            fontFamily: theme.fonts.body, fontSize: 11.5,
            color: theme.colors.text.faint, lineHeight: 1.55,
          }}>
            Your proposal will be stored on IPFS and visible to the creator. If approved, you will
            receive a notification and can then submit your full work.
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: 10, marginTop: 22, justifyContent: 'flex-end' }}>
            <Button variant="secondary" size="sm" onClick={handleClose} disabled={loading}>
              Cancel
            </Button>
            <Button
              variant="primary" size="sm"
              onClick={handleSubmit}
              loading={loading}
              disabled={!isValid || loading}
            >
              Submit Application
            </Button>
          </div>
        </>
      )}
    </Modal>
  );
}
