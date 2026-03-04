import { useState, useEffect, useCallback, useRef } from 'react';
import { getReadContractWithFallback, invalidateContractCache } from '@/utils/ethers.js';
import { ADDRESSES, REGISTRY_ABI } from '@/config/contracts.js';
import { fetchJSON } from '@/config/pinata.js';

export function useBounty(bountyId) {
  const [bounty,      setBounty]      = useState(null);
  const [meta,        setMeta]        = useState(null);
  const [submissions, setSubmissions] = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState(null);
  const mountedRef = useRef(true);

  const loadBounty = useCallback(async () => {
    const id = bountyId ? String(bountyId).trim().replace(/[^0-9]/g, '') : '';
    if (!id || !ADDRESSES.registry) {
      if (mountedRef.current) setLoading(false);
      return;
    }
    const MAX_RETRIES = 3;
    const RETRY_DELAYS_MS = [3000, 8000, 15000]; // staggered to avoid rate limit

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const reg = await getReadContractWithFallback(ADDRESSES.registry, REGISTRY_ABI);
        const [b, subs] = await Promise.all([
          reg.getBounty(id),
          reg.getBountySubmissions(id),
        ]);
        if (!mountedRef.current) return;
        if (!b || b.creator === '0x0000000000000000000000000000000000000000') {
          if (mountedRef.current) { setError('Bounty #' + id + ' does not exist.'); setLoading(false); }
          return;
        }
        setBounty(b);
        setSubmissions([...subs]);
        setError(null);
        if (b.ipfsHash) fetchJSON(b.ipfsHash).then(m => mountedRef.current && setMeta(m));
        if (mountedRef.current) setLoading(false);
        return;
      } catch (err) {
        const isRetryable = err?.message?.includes('429') || err?.code === 'CALL_EXCEPTION' || err?.message?.includes('missing revert');
        if (err?.message?.includes('429')) invalidateContractCache(ADDRESSES.registry);
        if (attempt < MAX_RETRIES && isRetryable) {
          await new Promise(r => setTimeout(r, RETRY_DELAYS_MS[attempt - 1] ?? 5000));
          continue;
        }
        if (import.meta.env.DEV) console.error('[useBounty] error loading bounty #' + id + ':', err);
        if (mountedRef.current) { setError(err.shortMessage || err.reason || err.message); setLoading(false); }
        return;
      }
    }
  }, [bountyId]);

  useEffect(() => {
    mountedRef.current = true;
    setLoading(true);
    const staggerMs = Math.floor(Math.random() * 1500);
    const t = setTimeout(loadBounty, staggerMs);

    // FIX M-FE-4: Pause polling when tab is hidden
    let intervalId = null;
    const startPolling = () => {
      if (intervalId) return;
      intervalId = setInterval(() => {
        if (!document.hidden && mountedRef.current) loadBounty();
      }, 45000);
    };
    const stopPolling = () => { if (intervalId) { clearInterval(intervalId); intervalId = null; } };
    const handleVisibility = () => {
      if (document.hidden) stopPolling();
      else { if (mountedRef.current) loadBounty(); startPolling(); }
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
