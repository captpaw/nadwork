/**
 * NadWork — Pinata Pin Proxy
 * Cloudflare Worker that forwards IPFS pin requests to Pinata.
 *
 * The Pinata secret key is stored as a Cloudflare Worker secret (never in the
 * browser bundle). The frontend sends requests here; this worker authenticates
 * them and forwards to Pinata.
 *
 * Secrets required (set via `wrangler secret put`):
 *   PINATA_API_KEY        — Pinata public API key
 *   PINATA_API_SECRET     — Pinata secret API key
 *   PROXY_AUTH_TOKEN      — A random token the frontend must send in
 *                           X-Proxy-Token header to prevent public abuse
 *
 * Optional env var (wrangler.toml [vars]):
 *   ALLOWED_ORIGIN        — e.g. https://nadwork.xyz (defaults to * for dev)
 */

const PINATA_PIN_URL = 'https://api.pinata.cloud/pinning/pinJSONToIPFS';

// ── Simple in-memory rate limiter (best-effort per Worker isolate) ────────────
// Limits each IP to RATE_LIMIT_MAX requests per RATE_LIMIT_WINDOW_MS.
// NOTE: Cloudflare spins up multiple isolates under load, so this is per-isolate.
// For stricter enforcement, use Cloudflare Rate Limiting rules in the dashboard
// (Workers > your worker > Settings > Rate Limiting) — no code change needed.
const RATE_LIMIT_MAX        = 20;          // max requests per window
const RATE_LIMIT_WINDOW_MS  = 60_000;     // 1-minute window
const _rateLimitMap = new Map();           // ip → { count, windowStart }

function isRateLimited(ip) {
  const now  = Date.now();
  const entry = _rateLimitMap.get(ip);
  if (!entry || now - entry.windowStart >= RATE_LIMIT_WINDOW_MS) {
    _rateLimitMap.set(ip, { count: 1, windowStart: now });
    return false;
  }
  entry.count++;
  return entry.count > RATE_LIMIT_MAX;
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '*';
    const allowed = env.ALLOWED_ORIGIN || '*';

    // ── CORS preflight ────────────────────────────────────────────────────────
    if (request.method === 'OPTIONS') {
      return corsResponse(null, 204, origin, allowed);
    }

    // ── Rate limiting (per IP, best-effort) ──────────────────────────────────
    const clientIp = request.headers.get('CF-Connecting-IP') || 'unknown';
    if (isRateLimited(clientIp)) {
      return corsResponse(JSON.stringify({ error: 'Too many requests' }), 429, origin, allowed);
    }

    // ── Only accept POST /api/pin ─────────────────────────────────────────────
    const url = new URL(request.url);
    if (request.method !== 'POST' || url.pathname !== '/api/pin') {
      return corsResponse(JSON.stringify({ error: 'Not found' }), 404, origin, allowed);
    }

    // ── Validate proxy auth token (prevents public abuse of the worker) ───────
    const proxyToken = request.headers.get('X-Proxy-Token');
    if (!env.PROXY_AUTH_TOKEN) {
      console.error('[pin-proxy] PROXY_AUTH_TOKEN not configured');
      return corsResponse(JSON.stringify({ error: 'Proxy misconfigured' }), 500, origin, allowed);
    }
    if (!proxyToken || proxyToken !== env.PROXY_AUTH_TOKEN) {
      return corsResponse(JSON.stringify({ error: 'Unauthorized' }), 401, origin, allowed);
    }

    // ── Validate Pinata secrets are configured ────────────────────────────────
    if (!env.PINATA_API_KEY || !env.PINATA_API_SECRET) {
      console.error('[pin-proxy] Pinata secrets not configured');
      return corsResponse(JSON.stringify({ error: 'Proxy misconfigured' }), 500, origin, allowed);
    }

    // ── Parse request body ────────────────────────────────────────────────────
    let body;
    try {
      body = await request.json();
    } catch {
      return corsResponse(JSON.stringify({ error: 'Invalid JSON body' }), 400, origin, allowed);
    }

    // Enforce maximum payload size (64 KB — bounty/submission metadata is tiny)
    const bodyStr = JSON.stringify(body);
    if (bodyStr.length > 65_536) {
      return corsResponse(JSON.stringify({ error: 'Payload too large' }), 413, origin, allowed);
    }

    // ── Forward to Pinata ─────────────────────────────────────────────────────
    let pinataRes;
    try {
      pinataRes = await fetch(PINATA_PIN_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          pinata_api_key: env.PINATA_API_KEY,
          pinata_secret_api_key: env.PINATA_API_SECRET,
        },
        body: bodyStr,
      });
    } catch (err) {
      console.error('[pin-proxy] Pinata network error:', err.message);
      return corsResponse(JSON.stringify({ error: 'Upstream error' }), 502, origin, allowed);
    }

    const pinataBody = await pinataRes.text();

    if (!pinataRes.ok) {
      console.error('[pin-proxy] Pinata error', pinataRes.status, pinataBody);
      return corsResponse(pinataBody, pinataRes.status, origin, allowed, 'application/json');
    }

    return corsResponse(pinataBody, 200, origin, allowed, 'application/json');
  },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function corsHeaders(origin, allowed) {
  const allowedOrigin = allowed === '*' ? '*' : (origin === allowed ? origin : 'null');
  return {
    'Access-Control-Allow-Origin':  allowedOrigin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Proxy-Token',
    'Access-Control-Max-Age':       '86400',
  };
}

function corsResponse(body, status, origin, allowed, contentType = 'application/json') {
  return new Response(body, {
    status,
    headers: {
      'Content-Type': contentType,
      ...corsHeaders(origin, allowed),
    },
  });
}
