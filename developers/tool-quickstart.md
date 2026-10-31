---
title: Tool quickstart
parent: Developers
nav_order: 10
---

# Tool quickstart

A tool is a program a sensor runs. The contract is the same for a vendor's tool, a tenant's and ours: a `tool.yaml`
manifest that says what the tool is, and a `Run` function that does one task. You can have a Go tool running against a
local target in about 15 minutes, with no platform.

The complete walk-through, with a runnable example that is tested in CI, is
[docs/tool-quickstart.md](https://github.com/openctemio/sdk-go/blob/main/docs/tool-quickstart.md) in the SDK
repository. This page is the short version and where each step is documented here.

## The short version

```bash
go install github.com/openctemio/sdk-go/cmd/openctem@{{ site.data.versions.sdk_go }}
openctem tool init --kind go --capability vuln.templates@1 --name hello-tool hello-tool
cd hello-tool
go get github.com/openctemio/sdk-go@{{ site.data.versions.sdk_go }}
make build                                      # edit tool.yaml and main.go first
openctem tool run . --target http://127.0.0.1:8000/@http_service --format table
openctem tool test .                            # protocol checks and your fixtures
openctem tool build . --push registry.example.com/acme/hello-tool:0.1.0
```

| Step | What you do | Reference |
|---|---|---|
| Manifest | Name, version, capabilities served, parameters with types, consumed and produced types, tier, network | [Writing a tool](tool-authoring.md) |
| Code | Two methods, `Manifest` and `Run`, built by `tool.New` from the manifest and one typed function | [Writing a tool, in Go](tool-authoring.md#6-or-write-it-in-go) |
| Run and test | `openctem tool run` and `test`, the conformance harness and a fake platform in `go test` | [Build your first tool](build-your-first-tool.md#6-run-it-on-your-laptop) |
| Results | Findings and assets through the emitter, checked as they are emitted | [Writing a tool](tool-authoring.md) |
| Egress and scope | The tool runs confined: targets come signed from the platform, the sensor checks them again against its local policy, and the only network is the sensor's forwarder | [What the runtime guarantees](tool-authoring.md#what-the-runtime-guarantees) |
| Package | A pack image signed by digest, or a static binary with a checksum | [Build your first tool](build-your-first-tool.md#8-install-it-on-a-sensor) |
| Install and approve | The tool joins your catalog when a sensor reports it; an administrator grants the sensor the tier it needs | [How the tool reaches your organization](tool-authoring.md#how-the-tool-reaches-your-organization) |

## Versions and compatibility

A tool declares the adapter protocol range it speaks and the oldest SDK it needs. The platform owns compatibility: it
reads what each sensor reports and decides what can run where. Sensor, SDK and tool releases are independent, and a
new sensor or SDK release never requires a platform change.
