#!/usr/bin/env python3
"""Write the current releases into the site's data files at build time.

Usage: python3 scripts/versions_manifest.py [--verify] [--offline] [--write-snapshot] [ROOT]

Nothing this script writes is committed: the site build runs it, so a release
needs no commit in this repository. It reads the signed versions manifest the
platform's Release Feed workflow publishes (schema openctem.io/versions/v1):

  1. https://get.openctem.io/releases/manifest.json             (the stable address)
  2. https://github.com/openctemio/openctem/releases/latest/download/openctem-versions.json
                                                                 (the same file, until 1 answers)
  3. built here from the public GitHub releases, in the same schema (until the
     platform release that publishes the manifest is out); the image digests
     come from the release's signed image list.

--verify   checks every signature with cosign (CI does; a manifest or image
           list whose signature fails stops the build: the published site stays
           as it was).
--offline  uses scripts/versions-snapshot.json (local builds without network
           only; never in CI). --write-snapshot refreshes that file from the
           sources above; nobody edits it by hand.

Writes (all git-ignored):
  _data/versions.yml    flat keys the pages print: {{ site.data.versions.platform }} ...
  _data/manifest.json   the whole manifest: {{ site.data.manifest.components }} ...
  versions.json         the manifest as published with the site (the freshness monitor reads it)
"""
import base64
import datetime as dt
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import urllib.error
import urllib.request

SCHEMA = "openctem.io/versions/v1"
ORG = "openctemio"
MANIFEST_URLS = [
    "https://get.openctem.io/releases/manifest.json",
    f"https://github.com/{ORG}/openctem/releases/latest/download/openctem-versions.json",
]
FEED_IDENTITY = r"^https://github\.com/openctemio/openctem/\.github/workflows/release-feed\.yml@refs/(heads/main|tags/v[0-9]+\.[0-9]+\.[0-9]+)$"
IMAGES_IDENTITY = r"^https://github\.com/openctemio/openctem/\.github/workflows/docker-publish\.yml@refs/tags/v[0-9]+\.[0-9]+\.[0-9]+$"
ISSUER = "https://token.actions.githubusercontent.com"
HELM_INDEX = f"https://{ORG}.github.io/helm-charts/index.yaml"
SEMVER = re.compile(r"^v(\d+)\.(\d+)\.(\d+)$")
# Component name (as in versions.yaml and the manifest) -> repository, image.
COMPONENTS = [
    ("sensor", "sensor", "ghcr.io/openctemio/sensor"),
    ("connector-tenable", "connector-tenable", "ghcr.io/openctemio/connector-tenable"),
    ("sdk", "sdk-go", ""),
    ("ci", "ci", "ghcr.io/openctemio/ci"),
]
UPGRADE_URL = "https://docs.openctem.io/operations/upgrade/"


def vkey(v):
    m = SEMVER.match(v)
    return tuple(int(x) for x in m.groups()) if m else (-1, -1, -1)


def fetch(url, api=False):
    req = urllib.request.Request(url, headers={"User-Agent": "openctem-docs-build"})
    token = os.environ.get("GH_TOKEN") or os.environ.get("GITHUB_TOKEN")
    if api and token:
        req.add_header("Authorization", f"Bearer {token}")
        req.add_header("Accept", "application/vnd.github+json")
    with urllib.request.urlopen(req, timeout=60) as r:  # nosec: fixed https hosts
        return r.read()


def gh(path):
    return json.loads(fetch(f"https://api.github.com/{path}", api=True))


def cosign_verify(blob, bundle, identity, label):
    if shutil.which("cosign") is None:
        raise SystemExit("versions: --verify needs cosign on PATH")
    with tempfile.TemporaryDirectory() as d:
        b, s = os.path.join(d, "blob"), os.path.join(d, "bundle.json")
        open(b, "wb").write(blob)
        open(s, "wb").write(bundle)
        p = subprocess.run(["cosign", "verify-blob", "--bundle", s, "--certificate-identity-regexp", identity,
                            "--certificate-oidc-issuer", ISSUER, b], capture_output=True, text=True)
    if p.returncode != 0:
        raise SystemExit(f"versions: the signature of {label} does not verify; nothing written\n{p.stderr.strip()}")


def published_manifest(verify):
    """The manifest the release pipeline published, or None when none is published yet."""
    for url in MANIFEST_URLS:
        try:
            raw = fetch(url)
            sig = fetch(url + ".sigstore.json") if url.endswith("manifest.json") else fetch(url + ".sigstore.json")
        except (urllib.error.URLError, TimeoutError, OSError) as e:
            print(f"versions: {url}: {e}; trying the next source", file=sys.stderr)
            continue
        if verify:
            cosign_verify(raw, sig, FEED_IDENTITY, url)
        m = json.loads(raw)
        if m.get("schema") != SCHEMA:
            raise SystemExit(f"versions: {url} has schema {m.get('schema')!r}, this build reads {SCHEMA}")
        return m, url
    return None, None


