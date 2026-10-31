// 万相台 · 关键词推广（参照 one.alimama.com manage/search）：按点击扣费，排名 = 出价 × 质量分，GSP 第二价格扣费
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Search, Trash2, Info, TrendingUp, Wallet, Sparkles, X, Check } from 'lucide-react'
import { useDB } from '@/store/db'
import { useCurrentShop } from '@/lib/hooks'
import { Img, Modal } from '@/components/ui'
import { TrendLine } from '@/components/Charts'
import { cls, fmtDate, money } from '@/lib/format'
import { toast } from '@/store/session'
import { adAuction, adBid, adMatch, adQuality, adSuggestBid, AD_RESERVE } from '@/data/reducers'
import type { AdKeyword, AdPlan, Product } from '@/data/types'

const BLUE = '#4b5cff'
/** 按日数据的键（UTC 日期，与 Worker 一致） */
const ymd = (d: Date) => d.toISOString().slice(0, 10)
/** 本地日期，用于表单与展示 */
const localYmd = (d: Date) => fmtDate(d.toISOString(), false)
const rangeDays = (r: string): string[] => { const n = r === 'today' ? 1 : r === 'yesterday' ? 1 : r === '7' ? 7 : 15; const off = r === 'yesterday' ? 1 : 0; return Array.from({ length: n }, (_, i) => ymd(new Date(Date.now() - (i + off) * 864e5))) }
type Sum = { imp: number; clk: number; cost: number; ord: number; gmv: number }
const sumOf = (plans: AdPlan[], ds: string[]): Sum => plans.reduce((a, p) => { ds.forEach(d => { const x = p.daily[d]; if (x) { a.imp += x[0]; a.clk += x[1]; a.cost += x[2]; a.ord += x[3]; a.gmv += x[4] } }); return a }, { imp: 0, clk: 0, cost: 0, ord: 0, gmv: 0 })
const pct = (a: number, b: number) => b ? `${((a / b) * 100).toFixed(2)}%` : '0.00%'
const GOALS: Record<AdPlan['goal'], string> = { orders: '获取成交量', clicks: '增加点击量', cart: '增加收藏加购' }

/** 从宝贝标题、类目、品牌、标签中提取推荐关键词 */
function recommendWords(ps: Product[], all: Product[], plans: AdPlan[]) {
  const set = new Map<string, number>()
  const add = (w: string) => { const t = w.trim(); if (t.length >= 2 && t.length <= 14 && !/^\d+$/.test(t)) set.set(t, (set.get(t) ?? 0) + 1) }
  // 词库：全站宝贝标签 + 类目名，标题中出现即作为候选
  const vocab = new Set(all.flatMap(x => [...x.tags, ...(x.pub?.catPath ?? [])]).filter(w => w.length >= 2))
  const titles = all.filter(x => x.status === 'on').map(x => x.title)
  for (const p of ps) {
    // 按分隔符、中英文边界切分
    p.title.split(/[\s,，、/|【】[\]()（）+]+/).flatMap(seg => seg.match(/[A-Za-z0-9.\-]+|[^A-Za-z0-9.\-]+/g) ?? []).forEach(add)
    p.tags.forEach(add)
    p.pub?.catPath.forEach(add)
    if (p.pub?.brand) add(p.pub.brand)
    vocab.forEach(w => { if (p.title.includes(w)) add(w) })
    // 中文长串：取在其他宝贝标题中也出现过的 2~4 字词（简易高频词提取）
    for (const run of p.title.match(/[一-龥]{4,}/g) ?? []) {
      for (let n = 4; n >= 2; n--) for (let i = 0; i + n <= run.length; i++) { const g = run.slice(i, i + n); if (titles.filter(t => t.includes(g)).length >= 2) add(g) }
    }
  }
  return [...set.keys()].slice(0, 30).map(word => {
    const hits = all.filter(x => x.status === 'on' && x.title.toLowerCase().includes(word.toLowerCase())).length
    const comp = plans.filter(p => p.status === 'on' && p.keywords.some(k => adMatch(k, word))).length
    return { word, heat: hits * 137 + word.length * 41 + 80, comp, bid: adSuggestBid(plans, word), rel: ps.some(p => p.title.includes(word)) ? 5 : 4 }
  }).sort((a, b) => b.heat - a.heat)
}

