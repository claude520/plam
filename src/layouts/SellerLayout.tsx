import { useEffect, useMemo, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Home, Star, FileText, Package, Megaphone, Rocket, Headphones, Store, Users, Wallet, BarChart3, Grid2X2, Search, Bell, MessageSquare, Download, BookOpen, ScrollText, Moon, ChevronDown, LogOut, ArrowLeftRight, Menu, X } from 'lucide-react'
import { useCurrentShop, useCurrentUser } from '@/lib/hooks'
import { useDB } from '@/store/db'
import { useSession } from '@/store/session'
import { Avatar, Badge } from '@/components/ui'
import { cls } from '@/lib/format'

export const SELLER_MENU: { key: string; label: string; icon: React.ReactNode; to?: string; groups?: { title: string; items: { label: string; to: string; badge?: string }[] }[] }[] = [
  { key: 'home', label: '首页', icon: <Home className="w-4 h-4" />, to: '/seller' },
  { key: 'fav', label: '常用', icon: <Star className="w-4 h-4" />, groups: [{ title: '常用功能', items: [{ label: '已卖出宝贝', to: '/seller/orders' }, { label: '我的商品', to: '/seller/products' }, { label: '发布商品', to: '/seller/products/new' }, { label: '退款管理', to: '/seller/refunds' }, { label: '客服工作台', to: '/seller/service' }, { label: '生意参谋', to: '/seller/data' }] }] },
  { key: 'trade', label: '交易', icon: <FileText className="w-4 h-4" />, groups: [{ title: '订单管理', items: [{ label: '已卖出宝贝', to: '/seller/orders' }, { label: '退款管理', to: '/seller/refunds' }, { label: '售后任务', to: '/seller/refunds?tab=pending' }, { label: '评价管理', to: '/seller/reviews' }] }, { title: '物流管理', items: [{ label: '物流数据', to: '/seller/logistics' }, { label: '寄快递', to: '/seller/logistics?tab=send' }, { label: '发货', to: '/seller/orders?tab=paid' }, { label: '打单工具', to: '/seller/logistics?tab=print' }, { label: '包裹中心', to: '/seller/logistics?tab=packages' }, { label: '物流服务', to: '/seller/logistics/service' }] }, { title: '投诉与申诉', items: [{ label: '投诉管理', to: '/seller/refunds?tab=complaint' }] }] },
  { key: 'product', label: '商品', icon: <Package className="w-4 h-4" />, groups: [{ title: '商品管理', items: [{ label: '我的商品', to: '/seller/products' }, { label: '发布商品', to: '/seller/products/new' }, { label: '商品质量分', to: '/seller/products?tab=quality' }, { label: '商品装修', to: '/seller/shop?tab=decorate' }, { label: '仓储库存', to: '/seller/inventory' }, { label: 'SKU管理', to: '/seller/inventory?tab=sku', badge: 'new' }, { label: '素材中心', to: '/seller/shop?tab=assets' }] }, { title: '商品运营', items: [{ label: '商机发现', to: '/seller/data?tab=chance' }, { label: '新品运营', to: '/seller/data?tab=new' }, { label: '爆品成长', to: '/seller/data?tab=hot' }] }, { title: '商品货源', items: [{ label: '淘分销', to: '/seller/market?tab=supply' }, { label: '工厂货源', to: '/seller/market?tab=factory' }] }] },
  { key: 'marketing', label: '营销', icon: <Megaphone className="w-4 h-4" />, groups: [{ title: '营销工具', items: [{ label: '营销工具', to: '/seller/marketing' }] }, { title: '营销活动', items: [{ label: '活动报名', to: '/seller/marketing?tab=enroll' }, { label: '消费券', to: '/seller/marketing?tab=voucher' }, { label: '百亿补贴', to: '/seller/marketing?tab=subsidy' }, { label: '限时秒杀', to: '/seller/marketing?tab=flash' }, { label: '超级立减', to: '/seller/marketing?tab=super' }, { label: '金币', to: '/seller/marketing?tab=coins' }, { label: '品牌新享', to: '/seller/marketing?tab=brand' }, { label: '爆款竞价', to: '/seller/marketing?tab=bid' }] }, { title: '营销管理', items: [{ label: '价保管理', to: '/seller/marketing?tab=price' }, { label: '自动退差', to: '/seller/marketing?tab=refund' }, { label: '营销风险', to: '/seller/marketing?tab=risk' }] }, { title: '海外增长', items: [{ label: '海外增长', to: '/seller/marketing?tab=overseas' }] }, { title: '更多玩法', items: [{ label: '更多玩法', to: '/seller/marketing?tab=more' }] }] },
  { key: 'promotion', label: '推广', icon: <Rocket className="w-4 h-4" />, groups: [{ title: '推广中心', items: [{ label: '推广中心', to: '/seller/promotion' }] }, { title: '推广服务', items: [{ label: '货品全站推', to: '/seller/promotion?tab=all' }, { label: '关键词推广', to: '/seller/promotion?tab=keyword' }, { label: '人群推广', to: '/seller/promotion?tab=crowd' }, { label: '内容推广', to: '/seller/promotion?tab=content' }, { label: '联盟推广', to: '/seller/promotion?tab=union' }] }, { title: '推广工具', items: [{ label: '推广数据', to: '/seller/promotion?tab=data' }] }] },
  { key: 'service', label: '客服', icon: <Headphones className="w-4 h-4" />, groups: [{ title: '客服总览', items: [{ label: '数据概览', to: '/seller/service/overview' }, { label: '绩效考核', to: '/seller/service/overview?tab=kpi' }] }, { title: '客服管理', items: [{ label: '接待中心', to: '/seller/service' }, { label: '现场管理', to: '/seller/service/overview?tab=onsite' }, { label: '客服分流', to: '/seller/service/overview?tab=dispatch' }] }, { title: '客服工具', items: [{ label: '接待工具', to: '/seller/service?tab=ai' }] }, { title: '机器人', items: [{ label: '机器人主页', to: '/seller/service/overview?tab=robot' }, { label: '接待设置', to: '/seller/service/overview?tab=setting' }] }] },
  { key: 'shop', label: '店铺', icon: <Store className="w-4 h-4" />, groups: [{ title: '店铺管理', items: [{ label: '真实体验分', to: '/seller/shop/score' }, { label: '退货宝', to: '/seller/shop?tab=returns' }, { label: '店铺信息', to: '/seller/shop' }, { label: '店铺体检', to: '/seller/shop?tab=check' }, { label: '子账号管理', to: '/seller/shop?tab=staff' }, { label: '层级与权益', to: '/seller/shop?tab=level' }, { label: '店铺直播', to: '/seller/shop?tab=live' }] }, { title: '内容管理', items: [{ label: '内容中心', to: '/seller/shop?tab=content' }, { label: '关注运营', to: '/seller/crm?tab=fans' }, { label: '内容创作', to: '/seller/shop?tab=assets' }, { label: '内容数据', to: '/seller/data?tab=traffic' }] }, { title: '店铺装修', items: [{ label: '配置与装修', to: '/seller/shop?tab=decorate' }, { label: 'PC装修', to: '/seller/shop?tab=decorate' }] }, { title: '店铺工具', items: [{ label: '平台规则', to: '/seller/shop?tab=rules' }, { label: '协议中心', to: '/seller/shop?tab=agreement' }] }] },
  { key: 'crm', label: '私域', icon: <Users className="w-4 h-4" />, groups: [{ title: '私域运营', items: [{ label: '会员管理', to: '/seller/crm' }, { label: '粉丝运营', to: '/seller/crm?tab=fans' }, { label: '店铺群聊', to: '/seller/crm?tab=group' }] }] },
  { key: 'finance', label: '财务', icon: <Wallet className="w-4 h-4" />, groups: [{ title: '财务', items: [{ label: '总览', to: '/seller/finance' }, { label: '资金管理', to: '/seller/finance?tab=funds' }] }, { title: '对账管理', items: [{ label: '账户明细', to: '/seller/finance?tab=bills' }, { label: '收支账单', to: '/seller/finance?tab=income' }, { label: '对账凭据', to: '/seller/finance?tab=voucher' }] }, { title: '发票管理', items: [{ label: '申请发票', to: '/seller/finance?tab=invoice' }, { label: '给平台开票', to: '/seller/finance?tab=invoice-platform' }, { label: '给买家开票', to: '/seller/finance?tab=invoice-buyer' }] }, { title: '基础信息', items: [{ label: '基础信息', to: '/seller/finance?tab=info' }, { label: '保证金', to: '/seller/finance?tab=deposit' }] }] },
  { key: 'data', label: '数据', icon: <BarChart3 className="w-4 h-4" />, groups: [{ title: '生意参谋', items: [{ label: '实时数据', to: '/seller/data' }, { label: '流量分析', to: '/seller/data?tab=traffic' }, { label: '商品分析', to: '/seller/data?tab=product' }, { label: '客户分析', to: '/seller/data?tab=customer' }] }] },
  { key: 'market', label: '服务', icon: <Grid2X2 className="w-4 h-4" />, groups: [{ title: '服务市场', items: [{ label: '服务市场', to: '/seller/market' }, { label: '工单中心', to: '/seller/market?tab=ticket' }, { label: '员工管理', to: '/seller/shop?tab=staff' }] }] },
]

