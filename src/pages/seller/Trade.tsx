import { useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { Truck, MessageSquare, RotateCcw, MapPin, Phone, Search, ChevronRight } from 'lucide-react'
import { useDB } from '@/store/db'
import { useCurrentShop } from '@/lib/hooks'
import { Avatar, Empty, Img, Modal, Field, PageHeader, Table, Tabs, Rating, Steps, Stat, type Column } from '@/components/ui'
import { cls, fmtDate, money, ORDER_STATUS, PAY_NAMES, REFUND_STATUS } from '@/lib/format'
import { toast } from '@/store/session'
import type { Order, Refund, Review } from '@/data/types'
import { Bars, TrendLine, days } from '@/components/Charts'

const EXPRESS = ['顺丰速运', '中通快递', '圆通速递', '韵达快递', '京东物流', '极兔速递', '邮政EMS']

export function SellerOrders() {
  const shop = useCurrentShop()
  const [sp, setSp] = useSearchParams()
  const tab = sp.get('tab') ?? 'recent'
  const { orders, users, shipOrder, setOrderStatus, updateOrder } = useDB()
  const [q, setQ] = useState('')
  const [f, setF] = useState({ status: '', title: '', pay: '', name: '', phone: '', hideClosed: false })
  const [expanded, setExpanded] = useState(true)
  const [sel, setSel] = useState<string[]>([])
  const [shipOf, setShipOf] = useState<Order | null>(null)
  const [noteOf, setNoteOf] = useState<Order | null>(null)
  const my = useMemo(() => orders.filter(o => o.shopId === shop.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt)), [orders, shop.id])
  const within3m = (o: Order) => Date.now() - new Date(o.createdAt).getTime() < 90 * 864e5
  const tabFilter = (o: Order) => {
    switch (tab) {
      case 'recent': return within3m(o)
      case 'old': return !within3m(o)
      case 'confirming': return o.status === 'paid' && !o.shippedAt && Date.now() - new Date(o.paidAt ?? o.createdAt).getTime() < 3600e3
      case 'timeout-soon': return o.status === 'paid' && Date.now() - new Date(o.paidAt ?? o.createdAt).getTime() > 36 * 3600e3
      case 'timeout': return o.status === 'paid' && Date.now() - new Date(o.paidAt ?? o.createdAt).getTime() > 48 * 3600e3
      case 'done': return o.status === 'done' || o.status === 'received'
      default: return o.status === tab
    }
  }
  const list = useMemo(() => my.filter(o => tabFilter(o)
    && (!q || o.id.includes(q) || o.logistics?.no.includes(q) || o.items.some(i => i.productId.includes(q)) || users.find(u => u.id === o.userId)?.nickname.includes(q))
    && (!f.status || o.status === f.status) && (!f.title || o.items.some(i => i.title.includes(f.title))) && (!f.pay || o.payment?.provider === f.pay)
    && (!f.name || o.address.name.includes(f.name)) && (!f.phone || o.address.phone.includes(f.phone)) && (!f.hideClosed || o.status !== 'closed')), [my, tab, q, f, users]) // eslint-disable-line
  const tabs = [['recent', '近3个月'], ['unpaid', '待付款'], ['confirming', '确认中'], ['paid', '待发货'], ['timeout-soon', '即将超时'], ['timeout', '发货已超时'], ['shipped', '已发货'], ['refunding', '退款中'], ['done', '已成功'], ['closed', '已关闭'], ['old', '3个月前']]
  const Sel = ({ label, k, options }: { label: string; k: keyof typeof f; options: [string, string][] }) => <label className="input-qn flex items-center gap-2 px-3 text-sm"><span className="text-ink-400 shrink-0">{label}</span><select aria-label={label} className="flex-1 outline-none bg-transparent" value={f[k] as string} onChange={e => setF({ ...f, [k]: e.target.value })}><option value="">全部</option>{options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
  const Inp = ({ label, k, placeholder }: { label: string; k: keyof typeof f; placeholder?: string }) => <label className="input-qn flex items-center gap-2 px-3 text-sm"><span className="text-ink-400 shrink-0">{label}</span><input aria-label={label} className="flex-1 outline-none bg-transparent min-w-0" placeholder={placeholder} value={f[k] as string} onChange={e => setF({ ...f, [k]: e.target.value })} /></label>
  const DateRange = ({ label }: { label: string }) => <div className="input-qn flex items-center gap-2 px-3 text-sm text-ink-400"><span className="shrink-0">{label}</span><input aria-label={`${label}起始`} type="date" className="flex-1 outline-none bg-transparent min-w-0 text-ink-700" /><span>-</span><input aria-label={`${label}结束`} type="date" className="flex-1 outline-none bg-transparent min-w-0 text-ink-700" /></div>
  const batchShip = () => { const ids = sel.filter(id => my.find(o => o.id === id)?.status === 'paid'); if (!ids.length) return toast('请勾选待发货订单', 'error'); ids.forEach(id => shipOrder(id, '顺丰速运', `SF${Date.now().toString().slice(-10)}${Math.floor(Math.random() * 99)}`)); toast(`已批量发货 ${ids.length} 笔`); setSel([]) }
  return (
    <div className="space-y-3">
      <div className="rounded-xl bg-gradient-to-r from-rose-50 via-pink-50 to-rose-50 min-h-[48px] py-2 flex items-center px-4 md:px-5 gap-3 text-sm keep-flex overflow-hidden"><span className="w-7 h-7 rounded-lg bg-red-600 text-white flex items-center justify-center shrink-0"><RotateCcw className="w-4 h-4" /></span><span className="tag-red hidden sm:inline-flex">新功能</span><span className="font-semibold text-red-600 text-sm md:text-base whitespace-nowrap">换货自动同意，售后处理更省心</span><span className="tag bg-white text-red-600 border border-red-100 hidden lg:inline-flex">● 快捷处理售后单</span><span className="tag bg-white text-red-600 border border-red-100 hidden lg:inline-flex">● 审核效率提升</span><button onClick={() => toast('已开启换货自动同意')} className="btn btn-sm bg-red-600 text-white hover:bg-red-700 ml-auto shrink-0">立即开启</button></div>
      <div className="card px-5 py-3 text-sm text-ink-700">📢 已卖出宝贝满意度调研，请留下您的宝贵意见。<span className="text-qn-600 ml-1">去反馈</span></div>
      <div className="rounded-lg bg-qn-50/60 px-5 py-2.5 text-sm text-ink-700 flex items-center">💧 交易运营中心 · 预计每天新增成交 ⓘ {Math.max(0, Math.round(my.length / 30))}<Link to="/seller/promotion" className="ml-auto text-qn-600 flex items-center">去提升<ChevronRight className="w-3.5 h-3.5" /></Link></div>
      <div className="card p-5">
        <div className="flex gap-0.5 overflow-x-auto no-scrollbar">{tabs.map(([k, l]) => <button key={k} onClick={() => { setSp({ tab: k }); setSel([]) }} className={cls('px-4 md:px-5 h-10 md:h-11 text-sm md:text-[15px] rounded-sm transition shrink-0', tab === k ? 'bg-ink-900 text-white font-medium' : 'bg-ink-50 text-ink-700 hover:bg-ink-100')}>{l}</button>)}</div>
        <div className="mt-5 grid grid-cols-[70px_1fr] max-md:!grid-cols-1 gap-x-3 gap-y-3 items-start">
          <div className="font-semibold pt-2">精确查询</div>
          <div className="flex items-center gap-3"><div className="flex w-full max-w-[600px] border border-ink-200 rounded-lg overflow-hidden"><input aria-label="精确查询" className="flex-1 h-10 px-3 outline-none text-sm" placeholder="请输入订单编号/物流单号/商品id/买家昵称" value={q} onChange={e => setQ(e.target.value)} /><button className="w-16 bg-ink-50 flex items-center justify-center text-ink-500 border-l border-ink-200" aria-label="搜索"><Search className="w-4 h-4" /></button></div><button className="link" onClick={() => toast('批量搜索：每行一个订单号', 'info')}>批量搜索 ☰Q</button></div>
          <div className="font-semibold pt-2">搜索订单</div>
          {expanded ? (
            <div className="grid grid-cols-4 max-md:!grid-cols-1 gap-3">
              <Sel label="订单状态" k="status" options={[['unpaid', '待付款'], ['paid', '待发货'], ['shipped', '已发货'], ['received', '待评价'], ['done', '交易成功'], ['refunding', '退款中'], ['closed', '已关闭']]} />
              <Sel label="预售状态" k="pay" options={[]} /><Sel label="售后服务" k="pay" options={[]} /><Sel label="承诺发货时间" k="pay" options={[]} />
              <Inp label="宝贝名称" k="title" /><Sel label="催发货订单" k="pay" options={[]} /><div className="col-span-2"><DateRange label="创建时间" /></div>
              <div className="col-span-2"><DateRange label="付款时间" /></div><Sel label="评价状态" k="pay" options={[]} /><Sel label="物流服务" k="pay" options={[]} />
              <Sel label="支付方式" k="pay" options={[['wechat', '微信支付'], ['alipay', '支付宝'], ['unionpay', '银联'], ['stripe', 'Stripe'], ['balance', '余额']]} /><Sel label="订单类型" k="pay" options={[]} /><Sel label="代充类型" k="pay" options={[]} /><Inp label="收件人姓名" k="name" />
              <Inp label="收件人手机号" k="phone" /><Inp label="收礼人昵称" k="title" placeholder="仅对礼物订单生效" /><div className="col-span-2"><DateRange label="确认收货时间" /></div>
              <Sel label="预警提示" k="pay" options={[]} />
            </div>
          ) : <div className="text-sm text-ink-400 pt-2">筛选项已收起</div>}
          <div /><div className="flex items-center gap-4 text-sm"><button className="btn-qn h-10 px-6" onClick={() => toast(`共查询到 ${list.length} 个订单`, 'info')}>搜索订单</button><button onClick={() => toast(`已导出 ${list.length} 笔订单`)} className="btn-outline h-10 px-5">批量导出</button><button onClick={() => setExpanded(e => !e)} className="text-ink-600">{expanded ? '⌃ 收起筛选项' : '⌄ 展开筛选项'}</button><button onClick={() => { setF({ status: '', title: '', pay: '', name: '', phone: '', hideClosed: false }); setQ('') }} className="text-ink-600">⟲ 清除条件</button><button className="text-ink-600">☰ 筛选项设置</button></div>
        </div>
        <div className="mt-6 flex items-center gap-4 text-sm"><span className="font-semibold">快捷筛选</span><label className="input-qn w-44 flex items-center gap-2 px-3"><span className="text-ink-400">卖家备注</span><select aria-label="卖家备注" className="flex-1 bg-transparent outline-none"><option>全部</option><option>有备注</option><option>无备注</option></select></label><label className="flex items-center gap-1.5 cursor-pointer"><input type="checkbox" className="accent-qn-500" checked={f.hideClosed} onChange={e => setF({ ...f, hideClosed: e.target.checked })} />不显示已关闭的订单</label></div>
        <div className="mt-4 flex items-center gap-3 text-sm"><span>共查询到 <b className="text-brand-500 font-num">{list.length}</b> 个订单</span><button onClick={batchShip} className="btn-outline h-9">批量发货</button><button onClick={() => { if (!sel.length) return toast('请先勾选订单', 'error'); toast(`已标记 ${sel.length} 笔`) }} className="btn-outline h-9">批量标记</button><button onClick={() => { if (!sel.length) return toast('请先勾选订单', 'error'); sel.forEach(id => updateOrder(id, { freight: 0 })); toast('已免运费') }} className="btn-outline h-9">批量免运费</button><button onClick={() => toast('退款预计算：平台将按实付款原路退回', 'info')} className="btn-outline h-9">退款金额预计算</button><button className="btn-outline h-9">其他操作 ⌃</button></div>
        <div className="mt-3">
          <div className="hidden md:grid grid-cols-[32px_1fr_100px_70px_150px_120px_120px_100px] bg-ink-50 rounded-lg px-3 h-10 items-center text-sm text-ink-600"><input type="checkbox" aria-label="全选" className="accent-qn-500" checked={list.length > 0 && list.slice(0, 50).every(o => sel.includes(o.id))} onChange={e => setSel(e.target.checked ? list.slice(0, 50).map(o => o.id) : [])} /><span>宝贝</span><span>单价</span><span>数量</span><span>履约/售后状态</span><span>交易状态</span><span>实收款</span><span>操作</span></div>
          {list.length === 0 ? <div className="text-center text-ink-400 text-sm py-12">没有符合条件的宝贝，请尝试其他搜索条件。</div> : (
            <div className="space-y-3 mt-3">
              {list.slice(0, 50).map(o => { const u = users.find(x => x.id === o.userId); const rf = o.status === 'refunding'; return (
                <div key={o.id} className="border border-ink-200 rounded-lg overflow-hidden">
                  <div className="flex items-center gap-3 px-3 min-h-[40px] py-1 bg-ink-50/70 text-xs text-ink-600 flex-wrap"><input type="checkbox" aria-label="选择" className="accent-qn-500" checked={sel.includes(o.id)} onChange={e => setSel(e.target.checked ? [...sel, o.id] : sel.filter(x => x !== o.id))} /><span>订单号：<span className="font-num text-ink-800">{o.id}</span></span><span>创建时间：{fmtDate(o.createdAt)}</span><span className="flex items-center gap-1"><Avatar src={u?.avatar} name="" size={16} />{u?.nickname}</span><button onClick={() => toast('已打开聊天窗口', 'info')} className="text-qn-600 flex items-center gap-0.5"><MessageSquare className="w-3 h-3" />联系买家</button>{o.payment && <span>支付：{PAY_NAMES[o.payment.provider]}</span>}{o.note && <span className="text-brand-500">备注：{o.note}</span>}<Link to={`/seller/orders/${o.id}`} className="ml-auto link">订单详情</Link></div>
                  <div className="grid grid-cols-[32px_1fr_100px_70px_150px_120px_120px_100px] max-md:!grid-cols-[1fr_auto] max-md:gap-y-2 px-3 py-3 text-sm items-center">
                    <span className="max-md:hidden" />
                    <div className="divide-y divide-ink-100">{o.items.map((it, i) => <div key={i} className="flex gap-2 py-1.5 items-center"><Img src={it.image} alt="" w={56} h={56} className="w-14 h-14 rounded-lg" /><div className="min-w-0"><Link to={`/item/${it.productId}`} className="line-clamp-1 text-ink-900 hover:text-qn-600">{it.title}</Link><div className="text-xs text-ink-400">{it.skuText}</div></div></div>)}</div>
                    <div className="text-xs">{o.items.map((it, i) => <div key={i} className="h-[68px] flex items-center font-num">¥{money(it.price)}</div>)}</div>
                    <div className="text-xs">{o.items.map((it, i) => <div key={i} className="h-[68px] flex items-center font-num">{it.qty}</div>)}</div>
                    <div className="text-xs">{o.logistics ? <div><div className="text-ink-800">{o.logistics.company}</div><div className="text-ink-400 font-num">{o.logistics.no}</div><div className="text-ink-500 mt-0.5 line-clamp-1">{o.logistics.traces.at(-1)?.text}</div></div> : o.status === 'paid' ? <span className="text-amber-700">待发货 · {Math.max(0, 48 - Math.round((Date.now() - new Date(o.paidAt ?? o.createdAt).getTime()) / 3600e3))}h 内需发货</span> : <span className="text-ink-400">-</span>}{rf && <div className="text-amber-700 mt-1">买家申请退款</div>}</div>
                    <div className={cls('text-sm font-medium', ORDER_STATUS[o.status].color)}>{ORDER_STATUS[o.status].label}</div>
                    <div><div className="font-num font-semibold">¥{money(o.payAmount)}</div><div className="text-xs text-ink-400">含运费 ¥{money(o.freight)}</div></div>
                    <div className="flex flex-col gap-1 text-xs">
                      {o.status === 'paid' && <button onClick={() => setShipOf(o)} className="btn-qn btn-sm w-20"><Truck className="w-3 h-3" />发货</button>}
                      {o.status === 'unpaid' && <button onClick={() => { setOrderStatus(o.id, 'closed'); toast('订单已关闭') }} className="btn-outline btn-sm w-20">关闭订单</button>}
                      {o.status === 'shipped' && <Link to={`/seller/orders/${o.id}`} className="btn-outline btn-sm w-20">查看物流</Link>}
                      {rf && <Link to="/seller/refunds" className="btn-outline btn-sm w-20 text-amber-700">处理退款</Link>}
                      <button onClick={() => setNoteOf(o)} className="link text-ink-500 text-left">备注</button>
                    </div>
                  </div>
                </div>
              ) })}
            </div>
          )}
          <div className="text-center text-sm text-ink-500 py-4">‹ 上一页 <span className="text-qn-600 mx-2">1</span> 下一页 ›</div>
        </div>
      </div>
      <ShipModal order={shipOf} onClose={() => setShipOf(null)} onOk={(c, n) => { shipOrder(shipOf!.id, c, n); setShipOf(null); toast('发货成功') }} />
      <NoteModal order={noteOf} onClose={() => setNoteOf(null)} onOk={n => { updateOrder(noteOf!.id, { note: n }); setNoteOf(null); toast('备注已保存') }} />
    </div>
  )
}

function ShipModal({ order, onClose, onOk }: { order: Order | null; onClose: () => void; onOk: (company: string, no: string) => void }) {
  const [company, setCompany] = useState(EXPRESS[0])
  const [no, setNo] = useState('')
  return (
    <Modal open={!!order} onClose={onClose} title="订单发货" footer={<><button className="btn-outline" onClick={onClose}>取消</button><button className="btn-qn" disabled={!no} onClick={() => onOk(company, no)}>确认发货</button></>}>
      {order && <div className="space-y-4">
        <div className="bg-ink-50 rounded-lg p-3 text-sm"><div className="flex items-center gap-1.5"><MapPin className="w-4 h-4 text-qn-500" />{order.address.name} {order.address.phone}</div><div className="text-ink-600 mt-1 ml-5">{order.address.region} {order.address.detail}</div></div>
        <Field label="物流公司" required><select className="input-qn" value={company} onChange={e => setCompany(e.target.value)}>{EXPRESS.map(e => <option key={e}>{e}</option>)}</select></Field>
        <Field label="运单号" required><div className="flex gap-2"><input className="input-qn" value={no} onChange={e => setNo(e.target.value)} placeholder="请输入或扫描运单号" /><button type="button" className="btn-outline whitespace-nowrap" onClick={() => setNo(`${company.slice(0, 2) === '顺丰' ? 'SF' : 'YT'}${Math.floor(Math.random() * 9e11 + 1e11)}`)}>电子面单取号</button></div></Field>
      </div>}
    </Modal>
  )
}
function NoteModal({ order, onClose, onOk }: { order: Order | null; onClose: () => void; onOk: (n: string) => void }) {
  const [n, setN] = useState(order?.note ?? '')
  return <Modal open={!!order} onClose={onClose} title="订单备注" width={440} footer={<><button className="btn-outline" onClick={onClose}>取消</button><button className="btn-qn" onClick={() => onOk(n)}>保存</button></>}><textarea className="input-qn h-24 py-2" value={n} onChange={e => setN(e.target.value)} placeholder="仅卖家可见" /></Modal>
}

export function SellerOrderDetail() {
  const { id } = useParams()
  const { orders, users, shipOrder } = useDB()
  const [shipOf, setShipOf] = useState<Order | null>(null)
  const o = orders.find(x => x.id === id)
  if (!o) return <Empty text="订单不存在" />
  const u = users.find(x => x.id === o.userId)
  const stepIdx = o.status === 'unpaid' ? 0 : o.status === 'paid' ? 1 : o.status === 'shipped' ? 2 : o.status === 'closed' ? 0 : 3
  return (
    <div className="space-y-4">
      <PageHeader title={<span>订单详情 <span className={cls('text-base', ORDER_STATUS[o.status].color)}>· {ORDER_STATUS[o.status].label}</span></span>} desc={`订单号 ${o.id}`} extra={o.status === 'paid' ? <button onClick={() => setShipOf(o)} className="btn-qn"><Truck className="w-4 h-4" />立即发货</button> : undefined} />
      <div className="card p-6 max-w-3xl">{o.status === 'closed' ? <div className="text-ink-500">订单已关闭</div> : <Steps steps={['买家下单', '买家付款', '卖家发货', '交易完成']} current={stepIdx} />}</div>
      <div className="grid grid-cols-[1fr_360px] gap-4 items-start">
        <div className="card p-5">
          <div className="font-semibold mb-3">商品信息</div>
          <div className="divide-y divide-ink-100">{o.items.map((it, i) => <div key={i} className="py-3 flex gap-3 items-center"><Img src={it.image} alt="" w={64} h={64} className="w-16 h-16 rounded-lg" /><div className="flex-1 min-w-0"><div className="text-sm line-clamp-2">{it.title}</div><div className="text-xs text-ink-400 mt-1">{it.skuText}</div></div><div className="text-sm font-num">¥{money(it.price)} × {it.qty}</div></div>)}</div>
          <div className="mt-3 pt-3 border-t border-ink-100 text-sm space-y-1.5 text-right text-ink-500"><div>商品总价 <span className="inline-block w-28 font-num text-ink-800">¥{money(o.total)}</span></div><div>运费 <span className="inline-block w-28 font-num text-ink-800">¥{money(o.freight)}</span></div><div>优惠 <span className="inline-block w-28 font-num text-brand-500">-¥{money(o.discount)}</span></div><div className="text-ink-800 font-medium">实收款 <span className="inline-block w-28 price text-xl">¥{money(o.payAmount)}</span></div></div>
          <div className="mt-4 pt-4 border-t border-ink-100 grid grid-cols-2 gap-y-2 text-sm text-ink-600"><div>创建时间：{fmtDate(o.createdAt)}</div>{o.paidAt && <div>付款时间：{fmtDate(o.paidAt)}</div>}{o.payment && <div>支付方式：{PAY_NAMES[o.payment.provider]}</div>}{o.payment && <div>交易流水：{o.payment.tradeNo}</div>}{o.shippedAt && <div>发货时间：{fmtDate(o.shippedAt)}</div>}{o.doneAt && <div>完成时间：{fmtDate(o.doneAt)}</div>}{o.note && <div className="col-span-2">备注：{o.note}</div>}</div>
        </div>
        <div className="space-y-4">
          <div className="card p-5 text-sm"><div className="font-semibold mb-3">买家信息</div><div className="flex items-center gap-2"><Avatar src={u?.avatar} name="" size={32} /><span>{u?.nickname}</span>{u?.vip && <span className="tag-gold">88VIP</span>}</div><div className="mt-3 flex items-center gap-1.5 text-ink-700"><MapPin className="w-4 h-4 text-qn-500" />{o.address.name} <Phone className="w-3.5 h-3.5 ml-2" />{o.address.phone}</div><div className="text-ink-600 mt-1 ml-5">{o.address.region} {o.address.detail}</div></div>
          <div className="card p-5 text-sm"><div className="font-semibold mb-3">物流信息</div>{o.logistics ? <><div className="text-ink-600">{o.logistics.company} · <span className="font-num">{o.logistics.no}</span></div><ol className="mt-3 relative border-l border-ink-200 ml-2 space-y-3">{[...o.logistics.traces].reverse().map((t, i) => <li key={i} className="pl-4 relative"><span className={cls('absolute -left-[5px] top-1.5 w-2 h-2 rounded-full', i === 0 ? 'bg-qn-500 ring-4 ring-qn-100' : 'bg-ink-300')} /><div className="text-xs">{t.text}</div><div className="text-[11px] text-ink-400">{fmtDate(t.time)}</div></li>)}</ol></> : <div className="text-ink-400">尚未发货</div>}</div>
        </div>
      </div>
      <ShipModal order={shipOf} onClose={() => setShipOf(null)} onOk={(c, n) => { shipOrder(o.id, c, n); setShipOf(null); toast('发货成功') }} />
    </div>
  )
}

export function SellerRefunds() {
  const shop = useCurrentShop()
  const [sp] = useSearchParams()
  const { refunds, orders, users, updateRefund } = useDB()
  const [tab, setTab] = useState<string>(sp.get('tab') === 'pending' ? 'pending' : 'all')
  const my = refunds.filter(r => r.shopId === shop.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  const list = my.filter(r => tab === 'all' || r.status === tab)
  const cols: Column<Refund>[] = [
    { key: 'p', title: '商品', render: r => { const o = orders.find(x => x.id === r.orderId); return o ? <div className="flex gap-2 items-center"><Img src={o.items[0].image} alt="" w={44} h={44} className="w-11 h-11 rounded" /><div className="text-xs max-w-[220px]"><div className="line-clamp-1">{o.items[0].title}</div><div className="text-ink-400 font-num">{o.id}</div></div></div> : '-' } },
    { key: 'u', title: '买家', render: r => users.find(u => u.id === r.userId)?.nickname },
    { key: 'type', title: '类型', render: r => r.type === 'refund' ? '仅退款' : '退货退款' },
    { key: 'amount', title: '退款金额', render: r => <span className="price">¥{money(r.amount)}</span> },
    { key: 'reason', title: '原因', render: r => <div className="text-xs"><div>{r.reason}</div><div className="text-ink-400">{r.desc}</div></div> },
    { key: 'createdAt', title: '申请时间', render: r => <span className="text-xs">{fmtDate(r.createdAt)}</span> },
    { key: 'status', title: '状态', render: r => <span className={REFUND_STATUS[r.status].cls}>{REFUND_STATUS[r.status].label}</span> },
    { key: 'op', title: '操作', render: r => r.status === 'pending' ? <div className="flex gap-1"><button onClick={() => { updateRefund(r.id, { status: 'refunded' }); toast('已同意退款，款项原路退回') }} className="btn-qn btn-sm">同意</button><button onClick={() => { updateRefund(r.id, { status: 'rejected' }); toast('已拒绝') }} className="btn-outline btn-sm">拒绝</button></div> : r.status === 'approved' ? <button onClick={() => { updateRefund(r.id, { status: 'refunded' }); toast('退款完成') }} className="btn-qn btn-sm">确认收货并退款</button> : <Link to={`/seller/orders/${r.orderId}`} className="link">查看订单</Link> },
  ]
  return (
    <div>
      <PageHeader title="退款管理" desc="处理买家的退款/退货申请，超时未处理将自动同意。" />
      <div className="grid grid-cols-4 gap-3 mb-4"><Stat label="待处理" value={my.filter(r => r.status === 'pending').length} accent="text-amber-700" /><Stat label="退款中" value={my.filter(r => r.status === 'approved').length} /><Stat label="近30天退款金额" value={`¥${money(my.filter(r => r.status === 'refunded').reduce((a, r) => a + r.amount, 0))}`} /><Stat label="退款率" value={`${orders.filter(o => o.shopId === shop.id).length ? ((my.length / orders.filter(o => o.shopId === shop.id).length) * 100).toFixed(1) : 0}%`} /></div>
      <div className="card"><div className="px-5"><Tabs items={[{ key: 'all', label: '全部' }, { key: 'pending', label: '待处理', count: my.filter(r => r.status === 'pending').length }, { key: 'approved', label: '退款中' }, { key: 'refunded', label: '已退款' }, { key: 'rejected', label: '已拒绝' }]} value={tab} onChange={setTab} accent="qn" /></div><div className="p-5 pt-2"><Table columns={cols} data={list} empty="暂无退款申请" /></div></div>
    </div>
  )
}

export function SellerReviews() {
  const shop = useCurrentShop()
  const [sp] = useSearchParams()
  const { reviews, products, users, replyReview, orders } = useDB()
  const [top, setTop] = useState<'overview' | 'manage' | 'gift' | 'ask' | 'seed' | 'show'>('manage')
  const [sub, setSub] = useState<'from' | 'wait-seller' | 'wait-buyer' | 'to-buyer'>('from')
  const [type, setType] = useState(sp.get('tab') === 'bad' ? 'bad' : '')
  const [content, setContent] = useState('')
  const [replied, setReplied] = useState('')
  const [q, setQ] = useState('')
  const [sel, setSel] = useState<string[]>([])
  const [replyOf, setReplyOf] = useState<Review | null>(null)
  const [text, setText] = useState('')
  const [batch, setBatch] = useState(false)
  const [hideTip, setHideTip] = useState(false)
  const my = useMemo(() => reviews.filter(r => products.find(p => p.id === r.productId)?.shopId === shop.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt)), [reviews, products, shop.id])
  const list = my.filter(r => (!type || (type === 'good' ? r.rating >= 4 : type === 'mid' ? r.rating === 3 : r.rating <= 2)) && (!content || (content === 'text' ? !!r.content : content === 'img' ? r.images.length > 0 : content === 'append' ? !!r.reply : false)) && (!replied || (replied === 'yes' ? !!r.reply : !r.reply)) && (!q || r.content.includes(q) || users.find(u => u.id === r.userId)?.nickname.includes(q) || r.orderId.includes(q) || r.productId.includes(q)))
  const waitSeller = orders.filter(o => o.shopId === shop.id && (o.status === 'done' || o.status === 'received'))
  const avg = my.length ? my.reduce((a, r) => a + r.rating, 0) / my.length : 0
  const Chip = ({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) => <button onClick={onClick} className={cls('px-2.5 h-7 rounded text-xs', on ? 'bg-qn-50 text-qn-600 font-medium' : 'bg-ink-50 text-ink-600 hover:bg-ink-100')}>{children}</button>
  return (
    <div className="space-y-3">
      {!hideTip && <div className="rounded-xl border border-qn-200 bg-qn-50/40 px-5 h-12 flex items-center gap-3 text-sm"><span className="text-qn-600">🛡</span><span className="font-medium">开启风险评价智能防控</span><span className="text-xs text-ink-500">开启平台智能防控，自动识别异常评价，对店铺进行保护和提醒</span><button onClick={() => { toast('风险评价智能防控已开启'); setHideTip(true) }} className="btn-qn btn-sm rounded-full ml-2">去开启</button><button onClick={() => setHideTip(true)} className="btn-outline btn-sm rounded-full">不再提醒</button></div>}
      <div className="rounded-lg bg-qn-50 px-4 py-2.5 text-xs text-ink-700">ⓘ 评价业务规则及常见问题请点此查看：<span className="text-qn-600 ml-1">查看详情</span></div>
      <div className="card">
        <div className="px-5 border-b border-ink-100 flex items-center gap-10 text-[15px]">{([['overview', '数据概览', ''], ['manage', '评价管理', ''], ['gift', '评价有礼', 'New'], ['ask', '问大家', ''], ['seed', '种草', ''], ['show', '买家秀', 'New']] as const).map(([k, l, n]) => <button key={k} onClick={() => setTop(k)} className={cls('py-3.5 relative', top === k ? 'text-qn-600 font-medium' : 'text-ink-700')}>{l}{n && <sup className="text-brand-500 italic text-[10px] ml-0.5">{n}</sup>}{top === k && <span className="absolute left-0 right-0 bottom-0 h-0.5 bg-qn-500 rounded-full" />}</button>)}</div>
        <div className="p-5">
          {top === 'overview' && <div><div className="grid grid-cols-4 gap-3 mb-5"><Stat label="累计评价" value={my.length} /><Stat label="平均评分" value={avg.toFixed(2)} accent="text-brand-500" /><Stat label="好评率" value={`${my.length ? ((my.filter(r => r.rating >= 4).length / my.length) * 100).toFixed(1) : 0}%`} /><Stat label="待回复差评" value={my.filter(r => r.rating <= 3 && !r.reply).length} accent="text-amber-700" /></div><Bars data={days(14, i => ({ 好评: 2 + ((i * 7) % 9), 中差评: (i * 3) % 3 }))} keys={['好评', '中差评']} colors={['#10b981', '#f59e0b']} height={240} /></div>}
          {top === 'manage' && <>
            <div className="rounded-xl bg-gradient-to-r from-qn-50 to-sky-50 px-6 py-5 flex items-center gap-5"><span className="w-12 h-12 rounded-full bg-red-500 text-white flex items-center justify-center text-xl">¥</span><div className="flex-1"><div className="text-xl font-bold italic">开通<span className="text-red-500">评价有礼</span>，提升商品转化</div><div className="text-sm text-ink-600 mt-1">评价率提升<span className="text-red-500 font-semibold">50%</span> · 有图评价率提升<span className="text-red-500 font-semibold">80%</span> · 商品订单转化提升<span className="text-red-500 font-semibold">75%</span></div></div><button onClick={() => setTop('gift')} className="btn-qn rounded-full px-6">去开通</button></div>
            <div className="mt-5 flex items-center gap-6 text-sm">{([['from', '来自买家的评价'], ['wait-seller', '待卖家评价'], ['wait-buyer', '待买家评价'], ['to-buyer', '给买家的评价']] as const).map(([k, l], i) => <span key={k} className="flex items-center gap-6">{i > 0 && <span className="text-ink-200">|</span>}<button onClick={() => setSub(k)} className={sub === k ? 'text-qn-600 font-medium' : 'text-ink-700'}>{l}</button></span>)}</div>
            <div className="mt-4 flex items-center gap-3"><label className="input-qn w-72 flex items-center gap-2 px-3 bg-ink-50 border-transparent"><span className="text-ink-400 text-sm shrink-0">搜索</span><input aria-label="搜索评价" className="flex-1 bg-transparent outline-none text-sm min-w-0" placeholder="评价关键词/买家昵称/订单编号/商品ID" value={q} onChange={e => setQ(e.target.value)} /></label><div className="input-qn w-72 flex items-center gap-2 px-3 bg-ink-50 border-transparent text-sm text-ink-400"><span className="shrink-0">评价时间</span><input aria-label="起始日期" type="date" className="flex-1 bg-transparent outline-none min-w-0 text-ink-700" /><span>-</span><input aria-label="结束日期" type="date" className="flex-1 bg-transparent outline-none min-w-0 text-ink-700" /></div><button className="btn-outline rounded-full px-5" onClick={() => toast(`找到 ${list.length} 条评价`, 'info')}>搜索</button><button className="text-sm text-ink-600" onClick={() => { setType(''); setContent(''); setReplied(''); setQ('') }}>⟲ 清除条件</button><span className="ml-auto text-xs text-qn-600">评价不展示原因查询</span></div>
            <div className="mt-3 flex items-center gap-6 text-sm"><span className="flex items-center gap-2"><span className="text-ink-700">评价类型</span><Chip on={type === 'good'} onClick={() => setType(type === 'good' ? '' : 'good')}>好评</Chip><Chip on={type === 'mid'} onClick={() => setType(type === 'mid' ? '' : 'mid')}>中评</Chip><Chip on={type === 'bad'} onClick={() => setType(type === 'bad' ? '' : 'bad')}>差评</Chip></span><span className="flex items-center gap-2"><span className="text-ink-700">评价内容</span><Chip on={content === 'text'} onClick={() => setContent(content === 'text' ? '' : 'text')}>有内容</Chip><Chip on={content === 'img'} onClick={() => setContent(content === 'img' ? '' : 'img')}>有图片</Chip><Chip on={content === 'video'} onClick={() => setContent(content === 'video' ? '' : 'video')}>有视频</Chip><Chip on={content === 'append'} onClick={() => setContent(content === 'append' ? '' : 'append')}>有追评</Chip></span><span className="flex items-center gap-2"><span className="text-ink-700">商家回复</span><Chip on={replied === 'yes'} onClick={() => setReplied(replied === 'yes' ? '' : 'yes')}>已回复</Chip><Chip on={replied === 'no'} onClick={() => setReplied(replied === 'no' ? '' : 'no')}>未回复</Chip></span><span className="ml-auto text-xs text-ink-600">更多筛选 ⌄</span></div>
            {sub === 'from' ? <>
              <div className="mt-4 flex items-center gap-3"><button onClick={() => { if (!sel.length) return toast('请先勾选评价', 'error'); setBatch(true); setText('') }} className="btn-qn rounded-full px-5">批量回复</button><span className="text-sm text-ink-600">已选 {sel.length || ''}</span><span className="ml-auto text-sm text-ink-600">共{list.length}条 <span className="text-ink-400">‹ 1/1 ›</span></span></div>
              <table className="w-full text-sm mt-3"><thead><tr className="bg-ink-50 text-ink-700 text-left"><th className="px-3 py-3 w-10"><input type="checkbox" aria-label="全选" className="accent-qn-500" checked={list.length > 0 && list.every(r => sel.includes(r.id))} onChange={e => setSel(e.target.checked ? list.map(r => r.id) : [])} /></th><th className="px-3 py-3 font-medium">计分状态</th><th className="px-3 py-3 font-medium">评价内容</th><th className="px-3 py-3 font-medium">商品信息</th><th className="px-3 py-3 font-medium">买家信息</th><th className="px-3 py-3 font-medium">操作</th></tr></thead>
                <tbody>{list.slice(0, 20).map(r => { const u = users.find(x => x.id === r.userId); const p = products.find(x => x.id === r.productId); return (
                  <tr key={r.id} className="border-b border-ink-100 align-top"><td className="px-3 py-3"><input type="checkbox" aria-label="选择" className="accent-qn-500" checked={sel.includes(r.id)} onChange={e => setSel(e.target.checked ? [...sel, r.id] : sel.filter(x => x !== r.id))} /></td><td className="px-3 py-3"><span className={r.rating >= 4 ? 'tag-green' : r.rating === 3 ? 'tag-gold' : 'tag-red'}>{r.rating >= 4 ? '好评' : r.rating === 3 ? '中评' : '差评'}</span><div className="text-xs text-ink-400 mt-1">已计分</div></td><td className="px-3 py-3 max-w-md"><div className="flex items-center gap-2 mb-1"><Rating value={r.rating} /><span className="text-xs text-ink-400">{fmtDate(r.createdAt)}</span></div><div>{r.content}</div>{r.images.length > 0 && <div className="flex gap-1.5 mt-1.5">{r.images.map(s => <Img key={s} src={s} alt="买家晒图" w={48} h={48} className="w-12 h-12 rounded" />)}</div>}{r.reply && <div className="mt-2 text-xs bg-qn-50 rounded-lg p-2 text-ink-600"><span className="text-qn-600">商家回复：</span>{r.reply}</div>}</td><td className="px-3 py-3"><div className="flex gap-2 items-start"><Img src={p?.images[0] ?? ''} alt="" w={44} h={44} className="w-11 h-11 rounded shrink-0" /><div className="text-xs"><div className="line-clamp-2 max-w-[200px]">{p?.title}</div><div className="text-ink-400 mt-0.5">{r.skuText}</div><div className="text-ink-400 font-num">订单 {r.orderId.slice(-10)}</div></div></div></td><td className="px-3 py-3"><div className="flex items-center gap-1.5 text-xs"><Avatar src={u?.avatar} name="" size={22} /><span>{u?.nickname}</span></div>{u?.vip && <span className="tag-gold mt-1">88VIP</span>}</td><td className="px-3 py-3 text-xs"><div className="flex flex-col gap-1">{!r.reply && <button onClick={() => { setReplyOf(r); setText('') }} className="link">回复</button>}<button onClick={() => toast('已申请评价不展示，平台 3 个工作日内审核', 'info')} className="link text-ink-500">申请不展示</button><button onClick={() => toast('已标记', 'info')} className="link text-ink-500">标记</button></div></td></tr>
                ) })}</tbody></table>
              {list.length === 0 && <div className="text-center text-ink-400 text-sm py-10">没有数据</div>}
              <div className="flex items-center justify-between text-xs text-ink-500 py-3"><span>每页显示：<span className="text-qn-600">20</span> 条</span><span>共{list.length}条 · 上一页 1 下一页</span></div>
            </> : sub === 'wait-seller' ? <div className="mt-4">{waitSeller.length === 0 ? <div className="text-center text-ink-400 text-sm py-10">没有数据</div> : waitSeller.slice(0, 10).map(o => <div key={o.id} className="flex items-center gap-3 py-3 border-b border-ink-100"><Img src={o.items[0].image} alt="" w={44} h={44} className="w-11 h-11 rounded" /><div className="flex-1 text-sm line-clamp-1">{o.items[0].title}</div><span className="text-xs text-ink-400">买家 {users.find(u => u.id === o.userId)?.nickname}</span><button onClick={() => toast('已给买家好评')} className="btn-outline btn-sm">给买家好评</button></div>)}</div>
              : <div className="text-center text-ink-400 text-sm py-10">没有数据</div>}
          </>}
          {top === 'gift' && <div className="max-w-3xl"><div className="rounded-xl bg-gradient-to-r from-brand-50 to-amber-50 p-6"><div className="text-xl font-bold">评价有礼</div><div className="text-sm text-ink-600 mt-1">买家确认收货后发布评价即可获得现金红包 / 优惠券，官方工具有效提升评价率。</div><div className="grid grid-cols-3 gap-3 mt-4">{[['现金奖励', '每条有图评价奖励 ¥2，由店铺承担'], ['优惠券奖励', '评价后自动发放店铺券，促进复购'], ['智能托管', '系统按商品自动配置奖励额度']].map(([t, d]) => <div key={t} className="bg-white rounded-xl p-4"><div className="font-medium">{t}</div><div className="text-xs text-ink-500 mt-1">{d}</div></div>)}</div><button onClick={() => toast('评价有礼已开通（手动现金活动）')} className="btn-qn mt-4">立即开通</button></div></div>}
          {(top === 'ask' || top === 'seed' || top === 'show') && <div className="text-center text-ink-400 text-sm py-16">{top === 'ask' ? '暂无买家提问，去商品详情页引导买家提问吧' : top === 'seed' ? '暂无种草内容，前往内容中心创作' : '暂无买家秀，开通评价有礼鼓励买家晒图'}</div>}
        </div>
      </div>
      <Modal open={!!replyOf || batch} onClose={() => { setReplyOf(null); setBatch(false) }} title={batch ? `批量回复（${sel.length} 条）` : '回复评价'} width={480} footer={<><button className="btn-outline" onClick={() => { setReplyOf(null); setBatch(false) }}>取消</button><button className="btn-qn" disabled={!text} onClick={() => { if (batch) { sel.forEach(id => replyReview(id, text)); setSel([]); setBatch(false) } else { replyReview(replyOf!.id, text); setReplyOf(null) } toast('回复成功') }}>发布回复</button></>}>{replyOf && <div className="text-sm bg-ink-50 rounded-lg p-3 mb-3">{replyOf.content}</div>}<textarea className="input-qn h-24 py-2" value={text} onChange={e => setText(e.target.value)} placeholder="感谢亲的支持…" /><div className="flex gap-2 mt-2 flex-wrap">{['感谢亲的支持，欢迎再次光临～', '非常抱歉给您带来不好的体验，我们会持续改进。', '您的满意是我们最大的动力！'].map(t => <button key={t} onClick={() => setText(t)} className="tag-blue h-6 px-2 cursor-pointer">{t.slice(0, 12)}…</button>)}</div></Modal>
    </div>
  )
}

export function Logistics() {
  const shop = useCurrentShop()
  const [sp] = useSearchParams()
  const tab = sp.get('tab') ?? 'data'
  const [view, setView] = useState<'overview' | 'detail' | 'diagnose' | 'violation'>('overview')
  const [range, setRange] = useState<'day' | 'week' | 'month'>('week')
  const { orders } = useDB()
  const my = orders.filter(o => o.shopId === shop.id && o.logistics)
  const byCompany = useMemo(() => { const m: Record<string, number> = {}; my.forEach(o => { m[o.logistics!.company] = (m[o.logistics!.company] ?? 0) + 1 }); return Object.entries(m).map(([name, 单量]) => ({ name, 单量 })) }, [my])
  const trend = useMemo(() => days(7, i => ({ 创建运单量: 3 + ((i * 7) % 9), 签收运单量: 2 + ((i * 5) % 8) })), [])
  const titles: Record<string, string> = { data: '物流数据', send: '寄快递', print: '打单工具', packages: '包裹中心' }
  const start = fmtDate(new Date(Date.now() - (range === 'day' ? 1 : range === 'week' ? 7 : 30) * 864e5).toISOString(), false), end = fmtDate(new Date(Date.now() - 864e5).toISOString(), false)
  const has = my.length > 0
  const Metric = ({ l, v, sub, link }: { l: string; v: string; sub: string; link?: boolean }) => <div className="p-5 border-r border-b border-ink-100 last:border-r-0"><div className="text-xs text-ink-600">{l} <span className="text-ink-400">ⓘ</span>{link && <span className="text-qn-600 ml-1">明细</span>}</div><div className="text-2xl font-num font-semibold mt-2">{v}</div><div className="text-xs text-ink-400 mt-2">{sub}</div></div>
  if (tab === 'send' || tab === 'print') return (
    <div><PageHeader title={titles[tab]} desc="在线下单寄件与电子面单打印。" /><div className="card p-6 max-w-2xl"><div className="grid grid-cols-2 gap-4"><Field label="物流公司"><select className="input-qn">{EXPRESS.map(e => <option key={e}>{e}</option>)}</select></Field><Field label="寄件地址"><input className="input-qn" defaultValue={shop.address} /></Field><Field label="收件人"><input className="input-qn" placeholder="姓名" /></Field><Field label="收件电话"><input className="input-qn" placeholder="手机号" /></Field><div className="col-span-2"><Field label="收件地址"><input className="input-qn" placeholder="省市区 + 详细地址" /></Field></div></div><div className="mt-4 flex gap-2"><button className="btn-qn" onClick={() => toast(tab === 'send' ? '已下单，快递员将在 2 小时内上门取件' : '面单已发送至打印机')}>{tab === 'send' ? '立即下单' : '打印面单'}</button><button className="btn-outline">保存模板</button></div></div></div>
  )
  if (tab === 'packages') return (
    <div><PageHeader title="包裹中心" desc="在途、异常与已签收包裹追踪。" /><div className="grid grid-cols-4 gap-3 mb-4"><Stat label="待发货" value={orders.filter(o => o.shopId === shop.id && o.status === 'paid').length} accent="text-qn-600" /><Stat label="运输中" value={my.filter(o => o.status === 'shipped').length} /><Stat label="已签收" value={my.filter(o => o.status !== 'shipped').length} /><Stat label="异常包裹" value={0} /></div><div className="card p-5"><table className="w-full text-sm"><thead><tr className="bg-ink-50 text-ink-500 text-left"><th className="px-3 py-2.5 font-medium">订单号</th><th className="px-3 py-2.5 font-medium">快递公司</th><th className="px-3 py-2.5 font-medium">运单号</th><th className="px-3 py-2.5 font-medium">收件人</th><th className="px-3 py-2.5 font-medium">最新轨迹</th><th className="px-3 py-2.5 font-medium">状态</th></tr></thead><tbody>{my.slice(0, 20).map(o => <tr key={o.id} className="border-b border-ink-100"><td className="px-3 py-2.5 font-num text-xs"><Link to={`/seller/orders/${o.id}`} className="link">{o.id}</Link></td><td className="px-3 py-2.5">{o.logistics!.company}</td><td className="px-3 py-2.5 font-num text-xs">{o.logistics!.no}</td><td className="px-3 py-2.5">{o.address.name}</td><td className="px-3 py-2.5 text-xs text-ink-500 max-w-xs truncate">{o.logistics!.traces.at(-1)?.text}</td><td className="px-3 py-2.5">{o.status === 'shipped' ? <span className="tag-blue">运输中</span> : <span className="tag-green">已签收</span>}</td></tr>)}</tbody></table>{my.length === 0 && <Empty text="暂无包裹" />}</div></div>
  )
  return (
    <div className="card">
      <div className="px-5 flex items-center gap-8 border-b border-ink-100 text-[15px]">{([['overview', '总览'], ['detail', '明细'], ['diagnose', '诊断'], ['violation', '违规']] as const).map(([k, l]) => <button key={k} onClick={() => setView(k)} className={cls('py-3.5 relative', view === k ? 'text-qn-600 font-medium' : 'text-ink-700')}>{l}{view === k && <span className="absolute left-0 right-0 bottom-0 h-0.5 bg-qn-500 rounded-full" />}</button>)}</div>
      <div className="p-5 space-y-6">
        {view === 'overview' && <>
          <div>
            <div className="flex items-center justify-between"><div className="font-semibold text-lg">核心指标</div><div className="flex items-center gap-3 text-xs text-ink-600"><span>{start}~ {end}</span>{(['day', 'week', 'month'] as const).map(r => <button key={r} onClick={() => setRange(r)} className={range === r ? 'text-qn-600 font-medium' : ''}>{{ day: '日', week: '周', month: '月' }[r]}</button>)}<span>自定义 ⌄</span><span className="border border-ink-200 rounded px-2 py-0.5">环比</span><span className="border border-qn-300 text-qn-600 rounded px-2 py-0.5">同比</span></div></div>
            <div className="mt-3 border border-ink-100 rounded-xl grid grid-cols-[1fr_1fr_1fr_1fr_400px] overflow-hidden"><div className="col-span-4 grid grid-cols-4"><div className="col-span-4 h-1 bg-ink-900" /><Metric l="创建运单量" v={has ? String(my.length) : '-'} sub={has ? '同比 +12%' : '同比 -- %'} /><Metric l="发货运单量" v={has ? String(my.length) : '-'} sub={has ? '同比 +8%' : '同比 -- %'} /><Metric l="揽收运单量" v={has ? String(my.length) : '-'} sub={has ? '同比 +8%' : '同比 -- %'} /><Metric l="签收运单量" v={has ? String(my.filter(o => o.status !== 'shipped').length) : '-'} sub={has ? '同比 +5%' : '同比 -- %'} /><Metric l="当日揽收率" v={has ? '96.2%' : '--'} sub={has ? '同比 +1.2pt' : '同比 -- pt'} /><Metric l="48小时揽收率" v={has ? '98.7%' : '--'} sub={has ? '同比 +0.8pt' : '同比 -- pt'} /><Metric l="发货地表达准确率" v={has ? '100%' : '--'} sub={has ? '同比 持平' : '同比 -- pt'} link /><Metric l="退货在途包裹" v={has ? '0' : '-'} sub={has ? '同比 -100%' : '同比 -- %'} link /></div><div className="p-4 border-l border-ink-100"><div className="text-xs font-medium border-l-2 border-qn-500 pl-2">创建运单量</div>{has ? <div className="mt-2"><TrendLine data={trend} keys={['创建运单量', '签收运单量']} height={220} /></div> : <div className="h-56 flex items-center justify-center text-ink-300">📈</div>}</div></div>
          </div>
          <div className="grid grid-cols-[1fr_400px] gap-5">
            <div><div className="flex items-center justify-between"><div className="font-semibold text-lg">物流体验分</div><div className="text-xs text-ink-600 flex items-center gap-3"><span>{fmtDate(new Date(Date.now() - 30 * 864e5).toISOString(), false)} ~ {end}</span><span className="text-qn-600">截止日 ⌄</span><span>|</span><Link to="/seller/shop/score" className="hover:text-qn-600">真实体验分</Link><span>|</span><span>物流诊断</span></div></div>
              <div className="mt-3 border border-ink-100 rounded-xl p-5 grid grid-cols-[1fr_200px] gap-6"><div><div className="text-sm text-ink-600">物流速度分</div><div className="mt-2 text-2xl font-num font-bold text-qn-600">{has ? '4.86' : '---'} <span className="text-xs text-ink-400 font-normal">/ 满分5</span></div><div className="grid grid-cols-3 gap-4 mt-6 text-xs">{[['48小时揽收及时率', has ? '98.7%' : '-', has ? '82%' : '--%'], ['到货时长', has ? '2.1小时' : '-小时', has ? '75%' : '--%'], ['物流异常率', has ? '0.3%' : '-', has ? '90%' : '--%']].map(([l, v, p]) => <div key={l}><div className="text-ink-600">{l} ⓘ <span className="text-qn-600">解读</span></div><div className="text-lg font-num font-semibold mt-1">{v}</div><div className="text-ink-400 mt-1">超过 <span className="text-ink-700">{p}</span> 同行</div></div>)}</div></div><div className="border-l border-ink-100 pl-6"><div className="text-sm text-ink-600">物流附加分</div><div className="mt-2 text-2xl font-num font-bold text-qn-600">{has ? '+0.2' : '--'}</div><div className="mt-6 text-xs"><div className="text-ink-600">今/明日达占比 ⓘ <span className="text-qn-600">解读</span></div><div className="text-lg font-num font-semibold mt-1">{has ? '36%' : '-'}</div><div className="text-ink-400 mt-1">超过 <span className="text-ink-700">{has ? '61%' : '--%'}</span> 同行</div></div></div></div>
            </div>
            <div><div className="flex items-center justify-between"><div className="font-semibold text-lg">物流违规</div><div className="text-xs text-ink-600 flex items-center gap-3"><span>实时更新</span><span>☑ 违规率</span><span>☰ 规则详情</span></div></div><div className="mt-3 border border-ink-100 rounded-xl grid grid-cols-2">{[['延迟发货', 0], ['虚假发货', 0], ['缺货', 0], ['物流轨迹异常', 0]].map(([l, n], i) => <div key={l as string} className={cls('p-5', i % 2 === 0 && 'border-r border-ink-100', i < 2 && 'border-b border-ink-100')}><div className="text-xs text-ink-600">{l as string} ⓘ</div><div className="text-2xl font-num font-bold mt-2">{n as number}</div><div className="text-xs text-ink-400 mt-2">--</div></div>)}</div></div>
          </div>
          <div><div className="flex items-center justify-between"><div className="font-semibold text-lg">时效 & 官方上门</div><div className="text-xs text-ink-600">{start} ~ {end} · 日 周 月 自定义</div></div><div className="mt-3 border border-ink-100 rounded-xl p-5 grid grid-cols-3 gap-6">{[['实际次日内送达单量', '--'], ['表达次日内送达占比', '--'], ['表达次日内送达达成率', '--']].map(([l, v]) => <div key={l}><div className="text-xs text-ink-600">{l}</div><div className="text-2xl font-num font-bold mt-2">{v}</div></div>)}<div className="col-span-3 text-xs text-ink-500">您未获取“官方上门”故暂无数据。获取后，可要求快递为买家送货上门，提升满意度及转化 <Link to="/seller/logistics/service" className="text-qn-600">了解更多</Link></div></div></div>
        </>}
        {view === 'detail' && <div><div className="font-semibold mb-3">快递公司分布</div><Bars data={byCompany} keys={['单量']} height={220} colors={['#10b981']} /><table className="w-full text-sm mt-5"><thead><tr className="bg-ink-50 text-ink-500 text-left"><th className="px-3 py-2.5 font-medium">订单号</th><th className="px-3 py-2.5 font-medium">快递公司</th><th className="px-3 py-2.5 font-medium">运单号</th><th className="px-3 py-2.5 font-medium">发货时间</th><th className="px-3 py-2.5 font-medium">状态</th></tr></thead><tbody>{my.slice(0, 15).map(o => <tr key={o.id} className="border-b border-ink-100"><td className="px-3 py-2.5 font-num text-xs"><Link to={`/seller/orders/${o.id}`} className="link">{o.id}</Link></td><td className="px-3 py-2.5">{o.logistics!.company}</td><td className="px-3 py-2.5 font-num text-xs">{o.logistics!.no}</td><td className="px-3 py-2.5 text-xs">{fmtDate(o.shippedAt)}</td><td className="px-3 py-2.5">{o.status === 'shipped' ? <span className="tag-blue">运输中</span> : <span className="tag-green">已签收</span>}</td></tr>)}</tbody></table>{my.length === 0 && <Empty text="暂无运单" />}</div>}
        {view === 'diagnose' && <div className="grid grid-cols-3 gap-4">{[['揽收时效', '良好', '48小时揽收率 98.7%，高于同行 82%', true], ['到货时长', '良好', '平均 2.1 天，建议开通官方上门进一步提升', true], ['发货地准确率', '优秀', '100% 准确', true], ['物流异常', '待优化', '近 30 天 1 单轨迹停滞，建议联系快递', false], ['退货时效', '良好', '退货签收平均 1.2 天', true], ['官方上门', '未开通', '开通后可提升买家满意度 8%', false]].map(([t, s, d, ok]) => <div key={t as string} className="rounded-xl border border-ink-100 p-4"><div className="flex items-center justify-between"><span className="font-medium">{t as string}</span><span className={ok ? 'tag-green' : 'tag-gold'}>{s as string}</span></div><div className="text-xs text-ink-500 mt-2">{d as string}</div></div>)}</div>}
        {view === 'violation' && <div className="text-center text-ink-400 text-sm py-16">近 90 天无物流违规记录 🎉</div>}
      </div>
    </div>
  )
}
