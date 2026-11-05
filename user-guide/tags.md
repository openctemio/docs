---
title: Tags
parent: User guide
nav_order: 5.7
---

# Tags

A tag is a short free-text label on an asset, such as `pci`, `external` or
`team-payments`. Tags are how you cut the inventory your own way. Several
other features read them, so a tag set once is used in many places.

Tags live on assets. A finding does not carry its own tags in the list: it
uses the tags of its asset (the **Asset tag** filter on the Findings page, and
the tag conditions of the rules below).

## Set and change tags

- **On one asset.** Open the asset, choose **Edit tags**, type a tag and press
  Enter, then **Save tags**. You need `assets:write`.
- **On many assets.** In the inventory, select rows and use **Add tag** (the
  tag is added, existing tags are kept) or **Remove tags** (tick the tags to
  remove from the selected assets).

An asset holds at most 50 tags and a tag is at most 50 characters.

### System tags

Some tags are set by the platform, for example the tag an asset gets when a
bug-bounty program lists it. They show under **System tags** in the tag
filter, are read-only, and cannot be added or removed by hand. A person who is
not an organization owner sees the system tags only of programs they may see.

## Filter by tag

On the Assets page open the **Tags** filter:

- Search the tags of your organization, most used first.
- **Match** **Any** returns assets with at least one selected tag. **All**
  returns assets with every selected tag.
- **Exclude** leaves out assets that carry a tag.

The selection shows as a chip (for example, **Tags include all of** the
values) that you can remove. In the Findings page filters, **Asset tag** does
the same for the findings of those assets.

## Where tags are used

| Feature | How it uses tags |
|---|---|
| [Groups that update themselves](groups-that-update-themselves.md) | A group rule can select assets by tags (any of). Members follow the tags. |
| [Team and access](02-team-and-access.md) | A team's scope rule can assign assets by **Tag Match**, **Any (OR)** or **All (AND)**. |
| [Settings and integrations](10-settings-and-integrations.md) | A scan window policy selects its targets by **Tags**. Jira routing rules can match finding tags. |

Business units and crown jewels also take tags of their own when you create
them. Those do not filter the asset inventory.

Tags are labels, not security boundaries. Use groups and access rules to
decide who sees what.
