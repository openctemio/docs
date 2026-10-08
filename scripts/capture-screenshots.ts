// Captures the web console screenshots of the documentation site.
//
// Run against a SCRATCH stack filled by demo-seed/seed.ts (see README.md):
//
//   PLAYWRIGHT_BROWSERS_PATH=... npx tsx capture-screenshots.ts [name-filter]
//
// Writes assets/images/<section>/<name>.png (palette PNG; WebP when the PNG
// would exceed 300 KB). Anything that looks like a credential (API keys,
// tokens, pairing codes, TOTP secrets and QR codes) is blurred before each
// capture.

import { spawn } from 'node:child_process'
import { mkdirSync, statSync, unlinkSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { chromium, type Browser, type BrowserContext, type Page } from 'playwright'
import sharp from 'sharp'
import { API, call, DEMO_PASSWORD, freshCode, HERE, loadState, signIn, WEB } from './demo-seed/lib.ts'

const ROOT = join(HERE, '..', '..')
const OUT = process.env.SHOTS_DIR ?? join(ROOT, 'assets', 'images')
const FILTER = process.argv[2] ? new RegExp(process.argv[2]) : null
const MAX_BYTES = 300 * 1024
const st = loadState()
const log = (...a: unknown[]) => console.log('[capture]', ...a)

// ---------------------------------------------------------------------------
// Page preparation
// ---------------------------------------------------------------------------

// The console uses the system font stack (Inter in the design). Headless
// Linux has none of those fonts, so the pages render with DejaVu Sans and the
// sign-in wordmark (SVG text) overlaps; load Inter for a consistent look.
async function useInter(page: Page) {
  await page.addStyleTag({ url: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=block' }).catch(() => {})
  await page.addStyleTag({ content: `body, svg text { font-family: 'Inter', sans-serif !important; }` })
  await page.evaluate(() => document.fonts.ready).catch(() => {})
}

// Hides toasts, the live-update badge and animations; blurs anything that
// looks like a secret.
async function prepare(page: Page) {
  await useInter(page)
  await page.addStyleTag({
    content: `
      [data-sonner-toaster], [data-sonner-toast], .Toastify, [role="status"][aria-live="polite"]:empty { display: none !important; }
      *, *::before, *::after { animation-duration: 0s !important; animation-delay: 0s !important; transition: none !important; caret-color: transparent !important; }
      .docs-mask { filter: blur(6px) !important; }
    `,
  })
  // The scratch stack runs on a local address; show the public URL an
  // installation would have instead (for example in the SAML service-provider URLs).
  await page.evaluate((origins) => {
    const pub = "https://ctem.example.com"
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
    for (let n = walker.nextNode(); n; n = walker.nextNode())
      for (const o of origins) if (n.textContent?.includes(o)) n.textContent = n.textContent.split(o).join(pub)
    for (const el of Array.from(document.querySelectorAll("input, textarea")) as HTMLInputElement[])
      for (const o of origins) if (el.value?.includes(o)) el.value = el.value.split(o).join(pub)
  }, [new URL(WEB).origin, new URL(API).origin, WEB.replace("localhost", "127.0.0.1")])
  await page.evaluate(() => {
    // API keys, sensor keys, JWTs, TOTP URIs and secrets (also in groups of
    // four), pairing codes, PEM blocks, webhook URLs, AWS key IDs.
    const secret =
      /(oct[sa]?_[A-Za-z0-9]{3,}|rda_[A-Za-z0-9]{3,}|eyJ[A-Za-z0-9_-]{8,}|otpauth:\/\/|\b(?=[0-9]*[A-Z])[A-Z0-9]{4}-(?=[0-9]*[A-Z])[A-Z0-9]{4}\b|\b[A-Z2-7]{16,}\b|\b([A-Z2-7]{4} ){3,}[A-Z2-7]{4}\b|-----BEGIN|hooks\.slack\.com\/services\/\S+|client_secret|AKIA[0-9A-Z*]{4,})/
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      if (secret.test(n.textContent ?? '')) n.parentElement?.classList.add('docs-mask')
    }
    for (const el of Array.from(document.querySelectorAll('input, textarea')) as HTMLInputElement[]) {
      if (secret.test(el.value ?? '')) el.classList.add('docs-mask')
    }
    // QR codes (authenticator enrollment).
    for (const el of Array.from(document.querySelectorAll('canvas, svg, img'))) {
      const label = `${el.getAttribute('aria-label') ?? ''} ${el.getAttribute('alt') ?? ''} ${el.getAttribute('data-testid') ?? ''} ${(el as Element).closest('[class*="qr" i], [data-qr]') ? 'qr' : ''}`
      const box = (el as HTMLElement).getBoundingClientRect()
      const square = Math.abs(box.width - box.height) < 4 && box.width >= 120
      if (/qr/i.test(label) || (el.tagName !== 'IMG' && square && el.querySelectorAll?.('rect, path').length > 20)) el.classList.add('docs-mask')
    }
  })
}

async function settle(page: Page, extra = 1200) {
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})
  // Skeletons and spinners gone.
  await page
    .waitForFunction(() => !document.querySelector('[class*="skeleton" i], [aria-busy="true"], .animate-spin, .animate-pulse'), null, { timeout: 10000 })
    .catch(() => {})
  await page.waitForTimeout(extra)
}

