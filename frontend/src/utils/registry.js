import { ethers } from 'ethers';
import { ADDRESSES, REGISTRY_ABI } from '@/config/contracts.js';
import { getReadContractWithFallback } from '@/utils/ethers.js';
import { getBountyId, readBountyField } from '@/utils/orbital.mjs';

const FACTORY_REGISTRY_ABI = ['function registry() view returns (address)'];
const REGISTRY_PROBE_ABI = ['function bountyCount() view returns (uint256)'];
const RESOLVE_TTL_MS = 300_000;

const CREATOR_IDS_CACHE_TTL_MS = 60_000;
const CREATOR_IDS_MAX_SCAN = 1200;
const CREATOR_IDS_CHUNK = 100;

let resolvedRegistryAddress = '';
let resolvedUntil = 0;
let resolveInFlight = null;
const creatorIdsCache = new Map();

function isAddress(value) {
  try {
    return ethers.isAddress(value);
  } catch {
    return false;
  }
}

function normalizeAddress(value) {
  try {
    return String(value || '').trim().toLowerCase();
  } catch {
    return '';
  }
}

function toNormalizedId(value) {
  try {
    return String(BigInt(value));
  } catch {
    return '';
  }
}

function getCacheKey(registryAddress, creator) {
  return `${normalizeAddress(registryAddress)}:${normalizeAddress(creator)}`;
}

function readCreatorIdsCache(registryAddress, creator) {
  const key = getCacheKey(registryAddress, creator);
  const row = creatorIdsCache.get(key);
  if (!row) return null;
  if (Date.now() - row.ts > CREATOR_IDS_CACHE_TTL_MS) {
    creatorIdsCache.delete(key);
    return null;
  }
  return Array.isArray(row.ids) ? row.ids : null;
}

function writeCreatorIdsCache(registryAddress, creator, ids) {
  const key = getCacheKey(registryAddress, creator);
  creatorIdsCache.set(key, { ts: Date.now(), ids: Array.isArray(ids) ? ids : [] });
}

function uniqueIds(ids) {
  const seen = new Set();
  const out = [];
  for (const raw of Array.isArray(ids) ? ids : []) {
    const id = toNormalizedId(raw);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

function extractCreatorFromRow(row) {
  return normalizeAddress(readBountyField(row, 'creator', 1));
}

function extractIdFromRow(row) {
  const idRaw = getBountyId(row) ?? readBountyField(row, 'id', 0);
  return toNormalizedId(idRaw);
}

function collectCreatorIdsFromRows(rows, creator) {
  const creatorLower = normalizeAddress(creator);
  const ids = [];
  for (const row of Array.isArray(rows) ? rows : []) {
    if (extractCreatorFromRow(row) !== creatorLower) continue;
    const id = extractIdFromRow(row);
    if (!id) continue;
    ids.push(id);
  }
  return uniqueIds(ids);
}

async function isReadableRegistry(address) {
  if (!isAddress(address)) return false;
  try {
    const probe = await getReadContractWithFallback(address, REGISTRY_PROBE_ABI);
    await probe.bountyCount();
    return true;
  } catch {
    return false;
  }
}

async function getRegistryFromFactory(factoryAddress) {
  if (!isAddress(factoryAddress)) return '';
  try {
    const factory = await getReadContractWithFallback(factoryAddress, FACTORY_REGISTRY_ABI);
    const registryAddress = await factory.registry();
    return isAddress(registryAddress) ? registryAddress : '';
  } catch {
    return '';
  }
}

async function scanCreatorBountiesFromAll(registryContract, creator) {
  const creatorLower = normalizeAddress(creator);
  if (!creatorLower) return [];

  const totalRaw = await registryContract.bountyCount().catch(() => 0n);
  const total = Number(totalRaw);
  if (!Number.isFinite(total) || total <= 0) return [];

  const capped = Math.min(total, CREATOR_IDS_MAX_SCAN);
  const offsetStart = total > capped ? total - capped : 0;

  let out = [];
  for (let offset = offsetStart; offset < total; offset += CREATOR_IDS_CHUNK) {
    const size = Math.min(CREATOR_IDS_CHUNK, total - offset);
    const [rows] = await registryContract.getAllBounties(offset, size);
    out = out.concat(collectCreatorIdsFromRows(rows, creatorLower));
  }

  const uniq = uniqueIds(out);
  uniq.sort((a, b) => {
    try {
      return BigInt(b) > BigInt(a) ? 1 : (BigInt(b) < BigInt(a) ? -1 : 0);
    } catch {
      return 0;
    }
  });
  return uniq;
}

export async function resolveRegistryAddress() {
  if (resolvedRegistryAddress && Date.now() < resolvedUntil) {
    return resolvedRegistryAddress;
  }
  if (resolveInFlight) return resolveInFlight;

  resolveInFlight = (async () => {
    const candidates = [];
    if (isAddress(ADDRESSES.registry)) candidates.push(ADDRESSES.registry);

    const fromFactory = await getRegistryFromFactory(ADDRESSES.factory);
    if (isAddress(fromFactory)) candidates.push(fromFactory);

    for (const candidate of [...new Set(candidates)]) {
      if (await isReadableRegistry(candidate)) {
        resolvedRegistryAddress = candidate;
        resolvedUntil = Date.now() + RESOLVE_TTL_MS;
        return candidate;
      }
    }

    const fallback = candidates[0] || '';
    resolvedRegistryAddress = fallback;
    resolvedUntil = Date.now() + RESOLVE_TTL_MS;
    return fallback;
  })();

  try {
    return await resolveInFlight;
  } finally {
    resolveInFlight = null;
  }
}

export async function getResolvedRegistryContract() {
  const address = await resolveRegistryAddress();
  if (!address) return { address: '', contract: null };
  const contract = await getReadContractWithFallback(address, REGISTRY_ABI);
  return { address, contract };
}

export async function listCreatorBountyIds(registryContract, creator) {
  if (!registryContract || !creator) return [];

  const registryAddress = registryContract?.target || resolvedRegistryAddress || ADDRESSES.registry || '';
  const cached = readCreatorIdsCache(registryAddress, creator);
  if (cached) return cached;

  let ids = [];

  if (typeof registryContract.getCreatorBounties === 'function') {
    try {
      const onchain = await registryContract.getCreatorBounties(creator);
      ids = uniqueIds(onchain);
      writeCreatorIdsCache(registryAddress, creator, ids);
      return ids;
    } catch {
      // fall back to full scan below
    }
  }

  try {
    ids = await scanCreatorBountiesFromAll(registryContract, creator);
  } catch {
    ids = [];
  }

  writeCreatorIdsCache(registryAddress, creator, ids);
  return ids;
}

export function clearRegistryResolutionCache() {
  resolvedRegistryAddress = '';
  resolvedUntil = 0;
  creatorIdsCache.clear();
}
