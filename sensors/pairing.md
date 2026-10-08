---
title: Pairing and enrollment
parent: Sensors
nav_order: 4
---

# Pairing and enrollment

Pairing connects a new sensor to your organization without any secret being
copied or pasted. The sensor creates its own Ed25519 key, which never leaves
its host. An administrator approves the sensor after checking that the
sensor's console and the browser show the same fingerprint. From then on the
sensor signs every request with its key (HTTP Message Signatures,
RFC 9421), and the platform stores only the public key.

Design: [RFC-052](https://github.com/openctemio/openctem/blob/develop/api/docs/rfcs/RFC-052-sensor-pairing-and-authorization.md).

## Who can pair

| Step | Permission |
|---|---|
| Enter a code, create an expectation, deny a request | **Pair sensors** (`sensors:pair`) |
| Approve | **Approve sensors** (`sensors:approve`), plus re-authentication: your authenticator code if you enrolled one, otherwise your password |
| Promote to Trusted, widen a grant | **Widen sensor grants** (`sensors:grant:widen`) |

Owners and administrators hold all of them.

## Pair with a code shown by the sensor

1. Install the sensor without `API_KEY` ([Docker](deploy-docker.md),
   [Kubernetes](deploy-kubernetes.md), [binary](deploy-binary.md)) and keep
   its state directory on persistent storage.
2. Start it (or run `openctemio-sensor pair`). It prints a code, a
   fingerprint, when the code expires (10 minutes) and its key:

   ```
   Pair this sensor in OpenCTEM: Sensors > Pair a sensor
     Code:        K7QM-4ZTD
     Fingerprint: 821 · melon · basil · bagel    (expires 10:42)
     Key:         SHA256:...
   Approve it only if the console shows the same fingerprint. Waiting for approval...
   ```

   With Docker, read it with `docker logs <container>`; on Kubernetes with
   `kubectl logs`.
3. In the console open **Discovery > Sensors > Pair a sensor**, tab
   **Enter code**, and type the code.
4. The console shows the fingerprint, the host name, system and sensor
   version the sensor reported, and the address the request came from.
   **Compare the fingerprint word for word.** If anything differs, or the
   address is one you do not expect, deny the request: someone else's sensor,
   or a machine between the sensor and the platform, made it.
5. Choose the name, the type, **What it may do** (the grant profile, below)
   and the scan zones. Tick **The fingerprint shown on the sensor console
   matches the one above**, re-authenticate and **Approve**.

The sensor picks up its identity within a few seconds, confirms it and starts
working. Every administrator of the organization is notified.

## Pair with a code shown by the console

Use this when you prepare the console first:

1. **Discovery > Sensors > Pair a sensor**, tab **Expect a sensor**. The
   console shows a code and the command to run.
2. On the sensor host run:

   ```bash
   openctemio-sensor pair K7QM-4ZTD
   ```

3. The sensor prints its fingerprint; the console shows the fingerprint it
   received as soon as the sensor connects. Compare and approve as above.

## The `pair` command

`openctemio-sensor pair [flags] [CODE]` pairs and exits, for a host prepared
before the daemon runs. The daemon does the same on its first start when it
has neither an API key nor an identity.

| Flag | Environment | Meaning |
|---|---|---|
| `-api-url` | `API_URL` | The platform URL (required) |
| `-state-dir` | `SENSOR_STATE_DIR` | Where the identity is kept (`<dir>/identity`); default `/var/lib/openctem/state` |
| `-name` | `SENSOR_NAME` | The name to propose |
| `-ca-fingerprint` | `SENSOR_CA_FINGERPRINT` | SHA-256 of the platform's CA. With it, `API_URL` must name the platform by the host name in its certificate, not an IP address |
| `-platform-key` | `SENSOR_PLATFORM_KEY` | Thumbprint of the platform's pairing key; a pairing signed by another key is refused |
| `-repair` | | Replace this sensor's key (see below) |

`SENSOR_CA_FINGERPRINT` and `SENSOR_PLATFORM_KEY` are public values. They stop
a fake platform from answering the sensor's first contact.

## Where the identity lives

The identity is in `<state dir>/identity/` (`signing.key`, `identity.json`):
files with mode `0600` in a `0700` directory, owned by the user the sensor
runs as. The sensor refuses to start when the permissions are looser and
prints the `chmod` or `chown` that fixes it. Losing the directory means
pairing again; anyone who copies it can act as the sensor, so protect and back
it up like a credential.

## Re-pair a sensor

If a sensor's key is lost or may have been stolen, run on its host:

```bash
openctemio-sensor pair -repair
```

The sensor creates a new key and an administrator approves it like a new
pairing. The old key is revoked at once, the sensor keeps its history, and it
returns to trust level **New**. A sensor whose identity directory is gone has
nothing to re-pair: pair it as a new sensor and delete the old one.

## Grants and trust

Every sensor has a **grant**: the job types, zones, tools, highest tier,
target networks, credentials, push ingest and remote actions it may receive.
The platform checks it on every poll, claim and result. A missing or
unreadable grant withholds all work (fail closed).

The approver picks a profile as the starting grant:

| Profile | For |
|---|---|
| Internal network scanner (`internal-network-scanner`, default) | Scans and validation in the chosen zones; no credentials |
| External attack surface (`easm-external`) | Internet-facing targets only; no private addresses, no credentials |
| Authenticated scanner (`authenticated-scanner`) | Like the internal scanner, and may receive scan credentials once Trusted |
| Collector (`collector`, optionally `collector:<integration>`) | Runs one connector; no target scanning |
| CI runner (`ci-runner`) | Code scanning only; no network targets |
| Endpoint (`endpoint-agent`) | Inspects its own host only |

Every new sensor starts at trust level **New**, whether it was paired or
installed with a key:

- it receives **passive (T0) work only**: subdomain discovery, DNS
  resolution, code, dependency and image analysis. Active tools such as
  naabu, httpx, katana and nuclei are not dispatched to it;
- it receives no credentials;
- it cannot send results that are not bound to a job.

Open the sensor, review its **Grant**, narrow it if needed, and choose
**Promote to Trusted** when you are satisfied. The full grant then applies.
Promoting, widening and pairing approvals are audited at high severity and
notify every administrator. Narrowing is always one step.

## Bearer keys (legacy)

Older sensors authenticate with an API key (`octs_…`, older `rda_…`). New
organizations cannot create key-based sensors: pairing is the only way in.
An organization may allow them again by turning off **Require key-bound
sensor identity** in **Settings > Organization > General**; the Sensors page
then also offers **Install sensor**, which creates a sensor and shows its key
once, with ready-made install snippets.

A key-based sensor keeps a renewed key in its state directory
(`sensor-credentials.json`), so keep that volume too. The bundled sensor of
the Helm chart currently uses a key; see
[Kubernetes](deploy-kubernetes.md#option-a-the-bundled-sensor-of-the-openctem-chart).

## API

| Route | Permission |
|---|---|
| `POST /api/v1/sensor-pairings/lookup` | `sensors:pair` |
| `POST /api/v1/sensor-pairings/expectations`, `GET /api/v1/sensor-pairings/expectations/{id}` | `sensors:pair` |
| `POST /api/v1/sensor-pairings/{id}/approve` | `sensors:approve` |
| `POST /api/v1/sensor-pairings/{id}/reject` | `sensors:pair` |
| `GET` / `PUT /api/v1/sensors/{id}/grant`, `GET /api/v1/sensors/grant-profiles` | `sensors:read` / narrow or widen |
| `GET` / `PUT /api/v1/sensors/identity-policy` | `sensors:read` / narrow or widen |
| `GET /api/v1/sensors/{id}/keys`, `POST /api/v1/sensors/{id}/keys/{key_id}/revoke` | `sensors:read` / `sensors:write` or `sensors:revoke` |

## Troubleshooting

| Symptom | Cause |
|---|---|
| The console says the code is not found | It expired (10 minutes), was used, or was mistyped. Start the pairing again on the sensor. |
| The sensor keeps waiting after you created an expectation | The code typed on the sensor was wrong; run `pair` again with the code from the console. |
| `certificate chain does not contain the pinned CA` | `SENSOR_CA_FINGERPRINT` does not match the CA the platform presents, or a TLS-inspecting proxy sits in between. |
| The sensor stops at start with an identity permission error | Run the `chmod` or `chown` it printed. On Kubernetes see [the fsGroup note](deploy-kubernetes.md#identity-files-and-fsgroup). |
| The container exits during pairing with `connection refused` | The platform was not reachable. The restart policy starts it again; check [Network requirements](network.md). |
| The sensor is online but gets no nuclei or port scans | It is still **New**. Promote it to Trusted. |
