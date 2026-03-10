import { useState, useEffect, useCallback, useRef } from 'react';
import { invalidateContractCache } from '@/utils/ethers.js';
import { ADDRESSES } from '@/config/contracts.js';
import { fetchJSON } from '@/config/pinata.js';
import { getResolvedRegistryContract } from '@/utils/registry.js';
import { getBountyId, readBountyField } from '@/utils/orbital.mjs';
import { hasIndexer, querySubgraph, GQL_GET_BOUNTY_BY_ID } from './useIndexer.js';
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

function toBigIntSafe(value, fallback = 0n) {
  try {
    if (value == null) return fallback;
    return BigInt(value);
  } catch {
    return fallback;
  }
}

function toNumberSafe(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function toStringSafe(value, fallback = '') {
  if (value == null) return fallback;
  const str = String(value).trim();
  return str || fallback;
}

function normalizeRequiresApplication(value, factoryCaps) {
  return applyRequiresApplicationCompatibility(toBoolSafe(value, false), factoryCaps);
}

function mapRegistryBounty(raw, factoryCaps) {
  if (!raw) return null;

  const idRaw = getBountyId(raw) ?? readBountyField(raw, 'id', 0) ?? 0;
  const id = toBigIntSafe(idRaw, 0n);
  const ipfsHashRaw = readBountyField(raw, 'ipfsHash', 2) ?? readBountyField(raw, 'metaCid');
  const categoryRaw = readBountyField(raw, 'category', 4);

  return {
    ...raw,
    id,
    creator: toStringSafe(readBountyField(raw, 'creator', 1), ''),
    ipfsHash: toStringSafe(ipfsHashRaw, ''),
    metaCid: toStringSafe(readBountyField(raw, 'metaCid') ?? ipfsHashRaw, ''),
    title: toStringSafe(readBountyField(raw, 'title', 3), ''),
    category: toStringSafe(categoryRaw, 'other'),
    status: toNumberSafe(readBountyField(raw, 'status', 6), 0),
    totalReward: toBigIntSafe(readBountyField(raw, 'totalReward', 9), 0n),
    winnerCount: toNumberSafe(readBountyField(raw, 'winnerCount', 10), 1),
    deadline: toBigIntSafe(readBountyField(raw, 'deadline', 12), 0n),
    createdAt: toBigIntSafe(readBountyField(raw, 'createdAt', 13), id),
    featured: toBoolSafe(readBountyField(raw, 'featured', 15), false),
    submissionCount: toNumberSafe(readBountyField(raw, 'submissionCount', 16), 0),
    reviewDeadline: toBigIntSafe(readBountyField(raw, 'reviewDeadline', 17), 0n),
    creatorStake: toBigIntSafe(readBountyField(raw, 'creatorStake', 18), 0n),
    requiresApplication: normalizeRequiresApplication(readBountyField(raw, 'requiresApplication', 19), factoryCaps),
  };
}

function mapIndexerBounty(raw, factoryCaps) {
  if (!raw) return null;
  return {
    id: BigInt(raw.id || '0'),
    creator: raw.creator || '0x0000000000000000000000000000000000000000',
    ipfsHash: raw.metaCid || '',
    title: raw.title || '',
    category: raw.category || 'other',
    bountyType: 0,
    status: Number(raw.status || 0),
    rewardType: 0,
    rewardToken: '0x0000000000000000000000000000000000000000',
    totalReward: BigInt(raw.totalReward || '0'),
    winnerCount: Number(raw.winnerCount || 1),
    prizeWeights: [],
    deadline: BigInt(raw.deadline || '0'),
    createdAt: BigInt(raw.createdAt || '0'),
    winners: [],
    featured: toBoolSafe(raw.featured, false),
    submissionCount: Number(raw.submissionCount || 0),
    reviewDeadline: 0n,
    creatorStake: 0n,
    requiresApplication: normalizeRequiresApplication(raw.requiresApplication, factoryCaps),
    _source: 'indexer',
  };
}

async function loadFromIndexerById(id, factoryCaps) {
  if (!hasIndexer()) return null;
  const data = await querySubgraph(GQL_GET_BOUNTY_BY_ID, { id: String(id) });
  const row = data?.bounties?.[0];
  if (!row) return null;
  return { bounty: mapIndexerBounty(row, factoryCaps), submissions: [] };
}

export function useBounty(bountyId) {
  const [bounty, setBounty] = useState(null);
  const [meta, setMeta] = useState(null);
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const mountedRef = useRef(true);

  const loadBounty = useCallback(async () => {
    const id = bountyId ? String(bountyId).trim().replace(/[^0-9]/g, '') : '';
    if (!id || (!ADDRESSES.registry && !ADDRESSES.factory)) {
      if (mountedRef.current) {
        setBounty(null);
        setMeta(null);
        setSubmissions([]);
        setError(null);
        setLoading(false);
      }
      return;
    }

    const MAX_RETRIES = 3;
    const RETRY_DELAYS_MS = [3000, 8000, 15000];

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      let resolvedRegistryAddress = ADDRESSES.registry || '';
      let factoryCaps = null;
      try {
        factoryCaps = await getFactoryCapabilities();
        const { address, contract: reg } = await getResolvedRegistryContract();
        resolvedRegistryAddress = address || resolvedRegistryAddress;
        if (!reg) throw new Error('Registry contract not found.');

        const [b, subs] = await Promise.all([reg.getBounty(id), reg.getBountySubmissions(id)]);
        if (!mountedRef.current) return;

        if (!b || b.creator === '0x0000000000000000000000000000000000000000') {
          const fallback = await loadFromIndexerById(id, factoryCaps);
          if (fallback?.bounty) {
            setBounty(fallback.bounty);
            setError(null);
            if (fallback.bounty.ipfsHash) {
              fetchJSON(fallback.bounty.ipfsHash).then((m) => mountedRef.current && setMeta(m));
            }
            try {
              const subs = await reg.getBountySubmissions(id);
              if (mountedRef.current && Array.isArray(subs)) setSubmissions([...subs]);
              else if (mountedRef.current) setSubmissions([]);
            } catch {
              if (mountedRef.current) setSubmissions([]);
            }
            if (mountedRef.current) setLoading(false);
            return;
          }

          if (mountedRef.current) {
            setError(`Bounty #${id} does not exist.`);
            setLoading(false);
          }
          return;
        }

        const mapped = mapRegistryBounty(b, factoryCaps);
        setBounty(mapped);
        setSubmissions([...subs]);
        setError(null);

        if (mapped?.ipfsHash) {
          fetchJSON(mapped.ipfsHash).then((m) => mountedRef.current && setMeta(m));
        }

        if (mountedRef.current) setLoading(false);
        return;
      } catch (err) {
        const isRetryable =
          err?.message?.includes('429') ||
          err?.code === 'CALL_EXCEPTION' ||
          err?.message?.includes('missing revert');

        if (err?.message?.includes('429')) {
          invalidateContractCache(resolvedRegistryAddress || ADDRESSES.registry);
        }

        if (err?.code === 'CALL_EXCEPTION' || /Registry: not found|missing revert data/i.test(err?.message || '')) {
          const fallback = await loadFromIndexerById(id, factoryCaps);
          if (fallback?.bounty) {
            if (!mountedRef.current) return;
            setBounty(fallback.bounty);
            setError(null);
            if (fallback.bounty.ipfsHash) {
              fetchJSON(fallback.bounty.ipfsHash).then((m) => mountedRef.current && setMeta(m));
            }
            try {
              const { contract: regFallback } = await getResolvedRegistryContract();
              if (regFallback) {
                const subs = await regFallback.getBountySubmissions(id);
                if (mountedRef.current && Array.isArray(subs)) setSubmissions([...subs]);
                else if (mountedRef.current) setSubmissions([]);
              } else if (mountedRef.current) setSubmissions([]);
            } catch {
              if (mountedRef.current) setSubmissions([]);
            }
            setLoading(false);
            return;
          }
        }

        if (attempt < MAX_RETRIES && isRetryable) {
          await new Promise((r) => setTimeout(r, RETRY_DELAYS_MS[attempt - 1] ?? 5000));
          continue;
        }

        if (import.meta.env.DEV) {
          console.error(`[useBounty] error loading bounty #${id}:`, err);
        }

        if (mountedRef.current) {
          setError(err.shortMessage || err.reason || err.message);
          setLoading(false);
        }
        return;
      }
    }
  }, [bountyId]);

  useEffect(() => {
    mountedRef.current = true;
    setLoading(true);
    const t = setTimeout(() => { void loadBounty(); }, 0);

    let intervalId = null;
    const startPolling = () => {
      if (intervalId) return;
      intervalId = setInterval(() => {
        if (!document.hidden && mountedRef.current) loadBounty();
      }, 45000);
    };
    const stopPolling = () => {
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
    };
    const handleVisibility = () => {
      if (document.hidden) stopPolling();
      else {
        if (mountedRef.current) loadBounty();
        startPolling();
      }
    };

    startPolling();
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      clearTimeout(t);
      mountedRef.current = false;
      stopPolling();
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [loadBounty]);

  return { bounty, meta, submissions, loading, error, refetch: loadBounty };
}

