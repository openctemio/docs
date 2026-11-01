---
title: Why was I refused?
parent: Who can see and do what
grand_parent: Identity and access
nav_order: 4
---

# Why was I refused?

When a change to roles, teams or members is refused, the console shows a sentence that says which
rule applied. The sentence comes with a code, which is also what the API returns (`403` with
`"code"`). Use the table to find the cause and the fix.

| Message (code) | Cause | What to do |
|---|---|---|
| "Confirm your identity to continue, then try again." (`STEP_UP_REQUIRED`) | The action is sensitive and your session has not proved who you are in the last 10 minutes. | The console opens a dialog: enter your authenticator code (or your password if you have no authenticator, or sign in again if you use SSO). The action is then retried once automatically. |
| "This needs you to confirm your identity, and this session cannot do that here. Sign out, sign in again, then retry." (`STEP_UP_UNAVAILABLE`) | The credential cannot step up, such as an API key. | Sign out and sign in again, then retry in the console. An API key never performs these actions. |
| "Only the organization owner can change the members of a team that carries a privileged role." (`TEAM_PRIVILEGED_OWNER_ONLY`) | The team carries a privileged role (full data access, or permissions to manage people, teams, roles, API keys, secrets, integrations or settings). Only the owner adds, removes or extends its members, or binds such a role to it. Administrators cannot, even though they can change other teams. | Ask the organization owner to make the change (they also confirm their identity first). Or use a team that carries no privileged role. The team's **Roles** tab marks such roles **Privileged**. |
| "Someone outside your organization gets full data access only through a role given to them directly, never through a team." (`TEAM_EXTERNAL_FULL_DATA`) | An outside member would get full data access from a team: you are adding one to such a team, binding a full-data role to a team that has one, or inviting one into such a team. | Give the role directly to the person instead (see [Outside members](outside-members.md#give-an-outside-member-full-access-step-by-step)), or keep them out of the team. |
| "You cannot add yourself to a team that carries roles. Ask the organization owner." (`TEAM_SELF_JOIN`) | Nobody but the owner puts themselves into a team that carries roles, because that would let a person raise their own permissions. | Ask the owner (or someone else who may manage the team) to add you. |
| "Only an owner can grant the owner role" and similar (`FORBIDDEN`) | The role-grant ceiling: you can give only roles whose permissions you hold, only the owner makes administrators, and the owner role is never granted (use **Transfer ownership**). | Ask the owner, or have someone who holds the permissions do it. |
| "The trust with this member's organization allows ... only" (`FORBIDDEN`) | The member's home organization is trusted with a ceiling of **viewer** or **member**. | Change the trust (owner), or give a role within the ceiling. |
| `MFA_ENROLLMENT_REQUIRED` (when opening the organization, or creating an API key, sensor key, enrollment token, secret or integration) | The person must have two-factor on: the organization's rule or the platform floor covers them. Creating credentials needs it even during the floor's grace period. | See [Two-factor requirements](two-factor-requirements.md). |
| `MFA_BELOW_PLATFORM_FLOOR` (saving authentication settings, `422`) | The organization tried to require less two-factor than the platform floor. | Keep the switches the floor raises; see [The platform two-factor floor](../two-factor.md#the-platform-two-factor-floor). |
| `ACCOUNT_TOKEN_NOT_ALLOWED` (on `/api/v1/tenants/{tenant}/...` routes) | The token is bound to no organization (a sign-in token from a social or SSO sign-in that was not exchanged). | Exchange it for an organization token first (`POST /api/v1/auth/token`). The console does this for you. |

## Which one applies to my case?

- **Adding someone to a team fails, and I am an administrator**: probably
  `TEAM_PRIVILEGED_OWNER_ONLY`. Check the team's **Access** tab for a **Privileged** role.
- **An outside colleague cannot see everything though I added them to the "everything" team**:
  full data access is never given through a team to outside members (`TEAM_EXTERNAL_FULL_DATA`).
- **The dialog asked me to confirm and then the change worked**: that is the normal step-up. It
  stays valid for 10 minutes in that session.
- **I use SSO and the dialog keeps asking me to sign in**: your identity provider must return a fresh
  authentication time. See [Step-up re-authentication](../two-factor.md#step-up-re-authentication).
