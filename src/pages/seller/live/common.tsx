import { useMemo, useState, type ReactNode } from 'react'
import { X, Plus, Image as ImageIcon } from 'lucide-react'
import { useDB, genId } from '@/store/db'
import { useCurrentShop, useCurrentUser } from '@/lib/hooks'
import { Field, Img, Switch } from '@/components/ui'
import type { LiveRoom, LiveConfig } from '@/data/types'
import { cls, fmtDate } from '@/lib/format'
import { toast } from '@/store/session'

export const LIVE_STATUS: Record<LiveRoom['status'], { label: string; cls: string }> = { scheduled: { label: '未开播', cls: 'tag-gold' }, live: { label: '直播中', cls: 'tag-red' }, ended: { label: '已结束', cls: 'tag-gray' } }

export function useMyLives() {
  const shop = useCurrentShop()
  const lives = useDB(s => s.lives)
  return useMemo(() => lives.filter(l => l.shopId === shop.id).sort((a, b) => (b.startedAt ?? b.plannedAt).localeCompare(a.startedAt ?? a.plannedAt)), [lives, shop.id])
}

export function useMyLiveConfig(): LiveConfig {
  const shop = useCurrentShop()
  const cfgs = useDB(s => s.liveConfigs)
  return useMemo(() => cfgs.find(c => c.shopId === shop.id) ?? { shopId: shop.id, nickname: shop.name, intro: '', hideNames: true, aiReply: false, aiCard: true, strategy: true, autoReplies: [], quickReplies: [], blockWords: [], mutedUsers: [], channels: { search: true, feed: true, shop: true, detail: true, outside: false }, goods: { showPrice: true, showSales: true, autoPush: false, pushInterval: 5 }, gift: false, publicScreenAI: false, fps: 1, quality: 'mid' }, [cfgs, shop])
}

