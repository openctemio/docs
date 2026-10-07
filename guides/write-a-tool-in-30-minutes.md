---
layout: default
title: Write a Tool in 30 Minutes
parent: Platform Guides
nav_order: 10
---

# Write a Tool in 30 Minutes

This guide wraps an existing command-line scanner as an OpenCTEM tool. You
write no Go code: a descriptor (`tool.yaml`) and, when the scanner prints
JSON, a mapping file. A sensor then runs your tool like a built-in one, and
the platform can place it in any workflow step that asks for the capability
it implements.

The contract is the OpenCTEM Tool Contract v1 (RFC-055). You need:

- the `openctem` CLI: `go install github.com/openctemio/sdk-go/cmd/openctem@latest`
- the scanner you want to wrap, on your `PATH`
- 30 minutes

---

## 1. Pick a capability (2 minutes)

A **capability** is an act, such as "scan ports" or "find secrets in code".
Your tool implements one or more capabilities. You do not invent them: they
come from a closed taxonomy. The capability, not your tool, decides:

- the phase and the CTEM stage;
- the minimum tier (how intrusive the act is);
- which target types it takes and which output types it may emit;
- its standard parameters;
- the CTIS fields every report must carry.

| If your scanner... | Implement |
|---|---|
| lists subdomains of a domain | `discover.subdomains@1` |
| resolves names | `resolve.dns@1` |
| finds open TCP ports | `scan.ports@1` |
| probes web services | `probe.http@1` |
| crawls a site | `crawl.web@1` |
| runs vulnerability checks or templates | `vuln.templates@1` |
| analyzes source code | `sast.code@1` |
| finds secrets in a repository | `secrets.code@1` |
| checks dependencies | `sca.deps@1` |
| checks infrastructure-as-code | `iac.misconfig@1` |
| checks container images | `container.image@1` |