// Writes a palette PNG, or a WebP when the PNG is too big.
async function save(buf: Buffer, section: string, name: string): Promise<string> {
  mkdirSync(join(OUT, section), { recursive: true })
  const png = join(OUT, section, `${name}.png`)
  const webp = join(OUT, section, `${name}.webp`)
  for (const f of [png, webp]) if (existsSync(f)) unlinkSync(f)
  const img = sharp(buf)
  const meta = await img.metadata()
  const resized = meta.width && meta.width > 1440 ? img.resize({ width: 1440 }) : img
  await resized.clone().png({ palette: true, quality: 90, effort: 10, compressionLevel: 9 }).toFile(png)
  if (statSync(png).size <= MAX_BYTES) return png
  unlinkSync(png)
  await resized.clone().webp({ quality: 82, effort: 6 }).toFile(webp)
  return webp
}

interface Shot {
  section: string
  name: string
  // Route, or a function that opens the page and returns the element to
  // capture (null: the viewport).
  route?: string
  open?: (page: Page) => Promise<unknown>
  // CSS selector or locator factory to crop to.
  crop?: string | ((page: Page) => ReturnType<Page['locator']>)
  // Fixed region of the viewport.
  clip?: { x: number; y: number; width: number; height: number }
  fullPage?: boolean
  dark?: boolean
  as?: 'alex' | 'admin' | 'anon'
  height?: number
}

async function shoot(ctx: BrowserContext, shot: Shot) {
  const page = await ctx.newPage()
  if (shot.height) await page.setViewportSize({ width: 1440, height: shot.height })
  try {
    if (shot.route) {
      await page.goto(WEB + shot.route)
      await settle(page)
    }
    if (shot.open) {
      await shot.open(page)
      await settle(page, 800)
    }
    await prepare(page)
    await page.waitForTimeout(300)
    let buf: Buffer
    if (shot.crop) {
      const loc = typeof shot.crop === 'string' ? page.locator(shot.crop).first() : shot.crop(page)
      buf = await loc.screenshot({ animations: 'disabled' })
    } else {
      buf = await page.screenshot({ fullPage: shot.fullPage ?? false, clip: shot.clip, animations: 'disabled' })
    }
    const file = await save(buf, shot.section, shot.name)
    log('ok  ', file.replace(ROOT + '/', ''), `${Math.round(statSync(file).size / 1024)} KB`)
  } catch (e) {
    log('FAIL', `${shot.section}/${shot.name}`, (e as Error).message.split('\n')[0])
    // Unmasked: only where asked for.
    if (process.env.DEBUG_DIR) await page.screenshot({ path: join(process.env.DEBUG_DIR, `fail-${shot.name}.png`) }).catch(() => {})
  } finally {
    await page.close()
  }
}

