import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, ChevronRight, Search } from 'lucide-react'
import { useDB } from '@/store/db'
import { useCurrentShop } from '@/lib/hooks'
import { Img, Tabs, Empty } from '@/components/ui'
import { useMyLives, Panel, RangeTabs, Metric } from './common'
import { cls, fmtDate, money, compact } from '@/lib/format'
import { toast } from '@/store/session'

export function GoodsManage() {
  const shop = useCurrentShop()
  const lives = useMyLives()
  const { products, setLiveProducts } = useDB()
  const [tab, setTab] = useState<'channel' | 'plan' | 'group'>('channel')
  const [q, setQ] = useState('')
  const [type, setType] = useState('all')
  const [status, setStatus] = useState('all')
  const [signed, setSigned] = useState(false)
  const target = lives.find(l => l.status === 'live') ?? lives.filter(l => l.status === 'scheduled').sort((a, b) => a.plannedAt.localeCompare(b.plannedAt))[0]
  const mine = useMemo(() => products.filter(p => p.shopId === shop.id && (!q || p.title.includes(q) || p.id.includes(q)) && (status === 'all' || (status === 'on' ? p.status === 'on' : p.status !== 'on')) && (type === 'all' || (type === 'live' ? !!target?.productIds.includes(p.id) : !target?.productIds.includes(p.id)))), [products, shop.id, q, status, type, target])
  const [prices, setPrices] = useState<Record<string, string>>({})
  const toggle = (pid: string) => { if (!target) return toast('请先在直播计划中创建一场直播', 'error'); const ids = target.productIds.includes(pid) ? target.productIds.filter(x => x !== pid) : [...target.productIds, pid]; setLiveProducts(target.id, ids); toast(target.productIds.includes(pid) ? '已移出货盘' : '已加入货盘') }
  const savePrice = (pid: string) => { if (!target) return; const v = Number(prices[pid]); const p = products.find(x => x.id === pid)!; if (!v || v <= 0 || v >= p.price) return toast('直播专享价需低于原价', 'error'); setLiveProducts(target.id, target.productIds.includes(pid) ? target.productIds : [...target.productIds, pid], { ...target.livePrices, [pid]: v }); toast('直播专享价已保存') }
  const groups = [['默认分组', mine.length], ['福利款', Math.min(3, mine.length)], ['主推款', Math.min(5, mine.length)], ['清仓款', Math.min(2, mine.length)]] as const
  return (
    <div className="max-w-[1260px]">
      <div className="bg-white -mx-3 md:-mx-6 -mt-3 md:-mt-6 px-3 md:px-6 border-b border-ink-200"><Tabs accent="brand" items={[{ key: 'channel', label: '渠道品管理' }, { key: 'plan', label: '商品规划' }, { key: 'group', label: '分组设置' }]} value={tab} onChange={setTab} /></div>
      {tab === 'channel' && (
        <div className="mt-5">
          <h1 className="text-xl font-semibold">渠道商品</h1>
          <div className="card mt-4 p-4">
            {!signed && <div className="flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-100 text-amber-800 text-sm px-4 py-2.5"><AlertTriangle className="w-4 h-4 shrink-0" />尊敬的商家，您的直播渠道商品跟价协议未签约，请前往签约，避免出现价格过高后商品被清退或下架风险。<button onClick={() => { setSigned(true); toast('签约成功') }} className="ml-auto text-brand-500 flex items-center whitespace-nowrap">去签约<ChevronRight className="w-4 h-4" /></button></div>}
            {target && <div className="mt-3 text-xs text-ink-500">当前货盘：<span className="text-ink-900 font-medium">{target.title}</span>（{target.status === 'live' ? '直播中' : `计划 ${fmtDate(target.plannedAt)}`}）· 已选 {target.productIds.length} 件 <Link to="/seller/live/plan" className="link ml-2">切换场次</Link></div>}
            <div className="mt-3 flex items-center gap-2 flex-wrap">
              <div className="flex items-center rounded-md bg-ink-50 h-9 px-3 gap-2 text-sm"><span className="text-ink-700">商品ID</span><input value={q} onChange={e => setQ(e.target.value)} placeholder="请输入对应内容" className="bg-transparent outline-none w-36" /><Search className="w-4 h-4 text-ink-400" /></div>
              <select value={type} onChange={e => setType(e.target.value)} className="input-qn w-40 bg-ink-50 border-transparent"><option value="all">商品类型 全部</option><option value="live">已在货盘</option><option value="other">未加入货盘</option></select>
              <select value={status} onChange={e => setStatus(e.target.value)} className="input-qn w-40 bg-ink-50 border-transparent"><option value="all">商品状态 全部</option><option value="on">出售中</option><option value="off">仓库中</option></select>
              <button onClick={() => { if (target) { setLiveProducts(target.id, mine.filter(p => p.status === 'on').map(p => p.id)); toast('已批量加入货盘') } }} className="ml-auto text-sm text-ink-600 hover:text-brand-500">☑ 批量选择</button>
            </div>
            <table className="w-full mt-4 text-sm">
              <thead><tr className="text-left text-ink-600 border-b border-ink-100"><th className="py-2.5 font-medium">商品信息</th><th className="font-medium">店铺名称</th><th className="font-medium">商品类型</th><th className="font-medium">原价</th><th className="font-medium">直播专享价</th><th className="font-medium">sku详情</th><th className="font-medium">库存类型</th><th className="font-medium">商品状态</th><th className="font-medium">操作</th></tr></thead>
              <tbody>{mine.length ? mine.map(p => { const inLive = !!target?.productIds.includes(p.id); const lp = target?.livePrices[p.id]; return (
                <tr key={p.id} className="border-b border-ink-50">
                  <td className="py-3 pr-3"><div className="flex items-center gap-2"><Img src={p.images[0]} alt="" w={80} h={80} className="w-12 h-12 rounded-md object-cover" /><div className="min-w-0"><div className="truncate max-w-[220px]">{p.title}</div><div className="text-xs text-ink-400">ID {p.id}</div></div></div></td>
                  <td>{shop.name}</td><td>{inLive ? <span className="tag-red">货盘商品</span> : <span className="tag-gray">店铺商品</span>}</td><td className="font-num">¥{money(p.price)}</td>
                  <td><div className="flex items-center gap-1"><input value={prices[p.id] ?? (lp ?? '')} onChange={e => setPrices({ ...prices, [p.id]: e.target.value })} placeholder="未设置" className="input-qn w-20 h-8 text-xs" /><button onClick={() => savePrice(p.id)} className="btn-ghost btn-sm h-8 text-brand-500">保存</button></div></td>
                  <td className="text-xs text-ink-500">{p.skus.length} 个SKU</td><td className="text-xs">{p.stock > 0 ? '现货' : '无货'}</td><td>{p.status === 'on' ? <span className="tag-green">出售中</span> : <span className="tag-gray">仓库中</span>}</td>
                  <td><button onClick={() => toggle(p.id)} className={cls('btn-sm h-8', inLive ? 'btn-ghost text-ink-500' : 'btn-primary')}>{inLive ? '移出货盘' : '加入货盘'}</button></td>
                </tr>) }) : <tr><td colSpan={9}><Empty text="暂无数据" /></td></tr>}</tbody>
            </table>
          </div>
        </div>
      )}
      {tab === 'plan' && (
        <div className="mt-5 grid grid-cols-[1fr_320px] lg-stack gap-4">
          <Panel title="商品规划" extra={<span className="text-xs text-ink-500">按直播节奏安排讲解顺序与福利款</span>}>
            {target ? <ol className="space-y-2">{target.productIds.map((pid, i) => { const p = products.find(x => x.id === pid); if (!p) return null; return <li key={pid} className="flex items-center gap-3 rounded-lg border border-ink-100 p-2.5"><span className="w-6 h-6 rounded bg-ink-900 text-white text-xs flex items-center justify-center font-num">{i + 1}</span><Img src={p.images[0]} alt="" w={80} h={80} className="w-10 h-10 rounded object-cover" /><div className="flex-1 min-w-0"><div className="truncate text-sm">{p.title}</div><div className="text-xs text-ink-500">原价 ¥{money(p.price)}{target.livePrices[pid] ? ` · 直播价 ¥${money(target.livePrices[pid])}` : ''}</div></div><span className={cls('tag', i === 0 ? 'bg-amber-100 text-amber-700' : i < 3 ? 'bg-brand-50 text-brand-600' : 'bg-ink-100 text-ink-600')}>{i === 0 ? '开播福利' : i < 3 ? '主推' : '常规'}</span><button onClick={() => { const ids = [...target.productIds]; if (i > 0) { [ids[i - 1], ids[i]] = [ids[i], ids[i - 1]]; setLiveProducts(target.id, ids) } }} className="btn-ghost btn-sm">上移</button></li> })}</ol> : <Empty text="暂无直播场次" />}
          </Panel>
          <Panel title="规划建议"><ul className="text-sm text-ink-700 space-y-2 list-disc pl-4"><li>开播前 10 分钟用 1 号福利款聚人气</li><li>每 15 分钟讲解一款主推，配合限时秒杀</li><li>货盘 6～12 款为宜，超过 20 款观众易流失</li><li>直播专享价建议低于原价 10%～30%</li></ul></Panel>
        </div>
      )}
      {tab === 'group' && (
        <Panel className="mt-5" title="分组设置" extra={<button onClick={() => toast('演示环境：分组已保存')} className="btn-primary btn-sm">新建分组</button>}>
          <div className="grid grid-cols-4 gap-3">{groups.map(([g, n]) => <div key={g} className="rounded-lg border border-ink-100 p-4"><div className="font-medium">{g}</div><div className="text-xs text-ink-500 mt-1">{n} 件商品</div><div className="mt-3 flex gap-2"><button onClick={() => toast('演示环境：分组已保存')} className="btn-outline btn-sm">编辑</button><button onClick={() => toast('演示环境：分组已删除')} className="btn-ghost btn-sm">删除</button></div></div>)}</div>
        </Panel>
      )}
    </div>
  )
}

