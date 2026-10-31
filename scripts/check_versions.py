#!/usr/bin/env python3
"""Install guides take the current releases from _data/versions.yml.

Usage: python3 scripts/check_versions.py [ROOT]

Fails when:
  - _data/versions.yml is missing a key or holds a malformed version;
  - a page reads site.data.versions.<key> for a key the file does not have
    (Liquid prints nothing for it, so the command on the page breaks silently),
    or reads it inside a {% raw %} block (printed literally);
  - a page hard-codes a release where a guide installs or pins one: a sensor or
    platform image tag, a sensor file or cosign identity at a tag,
    SENSOR_VERSION=, OPENCTEM_VERSION=, NEW_VERSION=, openctem_version or
    git checkout vX.Y.Z. Write {{ site.data.versions.sensor }} (or platform)
    instead; the versions-sync workflow keeps the data file current.

History stays as written ("from v0.16.0", an upgrade step to one release).
A line that must pin a release on purpose carries the marker
`docs-check: pinned-version` (in an HTML comment, or a code comment inside a
code block); EXAMPLE_FILES are worked examples that pin on purpose.
"""
import os
import re
import sys

KEYS = {
    "platform": r"v\d+\.\d+\.\d+",
    "sensor": r"v\d+\.\d+\.\d+",
    "sdk_go": r"v\d+\.\d+\.\d+",
    "ci": r"v\d+\.\d+\.\d+",
    "chart": r"\d+\.\d+\.\d+",
    "chart_app": r"v\d+\.\d+\.\d+",
}
SKIP_DIRS = {".git", "node_modules", "_site", "vendor", ".jekyll-cache", "changelog.d", "testdata", "scripts"}
SKIP_FILES = {"CHANGELOG.md", "README.md", "CONTRIBUTING.md"}
# Worked examples with image digests: the reader replaces every version.
EXAMPLE_FILES = {"install/air-gapped.md"}
MARKER = "docs-check: pinned-version"

V = r"v\d+\.\d+\.\d+"
PINS = [
    ("sensor", re.compile(r"openctemio/sensor:" + V)),
    ("sensor", re.compile(r"openctemio/sensor/" + V + r"/")),
    ("sensor", re.compile(r"openctemio/sensor/\.github/workflows/[\w.-]+@refs/tags/" + V)),
    ("sensor", re.compile(r"\bSENSOR_VERSION=" + V)),
    ("platform", re.compile(r"ghcr\.io/openctemio/openctem(?:-[a-z]+)?:" + V)),
    ("platform", re.compile(r"\b(?:OPENCTEM_VERSION|NEW_VERSION)=" + V)),
    ("platform", re.compile(r"\bopenctem_version[:=] ?" + V)),
    ("platform", re.compile(r"\bgit (?:-C \S+ )?checkout " + V)),
]
REF = re.compile(r"site\.data\.versions\.([A-Za-z0-9_]+)")
RAW_OPEN = re.compile(r"{%-?\s*raw\s*-?%}")
RAW_CLOSE = re.compile(r"{%-?\s*endraw\s*-?%}")


def load_data(root):
    path = os.path.join(root, "_data", "versions.yml")
    data, errors = {}, []
    try:
        with open(path, encoding="utf-8") as f:
            for n, line in enumerate(f, 1):
                line = line.split("#", 1)[0].strip()
                if not line:
                    continue
                m = re.fullmatch(r'([a-z_]+):\s*"?([^"\s]+)"?', line)
                if not m:
                    errors.append(f"_data/versions.yml:{n}: not 'key: value'")
                    continue
                data[m.group(1)] = m.group(2)
    except OSError as e:
        return {}, [f"_data/versions.yml: {e}"]
    for key, pattern in KEYS.items():
        if key not in data:
            errors.append(f"_data/versions.yml: missing {key}")
        elif not re.fullmatch(pattern, data[key]):
            errors.append(f"_data/versions.yml: {key} is {data[key]!r}, not a release")
    return data, errors


def check_page(rel, text, data):
    errors = []
    in_raw = False
    for n, line in enumerate(text.splitlines(), 1):
        # Walk the line in order: refs are judged by the raw state where they stand.
        pos = 0
        while True:
            opener = (RAW_CLOSE if in_raw else RAW_OPEN).search(line, pos)
            end = opener.start() if opener else len(line)
            for m in REF.finditer(line[pos:end]):
                if in_raw:
                    errors.append(f"{rel}:{n}: site.data.versions.{m.group(1)} inside {{% raw %}} is printed literally; close the raw block around it")
                elif m.group(1) not in data:
                    errors.append(f"{rel}:{n}: site.data.versions.{m.group(1)} is not in _data/versions.yml")
            if not opener:
                break
            in_raw = not in_raw
            pos = opener.end()
        if rel in EXAMPLE_FILES or MARKER in line:
            continue
        for key, rx in PINS:
            m = rx.search(line)
            if m:
                errors.append(f"{rel}:{n}: '{m.group(0)}' hard-codes a release; use {{{{ site.data.versions.{key} }}}}")
                break
    return errors


def main(argv):
    root = argv[1] if len(argv) > 1 else "."
    data, errors = load_data(root)
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = sorted(d for d in dirnames if d not in SKIP_DIRS)
        for name in sorted(filenames):
            if not name.endswith(".md") or name in SKIP_FILES:
                continue
            path = os.path.join(dirpath, name)
            rel = os.path.relpath(path, root).replace(os.sep, "/")
            with open(path, encoding="utf-8") as f:
                errors.extend(check_page(rel, f.read(), data))
    for e in errors:
        print(e)
    if errors:
        print(f"check_versions: {len(errors)} problem(s)")
        return 1
    print("check_versions: every guide takes its releases from _data/versions.yml")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
