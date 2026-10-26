---
title: Settings reference
parent: Sensors
nav_order: 7.5
---

# Sensor settings reference

Every environment variable the sensor reads, from the sensor's settings
registry (the SDK settings in
[sdk-go `docs/SETTINGS.md`](https://github.com/openctemio/sdk-go/blob/main/docs/SETTINGS.md)
plus the sensor's own). The **Setup & health** section of a sensor shows, for
each one, whether it is set and valid, never its value; a secret is only ever
reported as present or absent. A `SENSOR_*` variable that is not listed here is
reported as unknown (often a typo).

Most sensors need only `SENSOR_API_URL` and `SENSOR_ALLOWED_RANGES`, plus
`SENSOR_CA_CERT_FILE` when the platform uses its own CA (see the
[quickstart](index.md#quickstart-a-working-sensor-in-five-minutes)). Common
settings with examples are in [Deploy with Docker](deploy-docker.md#common-settings);
proxies in [Network](network.md#proxies); the transport in
[Transport](transport.md#settings).

No mode or tool settings are needed: the sensor runs as the daemon that takes
platform commands and enables every tool it detects. A tool's scan options
(rate, concurrency, timeouts) are not environment variables: set them per
sensor in the console, see [Tool settings](tool-settings.md). The
`SENSOR_NUCLEI_MAX_*` variables below are the host operator's ceilings over
those settings; unset, they are nuclei's own defaults (150 requests per
second, 25 templates and 25 hosts in parallel).

Every sensor setting is `SENSOR_`-prefixed. A sensor refuses to start while a
removed name is set, and its error names the replacement:

| Removed | Use instead |
|---------|-------------|
| `API_URL` | `SENSOR_API_URL` |
| `API_KEY` | `SENSOR_API_KEY` |
| `REGION` | `SENSOR_REGION` |
| `PLATFORM_KEY_AUTORENEW` | `SENSOR_KEY_AUTORENEW` |
| `AGENT_ID`, `AGENT_NAME` | `SENSOR_ID`, `SENSOR_NAME` |
| `AGENT_ALLOW_PRIVATE_TARGETS`, `OPENCTEM_SDK_ALLOW_PRIVATE_TARGETS` | `SENSOR_ALLOW_PRIVATE_TARGETS` |
| `OPENCTEM_HTTPSEC_ALLOW_PRIVATE` | `OPENCTEM_SDK_HTTPSEC_ALLOW_PRIVATE` |

| Setting | Type | Required | Default | Secret | Description |
|---|---|---|---|---|---|
| <span id="SENSOR_API_URL"></span>`SENSOR_API_URL` | url | yes |  |  | The platform's API URL (not the web UI origin). |
| <span id="SENSOR_API_KEY"></span>`SENSOR_API_KEY` | string |  |  | yes | The sensor's bearer API key (legacy). Unset: the sensor pairs on first start and signs its requests with its own key (see [Pairing](pairing.md)). |
| <span id="SENSOR_ID"></span>`SENSOR_ID` | string |  |  |  | The sensor's id, when the key is not bound to one. |
| <span id="SENSOR_NAME"></span>`SENSOR_NAME` | string |  | `sensor-&lt;hostname&gt;` |  | The sensor's name on the platform. |
| <span id="SENSOR_PROTOCOL"></span>`SENSOR_PROTOCOL` | enum |  | `auto` |  | Sensor protocol (v2; v1 is retired and refused). |
| <span id="SENSOR_TRANSPORT"></span>`SENSOR_TRANSPORT` | enum |  | `auto` |  | Transport of sensor protocol v3 for a paired (key-bound) sensor: auto tries gRPC over mutual TLS, then HTTPS on a network that blocks it, then protocol v2; grpc, https and v2 force one. |
| <span id="SENSOR_KEY_BIND"></span>`SENSOR_KEY_BIND` | enum |  | `auto` |  | A sensor started with an API key replaces it with a signing key it makes itself when the platform offers it (one way: the API key is retired); off keeps the API key. |
| <span id="SENSOR_CA_CERT_FILE"></span>`SENSOR_CA_CERT_FILE` | path |  |  |  | PEM file with the platform's private CA (or a TLS-inspecting proxy's CA). |
| <span id="SENSOR_CA_FINGERPRINT"></span>`SENSOR_CA_FINGERPRINT` | string |  |  |  | SHA-256 fingerprint of the platform's CA certificate (from the install snippet); pins platform TLS to it. SENSOR_API_URL must then use a host name, not an IP address. |
| <span id="SENSOR_PAIRING_CODE"></span>`SENSOR_PAIRING_CODE` | string |  |  | yes | Pairing code an administrator created with "expect a sensor" (XXXX-XXXX); the sensor attaches to it on its first start. Ignored once the sensor has an identity. |
| <span id="SENSOR_INSTANCE_ENROLLMENT_TOKEN"></span>`SENSOR_INSTANCE_ENROLLMENT_TOKEN` | string |  |  | yes | Single-use token (`octe_...`) a super administrator issued for a shared sensor; the sensor pairs with its own key and is enrolled as a shared sensor of the instance without a further approval. Ignored once the sensor has an identity; never printed. See [Shared sensors](shared-sensors.md). |
| <span id="SENSOR_INSTANCE_ENROLLMENT_TOKEN_FILE"></span>`SENSOR_INSTANCE_ENROLLMENT_TOKEN_FILE` | path |  |  |  | File holding the instance enrollment token, read once at start (not group- or world-writable). Use it instead of `SENSOR_INSTANCE_ENROLLMENT_TOKEN` to keep the token out of the environment; setting both stops the sensor. |
| <span id="SENSOR_ENROLLMENT_TOKEN"></span>`SENSOR_ENROLLMENT_TOKEN` | string |  |  | yes | Organization enrollment token (`octe_...`) created under **Sensors > Enrollment tokens**: a sensor with no identity joins that organization with it, at trust level New, with the token's zones, profile and labels. Cannot be combined with `SENSOR_PAIRING_CODE` or `SENSOR_INSTANCE_ENROLLMENT_TOKEN`. Ignored once the sensor has an identity; never printed. |
| <span id="SENSOR_ENROLLMENT_TOKEN_FILE"></span>`SENSOR_ENROLLMENT_TOKEN_FILE` | path |  |  |  | File holding the organization enrollment token, read once at start (not group- or world-writable). Use it instead of `SENSOR_ENROLLMENT_TOKEN` to keep the token out of the environment; setting both stops the sensor. |
| <span id="SENSOR_PLATFORM_KEY"></span>`SENSOR_PLATFORM_KEY` | string |  |  |  | Thumbprint of the platform's pairing key (from the install snippet); pairing refuses another key. |
| <span id="SSL_CERT_FILE"></span>`SSL_CERT_FILE` | path |  |  |  | System trust store file override (read by the Go runtime and the scanners). |
| <span id="SSL_CERT_DIR"></span>`SSL_CERT_DIR` | path |  |  |  | System trust store directory override. |
| <span id="SENSOR_STATE_DIR"></span>`SENSOR_STATE_DIR` | path |  | `/var/lib/openctem/state` |  | Local state: the paired identity and signing key (identity/), the renewed API key and the tool cost history. Mount a persistent volume. |
| <span id="SENSOR_KEY_AUTORENEW"></span>`SENSOR_KEY_AUTORENEW` | bool |  | `auto` |  | API key auto-renewal: true, false, or unset (on when the state directory persists). |
| <span id="SENSOR_MAX_JOBS"></span>`SENSOR_MAX_JOBS` | int |  |  |  | Cap on concurrent jobs, 1-100. Unset: the slots follow CPU, memory and tool costs. |
| <span id="SENSOR_JOB_ID"></span>`SENSOR_JOB_ID` | string |  |  |  | Run the one platform command with this id and exit (or `-job`; a Kubernetes Job, see [Kubernetes](deploy-kubernetes.md)). It is not in the settings registry, so **Setup & health** lists it as unknown (`config.env_unknown`); that warning is harmless here. |
| <span id="SENSOR_DRAIN_GRACE"></span>`SENSOR_DRAIN_GRACE` | duration |  | `30s` |  | How long running jobs may finish on shutdown. |
| <span id="SENSOR_SCANNER_PRIORITY"></span>`SENSOR_SCANNER_PRIORITY` | enum |  | `low` |  | Priority of scanner processes. |
| <span id="SENSOR_PROTECT_FROM_OOM"></span>`SENSOR_PROTECT_FROM_OOM` | bool |  | `false` |  | Protect the sensor itself from the OOM killer (needs CAP_SYS_RESOURCE). |
| <span id="SENSOR_TOOLS"></span>`SENSOR_TOOLS` | list |  |  |  | Deprecated: narrows the installed tools to this comma-separated list (built-ins such as the reachability probe are kept). Unset: every installed tool. Narrow with the local policy's tools.allow instead. |
| <span id="SENSOR_ADAPTER_DIRS"></span>`SENSOR_ADAPTER_DIRS` | string |  |  |  | Directories of operator-installed tools (tool.yaml with its program), separated by the OS path list separator. |
| <span id="SENSOR_TEMPLATE_SIGNING_KEYS"></span>`SENSOR_TEMPLATE_SIGNING_KEYS` | list |  |  |  | The platform's template-signing public keys (base64 Ed25519); needed for custom templates. |
| <span id="SENSOR_JOB_SIGNING_KEYS"></span>`SENSOR_JOB_SIGNING_KEYS` | list |  |  |  | The platform job signer's keys (`SHA256:&lt;hex&gt;` key ids or base64 Ed25519 keys), in addition to those pinned at pairing; every signed job is verified with them before it runs. Needs a sensor release with signed-job verification. |
| <span id="SENSOR_JOB_SIGNING_KEYS_FILE"></span>`SENSOR_JOB_SIGNING_KEYS_FILE` | path |  |  |  | File holding the job signer's keys (same form as `SENSOR_JOB_SIGNING_KEYS`; not group- or world-writable). A pin read from a file is exclusive: the keys and root pinned from the platform at pairing are not trusted next to it. Setting both the variable and the file stops the sensor. |
| <span id="SENSOR_JOB_SIGNING_ROOT"></span>`SENSOR_JOB_SIGNING_ROOT` | string |  |  |  | The installation's offline job-signing root (`SHA256:&lt;hex&gt;` key id or base64 Ed25519 key); signed jobs are accepted from the keys of its current key set. Overrides the root pinned at pairing. Needs a sensor release with key-set verification. |
| <span id="SENSOR_JOB_SIGNING_ROOT_FILE"></span>`SENSOR_JOB_SIGNING_ROOT_FILE` | path |  |  |  | File holding the offline job-signing root (same form as `SENSOR_JOB_SIGNING_ROOT`; not group- or world-writable). A pin read from a file is exclusive, as for `SENSOR_JOB_SIGNING_KEYS_FILE`. Setting both the variable and the file stops the sensor. |
| <span id="SENSOR_REQUIRE_SIGNED_JOBS"></span>`SENSOR_REQUIRE_SIGNED_JOBS` | bool |  | `auto` |  | true: refuse every job without a valid signature from a pinned job signer; false: run unsigned jobs (signed ones are still verified). Unset: true for a sensor that pinned the signer's keys or root at pairing, false otherwise. |
| <span id="SENSOR_DANGEROUS_ALLOW_UNSIGNED_JOBS"></span>`SENSOR_DANGEROUS_ALLOW_UNSIGNED_JOBS` | bool |  |  |  | Development only: accept unsigned jobs although job-signing keys or a root are pinned; logs a warning at start and for every unsigned job. |
| <span id="SENSOR_LOCAL_POLICY"></span>`SENSOR_LOCAL_POLICY` | path |  | `/etc/openctem/sensor-policy.yaml` |  | The sensor-local policy file the network owner installs. |
| <span id="SENSOR_REQUIRE_LOCAL_POLICY"></span>`SENSOR_REQUIRE_LOCAL_POLICY` | bool |  | `auto` |  | true: without a local policy, refuse every job with network targets, custom templates and callbacks; false: legacy behavior. Unset: true for a sensor paired by an SDK that fails closed, false for older identities and API-key sensors. |
| <span id="SENSOR_ALLOWED_RANGES"></span>`SENSOR_ALLOWED_RANGES` | list |  |  |  | Shorthand local policy: allowed target ranges. |
| <span id="SENSOR_ALLOWED_PORTS"></span>`SENSOR_ALLOWED_PORTS` | list |  |  |  | Shorthand local policy: allowed ports. |
| <span id="SENSOR_KILL_SWITCH_FILE"></span>`SENSOR_KILL_SWITCH_FILE` | path |  |  |  | A file whose presence stops every job. |
| <span id="SENSOR_ALLOW_PRIVATE_TARGETS"></span>`SENSOR_ALLOW_PRIVATE_TARGETS` | enum |  |  |  | 1 allows private (RFC 1918 / ULA) targets; the local policy must allow them too. |
| <span id="OPENCTEM_SDK_SCAN_ROOTS"></span>`OPENCTEM_SDK_SCAN_ROOTS` | list |  |  |  | Directories code scans may read. |
| <span id="SENSOR_CONTROL_PROXY"></span>`SENSOR_CONTROL_PROXY` | url |  |  | yes | Proxy for platform requests (may carry credentials: presence only). |
| <span id="SENSOR_CONTENT_PROXY"></span>`SENSOR_CONTENT_PROXY` | url |  |  | yes | Proxy for content downloads (may carry credentials: presence only). |
| <span id="SENSOR_SCAN_PROXY"></span>`SENSOR_SCAN_PROXY` | url |  |  | yes | Scanner proxy: direct, inherit, or a proxy URL (may carry credentials: presence only). |
| <span id="OPENCTEM_SDK_SCANNER_PROXY"></span>`OPENCTEM_SDK_SCANNER_PROXY` | url |  |  | yes | SDK name of the scanner proxy setting. |
| <span id="SENSOR_SCAN_EGRESS"></span>`SENSOR_SCAN_EGRESS` | enum |  | `platform` |  | Organization proxy pools for scan traffic: platform accepts the pool a job carries (its tools' connections go through it, never direct); direct-only refuses every pooled job (egress_refused_by_host) and does not report egress.upstream@1. See [Proxies for scans](proxies.md#controls-on-the-sensor-host). |
| <span id="SENSOR_SCAN_EGRESS_ALLOW"></span>`SENSOR_SCAN_EGRESS_ALLOW` | list |  |  |  | Comma list of host:port (or host, any port) proxy endpoints this sensor accepts in a job's pool; a job naming another endpoint is refused (egress_refused_by_host). Empty: any endpoint that passes validation. |
| <span id="HTTPS_PROXY"></span>`HTTPS_PROXY` | url |  |  | yes | Environment proxy (may carry credentials: presence only). |
| <span id="HTTP_PROXY"></span>`HTTP_PROXY` | url |  |  | yes | Environment proxy (may carry credentials: presence only). |
| <span id="NO_PROXY"></span>`NO_PROXY` | list |  |  |  | Hosts the environment proxy is not used for. |
| <span id="OPENCTEM_SDK_SCANNER_ENV_ALLOW"></span>`OPENCTEM_SDK_SCANNER_ENV_ALLOW` | list |  |  |  | Extra environment variables scanners inherit. |
| <span id="OPENCTEM_SDK_SCANNER_INHERIT_ENV"></span>`OPENCTEM_SDK_SCANNER_INHERIT_ENV` | bool |  |  |  | 1 lets scanners inherit the whole environment (not recommended). |
| <span id="OPENCTEM_SDK_HTTPSEC_ALLOW_PRIVATE"></span>`OPENCTEM_SDK_HTTPSEC_ALLOW_PRIVATE` | bool |  |  |  | Lets SDK HTTP clients reach private addresses. |
| <span id="OPENCTEM_SDK_HTTPSEC_ALLOW_LOOPBACK"></span>`OPENCTEM_SDK_HTTPSEC_ALLOW_LOOPBACK` | bool |  |  |  | Lets SDK HTTP clients reach loopback addresses. |
| <span id="SENSOR_ALLOW_INSECURE_HTTP"></span>`SENSOR_ALLOW_INSECURE_HTTP` | bool |  |  |  | Development only: allow a plain-http platform URL to a host that is not loopback (refused otherwise: the API key and jobs would cross the network in clear text). |
| <span id="SENSOR_NETWORK_SITE"></span>`SENSOR_NETWORK_SITE` | string |  |  |  | Site label of this host (1 to 64 of A-Z a-z 0-9 . _ -), sent in the network report; the platform only suggests a network from it. Needs a sensor release with the network report. |
| <span id="SENSOR_NETWORK_REACH"></span>`SENSOR_NETWORK_REACH` | list |  |  |  | CIDRs this host routes to beyond its own links (VPN, peering), sent in the network report as a hint; never wider than the local policy. Needs a sensor release with the network report. |
| <span id="SENSOR_NETWORK_DNS_SUFFIXES"></span>`SENSOR_NETWORK_DNS_SUFFIXES` | list |  |  |  | DNS suffixes this host resolves with its internal view (split-horizon names). Needs a sensor release with the network report. |
| <span id="SENSOR_INTERNET"></span>`SENSOR_INTERNET` | enum |  | `auto` |  | How this host reaches the internet: auto (detected), direct, proxy, or none (internet targets go to other sensors). Needs a sensor release with the network report. |
| <span id="SENSOR_NETWORK_REPORT"></span>`SENSOR_NETWORK_REPORT` | enum |  | `summary` |  | How much the network report says: summary (private prefixes listed, public ones counted), full, or off (only a fingerprint and the internet mode). Needs a sensor release with the network report. |
| <span id="SENSOR_SANDBOX"></span>`SENSOR_SANDBOX` | enum |  | `auto` |  | How every tool run is confined: auto (what the host supports), required (refuse to start without every control), off. |
| <span id="SENSOR_SANDBOX_NETWORK"></span>`SENSOR_SANDBOX_NETWORK` | enum |  | `auto` |  | Network confinement of tool runs: each task in its own network namespace whose only way out is its forwarder (needs user namespaces: a container seccomp profile that allows them). auto (where available), required (refuse to start without it; shared sensors), off. |
| <span id="SENSOR_SHARED_MODE"></span>`SENSOR_SHARED_MODE` | enum |  | `0` |  | 1 for a sensor that runs jobs of many tenants: the tool sandbox, network confinement and a local policy are required (refuse to start without them), no writable state is shared between jobs, and a private target needs the private-range switch and the job's zone. Needs a sensor release with shared mode. |
| <span id="SENSOR_OUTBOX"></span>`SENSOR_OUTBOX` | enum |  |  |  | The durable results outbox (on for a daemon). |
| <span id="SENSOR_OUTBOX_DIR"></span>`SENSOR_OUTBOX_DIR` | path |  |  |  | Outbox directory. Mount a persistent volume. |
| <span id="SENSOR_OUTBOX_MAX_BYTES"></span>`SENSOR_OUTBOX_MAX_BYTES` | bytes |  | `1GiB` |  | Outbox size limit. |
| <span id="SENSOR_OUTBOX_MAX_AGE"></span>`SENSOR_OUTBOX_MAX_AGE` | duration |  | `168h` |  | Outbox age limit. |
| <span id="SENSOR_OUTBOX_KEY_FILE"></span>`SENSOR_OUTBOX_KEY_FILE` | path |  |  |  | Outbox encryption key file (default &lt;outbox dir&gt;/outbox.key). |
| <span id="SENSOR_STORE_DIR"></span>`SENSOR_STORE_DIR` | path |  |  |  | Directory of the encrypted local store (sealed outbox items, job journal, policy cache). Default: store/ next to the outbox directory; mount a persistent volume. |
| <span id="SENSOR_STORE_KEY_FILE"></span>`SENSOR_STORE_KEY_FILE` | path |  |  |  | The local store's master key file (mode 0600), for example a mounted secret kept off the data volume. Default: master.key in the store directory, created on first start. |
| <span id="SENSOR_CONTENT_BUDGET_MB"></span>`SENSOR_CONTENT_BUDGET_MB` | int |  |  |  | Lowers the disk the content packs (wordlists, templates, rules) may use, in MiB (64 to 8192). The platform's pack budget (default 2 GiB, one budget shared with the rest of the local store) applies; this setting can only make it smaller. Packs sit in content/ next to the store directory and are fetched again when needed. |
| <span id="SENSOR_WORKSPACE_DIR"></span>`SENSOR_WORKSPACE_DIR` | path |  |  |  | Directory of the per-job workspaces (0700, one directory per job, removed when the job ends and swept at start). Default: workspaces/ next to the outbox directory. |
| <span id="SENSOR_REGION"></span>`SENSOR_REGION` | string |  |  |  | Deployment region reported to the platform. |
| <span id="SENSOR_SCAN_ROOTS"></span>`SENSOR_SCAN_ROOTS` | list |  |  |  | Directories dispatched code scans may read (the scan workspace). |
| <span id="SENSOR_DNS_RESOLVERS"></span>`SENSOR_DNS_RESOLVERS` | list |  |  |  | DNS resolvers for the recon tools (default: the system resolvers). |
| <span id="SENSOR_CONTENT"></span>`SENSOR_CONTENT` | enum |  |  |  | Managed scanner content: on (default) or off. |
| <span id="SENSOR_TOOL_RUNTIME"></span>`SENSOR_TOOL_RUNTIME` | enum |  |  |  | How the tools ported to the tool contract (httpx, nuclei) run: out-of-process (default: the sensor re-executes itself per task in the tool sandbox) or in-process (rollback). |
| <span id="SENSOR_CONTENT_DIR"></span>`SENSOR_CONTENT_DIR` | path |  | `$HOME/.openctem/content` |  | Where managed content is kept: on the data volume (/var/lib/openctem/content in the images); point it elsewhere to keep the cache on other storage. |
| <span id="SENSOR_CONTENT_REFRESH_INTERVAL"></span>`SENSOR_CONTENT_REFRESH_INTERVAL` | duration |  |  |  | How often content is refreshed (10m-720h; default 6h). |
| <span id="SENSOR_CONTENT_KEEP"></span>`SENSOR_CONTENT_KEEP` | int |  |  |  | Previous content versions kept (0-10; default 1). |
| <span id="SENSOR_CONTENT_NUCLEI_TEMPLATES_URL"></span>`SENSOR_CONTENT_NUCLEI_TEMPLATES_URL` | url |  |  |  | nuclei templates archive URL. |
| <span id="SENSOR_CONTENT_NUCLEI_TEMPLATES_CHECKSUMS_URL"></span>`SENSOR_CONTENT_NUCLEI_TEMPLATES_CHECKSUMS_URL` | url |  |  |  | nuclei templates checksums URL. |
| <span id="SENSOR_CONTENT_NUCLEI_TEMPLATES_LATEST_URL"></span>`SENSOR_CONTENT_NUCLEI_TEMPLATES_LATEST_URL` | url |  |  |  | nuclei templates latest-release URL. |
| <span id="SENSOR_CONTENT_NUCLEI_TEMPLATES_VERSION"></span>`SENSOR_CONTENT_NUCLEI_TEMPLATES_VERSION` | string |  |  |  | Pinned nuclei templates version. |
| <span id="SENSOR_CONTENT_NUCLEI_TEMPLATES_SHA256"></span>`SENSOR_CONTENT_NUCLEI_TEMPLATES_SHA256` | string |  |  |  | Expected sha256 of the nuclei templates archive. |
| <span id="SENSOR_CONTENT_NUCLEI_TEMPLATES_DIR"></span>`SENSOR_CONTENT_NUCLEI_TEMPLATES_DIR` | path |  |  |  | Pre-installed nuclei templates directory. |
| <span id="SENSOR_CONTENT_NUCLEI_MIN_TEMPLATES"></span>`SENSOR_CONTENT_NUCLEI_MIN_TEMPLATES` | int |  |  |  | Fewest templates a nuclei templates release may have. |
| <span id="SENSOR_CONTENT_NUCLEI_MAX_TEMPLATE_ERRORS"></span>`SENSOR_CONTENT_NUCLEI_MAX_TEMPLATE_ERRORS` | int |  |  |  | Most templates that may fail to load. |
| <span id="SENSOR_CONTENT_SEMGREP_RULESETS"></span>`SENSOR_CONTENT_SEMGREP_RULESETS` | list |  |  |  | semgrep rulesets to fetch. |
| <span id="SENSOR_CONTENT_SEMGREP_REGISTRY_URL"></span>`SENSOR_CONTENT_SEMGREP_REGISTRY_URL` | url |  |  |  | semgrep registry URL. |
| <span id="SENSOR_CONTENT_SEMGREP_RULES_PATH"></span>`SENSOR_CONTENT_SEMGREP_RULES_PATH` | path |  |  |  | Local semgrep rules. |
| <span id="SENSOR_CONTENT_SAST_RULES_VERSION"></span>`SENSOR_CONTENT_SAST_RULES_VERSION` | string |  |  |  | OpenCTEM rules pack release to install (vX.Y.Z); default the newest. |
| <span id="SENSOR_CONTENT_SAST_RULES_URL"></span>`SENSOR_CONTENT_SAST_RULES_URL` | url |  |  |  | Mirror of the rules pack downloads ({version}, {bare_version}); the signature is still verified. |
| <span id="SENSOR_CONTENT_SEMGREP_SKIP_CHECK"></span>`SENSOR_CONTENT_SEMGREP_SKIP_CHECK` | bool |  |  |  | Skip the semgrep rules check. |
| <span id="SENSOR_CONTENT_TRIVY_DB_REPOSITORY"></span>`SENSOR_CONTENT_TRIVY_DB_REPOSITORY` | string |  |  |  | trivy DB OCI repository. |
| <span id="SENSOR_CONTENT_TRIVY_JAVA_DB"></span>`SENSOR_CONTENT_TRIVY_JAVA_DB` | bool |  |  |  | Also fetch the trivy Java DB. |
| <span id="SENSOR_CONTENT_TRIVY_JAVA_DB_REPOSITORY"></span>`SENSOR_CONTENT_TRIVY_JAVA_DB_REPOSITORY` | string |  |  |  | trivy Java DB OCI repository. |
| <span id="SENSOR_NUCLEI_MAX_RATE_LIMIT"></span>`SENSOR_NUCLEI_MAX_RATE_LIMIT` | int |  |  |  | Cap on nuclei's requests per second. |
| <span id="SENSOR_NUCLEI_MAX_CONCURRENCY"></span>`SENSOR_NUCLEI_MAX_CONCURRENCY` | int |  |  |  | Cap on nuclei's template concurrency. |
| <span id="SENSOR_NUCLEI_MAX_BULK_SIZE"></span>`SENSOR_NUCLEI_MAX_BULK_SIZE` | int |  |  |  | Cap on nuclei's hosts per template. |
| <span id="TRIVY_CACHE_DIR"></span>`TRIVY_CACHE_DIR` | path |  |  |  | trivy cache directory (needs a writable path on a read-only root filesystem). |
| <span id="TRIVY_USERNAME"></span>`TRIVY_USERNAME` | string |  |  |  | Private registry user for trivy image scans. |
| <span id="TRIVY_PASSWORD"></span>`TRIVY_PASSWORD` | string |  |  | yes | Private registry password for trivy image scans. |
