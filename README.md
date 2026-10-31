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
[openctemio/openctem `api/docs`](https://github.com/openctemio/openctem/tree/develop/api/docs);
the site links to them.

## Preview locally

```bash
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

Never type a current release into a page: write `{{ site.data.versions.sensor }}`
(or `platform`, `sdk_go`, `ci`, `chart`, `chart_app`). The values live in
`_data/versions.yml`, which the `versions-sync` workflow updates from the latest
GitHub releases; `scripts/check_versions.py` (in `docs-check`) fails on a
hard-coded image tag, `SENSOR_VERSION=`, `git checkout vX.Y.Z` and the like, and on
a key the data file does not have. History ("from v0.16.0") stays as written.

Report security vulnerabilities to security@openctem.io, not in issues. Other
questions: info@openctem.io.
