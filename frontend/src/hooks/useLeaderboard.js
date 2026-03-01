import { useState, useEffect, useRef } from 'react';
import { getReadContract } from '@/utils/ethers.js';
import { ADDRESSES, REGISTRY_ABI, REPUTATION_ABI } from '@/config/contracts.js';
import { ethers } from 'ethers';

// FIX H-FE-4: Bound cache size and use per-instance flag (not module-level mutable ref)
// Cache is limited to a single TTL window; it is not shared across HMR reloads because
// we check CACHE_TTL strictly.
const CACHE_TTL   = 60_000; // 1 min
const MAX_BOUNTIES_SCAN = 200; // cap to avoid 8+ second scans on large datasets

let _hunterCache  = null;
let _projectCache = null;
let _cacheTs      = 0;

// Clears the module-level cache (useful after writes or test isolation)
export function invalidateLeaderboardCache() {
  _hunterCache = _projectCache = null; _cacheTs = 0;
}

async function scrapeActiveAddresses(reg) {
  const total = Number(await reg.bountyCount());
  if (total === 0) return { posters: new Set(), hunters: new Set() };

  const scanCount = Math.min(total, MAX_BOUNTIES_SCAN);
  const limit = 50;
  const pages = Math.ceil(scanCount / limit);
  const posters  = new Set();
  const hunters  = new Set();

  for (let p = 0; p < pages; p++) {
    try {
      const [bounties] = await reg.getAllBounties(p * limit, limit);
      for (const b of bounties) {
        if (b.poster && b.poster !== ethers.ZeroAddress) posters.add(b.poster.toLowerCase());
        if (b.winners) b.winners.forEach(w => { if (w && w !== ethers.ZeroAddress) hunters.add(w.toLowerCase()); });
      }
    } catch {}
  }
  return { posters, hunters };
}

export function useLeaderboard() {
  const [hunters,  setHunters]  = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(null);
  const aliveRef = useRef(true);

  useEffect(() => {
    aliveRef.current = true;

    const load = async () => {
      if (!ADDRESSES.registry || !ADDRESSES.reputation) { setLoading(false); return; }

      // Use cache if fresh
      if (_hunterCache && _projectCache && Date.now() - _cacheTs < CACHE_TTL) {
        if (aliveRef.current) { setHunters(_hunterCache); setProjects(_projectCache); setLoading(false); }
        return;
      }

      try {
        if (aliveRef.current) setLoading(true);
        const reg = getReadContract(ADDRESSES.registry,   REGISTRY_ABI);
        const rep = getReadContract(ADDRESSES.reputation, REPUTATION_ABI);

        const { posters, hunters: winnerAddrs } = await scrapeActiveAddresses(reg);

        const allAddresses = [...new Set([...posters, ...winnerAddrs])];
        const BATCH = 20;
        const hunterRows  = [];
        const projectRows = [];

        for (let i = 0; i < allAddresses.length; i += BATCH) {
          if (!aliveRef.current) return;
          const batch = allAddresses.slice(i, i + BATCH);
          const results = await Promise.allSettled(batch.map(async addr => {
            const [hStats, pStats, hScore, pScore, winRate] = await Promise.all([
              rep.getHunterStats(addr).catch(() => rep.hunters(addr).catch(() => null)),
              rep.getProjectStats(addr).catch(() => rep.projects(addr).catch(() => null)),
              rep.getHunterScore(addr).catch(() => 0n),
              rep.getProjectScore(addr).catch(() => 0n),
              rep.getWinRate(addr).catch(() => 0n),
            ]);
            return { addr, hStats, pStats, hScore, pScore, winRate };
          }));

          for (const r of results) {
            if (r.status !== 'fulfilled') continue;
            const { addr, hStats, pStats, hScore, pScore, winRate } = r.value;
            // Support both named struct fields (getHunterStats) and positional (hunters mapping)
            const subCount  = Number(hStats?.submissionCount ?? hStats?.[0] ?? 0);
            const winCount  = Number(hStats?.winCount        ?? hStats?.[1] ?? 0);
            const earned    = hStats?.totalEarned ?? hStats?.[2] ?? 0n;
            const posted    = Number(pStats?.bountiesPosted    ?? pStats?.[0] ?? 0);
            const completed = Number(pStats?.bountiesCompleted ?? pStats?.[1] ?? 0);
            const paid      = pStats?.totalPaid ?? pStats?.[2] ?? 0n;

            if (hStats && subCount > 0) {
              hunterRows.push({
                address: addr, score: Number(hScore), winCount,
                subCount, totalEarned: earned, winRate: Number(winRate),
              });
            }
            if (pStats && posted > 0) {
              projectRows.push({
                address: addr, score: Number(pScore), posted,
                completed, totalPaid: paid,
              });
            }
          }
        }

        hunterRows.sort((a, b) => b.score - a.score);
        projectRows.sort((a, b) => b.score - a.score);

        const topHunters  = hunterRows.slice(0, 20);
        const topProjects = projectRows.slice(0, 20);

        _hunterCache  = topHunters;
        _projectCache = topProjects;
        _cacheTs      = Date.now();

        if (aliveRef.current) { setHunters(topHunters); setProjects(topProjects); }
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

  return { hunters, projects, loading, error };
}
