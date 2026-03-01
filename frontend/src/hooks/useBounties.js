import { useState, useEffect, useCallback, useRef } from 'react';
import { getReadContract } from '@/utils/ethers.js';
import { ADDRESSES, REGISTRY_ABI } from '@/config/contracts.js';

const STATUS_MAP = { active: 0n, reviewing: 1n, completed: 2n, expired: 3n, cancelled: 4n, disputed: 5n };
const LIMIT = 20;

export function useBounties({ category = 'all', status = 'all', sort = 'newest', search = '', page = 0 } = {}) {
  const [bounties,  setBounties]  = useState([]);
  const [total,     setTotal]     = useState(0);
  const [hasMore,   setHasMore]   = useState(false);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState(null);

  const load = useCallback(async () => {
    if (!ADDRESSES.registry) { setLoading(false); return; }
    try {
      setLoading(true);
      const reg    = getReadContract(ADDRESSES.registry, REGISTRY_ABI);
      const offset = page * LIMIT;
      let result, totalCount;

      if (category !== 'all') {
        [result, totalCount] = await reg.getBountiesByCategory(category, offset, LIMIT);
      } else if (status === 'active') {
        [result, totalCount] = await reg.getActiveBounties(offset, LIMIT);
      } else {
        [result, totalCount] = await reg.getAllBounties(offset, LIMIT);
      }

      let filtered = [...result];

      // Status filter (when not already filtered server-side)
      // Use BigInt comparison — ethers v6 returns status as BigInt from the tuple
      if (status !== 'all' && status !== 'active') {
        const statusVal = STATUS_MAP[status];
        if (statusVal !== undefined) filtered = filtered.filter(b => BigInt(b.status) === statusVal);
      }

      // Search filter — client-side on title (cached from on-chain field)
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        filtered = filtered.filter(b => {
          const titleMatch = (b.title || '').toLowerCase().includes(q);
          const catMatch   = (b.category || '').toLowerCase().includes(q);
          return titleMatch || catMatch;
        });
      }

      // Sort
      if (sort === 'reward') {
        filtered.sort((a, b) => (a.totalReward < b.totalReward ? 1 : a.totalReward > b.totalReward ? -1 : 0));
      } else if (sort === 'ending') {
        filtered.sort((a, b) => (a.deadline < b.deadline ? -1 : a.deadline > b.deadline ? 1 : 0));
      }
      // 'newest' is default (contract already returns newest-first)

      // Featured bounties bubble to top
      filtered.sort((a, b) => (b.featured ? 1 : 0) - (a.featured ? 1 : 0));

      setBounties(filtered);

      // FIX H-FE-2: Use filtered count for total/hasMore when client-side filtering is active
      const serverTotal = Number(totalCount);
      if ((status !== 'all' && status !== 'active') || search.trim()) {
        // Client-side filtered: total is the filtered result length (conservative estimate)
        setTotal(filtered.length);
        setHasMore(result.length === LIMIT); // more pages might have matching items
      } else {
        setTotal(serverTotal);
        setHasMore(offset + LIMIT < serverTotal);
      }
    } catch (err) {
      console.error('[useBounties]', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [category, status, sort, search, page]);

  useEffect(() => {
    // FIX H-FE-1/M-FE-4: Use a closure-scoped alive flag (avoids mountedRef race condition)
    // and pause polling when tab is hidden
    let alive = true;

    const doLoad = async () => {
      if (!alive) return;
      await load();
    };

    doLoad();

    // FIX M-FE-4: Pause interval polling when tab is not visible
    let intervalId = null;

    const startPolling = () => {
      if (intervalId) return;
      intervalId = setInterval(() => {
        if (!document.hidden) doLoad();
      }, 15000);
    };

    const stopPolling = () => {
      if (intervalId) { clearInterval(intervalId); intervalId = null; }
    };

    const handleVisibility = () => {
      if (document.hidden) {
        stopPolling();
      } else {
        doLoad(); // immediate refresh on tab focus
        startPolling();
      }
    };

    startPolling();
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      alive = false;
      stopPolling();
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [load]);

  return { bounties, total, hasMore, loading, error, refetch: load };
}
