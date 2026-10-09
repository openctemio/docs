#!/usr/bin/env bash
#
# regen-authz-reference.sh: regenerate identity/authorization/ (the role and
# permission matrix, the personas page and one permissions page per feature)
# from an openctem checkout. The pages are generated from the API source by
# `cmd/gen-authz-docs`; never edit them by hand.
#
# Usage:
#   scripts/regen-authz-reference.sh <path to an openctem checkout>
#
# Needs Go (the version in the checkout's api/go.mod).

set -euo pipefail

src="${1:?usage: $0 <openctem checkout>}"
docs="$(cd "$(dirname "$0")/.." && pwd)"
out="$docs/identity/authorization"

[ -f "$src/api/cmd/gen-authz-docs/main.go" ] || {
  echo "regen-authz-reference: $src has no api/cmd/gen-authz-docs (needs an openctem release that ships it)" >&2
  exit 2
}

# Start from an empty directory so a removed feature page disappears.
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
(cd "$src/api" && GOWORK=off go run ./cmd/gen-authz-docs -json "" -md "$tmp" -front-matter)
mkdir -p "$out"
find "$out" -name '*.md' -delete
cp -R "$tmp"/. "$out"/
echo "regen-authz-reference: wrote $(find "$out" -name '*.md' | wc -l) pages into identity/authorization/"
