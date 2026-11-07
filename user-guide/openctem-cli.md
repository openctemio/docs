---
title: Import with the openctem CLI
parent: User guide
nav_order: 5.8
---

# Import with the `openctem` CLI
{: .no_toc }

`openctem import` converts the output of a tool you ran yourself (nmap, testssl.sh, Nessus, a list of names or URLs, any
format the [importers](import-mappings.md) read) into a CTIS report on your machine and imports it into your organization.
Scan results often sit on a Windows jump host, so the CLI runs on Windows, Linux and macOS alike.

1. TOC
{:toc}

## Install

Each [sdk-go release](https://github.com/openctemio/sdk-go/releases) carries:

- `openctem_<version>_linux_<arch>.tar.gz` and `openctem_<version>_darwin_<arch>.tar.gz`;
- `openctem_<version>_windows_<arch>.zip`, with `openctem.exe`;
- `SHA256SUMS`, which lists every archive, and `SHA256SUMS.sigstore.json`, its keyless cosign signature from the release
  workflow.

`<arch>` is `amd64` or `arm64`.

### Windows (PowerShell)

Run this in Windows PowerShell 5.1 or PowerShell 7 as the user who will use the CLI; no administrator rights are needed. It
downloads the zip, checks it against `SHA256SUMS`, unpacks `openctem.exe` to `%LOCALAPPDATA%\Programs\openctem` and adds
that folder to your `Path`:

```powershell
$v = '{{ site.data.versions.sdk_go | remove_first: "v" }}'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$arch = if ($env:PROCESSOR_ARCHITECTURE -eq 'ARM64') { 'arm64' } else { 'amd64' }
$base = "https://github.com/openctemio/sdk-go/releases/download/v$v"
$zip = "openctem_${v}_windows_$arch.zip"
$tmp = Join-Path $env:TEMP "openctem-$v"; New-Item -ItemType Directory -Force $tmp | Out-Null
Invoke-WebRequest -UseBasicParsing "$base/$zip" -OutFile "$tmp\$zip"
Invoke-WebRequest -UseBasicParsing "$base/SHA256SUMS" -OutFile "$tmp\SHA256SUMS"
$want = ((Get-Content "$tmp\SHA256SUMS") | Where-Object { $_ -match "^[0-9a-f]{64}  $([regex]::Escape($zip))$" }) -replace ' .*', ''
$got = (Get-FileHash -Algorithm SHA256 "$tmp\$zip").Hash.ToLower()
if (-not $want -or $want -ne $got) { throw "SHA256 of $zip does not match SHA256SUMS: do not use it" }
Unblock-File "$tmp\$zip"
$dir = Join-Path $env:LOCALAPPDATA 'Programs\openctem'
Expand-Archive -Force "$tmp\$zip" -DestinationPath $dir
$userPath = [Environment]::GetEnvironmentVariable('Path', 'User')
if (($userPath -split ';') -notcontains $dir) { [Environment]::SetEnvironmentVariable('Path', "$userPath;$dir", 'User') }
$env:Path += ";$dir"
openctem version
```

The same block is run on a Windows runner in the SDK's CI, against a release built the way the release workflow builds it.

To also check who built `SHA256SUMS`, install [cosign](https://github.com/sigstore/cosign/releases) and run this before
the checksum line:

```powershell
Invoke-WebRequest -UseBasicParsing "$base/SHA256SUMS.sigstore.json" -OutFile "$tmp\SHA256SUMS.sigstore.json"
cosign verify-blob --bundle "$tmp\SHA256SUMS.sigstore.json" `
  --certificate-identity "https://github.com/openctemio/sdk-go/.github/workflows/release.yml@refs/tags/v$v" `
  --certificate-oidc-issuer https://token.actions.githubusercontent.com "$tmp\SHA256SUMS"
if ($LASTEXITCODE -ne 0) { throw 'SHA256SUMS is not signed by the sdk-go release workflow' }
```

### Linux and macOS

```bash
v={{ site.data.versions.sdk_go | remove_first: "v" }}
os=linux; arch=amd64        # or darwin, arm64
base=https://github.com/openctemio/sdk-go/releases/download/v$v
curl -sSLO $base/openctem_${v}_${os}_${arch}.tar.gz
curl -sSLO $base/SHA256SUMS
curl -sSLO $base/SHA256SUMS.sigstore.json
cosign verify-blob --bundle SHA256SUMS.sigstore.json \
  --certificate-identity "https://github.com/openctemio/sdk-go/.github/workflows/release.yml@refs/tags/v$v" \
  --certificate-oidc-issuer https://token.actions.githubusercontent.com SHA256SUMS
sha256sum -c SHA256SUMS --ignore-missing     # macOS: shasum -a 256 -c SHA256SUMS --ignore-missing
tar -xzf openctem_${v}_${os}_${arch}.tar.gz openctem
```

### With Go

```bash
go install github.com/openctemio/sdk-go/cmd/openctem@{{ site.data.versions.sdk_go }}
```

This builds the binary on your host. Its integrity comes from the Go module proxy and the checksum database
(`sum.golang.org`), which `go install` always checks.

## Windows trust: SmartScreen, signing and hardened hosts

`openctem.exe` is not Authenticode-signed yet.

- **SmartScreen.** Windows marks a file downloaded by a browser or saved from e-mail with the Mark-of-the-Web (a
  `Zone.Identifier` stream), and Explorer's Extract All copies the mark onto the files it unpacks. Microsoft Defender SmartScreen then warns
  "Windows protected your PC" when a marked, unsigned program runs. The install script removes the mark with
  `Unblock-File` only after the checksum matched, so trust rests on the checksum and, with cosign, on the signature of the
  release workflow instead of a publisher certificate. `Invoke-WebRequest`, `curl.exe` and Expand-Archive did not
  add or copy the mark in our test on Windows Server 2025; `Unblock-File` covers a zip that arrived through a browser,
  e-mail or a file share, or a host whose policy marks downloads, and does nothing on an unmarked file. Never unblock a file whose checksum did not match.
- **Go install.** A binary built with `go install` carries no mark, so SmartScreen does not prompt. It needs Go on the
  host.
- **AppLocker and WDAC.** A jump host with AppLocker or Windows Defender Application Control policies may refuse any
  unsigned program, whatever its checksum. There the fix is a signed binary or an administrator rule that allows
  `openctem.exe` by path or by file hash (the SHA-256 from `SHA256SUMS`, updated with each release).

winget and Scoop packages are not offered yet.

## Import

Set the console address and an API key with Update Findings, Manage Assets and Import Assets:

```powershell
$env:OPENCTEM_URL = 'https://console.example.com'
$env:OPENCTEM_API_KEY = '...'
openctem import C:\scans\*.nessus
nmap -sV -oX - 192.0.2.0/24 | openctem import --format nmap
```

In cmd.exe use `set OPENCTEM_URL=...`; on Linux and macOS `export OPENCTEM_URL=...`.

- `--dry-run` prints the CTIS report and sends nothing; `--out <file>` writes it to a file only you can read (on Windows a
  DACL for your account and SYSTEM) for a later `openctem import <file>`.
- File patterns are expanded by the CLI itself, so `C:\scans\*.nessus` works in cmd.exe and PowerShell, which pass the
  pattern on unexpanded. More than 10 files are sent 10 at a time, each upload with its own receipt.
- Exports written by Windows tools are read as they are: UTF-16 with or without a byte order mark (Windows PowerShell 5.1
  writes UTF-16 for `>` and `Out-File`), a UTF-8 byte order mark, and CRLF line ends. Each file may be up to 100 MiB.
- TLS is checked against the system trust store (on Windows the certificate store, so a root CA deployed by Group Policy
  works). `--ca-file` or `OPENCTEM_CA_FILE` adds a private CA in PEM to it; verification is never skipped.
- `HTTPS_PROXY` and `NO_PROXY` are honoured. The Windows system proxy (WinHTTP or Internet Options) is not read: set
  `HTTPS_PROXY` to the same address (`netsh winhttp show proxy` shows it).
- Output is plain text without colour codes. Exit status (`%ERRORLEVEL%` in cmd.exe, `$LASTEXITCODE` in PowerShell):
  0 imported, 1 refused or failed, 2 usage or input error, 3 still queued at the end of `--wait`.

The key is sent only over HTTPS (plain HTTP only to localhost) and never to a redirect target. The platform validates the
report again, judges every host against your [scope](../scanning/scope.md) (hosts outside it become candidates, never
scan targets) and answers with a receipt. All flags, `openctem targets export` and `openctem run` are described in the
[CLI reference](https://github.com/openctemio/sdk-go/blob/main/docs/tools/cli.md#openctem-import-import-the-output-of-a-tool-you-ran).
