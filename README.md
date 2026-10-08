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
docker run --rm -it -p 4000:4000 -v "$PWD":/site -w /site ruby:3.3 \
  bash -c "bundle install && bundle exec jekyll serve --host 0.0.0.0"
```

Then open http://localhost:4000.

## Contributing

Open a pull request against `main`. Write in English, check every command, flag and
setting against the code, use `example.com` hosts and documentation IP ranges
(`192.0.2.0/24`, `198.51.100.0/24`, `203.0.113.0/24`) in examples, and keep links
relative. The `docs-check` workflow runs a link check and rejects non-English text and
private addresses.

Report security vulnerabilities to security@openctem.io, not in issues. Other
questions: info@openctem.io.
