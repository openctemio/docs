---
title: Install with Ansible
parent: Install
nav_order: 9
has_children: true
---

# Install on one VM with Ansible
{: .no_toc }

The [openctem-ansible](https://github.com/openctemio/openctem-ansible) kit installs
and operates OpenCTEM on **one Ubuntu VM**. It hardens the host, deploys the
platform from signed release images pinned by digest, and adds encrypted daily
backups with a tested restore and a host monitor. Every stage is opt-in and can be
rehearsed with `--check --diff` before it changes anything.

This page holds what both deployment paths share: the VM, the controller, the
inventory, the stages, backups, upgrades and the security checklist. Then pick
one path:

- [Deploy with Cloudflare Tunnel and Access](ansible-cloudflare.md): no inbound port
  on the VM at all; Cloudflare terminates TLS and authenticates people.
- [Deploy without Cloudflare](ansible-without-cloudflare.md): a public host with
  automatic Let's Encrypt certificates on port 443, or a private network with an
  internal certificate authority.

Other ways to install (Docker Compose from the release checkout, the all-in-one
image, Helm) are described in [Install](index.md). The guides here describe the kit
as of OpenCTEM v0.11.0, but the kit's `versions.yml` pins images by digest per release,
and its newest entry is **v0.10.1**. Until the kit adds a v0.11.0 entry (a `git pull` of
the kit; check `versions.yml`), `openctem_version: v0.10.1` is the newest value it
accepts, and the guides below use it. The settings that v0.11.0 adds
([audit sink](#hosted-service-the-administrators-audit-sink)) work in the kit already.

1. TOC
{:toc}

---

## What you get, and what you do not

| The kit does | The kit does not |
|---|---|
| Hardens Ubuntu (kernel and login settings, unattended security updates, time sync, audit rules, journald limits), SSH (keys only) and the firewall (deny inbound except SSH from your admin networks). | Install sensors. They run elsewhere and connect to the platform's public URL ([Sensors](../sensors/index.md)). |
| Installs Docker Engine from Docker's repository, pinned and held. | Run a high-availability pair. It is one VM with one API instance ([Scaling](../operations/scaling.md)). |
| Verifies every OpenCTEM image against the release workflow's signature before it pulls it. | Configure your DNS zone, your identity provider or, in the Cloudflare path, Cloudflare itself. Those are dashboard steps you do. |
| Generates every secret on the VM; deploys the stack; runs the one-shot database jobs and migrations before the API starts. | Reverse database migrations on rollback (see [Rollback](#rollback)). |
| Backs up daily (encrypted with your age key), runs restore drills, monitors the host. | Replace host-level backups of the VM or an intrusion detection system. |

How the two paths differ:

| | With Cloudflare | Without Cloudflare |
|---|---|---|
| Inbound ports on the VM | none except SSH from your admin networks | 443/tcp (and optionally 80/tcp) from the networks that use OpenCTEM, plus SSH |
| TLS | terminated by Cloudflare; the hop to the VM is the outbound tunnel | terminated on the VM by a reverse proxy you install (Caddy in the guide), with a public ACME certificate or a private CA |
| People sign in | Cloudflare Access (your identity provider, MFA) in front of OpenCTEM's own sign-in | OpenCTEM's own sign-in (password with TOTP, or your SSO); you restrict who can reach it by network |
| Sensors and CI | Access Bypass on exact paths, plus a WAF rate limit | straight to the proxy; protect with firewall rules and rate limits you set |
| Platform console | its own host name with its own Access application | its own host name, restricted to your staff's networks or a VPN |
| Good fit | no public IP, or you want zero inbound exposure | you have a public IP and run your own perimeter, or the install is private |

## Prerequisites

**The VM.** 4 vCPU, 8 GB RAM (about 7 GB usable) and 80 GB of disk, running
**Ubuntu 26.04 LTS**, freshly installed, with SSH key access for a user that has
sudo, and a way to reach the VM's console from your hypervisor or cloud provider (you
need it if an SSH or firewall change goes wrong). Ubuntu 24.04 works for every stage
except the pinned Docker packages. The default memory limits are sized for this host:
PostgreSQL 2 GB, API 1.5 GB, web console 768 MB, platform console 512 MB, Redis
512 MB, gateway 256 MB and the tunnel connector 256 MB, about 5.5 GB for containers,
leaving about 1.5 GB to the system. A bigger host raises the `openctem_mem_*` and
`openctem_pg_*` values in your inventory; see [Sizing](sizing.md) for how load grows.

**Outbound access from the VM.** `ghcr.io` (images),
`download.docker.com`, the Ubuntu archive, the sigstore services (signature checks),
and whatever the API calls for feeds, CI OIDC keys, mail and the integrations you
configure ([Network](index.md#network)). With Cloudflare, also Cloudflare's edge on
7844/tcp and 7844/udp. Without it, Let's Encrypt (`acme-v02.api.letsencrypt.org`)
when you use a public certificate.

**The controller.** The machine you run Ansible from: Linux or macOS, Python 3.11 to
3.13, `ansible-core` 2.18, `git`, `ssh` and `curl`. It can be your workstation or an
admin box. It must not be the VM you are installing: Ansible connects to the VM over
SSH, so a controller on the VM would be changing the machine under its own feet
(a firewall or SSH change would cut your own session).

**An age key pair for backups**, created on your workstation and kept off the VM
(see [Backups](#backups-and-the-restore-drill)).

**DNS and, per path, accounts.** One public name for the platform (for example
`ctem.example.com`), and for the recommended platform console setup a second one
(`admin.example.com`). The Cloudflare path needs a Cloudflare zone and a Zero Trust
account connected to your identity provider; the other path needs control of the DNS
records and, for a public certificate, a public IP address.

## Set up the controller

Run these on the controller, not the VM.

```bash
git clone https://github.com/openctemio/openctem-ansible.git
cd openctem-ansible
python3 -m venv .venv
. .venv/bin/activate
pip install 'ansible-core>=2.18,<2.19'
ansible-galaxy collection install -r requirements.yml -p ./collections
```

Run every `ansible-playbook` command from this directory: `ansible.cfg` there finds
the roles and the pinned collections.

**No `python3-venv` and no sudo on the controller** (a common state of a minimal
Ubuntu server): create the environment without pip and install pip's work into it
from outside:

```bash
python3 -m venv --without-pip .venv
pip3 install --python .venv/bin/python 'ansible-core>=2.18,<2.19'
.venv/bin/ansible-galaxy collection install -r requirements.yml -p ./collections
```

Then call `.venv/bin/ansible-playbook` instead of activating the environment.

**Keep your site data outside the repository.** Copy the example inventory to a
directory of your own and edit it there. Nothing in it is a secret (the kit
generates secrets on the VM), but it is your site's data and does not belong in a
clone you update with `git pull`.

```bash
mkdir -p ~/.config/openctem-ansible
cp -r inventories/example ~/.config/openctem-ansible/inventory
mv ~/.config/openctem-ansible/inventory/group_vars/all.yml.example \
   ~/.config/openctem-ansible/inventory/group_vars/all.yml
$EDITOR ~/.config/openctem-ansible/inventory/hosts.ini
$EDITOR ~/.config/openctem-ansible/inventory/group_vars/all.yml
INV=~/.config/openctem-ansible/inventory/hosts.ini
```

{: .warning }
`-i` must name the **file** `hosts.ini`, as in `INV` above. Pointing it at the
inventory directory makes Ansible report `No inventory was parsed`. The `group_vars/`
directory beside the file is still read.

`hosts.ini` names the VM and the user Ansible logs in as:

```ini
[openctem]
vm1 ansible_host=203.0.113.10 ansible_user=ubuntu
```

On Ubuntu 26.04 add `ansible_python_interpreter=/usr/bin/python3.14`, and if
privilege escalation fails because the default `sudo` is `sudo-rs`, add
`ansible_become_exe=/usr/bin/sudo.ws`.

Check that the controller reaches the VM with your key (no sudo needed yet):

```bash
ansible -i $INV openctem -m ping
```

**What `-K` does.** `-K` (`--ask-become-pass`) makes Ansible ask once for the
**sudo password of the SSH user on the VM**, shown as `BECOME password:`. It is kept
in the memory of the Ansible process only; it is never written to a file or log.
Leave `-K` out if that user has passwordless sudo. Every command below that changes
the VM uses it.

## The inventory

The settings you will normally touch are in `group_vars/all.yml`. All of them have
defaults in the roles (`roles/*/defaults/main.yml`); the full list with comments is
there.

| Variable | Default | Meaning |
|---|---|---|
| `openctem_app_host` | none, required | The one public host name of the console, the API, sensors and CI. DNS name only. |
| `openctem_version` | none, required | The release to deploy. Must be a key of `openctem_releases` in `versions.yml` (v0.10.1, v0.9.7, v0.9.6 at the time of writing). |
| `openctem_ingress` | `cloudflared` | `cloudflared`: Cloudflare Tunnel. `loopback`: the gateway listens on `127.0.0.1:openctem_loopback_port` for a TLS proxy you run on the VM. |
| `openctem_loopback_port` | `8080` | Loopback ingress only: the port the gateway publishes on 127.0.0.1. |
| `admin_cidrs` | none | IPv4 networks that may reach SSH. The firewall stage refuses to run when your controller is outside them. |
| `openctem_admin_site` | `port` | Where the platform console is served: `host` (its own host name), `port` (a second port, loopback ingress only) or `off`. |
| `openctem_admin_host` | empty | The console's own host name (host mode). Must differ from `openctem_app_host`. |
| `openctem_admin_allowed_cidrs` | private networks | Client networks the gateway admits to the console. See each path for what "client" means. |
| `openctem_admin_port`, `openctem_admin_bind` | `8443`, empty | Port mode: the console port and the address it is published on (empty is `127.0.0.1`; never a public address). |
| `openctem_signup_mode` | `disabled` | `disabled`, `domain` or `open` ([Sign-up and invitations](../identity/sign-up-and-invitations.md)). `open` also needs the platform e-mail and, on the internet, Turnstile keys. |
| `openctem_api_env` | `{}` | Extra non-secret API settings, for example `ASSET_COVERAGE_DAILY_BUDGET`. The role refuses names it manages itself and secret-looking names. |
| `openctem_job_signer` | `false` | Sign sensor jobs; the key is created on the VM. |
| `openctem_captcha_turnstile_site_key` | empty | Public Turnstile site key for `openctem_signup_mode: open`; the secret goes in `/opt/openctem/secrets/captcha_turnstile_secret` on the VM. |
| `openctem_admin_audit_sink` | empty | Off-database copy of the platform administrators' audit log: empty (off), `file` or an `https://` URL. Sets the API's `ADMIN_AUDIT_SINK`. Required for a hosted service ([below](#hosted-service-the-administrators-audit-sink)). |
| `openctem_admin_audit_sink_head_interval` | empty (API default, 15 minutes) | How often the signed chain head is sent, for example `5m`. Only with a sink. |
| `openctem_admin_audit_sink_dir` | `/opt/openctem/admin-audit` | `file` mode: the host directory that holds `admin-audit.jsonl`. |
| `openctem_wal_archive`, `backup_wal_bucket`, `backup_wal_prefix`, `backup_wal_remote_conf`, `backup_wal_retention_days` | `false`, empty, project name, `/opt/openctem/secrets/backup_remote.conf`, `14` | Continuous archiving to an S3-compatible bucket and point-in-time restore ([below](#continuous-archiving-and-point-in-time-restore)). |
| `openctem_egress_policy`, `openctem_egress_allow` | `restricted` with `open` sign-up, else `open`; empty | Outbound policy of the API container ([below](#outbound-firewall-of-the-stacks-containers)). |
| `backup_age_recipient` | empty | Your age public key. Empty is local mode: plaintext, on the VM only. |
| `backup_offsite_command` | empty | A command that copies a finished backup directory (`$1`) off the VM. Needs `backup_age_recipient`. |
| `backup_keep_days` | `14` | Local retention. |
| `monitoring_webhook_url` | empty | Where alerts are posted. A webhook URL is a credential: set `vault_monitoring_webhook_url` in an `ansible-vault` encrypted `group_vars/vault.yml`. |
| `monitoring_external_probes` | `true` | The monitor's probes through Cloudflare (tunnel path, Access, edge certificate). Set `false` without Cloudflare. |
| `cloudflared_management` | `remote` | Cloudflare path: `remote` (route set in the dashboard) or `local` (route file written by the role). |
| `openctem_mem_*`, `openctem_pg_*`, `openctem_cpus_*` | sized for 4 vCPU / 7 GB | Container limits and PostgreSQL settings for a bigger or smaller host. |
| `os_baseline_unattended_reboot` | `false` | Reboot automatically after security updates (at `os_baseline_unattended_reboot_time`). |

The stages are switched on by flags, in the inventory or with `-e` for one run:
`apply_os`, `apply_ssh`, `apply_docker`, `apply_firewall`, `apply_openctem`,
`apply_backup`, `apply_monitoring`. Without its flag a stage prints that it was
skipped and changes nothing.

## The stages

| Playbook | Flag | What it changes on the VM |
|---|---|---|
| `00-preflight.yml` | none (read-only) | Nothing. Reports OS, sudo, CPU, RAM, disk, the tunnel token's owner and mode (metadata only), Docker, listeners, ufw, time sync and the effective SSH settings. |
| `10-os.yml` | `apply_os` | DevSec OS hardening (IPv4 forwarding stays on for Docker), unattended security updates, chrony, auditd rules for identities, sudoers, SSH, Docker and the secrets directory, and a persistent journal capped at 1 GB and one month. |
| `20-ssh.yml` | `apply_ssh`, `ssh_stage` | Stage 1: SSH hardening and fail2ban, passwords still allowed. Stage 2 (`-e ssh_stage=2`): proves a key-only login from the controller, then turns passwords off. |
| `30-docker.yml` | `apply_docker`, `docker_daemon_restart` | Docker Engine and the compose plugin from Docker's repository (key checked by hash and fingerprint, versions pinned and held), `daemon.json` with log rotation, `live-restore` and `userland-proxy: false`. Nobody is added to the `docker` group. |
| `35-firewall.yml` | `apply_firewall` | ufw: deny inbound, allow outbound, allow SSH only from `admin_cidrs`. Refuses to run when the controller is outside them. |
| `50-openctem.yml` | `apply_openctem` | `/opt/openctem`: the compose file, the gateway files, generated secrets, the stack, the tunnel connector (Cloudflare path). Also upgrades and the pre-upgrade backup. |
| `55-backup.yml` | `apply_backup`, `backup_run_now` | `openctem-backup` (daily timer), `openctem-restore-drill`, `openctem-restore`. |
| `60-monitoring.yml` | `apply_monitoring` | `openctem-monitor` (timer, every five minutes). |
| `71-rollback.yml` | `apply_rollback` | Restores the compose file that ran before the last deploy. |
| `80-audit.yml`, `85-exposure-audit.yml` | none (read-only) | The general audit, and a check that no container publishes a port beyond loopback. |

`site.yml` runs them all in this order, each gated by its flag.

## The apply cycle

Use the same cycle for the first install and for every later change.

1. **Preflight.** `ansible-playbook -i $INV playbooks/00-preflight.yml -K`. At the end
   read the `PLAY RECAP`: `failed=0` and `unreachable=0`. Fix a warning about memory,
   disk or the OS before going on.
2. **Snapshot.** Take a hypervisor snapshot of the VM and keep its console open
   for the SSH and firewall stages. A snapshot is a change checkpoint, not a backup:
   delete it once the change is accepted.
3. **Rehearse** with `--check --diff`. Nothing is applied; Ansible prints what it would
   change.

   ```bash
   ansible-playbook -i $INV playbooks/50-openctem.yml -K --check --diff -e apply_openctem=true
   ```

   What to look for in the diff: the new image digests; the settings you meant to
   change (`OPENCTEM_ADMIN_HOST`, the ingress rules); and, above all, **nothing else**.
   Stop and do not apply if you see a volume removed, a database password changed or a
   port published beyond `127.0.0.1`. Some tasks are reported as skipped in check mode
   (pulls, migrations, backups, anything that needs a package a previous stage
   installs): that is normal. Run the stages in order so each stage's check sees the
   state the previous one left.
4. **Apply** one stage at a time, in the order of the table above, reading each
   `PLAY RECAP` (`failed=0`).
5. **Verify** with `sudo openctem-verify` on the VM and the acceptance tests of your
   path.

Keep the log of each run (`ANSIBLE_LOG_PATH=~/openctem-apply-$(date +%F).log`): the
tasks that touch secrets use `no_log`, so the log holds no secret.

## First administrator

A new installation has no account. Create the first platform administrator and a
break-glass administrator **on the VM, in an interactive SSH session or at its
console**. The one-time credentials are printed once, to that terminal. The wrapper
refuses to run without a terminal, so they can never end up in an Ansible log:

```bash
sudo openctem-bootstrap-admin -email=admin@example.com -backup-email=breakglass@example.com
```

Optionally create the first organization and its owner in the same call
(`-org-name="Example Security" -org-owner-email=owner@example.com`). The options are
those of [First administrator](first-admin.md); the wrapper runs the tool in the `api`
container of the kit's project. Platform administrators sign in on the console's own
address, not on `/login` (the tool's closing text says otherwise). Sign in to the platform console with the
printed temporary password, change it and enroll an authenticator app (the console
requires one). Store the break-glass credentials offline, and sign in with them once to
prove they work. Then configure the platform e-mail (Settings, E-mail) so invitations can
be sent.

## Backups and the restore drill

`openctem-backup` runs daily (03:15 UTC, `backup_on_calendar`) and on demand
(`sudo systemctl start openctem-backup`). A backup is a directory under
`/var/backups/openctem/<UTC time>/` (root only) with the database dump, the uploaded
files, the job signer's key when it is on, the generated secrets (without
them the dump cannot decrypt the stored integration credentials), and the deployment
files, with checksums. The Cloudflare tunnel token is not included: re-issue it in
the dashboard.

| `backup_age_recipient` | Mode |
|---|---|
| empty | **Local**: plaintext, root-only, on this VM. An off-host copy is refused. Not a real backup: a lost disk loses it. |
| `age1...` | **Encrypted**: every file is encrypted on the VM to your public key; the plaintext staging copy is deleted. Off-host copy is allowed. |

Create the key on your workstation, never on the VM, and keep the identity file offline
(a password manager, a hardware token, a safe):

```bash
age-keygen -o ~/openctem-backup-identity.txt
age-keygen -y ~/openctem-backup-identity.txt     # prints age1...: the value for backup_age_recipient
```

**Without the identity file the backups cannot be restored.** Keep two copies in
different places. Set `backup_offsite_command` so each backup also leaves the VM, for
example `rclone copy --config /root/.config/rclone/rclone.conf "$1" offsite:openctem/$(basename "$1")`,
with the remote's credentials in a root-only file.

```bash
ansible-playbook -i $INV playbooks/55-backup.yml -K -e apply_backup=true -e backup_run_now=true
```

**Restore drill, at least monthly.** It restores a backup into a throwaway
PostgreSQL with no network and compares row counts with the running database. It does
not touch the stack.

```bash
# on the VM; encrypted mode: put the identity on the VM only for the drill
sudo openctem-restore-drill /var/backups/openctem/<UTC time> /root/drill.key
sudo rm -f /root/drill.key
```

**Full restore** over the running stack stops the tunnel connector, gateway, web console,
platform console and API, replaces
the database and the files, re-applies the database roles, starts the stack and verifies:

```bash
sudo openctem-restore /var/backups/openctem/<UTC time> [/root/drill.key] --yes
```

On a **new VM**, deploy the release named in the backup's `VERSION` file first, then add
`--with-secrets` so the generated secrets (and with them the encryption key) match the
data, and re-run `playbooks/50-openctem.yml` to reset file owners. The restore
procedure in general is described in [Backup and restore](../operations/backup-restore.md).

## Continuous archiving and point-in-time restore

The nightly backup loses up to a day. With `openctem_wal_archive: true` the database also
ships every finished WAL segment, encrypted to your age key, to an S3-compatible bucket you
provide, plus a weekly base backup. A host loss then costs about six minutes of data, and a
bad change can be undone with `sudo openctem-restore --pitr "<UTC time>" <identity file>
--yes`. It is off by default, needs a dedicated bucket key in a root-only file on the VM
(`backup_wal_remote_conf`, never in the inventory), the same `backup_age_recipient` as the
nightly backups, and one brief PostgreSQL restart when it is first switched on. The monitor
alerts when the archive lags by more than 15 minutes. The kit's
[BACKUP-PITR guide](https://github.com/openctemio/openctem-ansible/blob/main/docs/BACKUP-PITR.md)
has the exact order of the three plays, the recovery steps, the monthly drill
(`openctem-restore-drill --pitr latest`) and key rotation. Point-in-time recovery covers
the database only; uploaded files and secrets come from the nightly backup. For the general
procedure see [Backup and restore](../operations/backup-restore.md).

## Hosted service: the administrators' audit sink

The platform console keeps a hash-chained audit log of what platform administrators do. The
sink writes a copy outside the database, so a database-level rewrite shows up as a
disagreement. A **hosted multi-tenant service** (`MANAGED_SERVICE: "true"` in
`openctem_api_env`) must have one: from v0.11.0 the API refuses to start in production with
`MANAGED_SERVICE=true` and no `ADMIN_AUDIT_SINK`. The kit's preflight stops first: a release
flagged `admin_audit_sink_required` in `versions.yml` fails `50-openctem.yml` before the host
is touched when the inventory sets `MANAGED_SERVICE` without `openctem_admin_audit_sink`.
(The flag is set on the kit's release entries after v0.10.1.) A self-managed install needs
none of this.

```yaml
openctem_api_env:
  MANAGED_SERVICE: "true"
openctem_admin_audit_sink: https://audit.example.com/ingest   # or: file
```

- **`https://host/path`**: the API posts each batch, signed with an HMAC key, to a receiver
  you run. Create the key on the VM first, at least 32 bytes and mode 0600 or 0400, and give
  the same key to the receiver; the kit never puts it in the inventory:

  ```bash
  sudo sh -c 'umask 077; openssl rand -hex 32 > /opt/openctem/secrets/admin_audit_sink_secret'
  ```

  This is the real off-box copy when a different party or host runs the receiver. With
  `openctem_egress_policy: restricted`, a receiver on a private address needs an
  `openctem_egress_allow` entry.
- **`file`**: the kit creates `openctem_admin_audit_sink_dir`, mounts it into the API and
  appends `admin-audit.jsonl` there. It protects against rewrites inside the database and
  travels with the nightly backup (`admin-audit.tar.gz`), but anyone with root on the VM can
  edit both, so it is not an off-box copy while the backups stay on the VM.
- `syslog+tls://` is supported by the API but not by this kit yet; the checks refuse it.

Do not set `ADMIN_AUDIT_SINK*` through `openctem_api_env`; the kit refuses it.
`openctem_admin_audit_sink_head_interval` changes how often the signed chain head is sent.

## Outbound firewall of the stack's containers

Only the API container (network `egress_api`) and the tunnel connector can reach the
internet; the other containers sit on internal networks. `openctem_egress_policy: restricted`
adds a network-layer second guard for the API: its outbound networks cannot reach the
private ranges (`10/8`, `172.16/12`, `192.168/16`), link-local and cloud metadata
(`169.254/16`), loopback, `100.64/10` or the host itself, in case a tenant-supplied webhook
or identity-provider URL slipped past the application's SSRF guard. The default is
`restricted` with `openctem_signup_mode: open` and `open` otherwise. Approve an internal
destination (an SMTP relay, Jira) with one entry per host and port:

```yaml
openctem_egress_allow:
  - { cidr: 192.0.2.25/32, port: 587 }
```

`35-firewall.yml` installs the rules (`sudo openctem-egress status` shows them); rerun it
after changing a resolver or the list. It needs Docker's iptables backend. The kit's
[FIREWALL guide](https://github.com/openctemio/openctem-ansible/blob/main/docs/FIREWALL.md)
has the networks, the acceptance matrix and the caveat that a port a container publishes
bypasses ufw (the stack publishes nothing beyond loopback).

## Monitoring

`playbooks/60-monitoring.yml` installs `openctem-monitor`, run by a systemd timer every
five minutes. It checks container health and routing (`openctem-verify`), disk use, the
age of the last backup and, when `monitoring_external_probes` is on, the Cloudflare
path. Alerts go to the journal (`journalctl -t openctem-monitor`) and to
`monitoring_webhook_url`. After installing it, prove the webhook:
`sudo systemctl start openctem-monitor` with a deliberately failing check, or point the
webhook at a test channel first. For the platform's own metrics and alert rules, see
[Monitoring](../operations/monitoring.md).

## Upgrade

The releases a kit version can run are listed in `versions.yml`. To move to a new
release:

1. **Update the kit** on the controller: `git pull` to a version that lists the release,
   then reinstall the collections if `requirements.yml` changed. Read the kit's README
   section for the release and the platform's release notes.
2. **Check the settings** the release adds or removes. Upgrading to v0.10.x needs one
   decision from you, covered next. Upgrading to v0.11.0 adds the audit sink rule for a
   hosted service ([above](#hosted-service-the-administrators-audit-sink)); its migrations
   only add objects, and the kit's `db-roles` and `db-grants` jobs give the console's new
   `admin_approvals` table its grants on the same run, so there is no separate role script.
3. **Rehearse** (`--check --diff`, see [The apply cycle](#the-apply-cycle)) and apply:

   ```bash
   ansible-playbook -i $INV playbooks/50-openctem.yml -K -e apply_openctem=true -e openctem_version=v0.10.1
   ```

   then set `openctem_version` in your inventory so later runs keep it.

The play verifies the new images' signatures, runs a **backup first and stops if it
fails**, keeps the running compose file as `compose.prev.yml`, pulls and starts the
release (migrations run as one-shot jobs before the API starts), runs `openctem-verify`
and, if anything fails, restores `compose.prev.yml` and verifies the previous release
again. Expect a few minutes of downtime while images are pulled and migrations run.

**Upgrading from v0.9.x to v0.10.x.** v0.10 requires `FINGERPRINT_KEY`, which keys the
fingerprint of every stored secret finding. The kit manages it on the VM in
`/opt/openctem/secrets/fingerprint_key`. On an **existing install** the first apply
copies the current encryption key into it, because that is the key the existing
fingerprints were made with; a fresh random value would give every known secret a new
identity and reopen it as a new finding. A new install gets its own random key. You do
nothing, but verify afterwards, without printing either file:

```bash
sudo stat -c '%a %U %s' /opt/openctem/secrets/fingerprint_key     # 400 root 65 (or more)
sudo cmp /opt/openctem/secrets/fingerprint_key /opt/openctem/secrets/app_encryption_key   # silent on an upgraded install
```

Also remove `openctem_tenant_creation_mode` from your inventory if it is set (use
`openctem_signup_mode`; the play stops while the old variable exists) and do not pass
removed settings through `openctem_api_env`. v0.10.1 ships the platform console as its own
service: decide where it is served ([`openctem_admin_site`](#the-inventory)) before the
upgrade. Sensors keep working during and after the upgrade.

## Rollback

Automatic rollback happens inside the upgrade play. For a problem you find later:

```bash
ansible-playbook -i $INV playbooks/71-rollback.yml -K -e apply_rollback=true
```

This starts the previous release from `compose.prev.yml` **without its migration job**.
Migrations are not reversed: an older migration job refuses a database a newer release
already migrated, and an older API runs on the newer schema (the kit tests that). If the
previous release misbehaves on the migrated database, restore the backup the upgrade took
(`openctem-restore`) while the previous release runs. Rolling back from v0.10.1 to v0.9.7
leaves the platform console unavailable for the time being, which is what v0.9.7 had.

## Security checklist

- [ ] The controller is not the VM; the sudo password was typed with `-K` and not stored.
- [ ] Snapshot taken before each stage and deleted after acceptance.
- [ ] `sshd -T` shows `passwordauthentication no` and `permitrootlogin no` (SSH stage 2 applied).
- [ ] ufw is active; only the ports of your path are open; `85-exposure-audit.yml` passes.
- [ ] Nobody is in the `docker` group.
- [ ] `sudo openctem-verify` passes after every deploy.
- [ ] Secrets exist only on the VM (`/opt/openctem/secrets`, 0400, root), never in the inventory, a chat or a ticket. Only a webhook URL is in an `ansible-vault` file.
- [ ] `openctem_verify_signatures` is still `true`. If the signature step fails, investigate; do not disable it.
- [ ] Backups run in encrypted mode with an off-host copy; the age identity is offline in two places; a restore drill passed this month.
- [ ] First platform administrator has TOTP; the break-glass administrator is stored offline and was tested; there are at least two administrators.
- [ ] `openctem_signup_mode` is `disabled` unless you run a hosted service; the platform e-mail is configured.
- [ ] The platform console is on its own host name, reachable only by your administrators (see your path).
- [ ] Monitoring timer active and the webhook tested.
- [ ] Calendar: monthly restore drill, upgrades each release, yearly rotation of the age key and (Cloudflare) the tunnel token, quarterly break-glass login test.

Not covered: CIS certification (DevSec hardening is not CIS compliance), host intrusion
detection, central log shipping, and a compromised hypervisor or root on the VM. A Docker
internal network is no boundary against root on the host.

## Troubleshooting

| Symptom | Cause and fix |
|---|---|
| `cd: ...: No such file or directory`, or the playbook cannot find roles | You are on the VM, or not in the kit's directory. Run from the controller, in the repository root. |
| `No inventory was parsed` | `-i` names a directory. Name the file: `-i ~/.config/openctem-ansible/inventory/hosts.ini`. |
| `Missing sudo password` or `BECOME password` is rejected | Add `-K`, and type the sudo password of the SSH user **on the VM**. On Ubuntu 26.04 with `sudo-rs`, set `ansible_become_exe=/usr/bin/sudo.ws`. |
| `python3 -m venv` fails with `ensurepip is not available` | `python3-venv` is missing. Use `python3 -m venv --without-pip .venv` and `pip3 install --python .venv/bin/python ...` as shown above. |
| `install: invalid user '65532'` on Ubuntu 26.04 | The Rust coreutils' `install -o` needs a passwd entry. Use `chown 65532:65532`, as the guides do. |
| Firewall stage refuses: "Controller address ... is not inside admin_cidrs" | The lockout guard. Add the network you connect from to `admin_cidrs`. |
| A port is reachable although ufw denies it | A container publishes it, and Docker bypasses ufw. `playbooks/85-exposure-audit.yml` lists them; the stack publishes nothing beyond `127.0.0.1`. |
| Containers have no internet after hardening | `net.ipv4.ip_forward` is off or `iptables: false` is in `daemon.json`. The OS stage pins forwarding on; remove `iptables: false`. |
| `--check` stops at a read-only task | Run the stages in order; a check cannot see packages a later stage installs. |
| Deploy stops at "Verify the release signatures" | The digest is not signed by the release workflow at that tag, or sigstore is unreachable. Investigate; do not disable verification. |
| Backup "off-host copy refused" | Local (plaintext) mode. Set `backup_age_recipient`. |
| The API will not start and the log names `FINGERPRINT_KEY` | The file is missing, shorter than 32 characters or not 0400. Re-run `playbooks/50-openctem.yml`; never set it through `openctem_api_env`. |
| Docker compose says "no configuration file" | Name the project and files: `sudo docker compose -p openctem -f /opt/openctem/compose.yml ps` (with the Cloudflare path add `-f /opt/openctem/compose.cloudflared.yml`), or `cd /opt/openctem` first. |

Logs: `sudo docker compose -p openctem -f /opt/openctem/compose.yml logs <service>`,
`journalctl -u openctem-backup`, `journalctl -t openctem-monitor`, and
`sudo ausearch -k openctem_secrets` (who read the secrets). Log lines of the platform
itself are described in the [Log reference](../operations/logs.md).
