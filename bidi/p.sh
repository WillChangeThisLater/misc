#!/bin/bash

set -euo pipefail

main() {
	cat <<EOF
$(tsc client.ts)
EOF
}

main
