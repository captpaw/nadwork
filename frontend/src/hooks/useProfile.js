import { useState, useEffect, useCallback, useRef } from 'react';
import { getReadContractWithFallback } from '@/utils/ethers.js';
import { getResolvedRegistryContract, listCreatorBountyIds } from '@/utils/registry.js';
import { ADDRESSES, REPUTATION_ABI } from '@/config/contracts.js';
import { hasIndexer, querySubgraph, GQL_GET_CREATOR_BOUNTIES } from './useIndexer.js';

const RETRY_DELAYS_MS = [1200, 2400];
const POLL_MS = 45000;

function shouldRetryProfileError(err) {
  const msg = String(err?.shortMessage || err?.reason || err?.message || '');
  return /429|Too Many Requests|missing revert data|could not coalesce error|CALL_EXCEPTION/i.test(msg);
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeBountyIdList(values) {
  return [
    ...new Set(
      (Array.isArray(values) ? values : [])
        .map((v) => {
          try {
            return String(BigInt(v));
          } catch {
            return null;
          }
        })
        .filter(Boolean)
    ),
  ];
}

async function queryCreatorBountyIdsFromIndexer(address) {
  if (!hasIndexer() || !address) return [];

  const raw = String(address);
  const lower = raw.toLowerCase();

  const dataLower = await querySubgraph(GQL_GET_CREATOR_BOUNTIES, { creator: lower }).catch(() => null);
  let rows = dataLower?.bounties || [];

  if (rows.length === 0 && raw !== lower) {
    const dataRaw = await querySubgraph(GQL_GET_CREATOR_BOUNTIES, { creator: raw }).catch(() => null);
    rows = dataRaw?.bounties || [];
  }

  return normalizeBountyIdList(rows.map((b) => b?.id));
}

export function useProfile(address) {
  const [builderStats, setBuilderStats] = useState(null);
  const [creatorStats, setCreatorStats] = useState(null);
  const [repScore, setRepScore] = useState(0n);
  const [winRate, setWinRate] = useState(0n);
  const [submissions, setSubmissions] = useState([]);
  const [bountyIds, setBountyIds] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const mountedRef = useRef(true);

  const fetch = useCallback(async () => {
    if (!address) {
      if (!mountedRef.current) return;
      setBuilderStats(null);
      setCreatorStats(null);
      setRepScore(0n);
      setWinRate(0n);
      setSubmissions([]);
      setBountyIds([]);
      setError(null);
      setLoading(false);
      return;
    }

    if (!ADDRESSES.registry && !ADDRESSES.factory) {
      if (!mountedRef.current) return;
      setError('Registry/Factory address not configured');
      setLoading(false);
      return;
    }

    if (!mountedRef.current) return;
    setLoading(true);
    setError(null);

    let lastErr = null;

    for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt += 1) {
      try {
        const { contract: reg } = await getResolvedRegistryContract();
        if (!reg) throw new Error('Registry contract not found');

        const rep = ADDRESSES.reputation
          ? await getReadContractWithFallback(ADDRESSES.reputation, REPUTATION_ABI).catch(() => null)
          : null;

        const [builder, creator, score, wr, subs, bids] = await Promise.all([
          rep ? rep.getBuilderStats(address).catch(() => rep.builders(address).catch(() => null)) : Promise.resolve(null),
          rep ? rep.getCreatorStats(address).catch(() => rep.creators(address).catch(() => null)) : Promise.resolve(null),
          rep ? rep.getBuilderScore(address).catch(() => 0n) : Promise.resolve(0n),
          rep ? rep.getWinRate(address).catch(() => 0n) : Promise.resolve(0n),
          reg.getBuilderSubmissions(address).catch(() => []),
          listCreatorBountyIds(reg, address).catch(() => []),
        ]);

        if (!mountedRef.current) return;

        setBuilderStats(builder);
        setCreatorStats(creator);
        setRepScore(score ?? 0n);
        setWinRate(wr ?? 0n);
        setSubmissions(Array.isArray(subs) ? [...subs] : []);

        const onchainIds = normalizeBountyIdList(Array.isArray(bids) ? bids : []);
        let mergedIds = onchainIds;

        if (hasIndexer()) {
          try {
            const indexerIds = await queryCreatorBountyIdsFromIndexer(address);
            mergedIds = normalizeBountyIdList([...onchainIds, ...indexerIds]);
          } catch {
            // non-fatal: keep on-chain ids only
          }
        }

        setBountyIds(mergedIds);
        lastErr = null;
        break;
      } catch (err) {
        lastErr = err;
        if (attempt < RETRY_DELAYS_MS.length && shouldRetryProfileError(err)) {
          await delay(RETRY_DELAYS_MS[attempt]);
          continue;
        }
        break;
      }
    }

    if (!mountedRef.current) return;
    if (lastErr) {
      if (import.meta.env.DEV) {
        console.error('[useProfile]', lastErr);
      }
      setError(lastErr?.message || 'Failed to load profile');
    }
    setLoading(false);
  }, [address]);

  useEffect(() => {
    mountedRef.current = true;
    void fetch();

    let intervalId = null;
    const startPolling = () => {
      if (intervalId) return;
      intervalId = setInterval(() => {
        if (!document.hidden && mountedRef.current) void fetch();
      }, POLL_MS);
    };
    const stopPolling = () => {
      if (!intervalId) return;
      clearInterval(intervalId);
      intervalId = null;
    };

    const onVisibility = () => {
      if (document.hidden) {
        stopPolling();
      } else {
        if (mountedRef.current) void fetch();
        startPolling();
      }
    };

    startPolling();
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      mountedRef.current = false;
      stopPolling();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [fetch]);

  return { builderStats, creatorStats, score: repScore, winRate, submissions, bountyIds, loading, error };
}
