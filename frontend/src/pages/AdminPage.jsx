import { useState, useEffect, useCallback } from 'react';
import { useAccount, useWalletClient } from 'wagmi';
import { theme } from '../styles/theme';
import Button from '../components/common/Button';
import EmptyState from '../components/common/EmptyState';
import { IconBounties, IconChevronUp, IconChevronDown, IconExternalLink } from '../components/icons';
import Modal from '../components/common/Modal';
import { PageLoader } from '../components/common/Spinner';
import { useBounties } from '../hooks/useBounties';
import { getContract, getReadContractWithFallback } from '../utils/ethers';
import { ADDRESSES, FACTORY_ABI, REGISTRY_ABI } from '../config/contracts';
import { fetchJSON, GATEWAY } from '../config/pinata';
import { toast } from '../utils/toast';
import { requestNotificationRefresh } from '../hooks/useNotifications';

const ADMIN_WALLETS = (import.meta.env.VITE_ADMIN_WALLETS || '')
  .split(',')
  .map((a) => a.trim().toLowerCase())
  .filter(Boolean);

function shortenAddr(addr) {
  if (!addr) return '—';
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function formatMon(wei) {
  if (wei == null) return '0';
  return (Number(wei) / 1e18).toFixed(2).replace(/\.?0+$/, '') || '0';
}

function formatRaisedAt(rejectedAt) {
  if (!rejectedAt || rejectedAt === 0n) return '—';
  const ms = Number(rejectedAt) * 1000;
  const now = Date.now();
  const diff = now - ms;
  if (diff < 60_000) return 'Just now';
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86400_000) return `${Math.floor(diff / 3600_000)}h ago`;
  return new Date(ms).toLocaleDateString();
}

function AddrLink({ addr, short }) {
  if (!addr) return <span>—</span>;
  return (
    <a
      href={`#/profile/${addr}`}
      onClick={(e) => {
        e.preventDefault();
        window.location.hash = `#/profile/${addr}`;
      }}
      style={{
        fontFamily: theme.fonts.mono,
        fontSize: 11,
        color: theme.colors.primary,
        textDecoration: 'none',
      }}
      onMouseEnter={(e) => (e.currentTarget.style.textDecoration = 'underline')}
      onMouseLeave={(e) => (e.currentTarget.style.textDecoration = 'none')}
      title={addr}
    >
      {short ? shortenAddr(addr) : addr}
    </a>
  );
}

