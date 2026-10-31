// 千牛 · 店铺体检（营商保）与违规管理（参照 myseller.taobao.com health-center-q 与 violation/VIOLATION）
import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ShieldCheck, ChevronRight, Sparkles, Search, Video, Radio, FileCheck, Gauge, AlertTriangle, ArrowUp, Plus, Image as ImageIcon, X, Check } from 'lucide-react'
import { useDB } from '@/store/db'
import { useCurrentShop } from '@/lib/hooks'
import { Img, Modal } from '@/components/ui'
import { cls, fmtDate } from '@/lib/format'
import { toast } from '@/store/session'
import { pickFiles, uploadImageFile } from '@/lib/upload'
import type { Product, Violation } from '@/data/types'

/** 本地日期 yyyy-mm-dd */
const day = (iso?: string) => iso ? fmtDate(iso, false) : ''
const today = () => day(new Date().toISOString())
const daysAgo = (n: number) => day(new Date(Date.now() - n * 864e5).toISOString())
/** 是否仍在处罚期（未撤销、未被忽略的待处理记录） */
const isPending = (v: Violation) => !v.ignored && (v.status === 'pending' || v.status === 'appealing' || v.status === 'reviewing')
export const PENALTY: Record<Violation['status'], { l: string; c: string }> = {
  pending: { l: '处罚中', c: 'bg-red-50 text-red-500' }, appealing: { l: '处罚中', c: 'bg-red-50 text-red-500' }, reviewing: { l: '申诉审核中', c: 'bg-amber-50 text-amber-600' },
  upheld: { l: '处罚生效', c: 'bg-ink-100 text-ink-600' }, revoked: { l: '已撤销', c: 'bg-emerald-50 text-emerald-600' },
}

/** 广告法极限词 / 平台禁限售词，用于商品合规预检 */
const BANNED = ['最低价', '最便宜', '第一', '国家级', '顶级', '极品', '绝对', '100%', '万能', '史上', '全网最', '永久', '根治', '特效', '假一赔', '高仿', '原单', '复刻']
export function complianceScan(products: Product[]) {
  return products.flatMap(p => {
    const issues: string[] = []
    const hit = BANNED.filter(w => p.title.includes(w))
    if (hit.length) issues.push(`标题含极限词/禁限售词：${hit.join('、')}`)
    if (p.images.length < 3) issues.push('主图少于 3 张，可能被判定为信息不完整')
    if (!p.pub?.props || Object.keys(p.pub.props).length === 0) issues.push('类目属性未填写')
    if (p.price <= 0) issues.push('价格异常')
    return issues.length ? [{ p, issues }] : []
  })
}

function credit(points: number, doneOrders: number) { return Math.max(0, Math.min(1000, 550 + Math.min(200, doneOrders * 2) - points * 20)) }

// ———————————————————————— 店铺体检首页 ————————————————————————

