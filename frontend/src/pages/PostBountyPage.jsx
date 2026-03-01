import React, { useState, useCallback, useEffect } from 'react';
import { useAccount, useWalletClient } from 'wagmi';
import { useConnectModal } from '@rainbow-me/rainbowkit';
import { ethers } from 'ethers';
import { motion, AnimatePresence } from 'framer-motion';
import { theme as t } from '@/styles/theme.js';
import Card from '@/components/common/Card.jsx';
import Button from '@/components/common/Button.jsx';
import Input from '@/components/common/Input.jsx';
import { uploadJSON, buildBountyMeta } from '@/config/pinata.js';
import { getContract, getReadContract } from '@/utils/ethers.js';
import { ADDRESSES, FACTORY_ABI, ERC20_ABI, CATEGORIES, CATEGORY_LABELS } from '@/config/contracts.js';
import { toast } from '@/utils/toast.js';
import { IconFolder, IconSave, IconTarget, IconWarning, IconCheck, IconBack, IconChevronRight } from '@/components/icons/index.jsx';

const TEMPLATE_KEY = 'nadwork_bounty_templates';

function loadTemplates() {
  try { return JSON.parse(localStorage.getItem(TEMPLATE_KEY) || '[]'); } catch { return []; }
}

function saveTemplate(form) {
  const templates = loadTemplates();
  const name = prompt('Template name:', form.title || 'My Template');
  if (!name) return;
  const t = { id: Date.now(), name, data: form };
  localStorage.setItem(TEMPLATE_KEY, JSON.stringify([t, ...templates.slice(0, 9)]));
  return true;
}

