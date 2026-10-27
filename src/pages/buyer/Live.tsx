import { useEffect, useMemo, useState } from 'react'
import { Link, NavLink, useNavigate, useSearchParams } from 'react-router-dom'
import { ChevronRight, Flame, Play, RefreshCw, Search } from 'lucide-react'
import { useDB } from '@/store/db'
import { useCurrentUser } from '@/lib/hooks'
import { Avatar, Img } from '@/components/ui'
import { DemoStage, LiveBadge, RealStage } from '@/components/LiveStage'
import type { LiveRoom } from '@/data/types'
import { cls, compact, fmtDate, money } from '@/lib/format'

export const LIVE_CATS: { label: string; cat?: string }[] = [
  { label: '精选' }, { label: '服饰时尚', cat: 'c5' }, { label: '珠宝饰品', cat: 'c7' }, { label: '美妆', cat: 'c10' }, { label: '手机数码', cat: 'c2' }, { label: '家电', cat: 'c2' },
  { label: '食品生鲜', cat: 'c8' }, { label: '家装家居', cat: 'c4' }, { label: '家清个护', cat: 'c10' }, { label: '运动户外', cat: 'c6' }, { label: '母婴亲子', cat: 'c9' }, { label: '宠物', cat: 'c9' }, { label: '健康', cat: 'c8' }, { label: '更多推荐', cat: 'c1' },
]

export function LiveHeader() {
  const nav = useNavigate()
  const [q, setQ] = useState('')
  return (
    <header className="bg-white">
      <div className="container-x h-14 md:h-[76px] flex items-center gap-4 md:gap-10">
        <Link to="/live" className="flex items-center gap-2 select-none shrink-0" aria-label="Plam 直播">
          <span className="w-8 h-8 rounded-full bg-brand-500 flex items-center justify-center text-white"><Play className="w-4 h-4 fill-current" /></span>
          <span className="text-xl md:text-[26px] font-black text-brand-500 tracking-tight">Plam直播</span>
          <span className="hidden sm:inline text-[10px] font-semibold text-brand-600 border border-brand-300 bg-brand-50 rounded px-1.5 py-0.5">PC大屏版</span>
        </Link>
        <nav className="flex items-center gap-5 md:gap-8 text-base md:text-lg font-medium">
          <NavLink to="/live" end className={({ isActive }) => cls('relative pb-1', isActive ? 'text-brand-500 after:absolute after:left-0 after:right-0 after:-bottom-0.5 after:h-[3px] after:rounded-full after:bg-brand-500' : 'text-ink-800 hover:text-brand-500')}>发现</NavLink>
          <NavLink to="/live/follow" className={({ isActive }) => cls('relative pb-1', isActive ? 'text-brand-500 after:absolute after:left-0 after:right-0 after:-bottom-0.5 after:h-[3px] after:rounded-full after:bg-brand-500' : 'text-ink-800 hover:text-brand-500')}>关注</NavLink>
        </nav>
        <form onSubmit={e => { e.preventDefault(); nav(`/live?q=${encodeURIComponent(q)}`) }} className="ml-auto hidden md:flex items-center border border-ink-200 rounded-lg overflow-hidden w-[360px] h-11">
          <input value={q} onChange={e => setQ(e.target.value)} aria-label="搜索直播" placeholder="搜索新改版，快来试试吧！" className="flex-1 h-full px-4 text-sm outline-none" />
          <button className="h-full px-5 bg-brand-500 text-white text-sm font-medium flex items-center gap-1"><Search className="w-4 h-4 md:hidden" /><span>搜索</span></button>
        </form>
      </div>
    </header>
  )
}

export function RoomCard({ room, size = 'md' }: { room: LiveRoom; size?: 'sm' | 'md' }) {
  const shop = useDB(s => s.shops).find(x => x.id === room.shopId)
  return (
    <Link to={`/live/${room.id}`} className="group block">
      <div className={cls('relative rounded-xl overflow-hidden bg-ink-100', size === 'md' ? 'aspect-[3/4]' : 'aspect-square')}>
        <Img src={room.cover} alt={room.title} w={360} h={480} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
        {room.status === 'live' ? <LiveBadge n={room.stats.viewers} className="absolute top-2 left-2" /> : room.status === 'scheduled' ? <span className="absolute top-2 left-2 rounded-md bg-black/55 text-white text-[11px] px-1.5 py-0.5">预告 {fmtDate(room.plannedAt).slice(5, 16)}</span> : <span className="absolute top-2 left-2 rounded-md bg-black/55 text-white text-[11px] px-1.5 py-0.5">回放</span>}
        <div className="absolute inset-x-0 bottom-0 p-2.5 bg-gradient-to-t from-black/70 to-transparent text-white">
          <div className="text-sm font-medium line-clamp-1">{room.title}</div>
          <div className="flex items-center gap-1.5 mt-1 text-[11px] opacity-90"><Avatar src={shop?.logo} name="" size={16} /><span className="truncate">{shop?.name}</span></div>
        </div>
      </div>
    </Link>
  )
}