// ---------------------------------------------------------------------------
// Sign-in
// ---------------------------------------------------------------------------

async function uiSignIn(page: Page, email: string) {
  await page.goto(WEB + '/login')
  await settle(page, 500)
  await page.getByLabel(/email/i).first().fill(email)
  const pw = page.getByLabel(/password/i).first()
  if (!(await pw.isVisible().catch(() => false))) {
    await page.getByRole('button', { name: /continue|next/i }).first().click()
    await pw.waitFor({ timeout: 10000 })
  }
  await pw.fill(DEMO_PASSWORD)
  await page.getByRole('button', { name: /sign in|log in|continue/i }).first().click()
  const otp = page.locator('input[autocomplete="one-time-code"], input[name*="code" i], input[inputmode="numeric"]').first()
  await otp.waitFor({ timeout: 15000 })
  await otp.fill(await freshCode(st, email))
  await page.keyboard.press('Enter')
  await page.waitForURL((u) => !/\/login/.test(u.pathname), { timeout: 20000 })
  await settle(page, 500)
}

async function context(browser: Browser, who: 'alex' | 'admin' | 'anon', dark = false): Promise<BrowserContext> {
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
    colorScheme: dark ? 'dark' : 'light',
    locale: 'en-US',
    timezoneId: 'Europe/London',
    bypassCSP: true,
  })
  await ctx.addInitScript((theme) => {
    try {
      localStorage.setItem('theme', theme)
    } catch {}
  }, dark ? 'dark' : 'light')
  if (who === 'anon') return ctx
  const page = await ctx.newPage()
  if (who === 'alex') await uiSignIn(page, 'alex@example.com')
  else {
    await uiSignIn(page, 'admin@example.com')
    if (!/\/admin/.test(page.url())) await page.goto(WEB + '/admin/login')
    const code = page.locator('input[autocomplete="one-time-code"], input[name*="code" i], input[inputmode="numeric"]').first()
    if (await code.isVisible({ timeout: 8000 }).catch(() => false)) {
      await code.fill(await freshCode(st, 'admin@example.com'))
      await page.keyboard.press('Enter')
      await page.waitForURL((u) => /\/admin(?!\/login)/.test(u.pathname), { timeout: 20000 }).catch(() => {})
    }
  }
  await page.close()
  return ctx
}

// ---------------------------------------------------------------------------
// Data the shots point at
// ---------------------------------------------------------------------------

const alex = await signIn(st, 'alex@example.com')
const get = <T = any>(path: string) => call<T>('GET', path, undefined, alex.accessToken)
const rows = (r: any) => r?.data ?? r?.items ?? []
const assets = rows(await get('/api/v1/assets?per_page=200'))
const findings = rows(await get('/api/v1/findings?per_page=200'))
const assetId = (name: string) => assets.find((a: any) => a.name === name)?.id
const findingId = (prefix: string) => findings.find((f: any) => (f.title ?? '').startsWith(prefix))?.id
const workflows = rows(await get('/api/v1/scan-workflows?per_page=100'))
const runs = rows(await get('/api/v1/scan-runs?per_page=50').catch(() => ({ data: [] })))
const campaigns = rows(await get('/api/v1/remediation/campaigns?per_page=20').catch(() => ({ data: [] })))
const groups = rows(await get('/api/v1/asset-groups?per_page=20').catch(() => ({ data: [] })))
const runningRun = runs.find((r: any) => r.status === 'running')?.id
const completedRun = runs.find((r: any) => r.status === 'completed' && r.total_steps === 5)?.id
const workflowId = workflows.find((w: any) => w.name === 'External attack surface')?.id

