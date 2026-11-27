// Captures the console screenshots of the documentation site and of the website.
//
// Run against a SCRATCH stack filled by demo-seed/seed.ts (see README.md):
//
//   PLAYWRIGHT_BROWSERS_PATH=... npx tsx capture-screenshots.ts [name-filter]
//
// Writes assets/images/<section>/<name>.png (palette PNG, 1440 px wide; the
// website set goes to SHOTS_DIR/website). Anything that looks like a
// credential (API keys, tokens, pairing codes, TOTP secrets and QR codes) is
// blurred before each capture. With TEXT_DIR set, the visible text of every
// capture is written there too, so it can be searched for anything that is
// not demo data.

import { spawn, spawnSync } from 'node:child_process'
import { mkdirSync, statSync, unlinkSync, existsSync, writeFileSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createHash, randomBytes } from 'node:crypto'
import { chromium, type Browser, type BrowserContext, type Page } from 'playwright'
import sharp from 'sharp'
import { API, call, CONSOLE, DEMO_PASSWORD, freshCode, HERE, loadState, signIn, WEB } from './demo-seed/lib.ts'

const ROOT = join(HERE, '..', '..')
const OUT = process.env.SHOTS_DIR ?? join(ROOT, 'assets', 'images')
const TEXT_DIR = process.env.TEXT_DIR
const MAX_BYTES = 300 * 1024
// The argument is a plain text to look for in "section/name", never a pattern.
const FILTER = process.argv[2] ? new RegExp(process.argv[2].replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) : null
const st = loadState()
const log = (...a: unknown[]) => console.log('[capture]', ...a)

// ---------------------------------------------------------------------------
// Page preparation
// ---------------------------------------------------------------------------

