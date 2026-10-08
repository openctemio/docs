// Helpers shared by the demo seed and the screenshot capture: a small API
// client, TOTP codes for the demo accounts, and the local state file.
//
// Everything here talks to a SCRATCH OpenCTEM stack filled with synthetic
// data. Never point it at a real installation.

import { createHmac } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

export const HERE = dirname(fileURLToPath(import.meta.url))
export const API = (process.env.OPENCTEM_API_URL ?? 'http://127.0.0.1:18980').replace(/\/$/, '')
export const WEB = (process.env.OPENCTEM_WEB_URL ?? 'http://localhost:13980').replace(/\/$/, '')
const STATE_FILE = process.env.DEMO_STATE_FILE ?? join(HERE, '.state.json')

// One password for every demo account: the stack is local and throwaway.
export const DEMO_PASSWORD = process.env.DEMO_PASSWORD ?? 'DemoPassw0rd!2026'

export interface DemoState {
  totp: Record<string, string> // email -> base32 TOTP secret
  ids: Record<string, string> // name -> id of something the seed created
  lastCode: Record<string, string> // email -> last TOTP code used (no replay)
}

export function loadState(): DemoState {
  if (!existsSync(STATE_FILE)) return { totp: {}, ids: {}, lastCode: {} }
  const s = JSON.parse(readFileSync(STATE_FILE, 'utf8'))
  return { totp: s.totp ?? {}, ids: s.ids ?? {}, lastCode: s.lastCode ?? {} }
}

export function saveState(s: DemoState): void {
  writeFileSync(STATE_FILE, JSON.stringify(s, null, 2) + '\n', { mode: 0o600 })
}

// RFC 6238 TOTP (SHA-1, 6 digits, 30 s), as authenticator apps compute it.
function base32Decode(s: string): Buffer {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
  let bits = ''
  for (const c of s.replace(/=+$/, '').toUpperCase()) {
    const v = alphabet.indexOf(c)
    if (v < 0) continue
    bits += v.toString(2).padStart(5, '0')
  }
  const out: number[] = []
  for (let i = 0; i + 8 <= bits.length; i += 8) out.push(parseInt(bits.slice(i, i + 8), 2))
  return Buffer.from(out)
}

export function totp(secret: string, at = Date.now()): string {
  const counter = Buffer.alloc(8)
  counter.writeBigUInt64BE(BigInt(Math.floor(at / 1000 / 30)))
  const h = createHmac('sha1', base32Decode(secret)).update(counter).digest()
  const off = h[h.length - 1] & 0xf
  const n = (h.readUInt32BE(off) & 0x7fffffff) % 1_000_000
  return n.toString().padStart(6, '0')
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

// A fresh code for this account, never the one used last (the API refuses a
// replayed code): waits for the next 30-second window when needed.
export async function freshCode(state: DemoState, email: string): Promise<string> {
  const secret = state.totp[email]
  if (!secret) throw new Error(`no TOTP secret for ${email}`)
  for (;;) {
    const code = totp(secret)
    if (code !== state.lastCode[email]) {
      state.lastCode[email] = code
      saveState(state)
      return code
    }
    await sleep(2000)
  }
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public body: string,
    msg: string
  ) {
    super(msg)
  }
}

// Refresh token of the last sign-in step: the API sets it only as a cookie.
let lastRefreshCookie = ''

export async function call<T = any>(
  method: string,
  path: string,
  body?: unknown,
  token?: string,
  extraHeaders: Record<string, string> = {}
): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json', ...extraHeaders }
  let payload: BodyInit | undefined
  if (body instanceof FormData) payload = body
  else if (body !== undefined) {
    headers['Content-Type'] = 'application/json'
    payload = JSON.stringify(body)
  }
  if (token) headers.Authorization = `Bearer ${token}`
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(API + path, { method, headers, body: payload })
    const text = await res.text()
    for (const c of res.headers.getSetCookie()) {
      const m = /^refresh_token=([^;]+)/.exec(c)
      if (m) lastRefreshCookie = decodeURIComponent(m[1])
    }
    if (res.status === 429 && attempt < 8) {
      const wait = Number(res.headers.get('retry-after') ?? '10')
      await sleep(Math.min(Math.max(wait, 2), 65) * 1000)
      continue
    }
    if (!res.ok) throw new ApiError(res.status, text, `${method} ${path} -> ${res.status}: ${text.slice(0, 400)}`)
    return (text ? JSON.parse(text) : undefined) as T
  }
}

