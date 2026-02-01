#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PROFILE_DIR="${PROFILE_DIR:-${ROOT_DIR}/firefox-bidi-profile}"
PORT="${GECKODRIVER_PORT:-4444}"
GECKODRIVER_BIN="${GECKODRIVER_BIN:-geckodriver}"

LOG_FILE="${GECKODRIVER_LOG:-${ROOT_DIR}/geckodriver.log}"

"${GECKODRIVER_BIN}" --port "${PORT}" >"${LOG_FILE}" 2>&1 &
GECKODRIVER_PID=$!

cleanup() {
  if ps -p "${GECKODRIVER_PID}" >/dev/null 2>&1; then
    kill "${GECKODRIVER_PID}" || true
  fi
}
trap cleanup EXIT

node "${ROOT_DIR}/client.js" --geckodriver "http://127.0.0.1:${PORT}" --profile "${PROFILE_DIR}"
