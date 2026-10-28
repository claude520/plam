// 独立收银台：订单列表「立即付款」与 PayOS 支付完成后的回跳页
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { useState } from 'react'
import { Check } from 'lucide-react'
import { useDB } from '@/store/db'
import { PayBox } from '@/components/PayBox'
import { money, PAY_NAMES } from '@/lib/format'
import { fmtAddr } from '@/lib/address'
import { Empty } from '@/components/ui'

export default function Pay() {
  const { id } = useParams()
  const [sp] = useSearchParams()
  const order = useDB(s => s.orders.find(o => o.id === id))
  const [paidBy, setPaidBy] = useState<string | null>(null)
  if (!order) return <div className="container-x py-10"><div className="card p-10"><Empty text="订单不存在或尚未同步，请稍后刷新" /></div></div>
  const paid = paidBy || order.status !== 'unpaid'
  return (
    <div className="container-x py-6 max-w-4xl">
      {paid ? (
        <div className="card p-12 text-center">
          <div className="w-20 h-20 mx-auto rounded-full bg-emerald-50 flex items-center justify-center"><Check className="w-10 h-10 text-emerald-500" /></div>
          <div className="text-2xl font-semibold mt-4">支付成功</div>
          <div className="text-ink-500 mt-2">实付 <span className="price text-xl">¥{money(order.payAmount)}</span> · 通过 {PAY_NAMES[paidBy ?? order.payment?.provider ?? ''] ?? '-'} · 订单号 {order.id}</div>
          <div className="flex flex-col sm:flex-row justify-center gap-3 mt-8"><Link to={`/my/orders/${order.id}`} className="btn-primary btn-lg px-8">查看订单</Link><Link to="/" className="btn-outline btn-lg px-8">继续购物</Link></div>
        </div>
      ) : order.status === 'unpaid' ? (
        <div className="card p-4 md:p-6">
          <div className="flex items-start justify-between gap-4 mb-5"><div><div className="font-semibold text-lg">收银台</div><div className="text-xs text-ink-500 mt-1">订单号 {order.id} · {order.items.length} 件商品 · 寄送至 {fmtAddr(order.address)}</div></div><div className="price text-3xl shrink-0">¥{money(order.payAmount)}</div></div>
          {sp.get('cancel') && <div className="mb-4 rounded-lg bg-amber-50 text-amber-700 text-sm px-3 py-2">你已取消 PayOS 支付，可重新选择支付方式。</div>}
          <PayBox order={order} onPaid={setPaidBy} initialProvider={sp.get('p') ?? undefined} autoPoll={sp.get('p') === 'payos' && sp.get('r') === '1'} />
        </div>
      ) : null}
    </div>
  )
}