// Hides toasts and animations; blurs anything that looks like a secret.
async function prepare(page: Page) {
  await page.addStyleTag({
    content: `
      [data-sonner-toaster], [data-sonner-toast], .Toastify, [role="status"][aria-live="polite"]:empty,
      nextjs-portal, [data-nextjs-toast] { display: none !important; }
      *, *::before, *::after { animation-duration: 0s !important; animation-delay: 0s !important; transition: none !important; caret-color: transparent !important; }
      .docs-mask { filter: blur(6px) !important; }
    `,
  })
  // The scratch stack runs on a local address; show the public URL an
  // installation would have instead (for example in the SAML service-provider URLs).
  await page.evaluate((origins) => {
    // No named functions in here: tsx would wrap them in a helper the page does not have.
    const pub = 'https://ctem.example.com'
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
    for (let n = walker.nextNode(); n; n = walker.nextNode())
      for (const o of origins) if (n.textContent?.includes(o)) n.textContent = n.textContent.split(o).join(o.includes('://') ? pub : new URL(pub).host)
    for (const el of Array.from(document.querySelectorAll('input, textarea')) as HTMLInputElement[])
      for (const o of origins) if (el.value?.includes(o)) el.value = el.value.split(o).join(o.includes('://') ? pub : new URL(pub).host)
  }, [new URL(WEB).origin, new URL(CONSOLE).origin, new URL(API).origin, WEB.replace('localhost', '127.0.0.1'), CONSOLE.replace('localhost', '127.0.0.1'), new URL(WEB).host, new URL(CONSOLE).host])
  // A request that came from the Docker bridge shows a private address: show a documentation address instead.
  await page.evaluate(() => {
    const priv = /\b(10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+|192\.168\.\d+\.\d+)\b(?!\/\d)/g
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
    for (let n = walker.nextNode(); n; n = walker.nextNode()) if (priv.test(n.textContent ?? '')) n.textContent = (n.textContent ?? '').replace(priv, '192.0.2.45')
  })
  await page.evaluate(() => {
    // API keys, sensor keys, JWTs, TOTP URIs and secrets (also in groups of
    // four), pairing codes, PEM blocks, webhook URLs, AWS key IDs.
    const secret =
      /(oct[sak]?_[A-Za-z0-9]{3,}|rda_[A-Za-z0-9]{3,}|eyJ[A-Za-z0-9_-]{8,}|otpauth:\/\/|\b(?=[0-9]*[A-Z])[A-Z0-9]{4}-(?=[0-9]*[A-Z])[A-Z0-9]{4}\b|\b[A-Z2-7]{16,}\b|\b([A-Z2-7]{4} ){3,}[A-Z2-7]{4}\b|-----BEGIN|hooks\.slack\.com\/services\/\S+|client_secret|AKIA[0-9A-Z*]{4,})/
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
    .waitForFunction(() => !document.querySelector('[class*="skeleton" i], [data-slot="skeleton"], [aria-busy="true"], .animate-spin, .animate-pulse'), null, { timeout: 15000 })
    .catch(() => {})
  await page.waitForTimeout(extra)
}

// Writes a palette PNG (1440 px wide at most), or a WebP when the PNG is over 300 KB.
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
  // Route (a function: null when the record is missing), and what to do on
  // the page before the capture.
  route?: string | (() => string | undefined)
  open?: (page: Page) => Promise<unknown>
  // Element to crop to (a dialog).
  crop?: string | ((page: Page) => ReturnType<Page['locator']>)
  // Fixed region of the viewport.
  clip?: { x: number; y: number; width: number; height: number }
  // Space kept around a cropped element, in pixels.
  pad?: number
  // A signed-out page (sign-in, set password, device code): the logo, the
  // card and the language link, centered at 1440 px.
  authCard?: boolean
  // Keep the pointer where open() left it (a submenu that hover opened).
  keepPointer?: boolean
  dark?: boolean
  as?: 'alex' | 'admin' | 'adminro' | 'anon'
  height?: number
  width?: number
}

const isConsole = (shot: Shot) => shot.as === 'admin' || shot.as === 'adminro' || shot.section === 'console' || shot.name.startsWith('console-')

// No sensor runs on the scratch stack, so the sensors drift offline within
// minutes: demo-seed/sql/90-refresh.sql puts them back before every shot
// (with DEMO_PSQL, the psql command line of the scratch database).
const refreshSql = readFileSync(join(HERE, 'sql', '90-refresh.sql'))
function refresh() {
  if (!process.env.DEMO_PSQL) return
  spawnSync('sh', ['-c', `${process.env.DEMO_PSQL} -q -v ON_ERROR_STOP=1`], { input: refreshSql, stdio: ['pipe', 'ignore', 'inherit'] })
}

async function shoot(ctx: BrowserContext, shot: Shot) {
  refresh()
  const page = await ctx.newPage()
  if (shot.height || shot.width) await page.setViewportSize({ width: shot.width ?? 1440, height: shot.height ?? 900 })
  try {
    const route = typeof shot.route === 'function' ? shot.route() : shot.route
    if (typeof shot.route === 'function' && !route) throw new Error('no record to open')
    if (route) {
      await page.goto((isConsole(shot) ? CONSOLE : WEB) + route)
      await settle(page)
    }
    if (shot.open) {
      await shot.open(page)
      await settle(page, 800)
    }
    // No focus ring or hover state in the picture (unless the hover is the point, as an open submenu).
    if (!shot.keepPointer) {
      await page.mouse.move(0, (page.viewportSize()?.height ?? 900) - 1)
      await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur?.()).catch(() => {})
    }
    await prepare(page)
    await page.waitForTimeout(300)
    let buf: Buffer
    if (shot.authCard) {
      const form = await page.locator('main form').first().boundingBox()
      if (!form) throw new Error('no form on the page')
      buf = await page.screenshot({ clip: { x: 440, y: 16, width: 560, height: Math.round(form.y + form.height + 70 - 16) }, animations: 'disabled' })
    } else if (shot.crop) {
      const loc = typeof shot.crop === 'string' ? page.locator(shot.crop).first() : shot.crop(page)
      // An element inside the viewport (a dialog) is clipped from the page as
      // it is laid out now; an element screenshot would scroll it first.
      const found = await loc.boundingBox()
      const vp = page.viewportSize()
      const pad = shot.pad ?? 0
      const box = found && vp && {
        x: Math.max(0, found.x - pad), y: Math.max(0, found.y - pad),
        width: Math.min(vp.width - Math.max(0, found.x - pad), found.width + 2 * pad), height: found.height + 2 * pad,
      }
      buf =
        box && vp && box.y >= 0 && box.y + box.height <= vp.height
          ? await page.screenshot({ clip: box, animations: 'disabled' })
          : await loc.screenshot({ animations: 'disabled' })
    } else {
      buf = await page.screenshot({ clip: shot.clip, animations: 'disabled' })
    }
    const file = await save(buf, shot.section, shot.name)
    if (TEXT_DIR) {
      mkdirSync(TEXT_DIR, { recursive: true })
      const text = await page.evaluate(() => document.body.innerText + '\n' + Array.from(document.querySelectorAll('input, textarea')).map((e) => (e as HTMLInputElement).value).join('\n'))
      writeFileSync(join(TEXT_DIR, `${shot.section.replace(/\//g, '_')}__${shot.name}.txt`), text)
    }
    log('ok  ', file.replace(ROOT + '/', ''), `${Math.round(statSync(file).size / 1024)} KB`)
  } catch (e) {
    log('FAIL', `${shot.section}/${shot.name}`, (e as Error).message.split('\n')[0])
    if (process.env.DEBUG_DIR) await page.screenshot({ path: join(process.env.DEBUG_DIR, `fail-${shot.section.replace(/\//g, '_')}-${shot.name}.png`) }).catch(() => {})
  } finally {
    await page.close()
  }
}

// ---------------------------------------------------------------------------
// Sign-in
// ---------------------------------------------------------------------------

