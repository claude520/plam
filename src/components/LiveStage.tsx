import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Volume2, VolumeX, WifiOff } from 'lucide-react'
import type { LiveRoom, Product } from '@/data/types'
import { canPlayChunks, useLiveChannel, useMsePlayer } from '@/lib/live'
import { thumb } from '@/components/ui'
import { cls } from '@/lib/format'

/** 演示直播间（种子数据）：用商品图做 Ken Burns 轮播模拟画面 */
export function DemoStage({ products, cover, className, caption }: { products: Product[]; cover?: string; className?: string; caption?: ReactNode }) {
  const imgs = products.length ? products.map(p => p.images[0]) : [cover ?? '']
  const [i, setI] = useState(0)
  useEffect(() => { const t = setInterval(() => setI(x => (x + 1) % imgs.length), 4500); return () => clearInterval(t) }, [imgs.length])
  return (
    <div className={cls('overflow-hidden bg-black', className)}>
      <img src={thumb(imgs[i])} alt="" aria-hidden className="absolute inset-0 w-full h-full object-cover blur-2xl opacity-60 scale-110" />
      {imgs.map((src, k) => <img key={src + k} src={src} alt="直播画面" className={cls('absolute inset-0 m-auto h-full w-auto max-w-full object-cover transition-opacity duration-700', k === i ? 'opacity-100 animate-kenburns' : 'opacity-0')} loading={k === 0 ? 'eager' : 'lazy'} />)}
      <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/60 to-transparent pointer-events-none" />
      {caption}
    </div>
  )
}

/** 真实直播间：优先 MSE 视频分片，其次 JPEG 关键帧 */
export function RealStage({ room, uid, className, caption, muted: initMuted = true, onCounters, onEvents, preview }: { room: LiveRoom; uid?: string; className?: string; caption?: ReactNode; muted?: boolean; onCounters?: (c: { viewers: number; likes: number; comments: number; peak: number }) => void; onEvents?: (ch: ReturnType<typeof useLiveChannel>) => void; preview?: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [mimeKnown, setMimeKnown] = useState<string | null>(null)
  const [muted, setMuted] = useState(initMuted)
  const supports = typeof MediaSource !== 'undefined'
  const useChunks = supports && !preview && (mimeKnown ? canPlayChunks(mimeKnown) : true)
  const mse = useMsePlayer(videoRef, mimeKnown, useChunks)
  const ch = useLiveChannel(room.id, { role: 'viewer', mediaMode: useChunks ? 'chunks' : 'frame', uid, interval: preview ? 3000 : 1500, noEvents: true, onChunk: c => mse.feed(c.chunk) })
  useEffect(() => { if (ch.mime && ch.mime !== mimeKnown) setMimeKnown(ch.mime) }, [ch.mime, mimeKnown])
  useEffect(() => { onCounters?.(ch.counters) }, [ch.counters, onCounters])
  useEffect(() => { onEvents?.(ch) }, [ch, onEvents])
  useEffect(() => { if (videoRef.current) videoRef.current.muted = muted }, [muted])
  const offline = room.status !== 'live' || (ch.lastMediaAt > 0 && Date.now() - ch.lastMediaAt > 15000) || (ch.lastMediaAt === 0 && ch.seq === 0)
  return (
    <div className={cls('overflow-hidden bg-black', className)}>
      {ch.frame && <img src={`data:image/jpeg;base64,${ch.frame.frame}`} alt="" aria-hidden className="absolute inset-0 w-full h-full object-cover blur-2xl opacity-50 scale-110" />}
      {useChunks ? <video ref={videoRef} playsInline autoPlay muted className="absolute inset-0 m-auto h-full w-auto max-w-full object-contain" /> : ch.frame ? <img src={`data:image/jpeg;base64,${ch.frame.frame}`} alt="直播画面" className="absolute inset-0 m-auto h-full w-auto max-w-full object-contain" /> : null}
      {offline && !ch.frame && !(useChunks && mse.ready && ch.lastMediaAt > 0) && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-white/80 gap-2 bg-black/40">
          <img src={thumb(room.cover)} alt="" aria-hidden className="absolute inset-0 w-full h-full object-cover blur-xl opacity-40 -z-10" />
          <WifiOff className="w-8 h-8" /><div className="text-sm">{room.status === 'live' ? '主播画面连接中…' : room.status === 'ended' ? '直播已结束' : '直播未开始'}</div>
        </div>
      )}
      {useChunks && !preview && <button onClick={() => setMuted(m => !m)} aria-label={muted ? '取消静音' : '静音'} className="absolute top-3 right-3 z-10 w-9 h-9 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70">{muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}</button>}
      <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/60 to-transparent pointer-events-none" />
      {caption}
    </div>
  )
}

export function LiveBadge({ n, className }: { n: number; className?: string }) {
  return <span className={cls('inline-flex items-center gap-1 rounded-md bg-black/55 text-white text-[11px] px-1.5 py-0.5 backdrop-blur-sm', className)}><span className="inline-flex gap-[2px] items-end h-2.5"><i className="w-[2px] bg-brand-400 animate-eq1 h-full" /><i className="w-[2px] bg-brand-400 animate-eq2 h-full" /><i className="w-[2px] bg-brand-400 animate-eq3 h-full" /></span>{n >= 10000 ? `${(n / 10000).toFixed(2)}万` : n}观看</span>
}
