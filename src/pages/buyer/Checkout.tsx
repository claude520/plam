import { useMemo, useState } from 'react'
import { COUNTRIES, countryOf, defaultCountry, fmtAddr, fmtPhone, normPhone, validateAddress, type AddrErrors } from '@/lib/address'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { MapPin, Plus, Check, ShieldCheck, Wallet, QrCode } from 'lucide-react'
import { useDB, genId } from '@/store/db'
import { useCurrentUser } from '@/lib/hooks'
import { Img, Modal, Field, Steps } from '@/components/ui'
import { cls, money, PAY_NAMES } from '@/lib/format'
import { toast } from '@/store/session'
import type { Address, Order } from '@/data/types'

export default function Checkout() {
  const [sp] = useSearchParams()
  const nav = useNavigate()
  const user = useCurrentUser()
  const { products, shops, cart, addresses, upsertAddress, coupons, myCoupons, createOrder, payOrder, removeCart, paymentProviders, settings, updateUser } = useDB()
  const items = useMemo(() => {
    if (sp.get('from') === 'cart') return cart.filter(c => c.checked).map(c => { const p = products.find(x => x.id === c.productId)!; const sku = p.skus.find(s => s.id === c.skuId)!; return { p, sku, qty: c.qty, cartId: c.id } })
    const p = products.find(x => x.id === sp.get('pid'))
    const sku = p?.skus.find(s => s.id === sp.get('sku'))
    return p && sku ? [{ p, sku, qty: Number(sp.get('qty') || 1), cartId: '' }] : []
  }, [sp, cart, products])
  const shop = shops.find(s => s.id === items[0]?.p.shopId)
  const myAddrs = addresses.filter(a => a.userId === user?.id)
  const [addrId, setAddrId] = useState(myAddrs.find(a => a.isDefault)?.id ?? myAddrs[0]?.id ?? '')
  const [editing, setEditing] = useState<Address | null>(null)
  const [note, setNote] = useState('')
  const [couponId, setCouponId] = useState('')
  const [step, setStep] = useState(0)
  const [order, setOrder] = useState<Order | null>(null)
  const [provider, setProvider] = useState(paymentProviders.find(p => p.enabled)?.code ?? 'balance')
  const total = items.reduce((a, it) => a + it.sku.price * it.qty, 0)
  const freight = items.every(it => it.p.freeShipping) ? 0 : settings.freightDefault
  const usable = myCoupons.filter(m => !m.used).map(m => coupons.find(c => c.id === m.couponId)!).filter(c => c && c.status === 'active' && (!c.shopId || c.shopId === shop?.id) && total >= c.threshold)
  const coupon = coupons.find(c => c.id === couponId)
  const liveId = sp.get('live') ?? ''
  const liveRoom = useDB(s => s.lives).find(l => l.id === liveId)
  const liveOff = liveRoom ? items.reduce((a, it) => { const lp = liveRoom.livePrices[it.p.id]; return a + (lp && lp < it.sku.price ? (it.sku.price - lp) * it.qty : 0) }, 0) : 0
  const discount = Math.round(((coupon ? (coupon.type === 'discount' ? Math.round(total * (1 - coupon.value) * 100) / 100 : coupon.value) : 0) + liveOff) * 100) / 100
  const pay = Math.max(0, Math.round((total + freight - discount) * 100) / 100)
  if (!user) { nav('/login'); return null }
  if (items.length === 0 || !shop) return <div className="container-x py-20 text-center text-ink-500">没有待结算的商品 <Link className="link ml-2" to="/cart">返回购物车</Link></div>
  const addr = myAddrs.find(a => a.id === addrId)

  const submit = () => {
    if (!addr) return toast('请先添加收货地址', 'error')
    const o = createOrder(user.id, items.map(it => ({ productId: it.p.id, title: it.p.title, image: it.p.images[0], skuText: Object.values(it.sku.attrs).join(' / '), price: it.sku.price, qty: it.qty })), shop.id, addr, { discount, freight, note, couponId: couponId || undefined, liveId: liveRoom?.id })
    if (items[0].cartId) removeCart(items.map(it => it.cartId))
    setOrder(o); setStep(1); window.scrollTo(0, 0)
  }
  const doPay = () => {
    if (!order) return
    if (provider === 'balance') { if (user.balance < order.payAmount) return toast('余额不足，请选择其他支付方式', 'error'); updateUser(user.id, { balance: Math.round((user.balance - order.payAmount) * 100) / 100 }) }
    payOrder(order.id, provider); setStep(2); window.scrollTo(0, 0)
  }

  return (
    <div className="container-x py-4 md:py-6 mobile-pb">
      <div className="card px-4 md:px-8 py-4 md:py-5 mb-4 overflow-x-auto"><Steps steps={['确认订单信息', '选择支付方式', '支付成功']} current={step} /></div>
      {step === 0 && (
        <div className="grid grid-cols-[1fr_320px] lg-stack gap-4 items-start">
          <div className="space-y-4">
            <div className="card p-5">
              <div className="flex items-center justify-between mb-3"><div className="font-semibold flex items-center gap-1.5"><MapPin className="w-4 h-4 text-brand-500" />收货地址</div><button onClick={() => setEditing({ id: genId('a'), userId: user.id, name: '', phone: '', country: defaultCountry(), region: '', detail: '', isDefault: myAddrs.length === 0 })} className="btn-ghost btn-sm text-qn-600"><Plus className="w-3.5 h-3.5" />新增地址</button></div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {myAddrs.map(a => (
                  <button key={a.id} onClick={() => setAddrId(a.id)} className={cls('text-left rounded-xl border-2 p-3.5 relative transition', addrId === a.id ? 'border-brand-500 bg-brand-50/40' : 'border-ink-200 hover:border-ink-300')}>
                    <div className="flex items-center gap-2 text-sm"><span className="font-semibold">{a.name}</span><span className="text-ink-500" dir="ltr">{fmtPhone(a)}</span>{a.isDefault && <span className="tag-red">默认</span>}</div>
                    <div className="text-xs text-ink-600 mt-1">{fmtAddr(a)}</div>
                    {addrId === a.id && <Check className="w-4 h-4 text-brand-500 absolute right-3 top-3" />}
                    <span onClick={e => { e.stopPropagation(); setEditing(a) }} className="absolute right-3 bottom-3 text-xs text-qn-600 hover:underline">修改</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="card p-5">
              <div className="font-semibold mb-3">{shop.name}</div>
              <div className="divide-y divide-ink-100">
                {items.map(it => (
                  <div key={it.sku.id} className="py-3 flex items-center gap-4">
                    <div className="w-20 h-20 rounded-lg overflow-hidden"><Img src={it.p.images[0]} alt={it.p.title} w={80} h={80} className="w-full h-full" /></div>
                    <div className="flex-1 min-w-0"><div className="text-sm line-clamp-2">{it.p.title}</div><div className="text-xs text-ink-400 mt-1">{Object.values(it.sku.attrs).join(' / ')}</div></div>
                    <div className="text-sm font-num">¥{money(it.sku.price)}</div><div className="text-sm text-ink-500 w-12 text-center">x{it.qty}</div><div className="price text-base w-24 text-right">¥{money(it.sku.price * it.qty)}</div>
                  </div>
                ))}
              </div>
              <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <Field label="配送方式"><div className="input flex items-center text-ink-700">{freight === 0 ? '快递 免邮' : `快递 ¥${freight}`}</div></Field>
                <Field label="订单备注"><input className="input" value={note} onChange={e => setNote(e.target.value)} placeholder="选填，对本次交易的说明" /></Field>
              </div>
            </div>
            <div className="card p-5">
              <div className="font-semibold mb-3">优惠券</div>
              {usable.length === 0 ? <div className="text-sm text-ink-400">暂无可用优惠券</div> : (
                <div className="flex gap-3 flex-wrap">{usable.map(c => <button key={c.id} onClick={() => setCouponId(couponId === c.id ? '' : c.id)} className={cls('rounded-xl border-2 px-4 py-2.5 text-left transition', couponId === c.id ? 'border-brand-500 bg-brand-50' : 'border-ink-200')}><div className="price text-lg">{c.type === 'discount' ? `${c.value * 10}折` : `¥${c.value}`}</div><div className="text-xs text-ink-500">{c.name}</div></button>)}</div>
              )}
            </div>
          </div>
          <div className="card p-5 sticky top-4">
            <div className="space-y-2.5 text-sm">
              <div className="flex justify-between"><span className="text-ink-500">商品总价</span><span className="font-num">¥{money(total)}</span></div>
              <div className="flex justify-between"><span className="text-ink-500">运费</span><span className="font-num">¥{money(freight)}</span></div>
              <div className="flex justify-between"><span className="text-ink-500">优惠</span><span className="font-num text-brand-500">-¥{money(discount)}</span></div>
            </div>
            <div className="divider my-4" />
            <div className="flex items-end justify-between"><span>实付款</span><span className="price text-3xl">¥{money(pay)}</span></div>
            {addr && <div className="text-xs text-ink-500 mt-3 bg-ink-50 rounded-lg p-2.5"><div>寄送至：{fmtAddr(addr)}</div><div className="mt-0.5">收货人：{addr.name} <span dir="ltr">{fmtPhone(addr)}</span></div></div>}
            <button onClick={submit} className="btn-primary btn-lg w-full mt-4 text-base">提交订单</button>
            <div className="text-xs text-ink-400 mt-3 flex items-center gap-1"><ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />平台担保交易 · 支付信息加密传输</div>
          </div>
        </div>
      )}
      {step === 1 && order && (
        <div className="grid grid-cols-[1fr_320px] lg-stack gap-4 items-start">
          <div className="card p-4 md:p-6">
            <div className="flex items-center justify-between mb-5"><div><div className="font-semibold text-lg">订单提交成功，请尽快付款</div><div className="text-xs text-ink-500 mt-1">订单号 {order.id} · 请在 30 分钟内完成支付，超时订单将自动关闭</div></div><div className="price text-3xl">¥{money(order.payAmount)}</div></div>
            <div className="font-semibold mb-3">选择支付方式</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {paymentProviders.filter(p => p.enabled).map(p => (
                <button key={p.id} onClick={() => setProvider(p.code)} className={cls('flex items-center gap-3 rounded-xl border-2 p-4 text-left transition', provider === p.code ? 'border-brand-500 bg-brand-50/40' : 'border-ink-200 hover:border-ink-300')}>
                  <span className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold" style={{ background: p.logoColor }}>{p.code === 'balance' ? <Wallet className="w-5 h-5" /> : p.name.slice(0, 1)}</span>
                  <div><div className="font-medium">{p.name}</div><div className="text-xs text-ink-500">{p.code === 'balance' ? `可用余额 ¥${money(user.balance)}` : p.desc}</div></div>
                  {provider === p.code && <Check className="w-5 h-5 text-brand-500 ml-auto" />}
                </button>
              ))}
            </div>
            {provider !== 'balance' && (
              <div className="mt-5 rounded-xl border border-dashed border-ink-300 p-5 flex items-center gap-5 bg-ink-50">
                <div className="w-28 h-28 bg-white rounded-lg border border-ink-200 flex items-center justify-center"><QrCode className="w-20 h-20 text-ink-800" /></div>
                <div className="text-sm text-ink-600"><div className="font-semibold text-ink-900">请使用 {PAY_NAMES[provider]} 扫码支付</div><div className="mt-1 text-xs">演示环境：点击下方"我已完成支付"即可模拟支付回调。真实环境将通过统一支付网关调用第三方支付。</div></div>
              </div>
            )}
            <button onClick={doPay} className="btn-primary btn-lg mt-6 px-10">{provider === 'balance' ? '确认付款' : '我已完成支付'}</button>
          </div>
          <div className="card p-5 text-sm"><div className="font-semibold mb-3">订单信息</div><div className="space-y-2 text-ink-600"><div>店铺：{shop.name}</div><div>商品：{order.items.length} 件</div><div>收货：{order.address.name} {order.address.phone}</div><div className="text-xs">{order.address.region} {order.address.detail}</div></div></div>
        </div>
      )}
      {step === 2 && order && (
        <div className="card p-12 text-center">
          <div className="w-20 h-20 mx-auto rounded-full bg-emerald-50 flex items-center justify-center"><Check className="w-10 h-10 text-emerald-500" /></div>
          <div className="text-2xl font-semibold mt-4">支付成功</div>
          <div className="text-ink-500 mt-2">实付 <span className="price text-xl">¥{money(order.payAmount)}</span> · 通过 {PAY_NAMES[provider]} · 订单号 {order.id}</div>
          <div className="flex flex-col sm:flex-row justify-center gap-3 mt-8"><Link to={`/my/orders/${order.id}`} className="btn-primary btn-lg px-8">查看订单</Link><Link to="/" className="btn-outline btn-lg px-8">继续购物</Link></div>
        </div>
      )}
      <AddressModal addr={editing} onClose={() => setEditing(null)} onSave={a => { upsertAddress(a); setAddrId(a.id); setEditing(null); toast('地址已保存') }} />
    </div>
  )
}

export function AddressModal({ addr, onClose, onSave }: { addr: Address | null; onClose: () => void; onSave: (a: Address) => void }) {
  const [f, setF] = useState<Address | null>(addr)
  const [touched, setTouched] = useState<Record<string, boolean>>({})
  if (addr && (!f || f.id !== addr.id)) { setF({ ...addr, country: addr.country || (addr.name ? 'CN' : defaultCountry()) }); setTouched({}) }
  if (!addr || !f) return null
  const c = countryOf(f.country)
  const errs = validateAddress(f)
  const show = (k: keyof AddrErrors) => (touched[k] || touched._all) && errs[k]
  const blur = (k: string) => () => setTouched(t => ({ ...t, [k]: true }))
  const save = () => {
    if (Object.keys(errs).length) { setTouched({ _all: true }); return }
    onSave({ ...f, name: f.name.trim(), phone: normPhone(f.phone, c), region: f.region.trim(), detail: f.detail.trim(), zip: f.zip?.trim() || undefined })
  }
  const Err = ({ k }: { k: keyof AddrErrors }) => show(k) ? <div className="text-xs text-red-500 mt-1">{errs[k]}</div> : null
  const bad = (k: keyof AddrErrors) => show(k) ? 'border-red-400 focus:border-red-500 focus:ring-red-100' : ''
  return (
    <Modal open={!!addr} onClose={onClose} title={addr.name ? '修改收货地址' : '新增收货地址'} footer={<><button className="btn-outline" onClick={onClose}>取消</button><button className="btn-primary" onClick={save}>保存</button></>}>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div><Field label="收货人" required><input className={cls('input', bad('name'))} value={f.name} onBlur={blur('name')} onChange={e => setF({ ...f, name: e.target.value })} placeholder="姓名" autoComplete="name" /></Field><Err k="name" /></div>
        <div><Field label="所在国家" required><select aria-label="所在国家" className={cls('input', bad('country'))} value={f.country} onChange={e => setF({ ...f, country: e.target.value })}>{COUNTRIES.map(x => <option key={x.code} value={x.code}>{x.flag} {x.name} · {x.en}</option>)}</select></Field><Err k="country" /></div>
        <div className="sm:col-span-2"><Field label="手机号" required>
          <div className={cls('flex rounded-lg border overflow-hidden focus-within:ring-2', show('phone') ? 'border-red-400 focus-within:ring-red-100' : 'border-ink-200 focus-within:border-brand-500 focus-within:ring-brand-100')}>
            <span className="shrink-0 px-3 flex items-center gap-1 bg-ink-50 text-sm text-ink-700 border-r border-ink-200" dir="ltr">{c.flag} +{c.dial}</span>
            <input className="flex-1 min-w-0 h-10 px-3 text-sm outline-none" dir="ltr" inputMode="tel" autoComplete="tel-national" value={f.phone} onBlur={blur('phone')} onChange={e => setF({ ...f, phone: e.target.value })} placeholder={`${c.len[0] === c.len[1] ? c.len[0] : `${c.len[0]}–${c.len[1]}`} 位号码，开头的 0 可省略`} />
          </div>
        </Field><Err k="phone" /></div>
        <div><Field label="所在城市" required><input className={cls('input', bad('region'))} value={f.region} onBlur={blur('region')} onChange={e => setF({ ...f, region: e.target.value })} placeholder="城市 / 省州，如 胡志明市" autoComplete="address-level2" /></Field><Err k="region" /></div>
        <div><Field label="邮政编码"><input className={cls('input', bad('zip'))} value={f.zip ?? ''} onBlur={blur('zip')} onChange={e => setF({ ...f, zip: e.target.value })} placeholder={c.zipHint ? `选填，${c.zipHint}` : '选填'} autoComplete="postal-code" dir="ltr" /></Field><Err k="zip" /></div>
        <div className="sm:col-span-2"><Field label="详细地址" required><textarea className={cls('input h-20 py-2', bad('detail'))} value={f.detail} onBlur={blur('detail')} onChange={e => setF({ ...f, detail: e.target.value })} placeholder="区 / 街道 / 门牌号 / 楼栋房间号，如 7 郡 阮氏明开街 1 号 402 室" autoComplete="street-address" /></Field><Err k="detail" /></div>
        <label className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" className="accent-brand-500" checked={f.isDefault} onChange={e => setF({ ...f, isDefault: e.target.checked })} />设为默认地址</label>
      </div>
    </Modal>
  )
}
