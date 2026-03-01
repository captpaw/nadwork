/* eslint-disable */
/**
 * NadWork — Write all frontend source files
 * Run: node scripts/write-frontend-src.js
 */
const fs = require("fs");
const path = require("path");

const src = path.join(__dirname, "..", "frontend", "src");

function write(relPath, content) {
  const fullPath = path.join(src, relPath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, content.trimStart(), "utf8");
  console.log("  ✓", relPath);
}

// ═══════════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════════

write("styles/theme.js", `
export const theme = {
  colors: {
    primary:   '#f59e0b',
    secondary: '#8b5cf6',
    accent:    '#10b981',
    danger:    '#ef4444',
    warning:   '#f97316',

    bg: {
      darkest: '#0a0a0f',
      dark:    '#0f0f1a',
      card:    'rgba(15,15,26,0.95)',
      overlay: 'rgba(0,0,0,0.88)',
      surface: 'rgba(245,158,11,0.06)',
    },

    text: {
      primary:   '#f0e6d0',
      secondary: '#8a7a6a',
      muted:     '#4a4040',
      gold:      '#f59e0b',
      white:     '#ffffff',
    },

    border: {
      default: 'rgba(245,158,11,0.15)',
      hover:   'rgba(245,158,11,0.40)',
      active:  'rgba(245,158,11,0.65)',
      subtle:  'rgba(255,255,255,0.05)',
    },

    glow: {
      gold:        '0 0 12px rgba(245,158,11,0.35), 0 0 24px rgba(245,158,11,0.15)',
      goldStrong:  '0 0 20px rgba(245,158,11,0.55), 0 0 40px rgba(245,158,11,0.25)',
      violet:      '0 0 12px rgba(139,92,246,0.4),  0 0 24px rgba(139,92,246,0.2)',
      emerald:     '0 0 12px rgba(16,185,129,0.4),  0 0 24px rgba(16,185,129,0.2)',
      red:         '0 0 12px rgba(239,68,68,0.4),   0 0 24px rgba(239,68,68,0.2)',
    },

    status: {
      active:    '#10b981',
      reviewing: '#f97316',
      completed: '#8b5cf6',
      expired:   '#6b7280',
      cancelled: '#ef4444',
      open:      '#10b981',
      firstCome: '#f59e0b',
    },
  },

  fonts: {
    display: "'Press Start 2P', monospace",
    body:    "'JetBrains Mono', monospace",
    number:  "'Russo One', sans-serif",
  },

  radius: {
    sm: '4px',
    md: '8px',
    lg: '12px',
    xl: '16px',
  },

  transition: 'all 0.18s ease',
};

export default theme;
`);

write("styles/index.css", `
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

:root {
  --bg-darkest:  #0a0a0f;
  --bg-dark:     #0f0f1a;
  --gold:        #f59e0b;
  --violet:      #8b5cf6;
  --emerald:     #10b981;
  --text:        #f0e6d0;
  --text-muted:  #8a7a6a;
  --border:      rgba(245,158,11,0.15);
  --font-body:   'JetBrains Mono', monospace;
  --font-display:'Press Start 2P', monospace;
  --font-number: 'Russo One', sans-serif;
}

html { scroll-behavior: smooth; }

body {
  background: var(--bg-darkest);
  color: var(--text);
  font-family: var(--font-body);
  font-size: 14px;
  line-height: 1.6;
  -webkit-font-smoothing: antialiased;
  overflow-x: hidden;
}

/* CRT scanline overlay */
body::after {
  content: '';
  position: fixed;
  inset: 0;
  background: repeating-linear-gradient(
    0deg,
    transparent,
    transparent 2px,
    rgba(0,0,0,0.03) 2px,
    rgba(0,0,0,0.03) 4px
  );
  pointer-events: none;
  z-index: 9999;
}

/* Scrollbar */
::-webkit-scrollbar       { width: 6px; }
::-webkit-scrollbar-track { background: var(--bg-darkest); }
::-webkit-scrollbar-thumb { background: rgba(245,158,11,0.3); border-radius: 3px; }
::-webkit-scrollbar-thumb:hover { background: rgba(245,158,11,0.6); }

/* Selection */
::selection { background: rgba(245,158,11,0.25); color: #f0e6d0; }

/* App layout */
.app { min-height: 100vh; display: flex; flex-direction: column; }
.app-content { flex: 1; padding-top: 72px; }

/* Container */
.container { max-width: 1200px; margin: 0 auto; padding: 0 clamp(1rem, 4vw, 2rem); }
.container-sm { max-width: 800px; margin: 0 auto; padding: 0 clamp(1rem, 4vw, 2rem); }

/* Page sections */
.page-section { padding: clamp(2rem, 6vw, 4rem) 0; }

/* RainbowKit font override */
[data-rk] { font-family: var(--font-body) !important; }

/* Animations */
@keyframes goldPulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.6; }
}
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes slideUp {
  from { opacity: 0; transform: translateY(24px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes countUp {
  from { opacity: 0; transform: scale(0.8); }
  to   { opacity: 1; transform: scale(1); }
}
`);

// ═══════════════════════════════════════════════════════════
// CONFIG
// ═══════════════════════════════════════════════════════════

write("config/chains.js", `
import { defineChain } from 'viem';

export const monadMainnet = defineChain({
  id: 143,
  name: 'Monad',
  nativeCurrency: { name: 'MON', symbol: 'MON', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://rpc.monad.xyz'] },
    public:  { http: ['https://rpc.monad.xyz'] },
  },
  blockExplorers: {
    default: { name: 'Monad Explorer', url: 'https://monadexplorer.com' },
  },
});
`);

write("config/wagmi.js", `
import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { monadMainnet } from './chains.js';

export const wagmiConfig = getDefaultConfig({
  appName: 'NadWork',
  projectId: import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || 'NadWork-dev',
  chains: [monadMainnet],
  ssr: false,
});
`);

write("config/contracts.js", `
import addresses from './addresses.json';

export const ADDRESSES = {
  factory:    import.meta.env.VITE_BOUNTY_FACTORY_ADDRESS     || addresses.BountyFactory     || '',
  registry:   import.meta.env.VITE_BOUNTY_REGISTRY_ADDRESS    || addresses.BountyRegistry    || '',
  escrow:     import.meta.env.VITE_ESCROW_ADDRESS             || addresses.NadWorkEscrow     || '',
  reputation: import.meta.env.VITE_REPUTATION_REGISTRY_ADDRESS|| addresses.ReputationRegistry|| '',
  usdc:       import.meta.env.VITE_USDC_ADDRESS               || '0x754704Bc059F8C67012fEd69BC8A327a5aafb603',
};

export const FACTORY_ABI = [
  'function createBounty(string,string,string,uint8,uint8,address,uint256,uint8,uint8[],uint256,uint256) payable returns (uint256)',
  'function submitWork(uint256,string) returns (uint256)',
  'function approveWinners(uint256,uint256[],uint8[]) external',
  'function rejectSubmission(uint256,uint256) external',
  'function cancelBounty(uint256) external',
  'function expireBounty(uint256) external',
  'function triggerTimeout(uint256) external',
  'event BountyCreated(uint256 indexed bountyId, address indexed poster, uint256 reward)',
  'event WorkSubmitted(uint256 indexed bountyId, uint256 indexed submissionId, address indexed hunter)',
  'event WinnersApproved(uint256 indexed bountyId, address[] winners)',
];

export const REGISTRY_ABI = [
  'function getBounty(uint256) view returns (tuple(uint256,address,string,string,string,uint8,uint8,uint8,address,uint256,uint8,uint8[],uint256,uint256,uint256,uint256,address[]))',
  'function getSubmission(uint256) view returns (tuple(uint256,uint256,address,string,uint8,uint8,uint256))',
  'function getBountySubmissions(uint256) view returns (tuple(uint256,uint256,address,string,uint8,uint8,uint256)[])',
  'function getPosterBounties(address) view returns (uint256[])',
  'function getHunterSubmissions(address) view returns (tuple(uint256,uint256,address,string,uint8,uint8,uint256)[])',
  'function hasSubmitted(uint256,address) view returns (bool)',
  'function bountyCount() view returns (uint256)',
  'function submissionCount() view returns (uint256)',
  'function getAllBounties(uint256,uint256) view returns (tuple(uint256,address,string,string,string,uint8,uint8,uint8,address,uint256,uint8,uint8[],uint256,uint256,uint256,uint256,address[])[],uint256)',
  'function getActiveBounties(uint256,uint256) view returns (tuple(uint256,address,string,string,string,uint8,uint8,uint8,address,uint256,uint8,uint8[],uint256,uint256,uint256,uint256,address[])[],uint256)',
  'function getBountiesByCategory(string,uint256,uint256) view returns (tuple(uint256,address,string,string,string,uint8,uint8,uint8,address,uint256,uint8,uint8[],uint256,uint256,uint256,uint256,address[])[],uint256)',
];

export const REPUTATION_ABI = [
  'function hunters(address) view returns (uint256,uint256,uint256,uint256,uint256)',
  'function projects(address) view returns (uint256,uint256,uint256,uint256,uint256)',
  'function getHunterScore(address) view returns (uint256)',
  'function getProjectScore(address) view returns (uint256)',
  'function getWinRate(address) view returns (uint256)',
  'function getCompletionRate(address) view returns (uint256)',
];

export const ERC20_ABI = [
  'function allowance(address,address) view returns (uint256)',
  'function approve(address,uint256) returns (bool)',
  'function balanceOf(address) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
];

export const BOUNTY_TYPES  = { 0: 'OPEN', 1: 'FIRST_COME' };
export const BOUNTY_STATUS = { 0: 'ACTIVE', 1: 'REVIEWING', 2: 'COMPLETED', 3: 'EXPIRED', 4: 'CANCELLED' };
export const SUB_STATUS    = { 0: 'PENDING', 1: 'APPROVED', 2: 'REJECTED' };
export const REWARD_TYPES  = { 0: 'NATIVE', 1: 'ERC20' };
export const CATEGORIES    = ['dev', 'design', 'content', 'research', 'marketing'];
`);

write("config/pinata.js", `
const API_KEY    = import.meta.env.VITE_PINATA_API_KEY    || '';
const API_SECRET = import.meta.env.VITE_PINATA_SECRET_API_KEY || '';
const GATEWAY    = import.meta.env.VITE_PINATA_GATEWAY    || 'https://gateway.pinata.cloud/ipfs/';

const GATEWAYS = [
  GATEWAY,
  'https://ipfs.io/ipfs/',
  'https://cloudflare-ipfs.com/ipfs/',
];

const jsonCache = new Map();

export async function uploadJSON(data, name = 'NadWork-data') {
  const body = JSON.stringify({
    pinataMetadata: { name },
    pinataContent: data,
  });

  const res = await fetch('https://api.pinata.cloud/pinning/pinJSONToIPFS', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      pinata_api_key: API_KEY,
      pinata_secret_api_key: API_SECRET,
    },
    body,
  });

  if (!res.ok) throw new Error('IPFS upload failed: ' + res.statusText);
  const json = await res.json();
  return json.IpfsHash;
}

export async function fetchJSON(cid) {
  if (!cid) return null;
  if (jsonCache.has(cid)) return jsonCache.get(cid);

  for (const gw of GATEWAYS) {
    try {
      const res = await fetch(gw + cid, { signal: AbortSignal.timeout(8000) });
      if (res.ok) {
        const data = await res.json();
        jsonCache.set(cid, data);
        return data;
      }
    } catch {}
  }
  return null;
}

export function buildBountyMeta({ title, fullDescription, requirements, resources, evaluationCriteria, contactInfo, category }) {
  return { version: '1.0', title, fullDescription, requirements: requirements || [], resources: resources || [], evaluationCriteria: evaluationCriteria || '', contactInfo: contactInfo || '', category, timestamp: Math.floor(Date.now() / 1000) };
}

export function buildSubmissionMeta({ bountyId, hunterAddress, title, description, deliverables, notes }) {
  return { version: '1.0', bountyId: String(bountyId), hunterAddress, title, description, deliverables: deliverables || [], notes: notes || '', timestamp: Math.floor(Date.now() / 1000) };
}
`);

