#!/usr/bin/env bash
# One entry point for fresh installs and updates, from any working directory.
set -euo pipefail
exec bash "$(dirname -- "${BASH_SOURCE[0]}")/scripts/deploy.sh" "$@"
