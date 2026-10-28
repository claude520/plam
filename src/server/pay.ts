// 统一支付网关（Cloudflare Pages Functions 端）
// 渠道：余额（前端直接扣款）/ Apple Pay / Google Pay / PayOS（越南 VietQR）
// 密钥只存 D1 表 pay_secrets（写入后不再返回给前端），也可用 Cloudflare 环境变量覆盖：
//   PAYOS_CLIENT_ID / PAYOS_API_KEY / PAYOS_CHECKSUM_KEY
//   APPLE_PAY_MERCHANT_ID（+ mTLS 证书绑定 APPLE_PAY_CERT）/ GOOGLE_PAY_MERCHANT_ID
import type { DataState } from '../data/reducers'
import { reducers } from '../data/reducers'

export interface PayEnv {
  DB: D1Database
  PAYOS_CLIENT_ID?: string; PAYOS_API_KEY?: string; PAYOS_CHECKSUM_KEY?: string
  APPLE_PAY_MERCHANT_ID?: string; GOOGLE_PAY_MERCHANT_ID?: string
  APPLE_PAY_CERT?: { fetch: typeof fetch }
}
type Json = (data: unknown, status?: number) => Response
interface StateIO { load: (db: D1Database) => Promise<{ version: number; data: DataState }>; save: (db: D1Database, data: DataState, keys: string[], v: number) => Promise<void> }

const PAYOS_API = 'https://api-merchant.payos.vn'
export const PAY_TABLES = 'CREATE TABLE IF NOT EXISTS pay_secrets (provider TEXT PRIMARY KEY, data TEXT NOT NULL, ts INTEGER NOT NULL); CREATE TABLE IF NOT EXISTS pay_orders (order_code INTEGER PRIMARY KEY, order_id TEXT NOT NULL, provider TEXT NOT NULL, amount INTEGER NOT NULL, currency TEXT NOT NULL, status TEXT NOT NULL, link_id TEXT, ts INTEGER NOT NULL);'

const SECRET_FIELDS: Record<string, string[]> = {
  payos: ['clientId', 'apiKey', 'checksumKey'],
  applepay: ['merchantId'],
  googlepay: ['merchantId'],
}

async function secrets(env: PayEnv, provider: string): Promise<Record<string, string>> {
  const row = await env.DB.prepare('SELECT data FROM pay_secrets WHERE provider = ?1').bind(provider).first<{ data: string }>()
  const s = row ? (JSON.parse(row.data) as Record<string, string>) : {}
  if (provider === 'payos') return { clientId: env.PAYOS_CLIENT_ID || s.clientId || '', apiKey: env.PAYOS_API_KEY || s.apiKey || '', checksumKey: env.PAYOS_CHECKSUM_KEY || s.checksumKey || '' }
  if (provider === 'applepay') return { merchantId: env.APPLE_PAY_MERCHANT_ID || s.merchantId || '' }
  if (provider === 'googlepay') return { merchantId: env.GOOGLE_PAY_MERCHANT_ID || s.merchantId || '' }
  return s
}
const mask = (v: string) => (v ? `${v.slice(0, 4)}****${v.slice(-2)}` : '')

