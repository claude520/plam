// 风控：刷评识别、订单风险评分、平台智能巡检（自动发现违规线索）
import type { Order, Product, Review, Shop, User, Violation } from '@/data/types'

// ---------- 刷评识别 ----------
export interface ReviewRisk { score: number; reasons: string[] }

function bigrams(s: string): Set<string> {
  const t = s.replace(/[\s\p{P}]/gu, '')
  const out = new Set<string>()
  for (let i = 0; i + 2 <= t.length; i++) out.add(t.slice(i, i + 2))
  return out
}
function jaccard(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0
  let n = 0
  for (const x of a) if (b.has(x)) n++
  return n / (a.size + b.size - n)
}
const GENERIC = /^(好评|很好|不错|挺好|好|满意|非常好|五星好评|给好评|还行|可以)[!！。~～]*$/

/**
 * 每条评价的刷评风险分 0~100：
 * 店主 / 店铺账号自评 +80；与本店 ≥2 个其他账号的评价高度雷同（二元组 Jaccard ≥ 0.8）+40；
 * 同一买家 1 小时内给同一店铺多条 5 星 +30；评价账号注册不足 1 天 +20；
 * 无内容的模板式好评 +15；同一商品 1 小时内集中出现 ≥5 条 5 星 +25。
 */
export function reviewRisks(reviews: Review[], products: Product[], shops: Shop[], users: User[]): Map<string, ReviewRisk> {
  const pm = new Map(products.map(p => [p.id, p]))
  const um = new Map(users.map(u => [u.id, u]))
  const sm = new Map(shops.map(s => [s.id, s]))
  const grams = new Map(reviews.map(r => [r.id, bigrams(r.content)]))
  const out = new Map<string, ReviewRisk>()
  const t = (r: Review) => Date.parse(r.createdAt) || 0
  for (const r of reviews) {
    const reasons: string[] = []
    let score = 0
    const p = pm.get(r.productId)
    const shop = p ? sm.get(p.shopId) : undefined
    const u = um.get(r.userId)
    if (shop && (shop.ownerId === r.userId || u?.shopId === shop.id)) { score += 80; reasons.push('店铺自评') }
    const g = grams.get(r.id)!
    // 雷同只在同一店铺内比较（跨店的通用短句不算），同店多个账号写出几乎相同的评价是典型刷评特征
    const twins = g.size >= 6 && shop ? reviews.filter(o => o.id !== r.id && o.userId !== r.userId && pm.get(o.productId)?.shopId === shop.id && jaccard(g, grams.get(o.id)!) >= 0.8).length : 0
    if (twins >= 2) { score += 40; reasons.push(`与本店其他 ${twins} 个账号的评价高度雷同`) }
    if (r.rating === 5 && shop && reviews.some(o => o.id !== r.id && o.userId === r.userId && o.rating === 5 && pm.get(o.productId)?.shopId === shop.id && Math.abs(t(o) - t(r)) < 36e5)) { score += 30; reasons.push('同一买家短时间内连续好评') }
    const age = u ? t(r) - (Date.parse(u.createdAt) || 0) : -1
    if (age >= 0 && age < 864e5) { score += 20; reasons.push('新注册账号评价') }
    if (r.rating === 5 && GENERIC.test(r.content.trim()) && !r.images.length) { score += 15; reasons.push('模板式好评') }
    if (r.rating === 5 && reviews.filter(o => o.productId === r.productId && o.rating === 5 && Math.abs(t(o) - t(r)) < 36e5).length >= 5) { score += 25; reasons.push('同一宝贝好评集中爆发') }
    if (score) out.set(r.id, { score: Math.min(100, score), reasons })
  }
  return out
}
export const RISKY = 50

