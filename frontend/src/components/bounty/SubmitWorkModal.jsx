import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useWalletClient, useAccount } from 'wagmi';
import { ethers } from 'ethers';
import Modal from '@/components/common/Modal.jsx';
import Button from '@/components/common/Button.jsx';
import Input from '@/components/common/Input.jsx';
import { theme as t } from '@/styles/theme.js';
import { uploadJSON, buildSubmissionMeta } from '@/config/pinata.js';
import { getContract, getReadContract } from '@/utils/ethers.js';
import { ADDRESSES, FACTORY_ABI, IDENTITY_ABI } from '@/config/contracts.js';
import { toast } from '@/utils/toast.js';

const STEP_LABEL = {
  idle:       null,
  uploading:  { icon: '📦', label: 'Uploading to IPFS…',        sub: 'Storing your work permanently on the decentralised web.' },
  confirming: { icon: '⛓️', label: 'Waiting for confirmation…', sub: 'Please confirm the transaction in your wallet.' },
  done:       { icon: '🎯', label: 'Submitted!',                 sub: 'Your work has been recorded on-chain. Good luck!' },
};

// V3: fallback constants mirror BountyFactory.sol — used only if on-chain fetch fails
const MIN_SUBMISSION_STAKE = ethers.parseEther('0.001');
const MAX_SUBMISSION_STAKE = ethers.parseEther('0.1');
const SUBMISSION_STAKE_BPS = 100n;
const BPS_DENOM            = 10_000n;

// Local fallback calculation — only used when contract call fails
function calcSubStakeFallback(totalReward) {
  if (!totalReward || totalReward === 0n) return MIN_SUBMISSION_STAKE;
  let pct = (BigInt(totalReward) * SUBMISSION_STAKE_BPS) / BPS_DENOM;
  if (pct < MIN_SUBMISSION_STAKE) pct = MIN_SUBMISSION_STAKE;
  if (pct > MAX_SUBMISSION_STAKE) pct = MAX_SUBMISSION_STAKE;
  return pct;
}

// Detect the type of a URL for richer preview
function detectType(url) {
  if (!url) return 'url';
  if (url.includes('github.com'))  return 'github';
  if (url.includes('figma.com'))   return 'figma';
  if (url.includes('twitter.com') || url.includes('x.com')) return 'twitter';
  if (url.includes('vercel.app') || url.includes('netlify.app') || url.includes('demo')) return 'demo';
  return 'url';
}

// Tier label helper
function tierLabel(tier) {
  if (tier === 0) return { text: 'Anonymous', color: '#f87171', bg: 'rgba(239,68,68,0.08)' };
  if (tier === 1) return { text: 'Registered', color: '#fbbf24', bg: 'rgba(251,191,36,0.08)' };
  if (tier === 2) return { text: 'Active', color: '#34d399', bg: 'rgba(52,211,153,0.08)' };
  return { text: 'Trusted', color: '#818cf8', bg: 'rgba(129,140,248,0.08)' };
}