function Hero({ rooms }: { rooms: LiveRoom[] }) {
  const [i, setI] = useState(0)
  const { products, shops } = useDB()
  const room = rooms[i]
  useEffect(() => { setI(0) }, [rooms.length])
  if (!room) return null
  const ps = products.filter(p => room.productIds.includes(p.id))
  const caption = <Link to={`/live/${room.id}`} className="absolute inset-0 flex items-center justify-center group"><span className="opacity-0 group-hover:opacity-100 transition flex items-center gap-1.5 rounded-full bg-brand-500 text-white text-sm font-medium px-4 py-2 shadow-pop"><Play className="w-4 h-4 fill-current" />进入直播间<ChevronRight className="w-4 h-4" /></span></Link>
  return (
    <div className="rounded-xl2 overflow-hidden bg-[#1b1b1f] grid grid-cols-[1fr_200px] max-md:!grid-cols-1 h-[400px] max-md:h-auto">
      <div className="relative max-md:aspect-video">
        {room.demo ? <DemoStage key={room.id} products={ps} cover={room.cover} className="absolute inset-0" caption={caption} /> : <RealStage key={room.id} room={room} preview className="absolute inset-0" caption={caption} />}
      </div>
      <div className="flex md:flex-col overflow-x-auto no-scrollbar md:overflow-visible text-white/85">
        {rooms.slice(0, 5).map((r, k) => <button key={r.id} onMouseEnter={() => setI(k)} onClick={() => setI(k)} className={cls('text-left px-4 py-3 md:py-4 shrink-0 md:shrink min-w-[180px] md:min-w-0 flex-1 border-l-[3px] transition', k === i ? 'border-brand-500 bg-white/10 text-white' : 'border-transparent hover:bg-white/5')}>
          <div className="text-sm font-medium line-clamp-1">{r.title}</div>
          {k === i && <div className="text-xs text-white/60 mt-0.5">{r.status === 'live' ? `${compact(r.stats.viewers)}观看` : `预告 ${fmtDate(r.plannedAt).slice(5, 16)}`}</div>}
          <div className="text-xs text-white/60 mt-1 flex items-center gap-1 truncate"><Avatar src={shops.find(s => s.id === r.shopId)?.logo} name="" size={14} />{shops.find(s => s.id === r.shopId)?.name}</div>
        </button>)}
      </div>
    </div>
  )
}