async function typeCode(page: Page, email: string) {
  const otp = page.locator('input[autocomplete="one-time-code"], input[inputmode="numeric"]').first()
  await otp.waitFor({ timeout: 20000 })
  await otp.click()
  await page.keyboard.type(await freshCode(st, email), { delay: 40 })
  await page.keyboard.press('Enter').catch(() => {})
}

async function uiSignIn(page: Page, email: string) {
  await page.goto(WEB + '/login')
  await settle(page, 500)
  await page.locator('main input[name="email"]').fill(email)
  await page.locator('main input[name="password"]').fill(DEMO_PASSWORD)
  await page.locator('main button[type="submit"]').first().click()
  await typeCode(page, email)
  await page.waitForURL((u) => !/\/(login|mfa|two-factor)/.test(u.pathname), { timeout: 30000 })
  if (/select-tenant/.test(page.url())) await page.getByText('Example Corp').first().click()
  await settle(page, 500)
}

async function consoleSignIn(page: Page, elevate: boolean) {
  await page.goto(CONSOLE + '/login')
  await settle(page, 800)
  await page.getByLabel('Email').fill('admin@example.com')
  await page.getByLabel('Password', { exact: true }).fill(DEMO_PASSWORD)
  await page.getByRole('button', { name: 'Continue' }).click()
  await typeCode(page, 'admin@example.com')
  await page.waitForURL((u) => !/\/login/.test(u.pathname), { timeout: 30000 })
  await settle(page, 500)
  // A console session starts read-only; 'admin' elevates (the pictures show
  // the elevated banner), 'adminro' stays read-only.
  if (elevate) {
    await page.getByRole('button', { name: /^Elevate/ }).first().click()
    const d = page.getByRole('dialog')
    await d.locator('textarea').fill('Documentation screenshots of the platform console')
    const code = d.locator('input[autocomplete="one-time-code"], input[inputmode="numeric"]').first()
    await code.click()
    await page.keyboard.type(await freshCode(st, 'admin@example.com'), { delay: 40 })
    await d.getByRole('button', { name: /^Elevate$/ }).click({ timeout: 3000 }).catch(() => {})
    await d.waitFor({ state: 'detached', timeout: 15000 })
    await settle(page, 500)
  }
}

async function context(browser: Browser, who: 'alex' | 'admin' | 'adminro' | 'anon', dark = false): Promise<BrowserContext> {
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
    colorScheme: dark ? 'dark' : 'light',
    locale: 'en-US',
    timezoneId: 'Europe/London',
  })
  await ctx.addInitScript((theme) => {
    try {
      localStorage.setItem('theme', theme)
    } catch {}
  }, dark ? 'dark' : 'light')
  if (who === 'anon') return ctx
  const page = await ctx.newPage()
  if (who === 'alex') await uiSignIn(page, 'alex@example.com')
  else await consoleSignIn(page, who === 'admin')
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
const campaigns = rows(await get('/api/v1/remediation/campaigns?per_page=20').catch(() => ({ data: [] })))
const pentestCampaigns = rows(await get('/api/v1/pentest/campaigns?per_page=20').catch(() => ({ data: [] })))
const mappings = rows(await get('/api/v1/import-mappings?per_page=20').catch(() => ({ data: [] })))
const pentestId = pentestCampaigns.find((c: any) => c.name === 'Q4 external penetration test')?.id
const workflowId = workflows.find((w: any) => w.name === 'External attack surface')?.id
// The blocked pull request run of demo-seed/sql/45-docs-extra.sql.
const blockedRun = 'd0c5d0c5-0000-4000-8000-000000000001'

