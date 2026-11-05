---
title: Secrets flows
parent: How it works
nav_order: 10
has_children: true
description: How the credentials that sensors and their tools use are stored, protected and delivered.
---

# Secrets flows

These pages draw how OpenCTEM stores the credentials a scan needs, such as
proxy passwords and data source keys, and how they reach a sensor. They are
written for the administrators who enter those credentials and the security
teams who review where they travel.

{: .note }
> Secret delivery to sensors is being redesigned. These pages describe what the
> current release does.

{% assign flows = site.pages | where: "parent", page.title | sort: "nav_order" %}
{% for f in flows %}
- [{{ f.title }}]({{ f.url | relative_url }}): {{ f.description }}
{% endfor %}
