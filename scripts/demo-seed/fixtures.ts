// Synthetic tool output for the demo organization "Example Corp".
//
// Every host, address and repository is fictional: example.com/.org/.net,
// the documentation address ranges 192.0.2.0/24, 198.51.100.0/24 and
// 203.0.113.0/24, the AWS documentation account 123456789012 and
// github.com/example-corp. The vulnerability identifiers are real public CVEs
// so the threat-intelligence enrichment (EPSS, KEV) has something to show.
// The secrets are the documented example values of their providers.

export interface Fixture {
  name: string
  type: string
  body: string
}

const iso = (daysAgo: number) => new Date(Date.now() - daysAgo * 86400e3).toISOString()

// ---------------------------------------------------------------------------
// Network scan (Nessus v2 XML): hosts, services and their vulnerabilities.
// ---------------------------------------------------------------------------

interface NessusItem {
  port: number
  svc: string
  proto?: string
  sev: 0 | 1 | 2 | 3 | 4
  id: number
  name: string
  family: string
  cve?: string[]
  cvss?: number
  synopsis: string
  solution?: string
  output?: string
}
interface NessusHost {
  ip: string
  fqdn: string
  os: string
  items: NessusItem[]
}

const nessusHosts: NessusHost[] = [
  {
    ip: '203.0.113.10',
    fqdn: 'www.example.com',
    os: 'Linux Kernel 5.15 on Ubuntu 22.04',
    items: [
      { port: 443, svc: 'www', sev: 3, id: 151131, name: 'nginx < 1.20.1 1-Byte Memory Overwrite RCE', family: 'Web Servers', cve: ['CVE-2021-23017'], cvss: 7.7, synopsis: 'The remote web server is affected by a remote code execution vulnerability.', solution: 'Upgrade to nginx 1.20.1 or later.', output: 'URL               : https://www.example.com/\n  Installed version : 1.18.0\n  Fixed version     : 1.20.1' },
      { port: 443, svc: 'www', sev: 2, id: 104743, name: 'TLS Version 1.0 Protocol Detection', family: 'Service detection', cvss: 6.5, synopsis: 'The remote service encrypts traffic using an older version of TLS.', solution: 'Enable support for TLS 1.2 and 1.3, and disable support for TLS 1.0.', output: 'TLSv1 is enabled and the server supports at least one cipher.' },
      { port: 22, svc: 'ssh', sev: 1, id: 153953, name: 'SSH Weak Key Exchange Algorithms Enabled', family: 'Misc.', cvss: 3.7, synopsis: 'The remote SSH server is configured to allow weak key exchange algorithms.', solution: 'Remove the weak algorithms from the server configuration.', output: 'The following weak key exchange algorithms are enabled :\n\n  diffie-hellman-group-exchange-sha1\n  diffie-hellman-group1-sha1' },
      { port: 443, svc: 'www', sev: 0, id: 10863, name: 'SSL Certificate Information', family: 'General', synopsis: 'This plugin displays the SSL certificate.', output: 'Subject Name: CN=www.example.com\nIssuer Name: CN=Example Issuing CA 1\nNot Valid After: Mar 01 23:59:59 2027 GMT' },
    ],
  },
  {
    ip: '203.0.113.11',
    fqdn: 'api.example.com',
    os: 'Linux Kernel 6.1 on Debian 12',
    items: [
      { port: 22, svc: 'ssh', sev: 4, id: 179040, name: 'OpenSSH < 9.3p2 Remote Code Execution via ssh-agent', family: 'Misc.', cve: ['CVE-2023-38408'], cvss: 9.8, synopsis: 'The SSH server running on the remote host is affected by a remote code execution vulnerability.', solution: 'Upgrade to OpenSSH 9.3p2 or later.', output: '  Version source    : SSH-2.0-OpenSSH_8.9p1\n  Installed version : 8.9p1\n  Fixed version     : 9.3p2' },
      { port: 443, svc: 'www', sev: 0, id: 22964, name: 'Service Detection', family: 'Service detection', synopsis: 'The remote service could be identified.', output: 'A web server is running on this port through TLS.' },
    ],
  },
  {
    ip: '203.0.113.20',
    fqdn: 'mail.example.com',
    os: 'Linux Kernel 5.10 on Debian 11',
    items: [
      { port: 25, svc: 'smtp', sev: 2, id: 54582, name: 'SMTP Service Cleartext Login Permitted', family: 'SMTP problems', cvss: 5.3, synopsis: 'The remote mail server allows cleartext logins.', solution: 'Require STARTTLS before AUTH.', output: 'The SMTP server advertises AUTH PLAIN LOGIN before STARTTLS.' },
      { port: 993, svc: 'imap', sev: 1, id: 69551, name: 'SSL Certificate Chain Contains RSA Keys Less Than 2048 bits', family: 'General', cvss: 2.6, synopsis: 'The X.509 certificate chain contains a weak RSA key.', solution: 'Replace the certificate with one that uses a 2048-bit or stronger key.' },
    ],
  },
  {
    ip: '198.51.100.15',
    fqdn: 'vpn.example.net',
    os: 'FortiOS on Fortinet FortiGate',
    items: [
      { port: 443, svc: 'www', sev: 4, id: 177085, name: 'Fortinet FortiOS SSL-VPN Heap-Based Buffer Overflow (FG-IR-23-097)', family: 'Firewalls', cve: ['CVE-2023-27997'], cvss: 9.8, synopsis: 'The remote host is affected by a heap-based buffer overflow in the SSL-VPN.', solution: 'Upgrade FortiOS to a fixed version listed in the vendor advisory.', output: '  Installed version : 7.0.10\n  Fixed version     : 7.0.12' },
    ],
  },
  {
    ip: '198.51.100.44',
    fqdn: 'legacy.example.net',
    os: 'Microsoft Windows Server 2012 R2',
    items: [
      { port: 3389, svc: 'msrdp', sev: 3, id: 58453, name: 'Terminal Services Doesn\'t Use Network Level Authentication (NLA) Only', family: 'Windows', cvss: 7.3, synopsis: 'The remote Terminal Services does not use Network Level Authentication only.', solution: 'Enable Network Level Authentication on the remote RDP server.' },
      { port: 445, svc: 'cifs', sev: 4, id: 97833, name: 'MS17-010: Security Update for Microsoft Windows SMB Server', family: 'Windows', cve: ['CVE-2017-0144'], cvss: 8.1, synopsis: 'The remote Windows host is affected by multiple vulnerabilities.', solution: 'Apply the MS17-010 security update.', output: 'Sent: 0000000000000000\nReceived: 0500000000000000\nThe host responded to a transaction with STATUS_INSUFF_SERVER_RESOURCES.' },
      { port: 0, svc: 'general', proto: 'tcp', sev: 3, id: 108797, name: 'Unsupported Windows OS (remote)', family: 'Windows', cvss: 10, synopsis: 'The remote operating system is no longer supported.', solution: 'Upgrade to a supported version of Windows.' },
    ],
  },
  {
    ip: '192.0.2.25',
    fqdn: 'build.example.com',
    os: 'Linux Kernel 5.15 on Ubuntu 22.04',
    items: [
      { port: 8080, svc: 'www', sev: 4, id: 189463, name: 'Jenkins < 2.442 Arbitrary File Read', family: 'CGI abuses', cve: ['CVE-2024-23897'], cvss: 9.8, synopsis: 'A job scheduling and management system on the remote host is affected by an arbitrary file read vulnerability.', solution: 'Upgrade Jenkins to 2.442 or later.', output: '  URL               : http://build.example.com:8080/\n  Installed version : 2.426.1\n  Fixed version     : 2.442' },
      { port: 22, svc: 'ssh', sev: 0, id: 10267, name: 'SSH Server Type and Version Information', family: 'Service detection', synopsis: 'An SSH server is listening on this port.', output: 'SSH version : SSH-2.0-OpenSSH_8.9p1 Ubuntu-3ubuntu0.6' },
    ],
  },
  {
    ip: '192.0.2.40',
    fqdn: 'db01.example.com',
    os: 'Linux Kernel 5.15 on Ubuntu 22.04',
    items: [
      { port: 5432, svc: 'postgresql', sev: 2, id: 118224, name: 'PostgreSQL Server Accepts Connections Without TLS', family: 'Databases', cvss: 5.9, synopsis: 'The remote database server accepts unencrypted connections.', solution: 'Set ssl = on and require hostssl entries in pg_hba.conf.' },
      { port: 5432, svc: 'postgresql', sev: 1, id: 26024, name: 'PostgreSQL Default Unpassworded Account', family: 'Databases', cvss: 3.1, synopsis: 'The remote database server has a role without a password.', solution: 'Set a password for every login role or remove it.' },
    ],
  },
]

