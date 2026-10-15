#!/usr/bin/env bash
# Fails when the repository tracks a path that is private by policy: commercial
# material, internal planning notes, research and review notes. These folders
# are listed in .gitignore; this check also catches a forced add (git add -f)
# and a merge that brings them back. Prints the offending paths only.
# Run from the repository root: bash .github/scripts/check-private-paths.sh
set -euo pipefail

# _commercial/ and _internal/ at any depth; the others only at the top level.
pattern='(^|/)_(commercial|internal)/|^(internal|research|reviews|marketing)/'

hits="$(git ls-files -z | tr "\0" "\n" | grep -E "$pattern" || true)"
if [[ -n "$hits" ]]; then
  echo "::error::private paths are tracked; remove them (they belong outside this public repository):"
  printf "%s\n" "$hits"
  exit 1
fi
echo "no private paths tracked"
