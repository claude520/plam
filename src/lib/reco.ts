// 个性化推荐：用户行为埋点 → 兴趣画像（类目 / 关键词 / 店铺 / 价格带，时间衰减）
// 召回：协同过滤（同一用户共同购买 / 加购 / 收藏）+ 内容相似（TF-IDF 余弦）+ 兴趣类目 + 热销
// 排序：兴趣匹配 + 协同分 + 质量 + 新品，MMR 多样性重排（同类目 / 同店铺打散），并给出推荐理由
import type { Order, Product } from '@/data/types'
import { normalize, quality } from './search'

export type BehaviorType = 'view' | 'click' | 'fav' | 'cart' | 'buy' | 'search'
export interface Behavior { t: BehaviorType; id?: string; q?: string; at: number }

const WEIGHT: Record<BehaviorType, number> = { view: 1, click: 1, search: 1.5, fav: 3, cart: 4, buy: 5 }
const HALF_LIFE = 3 * 864e5
const KEY = (uid?: string | null) => 'plam-bhv:' + (uid || 'guest')
const MAX = 300

export function loadBehaviors(uid?: string | null): Behavior[] {
  try { return JSON.parse(localStorage.getItem(KEY(uid)) ?? '[]') as Behavior[] } catch { return [] }
}
const listeners = new Set<() => void>()
export function onBehavior(fn: () => void) { listeners.add(fn); return () => { listeners.delete(fn) } }

/** 记录一次行为（同一商品同类行为 10 分钟内只记一次） */
export function track(uid: string | null | undefined, b: Omit<Behavior, 'at'>) {
  try {
    const list = loadBehaviors(uid)
    const now = Date.now()
    if (list.some(x => x.t === b.t && x.id === b.id && x.q === b.q && now - x.at < 6e5)) return
    list.unshift({ ...b, at: now })
    localStorage.setItem(KEY(uid), JSON.stringify(list.slice(0, MAX)))
    listeners.forEach(f => f())
  } catch { /* 存储不可用时不影响主流程 */ }
}

// ---------- 内容向量 ----------
const vecCache = new WeakMap<Product[], { vec: Map<string, Map<string, number>>; norm: Map<string, number> }>()
function grams(p: Product): string[] {
  const t = normalize(p.title + ' ' + p.tags.join(' '))
  const out: string[] = []
  for (const run of t.match(/[㐀-鿿]+/g) ?? []) for (let i = 0; i + 2 <= run.length; i++) out.push(run.slice(i, i + 2))
  for (const w of t.match(/[a-z0-9]{2,}/g) ?? []) out.push(w)
  return out
}
/** 标题二元词 TF-IDF 向量 */
function vectors(products: Product[]) {
  const hit = vecCache.get(products)
  if (hit) return hit
  const df = new Map<string, number>()
  const raw = new Map(products.map(p => { const g = grams(p); new Set(g).forEach(x => df.set(x, (df.get(x) ?? 0) + 1)); return [p.id, g] }))
  const N = products.length
  const vec = new Map<string, Map<string, number>>()
  const norm = new Map<string, number>()
  for (const [id, g] of raw) {
    const v = new Map<string, number>()
    g.forEach(x => v.set(x, (v.get(x) ?? 0) + 1))
    let n = 0
    for (const [k, tf] of v) { const w = (1 + Math.log(tf)) * Math.log(1 + N / (df.get(k) ?? 1)); v.set(k, w); n += w * w }
    vec.set(id, v); norm.set(id, Math.sqrt(n) || 1)
  }
  const r = { vec, norm }
  vecCache.set(products, r)
  return r
}

