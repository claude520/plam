import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { reducers, CTX_REDUCERS, type DataState, type Ctx, type ReducerName, type Reducers } from '@/data/reducers'
import { initialState } from '@/data/initial'
import type { Address, Order } from '@/data/types'
import { sync } from './sync'

const uid = (p = '') => p + Math.random().toString(36).slice(2, 10)
export const genId = uid
const ctx = (): Ctx => ({ id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`, now: new Date().toISOString() })

// 把 reducer 的 (state, ...args, ctx) 映射为 action 的 (...args)
type DropFirst<T extends unknown[]> = T extends [unknown, ...infer R] ? R : never
type DropCtx<T extends unknown[]> = T extends [...infer R, Ctx] ? R : T
type Actions = { [K in ReducerName]: (...args: DropCtx<DropFirst<Parameters<Reducers[K]>>>) => void }

export interface DB extends DataState, Actions {
  createOrder: (userId: string, items: Order['items'], shopId: string, address: Address, opts: { discount: number; freight: number; note?: string; couponId?: string; liveId?: string; adPlanId?: string }) => Order
  resetAll: () => void
  _version: number
  _remote: boolean
}

const needsCtx = CTX_REDUCERS

export const useDB = create<DB>()(persist((set, get) => {
  const actions = {} as Record<string, (...args: unknown[]) => unknown>
  for (const name of Object.keys(reducers) as ReducerName[]) {
    actions[name] = (...args: unknown[]) => {
      const c = ctx()
      const full = needsCtx.has(name) ? [...args, c] : args
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const patch = (reducers[name] as any)(get(), ...full) as Partial<DataState>
      set(patch)
      sync.mutate(name, full)
      return c
    }
  }
  return {
    ...initialState(),
    _version: 0,
    _remote: false,
    ...(actions as unknown as Actions),
    createOrder: (userId, items, shopId, address, opts) => {
      const c = ctx()
      c.id = `${Date.now()}${Math.floor(Math.random() * 1000)}`.slice(0, 19)
      const patch = reducers.createOrder(get(), userId, items, shopId, address, opts, c)
      set(patch)
      sync.mutate('createOrder', [userId, items, shopId, address, opts, c])
      return get().orders.find(o => o.id === c.id)!
    },
    resetAll: () => { set(initialState()); sync.reset() },
  }
}, { name: 'plam-db-v2', partialize: s => Object.fromEntries(Object.entries(s).filter(([, v]) => typeof v !== 'function')) as DB }))

sync.attach(useDB)
