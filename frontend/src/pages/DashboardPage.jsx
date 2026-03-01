import React, { useState, useEffect, useCallback } from 'react';
import { useAccount, useWalletClient } from 'wagmi';
import { useConnectModal } from '@rainbow-me/rainbowkit';
import { ethers } from 'ethers';
import { motion } from 'framer-motion';
import { theme as t } from '@/styles/theme.js';
import Card from '@/components/common/Card.jsx';
import Badge from '@/components/common/Badge.jsx';
import Button from '@/components/common/Button.jsx';
import { PageLoader } from '@/components/common/Spinner.jsx';
import EmptyState from '@/components/common/EmptyState.jsx';
import { formatReward, formatDate } from '@/utils/format.js';
import { useDisplayName } from '@/hooks/useIdentity.js';
import { getReadContract, getContract } from '@/utils/ethers.js';
import { ADDRESSES, REGISTRY_ABI, FACTORY_ABI, BOUNTY_STATUS, SUB_STATUS } from '@/config/contracts.js';
import { fetchJSON } from '@/config/pinata.js';
import SubmissionViewer from '@/components/bounty/SubmissionViewer.jsx';
import { AvatarDisplay } from '@/components/common/Avatar.jsx';
import { toast } from '@/utils/toast.js';
import { IconChart, IconTarget, IconWarning, IconCheck, IconStar, IconPlus } from '@/components/icons/index.jsx';

// Per-item component so useDisplayName hook can be called without violating rules of hooks
function HunterName({ address: addr }) {
  const { displayName } = useDisplayName(addr);
  return <>{displayName}</>;
}

