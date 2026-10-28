// Cloudflare Pages Functions：全站数据 API（D1 持久化）
// GET  /api/state    全量数据 + 版本号
// GET  /api/version  当前版本号
// POST /api/mutate   { name, args } 服务端执行与前端相同的 reducer
// POST /api/reset    重置为演示数据
// 直播实时通道（独立于全量状态，不走版本号）：
// GET  /api/live/:id/poll?after=&media=&cid=&uid=   拉取新事件 / 新媒体分片 / 在线人数
// POST /api/live/:id/event  { type, data }          评论 / 点赞 / 讲解 / 公告 / 下播等
// POST /api/live/:id/media  { seq, chunk?, frame? } 主播推流（webm 分片 + JPEG 关键帧）
// POST /api/asset { data } / GET /api/asset/:id          商品图片资源（发布页上传）
// POST /api/translate { to, texts }                       多语言翻译（Workers AI + D1 缓存）
import { reducers, COLLECTIONS, type DataState, type ReducerName } from '../../src/data/reducers'
import { initialState } from '../../src/data/initial'
import { payApi, type PayEnv } from '../../src/server/pay'

interface Env extends Omit<PayEnv, 'DB'> { DB: D1Database; AI?: { run: (model: string, input: Record<string, unknown>) => Promise<{ translated_text?: string; response?: unknown }> } }

// ---------- 多语言翻译（大模型 + 电商术语表，批量 JSON 输出） ----------
const LANG_NAME: Record<string, string> = { en: 'English', vi: 'Vietnamese', fr: 'French', ko: 'Korean', ja: 'Japanese', ms: 'Malaysian Malay (Bahasa Melayu Malaysia, not Indonesian)', ru: 'Russian', ar: 'Arabic' }
// 实测（2026-10-28）：qwen3 八种语言质量最好（阿拉伯语其他模型会夹中文或回英文），llama-3.3 作兜底
const TR_MODELS = ['@cf/qwen/qwen3-30b-a3b-fp8', '@cf/meta/llama-3.3-70b-instruct-fp8-fast', '@cf/mistralai/mistral-small-3.1-24b-instruct', '@cf/google/gemma-3-12b-it', '@cf/meta/llama-4-scout-17b-16e-instruct']
/** 译文校验：不能残留中文（日语除外），非拉丁语种必须含目标文字 */
const SCRIPT: Record<string, RegExp> = { ar: /[\u0600-\u06ff]/, ru: /[\u0400-\u04ff]/, ko: /[\uac00-\ud7af]/, ja: /[\u3040-\u30ff\u3400-\u9fff]/ }
function validTr(to: string, src: string, out: string): boolean {
  if (!out || out.length > src.length * 12 + 40) return false
  if (to !== 'ja' && /[\u3400-\u9fff]/.test(out)) return false
  const re = SCRIPT[to]
  if (re && /[\u3400-\u9fff]/.test(src) && !re.test(out)) return false
  if (/(\b\S+\b)(?:\s+\1){4,}/.test(out)) return false
  return true
}
const GLOSSARY = '宝贝=item/product (never "baby"); 亲=polite greeting, translate as "Hi" or omit (never "kiss"/"darling"); 购物车=shopping cart; 已买到的宝贝=my purchases / orders; 收藏=favorites; 足迹=browsing history; 店铺=store; 旗舰店=flagship store; 掌柜/卖家=seller; 买家=buyer; 包邮=free shipping; 退货宝=return shipping insurance; 一口价=fixed price; 划线价=original price; 券=coupon; 领券=get coupons; 直播=live stream; 主播=host / streamer; 上架=list for sale; 下架=delist; 仓库中=in warehouse (unlisted); 类目=category; 规格=variant / specification; 库存=stock; 千牛=Qianniu (seller app); 商家中心=Seller Center; 管理后台=Admin Console; 生意参谋=Business Advisor; 天猫=Tmall; 双11=Double 11; 国家补贴/国补=national subsidy; 红包=red packet (cash bonus); 万人付款=10k+ buyers; 人付款=buyers; N折 is a Chinese discount where the buyer pays N tenths of the price: 5折=50% off, 7.2折=28% off, 9.5折=5% off — always convert to "X% off"'
async function translateBatch(ai: NonNullable<Env['AI']>, model: string, to: string, texts: string[]): Promise<(string | null)[]> {
  const sys = `You are a professional localization translator for "Plam", a Taobao-style online marketplace. Translate each Chinese UI string into ${LANG_NAME[to]}. Rules: 1) Output natural, concise ${LANG_NAME[to]} as used in e-commerce apps (buttons, menus, product titles). 2) Keep numbers exactly as written (e.g. 9001 stays 9001), keep brand names in their usual form, keep "Plam", "¥", "SKU", "AI", emoji and punctuation symbols. 3) Glossary: ${GLOSSARY}. 4) Never repeat words, never explain, never add quotes. Return JSON {"t":[...]} with exactly ${texts.length} strings in the same order as the input.`
  const r = await ai.run(model, {
    messages: [{ role: 'system', content: sys }, { role: 'user', content: JSON.stringify(texts) }],
    max_tokens: 4096, temperature: 0.1,
    response_format: { type: 'json_schema', json_schema: { type: 'object', properties: { t: { type: 'array', items: { type: 'string' } } }, required: ['t'] } },
  })
  let obj: unknown = r.response
  if (typeof obj === 'string') { const m = obj.match(/\{[\s\S]*\}/); obj = m ? JSON.parse(m[0]) : null }
  const arr = (obj as { t?: unknown })?.t
  if (!Array.isArray(arr) || arr.length !== texts.length) throw new Error('bad shape')
  return arr.map(x => (typeof x === 'string' && x.trim() && x.length < 1200 ? x.trim() : null))
}
type Row = { key: string; data: string }

