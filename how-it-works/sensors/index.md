---
title: Sensor flows
parent: How it works
nav_order: 2
has_children: true
description: How a sensor joins your organization, proves who it is, reports what it can do, is upgraded and is removed.
---

# Sensor flows

These pages draw the life of a sensor as the platform and the sensor see it:
pairing, the signed heartbeat, what each side trusts, the tool report, the
host's own policy, upgrades, and revocation. They are written for the
administrators who install and approve sensors and the operators who keep
them running.

{% assign flows = site.pages | where: "parent", page.title | sort: "nav_order" %}
{% for f in flows %}
- [{{ f.title }}]({{ f.url | relative_url }}): {{ f.description }}
{% endfor %}
