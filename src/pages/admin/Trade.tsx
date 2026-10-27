import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Download, Eye, Gavel, Trash2, Star } from 'lucide-react'
import { useDB } from '@/store/db'
import { Avatar, Img, Modal, PageHeader, SearchInput, Select, Stat, Table, Tabs, Rating, type Column } from '@/components/ui'
import { cls, fmtDate, money, ORDER_STATUS, PAY_NAMES, REFUND_STATUS } from '@/lib/format'
import { toast } from '@/store/session'
import type { Order, Refund, Review } from '@/data/types'

export function Orders() {
  const [sp] = useSearchParams()
  const { orders, users, shops, setOrderStatus, log } = useDB()
  const [tab, setTab] = useState('all')
  const [q, setQ] = useState(sp.get('q') ?? '')
  const [pay, setPay] = useState('')
  const [detail, setDetail] = useState<Order | null>(null)
  const list = useMemo(() => orders.filter(o => (tab === 'all' || o.status === tab) && (!pay || o.payment?.provider === pay) && (!q || o.id.includes(q) || o.items.some(i => i.title.includes(q)) || users.find(u => u.id === o.userId)?.nickname.includes(q))).sort((a, b) => b.createdAt.localeCompare(a.createdAt)), [orders, tab, q, pay, users])
  const paid = orders.filter(o => o.status !== 'unpaid' && o.status !== 'closed')
  const cols: Column<Order>[] = [
    { key: 'id', title: '订单号', render: o => <div><div className="font-num text-xs">{o.id}</div><div className="text-xs text-ink-400">{fmtDate(o.createdAt)}</div></div> },
    { key: 'items', title: '商品', render: o => <div className="flex gap-2 items-center"><Img src={o.items[0].image} alt="" w={40} h={40} className="w-10 h-10 rounded" /><div className="text-xs max-w-[220px]"><div className="line-clamp-1">{o.items[0].title}</div>{o.items.length > 1 && <div className="text-ink-400">等 {o.items.length} 件</div>}</div></div> },
    { key: 'user', title: '买家', render: o => <div className="flex items-center gap-1.5 text-xs"><Avatar src={users.find(u => u.id === o.userId)?.avatar} name="" size={20} />{users.find(u => u.id === o.userId)?.nickname}</div> },
    { key: 'shop', title: '店铺', render: o => <span className="text-xs">{shops.find(s => s.id === o.shopId)?.name}</span> },
    { key: 'amount', title: '实付', render: o => <span className="font-num font-medium">¥{money(o.payAmount)}</span> },
    { key: 'pay', title: '支付', render: o => <span className="text-xs">{o.payment ? PAY_NAMES[o.payment.provider] : '-'}</span> },
    { key: 'status', title: '状态', render: o => <span className={cls('text-xs font-medium', ORDER_STATUS[o.status].color)}>{ORDER_STATUS[o.status].label}</span> },
    { key: 'op', title: '操作', render: o => <div className="flex gap-2 text-xs"><button onClick={() => setDetail(o)} className="link flex items-center gap-0.5"><Eye className="w-3 h-3" />详情</button>{(o.status === 'unpaid' || o.status === 'paid') && <button onClick={() => { setOrderStatus(o.id, 'closed'); log('admin', '关闭订单', o.id); toast('订单已关闭') }} className="link text-red-600">关闭</button>}</div> },
  ]
  return (
    <div>
      <PageHeader title="订单管理" desc="平台全量订单查询、关闭与异常处理。" extra={<button onClick={() => toast(`已导出 ${list.length} 笔订单`)} className="btn-outline"><Download className="w-4 h-4" />导出</button>} />
      <div className="grid grid-cols-5 gap-3 mb-4"><Stat label="订单总数" value={orders.length} /><Stat label="成交额" value={`¥${money(paid.reduce((a, o) => a + o.payAmount, 0), 0)}`} accent="text-brand-500" /><Stat label="客单价" value={`¥${money(paid.length ? paid.reduce((a, o) => a + o.payAmount, 0) / paid.length : 0)}`} /><Stat label="待发货" value={orders.filter(o => o.status === 'paid').length} accent="text-qn-600" /><Stat label="退款中" value={orders.filter(o => o.status === 'refunding').length} accent="text-amber-700" /></div>
      <div className="card"><div className="px-5"><Tabs items={[{ key: 'all', label: '全部' }, { key: 'unpaid', label: '待付款' }, { key: 'paid', label: '待发货' }, { key: 'shipped', label: '已发货' }, { key: 'done', label: '已完成' }, { key: 'refunding', label: '退款中' }, { key: 'closed', label: '已关闭' }]} value={tab} onChange={setTab} accent="qn" /></div><div className="px-5 py-3 flex gap-2"><SearchInput value={q} onChange={setQ} placeholder="订单号 / 商品 / 买家" className="w-72" /><Select value={pay} onChange={setPay} options={[{ value: '', label: '全部支付方式' }, ...Object.entries(PAY_NAMES).map(([v, l]) => ({ value: v, label: l }))]} /></div><div className="px-5 pb-5"><Table columns={cols} data={list} pageSize={12} /></div></div>
      <Modal open={!!detail} onClose={() => setDetail(null)} title="订单详情" width={680}>{detail && <div className="text-sm space-y-4"><div className="grid grid-cols-2 gap-y-1.5 text-ink-600"><div>订单号：<span className="font-num text-ink-900">{detail.id}</span></div><div>状态：<span className={ORDER_STATUS[detail.status].color}>{ORDER_STATUS[detail.status].label}</span></div><div>买家：{users.find(u => u.id === detail.userId)?.nickname}</div><div>店铺：{shops.find(s => s.id === detail.shopId)?.name}</div><div>创建：{fmtDate(detail.createdAt)}</div>{detail.payment && <div>支付：{PAY_NAMES[detail.payment.provider]} / {detail.payment.tradeNo}</div>}<div className="col-span-2">收货：{detail.address.name} {detail.address.phone} · {detail.address.region} {detail.address.detail}</div>{detail.logistics && <div className="col-span-2">物流：{detail.logistics.company} {detail.logistics.no}</div>}</div><div className="divide-y divide-ink-100 border-t border-ink-100">{detail.items.map((it, i) => <div key={i} className="py-2 flex gap-3 items-center"><Img src={it.image} alt="" w={44} h={44} className="w-11 h-11 rounded" /><div className="flex-1 min-w-0"><div className="line-clamp-1">{it.title}</div><div className="text-xs text-ink-400">{it.skuText}</div></div><div className="font-num">¥{money(it.price)} × {it.qty}</div></div>)}</div><div className="text-right">商品 ¥{money(detail.total)} + 运费 ¥{money(detail.freight)} - 优惠 ¥{money(detail.discount)} = <span className="price text-lg">¥{money(detail.payAmount)}</span></div><div className="flex justify-end"><Link to={`/my/orders/${detail.id}`} className="link text-xs">买家视角查看 ›</Link></div></div>}</Modal>
    </div>
  )
}

