import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Calendar, List, Radio, Pencil, Trash2, Link2, BarChart3, ChevronLeft, ChevronRight, Search } from 'lucide-react'
import { useDB } from '@/store/db'
import { Img, Empty, Confirm } from '@/components/ui'
import type { LiveRoom } from '@/data/types'
import { LiveForm, useMyLives, LIVE_STATUS } from './common'
import { cls, fmtDate, compact, money, liveNo } from '@/lib/format'
import { toast } from '@/store/session'

function Row({ l, onEdit, onDel }: { l: LiveRoom; onEdit: () => void; onDel: () => void }) {
  const copy = () => navigator.clipboard?.writeText(`${location.origin}/live/${l.id}`).then(() => toast('直播间链接已复制'))
  return (
    <div className="flex gap-4 p-4 border-b border-ink-100 last:border-0 items-center flex-wrap">
      <div className="w-16 h-20 rounded-lg overflow-hidden bg-ink-100 shrink-0"><Img src={l.cover} alt="" w={120} h={160} className="w-full h-full object-cover" /></div>
      <div className="flex-1 min-w-[200px]">
        <div className="flex items-center gap-2"><span className={LIVE_STATUS[l.status].cls}>{LIVE_STATUS[l.status].label}</span><span className="font-medium">{l.title}</span>{l.trailer && l.status === 'scheduled' && <span className="tag-blue">已发预告</span>}{l.visibility !== 'all' && <span className="tag-gray">{l.visibility === 'private' ? '私域' : '试播'}</span>}</div>
        <div className="text-xs text-ink-500 mt-1.5 flex items-center gap-3 flex-wrap"><span>ID {liveNo(l.id)}</span><span>{l.status === 'scheduled' ? `计划 ${fmtDate(l.plannedAt)}` : `开播 ${fmtDate(l.startedAt)}`}</span>{l.status === 'ended' && <span>时长 {l.stats.duration} 分钟</span>}<span>{l.productIds.length} 件商品</span><span>{l.type === 'vertical' ? '竖屏' : '横屏'}</span></div>
        {l.status !== 'scheduled' && <div className="text-xs text-ink-600 mt-1.5 flex items-center gap-3 flex-wrap"><span>观看 {compact(l.stats.views)}</span><span>最高在线 {compact(l.stats.peak)}</span><span>点赞 {compact(l.stats.likes)}</span><span>成交 ¥{money(l.stats.gmv)}</span><span>订单 {l.stats.orders}</span><span>新增粉丝 {l.stats.newFans}</span></div>}
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        {l.status === 'live' && <Link to={`/seller/live/studio/${l.id}`} className="btn-primary btn-sm h-8 gap-1"><Radio className="w-3.5 h-3.5" />进入中控台</Link>}
        {l.status === 'scheduled' && <Link to={`/seller/live/studio/${l.id}`} className="btn-primary btn-sm h-8 gap-1"><Radio className="w-3.5 h-3.5" />开播</Link>}
        {l.status === 'ended' && <Link to={`/seller/live/data/live?id=${l.id}`} className="btn-outline btn-sm h-8 gap-1"><BarChart3 className="w-3.5 h-3.5" />查看数据</Link>}
        {l.status !== 'ended' && <button onClick={onEdit} className="btn-outline btn-sm h-8 gap-1"><Pencil className="w-3.5 h-3.5" />编辑</button>}
        <button onClick={copy} className="btn-ghost btn-sm h-8 gap-1"><Link2 className="w-3.5 h-3.5" />链接</button>
        {l.status !== 'live' && <button onClick={onDel} className="btn-ghost btn-sm h-8 gap-1 text-ink-500"><Trash2 className="w-3.5 h-3.5" />删除</button>}
      </div>
    </div>
  )
}

