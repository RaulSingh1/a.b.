#!/usr/bin/env bash
set -euo pipefail

# Run this script from your Mac:
#   cd "/Users/raulsingh/angry birds"
#   bash deploy.sh

NODE_USER="${NODE_USER:-quotesfe}"
NODE_HOST="${NODE_HOST:-10.12.13.30}"
MONGO_HOST="${MONGO_HOST:-10.12.13.40}"
APP_DIR_NAME="angry birds"
LOCAL_DIR="$(cd "$(dirname "$0")" && pwd)"
REMOTE_APP_DIR="~/${APP_DIR_NAME}"

echo "==> Checking local project files"
for f in package.json server.js .env.example index.ejs angry.js style.css; do
  if [[ ! -f "${LOCAL_DIR}/${f}" ]]; then
    echo "Missing required file: ${LOCAL_DIR}/${f}"
    exit 1
  fi
done

echo "==> Copying project to ${NODE_USER}@${NODE_HOST}:${REMOTE_APP_DIR}"
scp -r "${LOCAL_DIR}" "${NODE_USER}@${NODE_HOST}:~/"

echo "==> Setting .env, installing deps, and starting app on Node VM"
ssh -t "${NODE_USER}@${NODE_HOST}" "bash -lc '
  set -euo pipefail
  cd \"\$HOME/${APP_DIR_NAME}\"
  cp -f .env.example .env
  sed -i \"s|^HOST=.*|HOST=0.0.0.0|\" .env
  sed -i \"s|^PORT=.*|PORT=3000|\" .env
  sed -i \"s|^MONGO_URI=.*|MONGO_URI=mongodb://${MONGO_HOST}:27017/angrybirds|\" .env

  npm install

  # Free port 3000 to avoid old app instance serving stale routes.
  fuser -k 3000/tcp >/dev/null 2>&1 || true

  # Start app directly to avoid npm wrapper process ambiguity.
  nohup node server.js > app.log 2>&1 &
  sleep 2

  echo \"--- .env ---\"
  cat .env
  echo \"--- server route check ---\"
  grep -n \"/api/health\" server.js || true
  echo \"--- health ---\"
  curl -s http://127.0.0.1:3000/api/health || true
  echo
  echo \"--- process ---\"
  pgrep -af \"node( .*)?server\\.js\" || true
  echo \"--- app.log ---\"
  tail -n 40 app.log || true
'"

echo "==> Done"
echo "Try in browser: http://${NODE_HOST}:3000"
