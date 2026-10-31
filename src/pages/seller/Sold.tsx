// 千牛 · 已卖出宝贝 与 发货（参照 myseller.taobao.com trade-platform/tp/sold 与 batch-consign）
import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { MessageSquare, RotateCcw, MapPin, Search, ChevronRight, Flag, Filter, Copy, Truck } from 'lucide-react'
import { useDB } from '@/store/db'
import { useCurrentShop } from '@/lib/hooks'
import { fmtAddr, fmtPhone, COUNTRIES, countryOf } from '@/lib/address'
import { Img, Modal } from '@/components/ui'
import { cls, fmtDate, money, PAY_NAMES } from '@/lib/format'
import { toast } from '@/store/session'
import type { Order, Product, Refund } from '@/data/types'

export const EXPRESS = ['顺丰速运', '中通快递', '圆通速递', '韵达快递', '申通快递', '京东物流', '极兔速递', '邮政EMS', 'DHL', 'FedEx', 'Viettel Post', 'J&T Express']
export const FLAGS = ['', '#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#a855f7']
const FLAG_NAMES = ['无', '红', '黄', '绿', '蓝', '紫']
/** 卖家视角交易状态（与千牛一致） */
const SELLER_STATUS: Record<Order['status'], string> = { unpaid: '等待买家付款', paid: '买家已付款', shipped: '卖家已发货', received: '交易成功', done: '交易成功', closed: '交易关闭', refunding: '退款中' }
const VIRTUAL_HINT = ['虚拟', '数字', '游戏', '会员', '充值', '卡券', '账号', '软件', '服务', 'token', '订阅']

export const mask = (s?: string) => s ? s.slice(0, 1) + '**' : '**'
const day = (iso?: string) => iso ? fmtDate(iso, false) : ''
const inRange = (iso: string | undefined, r: [string, string]) => (!r[0] || (!!iso && day(iso) >= r[0])) && (!r[1] || (!!iso && day(iso) <= r[1]))
const hoursSince = (iso?: string) => iso ? (Date.now() - new Date(iso).getTime()) / 3600e3 : 0
export const copy = (t: string) => { navigator.clipboard?.writeText(t).then(() => toast('已复制'), () => toast(t, 'info')) }

/** 是否虚拟 / 无货源订单：已按无需物流发货，或商品类目、标题属于虚拟类 */
export function isVirtual(o: Order, products: Product[]) {
  if (o.shipType === 'none') return true
  return o.items.every(it => { const p = products.find(x => x.id === it.productId); const text = `${p?.pub?.catPath.join(' ') ?? ''} ${it.title}`.toLowerCase(); return VIRTUAL_HINT.some(k => text.includes(k.toLowerCase())) })
}
/** 上次使用的发货方式（无货源商家一般固定用无需物流） */
const lastMethod = (): ShipMethod => { try { return (localStorage.getItem('plam-ship-method') as ShipMethod) || 'express' } catch { return 'express' } }
type ShipMethod = 'online' | 'express' | 'none'

