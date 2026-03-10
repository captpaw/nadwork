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

// RPC: VITE_RPC_URL overrides all. VITE_USE_TESTNET=1 -> testnet endpoints.
// In dev, use Vite proxy to bypass CORS (VITE_USE_RPC_PROXY=1 or default in DEV).
const _customRpc = import.meta.env.VITE_RPC_URL?.trim() || '';
const _useTestnet = !!import.meta.env.VITE_USE_TESTNET;
const _useProxy = import.meta.env.DEV && (import.meta.env.VITE_USE_RPC_PROXY !== '0');
const _proxyBase = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';

const _directUrls = _customRpc
  ? [_customRpc, 'https://rpc1.monad.xyz', 'https://rpc2.monad.xyz', 'https://monad-mainnet.drpc.org', 'https://rpc.monad.xyz']
  : _useTestnet
    ? ['https://testnet-rpc.monad.xyz', 'https://rpc-testnet.monadinfra.com', 'https://monad-testnet.drpc.org']
    : [
        'https://rpc1.monad.xyz',
        'https://rpc2.monad.xyz',
        'https://monad-mainnet.drpc.org',
        'https://rpc-mainnet.monadinfra.com',
        'https://rpc.monad.xyz',
        'https://rpc3.monad.xyz',
      ];

// In dev with proxy: use single proxy URL to avoid CORS. Otherwise use direct URLs.
const RPC_URLS = (_useProxy ? [`${_proxyBase}/rpc-proxy`] : []).concat(_directUrls);

// Rate limit: backoff after 429 to allow recovery
const RATE_LIMIT_BACKOFF_MS = 60_000;
const RPC_PROBE_TTL_MS = 30_000;

const _rateLimitedUntil = new Map();
function isRateLimited(url) {
  const until = _rateLimitedUntil.get(url);
  return until && Date.now() < until;
}
function markRateLimited(url) {
  _rateLimitedUntil.set(url, Date.now() + RATE_LIMIT_BACKOFF_MS);
}

// Reuse provider instances per RPC URL to avoid repeated network detection handshakes.
const _providerCache = new Map();
const _providerProbeTs = new Map();
const _providerProbeOk = new Map();
const _providerProbeInFlight = new Map();

function getCachedProvider(url) {
  const key = String(url || '');
  const existing = _providerCache.get(key);
  if (existing) return existing;
  const next = new ethers.JsonRpcProvider(key);
  _providerCache.set(key, next);
  return next;
}

async function probeProvider(url) {
  const key = String(url || '');
  if (isRateLimited(key)) return false;

  const now = Date.now();
  const lastTs = _providerProbeTs.get(key) || 0;
  if (now - lastTs < RPC_PROBE_TTL_MS) {
    return _providerProbeOk.get(key) !== false;
  }

  const inFlight = _providerProbeInFlight.get(key);
  if (inFlight) return inFlight;

  const probe = (async () => {
    const provider = getCachedProvider(key);
    try {
      await provider.getBlockNumber();
      _providerProbeOk.set(key, true);
      return true;
    } catch (e) {
      _providerProbeOk.set(key, false);
      if (e?.message?.includes('429') || e?.status === 429) markRateLimited(key);
      return false;
    } finally {
      _providerProbeTs.set(key, Date.now());
      _providerProbeInFlight.delete(key);
    }
  })();

  _providerProbeInFlight.set(key, probe);
  return probe;
}

// Contract instance cache - 2min TTL to reduce RPC calls
const CACHE_TTL_MS = 120_000;
const _contractCache = new Map();
const _inFlight = new Map(); // dedupe concurrent requests for same contract + ABI

function abiKey(abi) {
  if (!Array.isArray(abi)) return String(abi || '');
  return abi.join('|');
}

function cacheKey(address, abi) {
  return `${String(address).toLowerCase()}::${abiKey(abi)}`;
}

export function getReadContract(address, abi, rpcUrl) {
  const url = rpcUrl || RPC_URLS[0];
  const provider = getCachedProvider(url);
  return new ethers.Contract(address, abi, provider);
}

/** Get read-only contract with fallback RPCs. Dedupes concurrent calls to avoid 429. */
export async function getReadContractWithFallback(address, abi) {
  const key = cacheKey(address, abi);
  const cached = _contractCache.get(key);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.contract;
  }

  let pending = _inFlight.get(key);
  if (pending) return pending;

  pending = (async () => {
    const candidates = RPC_URLS.filter((u) => !isRateLimited(u));
    const urls = candidates.length > 0 ? candidates : RPC_URLS;

    for (const url of urls) {
      const healthy = await probeProvider(url);
      if (!healthy) continue;

      try {
        const provider = getCachedProvider(url);
        const contract = new ethers.Contract(address, abi, provider);
        _contractCache.set(key, { contract, expiresAt: Date.now() + CACHE_TTL_MS });
        return contract;
      } catch (e) {
        if (e?.message?.includes('429') || e?.status === 429) markRateLimited(url);
      }
    }

    const fallbackUrl = RPC_URLS.find((u) => !isRateLimited(u)) || RPC_URLS[0];
    const provider = getCachedProvider(fallbackUrl);
    const contract = new ethers.Contract(address, abi, provider);
    _contractCache.set(key, { contract, expiresAt: Date.now() + CACHE_TTL_MS });
    return contract;
  })();

  _inFlight.set(key, pending);
  try {
    return await pending;
  } finally {
    _inFlight.delete(key);
  }
}

/** Fast read contract - uses cached instance when possible to avoid extra RPC. */
export function getReadContractFast(address, abi) {
  const key = cacheKey(address, abi);
  const cached = _contractCache.get(key);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.contract;
  }
  const url = RPC_URLS.find((u) => !isRateLimited(u)) || RPC_URLS[0];
  const provider = getCachedProvider(url);
  const contract = new ethers.Contract(address, abi, provider);
  _contractCache.set(key, { contract, expiresAt: Date.now() + CACHE_TTL_MS });
  return contract;
}

/** Invalidate cache on 429 so next call tries fresh provider. Call from catch blocks. */
export function invalidateContractCache(address) {
  if (!address) {
    _contractCache.clear();
    _inFlight.clear();
    _providerProbeTs.clear();
    _providerProbeOk.clear();
    _providerProbeInFlight.clear();
    return;
  }

  const prefix = `${String(address).toLowerCase()}::`;
  for (const key of _contractCache.keys()) {
    if (key.startsWith(prefix)) _contractCache.delete(key);
  }
  for (const key of _inFlight.keys()) {
    if (key.startsWith(prefix)) _inFlight.delete(key);
  }
}
