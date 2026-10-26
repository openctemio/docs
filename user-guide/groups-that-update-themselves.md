---
title: Groups that update themselves
parent: User guide
nav_order: 4.5
---

# Groups that update themselves

A group of "everything under example.com" should not mean ticking hundreds of
rows, and it should not go stale the moment discovery finds a new subdomain. An
asset group can fill itself with a **rule**, with a **pasted list**, with
**picked assets**, or with all three.

A group holds the assets its rule matches, plus the assets you added by hand or
by a pasted list, minus the assets you took out by hand. Scans, team access
rules, dashboards, SLAs and reports read the members the way they always did.

## Fill a group

Open **New group** (or **Edit** on a group) and go to **Members**. It has three
tabs.

### Rule

The rule uses the same filters as the Assets page (types, tags, criticality,
environment, internet-facing, name and more), plus:

- **Domains.** Type `example.com` or `*.example.com`, one per line. With
  **Include subdomains** a domain matches the name itself and every name below
  it. A name matches only on a whole label: `example.com` never matches
  `evilexample.com` or `example.com.evil.net`. Internationalized names are
  converted to their ASCII form.
- **Covered by scope entry.** The assets one of your scope entries confirmed.
- **Include related assets.** The services, URLs and certificates of the hosts
  the rule matches.

The preview on the right shows how many assets match, the first 20, and, for a
group that exists, how many would join and leave. A group holds at most 50,000
assets; the preview warns before you save a rule over that.

The rule runs as you, inside the assets you can see. A rule you save never pulls
in an asset you cannot see. It runs when you save, again shortly after assets are
created or change, and every hour. If the person who saved a rule leaves the
organization, the rule pauses and the members stay as they were; saving the rule
again resumes it.

### Pick

Choose assets from a list, as before. They stay in the group when no rule
matches them.

### Paste

Paste names, IP addresses, CIDR ranges or `http(s)` URLs, one per line (at most
10,000 lines). Lines that are not a name, address, range or URL are listed as
rejected with the reason. A name you cannot see counts as not found.

**Create the missing names as assets** creates what is not in your inventory
yet, at most 1,000 at a time. Names your scope covers join the inventory. Names
outside your scope are held for review as candidates: they are not scanned until
someone decides.

## Take assets out

Remove an asset from a group that has a rule and it stays out, even while the
rule matches it. Add it by hand again to bring it back.

## From the Assets page

With a filter on screen:

- **Save filter as group** creates a group whose rule is that filter.
  Filters a rule cannot hold (for example relative dates) are named and left out.
- **Add all N matching to group** adds everything the filter matches that you
  can see, not only the page on screen.

## See who joined and left

A group's page shows, for each asset, whether it came in by the rule, by hand or
by a pasted list. The **History** tab lists who joined and left, when, and why.

## When a group is in use

Before you save a change that brings more assets into a group that a team's
access rules or scans use, you see which teams and scans it reaches. The change
is recorded in the audit log. If a team with a privileged role uses the group,
only the owner can change its rule or members, after signing in again.

A rule never authorizes scanning. Scans on a group still pass the scope check
and your exclusions.
