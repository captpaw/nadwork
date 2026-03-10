# NadWork - Pinata Pin Proxy (Cloudflare Worker)

Cloudflare Worker ini menjadi perantara upload metadata IPFS ke Pinata.
Pinata secret hanya ada di Worker secret, tidak pernah dibundel ke frontend.

```
Browser -> POST /api/pin -> Worker -> Pinata API
```

## Prasyarat

- Cloudflare account
- Domain sudah dikelola Cloudflare (opsional, jika pakai custom route)
- Node.js 18+

## 1) Install Wrangler

```bash
npm install -g wrangler
wrangler login
```

## 2) Set Worker secrets

```bash
cd workers/pin-proxy
npx wrangler secret put PINATA_API_KEY
npx wrangler secret put PINATA_API_SECRET
```

Opsional (mode ketat non-browser):

```bash
npx wrangler secret put PROXY_AUTH_TOKEN
```

## 3) Konfigurasi worker

Atur `wrangler.toml`:

- `ALLOWED_ORIGIN` ke origin frontend produksi, contoh: `https://nadwork.xyz`
- (opsional) `REQUIRE_PROXY_TOKEN = "1"` jika ingin mewajibkan `X-Proxy-Token`

Contoh:

```toml
[vars]
ALLOWED_ORIGIN = "https://nadwork.xyz"
# REQUIRE_PROXY_TOKEN = "1"
```

Jika pakai route domain, buka blok `[[routes]]` lalu isi `pattern` dan `zone_name`.

## 4) Deploy

```bash
cd workers/pin-proxy
npx wrangler deploy
```

## 5) Frontend env (production)

```env
VITE_PIN_PROXY_URL=https://nadwork.xyz/api/pin
```

Jangan isi Pinata secret di production frontend:

```env
VITE_PINATA_API_KEY=
VITE_PINATA_SECRET_API_KEY=
```

## 6) Local development

`workers/pin-proxy/.dev.vars`:

```env
PINATA_API_KEY=your-pinata-key
PINATA_API_SECRET=your-pinata-secret
ALLOWED_ORIGIN=http://localhost:3000
# REQUIRE_PROXY_TOKEN=1
# PROXY_AUTH_TOKEN=dev-token
```

Jalankan worker:

```bash
cd workers/pin-proxy
npx wrangler dev
```

Set frontend dev:

```env
VITE_PIN_PROXY_URL=http://localhost:8787/api/pin
```

## Security notes

- Produksi: wajib set `ALLOWED_ORIGIN` spesifik, jangan `*`.
- Rate limit bawaan worker bersifat best-effort per isolate.
- Untuk proteksi lebih ketat, gunakan Cloudflare WAF/Rate Limiting rules.
