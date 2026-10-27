import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Heart, Maximize2, MoreHorizontal, Pause, Play, Search, Send, Share2, ShoppingBag, ShoppingCart, Smile, X, Ticket, Zap, ChevronRight, Pin, Users } from 'lucide-react'
import { useDB } from '@/store/db'
import { useCurrentUser } from '@/lib/hooks'
import { Avatar, Img, Empty } from '@/components/ui'
import { DemoStage, RealStage } from '@/components/LiveStage'
import { LiveHeader, RoomCard } from '@/pages/buyer/Live'
import { maskName, transport, useLiveChannel, useLiveDerived, type LiveEvent } from '@/lib/live'
import type { LiveRoom as Room, Product } from '@/data/types'
import { cls, compact, money, liveNo } from '@/lib/format'
import { toast } from '@/store/session'

const BOT_NAMES = ['维', '橄', 'T', '蝶', '小鹿', '阿梨', '柚子', '晴天', '墨白', '七月', 'Kiki', '大熊']
const BOT_TEXTS = ['都抢不到', '1号能加吗', '福利都是只上1个？', '简单的吊坠秒一个呗', '耳钉 白色 8左右', '主播声音好好听', '这个链接什么时候上', '已拍，坐等发货', '还有优惠券吗', '3号能再讲一下吗', '来了来了', '求上福利款', '黑色还有货吗', '关注了！', '这个价格太香了']

function Hearts({ burst }: { burst: number }) {
  const [list, setList] = useState<{ id: number; dx: number; c: string }[]>([])
  useEffect(() => { if (!burst) return; const id = Date.now() + Math.random(); setList(l => [...l.slice(-20), { id, dx: Math.round((Math.random() - 0.5) * 60), c: ['#ff5000', '#ff3b7a', '#ffb800', '#9b5cff', '#2bd1ff'][Math.floor(Math.random() * 5)] }]); const t = setTimeout(() => setList(l => l.filter(x => x.id !== id)), 1700); return () => clearTimeout(t) }, [burst])
  return <div className="pointer-events-none absolute bottom-14 right-5 w-10 h-10">{list.map(h => <Heart key={h.id} className="absolute left-0 bottom-0 w-7 h-7 animate-heart" style={{ ['--dx' as string]: `${h.dx}px`, color: h.c, fill: h.c }} />)}</div>
}

function ProductRow({ p, idx, room, explaining, onBuy, onCart }: { p: Product; idx: number; room: Room; explaining: boolean; onBuy: () => void; onCart: () => void }) {
  const lp = room.livePrices[p.id]
  const off = p.status !== 'on' || p.stock <= 0
  return (
    <div className={cls('flex gap-3 py-3 border-b border-ink-100 last:border-0', off && 'opacity-60')}>
      <div className="relative w-24 h-24 rounded-lg overflow-hidden bg-ink-50 shrink-0">
        <Img src={p.images[0]} alt={p.title} w={200} h={200} className="w-full h-full object-cover" />
        <span className="absolute top-0 left-0 bg-black/60 text-white text-xs px-1.5 py-0.5 rounded-br-md font-num">{idx}</span>
        {explaining && <span className="absolute bottom-0 inset-x-0 bg-brand-500/90 text-white text-[11px] text-center py-0.5 flex items-center justify-center gap-1"><span className="inline-flex gap-[2px] items-end h-2"><i className="w-[2px] bg-white animate-eq1 h-full" /><i className="w-[2px] bg-white animate-eq2 h-full" /><i className="w-[2px] bg-white animate-eq3 h-full" /></span>讲解中</span>}
        {off && <span className="absolute inset-0 bg-white/60 flex items-center justify-center text-xs text-ink-700">- 已下架 -</span>}
      </div>
      <div className="flex-1 min-w-0 flex flex-col">
        <div className="text-sm text-ink-900 line-clamp-2 leading-snug">{p.title}</div>
        <div className="mt-auto flex items-end justify-between gap-2">
          <div><span className="price text-lg">¥{money(lp ?? p.price, (lp ?? p.price) % 1 ? 2 : 0)}</span>{lp && lp < p.price && <span className="ml-1.5 text-xs text-ink-400 line-through">¥{money(p.price, 0)}</span>}{lp && lp < p.price && <span className="ml-1.5 text-[10px] text-brand-500 border border-brand-300 rounded px-1">直播专享</span>}</div>
          {off ? <span className="btn-ghost h-8 px-3 text-xs cursor-default">已下架</span> : <div className="flex items-center gap-1.5"><button onClick={onCart} aria-label="加入购物车" className="w-8 h-8 rounded-md border border-brand-300 text-brand-500 flex items-center justify-center hover:bg-brand-50"><ShoppingCart className="w-4 h-4" /></button><button onClick={onBuy} className="btn-primary h-8 px-3 text-sm">马上抢</button></div>}
        </div>
      </div>
    </div>
  )
}

