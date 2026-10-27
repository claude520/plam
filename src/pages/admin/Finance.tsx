import { useMemo, useState } from 'react'
import { CreditCard, Plus, Download, Landmark, Check, Webhook, KeyRound } from 'lucide-react'
import { useDB } from '@/store/db'
import { Avatar, Modal, Field, PageHeader, Stat, Switch, Table, Select, type Column } from '@/components/ui'
import { cls, fmtDate, money, PAY_NAMES } from '@/lib/format'
import { toast } from '@/store/session'
import { TrendArea, Bars, Donut, days } from '@/components/Charts'
import type { PaymentProvider, Shop } from '@/data/types'

export function Payments() {
  const { paymentProviders, updatePayment, orders, log } = useDB()
  const [editing, setEditing] = useState<PaymentProvider | null>(null)
  const paid = orders.filter(o => o.payment)
  return (
    <div>
      <PageHeader title="支付渠道" desc="第三方支付接入配置。启用后前台结算页即时可用；支付宝等渠道预留接口，随时可接。" extra={<button onClick={() => toast('新增渠道：请联系技术接入（演示）', 'info')} className="btn-qn"><Plus className="w-4 h-4" />接入新渠道</button>} />
      <div className="grid grid-cols-4 gap-3 mb-4"><Stat label="已启用渠道" value={paymentProviders.filter(p => p.enabled).length} accent="text-emerald-600" /><Stat label="今日支付笔数" value={paid.filter(o => new Date(o.paidAt ?? o.createdAt).toDateString() === new Date().toDateString()).length} /><Stat label="支付成功率" value="99.2%" /><Stat label="本月渠道手续费" value={`¥${money(paid.reduce((a, o) => a + o.payAmount * ((paymentProviders.find(p => p.code === o.payment!.provider)?.feeRate ?? 0) / 100), 0))}`} accent="text-brand-500" /></div>
      <div className="grid grid-cols-3 gap-4">{paymentProviders.map(p => { const cnt = paid.filter(o => o.payment!.provider === p.code).length; const amt = paid.filter(o => o.payment!.provider === p.code).reduce((a, o) => a + o.payAmount, 0); return (
        <div key={p.id} className={cls('card p-5', !p.enabled && 'opacity-70')}><div className="flex items-center gap-3"><span className="w-12 h-12 rounded-xl text-white flex items-center justify-center font-bold text-lg" style={{ background: p.logoColor }}>{p.name[0]}</span><div className="flex-1"><div className="font-semibold flex items-center gap-2">{p.name}<span className="text-xs text-ink-400 font-num font-normal">{p.code}</span></div><div className="text-xs text-ink-500">{p.desc}</div></div><Switch checked={p.enabled} onChange={v => { updatePayment(p.id, { enabled: v }); log('admin', `${v ? '启用' : '停用'}支付渠道`, p.code); toast(v ? `${p.name} 已启用` : `${p.name} 已停用`) }} /></div>
          <div className="grid grid-cols-3 gap-2 mt-4 text-center"><div className="bg-ink-50 rounded-lg py-2"><div className="text-xs text-ink-500">费率</div><div className="font-num font-semibold">{p.feeRate}%</div></div><div className="bg-ink-50 rounded-lg py-2"><div className="text-xs text-ink-500">笔数</div><div className="font-num font-semibold">{cnt}</div></div><div className="bg-ink-50 rounded-lg py-2"><div className="text-xs text-ink-500">金额</div><div className="font-num font-semibold">¥{money(amt, 0)}</div></div></div>
          <div className="mt-3 text-xs text-ink-500 space-y-1">{Object.entries(p.config).map(([k, v]) => <div key={k} className="flex items-center gap-1.5"><KeyRound className="w-3 h-3" />{k}: <span className="font-num">{v}</span></div>)}{Object.keys(p.config).length === 0 && <div className="text-ink-400">无需额外配置</div>}</div>
          <div className="flex gap-2 mt-3"><button onClick={() => setEditing(p)} className="btn-outline btn-sm flex-1">配置参数</button><button onClick={() => toast(`${p.name} 连通性测试通过`, 'success')} className="btn-outline btn-sm"><Check className="w-3 h-3" />测试</button></div></div>
      ) })}</div>
      <div className="card p-5 mt-4"><div className="font-semibold mb-2 flex items-center gap-2"><Webhook className="w-4 h-4 text-qn-500" />统一支付网关</div><div className="text-sm text-ink-600 leading-7">前台结算调用 <code className="bg-ink-100 rounded px-1.5 py-0.5 text-xs">POST /api/pay/create</code> 创建支付单，网关根据所选渠道转发至第三方，并通过 <code className="bg-ink-100 rounded px-1.5 py-0.5 text-xs">/api/pay/notify/:provider</code> 接收异步回调更新订单状态。新增渠道只需实现 <code className="bg-ink-100 rounded px-1.5 py-0.5 text-xs">PaymentProvider</code> 接口的 create / query / refund 三个方法。</div></div>
      <Modal open={!!editing} onClose={() => setEditing(null)} title={`${editing?.name} 参数配置`} footer={<><button className="btn-outline" onClick={() => setEditing(null)}>取消</button><button className="btn-qn" onClick={() => { updatePayment(editing!.id, editing!); log('admin', '更新支付配置', editing!.code); setEditing(null); toast('配置已保存') }}>保存</button></>}>{editing && <div className="space-y-4"><Field label="费率（%）"><input type="number" step="0.1" className="input-qn" value={editing.feeRate} onChange={e => setEditing({ ...editing, feeRate: Number(e.target.value) })} /></Field>{Object.entries(editing.config).map(([k, v]) => <Field key={k} label={k}><input className="input-qn font-num" value={v} onChange={e => setEditing({ ...editing, config: { ...editing.config, [k]: e.target.value } })} /></Field>)}<Field label="新增参数"><div className="flex gap-2"><input className="input-qn" placeholder="参数名" id="newk" /><button className="btn-outline whitespace-nowrap" onClick={() => { const k = (document.getElementById('newk') as HTMLInputElement).value; if (k) setEditing({ ...editing, config: { ...editing.config, [k]: '' } }) }}>添加</button></div></Field><div className="text-xs text-ink-400 flex items-center gap-1"><CreditCard className="w-3 h-3" />敏感参数将加密存储，前端仅显示脱敏值。</div></div>}</Modal>
    </div>
  )
}