const xmlEsc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

export function nessusReport(): Fixture {
  const hosts = nessusHosts
    .map((h) => {
      const items = h.items
        .map(
          (i) => `      <ReportItem port="${i.port}" svc_name="${i.svc}" protocol="${i.proto ?? 'tcp'}" severity="${i.sev}" pluginID="${i.id}" pluginName="${xmlEsc(i.name)}" pluginFamily="${i.family}">
        <synopsis>${xmlEsc(i.synopsis)}</synopsis>
        <description>${xmlEsc(i.synopsis)}</description>
${i.solution ? `        <solution>${xmlEsc(i.solution)}</solution>\n` : ''}        <risk_factor>${['None', 'Low', 'Medium', 'High', 'Critical'][i.sev]}</risk_factor>
${(i.cve ?? []).map((c) => `        <cve>${c}</cve>\n`).join('')}${i.cvss ? `        <cvss3_base_score>${i.cvss}</cvss3_base_score>\n` : ''}${i.output ? `        <plugin_output>${xmlEsc(i.output)}</plugin_output>\n` : ''}      </ReportItem>`
        )
        .join('\n')
      return `    <ReportHost name="${h.ip}">
      <HostProperties>
        <tag name="host-ip">${h.ip}</tag>
        <tag name="host-fqdn">${h.fqdn}</tag>
        <tag name="operating-system">${xmlEsc(h.os)}</tag>
        <tag name="HOST_START_TIMESTAMP">${Math.floor(Date.now() / 1000) - 3600}</tag>
        <tag name="HOST_END_TIMESTAMP">${Math.floor(Date.now() / 1000) - 3000}</tag>
      </HostProperties>
${items}
    </ReportHost>`
    })
    .join('\n')
  return {
    name: 'example-corp-perimeter.nessus',
    type: 'application/xml',
    body: `<?xml version="1.0" ?>
<NessusClientData_v2>
  <Report name="Example Corp perimeter (weekly)">
${hosts}
  </Report>
</NessusClientData_v2>
`,
  }
}

