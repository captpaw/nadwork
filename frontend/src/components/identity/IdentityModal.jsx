import { useState, useCallback, useEffect, useRef } from 'react';
import Modal from '../common/Modal.jsx';
import { theme } from '../../styles/theme.js';
import { useIdentity, useIdentityWrite, invalidateIdentityCache } from '../../hooks/useIdentity.js';
import { getReadContractWithFallback } from '../../utils/ethers.js';
import { ADDRESSES, IDENTITY_ABI } from '../../config/contracts.js';
import { useWalletClient } from 'wagmi';
import { AvatarSection } from '../common/Avatar.jsx';
import { IconCheck, IconLock, IconWarning, IconLink, IconBell, IconLightbulb, IconSettings, IconChevronRight } from '../icons/index.jsx';

// ── Helpers ───────────────────────────────────────────────────────────────────
const ZERO = '0x0000000000000000000000000000000000000000';
function isValidAddr(v) { return typeof v === 'string' && /^0x[0-9a-fA-F]{40}$/.test(v.trim()); }
function shortAddr(a) { return a ? `${a.slice(0, 6)}…${a.slice(-4)}` : ''; }

// ── Shared atoms ──────────────────────────────────────────────────────────────
function SectionLabel({ children }) {
  return (
    <div style={{
      fontFamily: theme.fonts.mono, fontSize: 10,
      fontWeight: 600, color: theme.colors.text.faint,
      letterSpacing: '0.1em', textTransform: 'uppercase',
      marginBottom: 10,
    }}>{children}</div>
  );
}

function Divider() {
  return <div style={{ height: 1, background: theme.colors.border.subtle, margin: '22px 0' }} />;
}

function InfoBox({ tint = 'default', children }) {
  const styles = {
    default: { bg: theme.colors.bg.elevated, border: theme.colors.border.subtle },
    purple:  { bg: theme.colors.primaryDim,  border: theme.colors.primaryBorder },
    green:   { bg: theme.colors.green.dim,   border: theme.colors.green.border  },
    amber:   { bg: theme.colors.amberDim,    border: theme.colors.amberBorder   },
    red:     { bg: theme.colors.red.dim,     border: theme.colors.red.border    },
  };
  const s = styles[tint] || styles.default;
  return (
    <div style={{
      padding: '12px 14px',
      background: s.bg,
      border: `1px solid ${s.border}`,
      borderRadius: theme.radius.md,
    }}>{children}</div>
  );
}

function ActionButton({ onClick, disabled, loading, children, variant = 'primary', fullWidth = false, size = 'md' }) {
  const pad = size === 'sm' ? '6px 14px' : '9px 18px';
  const vs = {
    primary: { bg: theme.colors.primaryDim,   border: theme.colors.primaryBorder, color: theme.colors.primaryLight },
    success: { bg: theme.colors.green.dim,    border: theme.colors.green.border,  color: theme.colors.green[400]  },
    danger:  { bg: theme.colors.red.dim,      border: theme.colors.red.border,    color: theme.colors.red[400]    },
    ghost:   { bg: 'transparent',             border: 'transparent',              color: theme.colors.text.muted  },
  };
  const s = disabled || loading ? {
    bg: theme.colors.bg.elevated,
    border: theme.colors.border.subtle,
    color: theme.colors.text.faint,
  } : vs[variant] || vs.primary;

  const [hov, setHov] = useState(false);
  return (
    <button
      onClick={disabled || loading ? undefined : onClick}
      disabled={disabled || loading}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        padding: pad, borderRadius: theme.radius.md,
        background: hov && !disabled && !loading ? `${s.bg}cc` : s.bg,
        border: `1px solid ${s.border}`,
        color: s.color,
        fontFamily: theme.fonts.body, fontSize: 13, fontWeight: 500,
        cursor: disabled || loading ? 'not-allowed' : 'pointer',
        transition: theme.transition,
        whiteSpace: 'nowrap',
        width: fullWidth ? '100%' : undefined,
        opacity: disabled ? 0.55 : 1,
      }}
    >
      {loading ? 'Processing…' : children}
    </button>
  );
}