const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'access-control-allow-origin': '*' } })

async function ensure(db: D1Database) {
  await db.exec('CREATE TABLE IF NOT EXISTS i18n (lang TEXT NOT NULL, src TEXT NOT NULL, dst TEXT NOT NULL, PRIMARY KEY (lang, src)); ')
  await db.exec('CREATE TABLE IF NOT EXISTS assets (id TEXT PRIMARY KEY, mime TEXT NOT NULL, data TEXT NOT NULL, ts INTEGER NOT NULL); ')
  await db.exec('CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY, data TEXT NOT NULL); CREATE TABLE IF NOT EXISTS meta (id INTEGER PRIMARY KEY CHECK (id = 1), version INTEGER NOT NULL); CREATE TABLE IF NOT EXISTS live_events (id INTEGER PRIMARY KEY AUTOINCREMENT, room_id TEXT NOT NULL, type TEXT NOT NULL, data TEXT NOT NULL, ts INTEGER NOT NULL); CREATE INDEX IF NOT EXISTS live_events_room ON live_events(room_id, id); CREATE TABLE IF NOT EXISTS live_media (room_id TEXT NOT NULL, seq INTEGER NOT NULL, chunk TEXT, frame TEXT, mime TEXT, ts INTEGER NOT NULL, PRIMARY KEY (room_id, seq)); CREATE TABLE IF NOT EXISTS live_viewers (room_id TEXT NOT NULL, client_id TEXT NOT NULL, user_id TEXT, last_seen INTEGER NOT NULL, PRIMARY KEY (room_id, client_id)); CREATE TABLE IF NOT EXISTS live_counters (room_id TEXT PRIMARY KEY, likes INTEGER NOT NULL DEFAULT 0, comments INTEGER NOT NULL DEFAULT 0, peak INTEGER NOT NULL DEFAULT 0, seq INTEGER NOT NULL DEFAULT 0, mime TEXT)')
}

