function isTupleLikeObject(value) {
  return value != null && (typeof value === 'object' || typeof value === 'function');
}

export function readBountyField(bounty, key, index) {
  if (!isTupleLikeObject(bounty)) return undefined;

  try {
    const byKey = bounty[key];
    if (byKey !== undefined) return byKey;
  } catch {
    // ignore tuple accessor errors and continue
  }

  if (typeof index === 'number') {
    try {
      const byIndex = bounty[index];
      if (byIndex !== undefined) return byIndex;
    } catch {
      // ignore tuple accessor errors
    }
  }

  return undefined;
}

export function getBountyId(bounty) {
  return readBountyField(bounty, 'id', 0) ?? readBountyField(bounty, 'bountyId', 1);
}

function formatMonFromRaw(raw) {
  try {
    if (raw == null) return '0';
    const wei = BigInt(raw);
    const whole = Number(wei) / 1e18;
    return Number.isFinite(whole) ? whole.toFixed(2).replace(/\.?0+$/, '') : '0';
  } catch {
    return '0';
  }
}

function normalizeForUi(bounty) {
  const idRaw = getBountyId(bounty);
  const id = idRaw != null ? String(idRaw) : '';

  return {
    id,
    title: String(readBountyField(bounty, 'title', 3) || 'Untitled'),
    category: String(readBountyField(bounty, 'category', 4) || 'other'),
    status: Number(readBountyField(bounty, 'status', 6) ?? 0),
    totalReward: String(readBountyField(bounty, 'totalReward', 9) ?? '0'),
    reward: formatMonFromRaw(readBountyField(bounty, 'totalReward', 9)),
    deadline: String(readBountyField(bounty, 'deadline', 12) ?? '0'),
    submissionCount: Number(readBountyField(bounty, 'submissionCount', 16) ?? 0),
    featured: Boolean(readBountyField(bounty, 'featured', 15)),
    creator: String(readBountyField(bounty, 'creator', 1) || ''),
    requiresApplication: Boolean(readBountyField(bounty, 'requiresApplication', 19)),
    _source: readBountyField(bounty, '_source') || 'rpc',
  };
}

export function isOrbitalDebugEnabled() {
  const isDev = Boolean(import.meta?.env?.DEV);
  if (!isDev || typeof window === 'undefined') return false;

  try {
    return window.localStorage?.getItem('nadwork:debug:orbital') === '1';
  } catch {
    return false;
  }
}

export function orbitalDebugLog(label, payload) {
  if (!isOrbitalDebugEnabled()) return;
  const safe = JSON.parse(JSON.stringify(payload, (_, v) => (typeof v === 'bigint' ? v.toString() : v)));
  console.info(`[orbital] ${label}`, safe);
}

export function selectOrbitalBounties(source, maxItems = 6) {
  if (!Array.isArray(source) || source.length === 0) return [];

  const normalized = source.map((b) => {
    let total = 0n;
    try {
      const totalRewardRaw = readBountyField(b, 'totalReward', 9);
      if (totalRewardRaw != null) total = BigInt(totalRewardRaw);
    } catch {
      total = 0n;
    }

    const statusRaw = readBountyField(b, 'status', 6);
    const statusNum = statusRaw != null ? Number(statusRaw) : 0;
    return { _raw: b, _totalRewardSort: total, _statusNum: statusNum };
  });

  const active = normalized.filter((b) => b._statusNum === 0);
  const inactive = normalized.filter((b) => b._statusNum !== 0);

  const sortByRewardDesc = (arr) =>
    [...arr].sort((a, b) =>
      b._totalRewardSort > a._totalRewardSort ? 1 : b._totalRewardSort < a._totalRewardSort ? -1 : 0
    );

  const orderByPriority = (arr) => {
    const featured = arr.filter((b) => Boolean(readBountyField(b._raw, 'featured', 15)));
    const regular = arr.filter((b) => !Boolean(readBountyField(b._raw, 'featured', 15)));
    return [...sortByRewardDesc(featured), ...sortByRewardDesc(regular)];
  };

  const ordered = [...orderByPriority(active), ...orderByPriority(inactive)];

  const seen = new Set();
  const picked = [];
  for (const b of ordered) {
    const rawId = getBountyId(b._raw);
    const key = rawId != null ? String(rawId) : '';
    if (!key || seen.has(key)) continue;
    seen.add(key);
    picked.push(normalizeForUi(b._raw));
    if (picked.length >= maxItems) break;
  }

  return picked;
}