export function KeywordAds() {
  const shop = useCurrentShop()
  const { adPlans, products, users, shops, upsertAdPlan, removeAdPlans } = useDB()
  const owner = users.find(u => u.id === shop.ownerId)
  const mine = useMemo(() => adPlans.filter(p => p.shopId === shop.id), [adPlans, shop.id])
  const [range, setRange] = useState('today')
  const [view, setView] = useState<'plan' | 'unit' | 'word'>('plan')
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('')
  const [sel, setSel] = useState<string[]>([])
  const [edit, setEdit] = useState<AdPlan | 'new' | null>(null)
  const [rules, setRules] = useState(false)
  const [metric, setMetric] = useState<'展现量' | '点击量' | '花费'>('点击量')
  const ds = rangeDays(range)
  const cur = sumOf(mine, ds)
  const prev = sumOf(mine, ds.map(d => ymd(new Date(new Date(d).getTime() - ds.length * 864e5))))
  const metrics: [string, number, number, (v: number) => string][] = [
    ['展现量', cur.imp, prev.imp, v => String(v)], ['点击量', cur.clk, prev.clk, v => String(v)], ['花费(元)', cur.cost, prev.cost, v => money(v)],
    ['点击率', cur.imp ? cur.clk / cur.imp : 0, prev.imp ? prev.clk / prev.imp : 0, v => `${(v * 100).toFixed(2)}%`], ['平均点击花费(元)', cur.clk ? cur.cost / cur.clk : 0, prev.clk ? prev.cost / prev.clk : 0, v => money(v)],
    ['总成交金额(元)', cur.gmv, prev.gmv, v => money(v)], ['总成交笔数', cur.ord, prev.ord, v => String(v)], ['点击转化率', cur.clk ? cur.ord / cur.clk : 0, prev.clk ? prev.ord / prev.clk : 0, v => `${(v * 100).toFixed(2)}%`], ['投入产出比', cur.cost ? cur.gmv / cur.cost : 0, prev.cost ? prev.gmv / prev.cost : 0, v => v.toFixed(2)],
  ]
  const trend = Array.from({ length: 15 }, (_, i) => { const d = ymd(new Date(Date.now() - (14 - i) * 864e5)); const s = sumOf(mine, [d]); return { name: d.slice(5), 展现量: s.imp, 点击量: s.clk, 花费: +s.cost.toFixed(2) } })
  const list = mine.filter(p => (!q || p.name.includes(q)) && (!status || p.status === status))
  const words = mine.flatMap(p => p.keywords.map(k => ({ p, k })))
  const units = mine.flatMap(p => p.productIds.map(id => ({ p, prod: products.find(x => x.id === id) })).filter(x => x.prod))
  const state = { adPlans, products, shops, users }
  const rankOf = (word: string, pids: string[]) => { const r = adAuction(state, word, 10); const i = r.findIndex(x => pids.includes(x.productId)); return i < 0 ? null : { pos: i + 1, price: r[i].price } }
  const toggle = (p: AdPlan) => { if (p.status === 'paused' && (owner?.balance ?? 0) < AD_RESERVE) return toast('账户余额不足，请先充值', 'error'); upsertAdPlan({ ...p, status: p.status === 'on' ? 'paused' : 'on' }); toast(p.status === 'on' ? '计划已暂停' : '计划已启用') }
  const setBid = (p: AdPlan, word: string, bid: number) => upsertAdPlan({ ...p, keywords: p.keywords.map(k => k.word === word ? { ...k, bid: Math.max(AD_RESERVE, +bid.toFixed(2)) } : k) })
  return (
    <div className="space-y-4 -mt-1">
      <div className="rounded-2xl overflow-hidden bg-gradient-to-r from-[#ffe3ef] via-[#fdeaf5] to-[#f3e8ff] h-[72px] flex items-center px-8 gap-6"><span className="text-2xl font-black text-[#c2185b] tracking-wide">「智能出价」<span className="text-ink-900">按点击付费，</span><span className="text-[#c2185b]">出价×质量分</span><span className="text-ink-900">决定排名</span></span><button onClick={() => setEdit('new')} className="ml-auto h-9 px-5 rounded-full bg-white text-[#c2185b] font-medium shadow-card max-md:hidden">立即使用</button></div>
      <div className="card">
        <div className="px-6 h-16 flex items-center gap-3 border-b border-ink-100 flex-wrap"><span className="text-xl font-semibold">关键词推广</span><button onClick={() => setRules(true)} className="text-sm" style={{ color: BLUE }}>什么是「关键词推广」？</button><button onClick={() => setEdit('new')} className="h-8 px-3 rounded-full border border-ink-200 text-sm">+立即投放</button>
          <div className="ml-auto flex items-center gap-2 text-sm"><span className="text-xs text-ink-400 max-lg:hidden">统计口径为末次点击归因模型和15天累计周期</span>{[['today', '今日'], ['yesterday', '昨日'], ['7', '过去 7 天'], ['15', '过去 15 天']].map(([k, l]) => <button key={k} onClick={() => setRange(k)} className={cls('h-8 px-3 rounded-lg border', range === k ? 'border-[#4b5cff] text-[#4b5cff] bg-[#4b5cff]/5' : 'border-ink-200 text-ink-700')}>{l}</button>)}</div></div>
        <div className="px-6 py-4 flex items-center gap-3 text-sm flex-wrap"><span className="font-semibold text-base">数据汇总</span><span className="text-xs text-ink-400">计划管理页面数据仅供参考，历史推广数据以报表数据为准</span><span className="ml-auto flex items-center gap-2 rounded-lg bg-[#4b5cff]/5 px-3 h-8"><Wallet className="w-4 h-4" style={{ color: BLUE }} />推广账户余额 <b className="font-num">¥{money(owner?.balance ?? 0)}</b><Link to="/seller/finance" className="text-xs" style={{ color: BLUE }}>充值</Link></span></div>
        <div className="px-6 grid grid-cols-9 max-xl:!grid-cols-5 max-md:!grid-cols-2 border-y border-ink-100">{metrics.map(([l, v, pv, fmt], i) => { const diff = pv ? (v - pv) / pv : 0; return <button key={l} onClick={() => i < 3 && setMetric((['展现量', '点击量', '花费'] as const)[i])} className={cls('text-left px-3 py-4 border-r border-ink-100 last:border-r-0', i < 3 && metric === (['展现量', '点击量', '花费'] as const)[i] && 'bg-[#4b5cff]/5')}><div className="text-xs text-ink-500 flex items-center gap-1">{l}<span className="w-6 h-px" style={{ background: BLUE }} /></div><div className="mt-2 text-2xl font-num font-semibold">{fmt(v)}</div><div className="text-xs text-ink-400 mt-2">对比{range === 'today' ? '昨日' : '上期'} {pv ? <span className={diff >= 0 ? 'text-red-500' : 'text-emerald-600'}>{diff >= 0 ? '↑' : '↓'}{Math.abs(diff * 100).toFixed(1)}%</span> : '-'}</div></button> })}</div>
        <div className="px-6 py-4"><TrendLine data={trend} keys={[metric]} height={200} colors={[BLUE]} /></div>
      </div>
      <div className="card">
        <div className="px-6 pt-4 flex items-center gap-6 border-b border-ink-100">{([['plan', `计划（${mine.length}）`], ['unit', `单元（${units.length}）`], ['word', `关键词（${words.length}）`]] as const).map(([k, l]) => <button key={k} onClick={() => setView(k)} className={cls('pb-3 relative', view === k ? 'font-semibold' : 'text-ink-600')} style={view === k ? { color: BLUE } : undefined}>{l}{view === k && <span className="absolute left-0 right-0 bottom-0 h-0.5" style={{ background: BLUE }} />}</button>)}<button onClick={() => setRules(true)} className="ml-auto pb-3 text-sm flex items-center gap-1" style={{ color: BLUE }}><Info className="w-4 h-4" />竞价排名规则</button></div>
        <div className="px-6 py-3 flex items-center gap-3 flex-wrap text-sm">
          <button onClick={() => setEdit('new')} className="h-9 px-4 rounded-lg text-white flex items-center gap-1" style={{ background: BLUE }}><Plus className="w-4 h-4" />新建关键词推广</button>
          <button onClick={() => { if (!sel.length) return toast('请先勾选计划', 'error'); mine.filter(p => sel.includes(p.id)).forEach(p => upsertAdPlan({ ...p, status: 'on' })); toast('已启用') }} className="h-9 px-3 rounded-lg border border-ink-200">批量启用</button>
          <button onClick={() => { if (!sel.length) return toast('请先勾选计划', 'error'); mine.filter(p => sel.includes(p.id)).forEach(p => upsertAdPlan({ ...p, status: 'paused' })); toast('已暂停') }} className="h-9 px-3 rounded-lg border border-ink-200">批量暂停</button>
          <button onClick={() => { if (!sel.length) return toast('请先勾选计划', 'error'); if (!confirm(`确定删除 ${sel.length} 个计划？`)) return; removeAdPlans(sel); setSel([]); toast('已删除') }} className="h-9 px-3 rounded-lg border border-ink-200 flex items-center gap-1"><Trash2 className="w-4 h-4" />删除</button>
          <label className="ml-auto h-9 w-56 rounded-lg border border-ink-200 flex items-center px-2 gap-1"><Search className="w-4 h-4 text-ink-400" /><input aria-label="计划名称" className="flex-1 outline-none bg-transparent min-w-0" placeholder="计划名称" value={q} onChange={e => setQ(e.target.value)} /></label>
          <select aria-label="状态" className="h-9 rounded-lg border border-ink-200 px-2" value={status} onChange={e => setStatus(e.target.value)}><option value="">全部状态</option><option value="on">推广中</option><option value="paused">已暂停</option></select>
        </div>
        <div className="overflow-x-auto">
          {view === 'plan' && <table className="w-full text-sm min-w-[1300px]"><thead><tr className="bg-[#f6f7fb] text-ink-600 text-left text-xs"><th className="px-4 py-3 w-10"><input type="checkbox" aria-label="全选" checked={list.length > 0 && list.every(p => sel.includes(p.id))} onChange={e => setSel(e.target.checked ? list.map(p => p.id) : [])} /></th><th className="px-2 py-3 font-normal">状态</th><th className="px-2 py-3 font-normal">计划名称</th><th className="px-2 py-3 font-normal">预算</th><th className="px-2 py-3 font-normal">出价方式</th><th className="px-2 py-3 font-normal">投放日期</th>{['展现量', '点击量', '花费', '点击率', '平均点击花费', '总成交金额', '总成交笔数', '点击转化率', '投入产出比'].map(h => <th key={h} className="px-2 py-3 font-normal text-right">{h}</th>)}<th className="px-4 py-3 font-normal">操作</th></tr></thead>
            <tbody>{list.map(p => { const s = sumOf([p], ds); const today = p.daily[ymd(new Date())]?.[2] ?? 0; return <tr key={p.id} className="border-b border-ink-100 align-top">
              <td className="px-4 py-4"><input type="checkbox" aria-label="选择" checked={sel.includes(p.id)} onChange={e => setSel(e.target.checked ? [...sel, p.id] : sel.filter(x => x !== p.id))} /></td>
              <td className="px-2 py-4"><button role="switch" aria-checked={p.status === 'on'} aria-label="启停" onClick={() => toggle(p)} className={cls('w-9 h-5 rounded-full relative transition', p.status === 'on' ? '' : 'bg-ink-300')} style={p.status === 'on' ? { background: BLUE } : undefined}><span className={cls('absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all', p.status === 'on' ? 'left-[18px]' : 'left-0.5')} /></button><div className="text-xs text-ink-500 mt-1">{p.status === 'on' ? (today >= p.dailyBudget ? '预算用尽' : '推广中') : '已暂停'}</div></td>
              <td className="px-2 py-4 max-w-[240px]"><button onClick={() => setEdit(p)} className="hover:underline text-left" style={{ color: BLUE }}>{p.name}</button><div className="text-xs text-ink-400 mt-1">关键词 {p.keywords.length} 个 · 宝贝 {p.productIds.length} 个</div><div className="flex gap-1 mt-1.5">{p.productIds.slice(0, 4).map(id => { const pr = products.find(x => x.id === id); return pr ? <Img key={id} src={pr.images[0]} alt="" w={28} h={28} className="w-7 h-7 rounded" /> : null })}</div></td>
              <td className="px-2 py-4 whitespace-nowrap"><div className="font-num">{p.dailyBudget}元</div><div className="text-xs text-ink-400">日预算 · 今日已用 {money(today)}</div></td>
              <td className="px-2 py-4 whitespace-nowrap">{p.bidMode === 'smart' ? <><div>智能出价</div><div className="text-xs text-ink-400">{GOALS[p.goal]}</div></> : <><div>手动出价</div><div className="text-xs text-ink-400">均价 ¥{money(p.keywords.reduce((a, k) => a + k.bid, 0) / Math.max(1, p.keywords.length))}</div></>}</td>
              <td className="px-2 py-4 text-xs whitespace-nowrap font-num">起：{fmtDate(p.startAt, false)}<br />止：{fmtDate(p.endAt, false)}</td>
              {[s.imp, s.clk, money(s.cost), pct(s.clk, s.imp), money(s.clk ? s.cost / s.clk : 0), money(s.gmv), s.ord, pct(s.ord, s.clk), s.cost ? (s.gmv / s.cost).toFixed(2) : '-'].map((v, i) => <td key={i} className="px-2 py-4 text-right font-num">{v}</td>)}
              <td className="px-4 py-4 whitespace-nowrap text-xs"><div className="flex flex-col gap-1" style={{ color: BLUE }}><button onClick={() => setEdit(p)} className="text-left">编辑</button><button onClick={() => { setView('word'); setQ(p.name) }} className="text-left">关键词</button><button onClick={() => { const b = prompt('修改日预算（元）', String(p.dailyBudget)); if (b && Number(b) >= 30) { upsertAdPlan({ ...p, dailyBudget: Number(b), status: 'on' }); toast('预算已更新') } else if (b) toast('日预算不低于 30 元', 'error') }} className="text-left">续投预算</button></div></td>
            </tr> })}</tbody></table>}
          {view === 'unit' && <table className="w-full text-sm min-w-[900px]"><thead><tr className="bg-[#f6f7fb] text-ink-600 text-left text-xs"><th className="px-4 py-3 font-normal">宝贝</th><th className="px-2 py-3 font-normal">所属计划</th><th className="px-2 py-3 font-normal">状态</th><th className="px-2 py-3 font-normal">价格</th><th className="px-2 py-3 font-normal">销量</th><th className="px-2 py-3 font-normal">平均质量分</th></tr></thead><tbody>{units.filter(u => !q || u.p.name.includes(q)).map(({ p, prod }) => <tr key={p.id + prod!.id} className="border-b border-ink-100"><td className="px-4 py-3"><div className="flex items-center gap-2"><Img src={prod!.images[0]} alt="" w={40} h={40} className="w-10 h-10 rounded" /><Link to={`/item/${prod!.id}`} target="_blank" className="line-clamp-1 max-w-[360px] hover:underline" style={{ color: BLUE }}>{prod!.title}</Link></div></td><td className="px-2 py-3">{p.name}</td><td className="px-2 py-3">{p.status === 'on' ? '推广中' : '已暂停'}</td><td className="px-2 py-3 font-num">¥{money(prod!.price)}</td><td className="px-2 py-3 font-num">{prod!.sales}</td><td className="px-2 py-3"><QualityBar v={p.keywords.length ? p.keywords.reduce((a, k) => a + adQuality(p, prod!, k.word), 0) / p.keywords.length : 0} /></td></tr>)}</tbody></table>}
          {view === 'word' && <table className="w-full text-sm min-w-[1000px]"><thead><tr className="bg-[#f6f7fb] text-ink-600 text-left text-xs"><th className="px-4 py-3 font-normal">关键词</th><th className="px-2 py-3 font-normal">所属计划</th><th className="px-2 py-3 font-normal">匹配方式</th><th className="px-2 py-3 font-normal">出价（元）</th><th className="px-2 py-3 font-normal">质量分</th><th className="px-2 py-3 font-normal">综合得分</th><th className="px-2 py-3 font-normal">当前排名</th><th className="px-2 py-3 font-normal">预估扣费</th><th className="px-2 py-3 font-normal">建议出价</th></tr></thead><tbody>{words.filter(w => !q || w.p.name.includes(q) || w.k.word.includes(q)).map(({ p, k }) => { const prods = p.productIds.map(id => products.find(x => x.id === id)).filter(Boolean) as Product[]; const qs = prods.length ? Math.max(...prods.map(pr => adQuality(p, pr, k.word))) : 0; const bid = adBid(p, k.word); const r = p.status === 'on' ? rankOf(k.word, p.productIds) : null; return <tr key={p.id + k.word} className="border-b border-ink-100"><td className="px-4 py-3 font-medium">{k.word}</td><td className="px-2 py-3 text-ink-600">{p.name}</td><td className="px-2 py-3">{k.match === 'exact' ? '精准匹配' : '广泛匹配'}</td><td className="px-2 py-3">{p.bidMode === 'manual' ? <input aria-label={`${k.word} 出价`} type="number" step="0.01" min={AD_RESERVE} className="w-20 h-8 rounded border border-ink-200 px-2 font-num" defaultValue={k.bid} onBlur={e => { const v = Number(e.target.value); if (v && v !== k.bid) { setBid(p, k.word, v); toast('出价已更新') } }} /> : <span className="font-num">{money(bid)} <span className="text-xs text-ink-400">智能</span></span>}</td><td className="px-2 py-3"><QualityBar v={qs} /></td><td className="px-2 py-3 font-num">{(bid * qs).toFixed(2)}</td><td className="px-2 py-3">{p.status !== 'on' ? <span className="text-ink-400">已暂停</span> : r ? <span className={r.pos <= 4 ? 'text-emerald-600' : 'text-amber-600'}>第 {r.pos} 位{r.pos > 4 && '（未进广告位）'}</span> : <span className="text-ink-400">未参与</span>}</td><td className="px-2 py-3 font-num">{r ? `¥${money(r.price)}` : '-'}</td><td className="px-2 py-3 font-num">¥{money(adSuggestBid(adPlans, k.word))}</td></tr> })}</tbody></table>}
          {((view === 'plan' && list.length === 0) || (view === 'unit' && units.length === 0) || (view === 'word' && words.length === 0)) && <div className="py-16 text-center text-ink-400 text-sm"><TrendingUp className="w-10 h-10 mx-auto mb-2 text-ink-300" />暂无推广计划，<button onClick={() => setEdit('new')} style={{ color: BLUE }}>新建关键词推广</button>，让买家搜索时优先看到你的宝贝</div>}
        </div>
        <div className="px-6 py-3 text-sm text-ink-500 flex items-center justify-end">共 {view === 'plan' ? list.length : view === 'unit' ? units.length : words.length} 项数据</div>
      </div>
      {edit && <PlanEditor plan={edit === 'new' ? null : edit} onClose={() => setEdit(null)} />}
      <Modal open={rules} onClose={() => setRules(false)} title="关键词推广 · 竞价排名规则" width={620}><div className="space-y-3 text-sm leading-6 text-ink-700">
        <p>买家在 Plam 搜索时，命中您所购买关键词的宝贝会进入<b>搜索结果顶部广告位（共 4 个，带「广告」标识）</b>。展现免费，<b>按点击扣费</b>，费用从店主账户余额实时扣除。</p>
        <div className="rounded-lg bg-[#4b5cff]/5 p-3"><b>综合排名 = 出价 × 质量分</b>。同一宝贝有多个关键词命中时，取得分最高的一个参与竞价。</div>
        <p><b>质量分（1~10 分）</b>由三部分组成：关键词与宝贝标题的相关性（最高 +2）、计划历史点击率（最高 +2）、宝贝评分 ≥ 4.8（+1）与销量 &gt; 100（+1），基础分 4 分。质量分越高，同样排名所需出价越低。</p>
        <div className="rounded-lg bg-amber-50 p-3"><b>实际扣费 = 下一名综合得分 ÷ 您的质量分 + 0.01 元</b>（广义第二价格），不超过您的出价，最低 {AD_RESERVE} 元。例：您出价 1.00、质量分 8；下一名出价 1.20、质量分 5（得分 6.00），您的扣费 = 6.00 ÷ 8 + 0.01 = 0.76 元。</div>
        <p><b>智能出价</b>：系统在关键词建议价基础上按目标自动上浮（获取成交量 +20%、增加收藏加购 +10%）。<b>手动出价</b>：按您为每个关键词设置的价格竞价。</p>
        <p><b>匹配方式</b>：精准匹配仅在搜索词与关键词完全一致时展现；广泛匹配在搜索词包含关键词或关键词包含搜索词时展现。</p>
        <p>当日花费达到日预算后，计划当天下线、次日自动恢复（最后一次点击只扣剩余预算）；账户余额不足时计划自动暂停，充值后需手动启用。成交按<b>末次点击归因、15 天累计周期</b>统计。店主本人搜索、点击自家广告不计展现与扣费。</p>
      </div></Modal>
    </div>
  )
}

