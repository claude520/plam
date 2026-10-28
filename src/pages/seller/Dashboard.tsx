import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight, ChevronLeft, Plus, Flame, Sparkles, Store, AlertTriangle, Calendar, Headphones, Bot, BarChart3, Users, Truck, Package, ClipboardList, Zap } from 'lucide-react'
import { useDB } from '@/store/db'
import { useCurrentShop } from '@/lib/hooks'
import { TrendArea, days } from '@/components/Charts'
import { cls, fmtDate, money } from '@/lib/format'
import { toast } from '@/store/session'

export default function SellerDashboard() {
  const shop = useCurrentShop()
  const { orders, refunds, reviews, products, announcements, banners, messages } = useDB()
  const my = orders.filter(o => o.shopId === shop.id)
  const todayStr = new Date().toDateString()
  const today = my.filter(o => new Date(o.createdAt).toDateString() === todayStr)
  const yesterday = my.filter(o => new Date(o.createdAt).toDateString() === new Date(Date.now() - 864e5).toDateString())
  const sum = (arr: typeof my) => arr.filter(o => o.status !== 'unpaid' && o.status !== 'closed').reduce((a, o) => a + o.payAmount, 0)
  const todo = [
    ['待付款', my.filter(o => o.status === 'unpaid').length, '/seller/orders?tab=unpaid'], ['待发货', my.filter(o => o.status === 'paid').length, '/seller/orders?tab=paid'],
    ['待售后', refunds.filter(r => r.shopId === shop.id && r.status === 'pending').length, '/seller/refunds'], ['待回复差评', reviews.filter(r => r.rating <= 3 && !r.reply && products.find(p => p.id === r.productId)?.shopId === shop.id).length, '/seller/reviews?tab=bad'],
    ['待处理投诉', 0, '/seller/refunds?tab=complaint'], ['违规', 0, '/seller/products?tab=violation'],
  ] as const
  const trend = useMemo(() => days(14, i => { const d = new Date(Date.now() - (13 - i) * 864e5).toDateString(); const os = my.filter(o => new Date(o.createdAt).toDateString() === d); return { 支付金额: Math.round(sum(os)), 访客数: 20 + Math.round(Math.abs(Math.sin(i * 1.7)) * 120), 订单数: os.length } }), [my]) // eslint-disable-line
  const [calMonth] = useState(new Date())
  const top = banners.find(b => b.position === 'seller-top' && b.status === 'on')
  const unread = messages.filter(m => m.shopId === shop.id && m.to === shop.id && !m.read).length
  const first = new Date(calMonth.getFullYear(), calMonth.getMonth(), 1).getDay()
  const dim = new Date(calMonth.getFullYear(), calMonth.getMonth() + 1, 0).getDate()

  return (
    <div className="grid grid-cols-[1fr_356px] lg-stack gap-4 items-start">
      <div className="space-y-4">
        {top && <Link to={top.link} className="block rounded-xl2 overflow-hidden min-h-[56px] md:h-16 relative" style={{ background: top.gradient }}><div className="md:absolute md:inset-0 flex items-center px-4 md:px-8 py-2.5 md:py-0 gap-3 text-white"><Flame className="w-6 h-6 md:w-8 md:h-8 shrink-0 opacity-90" /><span className="text-base md:text-2xl font-black italic tracking-wide drop-shadow leading-tight">{top.title}</span><span className="ml-auto shrink-0 bg-white text-brand-600 font-semibold rounded-full px-4 md:px-5 py-1.5 text-xs md:text-sm whitespace-nowrap">{top.subtitle}</span></div></Link>}
        <div className="rounded-xl2 overflow-hidden bg-gradient-to-r from-qn-500 to-qn-700 text-white grid grid-cols-6 max-md:!grid-cols-3 relative">
          <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle at 10% 20%, #fff 0, transparent 30%)' }} />
          {todo.map(([l, n, to]) => <Link key={l} to={to} className="relative py-5 text-center hover:bg-white/10 transition"><div className="text-3xl font-num font-bold">{n}</div><div className="text-sm opacity-90 mt-1">{l}</div></Link>)}
        </div>
        <section className="card p-5">
          <div className="flex items-center justify-between"><h2 className="font-semibold text-base">待处理</h2><Link to="/seller/orders" className="text-xs text-ink-400 flex items-center hover:text-qn-600">{todo.reduce((a, t) => a + t[1], 0) === 0 ? '暂无待处理任务，' : ''}查看全部<ChevronRight className="w-3.5 h-3.5" /></Link></div>
          {todo.filter(t => t[1] > 0).length > 0 && <div className="mt-3 flex gap-2 flex-wrap">{todo.filter(t => t[1] > 0).map(([l, n, to]) => <Link key={l} to={to} className="flex items-center gap-2 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 text-sm text-amber-800 hover:bg-amber-100"><AlertTriangle className="w-4 h-4" />{n} 笔{l}订单待处理<ChevronRight className="w-3.5 h-3.5" /></Link>)}</div>}
        </section>
        <section className="card p-5">
          <div className="flex items-center justify-between"><h2 className="font-semibold text-base flex items-center gap-2">店铺数据<span className="text-xs text-ink-400 font-normal">数据更新时间：{fmtDate(new Date().toISOString())}</span></h2><Link to="/seller/data" className="text-xs text-ink-500 flex items-center gap-1 hover:text-qn-600"><Plus className="w-3.5 h-3.5 border border-ink-400 rounded-sm" />指标<ChevronRight className="w-3.5 h-3.5" /></Link></div>
          <div className="grid grid-cols-4 gap-3 mt-4">
            {[['支付金额', money(sum(today)), money(sum(yesterday))], ['访客数', String(31 + today.length * 4), String(28)], ['支付子订单数', String(today.filter(o => o.status !== 'unpaid').length), String(yesterday.filter(o => o.status !== 'unpaid').length)], ['浏览量', String(126 + today.length * 9), String(104)]].map(([l, v, y]) => (
              <div key={l} className="bg-ink-50 rounded-xl p-4"><div className="text-xs text-ink-500">{l}</div><div className="text-2xl font-num font-semibold mt-1">{v}</div><div className="text-xs text-ink-400 mt-1">昨日 {y}</div></div>
            ))}
          </div>
          <div className="mt-4"><TrendArea data={trend} keys={['支付金额', '访客数']} height={200} /></div>
        </section>
        <section className="card p-5">
          <div className="flex items-center justify-between"><h2 className="font-semibold text-base">经营建议</h2><div className="text-xs text-ink-400 flex items-center gap-1"><ChevronLeft className="w-3.5 h-3.5" />1 / 1<ChevronRight className="w-3.5 h-3.5" /></div></div>
          <div className="grid grid-cols-3 gap-4 mt-4">
            {[['降成本', '开通资金服务，提现可领权益', '收支分析一目了然，可领极速回款免费权益', '去开通', '/seller/finance'], ['获流量', '1人正在浏览你的宝贝！限时1元抵101元', '平台已为您找到 27379 个有相似宝贝购买需求的消费者！', '1元扩大', '/seller/promotion'], ['必做', '开通资金服务，领退货宝红包', '升级生意卡，退货宝服务费低至 0.01 元', '去查看', '/seller/finance']].map(([tag, t, d, b, to]) => (
              <div key={t} className="rounded-xl border border-ink-100 p-4 hover:shadow-card transition"><div className="flex items-center gap-2"><span className={cls('tag text-white', tag === '降成本' ? 'bg-emerald-700' : tag === '获流量' ? 'bg-qn-500' : 'bg-brand-500')}>{tag}</span><span className="font-semibold text-sm line-clamp-1">{t}</span></div><div className="text-xs text-ink-500 mt-2 line-clamp-2 h-8">{d}</div><Link to={to} className="btn-sm btn mt-3 bg-qn-50 text-qn-600 hover:bg-qn-100">{b}</Link></div>
            ))}
          </div>
        </section>
        <section className="card p-5">
          <div className="flex items-center justify-between"><h2 className="font-semibold text-base flex items-center gap-2">我的应用<span className="text-xs text-ink-400 font-normal">常用工具一键直达</span></h2><Link to="/seller/market" className="text-xs text-ink-400 flex items-center hover:text-qn-600">服务市场<ChevronRight className="w-3.5 h-3.5" /></Link></div>
          <div className="grid grid-cols-6 max-md:!grid-cols-3 gap-3 mt-4">
            {[[<ClipboardList />, '工单中心', '/seller/market?tab=ticket', 'bg-emerald-500'], [<BarChart3 />, '生意参谋', '/seller/data', 'bg-qn-500'], [<Users />, '员工管理', '/seller/shop?tab=staff', 'bg-violet-500'], [<Truck />, '物流管家', '/seller/logistics', 'bg-sky-500'], [<Package />, '发布商品', '/seller/publish/category', 'bg-brand-500'], [<Bot />, 'AI 生意管家', '/seller/service?tab=ai', 'bg-pink-500']].map(([ic, l, to, c]) => (
              <Link key={l as string} to={to as string} className="flex flex-col items-center gap-2 py-3 rounded-xl hover:bg-ink-50 transition"><span className={cls('w-12 h-12 rounded-2xl text-white flex items-center justify-center [&>svg]:w-6 [&>svg]:h-6', c as string)}>{ic as React.ReactNode}</span><span className="text-sm">{l as string}</span></Link>
            ))}
          </div>
        </section>
      </div>

      <div className="space-y-4">
        <section className="card p-5">
          <div className="flex items-center justify-between"><h2 className="font-semibold text-lg truncate max-w-[200px]">{shop.name}</h2><div className="flex gap-1.5"><Link to="/seller/service" className="relative w-8 h-8 rounded-md border border-ink-200 flex items-center justify-center text-ink-600 hover:border-qn-500"><Headphones className="w-4 h-4" />{unread > 0 && <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-brand-500 text-white text-[10px] flex items-center justify-center">{unread}</span>}</Link><Link to={`/shop/${shop.id}`} className="w-8 h-8 rounded-md border border-ink-200 flex items-center justify-center text-ink-600 hover:border-qn-500"><Store className="w-4 h-4" /></Link></div></div>
          <div className="divider my-4" />
          <div className="text-sm font-semibold">真实体验分 <span className="font-num font-bold text-lg ml-1">{((shop.score.desc + shop.score.service + shop.score.logistics) / 3 * 20).toFixed(1)}</span></div>
          <div className="grid grid-cols-3 gap-2 mt-3 text-xs">{[['宝贝质量', shop.score.desc], ['物流速度', shop.score.logistics], ['服务保障', shop.score.service]].map(([l, v]) => <div key={l as string}><div className="text-ink-500">{l as string}</div><div className="font-num font-semibold text-base mt-0.5">{(v as number).toFixed(2)}</div></div>)}</div>
          {my.length < 30 && <div className="mt-3 text-xs text-brand-500 flex items-center gap-1 bg-brand-50 rounded-lg px-2.5 py-1.5"><span className="font-medium">预警</span><span className="text-ink-600 truncate">有效订单量不足30单，暂无真实体验分…</span><Link to="/seller/promotion" className="ml-auto whitespace-nowrap">去提升 ›</Link></div>}
          <div className="divider my-4" />
          <div className="grid grid-cols-3 gap-2 text-xs"><div><div className="text-ink-500">店铺成长层级</div><div className="font-semibold text-sm mt-0.5">L{shop.level}</div></div><div><div className="text-ink-500">信用等级</div><div className="mt-0.5 text-sky-700">{'◆'.repeat(Math.min(5, shop.level))}</div></div><div><div className="text-ink-500">店铺保证金</div><div className="font-semibold text-sm mt-0.5 text-emerald-700">已足额缴纳</div></div></div>
          <div className="divider my-4" />
          <div className="flex items-center justify-between text-sm"><span className="flex items-center gap-1.5 font-medium"><Zap className="w-4 h-4 text-qn-500" />订阅服务号</span><span className="text-xs text-ink-400 flex items-center">及时获取平台资讯，请添加<ChevronRight className="w-3.5 h-3.5" /></span></div>
        </section>
        <section className="card p-5">
          <div className="flex items-center justify-between"><h2 className="font-semibold text-base">Plam 头条</h2><Link to="/seller/shop?tab=rules" aria-label="查看更多" className="text-ink-400"><ChevronRight className="w-4 h-4" /></Link></div>
          <div className="mt-3 rounded-xl bg-gradient-to-r from-qn-50 to-sky-50 p-4 flex items-center gap-3"><div><div className="font-semibold text-qn-700">智图智影 0元试用</div><div className="text-xs text-ink-500 mt-0.5">双11素材灵活换，AI高效生图生视频</div></div><Sparkles className="w-10 h-10 text-qn-400 ml-auto" /></div>
          <ul className="mt-3 space-y-2.5 text-sm">{announcements.filter(a => a.audience !== 'buyer').slice(0, 4).map(a => <li key={a.id} className="flex items-center gap-2 text-ink-800 hover:text-qn-600 cursor-pointer" onClick={() => toast(a.content, 'info')}>{a.pinned && <span className="tag-red shrink-0">热点</span>}<span className="truncate">{a.title}</span></li>)}</ul>
        </section>
        <section className="card p-5">
          <div className="flex items-center justify-between"><h2 className="font-semibold text-base">商家日历</h2><div className="flex items-center gap-2 text-xs text-ink-500"><span className="bg-ink-100 rounded px-2 py-0.5">今日</span><ChevronLeft className="w-3.5 h-3.5" /><ChevronRight className="w-3.5 h-3.5" />{calMonth.getFullYear()}年{calMonth.getMonth() + 1}月</div></div>
          <div className="mt-3 rounded-xl bg-gradient-to-b from-rose-50 to-white border border-rose-100 p-3">
            <div className="grid grid-cols-7 text-center text-xs text-ink-500 mb-1">{['日', '一', '二', '三', '四', '五', '六'].map(d => <div key={d}>{d}</div>)}</div>
            <div className="grid grid-cols-7 text-center text-sm gap-y-1">{Array.from({ length: first }).map((_, i) => <div key={`e${i}`} />)}{Array.from({ length: dim }).map((_, i) => { const d = i + 1; const isToday = d === new Date().getDate(); return <div key={d} className={cls('h-8 flex items-center justify-center', isToday && 'text-white')}><span className={cls('w-7 h-7 rounded-full flex items-center justify-center', isToday && 'bg-brand-500')}>{d}</span></div> })}</div>
          </div>
          <div className="mt-3 text-xs text-ink-500 flex items-center gap-2"><Calendar className="w-3.5 h-3.5" />{fmtDate(new Date().toISOString(), false)} · <span className="text-ink-400">今日无日程</span></div>
        </section>
      </div>
    </div>
  )
}