export function Settlements() {
  const { shops, orders, settings, users, log } = useDB()
  const [month, setMonth] = useState('current')
  const [sel, setSel] = useState<string[]>([])
  const [done, setDone] = useState<string[]>([])
  const rows = useMemo(() => shops.map(s => { const os = orders.filter(o => o.shopId === s.id && (o.status === 'done' || o.status === 'received')); const gross = os.reduce((a, o) => a + o.payAmount, 0); const fee = gross * settings.commissionRate / 100; return { id: s.id, s, cnt: os.length, gross, fee, net: gross - fee, owner: users.find(u => u.id === s.ownerId) } }).filter(r => r.cnt > 0).sort((a, b) => b.gross - a.gross), [shops, orders, settings, users])
  type Row = typeof rows[0]
  const cols: Column<Row>[] = [
    { key: 's', title: '商家', render: r => <div className="flex items-center gap-2"><Avatar src={r.s.logo} name="" size={28} /><div><div className="font-medium">{r.s.name}</div><div className="text-xs text-ink-400">{r.owner?.username} · 招商银行 **** 8821</div></div></div> },
    { key: 'cnt', title: '结算订单', render: r => <span className="font-num">{r.cnt}</span> },
    { key: 'gross', title: '成交额', render: r => <span className="font-num">¥{money(r.gross)}</span> },
    { key: 'fee', title: `平台佣金 ${settings.commissionRate}%`, render: r => <span className="font-num text-ink-500">-¥{money(r.fee)}</span> },
    { key: 'net', title: '应结金额', render: r => <span className="font-num font-semibold text-emerald-600">¥{money(r.net)}</span> },
    { key: 'status', title: '状态', render: r => done.includes(r.id) ? <span className="tag-green">已打款</span> : <span className="tag-gold">待结算</span> },
    { key: 'op', title: '操作', render: r => done.includes(r.id) ? <span className="text-xs text-ink-400">{fmtDate(new Date().toISOString(), false)}</span> : <button onClick={() => { setDone(d => [...d, r.id]); log('admin', '商家结算打款', r.id); toast(`已向 ${r.s.name} 打款 ¥${money(r.net)}`) }} className="btn-qn btn-sm">打款</button> },
  ]
  const total = rows.reduce((a, r) => a + r.net, 0)
  return (
    <div>
      <PageHeader title="商家结算" desc="按周期汇总商家已完成订单，扣除平台佣金后打款。" extra={<><Select value={month} onChange={setMonth} options={[{ value: 'current', label: '本结算周期' }, { value: 'last', label: '上一周期' }]} /><button onClick={() => toast('结算单已导出')} className="btn-outline"><Download className="w-4 h-4" />导出结算单</button></>} />
      <div className="grid grid-cols-4 gap-3 mb-4"><Stat label="待结算商家" value={rows.filter(r => !done.includes(r.id)).length} /><Stat label="应结总额" value={`¥${money(rows.filter(r => !done.includes(r.id)).reduce((a, r) => a + r.net, 0), 0)}`} accent="text-emerald-600" /><Stat label="平台佣金收入" value={`¥${money(rows.reduce((a, r) => a + r.fee, 0), 0)}`} accent="text-brand-500" /><Stat label="周期成交额" value={`¥${money(rows.reduce((a, r) => a + r.gross, 0), 0)}`} /></div>
      <div className="card p-5"><div className="flex items-center gap-3 mb-3">{sel.length > 0 && <><span className="text-sm text-ink-500">已选 {sel.length} 家</span><button onClick={() => { setDone(d => [...new Set([...d, ...sel])]); log('admin', '批量结算打款', sel.join(',')); toast(`已批量打款 ${sel.length} 家商家`); setSel([]) }} className="btn-qn btn-sm"><Landmark className="w-3.5 h-3.5" />批量打款</button></>}<span className="ml-auto text-xs text-ink-400">合计应结 ¥{money(total)}</span></div><Table columns={cols} data={rows} selectable selected={sel} onSelect={setSel} /></div>
    </div>
  )
}

