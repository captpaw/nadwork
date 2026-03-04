# NadWork — Pinata Pin Proxy (Cloudflare Worker)

Cloudflare Worker yang menjadi perantara antara frontend dan Pinata API.
Secret key Pinata **tidak pernah masuk ke browser bundle** — hanya ada di
environment variable Worker yang terenkripsi oleh Cloudflare.

```
Browser → POST /api/pin (+ X-Proxy-Token) → Worker → Pinata API
```

---

## Prerequisites

- Akun Cloudflare (gratis)
- Domain `nadwork.xyz` sudah di-proxy Cloudflare (orange cloud ✓)
- Node.js ≥ 18

---

## 1. Install Wrangler

```bash
npm install -g wrangler
wrangler login
```

---

## 2. Set Secrets

Jalankan satu per satu — Wrangler akan prompt input (tidak ter-log):

```bash
cd workers/pin-proxy

# Pinata API key (dari pinata.cloud → API Keys)
npx wrangler secret put PINATA_API_KEY

# Pinata Secret API key
npx wrangler secret put PINATA_API_SECRET

# Token random untuk mencegah abuse — generate dulu:
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# Lalu paste hasilnya saat prompt:
npx wrangler secret put PROXY_AUTH_TOKEN
```

Catat nilai `PROXY_AUTH_TOKEN` — akan dipakai di `.env` frontend.

---

## 3. Konfigurasi Domain (wrangler.toml)

Buka `wrangler.toml`, uncomment bagian `[[routes]]`:

```toml
[[routes]]
pattern = "nadwork.xyz/api/pin"
zone_name = "nadwork.xyz"
```

---

## 4. Deploy

```bash
cd workers/pin-proxy
npx wrangler deploy
```

Output akan menampilkan URL worker, contoh:
`https://nadwork-pin-proxy.YOUR_SUBDOMAIN.workers.dev`

---

## 5. Update Frontend .env (Production)

Tambahkan ke `.env` production (Vercel/Netlify/server):

```env
VITE_PIN_PROXY_URL=https://nadwork.xyz/api/pin
VITE_PIN_PROXY_TOKEN=<nilai PROXY_AUTH_TOKEN yang tadi dicatat>
```

Hapus atau kosongkan:
```env
VITE_PINATA_API_KEY=
# VITE_PINATA_SECRET_API_KEY=   ← jangan pernah ada di production
```

---

## 6. Local Development (tanpa deploy)

Untuk dev lokal, isi `workers/pin-proxy/.dev.vars`:

```env
PINATA_API_KEY=your-pinata-key
PINATA_API_SECRET=your_pinata_secret_here
PROXY_AUTH_TOKEN=change-this-in-production
ALLOWED_ORIGIN=http://localhost:3000
```

Jalankan worker lokal:

```bash
cd workers/pin-proxy
npx wrangler dev
# Worker berjalan di http://localhost:8787
```

Update `.env` frontend untuk dev:

```env
VITE_PIN_PROXY_URL=http://localhost:8787/api/pin
VITE_PIN_PROXY_TOKEN=change-this-in-production
```

---

## Alur Keamanan

| Kondisi | Cara upload |
|---|---|
| Dev lokal (tanpa proxy) | API key + secret langsung ke Pinata |
| Dev lokal (dengan proxy) | `localhost:8787/api/pin` + dev token |
| **Production** | `nadwork.xyz/api/pin` + PROXY_AUTH_TOKEN |

Secret Pinata **tidak pernah ada di browser** pada mode production.

---

## Limits & Monitoring

- Cloudflare Workers free tier: **100.000 request/hari** — lebih dari cukup
- Monitor di: Cloudflare Dashboard → Workers → `nadwork-pin-proxy` → Metrics
- Kalau di-abuse: rotate `PROXY_AUTH_TOKEN` dan update di frontend env
