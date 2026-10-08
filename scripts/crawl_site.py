#!/usr/bin/env python3
"""Crawl the published documentation site and report broken links.

Usage: python3 scripts/crawl_site.py [BASE_URL] [--report FILE]

Starts at BASE_URL (default https://docs.openctem.io/), follows every page on the
same host, and checks every link and image it finds:
  - internal links (same host) must answer 200, and an anchor (#id) must exist on
    the target page;
  - external links must answer below 400; each is tried up to 3 times with a
    growing delay, and 429 (rate limited) counts as reachable.
Exits 1 when anything is broken. Standard library only.
"""
import argparse
import html.parser
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

USER_AGENT = "openctem-docs-link-check/1.0 (+https://github.com/openctemio/docs)"
SKIP_SCHEMES = ("mailto:", "tel:", "javascript:", "data:")
# Hosts that refuse automated requests; links to them are not checked.
SKIP_HOSTS = {"localhost", "127.0.0.1", "example.com", "example.org", "example.net"}


class Page(html.parser.HTMLParser):
    def __init__(self):
        super().__init__()
        self.links = []
        self.ids = set()

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        for key in ("id", "name"):
            if a.get(key):
                self.ids.add(a[key])
        if tag == "a" and a.get("href"):
            self.links.append(a["href"])
        elif tag in ("img", "script") and a.get("src"):
            self.links.append(a["src"])
        elif tag == "link" and a.get("href") and a.get("rel") in ("stylesheet", "icon"):
            self.links.append(a["href"])


def fetch(url, method="GET"):
    req = urllib.request.Request(url, method=method, headers={"User-Agent": USER_AGENT})
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            body = resp.read() if method == "GET" else b""
            return resp.status, resp.headers.get("Content-Type", ""), body
    except urllib.error.HTTPError as e:
        return e.code, "", b""
    except Exception as e:  # network error, timeout, TLS
        return None, str(e), b""


def check_external(url):
    status = None
    for attempt in range(3):
        status, info, _ = fetch(url, "HEAD")
        if status in (403, 405, 501) or status is None:
            status, info, _ = fetch(url, "GET")
        if status is not None and (status < 400 or status == 429):
            return None
        time.sleep(2 * (attempt + 1))
    return f"HTTP {status}" if status else f"error: {info}"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("base", nargs="?", default="https://docs.openctem.io/")
    ap.add_argument("--report", help="write a Markdown report to this file")
    args = ap.parse_args()
    base = args.base if args.base.endswith("/") else args.base + "/"
    host = urllib.parse.urlsplit(base).netloc

    pages = {}        # url -> set of ids
    sources = {}      # link target -> set of pages linking to it
    queue = [base]
    seen = {base}
    broken = []

    while queue:
        url = queue.pop(0)
        status, ctype, body = fetch(url)
        if status != 200:
            broken.append((url, f"HTTP {status}", sorted(sources.get(url, {"(start)"}))))
            continue
        if "html" not in ctype:
            continue
        parser = Page()
        parser.feed(body.decode("utf-8", "replace"))
        pages[url] = parser.ids
        for href in parser.links:
            if href.startswith(SKIP_SCHEMES) or href.startswith("#") and len(href) == 1:
                continue
            target = urllib.parse.urljoin(url, href)
            sources.setdefault(target, set()).add(url)
            parts = urllib.parse.urlsplit(target)
            if parts.netloc == host:
                page_url = urllib.parse.urlunsplit((parts.scheme, parts.netloc, parts.path, parts.query, ""))
                if page_url not in seen:
                    seen.add(page_url)
                    queue.append(page_url)

    externals = {}
    for target, refs in sources.items():
        parts = urllib.parse.urlsplit(target)
        if parts.scheme not in ("http", "https"):
            continue
        if parts.netloc == host:
            page_url = urllib.parse.urlunsplit((parts.scheme, parts.netloc, parts.path, parts.query, ""))
            if parts.fragment and page_url in pages and parts.fragment not in pages[page_url]:
                broken.append((target, "missing anchor", sorted(refs)))
        elif parts.hostname not in SKIP_HOSTS:
            externals[target] = refs

    for target, refs in sorted(externals.items()):
        problem = check_external(target)
        if problem:
            broken.append((target, problem, sorted(refs)))

    lines = [f"Crawled {len(pages)} pages on {host}, checked {len(externals)} external links.", ""]
    if broken:
        lines.append(f"{len(broken)} broken links:")
        lines.append("")
        for target, problem, refs in broken:
            lines.append(f"- `{target}` ({problem}), linked from: " + ", ".join(refs[:5]))
    else:
        lines.append("No broken links.")
    report = "\n".join(lines)
    print(report)
    if args.report:
        with open(args.report, "w", encoding="utf-8") as fh:
            fh.write(report + "\n")
    return 1 if broken else 0


if __name__ == "__main__":
    sys.exit(main())
