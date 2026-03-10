#!/usr/bin/env bash
# ─── NadWork Git Hooks Setup ──────────────────────────────────────────────────
# Run this once after cloning the repo to activate security pre-commit hooks.
#
#   bash setup-hooks.sh
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "Setting up git hooks..."

# Point git to our hooks directory
git config core.hooksPath .githooks

# Ensure the pre-commit hook is executable
chmod +x .githooks/pre-commit

echo -e "${GREEN}✅ Git hooks installed from .githooks/${NC}"
echo ""
echo "The pre-commit hook will:"
echo "  • Block commits containing .env or private key files"
echo "  • Scan staged changes for hardcoded secrets / API keys"
echo "  • Warn about unexpectedly large files"
echo ""
echo -e "${YELLOW}Run 'bash setup-hooks.sh' again after any team member clones this repo.${NC}"
