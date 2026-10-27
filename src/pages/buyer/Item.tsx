import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Heart, MapPin, Minus, Plus, Share2, ShieldCheck, Truck, MessageCircle, Store, ChevronRight, Star } from 'lucide-react'
import { useDB } from '@/store/db'
import { useProduct, useShop, useCategoryName, useCurrentUser } from '@/lib/hooks'
import { Avatar, Img, Rating, Tabs, Empty } from '@/components/ui'
import { ProductCard } from '@/components/ProductCard'
import { cls, compact, money, fmtDate } from '@/lib/format'
import { toast } from '@/store/session'

export default function Item() {
  const { id } = useParams()
  const nav = useNavigate()
  const p = useProduct(id)
  const shop = useShop(p?.shopId)
  const catName = useCategoryName(p?.categoryId)
  const user = useCurrentUser()
  const { products, reviews, users, favorites, toggleFavorite, addToCart, addFootprint, followedShops, toggleFollowShop, coupons, myCoupons, claimCoupon } = useDB()
  const [img, setImg] = useState(0)
  const [sel, setSel] = useState<Record<string, string>>({})
  const [qty, setQty] = useState(1)
  const [tab, setTab] = useState<'detail' | 'reviews' | 'params'>('detail')
  useEffect(() => { if (p) { addFootprint(p.id); setSel({}); setImg(0); setQty(1) } }, [p?.id]) // eslint-disable-line
  const sku = useMemo(() => p?.skus.find(s => p.attrs.every(a => s.attrs[a.name] === sel[a.name])), [p, sel])
  const allSelected = p ? p.attrs.every(a => sel[a.name]) : false
  const price = sku?.price ?? p?.price ?? 0
  const prodReviews = useMemo(() => reviews.filter(r => r.productId === p?.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt)), [reviews, p])
  const shopProducts = useMemo(() => products.filter(x => x.shopId === p?.shopId && x.id !== p?.id && x.status === 'on').slice(0, 6), [products, p])
  const similar = useMemo(() => products.filter(x => x.categoryId === p?.categoryId && x.id !== p?.id && x.status === 'on').slice(0, 5), [products, p])
  const shopCoupons = coupons.filter(c => (c.shopId === p?.shopId || !c.shopId) && c.status === 'active')
  if (!p || !shop) return <div className="container-x py-20"><Empty text="宝贝不存在或已下架" /></div>
  const fav = favorites.includes(p.id)
  const followed = followedShops.includes(shop.id)
  const ensureSku = () => { if (!allSelected) { toast('请选择完整的商品规格', 'error'); return false } if (!sku || sku.stock < qty) { toast('该规格库存不足', 'error'); return false } return true }
  const buyNow = () => { if (!user) return nav('/login'); if (!ensureSku()) return; nav(`/checkout?pid=${p.id}&sku=${sku!.id}&qty=${qty}`) }
  const addCart = () => { if (!user) return nav('/login'); if (!ensureSku()) return; addToCart(p.id, sku!.id, qty); toast('已加入购物车') }

  return (
    <div className="container-x py-4">
      <div className="text-xs text-ink-500 mb-3 flex items-center gap-1.5"><Link to="/" className="hover:text-brand-500">首页</Link><ChevronRight className="w-3 h-3" /><span>{catName}</span><ChevronRight className="w-3 h-3" /><span className="text-ink-800 truncate max-w-md">{p.title}</span></div>
      <div className="card p-6 grid grid-cols-[460px_1fr_240px] gap-8">
        {/* 图片 */}
        <div>
          <div className="aspect-square rounded-xl overflow-hidden border border-ink-100"><Img src={p.images[img]} alt={p.title} w={800} h={800} eager className="w-full h-full" /></div>
          <div className="flex gap-2 mt-3">
            {p.images.map((src, i) => <button key={src} aria-label={`图片${i + 1}`} onMouseEnter={() => setImg(i)} onClick={() => setImg(i)} className={cls('w-16 h-16 rounded-lg overflow-hidden border-2 transition', i === img ? 'border-brand-500' : 'border-transparent hover:border-ink-300')}><Img src={src.replace('/800/800', '/120/120')} alt="" w={64} h={64} className="w-full h-full" /></button>)}
          </div>
          <div className="flex items-center gap-5 mt-4 text-sm text-ink-500">
            <button onClick={() => { toggleFavorite(p.id); toast(fav ? '已取消收藏' : '收藏成功') }} className={cls('flex items-center gap-1 hover:text-brand-500', fav && 'text-brand-500')}><Heart className={cls('w-4 h-4', fav && 'fill-brand-500')} />{fav ? '已收藏' : '收藏'}（{compact(p.favorites + (fav ? 1 : 0))}）</button>
            <button onClick={() => { navigator.clipboard?.writeText(location.href); toast('链接已复制') }} className="flex items-center gap-1 hover:text-brand-500"><Share2 className="w-4 h-4" />分享</button>
          </div>
        </div>

        {/* 信息 */}
        <div className="min-w-0">
          <h1 className="text-lg font-semibold text-ink-900 leading-7">{shop.type === 'tmall' && <span className="tag bg-brand-500 text-white mr-1.5 align-middle">天猫</span>}{p.title}</h1>
          {p.subtitle && <div className="text-brand-500 text-sm mt-1">{p.subtitle}</div>}
          <div className="mt-4 rounded-xl bg-gradient-to-r from-brand-50 to-amber-50 border border-brand-100 p-4">
            <div className="flex items-baseline gap-3">
              <span className="text-ink-500 text-sm w-14">促销价</span>
              <span className="price text-sm">¥</span><span className="price text-4xl">{money(price)}</span>
              {p.originalPrice && <span className="text-ink-400 line-through text-sm font-num">¥{money(p.originalPrice)}</span>}
              {p.tags[0] && <span className="tag bg-brand-500 text-white ml-2">{p.tags[0]}</span>}
            </div>
            <div className="flex items-center gap-3 mt-3 text-sm"><span className="text-ink-500 w-14">优惠</span><div className="flex gap-2 flex-wrap">{shopCoupons.map(c => { const got = myCoupons.some(m => m.couponId === c.id); return <button key={c.id} onClick={() => { claimCoupon(c.id); toast('领取成功') }} className={cls('tag-red h-6 px-2', got && 'opacity-60')}>{c.type === 'discount' ? `${c.value * 10}折券` : c.type === 'cash' ? `无门槛减${c.value}` : `满${c.threshold}减${c.value}`}{got ? ' 已领' : ' 领取'}</button> })}</div></div>
            <div className="flex items-center gap-3 mt-2 text-sm"><span className="text-ink-500 w-14">服务</span><div className="flex gap-3 text-ink-700 text-xs"><span className="flex items-center gap-1"><ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />正品保障</span><span className="flex items-center gap-1"><ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />7天无理由</span><span className="flex items-center gap-1"><Truck className="w-3.5 h-3.5 text-emerald-500" />{p.freeShipping ? '包邮' : '运费 ¥10'}</span><span className="flex items-center gap-1"><ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />退货宝</span></div></div>
          </div>
          <div className="mt-4 text-sm flex items-center gap-3"><span className="text-ink-500 w-14">配送至</span><span className="flex items-center gap-1 text-ink-800"><MapPin className="w-4 h-4 text-ink-400" />浙江 杭州 余杭区 <span className="text-ink-400 ml-2">{shop.address} 发货 · 现货，付款后48小时内发货</span></span></div>
          <div className="mt-2 text-sm flex items-center gap-3"><span className="text-ink-500 w-14">销量</span><span className="text-ink-800">{compact(p.sales)} 件</span><span className="text-ink-300">|</span><span className="text-ink-500">累计评价 {p.reviewCount}</span><span className="text-ink-300">|</span><span className="text-ink-500">{compact(p.views)} 次浏览</span></div>
          {p.attrs.map(a => (
            <div key={a.name} className="mt-4 text-sm flex items-start gap-3"><span className="text-ink-500 w-14 pt-1.5 shrink-0">{a.name}</span>
              <div className="flex flex-wrap gap-2">
                {a.values.map(v => {
                  const possible = p.skus.some(s => s.attrs[a.name] === v && s.stock > 0 && Object.entries(sel).every(([k, sv]) => k === a.name || s.attrs[k] === sv))
                  return <button key={v} disabled={!possible} onClick={() => setSel(s => ({ ...s, [a.name]: s[a.name] === v ? '' : v }))} className={cls('px-3 h-8 rounded-lg border text-[13px] transition', sel[a.name] === v ? 'border-brand-500 text-brand-500 bg-brand-50' : 'border-ink-200 hover:border-brand-400', !possible && 'opacity-40 line-through cursor-not-allowed')}>{v}</button>
                })}
              </div>
            </div>
          ))}
          <div className="mt-4 text-sm flex items-center gap-3"><span className="text-ink-500 w-14">数量</span>
            <div className="flex items-center border border-ink-200 rounded-lg overflow-hidden"><button aria-label="减少" onClick={() => setQty(q => Math.max(1, q - 1))} className="w-8 h-8 hover:bg-ink-50 flex items-center justify-center"><Minus className="w-3.5 h-3.5" /></button><input aria-label="数量" value={qty} onChange={e => setQty(Math.max(1, Number(e.target.value) || 1))} className="w-12 h-8 text-center outline-none text-sm font-num" /><button aria-label="增加" onClick={() => setQty(q => q + 1)} className="w-8 h-8 hover:bg-ink-50 flex items-center justify-center"><Plus className="w-3.5 h-3.5" /></button></div>
            <span className="text-ink-400 text-xs">库存 {sku ? sku.stock : p.stock} 件</span>
          </div>
          <div className="mt-6 flex gap-3">
            <button onClick={buyNow} className="btn-lg btn bg-gradient-to-r from-amber-400 to-brand-400 text-white font-semibold px-10 hover:opacity-90">立即购买</button>
            <button onClick={addCart} className="btn-primary btn-lg px-10">加入购物车</button>
          </div>
        </div>

        {/* 店铺卡 */}
        <aside className="border-l border-ink-100 pl-6">
          <div className="flex items-center gap-3"><Avatar src={shop.logo} name={shop.name} size={44} /><div className="min-w-0"><div className="font-semibold truncate">{shop.name}</div><div className="text-xs text-ink-400">{shop.type === 'tmall' ? '天猫旗舰店' : '淘宝店铺'} · 粉丝 {compact(shop.fans)}</div></div></div>
          <div className="mt-4 space-y-1.5 text-xs">
            {[['宝贝描述', shop.score.desc], ['卖家服务', shop.score.service], ['物流服务', shop.score.logistics]].map(([l, v]) => <div key={l as string} className="flex items-center justify-between"><span className="text-ink-500">{l}</span><span className="font-num text-ink-800">{(v as number).toFixed(1)} <span className="text-brand-500">高</span></span></div>)}
          </div>
          <div className="mt-4 flex gap-2"><Link to={`/shop/${shop.id}`} className="btn-outline btn-sm flex-1"><Store className="w-3.5 h-3.5" />进店逛逛</Link><button onClick={() => { toggleFollowShop(shop.id); toast(followed ? '已取消关注' : '关注成功') }} className={cls('btn-sm flex-1', followed ? 'btn-ghost' : 'btn-primary')}>{followed ? '已关注' : '+ 关注'}</button></div>
          <button onClick={() => toast('已为您接通客服，请稍候')} className="btn-ghost btn-sm w-full mt-2 text-qn-600"><MessageCircle className="w-3.5 h-3.5" />联系客服</button>
          <div className="mt-5 text-sm font-semibold">店铺推荐</div>
          <div className="grid grid-cols-2 gap-2 mt-2">
            {shopProducts.slice(0, 4).map(x => <Link key={x.id} to={`/item/${x.id}`} className="group"><div className="aspect-square rounded-lg overflow-hidden"><Img src={x.images[0]} alt={x.title} w={100} h={100} className="w-full h-full group-hover:scale-105 transition-transform" /></div><div className="price text-xs mt-1">¥{money(x.price, 0)}</div></Link>)}
          </div>
        </aside>
      </div>

      {/* 详情 / 评价 */}
      <div className="grid grid-cols-[210px_1fr] gap-4 mt-4">
        <div className="card p-4 self-start">
          <div className="font-semibold mb-3 text-sm">看了又看</div>
          <div className="space-y-3">{similar.map(x => <Link key={x.id} to={`/item/${x.id}`} className="block group"><div className="aspect-square rounded-lg overflow-hidden"><Img src={x.images[0]} alt={x.title} w={180} h={180} className="w-full h-full group-hover:scale-105 transition-transform" /></div><div className="text-xs line-clamp-2 mt-1 text-ink-700">{x.title}</div><div className="price text-sm">¥{money(x.price)}</div></Link>)}</div>
        </div>
        <div className="card">
          <div className="px-5"><Tabs items={[{ key: 'detail', label: '宝贝详情' }, { key: 'reviews', label: '累计评价', count: prodReviews.length }, { key: 'params', label: '规格参数' }]} value={tab} onChange={setTab} size="lg" /></div>
          {tab === 'detail' && (
            <div className="p-6">
              <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm text-ink-600 mb-6">
                <div>品牌：{shop.name.replace(/旗舰店|官方|专营店/g, '')}</div><div>类目：{catName}</div>
                {p.attrs.map(a => <div key={a.name}>{a.name}：{a.values.join(' / ')}</div>)}
                <div>上架时间：{fmtDate(p.createdAt, false)}</div><div>商品编号：{p.id.toUpperCase()}2026</div>
              </div>
              <div className="prose text-sm text-ink-700 max-w-none" dangerouslySetInnerHTML={{ __html: p.detail }} />
              <div className="space-y-3 mt-4">{p.images.map(src => <Img key={src} src={src} alt="详情图" w={800} h={800} className="w-full rounded-xl" />)}</div>
            </div>
          )}
          {tab === 'reviews' && (
            <div className="p-6">
              <div className="flex items-center gap-8 mb-6 bg-ink-50 rounded-xl p-4">
                <div className="text-center"><div className="text-4xl font-num font-bold text-brand-500">{p.rating.toFixed(1)}</div><div className="text-xs text-ink-500 mt-1">综合评分</div></div>
                <div className="flex-1 space-y-1">{[5, 4, 3].map(n => { const c = prodReviews.filter(r => r.rating === n).length; return <div key={n} className="flex items-center gap-2 text-xs"><span className="w-8">{n}星</span><div className="flex-1 h-2 bg-ink-200 rounded-full overflow-hidden"><div className="h-full bg-brand-500" style={{ width: `${prodReviews.length ? (c / prodReviews.length) * 100 : 0}%` }} /></div><span className="w-8 text-ink-400">{c}</span></div> })}</div>
                <div className="flex gap-2 flex-wrap max-w-xs">{['质量很好', '物流快', '性价比高', '包装精美', '客服态度好'].map(t => <span key={t} className="tag-red h-6 px-2">{t}</span>)}</div>
              </div>
              {prodReviews.length === 0 && <Empty text="暂无评价" icon={<Star className="w-6 h-6" />} />}
              <div className="divide-y divide-ink-100">
                {prodReviews.map(r => { const u = users.find(x => x.id === r.userId); return (
                  <div key={r.id} className="py-5 flex gap-4">
                    <Avatar src={u?.avatar} name={u?.nickname ?? ''} size={40} />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 text-xs text-ink-500"><span className="text-ink-800">{u?.nickname.slice(0, 1)}***{u?.nickname.slice(-1)}</span>{u?.vip && <span className="tag-gold">88VIP</span>}<Rating value={r.rating} /><span className="ml-auto">{fmtDate(r.createdAt, false)}</span></div>
                      <div className="text-sm text-ink-800 mt-2">{r.content}</div>
                      {r.images.length > 0 && <div className="flex gap-2 mt-2">{r.images.map(s => <Img key={s} src={s} alt="买家秀" w={80} h={80} className="w-20 h-20 rounded-lg" />)}</div>}
                      {r.skuText && <div className="text-xs text-ink-400 mt-2">{r.skuText}</div>}
                      {r.reply && <div className="mt-2 text-xs bg-ink-50 rounded-lg p-2.5 text-ink-600"><span className="text-brand-500">掌柜回复：</span>{r.reply}</div>}
                    </div>
                  </div>
                ) })}
              </div>
            </div>
          )}
          {tab === 'params' && (
            <div className="p-6"><table className="w-full text-sm"><tbody>{[['商品名称', p.title], ['类目', catName], ...p.attrs.map(a => [a.name, a.values.join('、')]), ['库存', `${p.stock} 件`], ['是否包邮', p.freeShipping ? '是' : '否'], ['店铺', shop.name], ['发货地', shop.address]].map(([k, v]) => <tr key={k} className="border-b border-ink-100"><td className="py-2.5 w-40 text-ink-500 bg-ink-50 px-3">{k}</td><td className="py-2.5 px-3 text-ink-800">{v}</td></tr>)}</tbody></table></div>
          )}
        </div>
      </div>

      <div className="mt-6"><div className="font-semibold text-lg mb-3">猜你喜欢</div><div className="grid grid-cols-5 gap-3">{products.filter(x => x.id !== p.id && x.status === 'on').slice(0, 10).map(x => <ProductCard key={x.id} p={x} />)}</div></div>
    </div>
  )
}
