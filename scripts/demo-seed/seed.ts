// Fills a scratch OpenCTEM stack with the synthetic organization
// "Example Corp" for the documentation screenshots. See README.md.
//
//   OWNER_SETUP_TOKEN=<token> ADMIN_TEMP_PASSWORD=<password> npx tsx demo-seed/seed.ts
//
// Most data goes through the API, as a user would create it. What has no API,
// or would need a real sensor, CI provider or DNS record (scan run results,
// sensor heartbeats, CI runs, domain proof, history for the trend charts), is
// in sql/, applied through psql (DEMO_PSQL).

import { spawn, spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { adminSignIn, ApiError, call, DEMO_PASSWORD, freshCode, HERE, loadState, saveState, signIn, type Session } from './lib.ts'
import * as fx from './fixtures.ts'

const st = loadState()
const log = (...a: unknown[]) => console.log('[seed]', ...a)

// Runs one step; a 409 (already exists) is fine, so the seed can be re-run.
async function step<T>(name: string, fn: () => Promise<T>): Promise<T | undefined> {
  try {
    const r = await fn()
    log('ok  ', name)
    return r
  } catch (e) {
    if (e instanceof ApiError && e.status === 409) {
      log('skip', name, '(exists)')
      return undefined
    }
    log('FAIL', name, (e as Error).message)
    if (process.env.STRICT) throw e
    return undefined
  }
}

// Applies one file of sql/ with psql. DEMO_PSQL is the psql command line of
// the scratch database (default: the openctem-demo-pg container).
function sql(file: string) {
  const cmd = (process.env.DEMO_PSQL ?? 'docker exec -i openctem-demo-pg psql -U openctem -d openctem').split(' ')
  const r = spawnSync(cmd[0], [...cmd.slice(1), '-v', 'ON_ERROR_STOP=1', '-q'], { input: readFileSync(join(HERE, 'sql', file)), encoding: 'utf8' })
  if (r.status !== 0) throw new Error(`${file}: ${r.stderr || r.stdout}`)
  log('sql ', file, (r.stdout || '').trim().replace(/\n/g, ' '))
}

function sqlText(text: string) {
  const cmd = (process.env.DEMO_PSQL ?? 'docker exec -i openctem-demo-pg psql -U openctem -d openctem').split(' ')
  const r = spawnSync(cmd[0], [...cmd.slice(1), '-v', 'ON_ERROR_STOP=1', '-q', '-At'], { input: text, encoding: 'utf8' })
  if (r.status !== 0) throw new Error(`${text}: ${r.stderr || r.stdout}`)
  return (r.stdout || '').trim()
}

async function list(s: Session, path: string): Promise<any[]> {
  const r: any = await call('GET', path, undefined, s.accessToken)
  return r?.data ?? r?.items ?? r?.assets ?? r?.findings ?? (Array.isArray(r) ? r : [])
}

// ---------------------------------------------------------------------------
// Owner account: set the password from the bootstrap-admin link, sign in.
// ---------------------------------------------------------------------------
if (process.env.OWNER_SETUP_TOKEN) {
  await step('owner password', () =>
    call('POST', '/api/v1/auth/reset-password', { token: process.env.OWNER_SETUP_TOKEN, new_password: DEMO_PASSWORD })
  )
}
const alex = await signIn(st, 'alex@example.com')
const T = alex.accessToken
const api = <R = any>(method: string, path: string, body?: unknown) => call<R>(method, path, body, T)
log('signed in as alex@example.com, organization', alex.tenantId)

// ---------------------------------------------------------------------------
// Members
// ---------------------------------------------------------------------------
const ROLE = { admin: '00000000-0000-0000-0000-000000000002', member: '00000000-0000-0000-0000-000000000003', viewer: '00000000-0000-0000-0000-000000000004' }
const people = [
  { email: 'sam@example.com', name: 'Sam Lee', role: ROLE.member },
  { email: 'riley@example.com', name: 'Riley Chen', role: ROLE.viewer },
  { email: 'jordan@example.com', name: 'Jordan Patel', role: ROLE.admin },
  { email: 'casey@example.com', name: 'Casey Kim', role: ROLE.member },
]
for (const p of people) {
  const r: any = await step(`member ${p.email}`, () =>
    api('POST', `/api/v1/tenants/${alex.tenantId}/users`, { email: p.email, name: p.name, role_ids: [p.role] })
  )
  if (r?.user?.id) st.ids[p.email.split('@')[0]] = r.user.id
  if (r?.setup_token) {
    // Activate the account so it shows as a real member.
    await step(`password ${p.email}`, () =>
      call('POST', '/api/v1/auth/reset-password', { token: r.setup_token, new_password: DEMO_PASSWORD })
    )
  }
}
st.ids.alex = alex.userId
await step('invitation taylor@example.com', () =>
  api('POST', `/api/v1/tenants/${alex.tenantId}/invitations`, { email: 'taylor@example.com', role_ids: [ROLE.member] })
)
saveState(st)

// ---------------------------------------------------------------------------
// Scope: what Example Corp owns and may scan
// ---------------------------------------------------------------------------
const targets = [
  { pattern: '*.example.com', target_type: 'domain', description: 'Corporate domain and every subdomain' },
  { pattern: '*.example.org', target_type: 'domain', description: 'Online shop' },
  { pattern: '*.example.net', target_type: 'domain', description: 'Remote access and legacy services' },
  { pattern: '203.0.113.0/24', target_type: 'cidr', description: 'Primary data center, public range' },
  { pattern: '198.51.100.0/24', target_type: 'cidr', description: 'Secondary site, public range' },
  { pattern: '192.0.2.0/24', target_type: 'cidr', description: 'Internal build and database network' },
  { pattern: 'github.com/example-corp/*', target_type: 'repository', description: 'All repositories of the GitHub organization' },
  { pattern: 'AWS:123456789012', target_type: 'cloud_account', description: 'AWS production account' },
]
for (const t of targets) await step(`scope ${t.pattern}`, () => api('POST', '/api/v1/scope/targets', { ...t, tags: ['demo'] }))
await step('scope exclusion', () =>
  api('POST', '/api/v1/scope/exclusions', { exclusion_type: 'domain', pattern: 'partners.example.com', reason: 'Hosted by a partner; not ours to test.' })
)
// Widening the scope needs a second administrator's approval: Jordan approves
// all but the AWS account, which stays pending to show the approval state.
const jordan = await signIn(st, 'jordan@example.com')
await call('POST', '/api/v1/auth/step-up', { totp: await freshCode(st, 'jordan@example.com') }, jordan.accessToken)
for (const t of await list(jordan, '/api/v1/scope/targets?per_page=100')) {
  if (t.status !== 'pending' || t.target_type === 'cloud_account') continue
  await step(`approve scope ${t.pattern}`, () => call('POST', `/api/v1/scope/targets/${t.id}/approve`, {}, jordan.accessToken))
}
for (const d of ['example.com', 'example.org', 'example.net'])
  await step(`domain proof ${d}`, () => api('POST', '/api/v1/easm/verified-domains', { domain: d }))

// ---------------------------------------------------------------------------
// Assets that no scan file below creates
// ---------------------------------------------------------------------------
const assets: { name: string; type: string; criticality: string; exposure?: string; description?: string; tags?: string[]; properties?: object }[] = [
  { name: 'example.com', type: 'domain', criticality: 'critical', exposure: 'public', tags: ['brand'] },
  { name: 'example.org', type: 'domain', criticality: 'high', exposure: 'public', tags: ['shop'] },
  { name: 'example.net', type: 'domain', criticality: 'medium', exposure: 'public' },
  { name: 'www.example.com', type: 'subdomain', criticality: 'high', exposure: 'public' },
  { name: 'app.example.com', type: 'subdomain', criticality: 'critical', exposure: 'public', tags: ['customer-facing'] },
  { name: 'api.example.com', type: 'subdomain', criticality: 'critical', exposure: 'public', tags: ['customer-facing'] },
  { name: 'auth.example.com', type: 'subdomain', criticality: 'critical', exposure: 'public' },
  { name: 'staging.example.com', type: 'subdomain', criticality: 'medium', exposure: 'public', tags: ['staging'] },
  { name: 'mail.example.com', type: 'subdomain', criticality: 'high', exposure: 'public' },
  { name: 'status.example.org', type: 'subdomain', criticality: 'low', exposure: 'public' },
  { name: 'shop.example.org', type: 'subdomain', criticality: 'critical', exposure: 'public', tags: ['pci'] },
  { name: 'vpn.example.net', type: 'subdomain', criticality: 'critical', exposure: 'public' },
  { name: 'legacy.example.net', type: 'subdomain', criticality: 'medium', exposure: 'public', tags: ['end-of-life'] },
  { name: 'https://app.example.com', type: 'website', criticality: 'critical', exposure: 'public', description: 'Customer portal' },
  { name: 'https://shop.example.org', type: 'website', criticality: 'critical', exposure: 'public', description: 'Online shop' },
  { name: 'https://api.example.com', type: 'api', criticality: 'critical', exposure: 'public', description: 'Public REST and GraphQL API' },
  { name: 'customer-portal', type: 'application', criticality: 'critical', exposure: 'public', description: 'Web application behind app.example.com' },
  { name: 'aws:123456789012', type: 'cloud_account', criticality: 'critical', exposure: 'restricted', properties: { provider: 'aws', account_id: '123456789012', region: 'eu-west-1' } },
  { name: 'arn:aws:s3:::example-corp-exports', type: 'storage', criticality: 'high', exposure: 'public', properties: { provider: 'aws', region: 'eu-west-1' } },
  { name: 'arn:aws:iam::123456789012:role/ci-deploy', type: 'iam_role', criticality: 'high', exposure: 'private' },
  { name: 'i-0abc123def4567890', type: 'compute', criticality: 'medium', exposure: 'private', description: 'Bastion host', properties: { provider: 'aws', region: 'eu-west-1', instance_type: 't3.small' } },
  { name: 'payments-db', type: 'database', criticality: 'critical', exposure: 'private', properties: { provider: 'aws', engine: 'postgres', version: '15.4' } },
  { name: 'registry.example.com/web-app:2.14.0', type: 'container', criticality: 'high', exposure: 'private' },
]
for (const a of assets) await step(`asset ${a.name}`, () => api('POST', '/api/v1/assets', a))

// ---------------------------------------------------------------------------
// Scan results imported from tool exports (assets, services, findings,
// evidence, components)
// ---------------------------------------------------------------------------
async function importFile(f: fx.Fixture, format?: string) {
  const fd = new FormData()
  fd.append('file', new Blob([f.body], { type: f.type }), f.name)
  const q = format ? `?format=${format}` : ''
  const r: any = await api('POST', `/api/v1/findings/import${q}`, fd)
  for (const file of r.files ?? []) log('     ', file.name, file.format, JSON.stringify(file.ingest ?? file.error ?? {}))
}
if (process.env.SKIP_IMPORTS !== '1') {
  await step('import nessus', () => importFile(fx.nessusReport()))
  await step('import nuclei', () => importFile(fx.nucleiReport(), 'nuclei'))
  await step('import web-app sarif', () =>
    importFile(fx.sarifReport('github.com/example-corp/web-app', fx.webAppSast, fx.COMMITS['github.com/example-corp/web-app']), 'sarif')
  )
  await step('import payments-api sarif', () =>
    importFile(fx.sarifReport('github.com/example-corp/payments-api', fx.paymentsSast, fx.COMMITS['github.com/example-corp/payments-api']), 'sarif')
  )
  await step('import web-app trivy', () =>
    importFile(fx.trivyReport('github.com/example-corp/web-app', fx.webAppDeps, [], fx.webAppSecrets), 'trivy')
  )
  await step('import payments-api trivy', () =>
    importFile(fx.trivyReport('github.com/example-corp/payments-api', fx.paymentsDeps, [], fx.paymentsSecrets), 'trivy')
  )
  await step('import infra-terraform trivy', () =>
    importFile(fx.trivyReport('github.com/example-corp/infra-terraform', null, fx.infraMisconf, []), 'trivy')
  )
}

saveState(st)

// ---------------------------------------------------------------------------
// Inventory context: groups, relationships, owners, crown jewels
// ---------------------------------------------------------------------------
const allAssets = await list(alex, '/api/v1/assets?per_page=200')
const A = (name: string): string | undefined => allAssets.find((a: any) => a.name === name.toLowerCase())?.id
const ids = (...names: string[]) => names.map(A).filter(Boolean) as string[]

const groups = [
  { name: 'Customer-facing web', environment: 'production', criticality: 'critical', description: 'Everything a customer reaches from the internet', tags: ['pci'], existing_asset_ids: ids('app.example.com', 'api.example.com', 'shop.example.org', 'https://app.example.com', 'https://api.example.com', 'https://shop.example.org', 'customer-portal', 'auth.example.com') },
  { name: 'Perimeter network', environment: 'production', criticality: 'high', description: 'Public address ranges of both sites', existing_asset_ids: ids('203.0.113.10', '203.0.113.11', '203.0.113.20', '198.51.100.15', '198.51.100.30', '198.51.100.44', 'vpn.example.net', 'mail.example.com') },
  { name: 'Source code', environment: 'production', criticality: 'high', description: 'Repositories of the GitHub organization', existing_asset_ids: ids('github.com/example-corp/web-app', 'github.com/example-corp/payments-api', 'github.com/example-corp/infra-terraform') },
  { name: 'AWS production', environment: 'production', criticality: 'critical', description: 'Production cloud account and its resources', existing_asset_ids: ids('aws:123456789012', 'arn:aws:s3:::example-corp-exports', 'arn:aws:iam::123456789012:role/ci-deploy', 'i-0abc123def4567890', 'payments-db') },
  { name: 'Staging', environment: 'staging', criticality: 'medium', description: 'Pre-production systems', existing_asset_ids: ids('staging.example.com', '203.0.113.30') },
  { name: 'Legacy systems', environment: 'production', criticality: 'medium', description: 'End-of-life services scheduled for decommissioning', existing_asset_ids: ids('legacy.example.net', '198.51.100.44', 'build.example.com') },
]
for (const g of groups) {
  const r: any = await step(`group ${g.name}`, () => api('POST', '/api/v1/asset-groups', { ...g, owner: 'Alex Morgan', owner_email: 'alex@example.com' }))
  if (r?.id) st.ids[`group:${g.name}`] = r.id
}

const rels: [string, string, string][] = [
  ['example.com', 'contains', 'www.example.com'],
  ['example.com', 'contains', 'app.example.com'],
  ['example.com', 'contains', 'api.example.com'],
  ['example.com', 'contains', 'auth.example.com'],
  ['example.com', 'contains', 'staging.example.com'],
  ['example.com', 'contains', 'mail.example.com'],
  ['example.org', 'contains', 'shop.example.org'],
  ['example.org', 'contains', 'status.example.org'],
  ['example.net', 'contains', 'vpn.example.net'],
  ['example.net', 'contains', 'legacy.example.net'],
  ['www.example.com', 'resolves_to', '203.0.113.10'],
  ['app.example.com', 'resolves_to', '203.0.113.10'],
  ['api.example.com', 'resolves_to', '203.0.113.11'],
  ['mail.example.com', 'resolves_to', '203.0.113.20'],
  ['vpn.example.net', 'resolves_to', '198.51.100.15'],
  ['shop.example.org', 'resolves_to', '198.51.100.30'],
  ['legacy.example.net', 'resolves_to', '198.51.100.44'],
  ['staging.example.com', 'resolves_to', '203.0.113.30'],
  ['customer-portal', 'depends_on', 'https://api.example.com'],
  ['https://api.example.com', 'stores_data_in', 'payments-db'],
  ['github.com/example-corp/web-app', 'deployed_to', 'aws:123456789012'],
  ['github.com/example-corp/payments-api', 'deployed_to', 'aws:123456789012'],
  ['github.com/example-corp/web-app', 'deployed_to', 'build.example.com'],
  ['aws:123456789012', 'contains', 'arn:aws:s3:::example-corp-exports'],
  ['aws:123456789012', 'contains', 'i-0abc123def4567890'],
  ['aws:123456789012', 'contains', 'payments-db'],
  ['arn:aws:iam::123456789012:role/ci-deploy', 'has_access_to', 'aws:123456789012'],
]
for (const [src, type, dst] of rels) {
  const s = A(src)
  const d = A(dst)
  if (!s || !d) {
    log('skip', `relationship ${src} ${type} ${dst} (asset missing)`)
    continue
  }
  await step(`rel ${src} ${type} ${dst}`, () =>
    api('POST', `/api/v1/assets/${s}/relationships`, { type, source_asset_id: s, target_asset_id: d, confidence: 'high', discovery_method: 'manual' })
  )
}
for (const n of ['customer-portal', 'payments-db', 'shop.example.org', 'aws:123456789012'])
  if (A(n)) await step(`crown jewel ${n}`, () => api('PATCH', `/api/v1/assets/${A(n)}/crown-jewel`, { is_crown_jewel: true }))

// ---------------------------------------------------------------------------
// Findings through their lifecycle: triage, assignment, comments, approvals
// ---------------------------------------------------------------------------
const findings = await list(alex, '/api/v1/findings?per_page=200')
const F = (title: string) => findings.find((f: any) => (f.title ?? f.message ?? '').startsWith(title))?.id
const setStatus = (title: string, status: string, resolution?: string) => {
  const id = F(title)
  return id ? step(`status ${status}: ${title}`, () => api('PATCH', `/api/v1/findings/${id}/status`, { status, resolution })) : undefined
}
const assign = (title: string, uid?: string) => {
  const id = F(title)
  return id && uid ? step(`assign ${title}`, () => api('POST', `/api/v1/findings/${id}/assign`, { user_id: uid })) : undefined
}
const comment = (title: string, content: string) => {
  const id = F(title)
  return id ? step(`comment ${title}`, () => api('POST', `/api/v1/findings/${id}/comments`, { content })) : undefined
}

for (const t of [
  'Fortinet FortiOS SSL-VPN',
  'Apache Log4j2',
  'Jenkins < 2.442',
  'OpenSSH < 9.3p2',
  'MS17-010',
  'Tainted SQL string',
  'AWS Access Key ID',
  'An ingress security group rule',
  'nginx < 1.20.1',
  'lodash: command injection',
  'Git Configuration - Detect',
  'Open Redirect',
])
  await setStatus(t, 'confirmed')
for (const t of ['Fortinet FortiOS SSL-VPN', 'Jenkins < 2.442', 'Tainted SQL string', 'AWS Access Key ID', 'lodash: command injection'])
  await setStatus(t, 'in_progress')
await setStatus('Git Configuration - Detect', 'in_progress')
await setStatus('Git Configuration - Detect', 'fix_applied', 'Blocked /.git/ in the nginx configuration of staging and redeployed.')

await assign('Fortinet FortiOS SSL-VPN', st.ids.jordan)
await assign('Jenkins < 2.442', st.ids.casey)
await assign('Tainted SQL string', st.ids.sam)
await assign('AWS Access Key ID', st.ids.sam)
await assign('lodash: command injection', st.ids.sam)
await assign('Apache Log4j2', st.ids.casey)
await assign('Git Configuration - Detect', st.ids.casey)
await assign('MS17-010', st.ids.alex)
await assign('OpenSSH < 9.3p2', st.ids.alex)
await assign('nginx < 1.20.1', st.ids.alex)
await comment('Fortinet FortiOS SSL-VPN', 'Vendor fix 7.0.12 is approved. Upgrade scheduled for the Thursday maintenance window; the SSL-VPN portal is limited to the corporate IdP until then.')
await comment('AWS Access Key ID', 'Key deactivated in IAM. Rotating the CI credentials now and purging the file from the history.')
await comment('Apache Log4j2', 'Confirmed with an out-of-band DNS callback. legacy.example.net is due for decommissioning; isolating it behind the VPN this week.')
await comment('Tainted SQL string', 'Fix in review: the query now uses a parameterised statement.')

// Risk acceptance and false positive go through approval.
const approval = async (title: string, status: string, justification: string) => {
  const id = F(title)
  if (!id) return
  await step(`approval ${status}: ${title}`, () =>
    api('POST', `/api/v1/findings/${id}/approvals`, { requested_status: status, justification, expires_at: new Date(Date.now() + 90 * 86400e3).toISOString() })
  )
}
await approval('TLS Version 1.0 Protocol Detection', 'accepted', 'A legacy payment terminal still needs TLS 1.0; it is isolated and will be replaced in Q1.')
await approval('GraphQL Introspection Enabled', 'false_positive', 'Introspection is only enabled for the public schema subset by design.')

// ---------------------------------------------------------------------------
// Remediation campaign
// ---------------------------------------------------------------------------
await step('campaign', async () => {
  const c: any = await api('POST', '/api/v1/remediation/campaigns', {
    name: 'Patch internet-facing critical vulnerabilities',
    description: 'Close every critical vulnerability on internet-facing assets within the 15-day SLA.',
    priority: 'critical',
    finding_filter: { severities: ['critical'], exposure: 'public' },
    assigned_to: st.ids.jordan,
    start_date: new Date(Date.now() - 6 * 86400e3).toISOString(),
    due_date: new Date(Date.now() + 9 * 86400e3).toISOString(),
    tags: ['q4', 'perimeter'],
  })
  st.ids.campaign = c.id
  await api('PATCH', `/api/v1/remediation/campaigns/${c.id}/status`, { status: 'active' }).catch((e) => log('     campaign status', e.message))
  await api('POST', `/api/v1/remediation/campaigns/${c.id}/refresh`).catch((e) => log('     campaign refresh', e.message))
})
await step('campaign 2', () =>
  api('POST', '/api/v1/remediation/campaigns', {
    name: 'Upgrade vulnerable npm dependencies',
    description: 'Bring lodash, axios, jsonwebtoken and next up to fixed versions in web-app.',
    priority: 'high',
    finding_filter: { sources: ['sca'] },
    assigned_to: st.ids.sam,
    start_date: new Date(Date.now() - 2 * 86400e3).toISOString(),
    due_date: new Date(Date.now() + 21 * 86400e3).toISOString(),
    tags: ['dependencies'],
  })
)

// ---------------------------------------------------------------------------
// Scanning: scan zone, sensors, scan workflows, scans and their runs
// ---------------------------------------------------------------------------
const zone: any = await step('scan zone', () =>
  api('POST', '/api/v1/scan-zones', { name: 'Internal network', description: 'Build and database network; only sensors inside it reach these addresses', ranges: ['192.0.2.0/24'] })
)
if (zone?.id) st.ids.zone = zone.id
// Sensors pair with their own key (no API key). The real sensor image runs
// only its `pair` command, which exits once approved: it never scans.
async function pairSensor(name: string, profile: string) {
  const image = process.env.SENSOR_IMAGE ?? 'ghcr.io/openctemio/sensor:v0.11.0'
  const apiUrl = process.env.SENSOR_API_URL ?? 'http://127.0.0.1:18980'
  const proc = spawn('docker', ['run', '--rm', '--name', `openctem-demo-pair-${name}`, '--network', 'host', '--hostname', name, image, 'pair', '-api-url', apiUrl, '-name', name, '-state-dir', '/tmp/state'])
  let out = ''
  proc.stdout.on('data', (d) => (out += d))
  proc.stderr.on('data', (d) => (out += d))
  const done = new Promise((r) => proc.on('exit', r))
  let code = ''
  for (let i = 0; i < 60 && !code; i++) {
    await new Promise((r) => setTimeout(r, 1000))
    code = /Code:\s+([A-Z0-9]{4}-[A-Z0-9]{4})/.exec(out)?.[1] ?? ''
  }
  if (!code) {
    proc.kill()
    throw new Error('sensor printed no pairing code: ' + out.slice(0, 800))
  }
  const view: any = await api('POST', '/api/v1/sensor-pairings/lookup', { code })
  await api('POST', `/api/v1/sensor-pairings/${view.id}/approve`, {
    code,
    fingerprint_confirmed: true,
    step_up: { totp: await freshCode(st, 'alex@example.com') },
    name,
    type: 'sensor',
    grant_profile: profile,
    zone_ids: st.ids.zone ? [st.ids.zone] : [],
  })
  await Promise.race([done, new Promise((r) => setTimeout(r, 60000))])
  log('     ', out.trim().split('\n').slice(-2).join(' | '))
}
if (process.env.PAIR_SENSORS !== '0') {
  await step('pair sensor dc-a-scanner-01', () => pairSensor('dc-a-scanner-01', 'internal-network-scanner'))
  await step('pair sensor edge-easm-01', () => pairSensor('edge-easm-01', 'easm-external'))
}
await step('sensor state', async () => sql('10-sensors.sql'))

// Scan workflows: copies of three built-in workflows, activated.
const workflows: Record<string, string> = {}
for (const [from, name] of [
  ['a0000002-0000-0000-0000-000000000002', 'External attack surface'],
  ['a0000002-0000-0000-0000-000000000004', 'Perimeter network'],
  ['a0000002-0000-0000-0000-000000000003', 'Web application'],
]) {
  await step(`workflow ${name}`, () => api('POST', `/api/v1/scan-workflows/${from}/clone`, { name }))
  const w = (await list(alex, '/api/v1/scan-workflows?per_page=100')).find((x: any) => x.name === name)
  if (!w) continue
  workflows[name] = w.id
  if (!w.is_active) await step(`activate ${name}`, () => api('POST', `/api/v1/scan-workflows/${w.id}/activate`, {}))
}

const scanDefs = [
  { name: 'Weekly external surface', workflow: 'External attack surface', description: 'Subdomains, ports, HTTP and vulnerability templates for every public domain', schedule_type: 'weekly', schedule_day: 1, schedule_time: '02:00', targets: ['example.com', 'example.org', 'example.net'] },
  { name: 'Daily perimeter', workflow: 'Perimeter network', description: 'Ports, web services and vulnerability templates on the public address ranges', schedule_type: 'daily', schedule_time: '01:30', targets: ['203.0.113.0/24', '198.51.100.0/24'] },
  { name: 'Shop web application', workflow: 'Web application', description: 'Crawl and test the online shop (shop.example.org)', schedule_type: 'manual', targets: ['https://198.51.100.30'] },
]
for (const d of scanDefs) {
  const { workflow, ...body } = d
  const r: any = await step(`scan ${d.name}`, () =>
    api('POST', '/api/v1/scans', { ...body, scan_type: 'workflow', scan_workflow_id: workflows[workflow], timezone: 'Europe/London', sensor_preference: 'tenant', tags: ['demo'] })
  )
  if (r?.id) st.ids[`scan:${d.name}`] = r.id
}
saveState(st)

// Run history. Each trigger plans a real run; no sensor runs here, so
// demo.finish_run() (sql/20-scan-runs.sql) writes the results a sensor would
// have sent. Nothing is ever scanned.
await step('scan run helpers', async () => sql('20-scan-runs.sql'))
const scans = await list(alex, '/api/v1/scans?per_page=50')
const history: [string, number, string, string?][] = [
  ['Weekly external surface', 21, 'completed'],
  ['Weekly external surface', 14, 'completed'],
  ['Weekly external surface', 7, 'completed'],
  ['Daily perimeter', 2, 'completed'],
  ['Daily perimeter', 1, 'partial', 'http'],
  ['Shop web application', 10, 'completed'],
  ['Shop web application', 3, 'failed', 'crawl'],
  ['Daily perimeter', 0.3, 'completed'],
  ['Weekly external surface', 0.01, 'running'],
]
for (const [name, days, status, failStep] of history) {
  const scan = scans.find((x: any) => x.name === name)
  if (!scan) continue
  await step(`run ${name} (${status}, ${days}d ago)`, async () => {
    await api('POST', `/api/v1/scans/${scan.id}/trigger`, {})
    sqlText(`SELECT demo.finish_run('${name}', ${days}, '${status}'${failStep ? `, '${failStep}'` : ''});`)
  })
}

// ---------------------------------------------------------------------------
// CI/CD, notifications, dashboards, reports, API keys, SLA
// ---------------------------------------------------------------------------
await step('ci trust config', () =>
  api('POST', '/api/v1/ci/trust-configs', {
    name: 'GitHub Actions (example-corp)',
    provider: 'github',
    issuer: 'https://token.actions.githubusercontent.com',
    default_branch: 'main',
    enabled: true,
    rules: { owners: ['example-corp'], repositories: ['example-corp/web-app', 'example-corp/payments-api'], refs: ['refs/heads/main', 'refs/pull/*'], events: ['push', 'pull_request'], allow_fork_pull_requests: false, require_protected_ref: false },
  })
)
await step('ci gate policy', () =>
  api('POST', '/api/v1/ci/gate-policies', { enabled: true, mode: 'enforce', fail_on_severity: 'high', fail_on_kev: true, new_findings_only: true, scope_type: 'tenant' })
)
await step('dashboard', () =>
  api('POST', '/api/v1/me/dashboards', {
    name: 'Security leadership',
    description: 'Weekly posture review',
    columns: 4,
    layout: [
      { widget_type: 'risk_score', x: 0, y: 0, w: 1, h: 1 },
      { widget_type: 'open_findings', x: 1, y: 0, w: 1, h: 1 },
      { widget_type: 'sla_compliance', x: 2, y: 0, w: 1, h: 1 },
      { widget_type: 'mttr_critical', x: 3, y: 0, w: 1, h: 1 },
      { widget_type: 'findings_by_severity', x: 0, y: 1, w: 2, h: 2 },
      { widget_type: 'overdue_sla', x: 2, y: 1, w: 2, h: 2 },
    ],
  })
)
await step('report schedule', () =>
  api('POST', '/api/v1/reports/schedules', {
    name: 'Weekly executive summary', report_type: 'executive_summary', format: 'pdf', cron_expression: '0 8 * * 1', timezone: 'Europe/London',
    recipients: [{ email: 'alex@example.com', name: 'Alex Morgan' }, { email: 'jordan@example.com', name: 'Jordan Patel' }],
  })
)
await step('report schedule 2', () =>
  api('POST', '/api/v1/reports/schedules', {
    name: 'Monthly findings export', report_type: 'findings', format: 'csv', cron_expression: '0 7 1 * *', timezone: 'Europe/London',
    recipients: [{ email: 'sam@example.com', name: 'Sam Lee' }],
  })
)
await step('api key', () => api('POST', '/api/v1/api-keys', { name: 'SIEM export', description: 'Read-only export of findings to the SIEM', scopes: ['findings:read', 'assets:read'], expires_in_days: 90 }))
await step('api key 2', () => api('POST', '/api/v1/api-keys', { name: 'Asset sync (CMDB)', description: 'Nightly asset synchronisation', scopes: ['assets:read', 'assets:write'], expires_in_days: 180 }))
await step('sla policy', () =>
  api('POST', '/api/v1/sla-policies', { name: 'Default remediation SLA', description: 'Days to fix, by severity', is_default: true, critical_days: 15, high_days: 30, medium_days: 90, low_days: 180, warning_threshold_pct: 80, escalation_enabled: true })
)

// ---------------------------------------------------------------------------
// Ownership, priority rules, a penetration test, resolved findings
// ---------------------------------------------------------------------------
const owners: [string, string | undefined][] = [
  ['customer-portal', st.ids.sam], ['https://app.example.com', st.ids.sam], ['https://api.example.com', st.ids.sam],
  ['github.com/example-corp/web-app', st.ids.sam], ['github.com/example-corp/payments-api', st.ids.casey],
  ['vpn.example.net', st.ids.jordan], ['legacy.example.net', st.ids.casey], ['build.example.com', st.ids.casey],
  ['shop.example.org', st.ids.jordan], ['aws:123456789012', st.ids.jordan], ['payments-db', st.ids.casey],
  ['example.com', alex.userId], ['example.org', alex.userId], ['example.net', alex.userId],
]
const byType: Record<string, string | undefined> = {
  repository: st.ids.sam, ip_address: st.ids.casey, host: st.ids.casey, service: st.ids.casey, compute: st.ids.casey,
  storage: st.ids.jordan, identity: st.ids.jordan, iam_role: st.ids.jordan, database: st.ids.casey, container: st.ids.sam,
  subdomain: st.ids.jordan, application: st.ids.sam, website: st.ids.sam, api: st.ids.sam,
}
const ownerOf = new Map(owners)
for (const a of allAssets) {
  if (/^www\.example\.(org|net)$/.test(a.name)) continue // names found in Certificate Transparency stay unowned
  const uid = ownerOf.get(a.name) ?? byType[a.type]
  if (uid) await step(`owner ${a.name}`, () => api('POST', `/api/v1/assets/${a.id}/owners`, { user_id: uid, ownership_type: 'primary' }))
}

await step('priority rule KEV internet', () =>
  api('POST', '/api/v1/priority-rules', {
    name: 'Known exploited on a crown jewel', description: 'Anything in CISA KEV on a crown-jewel asset is P0.', priority_class: 'P0', is_active: true, evaluation_order: 100,
    conditions: [{ field: 'is_in_kev', operator: 'eq', value: true }, { field: 'asset_is_crown_jewel', operator: 'eq', value: true }],
  })
)
await step('priority rule EPSS', () =>
  api('POST', '/api/v1/priority-rules', {
    name: 'Likely exploitation (EPSS above 0.5)', description: 'High EPSS raises the finding to P1.', priority_class: 'P1', is_active: true, evaluation_order: 50,
    conditions: [{ field: 'epss_score', operator: 'gte', value: 0.5 }],
  })
)
await step('priority rule info', () =>
  api('POST', '/api/v1/priority-rules', {
    name: 'Informational stays P3', description: 'Informational findings never page anyone.', priority_class: 'P3', is_active: false, evaluation_order: 10,
    conditions: [{ field: 'severity', operator: 'eq', value: 'info' }],
  })
)

// A penetration test whose fixed findings wait in the retest queue.
await step('pentest campaign', async () => {
  const c: any = await api('POST', '/api/v1/pentest/campaigns', {
    name: 'Q4 external penetration test', description: 'Annual test of the customer portal, the public API and the online shop.',
    campaign_type: 'web_app', priority: 'high', methodology: 'OWASP WSTG 4.2', client_name: 'Example Corp',
    start_date: new Date(Date.now() - 20 * 86400e3).toISOString().slice(0, 10), end_date: new Date(Date.now() + 10 * 86400e3).toISOString().slice(0, 10),
    objectives: ['Test authentication and authorization of the customer portal', 'Test the public API for broken object level authorization'],
    asset_ids: ids('https://app.example.com', 'https://api.example.com', 'https://shop.example.org'),
    lead_user_id: st.ids.jordan, team_user_ids: [st.ids.jordan, st.ids.casey].filter(Boolean), tags: ['annual'],
  })
  const id = c.id ?? c.data?.id
  st.ids.pentest = id
  const walk: Record<string, string[]> = {
    remediation: ['in_review', 'confirmed', 'remediation'],
    retest: ['in_review', 'confirmed', 'remediation', 'retest'],
    verified: ['in_review', 'confirmed', 'remediation', 'retest', 'verified'],
  }
  const pf = async (body: { status: string } & Record<string, unknown>) => {
    const f: any = await api('POST', `/api/v1/pentest/campaigns/${id}/findings`, body)
    for (const status of walk[body.status] ?? [])
      await api('PATCH', `/api/v1/pentest/findings/${f.id ?? f.data?.id}/status`, { status }).catch((e) => log('     pentest status', e.message))
  }
  await pf({
    title: 'Order API returns other customers’ orders (BOLA)', severity: 'high', status: 'retest', asset_id: A('https://api.example.com'),
    cwe_id: 'CWE-639', owasp_category: 'API1:2023 Broken Object Level Authorization', cvss_score: 8.1, cvss_version: '3.1',
    cvss_vector: 'CVSS:3.1/AV:N/AC:L/PR:L/UI:N/S:U/C:H/I:N/A:N',
    description: 'GET /v2/orders/{id} returns any order when the caller is signed in, whoever owns it.',
    steps_to_reproduce: ['Sign in as customer A.', 'Request GET /v2/orders/100245, an order of customer B.', 'The full order, with address and items, is returned.'],
    business_impact: 'Disclosure of customer addresses and order history.', remediation_guidance: 'Check that the order belongs to the caller before returning it.',
  })
  await pf({
    title: 'Session cookie without SameSite attribute', severity: 'low', status: 'remediation', asset_id: A('https://app.example.com'),
    cwe_id: 'CWE-1275', description: 'The session cookie of the customer portal is set without SameSite.', remediation_guidance: 'Set SameSite=Lax on the session cookie.',
  })
  await pf({
    title: 'Password reset token reusable', severity: 'medium', status: 'retest', asset_id: A('https://shop.example.org'),
    cwe_id: 'CWE-640', description: 'A password reset link can be used more than once within its validity.', remediation_guidance: 'Invalidate the token after the first use.',
  })
  await pf({
    title: 'Verbose error discloses framework version', severity: 'info', status: 'verified', asset_id: A('https://shop.example.org'),
    description: 'Stack traces were returned on malformed input; fixed and verified.',
  })
})

// A few findings fixed and verified.
for (const t of ['SSH Weak Key Exchange', 'SMTP Service Cleartext Login', 'semver: regular expression', 'S3 Data should be versioned']) {
  await setStatus(t, 'confirmed')
  await setStatus(t, 'resolved', 'Fixed and verified by a rescan.')
}

// ---------------------------------------------------------------------------
// Single sign-on, configured by the platform administrator and approved (or
// waiting for approval) by the organization owner.
// ---------------------------------------------------------------------------
if (process.env.ADMIN_TEMP_PASSWORD || st.totp['admin@example.com']) {
  const admin = await adminSignIn(st, 'admin@example.com', process.env.ADMIN_TEMP_PASSWORD)
  const base = `/api/v1/admin/tenants/${alex.tenantId}/sso`
  await step('sso verified domain', () => admin.call('POST', `${base}/verified-domains`, { domain: 'example.com' }))
  await step('sso entra id', () =>
    admin.call('POST', `${base}/identity-providers`, {
      provider: 'entra_id', display_name: 'Example Corp (Microsoft Entra ID)', client_id: '00000000-0000-0000-0000-00000000c0de',
      client_secret: 'demo-client-secret-not-real', tenant_identifier: '11111111-2222-3333-4444-555555555555',
      allowed_domains: ['example.com'], auto_provision: true, default_role: 'member',
    })
  )
  // The owner approves the first change, with a step-up.
  const changes = await call<any>('GET', `/api/v1/tenants/${alex.tenantId}/settings/sso/changes`, undefined, T).catch(() => ({}))
  const pending = (changes.data ?? changes.changes ?? changes ?? []).filter?.((c: any) => c.status === 'pending') ?? []
  if (pending[0]) {
    await call('POST', '/api/v1/auth/step-up', { totp: await freshCode(st, 'alex@example.com') }, T)
    await step('approve sso change', () => api('POST', `/api/v1/tenants/${alex.tenantId}/settings/sso/changes/${pending[0].id}/approve`, {}))
  }
  await step('sso google workspace (pending)', () =>
    admin.call('POST', `${base}/identity-providers`, {
      provider: 'google_workspace', display_name: 'Example Corp (Google Workspace)', client_id: '123456789012-demo.apps.googleusercontent.com',
      client_secret: 'demo-client-secret-not-real', allowed_domains: ['example.org'], auto_provision: false, default_role: 'viewer',
    })
  )
}

await step('notification slack', () =>
  api('POST', '/api/v1/integrations/notifications', {
    name: 'Security alerts (Slack)', provider: 'slack', auth_type: 'token', credentials: 'https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXXXXXX',
    channel_name: 'security-alerts', enabled_severities: ['critical', 'high'], include_details: true, min_interval_minutes: 5,
  })
)

// History for the trend charts, CI runs, and a fresh heartbeat for the sensors.
await step('domain proof', async () => sql('15-domain-proof.sql'))
await step('history', async () => sql('30-history.sql'))
await step('ci runs', async () => sql('40-ci.sql'))
await step('refresh', async () => sql('90-refresh.sql'))

saveState(st)
log('done')