// ═══════════════════════════════════════════════════════════
// UTILS
// ═══════════════════════════════════════════════════════════

write("utils/format.js", `
import { ethers } from 'ethers';
import { BOUNTY_STATUS, BOUNTY_TYPES, SUB_STATUS } from '@/config/contracts.js';

export function shortAddr(addr) {
  if (!addr) return '';
  return addr.slice(0, 6) + '...' + addr.slice(-4);
}

export function formatMON(wei) {
  if (!wei && wei !== 0n) return '0';
  const n = parseFloat(ethers.formatEther(wei));
  if (n >= 1000) return n.toLocaleString('en', { maximumFractionDigits: 0 }) + ' MON';
  if (n >= 1)    return n.toLocaleString('en', { maximumFractionDigits: 2 }) + ' MON';
  return n.toFixed(4) + ' MON';
}

export function formatUSDC(amount, decimals = 6) {
  const n = parseFloat((BigInt(amount) / BigInt(10 ** decimals)).toString());
  return '$' + n.toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function formatReward(totalReward, rewardType, rewardToken) {
  if (rewardType === 0) return formatMON(totalReward);
  return formatUSDC(totalReward);
}

export function formatDeadline(deadline) {
  const now  = Math.floor(Date.now() / 1000);
  const diff = Number(deadline) - now;
  if (diff <= 0) return 'Expired';
  const d = Math.floor(diff / 86400);
  const h = Math.floor((diff % 86400) / 3600);
  const m = Math.floor((diff % 3600) / 60);
  if (d > 0) return d + 'd ' + h + 'h left';
  if (h > 0) return h + 'h ' + m + 'm left';
  return m + 'm left';
}

export function formatDate(ts) {
  return new Date(Number(ts) * 1000).toLocaleDateString('en', {
    year: 'numeric', month: 'short', day: 'numeric',
  });
}

export function isExpired(deadline) {
  return Math.floor(Date.now() / 1000) >= Number(deadline);
}

export function isUrgent(deadline) {
  const diff = Number(deadline) - Math.floor(Date.now() / 1000);
  return diff > 0 && diff < 86400;
}

export function bountyStatusLabel(status) { return BOUNTY_STATUS[status] || 'UNKNOWN'; }
export function bountyTypeLabel(type)     { return BOUNTY_TYPES[type]   || 'UNKNOWN'; }
export function subStatusLabel(status)    { return SUB_STATUS[status]   || 'UNKNOWN'; }

export function explorerUrl(hash, type = 'tx') {
  return 'https://monadexplorer.com/' + type + '/' + hash;
}

export function categoryLabel(cat) {
  const map = { dev: 'Dev', design: 'Design', content: 'Content', research: 'Research', marketing: 'Marketing' };
  return map[cat] || cat;
}
`);

write("utils/ethers.js", `
import { ethers } from 'ethers';

export function walletClientToSigner(walletClient) {
  const { account, chain, transport } = walletClient;
  const network = { chainId: chain.id, name: chain.name, ensAddress: chain.contracts?.ensRegistry?.address };
  const provider = new ethers.BrowserProvider(transport, network);
  return provider.getSigner(account.address);
}

export async function getContract(address, abi, walletClient) {
  const signer = await walletClientToSigner(walletClient);
  return new ethers.Contract(address, abi, signer);
}

export function getReadContract(address, abi, rpcUrl = 'https://rpc.monad.xyz') {
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  return new ethers.Contract(address, abi, provider);
}
`);

// ═══════════════════════════════════════════════════════════
// CONTEXTS
// ═══════════════════════════════════════════════════════════

write("contexts/Web3Context.jsx", `
import React, { createContext, useContext } from 'react';
import { useWalletClient, usePublicClient } from 'wagmi';
import { walletClientToSigner } from '@/utils/ethers.js';

const Web3Context = createContext(null);

export function Web3Provider({ children }) {
  return <Web3Context.Provider value={{}}>{children}</Web3Context.Provider>;
}

export function useWeb3() {
  return useContext(Web3Context);
}

export function useEthersSigner() {
  const { data: walletClient } = useWalletClient();
  if (!walletClient) return null;
  return { getSigner: () => walletClientToSigner(walletClient) };
}
`);

// ═══════════════════════════════════════════════════════════
// COMMON COMPONENTS
// ═══════════════════════════════════════════════════════════

write("components/common/Button.jsx", `
import React, { useState } from 'react';
import { theme as t } from '@/styles/theme.js';

const variants = {
  primary: {
    background: t.colors.primary,
    color: '#0a0a0f',
    border: 'none',
    hover: { background: '#fbbf24', boxShadow: t.colors.glow.goldStrong },
  },
  secondary: {
    background: 'transparent',
    color: t.colors.primary,
    border: '1px solid ' + t.colors.border.hover,
    hover: { background: t.colors.bg.surface, boxShadow: t.colors.glow.gold },
  },
  ghost: {
    background: 'transparent',
    color: t.colors.text.secondary,
    border: '1px solid ' + t.colors.border.default,
    hover: { color: t.colors.text.primary, borderColor: t.colors.border.hover },
  },
  danger: {
    background: 'transparent',
    color: t.colors.danger,
    border: '1px solid rgba(239,68,68,0.3)',
    hover: { background: 'rgba(239,68,68,0.1)', boxShadow: t.colors.glow.red },
  },
  violet: {
    background: t.colors.secondary,
    color: '#ffffff',
    border: 'none',
    hover: { background: '#a78bfa', boxShadow: t.colors.glow.violet },
  },
};

export default function Button({
  children, variant = 'primary', size = 'md', disabled, loading, fullWidth, style, onClick, ...props
}) {
  const [hovered, setHovered] = useState(false);
  const v = variants[variant] || variants.primary;

  const sizes = {
    sm:  { padding: '8px 16px', fontSize: '10px' },
    md:  { padding: 'clamp(10px, 2.5vw, 12px) clamp(16px, 4vw, 24px)', fontSize: '11px' },
    lg:  { padding: 'clamp(12px, 3vw, 16px) clamp(20px, 5vw, 32px)', fontSize: '12px' },
  };

  const base = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    fontFamily: t.fonts.display,
    fontWeight: 400,
    cursor: disabled || loading ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.5 : 1,
    borderRadius: t.radius.md,
    transition: t.transition,
    minHeight: '44px',
    whiteSpace: 'nowrap',
    width: fullWidth ? '100%' : 'auto',
    textDecoration: 'none',
    letterSpacing: '0.03em',
    ...sizes[size],
    background: v.background,
    color: v.color,
    border: v.border || 'none',
    boxShadow: hovered && !disabled ? (v.hover.boxShadow || 'none') : 'none',
    ...(hovered && !disabled ? { ...v.hover } : {}),
    ...style,
  };

  return (
    <button
      style={base}
      disabled={disabled || loading}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onClick}
      {...props}
    >
      {loading ? '...' : children}
    </button>
  );
}
`);

write("components/common/Card.jsx", `
import React, { useState } from 'react';
import { theme as t } from '@/styles/theme.js';

export default function Card({ children, style, hoverable, onClick, padding, glow }) {
  const [hovered, setHovered] = useState(false);

  const base = {
    position: 'relative',
    background: t.colors.bg.card,
    border: '1px solid ' + (hovered && hoverable ? t.colors.border.hover : t.colors.border.default),
    borderRadius: t.radius.lg,
    padding: padding !== undefined ? padding : 'clamp(1rem, 3vw, 1.5rem)',
    overflow: 'hidden',
    transition: t.transition,
    cursor: onClick ? 'pointer' : 'default',
    boxShadow: glow && hovered ? t.colors.glow.gold : 'none',
    transform: hoverable && hovered ? 'translateY(-2px)' : 'none',
    ...style,
  };

  return (
    <div
      style={base}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onClick}
    >
      {/* CRT scanline overlay */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: 'repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,0,0,0.025) 2px,rgba(0,0,0,0.025) 4px)',
        borderRadius: 'inherit',
      }} />
      <div style={{ position: 'relative', zIndex: 1 }}>{children}</div>
    </div>
  );
}
`);

write("components/common/Badge.jsx", `
import React from 'react';
import { theme as t } from '@/styles/theme.js';

const BADGE_STYLES = {
  active:    { bg: 'rgba(16,185,129,0.15)',  color: t.colors.accent },
  completed: { bg: 'rgba(139,92,246,0.15)',  color: t.colors.secondary },
  expired:   { bg: 'rgba(107,114,128,0.15)', color: '#9ca3af' },
  cancelled: { bg: 'rgba(239,68,68,0.15)',   color: t.colors.danger },
  reviewing: { bg: 'rgba(249,115,22,0.15)',  color: t.colors.warning },
  open:      { bg: 'rgba(16,185,129,0.15)',  color: t.colors.accent },
  first_come:{ bg: 'rgba(245,158,11,0.15)',  color: t.colors.primary },
  pending:   { bg: 'rgba(245,158,11,0.15)',  color: t.colors.primary },
  approved:  { bg: 'rgba(16,185,129,0.15)',  color: t.colors.accent },
  rejected:  { bg: 'rgba(239,68,68,0.15)',   color: t.colors.danger },
  dev:       { bg: 'rgba(139,92,246,0.15)',  color: '#a78bfa' },
  design:    { bg: 'rgba(236,72,153,0.15)',  color: '#f472b6' },
  content:   { bg: 'rgba(6,182,212,0.15)',   color: '#22d3ee' },
  research:  { bg: 'rgba(245,158,11,0.15)',  color: t.colors.primary },
  marketing: { bg: 'rgba(16,185,129,0.15)',  color: t.colors.accent },
};

export default function Badge({ type, label, style }) {
  const key = (type || '').toLowerCase().replace('-', '_').replace(' ', '_');
  const bs  = BADGE_STYLES[key] || { bg: 'rgba(255,255,255,0.08)', color: '#9ca3af' };

  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '4px',
      background: bs.bg, color: bs.color,
      padding: '3px 8px',
      borderRadius: '20px',
      fontSize: '9px',
      fontFamily: "'Press Start 2P', monospace",
      fontWeight: 400,
      letterSpacing: '0.04em',
      whiteSpace: 'nowrap',
      ...style,
    }}>
      {label || type}
    </span>
  );
}
`);

write("components/common/Toast.jsx", `
import React, { useEffect, useState } from 'react';
import { theme as t } from '@/styles/theme.js';

let _setToasts = null;
let _id = 0;

export function toast(message, type = 'info', duration = 5000) {
  if (_setToasts) {
    const id = ++_id;
    _setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => _setToasts(prev => prev.filter(x => x.id !== id)), duration);
  }
}

export function ToastContainer() {
  const [toasts, setToasts] = useState([]);
  _setToasts = setToasts;

  const colors = { success: t.colors.accent, error: t.colors.danger, warning: t.colors.warning, info: t.colors.primary };

  return (
    <div style={{ position: 'fixed', top: '80px', right: '16px', zIndex: 9998, display: 'flex', flexDirection: 'column', gap: '8px', maxWidth: '340px' }}>
      {toasts.map(toast => (
        <div key={toast.id} style={{
          background: t.colors.bg.card,
          border: '1px solid ' + colors[toast.type],
          borderRadius: t.radius.md,
          padding: '12px 16px',
          color: t.colors.text.primary,
          fontFamily: t.fonts.body,
          fontSize: '12px',
          boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
          animation: 'slideUp 0.2s ease',
          borderLeft: '3px solid ' + colors[toast.type],
        }}>
          {toast.message}
        </div>
      ))}
    </div>
  );
}
`);

