// 直播实时通道：事件（评论/点赞/讲解…）+ 媒体（webm 分片 / JPEG 关键帧）
// 线上走 /api/live/*（D1）；无后端时降级为 BroadcastChannel + localStorage（同一浏览器多标签页可联调）。
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useDB } from '@/store/db'

export type LiveEventType = 'comment' | 'like' | 'enter' | 'explain' | 'notice' | 'flash' | 'coupon' | 'mute' | 'pin' | 'start' | 'end' | 'pause' | 'resume' | 'host' | 'follow' | 'order' | 'gift'
export interface LiveEvent { id: number; type: LiveEventType; ts: number; uid?: string; name?: string; avatar?: string; text?: string; n?: number; productId?: string | null; price?: number; until?: number; amount?: number; min?: number; level?: number; [k: string]: unknown }
export interface Counters { viewers: number; likes: number; comments: number; peak: number }
interface PollResult { events: LiveEvent[]; viewers: number; likes: number; comments: number; peak: number; seq: number; mime: string | null; chunks: { seq: number; chunk: string; mime: string; ts: number }[]; frame: { seq: number; frame: string; ts: number } | null; now: number }
interface Transport {
  poll(roomId: string, p: { after: number; media: number; frame: boolean; cid: string; uid?: string; hb: boolean }): Promise<PollResult>
  event(roomId: string, type: LiveEventType, data: Record<string, unknown>): Promise<void>
  media(roomId: string, seq: number, chunk?: string, frame?: string, mime?: string): Promise<void>
}

const remote: Transport = {
  async poll(roomId, p) {
    const q = new URLSearchParams({ after: String(p.after), media: String(p.media), frame: p.frame ? '1' : '0', cid: p.cid, hb: p.hb ? '1' : '0' })
    if (p.uid) q.set('uid', p.uid)
    const r = await fetch(`/api/live/${roomId}/poll?${q}`, { headers: { 'cache-control': 'no-cache' } })
    if (!r.ok) throw new Error(String(r.status))
    return r.json()
  },
  async event(roomId, type, data) { await fetch(`/api/live/${roomId}/event`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ type, data }) }) },
  async media(roomId, seq, chunk, frame, mime) { await fetch(`/api/live/${roomId}/media`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ seq, chunk, frame, mime }) }) },
}

// ---- 本地降级：BroadcastChannel + localStorage ----
type LocalRoom = { events: LiveEvent[]; nextId: number; likes: number; comments: number; peak: number; seq: number; mime: string | null; chunks: { seq: number; chunk: string; mime: string; ts: number }[]; frame: { seq: number; frame: string; ts: number } | null; viewers: Record<string, number> }
const localRooms: Record<string, LocalRoom> = {}
const bc = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('plam-live') : null
const lkey = (id: string) => `plam-live-${id}`
function localRoom(id: string): LocalRoom {
  if (!localRooms[id]) {
    let saved: Partial<LocalRoom> = {}
    try { saved = JSON.parse(localStorage.getItem(lkey(id)) || '{}') } catch { /* ignore */ }
    localRooms[id] = { events: saved.events ?? [], nextId: saved.nextId ?? 1, likes: saved.likes ?? 0, comments: saved.comments ?? 0, peak: saved.peak ?? 0, seq: 0, mime: null, chunks: [], frame: null, viewers: {} }
  }
  return localRooms[id]
}
function localSave(id: string) {
  const r = localRoom(id)
  try { localStorage.setItem(lkey(id), JSON.stringify({ events: r.events.slice(-200), nextId: r.nextId, likes: r.likes, comments: r.comments, peak: r.peak })) } catch { /* ignore */ }
}
bc?.addEventListener('message', (e: MessageEvent) => {
  const m = e.data as { room: string; kind: 'event' | 'media' | 'hb'; ev?: LiveEvent; seq?: number; chunk?: string; frame?: string; mime?: string; cid?: string }
  const r = localRoom(m.room)
  if (m.kind === 'event' && m.ev) { if (!r.events.some(x => x.id === m.ev!.id)) { r.events.push(m.ev); r.nextId = Math.max(r.nextId, m.ev.id + 1); if (m.ev.type === 'comment') r.comments++; if (m.ev.type === 'like') r.likes += Number(m.ev.n ?? 1) } }
  if (m.kind === 'media') { r.seq = m.seq!; r.mime = m.mime ?? r.mime; if (m.chunk) { r.chunks.push({ seq: m.seq!, chunk: m.chunk, mime: m.mime ?? '', ts: Date.now() }); r.chunks = r.chunks.slice(-8) } if (m.frame) r.frame = { seq: m.seq!, frame: m.frame, ts: Date.now() } }
  if (m.kind === 'hb' && m.cid) r.viewers[m.cid] = Date.now()
})
const local: Transport = {
  async poll(roomId, p) {
    const r = localRoom(roomId)
    if (p.hb) { r.viewers[p.cid] = Date.now(); bc?.postMessage({ room: roomId, kind: 'hb', cid: p.cid }) }
    const viewers = Object.values(r.viewers).filter(t => t > Date.now() - 45000).length
    r.peak = Math.max(r.peak, viewers)
    const chunks = p.frame ? [] : p.media >= 0 ? r.chunks.filter(c => c.seq > p.media).slice(0, 4) : r.chunks.slice(-2)
    return { events: r.events.filter(e => e.id > p.after).slice(0, 200), viewers, likes: r.likes, comments: r.comments, peak: r.peak, seq: r.seq, mime: r.mime, chunks, frame: p.frame ? r.frame : null, now: Date.now() }
  },
  async event(roomId, type, data) {
    const r = localRoom(roomId)
    const ev = { id: r.nextId++, type, ts: Date.now(), ...data } as LiveEvent
    r.events.push(ev)
    if (type === 'comment') r.comments++
    if (type === 'like') r.likes += Number(data.n ?? 1)
    if (type === 'start') { r.likes = 0; r.comments = 0; r.peak = 0; r.chunks = []; r.frame = null; r.seq = 0 }
    localSave(roomId)
    bc?.postMessage({ room: roomId, kind: 'event', ev })
  },
  async media(roomId, seq, chunk, frame, mime) {
    const r = localRoom(roomId)
    r.seq = seq; r.mime = mime ?? r.mime
    if (chunk) { r.chunks.push({ seq, chunk, mime: mime ?? '', ts: Date.now() }); r.chunks = r.chunks.slice(-8) }
    if (frame) r.frame = { seq, frame, ts: Date.now() }
    bc?.postMessage({ room: roomId, kind: 'media', seq, chunk, frame, mime })
  },
}

