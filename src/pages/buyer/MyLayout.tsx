import { NavLink, Outlet } from 'react-router-dom'
import { ChevronUp } from 'lucide-react'
import { useDB } from '@/store/db'
import { cls } from '@/lib/format'
import { useCurrentUser } from '@/lib/hooks'
import { Navigate } from 'react-router-dom'

export default function MyLayout() {
  const user = useCurrentUser()
  const { favorites, followedShops, products, orders } = useDB()
  if (!user) return <Navigate to="/login" replace />
  const dropCount = favorites.filter(id => products.find(p => p.id === id)?.originalPrice).length
  const pendingReview = orders.filter(o => o.userId === user.id && o.status === 'received').length
  const groups: { label: string; to?: string; children?: { label: string; to: string }[]; badge?: string }[] = [
    { label: '我的 Plam', to: '/my' },
    { label: '我的购物车', to: '/cart' },
    { label: '我的订单', children: [{ label: '已买到的宝贝', to: '/my/orders' }, { label: '我的拍卖', to: '/my/orders?tab=auction' }, { label: '官方集运', to: '/my/orders?tab=ship' }] },
    { label: '我的卡券包', to: '/my/coupons' },
    { label: '宝贝收藏', to: '/my/favorites', badge: dropCount ? '有降价' : undefined },
    { label: '关注店铺', to: '/my/shops', badge: followedShops.length ? `${followedShops.length}家上新` : undefined },
    { label: '我的足迹', to: '/my/footprints' },
    { label: '购买过的店铺', to: '/my/shops?tab=bought' },
    { label: '我的发票', children: [{ label: '全部发票', to: '/my/invoices' }, { label: '批量开票', to: '/my/invoices?tab=batch' }] },
    { label: '评价管理', to: '/my/reviews', badge: pendingReview ? String(pendingReview) : undefined },
    { label: '退款维权', to: '/my/refunds' },
    { label: '消息中心', to: '/my/messages' },
    { label: '账户设置', children: [{ label: '个人资料', to: '/my/settings' }, { label: '收货地址', to: '/my/address' }, { label: '安全设置', to: '/my/settings?tab=security' }] },
  ]
  return (
    <div className="container-x py-3 md:py-4 grid grid-cols-[170px_1fr] lg-stack gap-4 md:gap-6 items-start mobile-pb">
      <nav className="space-y-0.5 text-sm max-lg:flex max-lg:gap-2 max-lg:overflow-x-auto max-lg:no-scrollbar max-lg:space-y-0 max-lg:pb-1">
        {groups.map(g => g.to ? (
          <NavLink key={g.label} to={g.to} end={g.to === '/my'} className={({ isActive }) => cls('flex items-center justify-between px-3 py-2 rounded-lg max-lg:shrink-0 max-lg:bg-white max-lg:shadow-card max-lg:gap-2', isActive ? 'bg-brand-50 text-brand-500 font-medium' : 'text-ink-700 hover:bg-ink-100')}>{g.label}{g.badge && <span className="tag bg-brand-500 text-white">{g.badge}</span>}</NavLink>
        ) : (
          <div key={g.label} className="max-lg:flex max-lg:gap-2">
            <div className="flex items-center justify-between px-3 py-2 text-ink-700 max-lg:hidden">{g.label}<ChevronUp className="w-3.5 h-3.5 text-ink-400" /></div>
            {g.children!.map(c => <NavLink key={c.to} to={c.to} className={({ isActive }) => cls('block pl-8 pr-3 py-1.5 rounded-lg max-lg:shrink-0 max-lg:pl-3 max-lg:py-2 max-lg:bg-white max-lg:shadow-card max-lg:whitespace-nowrap', isActive && location.search === (c.to.split('?')[1] ? '?' + c.to.split('?')[1] : '') ? 'bg-brand-50 text-brand-500 font-medium' : 'text-ink-600 hover:bg-ink-100')}>{c.label}</NavLink>)}
          </div>
        ))}
      </nav>
      <div className="min-w-0"><Outlet /></div>
    </div>
  )
}