write("components/common/Modal.jsx", `
import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { theme as t } from '@/styles/theme.js';

export default function Modal({ open, onClose, title, children, maxWidth = '600px' }) {
  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <div
          onClick={onClose}
          style={{ position: 'fixed', inset: 0, background: t.colors.bg.overlay, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}
        >
          <motion.div
            onClick={e => e.stopPropagation()}
            initial={{ opacity: 0, scale: 0.95, y: 16 }}
            animate={{ opacity: 1, scale: 1,    y: 0  }}
            exit={{    opacity: 0, scale: 0.95, y: 16 }}
            transition={{ duration: 0.18 }}
            style={{
              background: t.colors.bg.dark,
              border: '1px solid ' + t.colors.border.hover,
              borderRadius: t.radius.xl,
              padding: 'clamp(1.25rem, 4vw, 2rem)',
              width: '100%',
              maxWidth,
              maxHeight: '90vh',
              overflowY: 'auto',
              boxShadow: t.colors.glow.goldStrong,
            }}
          >
            {title && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h2 style={{ fontFamily: t.fonts.display, fontSize: 'clamp(10px, 2vw, 13px)', color: t.colors.primary }}>{title}</h2>
                <button onClick={onClose} style={{ background: 'none', border: 'none', color: t.colors.text.secondary, cursor: 'pointer', fontSize: '18px', lineHeight: 1, padding: '4px 8px' }}>×</button>
              </div>
            )}
            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
`);

write("components/common/Input.jsx", `
import React, { useState } from 'react';
import { theme as t } from '@/styles/theme.js';

export default function Input({ label, error, style, textarea, rows, ...props }) {
  const [focused, setFocused] = useState(false);

  const inputStyle = {
    width: '100%',
    background: t.colors.bg.darkest,
    border: '1px solid ' + (error ? t.colors.danger : focused ? t.colors.border.active : t.colors.border.default),
    borderRadius: t.radius.md,
    padding: '10px 14px',
    color: t.colors.text.primary,
    fontFamily: t.fonts.body,
    fontSize: '13px',
    outline: 'none',
    transition: t.transition,
    boxShadow: focused ? t.colors.glow.gold : 'none',
    resize: textarea ? 'vertical' : undefined,
    minHeight: textarea ? (rows ? rows * 24 + 'px' : '100px') : undefined,
    ...style,
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      {label && <label style={{ fontFamily: t.fonts.body, fontSize: '11px', color: t.colors.text.secondary }}>{label}</label>}
      {textarea
        ? <textarea style={inputStyle} rows={rows || 4} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} {...props} />
        : <input    style={inputStyle} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} {...props} />
      }
      {error && <span style={{ fontSize: '11px', color: t.colors.danger }}>{error}</span>}
    </div>
  );
}
`);

write("components/common/Spinner.jsx", `
import React from 'react';
import { theme as t } from '@/styles/theme.js';

export default function Spinner({ size = 24, color }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{ animation: 'spin 0.8s linear infinite' }}>
      <style>{\`@keyframes spin { to { transform: rotate(360deg); } }\`}</style>
      <circle cx="12" cy="12" r="10" fill="none" stroke={color || t.colors.primary} strokeWidth="2" strokeDasharray="31" strokeDashoffset="8" strokeLinecap="round" />
    </svg>
  );
}

export function PageLoader() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', flexDirection: 'column', gap: '16px' }}>
      <Spinner size={40} />
      <span style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '10px', color: t.colors.text.muted }}>LOADING...</span>
    </div>
  );
}
`);

write("components/common/EmptyState.jsx", `
import React from 'react';
import { theme as t } from '@/styles/theme.js';
import Button from './Button.jsx';

export default function EmptyState({ icon = '🎯', title, message, action, onAction }) {
  return (
    <div style={{ textAlign: 'center', padding: 'clamp(2rem, 8vw, 4rem)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
      <div style={{ fontSize: 'clamp(2rem, 6vw, 3rem)', marginBottom: '8px' }}>{icon}</div>
      <h3 style={{ fontFamily: t.fonts.display, fontSize: 'clamp(9px, 2vw, 12px)', color: t.colors.text.secondary }}>{title}</h3>
      {message && <p style={{ color: t.colors.text.muted, fontSize: '12px', maxWidth: '360px' }}>{message}</p>}
      {action && onAction && <Button variant="secondary" onClick={onAction}>{action}</Button>}
    </div>
  );
}
`);

// ═══════════════════════════════════════════════════════════
// LAYOUT
// ═══════════════════════════════════════════════════════════

write("components/layout/AppHeader.jsx", `
import React, { useState, useEffect } from 'react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount } from 'wagmi';
import { theme as t } from '@/styles/theme.js';

const CHAIN_COLORS = { 143: t.colors.primary };

function NavLink({ href, label, active }) {
  const [hovered, setHovered] = useState(false);
  return (
    <a href={href} style={{
      fontFamily: t.fonts.display,
      fontSize: '9px',
      color: active || hovered ? t.colors.primary : t.colors.text.secondary,
      textDecoration: 'none',
      padding: '6px 2px',
      borderBottom: active ? '1px solid ' + t.colors.primary : '1px solid transparent',
      transition: t.transition,
      letterSpacing: '0.04em',
    }}
    onMouseEnter={() => setHovered(true)}
    onMouseLeave={() => setHovered(false)}>
      {label}
    </a>
  );
}

export default function AppHeader() {
  const { chain } = useAccount();
  const [scrolled, setScrolled] = useState(false);
  const hash = typeof window !== 'undefined' ? window.location.hash : '';

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const chainColor = chain ? (CHAIN_COLORS[chain.id] || t.colors.secondary) : null;

  return (
    <header style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
      height: '72px',
      background: scrolled ? 'rgba(10,10,15,0.95)' : 'rgba(10,10,15,0.85)',
      backdropFilter: 'blur(12px)',
      borderBottom: '1px solid ' + (scrolled ? t.colors.border.default : 'transparent'),
      transition: t.transition,
    }}>
      <div className="container" style={{ height: '100%', display: 'flex', alignItems: 'center', gap: '32px' }}>
        {/* Logo */}
        <a href="/#/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
          <span style={{ fontFamily: t.fonts.display, fontSize: 'clamp(10px, 2vw, 13px)', color: t.colors.primary, letterSpacing: '0.06em', textShadow: t.colors.glow.gold }}>
            [NadWork]
          </span>
        </a>

        {/* Nav */}
        <nav style={{ display: 'flex', gap: 'clamp(12px, 3vw, 24px)', flex: 1, alignItems: 'center' }}>
          <NavLink href="/#/"           label="BOUNTIES"  active={hash === '#/' || hash === '' || hash === '#'} />
          <NavLink href="/#/post"       label="POST"      active={hash === '#/post'} />
          <NavLink href="/#/leaderboard"label="BOARD"     active={hash === '#/leaderboard'} />
          <NavLink href="/#/dashboard"  label="DASHBOARD" active={hash === '#/dashboard'} />
        </nav>

        {/* Chain indicator + wallet */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
          {chainColor && (
            <span style={{
              fontFamily: t.fonts.body, fontSize: '9px',
              color: chainColor, border: '1px solid ' + chainColor,
              padding: '3px 8px', borderRadius: '20px',
              display: 'none',
            }}
            className="chain-badge">
              MONAD
            </span>
          )}
          <ConnectButton />
        </div>
      </div>
    </header>
  );
}
`);

write("components/layout/AppFooter.jsx", `
import React from 'react';
import { theme as t } from '@/styles/theme.js';

export default function AppFooter() {
  return (
    <footer style={{
      borderTop: '1px solid ' + t.colors.border.default,
      padding: 'clamp(1.5rem, 4vw, 2.5rem) 0',
      marginTop: 'auto',
    }}>
      <div className="container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <span style={{ fontFamily: t.fonts.display, fontSize: '10px', color: t.colors.primary }}>
          [NadWork]
        </span>
        <span style={{ fontFamily: t.fonts.body, fontSize: '11px', color: t.colors.text.muted }}>
          Hunt. Submit. Earn. — Built on{' '}
          <a href="https://monad.xyz" target="_blank" rel="noopener" style={{ color: t.colors.primary, textDecoration: 'none' }}>Monad</a>
        </span>
        <span style={{ fontFamily: t.fonts.body, fontSize: '10px', color: t.colors.text.muted }}>
          © 2026 NadWork
        </span>
      </div>
    </footer>
  );
}
`);

// ═══════════════════════════════════════════════════════════
// BOUNTY COMPONENTS
// ═══════════════════════════════════════════════════════════

write("components/bounty/DeadlineTimer.jsx", `
import React, { useState, useEffect } from 'react';
import { theme as t } from '@/styles/theme.js';
import { isUrgent } from '@/utils/format.js';

export default function DeadlineTimer({ deadline }) {
  const [label, setLabel] = useState('');

  useEffect(() => {
    function update() {
      const now  = Math.floor(Date.now() / 1000);
      const diff = Number(deadline) - now;
      if (diff <= 0) { setLabel('EXPIRED'); return; }
      const d = Math.floor(diff / 86400);
      const h = Math.floor((diff % 86400) / 3600);
      const m = Math.floor((diff % 3600) / 60);
      const s = diff % 60;
      if (d > 1) setLabel(d + 'd ' + h + 'h');
      else if (d === 1) setLabel('1d ' + h + 'h ' + m + 'm');
      else if (h > 0)   setLabel(h + 'h ' + m + 'm');
      else              setLabel(m + 'm ' + s + 's');
    }
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [deadline]);

  const urgent = isUrgent(deadline);
  return (
    <span style={{
      fontFamily: t.fonts.number,
      fontSize: '13px',
      color: urgent ? t.colors.danger : t.colors.text.secondary,
      animation: urgent ? 'goldPulse 1.5s infinite' : 'none',
    }}>
      {label}
    </span>
  );
}
`);

write("components/bounty/BountyCard.jsx", `
import React, { useState, useEffect } from 'react';
import { theme as t } from '@/styles/theme.js';
import Card from '@/components/common/Card.jsx';
import Badge from '@/components/common/Badge.jsx';
import DeadlineTimer from './DeadlineTimer.jsx';
import { formatReward, shortAddr, categoryLabel } from '@/utils/format.js';
import { fetchJSON } from '@/config/pinata.js';
import { BOUNTY_STATUS } from '@/config/contracts.js';

export default function BountyCard({ bounty, onClick }) {
  const [meta, setMeta] = useState(null);

  useEffect(() => {
    if (bounty.ipfsHash) fetchJSON(bounty.ipfsHash).then(setMeta);
  }, [bounty.ipfsHash]);

  const title    = meta?.title    || bounty.title    || 'Untitled Bounty';
  const category = meta?.category || bounty.category || '';
  const statusKey = BOUNTY_STATUS[bounty.status]?.toLowerCase() || 'active';

  return (
    <Card hoverable glow onClick={onClick} style={{ cursor: 'pointer' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          <Badge type={statusKey} label={statusKey.toUpperCase()} />
          {category && <Badge type={category} label={categoryLabel(category)} />}
          <Badge type={bounty.bountyType === 1 ? 'first_come' : 'open'} label={bounty.bountyType === 1 ? 'FIRST' : 'OPEN'} />
        </div>
        <span style={{ fontFamily: t.fonts.number, fontSize: 'clamp(14px, 3vw, 18px)', color: t.colors.primary, fontWeight: 700, textShadow: t.colors.glow.gold }}>
          {formatReward(bounty.totalReward, bounty.rewardType)}
        </span>
      </div>

      <h3 style={{ fontFamily: t.fonts.display, fontSize: 'clamp(9px, 1.8vw, 11px)', color: t.colors.text.primary, marginBottom: '12px', lineHeight: 1.7, letterSpacing: '0.03em' }}>
        {title.length > 60 ? title.slice(0, 60) + '...' : title}
      </h3>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '11px', color: t.colors.text.muted }}>
            by {shortAddr(bounty.poster)}
          </span>
          <span style={{ fontSize: '11px', color: t.colors.text.muted }}>
            {String(bounty.submissionCount)} subs
          </span>
        </div>
        {bounty.status === 0 && <DeadlineTimer deadline={bounty.deadline} />}
      </div>

      {bounty.winnerCount > 1 && (
        <div style={{ marginTop: '10px', fontSize: '10px', color: t.colors.text.muted, fontFamily: t.fonts.body }}>
          🏆 {bounty.winnerCount} winners · {bounty.prizeWeights?.join('/') || ''}%
        </div>
      )}
    </Card>
  );
}
`);

