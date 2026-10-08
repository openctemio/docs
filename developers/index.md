---
title: Developers
nav_order: 13
has_children: true
permalink: /developers/
---

# Developers

This section is for people who change OpenCTEM itself or build on it: contributors to the
platform, and authors of tools and integrations.

| Page | What it covers |
|---|---|
| [Local setup](local-setup.md) | Run the API and the web console from source |
| [Repository layout](repository-layout.md) | The repositories and how they fit together |
| [Contributing](contributing.md) | Branches, commits, changelog fragments, review |
| [Testing](testing.md) | Unit and database-backed tests, web tests, what CI runs |
| [Database migrations](migrations.md) | golang-migrate layout, the baseline, expand-contract |
| [Generated files](generated-files.md) | The OpenAPI spec, web API types and registry codegen |
| [Release process](release-process.md) | Release train, tags, images, signatures and SBOMs |
| [Writing a tool](tool-authoring.md) | Add a scanner or collector that sensors can run |

To call the API from your own code, start with the [API](../api/index.md) section instead.

## Ground rules

- **Security first.** OpenCTEM is multi-tenant and runs scanners against real networks. Every
  change keeps tenant isolation (the organization always comes from the credential, every query
  is scoped by it), authorization on every route, and untrusted input (scan output, imported
  files, webhook bodies) treated as hostile. A new route without an authorization gate fails CI.
- **Report vulnerabilities privately** to security@openctem.io, never in a public issue. See
  [Vulnerability disclosure](../security/vulnerability-disclosure.md).
- **Keep it simple.** Prefer the smallest design that meets today's need.
