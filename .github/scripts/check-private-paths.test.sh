#!/usr/bin/env bash
# Tests for check-private-paths.sh. Run: bash .github/scripts/check-private-paths.test.sh
# Builds throwaway git repositories; touches nothing in this one.
set -euo pipefail
script="$(cd "$(dirname "$0")" && pwd)/check-private-paths.sh"
pass=0 failed=0

repo() {
  local d; d="$(mktemp -d)"
  git -C "$d" init -q -b main
  echo "$d"
}
# put <repo> <path>: create and force-add a file (force, as .gitignore may list it)
put() { mkdir -p "$(dirname "$1/$2")"; echo x > "$1/$2"; git -C "$1" add -f "$2"; }

# expect <name> <0|1> <repo> [must-contain]
expect() {
  local name="$1" want="$2" d="$3" needle="${4:-}" out rc=0
  out="$(cd "$d" && bash "$script" 2>&1)" || rc=$?
  if [[ "$rc" -ne "$want" ]] || [[ -n "$needle" && "$out" != *"$needle"* ]]; then
    echo "FAIL: $name (exit $rc, want $want)"; echo "$out"; failed=$((failed + 1))
  else
    echo "ok:   $name"; pass=$((pass + 1))
  fi
}

d="$(repo)"; put "$d" index.md; put "$d" operations/internal-ca.md; put "$d" sensors/internal/x.md
expect "public tree passes (internal only as a word or nested folder)" 0 "$d"

d="$(repo)"; put "$d" _commercial/saas/plans.md
expect "top-level _commercial fails" 1 "$d" "_commercial/saas/plans.md"

d="$(repo)"; put "$d" docs/_internal/notes.md
expect "nested _internal fails" 1 "$d" "docs/_internal/notes.md"

for p in internal/a.md research/b.md reviews/c.md marketing/d.md; do
  d="$(repo)"; put "$d" "$p"
  expect "top-level $p fails" 1 "$d" "$p"
done

d="$(repo)"; put "$d" index.md; mkdir -p "$d/_commercial"; echo y > "$d/_commercial/a.md"
expect "untracked copy on disk passes" 0 "$d"

echo "passed $pass, failed $failed"
[[ "$failed" -eq 0 ]]
