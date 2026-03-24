#!/bin/bash
# Smoke test for @turnkey/agent-auth
#
# Prerequisites:
#   - A running Turnkey instance (local or production)
#   - Set env vars below
#
# Usage:
#   TURNKEY_API_BASE_URL=<your-api-url> \
#   TURNKEY_API_PUBLIC_KEY=<key> \
#   TURNKEY_API_PRIVATE_KEY=<key> \
#   TURNKEY_ORG_ID=<org-id> \
#   ./scripts/smoke-test.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR/.."

npx tsx scripts/smoke-test.ts
