import { useMemo, useState } from 'react'
import { defaultCountry, fmtAddr, fmtPhone } from '@/lib/address'
import { Link, useSearchParams } from 'react-router-dom'
import { Heart, Trash2, Clock, Store, Ticket, Plus, MapPin, Shield, Smartphone, Lock, MessageSquare, FileText, Star, Send } from 'lucide-react'
import { useDB, genId } from '@/store/db'
import { useCurrentUser } from '@/lib/hooks'
import { Avatar, Empty, Img, Tabs, Field, Confirm, Rating, Table, type Column } from '@/components/ui'
import { cls, compact, fmtDate, money, REFUND_STATUS, timeAgo } from '@/lib/format'
import { toast } from '@/store/session'
import { AddressModal } from './Checkout'
import type { Address, Refund } from '@/data/types'
import { ProductCard } from '@/components/ProductCard'

export function Favorites() {
  const { favorites, products, toggleFavorite, shops } = useDB()
  const [tab, setTab] = useState<'all' | 'drop' | 'coupon'>('all')
  const list = favorites.map(id => products.find(p => p.id === id)!).filter(Boolean).filter(p => tab === 'all' || (tab === 'drop' ? p.originalPrice : p.tags.length))
  return (
    <div className="card">
      <div className="px-5"><Tabs items={[{ key: 'all', label: `全部宝贝(${favorites.length})` }, { key: 'drop', label: '降价' }, { key: 'coupon', label: '有优惠' }]} value={tab} onChange={setTab} size="lg" /></div>
      {list.length === 0 ? <Empty text="还没有收藏的宝贝" icon={<Heart className="w-6 h-6" />} /> : (
        <div className="p-3 md:p-5 grid grid-cols-2 md:grid-cols-5 gap-2 md:gap-3">
          {list.map(p => (
            <div key={p.id} className="group relative">
              <ProductCard p={p} />
              <button onClick={() => { toggleFavorite(p.id); toast('已取消收藏') }} aria-label="取消收藏" className="absolute top-2 right-2 w-7 h-7 rounded-full bg-white/90 shadow flex items-center justify-center text-ink-500 hover:text-brand-500 opacity-0 group-hover:opacity-100 transition"><Trash2 className="w-3.5 h-3.5" /></button>
              {p.originalPrice && <div className="absolute left-2 bottom-[86px] text-[11px] text-brand-500 bg-white/90 rounded px-1.5">收藏后降 ¥{money(p.originalPrice - p.price)}</div>}
              <div className="hidden">{shops.length}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function Footprints() {
  const { footprints, products } = useDB()
  const groups = useMemo(() => { const m = new Map<string, typeof footprints>(); footprints.forEach(f => { const d = fmtDate(f.time, false); m.set(d, [...(m.get(d) ?? []), f]) }); return [...m.entries()] }, [footprints])
  return (
    <div className="card p-5">
      <div className="font-semibold text-lg mb-4 flex items-center gap-2"><Clock className="w-5 h-5 text-brand-500" />我的足迹</div>
      {groups.length === 0 && <Empty text="暂无浏览记录" />}
      {groups.map(([d, fs]) => (
        <div key={d} className="mb-6"><div className="text-sm text-ink-500 mb-3">{d === fmtDate(new Date().toISOString(), false) ? '今天' : d}</div><div className="grid grid-cols-2 md:grid-cols-5 gap-2 md:gap-3">{fs.map(f => products.find(p => p.id === f.productId)).filter(Boolean).map(p => <ProductCard key={p!.id} p={p!} />)}</div></div>
      ))}
    </div>
  )
}

export function Shops() {
  const [sp] = useSearchParams()
  const user = useCurrentUser()!
  const { followedShops, shops, toggleFollowShop, products, orders } = useDB()
  const bought = sp.get('tab') === 'bought'
  const list = bought ? [...new Set(orders.filter(o => o.userId === user.id).map(o => o.shopId))].map(id => shops.find(s => s.id === id)!) : followedShops.map(id => shops.find(s => s.id === id)!).filter(Boolean)
  return (
    <div className="card p-5">
      <div className="font-semibold text-lg mb-4 flex items-center gap-2"><Store className="w-5 h-5 text-brand-500" />{bought ? '购买过的店铺' : `关注店铺（${followedShops.length}）`}</div>
      {list.length === 0 && <Empty text="暂无店铺" />}
      <div className="space-y-3">
        {list.map(s => (
          <div key={s.id} className="flex items-center gap-3 md:gap-4 border border-ink-100 rounded-xl p-3 md:p-4 flex-wrap">
            <Avatar src={s.logo} name={s.name} size={56} />
            <div className="w-56"><Link to={`/shop/${s.id}`} className="font-semibold hover:text-brand-500">{s.name}</Link><div className="text-xs text-ink-500 mt-1">粉丝 {compact(s.fans)} · {s.type === 'tmall' ? '天猫' : 'Plam'}</div></div>
            <div className="flex-1 flex gap-2">{products.filter(p => p.shopId === s.id).slice(0, 4).map(p => <Link key={p.id} to={`/item/${p.id}`} className="w-16 h-16 rounded-lg overflow-hidden"><Img src={p.images[0]} alt={p.title} w={64} h={64} className="w-full h-full" /></Link>)}</div>
            <span className="tag-red">5件上新</span>
            <button onClick={() => { toggleFollowShop(s.id); toast(followedShops.includes(s.id) ? '已取消关注' : '关注成功') }} className={cls('btn-sm', followedShops.includes(s.id) ? 'btn-outline' : 'btn-primary')}>{followedShops.includes(s.id) ? '取消关注' : '+ 关注'}</button>
          </div>
        ))}
      </div>
    </div>
  )
}

export function Coupons() {
  const { myCoupons, coupons, claimCoupon, shops } = useDB()
  const [tab, setTab] = useState<'mine' | 'center' | 'used'>('mine')
  const mine = myCoupons.map(m => ({ ...m, c: coupons.find(c => c.id === m.couponId)! })).filter(x => x.c)
  const center = coupons.filter(c => c.status === 'active' && !myCoupons.some(m => m.couponId === c.id))
  const Card = ({ c, used, action }: { c: typeof coupons[0]; used?: boolean; action?: React.ReactNode }) => (
    <div className={cls('relative flex rounded-xl overflow-hidden border', used ? 'border-ink-200 opacity-60' : 'border-brand-200')}>
      <div className={cls('w-28 flex flex-col items-center justify-center text-white py-4', used ? 'bg-ink-400' : c.shopId ? 'bg-gradient-to-br from-brand-400 to-brand-600' : 'bg-gradient-to-br from-rose-500 to-brand-500')}>
        <div className="font-num text-2xl font-bold">{c.type === 'discount' ? `${c.value * 10}折` : <><span className="text-sm">¥</span>{c.value}</>}</div><div className="text-[11px] opacity-90">{c.threshold ? `满${c.threshold}可用` : '无门槛'}</div>
      </div>
      <div className="flex-1 p-3 bg-white"><div className="font-medium text-sm">{c.name}</div><div className="text-xs text-ink-500 mt-1">{c.shopId ? `限 ${shops.find(s => s.id === c.shopId)?.name} 使用` : '全平台通用'}</div><div className="text-xs text-ink-400 mt-1">{fmtDate(c.startAt, false)} ~ {fmtDate(c.endAt, false)}</div></div>
      <div className="flex items-center pr-3">{action}</div>
    </div>
  )
  return (
    <div className="card">
      <div className="px-5"><Tabs items={[{ key: 'mine', label: '我的优惠券', count: mine.filter(m => !m.used).length }, { key: 'center', label: '领券中心' }, { key: 'used', label: '已使用/过期' }]} value={tab} onChange={setTab} size="lg" /></div>
      <div className="p-4 md:p-5 grid grid-cols-1 md:grid-cols-2 gap-3">
        {tab === 'mine' && mine.filter(m => !m.used && m.c.status === 'active').map(m => <Card key={m.couponId} c={m.c} action={<Link to={m.c.shopId ? `/shop/${m.c.shopId}` : '/'} className="btn-primary btn-sm">去使用</Link>} />)}
        {tab === 'center' && center.map(c => <Card key={c.id} c={c} action={<button onClick={() => { claimCoupon(c.id); toast('领取成功') }} className="btn-primary btn-sm">立即领取</button>} />)}
        {tab === 'used' && mine.filter(m => m.used || m.c.status !== 'active').map(m => <Card key={m.couponId} c={m.c} used />)}
      </div>
      {((tab === 'mine' && mine.filter(m => !m.used).length === 0) || (tab === 'center' && center.length === 0) || (tab === 'used' && mine.filter(m => m.used).length === 0)) && <Empty text="暂无优惠券" icon={<Ticket className="w-6 h-6" />} />}
    </div>
  )
}

export function AddressPage() {
  const user = useCurrentUser()!
  const { addresses, upsertAddress, removeAddress } = useDB()
  const [editing, setEditing] = useState<Address | null>(null)
  const [del, setDel] = useState<string | null>(null)
  const mine = addresses.filter(a => a.userId === user.id)
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-4"><div className="font-semibold text-lg flex items-center gap-2"><MapPin className="w-5 h-5 text-brand-500" />收货地址</div><button onClick={() => setEditing({ id: genId('a'), userId: user.id, name: '', phone: '', country: defaultCountry(), region: '', detail: '', isDefault: mine.length === 0 })} className="btn-primary btn-sm"><Plus className="w-3.5 h-3.5" />新增收货地址</button></div>
      <div className="text-xs text-ink-400 mb-3">已保存 {mine.length} 条地址，最多可保存 20 条</div>
      <table className="w-full text-sm"><thead><tr className="bg-ink-50 text-ink-500 text-left"><th className="px-3 py-2.5 font-medium">收货人</th><th className="px-3 py-2.5 font-medium">国家 / 城市</th><th className="px-3 py-2.5 font-medium">详细地址</th><th className="px-3 py-2.5 font-medium">手机</th><th className="px-3 py-2.5 font-medium text-right">操作</th></tr></thead>
        <tbody>{mine.map(a => <tr key={a.id} className="border-b border-ink-100"><td className="px-3 py-3">{a.name}{a.isDefault && <span className="tag-red ml-2">默认地址</span>}</td><td className="px-3 py-3">{fmtAddr({ country: a.country, region: a.region, detail: '' })}</td><td className="px-3 py-3">{a.detail}{a.zip ? ` ${a.zip}` : ''}</td><td className="px-3 py-3 font-num" dir="ltr">{fmtPhone(a)}</td><td className="px-3 py-3 text-right space-x-3"><button onClick={() => setEditing(a)} className="link">修改</button><button onClick={() => setDel(a.id)} className="link text-ink-500">删除</button>{!a.isDefault && <button onClick={() => { upsertAddress({ ...a, isDefault: true }); toast('已设为默认') }} className="link text-ink-500">设为默认</button>}</td></tr>)}</tbody></table>
      {mine.length === 0 && <Empty text="还没有收货地址" />}
      <AddressModal addr={editing} onClose={() => setEditing(null)} onSave={a => { upsertAddress(a); setEditing(null); toast('地址已保存') }} />
      <Confirm open={!!del} onClose={() => setDel(null)} onOk={() => { removeAddress(del!); toast('已删除') }} title="删除该收货地址？" danger />
    </div>
  )
}

export function Settings() {
  const [sp] = useSearchParams()
  const user = useCurrentUser()!
  const { updateUser } = useDB()
  const [tab, setTab] = useState<'profile' | 'security'>(sp.get('tab') === 'security' ? 'security' : 'profile')
  const [f, setF] = useState({ nickname: user.nickname, email: user.email ?? '', phone: user.phone })
  return (
    <div className="card">
      <div className="px-5"><Tabs items={[{ key: 'profile', label: '个人资料' }, { key: 'security', label: '安全设置' }]} value={tab} onChange={setTab} size="lg" /></div>
      {tab === 'profile' ? (
        <div className="p-6 max-w-xl">
          <div className="flex items-center gap-4 mb-6"><Avatar src={user.avatar} name={user.nickname} size={72} /><div><button onClick={() => toast('演示环境暂不支持上传头像', 'info')} className="btn-outline btn-sm">更换头像</button><div className="text-xs text-ink-400 mt-1">支持 JPG/PNG，不超过 2MB</div></div></div>
          <div className="space-y-4">
            <Field label="会员名"><input className="input bg-ink-50" value={user.username} readOnly /></Field>
            <Field label="昵称"><input className="input" value={f.nickname} onChange={e => setF({ ...f, nickname: e.target.value })} /></Field>
            <Field label="手机号"><input className="input" value={f.phone} onChange={e => setF({ ...f, phone: e.target.value })} /></Field>
            <Field label="邮箱"><input className="input" value={f.email} onChange={e => setF({ ...f, email: e.target.value })} /></Field>
            <Field label="账户余额"><div className="input bg-ink-50 flex items-center font-num">¥{money(user.balance)}</div></Field>
            <button onClick={() => { updateUser(user.id, f); toast('资料已保存') }} className="btn-primary">保存</button>
          </div>
        </div>
      ) : (
        <div className="p-6 divide-y divide-ink-100">
          {[[<Lock className="w-5 h-5" />, '登录密码', '建议定期更换密码，设置安全性高的密码', '修改'], [<Smartphone className="w-5 h-5" />, '手机绑定', `已绑定 ${user.phone}`, '更换'], [<Shield className="w-5 h-5" />, '登录保护', '开启后登录时需要短信验证', '开启'], [<Shield className="w-5 h-5" />, '支付密码', '用于余额支付的 6 位数字密码', '设置']].map(([ic, t, d, a], i) => (
            <div key={i} className="flex items-center gap-4 py-4"><span className="w-10 h-10 rounded-full bg-ink-50 flex items-center justify-center text-ink-600">{ic as React.ReactNode}</span><div className="flex-1"><div className="font-medium">{t as string}</div><div className="text-xs text-ink-500 mt-0.5">{d as string}</div></div><button onClick={() => toast('演示环境：操作已记录', 'info')} className="btn-outline btn-sm">{a as string}</button></div>
          ))}
        </div>
      )}
    </div>
  )
}

export function Refunds() {
  const user = useCurrentUser()!
  const { refunds, orders, shops, updateRefund } = useDB()
  const mine = refunds.filter(r => r.userId === user.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  const cols: Column<Refund>[] = [
    { key: 'order', title: '商品', render: r => { const o = orders.find(x => x.id === r.orderId); return o ? <div className="flex gap-2 items-center"><Img src={o.items[0].image} alt="" w={48} h={48} className="w-12 h-12 rounded" /><div className="text-xs"><div className="line-clamp-1 max-w-[260px]">{o.items[0].title}</div><div className="text-ink-400 mt-0.5">{shops.find(s => s.id === o.shopId)?.name}</div></div></div> : '-' } },
    { key: 'id', title: '售后编号', render: r => <span className="font-num text-xs">{r.id}</span> },
    { key: 'type', title: '类型', render: r => r.type === 'refund' ? '仅退款' : '退货退款' },
    { key: 'amount', title: '退款金额', render: r => <span className="price">¥{money(r.amount)}</span> },
    { key: 'reason', title: '原因' },
    { key: 'createdAt', title: '申请时间', render: r => <span className="text-xs">{fmtDate(r.createdAt)}</span> },
    { key: 'status', title: '状态', render: r => <span className={REFUND_STATUS[r.status].cls}>{REFUND_STATUS[r.status].label}</span> },
    { key: 'op', title: '操作', render: r => r.status === 'pending' ? <button onClick={() => { updateRefund(r.id, { status: 'cancelled' }); toast('已撤销申请') }} className="link">撤销申请</button> : <Link to={`/my/orders/${r.orderId}`} className="link">查看订单</Link> },
  ]
  return <div className="card p-5"><div className="font-semibold text-lg mb-4">退款维权</div><Table columns={cols} data={mine} empty="暂无退款/售后记录" /></div>
}

export function Reviews() {
  const user = useCurrentUser()!
  const { reviews, products, orders } = useDB()
  const [tab, setTab] = useState<'pending' | 'done'>('pending')
  const pending = orders.filter(o => o.userId === user.id && o.status === 'received')
  const mine = reviews.filter(r => r.userId === user.id)
  return (
    <div className="card">
      <div className="px-5"><Tabs items={[{ key: 'pending', label: '待评价', count: pending.length }, { key: 'done', label: '已评价', count: mine.length }]} value={tab} onChange={setTab} size="lg" /></div>
      <div className="p-5">
        {tab === 'pending' ? (pending.length === 0 ? <Empty text="暂无待评价订单" icon={<Star className="w-6 h-6" />} /> : pending.map(o => <div key={o.id} className="flex items-center gap-3 py-3 border-b border-ink-100 last:border-0"><Img src={o.items[0].image} alt="" w={64} h={64} className="w-16 h-16 rounded-lg" /><div className="flex-1 text-sm line-clamp-2">{o.items[0].title}</div><Link to="/my/orders?tab=received" className="btn-primary btn-sm">去评价</Link></div>))
          : (mine.length === 0 ? <Empty text="还没有发表过评价" /> : mine.map(r => { const p = products.find(x => x.id === r.productId); return <div key={r.id} className="flex gap-3 py-4 border-b border-ink-100 last:border-0"><Img src={p?.images[0] ?? ''} alt="" w={64} h={64} className="w-16 h-16 rounded-lg" /><div className="flex-1"><div className="text-sm line-clamp-1">{p?.title}</div><div className="flex items-center gap-2 mt-1"><Rating value={r.rating} /><span className="text-xs text-ink-400">{fmtDate(r.createdAt)}</span></div><div className="text-sm mt-1.5">{r.content}</div>{r.reply && <div className="mt-2 text-xs bg-ink-50 rounded-lg p-2 text-ink-600"><span className="text-brand-500">掌柜回复：</span>{r.reply}</div>}</div></div> }))}
      </div>
    </div>
  )
}

export function Messages() {
  const user = useCurrentUser()!
  const { messages, shops, sendMessage } = useDB()
  const threads = useMemo(() => { const ids = [...new Set(messages.filter(m => m.from === user.id || m.to === user.id).map(m => m.shopId))]; return ids.length ? ids : ['s6'] }, [messages, user.id])
  const [cur, setCur] = useState(threads[0])
  const [text, setText] = useState('')
  const list = messages.filter(m => m.shopId === cur && (m.from === user.id || m.to === user.id))
  const shop = shops.find(s => s.id === cur)!
  const system = [{ t: '交易物流', d: '您的订单已签收，期待您的评价', time: '10:24' }, { t: '活动消息', d: '双11开门红：叠券低至7.2折起，速来抢购', time: '昨天' }, { t: '系统通知', d: '支付系统将于 10月30日 凌晨升级', time: '2天前' }]
  return (
    <div className="card grid grid-cols-[260px_1fr] max-md:!grid-cols-1 h-[600px] overflow-hidden">
      <div className="border-r border-ink-100 overflow-auto max-md:max-h-40 max-md:border-r-0 max-md:border-b">
        <div className="px-4 py-3 font-semibold flex items-center gap-2"><MessageSquare className="w-4 h-4 text-brand-500" />消息中心</div>
        {system.map(s => <div key={s.t} className="px-4 py-3 hover:bg-ink-50 cursor-pointer border-b border-ink-50"><div className="flex items-center justify-between text-sm"><span className="font-medium">{s.t}</span><span className="text-xs text-ink-400">{s.time}</span></div><div className="text-xs text-ink-500 line-clamp-1 mt-0.5">{s.d}</div></div>)}
        <div className="px-4 py-2 text-xs text-ink-400">店铺会话</div>
        {threads.map(id => { const s = shops.find(x => x.id === id)!; return <button key={id} onClick={() => setCur(id)} className={cls('w-full text-left px-4 py-3 flex items-center gap-3', cur === id ? 'bg-brand-50' : 'hover:bg-ink-50')}><Avatar src={s.logo} name={s.name} size={36} /><div className="min-w-0"><div className="text-sm font-medium truncate">{s.name}</div><div className="text-xs text-ink-400 truncate">{messages.filter(m => m.shopId === id).at(-1)?.content ?? '暂无消息'}</div></div></button> })}
      </div>
      <div className="flex flex-col">
        <div className="px-5 h-12 border-b border-ink-100 flex items-center font-medium">{shop.name}</div>
        <div className="flex-1 overflow-auto p-5 space-y-4 bg-ink-50/50">
          {list.map(m => <div key={m.id} className={cls('flex gap-2', m.from === user.id ? 'flex-row-reverse' : '')}><Avatar src={m.from === user.id ? user.avatar : shop.logo} name="" size={32} /><div><div className={cls('max-w-md rounded-2xl px-3.5 py-2 text-sm', m.from === user.id ? 'bg-brand-500 text-white rounded-tr-sm' : 'bg-white rounded-tl-sm shadow-card')}>{m.content}</div><div className="text-[10px] text-ink-400 mt-1">{timeAgo(m.time)}</div></div></div>)}
          {list.length === 0 && <div className="text-center text-ink-400 text-sm py-10">开始和店铺聊天吧</div>}
        </div>
        <form onSubmit={e => { e.preventDefault(); if (!text.trim()) return; sendMessage({ from: user.id, to: cur, shopId: cur, content: text.trim() }); setText('') }} className="p-3 border-t border-ink-100 flex gap-2"><input aria-label="消息" className="input" value={text} onChange={e => setText(e.target.value)} placeholder="输入消息…" /><button className="btn-primary" type="submit"><Send className="w-4 h-4" />发送</button></form>
      </div>
    </div>
  )
}

export function Invoices() {
  const user = useCurrentUser()!
  const { orders, shops } = useDB()
  const mine = orders.filter(o => o.userId === user.id && (o.status === 'done' || o.status === 'received')).slice(0, 12)
  return (
    <div className="card p-5">
      <div className="font-semibold text-lg mb-4 flex items-center gap-2"><FileText className="w-5 h-5 text-brand-500" />我的发票</div>
      <table className="w-full text-sm"><thead><tr className="bg-ink-50 text-ink-500 text-left"><th className="px-3 py-2.5 font-medium">订单号</th><th className="px-3 py-2.5 font-medium">店铺</th><th className="px-3 py-2.5 font-medium">金额</th><th className="px-3 py-2.5 font-medium">发票状态</th><th className="px-3 py-2.5 font-medium text-right">操作</th></tr></thead>
        <tbody>{mine.map((o, i) => <tr key={o.id} className="border-b border-ink-100"><td className="px-3 py-3 font-num">{o.id}</td><td className="px-3 py-3">{shops.find(s => s.id === o.shopId)?.name}</td><td className="px-3 py-3 font-num">¥{money(o.payAmount)}</td><td className="px-3 py-3">{i % 3 === 0 ? <span className="tag-green">已开票</span> : <span className="tag-gray">未申请</span>}</td><td className="px-3 py-3 text-right">{i % 3 === 0 ? <button onClick={() => toast('发票已发送至邮箱', 'info')} className="link">下载发票</button> : <button onClick={() => toast('开票申请已提交')} className="link">申请开票</button>}</td></tr>)}</tbody></table>
      {mine.length === 0 && <Empty text="暂无可开票订单" />}
    </div>
  )
}