export const transport = (): Transport => (useDB.getState()._remote ? remote : local)

export const clientId = (() => {
  let id = ''
  return () => {
    if (id) return id
    try { id = sessionStorage.getItem('plam-live-cid') || ''; if (!id) { id = Math.random().toString(36).slice(2, 10); sessionStorage.setItem('plam-live-cid', id) } } catch { id = Math.random().toString(36).slice(2, 10) }
    return id
  }
})()

export const CHUNK_MS = 2000
export const MIME_CANDIDATES = ['video/webm;codecs=vp8,opus', 'video/webm;codecs=vp9,opus', 'video/webm', 'video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'video/mp4']
export const MIME_VIDEO_ONLY = ['video/webm;codecs=vp8', 'video/webm;codecs=vp9', 'video/webm', 'video/mp4;codecs=avc1.42E01E', 'video/mp4']
export const canPlayChunks = (mime: string | null) => !!mime && typeof MediaSource !== 'undefined' && MediaSource.isTypeSupported(mime)

/**
 * 直播间事件通道（观众 / 主播共用）。
 * mediaMode: 'chunks' 拉取视频分片（MSE）；'frame' 拉取 JPEG 关键帧；'none' 只要事件。
 */
export function useLiveChannel(roomId: string | undefined, opts: { role: 'viewer' | 'host'; mediaMode: 'chunks' | 'frame' | 'none'; uid?: string; active?: boolean; interval?: number; noEvents?: boolean; onChunk?: (c: { seq: number; chunk: string; mime: string }) => void }) {
  const [events, setEvents] = useState<LiveEvent[]>([])
  const [counters, setCounters] = useState<Counters>({ viewers: 0, likes: 0, comments: 0, peak: 0 })
  const [frame, setFrame] = useState<{ seq: number; frame: string; ts: number } | null>(null)
  const [mime, setMime] = useState<string | null>(null)
  const [seq, setSeq] = useState(0)
  const [lastMediaAt, setLastMediaAt] = useState(0)
  const after = useRef(0)
  const media = useRef(-1)
  const tick = useRef(0)
  const onChunk = useRef(opts.onChunk)
  onChunk.current = opts.onChunk
  const active = opts.active ?? true
  const mediaMode = opts.mediaMode

  useEffect(() => { after.current = opts.noEvents ? Number.MAX_SAFE_INTEGER : 0; media.current = -1; tick.current = 0; setEvents([]); setFrame(null) }, [roomId, opts.noEvents])
  useEffect(() => {
    if (!roomId || !active) return
    let stop = false
    const run = async () => {
      if (stop) return
      try {
        const t = transport()
        const r = await t.poll(roomId, { after: after.current, media: mediaMode === 'chunks' ? media.current : -1, frame: mediaMode === 'frame', cid: clientId(), uid: opts.uid, hb: tick.current % 8 === 0 })
        tick.current++
        if (stop) return
        if (r.events.length) { after.current = r.events[r.events.length - 1].id; setEvents(prev => [...prev, ...r.events].slice(-400)) }
        setCounters({ viewers: r.viewers, likes: r.likes, comments: r.comments, peak: r.peak })
        setMime(r.mime); setSeq(r.seq)
        if (r.chunks?.length) { for (const c of r.chunks) { media.current = Math.max(media.current, c.seq); onChunk.current?.(c) } setLastMediaAt(Date.now()) }
        else if (mediaMode === 'chunks' && media.current < 0 && r.seq > 0) media.current = r.seq
        if (r.frame) { setFrame(prev => prev?.seq === r.frame!.seq ? prev : r.frame); setLastMediaAt(Date.now()) }
      } catch { /* 网络抖动忽略 */ }
      if (!stop) timer = window.setTimeout(run, opts.interval ?? (mediaMode === 'none' ? 2500 : 1500))
    }
    let timer = window.setTimeout(run, 50)
    return () => { stop = true; clearTimeout(timer) }
  }, [roomId, active, mediaMode, opts.uid, opts.interval])

  const send = useCallback(async (type: LiveEventType, data: Record<string, unknown> = {}) => {
    if (!roomId) return
    await transport().event(roomId, type, data)
  }, [roomId])
  const pushMedia = useCallback(async (s: number, chunk?: string, fr?: string, m?: string) => { if (roomId) await transport().media(roomId, s, chunk, fr, m) }, [roomId])
  return { events, counters, frame, mime, seq, lastMediaAt, send, pushMedia }
}

export const blobToBase64 = (b: Blob) => new Promise<string>((res, rej) => { const fr = new FileReader(); fr.onload = () => res(String(fr.result).split(',')[1] ?? ''); fr.onerror = rej; fr.readAsDataURL(b) })

/** 主播推流器：MediaRecorder 每 2 秒切一个独立 webm 文件 + 同步抓一帧 JPEG，POST 到服务端 */
export function createBroadcaster(roomId: string, opts: { quality?: 'low' | 'mid' | 'high'; onStat?: (s: { seq: number; bytes: number; mode: 'chunks' | 'frame' }) => void }) {
  let rec: MediaRecorder | null = null
  let stream: MediaStream | null = null
  let seq = 0
  let running = false
  let frameTimer: number | undefined
  let video: HTMLVideoElement | null = null
  const canvas = document.createElement('canvas')
  const bitrate = { low: 220_000, mid: 420_000, high: 800_000 }[opts.quality ?? 'mid']
  let mime: string | undefined
  const pickMime = (s: MediaStream) => (typeof MediaRecorder === 'undefined' ? undefined : (s.getAudioTracks().length ? MIME_CANDIDATES : MIME_VIDEO_ONLY).find(m => MediaRecorder.isTypeSupported(m)))

  const grabFrame = () => {
    if (!video || video.readyState < 2) return undefined
    const vw = video.videoWidth || 360, vh = video.videoHeight || 640
    const scale = Math.min(1, 420 / Math.max(vw, vh))
    canvas.width = Math.round(vw * scale); canvas.height = Math.round(vh * scale)
    canvas.getContext('2d')?.drawImage(video, 0, 0, canvas.width, canvas.height)
    return canvas.toDataURL('image/jpeg', 0.62).split(',')[1]
  }
  const cycle = () => {
    if (!running || !stream || !mime) return
    const r = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: bitrate, ...(stream.getAudioTracks().length ? { audioBitsPerSecond: 32_000 } : {}) })
    rec = r
    const mySeq = ++seq
    r.ondataavailable = async e => {
      if (!e.data || e.data.size < 100) return
      const b64 = await blobToBase64(e.data)
      const fr = grabFrame()
      transport().media(roomId, mySeq, b64, fr, mime).catch(() => { /* ignore */ })
      opts.onStat?.({ seq: mySeq, bytes: e.data.size, mode: 'chunks' })
    }
    r.onstop = () => { if (running) cycle() }
    r.start()
    window.setTimeout(() => { if (r.state !== 'inactive') r.stop() }, CHUNK_MS)
  }
  return {
    get mime() { return mime },
    get seq() { return seq },
    start(s: MediaStream, v: HTMLVideoElement) {
      stream = s; video = v; running = true; seq = 0
      mime = pickMime(s)
      if (mime) cycle()
      else frameTimer = window.setInterval(() => { const fr = grabFrame(); if (fr) { const my = ++seq; transport().media(roomId, my, undefined, fr, undefined); opts.onStat?.({ seq: my, bytes: fr.length, mode: 'frame' }) } }, 1000)
      // 无论哪种模式，每 2 秒都附带一帧 JPEG（兼容不支持 MSE 的观众端，如 iOS）；chunk 模式已在 ondataavailable 中附带
    },
    stop() { running = false; if (frameTimer) clearInterval(frameTimer); try { rec?.state !== 'inactive' && rec?.stop() } catch { /* ignore */ } rec = null },
  }
}

