#!/usr/bin/env python3
"""Write _data/versions.yml from the latest GitHub releases.

Usage: GH_TOKEN=... python3 scripts/sync_versions.py [--check] [ROOT]

Reads the latest release of each repository with the gh CLI and rewrites the
values of _data/versions.yml in place (comments and order are kept). With
--check it changes nothing and exits 1 when a value differs. A release that
cannot be read is an error: the file is never written half-updated.
"""
import base64
import json
import re
import subprocess
import sys

ORG = "openctemio"
SEMVER = re.compile(r"^v\d+\.\d+\.\d+$")


def gh_json(path):
    out = subprocess.run(["gh", "api", path], check=True, capture_output=True, text=True).stdout
    return json.loads(out)


def latest_tag(repo):
    tag = gh_json(f"repos/{ORG}/{repo}/releases/latest")["tag_name"]
    return tag


def chart_versions():
    """The newest openctem chart release and its appVersion."""
    tag = latest_tag("helm-charts")  # openctem-X.Y.Z
    m = re.fullmatch(r"openctem-(\d+\.\d+\.\d+)", tag)
    if not m:
        raise ValueError(f"helm-charts latest release {tag!r} is not openctem-X.Y.Z")
    meta = gh_json(f"repos/{ORG}/helm-charts/contents/charts/openctem/Chart.yaml?ref={tag}")
    chart_yaml = base64.b64decode(meta["content"]).decode()
    app = re.search(r'^appVersion:\s*"?([^"\s]+)"?', chart_yaml, re.M)
    if not app:
        raise ValueError(f"no appVersion in charts/openctem/Chart.yaml at {tag}")
    return m.group(1), app.group(1)


def wanted():
    chart, chart_app = chart_versions()
    values = {
        "platform": latest_tag("openctem"),
        "sensor": latest_tag("sensor"),
        "sdk_go": latest_tag("sdk-go"),
        "ci": latest_tag("ci"),
        "chart": chart,
        "chart_app": chart_app,
    }
    for key in ("platform", "sensor", "sdk_go", "ci", "chart_app"):
        if not SEMVER.match(values[key]):
            raise ValueError(f"{key}: {values[key]!r} is not vX.Y.Z")
    return values


def main(argv):
    args = [a for a in argv[1:] if a != "--check"]
    check = "--check" in argv
    root = args[0] if args else "."
    path = f"{root}/_data/versions.yml"
    want = wanted()
    with open(path, encoding="utf-8") as f:
        lines = f.read().splitlines(keepends=True)
    seen, changed, out = set(), [], []
    for line in lines:
        m = re.match(r"^([a-z_]+):(\s*)(\S+)(.*)$", line.rstrip("\n"))
        if m and m.group(1) in want:
            key, old = m.group(1), m.group(3)
            seen.add(key)
            new = want[key]
            if old != new:
                changed.append(f"{key}: {old} -> {new}")
                # Keep the comment column when the value's width changes.
                rest = m.group(4)
                head = f"{key}:{m.group(2)}{new}"
                if rest.strip():
                    col = len(f"{key}:{m.group(2)}{old}") + len(rest) - len(rest.lstrip())
                    head = head.ljust(col) if len(head) < col else head + " "
                line = head + rest.lstrip() + "\n"
        out.append(line)
    for key in sorted(set(want) - seen):
        changed.append(f"{key}: (new) {want[key]}")
        out.append(f"{key}: {want[key]}\n")
    for c in changed:
        print(c)
    if check:
        return 1 if changed else 0
    if changed:
        with open(path, "w", encoding="utf-8") as f:
            f.writelines(out)
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