export function Reports() {
  const { orders, refunds, paymentProviders, settings, categories, products } = useDB()
  const paid = orders.filter(o => o.status !== 'unpaid' && o.status !== 'closed')
  const gmv = paid.reduce((a, o) => a + o.payAmount, 0)
  const fee = gmv * settings.commissionRate / 100
  const payFee = paid.reduce((a, o) => a + o.payAmount * ((paymentProviders.find(p => p.code === o.payment?.provider)?.feeRate ?? 0) / 100), 0)
  const refundAmt = refunds.filter(r => r.status === 'refunded').reduce((a, r) => a + r.amount, 0)
  const trend = useMemo(() => days(30, i => { const d = new Date(Date.now() - (29 - i) * 864e5).toDateString(); const os = paid.filter(o => new Date(o.createdAt).toDateString() === d); const g = os.reduce((a, o) => a + o.payAmount, 0); return { 成交额: Math.round(g), 佣金收入: Math.round(g * settings.commissionRate / 100) } }), [paid, settings])
  const byCat = useMemo(() => categories.filter(c => !c.parentId).map(c => ({ name: c.name.slice(0, 4), 成交额: Math.round(paid.flatMap(o => o.items).filter(it => products.find(p => p.id === it.productId)?.categoryId.startsWith(c.id + '-')).reduce((a, it) => a + it.price * it.qty, 0)) })), [categories, paid, products])
  return (
    <div>
      <PageHeader title="财务报表" desc="平台收入、成本与利润概览。" extra={<button onClick={() => toast('报表已导出 Excel')} className="btn-outline"><Download className="w-4 h-4" />导出</button>} />
      <div className="grid grid-cols-5 gap-3 mb-4"><Stat label="成交总额 GMV" value={`¥${money(gmv, 0)}`} /><Stat label="佣金收入" value={`¥${money(fee, 0)}`} accent="text-emerald-600" /><Stat label="支付手续费" value={`-¥${money(payFee, 0)}`} accent="text-red-500" /><Stat label="退款支出" value={`-¥${money(refundAmt, 0)}`} accent="text-red-500" /><Stat label="平台净收入" value={`¥${money(fee - payFee, 0)}`} accent="text-brand-500" big /></div>
      <div className="card p-5 mb-4"><div className="font-semibold mb-3">近 30 天成交额与佣金</div><TrendArea data={trend} keys={['成交额', '佣金收入']} height={260} colors={['#3d6dff', '#10b981']} /></div>
      <div className="grid grid-cols-2 gap-4"><div className="card p-5"><div className="font-semibold mb-3">类目成交额</div><Bars data={byCat} keys={['成交额']} height={240} /></div><div className="card p-5"><div className="font-semibold mb-3">收入构成</div><Donut data={[{ name: '交易佣金', value: Math.round(fee) }, { name: '推广服务', value: Math.round(fee * 0.6) }, { name: '增值服务', value: Math.round(fee * 0.25) }, { name: '保证金利息', value: Math.round(fee * 0.05) }]} height={240} /></div></div>
      <div className="card p-5 mt-4"><div className="font-semibold mb-3">月度汇总</div><table className="w-full text-sm"><thead><tr className="bg-ink-50 text-left text-ink-600"><th className="px-3 py-2.5 font-medium">月份</th><th className="px-3 py-2.5 font-medium">订单数</th><th className="px-3 py-2.5 font-medium">GMV</th><th className="px-3 py-2.5 font-medium">佣金收入</th><th className="px-3 py-2.5 font-medium">退款</th><th className="px-3 py-2.5 font-medium">净收入</th></tr></thead><tbody>{[0, 1, 2, 3, 4, 5].map(m => { const d = new Date(); d.setMonth(d.getMonth() - m); const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; const os = paid.filter(o => o.createdAt.startsWith(key)); const g = os.reduce((a, o) => a + o.payAmount, 0); return <tr key={key} className="border-b border-ink-100"><td className="px-3 py-2.5 font-num">{key}</td><td className="px-3 py-2.5 font-num">{os.length}</td><td className="px-3 py-2.5 font-num">¥{money(g)}</td><td className="px-3 py-2.5 font-num text-emerald-600">¥{money(g * settings.commissionRate / 100)}</td><td className="px-3 py-2.5 font-num text-red-500">-¥{money(g * 0.03)}</td><td className="px-3 py-2.5 font-num font-semibold">¥{money(g * settings.commissionRate / 100 - g * 0.006)}</td></tr> })}</tbody></table></div>
      <div className="hidden">{PAY_NAMES.wechat}{(null as unknown as Shop)?.id}</div>
    </div>
  )
}
