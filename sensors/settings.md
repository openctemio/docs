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

Common settings with examples are in [Deploy with Docker](deploy-docker.md#common-settings);
proxies in [Network](network.md#proxies).

| Setting | Type | Required | Default | Secret | Description |
|---|---|---|---|---|---|
| <span id="API_URL"></span>`API_URL` | url | yes |  |  | The platform's API URL (not the web UI origin). |
| <span id="API_KEY"></span>`API_KEY` | string |  |  | yes | The sensor's bearer API key (legacy). Unset: the sensor pairs on first start and signs its requests with its own key (see [Pairing](pairing.md)). |
| <span id="SENSOR_ID"></span>`SENSOR_ID` | string |  |  |  | The sensor's id, when the key is not bound to one. |
| <span id="SENSOR_NAME"></span>`SENSOR_NAME` | string |  | `sensor-&lt;hostname&gt;` |  | The sensor's name on the platform. |
| <span id="SENSOR_PROTOCOL"></span>`SENSOR_PROTOCOL` | enum |  | `auto` |  | Sensor protocol (v2; v1 is retired and refused). |
| <span id="SENSOR_TRANSPORT"></span>`SENSOR_TRANSPORT` | enum |  | `auto` |  | Transport of sensor protocol v3 for a paired (key-bound) sensor: auto tries gRPC over mutual TLS, then HTTPS on a network that blocks it, then protocol v2; grpc, https and v2 force one. |
| <span id="SENSOR_CA_CERT_FILE"></span>`SENSOR_CA_CERT_FILE` | path |  |  |  | PEM file with the platform's private CA (or a TLS-inspecting proxy's CA). |
| <span id="SENSOR_CA_FINGERPRINT"></span>`SENSOR_CA_FINGERPRINT` | string |  |  |  | SHA-256 fingerprint of the platform's CA certificate (from the install snippet); pins platform TLS to it. API_URL must then use a host name, not an IP address. |
| <span id="SENSOR_PLATFORM_KEY"></span>`SENSOR_PLATFORM_KEY` | string |  |  |  | Thumbprint of the platform's pairing key (from the install snippet); pairing refuses another key. |
| <span id="SSL_CERT_FILE"></span>`SSL_CERT_FILE` | path |  |  |  | System trust store file override (read by the Go runtime and the scanners). |
| <span id="SSL_CERT_DIR"></span>`SSL_CERT_DIR` | path |  |  |  | System trust store directory override. |
| <span id="SENSOR_STATE_DIR"></span>`SENSOR_STATE_DIR` | path |  | `/var/lib/openctem/state` |  | Local state: the paired identity and signing key (identity/), the renewed API key and the tool cost history. Mount a persistent volume. |
| <span id="PLATFORM_KEY_AUTORENEW"></span>`PLATFORM_KEY_AUTORENEW` | bool |  | `auto` |  | API key auto-renewal: true, false, or unset (on when the state directory persists). |
| <span id="SENSOR_MAX_JOBS"></span>`SENSOR_MAX_JOBS` | int |  |  |  | Cap on concurrent jobs, 1-100. Unset: the slots follow CPU, memory and tool costs. |
| <span id="SENSOR_DRAIN_GRACE"></span>`SENSOR_DRAIN_GRACE` | duration |  | `30s` |  | How long running jobs may finish on shutdown. |
| <span id="SENSOR_SCANNER_PRIORITY"></span>`SENSOR_SCANNER_PRIORITY` | enum |  | `low` |  | Priority of scanner processes. |
| <span id="SENSOR_PROTECT_FROM_OOM"></span>`SENSOR_PROTECT_FROM_OOM` | bool |  | `false` |  | Protect the sensor itself from the OOM killer (needs CAP_SYS_RESOURCE). |
| <span id="SENSOR_TOOLS"></span>`SENSOR_TOOLS` | list |  |  |  | Allowlist of tools the sensor runs (comma-separated). Unset: every installed tool. |
| <span id="SENSOR_ADAPTER_DIRS"></span>`SENSOR_ADAPTER_DIRS` | string |  |  |  | Directories of operator-installed tools (tool.yaml with its program), separated by the OS path list separator. |
| <span id="SENSOR_TEMPLATE_SIGNING_KEYS"></span>`SENSOR_TEMPLATE_SIGNING_KEYS` | list |  |  |  | The platform's template-signing public keys (base64 Ed25519); needed for custom templates. |
| <span id="SENSOR_LOCAL_POLICY"></span>`SENSOR_LOCAL_POLICY` | path |  | `/etc/openctem/sensor-policy.yaml` |  | The sensor-local policy file the network owner installs. |
| <span id="SENSOR_REQUIRE_LOCAL_POLICY"></span>`SENSOR_REQUIRE_LOCAL_POLICY` | bool |  | `auto` |  | true: without a local policy, refuse every job with network targets, custom templates and callbacks; false: legacy behavior. Unset: true for a sensor paired by an SDK that fails closed, false for older identities and API-key sensors. |
| <span id="SENSOR_ALLOWED_RANGES"></span>`SENSOR_ALLOWED_RANGES` | list |  |  |  | Shorthand local policy: allowed target ranges. |
| <span id="SENSOR_ALLOWED_PORTS"></span>`SENSOR_ALLOWED_PORTS` | list |  |  |  | Shorthand local policy: allowed ports. |
| <span id="SENSOR_KILL_SWITCH_FILE"></span>`SENSOR_KILL_SWITCH_FILE` | path |  |  |  | A file whose presence stops every job. |
| <span id="SENSOR_ALLOW_PRIVATE_TARGETS"></span>`SENSOR_ALLOW_PRIVATE_TARGETS` | enum |  |  |  | 1 allows private (RFC 1918 / ULA) targets; the local policy must allow them too. |
| <span id="OPENCTEM_SDK_ALLOW_PRIVATE_TARGETS"></span>`OPENCTEM_SDK_ALLOW_PRIVATE_TARGETS` | enum |  |  |  | SDK name of the private-target switch. |
| <span id="OPENCTEM_SDK_SCAN_ROOTS"></span>`OPENCTEM_SDK_SCAN_ROOTS` | list |  |  |  | Directories code scans may read. |
| <span id="SENSOR_CONTROL_PROXY"></span>`SENSOR_CONTROL_PROXY` | url |  |  | yes | Proxy for platform requests (may carry credentials: presence only). |
| <span id="SENSOR_CONTENT_PROXY"></span>`SENSOR_CONTENT_PROXY` | url |  |  | yes | Proxy for content downloads (may carry credentials: presence only). |
| <span id="SENSOR_SCAN_PROXY"></span>`SENSOR_SCAN_PROXY` | url |  |  | yes | Scanner proxy: direct, inherit, or a proxy URL (may carry credentials: presence only). |
| <span id="OPENCTEM_SDK_SCANNER_PROXY"></span>`OPENCTEM_SDK_SCANNER_PROXY` | url |  |  | yes | SDK name of the scanner proxy setting. |
| <span id="HTTPS_PROXY"></span>`HTTPS_PROXY` | url |  |  | yes | Environment proxy (may carry credentials: presence only). |
| <span id="HTTP_PROXY"></span>`HTTP_PROXY` | url |  |  | yes | Environment proxy (may carry credentials: presence only). |
| <span id="NO_PROXY"></span>`NO_PROXY` | list |  |  |  | Hosts the environment proxy is not used for. |
| <span id="OPENCTEM_SDK_SCANNER_ENV_ALLOW"></span>`OPENCTEM_SDK_SCANNER_ENV_ALLOW` | list |  |  |  | Extra environment variables scanners inherit. |
| <span id="OPENCTEM_SDK_SCANNER_INHERIT_ENV"></span>`OPENCTEM_SDK_SCANNER_INHERIT_ENV` | bool |  |  |  | 1 lets scanners inherit the whole environment (not recommended). |
| <span id="OPENCTEM_SDK_HTTPSEC_ALLOW_PRIVATE"></span>`OPENCTEM_SDK_HTTPSEC_ALLOW_PRIVATE` | bool |  |  |  | Lets SDK HTTP clients reach private addresses. |
| <span id="OPENCTEM_SDK_HTTPSEC_ALLOW_LOOPBACK"></span>`OPENCTEM_SDK_HTTPSEC_ALLOW_LOOPBACK` | bool |  |  |  | Lets SDK HTTP clients reach loopback addresses. |
| <span id="SENSOR_SANDBOX"></span>`SENSOR_SANDBOX` | enum |  | `auto` |  | How every tool run is confined: auto (what the host supports), required (refuse to start without every control), off. |
| <span id="SENSOR_SANDBOX_NETWORK"></span>`SENSOR_SANDBOX_NETWORK` | enum |  | `auto` |  | Network confinement of tool runs: each task in its own network namespace whose only way out is its forwarder (needs user namespaces: a container seccomp profile that allows them). auto (where available), required (refuse to start without it; shared sensors), off. |
| <span id="SENSOR_OUTBOX"></span>`SENSOR_OUTBOX` | enum |  |  |  | The durable results outbox (on for a daemon). |
| <span id="SENSOR_OUTBOX_DIR"></span>`SENSOR_OUTBOX_DIR` | path |  |  |  | Outbox directory. Mount a persistent volume. |
| <span id="SENSOR_OUTBOX_MAX_BYTES"></span>`SENSOR_OUTBOX_MAX_BYTES` | bytes |  | `1GiB` |  | Outbox size limit. |
| <span id="SENSOR_OUTBOX_MAX_AGE"></span>`SENSOR_OUTBOX_MAX_AGE` | duration |  | `168h` |  | Outbox age limit. |
| <span id="SENSOR_OUTBOX_KEY_FILE"></span>`SENSOR_OUTBOX_KEY_FILE` | path |  |  |  | Outbox encryption key file (default &lt;outbox dir&gt;/outbox.key). |
| <span id="REGION"></span>`REGION` | string |  |  |  | Deployment region reported to the platform. |
| <span id="SENSOR_SCAN_ROOTS"></span>`SENSOR_SCAN_ROOTS` | list |  |  |  | Directories dispatched code scans may read (the scan workspace). |
| <span id="SENSOR_DNS_RESOLVERS"></span>`SENSOR_DNS_RESOLVERS` | list |  |  |  | DNS resolvers for the recon tools (default: the system resolvers). |
| <span id="SENSOR_CONTENT"></span>`SENSOR_CONTENT` | enum |  |  |  | Managed scanner content: on (default) or off. |
| <span id="SENSOR_TOOL_RUNTIME"></span>`SENSOR_TOOL_RUNTIME` | enum |  |  |  | How the tools ported to the tool contract (httpx, nuclei) run: out-of-process (default: the sensor re-executes itself per task in the tool sandbox) or in-process (rollback). |
| <span id="SENSOR_CONTENT_DIR"></span>`SENSOR_CONTENT_DIR` | path |  | `$HOME/.openctem/content` |  | Where managed content is kept. Mount a persistent volume (the templates use /var/lib/openctem/content). |
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
| <span id="SENSOR_TENABLE_SC_CONFIG"></span>`SENSOR_TENABLE_SC_CONFIG` | path |  |  |  | Tenable.sc connector configuration file. |
| <span id="TENABLE_SC_URL"></span>`TENABLE_SC_URL` | url |  |  |  | Tenable.sc URL (shorthand configuration). |
| <span id="TENABLE_SC_CA_FILE"></span>`TENABLE_SC_CA_FILE` | path |  |  |  | Tenable.sc private CA file. |
| <span id="TENABLE_SC_REPOSITORIES"></span>`TENABLE_SC_REPOSITORIES` | list |  |  |  | Tenable.sc repositories to pull. |
| <span id="TENABLE_SC_OPERATIONS"></span>`TENABLE_SC_OPERATIONS` | list |  |  |  | Tenable.sc operations allowed. |
| <span id="TENABLE_SC_ACCESS_KEY"></span>`TENABLE_SC_ACCESS_KEY` | string |  |  | yes | Tenable.sc API access key. |
| <span id="TENABLE_SC_SECRET_KEY"></span>`TENABLE_SC_SECRET_KEY` | string |  |  | yes | Tenable.sc API secret key. |
| <span id="TENABLE_SC_ACCESS_KEY_FILE"></span>`TENABLE_SC_ACCESS_KEY_FILE` | path |  |  |  | File holding the Tenable.sc access key. |
| <span id="TENABLE_SC_SECRET_KEY_FILE"></span>`TENABLE_SC_SECRET_KEY_FILE` | path |  |  |  | File holding the Tenable.sc secret key. |