// ── Deadline picker ────────────────────────────────────────────────────────
function DeadlinePicker({ value, onChange }) {
  const PRESETS = [
    { label: '7d',    days: 7   },
    { label: '14d',   days: 14  },
    { label: '30d',   days: 30  },
    { label: '60d',   days: 60  },
    { label: '90d',   days: 90  },
    { label: '~6mo',  days: 180 },
  ];

  const toLocalISO = (date) => {
    const p = n => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${p(date.getMonth()+1)}-${p(date.getDate())}T${p(date.getHours())}:${p(date.getMinutes())}`;
  };

  const setPreset = (days) => {
    // For 180d: use 179 days + noon to stay well under the strict < 180 days contract check.
    // The contract uses block.timestamp at tx time which is slightly ahead of Date.now().
    const effectiveDays = days >= 180 ? 179 : days;
    const d = new Date(Date.now() + effectiveDays * 86400 * 1000);
    // For max preset use noon; for others end-of-day is fine
    d.setHours(days >= 180 ? 12 : 23, days >= 180 ? 0 : 59, 0, 0);
    onChange(toLocalISO(d));
  };

  const selectedDays  = value ? Math.round((new Date(value).getTime() - Date.now()) / 86400000) : null;
  const minVal = toLocalISO(new Date(Date.now() + 3600 * 1000));
  // Cap at 179 days + 12h so the picker never lets the user choose a date that will fail the contract's strict < 180 days check
  const maxVal = toLocalISO(new Date(Date.now() + 179 * 86400 * 1000 + 43200 * 1000));

  const inputStyle = {
    background: t.colors.bg.base, border: '1px solid ' + t.colors.border.default,
    borderRadius: t.radius.md, padding: '9px 13px', color: t.colors.text.primary,
    fontSize: '14px', outline: 'none', width: '100%', colorScheme: 'dark',
    fontFamily: t.fonts.body,
  };

  return (
    <div>
      <label style={{ fontSize: '13px', fontWeight: 500, color: t.colors.text.secondary, display: 'block', marginBottom: '8px' }}>
        Deadline
        <span style={{ fontSize: '11px', color: t.colors.text.muted, fontWeight: 400, marginLeft: '6px' }}>max ~179 days</span>
      </label>
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '10px' }}>
        {PRESETS.map(p => {
          const active = selectedDays !== null && Math.abs(selectedDays - p.days) <= 1;
          return (
            <button key={p.days} type="button" onClick={() => setPreset(p.days)} style={{
              padding: '4px 11px', borderRadius: '99px', cursor: 'pointer', transition: t.transition,
              border: '1px solid ' + (active ? t.colors.primary : t.colors.border.default),
              background: active ? 'rgba(124,58,237,0.15)' : 'transparent',
              color: active ? '#818cf8' : t.colors.text.muted,
              fontSize: '11px', fontWeight: 500,
            }}>{p.label}</button>
          );
        })}
      </div>
      <input type="datetime-local" value={value} min={minVal} max={maxVal}
        onChange={e => onChange(e.target.value)} style={inputStyle} />
      {value && (
        <div style={{ marginTop: '6px', fontSize: '12px', color: t.colors.green[400], display: 'flex', alignItems: 'center', gap: '5px' }}>
          <IconCheck size={12} color={t.colors.green[400]} />
          <span>{new Date(value).toLocaleString('en', { dateStyle: 'medium', timeStyle: 'short' })}</span>
        </div>
      )}
    </div>
  );
}

// ── Step indicator ────────────────────────────────────────────────────────
const STEP_LABELS = ['Details', 'Reward', 'Review'];

function StepBar({ current }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0', marginBottom: '2.5rem' }}>
      {STEP_LABELS.map((label, i) => {
        const done   = i < current;
        const active = i === current;
        return (
          <React.Fragment key={label}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
              <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: done ? '#10b981' : active ? t.colors.primary : 'transparent', border: '2px solid ' + (done ? '#10b981' : active ? t.colors.primary : t.colors.border.default), display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '12px', color: done || active ? '#fff' : t.colors.text.muted, transition: 'all 0.25s ease', flexShrink: 0 }}>
                {done ? <IconCheck size={13} color="#fff" /> : i + 1}
              </div>
              <span style={{ fontSize: '11px', fontWeight: active ? 600 : 400, color: active ? t.colors.text.primary : t.colors.text.muted, whiteSpace: 'nowrap' }}>{label}</span>
            </div>
            {i < 2 && (
              <div style={{ flex: 1, height: '2px', margin: '0 6px', marginBottom: '16px', background: i < current ? 'linear-gradient(90deg, #10b981, #7c3aed)' : t.colors.border.default, transition: 'background 0.3s ease' }} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

// ── Default form state ─────────────────────────────────────────────────────
const DEFAULT_FORM = {
  title: '', shortDescription: '', description: '',
  requirements: [''], evaluationCriteria: [''],
  skills: '', estimatedHours: '', contactInfo: '',
  category: 'dev', deadlineDate: '',
  rewardType: 0, rewardAmount: '', winnerCount: 1, prizeWeights: [100],
  rewardToken: '',
};

// ── Main component ─────────────────────────────────────────────────────────
export default function PostBountyPage() {
  const { address }  = useAccount();
  const { data: wc } = useWalletClient();
  const { openConnectModal } = useConnectModal();

  const [step, setStep]       = useState(0);
  const [submitting, setSub]  = useState(false);
  const [form, setForm]       = useState(DEFAULT_FORM);
  const [templates, setTemplates] = useState(loadTemplates);
  const [showTemplates, setShowTemplates] = useState(false);
  const [posterStakeWei, setPosterStakeWei] = useState(ethers.parseEther('0.005'));

  const set = (key, val) => setForm(p => ({ ...p, [key]: val }));

  // Warn user before navigating away with unsaved form data
  useEffect(() => {
    const hasContent = form.title || form.description || form.rewardAmount;
    if (!hasContent) return;
    const warn = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [form.title, form.description, form.rewardAmount]);

  // Requirements list helpers
  const addReq    = ()     => setForm(p => ({ ...p, requirements: [...p.requirements, ''] }));
  const removeReq = (i)    => setForm(p => ({ ...p, requirements: p.requirements.filter((_, j) => j !== i) }));
  const setReq    = (i, v) => setForm(p => ({ ...p, requirements: p.requirements.map((r, j) => j === i ? v : r) }));

  // Evaluation criteria helpers
  const addCrit    = ()     => setForm(p => ({ ...p, evaluationCriteria: [...p.evaluationCriteria, ''] }));
  const removeCrit = (i)    => setForm(p => ({ ...p, evaluationCriteria: p.evaluationCriteria.filter((_, j) => j !== i) }));
  const setCrit    = (i, v) => setForm(p => ({ ...p, evaluationCriteria: p.evaluationCriteria.map((r, j) => j === i ? v : r) }));

  const setWinnerCount = (n) => {
    const w = n === 1 ? [100] : n === 2 ? [60, 40] : [60, 30, 10]; // max 3 in V2
    setForm(p => ({ ...p, winnerCount: n, prizeWeights: w }));
  };

  const updateWeight = (i, val) => {
    const weights = [...form.prizeWeights];
    weights[i] = Math.max(0, Math.min(100, Number(val) || 0));
    setForm(p => ({ ...p, prizeWeights: weights }));
  };

  const handleSaveTemplate = () => {
    if (saveTemplate(form)) {
      setTemplates(loadTemplates());
      toast('Template saved!', 'success');
    }
  };

  const handleLoadTemplate = (tmpl) => {
    setForm({ ...DEFAULT_FORM, ...tmpl.data });
    setShowTemplates(false);
    setStep(0);
    toast('Template loaded: ' + tmpl.name, 'success');
  };

  const handleDeleteTemplate = (id) => {
    const updated = templates.filter(t => t.id !== id);
    localStorage.setItem(TEMPLATE_KEY, JSON.stringify(updated));
    setTemplates(updated);
  };

  const MAX_DAYS  = 180;
  const weightSum = form.prizeWeights.reduce((a, b) => a + b, 0);
  const deadline  = form.deadlineDate ? Math.floor(new Date(form.deadlineDate).getTime() / 1000) : 0;

  // Mirrors BountyFactory._calcReviewDeadline — used in Step 3 summary
  function calcReviewWindowSecs(deadlineSec) {
    if (!deadlineSec) return 0;
    const nowSec = Math.floor(Date.now() / 1000);
    const duration = deadlineSec - nowSec;
    if (duration <= 0) return 86400; // fallback 24h
    const MIN_RW = 86400;     // 24h
    const MAX_RW = 604800;    // 7d
    let window = Math.floor(duration / 5);
    if (window < MIN_RW) window = MIN_RW;
    if (window > MAX_RW) window = MAX_RW;
    return window;
  }

  function fmtSecs(s) {
    const d = Math.floor(s / 86400);
    const h = Math.floor((s % 86400) / 3600);
    if (d > 0 && h > 0) return `${d}d ${h}h`;
    if (d > 0) return `${d}d`;
    return `${h}h`;
  }

  // ERC20 decimals — fetched from contract; default 6 (USDC) until resolved
  const [erc20Decimals, setErc20Decimals] = useState(6);
  useEffect(() => {
    if (form.rewardType !== 1) return;
    const tokenAddr = form.rewardToken || ADDRESSES.usdc;
    if (!tokenAddr) return;
    let cancelled = false;
    getReadContract(tokenAddr, ['function decimals() view returns (uint8)'])
      .decimals()
      .then(d => { if (!cancelled) setErc20Decimals(Number(d)); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [form.rewardType, form.rewardToken]);

  const totalWei  = (() => {
    try {
      if (!form.rewardAmount || parseFloat(form.rewardAmount) <= 0) return 0n;
      return form.rewardType === 0
        ? ethers.parseEther(form.rewardAmount)
        : ethers.parseUnits(form.rewardAmount, erc20Decimals);
    } catch { return 0n; }
  })();

  const MIN_POSTER_STAKE = ethers.parseEther('0.005');

  // Fetch exact poster stake from contract so msg.value matches exactly (avoids "wrong MON amount" revert)
  useEffect(() => {
    let cancelled = false;
    async function fetchStake() {
      if (!ADDRESSES.factory) return;
      // ERC20 bounties: stake is always MIN_POSTER_STAKE (flat MON), no need to query
      if (form.rewardType === 1) {
        setPosterStakeWei(MIN_POSTER_STAKE);
        return;
      }
      if (totalWei === 0n) {
        setPosterStakeWei(MIN_POSTER_STAKE);
        return;
      }
      try {
        const factory = getReadContract(ADDRESSES.factory, ['function getPosterStake(uint256) pure returns (uint256)']);
        const stake = await factory.getPosterStake(totalWei);
        if (!cancelled) setPosterStakeWei(stake);
      } catch {
        // fallback: local calculation mirrors contract formula
        const POSTER_STAKE_BPS = 500n;
        const pct = (totalWei * POSTER_STAKE_BPS) / 10_000n;
        if (!cancelled) setPosterStakeWei(pct < MIN_POSTER_STAKE ? MIN_POSTER_STAKE : pct);
      }
    }
    fetchStake();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalWei, form.rewardType]);

  const posterStakeMon = parseFloat(ethers.formatEther(posterStakeWei)).toFixed(4);

  const handlePublish = async () => {
    if (!wc || !address)  { toast('Connect wallet first', 'warning'); return; }
    if (!form.title.trim()) { toast('Title required', 'error'); return; }
    if (!form.rewardAmount || parseFloat(form.rewardAmount) <= 0) { toast('Enter reward amount', 'error'); return; }
    if (!deadline || deadline < Math.floor(Date.now() / 1000) + 3600) { toast('Deadline must be at least 1 hour from now', 'error'); return; }
    // Use 179 days + 12h as the frontend guard (contract uses strictly < 180 days from block.timestamp which is always slightly ahead)
    if (deadline > Math.floor(Date.now() / 1000) + 179 * 86400 + 43200) { toast('Deadline cannot exceed 180 days. Please pick a date at most 179 days ahead.', 'error'); return; }
    if (weightSum !== 100) { toast('Prize weights must sum to 100', 'error'); return; }

    try {
      setSub(true);

      let ipfsHash = '';
      try {
        toast('Uploading to IPFS…', 'info');
        ipfsHash = await uploadJSON(buildBountyMeta({
          title:              form.title,
          shortDescription:   form.shortDescription,
          fullDescription:    form.description,
          requirements:       form.requirements.filter(Boolean),
          evaluationCriteria: form.evaluationCriteria.filter(Boolean),
          skills:             form.skills.split(',').map(s => s.trim()).filter(Boolean),
          estimatedHours:     form.estimatedHours ? Number(form.estimatedHours) : null,
          contactInfo:        form.contactInfo,
          category:           form.category,
        }), 'bounty-' + Date.now());
      } catch (ipfsErr) {
        if (ipfsErr.message === 'IPFS_NOT_CONFIGURED') {
          toast('Pinata not configured — continuing without IPFS.', 'warning');
        } else if (ipfsErr.message === 'IPFS_AUTH_FAILED') {
          toast('Pinata key invalid. Check VITE_PINATA_* in .env', 'error');
          setSub(false); return;
        } else {
          throw ipfsErr;
        }
      }

      toast('Confirm transaction in wallet…', 'info');
      const factory = await getContract(ADDRESSES.factory, FACTORY_ABI, wc);

      // Re-fetch poster stake immediately before sending to guarantee exact match with contract
      let finalPosterStake = posterStakeWei;
      if (form.rewardType === 0 && totalWei > 0n) {
        try {
          const roFactory = getReadContract(ADDRESSES.factory, ['function getPosterStake(uint256) pure returns (uint256)']);
          finalPosterStake = await roFactory.getPosterStake(totalWei);
          setPosterStakeWei(finalPosterStake);
        } catch { /* keep current posterStakeWei */ }
      }

      // V2 createBounty signature: (ipfsHash, title, category, rewardType, rewardToken, totalReward, winnerCount, prizeWeights, deadline)
      let tx;
      if (form.rewardType === 0) {
        // V3: msg.value = totalReward + posterStake (exact match required by contract)
        tx = await factory.createBounty(
          ipfsHash, form.title, form.category,
          0,                         // rewardType = NATIVE
          ethers.ZeroAddress,        // rewardToken = not used for native
          totalWei, form.winnerCount, form.prizeWeights,
          deadline,
          { value: totalWei + finalPosterStake }
        );
      } else {
        const rewardToken = form.rewardToken || ADDRESSES.usdc;
        if (!rewardToken) { toast('No ERC20 token address configured', 'error'); setSub(false); return; }
        const erc20 = await getContract(rewardToken, ERC20_ABI, wc);
        const allowance = await erc20.allowance(address, ADDRESSES.factory);
        if (allowance < totalWei) {
          toast('Approving token spend…', 'info');
          // Some tokens (e.g. USDT) require resetting allowance to 0 before increasing
          if (allowance > 0n) {
            try { await (await erc20.approve(ADDRESSES.factory, 0n)).wait(); } catch {}
          }
          await (await erc20.approve(ADDRESSES.factory, totalWei)).wait();
        }
        // V3 ERC20: msg.value = posterStake in MON (flat MIN_POSTER_STAKE)
        tx = await factory.createBounty(
          ipfsHash, form.title, form.category,
          1,              // rewardType = ERC20
          rewardToken,
          totalWei, form.winnerCount, form.prizeWeights,
          deadline,
          { value: finalPosterStake }
        );
      }

      await tx.wait();
      toast('Bounty created!', 'success');
      window.location.hash = '#/';
    } catch (err) {
      console.error(err);
      toast('Failed: ' + (err.reason || err.shortMessage || err.message || 'Unknown error'), 'error');
    } finally {
      setSub(false);
    }
  };

  const inputStyle = {
    background: t.colors.bg.base, border: '1px solid ' + t.colors.border.default,
    borderRadius: t.radius.md, padding: '9px 13px', color: t.colors.text.primary,
    fontFamily: t.fonts.body, fontSize: '13px', outline: 'none', width: '100%',
  };

  const rewardSymbol = form.rewardType === 0 ? 'MON' : 'USDC';

  if (!address) return (
    <div>
      <div style={{ padding: '6rem 1rem', textAlign: 'center' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px', color: t.colors.text.faint }}>
          <IconTarget size={40} />
        </div>
        <h2 style={{ fontWeight: 700, fontSize: '22px', color: t.colors.text.primary, marginBottom: '8px', letterSpacing: '-0.02em' }}>Post a Bounty</h2>
        <p style={{ color: t.colors.text.muted, fontSize: '14px', maxWidth: '360px', margin: '0 auto 24px', lineHeight: 1.7 }}>
          Connect your wallet to fund tasks for the Monad ecosystem.
        </p>
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

  return (
    <div>
      <div className="container-sm" style={{ padding: 'clamp(1.5rem, 4vw, 3rem) clamp(1rem, 4vw, 2rem)' }}>
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}>

          {/* Header */}
          <div style={{ marginBottom: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px' }}>
              <div>
                <h1 style={{ fontWeight: 700, fontSize: 'clamp(22px, 3.5vw, 30px)', color: t.colors.text.primary, letterSpacing: '-0.025em', marginBottom: '6px' }}>Post a Bounty</h1>
                <p style={{ color: t.colors.text.muted, fontSize: '13px' }}>Lock rewards in escrow and fund work from the Monad community.</p>
              </div>
              {/* Load template button — only shown when templates exist */}
              {templates.length > 0 && (
                <button onClick={() => setShowTemplates(p => !p)} style={{ background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.2)', color: '#818cf8', borderRadius: t.radius.md, padding: '7px 14px', fontSize: '12px', cursor: 'pointer', transition: t.transition, alignSelf: 'flex-start' }}>
                  {showTemplates ? 'Hide Templates' : (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                  <IconFolder size={12} />
                  Templates ({templates.length})
                </span>
              )}
                </button>
              )}
            </div>

            {/* Templates panel */}
            {showTemplates && templates.length > 0 && (
              <div style={{ marginTop: '12px', padding: '14px', background: t.colors.bg.card, border: '1px solid ' + t.colors.border.default, borderRadius: t.radius.md }}>
                <div style={{ fontSize: '11px', color: t.colors.text.muted, letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: '10px' }}>Saved Templates</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {templates.map(tmpl => (
                    <div key={tmpl.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', background: t.colors.bg.elevated, borderRadius: t.radius.sm, border: '1px solid ' + t.colors.border.subtle }}>
                      <span style={{ fontSize: '13px', color: t.colors.text.primary }}>{tmpl.name}</span>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button onClick={() => handleLoadTemplate(tmpl)} style={{ fontSize: '12px', color: '#818cf8', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px' }}>Load</button>
                        <button onClick={() => handleDeleteTemplate(tmpl.id)} style={{ fontSize: '12px', color: '#f87171', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px' }}>Delete</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <StepBar current={step} />

          <AnimatePresence mode="wait">

            {/* ── STEP 1: Details ── */}
            {step === 0 && (
              <motion.div key="step0" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.22 }}>
                <Card>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

                    <Input label="Bounty Title *" placeholder="e.g. Build a staking dashboard for Monad" value={form.title} onChange={e => set('title', e.target.value)} maxLength={100} />

                    <Input label="Short Description (optional)" placeholder="One-line summary shown in preview cards (max 160 chars)" value={form.shortDescription} onChange={e => set('shortDescription', e.target.value)} maxLength={160} />

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                      <div>
                        <label style={{ fontSize: '12px', fontWeight: 500, color: t.colors.text.secondary, display: 'block', marginBottom: '7px' }}>Category</label>
                        <select value={form.category} onChange={e => set('category', e.target.value)} style={inputStyle}>
                          {CATEGORIES.map(c => <option key={c} value={c}>{CATEGORY_LABELS[c] || c}</option>)}
                        </select>
                      </div>
                      <div>
                        <label style={{ fontSize: '12px', fontWeight: 500, color: t.colors.text.secondary, display: 'block', marginBottom: '7px' }}>
                          Estimated Hours
                          <span style={{ fontWeight: 400, color: t.colors.text.muted, marginLeft: '5px' }}>(optional)</span>
                        </label>
                        <input type="number" min="1" max="1000" value={form.estimatedHours} onChange={e => set('estimatedHours', e.target.value)} placeholder="e.g. 20" style={inputStyle} />
                      </div>
                    </div>

                    {/* Description (Markdown supported) */}
                    <div>
                      <label style={{ fontSize: '12px', fontWeight: 500, color: t.colors.text.secondary, display: 'block', marginBottom: '7px' }}>
                        Full Description *
                        <span style={{ fontWeight: 400, color: t.colors.text.muted, marginLeft: '5px' }}>Markdown supported</span>
                      </label>
                      <textarea value={form.description} onChange={e => set('description', e.target.value)} rows={8}
                        placeholder="Describe the task in detail. **Bold**, `code`, lists, etc. are supported."
                        style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.6 }} />
                    </div>

                    {/* Skills */}
                    <div>
                      <label style={{ fontSize: '12px', fontWeight: 500, color: t.colors.text.secondary, display: 'block', marginBottom: '7px' }}>
                        Required Skills
                        <span style={{ fontWeight: 400, color: t.colors.text.muted, marginLeft: '5px' }}>comma-separated</span>
                      </label>
                      <input value={form.skills} onChange={e => set('skills', e.target.value)} placeholder="e.g. Solidity, React, TypeScript" style={inputStyle} />
                    </div>

                    {/* Requirements */}
                    <div>
                      <label style={{ fontSize: '12px', fontWeight: 500, color: t.colors.text.secondary, display: 'block', marginBottom: '8px' }}>Requirements</label>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {form.requirements.map((r, i) => (
                          <div key={i} style={{ display: 'flex', gap: '8px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '24px', height: '38px', flexShrink: 0 }}>
                              <span style={{ fontFamily: t.fonts.mono, fontSize: '11px', color: '#7c3aed' }}>{String(i + 1).padStart(2, '0')}</span>
                            </div>
                            <input value={r} onChange={e => setReq(i, e.target.value)} placeholder="e.g. Must include source code" style={inputStyle} />
                            {i > 0 && (
                              <button onClick={() => removeReq(i)} style={{ width: '38px', height: '38px', flexShrink: 0, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: t.radius.sm, color: '#f87171', cursor: 'pointer', fontSize: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
                            )}
                          </div>
                        ))}
                      </div>
                      <button onClick={addReq} style={{ marginTop: '8px', background: 'none', border: '1px dashed ' + t.colors.border.default, borderRadius: t.radius.sm, padding: '7px 14px', color: t.colors.text.muted, cursor: 'pointer', fontSize: '12px', width: '100%', transition: t.transition }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = t.colors.border.hover; e.currentTarget.style.color = t.colors.text.secondary; }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = t.colors.border.default; e.currentTarget.style.color = t.colors.text.muted; }}>
                        + Add requirement
                      </button>
                    </div>

                    {/* Evaluation criteria */}
                    <div>
                      <label style={{ fontSize: '12px', fontWeight: 500, color: t.colors.text.secondary, display: 'block', marginBottom: '8px' }}>Evaluation Criteria
                        <span style={{ fontWeight: 400, color: t.colors.text.muted, marginLeft: '5px' }}>(how will you judge submissions?)</span>
                      </label>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {form.evaluationCriteria.map((r, i) => (
                          <div key={i} style={{ display: 'flex', gap: '8px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '24px', height: '38px', flexShrink: 0 }}>
                              <span style={{ color: t.colors.green[400], display: 'flex', marginTop: '3px' }}><IconCheck size={11} color={t.colors.green[400]} /></span>
                            </div>
                            <input value={r} onChange={e => setCrit(i, e.target.value)} placeholder="e.g. Code quality and readability" style={inputStyle} />
                            {i > 0 && (
                              <button onClick={() => removeCrit(i)} style={{ width: '38px', height: '38px', flexShrink: 0, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: t.radius.sm, color: '#f87171', cursor: 'pointer', fontSize: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
                            )}
                          </div>
                        ))}
                      </div>
                      <button onClick={addCrit} style={{ marginTop: '8px', background: 'none', border: '1px dashed ' + t.colors.border.default, borderRadius: t.radius.sm, padding: '7px 14px', color: t.colors.text.muted, cursor: 'pointer', fontSize: '12px', width: '100%', transition: t.transition }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = t.colors.border.hover; e.currentTarget.style.color = t.colors.text.secondary; }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = t.colors.border.default; e.currentTarget.style.color = t.colors.text.muted; }}>
                        + Add criterion
                      </button>
                    </div>

                    {/* Deadline + contact */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', alignItems: 'start' }}>
                      <DeadlinePicker value={form.deadlineDate} onChange={v => set('deadlineDate', v)} />
                      <div>
                        <label style={{ fontSize: '13px', fontWeight: 500, color: t.colors.text.secondary, display: 'block', marginBottom: '4px' }}>
                          Telegram / Discord Contact
                          <span style={{ fontSize: '11px', color: t.colors.text.muted, fontWeight: 400, marginLeft: '5px' }}>optional</span>
                        </label>
                        <div style={{ fontSize: '11px', color: t.colors.text.muted, marginBottom: '8px' }}>Hunters can reach you with questions</div>
                        <input value={form.contactInfo} onChange={e => set('contactInfo', e.target.value)} placeholder="e.g. @yourname (Telegram)" style={inputStyle} />
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                      <Button fullWidth size="lg" icon={<IconChevronRight size={15} />} onClick={() => setStep(1)}
                        disabled={!form.title.trim() || !form.description.trim() || !form.deadlineDate}>
                        Continue to Reward
                      </Button>
                      <button
                        onClick={handleSaveTemplate}
                        title="Save current form as a template"
                        style={{
                          flexShrink: 0,
                          background: 'transparent',
                          border: '1px solid ' + t.colors.border.default,
                          color: t.colors.text.muted,
                          borderRadius: t.radius.md,
                          padding: '10px 14px',
                          fontSize: '12px',
                          cursor: 'pointer',
                          transition: 'border-color 0.12s ease, color 0.12s ease',
                          whiteSpace: 'nowrap',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = t.colors.border.hover; e.currentTarget.style.color = t.colors.text.secondary; }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = t.colors.border.default; e.currentTarget.style.color = t.colors.text.muted; }}
                      >
                        <IconSave size={12} />
                        Save Template
                      </button>
                    </div>
                  </div>
                </Card>
              </motion.div>
            )}

            {/* ── STEP 2: Reward ── */}
            {step === 1 && (
              <motion.div key="step1" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.22 }}>
                <Card>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

                    {/* Token selector */}
                    <div>
                      <label style={{ fontSize: '12px', fontWeight: 500, color: t.colors.text.secondary, display: 'block', marginBottom: '10px' }}>Reward Token</label>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                        {[
                          { v: 0, l: 'MON',  sub: 'Native token' },
                          { v: 1, l: 'USDC', sub: 'Stablecoin' },
                        ].map(opt => (
                          <button key={opt.v} onClick={() => set('rewardType', opt.v)} style={{
                            padding: '16px', cursor: 'pointer', textAlign: 'left', transition: t.transition,
                            background: form.rewardType === opt.v ? 'rgba(124,58,237,0.1)' : 'transparent',
                            border: '2px solid ' + (form.rewardType === opt.v ? t.colors.primary : t.colors.border.default),
                            borderRadius: t.radius.md,
                          }}>
                            <div style={{ fontSize: '16px', fontWeight: 700, color: form.rewardType === opt.v ? '#c7d2fe' : t.colors.text.primary, marginBottom: '3px', fontFamily: t.fonts.mono }}>{opt.l}</div>
                            <div style={{ fontSize: '12px', color: t.colors.text.muted }}>{opt.sub}</div>
                          </button>
                        ))}
                      </div>
                    </div>

                    <Input label={`Total Reward (${rewardSymbol}) *`} type="number" step="0.01" min="0"
                      placeholder={form.rewardType === 0 ? 'e.g. 100' : 'e.g. 500'}
                      value={form.rewardAmount}
                      onChange={e => set('rewardAmount', e.target.value)} />

                    {/* Winners — V2: max 3 */}
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <label style={{ fontSize: '12px', fontWeight: 500, color: t.colors.text.secondary }}>Number of Winners (max 3)</label>
                        <span style={{ fontFamily: t.fonts.mono, fontSize: '16px', color: '#c7d2fe', fontWeight: 700 }}>{form.winnerCount}</span>
                      </div>
                      <input type="range" min={1} max={3} value={form.winnerCount}
                        onChange={e => setWinnerCount(Number(e.target.value))}
                        style={{ width: '100%', accentColor: t.colors.primary }} />
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: t.colors.text.muted, marginTop: '4px' }}>
                        {[1, 2, 3].map(n => <span key={n}>{n}</span>)}
                      </div>
                    </div>

                    {/* Prize split */}
                    {form.winnerCount > 1 && (
                      <div style={{ padding: '14px', background: t.colors.bg.elevated, borderRadius: t.radius.md, border: '1px solid ' + t.colors.border.subtle }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '12px' }}>
                          <span style={{ color: t.colors.text.secondary, fontWeight: 500 }}>Prize Split</span>
                          <span style={{ color: weightSum === 100 ? '#34d399' : '#f87171', fontFamily: t.fonts.mono }}>
                            {weightSum}/100
                          </span>
                        </div>
                        {form.prizeWeights.map((w, i) => (
                          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                            <span style={{ fontSize: '12px', color: t.colors.text.muted, width: '54px', flexShrink: 0 }}>#{i + 1} Place</span>
                            <input type="number" min={0} max={100} value={w} onChange={e => updateWeight(i, e.target.value)} style={{ ...inputStyle, width: '70px' }} />
                            <span style={{ fontSize: '12px', color: '#818cf8' }}>%</span>
                            <div style={{ flex: 1, height: '4px', background: t.colors.border.default, borderRadius: '99px', overflow: 'hidden' }}>
                              <div style={{ height: '100%', width: Math.min(w, 100) + '%', background: 'linear-gradient(90deg,#7c3aed,#8b5cf6)', borderRadius: '99px', transition: 'width 0.2s' }} />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Fee summary */}
                    {form.rewardAmount && parseFloat(form.rewardAmount) > 0 && (
                      <div style={{ padding: '14px', background: 'rgba(16,185,129,0.06)', borderRadius: t.radius.md, border: '1px solid rgba(16,185,129,0.15)' }}>
                        <div style={{ fontSize: '12px', color: '#6ee7b7', fontWeight: 600, marginBottom: '8px' }}>Reward Summary</div>
                        {[
                          { label: 'You deposit',      value: parseFloat(form.rewardAmount).toFixed(4) + ' ' + rewardSymbol, color: t.colors.text.secondary },
                          { label: 'Platform fee (3%)', value: '−' + (parseFloat(form.rewardAmount) * 0.03).toFixed(4) + ' ' + rewardSymbol, color: '#fb923c' },
                          { label: 'Hunters receive',  value: (parseFloat(form.rewardAmount) * 0.97).toFixed(4) + ' ' + rewardSymbol, color: '#34d399' },
                        ].map(row => (
                          <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                            <span style={{ color: t.colors.text.muted }}>{row.label}</span>
                            <span style={{ color: row.color, fontFamily: t.fonts.mono, fontWeight: 600 }}>{row.value}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    <div style={{ display: 'flex', gap: '10px' }}>
                      <Button variant="ghost" icon={<IconBack size={14} />} onClick={() => setStep(0)}>Back</Button>
                      <Button fullWidth size="lg" icon={<IconChevronRight size={15} />} onClick={() => setStep(2)}
                        disabled={!form.rewardAmount || parseFloat(form.rewardAmount) <= 0 || weightSum !== 100}>
                        Review
                      </Button>
                    </div>
                  </div>
                </Card>
              </motion.div>
            )}

            {/* ── STEP 3: Review ── */}
            {step === 2 && (
              <motion.div key="step2" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.22 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

                  {/* Bounty title & meta */}
                  <Card>
                    <div style={{ fontSize: '12px', fontWeight: 600, color: '#7c3aed', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '8px' }}>Review &amp; Publish</div>
                    <h2 style={{ fontSize: '20px', fontWeight: 700, color: t.colors.text.primary, letterSpacing: '-0.02em', marginBottom: '6px' }}>{form.title}</h2>
                    {form.shortDescription && (
                      <p style={{ fontSize: '13px', color: t.colors.text.muted, lineHeight: 1.6, marginBottom: '14px' }}>{form.shortDescription}</p>
                    )}

                    {/* Skills */}
                    {form.skills && (
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '14px' }}>
                        {form.skills.split(',').map(s => s.trim()).filter(Boolean).map(s => (
                          <span key={s} style={{ fontSize: '11px', color: '#818cf8', background: 'rgba(124,58,237,0.1)', border: '1px solid rgba(124,58,237,0.15)', padding: '2px 8px', borderRadius: '99px' }}>{s}</span>
                        ))}
                      </div>
                    )}

                    {/* Key details table */}
                    <div style={{ background: t.colors.bg.elevated, borderRadius: t.radius.md, border: '1px solid ' + t.colors.border.subtle }}>
                      {[
                        ['Category',       CATEGORY_LABELS[form.category] || form.category],
                        ['Deadline',       form.deadlineDate ? new Date(form.deadlineDate).toLocaleString('en', { dateStyle: 'medium', timeStyle: 'short' }) : '—'],
                        ['Review window',  deadline ? fmtSecs(calcReviewWindowSecs(deadline)) + ' after deadline' : '—'],
                        ['Reward',         form.rewardAmount + ' ' + rewardSymbol],
                        ['Winners',        form.winnerCount + ' winner' + (form.winnerCount > 1 ? 's — ' + form.prizeWeights.join('/') + '%' : ' (you can approve fewer)')],
                        ['Est. Hours',     form.estimatedHours ? form.estimatedHours + 'h' : '—'],
                        ...(form.contactInfo ? [['Contact (Telegram/Discord)', form.contactInfo]] : []),
                      ].map(([k, v], i, arr) => (
                        <div key={k} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', borderBottom: i < arr.length - 1 ? '1px solid ' + t.colors.border.subtle : 'none' }}>
                          <span style={{ fontSize: '12px', color: t.colors.text.muted }}>{k}</span>
                          <span style={{ fontSize: '13px', color: t.colors.text.primary, fontWeight: 500, textAlign: 'right', maxWidth: '65%' }}>{v}</span>
                        </div>
                      ))}
                    </div>
                  </Card>

                  {/* Full description preview */}
                  {form.description && (
                    <Card>
                      <div style={{ fontSize: '11px', fontWeight: 600, color: t.colors.text.muted, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '12px' }}>Description Preview</div>
                      <div style={{ color: t.colors.text.secondary, fontSize: '13px', lineHeight: 1.8, whiteSpace: 'pre-wrap', maxHeight: '240px', overflowY: 'auto', paddingRight: '4px' }}>
                        {form.description}
                      </div>
                    </Card>
                  )}

                  {/* Requirements preview */}
                  {form.requirements.filter(Boolean).length > 0 && (
                    <Card>
                      <div style={{ fontSize: '11px', fontWeight: 600, color: t.colors.text.muted, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '12px' }}>Requirements</div>
                      <ul style={{ margin: 0, paddingLeft: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {form.requirements.filter(Boolean).map((r, i) => (
                          <li key={i} style={{ display: 'flex', gap: '10px', fontSize: '13px', color: t.colors.text.secondary }}>
                            <span style={{ color: '#7c3aed', fontFamily: t.fonts.mono, fontSize: '11px', flexShrink: 0, marginTop: '3px' }}>{String(i + 1).padStart(2, '0')}</span>
                            {r}
                          </li>
                        ))}
                      </ul>
                    </Card>
                  )}

                  {/* Deposit summary — V3: shows reward + poster stake */}
                  <div style={{ padding: '20px', background: 'rgba(124,58,237,0.08)', borderRadius: t.radius.md, border: '1px solid rgba(124,58,237,0.2)' }}>
                    <div style={{ fontSize: '10px', color: '#818cf8', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '12px', textAlign: 'center' }}>Total you will deposit</div>
                    <div style={{ textAlign: 'center', fontFamily: t.fonts.mono, fontSize: '30px', fontWeight: 700, color: '#c7d2fe', letterSpacing: '-0.02em', marginBottom: '14px' }}>
                      {form.rewardType === 0 ? (parseFloat(form.rewardAmount || 0) + parseFloat(posterStakeMon)).toFixed(4) : form.rewardAmount} {rewardSymbol}
                      {form.rewardType === 1 && <span style={{ fontSize: '16px', color: '#818cf8', marginLeft: '8px' }}>+ {posterStakeMon} MON stake</span>}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', borderTop: '1px solid rgba(124,58,237,0.15)', paddingTop: '12px' }}>
                      {[
                        { label: 'Bounty reward', value: `${form.rewardAmount || 0} ${rewardSymbol}`, color: '#c7d2fe' },
                        { label: 'Poster stake (5% · refundable)', value: `${posterStakeMon} MON`, color: '#86efac' },
                        { label: '→ Goes to winners (97%)', value: `${(parseFloat(form.rewardAmount || 0) * 0.97).toFixed(4)} ${rewardSymbol}`, color: '#818cf8' },
                        { label: '→ Platform fee (3%)', value: `${(parseFloat(form.rewardAmount || 0) * 0.03).toFixed(4)} ${rewardSymbol}`, color: '#94a3b8' },
                      ].map(({ label, value, color }) => (
                        <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                          <span style={{ color: t.colors.text.muted }}>{label}</span>
                          <span style={{ color, fontFamily: t.fonts.mono, fontWeight: 500 }}>{value}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div style={{
                    fontSize: '12px',
                    color: t.colors.text.muted,
                    padding: '10px 14px',
                    background: t.colors.bg.elevated,
                    borderRadius: t.radius.sm,
                    lineHeight: 1.6,
                    display: 'flex',
                    gap: '8px',
                    alignItems: 'flex-start',
                  }}>
                    <span style={{ color: t.colors.warning, display: 'flex', flexShrink: 0, marginTop: '1px' }}>
                      <IconWarning size={13} color={t.colors.warning} />
                    </span>
                    Reward + your {posterStakeMon} MON poster stake will be locked in escrow. After the deadline you have a <strong style={{ color: t.colors.text.secondary }}>{deadline ? fmtSecs(calcReviewWindowSecs(deadline)) : '24h–7d'} review window</strong> to approve or reject submissions. The stake is fully refunded when you approve winners. If you cancel after hunters submit, the stake is forfeited as fraud deterrence.
                  </div>

                  <div style={{ display: 'flex', gap: '10px' }}>
                    <Button variant="ghost" icon={<IconBack size={14} />} onClick={() => setStep(1)}>Back</Button>
                    <Button fullWidth size="lg" loading={submitting} disabled={!wc} onClick={handlePublish}>
                      {wc ? 'Create & Fund Bounty' : 'Waiting for wallet…'}
                    </Button>
                  </div>
                </div>
              </motion.div>
            )}

          </AnimatePresence>
        </motion.div>
      </div>
    </div>
  );
}
