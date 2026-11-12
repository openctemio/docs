#!/usr/bin/env python3
"""Fail when the published site lags the latest releases for too long.

Usage: python3 scripts/versions_monitor.py SITE_VERSIONS_URL [--max-lag-hours H] [--report FILE]

SITE_VERSIONS_URL is the versions.json the site build publishes (the
manifest it built the pages from). For the platform, the sensor and the chart
it compares the published release with the newest stable GitHub release; a
difference is a failure once that release is older than H hours (default 24),
so a release published an hour ago is not an alarm.
"""
import datetime as dt
import json
import os
import re
import sys
import urllib.request

SEMVER = re.compile(r"^v(\d+)\.(\d+)\.(\d+)$")


def get(url, api=False):
    req = urllib.request.Request(url, headers={"User-Agent": "openctem-docs-monitor", "Cache-Control": "no-cache"})
    token = os.environ.get("GH_TOKEN")
    if api and token:
        req.add_header("Authorization", f"Bearer {token}")
    with urllib.request.urlopen(req, timeout=60) as r:  # nosec: fixed https hosts
        return json.loads(r.read())


def newest(repo, prefix=""):
    rows = get(f"https://api.github.com/repos/openctemio/{repo}/releases?per_page=30", api=True)
    best = None
    for r in rows:
        tag = r["tag_name"]
        if r["draft"] or r["prerelease"] or not tag.startswith(prefix):
            continue
        v = tag[len(prefix):]
        v = v if v.startswith("v") else "v" + v
        m = SEMVER.match(v)
        if m and (best is None or tuple(map(int, m.groups())) > best[0]):
            best = (tuple(map(int, m.groups())), v, r["published_at"])
    return best[1], dt.datetime.fromisoformat(best[2].replace("Z", "+00:00"))


def main(argv):
    url = argv[1]
    lag = 24
    report = None
    if "--max-lag-hours" in argv:
        lag = int(argv[argv.index("--max-lag-hours") + 1])
    if "--report" in argv:
        report = argv[argv.index("--report") + 1]
    site = get(url)
    comp = {c["component"]: c["version"] for c in site["components"]}
    published = {
        "platform": site["platform"]["version"],
        "sensor": comp.get("sensor", ""),
        "chart": "v" + site["chart"]["version"],
    }
    latest = {"platform": newest("openctem"), "sensor": newest("sensor"), "chart": newest("helm-charts", "openctem-")}
    now = dt.datetime.now(dt.timezone.utc)
    lines, bad = [], False
    for key, (version, at) in latest.items():
        age = (now - at).total_seconds() / 3600
        stale = published[key] != version and age > lag
        bad |= stale
        state = "STALE" if stale else ("ok" if published[key] == version else f"new release {age:.0f} h old")
        lines.append(f"| {key} | {published[key]} | {version} | {state} |")
    text = "| | site | latest | |\n|---|---|---|---|\n" + "\n".join(lines) + "\n"
    print(text)
    if report:
        with open(report, "w", encoding="utf-8") as f:
            f.write(text)
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
