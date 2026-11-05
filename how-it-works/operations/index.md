---
title: Operations flows
parent: How it works
nav_order: 11
has_children: true
description: How OpenCTEM is installed, upgraded, backed up, verified and audited.
---

# Operations flows

These pages draw the work of the people who run an OpenCTEM installation:
installing it, upgrading it with its database migrations, backing it up and
restoring it, verifying signed releases, keeping the job signing key, and
checking that the audit log has not been changed.

{% assign flows = site.pages | where: "parent", page.title | sort: "nav_order" %}
{% for f in flows %}
- [{{ f.title }}]({{ f.url | relative_url }}): {{ f.description }}
{% endfor %}
