#!/usr/bin/env bash
set -euo pipefail

# start the geckodriver
# see: https://github.com/mozilla/geckodriver
# as i understand it, gecko driver is a middleman providing
# an HTTP API for browser automation

PORT="${1:-4444}"
GECKODRIVER_BIN="${GECKODRIVER_BIN:-geckodriver}"

"${GECKODRIVER_BIN}" --port "${PORT}"
