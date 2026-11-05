---
title: Attack surface flows
parent: How it works
nav_order: 6
has_children: true
description: How the platform finds your internet-facing names, decides which are yours, watches them for dangling records, lookalikes, certificate and page changes, and grades the result.
---

# Attack surface flows

These pages draw how attack surface monitoring works end to end: how far
discovery goes from your domains, how a discovered name becomes yours or not,
how CDN and shared hosting addresses are handled, and what the platform keeps
watching afterwards. They are written for the administrators who set scope
and the analysts who review the attack surface.

{% assign flows = site.pages | where: "parent", page.title | sort: "nav_order" %}
{% for f in flows %}
- [{{ f.title }}]({{ f.url | relative_url }}): {{ f.description }}
{% endfor %}
