import { useEffect, useState } from 'react'
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Camera, ChevronDown, Heart, ShoppingCart, Store, User as UserIcon, MessageSquare, Home, Headphones, ArrowUp, Clock, LayoutGrid } from 'lucide-react'
import { useDB } from '@/store/db'
import { useSession } from '@/store/session'
import { useCurrentUser } from '@/lib/hooks'
import { Badge } from '@/components/ui'
import { cls } from '@/lib/format'

export function Logo({ sub, className }: { sub?: string; className?: string }) {
  return (
    <Link to="/" className={cls('flex items-center gap-2 select-none', className)} aria-label="Plam 首页">
      <span className="w-8 h-8 md:w-9 md:h-9 rounded-xl bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center text-white font-black text-lg md:text-xl shadow-sm">P</span>
      <span className="text-[22px] md:text-[26px] font-black tracking-tight text-brand-500 leading-none">Plam</span>
      {sub && <span className="text-lg md:text-[22px] text-brand-500 font-bold ml-1 leading-none hidden sm:inline">{sub}</span>}
    </Link>
  )
}

export function TopBar() {
  const user = useCurrentUser()
  const cartCount = useDB(s => s.cart.length)
  const logout = useSession(s => s.logout)
  return (
    <div className="bg-ink-100/80 border-b border-ink-200 text-xs text-ink-600 hidden md:block">
      <div className="container-x h-8 flex items-center justify-between">
        <div className="flex items-center gap-4">
          {user ? (
            <div className="flex items-center gap-1 group relative">
              <span className="text-ink-800 max-w-[90px] truncate">{user.username}</span><ChevronDown className="w-3 h-3" />
              <div className="absolute left-0 top-full pt-1 hidden group-hover:block z-50">
                <div className="bg-white shadow-float rounded-lg py-1 w-32 text-[13px]">
                  <Link to="/my" className="block px-3 py-1.5 hover:bg-ink-50">我的 Plam</Link>
                  <Link to="/my/settings" className="block px-3 py-1.5 hover:bg-ink-50">账户设置</Link>
                  <button onClick={logout} className="block w-full text-left px-3 py-1.5 hover:bg-ink-50 text-ink-500">退出登录</button>
                </div>
              </div>
            </div>
          ) : (
            <><Link to="/login" className="text-brand-500 font-medium">亲，请登录</Link><Link to="/register">免费注册</Link></>
          )}
          <span className="text-ink-400">网页无障碍</span>
          <span className="flex items-center gap-0.5">Language<ChevronDown className="w-3 h-3" /></span>
        </div>
        <nav className="flex items-center gap-5">
          <Link to="/" className="hover:text-brand-500">Plam 首页</Link>
          <Link to="/my/orders" className="hover:text-brand-500">已买到的宝贝</Link>
          <Link to="/live" className="hover:text-brand-500 text-brand-600 font-medium">Plam直播</Link>
          <Link to="/my" className="hover:text-brand-500 flex items-center gap-0.5">我的 Plam<ChevronDown className="w-3 h-3" /></Link>
          <Link to="/cart" className="hover:text-brand-500 flex items-center gap-1 text-brand-600 font-medium"><ShoppingCart className="w-3.5 h-3.5" />购物车 {cartCount}</Link>
          <Link to="/my/favorites" className="hover:text-brand-500 flex items-center gap-0.5"><Heart className="w-3.5 h-3.5" />收藏夹<ChevronDown className="w-3 h-3" /></Link>
          <Link to="/seller" className="hover:text-brand-500">免费开店<ChevronDown className="w-3 h-3 inline" /></Link>
          <Link to="/seller" className="hover:text-brand-500">商家中心<ChevronDown className="w-3 h-3 inline" /></Link>
          <Link to="/admin" className="hover:text-brand-500">管理后台</Link>
          <span className="hover:text-brand-500 cursor-pointer">帮助中心<ChevronDown className="w-3 h-3 inline" /></span>
        </nav>
      </div>
    </div>
  )
}

