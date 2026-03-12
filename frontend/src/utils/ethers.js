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
// In dev browser, prefer Vite proxy-only to bypass CORS reliably.
const _customRpc = import.meta.env.VITE_RPC_URL?.trim() || '';
const _useTestnet = !!import.meta.env.VITE_USE_TESTNET;
const _useProxy = import.meta.env.DEV && (import.meta.env.VITE_USE_RPC_PROXY !== '0');
const _proxyBase = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
const _customFallbackRaw = import.meta.env.VITE_RPC_FALLBACK_URLS || '';

const _mainnetDefaults = [
  'https://rpc1.monad.xyz',
  'https://rpc2.monad.xyz',
  'https://monad-mainnet.drpc.org',
  'https://rpc-mainnet.monadinfra.com',
  'https://rpc.monad.xyz',
  'https://rpc3.monad.xyz',
];
const _testnetDefaults = [
  'https://testnet-rpc.monad.xyz',
  'https://rpc-testnet.monadinfra.com',
  'https://monad-testnet.drpc.org',
];
const _fallbackFromEnv = String(_customFallbackRaw)
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

function dedupeUrls(urls) {
  const seen = new Set();
  const out = [];
  for (const url of urls) {
    const key = String(url || '').trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(key);
  }
  return out;
}

const _directUrls = _customRpc
  ? dedupeUrls([_customRpc, ..._fallbackFromEnv, ..._mainnetDefaults])
  : dedupeUrls([...( _useTestnet ? _testnetDefaults : _mainnetDefaults), ..._fallbackFromEnv]);

// In dev browser with proxy enabled, use proxy-only to avoid direct CORS failures and noisy retries.
const _proxyOnlyInBrowserDev = _useProxy && typeof window !== 'undefined';
const RPC_URLS = _proxyOnlyInBrowserDev ? [`${_proxyBase}/rpc-proxy`] : _directUrls;

const RATE_LIMIT_BACKOFF_MS = 120_000;
const TRANSIENT_ERROR_BACKOFF_MS = 20_000;
const OTHER_ERROR_BACKOFF_MS = 8_000;
const RPC_PROBE_TTL_MS = 30_000;
const RPC_PROBE_TIMEOUT_MS = 4_500;
const ACTIVE_RPC_TTL_MS = 45_000;
const MAX_FAILURE_SCORE = 8;

const _endpointState = new Map();
let _activeRpcUrl = '';
let _activeRpcUntil = 0;

function _getEndpointState(url) {
  const key = String(url || '');
  let row = _endpointState.get(key);
  if (!row) {
    row = {
      cooldownUntil: 0,
      failureScore: 0,
      lastLatencyMs: 0,
      lastSuccessTs: 0,
      lastErrorTs: 0,
      lastErrorType: '',
    };
    _endpointState.set(key, row);
  }
  return row;
}

function isEndpointCooling(url) {
  const row = _endpointState.get(String(url || ''));
  if (!row) return false;
  return row.cooldownUntil > Date.now();
}

function setActiveRpc(url) {
  _activeRpcUrl = String(url || '');
  _activeRpcUntil = Date.now() + ACTIVE_RPC_TTL_MS;
}

function markEndpointSuccess(url, latencyMs = 0) {
  const row = _getEndpointState(url);
  row.failureScore = 0;
  row.cooldownUntil = 0;
  row.lastLatencyMs = Number.isFinite(latencyMs) ? Number(latencyMs) : 0;
  row.lastSuccessTs = Date.now();
  row.lastErrorType = '';
  setActiveRpc(url);
}

function classifyRpcError(err) {
  const msg = String(err?.shortMessage || err?.reason || err?.message || '').toLowerCase();
  if (err?.status === 429 || msg.includes('429') || msg.includes('too many requests')) return 'rate_limit';
  if (msg.includes('timeout') || msg.includes('aborted') || msg.includes('network') || msg.includes('failed to fetch')) return 'transient';
  return 'other';
}

