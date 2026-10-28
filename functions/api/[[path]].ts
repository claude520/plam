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
import { reducers, COLLECTIONS, type DataState, type ReducerName } from '../../src/data/reducers'
import { initialState } from '../../src/data/initial'

interface Env { DB: D1Database }
type Row = { key: string; data: string }

const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'access-control-allow-origin': '*' } })

async function ensure(db: D1Database) {
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
    const { version, data } = await load(env.DB)
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
  if (path.startsWith('pay/')) {
    // 统一支付网关占位：真实环境在此转发至第三方支付（微信 / 银联 / Stripe …）
    return json({ ok: true, gateway: 'plam-pay', provider: path.split('/')[1], message: '演示环境：支付回调已模拟' })
  }
  return json({ error: 'not found' }, 404)
}
