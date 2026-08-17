#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

ENV_FILE="${MISSIONCOOKIES_ENV_FILE:-missioncookies.env}"
if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing $ENV_FILE"
  echo "Create it from missioncookies.env.example and fill in the droplet paths first."
  exit 1
fi

set -a
source "$ENV_FILE"
set +a

: "${MISSIONCOOKIES_SSH:?Missing MISSIONCOOKIES_SSH}"
: "${MISSIONCOOKIES_WEB_DIR:?Missing MISSIONCOOKIES_WEB_DIR}"
: "${MISSIONCOOKIES_APP_DIR:?Missing MISSIONCOOKIES_APP_DIR}"
: "${MISSIONCOOKIES_RESTART_CMD:?Missing MISSIONCOOKIES_RESTART_CMD}"
: "${MISSIONCOOKIES_TEST_URL:=http://missioncookies.cv/ai-exam-test.html}"

command -v ssh >/dev/null || { echo "ssh not found"; exit 1; }
command -v scp >/dev/null || { echo "scp not found"; exit 1; }
command -v python3 >/dev/null || { echo "python3 not found"; exit 1; }

SSH_OPTS=()
SCP_OPTS=()
if [[ -n "${MISSIONCOOKIES_SSH_OPTS:-}" ]]; then
  # shellcheck disable=SC2206
  SSH_OPTS=($MISSIONCOOKIES_SSH_OPTS)
fi
if [[ -n "${MISSIONCOOKIES_SCP_OPTS:-}" ]]; then
  # shellcheck disable=SC2206
  SCP_OPTS=($MISSIONCOOKIES_SCP_OPTS)
fi

STATIC_FILES=(
  ai-ilearning-view.html
  ai-ilearning-view.css
  ai-ilearning-view.js
  ai-exam-test.html
  ai-exam-test.css
  ai-exam-test.js
  ai-exam-window.html
  ai-exam-window.css
  ai-exam-window.js
)

echo "==> Creating remote directories"
ssh "${SSH_OPTS[@]}" "$MISSIONCOOKIES_SSH" "mkdir -p '$MISSIONCOOKIES_WEB_DIR' '$MISSIONCOOKIES_APP_DIR'"

echo "==> Uploading test pages to $MISSIONCOOKIES_WEB_DIR"
scp "${SCP_OPTS[@]}" "${STATIC_FILES[@]}" "$MISSIONCOOKIES_SSH:$MISSIONCOOKIES_WEB_DIR/"

echo "==> Uploading server.js to $MISSIONCOOKIES_APP_DIR"
scp "${SCP_OPTS[@]}" server.js "$MISSIONCOOKIES_SSH:$MISSIONCOOKIES_APP_DIR/server.js"

echo "==> Restarting backend"
ssh "${SSH_OPTS[@]}" "$MISSIONCOOKIES_SSH" "cd '$MISSIONCOOKIES_APP_DIR' && $MISSIONCOOKIES_RESTART_CMD"

echo "==> Running browser automation"
python3 run_missioncookies_ai_test.py
