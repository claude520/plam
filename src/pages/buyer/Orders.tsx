import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ChevronDown, Download, Filter, Printer, Search, Trash2, Truck, MapPin, Package, Check, Star } from 'lucide-react'
import { useDB } from '@/store/db'
import { useCurrentUser } from '@/lib/hooks'
import { Avatar, Empty, Img, Modal, Field, Pagination, Steps } from '@/components/ui'
import { cls, fmtDate, money, ORDER_STATUS, PAY_NAMES, REFUND_STATUS } from '@/lib/format'
import { toast } from '@/store/session'
import type { Order } from '@/data/types'

const TABS = [['all', '所有订单'], ['unpaid', '待付款'], ['paid', '待发货'], ['shipped', '待收货'], ['received', '待评价'], ['stage', '分阶段'], ['recycle', '回收站']] as const

export default function Orders() {
  const user = useCurrentUser()!
  const [sp, setSp] = useSearchParams()
  const nav = useNavigate()
  const tab = sp.get('tab') ?? 'all'
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const { orders, shops, setOrderStatus, products, createRefund, addReview, payOrder, refunds } = useDB()
  const [refundOf, setRefundOf] = useState<Order | null>(null)
  const [reviewOf, setReviewOf] = useState<Order | null>(null)
  const [payOf, setPayOf] = useState<Order | null>(null)
  const list = useMemo(() => {
    let r = orders.filter(o => o.userId === user.id)
    if (tab === 'refund') r = r.filter(o => o.status === 'refunding' || refunds.some(rf => rf.orderId === o.id))
    else if (tab === 'recycle') r = []
    else if (tab === 'stage') r = r.filter(o => o.payAmount > 2000)
    else if (tab !== 'all') r = r.filter(o => o.status === tab)
    if (q) r = r.filter(o => o.id.includes(q) || o.items.some(i => i.title.includes(q)) || shops.find(s => s.id === o.shopId)?.name.includes(q))
    return r.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }, [orders, user, tab, q, shops, refunds])
  const pageSize = 8
  const rows = list.slice((page - 1) * pageSize, page * pageSize)
  const counts = { received: orders.filter(o => o.userId === user.id && o.status === 'received').length }

  return (
    <div>
      <div className="flex items-center gap-6 border-b border-ink-200 text-[15px]">
        {TABS.map(([k, l]) => <button key={k} onClick={() => { setSp(k === 'all' ? {} : { tab: k }); setPage(1) }} className={cls('py-3 font-medium relative', tab === k ? 'text-brand-500' : 'text-ink-700 hover:text-ink-900')}>{l}{k === 'received' && counts.received > 0 && <span className="ml-1 font-num">{counts.received}</span>}{tab === k && <span className="absolute left-0 right-0 bottom-0 h-0.5 bg-brand-500 rounded-full" />}</button>)}
        {tab === 'refund' && <span className="py-3 font-medium text-brand-500 relative">退款/售后<span className="absolute left-0 right-0 bottom-0 h-0.5 bg-brand-500 rounded-full" /></span>}
        <span className="ml-auto text-xs text-ink-500 flex items-center gap-1">⇄ 切回旧版</span>
      </div>
      <div className="flex items-center gap-2 py-3 text-sm">
        <div className="flex items-center h-9 border border-ink-200 rounded-lg overflow-hidden bg-white"><span className="px-3 text-ink-600 flex items-center gap-1 border-r border-ink-200 h-full">全部<ChevronDown className="w-3.5 h-3.5" /></span><input aria-label="搜索订单" value={q} onChange={e => setQ(e.target.value)} placeholder="商品标题/订单号/店铺名/快递单号" className="px-3 h-full w-72 outline-none" /><button aria-label="搜索" className="px-3 text-ink-500"><Search className="w-4 h-4" /></button></div>
        <button className="btn-outline btn-sm h-9"><Filter className="w-3.5 h-3.5" />筛选<ChevronDown className="w-3.5 h-3.5" /></button>
        <button onClick={() => toast('订单已导出为 CSV')} className="btn-outline btn-sm h-9"><Download className="w-3.5 h-3.5" />导出订单<span className="tag bg-brand-500 text-white ml-1">新</span></button>
        <button onClick={() => window.print()} className="btn-outline btn-sm h-9"><Printer className="w-3.5 h-3.5" />打印</button>
        <div className="ml-auto"><Pagination page={page} pages={Math.max(1, Math.ceil(list.length / pageSize))} onChange={setPage} /></div>
      </div>
      <div className="grid grid-cols-[1fr_120px_140px_140px] text-sm text-ink-500 px-4 py-2 bg-ink-100/60 rounded-lg"><div className="pl-[520px]">订单信息</div><div className="text-center">商品金额</div><div className="text-center">实付款</div><div className="text-center">订单操作</div></div>
      {rows.length === 0 && <div className="card mt-3"><Empty text="没有找到相关订单" icon={<Package className="w-6 h-6" />} /></div>}
      <div className="space-y-3 mt-3">
        {rows.map(o => {
          const shop = shops.find(s => s.id === o.shopId)!
          const st = ORDER_STATUS[o.status]
          const rf = refunds.find(r => r.orderId === o.id)
          return (
            <div key={o.id} className="card overflow-hidden">
              <div className="flex items-center gap-3 px-4 h-11 bg-ink-50 text-sm">
                <span className="text-ink-700">{fmtDate(o.createdAt, false)}</span><span className="text-ink-500">订单号: <span className="font-num text-ink-800">{o.id}</span></span>
                <span className={cls('tag text-white', shop.type === 'tmall' ? 'bg-brand-500' : 'bg-brand-400')}>{shop.type === 'tmall' ? '天猫' : 'Plam'}</span><Link to={`/shop/${shop.id}`} className="font-medium hover:text-brand-500">{shop.name}</Link><span className="text-qn-500 text-xs">💬</span>
                <Link to={`/my/orders/${o.id}`} className="text-brand-500 hover:underline">订单详情 ›</Link>
                <span className={cls('ml-auto font-medium', st.color)}>{st.label}</span>
                <span className="text-ink-300">⚑</span><button aria-label="删除订单" onClick={() => toast('订单已移入回收站')} className="text-ink-400 hover:text-brand-500"><Trash2 className="w-4 h-4" /></button>
              </div>
              <div className="grid grid-cols-[1fr_120px_140px_140px] px-4 py-4 text-sm">
                <div className="divide-y divide-ink-100">
                  {o.items.map((it, i) => (
                    <div key={i} className="flex gap-3 py-2 first:pt-0 last:pb-0">
                      <Link to={`/item/${it.productId}`} className="w-20 h-20 rounded-lg overflow-hidden shrink-0"><Img src={it.image} alt={it.title} w={80} h={80} className="w-full h-full" /></Link>
                      <div className="flex-1 min-w-0"><Link to={`/item/${it.productId}`} className="text-ink-900 line-clamp-2 hover:text-brand-500">{it.title}</Link><div className="text-xs text-ink-400 mt-1">{it.skuText}</div><div className="text-xs text-ink-400">{products.find(p => p.id === it.productId)?.freeShipping ? '包邮' : ''} 不支持7天无理由</div>{(o.status === 'done' || o.status === 'received' || o.status === 'shipped') && <button onClick={() => setRefundOf(o)} className="btn-outline btn-sm mt-1.5">申请售后</button>}</div>
                      <div className="text-right w-20"><div className="font-num">¥{money(it.price)}</div><div className="text-xs text-ink-400">x{it.qty}</div></div>
                    </div>
                  ))}
                </div>
                <div className="text-center border-l border-ink-100"><div className="font-num">¥{money(o.total)}</div>{rf && <div className={cls('mt-1 text-xs', REFUND_STATUS[rf.status].cls)}>{REFUND_STATUS[rf.status].label}</div>}</div>
                <div className="text-center border-l border-ink-100"><div>实付款 <b className="font-num text-base">¥{money(o.payAmount)}</b></div><div className="text-xs text-ink-400">含运费: ¥{money(o.freight)}</div>{o.payment && <div className="mt-1 inline-block text-xs border border-ink-200 rounded px-1.5 py-0.5 text-ink-500">{PAY_NAMES[o.payment.provider]}</div>}</div>
                <div className="text-center border-l border-ink-100 flex flex-col items-center gap-1.5">
                  {o.status === 'unpaid' && <><button onClick={() => setPayOf(o)} className="btn-primary btn-sm w-24">立即付款</button><button onClick={() => { setOrderStatus(o.id, 'closed'); toast('订单已取消') }} className="text-xs text-ink-500 hover:text-brand-500">取消订单</button></>}
                  {o.status === 'shipped' && <><button onClick={() => { setOrderStatus(o.id, 'received'); toast('确认收货成功') }} className="btn-primary btn-sm w-24">确认收货</button><Link to={`/my/orders/${o.id}`} className="text-xs text-ink-700 hover:text-brand-500">查看物流</Link></>}
                  {o.status === 'received' && <><button onClick={() => setReviewOf(o)} className="btn-primary btn-sm w-24">评价</button><button onClick={() => nav(`/checkout?pid=${o.items[0].productId}&sku=${products.find(p => p.id === o.items[0].productId)?.skus[0].id}&qty=1`)} className="text-xs text-ink-700 hover:text-brand-500">再买一单</button></>}
                  {(o.status === 'done' || o.status === 'closed') && <><button onClick={() => nav(`/checkout?pid=${o.items[0].productId}&sku=${products.find(p => p.id === o.items[0].productId)?.skus[0].id}&qty=1`)} className="btn-primary btn-sm w-24">再买一单</button>{o.logistics && <Link to={`/my/orders/${o.id}`} className="text-xs text-ink-700 hover:text-brand-500">查看物流</Link>}</>}
                  {o.status === 'paid' && <><span className="text-xs text-ink-500">等待卖家发货</span><button onClick={() => setRefundOf(o)} className="text-xs text-ink-700 hover:text-brand-500">申请退款</button></>}
                  {o.status === 'refunding' && <Link to="/my/refunds" className="text-xs text-amber-600">退款处理中 ›</Link>}
                </div>
              </div>
            </div>
          )
        })}
      </div>
      {list.length > pageSize && <div className="card mt-3 px-4"><Pagination page={page} pages={Math.ceil(list.length / pageSize)} onChange={setPage} total={list.length} /></div>}

      <RefundModal order={refundOf} onClose={() => setRefundOf(null)} onOk={(reason, type, desc) => { createRefund({ orderId: refundOf!.id, userId: user.id, shopId: refundOf!.shopId, amount: refundOf!.payAmount, reason, type, desc }); setRefundOf(null); toast('售后申请已提交') }} />
      <ReviewModal order={reviewOf} onClose={() => setReviewOf(null)} onOk={(rating, content) => { reviewOf!.items.forEach(it => addReview({ productId: it.productId, userId: user.id, orderId: reviewOf!.id, rating, content, images: [], skuText: it.skuText })); setOrderStatus(reviewOf!.id, 'done'); setReviewOf(null); toast('评价成功，获得 20 淘金币') }} />
      <PayModal order={payOf} onClose={() => setPayOf(null)} onOk={provider => { payOrder(payOf!.id, provider); setPayOf(null); toast('支付成功') }} />
    </div>
  )
}

