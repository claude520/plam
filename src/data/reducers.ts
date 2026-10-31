// 纯函数数据变更层：前端（zustand）与 Cloudflare Worker（D1）共用同一份逻辑，保证两端计算结果一致。
import type {
  Address, Announcement, Banner, Campaign, CartItem, Category, Coupon, Message, Order, OrderStatus,
  PaymentProvider, Product, Refund, Review, Shop, User, AuditLog, AdminRole, LiveRoom, LiveConfig, Violation, AdPlan, AdKeyword,
} from './types'

export interface DataState {
  users: User[]; shops: Shop[]; categories: Category[]; products: Product[]; orders: Order[]
  addresses: Address[]; cart: CartItem[]; coupons: Coupon[]; reviews: Review[]; refunds: Refund[]
  banners: Banner[]; announcements: Announcement[]; paymentProviders: PaymentProvider[]; campaigns: Campaign[]
  auditLogs: AuditLog[]; messages: Message[]; adminRoles: AdminRole[]
  lives: LiveRoom[]; liveConfigs: LiveConfig[]
  violations: Violation[]; adPlans: AdPlan[]
  favorites: string[]; footprints: { productId: string; time: string }[]; followedShops: string[]
  myCoupons: { couponId: string; used: boolean }[]
  settings: { siteName: string; slogan: string; commissionRate: number; freightDefault: number; autoConfirmDays: number; maintenance: boolean }
}
export const COLLECTIONS = ['users', 'shops', 'categories', 'products', 'orders', 'addresses', 'cart', 'coupons', 'reviews', 'refunds', 'banners', 'announcements', 'paymentProviders', 'campaigns', 'auditLogs', 'messages', 'adminRoles', 'lives', 'liveConfigs', 'violations', 'adPlans', 'favorites', 'footprints', 'followedShops', 'myCoupons', 'settings'] as const satisfies readonly (keyof DataState)[]

/** 每次变更由调用方生成的上下文（id / 时间），保证前后端结果一致 */
export interface Ctx { id: string; now: string }
type P = Partial<DataState>
const round = (n: number) => Math.round(n * 100) / 100

