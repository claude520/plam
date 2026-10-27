import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useDB } from '@/store/db'
import { Img, PageHeader, Stat, Table, Tabs, SearchInput, Confirm, type Column } from '@/components/ui'
import type { LiveRoom } from '@/data/types'
import { compact, fmtDate, money } from '@/lib/format'
import { toast } from '@/store/session'

export function Lives() {
  const { lives, shops, updateLive, removeLive, endLive, log } = useDB()
  const [tab, setTab] = useState<'all' | 'live' | 'scheduled' | 'ended'>('all')
  const [q, setQ] = useState('')
  const [stop, setStop] = useState<LiveRoom | null>(null)
  const list = useMemo(() => lives.filter(l => (tab === 'all' || l.status === tab) && (!q || l.title.includes(q) || shops.find(s => s.id === l.shopId)?.name.includes(q))), [lives, tab, q, shops])
  const cols: Column<LiveRoom>[] = [
    { key: 'room', title: '直播间', render: l => <div className="flex items-center gap-2"><Img src={l.cover} alt="" w={60} h={80} className="w-9 h-12 rounded object-cover" /><div><div className="font-medium">{l.title}</div><div className="text-xs text-ink-400">{shops.find(s => s.id === l.shopId)?.name}{l.demo && ' · 演示'}</div></div></div> },
    { key: 'status', title: '状态', render: l => <span className={l.status === 'live' ? 'tag-red' : l.status === 'scheduled' ? 'tag-gold' : 'tag-gray'}>{l.status === 'live' ? '直播中' : l.status === 'scheduled' ? '预告' : '已结束'}</span> },
    { key: 'time', title: '时间', render: l => <span className="text-xs font-num">{fmtDate(l.startedAt ?? l.plannedAt)}</span> },
    { key: 'vis', title: '可见', render: l => l.visibility === 'all' ? '公开' : l.visibility === 'private' ? '私域' : '试播' },
    { key: 'stats', title: '数据', render: l => <span className="text-xs">观看 {compact(l.stats.views)} · 在线 {compact(l.stats.viewers)} · 成交 ¥{money(l.stats.gmv, 0)}</span> },
    { key: 'goods', title: '商品', render: l => l.productIds.length },
    { key: 'ops', title: '操作', render: l => <div className="flex gap-2 text-xs"><Link to={`/live/${l.id}`} className="link">查看</Link>{l.status === 'live' && <button onClick={() => setStop(l)} className="text-brand-500">强制下播</button>}{l.visibility === 'all' ? <button onClick={() => { updateLive(l.id, { visibility: 'private' }); log('admin', '直播隐藏', l.id); toast('已从直播广场隐藏') }} className="text-ink-500">隐藏</button> : <button onClick={() => { updateLive(l.id, { visibility: 'all' }); toast('已公开') }} className="text-ink-500">公开</button>}{l.status !== 'live' && <button onClick={() => { removeLive(l.id); log('admin', '删除直播', l.id); toast('已删除') }} className="text-ink-400">删除</button>}</div> },
  ]
  return (
    <div>
      <PageHeader title="直播管理" desc="全平台直播间监管：下播、隐藏、删除" />
      <div className="grid grid-cols-4 max-md:!grid-cols-2 gap-3 mb-4"><Stat label="直播中" value={lives.filter(l => l.status === 'live').length} accent="text-brand-500" /><Stat label="预告中" value={lives.filter(l => l.status === 'scheduled').length} /><Stat label="当前总在线" value={compact(lives.reduce((a, l) => a + l.stats.viewers, 0))} /><Stat label="直播累计成交" value={`¥${money(lives.reduce((a, l) => a + l.stats.gmv, 0), 0)}`} /></div>
      <div className="card p-4">
        <div className="flex items-center justify-between flex-wrap gap-2 mb-3"><Tabs accent="qn" items={[{ key: 'all', label: '全部' }, { key: 'live', label: '直播中' }, { key: 'scheduled', label: '预告' }, { key: 'ended', label: '已结束' }]} value={tab} onChange={setTab} /><SearchInput value={q} onChange={setQ} placeholder="搜索标题 / 店铺" /></div>
        <Table columns={cols} data={list} />
      </div>
      <Confirm open={!!stop} onClose={() => setStop(null)} onOk={() => { if (stop) { endLive(stop.id, {}); log('admin', '强制下播', stop.id); toast('已强制下播') } setStop(null) }} title="强制下播" desc={`确定结束「${stop?.title}」的直播吗？`} danger />
    </div>
  )
}
