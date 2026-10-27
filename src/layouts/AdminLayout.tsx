import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { LayoutDashboard, Users, Store, Package, FolderTree, FileText, RotateCcw, Star, Image, Ticket, Flag, Megaphone, CreditCard, Landmark, PieChart, ShieldCheck, ScrollText, Settings, Bell, Search, ChevronDown, LogOut, ChevronLeft, ArrowLeftRight, Menu, X, Radio } from 'lucide-react'
import { useCurrentUser } from '@/lib/hooks'
import { useDB } from '@/store/db'
import { useSession } from '@/store/session'
import { Avatar, Badge } from '@/components/ui'
import { cls } from '@/lib/format'

export const ADMIN_MENU = [
  { title: '概览', items: [{ label: '数据看板', to: '/admin', icon: <LayoutDashboard className="w-4 h-4" /> }] },
  { title: '用户与商家', items: [{ label: '用户管理', to: '/admin/users', icon: <Users className="w-4 h-4" /> }, { label: '商家管理', to: '/admin/shops', icon: <Store className="w-4 h-4" /> }] },
  { title: '商品', items: [{ label: '商品审核', to: '/admin/products', icon: <Package className="w-4 h-4" /> }, { label: '类目管理', to: '/admin/categories', icon: <FolderTree className="w-4 h-4" /> }] },
  { title: '交易', items: [{ label: '订单管理', to: '/admin/orders', icon: <FileText className="w-4 h-4" /> }, { label: '退款纠纷', to: '/admin/refunds', icon: <RotateCcw className="w-4 h-4" /> }, { label: '评价管理', to: '/admin/reviews', icon: <Star className="w-4 h-4" /> }, { label: '直播管理', to: '/admin/lives', icon: <Radio className="w-4 h-4" /> }] },
  { title: '营销与内容', items: [{ label: '首页轮播', to: '/admin/banners', icon: <Image className="w-4 h-4" /> }, { label: '优惠券', to: '/admin/coupons', icon: <Ticket className="w-4 h-4" /> }, { label: '营销活动', to: '/admin/campaigns', icon: <Flag className="w-4 h-4" /> }, { label: '公告管理', to: '/admin/announcements', icon: <Megaphone className="w-4 h-4" /> }] },
  { title: '财务', items: [{ label: '支付渠道', to: '/admin/payments', icon: <CreditCard className="w-4 h-4" /> }, { label: '商家结算', to: '/admin/settlements', icon: <Landmark className="w-4 h-4" /> }, { label: '财务报表', to: '/admin/reports', icon: <PieChart className="w-4 h-4" /> }] },
  { title: '系统', items: [{ label: '角色权限', to: '/admin/roles', icon: <ShieldCheck className="w-4 h-4" /> }, { label: '操作日志', to: '/admin/logs', icon: <ScrollText className="w-4 h-4" /> }, { label: '系统设置', to: '/admin/settings', icon: <Settings className="w-4 h-4" /> }] },
]