// Starts `openctemio-sensor pair` (it only pairs, then exits) and returns the
// code it prints. stopPairing() denies the request and removes the container.
const pairing: { name?: string; code?: string } = {}
async function startPairing(name: string): Promise<string> {
  const image = process.env.SENSOR_IMAGE ?? 'ghcr.io/openctemio/sensor:v0.11.0'
  const apiUrl = process.env.SENSOR_API_URL ?? 'http://127.0.0.1:18980'
  const proc = spawn('docker', ['run', '--rm', '--name', `openctem-demo-pair-${name}`, '--network', 'host', '--hostname', name, image, 'pair', '-api-url', apiUrl, '-name', name, '-state-dir', '/tmp/state'])
  let out = ''
  proc.stdout.on('data', (d) => (out += d))
  proc.stderr.on('data', (d) => (out += d))
  for (let i = 0; i < 40; i++) {
    const m = /Code:\s+([A-Z0-9]{4}-[A-Z0-9]{4})/.exec(out)
    if (m) {
      Object.assign(pairing, { name, code: m[1] })
      return m[1]
    }
    await new Promise((r) => setTimeout(r, 500))
  }
  log('sensor printed no pairing code:', out.slice(0, 300))
  return ''
}
async function stopPairing() {
  if (!pairing.code) return
  const view: any = await call('POST', '/api/v1/sensor-pairings/lookup', { code: pairing.code }, alex.accessToken).catch(() => null)
  if (view?.id) await call('POST', `/api/v1/sensor-pairings/${view.id}/reject`, { reason: 'documentation screenshot' }, alex.accessToken).catch(() => {})
  spawn('docker', ['rm', '-f', `openctem-demo-pair-${pairing.name}`])
  pairing.code = undefined
}

const clickTab = (name: RegExp) => async (page: Page) => {
  await page.getByRole('tab', { name }).first().click()
}

// ---------------------------------------------------------------------------
// The shots
// ---------------------------------------------------------------------------

