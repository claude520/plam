// 规则中心：交易自动化规则的参数配置、待触发预览与手动执行
import { useMemo, useState } from 'react'
import { Play, Timer, Save } from 'lucide-react'
import { useDB } from '@/store/db'
import { PageHeader, Stat } from '@/components/ui'
import { fmtDate, timeAgo } from '@/lib/format'
import { toast } from '@/store/session'

export function Rules() {
  const { orders, refunds, coupons, violations, tickets, settings, auditLogs, updateSettings, runSchedules, log } = useDB()
  const [form, setForm] = useState({ unpaidCloseHours: settings.unpaidCloseHours ?? 24, autoConfirmDays: settings.autoConfirmDays, refundAutoHours: settings.refundAutoHours ?? 48, withdrawMin: settings.withdrawMin ?? 100, commissionRate: settings.commissionRate })
  const now = Date.now()
  // 按当前（未保存的）参数预览下次执行会处理的数量
  const preview = useMemo(() => ({
    unpaid: orders.filter(o => o.status === 'unpaid' && now - Date.parse(o.createdAt) > form.unpaidCloseHours * 36e5).length,
    confirm: orders.filter(o => o.status === 'shipped' && o.shippedAt && now - Date.parse(o.shippedAt) > form.autoConfirmDays * 864e5).length,
    refund: refunds.filter(r => r.status === 'pending' && now - Date.parse(r.createdAt) > form.refundAutoHours * 36e5).length,
    coupon: coupons.filter(c => c.status === 'active' && Date.parse(c.endAt) < now).length,
    violation: violations.filter(v => v.status === 'pending' && !v.warning && Date.parse(v.appealDeadline) < now).length,
    ticket: tickets.filter(t => t.status === 'resolved' && now - Date.parse(t.updatedAt) > 7 * 864e5).length,
  }), [orders, refunds, coupons, violations, tickets, form, now])
  const rules: { k: keyof typeof preview; t: string; d: string; field?: [keyof typeof form, string, number, number] }[] = [
    { k: 'unpaid', t: '超时未付款自动关单', d: '买家下单后超过时限未付款，订单自动关闭（库存在付款时才扣减，无需回补）。', field: ['unpaidCloseHours', '小时', 1, 168] },
    { k: 'confirm', t: '自动确认收货并结算', d: '商家发货后超过时限买家未确认，系统自动确认收货，担保货款扣佣后结算给商家。', field: ['autoConfirmDays', '天', 1, 30] },
    { k: 'refund', t: '售后超时自动同意', d: '商家超过时限未处理售后申请：仅退款直接退款给买家；退货退款进入「同意退货」。', field: ['refundAutoHours', '小时', 12, 168] },
    { k: 'coupon', t: '优惠券到期自动失效', d: '超过有效期的优惠券自动置为已过期。' },
    { k: 'violation', t: '申诉期满处罚生效', d: '商家在申诉截止前未申诉的违规，自动转为「处罚生效」。' },
    { k: 'ticket', t: '工单自动关闭', d: '已解决 7 天且买家无追问的工单自动关闭。' },
  ]
  const history = auditLogs.filter(l => l.actor === 'system' && l.target === 'schedules').slice(0, 10)
  const dirty = form.unpaidCloseHours !== (settings.unpaidCloseHours ?? 24) || form.autoConfirmDays !== settings.autoConfirmDays || form.refundAutoHours !== (settings.refundAutoHours ?? 48) || form.withdrawMin !== (settings.withdrawMin ?? 100) || form.commissionRate !== settings.commissionRate
  const save = () => { updateSettings(form); log('admin', '修改交易规则', JSON.stringify(form)); toast('规则已保存，下次执行生效') }
  const run = () => { if (dirty) save(); runSchedules(); toast('已执行一次自动规则') }
  return (
    <div>
      <PageHeader title="规则中心" desc="交易自动化规则由服务端定时执行（每 5 分钟随访问触发一次），也可在此手动执行。执行结果写入操作日志。" extra={<div className="flex gap-2">{dirty && <button onClick={save} className="btn-outline"><Save className="w-4 h-4" />保存参数</button>}<button onClick={run} className="btn-qn"><Play className="w-4 h-4" />立即执行</button></div>} />
      <div className="grid grid-cols-4 max-md:!grid-cols-2 gap-3 mb-4">
        <Stat label="上次执行" value={settings.lastSweepAt ? timeAgo(settings.lastSweepAt) : '从未'} sub={settings.lastSweepAt ? fmtDate(settings.lastSweepAt) : undefined} />
        <Stat label="上次处理" value={settings.lastSweepReport?.length ? settings.lastSweepReport.length + ' 项' : '无待处理'} sub={settings.lastSweepReport?.join('；') || '—'} />
        <Stat label="下次待处理" value={Object.values(preview).reduce((a, b) => a + b, 0)} accent="text-amber-700" />
        <Stat label="佣金 / 最低提现" value={`${form.commissionRate}% / ¥${form.withdrawMin}`} />
      </div>
      <div className="grid grid-cols-[1fr_340px] max-lg:!grid-cols-1 gap-4 items-start">
        <div className="card divide-y divide-ink-100">
          {rules.map(r => <div key={r.k} className="p-5 flex gap-4 items-center flex-wrap"><Timer className="w-5 h-5 text-qn-500 shrink-0" /><div className="flex-1 min-w-[220px]"><div className="font-medium">{r.t}</div><div className="text-xs text-ink-500 mt-0.5">{r.d}</div></div>{r.field && <label className="flex items-center gap-1.5 text-sm">时限<input type="number" aria-label={r.t} min={r.field[2]} max={r.field[3]} className="input w-20 h-8" value={form[r.field[0]]} onChange={e => setForm({ ...form, [r.field![0]]: Math.max(r.field![2], Math.min(r.field![3], Number(e.target.value) || r.field![2])) })} />{r.field[1]}</label>}<span className={preview[r.k] ? 'tag-gold' : 'tag-gray'}>待处理 {preview[r.k]}</span></div>)}
          <div className="p-5 flex gap-4 items-center flex-wrap"><Timer className="w-5 h-5 text-qn-500 shrink-0" /><div className="flex-1 min-w-[220px]"><div className="font-medium">结算与提现参数</div><div className="text-xs text-ink-500 mt-0.5">平台佣金在每笔订单结算时扣除；商家单次提现不得低于最低金额。</div></div><label className="flex items-center gap-1.5 text-sm">佣金<input type="number" aria-label="佣金比例" min={0} max={30} step="0.5" className="input w-20 h-8" value={form.commissionRate} onChange={e => setForm({ ...form, commissionRate: Math.max(0, Math.min(30, Number(e.target.value))) })} />%</label><label className="flex items-center gap-1.5 text-sm">最低提现<input type="number" aria-label="最低提现" min={1} className="input w-24 h-8" value={form.withdrawMin} onChange={e => setForm({ ...form, withdrawMin: Math.max(1, Number(e.target.value)) })} />元</label></div>
        </div>
        <div className="card p-5"><div className="font-semibold mb-3">执行记录</div>{history.length ? <div className="space-y-3">{history.map(h => <div key={h.id} className="text-sm border-l-2 border-qn-400 pl-3"><div className="text-xs text-ink-400 font-num">{fmtDate(h.time)}</div><div className="text-ink-700">{h.action.replace('自动规则：', '')}</div></div>)}</div> : <div className="text-sm text-ink-400">暂无执行记录（没有需要处理的数据时不记录）</div>}</div>
      </div>
    </div>
  )
}