/** 观众端 MSE 播放器：把独立 webm 分片按 sequence 模式拼接 */
export function useMsePlayer(videoRef: React.RefObject<HTMLVideoElement | null>, mime: string | null, enabled: boolean) {
  const ms = useRef<MediaSource | null>(null)
  const sb = useRef<SourceBuffer | null>(null)
  const queue = useRef<Uint8Array[]>([])
  const [ready, setReady] = useState(false)
  const [stalled, setStalled] = useState(false)
  const lastAppend = useRef(0)

  const pump = useCallback(() => {
    const b = sb.current
    if (!b || b.updating || !queue.current.length) return
    const next = queue.current.shift()!
    try { b.appendBuffer(next as BufferSource) } catch { queue.current.unshift(next) }
  }, [])

  useEffect(() => {
    const v = videoRef.current
    if (!enabled || !v || !mime || !canPlayChunks(mime)) { setReady(false); return }
    const m = new MediaSource()
    ms.current = m
    v.src = URL.createObjectURL(m)
    const onOpen = () => {
      try {
        const b = m.addSourceBuffer(mime)
        b.mode = 'sequence'
        b.addEventListener('updateend', () => {
          pump()
          // 追帧：缓冲超过 5 秒则跳到最新
          try { const r = v.buffered; if (r.length) { const end = r.end(r.length - 1); if (end - v.currentTime > 5) v.currentTime = end - 0.8; if (v.paused) v.play().catch(() => { /* autoplay */ }) } } catch { /* ignore */ }
        })
        sb.current = b
        setReady(true)
        pump()
      } catch { setReady(false) }
    }
    m.addEventListener('sourceopen', onOpen)
    const iv = window.setInterval(() => setStalled(lastAppend.current > 0 && Date.now() - lastAppend.current > 8000), 2000)
    return () => { clearInterval(iv); m.removeEventListener('sourceopen', onOpen); try { if (m.readyState === 'open') m.endOfStream() } catch { /* ignore */ } sb.current = null; ms.current = null; queue.current = []; setReady(false); if (v) { v.removeAttribute('src'); v.load() } }
  }, [videoRef, mime, enabled, pump])

  const feed = useCallback((b64: string) => {
    const bin = atob(b64)
    const u8 = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i)
    queue.current.push(u8)
    lastAppend.current = Date.now()
    pump()
  }, [pump])
  return { ready, stalled, feed }
}

