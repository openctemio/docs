---
title: "Sign-in and own account permissions"
parent: "Authorization reference"
grand_parent: "Identity and access"
nav_order: 30
---

<!-- Generated from the OpenCTEM source by `go run ./cmd/gen-authz-docs` in api/. Do not edit by hand. -->

# Sign-in and own account: permissions

Authentication, the caller's own account, notifications, bootstrap data and the real-time socket.


## Who can do it

Built-in roles and role templates whose permissions pass each route. Owner and administrator are included where the route allows them.


## Routes

| Method | Path | Requires | Data scope | Step-up | Roles that pass |
|---|---|---|---|---|---|
| POST | `/api/v1/auth/access-requests` | no permission: public auth flow / self-scoped (login, register, oauth, sso, saml, logout) | system: authentication flows |  | see Requires |
| POST | `/api/v1/auth/access-requests/confirm` | no permission: public auth flow / self-scoped (login, register, oauth, sso, saml, logout) | system: authentication flows |  | see Requires |
| POST | `/api/v1/auth/backchannel-logout` | no permission: public auth flow / self-scoped (login, register, oauth, sso, saml, logout) | system: authentication flows |  | see Requires |
| POST | `/api/v1/auth/create-first-team` | no permission: public auth flow / self-scoped (login, register, oauth, sso, saml, logout) | system: authentication flows |  | see Requires |
| POST | `/api/v1/auth/discover` | no permission: public auth flow / self-scoped (login, register, oauth, sso, saml, logout) | system: authentication flows |  | see Requires |
| POST | `/api/v1/auth/forgot-password` | no permission: public auth flow / self-scoped (login, register, oauth, sso, saml, logout) | system: authentication flows |  | see Requires |
| GET | `/api/v1/auth/info` | no permission: public auth flow / self-scoped (login, register, oauth, sso, saml, logout) | system: authentication flows |  | see Requires |
| GET | `/api/v1/auth/info` | no permission: public auth flow / self-scoped (login, register, oauth, sso, saml, logout) | system: authentication flows |  | see Requires |
| POST | `/api/v1/auth/login` | no permission: public auth flow / self-scoped (login, register, oauth, sso, saml, logout) | system: authentication flows |  | see Requires |
| POST | `/api/v1/auth/logout` | no permission: public auth flow / self-scoped (login, register, oauth, sso, saml, logout) | system: authentication flows |  | see Requires |
| POST | `/api/v1/auth/mfa/enroll/confirm` | no permission: public auth flow / self-scoped (login, register, oauth, sso, saml, logout) | system: authentication flows |  | see Requires |
| POST | `/api/v1/auth/mfa/enroll/start` | no permission: public auth flow / self-scoped (login, register, oauth, sso, saml, logout) | system: authentication flows |  | see Requires |
| POST | `/api/v1/auth/mfa/verify` | no permission: public auth flow / self-scoped (login, register, oauth, sso, saml, logout) | system: authentication flows |  | see Requires |
| GET | `/api/v1/auth/oauth/providers` | no permission: public auth flow / self-scoped (login, register, oauth, sso, saml, logout) | system: authentication flows |  | see Requires |
| GET | `/api/v1/auth/oauth/{provider}/authorize` | no permission: public auth flow / self-scoped (login, register, oauth, sso, saml, logout) | system: authentication flows |  | see Requires |
| POST | `/api/v1/auth/oauth/{provider}/callback` | no permission: public auth flow / self-scoped (login, register, oauth, sso, saml, logout) | system: authentication flows |  | see Requires |
| GET | `/api/v1/auth/providers` | no permission: public auth flow / self-scoped (login, register, oauth, sso, saml, logout) | system: authentication flows |  | see Requires |
| POST | `/api/v1/auth/refresh` | no permission: public auth flow / self-scoped (login, register, oauth, sso, saml, logout) | system: authentication flows |  | see Requires |
| POST | `/api/v1/auth/register` | no permission: public auth flow / self-scoped (login, register, oauth, sso, saml, logout) | system: authentication flows |  | see Requires |
| POST | `/api/v1/auth/reset-password` | no permission: public auth flow / self-scoped (login, register, oauth, sso, saml, logout) | system: authentication flows |  | see Requires |
| POST | `/api/v1/auth/saml/{org}/acs` | no permission: public auth flow / self-scoped (login, register, oauth, sso, saml, logout) | system: authentication flows |  | see Requires |
| GET | `/api/v1/auth/saml/{org}/login` | no permission: public auth flow / self-scoped (login, register, oauth, sso, saml, logout) | system: authentication flows |  | see Requires |
| GET | `/api/v1/auth/saml/{org}/metadata` | no permission: public auth flow / self-scoped (login, register, oauth, sso, saml, logout) | system: authentication flows |  | see Requires |
| GET | `/api/v1/auth/sso/providers` | no permission: public auth flow / self-scoped (login, register, oauth, sso, saml, logout) | system: authentication flows |  | see Requires |
| GET | `/api/v1/auth/sso/{provider}/authorize` | no permission: public auth flow / self-scoped (login, register, oauth, sso, saml, logout) | system: authentication flows |  | see Requires |
| POST | `/api/v1/auth/sso/{provider}/callback` | no permission: public auth flow / self-scoped (login, register, oauth, sso, saml, logout) | system: authentication flows |  | see Requires |
| GET | `/api/v1/auth/step-up` | no permission: public auth flow / self-scoped (login, register, oauth, sso, saml, logout) | system: authentication flows |  | see Requires |
| POST | `/api/v1/auth/step-up` | no permission: public auth flow / self-scoped (login, register, oauth, sso, saml, logout) | system: authentication flows |  | see Requires |
| POST | `/api/v1/auth/token` | no permission: public auth flow / self-scoped (login, register, oauth, sso, saml, logout) | system: authentication flows |  | see Requires |
| POST | `/api/v1/auth/verify-email` | no permission: public auth flow / self-scoped (login, register, oauth, sso, saml, logout) | system: authentication flows |  | see Requires |
| GET | `/api/v1/me/bootstrap` | no permission: self-scoped: /me/* reads the caller's own perms/modules/roles | system: the caller's own permissions, groups and assets |  | see Requires |
| GET | `/api/v1/me/event-types` | no permission: self-scoped: /me/* reads the caller's own perms/modules/roles | system: the caller's own permissions, groups and assets |  | see Requires |
| GET | `/api/v1/me/modules` | no permission: self-scoped: /me/* reads the caller's own perms/modules/roles | system: the caller's own permissions, groups and assets |  | see Requires |
| GET | `/api/v1/notifications` | no permission: tenant+user-scoped in handler | scoped: per-recipient scope on finding and asset notices |  | see Requires |
| GET | `/api/v1/notifications/preferences` | no permission: tenant+user-scoped in handler | scoped: per-recipient scope on finding and asset notices |  | see Requires |
| PUT | `/api/v1/notifications/preferences` | no permission: tenant+user-scoped in handler | scoped: per-recipient scope on finding and asset notices |  | see Requires |
| POST | `/api/v1/notifications/read-all` | no permission: tenant+user-scoped in handler | scoped: per-recipient scope on finding and asset notices |  | see Requires |
| GET | `/api/v1/notifications/unread-count` | no permission: tenant+user-scoped in handler | scoped: per-recipient scope on finding and asset notices |  | see Requires |
| PATCH | `/api/v1/notifications/{id}/read` | no permission: tenant+user-scoped in handler | scoped: per-recipient scope on finding and asset notices |  | see Requires |
| GET | `/api/v1/users/me` | no permission: self-scoped: acts only on the authenticated user | system: the caller's own account |  | see Requires |
| PUT | `/api/v1/users/me` | no permission: self-scoped: acts only on the authenticated user | system: the caller's own account |  | see Requires |
| GET | `/api/v1/users/me/2fa` | no permission: self-scoped: acts only on the authenticated user | system: the caller's own account |  | see Requires |
| POST | `/api/v1/users/me/2fa/disable` | no permission: self-scoped: acts only on the authenticated user | system: the caller's own account |  | see Requires |
| POST | `/api/v1/users/me/2fa/enable` | no permission: self-scoped: acts only on the authenticated user | system: the caller's own account |  | see Requires |
| POST | `/api/v1/users/me/2fa/recovery-codes` | no permission: self-scoped: acts only on the authenticated user | system: the caller's own account |  | see Requires |
| POST | `/api/v1/users/me/2fa/setup` | no permission: self-scoped: acts only on the authenticated user | system: the caller's own account |  | see Requires |
| POST | `/api/v1/users/me/change-password` | no permission: self-scoped: acts only on the authenticated user | system: the caller's own account |  | see Requires |
| GET | `/api/v1/users/me/preferences` | no permission: self-scoped: acts only on the authenticated user | system: the caller's own account |  | see Requires |
| PUT | `/api/v1/users/me/preferences` | no permission: self-scoped: acts only on the authenticated user | system: the caller's own account |  | see Requires |
| DELETE | `/api/v1/users/me/sessions` | no permission: self-scoped: acts only on the authenticated user | system: the caller's own account |  | see Requires |
| GET | `/api/v1/users/me/sessions` | no permission: self-scoped: acts only on the authenticated user | system: the caller's own account |  | see Requires |
| DELETE | `/api/v1/users/me/sessions/{sessionId}` | no permission: self-scoped: acts only on the authenticated user | system: the caller's own account |  | see Requires |
| GET | `/api/v1/users/me/tenants` | no permission: self-scoped: acts only on the authenticated user | system: the caller's own account |  | see Requires |
| GET | `/api/v1/ws` | no permission: session (cookie or Bearer, no API keys) through the tenant chain: SSO enforcement, IP allowlist, RequireTenant, active membership (realtimeMiddlewares, RFC-045); socket bound to the session and closed on revocation or expiry; channels authorized per subscription by Hub.defaultAuthorize | scoped: finding and triage channels need the finding in scope |  | see Requires |
