---
title: Scan flows
parent: How it works
nav_order: 3
has_children: true
description: How a scan becomes work on sensors, who approves it, how sensors take and hold tasks, and what stops, retries or limits it.
---

# Scan flows

These pages follow a scan from the moment it is triggered to the moment its
run settles. They show the checks that can refuse a run, how sensors take
tasks and prove they may run them, and how the platform keeps scans polite to
the hosts they touch. Read them when you plan scans, operate sensors, or need
to find out why a run waited, ended partial or was refused.

{% assign flows = site.pages | where: "parent", page.title | sort: "nav_order" %}
{% for f in flows %}
- [{{ f.title }}]({{ f.url | relative_url }}): {{ f.description }}
{% endfor %}
