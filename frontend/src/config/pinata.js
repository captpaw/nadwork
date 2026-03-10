const API_KEY    = import.meta.env.VITE_PINATA_API_KEY        || '';
const API_SECRET = import.meta.env.VITE_PINATA_SECRET_API_KEY || '';
const GATEWAY    = import.meta.env.VITE_PINATA_GATEWAY        || 'https://gateway.pinata.cloud/ipfs/';
// VITE_PIN_PROXY_URL - URL of the Cloudflare Worker proxy (e.g. https://nadwork.xyz/api/pin)
const PROXY_URL = import.meta.env.VITE_PIN_PROXY_URL || '';

const PUBLIC_GATEWAYS = [
  'https://ipfs.io/ipfs/',
  'https://dweb.link/ipfs/',
  'https://nftstorage.link/ipfs/',
];

const USE_IPFS_PROXY = import.meta.env.DEV && (import.meta.env.VITE_USE_IPFS_PROXY !== '0');
const DEV_IPFS_PROXY = typeof window !== 'undefined' && USE_IPFS_PROXY
  ? `${window.location.origin}/ipfs-proxy/`
  : '';
const EXTERNAL_IPFS_PROXY = (import.meta.env.VITE_IPFS_PROXY_URL || '').trim();

function withTrailingSlash(url) {
  if (!url) return '';
  return url.endsWith('/') ? url : `${url}/`;
}

function unique(items) {
  return Array.from(new Set(items.filter(Boolean)));
}

const PROXY_GATEWAYS = unique([
  withTrailingSlash(EXTERNAL_IPFS_PROXY),
  withTrailingSlash(DEV_IPFS_PROXY),
]);

// Preferred order:
// - proxy routes first (same-origin / controlled infra)
// - then fallback public gateways
// - then configured vendor gateway (dev) or first-party gateway (prod)
const DEV_GATEWAYS = USE_IPFS_PROXY
  ? unique([...PROXY_GATEWAYS, ...PUBLIC_GATEWAYS])
  : unique([...PROXY_GATEWAYS, ...PUBLIC_GATEWAYS, GATEWAY]);

const GATEWAYS = import.meta.env.DEV
  ? DEV_GATEWAYS
  : unique([...PROXY_GATEWAYS, GATEWAY, ...PUBLIC_GATEWAYS]);

const jsonCache = new Map();
const jsonInFlight = new Map();
const jsonFailureUntil = new Map();
const JSON_FAIL_TTL_MS = 30_000;

/**
 * Upload JSON metadata to IPFS via Pinata.
 *
 * Priority:
 *  1. Cloudflare Worker proxy (VITE_PIN_PROXY_URL)
 *     - production path: Pinata secret never leaves the server.
 *  2. Direct Pinata API with key+secret (local dev fallback).
 *     â€” only used when proxy is not configured.
 */
export async function uploadJSON(data, name = 'nadwork-data') {
  const payload = JSON.stringify({ pinataMetadata: { name }, pinataContent: data });

  const isProd = import.meta.env.PROD;
  const isDev  = import.meta.env.DEV;

  // In production we require the proxy and never talk to Pinata directly
  if (isProd && !PROXY_URL) {
    throw new Error('IPFS proxy is required in production. Set VITE_PIN_PROXY_URL.');
  }

  // Path 1: Cloudflare Worker proxy
  if (PROXY_URL) {

    const proxyRes = await fetch(PROXY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload,
    }).catch(() => null);

    if (proxyRes && proxyRes.ok) {
      return (await proxyRes.json()).IpfsHash;
    }

    const errText = proxyRes ? await proxyRes.text().catch(() => '') : 'network error';
    throw new Error('IPFS proxy error: ' + errText);
  }

  // Path 2: Direct Pinata API (local dev only)
  if (!isDev) {
    // Should never happen in production because we already enforced PROXY_URL above.
    throw new Error('Direct Pinata access is disabled outside local dev. Configure VITE_PIN_PROXY_URL.');
  }

  if (!API_KEY || !API_SECRET) {
    throw new Error('Pinata key invalid for local dev. Check VITE_PINATA_* in .env');
  }

  const res = await fetch('https://api.pinata.cloud/pinning/pinJSONToIPFS', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      pinata_api_key: API_KEY,
      pinata_secret_api_key: API_SECRET,
    },
    body: payload,
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => res.statusText);
    if (res.status === 401) throw new Error('Pinata key invalid. Check VITE_PINATA_* in .env');
    throw new Error('IPFS upload failed: ' + errText);
  }
  return (await res.json()).IpfsHash;
}