export const reducers = {
  addToCart: (s: DataState, productId: string, skuId: string, qty: number, c: Ctx): P => {
    const ex = s.cart.find(x => x.productId === productId && x.skuId === skuId)
    if (ex) return { cart: s.cart.map(x => x.id === ex.id ? { ...x, qty: x.qty + qty, checked: true } : x) }
    return { cart: [{ id: c.id, productId, skuId, qty, checked: true, addedAt: c.now }, ...s.cart] }
  },
  updateCart: (s: DataState, id: string, patch: Partial<CartItem>): P => ({ cart: s.cart.map(x => x.id === id ? { ...x, ...patch } : x) }),
  removeCart: (s: DataState, ids: string[]): P => ({ cart: s.cart.filter(x => !ids.includes(x.id)) }),
  toggleAllCart: (s: DataState, checked: boolean): P => ({ cart: s.cart.map(x => ({ ...x, checked })) }),
  toggleFavorite: (s: DataState, productId: string): P => ({ favorites: s.favorites.includes(productId) ? s.favorites.filter(x => x !== productId) : [productId, ...s.favorites] }),
  addFootprint: (s: DataState, productId: string, c: Ctx): P => ({ footprints: [{ productId, time: c.now }, ...s.footprints.filter(f => f.productId !== productId)].slice(0, 60) }),
  toggleFollowShop: (s: DataState, shopId: string): P => ({ followedShops: s.followedShops.includes(shopId) ? s.followedShops.filter(x => x !== shopId) : [shopId, ...s.followedShops] }),
  claimCoupon: (s: DataState, couponId: string): P => s.myCoupons.some(x => x.couponId === couponId) ? {} : { myCoupons: [...s.myCoupons, { couponId, used: false }], coupons: s.coupons.map(x => x.id === couponId ? { ...x, used: x.used + 1 } : x) },

  createOrder: (s: DataState, userId: string, items: Order['items'], shopId: string, address: Address, opts: { discount: number; freight: number; note?: string; couponId?: string; liveId?: string; adPlanId?: string }, c: Ctx): P => {
    const total = round(items.reduce((a, it) => a + it.price * it.qty, 0))
    const o: Order = { id: c.id, userId, shopId, items, total, freight: opts.freight, discount: opts.discount, payAmount: round(total + opts.freight - opts.discount), status: 'unpaid', createdAt: c.now, address, note: opts.note, liveId: opts.liveId, adPlanId: opts.adPlanId }
    return { orders: [o, ...s.orders], myCoupons: opts.couponId ? s.myCoupons.map(m => m.couponId === opts.couponId ? { ...m, used: true } : m) : s.myCoupons }
  },
  payOrder: (s: DataState, orderId: string, provider: string, c: Ctx): P => {
    const o = s.orders.find(x => x.id === orderId)
    if (!o || o.status !== 'unpaid') return {}
    const users = provider === 'balance' ? s.users.map(u => u.id === o.userId ? { ...u, balance: round(u.balance - o.payAmount) } : u) : s.users
    return {
      orders: s.orders.map(x => x.id === orderId ? { ...x, status: 'paid' as OrderStatus, paidAt: c.now, payment: { provider, tradeNo: c.id } } : x),
      products: s.products.map(p => { const it = o.items.find(i => i.productId === p.id); if (!it) return p; const sku = it.skuText; return { ...p, sales: p.sales + it.qty, stock: Math.max(0, p.stock - it.qty), skus: p.skus.map(k => Object.values(k.attrs).join(' / ') === sku ? { ...k, stock: Math.max(0, k.stock - it.qty) } : k) } }),
      users,
      ...(o.adPlanId && s.adPlans.some(p => p.id === o.adPlanId) ? { adPlans: s.adPlans.map(p => p.id === o.adPlanId ? bumpAd(p, c, 0, 0, 1, o.payAmount) : p) } : {}),
      ...(o.liveId && s.lives.some(l => l.id === o.liveId) ? { lives: s.lives.map(l => l.id === o.liveId ? { ...l, stats: { ...l.stats, orders: l.stats.orders + 1, gmv: round(l.stats.gmv + o.payAmount) }, keypoints: l.keypoints.map((k, i, arr) => i === arr.length - 1 && !k.end && o.items.some(it => it.productId === k.productId) ? { ...k, orders: k.orders + 1 } : k) } : l) } : {}),
    }
  },
  updateOrder: (s: DataState, orderId: string, patch: Partial<Order>): P => ({ orders: s.orders.map(x => x.id === orderId ? { ...x, ...patch } : x) }),
  setOrderStatus: (s: DataState, orderId: string, status: OrderStatus, c: Ctx): P => ({ orders: s.orders.map(x => x.id === orderId ? { ...x, status, ...(status === 'done' || status === 'received' ? { doneAt: c.now } : {}) } : x) }),
  shipOrder: (s: DataState, orderId: string, company: string, no: string, c: Ctx): P => ({ orders: s.orders.map(x => x.id === orderId && x.status === 'paid' ? { ...x, status: 'shipped' as OrderStatus, shippedAt: c.now, shipType: x.shipType ?? 'express', logistics: { company, no, traces: [{ time: c.now, text: `【发货】商家已发货，${company} 已揽收，运单号 ${no}` }] } } : x) }),
  addReview: (s: DataState, r: Omit<Review, 'id' | 'createdAt'>, c: Ctx): P => ({ reviews: [{ ...r, id: c.id, createdAt: c.now }, ...s.reviews], products: s.products.map(p => p.id === r.productId ? { ...p, reviewCount: p.reviewCount + 1 } : p) }),
  // —— 违规 ——
  addViolation: (s: DataState, v: Omit<Violation, 'id' | 'createdAt' | 'status'>, c: Ctx): P => ({ violations: [{ ...v, id: c.id, createdAt: c.now, status: 'pending' }, ...s.violations] }),
  appealViolation: (s: DataState, id: string, text: string, images: string[], c: Ctx): P => ({ violations: s.violations.map(v => v.id === id && (v.status === 'pending' || v.status === 'appealing') ? { ...v, status: 'reviewing', appeal: { text, images, at: c.now } } : v) }),
  judgeViolation: (s: DataState, id: string, ok: boolean, text: string, c: Ctx): P => ({ violations: s.violations.map(v => v.id === id ? { ...v, status: ok ? 'revoked' : 'upheld', result: { ok, text, at: c.now } } : v) }),
  ignoreViolation: (s: DataState, ids: string[]): P => ({ violations: s.violations.map(v => ids.includes(v.id) ? { ...v, ignored: true } : v) }),
  // —— 关键词推广 ——
  upsertAdPlan: (s: DataState, plan: AdPlan): P => ({ adPlans: s.adPlans.some(x => x.id === plan.id) ? s.adPlans.map(x => x.id === plan.id ? plan : x) : [plan, ...s.adPlans] }),
  removeAdPlans: (s: DataState, ids: string[]): P => ({ adPlans: s.adPlans.filter(x => !ids.includes(x.id)) }),
  /** 广告展现：一次搜索结果页对多个计划各记 1 次 */
  adImpress: (s: DataState, planIds: string[], c: Ctx): P => ({ adPlans: s.adPlans.map(p => planIds.includes(p.id) ? bumpAd(p, c, 0, 0, 0, 0) : p) }),
  /**
   * 广告点击：按竞价结算价（不高于出价）从店主余额扣费。
   * 当日预算用完则当天下线（不扣费、次日自动恢复，最后一次点击只扣剩余预算）；余额不足才暂停计划。
   */
  adClick: (s: DataState, planId: string, word: string, price: number, c: Ctx): P => {
    const plan = s.adPlans.find(p => p.id === planId)
    if (!plan || plan.status !== 'on') return {}
    const shop = s.shops.find(x => x.id === plan.shopId)
    const owner = s.users.find(u => u.id === shop?.ownerId)
    const today = (plan.daily[c.now.slice(0, 10)] ?? [0, 0, 0, 0, 0])[2]
    const left = +(plan.dailyBudget - today).toFixed(2)
    if (left <= 0) return {}
    const cost = +Math.min(left, Math.max(AD_RESERVE, Math.min(adBid(plan, word), price || adBid(plan, word)))).toFixed(2)
    if (!owner || owner.balance < cost) return { adPlans: s.adPlans.map(p => p.id === planId ? { ...p, status: 'paused' as const } : p) }
    return { users: s.users.map(u => u.id === owner.id ? { ...u, balance: +(u.balance - cost).toFixed(2) } : u), adPlans: s.adPlans.map(p => p.id === planId ? bumpAd(p, c, 1, cost, 0, 0) : p) }
  },
  replyReview: (s: DataState, id: string, reply: string, c: Ctx): P => ({ reviews: s.reviews.map(r => r.id === id ? { ...r, reply, replyAt: c.now } : r) }),
  /** 无需物流发货（虚拟商品 / 无货源代发）：直接标记已发货，可附发货内容 */
  deliverOrder: (s: DataState, orderId: string, content: string, c: Ctx): P => ({ orders: s.orders.map(x => x.id === orderId && x.status === 'paid' ? { ...x, status: 'shipped' as OrderStatus, shippedAt: c.now, shipType: 'none' as const, deliverNote: content || undefined, logistics: { company: '无需物流', no: '', traces: [{ time: c.now, text: content ? '【发货】商家已发货（无需物流），发货内容已发送给买家' : '【发货】商家已发货（无需物流）' }] } } : x) }),
  /** 补发货：追加一条发货记录，可换物流或补发内容 */
  reshipOrder: (s: DataState, orderId: string, company: string, no: string, content: string, c: Ctx): P => ({ orders: s.orders.map(x => x.id === orderId && x.logistics ? { ...x, ...(content ? { deliverNote: [x.deliverNote, content].filter(Boolean).join('\n') } : {}), logistics: { company: company || x.logistics.company, no: no || x.logistics.no, traces: [...x.logistics.traces, { time: c.now, text: company && company !== '无需物流' ? `【补发货】商家已补发，${company} 运单号 ${no}` : '【补发货】商家已补发货' + (content ? '，补发内容已发送给买家' : '') }] } } : x) }),
  createRefund: (s: DataState, r: Omit<Refund, 'id' | 'createdAt' | 'status'>, c: Ctx): P => ({ refunds: [{ ...r, id: `R${c.id.slice(-8).toUpperCase()}`, createdAt: c.now, status: 'pending' }, ...s.refunds], orders: s.orders.map(o => o.id === r.orderId ? { ...o, status: 'refunding' as OrderStatus } : o) }),
  updateRefund: (s: DataState, id: string, patch: Partial<Refund>): P => {
    const rf = s.refunds.find(r => r.id === id)
    const refunds = s.refunds.map(r => r.id === id ? { ...r, ...patch } : r)
    let orders = s.orders; let users = s.users
    if (rf && patch.status === 'refunded') { orders = s.orders.map(o => o.id === rf.orderId ? { ...o, status: 'closed' as OrderStatus } : o); users = s.users.map(u => u.id === rf.userId ? { ...u, balance: round(u.balance + rf.amount) } : u) }
    if (rf && (patch.status === 'rejected' || patch.status === 'cancelled')) orders = s.orders.map(o => o.id === rf.orderId ? { ...o, status: (o.shippedAt ? 'shipped' : 'paid') as OrderStatus } : o)
    return { refunds, orders, users }
  },
  upsertAddress: (s: DataState, a: Address): P => {
    const exists = s.addresses.some(x => x.id === a.id)
    let list = exists ? s.addresses.map(x => x.id === a.id ? a : x) : [...s.addresses, a]
    if (a.isDefault) list = list.map(x => x.userId === a.userId && x.id !== a.id ? { ...x, isDefault: false } : x)
    return { addresses: list }
  },
  removeAddress: (s: DataState, id: string): P => ({ addresses: s.addresses.filter(a => a.id !== id) }),
  upsertProduct: (s: DataState, p: Product): P => ({ products: s.products.some(x => x.id === p.id) ? s.products.map(x => x.id === p.id ? p : x) : [p, ...s.products] }),
  removeProduct: (s: DataState, id: string): P => ({ products: s.products.filter(p => p.id !== id) }),
  updateUser: (s: DataState, id: string, patch: Partial<User>): P => ({ users: s.users.map(u => u.id === id ? { ...u, ...patch } : u) }),
  registerUser: (s: DataState, u: Omit<User, 'createdAt'>, c: Ctx): P => s.users.some(x => x.username === u.username) ? {} : ({ users: [...s.users, { ...u, createdAt: c.now }] }),
  updateShop: (s: DataState, id: string, patch: Partial<Shop>): P => ({ shops: s.shops.map(x => x.id === id ? { ...x, ...patch } : x) }),
  upsertCategory: (s: DataState, cat: Category): P => ({ categories: s.categories.some(x => x.id === cat.id) ? s.categories.map(x => x.id === cat.id ? cat : x) : [...s.categories, cat] }),
  removeCategory: (s: DataState, id: string): P => ({ categories: s.categories.filter(c => c.id !== id && c.parentId !== id) }),
  upsertCoupon: (s: DataState, cp: Coupon): P => ({ coupons: s.coupons.some(x => x.id === cp.id) ? s.coupons.map(x => x.id === cp.id ? cp : x) : [cp, ...s.coupons] }),
  removeCoupon: (s: DataState, id: string): P => ({ coupons: s.coupons.filter(c => c.id !== id) }),
  upsertBanner: (s: DataState, b: Banner): P => ({ banners: s.banners.some(x => x.id === b.id) ? s.banners.map(x => x.id === b.id ? b : x) : [...s.banners, b] }),
  removeBanner: (s: DataState, id: string): P => ({ banners: s.banners.filter(b => b.id !== id) }),
  upsertAnnouncement: (s: DataState, a: Announcement): P => ({ announcements: s.announcements.some(x => x.id === a.id) ? s.announcements.map(x => x.id === a.id ? a : x) : [a, ...s.announcements] }),
  removeAnnouncement: (s: DataState, id: string): P => ({ announcements: s.announcements.filter(a => a.id !== id) }),
  updatePayment: (s: DataState, id: string, patch: Partial<PaymentProvider>): P => ({ paymentProviders: s.paymentProviders.map(p => p.id === id ? { ...p, ...patch } : p) }),
  upsertCampaign: (s: DataState, cm: Campaign): P => ({ campaigns: s.campaigns.some(x => x.id === cm.id) ? s.campaigns.map(x => x.id === cm.id ? cm : x) : [cm, ...s.campaigns] }),
  removeCampaign: (s: DataState, id: string): P => ({ campaigns: s.campaigns.filter(c => c.id !== id) }),
  upsertRole: (s: DataState, r: AdminRole): P => ({ adminRoles: s.adminRoles.some(x => x.id === r.id) ? s.adminRoles.map(x => x.id === r.id ? r : x) : [...s.adminRoles, r] }),
  removeRole: (s: DataState, id: string): P => ({ adminRoles: s.adminRoles.filter(r => r.id !== id) }),
  sendMessage: (s: DataState, m: Omit<Message, 'id' | 'time' | 'read'>, c: Ctx): P => ({ messages: [...s.messages, { ...m, id: c.id, time: c.now, read: false }] }),
  markRead: (s: DataState, shopId: string, from: string): P => ({ messages: s.messages.map(m => m.shopId === shopId && m.from === from ? { ...m, read: true } : m) }),
  updateSettings: (s: DataState, patch: Partial<DataState['settings']>): P => ({ settings: { ...s.settings, ...patch } }),
  log: (s: DataState, actor: string, action: string, target: string, c: Ctx): P => ({ auditLogs: [{ id: c.id, actor, action, target, time: c.now, ip: '0.0.0.0' }, ...s.auditLogs].slice(0, 500) }),

  // ---------------- 直播 ----------------
  upsertLive: (s: DataState, l: LiveRoom): P => ({ lives: s.lives.some(x => x.id === l.id) ? s.lives.map(x => x.id === l.id ? l : x) : [l, ...s.lives] }),
  removeLive: (s: DataState, id: string): P => ({ lives: s.lives.filter(l => l.id !== id) }),
  updateLive: (s: DataState, id: string, patch: Partial<LiveRoom>): P => ({ lives: s.lives.map(l => l.id === id ? { ...l, ...patch } : l) }),
  startLive: (s: DataState, id: string, c: Ctx): P => ({ lives: s.lives.map(l => l.id === id && l.status !== 'ended' ? { ...l, status: 'live', startedAt: c.now, stats: { ...l.stats, viewers: 0 } } : l) }),
  endLive: (s: DataState, id: string, stats: Partial<LiveRoom['stats']>, c: Ctx): P => ({ lives: s.lives.map(l => l.id === id ? { ...l, status: 'ended', endedAt: c.now, explainingId: undefined, stats: { ...l.stats, ...stats, viewers: 0, duration: l.startedAt ? Math.max(1, Math.round((new Date(c.now).getTime() - new Date(l.startedAt).getTime()) / 60000)) : l.stats.duration }, keypoints: l.keypoints.map(k => k.end ? k : { ...k, end: c.now }) } : l) }),
  setLiveExplain: (s: DataState, id: string, productId: string | null, c: Ctx): P => ({ lives: s.lives.map(l => {
    if (l.id !== id) return l
    const kps = l.keypoints.map(k => k.end ? k : { ...k, end: c.now })
    return { ...l, explainingId: productId ?? undefined, keypoints: productId ? [...kps, { productId, start: c.now, clicks: 0, orders: 0 }] : kps }
  }) }),
  setLiveProducts: (s: DataState, id: string, productIds: string[], livePrices?: Record<string, number>): P => ({ lives: s.lives.map(l => l.id === id ? { ...l, productIds, livePrices: livePrices ?? l.livePrices } : l) }),
  bumpLiveStats: (s: DataState, id: string, delta: Partial<LiveRoom['stats']>): P => ({ lives: s.lives.map(l => l.id === id ? { ...l, stats: Object.fromEntries(Object.entries(l.stats).map(([k, v]) => [k, k === 'viewers' ? ((delta as Record<string, number>)[k] ?? v) : k === 'peak' ? Math.max(v, (delta as Record<string, number>)[k] ?? v) : v + ((delta as Record<string, number>)[k] ?? 0)])) as LiveRoom['stats'] } : l) }),
  upsertLiveConfig: (s: DataState, cfg: LiveConfig): P => ({ liveConfigs: s.liveConfigs.some(x => x.shopId === cfg.shopId) ? s.liveConfigs.map(x => x.shopId === cfg.shopId ? cfg : x) : [...s.liveConfigs, cfg] }),
  followLive: (s: DataState, shopId: string, liveId: string): P => s.followedShops.includes(shopId) ? {} : ({ followedShops: [shopId, ...s.followedShops], shops: s.shops.map(x => x.id === shopId ? { ...x, fans: x.fans + 1 } : x), lives: s.lives.map(l => l.id === liveId ? { ...l, stats: { ...l.stats, newFans: l.stats.newFans + 1 } } : l) }),
}
export type Reducers = typeof reducers
export type ReducerName = keyof Reducers
/** 需要 Ctx（id/时间）作为末尾参数的 reducer */
export const CTX_REDUCERS = new Set<ReducerName>(['addViolation', 'appealViolation', 'judgeViolation', 'adImpress', 'adClick', 'addToCart', 'addFootprint', 'createOrder', 'payOrder', 'setOrderStatus', 'shipOrder', 'deliverOrder', 'reshipOrder', 'replyReview', 'addReview', 'createRefund', 'registerUser', 'sendMessage', 'log', 'startLive', 'endLive', 'setLiveExplain'])

