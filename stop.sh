#!/usr/bin/env bash
set -euo pipefail

NODE_USER="${NODE_USER:-quotesfe}"
NODE_HOST="${NODE_HOST:-10.12.13.30}"

ssh "${NODE_USER}@${NODE_HOST}" "fuser -k 3000/tcp >/dev/null 2>&1 || true; echo \"Stopped (if running)\""
