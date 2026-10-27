#!/usr/bin/env bash
# Fails when a retired logo shape or the old spelling is tracked in the site.
set -euo pipefail
cd "$(dirname "$0")/../.."
bad=0
check() {
  if git grep -nI -F -e "$1" -- . ':!.github/scripts/check-brand.sh' >/dev/null; then
    echo "retired logo ($2) found:"; git grep -nI -F -e "$1" -- . ':!.github/scripts/check-brand.sh' | cut -c1-120; bad=1
  fi
}
check "open""Ctem" "old spelling"
check "92.22 ""39.86" "old C arc"
check 'x="46" y="46" ''width="28"' "round-1 centred square"
exit $bad
