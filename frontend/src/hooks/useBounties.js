import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { invalidateContractCache } from '@/utils/ethers.js';
import { ADDRESSES } from '@/config/contracts.js';
import { fetchJSON, getCachedJSON } from '@/config/pinata.js';
import {
  hasIndexer,
  isIndexerConfigured,
  querySubgraph,
  clearSubgraphCache,
  GQL_GET_BOUNTIES_BY_CAT,
  GQL_GET_ACTIVE_BOUNTIES,
  GQL_GET_BOUNTIES,
} from './useIndexer.js';
import { clearRegistryResolutionCache, getResolvedRegistryContract, listCreatorBountyIds } from '@/utils/registry.js';
import { getBountyId, readBountyField } from '@/utils/orbital.mjs';
import { applyRequiresApplicationCompatibility, getFactoryCapabilities } from '@/utils/factoryCapabilities.js';

const STATUS_MAP = { active: 0n, reviewing: 1n, completed: 2n, expired: 3n, cancelled: 4n, disputed: 5n };
const LIMIT = 20;
const RETRY_DELAY_MS = 1800;
const JUST_POSTED_KEY = 'nw_bounty_just_posted';
const JUST_POSTED_MAX_AGE_MS = 10 * 60 * 1000;
const TRANSIENT_EMPTY_RETRY_LIMIT = 6;

let lastJustPostedCacheBustTs = 0;

function clearJustPostedHint() {
  try {
    if (typeof sessionStorage === 'undefined') return;
    sessionStorage.removeItem(JUST_POSTED_KEY);
  } catch {
    // ignore sessionStorage errors
  }
}

function readJustPostedHint() {
  try {
    if (typeof sessionStorage === 'undefined') return null;

    const raw = sessionStorage.getItem(JUST_POSTED_KEY);
    if (!raw) return null;

    if (raw === '1') {
      clearJustPostedHint();
      return null;
    }
    const parsed = JSON.parse(raw);

    const ts = Number(parsed?.ts) || Date.now();
    const bountyId = parsed?.bountyId ? String(parsed.bountyId) : '';
    if (Date.now() - ts > JUST_POSTED_MAX_AGE_MS) {
      clearJustPostedHint();
      return null;
    }

    return {
      posted: true,
      ts,
      bountyId,
      title: parsed?.title ? String(parsed.title) : '',
      category: parsed?.category ? String(parsed.category).toLowerCase() : '',
      totalReward: parsed?.totalReward ? String(parsed.totalReward) : '',
      deadline: parsed?.deadline ? String(parsed.deadline) : '',
      creator: parsed?.creator ? String(parsed.creator) : '',
      metaCid: parsed?.metaCid ? String(parsed.metaCid) : '',
      requiresApplication: toBoolSafe(parsed?.requiresApplication, false),
    };
  } catch {
    clearJustPostedHint();
    return null;
  }
}

function writeJustPostedHint(hint) {
  try {
    if (typeof sessionStorage === 'undefined') return;
    if (!hint || typeof hint !== 'object') return;

    sessionStorage.setItem(JUST_POSTED_KEY, JSON.stringify({
      ts: Number(hint.ts) || Date.now(),
      bountyId: hint?.bountyId ? String(hint.bountyId) : '',
      title: hint?.title ? String(hint.title) : '',
      category: hint?.category ? String(hint.category).toLowerCase() : '',
      totalReward: hint?.totalReward ? String(hint.totalReward) : '',
      deadline: hint?.deadline ? String(hint.deadline) : '',
      creator: hint?.creator ? String(hint.creator) : '',
      metaCid: hint?.metaCid ? String(hint.metaCid) : '',
      requiresApplication: toBoolSafe(hint?.requiresApplication, false),
    }));
  } catch {
    // ignore sessionStorage errors
  }
}

