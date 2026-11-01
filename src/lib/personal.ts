// 推荐 / 搜索的 React 封装：当前用户画像、热搜词
import { useEffect, useMemo, useState } from 'react'
import { useDB } from '@/store/db'
import { useSession } from '@/store/session'
import { buildProfile, loadBehaviors, onBehavior, type Profile } from './reco'

/** 当前用户的兴趣画像（行为变化时自动刷新） */
export function useProfile(): Profile {
  const uid = useSession(s => s.userId)
  const { products, orders, cart, favorites } = useDB()
  const [tick, setTick] = useState(0)
  useEffect(() => onBehavior(() => setTick(t => t + 1)), [])
  return useMemo(() => buildProfile(loadBehaviors(uid), products, { orders, uid, cart: cart.map(c => c.productId), favorites }), [uid, products, orders, cart, favorites, tick]) // eslint-disable-line react-hooks/exhaustive-deps
}

export interface HotWord { q: string; n: number }
let hotCache: { at: number; list: HotWord[] } | null = null

/** 全站热搜（近 7 天搜索次数，服务端统计；接口不可用时返回空） */
export function useHotSearch(): HotWord[] {
  const [list, setList] = useState<HotWord[]>(hotCache?.list ?? [])
  useEffect(() => {
    if (hotCache && Date.now() - hotCache.at < 60_000) return
    fetch('/api/hot').then(r => (r.ok ? r.json() : null)).then((d: { list?: HotWord[] } | null) => { if (d?.list) { hotCache = { at: Date.now(), list: d.list }; setList(d.list) } }).catch(() => {})
  }, [])
  return list
}

/** 上报一次搜索（计入热搜） */
export function reportSearch(q: string) {
  const t = q.trim()
  if (!t || t.length > 30) return
  fetch('/api/hot', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ q: t }) }).catch(() => {})
  if (hotCache) hotCache.at = 0
}
