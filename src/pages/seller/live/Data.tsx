import { useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { Download, HelpCircle, Settings2, Wallet } from 'lucide-react'
import { useDB } from '@/store/db'
import { useCurrentShop } from '@/lib/hooks'
import { Img, Empty, Tabs } from '@/components/ui'
import { TrendArea, Bars, Donut, days, hours } from '@/components/Charts'
import { useMyLives, Panel, Metric, RangeTabs } from './common'
import { cls, compact, fmtDate, money, liveNo } from '@/lib/format'
import { toast } from '@/store/session'

const DATE_TABS = ['近7日', '近15日', '近30日', '日', '周', '月', '自定义']
function DateBar({ value, onChange, extra }: { value: string; onChange: (v: string) => void; extra?: React.ReactNode }) {
  return <div className="flex items-center gap-2 flex-wrap text-xs"><span className="text-ink-500">{fmtDate(new Date().toISOString(), false).replace(/-/g, '/')}</span><div className="flex border border-ink-200 rounded-md overflow-hidden">{DATE_TABS.map(t => <button key={t} onClick={() => onChange(t)} className={cls('px-2.5 h-7', value === t ? 'text-brand-500 font-medium' : 'text-ink-600 hover:bg-ink-50')}>{t}</button>)}</div><div className="flex border border-ink-200 rounded-md overflow-hidden"><button className="px-2.5 h-7 text-ink-600">同比</button><button className="px-2.5 h-7 text-brand-500 font-medium">环比</button></div>{extra}<button onClick={() => toast('指标设置已保存')} className="btn-outline btn-sm h-7 gap-1"><Settings2 className="w-3 h-3" />设置</button></div>
}
const useRangeDays = (v: string) => v === '近15日' ? 15 : v === '近30日' ? 30 : v === '日' ? 1 : v === '周' ? 7 : v === '月' ? 30 : 7
const Head = ({ title, update = true }: { title: string; update?: boolean }) => <div className="flex items-center justify-between flex-wrap gap-2"><h1 className="text-xl font-semibold">{title} {update && <span className="text-xs font-normal text-ink-500 ml-1">数据更新: {fmtDate(new Date(Date.now() - 864e5).toISOString(), false).replace(/-/g, '/')}</span>}</h1><div className="flex items-center gap-4 text-xs text-ink-600"><button onClick={() => toast('指标口径：以直播间内发生的行为统计')} className="flex items-center gap-1"><HelpCircle className="w-3.5 h-3.5" />指标口径</button><Link to="/seller/live/classroom" className="flex items-center gap-1">📘 使用攻略</Link></div></div>

function useLiveMetrics(rangeDays: number) {
  const lives = useMyLives()
  const shop = useCurrentShop()
  const orders = useDB(s => s.orders)
  return useMemo(() => {
    const since = Date.now() - rangeDays * 864e5
    const ls = lives.filter(l => l.status !== 'scheduled' && new Date(l.startedAt ?? l.plannedAt).getTime() > since)
    const liveOrders = orders.filter(o => o.shopId === shop.id && o.liveId && lives.some(l => l.id === o.liveId) && new Date(o.createdAt).getTime() > since && o.status !== 'unpaid' && o.status !== 'closed')
    const sum = (k: keyof typeof ls[number]['stats']) => ls.reduce((a, l) => a + l.stats[k], 0)
    const gmv = sum('gmv') + liveOrders.reduce((a, o) => a + o.payAmount, 0)
    const buyers = sum('orders') + liveOrders.length
    return { ls, liveOrders, gmv, buyers, views: sum('views'), peak: Math.max(0, ...ls.map(l => l.stats.peak)), likes: sum('likes'), comments: sum('comments'), fans: sum('newFans'), clicks: sum('clicks'), duration: sum('duration'), refund: Math.round(gmv * 0.06), since }
  }, [lives, orders, shop.id, rangeDays])
}

export function Overview() {
  const [range, setRange] = useState('近7日')
  const [tab, setTab] = useState<'core' | 'all'>('core')
  const m = useLiveMetrics(useRangeDays(range))
  const trend = useMemo(() => hours(i => ({ 成交金额: i < new Date().getHours() ? Math.round(m.gmv / 24 * (0.4 + Math.abs(Math.sin(i / 3)) * 1.2)) : 0 })), [m.gmv])
  const rate = (a: number, b: number) => b ? `${(a / b * 100).toFixed(1)}%` : '--'
  return (
    <div className="max-w-[1260px] space-y-4">
      <Head title="直播概览" />
      <div className="rounded-lg bg-white border border-ink-100 px-4 py-2.5 text-xs text-ink-600">🔔 原「成交拆解」功能已迁移至【交易分析-概览】页面，请主播前往查看相关数据。</div>
      <div className="flex items-center justify-between flex-wrap gap-2"><Tabs accent="brand" items={[{ key: 'core', label: '核心指标' }, { key: 'all', label: '全部指标' }]} value={tab} onChange={setTab} /><DateBar value={range} onChange={setRange} /></div>
      <div className="card grid grid-cols-[1fr_1fr] lg-stack">
        <div className="border-r border-ink-100">
          <div className="p-5 border-b-2 border-ink-900 bg-ink-50/50 flex items-start justify-between flex-wrap gap-2"><div><div className="text-xs text-ink-600">成交金额（元）<HelpCircle className="w-3 h-3 inline ml-0.5" /></div><div className="text-3xl font-num font-bold mt-1">{money(m.gmv)}</div><div className="text-xs text-ink-400 mt-1">较同行同层均值 <span className="text-emerald-600">+12%</span></div></div><div className="text-xs text-ink-500 text-right space-y-1"><div>铁粉及以上成交 ¥{money(m.gmv * 0.38, 0)} 占比 38%</div><div>新粉及非粉成交 ¥{money(m.gmv * 0.62, 0)} 占比 62%</div><div>直播讲解引导成交 ¥{money(m.gmv * 0.71, 0)} 占比 71%</div></div></div>
          <div className="grid grid-cols-3 max-md:!grid-cols-1 divide-x divide-ink-100 border-b border-ink-100"><Metric label="成交人数" value={compact(m.buyers)} sub="较同行同层均值 +8%" help /><Metric label="确认收货金额（元）" value={money(m.gmv * 0.82, 0)} sub="较同行同层均值 +5%" help /><Metric label="确认收货人数" value={compact(Math.round(m.buyers * 0.82))} sub="较同行同层均值 持平" help /></div>
          <div className="grid grid-cols-3 max-md:!grid-cols-1 divide-x divide-ink-100"><Metric label="退款金额（元）" value={money(m.refund)} sub="较同行同层优秀 -2%" help /><Metric label="问题订单率" value={m.buyers ? '0.8%' : '--'} sub={<span>较同行同层优秀 <Link to="/seller/live/data/transaction" className="link">更多 ›</Link></span>} help />{tab === 'all' && <Metric label="观看次数" value={compact(m.views)} sub="较同行同层均值 +15%" help />}</div>
        </div>
        <div className="p-5"><div className="text-sm font-medium">成交金额（元）</div><div className="mt-2 flex items-center gap-4 text-xs text-ink-500"><label className="flex items-center gap-1"><input type="checkbox" defaultChecked className="accent-brand-500" />我的</label><label className="flex items-center gap-1"><input type="checkbox" className="accent-brand-500" />对比期</label><label className="flex items-center gap-1"><input type="checkbox" className="accent-brand-500" />日均值</label></div><TrendArea data={trend} keys={['成交金额']} height={220} /></div>
      </div>
      {tab === 'all' && <div className="card grid grid-cols-6 max-md:!grid-cols-2 divide-x divide-ink-100"><Metric label="观看人数" value={compact(Math.round(m.views * 0.7))} /><Metric label="最高在线" value={compact(m.peak)} /><Metric label="点赞" value={compact(m.likes)} /><Metric label="评论" value={compact(m.comments)} /><Metric label="商品点击" value={compact(m.clicks)} /><Metric label="开播时长（分）" value={m.duration} /></div>}
      <div className="flex items-center justify-between flex-wrap gap-2"><h2 className="font-semibold text-base">核心经营路径</h2><div className="text-xs text-ink-500 flex items-center gap-2"><span>{fmtDate(new Date(m.since).toISOString(), false).replace(/-/g, '/')}-{fmtDate(new Date().toISOString(), false).replace(/-/g, '/')}</span><RangeTabs value="近7天" onChange={() => { /* static */ }} items={['日', '近7天', '近30天']} /></div></div>
      <div className="grid grid-cols-3 max-lg:!grid-cols-1 gap-4">
        <Panel title="流量获取" extra={<Link to="/seller/live/data/live" className="link text-xs">查看详情</Link>}><div className="space-y-3 text-sm">{[['日均观看人数', compact(Math.round(m.views * 0.7 / 7)), '建议值 1,000'], ['有讲解商品数', m.ls.reduce((a, l) => a + l.keypoints.length, 0), `未讲解 ${Math.max(0, m.ls.reduce((a, l) => a + l.productIds.length - l.keypoints.length, 0))}`], ['内容质量分', m.ls.length ? 78 : '--', '较同行同层 +6']].map(([l, v, s]) => <div key={l as string} className="flex items-center justify-between"><div><div className="text-ink-600">{l as string}</div><div className="text-xs text-ink-400">{s as string}</div></div><div className="text-xl font-num font-semibold">{v as React.ReactNode}</div></div>)}<div className="rounded-md bg-ink-50 p-3 text-xs text-ink-600">核心运营动作：开播前发布预告、固定开播时段、讲解覆盖全部货盘商品</div></div></Panel>
        <Panel title="粉丝运营" extra={<Link to="/seller/live/data/fans" className="link text-xs">粉丝分析</Link>}><div className="space-y-3 text-sm">{[['日均铁粉⁺观看人数', compact(Math.round(m.views * 0.12 / 7)), '建议值 200'], ['铁粉⁺规模', compact(Math.round(m.fans * 6)), '同比 +18%'], ['铁粉⁺成交人数', compact(Math.round(m.buyers * 0.38)), `成交金额占比 ${rate(m.gmv * 0.38, m.gmv)}`], ['新增铁粉⁺人数', compact(m.fans), '同比 +9%']].map(([l, v, s]) => <div key={l as string} className="flex items-center justify-between"><div><div className="text-ink-600">{l as string}</div><div className="text-xs text-ink-400">{s as string}</div></div><div className="text-xl font-num font-semibold">{v as React.ReactNode}</div></div>)}<div className="rounded-md bg-ink-50 p-3 text-xs text-ink-600">粉丝运营：通过粉丝专属商品、权益等福利做好粉丝粘性，粉丝层级越高，贡献的商业价值越大。</div></div></Panel>
        <Panel title="闪降闪赠" extra={<Link to="/seller/live/interaction" className="link text-xs">去开启</Link>}><div className="space-y-3 text-sm">{[['闪降闪赠成交金额占比', m.gmv ? '23.5%' : '--', '建议值 30%'], ['日均生效商品数', m.ls.length ? 4 : '--', '环比 +1'], ['H4商品数占比', m.ls.length ? '41%' : '--', '环比 +3%'], ['日均成交金额', money(m.gmv * 0.235 / 7, 0), `成交人数 ${compact(Math.round(m.buyers * 0.2))}`]].map(([l, v, s]) => <div key={l as string} className="flex items-center justify-between"><div><div className="text-ink-600">{l as string}</div><div className="text-xs text-ink-400">{s as string}</div></div><div className="text-xl font-num font-semibold">{v as React.ReactNode}</div></div>)}<div className="rounded-md bg-ink-50 p-3 text-xs text-ink-600">闪降闪赠是店播商品爆发的主流必备活动玩法，请关注活动广场中的报名时间。</div></div></Panel>
      </div>
      <Panel title={<span>优秀案例 <span className="text-xs font-normal text-ink-500">{fmtDate(new Date(Date.now() - 7 * 864e5).toISOString(), false).replace(/-/g, '/')}-{fmtDate(new Date().toISOString(), false).replace(/-/g, '/')}</span></span>}>
        <div className="grid grid-cols-3 max-md:!grid-cols-1 gap-4 text-sm">{[['优质内容', ['优质封面', '优质讲解']], ['粉丝高频回访', ['高效转粉', '粉丝跃迁']], ['闪降', ['闪赠']]].map(([t, subs]) => <div key={t as string} className="rounded-lg bg-ink-50 p-4"><div className="font-medium">{t as string}</div><div className="mt-2 flex gap-2 text-xs text-ink-500">{(subs as string[]).map(s => <span key={s} className="rounded bg-white px-2 py-0.5">{s}</span>)}</div><div className="mt-4 text-xs text-ink-400 text-center py-4">暂无数据</div></div>)}</div>
      </Panel>
    </div>
  )
}

const COLS = ['场次ID', '直播开播时间', '开播时长', '观看人数', '观看次数', '新增粉丝数', '流量券消耗', '观看总时长（秒）', '人均观看时长（秒）', '次均观看时长（秒）', '商品点击人数', '商品点击次数', '商品点击率', '加购人数', '加购件数', '加购次数', '成交金额（元）', '成交人数', '成交件数', '成交笔数', '成交转化率', '退款人数', '退款笔数', '退款件数', '退款金额（元）', '预售定金支付金额（元）', '预售预估总金额（元）', '最高在线人数']
export function SessionAnalysis() {
  const [sp] = useSearchParams()
  const lives = useMyLives().filter(l => l.status !== 'scheduled')
  const [range, setRange] = useState('近30日')
  const [mode, setMode] = useState<'realtime' | 'replay'>('realtime')
  const [cmp, setCmp] = useState<string[]>([])
  const [q, setQ] = useState('')
  const d = useRangeDays(range)
  const list = lives.filter(l => new Date(l.startedAt ?? l.plannedAt).getTime() > Date.now() - d * 864e5 && (!q || l.title.includes(q) || l.id.includes(q)))
  const focus = sp.get('id')
  const row = (l: typeof lives[number]) => { const s = l.stats; const views = Math.round(s.views * 0.72); const clicksP = Math.round(s.clicks * 0.6); return [liveNo(l.id), fmtDate(l.startedAt), `${s.duration} 分钟`, compact(views), compact(s.views), s.newFans, Math.round(s.views * 0.05), compact(s.views * 95), 132, 95, compact(clicksP), compact(s.clicks), views ? `${(clicksP / views * 100).toFixed(1)}%` : '0%', Math.round(s.orders * 2.6), Math.round(s.orders * 3.1), Math.round(s.orders * 2.9), money(s.gmv), s.orders, Math.round(s.orders * 1.3), s.orders, views ? `${(s.orders / views * 100).toFixed(2)}%` : '0%', Math.round(s.orders * 0.06), Math.round(s.orders * 0.06), Math.round(s.orders * 0.07), money(s.gmv * 0.06), '0.00', '0.00', compact(s.peak)] }
  const download = () => { const csv = [['场次信息', ...COLS].join(','), ...list.map(l => [l.title, ...row(l)].join(','))].join('\n'); const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv' })); a.download = '场次分析.csv'; a.click() }
  return (
    <div className="max-w-[1260px] space-y-4">
      <Head title="场次分析" />
      <div className="grid grid-cols-2 max-md:!grid-cols-1 card overflow-hidden">{([['realtime', '实时下播数据', '已结束的直播，展示下播定格数据；未结束直播场次为当前实时数据'], ['replay', '含回放累计数据', '次日12点前更新前一日开播场次数据，持续追踪下播后15日内引导成交等数据']] as const).map(([k, t, dsc]) => <button key={k} onClick={() => setMode(k)} className={cls('text-left p-4 flex gap-3 items-start border-b-2', mode === k ? 'border-ink-900' : 'border-transparent')}><span className="w-9 h-9 rounded-full bg-ink-50 flex items-center justify-center text-ink-700">⏻</span><div><div className="font-medium">{t}</div><div className="text-xs text-ink-500 mt-1">{dsc}</div></div></button>)}</div>
      <div className="flex items-center justify-between flex-wrap gap-2"><h2 className="font-semibold">直播分场次效果</h2><DateBar value={range} onChange={setRange} /></div>
      <div className="card p-4">
        <div className="flex items-center gap-2 flex-wrap"><button disabled={cmp.length < 2} onClick={() => toast(`对比 ${cmp.length} 场：成交金额 ${cmp.map(id => money(lives.find(l => l.id === id)!.stats.gmv, 0)).join(' vs ')}`)} className="btn-outline btn-sm h-8">场次对比</button><span className="text-xs text-ink-500">对比场次({cmp.length}/2)</span><div className="ml-auto flex items-center gap-2"><input value={q} onChange={e => setQ(e.target.value)} placeholder="请输入..." className="input-qn h-8 w-40 text-xs" /><button onClick={() => toast('指标设置已保存')} className="btn-outline btn-sm h-8">设 置</button><button onClick={download} className="btn-outline btn-sm h-8 gap-1"><Download className="w-3.5 h-3.5" />下 载</button></div></div>
        {list.length ? <div className="mt-3 overflow-x-auto"><table className="text-sm min-w-[2400px]"><thead><tr className="text-left text-ink-600 border-b border-ink-100 bg-ink-50/60"><th className="py-2.5 px-2 sticky left-0 bg-ink-50 font-medium">场次信息</th>{COLS.map(c => <th key={c} className="px-2 font-medium whitespace-nowrap">{c} ⇅</th>)}<th className="px-2 font-medium">操作</th></tr></thead><tbody>{list.map(l => <tr key={l.id} className={cls('border-b border-ink-50', focus === l.id && 'bg-brand-50/60')}><td className="py-2.5 px-2 sticky left-0 bg-white"><label className="flex items-center gap-2"><input type="checkbox" checked={cmp.includes(l.id)} onChange={e => setCmp(e.target.checked ? [...cmp, l.id].slice(-2) : cmp.filter(x => x !== l.id))} className="accent-brand-500" /><Img src={l.cover} alt="" w={60} h={80} className="w-8 h-10 rounded object-cover" /><span className="truncate max-w-[140px]">{l.title}</span>{l.status === 'live' && <span className="tag-red">直播中</span>}</label></td>{row(l).map((v, i) => <td key={i} className="px-2 font-num whitespace-nowrap">{v}</td>)}<td className="px-2"><Link to={`/seller/live/data/transaction?id=${l.id}`} className="link text-xs whitespace-nowrap">详情</Link></td></tr>)}</tbody></table></div> : <div className="py-12"><Empty text="暂无内容" /></div>}
      </div>
    </div>
  )
}

export function Transaction() {
  const [range, setRange] = useState('近7日')
  const [kind, setKind] = useState<'self' | 'coop'>('self')
  const [tab, setTab] = useState<'overview' | 'orders' | 'goods' | 'refund'>('overview')
  const [dim, setDim] = useState('渠道数据')
  const m = useLiveMetrics(useRangeDays(range))
  const { products } = useDB()
  const views = Math.round(m.views * 0.72)
  const rate = views ? m.buyers / views : 0
  const channels = [['视频', 0.08], ['直播-关注', 0.22], ['宝贝详情页', 0.11], ['搜索', 0.14], ['主页/橱窗', 0.06], ['推荐', 0.25], ['订阅', 0.05], ['分享回流', 0.04], ['店铺', 0.05]] as const
  const trend = useMemo(() => days(useRangeDays(range), i => ({ 成交金额: Math.round(m.gmv / useRangeDays(range) * (0.5 + Math.abs(Math.sin(i * 1.3))) ), 观看人数: Math.round(views / useRangeDays(range) * (0.6 + Math.abs(Math.cos(i * 0.9))) ) })), [m.gmv, views, range])
  const hourly = useMemo(() => hours(i => ({ 流量: [0, 11, 17, 22].includes(i) ? 90 + i : 20 + Math.round(Math.abs(Math.sin(i)) * 40) })), [])
  const goods = useMemo(() => products.filter(p => m.ls.some(l => l.productIds.includes(p.id))).map((p, i) => { const r = i < 5 ? [0.3, 0.2, 0.15, 0.1, 0.08][i] : 0.02; return { p, gmv: Math.round(m.gmv * r), n: Math.round(m.buyers * r) } }).slice(0, 8), [products, m])
  return (
    <div className="max-w-[1260px] space-y-4">
      <Head title="交易分析" />
      <div className="rounded-lg bg-white border border-ink-100 px-4 py-2.5 text-xs text-ink-600">🔔 原「成交拆解」功能已迁移至【交易分析-概览】页面，请主播在此查看相关数据。</div>
      <div className="grid grid-cols-2 max-md:!grid-cols-1 card overflow-hidden">{([['self', '店播直播间分析', '📦'], ['coop', '合作直播间分析', '🤝']] as const).map(([k, t, ic]) => <button key={k} onClick={() => setKind(k)} className={cls('text-left p-4 flex gap-3 items-center border-b-2', kind === k ? 'border-ink-900' : 'border-transparent')}><span className="text-xl">{ic}</span><span className="font-medium">{t}</span></button>)}</div>
      <Tabs accent="brand" items={[{ key: 'overview', label: '交易概览' }, { key: 'orders', label: '订单明细' }, { key: 'goods', label: '商品构成' }, { key: 'refund', label: '退款分析' }]} value={tab} onChange={setTab} />
      <div className="rounded-lg bg-white border border-ink-100 px-4 py-2.5 text-xs text-ink-600">🔔 本tab的数据为直播间内的所有数据。店播主播朋友可通过明细中"是否为本店商品"字段区分本店商品</div>
      {tab === 'overview' && <>
        <div className="flex items-center justify-between flex-wrap gap-2"><h2 className="font-semibold">成交拆解</h2><DateBar value={range} onChange={setRange} extra={<button onClick={() => toast('已导出')} className="btn-outline btn-sm h-7">下载</button>} /></div>
        <div className="rounded-lg bg-white border border-ink-100 px-4 py-2.5 text-xs text-ink-600">📋 优化建议 | 成交金额在所选周期下，较对比周期{m.gmv ? '有上升（+12%）' : '有下降（--）'}，较同行同层优秀 {m.gmv ? '+8%' : '--'}，请继续加油！</div>
        <div className="grid grid-cols-5 max-md:!grid-cols-1 gap-2 items-stretch">{[['成交金额', money(m.gmv), '='], ['播中观看人数', compact(views), '×'], ['播中访购率', `${(rate * 100).toFixed(2)}%`, '×'], ['播中客单价', money(m.buyers ? m.gmv / m.buyers : 0), '+'], ['直播后成交', money(m.gmv * 0.08), '']].map(([l, v, op]) => <div key={l} className="relative card p-4"><div className="text-xs text-ink-600">{l} <HelpCircle className="w-3 h-3 inline" /></div><div className="text-2xl font-num font-semibold mt-1">{v}</div><div className="text-xs text-ink-400 mt-1">较同行同层均值 {m.gmv ? '+6%' : '--'}</div>{op && <span className="absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-ink-900 text-white text-xs flex items-center justify-center z-10 max-md:hidden">{op}</span>}</div>)}</div>
        <div className="card p-4">
          <div className="flex items-center gap-5 text-sm border-b border-ink-100 pb-2 overflow-x-auto no-scrollbar">{['渠道数据', '粉丝数据', '新老客数据', '六大人群', '用户画像'].map(t => <button key={t} onClick={() => setDim(t)} className={cls('whitespace-nowrap', dim === t ? 'font-semibold text-ink-900' : 'text-ink-500')}>{t}</button>)}<span className="ml-auto text-xs text-ink-400 whitespace-nowrap">首触口径 · 路过口径</span></div>
          {dim === '渠道数据' ? <table className="w-full mt-3 text-sm"><thead><tr className="text-left text-ink-600 border-b border-ink-100"><th className="py-2 font-medium">渠道</th><th className="font-medium">播中成交金额（元）</th><th className="font-medium">播中观看人数</th><th className="font-medium">播中访购率</th><th className="font-medium">播中客单价</th><th className="font-medium">播中成交金额占比</th><th className="font-medium">播中观看人数占比</th></tr></thead><tbody>{channels.map(([c, r]) => <tr key={c} className="border-b border-ink-50"><td className="py-2.5">{c}<div className="text-[10px] text-ink-400">环比 +{Math.round(r * 40)}%</div></td><td className="font-num">{money(m.gmv * r)}</td><td className="font-num">{compact(Math.round(views * r))}</td><td className="font-num">{(rate * 100 * (0.8 + r)).toFixed(2)}%</td><td className="font-num">{money(m.buyers ? m.gmv / m.buyers : 0)}</td><td className="font-num">{(r * 100).toFixed(0)}%</td><td className="font-num">{(r * 100).toFixed(0)}%</td></tr>)}</tbody></table> : <div className="grid grid-cols-[320px_1fr] max-md:!grid-cols-1 gap-4 mt-3"><Donut data={dim === '粉丝数据' ? [{ name: '铁粉及以上', value: 38 }, { name: '新粉', value: 24 }, { name: '非粉', value: 38 }] : dim === '新老客数据' ? [{ name: '新客', value: 61 }, { name: '老客', value: 39 }] : dim === '六大人群' ? [{ name: '精致妈妈', value: 22 }, { name: '新锐白领', value: 26 }, { name: '资深中产', value: 18 }, { name: '小镇青年', value: 14 }, { name: 'Z世代', value: 12 }, { name: '都市银发', value: 8 }] : [{ name: '女性', value: 68 }, { name: '男性', value: 32 }]} /><div className="text-sm text-ink-600 self-center">按{dim}拆解播中成交占比，可结合「直播推广」定向投放高价值人群。</div></div>}
          <div className="text-xs text-ink-400 mt-2">共{dim === '渠道数据' ? 9 : 2}项数据</div>
        </div>
        <Panel title="趋势分析" extra={<DateBar value={range} onChange={setRange} />}><TrendArea data={trend} keys={['成交金额', '观看人数']} height={260} /></Panel>
        <Panel title="开播分析"><div className="text-xs text-ink-600 mb-2">我的高时段流量：<b>{m.ls.length ? '20:00-22:00' : '--'}</b> · 平台的高时段流量：凌晨场 00:00-01:00 / 上午场 11:00-12:00 / 下午场 17:00-18:00 / 晚上场 22:00-23:00</div><Bars data={hourly} keys={['流量']} height={200} /></Panel>
      </>}
      {tab === 'orders' && <div className="card p-4">{m.liveOrders.length ? <table className="w-full text-sm"><thead><tr className="text-left text-ink-600 border-b border-ink-100"><th className="py-2 font-medium">订单号</th><th className="font-medium">商品</th><th className="font-medium">直播场次</th><th className="font-medium">金额</th><th className="font-medium">状态</th><th className="font-medium">是否本店商品</th><th className="font-medium">下单时间</th></tr></thead><tbody>{m.liveOrders.map(o => <tr key={o.id} className="border-b border-ink-50"><td className="py-2.5 font-num">{o.id}</td><td className="truncate max-w-[240px]">{o.items[0]?.title}</td><td className="text-xs">{m.ls.find(l => l.id === o.liveId)?.title ?? o.liveId}</td><td className="font-num price">¥{money(o.payAmount)}</td><td><span className="tag-green">{o.status}</span></td><td>是</td><td className="text-xs font-num">{fmtDate(o.createdAt)}</td></tr>)}</tbody></table> : <div className="py-12"><Empty text="所选周期内暂无直播订单（买家在直播间下单后会显示在这里）" /></div>}</div>}
      {tab === 'goods' && <div className="card p-4">{goods.length ? <table className="w-full text-sm"><thead><tr className="text-left text-ink-600 border-b border-ink-100"><th className="py-2 font-medium">商品</th><th className="font-medium">成交金额</th><th className="font-medium">成交人数</th><th className="font-medium">占比</th><th className="font-medium">讲解次数</th></tr></thead><tbody>{goods.map(g => <tr key={g.p.id} className="border-b border-ink-50"><td className="py-2.5"><div className="flex items-center gap-2"><Img src={g.p.images[0]} alt="" w={80} h={80} className="w-10 h-10 rounded object-cover" /><span className="truncate max-w-[280px]">{g.p.title}</span></div></td><td className="font-num">¥{money(g.gmv)}</td><td className="font-num">{g.n}</td><td className="font-num">{m.gmv ? (g.gmv / m.gmv * 100).toFixed(1) : 0}%</td><td className="font-num">{m.ls.reduce((a, l) => a + l.keypoints.filter(k => k.productId === g.p.id).length, 0)}</td></tr>)}</tbody></table> : <Empty text="暂无数据" />}</div>}
      {tab === 'refund' && <div className="grid grid-cols-4 max-md:!grid-cols-2 gap-3"><div className="card"><Metric label="退款金额（元）" value={money(m.refund)} sub="较同行同层优秀" /></div><div className="card"><Metric label="退款笔数" value={Math.round(m.buyers * 0.06)} /></div><div className="card"><Metric label="退款率" value={m.buyers ? '6.0%' : '--'} sub="行业均值 8.2%" /></div><div className="card"><Metric label="主要退款原因" value={<span className="text-base">七天无理由</span>} sub="占比 54%" /></div></div>}
    </div>
  )
}

export function Fans() {
  const [range, setRange] = useState('近7日')
  const m = useLiveMetrics(useRangeDays(range))
  const shop = useCurrentShop()
  const [view, setView] = useState<'list' | 'chart'>('list')
  const [rp, setRp] = useState('全部')
  const levels = [['全部粉丝', 1], ['星辰粉', 0.01], ['超级粉', 0.03], ['挚爱粉', 0.06], ['钻粉', 0.1], ['铁粉', 0.2], ['新粉', 0.35], ['无亲密度粉丝', 0.25]] as const
  const total = shop.fans
  return (
    <div className="max-w-[1260px] space-y-4">
      <Head title="粉丝分析" />
      <div className="rounded-lg bg-white border border-ink-100 px-4 py-2.5 text-xs text-ink-600">🔔 新版粉丝分析重磅上线！本次更新覆盖粉丝画像、规模量、活跃度、成交数、粉丝运营工具等，请主播们体验新版功能~</div>
      <div className="flex items-center justify-between flex-wrap gap-2"><h2 className="font-semibold">粉丝运营目标</h2><DateBar value={range} onChange={setRange} /></div>
      <div className="card p-5 flex items-center gap-6 flex-wrap"><div><div className="text-xs text-ink-600">铁粉及以上观看人数 <HelpCircle className="w-3 h-3 inline" /></div><div className="text-3xl font-num font-bold mt-1">{compact(Math.round(m.views * 0.12))}</div><div className="text-xs text-ink-400 mt-1">环比 +4% · 较同行同层均值 +11%</div></div><div className="flex-1 min-w-[200px]"><TrendArea data={days(7, i => ({ 铁粉观看: Math.round(m.views * 0.12 / 7 * (0.7 + Math.abs(Math.sin(i)))) }))} keys={['铁粉观看']} height={90} /></div><button onClick={() => toast('粉丝画像：女性 68% · 25-34 岁 46% · 一二线城市 57%')} className="btn-outline">粉丝画像</button></div>
      <div className="card grid grid-cols-3 max-md:!grid-cols-1 divide-x divide-ink-100">{[['规模量', '铁粉及以上活跃粉丝（去沉睡）', compact(Math.round(total * 0.4)), '环比 +3% · 回访率 42%', '粉丝资产详情'], ['活跃度', '铁粉及以上本月人均访问天数', '6.4', '环比 +0.3 · 较同行同层均值 +1.1', '回访天数分布'], ['成交数', '铁粉及以上成交金额', `¥${money(m.gmv * 0.38, 0)}`, '环比 +8% · 占总成交 38%', '粉丝直播间表现']].map(([t, l, v, s, a]) => <div key={t} className="p-5"><div className="font-medium">{t}</div><div className="mt-2 text-xs text-ink-600 flex items-center justify-between">{l} <HelpCircle className="w-3 h-3" /><button onClick={() => toast(`${a}：演示数据`)} className="link ml-auto">{a} ›</button></div><div className="text-2xl font-num font-semibold mt-2">{v}</div><div className="text-xs text-ink-400 mt-1">{s}</div></div>)}</div>
      <div className="flex items-center justify-between flex-wrap gap-2"><h2 className="font-semibold">粉丝资产分布</h2><div className="flex items-center gap-2"><RangeTabs value={view === 'list' ? '列表' : '图表'} onChange={v => setView(v === '列表' ? 'list' : 'chart')} items={['列表', '图表']} /><button onClick={() => toast('已导出')} className="btn-outline btn-sm h-7">下载</button></div></div>
      <div className="card p-4">{view === 'list' ? <table className="w-full text-sm"><thead><tr className="text-left text-ink-600 border-b border-ink-100"><th className="py-2 font-medium">粉丝等级</th><th className="font-medium">累计粉丝数</th><th className="font-medium">活跃粉丝数<div className="text-[10px] font-normal text-ink-400">近一年买过或近30天来过</div></th><th className="font-medium">成交核心粉丝数<div className="text-[10px] font-normal text-ink-400">近30天买过</div></th><th className="font-medium">成交流失粉丝数<div className="text-[10px] font-normal text-ink-400">近一年买过但近30天没来</div></th><th className="font-medium">沉睡粉丝数<div className="text-[10px] font-normal text-ink-400">一年没买且近30天没来</div></th></tr></thead><tbody>{levels.map(([l, r]) => { const n = Math.round(total * r); return <tr key={l} className="border-b border-ink-50"><td className="py-2.5 font-medium">{l}</td>{[1, 0.46, 0.18, 0.12, 0.24].map((f, i) => <td key={i} className="font-num">{compact(Math.round(n * f))}<div className="text-[10px] text-ink-400">{r < 1 && `占比 ${(r * 100).toFixed(0)}% · `}环比 +{(2 + i)}%</div></td>)}</tr> })}</tbody></table> : <Bars data={levels.slice(1).map(([l, r]) => ({ name: l, 粉丝数: Math.round(total * r) }))} keys={['粉丝数']} height={260} />}</div>
      <Panel title="粉丝红包组合策略" extra={<DateBar value={range} onChange={setRange} />}><div className="flex items-center gap-1 text-sm mb-3">{['全部', '红包雨', '万能红包', '宠粉红包', '新客红包'].map(t => <button key={t} onClick={() => setRp(t)} className={cls('px-3 h-8 rounded-md', rp === t ? 'bg-brand-50 text-brand-600' : 'text-ink-700 hover:bg-ink-100')}>{t}</button>)}</div><div className="py-8 text-center text-sm text-ink-500">暂无内容<div className="text-xs text-ink-400 mt-1">当前所选时间内 未使用该工具 · <Link to="/seller/live/interaction" className="link">去使用</Link></div></div></Panel>
    </div>
  )
}

export function Commodity() {
  const [top, setTop] = useState<'goods' | 'insight'>('goods')
  const [sub, setSub] = useState<'cat' | 'item'>('cat')
  const [cat, setCat] = useState('')
  const [tab, setTab] = useState('品类概览')
  const { categories, products } = useDB()
  const m = useLiveMetrics(30)
  const roots = categories.filter(c => !c.parentId)
  const mine = products.filter(p => m.ls.some(l => l.productIds.includes(p.id)) && (!cat || p.categoryId.startsWith(cat)))
  const metricsCols = ['直播间发布商品数', '商品曝光人数', '商品曝光次数', '商品点击人数', '商品点击次数', '商品点击次数占比', '商品点击率', '成交人数', '成交笔数', '成交商品件数', '成交金额（元）', '成交转化率', '客单价（元）', '笔单价（元）', '件单价（元）', '动销率', '品类效能', '退款人数', '退款商品件数', '退款笔数', '退款金额（元）', '退单率', '退款率', '退款人数占比']
  return (
    <div className="max-w-[1260px] space-y-4">
      <Head title="商品分析" />
      <div className="rounded-lg bg-white border border-ink-100 px-4 py-2.5 text-xs text-ink-600 flex items-center gap-2"><span className="text-brand-500 font-medium">公告</span><span className="truncate">【直播商品效果】概览指标支持同行同层对比，商品诊断板块可查看重点运营的商品及待优化的商品 · 【行业选品洞察】基于直播成交用户洞察全淘系品类偏好 · 【人群选品洞察】支持洞察主播通用人群近7天全淘系需求偏好</span></div>
      <div className="card overflow-hidden">
        <div className="flex items-center gap-6 px-5 border-b border-ink-100">{(['goods', 'insight'] as const).map(k => <button key={k} onClick={() => setTop(k)} className={cls('relative py-3.5 text-[15px]', top === k ? 'font-semibold text-ink-900 after:absolute after:left-0 after:right-0 after:bottom-0 after:h-0.5 after:bg-ink-900' : 'text-ink-600')}>{k === 'goods' ? '货品分析' : '选品洞察'}</button>)}</div>
        {top === 'goods' ? <>
          <div className="grid grid-cols-2 max-md:!grid-cols-1 gap-3 p-5">{([['cat', '直播品类总览', '支持从一级到叶子类目分析及诊断，优化品类效果'], ['item', '直播商品效果', '支持商品分析、诊断及下游应用，打造更多爆品']] as const).map(([k, t, d]) => <button key={k} onClick={() => setSub(k)} className={cls('text-left rounded-lg border p-4 flex gap-3', sub === k ? 'border-brand-400 bg-brand-50/40' : 'border-ink-100')}><span className="w-9 h-9 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center">▦</span><div><div className="font-medium">{t}</div><div className="text-xs text-ink-500 mt-1">{d}</div></div></button>)}</div>
          <div className="mx-5 rounded-md bg-sky-50 text-sky-800 text-xs px-3 py-2">ⓘ 本页面统计开播时间为所选周期的开播商品的表现（不含历史开播但成交在所选时间的商品数据）。由于数据量较大，诊断明细模块的数据产出时间调整为下午1点前</div>
          <div className="p-5 flex items-center gap-3 flex-wrap"><select value={cat} onChange={e => setCat(e.target.value)} className="input-qn w-48"><option value="">请选择类目</option>{roots.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select><select className="input-qn w-36"><option>选择颗粒度</option><option>一级类目</option><option>叶子类目</option></select><div className="ml-auto"><RangeTabs value="近30天" onChange={() => { /* static */ }} items={['近7天', '近15天', '近30天', '日', '周', '月', '自定义']} /></div></div>
          <div className="px-5 flex items-center gap-4 text-sm">{['品类概览', '品类诊断', '品类明细'].map(t => <button key={t} onClick={() => setTab(t)} className={cls(tab === t ? 'text-brand-500 font-medium' : 'text-ink-600')}>{t}</button>)}</div>
          <div className="p-5">
            {!cat && sub === 'cat' ? <div className="py-10 text-center text-sm text-ink-500">暂无品类数据<div className="text-xs text-ink-400 mt-1">请先选择类目</div></div>
              : tab === '品类诊断' ? <div className="grid grid-cols-3 max-md:!grid-cols-1 gap-4">{['商品点击效果分析', '成交转化分析', '退款分析'].map((t, i) => <div key={t} className="rounded-lg bg-ink-50 p-4"><div className="font-medium text-sm">{t}</div><Donut data={[{ name: '优秀', value: 40 + i * 10 }, { name: '良好', value: 35 - i * 5 }, { name: '待优化', value: 25 - i * 5 }]} height={160} /></div>)}</div>
              : <div className="overflow-x-auto"><table className="text-sm min-w-[2600px]"><thead><tr className="text-left text-ink-600 border-b border-ink-100"><th className="py-2 sticky left-0 bg-white font-medium">{sub === 'cat' ? '品类名称' : '商品'}</th>{metricsCols.map(c => <th key={c} className="px-2 font-medium whitespace-nowrap">{c}</th>)}<th className="px-2 font-medium">行动点</th></tr></thead><tbody>{(sub === 'cat' ? roots.filter(c => !cat || c.id === cat).map(c => ({ key: c.id, label: c.name, ps: mine.filter(p => p.categoryId.startsWith(c.id)) })) : mine.map(p => ({ key: p.id, label: p.title, ps: [p] }))).filter(r => r.ps.length).map(r => { const n = r.ps.length; const exp = n * 1200; const clk = Math.round(exp * 0.18); const buyers = Math.round(clk * 0.07); const gmv = r.ps.reduce((a, p) => a + p.price, 0) * buyers / n; return <tr key={r.key} className="border-b border-ink-50"><td className="py-2.5 sticky left-0 bg-white"><span className="truncate block max-w-[220px]">{r.label}</span></td>{[n, compact(Math.round(exp * 0.8)), compact(exp), compact(Math.round(clk * 0.8)), compact(clk), '100%', '18.0%', buyers, buyers, Math.round(buyers * 1.2), money(gmv), '7.0%', money(buyers ? gmv / buyers : 0), money(buyers ? gmv / buyers : 0), money(buyers ? gmv / buyers / 1.2 : 0), '100%', '良好', Math.round(buyers * 0.06), Math.round(buyers * 0.07), Math.round(buyers * 0.06), money(gmv * 0.06), '6%', '6%', '6%'].map((v, i) => <td key={i} className="px-2 font-num whitespace-nowrap">{v}</td>)}<td className="px-2"><Link to="/seller/live/goods" className="link text-xs whitespace-nowrap">优化货盘</Link></td></tr> })}</tbody></table>{!mine.length && <div className="py-8 text-center text-sm text-ink-500">暂无数据</div>}</div>}
          </div>
        </> : <div className="p-5 grid grid-cols-2 max-md:!grid-cols-1 gap-4">{[['行业选品洞察', '基于直播成交用户洞察全淘系品类偏好，支持分析一级到叶子类目趋势变化和选品，挖掘机会类目及商品！', roots.slice(0, 5).map((c, i) => ({ name: c.name, 热度: 90 - i * 12 }))], ['人群选品洞察', '支持洞察主播通用人群近7天全淘系需求偏好，支持按类目-品牌-商品进行级联分析和选品，提升人群交易渗透！', [{ name: '新锐白领', 热度: 82 }, { name: '精致妈妈', 热度: 74 }, { name: 'Z世代', 热度: 66 }, { name: '小镇青年', 热度: 51 }, { name: '资深中产', 热度: 47 }]]].map(([t, d, data]) => <div key={t as string} className="rounded-lg border border-ink-100 p-4"><div className="font-medium">{t as string}</div><div className="text-xs text-ink-500 mt-1">{d as string}</div><Bars data={data as Record<string, unknown>[]} keys={['热度']} height={200} /></div>)}</div>}
      </div>
    </div>
  )
}

const SIMPLE: Record<string, { title: string; desc: string; metrics: [string, string][]; tip: string }> = {
  war: { title: '活动作战室', desc: '大促活动期间的实时作战看板', metrics: [['活动成交金额', 'gmv'], ['活动观看人数', 'views'], ['活动新增粉丝', 'fans'], ['活动订单数', 'buyers']], tip: '报名活动后，活动期间的实时数据将在此汇总。' },
  crowd: { title: '人群分析', desc: '直播间观众人群画像与六大人群分布', metrics: [['观看人数', 'views'], ['新客占比', '61%'], ['女性占比', '68%'], ['25-34岁占比', '46%']], tip: '结合人群画像在「直播推广」中定向投放，提升访购率。' },
  coupon: { title: '我的流量券', desc: '全面掌握流量券获取及消耗情况', metrics: [['可用流量券（PV）', '1200'], ['累计获得（PV）', '3600'], ['累计消耗（PV）', '2400'], ['本月到期（PV）', '400']], tip: '流量券在开播时自动消耗，用于直播广场与推荐信息流曝光。' },
  marketing: { title: '营销分析', desc: '直播互动与营销工具的效果分析', metrics: [['营销工具成交金额', 'gmv'], ['秒杀参与人数', 'clicks'], ['红包领取人数', 'fans'], ['券核销率', '34%']], tip: '限时秒杀与主播专属券在中控台一键发放，效果将在此统计。' },
  agent: { title: '代播分析', desc: '合作代播机构与主播的效果数据', metrics: [['代播场次', '0'], ['代播成交金额', '0.00'], ['代播观看人数', '0'], ['代播新增粉丝', '0']], tip: '暂无代播合作，可在服务市场寻找代播机构。' },
  outside: { title: '站外引流', desc: '站外渠道（微信 / 微博 / 抖音等）引流到直播间的效果', metrics: [['站外访问人数', 'views'], ['站外成交金额', 'gmv'], ['分享回流占比', '4%'], ['短链点击', 'clicks']], tip: '在「直播推广 → 站外引流」生成带参数的短链，投放后数据在此归因。' },
}
export function DataSimple() {
  const { kind = 'war' } = useParams()
  const def = SIMPLE[kind] ?? SIMPLE.war
  const m = useLiveMetrics(30)
  const val = (k: string) => k === 'gmv' ? money(m.gmv) : k === 'views' ? compact(m.views) : k === 'fans' ? compact(m.fans) : k === 'buyers' ? compact(m.buyers) : k === 'clicks' ? compact(m.clicks) : k
  return (
    <div className="max-w-[1260px] space-y-4">
      <Head title={def.title} />
      <div className="text-sm text-ink-600">{def.desc}</div>
      <div className="grid grid-cols-4 max-md:!grid-cols-2 gap-3">{def.metrics.map(([l, k]) => <div key={l} className="card"><Metric label={l} value={val(k)} sub="近30日 · 环比 +5%" /></div>)}</div>
      <Panel title="趋势"><TrendArea data={days(14, i => ({ 数值: Math.round((m.views || 1000) / 14 * (0.5 + Math.abs(Math.sin(i * 0.8)))) }))} keys={['数值']} height={240} /></Panel>
      <div className="rounded-lg bg-ink-50 p-4 text-sm text-ink-600">💡 {def.tip}</div>
    </div>
  )
}

export function Funds() {
  const m = useLiveMetrics(90)
  const lives = useMyLives().filter(l => l.status === 'ended')
  const fee = 0.05
  return (
    <div className="max-w-[1260px] space-y-4">
      <div className="flex items-center justify-between"><h1 className="text-xl font-semibold flex items-center gap-2"><Wallet className="w-5 h-5" />资金</h1><Link to="/seller/finance" className="link text-sm">前往财务总览 ›</Link></div>
      <div className="grid grid-cols-4 max-md:!grid-cols-2 gap-3">{[['直播成交总额', `¥${money(m.gmv)}`], ['直播技术服务费', `¥${money(m.gmv * fee)}`], ['预计可结算', `¥${money(m.gmv * (1 - fee) * 0.9)}`], ['已结算', `¥${money(m.gmv * (1 - fee) * 0.6)}`]].map(([l, v]) => <div key={l} className="card"><Metric label={l} value={v} /></div>)}</div>
      <Panel title="场次结算明细"><table className="w-full text-sm"><thead><tr className="text-left text-ink-600 border-b border-ink-100"><th className="py-2 font-medium">场次</th><th className="font-medium">开播时间</th><th className="font-medium">成交金额</th><th className="font-medium">服务费 (5%)</th><th className="font-medium">结算金额</th><th className="font-medium">状态</th></tr></thead><tbody>{lives.map(l => <tr key={l.id} className="border-b border-ink-50"><td className="py-2.5">{l.title}</td><td className="text-xs font-num">{fmtDate(l.startedAt)}</td><td className="font-num">¥{money(l.stats.gmv)}</td><td className="font-num">¥{money(l.stats.gmv * fee)}</td><td className="font-num price">¥{money(l.stats.gmv * (1 - fee))}</td><td><span className={Date.now() - new Date(l.endedAt!).getTime() > 7 * 864e5 ? 'tag-green' : 'tag-gold'}>{Date.now() - new Date(l.endedAt!).getTime() > 7 * 864e5 ? '已结算' : '结算中'}</span></td></tr>)}{!lives.length && <tr><td colSpan={6}><Empty text="暂无已结束的场次" /></td></tr>}</tbody></table></Panel>
    </div>
  )
}
