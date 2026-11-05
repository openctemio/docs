---
title: Integration flows
parent: How it works
nav_order: 9
has_children: true
description: How CI pipelines, connectors, the asset collector, imports and other outside sources send data into the platform.
---

# Integration flows

These pages show how data from outside the sensors reaches the platform: CI
pipeline uploads and their policy gate, connectors to other security tools,
the asset collector, file imports, SIEM ingest and bug bounty reports. Each
page shows how the source proves who it is, what the platform checks, and
where the data lands. Read them when you connect a new source or when its
data does not show up.

{% assign flows = site.pages | where: "parent", page.title | sort: "nav_order" %}
{% for f in flows %}
- [{{ f.title }}]({{ f.url | relative_url }}): {{ f.description }}
{% endfor %}
