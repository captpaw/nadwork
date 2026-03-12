const SUBGRAPH_URL = (import.meta.env.VITE_GOLDSKY_SUBGRAPH_URL || '').trim();
const SUBGRAPH_FALLBACK_URLS = String(import.meta.env.VITE_GOLDSKY_SUBGRAPH_FALLBACK_URLS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

/** In dev, try Vite proxy first to bypass CORS. Disable with VITE_USE_SUBGRAPH_PROXY=0 */
const USE_PROXY = import.meta.env.DEV && (import.meta.env.VITE_USE_SUBGRAPH_PROXY !== '0');
const SUBGRAPH_FAILURE_THRESHOLD = 4;
const SUBGRAPH_CACHE_TTL_MS = 6000;
const SUBGRAPH_REQUEST_TIMEOUT_MS = 8000;
const SUBGRAPH_RETRY_DELAYS_MS = [700, 1500, 2500];
const SUBGRAPH_RATE_LIMIT_BACKOFF_MS = 120_000;
const SUBGRAPH_TRANSIENT_BACKOFF_MS = 20_000;
const SUBGRAPH_OTHER_BACKOFF_MS = 8_000;
const ACTIVE_SUBGRAPH_TTL_MS = 45_000;
const MAX_FAILURE_SCORE = 8;

let indexerFailures = 0;

const _queryCache = new Map();
const _inflight = new Map();
const _endpointState = new Map();
let _activeSubgraphUrl = '';
let _activeSubgraphUntil = 0;

function dedupeUrls(items) {
  const seen = new Set();
  const out = [];
  for (const item of items) {
    const value = String(item || '').trim();
    if (!value || seen.has(value)) continue;
    seen.add(value);
    out.push(value);
  }
  return out;
}

function markIndexerHealthy() {
  indexerFailures = 0;
}

function markIndexerFailure(reason) {
  indexerFailures += 1;
  if (indexerFailures < SUBGRAPH_FAILURE_THRESHOLD) return;

  indexerFailures = 0;
  if (import.meta.env.DEV) {
    console.warn('[useIndexer] repeated failures:', reason);
  }
}

function _getEndpointState(url) {
  const key = String(url || '');
  let row = _endpointState.get(key);
  if (!row) {
    row = {
      cooldownUntil: 0,
      failureScore: 0,
      lastSuccessTs: 0,
      lastErrorTs: 0,
      lastErrorType: '',
      lastLatencyMs: 0,
    };
    _endpointState.set(key, row);
  }
  return row;
}

function classifySubgraphError(err) {
  const msg = String(err?.shortMessage || err?.reason || err?.message || '').toLowerCase();
  if (err?.status === 429 || msg.includes('429') || msg.includes('too many requests')) return 'rate_limit';
  if (
    msg.includes('timeout') ||
    msg.includes('aborted') ||
    msg.includes('network') ||
    msg.includes('failed to fetch') ||
    msg.includes('503') ||
    msg.includes('504') ||
    msg.includes('502')
  ) {
    return 'transient';
  }
  return 'other';
}

function isEndpointCooling(url) {
  const row = _endpointState.get(String(url || ''));
  if (!row) return false;
  return row.cooldownUntil > Date.now();
}

function setActiveSubgraph(url) {
  _activeSubgraphUrl = String(url || '');
  _activeSubgraphUntil = Date.now() + ACTIVE_SUBGRAPH_TTL_MS;
}

function markEndpointSuccess(url, latencyMs = 0) {
  const row = _getEndpointState(url);
  row.failureScore = 0;
  row.cooldownUntil = 0;
  row.lastSuccessTs = Date.now();
  row.lastErrorType = '';
  row.lastLatencyMs = Number.isFinite(latencyMs) ? Number(latencyMs) : 0;
  setActiveSubgraph(url);
}

function markEndpointFailure(url, err) {
  const row = _getEndpointState(url);
  row.lastErrorTs = Date.now();
  row.lastErrorType = classifySubgraphError(err);
  row.failureScore = Math.min(MAX_FAILURE_SCORE, row.failureScore + 1);

  if (row.lastErrorType === 'rate_limit') {
    row.cooldownUntil = Date.now() + SUBGRAPH_RATE_LIMIT_BACKOFF_MS;
    return;
  }
  if (row.lastErrorType === 'transient') {
    row.cooldownUntil = Date.now() + SUBGRAPH_TRANSIENT_BACKOFF_MS;
    return;
  }
  row.cooldownUntil = Date.now() + SUBGRAPH_OTHER_BACKOFF_MS;
}

function getRawSubgraphCandidates() {
  const configured = dedupeUrls([SUBGRAPH_URL, ...SUBGRAPH_FALLBACK_URLS]);
  if (configured.length === 0) return [];

  // In browser dev with proxy enabled, force proxy-only to avoid direct CORS failures.
  if (USE_PROXY && typeof window !== 'undefined') {
    return [`${window.location.origin}/subgraph-proxy`];
  }

  return configured;
}

function getSubgraphCandidates() {
  const now = Date.now();
  const activeValid =
    _activeSubgraphUrl &&
    _activeSubgraphUntil > now &&
    !isEndpointCooling(_activeSubgraphUrl);

  const raw = getRawSubgraphCandidates();
  const available = raw.filter((u) => !isEndpointCooling(u));
  const cooling = raw.filter((u) => isEndpointCooling(u));

  available.sort((a, b) => {
    if (activeValid && a === _activeSubgraphUrl) return -1;
    if (activeValid && b === _activeSubgraphUrl) return 1;

    const sa = _getEndpointState(a);
    const sb = _getEndpointState(b);
    if (sa.failureScore !== sb.failureScore) return sa.failureScore - sb.failureScore;
    if (sa.lastSuccessTs !== sb.lastSuccessTs) return sb.lastSuccessTs - sa.lastSuccessTs;
    return 0;
  });

  return available.length > 0 ? available : cooling;
}

function getQueryKey(query, variables) {
  return JSON.stringify({ query, variables: variables || {} });
}

function getCachedQuery(key) {
  const row = _queryCache.get(key);
  if (!row) return null;
  if (Date.now() - row.ts > SUBGRAPH_CACHE_TTL_MS) {
    _queryCache.delete(key);
    return null;
  }
  return row.data;
}

function setCachedQuery(key, data) {
  _queryCache.set(key, { ts: Date.now(), data });
}

/** Clear subgraph query cache. Call after posting a bounty so list shows new item. */
export function clearSubgraphCache() {
  _queryCache.clear();
}

/** True when at least one Goldsky subgraph endpoint is configured. */
export const isIndexerConfigured = () => getRawSubgraphCandidates().length > 0;

/** Alias kept for existing callers. */
export const hasIndexer = () => isIndexerConfigured();

async function fetchSubgraphWithRetry(url, payload) {
  let lastErr = null;

  for (let attempt = 0; attempt <= SUBGRAPH_RETRY_DELAYS_MS.length; attempt += 1) {
    try {
      const startedAt = Date.now();
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(SUBGRAPH_REQUEST_TIMEOUT_MS),
      });

      if (res.status === 429) {
        throw new Error('Subgraph HTTP 429');
      }
      if (!res.ok) throw new Error(`Subgraph HTTP ${res.status}`);

      const { data, errors } = await res.json();
      if (errors?.length) throw new Error(errors[0].message);

      return { data, latencyMs: Date.now() - startedAt };
    } catch (err) {
      lastErr = err;
      const type = classifySubgraphError(err);
      const canRetry = type !== 'other' && attempt < SUBGRAPH_RETRY_DELAYS_MS.length;
      if (canRetry) {
        await new Promise((r) => setTimeout(r, SUBGRAPH_RETRY_DELAYS_MS[attempt]));
        continue;
      }
      break;
    }
  }

  throw lastErr || new Error('Failed to fetch subgraph');
}

