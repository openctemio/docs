# Demo data for the screenshots

`seed.ts` fills a **scratch** OpenCTEM installation with the fictional organization
**Example Corp**, so every screen of the web console has something meaningful to show.
`../capture-screenshots.ts` then takes the screenshots of the documentation site.

Never run either against a real installation: the seed creates users with a shared
demo password, approves its own scope entries and writes rows directly into the
database.

## What it creates

Everything is synthetic: the `example.com`, `example.org` and `example.net` domains,
the documentation address ranges `192.0.2.0/24`, `198.51.100.0/24` and
`203.0.113.0/24`, the AWS documentation account `123456789012` and the
`github.com/example-corp` repositories. Vulnerability identifiers are real public CVEs
so the threat-intelligence enrichment has something to show.

| Area | Data |
|---|---|
| People | Alex Morgan (owner), Jordan Patel (administrator), Sam Lee and Casey Kim (members), Riley Chen (viewer), a pending invitation, the platform administrator `admin@example.com` |
| Scope | Domains, address ranges, the repositories and the cloud account, one exclusion, approvals by a second administrator, domain proof requests |
| Inventory | Domains, subdomains, IP addresses, hosts, services, websites, an API, repositories, cloud resources, groups, relationships, owners, crown jewels |
| Findings | Imported from synthetic Nessus, nuclei, SARIF and Trivy exports (`fixtures.ts`): every severity, request/response evidence, components; triage, assignment, comments, approvals, resolved findings |
| Work | Two remediation campaigns, a pentest campaign with findings waiting for retest, an SLA policy, priority rules |
| Scanning | A scan zone, two paired sensors, three scan workflows, three scans and their run history, CI pipelines and runs |
| Settings | CI trust and gate policy, a Slack channel (placeholder webhook), a dashboard, report schedules, API keys, Entra ID and Google Workspace SSO (one approved, one waiting for the owner) |

Most of it goes through the API, as a user would create it. What has no API, or would
need a real sensor or CI provider, is in `sql/`:

| File | Why |
|---|---|
| `sql/10-sensors.sql` | The sensors are paired with the real sensor image's `pair` command, which exits once approved. This sets what a running sensor would report (tools, heartbeat). |
| `sql/20-scan-runs.sql` | The seed triggers each scan through the API, which plans the run. No sensor runs, so nothing is scanned; `demo.finish_run()` writes the results a sensor would have sent. |
| `sql/30-history.sql` | Spreads detection dates over the last weeks and writes 90 days of risk snapshots for the trend charts. |
| `sql/40-ci.sql` | CI runs need an OIDC token from the CI provider. |
| `sql/90-refresh.sql` | Run before capturing: sensors back online, the notification channel back to connected. |

## Run it

1. Start a scratch stack from the `openctem` repository (any way you like: the
   Compose files in `api/deploy`, or the API and web console from source), with an
   empty database, and run the migrations.
2. Create the platform administrator and the organization:

   ```bash
   bootstrap-admin -email=admin@example.com -name="Platform Admin" \
     -backup-email=breakglass@example.com -org-name="Example Corp" \
     -org-slug=example-corp -org-owner-email=alex@example.com -org-owner-name="Alex Morgan"
   ```

3. Seed, passing the owner's set-password token and the administrator's temporary
   password from that output:

   ```bash
   cd scripts
   npm install            # playwright, sharp, tsx
   OPENCTEM_API_URL=http://127.0.0.1:8080 \
   DEMO_PSQL="docker exec -i <postgres container> psql -U <user> -d <database>" \
   OWNER_SETUP_TOKEN=<token> ADMIN_TEMP_PASSWORD=<password> \
     npx tsx demo-seed/seed.ts
   ```

The seed takes about ten minutes, mostly waiting for rate limits and for a fresh
authenticator code (every account has TOTP enrolled; the secrets are kept in
`demo-seed/.state.json`, which is not committed). Run it once, on an empty database.

| Variable | Default | Meaning |
|---|---|---|
| `OPENCTEM_API_URL` | `http://127.0.0.1:18980` | API base URL |
| `OPENCTEM_WEB_URL` | `http://localhost:13980` | Web console URL (capture) |
| `DEMO_PSQL` | `docker exec -i openctem-demo-pg psql -U openctem -d openctem` | psql command line of the scratch database |
| `DEMO_PASSWORD` | `DemoPassw0rd!2026` | Password of every demo account |
| `SENSOR_IMAGE` | `ghcr.io/openctemio/sensor:v0.11.0` | Image whose `pair` command pairs the demo sensors |
| `SENSOR_API_URL` | `http://127.0.0.1:18980` | API URL as the sensor container (host network) reaches it |
| `PAIR_SENSORS` | | `0` skips pairing (no Docker) |
| `SKIP_IMPORTS` | | `1` skips the tool imports |
