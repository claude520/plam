import { buildSeed } from './seed'
import type { DataState } from './reducers'
import type { CartItem } from './types'

/** 初始演示数据（前端与 Worker 共用） */
export const initialState = (): DataState => {
  const now = new Date().toISOString()
  const seed = buildSeed()
  return {
    users: seed.users, shops: seed.shops, categories: seed.categories, products: seed.products, orders: seed.orders,
    addresses: seed.addresses,
    cart: [
      { id: 'ci1', productId: 'p21', skuId: 'p21-sku1', qty: 1, checked: false, addedAt: now },
      { id: 'ci2', productId: 'p18', skuId: 'p18-sku2', qty: 1, checked: false, addedAt: now },
      { id: 'ci3', productId: 'p18', skuId: 'p18-sku5', qty: 1, checked: false, addedAt: now },
      { id: 'ci4', productId: 'p25', skuId: 'p25-sku1', qty: 2, checked: false, addedAt: now },
      { id: 'ci5', productId: 'p9', skuId: 'p9-sku1', qty: 1, checked: false, addedAt: now },
      { id: 'ci6', productId: 'p30', skuId: 'p30-sku2', qty: 1, checked: false, addedAt: now },
    ] as CartItem[],
    coupons: seed.coupons, reviews: seed.reviews, refunds: seed.refunds, banners: seed.banners, announcements: seed.announcements,
    paymentProviders: seed.paymentProviders, campaigns: seed.campaigns, auditLogs: seed.auditLogs, messages: seed.messages, adminRoles: seed.adminRoles,
    favorites: ['p14', 'p15', 'p21', 'p25', 'p28', 'p36', 'p40', 'p19'],
    footprints: ['p41', 'p42', 'p45', 'p46', 'p2', 'p5', 'p30', 'p33', 'p13', 'p6'].map((productId, i) => ({ productId, time: new Date(Date.now() - i * 3.6e6).toISOString() })),
    followedShops: ['s1', 's3', 's6', 's9', 's12'],
    myCoupons: [{ couponId: 'cp1', used: false }, { couponId: 'cp2', used: false }, { couponId: 'cp3', used: false }, { couponId: 'cp4', used: false }],
    settings: { siteName: 'Plam 商城', slogan: '淘你喜欢', commissionRate: 5, freightDefault: 10, autoConfirmDays: 10, maintenance: false },
  }
}