export default function SellerLayout() {
  const shop = useCurrentShop()
  const user = useCurrentUser()
  const loc = useLocation()
  const nav = useNavigate()
  const logout = useSession(s => s.logout)
  const { orders, messages, refunds } = useDB()
  const [open, setOpen] = useState<string | null>(null)
  const [drawer, setDrawer] = useState(false)
  const pending = orders.filter(o => o.shopId === shop.id && o.status === 'paid').length + refunds.filter(r => r.shopId === shop.id && r.status === 'pending').length
  const unread = messages.filter(m => m.shopId === shop.id && m.to === shop.id && !m.read).length
  const activeKey = useMemo(() => {
    const p = loc.pathname
    if (p === '/seller') return 'home'
    if (p.startsWith('/seller/orders') || p.startsWith('/seller/refunds') || p.startsWith('/seller/reviews') || p.startsWith('/seller/logistics')) return 'trade'
    if (p.startsWith('/seller/products') || p.startsWith('/seller/inventory')) return 'product'
    if (p.startsWith('/seller/marketing')) return 'marketing'
    if (p.startsWith('/seller/promotion')) return 'promotion'
    if (p.startsWith('/seller/service')) return 'service'
    if (p.startsWith('/seller/shop')) return 'shop'
    if (p.startsWith('/seller/crm')) return 'crm'
    if (p.startsWith('/seller/finance')) return 'finance'
    if (p.startsWith('/seller/data')) return 'data'
    if (p.startsWith('/seller/market')) return 'market'
    return 'home'
  }, [loc.pathname])
  useEffect(() => { setOpen(null); setDrawer(false) }, [loc.pathname, loc.search])
  const panel = SELLER_MENU.find(m => m.key === (open ?? ''))
  return (
    <div className="min-h-screen bg-[#f4f6fa] flex flex-col">
      <header className="h-14 md:h-16 bg-white border-b border-ink-200 flex items-center px-3 md:px-5 gap-3 md:gap-6 sticky top-0 z-40">
        <button aria-label="菜单" onClick={() => setDrawer(true)} className="lg:hidden p-2 -ml-1 rounded-lg hover:bg-ink-50 text-ink-700"><Menu className="w-5 h-5" /></button>
        <Link to="/seller" className="flex items-center gap-2 select-none"><span className="w-8 h-8 md:w-9 md:h-9 rounded-xl bg-gradient-to-br from-qn-400 to-qn-600 flex items-center justify-center text-white font-black text-lg">P</span><span className="text-lg md:text-[22px] font-bold text-ink-900 tracking-tight whitespace-nowrap">Plam <span className="text-qn-600 hidden sm:inline">商家中心</span></span></Link>
        <div className="relative w-64 hidden md:block"><Search className="w-4 h-4 text-ink-400 absolute left-3 top-1/2 -translate-y-1/2" /><input aria-label="搜索功能" className="input-qn pl-9 bg-ink-50 border-transparent" placeholder="双11 预售规则解读" onKeyDown={e => { if (e.key === 'Enter') nav(`/seller/products?q=${encodeURIComponent((e.target as HTMLInputElement).value)}`) }} /></div>
        <div className="ml-auto flex items-center gap-1 text-ink-600">
          <div className="hidden lg:contents">{[[<Moon className="w-4 h-4" />, '管家', '/seller/service?tab=ai'], [<ScrollText className="w-4 h-4" />, '协议', '/seller/shop?tab=agreement'], [<Download className="w-4 h-4" />, '下载', '/seller/market'], [<BookOpen className="w-4 h-4" />, '规则', '/seller/shop?tab=rules']].map(([ic, l, to]) => <Link key={l as string} to={to as string} className="flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg hover:bg-ink-50 text-[11px]">{ic as React.ReactNode}{l as string}</Link>)}</div>
          <span className="w-px h-6 bg-ink-200 mx-2 hidden lg:block" />
          <Link to="/seller/service" className="relative flex flex-col items-center gap-0.5 px-2 md:px-3 py-1 rounded-lg hover:bg-ink-50 text-[11px] whitespace-nowrap"><MessageSquare className="w-4 h-4" />消息<Badge n={unread} className="absolute -top-0.5 right-1" /></Link>
          <Link to="/seller/orders" className="relative flex flex-col items-center gap-0.5 px-2 md:px-3 py-1 rounded-lg hover:bg-ink-50 text-[11px] whitespace-nowrap"><Bell className="w-4 h-4" />待办<Badge n={pending} className="absolute -top-0.5 right-1" /></Link>
          <Link to="/seller/market?tab=ticket" className="hidden md:flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg hover:bg-ink-50 text-[11px]"><Headphones className="w-4 h-4" />客服</Link>
          <div className="relative group ml-3">
            <button className="flex items-center gap-2 pl-2 pr-1 py-1 rounded-lg hover:bg-ink-50"><Avatar src={shop.logo} name={shop.name} size={32} /><div className="text-left hidden md:block"><div className="text-sm font-medium text-ink-900 max-w-[150px] truncate">{shop.name}</div><div className="text-[11px] text-ink-400">{user?.username}</div></div><ChevronDown className="w-4 h-4 text-ink-400" /></button>
            <div className="absolute right-0 top-full pt-1 hidden group-hover:block z-50"><div className="bg-white shadow-float rounded-lg py-1 w-40 text-sm"><Link to="/seller/shop" className="block px-3 py-2 hover:bg-ink-50">店铺设置</Link><Link to={`/shop/${shop.id}`} className="block px-3 py-2 hover:bg-ink-50">查看店铺</Link><Link to="/" className="flex items-center gap-1 px-3 py-2 hover:bg-ink-50"><ArrowLeftRight className="w-3.5 h-3.5" />切换到买家</Link><button onClick={() => { logout(); nav('/login') }} className="flex items-center gap-1 w-full text-left px-3 py-2 hover:bg-ink-50 text-ink-500"><LogOut className="w-3.5 h-3.5" />退出登录</button></div></div>
          </div>
        </div>
      </header>
      {drawer && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-ink-900/40" onClick={() => setDrawer(false)} />
          <div className="absolute left-0 top-0 bottom-0 w-[280px] bg-white shadow-pop overflow-auto animate-fadeUp">
            <div className="h-14 px-4 flex items-center justify-between border-b border-ink-100"><span className="font-semibold">商家中心</span><button aria-label="关闭" onClick={() => setDrawer(false)} className="p-1.5 rounded-md hover:bg-ink-100"><X className="w-4 h-4" /></button></div>
            <div className="p-3">
              <NavLink to="/seller" end className={({ isActive }) => cls('flex items-center gap-2 px-3 h-10 rounded-lg text-sm', isActive ? 'bg-qn-50 text-qn-600 font-medium' : 'text-ink-700')}><Home className="w-4 h-4" />首页</NavLink>
              {SELLER_MENU.filter(m => m.groups).map(m => <div key={m.key} className="mt-2"><div className="flex items-center gap-2 px-3 py-2 text-sm font-semibold text-ink-900">{m.icon}{m.label}</div><div className="flex flex-wrap gap-1.5 px-3 pb-1">{m.groups!.flatMap(g => g.items).map(it => <NavLink key={it.to} to={it.to} className="px-2.5 h-7 rounded-md bg-ink-50 text-xs text-ink-700 flex items-center">{it.label}</NavLink>)}</div></div>)}
              <Link to="/" className="mt-3 flex items-center gap-2 px-3 h-10 rounded-lg text-sm text-ink-600"><ArrowLeftRight className="w-4 h-4" />切换到买家</Link>
            </div>
          </div>
        </div>
      )}
      <div className="flex flex-1">
        <nav className="hidden lg:flex w-[108px] bg-white border-r border-ink-200 py-3 sticky top-16 self-start h-[calc(100vh-64px)] flex-col" onMouseLeave={() => setOpen(null)}>
          {SELLER_MENU.map(m => m.to ? (
            <NavLink key={m.key} to={m.to} end onMouseEnter={() => setOpen(null)} className={cls('mx-3 my-0.5 flex items-center gap-2 px-3 h-10 rounded-lg text-[15px] transition', activeKey === m.key ? 'bg-qn-50 text-qn-600 font-medium' : 'text-ink-700 hover:bg-ink-50')}>{m.icon}{m.label}</NavLink>
          ) : (
            <button key={m.key} onMouseEnter={() => setOpen(m.key)} onClick={() => nav(m.groups![0].items[0].to)} className={cls('mx-3 my-0.5 flex items-center gap-2 px-3 h-10 rounded-lg text-[15px] transition text-left', activeKey === m.key || open === m.key ? 'bg-qn-50 text-qn-600 font-medium' : 'text-ink-700 hover:bg-ink-50')}>{m.icon}{m.label}</button>
          ))}
          <div className="mt-auto px-4 text-[11px] text-ink-400 space-y-1"><div>关于 Plam</div><div>Copyright</div><div>© Plam Group</div></div>
          {panel && (
            <div className="absolute left-full top-0 bottom-0 w-[230px] bg-white border-r border-ink-200 shadow-float z-30 overflow-auto py-4 px-4 animate-fadeUp">
              <div className="text-lg font-semibold text-ink-900 mb-2">{panel.label}</div>
              {panel.groups!.map(g => <div key={g.title} className="mb-3"><div className="flex items-center justify-between font-medium text-[15px] text-ink-900 py-1.5">{g.title}<ChevronDown className="w-3.5 h-3.5 text-ink-400 rotate-180" /></div>{g.items.map(it => <NavLink key={it.to} to={it.to} className={({ isActive }) => cls('block py-1.5 text-[13px] relative', isActive && loc.search === (it.to.includes('?') ? '?' + it.to.split('?')[1] : '') ? 'text-qn-600' : 'text-ink-600 hover:text-qn-600')}>{it.label}{it.badge && <span className="ml-1 tag bg-brand-500 text-white">{it.badge}</span>}</NavLink>)}</div>)}
            </div>
          )}
        </nav>
        <main className="flex-1 min-w-0 p-3 md:p-5"><Outlet /></main>
      </div>
    </div>
  )
}
