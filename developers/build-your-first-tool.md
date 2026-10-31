---
title: Build your first tool
parent: Developers
nav_order: 9
---
{% raw %}

# Build your first tool

This walk-through takes a new tool from an empty directory to findings in your organization:
write it, test it on your laptop with no platform, install it on one of your sensors, and run it
from a scan. It takes about 20 minutes. The reference for every field is
[Writing a tool](tool-authoring.md).

The example is **acme-headers**, a Python tool that reports web servers missing three security
headers (`Strict-Transport-Security`, `Content-Security-Policy`, `X-Content-Type-Options`). The
finished tool is not shipped as a sample; the closest runnable example in the SDK repository is
[examples/python-adapter](https://github.com/openctemio/sdk-go/tree/main/examples/python-adapter).

You need Python 3 and either the `openctem` CLI binary or Go 1.26.

## 1. Install the CLI

```bash
# A release binary (Linux and macOS, amd64 and arm64), checked against the signed checksums:
V=0.40.0   # the SDK release you pin
curl -sSLO https://github.com/openctemio/sdk-go/releases/download/v$V/openctem_${V}_linux_amd64.tar.gz
curl -sSLO https://github.com/openctemio/sdk-go/releases/download/v$V/SHA256SUMS
sha256sum -c SHA256SUMS --ignore-missing && tar xzf openctem_${V}_linux_amd64.tar.gz

# Or with Go:
go install github.com/openctemio/sdk-go/cmd/openctem@v$V

openctem version
```

Release binaries come with SDK v0.38.0 and later; for older releases, use `go install`.
How to verify the checksum signature is in
[docs/tools/cli.md](https://github.com/openctemio/sdk-go/blob/main/docs/tools/cli.md).

## 2. Pick a capability

A tool implements **capabilities** from a closed list
([capabilities.md](https://github.com/openctemio/ctis/blob/main/docs/capabilities.md)). The
capability decides the phase, the minimum tier, the target types the tool may take and the output
every report must carry; scans pick tools by capability.

A header check finds weaknesses on known web services, so it implements `vuln.templates@1`
("vulnerability templates", the home of non-intrusive checks of a known surface, including
configuration checks). Its reports must give every finding a `rule_id`, a `severity`, a `title`
and where it was found (for a web check, `web.url`).

## 3. Scaffold

```bash
openctem tool init --kind python --capability vuln.templates@1 --name acme-headers acme-headers
cd acme-headers
```

`init` writes `tool.yaml` (the descriptor, in its JSON form so the Python helper reads it without
extra packages), `acme-headers.py`, the helper `openctem_tool.py`, a self-test fixture, a
`Makefile` and a CI workflow. It never overwrites a file.

## 4. Edit the descriptor

Open `tool.yaml` and narrow what the scaffold filled in from the capability:

- `description`: what the tool does, shown in the console.
- `consumes`: `["http_service", "website", "web_application"]`. The capability also takes hosts
  and services, but this tool only reads URLs.
- `produces`: `["finding:misconfiguration"]`.
- `implements[0].params` and `config`: keep only the standard params the tool takes. A step that
  sets a param your tool does not map skips your tool, so do not map what you ignore. Here keep
  `rate` (requests per second) with `"x-octm-common": "rate"`, so the platform's limits and the
  sensor's rate cap reach it.

`openctem tool validate .` checks the result. Every error names the field as a JSON pointer and,
from SDK v0.38.0, the fix (`did you mean "misconfiguration"?`).

## 5. Write the check

Replace the body of `run` in `acme-headers.py`:

```python
import urllib.request
import openctem_tool as ot

WANT = {
    "strict-transport-security": ("acme-headers/hsts-missing", "medium", "Strict-Transport-Security header missing"),
    "content-security-policy": ("acme-headers/csp-missing", "low", "Content-Security-Policy header missing"),
    "x-content-type-options": ("acme-headers/xcto-missing", "low", "X-Content-Type-Options header missing"),
}


def run(ctx, task):
    for t in task.targets:
        ctx.check()  # stops when the runtime cancels the task
        try:
            with urllib.request.urlopen(t.value, timeout=10) as r:
                have = {k.lower() for k in r.headers.keys()}
        except Exception as e:
            ctx.failed(t, ot.TARGET_UNREACHABLE, e)
            continue
        for header, (rule, severity, title) in WANT.items():
            if header not in have:
                ctx.finding(t, {"type": "misconfiguration", "rule_id": rule, "severity": severity,
                                "title": title, "web": {"url": t.value}})
        ctx.done(t)
```

- Standard output is the protocol channel: log with `ctx.log`, or print to stderr.
- Report every target once: `ctx.done`, `ctx.failed` with an error class, or `ctx.skipped`.
- `urllib` honours `HTTPS_PROXY` and `HTTP_PROXY`. On a sensor that confines the task's network,
  those point at the task's forwarder, which lets the tool reach only its targets.

## 6. Run it on your laptop

Nothing here talks to a platform: the CLI runs the task through the same runtime and sandbox a
sensor uses.

```bash
python3 -m http.server 8000 --bind 127.0.0.1 &      # a local target with none of the headers
openctem tool run "$PWD" --target http://127.0.0.1:8000/@http_service --format table
openctem tool run "$PWD" --target http://127.0.0.1:8000/@http_service --format ctis   # the CTIS report
```

The table shows the outcome, one line per target and one per record. The CTIS report carries
the provenance the runtime stamps (tool, version, descriptor digest, sandbox state). Pass the tool
directory as an absolute path.

## 7. Test it

```bash
openctem tool test --update .          # record fixtures/expect.ctis.json from a real run, then review it
openctem tool test .                   # self-tests and protocol checks
openctem tool test --capability --scope --fuzz 30s .
```

- **Fixtures.** From SDK v0.38.0 the scaffold's fixture asks the kit to serve a
  canned HTTP response on loopback (`"serve"` in `fixtures/task.json`, targets written as
  `{{fixture.url}}`), so self-tests never reach a host on the internet. With an older scaffold,
  point the fixture's target at a local server yourself.
- **`--capability`** runs the capability's own suite on local fixtures (for `vuln.templates@1`:
  an app exposing `/.git/config` and `/.env`).
- **`--scope`** gives the tool one target while another address listens nearby. Any connection
  to anything but the target fails the check and names the destination.

The CI workflow `init` wrote runs the same checks, plus `openctem tool diff` against the target
branch, which fails a change that needs a bigger version bump than you made.

## 8. Install it on a sensor

A sensor loads the tools in the directories listed in `SENSOR_ADAPTER_DIRS`. Each tool is a
directory with its `tool.yaml`. The directory and every file in it must be owned by root or the
sensor's user, not writable by group or others, and not symbolic links; a tool that fails a check
is skipped and reported on the sensor's **Setup & health** checklist (`adapter_refused`, with the
reason). Restart the sensor after adding or changing a tool.

Copy only what the tool needs (no `fixtures/`, `.github/` or `__pycache__/`):

```bash
sudo install -d -o root -g root -m 0755 /etc/openctem/tools/acme-headers
sudo install -o root -g root -m 0644 tool.yaml openctem_tool.py /etc/openctem/tools/acme-headers/
sudo install -o root -g root -m 0755 acme-headers.py /etc/openctem/tools/acme-headers/
```

### A sensor installed as a binary

Set `SENSOR_ADAPTER_DIRS=/etc/openctem/tools` in the sensor's environment and restart it. The
host needs `python3` on the sensor user's `PATH`.

### A sensor in a container

The published sensor image is minimal: it has no shell and no Python, so only static binaries run
in it as tools. For a tool that needs an interpreter, build your own image with the sensor binary
from the published image (it is a static binary):

```dockerfile
ARG SENSOR_VERSION={% endraw %}{{ site.data.versions.sensor }}{% raw %}
FROM ghcr.io/openctemio/sensor:${SENSOR_VERSION} AS sensor

FROM python:3.12-slim
RUN useradd --uid 999 --user-group --create-home --home-dir /home/openctem openctem \
 && install -d -o 999 -g 999 /var/lib/openctem /scan
COPY --from=sensor /usr/local/bin/openctemio-sensor /usr/local/bin/openctemio-sensor
# The built-in scanners you also want this sensor to run, for example:
COPY --from=sensor /usr/local/bin/httpx /usr/local/bin/nuclei /usr/local/bin/
COPY tools/ /etc/openctem/tools/
RUN chown -R root:root /etc/openctem/tools && chmod -R go-w /etc/openctem/tools
ENV HOME=/home/openctem SENSOR_ADAPTER_DIRS=/etc/openctem/tools
USER 999:999
WORKDIR /scan
ENTRYPOINT ["/usr/local/bin/openctemio-sensor"]
CMD ["-verbose"]
```

Run it like the published image ([Deploy with Docker](../sensors/deploy-docker.md)): one volume
at `/var/lib/openctem`, the same environment. You rebuild this image for every sensor release,
and the platform's managed image updates do not apply to it. A tool written in Go, or any static
binary, needs none of this: mount its directory read-only into the published image and set
`SENSOR_ADAPTER_DIRS`.

### Check that it loaded

The sensor's start-up log prints `Adapter tool: acme-headers 0.1.0 (...)` for each tool it
loaded and a warning with the reason for each one it refused. Sensor releases that include it
also list operator-installed tools, and why any was refused, without connecting to a platform:

```bash
SENSOR_ADAPTER_DIRS=/etc/openctem/tools openctemio-sensor tools manifests
```

## 9. Run it from a scan

1. **It joins your catalog.** Once the sensor reports the tool, open the sensor (**Discovery >
   Sensors**), tab **Manifest**: the tool is listed with its contract, its descriptor digest and
   its options. It also appears under **Settings > Scanning > Tools**, enabled. Nothing in the
   platform has to change.
2. **Allow it to run.** A tool your operator installed is **unverified** and runs as **T2**
   (intrusive), whatever tier it asks for. The sensor must be **Trusted** and its grant must
   allow T2 (**Widen sensor grants**), and the targets need scope that allows T2 probes
   ([Grants and trust](../sensors/pairing.md#grants-and-trust), [Scope](../scanning/scope.md)).
3. **Use it in a workflow.** Add a step pinned to `acme-headers`. On platform releases that route
   declared tools by capability, a step that names the capability (`vuln.templates`) also offers
   it: after the built-in implementations, or first when the step's preferred tools list it. The
   step's standard params reach the tool under its own config keys.
4. **Read the results.** Findings land like any scanner's, with the tool and descriptor digest in
   their provenance.

## 10. When something fails

| Symptom | Where to look |
|---|---|
| `validate` refuses the descriptor | The JSON pointer in the message; [Writing a tool](tool-authoring.md) for the field |
| A fixture differs | `openctem tool test --update .`, then review the diff of `fixtures/expect.ctis.json` |
| The sensor did not load the tool | Its start-up log, the **Setup & health** checklist (`adapter_refused`) or `openctemio-sensor tools manifests` |
| The tool is not in the catalog | The sensor's **Manifest** tab lists anything the platform ignored, with the reason |
| A step does not pick the tool | The step's error names each tool it skipped and why (`NO_MATCHING_TOOL`), for example a param the tool does not take |
| A task failed | Open the run, then **Tasks**, then **Logs**: the tool's log lines and the outcome with its error class (`target_unreachable`, `invalid_input`, `refused_by_policy`, ...) |

## Version notes

| Feature | Needs |
|---|---|
| `openctem tool init/validate/run/test/diff/describe` | sdk-go v0.34.0 or later |
| Release binaries, `openctem version`, errors that name the fix, kit-served fixtures | sdk-go v0.38.0 or later |
| Tools join the organization's catalog | platform v0.9.6 or later |
| `tools manifests` lists operator-installed tools | sensor releases after v0.23.2 |
| Capability steps offer declared tools | platform releases after v0.14.0 |
{% endraw %}
