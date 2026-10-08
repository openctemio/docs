---
title: Writing a tool
parent: Developers
nav_order: 8
---
{% raw %}

# Writing a tool

A **tool** is a program a sensor runs for a scan step: a port scanner, a web prober, a code
analyzer, a connector to another product. Sensors ship with built-in tools; this page shows how to
add your own. You can wrap an existing command-line scanner without writing code, write an adapter
in any language, or write the tool in Go with the SDK.

The contract is **tool contract v1** (RFC-055), implemented by
[openctemio/sdk-go](https://github.com/openctemio/sdk-go). The platform side is described in
[tool-contract.md](https://github.com/openctemio/openctem/blob/develop/api/docs/architecture/tool-contract.md).

{: .note }
The tool contract, the `openctem` CLI and the capability-based builder are on the `main` branch of
sdk-go and are not in a tagged release yet (the latest tag, v0.18.0, predates them). Until the
next sdk-go release, install the CLI from `@main` as shown below.

## Concepts

| Term | Meaning |
|---|---|
| **Capability** | An act, such as `scan.ports@1` or `secrets.code@1`, from a closed taxonomy. It fixes the phase, the minimum tier, the input and output types, the standard parameters and the output every report must carry. You implement capabilities; you do not invent them. |
| **Descriptor** | `tool.yaml` (`apiVersion: openctem.io/tool/v1`): what your tool implements, consumes and produces, its configuration schema, permissions, resources, self-tests and how to start it. The runtime trusts this file, never the program. |
| **Tier** | How intrusive the act is: T0 passive, T1 active, T2 intrusive. The effective tier is never below the capability's floor; side effects make it T2. |
| **Trust** | Who vouches for the tool: `builtin` (in the signed sensor), `certified` (signed attestation), or `unverified` (anything an operator installs). |
| **Output** | Always CTIS records. The runtime validates them against the descriptor and the capability before anything leaves the sensor. |

The capabilities and their required output are listed in
[docs/capabilities.md of the ctis repository](https://github.com/openctemio/ctis/blob/main/docs/capabilities.md).
Capabilities marked `routed` are the ones the platform places in scan workflows today:

| If your tool... | Implement |
|---|---|
| lists subdomains of a domain | `discover.subdomains@1` |
| resolves names | `resolve.dns@1` |
| finds open ports | `scan.ports@1` |
| probes web services | `probe.http@1` |
| crawls a site | `crawl.web@1` |
| runs vulnerability checks or templates | `vuln.templates@1` |
| tests a web application dynamically | `dast.web@1` (T2) |
| analyzes source code | `sast.code@1` |
| finds secrets in a repository | `secrets.code@1` |
| checks dependencies | `sca.deps@1` |
| checks infrastructure-as-code | `iac.misconfig@1` |
| checks container images | `container.image@1` |
| pulls results from a network vulnerability product | `network_va.connector@1` |
| imports a file | `import.file@1` |

## Choose how to build it

| Your scanner... | Kind | Code to write |
|---|---|---|
| prints SARIF | `exec-sarif` | none |
| prints CTIS, or one CTIS record per line | `exec-ctis` | none |
| prints JSON or JSON Lines | `exec-json` | a mapping file |
| prints a format OpenCTEM already reads (nuclei, semgrep, trivy, grype, betterleaks, gitleaks, zap, vuls, CycloneDX, SPDX, OSV, CSAF, OpenVEX, Nessus, Qualys, DefectDojo) | `exec-json`, then set `run.output.format` to that name | none |
| needs logic (per-target status, credentials, HTTP calls) | `python` (or any language) | an adapter speaking the adapter protocol |
| is written in Go | `go` | a Go program using `pkg/tool` |

## 1. Scaffold

```bash
go install github.com/openctemio/sdk-go/cmd/openctem@main
openctem tool init --kind exec-json --capability scan.ports@1 --name acme-ports acme-ports
```

`init` never overwrites a file. It writes:

| File | What it is |
|---|---|
| `tool.yaml` | the descriptor, pre-filled from the capability |
| `mapping.yaml` | a mapping stub (`exec-json` only) |
| `bin/acme-ports` | a stub program that emits nothing (exec kinds) |
| `fixtures/task.json`, `fixtures/expect.ctis.json` | one self-test |
| `Makefile` | `validate`, `test`, `conformance` |
| `.github/workflows/openctem-tool.yml` | CI for your tool |

## 2. Edit the descriptor

This is what `init` wrote for `scan.ports@1`, with the fields you normally change:

```yaml
apiVersion: openctem.io/tool/v1
name: acme-ports
version: "0.1.0"
description: "Fast TCP connect port scanner."
engine:
  name: acme-ports
  version_probe: [./bin/acme-ports, "--version"]
class: target-scan
tier: T1                              # a request; never below the capability's floor
implements:
  - capability: scan.ports@1
    output_shape: open_port_assets
    params:                           # the capability's standard params -> your config keys
      ports: {}
      protocol: {}
      rate: {}
      top_n: {}
consumes: [domain, subdomain, ip_address, host]
produces: ["asset:open_port", "asset:service", "asset:ip_address", "asset:host"]
config:
  type: object
  additionalProperties: false
  properties:
    ports:    {type: string, maxLength: 2048, pattern: "^[0-9]{1,5}(-[0-9]{1,5})?(,[0-9]{1,5}(-[0-9]{1,5})?)*$"}
    protocol: {type: string, enum: [tcp]}
    rate:     {type: integer, minimum: 1, maximum: 100000}
    top_n:    {type: integer, minimum: 1, maximum: 65535}
permissions:
  network: targets
safety:
  rate_param: rate
run:
  profile: exec
  argv: [./bin/acme-ports, "{{target.value}}"]
  output: {format: jsonl, from: stdout, mapping: mapping.yaml}
selftest:
  - name: sample
    task: fixtures/task.json
    expect: fixtures/expect.ctis.json
```

Rules that keep a tool safe and portable:

- **`argv` is never a shell.** Placeholders are a closed set: `{{config.<key>}}`,
  `{{target.value}}`, `{{target.host}}`, `{{target.port}}`, `{{target.url}}`,
  `{{task.targets_file}}`, `{{task.targets_json}}`, `{{task.config_file}}`,
  `{{task.web_scope_file}}`, `{{task.output}}`, `{{task.workdir}}`. A substituted value that
  starts with `-` or contains control characters is refused.
- **Unknown keys are errors.** The descriptor is loaded strictly.
- **Secrets are never config.** Declare them under `permissions.credentials`; the sensor operator
  stores them, and the tool receives them only in the run message, never in the environment, argv
  or a file.
- **`params` is the bridge to scan workflows.** A standard param you do not map is one your tool
  does not take; a workflow step that sets it will not pick your tool. `values`, `min` and `max`
  narrow what you support.
- **Declare side effects** (`safety.side_effects`). A tool that can change the target is T2.
- **Network class.** `permissions.network` says what the tool may reach (`none`, `targets`, ...).
  The sandbox enforces it.

## 3. Map the output (exec-json)

Suppose the scanner prints one line per open port:

```json
{"ip":"192.0.2.10","port":443,"protocol":"TCP"}
```

`mapping.yaml` turns each line into a CTIS record:

```yaml
apiVersion: openctem.io/mapping/v1
source: jsonl
records:
  - when: {path: /port, exists: true}
    kind: asset
    set:
      type: {const: open_port}
      value: {template: "{ip}:{port}", vars: {ip: /ip, port: /port}}
      properties.host: /ip
      properties.port: {path: /port, as: integer}
      properties.protocol: {path: /protocol, lower: true, default: tcp}
```

The mapping language is closed on purpose:

- **values:** a source path (`/a/b`, `/list/0`), `const`, or `template` with named `vars`;
- **transforms:** `first`, `trim`, `lower`, `upper`, `split`, `map` (an enum table), `join`,
  `as` (integer, boolean, string), `max_bytes`, and `default`;
- **predicates** (`when`): `exists`, `equals`, `in`, `matches` (RE2, length-capped).

There is no code, no jq and no template engine. Lines that match no rule are skipped. For a single
JSON document, use `source: json` and point `each:` at the list of results. The mapping file is
part of the contract: its digest is recorded when the descriptor is loaded, and a changed file is
refused.

## 4. Or write an adapter in any language

A tool with logic is a program that speaks **adapter protocol v1** on stdin and stdout:
newline-delimited JSON, one message per line (at most 1 MiB), every message with `"v": 1` and a
`"type"`. **stdout is the protocol channel only**; diagnostics go to stderr. One task per process.

```
runtime -> {"v":1,"type":"hello","protocol":[1],...}
tool    -> {"v":1,"type":"hello","protocol":1,"sdk":{"name":"my-tool","version":"1.0.0"}}
runtime -> {"v":1,"type":"describe"}
tool    -> {"v":1,"type":"manifest","manifest":{ ...tool.yaml as JSON, without run... }}
runtime -> {"v":1,"type":"validate","task":{...}}                       (optional)
tool    -> {"v":1,"type":"validation","ok":true}
runtime -> {"v":1,"type":"run","task":{"id":"...","targets":[{"ref":"t1","type":"http_service","value":"http://app.example.com"}],"config":{},"workdir":"/run/task"}}
tool    -> {"v":1,"type":"record","kind":"finding","target":"t1","data":{ one CTIS finding }}
tool    -> {"v":1,"type":"target_status","target":"t1","status":"done"}
tool    -> {"v":1,"type":"result","status":"ok"}
```

- Messages to the tool: `hello`, `describe`, `validate`, `run`, `cancel`. From the tool:
  `hello`, `manifest`, `validation`, `log`, `progress`, `record`, `report_info`,
  `target_status`, `artifact`, `heartbeat`, `verdict` (retest tasks), `result`. Ignore message
  types and members you do not know (except during the handshake).
- The `manifest` you send must match `tool.yaml` exactly (the `run` section aside), or the tool is
  refused.
- Report every target once with `target_status` (`done`, `failed` or `skipped`, with an error
  class for a failure). A `result` of `ok` with unreported targets becomes `partial`.
- Error classes: `invalid_input`, `target_unreachable`, `refused_by_policy`, `transient`,
  `rate_limited`, `auth_failed`, `permission_denied`, `not_found`, `tool_error`.
- Send something (a `heartbeat` will do) at least every idle timeout (10 minutes by default). On
  `cancel`, send `result` with `canceled`; after a 10-second grace the runtime sends SIGTERM, then
  SIGKILL.
- The outcome is the `result` message, not the exit code. Exit after it.

`openctem tool init --kind python` writes a working skeleton. A complete example with no
dependencies is
[examples/python-adapter](https://github.com/openctemio/sdk-go/tree/main/examples/python-adapter),
and the full contract is
[docs/adapter-protocol.md](https://github.com/openctemio/sdk-go/blob/main/docs/adapter-protocol.md).

## 5. Or write it in Go

`pkg/tool` declares a tool and `pkg/tool/adapter` serves it over the adapter protocol:

```go
package main

import (
	"github.com/openctemio/sdk-go/pkg/tool"
	"github.com/openctemio/sdk-go/pkg/tool/adapter"
)

var Dotenv = tool.Define("dotenv", "1.0.0").
	Describe("Finds .env files a web server serves").
	Implements("vuln.templates@1").
	Targets("http_service").
	Produces("finding:misconfiguration").
	Params(
		tool.StringParam("path").Label("Path").Default("/.env").Pattern("^/").MaxLength(256),
	).
	Handle(func(ctx tool.Context, job *tool.Job, emit tool.Emit) error {
		for _, t := range job.Targets() {
			// probe t, then report what you found:
			_ = emit.Misconfiguration(t, tool.Issue{RuleID: "dotenv-exposed", Title: ".env is readable", Severity: "high"})
			ctx.TargetDone(t)
		}
		return nil
	}).
	MustBuild()

func main() { adapter.Serve(Dotenv) }
```

`ctx.HTTP()` is an HTTP client that reaches only what the descriptor's network permission allows
and never cloud metadata endpoints; `ctx.Secret(name)` returns a declared credential. `pkg/testkit`
runs a tool in-process with the runtime's rules and compares its output with golden CTIS.
`openctem tool init --kind go` writes the skeleton; run `make build` before testing it.

## 6. Test it

```bash
cd acme-ports
openctem tool validate .                       # strict schema, taxonomy and mapping; JSON-pointer errors
openctem tool run "$PWD" --target 192.0.2.10@ip_address --format table   # one offline run
openctem tool test --update .                  # record fixtures/expect.ctis.json from a real run; review it
openctem tool test --capability --scope --fuzz 30s .
```

Pass the tool directory to `run` as an absolute path (`"$PWD"`): a relative path makes the
runtime look for `bin/...` relative to the task's working directory.

Nothing talks to a platform: every task runs through the sensor runtime's own host and sandbox, so
the tool behaves as it will on a sensor.

| Check | Proves |
|---|---|
| Manifest, Handshake, Validate, StdoutIsProtocol, ExitsOnEOF, Cancel | an adapter speaks protocol v1 and describes itself exactly as its `tool.yaml` (adapters only) |
| Fixtures | each self-test task produces exactly its expected CTIS |
| Lint | warns about missing `implements`, missing fixtures, no engine version probe, a rate param with no rate key, deprecated keys |
| FixtureContract | every fixture meets the required output of each implemented capability |
| `--capability` | runs a suite per capability on local fixtures (for example, `scan.ports@1`: two open ports and one closed must produce exactly the open ones; `secrets.code@1`: the raw secret never appears in the report or logs) |
| `--scope` | the tool gets target A while address B listens nearby; any connection to B fails |
| `--fuzz 30s` | fuzzes the output parser; a panic, a non-deterministic result or a size-cap breach fails |

Passing the kit at a capability's major version is what being certified for it means. The
scaffold's CI workflow runs `validate`, `test --capability --scope --fuzz 30s` and `diff` on every
change. The stub scaffold passes `openctem tool test` as written, and fails `make conformance`
until it finds something real.

Before releasing a new version, compare descriptors:

```bash
openctem tool diff old/tool.yaml tool.yaml
```

`diff` fails when the change needs a larger version bump than you made (narrowing what the tool
takes or emits, raising the tier or adding a required config key needs a new major version).
`openctem tool describe --json .` prints the canonical descriptor and its digest, which is what
the platform sees.

## 7. Install it on a sensor

Copy the tool directory into a directory listed in the sensor's `SENSOR_ADAPTER_DIRS` (a
`:`-separated list), for example `/etc/openctem/tools/acme-ports/`:

```bash
SENSOR_ADAPTER_DIRS=/etc/openctem/tools
```

- The directory and its files must be owned by root or the sensor user, not writable by others,
  and not symbolic links.
- On start, the sensor loads the descriptor strictly and reports it to the platform by digest. The
  platform keeps descriptors per organization; one organization's tools are never visible to
  another.
- An operator-installed tool is **unverified**. It runs only on a sandbox backend that enforces
  its network class, at tier T2, and can be used in draft workflows and single checks.
- **Platform-operated sensors** load only `builtin` and `certified` tools.

Classification of a third-party tool by an organization administrator (trust level
`tenant-verified`) is **Planned**.

See [Tools and capabilities](../scanning/tools.md) for how tools are enabled and chosen in scan
workflows, and [Sensors](../sensors/index.md) for deploying sensors.

## What the runtime guarantees

| Concern | Handled by |
|---|---|
| Only admitted, in-scope targets reach the tool | the sensor runtime, checked again by the platform |
| Network class, sandbox, resource limits, timeouts | the sensor runtime |
| Your `rate_param` capped by the sensor's local policy | the sensor runtime |
| Standard params mapped to your keys; unsupported values refused before start | the sensor runtime |
| Output validated as CTIS and against `produces` and the capability; size caps; secret masking; provenance stamp (tool, versions, descriptor digest, capability) | the sensor runtime, and again on the platform |
| Tier and trust | the platform, never the tool |
{% endraw %}
