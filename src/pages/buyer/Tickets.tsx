// 我的投诉：买家向平台提交投诉 / 求助，与平台小二对话，解决后评价满意度
import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Plus, Send, Star, MessageSquareWarning } from 'lucide-react'
import { useDB } from '@/store/db'
import { useCurrentUser } from '@/lib/hooks'
import { Empty, Field, Modal, Select } from '@/components/ui'
import { cls, fmtDate, timeAgo } from '@/lib/format'
import { toast } from '@/store/session'
import { TICKET_STATUS, TICKET_TYPES } from '@/pages/admin/Tickets'

export function MyTickets() {
  const user = useCurrentUser()!
  const [sp, setSp] = useSearchParams()
  const { tickets, orders, shops, createTicket, replyTicket, updateTicket } = useDB()
  const mine = tickets.filter(t => t.userId === user.id)
  const [cur, setCur] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({ type: TICKET_TYPES[0], orderId: '', title: '', content: '' })
  const [text, setText] = useState('')
  // 从订单页「投诉」进入时自动打开表单并带上订单
  useEffect(() => { const oid = sp.get('order'); if (oid) { setForm(f => ({ ...f, orderId: oid, title: f.title || '订单问题投诉' })); setCreating(true) } }, [sp])
  const t = mine.find(x => x.id === cur) ?? mine[0]
  const myOrders = orders.filter(o => o.userId === user.id).slice(0, 30)
  const submit = () => {
    if (!form.title.trim() || form.content.trim().length < 10) return toast('请填写标题，问题描述不少于 10 个字', 'error')
    const o = orders.find(x => x.id === form.orderId)
    createTicket({ userId: user.id, shopId: o?.shopId, orderId: form.orderId || undefined, type: form.type, title: form.title.trim(), content: form.content.trim(), images: [] })
    setCreating(false); setForm({ type: TICKET_TYPES[0], orderId: '', title: '', content: '' }); setSp({}); setCur(null)
    toast('投诉已提交，平台小二会尽快处理')
  }
  return (
    <div className="card overflow-hidden">
      <div className="px-5 h-14 border-b border-ink-100 flex items-center gap-2"><MessageSquareWarning className="w-5 h-5 text-brand-500" /><span className="font-semibold">我的投诉</span><span className="text-xs text-ink-400">平台小二介入处理商家纠纷、物流异常、账户安全等问题</span><button onClick={() => setCreating(true)} className="btn-primary btn-sm ml-auto"><Plus className="w-4 h-4" />发起投诉</button></div>
      {mine.length === 0 ? <div className="py-16"><Empty text="暂无投诉记录" /></div> : <div className="grid grid-cols-[280px_1fr] max-md:!grid-cols-1 min-h-[520px]">
        <div className="border-r border-ink-100 max-md:border-r-0 max-md:border-b max-md:max-h-56 overflow-auto">{mine.map(x => <button key={x.id} onClick={() => setCur(x.id)} className={cls('w-full text-left px-4 py-3 border-b border-ink-50', t?.id === x.id ? 'bg-brand-50' : 'hover:bg-ink-50')}><div className="flex items-center gap-2"><span className="text-sm font-medium truncate flex-1">{x.title}</span><span className={TICKET_STATUS[x.status].c}>{TICKET_STATUS[x.status].l}</span></div><div className="text-xs text-ink-400 mt-1">{x.type} · {timeAgo(x.updatedAt)}</div></button>)}</div>
        {t && <div className="flex flex-col">
          <div className="px-5 py-3 border-b border-ink-100 text-sm"><div className="font-medium">{t.title}</div><div className="text-xs text-ink-400 mt-0.5">{t.type}{t.orderId && ` · 订单 ${t.orderId}`}{t.shopId && ` · ${shops.find(s => s.id === t.shopId)?.name}`} · {fmtDate(t.createdAt)}</div></div>
          <div className="flex-1 overflow-auto p-5 space-y-4 bg-ink-50/50 max-h-[420px]">
            <div className="flex justify-end"><div className="max-w-md bg-brand-500 text-white rounded-2xl rounded-tr-sm px-3.5 py-2 text-sm whitespace-pre-wrap">{t.content}</div></div>
            {t.replies.map((r, i) => <div key={i} className={cls('flex', r.by === 'user' ? 'justify-end' : '')}><div className="max-w-md"><div className={cls('text-[11px] text-ink-400 mb-1', r.by === 'user' && 'text-right')}>{r.by === 'user' ? '我' : r.name} · {timeAgo(r.at)}</div><div className={cls('rounded-2xl px-3.5 py-2 text-sm whitespace-pre-wrap', r.by === 'user' ? 'bg-brand-500 text-white rounded-tr-sm' : 'bg-white shadow-card rounded-tl-sm')}>{r.text}</div></div></div>)}
          </div>
          {t.status === 'resolved' && !t.satisfaction && <div className="px-5 py-3 border-t border-ink-100 flex items-center gap-2 text-sm bg-amber-50"><span>问题已解决，请评价本次处理：</span>{[1, 2, 3, 4, 5].map(n => <button key={n} aria-label={`${n} 星`} onClick={() => { updateTicket(t.id, { satisfaction: n }); toast('感谢您的评价') }}><Star className="w-5 h-5 text-amber-400 hover:fill-amber-400" /></button>)}</div>}
          {t.status !== 'closed' && <form onSubmit={e => { e.preventDefault(); if (!text.trim()) return; replyTicket(t.id, { by: 'user', name: user.nickname, text: text.trim() }, null); setText('') }} className="p-3 border-t border-ink-100 flex gap-2"><input aria-label="补充说明" className="input" value={text} onChange={e => setText(e.target.value)} placeholder="补充说明或回复小二…" /><button className="btn-primary" type="submit"><Send className="w-4 h-4" />发送</button></form>}
        </div>}
      </div>}
      <Modal open={creating} onClose={() => { setCreating(false); setSp({}) }} title="发起投诉" width={540} footer={<><button className="btn-outline" onClick={() => { setCreating(false); setSp({}) }}>取消</button><button className="btn-primary" onClick={submit}>提交</button></>}>
        <div className="space-y-3 text-sm">
          <Field label="投诉类型"><Select value={form.type} onChange={v => setForm({ ...form, type: v })} accent="brand" options={TICKET_TYPES.map(x => ({ value: x, label: x }))} /></Field>
          <Field label="关联订单（选填）"><Select value={form.orderId} onChange={v => setForm({ ...form, orderId: v })} accent="brand" options={[{ value: '', label: '不关联订单' }, ...myOrders.map(o => ({ value: o.id, label: `${o.id} · ${o.items[0].title.slice(0, 18)}` }))]} /></Field>
          <Field label="标题"><input className="input" maxLength={40} value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="一句话描述问题" /></Field>
          <Field label="问题描述"><textarea className="input h-28 py-2" maxLength={1000} value={form.content} onChange={e => setForm({ ...form, content: e.target.value })} placeholder="请详细描述经过、与商家沟通情况及您的诉求（不少于 10 字）" /></Field>
        </div>
      </Modal>
    </div>
  )
}
