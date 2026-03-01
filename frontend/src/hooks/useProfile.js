import { useState, useEffect, useCallback, useRef } from 'react';
import { getReadContractWithFallback } from '@/utils/ethers.js';
import { ADDRESSES, REGISTRY_ABI, REPUTATION_ABI } from '@/config/contracts.js';

export function useProfile(address) {
  const [hunterStats,  setHunterStats]  = useState(null);
  const [projectStats, setProjectStats] = useState(null);
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
      const [hunter, project, score, wr, subs, bids] = await Promise.all([
        rep.getHunterStats(address).catch(() => rep.hunters(address).catch(() => null)),
        rep.getProjectStats(address).catch(() => rep.projects(address).catch(() => null)),
        rep.getHunterScore(address).catch(() => 0n),
        rep.getWinRate(address).catch(() => 0n),
        reg.getHunterSubmissions(address).catch(() => []),
        reg.getPosterBounties(address).catch(() => []),
      ]);
      if (!mountedRef.current) return;
      setHunterStats(hunter);
      setProjectStats(project);
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

  return { hunterStats, projectStats, score: repScore, winRate, submissions, bountyIds, loading, error };
}