export function HealthCenter() {
  const shop = useCurrentShop()
  const { violations, orders, products } = useDB()
  const mine = useMemo(() => violations.filter(v => v.shopId === shop.id), [violations, shop.id])
  const pendingWarn = mine.filter(v => v.warning && isPending(v)).length
  const pendingVio = mine.filter(v => !v.warning && isPending(v)).length
  const all = mine.filter(v => !v.warning)
  const points = all.filter(v => v.status !== 'revoked').reduce((a, v) => a + v.points, 0)
  const vioProducts = new Set(all.flatMap(v => v.productIds ?? [])).size
  const done = orders.filter(o => o.shopId === shop.id && (o.status === 'done' || o.status === 'received')).length
  const score = credit(points, done)
  const [strategies, setStrategies] = useState<Record<string, boolean>>({})
  const [ask, setAsk] = useState('')
  const [answer, setAnswer] = useState<string | null>(null)
  const [scan, setScan] = useState<ReturnType<typeof complianceScan> | null>(null)
  const [report, setReport] = useState(false)
  const myProducts = products.filter(p => p.shopId === shop.id)
  const reply = (qs: string) => {
    setAsk('')
    if (/扣分/.test(qs)) return setAnswer(points ? `店铺当前累计扣分 ${points} 分，扣分在违规成立之日起 365 天后清零。一般违规累计 12 分会被限制参加营销活动，严重违规 12 分将被限权 7 天。` : '店铺当前无扣分，请继续保持。一般违规累计 12 分会被限制参加营销活动。')
    if (/违规|解读/.test(qs)) return setAnswer(pendingVio ? `您有 ${pendingVio} 条待处理违规。点击「待处理违规」查看违规原因与影响，确认售后处理完毕后可在申诉期内发起申诉并上传凭证。` : '当前没有待处理违规。常见违规：延迟发货（付款后 48 小时未发货）、虚假发货（无需物流发货但未交付）、描述不符、恶意骚扰等。')
    if (/投诉|恶意/.test(qs)) return setAnswer('遭遇职业索赔、恶意差评或黄牛下单时，可在「工具箱 → 恶意行为投诉」提交订单号与聊天记录，平台将在 3 个工作日内核实。')
    if (/报告|风险/.test(qs)) return setAnswer(`风险报告：近 90 天违规 ${all.filter(v => v.createdAt >= daysAgo(90)).length} 条，商品合规风险 ${complianceScan(myProducts).length} 个，淘信用 ${score} 分。`)
    setAnswer('我可以帮您解读违规、查询店铺扣分、生成风险报告。试试点击上方的快捷问题。')
  }
  const Card = ({ label, n, to, red }: { label: string; n: number; to: string; red?: boolean }) => <Link to={to} className="bg-white rounded-xl px-6 py-5 flex-1 min-w-[150px] hover:shadow-card transition"><div className="text-[15px] text-ink-800 flex items-center gap-1">{label} <ChevronRight className="w-4 h-4" /></div><div className={cls('mt-3 text-4xl font-num', red && n > 0 ? 'text-red-500' : 'text-ink-900')}>{n}</div></Link>
  return (
    <div className="grid grid-cols-[1fr_360px] max-xl:!grid-cols-1 gap-5 items-start">
      <div className="space-y-6 min-w-0">
        <div className="rounded-2xl bg-gradient-to-br from-[#eef2ff] to-[#f5f7ff] p-3">
          <div className="flex items-center gap-3 px-2 pt-1 pb-3"><span className="text-xl font-black italic text-[#3d5afe] flex items-center gap-1"><ShieldCheck className="w-5 h-5" />营商保</span><button onClick={() => toast('已切换到简约智能版', 'info')} className="h-8 px-4 rounded-full border border-[#3d5afe]/50 text-[#3d5afe] text-sm flex items-center gap-1"><Sparkles className="w-3.5 h-3.5" />体验简约智能版</button></div>
          <div className="flex gap-3 flex-wrap">
            <div className="flex-[3] flex gap-3 bg-white rounded-xl min-w-[300px] flex-wrap"><Card label="待处理违规预警" n={pendingWarn} to="/seller/health/violations?tab=warning" /><Card label="待处理违规" n={pendingVio} to="/seller/health/violations" red /><Card label="待处理经营风险" n={complianceScan(myProducts).filter(x => x.issues.some(i => i.includes('极限词'))).length} to="/seller/health/violations?tab=warning" /></div>
            <Link to="/seller/health/violations?sub=all" className="flex-1 min-w-[200px] bg-white rounded-xl px-6 py-5 hover:shadow-card"><div className="text-[15px] text-ink-800 flex items-center gap-1">全部违规 <ChevronRight className="w-4 h-4" /></div><div className="mt-3 flex items-end justify-between"><div><div className="text-3xl font-num">{all.length}</div><div className="text-xs text-ink-600">今日 {all.filter(v => day(v.createdAt) === today()).length}</div></div><div className="text-xs text-ink-600 text-right space-y-1"><div>违规宝贝 {vioProducts}</div><div>受限权限 {points >= 12 ? 1 : 0}</div></div></div></Link>
          </div>
          <div className="text-center text-sm text-ink-500 py-3">{points ? <>店铺累计扣分 <b className="text-red-500 font-num">{points}</b> 分，请及时处理</> : '店铺暂无扣分，请继续保持'} <span className="text-[#3d5afe]">▾</span></div>
        </div>
        <div>
          <div className="flex items-center gap-3 flex-wrap"><span className="text-lg font-semibold">平台主动处理风险</span><span className="text-sm text-ink-500">已开启 {Object.values(strategies).filter(Boolean).length} 项防控 已生效 {Object.values(strategies).filter(Boolean).length} 个拦截策略</span><button onClick={() => toast('已为您推荐 3 项防控策略，点击卡片开启', 'info')} className="ml-auto text-[#3d5afe] text-sm flex items-center gap-1"><Plus className="w-4 h-4 bg-[#3d5afe] text-white rounded" />新增防控策略</button></div>
          <div className="grid grid-cols-3 max-md:!grid-cols-1 gap-4 mt-3">{[['order', '已主动处理异常订单'], ['review', '已主动处理异常评价'], ['scalper', '已主动拦截黄牛恶意下单']].map(([k, l]) => <button key={k} onClick={() => { setStrategies(s => ({ ...s, [k]: !s[k] })); toast(strategies[k] ? '已关闭该防控策略' : '防控策略已开启，系统将自动拦截') }} className="text-left bg-ink-50 rounded-xl p-4 hover:bg-ink-100"><div className="text-xs text-ink-600">{l} ⓘ</div><div className="mt-2 font-medium flex items-center gap-1">{strategies[k] ? <><span className="text-emerald-600">已生效</span> <span className="font-num">0</span> 笔</> : <>策略待配置 <ChevronRight className="w-4 h-4" /></>}</div><div className="text-xs text-ink-500 mt-1">{strategies[k] ? '点击可关闭' : '策略生效启动拦截'}</div></button>)}</div>
        </div>
        <div>
          <div className="text-lg font-semibold">营商保障</div>
          <div className="mt-3 rounded-xl bg-gradient-to-r from-[#fdf3e3] to-[#fbf0dc] p-6 flex items-center gap-6 relative overflow-hidden"><div className="w-24 h-24 rounded-full bg-gradient-to-b from-[#c9b7a3] to-[#6b5a48] text-white font-num text-3xl flex items-center justify-center shrink-0">{score}</div><div><div className="text-xl">Hi，您目前淘信用为{score}分</div><div className="text-sm text-amber-700 mt-2">{score >= 600 ? '信用良好 继续保持' : '认真经营 点滴积累'}</div><div className="text-xs text-ink-500 mt-2">交易成功 {done} 笔 · 有效扣分 {points} 分</div></div></div>
        </div>
      </div>
      <div className="space-y-4">
        <div className="rounded-2xl bg-gradient-to-br from-[#dfe6ff] to-[#eef1ff] p-4"><div className="flex items-center gap-2"><Sparkles className="w-4 h-4 text-[#3d5afe]" /><span className="text-[#3d5afe] italic">你好!</span> 我是营商保智能助手!</div><div className="flex gap-2 flex-wrap mt-3">{['风险报告', '违规解读', '店铺扣分', '恶意行为投诉'].map(t => <button key={t} onClick={() => reply(t)} className="h-7 px-3 rounded-md bg-white/80 text-xs text-ink-700 hover:bg-white">{t}</button>)}</div><form onSubmit={e => { e.preventDefault(); if (ask.trim()) reply(ask) }} className="mt-3 h-11 rounded-full bg-white border-2 border-[#8c9eff] flex items-center pl-4 pr-1"><input aria-label="向营商保助手提问" className="flex-1 outline-none text-sm bg-transparent min-w-0" placeholder="有什么问题，请在这里输入吧" value={ask} onChange={e => setAsk(e.target.value)} /><button aria-label="发送" className="w-8 h-8 rounded-full bg-[#7c6cff] text-white flex items-center justify-center"><ArrowUp className="w-4 h-4" /></button></form>{answer && <div className="mt-3 bg-white rounded-xl p-3 text-sm text-ink-700 relative">{answer}<button aria-label="关闭回答" onClick={() => setAnswer(null)} className="absolute top-1.5 right-1.5 text-ink-400"><X className="w-3.5 h-3.5" /></button></div>}</div>
        <div className="flex items-center justify-between"><span className="text-lg font-semibold">工具箱</span><Link to="/seller/health/violations" className="text-sm flex items-center gap-1">重要提醒 <span className="relative">✉{pendingVio + pendingWarn > 0 && <span className="absolute -top-2 -right-2.5 w-4 h-4 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center">{pendingVio + pendingWarn}</span>}</span></Link></div>
        {[
          { i: <Search className="w-5 h-5" />, c: 'bg-[#3d5afe]', t: '商品合规预检', tag: '同行在用', d: '支持对商品内容进行检测', on: () => setScan(complianceScan(myProducts)) },
          { i: <Radio className="w-5 h-5" />, c: 'bg-emerald-500', t: '直播合规预检', d: '检测通过后进行直播', on: () => toast('直播间标题、封面与商品均未发现违规', 'info') },
          { i: <Video className="w-5 h-5" />, c: 'bg-violet-500', t: '内容合规预检', d: '支持对短视频/图文内容检测', on: () => toast('暂无待检测的短视频/图文内容', 'info') },
          { i: <FileCheck className="w-5 h-5" />, c: 'bg-sky-500', t: '我要报备', d: '报备通过可延期发货/开票', on: () => setReport(true) },
          { i: <Gauge className="w-5 h-5" />, c: 'bg-amber-500', t: '品质提升工具', d: '商品品质分析', on: () => toast(`已分析 ${myProducts.length} 个商品，平均评分 ${(myProducts.reduce((a, p) => a + p.rating, 0) / Math.max(1, myProducts.length)).toFixed(2)}`, 'info') },
        ].map(x => <div key={x.t} className="bg-white rounded-xl shadow-card px-4 py-5 flex items-center gap-3"><span className={cls('w-12 h-12 rounded-xl text-white flex items-center justify-center shrink-0', x.c)}>{x.i}</span><div className="flex-1 min-w-0"><div className="font-medium">{x.t}{x.tag && <span className="ml-1 text-xs rounded bg-qn-50 text-qn-600 px-1.5">{x.tag}</span>}</div><div className="text-xs text-ink-500 mt-0.5">{x.d}</div></div><button onClick={x.on} className="text-sm text-[#3d5afe] shrink-0">免费使用</button></div>)}
        <div className="grid grid-cols-3 gap-2 text-xs text-ink-700">{['原创保护', '恶意行为投诉', '知识产权市场', '职业索赔治理', '凭证中心', '政务服务市场'].map(t => <button key={t} onClick={() => toast(`${t}：功能已开通，提交材料后 3 个工作日内处理`, 'info')} className="bg-white rounded-lg py-2.5 hover:text-qn-600">{t}</button>)}</div>
      </div>
      <Modal open={!!scan} onClose={() => setScan(null)} title="商品合规预检结果" width={640}>{scan && (scan.length === 0 ? <div className="py-10 text-center text-emerald-600"><Check className="w-10 h-10 mx-auto mb-2" />已检测 {myProducts.length} 个商品，未发现违规风险</div> : <div className="space-y-3 max-h-[60vh] overflow-y-auto"><div className="text-sm text-ink-600">已检测 {myProducts.length} 个商品，发现 <b className="text-red-500">{scan.length}</b> 个存在风险：</div>{scan.map(({ p, issues }) => <div key={p.id} className="flex gap-3 border border-ink-100 rounded-lg p-3"><Img src={p.images[0]} alt="" w={56} h={56} className="w-14 h-14 rounded shrink-0" /><div className="flex-1 min-w-0 text-sm"><div className="line-clamp-1">{p.title}</div><ul className="text-xs text-amber-700 mt-1 space-y-0.5">{issues.map(i => <li key={i}>⚠ {i}</li>)}</ul></div><Link to={`/seller/publish?id=${p.id}`} className="text-qn-600 text-sm shrink-0">去修改</Link></div>)}</div>)}</Modal>
      <ReportModal open={report} onClose={() => setReport(false)} />
    </div>
  )
}

function ReportModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [type, setType] = useState('延期发货')
  const [reason, setReason] = useState('')
  return <Modal open={open} onClose={onClose} title="我要报备" width={480} footer={<><button className="btn-outline" onClick={onClose}>取消</button><button className="btn-qn" onClick={() => { if (!reason.trim()) return toast('请填写报备原因', 'error'); setReason(''); onClose(); toast('报备已提交，审核通过后延期发货不计违规') }}>提交报备</button></>}>
    <div className="space-y-3 text-sm"><select aria-label="报备类型" className="input-qn" value={type} onChange={e => setType(e.target.value)}>{['延期发货', '延期开票', '不可抗力（天气/疫情/停电）', '平台系统故障'].map(t => <option key={t}>{t}</option>)}</select><textarea aria-label="报备原因" className="input-qn h-24 py-2" value={reason} onChange={e => setReason(e.target.value)} placeholder="请说明原因、影响订单范围与预计恢复时间" /></div>
  </Modal>
}

// ———————————————————————— 违规管理 ————————————————————————

export function Violations() {
  const shop = useCurrentShop()
  const [sp, setSp] = useSearchParams()
  const top = sp.get('tab') === 'warning' ? 'warning' : 'violation'
  const sub = (sp.get('sub') ?? 'pending') as 'pending' | 'all' | 'revoked' | 'appeals'
  const { violations, orders, ignoreViolation } = useDB()
  const [f, setF] = useState({ code: '', appeal: '', from: '', to: '', type: '' })
  const [applied, setApplied] = useState(f)
  const [sel, setSel] = useState<string[]>([])
  const [open, setOpen] = useState<string | null>(null)
  const [appealOf, setAppealOf] = useState<Violation | null>(null)
  const [ai, setAi] = useState<Violation | null>(null)
  const [hideTip, setHideTip] = useState(false)
  const mine = useMemo(() => violations.filter(v => v.shopId === shop.id && (top === 'warning' ? !!v.warning : !v.warning)).sort((a, b) => b.createdAt.localeCompare(a.createdAt)), [violations, shop.id, top])
  const pendingN = mine.filter(isPending).length
  const list = mine.filter(v => {
    if (sub === 'pending' && !isPending(v)) return false
    if (sub === 'revoked' && v.status !== 'revoked') return false
    if (sub === 'appeals' && !v.appeal) return false
    const a = applied
    if (a.code && !v.code.includes(a.code)) return false
    if (a.type && !v.type.includes(a.type)) return false
    if (a.appeal === 'can' && !(v.status === 'pending' && day(v.appealDeadline) >= today())) return false
    if (a.appeal === 'ing' && v.status !== 'reviewing') return false
    if (a.appeal === 'ok' && v.status !== 'revoked') return false
    if (a.appeal === 'fail' && v.status !== 'upheld') return false
    if (a.from && day(v.createdAt) < a.from) return false
    if (a.to && day(v.createdAt) > a.to) return false
    return true
  })
  const quick = (n: number) => { const x = { ...f, from: n === 0 ? today() : daysAgo(n), to: today() }; setF(x); setApplied(x) }
  const go = (s: string) => { const p = new URLSearchParams(sp); p.set('sub', s); setSp(p); setSel([]); setOpen(null) }
  return (
    <div className="card min-h-[calc(100vh-120px)]">
      <div className="px-6 py-4 border-b border-ink-100 text-[15px] text-ink-500"><Link to="/seller/health" className="hover:text-qn-600">店铺体检</Link> <span className="mx-2">›</span> <span className="text-ink-900">违规管理</span></div>
      <div className="px-6 flex items-center gap-14 border-b border-ink-100">{([['warning', '违规预警'], ['violation', '违规']] as const).map(([k, l]) => <button key={k} onClick={() => setSp(k === 'warning' ? { tab: 'warning' } : {})} className={cls('py-3.5 relative text-[15px]', top === k ? 'text-ink-900' : 'text-ink-600')}>{l}{top === k && <span className="absolute left-0 right-0 bottom-0 h-0.5 bg-qn-500" />}</button>)}</div>
      <div className="px-6 py-4">
        <div className="flex items-end border-b border-ink-100">
          {([['pending', `待处理${pendingN ? ' ' + pendingN : ''}`], ['all', top === 'warning' ? '全部预警' : '全部违规'], ['revoked', '已撤销'], ['appeals', '申诉记录']] as const).map(([k, l]) => <button key={k} onClick={() => go(k)} className={cls('h-10 px-4 text-sm border border-b-0 rounded-t -mb-px', sub === k ? 'bg-white text-qn-600 border-ink-200' : 'bg-ink-50 text-ink-600 border-transparent')}>{l}</button>)}
          <button onClick={() => setAi(mine[0] ?? null)} className="ml-auto mb-2 h-9 px-4 rounded border border-pink-300 text-sm text-violet-600 flex items-center gap-1"><Sparkles className="w-4 h-4" />点我查看店铺合规报告</button>
        </div>
        {!hideTip && <div className="mt-4 rounded-xl bg-[#eef3ff] px-6 py-5 flex items-center gap-5 flex-wrap"><span className="w-12 h-12 rounded-xl bg-white flex items-center justify-center text-[#3d5afe] shadow-card"><ShieldCheck className="w-6 h-6" /></span><div><div className="font-semibold text-lg">推荐您对店铺商品进行合规检测</div><div className="text-sm text-ink-600">使用官方工具，一键排查存在违规风险的“问题商品”</div></div><Link to="/seller/health" className="btn btn-sm rounded-full bg-[#3d5afe] text-white px-5 ml-10 max-md:ml-0">去检测</Link><button onClick={() => setHideTip(true)} className="btn-outline btn-sm rounded-full px-4">不再提醒</button></div>}
        <div className="mt-5 font-medium">{sub === 'pending' ? '待处理列表' : sub === 'all' ? (top === 'warning' ? '全部预警' : '全部违规') : sub === 'revoked' ? '已撤销' : '申诉记录'}</div>
        <div className="mt-3 grid grid-cols-[1fr_1fr_2fr_auto] max-lg:!grid-cols-2 max-md:!grid-cols-1 gap-3 text-sm">
          <input aria-label="违规编号" className="input-qn bg-ink-50 border-transparent" placeholder="违规编号" value={f.code} onChange={e => setF({ ...f, code: e.target.value })} />
          <select aria-label="申诉" className="input-qn bg-ink-50 border-transparent" value={f.appeal} onChange={e => setF({ ...f, appeal: e.target.value })}><option value="">申诉</option><option value="can">可申诉</option><option value="ing">申诉中</option><option value="ok">申诉成功</option><option value="fail">申诉失败</option></select>
          <div className="input-qn bg-ink-50 border-transparent flex items-center gap-2 px-3 text-ink-400"><span className="shrink-0">违规时间</span><input aria-label="开始日期" type="date" className="flex-1 bg-transparent outline-none min-w-0 text-ink-700" value={f.from} onChange={e => setF({ ...f, from: e.target.value })} /><span>→</span><input aria-label="结束日期" type="date" className="flex-1 bg-transparent outline-none min-w-0 text-ink-700" value={f.to} onChange={e => setF({ ...f, to: e.target.value })} /></div>
          <div className="flex gap-2">{[[0, '今天'], [30, '近30天'], [90, '近90天']].map(([n, l]) => <button key={n} onClick={() => quick(n as number)} className="h-10 px-4 rounded-full bg-ink-50 hover:bg-ink-100 whitespace-nowrap">{l}</button>)}</div>
          <input aria-label="违规类型" className="input-qn bg-ink-50 border-transparent" placeholder="违规类型" value={f.type} onChange={e => setF({ ...f, type: e.target.value })} />
          <div className="flex items-center gap-4"><button onClick={() => setApplied(f)} className="h-9 px-5 rounded-full border border-ink-300">搜 索</button><button onClick={() => { const e = { code: '', appeal: '', from: '', to: '', type: '' }; setF(e); setApplied(e) }} className="text-ink-500">清除条件</button></div>
        </div>
        {sub === 'pending' && <><div className="mt-4 text-sm text-[#3d5afe]">ⓘ 您可以在此处处理需要您操作的记录，处理完毕或点击忽略后，您可前往“{top === 'warning' ? '全部预警' : '全部违规'}”列表进行查看。</div>
          <button disabled={!sel.length} onClick={() => { ignoreViolation(sel); setSel([]); toast('已忽略提醒') }} className="mt-3 h-9 px-5 rounded-full bg-ink-100 text-ink-600 disabled:opacity-50 text-sm">忽略提醒</button></>}
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm min-w-[880px]"><thead><tr className="bg-ink-50 text-left text-ink-700"><th className="px-4 py-3 w-10"><input type="checkbox" aria-label="全选" className="accent-qn-500" checked={list.length > 0 && list.every(v => sel.includes(v.id))} onChange={e => setSel(e.target.checked ? list.map(v => v.id) : [])} /></th><th className="px-3 py-3 font-normal">店铺身份</th><th className="px-3 py-3 font-normal">违规编号</th><th className="px-3 py-3 font-normal">违规时间</th><th className="px-3 py-3 font-normal">违规类型</th><th className="px-3 py-3 font-normal">严重程度</th><th className="px-3 py-3 font-normal">扣分</th><th className="px-3 py-3 font-normal">处罚状态</th><th className="px-3 py-3 font-normal">操作</th></tr></thead>
            <tbody>{list.map(v => <ViolationRow key={v.id} v={v} open={open === v.id} sel={sel.includes(v.id)} onSel={c => setSel(c ? [...sel, v.id] : sel.filter(x => x !== v.id))} onToggle={() => setOpen(open === v.id ? null : v.id)} onAppeal={() => setAppealOf(v)} onAi={() => setAi(v)} orderCount={(v.orderIds ?? []).filter(id => orders.some(o => o.id === id)).length} shopType={shop.type} />)}</tbody></table>
          {list.length === 0 && <div className="py-16 text-center text-ink-400 text-sm">{sub === 'pending' ? '暂无待处理记录，继续保持 👍' : '暂无数据'}</div>}
        </div>
      </div>
      <AppealModal v={appealOf} onClose={() => setAppealOf(null)} />
      <Modal open={!!ai} onClose={() => setAi(null)} title={<span className="flex items-center gap-1 text-violet-600"><Sparkles className="w-4 h-4" />AI 违规解读</span>} width={520}>{ai ? <div className="space-y-3 text-sm leading-6"><div><b>违规类型：</b>{ai.type}（{ai.level}，{ai.points ? `扣 ${ai.points} 分` : '无扣分'}）</div><div><b>为什么会被判定：</b>{ai.reason}</div><div><b>对店铺的影响：</b>{ai.impact}</div><div className="rounded-lg bg-violet-50 p-3"><b>建议操作：</b>{ai.status === 'pending' ? `1. 先确认涉及订单的售后已处理完毕；2. 整理聊天记录、发货凭证、交付截图；3. 在 ${fmtDate(ai.appealDeadline, false)} 前点击「发起申诉」上传凭证。` : ai.status === 'reviewing' ? '申诉已提交，平台小二正在审核，请留意站内信，无需重复提交。' : ai.status === 'revoked' ? '申诉已通过，处罚已撤销，受影响订单恢复正常。' : '处罚已生效。后续请规范经营：按时发货、如实描述、虚拟商品交付后保留凭证。'}</div></div> : <div className="text-sm text-ink-600 py-6 text-center">店铺合规状况良好，暂无违规记录。</div>}</Modal>
    </div>
  )
}

