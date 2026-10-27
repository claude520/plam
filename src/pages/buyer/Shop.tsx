import { useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { MapPin, Star } from 'lucide-react'
import { useDB } from '@/store/db'
import { useShop } from '@/lib/hooks'
import { Avatar, Empty, Tabs } from '@/components/ui'
import { ProductCard } from '@/components/ProductCard'
import { cls, compact, fmtDate } from '@/lib/format'
import { toast } from '@/store/session'

export default function Shop() {
  const { id } = useParams()
  const shop = useShop(id)
  const { products, followedShops, toggleFollowShop, coupons, claimCoupon, myCoupons, categories } = useDB()
  const [tab, setTab] = useState<'all' | 'new' | 'hot' | 'about'>('all')
  const [cat, setCat] = useState('')
  const list = useMemo(() => {
    let r = products.filter(p => p.shopId === id && p.status === 'on')
    if (cat) r = r.filter(p => p.categoryId === cat)
    if (tab === 'new') r = [...r].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    if (tab === 'hot') r = [...r].sort((a, b) => b.sales - a.sales)
    return r
  }, [products, id, tab, cat])
  if (!shop) return <div className="container-x py-20"><Empty text="店铺不存在" /></div>
  const followed = followedShops.includes(shop.id)
  const shopCats = categories.filter(c => products.some(p => p.shopId === id && p.categoryId === c.id))
  const shopCoupons = coupons.filter(c => c.shopId === shop.id && c.status === 'active')
  return (
    <div>
      <div className="min-h-[176px] bg-gradient-to-r from-ink-900 via-ink-800 to-brand-900 relative overflow-hidden">
        <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle at 20% 50%, #ff8a4c 0, transparent 40%), radial-gradient(circle at 80% 20%, #5f8cff 0, transparent 40%)' }} />
        <div className="container-x h-full flex items-end pb-5 relative">
          <div className="flex flex-col md:flex-row md:items-end gap-3 md:gap-5 text-white w-full pt-4">
            <Avatar src={shop.logo} name={shop.name} size={72} className="border-4 border-white shadow-float" />
            <div className="flex-1 pb-1">
              <div className="flex items-center gap-2"><h1 className="text-2xl font-bold">{shop.name}</h1>{shop.type === 'tmall' && <span className="tag bg-brand-500 text-white">天猫</span>}<span className="flex items-center gap-0.5 text-amber-300 text-xs">{Array.from({ length: Math.min(5, shop.level) }).map((_, i) => <Star key={i} className="w-3 h-3 fill-amber-300" />)}</span></div>
              <div className="text-sm opacity-80 mt-1 flex items-center gap-4 flex-wrap"><span>粉丝 {compact(shop.fans)}</span><span>描述 {shop.score.desc.toFixed(1)} · 服务 {shop.score.service.toFixed(1)} · 物流 {shop.score.logistics.toFixed(1)}</span><span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{shop.address}</span></div>
            </div>
            <button onClick={() => { toggleFollowShop(shop.id); toast(followed ? '已取消关注' : '关注成功') }} className={cls('btn-lg px-8', followed ? 'btn bg-white/20 text-white hover:bg-white/30' : 'btn-primary')}>{followed ? '已关注' : '+ 关注店铺'}</button>
          </div>
        </div>
      </div>
      <div className="container-x py-4">
        {shopCoupons.length > 0 && (
          <div className="card p-4 mb-4 flex items-center gap-3 overflow-x-auto no-scrollbar"><span className="font-semibold text-sm shrink-0">店铺优惠券</span>{shopCoupons.map(c => { const got = myCoupons.some(m => m.couponId === c.id); return <button key={c.id} onClick={() => { claimCoupon(c.id); toast('领取成功') }} className="flex items-center rounded-lg overflow-hidden border border-brand-300 text-sm"><span className="bg-brand-500 text-white px-3 py-1.5 font-num font-semibold">{c.type === 'discount' ? `${c.value * 10}折` : `¥${c.value}`}</span><span className="px-3 text-brand-600">{c.type === 'full' ? `满${c.threshold}可用` : '无门槛'} · {got ? '已领取' : '立即领取'}</span></button> })}</div>
        )}
        <div className="grid grid-cols-[200px_1fr] lg-stack gap-4 items-start mobile-pb">
          <div className="card p-4 max-lg:hidden">
            <div className="font-semibold mb-2 text-sm">宝贝分类</div>
            <button onClick={() => setCat('')} className={cls('block w-full text-left px-2 py-1.5 rounded text-sm', !cat ? 'bg-brand-50 text-brand-500' : 'hover:bg-ink-50')}>全部宝贝</button>
            {shopCats.map(c => <button key={c.id} onClick={() => setCat(c.id)} className={cls('block w-full text-left px-2 py-1.5 rounded text-sm', cat === c.id ? 'bg-brand-50 text-brand-500' : 'hover:bg-ink-50')}>{c.name}</button>)}
            <div className="divider my-3" />
            <div className="text-xs text-ink-500 space-y-1.5"><div>开店时间：{fmtDate(shop.createdAt, false)}</div><div>保证金：已缴纳</div><div>所在地：{shop.address}</div></div>
          </div>
          <div>
            <div className="card px-5 mb-3"><Tabs items={[{ key: 'all', label: '全部宝贝' }, { key: 'new', label: '上新' }, { key: 'hot', label: '热销' }, { key: 'about', label: '店铺介绍' }]} value={tab} onChange={setTab} /></div>
            {tab === 'about' ? <div className="card p-6 text-sm text-ink-700 leading-7">{shop.description}<br />店铺等级 {shop.level} 级，累计粉丝 {compact(shop.fans)}。承诺正品保障、7 天无理由退换，部分商品支持退货宝。</div>
              : list.length === 0 ? <div className="card"><Empty text="暂无宝贝" /></div> : <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3">{list.map(p => <ProductCard key={p.id} p={p} />)}</div>}
          </div>
        </div>
      </div>
    </div>
  )
}