/**
 * Execute a GraphQL query against the Goldsky subgraph.
 * Returns `null` on any error so callers can keep current UI state.
 */
export async function querySubgraph(query, variables = {}) {
  if (!hasIndexer()) return null;

  const key = getQueryKey(query, variables);
  const cached = getCachedQuery(key);
  if (cached) return cached;

  const inflight = _inflight.get(key);
  if (inflight) return inflight;

  const run = (async () => {
    const candidates = getSubgraphCandidates();
    if (candidates.length === 0) return null;

    let lastErr = null;
    for (const url of candidates) {
      try {
        const { data, latencyMs } = await fetchSubgraphWithRetry(url, { query, variables });
        markIndexerHealthy();
        markEndpointSuccess(url, latencyMs);
        setCachedQuery(key, data);
        return data;
      } catch (err) {
        lastErr = err;
        markEndpointFailure(url, err);
        if (import.meta.env.DEV) {
          const message = err?.message || 'unknown error';
          console.warn(`[useIndexer] ${url} failed: ${message}`);
        }
      }
    }

    markIndexerFailure(lastErr?.message || 'Failed to fetch subgraph');
    return null;
  })();

  _inflight.set(key, run);
  try {
    return await run;
  } finally {
    _inflight.delete(key);
  }
}

export function getIndexerHealthSnapshot() {
  return getSubgraphCandidates().map((url) => {
    const row = _getEndpointState(url);
    return {
      url,
      active: _activeSubgraphUrl === url && _activeSubgraphUntil > Date.now(),
      cooling: row.cooldownUntil > Date.now(),
      cooldownUntil: row.cooldownUntil,
      failureScore: row.failureScore,
      lastSuccessTs: row.lastSuccessTs,
      lastErrorTs: row.lastErrorTs,
      lastErrorType: row.lastErrorType,
      lastLatencyMs: row.lastLatencyMs,
    };
  });
}
// -- Prepared queries ---------------------------------------------------------