export function RefundModal({ order, onClose, onOk }: { order: Order | null; onClose: () => void; onOk: (reason: string, type: 'refund' | 'return', desc: string) => void }) {
  const [reason, setReason] = useState('七天无理由退换货')
  const [type, setType] = useState<'refund' | 'return'>('refund')
  const [desc, setDesc] = useState('')
  return (
    <Modal open={!!order} onClose={onClose} title="申请售后" footer={<><button className="btn-outline" onClick={onClose}>取消</button><button className="btn-primary" onClick={() => onOk(reason, type, desc)}>提交申请</button></>}>
      {order && <div className="space-y-4">
        <div className="flex gap-3 bg-ink-50 rounded-lg p-3"><Img src={order.items[0].image} alt="" w={56} h={56} className="w-14 h-14 rounded" /><div className="text-sm"><div className="line-clamp-1">{order.items[0].title}</div><div className="text-xs text-ink-500 mt-1">退款金额 <span className="price">¥{money(order.payAmount)}</span></div></div></div>
        <Field label="服务类型"><div className="flex gap-2">{([['refund', '仅退款'], ['return', '退货退款']] as const).map(([k, l]) => <button key={k} onClick={() => setType(k)} className={cls('btn-sm btn border', type === k ? 'border-brand-500 text-brand-500 bg-brand-50' : 'border-ink-200')}>{l}</button>)}</div></Field>
        <Field label="退款原因"><select className="input" value={reason} onChange={e => setReason(e.target.value)}>{['七天无理由退换货', '质量问题', '商品与描述不符', '拍错/多拍/不想要', '物流问题', '其他'].map(r => <option key={r}>{r}</option>)}</select></Field>
        <Field label="问题描述"><textarea className="input h-24 py-2" value={desc} onChange={e => setDesc(e.target.value)} placeholder="请描述具体问题，有助于商家更快处理" /></Field>
      </div>}
    </Modal>
  )
}