export function Refunds() {
  const { refunds, orders, users, shops, updateRefund, log } = useDB()
  const [tab, setTab] = useState('all')
  const [q, setQ] = useState('')
  const [judge, setJudge] = useState<Refund | null>(null)
  const list = refunds.filter(r => (tab === 'all' || r.status === tab) && (!q || r.id.includes(q) || r.orderId.includes(q))).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  const cols: Column<Refund>[] = [
    { key: 'id', title: '售后单', render: r => <div><div className="font-num text-xs">{r.id}</div><div className="text-xs text-ink-400">订单 {r.orderId.slice(-8)}</div></div> },
    { key: 'p', title: '商品', render: r => { const o = orders.find(x => x.id === r.orderId); return o ? <div className="flex gap-2 items-center"><Img src={o.items[0].image} alt="" w={40} h={40} className="w-10 h-10 rounded" /><div className="text-xs line-clamp-2 max-w-[200px]">{o.items[0].title}</div></div> : '-' } },
    { key: 'parties', title: '买家 / 商家', render: r => <div className="text-xs"><div>{users.find(u => u.id === r.userId)?.nickname}</div><div className="text-ink-400">{shops.find(s => s.id === r.shopId)?.name}</div></div> },
    { key: 'type', title: '类型', render: r => r.type === 'refund' ? '仅退款' : '退货退款' },
    { key: 'amount', title: '金额', render: r => <span className="price">¥{money(r.amount)}</span> },
    { key: 'reason', title: '原因', render: r => <span className="text-xs">{r.reason}</span> },
    { key: 'time', title: '申请时间', render: r => <span className="text-xs">{fmtDate(r.createdAt)}</span> },
    { key: 'status', title: '状态', render: r => <span className={REFUND_STATUS[r.status].cls}>{REFUND_STATUS[r.status].label}</span> },
    { key: 'op', title: '操作', render: r => (r.status === 'pending' || r.status === 'rejected') ? <button onClick={() => setJudge(r)} className="btn-outline btn-sm"><Gavel className="w-3 h-3" />平台介入</button> : <span className="text-xs text-ink-400">已结案</span> },
  ]
  return (
    <div>
      <PageHeader title="退款纠纷" desc="商家超时未处理或买家申请平台介入的售后单。" />
      <div className="grid grid-cols-4 gap-3 mb-4"><Stat label="售后总数" value={refunds.length} /><Stat label="待处理" value={refunds.filter(r => r.status === 'pending').length} accent="text-amber-700" /><Stat label="商家拒绝（待介入）" value={refunds.filter(r => r.status === 'rejected').length} accent="text-red-600" /><Stat label="退款总额" value={`¥${money(refunds.filter(r => r.status === 'refunded').reduce((a, r) => a + r.amount, 0), 0)}`} /></div>
      <div className="card"><div className="px-5"><Tabs items={[{ key: 'all', label: '全部' }, { key: 'pending', label: '待处理' }, { key: 'rejected', label: '商家拒绝' }, { key: 'approved', label: '退货中' }, { key: 'refunded', label: '已退款' }, { key: 'cancelled', label: '已撤销' }]} value={tab} onChange={setTab} accent="qn" /></div><div className="px-5 py-3"><SearchInput value={q} onChange={setQ} placeholder="售后单号 / 订单号" className="w-72" /></div><div className="px-5 pb-5"><Table columns={cols} data={list} pageSize={12} /></div></div>
      <Modal open={!!judge} onClose={() => setJudge(null)} title="平台介入裁定" width={480} footer={<><button className="btn-outline" onClick={() => setJudge(null)}>取消</button><button className="btn-outline text-red-600" onClick={() => { updateRefund(judge!.id, { status: 'rejected' }); log('admin', '裁定：驳回退款', judge!.id); setJudge(null); toast('已裁定：驳回买家申请') }}>支持商家</button><button className="btn-qn" onClick={() => { updateRefund(judge!.id, { status: 'refunded' }); log('admin', '裁定：强制退款', judge!.id); setJudge(null); toast('已裁定：强制退款给买家') }}>支持买家（退款）</button></>}>{judge && <div className="text-sm space-y-2"><div className="bg-ink-50 rounded-lg p-3"><div>售后单：{judge.id} · {judge.type === 'refund' ? '仅退款' : '退货退款'}</div><div>金额：<span className="price">¥{money(judge.amount)}</span></div><div>原因：{judge.reason}</div><div className="text-ink-500">描述：{judge.desc}</div></div><div className="text-xs text-ink-500">裁定后结果将同步至买家与商家，并记录操作日志。</div></div>}</Modal>
    </div>
  )
}

