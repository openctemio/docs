---
title: Closing findings
parent: User guide
nav_order: 5.6
---

# Closing findings

A finding can close because a scan no longer finds it. This page explains when
that is allowed, how your organization controls it, and where people review
the closes that wait for a decision.

## The principle

A finding closes only when the same check looks again and the issue is gone.
Nothing else counts as proof of a fix. These never close a finding:

- A scan that was blocked (for example by a WAF or CDN), could not reach the
  target, or was rate limited.
- A partial or interrupted scan.
- A proxy or sensor failure.
- A scan from a different tool than the one that found the issue.
- A scan whose template release changed since the finding was raised. The
  results of two releases are not comparable, so this does not prove a fix.

Two kinds of finding are never closed by absence at all:

- **Leaked secrets.** A secret that is no longer visible has not been made
  safe. It closes when it is rotated.
- **Findings from people** (pentest, manual and bug bounty findings). A person
  closes them.

## Closing mode

Owners and administrators choose how the platform handles a close in
**Settings > Finding lifecycle > Closing findings**.

| Mode | What happens |
|---|---|
| **Automatic** | A covered scan that no longer finds an issue closes it. Critical findings wait for review. |
| **Review first** | Every close the platform would make waits in **Ready to close** until a person confirms it. |
| **Off** | Only a person closes findings. |

Organizations created before this setting existed start in **Review first**.

In Automatic mode, a finding counts as critical when its severity is critical,
it is P0, or it is known to be exploited. Only the organization owner can let
covered scans close critical findings without review.

### Making the setting looser

Moving to a looser setting is a sensitive change. These changes are loosening:

- Off to Review first or Automatic.
- Review first to Automatic.
- Letting critical findings close without review.

A loosening change:

1. asks you to sign in again;
2. takes effect 24 hours later;
3. notifies the owners and administrators.

Until it takes effect, the stricter setting stays in force. The settings page
shows the waiting change, and anyone allowed to change the setting can cancel
it. Making the setting stricter applies at once.

### Platform ceiling

The operator of the platform can keep automatic closing in a dry run for the
whole installation. While that is the case, nothing closes automatically,
whatever your organization chose.

Self-hosted operators set this with the environment variable
`INGEST_COVERAGE_AUTO_RESOLVE`:

| Value | Meaning |
|---|---|
| `off` | No automatic closing anywhere. |
| `dry_run` (default) | Automatic closing stays in a dry run: nothing closes automatically. |
| `enforce` | Automatic closing is live for the installation. |
| `tenant` | Each organization follows the closing mode it chose. |

## Ready to close

**Findings > Ready to close** lists the closes that wait for a person, with
critical findings first. Each row shows why the finding can close:

- the method, **Covered scan**;
- the tool, the scan and when it ran;
- **Held for review**, shown when many findings disappeared in one scan. This
  is a safety guard against a scanner that is broken or blinded, so a person
  looks before anything closes.

For each finding you choose one of two actions:

- **Confirm close** closes the finding as fixed. You are recorded as the
  person who confirmed it.
- **Keep open** needs a reason: still there (checked by hand), the scan cannot
  be trusted, wrong asset, or other with a note.

To decide many at once, select several rows. A bulk action covers up to 200
findings. Confirming more than one finding asks you to sign in again.

A finding that was seen again after the scan, or changed by someone in the
meantime, is skipped and stays open.

### Who can see and decide

- Anyone with `findings:read` sees the queue for the assets in their data
  scope.
- Confirming or keeping open needs the `findings:verify` permission.
- The sidebar shows a count next to **Ready to close** for people who can
  decide.

## Recently auto-closed

The second tab, **Recently auto-closed**, lists findings the platform closed by
itself in the last 7 days, with the scan behind each close.

If a close was wrong, choose **Reopen: not fixed** (needs `findings:status`).
The finding reopens as confirmed, the platform records that the automatic close
was wrong, and the reopening does not count as a regression.

## On a finding

The **Verify** panel of a finding has a covered-scan row. It says why a scan
will or will not close this finding, for example:

- Critical findings wait for review in auto mode.
- Your organization reviews every automatic close.
- Automatic closing is off for your organization.

## Audit

Every confirm, keep open, reopen and change of closing mode is recorded in the
audit log. A loosening change is logged at high severity.

## Related pages

- [Exposures and findings](05-exposures-and-findings.md)
- [Known false positives](known-false-positives.md)