/** 直播间观众昵称脱敏：张三 -> 张** */
export const maskName = (name: string, on: boolean) => (!on || !name ? name : name.slice(0, 1) + '***')

/** 把直播事件流折叠成 UI 需要的派生状态 */
export function useLiveDerived(events: LiveEvent[], base: { explainingId?: string; notice?: string }) {
  return useMemo(() => {
    let explainingId = base.explainingId
    let notice = base.notice
    let pinned: LiveEvent | null = null
    let flash: LiveEvent | null = null
    let coupon: LiveEvent | null = null
    let paused = false
    let ended = false
    const muted = new Set<string>()
    for (const e of events) {
      if (e.type === 'explain') explainingId = (e.productId as string | null) ?? undefined
      if (e.type === 'notice') notice = e.text
      if (e.type === 'pin') pinned = e.text ? e : null
      if (e.type === 'flash') flash = e
      if (e.type === 'coupon') coupon = e
      if (e.type === 'mute' && e.uid) muted.add(e.uid)
      if (e.type === 'pause') paused = true
      if (e.type === 'resume' || e.type === 'start') { paused = false; ended = false }
      if (e.type === 'end') ended = true
    }
    if (flash && flash.until && (flash.until as number) < Date.now()) flash = null
    return { explainingId, notice, pinned: pinned as LiveEvent | null, flash: flash as LiveEvent | null, coupon: coupon as LiveEvent | null, paused, ended, muted }
  }, [events, base.explainingId, base.notice])
}