export function ReviewModal({ order, onClose, onOk }: { order: Order | null; onClose: () => void; onOk: (rating: number, content: string) => void }) {
  const [rating, setRating] = useState(5)
  const [content, setContent] = useState('')
  return (
    <Modal open={!!order} onClose={onClose} title="评价宝贝" footer={<><button className="btn-outline" onClick={onClose}>取消</button><button className="btn-primary" disabled={!content} onClick={() => onOk(rating, content)}>发布评价</button></>}>
      {order && <div className="space-y-4">
        {order.items.map((it, i) => <div key={i} className="flex gap-3 bg-ink-50 rounded-lg p-3"><Img src={it.image} alt="" w={56} h={56} className="w-14 h-14 rounded" /><div className="text-sm line-clamp-2">{it.title}</div></div>)}
        <Field label="综合评分"><div className="flex gap-1">{[1, 2, 3, 4, 5].map(n => <button key={n} aria-label={`${n}星`} onClick={() => setRating(n)}><Star className={cls('w-7 h-7', n <= rating ? 'fill-brand-500 text-brand-500' : 'text-ink-300')} /></button>)}<span className="ml-2 text-sm text-ink-500 self-center">{['', '很差', '较差', '一般', '满意', '非常满意'][rating]}</span></div></Field>
        <Field label="评价内容"><textarea className="input h-28 py-2" value={content} onChange={e => setContent(e.target.value)} placeholder="宝贝满足你的期待吗？说说它的优点和美中不足的地方吧" /></Field>
      </div>}
    </Modal>
  )
}

