---
title: Sensor execution flows
parent: How it works
nav_order: 4
has_children: true
description: What a sensor does with a job once it has it, from the confined tool run to the result the platform acknowledges.
---

# Sensor execution flows

These pages draw what happens on the sensor's host after a signed job
arrives: the targets the host admits, the confined tool run, the egress check
on every connection, how a tool's settings become its command line, how the
output becomes a result document, and how results are kept until the platform
has them. They are written for operators and security reviewers of sensor
hosts.

{% assign flows = site.pages | where: "parent", page.title | sort: "nav_order" %}
{% for f in flows %}
- [{{ f.title }}]({{ f.url | relative_url }}): {{ f.description }}
{% endfor %}