export function Keypoint() {
  const lives = useMyLives()
  const products = useDB(s => s.products)
  const [range, setRange] = useState('近7天')
  const [tab, setTab] = useState<'session' | 'goods'>('session')
  const [q, setQ] = useState('')
  const days = range === '昨天' ? 1 : range === '近7天' ? 7 : range === '近15天' ? 15 : 30
  const since = Date.now() - days * 864e5
  const kps = useMemo(() => lives.flatMap(l => l.keypoints.map(k => ({ ...k, live: l, p: products.find(p => p.id === k.productId) }))).filter(k => k.p && new Date(k.start).getTime() > since && (!q || k.p!.title.includes(q) || k.productId.includes(q))).sort((a, b) => b.start.localeCompare(a.start)), [lives, products, since, q])
  const total = { views: lives.filter(l => new Date(l.startedAt ?? l.plannedAt).getTime() > since).reduce((a, l) => a + l.stats.views, 0), clicks: kps.reduce((a, k) => a + k.clicks, 0), gmv: kps.reduce((a, k) => a + k.orders * (k.p!.price * 0.9), 0), n: kps.length }
  const myProducts = products.filter(p => lives.some(l => l.productIds.includes(p.id)))
  const explained = new Set(kps.map(k => k.productId))
  return (
    <div className="max-w-[1260px]">
      <h1 className="text-xl font-semibold">讲解管理</h1>
      <div className="mt-4 rounded-lg bg-white border border-ink-100 px-4 py-2.5 text-sm flex items-center gap-3"><span className="text-ink-500">🔔 公告</span><span className="font-medium">【NEW】再次讲解支持最多30分钟</span><span className="text-ink-400 hidden md:inline">· 宝贝口袋支持投放指定讲解 · 店铺直播新增未讲解商品管理</span></div>
      <div className="mt-5 flex items-center justify-between flex-wrap gap-2"><div><span className="font-semibold">讲解收益</span><span className="text-xs text-ink-500 ml-2">讲解近期给主播带来的收益总览</span></div><RangeTabs value={range} onChange={setRange} /></div>
      <div className="card mt-3 grid grid-cols-6 max-md:!grid-cols-2 divide-x divide-ink-100">
        <Metric label="观看次数" value={compact(total.views)} sub={`较前${days}天 持平`} help /><Metric label="商品点击次数" value={compact(total.clicks)} sub={`较前${days}天 持平`} help /><Metric label="引导成交金额（元）" value={money(total.gmv, 0)} sub={`较前${days}天 持平`} help /><Metric label="新增讲解数" value={total.n} sub={`较前${days}天 持平`} help /><Metric label="讲解率" value={myProducts.length ? `${Math.round(explained.size / myProducts.length * 100)}%` : '0'} sub={`较前${days}天 持平`} help /><Metric label="全店商品讲解率" value={`${(explained.size / Math.max(1, products.filter(p => p.shopId === lives[0]?.shopId).length) * 100).toFixed(2)}%`} sub={<span>较前{days}天 -0% <Link to="/seller/live/data/commodity" className="link">查看详情</Link></span>} help />
      </div>
      <div className="mt-5 flex items-center justify-between flex-wrap gap-2"><Tabs accent="brand" items={[{ key: 'session', label: '管理场次' }, { key: 'goods', label: '管理商品' }]} value={tab} onChange={setTab} /><div className="flex items-center gap-2">{['设 置', '内容标准', '投放规则', '讲解推广'].map(b => <button key={b} onClick={() => toast('演示环境')} className="btn-outline btn-sm h-8">{b}</button>)}</div></div>
      <div className="card mt-3 p-4">
        <div className="grid grid-cols-4 max-md:!grid-cols-1 gap-3">
          <select className="input-qn bg-ink-50 border-transparent"><option>看点类型</option><option>商品讲解</option><option>福利讲解</option></select>
          <div className="relative"><input placeholder="输入直播ID" className="input-qn bg-ink-50 border-transparent pr-8" /><Search className="w-4 h-4 text-ink-400 absolute right-3 top-1/2 -translate-y-1/2" /></div>
          <select className="input-qn bg-ink-50 border-transparent"><option>审核状态</option><option>已通过</option><option>审核中</option></select>
          <select className="input-qn bg-ink-50 border-transparent"><option>权益商品</option><option>全部</option></select>
          <div className="relative"><input value={q} onChange={e => setQ(e.target.value)} placeholder="输入商品ID或标题" className="input-qn bg-ink-50 border-transparent pr-8" /><Search className="w-4 h-4 text-ink-400 absolute right-3 top-1/2 -translate-y-1/2" /></div>
          <button onClick={() => setQ('')} className="text-sm text-brand-500 text-left">清空</button>
        </div>
        {tab === 'session' ? (kps.length ? <table className="w-full mt-4 text-sm"><thead><tr className="text-left text-ink-600 border-b border-ink-100"><th className="py-2.5 font-medium">讲解商品</th><th className="font-medium">所属场次</th><th className="font-medium">讲解时间</th><th className="font-medium">时长</th><th className="font-medium">点击</th><th className="font-medium">引导订单</th><th className="font-medium">审核</th><th className="font-medium">操作</th></tr></thead><tbody>{kps.map((k, i) => <tr key={i} className="border-b border-ink-50"><td className="py-3"><div className="flex items-center gap-2"><Img src={k.p!.images[0]} alt="" w={80} h={80} className="w-10 h-10 rounded object-cover" /><span className="truncate max-w-[220px]">{k.p!.title}</span></div></td><td className="text-xs">{k.live.title}</td><td className="text-xs font-num">{fmtDate(k.start)}</td><td className="font-num">{k.end ? Math.max(1, Math.round((new Date(k.end).getTime() - new Date(k.start).getTime()) / 60000)) : '-'} 分钟</td><td className="font-num">{k.clicks}</td><td className="font-num">{k.orders}</td><td><span className="tag-green">已通过</span></td><td><Link to={`/live/${k.live.id}`} className="link text-xs">查看</Link></td></tr>)}</tbody></table> : <div className="py-10"><Empty text="暂无讲解内容" /></div>)
          : <table className="w-full mt-4 text-sm"><thead><tr className="text-left text-ink-600 border-b border-ink-100"><th className="py-2.5 font-medium">商品</th><th className="font-medium">价格</th><th className="font-medium">讲解次数</th><th className="font-medium">最近讲解</th><th className="font-medium">状态</th></tr></thead><tbody>{myProducts.filter(p => !q || p.title.includes(q)).map(p => { const ks = kps.filter(k => k.productId === p.id); return <tr key={p.id} className="border-b border-ink-50"><td className="py-3"><div className="flex items-center gap-2"><Img src={p.images[0]} alt="" w={80} h={80} className="w-10 h-10 rounded object-cover" /><span className="truncate max-w-[260px]">{p.title}</span></div></td><td className="font-num">¥{money(p.price)}</td><td className="font-num">{ks.length}</td><td className="text-xs">{ks[0] ? fmtDate(ks[0].start) : '-'}</td><td>{ks.length ? <span className="tag-green">已讲解</span> : <span className="tag-gold">未讲解</span>}</td></tr> })}</tbody></table>}
      </div>
    </div>
  )
}
