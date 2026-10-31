// 关键词推广前台埋点：展现、点击扣费与 15 天成交归因
import { useDB } from '@/store/db'
import { useSession } from '@/store/session'
import type { AdSlot } from '@/data/reducers'

const KEY = 'plam-ad-click:'
const WINDOW = 15 * 864e5
const seen = new Set<string>()

/** 当前登录用户是否为该计划所属店铺的店主（店主自己看/点自家广告不计费） */
function isOwner(planId: string) {
  const s = useDB.getState()
  const plan = s.adPlans.find(p => p.id === planId)
  const shop = s.shops.find(x => x.id === plan?.shopId)
  return !!shop && shop.ownerId === useSession.getState().userId
}

/** 一次搜索结果页对每个计划计 1 次展现（同一搜索词本次会话只计一次） */
export function trackImpressions(q: string, slots: AdSlot[]) {
  const ids = [...new Set(slots.map(s => s.planId))].filter(id => !seen.has(`${q}|${id}`) && !isOwner(id))
  if (!ids.length) return
  ids.forEach(id => seen.add(`${q}|${id}`))
  useDB.getState().adImpress(ids)
}

/** 点击广告：按竞价结算价扣费并记录归因 */
export function trackClick(slot: AdSlot) {
  try { localStorage.setItem(KEY + slot.productId, JSON.stringify({ planId: slot.planId, t: Date.now() })) } catch { /* 忽略 */ }
  if (isOwner(slot.planId)) return
  useDB.getState().adClick(slot.planId, slot.word, slot.price)
}

/** 下单时查找 15 天内点击过的推广计划 */
export function adAttribution(productIds: string[]): string | undefined {
  for (const id of productIds) {
    try {
      const v = JSON.parse(localStorage.getItem(KEY + id) ?? 'null') as { planId: string; t: number } | null
      if (v && Date.now() - v.t < WINDOW) return v.planId
    } catch { /* 忽略 */ }
  }
  return undefined
}