/** 内容相似度：TF-IDF 余弦 + 同叶子类目 0.25 + 同一级类目 0.1 + 同店 0.05 + 价格接近 0.1 */
export function contentSim(a: Product, b: Product, products: Product[]): number {
  const { vec, norm } = vectors(products)
  const va = vec.get(a.id), vb = vec.get(b.id)
  let dot = 0
  if (va && vb) for (const [k, w] of va) { const x = vb.get(k); if (x) dot += w * x }
  const cos = dot / ((norm.get(a.id) ?? 1) * (norm.get(b.id) ?? 1))
  const priceSim = 1 - Math.min(1, Math.abs(Math.log((a.price + 1) / (b.price + 1))) / 2)
  return 0.5 * cos + (a.categoryId === b.categoryId ? 0.25 : a.categoryId.split('-')[0] === b.categoryId.split('-')[0] ? 0.1 : 0) + (a.shopId === b.shopId ? 0.05 : 0) + 0.1 * priceSim
}

// ---------- 协同过滤（Item-CF） ----------
const cfCache = new WeakMap<Order[], Map<string, Map<string, number>>>()
/** 基于「同一用户买过的商品」共现，余弦归一：sim(i,j) = co(i,j) / √(n_i · n_j) */
export function itemCF(orders: Order[]): Map<string, Map<string, number>> {
  const hit = cfCache.get(orders)
  if (hit) return hit
  const byUser = new Map<string, Set<string>>()
  for (const o of orders) { if (o.status === 'closed' || o.status === 'unpaid') continue; const s = byUser.get(o.userId) ?? new Set(); o.items.forEach(i => s.add(i.productId)); byUser.set(o.userId, s) }
  const n = new Map<string, number>()
  const co = new Map<string, Map<string, number>>()
  for (const set of byUser.values()) {
    const ids = [...set]
    ids.forEach(i => n.set(i, (n.get(i) ?? 0) + 1))
    // 用户买得越多，单次共现越不代表关联（IUF 惩罚）
    const w = 1 / Math.log(2 + ids.length)
    for (const i of ids) for (const j of ids) if (i !== j) { const m = co.get(i) ?? new Map(); m.set(j, (m.get(j) ?? 0) + w); co.set(i, m) }
  }
  for (const [i, m] of co) for (const [j, c] of m) m.set(j, c / Math.sqrt((n.get(i) ?? 1) * (n.get(j) ?? 1)))
  cfCache.set(orders, co)
  return co
}

// ---------- 兴趣画像 ----------
export interface Profile { cats: Map<string, number>; tops: Map<string, number>; shops: Map<string, number>; items: Map<string, number>; words: Map<string, number>; price?: number; bought: Set<string>; total: number; /** 短期兴趣（近 48 小时行为，半衰期 12 小时） */ recent?: Profile }

export function buildProfile(behaviors: Behavior[], products: Product[], extra: { orders?: Order[]; cart?: string[]; favorites?: string[]; uid?: string | null; short?: boolean } = {}): Profile {
  const now = Date.now()
  const pm = new Map(products.map(p => [p.id, p]))
  const prof: Profile = { cats: new Map(), tops: new Map(), shops: new Map(), items: new Map(), words: new Map(), bought: new Set(), total: 0 }
  const bump = (m: Map<string, number>, k: string, w: number) => m.set(k, (m.get(k) ?? 0) + w)
  const prices: [number, number][] = []
  const addItem = (id: string, w: number) => {
    const p = pm.get(id)
    if (!p) return
    bump(prof.items, id, w); bump(prof.cats, p.categoryId, w); bump(prof.tops, p.categoryId.split('-')[0], w); bump(prof.shops, p.shopId, w)
    prices.push([Math.log(p.price + 1), w]); prof.total += w
  }
  for (const b of behaviors) {
    const decay = Math.pow(0.5, (now - b.at) / (extra.short ? HALF_LIFE / 6 : HALF_LIFE))
    const w = WEIGHT[b.t] * decay
    if (b.id) addItem(b.id, w)
    if (b.q) for (const g of normalize(b.q).split(' ')) if (g) { bump(prof.words, g, w); prof.total += w * 0.5 }
  }
  // 服务端已有的真实交易数据（订单、购物车、收藏）也计入
  for (const o of extra.orders ?? []) if (o.userId === extra.uid && o.status !== 'closed') o.items.forEach(i => { prof.bought.add(i.productId); addItem(i.productId, WEIGHT.buy * Math.pow(0.5, (now - Date.parse(o.createdAt)) / (HALF_LIFE * 10))) })
  extra.cart?.forEach(id => addItem(id, WEIGHT.cart * 0.5))
  extra.favorites?.forEach(id => addItem(id, WEIGHT.fav * 0.5))
  const sw = prices.reduce((a, [, w]) => a + w, 0)
  if (sw) prof.price = prices.reduce((a, [x, w]) => a + x * w, 0) / sw
  if (!extra.short) {
    const recent = behaviors.filter(b => now - b.at < 2 * 864e5)
    if (recent.length) prof.recent = buildProfile(recent, products, { short: true })
  }
  return prof
}

