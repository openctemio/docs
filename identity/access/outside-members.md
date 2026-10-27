---
title: Outside members
parent: Who can see and do what
grand_parent: Identity and access
nav_order: 2
---

# Outside members

A person is **outside** your organization when the organization does not manage their email
address: a personal address (such as one at a public mail provider), a work address on a domain no
organization has verified, or an address owned by another organization. Everyone else is an
internal member.

Outside members are marked wherever members are listed: **External** in the members list and
**Outside** in the invitations list. For people managed by another organization, owners and
administrators also see that organization's name.

The label is decided when the invitation is created and again when it is accepted. A person joins
from outside only by accepting an invitation addressed to them. An administrator cannot add their
existing account or create one for them.

## The rules

| Rule | What it means |
|---|---|
| **Never owner** | An outside member can never be the owner, whoever asks. |
| **Privileged roles need extra proof** | A role is privileged when it is **Admin**, carries **full data access**, or carries organization-wide dashboard access, or a privileged permission the member role lacks (inviting people, managing members, teams, roles, service accounts, API keys, the secret store, integrations, source-control connections or settings). The person **giving** such a role confirms their own identity first (step-up). The **member** must prove a second factor every time they open the organization. See [Two-factor requirements](two-factor-requirements.md). |
| **Full data access only by a role given directly to the person** | It is never given through a team. See below for why. |
| **Trusted organizations cap the role** | When your organization has a trust with the member's home organization, the trust sets a ceiling, **viewer** or **member**. Above the ceiling, privileged roles are refused. With a viewer ceiling only the viewer role is allowed. |
| **Service accounts** | A service account cannot be an owner or administrator or have full data access. |
| **End of access** | Optional, unless **Require an end of access for people outside** is on: then outside people no organization manages must have one (90 days by default, 365 at most). An expired membership is suspended automatically. |

The organization settings that apply to outside people are on **Settings > Authentication**:
**Who can be invited** (anyone, verified domains only, or verified and allowed domains),
**Personal accounts** (allowed with two-factor, allowed, or blocked) and the end-of-access switch.
See [Sign-up and invitations](../sign-up-and-invitations.md#people-outside-the-organization).

### Why full data access never comes through a team

A team is easy to change: anyone who may manage the team can add a member, and a team often grows
without anyone looking at each name. If a team carried full data access, adding an outside person
to it would hand them the whole organization as a side effect of a routine action. So full data
access for an outside person must be a deliberate, separate decision about that one person: a role
given directly, with the assigner's step-up. The console refuses the team route with
`TEAM_EXTERNAL_FULL_DATA`; the same applies to binding a full-data role to a team that already has
an outside member, and to adding an outside member to a team set to **All assets**.

## Give an outside member full access, step by step

Before you start, check that the organization has no trust that caps this person's home
organization (**Settings > Security > Trusted organizations**, see [Trusted organizations](../../user-guide/10-settings-and-integrations.md#trusted-organizations)) and that you hold full data access yourself
(owners always do).

1. Create the role if it does not exist: **Settings > Roles > Create role**, tick **Full data
   access**, choose the permissions the person needs, save.
2. Open **Settings > Members**, find the person (filter **External** helps), open the row menu and
   choose **Change roles**.
3. Add the role directly to the person (not to a team) and save.
4. When the console asks you to confirm your identity, enter your authenticator code (or password,
   or sign in again if you use SSO) and retry.
5. Tell the person they must have two-factor authentication on. If they have never set it up, read
   [how to recover when they are blocked](two-factor-requirements.md#recovering-a-blocked-person).

To invite a new outside person with such a role, choose it in **Invite user** instead. The dialog
says the person is outside and that two-factor authentication and your confirmation apply. The
person's invitation shows **Two-factor required**.

## Make someone not outside

Whether a person is outside depends on who manages their email address:

1. Have the address's domain **verified by your organization**. A platform administrator verifies a
   domain for single sign-on (see
   [Verified domains and just-in-time provisioning](../sign-up-and-invitations.md#verified-domains-and-just-in-time-provisioning)).
   A domain has one holder on the installation.
2. Invite the person again with the address on that domain. People on a domain your organization
   holds are internal members when they accept.

An existing outside membership is not changed when you verify a domain later: the label is set at
invitation. Offboard the old membership and invite the person again with their organization
address, or ask a platform administrator whether the installation can convert it. Transferring
ownership to an outside person whose address nobody manages makes them internal as part of the
transfer, and removes their end of access.
