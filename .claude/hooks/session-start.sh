#!/bin/bash
# Install dependencies in remote (cloud) sessions only.
set -euo pipefail
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then exit 0; fi
cd "$CLAUDE_PROJECT_DIR"
if ! command -v bun >/dev/null 2>&1; then npm install -g bun; fi
bun install
