#!/usr/bin/env bash
set -euo pipefail

PROFILE_DIR="${1:-$(pwd)/firefox-bidi-profile}"
PROFILE_NAME="${2:-bidi-debug}"

FIREFOX_BIN="${FIREFOX_BIN:-}"
if [[ -z "${FIREFOX_BIN}" ]]; then
  if command -v firefox >/dev/null 2>&1; then
    FIREFOX_BIN="firefox"
  elif [[ -x "/Applications/Firefox.app/Contents/MacOS/firefox" ]]; then
    FIREFOX_BIN="/Applications/Firefox.app/Contents/MacOS/firefox"
  elif [[ -x "/Applications/Firefox.app/Contents/MacOS/firefox-bin" ]]; then
    FIREFOX_BIN="/Applications/Firefox.app/Contents/MacOS/firefox-bin"
  else
    echo "Could not find Firefox binary. Set FIREFOX_BIN=/path/to/firefox" >&2
    exit 1
  fi
fi

if [[ -e "${PROFILE_DIR}" ]]; then
  echo "Profile dir already exists: ${PROFILE_DIR}" >&2
  echo "Pick a new path or delete the directory first." >&2
  exit 1
fi

mkdir -p "$(dirname "${PROFILE_DIR}")"

"${FIREFOX_BIN}" -CreateProfile "${PROFILE_NAME} ${PROFILE_DIR}"

echo "Created profile: ${PROFILE_NAME}"
echo "Directory: ${PROFILE_DIR}"
