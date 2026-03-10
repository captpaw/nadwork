import { useState, useEffect, useCallback, useRef } from 'react';
import { ADDRESSES } from '@/config/contracts.js';
import { getBountyId, orbitalDebugLog } from '@/utils/orbital.mjs';
import { getResolvedRegistryContract } from '@/utils/registry.js';
import { hasIndexer, isIndexerConfigured, querySubgraph, GQL_GET_BOUNTIES } from './useIndexer.js';
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



const SOFT_RETRY_DELAYS_MS = [2500, 6000, 12000];

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

/**
 * Fetches bounties for the HomePage orbital board.
 * Prefers subgraph for stable list + lower RPC load; falls back to RPC only if indexer is not configured.
 */
export function useOrbitalBounties() {
  const [bounties, setBounties] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadRef = useRef(null);
  const retryTimerRef = useRef(null);
  const retryAttemptRef = useRef(0);
  const bountiesRef = useRef([]);
  const inFlightRef = useRef(false);
  const queuedReloadRef = useRef(false);

  useEffect(() => {
    bountiesRef.current = bounties;
  }, [bounties]);

  const scheduleSoftRetry = useCallback(() => {
    if (retryTimerRef.current) return;
    const idx = Math.min(retryAttemptRef.current, SOFT_RETRY_DELAYS_MS.length - 1);
    const delay = SOFT_RETRY_DELAYS_MS[idx];
    retryAttemptRef.current += 1;

    retryTimerRef.current = setTimeout(() => {
      retryTimerRef.current = null;
      const fn = loadRef.current;
      if (fn) void fn();
    }, delay);
  }, []);

  const load = useCallback(async () => {
    if (inFlightRef.current) {
      queuedReloadRef.current = true;
      return;
    }

    inFlightRef.current = true;

    if (!ADDRESSES.registry && !ADDRESSES.factory) {
      retryAttemptRef.current = 0;
      setBounties([]);
      setLoading(false);
      inFlightRef.current = false;
      return;
    }

    let keepLoading = false;

    try {
      setLoading(true);

      const indexerConfigured = isIndexerConfigured();
      const factoryCaps = await getFactoryCapabilities();
      if (indexerConfigured && hasIndexer()) {
        const data = await querySubgraph(GQL_GET_BOUNTIES, { skip: 0, first: 24 });
        if (data?.bounties) {
          const mapped = data.bounties.map((row) => mapSubgraphBounty(row, factoryCaps));
          retryAttemptRef.current = 0;
          setBounties(mapped);
          orbitalDebugLog('hook-load', { source: 'indexer', total: mapped.length });
          return;
        }

        if (import.meta.env.DEV) {
          console.warn('[useOrbitalBounties] subgraph unavailable, keeping previous orbital state');
        }

        if (bountiesRef.current.length === 0) {
          keepLoading = true;
          scheduleSoftRetry();
        }
        return;
      }

      // RPC path is used only when no indexer is configured.
      const { contract: reg } = await getResolvedRegistryContract();
      if (!reg) {
        setBounties([]);
        return;
      }

      let featured = [];
      let all = [];

      try {
        featured = await reg.getFeaturedBounties();
      } catch (e) {
        if (import.meta.env.DEV) {
          console.warn('[useOrbitalBounties] getFeaturedBounties failed', e?.message);
        }
      }

      try {
        const [allResult] = await reg.getAllBounties(0, 24);
        all = allResult || [];
      } catch (e) {
        if (import.meta.env.DEV) {
          console.warn('[useOrbitalBounties] getAllBounties failed', e?.message);
        }
      }

      const merged = [...(Array.isArray(featured) ? featured : []), ...(Array.isArray(all) ? all : [])];
      const seen = new Set();
      const unique = [];

      for (const bounty of merged) {
        const id = getBountyId(bounty);
        const key = id != null ? String(id) : '';
        if (!key || seen.has(key)) continue;
        seen.add(key);
        unique.push(bounty);
      }

      retryAttemptRef.current = 0;
      const normalizedUnique = unique.map((row) => ({
        ...row,
        requiresApplication: applyRequiresApplicationCompatibility(toBoolSafe(row?.requiresApplication, false), factoryCaps),
      }));
      setBounties(normalizedUnique);
      orbitalDebugLog('hook-load', {
        source: 'rpc',
        featured: featured.length || 0,
        all: all.length || 0,
        unique: unique.length,
      });
    } catch (err) {
      if (import.meta.env.DEV) {
        console.error('[useOrbitalBounties]', err);
      }

      if (bountiesRef.current.length === 0) {
        keepLoading = true;
        scheduleSoftRetry();
      }
    } finally {
      inFlightRef.current = false;
      if (queuedReloadRef.current) {
        queuedReloadRef.current = false;
        const fn = loadRef.current;
        if (fn) {
          void fn();
          return;
        }
      }

      if (!keepLoading) {
        setLoading(false);
      }
    }
  }, [scheduleSoftRetry]);

  useEffect(() => {
    loadRef.current = load;
  }, [load]);

  useEffect(() => {
    let active = true;

    const run = async () => {
      if (!active) return;
      const fn = loadRef.current;
      if (fn) await fn();
    };

    run();

    const timer = setInterval(run, 45_000);
    const onVisible = () => {
      if (!document.hidden) void run();
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      active = false;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
    };
  }, []);

  return { bounties, loading, refetch: load };
}