async function hydratePostedHintIdFromCreator(reg, postedHint) {
  if (!reg || !postedHint || postedHint.bountyId || !postedHint.creator) {
    return postedHint;
  }

  try {
    const ids = await listCreatorBountyIds(reg, postedHint.creator);
    if (!Array.isArray(ids) || ids.length === 0) return postedHint;

    let maxId = 0n;
    for (const raw of ids) {
      try {
        const n = BigInt(raw);
        if (n > maxId) maxId = n;
      } catch {
        // ignore malformed id entry
      }
    }
    if (maxId <= 0n) return postedHint;

    const next = { ...postedHint, bountyId: String(maxId) };
    writeJustPostedHint(next);
    return next;
  } catch {
    return postedHint;
  }
}
function shouldShowHintInCurrentFilters(postedHint, { category, status, search, skills }) {
  if (!postedHint?.bountyId) return false;
  if (Array.isArray(skills) && skills.length > 0) return false;

  const selectedCategory = String(category || 'all').toLowerCase();
  const selectedStatus = String(status || 'all').toLowerCase();
  const selectedSearch = String(search || '').trim().toLowerCase();

  if (selectedCategory !== 'all') {
    const hintCategory = String(postedHint.category || 'other').toLowerCase();
    if (hintCategory !== selectedCategory) return false;
  }

  // Newly posted bounty is ACTIVE.
  if (selectedStatus !== 'all' && selectedStatus !== 'active' && selectedStatus !== 'open') {
    return false;
  }

  if (selectedSearch) {
    const haystack = `${postedHint.title || ''} ${postedHint.category || ''}`.toLowerCase();
    if (!haystack.includes(selectedSearch)) return false;
  }

  return true;
}

function buildOptimisticBountyFromHint(postedHint, factoryCaps) {
  const bountyId = String(postedHint?.bountyId || '').trim();
  if (!bountyId) return null;

  let id = 0n;
  try {
    id = BigInt(bountyId);
  } catch {
    return null;
  }

  const createdAt = Math.floor((Number(postedHint.ts) || Date.now()) / 1000);
  return {
    id,
    creator: String(postedHint.creator || ''),
    ipfsHash: String(postedHint.metaCid || ''),
    metaCid: String(postedHint.metaCid || ''),
    title: String(postedHint.title || 'Untitled Bounty'),
    category: String(postedHint.category || 'other'),
    status: 0,
    totalReward: toBigIntSafe(postedHint.totalReward, 0n),
    winnerCount: 1,
    deadline: toBigIntSafe(postedHint.deadline, 0n),
    createdAt: toBigIntSafe(createdAt, id),
    featured: false,
    submissionCount: 0,
    requiresApplication: normalizeRequiresApplication(postedHint.requiresApplication, factoryCaps),
    _source: 'posted-hint',
  };
}

function matchesStatusFilter(bounty, status) {
  const selected = String(status || 'all').toLowerCase();
  const current = BigInt(bounty?.status ?? 0);

  if (selected === 'all') return true;
  if (selected === 'open') {
    return current === STATUS_MAP.active || current === STATUS_MAP.reviewing || current === STATUS_MAP.disputed;
  }
  if (selected === 'history') {
    return current === STATUS_MAP.completed || current === STATUS_MAP.expired || current === STATUS_MAP.cancelled;
  }

  const sv = STATUS_MAP[selected];
  return sv === undefined ? true : current === sv;
}
function ensurePostedHintVisible(items, postedHint, filters) {
  if (!postedHint?.bountyId) return { items, found: false };

  const hintId = String(postedHint.bountyId);
  const found = items.some((b) => String(b?.id ?? '') === hintId);
  if (found) return { items, found: true };

  if (!shouldShowHintInCurrentFilters(postedHint, filters)) {
    return { items, found: false };
  }

  const optimistic = buildOptimisticBountyFromHint(postedHint, filters?.factoryCaps);
  if (!optimistic) return { items, found: false };

  return { items: [optimistic, ...items], found: false };
}
function normalizeBountiesError(err) {
  const msg = err?.shortMessage || err?.reason || err?.message || 'Unknown error';
  if (err?.code === 'BAD_DATA' && /get(AllBounties|ActiveBounties|BountiesByCategory)/.test(msg)) {
    return 'Registry contract tidak cocok dengan RPC/network aktif. Periksa VITE_RPC_URL dan VITE_BOUNTY_REGISTRY_ADDRESS.';
  }
  return msg;
}

