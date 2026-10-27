// Cloudflare Pages Functions：全站数据 API（D1 持久化）
// GET  /api/state    全量数据 + 版本号
// GET  /api/version  当前版本号
// POST /api/mutate   { name, args } 服务端执行与前端相同的 reducer
// POST /api/reset    重置为演示数据
import { reducers, COLLECTIONS, type DataState, type ReducerName } from '../../src/data/reducers'
import { initialState } from '../../src/data/initial'

interface Env { DB: D1Database }
type Row = { key: string; data: string }

const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'access-control-allow-origin': '*' } })

async function ensure(db: D1Database) {
  await db.exec('CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY, data TEXT NOT NULL); CREATE TABLE IF NOT EXISTS meta (id INTEGER PRIMARY KEY CHECK (id = 1), version INTEGER NOT NULL)')
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
  if (path.startsWith('pay/')) {
    // 统一支付网关占位：真实环境在此转发至第三方支付（微信 / 银联 / Stripe …）
    return json({ ok: true, gateway: 'plam-pay', provider: path.split('/')[1], message: '演示环境：支付回调已模拟' })
  }
  return json({ error: 'not found' }, 404)
}