// ---------- 订单风险 ----------
export interface OrderRisk { score: number; reasons: string[] }
/** 订单风险分：新账号大额、短时间多单不同地址、超过客单价 5 倍、同地址多账号下单（疑似刷单） */
export function orderRisk(o: Order, orders: Order[], users: User[]): OrderRisk {
  const reasons: string[] = []
  let score = 0
  const u = users.find(x => x.id === o.userId)
  const ts = Date.parse(o.createdAt) || 0
  if (u && ts - (Date.parse(u.createdAt) || 0) < 864e5 && o.payAmount >= 1000) { score += 35; reasons.push('新注册账号大额下单') }
  const recent = orders.filter(x => x.userId === o.userId && Math.abs((Date.parse(x.createdAt) || 0) - ts) < 36e5)
  const addrs = new Set(recent.map(x => `${x.address.country ?? ""}${x.address.region}${x.address.detail}`))
  if (recent.length >= 4) { score += 20; reasons.push(`1 小时内下单 ${recent.length} 笔`) }
  if (addrs.size >= 3) { score += 25; reasons.push('短时间内使用多个收货地址') }
  const shopOrders = orders.filter(x => x.shopId === o.shopId && x.id !== o.id && x.status !== 'closed')
  const avg = shopOrders.reduce((a, x) => a + x.payAmount, 0) / Math.max(1, shopOrders.length)
  if (shopOrders.length >= 5 && o.payAmount > avg * 5) { score += 15; reasons.push('金额远超店铺客单价') }
  const sameAddr = new Set(orders.filter(x => x.shopId === o.shopId && x.address.phone === o.address.phone).map(x => x.userId))
  if (sameAddr.size >= 3) { score += 30; reasons.push(`同一收货手机号关联 ${sameAddr.size} 个账号`) }
  return { score: Math.min(100, score), reasons }
}

// ---------- 平台智能巡检 ----------
export const BANNED_WORDS = ['最低价', '最便宜', '第一', '国家级', '顶级', '极品', '绝对', '100%', '万能', '史上', '全网最', '永久', '根治', '特效', '假一赔', '高仿', '原单', '复刻']
const PROHIBITED = ['枪', '弹药', '管制刀具', '毒品', '迷药', '窃听', '假证', '代考', '发票代开', '处方药']

export interface Finding {
  key: string
  shopId: string
  type: string
  level: Violation['level']
  points: number
  reason: string
  impact: string
  productIds?: string[]
  orderIds?: string[]
  evidence: string
  confidence: number
}

function median(xs: number[]) { const a = [...xs].sort((x, y) => x - y); return a.length ? a[Math.floor(a.length / 2)] : 0 }

/**
 * 规则 + 统计巡检：违禁词、极限词、类目价格异常（低于类目中位数 10%）、重复铺货（同店标题相似度 ≥ 0.85）、
 * 延迟发货（付款超 48 小时未发货）、刷评（店铺高风险评价 ≥ 2 条）。已开具过同类违规的线索自动去重。
 */