function QualityBar({ v }: { v: number }) {
  return <span className="inline-flex items-center gap-1.5"><span className="flex gap-px">{Array.from({ length: 10 }, (_, i) => <span key={i} className={cls('w-1.5 h-3 rounded-sm', i < Math.round(v) ? (v >= 7 ? 'bg-emerald-500' : v >= 5 ? 'bg-amber-400' : 'bg-red-400') : 'bg-ink-100')} />)}</span><span className="font-num text-xs">{v.toFixed(1)}</span></span>
}

function PlanEditor({ plan, onClose }: { plan: AdPlan | null; onClose: () => void }) {
  const shop = useCurrentShop()
  const { products, adPlans, users, shops, upsertAdPlan } = useDB()
  const mine = products.filter(p => p.shopId === shop.id && p.status === 'on')
  const now = new Date()
  const [step, setStep] = useState(plan ? 1 : 0)
  const [pids, setPids] = useState<string[]>(plan?.productIds ?? [])
  const [kws, setKws] = useState<AdKeyword[]>(plan?.keywords ?? [])
  const [bidMode, setBidMode] = useState<AdPlan['bidMode']>(plan?.bidMode ?? 'smart')
  const [goal, setGoal] = useState<AdPlan['goal']>(plan?.goal ?? 'orders')
  const [budget, setBudget] = useState(plan?.dailyBudget ?? 100)
  const [start, setStart] = useState(plan ? localYmd(new Date(plan.startAt)) : localYmd(now))
  const [end, setEnd] = useState(plan ? localYmd(new Date(plan.endAt)) : localYmd(new Date(now.getTime() + 29 * 864e5)))
  const [name, setName] = useState(plan?.name ?? `关键词推广_${localYmd(now).replace(/-/g, '')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`)
  const [custom, setCustom] = useState('')
  const [pq, setPq] = useState('')
  const chosen = mine.filter(p => pids.includes(p.id))
  const recs = useMemo(() => recommendWords(chosen, products, adPlans), [pids, products, adPlans]) // eslint-disable-line react-hooks/exhaustive-deps
  const draft: AdPlan = { id: plan?.id ?? '__draft__', shopId: shop.id, name, productIds: pids, keywords: kws, bidMode, goal, dailyBudget: budget, startAt: new Date(start + 'T00:00:00').toISOString(), endAt: new Date(end + 'T23:59:59').toISOString(), status: 'on', createdAt: plan?.createdAt ?? now.toISOString(), stats: plan?.stats ?? { impressions: 0, clicks: 0, spend: 0, orders: 0, gmv: 0, carts: 0, favs: 0 }, daily: plan?.daily ?? {} }
  const preview = (word: string) => { const r = adAuction({ adPlans: [...adPlans.filter(p => p.id !== draft.id), draft], products, shops, users }, word, 10, ymd(new Date())); const i = r.findIndex(x => x.planId === draft.id); return i < 0 ? null : { pos: i + 1, price: r[i].price, total: r.length } }
  const addWord = (word: string, bid?: number) => { const w = word.trim(); if (!w || kws.some(k => k.word === w)) return; if (kws.length >= 200) return toast('每个计划最多 200 个关键词', 'error'); setKws([...kws, { word: w, bid: bid ?? adSuggestBid(adPlans, w), match: 'broad' }]) }
  const save = () => {
    if (!pids.length) return toast('请选择推广宝贝', 'error')
    if (!kws.length) return toast('请至少添加 1 个关键词', 'error')
    if (budget < 30) return toast('日预算不低于 30 元', 'error')
    if (end < start) return toast('结束日期不能早于开始日期', 'error')
    upsertAdPlan({ ...draft, id: plan?.id ?? `ad${Date.now()}`, status: plan?.status ?? 'on' })
    toast(plan ? '计划已保存' : '推广计划已创建，买家搜索关键词即可看到您的宝贝')
    onClose()
  }
  const STEPS = ['选择推广宝贝', '设置关键词', '出价与预算']
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex justify-end" onClick={onClose}>
      <div className="bg-[#f6f7fb] w-full max-w-[1080px] h-full flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="bg-white h-16 px-6 flex items-center gap-6 border-b border-ink-100"><span className="text-lg font-semibold">{plan ? '编辑计划' : '新建关键词推广'}</span><div className="flex items-center gap-2 text-sm">{STEPS.map((s, i) => <button key={s} onClick={() => (i === 0 || pids.length) && setStep(i)} className="flex items-center gap-2"><span className={cls('w-6 h-6 rounded-full flex items-center justify-center text-xs', i <= step ? 'text-white' : 'bg-ink-100 text-ink-500')} style={i <= step ? { background: BLUE } : undefined}>{i < step ? <Check className="w-3.5 h-3.5" /> : i + 1}</span><span className={i === step ? 'font-medium' : 'text-ink-500'}>{s}</span>{i < 2 && <span className="w-8 h-px bg-ink-200" />}</button>)}</div><button aria-label="关闭" onClick={onClose} className="ml-auto text-ink-400"><X className="w-5 h-5" /></button></div>
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {step === 0 && <div className="bg-white rounded-xl p-5"><div className="flex items-center gap-3"><span className="font-semibold">选择推广宝贝</span><span className="text-xs text-ink-500">已选 {pids.length} 个，单计划最多 20 个</span><label className="ml-auto h-9 w-64 rounded-lg border border-ink-200 flex items-center px-2 gap-1 text-sm"><Search className="w-4 h-4 text-ink-400" /><input aria-label="搜索宝贝" className="flex-1 outline-none min-w-0" placeholder="宝贝名称 / ID" value={pq} onChange={e => setPq(e.target.value)} /></label></div>
            <div className="grid grid-cols-2 max-md:!grid-cols-1 gap-3 mt-4">{mine.filter(p => !pq || p.title.includes(pq) || p.id === pq).map(p => { const on = pids.includes(p.id); return <button key={p.id} onClick={() => setPids(on ? pids.filter(x => x !== p.id) : pids.length >= 20 ? pids : [...pids, p.id])} className={cls('flex gap-3 p-3 rounded-xl border-2 text-left', on ? 'bg-[#4b5cff]/5' : 'border-ink-100 hover:border-ink-200')} style={on ? { borderColor: BLUE } : undefined}><Img src={p.images[0]} alt="" w={64} h={64} className="w-16 h-16 rounded-lg shrink-0" /><div className="min-w-0 text-sm"><div className="line-clamp-2">{p.title}</div><div className="text-xs text-ink-500 mt-1 font-num">¥{money(p.price)} · 月销 {p.sales} · 评分 {p.rating.toFixed(1)}</div></div>{on && <Check className="w-5 h-5 shrink-0 ml-auto" style={{ color: BLUE }} />}</button> })}</div>
            {mine.length === 0 && <div className="py-10 text-center text-ink-400 text-sm">店铺暂无在售宝贝，<Link to="/seller/publish/category" style={{ color: BLUE }}>先去发布</Link></div>}</div>}
          {step === 1 && <div className="grid grid-cols-[1fr_380px] max-lg:!grid-cols-1 gap-4 items-start">
            <div className="bg-white rounded-xl p-5"><div className="flex items-center gap-2"><Sparkles className="w-4 h-4" style={{ color: BLUE }} /><span className="font-semibold">系统推荐关键词</span><span className="text-xs text-ink-500">根据宝贝标题、类目、品牌与全站搜索热度推荐</span></div>
              <table className="w-full text-sm mt-3"><thead><tr className="bg-[#f6f7fb] text-xs text-ink-600 text-left"><th className="px-3 py-2 font-normal">关键词</th><th className="px-2 py-2 font-normal">相关性</th><th className="px-2 py-2 font-normal">搜索热度</th><th className="px-2 py-2 font-normal">竞争度</th><th className="px-2 py-2 font-normal">建议出价</th><th className="px-2 py-2 font-normal" /></tr></thead><tbody>{recs.map(r => <tr key={r.word} className="border-b border-ink-50"><td className="px-3 py-2">{r.word}</td><td className="px-2 py-2 text-amber-500">{'★'.repeat(r.rel)}</td><td className="px-2 py-2 font-num">{r.heat}</td><td className="px-2 py-2">{r.comp === 0 ? '低' : r.comp < 3 ? '中' : '高'}</td><td className="px-2 py-2 font-num">¥{money(r.bid)}</td><td className="px-2 py-2 text-right">{kws.some(k => k.word === r.word) ? <span className="text-xs text-ink-400">已添加</span> : <button onClick={() => addWord(r.word, r.bid)} className="text-xs" style={{ color: BLUE }}>添加</button>}</td></tr>)}</tbody></table>
              {recs.length === 0 && <div className="py-8 text-center text-ink-400 text-sm">请先选择推广宝贝</div>}
              <div className="mt-3"><button onClick={() => recs.forEach(r => addWord(r.word, r.bid))} className="text-sm" style={{ color: BLUE }}>全部添加</button></div></div>
            <div className="bg-white rounded-xl p-5"><div className="font-semibold">已添加关键词（{kws.length}）</div>
              <form onSubmit={e => { e.preventDefault(); custom.split(/[\n,，]+/).forEach(w => addWord(w)); setCustom('') }} className="flex gap-2 mt-3"><input aria-label="自定义关键词" className="flex-1 h-9 rounded-lg border border-ink-200 px-3 text-sm min-w-0" placeholder="输入关键词，回车添加" value={custom} onChange={e => setCustom(e.target.value)} /><button className="h-9 px-3 rounded-lg text-white text-sm" style={{ background: BLUE }}>添加</button></form>
              <div className="mt-3 space-y-2 max-h-[52vh] overflow-y-auto">{kws.map(k => { const pv = pids.length ? preview(k.word) : null; return <div key={k.word} className="rounded-lg border border-ink-100 p-2.5 text-sm"><div className="flex items-center gap-2"><span className="font-medium flex-1 min-w-0 truncate">{k.word}</span><select aria-label="匹配方式" className="h-7 rounded border border-ink-200 text-xs" value={k.match} onChange={e => setKws(kws.map(x => x.word === k.word ? { ...x, match: e.target.value as AdKeyword['match'] } : x))}><option value="broad">广泛</option><option value="exact">精准</option></select><input aria-label="出价" type="number" step="0.01" min={AD_RESERVE} className="w-16 h-7 rounded border border-ink-200 px-1 text-xs font-num" value={k.bid} onChange={e => setKws(kws.map(x => x.word === k.word ? { ...x, bid: Number(e.target.value) } : x))} /><button aria-label="移除" onClick={() => setKws(kws.filter(x => x.word !== k.word))} className="text-ink-400"><X className="w-4 h-4" /></button></div><div className="text-xs mt-1">{pv ? <span className={pv.pos <= 4 ? 'text-emerald-600' : 'text-amber-600'}>预估排名 第 {pv.pos}/{pv.total} 位{pv.pos > 4 ? '，未进入广告位，建议提高出价' : ''} · 预估扣费 ¥{money(pv.price)}</span> : <span className="text-ink-400">暂无匹配宝贝</span>}</div></div> })}</div></div>
          </div>}
          {step === 2 && <div className="bg-white rounded-xl p-5 space-y-5 text-sm max-w-3xl">
            <div className="grid grid-cols-[100px_1fr] gap-4 items-center"><span className="text-ink-600">计划名称</span><input aria-label="计划名称" className="h-9 rounded-lg border border-ink-200 px-3 max-w-md" value={name} onChange={e => setName(e.target.value)} />
              <span className="text-ink-600">出价方式</span><div className="flex gap-3">{([['smart', '智能出价', '系统按目标自动调整出价'], ['manual', '手动出价', '按关键词设置的价格竞价']] as const).map(([k, l, d]) => <button key={k} onClick={() => setBidMode(k)} className={cls('flex-1 rounded-lg border-2 p-3 text-left', bidMode === k ? 'bg-[#4b5cff]/5' : 'border-ink-100')} style={bidMode === k ? { borderColor: BLUE } : undefined}><div className="font-medium">{l}</div><div className="text-xs text-ink-500 mt-0.5">{d}</div></button>)}</div>
              {bidMode === 'smart' && <><span className="text-ink-600">优化目标</span><div className="flex gap-2">{(Object.keys(GOALS) as AdPlan['goal'][]).map(g => <button key={g} onClick={() => setGoal(g)} className={cls('h-8 px-3 rounded-lg border', goal === g ? 'text-white' : 'border-ink-200')} style={goal === g ? { background: BLUE, borderColor: BLUE } : undefined}>{GOALS[g]}</button>)}</div></>}
              <span className="text-ink-600">每日预算</span><div className="flex items-center gap-2"><input aria-label="每日预算" type="number" min={30} className="h-9 w-32 rounded-lg border border-ink-200 px-3 font-num" value={budget} onChange={e => setBudget(Number(e.target.value))} /> 元/天 <span className="text-xs text-ink-400">不低于 30 元，当日花费达到预算后当天下线、次日恢复</span></div>
              <span className="text-ink-600">投放日期</span><div className="flex items-center gap-2"><input aria-label="开始日期" type="date" className="h-9 rounded-lg border border-ink-200 px-2" value={start} onChange={e => setStart(e.target.value)} /> 至 <input aria-label="结束日期" type="date" className="h-9 rounded-lg border border-ink-200 px-2" value={end} onChange={e => setEnd(e.target.value)} /></div>
              <span className="text-ink-600">分时折扣</span><span className="text-ink-500">0:00-24:00 · 100%</span>
            </div>
            <div className="rounded-lg bg-[#4b5cff]/5 p-4 text-ink-700"><div className="font-medium mb-2">投放预估</div><div className="grid grid-cols-3 gap-3 text-center">{(() => { const avg = kws.reduce((a, k) => a + adBid(draft, k.word), 0) / Math.max(1, kws.length); const clicks = Math.floor(budget / Math.max(AD_RESERVE, avg * 0.8)); return [['预估日点击', `${clicks} 次`], ['平均出价', `¥${money(avg)}`], ['已选宝贝 / 关键词', `${pids.length} / ${kws.length}`]].map(([l, v]) => <div key={l}><div className="text-xs text-ink-500">{l}</div><div className="font-num text-lg font-semibold mt-1">{v}</div></div>) })()}</div></div>
          </div>}
        </div>
        <div className="bg-white h-16 px-6 flex items-center gap-3 border-t border-ink-100"><span className="text-xs text-ink-500">推广费用从店主账户余额扣除，按点击计费，展现免费</span><div className="ml-auto flex gap-3">{step > 0 && <button onClick={() => setStep(step - 1)} className="h-9 px-5 rounded-lg border border-ink-200">上一步</button>}{step < 2 ? <button onClick={() => { if (step === 0 && !pids.length) return toast('请选择推广宝贝', 'error'); if (step === 1 && !kws.length) return toast('请至少添加 1 个关键词', 'error'); setStep(step + 1) }} className="h-9 px-6 rounded-lg text-white" style={{ background: BLUE }}>下一步</button> : <button onClick={save} className="h-9 px-6 rounded-lg text-white" style={{ background: BLUE }}>{plan ? '保存' : '完成并投放'}</button>}{plan && step < 2 && <button onClick={save} className="h-9 px-5 rounded-lg border border-ink-200">保存</button>}</div></div>
      </div>
    </div>
  )
}

