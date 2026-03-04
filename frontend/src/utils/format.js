import { ethers } from 'ethers';
import { BOUNTY_STATUS, BOUNTY_TYPES, SUB_STATUS, CATEGORY_LABELS } from '@/config/contracts.js';

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

export function formatUSDC(amount) {
  try {
    const n = parseFloat(ethers.formatUnits(amount, 6));
    if (n >= 1000) return '$' + n.toLocaleString('en', { maximumFractionDigits: 0 });
    return '$' + n.toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  } catch { return '$0.00'; }
}

export function formatReward(totalReward, rewardType, rewardToken) {
  if (Number(rewardType) === 0) return formatMON(totalReward);
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

// Normalize on-chain uint8/BigInt bounty status → lowercase string for Badge component
const _BOUNTY_STR = { 0: 'active', 1: 'reviewing', 2: 'completed', 3: 'expired', 4: 'cancelled', 5: 'disputed' };
export function normalizeBountyStatus(s) {
  if (s == null) return 'unknown';
  return _BOUNTY_STR[Number(s)] || String(s).toLowerCase();
}

// Normalize on-chain uint8/BigInt submission status → lowercase string for Badge component
const _SUB_STR = { 0: 'pending', 1: 'approved', 2: 'rejected' };
export function normalizeSubStatus(s) {
  if (s == null) return 'pending';
  return _SUB_STR[Number(s)] || String(s).toLowerCase();
}

export function explorerUrl(hash, type = 'tx') {
  return 'https://testnet.monadexplorer.com/' + type + '/' + hash;
}

export function categoryLabel(cat) {
  return CATEGORY_LABELS[cat] || (cat ? cat.charAt(0).toUpperCase() + cat.slice(1) : '');
}