export default function AdminPage() {
  const { address, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  const { bounties, loading, refetch } = useBounties({ status: 'disputed' });
  const [disputeInfo, setDisputeInfo] = useState({}); // bountyId -> { disputingBuilder, submissionId, rejectedAt, submissionIpfsHash }
  const [expandedId, setExpandedId] = useState(null); // bountyId of expanded investigate panel
  const [investigateMeta, setInvestigateMeta] = useState({}); // bountyId -> { bountyMeta, subMeta }
  const [resolving, setResolving] = useState(null);
  const [confirmResolve, setConfirmResolve] = useState(null);
  const [factoryOwner, setFactoryOwner] = useState(null);

  const isAdmin = address && ADMIN_WALLETS.includes(address.toLowerCase());
  const isFactoryOwner = address && factoryOwner && address.toLowerCase() === factoryOwner.toLowerCase();

  const loadDisputeInfo = useCallback(async () => {
    if (!ADDRESSES.registry || !bounties.length) return;
    try {
      const reg = await getReadContractWithFallback(ADDRESSES.registry, REGISTRY_ABI);
      const entries = await Promise.all(
        bounties.map(async (b) => {
          const subs = await reg.getBountySubmissions(BigInt(b.id)).catch(() => []);
          const disputedSub = (subs ?? []).find((s) => s.disputed === true);
          return [
            String(b.id),
            disputedSub
              ? {
                  disputingBuilder: disputedSub.builder,
                  submissionId: disputedSub.id,
                  rejectedAt: disputedSub.rejectedAt,
                  submissionIpfsHash: disputedSub.ipfsHash,
                }
              : null,
          ];
        })
      );
      setDisputeInfo(Object.fromEntries(entries));
    } catch (err) {
      console.error('[AdminPage] loadDisputeInfo', err);
      toast('Failed to load dispute info', 'error');
    }
  }, [bounties]);

  useEffect(() => {
    loadDisputeInfo();
  }, [loadDisputeInfo]);

  useEffect(() => {
    if (!ADDRESSES.factory) {
      setFactoryOwner(null);
      return;
    }
    let cancelled = false;
    const load = async () => {
      try {
        const factory = await getReadContractWithFallback(ADDRESSES.factory, FACTORY_ABI);
        const owner = await factory.owner();
        if (!cancelled) setFactoryOwner(owner);
      } catch (err) {
        console.error('[AdminPage] loadFactoryOwner', err);
        if (!cancelled) setFactoryOwner(null);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [address, ADDRESSES.factory]);

  // Load bounty + submission metadata when Investigate panel is expanded
  useEffect(() => {
    if (!expandedId) {
      setInvestigateMeta({});
      return;
    }
    const bounty = bounties.find((b) => String(b.id) === String(expandedId));
    if (!bounty) return;

    let cancelled = false;
    const load = async () => {
      const result = { bountyMeta: null, subMeta: null };
      try {
        if (bounty.ipfsHash) {
          const m = await fetchJSON(bounty.ipfsHash);
          if (!cancelled) result.bountyMeta = m;
        }
        const info = disputeInfo[expandedId];
        if (info?.submissionIpfsHash) {
          const s = await fetchJSON(info.submissionIpfsHash);
          if (!cancelled) result.subMeta = s;
        }
      } catch {}
      if (!cancelled) setInvestigateMeta((prev) => ({ ...prev, [expandedId]: result }));
    };
    load();
    return () => { cancelled = true; };
  }, [expandedId, bounties, disputeInfo]);

  const handleResolve = async () => {
    if (!confirmResolve) return;
    const { bountyId, inFavorOfBuilders } = confirmResolve;
    setConfirmResolve(null); // close modal
    if (!isFactoryOwner) {
      toast('Only the BountyFactory owner can resolve disputes.', 'error');
      return;
    }
    const info = disputeInfo[bountyId];
    const disputingBuilder = info?.disputingBuilder;
    if (!disputingBuilder || disputingBuilder === '0x0000000000000000000000000000000000000000') {
      toast('No valid disputing builder found for this bounty', 'error');
      return;
    }
    if (!walletClient || !ADDRESSES.factory) {
      toast('Connect wallet or check contract config', 'error');
      return;
    }
    const key = `${bountyId}-${inFavorOfBuilders ? 'builder' : 'creator'}`;
    setResolving(key);
    try {
      const factory = await getContract(ADDRESSES.factory, FACTORY_ABI, walletClient);
      const tx = await factory.resolveDispute(BigInt(bountyId), inFavorOfBuilders, disputingBuilder);
      await tx.wait();
      requestNotificationRefresh();
      toast(
        inFavorOfBuilders ? 'Resolved in favor of builder(s).' : 'Resolved in favor of creator.',
        'success'
      );
      refetch();
      setDisputeInfo((prev) => {
        const next = { ...prev };
        delete next[bountyId];
        return next;
      });
    } catch (err) {
      toast(err.reason || err.shortMessage || err.message || 'Transaction failed', 'error');
    } finally {
      setResolving(null);
    }
  };

  if (!isConnected) {
    return (
      <div
        style={{
          maxWidth: 600,
          margin: '0 auto',
          padding: 'clamp(64px,10vh,120px) 24px',
          textAlign: 'center',
        }}
      >
        <div style={{ fontSize: 32, marginBottom: 20 }}>◎</div>
        <h2
          style={{
            fontFamily: theme.fonts.body,
            fontWeight: 700,
            fontSize: 22,
            letterSpacing: '-0.03em',
            color: theme.colors.text.primary,
            marginBottom: 10,
          }}
        >
          Connect your wallet
        </h2>
        <p style={{ fontSize: 13, color: theme.colors.text.muted, fontWeight: 300 }}>
          Connect wallet to access Admin Dashboard.
        </p>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div
        style={{
          maxWidth: 600,
          margin: '0 auto',
          padding: 'clamp(64px,10vh,120px) 24px',
          textAlign: 'center',
        }}
      >
        <div style={{ fontSize: 32, marginBottom: 20, color: theme.colors.red[400] }}>⛔</div>
        <h2
          style={{
            fontFamily: theme.fonts.body,
            fontWeight: 700,
            fontSize: 22,
            letterSpacing: '-0.03em',
            color: theme.colors.text.primary,
            marginBottom: 10,
          }}
        >
          Access denied
        </h2>
        <p style={{ fontSize: 13, color: theme.colors.text.muted, fontWeight: 300 }}>
          Your wallet is not in the admin list. Only BountyFactory owner can resolve disputes.
        </p>
      </div>
    );
  }

  if (loading) return <PageLoader />;

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: 'clamp(32px,5vw,64px) clamp(16px,4vw,48px)' }}>
      {/* Header */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', justifyContent: 'space-between', gap: 20, marginBottom: 28 }}>
        <div>
          <div
            style={{
              fontFamily: theme.fonts.mono,
              fontSize: 9.5,
              color: theme.colors.text.faint,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              marginBottom: 8,
            }}
          >
            Admin
          </div>
          <h1
            style={{
              fontFamily: theme.fonts.body,
              fontWeight: 800,
              fontSize: 'clamp(24px,4vw,32px)',
              letterSpacing: '-0.04em',
              color: theme.colors.text.primary,
            }}
          >
            Dispute Resolution
          </h1>
          <p style={{ fontFamily: theme.fonts.body, fontSize: 13, color: theme.colors.text.muted, marginTop: 8 }}>
            Resolve disputed bounties. Only the BountyFactory owner can perform these actions.
          </p>
          {/* SOP / Investigation guidance */}
          <div
            style={{
              marginTop: 20,
              padding: '14px 18px',
              background: theme.colors.bg.elevated,
              border: `1px solid ${theme.colors.border.subtle}`,
              borderRadius: theme.radius.lg,
              fontSize: 12,
              color: theme.colors.text.secondary,
              lineHeight: 1.7,
            }}
          >
            <div style={{ fontWeight: 600, color: theme.colors.text.primary, marginBottom: 8 }}>How to investigate</div>
            <ol style={{ margin: 0, paddingLeft: 18 }}>
              <li>Click <strong>Investigate</strong> to view bounty requirements and builder&apos;s deliverables inline.</li>
              <li>Or use <strong>View Bounty</strong> to open the full bounty page and review submissions there.</li>
              <li>Use <strong>View Submission (IPFS)</strong> to open the disputed work in a new tab.</li>
              <li>Check if the builder&apos;s deliverables meet the bounty requirements. Contact parties via Discord if needed.</li>
              <li><strong>Favor Builder</strong> if the rejection was unfair (deliverables met requirements). Builder gets reward + stake refund; creator stake may be slashed.</li>
              <li><strong>Favor Creator</strong> if the rejection was justified (deliverables did not meet requirements). Builder stake is slashed.</li>
            </ol>
          </div>
        </div>
        {/* Stats + Refresh */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexShrink: 0 }}>
          <div
            style={{
              padding: '12px 18px',
              background: theme.colors.bg.card,
              border: `1px solid ${theme.colors.border.subtle}`,
              borderRadius: theme.radius.lg,
            }}
          >
            <span style={{ fontFamily: theme.fonts.mono, fontSize: 10, color: theme.colors.text.faint, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Disputed</span>
            <div style={{ fontFamily: theme.fonts.mono, fontSize: 22, fontWeight: 600, color: theme.colors.amber, marginTop: 2 }}>{bounties.length}</div>
          </div>
          <Button variant="secondary" size="sm" onClick={refetch} loading={loading}>
            Refresh
          </Button>
        </div>
      </div>

      {bounties.length === 0 ? (
        <EmptyState
          icon={<IconBounties size={32} color={theme.colors.text.faint} />}
          title="No disputed bounties"
          message="There are no bounties currently in dispute."
        />
      ) : (
        <div
          style={{
            background: theme.colors.bg.card,
            border: `1px solid ${theme.colors.border.subtle}`,
            borderRadius: theme.radius.lg,
            overflow: 'hidden',
          }}
        >
          <div
            className="admin-table-header"
            style={{
              display: 'grid',
              gridTemplateColumns: '50px 1fr 85px 90px 90px 80px minmax(200px, auto)',
              gap: 12,
              padding: '14px 18px',
              borderBottom: `1px solid ${theme.colors.border.subtle}`,
              fontFamily: theme.fonts.mono,
              fontSize: 9.5,
              color: theme.colors.text.faint,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              alignItems: 'center',
            }}
          >
            <span>ID</span>
            <span>Title</span>
            <span>Reward</span>
            <span>Creator</span>
            <span>Builder</span>
            <span>Raised</span>
            <span>Actions</span>
          </div>
          {bounties.map((b) => {
            const info = disputeInfo[String(b.id)];
            const disputingBuilder = info?.disputingBuilder;
            const rejectedAt = info?.rejectedAt;
            const subIpfs = info?.submissionIpfsHash;
            const canResolve = isFactoryOwner && disputingBuilder && disputingBuilder !== '0x0000000000000000000000000000000000000000';
            const isResolving =
              resolving === `${b.id}-builder` || resolving === `${b.id}-creator`;
            const bountyTitle = b.title || `Bounty #${b.id}`;
            const isExpanded = expandedId === String(b.id);
            const meta = investigateMeta[String(b.id)];

            return (
              <div key={b.id} style={{ borderBottom: `1px solid ${theme.colors.border.faint}` }}>
                <div
                  className="admin-table-row"
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '50px 1fr 85px 90px 90px 80px minmax(260px, auto)',
                    gap: 12,
                    padding: '14px 18px',
                    alignItems: 'center',
                    fontFamily: theme.fonts.body,
                    fontSize: 13,
                    background: theme.colors.bg.card,
                    transition: theme.transition,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = theme.colors.bg.elevated;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = theme.colors.bg.card;
                  }}
                >
                  <span style={{ fontFamily: theme.fonts.mono, color: theme.colors.text.secondary, fontSize: 12 }}>
                    #{b.id}
                  </span>
                  <a
                    href={`#/bounty/${b.id}`}
                    onClick={(e) => {
                      e.preventDefault();
                      window.location.hash = `#/bounty/${b.id}`;
                    }}
                    style={{
                      color: theme.colors.primary,
                      textDecoration: 'none',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      fontSize: 13,
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.textDecoration = 'underline')}
                    onMouseLeave={(e) => (e.currentTarget.style.textDecoration = 'none')}
                    title={bountyTitle}
                  >
                    {bountyTitle}
                  </a>
                  <span style={{ fontFamily: theme.fonts.mono, fontSize: 12, color: theme.colors.primary }}>
                    {formatMon(b.totalReward)} MON
                  </span>
                  <span><AddrLink addr={b.creator} short /></span>
                  <span><AddrLink addr={disputingBuilder} short /></span>
                  <span style={{ fontFamily: theme.fonts.mono, fontSize: 11, color: theme.colors.text.faint }}>
                    {formatRaisedAt(rejectedAt)}
                  </span>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setExpandedId(isExpanded ? null : String(b.id))}
                    >
                      {isExpanded ? <><IconChevronUp size={12} style={{ marginRight: 4, verticalAlign: 'middle' }} /> Hide</> : <><IconChevronDown size={12} style={{ marginRight: 4, verticalAlign: 'middle' }} /> Investigate</>}
                    </Button>
                    <a
                      href={`#/bounty/${b.id}`}
                      onClick={(e) => { e.preventDefault(); window.location.hash = `#/bounty/${b.id}`; }}
                      style={{ fontSize: 11, color: theme.colors.primary, textDecoration: 'none' }}
                    >
                      View Bounty <IconExternalLink size={10} color={theme.colors.primary} style={{ marginLeft: 4, verticalAlign: 'middle' }} />
                    </a>
                    {subIpfs && (
                      <a
                        href={GATEWAY + subIpfs}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ fontSize: 11, color: theme.colors.primary, textDecoration: 'none' }}
                      >
                        Submission IPFS ↗
                      </a>
                    )}
                    <Button
                      variant="success"
                      size="sm"
                      disabled={!canResolve || isResolving}
                      loading={resolving === `${b.id}-builder`}
                      onClick={() => setConfirmResolve({ bountyId: b.id, inFavorOfBuilders: true, bountyTitle })}
                    >
                      Favor Builder
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      disabled={!canResolve || isResolving}
                      loading={resolving === `${b.id}-creator`}
                      onClick={() => setConfirmResolve({ bountyId: b.id, inFavorOfBuilders: false, bountyTitle })}
                    >
                      Favor Creator
                    </Button>
                  </div>
                </div>

                {/* Expanded Investigate panel */}
                {isExpanded && (
                  <div
                    className="admin-investigate-panel"
                    style={{
                      padding: '18px 22px 22px',
                      background: theme.colors.bg.elevated,
                      borderTop: `1px solid ${theme.colors.border.faint}`,
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      gap: 24,
                      alignItems: 'start',
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 10, fontWeight: 600, color: theme.colors.text.faint, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10 }}>
                        Bounty requirements
                      </div>
                      {meta?.bountyMeta ? (
                        <div style={{ fontSize: 12, color: theme.colors.text.secondary, lineHeight: 1.7 }}>
                          {meta.bountyMeta.fullDescription || meta.bountyMeta.description ? (
                            <div style={{ whiteSpace: 'pre-wrap', maxHeight: 200, overflowY: 'auto' }}>
                              {meta.bountyMeta.fullDescription || meta.bountyMeta.description}
                            </div>
                          ) : (
                            <span style={{ color: theme.colors.text.muted }}>No description</span>
                          )}
                          {meta.bountyMeta.evaluationCriteria?.length > 0 && (
                            <div style={{ marginTop: 12 }}>
                              <div style={{ fontWeight: 600, marginBottom: 6 }}>Evaluation criteria</div>
                              <ul style={{ margin: 0, paddingLeft: 18 }}>
                                {meta.bountyMeta.evaluationCriteria.map((c, i) => (
                                  <li key={i}>{c}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div style={{ fontSize: 12, color: theme.colors.text.muted }}>Loading…</div>
                      )}
                    </div>
                    <div>
                      <div style={{ fontSize: 10, fontWeight: 600, color: theme.colors.text.faint, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10 }}>
                        Builder&apos;s submission
                      </div>
                      {meta?.subMeta ? (
                        <div style={{ fontSize: 12, color: theme.colors.text.secondary, lineHeight: 1.7 }}>
                          {meta.subMeta.title && (
                            <div style={{ fontWeight: 600, color: theme.colors.text.primary, marginBottom: 8 }}>{meta.subMeta.title}</div>
                          )}
                          {meta.subMeta.description ? (
                            <div style={{ whiteSpace: 'pre-wrap', maxHeight: 120, overflowY: 'auto', marginBottom: 10 }}>
                              {meta.subMeta.description}
                            </div>
                          ) : null}
                          {meta.subMeta.deliverables?.length > 0 && (
                            <div>
                              <div style={{ fontWeight: 600, marginBottom: 6 }}>Deliverables</div>
                              {meta.subMeta.deliverables.map((d, i) => (
                                <a
                                  key={i}
                                  href={d.value || d.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  style={{ display: 'block', fontSize: 11, color: theme.colors.primary, marginBottom: 4 }}
                                >
                                  {d.label || 'Link'} ↗
                                </a>
                              ))}
                            </div>
                          )}
                          {!meta.subMeta.description && !meta.subMeta.deliverables?.length && (
                            <span style={{ color: theme.colors.text.muted }}>No content. </span>
                          )}
                          <a href={GATEWAY + subIpfs} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: theme.colors.primary, marginTop: 8, display: 'inline-block' }}>
                            Open raw JSON on IPFS ↗
                          </a>
                        </div>
                      ) : (
                        <div style={{ fontSize: 12, color: theme.colors.text.muted }}>Loading…</div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Confirmation modal */}
      <Modal
        open={!!confirmResolve}
        onClose={() => setConfirmResolve(null)}
        title="Confirm resolution"
      >
        {confirmResolve && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <p style={{ fontFamily: theme.fonts.body, fontSize: 14, color: theme.colors.text.secondary, lineHeight: 1.6 }}>
              {confirmResolve.inFavorOfBuilders ? (
                <>
                  <strong style={{ color: theme.colors.green[400] }}>Resolve in favor of Builder</strong> — Builder will receive reward and stake refund. Creator stake may be slashed.
                </>
              ) : (
                <>
                  <strong style={{ color: theme.colors.red[400] }}>Resolve in favor of Creator</strong> — Builder&apos;s submission stake will be slashed. Creator keeps control.
                </>
              )}
            </p>
            <p style={{ fontFamily: theme.fonts.body, fontSize: 12, color: theme.colors.text.muted }}>
              Bounty: {confirmResolve.bountyTitle}
            </p>
            <p style={{ fontFamily: theme.fonts.mono, fontSize: 11, color: theme.colors.text.faint }}>
              This action is irreversible.
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
              <Button variant="secondary" size="sm" onClick={() => setConfirmResolve(null)}>
                Cancel
              </Button>
              <Button
                variant={confirmResolve.inFavorOfBuilders ? 'success' : 'danger'}
                size="sm"
                onClick={() => handleResolve()}
              >
                Confirm
              </Button>
            </div>
          </div>
        )}
      </Modal>

      <style>{`
        @media (max-width: 900px) {
          .admin-table-header { display: none !important; }
          .admin-table-row {
            display: grid !important;
            grid-template-columns: 1fr !important;
            gap: 8 !important;
            padding: 16px !important;
          }
          .admin-table-row > *:nth-child(1) { grid-column: 1; font-size: 11px !important; }
          .admin-table-row > *:nth-child(2) { grid-column: 1; font-weight: 600; }
          .admin-table-row > *:nth-child(3) { grid-column: 1; }
          .admin-table-row > *:nth-child(4) { grid-column: 1; }
          .admin-table-row > *:nth-child(5) { grid-column: 1; }
          .admin-table-row > *:nth-child(6) { grid-column: 1; }
          .admin-table-row > *:nth-child(7) { grid-column: 1; margin-top: 8px; padding-top: 12px; border-top: 1px solid var(--border-faint, #1e1e1e); }
        }
        @media (max-width: 640px) {
          .admin-investigate-panel {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}