async function liveApi(db: D1Database, request: Request, parts: string[]): Promise<Response> {
  const [roomId, action] = parts
  if (!roomId) return json({ error: 'room required' }, 400)
  const now = Date.now()
  const url = new URL(request.url)
  if (action === 'poll' && request.method === 'GET') {
    const after = Number(url.searchParams.get('after') ?? 0)
    const media = Number(url.searchParams.get('media') ?? -1)
    const cid = url.searchParams.get('cid')
    const uid = url.searchParams.get('uid')
    const wantFrame = url.searchParams.get('frame') === '1'
    const stmts: D1PreparedStatement[] = [
      db.prepare('SELECT id, type, data, ts FROM live_events WHERE room_id = ? AND id > ? ORDER BY id LIMIT 200').bind(roomId, after),
      db.prepare('SELECT COUNT(*) AS n FROM live_viewers WHERE room_id = ? AND last_seen > ?').bind(roomId, now - 45000),
      db.prepare('SELECT likes, comments, peak, seq, mime FROM live_counters WHERE room_id = ?').bind(roomId),
    ]
    if (wantFrame) stmts.push(db.prepare('SELECT seq, frame, ts FROM live_media WHERE room_id = ? AND frame IS NOT NULL ORDER BY seq DESC LIMIT 1').bind(roomId))
    else if (media >= 0) stmts.push(db.prepare('SELECT seq, chunk, mime, ts FROM live_media WHERE room_id = ? AND seq > ? AND chunk IS NOT NULL ORDER BY seq LIMIT 4').bind(roomId, media))
    else stmts.push(db.prepare('SELECT seq, chunk, mime, ts FROM live_media WHERE room_id = ? AND chunk IS NOT NULL ORDER BY seq DESC LIMIT 2').bind(roomId))
    if (cid && url.searchParams.get('hb') === '1') stmts.push(db.prepare('INSERT OR REPLACE INTO live_viewers (room_id, client_id, user_id, last_seen) VALUES (?, ?, ?, ?)').bind(roomId, cid, uid ?? null, now))
    const res = await db.batch(stmts)
    const events = (res[0].results as { id: number; type: string; data: string; ts: number }[]).map(e => ({ id: e.id, type: e.type, ts: e.ts, ...JSON.parse(e.data) }))
    const viewers = (res[1].results[0] as { n: number })?.n ?? 0
    const counters = (res[2].results[0] as { likes: number; comments: number; peak: number; seq: number; mime: string | null } | undefined) ?? { likes: 0, comments: 0, peak: 0, seq: 0, mime: null }
    let chunks: unknown[] = []
    let frame: unknown = null
    if (wantFrame) frame = res[3].results[0] ?? null
    else if (media >= 0) chunks = res[3].results
    else chunks = (res[3].results as { seq: number }[]).reverse()
    if (viewers > (counters.peak ?? 0)) await db.prepare('INSERT INTO live_counters (room_id, peak) VALUES (?, ?) ON CONFLICT(room_id) DO UPDATE SET peak = excluded.peak').bind(roomId, viewers).run()
    return json({ events, viewers, likes: counters.likes, comments: counters.comments, peak: Math.max(counters.peak ?? 0, viewers), seq: counters.seq, mime: counters.mime, chunks, frame, now })
  }
  if (action === 'event' && request.method === 'POST') {
    const body = (await request.json()) as { type: string; data?: Record<string, unknown> }
    const type = String(body.type || '')
    if (!type) return json({ error: 'type required' }, 400)
    const data = body.data ?? {}
    const stmts = [db.prepare('INSERT INTO live_events (room_id, type, data, ts) VALUES (?, ?, ?, ?)').bind(roomId, type, JSON.stringify(data), now)]
    if (type === 'comment') stmts.push(db.prepare('INSERT INTO live_counters (room_id, comments) VALUES (?, 1) ON CONFLICT(room_id) DO UPDATE SET comments = comments + 1').bind(roomId))
    if (type === 'like') stmts.push(db.prepare('INSERT INTO live_counters (room_id, likes) VALUES (?, ?) ON CONFLICT(room_id) DO UPDATE SET likes = likes + excluded.likes').bind(roomId, Number(data.n ?? 1)))
    if (type === 'end') { stmts.push(db.prepare('DELETE FROM live_media WHERE room_id = ?').bind(roomId)); stmts.push(db.prepare('DELETE FROM live_viewers WHERE room_id = ?').bind(roomId)) }
    if (type === 'start') { stmts.push(db.prepare('DELETE FROM live_media WHERE room_id = ?').bind(roomId)); stmts.push(db.prepare('INSERT INTO live_counters (room_id, likes, comments, peak, seq) VALUES (?, 0, 0, 0, 0) ON CONFLICT(room_id) DO UPDATE SET likes = 0, comments = 0, peak = 0, seq = 0').bind(roomId)) }
    const res = await db.batch(stmts)
    return json({ ok: true, id: res[0].meta.last_row_id, ts: now })
  }
  if (action === 'media' && request.method === 'POST') {
    const body = (await request.json()) as { seq: number; chunk?: string; frame?: string; mime?: string }
    const seq = Number(body.seq)
    await db.batch([
      db.prepare('INSERT OR REPLACE INTO live_media (room_id, seq, chunk, frame, mime, ts) VALUES (?, ?, ?, ?, ?, ?)').bind(roomId, seq, body.chunk ?? null, body.frame ?? null, body.mime ?? null, now),
      db.prepare('DELETE FROM live_media WHERE room_id = ? AND seq < ?').bind(roomId, seq - 8),
      db.prepare('INSERT INTO live_counters (room_id, seq, mime) VALUES (?, ?, ?) ON CONFLICT(room_id) DO UPDATE SET seq = excluded.seq, mime = COALESCE(excluded.mime, live_counters.mime)').bind(roomId, seq, body.mime ?? null),
    ])
    return json({ ok: true, seq })
  }
  if (action === 'stats' && request.method === 'GET') {
    const c = await db.prepare('SELECT likes, comments, peak FROM live_counters WHERE room_id = ?').bind(roomId).first()
    const v = await db.prepare('SELECT COUNT(*) AS n FROM live_viewers WHERE room_id = ? AND last_seen > ?').bind(roomId, now - 45000).first<{ n: number }>()
    return json({ ...(c ?? { likes: 0, comments: 0, peak: 0 }), viewers: v?.n ?? 0 })
  }
  return json({ error: 'not found' }, 404)
}

