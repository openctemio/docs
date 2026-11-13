# OpenCTEM documentation

Source of [docs.openctem.io](https://docs.openctem.io), the documentation for
[OpenCTEM](https://github.com/openctemio/openctem), the open-source Continuous Threat
Exposure Management platform.

The site is built with [Jekyll](https://jekyllrb.com/) and the
[Just the Docs](https://just-the-docs.com/) theme and published by GitHub Pages from
`main` (`.github/workflows/pages.yml`).

## Layout

| Directory | Section |
|---|---|
| `overview/` | What OpenCTEM is, architecture, concepts, glossary |
| `install/` | Requirements, Docker Compose, all-in-one image, Kubernetes, TLS |
| `configuration/` | Environment variables reference, email, notifications |
| `operations/` | Upgrades, versioning, backups, monitoring, scaling, troubleshooting, logs |
| `console/` | The platform console for platform administrators |
| `security/` | Security model, hardening, vulnerability disclosure, data handling |
| `identity/` | SSO, SCIM, sign-up, roles and permissions, two-factor authentication |
| `sensors/` | Deploying and pairing sensors, scan zones, network requirements |
| `scanning/` | Scope, scan workflows, scans and runs, tools, CI integration |
| `user-guide/` | Using the web console |
| `api/` | REST API, authentication, conventions, webhooks, MCP, ingest |
| `developers/` | Local setup, contributing, testing, migrations, releases, writing a tool |
| `legal/` | Licenses, privacy policy, terms |

Engineering documents that change with the code (architecture notes, RFCs, versioned
upgrade guides) live next to the code in
[openctemio/openctem `server/docs`](https://github.com/openctemio/openctem/tree/develop/server/docs);
the site links to them.

## Preview locally

```bash
python3 scripts/versions_manifest.py .        # current releases (add --offline without network)
python3 scripts/release_pages.py --count 2 .  # optional: the release change pages
docker run --rm -it -p 4000:4000 -v "$PWD":/site -w /site ruby:3.1 \
  bash -c "bundle install && bundle exec jekyll serve --host 0.0.0.0"
```

Then open http://localhost:4000.

## Screenshots

The console screenshots in `assets/images/<section>/` come from a scratch installation
filled with the fictional organization Example Corp, and are regenerated for each
release:

1. Start a scratch stack (API, web console, PostgreSQL, Redis) from the
   [openctem](https://github.com/openctemio/openctem) release, with an empty database.
   Never use a real installation.
2. Seed it: see [scripts/demo-seed/README.md](scripts/demo-seed/README.md).
3. Capture (headless Chromium, 1440×900):

   ```bash
   cd scripts
   npm install && npx playwright install chromium
   OPENCTEM_WEB_URL=http://localhost:3000 OPENCTEM_API_URL=http://127.0.0.1:8080 \
     npx tsx capture-screenshots.ts            # or a filter: capture-screenshots.ts 'scanning/'
   ```

   The script signs in as the demo accounts, blurs anything that looks like a
   credential, and writes palette PNGs (WebP above 300 KB). Review every image before
   committing it.

   Notes for a run against a current release:

   - A plain-HTTP scratch stack on loopback ports runs with `APP_ENV=staging` (production
     refuses a database or Redis without TLS and needs the job signer) and, when the console
     API listens on all interfaces of its container, `ADMIN_LISTEN_ALLOW_ALL_INTERFACES=true`;
     publish every port on `127.0.0.1` only.
   - Start the scratch stack with `CERT_MONITOR_ENABLED=false`. Certificate
     Transparency discovery reads real public logs for `example.com` and adds names that
     belong to other people to the inventory.
   - Run the seed once per database. Campaigns, tasks and some other steps are not
     idempotent and a second run creates duplicates.
   - Re-run `demo-seed/sql/90-refresh.sql` just before capturing the sensor and scan
     pages, or the sensors show as late.
   - The `website` section of the script writes `assets/images/website/`. Copy those
     images to `src/assets/shots/` in the website repository (and run `node scripts/og.mjs`
     there); do not commit them here.
   - The inventory at 1440 pixels wide gives the Name column almost no room, so the
     asset shots use a 1680 pixel viewport that is scaled down to 1440 on save.

## Contributing

Open a pull request against `main`. Write in English, check every command, flag and
setting against the code, use `example.com` hosts and documentation IP ranges
(`192.0.2.0/24`, `198.51.100.0/24`, `203.0.113.0/24`) in examples, and keep links
relative. The `docs-check` workflow runs a link check and rejects non-English text and
private addresses.

### Releases are never written by hand

A release needs no commit in this repository:

- **Current versions.** Write `{{ site.data.versions.sensor }}` (or `platform`, `sdk_go`, `ci`,
  `chart`, `chart_app`, `connector_tenable`, `min_sensor`, `min_sdk_go`, `min_ci`, and the
  platform image digests `digest_openctem`, `digest_api`, `digest_web`, `digest_console`,
  `digest_migrations`; `server_image` is the server image's name for that release,
  `openctem-server` from v0.23.0 and `openctem-api` before). The site build writes `_data/versions.yml` and `_data/manifest.json`
  from the signed versions manifest the platform's release pipeline publishes
  (`https://get.openctem.io/releases/manifest.json`; until that address answers, the same file as
  a release asset, then a build from the public GitHub releases in the same schema). The build
  verifies the signature with cosign and fails, leaving the published site as it was, when it
  does not verify. These files are git-ignored; `scripts/versions-snapshot.json` serves only
  `--offline` local builds and is refreshed with `--write-snapshot`, never edited.
- **Compatibility.** `{% include compatibility.md %}` prints the current releases and which
  platform each component needs, from the same manifest.
- **What changed.** `scripts/release_pages.py` writes `operations/releases/<version>.md` for
  the recent releases from the changelog entries of each release tag (upgrade notes first).
  The hand-written per-release guides in `operations/upgrade.md` explain what needs judgement.
- **When.** The site rebuilds on every push, every 6 hours, and when the platform's Release
  Feed run sends `release-published`. `versions-monitor` fails and opens a `stale-versions`
  issue when the published site lags the latest release for more than a day.

`scripts/check_versions.py` (in `docs-check`) fails on a hard-coded image tag,
`SENSOR_VERSION=`, `git checkout vX.Y.Z`, a Helm `--version`, an sdk-go, CI runner or connector
release and the like, and on a key the data file does not have. History ("from v0.16.0")
stays as written; a line that must pin on purpose carries `docs-check: pinned-version`.

Report security vulnerabilities to security@openctem.io, not in issues. Other
questions: info@openctem.io.
