---
layout: default
title: Web Console
has_children: true
nav_order: 5
---

# Web Console (developer documentation)

The web console is the Next.js application in the `web/` directory of the
[openctemio/openctem](https://github.com/openctemio/openctem) repository. It is
developed and released together with the API: one `vX.Y.Z` tag, image
`ghcr.io/openctemio/openctem-web` (v0.8.0 and earlier: `ghcr.io/openctemio/ui`).
The former `openctemio/ui` repository is archived.

Its developer documentation lives next to the code, in
[`web/docs/`](https://github.com/openctemio/openctem/tree/main/web/docs), and
is maintained there. This site no longer keeps a copy.

| Topic | Document |
|-------|----------|
| Overview and index | [web/docs/README.md](https://github.com/openctemio/openctem/blob/main/web/docs/README.md) |
| Architecture | [ARCHITECTURE.md](https://github.com/openctemio/openctem/blob/main/web/docs/ARCHITECTURE.md) |
| API client | [guides/API_INTEGRATION.md](https://github.com/openctemio/openctem/blob/main/web/docs/guides/API_INTEGRATION.md) |
| Assets API example | [guides/ASSETS_API_INTEGRATION.md](https://github.com/openctemio/openctem/blob/main/web/docs/guides/ASSETS_API_INTEGRATION.md) |
| Type customization | [guides/CUSTOMIZE_TYPES_GUIDE.md](https://github.com/openctemio/openctem/blob/main/web/docs/guides/CUSTOMIZE_TYPES_GUIDE.md), [guides/ORGANIZING_TYPES_AT_SCALE.md](https://github.com/openctemio/openctem/blob/main/web/docs/guides/ORGANIZING_TYPES_AT_SCALE.md) |
| Access control in the UI | [features/ACCESS_CONTROL.md](https://github.com/openctemio/openctem/blob/main/web/docs/features/ACCESS_CONTROL.md) |
| Authentication | [features/auth/](https://github.com/openctemio/openctem/blob/main/web/docs/features/auth/README.md) |
| Deployment | [ops/DEPLOYMENT.md](https://github.com/openctemio/openctem/blob/main/web/docs/ops/DEPLOYMENT.md), [ops/DOCKER_SENTRY_SETUP.md](https://github.com/openctemio/openctem/blob/main/web/docs/ops/DOCKER_SENTRY_SETUP.md) |
| Environment variables | [ops/ENVIRONMENT_VARIABLES.md](https://github.com/openctemio/openctem/blob/main/web/docs/ops/ENVIRONMENT_VARIABLES.md) |
| Production checklist | [ops/PRODUCTION_CHECKLIST.md](https://github.com/openctemio/openctem/blob/main/web/docs/ops/PRODUCTION_CHECKLIST.md) |
| Make targets | [MAKEFILE.md](https://github.com/openctemio/openctem/blob/main/web/docs/MAKEFILE.md) |
| Style contract | [ui-style-contract.md](https://github.com/openctemio/openctem/blob/main/web/docs/ui-style-contract.md) |
| Roadmap | [ROADMAP.md](https://github.com/openctemio/openctem/blob/main/web/docs/ROADMAP.md) |

## Developing the web console

```bash
git clone https://github.com/openctemio/openctem.git
cd openctem
make setup     # npm ci for web/, Go modules for api/, git hooks
make dev-web   # http://localhost:3000
```

See the [Development Guide](../operations/DEVELOPMENT.md) for the API side and
the contract checks that keep the two in step.

The pages below are kept on this site because they have no counterpart in
`web/docs/`.