async function load(db: D1Database): Promise<{ version: number; data: DataState }> {
  const meta = await db.prepare('SELECT version FROM meta WHERE id = 1').first<{ version: number }>()
  if (!meta) {
    const data = initialState()
    await save(db, data, COLLECTIONS as unknown as string[], 0, true)
    return { version: 1, data }
  }
  const rows = (await db.prepare('SELECT key, data FROM kv').all<Row>()).results
  const data = initialState()
  for (const r of rows) (data as unknown as Record<string, unknown>)[r.key] = JSON.parse(r.data)
  return { version: meta.version, data }
}

async function save(db: D1Database, data: DataState, keys: string[], expectVersion: number, init = false) {
  const stmts: D1PreparedStatement[] = []
  if (init) stmts.push(db.prepare('INSERT OR REPLACE INTO meta (id, version) VALUES (1, 1)'))
  else stmts.push(db.prepare('UPDATE meta SET version = version + 1 WHERE id = 1 AND version = ?').bind(expectVersion))
  for (const k of keys) stmts.push(db.prepare('INSERT OR REPLACE INTO kv (key, data) VALUES (?, ?)').bind(k, JSON.stringify((data as unknown as Record<string, unknown>)[k])))
  const res = await db.batch(stmts)
  if (!init && (res[0].meta.changes ?? 0) === 0) throw new Error('conflict')
}