/** 最低点击扣费（保留价） */
export const AD_RESERVE = 0.05
/** 关键词出价：手动出价取关键词出价；智能出价按目标自动在建议价上浮动 */
export function adBid(plan: AdPlan, word: string): number {
  const k = plan.keywords.find(x => x.word === word)
  const base = k?.bid ?? 0.8
  if (plan.bidMode === 'manual') return base
  return +(base * (plan.goal === 'orders' ? 1.2 : plan.goal === 'cart' ? 1.1 : 1)).toFixed(2)
}
/** 建议出价：按该词下的竞争计划数估算 */
export function adSuggestBid(plans: AdPlan[], word: string): number {
  const n = plans.filter(p => p.status === 'on' && p.keywords.some(k => adMatch(k, word))).length
  return +(0.5 + n * 0.3).toFixed(2)
}
/**
 * 质量分（1~10）：关键词与宝贝标题相关性 + 计划历史点击率 + 宝贝评分与销量。
 * 与直通车一致：综合排名 = 出价 × 质量分。
 */
export function adQuality(plan: AdPlan, p: Product, word: string): number {
  const t = p.title.toLowerCase(), w = word.toLowerCase()
  let q = 4
  if (t.includes(w)) q += 2
  else if (w.split(/\s+/).some(x => x && t.includes(x))) q += 1
  const ctr = plan.stats.impressions > 20 ? plan.stats.clicks / plan.stats.impressions : 0.03
  q += Math.min(2, ctr * 30)
  if (p.rating >= 4.8) q += 1
  if (p.sales > 100) q += 1
  return Math.max(1, Math.min(10, +q.toFixed(1)))
}
export interface AdSlot { planId: string; productId: string; word: string; bid: number; quality: number; score: number; price: number }
/**
 * 关键词竞价（广义第二价格 GSP）：
 * 1. 每个在投计划用命中的关键词参与，每个宝贝取最高综合分 = 出价 × 质量分；
 * 2. 按综合分降序取前 slots 个广告位；
 * 3. 实际扣费 = 下一名综合分 ÷ 自己质量分 + 0.01，不超过自己的出价，不低于保留价。
 */