export function PayModal({ order, onClose, onOk }: { order: Order | null; onClose: () => void; onOk: (provider: string) => void }) {
  const all = useDB(s => s.paymentProviders)
  const providers = useMemo(() => all.filter(p => p.enabled), [all])
  const [prov, setProv] = useState(providers[0]?.code ?? 'balance')
  return (
    <Modal open={!!order} onClose={onClose} title="选择支付方式" footer={<><button className="btn-outline" onClick={onClose}>取消</button><button className="btn-primary" onClick={() => onOk(prov)}>确认支付 ¥{money(order?.payAmount ?? 0)}</button></>}>
      <div className="grid grid-cols-2 gap-3">{providers.map(p => <button key={p.id} onClick={() => setProv(p.code)} className={cls('flex items-center gap-3 rounded-xl border-2 p-3 text-left', prov === p.code ? 'border-brand-500 bg-brand-50/40' : 'border-ink-200')}><span className="w-9 h-9 rounded-lg text-white flex items-center justify-center font-bold" style={{ background: p.logoColor }}>{p.name[0]}</span><span className="text-sm font-medium">{p.name}</span>{prov === p.code && <Check className="w-4 h-4 text-brand-500 ml-auto" />}</button>)}</div>
    </Modal>
  )
}

export function OrderDetail() {
  const { id } = useParams()
  const { orders, shops, setOrderStatus } = useDB()
  const o = orders.find(x => x.id === id)
  if (!o) return <Empty text="订单不存在" />
  const shop = shops.find(s => s.id === o.shopId)!
  const stepIdx = o.status === 'unpaid' ? 0 : o.status === 'paid' ? 1 : o.status === 'shipped' ? 2 : o.status === 'closed' ? 0 : 3
  return (
    <div className="space-y-4">
      <div className="card p-6">
        <div className="flex items-center justify-between"><div><div className="text-lg font-semibold flex items-center gap-2">订单详情 <span className={cls('text-sm', ORDER_STATUS[o.status].color)}>· {ORDER_STATUS[o.status].label}</span></div><div className="text-xs text-ink-500 mt-1">订单号 {o.id} · 下单时间 {fmtDate(o.createdAt)}</div></div>
          {o.status === 'shipped' && <button onClick={() => { setOrderStatus(o.id, 'received'); toast('确认收货成功') }} className="btn-primary">确认收货</button>}</div>
        <div className="mt-6 max-w-3xl">{o.status === 'closed' ? <div className="text-ink-500">订单已关闭</div> : <Steps steps={['买家下单', '买家付款', '卖家发货', '交易成功']} current={stepIdx} />}</div>
      </div>
      <div className="grid grid-cols-[1fr_360px] gap-4 items-start">
        <div className="space-y-4">
          <div className="card p-5">
            <div className="flex items-center gap-2 mb-3"><Avatar src={shop.logo} name={shop.name} size={24} /><Link to={`/shop/${shop.id}`} className="font-semibold hover:text-brand-500">{shop.name}</Link></div>
            <div className="divide-y divide-ink-100">{o.items.map((it, i) => <div key={i} className="py-3 flex gap-3 items-center"><Img src={it.image} alt={it.title} w={72} h={72} className="w-[72px] h-[72px] rounded-lg" /><div className="flex-1 min-w-0"><Link to={`/item/${it.productId}`} className="text-sm line-clamp-2 hover:text-brand-500">{it.title}</Link><div className="text-xs text-ink-400 mt-1">{it.skuText}</div></div><div className="text-sm font-num">¥{money(it.price)} × {it.qty}</div></div>)}</div>
            <div className="mt-3 pt-3 border-t border-ink-100 text-sm space-y-1.5 text-right">
              <div className="text-ink-500">商品总价 <span className="font-num text-ink-800 inline-block w-28">¥{money(o.total)}</span></div>
              <div className="text-ink-500">运费 <span className="font-num text-ink-800 inline-block w-28">¥{money(o.freight)}</span></div>
              <div className="text-ink-500">优惠 <span className="font-num text-brand-500 inline-block w-28">-¥{money(o.discount)}</span></div>
              <div className="text-ink-800 font-medium">实付款 <span className="price text-xl inline-block w-28">¥{money(o.payAmount)}</span></div>
            </div>
          </div>
          <div className="card p-5 text-sm">
            <div className="font-semibold mb-3">订单信息</div>
            <div className="grid grid-cols-2 gap-y-2 text-ink-600"><div>订单编号：{o.id}</div><div>创建时间：{fmtDate(o.createdAt)}</div>{o.paidAt && <div>付款时间：{fmtDate(o.paidAt)}</div>}{o.payment && <div>支付方式：{PAY_NAMES[o.payment.provider]}（{o.payment.tradeNo}）</div>}{o.shippedAt && <div>发货时间：{fmtDate(o.shippedAt)}</div>}{o.doneAt && <div>成交时间：{fmtDate(o.doneAt)}</div>}{o.note && <div className="col-span-2">买家留言：{o.note}</div>}</div>
          </div>
        </div>
        <div className="space-y-4">
          <div className="card p-5 text-sm"><div className="font-semibold mb-3 flex items-center gap-1.5"><MapPin className="w-4 h-4 text-brand-500" />收货信息</div><div className="text-ink-800">{o.address.name} {o.address.phone}</div><div className="text-ink-600 mt-1">{o.address.region} {o.address.detail}</div></div>
          <div className="card p-5 text-sm">
            <div className="font-semibold mb-3 flex items-center gap-1.5"><Truck className="w-4 h-4 text-brand-500" />物流信息</div>
            {o.logistics ? <>
              <div className="text-ink-600">{o.logistics.company} · 运单号 <span className="font-num">{o.logistics.no}</span></div>
              <ol className="mt-4 relative border-l border-ink-200 ml-2 space-y-4">{[...o.logistics.traces].reverse().map((t, i) => <li key={i} className="pl-4 relative"><span className={cls('absolute -left-[5px] top-1.5 w-2 h-2 rounded-full', i === 0 ? 'bg-brand-500 ring-4 ring-brand-100' : 'bg-ink-300')} /><div className={cls('text-xs', i === 0 ? 'text-ink-900' : 'text-ink-500')}>{t.text}</div><div className="text-[11px] text-ink-400 mt-0.5">{fmtDate(t.time)}</div></li>)}</ol>
            </> : <div className="text-ink-400">暂无物流信息</div>}
          </div>
        </div>
      </div>
    </div>
  )
}