export default function LiveRoom() {
  const { id } = useParams()
  const nav = useNavigate()
  const user = useCurrentUser()
  const { lives, shops, products, followedShops, followLive, addToCart, liveConfigs, claimCoupon, coupons } = useDB()
  const room = lives.find(l => l.id === id)
  const shop = shops.find(s => s.id === room?.shopId)
  const cfg = liveConfigs.find(c => c.shopId === room?.shopId)
  const ps = useMemo(() => (room ? room.productIds.map(pid => products.find(p => p.id === pid)).filter(Boolean) as Product[] : []), [room, products])
  const [panel, setPanel] = useState(false)
  const [q, setQ] = useState('')
  const [text, setText] = useState('')
  const [burst, setBurst] = useState(0)
  const [likesLocal, setLikesLocal] = useState(0)
  const pendingLikes = useRef(0)
  const [bots, setBots] = useState<LiveEvent[]>([])
  const [paused, setPaused] = useState(false)
  const listRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const ch = useLiveChannel(room?.id, { role: 'viewer', mediaMode: 'none', uid: user?.id, interval: 2000 })
  const derived = useLiveDerived(ch.events, { explainingId: room?.explainingId, notice: room?.notice })
  const name = user?.nickname ?? '游客'

  useEffect(() => { if (room) document.title = `${shop?.name ?? ''} - Plam直播` }, [room, shop])
  // 进场通知（每个直播间一次）
  useEffect(() => { if (!room || room.status !== 'live') return; const k = `plam-live-enter-${room.id}`; if (sessionStorage.getItem(k)) return; sessionStorage.setItem(k, '1'); transport().event(room.id, 'enter', { uid: user?.id, name }) }, [room?.id]) // eslint-disable-line
  // 演示直播间：模拟弹幕
  useEffect(() => {
    if (!room?.demo || room.status !== 'live') return
    let n = 0
    const t = setInterval(() => { n++; setBots(b => [...b.slice(-60), { id: -n, type: 'comment', ts: Date.now(), name: BOT_NAMES[n % BOT_NAMES.length], text: BOT_TEXTS[(n * 7) % BOT_TEXTS.length], level: n % 4 === 0 ? 2 : n % 3 === 0 ? 1 : 0 }]) }, 2500 + Math.random() * 2500)
    return () => clearInterval(t)
  }, [room?.id, room?.demo, room?.status])
  // 批量发送点赞
  useEffect(() => { const t = setInterval(() => { if (pendingLikes.current > 0 && room) { const n = pendingLikes.current; pendingLikes.current = 0; transport().event(room.id, 'like', { n, uid: user?.id }) } }, 1500); return () => clearInterval(t) }, [room, user?.id])
  const messages = useMemo(() => [...bots, ...ch.events.filter(e => ['comment', 'enter', 'follow', 'order', 'host', 'gift'].includes(e.type) && !(e.uid && derived.muted.has(e.uid)))].sort((a, b) => a.ts - b.ts).slice(-120), [bots, ch.events, derived.muted])
  useEffect(() => { const el = listRef.current; if (el) el.scrollTop = el.scrollHeight }, [messages.length])
  const onCounters = useCallback(() => { /* counters come from ch */ }, [])

  if (!room || !shop) return <div className="bg-white min-h-screen"><LiveHeader /><div className="container-x py-20"><Empty text="直播间不存在或已关闭" /><div className="text-center mt-4"><Link to="/live" className="btn-primary">返回直播广场</Link></div></div></div>
  const explaining = ps.find(p => p.id === derived.explainingId)
  const followed = followedShops.includes(shop.id)
  const viewers = room.demo ? room.stats.viewers + ch.counters.viewers : ch.counters.viewers
  const likes = (room.demo ? room.stats.likes : 0) + ch.counters.likes + likesLocal
  const ended = room.status === 'ended' || derived.ended
  const hide = cfg?.hideNames ?? true

  const send = async () => {
    const t = text.trim()
    if (!t) return
    if (!user) return nav(`/login?to=/live/${room.id}`)
    if (cfg?.blockWords.some(w => w && t.includes(w))) return toast('评论包含敏感词，未发送', 'error')
    if (cfg?.mutedUsers.includes(user.id) || derived.muted.has(user.id)) return toast('你已被主播禁言', 'error')
    setText('')
    await ch.send('comment', { uid: user.id, name: user.nickname, avatar: user.avatar, text: t, level: user.level >= 5 ? 2 : user.level >= 3 ? 1 : 0 })
  }
  const like = () => { setBurst(b => b + 1); setLikesLocal(n => n + 1); pendingLikes.current++ }
  const follow = () => { if (!user) return nav(`/login?to=/live/${room.id}`); if (followed) return toast('已关注'); followLive(shop.id, room.id); ch.send('follow', { uid: user.id, name: user.nickname }); toast('关注成功') }
  const buy = (p: Product) => { nav(`/item/${p.id}?live=${room.id}`) }
  const cart = (p: Product) => { if (!user) return nav('/login'); addToCart(p.id, p.skus[0].id, 1); toast('已加入购物车') }
  const fullscreen = () => { const el = stageRef.current; if (!el) return; if (document.fullscreenElement) document.exitFullscreen(); else el.requestFullscreen?.() }
  const share = () => { navigator.clipboard?.writeText(location.href).then(() => toast('直播间链接已复制')).catch(() => toast(location.href)) }
  const filtered = q ? ps.filter(p => p.title.includes(q)) : ps
  const idxOf = (p: Product) => ps.length - ps.indexOf(p)
  const caption = (
    <>
      <div className="absolute top-3 left-3 z-10 flex items-center gap-2 rounded-full bg-black/45 backdrop-blur-sm text-white pl-1 pr-1 py-1">
        <Avatar src={shop.logo} name="" size={34} />
        <div className="leading-tight pr-1"><div className="text-[13px] font-medium max-w-[150px] truncate">{cfg?.nickname ?? shop.name}</div><div className="text-[11px] opacity-85">{compact(viewers)}观看 · {compact(shop.fans)}粉丝</div></div>
        <button onClick={follow} className={cls('h-7 px-3 rounded-full text-xs font-medium', followed ? 'bg-white/20 text-white' : 'bg-brand-500 text-white hover:bg-brand-600')}>{followed ? '已关注' : '关注'}</button>
      </div>
      <div className="absolute top-3 right-14 z-10 text-[10px] text-white/50 hidden sm:block">Plam直播ID：{liveNo(room.id)}</div>
      {derived.notice && <div className="absolute top-16 left-3 z-10 max-w-[70%] rounded-full bg-black/40 text-white/90 text-[11px] px-3 py-1 flex items-center gap-1"><Pin className="w-3 h-3" />{derived.notice}</div>}
      {derived.flash && derived.flash.productId && <div className="absolute top-[104px] left-3 z-10 rounded-lg bg-gradient-to-r from-brand-500 to-rose-500 text-white text-xs px-3 py-1.5 flex items-center gap-2 shadow-pop"><Zap className="w-3.5 h-3.5" />限时秒杀 ¥{derived.flash.price} <Countdown until={derived.flash.until as number} /><button onClick={() => { const p = ps.find(x => x.id === derived.flash!.productId); if (p) buy(p) }} className="bg-white text-brand-600 rounded px-2 py-0.5 font-medium">去抢</button></div>}
      {derived.coupon && <div className="absolute top-[104px] right-3 z-10 rounded-lg bg-amber-400 text-amber-950 text-xs px-3 py-1.5 flex items-center gap-2 shadow-pop"><Ticket className="w-3.5 h-3.5" />主播发了 ¥{derived.coupon.amount} 券<button onClick={() => { if (!user) return nav('/login'); const cid = derived.coupon!.couponId as string; if (cid && coupons.some(c => c.id === cid)) { claimCoupon(cid); toast('领取成功，结算时可用') } else toast('已领取') }} className="bg-amber-950 text-amber-100 rounded px-2 py-0.5">领取</button></div>}
      {explaining && (
        <div className="absolute right-3 bottom-[72px] z-10 w-[164px] rounded-lg bg-white shadow-pop overflow-hidden animate-fadeUp">
          <div className="relative aspect-square"><Img src={explaining.images[0]} alt={explaining.title} w={300} h={300} className="w-full h-full object-cover" /><span className="absolute top-0 left-0 bg-black/60 text-white text-xs px-1.5 py-0.5 rounded-br-md font-num">{idxOf(explaining)}</span><button aria-label="关闭" onClick={() => ch.send('explain', { productId: null, local: true })} className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/40 text-white flex items-center justify-center hidden"><X className="w-3 h-3" /></button></div>
          <div className="px-2.5 pt-2 text-sm text-ink-900 line-clamp-1">{explaining.title}</div>
          <button onClick={() => buy(explaining)} className="m-2.5 mt-2 h-9 rounded-md bg-brand-500 hover:bg-brand-600 text-white flex items-center justify-between px-3 text-sm font-semibold w-[calc(100%-20px)]"><span>¥{money(room.livePrices[explaining.id] ?? explaining.price, 0)}</span><span className="flex items-center">抢<ChevronRight className="w-4 h-4" /></span></button>
        </div>
      )}
      <button onClick={() => setPanel(true)} className="absolute right-3 bottom-8 z-10 h-9 rounded-full bg-black/55 backdrop-blur text-white text-sm pl-3 pr-2 flex items-center gap-1.5 hover:bg-black/70"><ShoppingBag className="w-4 h-4 text-brand-400" />全部商品 ({ps.length})<ChevronRight className="w-4 h-4" /></button>
      <div className="absolute inset-x-0 bottom-0 z-10 h-12 px-3 flex items-center gap-2 text-white/90">
        <button aria-label={paused ? '播放' : '暂停'} onClick={() => setPaused(p => !p)} className="w-8 h-8 flex items-center justify-center hover:bg-white/10 rounded">{paused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}</button>
        <button aria-label="分享" onClick={share} className="w-8 h-8 flex items-center justify-center hover:bg-white/10 rounded"><Share2 className="w-4 h-4" /></button>
        <button aria-label="更多" className="w-8 h-8 flex items-center justify-center hover:bg-white/10 rounded"><MoreHorizontal className="w-4 h-4" /></button>
        <span className="ml-auto text-xs opacity-80 hidden sm:inline">自动</span>
        <button aria-label="全屏" onClick={fullscreen} className="w-8 h-8 flex items-center justify-center hover:bg-white/10 rounded"><Maximize2 className="w-4 h-4" /></button>
      </div>
      {paused && <div className="absolute inset-0 z-[5] bg-black/50 flex items-center justify-center"><button onClick={() => setPaused(false)} className="w-16 h-16 rounded-full bg-white/20 backdrop-blur flex items-center justify-center text-white"><Play className="w-7 h-7 fill-current" /></button></div>}
      {derived.paused && !ended && <div className="absolute inset-0 z-[5] bg-black/60 flex items-center justify-center text-white text-sm">主播暂时离开，马上回来～</div>}
      {ended && <div className="absolute inset-0 z-[6] bg-black/75 flex flex-col items-center justify-center text-white gap-3"><Avatar src={shop.logo} name="" size={64} /><div className="text-lg font-semibold">直播已结束</div><div className="text-xs opacity-70">本场 {compact(room.stats.views)} 次观看 · {compact(likes)} 点赞</div><Link to={`/shop/${shop.id}`} className="btn-primary mt-2">逛逛店铺</Link></div>}
      <Hearts burst={burst} />
      {panel && (
        <div className="absolute inset-0 z-20 flex justify-end bg-black/30" onClick={() => setPanel(false)}>
          <div className="w-full max-w-[380px] bg-white h-full flex flex-col animate-fadeUp" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 px-4 h-14 border-b border-ink-100"><span className="font-semibold text-base">全部商品</span><div className="ml-auto flex items-center border border-ink-200 rounded-full h-8 px-3 gap-1 text-xs text-ink-500"><input value={q} onChange={e => setQ(e.target.value)} placeholder="搜直播间内商品" className="w-28 outline-none" /><Search className="w-3.5 h-3.5" /></div><button aria-label="关闭" onClick={() => setPanel(false)} className="p-1 rounded hover:bg-ink-100"><X className="w-5 h-5" /></button></div>
            <div className="flex-1 overflow-auto px-4">{filtered.length ? [...filtered].reverse().map(p => <ProductRow key={p.id} p={p} idx={idxOf(p)} room={room} explaining={p.id === derived.explainingId} onBuy={() => buy(p)} onCart={() => cart(p)} />) : <Empty text="暂无商品" />}</div>
          </div>
        </div>
      )}
    </>
  )

  return (
    <div className="bg-white min-h-screen mobile-pb">
      <LiveHeader />
      <div className="container-x pb-8">
        <div className="grid grid-cols-[1fr_356px] max-lg:!grid-cols-1 gap-4 items-stretch">
          <div ref={stageRef} className="relative rounded-xl2 overflow-hidden bg-black h-[560px] max-md:h-[62vh] keep-flex">
            {room.demo ? <DemoStage products={ps} cover={room.cover} className="absolute inset-0" caption={caption} /> : <RealStage room={room} uid={user?.id} className="absolute inset-0" caption={caption} onCounters={onCounters} />}
          </div>
          <aside className="card flex flex-col h-[560px] max-md:h-[420px]">
            <div className="px-4 h-12 flex items-center justify-between border-b border-ink-100"><span className="font-semibold text-base">聊天互动</span><span className="text-xs text-ink-400 flex items-center gap-1"><Users className="w-3.5 h-3.5" />{compact(viewers)} 在线</span></div>
            {derived.pinned && <div className="mx-3 mt-2 rounded-lg bg-brand-50 text-brand-700 text-xs px-3 py-2 flex items-start gap-1.5"><Pin className="w-3.5 h-3.5 mt-0.5 shrink-0" /><span className="line-clamp-2">{derived.pinned.text}</span></div>}
            <div ref={listRef} className="flex-1 overflow-auto px-4 py-2 space-y-2.5 text-sm">
              {cfg?.intro && <div className="text-xs text-ink-400 bg-ink-50 rounded-md px-2.5 py-1.5">{cfg.intro}</div>}
              {messages.map(m => m.type === 'comment' ? (
                <div key={m.id} className="leading-relaxed break-words">
                  {m.level ? <span className={cls('inline-flex items-center rounded-sm text-[10px] px-1 mr-1 text-white', m.level === 2 ? 'bg-emerald-500' : 'bg-sky-500')}>{m.level === 2 ? '铁粉' : '新粉'}</span> : null}
                  <span className={cls('mr-1', m.level === 2 ? 'text-emerald-600' : m.level === 1 ? 'text-sky-600' : 'text-ink-500')}>{maskName(String(m.name ?? ''), hide)}：</span><span className="text-ink-900">{m.text}</span>
                </div>
              ) : m.type === 'host' ? <div key={m.id} className="leading-relaxed"><span className="inline-flex items-center rounded-sm text-[10px] px-1 mr-1 bg-brand-500 text-white">主播</span><span className="text-brand-600 mr-1">{m.name}：</span><span className="text-ink-900">{m.text}</span></div>
                : <div key={m.id} className="text-xs text-ink-400">{m.type === 'enter' ? `${maskName(String(m.name ?? ''), hide)} 来了` : m.type === 'follow' ? `${maskName(String(m.name ?? ''), hide)} 关注了主播` : m.type === 'order' ? `${maskName(String(m.name ?? ''), hide)} 正在去买 ${m.text ?? ''}` : m.type === 'gift' ? `${maskName(String(m.name ?? ''), hide)} 送出了 ${m.text}` : ''}</div>)}
            </div>
            <div className="border-t border-ink-100 p-3 flex items-center gap-2">
              <Smile className="w-5 h-5 text-ink-400 shrink-0" />
              <input value={text} onChange={e => setText(e.target.value)} onKeyDown={e => e.key === 'Enter' && send()} placeholder={ended ? '直播已结束' : user ? '说点什么吧' : '登录后参与互动'} disabled={ended} aria-label="发送评论" className="flex-1 min-w-0 h-9 outline-none text-sm bg-transparent" />
              <button onClick={send} aria-label="发送" className={cls('w-8 h-8 rounded-md flex items-center justify-center', text.trim() ? 'text-brand-500 hover:bg-brand-50' : 'text-ink-300')}><Send className="w-4 h-4" /></button>
              <button onClick={like} aria-label="点赞" className="relative w-9 h-9 rounded-full bg-brand-50 text-brand-500 flex items-center justify-center hover:bg-brand-100 active:scale-90 transition"><Heart className="w-[18px] h-[18px]" /><span className="absolute -top-1.5 -right-2 text-[10px] font-num text-brand-500 bg-white rounded-full px-1 shadow-card">{compact(likes)}</span></button>
            </div>
          </aside>
        </div>
        <section className="mt-8">
          <h2 className="text-lg md:text-xl font-bold mb-3">更多直播</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 md:gap-4">{lives.filter(l => l.id !== room.id && l.status === 'live').slice(0, 6).map(r => <RoomCard key={r.id} room={r} />)}</div>
        </section>
      </div>
    </div>
  )
}

function Countdown({ until }: { until: number }) {
  const [left, setLeft] = useState(Math.max(0, until - Date.now()))
  useEffect(() => { const t = setInterval(() => setLeft(Math.max(0, until - Date.now())), 1000); return () => clearInterval(t) }, [until])
  const s = Math.floor(left / 1000)
  return <span className="font-num">{String(Math.floor(s / 60)).padStart(2, '0')}:{String(s % 60).padStart(2, '0')}</span>
}