export function SearchBar({ compactMode, sub }: { compactMode?: boolean; sub?: string }) {
  const nav = useNavigate()
  const loc = useLocation()
  const [q, setQ] = useState(new URLSearchParams(loc.search).get('q') ?? '')
  const [type, setType] = useState<'宝贝' | '店铺'>('宝贝')
  const hot = ['冰糖烤梨罐头', '降温保暖5折起', '下单赢AirPods5', '雪梨银耳', '雪梨', '冰糖烤梨']
  const submit = (e: React.FormEvent) => { e.preventDefault(); nav(`/search?q=${encodeURIComponent(q.trim())}${type === '店铺' ? '&type=shop' : ''}`) }
  return (
    <form onSubmit={submit} className={cls('flex-1', compactMode ? 'max-w-[420px]' : 'max-w-[640px]')} role="search">
      <div className="flex h-10 md:h-11 rounded-full border-2 border-brand-500 bg-white overflow-hidden focus-within:shadow-[0_0_0_4px_rgba(255,80,0,.12)] transition-shadow">
        {!compactMode && (
          <button type="button" onClick={() => setType(type === '宝贝' ? '店铺' : '宝贝')} className="px-3 text-sm text-ink-700 hidden sm:flex items-center gap-1 border-r border-ink-100 hover:bg-ink-50">{type}<ChevronDown className="w-3.5 h-3.5" /></button>
        )}
        <input aria-label="搜索" value={q} onChange={e => setQ(e.target.value)} placeholder={sub ?? '冰糖烤梨罐头'} className="flex-1 px-3 text-sm outline-none placeholder:text-ink-400 min-w-0" />
        <button type="button" aria-label="图片搜索" className="px-2 text-ink-500 hover:text-brand-500 hidden sm:block"><Camera className="w-5 h-5" /></button>
        <button type="submit" className="bg-brand-500 hover:bg-brand-600 text-white px-4 md:px-7 font-semibold text-sm md:text-[15px] transition-colors">搜索</button>
      </div>
      {!compactMode && (
        <div className="hidden md:flex gap-3 mt-1.5 text-xs text-ink-500 overflow-hidden whitespace-nowrap">
          {hot.map((h, i) => <Link key={h} to={`/search?q=${encodeURIComponent(h)}`} className={cls('hover:text-brand-500', i < 4 && 'text-brand-500')}>{h}</Link>)}
        </div>
      )}
    </form>
  )
}

export function SideToolbar() {
  const user = useCurrentUser()
  const cartCount = useDB(s => s.cart.length)
  const [showTop, setShowTop] = useState(false)
  useEffect(() => {
    const h = () => setShowTop(window.scrollY > 400)
    window.addEventListener('scroll', h, { passive: true })
    return () => window.removeEventListener('scroll', h)
  }, [])
  const Item = ({ icon, label, to, badge }: { icon: React.ReactNode; label: string; to?: string; badge?: number }) => {
    const inner = <div className="relative flex flex-col items-center gap-0.5 py-2.5 w-full text-ink-600 hover:text-brand-500 hover:bg-brand-50 transition-colors cursor-pointer">{icon}<span className="text-[10px]">{label}</span>{badge ? <Badge n={badge} className="absolute top-1 right-2" /> : null}</div>
    return to ? <Link to={to}>{inner}</Link> : inner
  }
  return (
    <aside className="fixed right-0 top-1/2 -translate-y-1/2 z-40 w-14 bg-white rounded-l-2xl shadow-float border border-ink-100 border-r-0 hidden lg:block">
      <Item icon={<Home className="w-5 h-5" />} label="首页" to="/" />
      <Item icon={<UserIcon className="w-5 h-5" />} label={user ? '我的' : '登录'} to={user ? '/my' : '/login'} />
      <Item icon={<MessageSquare className="w-5 h-5" />} label="消息" to="/my/messages" badge={9} />
      <Item icon={<ShoppingCart className="w-5 h-5" />} label="购物车" to="/cart" badge={cartCount} />
      <Item icon={<Clock className="w-5 h-5" />} label="足迹" to="/my/footprints" />
      <Item icon={<Store className="w-5 h-5" />} label="商家" to="/seller" />
      <Item icon={<Headphones className="w-5 h-5" />} label="客服" />
      {showTop && <button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="flex flex-col items-center gap-0.5 py-2.5 w-full text-ink-600 hover:text-brand-500 border-t border-ink-100" aria-label="回到顶部"><ArrowUp className="w-5 h-5" /><span className="text-[10px]">顶部</span></button>}
    </aside>
  )
}