const shots: Shot[] = [
  // Overview and first run
  { section: 'install', name: 'sign-in', as: 'anon', route: '/login', clip: { x: 440, y: 220, width: 560, height: 480 } },
  { section: 'overview', name: 'dashboard', route: '/' },
  { section: 'overview', name: 'dashboard-dark', route: '/', dark: true },

  // Scoping
  { section: 'scanning', name: 'scope-entries', route: '/scope' },
  { section: 'scanning', name: 'scope-approvals', route: '/scope', open: clickTab(/approvals/i) },
  { section: 'scanning', name: 'scope-domain-proof', route: '/scope', open: clickTab(/domain proof/i) },
  { section: 'user-guide', name: 'scoping-overview', route: '/scoping' },

  // Discovery
  { section: 'user-guide', name: 'assets-inventory', route: '/assets' },
  { section: 'user-guide', name: 'assets-domains', route: '/assets/domains' },
  { section: 'user-guide', name: 'asset-detail', route: `/assets/${assetId('app.example.com')}` },
  { section: 'user-guide', name: 'asset-groups', route: '/assets/groups' },
  { section: 'user-guide', name: 'components', route: '/components' },

  // Findings
  { section: 'user-guide', name: 'findings-list', route: '/findings' },
  { section: 'user-guide', name: 'finding-detail-kev', route: `/findings/${findingId('Fortinet FortiOS')}` },
  {
    section: 'user-guide',
    name: 'finding-evidence',
    route: `/findings/${findingId('Git Configuration - Detect')}`,
    open: async (page) => {
      await page.getByRole('tab', { name: /evidence/i }).first().click()
      await page.waitForTimeout(800)
      await page.getByText(/tool evidence/i).first().evaluate((el) => el.scrollIntoView({ block: 'start' }))
    },
  },
  { section: 'user-guide', name: 'exposures', route: '/exposures' },
  { section: 'user-guide', name: 'finding-approvals', route: '/findings/approvals' },

  // Prioritization
  { section: 'user-guide', name: 'attack-paths', route: '/attack-paths' },
  { section: 'user-guide', name: 'exposure-chains', route: '/exposure-chains' },
  { section: 'user-guide', name: 'priority-rules', route: '/priority-rules' },
  { section: 'user-guide', name: 'threat-intel', route: '/threat-intel' },

  // Validation and mobilization
  { section: 'user-guide', name: 'validation', route: '/validation' },
  { section: 'user-guide', name: 'retest-queue', route: '/validation/retests' },
  { section: 'user-guide', name: 'remediation', route: '/remediation' },
  { section: 'user-guide', name: 'remediation-campaign', route: campaigns[0] ? `/remediation/${campaigns[0].id}` : '/remediation' },
  { section: 'user-guide', name: 'my-work', route: '/my-work' },

  // Insights
  { section: 'user-guide', name: 'insights-executive', route: '/insights/executive' },
  { section: 'user-guide', name: 'dashboards', route: '/dashboards' },
  { section: 'user-guide', name: 'reports', route: '/reports' },

  // Scanning
  { section: 'scanning', name: 'scans-list', route: '/scans' },
  { section: 'scanning', name: 'scan-runs', route: '/scans/runs' },
  { section: 'scanning', name: 'scan-run', route: `/scans/runs?run=${runningRun}` },
  { section: 'scanning', name: 'scan-run-completed', route: `/scans/runs?run=${completedRun}` },
  { section: 'scanning', name: 'workflows', route: '/scans/workflows' },
  {
    section: 'scanning',
    name: 'workflow-builder',
    route: `/scans/workflows/${workflowId}`,
    open: async (page) => {
      // After the initial fit-to-view, zoom in so the steps are readable.
      await page.waitForTimeout(3000)
      const zoomIn = page.locator('.react-flow__controls-zoomin').first()
      for (let i = 0; i < 3; i++) {
        await zoomIn.click().catch(() => {})
        await page.waitForTimeout(400)
      }
    },
  },
  {
    section: 'scanning',
    name: 'new-scan',
    route: '/scans',
    open: async (page) => {
      await page.getByRole('button', { name: /new scan/i }).first().click()
    },
  },
  { section: 'scanning', name: 'ci-pipelines', route: '/ci-cd' },
  { section: 'scanning', name: 'ci-trust', route: '/settings/scanning/ci' },
  { section: 'scanning', name: 'tools', route: '/settings/scanning/tools' },

  // Sensors
  { section: 'sensors', name: 'sensors-list', route: '/sensors' },
  { section: 'sensors', name: 'scan-zones', route: '/sensors', open: clickTab(/scan zones/i) },
  {
    section: 'sensors',
    name: 'pair-dialog',
    route: '/sensors',
    crop: '[role="dialog"]',
    height: 1250,
    open: async (page) => {
      await page.getByRole('button', { name: /pair a sensor/i }).first().click()
      // A live pairing request from the real sensor image (its `pair` command
      // only), so the dialog shows the fingerprint to compare.
      const code = await startPairing('dc-b-scanner-02')
      if (code) {
        await page.getByRole('dialog').locator('input').first().fill(code)
        await page.getByRole('dialog').getByRole('button', { name: /find sensor/i }).click()
        await page.waitForTimeout(1500)
      }
    },
  },
  {
    section: 'sensors',
    name: 'pair-expect',
    route: '/sensors',
    crop: '[role="dialog"]',
    open: async (page) => {
      await page.getByRole('button', { name: /pair a sensor/i }).first().click()
      await page.getByRole('tab', { name: /expect/i }).first().click()
      await page.getByRole('dialog').getByRole('button', { name: /get a code/i }).click()
      await page.waitForTimeout(1500)
    },
  },

  // Settings, identity and access
  { section: 'identity', name: 'members', route: '/settings/members' },
  { section: 'identity', name: 'roles', route: '/settings/roles' },
  { section: 'identity', name: 'authentication', route: '/settings/authentication' },
  { section: 'identity', name: 'sso-approvals', route: '/settings/sso-approvals' },
  { section: 'api', name: 'api-keys', route: '/settings/api-keys' },
  { section: 'user-guide', name: 'notification-channels', route: '/settings/integrations/notifications' },
  { section: 'user-guide', name: 'settings-general', route: '/settings/general' },
  { section: 'security', name: 'audit-log', route: '/settings/audit-log' },

  // Platform administration
  { section: 'user-guide', name: 'admin-organizations', as: 'admin', route: '/admin/organizations' },
  { section: 'identity', name: 'admin-organization-sso', as: 'admin', route: `/admin/organizations/${alex.tenantId}`, open: clickTab(/sso|single sign-on/i) },
  { section: 'user-guide', name: 'admin-administrators', as: 'admin', route: '/admin/administrators' },
  { section: 'operations', name: 'admin-system-logs', as: 'admin', route: '/admin/system-logs' },
]

