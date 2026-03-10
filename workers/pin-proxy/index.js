/**
 * NadWork - Pinata Pin Proxy
 * Cloudflare Worker that forwards IPFS pin requests to Pinata.
 *
 * Required Worker secrets (`wrangler secret put`):
 * - PINATA_API_KEY
 * - PINATA_API_SECRET
 *
 * Optional hardening vars:
 * - ALLOWED_ORIGIN: comma-separated allowed origins (default "*" for local dev)
 * - REQUIRE_PROXY_TOKEN: set "1" to require X-Proxy-Token header
 * - PROXY_AUTH_TOKEN: token value when REQUIRE_PROXY_TOKEN=1
 */

const PINATA_PIN_URL = 'https://api.pinata.cloud/pinning/pinJSONToIPFS';

// Simple in-memory rate limiter (best effort per Worker isolate).
const RATE_LIMIT_MAX = 20;
const RATE_LIMIT_WINDOW_MS = 60_000;
const rateLimitMap = new Map();

function isRateLimited(ip) {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now - entry.windowStart >= RATE_LIMIT_WINDOW_MS) {
    rateLimitMap.set(ip, { count: 1, windowStart: now });
    return false;
  }
  entry.count += 1;
  return entry.count > RATE_LIMIT_MAX;
}

function parseAllowedOrigins(raw) {
  const value = String(raw || '*').trim();
  if (!value || value === '*') {
    return { allowAny: true, origins: new Set() };
  }
  const origins = value
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
  return { allowAny: false, origins: new Set(origins) };
}

function isOriginAllowed(origin, allowedOrigins) {
  return allowedOrigins.allowAny || allowedOrigins.origins.has(origin);
}

function corsHeaders(origin, allowedOrigins) {
  const allowedOrigin = allowedOrigins.allowAny
    ? '*'
    : (origin && isOriginAllowed(origin, allowedOrigins) ? origin : 'null');

  const headers = {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Proxy-Token',
    'Access-Control-Max-Age': '86400',
  };

  if (!allowedOrigins.allowAny) {
    headers.Vary = 'Origin';
  }

  return headers;
}

function corsResponse(body, status, origin, allowedOrigins, contentType = 'application/json') {
  return new Response(body, {
    status,
    headers: {
      'Content-Type': contentType,
      ...corsHeaders(origin, allowedOrigins),
    },
  });
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const allowedOrigins = parseAllowedOrigins(env.ALLOWED_ORIGIN);

    if (request.method === 'OPTIONS') {
      if (origin && !isOriginAllowed(origin, allowedOrigins)) {
        return corsResponse(JSON.stringify({ error: 'Origin not allowed' }), 403, origin, allowedOrigins);
      }
      return corsResponse(null, 204, origin, allowedOrigins);
    }

    if (origin && !isOriginAllowed(origin, allowedOrigins)) {
      return corsResponse(JSON.stringify({ error: 'Origin not allowed' }), 403, origin, allowedOrigins);
    }

    const clientIp = request.headers.get('CF-Connecting-IP') || 'unknown';
    if (isRateLimited(clientIp)) {
      return corsResponse(JSON.stringify({ error: 'Too many requests' }), 429, origin, allowedOrigins);
    }

    const url = new URL(request.url);
    if (request.method !== 'POST' || url.pathname !== '/api/pin') {
      return corsResponse(JSON.stringify({ error: 'Not found' }), 404, origin, allowedOrigins);
    }

    const requireProxyToken = String(env.REQUIRE_PROXY_TOKEN || '') === '1';
    if (requireProxyToken) {
      const expectedToken = String(env.PROXY_AUTH_TOKEN || '').trim();
      if (!expectedToken) {
        console.error('[pin-proxy] REQUIRE_PROXY_TOKEN=1 but PROXY_AUTH_TOKEN is missing');
        return corsResponse(JSON.stringify({ error: 'Proxy misconfigured' }), 500, origin, allowedOrigins);
      }
      const providedToken = request.headers.get('X-Proxy-Token') || '';
      if (providedToken !== expectedToken) {
        return corsResponse(JSON.stringify({ error: 'Unauthorized' }), 401, origin, allowedOrigins);
      }
    }

    if (!env.PINATA_API_KEY || !env.PINATA_API_SECRET) {
      console.error('[pin-proxy] Pinata secrets not configured');
      return corsResponse(JSON.stringify({ error: 'Proxy misconfigured' }), 500, origin, allowedOrigins);
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return corsResponse(JSON.stringify({ error: 'Invalid JSON body' }), 400, origin, allowedOrigins);
    }

    const bodyStr = JSON.stringify(body);
    if (bodyStr.length > 65_536) {
      return corsResponse(JSON.stringify({ error: 'Payload too large' }), 413, origin, allowedOrigins);
    }

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
      console.error('[pin-proxy] Pinata network error:', err?.message || err);
      return corsResponse(JSON.stringify({ error: 'Upstream error' }), 502, origin, allowedOrigins);
    }

    const pinataBody = await pinataRes.text();
    if (!pinataRes.ok) {
      console.error('[pin-proxy] Pinata error', pinataRes.status, pinataBody);
      return corsResponse(pinataBody, pinataRes.status, origin, allowedOrigins, 'application/json');
    }

    return corsResponse(pinataBody, 200, origin, allowedOrigins, 'application/json');
  },
};
