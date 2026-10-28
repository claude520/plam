import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Home, Star, Radio, TrendingUp, BarChart3, Wallet, Sparkles, BookOpen, Globe, Headphones, MessageSquareWarning, ChevronDown, Menu, X, ArrowLeftRight, Play, ChevronUp } from 'lucide-react'
import { LanguageMenu } from '@/components/LanguageMenu'
import { useCurrentShop, useCurrentUser } from '@/lib/hooks'
import { useDB } from '@/store/db'
import { Avatar } from '@/components/ui'
import { cls } from '@/lib/format'

export const LIVE_MENU: { key: string; label: string; icon: React.ReactNode; to?: string; items?: { label: string; to: string }[] }[] = [
  { key: 'home', label: '首页', icon: <Home className="w-4 h-4" />, to: '/seller/live' },
  { key: 'fav', label: '常用', icon: <Star className="w-4 h-4" />, items: [{ label: '直播计划', to: '/seller/live/plan' }, { label: '货盘管理', to: '/seller/live/goods' }, { label: '直播概览', to: '/seller/live/data' }, { label: '直播设置', to: '/seller/live/settings' }] },
  { key: 'live', label: '直播', icon: <Radio className="w-4 h-4" />, items: [{ label: '直播计划', to: '/seller/live/plan' }, { label: '直播预告', to: '/seller/live/trailer' }, { label: '直播讲解', to: '/seller/live/keypoint' }, { label: '货盘管理', to: '/seller/live/goods' }, { label: '开播工具', to: '/seller/live/tools' }, { label: '直播互动', to: '/seller/live/interaction' }, { label: '直播推广', to: '/seller/live/promote' }, { label: '直播体检', to: '/seller/live/physical' }, { label: '数字人管理', to: '/seller/live/digital' }, { label: '直播设置', to: '/seller/live/settings' }, { label: '多开直播', to: '/seller/live/multi' }] },
  { key: 'grow', label: '成长', icon: <TrendingUp className="w-4 h-4" />, items: [{ label: '账号成长', to: '/seller/live/grow' }, { label: '活动广场', to: '/seller/live/activity' }, { label: '主播课堂', to: '/seller/live/classroom' }] },
  { key: 'data', label: '数据', icon: <BarChart3 className="w-4 h-4" />, items: [{ label: '直播概览', to: '/seller/live/data' }, { label: '场次分析', to: '/seller/live/data/live' }, { label: '交易分析', to: '/seller/live/data/transaction' }, { label: '活动作战室', to: '/seller/live/data/war' }, { label: '粉丝分析', to: '/seller/live/data/fans' }, { label: '人群分析', to: '/seller/live/data/crowd' }, { label: '我的流量券', to: '/seller/live/data/coupon' }, { label: '商品分析', to: '/seller/live/data/commodity' }, { label: '营销分析', to: '/seller/live/data/marketing' }, { label: '代播分析', to: '/seller/live/data/agent' }, { label: '站外引流', to: '/seller/live/data/outside' }] },
  { key: 'funds', label: '资金', icon: <Wallet className="w-4 h-4" />, to: '/seller/live/funds' },
]

export function liveTitle(pathname: string) {
  for (const m of LIVE_MENU) { if (m.to === pathname) return m.label; const it = m.items?.find(i => i.to === pathname); if (it) return it.label }
  if (pathname.startsWith('/seller/live/data/')) return '数据'
  return '首页'
}