export const toLocalInput = (iso: string) => { const d = new Date(iso); const p = (n: number) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}` }

export function Drawer({ open, onClose, title, children, footer, width = 600 }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; footer?: ReactNode; width?: number }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-ink-900/40" onClick={onClose} />
      <div className="relative bg-white h-full flex flex-col shadow-pop animate-fadeUp w-full" style={{ maxWidth: width }}>
        <div className="h-14 px-5 flex items-center justify-between border-b border-ink-100"><div className="font-semibold text-base">{title}</div><button aria-label="关闭" onClick={onClose} className="p-1.5 rounded hover:bg-ink-100"><X className="w-5 h-5" /></button></div>
        <div className="flex-1 overflow-auto px-5 py-4">{children}</div>
        {footer && <div className="px-5 py-3 border-t border-ink-100 flex items-center justify-end gap-3">{footer}</div>}
      </div>
    </div>
  )
}

/** 创建 / 编辑直播（复刻「创建直播」抽屉） */
export function LiveForm({ open, onClose, edit, trailerOnly }: { open: boolean; onClose: () => void; edit?: LiveRoom; trailerOnly?: boolean }) {
  const shop = useCurrentShop()
  const user = useCurrentUser()
  const { products, upsertLive } = useDB()
  const mine = products.filter(p => p.shopId === shop.id && p.status === 'on')
  const [title, setTitle] = useState(edit?.title ?? '')
  const [autoTitle, setAutoTitle] = useState(true)
  const [covers, setCovers] = useState<string[]>(edit?.covers ?? (edit ? [edit.cover] : []))
  const [time, setTime] = useState(toLocalInput(edit?.plannedAt ?? new Date(Date.now() + 30 * 60000).toISOString()))
  const [trailer, setTrailer] = useState(edit?.trailer ?? true)
  const [type, setType] = useState<LiveRoom['type']>(edit?.type ?? 'vertical')
  const [vis, setVis] = useState<LiveRoom['visibility']>(edit?.visibility ?? 'all')
  const [loc, setLoc] = useState(edit?.showLocation ?? false)
  const [pids, setPids] = useState<string[]>(edit?.productIds ?? mine.slice(0, 6).map(p => p.id))
  const [picker, setPicker] = useState(false)
  const pickCover = (i: number) => {
    const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*'
    inp.onchange = () => { const f = inp.files?.[0]; if (!f) return; if (f.size > 2 * 1024 * 1024) return toast('封面需 2MB 以内', 'error'); const fr = new FileReader(); fr.onload = () => { const c = [...covers]; c[i] = String(fr.result); setCovers(c) }; fr.readAsDataURL(f) }
    inp.click()
  }
  const useProductCover = () => { const p = mine.find(x => pids.includes(x.id)) ?? mine[0]; if (p) setCovers(c => { const n = [...c]; n[0] = p.images[0]; return n }) }
  const submit = () => {
    if (!title.trim()) return toast('请填写直播标题', 'error')
    if (!covers[0]) return toast('请上传直播封面（或一键使用商品主图）', 'error')
    const plannedAt = new Date(time).toISOString()
    const room: LiveRoom = edit ? { ...edit, title: title.trim(), cover: covers[0], covers, plannedAt, trailer, type, visibility: vis, showLocation: loc, productIds: pids }
      : { id: `lv-${genId()}`, shopId: shop.id, hostId: user?.id ?? shop.ownerId, title: title.trim(), cover: covers[0], covers, categoryId: mine.find(p => pids.includes(p.id))?.categoryId.split('-')[0], status: 'scheduled', type, visibility: vis, plannedAt, trailer, showLocation: loc, productIds: pids, livePrices: {}, stats: { viewers: 0, views: 0, peak: 0, likes: 0, comments: 0, orders: 0, gmv: 0, newFans: 0, clicks: 0, duration: 0 }, keypoints: [] }
    upsertLive(room)
    toast(edit ? '已保存' : trailerOnly ? '预告已创建' : '直播已创建，可在直播计划中开播')
    onClose()
  }
  return (
    <Drawer open={open} onClose={onClose} title={edit ? '编辑直播' : trailerOnly ? '创建预告' : '创建直播'} footer={<><span className="text-xs text-ink-500 mr-auto">直播服务费优惠激励 <a className="link">详情</a></span><button onClick={submit} className="btn-primary">{edit ? '保存' : trailerOnly ? '创建预告' : '创建直播'}</button></>}>
      <Field label="直播封面" required>
        <div className="flex gap-3 flex-wrap">
          {[0, 1, 2].map(i => <button key={i} type="button" onClick={() => pickCover(i)} className="w-[108px] h-[96px] rounded-lg bg-ink-50 border border-dashed border-ink-200 hover:border-brand-400 flex flex-col items-center justify-center text-xs text-ink-500 overflow-hidden">{covers[i] ? <Img src={covers[i]} alt="封面" w={200} h={200} className="w-full h-full object-cover" /> : <><Plus className="w-5 h-5 mb-1" />{i === 0 ? '上传封面图' : '上传备选封面图'}<span className="text-[10px] text-ink-400">2MB以内</span></>}</button>)}
          <button type="button" onClick={useProductCover} className="self-end btn-outline btn-sm gap-1"><ImageIcon className="w-3.5 h-3.5" />用商品主图</button>
        </div>
      </Field>
      <Field label="直播标题" required>
        <div className="flex items-center gap-3"><div className="relative flex-1"><input value={title} onChange={e => setTitle(e.target.value.slice(0, 10))} placeholder="填写个独一无二的标题吧~" className="input-qn pr-14" /><span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-ink-400">{title.length} / 10</span></div><label className="flex items-center gap-1.5 text-sm text-ink-700 whitespace-nowrap"><input type="checkbox" checked={autoTitle} onChange={e => setAutoTitle(e.target.checked)} className="accent-brand-500" />播中自动优化标题</label></div>
      </Field>
      <Field label="直播时间" required><input type="datetime-local" value={time} onChange={e => setTime(e.target.value)} className="input-qn" /></Field>
      <Field label="预告信息"><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={trailer} onChange={e => setTrailer(e.target.checked)} className="accent-brand-500" />同步发布预告<span className="text-ink-300">|</span><span className="text-ink-700">{fmtDate(new Date(time).toISOString()).slice(0, 16)}</span></label></Field>
      <Field label="直播间类型"><select value={type} onChange={e => setType(e.target.value as LiveRoom['type'])} className="input-qn"><option value="vertical">竖屏</option><option value="horizontal">横屏</option></select></Field>
      <Field label="可见范围"><div className="flex items-center gap-6 text-sm flex-wrap">{([['all', '所有人可见'], ['private', '仅投放至私域'], ['trial', '试播彩排']] as const).map(([v, l]) => <label key={v} className="flex items-center gap-1.5"><input type="checkbox" checked={vis === v} onChange={() => setVis(v)} className="accent-brand-500" />{l}{v === 'trial' && <span className="text-ink-400">已添加0人</span>}</label>)}</div></Field>
      <Field label="直播商品" hint="开播前可继续在货盘管理中调整">
        <div className="flex flex-wrap gap-2">{pids.map(id => { const p = mine.find(x => x.id === id); return p ? <span key={id} className="flex items-center gap-1.5 rounded-md bg-ink-50 pl-1 pr-2 py-1 text-xs"><Img src={p.images[0]} alt="" w={60} h={60} className="w-6 h-6 rounded object-cover" /><span className="max-w-[120px] truncate">{p.title}</span><button aria-label="移除" onClick={() => setPids(pids.filter(x => x !== id))}><X className="w-3 h-3 text-ink-400" /></button></span> : null })}<button type="button" onClick={() => setPicker(v => !v)} className="btn-outline btn-sm gap-1"><Plus className="w-3.5 h-3.5" />添加商品</button></div>
        {picker && <div className="mt-2 max-h-48 overflow-auto border border-ink-200 rounded-lg divide-y divide-ink-100">{mine.filter(p => !pids.includes(p.id)).map(p => <button key={p.id} type="button" onClick={() => setPids([...pids, p.id])} className="w-full flex items-center gap-2 px-3 py-2 text-left text-xs hover:bg-ink-50"><Img src={p.images[0]} alt="" w={60} h={60} className="w-8 h-8 rounded object-cover" /><span className="flex-1 truncate">{p.title}</span><span className="price">¥{p.price}</span></button>)}</div>}
      </Field>
      <Field label="其他设置"><label className="flex items-center gap-2 text-sm"><Switch checked={loc} onChange={setLoc} accent="brand" />显示直播间位置</label></Field>
    </Drawer>
  )
}

export function Panel({ title, extra, children, className }: { title?: ReactNode; extra?: ReactNode; children: ReactNode; className?: string }) {
  return <section className={cls('card p-5', className)}>{(title || extra) && <div className="flex items-center justify-between mb-4 flex-wrap gap-2"><h2 className="font-semibold text-base">{title}</h2>{extra}</div>}{children}</section>
}

export function Metric({ label, value, sub, help }: { label: string; value: ReactNode; sub?: ReactNode; help?: boolean }) {
  return <div className="px-4 py-3"><div className="text-xs text-ink-500">{label}{help && <span className="ml-1 text-ink-300">ⓘ</span>}</div><div className="text-2xl font-num font-semibold mt-1">{value}</div>{sub && <div className="text-xs text-ink-400 mt-1">{sub}</div>}</div>
}

export function RangeTabs({ value, onChange, items = ['昨天', '近7天', '近15天', '近30天'] }: { value: string; onChange: (v: string) => void; items?: string[] }) {
  return <div className="flex border border-ink-200 rounded-md overflow-hidden text-xs">{items.map(it => <button key={it} onClick={() => onChange(it)} className={cls('px-3 h-7', value === it ? 'bg-ink-900 text-white' : 'text-ink-600 hover:bg-ink-50')}>{it}</button>)}</div>
}
