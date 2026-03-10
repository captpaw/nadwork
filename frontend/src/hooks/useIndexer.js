const SUBGRAPH_URL = (import.meta.env.VITE_GOLDSKY_SUBGRAPH_URL || '').trim();

/** In dev, try Vite proxy first to bypass CORS. Disable with VITE_USE_SUBGRAPH_PROXY=0 */
const USE_PROXY = import.meta.env.DEV && (import.meta.env.VITE_USE_SUBGRAPH_PROXY !== '0');
const SUBGRAPH_FAILURE_THRESHOLD = 4;
const SUBGRAPH_CACHE_TTL_MS = 6000;
const SUBGRAPH_BACKOFF_MS = 2500;

let indexerFailures = 0;

const _queryCache = new Map();
const _inflight = new Map();
const _urlBackoffUntil = new Map();

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

function getSubgraphCandidates() {
  if (!SUBGRAPH_URL) return [];

  // In browser dev with proxy enabled, force proxy-only to avoid direct CORS failures.
  if (USE_PROXY && typeof window !== 'undefined') {
    return [`${window.location.origin}/subgraph-proxy`];
  }

  return [SUBGRAPH_URL];
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

function isUrlInBackoff(url) {
  return (_urlBackoffUntil.get(url) || 0) > Date.now();
}

function markUrlBackoff(url) {
  _urlBackoffUntil.set(url, Date.now() + SUBGRAPH_BACKOFF_MS);
}

/** True when a Goldsky subgraph URL is configured. */
export const isIndexerConfigured = () => Boolean(SUBGRAPH_URL);

/** Alias kept for existing callers. */
export const hasIndexer = () => isIndexerConfigured();

async function fetchSubgraphWithRetry(url, payload) {
  const retryDelays = [700, 1500, 2500];
  let lastErr = null;

  for (let attempt = 0; attempt <= retryDelays.length; attempt += 1) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(8000),
      });

      if (res.status === 429) {
        markUrlBackoff(url);
        throw new Error('Subgraph HTTP 429');
      }
      if (!res.ok) throw new Error(`Subgraph HTTP ${res.status}`);

      const { data, errors } = await res.json();
      if (errors?.length) throw new Error(errors[0].message);

      return data;
    } catch (err) {
      lastErr = err;
      if (attempt < retryDelays.length) {
        await new Promise((r) => setTimeout(r, retryDelays[attempt]));
      }
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
    const candidates = getSubgraphCandidates().filter((u) => !isUrlInBackoff(u));
    if (candidates.length === 0) return null;

    let lastErr = null;
    for (const url of candidates) {
      try {
        const data = await fetchSubgraphWithRetry(url, { query, variables });
        markIndexerHealthy();
        setCachedQuery(key, data);
        return data;
      } catch (err) {
        lastErr = err;
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
