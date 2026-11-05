---
title: Results and findings flows
parent: How it works
nav_order: 5
has_children: true
description: How scan results enter the platform, become assets and findings, and how findings move from new to closed.
---

# Results and findings flows

These pages follow a result from the sensor, a CI upload or an import to the
assets and findings you see in the console. They show how the platform
checks each report, recognizes an asset or a finding it already knows, and
decides when a finding opens, reopens or closes. Read them when a result does
not show up, a finding looks duplicated, or a finding closed or reopened and
you want to know why.

{% assign flows = site.pages | where: "parent", page.title | sort: "nav_order" %}
{% for f in flows %}
- [{{ f.title }}]({{ f.url | relative_url }}): {{ f.description }}
{% endfor %}
