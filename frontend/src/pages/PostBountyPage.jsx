import { useState, useRef, useEffect } from 'react';
import { useAccount, useWalletClient } from 'wagmi';
import { ethers } from 'ethers';
import { theme } from '../styles/theme';
import Button from '../components/common/Button';
import { uploadJSON, buildBountyMeta } from '../config/pinata';
import { getContract } from '../utils/ethers';
import { getResolvedRegistryContract, listCreatorBountyIds } from '../utils/registry.js';
import { getFactoryCapabilities, seedFactoryCapabilities } from '../utils/factoryCapabilities.js';
import { ADDRESSES, FACTORY_ABI } from '../config/contracts';
import { toast } from '../utils/toast';
import { requestNotificationRefresh } from '../hooks/useNotifications';
import { IconCheck, IconX, IconCode, IconTarget, IconNote, IconChart, IconBounties, IconChevronLeft, IconChevronRight } from '../components/icons';

// â”€â”€ Constants â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const CATEGORIES = [
  { key: 'Dev',      Icon: IconCode,  desc: 'Smart contracts, dApps, tooling' },
  { key: 'Design',   Icon: IconTarget, desc: 'UI/UX, branding, graphics'       },
  { key: 'Content',  Icon: IconNote,   desc: 'Docs, writing, translation'       },
  { key: 'Research', Icon: IconChart,  desc: 'Analysis, audits, reports'        },
  { key: 'Other',    Icon: IconTarget, desc: 'Anything else'                    },
];

const STEPS = [
  { id: 'task',   label: 'Task',   desc: 'What needs to be done'    },
  { id: 'reward', label: 'Reward', desc: 'Payment and deadline'      },
  { id: 'review', label: 'Review', desc: 'Confirm and post'          },
];

const DRAFT_KEY      = addr => `nw_draft_v1_${addr?.toLowerCase() || 'anon'}`;
const DRAFT_STEP_KEY = addr => `nw_draft_step_v1_${addr?.toLowerCase() || 'anon'}`;
const JUST_POSTED_KEY = 'nw_bounty_just_posted';

function toBoolSafe(value, fallback = false) {
  if (value == null) return fallback;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'bigint') return value !== 0n;
  const s = String(value).trim().toLowerCase();
  if (!s) return fallback;
  if (['true', '1', 'yes', 'y', 'on'].includes(s)) return true;
  if (['false', '0', 'no', 'n', 'off'].includes(s)) return false;
  return fallback;
}

const PRESET_SKILLS = [
  'Solidity', 'React', 'TypeScript', 'JavaScript', 'Rust', 'Python',
  'Smart Contract', 'DeFi', 'NFT', 'Node.js', 'GraphQL', 'Move',
  'UI/UX', 'Figma', 'Branding', 'Illustration', 'Motion Design',
  'Technical Writing', 'Documentation', 'Translation', 'Copywriting',
  'Market Research', 'Tokenomics', 'Security Audit', 'Data Analysis',
];
function extractBountyIdFromReceipt(receipt) {
  try {
    const iface = new ethers.Interface(FACTORY_ABI);
    for (const log of receipt?.logs || []) {
      try {
        const parsed = iface.parseLog(log);
        if (parsed?.name !== 'BountyCreated') continue;
        const raw = parsed?.args?.bountyId ?? parsed?.args?.[0];
        if (raw == null) continue;
        return String(raw);
      } catch {
        // ignore non-factory logs
      }
    }
  } catch {
    // ignore parsing errors
  }
  return '';
}


async function resolveBountyIdAfterPost(receipt, creator) {
  const fromReceipt = extractBountyIdFromReceipt(receipt);
  if (fromReceipt) return fromReceipt;
  if (!creator) return '';

  try {
    const { contract: reg } = await getResolvedRegistryContract();
    if (!reg) return '';

    const ids = await listCreatorBountyIds(reg, creator);
    if (!Array.isArray(ids) || ids.length === 0) return '';

    let maxId = 0n;
    for (const raw of ids) {
      try {
        const n = BigInt(raw);
        if (n > maxId) maxId = n;
      } catch {
        // ignore malformed id entries
      }
    }

    return maxId > 0n ? String(maxId) : '';
  } catch {
    return '';
  }
}
function saveJustPostedHint(payload = {}) {
  try {
    if (typeof sessionStorage === 'undefined') return;
    sessionStorage.setItem(JUST_POSTED_KEY, JSON.stringify({
      ts: Date.now(),
      bountyId: payload?.bountyId ? String(payload.bountyId) : '',
      title: payload?.title ? String(payload.title) : '',
      category: payload?.category ? String(payload.category).toLowerCase() : '',
      totalReward: payload?.totalReward ? String(payload.totalReward) : '',
      deadline: payload?.deadline ? String(payload.deadline) : '',
      creator: payload?.creator ? String(payload.creator) : '',
      metaCid: payload?.metaCid ? String(payload.metaCid) : '',
      requiresApplication: toBoolSafe(payload?.requiresApplication, false),
    }));
  } catch {
    // ignore sessionStorage errors
  }
}

const INITIAL_FORM = {
  title: '',
  description: '',
  category: 'Dev',
  requirements: [''],     // list: what builder must do
  deliverables: [''],     // list: what builder must submit
  skills: [],           // array of strings
  reward: '',
  winnerCount: '1',
  deadline: '',
  contactInfo: '',
  requiresApplication: false, // V4: curated project flag
};