export async function fetchJSON(cid) {
  if (!cid) return null;
  if (jsonCache.has(cid)) return jsonCache.get(cid);

  const failUntil = jsonFailureUntil.get(cid) || 0;
  if (failUntil > Date.now()) return null;

  const pending = jsonInFlight.get(cid);
  if (pending) return pending;

  const task = (async () => {
    for (const gw of GATEWAYS) {
      try {
        const res = await fetch(gw + cid, { signal: AbortSignal.timeout(8000) });
        if (!res.ok) continue;

        const data = await res.json().catch(() => null);
        if (!data || typeof data !== 'object') continue;

        jsonCache.set(cid, data);
        jsonFailureUntil.delete(cid);
        return data;
      } catch {
        // try next gateway
      }
    }
    return null;
  })();

  jsonInFlight.set(cid, task);
  try {
    const result = await task;
    if (!result) {
      jsonFailureUntil.set(cid, Date.now() + JSON_FAIL_TTL_MS);
    }
    return result;
  } finally {
    jsonInFlight.delete(cid);
  }
}

// Synchronous cache read â€” returns null if not yet fetched; no network call.
// Used for best-effort skills filtering in useBounties (no IPFS roundtrip).
export function getCachedJSON(cid) {
  return cid ? (jsonCache.get(cid) ?? null) : null;
}

// FIX L-FE-8: Export gateway so other components can use configured value
export { GATEWAY };

// V2 bounty metadata â€” fullDescription stored as Markdown
export function buildBountyMeta({
  title,
  shortDescription = '',
  fullDescription = '',
  requirements    = [],
  evaluationCriteria = [],
  resources       = [],
  skills          = [],
  estimatedHours  = null,
  contactInfo     = '',
  category        = '',
}) {
  return {
    version: '2',
    title,
    shortDescription: shortDescription || fullDescription.slice(0, 160).replace(/\n/g, ' '),
    // Store as both keys: fullDescription (canonical) and description (alias) for
    // backward-compat with BountyDetailPage and any off-chain indexers reading meta.description
    description: fullDescription,
    fullDescription,
    requirements,
    evaluationCriteria,
    resources,
    skills,
    estimatedHours,
    contactInfo,
    category,
    timestamp: Math.floor(Date.now() / 1000),
  };
}

// V4: Application proposal metadata â€” short proposal before full submission
export function buildProposalMeta({
  bountyId,
  builderAddress,
  proposal = '',
}) {
  return {
    version: '1',
    type: 'application_proposal',
    bountyId: String(bountyId),
    builderAddress,
    proposal,
    timestamp: Math.floor(Date.now() / 1000),
  };
}

// Opsi B: Revision request (creator â†’ builder) â€” off-chain, stored on IPFS
export function buildRevisionRequestMeta({
  bountyId,
  submissionId,
  creatorAddress,
  message,
  refLink = '',
}) {
  return {
    version: '1',
    type: 'revision_request',
    bountyId: String(bountyId),
    submissionId: String(submissionId),
    creatorAddress,
    message,
    refLink,
    timestamp: Math.floor(Date.now() / 1000),
  };
}

// Opsi B: Revision response (builder â†’ creator) â€” off-chain, stored on IPFS
export function buildRevisionResponseMeta({
  bountyId,
  submissionId,
  requestIpfs,
  builderAddress,
  title,
  description = '',
  deliverables = [],
  notes = '',
}) {
  return {
    version: '1',
    type: 'revision_response',
    bountyId: String(bountyId),
    submissionId: String(submissionId),
    requestIpfs,
    builderAddress,
    title,
    description,
    deliverables,
    notes,
    timestamp: Math.floor(Date.now() / 1000),
  };
}

// V2 submission metadata â€” description stored as Markdown, deliverables typed
export function buildSubmissionMeta({
  bountyId,
  builderAddress,
  title,
  description     = '',
  deliverables    = [],
  coverImageCid   = '',
  notes           = '',
}) {
  return {
    version: '2',
    bountyId: String(bountyId),
    builderAddress,
    title,
    description,
    deliverables,
    coverImageCid,
    notes,
    timestamp: Math.floor(Date.now() / 1000),
  };
}