def latest_release(repo):
    rows = gh(f"repos/{ORG}/{repo}/releases?per_page=50")
    rows = [r for r in rows if not r["draft"] and not r["prerelease"] and SEMVER.match(r["tag_name"])]
    if not rows:
        raise SystemExit(f"versions: {ORG}/{repo} has no stable release")
    rows.sort(key=lambda r: vkey(r["tag_name"]), reverse=True)
    return rows


def parse_min(versions_yaml):
    """The 'min' value of each section of versions.yaml (two levels, key: value)."""
    out, section = {}, None
    for line in versions_yaml.splitlines():
        if not line.strip() or line.lstrip().startswith("#"):
            continue
        if not line.startswith(" "):
            section = line.rstrip(":").strip()
            continue
        k, _, v = line.strip().partition(":")
        v = v.strip().strip('"')
        if k == "min" and v:
            out[section] = v
    return out


def parse_chart(index_yaml):
    """The newest stable openctem chart and its appVersion (no YAML library on the runner)."""
    best, in_entries, in_chart, cur = None, False, False, {}
    def take(e):
        nonlocal best
        if re.fullmatch(r"\d+\.\d+\.\d+", e.get("version", "")) and SEMVER.match(e.get("appVersion", "")):
            if best is None or vkey("v" + e["version"]) > vkey("v" + best["version"]):
                best = dict(e)
    for line in index_yaml.splitlines():
        if line.startswith("entries:"):
            in_entries = True
            continue
        if in_entries and re.match(r"^  [A-Za-z0-9]", line):
            if in_chart and cur:
                take(cur)
            in_chart, cur = line.strip() == "openctem:", {}
            continue
        if in_entries and not line.startswith(" ") and line.strip():
            in_entries = False
        if not in_chart:
            continue
        m = re.match(r"^  - (\w+):\s*\"?([^\"\s]*)\"?", line)
        if m:
            if cur:
                take(cur)
            cur = {}
            line = "    " + line[4:]
        m = re.match(r"^    (version|appVersion):\s*\"?([^\"\s]+)\"?\s*$", line)
        if m:
            cur[m.group(1)] = m.group(2)
    if in_chart and cur:
        take(cur)
    if not best:
        raise SystemExit("versions: no stable openctem chart in the Helm index")
    return {"name": "openctem", "repository": f"https://{ORG}.github.io/helm-charts",
            "version": best["version"], "app_version": best["appVersion"]}


def built_manifest(verify):
    """The same schema, built from the public releases (until the pipeline publishes one)."""
    rows = latest_release("openctem")
    plat = rows[0]
    tag = plat["tag_name"]
    assets = {a["name"]: a["browser_download_url"] for a in plat["assets"]}
    name = f"openctem-images-{tag}.txt"
    if name not in assets:
        raise SystemExit(f"versions: {tag} has no {name} yet")
    images_txt = fetch(assets[name])
    if verify:
        cosign_verify(images_txt, fetch(assets[name + ".sigstore.json"]), IMAGES_IDENTITY, name)
    images = []
    for line in images_txt.decode().splitlines():
        f = line.split()
        if not f or f[0].startswith("#"):
            continue
        if len(f) < 3 or not f[1].startswith("ghcr.io/openctemio/") or not f[1].endswith(":" + tag) \
                or not re.fullmatch(r"sha256:[0-9a-f]{64}", f[2]):
            raise SystemExit(f"versions: {name}: unexpected line {line!r}")
        images.append({"name": f[0], "ref": f[1], "digest": f[2]})
    vy = base64.b64decode(gh(f"repos/{ORG}/openctem/contents/versions.yaml?ref={tag}")["content"]).decode()
    compat = []
    for ref in ("main", "develop"):
        try:
            compat = json.loads(base64.b64decode(gh(
                f"repos/{ORG}/openctem/contents/.github/release-feed/compat.json?ref={ref}")["content"]))["requires"]
            break
        except urllib.error.HTTPError:
            continue
    comps = []
    for comp, repo, image in COMPONENTS:
        r = latest_release(repo)[0]
        c = {"component": comp, "repository": f"{ORG}/{repo}", "version": r["tag_name"],
             "published_at": r["published_at"], "notes_url": r["html_url"]}
        if image:
            c["image"] = image
        reqs = sorted((e for e in compat if e["component"] == comp and vkey(c["version"]) >= vkey(e["from"])),
                      key=lambda e: vkey(e["from"]))
        if reqs:
            c["requirements"] = reqs
            c["requires_platform"] = max((e["platform"] for e in reqs), key=vkey)
        comps.append(c)
    mins = parse_min(vy)
    accepts = {k: v for k, v in mins.items() if k in {c for c, _, _ in COMPONENTS}}
    return {
        "schema": SCHEMA,
        "generated_at": dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "platform": {
            "version": tag, "published_at": plat["published_at"], "notes_url": plat["html_url"],
            "upgrade_url": UPGRADE_URL, "images": images, "accepts": accepts,
            "previous": [{"version": r["tag_name"], "published_at": r["published_at"], "notes_url": r["html_url"]}
                         for r in rows[1:11]],
        },
        "components": comps,
        "chart": parse_chart(fetch(HELM_INDEX).decode()),
        "advisories": [],
    }


