---
title: Scan identification
parent: Scanning
nav_order: 3.8
---

# Scan identification
{: .no_toc }

The owners of the systems you scan often need to tell your authorized scan
traffic apart from everything else in their WAF, SIEM and logs. Every HTTP
request of a scan, a retest and a validation can carry a **User-Agent** and
**request headers** that you choose, and the platform shows the
**scanner addresses** your scans leave from.

1. TOC
{:toc}

## Where markers are set

Markers come from layers that are merged, never replaced: every distinct
header name is kept.

| Layer | Where | Who | At most |
|---|---|---|---|
| Platform | Console **System > Scan identification** | platform administrators | a User-Agent and 4 headers, each optionally **Enforced** |
| Organization | **Settings > Scanning > Scan identification** | the organization owner | a User-Agent and 6 headers |
| Bug-bounty program | the program's rules | the program | 10 headers |
| Sensor host | the sensor's local policy (`http.headers`) | whoever runs the sensor | 4 headers |

On a clash (names compare without case) the more specific layer wins, except
over a header the platform enforces:

1. a platform header or User-Agent marked **Enforced**;
2. bug-bounty program rules, on program targets;
3. the sensor host's headers (never over a locked name; see
   [Scan headers on a sensor](../sensors/network.md));
4. the organization's headers and User-Agent;
5. the platform's other headers and User-Agent, used as defaults.

Nothing is sent unless someone configures it, and no default names your
organization.

## Organization settings

**Settings > Scanning > Scan identification** (owner only, with a recent
sign-in; the change is audited with the security settings):

- **User-Agent of scan tools**: sent by your scan tools instead of their own.
  At most 256 printable ASCII characters. When it is empty, the platform
  default is used, and the page shows it under **Platform default, used while
  this is empty**. When the platform enforces one, the page says **The
  platform sets the User-Agent**.
- **Request headers**: any name and value, for example `ATTT: is-here`
  (**Add header**; a counter shows how many are used). A name is an HTTP token
  (letters, digits and ``!#$%&'*+-.^_`|~``, no space or colon) of at most 64
  characters; a value is printable ASCII without line breaks, at most 200
  characters. Names are not case-sensitive and may appear once. Connection,
  proxy, `Host`, `Authorization` and `Cookie` headers cannot be set (also
  `Content-Length`, `Transfer-Encoding`, `Keep-Alive`, `TE`, `Trailer`,
  `Upgrade`).
- **Set by the platform** lists the platform's headers, each **Enforced** or
  **Default, yours replaces it**. When you set a header the platform enforces,
  the page says that your value for it is not sent.
- **What a target receives** previews the merged User-Agent and headers. A
  sensor's local policy may add headers of its own, and bug-bounty program
  rules apply on program targets.

The settings are saved with **Save changes**. Through the API they are the
security settings fields `tool_http_user_agent` and `tool_http_headers`
(`PATCH /api/v1/tenants/{tenant}/settings/security`, `settings:write`, owner,
recent sign-in, `If-Match`); `GET` on the settings also returns the platform
layer as `security.platform_scan_identification`.

## Platform settings

In the console, **System > Scan identification** sets the platform layer for
every organization: a **User-Agent** (with **Enforce: organizations cannot
replace it**) and up to 4 **Request headers**, each of which can be
**Enforced**. Saving asks for a fresh code and a reason, is audited with the
old and new values, and notifies every administrator. The new values go out
with every scan job delivered from then on. API:
`GET` and `PUT /api/v1/admin/settings/scan-identification`
(`platform.settings.general.write` to change).

## How a job carries them

When a sensor claims a scan, retest or validation job, the platform merges the
platform layer and the layer of the job's own organization into the job's
signed HTTP policy. A shared sensor serving several organizations gets each
job with its own organization's markers only. Program rules go over them.
After the merge a job carries at most 10 headers; a program whose headers
would push a job over that fails it with `PROGRAM_RULES_CONFLICT`.

On the sensor, each tool gets the markers through its own flags (nuclei,
httpx and katana carry headers). A tool that cannot carry headers is refused
while markers apply, so nothing probes unmarked. Retest and validation jobs
also carry the organization's User-Agent and TLS setting.

## Use markers safely

- Anyone who learns a header can send it. Use markers to tag scan traffic in
  logs, or let traffic through a WAF only together with the
  [scanner addresses](../sensors/proxies.md) your scans leave from. Never let
  a static header alone bypass a WAF.
- Never put a secret or personal data in a marker: markers are visible to the
  scanned systems and stored as plain settings.

Not available yet: a query parameter marker, a per-run "sent with" view, a
signed scan token a target can verify, and overrides per scan profile or
asset group.

How it works in detail:
[scan identification markers](https://github.com/openctemio/openctem/blob/develop/api/docs/architecture/scan-identification.md).