export default function LiveLayout() {
  const shop = useCurrentShop()
  const user = useCurrentUser()
  const loc = useLocation()
  const nav = useNavigate()
  const lives = useDB(s => s.lives)
  const [drawer, setDrawer] = useState(false)
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const current = lives.find(l => l.shopId === shop.id && l.status === 'live')
  useEffect(() => { setDrawer(false); document.title = `Plam直播 - ${liveTitle(loc.pathname)}` }, [loc.pathname])
  const [q, setQ] = useState('')
  const sidebar = (
    <nav className="py-2 text-sm">
      {LIVE_MENU.map(m => (
        <div key={m.key} className="px-4 py-3 border-b border-ink-100 last:border-0">
          {m.to ? <NavLink to={m.to} end className={({ isActive }) => cls('flex items-center gap-2.5 text-[15px] font-medium', isActive ? 'text-brand-500' : 'text-ink-900 hover:text-brand-500')}>{m.icon}{m.label}</NavLink>
            : <button onClick={() => setCollapsed(c => ({ ...c, [m.key]: !c[m.key] }))} className="w-full flex items-center gap-2.5 text-[15px] font-medium text-ink-900">{m.icon}{m.label}<ChevronUp className={cls('w-3.5 h-3.5 ml-auto text-ink-400 transition', collapsed[m.key] && 'rotate-180')} /></button>}
          {m.items && !collapsed[m.key] && <div className="mt-2.5 grid grid-cols-2 keep-cols gap-y-2 gap-x-2">{m.items.map(it => <NavLink key={it.to + it.label} to={it.to} end={it.to === '/seller/live/data' || it.to === '/seller/live/plan'} className={({ isActive }) => cls('text-[13px] truncate', isActive ? 'text-ink-900 font-semibold' : 'text-ink-600 hover:text-brand-500')}>{it.label}</NavLink>)}</div>}
        </div>
      ))}
    </nav>
  )
  return (
    <div className="min-h-screen bg-[#f4f5f7] flex flex-col">
      <header className="h-14 md:h-16 bg-white border-b border-ink-200 flex items-center px-3 md:px-6 gap-3 md:gap-6 sticky top-0 z-40">
        <button aria-label="菜单" onClick={() => setDrawer(true)} className="lg:hidden p-2 -ml-1 rounded-lg hover:bg-ink-50 text-ink-700"><Menu className="w-5 h-5" /></button>
        <Link to="/seller/live" className="flex items-center gap-2 select-none shrink-0"><span className="w-8 h-8 rounded-full bg-brand-500 flex items-center justify-center text-white"><Play className="w-4 h-4 fill-current" /></span><span className="text-xl md:text-2xl font-black text-brand-500 tracking-tight">Plam直播</span></Link>
        <form onSubmit={e => { e.preventDefault(); nav(`/seller/live/classroom?q=${encodeURIComponent(q)}`) }} className="hidden md:flex items-center bg-ink-50 rounded-lg h-9 w-[330px] px-3 gap-2"><input value={q} onChange={e => setQ(e.target.value)} aria-label="搜索" placeholder="爆品怎么选" className="flex-1 bg-transparent outline-none text-sm" /><button className="text-brand-500 text-sm font-medium flex items-center gap-1"><Sparkles className="w-4 h-4" />AI搜索</button></form>
        <div className="ml-auto flex items-center gap-1 text-ink-600">
          <div className="hidden lg:contents">{[[<Sparkles className="w-4 h-4" />, 'AI助手', '/seller/live/tools'], [<BookOpen className="w-4 h-4" />, '使用指南', '/seller/live/classroom'], [<Globe className="w-4 h-4" />, '直播门户', '/live']].map(([ic, l, to]) => <Link key={l as string} to={to as string} className="flex flex-col items-center gap-0.5 px-2.5 py-1 rounded-lg hover:bg-ink-50 text-[11px]">{ic as React.ReactNode}{l as string}</Link>)}<span className="w-px h-6 bg-ink-200 mx-1" />{[[<Headphones className="w-4 h-4" />, '直播客服', '/seller/service'], [<MessageSquareWarning className="w-4 h-4" />, '问题反馈', '/seller/market?tab=ticket']].map(([ic, l, to]) => <Link key={l as string} to={to as string} className="flex flex-col items-center gap-0.5 px-2.5 py-1 rounded-lg hover:bg-ink-50 text-[11px]">{ic as React.ReactNode}{l as string}</Link>)}</div>
          {current && <Link to={`/seller/live/studio/${current.id}`} className="ml-2 btn-primary btn-sm h-8 gap-1"><Radio className="w-3.5 h-3.5" />直播中 · 进入中控台</Link>}
          <LanguageMenu variant="icon" />
          <div className="relative group ml-2">
            <button className="flex items-center gap-2 pl-1 pr-1 py-1 rounded-lg hover:bg-ink-50"><Avatar src={shop.logo} name={shop.name} size={34} /><div className="text-left hidden md:block"><div className="text-sm font-medium text-ink-900 max-w-[120px] truncate flex items-center gap-1">{user?.username}<span className="tag bg-amber-100 text-amber-700 text-[10px]">V1</span></div><div className="text-[11px] text-ink-400">内容质量无评分</div></div><ChevronDown className="w-4 h-4 text-ink-400" /></button>
            <div className="absolute right-0 top-full pt-1 hidden group-hover:block z-50"><div className="bg-white shadow-float rounded-lg py-1 w-44 text-sm"><Link to="/seller/live/settings" className="block px-3 py-2 hover:bg-ink-50">直播设置</Link><Link to="/live" className="block px-3 py-2 hover:bg-ink-50">查看直播广场</Link><Link to="/seller" className="flex items-center gap-1 px-3 py-2 hover:bg-ink-50"><ArrowLeftRight className="w-3.5 h-3.5" />返回商家中心</Link></div></div>
          </div>
        </div>
      </header>
      {drawer && <div className="fixed inset-0 z-50 lg:hidden"><div className="absolute inset-0 bg-ink-900/40" onClick={() => setDrawer(false)} /><div className="absolute left-0 top-0 bottom-0 w-[280px] bg-white shadow-pop overflow-auto animate-fadeUp"><div className="h-14 px-4 flex items-center justify-between border-b border-ink-100"><span className="font-semibold">Plam直播</span><button aria-label="关闭" onClick={() => setDrawer(false)} className="p-1.5 rounded-md hover:bg-ink-100"><X className="w-4 h-4" /></button></div>{sidebar}<Link to="/seller" className="flex items-center gap-2 px-4 h-11 text-sm text-ink-600"><ArrowLeftRight className="w-4 h-4" />返回商家中心</Link></div></div>}
      <div className="flex-1 flex">
        <aside className="hidden lg:block w-[180px] shrink-0 bg-white border-r border-ink-200 sticky top-16 h-[calc(100vh-64px)] overflow-auto no-scrollbar">{sidebar}</aside>
        <main className="flex-1 min-w-0 p-3 md:p-6"><Outlet /></main>
      </div>
    </div>
  )
}
