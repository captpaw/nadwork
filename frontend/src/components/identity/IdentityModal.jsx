import React, { useState, useCallback, useEffect, useRef } from 'react';
import Modal from '@/components/common/Modal.jsx';
import { theme as t } from '@/styles/theme.js';
import { useIdentity, useIdentityWrite, invalidateIdentityCache } from '@/hooks/useIdentity.js';
import { getReadContractWithFallback } from '@/utils/ethers.js';
import { ADDRESSES, IDENTITY_ABI } from '@/config/contracts.js';
import { shortAddr } from '@/utils/format.js';
import { useWalletClient } from 'wagmi';
import { AvatarSection } from '@/components/common/Avatar.jsx';

// ─── Atoms ───────────────────────────────────────────────────────────────────

function Label({ children }) {
  return (
    <div style={{
      fontSize: '11px', fontWeight: 600, color: t.colors.text.muted,
      letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '8px',
    }}>
      {children}
    </div>
  );
}

function StatusMsg({ type, children }) {
  const colors = { error: '#f87171', success: '#4ade80', info: '#94a3b8', warn: '#fbbf24' };
  return (
    <div style={{ fontSize: '12px', color: colors[type] || colors.info, marginTop: '6px', lineHeight: 1.5 }}>
      {children}
    </div>
  );
}

function Btn({ onClick, disabled, loading, children, variant = 'primary', fullWidth = false, size = 'md' }) {
  const isD = disabled || loading;
  const pad = size === 'sm' ? '6px 14px' : '9px 18px';
  const vs = {
    primary: { bg: isD ? 'rgba(124,58,237,0.08)'  : 'rgba(124,58,237,0.18)',  bd: isD ? t.colors.border.default : 'rgba(124,58,237,0.45)',  c: isD ? t.colors.text.muted : '#c7d2fe' },
    danger:  { bg: isD ? 'rgba(239,68,68,0.06)'   : 'rgba(239,68,68,0.13)',   bd: isD ? t.colors.border.default : 'rgba(239,68,68,0.35)',   c: isD ? t.colors.text.muted : '#fca5a5' },
    ghost:   { bg: 'transparent',                                               bd: 'transparent',                                            c: isD ? t.colors.text.muted : '#818cf8' },
    success: { bg: isD ? 'rgba(52,211,153,0.06)'  : 'rgba(52,211,153,0.12)',  bd: isD ? t.colors.border.default : 'rgba(52,211,153,0.35)',  c: isD ? t.colors.text.muted : '#34d399' },
  };
  const s = vs[variant] || vs.primary;
  return (
    <button onClick={onClick} disabled={isD} style={{
      padding: pad, borderRadius: t.radius.md,
      background: s.bg, border: `1px solid ${s.bd}`, color: s.c,
      fontSize: '13px', fontWeight: 500,
      cursor: isD ? 'not-allowed' : 'pointer',
      transition: t.transition, whiteSpace: 'nowrap',
      width: fullWidth ? '100%' : undefined,
    }}>
      {loading ? 'Processing…' : children}
    </button>
  );
}

function Card({ children, tint = 'default', style = {} }) {
  const tints = {
    default: { bg: 'rgba(255,255,255,0.02)',    bd: t.colors.border.subtle },
    indigo:  { bg: 'rgba(124,58,237,0.05)',     bd: 'rgba(124,58,237,0.18)' },
    green:   { bg: 'rgba(52,211,153,0.05)',     bd: 'rgba(52,211,153,0.2)'  },
    amber:   { bg: 'rgba(251,191,36,0.05)',     bd: 'rgba(251,191,36,0.25)' },
    red:     { bg: 'rgba(239,68,68,0.05)',      bd: 'rgba(239,68,68,0.2)'   },
  };
  const s = tints[tint] || tints.default;
  return (
    <div style={{ background: s.bg, border: `1px solid ${s.bd}`, borderRadius: t.radius.md, padding: '14px 16px', ...style }}>
      {children}
    </div>
  );
}

function WalletPill({ address, label, color = '#818cf8' }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '3px 10px', background: 'rgba(124,58,237,0.1)', border: '1px solid rgba(124,58,237,0.25)', borderRadius: '99px' }}>
      <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: color, flexShrink: 0 }} />
      <span style={{ fontFamily: t.fonts.mono, fontSize: '12px', color }}>{label || shortAddr(address)}</span>
    </span>
  );
}