write("components/bounty/BountyFilter.jsx", `
import React from 'react';
import { theme as t } from '@/styles/theme.js';
import { CATEGORIES } from '@/config/contracts.js';
import { categoryLabel } from '@/utils/format.js';

export default function BountyFilter({ filters, onChange }) {
  const categories = ['all', ...CATEGORIES];
  const statuses   = ['all', 'active', 'completed', 'expired'];
  const types      = ['all', 'open', 'first_come'];
  const sorts      = [
    { value: 'newest',  label: 'NEWEST'  },
    { value: 'reward',  label: 'HIGHEST' },
    { value: 'ending',  label: 'ENDING'  },
  ];

  const tabStyle = (active) => ({
    background: active ? t.colors.bg.surface : 'transparent',
    border: active ? '1px solid ' + t.colors.border.hover : '1px solid transparent',
    color: active ? t.colors.primary : t.colors.text.secondary,
    fontFamily: t.fonts.display,
    fontSize: '8px',
    padding: '6px 10px',
    borderRadius: t.radius.sm,
    cursor: 'pointer',
    transition: t.transition,
    whiteSpace: 'nowrap',
    minHeight: '32px',
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {/* Category tabs */}
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
        {categories.map(cat => (
          <button key={cat} style={tabStyle(filters.category === cat)}
            onClick={() => onChange({ ...filters, category: cat })}>
            {cat === 'all' ? 'ALL' : categoryLabel(cat).toUpperCase()}
          </button>
        ))}
      </div>

      {/* Status + Type + Sort row */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: '4px' }}>
          {statuses.map(s => (
            <button key={s} style={tabStyle(filters.status === s)}
              onClick={() => onChange({ ...filters, status: s })}>
              {s.toUpperCase()}
            </button>
          ))}
        </div>
        <div style={{ width: '1px', height: '24px', background: t.colors.border.default }} />
        <div style={{ display: 'flex', gap: '4px' }}>
          {types.map(tp => (
            <button key={tp} style={tabStyle(filters.type === tp)}
              onClick={() => onChange({ ...filters, type: tp })}>
              {tp === 'first_come' ? 'FIRST' : tp.toUpperCase()}
            </button>
          ))}
        </div>
        <div style={{ flex: 1 }} />
        <div style={{ display: 'flex', gap: '4px' }}>
          {sorts.map(s => (
            <button key={s.value} style={tabStyle(filters.sort === s.value)}
              onClick={() => onChange({ ...filters, sort: s.value })}>
              {s.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
`);

write("components/bounty/SubmitWorkModal.jsx", `
import React, { useState } from 'react';
import { useWalletClient } from 'wagmi';
import Modal from '@/components/common/Modal.jsx';
import Button from '@/components/common/Button.jsx';
import Input from '@/components/common/Input.jsx';
import { theme as t } from '@/styles/theme.js';
import { uploadJSON, buildSubmissionMeta } from '@/config/pinata.js';
import { getContract } from '@/utils/ethers.js';
import { ADDRESSES, FACTORY_ABI } from '@/config/contracts.js';
import { toast } from '@/components/common/Toast.jsx';
import { explorerUrl } from '@/utils/format.js';

export default function SubmitWorkModal({ open, onClose, bountyId, onSuccess }) {
  const { data: walletClient } = useWalletClient();
  const [form, setForm]   = useState({ title: '', description: '', links: '' });
  const [step, setStep]   = useState('idle'); // idle | uploading | confirming | done

  const handleSubmit = async () => {
    if (!walletClient) return;
    if (!form.title.trim()) return;

    try {
      setStep('uploading');

      const deliverables = form.links.split('\\n')
        .map(l => l.trim())
        .filter(Boolean)
        .map(url => ({ type: 'url', label: 'Link', value: url }));

      const meta = buildSubmissionMeta({
        bountyId,
        hunterAddress: walletClient.account.address,
        title: form.title,
        description: form.description,
        deliverables,
      });

      const cid = await uploadJSON(meta, 'submission-' + bountyId);

      setStep('confirming');
      const factory = await getContract(ADDRESSES.factory, FACTORY_ABI, walletClient);
      const tx = await factory.submitWork(bountyId, cid);
      const receipt = await tx.wait();

      setStep('done');
      toast('Submission confirmed! 🎯', 'success');
      if (onSuccess) onSuccess(receipt.hash);
      setTimeout(() => { onClose(); setStep('idle'); setForm({ title: '', description: '', links: '' }); }, 2000);
    } catch (err) {
      console.error(err);
      toast('Submission failed: ' + (err.reason || err.message || 'Unknown error'), 'error');
      setStep('idle');
    }
  };

  return (
    <Modal open={open} onClose={step === 'idle' ? onClose : undefined} title="SUBMIT WORK">
      {step === 'done' ? (
        <div style={{ textAlign: 'center', padding: '2rem', color: t.colors.accent }}>
          <div style={{ fontSize: '2rem', marginBottom: '12px' }}>✓</div>
          <p style={{ fontFamily: t.fonts.display, fontSize: '10px' }}>SUBMITTED!</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <Input label="Submission Title *" placeholder="e.g. Landing page redesign v2" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} />
          <Input label="Description" textarea rows={4} placeholder="Describe your work, approach, and what you built..." value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} />
          <Input label="Links (one per line)" textarea rows={3} placeholder={"https://figma.com/...\\nhttps://github.com/..."} value={form.links} onChange={e => setForm(p => ({ ...p, links: e.target.value }))} />

          <div style={{ padding: '12px', background: t.colors.bg.surface, borderRadius: t.radius.md, fontSize: '11px', color: t.colors.text.muted }}>
            📦 Your submission will be stored on IPFS — permanent and censorship-resistant.
          </div>

          <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
            <Button variant="ghost" onClick={onClose} disabled={step !== 'idle'}>Cancel</Button>
            <Button onClick={handleSubmit} loading={step !== 'idle'} disabled={!form.title.trim() || !walletClient}>
              {step === 'uploading' ? 'UPLOADING...' : step === 'confirming' ? 'CONFIRM TX...' : 'SUBMIT WORK'}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
`);

// ═══════════════════════════════════════════════════════════
// HOOKS
// ═══════════════════════════════════════════════════════════

write("hooks/useBounties.js", `
import { useState, useEffect, useCallback, useRef } from 'react';
import { getReadContract } from '@/utils/ethers.js';
import { ADDRESSES, REGISTRY_ABI } from '@/config/contracts.js';

export function useBounties({ category = 'all', status = 'all', type = 'all', sort = 'newest', page = 0 } = {}) {
  const [bounties, setBounties] = useState([]);
  const [total,    setTotal]    = useState(0);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(null);
  const mountedRef = useRef(true);
  const LIMIT = 20;

  const fetch = useCallback(async () => {
    if (!ADDRESSES.registry) { setLoading(false); return; }
    try {
      setLoading(true);
      const reg = getReadContract(ADDRESSES.registry, REGISTRY_ABI);
      let result, total;
      const offset = page * LIMIT;

      if (category !== 'all') {
        [result, total] = await reg.getBountiesByCategory(category, offset, LIMIT);
      } else if (status === 'active') {
        [result, total] = await reg.getActiveBounties(offset, LIMIT);
      } else {
        [result, total] = await reg.getAllBounties(offset, LIMIT);
      }

      if (!mountedRef.current) return;

      let filtered = [...result];

      if (status !== 'all' && status !== 'active') {
        const statusMap = { active: 0, reviewing: 1, completed: 2, expired: 3, cancelled: 4 };
        filtered = filtered.filter(b => b.status === (statusMap[status] ?? -1));
      }
      if (type === 'open')       filtered = filtered.filter(b => b.bountyType === 0);
      if (type === 'first_come') filtered = filtered.filter(b => b.bountyType === 1);
      if (sort === 'reward') filtered.sort((a, b) => Number(b.totalReward - a.totalReward));
      if (sort === 'ending') filtered.sort((a, b) => Number(a.deadline - b.deadline));

      setBounties(filtered);
      setTotal(Number(total));
    } catch (err) {
      console.error(err);
      if (mountedRef.current) setError(err.message);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [category, status, type, sort, page]);

  useEffect(() => {
    mountedRef.current = true;
    fetch();
    const id = setInterval(fetch, 15000);
    return () => { mountedRef.current = false; clearInterval(id); };
  }, [fetch]);

  return { bounties, total, loading, error, refetch: fetch };
}
`);

write("hooks/useBounty.js", `
import { useState, useEffect, useCallback, useRef } from 'react';
import { getReadContract } from '@/utils/ethers.js';
import { ADDRESSES, REGISTRY_ABI } from '@/config/contracts.js';
import { fetchJSON } from '@/config/pinata.js';

export function useBounty(bountyId) {
  const [bounty,      setBounty]      = useState(null);
  const [meta,        setMeta]        = useState(null);
  const [submissions, setSubmissions] = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState(null);
  const mountedRef = useRef(true);

  const fetch = useCallback(async () => {
    if (!bountyId || !ADDRESSES.registry) return;
    try {
      const reg = getReadContract(ADDRESSES.registry, REGISTRY_ABI);
      const [b, subs] = await Promise.all([
        reg.getBounty(bountyId),
        reg.getBountySubmissions(bountyId),
      ]);
      if (!mountedRef.current) return;
      setBounty(b);
      setSubmissions([...subs]);
      if (b.ipfsHash) fetchJSON(b.ipfsHash).then(m => mountedRef.current && setMeta(m));
    } catch (err) {
      if (mountedRef.current) setError(err.message);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [bountyId]);

  useEffect(() => {
    mountedRef.current = true;
    setLoading(true);
    fetch();
    const id = setInterval(fetch, 12000);
    return () => { mountedRef.current = false; clearInterval(id); };
  }, [fetch]);

  return { bounty, meta, submissions, loading, error, refetch: fetch };
}
`);

write("hooks/useProfile.js", `
import { useState, useEffect, useCallback, useRef } from 'react';
import { getReadContract } from '@/utils/ethers.js';
import { ADDRESSES, REGISTRY_ABI, REPUTATION_ABI } from '@/config/contracts.js';

export function useProfile(address) {
  const [hunterStats,  setHunterStats]  = useState(null);
  const [projectStats, setProjectStats] = useState(null);
  const [score,        setScore]        = useState(0n);
  const [winRate,      setWinRate]      = useState(0n);
  const [submissions,  setSubmissions]  = useState([]);
  const [bountyIds,    setBountyIds]    = useState([]);
  const [loading,      setLoading]      = useState(true);
  const mountedRef = useRef(true);

  const fetch = useCallback(async () => {
    if (!address || !ADDRESSES.registry) return;
    try {
      const reg = getReadContract(ADDRESSES.registry, REGISTRY_ABI);
      const rep = getReadContract(ADDRESSES.reputation, REPUTATION_ABI);
      const [hunter, project, score, winRate, subs, bids] = await Promise.all([
        rep.hunters(address),
        rep.projects(address),
        rep.getHunterScore(address),
        rep.getWinRate(address),
        reg.getHunterSubmissions(address),
        reg.getPosterBounties(address),
      ]);
      if (!mountedRef.current) return;
      setHunterStats(hunter);
      setProjectStats(project);
      setScore(score);
      setWinRate(winRate);
      setSubmissions([...subs]);
      setBountyIds([...bids]);
    } catch (err) {
      console.error(err);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [address]);

  useEffect(() => {
    mountedRef.current = true;
    setLoading(true);
    fetch();
    return () => { mountedRef.current = false; };
  }, [fetch]);

  return { hunterStats, projectStats, score, winRate, submissions, bountyIds, loading };
}
`);

write("hooks/useGlobalStats.js", `
import { useState, useEffect, useRef } from 'react';
import { getReadContract } from '@/utils/ethers.js';
import { ADDRESSES, REGISTRY_ABI } from '@/config/contracts.js';

export function useGlobalStats() {
  const [stats, setStats] = useState({ bountyCount: 0n, submissionCount: 0n });
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    async function load() {
      if (!ADDRESSES.registry) return;
      try {
        const reg = getReadContract(ADDRESSES.registry, REGISTRY_ABI);
        const [bc, sc] = await Promise.all([reg.bountyCount(), reg.submissionCount()]);
        if (mountedRef.current) setStats({ bountyCount: bc, submissionCount: sc });
      } catch {}
    }
    load();
    const id = setInterval(load, 30000);
    return () => { mountedRef.current = false; clearInterval(id); };
  }, []);

  return stats;
}
`);