export function patrol(s: { products: Product[]; orders: Order[]; reviews: Review[]; shops: Shop[]; users: User[]; violations: Violation[] }, now = Date.now()): Finding[] {
  const out: Finding[] = []
  const on = s.products.filter(p => p.status === 'on' || p.status === 'pending')
  const exists = (shopId: string, type: string, ids: string[]) => s.violations.some(v => v.shopId === shopId && v.type === type && v.status !== 'revoked' && ids.some(id => v.productIds?.includes(id) || v.orderIds?.includes(id)))
  for (const p of on) {
    const bad = PROHIBITED.filter(w => p.title.includes(w) || p.detail?.includes(w))
    if (bad.length && !exists(p.shopId, '发布违禁信息', [p.id])) out.push({ key: 'ban' + p.id, shopId: p.shopId, type: '发布违禁信息', level: '严重违规', points: 12, reason: `商品「${p.title.slice(0, 30)}」含平台禁售信息：${bad.join('、')}`, impact: '扣 12 分，违规商品删除，店铺限制发布 7 天。', productIds: [p.id], evidence: `命中禁售词 ${bad.join('、')}`, confidence: 0.95 })
    const ext = BANNED_WORDS.filter(w => p.title.includes(w))
    if (ext.length && !exists(p.shopId, '滥发信息', [p.id])) out.push({ key: 'ext' + p.id, shopId: p.shopId, type: '滥发信息', level: '一般违规', points: 0, reason: `商品标题含广告法极限词：${ext.join('、')}`, impact: '违规商品搜索降权，整改后恢复。', productIds: [p.id], evidence: `标题：${p.title.slice(0, 40)}`, confidence: 0.9 })
  }
  // 类目价格异常
  const byCat = new Map<string, Product[]>()
  on.forEach(p => byCat.set(p.categoryId, [...(byCat.get(p.categoryId) ?? []), p]))
  for (const list of byCat.values()) {
    if (list.length < 3) continue
    const m = median(list.map(p => p.price))
    for (const p of list) if (p.price > 0 && p.price < m * 0.1 && p.price < 50 && !exists(p.shopId, '描述不符', [p.id])) out.push({ key: 'price' + p.id, shopId: p.shopId, type: '描述不符', level: '一般违规', points: 0, reason: `商品价格 ¥${p.price} 远低于同类目中位价 ¥${m.toFixed(0)}，疑似低价引流或描述不符。`, impact: '违规预警：请核实商品价格与描述，整改后撤销。', productIds: [p.id], evidence: `价格为类目中位数的 ${((p.price / m) * 100).toFixed(1)}%`, confidence: 0.6 })
  }
  // 重复铺货
  const byShop = new Map<string, Product[]>()
  on.forEach(p => byShop.set(p.shopId, [...(byShop.get(p.shopId) ?? []), p]))
  for (const [shopId, list] of byShop) {
    const g = list.map(p => bigrams(p.title))
    for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
      const sim = jaccard(g[i], g[j])
      if (sim >= 0.85 && !exists(shopId, '滥发信息', [list[i].id, list[j].id])) out.push({ key: 'dup' + list[i].id + list[j].id, shopId, type: '滥发信息', level: '一般违规', points: 0, reason: `重复铺货：「${list[i].title.slice(0, 20)}」与「${list[j].title.slice(0, 20)}」高度相似。`, impact: '重复商品搜索降权，请合并或删除重复宝贝。', productIds: [list[i].id, list[j].id], evidence: `标题相似度 ${(sim * 100).toFixed(0)}%`, confidence: 0.7 })
    }
  }
  // 延迟发货
  const late = new Map<string, Order[]>()
  for (const o of s.orders) if (o.status === 'paid' && o.paidAt && now - Date.parse(o.paidAt) > 48 * 36e5 && !exists(o.shopId, '延迟发货', [o.id])) late.set(o.shopId, [...(late.get(o.shopId) ?? []), o])
  for (const [shopId, os] of late) out.push({ key: 'late' + shopId, shopId, type: '延迟发货', level: '一般违规', points: 0, reason: `${os.length} 笔订单买家付款后超过 48 小时未发货。`, impact: '需向买家支付该商品实际成交金额 5% 的违约金（最低 5 元，最高 30 元）。', orderIds: os.map(o => o.id), evidence: `最早付款：${os.map(o => o.paidAt!).sort()[0].slice(0, 10)}`, confidence: 0.98 })
  // 刷评
  const risks = reviewRisks(s.reviews, s.products, s.shops, s.users)
  const pm = new Map(s.products.map(p => [p.id, p]))
  const fake = new Map<string, Review[]>()
  for (const r of s.reviews) if ((risks.get(r.id)?.score ?? 0) >= RISKY) { const sid = pm.get(r.productId)?.shopId; if (sid) fake.set(sid, [...(fake.get(sid) ?? []), r]) }
  for (const [shopId, rs] of fake) if (rs.length >= 2 && !exists(shopId, '虚假交易', rs.map(r => r.orderId))) out.push({ key: 'fake' + shopId, shopId, type: '虚假交易', level: '严重违规', points: 12, reason: `识别到 ${rs.length} 条疑似刷评（${[...new Set(rs.flatMap(r => risks.get(r.id)!.reasons))].join('、')}）。`, impact: '扣 12 分，删除虚假交易产生的销量、评价，限制参加营销活动 30 天。', orderIds: rs.map(r => r.orderId), productIds: [...new Set(rs.map(r => r.productId))], evidence: `风险评价 ${rs.length} 条`, confidence: 0.75 })
  return out.sort((a, b) => b.confidence - a.confidence)
}
