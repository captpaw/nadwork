import { ADDRESSES } from '@/config/contracts.js';
import { getReadContractWithFallback } from '@/utils/ethers.js';

const FACTORY_PROBE_ABI = ['function owner() view returns (address)'];
const CAPS_CACHE_KEY_PREFIX = 'nw_factory_caps_v1';
const CAPS_TTL_MS = 10 * 60 * 1000;

const CREATE_V4_SELECTOR = 'df298eb0';
const CREATE_V3_SELECTOR = 'af43e504';
const APPLY_SELECTOR = '1454f6da';
const GET_BUILDER_APPLICATIONS_SELECTOR = '31ef3ecc';
const GET_BOUNTY_APPLICATIONS_SELECTOR = 'd23f56cd';
const APPROVE_APPLICATION_SELECTOR = '13efe858';
const REJECT_APPLICATION_SELECTOR = 'ca5e3077';
const KNOWN_OPEN_ONLY_FACTORIES = new Set([
  '0x7c3b1a549cb9e630ca4a00a292422f349d7711e3',
]);

const DEFAULT_CAPS = Object.freeze({
  supportsCreateV4: true,
  supportsCreateV3: true,
  supportsApplications: true,
  openOnlyLegacy: false,
  source: 'default',
  ts: 0,
});

let memoryCaps = null;
let memoryCapsUntil = 0;
let memoryCapsAddress = '';
let inFlight = null;

function safeParse(json) {
  try {
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function normalizeAddress(value) {
  if (!value) return '';
  try {
    return String(value).trim().toLowerCase();
  } catch {
    return '';
  }
}

function getCapsCacheKey(factoryAddress) {
  return `${CAPS_CACHE_KEY_PREFIX}:${normalizeAddress(factoryAddress) || 'unknown'}`;
}

function normalizeCaps(raw) {
  if (!raw || typeof raw !== 'object') return null;

  const supportsCreateV4 = Boolean(raw.supportsCreateV4);
  const supportsCreateV3 = Boolean(raw.supportsCreateV3);
  const openOnlyLegacy = Boolean(raw.openOnlyLegacy);
  const supportsApplications = raw.supportsApplications == null
    ? !openOnlyLegacy
    : Boolean(raw.supportsApplications);
  const ts = Number(raw.ts) || Date.now();

  return {
    supportsCreateV4,
    supportsCreateV3,
    supportsApplications,
    openOnlyLegacy,
    source: String(raw.source || 'cache'),
    ts,
  };
}

function readCachedCaps(factoryAddress) {
  if (typeof sessionStorage === 'undefined') return null;
  const cacheKey = getCapsCacheKey(factoryAddress);
  const parsed = safeParse(sessionStorage.getItem(cacheKey) || '');
  const caps = normalizeCaps(parsed);
  if (!caps) return null;
  if (Date.now() - caps.ts > CAPS_TTL_MS) return null;
  return caps;
}

function writeCachedCaps(factoryAddress, caps) {
  const normalized = normalizeCaps(caps);
  if (!normalized) return;

  const normalizedAddress = normalizeAddress(factoryAddress);
  memoryCaps = normalized;
  memoryCapsUntil = Date.now() + CAPS_TTL_MS;
  memoryCapsAddress = normalizedAddress;

  if (typeof sessionStorage === 'undefined') return;
  try {
    sessionStorage.setItem(getCapsCacheKey(factoryAddress), JSON.stringify(normalized));
  } catch {
    // ignore storage errors
  }
}

function hasSelector(code, selectorHexNoPrefix) {
  if (!code) return false;
  return String(code).toLowerCase().includes(String(selectorHexNoPrefix).toLowerCase());
}

function capsFromKnownAddress(address) {
  const normalized = normalizeAddress(address);
  if (!normalized) return null;
  if (!KNOWN_OPEN_ONLY_FACTORIES.has(normalized)) return null;
  return {
    supportsCreateV4: false,
    supportsCreateV3: true,
    supportsApplications: false,
    openOnlyLegacy: true,
    source: 'known-address',
    ts: Date.now(),
  };
}

function capsFromBytecode(code) {
  const supportsCreateV4 = hasSelector(code, CREATE_V4_SELECTOR);
  const supportsCreateV3 = hasSelector(code, CREATE_V3_SELECTOR);
  const supportsApplications = [
    APPLY_SELECTOR,
    GET_BUILDER_APPLICATIONS_SELECTOR,
    GET_BOUNTY_APPLICATIONS_SELECTOR,
    APPROVE_APPLICATION_SELECTOR,
    REJECT_APPLICATION_SELECTOR,
  ].some((selector) => hasSelector(code, selector));

  return {
    supportsCreateV4,
    supportsCreateV3,
    supportsApplications,
    openOnlyLegacy: !supportsCreateV4 && supportsCreateV3,
    source: 'bytecode',
    ts: Date.now(),
  };
}

export function applyRequiresApplicationCompatibility(value, caps) {
  if (caps?.openOnlyLegacy || caps?.supportsApplications === false) return false;
  return Boolean(value);
}

export async function getFactoryCapabilities(force = false) {
  const factoryAddress = ADDRESSES.factory;
  if (!factoryAddress) return DEFAULT_CAPS;

  const knownCaps = capsFromKnownAddress(factoryAddress);
  if (knownCaps) {
    // Known deployment map always wins over stale session cache.
    writeCachedCaps(factoryAddress, knownCaps);
    return knownCaps;
  }

  const normalizedAddress = normalizeAddress(factoryAddress);

  if (!force && memoryCaps && Date.now() < memoryCapsUntil && memoryCapsAddress === normalizedAddress) {
    return memoryCaps;
  }

  if (!force) {
    const cached = readCachedCaps(factoryAddress);
    if (cached) {
      memoryCaps = cached;
      memoryCapsUntil = Date.now() + CAPS_TTL_MS;
      memoryCapsAddress = normalizedAddress;
      return cached;
    }
  }

  if (inFlight) return inFlight;

  inFlight = (async () => {
    try {
      const probe = await getReadContractWithFallback(factoryAddress, FACTORY_PROBE_ABI);
      const provider = probe?.runner?.provider;
      if (!provider || typeof provider.getCode !== 'function') return DEFAULT_CAPS;

      const code = await provider.getCode(factoryAddress);
      const caps = capsFromBytecode(code);
      writeCachedCaps(factoryAddress, caps);
      return caps;
    } catch {
      return (memoryCapsAddress === normalizedAddress ? memoryCaps : null) || DEFAULT_CAPS;
    }
  })();

  try {
    return await inFlight;
  } finally {
    inFlight = null;
  }
}

export function seedFactoryCapabilities(caps) {
  const factoryAddress = ADDRESSES.factory;
  const knownCaps = capsFromKnownAddress(factoryAddress);
  if (knownCaps) {
    writeCachedCaps(factoryAddress, knownCaps);
    return;
  }
  writeCachedCaps(factoryAddress, { ...caps, ts: Date.now(), source: caps?.source || 'seed' });
}
