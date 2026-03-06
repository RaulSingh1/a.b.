#!/usr/bin/env bash
set -euo pipefail

NODE_USER="${NODE_USER:-quotesfe}"
NODE_HOST="${NODE_HOST:-10.12.13.30}"
APP_DIR="${APP_DIR:-\$HOME/angry birds}"

ssh "${NODE_USER}@${NODE_HOST}" "cd \"${APP_DIR}\" && fuser -k 3000/tcp >/dev/null 2>&1 || true && nohup npm start > app.log 2>&1 & sleep 2 && curl -s http://127.0.0.1:3000/api/health && echo"