export function adAuction(s: Pick<DataState, 'adPlans' | 'products' | 'shops' | 'users'>, q: string, slots = 4, today = new Date().toISOString().slice(0, 10)): AdSlot[] {
  if (!q.trim()) return []
  const best = new Map<string, Omit<AdSlot, 'price'>>()
  const nowIso = new Date().toISOString()
  for (const plan of s.adPlans) {
    if (plan.status !== 'on' || nowIso < plan.startAt || nowIso > plan.endAt) continue
    if ((plan.daily[today]?.[2] ?? 0) >= plan.dailyBudget) continue
    const owner = s.users.find(u => u.id === s.shops.find(x => x.id === plan.shopId)?.ownerId)
    if (!owner || owner.balance < AD_RESERVE) continue
    const words = plan.keywords.filter(k => adMatch(k, q))
    if (!words.length) continue
    for (const pid of plan.productIds) {
      const p = s.products.find(x => x.id === pid && x.status === 'on')
      if (!p) continue
      for (const k of words) {
        const bid = adBid(plan, k.word), quality = adQuality(plan, p, k.word), score = bid * quality
        const cur = best.get(pid)
        if (!cur || score > cur.score) best.set(pid, { planId: plan.id, productId: pid, word: k.word, bid, quality, score })
      }
    }
  }
  const ranked = [...best.values()].sort((a, b) => b.score - a.score)
  return ranked.slice(0, slots).map((x, i) => {
    const next = ranked[i + 1]
    const price = next ? Math.min(x.bid, next.score / x.quality + 0.01) : AD_RESERVE
    return { ...x, price: +Math.max(AD_RESERVE, price).toFixed(2) }
  })
}
/** 搜索词是否命中关键词：精准匹配需完全相同，广泛匹配互相包含即可 */
export function adMatch(k: AdKeyword, q: string): boolean {
  const a = k.word.trim().toLowerCase(), b = q.trim().toLowerCase()
  if (!a || !b) return false
  return k.match === 'exact' ? a === b : a.includes(b) || b.includes(a)
}
function bumpAd(p: AdPlan, c: Ctx, clicks: number, spend: number, orders: number, gmv: number): AdPlan {
  const day = c.now.slice(0, 10)
  const d = p.daily[day] ?? [0, 0, 0, 0, 0]
  const impressions = clicks || spend || orders ? 0 : 1
  return {
    ...p,
    stats: { ...p.stats, impressions: p.stats.impressions + impressions, clicks: p.stats.clicks + clicks, spend: +(p.stats.spend + spend).toFixed(2), orders: p.stats.orders + orders, gmv: +(p.stats.gmv + gmv).toFixed(2) },
    daily: { ...p.daily, [day]: [d[0] + impressions, d[1] + clicks, +(d[2] + spend).toFixed(2), d[3] + orders, +(d[4] + gmv).toFixed(2)] },
  }
}
