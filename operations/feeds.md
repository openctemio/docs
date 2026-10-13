---
title: Vulnerability and program feeds
parent: Operations
nav_order: 4.5
---

# Vulnerability and program feeds
{: .no_toc }

Two public feeds give the platform data it never collects itself. Nothing is
installed on your hosts: the platform downloads a signed bundle (or reads
one you copied to it), verifies it against a key you pin, and imports it.

| Feed | Gives | Used by | Source |
|---|---|---|---|
| Vulnerability feed | Products, CVEs and affected version ranges (from the NVD) | Matching the software inventory of your assets against known vulnerabilities | [`openctemio/vulnfeed`](https://github.com/openctemio/vulnfeed) |
| Program feed | Public bug-bounty and vulnerability-disclosure programs: owner, policy, bounty, published scope | **Scoping > Scope > Programs** (the public program monitor) | [`openctemio/programfeed`](https://github.com/openctemio/programfeed) |

The platform never calls the vulnerability sources or the bug-bounty
platforms. KEV and EPSS are separate threat-intelligence sources the
platform reads directly; they are not these feeds.

1. TOC
{:toc}

---

## Status

{: .warning }
Neither feed has published a signed release yet: the signing keys of both
projects are still to be created, so
`https://github.com/openctemio/vulnfeed/releases/latest/download/latest.dsse.json`
(and the same for `programfeed`) answers 404, and there is no root key id to
pin. Until the first release, a platform imports no vulnerability bundle, and
the public program monitor shows only the programs of a
[local bundle](#program-feed-a-local-bundle) you build yourself. This page
describes the setup that applies once they publish.

## How it works

Each feed publishes a GitHub release once a day: a signed pointer
(`latest.dsse.json`), signed manifests and the record files, in whole
bundles (v1) and in chunks (v2, only the changed chunks are fetched). The
platform checks, before it imports anything:

- the manifests are signed by a key of the key set, and the key set by the
  **offline root** whose key id you pin;
- the sequence only moves forward (no rollback) and the bundle is not
  expired (7 days);
- every file's size and SHA-256.

A bundle that fails a check is not imported; the previous data stays.

## Vulnerability feed

| Variable | Default | Meaning |
|---|---|---|
| `VULNFEED_ROOT_KEY_ID` | empty | The pinned root key id (`SHA256:...`, from `keys/root-keyid.txt` of the vulnfeed repository). **Empty: no bundle is imported.** |
| `VULNFEED_BASE_URL` | `https://github.com/openctemio/vulnfeed/releases` | Where the releases are |
| `VULNFEED_MIRRORS` | empty | Comma-separated https mirrors, tried after the release |
| `VULNFEED_BUNDLE_DIR` | empty | Air-gapped: a directory holding the files of one release |
| `FEED_CACHE_DIR` | system temp dir | Cache of verified chunks |

The `vuln-feed-import` worker runs every hour. With `VULNFEED_ROOT_KEY_ID`
unset it imports nothing and logs nothing; the `vulnfeed` row of the
threat-intelligence sync status stays `pending`.

**Air-gapped**: on a connected machine, download a release and verify it
with the feed's own tool, then copy the directory to the platform and point
`VULNFEED_BUNDLE_DIR` at it:

```bash
gh release download --repo openctemio/vulnfeed --dir bundle
git clone https://github.com/openctemio/vulnfeed && (cd vulnfeed && go build -o ../vulnfeed-bin ./cmd/vulnfeed)
./vulnfeed-bin verify --dir bundle --root-key-id "$(cat vulnfeed/keys/root-keyid.txt)"
```

## Program feed

| Variable | Default | Meaning |
|---|---|---|
| `PROGRAMFEED_ROOT_KEY_ID` | empty | The pinned root key id. **Empty: no signed program feed is imported.** |
| `PROGRAMFEED_URL` | empty | https release URL of the chunked feed, tried first |
| `PROGRAMFEED_MIRRORS` | empty | Mirrors, tried after `PROGRAMFEED_URL` |
| `PROGRAMFEED_DIR` | empty | A directory holding a release (a mirror or an upload) |
| `PROGRAMFEED_LOCAL_BUNDLE_DIR` | empty | Your own unsigned local bundle (below) |

Subscribing an organization to a public program never authorizes testing: its
scope entries stay inactive until an administrator accepts the program's
terms (with a recent sign-in), and a change of the terms makes them inactive
again. See [Scope](../scanning/scope.md).

### Program feed: a local bundle
{: #program-feed-a-local-bundle }

An organization may build an **unsigned, local-only** bundle that reads every
source, including datasets the public feed does not republish, for its own
platform only. It must not be redistributed, and you are responsible for the
terms of the sources it contains:

```bash
git clone https://github.com/openctemio/programfeed && cd programfeed
go build -o programfeed ./cmd/programfeed
./programfeed build --local-only --out local-bundle --cache httpcache
```

Copy `local-bundle` to the platform, set `PROGRAMFEED_LOCAL_BUNDLE_DIR` to it,
and have a platform administrator turn the local source on in the admin
console (it needs a recent sign-in and is audited). Its programs are
suggestions until confirmed; a signed record with the same id wins.

## Security notes

- Pin the root key id from the feed repository you trust, over a channel you
  trust (the repository itself, checked by a second person). It is the only
  thing that makes a bundle trusted.
- A mirror or an upload needs no trust of its own: the platform verifies the
  same signatures and hashes.
- The bundles hold public data only. The import writes platform-wide tables
  (no organization data); each organization's effects (matches, program
  updates) run afterwards, inside that organization.