function downloadCsv(name: string, rows: (string | number)[][]) {
  const csv = '﻿' + rows.map(r => r.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n')
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  a.download = name
  a.click()
  URL.revokeObjectURL(a.href)
}

// ———————————————————————— 已卖出宝贝 ————————————————————————

const EMPTY_F = { status: '', title: '', pay: '', name: '', phone: '', after: '', rate: '', ship: '', otype: '', warn: '', note: '', hideClosed: false, created: ['', ''] as [string, string], paid: ['', ''] as [string, string], done: ['', ''] as [string, string] }
type F = typeof EMPTY_F

export function SellerOrders() {
  const shop = useCurrentShop()
  const [sp, setSp] = useSearchParams()
  const tab = sp.get('tab') ?? 'recent'
  const { orders, users, products, refunds, reviews, setOrderStatus, updateOrder } = useDB()
  const [q, setQ] = useState(sp.get('q') ?? '')
  const [f, setF] = useState<F>(EMPTY_F)
  const [expanded, setExpanded] = useState(true)
  const [sel, setSel] = useState<string[]>([])
  const [page, setPage] = useState(1)
  const [shipOf, setShipOf] = useState<Order[]>([])
  const [reshipOf, setReshipOf] = useState<Order | null>(null)
  const [noteOf, setNoteOf] = useState<Order[]>([])
  const [rateOf, setRateOf] = useState<Order | null>(null)
  const [extendOf, setExtendOf] = useState<Order | null>(null)
  const [batchQ, setBatchQ] = useState<string | null>(null)
  const PER = 15
  const my = useMemo(() => orders.filter(o => o.shopId === shop.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt)), [orders, shop.id])
  const refundOf = (o: Order): Refund | undefined => refunds.filter(r => r.orderId === o.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]
  const within3m = (o: Order) => hoursSince(o.createdAt) < 90 * 24
  const tabFilter = (o: Order) => {
    switch (tab) {
      case 'recent': return within3m(o)
      case 'old': return !within3m(o)
      case 'confirming': return o.status === 'paid' && hoursSince(o.paidAt ?? o.createdAt) < 1
      case 'timeout-soon': return o.status === 'paid' && hoursSince(o.paidAt ?? o.createdAt) > 36 && hoursSince(o.paidAt ?? o.createdAt) <= 48
      case 'timeout': return o.status === 'paid' && hoursSince(o.paidAt ?? o.createdAt) > 48
      case 'done': return o.status === 'done' || o.status === 'received'
      default: return o.status === tab
    }
  }
  const qs = q.split(/[\s,，]+/).filter(Boolean)
  const list = useMemo(() => my.filter(o => {
    if (!tabFilter(o)) return false
    const buyer = users.find(u => u.id === o.userId)
    if (qs.length && !qs.some(k => o.id.includes(k) || o.logistics?.no.includes(k) || o.items.some(i => i.productId === k) || buyer?.nickname.includes(k))) return false
    if (f.status && !(f.status === 'done' ? o.status === 'done' || o.status === 'received' : o.status === f.status)) return false
    if (f.title && !o.items.some(i => i.title.includes(f.title))) return false
    if (f.pay && o.payment?.provider !== f.pay) return false
    if (f.name && !o.address.name.includes(f.name)) return false
    if (f.phone && !o.address.phone.includes(f.phone.replace(/\D/g, ''))) return false
    if (f.after && (f.after === 'yes' ? !refundOf(o) : !!refundOf(o))) return false
    if (f.rate) { const rated = reviews.some(r => r.orderId === o.id); if (f.rate === 'buyer-yes' ? !rated : f.rate === 'buyer-no' ? rated || !(o.status === 'received' || o.status === 'done') : f.rate === 'seller-yes' ? !o.rateBuyer : !!o.rateBuyer) return false }
    if (f.ship && (o.shipType ?? (o.logistics ? 'express' : '')) !== f.ship) return false
    if (f.otype && (f.otype === 'live' ? !o.liveId : f.otype === 'ad' ? !o.adPlanId : f.otype === 'virtual' ? !isVirtual(o, products) : !!o.liveId || !!o.adPlanId)) return false
    if (f.warn && !(o.status === 'paid' && hoursSince(o.paidAt ?? o.createdAt) > (f.warn === 'soon' ? 36 : 48))) return false
    if (f.note && (f.note === 'yes' ? !o.note && !o.flag : f.note === 'no' ? !!o.note || !!o.flag : o.flag !== Number(f.note))) return false
    if (f.hideClosed && o.status === 'closed') return false
    return inRange(o.createdAt, f.created) && inRange(o.paidAt, f.paid) && inRange(o.doneAt, f.done)
  }), [my, tab, q, f, users, refunds, reviews, products]) // eslint-disable-line react-hooks/exhaustive-deps
  const pages = Math.max(1, Math.ceil(list.length / PER))
  const cur = Math.min(page, pages)
  const rows = list.slice((cur - 1) * PER, cur * PER)
  const tabs = [['recent', '近3个月'], ['unpaid', '待付款'], ['confirming', '确认中'], ['paid', '待发货'], ['timeout-soon', '即将超时'], ['timeout', '发货已超时'], ['shipped', '已发货'], ['refunding', '退款中'], ['done', '已成功'], ['closed', '已关闭'], ['old', '3个月前']]
  const set = (patch: Partial<F>) => { setF({ ...f, ...patch }); setPage(1) }
  const Sel = ({ label, k, options }: { label: string; k: keyof F; options: [string, string][] }) => <label className="input-qn flex items-center gap-2 px-3 text-sm"><span className="text-ink-400 shrink-0">{label}</span><select aria-label={label} className="flex-1 outline-none bg-transparent min-w-0" value={f[k] as string} onChange={e => set({ [k]: e.target.value })}><option value="">全部</option>{options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
  const Inp = ({ label, k, placeholder }: { label: string; k: keyof F; placeholder?: string }) => <label className="input-qn flex items-center gap-2 px-3 text-sm"><span className="text-ink-400 shrink-0">{label}</span><input aria-label={label} className="flex-1 outline-none bg-transparent min-w-0" placeholder={placeholder} value={f[k] as string} onChange={e => set({ [k]: e.target.value })} /></label>
  const DateRange = ({ label, k }: { label: string; k: 'created' | 'paid' | 'done' }) => <div className="input-qn flex items-center gap-2 px-3 text-sm text-ink-400"><span className="shrink-0">{label}</span><input aria-label={`${label}起始`} type="date" className="flex-1 outline-none bg-transparent min-w-0 text-ink-700" value={f[k][0]} onChange={e => set({ [k]: [e.target.value, f[k][1]] })} /><span>-</span><input aria-label={`${label}结束`} type="date" className="flex-1 outline-none bg-transparent min-w-0 text-ink-700" value={f[k][1]} onChange={e => set({ [k]: [f[k][0], e.target.value] })} /></div>
  const picked = () => my.filter(o => sel.includes(o.id))
  const exportCsv = () => {
    downloadCsv(`已卖出宝贝_${day(new Date().toISOString())}.csv`, [['订单编号', '买家', '创建时间', '付款时间', '宝贝', '规格', '数量', '单价', '实收款', '运费', '交易状态', '支付方式', '收件人', '手机', '地址', '物流公司', '运单号', '卖家备注'],
      ...list.flatMap(o => o.items.map(it => [o.id, users.find(u => u.id === o.userId)?.nickname ?? '', fmtDate(o.createdAt), fmtDate(o.paidAt), it.title, it.skuText, it.qty, it.price, o.payAmount, o.freight, SELLER_STATUS[o.status], o.payment ? PAY_NAMES[o.payment.provider] ?? o.payment.provider : '', o.address.name, fmtPhone(o.address), fmtAddr(o.address), o.logistics?.company ?? '', o.logistics?.no ?? '', o.note ?? '']))])
    toast(`已导出 ${list.length} 笔订单`)
  }
  return (
    <div className="space-y-3">
      <div className="rounded-xl bg-gradient-to-r from-rose-50 via-pink-50 to-rose-50 min-h-[48px] py-2 flex items-center justify-center px-4 md:px-5 gap-3 text-sm keep-flex overflow-hidden"><span className="w-7 h-7 rounded-lg bg-red-600 text-white flex items-center justify-center shrink-0"><RotateCcw className="w-4 h-4" /></span><span className="tag-red hidden sm:inline-flex">新功能</span><span className="font-semibold text-red-600 text-sm md:text-base whitespace-nowrap">换货自动同意，售后处理更省心</span><span className="tag bg-white text-red-600 border border-red-100 hidden lg:inline-flex">● 快捷处理售后单</span><span className="tag bg-white text-red-600 border border-red-100 hidden lg:inline-flex">● 审核效率提升</span><button onClick={() => toast('已开启换货自动同意')} className="btn btn-sm bg-red-600 text-white hover:bg-red-700 rounded-full px-5 shrink-0">立即开启</button></div>
      <div className="card px-5 py-3 text-sm text-ink-700">📢 已卖出宝贝满意度调研，请留下您的宝贵意见。<span className="text-qn-600 ml-1 cursor-pointer" onClick={() => toast('感谢反馈', 'info')}>去反馈</span></div>
      <div className="rounded-lg bg-qn-50/60 px-5 py-2.5 text-sm text-ink-700 flex items-center">💧 交易运营中心 · 预计每天新增成交 ⓘ {Math.max(0, Math.round(my.length / 30))}<Link to="/seller/promotion/search" className="ml-auto text-qn-600 flex items-center">去提升<ChevronRight className="w-3.5 h-3.5" /></Link></div>
      <div className="card p-5">
        <div className="flex gap-0.5 overflow-x-auto no-scrollbar">{tabs.map(([k, l]) => <button key={k} onClick={() => { setSp({ tab: k }); setSel([]); setPage(1) }} className={cls('px-4 md:px-5 h-10 md:h-11 text-sm md:text-[15px] rounded-sm transition shrink-0', tab === k ? 'bg-ink-900 text-white font-medium' : 'bg-ink-50 text-ink-700 hover:bg-ink-100')}>{l}</button>)}</div>
        <div className="mt-5 grid grid-cols-[70px_1fr] max-md:!grid-cols-1 gap-x-3 gap-y-3 items-start">
          <div className="font-semibold pt-2">精确查询</div>
          <div className="flex items-center gap-3"><div className="flex w-full max-w-[600px] border border-ink-200 rounded-lg overflow-hidden"><input aria-label="精确查询" className="flex-1 h-10 px-3 outline-none text-sm min-w-0" placeholder="请输入订单编号/物流单号/商品id/买家昵称" value={q} onChange={e => { setQ(e.target.value); setPage(1) }} /><button className="w-16 bg-ink-50 flex items-center justify-center text-ink-500 border-l border-ink-200" aria-label="搜索"><Search className="w-4 h-4" /></button></div><button className="link shrink-0" onClick={() => setBatchQ(q.split(/[\s,，]+/).join('\n'))}>批量搜索 ☰Q</button></div>
          <div className="font-semibold pt-2">搜索订单</div>
          {expanded ? (
            <div className="grid grid-cols-4 max-lg:!grid-cols-2 max-md:!grid-cols-1 gap-3">
              <Sel label="订单状态" k="status" options={[['unpaid', '等待买家付款'], ['paid', '买家已付款'], ['shipped', '卖家已发货'], ['done', '交易成功'], ['refunding', '退款中'], ['closed', '交易关闭']]} />
              <Sel label="预售状态" k="otype" options={[]} />
              <Sel label="售后服务" k="after" options={[['yes', '有售后'], ['no', '无售后']]} />
              <Sel label="承诺发货时间" k="warn" options={[['soon', '24小时内到期'], ['over', '已超时']]} />
              <Inp label="宝贝名称" k="title" />
              <Sel label="催发货订单" k="warn" options={[['over', '买家已催发货']]} />
              <div className="col-span-2 max-md:col-span-1"><DateRange label="创建时间" k="created" /></div>
              <div className="col-span-2 max-md:col-span-1"><DateRange label="付款时间" k="paid" /></div>
              <Sel label="评价状态" k="rate" options={[['buyer-yes', '买家已评'], ['buyer-no', '买家未评'], ['seller-yes', '我已评'], ['seller-no', '我未评']]} />
              <Sel label="物流服务" k="ship" options={[['express', '自己联系物流'], ['online', '在线下单'], ['none', '无需物流']]} />
              <Sel label="支付方式" k="pay" options={[['balance', '余额'], ['applepay', 'Apple Pay'], ['googlepay', 'Google Pay'], ['payos', 'PayOS']]} />
              <Sel label="订单类型" k="otype" options={[['normal', '普通订单'], ['virtual', '虚拟/无货源订单'], ['live', '直播订单'], ['ad', '推广成交订单']]} />
              <Sel label="代充类型" k="otype" options={[['virtual', '虚拟代充']]} />
              <Inp label="收件人姓名" k="name" />
              <Inp label="收件人手机号" k="phone" />
              <Inp label="收礼人昵称" k="title" placeholder="仅对礼物订单生效" />
              <div className="col-span-2 max-md:col-span-1"><DateRange label="确认收货时间" k="done" /></div>
              <Sel label="预警提示" k="warn" options={[['soon', '即将超时'], ['over', '发货已超时']]} />
            </div>
          ) : <div className="text-sm text-ink-400 pt-2">筛选项已收起</div>}
          <div className="max-md:hidden" /><div className="flex items-center gap-4 text-sm flex-wrap"><button className="btn-qn h-10 px-6" onClick={() => { setPage(1); toast(`共查询到 ${list.length} 个订单`, 'info') }}>搜索订单</button><button onClick={exportCsv} className="btn-outline h-10 px-5">批量导出</button><button onClick={() => setExpanded(e => !e)} className="text-ink-600">{expanded ? '⌃ 收起筛选项' : '⌄ 展开筛选项'}</button><button onClick={() => { setF(EMPTY_F); setQ(''); setPage(1) }} className="text-ink-600">⟲ 清除条件</button><button className="text-ink-600" onClick={() => toast('可在此自定义常用筛选项', 'info')}>☰ 筛选项设置</button></div>
        </div>
        <div className="mt-6 flex items-center gap-4 text-sm flex-wrap"><span className="font-semibold">快捷筛选</span><label className="input-qn w-48 flex items-center gap-2 px-3"><span className="text-ink-400 shrink-0">卖家备注</span><select aria-label="卖家备注" className="flex-1 bg-transparent outline-none min-w-0" value={f.note} onChange={e => set({ note: e.target.value })}><option value="">全部</option><option value="yes">有备注</option><option value="no">无备注</option>{FLAG_NAMES.slice(1).map((n, i) => <option key={n} value={i + 1}>{n}旗</option>)}</select></label><label className="flex items-center gap-1.5 cursor-pointer"><input type="checkbox" className="accent-qn-500" checked={f.hideClosed} onChange={e => set({ hideClosed: e.target.checked })} />不显示已关闭的订单</label></div>
        <div className="mt-4 flex items-center gap-3 text-sm flex-wrap"><span>共查询到 <b className="text-qn-600 font-num font-normal">{list.length}</b> 个订单</span>
          <button onClick={() => { const os = picked().filter(o => o.status === 'paid'); if (!os.length) return toast('请勾选买家已付款的订单', 'error'); setShipOf(os) }} className="btn-outline h-9">批量发货</button>
          <button onClick={() => { if (!sel.length) return toast('请先勾选订单', 'error'); setNoteOf(picked()) }} className="btn-outline h-9">批量标记</button>
          <button onClick={() => { const os = picked().filter(o => o.status === 'unpaid'); if (!os.length) return toast('仅等待买家付款的订单可免运费', 'error'); os.forEach(o => updateOrder(o.id, { freight: 0, payAmount: +(o.payAmount - o.freight).toFixed(2) })); toast(`已为 ${os.length} 笔订单免运费`) }} className="btn-outline h-9">批量免运费</button>
          <button onClick={() => { const os = picked(); if (!os.length) return toast('请先勾选订单', 'error'); toast(`退款金额预计算：共 ¥${money(os.filter(o => o.status !== 'unpaid' && o.status !== 'closed').reduce((a, o) => a + o.payAmount, 0))}，按实付款原路退回`, 'info') }} className="btn-outline h-9">退款金额预计算</button>
          <button onClick={exportCsv} className="btn-outline h-9">其他操作 ⌃</button></div>
        <div className="mt-3">
          <div className="hidden md:grid grid-cols-[28px_1fr_110px_70px_130px_150px_130px_80px] bg-ink-50 rounded-lg px-3 h-11 items-center text-sm text-ink-600"><input type="checkbox" aria-label="全选" className="accent-qn-500" checked={rows.length > 0 && rows.every(o => sel.includes(o.id))} onChange={e => setSel(e.target.checked ? [...new Set([...sel, ...rows.map(o => o.id)])] : sel.filter(id => !rows.some(o => o.id === id)))} /><span>宝贝</span><span>单价</span><span>数量</span><span>履约/售后状态</span><span>交易状态</span><span>实收款</span><span className="text-right">操作</span></div>
          {rows.length === 0 ? <div className="text-center text-ink-400 text-sm py-12">没有符合条件的宝贝，请尝试其他搜索条件。</div> : (
            <div className="space-y-3 mt-3">
              {rows.map(o => { const u = users.find(x => x.id === o.userId); const rf = refundOf(o); const left = 48 - hoursSince(o.paidAt ?? o.createdAt); const isDone = o.status === 'received' || o.status === 'done'; return (
                <div key={o.id} className="rounded-lg overflow-hidden border border-transparent hover:border-qn-200">
                  <div className="flex items-center gap-x-6 gap-y-1 px-3 min-h-[44px] py-1.5 bg-[#eef1f8] text-sm text-ink-700 flex-wrap"><input type="checkbox" aria-label="选择" className="accent-qn-500" checked={sel.includes(o.id)} onChange={e => setSel(e.target.checked ? [...sel, o.id] : sel.filter(x => x !== o.id))} /><span>订单号：<span className="font-num">{o.id}</span></span><span>创建时间：<span className="font-num">{fmtDate(o.createdAt)}</span></span><span className="flex items-center gap-1"><button onClick={() => toast(`已打开与 ${u?.nickname ?? '买家'} 的聊天`, 'info')} className="text-qn-600 flex items-center gap-1" title="联系买家"><MessageSquare className="w-4 h-4 fill-qn-500 text-qn-500" />{mask(u?.nickname)}</button><button aria-label="筛选该买家订单" title="查看该买家所有订单" onClick={() => { setQ(u?.nickname ?? ''); setPage(1) }} className="text-ink-400 hover:text-qn-600"><Filter className="w-3.5 h-3.5" /></button></span><span className="border border-qn-300 text-qn-600 rounded px-1 text-xs leading-5">号码保护订单</span>{o.liveId && <span className="tag-red">直播</span>}{o.adPlanId && <span className="tag-blue">推广</span>}{o.note && <span className="text-xs text-ink-500 line-clamp-1 max-w-[260px]" title={o.note}>备注：{o.note}</span>}<button aria-label="备注与旗帜" title={o.note || '添加备注'} onClick={() => setNoteOf([o])} className="ml-auto"><Flag className="w-4 h-4" style={{ color: FLAGS[o.flag ?? 0] || '#c0c4cc', fill: FLAGS[o.flag ?? 0] || 'transparent' }} /></button></div>
                  <div className="grid grid-cols-[28px_1fr_110px_70px_130px_150px_130px_80px] max-md:!grid-cols-[1fr_auto] max-md:gap-2 px-3 py-4 text-sm">
                    <span className="max-md:hidden" />
                    <div className="space-y-3">{o.items.map((it, i) => { const p = products.find(x => x.id === it.productId); return <div key={i} className="flex gap-3"><Img src={it.image} alt="" w={72} h={72} className="w-[72px] h-[72px] rounded-lg shrink-0" /><div className="min-w-0 space-y-1"><Link to={`/item/${it.productId}`} target="_blank" className="line-clamp-2 text-qn-600 hover:underline">{it.title}</Link>{it.skuText && <div className="text-ink-700">{it.skuText}</div>}{p?.pub?.sellerCode && <div className="text-ink-700">商家编码：{p.pub.sellerCode}</div>}</div></div> })}</div>
                    <div className="max-md:hidden">{o.items.map((it, i) => <div key={i} className="font-num pt-6">¥{money(it.price)}</div>)}</div>
                    <div className="max-md:hidden">{o.items.map((it, i) => <div key={i} className="font-num pt-6">{it.qty}</div>)}</div>
                    <div className="max-md:hidden pt-1 text-sm">{rf ? <div><div className={rf.status === 'refunded' ? 'text-ink-800' : 'text-amber-700'}>{rf.status === 'refunded' ? '退款成功' : rf.status === 'pending' ? '买家申请退款' : rf.status === 'rejected' ? '已拒绝退款' : rf.status === 'cancelled' ? '买家撤销退款' : '已同意退款'}</div><Link to="/seller/refunds" className="text-qn-600 text-xs">{rf.status === 'pending' ? '处理退款' : '查看退款'}</Link></div> : o.status === 'paid' ? <div className={left < 12 ? 'text-red-500' : 'text-amber-700'}>{left > 0 ? `剩 ${Math.ceil(left)} 小时发货` : '发货已超时'}</div> : null}</div>
                    <div className="flex flex-col items-start gap-1.5 text-sm">
                      <div className="flex items-center gap-1"><span className={cls(o.status === 'closed' ? 'text-ink-500' : 'text-ink-900')}>{SELLER_STATUS[o.status]}</span>{(o.status === 'shipped' || isDone) && o.logistics && <button onClick={() => setReshipOf(o)} className="text-ink-400 hover:text-qn-600">| 补发货 ›</button>}</div>
                      <Link to={`/seller/orders/${o.id}`} className="text-qn-600">详情</Link>
                      {(o.status === 'shipped' || isDone) && o.shipType !== 'none' && <button onClick={() => toast(`已发送 ${o.logistics?.company ?? ''} 电子面单至打印机`)} className="text-qn-600">打单</button>}
                      {o.status === 'shipped' && <button onClick={() => setExtendOf(o)} className="text-qn-600">{o.extendDays ? `已延长${o.extendDays}天` : '延长收货时间'}</button>}
                      {isDone && !o.rateBuyer && <button onClick={() => setRateOf(o)} className="text-qn-600">评价</button>}
                      {o.rateBuyer && <span className="text-xs text-ink-400">我已评价</span>}
                    </div>
                    <div className="text-sm"><div className="font-num">¥{money(o.payAmount)}</div><div className="text-xs text-ink-400 mt-0.5">(含快递:¥{money(o.freight)})</div>{o.logistics && <Link to={`/seller/orders/${o.id}#logistics`} className="text-qn-600 text-sm mt-1 inline-block">查看物流</Link>}</div>
                    <div className="flex flex-col items-end gap-1.5 text-sm">
                      {o.status === 'paid' && <button onClick={() => setShipOf([o])} className="btn-qn btn-sm px-4">发货</button>}
                      {o.status === 'unpaid' && <button onClick={() => { setOrderStatus(o.id, 'closed'); toast('交易已关闭') }} className="text-qn-600">关闭交易</button>}
                    </div>
                  </div>
                </div>
              ) })}
            </div>
          )}
          <div className="flex items-center justify-center gap-3 text-sm text-ink-500 py-5"><button disabled={cur <= 1} onClick={() => setPage(cur - 1)} className="disabled:text-ink-300">‹ 上一页</button>{Array.from({ length: pages }, (_, i) => i + 1).filter(n => n === 1 || n === pages || Math.abs(n - cur) <= 2).map(n => <button key={n} onClick={() => setPage(n)} className={cls('min-w-6', n === cur ? 'text-qn-600 font-medium' : 'hover:text-qn-600')}>{n}</button>)}<button disabled={cur >= pages} onClick={() => setPage(cur + 1)} className="disabled:text-ink-300">下一页 ›</button></div>
        </div>
      </div>
      <ShipModal key={shipOf.map(o => o.id).join()} orders={shipOf} onClose={() => setShipOf([])} onDone={() => { setShipOf([]); setSel([]) }} />
      <ReshipModal order={reshipOf} onClose={() => setReshipOf(null)} />
      <NoteModal orders={noteOf} onClose={() => setNoteOf([])} onOk={(flag, note) => { noteOf.forEach(o => updateOrder(o.id, noteOf.length > 1 ? { flag } : { flag, note })); setNoteOf([]); setSel([]); toast('已保存') }} />
      <RateBuyerModal order={rateOf} onClose={() => setRateOf(null)} />
      <Modal open={!!extendOf} onClose={() => setExtendOf(null)} title="延长收货时间" width={420}>{extendOf && <div className="space-y-3 text-sm"><div className="text-ink-600">买家确认收货期限将在当前基础上延长，同一订单最多延长 10 天。</div><div className="flex gap-2">{[3, 5, 7, 10].map(d => <button key={d} disabled={(extendOf.extendDays ?? 0) + d > 10} onClick={() => { updateOrder(extendOf.id, { extendDays: (extendOf.extendDays ?? 0) + d }); setExtendOf(null); toast(`已延长收货时间 ${d} 天`) }} className="btn-outline flex-1 disabled:opacity-40">{d} 天</button>)}</div></div>}</Modal>
      <Modal open={batchQ !== null} onClose={() => setBatchQ(null)} title="批量搜索" width={440} footer={<><button className="btn-outline" onClick={() => setBatchQ(null)}>取消</button><button className="btn-qn" onClick={() => { setQ((batchQ ?? '').split(/\s+/).filter(Boolean).join(' ')); setBatchQ(null); setPage(1) }}>搜索</button></>}><textarea aria-label="批量订单号" className="input-qn h-40 py-2 font-num" value={batchQ ?? ''} onChange={e => setBatchQ(e.target.value)} placeholder="每行一个订单编号 / 物流单号，最多 100 个" /></Modal>
    </div>
  )
}

// ———————————————————————— 发货弹窗（三种方式） ————————————————————————

export function ShipModal({ orders, onClose, onDone }: { orders: Order[]; onClose: () => void; onDone?: () => void }) {
  const { shipOrder, deliverOrder, products } = useDB()
  const virtual = orders.length > 0 && orders.every(o => isVirtual(o, products))
  // 弹窗按订单 key 重建：虚拟/无货源订单默认无需物流，否则沿用上次方式
  const [method, setMethod] = useState<ShipMethod>(() => { const last = lastMethod(); return virtual && last === 'express' ? 'none' : last })
  const [company, setCompany] = useState(EXPRESS[0])
  const [no, setNo] = useState('')
  const [content, setContent] = useState('')
  const open = orders.length > 0
  const m = method
  const genNo = () => `${company.startsWith('顺丰') ? 'SF' : company.startsWith('京东') ? 'JD' : 'YT'}${Math.floor(Math.random() * 9e11 + 1e11)}`
  const submit = () => {
    if (m === 'express' && orders.length === 1 && !no.trim()) return toast('请填写运单号', 'error')
    for (const o of orders) {
      if (m === 'none') deliverOrder(o.id, content.trim())
      else shipOrder(o.id, company, m === 'express' && orders.length === 1 ? no.trim() : genNo())
    }
    try { localStorage.setItem('plam-ship-method', m) } catch { /* 忽略 */ }
    toast(orders.length > 1 ? `已发货 ${orders.length} 笔` : '发货成功')
    setNo(''); setContent('')
    onDone ? onDone() : onClose()
  }
  const methods: [ShipMethod, string, string][] = [['online', '在线下单', '官方寄件，快递员上门揽收，自动回填运单号'], ['express', '自己联系物流', '已线下交给快递，手动填写运单号'], ['none', '无需物流', '虚拟商品 / 无货源代发 / 同城自提，无需运单号']]
  return (
    <Modal open={open} onClose={onClose} title={orders.length > 1 ? `批量发货（${orders.length} 笔）` : '订单发货'} width={600} footer={<><button className="btn-outline" onClick={onClose}>取消</button><button className="btn-qn" onClick={submit}>{m === 'none' ? '确认无需物流发货' : '确认发货'}</button></>}>
      {open && <div className="space-y-4 text-sm">
        {orders.length === 1 ? <div className="bg-ink-50 rounded-lg p-3"><div className="flex items-center gap-1.5"><MapPin className="w-4 h-4 text-qn-500 shrink-0" />{orders[0].address.name} <span dir="ltr" className="font-num">{fmtPhone(orders[0].address)}</span></div><div className="text-ink-600 mt-1 ml-5">{fmtAddr(orders[0].address)}</div><div className="mt-2 ml-5 text-xs text-ink-500 line-clamp-1">{orders[0].items.map(i => `${i.title} ×${i.qty}`).join('；')}</div></div>
          : <div className="bg-ink-50 rounded-lg p-3 text-ink-600">已选 {orders.length} 笔待发货订单，{m === 'none' ? '将全部按无需物流发货' : '将自动获取电子面单运单号'}</div>}
        <div className="grid grid-cols-3 gap-2">{methods.map(([k, l, d]) => <button key={k} type="button" onClick={() => setMethod(k)} className={cls('rounded-lg border p-3 text-left', m === k ? 'border-qn-500 bg-qn-50/60' : 'border-ink-200 hover:border-qn-300')}><div className={cls('font-medium', m === k && 'text-qn-600')}>{l}{k === 'none' && virtual && <span className="tag-blue ml-1">推荐</span>}</div><div className="text-xs text-ink-500 mt-1 leading-4">{d}</div></button>)}</div>
        {m !== 'none' ? <>
          <label className="block"><div className="mb-1 text-ink-600">物流公司</div><select className="input-qn" value={company} onChange={e => setCompany(e.target.value)}>{EXPRESS.map(e => <option key={e}>{e}</option>)}</select></label>
          {m === 'express' && orders.length === 1 && <label className="block"><div className="mb-1 text-ink-600">运单号 <span className="text-red-500">*</span></div><div className="flex gap-2"><input className="input-qn font-num" value={no} onChange={e => setNo(e.target.value)} placeholder="请输入或扫描运单号" /><button type="button" className="btn-outline whitespace-nowrap" onClick={() => setNo(genNo())}>电子面单取号</button></div></label>}
          {m === 'online' && <div className="text-xs text-ink-500">下单后快递员将在 2 小时内上门取件，运单号自动回填，可在「包裹中心」追踪。</div>}
        </> : <label className="block"><div className="mb-1 text-ink-600">发货内容 <span className="text-ink-400">（选填，买家在订单详情可见）</span></div><textarea className="input-qn h-28 py-2" value={content} onChange={e => setContent(e.target.value)} placeholder={'可填写卡密、账号密码、兑换码、下载链接或上游供应商代发说明，例如：\n账号：xxx@mail.com  密码：xxxx\n有效期至 2026-12-31'} /><div className="text-xs text-ink-400 mt-1">无需物流发货后订单直接变为「卖家已发货」，买家可确认收货；请确保已通过旺旺或上述内容完成交付，避免虚假发货违规。</div></label>}
      </div>}
    </Modal>
  )
}

function ReshipModal({ order, onClose }: { order: Order | null; onClose: () => void }) {
  const { reshipOrder } = useDB()
  const none = order?.shipType === 'none'
  const [company, setCompany] = useState(EXPRESS[0])
  const [no, setNo] = useState('')
  const [content, setContent] = useState('')
  return (
    <Modal open={!!order} onClose={onClose} title="补发货" width={480} footer={<><button className="btn-outline" onClick={onClose}>取消</button><button className="btn-qn" onClick={() => { if (!none && !no.trim()) return toast('请填写运单号', 'error'); if (none && !content.trim()) return toast('请填写补发内容', 'error'); reshipOrder(order!.id, none ? '' : company, none ? '' : no.trim(), none ? content.trim() : ''); setNo(''); setContent(''); onClose(); toast('补发货成功') }}>确认补发</button></>}>
      {order && <div className="space-y-3 text-sm"><div className="text-ink-500">原发货：{order.logistics?.company}{order.logistics?.no ? ` · ${order.logistics.no}` : ''}</div>
        {none ? <textarea aria-label="补发内容" className="input-qn h-28 py-2" value={content} onChange={e => setContent(e.target.value)} placeholder="补发的卡密 / 账号 / 链接，买家在订单详情可见" />
          : <><select aria-label="物流公司" className="input-qn" value={company} onChange={e => setCompany(e.target.value)}>{EXPRESS.map(e => <option key={e}>{e}</option>)}</select><input aria-label="运单号" className="input-qn font-num" value={no} onChange={e => setNo(e.target.value)} placeholder="补发运单号" /></>}
      </div>}
    </Modal>
  )
}

function NoteModal({ orders, onClose, onOk }: { orders: Order[]; onClose: () => void; onOk: (flag: number, note: string) => void }) {
  const first = orders[0]
  const [flag, setFlag] = useState<number | null>(null)
  const [n, setN] = useState<string | null>(null)
  const fl = flag ?? first?.flag ?? 0, note = n ?? first?.note ?? ''
  const close = () => { setFlag(null); setN(null); onClose() }
  return <Modal open={orders.length > 0} onClose={close} title={orders.length > 1 ? `批量标记（${orders.length} 笔）` : '备注与标记'} width={460} footer={<><button className="btn-outline" onClick={close}>取消</button><button className="btn-qn" onClick={() => { onOk(fl, note); setFlag(null); setN(null) }}>保存</button></>}>
    <div className="space-y-3 text-sm"><div className="flex items-center gap-3"><span className="text-ink-600">旗帜</span>{FLAGS.map((c, i) => <button key={i} type="button" onClick={() => setFlag(i)} className={cls('w-8 h-8 rounded border flex items-center justify-center', fl === i ? 'border-qn-500 bg-qn-50' : 'border-ink-200')} title={FLAG_NAMES[i]}>{i === 0 ? <span className="text-xs text-ink-400">无</span> : <Flag className="w-4 h-4" style={{ color: c, fill: c }} />}</button>)}</div>
      {orders.length === 1 && <textarea aria-label="卖家备注" className="input-qn h-24 py-2" value={note} onChange={e => setN(e.target.value)} placeholder="仅卖家可见，最多 500 字" maxLength={500} />}</div>
  </Modal>
}

export function RateBuyerModal({ order, onClose }: { order: Order | null; onClose: () => void }) {
  const { updateOrder } = useDB()
  const [rating, setRating] = useState<'good' | 'mid' | 'bad'>('good')
  const [content, setContent] = useState('')
  return <Modal open={!!order} onClose={onClose} title="评价买家" width={460} footer={<><button className="btn-outline" onClick={onClose}>取消</button><button className="btn-qn" onClick={() => { updateOrder(order!.id, { rateBuyer: { rating, content: content.trim() || (rating === 'good' ? '好买家，交易愉快！' : ''), at: new Date().toISOString() } }); setContent(''); onClose(); toast('评价成功') }}>发表评价</button></>}>
    <div className="space-y-3 text-sm"><div className="flex gap-2">{([['good', '好评', 'text-red-500'], ['mid', '中评', 'text-amber-600'], ['bad', '差评', 'text-ink-600']] as const).map(([k, l, c]) => <button key={k} onClick={() => setRating(k)} className={cls('flex-1 h-10 rounded-lg border', rating === k ? `border-qn-500 bg-qn-50 ${c} font-medium` : 'border-ink-200')}>{l}</button>)}</div><textarea aria-label="评价内容" className="input-qn h-24 py-2" value={content} onChange={e => setContent(e.target.value)} placeholder="好买家，交易愉快！" /></div>
  </Modal>
}

// ———————————————————————— 发货（批量发货工作台） ————————————————————————

export function SellerShip() {
  const shop = useCurrentShop()
  const { orders, users, products } = useDB()
  const [tab, setTab] = useState<'wait' | 'done' | 'nego'>('wait')
  const [chip, setChip] = useState('')
  const [f, setF] = useState({ paid: ['', ''] as [string, string], name: '', phone: '', country: '', id: '', pid: '', ship: '', other: '' })
  const [applied, setApplied] = useState(f)
  const [sel, setSel] = useState<string[]>([])
  const [reveal, setReveal] = useState<string[]>([])
  const [shipOf, setShipOf] = useState<Order[]>([])
  const [per, setPer] = useState(20)
  const [page, setPage] = useState(1)
  const [more, setMore] = useState(false)
  const my = useMemo(() => orders.filter(o => o.shopId === shop.id), [orders, shop.id])
  const list = useMemo(() => my.filter(o => {
    if (tab === 'wait' ? o.status !== 'paid' : tab === 'done' ? !o.shippedAt : true) return false
    if (tab === 'nego') return false
    const h = hoursSince(o.paidAt ?? o.createdAt), v = isVirtual(o, products)
    if (chip === 'urgent' && h < 24) return false
    if (chip === 'official' && o.shipType !== 'online') return false
    if (chip === 'due24' && !(h >= 24 && h < 48)) return false
    if (chip === 'over24' && h < 24) return false
    if (chip === 'over48' && h < 48) return false
    if (chip === 'overdue' && h < 48) return false
    if (chip === 'virtual' && !v) return false
    if (chip === 'physical' && v) return false
    if (chip === 'note' && !o.note) return false
    const a = applied
    if (!inRange(o.paidAt, a.paid)) return false
    if (a.name && !o.address.name.includes(a.name)) return false
    if (a.phone && !o.address.phone.includes(a.phone.replace(/\D/g, ''))) return false
    if (a.country && (o.address.country ?? 'CN') !== a.country) return false
    if (a.id && !o.id.includes(a.id)) return false
    if (a.pid && !(tab === 'done' ? o.logistics?.no.includes(a.pid) : o.items.some(i => i.productId === a.pid))) return false
    if (a.ship && (o.shipType ?? 'express') !== a.ship) return false
    if (a.other === 'live' && !o.liveId) return false
    if (a.other === 'flag' && !o.flag) return false
    return true
  }).sort((a, b) => tab === 'done' ? (b.shippedAt ?? '').localeCompare(a.shippedAt ?? '') : (a.paidAt ?? '').localeCompare(b.paidAt ?? '')), [my, tab, chip, applied, products])
  const pages = Math.max(1, Math.ceil(list.length / per)), cur = Math.min(page, pages)
  const rows = list.slice((cur - 1) * per, cur * per)
  const chips = tab === 'wait' ? [['urgent', '加急发货'], ['official', '官方寄件'], ['due24', '24小时需发货'], ['over24', '超24小时未发货'], ['over48', '超48小时未发货'], ['overdue', '超时未发货'], ['virtual', '虚拟订单'], ['physical', '实物订单'], ['note', '含买家留言']] : tab === 'done' ? [['virtual', '虚拟订单'], ['physical', '实物订单'], ['official', '官方寄件']] : []
  const ship = (os: Order[], m: ShipMethod | null) => { if (!os.length) return toast('请先勾选订单', 'error'); if (m) { try { localStorage.setItem('plam-ship-method', m) } catch { /* 忽略 */ } } setShipOf(os) }
  const pickedRows = () => rows.filter(o => sel.includes(o.id))
  const addr = (o: Order) => { const c = countryOf(o.address.country); const shown = reveal.includes(o.id); return shown ? `${fmtAddr(o.address)}, ${o.address.name}, ${fmtPhone(o.address)}` : `${c.code === 'CN' ? '' : c.name + ' '}${o.address.region}${'*'.repeat(Math.min(36, o.address.detail.length * 2))}, ${mask(o.address.name)}, ${'*'.repeat(11)}` }
  return (
    <div className="card min-h-[calc(100vh-120px)] flex flex-col">
      <div className="px-6 pt-4 flex items-center border-b border-ink-100">
        {([['wait', '待发货'], ['done', '已发货'], ['nego', '协商发货时间']] as const).map(([k, l]) => <button key={k} onClick={() => { setTab(k); setChip(''); setSel([]); setPage(1) }} className={cls('mr-8 pb-3 text-[15px] relative', tab === k ? 'text-ink-900 font-medium' : 'text-ink-600')}>{l}{k === 'wait' && my.filter(o => o.status === 'paid').length > 0 && <span className="ml-1 text-xs text-qn-600 font-num">{my.filter(o => o.status === 'paid').length}</span>}{tab === k && <span className="absolute left-0 right-0 -bottom-px h-0.5 bg-ink-900" />}</button>)}
        <div className="ml-auto flex items-center gap-4 text-sm text-ink-700 pb-3"><button onClick={() => toast('暂无操作记录', 'info')}>☰ 操作记录</button><span className="text-ink-200">|</span><button onClick={() => { downloadCsv('待发货订单.csv', [['订单编号', '宝贝', '数量', '收件人', '手机', '地址', '支付时间'], ...list.map(o => [o.id, o.items.map(i => i.title).join('；'), o.items.reduce((a, i) => a + i.qty, 0), o.address.name, fmtPhone(o.address), fmtAddr(o.address), fmtDate(o.paidAt)])]); toast('已导出') }}>⇩ 导入/导出记录</button></div>
      </div>
      <div className="px-6 py-4 space-y-3">
        {chips.length > 0 && <div className="flex gap-2 flex-wrap">{chips.map(([k, l]) => <button key={k} onClick={() => { setChip(chip === k ? '' : k); setPage(1) }} className={cls('h-8 px-3 rounded border text-sm', chip === k ? 'border-qn-500 text-qn-600 bg-qn-50' : 'border-ink-200 text-ink-700 hover:border-ink-300')}>{l}</button>)}</div>}
        <div className="grid grid-cols-4 max-lg:!grid-cols-2 max-md:!grid-cols-1 gap-3 text-sm">
          <div className="col-span-2 max-md:col-span-1 input-qn flex items-center gap-2 px-3 text-ink-400"><span className="shrink-0">支付时间</span><input aria-label="支付时间起" type="date" className="flex-1 bg-transparent outline-none min-w-0 text-ink-700" value={f.paid[0]} onChange={e => setF({ ...f, paid: [e.target.value, f.paid[1]] })} /><span>-</span><input aria-label="支付时间止" type="date" className="flex-1 bg-transparent outline-none min-w-0 text-ink-700" value={f.paid[1]} onChange={e => setF({ ...f, paid: [f.paid[0], e.target.value] })} /></div>
          <input aria-label="收件人姓名" className="input-qn" placeholder="收件人姓名" value={f.name} onChange={e => setF({ ...f, name: e.target.value })} />
          <input aria-label="收件人手机" className="input-qn" placeholder="收件人手机" value={f.phone} onChange={e => setF({ ...f, phone: e.target.value })} />
          <select aria-label="地址" className="input-qn" value={f.country} onChange={e => setF({ ...f, country: e.target.value })}><option value="">地址（全部国家）</option>{COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.flag} {c.name}</option>)}</select>
          {<>
            <input aria-label="订单号" className="input-qn" placeholder="订单号" value={f.id} onChange={e => setF({ ...f, id: e.target.value })} />
            <input aria-label={tab === 'done' ? '运单号' : '商品ID'} className="input-qn" placeholder={tab === 'done' ? '运单号' : '商品ID'} value={f.pid} onChange={e => setF({ ...f, pid: e.target.value })} />
            <select aria-label="物流服务" className="input-qn" value={f.ship} onChange={e => setF({ ...f, ship: e.target.value })}><option value="">物流服务</option><option value="express">自己联系物流</option><option value="online">在线下单</option><option value="none">无需物流</option></select>
          </>}
          <select aria-label="其他" className="input-qn" value={f.other} onChange={e => setF({ ...f, other: e.target.value })}><option value="">其他</option><option value="live">直播订单</option><option value="flag">已插旗</option></select>
          <div className="flex items-center gap-3 col-span-3 max-lg:col-span-1"><button onClick={() => { const e = { paid: ['', ''] as [string, string], name: '', phone: '', country: '', id: '', pid: '', ship: '', other: '' }; setF(e); setApplied(e); setChip('') }} className="text-ink-500">⌫ 清除条件</button><button onClick={() => { setApplied(f); setPage(1) }} className="btn-outline px-6">搜索</button>{tab === 'done' && <button onClick={() => setMore(m => !m)} className="text-ink-700">{more ? '⌃ 收起' : '⌄ 展开'}</button>}</div>
        </div>
      </div>
      <div className="px-6 flex-1 space-y-3 pb-4">
        {tab === 'nego' || rows.length === 0 ? <div className="py-20 text-center text-ink-400 text-sm"><div className="text-5xl mb-3">📦</div>暂无数据</div> : rows.map(o => { const u = users.find(x => x.id === o.userId); return (
          <div key={o.id} className="border border-ink-200 rounded-lg overflow-hidden">
            <div className="bg-ink-50 px-4 h-11 flex items-center gap-3 text-sm">{tab === 'wait' && <input type="checkbox" aria-label="选择" className="accent-qn-500" checked={sel.includes(o.id)} onChange={e => setSel(e.target.checked ? [...sel, o.id] : sel.filter(x => x !== o.id))} />}<span>订单编号：<span className="font-num">{o.id}</span></span><button onClick={() => copy(o.id)} aria-label="复制订单号" className="text-ink-400 hover:text-qn-600"><Copy className="w-3.5 h-3.5" /></button><span className="flex items-center gap-1 text-qn-600"><MessageSquare className="w-4 h-4 fill-qn-500" />{mask(u?.nickname)}</span>{o.flag ? <Flag className="w-4 h-4" style={{ color: FLAGS[o.flag], fill: FLAGS[o.flag] }} /> : null}<span className="ml-auto text-ink-600 flex gap-5 max-md:hidden">{o.shippedAt && <span>发货时间：<span className="font-num">{fmtDate(o.shippedAt)}</span></span>}<span>支付时间：<span className="font-num">{fmtDate(o.paidAt)}</span></span></span></div>
            <div className="px-4 py-3 border-b border-ink-100 space-y-2">{o.items.map((it, i) => <div key={i} className="flex items-center gap-3"><Img src={it.image} alt="" w={44} h={44} className="w-11 h-11 rounded shrink-0" /><Link to={`/item/${it.productId}`} target="_blank" className="text-qn-600 hover:underline line-clamp-2 max-w-[360px] text-sm">{it.title}</Link><span className="text-sm font-num ml-4">¥{money(it.price)} x{it.qty}</span>{it.skuText && <span className="text-xs text-ink-500 max-md:hidden">{it.skuText}</span>}</div>)}{o.note && <div className="text-xs text-amber-700">买家留言 / 备注：{o.note}</div>}</div>
            <div className="px-4 py-3 flex items-center gap-3 text-sm"><MapPin className="w-4 h-4 text-ink-500 shrink-0" /><div className="flex-1 min-w-0"><div className="break-all">{addr(o)} <button onClick={() => setReveal(r => r.includes(o.id) ? r.filter(x => x !== o.id) : [...r, o.id])} className="text-qn-600 ml-1">{reveal.includes(o.id) ? '隐藏' : '解密'}</button></div>{o.shippedAt && <div className="text-xs text-ink-600 mt-0.5">发货方式: {o.shipType === 'none' ? '无需物流' : o.shipType === 'online' ? `在线下单 · ${o.logistics?.company} ${o.logistics?.no}` : `自己联系物流 · ${o.logistics?.company} ${o.logistics?.no}`}</div>}{o.deliverNote && <div className="text-xs text-ink-500 mt-0.5 whitespace-pre-line line-clamp-2">发货内容：{o.deliverNote}</div>}</div>
              {tab === 'wait' ? <div className="flex gap-2 shrink-0"><button onClick={() => ship([o], 'none')} className="btn-outline btn-sm">无需物流</button><button onClick={() => ship([o], null)} className="btn-qn btn-sm"><Truck className="w-3.5 h-3.5" />发货</button></div> : <Link to={`/seller/orders/${o.id}#logistics`} className="btn btn-sm bg-qn-50 text-qn-600 hover:bg-qn-100 px-5 shrink-0">物流详情</Link>}
            </div>
          </div>
        ) })}
      </div>
      <div className="sticky bottom-0 bg-white border-t border-ink-100 px-6 h-16 flex items-center gap-3 text-sm flex-wrap">
        {tab === 'wait' && <><label className="flex items-center gap-1.5"><input type="checkbox" aria-label="全选" className="accent-qn-500" checked={rows.length > 0 && rows.every(o => sel.includes(o.id))} onChange={e => setSel(e.target.checked ? rows.map(o => o.id) : [])} />全选({pickedRows().length}/{rows.length})</label>
          <button onClick={() => { const os = pickedRows(); if (os.length && new Set(os.map(o => o.userId + fmtAddr(o.address))).size > 1) return toast('合并发货需为同一买家同一地址', 'error'); ship(os, null) }} className="btn h-9 px-5 bg-qn-50 text-qn-600 hover:bg-qn-100">合并发货</button>
          <button onClick={() => toast('请下载模板，填写订单号与运单号后上传（CSV）', 'info')} className="btn-outline h-9">批量导入</button>
          <button onClick={() => ship(pickedRows(), 'none')} className="btn-outline h-9">无需物流发货</button>
          <button onClick={() => ship(pickedRows(), 'online')} className="btn-outline h-9 relative">在线寄件<span className="absolute -top-2.5 left-1/2 -translate-x-1/2 text-[10px] bg-ink-900 text-amber-200 rounded px-1 leading-4">官方寄件</span></button></>}
        <div className="ml-auto flex items-center gap-3 text-ink-500"><button disabled={cur <= 1} onClick={() => setPage(cur - 1)} className="disabled:text-ink-300">‹</button><span className="text-qn-600 font-num">{cur}</span><button disabled={cur >= pages} onClick={() => setPage(cur + 1)} className="disabled:text-ink-300">›</button><span>每页显示：</span><select aria-label="每页显示" className="input-qn h-8 w-20" value={per} onChange={e => { setPer(Number(e.target.value)); setPage(1) }}>{[20, 50, 100].map(n => <option key={n}>{n}</option>)}</select></div>
      </div>
      <ShipModal key={shipOf.map(o => o.id).join()} orders={shipOf} onClose={() => setShipOf([])} onDone={() => { setShipOf([]); setSel([]) }} />
    </div>
  )
}
