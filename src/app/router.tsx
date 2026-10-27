import { lazy, Suspense, type ReactNode } from 'react'
import { createBrowserRouter, Navigate, Outlet } from 'react-router-dom'
import BuyerLayout from '@/layouts/BuyerLayout'
import Home from '@/pages/buyer/Home'
import { useSession } from '@/store/session'

const L = (f: () => Promise<{ default: React.ComponentType }>) => { const C = lazy(f); return <Suspense fallback={<PageLoading />}><C /></Suspense> }
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const LN = (f: () => Promise<any>, name: string) => { const C = lazy(() => f().then(m => ({ default: m[name] as React.ComponentType }))); return <Suspense fallback={<PageLoading />}><C /></Suspense> }

export function PageLoading() {
  return <div className="container-x py-10"><div className="skeleton h-40 rounded-xl2 mb-4" /><div className="grid grid-cols-5 gap-3">{Array.from({ length: 10 }).map((_, i) => <div key={i} className="skeleton aspect-[3/4] rounded-xl2" />)}</div></div>
}

function Guard({ role, children }: { role: 'seller' | 'admin'; children: ReactNode }) {
  const s = useSession()
  if (!s.userId) return <Navigate to={`/login?to=/${role}`} replace />
  if (role === 'admin' && s.role !== 'admin') return <Navigate to="/login?to=/admin" replace />
  if (role === 'seller' && s.role === 'buyer') return <Navigate to="/login?to=/seller" replace />
  return <>{children}</>
}

