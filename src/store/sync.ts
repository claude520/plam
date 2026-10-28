// 与 Cloudflare Pages Functions (D1) 同步：启动拉取全量数据，变更即时推送，并定时轮询其他端的更新。
import type { StoreApi, UseBoundStore } from 'zustand'
import type { DataState } from '@/data/reducers'
import { COLLECTIONS } from '@/data/reducers'

type Store = UseBoundStore<StoreApi<DataState & { _version: number; _remote: boolean }>>
const API = '/api'
let store: Store | null = null
let version = 0
let inflight = 0
let timer: number | undefined
let queue: Promise<unknown> = Promise.resolve()

const pick = (s: DataState) => Object.fromEntries(COLLECTIONS.map(k => [k, s[k]])) as unknown as DataState

async function pull() {
  if (!store) return
  try {
    const r = await fetch(`${API}/state`, { headers: { 'cache-control': 'no-cache' } })
    if (!r.ok) throw new Error(String(r.status))
    const j = (await r.json()) as { version: number; data: DataState }
    if (inflight === 0 && j.version !== version) { version = j.version; store.setState({ ...j.data, _version: j.version, _remote: true }) }
    else if (!store.getState()._remote) store.setState({ _remote: true })
  } catch { /* 无后端（本地纯前端模式）时静默降级为本地存储 */ }
}

async function poll() {
  if (!store || !store.getState()._remote || inflight > 0) return
  try {
    const r = await fetch(`${API}/version`, { headers: { 'cache-control': 'no-cache' } })
    if (!r.ok) return
    const j = (await r.json()) as { version: number }
    if (j.version !== version) await pull()
  } catch { /* ignore */ }
}

export const sync = {
  /** 立即从服务端拉取最新数据（例如服务端确认支付后） */
  refresh: () => pull(),
  attach(s: Store) {
    store = s
    if (typeof window === 'undefined') return
    const start = () => { pull(); timer = window.setInterval(poll, 8000) }
    const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => void }
    if (w.requestIdleCallback) w.requestIdleCallback(start, { timeout: 3000 })
    else setTimeout(start, 1500)
    window.addEventListener('focus', poll)
  },
  mutate(name: string, args: unknown[]) {
    if (!store || !store.getState()._remote) return
    inflight++
    queue = queue.then(async () => {
      try {
        const r = await fetch(`${API}/mutate`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name, args, base: version }) })
        if (r.ok) { const j = (await r.json()) as { version: number }; version = j.version }
        else if (r.status === 409) { inflight--; await pull(); inflight++ }
      } catch { /* 离线：保留本地变更 */ }
      finally { inflight-- }
    })
  },
  async reset() {
    if (!store) return
    try { await fetch(`${API}/reset`, { method: 'POST' }); await pull() } catch { /* ignore */ }
  },
  snapshot: () => (store ? pick(store.getState()) : null),
  stop() { if (timer) clearInterval(timer) },
}
