---
title: Backup and restore flow
parent: Operations flows
grand_parent: How it works
nav_order: 3
description: What a backup holds, how it is protected, and the order of a restore.
---

# Backup and restore flow
{: .no_toc }

A complete backup is more than the database. It also holds the uploaded
files, the gateway's internal certificate authority, the job signer's key and
state, and the installation secrets. Without the encryption key, the stored
credentials in the database cannot be read.

1. TOC
{:toc}

## The flow

### Backup

```mermaid
flowchart LR
    subgraph SRV["Your server"]
        DB["Database dump, checked readable"]
        FILES["Uploaded files"]
        CA["Gateway certificate authority"]
        SK["Signer key and state"]
        ENV["Secrets, including the encryption key"]
    end
    DB --> ENC{"Recipient key set?"}
    FILES --> ENC
    CA --> ENC
    SK --> ENC
    ENV --> ENC
    ENC -- "yes" --> AGE["Each file encrypted with age while written"]
    ENC -- "no" --> PLAIN["Plain files, warning each run"]
    AGE --> OUT["Backup folder, mode 0700, 14 kept"]
    PLAIN --> OUT
```

| Path | What it covers |
|---|---|
| Docker Compose `backup.sh` | database, files, certificate authority, signer key and state, `.env` |
| Ansible kit timer | the same, plus the deployment files and the admin audit copy, with a manifest signed by the host key |
| Off-host point-in-time recovery | database only, continuous, encrypted with its own passphrase |
| Helm backup job | database only |

Keep the decryption key, and the point-in-time recovery passphrase, off the
server. Losing them makes the backups unreadable.

### Restore

```mermaid
sequenceDiagram
    autonumber
    actor O as Operator
    box Your server
    participant S as Restore script
    participant DB as PostgreSQL
    participant C as Services
    end
    O->>S: restore a backup folder, confirmed
    S->>S: decrypt, check the version and, with Ansible, the signed manifest
    S->>C: stop the gateway, web, console and API
    S->>DB: end sessions, restore the dump
    S->>C: restore files, certificate authority, signer key and state
    S->>C: start everything, migrations run if the backup is older
    O->>S: verify, restore the newest dump to a scratch database and compare row counts
```

1. A version mismatch is a warning with Compose and a refusal with Ansible
   unless you allow it.
2. The Ansible restore dumps the current database first, so a wrong restore
   can be undone.
3. With Compose, `.env` is not restored by the script. On a new host, put
   the backed-up `.env` in place before the restore. With Ansible, pass
   `--with-secrets`.
4. Practise with `backup.sh verify` or the Ansible restore drill.

## When something fails

| What happens | What you see | What to do |
|---|---|---|
| The encryption key is lost | Stored credentials do not open after restore | Restore the key from the backup's secrets. |
| The signer state is lost | Sequence numbers of signed jobs can repeat | Restore the signer state together with its key. |
| The certificate authority is lost | Sensors no longer trust the gateway | Restore it, or configure every sensor again. |
| The manifest signature fails | The Ansible restore stops | Check the backup's origin. |

## Security

- **Encryption.** age, per file, streamed, so no plain copy touches the
  disk. Without a recipient the backup is plain and you are warned.
- **Secrets in the backup.** A backup holds the encryption key. Protect it
  like the server itself.

## Related

- [Backup and restore](../../operations/backup-restore.md)
- [Upgrade and migrations](upgrade-migrations.md)
- [Job signer service](job-signer.md)
