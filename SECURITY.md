# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| Latest  | âœ…        |

## Reporting a Vulnerability

If you discover a security vulnerability, **do NOT open a public GitHub issue**.

Please report it privately via:
- **Email**: [security@nadwork.xyz]
- **GitHub Security Advisories**: Gunakan tab "Security â†’ Advisories" di repo ini

We aim to respond within **48 hours** and resolve critical issues within **7 days**.

---

## Security Architecture

### Secret Management

| Secret | Where stored | Never stored in |
|--------|-------------|-----------------|
| Deployer private key | Local `.env` only | Git, code, CI |
| Pinata API key | Local `.env` / Cloudflare Worker secret | Git, code, browser bundle |
| WalletConnect Project ID | Local `.env` / CI secret | Hardcoded in source |
| Monad Explorer API key | Local `.env` / CI secret | Git, code |

### Layers of Protection

1. **`.gitignore`** â€” Prevents `.env` and secret files from being staged
2. **Pre-commit hook** (`.githooks/pre-commit`) â€” Scans staged diffs for secret patterns before every commit
3. **GitHub Actions** (`.github/workflows/security.yml`) â€” Runs on every push/PR:
   - **Gitleaks** â€” Full history secret scanning
   - **npm audit** â€” Dependency vulnerability check
   - **Slither** â€” Solidity smart contract static analysis
   - **Custom env-leak check** â€” Verifies no `.env` files are tracked

### Smart Contract Security

- Contracts use OpenZeppelin standards (ReentrancyGuard, Ownable, Pausable)
- All contracts are pausable in emergencies
- Time-locked dispute resolution
- Audit report: see `AUDIT_REPORT.md`

---

## Developer Setup

### Activating Security Hooks

After cloning, **run this once**:

```bash
bash setup-hooks.sh
```

This configures git to use `.githooks/pre-commit` which blocks commits containing secrets.

### Environment Variables

1. Copy the example file:
   ```bash
   cp .env.example .env
   cp frontend/.env.example frontend/.env
   ```
2. Fill in your own values â€” **never share or commit the filled `.env`**
3. For the deployer `PRIVATE_KEY`: use a **dedicated deployment wallet** with minimal funds, not your main wallet

### Rotating Compromised Secrets

If a secret is accidentally committed:

1. **Immediately rotate** the exposed key (revoke in Pinata/WalletConnect dashboards, transfer funds from compromised wallet)
2. Remove from git history:
   ```bash
   # Install git-filter-repo first: pip install git-filter-repo
   git filter-repo --path .env --invert-paths
   git push origin --force --all
   ```
3. Force-expire GitHub caches and notify collaborators to re-clone

---

## Dependency Policy

- All dependencies are pinned in `package-lock.json`
- Run `npm audit` regularly
- Update dependencies monthly or when vulnerabilities are reported