export function Footer() {
  const cols = [
    { t: '购物指南', l: ['购物流程', '会员介绍', '生活旅行/团购', '常见问题', '大家电', '联系客服'] },
    { t: '配送方式', l: ['上门自提', '211限时达', '配送服务查询', '配送费收取标准', '海外配送'] },
    { t: '支付方式', l: ['货到付款', '在线支付', '分期付款', '公司转账', '第三方支付接入'] },
    { t: '售后服务', l: ['售后政策', '价格保护', '退款说明', '返修/退换货', '取消订单'] },
    { t: '商家服务', l: ['免费开店', '商家中心', '商家培训', '营销推广', '服务市场'] },
  ]
  return (
    <footer className="mt-12 border-t border-ink-200 bg-white mobile-pb">
      <div className="container-x py-8 md:py-10">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-6 text-sm">
          {cols.map(c => (
            <div key={c.t}><div className="font-semibold text-ink-900 mb-3">{c.t}</div><ul className="space-y-2 text-ink-500">{c.l.map(x => <li key={x} className="hover:text-brand-500 cursor-pointer">{x}</li>)}</ul></div>
          ))}
        </div>
        <div className="divider my-8" />
        <div className="flex flex-col md:flex-row gap-3 md:items-center justify-between text-xs text-ink-400">
          <div className="flex gap-4 flex-wrap"><span>关于 Plam</span><span>合作伙伴</span><span>营销中心</span><span>廉正举报</span><span>联系客服</span><span>开放平台</span><span>诚征英才</span><span>隐私权政策</span><span>法律声明</span></div>
          <div>© 2026 Plam Mall · 演示站点，非真实交易</div>
        </div>
      </div>
    </footer>
  )
}

export function MobileNav() {
  const loc = useLocation()
  const cartCount = useDB(s => s.cart.length)
  const items = [['/', '首页', <Home className="w-5 h-5" />], ['/search', '分类', <LayoutGrid className="w-5 h-5" />], ['/cart', '购物车', <ShoppingCart className="w-5 h-5" />], ['/my', '我的', <UserIcon className="w-5 h-5" />]] as const
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-ink-200 grid grid-cols-4 keep-cols h-14" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
      {items.map(([to, l, ic]) => { const active = to === '/' ? loc.pathname === '/' : loc.pathname.startsWith(to); return <Link key={to} to={to} className={cls('relative flex flex-col items-center justify-center gap-0.5 text-[11px]', active ? 'text-brand-500' : 'text-ink-500')}>{ic}{l}{to === '/cart' && cartCount > 0 && <Badge n={cartCount} className="absolute top-1 right-5" />}</Link> })}
    </nav>
  )
}

export default function BuyerLayout() {
  const loc = useLocation()
  useEffect(() => { window.scrollTo(0, 0) }, [loc.pathname])
  const isHome = loc.pathname === '/' || loc.pathname.startsWith('/live')
  return (
    <div className="min-h-full flex flex-col">
      <TopBar />
      {!isHome && (
        <header className="bg-white">
          <div className="container-x h-14 md:h-20 flex items-center gap-3 md:gap-10">
            <Logo sub={loc.pathname.startsWith('/my') ? '我的' : loc.pathname.startsWith('/cart') ? '购物车' : undefined} />
            <SearchBar compactMode={!loc.pathname.startsWith('/search')} />
          </div>
        </header>
      )}
      <main className="flex-1"><Outlet /></main>
      <Footer />
      <SideToolbar />
      <MobileNav />
    </div>
  )
}
