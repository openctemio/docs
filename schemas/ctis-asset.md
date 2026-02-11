---
layout: default
title: CTIS Asset Schema
parent: CTIS Schema Reference
nav_order: 2
---

# CTIS Asset Schema

The Asset schema represents discovered assets such as domains, IP addresses, repositories, cloud resources, and Web3 contracts.

**Schema Location**: `schemas/ctis/v1/asset.json`

---

## Required Fields

| Field | Type | Description |
|-------|------|-------------|
| `type` | enum | Asset type (see [AssetType](#assettype)) |
| `value` | string | Primary value (domain name, IP address, contract address, etc.) |

---

## All Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | No | Unique identifier within the report |
| `type` | [AssetType](#assettype) | **Yes** | Asset type |
| `value` | string | **Yes** | Primary value |
| `name` | string | No | Human-readable name |
| `description` | string | No | Asset description |
| `tags` | array[string] | No | Categorization tags |
| `criticality` | enum | No | Asset criticality level |
| `confidence` | integer (0-100) | No | Confidence score |
| `discovered_at` | string (date-time) | No | When asset was discovered |
| `technical` | [AssetTechnical](#assettechnical) | No | Type-specific technical details |
| `related_assets` | array[string] | No | Related asset IDs within this report |
| `compliance` | [AssetCompliance](#assetcompliance) | No | CTEM compliance context |
| `services` | array[[ServiceInfo](#serviceinfo)] | No | Services running on this asset (CTEM) |
| `is_internet_accessible` | boolean | No | Is the asset directly accessible from the internet |
| `properties` | object | No | Custom properties |

---

## Enums

### AssetType

| Value | Description |
|-------|-------------|
| `domain` | Root domain |
| `subdomain` | Subdomain |
| `ip_address` | IP address (v4 or v6) |
| `certificate` | TLS/SSL certificate |
| `website` | Website |
| `web_application` | Web application |
| `api` | API endpoint |
| `mobile_app` | Mobile application |
| `service` | Network service |
| `repository` | Code repository |
| `cloud_account` | Cloud account |
| `compute` | Compute resource (EC2, VM) |
| `storage` | Storage resource (S3, Blob) |
| `database` | Database |
| `serverless` | Serverless function |
| `container_registry` | Container registry |
| `host` | Host/server |
| `server` | Server |
| `container` | Container |
| `kubernetes` | Kubernetes resource |
| `kubernetes_cluster` | Kubernetes cluster |
| `kubernetes_namespace` | Kubernetes namespace |
| `network` | Network |
| `vpc` | Virtual Private Cloud |
| `subnet` | Subnet |
| `load_balancer` | Load balancer |
| `firewall` | Firewall |
| `iam_user` | IAM user |
| `iam_role` | IAM role |
| `service_account` | Service account |
| `http_service` | HTTP service |
| `open_port` | Open port |
| `discovered_url` | Discovered URL |
| `smart_contract` | Smart contract |
| `wallet` | Blockchain wallet |
| `token` | Token (ERC-20, etc.) |
| `nft_collection` | NFT collection |
| `defi_protocol` | DeFi protocol |
| `blockchain` | Blockchain |
| `unclassified` | Unclassified asset (not yet categorized) |
| `other` | Other (**deprecated** - use `unclassified`) |

### Criticality

| Value | Description |
|-------|-------------|
| `critical` | Critical asset |
| `high` | High criticality |
| `medium` | Medium criticality |
| `low` | Low criticality |
| `info` | Informational |

---

## Object Definitions

### AssetTechnical

Type-specific technical details. Only the relevant sub-object should be populated based on asset type.

| Field | Type | Description |
|-------|------|-------------|
| `domain` | [DomainTechnical](#domaintechnical) | Domain-specific details |
| `ip_address` | [IPAddressTechnical](#ipaddresstechnical) | IP address details |
| `repository` | [RepositoryTechnical](#repositorytechnical) | Repository details |
| `certificate` | [CertificateTechnical](#certificatetechnical) | Certificate details |
| `cloud` | [CloudTechnical](#cloudtechnical) | Cloud resource details |
| `service` | [ServiceTechnical](#servicetechnical) | Network service details |
| `web3` | [Web3Asset](ctis-web3-asset.md) | Web3/blockchain details |

---

### DomainTechnical

| Field | Type | Description |
|-------|------|-------------|
| `registrar` | string | Domain registrar |
| `registered_at` | string (date-time) | Registration date |
| `expires_at` | string (date-time) | Expiration date |
| `nameservers` | array[string] | Nameservers |
| `dns_records` | array[[DNSRecord](#dnsrecord)] | DNS records |
| `whois` | object | WHOIS data (key-value) |

### DNSRecord

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | enum | **Yes** | Record type: `A`, `AAAA`, `CNAME`, `MX`, `TXT`, `NS`, `SOA`, `PTR`, `SRV` |
| `name` | string | **Yes** | Record name |
| `value` | string | **Yes** | Record value |
| `ttl` | integer | No | Time to live |

---

### IPAddressTechnical

| Field | Type | Description |
|-------|------|-------------|
| `version` | integer | IP version: `4` or `6` |
| `hostname` | string | Reverse hostname |
| `asn` | integer | Autonomous System Number |
| `asn_org` | string | ASN organization |
| `country` | string | Country code (2 chars) |
| `city` | string | City |
| `ports` | array[[PortInfo](#portinfo)] | Open ports |
| `geolocation` | [Geolocation](#geolocation) | Geographic coordinates |

### PortInfo

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `port` | integer (1-65535) | **Yes** | Port number |
| `protocol` | enum | No | `tcp` or `udp` |
| `state` | enum | No | `open`, `filtered`, `closed` |
| `service` | string | No | Service name |
| `banner` | string | No | Service banner |
| `version` | string | No | Service version |

### Geolocation

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `latitude` | number (-90 to 90) | **Yes** | Latitude |
| `longitude` | number (-180 to 180) | **Yes** | Longitude |
| `accuracy` | number | No | Accuracy in meters |

---

### RepositoryTechnical

| Field | Type | Description |
|-------|------|-------------|
| `platform` | enum | `github`, `gitlab`, `bitbucket`, `azure_devops` |
| `owner` | string | Repository owner |
| `name` | string | Repository name |
| `default_branch` | string | Default branch name |
| `visibility` | enum | `public`, `private`, `internal` |
| `url` | string (uri) | Repository URL |
| `clone_url` | string (uri) | Clone URL |
| `languages` | object | Languages with byte counts |
| `stars` | integer | Star count |
| `forks` | integer | Fork count |
| `last_commit_sha` | string | Last commit SHA |
| `last_commit_at` | string (date-time) | Last commit date |

---

### CertificateTechnical

| Field | Type | Description |
|-------|------|-------------|
| `serial_number` | string | Certificate serial number |
| `subject_cn` | string | Subject common name |
| `sans` | array[string] | Subject Alternative Names |
| `issuer_cn` | string | Issuer common name |
| `issuer_org` | string | Issuer organization |
| `not_before` | string (date-time) | Valid from |
| `not_after` | string (date-time) | Valid until |
| `signature_algorithm` | string | Signature algorithm |
| `key_algorithm` | string | Key algorithm |
| `key_size` | integer | Key size in bits |
| `fingerprint` | string | Certificate fingerprint |
| `self_signed` | boolean | Is self-signed |
| `expired` | boolean | Is expired |
| `wildcard` | boolean | Is wildcard certificate |

---

### CloudTechnical

| Field | Type | Description |
|-------|------|-------------|
| `provider` | enum | `aws`, `gcp`, `azure`, `alibaba`, `oracle` |
| `account_id` | string | Cloud account ID |
| `region` | string | Region |
| `zone` | string | Availability zone |
| `resource_type` | string | Resource type |
| `resource_id` | string | Resource ID |
| `arn` | string | AWS ARN (if applicable) |
| `tags` | object | Resource tags (key-value) |

---

### ServiceTechnical

Technical details for network services (SSH, SMTP, FTP, HTTP, databases, etc.).

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Service name |
| `version` | string | Service version |
| `port` | integer (1-65535) | Port number |
| `protocol` | string | Application protocol: `http`, `https`, `ssh`, `smtp`, `ftp`, `dns`, `ldap`, `smb`, `rdp`, `mysql`, `postgresql`, `mongodb`, `redis`, `telnet`, `snmp` |
| `transport` | enum | `tcp` or `udp` |
| `tls` | boolean | SSL/TLS enabled |
| `tls_version` | enum | `ssl3`, `tls1.0`, `tls1.1`, `tls1.2`, `tls1.3` |
| `tls_cert_subject` | string | TLS certificate subject |
| `tls_cert_issuer` | string | TLS certificate issuer |
| `tls_cert_expiry` | string (date-time) | TLS certificate expiry |
| `banner` | string | Service banner/fingerprint |
| `product` | string | Product name (e.g., OpenSSH, nginx) |
| `cpe` | string | CPE identifier |
| `extra_info` | string | Additional info |
| `state` | enum | `open`, `filtered`, `closed` |
| `auth_required` | boolean | Authentication required |
| `auth_methods` | array[string] | Supported auth methods |
| `default_credentials` | boolean | Default credentials detected |
| `anonymous_access` | boolean | Anonymous access allowed |
| `response_time_ms` | integer | Response time in ms |
| `last_seen` | string (date-time) | Last seen timestamp |
| `details` | object | Protocol-specific details |

---

### AssetCompliance

CTEM compliance context for an asset.

| Field | Type | Description |
|-------|------|-------------|
| `frameworks` | array[string] | Compliance frameworks: `PCI-DSS`, `HIPAA`, `SOC2`, `GDPR`, `ISO27001` |
| `data_classification` | enum | `public`, `internal`, `confidential`, `restricted`, `secret` |
| `pii_exposed` | boolean | Contains Personally Identifiable Information |
| `phi_exposed` | boolean | Contains Protected Health Information |
| `regulatory_owner` | string | Regulatory owner email/username |

---

### ServiceInfo

Network service discovered on an asset (CTEM).

| Field | Type | Description |
|-------|------|-------------|
| `port` | integer (1-65535) | Port number |
| `protocol` | enum | `tcp` or `udp` |
| `service_type` | string | Service type: `http`, `https`, `ssh`, `ftp`, `mysql`, etc. |
| `product` | string | Product name: `Apache`, `nginx`, `OpenSSH`, etc. |
| `version` | string | Product version |
| `banner` | string | Service banner |
| `cpe` | string | CPE identifier |
| `is_public` | boolean | Publicly accessible from internet |
| `tls_enabled` | boolean | TLS enabled |
| `tls_version` | string | TLS version |
| `state` | enum | `active`, `inactive`, `filtered` |

---

## Examples

### Domain Asset

```json
{
  "type": "domain",
  "value": "example.com",
  "name": "Example Domain",
  "criticality": "high",
  "technical": {
    "domain": {
      "registrar": "Cloudflare",
      "registered_at": "2020-01-01T00:00:00Z",
      "expires_at": "2027-01-01T00:00:00Z",
      "nameservers": ["ns1.cloudflare.com", "ns2.cloudflare.com"],
      "dns_records": [
        {"type": "A", "name": "example.com", "value": "93.184.216.34", "ttl": 3600}
      ]
    }
  }
}
```

### Repository Asset

```json
{
  "type": "repository",
  "value": "github.com/myorg/myrepo",
  "name": "myrepo",
  "criticality": "critical",
  "technical": {
    "repository": {
      "platform": "github",
      "owner": "myorg",
      "name": "myrepo",
      "default_branch": "main",
      "visibility": "private",
      "url": "https://github.com/myorg/myrepo",
      "languages": {"Go": 50000, "TypeScript": 30000}
    }
  }
}
```

### Smart Contract Asset

```json
{
  "type": "smart_contract",
  "value": "0x1234567890abcdef1234567890abcdef12345678",
  "name": "MyToken",
  "criticality": "critical",
  "technical": {
    "web3": {
      "chain": "ethereum",
      "chain_id": 1,
      "address": "0x1234567890abcdef1234567890abcdef12345678",
      "contract": {
        "name": "MyToken",
        "verified": true,
        "contract_type": "erc20",
        "is_proxy": false,
        "compiler_version": "0.8.20"
      }
    }
  }
}
```

---

## Related Schemas

- [Web3 Asset Schema](ctis-web3-asset.md) - Web3-specific asset details
- [Finding Schema](ctis-finding.md) - Findings related to assets