export interface Session {
  email: string
  refreshToken: string
  accessToken: string
  tenantId: string
  userId: string
}

// Password sign-in for a demo account, completing (first time) or answering
// the TOTP step, then a tenant-scoped access token.
export async function signIn(state: DemoState, email: string, tenantSlug = 'example-corp'): Promise<Session> {
  let res: any = await call('POST', '/api/v1/auth/login', { email, password: DEMO_PASSWORD })
  if (res.mfa_required && res.mfa_purpose === 'enroll') {
    const setup = await call('POST', '/api/v1/auth/mfa/enroll/start', { mfa_token: res.mfa_token })
    state.totp[email] = setup.secret
    saveState(state)
    res = await call('POST', '/api/v1/auth/mfa/enroll/confirm', {
      mfa_token: res.mfa_token,
      code: await freshCode(state, email),
    })
  } else if (res.mfa_required) {
    res = await call('POST', '/api/v1/auth/mfa/verify', {
      mfa_token: res.mfa_token,
      code: await freshCode(state, email),
    })
  }
  const tenant = (res.tenants ?? []).find((t: any) => t.slug === tenantSlug) ?? res.tenants?.[0]
  if (!tenant) throw new Error(`${email} belongs to no organization`)
  const tok = await call('POST', '/api/v1/auth/token', { refresh_token: res.refresh_token || lastRefreshCookie, tenant_id: tenant.id })
  return {
    email,
    refreshToken: res.refresh_token || lastRefreshCookie,
    accessToken: tok.access_token,
    tenantId: tenant.id,
    userId: res.user.id,
  }
}

// ---------------------------------------------------------------------------
// Platform administrator: the admin console uses cookies, not bearer tokens.
// ---------------------------------------------------------------------------

export class AdminSession {
  jar = new Map<string, string>()

  private absorb(res: Response) {
    for (const c of res.headers.getSetCookie()) {
      const [kv] = c.split(';')
      const i = kv.indexOf('=')
      const k = kv.slice(0, i)
      const v = kv.slice(i + 1)
      if (/max-age=0|expires=thu, 01 jan 1970/i.test(c) || v === '') this.jar.delete(k)
      else this.jar.set(k, v)
    }
  }

  async call<T = any>(method: string, path: string, body?: unknown): Promise<T> {
    const headers: Record<string, string> = { Accept: 'application/json' }
    if (body !== undefined) headers['Content-Type'] = 'application/json'
    if (this.jar.size) headers.Cookie = [...this.jar].map(([k, v]) => `${k}=${v}`).join('; ')
    const csrf = this.jar.get('admin_csrf')
    if (csrf) headers['X-CSRF-Token'] = decodeURIComponent(csrf)
    let res: Response
    for (let attempt = 0; ; attempt++) {
      res = await fetch(API + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) })
      if (res.status !== 429 || attempt >= 6) break
      await sleep(Math.min(Math.max(Number(res.headers.get(retry-after) ?? 20), 5), 65) * 1000)
    }
    this.absorb(res)
    const text = await res.text()
    if (!res.ok) throw new ApiError(res.status, text, `${method} ${path} -> ${res.status}: ${text.slice(0, 400)}`)
    return (text ? JSON.parse(text) : undefined) as T
  }
}

// Signs a platform administrator in to the console. The first time, with the
// temporary password from bootstrap-admin: enrolls TOTP and sets DEMO_PASSWORD.
export async function adminSignIn(state: DemoState, email: string, tempPassword?: string): Promise<AdminSession> {
  const tryWith = async (password: string) => {
    const s = new AdminSession()
    await s.call('POST', '/api/v1/auth/login', { email, password })
    const start: any = await s.call('POST', '/api/v1/admin/auth/session')
    if (start.secret) {
      state.totp[email] = start.secret
      saveState(state)
    }
    await s.call('POST', '/api/v1/admin/auth/mfa', { code: await freshCode(state, email) })
    return s
  }
  try {
    return await tryWith(DEMO_PASSWORD)
  } catch (e) {
    if (!tempPassword || !(e instanceof ApiError) || e.status !== 401) throw e
  }
  const s = await tryWith(tempPassword)
  const me: any = await s.call('GET', '/api/v1/admin/auth/validate')
  if (me.password_change_required) {
    await s.call('POST', '/api/v1/admin/auth/password', { current_password: tempPassword, new_password: DEMO_PASSWORD })
    return tryWith(DEMO_PASSWORD)
  }
  return s
}
