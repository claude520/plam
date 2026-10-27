import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight, Zap, Ticket, Tv, Gift, Flame, Store, Grid3X3, RefreshCw, Sparkles, Heart, ShoppingBag, Clock } from 'lucide-react'
import { useDB } from '@/store/db'
import { useCurrentUser } from '@/lib/hooks'
import { Logo, SearchBar } from '@/layouts/BuyerLayout'
import { ProductCard } from '@/components/ProductCard'
import { Img, Avatar } from '@/components/ui'
import { money, cls } from '@/lib/format'

function Countdown() {
  const [t, setT] = useState(44 * 3600 + 27 * 60 + 19)
  useEffect(() => { const i = setInterval(() => setT(x => (x > 0 ? x - 1 : 0)), 1000); return () => clearInterval(i) }, [])
  const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = t % 60
  const B = ({ v }: { v: number }) => <span className="inline-block bg-ink-900 text-white rounded px-1 font-num min-w-[24px] text-center">{String(v).padStart(2, '0')}</span>
  return <span className="text-sm text-white font-medium hidden lg:flex items-center gap-1">最后2天倒计时 <B v={h} /> 时 <B v={m} /> 分 <B v={s} /> 秒</span>
}

export default function Home() {
  const user = useCurrentUser()
  const { products, categories, banners, shops, cart, footprints, favorites, orders, campaigns } = useDB()
  const heroBanners = banners.filter(b => b.position === 'home-hero' && b.status === 'on').sort((a, b) => a.sort - b.sort)
  const [slide, setSlide] = useState(0)
  useEffect(() => { const i = setInterval(() => setSlide(s => (s + 1) % Math.max(1, heroBanners.length)), 4000); return () => clearInterval(i) }, [heroBanners.length])
  const topCats = categories.filter(c => !c.parentId).sort((a, b) => a.sort - b.sort)
  const [hoverCat, setHoverCat] = useState<string | null>(null)
  const onSale = useMemo(() => products.filter(p => p.status === 'on'), [products])
  const [feedTab, setFeedTab] = useState('猜你喜欢')
  const feedTabs = ['猜你喜欢', '运动户外', '馋嘴零食', '潮电数码', '服饰时尚', '家装建材', '办公文具', '健康保健']
  const feedMap: Record<string, string> = { 运动户外: 'c6', 馋嘴零食: 'c8', 潮电数码: 'c2', 服饰时尚: 'c5', 家装建材: 'c4', 办公文具: 'c1', 健康保健: 'c10' }
  const [seedShift, setSeedShift] = useState(0)
  const feed = useMemo(() => {
    const base = feedTab === '猜你喜欢' ? onSale : onSale.filter(p => p.categoryId.startsWith(feedMap[feedTab] + '-'))
    const arr = [...base]
    for (let i = arr.length - 1; i > 0; i--) { const j = (i * 7 + seedShift * 13) % (i + 1); [arr[i], arr[j]] = [arr[j], arr[i]] }
    return arr.slice(0, 30)
  }, [onSale, feedTab, seedShift])
  const pick = (ids: number[]) => ids.map(i => onSale[i % onSale.length]).filter(Boolean)
  const pendingCount = orders.filter(o => o.userId === user?.id && o.status === 'unpaid').length
  const running = campaigns.filter(c => c.status === 'running')

  const Channel = ({ icon, label, to, color }: { icon: React.ReactNode; label: string; to: string; color: string }) => (
    <Link to={to} className="flex items-center gap-1.5 text-[15px] text-ink-800 hover:text-brand-500 font-medium"><span className={cls('w-6 h-6 rounded-md flex items-center justify-center text-white', color)}>{icon}</span>{label}</Link>
  )
  const Promo = ({ title, tag, items, to, color }: { title: string; tag: string; items: typeof onSale; to: string; color: string }) => (
    <div className="card p-3 flex flex-col">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5"><span className={cls('tag text-white', color)}>{tag}</span><span className="font-semibold text-[15px]">{title}</span></div>
        <Link to={to} aria-label="查看更多" className="text-ink-400 hover:text-brand-500"><ChevronRight className="w-4 h-4" /></Link>
      </div>
      <div className="grid grid-cols-2 gap-2 flex-1">
        {items.slice(0, 2).map(p => (
          <Link key={p.id} to={`/item/${p.id}`} className="group">
            <div className="aspect-square rounded-lg overflow-hidden"><Img src={p.images[0]} alt={p.title} w={200} h={200} eager className="w-full h-full group-hover:scale-105 transition-transform" /></div>
            <div className="mt-1.5"><span className="inline-block bg-brand-500 text-white text-xs font-num font-semibold rounded px-1.5 py-0.5">¥{money(p.price, 0)}</span></div>
          </Link>
        ))}
      </div>
    </div>
  )

  return (
    <div className="bg-[#f5f5f7]">
      {/* 顶部活动条 */}
      <div className="bg-gradient-to-r from-[#ff3b1f] via-[#ff5a2e] to-[#ff7a3d]">
        <div className="container-x h-14 flex items-center justify-between text-white">
          <div className="flex items-center gap-4">
            <span className="text-2xl font-black italic tracking-wider drop-shadow">双11开门红</span>
            <span className="text-lg font-semibold">叠券低至7.2折起</span>
            <Countdown />
          </div>
          <Link to="/search?q=双11" className="bg-white text-brand-600 font-semibold rounded-full px-5 py-1.5 text-sm hover:bg-brand-50 transition-colors">立即抢购</Link>
        </div>
      </div>

      {/* 头部 */}
      <header className="bg-white">
        <div className="container-x py-4 flex items-center gap-10">
          <Logo />
          <SearchBar />
          <div className="ml-auto flex items-center gap-3 bg-gradient-to-r from-amber-50 to-brand-50 rounded-xl px-4 py-2 border border-brand-100">
            <div className="text-sm"><div className="font-semibold text-ink-900">天天领红包 消费券</div><div className="text-brand-500 text-xs">开启 Plam 淘金 · 每日签到领红包</div></div>
            <Gift className="w-8 h-8 text-brand-500" />
          </div>
        </div>
        <div className="container-x pb-3 flex items-center gap-8">
          <Channel icon={<Tv className="w-3.5 h-3.5" />} label="Plam 直播" to="/search?q=直播" color="bg-brand-500" />
          <Channel icon={<Store className="w-3.5 h-3.5" />} label="企业采购" to="/search?q=采购" color="bg-qn-500" />
          <Channel icon={<Zap className="w-3.5 h-3.5" />} label="司法拍卖" to="/search?q=拍卖" color="bg-rose-500" />
          <Channel icon={<ShoppingBag className="w-3.5 h-3.5" />} label="Plam 超市" to="/search?q=超市" color="bg-red-500" />
          <Channel icon={<Gift className="w-3.5 h-3.5" />} label="国家补贴" to="/search?q=国补" color="bg-emerald-700" />
          <Channel icon={<Ticket className="w-3.5 h-3.5" />} label="领券中心" to="/my/coupons" color="bg-amber-500" />
          <Channel icon={<Flame className="w-3.5 h-3.5" />} label="双11开门红" to="/search?q=双11" color="bg-brand-500" />
          <Channel icon={<Grid3X3 className="w-3.5 h-3.5" />} label="全部频道" to="/search" color="bg-ink-500" />
        </div>
      </header>

      <div className="container-x pt-3">
        {/* 首屏三栏 */}
        <div className="grid grid-cols-[190px_1fr_300px] gap-3 items-stretch">
          {/* 类目 */}
          <div className="card py-2 relative" onMouseLeave={() => setHoverCat(null)}>
            <div className="px-4 py-1.5 text-brand-500 font-semibold text-sm flex items-center gap-1"><Flame className="w-4 h-4" />双11开门红 · 爆款8.5折起</div>
            {topCats.map(c => {
              const subs = categories.filter(x => x.parentId === c.id)
              return (
                <div key={c.id} onMouseEnter={() => setHoverCat(c.id)} className={cls('px-4 py-[7px] text-[13px] flex items-center gap-1 cursor-pointer', hoverCat === c.id ? 'bg-brand-50 text-brand-500' : 'text-ink-700')}>
                  {subs.slice(0, 2).map((s, i) => <span key={s.id}>{i > 0 && <span className="text-ink-400 mx-1">/</span>}<Link to={`/search?cat=${s.id}`} className="hover:text-brand-500">{s.name}</Link></span>)}
                </div>
              )
            })}
            {hoverCat && (
              <div className="absolute left-full top-0 bottom-0 w-[560px] bg-white shadow-pop rounded-r-xl2 z-30 p-6 animate-fadeUp">
                <div className="font-semibold text-ink-900 mb-3 flex items-center gap-2">{topCats.find(c => c.id === hoverCat)?.name}<ChevronRight className="w-4 h-4 text-ink-400" /></div>
                <div className="grid grid-cols-3 gap-x-6 gap-y-3">
                  {categories.filter(x => x.parentId === hoverCat).map(s => (
                    <Link key={s.id} to={`/search?cat=${s.id}`} className="flex items-center gap-3 group">
                      <div className="w-12 h-12 rounded-lg overflow-hidden"><Img src={onSale.find(p => p.categoryId === s.id)?.images[0] ?? `https://picsum.photos/seed/${s.id}/100/100`} alt={s.name} w={48} h={48} className="w-full h-full" /></div>
                      <span className="text-sm text-ink-700 group-hover:text-brand-500">{s.name}</span>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* 中部 */}
          <div className="grid grid-rows-[auto_1fr] gap-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="relative rounded-xl2 overflow-hidden h-[250px] shadow-card">
                {heroBanners.map((b, i) => (
                  <Link key={b.id} to={b.link} className={cls('absolute inset-0 p-7 flex flex-col justify-center text-white transition-opacity duration-700', i === slide ? 'opacity-100' : 'opacity-0 pointer-events-none')} style={{ background: b.gradient }}>
                    <div className="text-xs font-semibold tracking-widest opacity-80 mb-2">双11 · 开门红</div>
                    <div className="text-4xl font-black mb-2 drop-shadow">{b.title}</div>
                    <div className="text-lg font-medium opacity-95">{b.subtitle}</div>
                    <div className="mt-6"><span className="inline-block bg-white/95 text-ink-900 rounded-full px-5 py-2 text-sm font-semibold">立即抢购 →</span></div>
                    <Sparkles className="absolute right-6 bottom-6 w-24 h-24 opacity-20" />
                  </Link>
                ))}
                <div className="absolute left-7 bottom-5 flex gap-1.5 z-10">
                  {heroBanners.map((b, i) => <button key={b.id} aria-label={`第${i + 1}张`} onClick={() => setSlide(i)} className="h-6 min-w-[24px] flex items-center justify-center"><span className={cls('h-1.5 rounded-full transition-all', i === slide ? 'w-5 bg-white' : 'w-1.5 bg-white/50')} /></button>)}
                </div>
              </div>
              <div className="rounded-xl2 overflow-hidden h-[250px] shadow-card bg-gradient-to-br from-[#ff4d4d] to-[#ff1f6b] p-4 text-white relative">
                <div className="flex items-center gap-2 mb-3"><span className="text-xl font-black italic">双11</span><span className="font-semibold text-lg">百亿补贴 · 买贵必赔</span></div>
                <div className="grid grid-cols-2 gap-3">
                  {pick([3, 4]).map(p => (
                    <Link key={p.id} to={`/item/${p.id}`} className="bg-white rounded-xl p-2 text-ink-900 group">
                      <div className="aspect-square rounded-lg overflow-hidden"><Img src={p.images[0]} alt={p.title} w={200} h={200} eager className="w-full h-full group-hover:scale-105 transition-transform" /></div>
                      <div className="mt-1.5 flex items-center justify-between"><span className="bg-brand-500 text-white text-xs font-num font-semibold rounded px-1.5 py-0.5">¥{money(p.price, 0)}</span><span className="text-[10px] text-ink-400">补贴价</span></div>
                    </Link>
                  ))}
                </div>
              </div>
            </div>
            <div className="grid grid-cols-4 gap-3">
              <Promo title="领券中心" tag="双11" items={pick([8, 12])} to="/my/coupons" color="bg-brand-500" />
              <Promo title="Plam 直播" tag="双11" items={pick([14, 20])} to="/search?q=直播" color="bg-rose-600" />
              <Promo title="国家补贴" tag="双11" items={pick([0, 1])} to="/search?q=国补" color="bg-emerald-700" />
              <Promo title="限时秒杀" tag="20:00" items={pick([30, 31])} to="/search?q=秒杀" color="bg-amber-700" />
            </div>
          </div>

          {/* 右侧用户卡 */}
          <div className="flex flex-col gap-3">
            <div className="card p-5 flex-1">
              {user ? (
                <>
                  <div className="flex items-center gap-3">
                    <Avatar src={user.avatar} name={user.nickname} size={56} />
                    <div><div className="font-semibold text-lg">{user.nickname}</div><div className="text-xs text-ink-400 flex items-center gap-2">{user.vip && <span className="tag-gold">88VIP</span>}会员等级 LV{user.level}</div></div>
                  </div>
                  <div className="grid grid-cols-4 gap-2 mt-5 text-center text-xs text-ink-600">
                    {[['待付款', pendingCount, '/my/orders?tab=unpaid', <ShoppingBag className="w-5 h-5" />], ['收藏夹', favorites.length, '/my/favorites', <Heart className="w-5 h-5" />], ['购物车', cart.length, '/cart', <ShoppingBag className="w-5 h-5" />], ['足迹', footprints.length, '/my/footprints', <Clock className="w-5 h-5" />]].map(([l, n, to, ic]) => (
                      <Link key={l as string} to={to as string} className="flex flex-col items-center gap-1 hover:text-brand-500 relative"><span className="w-10 h-10 rounded-full bg-ink-50 flex items-center justify-center text-ink-600">{ic as React.ReactNode}</span>{l as string}{(n as number) > 0 && <span className="absolute top-0 right-2 min-w-[16px] h-4 px-1 rounded-full bg-brand-500 text-white text-[10px] leading-4">{n as number}</span>}</Link>
                    ))}
                  </div>
                  <div className="mt-5 rounded-xl bg-gradient-to-r from-amber-50 to-brand-50 border border-amber-100 p-3 flex items-center justify-between">
                    <div><div className="text-sm font-semibold text-ink-900">淘金币购物抵钱用</div><div className="text-xs text-ink-500">{user.coins} 金币可抵 {money(user.coins / 100)} 元</div></div>
                    <Link to="/my/coupons" className="btn-primary btn-sm">立即领取</Link>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-3"><div className="w-14 h-14 rounded-full bg-gradient-to-br from-amber-200 to-brand-200" /><div><div className="font-semibold text-lg">晚上好</div><div className="text-xs text-ink-400">注册 · 开店</div></div></div>
                  <div className="mt-4 text-center"><div className="font-semibold">登录 Plam 后更多精彩</div><div className="text-xs text-ink-400 mt-1">嘿！更懂你的推荐，更便捷的搜索</div></div>
                  <Link to="/login" className="btn-primary btn-lg w-full mt-4">立即登录</Link>
                  <div className="grid grid-cols-4 gap-2 mt-5 text-center text-xs text-ink-600">{['已买到', '收藏夹', '买过的店', '足迹'].map(l => <div key={l} className="flex flex-col items-center gap-1"><span className="w-10 h-10 rounded-full bg-ink-50" />{l}</div>)}</div>
                </>
              )}
            </div>
            <div className="card p-4 bg-gradient-to-br from-qn-500 to-qn-700 text-white">
              <div className="flex items-center justify-between"><div className="font-semibold">正在进行的活动</div><Link to="/search?q=活动" className="text-xs opacity-80">全部 ›</Link></div>
              <ul className="mt-2 space-y-1.5 text-sm">{running.map(c => <li key={c.id} className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-white/80" />{c.name}</li>)}</ul>
            </div>
          </div>
        </div>

        {/* 品牌店铺横条 */}
        <div className="card mt-4 p-4 flex items-center gap-6 overflow-x-auto no-scrollbar">
          <div className="shrink-0 font-semibold text-ink-900 flex items-center gap-1"><Store className="w-4 h-4 text-brand-500" />品牌旗舰</div>
          {shops.filter(s => s.status === 'open').map(s => (
            <Link key={s.id} to={`/shop/${s.id}`} className="shrink-0 flex items-center gap-2 text-sm text-ink-700 hover:text-brand-500"><Avatar src={s.logo} name="" size={28} />{s.name}</Link>
          ))}
        </div>

        {/* 信息流 */}
        <div className="sticky top-0 z-30 bg-[#f5f5f7] pt-4 pb-3">
          <div className="card px-3 py-2 flex items-center gap-2">
            {feedTabs.map(t => (
              <button key={t} onClick={() => setFeedTab(t)} className={cls('px-4 h-8 rounded-full text-sm font-medium transition-colors', feedTab === t ? 'bg-brand-500 text-white' : 'text-ink-700 hover:bg-ink-100')}>{t === '猜你喜欢' ? '♥ 猜你喜欢' : t}</button>
            ))}
            <button onClick={() => setSeedShift(s => s + 1)} className="ml-auto btn-ghost btn-sm text-ink-500" aria-label="换一批"><RefreshCw className="w-3.5 h-3.5" />换一批</button>
          </div>
        </div>
        <div className="grid grid-cols-5 gap-3 pb-6">
          {feed.map((p, i) => <ProductCard key={p.id} p={p} eager={i < 5} />)}
        </div>
        <div className="text-center text-ink-400 text-sm pb-4">— 已经到底啦，去搜索看看更多宝贝 —</div>
      </div>
    </div>
  )
}