The full list, with the required output of each capability, is in
[docs/capabilities.md of the ctis repository](https://github.com/openctemio/ctis/blob/main/docs/capabilities.md).

---

## 2. Scaffold (3 minutes)

Choose the kind that matches what your scanner prints:

| Scanner output | Kind |
|---|---|
| SARIF | `exec-sarif` |
| CTIS, or one CTIS record per line | `exec-ctis` |
| any JSON or JSON Lines | `exec-json` (with a mapping file) |
| a format OpenCTEM already reads (nuclei, semgrep, trivy, grype, CycloneDX, SPDX, OSV, ...) | `exec-json`, then set `run.output.format` to that name |
| you need logic (per-target status, credentials, HTTP calls) | `go` or `python` |

```bash
openctem tool init --kind exec-json --capability scan.ports@1 --name acme-ports acme-ports
cd acme-ports
```

`init` never overwrites a file. It writes:

| File | What it is |
|---|---|
| `tool.yaml` | the descriptor, pre-filled from the capability |
| `mapping.yaml` | a mapping stub (`exec-json` only) |
| `fixtures/task.json`, `fixtures/expect.ctis.json` | one self-test |
| `Makefile` | `validate`, `test`, `conformance` |
| `.github/workflows/openctem-tool.yml` | CI for your tool |

---

## 3. Edit the descriptor (8 minutes)

Open `tool.yaml`. The fields you normally change:

```yaml
apiVersion: openctem.io/tool/v1
name: acme-ports
version: 1.0.0
description: Fast TCP connect port scanner.
class: target-scan
tier: T1                         # a request: never below the capability's floor
implements:
  - capability: scan.ports@1
    params:                      # the capability's standard params -> your config keys
      ports: {key: ports}
      top_n: {key: top_ports}
      rate:  {key: rate, max: 5000}
    output_shape: open_port_assets
consumes: [domain, subdomain, ip_address]
produces: [asset:open_port]
input: {batch: list, max_targets: 5000}
config:
  type: object
  additionalProperties: false
  properties:
    ports:     {type: string, pattern: "^[0-9,-]+$", maxLength: 2048}
    top_ports: {type: integer, minimum: 1, maximum: 65535, default: 100}
    rate:      {type: integer, minimum: 1, maximum: 5000, default: 1000}
permissions: {network: targets, proxy: honors}
safety: {rate_param: rate}
run:
  profile: exec
  argv: [acme-scan, -list, "{{task.targets_file}}", -json, -rate, "{{config.rate}}", -top-ports, "{{config.top_ports}}"]
  output: {format: jsonl, from: stdout, mapping: mapping.yaml}
```

Rules that keep your tool safe and portable:

- **`argv` is never a shell.** Placeholders are a closed set: `{{config.<key>}}`, `{{target.value|host|port|url}}`, `{{task.targets_file|targets_json|config_file|output|workdir}}`. The runtime refuses a substituted value that starts with `-` or contains control characters.
- **Secrets are never config.** Declare them under `permissions.credentials`. The sensor operator stores them, and the tool receives them only in the run message.
- **`params` is the bridge to workflows.** A standard param you do not map is one your tool does not take. A workflow step that sets it will not pick your tool, and the param is never silently dropped. `values`, `min` and `max` narrow what you support.
- **Declare side effects.** If the scanner can change the target (`safety.side_effects`), it must be tier T2.

---

## 4. Write the mapping (10 minutes)

Skip this step for SARIF, CTIS and the named formats.

Suppose the scanner prints one line per open port:

```json
{"ip":"192.0.2.10","port":443,"protocol":"TCP","host":"a.example"}
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

The mapping language is closed on purpose. It has:

- **paths:** `/a/b`, `/list/0`;
- **values:** `const`, and `template` (named vars only);
- **transforms:** `default`, `lower`, `upper`, `trim`, `as` (integer, boolean, string), `map` (an enum table), `join`, `split`, `max_bytes`, `first`;
- **predicates:** `exists`, `equals`, `in`, `matches` (RE2, length-capped).

There is no code, no jq and no template engine. Lines that match no rule are skipped. For a single JSON document, set `source: json` and point `each:` at the result list.

The mapping file is part of your contract. The sensor records its digest when it loads the tool and refuses to run with a file that changed afterwards.

---

## 5. Test (5 minutes)

```bash
openctem tool validate          # strict schema, taxonomy, mapping; errors with JSON pointers
openctem tool run --target 192.0.2.10@ip_address --format table   # one offline run through the real runtime
openctem tool test --update     # record fixtures/expect.ctis.json from a real run, then review it
openctem tool test --capability --scope --fuzz 30s
```

`test` runs the conformance kit:

- **Protocol and fixtures:** your self-tests produce exactly the expected CTIS.
- **Contract:** the output contains only what the capability allows, and every required field is present.
- **Capability suites** (`--capability`): loopback fixtures for `scan.ports`, `probe.http`, `vuln.templates`, `secrets.code`, `sast.code` and `sca.deps`. For example, two open ports and one closed port must produce exactly the open ones. A raw secret must never appear anywhere in the report.
- **Scope check** (`--scope`): the tool gets target A while address B listens nearby. Any connection to B fails the test.
- **Fuzz** (`--fuzz`): your mapping or parser is fuzzed with your fixtures as seeds. A crash, a non-deterministic result or a size-cap breach fails the test.

Before releasing a new version, compare descriptors:

```bash
openctem tool diff old/tool.yaml tool.yaml
```

`diff` fails when the change needs a bigger version bump than you made. For example, narrowing what the tool takes or emits, raising the tier, or adding a required config key needs a new major version.

---

## 6. Install on a sensor (2 minutes)

Copy the tool directory into an adapter directory of the sensor. The sensor operator chooses the directory, for example `/etc/openctem/tools/acme-ports/`. Then set it in the sensor configuration:

```bash
SENSOR_ADAPTER_DIRS=/etc/openctem/tools
```

The directory must not be writable by others and must not contain symlinks. On start, the sensor:

1. loads the descriptor strictly;
2. reports it to the platform by digest, with `origin: adapter`.

A tool the operator installed is **unverified** until classified. It runs only:

- on a sandbox backend that enforces its network class;
- at tier T2.

---

## 7. Trust and classification

Platform-operated sensors load only built-in and certified tools.

The platform keeps the descriptor your sensor reports per tenant, and assigns the tier and trust level itself. A tool's own `tier` is only a request.

Tenant administrators will be able to classify a third-party tool's tier, never below its capability's floor. That classification is being added (RFC-055, platform step OC3). Until it ships, an operator-installed tool stays **unverified**: it runs only on enforcing sandboxes, at tier T2.

---

## What the SDK does for you

| Concern | Who handles it |
|---|---|
| Scope: only admitted targets reach the tool | sensor runtime, re-checked by the platform |
| Network class, sandbox, resource limits | sensor runtime |
| Rate: your `rate_param` is capped by the sensor's local policy | sensor runtime |
| Standard params mapped to your keys, unsupported values refused | sensor runtime |
| Output validation, size caps, secret masking, provenance stamp | sensor runtime, again on the platform |
| Tier and trust | the platform, never the tool |

## Next steps

- [Custom Tools Development](custom-tools-development.md): Go tools with `tool.Define(...).Implements("vuln.templates@1")`, and the adapter protocol for other languages.
- The CLI reference: `docs/tools/cli.md` in the sdk-go repository.