// Starts `openctemio-sensor pair` (it only pairs, then exits) and returns the
// code it prints. stopPairing() denies the request and removes the container.
const pairing: { name?: string; code?: string } = {}
async function startPairing(name: string): Promise<string> {
  const image = process.env.SENSOR_IMAGE ?? 'ghcr.io/openctemio/sensor:v0.25.0'
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

// A consent request of an application the organization registered: the page
// the authorization endpoint sends a member to.
async function consentUrl(): Promise<string> {
  await call('POST', '/api/v1/auth/step-up', { totp: await freshCode(st, 'alex@example.com') }, alex.accessToken).catch(() => {})
  const existing = rows(await get('/api/v1/mcp-access/clients').catch(() => ({ data: [] })))
  let client = existing.find((c: any) => c.name === 'Example Corp assistant')
  if (!client)
    client = await call('POST', '/api/v1/mcp-access/clients', { name: 'Example Corp assistant', redirect_uris: ['http://127.0.0.1:33418/callback'] }, alex.accessToken)
  const verifier = randomBytes(32).toString('base64url')
  const q = new URLSearchParams({
    client_id: client.client_id,
    redirect_uri: 'http://127.0.0.1:33418/callback',
    response_type: 'code',
    code_challenge_method: 'S256',
    code_challenge: createHash('sha256').update(verifier).digest('base64url'),
    scope: 'mcp:assets.read mcp:findings.read',
    resource: `${WEB}/api/v1/mcp`,
    state: randomBytes(8).toString('hex'),
  })
  // The authorization endpoint (on the API) records the request and sends the
  // browser to the consent page of the web console.
  const res = await fetch(`${API}/oauth/authorize?${q}`, { redirect: 'manual' })
  const loc = res.headers.get('location')
  if (!loc) throw new Error(`authorize answered ${res.status} without a redirect`)
  const u = new URL(loc, WEB)
  return u.pathname + u.search
}

const tab = (name: RegExp) => async (page: Page) => {
  await page.getByRole('tab', { name }).first().click()
  await page.waitForTimeout(800)
}
const dialog = (page: Page) => page.getByRole('dialog').last()
// The dialog surface is slightly translucent: hide the page behind it.
const hideBehind = (page: Page) => page.addStyleTag({ content: 'main { visibility: hidden !important; }' })

// ---------------------------------------------------------------------------
// The shots
// ---------------------------------------------------------------------------

// The wizard shots create a trust for example-labs; it is removed before and
// after them, so no other picture shows it.
async function removeLabsTrust() {
  for (const c of rows(await get('/api/v1/ci/trust-configs')))
    if (JSON.stringify(c.rules ?? c).includes('example-labs')) {
      await call('POST', '/api/v1/auth/step-up', { totp: await freshCode(st, 'alex@example.com') }, alex.accessToken).catch(() => {})
      await call('DELETE', `/api/v1/ci/trust-configs/${c.id}`, undefined, alex.accessToken).catch((e) => log('skip delete trust', (e as Error).message))
    }
}

const ciWizard = (step: number): Shot => ({
  section: 'scanning/ci',
  name: ['', 'ci-wizard-1-provider', 'ci-wizard-2-organization', 'ci-wizard-3-snippet', 'ci-wizard-4-waiting'][step],
  route: '/ci-cd',
  open: async (page) => {
    await removeLabsTrust()
    await page.getByRole('button', { name: /connect a ci provider/i }).first().click()
    const d = dialog(page)
    await d.waitFor()
    if (step > 1) {
      await d.getByRole('radio', { name: /github/i }).first().click().catch(() => d.getByText(/github actions/i).first().click())
      await d.getByRole('button', { name: /^(next|continue)$/i }).click().catch(() => {})
      // An organization without a trust yet (one from an earlier capture is removed first).
      await d.locator('#ci-setup-owners').fill('example-labs')
      await d.locator('#ci-setup-owners').press('Enter')
    }
    if (step > 2) await d.getByRole('button', { name: /^connect$/i }).click()
    if (step > 3) await d.getByRole('button', { name: /i added it/i }).click()
    await page.waitForTimeout(800)
    await hideBehind(page)
  },
  crop: dialog,
})

const shots: Shot[] = [
  // Sign-in and overview
  { section: 'install', name: 'sign-in', as: 'anon', route: '/login', authCard: true },
  { section: 'overview', name: 'dashboard', route: '/' },
  { section: 'overview', name: 'dashboard-dark', route: '/', dark: true },

  // Scoping
  { section: 'scanning', name: 'scope-entries', route: '/scope' },
  { section: 'scanning', name: 'scope-approvals', route: '/scope?tab=approvals' },
  { section: 'scanning', name: 'scope-domain-proof', route: '/scope/domain-proof' },
  { section: 'user-guide', name: 'scoping-overview', route: '/scoping' },
  { section: 'scanning', name: 'easm-overview', route: '/attack-surface' },
  { section: 'scanning', name: 'easm-certificates', route: '/attack-surface/certificates' },
  { section: 'scanning', name: 'page-changes', route: '/attack-surface/pages' },

  // Discovery
  { section: 'user-guide', name: 'assets-inventory', route: '/assets' },
  { section: 'user-guide', name: 'asset-detail', route: () => assetId('app.example.com') && `/assets/${assetId('app.example.com')}` },
  {
    section: 'user-guide', name: 'asset-drawer', route: '/assets',
    open: async (page) => {
      await page.getByRole('row').filter({ hasText: 'www.example.com' }).first().click()
      await dialog(page).waitFor()
    },
  },
  { section: 'user-guide', name: 'asset-groups', route: '/assets/groups' },
  { section: 'user-guide', name: 'components', route: '/components' },

  // Findings
  { section: 'user-guide', name: 'findings-list', route: '/findings' },
  { section: 'user-guide', name: 'finding-detail-kev', route: () => findingId('Fortinet FortiOS') && `/findings/${findingId('Fortinet FortiOS')}` },
  {
    section: 'user-guide', name: 'finding-evidence',
    route: () => findingId('Git Configuration - Detect') && `/findings/${findingId('Git Configuration - Detect')}`,
    open: tab(/^evidence/i),
  },
  {
    // The section of the finding drawer (the list's side sheet).
    section: 'user-guide', name: 'finding-identity', route: '/findings',
    open: async (page) => {
      await page.getByRole('row').filter({ hasText: 'Apache Log4j2' }).first().click()
      const sec = dialog(page).getByRole('region', { name: 'Why this is one finding' })
      await sec.waitFor({ timeout: 20000 })
      await sec.scrollIntoViewIfNeeded()
      await page.waitForTimeout(800)
    },
    crop: (page) => dialog(page).getByRole('region', { name: 'Why this is one finding' }),
    pad: 16,
  },
  { section: 'user-guide', name: 'exposures', route: '/exposures' },
  { section: 'user-guide', name: 'ready-to-close', route: '/findings/ready-to-close' },
  { section: 'user-guide', name: 'finding-approvals', route: '/findings/approvals' },

  // Prioritization
  { section: 'user-guide', name: 'attack-paths', route: '/attack-paths' },
  { section: 'user-guide', name: 'exposure-chains', route: '/exposure-chains' },
  { section: 'user-guide', name: 'priority-rules', route: '/priority-rules' },
  { section: 'user-guide', name: 'threat-intel', route: '/threat-intel' },
  { section: 'user-guide', name: 'assets-needs-attention', route: '/assets/attention' },
  { section: 'user-guide', name: 'import-mappings', route: '/settings/integrations/import-mappings' },
  { section: 'user-guide', name: 'import-mapping-editor', route: () => mappings[0] && `/settings/integrations/import-mappings/${mappings[0].id}` },

  // Validation and mobilization
  { section: 'user-guide', name: 'validation', route: '/validation' },
  { section: 'user-guide', name: 'retest-queue', route: '/validation/retests' },
  { section: 'user-guide', name: 'pentest-campaigns', route: '/pentest/campaigns' },
  {
    section: 'user-guide', name: 'pentest-campaign-wizard', route: '/pentest/campaigns', height: 1000,
    open: async (page) => {
      await page.getByRole('button', { name: /new campaign/i }).first().click()
      const d = dialog(page)
      await d.waitFor()
      await d.getByLabel(/campaign name/i).first().fill('Mobile banking app test').catch(() => {})
      await d.getByLabel(/^client/i).first().fill('Example Corp, Payments team').catch(() => {})
      await hideBehind(page)
    },
    crop: dialog,
  },
  { section: 'user-guide', name: 'pentest-campaign', route: () => pentestId && `/pentest/campaigns/${pentestId}` },
  { section: 'user-guide', name: 'remediation', route: '/remediation' },
  { section: 'user-guide', name: 'remediation-campaign', route: () => {
      const c = campaigns.find((x: any) => x.name === 'Patch critical vulnerabilities') ?? campaigns[0]
      return c && `/remediation/campaigns/${c.id}`
    } },
  { section: 'user-guide', name: 'my-work', route: '/my-work' },

  // Insights
  { section: 'user-guide', name: 'insights-executive', route: '/insights/executive' },
  { section: 'user-guide', name: 'program-health', route: '/insights/program-health' },
  { section: 'user-guide', name: 'dashboards', route: '/dashboards' },
  { section: 'user-guide', name: 'reports', route: '/reports' },

  // Scanning
  { section: 'scanning', name: 'scans-list', route: '/scans' },
  { section: 'scanning', name: 'scan-runs', route: '/scans/runs' },
  {
    section: 'scanning', name: 'scan-run', route: '/scans/runs',
    open: async (page) => {
      await page.getByRole('row').filter({ hasText: /running/i }).first().click()
      await dialog(page).waitFor()
    },
  },
  {
    section: 'scanning', name: 'scan-run-completed', route: '/scans/runs',
    open: async (page) => {
      await page.getByRole('row').filter({ hasText: /completed/i }).filter({ hasText: /Weekly external surface/i }).first().click()
        .catch(() => page.getByRole('row').filter({ hasText: /completed/i }).first().click())
      await dialog(page).waitFor()
    },
  },
  { section: 'scanning', name: 'workflows', route: '/scans/workflows' },
  {
    section: 'scanning', name: 'workflow-builder', route: () => workflowId && `/scans/workflows/${workflowId}`,
    open: async (page) => {
      // After the initial fit-to-view, zoom in so the steps are readable.
      await page.waitForTimeout(2000)
      for (let i = 0; i < 2; i++) {
        await page.locator('.react-flow__controls-zoomin').first().click().catch(() => {})
        await page.waitForTimeout(300)
      }
    },
  },
  {
    section: 'scanning', name: 'new-scan', route: '/scans',
    open: async (page) => {
      await page.getByRole('button', { name: /^new scan$/i }).first().click()
      await dialog(page).waitFor()
    },
  },

  // CI/CD
  { section: 'scanning', name: 'ci-pipelines', route: '/ci-cd' },
  { section: 'scanning/ci', name: 'ci-pipelines', route: '/ci-cd' },
  { section: 'scanning', name: 'ci-trust', route: '/ci-cd?tab=connections' },
  { section: 'scanning/ci', name: 'ci-trust', route: '/ci-cd?tab=connections' },
  { section: 'scanning/ci', name: 'ci-refusals', route: '/ci-cd?tab=connections&refused=1' },
  { section: 'scanning/ci', name: 'ci-run-blocked', route: `/ci-cd?view=runs&run=${blockedRun}` },
  { section: 'scanning/ci', name: 'ci-coverage', route: '/ci-cd?view=coverage' },
  { section: 'scanning/ci', name: 'ci-gate-policy', route: '/ci-cd?tab=gate' },
  {
    section: 'scanning/ci', name: 'ci-gate-policy-edit', route: '/ci-cd?tab=gate',
    open: async (page) => {
      await page.getByRole('button', { name: /^edit$/i }).first().click()
      await dialog(page).waitFor()
      await hideBehind(page)
    },
    crop: dialog,
  },
  { section: 'scanning/ci', name: 'ci-pr-feedback', route: '/ci-cd?tab=feedback' },
  {
    section: 'scanning/ci', name: 'ci-gitlab-connect', route: '/ci-cd?tab=feedback',
    open: async (page) => {
      await page.getByRole('button', { name: /connect gitlab group/i }).first().click()
      await dialog(page).waitFor()
      const d = dialog(page)
      await d.getByLabel(/gitlab host/i).fill('gitlab.example.com').catch(() => {})
      await d.getByLabel(/group path/i).fill('example-corp/security').catch(() => {})
      await hideBehind(page)
    },
    crop: dialog,
  },
  {
    section: 'scanning/ci', name: 'ci-break-glass-list', route: '/ci-cd?view=runs&section=break-glass',
    open: async (page) => {
      await page.getByRole('button', { name: /show overrides/i }).first().click().catch(() => {})
      await page.waitForTimeout(1000)
      // The section sits under the runs list.
      await page.locator('#ci-setup-break-glass').evaluate((el) => el.scrollIntoView({ block: 'start' }))
      await page.evaluate(() => window.scrollBy(0, -80))
    },
  },
  {
    section: 'scanning/ci', name: 'ci-break-glass-dialog', route: `/ci-cd?view=runs&run=${blockedRun}`,
    open: async (page) => {
      await page.getByRole('button', { name: /break-glass this commit/i }).first().click()
      const d = dialog(page)
      await d.waitFor()
      await d.getByLabel(/reason/i).fill('Release blocker reviewed by AppSec, ticket SEC-101').catch(() => {})
      await hideBehind(page)
    },
    crop: dialog,
  },
  ciWizard(1), ciWizard(2), ciWizard(3), ciWizard(4),

  // Settings
  { section: 'user-guide', name: 'settings-security-overview', route: '/settings/security' },
  { section: 'identity', name: 'settings-domains', route: '/settings/domains' },
  { section: 'identity', name: 'authentication', route: '/settings/authentication' },
  {
    // Sign-in, Joining tab: the SSO changes section at the end of the page.
    section: 'identity', name: 'sso-approvals', route: '/settings/sso-approvals',
    open: async (page) => {
      await page.getByRole('heading', { name: 'SSO changes' }).first().evaluate((el) => el.scrollIntoView({ block: 'start' }))
      await page.evaluate(() => window.scrollBy(0, -96))
    },
  },
  { section: 'scanning', name: 'tools', route: '/settings/scanning/tools' },
  { section: 'sensors', name: 'sensor-products', route: '/settings/scanning/sensor-products' },

  // Sensors
  { section: 'sensors', name: 'sensors-list', route: '/sensors' },
  { section: 'sensors', name: 'scan-zones', route: '/sensors?tab=zones' },
  {
    // The approval page a person reaches from the sensor's printed link
    // (/activate?code=...): a live pairing request from the real sensor image
    // (its `pair` command only), so the page shows the fingerprints to pick from.
    section: 'sensors', name: 'pair-dialog', route: '/sensors',
    open: async (page) => {
      const code = await startPairing('dc-b-scanner-02')
      if (!code) throw new Error('no pairing code')
      await page.goto(`${WEB}/activate?code=${encodeURIComponent(code)}`)
      await page.getByText(/fingerprint/i).first().waitFor({ timeout: 15000 })
      await page.waitForTimeout(1500)
    },
  },

  // Identity, access and integrations
  { section: 'identity', name: 'members', route: '/settings/members' },
  { section: 'identity', name: 'roles', route: '/settings/roles' },
  { section: 'api', name: 'api-keys', route: '/settings/api-keys' },
  { section: 'api', name: 'mcp-connect', route: '/settings/mcp' },
  { section: 'api', name: 'mcp-policy', route: '/settings/mcp?tab=policy' },
  { section: 'api', name: 'mcp-applications', route: '/settings/mcp?tab=applications' },
  { section: 'api', name: 'mcp-remote', route: '/settings/mcp', open: tab(/remote or vps/i) },
  { section: 'api', name: 'mcp-device-code', route: '/oauth/device', authCard: true },
  {
    section: 'user-guide', name: 'mcp-consent', route: '/',
    open: async (page) => {
      await page.goto(WEB + (await consentUrl()))
      await page.waitForURL(/\/oauth\/consent/, { timeout: 20000 })
    },
  },
  { section: 'user-guide', name: 'notification-channels', route: '/settings/integrations/notifications' },
  { section: 'user-guide', name: 'settings-general', route: '/settings/general' },
  { section: 'security', name: 'audit-log', route: '/settings/audit-log' },

  // The website (openctemio/website, src/assets/shots)
  { section: 'website', name: 'dashboard-dark', route: '/', dark: true },
  { section: 'website', name: 'scope-entries', route: '/scope' },
  { section: 'website', name: 'assets-domains', route: '/assets?types=domain,subdomain' },
  { section: 'website', name: 'exposure-chains', route: '/exposure-chains' },
  { section: 'website', name: 'retest-queue', route: '/validation/retests' },
  { section: 'website', name: 'remediation', route: '/remediation' },
  { section: 'website', name: 'dashboard-templates', route: '/dashboards' },
  { section: 'website', name: 'attack-surface', route: '/attack-surface' },
  { section: 'website', name: 'certificates', route: '/attack-surface/certificates' },
  { section: 'website', name: 'findings', route: '/findings' },
  { section: 'website', name: 'ready-to-close', route: '/findings/ready-to-close' },
  { section: 'website', name: 'ci-cd', route: '/ci-cd' },

  // Platform console (its own site). The session is elevated, as the banner in the pictures shows.
  { section: 'user-guide', name: 'admin-organizations', as: 'admin', route: '/organizations' },
  { section: 'identity', name: 'admin-organization-sso', as: 'admin', route: `/organizations/${alex.tenantId}?tab=sso` },
  { section: 'user-guide', name: 'admin-administrators', as: 'admin', route: '/security/administrators' },
  { section: 'operations', name: 'admin-system-logs', as: 'admin', route: '/security/activity' },
  { section: 'console', name: 'overview', as: 'admin', route: '/' },
  { section: 'console', name: 'health', as: 'admin', route: '/health' },
  { section: 'console', name: 'organizations', as: 'admin', route: '/organizations' },
  { section: 'console', name: 'organization-detail', as: 'admin', route: `/organizations/${alex.tenantId}` },
  { section: 'console', name: 'users', as: 'admin', route: '/users' },
  { section: 'console', name: 'access-requests', as: 'admin', route: '/requests' },
  { section: 'console', name: 'signups', as: 'admin', route: '/requests/sign-ups' },
  { section: 'console', name: 'platform-scanning', as: 'admin', route: '/scanning/platform' },
  { section: 'console', name: 'platform-sensors', as: 'admin', route: '/sensors' },
  { section: 'console', name: 'content-catalog', as: 'admin', route: '/scanning/content-catalog' },
  { section: 'console', name: 'administrators', as: 'admin', route: '/security/administrators' },
  { section: 'console', name: 'activity', as: 'admin', route: '/security/activity' },
  { section: 'console', name: 'sessions', as: 'admin', route: '/security/sessions' },
  { section: 'console', name: 'approvals-approver', as: 'admin', route: '/security/approvals' },
  { section: 'console', name: 'ai-provider', as: 'admin', route: '/system/ai-provider' },
  { section: 'console', name: 'alerts', as: 'admin', route: '/system/alerts' },
  { section: 'console', name: 'captcha', as: 'admin', route: '/system/captcha' },
  { section: 'console', name: 'configuration', as: 'admin', route: '/system/configuration' },
  { section: 'console', name: 'limits', as: 'admin', route: '/system/limits' },
  { section: 'console', name: 'software-updates', as: 'admin', route: '/system/software-updates' },
  { section: 'identity', name: 'admin-system-signup', as: 'admin', route: '/system/sign-up' },
  {
    section: 'console', name: 'elevate', as: 'adminro', route: '/',
    open: async (page) => {
      await page.getByRole('button', { name: /^Elevate/ }).first().click()
      await dialog(page).waitFor()
    },
  },
  {
    // The account menu at the foot of the sidebar, with its Language submenu open.
    section: 'console', name: 'language', as: 'admin', route: '/', keepPointer: true, clip: { x: 0, y: 520, width: 760, height: 380 },
    open: async (page) => {
      await page.getByRole('button', { name: /^account menu for/i }).first().click()
      await page.getByRole('menu').first().waitFor()
      const lang = page.getByRole('menuitem', { name: /^language/i }).first()
      await lang.hover()
      await lang.press('ArrowRight').catch(() => {})
      await page.getByText('Tiếng Việt', { exact: true }).last().waitFor({ state: 'visible' })
    },
  },
  {
    // "Delete now" with a second super admin: the request for a second approval.
    section: 'console', name: 'second-approval', as: 'admin', route: `/organizations/${alex.tenantId}`,
    open: async (page) => {
      await page.getByTestId('org-purge').click()
      const d = dialog(page)
      await d.waitFor()
      await d.getByLabel(/reason/i).first().fill('The organization asked to close its account (ticket OPS-2214)').catch(() => {})
      const name = d.locator('input:not([autocomplete="one-time-code"]):not([inputmode="numeric"])').last()
      await name.fill('Example Corp').catch(() => {})
      const code = d.locator('input[autocomplete="one-time-code"], input[inputmode="numeric"]').first()
      if (await code.isVisible().catch(() => false)) {
        await code.click()
        await page.keyboard.type(await freshCode(st, 'admin@example.com'), { delay: 40 })
      }
      await d.getByRole('button', { name: /delete now/i }).click()
      await page.getByText(/another (super admin|platform owner) must approve/i).first().waitFor({ timeout: 15000 })
      await dialog(page).getByLabel(/reason/i).first().fill('Closing the account the organization asked to close, ticket OPS-2214').catch(() => {})
    },
  },
  { section: 'identity', name: 'console-sign-in', as: 'anon', route: '/login', clip: { x: 440, y: 236, width: 560, height: 428 } },
]

// ---------------------------------------------------------------------------

// CHROME_PATH: a Chromium of another Playwright release, when this one is not installed.
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined })
const contexts = new Map<string, BrowserContext>()
for (const shot of shots) {
  if (FILTER && !FILTER.test(`${shot.section}/${shot.name}`)) continue
  const key = `${shot.as ?? 'alex'}${shot.dark ? '-dark' : ''}`
  if (!contexts.has(key)) contexts.set(key, await context(browser, shot.as ?? 'alex', shot.dark))
  await shoot(contexts.get(key)!, shot)
  await stopPairing()
  if (shot.name === 'ci-wizard-4-waiting') await removeLabsTrust()
}