// ═══════════════════════════════════════════════════════════
// PAGES
// ═══════════════════════════════════════════════════════════

write("pages/HomePage.jsx", `
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { theme as t } from '@/styles/theme.js';
import { useBounties } from '@/hooks/useBounties.js';
import { useGlobalStats } from '@/hooks/useGlobalStats.js';
import BountyCard from '@/components/bounty/BountyCard.jsx';
import BountyFilter from '@/components/bounty/BountyFilter.jsx';
import Button from '@/components/common/Button.jsx';
import { PageLoader } from '@/components/common/Spinner.jsx';
import EmptyState from '@/components/common/EmptyState.jsx';

export default function HomePage() {
  const [filters, setFilters] = useState({ category: 'all', status: 'all', type: 'all', sort: 'newest' });
  const { bounties, loading } = useBounties(filters);
  const { bountyCount } = useGlobalStats();

  return (
    <div className="app-content">
      {/* Hero */}
      <section style={{ padding: 'clamp(3rem, 10vw, 6rem) 0 clamp(2rem, 6vw, 3rem)', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
        <div className="container">
          <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <p style={{ fontFamily: t.fonts.body, fontSize: 'clamp(10px, 2vw, 12px)', color: t.colors.text.muted, letterSpacing: '0.15em', marginBottom: '16px' }}>
              THE ON-CHAIN BOUNTY PLATFORM FOR MONAD
            </p>
            <h1 style={{
              fontFamily: t.fonts.display,
              fontSize: 'clamp(18px, 5vw, 36px)',
              color: t.colors.primary,
              letterSpacing: '0.06em',
              lineHeight: 1.4,
              textShadow: t.colors.glow.goldStrong,
              marginBottom: '24px',
            }}>
              HUNT.<br/>SUBMIT.<br/>EARN.
            </h1>
            <p style={{ color: t.colors.text.secondary, maxWidth: '480px', margin: '0 auto 32px', fontSize: 'clamp(12px, 2vw, 14px)', lineHeight: 1.8 }}>
              Permissionless bounties on Monad. Projects deposit rewards in escrow.
              Hunters submit work. Auto-release on approval. No middleman.
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
              <Button size="lg" onClick={() => document.getElementById('bounty-list').scrollIntoView({ behavior: 'smooth' })}>
                BROWSE BOUNTIES
              </Button>
              <Button size="lg" variant="secondary" onClick={() => window.location.hash = '#/post'}>
                POST A BOUNTY
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Stats bar */}
      <section style={{ borderTop: '1px solid ' + t.colors.border.default, borderBottom: '1px solid ' + t.colors.border.default, padding: 'clamp(1rem, 3vw, 1.5rem) 0', background: t.colors.bg.surface }}>
        <div className="container">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '16px', textAlign: 'center' }}>
            {[
              { label: 'ACTIVE BOUNTIES', value: String(bountyCount || '0') },
              { label: 'PLATFORM FEE',    value: '3%' },
              { label: 'REWARDS',         value: 'MON + USDC' },
              { label: 'DISPUTE PROTECTION', value: '7-DAY' },
            ].map(s => (
              <div key={s.label}>
                <div style={{ fontFamily: t.fonts.number, fontSize: 'clamp(20px, 4vw, 28px)', color: t.colors.primary, animation: 'countUp 0.5s ease' }}>{s.value}</div>
                <div style={{ fontFamily: t.fonts.display, fontSize: '8px', color: t.colors.text.muted, marginTop: '4px', letterSpacing: '0.06em' }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Bounty list */}
      <section id="bounty-list" className="page-section">
        <div className="container">
          <div style={{ marginBottom: '24px' }}>
            <BountyFilter filters={filters} onChange={setFilters} />
          </div>

          {loading ? (
            <PageLoader />
          ) : bounties.length === 0 ? (
            <EmptyState
              icon="🎯"
              title="NO BOUNTIES FOUND"
              message="Be the first to post a bounty for the Monad ecosystem."
              action="POST A BOUNTY"
              onAction={() => window.location.hash = '#/post'}
            />
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 340px), 1fr))', gap: '16px' }}>
              {bounties.map((b, i) => (
                <motion.div key={String(b.id)} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
                  <BountyCard bounty={b} onClick={() => window.location.hash = '#/bounty/' + String(b.id)} />
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* How it works */}
      <section style={{ padding: 'clamp(2rem, 6vw, 4rem) 0', borderTop: '1px solid ' + t.colors.border.default }}>
        <div className="container">
          <h2 style={{ fontFamily: t.fonts.display, fontSize: 'clamp(10px, 2vw, 13px)', color: t.colors.primary, textAlign: 'center', marginBottom: '2rem', letterSpacing: '0.06em' }}>
            HOW IT WORKS
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
            {[
              { n: '01', title: 'POST BOUNTY', desc: 'Projects deposit MON or USDC into escrow and define the task.' },
              { n: '02', title: 'SUBMIT WORK', desc: 'Hunters submit deliverables stored permanently on IPFS.' },
              { n: '03', title: 'REVIEW',      desc: 'Project reviews submissions and selects winner(s).' },
              { n: '04', title: 'AUTO-RELEASE',desc: 'Escrow auto-releases to winners. 3% fee to treasury. Fully on-chain.' },
            ].map(step => (
              <div key={step.n} style={{ padding: 'clamp(1rem, 3vw, 1.5rem)', background: t.colors.bg.surface, border: '1px solid ' + t.colors.border.default, borderRadius: t.radius.lg, textAlign: 'center' }}>
                <div style={{ fontFamily: t.fonts.number, fontSize: 'clamp(28px, 5vw, 36px)', color: t.colors.primary, opacity: 0.4, marginBottom: '8px' }}>{step.n}</div>
                <h3 style={{ fontFamily: t.fonts.display, fontSize: '9px', color: t.colors.primary, marginBottom: '8px', letterSpacing: '0.04em' }}>{step.title}</h3>
                <p style={{ fontSize: '12px', color: t.colors.text.muted, lineHeight: 1.7 }}>{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
`);

write("pages/BountyDetailPage.jsx", `
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useAccount, useWalletClient } from 'wagmi';
import { theme as t } from '@/styles/theme.js';
import { useBounty } from '@/hooks/useBounty.js';
import Card from '@/components/common/Card.jsx';
import Badge from '@/components/common/Badge.jsx';
import Button from '@/components/common/Button.jsx';
import DeadlineTimer from '@/components/bounty/DeadlineTimer.jsx';
import SubmitWorkModal from '@/components/bounty/SubmitWorkModal.jsx';
import { PageLoader } from '@/components/common/Spinner.jsx';
import { formatReward, shortAddr, formatDate, explorerUrl } from '@/utils/format.js';
import { BOUNTY_STATUS, ADDRESSES, FACTORY_ABI } from '@/config/contracts.js';
import { getContract } from '@/utils/ethers.js';
import { toast } from '@/components/common/Toast.jsx';

export default function BountyDetailPage({ bountyId }) {
  const { address } = useAccount();
  const { data: walletClient } = useWalletClient();
  const { bounty, meta, submissions, loading, refetch } = useBounty(bountyId);
  const [showSubmit, setShowSubmit] = useState(false);
  const [approving, setApproving] = useState(false);
  const [selected, setSelected] = useState([]);

  if (loading) return <PageLoader />;
  if (!bounty) return <div style={{ padding: '4rem', textAlign: 'center', color: t.colors.text.muted }}>Bounty not found.</div>;

  const statusKey   = BOUNTY_STATUS[bounty.status]?.toLowerCase() || 'active';
  const isPoster    = address?.toLowerCase() === bounty.poster?.toLowerCase();
  const isActive    = bounty.status === 0;
  const alreadySub  = submissions.some(s => s.hunter?.toLowerCase() === address?.toLowerCase());
  const canSubmit   = !isPoster && isActive && !alreadySub && address;

  const handleApprove = async () => {
    if (!walletClient || selected.length !== Number(bounty.winnerCount)) {
      toast('Select exactly ' + bounty.winnerCount + ' winner(s)', 'warning'); return;
    }
    try {
      setApproving(true);
      const factory = await getContract(ADDRESSES.factory, FACTORY_ABI, walletClient);
      const ranks   = selected.map((_, i) => i + 1);
      const tx      = await factory.approveWinners(bountyId, selected, ranks);
      await tx.wait();
      toast('Winners approved! Funds released. ✓', 'success');
      setSelected([]);
      refetch();
    } catch (err) {
      toast('Approval failed: ' + (err.reason || err.message), 'error');
    } finally {
      setApproving(false);
    }
  };

  const handleTimeout = async () => {
    if (!walletClient) return;
    try {
      const factory = await getContract(ADDRESSES.factory, FACTORY_ABI, walletClient);
      const tx = await factory.triggerTimeout(bountyId);
      await tx.wait();
      toast('Timeout triggered. Funds split equally. ✓', 'success');
      refetch();
    } catch (err) {
      toast('Failed: ' + (err.reason || err.message), 'error');
    }
  };

  return (
    <div className="app-content">
      <div className="container" style={{ padding: 'clamp(1.5rem, 4vw, 3rem) clamp(1rem, 4vw, 2rem)' }}>
        <button onClick={() => window.location.hash = '#/'} style={{ background: 'none', border: 'none', color: t.colors.text.secondary, cursor: 'pointer', fontFamily: t.fonts.body, fontSize: '12px', marginBottom: '1.5rem', padding: 0 }}>
          ← Back to Bounties
        </button>

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,360px)', gap: '24px', alignItems: 'start' }}>

          {/* Left: Details */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px' }}>
              <Badge type={statusKey} label={statusKey.toUpperCase()} />
              <Badge type={bounty.bountyType === 1 ? 'first_come' : 'open'} label={bounty.bountyType === 1 ? 'FIRST-COME' : 'OPEN'} />
              {bounty.category && <Badge type={bounty.category} label={bounty.category.toUpperCase()} />}
            </div>

            <h1 style={{ fontFamily: t.fonts.display, fontSize: 'clamp(12px, 2.5vw, 16px)', color: t.colors.primary, marginBottom: '16px', lineHeight: 1.6 }}>
              {meta?.title || bounty.title}
            </h1>

            <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', marginBottom: '24px', color: t.colors.text.muted, fontSize: '12px' }}>
              <span>Posted by <a href={'#/profile/' + bounty.poster} style={{ color: t.colors.primary, textDecoration: 'none' }}>{shortAddr(bounty.poster)}</a></span>
              <span>Created {formatDate(bounty.createdAt)}</span>
              <span>{String(bounty.submissionCount)} submissions</span>
            </div>

            <Card>
              <h3 style={{ fontFamily: t.fonts.display, fontSize: '9px', color: t.colors.primary, marginBottom: '12px' }}>DESCRIPTION</h3>
              <p style={{ color: t.colors.text.secondary, fontSize: '13px', lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>
                {meta?.fullDescription || 'Loading description...'}
              </p>
            </Card>

            {meta?.requirements?.length > 0 && (
              <Card style={{ marginTop: '16px' }}>
                <h3 style={{ fontFamily: t.fonts.display, fontSize: '9px', color: t.colors.primary, marginBottom: '12px' }}>REQUIREMENTS</h3>
                <ul style={{ paddingLeft: '16px', color: t.colors.text.secondary, fontSize: '13px', lineHeight: 2 }}>
                  {meta.requirements.map((r, i) => <li key={i}>{r}</li>)}
                </ul>
              </Card>
            )}

            {/* Submissions section (poster view) */}
            {isPoster && submissions.length > 0 && (
              <Card style={{ marginTop: '24px' }}>
                <h3 style={{ fontFamily: t.fonts.display, fontSize: '9px', color: t.colors.primary, marginBottom: '16px' }}>
                  SUBMISSIONS ({submissions.length})
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {submissions.map(s => (
                    <div key={String(s.id)} style={{ padding: '12px', background: t.colors.bg.surface, borderRadius: t.radius.md, border: '1px solid ' + (selected.includes(String(s.id)) ? t.colors.border.active : t.colors.border.default) }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                        <div>
                          <span style={{ color: t.colors.text.secondary, fontSize: '12px' }}>{shortAddr(s.hunter)}</span>
                          <Badge type={['pending','approved','rejected'][s.status]} label={['PENDING','APPROVED','REJECTED'][s.status]} style={{ marginLeft: '8px' }} />
                        </div>
                        {s.ipfsHash && (
                          <a href={'https://ipfs.io/ipfs/' + s.ipfsHash} target="_blank" rel="noopener" style={{ color: t.colors.primary, fontSize: '11px' }}>View →</a>
                        )}
                        {isActive && s.status === 0 && (
                          <Button size="sm" variant="secondary"
                            onClick={() => setSelected(p => p.includes(String(s.id)) ? p.filter(x => x !== String(s.id)) : [...p, String(s.id)])}>
                            {selected.includes(String(s.id)) ? '✓ Selected' : 'Select'}
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                {isActive && selected.length > 0 && (
                  <Button style={{ marginTop: '16px', width: '100%' }} loading={approving} onClick={handleApprove}>
                    APPROVE {selected.length} WINNER{selected.length > 1 ? 'S' : ''} & RELEASE FUNDS
                  </Button>
                )}
              </Card>
            )}
          </motion.div>

          {/* Right: Action panel */}
          <div style={{ position: 'sticky', top: '88px' }}>
            <Card glow>
              <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                <div style={{ fontFamily: t.fonts.number, fontSize: 'clamp(24px, 5vw, 32px)', color: t.colors.primary, textShadow: t.colors.glow.goldStrong }}>
                  {formatReward(bounty.totalReward, bounty.rewardType)}
                </div>
                <div style={{ fontSize: '11px', color: t.colors.text.muted, marginTop: '4px' }}>Total Prize Pool</div>
              </div>

              {bounty.winnerCount > 1 && (
                <div style={{ marginBottom: '16px', padding: '12px', background: t.colors.bg.surface, borderRadius: t.radius.md }}>
                  <div style={{ fontSize: '10px', color: t.colors.text.muted, marginBottom: '8px', fontFamily: t.fonts.display }}>PRIZE SPLIT</div>
                  {bounty.prizeWeights.map((w, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: t.colors.text.secondary, marginBottom: '4px' }}>
                      <span>#{i+1} Place</span><span style={{ color: t.colors.primary }}>{String(w)}%</span>
                    </div>
                  ))}
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' }}>
                {[
                  { label: 'DEADLINE', value: <DeadlineTimer deadline={bounty.deadline} /> },
                  { label: 'SUBMISSIONS', value: String(bounty.submissionCount) + (bounty.maxSubmissions > 0 ? '/' + String(bounty.maxSubmissions) : '') },
                  { label: 'FEE', value: '3% platform fee' },
                ].map(row => (
                  <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px' }}>
                    <span style={{ color: t.colors.text.muted, fontFamily: t.fonts.display, fontSize: '8px' }}>{row.label}</span>
                    <span style={{ color: t.colors.text.secondary }}>{row.value}</span>
                  </div>
                ))}
              </div>

              {canSubmit && <Button fullWidth size="lg" onClick={() => setShowSubmit(true)}>SUBMIT WORK</Button>}
              {!address && <Button fullWidth size="lg" variant="secondary" onClick={() => {}}>CONNECT WALLET</Button>}
              {alreadySub && !isPoster && <Button fullWidth disabled>ALREADY SUBMITTED</Button>}
              {!isActive && <Badge type={statusKey} label={statusKey.toUpperCase()} style={{ display: 'block', textAlign: 'center', padding: '12px' }} />}

              {/* Timeout button */}
              {address && !isPoster && !isActive && bounty.status === 0 && submissions.length > 0 && (
                <Button fullWidth variant="ghost" style={{ marginTop: '8px' }} onClick={handleTimeout}>
                  TRIGGER TIMEOUT
                </Button>
              )}
            </Card>
          </div>
        </div>
      </div>

      <SubmitWorkModal open={showSubmit} onClose={() => setShowSubmit(false)} bountyId={bountyId} onSuccess={refetch} />
    </div>
  );
}
`);

