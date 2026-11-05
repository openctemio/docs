---
title: Identity and access flows
parent: How it works
nav_order: 1
has_children: true
description: How people and programs get an account, sign in, prove a second factor and reach an organization's data.
---

# Identity and access flows

These pages draw how a person or a program gets into OpenCTEM: sign-up and
invitations, password sign-in, two-factor and step-up, single sign-on, SCIM,
the platform console, API keys, the MCP server, and how a session stays alive.
They are written for the administrators who set up sign-in and for the
security teams who review it.

{% assign flows = site.pages | where: "parent", page.title | sort: "nav_order" %}
{% for f in flows %}
- [{{ f.title }}]({{ f.url | relative_url }}): {{ f.description }}
{% endfor %}
