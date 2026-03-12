# NadWork

On-chain micro-task bounty platform on Monad.

![CI Gate](https://github.com/captpaw/nadwork/actions/workflows/ci.yml/badge.svg)
![Security Scan](https://github.com/captpaw/nadwork/actions/workflows/security.yml/badge.svg)

## Current Status

- Frontend + contracts are under active hardening.
- Production domain can run in coming-soon mode via `VITE_COMING_SOON=true`.
- Standard gate check before merge/deploy:
  - `npm run frontend:build`
  - `npm run frontend:test:orbital`
  - `npm test`
  - `npm audit --omit=dev`

## Local Development

```bash
npm install --legacy-peer-deps
npm run frontend:dev
```

App (dev): `http://127.0.0.1:3000`

## Build

```bash
npm run frontend:build
```

## Key Docs

- `SECURITY.md`
- `AUDIT_REPORT.md`
- `CHANGELOG.md`
- `PRE_DEPLOY_SMOKE_CHECKLIST.md`
- `RELEASE_RUNBOOK.md`

## License

MIT