write("pages/PostBountyPage.jsx", `
import React, { useState } from 'react';
import { useAccount, useWalletClient } from 'wagmi';
import { ethers } from 'ethers';
import { motion } from 'framer-motion';
import { theme as t } from '@/styles/theme.js';
import Card from '@/components/common/Card.jsx';
import Button from '@/components/common/Button.jsx';
import Input from '@/components/common/Input.jsx';
import { uploadJSON, buildBountyMeta } from '@/config/pinata.js';
import { getContract } from '@/utils/ethers.js';
import { ADDRESSES, FACTORY_ABI, ERC20_ABI, CATEGORIES } from '@/config/contracts.js';
import { toast } from '@/components/common/Toast.jsx';
import { categoryLabel } from '@/utils/format.js';

const STEPS = ['BASICS', 'REWARD', 'REVIEW'];

export default function PostBountyPage() {
  const { address }  = useAccount();
  const { data: wc } = useWalletClient();

  const [step, setStep]     = useState(0);
  const [submitting, setSub] = useState(false);

  const [form, setForm] = useState({
    title: '', description: '', requirements: [''], category: 'dev',
    bountyType: 0, deadlineDate: '', maxSubmissions: 0,
    rewardType: 0, rewardAmount: '', winnerCount: 1, prizeWeights: [100],
    rewardToken: '',
  });

  const set = (key, val) => setForm(p => ({ ...p, [key]: val }));

  const addReq    = () => setForm(p => ({ ...p, requirements: [...p.requirements, ''] }));
  const removeReq = (i) => setForm(p => ({ ...p, requirements: p.requirements.filter((_, j) => j !== i) }));
  const setReq    = (i, v) => setForm(p => ({ ...p, requirements: p.requirements.map((r, j) => j === i ? v : r) }));

  const setWinnerCount = (n) => {
    const weights = n === 1 ? [100] : n === 2 ? [60, 40] : n === 3 ? [60, 30, 10] : n === 4 ? [50, 25, 15, 10] : [40, 25, 15, 12, 8];
    setForm(p => ({ ...p, winnerCount: n, prizeWeights: weights }));
  };

  const updateWeight = (i, val) => {
    const weights = [...form.prizeWeights];
    weights[i] = Math.max(0, Math.min(100, Number(val) || 0));
    setForm(p => ({ ...p, prizeWeights: weights }));
  };

  const weightSum  = form.prizeWeights.reduce((a, b) => a + b, 0);
  const deadline   = form.deadlineDate ? Math.floor(new Date(form.deadlineDate).getTime() / 1000) : 0;
  const totalWei   = form.rewardAmount ? ethers.parseEther(form.rewardAmount) : 0n;
  const fee        = totalWei ? totalWei * 300n / 10000n : 0n;
  const payout     = totalWei - fee;

  const handlePublish = async () => {
    if (!wc || !address) { toast('Connect wallet first', 'warning'); return; }
    if (!form.title.trim()) { toast('Title required', 'error'); return; }
    if (!form.rewardAmount || parseFloat(form.rewardAmount) <= 0) { toast('Enter reward amount', 'error'); return; }
    if (!deadline || deadline < Math.floor(Date.now()/1000) + 3600) { toast('Deadline must be at least 1 hour away', 'error'); return; }
    if (weightSum !== 100) { toast('Prize weights must sum to 100', 'error'); return; }

    try {
      setSub(true);
      toast('Uploading to IPFS...', 'info');

      const ipfsHash = await uploadJSON(buildBountyMeta({
        title: form.title, fullDescription: form.description,
        requirements: form.requirements.filter(Boolean),
        category: form.category,
      }), 'bounty-' + Date.now());

      toast('Confirm transaction in wallet...', 'info');
      const factory = await getContract(ADDRESSES.factory, FACTORY_ABI, wc);

      let tx;
      if (form.rewardType === 0) {
        tx = await factory.createBounty(
          ipfsHash, form.title, form.category,
          form.bountyType, 0, ethers.ZeroAddress,
          totalWei, form.winnerCount, form.prizeWeights,
          deadline, form.maxSubmissions,
          { value: totalWei }
        );
      } else {
        const usdc = await getContract(ADDRESSES.usdc, ERC20_ABI, wc);
        const allowance = await usdc.allowance(address, ADDRESSES.factory);
        if (allowance < totalWei) {
          toast('Approving USDC spend...', 'info');
          const approveTx = await usdc.approve(ADDRESSES.factory, totalWei);
          await approveTx.wait();
        }
        tx = await factory.createBounty(
          ipfsHash, form.title, form.category,
          form.bountyType, 1, ADDRESSES.usdc,
          totalWei, form.winnerCount, form.prizeWeights,
          deadline, form.maxSubmissions,
          { value: 0n }
        );
      }

      const receipt = await tx.wait();
      toast('Bounty created! ✓', 'success');
      window.location.hash = '#/';
    } catch (err) {
      console.error(err);
      toast('Failed: ' + (err.reason || err.message || 'Unknown error'), 'error');
    } finally {
      setSub(false);
    }
  };

  if (!address) return (
    <div className="app-content">
      <div className="container-sm" style={{ padding: '4rem 1rem', textAlign: 'center' }}>
        <p style={{ fontFamily: t.fonts.display, fontSize: '11px', color: t.colors.text.muted }}>Connect wallet to post a bounty</p>
      </div>
    </div>
  );

  return (
    <div className="app-content">
      <div className="container-sm" style={{ padding: 'clamp(1.5rem, 4vw, 3rem) clamp(1rem, 4vw, 2rem)' }}>
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
          <h1 style={{ fontFamily: t.fonts.display, fontSize: 'clamp(11px, 2.5vw, 14px)', color: t.colors.primary, marginBottom: '8px' }}>POST A BOUNTY</h1>
          <p style={{ color: t.colors.text.muted, fontSize: '12px', marginBottom: '2rem' }}>Fund tasks for the Monad ecosystem.</p>

          {/* Step indicator */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '2rem' }}>
            {STEPS.map((s, i) => (
              <div key={s} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{
                  width: '28px', height: '28px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: i < step ? t.colors.accent : i === step ? t.colors.primary : 'transparent',
                  border: '1px solid ' + (i <= step ? t.colors.primary : t.colors.border.default),
                  fontFamily: t.fonts.display, fontSize: '8px',
                  color: i < step ? '#0a0a0f' : i === step ? '#0a0a0f' : t.colors.text.muted,
                }}>
                  {i < step ? '✓' : String(i + 1)}
                </div>
                <span style={{ fontFamily: t.fonts.display, fontSize: '8px', color: i === step ? t.colors.primary : t.colors.text.muted }}>{s}</span>
                {i < 2 && <div style={{ width: '24px', height: '1px', background: t.colors.border.default }} />}
              </div>
            ))}
          </div>

          {/* Step 1: Basics */}
          {step === 0 && (
            <Card>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <Input label="Title *" placeholder="e.g. Build a landing page for NadWork" value={form.title} onChange={e => set('title', e.target.value)} maxLength={100} />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ fontSize: '11px', color: t.colors.text.secondary, display: 'block', marginBottom: '6px' }}>Category</label>
                    <select value={form.category} onChange={e => set('category', e.target.value)} style={{ width: '100%', background: t.colors.bg.darkest, border: '1px solid ' + t.colors.border.default, borderRadius: t.radius.md, padding: '10px 14px', color: t.colors.text.primary, fontFamily: t.fonts.body, fontSize: '13px' }}>
                      {CATEGORIES.map(c => <option key={c} value={c}>{categoryLabel(c)}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: '11px', color: t.colors.text.secondary, display: 'block', marginBottom: '6px' }}>Type</label>
                    <select value={form.bountyType} onChange={e => set('bountyType', Number(e.target.value))} style={{ width: '100%', background: t.colors.bg.darkest, border: '1px solid ' + t.colors.border.default, borderRadius: t.radius.md, padding: '10px 14px', color: t.colors.text.primary, fontFamily: t.fonts.body, fontSize: '13px' }}>
                      <option value={0}>Open (project picks winner)</option>
                      <option value={1}>First-Come (auto-award)</option>
                    </select>
                  </div>
                </div>
                <Input label="Description *" textarea rows={5} placeholder="Describe the task in detail. What needs to be built? What are the success criteria?" value={form.description} onChange={e => set('description', e.target.value)} />
                <div>
                  <label style={{ fontSize: '11px', color: t.colors.text.secondary, display: 'block', marginBottom: '6px' }}>Requirements</label>
                  {form.requirements.map((r, i) => (
                    <div key={i} style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                      <input value={r} onChange={e => setReq(i, e.target.value)} placeholder={"Requirement " + (i+1)} style={{ flex: 1, background: t.colors.bg.darkest, border: '1px solid ' + t.colors.border.default, borderRadius: t.radius.md, padding: '8px 12px', color: t.colors.text.primary, fontFamily: t.fonts.body, fontSize: '13px' }} />
                      {i > 0 && <Button size="sm" variant="danger" onClick={() => removeReq(i)}>×</Button>}
                    </div>
                  ))}
                  <Button size="sm" variant="ghost" onClick={addReq}>+ Add Requirement</Button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <Input label="Deadline *" type="date" value={form.deadlineDate} onChange={e => set('deadlineDate', e.target.value)} />
                  <Input label="Max Submissions (0 = unlimited)" type="number" min="0" value={form.maxSubmissions} onChange={e => set('maxSubmissions', Number(e.target.value))} />
                </div>
                <Button fullWidth onClick={() => setStep(1)} disabled={!form.title || !form.description || !form.deadlineDate}>NEXT →</Button>
              </div>
            </Card>
          )}

          {/* Step 2: Reward */}
          {step === 1 && (
            <Card>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <label style={{ fontSize: '11px', color: t.colors.text.secondary, display: 'block', marginBottom: '8px' }}>Token</label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    {[{ v: 0, l: 'MON (Native)', d: 'Monad native token' }, { v: 1, l: 'USDC', d: 'USD stablecoin' }].map(opt => (
                      <button key={opt.v} onClick={() => set('rewardType', opt.v)} style={{ padding: '16px', background: form.rewardType === opt.v ? t.colors.bg.surface : 'transparent', border: '1px solid ' + (form.rewardType === opt.v ? t.colors.border.active : t.colors.border.default), borderRadius: t.radius.md, cursor: 'pointer', textAlign: 'left' }}>
                        <div style={{ fontFamily: t.fonts.display, fontSize: '9px', color: t.colors.primary, marginBottom: '4px' }}>{opt.l}</div>
                        <div style={{ fontSize: '11px', color: t.colors.text.muted }}>{opt.d}</div>
                      </button>
                    ))}
                  </div>
                </div>
                <Input label="Total Reward Amount *" type="number" step="0.01" min="0" placeholder={form.rewardType === 0 ? "e.g. 100" : "e.g. 500"} value={form.rewardAmount} onChange={e => set('rewardAmount', e.target.value)} />
                <div>
                  <label style={{ fontSize: '11px', color: t.colors.text.secondary, display: 'block', marginBottom: '8px' }}>Number of Winners: {form.winnerCount}</label>
                  <input type="range" min={1} max={5} value={form.winnerCount} onChange={e => setWinnerCount(Number(e.target.value))} style={{ width: '100%', accentColor: t.colors.primary }} />
                </div>
                {form.winnerCount > 1 && (
                  <div>
                    <label style={{ fontSize: '11px', color: t.colors.text.secondary, display: 'block', marginBottom: '8px' }}>Prize Split (must sum to 100) — Current: {weightSum}</label>
                    {form.prizeWeights.map((w, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                        <span style={{ fontSize: '11px', color: t.colors.text.muted, width: '60px' }}>#{i+1} Place</span>
                        <input type="number" min={0} max={100} value={w} onChange={e => updateWeight(i, e.target.value)} style={{ width: '80px', background: t.colors.bg.darkest, border: '1px solid ' + t.colors.border.default, borderRadius: t.radius.sm, padding: '6px 10px', color: t.colors.text.primary, fontFamily: t.fonts.body, fontSize: '13px' }} />
                        <span style={{ fontSize: '11px', color: t.colors.primary }}>%</span>
                      </div>
                    ))}
                  </div>
                )}
                {form.rewardAmount > 0 && (
                  <div style={{ padding: '12px', background: t.colors.bg.surface, borderRadius: t.radius.md, fontSize: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span style={{ color: t.colors.text.muted }}>You deposit:</span>
                      <span style={{ color: t.colors.text.secondary }}>{form.rewardAmount} {form.rewardType === 0 ? 'MON' : 'USDC'}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span style={{ color: t.colors.text.muted }}>Platform fee (3%):</span>
                      <span style={{ color: t.colors.warning }}>{(parseFloat(form.rewardAmount) * 0.03).toFixed(4)} {form.rewardType === 0 ? 'MON' : 'USDC'}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: t.colors.text.muted }}>Hunters receive:</span>
                      <span style={{ color: t.colors.accent }}>{(parseFloat(form.rewardAmount) * 0.97).toFixed(4)} {form.rewardType === 0 ? 'MON' : 'USDC'}</span>
                    </div>
                  </div>
                )}
                <div style={{ display: 'flex', gap: '12px' }}>
                  <Button variant="ghost" onClick={() => setStep(0)}>← Back</Button>
                  <Button fullWidth onClick={() => setStep(2)} disabled={!form.rewardAmount || weightSum !== 100}>REVIEW →</Button>
                </div>
              </div>
            </Card>
          )}

          {/* Step 3: Review */}
          {step === 2 && (
            <Card>
              <h3 style={{ fontFamily: t.fonts.display, fontSize: '10px', color: t.colors.primary, marginBottom: '20px' }}>REVIEW & PUBLISH</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
                {[
                  ['Title',    form.title],
                  ['Category', form.category],
                  ['Type',     form.bountyType === 0 ? 'Open Bounty' : 'First-Come'],
                  ['Deadline', form.deadlineDate],
                  ['Reward',   form.rewardAmount + ' ' + (form.rewardType === 0 ? 'MON' : 'USDC')],
                  ['Winners',  form.winnerCount + ' — Split: ' + form.prizeWeights.join('/') + '%'],
                ].map(([k, v]) => (
                  <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', borderBottom: '1px solid ' + t.colors.border.default, paddingBottom: '8px' }}>
                    <span style={{ color: t.colors.text.muted }}>{k}</span>
                    <span style={{ color: t.colors.text.primary }}>{v}</span>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: '12px' }}>
                <Button variant="ghost" onClick={() => setStep(1)}>← Back</Button>
                <Button fullWidth loading={submitting} onClick={handlePublish}>
                  CREATE & FUND BOUNTY
                </Button>
              </div>
            </Card>
          )}
        </motion.div>
      </div>
    </div>
  );
}
`);

