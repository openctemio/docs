---
title: Roles, teams and what members can see
parent: Who can see and do what
grand_parent: Identity and access
nav_order: 1
---

# Roles, teams and what members can see

Two separate things decide what a person gets in an organization:

| Question | Decided by | Where you set it |
|---|---|---|
| What can this person **do**? (invite people, run scans, change settings) | Their **roles** | **Settings > Access > Members**, **Change roles** |
| Which **assets** (and the findings, exposures and components linked to them) does this person see? | Their **teams** and any direct grants | **Settings > Access > Teams**, the team's **Assets** and **Scope rules** tabs |

A role never lists assets, and a team never makes someone an administrator. Keep the two in mind
when someone says "I can sign in but I see nothing" or "I can see everything but cannot change
anything".

## A member in no team sees no assets

A **member** or **viewer** who belongs to no team, and has no direct grant on an asset, can sign in
and open every page their role allows, but lists of assets and findings are empty and the dashboard
counts only their own (empty) scope. This is deliberate: nothing is visible until someone decides
what the person should see.

Fix it in one of these ways:

1. **Add the person to a team** that owns the assets they should see. A team owns assets when they
   are assigned to it by hand (**Teams > the team > Assets**), by a **Scope rule** (a tag match or
   an asset group match) or by an **assignment rule**. You can also choose the team while inviting
   the person, so they never join with no data.
2. **Give a direct grant on one asset**: open the asset, **Owners** tab, **Direct access**.
3. **Give full data access** (below) when the person must see the whole organization.

Naming someone the **owner of an asset** does not give them access to it. Owners are accountable for
an asset (findings are assigned to them and they get notifications), but they see the asset only
through a team or a grant.

Owners and administrators always see everything in the console.

## Give someone full data access

Full data access means seeing every asset in the organization regardless of teams. There are three
ways, from broadest to narrowest:

| Way | When to use it |
|---|---|
| The **Admin** role (only the owner can give it) | The person also manages members, settings and integrations. |
| A **custom role** with **Full data access** ("Access all data regardless of team membership") | The person needs the whole inventory but not administrator rights, for example an analyst or an auditor. Create it in **Settings > Access > Roles**, then give it in **Members > Change roles**. |
| A **team set to All assets** (only the owner can set it) | Everyone in a group should see everything. The team is marked **Elevated access**. |

Giving full data access, like any privileged role, asks you to confirm your identity again (see
[Why was I refused?](refusals.md)). You can only give what you hold
yourself: an administrator without full data access cannot give it to someone else.

People outside your organization follow stricter rules: see [Outside members](outside-members.md).

## Roles and teams together: an example

| Person | Role | Teams | What they see and do |
|---|---|---|---|
| Analyst for the web estate | Member | Web team (owns the public web assets) | Works on findings of the web assets only |
| Auditor | Custom role with full data access, read-only permissions | none | Reads everything, changes nothing |
| New hire, just invited | Member | none yet | Signs in, sees no assets until added to a team |
| Team lead | Member | Web team, with the lead role inside the team | Same data as the team; the team role does not add permissions |

Counts on teams, the attack surface and scoping summaries cover only the assets the reader can see,
so two people can legitimately see different numbers on the same page.

See also: [Groups and data scope](../roles-and-permissions.md#groups-and-data-scope) and
[Team and access](../../user-guide/02-team-and-access.md#teams-and-assignment-rules).