// ─── Progress bar for the 2-step flow ────────────────────────────────────────

function StepProgress({ step, total = 2 }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
      {Array.from({ length: total }, (_, i) => {
        const done    = i + 1 < step;
        const active  = i + 1 === step;
        return (
          <React.Fragment key={i}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{
                width: '24px', height: '24px', borderRadius: '50%', flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '11px', fontWeight: 700,
                background: done   ? 'rgba(52,211,153,0.15)'  : active ? 'rgba(124,58,237,0.2)'  : 'rgba(255,255,255,0.04)',
                border:     done   ? '1px solid rgba(52,211,153,0.4)' : active ? '1px solid rgba(124,58,237,0.5)' : '1px solid ' + t.colors.border.subtle,
                color:      done   ? '#34d399' : active ? '#a5b4fc' : t.colors.text.muted,
              }}>
                {done ? '✓' : i + 1}
              </div>
              <span style={{ fontSize: '11px', fontWeight: active ? 600 : 400, color: active ? t.colors.text.secondary : t.colors.text.muted }}>
                {i === 0 ? 'Propose' : 'Confirm'}
              </span>
            </div>
            {i < total - 1 && (
              <div style={{ flex: 1, height: '2px', borderRadius: '1px', background: done ? 'rgba(52,211,153,0.3)' : t.colors.border.subtle }} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

function isValidAddr(v) {
  return typeof v === 'string' && /^0x[0-9a-fA-F]{40}$/.test(v);
}

// ─── Username Section ─────────────────────────────────────────────────────────

function UsernameSection({ currentUsername, address, identityLoading, onSuccess }) {
  const { data: walletClient } = useWalletClient();
  const { setUsername, busy, txError } = useIdentityWrite(walletClient);
  const [input, setInput]         = useState('');
  const [avail, setAvail]         = useState(null);
  const [confirmed, setConfirmed] = useState(false);
  const debounceRef               = useRef(null);

  const checkAvail = useCallback(async (val, addr) => {
    if (!val || val.length < 3) { setAvail(val?.length > 0 ? 'short' : null); return; }
    setAvail('checking');
    try {
      const c = await getReadContractWithFallback(ADDRESSES.identity, IDENTITY_ABI);
      const [ok, holder] = await Promise.all([
        c.isUsernameAvailable(val, addr || '0x0000000000000000000000000000000000000000'),
        c.resolveUsername(val),
      ]);
      if (ok) setAvail('available');
      else if (holder && holder !== '0x0000000000000000000000000000000000000000') setAvail('taken');
      else setAvail('already_has');
    } catch { setAvail('invalid'); }
  }, []);

  const handleChange = (e) => {
    const val = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '');
    setInput(val); setConfirmed(false);
    clearTimeout(debounceRef.current);
    if (!val) return setAvail(null);
    if (val.length < 3) return setAvail('short');
    debounceRef.current = setTimeout(() => checkAvail(val, address), 500);
  };

  const handleClaim = async () => {
    if (!confirmed || avail !== 'available') return;
    try { await setUsername(input.trim(), address); onSuccess?.(); } catch {}
  };

  if (identityLoading) return (
    <div>
      <Label>Username</Label>
      <div style={{ height: '46px', borderRadius: t.radius.md, background: 'rgba(255,255,255,0.03)', border: '1px solid ' + t.colors.border.subtle }} />
    </div>
  );

  if (currentUsername) return (
    <div>
      <Label>Username</Label>
      <Card tint="green">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '18px' }}>🔒</span>
          <div>
            <div style={{ fontFamily: t.fonts.mono, fontSize: '15px', fontWeight: 700, color: t.colors.text.primary }}>@{currentUsername}</div>
            <div style={{ fontSize: '11px', color: t.colors.text.muted, marginTop: '1px' }}>Permanent — cannot be changed.</div>
          </div>
        </div>
      </Card>
    </div>
  );

  return (
    <div>
      <Label>Claim Username</Label>
      <Card tint="amber" style={{ marginBottom: '12px' }}>
        <div style={{ fontSize: '12px', color: '#fbbf24', lineHeight: 1.6 }}>
          <strong>⚠ Permanent choice.</strong> Once claimed, your username cannot be changed or removed.
          Your reputation will be tied to this name forever. Use 3–32 chars: lowercase letters, numbers, hyphens only.
        </div>
      </Card>

      <input value={input} onChange={handleChange} maxLength={32} placeholder="e.g. alice-dev"
        style={{
          width: '100%', padding: '9px 12px', boxSizing: 'border-box', marginBottom: '6px',
          background: t.colors.bg.input || 'rgba(255,255,255,0.04)',
          border: '1px solid ' + (avail === 'available' ? '#4ade80' : avail === 'taken' || avail === 'already_has' || avail === 'invalid' ? '#f87171' : t.colors.border.default),
          borderRadius: t.radius.md, color: t.colors.text.primary,
          fontSize: '13px', outline: 'none', fontFamily: t.fonts.mono,
        }}
      />

      {avail === 'short'       && <StatusMsg type="info">At least 3 characters required</StatusMsg>}
      {avail === 'checking'    && <StatusMsg type="info">Checking…</StatusMsg>}
      {avail === 'available'   && <StatusMsg type="success">"{input}" is available ✓</StatusMsg>}
      {avail === 'taken'       && <StatusMsg type="error">"{input}" is already taken</StatusMsg>}
      {avail === 'already_has' && <StatusMsg type="error">This wallet already has a username. Refresh to see it.</StatusMsg>}
      {avail === 'invalid'     && <StatusMsg type="error">Invalid — use a-z, 0-9, hyphens only</StatusMsg>}
      {txError                 && <StatusMsg type="error">{txError}</StatusMsg>}

      {avail === 'available' && (
        <>
          <label style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', marginTop: '12px', cursor: 'pointer', fontSize: '12px', color: t.colors.text.secondary, lineHeight: 1.5 }}>
            <input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)}
              style={{ marginTop: '2px', accentColor: '#a78bfa', flexShrink: 0 }} />
            I understand <strong style={{ color: t.colors.text.primary, marginLeft: '4px' }}>@{input}</strong> will be my permanent username on NadWork.
          </label>
          <div style={{ marginTop: '10px' }}>
            <Btn onClick={handleClaim} disabled={!confirmed || !input || busy} loading={busy} fullWidth>
              Claim @{input}
            </Btn>
          </div>
        </>
      )}
    </div>
  );
}

// ─── State B: Pending Confirm Component ──────────────────────────────────────
// Shown when primary wallet has a pending proposal.
// Key insight: we CANNOT reliably detect wallet switches in non-MetaMask wallets
// (like Haha Wallet). So we provide TWO paths:
//   Path 1 (auto): if Wagmi detects wallet switch → BackupWalletSection re-renders
//                  with new myAddress → loadPendingState finds invitedBy → State C shown
//   Path 2 (manual): user already switched wallet → clicks "I've switched wallet"
//                    → enters primary address → we verify + confirm in-page

function StateBPendingConfirm({ pendingFor, myAddress, onCancel, busy, txError, onClose }) {
  return (
    <div>
      <Label>Backup Wallet</Label>
      <StepProgress step={2} />

      {/* Step 1 done */}
      <Card tint="green" style={{ marginBottom: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ color: '#34d399' }}>✓</span>
          <div>
            <div style={{ fontSize: '12px', fontWeight: 600, color: '#34d399' }}>Proposal sent to backup wallet</div>
            <WalletPill address={pendingFor} color="#34d399" />
          </div>
        </div>
      </Card>

      {/* Step 2 instructions */}
      <Card tint="indigo" style={{ marginBottom: '12px' }}>
        <div style={{ fontSize: '12px', fontWeight: 600, color: '#a5b4fc', marginBottom: '12px' }}>
          Step 2 — Confirm from your backup wallet
        </div>

        {/* Numbered steps */}
        {[
          { n: '1', text: <>In your wallet app, <strong style={{ color: t.colors.text.secondary }}>disconnect</strong> your current wallet and <strong style={{ color: t.colors.text.secondary }}>connect</strong> with <strong style={{ fontFamily: t.fonts.mono, color: '#a5b4fc' }}>{shortAddr(pendingFor)}</strong>.</> },
          { n: '2', text: <>Click <strong style={{ color: t.colors.text.secondary }}>"Close & Switch Wallet"</strong> below to close this dialog.</> },
          { n: '3', text: <>Re-open <strong style={{ color: t.colors.text.secondary }}>Identity Settings</strong> from your Profile page — a one-click confirmation button will appear automatically.</> },
        ].map(({ n, text }) => (
          <div key={n} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', marginBottom: '10px' }}>
            <div style={{
              width: '20px', height: '20px', borderRadius: '50%', flexShrink: 0,
              background: 'rgba(124,58,237,0.2)', border: '1px solid rgba(124,58,237,0.4)',
              color: '#a5b4fc', fontSize: '11px', fontWeight: 700,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>{n}</div>
            <div style={{ fontSize: '12px', color: t.colors.text.muted, lineHeight: 1.6, paddingTop: '2px' }}>{text}</div>
          </div>
        ))}

        <Btn onClick={onClose} variant="success" fullWidth>
          Close & Switch Wallet →
        </Btn>

        <div style={{ marginTop: '10px', padding: '8px 10px', background: 'rgba(124,58,237,0.06)', borderRadius: t.radius.sm, display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
          <span style={{ fontSize: '14px', flexShrink: 0 }}>💡</span>
          <span style={{ fontSize: '11px', color: '#818cf8', lineHeight: 1.5 }}>
            This is a one-time setup. Once linked, your backup wallet is set permanently and this process won't be needed again.
          </span>
        </div>
      </Card>

      <div style={{ textAlign: 'right' }}>
        <Btn onClick={onCancel} disabled={busy} variant="ghost" size="sm">Cancel proposal</Btn>
      </div>
      {txError && <StatusMsg type="error">{txError}</StatusMsg>}
    </div>
  );
}

// ─── Backup Wallet Section ────────────────────────────────────────────────────
//
// Fully wallet-aware. On mount (and on every wallet switch), queries the chain:
//   • getPendingLink(myAddress)   → did THIS wallet propose someone? (outgoing)
//   • getIncomingProposal(myAddress) → did someone propose THIS wallet? (incoming)
//
// States rendered:
//   A. Primary, no backup, no pending → Step 1 propose form
//   B. Primary, outgoing pending       → "Waiting — switch wallet" + cancel
//   C. Fresh wallet, incoming proposal → AUTO-DETECTED confirmation screen
//   D. Primary, backup confirmed       → Green linked card + remove
//   E. Already a backup (primaryOf ≠ self) → Backup status + Emergency Recovery

const ZERO = '0x0000000000000000000000000000000000000000';

function BackupWalletSection({ linkedWallets, myAddress, primaryWallet, onSuccess, onClose }) {
  const { data: walletClient } = useWalletClient();
  const { proposeLink, cancelProposal, unlinkWallet, confirmLink, claimPrimary, busy, txError } =
    useIdentityWrite(walletClient);

  const [proposeAddr, setProposeAddr]             = useState('');
  const [pendingFor, setPendingFor]               = useState(null);
  const [invitedBy, setInvitedBy]                 = useState(null);
  const [loadingState, setLoadingState]           = useState(true);
  const [recoveryConfirmed, setRecoveryConfirmed] = useState(false);
  // On-chain derived state (queried fresh on each address change)
  const [onchainPrimary, setOnchainPrimary]       = useState(null);
  const [onchainLinked, setOnchainLinked]         = useState([]);

  // Use on-chain data directly (not stale parent props) for critical routing decisions
  const backupWallet  = onchainLinked[0] || null;
  const isThisABackup = !!onchainPrimary && onchainPrimary.toLowerCase() !== myAddress?.toLowerCase();
  const hasBackup     = !!backupWallet;

  // Reset all local state when the connected wallet changes
  const prevAddressRef = useRef(null);
  useEffect(() => {
    if (prevAddressRef.current !== myAddress) {
      prevAddressRef.current = myAddress;
      setProposeAddr('');
      setPendingFor(null);
      setInvitedBy(null);
      setRecoveryConfirmed(false);
      setLoadingState(true);
    }
  }, [myAddress]);

  // Load full wallet state directly from chain on every address change
  const loadPendingState = useCallback(async () => {
    if (!ADDRESSES.identity || !myAddress) { setLoadingState(false); return; }
    setLoadingState(true);
    try {
      const c = await getReadContractWithFallback(ADDRESSES.identity, IDENTITY_ABI);
      // Fetch identity, pending outgoing, and incoming proposal all at once
      const [identity, outgoing, incoming] = await Promise.all([
        c.getIdentity(myAddress).catch(() => null),
        c.getPendingLink(myAddress).catch(() => ZERO),
        c.getIncomingProposal(myAddress).catch(() => ZERO),
      ]);
      if (identity) {
        // identity[1] = primaryWallet, identity[2] = linkedWallets[]
        const primary = identity[1] || myAddress;
        const linked  = [...(identity[2] || [])];
        setOnchainPrimary(primary);
        setOnchainLinked(linked);
      } else {
        setOnchainPrimary(myAddress);
        setOnchainLinked([]);
      }
      setPendingFor(outgoing && outgoing !== ZERO ? outgoing : null);
      setInvitedBy (incoming && incoming !== ZERO ? incoming : null);
    } catch { /* ignore */ }
    setLoadingState(false);
  }, [myAddress]);

  useEffect(() => { loadPendingState(); }, [loadPendingState]);

  // ── Handlers ──
  const handlePropose = async () => {
    if (!isValidAddr(proposeAddr)) return;
    try {
      await proposeLink(proposeAddr.trim(), myAddress);
      setProposeAddr('');
      await loadPendingState();
      onSuccess?.();
    } catch {}
  };

  const handleCancel = async () => {
    try { await cancelProposal(myAddress); setPendingFor(null); onSuccess?.(); } catch {}
  };

  const handleRemove = async () => {
    try { await unlinkWallet(backupWallet, myAddress); onSuccess?.(); } catch {}
  };

  // Step 2 confirm — called from backup wallet, primary address is already known (invitedBy)
  const handleConfirm = async () => {
    if (!invitedBy) return;
    try {
      await confirmLink(invitedBy, myAddress);
      setInvitedBy(null);
      onSuccess?.();
    } catch {}
  };

  const handleClaimPrimary = async () => {
    if (!recoveryConfirmed || !isValidAddr(primaryWallet)) return;
    try {
      await claimPrimary(primaryWallet, myAddress);
      setRecoveryConfirmed(false);
      onSuccess?.();
    } catch {}
  };

  // Loading skeleton
  if (loadingState) {
    return (
      <div>
        <Label>Backup Wallet</Label>
        <div style={{ height: '80px', borderRadius: t.radius.md, background: 'rgba(255,255,255,0.02)', border: '1px solid ' + t.colors.border.subtle, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontSize: '12px', color: t.colors.text.muted }}>Checking wallet status…</span>
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════
  // STATE E — This connected wallet IS a backup (linked to another primary)
  // ══════════════════════════════════════════════════════════════════
  if (isThisABackup) {
    return (
      <div>
        <Label>Backup Wallet</Label>
        <Card tint="indigo">
          <div style={{ fontSize: '12px', color: '#818cf8', fontWeight: 600, marginBottom: '6px' }}>
            🔗 This wallet is a backup for:
          </div>
          <WalletPill address={primaryWallet} />
          <div style={{ fontSize: '12px', color: t.colors.text.muted, marginTop: '10px', lineHeight: 1.6 }}>
            If you lose access to the primary wallet, you can take over its identity here — username and reputation history will transfer to this wallet.
          </div>
        </Card>

        {/* Emergency Recovery */}
        <div style={{ marginTop: '14px' }}>
          <Label>Emergency Recovery</Label>
          <Card tint="red" style={{ marginBottom: '10px' }}>
            <div style={{ fontSize: '12px', color: '#fca5a5', lineHeight: 1.6 }}>
              ⚠ <strong>Irreversible.</strong> Only use this if you have truly and permanently lost access to {shortAddr(primaryWallet)}.
            </div>
          </Card>

          <label style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', marginBottom: '12px', cursor: 'pointer', fontSize: '12px', color: t.colors.text.secondary, lineHeight: 1.5 }}>
            <input type="checkbox" checked={recoveryConfirmed} onChange={e => setRecoveryConfirmed(e.target.checked)}
              style={{ marginTop: '2px', accentColor: '#f87171', flexShrink: 0 }} />
            I confirm I have permanently lost access to{' '}
            <strong style={{ fontFamily: t.fonts.mono, color: t.colors.text.primary }}>{shortAddr(primaryWallet)}</strong>{' '}
            and want to transfer its identity to this wallet.
          </label>

          <Btn onClick={handleClaimPrimary} disabled={!recoveryConfirmed || busy} loading={busy} variant="danger" fullWidth>
            Take Over as Primary
          </Btn>
          {txError && <StatusMsg type="error">{txError}</StatusMsg>}
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════
  // STATE D — Primary with backup already confirmed ✓
  // ══════════════════════════════════════════════════════════════════
  if (hasBackup) {
    return (
      <div>
        <Label>Backup Wallet</Label>
        <Card tint="green">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: '11px', color: '#34d399', fontWeight: 600, marginBottom: '5px' }}>✓ Backup linked</div>
              <WalletPill address={backupWallet} color="#34d399" />
            </div>
            <Btn onClick={handleRemove} disabled={busy} loading={busy} variant="danger" size="sm">Remove</Btn>
          </div>
          <div style={{ fontSize: '11px', color: t.colors.text.muted, marginTop: '12px', lineHeight: 1.6, borderTop: '1px solid rgba(52,211,153,0.1)', paddingTop: '10px' }}>
            To recover: connect with <strong style={{ fontFamily: t.fonts.mono }}>{shortAddr(backupWallet)}</strong>, open Identity Settings, and use Emergency Recovery.
          </div>
        </Card>
        {txError && <StatusMsg type="error">{txError}</StatusMsg>}
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════
  // STATE C — This wallet has an INCOMING invitation (auto-detected)
  // getIncomingProposal returned a non-zero address → show 1-click confirm
  // ══════════════════════════════════════════════════════════════════
  if (invitedBy) {
    return (
      <div>
        <Label>Backup Wallet</Label>

        <StepProgress step={2} />

        <Card tint="indigo" style={{ marginBottom: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
            <span style={{ fontSize: '20px' }}>🔔</span>
            <div>
              <div style={{ fontSize: '13px', fontWeight: 700, color: '#a5b4fc' }}>You've been invited as a backup wallet!</div>
              <div style={{ fontSize: '12px', color: t.colors.text.muted, marginTop: '2px' }}>Primary wallet:</div>
            </div>
          </div>
          <WalletPill address={invitedBy} />
          <div style={{ fontSize: '12px', color: t.colors.text.muted, marginTop: '10px', lineHeight: 1.6 }}>
            Confirming this link means <strong style={{ fontFamily: t.fonts.mono, color: t.colors.text.secondary }}>{shortAddr(invitedBy)}</strong> can be recovered using this wallet if they lose access.
          </div>
        </Card>

        <Btn onClick={handleConfirm} disabled={busy} loading={busy} variant="success" fullWidth>
          ✓ Confirm — Link as Backup Wallet
        </Btn>
        {txError && <StatusMsg type="error">{txError}</StatusMsg>}
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════
  // STATE B — Primary has pending proposal, waiting for backup to confirm
  // Also handles: backup wallet that needs to confirm (check-again flow)
  // ══════════════════════════════════════════════════════════════════
  if (pendingFor) {
    return (
      <StateBPendingConfirm
        pendingFor={pendingFor}
        myAddress={myAddress}
        onCancel={handleCancel}
        onClose={onClose}
        busy={busy}
        txError={txError}
      />
    );
  }

  // ══════════════════════════════════════════════════════════════════
  // STATE A — No backup, no pending, no invitation
  // Show Step 1: primary enters backup address and proposes
  // ══════════════════════════════════════════════════════════════════
  return (
    <div>
      <Label>Backup Wallet</Label>
      <div style={{ fontSize: '12px', color: t.colors.text.muted, marginBottom: '14px', lineHeight: 1.6 }}>
        Link one backup wallet. If you ever lose access to this wallet, your backup can take over and preserve your reputation history.
      </div>

      <StepProgress step={1} />

      <Card tint="indigo" style={{ marginBottom: '12px' }}>
        <div style={{ fontSize: '12px', fontWeight: 600, color: '#a5b4fc', marginBottom: '8px' }}>
          Step 1 — Enter your backup wallet address
        </div>
        <div style={{ fontSize: '12px', color: t.colors.text.muted, marginBottom: '10px', lineHeight: 1.6 }}>
          Enter the address of your other wallet, then click <strong>Propose</strong>. Your backup wallet will then need to open this page to confirm.
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <input
            value={proposeAddr}
            onChange={e => setProposeAddr(e.target.value.trim())}
            placeholder="0x... backup wallet address"
            style={{
              flex: 1, padding: '9px 12px',
              background: t.colors.bg.input || 'rgba(255,255,255,0.04)',
              border: '1px solid ' + t.colors.border.default,
              borderRadius: t.radius.md, color: t.colors.text.primary,
              fontSize: '12px', outline: 'none', fontFamily: t.fonts.mono,
            }}
          />
          <Btn onClick={handlePropose} disabled={!isValidAddr(proposeAddr)} loading={busy}>
            Propose →
          </Btn>
        </div>
      </Card>

      {/* What happens next */}
      <div style={{ padding: '10px 12px', background: 'rgba(124,58,237,0.04)', border: '1px solid rgba(124,58,237,0.12)', borderRadius: t.radius.md, display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
        <span style={{ fontSize: '16px', flexShrink: 0 }}>💡</span>
        <div style={{ fontSize: '11px', color: t.colors.text.muted, lineHeight: 1.6 }}>
          <strong style={{ color: '#818cf8' }}>Step 2 is fully automatic.</strong> After proposing, switch to your backup wallet in MetaMask. When you open Identity Settings with the backup wallet, a confirmation button will appear automatically — no need to type any address.
        </div>
      </div>

      {txError && <StatusMsg type="error">{txError}</StatusMsg>}
    </div>
  );
}

// ─── Main Modal ───────────────────────────────────────────────────────────────

export default function IdentityModal({ open, onClose, address, onSuccess: onSuccessExternal }) {
  // Invalidate cache whenever the connected address changes so data is always fresh
  const prevAddrRef = useRef(null);
  useEffect(() => {
    if (address && prevAddrRef.current !== address) {
      if (prevAddrRef.current) invalidateIdentityCache(prevAddrRef.current);
      invalidateIdentityCache(address);
      prevAddrRef.current = address;
    }
  }, [address]);

  const { username, linkedWallets, primaryWallet, reload, loading: identityLoading } = useIdentity(address);

  const handleSuccess = useCallback(() => {
    invalidateIdentityCache(address);
    reload?.();
    onSuccessExternal?.();
  }, [address, reload, onSuccessExternal]);

  const isNotConfigured = !ADDRESSES.identity;

  return (
    <Modal open={open} onClose={onClose} title="Identity Settings" maxWidth="500px">
      {isNotConfigured ? (
        <div style={{ padding: '28px', textAlign: 'center', color: t.colors.text.muted }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>⚙️</div>
          <div style={{ fontWeight: 600, marginBottom: '6px', color: t.colors.text.secondary, fontSize: '14px' }}>Not configured</div>
          <div style={{ fontSize: '13px' }}>Identity Registry contract not deployed or address not set.</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column' }}>

          {/* Connected wallet indicator */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px', padding: '8px 12px', background: 'rgba(124,58,237,0.05)', border: '1px solid rgba(124,58,237,0.15)', borderRadius: t.radius.md }}>
            <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#34d399', flexShrink: 0 }} />
            <div style={{ fontFamily: t.fonts.mono, fontSize: '12px', color: t.colors.text.secondary, flex: 1 }}>
              {shortAddr(address)}
            </div>
            {primaryWallet && primaryWallet.toLowerCase() !== address?.toLowerCase() && (
              <span style={{ fontSize: '11px', color: '#fbbf24', background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)', padding: '2px 8px', borderRadius: '99px' }}>
                backup wallet
              </span>
            )}
          </div>

          <UsernameSection
            currentUsername={username}
            address={address}
            identityLoading={identityLoading}
            onSuccess={handleSuccess}
          />

          <div style={{ height: '1px', background: t.colors.border.subtle, margin: '22px 0' }} />

          <AvatarSection address={address} />

          <div style={{ height: '1px', background: t.colors.border.subtle, margin: '22px 0' }} />

          <BackupWalletSection
            linkedWallets={linkedWallets || []}
            myAddress={address}
            primaryWallet={primaryWallet}
            onSuccess={handleSuccess}
            onClose={onClose}
          />

        </div>
      )}
    </Modal>
  );
}