/** 兴趣匹配 0~1：短期兴趣占 60%、长期兴趣占 40%（实时反映刚刚的浏览 / 搜索） */
export function interest(p: Product, prof: Profile): number {
  return prof.recent?.total ? 0.6 * baseInterest(p, prof.recent) + 0.4 * baseInterest(p, prof) : baseInterest(p, prof)
}

/** 单个画像的匹配度：类目 / 一级类目 / 店铺 / 搜索词 / 价格带 */
function baseInterest(p: Product, prof: Profile): number {
  if (!prof.total) return 0
  const max = (m: Map<string, number>) => Math.max(1e-9, ...m.values())
  const c = (prof.cats.get(p.categoryId) ?? 0) / max(prof.cats)
  const t = (prof.tops.get(p.categoryId.split('-')[0]) ?? 0) / max(prof.tops)
  const s = prof.shops.size ? (prof.shops.get(p.shopId) ?? 0) / max(prof.shops) : 0
  const title = normalize(p.title)
  let w = 0
  if (prof.words.size) { const mw = max(prof.words); for (const [k, v] of prof.words) if (title.includes(k)) w = Math.max(w, v / mw) }
  const price = prof.price == null ? 0.5 : 1 - Math.min(1, Math.abs(Math.log(p.price + 1) - prof.price) / 2.5)
  return 0.35 * c + 0.15 * t + 0.1 * s + 0.25 * w + 0.15 * price
}

// ---------- 推荐 ----------
export interface Rec { p: Product; score: number; reason: string }

function rng(seed: number) { let x = seed * 9301 + 49297; return () => { x = (x * 9301 + 49297) % 233280; return x / 233280 } }

/**
 * 猜你喜欢：score = 0.4 兴趣 + 0.25 协同 + 0.2 质量 + 0.05 新品 + 0.1 探索扰动；
 * 已买过的降权 80%，最近刚看过的降权 30%；最后用 MMR 打散同类目、同店铺。
 */
