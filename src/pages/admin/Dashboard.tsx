import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Users, Store, Package, FileText, TrendingUp, TrendingDown, AlertTriangle, ChevronRight, RotateCcw, ShieldCheck } from 'lucide-react'
import { useDB } from '@/store/db'
import { TrendArea, Bars, Donut, days } from '@/components/Charts'
import { Avatar, Img } from '@/components/ui'
import { cls, compact, money, timeAgo, ORDER_STATUS } from '@/lib/format'

export default function AdminDashboard() {
  const { users, shops, products, orders, refunds, auditLogs, categories, paymentProviders } = useDB()
  const paid = orders.filter(o => o.status !== 'unpaid' && o.status !== 'closed')
  const gmv = paid.reduce((a, o) => a + o.payAmount, 0)
  const todayStr = new Date().toDateString()
  const todayOrders = orders.filter(o => new Date(o.createdAt).toDateString() === todayStr)
  const trend = useMemo(() => days(30, i => { const d = new Date(Date.now() - (29 - i) * 864e5).toDateString(); const os = orders.filter(o => new Date(o.createdAt).toDateString() === d && o.status !== 'unpaid' && o.status !== 'closed'); return { GMV: Math.round(os.reduce((a, o) => a + o.payAmount, 0)), 订单数: os.length, 新增用户: 3 + ((i * 7) % 12) } }), [orders])
  const byCat = useMemo(() => categories.filter(c => !c.parentId).map(c => ({ name: c.name.slice(0, 4), 销售额: Math.round(paid.flatMap(o => o.items).filter(it => products.find(p => p.id === it.productId)?.categoryId.startsWith(c.id + '-')).reduce((a, it) => a + it.price * it.qty, 0)) })), [categories, paid, products])
  const byPay = useMemo(() => paymentProviders.map(p => ({ name: p.name, value: paid.filter(o => o.payment?.provider === p.code).length })).filter(x => x.value > 0), [paymentProviders, paid])
  const topShops = useMemo(() => shops.map(s => ({ s, gmv: paid.filter(o => o.shopId === s.id).reduce((a, o) => a + o.payAmount, 0), cnt: paid.filter(o => o.shopId === s.id).length })).sort((a, b) => b.gmv - a.gmv).slice(0, 6), [shops, paid])
  const topProducts = useMemo(() => [...products].sort((a, b) => b.sales - a.sales).slice(0, 6), [products])
  const todo = [['待审核商品', products.filter(p => p.status === 'pending').length, '/admin/products?tab=pending'], ['待审核商家', shops.filter(s => s.status === 'pending').length, '/admin/shops?tab=pending'], ['待处理退款纠纷', refunds.filter(r => r.status === 'pending').length, '/admin/refunds'], ['冻结用户', users.filter(u => u.status === 'frozen').length, '/admin/users?tab=frozen']] as const
  const kpis = [
    { l: '平台 GMV（累计）', v: `¥${money(gmv, 0)}`, d: '+12.4%', up: true, ic: <TrendingUp />, c: 'from-brand-500 to-rose-500' },
    { l: '今日订单', v: String(todayOrders.length), d: '+8.2%', up: true, ic: <FileText />, c: 'from-qn-500 to-violet-500' },
    { l: '注册用户', v: compact(users.filter(u => u.role === 'buyer').length * 1283), d: '+3.1%', up: true, ic: <Users />, c: 'from-emerald-500 to-teal-500' },
    { l: '在营商家', v: String(shops.filter(s => s.status === 'open').length), d: '-0.5%', up: false, ic: <Store />, c: 'from-amber-500 to-orange-500' },
    { l: '在售商品', v: String(products.filter(p => p.status === 'on').length), d: '+5.6%', up: true, ic: <Package />, c: 'from-sky-500 to-cyan-500' },
    { l: '退款率', v: `${paid.length ? ((refunds.length / paid.length) * 100).toFixed(1) : 0}%`, d: '-0.3pt', up: true, ic: <RotateCcw />, c: 'from-pink-500 to-rose-500' },
  ]
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-6 gap-4">{kpis.map(k => <div key={k.l} className="card p-4 relative overflow-hidden"><div className={cls('absolute -right-4 -top-4 w-20 h-20 rounded-full bg-gradient-to-br opacity-10', k.c)} /><div className="flex items-center justify-between"><span className="text-xs text-ink-500">{k.l}</span><span className={cls('w-8 h-8 rounded-lg bg-gradient-to-br text-white flex items-center justify-center [&>svg]:w-4 [&>svg]:h-4', k.c)}>{k.ic}</span></div><div className="text-2xl font-num font-bold mt-2">{k.v}</div><div className={cls('text-xs mt-1 flex items-center gap-1', k.up ? 'text-emerald-700' : 'text-red-600')}>{k.up ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}{k.d} <span className="text-ink-400">较上周</span></div></div>)}</div>
      <div className="grid grid-cols-4 gap-4">{todo.map(([l, n, to]) => <Link key={l} to={to} className={cls('card p-4 flex items-center gap-3 hover:shadow-float transition', n > 0 && 'border-l-4 border-amber-400')}><AlertTriangle className={cls('w-5 h-5', n > 0 ? 'text-amber-500' : 'text-ink-400')} /><div className="flex-1"><div className="text-sm text-ink-600">{l}</div><div className="text-xl font-num font-bold">{n}</div></div><ChevronRight className="w-4 h-4 text-ink-400" /></Link>)}</div>
      <div className="grid grid-cols-[2fr_1fr] gap-4">
        <div className="card p-5"><div className="flex items-center justify-between mb-3"><h2 className="font-semibold">近 30 天 GMV / 订单趋势</h2><span className="text-xs text-ink-400">数据每 5 分钟刷新</span></div><TrendArea data={trend} keys={['GMV', '订单数']} height={260} colors={['#ff5000', '#3d6dff']} /></div>
        <div className="card p-5"><h2 className="font-semibold mb-3">支付渠道分布</h2><Donut data={byPay} height={260} colors={['#07c160', '#1677ff', '#e60012', '#635bff', '#003087', '#ff5000']} /></div>
      </div>
      <div className="grid grid-cols-[1fr_1fr_1fr] gap-4">
        <div className="card p-5"><h2 className="font-semibold mb-3">类目销售额</h2><Bars data={byCat} keys={['销售额']} height={230} colors={['#3d6dff']} /></div>
        <div className="card p-5"><div className="flex items-center justify-between mb-3"><h2 className="font-semibold">商家 GMV TOP</h2><Link to="/admin/shops" className="text-xs text-qn-600">全部 ›</Link></div><div className="space-y-2.5">{topShops.map(({ s, gmv: g, cnt }, i) => <div key={s.id} className="flex items-center gap-2 text-sm"><span className={cls('w-5 h-5 rounded text-xs flex items-center justify-center font-bold', i < 3 ? 'bg-brand-500 text-white' : 'bg-ink-100 text-ink-600')}>{i + 1}</span><Avatar src={s.logo} name="" size={24} /><span className="flex-1 truncate">{s.name}</span><span className="text-xs text-ink-400">{cnt} 单</span><span className="font-num font-medium">¥{money(g, 0)}</span></div>)}</div></div>
        <div className="card p-5"><div className="flex items-center justify-between mb-3"><h2 className="font-semibold">热销商品</h2><Link to="/admin/products" className="text-xs text-qn-600">全部 ›</Link></div><div className="space-y-2.5">{topProducts.map((p, i) => <div key={p.id} className="flex items-center gap-2 text-sm"><span className={cls('w-5 h-5 rounded text-xs flex items-center justify-center font-bold', i < 3 ? 'bg-brand-500 text-white' : 'bg-ink-100 text-ink-600')}>{i + 1}</span><Img src={p.images[0]} alt="" w={28} h={28} className="w-7 h-7 rounded" /><span className="flex-1 truncate">{p.title}</span><span className="font-num text-xs text-ink-500">{compact(p.sales)}</span></div>)}</div></div>
      </div>
      <div className="grid grid-cols-[1fr_1fr] gap-4">
        <div className="card p-5"><div className="flex items-center justify-between mb-3"><h2 className="font-semibold">最新订单</h2><Link to="/admin/orders" className="text-xs text-qn-600">全部 ›</Link></div><table className="w-full text-sm"><tbody>{orders.slice(0, 7).map(o => <tr key={o.id} className="border-b border-ink-100 last:border-0"><td className="py-2 font-num text-xs text-ink-500">{o.id.slice(-10)}</td><td className="py-2 truncate max-w-[200px]">{o.items[0].title}</td><td className="py-2 font-num">¥{money(o.payAmount)}</td><td className={cls('py-2 text-xs', ORDER_STATUS[o.status].color)}>{ORDER_STATUS[o.status].label}</td><td className="py-2 text-xs text-ink-400 text-right">{timeAgo(o.createdAt)}</td></tr>)}</tbody></table></div>
        <div className="card p-5"><div className="flex items-center justify-between mb-3"><h2 className="font-semibold flex items-center gap-1.5"><ShieldCheck className="w-4 h-4 text-qn-500" />操作日志</h2><Link to="/admin/logs" className="text-xs text-qn-600">全部 ›</Link></div><div className="space-y-2.5">{auditLogs.slice(0, 7).map(l => <div key={l.id} className="flex items-center gap-2 text-sm"><span className="w-1.5 h-1.5 rounded-full bg-qn-500" /><span className="font-medium">{l.actor}</span><span className="text-ink-600">{l.action}</span><span className="font-num text-xs text-ink-400">{l.target}</span><span className="ml-auto text-xs text-ink-400">{timeAgo(l.time)}</span></div>)}</div></div>
      </div>
    </div>
  )
}
