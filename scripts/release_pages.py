#!/usr/bin/env python3
"""Write one "What changed" page per platform release at build time.

Usage: python3 scripts/release_pages.py [--count N] [ROOT]

Nothing this script writes is committed. Every user-visible change of the
platform is a changelog fragment (`<backend dir>/changelog.d/*.md`, one file
per change, `### <Category>: <title>` sections) and a fragment stays in that
directory until it is released and folded. So the changes of release vX.Y.Z
are exactly the fragments present at tag vX.Y.Z and absent at the release
before it. For the newest N stable releases (default 6, from
_data/manifest.json, written by scripts/versions_manifest.py) this fetches
those two sets (a blob-less, sparse, depth-1 clone per tag: no API calls) and
writes operations/releases/<vX-Y-Z>.md: the upgrade notes first, then the
sections in release order (Security, Behaviour change, Removed, Deprecated,
Added, Changed, Fixed). _data/releases.json lists the pages for the upgrade
guide's table.
"""
import json
import os
import re
import subprocess
import sys
import tempfile

REPO = "https://github.com/openctemio/openctem.git"
ORDER = ["Security", "Behaviour change", "Removed", "Deprecated", "Added", "Changed", "Fixed"]
HEADING = re.compile(r"^### (" + "|".join(ORDER) + r"): (.+)$")
UPGRADE = re.compile(r"\*\*Upgrade notes?:?\*\*:?|^\s*-\s*Upgrade notes?:", re.I)
DIRS = ("server/changelog.d", "api/changelog.d")


def fragments(tag, work):
    """{file name: text} of the changelog fragments at tag."""
    d = os.path.join(work, tag)
    run = lambda *a: subprocess.run(a, check=True, capture_output=True, text=True)
    run("git", "clone", "-q", "--depth", "1", "--filter=blob:none", "--no-checkout", "--branch", tag, REPO, d)
    run("git", "-C", d, "sparse-checkout", "set", "--no-cone", *[f"/{x}/" for x in DIRS])
    run("git", "-C", d, "checkout", "-q", tag)
    out = {}
    for sub in DIRS:
        p = os.path.join(d, sub)
        if os.path.isdir(p):
            for n in sorted(os.listdir(p)):
                if n.endswith(".md") and n != "README.md":
                    with open(os.path.join(p, n), encoding="utf-8") as f:
                        out[n] = f.read()
    return out


def sections(text):
    cur, out = None, []
    for line in text.splitlines():
        m = HEADING.match(line)
        if m:
            cur = [m.group(1), m.group(2).strip(), []]
            out.append(cur)
        elif cur is not None:
            cur[2].append(line)
    return [(c, t, "\n".join(b).strip()) for c, t, b in out]


def bullets(body):
    """The list items of a fragment body, each with its continuation lines joined."""
    items = []
    for line in body.splitlines():
        if re.match(r"^\s?[-*] ", line):
            items.append(line.strip())
        elif items and line.startswith(" ") and line.strip():
            items[-1] += " " + line.strip()
    return items


def page(tag, prev, frags, order):
    by_cat = {c: [] for c in ORDER}
    upgrade = []
    for name in sorted(frags):
        for cat, title, body in sections(frags[name]):
            title = title[:1].upper() + title[1:]
            by_cat[cat].append((title, body))
            for item in bullets(body):
                if UPGRADE.search(item):
                    upgrade.append((title, UPGRADE.sub("", item).strip(" -:")))
    slug = tag.replace(".", "-")
    lines = [
        "---",
        f"title: {tag}",
        "parent: Release changes",
        "grand_parent: Operations",
        f"nav_order: {order}",
        "---",
        "",
        f"# What changed in {tag}",
        "{: .no_toc }",
        "",
        f"Every change of the platform release {tag} since {prev}, generated from the release's changelog"
        " entries when this site was built. Read the upgrade notes before you upgrade, then the general"
        " procedure in [Upgrading](../upgrade.md).",
        "",
        "1. TOC",
        "{:toc}",
        "",
        "## Upgrade notes",
        "",
    ]
    if upgrade:
        lines += ["{% raw %}"] + [f"- **{t}:** {n}" for t, n in upgrade] + ["{% endraw %}"]
    else:
        lines.append("No change in this release asks for an action before or after the upgrade.")
    lines.append("")
    for cat in ORDER:
        if not by_cat[cat]:
            continue
        lines += [f"## {cat}", ""]
        for title, body in by_cat[cat]:
            lines += [f"### {title}", "", "{% raw %}", body, "{% endraw %}", ""]
    return slug, "\n".join(lines) + "\n"


def main(argv):
    count = 6
    args = []
    it = iter(argv[1:])
    for a in it:
        if a == "--count":
            count = int(next(it))
        else:
            args.append(a)
    root = args[0] if args else "."
    with open(os.path.join(root, "_data", "manifest.json"), encoding="utf-8") as f:
        m = json.load(f)
    tags = [m["platform"]["version"]] + [r["version"] for r in m["platform"]["previous"]]
    outdir = os.path.join(root, "operations", "releases")
    os.makedirs(outdir, exist_ok=True)
    listed = []
    with tempfile.TemporaryDirectory() as work:
        cache = {}

        def get(t):
            if t not in cache:
                cache[t] = fragments(t, work)
            return cache[t]

        for tag, prev in list(zip(tags, tags[1:]))[:count]:
            new = {n: t for n, t in get(tag).items() if n not in get(prev)}
            slug, text = page(tag, prev, new, len(listed) + 1)
            with open(os.path.join(outdir, slug + ".md"), "w", encoding="utf-8") as f:
                f.write(text)
            listed.append({"version": tag, "previous": prev, "page": f"/operations/releases/{slug}/",
                           "changes": sum(len(sections(t)) for t in new.values())})
            print(f"release_pages: {tag}: {listed[-1]['changes']} changes since {prev}")
    with open(os.path.join(outdir, "index.md"), "w", encoding="utf-8") as f:
        f.write("---\ntitle: Release changes\nparent: Operations\nhas_children: true\nnav_order: 2\n---\n\n"
                "# Release changes\n\nWhat changed in each recent platform release, generated from the"
                " release's changelog entries when this site was built. Older releases: the"
                " [releases page](https://github.com/openctemio/openctem/releases).\n")
    with open(os.path.join(root, "_data", "releases.json"), "w", encoding="utf-8") as f:
        json.dump(listed, f, indent=2)
        f.write("\n")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