export function recommend(products: Product[], orders: Order[], prof: Profile, opts: { n?: number; seed?: number; exclude?: string[]; context?: Product } = {}): Rec[] {
  const n = opts.n ?? 60
  const pool = products.filter(p => p.status === 'on' && !opts.exclude?.includes(p.id))
  if (!pool.length) return []
  const cf = itemCF(orders)
  const pm = new Map(products.map(p => [p.id, p]))
  const maxSales = Math.max(1, ...pool.map(p => p.sales))
  const newest = Math.max(...pool.map(p => Date.parse(p.createdAt) || 0))
  const rand = rng(opts.seed ?? 1)
  // 最强的种子商品（用于协同召回与理由）
  const seedMap = new Map(prof.items)
  // 短期行为的商品作为强种子（×3），保证刚看过的品类立即带出相似 / 协同商品
  if (prof.recent) { const top = Math.max(1, ...prof.items.values()); for (const [id, w] of prof.recent.items) seedMap.set(id, Math.max(seedMap.get(id) ?? 0, top * Math.min(3, w))) }
  const seeds = [...seedMap].sort((a, b) => b[1] - a[1]).slice(0, 12)
  if (opts.context) seeds.unshift([opts.context.id, Math.max(1, ...prof.items.values()) * 2])
  const maxSeed = Math.max(1e-9, ...seeds.map(s => s[1]))
  const recent = new Set(prof.recent ? prof.recent.items.keys() : [])
  const scored = pool.map(p => {
    let cfs = 0, cfFrom = '', simFrom = '', sims = 0
    for (const [id, w] of seeds) {
      if (id === p.id) continue
      const c = (cf.get(id)?.get(p.id) ?? 0) * (w / maxSeed)
      if (c > cfs) { cfs = c; cfFrom = id }
      const sp = pm.get(id)
      if (sp && seeds.length <= 13) { const s = contentSim(sp, p, products) * (w / maxSeed); if (s > sims) { sims = s; simFrom = id } }
    }
    const it = interest(p, prof)
    const q = quality(p, maxSales)
    const fresh = newest ? Math.max(0, 1 - (newest - (Date.parse(p.createdAt) || 0)) / (30 * 864e5)) : 0
    let score = prof.total ? 0.3 * it + 0.2 * Math.min(1, cfs) + 0.15 * sims + 0.2 * q + 0.05 * fresh + 0.1 * rand() : 0.6 * q + 0.15 * fresh + 0.25 * rand()
    if (prof.bought.has(p.id)) score *= 0.2
    else if (recent.has(p.id) && !opts.context) score *= 0.7
    const name = (id: string) => (pm.get(id)?.title ?? '').replace(/\s.*/, '').slice(0, 10)
    const reason = sims > 0.35 && simFrom && sims >= cfs ? `和你看过的「${name(simFrom)}」相似` : cfs > 0.3 && cfFrom ? `买过「${name(cfFrom)}」的人也买了` : sims > 0.35 && simFrom ? `和你看过的「${name(simFrom)}」相似` : it > 0.45 ? '根据你的浏览偏好' : p.sales > maxSales * 0.6 ? '热销榜单' : fresh > 0.7 ? '新品上市' : '为你精选'
    return { p, score, reason }
  }).sort((a, b) => b.score - a.score)
  // MMR：每次选 score - λ·与已选的重复惩罚 最大者
  const out: Rec[] = []
  const left = scored.slice(0, Math.min(scored.length, n * 3))
  const catCount = new Map<string, number>(), shopCount = new Map<string, number>()
  while (out.length < n && left.length) {
    let bi = 0, bv = -Infinity
    for (let i = 0; i < Math.min(left.length, 40); i++) {
      const r = left[i]
      const last = out.slice(-4)
      const pen = 0.12 * (catCount.get(r.p.categoryId) ?? 0) / Math.max(1, out.length / 4) + (last.some(x => x.p.categoryId === r.p.categoryId) ? 0.08 : 0) + (last.some(x => x.p.shopId === r.p.shopId) ? 0.06 : 0) + 0.02 * (shopCount.get(r.p.shopId) ?? 0)
      const v = r.score - pen
      if (v > bv) { bv = v; bi = i }
    }
    const [r] = left.splice(bi, 1)
    out.push(r)
    catCount.set(r.p.categoryId, (catCount.get(r.p.categoryId) ?? 0) + 1)
    shopCount.set(r.p.shopId, (shopCount.get(r.p.shopId) ?? 0) + 1)
  }
  return out
}

/** 看了又看：内容相似 0.6 + 协同 0.4 */
export function similarTo(p: Product, products: Product[], orders: Order[], n = 5): Product[] {
  const cf = itemCF(orders).get(p.id)
  return products.filter(x => x.id !== p.id && x.status === 'on').map(x => ({ x, s: 0.6 * contentSim(p, x, products) + 0.4 * Math.min(1, cf?.get(x.id) ?? 0) })).sort((a, b) => b.s - a.s).slice(0, n).map(r => r.x)
}

/** 买了又买：纯协同，不足时用同店同类目补齐 */
export function alsoBought(p: Product, products: Product[], orders: Order[], n = 5): Product[] {
  const cf = itemCF(orders).get(p.id)
  const pm = new Map(products.map(x => [x.id, x]))
  const list = [...(cf ?? new Map<string, number>())].sort((a, b) => b[1] - a[1]).map(([id]) => pm.get(id)).filter((x): x is Product => !!x && x.status === 'on')
  if (list.length < n) for (const x of similarTo(p, products, orders, n * 2)) if (!list.includes(x) && list.length < n) list.push(x)
  return list.slice(0, n)
}