export default function LiveHall({ follow }: { follow?: boolean }) {
  const [sp] = useSearchParams()
  const { lives, shops, products, followedShops } = useDB()
  const user = useCurrentUser()
  const [cat, setCat] = useState(0)
  const [seed, setSeed] = useState(0)
  const q = (sp.get('q') ?? '').trim()
  useEffect(() => { document.title = `${follow ? '关注' : '发现'} - Plam直播` }, [follow])
  const rooms = useMemo(() => {
    let list = lives.filter(l => l.status !== 'ended' && l.visibility === 'all')
    if (follow) list = list.filter(l => followedShops.includes(l.shopId))
    if (q) list = list.filter(l => l.title.includes(q) || shops.find(s => s.id === l.shopId)?.name.includes(q))
    const c = LIVE_CATS[cat].cat
    if (c) list = list.filter(l => l.categoryId === c)
    return [...list].sort((a, b) => (a.status === 'live' ? 0 : 1) - (b.status === 'live' ? 0 : 1) || b.stats.viewers - a.stats.viewers)
  }, [lives, follow, followedShops, q, cat, shops])
  const live = rooms.filter(r => r.status === 'live')
  const myFollowRooms = lives.filter(l => followedShops.includes(l.shopId) && l.status === 'live').slice(0, 4)
  const deals = useMemo(() => lives.filter(l => l.status === 'live').flatMap(l => Object.entries(l.livePrices).map(([pid, price]) => ({ p: products.find(p => p.id === pid)!, price, room: l }))).filter(x => x.p).sort((a, b) => (a.p.price - a.price) / a.p.price < (b.p.price - b.price) / b.p.price ? 1 : -1).slice(0, 4), [lives, products])
  const ranking = useMemo(() => [...shops].map(s => ({ s, n: lives.filter(l => l.shopId === s.id).reduce((a, l) => a + l.stats.views, 0) })).sort((a, b) => b.n - a.n), [shops, lives])
  const [rankTab, setRankTab] = useState(0)
  const guess = useMemo(() => { const arr = [...rooms]; for (let i = arr.length - 1; i > 0; i--) { const j = (i * 7 + seed * 13) % (i + 1); [arr[i], arr[j]] = [arr[j], arr[i]] } return arr }, [rooms, seed])

  return (
    <div className="bg-white min-h-screen pb-10 mobile-pb">
      <LiveHeader />
      <div className="container-x">
        <div className="flex items-center gap-5 md:gap-7 overflow-x-auto no-scrollbar py-3 md:py-4 text-[15px] md:text-base">
          {LIVE_CATS.map((c, i) => <button key={c.label} onClick={() => setCat(i)} className={cls('shrink-0 whitespace-nowrap', i === cat ? 'text-brand-500 font-semibold' : 'text-ink-800 hover:text-brand-500')}>{c.label}</button>)}
        </div>
        {follow && !user && <div className="card p-10 text-center text-ink-500">登录后查看你关注的主播 <Link to="/login?to=/live/follow" className="link ml-2">去登录</Link></div>}
        {follow && user && rooms.length === 0 && <div className="card p-10 text-center text-ink-500">你关注的主播还没有开播，去 <Link to="/live" className="link">发现</Link> 看看吧</div>}
        {rooms.length > 0 && (
          <div className="grid grid-cols-[1fr_440px_216px] max-lg:!grid-cols-1 gap-4 items-start">
            <Hero rooms={rooms.slice(0, 5)} />
            <div className="space-y-4 keep-cols">
              <section className="card p-4">
                <Link to="/live/follow" className="flex items-center font-semibold text-base hover:text-brand-500">我的关注<ChevronRight className="w-4 h-4" /></Link>
                <div className="mt-3 grid grid-cols-4 keep-cols gap-2">
                  {(myFollowRooms.length ? myFollowRooms : live.slice(0, 4)).map(r => <Link key={r.id} to={`/live/${r.id}`} className="relative rounded-lg overflow-hidden aspect-[3/4] bg-ink-100 group"><Img src={r.cover} alt={r.title} w={200} h={260} className="w-full h-full object-cover group-hover:scale-105 transition-transform" /><span className="absolute top-1.5 left-1.5 w-4 h-4 rounded bg-brand-500 text-white flex items-center justify-center"><Play className="w-2.5 h-2.5 fill-current" /></span><span className="absolute inset-x-0 bottom-0 bg-black/55 text-white text-[11px] px-1.5 py-1 truncate">{shops.find(s => s.id === r.shopId)?.name}</span></Link>)}
                </div>
              </section>
              <section className="card p-4">
                <Link to="/search?q=直播专享" className="flex items-center font-semibold text-base hover:text-brand-500">直播超值购<ChevronRight className="w-4 h-4" /></Link>
                <div className="mt-3 grid grid-cols-4 keep-cols gap-2">
                  {deals.map(d => <Link key={d.p.id} to={`/item/${d.p.id}?live=${d.room.id}`} className="text-center group"><div className="rounded-lg overflow-hidden aspect-square bg-ink-50"><Img src={d.p.images[0]} alt={d.p.title} w={200} h={200} className="w-full h-full object-cover group-hover:scale-105 transition-transform" /></div><div className="price text-base mt-1.5">¥{money(d.price, d.price % 1 ? 2 : 0)}</div><div className="text-[11px] text-brand-500">直播专享价</div></Link>)}
                </div>
              </section>
            </div>
            <section className="card p-4 max-lg:hidden">
              <div className="flex items-center gap-4 text-base">{['种草榜', '热销榜', '内容'].map((t, i) => <button key={t} onClick={() => setRankTab(i)} className={cls(i === rankTab ? 'font-semibold text-ink-900' : 'text-ink-500')}>{t}</button>)}</div>
              <ol className="mt-3 space-y-3 max-h-[320px] overflow-auto no-scrollbar">
                {ranking.slice(0, 20).map(({ s, n }, i) => <li key={s.id} className="flex items-center gap-2.5"><span className={cls('w-4 text-sm font-num font-bold text-center', i < 3 ? 'text-brand-500' : 'text-ink-400')}>{i + 1}</span><span className="relative"><Avatar src={s.logo} name="" size={36} /><span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded bg-brand-500 text-white flex items-center justify-center"><Play className="w-2 h-2 fill-current" /></span></span><div className="min-w-0"><Link to={lives.find(l => l.shopId === s.id) ? `/live/${lives.find(l => l.shopId === s.id)!.id}` : `/shop/${s.id}`} className="text-sm text-ink-900 truncate block hover:text-brand-500">{s.name}</Link><div className="text-[11px] text-brand-500 flex items-center gap-0.5"><Flame className="w-3 h-3" />{compact(rankTab === 1 ? Math.round(n * 1.6) : rankTab === 2 ? Math.round(n / 3) : n)}</div></div></li>)}
              </ol>
            </section>
          </div>
        )}
        {rooms.length > 0 && (
          <section className="mt-8">
            <div className="flex items-center justify-between"><h2 className="text-xl md:text-2xl font-bold">猜你喜欢</h2><button onClick={() => setSeed(s => s + 1)} className="text-sm text-ink-600 flex items-center gap-1 hover:text-brand-500"><RefreshCw className="w-4 h-4" />换一换</button></div>
            <div className="mt-4 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 md:gap-4">{guess.map(r => <RoomCard key={r.id} room={r} />)}</div>
            <div className="mt-8 flex items-center gap-5 flex-wrap text-sm text-ink-600">{LIVE_CATS.slice(1, 8).map((c, i) => <button key={c.label} onClick={() => { setCat(i + 1); window.scrollTo(0, 0) }} className="hover:text-brand-500">{c.label}</button>)}<button onClick={() => setCat(13)} className="hover:text-brand-500">更多推荐</button></div>
          </section>
        )}
      </div>
    </div>
  )
}

export const LiveFollow = () => <LiveHall follow />
