---
title: How it works
nav_order: 3.5
has_children: true
permalink: /how-it-works/
description: Drawn flows for every interaction in OpenCTEM, for administrators, operators and analysts.
---

# How it works
{: .no_toc }

Each page in this section draws one interaction in OpenCTEM: who takes part,
what happens in which order, what the platform checks, and what you see when
something is refused or fails. Use them to understand a feature before you set
it up, or to find where a step went wrong.

The pages describe the latest release. A step that only exists in a newer
release is marked with the version that brings it.

## How to read the diagrams

- **Sequence diagrams** show who talks to whom, in order. A dashed arrow is a
  reply.
- **Flowcharts** show decisions: each diamond is a check, and each branch says
  what happens when it passes or fails.
- **State diagrams** show the life of one object, such as a finding or a
  sensor, and the events that move it from one state to the next.
- A box labelled **trust boundary** separates parts that do not trust each
  other. Data that crosses it is authenticated, and the diagram says how.
- Every organization's data is kept apart from every other organization's.
  The diagrams name the checks that keep it so.

## Flows
{% assign groups = site.pages | where: "parent", "How it works" | sort: "nav_order" %}
{% for g in groups %}
### [{{ g.title }}]({{ g.url | relative_url }})

{{ g.description }}
{% assign flows = site.pages | where: "parent", g.title | sort: "nav_order" %}
{% for f in flows %}
- [{{ f.title }}]({{ f.url | relative_url }}): {{ f.description }}
{% endfor %}
{% endfor %}
