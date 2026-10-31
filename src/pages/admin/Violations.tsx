// 运营后台 · 违规处罚：对店铺开具违规 / 预警，审核商家申诉
import { useMemo, useState } from 'react'
import { Plus } from 'lucide-react'
import { useDB } from '@/store/db'
import { Img, Modal, PageHeader, Tabs } from '@/components/ui'
import { cls, fmtDate } from '@/lib/format'
import { toast } from '@/store/session'
import { PENALTY } from '@/pages/seller/Health'
import type { Violation } from '@/data/types'

/** 常见违规模板（原因与处罚影响） */
const TEMPLATES: { type: string; level: Violation['level']; points: number; reason: string; impact: string }[] = [
  { type: '延迟发货', level: '一般违规', points: 0, reason: '买家付款后超过 48 小时未发货，且未与买家协商一致或报备。', impact: '需向买家支付该商品实际成交金额 5% 的违约金（最低 5 元，最高 30 元）。' },
  { type: '虚假发货', level: '一般违规', points: 0, reason: '订单显示已发货，但物流无揽收记录或无需物流发货后未实际交付。', impact: '需向买家支付实际成交金额 10% 的违约金；情节严重的扣 3 分。' },
  { type: '消费者保障管理', level: '市场管理', points: 0, reason: '核实到您的店铺涉嫌存在异常风险或交易履约存在异常的订单（商品信息与实际不符、交付方式异常、售后服务无法保障、物流异常或买家未收到货但提前确认收货等情形），可能产生买家钱款损失等交易风险。', impact: '立即自交易成功起账户在途订单交易账期延长持续1080小时;' },
  { type: '描述不符', level: '一般违规', points: 3, reason: '买家收到的商品与宝贝描述不符，影响买家正常使用。', impact: '扣 3 分，相关商品下架整改。' },
  { type: '发布违禁信息', level: '严重违规', points: 12, reason: '发布国家法律法规禁止或平台禁止发布的商品信息。', impact: '扣 12 分，店铺限制发布商品及参加营销活动 7 天，违规商品删除。' },
  { type: '虚假交易', level: '严重违规', points: 12, reason: '通过不正当方式提高商品销量、信用积分或评价。', impact: '扣 12 分，删除虚假交易产生的销量、评价，限制参加营销活动 30 天。' },
  { type: '滥发信息', level: '一般违规', points: 0, reason: '商品标题含广告法极限词或与商品无关的关键词堆砌。', impact: '违规商品搜索降权，整改后恢复。' },
]

