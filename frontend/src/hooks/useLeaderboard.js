import { useState, useEffect, useRef } from 'react';
import { getReadContract } from '@/utils/ethers.js';
import { ADDRESSES, REGISTRY_ABI, REPUTATION_ABI } from '@/config/contracts.js';
import { ethers } from 'ethers';

// FIX H-FE-4: Bound cache size and use per-instance flag (not module-level mutable ref)
// Cache is limited to a single TTL window; it is not shared across HMR reloads because
// we check CACHE_TTL strictly.
const CACHE_TTL   = 60_000; // 1 min
const MAX_BOUNTIES_SCAN = 200; // cap to avoid 8+ second scans on large datasets

let _builderCache  = null;
let _creatorCache = null;
let _cacheTs      = 0;

// Clears the module-level cache (useful after writes or test isolation)
export function invalidateLeaderboardCache() {
  _builderCache = _creatorCache = null; _cacheTs = 0;
}

async function scrapeActiveAddresses(reg) {
  const total = Number(await reg.bountyCount());
  if (total === 0) return { creators: new Set(), builders: new Set() };

  const scanCount = Math.min(total, MAX_BOUNTIES_SCAN);
  const limit = 50;
  const pages = Math.ceil(scanCount / limit);
  const creators = new Set();
  const builders = new Set();

  for (let p = 0; p < pages; p++) {
    try {
      const [bounties] = await reg.getAllBounties(p * limit, limit);
      for (const b of bounties) {
        if (b.creator && b.creator !== ethers.ZeroAddress) creators.add(b.creator.toLowerCase());
        if (b.winners) b.winners.forEach(w => { if (w && w !== ethers.ZeroAddress) builders.add(w.toLowerCase()); });
      }
    } catch {}
  }
  return { creators, builders };
}

export function useLeaderboard() {
  const [builders,  setBuilders]  = useState([]);
  const [creators,  setCreators]  = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(null);
  const aliveRef = useRef(true);

  useEffect(() => {
    aliveRef.current = true;

    const load = async () => {
      if (!ADDRESSES.registry || !ADDRESSES.reputation) { setLoading(false); return; }

      // Use cache if fresh
      if (_builderCache && _creatorCache && Date.now() - _cacheTs < CACHE_TTL) {
        if (aliveRef.current) { setBuilders(_builderCache); setCreators(_creatorCache); setLoading(false); }
        return;
      }

      try {
        if (aliveRef.current) setLoading(true);
        const reg = getReadContract(ADDRESSES.registry,   REGISTRY_ABI);
        const rep = getReadContract(ADDRESSES.reputation, REPUTATION_ABI);

        const { creators: creatorAddrs, builders: winnerAddrs } = await scrapeActiveAddresses(reg);

        const allAddresses = [...new Set([...creatorAddrs, ...winnerAddrs])];
        const BATCH = 20;
        const builderRows  = [];
        const creatorRows = [];

        for (let i = 0; i < allAddresses.length; i += BATCH) {
          if (!aliveRef.current) return;
          const batch = allAddresses.slice(i, i + BATCH);
          const results = await Promise.allSettled(batch.map(async addr => {
            const [bStats, cStats, bScore, cScore, winRate] = await Promise.all([
              rep.getBuilderStats(addr).catch(() => rep.builders(addr).catch(() => null)),
              rep.getCreatorStats(addr).catch(() => rep.creators(addr).catch(() => null)),
              rep.getBuilderScore(addr).catch(() => 0n),
              rep.getCreatorScore(addr).catch(() => 0n),
              rep.getWinRate(addr).catch(() => 0n),
            ]);
            return { addr, bStats, cStats, bScore, cScore, winRate };
          }));

          for (const r of results) {
            if (r.status !== 'fulfilled') continue;
            const { addr, bStats, cStats, bScore, cScore, winRate } = r.value;
            // Support both named struct fields (getBuilderStats) and positional (builders mapping)
            const subCount  = Number(bStats?.submissionCount ?? bStats?.[0] ?? 0);
            const winCount  = Number(bStats?.winCount        ?? bStats?.[1] ?? 0);
            const earned    = bStats?.totalEarned ?? bStats?.[2] ?? 0n;
            const posted    = Number(cStats?.bountiesPosted    ?? cStats?.[0] ?? 0);
            const completed = Number(cStats?.bountiesCompleted ?? cStats?.[1] ?? 0);
            const paid      = cStats?.totalPaid ?? cStats?.[2] ?? 0n;

            if (bStats && subCount > 0) {
              builderRows.push({
                address: addr, score: Number(bScore), winCount,
                subCount, totalEarned: earned, winRate: Number(winRate),
              });
            }
            if (cStats && posted > 0) {
              creatorRows.push({
                address: addr, score: Number(cScore), posted,
                completed, totalPaid: paid,
              });
            }
          }
        }

        builderRows.sort((a, b) => b.score - a.score);
        creatorRows.sort((a, b) => b.score - a.score);

        const topBuilders  = builderRows.slice(0, 20);
        const topCreators = creatorRows.slice(0, 20);

        _builderCache  = topBuilders;
        _creatorCache = topCreators;
        _cacheTs      = Date.now();

        if (aliveRef.current) { setBuilders(topBuilders); setCreators(topCreators); }
      } catch (err) {
        console.error('[useLeaderboard]', err);
        if (aliveRef.current) setError(err.message);
      } finally {
        if (aliveRef.current) setLoading(false);
      }
    };

    load();
    return () => { aliveRef.current = false; };
  }, []);

  return { builders, creators, loading, error };
}
