# Pre-Deploy Smoke Checklist

Last updated: 2026-03-13

Use this checklist before every production release.

## 1. Automated gate (must pass)

Run from repository root:

```bash
npm run frontend:build
npm run frontend:test:orbital
npm test
npm audit --omit=dev
```

Pass criteria:
- Frontend build succeeds
- Orbital tests pass (5/5)
- Hardhat tests pass (all)
- Production dependency audit shows 0 vulnerabilities

## 2. Production config validation

Validate production env before deploy:

```bash
npm run frontend:check:prod-config
```

Must be true:
- All `VITE_*_ADDRESS` values are valid non-zero addresses
- `VITE_WALLETCONNECT_PROJECT_ID` is set
- `VITE_PIN_PROXY_URL` is set and uses `https`
- `VITE_PINATA_API_KEY` is NOT set in production frontend env
- `VITE_PINATA_SECRET_API_KEY` is NOT set in production frontend env

## 3. Manual smoke tests (UI)

Test with at least 2 wallets:
- Wallet A = creator
- Wallet B = builder

### A. Public pages
- Open home page
- Open bounties list
- Search and filter by category/status
- Open bounty detail
- Verify no blocking runtime error in console

### B. Creator flow
- Connect Wallet A
- Create bounty (open mode)
- Confirm bounty appears in bounties list
- Open the created bounty detail

### C. Builder flow
- Connect Wallet B
- Open created bounty
- Submit work
- Verify submission appears for creator

### D. Review flow
- Switch to Wallet A
- Request revision once
- Switch to Wallet B, submit revision response
- Switch to Wallet A, approve winner

### E. Account and dashboard
- Wallet A: verify posted bounty appears in dashboard/account
- Wallet B: verify submitted work appears in dashboard/account

### F. Non-happy path checks
- Expired/completed/cancelled bounties do not show as open
- Open filter excludes completed/cancelled
- Curated/open label matches actual posting mode

## 4. Operational checks

- Pin proxy endpoint responds (`200/4xx JSON`, not HTML 404)
- Cloudflare Pages latest deployment is green
- Custom domain active with valid SSL
- No unresolved CI failures on `main`

## 5. Release sign-off

Release is approved only when:
- All automated gate checks pass
- All manual smoke tests pass
- No P0/P1 bug remains open
- Rollback plan is prepared and verified