export default function AdminLayout() {
  const user = useCurrentUser()
  const nav = useNavigate()
  const loc = useLocation()
  const logout = useSession(s => s.logout)
  const { products, shops, refunds, settings } = useDB()
  const [collapsed, setCollapsed] = useState(false)
  const [drawer, setDrawer] = useState(false)
  useEffect(() => { setDrawer(false) }, [loc.pathname])
  const todo = products.filter(p => p.status === 'pending').length + shops.filter(s => s.status === 'pending').length + refunds.filter(r => r.status === 'pending').length
  const current = ADMIN_MENU.flatMap(g => g.items).find(i => i.to === loc.pathname)
  useEffect(() => { document.title = `${current?.label ?? '后台'} · ${settings.siteName} 超级管理后台` }, [current, settings.siteName])
  return (
    <div className="min-h-screen bg-[#f3f4f7] flex">
      {drawer && <div className="fixed inset-0 z-50 bg-ink-900/40 lg:hidden" onClick={() => setDrawer(false)} />}
      <aside className={cls('bg-[#0f172a] text-slate-300 flex flex-col transition-all max-lg:fixed max-lg:inset-y-0 max-lg:left-0 max-lg:z-50 max-lg:w-[240px] lg:sticky lg:top-0 lg:h-screen', collapsed ? 'lg:w-16' : 'lg:w-[232px]', drawer ? '' : 'max-lg:-translate-x-full')}>
        <Link to="/admin" className="h-16 flex items-center gap-2.5 px-4 border-b border-white/5 relative"><button aria-label="关闭菜单" onClick={e => { e.preventDefault(); setDrawer(false) }} className="lg:hidden absolute right-3 top-5 text-slate-400"><X className="w-5 h-5" /></button><span className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center text-white font-black text-lg shrink-0">P</span>{!collapsed && <div><div className="text-white font-semibold leading-tight">Plam 超级管理后台</div><div className="text-[10px] text-slate-400">Super Admin Console</div></div>}</Link>
        <nav className="flex-1 overflow-auto py-3 no-scrollbar">
          {ADMIN_MENU.map(g => (
            <div key={g.title} className="mb-2">
              {!collapsed && <div className="px-5 py-1.5 text-[11px] text-slate-400 uppercase tracking-wider">{g.title}</div>}
              {g.items.map(it => <NavLink key={it.to} to={it.to} end={it.to === '/admin'} title={it.label} className={({ isActive }) => cls('mx-2.5 my-0.5 flex items-center gap-3 px-3 h-10 rounded-lg text-sm transition', isActive ? 'bg-brand-500 text-white shadow' : 'hover:bg-white/5 hover:text-white', collapsed && 'justify-center px-0')}>{it.icon}{!collapsed && it.label}</NavLink>)}
            </div>
          ))}
        </nav>
        <button onClick={() => setCollapsed(c => !c)} className="h-12 hidden lg:flex items-center justify-center border-t border-white/5 hover:bg-white/5" aria-label="折叠菜单"><ChevronLeft className={cls('w-4 h-4 transition', collapsed && 'rotate-180')} /></button>
      </aside>
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="h-14 md:h-16 bg-white border-b border-ink-200 flex items-center px-3 md:px-6 gap-2 md:gap-4 sticky top-0 z-40">
          <button aria-label="菜单" onClick={() => setDrawer(true)} className="lg:hidden p-2 rounded-lg hover:bg-ink-50 text-ink-700"><Menu className="w-5 h-5" /></button>
          <div className="text-sm text-ink-500 whitespace-nowrap">后台 <span className="mx-1">/</span> <span className="text-ink-900 font-medium">{current?.label ?? ''}</span></div>
          <div className="relative w-72 ml-6 hidden md:block"><Search className="w-4 h-4 text-ink-400 absolute left-3 top-1/2 -translate-y-1/2" /><input aria-label="全局搜索" className="input pl-9 bg-ink-50 border-transparent" placeholder="搜索订单号 / 用户 / 商品…" onKeyDown={e => { if (e.key === 'Enter') nav(`/admin/orders?q=${encodeURIComponent((e.target as HTMLInputElement).value)}`) }} /></div>
          <div className="ml-auto flex items-center gap-2">
            {settings.maintenance && <span className="tag-red">维护模式</span>}
            <Link to="/" className="btn-ghost btn-sm hidden sm:inline-flex"><ArrowLeftRight className="w-3.5 h-3.5" />前台</Link>
            <Link to="/admin/products" className="relative p-2 rounded-lg hover:bg-ink-50 text-ink-600" aria-label="待办"><Bell className="w-5 h-5" /><Badge n={todo} className="absolute -top-0.5 -right-0.5" /></Link>
            <div className="relative group">
              <button className="flex items-center gap-2 pl-2 pr-1 py-1 rounded-lg hover:bg-ink-50"><Avatar src={user?.avatar} name={user?.nickname ?? ''} size={32} /><span className="text-sm font-medium hidden sm:inline">{user?.nickname}</span><ChevronDown className="w-4 h-4 text-ink-400" /></button>
              <div className="absolute right-0 top-full pt-1 hidden group-hover:block z-50"><div className="bg-white shadow-float rounded-lg py-1 w-36 text-sm"><Link to="/admin/settings" className="block px-3 py-2 hover:bg-ink-50">系统设置</Link><button onClick={() => { logout(); nav('/login') }} className="flex items-center gap-1 w-full text-left px-3 py-2 hover:bg-ink-50 text-ink-500"><LogOut className="w-3.5 h-3.5" />退出登录</button></div></div>
            </div>
          </div>
        </header>
        <main className="flex-1 p-3 md:p-6 min-w-0"><Outlet /></main>
      </div>
    </div>
  )
}
