import { ethers } from 'ethers';

export async function walletClientToSigner(walletClient) {
  const { account, chain, transport } = walletClient;
  const network = { chainId: chain.id, name: chain.name, ensAddress: chain.contracts?.ensRegistry?.address };
  const provider = new ethers.BrowserProvider(transport, network);
  return await provider.getSigner(account.address);
}

export async function getContract(address, abi, walletClient) {
  const signer = await walletClientToSigner(walletClient);
  return new ethers.Contract(address, abi, signer);
}

// RPC fallbacks — more endpoints reduce 429 rate-limit impact
const RPC_URLS = [
  import.meta.env.VITE_RPC_URL || 'https://rpc.monad.xyz',
  'https://rpc.monad.xyz',
  'https://rpc1.monad.xyz',
  'https://rpc2.monad.xyz',
  'https://rpc3.monad.xyz',
  'https://rpc-mainnet.monadinfra.com',
  'https://monad-mainnet.drpc.org',
].filter((url, idx, arr) => arr.indexOf(url) === idx);

// Rate limit: longer backoff to avoid hammering after 429
const RATE_LIMIT_BACKOFF_MS = 60_000;

const _rateLimitedUntil = new Map();
function isRateLimited(url) {
  const until = _rateLimitedUntil.get(url);
  return until && Date.now() < until;
}
function markRateLimited(url) {
  _rateLimitedUntil.set(url, Date.now() + RATE_LIMIT_BACKOFF_MS);
}

// Contract instance cache — reduces RPC calls (no new provider per request)
const CACHE_TTL_MS = 60_000;
const _contractCache = new Map();

function cacheKey(address) {
  return String(address).toLowerCase();
}

export function getReadContract(address, abi, rpcUrl) {
  const url = rpcUrl || RPC_URLS[0];
  const provider = new ethers.JsonRpcProvider(url);
  return new ethers.Contract(address, abi, provider);
}

/** Get read-only contract with fallback RPCs. Caches instances to reduce 429s. */
export async function getReadContractWithFallback(address, abi) {
  const key = cacheKey(address);
  const cached = _contractCache.get(key);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.contract;
  }

  const candidates = RPC_URLS.filter(u => !isRateLimited(u));
  const urls = candidates.length > 0 ? candidates : RPC_URLS;

  for (const url of urls) {
    try {
      const provider = new ethers.JsonRpcProvider(url);
      await provider.getBlockNumber(); // minimal probe; only on cache miss (~1/min per contract)
      const contract = new ethers.Contract(address, abi, provider);
      _contractCache.set(key, { contract, expiresAt: Date.now() + CACHE_TTL_MS });
      return contract;
    } catch (e) {
      if (e?.message?.includes('429') || e?.status === 429) markRateLimited(url);
    }
  }

  const fallbackUrl = RPC_URLS.find(u => !isRateLimited(u)) || RPC_URLS[0];
  const provider = new ethers.JsonRpcProvider(fallbackUrl);
  const contract = new ethers.Contract(address, abi, provider);
  _contractCache.set(key, { contract, expiresAt: Date.now() + CACHE_TTL_MS });
  return contract;
}

/** Fast read contract — uses cached instance when possible to avoid extra RPC. */
export function getReadContractFast(address, abi) {
  const key = cacheKey(address);
  const cached = _contractCache.get(key);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.contract;
  }
  const url = RPC_URLS.find(u => !isRateLimited(u)) || RPC_URLS[0];
  const provider = new ethers.JsonRpcProvider(url);
  const contract = new ethers.Contract(address, abi, provider);
  _contractCache.set(key, { contract, expiresAt: Date.now() + CACHE_TTL_MS });
  return contract;
}

/** Invalidate cache on 429 so next call tries fresh provider. Call from catch blocks. */
export function invalidateContractCache(address) {
  if (address) _contractCache.delete(cacheKey(address));
  else _contractCache.clear();
}
