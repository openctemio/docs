---
title: Developer
parent: Start here
nav_order: 4
---

# Developer

You automate OpenCTEM, send it results from your pipelines, plug in your own scanner,
or work on the platform itself.

## Tutorials

- [CI quickstart (5 minutes)](../scanning/ci-quickstart.md): gate a pipeline on its first scan.
- [Build your first tool](../developers/build-your-first-tool.md): wrap a scanner for the sensor.
- [Local setup](../developers/local-setup.md): run the platform from source.

## How-to guides

- [Authenticate with API keys](../api/authentication.md).
- [Ingest results in CTIS](../api/ingest.md) from your own program or connector.
- [Upload existing reports from CI](../scanning/ci-upload.md) and [understand a blocked pull request](../scanning/ci-blocked-pr.md).
- [Receive webhooks](../api/webhooks.md) and [connect over MCP](../api/mcp.md).
- [Write a tool](../developers/tool-authoring.md) and [contribute](../developers/contributing.md).
- [Database migrations](../developers/migrations.md) and [testing](../developers/testing.md).

## Reference

- [API conventions](../api/conventions.md) and the [query language](../api/query.md).
- [CI reference](../scanning/ci-reference.md).
- [Repository layout](../developers/repository-layout.md) and [generated files](../developers/generated-files.md).
- [Release process](../developers/release-process.md).

## Concepts

- [Architecture](../overview/architecture.md) and [data model](../overview/data-model.md).
- [CI/CD integration](../scanning/ci-integration.md): OIDC identity, trust and gates.
- [How scope reaches sensors](../scanning/scope-to-sensors.md).