// â”€â”€ Sub-components â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function StepIndicator({ current }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', marginBottom: 36 }}>
      {STEPS.map((s, i) => {
        const done   = i < current;
        const active = i === current;
        return (
          <div key={s.id} style={{ display: 'flex', alignItems: 'center', flex: i < STEPS.length - 1 ? 1 : 0 }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
              <div style={{
                width: 30, height: 30, borderRadius: '50%',
                background: done
                  ? theme.colors.primary
                  : active ? theme.colors.primaryDim : 'transparent',
                border: `1.5px solid ${done || active ? theme.colors.primary : theme.colors.border.default}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: theme.fonts.mono, fontSize: 11, fontWeight: 600,
                color: done ? '#fff' : active ? theme.colors.primary : theme.colors.text.faint,
                transition: theme.transition,
                flexShrink: 0,
              }}>
                {done ? <IconCheck size={14} color="#fff" strokeWidth={2.5} /> : i + 1}
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{
                  fontFamily: theme.fonts.body, fontSize: 12, fontWeight: active ? 600 : 400,
                  color: active ? theme.colors.text.primary : done ? theme.colors.text.secondary : theme.colors.text.faint,
                  transition: theme.transition, whiteSpace: 'nowrap',
                }}>{s.label}</div>
              </div>
            </div>
            {i < STEPS.length - 1 && (
              <div style={{
                flex: 1, height: 1,
                background: done ? theme.colors.primary : theme.colors.border.subtle,
                margin: '0 10px', marginBottom: 22,
                transition: theme.transition,
              }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function FieldLabel({ children, hint, required }) {
  return (
    <div style={{ marginBottom: 7 }}>
      <label style={{
        fontFamily: theme.fonts.body, fontSize: 13,
        fontWeight: 500, color: theme.colors.text.secondary,
        letterSpacing: '-0.01em',
      }}>
        {children}
        {required && <span style={{ color: theme.colors.primary, marginLeft: 3 }}>*</span>}
      </label>
      {hint && (
        <div style={{
          fontFamily: theme.fonts.body, fontSize: 11.5,
          color: theme.colors.text.faint, marginTop: 2,
        }}>{hint}</div>
      )}
    </div>
  );
}

function FormInput({ label, hint, required, error, ...props }) {
  const [focused, setFocused] = useState(false);
  return (
    <div>
      {label && <FieldLabel hint={hint} required={required}>{label}</FieldLabel>}
      <input
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          width: '100%', padding: '10px 14px',
          background: theme.colors.bg.input,
          color: theme.colors.text.primary,
          border: `1px solid ${error ? theme.colors.red[500] : focused ? theme.colors.primary : theme.colors.border.default}`,
          borderRadius: theme.radius.md, fontSize: 14,
          fontFamily: theme.fonts.body, outline: 'none',
          boxShadow: focused ? (error ? `0 0 0 3px ${theme.colors.red.dim}` : `0 0 0 3px ${theme.colors.primaryDim}`) : 'none',
          transition: theme.transition, boxSizing: 'border-box',
        }}
        {...props}
      />
      {error && (
        <div style={{ fontFamily: theme.fonts.body, fontSize: 11.5, color: theme.colors.red[400], marginTop: 4 }}>{error}</div>
      )}
    </div>
  );
}

function FormTextarea({ label, hint, required, error, minHeight = 120, ...props }) {
  const [focused, setFocused] = useState(false);
  const ref = useRef(null);

  // Auto-resize
  const handleInput = (e) => {
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = Math.max(minHeight, el.scrollHeight) + 'px';
    if (props.onChange) props.onChange(e);
  };

  return (
    <div>
      {label && <FieldLabel hint={hint} required={required}>{label}</FieldLabel>}
      <textarea
        ref={ref}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onChange={handleInput}
        style={{
          width: '100%', padding: '10px 14px',
          background: theme.colors.bg.input,
          color: theme.colors.text.primary,
          border: `1px solid ${error ? theme.colors.red[500] : focused ? theme.colors.primary : theme.colors.border.default}`,
          borderRadius: theme.radius.md, fontSize: 14,
          fontFamily: theme.fonts.body, outline: 'none',
          lineHeight: 1.7, resize: 'none',
          boxShadow: focused ? (error ? `0 0 0 3px ${theme.colors.red.dim}` : `0 0 0 3px ${theme.colors.primaryDim}`) : 'none',
          transition: 'border-color 0.15s, box-shadow 0.15s',
          minHeight, overflow: 'hidden', boxSizing: 'border-box',
        }}
        {...props}
      />
      {error && (
        <div style={{ fontFamily: theme.fonts.body, fontSize: 11.5, color: theme.colors.red[400], marginTop: 4 }}>{error}</div>
      )}
    </div>
  );
}

// Dynamic list editor (requirements / deliverables)
function ListEditor({ label, hint, required, items, onChange, placeholder, maxItems = 8 }) {
  const addItem    = () => { if (items.length < maxItems) onChange([...items, '']); };
  const removeItem = (i) => onChange(items.filter((_, idx) => idx !== i));
  const editItem   = (i, v) => onChange(items.map((x, idx) => idx === i ? v : x));

  return (
    <div>
      <FieldLabel hint={hint} required={required}>{label}</FieldLabel>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {items.map((item, i) => (
          <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <span style={{
              fontFamily: theme.fonts.mono, fontSize: 10,
              color: theme.colors.text.faint, width: 18, flexShrink: 0, textAlign: 'right',
            }}>{i + 1}.</span>
            <ItemInput
              value={item}
              placeholder={placeholder}
              onChange={(v) => editItem(i, v)}
            />
            {items.length > 1 && (
              <button
                onClick={() => removeItem(i)}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: theme.colors.text.faint, fontSize: 14, padding: '0 2px',
                  flexShrink: 0, lineHeight: 1,
                  transition: theme.transition,
                }}
                onMouseEnter={e => e.currentTarget.style.color = theme.colors.red[400]}
                onMouseLeave={e => e.currentTarget.style.color = theme.colors.text.faint}
                title="Remove"
              ><IconX size={14} color="currentColor" /></button>
            )}
          </div>
        ))}
        {items.length < maxItems && (
          <button
            onClick={addItem}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: 'none', border: `1px dashed ${theme.colors.border.default}`,
              borderRadius: theme.radius.md, padding: '7px 12px',
              color: theme.colors.text.faint, fontSize: 12,
              fontFamily: theme.fonts.body, cursor: 'pointer',
              transition: theme.transition, marginTop: 2,
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = theme.colors.primary; e.currentTarget.style.color = theme.colors.primary; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = theme.colors.border.default; e.currentTarget.style.color = theme.colors.text.faint; }}
          >
            <span style={{ fontSize: 14, lineHeight: 1 }}>+</span> Add item
          </button>
        )}
      </div>
    </div>
  );
}

function ItemInput({ value, placeholder, onChange }) {
  const [focused, setFocused] = useState(false);
  return (
    <input
      value={value}
      placeholder={placeholder}
      onChange={e => onChange(e.target.value)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={{
        flex: 1, padding: '8px 12px',
        background: theme.colors.bg.input,
        color: theme.colors.text.primary,
        border: `1px solid ${focused ? theme.colors.primary : theme.colors.border.default}`,
        borderRadius: theme.radius.md, fontSize: 13.5,
        fontFamily: theme.fonts.body, outline: 'none',
        boxShadow: focused ? `0 0 0 3px ${theme.colors.primaryDim}` : 'none',
        transition: theme.transition, boxSizing: 'border-box',
      }}
    />
  );
}

function TagInput({ label, hint, value = [], onChange, max = 10 }) {
  const [inputVal, setInputVal] = useState('');
  const [focused,  setFocused]  = useState(false);

  const addTag = (raw) => {
    const tag = raw.trim();
    if (!tag || value.length >= max) return;
    if (value.map(t => t.toLowerCase()).includes(tag.toLowerCase())) { setInputVal(''); return; }
    onChange([...value, tag]);
    setInputVal('');
  };
  const removeTag = (i) => onChange(value.filter((_, idx) => idx !== i));
  const onKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag(inputVal); }
    if (e.key === 'Backspace' && !inputVal && value.length > 0) removeTag(value.length - 1);
  };

  return (
    <div>
      {label && <FieldLabel hint={hint}>{label}</FieldLabel>}
      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center',
        padding: '8px 12px', minHeight: 44,
        background: theme.colors.bg.input,
        border: `1px solid ${focused ? theme.colors.primary : theme.colors.border.default}`,
        borderRadius: theme.radius.md,
        boxShadow: focused ? `0 0 0 3px ${theme.colors.primaryDim}` : 'none',
        transition: theme.transition, cursor: 'text',
      }}
        onClick={() => document.getElementById('tag-input-field')?.focus()}
      >
        {value.map((tag, i) => (
          <span key={i} style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            padding: '2px 8px 2px 10px',
            background: theme.colors.primaryDim,
            border: `1px solid ${theme.colors.primaryBorder}`,
            borderRadius: theme.radius.full,
            fontFamily: theme.fonts.body, fontSize: 12, fontWeight: 500,
            color: theme.colors.primaryLight,
          }}>
            {tag}
            <button onClick={() => removeTag(i)} style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: theme.colors.primaryLight, opacity: 0.6,
              fontSize: 14, lineHeight: 1, padding: 0, marginLeft: 2,
            }}
              onMouseEnter={e => e.currentTarget.style.opacity = '1'}
              onMouseLeave={e => e.currentTarget.style.opacity = '0.6'}
            >Ã—</button>
          </span>
        ))}
        {value.length < max && (
          <input
            id="tag-input-field"
            value={inputVal}
            onChange={e => setInputVal(e.target.value)}
            onKeyDown={onKeyDown}
            onBlur={() => { addTag(inputVal); setFocused(false); }}
            onFocus={() => setFocused(true)}
            placeholder={value.length === 0 ? 'Type a skill and press Enter...' : ''}
            style={{
              flex: 1, minWidth: 120, border: 'none', outline: 'none',
              background: 'transparent', color: theme.colors.text.primary,
              fontFamily: theme.fonts.body, fontSize: 13.5,
            }}
          />
        )}
      </div>
      {/* Preset suggestions */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 8 }}>
        {PRESET_SKILLS.filter(p => !value.map(v => v.toLowerCase()).includes(p.toLowerCase())).slice(0, 10).map(p => (
          <button key={p} onClick={() => addTag(p)} style={{
            padding: '3px 9px',
            background: theme.colors.bg.elevated,
            border: `1px solid ${theme.colors.border.subtle}`,
            borderRadius: theme.radius.full,
            fontFamily: theme.fonts.body, fontSize: 11.5,
            color: theme.colors.text.muted, cursor: 'pointer',
            transition: theme.transition,
          }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = theme.colors.primary; e.currentTarget.style.color = theme.colors.primary; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = theme.colors.border.subtle; e.currentTarget.style.color = theme.colors.text.muted; }}
          >+ {p}</button>
        ))}
      </div>
      <div style={{ fontFamily: theme.fonts.body, fontSize: 11, color: theme.colors.text.faint, marginTop: 4 }}>
        Press Enter or comma to add - max {max}
      </div>
    </div>
  );
}

function ReviewRow({ label, value, mono, accent, last }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
      padding: '11px 18px', gap: 20,
      borderBottom: last ? 'none' : `1px solid ${theme.colors.border.faint}`,
    }}>
      <span style={{
        fontFamily: theme.fonts.mono, fontSize: 10,
        color: theme.colors.text.faint, textTransform: 'uppercase',
        letterSpacing: '0.06em', flexShrink: 0, paddingTop: 1,
      }}>{label}</span>
      <span style={{
        fontFamily: mono ? theme.fonts.mono : theme.fonts.body,
        fontSize: mono ? 12 : 13,
        color: accent ? theme.colors.primary : theme.colors.text.primary,
        fontWeight: accent ? 600 : 400,
        textAlign: 'right',
      }}>{value}</span>
    </div>
  );
}

// â”€â”€ Main page â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export default function PostBountyPage() {
  const { isConnected, address } = useAccount();
  const { data: walletClient }   = useWalletClient();
  const [step, setStep]     = useState(0);
  const [form, setForm]     = useState(INITIAL_FORM);
  const [errors, setErrors] = useState({});
  const [loading, setLoading]   = useState(false);
  const [done, setDone]         = useState(false);
  const [creatorStake, setCreatorStake] = useState(null); // fetched from contract
  const [showDraftBanner, setShowDraftBanner] = useState(false);
  const [factoryCaps, setFactoryCaps] = useState(null);
  const formRef    = useRef(null);
  const saveTimerRef = useRef(null);

  const set = (k, v) => {
    setForm(f => {
      const next = { ...f, [k]: v };
      if (address) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = setTimeout(() => {
          try { localStorage.setItem(DRAFT_KEY(address), JSON.stringify(next)); } catch {}
        }, 500);
      }
      return next;
    });
  };

  const isLegacyOpenOnly = !!factoryCaps?.openOnlyLegacy;
  const applicationFlowUnsupported = isLegacyOpenOnly || factoryCaps?.supportsApplications === false;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const caps = await getFactoryCapabilities();
        if (!cancelled) setFactoryCaps(caps);
      } catch {
        if (!cancelled) setFactoryCaps(null);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!applicationFlowUnsupported) return;
    setForm((prev) => (
      prev.requiresApplication
        ? { ...prev, requiresApplication: false }
        : prev
    ));
  }, [applicationFlowUnsupported]);

  // Fetch creator stake estimate when reward changes
  useEffect(() => {
    if (!form.reward || isNaN(parseFloat(form.reward))) { setCreatorStake(null); return; }
    let cancelled = false;
    (async () => {
      try {
        if (!ADDRESSES.factory) return;
        // Use a read-only call - no wallet needed
        const { ethers: e } = await import('ethers');
        const { getReadContract } = await import('../utils/ethers');
        const factory = getReadContract(ADDRESSES.factory, FACTORY_ABI);
        const rewardWei = e.parseEther(form.reward);

        const stakeFromGetter = await factory.getCreatorStake(rewardWei).catch(() => null);
        if (stakeFromGetter != null) {
          if (!cancelled) setCreatorStake(stakeFromGetter);
          return;
        }

        const [bps, min] = await Promise.all([
          factory.CREATOR_STAKE_BPS().catch(() => 300n),
          factory.MIN_CREATOR_STAKE().catch(() => e.parseEther('0.01')),
        ]);
        if (cancelled) return;
        const calc = rewardWei * BigInt(bps) / 10000n;
        const stake = calc > min ? calc : min;
        setCreatorStake(stake);
      } catch {
        setCreatorStake(null);
      }
    })();
    return () => { cancelled = true; };
  }, [form.reward]);

  const totalLocked = (() => {
    if (!form.reward || isNaN(parseFloat(form.reward))) return null;
    try {
      const rewardWei = ethers.parseEther(form.reward);
      const stake = creatorStake || (rewardWei * 300n / 10000n);
      return rewardWei + stake;
    } catch { return null; }
  })();

  // Validation
  const validateStep0 = () => {
    const e = {};
    if (!form.title.trim()) e.title = 'Title is required';
    else if (form.title.length > 100) e.title = 'Title max 100 characters (contract limit)';
    if (!form.description.trim()) e.description = 'Description is required';
    else if (form.description.length < 30) e.description = 'At least 30 characters - describe the task clearly';
    const reqs = form.requirements.filter(r => r.trim());
    if (reqs.length === 0) e.requirements = 'Add at least one requirement';
    setErrors(e); return Object.keys(e).length === 0;
  };

  const validateStep1 = () => {
    const e = {};
    const r = parseFloat(form.reward);
    if (!form.reward || isNaN(r) || r <= 0) e.reward = 'Enter a valid reward amount (e.g. 1.5)';
    if (r > 0 && r < 0.001) e.reward = 'Minimum reward is 0.001 MON';
    if (!form.deadline) e.deadline = 'Deadline is required';
    else {
      const dl = new Date(form.deadline).getTime();
      if (dl <= Date.now() + 3600_000) e.deadline = 'Deadline must be at least 1 hour from now';
    }
    const wc = parseInt(form.winnerCount);
    if (isNaN(wc) || wc < 1 || wc > 3) e.winnerCount = 'Winners must be 1, 2, or 3';
    setErrors(e); return Object.keys(e).length === 0;
  };

  const handleNext = () => {
    if (step === 0 && !validateStep0()) {
      formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    if (step === 1 && !validateStep1()) {
      formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    const nextStep = step + 1;
    setStep(nextStep);
    if (address) try { localStorage.setItem(DRAFT_STEP_KEY(address), String(nextStep)); } catch {}
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleBack = () => {
    const prevStep = step - 1;
    setStep(prevStep);
    if (address) try { localStorage.setItem(DRAFT_STEP_KEY(address), String(prevStep)); } catch {}
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSubmit = async () => {
    if (!walletClient || !address) { toast('Connect your wallet first.', 'error'); return; }
    if (!ADDRESSES.factory) { toast('Contract address not configured.', 'error'); return; }

    setLoading(true);
    try {
      toast('Uploading metadata to IPFS...', 'info');

      const skills = Array.isArray(form.skills)
        ? form.skills
        : (form.skills ? form.skills.split(',').map(s => s.trim()).filter(Boolean) : []);
      const requirements = form.requirements.filter(r => r.trim());
      const deliverables = form.deliverables.filter(d => d.trim());

      const meta = buildBountyMeta({
        title:           form.title.trim(),
        fullDescription: form.description.trim(),
        requirements,
        evaluationCriteria: deliverables,
        skills,
        contactInfo: form.contactInfo.trim(),
        category:    form.category,
      });
      const ipfsHash = await uploadJSON(meta, `bounty-${Date.now()}`);

      const rewardWei    = ethers.parseEther(form.reward);
      const deadlineTs   = BigInt(Math.floor(new Date(form.deadline).getTime() / 1000));
      const winnerCount  = parseInt(form.winnerCount) || 1;

      // Equal split for multi-winner
      const baseWeight   = Math.floor(100 / winnerCount);
      const prizeWeights = Array(winnerCount).fill(baseWeight);
      prizeWeights[0]   += 100 - baseWeight * winnerCount; // remainder to first

      toast('Confirm transaction in your wallet...', 'info');
      const factory = await getContract(ADDRESSES.factory, FACTORY_ABI, walletClient);

      const CREATE_BOUNTY_V4_SIG = 'createBounty(string,string,string,uint8,address,uint256,uint8,uint8[],uint256,bool)';

      const runtimeCaps = await getFactoryCapabilities(true);
      if (runtimeCaps?.supportsCreateV4 === false) {
        throw new Error('Active deployment is not V4-compatible (createBounty v4 missing).');
      }
      if (toBoolSafe(form.requiresApplication, false) && runtimeCaps?.supportsApplications === false) {
        throw new Error('Active deployment does not support curated/apply flow.');
      }

      const effectiveRequiresApplication = toBoolSafe(form.requiresApplication, false);

      const stakeValueMap = new Map();
      const addStakeValue = (label, stakeRaw) => {
        try {
          const stake = BigInt(stakeRaw);
          if (stake <= 0n) return;
          if (stake > ethers.parseEther('200')) return;
          const total = rewardWei + stake;
          stakeValueMap.set(total.toString(), { label, value: total });
        } catch {
          // ignore invalid candidate
        }
      };

      if (creatorStake != null) addStakeValue('ui-preview', creatorStake);

      try {
        const stakeFromGetter = await factory.getCreatorStake(rewardWei);
        addStakeValue('getter', stakeFromGetter);
      } catch {
        // getter not available on some deployments
      }

      try {
        const [creatorStakeBps, minCreatorStake, maxCreatorStake] = await Promise.all([
          factory.CREATOR_STAKE_BPS(),
          factory.MIN_CREATOR_STAKE(),
          factory.MAX_CREATOR_STAKE(),
        ]);
        const calcStake = rewardWei * BigInt(creatorStakeBps) / 10000n;
        let stake = calcStake < minCreatorStake ? minCreatorStake : calcStake;
        if (stake > maxCreatorStake) stake = maxCreatorStake;
        addStakeValue('constants', stake);
      } catch {
        // constants not available on some deployments
      }

      const heuristicMinStake = ethers.parseEther('0.01');
      for (const bps of [100n, 200n, 250n, 300n, 400n, 500n, 1000n]) {
        let stake = (rewardWei * bps) / 10000n;
        if (stake < heuristicMinStake) stake = heuristicMinStake;
        addStakeValue(`heuristic-${bps.toString()}bps`, stake);
      }
      addStakeValue('min-only', heuristicMinStake);
      addStakeValue('min-0.005', ethers.parseEther('0.005'));
      addStakeValue('min-0.05', ethers.parseEther('0.05'));
      addStakeValue('min-0.1', ethers.parseEther('0.1'));

      const titleForContract = form.title.trim().slice(0, 100);
      const commonArgs = [
        ipfsHash,
        titleForContract,
        form.category.toLowerCase(),
        0,
        ethers.ZeroAddress,
        rewardWei,
        winnerCount,
        prizeWeights,
        deadlineTs,
      ];

      const valueCandidates = new Map();
      const addValueCandidate = (label, valueRaw) => {
        try {
          const value = BigInt(valueRaw);
          if (value < 0n) return;
          const key = value.toString();
          if (!valueCandidates.has(key)) valueCandidates.set(key, { label, value });
        } catch {
          // ignore malformed value
        }
      };

      for (const stakeCandidate of stakeValueMap.values()) {
        addValueCandidate(`stake-${stakeCandidate.label}`, stakeCandidate.value);
      }
      addValueCandidate('reward-only', rewardWei);

      const candidates = [];
      for (const entry of valueCandidates.values()) {
        candidates.push({
          sig: CREATE_BOUNTY_V4_SIG,
          args: [...commonArgs, effectiveRequiresApplication],
          value: entry.value,
          mode: `v4-${entry.label}`,
        });
      }

      if (candidates.length === 0) {
        throw new Error('No V4 createBounty candidate generated.');
      }

      let selected = null;
      let lastEstimateError = null;
      for (const c of candidates) {
        const fn = factory[c.sig];
        if (typeof fn !== 'function') continue;
        try {
          await fn.estimateGas(...c.args, { value: c.value });
          selected = c;
          break;
        } catch (e) {
          lastEstimateError = e;
        }
      }

      if (!selected) {
        throw lastEstimateError || new Error('No V4 createBounty path accepted by active deployment.');
      }

      if (import.meta.env.DEV) {
        console.debug('[PostBounty] selected create candidate', {
          mode: selected.mode,
          valueWei: selected.value.toString(),
        });
      }

      seedFactoryCapabilities({
        supportsCreateV4: true,
        supportsCreateV3: false,
        supportsApplications: runtimeCaps?.supportsApplications !== false,
        openOnlyLegacy: false,
        source: 'post-submit',
      });

      const tx = await factory[selected.sig](...selected.args, { value: selected.value });
      toast('Transaction submitted, waiting for confirmation...', 'info');
      const receipt = await tx.wait();
      const bountyId = await resolveBountyIdAfterPost(receipt, address);
      saveJustPostedHint({
        bountyId,
        title: titleForContract,
        category: form.category,
        totalReward: rewardWei.toString(),
        deadline: deadlineTs.toString(),
        creator: address,
        metaCid: ipfsHash,
        requiresApplication: effectiveRequiresApplication,
      });
      requestNotificationRefresh();
      toast('Bounty posted! Funds are now locked on-chain.', 'success');
      setDone(true);
    } catch (err) {
      console.error('[PostBounty]', err);
      const rawMsg = err?.reason || err?.shortMessage || err?.message || 'Unknown error';
      const msg = /no data present|require\\(false\\)|missing revert data|No V4 createBounty path/i.test(String(rawMsg))
        ? 'Contract reverted tanpa pesan. Cek: (1) Judul max 100 karakter, (2) reward+stake sesuai kontrak, (3) alamat deployment V4 aktif benar.'
        : rawMsg;
      toast('Failed: ' + msg, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleRestoreDraft = () => {
    try {
      const saved     = localStorage.getItem(DRAFT_KEY(address));
      const savedStep = localStorage.getItem(DRAFT_STEP_KEY(address));
      if (saved) { const parsed = JSON.parse(saved); setForm({ ...INITIAL_FORM, ...parsed, requiresApplication: toBoolSafe(parsed?.requiresApplication, false) }); }
      if (savedStep) setStep(parseInt(savedStep) || 0);
    } catch {}
    setShowDraftBanner(false);
  };

  const handleDiscardDraft = () => {
    try {
      localStorage.removeItem(DRAFT_KEY(address));
      localStorage.removeItem(DRAFT_STEP_KEY(address));
    } catch {}
    setShowDraftBanner(false);
  };

  // Check for saved draft on mount
  useEffect(() => {
    if (!address) return;
    try {
      const saved = localStorage.getItem(DRAFT_KEY(address));
      if (saved && JSON.parse(saved)) setShowDraftBanner(true);
    } catch {}
  }, [address]);

  // Clear draft on successful submit
  useEffect(() => {
    if (done && address) {
      try {
        localStorage.removeItem(DRAFT_KEY(address));
        localStorage.removeItem(DRAFT_STEP_KEY(address));
      } catch {}
    }
  }, [done, address]);

  const resetForm = () => {
    setDone(false); setStep(0);
    setForm(INITIAL_FORM); setErrors({});
    setCreatorStake(null);
    if (address) {
      try {
        localStorage.removeItem(DRAFT_KEY(address));
        localStorage.removeItem(DRAFT_STEP_KEY(address));
      } catch {}
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // â”€â”€ Not connected â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  if (!isConnected) {
    return (
      <div style={{ maxWidth: 480, margin: '0 auto', padding: 'clamp(64px,10vh,120px) 24px', textAlign: 'center' }}>
        <div style={{
          width: 64, height: 64, borderRadius: '50%',
          background: theme.colors.primaryDim, border: `1px solid ${theme.colors.primaryBorder}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 24px', fontSize: 24,
        }}>O</div>
        <h2 style={{ fontFamily: theme.fonts.body, fontWeight: 700, fontSize: 22, letterSpacing: '-0.03em', color: theme.colors.text.primary, marginBottom: 10 }}>Connect your wallet</h2>
        <p style={{ fontSize: 13.5, color: theme.colors.text.muted, fontWeight: 300, lineHeight: 1.7 }}>
          You need a connected wallet to post a bounty and lock reward funds on-chain.
        </p>
      </div>
    );
  }

  // â”€â”€ Done â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  if (done) {
    return (
      <div style={{ maxWidth: 480, margin: '0 auto', padding: 'clamp(64px,10vh,120px) 24px', textAlign: 'center' }}>
        <div style={{
          width: 72, height: 72, borderRadius: '50%',
          background: theme.colors.primaryDim, border: `1px solid ${theme.colors.primaryBorder}`,
          boxShadow: `0 0 48px ${theme.colors.primaryGlow}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 28px', fontSize: 28, color: theme.colors.primary,
        }}>O</div>
        <h2 style={{ fontFamily: theme.fonts.body, fontWeight: 800, fontSize: 28, letterSpacing: '-0.04em', color: theme.colors.text.primary, marginBottom: 10 }}>Bounty Posted!</h2>
        <p style={{ fontSize: 14, color: theme.colors.text.muted, fontWeight: 300, marginBottom: 32, lineHeight: 1.7 }}>
          Your bounty is live on Monad. Funds are locked in the smart contract - builders can start submitting work.
        </p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
          <Button variant="primary" onClick={() => { window.location.hash = '#/bounties'; }}>
            Browse Bounties
          </Button>
          <Button variant="secondary" onClick={resetForm}>Post Another</Button>
        </div>
      </div>
    );
  }

  // â”€â”€ Form â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  return (
    <div
      ref={formRef}
      style={{ maxWidth: 680, margin: '0 auto', padding: 'clamp(32px,5vw,56px) clamp(16px,4vw,40px)' }}
    >
      {/* Page header */}
      <div style={{ marginBottom: 32 }}>
        <div className="page-eyebrow">Post a Bounty</div>
        <h1 style={{
          fontFamily: theme.fonts.body, fontWeight: 800,
          fontSize: 'clamp(26px,4vw,38px)', letterSpacing: '-0.04em',
          color: theme.colors.text.primary, marginBottom: 6,
        }}>
          {step === 0 ? 'Describe the task' : step === 1 ? 'Set reward & deadline' : 'Review & confirm'}
        </h1>
        <p style={{ fontSize: 13.5, color: theme.colors.text.muted, fontWeight: 300 }}>
          {step === 0 && 'Help builders understand exactly what you need.'}
          {step === 1 && 'Define the reward, number of winners, and deadline.'}
          {step === 2 && 'Review everything before locking funds on-chain.'}
        </p>
      </div>

      {/* Draft banner */}
      {showDraftBanner && (
        <div style={{
          padding: '14px 18px', marginBottom: 24,
          background: theme.colors.primaryDim,
          border: `1px solid ${theme.colors.primaryBorder}`,
          borderRadius: theme.radius.lg,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexWrap: 'wrap', gap: 10,
        }}>
          <div>
            <div style={{ fontFamily: theme.fonts.body, fontWeight: 600, fontSize: 13.5, color: theme.colors.primaryLight, marginBottom: 2 }}>Draft saved</div>
            <div style={{ fontFamily: theme.fonts.body, fontSize: 12, color: theme.colors.text.muted }}>Continue from where you left off?</div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={handleRestoreDraft} style={{
              padding: '7px 16px', borderRadius: theme.radius.md,
              background: theme.colors.primary, color: '#fff',
              border: 'none', fontFamily: theme.fonts.body,
              fontSize: 12, fontWeight: 600, cursor: 'pointer',
            }}>Continue Draft</button>
            <button onClick={handleDiscardDraft} style={{
              padding: '7px 16px', borderRadius: theme.radius.md,
              background: 'transparent', color: theme.colors.text.muted,
              border: `1px solid ${theme.colors.border.default}`,
              fontFamily: theme.fonts.body, fontSize: 12, cursor: 'pointer',
            }}>Start Fresh</button>
          </div>
        </div>
      )}

      <StepIndicator current={step} />

      {/* â”€â”€ Step 0: Task â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      {step === 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>

          {/* Title */}
          <FormInput
            label="Title" required
            hint="Max 100 characters (smart contract limit)"
            placeholder="e.g. Build a Monad DEX aggregator UI"
            maxLength={100}
            value={form.title}
            onChange={e => set('title', e.target.value)}
            error={errors.title}
          />

          {/* Category */}
          <div>
            <FieldLabel>Category</FieldLabel>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 8 }}>
              {CATEGORIES.map(c => {
                const active = form.category === c.key;
                return (
                  <button
                    key={c.key}
                    onClick={() => set('category', c.key)}
                    style={{
                      padding: '10px 14px', textAlign: 'left',
                      background: active ? theme.colors.primaryDim : theme.colors.bg.elevated,
                      color: active ? theme.colors.primary : theme.colors.text.secondary,
                      border: `1px solid ${active ? theme.colors.primary : theme.colors.border.subtle}`,
                      borderRadius: theme.radius.md, cursor: 'pointer',
                      transition: theme.transition,
                      boxShadow: active ? `0 0 0 1px ${theme.colors.primary}` : 'none',
                    }}
                    onMouseEnter={e => { if (!active) { e.currentTarget.style.borderColor = theme.colors.border.default; e.currentTarget.style.background = theme.colors.bg.hover; } }}
                    onMouseLeave={e => { if (!active) { e.currentTarget.style.borderColor = theme.colors.border.subtle; e.currentTarget.style.background = theme.colors.bg.elevated; } }}
                  >
                    <div style={{ marginBottom: 4, display: 'flex', justifyContent: 'center' }}><c.Icon size={20} color={active ? theme.colors.primary : theme.colors.text.muted} /></div>
                    <div style={{ fontFamily: theme.fonts.body, fontWeight: 600, fontSize: 13 }}>{c.key}</div>
                    <div style={{ fontFamily: theme.fonts.body, fontSize: 10.5, color: active ? `${theme.colors.primary}99` : theme.colors.text.faint, marginTop: 2 }}>{c.desc}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Description */}
          <FormTextarea
            label="Overview" required
            hint="Describe the project context and what needs to be built or done."
            placeholder="Provide a clear overview of the task, technical context, and goals. The more specific you are, the better submissions you'll receive."
            value={form.description}
            onChange={e => set('description', e.target.value)}
            error={errors.description}
            minHeight={130}
          />

          {/* Requirements */}
          <div>
            <ListEditor
              label="Requirements" required
              hint="Step-by-step tasks the builder must complete."
              items={form.requirements}
              onChange={v => set('requirements', v)}
              placeholder="e.g. Implement ERC-20 token swap using Uniswap V3"
            />
            {errors.requirements && (
              <div style={{ fontFamily: theme.fonts.body, fontSize: 11.5, color: theme.colors.red[400], marginTop: 4 }}>{errors.requirements}</div>
            )}
          </div>

          {/* Deliverables */}
          <ListEditor
            label="Deliverables"
            hint="What the builder must submit as proof of work."
            items={form.deliverables}
            onChange={v => set('deliverables', v)}
            placeholder="e.g. GitHub repo with tests, Loom walkthrough video"
          />

          {/* Skills */}
          <TagInput
            label="Required Skills"
            hint="Helps builders self-select for the task."
            value={form.skills}
            onChange={v => set('skills', v)}
          />
        </div>
      )}

      {/* â”€â”€ Step 1: Reward â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      {step === 1 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>

          {/* Reward */}
          <div className="reward-amount-field">
            <FieldLabel required hint="Reward paid to the winner(s). Denominated in MON.">Reward Amount</FieldLabel>
            <div style={{ position: 'relative' }}>
              <FormInput
                placeholder="e.g. 2.5"
                type="number" min="0.001" step="0.1" inputMode="decimal"
                value={form.reward}
                onChange={e => {
                  set('reward', e.target.value);
                  const r = parseFloat(e.target.value);
                  if (errors.reward && r > 0 && !isNaN(r) && r >= 0.001) {
                    setErrors(prev => { const n = { ...prev }; delete n.reward; return n; });
                  }
                }}
                error={errors.reward}
              />
              <span style={{
                position: 'absolute', right: 14, top: '50%',
                transform: `translateY(${errors.reward ? '-60%' : '-50%'})`,
                fontFamily: theme.fonts.mono, fontSize: 12,
                color: theme.colors.text.muted, pointerEvents: 'none',
              }}>MON</span>
            </div>

            {/* Cost breakdown */}
            {form.reward && !isNaN(parseFloat(form.reward)) && parseFloat(form.reward) > 0 && (
              <div style={{
                marginTop: 10, padding: '12px 14px',
                background: theme.colors.bg.card,
                border: `1px solid ${theme.colors.border.subtle}`,
                borderRadius: theme.radius.md,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontFamily: theme.fonts.mono, fontSize: 10.5, color: theme.colors.text.faint, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Reward</span>
                  <span style={{ fontFamily: theme.fonts.mono, fontSize: 11.5, color: theme.colors.text.secondary }}>{parseFloat(form.reward).toFixed(4)} MON</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, paddingBottom: 8, borderBottom: `1px solid ${theme.colors.border.faint}` }}>
                  <span style={{ fontFamily: theme.fonts.mono, fontSize: 10.5, color: theme.colors.text.faint, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Creator Stake (~3%, max 50 MON)</span>
                  <span style={{ fontFamily: theme.fonts.mono, fontSize: 11.5, color: theme.colors.text.muted }}>
                    {creatorStake
                      ? (Number(creatorStake) / 1e18).toFixed(4)
                      : Math.min(parseFloat(form.reward) * 0.03, 50).toFixed(4)
                    } MON
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontFamily: theme.fonts.mono, fontSize: 10.5, color: theme.colors.text.secondary, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Total Required</span>
                  <span style={{ fontFamily: theme.fonts.mono, fontSize: 12, color: theme.colors.primary, fontWeight: 600 }}>
                    {totalLocked
                      ? (Number(totalLocked) / 1e18).toFixed(4)
                      : (parseFloat(form.reward) + Math.min(parseFloat(form.reward) * 0.03, 50)).toFixed(4)
                    } MON
                  </span>
                </div>
                <div style={{ marginTop: 8, fontFamily: theme.fonts.body, fontSize: 11, color: theme.colors.text.faint, lineHeight: 1.5 }}>
                  Creator stake is returned when the bounty completes. If abandoned, it goes to the protocol.
                </div>
              </div>
            )}
          </div>

          {/* Number of Winners */}
          <div>
            <FieldLabel hint="Up to 3 winners can be rewarded. Reward splits equally.">Number of Winners</FieldLabel>
            <div style={{ display: 'flex', gap: 8 }}>
              {['1', '2', '3'].map(n => {
                const active = form.winnerCount === n;
                return (
                  <button
                    key={n}
                    onClick={() => set('winnerCount', n)}
                    style={{
                      width: 56, height: 48,
                      background: active ? theme.colors.primaryDim : theme.colors.bg.elevated,
                      color: active ? theme.colors.primary : theme.colors.text.secondary,
                      border: `1.5px solid ${active ? theme.colors.primary : theme.colors.border.subtle}`,
                      borderRadius: theme.radius.md,
                      fontFamily: theme.fonts.mono, fontSize: 18, fontWeight: 600,
                      cursor: 'pointer', transition: theme.transition,
                    }}
                  >{n}</button>
                );
              })}
            </div>
            {form.winnerCount !== '1' && form.reward && !isNaN(parseFloat(form.reward)) && (
              <div style={{ fontFamily: theme.fonts.body, fontSize: 11.5, color: theme.colors.text.faint, marginTop: 6 }}>
                Each winner receives ~{(parseFloat(form.reward) / parseInt(form.winnerCount)).toFixed(4)} MON
              </div>
            )}
          </div>

          {/* Deadline - split date + time for cleaner, more consistent picker UI */}
          <div>
            <FieldLabel required hint="Builders have until this date to submit work.">Submission Deadline</FieldLabel>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ fontFamily: theme.fonts.mono, fontSize: 10, color: theme.colors.text.faint, textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>Date</label>
                <input
                  type="date"
                  value={form.deadline ? form.deadline.slice(0, 10) : ''}
                  min={new Date(Date.now() + 3600_000).toISOString().slice(0, 10)}
                  onChange={e => {
                    const d = e.target.value;
                    const t = form.deadline ? form.deadline.slice(11, 16) : '12:00';
                    set('deadline', d && t ? `${d}T${t}:00` : d || '');
                    if (errors.deadline && d) setErrors(prev => { const n = { ...prev }; delete n.deadline; return n; });
                  }}
                  style={{
                    width: '100%', padding: '10px 14px',
                    background: theme.colors.bg.input, color: theme.colors.text.primary,
                    border: `1px solid ${errors.deadline ? theme.colors.red[500] : theme.colors.border.default}`,
                    borderRadius: theme.radius.md, fontSize: 14,
                    fontFamily: theme.fonts.body, outline: 'none',
                    boxSizing: 'border-box', colorScheme: 'dark',
                  }}
                />
              </div>
              <div>
                <label style={{ fontFamily: theme.fonts.mono, fontSize: 10, color: theme.colors.text.faint, textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>Time</label>
                <input
                  type="time"
                  value={form.deadline ? form.deadline.slice(11, 16) : ''}
                  onChange={e => {
                    const t = e.target.value;
                    const d = form.deadline ? form.deadline.slice(0, 10) : new Date(Date.now() + 3600_000).toISOString().slice(0, 10);
                    set('deadline', d && t ? `${d}T${t}:00` : (form.deadline?.slice(0, 10) || ''));
                    if (errors.deadline && t) setErrors(prev => { const n = { ...prev }; delete n.deadline; return n; });
                  }}
                  style={{
                    width: '100%', padding: '10px 14px',
                    background: theme.colors.bg.input, color: theme.colors.text.primary,
                    border: `1px solid ${errors.deadline ? theme.colors.red[500] : theme.colors.border.default}`,
                    borderRadius: theme.radius.md, fontSize: 14,
                    fontFamily: theme.fonts.body, outline: 'none',
                    boxSizing: 'border-box', colorScheme: 'dark',
                  }}
                />
              </div>
            </div>
            {form.deadline && (
              <div style={{ fontFamily: theme.fonts.body, fontSize: 11.5, color: theme.colors.text.muted, marginTop: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                <IconChevronRight size={12} color={theme.colors.text.muted} /> {new Date(form.deadline).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
              </div>
            )}
            {errors.deadline && (
              <div style={{ fontFamily: theme.fonts.body, fontSize: 11.5, color: theme.colors.red[400], marginTop: 4 }}>{errors.deadline}</div>
            )}
          </div>

          {/* Contact */}
          <FormInput
            label="Contact (optional)"
            hint="Where builders can reach you for questions."
            placeholder="@telegram_handle or discord username"
            value={form.contactInfo}
            onChange={e => set('contactInfo', e.target.value)}
          />

          {/* V4: Bounty type - Open or Curated */}
          <div>
            <FieldLabel hint="Open bounty: anyone with a username can submit. Curated project: builders apply first, you approve who can submit.">
              Submission Mode
            </FieldLabel>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {[
                { val: false, Icon: IconBounties, label: 'Open Bounty', desc: 'Any registered builder can submit directly.' },
                ...(!applicationFlowUnsupported
                  ? [{ val: true, Icon: IconTarget, label: 'Curated Project', desc: 'Builders apply first; you choose who proceeds.' }]
                  : []),
              ].map(opt => {
                const active = form.requiresApplication === opt.val;
                return (
                  <button
                    key={String(opt.val)}
                    onClick={() => set('requiresApplication', opt.val)}
                    style={{
                      flex: 1, minWidth: 160,
                      display: 'flex', flexDirection: 'column', gap: 4,
                      padding: '12px 14px', textAlign: 'left',
                      background: active ? theme.colors.primaryDim : theme.colors.bg.elevated,
                      border: `1.5px solid ${active ? theme.colors.primary : theme.colors.border.subtle}` ,
                      borderRadius: theme.radius.lg, cursor: 'pointer',
                      transition: theme.transition,
                    }}
                    onMouseEnter={e => { if (!active) { e.currentTarget.style.borderColor = theme.colors.border.default; } }}
                    onMouseLeave={e => { if (!active) { e.currentTarget.style.borderColor = theme.colors.border.subtle; } }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                      <opt.Icon size={16} color={active ? theme.colors.primary : theme.colors.text.muted} style={{ flexShrink: 0 }} />
                      <span style={{
                        fontFamily: theme.fonts.body, fontWeight: 600, fontSize: 13,
                        color: active ? theme.colors.primaryLight : theme.colors.text.primary,
                      }}>{opt.label}</span>
                    </div>
                    <span style={{
                      fontFamily: theme.fonts.body, fontSize: 11.5,
                      color: theme.colors.text.muted, lineHeight: 1.5,
                    }}>{opt.desc}</span>
                  </button>
                );
              })}
            </div>
            {applicationFlowUnsupported && (
              <div style={{
                marginTop: 8,
                padding: '10px 12px',
                background: 'rgba(110,84,255,0.04)',
                border: `1px solid ${theme.colors.primaryBorder}` ,
                borderRadius: theme.radius.md,
                fontFamily: theme.fonts.body,
                fontSize: 11.5,
                color: theme.colors.text.muted,
              }}>
                Deployment ini belum mendukung application flow. Semua bounty diposting sebagai Open.
              </div>
            )}
          </div>
          {/* Escrow notice */}
          <div style={{
            padding: '14px 16px',
            background: 'rgba(110,84,255,0.04)',
            border: `1px solid ${theme.colors.primaryBorder}`,
            borderRadius: theme.radius.md,
            display: 'flex', gap: 12, alignItems: 'flex-start',
          }}>
            <IconBounties size={18} color={theme.colors.primary} style={{ flexShrink: 0, marginTop: 1 }} />
            <div>
              <div style={{ fontFamily: theme.fonts.body, fontSize: 13, color: theme.colors.primaryLight, fontWeight: 500, marginBottom: 3 }}>
                Funds are locked trustlessly
              </div>
              <div style={{ fontFamily: theme.fonts.body, fontSize: 12, color: theme.colors.text.muted, lineHeight: 1.6 }}>
                When you post, the reward + creator stake will be locked into the smart contract. The contract automatically releases funds to the approved winner. If no winner is approved before the deadline, you can reclaim your reward.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* â”€â”€ Step 2: Review â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      {step === 2 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Summary card */}
          <div style={{
            background: theme.colors.bg.card,
            border: `1px solid ${theme.colors.border.default}`,
            borderRadius: theme.radius.xl, overflow: 'hidden',
          }}>
            <div style={{ padding: '10px 18px', background: theme.colors.bg.panel, borderBottom: `1px solid ${theme.colors.border.faint}` }}>
              <span style={{ fontFamily: theme.fonts.mono, fontSize: 9.5, color: theme.colors.text.faint, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Bounty Summary</span>
            </div>

            <ReviewRow label="Title"    value={form.title} />
            <ReviewRow label="Category" value={form.category} />
            <ReviewRow label="Reward"   value={`${form.reward} MON`} accent mono />
            {form.winnerCount !== '1' && <ReviewRow label="Winners" value={`${form.winnerCount} (equal split)`} mono />}
            <ReviewRow label="Deadline" value={form.deadline ? new Date(form.deadline).toLocaleString() : '-'} />
            <ReviewRow label="Mode"     value={applicationFlowUnsupported ? 'Open (direct submit)' : (form.requiresApplication ? 'Curated (apply-first)' : 'Open (direct submit)')} />
            {form.contactInfo && <ReviewRow label="Contact" value={form.contactInfo} />}
          </div>

          {/* Description preview */}
          {form.description?.trim() && (
            <div style={{
              background: theme.colors.bg.card,
              border: `1px solid ${theme.colors.border.subtle}`,
              borderRadius: theme.radius.lg, overflow: 'hidden',
            }}>
              <div style={{ padding: '8px 18px', borderBottom: `1px solid ${theme.colors.border.faint}`, background: theme.colors.bg.panel }}>
                <span style={{ fontFamily: theme.fonts.mono, fontSize: 9.5, color: theme.colors.text.faint, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Description</span>
              </div>
              <div style={{ padding: '14px 18px', fontFamily: theme.fonts.body, fontSize: 13, color: theme.colors.text.secondary, lineHeight: 1.7, whiteSpace: 'pre-wrap', maxHeight: 200, overflowY: 'auto' }}>
                {form.description.trim()}
              </div>
            </div>
          )}

          {/* Requirements preview */}
          {form.requirements.filter(r => r.trim()).length > 0 && (
            <div style={{
              background: theme.colors.bg.card,
              border: `1px solid ${theme.colors.border.subtle}`,
              borderRadius: theme.radius.lg, overflow: 'hidden',
            }}>
              <div style={{ padding: '8px 18px', borderBottom: `1px solid ${theme.colors.border.faint}`, background: theme.colors.bg.panel }}>
                <span style={{ fontFamily: theme.fonts.mono, fontSize: 9.5, color: theme.colors.text.faint, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Requirements</span>
              </div>
              <div style={{ padding: '10px 18px' }}>
                {form.requirements.filter(r => r.trim()).map((r, i) => (
                  <div key={i} style={{ display: 'flex', gap: 10, padding: '5px 0', borderBottom: i < form.requirements.filter(x=>x.trim()).length - 1 ? `1px solid ${theme.colors.border.faint}` : 'none' }}>
                    <span style={{ fontFamily: theme.fonts.mono, fontSize: 10, color: theme.colors.primary, flexShrink: 0, marginTop: 2 }}>{i + 1}.</span>
                    <span style={{ fontFamily: theme.fonts.body, fontSize: 13, color: theme.colors.text.secondary, lineHeight: 1.5 }}>{r}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Deliverables preview */}
          {form.deliverables.filter(d => d.trim()).length > 0 && (
            <div style={{
              background: theme.colors.bg.card,
              border: `1px solid ${theme.colors.border.subtle}`,
              borderRadius: theme.radius.lg, overflow: 'hidden',
            }}>
              <div style={{ padding: '8px 18px', borderBottom: `1px solid ${theme.colors.border.faint}`, background: theme.colors.bg.panel }}>
                <span style={{ fontFamily: theme.fonts.mono, fontSize: 9.5, color: theme.colors.text.faint, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Deliverables</span>
              </div>
              <div style={{ padding: '10px 18px' }}>
                {form.deliverables.filter(d => d.trim()).map((d, i) => (
                  <div key={i} style={{ display: 'flex', gap: 10, padding: '5px 0', borderBottom: i < form.deliverables.filter(x=>x.trim()).length - 1 ? `1px solid ${theme.colors.border.faint}` : 'none' }}>
                    <IconChevronRight size={10} color={theme.colors.cyan} style={{ flexShrink: 0, marginTop: 2 }} />
                    <span style={{ fontFamily: theme.fonts.body, fontSize: 13, color: theme.colors.text.secondary, lineHeight: 1.5 }}>{d}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Cost summary */}
          <div style={{
            padding: '14px 16px',
            background: theme.colors.primaryDim,
            border: `1px solid ${theme.colors.primaryBorder}`,
            borderRadius: theme.radius.md,
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <div>
              <div style={{ fontFamily: theme.fonts.body, fontSize: 12, color: theme.colors.text.muted, marginBottom: 2 }}>Total to lock from your wallet</div>
              <div style={{ fontFamily: theme.fonts.mono, fontSize: 18, color: theme.colors.primary, fontWeight: 600, letterSpacing: '-0.02em' }}>
                {totalLocked
                  ? (Number(totalLocked) / 1e18).toFixed(4)
                  : form.reward ? (parseFloat(form.reward) * 1.05).toFixed(4) : '-'
                } MON
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontFamily: theme.fonts.body, fontSize: 11, color: theme.colors.text.faint, lineHeight: 1.6 }}>
                reward + creator stake<br />
                <span style={{ color: theme.colors.text.muted }}>stake returned on completion</span>
              </div>
            </div>
          </div>

          <p style={{ fontFamily: theme.fonts.body, fontSize: 11.5, color: theme.colors.text.faint, lineHeight: 1.6, textAlign: 'center' }}>
            By posting, you authorize the smart contract to hold these funds. No central party can access them.
          </p>
        </div>
      )}

      {/* â”€â”€ Navigation â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 36, gap: 10 }}>
        {step > 0 ? (
          <Button variant="ghost" icon={<IconChevronLeft size={14} color="currentColor" />} onClick={handleBack}>Back</Button>
        ) : (
          <div />
        )}

        {step < STEPS.length - 1 ? (
          <Button variant="primary" iconRight={<IconChevronRight size={14} color="currentColor" />} onClick={handleNext}>
            Continue
          </Button>
        ) : (
          <Button variant="primary" loading={loading} onClick={handleSubmit}>
            Post & Lock Funds
          </Button>
        )}
      </div>
    </div>
  );
}
































