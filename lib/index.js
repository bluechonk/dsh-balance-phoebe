import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const IMAGE_PATH = path.join(PACKAGE_ROOT, 'assets', 'image', 'phoebe .png')
const SOUND_PATH = path.join(PACKAGE_ROOT, 'assets', 'audio', 'phoebe.mp3')
const BALANCE_URL = 'https://longcat.chat/api/pay/quota/metering/token-packs/summary'
const BALANCE_TTL_MS = 25000

const JSON_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
  'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'",
  'Referrer-Policy': 'no-referrer',
}

let WIDGET_JS = ''
try {
  WIDGET_JS = fs.readFileSync(path.join(PACKAGE_ROOT, 'lib', 'widget.js'), 'utf8')
} catch (err) {
  console.error('[dsh-balance-phoebe] failed to read widget.js:', err)
}


const name = '@BlueChonk/dsh-balance-phoebe'
const inject = ['webServer', 'credentials']

function apply(ctx) {
  let imageBytes = null
  let soundBytes = null
  let balanceCache = null
  let balanceInFlight = null

  function loadImage() {
    if (imageBytes) return imageBytes
    imageBytes = fs.readFileSync(IMAGE_PATH)
    return imageBytes
  }

  function loadSound() {
    if (soundBytes) return soundBytes
    try { soundBytes = fs.readFileSync(SOUND_PATH) } catch (err) { soundBytes = null }
    return soundBytes
  }

  function sanitizeCookieValue(val) {
    if (typeof val !== 'string') return ''
    if (/[\r\n]/.test(val)) throw new Error('Invalid cookie value: contains control characters')
    return val
  }

  async function fetchBalance() {
    let cred
    try {
      cred = await ctx.credentials.resolve('LONGCAT_PASSPORT_TOKEN_KEY')
    } catch (err) {
      console.error('[dsh-balance-phoebe] credentials resolve error:', err)
      return { ok: false, code: 'NO_KEY', error: '凭据读取失败' }
    }
    if (!cred) return { ok: false, code: 'NO_KEY', error: '未配置 LONGCAT_PASSPORT_TOKEN_KEY' }
    let safeValue
    try {
      safeValue = sanitizeCookieValue(cred.value)
    } catch (err) {
      console.error('[dsh-balance-phoebe] cookie validation error:', err)
      return { ok: false, code: 'NO_KEY', error: '凭据格式无效' }
    }
    let lastErr = null
    for (let attempt = 0; attempt < 2; attempt++) {
      let res
      try {
        res = await fetch(BALANCE_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Cookie: 'passport_token_key=' + safeValue },
          body: '{}',
          signal: AbortSignal.timeout(20000),
        })
      } catch (err) {
        lastErr = err
        if (attempt === 0) await new Promise((r) => setTimeout(r, 500))
        continue
      }
      if (!res.ok) {
        lastErr = new Error('HTTP ' + res.status)
        if (res.status < 500) break
        if (attempt === 0) await new Promise((r) => setTimeout(r, 500 * (attempt + 1)))
        continue
      }
      let data
      try { data = await res.json() } catch (err) { return { ok: false, code: 'PARSE', error: '接口返回不是合法 JSON' } }
      if (data.code !== 0 || !data.data || !data.data.currentLot) {
        return { ok: false, code: 'SHAPE', error: '接口返回结构异常' }
      }
      const lot = data.data.currentLot
      const est = data.data.estimate || {}
      return {
        ok: true,
        remainingToken: Number(lot.remainingToken) || 0,
        totalToken: Number(lot.totalToken) || 0,
        consumedToken: Number(lot.consumedToken) || 0,
        consumedRatio: Number(lot.consumedRatio) || 0,
        exhaustedAfterDays: est.exhaustedAfterDays || 0,
        dailyAverageToken: est.dailyAverageToken || 0,
        expireTime: lot.expireTime || '',
        updatedAt: new Date().toISOString(),
      }
    }
    const transient = !(lastErr && /^HTTP 4\d\d/.test(lastErr.message))
    console.error('[dsh-balance-phoebe] fetchBalance HTTP error:', lastErr)
    return { ok: false, code: 'HTTP', transient: transient, error: '接口请求失败' }
  }

  function getBalance() {
    const now = Date.now()
    if (balanceCache && now - balanceCache.at < BALANCE_TTL_MS) return Promise.resolve(balanceCache.payload)
    if (balanceInFlight) return balanceInFlight
    balanceInFlight = fetchBalance()
      .then((payload) => {
        if (payload.ok) { balanceCache = { at: now, payload }; return payload }
        if (payload.transient && balanceCache) return { ...balanceCache.payload, stale: true }
        if (!payload.transient) console.error('[dsh-balance-phoebe]', payload.code, payload.error)
        return payload
      })
      .catch((err) => {
        console.error('[dsh-balance-phoebe] getBalance chain error:', err)
        return { ok: false, code: 'ERROR', error: '余额服务异常' }
      })
      .finally(() => { balanceInFlight = null })
    return balanceInFlight
  }

  const disposers = []

  const rateLimit = new Map()
  const RATE_LIMIT_WINDOW_MS = 1000
  const RATE_LIMIT_MAX = 10
  function checkRateLimit(key) {
    const now = Date.now()
    const entry = rateLimit.get(key)
    if (!entry || now - entry.start > RATE_LIMIT_WINDOW_MS) {
      rateLimit.set(key, { start: now, count: 1 })
      if (rateLimit.size > 1000) {
        for (const [k, v] of rateLimit) {
          if (now - v.start > RATE_LIMIT_WINDOW_MS) rateLimit.delete(k)
        }
      }
      return true
    }
    if (entry.count >= RATE_LIMIT_MAX) return false
    entry.count++
    return true
  }

  const STATIC_HEADERS = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'", 'Referrer-Policy': 'no-referrer' }

  disposers.push(ctx.webServer.register({
    kind: 'exact',
    path: '/dsh-phoebe/image.png',
    handler: (req, res) => {
      const clientIp = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket?.remoteAddress || 'unknown'
      if (!checkRateLimit(clientIp)) { res.writeHead(429, JSON_HEADERS); res.end('rate limited'); return }
      try {
        const bytes = loadImage()
        res.writeHead(200, { 'Content-Type': 'image/png', 'Content-Length': String(bytes.length), ...STATIC_HEADERS })
        res.end(bytes)
      } catch (err) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8', ...STATIC_HEADERS })
        res.end('phoebe image unavailable')
      }
    },
  }))

  disposers.push(ctx.webServer.register({
    kind: 'exact',
    path: '/dsh-phoebe/sound.mp3',
    handler: (req, res) => {
      const clientIp = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket?.remoteAddress || 'unknown'
      if (!checkRateLimit(clientIp)) { res.writeHead(429, JSON_HEADERS); res.end('rate limited'); return }
      const bytes = loadSound()
      if (!bytes) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8', ...STATIC_HEADERS }); res.end('sound unavailable'); return }
      res.writeHead(200, { 'Content-Type': 'audio/mpeg', 'Content-Length': String(bytes.length), ...STATIC_HEADERS })
      res.end(bytes)
    },
  }))

  disposers.push(ctx.webServer.register({
    kind: 'exact',
    path: '/dsh-phoebe/balance.json',
    handler: async (req, res) => {
      const clientIp = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket?.remoteAddress || 'unknown'
      if (!checkRateLimit(clientIp)) {
        res.writeHead(429, JSON_HEADERS)
        res.end(JSON.stringify({ ok: false, code: 'RATE_LIMITED', error: '请求过于频繁' }))
        return
      }
      try {
        const payload = await getBalance()
        res.writeHead(200, JSON_HEADERS)
        res.end(JSON.stringify(payload))
      } catch (err) {
        console.error('[dsh-balance-phoebe] balance endpoint error:', err)
        res.writeHead(200, JSON_HEADERS)
        res.end(JSON.stringify({ ok: false, code: 'ERROR', error: '服务异常' }))
      }
    },
  }))

  disposers.push(ctx.webServer.register({
    kind: 'exact',
    path: '/dsh-phoebe/widget.js',
    handler: (req, res) => {
      const clientIp = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket?.remoteAddress || 'unknown'
      if (!checkRateLimit(clientIp)) { res.writeHead(429, JSON_HEADERS); res.end('rate limited'); return }
      res.writeHead(200, { 'Content-Type': 'application/javascript; charset=utf-8', ...STATIC_HEADERS })
      res.end(WIDGET_JS)
    },
  }))

  disposers.push(ctx.webServer.tapIndex((html) => {
    if (html.indexOf('/dsh-phoebe/widget.js') !== -1) return html
    const tag = '<script defer src="/dsh-phoebe/widget.js"></script>'
    if (html.indexOf('</body>') !== -1) return html.replace('</body>', tag + '</body>')
    if (html.indexOf('</html>') !== -1) return html.replace('</html>', tag + '</html>')
    return html + tag
  }))

  ctx.effect(() => () => {
    for (const d of disposers) { try { d() } catch (err) {} }
    rateLimit.clear()
  })
}

export { name, inject, apply }
