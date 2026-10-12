#!/usr/bin/env bash
#
# regen-report-tag-reference.sh: refresh the Tag reference at the end of
# pentest/report-templates.md from an openctem checkout.
#
# The reference is generated in openctem by report.TemplateReferenceMarkdown()
# and kept current in api/docs/architecture/pentest-report-templates.md (a test
# there fails when it is stale). This script copies that block, between the
# GENERATED TAG REFERENCE markers, into the guide. Never edit the block by hand.
#
# Usage:
#   scripts/regen-report-tag-reference.sh <path to an openctem checkout>

set -euo pipefail

src="${1:?usage: $0 <openctem checkout>}"
docs="$(cd "$(dirname "$0")/.." && pwd)"
from="$src/api/docs/architecture/pentest-report-templates.md"
page="$docs/pentest/report-templates.md"

[ -f "$from" ] || { echo "regen-report-tag-reference: $from not found" >&2; exit 2; }

python3 - "$from" "$page" <<'PY'
import re
import sys
begin, end = "<!-- BEGIN GENERATED TAG REFERENCE -->", "<!-- END GENERATED TAG REFERENCE -->"
src, page = sys.argv[1], sys.argv[2]

def split(text, name):
    i, j = text.find(begin), text.find(end)
    if i < 0 or j < i:
        sys.exit(f"regen-report-tag-reference: {name} lacks the generated reference markers")
    return text[:i + len(begin)], text[i + len(begin):j], text[j:]

block = split(open(src, encoding="utf-8").read(), src)[1].strip("\n")
# The source escapes "|" as "\|" everywhere for GitHub's renderer. kramdown
# keeps the backslash inside a code span (and needs no escape there), so drop
# it within code spans.
block = re.sub(r"`[^`\n]*`", lambda m: m.group(0).replace("\\|", "|"), block)
head, _, tail = split(open(page, encoding="utf-8").read(), page)
# Blank lines on both sides: kramdown only ends a table at a blank line, so a
# table glued to the next line renders as a paragraph of raw pipes.
open(page, "w", encoding="utf-8").write(head + "\n\n" + block + "\n\n" + tail)
print(f"regen-report-tag-reference: {block.count(chr(10)) + 1} lines written into {page}")
PY
