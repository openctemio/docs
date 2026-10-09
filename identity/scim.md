---
title: SCIM provisioning
parent: Identity and access
nav_order: 9
---

# SCIM 2.0 provisioning

With SCIM 2.0 your identity provider (for example Okta or Microsoft Entra ID) creates, updates and
deactivates members of one organization. Deactivation in the identity provider suspends the
membership and revokes the person's sessions immediately.

SCIM manages memberships. Sign-in is separate: combine it with [organization SSO](index.md#ways-to-sign-in)
or let provisioned people set a password.

## 1. Create a SCIM token

In the organization, **Settings > SCIM** (owner only):

1. Select **Generate token**, give it a name (for example `Okta production`) and confirm with
   [step-up re-authentication](two-factor.md#step-up-re-authentication).
2. Copy the token (`oct_scim_...`). It is shown once. It is stored only as a keyed hash.

| Action | Who |
|---|---|
| List tokens, edit group mappings (except to `admin`) | owner or admin |
| Create a token | owner, with step-up |
| Revoke a token | owner |
| Map a group to `admin` | owner |

Tokens do not expire; revoke a token when the integration is retired. One token belongs to one
organization, and the organization is always taken from the token, never from the request.

## 2. Configure the identity provider

| Setting | Value |
|---|---|
| SCIM base URL | `https://<api-host>/scim/v2` (with the bundled gateway, the same host as the console) |
| Authentication | HTTP header `Authorization: Bearer oct_scim_...` |

Supported:

| Resource | Operations |
|---|---|
| Discovery | `GET /ServiceProviderConfig`, `/ResourceTypes`, `/Schemas` |
| Users | `GET /Users` (with `filter`, for example `userName eq "alice@example.com"`, up to 200 results), `POST /Users`, `GET`, `PUT`, `PATCH`, `DELETE /Users/{id}` |
| Groups | `GET /Groups`, `POST /Groups`, `GET`, `PUT`, `PATCH`, `DELETE /Groups/{id}` |

Bulk operations are not supported. On users, `PUT` and `PATCH` change only `active`; other attribute
changes are ignored or refused with `400 invalidPath`. `PATCH` on groups accepts both member-array
and `members[value eq "..."]` filter styles.

The organization's IP allowlist does not apply to SCIM requests (the caller is the identity
provider's service); the token is the boundary.

## What each operation does

| Operation | Effect |
|---|---|
| `POST /Users` | Normalises the email to lower case, finds or creates a passwordless account, and adds an active membership with the `member` role. Re-sending an existing active member is idempotent. An email that already has an account but is not a member is attached only when the organization has DNS-verified that email domain; otherwise the answer is `409 uniqueness` and the person must be invited. The organization's allowed email domains apply. |
| `PATCH active:false` | Suspends the membership: sessions are revoked and cached permissions cleared at once. |
| `PATCH active:true` | Re-activates the membership. |
| `DELETE /Users/{id}` | Offboards the member (access, keys, groups and grants removed). If the person still owns work that must be reassigned, the membership is suspended instead and the organization's admins are notified to finish offboarding. |

The account itself (global to the installation) is kept; other organizations are not affected.
Provisioned people sign in through the organization's SSO, or set a password with **Forgot password**.

## Roles from groups

Group membership in the identity provider can set a member's organization role:

- A group whose display name is `member` or `viewer` (case-insensitive) maps its members to that role.
- Any group can be mapped to a role with `PUT /api/v1/scim-tokens/group-mappings`:

  ```json
  {"mappings": {"OpenCTEM-Admins": "admin", "OpenCTEM-Analysts": "member"}}
  ```

  There is no console page for mappings yet; use the API with an owner or admin session.
- A member's role is the highest role among their mapped groups (`admin` > `member` > `viewer`); with
  no mapped group it is `member`.
- **Admin is the owner's decision.** Only an owner can add, change or remove a mapping to `admin`, and
  only an owner-configured mapping grants admin. SCIM never demotes an administrator who was
  appointed by hand until the owner has configured at least one admin mapping.
- `owner` can never be assigned through SCIM, and the owner's role is never changed by SCIM.
- Saving mappings re-applies them to current group members immediately and is audited.

## Audit

Membership and role changes made through SCIM are written to the organization audit log with the token
id and prefix in the metadata. Role changes are high severity. See [Audit log](../security/audit-log.md).

## Troubleshooting

| Symptom | Cause |
|---|---|
| `401` | The token is revoked or wrong. Generate a new one (the old value cannot be shown again). |
| Everyone is `member` | Expected without a group mapping. |
| Admin group members are not promoted | The admin mapping was not saved by an owner. Have an owner save the mappings again. |
| `403` when saving mappings | Only an owner may change a mapping to `admin`. |
| `409 uniqueness` on create | The email already has an account on the installation and the domain is not verified for the organization. Invite the person instead. |
| A deprovisioned user still appears | Deactivation suspends the membership; the global account remains. |