export const router = createBrowserRouter([
  { path: '/login', element: L(() => import('@/pages/auth/Login')) },
  { path: '/register', element: L(() => import('@/pages/auth/Login').then(m => ({ default: () => <m.default register /> }))) },
  {
    path: '/', element: <BuyerLayout />, children: [
      { index: true, element: <Home /> },
      { path: 'search', element: L(() => import('@/pages/buyer/Search')) },
      { path: 'item/:id', element: L(() => import('@/pages/buyer/Item')) },
      { path: 'shop/:id', element: L(() => import('@/pages/buyer/Shop')) },
      { path: 'live', element: L(() => import('@/pages/buyer/Live')) },
      { path: 'live/follow', element: LN(() => import('@/pages/buyer/Live'), 'LiveFollow') },
      { path: 'live/:id', element: L(() => import('@/pages/buyer/LiveRoom')) },
      { path: 'cart', element: L(() => import('@/pages/buyer/Cart')) },
      { path: 'checkout', element: L(() => import('@/pages/buyer/Checkout')) },
      {
        path: 'my', element: L(() => import('@/pages/buyer/MyLayout')), children: [
          { index: true, element: L(() => import('@/pages/buyer/My')) },
          { path: 'orders', element: L(() => import('@/pages/buyer/Orders')) },
          { path: 'orders/:id', element: LN(() => import('@/pages/buyer/Orders'), 'OrderDetail') },
          { path: 'favorites', element: LN(() => import('@/pages/buyer/MyPages'), 'Favorites') },
          { path: 'footprints', element: LN(() => import('@/pages/buyer/MyPages'), 'Footprints') },
          { path: 'shops', element: LN(() => import('@/pages/buyer/MyPages'), 'Shops') },
          { path: 'coupons', element: LN(() => import('@/pages/buyer/MyPages'), 'Coupons') },
          { path: 'address', element: LN(() => import('@/pages/buyer/MyPages'), 'AddressPage') },
          { path: 'settings', element: LN(() => import('@/pages/buyer/MyPages'), 'Settings') },
          { path: 'refunds', element: LN(() => import('@/pages/buyer/MyPages'), 'Refunds') },
          { path: 'reviews', element: LN(() => import('@/pages/buyer/MyPages'), 'Reviews') },
          { path: 'messages', element: LN(() => import('@/pages/buyer/MyPages'), 'Messages') },
          { path: 'invoices', element: LN(() => import('@/pages/buyer/MyPages'), 'Invoices') },
        ],
      },
    ],
  },
  {
    path: '/seller', element: <Guard role="seller">{L(() => import('@/layouts/SellerLayout'))}</Guard>, children: [
      { index: true, element: L(() => import('@/pages/seller/Dashboard')) },
      { path: 'orders', element: LN(() => import('@/pages/seller/Trade'), 'SellerOrders') },
      { path: 'orders/:id', element: LN(() => import('@/pages/seller/Trade'), 'SellerOrderDetail') },
      { path: 'refunds', element: LN(() => import('@/pages/seller/Trade'), 'SellerRefunds') },
      { path: 'reviews', element: LN(() => import('@/pages/seller/Trade'), 'SellerReviews') },
      { path: 'logistics', element: LN(() => import('@/pages/seller/Trade'), 'Logistics') },
      { path: 'logistics/service', element: LN(() => import('@/pages/seller/LogisticsService'), 'LogisticsService') },
      { path: 'products', element: LN(() => import('@/pages/seller/Products'), 'ProductList') },
      { path: 'products/new', element: LN(() => import('@/pages/seller/Products'), 'ProductEdit') },
      { path: 'products/:id/edit', element: LN(() => import('@/pages/seller/Products'), 'ProductEdit') },
      { path: 'inventory', element: LN(() => import('@/pages/seller/InventorySku'), 'Inventory') },
      { path: 'service/overview', element: LN(() => import('@/pages/seller/CsOverview'), 'CsOverview') },
      { path: 'marketing', element: LN(() => import('@/pages/seller/Marketing'), 'Marketing') },
      { path: 'promotion', element: LN(() => import('@/pages/seller/Marketing'), 'Promotion') },
      { path: 'service', element: LN(() => import('@/pages/seller/Shop'), 'CustomerService') },
      { path: 'shop', element: LN(() => import('@/pages/seller/Shop'), 'ShopSettings') },
      { path: 'shop/score', element: LN(() => import('@/pages/seller/ShopScore'), 'ShopScore') },
      { path: 'crm', element: LN(() => import('@/pages/seller/Shop'), 'Crm') },
      { path: 'finance', element: LN(() => import('@/pages/seller/Shop'), 'Finance') },
      { path: 'data', element: LN(() => import('@/pages/seller/Shop'), 'DataCenter') },
      { path: 'market', element: LN(() => import('@/pages/seller/Shop'), 'ServiceMarket') },
      { path: '*', element: <Navigate to="/seller" replace /> },
    ],
  },
  {
    path: '/seller/live', element: <Guard role="seller">{L(() => import('@/layouts/LiveLayout'))}</Guard>, children: [
      { index: true, element: LN(() => import('@/pages/seller/live/Home'), 'LiveHome') },
      { path: 'plan', element: LN(() => import('@/pages/seller/live/Plan'), 'LivePlan') },
      { path: 'trailer', element: LN(() => import('@/pages/seller/live/Plan'), 'LiveTrailer') },
      { path: 'keypoint', element: LN(() => import('@/pages/seller/live/Goods'), 'Keypoint') },
      { path: 'goods', element: LN(() => import('@/pages/seller/live/Goods'), 'GoodsManage') },
      { path: 'tools', element: LN(() => import('@/pages/seller/live/Tools'), 'LiveTools') },
      { path: 'interaction', element: LN(() => import('@/pages/seller/live/Tools'), 'Interaction') },
      { path: 'promote', element: LN(() => import('@/pages/seller/live/Tools'), 'Promote') },
      { path: 'physical', element: LN(() => import('@/pages/seller/live/Tools'), 'Physical') },
      { path: 'digital', element: LN(() => import('@/pages/seller/live/Tools'), 'DigitalHuman') },
      { path: 'settings', element: LN(() => import('@/pages/seller/live/Settings'), 'LiveSettings') },
      { path: 'multi', element: LN(() => import('@/pages/seller/live/Tools'), 'MultiLive') },
      { path: 'grow', element: LN(() => import('@/pages/seller/live/Grow'), 'Grow') },
      { path: 'activity', element: LN(() => import('@/pages/seller/live/Grow'), 'Activity') },
      { path: 'classroom', element: LN(() => import('@/pages/seller/live/Grow'), 'Classroom') },
      { path: 'data', element: LN(() => import('@/pages/seller/live/Data'), 'Overview') },
      { path: 'data/live', element: LN(() => import('@/pages/seller/live/Data'), 'SessionAnalysis') },
      { path: 'data/transaction', element: LN(() => import('@/pages/seller/live/Data'), 'Transaction') },
      { path: 'data/fans', element: LN(() => import('@/pages/seller/live/Data'), 'Fans') },
      { path: 'data/commodity', element: LN(() => import('@/pages/seller/live/Data'), 'Commodity') },
      { path: 'data/:kind', element: LN(() => import('@/pages/seller/live/Data'), 'DataSimple') },
      { path: 'funds', element: LN(() => import('@/pages/seller/live/Data'), 'Funds') },
      { path: '*', element: <Navigate to="/seller/live" replace /> },
    ],
  },
  { path: '/seller/live/studio/:id', element: <Guard role="seller">{L(() => import('@/pages/seller/live/Studio'))}</Guard> },
  {
    path: '/admin', element: <Guard role="admin">{L(() => import('@/layouts/AdminLayout'))}</Guard>, children: [
      { index: true, element: L(() => import('@/pages/admin/Dashboard')) },
      { path: 'users', element: LN(() => import('@/pages/admin/Users'), 'Users') },
      { path: 'shops', element: LN(() => import('@/pages/admin/Users'), 'Shops') },
      { path: 'products', element: LN(() => import('@/pages/admin/Catalog'), 'Products') },
      { path: 'categories', element: LN(() => import('@/pages/admin/Catalog'), 'Categories') },
      { path: 'orders', element: LN(() => import('@/pages/admin/Trade'), 'Orders') },
      { path: 'refunds', element: LN(() => import('@/pages/admin/Trade'), 'Refunds') },
      { path: 'reviews', element: LN(() => import('@/pages/admin/Trade'), 'Reviews') },
      { path: 'lives', element: LN(() => import('@/pages/admin/Lives'), 'Lives') },
      { path: 'banners', element: LN(() => import('@/pages/admin/Marketing'), 'Banners') },
      { path: 'coupons', element: LN(() => import('@/pages/admin/Marketing'), 'Coupons') },
      { path: 'campaigns', element: LN(() => import('@/pages/admin/Marketing'), 'Campaigns') },
      { path: 'announcements', element: LN(() => import('@/pages/admin/Marketing'), 'Announcements') },
      { path: 'payments', element: LN(() => import('@/pages/admin/Finance'), 'Payments') },
      { path: 'settlements', element: LN(() => import('@/pages/admin/Finance'), 'Settlements') },
      { path: 'reports', element: LN(() => import('@/pages/admin/Finance'), 'Reports') },
      { path: 'roles', element: LN(() => import('@/pages/admin/System'), 'Roles') },
      { path: 'logs', element: LN(() => import('@/pages/admin/System'), 'Logs') },
      { path: 'settings', element: LN(() => import('@/pages/admin/System'), 'SettingsPage') },
      { path: '*', element: <Navigate to="/admin" replace /> },
    ],
  },
  { path: '*', element: <NotFound /> },
])

function NotFound() {
  return <div className="min-h-screen flex flex-col items-center justify-center text-ink-500"><div className="text-6xl font-black text-ink-200">404</div><div className="mt-2">页面不存在</div><a href="/" className="btn-primary mt-6">返回首页</a><Outlet /></div>
}
