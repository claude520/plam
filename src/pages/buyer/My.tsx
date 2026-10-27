import { Link } from 'react-router-dom'
import { ChevronRight, Heart, ThumbsDown } from 'lucide-react'
import { useDB } from '@/store/db'
import { useCurrentUser } from '@/lib/hooks'
import { Avatar, Img } from '@/components/ui'
import { money } from '@/lib/format'
import { ProductCard } from '@/components/ProductCard'

export default function My() {
  const user = useCurrentUser()!
  const { orders, favorites, footprints, cart, products, myCoupons, coupons } = useDB()
  const my = orders.filter(o => o.userId === user.id)
  const count = (s: string[]) => my.filter(o => s.includes(o.status)).length
  const favP = favorites.map(id => products.find(p => p.id === id)!).filter(Boolean)
  const footP = footprints.map(f => products.find(p => p.id === f.productId)!).filter(Boolean)
  const cartP = cart.map(c => products.find(p => p.id === c.productId)!).filter(Boolean)
  const validCoupons = myCoupons.filter(m => !m.used && coupons.find(c => c.id === m.couponId)?.status === 'active').length
  const Mini = ({ title, to, p, sub }: { title: string; to: string; p?: typeof products[0]; sub?: string }) => (
    <div className="card p-4">
      <Link to={to} className="font-semibold flex items-center gap-1 hover:text-brand-500">{title}<ChevronRight className="w-4 h-4 text-ink-400" /></Link>
      {p && <Link to={`/item/${p.id}`} className="block mt-3 group"><div className="w-full aspect-square rounded-lg overflow-hidden"><Img src={p.images[0]} alt={p.title} w={140} h={140} className="w-full h-full group-hover:scale-105 transition-transform" /></div><div className="text-xs text-ink-700 line-clamp-1 mt-2">{p.title}</div><div className="text-xs mt-0.5">{sub ? <span className="text-brand-500">{sub}</span> : <span className="price">¥{money(p.price)}</span>}</div></Link>}
    </div>
  )
  return (
    <div className="space-y-4">
      <div className="card p-6 flex items-center gap-6 bg-gradient-to-r from-brand-50/60 to-white">
        <Avatar src={user.avatar} name={user.nickname} size={120} className="border-4 border-white shadow-card" />
        <div className="flex-1">
          <div className="text-2xl font-semibold">{user.nickname}</div>
          <div className="text-sm text-ink-500 mt-1 flex items-center gap-3"><span>{user.username}</span><Link to="/my/address" className="hover:text-brand-500">收货地址</Link></div>
          <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-ink-900 text-white text-xs px-3 py-1.5"><span className="font-bold text-amber-300">88VIP</span>开卡享20+专属权益，免费领各大会员，退货包运费！点击领权益&gt;&gt;</div>
        </div>
        <div className="w-[340px]">
          <div className="grid grid-cols-3 text-center text-sm">
            {[['红包', `${3}元`], ['优惠券', `${validCoupons}张`], ['淘金币抵', `${money(user.coins / 100, 0)}元`]].map(([l, v]) => <div key={l}><span className="text-ink-600">{l}</span> <b className="font-num text-base">{v}</b></div>)}
          </div>
          <div className="mt-3 rounded-xl bg-brand-50 border border-brand-100 p-3 flex items-center justify-between"><div className="flex items-center gap-2"><span className="w-8 h-8 rounded-lg bg-brand-500 text-white flex items-center justify-center text-xs">红包</span><div className="text-sm"><div className="font-medium"><span className="text-brand-500">3元</span>红包待使用</div><div className="text-xs text-brand-500">仅剩23小时</div></div></div><Link to="/my/coupons" className="btn-primary btn-sm">去使用</Link></div>
        </div>
      </div>

      <div className="grid grid-cols-[1fr_180px_180px_180px] gap-4">
        <div className="card p-5">
          <Link to="/my/orders" className="font-semibold flex items-center gap-1 hover:text-brand-500">我的订单<ChevronRight className="w-4 h-4 text-ink-400" /></Link>
          <div className="grid grid-cols-5 mt-5 text-center">
            {[['待付款', count(['unpaid']), 'unpaid'], ['待发货', count(['paid']), 'paid'], ['待收货', count(['shipped']), 'shipped'], ['待评价', count(['received']), 'received'], ['退款/售后', count(['refunding']), 'refund']].map(([l, n, t]) => (
              <Link key={l as string} to={`/my/orders?tab=${t}`} className="hover:text-brand-500"><div className="text-2xl font-num font-semibold">{n as number}</div><div className="text-sm text-ink-600 mt-1">{l as string}</div></Link>
            ))}
          </div>
          <div className="mt-6 text-center text-sm"><div className="font-medium">{my.find(o => o.status === 'shipped') ? `您的包裹正在派送中：${my.find(o => o.status === 'shipped')!.logistics?.traces.at(-1)?.text}` : '当前暂无物流信息更新'}</div><Link to="/my/orders" className="text-ink-400 text-xs hover:text-brand-500">查看全部订单 ›</Link></div>
        </div>
        <Mini title="我的收藏" to="/my/favorites" p={favP[0]} sub={favP[0]?.originalPrice ? `收藏后降￥${money(favP[0].originalPrice - favP[0].price)}` : undefined} />
        <Mini title="我的足迹" to="/my/footprints" p={footP[0]} />
        <Mini title="购物车" to="/cart" p={cartP[0]} />
      </div>

      <div className="card p-4">
        <div className="flex gap-3 overflow-x-auto no-scrollbar">
          <div className="shrink-0 w-28 rounded-xl bg-brand-50 flex flex-col items-center justify-center text-center p-3"><span className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-brand-500 mb-2"><Heart className="w-5 h-5" /></span><div className="text-sm font-medium">常买常逛</div><div className="text-xs text-ink-500">推荐常看商品</div><div className="text-[10px] text-ink-400 mt-2 flex items-center gap-0.5"><ThumbsDown className="w-3 h-3" />不感兴趣</div></div>
          {footP.slice(0, 10).map(p => <Link key={p.id} to={`/item/${p.id}`} className="shrink-0 w-28 group"><div className="w-28 h-28 rounded-xl overflow-hidden"><Img src={p.images[0]} alt={p.title} w={112} h={112} className="w-full h-full group-hover:scale-105 transition-transform" /></div><div className="price text-sm mt-1">¥{money(p.price)}</div><div className="text-xs text-brand-500">最近浏览</div></Link>)}
        </div>
      </div>

      <div><div className="font-semibold text-lg mb-3">猜你喜欢</div><div className="grid grid-cols-5 gap-3">{products.filter(p => p.status === 'on').slice(0, 15).map(p => <ProductCard key={p.id} p={p} />)}</div></div>
    </div>
  )
}