export function LivePlan() {
  const lives = useMyLives()
  const removeLive = useDB(s => s.removeLive)
  const [mode, setMode] = useState<'list' | 'calendar'>('list')
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('all')
  const [create, setCreate] = useState(false)
  const [edit, setEdit] = useState<LiveRoom | null>(null)
  const [del, setDel] = useState<LiveRoom | null>(null)
  const [month, setMonth] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1) })
  const list = useMemo(() => lives.filter(l => (status === 'all' || l.status === status) && (!q || l.title.includes(q) || l.id.includes(q))), [lives, status, q])
  const first = month.getDay(), dim = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()
  const byDay = (d: number) => lives.filter(l => { const t = new Date(l.startedAt ?? l.plannedAt); return t.getFullYear() === month.getFullYear() && t.getMonth() === month.getMonth() && t.getDate() === d })
  return (
    <div className="max-w-[1260px]">
      <div className="flex items-center justify-between flex-wrap gap-3"><h1 className="text-xl font-semibold">直播计划</h1><div className="flex items-center gap-2"><Link to="/seller/live/trailer" className="btn-outline">预告管理</Link><button onClick={() => setCreate(true)} className="btn-primary">创建直播</button></div></div>
      <div className="mt-5 flex items-center justify-between flex-wrap gap-3">
        <div className="font-semibold">{mode === 'list' ? '列表模式' : '日历模式'}</div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative"><Search className="w-4 h-4 text-ink-400 absolute left-2.5 top-1/2 -translate-y-1/2" /><input value={q} onChange={e => setQ(e.target.value)} placeholder="输入ID或标题筛选" className="input-qn pl-8 w-44" /></div>
          <select value={status} onChange={e => setStatus(e.target.value)} className="input-qn w-28"><option value="all">全部</option><option value="scheduled">未开播</option><option value="live">直播中</option><option value="ended">已结束</option></select>
          <button onClick={() => setMode(m => m === 'list' ? 'calendar' : 'list')} className="btn-outline gap-1">{mode === 'list' ? <><Calendar className="w-4 h-4" />日历模式</> : <><List className="w-4 h-4" />列表模式</>}</button>
        </div>
      </div>
      <div className="card mt-4">
        {mode === 'list' ? (list.length ? list.map(l => <Row key={l.id} l={l} onEdit={() => setEdit(l)} onDel={() => setDel(l)} />) : <div className="py-16"><Empty text="还没有有效的直播场次" /><div className="text-center mt-3"><button onClick={() => setCreate(true)} className="btn-primary">创建直播</button></div></div>) : (
          <div className="p-4">
            <div className="flex items-center justify-center gap-4 mb-3"><button aria-label="上月" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} className="p-1 rounded hover:bg-ink-100"><ChevronLeft className="w-4 h-4" /></button><span className="font-medium">{month.getFullYear()} 年 {month.getMonth() + 1} 月</span><button aria-label="下月" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} className="p-1 rounded hover:bg-ink-100"><ChevronRight className="w-4 h-4" /></button></div>
            <div className="grid grid-cols-7 keep-cols text-center text-xs text-ink-500">{['日', '一', '二', '三', '四', '五', '六'].map(d => <div key={d} className="py-2">{d}</div>)}</div>
            <div className="grid grid-cols-7 keep-cols gap-px bg-ink-100 border border-ink-100 rounded-lg overflow-hidden">
              {Array.from({ length: first }).map((_, i) => <div key={`e${i}`} className="bg-white min-h-[84px]" />)}
              {Array.from({ length: dim }).map((_, i) => { const d = i + 1; const ls = byDay(d); const today = new Date().toDateString() === new Date(month.getFullYear(), month.getMonth(), d).toDateString(); return <div key={d} className="bg-white min-h-[84px] p-1.5 text-xs"><div className={cls('w-6 h-6 rounded-full flex items-center justify-center', today && 'bg-brand-500 text-white')}>{d}</div>{ls.map(l => <Link key={l.id} to={l.status === 'ended' ? `/seller/live/data/live?id=${l.id}` : `/seller/live/studio/${l.id}`} className={cls('block mt-1 rounded px-1 py-0.5 truncate', l.status === 'live' ? 'bg-brand-100 text-brand-700' : l.status === 'scheduled' ? 'bg-amber-50 text-amber-700' : 'bg-ink-100 text-ink-600')}>{fmtDate(l.startedAt ?? l.plannedAt).slice(11, 16)} {l.title}</Link>)}</div> })}
            </div>
          </div>
        )}
      </div>
      <LiveForm open={create} onClose={() => setCreate(false)} />
      {edit && <LiveForm open onClose={() => setEdit(null)} edit={edit} />}
      <Confirm open={!!del} onClose={() => setDel(null)} onOk={() => { if (del) { removeLive(del.id); toast('已删除') } setDel(null) }} title="删除直播场次" desc={`确定删除「${del?.title}」吗？`} danger />
    </div>
  )
}

