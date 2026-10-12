#!/usr/bin/env bash
# On a 1GB host, acquire the singleton slot before allocating the CLI container.
# The core DB lock remains necessary across hosts and publication/GC transactions.
set -euo pipefail
cd /opt/yoryon
exec flock --wait 120 /var/lock/yoryon-cli.lock \
  docker compose -f compose.neon.yml run --rm --name yoryon-cli-run cli "$@"
