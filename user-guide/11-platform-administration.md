---
title: Platform administration
parent: User guide
nav_order: 11
---

# Platform administration

**Platform administrators** run the installation as a whole. They work in the
**platform console**, a separate application with its own sign-in page and its own
site, not a part of the organization web app; an administrator account belongs to
no organization. The console has its own section of this documentation:
[Platform console](../console/index.md).

| Task | Page |
|---|---|
| Find the console, sign in, roles and elevation, the Overview | [Platform console](../console/index.md) |
| Create, suspend and delete organizations; find and block accounts; access requests; sign-ups; support access | [Organizations and users](../console/organizations-and-users.md) |
| Administrators, sessions, second-admin approvals, admin sign-in, admin activity, security keys | [Console security](../console/security.md) |
| Configuration, sign-up, limits, CAPTCHA, e-mail, legal, announcements, alerts, AI provider, AI applications | [Console settings](../console/settings.md) |
| Scan approval, platform scanning, target mappings, content packs, content catalog, threat intelligence | [Console scanning settings](../console/scanning.md) |
| Health and software updates | [Console monitoring](../console/monitoring.md) |

The first administrators are created on the server with `bootstrap-admin`: see
[First administrator](../install/first-admin.md).

## Organizations

Platform administrators create organizations, set their limits and single sign-on,
suspend them and delete them: see
[Organizations](../console/organizations-and-users.md#organizations). Inside an
organization, its owners and administrators manage members, roles and settings
([Settings and integrations](10-settings-and-integrations.md)).