function StatusMsg({ type, children }) {
  const colors = {
    error:   theme.colors.red[400],
    success: theme.colors.green[400],
    info:    theme.colors.text.muted,
    warn:    theme.colors.amber,
  };
  return (
    <div style={{
      fontFamily: theme.fonts.body, fontSize: 12,
      color: colors[type] || colors.info,
      marginTop: 6, lineHeight: 1.5,
    }}>{children}</div>
  );
}

function WalletChip({ address, color }) {
  const c = color || theme.colors.primary;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '3px 10px',
      background: `${c}14`,
      border: `1px solid ${c}30`,
      borderRadius: theme.radius.full,
      fontFamily: theme.fonts.mono, fontSize: 11,
      color: c,
    }}>
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: c, flexShrink: 0 }} />
      {shortAddr(address)}
    </span>
  );
}

// ── Step indicator (for 2-step backup flow) ───────────────────────────────────
function StepRow({ step }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
      {[1, 2].map((n, i) => {
        const done   = n < step;
        const active = n === step;
        return (
          <div key={n} style={{ display: 'flex', alignItems: 'center', gap: 8, flex: i < 1 ? 1 : 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
              <div style={{
                width: 24, height: 24, borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: done
                  ? theme.colors.green.dim
                  : active ? theme.colors.primaryDim : theme.colors.bg.elevated,
                border: `1.5px solid ${done ? theme.colors.green.border : active ? theme.colors.primaryBorder : theme.colors.border.subtle}`,
                fontFamily: theme.fonts.mono, fontSize: 10, fontWeight: 700,
                color: done ? theme.colors.green[400] : active ? theme.colors.primaryLight : theme.colors.text.faint,
              }}>
                {done ? <IconCheck size={12} color={theme.colors.green[400]} strokeWidth={2.5} /> : n}
              </div>
              <span style={{
                fontFamily: theme.fonts.body, fontSize: 12,
                fontWeight: active ? 600 : 400,
                color: active ? theme.colors.text.primary : done ? theme.colors.text.secondary : theme.colors.text.faint,
              }}>
                {n === 1 ? 'Propose' : 'Confirm'}
              </span>
            </div>
            {i < 1 && (
              <div style={{
                flex: 1, height: 1,
                background: done ? theme.colors.green.border : theme.colors.border.subtle,
                margin: '0 4px',
              }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Username Section ──────────────────────────────────────────────────────────
function UsernameSection({ currentUsername, address, identityLoading, onSuccess }) {
  const { data: walletClient } = useWalletClient();
  const { setUsername, busy, txError } = useIdentityWrite(walletClient);
  const [input, setInput]         = useState('');
  const [avail, setAvail]         = useState(null); // null | 'short' | 'checking' | 'available' | 'taken' | 'invalid'
  const [confirmed, setConfirmed] = useState(false);
  const debounceRef               = useRef(null);

  const checkAvail = useCallback(async (val, addr) => {
    if (!val || val.length < 3) { setAvail(val?.length > 0 ? 'short' : null); return; }
    setAvail('checking');
    try {
      const c = await getReadContractWithFallback(ADDRESSES.identity, IDENTITY_ABI);
      const [ok] = await Promise.all([
        c.isUsernameAvailable(val, addr || ZERO),
      ]);
      setAvail(ok ? 'available' : 'taken');
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

  if (identityLoading) {
    return (
      <div>
        <SectionLabel>Username</SectionLabel>
        <div style={{ height: 44, borderRadius: theme.radius.md, background: theme.colors.bg.elevated, border: `1px solid ${theme.colors.border.subtle}` }} />
      </div>
    );
  }

  // Already has username — show locked state
  if (currentUsername) {
    return (
      <div>
        <SectionLabel>Username</SectionLabel>
        <InfoBox tint="green">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <IconLock size={18} color={theme.colors.text.primary} />
            <div>
              <div style={{ fontFamily: theme.fonts.mono, fontSize: 15, fontWeight: 700, color: theme.colors.text.primary }}>
                @{currentUsername}
              </div>
              <div style={{ fontFamily: theme.fonts.body, fontSize: 11.5, color: theme.colors.text.muted, marginTop: 2 }}>
                Permanent — cannot be changed.
              </div>
            </div>
          </div>
        </InfoBox>
      </div>
    );
  }

  // Claim form
  return (
    <div>
      <SectionLabel>Claim Username</SectionLabel>
      <InfoBox tint="amber" >
        <div style={{ fontFamily: theme.fonts.body, fontSize: 12, color: theme.colors.amber, lineHeight: 1.6 }}>
          <strong><IconWarning size={12} color={theme.colors.amber} style={{ marginRight: 4, verticalAlign: 'middle' }} /> Permanent choice.</strong> Once claimed, your username cannot be changed or removed.
          Use 3–32 chars: lowercase letters, numbers, hyphens only.
        </div>
      </InfoBox>

      <div style={{ marginTop: 12 }}>
        <div style={{ position: 'relative' }}>
          <span style={{
            position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
            fontFamily: theme.fonts.mono, fontSize: 13, color: theme.colors.text.faint,
            pointerEvents: 'none',
          }}>@</span>
          <input
            value={input}
            onChange={handleChange}
            maxLength={32}
            placeholder="your-username"
            style={{
              width: '100%', padding: '9px 14px 9px 28px', boxSizing: 'border-box',
              background: theme.colors.bg.input,
              border: `1px solid ${
                avail === 'available' ? theme.colors.green.border
                : avail === 'taken' || avail === 'invalid' ? theme.colors.red.border
                : theme.colors.border.default
              }`,
              borderRadius: theme.radius.md,
              color: theme.colors.text.primary,
              fontFamily: theme.fonts.mono, fontSize: 13,
              outline: 'none',
            }}
          />
        </div>

        <div style={{ minHeight: 20, marginTop: 4 }}>
          {avail === 'short'     && <StatusMsg type="info">At least 3 characters required</StatusMsg>}
          {avail === 'checking'  && <StatusMsg type="info">Checking availability…</StatusMsg>}
          {avail === 'available' && <StatusMsg type="success">"{input}" is available <IconCheck size={12} color={theme.colors.green[400]} style={{ marginLeft: 4, verticalAlign: 'middle' }} /></StatusMsg>}
          {avail === 'taken'     && <StatusMsg type="error">"{input}" is already taken</StatusMsg>}
          {avail === 'invalid'   && <StatusMsg type="error">Invalid — use a-z, 0-9, hyphens only</StatusMsg>}
          {txError               && <StatusMsg type="error">{txError}</StatusMsg>}
        </div>

        {avail === 'available' && (
          <div style={{ marginTop: 10 }}>
            <label style={{
              display: 'flex', alignItems: 'flex-start', gap: 8,
              cursor: 'pointer', marginBottom: 12,
              fontFamily: theme.fonts.body, fontSize: 12,
              color: theme.colors.text.secondary, lineHeight: 1.6,
            }}>
              <input
                type="checkbox"
                checked={confirmed}
                onChange={e => setConfirmed(e.target.checked)}
                style={{ marginTop: 2, accentColor: theme.colors.primary, flexShrink: 0 }}
              />
              I understand <strong style={{ color: theme.colors.text.primary, marginLeft: 3 }}>@{input}</strong> will be my permanent NadWork username.
            </label>
            <ActionButton onClick={handleClaim} disabled={!confirmed} loading={busy} fullWidth>
              Claim @{input}
            </ActionButton>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Backup Wallet — Step B (pending, waiting backup to confirm) ───────────────
function PendingConfirmView({ pendingFor, busy, txError, onCancel, onClose }) {
  return (
    <div>
      <SectionLabel>Backup Wallet</SectionLabel>
      <StepRow step={2} />

      <InfoBox tint="green">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <IconCheck size={14} color={theme.colors.green[400]} strokeWidth={2.5} />
          <span style={{ fontFamily: theme.fonts.body, fontSize: 12, fontWeight: 600, color: theme.colors.green[400] }}>
            Proposal sent
          </span>
        </div>
        <WalletChip address={pendingFor} color={theme.colors.green[400]} />
      </InfoBox>

      <div style={{ marginTop: 12 }}>
        <InfoBox tint="purple">
          <div style={{ fontFamily: theme.fonts.body, fontSize: 12, fontWeight: 600, color: theme.colors.primaryLight, marginBottom: 10 }}>
            Step 2 — Confirm from your backup wallet
          </div>
          {[
            <>Switch your connected wallet to <strong style={{ fontFamily: theme.fonts.mono }}>{shortAddr(pendingFor)}</strong></>,
            <>Open this page and re-open Identity Settings</>,
            <>A one-click confirmation button will appear automatically</>,
          ].map((text, i) => (
            <div key={i} style={{ display: 'flex', gap: 10, marginBottom: 8, alignItems: 'flex-start' }}>
              <div style={{
                width: 18, height: 18, borderRadius: '50%', flexShrink: 0,
                background: theme.colors.primaryDim, border: `1px solid ${theme.colors.primaryBorder}`,
                fontFamily: theme.fonts.mono, fontSize: 10, fontWeight: 700,
                color: theme.colors.primaryLight,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>{i + 1}</div>
              <span style={{ fontFamily: theme.fonts.body, fontSize: 12, color: theme.colors.text.muted, lineHeight: 1.6 }}>{text}</span>
            </div>
          ))}
          <ActionButton onClick={onClose} variant="success" fullWidth>
            Close & Switch Wallet →
          </ActionButton>
        </InfoBox>
      </div>

      <div style={{ marginTop: 10, textAlign: 'right' }}>
        <ActionButton onClick={onCancel} disabled={busy} variant="ghost" size="sm">
          Cancel proposal
        </ActionButton>
      </div>
      {txError && <StatusMsg type="error">{txError}</StatusMsg>}
    </div>
  );
}

// ── Backup Wallet Section (all states) ───────────────────────────────────────
function BackupWalletSection({ myAddress, primaryWallet, onSuccess, onClose }) {
  const { data: walletClient } = useWalletClient();
  const { proposeLink, cancelProposal, unlinkWallet, confirmLink, claimPrimary, busy, txError } =
    useIdentityWrite(walletClient);

  const [proposeAddr, setProposeAddr]   = useState('');
  const [pendingFor, setPendingFor]     = useState(null);
  const [invitedBy, setInvitedBy]       = useState(null);
  const [loadingState, setLoading]      = useState(true);
  const [onchainPrimary, setOCPrimary]  = useState(null);
  const [onchainLinked, setOCLinked]    = useState([]);
  const [recoveryOk, setRecoveryOk]     = useState(false);
  const prevRef = useRef(null);

  const backupWallet  = onchainLinked[0] || null;
  const isThisBackup  = !!onchainPrimary && onchainPrimary.toLowerCase() !== myAddress?.toLowerCase();
  const hasBackup     = !!backupWallet;

  useEffect(() => {
    if (prevRef.current !== myAddress) {
      prevRef.current = myAddress;
      setProposeAddr(''); setPendingFor(null);
      setInvitedBy(null); setRecoveryOk(false);
      setLoading(true);
    }
  }, [myAddress]);

  const loadState = useCallback(async () => {
    if (!ADDRESSES.identity || !myAddress) { setLoading(false); return; }
    setLoading(true);
    try {
      const c = await getReadContractWithFallback(ADDRESSES.identity, IDENTITY_ABI);
      const [identity, outgoing, incoming] = await Promise.all([
        c.getIdentity(myAddress).catch(() => null),
        c.getPendingLink(myAddress).catch(() => ZERO),
        c.getIncomingProposal(myAddress).catch(() => ZERO),
      ]);
      if (identity) {
        setOCPrimary(identity[1] || myAddress);
        setOCLinked([...(identity[2] || [])]);
      } else {
        setOCPrimary(myAddress);
        setOCLinked([]);
      }
      setPendingFor(outgoing && outgoing !== ZERO ? outgoing : null);
      setInvitedBy(incoming && incoming !== ZERO ? incoming : null);
    } catch { /* silent */ }
    setLoading(false);
  }, [myAddress]);

  useEffect(() => { loadState(); }, [loadState]);

  const handlePropose = async () => {
    if (!isValidAddr(proposeAddr)) return;
    try { await proposeLink(proposeAddr.trim(), myAddress); setProposeAddr(''); await loadState(); onSuccess?.(); } catch {}
  };
  const handleCancel = async () => {
    try { await cancelProposal(myAddress); setPendingFor(null); onSuccess?.(); } catch {}
  };
  const handleRemove = async () => {
    try { await unlinkWallet(backupWallet, myAddress); onSuccess?.(); } catch {}
  };
  const handleConfirm = async () => {
    if (!invitedBy) return;
    try { await confirmLink(invitedBy, myAddress); setInvitedBy(null); onSuccess?.(); } catch {}
  };
  const handleClaim = async () => {
    if (!recoveryOk || !isValidAddr(primaryWallet)) return;
    try { await claimPrimary(primaryWallet, myAddress); setRecoveryOk(false); onSuccess?.(); } catch {}
  };

  // Loading skeleton
  if (loadingState) {
    return (
      <div>
        <SectionLabel>Backup Wallet</SectionLabel>
        <div style={{
          height: 60, borderRadius: theme.radius.md,
          background: theme.colors.bg.elevated,
          border: `1px solid ${theme.colors.border.subtle}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <span style={{ fontFamily: theme.fonts.mono, fontSize: 11, color: theme.colors.text.faint }}>
            Checking wallet status…
          </span>
        </div>
      </div>
    );
  }

  // STATE E — This wallet is a backup for another primary
  if (isThisBackup) {
    return (
      <div>
        <SectionLabel>Backup Wallet</SectionLabel>
        <InfoBox tint="purple">
          <div style={{ fontFamily: theme.fonts.body, fontSize: 12, fontWeight: 600, color: theme.colors.primaryLight, marginBottom: 6 }}>
            <IconLink size={14} color={theme.colors.primary} style={{ marginRight: 6, verticalAlign: 'middle' }} /> This wallet is a backup for:
          </div>
          <WalletChip address={onchainPrimary} />
          <div style={{ fontFamily: theme.fonts.body, fontSize: 12, color: theme.colors.text.muted, marginTop: 10, lineHeight: 1.6 }}>
            If you lose access to the primary wallet, you can take over its identity here.
          </div>
        </InfoBox>

        <div style={{ marginTop: 18 }}>
          <SectionLabel>Emergency Recovery</SectionLabel>
          <InfoBox tint="red">
            <div style={{ fontFamily: theme.fonts.body, fontSize: 12, color: theme.colors.red[400], lineHeight: 1.6 }}>
              <IconWarning size={14} color={theme.colors.red[400]} style={{ marginRight: 6, verticalAlign: 'middle' }} /> <strong>Irreversible.</strong> Only use this if you have permanently lost access to {shortAddr(onchainPrimary)}.
            </div>
          </InfoBox>
          <label style={{
            display: 'flex', alignItems: 'flex-start', gap: 8, marginTop: 12, marginBottom: 12,
            cursor: 'pointer', fontFamily: theme.fonts.body, fontSize: 12,
            color: theme.colors.text.secondary, lineHeight: 1.6,
          }}>
            <input
              type="checkbox" checked={recoveryOk}
              onChange={e => setRecoveryOk(e.target.checked)}
              style={{ marginTop: 2, accentColor: theme.colors.red[500], flexShrink: 0 }}
            />
            I confirm I have permanently lost access to{' '}
            <strong style={{ fontFamily: theme.fonts.mono, color: theme.colors.text.primary }}>{shortAddr(onchainPrimary)}</strong>{' '}
            and want to transfer its identity to this wallet.
          </label>
          <ActionButton onClick={handleClaim} disabled={!recoveryOk} loading={busy} variant="danger" fullWidth>
            Take Over as Primary
          </ActionButton>
          {txError && <StatusMsg type="error">{txError}</StatusMsg>}
        </div>
      </div>
    );
  }

  // STATE D — Backup already confirmed
  if (hasBackup) {
    return (
      <div>
        <SectionLabel>Backup Wallet</SectionLabel>
        <InfoBox tint="green">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontFamily: theme.fonts.body, fontSize: 11.5, fontWeight: 600, color: theme.colors.green[400], marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}><IconCheck size={14} color={theme.colors.green[400]} /> Backup linked</div>
              <WalletChip address={backupWallet} color={theme.colors.green[400]} />
            </div>
            <ActionButton onClick={handleRemove} loading={busy} variant="danger" size="sm">Remove</ActionButton>
          </div>
          <div style={{ fontFamily: theme.fonts.body, fontSize: 11.5, color: theme.colors.text.muted, marginTop: 12, lineHeight: 1.6, borderTop: `1px solid ${theme.colors.green.border}`, paddingTop: 10 }}>
            To recover: connect with <strong style={{ fontFamily: theme.fonts.mono }}>{shortAddr(backupWallet)}</strong>, open Identity Settings, and use Emergency Recovery.
          </div>
        </InfoBox>
        {txError && <StatusMsg type="error">{txError}</StatusMsg>}
      </div>
    );
  }

  // STATE C — Incoming invitation auto-detected
  if (invitedBy) {
    return (
      <div>
        <SectionLabel>Backup Wallet</SectionLabel>
        <StepRow step={2} />
        <InfoBox tint="purple">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <IconBell size={20} color={theme.colors.primary} />
            <div>
              <div style={{ fontFamily: theme.fonts.body, fontSize: 13, fontWeight: 700, color: theme.colors.primaryLight }}>
                Backup wallet invitation!
              </div>
              <div style={{ fontFamily: theme.fonts.body, fontSize: 11.5, color: theme.colors.text.muted, marginTop: 2 }}>
                Primary wallet:
              </div>
            </div>
          </div>
          <WalletChip address={invitedBy} />
          <div style={{ fontFamily: theme.fonts.body, fontSize: 12, color: theme.colors.text.muted, marginTop: 10, lineHeight: 1.6 }}>
            Confirming means <strong style={{ fontFamily: theme.fonts.mono }}>{shortAddr(invitedBy)}</strong> can be recovered using this wallet if access is lost.
          </div>
        </InfoBox>
        <div style={{ marginTop: 12 }}>
          <ActionButton onClick={handleConfirm} loading={busy} variant="success" fullWidth>
            <IconCheck size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} /> Confirm — Link as Backup Wallet
          </ActionButton>
        </div>
        {txError && <StatusMsg type="error">{txError}</StatusMsg>}
      </div>
    );
  }

  // STATE B — Pending, waiting backup to confirm
  if (pendingFor) {
    return (
      <PendingConfirmView
        pendingFor={pendingFor}
        busy={busy}
        txError={txError}
        onCancel={handleCancel}
        onClose={onClose}
      />
    );
  }

  // STATE A — No backup, no pending, no invitation → show Step 1
  return (
    <div>
      <SectionLabel>Backup Wallet</SectionLabel>
      <p style={{ fontFamily: theme.fonts.body, fontSize: 12.5, color: theme.colors.text.muted, lineHeight: 1.7, marginBottom: 14 }}>
        Link one backup wallet. If you ever lose access to this wallet, your backup can take over and preserve your reputation history.
      </p>

      <StepRow step={1} />

      <InfoBox tint="purple">
        <div style={{ fontFamily: theme.fonts.body, fontSize: 12, fontWeight: 600, color: theme.colors.primaryLight, marginBottom: 8 }}>
          Step 1 — Enter your backup wallet address
        </div>
        <div style={{ fontFamily: theme.fonts.body, fontSize: 12, color: theme.colors.text.muted, marginBottom: 12, lineHeight: 1.6 }}>
          Enter the address of your other wallet, then click Propose. Your backup wallet will need to open this page to confirm.
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            value={proposeAddr}
            onChange={e => setProposeAddr(e.target.value.trim())}
            placeholder="0x… backup wallet address"
            style={{
              flex: 1, padding: '9px 12px',
              background: theme.colors.bg.input,
              border: `1px solid ${isValidAddr(proposeAddr) ? theme.colors.primary : theme.colors.border.default}`,
              borderRadius: theme.radius.md,
              color: theme.colors.text.primary,
              fontFamily: theme.fonts.mono, fontSize: 12, outline: 'none',
            }}
          />
          <ActionButton onClick={handlePropose} disabled={!isValidAddr(proposeAddr)} loading={busy}>
            Propose <IconChevronRight size={12} style={{ marginLeft: 4, verticalAlign: 'middle' }} />
          </ActionButton>
        </div>
      </InfoBox>

      <div style={{ marginTop: 10, display: 'flex', gap: 10, alignItems: 'flex-start', padding: '10px 12px', background: theme.colors.bg.elevated, border: `1px solid ${theme.colors.border.subtle}`, borderRadius: theme.radius.md }}>
        <IconLightbulb size={14} color={theme.colors.text.muted} style={{ flexShrink: 0 }} />
        <div style={{ fontFamily: theme.fonts.body, fontSize: 11.5, color: theme.colors.text.faint, lineHeight: 1.6 }}>
          <strong style={{ color: theme.colors.text.muted }}>Step 2 is automatic.</strong>{' '}
          After proposing, switch to your backup wallet. Open Identity Settings with that wallet and the confirmation button appears automatically.
        </div>
      </div>

      {txError && <StatusMsg type="error">{txError}</StatusMsg>}
    </div>
  );
}

// ── Main Modal ────────────────────────────────────────────────────────────────
export default function IdentityModal({ open, onClose, address, onSuccess: onSuccessExternal }) {
  const prevRef = useRef(null);
  useEffect(() => {
    if (address && prevRef.current !== address) {
      if (prevRef.current) invalidateIdentityCache(prevRef.current);
      invalidateIdentityCache(address);
      prevRef.current = address;
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
    <Modal open={open} onClose={onClose} title="Identity Settings" maxWidth={500}>
      {isNotConfigured ? (
        <div style={{ padding: '20px 0', textAlign: 'center' }}>
          <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'center' }}><IconSettings size={32} color={theme.colors.text.muted} /></div>
          <div style={{ fontFamily: theme.fonts.body, fontWeight: 600, fontSize: 14, color: theme.colors.text.secondary, marginBottom: 6 }}>
            Not configured
          </div>
          <div style={{ fontFamily: theme.fonts.body, fontSize: 13, color: theme.colors.text.muted }}>
            Identity Registry contract address not set.
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column' }}>

          {/* Connected wallet indicator */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8, marginBottom: 22,
            padding: '8px 12px',
            background: theme.colors.bg.elevated,
            border: `1px solid ${theme.colors.border.subtle}`,
            borderRadius: theme.radius.md,
          }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: theme.colors.green[400], flexShrink: 0 }} />
            <span style={{ fontFamily: theme.fonts.mono, fontSize: 12, color: theme.colors.text.secondary, flex: 1 }}>
              {shortAddr(address)}
            </span>
            {primaryWallet && primaryWallet.toLowerCase() !== address?.toLowerCase() && (
              <span style={{
                fontFamily: theme.fonts.mono, fontSize: 10,
                color: theme.colors.amber,
                background: theme.colors.amberDim,
                border: `1px solid ${theme.colors.amberBorder}`,
                borderRadius: theme.radius.full,
                padding: '2px 8px',
              }}>backup wallet</span>
            )}
          </div>

          {/* Username */}
          <UsernameSection
            currentUsername={username}
            address={address}
            identityLoading={identityLoading}
            onSuccess={handleSuccess}
          />

          <Divider />

          {/* Avatar */}
          <AvatarSection address={address} />

          <Divider />

          {/* Backup Wallet */}
          <BackupWalletSection
            myAddress={address}
            primaryWallet={primaryWallet}
            linkedWallets={linkedWallets || []}
            onSuccess={handleSuccess}
            onClose={onClose}
          />

        </div>
      )}
    </Modal>
  );
}