// ---------------------------------------------------------------------------
// Web scan (nuclei JSONL): findings with the HTTP request and response.
// ---------------------------------------------------------------------------

interface NucleiHit {
  id: string
  name: string
  severity: string
  tags: string[]
  host: string
  path: string
  matcher?: string
  description: string
  remediation?: string
  cve?: string
  cwe?: string
  cvss?: number
  status: number
  respHeaders: string
  respBody: string
  extracted?: string[]
  ip: string
}

const nucleiHits: NucleiHit[] = [
  {
    id: 'git-config', name: 'Git Configuration - Detect', severity: 'medium', tags: ['config', 'git', 'exposure'],
    host: 'https://staging.example.com', path: '/.git/config', ip: '203.0.113.30',
    description: 'The Git configuration file of the deployed application is publicly readable, which can expose the repository history and internal remotes.',
    remediation: 'Block access to /.git/ in the web server configuration and remove the directory from the deployed artifact.',
    cwe: 'CWE-538', status: 200, respHeaders: 'Content-Type: text/plain',
    respBody: '[core]\n\trepositoryformatversion = 0\n\tfilemode = true\n\tbare = false\n[remote "origin"]\n\turl = https://github.com/example-corp/web-app.git\n\tfetch = +refs/heads/*:refs/remotes/origin/*\n[branch "main"]\n\tremote = origin\n',
    extracted: ['https://github.com/example-corp/web-app.git'],
  },
  {
    id: 'CVE-2021-44228', name: 'Apache Log4j2 - Remote Code Execution (Log4Shell)', severity: 'critical', tags: ['cve', 'rce', 'log4j', 'kev', 'oast'],
    host: 'https://legacy.example.net', path: '/login', ip: '198.51.100.44',
    description: 'Apache Log4j2 JNDI features do not protect against attacker-controlled LDAP and other JNDI endpoints, allowing remote code execution via a crafted header.',
    remediation: 'Upgrade Log4j to 2.17.1 or later.',
    cve: 'CVE-2021-44228', cwe: 'CWE-917', cvss: 10, matcher: 'dns', status: 302, respHeaders: 'Location: /login?error=1',
    respBody: '', extracted: ['interaction from 198.51.100.44 (DNS)'],
  },
  {
    id: 'open-redirect', name: 'Open Redirect - Detection', severity: 'medium', tags: ['redirect', 'generic'],
    host: 'https://app.example.com', path: '/auth/continue?next=https://evil.example.org', ip: '203.0.113.10',
    description: 'The application redirects to a URL taken from the next parameter without validating it, which can be used in phishing.',
    remediation: 'Accept only relative paths or an allow-list of hosts in redirect parameters.',
    cwe: 'CWE-601', status: 302, respHeaders: 'Location: https://evil.example.org', respBody: '',
  },
  {
    id: 'graphql-introspection', name: 'GraphQL Introspection Enabled', severity: 'low', tags: ['graphql', 'misconfig'],
    host: 'https://api.example.com', path: '/graphql', ip: '203.0.113.11',
    description: 'GraphQL introspection is enabled in production and discloses the full schema to anonymous clients.',
    remediation: 'Disable introspection for unauthenticated clients in production.',
    status: 200, respHeaders: 'Content-Type: application/json',
    respBody: '{"data":{"__schema":{"queryType":{"name":"Query"},"types":[{"name":"Order"},{"name":"Customer"},{"name":"PaymentMethod"}]}}}',
  },
  {
    id: 'directory-listing', name: 'Directory Listing Enabled', severity: 'low', tags: ['misconfig', 'listing'],
    host: 'https://legacy.example.net', path: '/backup/', ip: '198.51.100.44',
    description: 'The web server lists the contents of the /backup/ directory.',
    remediation: 'Disable directory listing (Options -Indexes) and remove backups from the web root.',
    cwe: 'CWE-548', status: 200, respHeaders: 'Content-Type: text/html',
    respBody: '<html><head><title>Index of /backup</title></head><body><h1>Index of /backup</h1><a href="site-2026-08-01.tar.gz">site-2026-08-01.tar.gz</a></body></html>',
  },
  {
    id: 'http-missing-security-headers', name: 'HTTP Missing Security Headers', severity: 'info', tags: ['misconfig', 'headers'],
    host: 'https://shop.example.org', path: '/', ip: '198.51.100.30', matcher: 'strict-transport-security',
    description: 'The response does not set the Strict-Transport-Security header.',
    remediation: 'Send Strict-Transport-Security with a max-age of at least one year.',
    status: 200, respHeaders: 'Content-Type: text/html; charset=utf-8', respBody: '<!doctype html><html><head><title>Example Shop</title></head><body>...</body></html>',
  },
  {
    id: 'swagger-api', name: 'Public Swagger API - Detect', severity: 'info', tags: ['exposure', 'api', 'swagger'],
    host: 'https://api.example.com', path: '/swagger/index.html', ip: '203.0.113.11',
    description: 'Swagger UI documenting the API is publicly reachable.',
    status: 200, respHeaders: 'Content-Type: text/html', respBody: '<!DOCTYPE html><html><head><title>Swagger UI</title></head><body><div id="swagger-ui"></div></body></html>',
  },
  {
    id: 'CVE-2023-46604', name: 'Apache ActiveMQ - Remote Code Execution', severity: 'critical', tags: ['cve', 'rce', 'activemq', 'kev'],
    host: 'https://legacy.example.net', path: ':61616', ip: '198.51.100.44',
    description: 'The OpenWire protocol of Apache ActiveMQ allows a remote attacker to run arbitrary shell commands by manipulating serialized class types.',
    remediation: 'Upgrade ActiveMQ to 5.15.16, 5.16.7, 5.17.6 or 5.18.3 or later.',
    cve: 'CVE-2023-46604', cwe: 'CWE-502', cvss: 10, status: 200, respHeaders: '', respBody: 'ActiveMQ OpenWire 5.15.9', extracted: ['5.15.9'],
  },
]