async function filterBySkills(items, skills) {
  if (skills.length === 0) return items;

  const loweredSkills = skills.map((s) => s.toLowerCase());
  const keepFlags = await Promise.all(
    items.map(async (b) => {
      const cid = b.metaCid || b.ipfsHash;
      if (!cid) return false;
      const meta = getCachedJSON(cid) || (await fetchJSON(cid));
      const bountySkills = Array.isArray(meta?.skills) ? meta.skills.map((s) => String(s).toLowerCase()) : [];
      return loweredSkills.some((s) => bountySkills.includes(s));
    })
  );

  return items.filter((_, i) => keepFlags[i]);
}

function normalizeSkills(skills) {
  if (!Array.isArray(skills)) return [];
  return skills.map((s) => String(s));
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

function normalizeRequiresApplication(value, factoryCaps) {
  return applyRequiresApplicationCompatibility(toBoolSafe(value, false), factoryCaps);
}

function normalizeRegistryBounty(row, factoryCaps) {
  const idRaw = getBountyId(row) ?? readBountyField(row, 'id', 0) ?? 0;
  const id = toBigIntSafe(idRaw, 0n);

  const ipfsHashRaw = readBountyField(row, 'ipfsHash', 2) ?? readBountyField(row, 'metaCid');
  const categoryRaw = readBountyField(row, 'category', 4);

  return {
    ...row,
    id,
    creator: toStringSafe(readBountyField(row, 'creator', 1), ''),
    ipfsHash: toStringSafe(ipfsHashRaw, ''),
    metaCid: toStringSafe(readBountyField(row, 'metaCid') ?? ipfsHashRaw, ''),
    title: toStringSafe(readBountyField(row, 'title', 3), ''),
    category: toStringSafe(categoryRaw, 'other'),
    status: toNumberSafe(readBountyField(row, 'status', 6), 0),
    totalReward: toBigIntSafe(readBountyField(row, 'totalReward', 9), 0n),
    winnerCount: toNumberSafe(readBountyField(row, 'winnerCount', 10), 1),
    deadline: toBigIntSafe(readBountyField(row, 'deadline', 12), 0n),
    createdAt: toBigIntSafe(readBountyField(row, 'createdAt', 13), id),
    featured: toBoolSafe(readBountyField(row, 'featured', 15), false),
    submissionCount: toNumberSafe(readBountyField(row, 'submissionCount', 16), 0),
    requiresApplication: normalizeRequiresApplication(readBountyField(row, 'requiresApplication', 19), factoryCaps),
  };
}
async function hydrateMissingPresentationFields(items) {
  const enriched = await Promise.all(
    items.map(async (b) => {
      const hasTitle = Boolean(String(b?.title || '').trim());
      const hasCategory = Boolean(String(b?.category || '').trim());
      const hasDescription = Boolean(String(b?.description || '').trim());
      if (hasTitle && hasCategory && hasDescription) return b;

      const cid = b?.metaCid || b?.ipfsHash || b?.metadataCID;
      if (!cid) return b;

      const meta = getCachedJSON(cid) || (await fetchJSON(cid));
      if (!meta) return b;

      return {
        ...b,
        title: hasTitle ? b.title : (meta.title || b.title || ''),
        category: hasCategory ? b.category : (meta.category || b.category || 'other'),
        description: hasDescription ? b.description : (meta.fullDescription || meta.description || b.description || ''),
      };
    })
  );
  return enriched;
}

function sortNewestFirst(items) {
  return items.sort((a, b) => {
    const aFeatured = a?.featured ? 1 : 0;
    const bFeatured = b?.featured ? 1 : 0;
    if (aFeatured !== bFeatured) return bFeatured - aFeatured;

    const aCreated = BigInt(a?.createdAt ?? a?.id ?? 0);
    const bCreated = BigInt(b?.createdAt ?? b?.id ?? 0);
    if (aCreated !== bCreated) return aCreated < bCreated ? 1 : -1;
    return 0;
  });
}

export function useBounties({ category = 'all', status = 'all', sort = 'newest', search = '', skills = [], page = 0 } = {}) {
  const [bounties, setBounties] = useState([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const retryTimerRef = useRef(null);
  const loadRef = useRef(null);
  const bountyCountRef = useRef(0);
  const inFlightRef = useRef(false);
  const queuedReloadRef = useRef(false);
  const transientEmptyRetryRef = useRef(0);

  const stableSkills = useMemo(() => {
    const raw = normalizeSkills(skills);
    return raw;
  }, [JSON.stringify(normalizeSkills(skills))]);

  const scheduleSoftRetry = useCallback(() => {
    if (retryTimerRef.current) return;
    retryTimerRef.current = setTimeout(() => {
      retryTimerRef.current = null;
      const fn = loadRef.current;
      if (fn) void fn();
    }, RETRY_DELAY_MS);
  }, []);

  const load = useCallback(async () => {
    if (inFlightRef.current) {
      queuedReloadRef.current = true;
      return;
    }

    inFlightRef.current = true;

    if (!ADDRESSES.registry && !ADDRESSES.factory) {
      setLoading(false);
      inFlightRef.current = false;
      return;
    }

    let resolvedRegistryAddress = ADDRESSES.registry || '';
    let keepLoading = false;
    let postedHint = null;
    try {
      postedHint = readJustPostedHint();
      if (postedHint?.posted && postedHint.ts !== lastJustPostedCacheBustTs) {
        clearSubgraphCache();
        clearRegistryResolutionCache();
        invalidateContractCache();
        lastJustPostedCacheBustTs = postedHint.ts;
      }
    } catch {
      postedHint = null;
    }
    try {
      setLoading(true);
      setError(null);
      const offset = page * LIMIT;
      const factoryCaps = await getFactoryCapabilities();
      const indexerConfigured = isIndexerConfigured();

      // Indexer path (preferred in this app to avoid registry mismatch + RPC limits).
      if (indexerConfigured && hasIndexer() && factoryCaps?.source !== 'default' && !factoryCaps?.openOnlyLegacy) {
        let query;
        let vars;

        if (category !== 'all') {
          query = GQL_GET_BOUNTIES_BY_CAT;
          vars = { category: category.toLowerCase(), skip: offset, first: LIMIT };
        } else if (status === 'active') {
          query = GQL_GET_ACTIVE_BOUNTIES;
          vars = { skip: offset, first: LIMIT };
        } else {
          query = GQL_GET_BOUNTIES;
          vars = { skip: offset, first: LIMIT };
        }

        const data = await querySubgraph(query, vars);
        if (data) {
          let items = data.bounties || [];
          // Normalize BigInt strings -> BigInt for existing sort/filter logic.
          items = items.map((b) => ({
            ...b,
            id: BigInt(b.id || '0'),
            createdAt: BigInt(b.createdAt || b.id || '0'),
            totalReward: BigInt(b.totalReward || '0'),
            deadline: BigInt(b.deadline || '0'),
            status: Number(b.status),
            featured: toBoolSafe(b.featured, false),
            requiresApplication: normalizeRequiresApplication(b.requiresApplication, factoryCaps),
          }));

          // Fast freshness fallback: merge first-page on-chain rows so newly posted bounty
          // can appear immediately even if indexer is still catching up.
          if (page === 0) {
            try {
              const resolved = await getResolvedRegistryContract();
              const reg = resolved.contract;
              if (reg) {
                postedHint = await hydratePostedHintIdFromCreator(reg, postedHint);
                const [rpcRows] = await reg.getAllBounties(0, LIMIT);
                const mergedMap = new Map(items.map((b) => [String(b.id), b]));
                for (const row of rpcRows || []) {
                  const normalized = normalizeRegistryBounty(row, factoryCaps);
                  const key = String(normalized.id);
                  if (!key || key === '0') continue;
                  const existing = mergedMap.get(key);
                  mergedMap.set(key, existing ? { ...existing, ...normalized } : normalized);
                }

                if (postedHint?.bountyId) {
                  try {
                    const postedRow = await reg.getBounty(BigInt(postedHint.bountyId));
                    const posted = normalizeRegistryBounty(postedRow, factoryCaps);
                    const key = String(posted.id);
                    if (key && key !== '0') {
                      mergedMap.set(key, posted);
                    }
                  } catch {
                    // non-fatal
                  }
                }

                items = Array.from(mergedMap.values());
              }
            } catch {
              // Non-fatal: keep indexer list if RPC is rate-limited/unavailable.
            }
          }

          if (status !== 'all') {
            items = items.filter((b) => matchesStatusFilter(b, status));
          }

          if (search.trim()) {
            const q = search.trim().toLowerCase();
            items = items.filter(
              (b) => (b.title || '').toLowerCase().includes(q) || (b.category || '').toLowerCase().includes(q)
            );
          }

          items = await filterBySkills(items, stableSkills);
          items = await hydrateMissingPresentationFields(items);

          if (sort === 'reward') items.sort((a, b) => (a.totalReward < b.totalReward ? 1 : -1));
          else if (sort === 'ending') items.sort((a, b) => (a.deadline < b.deadline ? -1 : 1));
          if (sort === 'newest') sortNewestFirst(items);

          const hintResult = page === 0
            ? ensurePostedHintVisible(items, postedHint, {
                category,
                status,
                search,
                skills: stableSkills,
                factoryCaps,
              })
            : { items, found: false };
          items = hintResult.items;

          const shouldRetryEmptyDefault =
            page === 0 &&
            category === 'all' &&
            (status === 'all' || status === 'open') &&
            !search.trim() &&
            stableSkills.length === 0 &&
            items.length === 0 &&
            transientEmptyRetryRef.current < TRANSIENT_EMPTY_RETRY_LIMIT;

          if (shouldRetryEmptyDefault) {
            transientEmptyRetryRef.current += 1;
            keepLoading = true;
            scheduleSoftRetry();
            return;
          }

          if (items.length > 0) {
            transientEmptyRetryRef.current = 0;
          }

          if (hintResult.found || (postedHint?.posted && !postedHint.bountyId)) {
            clearJustPostedHint();
          }

          setBounties(items);
          setTotal(items.length);
          setHasMore(items.length >= LIMIT);
          return;
        }

        // Subgraph temporarily unavailable: keep previous state and avoid noisy RPC fallback.
        if (import.meta.env.DEV) {
          console.warn('[useBounties] subgraph unavailable, keeping previous list state');
        }

        // First-load guard: do not show "0 results" flicker; keep loading and retry shortly.
        if (bountyCountRef.current === 0) {
          keepLoading = true;
          scheduleSoftRetry();
        }
        return;
      }

      // RPC path is used when indexer is unavailable or right after a successful post.
      const resolved = await getResolvedRegistryContract();
      resolvedRegistryAddress = resolved.address || resolvedRegistryAddress;
      const reg = resolved.contract;

      if (!reg) {
        setBounties([]);
        setTotal(0);
        setHasMore(false);
        return;
      }

      postedHint = await hydratePostedHintIdFromCreator(reg, postedHint);

      let result;
      let totalCount;

      const rpcWindow = postedHint && page === 0 ? LIMIT * 3 : LIMIT;

      if (category !== 'all') {
        [result, totalCount] = await reg.getBountiesByCategory(category, offset, LIMIT);
      } else if (status === 'active') {
        [result, totalCount] = await reg.getActiveBounties(offset, LIMIT);
      } else {
        [result, totalCount] = await reg.getAllBounties(offset, rpcWindow);
      }

      result = (result || []).map((row) => normalizeRegistryBounty(row, factoryCaps));
      if (postedHint?.bountyId && page === 0) {
        try {
          const postedRow = await reg.getBounty(BigInt(postedHint.bountyId));
          const posted = normalizeRegistryBounty(postedRow, factoryCaps);
          const key = String(posted.id || '');
          if (key && key !== '0') {
            const byId = new Map(result.map((b) => [String(b.id), b]));
            byId.set(key, posted);
            result = Array.from(byId.values());
          }
        } catch {
          // non-fatal: list still uses regular RPC/indexer rows
        }
      }
      let filtered = [...result];

      // Always apply status client-side so category+status combinations work correctly.
      if (status !== 'all') {
        filtered = filtered.filter((b) => matchesStatusFilter(b, status));
      }

      if (search.trim()) {
        const q = search.trim().toLowerCase();
        filtered = filtered.filter((b) => {
          const titleMatch = (b.title || '').toLowerCase().includes(q);
          const catMatch = (b.category || '').toLowerCase().includes(q);
          return titleMatch || catMatch;
        });
      }

      filtered = await filterBySkills(filtered, stableSkills);
      filtered = await hydrateMissingPresentationFields(filtered);

      if (sort === 'reward') {
        filtered.sort((a, b) => (a.totalReward < b.totalReward ? 1 : a.totalReward > b.totalReward ? -1 : 0));
      } else if (sort === 'ending') {
        filtered.sort((a, b) => (a.deadline < b.deadline ? -1 : a.deadline > b.deadline ? 1 : 0));
      }

      // Featured bounties bubble to top only on default sort.
      if (sort === 'newest') {
        sortNewestFirst(filtered);
      }

      const hintResult = page === 0
        ? ensurePostedHintVisible(filtered, postedHint, {
            category,
            status,
            search,
            skills: stableSkills,
                factoryCaps,
              })
        : { items: filtered, found: false };
      filtered = hintResult.items;
      if (hintResult.found || (postedHint?.posted && !postedHint.bountyId)) {
        clearJustPostedHint();
      }

      setBounties(filtered);

      const serverTotal = Number(totalCount);
      if ((status !== 'all' && status !== 'active' && status !== 'open') || search.trim() || stableSkills.length > 0) {
        setTotal(filtered.length);
        setHasMore(result.length === LIMIT); // more pages might still have matches
      } else {
        setTotal(serverTotal);
        setHasMore(offset + LIMIT < serverTotal);
      }
    } catch (err) {
      const msg = normalizeBountiesError(err);
      const isExpectedRpcNoise = /429|Too Many Requests|missing revert data|could not decode result data|could not coalesce error|Registry: not found/i.test(String(msg));

      if (String(msg).includes('429')) {
        invalidateContractCache(resolvedRegistryAddress || ADDRESSES.registry);
      }

      if (!isExpectedRpcNoise && import.meta.env.DEV) {
        console.error('[useBounties]', err);
      }
      setError(isExpectedRpcNoise ? null : msg);

      if (isExpectedRpcNoise && bountyCountRef.current === 0) {
        keepLoading = true;
        scheduleSoftRetry();
      }
    } finally {
      inFlightRef.current = false;
      if (queuedReloadRef.current) {
        queuedReloadRef.current = false;
        const fn = loadRef.current;
        if (fn) {
          void fn();
          return;
        }
      }

      if (!keepLoading) {
        setLoading(false);
      }
    }
  }, [category, status, sort, search, stableSkills, page, scheduleSoftRetry]);

  useEffect(() => {
    loadRef.current = load;
  }, [load]);

  useEffect(() => {
    bountyCountRef.current = bounties.length;
  }, [bounties.length]);

  useEffect(() => {
    transientEmptyRetryRef.current = 0;
  }, [category, status, search, stableSkills, page]);

  useEffect(() => {
    let alive = true;

    const doLoad = async () => {
      if (!alive) return;
      await load();
    };

    doLoad();

    let intervalId = null;

    const startPolling = () => {
      if (intervalId) return;
      intervalId = setInterval(() => {
        if (!document.hidden) doLoad();
      }, 45000);
    };

    const stopPolling = () => {
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
    };

    const handleVisibility = () => {
      if (document.hidden) {
        stopPolling();
      } else {
        doLoad();
        startPolling();
      }
    };

    startPolling();
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      alive = false;
      stopPolling();
      document.removeEventListener('visibilitychange', handleVisibility);
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
    };
  }, [load]);

  return { bounties, total, hasMore, loading, error, refetch: load };
}















