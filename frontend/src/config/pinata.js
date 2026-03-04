const API_KEY    = import.meta.env.VITE_PINATA_API_KEY        || '';
const API_SECRET = import.meta.env.VITE_PINATA_SECRET_API_KEY || '';
const GATEWAY    = import.meta.env.VITE_PINATA_GATEWAY        || 'https://gateway.pinata.cloud/ipfs/';
// VITE_PIN_PROXY_URL  — URL of the Cloudflare Worker proxy (e.g. https://nadwork.xyz/api/pin)
// VITE_PIN_PROXY_TOKEN — X-Proxy-Token secret shared with the Worker
const PROXY_URL   = import.meta.env.VITE_PIN_PROXY_URL   || '';
const PROXY_TOKEN = import.meta.env.VITE_PIN_PROXY_TOKEN || '';

const GATEWAYS = [
  GATEWAY,
  'https://ipfs.io/ipfs/',
  'https://dweb.link/ipfs/',
  'https://nftstorage.link/ipfs/',
];

const jsonCache = new Map();

/**
 * Upload JSON metadata to IPFS via Pinata.
 *
 * Priority:
 *  1. Cloudflare Worker proxy (VITE_PIN_PROXY_URL + VITE_PIN_PROXY_TOKEN)
 *     — production path: secret never leaves the server.
 *  2. Direct Pinata API with key+secret (local dev fallback).
 *     — only used when proxy is not configured.
 */
export async function uploadJSON(data, name = 'nadwork-data') {
  const payload = JSON.stringify({ pinataMetadata: { name }, pinataContent: data });

  const isProd = import.meta.env.PROD;
  const isDev  = import.meta.env.DEV;

  // In production we *require* the proxy and never talk to Pinata directly
  if (isProd && !PROXY_URL) {
    throw new Error('IPFS proxy is required in production. Set VITE_PIN_PROXY_URL and VITE_PIN_PROXY_TOKEN.');
  }

  // ── Path 1: Cloudflare Worker proxy ──────────────────────────────────────
  if (PROXY_URL) {
    if (!PROXY_TOKEN) {
      throw new Error('IPFS proxy token is required. Set VITE_PIN_PROXY_TOKEN.');
    }
    const headers = { 'Content-Type': 'application/json' };
    headers['X-Proxy-Token'] = PROXY_TOKEN;

    const proxyRes = await fetch(PROXY_URL, {
      method: 'POST',
      headers,
      body: payload,
    }).catch(() => null);

    if (proxyRes && proxyRes.ok) {
      return (await proxyRes.json()).IpfsHash;
    }

    const errText = proxyRes ? await proxyRes.text().catch(() => '') : 'network error';
    throw new Error('IPFS proxy error: ' + errText);
  }

  // ── Path 2: Direct Pinata API (local dev only) ────────────────────────────
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

  for (const gw of GATEWAYS) {
    try {
      const res = await fetch(gw + cid, { signal: AbortSignal.timeout(8000) });
      if (res.ok) {
        const data = await res.json();
        jsonCache.set(cid, data);
        return data;
      }
    } catch {}
  }
  return null;
}

// FIX L-FE-8: Export gateway so other components can use configured value
export { GATEWAY };

// V2 bounty metadata — fullDescription stored as Markdown
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

// V4: Application proposal metadata — short proposal before full submission
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

// Opsi B: Revision request (creator → builder) — off-chain, stored on IPFS
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

// Opsi B: Revision response (builder → creator) — off-chain, stored on IPFS
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

// V2 submission metadata — description stored as Markdown, deliverables typed
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