export function Reviews() {
  const { reviews, products, users, log } = useDB()
  const [tab, setTab] = useState('all')
  const [q, setQ] = useState('')
  const [hidden, setHidden] = useState<string[]>([])
  const list = reviews.filter(r => (tab === 'all' || (tab === 'bad' ? r.rating <= 3 : tab === 'img' ? r.images.length > 0 : hidden.includes(r.id))) && (!q || r.content.includes(q) || products.find(p => p.id === r.productId)?.title.includes(q))).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  const cols: Column<Review>[] = [
    { key: 'p', title: '商品', render: r => { const p = products.find(x => x.id === r.productId); return <div className="flex gap-2 items-center"><Img src={p?.images[0] ?? ''} alt="" w={40} h={40} className="w-10 h-10 rounded" /><div className="text-xs line-clamp-2 max-w-[200px]">{p?.title}</div></div> } },
    { key: 'u', title: '买家', render: r => <div className="flex items-center gap-1.5 text-xs"><Avatar src={users.find(u => u.id === r.userId)?.avatar} name="" size={20} />{users.find(u => u.id === r.userId)?.nickname}</div> },
    { key: 'rating', title: '评分', render: r => <Rating value={r.rating} /> },
    { key: 'content', title: '内容', render: r => <div className="text-xs max-w-[300px]"><div className={cls(hidden.includes(r.id) && 'line-through text-ink-400')}>{r.content}</div>{r.images.length > 0 && <span className="tag-gray mt-1">含图 {r.images.length}</span>}</div> },
    { key: 'time', title: '时间', render: r => <span className="text-xs">{fmtDate(r.createdAt, false)}</span> },
    { key: 'op', title: '操作', render: r => hidden.includes(r.id) ? <button onClick={() => setHidden(h => h.filter(x => x !== r.id))} className="link text-xs">恢复显示</button> : <button onClick={() => { setHidden(h => [...h, r.id]); log('admin', '屏蔽评价', r.id); toast('已屏蔽该评价') }} className="link text-xs text-red-600 flex items-center gap-0.5"><Trash2 className="w-3 h-3" />屏蔽</button> },
  ]
  return (
    <div>
      <PageHeader title="评价管理" desc="违规评价屏蔽与差评监控。" />
      <div className="grid grid-cols-4 gap-3 mb-4"><Stat label="评价总数" value={reviews.length} /><Stat label="平均评分" value={(reviews.reduce((a, r) => a + r.rating, 0) / Math.max(1, reviews.length)).toFixed(2)} accent="text-brand-500" /><Stat label="差评" value={reviews.filter(r => r.rating <= 3).length} accent="text-amber-700" /><Stat label="已屏蔽" value={hidden.length} /></div>
      <div className="card"><div className="px-5"><Tabs items={[{ key: 'all', label: '全部' }, { key: 'bad', label: '差评' }, { key: 'img', label: '有图' }, { key: 'hidden', label: '已屏蔽' }]} value={tab} onChange={setTab} accent="qn" /></div><div className="px-5 py-3"><SearchInput value={q} onChange={setQ} placeholder="评价内容 / 商品" className="w-72" /></div><div className="px-5 pb-5"><Table columns={cols} data={list} pageSize={12} /></div><div className="hidden"><Star /></div></div>
    </div>
  )
}
