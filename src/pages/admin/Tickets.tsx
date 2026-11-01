// 客诉工单：买家投诉 / 咨询由平台小二处理，带 SLA 时效、分派、快捷回复、关联订单与违规开具
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Clock, Send, UserCheck, ShieldAlert, CheckCircle2, Landmark } from 'lucide-react'
import { useDB } from '@/store/db'
import { useCurrentUser } from '@/lib/hooks'
import { Avatar, Empty, Img, PageHeader, SearchInput, Select, Stat, Tabs } from '@/components/ui'
import { cls, fmtDate, money, timeAgo, ORDER_STATUS } from '@/lib/format'
import { toast } from '@/store/session'
import { AdjustModal } from './Funds'
import type { Ticket } from '@/data/types'

export const TICKET_STATUS: Record<Ticket['status'], { l: string; c: string }> = { open: { l: '待受理', c: 'tag-red' }, processing: { l: '处理中', c: 'tag-gold' }, resolved: { l: '已解决', c: 'tag-green' }, closed: { l: '已关闭', c: 'tag-gray' } }
export const PRIORITY: Record<Ticket['priority'], { l: string; c: string; sla: number }> = { urgent: { l: '紧急', c: 'bg-red-500 text-white', sla: 2 }, high: { l: '高', c: 'bg-amber-100 text-amber-700', sla: 12 }, normal: { l: '普通', c: 'bg-ink-100 text-ink-600', sla: 24 } }
export const TICKET_TYPES = ['投诉商家', '商品质量', '物流问题', '退款纠纷', '虚假宣传', '账户安全', '其他']

/** SLA：首次响应时限（小时），返回剩余毫秒（负数为已超时） */
export function slaLeft(t: Ticket, now = Date.now()) { return Date.parse(t.createdAt) + PRIORITY[t.priority].sla * 36e5 - now }

const QUICK = ['您好，平台已受理您的问题，正在联系商家核实，请耐心等待。', '经核实，商家存在违规行为，平台已对其处罚，并为您办理退款。', '已为您补偿平台红包，给您带来的不便深表歉意。', '请提供订单截图 / 物流截图等凭证，便于我们进一步核实。']