export function nucleiReport(): Fixture {
  const lines = nucleiHits.map((h, i) => {
    const url = h.host + (h.path.startsWith(':') ? '' : h.path)
    const host = new URL(h.host).host
    const request = `GET ${h.path.startsWith(':') ? '/' : h.path} HTTP/1.1\r\nHost: ${host}\r\nUser-Agent: Mozilla/5.0 (compatible; OpenCTEM demo)\r\nAccept: */*\r\nConnection: close\r\n\r\n`
    const response = `HTTP/1.1 ${h.status} ${h.status === 200 ? 'OK' : 'Found'}\r\nServer: nginx\r\nDate: ${new Date(Date.now() - 7200e3).toUTCString()}\r\n${h.respHeaders}\r\n\r\n${h.respBody}`
    return JSON.stringify({
      'template-id': h.id,
      'template-path': `http/${h.tags[0]}/${h.id}.yaml`,
      info: {
        name: h.name,
        author: ['projectdiscovery'],
        tags: h.tags,
        description: h.description,
        severity: h.severity,
        remediation: h.remediation,
        classification: h.cve || h.cwe ? { 'cve-id': h.cve ? [h.cve.toLowerCase()] : null, 'cwe-id': h.cwe ? [h.cwe.toLowerCase()] : null, 'cvss-score': h.cvss } : undefined,
      },
      type: 'http',
      host,
      'matched-at': url,
      url,
      ip: h.ip,
      scheme: 'https',
      port: '443',
      'matcher-name': h.matcher,
      'matcher-status': true,
      'extracted-results': h.extracted,
      request,
      response,
      'curl-command': `curl -X 'GET' -H 'Host: ${host}' '${url}'`,
      timestamp: new Date(Date.now() - (7200 - i * 30) * 1000).toISOString(),
    })
  })
  return { name: 'example-corp-web.jsonl', type: 'application/x-ndjson', body: lines.join('\n') + '\n' }
}