write("pages/ProfilePage.jsx", `
import React, { useState } from 'react';
import { useAccount } from 'wagmi';
import { motion } from 'framer-motion';
import { theme as t } from '@/styles/theme.js';
import { useProfile } from '@/hooks/useProfile.js';
import Card from '@/components/common/Card.jsx';
import Badge from '@/components/common/Badge.jsx';
import { PageLoader } from '@/components/common/Spinner.jsx';
import EmptyState from '@/components/common/EmptyState.jsx';
import { shortAddr, formatMON, formatDate } from '@/utils/format.js';
import { SUB_STATUS } from '@/config/contracts.js';

function parseAddr(hash) {
  const parts = hash.replace('#/profile/', '').replace('#/profile', '');
  return parts.length > 10 ? parts : null;
}

export default function ProfilePage() {
  const { address: selfAddr } = useAccount();
  const profileAddr = parseAddr(window.location.hash) || selfAddr;
  const isSelf = selfAddr?.toLowerCase() === profileAddr?.toLowerCase();
  const [tab, setTab] = useState('submissions');

  const { hunterStats, projectStats, score, winRate, submissions, bountyIds, loading } = useProfile(profileAddr);

  if (!profileAddr) return (
    <div className="app-content">
      <div className="container-sm" style={{ padding: '4rem', textAlign: 'center' }}>
        <p style={{ fontFamily: t.fonts.display, fontSize: '11px', color: t.colors.text.muted }}>Connect wallet to view your profile</p>
      </div>
    </div>
  );

  if (loading) return <PageLoader />;

  const wins    = hunterStats ? Number(hunterStats[1]) : 0;
  const subs    = hunterStats ? Number(hunterStats[0]) : 0;
  const earned  = hunterStats ? hunterStats[2] : 0n;
  const wr      = Number(winRate);
  const sc      = Number(score);

  return (
    <div className="app-content">
      <div className="container-sm" style={{ padding: 'clamp(1.5rem, 4vw, 3rem) clamp(1rem, 4vw, 2rem)' }}>
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>

          {/* Profile header */}
          <Card style={{ marginBottom: '24px', textAlign: 'center' }}>
            <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: t.colors.bg.surface, border: '2px solid ' + t.colors.border.hover, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontFamily: t.fonts.display, fontSize: '16px', color: t.colors.primary }}>
              {profileAddr.slice(2, 4).toUpperCase()}
            </div>
            <div style={{ fontFamily: t.fonts.body, fontSize: '13px', color: t.colors.text.secondary, marginBottom: '4px' }}>{profileAddr}</div>
            {isSelf && <Badge type="active" label="YOU" style={{ marginBottom: '16px' }} />}
            <div style={{ fontFamily: t.fonts.number, fontSize: 'clamp(28px, 6vw, 40px)', color: t.colors.primary, textShadow: t.colors.glow.gold }}>{sc.toLocaleString()}</div>
            <div style={{ fontSize: '10px', color: t.colors.text.muted, fontFamily: t.fonts.display }}>HUNTER SCORE</div>
          </Card>

          {/* Stats grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '12px', marginBottom: '24px' }}>
            {[
              { label: 'SUBMISSIONS', value: subs },
              { label: 'WINS',        value: wins },
              { label: 'WIN RATE',    value: wr + '%' },
              { label: 'EARNED',      value: formatMON(earned) },
              { label: 'BOUNTIES POSTED', value: projectStats ? String(projectStats[0]) : '0' },
            ].map(s => (
              <Card key={s.label} style={{ textAlign: 'center' }}>
                <div style={{ fontFamily: t.fonts.number, fontSize: 'clamp(16px, 4vw, 22px)', color: t.colors.primary }}>{s.value}</div>
                <div style={{ fontFamily: t.fonts.display, fontSize: '7px', color: t.colors.text.muted, marginTop: '4px', letterSpacing: '0.04em' }}>{s.label}</div>
              </Card>
            ))}
          </div>

          {/* Tabs */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
            {[['submissions', 'SUBMISSIONS (' + submissions.length + ')'], ['bounties', 'BOUNTIES (' + bountyIds.length + ')']].map(([key, label]) => (
              <button key={key} onClick={() => setTab(key)} style={{
                fontFamily: t.fonts.display, fontSize: '9px', padding: '8px 16px',
                background: tab === key ? t.colors.bg.surface : 'transparent',
                border: '1px solid ' + (tab === key ? t.colors.border.active : t.colors.border.default),
                color: tab === key ? t.colors.primary : t.colors.text.muted,
                borderRadius: t.radius.sm, cursor: 'pointer', transition: t.transition,
              }}>{label}</button>
            ))}
          </div>

          {/* Submissions tab */}
          {tab === 'submissions' && (
            submissions.length === 0
              ? <EmptyState icon="📝" title="NO SUBMISSIONS YET" message="Submit work to bounties to build your reputation." />
              : <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {submissions.map(s => (
                    <Card key={String(s.id)} hoverable onClick={() => window.location.hash = '#/bounty/' + String(s.bountyId)} style={{ cursor: 'pointer' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                        <div>
                          <span style={{ fontSize: '12px', color: t.colors.text.secondary }}>Bounty #{String(s.bountyId)}</span>
                          <Badge type={SUB_STATUS[s.status]?.toLowerCase()} label={SUB_STATUS[s.status]} style={{ marginLeft: '8px' }} />
                        </div>
                        <span style={{ fontSize: '11px', color: t.colors.text.muted }}>{formatDate(s.submittedAt)}</span>
                      </div>
                    </Card>
                  ))}
                </div>
          )}

          {/* Bounties tab */}
          {tab === 'bounties' && (
            bountyIds.length === 0
              ? <EmptyState icon="🎯" title="NO BOUNTIES POSTED" message="Post your first bounty to find talent." action="POST A BOUNTY" onAction={() => window.location.hash = '#/post'} />
              : <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {bountyIds.map(id => (
                    <Card key={String(id)} hoverable onClick={() => window.location.hash = '#/bounty/' + String(id)} style={{ cursor: 'pointer' }}>
                      <span style={{ fontSize: '12px', color: t.colors.text.secondary }}>Bounty #{String(id)}</span>
                    </Card>
                  ))}
                </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
`);

