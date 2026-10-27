import { useMemo } from 'react'
import { useDB } from '@/store/db'
import { useSession } from '@/store/session'

export function useCurrentUser() {
  const userId = useSession(s => s.userId)
  const users = useDB(s => s.users)
  return useMemo(() => users.find(u => u.id === userId) ?? null, [users, userId])
}

export function useCurrentShop() {
  const user = useCurrentUser()
  const shops = useDB(s => s.shops)
  return useMemo(() => shops.find(s => s.id === (user?.shopId ?? 's12')) ?? shops[0], [shops, user])
}

export function useProduct(id?: string) {
  const products = useDB(s => s.products)
  return useMemo(() => products.find(p => p.id === id), [products, id])
}

export function useShop(id?: string) {
  const shops = useDB(s => s.shops)
  return useMemo(() => shops.find(s => s.id === id), [shops, id])
}

export function useCategoryName(id?: string) {
  const cats = useDB(s => s.categories)
  return useMemo(() => {
    const c = cats.find(x => x.id === id)
    if (!c) return ''
    const p = c.parentId ? cats.find(x => x.id === c.parentId) : undefined
    return p ? `${p.name} / ${c.name}` : c.name
  }, [cats, id])
}
