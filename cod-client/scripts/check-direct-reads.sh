#!/usr/bin/env bash
#
# Guardrail: enforces the direct-reads architecture.
#
# `cod-client/actions/*.ts` may only call `apiClient.get` from these functions,
# which proxy carrier lookups or Meta Pixel config through the cod-server Worker
# (encrypted credentials live there):
#
#   - fetchCompanyStopDesks   (delivery-companies.ts)
#   - getShipmentTracking     (orders.ts)
#   - getPixelConfig          (stores.ts)
#
# Any other `apiClient.get` in actions/*.ts is a regression — reads should hit
# D1 directly via `cod-shared/queries/*`. Run via `npm run check:reads`.

set -euo pipefail

cd "$(dirname "$0")/.."

ALLOWED='fetchCompanyStopDesks getShipmentTracking getPixelConfig'

bad=0
while IFS= read -r hit; do
  file="${hit%%:*}"
  rest="${hit#*:}"
  lineno="${rest%%:*}"

  # Walk up from lineno to find the nearest `async function <name>(` declaration.
  func=$(awk -v n="$lineno" '
    NR <= n {
      if ($0 ~ /async[[:space:]]+function[[:space:]]+[A-Za-z0-9_]+/) {
        line = $0
        sub(/.*async[[:space:]]+function[[:space:]]+/, "", line)
        sub(/[^A-Za-z0-9_].*/, "", line)
        current = line
      }
    }
    END { print current }
  ' "$file")

  if ! printf '%s\n' $ALLOWED | grep -qx "$func"; then
    echo "VIOLATION: $file:$lineno — apiClient.get inside '$func' (allowlist: $ALLOWED)"
    bad=$((bad+1))
  fi
done < <(grep -rn 'apiClient\.get' actions/*.ts || true)

if [ "$bad" -gt 0 ]; then
  echo ""
  echo "Found $bad disallowed apiClient.get call(s)."
  echo "Reads should hit D1 directly via cod-shared/queries/*."
  exit 1
fi

echo "ok: all apiClient.get calls are in the carrier-API allowlist"