export const GQL_GET_BOUNTIES = `
  query GetBounties($skip: Int, $first: Int) {
    bounties(
      orderBy: createdAt orderDirection: desc
      skip: $skip first: $first
    ) {
      id title creator totalReward status category
      featured metaCid deadline submissionCount winnerCount
      requiresApplication createdAt
    }
  }
`;

export const GQL_GET_BOUNTY_BY_ID = `
  query GetBountyById($id: String!) {
    bounties(where: { id: $id }, first: 1) {
      id title creator totalReward status category
      featured metaCid deadline submissionCount winnerCount
      requiresApplication createdAt
    }
  }
`;

export const GQL_GET_BOUNTIES_BY_CAT = `
  query GetBountiesByCat($category: String!, $skip: Int, $first: Int) {
    bounties(
      where: { category: $category }
      orderBy: createdAt orderDirection: desc
      skip: $skip first: $first
    ) {
      id title creator totalReward status category
      featured metaCid deadline submissionCount winnerCount
      requiresApplication createdAt
    }
  }
`;

export const GQL_GET_ACTIVE_BOUNTIES = `
  query GetActiveBounties($skip: Int, $first: Int) {
    bounties(
      where: { status: 0 }
      orderBy: createdAt orderDirection: desc
      skip: $skip first: $first
    ) {
      id title creator totalReward status category
      featured metaCid deadline submissionCount winnerCount
      requiresApplication createdAt
    }
  }
`;

export const GQL_GET_LEADERBOARD = `
  query GetLeaderboard($first: Int) {
    builderStats_collection(orderBy: totalEarned orderDirection: desc first: $first) {
      id address winCount totalEarned submissionCount lastActivity
    }
  }
`;

export const GQL_GET_PORTFOLIO = `
  query GetPortfolio($builder: String!) {
    submissions(
      where: { builder: $builder, status: 1 }
      orderBy: submittedAt orderDirection: desc
    ) {
      id metaCid submittedAt
      bounty { id title totalReward category }
    }
  }
`;

export const GQL_GET_CREATOR_BOUNTIES = `
  query GetCreatorBounties($creator: String!) {
    bounties(
      where: { creator: $creator }
      orderBy: createdAt orderDirection: desc
    ) {
      id title status totalReward deadline submissionCount featured
    }
  }
`;

export const GQL_GET_PLATFORM_STATS = `
  query GetPlatformStats {
    platformStats(id: "global") {
      totalBounties activeBounties completedBounties
      totalRewardDistributed totalBuilders totalCreators
      totalSubmissions lastUpdated
    }
  }
`;

export const GQL_GET_PENDING_PAYMENTS = `
  query GetPendingPayments($address: String!) {
    pendingPayments(where: { recipient: $address }) {
      id paymentType amount bountyId updatedAt
    }
  }
`;