// ---------------------------------------------------------------------------
// Code: SAST (SARIF) and dependencies, secrets and IaC (trivy file-system scan)
// ---------------------------------------------------------------------------

interface SastHit {
  rule: string
  name: string
  level: 'error' | 'warning' | 'note'
  sev: string
  cwe: string
  path: string
  line: number
  snippet: string
  message: string
}

export function sarifReport(repo: string, hits: SastHit[], commit: string): Fixture {
  const rules = hits.map((h) => ({
    id: h.rule,
    name: h.name,
    shortDescription: { text: h.name },
    fullDescription: { text: h.message },
    defaultConfiguration: { level: h.level },
    properties: { tags: ['security', h.cwe], 'security-severity': { critical: '9.5', high: '8.0', medium: '5.5', low: '3.0' }[h.sev] },
  }))
  const results = hits.map((h) => ({
    ruleId: h.rule,
    level: h.level,
    message: { text: h.message },
    locations: [{ physicalLocation: { artifactLocation: { uri: h.path }, region: { startLine: h.line, endLine: h.line, snippet: { text: h.snippet } } } }],
  }))
  return {
    name: `${repo.split('/').pop()}-semgrep.sarif`,
    type: 'application/json',
    body: JSON.stringify(
      {
        version: '2.1.0',
        $schema: 'https://json.schemastore.org/sarif-2.1.0.json',
        runs: [
          {
            tool: { driver: { name: 'semgrep', version: '1.85.0', rules } },
            versionControlProvenance: [{ repositoryUri: `https://${repo}`, branch: 'main', revisionId: commit }],
            results,
          },
        ],
      },
      null,
      1
    ),
  }
}