def flat(m, source):
    comp = {c["component"]: c for c in m["components"]}
    img = {i["name"]: i for i in m["platform"]["images"]}
    v = {
        "platform": m["platform"]["version"],
        "platform_date": m["platform"]["published_at"][:10],
        "sensor": comp["sensor"]["version"],
        "sensor_requires_platform": comp["sensor"].get("requires_platform", ""),
        "sdk_go": comp["sdk"]["version"],
        "ci": comp["ci"]["version"],
        "connector_tenable": comp.get("connector-tenable", {}).get("version", ""),
        "chart": m["chart"]["version"],
        "chart_app": m["chart"]["app_version"],
        "min_sensor": m["platform"]["accepts"].get("sensor", ""),
        "min_sdk_go": m["platform"]["accepts"].get("sdk", ""),
        "min_ci": m["platform"]["accepts"].get("ci", ""),
        "digest_openctem": img.get("openctem", {}).get("digest", ""),
        "digest_api": img.get("openctem-api", {}).get("digest", ""),
        "digest_web": img.get("openctem-web", {}).get("digest", ""),
        "digest_console": img.get("openctem-console", {}).get("digest", ""),
        "digest_migrations": img.get("migrations", {}).get("digest", ""),
        "digest_sensor": comp["sensor"].get("digest", ""),
        # The backend directory of a release checkout: the Go backend moved
        # from api/ to server/ after v0.21.x, so guides that cd into the
        # checkout print the one of the release they install.
        "backend_dir": "server" if vkey(m["platform"]["version"]) >= (0, 22, 0) else "api",
        "source": source,
    }
    for key in ("platform", "sensor", "sdk_go", "ci", "chart_app"):
        if not SEMVER.match(v[key]):
            raise SystemExit(f"versions: {key} is {v[key]!r}, not vX.Y.Z")
    if not re.fullmatch(r"\d+\.\d+\.\d+", v["chart"]):
        raise SystemExit(f"versions: chart is {v['chart']!r}")
    return v


def write(root, m, source):
    v = flat(m, source)
    os.makedirs(os.path.join(root, "_data"), exist_ok=True)
    with open(os.path.join(root, "_data", "versions.yml"), "w", encoding="utf-8") as f:
        f.write("# Generated at build time by scripts/versions_manifest.py; not committed.\n")
        for k, val in v.items():
            f.write(f'{k}: "{val}"\n')
    for path in (os.path.join(root, "_data", "manifest.json"), os.path.join(root, "versions.json")):
        with open(path, "w", encoding="utf-8") as f:
            json.dump(m, f, indent=2)
            f.write("\n")
    print(f"versions: platform {v['platform']}, sensor {v['sensor']}, sdk-go {v['sdk_go']}, ci {v['ci']}, "
          f"chart {v['chart']} ({v['chart_app']}) from {source}")


def main(argv):
    args = [a for a in argv[1:] if not a.startswith("--")]
    root = args[0] if args else "."
    snapshot = os.path.join(root, "scripts", "versions-snapshot.json")
    if "--offline" in argv:
        with open(snapshot, encoding="utf-8") as f:
            m = json.load(f)
        print("versions: OFFLINE build from scripts/versions-snapshot.json (may be behind; never published)",
              file=sys.stderr)
        write(root, m, "snapshot")
        return 0
    verify = "--verify" in argv
    m, source = published_manifest(verify)
    if m is None:
        m, source = built_manifest(verify), "github-releases"
    if "--write-snapshot" in argv:
        with open(snapshot, "w", encoding="utf-8") as f:
            json.dump(m, f, indent=2)
            f.write("\n")
    write(root, m, source)
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
