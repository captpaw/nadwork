import { useState, useEffect, useRef, useCallback } from 'react';
import { invalidateContractCache } from '@/utils/ethers.js';
import { ADDRESSES } from '@/config/contracts.js';
import { getResolvedRegistryContract } from '@/utils/registry.js';
import { hasIndexer, isIndexerConfigured, querySubgraph, GQL_GET_PLATFORM_STATS, GQL_GET_BOUNTIES } from './useIndexer.js';
import { applyRequiresApplicationCompatibility, getFactoryCapabilities } from '@/utils/factoryCapabilities.js';

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



const DEFAULT_STATS = Object.freeze({
  bountyCount: 0,
  submissionCount: 0,
  orbitalBounties: [],
});

const POLL_MS = 60_000;
const CACHE_TTL_MS = 15_000;

let sharedStatsCache = { ...DEFAULT_STATS };
let sharedStatsTs = 0;
let sharedStatsInFlight = null;

function mapSubgraphBounty(row, factoryCaps) {
  return {
    id: row?.id ?? '',
    creator: row?.creator ?? '',
    ipfsHash: row?.metaCid ?? '',
    title: row?.title ?? '',
    category: row?.category ?? 'other',
    status: Number(row?.status ?? 0),
    totalReward: row?.totalReward ?? '0',
    winnerCount: Number(row?.winnerCount ?? 1),
    deadline: row?.deadline ?? '0',
    createdAt: row?.createdAt ?? '0',
    featured: toBoolSafe(row?.featured, false),
    submissionCount: Number(row?.submissionCount ?? 0),
    requiresApplication: applyRequiresApplicationCompatibility(toBoolSafe(row?.requiresApplication, false), factoryCaps),
    _source: 'indexer',
  };
}

function isStatsCacheFresh() {
  return sharedStatsTs > 0 && (Date.now() - sharedStatsTs) < CACHE_TTL_MS;
}

function updateSharedStats(next) {
  const normalized = {
    bountyCount: Number(next?.bountyCount ?? 0),
    submissionCount: Number(next?.submissionCount ?? 0),
    orbitalBounties: Array.isArray(next?.orbitalBounties) ? next.orbitalBounties : [],
  };
  sharedStatsCache = normalized;
  sharedStatsTs = Date.now();
  return normalized;
}

async function fetchStatsFromSource() {
  if (!ADDRESSES.registry && !ADDRESSES.factory) {
    return { ...DEFAULT_STATS };
  }

  let resolvedRegistryAddress = ADDRESSES.registry || '';
  try {
    const indexerConfigured = isIndexerConfigured();

    if (indexerConfigured && hasIndexer()) {
      const factoryCaps = await getFactoryCapabilities();
      const [statsData, listData] = await Promise.all([
        querySubgraph(GQL_GET_PLATFORM_STATS, {}),
        querySubgraph(GQL_GET_BOUNTIES, { skip: 0, first: 24 }),
      ]);

      if (statsData || listData) {
        const global = statsData?.platformStats;
        const list = (listData?.bounties || []).map((row) => mapSubgraphBounty(row, factoryCaps));
        return {
          bountyCount: Number(global?.totalBounties ?? list.length ?? sharedStatsCache.bountyCount ?? 0),
          submissionCount: Number(global?.totalSubmissions ?? sharedStatsCache.submissionCount ?? 0),
          orbitalBounties: list,
        };
      }

      if (import.meta.env.DEV) {
        console.warn('[useGlobalStats] subgraph unavailable, keeping previous stats state');
      }
      return sharedStatsCache;
    }

    // RPC path is used only when no indexer is configured.
    const factoryCaps = await getFactoryCapabilities();
    const { address, contract: reg } = await getResolvedRegistryContract();
    resolvedRegistryAddress = address || resolvedRegistryAddress;
    if (!reg) return sharedStatsCache;

    const [bc, sc, [bountiesList]] = await Promise.all([
      reg.bountyCount(),
      reg.submissionCount(),
      reg.getAllBounties(0, 24),
    ]);

    return {
      bountyCount: Number(bc),
      submissionCount: Number(sc),
      orbitalBounties: Array.isArray(bountiesList)
        ? bountiesList.map((row) => ({
            ...row,
            requiresApplication: applyRequiresApplicationCompatibility(toBoolSafe(row?.requiresApplication, false), factoryCaps),
          }))
        : [],
    };
  } catch (e) {
    if (e?.message?.includes('429')) {
      invalidateContractCache(resolvedRegistryAddress || ADDRESSES.registry);
    }
    return sharedStatsCache;
  }
}

async function getSharedStats(force = false) {
  if (!force && isStatsCacheFresh()) {
    return sharedStatsCache;
  }

  if (sharedStatsInFlight) {
    return sharedStatsInFlight;
  }

  sharedStatsInFlight = (async () => {
    const next = await fetchStatsFromSource();
    return updateSharedStats(next);
  })();

  try {
    return await sharedStatsInFlight;
  } finally {
    sharedStatsInFlight = null;
  }
}

export function useGlobalStats() {
  const [stats, setStats] = useState(sharedStatsCache);
  const mountedRef = useRef(true);

  const load = useCallback(async (force = false) => {
    const next = await getSharedStats(force);
    if (mountedRef.current) setStats(next);
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    void load(false);

    const id = setInterval(() => {
      void load(true);
    }, POLL_MS);

    const onVisible = () => {
      if (!document.hidden) {
        void load(false);
      }
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      mountedRef.current = false;
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [load]);

  return stats;
}