export function Tickets() {
  const { tickets, users, shops, orders, adminRoles, replyTicket, updateTicket } = useDB()
  const me = useCurrentUser()
  const [tab, setTab] = useState('active')
  const [q, setQ] = useState('')
  const [pri, setPri] = useState('')
  const [curId, setCurId] = useState<string | null>(null)
  const [text, setText] = useState('')
  const [adjust, setAdjust] = useState<string | null>(null)
  const admins = users.filter(u => u.role === 'admin')
  const now = Date.now()
  const list = useMemo(() => tickets.filter(t => (tab === 'all' || (tab === 'active' ? t.status === 'open' || t.status === 'processing' : tab === 'mine' ? t.assignee === me?.id && t.status !== 'closed' : tab === 'overdue' ? !t.firstReplyAt && slaLeft(t, now) < 0 && t.status === 'open' : t.status === tab)) && (!pri || t.priority === pri) && (!q || t.title.includes(q) || t.content.includes(q) || t.orderId?.includes(q) || t.id.includes(q))).sort((a, b) => (a.status === 'open' ? 0 : 1) - (b.status === 'open' ? 0 : 1) || ['urgent', 'high', 'normal'].indexOf(a.priority) - ['urgent', 'high', 'normal'].indexOf(b.priority) || b.updatedAt.localeCompare(a.updatedAt)), [tickets, tab, pri, q, me?.id, now])
  const cur = tickets.find(t => t.id === curId) ?? list[0]
  const replied = tickets.filter(t => t.firstReplyAt)
  const avgFirst = replied.length ? replied.reduce((a, t) => a + (Date.parse(t.firstReplyAt!) - Date.parse(t.createdAt)), 0) / replied.length / 36e5 : 0
  const onTime = replied.length ? replied.filter(t => Date.parse(t.firstReplyAt!) - Date.parse(t.createdAt) <= PRIORITY[t.priority].sla * 36e5).length / replied.length : 1
  const rated = tickets.filter(t => t.satisfaction)
  const send = (status: Ticket['status'] | null) => {
    if (!cur) return
    if (!text.trim() && status !== 'resolved') return toast('请输入回复内容', 'error')
    replyTicket(cur.id, { by: 'admin', name: `平台小二·${me?.nickname ?? ''}`, text: text.trim() || '问题已解决，如有疑问可继续回复。' }, status)
    if (!cur.assignee) updateTicket(cur.id, { assignee: me?.id })
    setText(''); toast(status === 'resolved' ? '已标记解决' : '已回复')
  }
  const sla = (t: Ticket) => { if (t.firstReplyAt || t.status === 'closed' || t.status === 'resolved') return null; const left = slaLeft(t, now); return <span className={cls('text-[11px] font-num flex items-center gap-0.5', left < 0 ? 'text-red-600' : left < 36e5 ? 'text-amber-600' : 'text-ink-400')}><Clock className="w-3 h-3" />{left < 0 ? `已超时 ${Math.ceil(-left / 36e5)}h` : `剩 ${Math.floor(left / 36e5)}h${Math.floor((left % 36e5) / 6e4)}m`}</span> }
  const order = cur?.orderId ? orders.find(o => o.id === cur.orderId) : undefined
  const buyer = users.find(u => u.id === cur?.userId)
  const shop = shops.find(s => s.id === (cur?.shopId ?? order?.shopId))
  return (
    <div>
      <PageHeader title="客诉工单" desc="买家在「我的投诉」或订单页提交的投诉与求助。按优先级设定首次响应时限（紧急 2h / 高 12h / 普通 24h），超时标红。" />
      <div className="grid grid-cols-5 max-md:!grid-cols-2 gap-3 mb-4"><Stat label="待受理" value={tickets.filter(t => t.status === 'open').length} accent="text-red-600" /><Stat label="处理中" value={tickets.filter(t => t.status === 'processing').length} accent="text-amber-700" /><Stat label="SLA 超时" value={tickets.filter(t => t.status === 'open' && !t.firstReplyAt && slaLeft(t, now) < 0).length} accent="text-red-600" /><Stat label="平均首响" value={`${avgFirst.toFixed(1)}h`} sub={`按时率 ${(onTime * 100).toFixed(0)}%`} /><Stat label="满意度" value={rated.length ? (rated.reduce((a, t) => a + t.satisfaction!, 0) / rated.length).toFixed(1) : '-'} sub={`${rated.length} 人评价`} accent="text-emerald-700" /></div>
      <div className="card grid grid-cols-[360px_1fr] max-lg:!grid-cols-1 min-h-[640px] overflow-hidden">
        <div className="border-r border-ink-100 flex flex-col min-w-0">
          <div className="px-3 pt-2"><Tabs items={[{ key: 'active', label: '待处理' }, { key: 'mine', label: '我的' }, { key: 'overdue', label: '超时' }, { key: 'resolved', label: '已解决' }, { key: 'all', label: '全部' }]} value={tab} onChange={setTab} accent="qn" /></div>
          <div className="p-3 flex gap-2"><SearchInput value={q} onChange={setQ} placeholder="标题 / 内容 / 订单号" className="flex-1" /><Select value={pri} onChange={setPri} options={[{ value: '', label: '优先级' }, ...Object.entries(PRIORITY).map(([v, x]) => ({ value: v, label: x.l }))]} /></div>
          <div className="flex-1 overflow-auto max-lg:max-h-80">{list.map(t => <button key={t.id} onClick={() => setCurId(t.id)} className={cls('w-full text-left px-4 py-3 border-b border-ink-50', cur?.id === t.id ? 'bg-qn-50' : 'hover:bg-ink-50')}><div className="flex items-center gap-1.5"><span className={cls('text-[10px] px-1 rounded', PRIORITY[t.priority].c)}>{PRIORITY[t.priority].l}</span><span className="text-sm font-medium truncate flex-1">{t.title}</span><span className={TICKET_STATUS[t.status].c}>{TICKET_STATUS[t.status].l}</span></div><div className="text-xs text-ink-500 truncate mt-1">{t.type} · {users.find(u => u.id === t.userId)?.nickname}</div><div className="flex items-center justify-between mt-1"><span className="text-[11px] text-ink-400">{timeAgo(t.updatedAt)}</span>{sla(t)}</div></button>)}{list.length === 0 && <Empty text="暂无工单" />}</div>
        </div>
        {cur ? <div className="flex flex-col min-w-0">
          <div className="px-5 py-3 border-b border-ink-100 flex items-center gap-2 flex-wrap"><span className="font-semibold">{cur.title}</span><span className={cls('text-[10px] px-1 rounded', PRIORITY[cur.priority].c)}>{PRIORITY[cur.priority].l}</span><span className={TICKET_STATUS[cur.status].c}>{TICKET_STATUS[cur.status].l}</span>{sla(cur)}<span className="text-xs text-ink-400 font-num ml-auto">#{cur.id}</span></div>
          <div className="px-5 py-2 border-b border-ink-100 flex gap-2 flex-wrap items-center text-xs">
            <UserCheck className="w-3.5 h-3.5 text-ink-400" /><Select value={cur.assignee ?? ''} onChange={v => { updateTicket(cur.id, { assignee: v }); toast('已分派') }} options={[{ value: '', label: '未分派' }, ...admins.map(a => ({ value: a.id, label: `${a.nickname}${a.adminRoleId ? '（' + (adminRoles.find(r => r.id === a.adminRoleId)?.name ?? '') + '）' : ''}` }))]} />
            <Select value={cur.priority} onChange={v => updateTicket(cur.id, { priority: v as Ticket['priority'] })} options={Object.entries(PRIORITY).map(([v, x]) => ({ value: v, label: `优先级：${x.l}` }))} />
            <span className="ml-auto flex gap-2">
              {shop && <Link to={`/admin/violations?shop=${shop.id}`} className="btn-outline btn-sm"><ShieldAlert className="w-3.5 h-3.5" />对商家开违规</Link>}
              {buyer && <button onClick={() => setAdjust(buyer.id)} className="btn-outline btn-sm"><Landmark className="w-3.5 h-3.5" />赔付买家</button>}
              {cur.status !== 'closed' && <button onClick={() => { updateTicket(cur.id, { status: 'closed' }); toast('工单已关闭') }} className="btn-ghost btn-sm">关闭</button>}
            </span>
          </div>
          <div className="grid grid-cols-[1fr_240px] max-xl:!grid-cols-1 flex-1 min-h-0">
            <div className="flex flex-col min-h-0">
              <div className="flex-1 overflow-auto p-5 space-y-4 bg-ink-50/50 max-h-[460px]">
                <div className="flex gap-2"><Avatar src={buyer?.avatar} name="" size={32} /><div className="max-w-xl"><div className="text-xs text-ink-500 mb-1">{buyer?.nickname} · {cur.type} · {fmtDate(cur.createdAt)}</div><div className="bg-white rounded-2xl rounded-tl-sm shadow-card px-3.5 py-2 text-sm whitespace-pre-wrap">{cur.content}</div>{cur.images.length > 0 && <div className="flex gap-2 mt-2">{cur.images.map(s => <a key={s} href={s} target="_blank" rel="noreferrer"><Img src={s} alt="凭证" w={72} h={72} className="w-18 h-18 rounded-lg" /></a>)}</div>}</div></div>
                {cur.replies.map((r, i) => <div key={i} className={cls('flex gap-2', r.by === 'admin' && 'flex-row-reverse')}><div className={cls('w-8 h-8 rounded-full flex items-center justify-center text-xs text-white shrink-0', r.by === 'admin' ? 'bg-qn-500' : r.by === 'system' ? 'bg-ink-400' : r.by === 'shop' ? 'bg-amber-500' : 'bg-brand-500')}>{{ admin: '小二', system: '系统', shop: '商家', user: '买家' }[r.by]}</div><div className="max-w-xl"><div className={cls('text-xs text-ink-500 mb-1', r.by === 'admin' && 'text-right')}>{r.name} · {fmtDate(r.at)}</div><div className={cls('rounded-2xl px-3.5 py-2 text-sm whitespace-pre-wrap', r.by === 'admin' ? 'bg-qn-500 text-white rounded-tr-sm' : 'bg-white shadow-card rounded-tl-sm')}>{r.text}</div></div></div>)}
                {cur.satisfaction && <div className="text-center text-xs text-ink-500">买家评价：{'★'.repeat(cur.satisfaction)}{'☆'.repeat(5 - cur.satisfaction)}</div>}
              </div>
              {cur.status !== 'closed' && <div className="border-t border-ink-100 p-3">
                <div className="flex gap-1.5 mb-2 overflow-x-auto no-scrollbar">{QUICK.map(t => <button key={t} onClick={() => setText(t)} className="tag-blue h-6 px-2 whitespace-nowrap cursor-pointer">{t.slice(0, 14)}…</button>)}</div>
                <textarea aria-label="回复" className="input h-20 py-2" value={text} onChange={e => setText(e.target.value)} placeholder="回复买家（会同步到买家的「我的投诉」）" />
                <div className="flex justify-end gap-2 mt-2"><button onClick={() => send(null)} className="btn-outline btn-sm"><Send className="w-3.5 h-3.5" />回复</button><button onClick={() => send('resolved')} className="btn-qn btn-sm"><CheckCircle2 className="w-3.5 h-3.5" />回复并标记解决</button></div>
              </div>}
            </div>
            <div className="border-l border-ink-100 p-4 text-sm space-y-3 max-xl:border-l-0 max-xl:border-t">
              <div><div className="text-xs text-ink-500 mb-1">买家</div><div className="flex items-center gap-2"><Avatar src={buyer?.avatar} name="" size={28} /><div><div>{buyer?.nickname}</div><div className="text-xs text-ink-400">余额 ¥{money(buyer?.balance ?? 0)} · 工单 {tickets.filter(t => t.userId === cur.userId).length} 个</div></div></div></div>
              {shop && <div><div className="text-xs text-ink-500 mb-1">涉及商家</div><div>{shop.name}</div><div className="text-xs text-ink-400">被投诉 {tickets.filter(t => t.shopId === shop.id).length} 次</div></div>}
              {order ? <div><div className="text-xs text-ink-500 mb-1">关联订单</div><Link to={`/admin/orders?q=${order.id}`} className="link font-num text-xs">{order.id}</Link><div className="flex gap-2 mt-1.5"><Img src={order.items[0].image} alt="" w={40} h={40} className="w-10 h-10 rounded" /><div className="text-xs min-w-0"><div className="line-clamp-2">{order.items[0].title}</div><div className="font-num">¥{money(order.payAmount)} · <span className={ORDER_STATUS[order.status].color}>{ORDER_STATUS[order.status].label}</span></div></div></div>{order.logistics && <div className="text-xs text-ink-500 mt-1">{order.logistics.company} {order.logistics.no}<div className="text-ink-400">{order.logistics.traces.at(-1)?.text}</div></div>}</div> : <div className="text-xs text-ink-400">未关联订单</div>}
            </div>
          </div>
        </div> : <div className="flex items-center justify-center"><Empty text="选择左侧工单开始处理" /></div>}
      </div>
      <AdjustModal userId={adjust} onClose={() => setAdjust(null)} />
    </div>
  )
}
