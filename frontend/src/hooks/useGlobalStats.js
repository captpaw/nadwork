import { useState, useEffect, useRef } from 'react';
import { getReadContract } from '@/utils/ethers.js';
import { ADDRESSES, REGISTRY_ABI } from '@/config/contracts.js';

export function useGlobalStats() {
  const [stats, setStats] = useState({ bountyCount: 0, submissionCount: 0 });
  const mountedRef  = useRef(true);
  const loadingRef  = useRef(false); // prevent overlapping calls

  useEffect(() => {
    mountedRef.current = true;

    async function load() {
      if (!ADDRESSES.registry || loadingRef.current) return;
      loadingRef.current = true;
      try {
        const reg = getReadContract(ADDRESSES.registry, REGISTRY_ABI);
        const [bc, sc] = await Promise.all([reg.bountyCount(), reg.submissionCount()]);
        if (mountedRef.current) {
          setStats({ bountyCount: Number(bc), submissionCount: Number(sc) });
        }
      } catch {
        // silently ignore — stats are non-critical
      } finally {
        loadingRef.current = false;
      }
    }

    load();
    // Sequential interval: only fires after previous call resolves (loadingRef guard)
    const id = setInterval(load, 30_000);
    return () => { mountedRef.current = false; clearInterval(id); };
  }, []);

  return stats;
}