const STEPS = ['待申诉', '待举证', '审核中', '已完结']
function ViolationRow({ v, open, sel, onSel, onToggle, onAppeal, onAi, orderCount, shopType }: { v: Violation; open: boolean; sel: boolean; onSel: (c: boolean) => void; onToggle: () => void; onAppeal: () => void; onAi: () => void; orderCount: number; shopType: string }) {
  const step = v.status === 'pending' ? 0 : v.status === 'appealing' ? 1 : v.status === 'reviewing' ? 2 : 3
  const left = new Date(v.appealDeadline).getTime() - Date.now()
  const leftText = left > 0 ? `剩余${Math.floor(left / 864e5)}天 ${String(Math.floor(left / 3600e3) % 24).padStart(2, '0')}:${String(Math.floor(left / 6e4) % 60).padStart(2, '0')}` : '已超过申诉期'
  return <>
    <tr className={cls('border-b border-ink-100', open && 'bg-ink-50/60')}><td className="px-4 py-4"><input type="checkbox" aria-label="选择" className="accent-qn-500" checked={sel} onChange={e => onSel(e.target.checked)} /></td><td className="px-3 py-4">{shopType === 'tmall' ? '天猫' : '淘宝'}</td><td className="px-3 py-4 font-num">{v.code}</td><td className="px-3 py-4 font-num">{day(v.createdAt)}</td><td className="px-3 py-4">{v.type}</td><td className="px-3 py-4">{v.level}</td><td className="px-3 py-4"><span className="border border-ink-700 rounded px-1 text-xs">{v.points ? `-${v.points}分` : '无扣分'}</span></td><td className="px-3 py-4"><span className={cls('rounded px-1.5 py-0.5 text-xs', PENALTY[v.status].c)}>{PENALTY[v.status].l}</span></td><td className="px-3 py-4"><div className="flex items-center gap-3"><button onClick={onToggle} className="text-[#3d5afe]">{open ? '收起' : '查看详情'}</button>{!open && <button onClick={onAi} className="h-8 px-3 rounded border border-violet-300 text-violet-600 text-xs flex items-center gap-1 whitespace-nowrap"><Sparkles className="w-3.5 h-3.5" />AI违规解读</button>}</div></td></tr>
    {open && <tr className="bg-ink-50/60"><td colSpan={9} className="px-4 pb-4"><div className="grid grid-cols-2 max-lg:!grid-cols-1 gap-4">
      <div className="bg-white/60 rounded-xl p-5 text-sm space-y-3"><div className="flex items-center gap-3"><span className="w-11 h-11 rounded-full bg-amber-100 text-amber-500 flex items-center justify-center"><AlertTriangle className="w-5 h-5" /></span><span className="font-medium text-base">违规详情</span><button onClick={onAi} className="ml-auto h-8 px-3 rounded border border-violet-300 text-violet-600 text-xs flex items-center gap-1"><Sparkles className="w-3.5 h-3.5" />点我快速违规解读</button></div>
        <div className="grid grid-cols-[70px_1fr] gap-x-2 gap-y-3"><span className="text-ink-600">违规原因:</span><span>{v.reason}</span><span className="text-ink-600">违规影响:</span><span>{v.impact}</span>{(v.orderIds?.length ?? 0) > 0 && <><span className="text-ink-600">账期订单:</span><span>涉及订单{v.orderIds!.length}个 {orderCount > 0 && <Link to={`/seller/orders?q=${v.orderIds!.join('+')}`} className="text-[#3d5afe] ml-2">查看</Link>}</span></>}{(v.productIds?.length ?? 0) > 0 && <><span className="text-ink-600">违规宝贝:</span><span className="flex gap-2 flex-wrap">{v.productIds!.map(id => <Link key={id} to={`/seller/publish?id=${id}`} className="text-[#3d5afe] font-num">{id}</Link>)}</span></>}<span className="text-ink-600">违规对象:</span><span>{v.productIds?.length ? '商品违规' : '店铺违规'}</span></div>
        <div className="flex gap-3 pt-1"><span className="w-10 h-10 rounded-full bg-sky-100 flex items-center justify-center shrink-0">👨‍💼</span><div className="bg-white rounded-xl p-4 text-ink-700 leading-6"><div className="font-medium mb-1">小二提醒</div>【处罚影响】{v.impact}【申诉要求】请先确认全店维权售后处理完毕，再发起申诉根据实际场景提供凭证，若申诉通过受影响订单将恢复正常状态。</div></div>
      </div>
      <div className="bg-white/60 rounded-xl p-5 text-sm"><div className="flex items-center gap-3"><span className="w-11 h-11 rounded-full bg-indigo-100 text-indigo-500 flex items-center justify-center"><FileCheck className="w-5 h-5" /></span><span className="font-medium text-base">操作建议</span></div>
        <div className="mt-4 flex items-center gap-2 text-xs">{STEPS.map((s, i) => <span key={s} className="flex items-center gap-2 flex-1 last:flex-none"><span className={cls('w-5 h-5 rounded-full border flex items-center justify-center shrink-0', i < step ? 'border-[#3d5afe] text-[#3d5afe]' : i === step ? 'bg-[#3d5afe] border-[#3d5afe] text-white' : 'border-ink-300 text-ink-400')}>{i < step ? '✓' : i + 1}</span><span className={i <= step ? 'text-ink-900' : 'text-ink-400'}>{s}</span>{i < STEPS.length - 1 && <span className={cls('flex-1 h-px', i < step ? 'bg-[#3d5afe]' : 'bg-ink-200')} />}</span>)}</div>
        <div className="mt-4 bg-white rounded-xl p-4 flex items-center gap-3"><div className="border-l-4 border-[#3d5afe] pl-3 flex-1"><div className="font-medium">{STEPS[step]}{v.result && `：${v.result.ok ? '申诉通过' : '申诉驳回'}`}</div>{v.status === 'pending' && <div className="text-xs text-amber-600 mt-1">⏱ 申诉剩余时间：{leftText}</div>}{v.status === 'reviewing' && <div className="text-xs text-amber-600 mt-1">⏱ 平台将在 2 个工作日内完成审核</div>}{v.result && <div className="text-xs text-ink-600 mt-1">{v.result.text}</div>}</div>{v.status === 'pending' && left > 0 ? <button onClick={onAppeal} className="h-9 px-5 rounded-full bg-[#3d5afe] text-white">发起申诉</button> : <button onClick={onAi} className="h-9 px-5 rounded-full bg-indigo-50 text-[#3d5afe]">查看详情</button>}</div>
        {v.appeal && <div className="mt-3 bg-white rounded-xl p-4"><div className="text-xs text-ink-500">我的申诉 · <span className="font-num">{fmtDate(v.appeal.at)}</span></div><div className="mt-1 text-ink-800">{v.appeal.text}</div>{v.appeal.images.length > 0 && <div className="flex gap-2 mt-2">{v.appeal.images.map(s => <a key={s} href={s} target="_blank" rel="noreferrer"><Img src={s} alt="申诉凭证" w={56} h={56} className="w-14 h-14 rounded border border-ink-100" /></a>)}</div>}</div>}
      </div>
    </div></td></tr>}
  </>
}