export const onRequest: PagesFunction<Env> = async ({ request, env, params }) => {
  const path = Array.isArray(params.path) ? params.path.join('/') : String(params.path ?? '')
  if (request.method === 'OPTIONS') return new Response(null, { headers: { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET,POST,OPTIONS', 'access-control-allow-headers': 'content-type' } })
  if (!env.DB) return json({ error: 'D1 binding "DB" missing' }, 500)
  await ensure(env.DB)

  if (path === 'version' && request.method === 'GET') {
    const meta = await env.DB.prepare('SELECT version FROM meta WHERE id = 1').first<{ version: number }>()
    return json({ version: meta?.version ?? 0 })
  }
  if (path === 'state' && request.method === 'GET') {
    let { version, data } = await load(env.DB)
    // 一次性迁移：支付渠道改为 余额 / Apple Pay / Google Pay / PayOS（下线微信、银联、Stripe、PayPal）
    if (data.paymentProviders?.some(p => ['wechat', 'unionpay', 'stripe', 'paypal'].includes(p.code)) || !data.paymentProviders?.some(p => p.code === 'payos')) {
      const fresh = initialState().paymentProviders
      const old = new Map((data.paymentProviders ?? []).map(p => [p.code, p]))
      data = { ...data, paymentProviders: fresh.map(p => old.has(p.code) ? { ...p, enabled: old.get(p.code)!.enabled, feeRate: old.get(p.code)!.feeRate } : p) }
      try { await save(env.DB, data, ['paymentProviders'], version); version += 1 } catch { /* 并发时下次再迁移 */ }
    }
    return json({ version, data })
  }
  if (path === 'reset' && request.method === 'POST') {
    const data = initialState()
    await env.DB.batch([env.DB.prepare('DELETE FROM kv'), env.DB.prepare('DELETE FROM meta')])
    await save(env.DB, data, COLLECTIONS as unknown as string[], 0, true)
    return json({ ok: true, version: 1 })
  }
  if (path === 'mutate' && request.method === 'POST') {
    const body = (await request.json()) as { name: ReducerName; args: unknown[] }
    const fn = reducers[body.name]
    if (!fn) return json({ error: 'unknown mutation' }, 400)
    for (let attempt = 0; attempt < 4; attempt++) {
      const { version, data } = await load(env.DB)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const patch = (fn as any)(data, ...body.args) as Partial<DataState>
      const keys = Object.keys(patch)
      if (keys.length === 0) return json({ ok: true, version })
      try { await save(env.DB, { ...data, ...patch }, keys, version); return json({ ok: true, version: version + 1 }) }
      catch (e) { if (String(e).includes('conflict')) continue; return json({ error: String(e) }, 500) }
    }
    return json({ error: 'conflict' }, 409)
  }
  // 多语言：POST /api/translate { to, texts[] } → { map }。先查 D1 缓存，缺失的用 Workers AI(m2m100) 翻译后写回缓存
  if (path === 'translate' && request.method === 'POST') {
    const url = new URL(request.url)
    const LANGS = ['en', 'vi', 'fr', 'ko', 'ja', 'ms', 'ru', 'ar']
    const body = (await request.json()) as { to?: string; texts?: string[] }
    const to = body.to ?? ''
    if (!LANGS.includes(to)) return json({ error: 'unsupported language' }, 400)
    const texts = [...new Set((body.texts ?? []).filter(t => typeof t === 'string' && t.length > 0 && t.length <= 400))].slice(0, 80)
    const map: Record<string, string> = {}
    for (let i = 0; i < texts.length; i += 40) {
      const part = texts.slice(i, i + 40)
      const rows = await env.DB.prepare(`SELECT src, dst FROM i18n WHERE lang = ?1 AND src IN (${part.map((_, k) => `?${k + 2}`).join(',')})`).bind(to, ...part).all<{ src: string; dst: string }>()
      rows.results.forEach(r => { map[r.src] = r.dst })
    }
    const missing = texts.filter(t => !(t in map))
    const model = TR_MODELS.includes(url.searchParams.get('model') ?? '') ? url.searchParams.get('model')! : TR_MODELS[0]
    const nocache = url.searchParams.get('nocache') === '1'
    if (missing.length && env.AI) {
      const done: [string, string][] = []
      const chunks: string[][] = []
      for (let i = 0; i < missing.length; i += 20) chunks.push(missing.slice(i, i + 20))
      await Promise.all(chunks.map(async part => {
        let out: (string | null)[] | null = null
        try { out = await translateBatch(env.AI!, model, to, part) } catch { out = null }
        const ok = (k: number) => { const v = out?.[k]; return v && validTr(to, part[k], v) ? v : null }
        const retry = part.filter((_, k) => !ok(k))
        let out2: (string | null)[] | null = null
        if (retry.length) { try { out2 = await translateBatch(env.AI!, TR_MODELS[1], to, retry) } catch { out2 = null } }
        part.forEach((t, k) => {
          let v = ok(k)
          if (!v && out2) { const j = retry.indexOf(t); const w = out2[j]; if (w && validTr(to, t, w)) v = w }
          if (v) { map[t] = v; done.push([t, v]) }
        })
      }))
      if (done.length && !nocache) await env.DB.batch(done.map(([s1, d]) => env.DB.prepare('INSERT OR REPLACE INTO i18n (lang, src, dst) VALUES (?1, ?2, ?3)').bind(to, s1, d)))
    }
    return json({ map })
  }
  // 图片资源：POST /api/asset { data: dataURL } → { url }；GET /api/asset/:id 返回图片
  if (path === 'asset' && request.method === 'POST') {
    const body = (await request.json()) as { data?: string }
    const m = /^data:(image\/[a-z+]+);base64,(.+)$/i.exec(body.data ?? '')
    if (!m) return json({ error: 'bad image' }, 400)
    if (m[2].length > 1_400_000) return json({ error: 'image too large' }, 413)
    const id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`
    await env.DB.prepare('INSERT INTO assets (id, mime, data, ts) VALUES (?1, ?2, ?3, ?4)').bind(id, m[1], m[2], Date.now()).run()
    return json({ url: `/api/asset/${id}` })
  }
  if (path.startsWith('asset/') && request.method === 'GET') {
    const row = await env.DB.prepare('SELECT mime, data FROM assets WHERE id = ?1').bind(path.slice(6)).first<{ mime: string; data: string }>()
    if (!row) return new Response('not found', { status: 404 })
    const bin = Uint8Array.from(atob(row.data), c => c.charCodeAt(0))
    return new Response(bin, { headers: { 'content-type': row.mime, 'cache-control': 'public, max-age=31536000, immutable', 'access-control-allow-origin': '*' } })
  }
  if (path.startsWith('live/')) return liveApi(env.DB, request, path.split('/').slice(1))
  // 统一支付网关：Apple Pay / Google Pay / PayOS（见 src/server/pay.ts）
  if (path.startsWith('pay/')) return payApi(env, request, path.split('/').slice(1), json, { load, save })
  return json({ error: 'not found' }, 404)
}
