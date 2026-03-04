import { useState, useEffect, useCallback, useRef } from 'react';
import { getReadContractWithFallback } from '@/utils/ethers.js';
import { ADDRESSES, REGISTRY_ABI, REPUTATION_ABI } from '@/config/contracts.js';

export function useProfile(address) {
  const [builderStats,  setBuilderStats]  = useState(null);
  const [creatorStats,  setCreatorStats]  = useState(null);
  const [repScore,     setRepScore]     = useState(0n);
  const [winRate,      setWinRate]      = useState(0n);
  const [submissions,  setSubmissions]  = useState([]);
  const [bountyIds,    setBountyIds]    = useState([]);
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState(null);
  const mountedRef = useRef(true);

  const fetch = useCallback(async () => {
    if (!address) { setLoading(false); return; }
    if (!ADDRESSES.registry || !ADDRESSES.reputation) {
      setLoading(false);
      setError('Contract addresses not configured');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const reg = await getReadContractWithFallback(ADDRESSES.registry, REGISTRY_ABI);
      const rep = await getReadContractWithFallback(ADDRESSES.reputation, REPUTATION_ABI);
      const [builder, creator, score, wr, subs, bids] = await Promise.all([
        rep.getBuilderStats(address).catch(() => rep.builders(address).catch(() => null)),
        rep.getCreatorStats(address).catch(() => rep.creators(address).catch(() => null)),
        rep.getBuilderScore(address).catch(() => 0n),
        rep.getWinRate(address).catch(() => 0n),
        reg.getBuilderSubmissions(address).catch(() => []),
        reg.getCreatorBounties(address).catch(() => []),
      ]);
      if (!mountedRef.current) return;
      setBuilderStats(builder);
      setCreatorStats(creator);
      setRepScore(score);
      setWinRate(wr);
      setSubmissions([...subs]);
      setBountyIds([...bids]);
    } catch (err) {
      console.error('[useProfile]', err);
      if (mountedRef.current) setError(err.message);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [address]);

  useEffect(() => {
    mountedRef.current = true;
    fetch();
    return () => { mountedRef.current = false; };
  }, [fetch]);

  return { builderStats, creatorStats, score: repScore, winRate, submissions, bountyIds, loading, error };
}