function AppealModal({ v, onClose }: { v: Violation | null; onClose: () => void }) {
  const { appealViolation } = useDB()
  const [scene, setScene] = useState('已正常交付，买家已确认')
  const [text, setText] = useState('')
  const [imgs, setImgs] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const add = async () => { const fs = await pickFiles('image/*', true); if (!fs.length) return; setBusy(true); try { const urls = await Promise.all(fs.slice(0, 6 - imgs.length).map(f => uploadImageFile(f))); setImgs(x => [...x, ...urls]) } catch { toast('上传失败', 'error') } finally { setBusy(false) } }
  const close = () => { setText(''); setImgs([]); onClose() }
  return <Modal open={!!v} onClose={close} title="发起申诉" width={560} footer={<><button className="btn-outline" onClick={close}>取消</button><button className="btn-qn" disabled={busy} onClick={() => { if (text.trim().length < 10) return toast('申诉说明至少 10 个字', 'error'); if (!imgs.length) return toast('请上传至少 1 张凭证', 'error'); appealViolation(v!.id, `【${scene}】${text.trim()}`, imgs); close(); toast('申诉已提交，平台将在 2 个工作日内审核') }}>提交申诉</button></>}>
    {v && <div className="space-y-3 text-sm"><div className="bg-ink-50 rounded-lg p-3"><div>违规编号 <span className="font-num">{v.code}</span> · {v.type}</div><div className="text-xs text-ink-500 mt-1 line-clamp-2">{v.reason}</div></div>
      <label className="block"><div className="mb-1 text-ink-600">申诉场景</div><select className="input-qn" value={scene} onChange={e => setScene(e.target.value)}>{['已正常交付，买家已确认', '虚拟商品已在线交付', '物流原因导致延迟（已报备）', '买家恶意投诉', '系统误判'].map(s => <option key={s}>{s}</option>)}</select></label>
      <label className="block"><div className="mb-1 text-ink-600">申诉说明 <span className="text-red-500">*</span></div><textarea className="input-qn h-24 py-2" maxLength={500} value={text} onChange={e => setText(e.target.value)} placeholder="请说明实际交易情况，例如交付时间、交付方式、买家确认情况" /></label>
      <div><div className="mb-1 text-ink-600">申诉凭证 <span className="text-red-500">*</span> <span className="text-ink-400 text-xs">聊天记录、发货/交付截图、物流签收等，最多 6 张</span></div><div className="flex gap-2 flex-wrap">{imgs.map((s, i) => <div key={s} className="relative"><Img src={s} alt="凭证" w={72} h={72} className="w-[72px] h-[72px] rounded border border-ink-100" /><button aria-label="删除凭证" onClick={() => setImgs(imgs.filter((_, j) => j !== i))} className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-ink-700 text-white flex items-center justify-center"><X className="w-3 h-3" /></button></div>)}{imgs.length < 6 && <button onClick={add} disabled={busy} className="w-[72px] h-[72px] rounded border border-dashed border-ink-300 text-ink-400 flex flex-col items-center justify-center text-xs"><ImageIcon className="w-5 h-5" />{busy ? '上传中' : '上传'}</button>}</div></div>
    </div>}
  </Modal>
}