async function hmac(key: string, msg: string): Promise<string> {
  const k = await crypto.subtle.importKey('raw', new TextEncoder().encode(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const sig = await crypto.subtle.sign('HMAC', k, new TextEncoder().encode(msg))
  return [...new Uint8Array(sig)].map(b => b.toString(16).padStart(2, '0')).join('')
}
/** PayOS webhook 签名：data 的键按字母排序，key=value 用 & 连接（null/undefined 记为空串） */
function sortedQuery(data: Record<string, unknown>): string {
  return Object.keys(data).sort().map(k => { const v = data[k]; return `${k}=${v === null || v === undefined || v === 'null' || v === 'undefined' ? '' : Array.isArray(v) ? JSON.stringify(v) : String(v)}` }).join('&')
}
/** 订单号 → PayOS orderCode（正整数，≤ 2^53-1） */
function orderCodeOf(orderId: string): number {
  const n = Number(orderId)
  if (Number.isSafeInteger(n) && n > 0) return n
  let h = 0; for (const ch of orderId) h = (h * 31 + ch.charCodeAt(0)) % 9_000_000_000_000
  return h + 1
}

/** 服务端标记已支付（复用前后端共享的 payOrder reducer，幂等） */
async function markPaid(env: PayEnv, io: StateIO, orderId: string, provider: string, tradeNo: string): Promise<boolean> {
  for (let i = 0; i < 4; i++) {
    const { version, data } = await io.load(env.DB)
    const patch = reducers.payOrder(data, orderId, provider, { id: tradeNo, now: new Date().toISOString() })
    const keys = Object.keys(patch)
    if (!keys.length) return data.orders.some(o => o.id === orderId && o.status !== 'unpaid')
    try { await io.save(env.DB, { ...data, ...patch } as DataState, keys, version); return true } catch (e) { if (!String(e).includes('conflict')) throw e }
  }
  return false
}
async function getOrder(env: PayEnv, io: StateIO, orderId: string) {
  const { data } = await io.load(env.DB)
  const o = data.orders.find(x => x.id === orderId)
  const rate = Number(data.paymentProviders.find(p => p.code === 'payos')?.config.cnyToVnd ?? 3500) || 3500
  return { o, rate }
}

export async function payApi(env: PayEnv, request: Request, parts: string[], json: Json, io: StateIO): Promise<Response> {
  await env.DB.exec(PAY_TABLES)
  const [provider, action] = parts
  const url = new URL(request.url)
  const origin = url.origin

  // 渠道状态（不含任何密钥明文）
  if (provider === 'channels' && request.method === 'GET') {
    const [po, ap, gp] = await Promise.all([secrets(env, 'payos'), secrets(env, 'applepay'), secrets(env, 'googlepay')])
    return json({
      payos: { configured: !!(po.clientId && po.apiKey && po.checksumKey), clientId: mask(po.clientId), apiKey: mask(po.apiKey), checksumKey: mask(po.checksumKey), webhook: `${origin}/api/pay/payos/webhook` },
      applepay: { configured: !!(ap.merchantId && env.APPLE_PAY_CERT), merchantId: ap.merchantId, cert: !!env.APPLE_PAY_CERT },
      googlepay: { configured: !!gp.merchantId, merchantId: gp.merchantId, environment: gp.merchantId ? 'PRODUCTION' : 'TEST' },
    })
  }
  // 保存密钥（只写；空字段表示保持原值）
  if (provider === 'config' && request.method === 'POST') {
    const body = (await request.json()) as { provider?: string; secrets?: Record<string, string> }
    const fields = SECRET_FIELDS[body.provider ?? '']
    if (!fields) return json({ error: 'unknown provider' }, 400)
    const row = await env.DB.prepare('SELECT data FROM pay_secrets WHERE provider = ?1').bind(body.provider).first<{ data: string }>()
    const cur = row ? (JSON.parse(row.data) as Record<string, string>) : {}
    for (const f of fields) { const v = (body.secrets?.[f] ?? '').trim(); if (v) cur[f] = v; if (body.secrets?.[f] === '__clear__') delete cur[f] }
    await env.DB.prepare('INSERT OR REPLACE INTO pay_secrets (provider, data, ts) VALUES (?1, ?2, ?3)').bind(body.provider, JSON.stringify(cur), Date.now()).run()
    return json({ ok: true })
  }

  // ---------- PayOS（越南） ----------
  if (provider === 'payos') {
    const s = await secrets(env, 'payos')
    const configured = !!(s.clientId && s.apiKey && s.checksumKey)
    if (action === 'create' && request.method === 'POST') {
      const body = (await request.json()) as { orderId?: string }
      const { o, rate } = await getOrder(env, io, body.orderId ?? '')
      if (!o) return json({ error: '订单不存在' }, 404)
      if (o.status !== 'unpaid') return json({ error: '订单已支付或已关闭', status: o.status }, 409)
      const amount = Math.max(2000, Math.round(o.payAmount * rate))
      if (!configured) return json({ demo: true, amount, currency: 'VND', message: 'PayOS 密钥未配置，当前为演示模式' })
      const orderCode = orderCodeOf(o.id)
      const returnUrl = `${origin}/pay/${o.id}?p=payos&r=1`, cancelUrl = `${origin}/pay/${o.id}?p=payos&cancel=1`
      const description = `PLAM${String(orderCode).slice(-8)}`.slice(0, 25)
      const signature = await hmac(s.checksumKey, `amount=${amount}&cancelUrl=${cancelUrl}&description=${description}&orderCode=${orderCode}&returnUrl=${returnUrl}`)
      const items = o.items.slice(0, 10).map(it => ({ name: it.title.slice(0, 50), quantity: it.qty, price: Math.round(it.price * rate) }))
      const r = await fetch(`${PAYOS_API}/v2/payment-requests`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-client-id': s.clientId, 'x-api-key': s.apiKey }, body: JSON.stringify({ orderCode, amount, description, items, returnUrl, cancelUrl, buyerName: o.address.name, buyerPhone: o.address.phone, expiredAt: Math.floor(Date.now() / 1000) + 30 * 60, signature }) })
      const j = (await r.json().catch(() => ({}))) as { code?: string; desc?: string; data?: { checkoutUrl: string; qrCode: string; paymentLinkId: string; accountNumber?: string; accountName?: string; bin?: string } }
      // 同一订单重复创建：PayOS 返回 231（已存在），改为查询已有链接
      if (j.code === '231') {
        const g = await fetch(`${PAYOS_API}/v2/payment-requests/${orderCode}`, { headers: { 'x-client-id': s.clientId, 'x-api-key': s.apiKey } })
        const gj = (await g.json().catch(() => ({}))) as { data?: { id: string; status: string } }
        if (gj.data?.status === 'PAID') { await markPaid(env, io, o.id, 'payos', gj.data.id); return json({ paid: true }) }
        return json({ error: '该订单的 PayOS 支付链接已存在，请在原页面完成支付或稍后重试', code: j.code }, 409)
      }
      if (j.code !== '00' || !j.data) return json({ error: `PayOS: ${j.desc ?? r.status}`, code: j.code }, 502)
      await env.DB.prepare('INSERT OR REPLACE INTO pay_orders (order_code, order_id, provider, amount, currency, status, link_id, ts) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)').bind(orderCode, o.id, 'payos', amount, 'VND', 'PENDING', j.data.paymentLinkId, Date.now()).run()
      return json({ checkoutUrl: j.data.checkoutUrl, qrCode: j.data.qrCode, amount, currency: 'VND', orderCode, bank: j.data.bin, accountNumber: j.data.accountNumber, accountName: j.data.accountName })
    }
    if (action === 'status' && request.method === 'GET') {
      const orderId = url.searchParams.get('orderId') ?? ''
      const { o } = await getOrder(env, io, orderId)
      if (!o) return json({ error: '订单不存在' }, 404)
      if (o.status !== 'unpaid') return json({ status: 'PAID' })
      if (!configured) return json({ status: 'PENDING', demo: true })
      const r = await fetch(`${PAYOS_API}/v2/payment-requests/${orderCodeOf(o.id)}`, { headers: { 'x-client-id': s.clientId, 'x-api-key': s.apiKey } })
      const j = (await r.json().catch(() => ({}))) as { data?: { id: string; status: string; amountPaid: number; amount: number } }
      const st = j.data?.status ?? 'PENDING'
      if (st === 'PAID' && j.data!.amountPaid >= j.data!.amount) { await markPaid(env, io, o.id, 'payos', j.data!.id); await env.DB.prepare("UPDATE pay_orders SET status = 'PAID' WHERE order_id = ?1").bind(o.id).run() }
      return json({ status: st })
    }
    // PayOS 回调（在 PayOS 后台「Webhook URL」填 https://你的域名/api/pay/payos/webhook）
    if (action === 'webhook' && request.method === 'POST') {
      const body = (await request.json().catch(() => ({}))) as { code?: string; success?: boolean; data?: Record<string, unknown> & { orderCode?: number; amount?: number; reference?: string }; signature?: string }
      if (!body.data || !body.signature) return json({ success: true }) // PayOS 保存 Webhook 时的连通性测试
      if (!configured) return json({ error: 'not configured' }, 400)
      const expect = await hmac(s.checksumKey, sortedQuery(body.data))
      if (expect !== body.signature) return json({ error: 'invalid signature' }, 401)
      if (body.code === '00' && body.data.orderCode) {
        const row = await env.DB.prepare('SELECT order_id, amount FROM pay_orders WHERE order_code = ?1').bind(body.data.orderCode).first<{ order_id: string; amount: number }>()
        if (row && Number(body.data.amount) >= row.amount) {
          await markPaid(env, io, row.order_id, 'payos', String(body.data.reference ?? body.data.orderCode))
          await env.DB.prepare("UPDATE pay_orders SET status = 'PAID' WHERE order_code = ?1").bind(body.data.orderCode).run()
        }
      }
      return json({ success: true })
    }
    // 演示模式：未配置密钥时模拟到账
    if (action === 'demo' && request.method === 'POST') {
      if (configured) return json({ error: '已配置真实密钥，不允许模拟支付' }, 403)
      const body = (await request.json()) as { orderId?: string }
      const ok = await markPaid(env, io, body.orderId ?? '', 'payos', `DEMO${Date.now()}`)
      return json({ ok })
    }
  }

  // ---------- Apple Pay ----------
  if (provider === 'applepay') {
    const s = await secrets(env, 'applepay')
    if (action === 'validate' && request.method === 'POST') {
      // 商户验证需要 Apple Pay 商户身份证书（mTLS），在 Cloudflare 绑定为 APPLE_PAY_CERT
      if (!s.merchantId || !env.APPLE_PAY_CERT) return json({ error: 'Apple Pay 商户证书未配置', demo: true }, 501)
      const { validationURL } = (await request.json()) as { validationURL?: string }
      if (!validationURL || !/^https:\/\/[a-z0-9.-]+\.apple\.com\//.test(validationURL)) return json({ error: 'bad validationURL' }, 400)
      const r = await env.APPLE_PAY_CERT.fetch(validationURL, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ merchantIdentifier: s.merchantId, displayName: 'Plam', initiative: 'web', initiativeContext: url.hostname }) })
      return new Response(await r.text(), { status: r.status, headers: { 'content-type': 'application/json' } })
    }
    if (action === 'confirm' && request.method === 'POST') {
      const body = (await request.json()) as { orderId?: string; token?: { transactionIdentifier?: string } }
      const live = !!(s.merchantId && env.APPLE_PAY_CERT)
      // 真实环境：此处应把 token（加密的支付数据）转交收单机构扣款，成功后再标记已支付
      const ok = await markPaid(env, io, body.orderId ?? '', 'applepay', body.token?.transactionIdentifier ?? `${live ? 'AP' : 'APDEMO'}${Date.now()}`)
      return json({ ok, live })
    }
  }

  // ---------- Google Pay ----------
  if (provider === 'googlepay' && action === 'confirm' && request.method === 'POST') {
    const s = await secrets(env, 'googlepay')
    const body = (await request.json()) as { orderId?: string; paymentData?: { paymentMethodData?: { tokenizationData?: { token?: string }; info?: { cardNetwork?: string; cardDetails?: string } } } }
    const info = body.paymentData?.paymentMethodData?.info
    if (!body.paymentData?.paymentMethodData?.tokenizationData?.token) return json({ error: '缺少 Google Pay 支付凭证' }, 400)
    // TEST 环境返回的是测试 token；PRODUCTION 环境应把 token 转交收单机构扣款
    const ok = await markPaid(env, io, body.orderId ?? '', 'googlepay', `${s.merchantId ? 'GP' : 'GPTEST'}-${info?.cardNetwork ?? 'CARD'}-${info?.cardDetails ?? ''}-${Date.now()}`)
    return json({ ok, environment: s.merchantId ? 'PRODUCTION' : 'TEST' })
  }

  return json({ error: 'not found' }, 404)
}