export function LiveTrailer() {
  const lives = useMyLives()
  const { updateLive, removeLive } = useDB()
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('all')
  const [create, setCreate] = useState(false)
  const [edit, setEdit] = useState<LiveRoom | null>(null)
  const list = lives.filter(l => l.trailer && (status === 'all' ? true : status === 'pending' ? l.status === 'scheduled' : l.status !== 'scheduled') && (!q || l.id.includes(q) || l.title.includes(q)))
  return (
    <div className="max-w-[1260px]">
      <div className="flex items-center justify-between flex-wrap gap-3"><h1 className="text-xl font-semibold">直播预告</h1><div className="flex items-center gap-2"><div className="relative"><input value={q} onChange={e => setQ(e.target.value)} placeholder="请输入预告ID查询" className="input-qn w-52 pr-8" /><Search className="w-4 h-4 text-ink-400 absolute right-2.5 top-1/2 -translate-y-1/2" /></div><select value={status} onChange={e => setStatus(e.target.value)} className="input-qn w-28"><option value="all">全部</option><option value="pending">待开播</option><option value="done">已开播</option></select><button onClick={() => setCreate(true)} className="btn-primary">创建预告</button></div></div>
      <div className="card mt-5">
        {list.length ? list.map(l => (
          <div key={l.id} className="flex gap-4 p-4 border-b border-ink-100 last:border-0 items-center flex-wrap">
            <div className="w-16 h-20 rounded-lg overflow-hidden bg-ink-100 shrink-0"><Img src={l.cover} alt="" w={120} h={160} className="w-full h-full object-cover" /></div>
            <div className="flex-1 min-w-[200px]"><div className="flex items-center gap-2"><span className={l.status === 'scheduled' ? 'tag-gold' : l.status === 'live' ? 'tag-red' : 'tag-gray'}>{l.status === 'scheduled' ? '预告中' : l.status === 'live' ? '已开播' : '已结束'}</span><span className="font-medium">{l.title}</span></div><div className="text-xs text-ink-500 mt-1.5">预告ID {liveNo(l.id)} · 开播时间 {fmtDate(l.plannedAt)} · 预约 {compact(Math.round(l.stats.views / 10) + l.productIds.length * 37)} 人</div></div>
            <div className="flex items-center gap-2">{l.status === 'scheduled' && <><Link to={`/live/${l.id}`} className="btn-outline btn-sm h-8">预览</Link><button onClick={() => setEdit(l)} className="btn-outline btn-sm h-8">编辑</button><button onClick={() => { updateLive(l.id, { trailer: false }); toast('已取消预告') }} className="btn-ghost btn-sm h-8">取消预告</button></>}{l.status !== 'scheduled' && <button onClick={() => { removeLive(l.id); toast('已删除') }} className="btn-ghost btn-sm h-8">删除</button>}</div>
          </div>
        )) : <div className="py-16"><Empty text="暂无预告场次" /><div className="text-center text-sm text-ink-500 mt-2">点击右上角"创建预告"，创建第一场预告吧</div></div>}
      </div>
      <LiveForm open={create} onClose={() => setCreate(false)} trailerOnly />
      {edit && <LiveForm open onClose={() => setEdit(null)} edit={edit} trailerOnly />}
    </div>
  )
}