export default function DashboardPage() {
  const { address }  = useAccount();
  const { data: wc } = useWalletClient();
  const { openConnectModal } = useConnectModal();
  const [bounties,   setBounties]  = useState([]);
  const [loading,    setLoading]   = useState(true);
  const [loadError,  setLoadError] = useState(null);
  const [selected,   setSelected]  = useState({});
  const [approving,  setApproving] = useState(null);
  const [cancelling, setCancelling] = useState(null);
  const [rejecting,  setRejecting]  = useState(new Set());

  const load = useCallback(async () => {
    if (!address || !ADDRESSES.registry) { setLoading(false); return; }
    try {
      setLoading(true);
      setLoadError(null);
      const reg = getReadContract(ADDRESSES.registry, REGISTRY_ABI);
      const ids = await reg.getPosterBounties(address);
      const data = await Promise.all(ids.map(async rawId => {
        const id = String(rawId);
        const [bounty, subs] = await Promise.all([reg.getBounty(id), reg.getBountySubmissions(id)]);
        const meta = bounty.ipfsHash ? await fetchJSON(bounty.ipfsHash).catch(() => null) : null;
        // Normalise id — ethers returns BigInt; stringify immediately
        return { ...bounty, id: rawId, _id: id, subs: [...subs], meta };
      }));
      setBounties(data.reverse());
    } catch (err) {
      console.error('[Dashboard]', err);
      setLoadError('Failed to load your bounties. Please check your connection and refresh.');
    } finally {
      setLoading(false);
    }
  }, [address]);

  useEffect(() => { load(); }, [load]);

  const handleApprove = async (bountyId, winnerCount) => {
    const sel = selected[bountyId] || [];
    if (sel.length < 1) {
      toast('Select at least 1 winner', 'warning'); return;
    }
    if (sel.length > Number(winnerCount)) {
      toast('Cannot select more than ' + winnerCount + ' winner(s)', 'warning'); return;
    }
    try {
      setApproving(bountyId);
      const factory = await getContract(ADDRESSES.factory, FACTORY_ABI, wc);
      // Convert to BigInt — ethers v6 requires uint256[] as BigInt[], not string[]
      const submissionIds = sel.map(id => BigInt(id));
      const ranks         = sel.map((_, i) => i + 1);
      await (await factory.approveWinners(BigInt(bountyId), submissionIds, ranks)).wait();
      toast('Winners approved! Funds released.', 'success');
      setSelected(p => { const n = { ...p }; delete n[bountyId]; return n; });
      load();
    } catch (err) {
      toast('Failed: ' + (err.reason || err.shortMessage || err.message), 'error');
    } finally { setApproving(null); }
  };

  const handleCancel = async (bountyId, submissionCount, totalReward, rewardType) => {
    const subCount = Number(submissionCount);
    const isERC20  = Number(rewardType) === 1;
    const FLAT_ERC20_COMP_WEI = ethers.parseEther('0.005');

    // Send upper-bound msg.value — contract calculates exact fee and refunds excess.
    // Consistent with BountyDetailPage.handleCancel logic.
    let msgValue = 0n;
    if (subCount > 0) {
      if (isERC20) {
        msgValue = FLAT_ERC20_COMP_WEI * BigInt(subCount);
      } else {
        msgValue = BigInt(totalReward); // worst-case upper bound
      }
    }

    const compDisplay = subCount > 0
      ? isERC20
        ? `up to ${ethers.formatEther(msgValue)} MON (excess refunded)`
        : `up to ${ethers.formatEther(msgValue)} MON (excess refunded)`
      : '0 MON';

    const confirmed = window.confirm(
      subCount > 0
        ? `This bounty has ${subCount} submission(s).\n\nCancellation fee: ${compDisplay}\n\nAny unused MON will be refunded to your wallet. Continue?`
        : 'Cancel this bounty and receive a full refund?'
    );
    if (!confirmed) return;
    try {
      setCancelling(bountyId);
      const factory = await getContract(ADDRESSES.factory, FACTORY_ABI, wc);
      await (await factory.cancelBounty(BigInt(bountyId), { value: msgValue })).wait();
      toast('Bounty cancelled. Funds refunded.', 'success');
      load();
    } catch (err) {
      toast('Cancel failed: ' + (err.reason || err.shortMessage || err.message), 'error');
    } finally { setCancelling(null); }
  };

  const handleReject = async (bountyId, submissionId) => {
    const key = bountyId + ':' + submissionId;
    if (!wc) { toast('Connect wallet first', 'warning'); return; }
    if (!window.confirm('Reject this submission?\n\nNote: the hunter can dispute within 2 hours if they believe the rejection is unfair. Their stake is held during the dispute window.')) return;
    setRejecting(prev => new Set(prev).add(key));
    try {
      const factory = await getContract(ADDRESSES.factory, FACTORY_ABI, wc);
      await (await factory.rejectSubmission(BigInt(bountyId), BigInt(submissionId))).wait();
      toast('Submission rejected.', 'success');
      load();
    } catch (err) {
      toast('Reject failed: ' + (err.reason || err.shortMessage || err.message), 'error');
    } finally {
      setRejecting(prev => { const n = new Set(prev); n.delete(key); return n; });
    }
  };

  if (!address) return (
    <div>
      <div className="container" style={{ padding: '5rem 1rem', textAlign: 'center' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px', color: t.colors.text.faint }}>
          <IconChart size={40} />
        </div>
        <h2 style={{ fontWeight: 700, fontSize: '20px', color: t.colors.text.primary, marginBottom: '8px', letterSpacing: '-0.02em' }}>My Dashboard</h2>
        <p style={{ color: t.colors.text.muted, marginBottom: '24px', fontSize: '14px' }}>Connect your wallet to manage your bounties.</p>
        <button
          onClick={openConnectModal}
          style={{
            background: t.colors.violet[600],
            color: '#fff',
            border: 'none',
            borderRadius: t.radius.md,
            padding: '10px 24px',
            fontSize: '13.5px',
            fontWeight: 600,
            cursor: 'pointer',
            letterSpacing: '-0.01em',
            transition: 'background 0.12s ease',
          }}
          onMouseEnter={e => e.currentTarget.style.background = t.colors.violet[700]}
          onMouseLeave={e => e.currentTarget.style.background = t.colors.violet[600]}
        >
          Connect Wallet
        </button>
      </div>
    </div>
  );

  if (loading) return <PageLoader />;

  // Summary stats
  const totalPosted    = bounties.length;
  const totalActive    = bounties.filter(b => Number(b.status) === 0).length;
  const totalCompleted = bounties.filter(b => Number(b.status) === 2).length;
  const pendingReview  = bounties.reduce((n, b) => n + b.subs.filter(s => Number(s.status) === 0).length, 0);

  return (
    <div>
      <div className="container" style={{ padding: 'clamp(1.5rem, 4vw, 3rem) clamp(1rem, 4vw, 2rem)' }}>
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px', marginBottom: '2rem' }}>
            <div>
              <h1 style={{ fontWeight: 700, fontSize: 'clamp(20px, 3vw, 28px)', color: t.colors.text.primary, letterSpacing: '-0.03em', marginBottom: '4px' }}>
                My Dashboard
              </h1>
              <p style={{ fontSize: '13px', color: t.colors.text.muted }}>Manage your posted bounties and review submissions.</p>
            </div>
            <Button icon={<IconPlus size={14} />} onClick={() => window.location.hash = '#/post'}>Post Bounty</Button>
          </div>

          {/* Stats strip */}
          {bounties.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: '10px', marginBottom: '28px' }}>
              {[
                { label: 'Total Posted',   value: totalPosted    },
                { label: 'Active',         value: totalActive,   color: '#34d399' },
                { label: 'Completed',      value: totalCompleted, color: '#818cf8' },
                { label: 'Pending Review', value: pendingReview,  color: '#fb923c' },
              ].map(s => (
                <div key={s.label} style={{ padding: '14px', background: t.colors.bg.card, border: '1px solid ' + t.colors.border.default, borderRadius: t.radius.md, textAlign: 'center' }}>
                  <div style={{ fontFamily: t.fonts.mono, fontSize: 'clamp(18px, 3vw, 24px)', fontWeight: 700, color: s.color || t.colors.text.primary, letterSpacing: '-0.02em', lineHeight: 1 }}>{s.value}</div>
                  <div style={{ fontSize: '10px', color: t.colors.text.muted, marginTop: '5px', letterSpacing: '0.06em', textTransform: 'uppercase' }}>{s.label}</div>
                </div>
              ))}
            </div>
          )}

          {loadError
            ? <EmptyState icon={IconWarning} title="Failed to load" message={loadError} action="Retry" onAction={load} />
            : bounties.length === 0
            ? <EmptyState icon={IconTarget} title="No bounties posted" message="Post your first bounty to find talent in the Monad ecosystem." action="Post a Bounty" onAction={() => window.location.hash = '#/post'} />
            : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {bounties.map(b => {
                  const statusNum  = Number(b.status);
                  const statusKey  = BOUNTY_STATUS[statusNum]?.toLowerCase() || 'active';
                  const isActive   = statusNum === 0;
                  const isDisputed = statusNum === 5;
                  const pendingSubs = b.subs.filter(s => Number(s.status) === 0);
                  const selForBounty = selected[b._id] || [];

                  return (
                    <Card key={b._id}>
                      {/* Bounty header */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px', marginBottom: b.subs.length > 0 && isActive ? '20px' : '0' }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '8px', alignItems: 'center' }}>
                            <Badge type={statusKey} label={BOUNTY_STATUS[statusNum] || 'ACTIVE'} />
                            {b.featured && (
                              <Badge type="featured" label={<span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}><IconStar size={9} color="#fbbf24" />Featured</span>} />
                            )}
                            {isDisputed && <Badge type="disputed" label="Disputed" />}
                          </div>
                          <h3 style={{ fontWeight: 600, fontSize: '15px', color: t.colors.text.primary, marginBottom: '6px', letterSpacing: '-0.01em' }}>
                            {b.meta?.title || b.title || 'Bounty #' + b._id}
                          </h3>
                          <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', fontSize: '12px', color: t.colors.text.muted }}>
                            <span style={{ fontFamily: t.fonts.mono, color: '#c7d2fe', fontWeight: 600 }}>{formatReward(b.totalReward, b.rewardType)}</span>
                            <span>{String(b.submissionCount)} submission{Number(b.submissionCount) !== 1 ? 's' : ''}</span>
                            {pendingSubs.length > 0 && <span style={{ color: '#fb923c' }}>{pendingSubs.length} pending review</span>}
                            <span>{formatDate(b.createdAt)}</span>
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: '8px', flexShrink: 0, flexWrap: 'wrap' }}>
                          <Button size="sm" variant="secondary" onClick={() => window.location.hash = '#/bounty/' + b._id}>
                            View
                          </Button>
                          {isActive && (
                            <Button size="sm" variant="danger" loading={cancelling === b._id}
                              onClick={() => handleCancel(b._id, b.submissionCount, b.totalReward, b.rewardType)}>
                              Cancel
                            </Button>
                          )}
                        </div>
                      </div>

                      {/* Submissions list — only for active bounties */}
                      {b.subs.length > 0 && isActive && (
                        <div style={{ borderTop: '1px solid ' + t.colors.border.subtle, paddingTop: '16px' }}>
                          <div style={{ fontSize: '11px', color: t.colors.text.muted, letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: '10px' }}>
                            Submissions ({b.subs.length})
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {b.subs.map(s => {
                              const subStatus = Number(s.status);
                              const isSelected = selForBounty.includes(String(s.id));
                              return (
                                <div key={String(s.id)} style={{
                                  padding: '10px 14px',
                                  background: isSelected ? 'rgba(124,58,237,0.08)' : t.colors.bg.elevated,
                                  borderRadius: t.radius.md,
                                  border: '1px solid ' + (isSelected ? t.colors.primary : t.colors.border.default),
                                  transition: t.transition,
                                }}><div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <AvatarDisplay address={s.hunter} size={28} />
                                    <div>
                                      <div style={{ fontSize: '12px', fontWeight: 500, color: t.colors.text.primary }}><HunterName address={s.hunter} /></div>
                                      <div style={{ display: 'flex', gap: '5px', marginTop: '2px' }}>
                                        <Badge type={['pending', 'approved', 'rejected'][subStatus]} label={['Pending', 'Approved', 'Rejected'][subStatus]} />
                                        {s.disputed && <Badge type="disputed" label="Disputed" />}
                                      </div>
                                    </div>
                                  </div>
                                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                    {subStatus === 0 && (
                                      <>
                                        <Button
                                          size="sm"
                                          variant={isSelected ? 'primary' : 'secondary'}
                                          icon={isSelected ? <IconCheck size={12} /> : null}
                                          onClick={() => setSelected(p => {
                                            const prev = p[b._id] || [];
                                            return { ...p, [b._id]: isSelected ? prev.filter(x => x !== String(s.id)) : [...prev, String(s.id)] };
                                          })}
                                        >
                                          {isSelected ? 'Selected' : 'Select'}
                                        </Button>
                                        <Button
                                          size="sm"
                                          variant="danger"
                                          loading={rejecting.has(b._id + ':' + String(s.id))}
                                          onClick={() => handleReject(b._id, String(s.id))}
                                        >
                                          Reject
                                        </Button>
                                      </>
                                    )}
                                  </div>
                                </div>
                                {s.ipfsHash && (
                                  <div style={{ marginTop: '10px' }}>
                                    <SubmissionViewer ipfsHash={s.ipfsHash} hunter={s.hunter} compact />
                                  </div>
                                )}
                                </div>
                              );
                            })}
                          </div>

                          {selForBounty.length > 0 && (
                            <div style={{ marginTop: '12px', padding: '10px 14px', background: 'rgba(124,58,237,0.08)', borderRadius: t.radius.md, border: '1px solid rgba(124,58,237,0.2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                              <span style={{ fontSize: '12px', color: '#818cf8' }}>
                                {selForBounty.length} of up to {Number(b.winnerCount)} winner{Number(b.winnerCount) > 1 ? 's' : ''} selected
                                {selForBounty.length < Number(b.winnerCount) && ' — prize redistributed equally'}
                              </span>
                              <Button loading={approving === b._id}
                                disabled={selForBounty.length < 1}
                                onClick={() => handleApprove(b._id, b.winnerCount)}>
                                Release Funds
                              </Button>
                            </div>
                          )}
                        </div>
                      )}
                    </Card>
                  );
                })}
              </div>
            )
          }
        </motion.div>
      </div>
    </div>
  );
}
