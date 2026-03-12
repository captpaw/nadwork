# Release Runbook

Last updated: 2026-03-13

This runbook defines the standard release process for NadWork frontend and related services.

## 1. Scope

This runbook covers:
- Frontend release (Cloudflare Pages)
- Pin proxy readiness (Cloudflare Worker)
- Post-release validation
- Rollback procedure

## 2. Pre-release freeze

Before release:
1. Stop merging non-critical changes into `main`
2. Ensure CI is green on latest `main`
3. Confirm gate checks completed locally and/or CI

## 3. Required production env

Set in Cloudflare Pages (Production environment):
- `VITE_BOUNTY_FACTORY_ADDRESS`
- `VITE_BOUNTY_REGISTRY_ADDRESS`
- `VITE_ESCROW_ADDRESS`
- `VITE_REPUTATION_REGISTRY_ADDRESS`
- `VITE_IDENTITY_REGISTRY_ADDRESS`
- `VITE_WALLETCONNECT_PROJECT_ID`
- `VITE_PIN_PROXY_URL`

Do NOT set in production frontend env:
- `VITE_PINATA_API_KEY`
- `VITE_PINATA_SECRET_API_KEY`

Optional flag:
- `VITE_COMING_SOON=true` to keep public site gated
- `VITE_COMING_SOON=false` to open full app

## 4. Release steps

1. Pull latest main:
```bash
git checkout main
git pull origin main
```

2. Run gate checks:
```bash
npm run frontend:build
npm run frontend:test:orbital
npm test
npm audit --omit=dev
```

3. Validate production config:
```bash
npm run frontend:check:prod-config
```

4. Deploy to production (Cloudflare Pages):
- Trigger production deploy from latest `main`
- Wait until status is green

5. If pin proxy changed:
- Deploy Worker `workers/pin-proxy`
- Confirm worker URL is reachable
- Confirm `ALLOWED_ORIGIN` includes frontend domain

6. Run manual smoke checklist:
- Execute `PRE_DEPLOY_SMOKE_CHECKLIST.md`

## 5. Post-release monitoring (first 60 minutes)

Watch for:
- Failed to load bounties
- Post bounty failure (revert / wrong amount / require false)
- Missing submissions in dashboard/account
- Unexpected curated/open label mismatch

Data sources:
- Browser console/network
- Cloudflare Pages deployment logs
- Cloudflare Worker logs (pin proxy)

## 6. Rollback plan

If critical issue detected:

1. Keep users safe immediately:
- Set `VITE_COMING_SOON=true` in production env
- Redeploy latest production

2. Roll back frontend deployment:
- Cloudflare Pages -> Deployments -> rollback to last known good build

3. If issue in pin proxy:
- Roll back Worker to last stable version
- Verify worker URL health

4. Validate recovery:
- Open home and bounties list
- Open one bounty detail
- Verify no blocking runtime error

5. Incident note:
- Record trigger, impact, root cause, and permanent fix item

## 7. Exit criteria

Release is complete when:
- Production deploy is green
- Smoke checklist passes
- No active P0/P1 incident in first monitoring window
- Team confirms go-live status