export function AdminViolations() {
  const { violations, shops, orders, products, judgeViolation, addViolation } = useDB()
  const [tab, setTab] = useState('reviewing')
  const [q, setQ] = useState('')
  const [creating, setCreating] = useState(false)
  const [judgeOf, setJudgeOf] = useState<Violation | null>(null)
  const counts = { reviewing: violations.filter(v => v.status === 'reviewing').length, pending: violations.filter(v => v.status === 'pending').length }
  const list = useMemo(() => violations.filter(v => (tab === 'all' || (tab === 'warning' ? v.warning : v.status === tab)) && (!q || v.code.includes(q) || v.type.includes(q) || shops.find(s => s.id === v.shopId)?.name.includes(q))).sort((a, b) => b.createdAt.localeCompare(a.createdAt)), [violations, tab, q, shops])
  return (
    <div>
      <PageHeader title="违规处罚" desc="对店铺开具违规或预警，商家在千牛「店铺体检 → 违规管理」查看并申诉，由此处审核。" extra={<button onClick={() => setCreating(true)} className="btn-primary"><Plus className="w-4 h-4" />开具违规</button>} />
      <div className="card p-5">
        <div className="flex items-center gap-3 flex-wrap"><Tabs value={tab} onChange={setTab} items={[{ key: 'reviewing', label: `待审核申诉 (${counts.reviewing})` }, { key: 'pending', label: `待商家处理 (${counts.pending})` }, { key: 'upheld', label: '处罚生效' }, { key: 'revoked', label: '已撤销' }, { key: 'warning', label: '违规预警' }, { key: 'all', label: '全部' }]} /><input aria-label="搜索违规" className="input ml-auto w-64" placeholder="违规编号 / 类型 / 店铺名" value={q} onChange={e => setQ(e.target.value)} /></div>
        <div className="overflow-x-auto"><table className="w-full text-sm mt-4 min-w-[900px]"><thead><tr className="bg-ink-50 text-ink-500 text-left"><th className="px-3 py-2.5 font-medium">违规编号</th><th className="px-3 py-2.5 font-medium">店铺</th><th className="px-3 py-2.5 font-medium">类型</th><th className="px-3 py-2.5 font-medium">严重程度</th><th className="px-3 py-2.5 font-medium">扣分</th><th className="px-3 py-2.5 font-medium">开具时间</th><th className="px-3 py-2.5 font-medium">状态</th><th className="px-3 py-2.5 font-medium">操作</th></tr></thead>
          <tbody>{list.map(v => <tr key={v.id} className="border-b border-ink-100"><td className="px-3 py-3 font-num">{v.code}{v.warning && <span className="tag-gold ml-1">预警</span>}</td><td className="px-3 py-3">{shops.find(s => s.id === v.shopId)?.name}</td><td className="px-3 py-3">{v.type}</td><td className="px-3 py-3">{v.level}</td><td className="px-3 py-3">{v.points ? `-${v.points}` : '无'}</td><td className="px-3 py-3 text-xs font-num">{fmtDate(v.createdAt)}</td><td className="px-3 py-3"><span className={cls('rounded px-1.5 py-0.5 text-xs', PENALTY[v.status].c)}>{v.ignored && v.status === 'pending' ? '商家已忽略' : PENALTY[v.status].l}</span></td><td className="px-3 py-3"><button onClick={() => setJudgeOf(v)} className="link">{v.status === 'reviewing' ? '审核申诉' : '查看'}</button></td></tr>)}</tbody></table></div>
        {list.length === 0 && <div className="py-12 text-center text-ink-400 text-sm">暂无记录</div>}
      </div>
      <CreateModal open={creating} onClose={() => setCreating(false)} onOk={v => { addViolation(v); setCreating(false); toast('违规已开具，商家千牛将收到提醒') }} shops={shops.filter(s => s.status === 'open')} orders={orders} products={products} />
      <Modal open={!!judgeOf} onClose={() => setJudgeOf(null)} title={judgeOf?.status === 'reviewing' ? '审核申诉' : '违规详情'} width={600} footer={judgeOf?.status === 'reviewing' ? <><button className="btn-outline" onClick={() => setJudgeOf(null)}>取消</button><button className="btn-outline text-red-500" onClick={() => { judgeViolation(judgeOf.id, false, '经核实，申诉凭证不足以证明交易真实完成，维持原处罚。'); setJudgeOf(null); toast('已驳回申诉') }}>驳回，维持处罚</button><button className="btn-primary" onClick={() => { judgeViolation(judgeOf.id, true, '经核实，申诉凭证有效，处罚已撤销，受影响订单恢复正常。'); setJudgeOf(null); toast('申诉通过，处罚已撤销') }}>申诉通过，撤销处罚</button></> : undefined}>
        {judgeOf && <div className="space-y-3 text-sm"><div className="grid grid-cols-[80px_1fr] gap-y-2"><span className="text-ink-500">店铺</span><span>{shops.find(s => s.id === judgeOf.shopId)?.name}</span><span className="text-ink-500">违规类型</span><span>{judgeOf.type} · {judgeOf.level} · {judgeOf.points ? `扣 ${judgeOf.points} 分` : '无扣分'}</span><span className="text-ink-500">违规原因</span><span>{judgeOf.reason}</span><span className="text-ink-500">处罚影响</span><span>{judgeOf.impact}</span>{judgeOf.orderIds?.length ? <><span className="text-ink-500">涉及订单</span><span className="font-num text-xs">{judgeOf.orderIds.join('、')}</span></> : null}<span className="text-ink-500">申诉截止</span><span className="font-num">{fmtDate(judgeOf.appealDeadline)}</span></div>
          {judgeOf.appeal ? <div className="rounded-lg bg-amber-50 p-3"><div className="text-xs text-ink-500">商家申诉 · <span className="font-num">{fmtDate(judgeOf.appeal.at)}</span></div><div className="mt-1">{judgeOf.appeal.text}</div><div className="flex gap-2 mt-2 flex-wrap">{judgeOf.appeal.images.map(s => <a key={s} href={s} target="_blank" rel="noreferrer"><Img src={s} alt="申诉凭证" w={80} h={80} className="w-20 h-20 rounded border border-ink-100" /></a>)}</div></div> : <div className="text-ink-400">商家尚未申诉</div>}
          {judgeOf.result && <div className={cls('rounded-lg p-3', judgeOf.result.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-ink-50 text-ink-700')}>审核结果：{judgeOf.result.text}<div className="text-xs mt-1 font-num">{fmtDate(judgeOf.result.at)}</div></div>}
        </div>}
      </Modal>
    </div>
  )
}

function CreateModal({ open, onClose, onOk, shops, orders, products }: { open: boolean; onClose: () => void; onOk: (v: Omit<Violation, 'id' | 'createdAt' | 'status'>) => void; shops: { id: string; name: string }[]; orders: { id: string; shopId: string }[]; products: { id: string; shopId: string; title: string }[] }) {
  const [shopId, setShopId] = useState('')
  const [tpl, setTpl] = useState(0)
  const [form, setForm] = useState({ ...TEMPLATES[0], warning: false, days: 7, orderIds: '', productIds: [] as string[] })
  const sid = shopId || shops[0]?.id
  const pickTpl = (i: number) => { setTpl(i); setForm({ ...form, ...TEMPLATES[i] }) }
  return <Modal open={open} onClose={onClose} title="开具违规" width={620} footer={<><button className="btn-outline" onClick={onClose}>取消</button><button className="btn-primary" onClick={() => { if (!sid || !form.reason.trim()) return toast('请填写完整', 'error'); const ids = form.orderIds.split(/[\s,，]+/).filter(Boolean); onOk({ shopId: sid, code: String(Date.now()).slice(-12), type: form.type, level: form.level, points: Number(form.points) || 0, reason: form.reason, impact: form.impact, warning: form.warning || undefined, orderIds: ids.length ? ids : undefined, productIds: form.productIds.length ? form.productIds : undefined, appealDeadline: new Date(Date.now() + form.days * 864e5).toISOString() }) }}>确认开具</button></>}>
    <div className="grid grid-cols-2 gap-3 text-sm">
      <label className="col-span-2"><div className="mb-1 text-ink-600">店铺</div><select className="input" value={sid} onChange={e => setShopId(e.target.value)}>{shops.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
      <label className="col-span-2"><div className="mb-1 text-ink-600">违规模板</div><select className="input" value={tpl} onChange={e => pickTpl(Number(e.target.value))}>{TEMPLATES.map((t, i) => <option key={t.type} value={i}>{t.type}（{t.level}）</option>)}</select></label>
      <label><div className="mb-1 text-ink-600">违规类型</div><input className="input" value={form.type} onChange={e => setForm({ ...form, type: e.target.value })} /></label>
      <label><div className="mb-1 text-ink-600">严重程度</div><select className="input" value={form.level} onChange={e => setForm({ ...form, level: e.target.value as Violation['level'] })}>{['一般违规', '严重违规', '市场管理'].map(l => <option key={l}>{l}</option>)}</select></label>
      <label><div className="mb-1 text-ink-600">扣分</div><input type="number" min={0} max={48} className="input" value={form.points} onChange={e => setForm({ ...form, points: Number(e.target.value) })} /></label>
      <label><div className="mb-1 text-ink-600">申诉期（天）</div><input type="number" min={1} max={30} className="input" value={form.days} onChange={e => setForm({ ...form, days: Number(e.target.value) })} /></label>
      <label className="col-span-2"><div className="mb-1 text-ink-600">违规原因</div><textarea className="input h-20 py-2" value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })} /></label>
      <label className="col-span-2"><div className="mb-1 text-ink-600">处罚影响</div><textarea className="input h-16 py-2" value={form.impact} onChange={e => setForm({ ...form, impact: e.target.value })} /></label>
      <label className="col-span-2"><div className="mb-1 text-ink-600">涉及订单号（选填，空格分隔）</div><input className="input font-num" value={form.orderIds} onChange={e => setForm({ ...form, orderIds: e.target.value })} placeholder={orders.filter(o => o.shopId === sid).slice(0, 2).map(o => o.id).join(' ')} /></label>
      <label className="col-span-2"><div className="mb-1 text-ink-600">违规宝贝（选填）</div><select multiple className="input h-24 py-1" value={form.productIds} onChange={e => setForm({ ...form, productIds: [...e.target.selectedOptions].map(o => o.value) })}>{products.filter(p => p.shopId === sid).map(p => <option key={p.id} value={p.id}>{p.title}</option>)}</select></label>
      <label className="col-span-2 flex items-center gap-2"><input type="checkbox" checked={form.warning} onChange={e => setForm({ ...form, warning: e.target.checked })} />仅作为违规预警（提醒整改，不处罚不扣分）</label>
    </div>
  </Modal>
}
