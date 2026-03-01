import { useState, useEffect, useCallback, useRef } from 'react';
import { getReadContract, getReadContractWithFallback } from '@/utils/ethers.js';
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
    // Normalize bountyId — strip any trailing chars, ensure it's a valid number string
    const id = bountyId ? String(bountyId).trim().replace(/[^0-9]/g, '') : '';
    if (!id || !ADDRESSES.registry) {
      if (mountedRef.current) setLoading(false);
      return;
    }
    try {
      const reg = await getReadContractWithFallback(ADDRESSES.registry, REGISTRY_ABI);
      const [b, subs] = await Promise.all([
        reg.getBounty(id),
        reg.getBountySubmissions(id),
      ]);
      if (!mountedRef.current) return;
      // validate bounty exists (poster should be non-zero)
      if (!b || b.poster === '0x0000000000000000000000000000000000000000') {
        setError('Bounty #' + id + ' does not exist.');
        setLoading(false);
        return;
      }
      setBounty(b);
      setSubmissions([...subs]);
      if (b.ipfsHash) fetchJSON(b.ipfsHash).then(m => mountedRef.current && setMeta(m));
    } catch (err) {
      console.error('[useBounty] error loading bounty #' + id + ':', err);
      if (mountedRef.current) setError(err.shortMessage || err.reason || err.message);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [bountyId]);

  useEffect(() => {
    mountedRef.current = true;
    setLoading(true);
    loadBounty();

    // FIX M-FE-4: Pause polling when tab is hidden
    let intervalId = null;
    const startPolling = () => {
      if (intervalId) return;
      intervalId = setInterval(() => {
        if (!document.hidden && mountedRef.current) loadBounty();
      }, 12000);
    };
    const stopPolling = () => { if (intervalId) { clearInterval(intervalId); intervalId = null; } };
    const handleVisibility = () => {
      if (document.hidden) stopPolling();
      else { if (mountedRef.current) loadBounty(); startPolling(); }
    };
    startPolling();
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      mountedRef.current = false;
      stopPolling();
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [loadBounty]);

  return { bounty, meta, submissions, loading, error, refetch: loadBounty };
}