export const webAppSast: SastHit[] = [
  { rule: 'javascript.express.security.injection.tainted-sql-string', name: 'Tainted SQL string', level: 'error', sev: 'high', cwe: 'CWE-89', path: 'src/routes/orders.ts', line: 57, snippet: 'db.query(`SELECT * FROM orders WHERE customer_id = ${req.query.customer}`)', message: 'User input from req.query flows into a SQL string. Use a parameterised query.' },
  { rule: 'javascript.react.security.audit.react-dangerouslysetinnerhtml', name: 'dangerouslySetInnerHTML with user content', level: 'warning', sev: 'medium', cwe: 'CWE-79', path: 'src/components/ReviewBody.tsx', line: 22, snippet: '<div dangerouslySetInnerHTML={{ __html: review.body }} />', message: 'Rendering user-controlled HTML can lead to cross-site scripting.' },
  { rule: 'javascript.lang.security.audit.insecure-random', name: 'Insecure randomness for a token', level: 'note', sev: 'low', cwe: 'CWE-330', path: 'src/lib/reset-token.ts', line: 9, snippet: 'const token = Math.random().toString(36).slice(2)', message: 'Math.random() is not a cryptographically secure source. Use crypto.randomBytes.' },
  { rule: 'javascript.jsonwebtoken.security.jwt-none-alg', name: 'JWT verification accepts the none algorithm', level: 'error', sev: 'high', cwe: 'CWE-347', path: 'src/middleware/auth.ts', line: 31, snippet: "jwt.verify(token, key, { algorithms: ['HS256', 'none'] })", message: "Accepting the 'none' algorithm lets a client forge tokens." },
]

export const paymentsSast: SastHit[] = [
  { rule: 'go.lang.security.audit.crypto.math_random', name: 'math/rand used for a security value', level: 'warning', sev: 'medium', cwe: 'CWE-338', path: 'internal/payments/nonce.go', line: 18, snippet: 'nonce := rand.Int63()', message: 'Use crypto/rand for nonces.' },
  { rule: 'go.lang.security.audit.net.use-tls', name: 'HTTP server without TLS', level: 'note', sev: 'low', cwe: 'CWE-319', path: 'cmd/payments/main.go', line: 44, snippet: 'http.ListenAndServe(":8080", mux)', message: 'The service listens without TLS. Terminate TLS in the service or document the trusted proxy.' },
]

interface Pkg {
  name: string
  version: string
  license: string
  direct?: boolean
}
interface Vuln {
  id: string
  pkg: string
  installed: string
  fixed: string
  sev: string
  title: string
  score: number
  cwe?: string
}
interface Misconf {
  id: string
  title: string
  sev: string
  file: string
  resource: string
  line: number
  message: string
  resolution: string
}
interface Secret {
  rule: string
  title: string
  sev: string
  file: string
  line: number
  match: string
}

export function trivyReport(
  repo: string,
  lockfile: { target: string; type: string; packages: Pkg[]; vulns: Vuln[] } | null,
  misconf: { target: string; type: string; items: Misconf[] }[],
  secrets: { target: string; items: Secret[] }[]
): Fixture {
  const purlType = lockfile?.type === 'gomod' ? 'golang' : lockfile?.type === 'pip' ? 'pypi' : 'npm'
  const results: any[] = []
  if (lockfile) {
    results.push({
      Target: lockfile.target,
      Class: 'lang-pkgs',
      Type: lockfile.type,
      Packages: lockfile.packages.map((p) => ({
        ID: `${p.name}@${p.version}`,
        Name: p.name,
        Version: p.version,
        Identifier: { PURL: `pkg:${purlType}/${p.name}@${p.version}` },
        Licenses: [p.license],
        Relationship: p.direct === false ? 'indirect' : 'direct',
      })),
      Vulnerabilities: lockfile.vulns.map((v) => ({
        VulnerabilityID: v.id,
        PkgID: `${v.pkg}@${v.installed}`,
        PkgName: v.pkg,
        PkgIdentifier: { PURL: `pkg:${purlType}/${v.pkg}@${v.installed}` },
        InstalledVersion: v.installed,
        FixedVersion: v.fixed,
        Status: 'fixed',
        Severity: v.sev.toUpperCase(),
        Title: v.title,
        Description: v.title,
        PrimaryURL: `https://avd.aquasec.com/nvd/${v.id.toLowerCase()}`,
        CweIDs: v.cwe ? [v.cwe] : undefined,
        CVSS: { nvd: { V3Score: v.score } },
      })),
    })
  }
  for (const m of misconf) {
    results.push({
      Target: m.target,
      Class: 'config',
      Type: m.type,
      Misconfigurations: m.items.map((i) => ({
        Type: m.type === 'terraform' ? 'Terraform Security Check' : 'Dockerfile Security Check',
        ID: i.id,
        AVDID: i.id,
        Title: i.title,
        Description: i.title,
        Message: i.message,
        Resolution: i.resolution,
        Severity: i.sev.toUpperCase(),
        PrimaryURL: `https://avd.aquasec.com/misconfig/${i.id.toLowerCase()}`,
        Status: 'FAIL',
        CauseMetadata: { Resource: i.resource, Provider: m.type === 'terraform' ? 'AWS' : 'Dockerfile', Service: m.type === 'terraform' ? 's3' : 'general', StartLine: i.line, EndLine: i.line + 2 },
      })),
    })
  }
  for (const s of secrets) {
    results.push({
      Target: s.target,
      Class: 'secret',
      Secrets: s.items.map((i) => ({ RuleID: i.rule, Category: i.rule.split('-')[0].toUpperCase(), Severity: i.sev.toUpperCase(), Title: i.title, StartLine: i.line, EndLine: i.line, Match: i.match })),
    })
  }
  return {
    name: `${repo.split('/').pop()}-trivy.json`,
    type: 'application/json',
    body: JSON.stringify({ SchemaVersion: 2, CreatedAt: iso(0), ArtifactName: repo, ArtifactType: 'repository', Results: results }, null, 1),
  }
}

