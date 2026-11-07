---
title: Scan identification
parent: Scanning
nav_order: 3.8
---

# Scan identification
{: .no_toc }

The owners of the systems you scan often need to tell your authorized scan
traffic apart from everything else in their WAF, SIEM and logs. Every HTTP
request of a scan, a retest and a validation can carry a **User-Agent** (one,
or a rotation list), **request headers** and a **query parameter** that you
choose. You can **require** identification so that nothing is sent without
it, and the platform shows the **scanner addresses** your scans leave from.

1. TOC
{:toc}

## Where markers are set

Markers come from layers that are merged, never replaced: every distinct
header name is kept.

| Layer | Where | Who | At most |
|---|---|---|---|
| Platform | Console **System > Scan identification** | platform administrators | a User-Agent or a rotation list, 4 headers, a query parameter; each optionally **Enforced** |
| Organization | **Settings > Scanning > Scan identification** | the organization owner | a User-Agent or a rotation list, 6 headers, a query parameter |
| Bug-bounty program | the program's rules | the program | a User-Agent or a rotation list, 10 headers |
| Sensor host | the sensor's local policy (`http.user_agent` or `http.user_agents`, `http.headers`) | whoever runs the sensor | a User-Agent or a rotation list, 4 headers |

Each of the platform, organization and program layers can also turn on
**Require identification on every request** (see below).

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
plus `tool_http_user_agents`, `tool_http_query` and
`tool_http_identification_required`
(`PATCH /api/v1/tenants/{tenant}/settings/security`, `settings:write`, owner,
recent sign-in, `If-Match`); `GET` on the settings also returns the platform
layer as `security.platform_scan_identification`.

## Require identification on every request

Turn on **Require identification on every request** (platform, organization,
or a program's rules; new programs have it on) when every request your scans
send must carry your headers or query parameter. Once any layer requires it, no
lower layer can turn it off; the page shows **Required by** with the layer.

With the requirement on:

- A scan whose merged markers have no header and no query parameter fails
  when a sensor would take it, with `IDENTIFICATION_REQUIRED_MISSING`. The
  settings page warns about this before you save; add a header or a query
  parameter.
- A sensor that cannot enforce the requirement (one that does not report
  `http.identity.required@1`; update it) never gets such a scan; the scan
  waits for a sensor that can.
- On the sensor, each tool step is decided before it starts:

  | The tool can send the headers and query parameter itself | The sensor's sandbox confines the network | What happens |
  |---|---|---|
  | yes | either | the tool sends them on every request |
  | no | yes | the sensor's forwarder adds them to every HTTP request and refuses any other traffic of that step |
  | no | no | the step is skipped with the reason; it sends no request |

  Steps that reach targets without HTTP (port scans, DNS) are not affected.

Without the requirement, a query parameter a tool cannot carry is reported as
**Not sent** and the step still runs.

## User-Agent rotation

Under **Advanced: User-Agent rotation**, enter up to 200 User-Agents, one per
line, instead of the single one (each at most 256 printable ASCII characters,
no duplicates; the page shows the line of each error). Each target host of a
scan run gets one of them, and keeps it for every request of that run, so a
session never changes its fingerprint half way. Different runs and hosts are
spread evenly over the list.

- The list is used whole: the most specific layer that sets a User-Agent or a
  list wins, as for a single User-Agent. A platform **Enforced** list or a
  program's list cannot be replaced by the sensor host.
- Rotation changes only the User-Agent. Your headers and query parameter are
  sent with every value, and a required identification is enforced as above.
- A sensor that predates rotation sends the list's first value.
- Rotation is for authorized testing inside your organization's scope. It
  never replaces identification: if the target owner must recognize your
  traffic, set a header or query parameter and require it.

## Query parameter

Under the advanced section, **Query parameter** adds `name=value` to the URL
of every request (for example `?scan=example-1`). Name and value are each 1 to
64 letters, digits or `. _ ~ -`. The platform can enforce its own.

## What a scan sent

On a run's detail, each step shows **Sent with**: the User-Agent and its
layer (**Rotating over N values, one per target host** when a list was in
force), each header with its layer, the query parameter, whether
identification was required, and who added it (**Sent by the tool** or
**Added by the sensor forwarder**). Anything not sent is marked **Not sent**
with the reason. Values of names that look like secrets are masked.

## Platform settings

In the console, **System > Scan identification** sets the platform layer for
every organization: a **User-Agent** or a rotation list (with **Enforce:
organizations cannot replace it**), up to 4 **Request headers**, each of
which can be **Enforced**, a **Query parameter** (also enforceable) and
**Require identification on every request**. Saving asks for a fresh code and a reason, is audited with the
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
- Every change is audited: platform changes with the old and new values and a
  reason, organization changes with the security settings (turning the
  requirement off at high severity), program rules with the program.
- Use rotation only for authorized testing within the scope your organization
  enforces. It must not be used to hide who is scanning: keep an identifying
  header or query parameter, and require it where the target owner expects it.

Not available yet: a signed scan token a target can verify, and overrides per
scan profile or asset group.

How it works in detail:
[scan identification markers](https://github.com/openctemio/openctem/blob/develop/server/docs/architecture/scan-identification.md).
