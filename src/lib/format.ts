import type { OrderStatus, ProductStatus, RefundStatus } from '@/data/types'

export const money = (n: number, digits = 2) => {
  const v = Number(n || 0)
  return v.toLocaleString('zh-CN', { minimumFractionDigits: digits, maximumFractionDigits: digits })
}
export const compact = (n: number) => n >= 10000 ? `${(n / 10000).toFixed(n >= 100000 ? 0 : 1)}万` : String(n)
export const fmtDate = (iso?: string, withTime = true) => {
  if (!iso) return '-'
  const d = new Date(iso)
  const p = (x: number) => String(x).padStart(2, '0')
  const date = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
  return withTime ? `${date} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}` : date
}
export const timeAgo = (iso: string) => {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return '刚刚'
  if (m < 60) return `${m} 分钟前`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h} 小时前`
  const d = Math.floor(h / 24)
  if (d < 30) return `${d} 天前`
  return fmtDate(iso, false)
}

export const ORDER_STATUS: Record<OrderStatus, { label: string; color: string; buyer: string; seller: string }> = {
  unpaid: { label: '待付款', color: 'text-brand-500', buyer: '等待买家付款', seller: '等待买家付款' },
  paid: { label: '待发货', color: 'text-qn-600', buyer: '买家已付款，等待卖家发货', seller: '买家已付款' },
  shipped: { label: '待收货', color: 'text-qn-600', buyer: '卖家已发货', seller: '卖家已发货' },
  received: { label: '待评价', color: 'text-emerald-600', buyer: '交易成功', seller: '交易成功' },
  done: { label: '交易成功', color: 'text-emerald-600', buyer: '交易成功', seller: '交易成功' },
  closed: { label: '交易关闭', color: 'text-ink-400', buyer: '交易关闭', seller: '交易关闭' },
  refunding: { label: '退款中', color: 'text-amber-600', buyer: '退款处理中', seller: '买家申请退款' },
}
export const PRODUCT_STATUS: Record<ProductStatus, { label: string; cls: string }> = {
  on: { label: '出售中', cls: 'tag-green' }, off: { label: '仓库中', cls: 'tag-gray' }, pending: { label: '审核中', cls: 'tag-gold' },
  rejected: { label: '已驳回', cls: 'tag-red' }, draft: { label: '草稿', cls: 'tag-gray' },
}
export const REFUND_STATUS: Record<RefundStatus, { label: string; cls: string }> = {
  pending: { label: '待处理', cls: 'tag-gold' }, approved: { label: '已同意', cls: 'tag-blue' }, rejected: { label: '已拒绝', cls: 'tag-red' },
  refunded: { label: '退款成功', cls: 'tag-green' }, cancelled: { label: '已撤销', cls: 'tag-gray' },
}
export const PAY_NAMES: Record<string, string> = { wechat: '微信支付', alipay: '支付宝', unionpay: '银联云闪付', stripe: 'Stripe', paypal: 'PayPal', balance: '余额支付' }
export const cls = (...a: (string | false | null | undefined)[]) => a.filter(Boolean).join(' ')