export const webAppDeps = {
  target: 'package-lock.json',
  type: 'npm',
  packages: [
    { name: 'express', version: '4.17.1', license: 'MIT' },
    { name: 'lodash', version: '4.17.20', license: 'MIT' },
    { name: 'axios', version: '0.21.1', license: 'MIT' },
    { name: 'jsonwebtoken', version: '8.5.1', license: 'MIT' },
    { name: 'react', version: '18.2.0', license: 'MIT' },
    { name: 'react-dom', version: '18.2.0', license: 'MIT' },
    { name: 'next', version: '14.1.0', license: 'MIT' },
    { name: 'semver', version: '7.5.1', license: 'ISC', direct: false },
    { name: 'follow-redirects', version: '1.15.2', license: 'MIT', direct: false },
    { name: 'pg', version: '8.11.3', license: 'MIT' },
    { name: 'zod', version: '3.22.4', license: 'MIT' },
    { name: 'tough-cookie', version: '4.1.2', license: 'BSD-3-Clause', direct: false },
  ],
  vulns: [
    { id: 'CVE-2021-23337', pkg: 'lodash', installed: '4.17.20', fixed: '4.17.21', sev: 'high', title: 'lodash: command injection via template', score: 7.2, cwe: 'CWE-94' },
    { id: 'CVE-2021-3749', pkg: 'axios', installed: '0.21.1', fixed: '0.21.2', sev: 'high', title: 'axios: Regular expression denial of service in trim function', score: 7.5, cwe: 'CWE-1333' },
    { id: 'CVE-2022-23529', pkg: 'jsonwebtoken', installed: '8.5.1', fixed: '9.0.0', sev: 'high', title: 'jsonwebtoken: insecure input validation in jwt.verify', score: 7.6, cwe: 'CWE-20' },
    { id: 'CVE-2024-34351', pkg: 'next', installed: '14.1.0', fixed: '14.1.1', sev: 'high', title: 'next.js: server-side request forgery in Server Actions', score: 7.5, cwe: 'CWE-918' },
    { id: 'CVE-2022-25883', pkg: 'semver', installed: '7.5.1', fixed: '7.5.2', sev: 'medium', title: 'semver: regular expression denial of service', score: 5.3, cwe: 'CWE-1333' },
    { id: 'CVE-2023-26136', pkg: 'tough-cookie', installed: '4.1.2', fixed: '4.1.3', sev: 'medium', title: 'tough-cookie: prototype pollution in cookie memstore', score: 6.5, cwe: 'CWE-1321' },
    { id: 'CVE-2024-28849', pkg: 'follow-redirects', installed: '1.15.2', fixed: '1.15.6', sev: 'medium', title: 'follow-redirects: Proxy-Authorization header kept across hosts', score: 6.5, cwe: 'CWE-200' },
  ],
}

