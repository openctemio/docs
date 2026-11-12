#!/usr/bin/env python3
"""Write the environment variable tables of the current release at build time.

Usage: python3 scripts/env_reference.py [--offline] [ROOT]

The platform generates its environment variable reference from the registry
the code reads (`make env-docs`: <backend dir>/docs/configuration/
environment-variables.md, kept equal to the code by a test). This copies the
tables of that file at the platform release the site documents
(_data/manifest.json, from scripts/versions_manifest.py) into
_includes/generated/env-reference.md, which configuration/environment-variables.md
includes. Nothing is written by hand and nothing is committed, so the page
always lists exactly what the released API reads.

--offline writes a short notice instead (local builds without network).
"""
import json
import re
import os
import sys
import urllib.error
import urllib.request

RAW = "https://raw.githubusercontent.com/openctemio/openctem/{tag}/{dir}/docs/configuration/environment-variables.md"
START = "## API server"


def main(argv):
    args = [a for a in argv[1:] if not a.startswith("--")]
    root = args[0] if args else "."
    out_dir = os.path.join(root, "_includes", "generated")
    os.makedirs(out_dir, exist_ok=True)
    out = os.path.join(out_dir, "env-reference.md")
    if "--offline" in argv:
        with open(out, "w", encoding="utf-8") as f:
            f.write("*Offline build: the variable tables are added when the site is built with network access.*\n")
        return 0
    with open(os.path.join(root, "_data", "manifest.json"), encoding="utf-8") as f:
        tag = json.load(f)["platform"]["version"]
    text = None
    for d in ("server", "api"):
        url = RAW.format(tag=tag, dir=d)
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "openctem-docs-build"}),
                                        timeout=60) as r:  # nosec: fixed https host
                text = r.read().decode("utf-8")
            break
        except urllib.error.HTTPError as e:
            if e.code != 404:
                raise
    if text is None or START not in text:
        raise SystemExit(f"env_reference: no environment variable reference at {tag}")
    body = text[text.index(START):]
    # kramdown needs no escape for a pipe inside a code span (it would print the backslash).
    body = re.sub(r"`[^`\n]*`", lambda m: m.group(0).replace("\\|", "|"), body)
    with open(out, "w", encoding="utf-8") as f:
        f.write(f"<!-- Generated at build time from the {tag} release by scripts/env_reference.py. -->\n")
        f.write("{% raw %}\n" + body.rstrip("\n") + "\n{% endraw %}\n")
    print(f"env_reference: {tag}: {body.count(chr(10))} lines")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