function markEndpointFailure(url, err) {
  const row = _getEndpointState(url);
  row.lastErrorTs = Date.now();
  row.lastErrorType = classifyRpcError(err);
  row.failureScore = Math.min(MAX_FAILURE_SCORE, row.failureScore + 1);

  if (row.lastErrorType === 'rate_limit') {
    row.cooldownUntil = Date.now() + RATE_LIMIT_BACKOFF_MS;
    return;
  }
  if (row.lastErrorType === 'transient') {
    row.cooldownUntil = Date.now() + TRANSIENT_ERROR_BACKOFF_MS;
    return;
  }
  row.cooldownUntil = Date.now() + OTHER_ERROR_BACKOFF_MS;
}

function getCandidateRpcUrls() {
  const now = Date.now();
  const activeValid = _activeRpcUrl && _activeRpcUntil > now && !isEndpointCooling(_activeRpcUrl);
  const deduped = dedupeUrls(RPC_URLS);
  const available = deduped.filter((u) => !isEndpointCooling(u));
  const cooling = deduped.filter((u) => isEndpointCooling(u));

  available.sort((a, b) => {
    if (activeValid && a === _activeRpcUrl) return -1;
    if (activeValid && b === _activeRpcUrl) return 1;

    const sa = _getEndpointState(a);
    const sb = _getEndpointState(b);
    if (sa.failureScore !== sb.failureScore) return sa.failureScore - sb.failureScore;
    if (sa.lastSuccessTs !== sb.lastSuccessTs) return sb.lastSuccessTs - sa.lastSuccessTs;
    return 0;
  });

  return available.length > 0 ? available : cooling;
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
  if (isEndpointCooling(key)) return false;

  const now = Date.now();
  const lastTs = _providerProbeTs.get(key) || 0;
  if (now - lastTs < RPC_PROBE_TTL_MS) {
    return _providerProbeOk.get(key) !== false;
  }

  const inFlight = _providerProbeInFlight.get(key);
  if (inFlight) return inFlight;

  const probe = (async () => {
    const provider = getCachedProvider(key);
    const startedAt = Date.now();
    try {
      await Promise.race([
        provider.getBlockNumber(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('RPC probe timeout')), RPC_PROBE_TIMEOUT_MS)),
      ]);
      _providerProbeOk.set(key, true);
      markEndpointSuccess(key, Date.now() - startedAt);
      return true;
    } catch (e) {
      _providerProbeOk.set(key, false);
      markEndpointFailure(key, e);
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
  const url = rpcUrl || getCandidateRpcUrls()[0] || RPC_URLS[0];
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
    const urls = getCandidateRpcUrls();

    for (const url of urls) {
      const healthy = await probeProvider(url);
      if (!healthy) continue;

      try {
        const provider = getCachedProvider(url);
        const contract = new ethers.Contract(address, abi, provider);
        _contractCache.set(key, { contract, expiresAt: Date.now() + CACHE_TTL_MS });
        setActiveRpc(url);
        return contract;
      } catch (e) {
        markEndpointFailure(url, e);
      }
    }

    const fallbackUrl = getCandidateRpcUrls()[0] || RPC_URLS[0];
    const provider = getCachedProvider(fallbackUrl);
    const contract = new ethers.Contract(address, abi, provider);
    _contractCache.set(key, { contract, expiresAt: Date.now() + CACHE_TTL_MS });
    setActiveRpc(fallbackUrl);
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
  const url = getCandidateRpcUrls()[0] || RPC_URLS[0];
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
    _endpointState.clear();
    _activeRpcUrl = '';
    _activeRpcUntil = 0;
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

export function getRpcHealthSnapshot() {
  return getCandidateRpcUrls().map((url) => {
    const row = _getEndpointState(url);
    return {
      url,
      active: _activeRpcUrl === url && _activeRpcUntil > Date.now(),
      cooling: row.cooldownUntil > Date.now(),
      cooldownUntil: row.cooldownUntil,
      failureScore: row.failureScore,
      lastLatencyMs: row.lastLatencyMs,
      lastSuccessTs: row.lastSuccessTs,
      lastErrorTs: row.lastErrorTs,
      lastErrorType: row.lastErrorType,
    };
  });
}