write("pages/LeaderboardPage.jsx", `
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { theme as t } from '@/styles/theme.js';
import Card from '@/components/common/Card.jsx';
import { PageLoader } from '@/components/common/Spinner.jsx';
import { shortAddr, formatMON } from '@/utils/format.js';

export default function LeaderboardPage() {
  const [tab, setTab] = useState('hunters');

  return (
    <div className="app-content">
      <div className="container-sm" style={{ padding: 'clamp(1.5rem, 4vw, 3rem) clamp(1rem, 4vw, 2rem)' }}>
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
          <h1 style={{ fontFamily: t.fonts.display, fontSize: 'clamp(11px, 2.5vw, 14px)', color: t.colors.primary, marginBottom: '8px' }}>LEADERBOARD</h1>
          <p style={{ color: t.colors.text.muted, fontSize: '12px', marginBottom: '2rem' }}>On-chain reputation. Verifiable. Permanent.</p>

          <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
            {[['hunters', 'TOP HUNTERS'], ['projects', 'TOP PROJECTS']].map(([key, label]) => (
              <button key={key} onClick={() => setTab(key)} style={{
                fontFamily: t.fonts.display, fontSize: '9px', padding: '8px 16px',
                background: tab === key ? t.colors.bg.surface : 'transparent',
                border: '1px solid ' + (tab === key ? t.colors.border.active : t.colors.border.default),
                color: tab === key ? t.colors.primary : t.colors.text.muted,
                borderRadius: t.radius.sm, cursor: 'pointer',
              }}>{label}</button>
            ))}
          </div>

          <Card>
            <div style={{ textAlign: 'center', padding: '3rem', color: t.colors.text.muted, fontSize: '12px' }}>
              <div style={{ fontSize: '2rem', marginBottom: '12px' }}>🏆</div>
              <p style={{ fontFamily: t.fonts.display, fontSize: '9px', color: t.colors.text.secondary, marginBottom: '8px' }}>LEADERBOARD LIVE AFTER LAUNCH</p>
              <p>On-chain scores accumulate as hunters win bounties.</p>
              <p style={{ marginTop: '8px' }}>Scores = wins × 30 + submissions × 5 + earned ÷ 0.001 MON</p>
            </div>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
`);

write("pages/DashboardPage.jsx", `
import React, { useState, useEffect } from 'react';
import { useAccount, useWalletClient } from 'wagmi';
import { motion } from 'framer-motion';
import { theme as t } from '@/styles/theme.js';
import Card from '@/components/common/Card.jsx';
import Badge from '@/components/common/Badge.jsx';
import Button from '@/components/common/Button.jsx';
import { PageLoader } from '@/components/common/Spinner.jsx';
import EmptyState from '@/components/common/EmptyState.jsx';
import { formatReward, formatDate, shortAddr } from '@/utils/format.js';
import { getReadContract, getContract } from '@/utils/ethers.js';
import { ADDRESSES, REGISTRY_ABI, FACTORY_ABI, BOUNTY_STATUS, SUB_STATUS } from '@/config/contracts.js';
import { fetchJSON } from '@/config/pinata.js';
import { toast } from '@/components/common/Toast.jsx';

export default function DashboardPage() {
  const { address } = useAccount();
  const { data: wc } = useWalletClient();
  const [bounties, setBounties] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [selected, setSelected] = useState({});
  const [approving, setApproving] = useState(null);

  useEffect(() => {
    if (!address || !ADDRESSES.registry) { setLoading(false); return; }
    async function load() {
      try {
        const reg = getReadContract(ADDRESSES.registry, REGISTRY_ABI);
        const ids = await reg.getPosterBounties(address);
        const data = await Promise.all(ids.map(async id => {
          const [bounty, subs] = await Promise.all([reg.getBounty(id), reg.getBountySubmissions(id)]);
          const meta = bounty.ipfsHash ? await fetchJSON(bounty.ipfsHash) : null;
          return { ...bounty, subs: [...subs], meta };
        }));
        setBounties(data.reverse());
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [address]);

  const handleApprove = async (bountyId, winnerCount) => {
    const sel = selected[bountyId] || [];
    if (sel.length !== winnerCount) { toast('Select exactly ' + winnerCount + ' winner(s)', 'warning'); return; }
    try {
      setApproving(bountyId);
      const factory = await getContract(ADDRESSES.factory, FACTORY_ABI, wc);
      const ranks   = sel.map((_, i) => i + 1);
      const tx      = await factory.approveWinners(bountyId, sel, ranks);
      await tx.wait();
      toast('Winners approved! Funds released. ✓', 'success');
    } catch (err) {
      toast('Failed: ' + (err.reason || err.message), 'error');
    } finally {
      setApproving(null);
    }
  };

  if (!address) return (
    <div className="app-content">
      <div className="container" style={{ padding: '4rem', textAlign: 'center' }}>
        <p style={{ fontFamily: t.fonts.display, fontSize: '11px', color: t.colors.text.muted }}>Connect wallet to access dashboard</p>
      </div>
    </div>
  );

  if (loading) return <PageLoader />;

  return (
    <div className="app-content">
      <div className="container" style={{ padding: 'clamp(1.5rem, 4vw, 3rem) clamp(1rem, 4vw, 2rem)' }}>
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
          <h1 style={{ fontFamily: t.fonts.display, fontSize: 'clamp(11px, 2.5vw, 14px)', color: t.colors.primary, marginBottom: '2rem' }}>MY DASHBOARD</h1>

          {bounties.length === 0
            ? <EmptyState icon="🎯" title="NO BOUNTIES POSTED" message="Post your first bounty to find talent." action="POST A BOUNTY" onAction={() => window.location.hash = '#/post'} />
            : <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {bounties.map(b => {
                  const statusKey = BOUNTY_STATUS[b.status]?.toLowerCase() || 'active';
                  const pendingSubs = b.subs.filter(s => s.status === 0);
                  return (
                    <Card key={String(b.id)}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px', marginBottom: '16px' }}>
                        <div>
                          <h3 style={{ fontFamily: t.fonts.display, fontSize: '10px', color: t.colors.primary, marginBottom: '8px' }}>
                            {b.meta?.title || b.title || 'Bounty #' + String(b.id)}
                          </h3>
                          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                            <Badge type={statusKey} label={statusKey.toUpperCase()} />
                            <span style={{ fontSize: '12px', color: t.colors.text.muted }}>{formatReward(b.totalReward, b.rewardType)}</span>
                          </div>
                        </div>
                        <div style={{ textAlign: 'right', fontSize: '12px', color: t.colors.text.muted }}>
                          <div>{String(b.submissionCount)} total subs</div>
                          <div>{pendingSubs.length} pending review</div>
                        </div>
                      </div>

                      {b.subs.length > 0 && b.status === 0 && (
                        <div>
                          <div style={{ fontSize: '10px', color: t.colors.text.muted, fontFamily: t.fonts.display, marginBottom: '12px' }}>SUBMISSIONS</div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {b.subs.map(s => (
                              <div key={String(s.id)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: t.colors.bg.surface, borderRadius: t.radius.md, border: '1px solid ' + ((selected[String(b.id)] || []).includes(String(s.id)) ? t.colors.border.active : t.colors.border.default), flexWrap: 'wrap', gap: '8px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <span style={{ fontSize: '12px', color: t.colors.text.secondary }}>{shortAddr(s.hunter)}</span>
                                  <Badge type={SUB_STATUS[s.status]?.toLowerCase()} label={SUB_STATUS[s.status]} />
                                </div>
                                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                  {s.ipfsHash && <a href={'https://ipfs.io/ipfs/' + s.ipfsHash} target="_blank" rel="noopener" style={{ color: t.colors.primary, fontSize: '11px' }}>View →</a>}
                                  {s.status === 0 && (
                                    <Button size="sm" variant="secondary"
                                      onClick={() => setSelected(p => {
                                        const prev = p[String(b.id)] || [];
                                        return { ...p, [String(b.id)]: prev.includes(String(s.id)) ? prev.filter(x => x !== String(s.id)) : [...prev, String(s.id)] };
                                      })}>
                                      {(selected[String(b.id)] || []).includes(String(s.id)) ? '✓ Selected' : 'Select Winner'}
                                    </Button>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                          {(selected[String(b.id)] || []).length > 0 && (
                            <Button style={{ marginTop: '12px', width: '100%' }} loading={approving === String(b.id)} onClick={() => handleApprove(String(b.id), Number(b.winnerCount))}>
                              RELEASE FUNDS TO {(selected[String(b.id)] || []).length} WINNER{(selected[String(b.id)] || []).length > 1 ? 'S' : ''}
                            </Button>
                          )}
                        </div>
                      )}
                    </Card>
                  );
                })}
              </div>
          }
        </motion.div>
      </div>
    </div>
  );
}
`);

// ═══════════════════════════════════════════════════════════
// APP ENTRY POINTS
// ═══════════════════════════════════════════════════════════

write("main.jsx", `
import React from 'react';
import ReactDOM from 'react-dom/client';
import '@rainbow-me/rainbowkit/styles.css';
import './styles/index.css';
import { WagmiProvider } from 'wagmi';
import { RainbowKitProvider, darkTheme } from '@rainbow-me/rainbowkit';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { wagmiConfig } from './config/wagmi.js';
import App from './App.jsx';

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: 2, staleTime: 10000 } } });

const rkTheme = darkTheme({
  accentColor:         '#f59e0b',
  accentColorForeground: '#0a0a0f',
  borderRadius:        'medium',
  fontStack:           'system',
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider theme={rkTheme} locale="en-US">
          <App />
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  </React.StrictMode>
);
`);

write("App.jsx", `
import React, { useState, useEffect, Suspense, lazy } from 'react';
import { theme as t } from './styles/theme.js';
import AppHeader from './components/layout/AppHeader.jsx';
import AppFooter from './components/layout/AppFooter.jsx';
import { ToastContainer } from './components/common/Toast.jsx';
import { PageLoader } from './components/common/Spinner.jsx';

const HomePage         = lazy(() => import('./pages/HomePage.jsx'));
const BountyDetailPage = lazy(() => import('./pages/BountyDetailPage.jsx'));
const PostBountyPage   = lazy(() => import('./pages/PostBountyPage.jsx'));
const ProfilePage      = lazy(() => import('./pages/ProfilePage.jsx'));
const DashboardPage    = lazy(() => import('./pages/DashboardPage.jsx'));
const LeaderboardPage  = lazy(() => import('./pages/LeaderboardPage.jsx'));

function useHashRoute() {
  const [hash, setHash] = useState(window.location.hash || '#/');
  useEffect(() => {
    const handler = () => setHash(window.location.hash || '#/');
    window.addEventListener('hashchange', handler);
    return () => window.removeEventListener('hashchange', handler);
  }, []);
  return hash;
}

function Router({ hash }) {
  if (hash.startsWith('#/bounty/')) {
    const id = hash.replace('#/bounty/', '');
    return <BountyDetailPage bountyId={id} />;
  }
  if (hash.startsWith('#/profile')) return <ProfilePage />;
  if (hash === '#/post')       return <PostBountyPage />;
  if (hash === '#/dashboard')  return <DashboardPage />;
  if (hash === '#/leaderboard')return <LeaderboardPage />;
  return <HomePage />;
}

export default function App() {
  const hash = useHashRoute();

  return (
    <div className="app" style={{ background: t.colors.bg.darkest, minHeight: '100vh' }}>
      <AppHeader />
      <main className="app-content" style={{ minHeight: 'calc(100vh - 72px - 80px)' }}>
        <Suspense fallback={<PageLoader />}>
          <Router hash={hash} />
        </Suspense>
      </main>
      <AppFooter />
      <ToastContainer />
    </div>
  );
}
`);

console.log("\n✓ All frontend source files written.");