export const paymentsDeps = {
  target: 'go.mod',
  type: 'gomod',
  packages: [
    { name: 'golang.org/x/net', version: '0.17.0', license: 'BSD-3-Clause' },
    { name: 'golang.org/x/crypto', version: '0.14.0', license: 'BSD-3-Clause' },
    { name: 'github.com/go-chi/chi/v5', version: '5.0.10', license: 'MIT' },
    { name: 'github.com/jackc/pgx/v5', version: '5.4.3', license: 'MIT' },
    { name: 'google.golang.org/grpc', version: '1.58.2', license: 'Apache-2.0' },
  ],
  vulns: [
    { id: 'CVE-2023-48795', pkg: 'golang.org/x/crypto', installed: '0.14.0', fixed: '0.17.0', sev: 'medium', title: 'ssh: prefix truncation attack on Binary Packet Protocol (Terrapin)', score: 5.9, cwe: 'CWE-354' },
    { id: 'CVE-2023-45288', pkg: 'golang.org/x/net', installed: '0.17.0', fixed: '0.23.0', sev: 'medium', title: 'net/http: unlimited CONTINUATION frames cause denial of service', score: 5.3, cwe: 'CWE-400' },
    { id: 'CVE-2023-44487', pkg: 'google.golang.org/grpc', installed: '1.58.2', fixed: '1.58.3', sev: 'high', title: 'HTTP/2 rapid reset can cause excessive work in a server', score: 7.5, cwe: 'CWE-400' },
  ],
}

export const infraMisconf = [
  {
    target: 'aws/storage.tf',
    type: 'terraform',
    items: [
      { id: 'AVD-AWS-0086', title: 'S3 Access block should block public ACL', sev: 'high', file: 'aws/storage.tf', resource: 'aws_s3_bucket.exports', line: 12, message: 'No public access block so not blocking public ACLs', resolution: 'Enable blocking any PUT calls with a public ACL specified' },
      { id: 'AVD-AWS-0088', title: 'Unencrypted S3 bucket', sev: 'high', file: 'aws/storage.tf', resource: 'aws_s3_bucket.exports', line: 12, message: 'Bucket does not have encryption enabled', resolution: 'Configure bucket encryption' },
      { id: 'AVD-AWS-0090', title: 'S3 Data should be versioned', sev: 'medium', file: 'aws/storage.tf', resource: 'aws_s3_bucket.exports', line: 12, message: 'Bucket does not have versioning enabled', resolution: 'Enable versioning to protect against accidental or malicious removal' },
    ],
  },
  {
    target: 'aws/network.tf',
    type: 'terraform',
    items: [
      { id: 'AVD-AWS-0107', title: 'An ingress security group rule allows traffic from /0', sev: 'critical', file: 'aws/network.tf', resource: 'aws_security_group.bastion', line: 33, message: 'Security group rule allows ingress from public internet on port 22', resolution: 'Set a more restrictive cidr range' },
    ],
  },
  {
    target: 'docker/Dockerfile',
    type: 'dockerfile',
    items: [
      { id: 'AVD-DS-0002', title: 'Image user should not be root', sev: 'high', file: 'docker/Dockerfile', resource: 'Dockerfile', line: 1, message: "Specify at least 1 USER command in Dockerfile with non-root user as argument", resolution: "Add 'USER <non root user name>' line to the Dockerfile" },
    ],
  },
]

export const paymentsSecrets = [
  {
    target: 'deploy/staging.env',
    items: [
      { rule: 'aws-access-key-id', title: 'AWS Access Key ID', sev: 'critical', file: 'deploy/staging.env', line: 4, match: 'AWS_ACCESS_KEY_ID=AKIA****************' },
    ],
  },
  {
    target: 'scripts/notify.sh',
    items: [{ rule: 'slack-webhook-url', title: 'Slack Webhook', sev: 'medium', file: 'scripts/notify.sh', line: 7, match: 'WEBHOOK=https://hooks.slack.com/services/T0000/B0000/****************' }],
  },
]

export const webAppSecrets = [
  {
    target: 'src/config/test-keys.ts',
    items: [{ rule: 'jwt-token', title: 'JWT token', sev: 'medium', file: 'src/config/test-keys.ts', line: 3, match: 'export const TEST_JWT = "eyJhbGciOi****************"' }],
  },
]

export const COMMITS = {
  'github.com/example-corp/web-app': '4f9c2d1e8b7a6c5d4e3f2a1b0c9d8e7f6a5b4c3d',
  'github.com/example-corp/payments-api': 'a1b2c3d4e5f60718293a4b5c6d7e8f9012345678',
}