// First run of a new member: the set-password page, then two-factor setup.
// Drew Newhire is created for this (or gets a new link).
if (!FILTER || FILTER.test('install/set-password') || FILTER.test('identity/two-factor-setup')) {
  let token = ''
  try {
    const r: any = await call('POST', `/api/v1/tenants/${alex.tenantId}/users`, { email: 'drew@example.com', name: 'Drew Newhire', role_ids: ['00000000-0000-0000-0000-000000000003'] }, alex.accessToken)
    token = r.setup_token
  } catch {
    const members = rows(await get(`/api/v1/tenants/${alex.tenantId}/members?include=user&per_page=100`))
    const m = members.find((x: any) => (x.email ?? x.user?.email) === 'drew@example.com')
    const r: any = await call('POST', `/api/v1/tenants/${alex.tenantId}/users/${m?.user_id ?? m?.user?.id ?? m?.id}/setup-link`, {}, alex.accessToken).catch(() => ({}))
    token = r.setup_token ?? ''
  }
  if (!token) log('skip first-run shots: no setup link for drew@example.com')
  else {
    const ctx = await context(browser, 'anon')
    await shoot(ctx, { section: 'install', name: 'set-password', route: `/set-password#token=${encodeURIComponent(token)}`, authCard: true })
    const page = await ctx.newPage()
    await page.goto(WEB + `/set-password#token=${encodeURIComponent(token)}`)
    await settle(page, 500)
    const pws = page.locator('input[type="password"]')
    for (let i = 0; i < (await pws.count()); i++) await pws.nth(i).fill(DEMO_PASSWORD)
    await page.locator('main button[type="submit"]').first().click()
    await page.waitForTimeout(2500)
    await page.goto(WEB + '/login')
    await settle(page, 500)
    await page.locator('main input[name="email"]').fill('drew@example.com')
    await page.locator('main input[name="password"]').fill(DEMO_PASSWORD)
    await page.locator('main button[type="submit"]').first().click()
    await page.waitForURL((u) => !/\/login/.test(u.pathname), { timeout: 20000 }).catch(() => {})
    await settle(page, 500)
    const enrolPage = /two-factor-setup/.test(page.url())
    await page.close()
    // An organization that requires two-factor authentication sends the new
    // member to the enrolment page; otherwise Account settings > Set up.
    await shoot(
      ctx,
      enrolPage
        ? { section: 'identity', name: 'two-factor-setup', route: '/two-factor-setup', crop: 'main' }
        : {
            section: 'identity', name: 'two-factor-setup', route: '/account/security', crop: (p) => p.getByRole('dialog'),
            open: async (p) => {
              await p.getByRole('button', { name: /^set up$/i }).first().click()
              await p.getByRole('dialog').waitFor()
            },
          }
    )
    await ctx.close()
  }
}
await browser.close()
