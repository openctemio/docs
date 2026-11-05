---
title: Remediation flows
parent: How it works
nav_order: 8
has_children: true
description: How findings are grouped, assigned, ticketed, chased by deadlines, announced and reported until they are fixed.
---

# Remediation flows

These pages follow a finding after it is known: how it joins a remediation
group or campaign, becomes a task and a ticket, gets a deadline, and how
people hear about it. They also cover reports and exports, pentest campaign
reports, automation rules and AI triage. Read them when you set up
remediation for your teams, or when a ticket, a notification or a report
did not do what you expected.

{% assign flows = site.pages | where: "parent", page.title | sort: "nav_order" %}
{% for f in flows %}
- [{{ f.title }}]({{ f.url | relative_url }}): {{ f.description }}
{% endfor %}
