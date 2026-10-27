import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Camera, MonitorUp, Mic, MicOff, Radio, Pause, Play, Square, Pin, Ban, Send, Zap, Ticket, Megaphone, ShoppingBag, Users, Heart, MessageSquare, ShoppingCart, Wallet, Link2, Sparkles, FlipHorizontal, ChevronDown, Settings2 } from 'lucide-react'
import { useDB, genId } from '@/store/db'
import { useCurrentShop, useCurrentUser } from '@/lib/hooks'
import { Avatar, Img, Modal } from '@/components/ui'
import type { Product } from '@/data/types'
import { createBroadcaster, maskName, useLiveChannel, useLiveDerived, type LiveEvent } from '@/lib/live'
import { useMyLiveConfig } from './common'
import { cls, compact, money, liveNo } from '@/lib/format'
import { toast } from '@/store/session'

const fmtDur = (ms: number) => { const s = Math.floor(ms / 1000); const p = (n: number) => String(n).padStart(2, '0'); return `${p(Math.floor(s / 3600))}:${p(Math.floor(s % 3600 / 60))}:${p(s % 60)}` }

export default function Studio() {
  const { id } = useParams()
  const [sp] = useSearchParams()
  const nav = useNavigate()
  const shop = useCurrentShop()
  const user = useCurrentUser()
  const cfg = useMyLiveConfig()
  const { lives, products, startLive, endLive, setLiveExplain, setLiveProducts, updateLive, bumpLiveStats, upsertCoupon, upsertLiveConfig, orders } = useDB()
  const room = lives.find(l => l.id === id)
  const ps = useMemo(() => (room ? room.productIds.map(pid => products.find(p => p.id === pid)).filter(Boolean) as Product[] : []), [room, products])
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const bc = useRef<ReturnType<typeof createBroadcaster> | null>(null)
  const [camOk, setCamOk] = useState<boolean | null>(null)
  const [source, setSource] = useState<'camera' | 'screen' | 'virtual'>('camera')
  const virtualRaf = useRef(0)
  const explainRef = useRef<Product | undefined>(undefined)
  const [mirror, setMirror] = useState(true)
  const [micOn, setMicOn] = useState(true)
  const [pushing, setPushing] = useState(false)
  const [pushStat, setPushStat] = useState<{ seq: number; bytes: number; mode: 'chunks' | 'frame' } | null>(null)
  const [, setTick] = useState(0)
  const [tool, setTool] = useState<string | null>(sp.get('tool'))
  const [summary, setSummary] = useState<null | { views: number; likes: number; comments: number; peak: number; orders: number; gmv: number; fans: number; dur: number }>(null)
  const [text, setText] = useState('')
  const [quick, setQuick] = useState(false)
  const [notice, setNotice] = useState(room?.notice ?? '')
  const [flash, setFlash] = useState({ pid: '', price: '', mins: '5' })
  const [coupon, setCoupon] = useState({ amount: '5', min: '50' })
  const [priceEdit, setPriceEdit] = useState<Record<string, string>>({})
  const listRef = useRef<HTMLDivElement>(null)
  const ch = useLiveChannel(room?.id, { role: 'host', mediaMode: 'none', uid: user?.id, interval: 2000 })
  const derived = useLiveDerived(ch.events, { explainingId: room?.explainingId, notice: room?.notice })
  const live = room?.status === 'live'
  const seenRef = useRef({ enter: 0, likes: 0, comments: 0 })
  const repliedRef = useRef(new Set<number>())
  const hostName = cfg.nickname || shop.name

  useEffect(() => { document.title = `直播中控台 - ${room?.title ?? ''}` }, [room?.title])
  useEffect(() => { const t = setInterval(() => setTick(x => x + 1), 1000); return () => clearInterval(t) }, [])

  // 摄像头 / 屏幕采集
  const acquire = useCallback(async (kind: 'camera' | 'screen') => {
    try {
      streamRef.current?.getTracks().forEach(t => t.stop())
      const s = kind === 'camera' ? await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 720 }, height: { ideal: 960 }, facingMode: 'user' }, audio: true }) : await navigator.mediaDevices.getDisplayMedia({ video: { width: { ideal: 960 } }, audio: true })
      if (kind === 'screen' && !s.getAudioTracks().length) { try { const mic = await navigator.mediaDevices.getUserMedia({ audio: true }); mic.getAudioTracks().forEach(t => s.addTrack(t)) } catch { /* no mic */ } }
      streamRef.current = s
      s.getAudioTracks().forEach(t => { t.enabled = micOn })
      if (videoRef.current) { videoRef.current.srcObject = s; videoRef.current.play().catch(() => { /* ignore */ }) }
      setCamOk(true); setSource(kind)
      s.getVideoTracks()[0]?.addEventListener('ended', () => { if (kind === 'screen') acquire('camera') })
      if (pushing && room) { bc.current?.stop(); bc.current = createBroadcaster(room.id, { quality: cfg.quality, onStat: setPushStat }); bc.current.start(s, videoRef.current!) }
    } catch (e) { setCamOk(false); toast(`无法获取${kind === 'camera' ? '摄像头' : '屏幕'}：${(e as Error).message}`, 'error') }
  }, [micOn, pushing, room, cfg.quality])
  /** 虚拟画面：用 canvas 轮播货盘商品（无摄像头 / 无人直播 / 数字人模式） */
  const startVirtual = useCallback(() => {
    cancelAnimationFrame(virtualRaf.current)
    streamRef.current?.getTracks().forEach(t => t.stop())
    const canvas = document.createElement('canvas'); canvas.width = 540; canvas.height = 720
    const ctx = canvas.getContext('2d')!
    const imgs = ps.map(p => { const im = new Image(); im.crossOrigin = 'anonymous'; im.src = p.images[0]; return { p, im, ok: false, bad: false } })
    imgs.forEach(x => { x.im.onload = () => { x.ok = true }; x.im.onerror = () => { x.bad = true } })
    const t0 = performance.now()
    const draw = () => {
      const t = (performance.now() - t0) / 1000
      const ex = explainRef.current
      const idx = ex ? Math.max(0, ps.findIndex(p => p.id === ex.id)) : Math.floor(t / 5) % Math.max(1, imgs.length)
      const cur = imgs[idx]
      const g = ctx.createLinearGradient(0, 0, 0, 720); g.addColorStop(0, '#2a1f3d'); g.addColorStop(1, '#0f0f14'); ctx.fillStyle = g; ctx.fillRect(0, 0, 540, 720)
      if (cur && cur.ok && !cur.bad) { const z = 1 + ((t % 5) / 5) * 0.08; const w = 540 * z, h = 540 * z; try { ctx.drawImage(cur.im, (540 - w) / 2, 90 + (540 - h) / 2, w, h) } catch { cur.bad = true } }
      else { ctx.fillStyle = '#3b2f55'; ctx.fillRect(40, 130, 460, 460); ctx.fillStyle = '#fff'; ctx.font = '28px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(cur?.p.title.slice(0, 12) ?? '直播画面', 270, 370) }
      const g2 = ctx.createLinearGradient(0, 520, 0, 720); g2.addColorStop(0, 'rgba(0,0,0,0)'); g2.addColorStop(1, 'rgba(0,0,0,.85)'); ctx.fillStyle = g2; ctx.fillRect(0, 520, 540, 200)
      ctx.textAlign = 'left'; ctx.fillStyle = '#fff'; ctx.font = 'bold 26px sans-serif'; ctx.fillText((cur?.p.title ?? room?.title ?? '').slice(0, 16), 24, 630)
      ctx.fillStyle = '#ff7a45'; ctx.font = 'bold 34px sans-serif'; ctx.fillText(cur ? `¥${room?.livePrices[cur.p.id] ?? cur.p.price}` : '', 24, 676)
      ctx.fillStyle = 'rgba(255,255,255,.8)'; ctx.font = '18px sans-serif'; ctx.fillText(`${hostName} · 直播专享`, 24, 60)
      ctx.fillStyle = '#ff5000'; ctx.beginPath(); ctx.arc(500, 52, 8 + Math.sin(t * 4) * 2, 0, Math.PI * 2); ctx.fill()
      virtualRaf.current = requestAnimationFrame(draw)
    }
    draw()
    let s: MediaStream
    try { s = canvas.captureStream(24) } catch (e) { toast(`无法创建虚拟画面：${(e as Error).message}`, 'error'); return }
    streamRef.current = s
    if (videoRef.current) { videoRef.current.srcObject = s; videoRef.current.play().catch(() => { /* ignore */ }) }
    setCamOk(true); setSource('virtual')
    if (pushing && room) { bc.current?.stop(); bc.current = createBroadcaster(room.id, { quality: cfg.quality, onStat: setPushStat }); bc.current.start(s, videoRef.current!) }
  }, [ps, room, hostName, pushing, cfg.quality])
  useEffect(() => { acquire('camera'); return () => { cancelAnimationFrame(virtualRaf.current); streamRef.current?.getTracks().forEach(t => t.stop()); bc.current?.stop() } }, []) // eslint-disable-line
  useEffect(() => { streamRef.current?.getAudioTracks().forEach(t => { t.enabled = micOn }) }, [micOn])

  // 已在直播中（刷新页面后）自动恢复推流
  useEffect(() => { if (live && camOk && !pushing && streamRef.current && room) { bc.current = createBroadcaster(room.id, { quality: cfg.quality, onStat: setPushStat }); bc.current.start(streamRef.current, videoRef.current!); setPushing(true) } }, [live, camOk]) // eslint-disable-line

  // 周期同步统计到全局状态（观看 / 点赞 / 评论 / 在线）
  useEffect(() => {
    if (!live || !room) return
    const t = setInterval(() => {
      const enters = ch.events.filter(e => e.type === 'enter').length
      const d = { views: enters - seenRef.current.enter, likes: ch.counters.likes - seenRef.current.likes, comments: ch.counters.comments - seenRef.current.comments, viewers: ch.counters.viewers, peak: ch.counters.peak }
      seenRef.current = { enter: enters, likes: ch.counters.likes, comments: ch.counters.comments }
      bumpLiveStats(room.id, d)
    }, 15000)
    return () => clearInterval(t)
  }, [live, room?.id, ch.events, ch.counters]) // eslint-disable-line

  // AI 自动回复 / 快捷匹配
  useEffect(() => {
    if (!live || !cfg.aiReply) return
    for (const e of ch.events) {
      if (e.type !== 'comment' || repliedRef.current.has(e.id) || e.uid === user?.id) continue
      const ar = cfg.autoReplies.find(r => r.q && String(e.text ?? '').includes(r.q))
      if (ar) { repliedRef.current.add(e.id); ch.send('host', { name: `${hostName} · AI助理`, text: `@${maskName(String(e.name ?? ''), cfg.hideNames)} ${ar.a}` }) }
    }
  }, [ch.events, live, cfg, hostName, user?.id, ch])

  // 自动推品
  useEffect(() => {
    if (!live || !cfg.goods.autoPush || !room || ps.length < 2) return
    const t = setInterval(() => { const i = ps.findIndex(p => p.id === derived.explainingId); const next = ps[(i + 1) % ps.length]; setLiveExplain(room.id, next.id); ch.send('explain', { productId: next.id }) }, cfg.goods.pushInterval * 60000)
    return () => clearInterval(t)
  }, [live, cfg.goods.autoPush, cfg.goods.pushInterval, room?.id, ps, derived.explainingId]) // eslint-disable-line

  const comments = useMemo(() => ch.events.filter(e => ['comment', 'enter', 'follow', 'order', 'host'].includes(e.type)).slice(-200), [ch.events])
  useEffect(() => { const el = listRef.current; if (el) el.scrollTop = el.scrollHeight }, [comments.length])

  if (!room) return <div className="min-h-screen bg-[#17181c] text-white flex items-center justify-center"><div className="text-center"><div>直播场次不存在</div><Link to="/seller/live/plan" className="btn-primary mt-4">返回直播计划</Link></div></div>
  if (room.shopId !== shop.id) return <div className="min-h-screen bg-[#17181c] text-white flex items-center justify-center">无权访问该直播间</div>
  const ended = room.status === 'ended'
  const liveOrders = orders.filter(o => o.liveId === room.id && o.status !== 'unpaid' && o.status !== 'closed')
  const explaining = ps.find(p => p.id === derived.explainingId)
  explainRef.current = explaining
  const elapsed = live && room.startedAt ? Date.now() - new Date(room.startedAt).getTime() : 0

  const begin = async () => {
    if (!streamRef.current || !videoRef.current) return toast('请先允许摄像头权限或选择屏幕共享', 'error')
    startLive(room.id)
    await ch.send('start', { name: hostName })
    bc.current?.stop(); bc.current = createBroadcaster(room.id, { quality: cfg.quality, onStat: setPushStat }); bc.current.start(streamRef.current, videoRef.current); setPushing(true)
    if (cfg.intro) ch.send('host', { name: hostName, text: cfg.intro })
    toast('直播已开始，观众可在直播广场看到你')
  }
  const pause = () => { if (derived.paused) { ch.send('resume'); bc.current?.stop(); bc.current = createBroadcaster(room.id, { quality: cfg.quality, onStat: setPushStat }); bc.current.start(streamRef.current!, videoRef.current!); toast('已恢复直播') } else { ch.send('pause'); bc.current?.stop(); toast('已暂停推流，观众将看到"主播暂时离开"') } }
  const finish = async () => {
    bc.current?.stop(); setPushing(false)
    const enters = ch.events.filter(e => e.type === 'enter').length
    endLive(room.id, { views: Math.max(room.stats.views, enters), likes: Math.max(room.stats.likes, ch.counters.likes), comments: Math.max(room.stats.comments, ch.counters.comments), peak: Math.max(room.stats.peak, ch.counters.peak) })
    await ch.send('end')
    setSummary({ views: Math.max(room.stats.views, enters), likes: ch.counters.likes, comments: ch.counters.comments, peak: ch.counters.peak, orders: room.stats.orders + 0, gmv: room.stats.gmv, fans: room.stats.newFans, dur: Math.round(elapsed / 60000) })
  }
  const explain = (p: Product | null) => { setLiveExplain(room.id, p?.id ?? null); ch.send('explain', { productId: p?.id ?? null }); if (p) toast(`正在讲解：${p.title.slice(0, 16)}`) }
  const savePrice = (pid: string) => { const v = Number(priceEdit[pid]); const p = ps.find(x => x.id === pid)!; if (!v || v <= 0 || v >= p.price) return toast('直播价需低于原价', 'error'); setLiveProducts(room.id, room.productIds, { ...room.livePrices, [pid]: v }); toast('直播专享价已生效') }
  const sendHost = (t: string) => { if (!t.trim()) return; ch.send('host', { name: hostName, text: t.trim(), uid: user?.id }); setText(''); setQuick(false) }
  const mute = (e: LiveEvent) => { if (!e.uid) return; ch.send('mute', { uid: e.uid, name: e.name }); upsertLiveConfig({ ...cfg, mutedUsers: [...new Set([...cfg.mutedUsers, e.uid])] }); toast(`已禁言 ${e.name}`) }
  const pin = (e: LiveEvent) => { ch.send('pin', { text: `${e.name}：${e.text}` }); toast('已置顶') }
  const doFlash = () => { const p = ps.find(x => x.id === flash.pid); const price = Number(flash.price); if (!p || !price || price >= p.price) return toast('请选择商品并填写低于原价的秒杀价', 'error'); const until = Date.now() + Number(flash.mins || 5) * 60000; setLiveProducts(room.id, room.productIds, { ...room.livePrices, [p.id]: price }); explain(p); ch.send('flash', { productId: p.id, price, until }); setTool(null); toast('限时秒杀已开启') }
  const doCoupon = () => { const amount = Number(coupon.amount), min = Number(coupon.min); if (!amount) return; const cid = `cp-live-${genId()}`; upsertCoupon({ id: cid, name: `${hostName}专属券`, shopId: shop.id, type: 'cash', threshold: min, value: amount, total: 1000, used: 0, startAt: new Date().toISOString(), endAt: new Date(Date.now() + 7 * 864e5).toISOString(), status: 'active' }); ch.send('coupon', { amount, min, couponId: cid }); setTool(null); toast('优惠券已发放到直播间') }
  const doNotice = () => { updateLive(room.id, { notice }); ch.send('notice', { text: notice }); setTool(null); toast('公告已更新') }
  const share = () => navigator.clipboard?.writeText(`${location.origin}/live/${room.id}`).then(() => toast('直播间链接已复制'))

  return (
    <div className="min-h-screen bg-[#17181c] text-ink-100 flex flex-col">
      <header className="h-14 px-3 md:px-5 flex items-center gap-3 border-b border-white/10 bg-[#1f2026] sticky top-0 z-30">
        <Link to="/seller/live/plan" className="p-1.5 rounded hover:bg-white/10" aria-label="返回"><ArrowLeft className="w-5 h-5" /></Link>
        <div className="min-w-0"><div className="flex items-center gap-2"><span className="font-semibold truncate max-w-[200px] md:max-w-[320px]">{room.title}</span>{live ? <span className="inline-flex items-center gap-1 rounded bg-brand-500 text-white text-[11px] px-1.5 py-0.5"><Radio className="w-3 h-3" />直播中 {fmtDur(elapsed)}</span> : ended ? <span className="tag-gray">已结束</span> : <span className="tag-gold">未开播</span>}</div><div className="text-[11px] text-white/50 hidden sm:block">直播ID {liveNo(room.id)} · {hostName}</div></div>
        <div className="ml-auto hidden lg:flex items-center gap-5 text-xs text-white/70">{[[Users, '在线', compact(ch.counters.viewers)], [Heart, '点赞', compact(ch.counters.likes)], [MessageSquare, '评论', compact(ch.counters.comments)], [ShoppingCart, '订单', room.stats.orders], [Wallet, '成交', `¥${money(room.stats.gmv, 0)}`]].map(([I, l, v]) => { const Icon = I as typeof Users; return <span key={l as string} className="flex items-center gap-1"><Icon className="w-3.5 h-3.5" />{l as string} <b className="text-white font-num">{v as React.ReactNode}</b></span> })}</div>
        <button onClick={share} className="btn-ghost btn-sm text-white/80 hover:bg-white/10 gap-1"><Link2 className="w-3.5 h-3.5" />分享</button>
        {!live && !ended && <button onClick={begin} className="btn-primary gap-1"><Radio className="w-4 h-4" />开始直播</button>}
        {live && <><button onClick={pause} className="btn-sm h-9 rounded-lg bg-white/10 hover:bg-white/20 text-white gap-1 px-3">{derived.paused ? <><Play className="w-4 h-4" />恢复</> : <><Pause className="w-4 h-4" />暂停</>}</button><button onClick={finish} className="btn-sm h-9 rounded-lg bg-brand-500 hover:bg-brand-600 text-white gap-1 px-3"><Square className="w-3.5 h-3.5 fill-current" />结束直播</button></>}
        {ended && <Link to={`/seller/live/data/live?id=${room.id}`} className="btn-primary">查看本场数据</Link>}
      </header>

      <div className="flex-1 grid grid-cols-[360px_1fr_340px] max-xl:!grid-cols-[320px_1fr] max-lg:!grid-cols-1 gap-3 p-3">
        {/* 预览 / 采集 */}
        <section className="rounded-xl bg-[#1f2026] border border-white/10 flex flex-col overflow-hidden">
          <div className="px-4 h-11 flex items-center justify-between text-sm border-b border-white/10"><span className="font-medium flex items-center gap-1.5"><Camera className="w-4 h-4" />直播画面</span><span className={cls('text-[11px]', pushing ? 'text-emerald-400' : 'text-white/50')}>{pushing ? `推流中 · ${pushStat?.mode === 'frame' ? '关键帧' : 'webm'} #${pushStat?.seq ?? 0} ${pushStat ? Math.round(pushStat.bytes / 1024) : 0}KB` : camOk ? '预览中（未推流）' : camOk === false ? '采集失败' : '正在打开摄像头…'}</span></div>
          <div className="relative bg-black aspect-[3/4] max-lg:aspect-video">
            <video ref={videoRef} autoPlay muted playsInline className={cls('absolute inset-0 w-full h-full object-cover', mirror && source === 'camera' && 'scale-x-[-1]')} />
            {camOk === false && <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-white/70 text-sm px-6 text-center"><Camera className="w-8 h-8" />无法访问摄像头<div className="flex gap-2"><button onClick={() => acquire('camera')} className="btn-outline btn-sm bg-transparent text-white border-white/40">重试</button><button onClick={startVirtual} className="btn-primary btn-sm">使用虚拟画面</button></div><div className="text-[11px] text-white/40">虚拟画面会自动轮播货盘商品，适合无人直播 / 数字人模式</div></div>}
            {derived.paused && live && <div className="absolute inset-0 bg-black/60 flex items-center justify-center text-sm">已暂停</div>}
            {explaining && <div className="absolute left-2 bottom-2 flex items-center gap-2 rounded-lg bg-white/95 text-ink-900 p-1.5 pr-3 text-xs shadow"><Img src={explaining.images[0]} alt="" w={80} h={80} className="w-10 h-10 rounded object-cover" /><div><div className="line-clamp-1 max-w-[150px]">{explaining.title}</div><div className="price">¥{money(room.livePrices[explaining.id] ?? explaining.price, 0)} <span className="text-[10px] text-brand-500">讲解中</span></div></div></div>}
            {live && <div className="absolute top-2 left-2 rounded bg-black/50 text-white text-[11px] px-1.5 py-0.5 flex items-center gap-1"><Users className="w-3 h-3" />{compact(ch.counters.viewers)} 在线</div>}
          </div>
          <div className="p-3 grid grid-cols-2 keep-cols gap-2 text-xs">
            <button onClick={() => acquire('camera')} className={cls('h-9 rounded-lg flex items-center justify-center gap-1', source === 'camera' ? 'bg-brand-500 text-white' : 'bg-white/10 hover:bg-white/20')}><Camera className="w-4 h-4" />摄像头</button>
            <button onClick={() => acquire('screen')} className={cls('h-9 rounded-lg flex items-center justify-center gap-1', source === 'screen' ? 'bg-brand-500 text-white' : 'bg-white/10 hover:bg-white/20')}><MonitorUp className="w-4 h-4" />屏幕共享</button>
            <button onClick={startVirtual} className={cls('h-9 rounded-lg flex items-center justify-center gap-1 col-span-2', source === 'virtual' ? 'bg-brand-500 text-white' : 'bg-white/10 hover:bg-white/20')}><Sparkles className="w-4 h-4" />虚拟画面（商品轮播 / 数字人）</button>
            <button onClick={() => setMicOn(m => !m)} className={cls('h-9 rounded-lg flex items-center justify-center gap-1', micOn ? 'bg-white/10 hover:bg-white/20' : 'bg-amber-500/80 text-white')}>{micOn ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}{micOn ? '麦克风开' : '已静音'}</button>
            <button onClick={() => setMirror(m => !m)} className="h-9 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center gap-1"><FlipHorizontal className="w-4 h-4" />{mirror ? '镜像开' : '镜像关'}</button>
            <div className="col-span-2 flex items-center justify-between text-white/60 pt-1"><span className="flex items-center gap-1"><Settings2 className="w-3.5 h-3.5" />画质：{cfg.quality === 'low' ? '流畅' : cfg.quality === 'mid' ? '标清' : '高清'}</span><Link to="/seller/live/settings" className="hover:text-white">直播设置 ›</Link></div>
          </div>
          <div className="px-3 pb-3 text-[11px] text-white/45 leading-relaxed">浏览器每 2 秒编码一段画面并上传，观众端延迟约 3～6 秒；不支持视频解码的观众端（如 iPhone Safari）会以关键帧模式观看。</div>
        </section>

        {/* 商品 & 工具 */}
        <section className="rounded-xl bg-[#1f2026] border border-white/10 flex flex-col overflow-hidden min-h-[480px]">
          <div className="px-4 h-11 flex items-center gap-2 text-sm border-b border-white/10"><span className="font-medium flex items-center gap-1.5"><ShoppingBag className="w-4 h-4" />商品 ({ps.length})</span><Link to="/seller/live/goods" className="text-[11px] text-white/50 hover:text-white">管理货盘 ›</Link>
            <div className="ml-auto flex items-center gap-1.5">{[['限时秒杀', Zap], ['发券', Ticket], ['公告', Megaphone]].map(([t, I]) => { const Icon = I as typeof Zap; return <button key={t as string} onClick={() => setTool(t as string)} className="h-7 px-2.5 rounded-md bg-white/10 hover:bg-white/20 text-xs flex items-center gap-1"><Icon className="w-3.5 h-3.5" />{t as string}</button> })}</div></div>
          <div className="flex-1 overflow-auto p-3 space-y-2">
            {ps.length ? ps.map((p, i) => { const isEx = p.id === derived.explainingId; const lp = room.livePrices[p.id]; const sold = liveOrders.filter(o => o.items.some(it => it.productId === p.id)).length; return (
              <div key={p.id} className={cls('flex gap-3 rounded-lg p-2.5 border', isEx ? 'border-brand-500 bg-brand-500/10' : 'border-white/5 bg-white/[0.03]')}>
                <div className="relative w-16 h-16 rounded-md overflow-hidden shrink-0"><Img src={p.images[0]} alt="" w={120} h={120} className="w-full h-full object-cover" /><span className="absolute top-0 left-0 bg-black/60 text-white text-[10px] px-1 rounded-br">{ps.length - i}</span></div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm line-clamp-1">{p.title}</div>
                  <div className="mt-1 flex items-center gap-2 text-xs text-white/60 flex-wrap"><span className="price text-brand-400">¥{money(lp ?? p.price, 0)}</span>{lp && <span className="line-through">¥{money(p.price, 0)}</span>}<span>库存 {p.stock}</span><span>本场成交 {sold}</span>{isEx && <span className="text-brand-400">● 讲解中</span>}</div>
                  <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
                    <button onClick={() => explain(isEx ? null : p)} className={cls('h-7 px-2.5 rounded-md text-xs', isEx ? 'bg-white/15 hover:bg-white/25' : 'bg-brand-500 hover:bg-brand-600 text-white')}>{isEx ? '取消讲解' : '讲解'}</button>
                    <div className="flex items-center gap-1"><input value={priceEdit[p.id] ?? ''} onChange={e => setPriceEdit({ ...priceEdit, [p.id]: e.target.value })} placeholder="直播价" className="w-16 h-7 rounded-md bg-white/10 border border-white/10 px-2 text-xs outline-none focus:border-brand-400" /><button onClick={() => savePrice(p.id)} className="h-7 px-2 rounded-md bg-white/10 hover:bg-white/20 text-xs">设价</button></div>
                    <button onClick={() => { setFlash({ pid: p.id, price: String(Math.round((lp ?? p.price) * 0.8)), mins: '5' }); setTool('限时秒杀') }} className="h-7 px-2 rounded-md bg-white/10 hover:bg-white/20 text-xs flex items-center gap-1"><Zap className="w-3 h-3" />秒杀</button>
                    <button onClick={() => { const ids = [...room.productIds]; const k = ids.indexOf(p.id); if (k > 0) { ids.splice(k, 1); ids.unshift(p.id); setLiveProducts(room.id, ids) } }} className="h-7 px-2 rounded-md bg-white/10 hover:bg-white/20 text-xs">置顶</button>
                  </div>
                </div>
              </div>) }) : <div className="text-center text-sm text-white/50 py-10">货盘为空，<Link to="/seller/live/goods" className="text-brand-400">去添加商品</Link></div>}
          </div>
          {cfg.aiCard && explaining && <div className="border-t border-white/10 p-3 text-xs"><div className="flex items-center gap-1 text-fuchsia-300 mb-1"><Sparkles className="w-3.5 h-3.5" />AI手卡 · {explaining.title.slice(0, 14)}</div><div className="text-white/70 leading-relaxed">今天直播间专享价只要 <b className="text-white">¥{money(room.livePrices[explaining.id] ?? explaining.price, 0)}</b>，{explaining.tags[0] ?? '品质保障'}，{explaining.freeShipping ? '全国包邮' : '顺丰速达'}，7 天无理由。想要的宝宝扣 1，库存只有 {explaining.stock} 件！</div></div>}
        </section>

        {/* 互动 */}
        <section className="rounded-xl bg-[#1f2026] border border-white/10 flex flex-col overflow-hidden min-h-[420px] max-xl:col-span-2 max-lg:col-span-1">
          <div className="px-4 h-11 flex items-center justify-between text-sm border-b border-white/10"><span className="font-medium flex items-center gap-1.5"><MessageSquare className="w-4 h-4" />互动</span><span className="text-[11px] text-white/50">{cfg.aiReply ? 'AI助理已开启' : ''} {cfg.mutedUsers.length ? `· 禁言 ${cfg.mutedUsers.length}` : ''}</span></div>
          {derived.pinned && <div className="mx-3 mt-2 rounded-md bg-brand-500/20 text-brand-200 text-xs px-2.5 py-1.5 flex items-center gap-1.5"><Pin className="w-3 h-3" />{derived.pinned.text}<button onClick={() => ch.send('pin', { text: '' })} className="ml-auto text-white/50 hover:text-white">取消</button></div>}
          <div ref={listRef} className="flex-1 overflow-auto px-3 py-2 space-y-2 text-sm">
            {comments.length === 0 && <div className="text-xs text-white/40 text-center py-6">{live ? '等待观众互动…' : '开播后观众的评论会显示在这里'}</div>}
            {comments.map(e => e.type === 'comment' ? (
              <div key={e.id} className="group flex items-start gap-2"><Avatar src={e.avatar as string} name="" size={22} /><div className="min-w-0 flex-1"><span className={cls('text-xs mr-1', e.level === 2 ? 'text-emerald-400' : e.level === 1 ? 'text-sky-400' : 'text-white/50')}>{e.name}</span><span className="text-white/90 break-words">{e.text}</span></div><div className="hidden group-hover:flex items-center gap-1 shrink-0"><button title="置顶" onClick={() => pin(e)} className="p-1 rounded hover:bg-white/10"><Pin className="w-3.5 h-3.5" /></button><button title="回复" onClick={() => setText(`@${e.name} `)} className="p-1 rounded hover:bg-white/10"><Send className="w-3.5 h-3.5" /></button><button title="禁言" onClick={() => mute(e)} className="p-1 rounded hover:bg-white/10 text-amber-400"><Ban className="w-3.5 h-3.5" /></button></div></div>
            ) : e.type === 'host' ? <div key={e.id} className="text-xs"><span className="text-brand-400 mr-1">[主播] {e.name}：</span><span className="text-white/80">{e.text}</span></div>
              : <div key={e.id} className="text-xs text-white/40">{e.type === 'enter' ? `${e.name} 来了` : e.type === 'follow' ? `🎉 ${e.name} 关注了你` : e.type === 'order' ? `🛒 ${e.name} 正在去买 ${e.text ?? ''}` : ''}</div>)}
          </div>
          <div className="border-t border-white/10 p-2.5">
            {quick && cfg.quickReplies.length > 0 && <div className="mb-2 flex flex-wrap gap-1.5">{cfg.quickReplies.map(r => <button key={r} onClick={() => sendHost(r)} className="text-xs rounded-md bg-white/10 hover:bg-white/20 px-2 py-1">{r}</button>)}</div>}
            <div className="flex items-center gap-2"><button onClick={() => setQuick(q => !q)} className="h-9 px-2 rounded-lg bg-white/10 hover:bg-white/20 text-xs flex items-center gap-1">快捷<ChevronDown className={cls('w-3 h-3 transition', quick && 'rotate-180')} /></button><input value={text} onChange={e => { setText(e.target.value); if (e.target.value === '/') setQuick(true) }} onKeyDown={e => e.key === 'Enter' && sendHost(text)} placeholder="以主播身份发言，输入 / 选择快捷回复" className="flex-1 min-w-0 h-9 rounded-lg bg-white/10 border border-white/10 px-3 text-sm outline-none focus:border-brand-400" /><button onClick={() => sendHost(text)} aria-label="发送" className="h-9 w-9 rounded-lg bg-brand-500 hover:bg-brand-600 text-white flex items-center justify-center"><Send className="w-4 h-4" /></button></div>
          </div>
        </section>
      </div>

      <Modal open={tool === '限时秒杀'} onClose={() => setTool(null)} title="限时秒杀" width={480} footer={<><button onClick={() => setTool(null)} className="btn-ghost">取消</button><button onClick={doFlash} className="btn-primary">开启秒杀</button></>}>
        <div className="space-y-3"><select value={flash.pid} onChange={e => setFlash({ ...flash, pid: e.target.value })} className="input-qn"><option value="">选择商品</option>{ps.map(p => <option key={p.id} value={p.id}>{p.title.slice(0, 30)} · ¥{p.price}</option>)}</select><div className="grid grid-cols-2 keep-cols gap-3"><label className="text-sm">秒杀价<input value={flash.price} onChange={e => setFlash({ ...flash, price: e.target.value })} className="input-qn mt-1" placeholder="¥" /></label><label className="text-sm">持续（分钟）<input value={flash.mins} onChange={e => setFlash({ ...flash, mins: e.target.value })} className="input-qn mt-1" /></label></div><div className="text-xs text-ink-500">开启后该商品自动进入讲解，观众端显示秒杀倒计时，结算按秒杀价。</div></div>
      </Modal>
      <Modal open={tool === '发券' || tool === '主播专属券' || tool === '万能红包'} onClose={() => setTool(null)} title="发放主播专属券" width={440} footer={<><button onClick={() => setTool(null)} className="btn-ghost">取消</button><button onClick={doCoupon} className="btn-primary">发放</button></>}>
        <div className="grid grid-cols-2 keep-cols gap-3"><label className="text-sm">面额（元）<input value={coupon.amount} onChange={e => setCoupon({ ...coupon, amount: e.target.value })} className="input-qn mt-1" /></label><label className="text-sm">满（元）可用<input value={coupon.min} onChange={e => setCoupon({ ...coupon, min: e.target.value })} className="input-qn mt-1" /></label></div><div className="text-xs text-ink-500 mt-3">观众点击"领取"后进入其卡券包，结算时自动抵扣；有效期 7 天。</div>
      </Modal>
      <Modal open={tool === '公告' || tool === '直播闪降'} onClose={() => setTool(null)} title="直播间公告" width={440} footer={<><button onClick={() => setTool(null)} className="btn-ghost">取消</button><button onClick={doNotice} className="btn-primary">发布</button></>}>
        <input value={notice} onChange={e => setNotice(e.target.value.slice(0, 40))} placeholder="如：关注主播不迷路，整点抽免单" className="input-qn" />
      </Modal>
      <Modal open={!!summary} onClose={() => { setSummary(null); nav('/seller/live/plan') }} title="本场直播数据" width={520} footer={<><Link to={`/seller/live/data/live?id=${room.id}`} className="btn-outline">场次分析</Link><button onClick={() => { setSummary(null); nav('/seller/live/plan') }} className="btn-primary">完成</button></>}>
        {summary && <div className="grid grid-cols-4 keep-cols gap-3 text-center">{[['直播时长', `${summary.dur} 分钟`], ['观看', compact(summary.views)], ['最高在线', compact(summary.peak)], ['点赞', compact(summary.likes)], ['评论', compact(summary.comments)], ['订单', summary.orders], ['成交', `¥${money(summary.gmv, 0)}`], ['新增粉丝', summary.fans]].map(([l, v]) => <div key={l as string} className="rounded-lg bg-ink-50 py-3"><div className="text-lg font-num font-semibold">{v as React.ReactNode}</div><div className="text-xs text-ink-500 mt-0.5">{l as string}</div></div>)}</div>}
      </Modal>
    </div>
  )
}