// ---------------------------------------------------------------------------

const browser = await chromium.launch()
const contexts = new Map<string, BrowserContext>()
for (const shot of shots) {
  if (FILTER && !FILTER.test(`${shot.section}/${shot.name}`)) continue
  const key = `${shot.as ?? 'alex'}${shot.dark ? '-dark' : ''}`
  if (!contexts.has(key)) contexts.set(key, await context(browser, shot.as ?? 'alex', shot.dark))
  await shoot(contexts.get(key)!, shot)
  await stopPairing()
}

// First run of a new member: the set-password page, then two-factor setup in
// the account settings. Morgan Diaz is created for this (or gets a new link).
if (!FILTER || FILTER.test('install/set-password') || FILTER.test('identity/two-factor-setup')) {
  let token = ''
  try {
    const r: any = await call('POST', `/api/v1/tenants/${alex.tenantId}/users`, { email: 'morgan@example.com', name: 'Morgan Diaz', role_ids: ['00000000-0000-0000-0000-000000000003'] }, alex.accessToken)
    token = r.setup_token
  } catch {
    const members = rows(await get(`/api/v1/tenants/${alex.tenantId}/members?limit=100`))
    const m = members.find((x: any) => (x.email ?? x.user?.email) === 'morgan@example.com')
    const r: any = await call('POST', `/api/v1/tenants/${alex.tenantId}/users/${m?.user_id ?? m?.id}/setup-link`, {}, alex.accessToken).catch(() => ({}))
    token = r.setup_token ?? ''
  }
  if (!token) log('skip first-run shots: no setup link for morgan@example.com')
  else {
    const ctx = await context(browser, 'anon')
    await shoot(ctx, { section: 'install', name: 'set-password', route: `/set-password?token=${encodeURIComponent(token)}`, clip: { x: 440, y: 220, width: 560, height: 500 } })
    const page = await ctx.newPage()
    await page.goto(WEB + `/set-password?token=${encodeURIComponent(token)}`)
    await settle(page, 500)
    const pws = page.locator('input[type="password"]')
    for (let i = 0; i < (await pws.count()); i++) await pws.nth(i).fill(DEMO_PASSWORD)
    await page.getByRole('button', { name: /set password|save|continue|submit/i }).first().click()
    await page.waitForTimeout(2500)
    await page.goto(WEB + '/login')
    await settle(page, 500)
    await page.getByLabel(/email/i).first().fill('morgan@example.com')
    const pw = page.getByLabel(/password/i).first()
    if (!(await pw.isVisible().catch(() => false))) await page.getByRole('button', { name: /continue|next/i }).first().click()
    await pw.fill(DEMO_PASSWORD)
    await page.getByRole('button', { name: /sign in|log in|continue/i }).first().click()
    await page.waitForURL((u) => !/\/login/.test(u.pathname), { timeout: 20000 }).catch(() => {})
    await page.close()
    await shoot(ctx, {
      section: 'identity',
      name: 'two-factor-setup',
      route: '/account/security',
      crop: '[role="dialog"]',
      open: async (p) => {
        await p.getByRole('button', { name: /^set up$/i }).first().click()
        await p.waitForTimeout(1200)
      },
    })
    await ctx.close()
  }
}
await browser.close()
