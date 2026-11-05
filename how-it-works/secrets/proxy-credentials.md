---
title: Proxy credentials
parent: Secrets flows
grand_parent: How it works
nav_order: 1
description: How the user names and passwords of your scan proxies are stored and how a sensor gets them for one job.
---

# Proxy credentials
{: .no_toc }

An administrator pastes the organization's scan proxies, with their logins,
in **Settings > Scanning > Proxies**. The platform stores each login
encrypted. When one of your sensors runs a job through a pool, it asks the
platform for that pool's logins while it holds the job, keeps them in memory,
and uses them only in its own forwarder.

{: .note }
> Secret delivery to sensors is being redesigned. This page describes what the
> current platform release (v0.20.2) does. Sensor v0.38.0 and later fetch pool
> credentials only through the redesigned delivery, which no platform release
> serves yet: such a sensor refuses a job whose pool needs credentials. Use
> sensor v0.37.2 with credentialed pools until your platform serves it.

1. TOC
{:toc}

## The flow

### Saving a login

```mermaid
sequenceDiagram
    autonumber
    actor A as Administrator
    box Platform
    participant C as Console
    participant P as Platform API
    participant DB as Database
    end
    A->>C: Proxies, Add proxies, paste scheme://user:password@host:port
    C->>P: save the pool's endpoints
    P->>P: check the permission to change proxies
    alt encryption key not configured
        P-->>C: refused, logins cannot be stored
    else key configured
        P->>P: seal the login with the organization and the endpoint, encrypt with AES-256-GCM
        P->>DB: store the sealed login only
        P-->>C: saved, the login now shows as dots
    end
```

1. You paste one proxy per line. A line can carry a user name and a
   password. The console warns when the login would travel to the proxy
   without encryption (plain `http` or `socks5`).
2. The platform seals each login together with the organization and the
   proxy entry it belongs to, then encrypts it with the installation's
   encryption key. Only the sealed value is stored.
3. The console never shows a stored login again. It shows dots. A line that
   keeps the dots keeps the stored login.

### A job that uses the pool

```mermaid
sequenceDiagram
    autonumber
    box Platform
    participant P as Platform API
    end
    box Your network
    participant S as Sensor
    participant F as Per-job forwarder
    participant T as Tool
    end
    S->>P: claim a scan job
    P-->>S: signed job, names the pool and its proxies, no logins
    S->>S: check the signature, check the host allows proxies
    S->>P: ask for the pool's logins, signed, naming the job it holds
    P->>P: sensor belongs to the organization, holds the job now, job running
    P->>P: the pool is the one this sensor uses, open each login
    alt any check fails
        P-->>S: job not found, the same answer for every reason
        S->>S: job refused as proxy unavailable, never run direct
    else checks pass
        P-->>S: user names and passwords, not cached, inside TLS
        S->>F: logins kept in the forwarder's memory
        T->>F: connect to a target
        F->>F: scope check first
        F->>F: connect through a healthy proxy with its login
        S->>P: job report per proxy, errors with logins removed
    end
```

1. The signed job names the pool and its proxies. It does not carry any
   login.
2. The sensor asks for the logins with a signed request that names the job.
   The platform answers only to the sensor that holds that job right now,
   only while the job runs, and only for the pool that sensor uses.
3. The answer is sent over the sensor's TLS connection with "do not cache".
   It is not encrypted a second time for the sensor.
4. The logins stay in the memory of the job's forwarder. Tools never see
   them: they connect to the forwarder, which checks the scope and then uses
   the proxy.
5. Error messages that go back to the platform have the logins removed.

## When something fails

| What happens | What you see | What to do |
|---|---|---|
| The installation has no encryption key | Saving a proxy with a login is refused | Set the encryption key in the platform configuration. |
| A stored login cannot be opened, for example after a wrong key change | The proxy fails with an authentication error and is set aside | Paste the login again, or restore the right key. |
| The sensor cannot get the logins | The job is refused as "proxy unavailable". It never runs without the proxy | Check the sensor is online and holds the job, and that the pool is still assigned. |
| The proxy rejects the login | The proxy's health drops and it is set aside after repeated failures | Correct the login in **Proxies**. |
| The host is set to run scans direct only | Jobs that carry a pool are refused on that sensor | Remove the setting on the host, or assign the sensor no pool. |

## Security

- **At rest.** Logins are encrypted with AES-256-GCM and the installation's
  encryption key. Each sealed value names its organization and proxy entry,
  so a value copied to another row or organization does not open.
- **In transit.** The logins are not in the signed job. They travel inside
  the sensor's TLS connection to the platform. A device that inspects TLS on
  the sensor's path to the platform could read them.
- **Organization isolation.** The sensor's organization comes from its own
  signed identity, never from the request. Shared sensors never receive an
  organization's proxy logins.
- **Audit.** Creating a pool, changing logins, testing and setting a proxy
  aside are audited. No login is ever written to the audit log or the job.

## Related

- [Proxies for scans](../../sensors/proxies.md)
- [Egress check on every connection](../sensor-execution/egress.md)
- [Network requirements and egress](../../sensors/network.md)