export default function SubmitWorkModal({ open, onClose, bountyId, bountyReward, onSuccess }) {
  const { data: walletClient } = useWalletClient();
  const { address } = useAccount();
  const [form, setForm] = useState({ title: '', description: '', links: '' });
  const [step, setStep] = useState('idle');
  const [hunterTier, setHunterTier] = useState(null); // null = loading
  const [submissionStake, setSubmissionStake] = useState(MIN_SUBMISSION_STAKE);

  const busy = step !== 'idle' && step !== 'done';
  const totalRewardWei = bountyReward ? BigInt(bountyReward) : 0n;

  // V3: fetch hunter tier and calculate stake
  // FIX-8: reset state immediately when modal closes so stale data never shows on re-open
  useEffect(() => {
    if (!open) {
      setHunterTier(null);
      setSubmissionStake(MIN_SUBMISSION_STAKE);
      return;
    }
    if (!address) return;
    let cancelled = false;

    async function fetchTierAndStake() {
      try {
        // Fetch stake using signer so msg.sender = hunter address (correct tier multiplier)
        if (ADDRESSES.factory && bountyId && walletClient) {
          try {
            const factory = await getContract(ADDRESSES.factory, FACTORY_ABI, walletClient);
            const stakeOnChain = await factory.getSubmissionStake(BigInt(bountyId));
            if (!cancelled) setSubmissionStake(BigInt(stakeOnChain));
          } catch {
            // Fallback to local calculation if signer call fails
            if (!cancelled) setSubmissionStake(calcSubStakeFallback(totalRewardWei));
          }
        } else if (ADDRESSES.factory && bountyId) {
          // No wallet yet — use read-only (msg.sender = address(0), tier 0 multiplier)
          try {
            const factory = getReadContract(ADDRESSES.factory, FACTORY_ABI);
            const stakeOnChain = await factory.getSubmissionStake(BigInt(bountyId));
            if (!cancelled) setSubmissionStake(BigInt(stakeOnChain));
          } catch {
            if (!cancelled) setSubmissionStake(calcSubStakeFallback(totalRewardWei));
          }
        }

        // Determine tier from identity contract
        if (ADDRESSES.identity) {
          const identity = getReadContract(ADDRESSES.identity, IDENTITY_ABI);
          const uname = await identity.getUsername(address);
          if (!uname || uname.length === 0) {
            if (!cancelled) setHunterTier(0);
            return;
          }
          // Use getHunterStats() (named struct) with fallback to hunters() mapping tuple
          if (ADDRESSES.reputation) {
            const { REPUTATION_ABI: repABI } = await import('@/config/contracts.js');
            const rep = getReadContract(ADDRESSES.reputation, repABI);
            const stats = await rep.getHunterStats(address).catch(() => rep.hunters(address).catch(() => null));
            const subCount = stats ? BigInt(stats.submissionCount ?? stats[0] ?? 0n) : 0n;
            const winCount = stats ? BigInt(stats.winCount        ?? stats[1] ?? 0n) : 0n;
            if (subCount === 0n) { if (!cancelled) setHunterTier(1); return; }
            if (winCount < 5n)  { if (!cancelled) setHunterTier(2); return; }
            if (!cancelled) setHunterTier(3);
          } else {
            if (!cancelled) setHunterTier(1);
          }
        } else {
          // No identity contract deployed — permissive mode
          if (!cancelled) setHunterTier(2);
        }
      } catch {
        // Fallback: show tier 1 if can't determine
        if (!cancelled) setHunterTier(1);
      }
    }

    fetchTierAndStake();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address, open, bountyId, walletClient]);

  const stakeMon = parseFloat(ethers.formatEther(submissionStake)).toFixed(4);
  const tier     = hunterTier;
  const tLabel   = tier !== null ? tierLabel(tier) : null;

  // Tier 1 (Registered) can only submit to bounties < 1 MON — mirrors BountyFactory.sol submitWork check
  // The threshold (1 ether) is read from the contract logic; we mirror it here for UX feedback.
  // If the contract changes this threshold, the on-chain check will still be the source of truth.
  const canSubmit = tier === null || tier >= 1;
  const TIER2_THRESHOLD = ethers.parseEther('1'); // must match BountyFactory.sol line ~205
  const needsLargerBountyTier = tier === 1 && totalRewardWei >= TIER2_THRESHOLD;

  const handleSubmit = async () => {
    if (!walletClient || !form.title.trim()) return;
    if (!form.links.trim()) { toast('Add at least one deliverable link', 'warning'); return; }
    if (tier === 0) { toast('You need a NadWork username to submit. Set one in your profile.', 'error'); return; }
    if (needsLargerBountyTier) { toast('This bounty requires Active status (at least 1 prior submission). Submit to a smaller bounty first.', 'warning'); return; }

    try {
      setStep('uploading');

      const deliverables = form.links
        .split('\n')
        .map(l => l.trim())
        .filter(Boolean)
        .map(url => ({ type: detectType(url), label: '', value: url }));

      const meta = buildSubmissionMeta({
        bountyId,
        hunterAddress: walletClient.account.address,
        title:       form.title,
        description: form.description,
        deliverables,
      });

      const cid = await uploadJSON(meta, 'submission-' + bountyId);

      setStep('confirming');
      const factory = await getContract(ADDRESSES.factory, FACTORY_ABI, walletClient);
      // V3: submitWork is now payable — send submission stake
      const tx      = await factory.submitWork(BigInt(bountyId), cid, { value: submissionStake });
      const receipt = await tx.wait();

      setStep('done');
      if (onSuccess) onSuccess(receipt.hash);
      setTimeout(() => {
        onClose();
        setStep('idle');
        setForm({ title: '', description: '', links: '' });
      }, 2500);

    } catch (err) {
      console.error(err);
      toast('Submission failed: ' + (err.reason || err.shortMessage || err.message || 'Unknown'), 'error');
      setStep('idle');
    }
  };

  return (
    <Modal open={open} onClose={busy ? undefined : onClose} title="Submit Work">
      <AnimatePresence mode="wait">

        {/* Processing / done */}
        {step !== 'idle' && (
          <motion.div key="processing" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }}
            style={{ padding: '2rem', textAlign: 'center' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '14px', animation: step === 'done' ? 'none' : 'pulse 1.5s ease-in-out infinite' }}>
              {STEP_LABEL[step]?.icon}
            </div>
            <div style={{ fontSize: '16px', fontWeight: 600, color: t.colors.text.primary, marginBottom: '8px' }}>
              {STEP_LABEL[step]?.label}
            </div>
            <p style={{ fontSize: '13px', color: t.colors.text.muted, lineHeight: 1.7 }}>
              {STEP_LABEL[step]?.sub}
            </p>
            {step === 'done' && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
                style={{ marginTop: '20px', padding: '10px 16px', background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: t.radius.md, fontSize: '13px', color: '#34d399' }}>
                ✓ On-chain confirmation received
              </motion.div>
            )}
          </motion.div>
        )}

        {/* Form */}
        {step === 'idle' && (
          <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

            {/* V3: Identity tier + stake info */}
            {tLabel && (
              <div style={{ display: 'flex', gap: '10px', padding: '10px 14px', background: tLabel.bg, border: `1px solid ${tLabel.color}22`, borderRadius: t.radius.md, alignItems: 'center' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                    <span style={{ fontSize: '11px', fontWeight: 600, color: tLabel.color, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      {tLabel.text}
                    </span>
                    {tier === 0 && (
                      <span style={{ fontSize: '10px', color: '#f87171', background: 'rgba(239,68,68,0.1)', padding: '1px 6px', borderRadius: '3px' }}>
                        ✕ Cannot submit
                      </span>
                    )}
                    {needsLargerBountyTier && (
                      <span style={{ fontSize: '10px', color: '#fbbf24', background: 'rgba(251,191,36,0.1)', padding: '1px 6px', borderRadius: '3px' }}>
                        ⚠ Need Active status
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: '11px', color: t.colors.text.muted }}>
                    {tier === 0 && 'Set a username in your profile to submit work.'}
                    {tier === 1 && !needsLargerBountyTier && 'You can submit to bounties < 1 MON. Stake is 1.5× normal.'}
                    {tier === 1 && needsLargerBountyTier && 'This bounty requires Active status. Submit to smaller bounties first to unlock.'}
                    {tier === 2 && 'Active hunter. Normal stake applies.'}
                    {tier === 3 && 'Trusted hunter. You get a 25% stake discount.'}
                  </div>
                </div>
              </div>
            )}

            <Input label="Submission Title *" placeholder="e.g. Staking Dashboard — React + Wagmi" value={form.title}
              onChange={e => setForm(p => ({ ...p, title: e.target.value }))} />

            <div>
              <label style={{ fontSize: '12px', fontWeight: 500, color: t.colors.text.secondary, display: 'block', marginBottom: '7px' }}>
                Description
                <span style={{ fontWeight: 400, color: t.colors.text.muted, marginLeft: '5px' }}>Markdown supported</span>
              </label>
              <textarea rows={4}
                placeholder="Describe your work: approach, what you built, key decisions, how to review…"
                value={form.description}
                onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                style={{ background: t.colors.bg.base, border: '1px solid ' + t.colors.border.default, borderRadius: t.radius.md, padding: '9px 13px', color: t.colors.text.primary, fontFamily: t.fonts.body, fontSize: '13px', outline: 'none', width: '100%', resize: 'vertical', lineHeight: 1.6 }}
              />
            </div>

            <div>
              <label style={{ fontSize: '12px', fontWeight: 500, color: t.colors.text.secondary, display: 'block', marginBottom: '7px' }}>
                Deliverable Links *
                <span style={{ fontWeight: 400, color: t.colors.text.muted, marginLeft: '5px' }}>one per line</span>
              </label>
              <textarea rows={4}
                placeholder={'https://github.com/you/project\nhttps://figma.com/file/...\nhttps://demo.xyz/'}
                value={form.links}
                onChange={e => setForm(p => ({ ...p, links: e.target.value }))}
                style={{ background: t.colors.bg.base, border: '1px solid ' + t.colors.border.default, borderRadius: t.radius.md, padding: '9px 13px', color: t.colors.text.primary, fontFamily: t.fonts.mono, fontSize: '12px', outline: 'none', width: '100%', resize: 'vertical', lineHeight: 1.8 }}
              />
              {form.links.trim() && (
                <div style={{ marginTop: '6px', display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                  {form.links.split('\n').map(l => l.trim()).filter(Boolean).map((url, i) => {
                    const type = detectType(url);
                    const icons = { github: '⌥', figma: '✦', twitter: '𝕏', demo: '⚡', url: '↗' };
                    return (
                      <span key={i} style={{ fontSize: '10px', color: '#818cf8', background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.15)', padding: '2px 7px', borderRadius: '99px' }}>
                        {icons[type]} {type}
                      </span>
                    );
                  })}
                </div>
              )}
            </div>

            {/* V3: Submission stake notice */}
            <div style={{ padding: '10px 14px', background: 'rgba(124,58,237,0.06)', border: '1px solid rgba(124,58,237,0.15)', borderRadius: t.radius.md, fontSize: '12px', lineHeight: 1.6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <span style={{ color: '#818cf8', fontWeight: 500 }}>Submission stake required</span>
                <span style={{ color: '#c7d2fe', fontFamily: t.fonts.mono, fontWeight: 700 }}>{stakeMon} MON</span>
              </div>
              <div style={{ color: t.colors.text.muted }}>
                Refunded if approved or legitimately rejected. Only slashed if fraud is proven via dispute.
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', paddingTop: '4px' }}>
              <Button variant="ghost" onClick={onClose}>Cancel</Button>
              <Button onClick={handleSubmit} disabled={!form.title.trim() || !walletClient || tier === 0 || needsLargerBountyTier}>
                Submit &amp; Stake {stakeMon} MON
              </Button>
            </div>
          </motion.div>
        )}

      </AnimatePresence>
    </Modal>
  );
}
