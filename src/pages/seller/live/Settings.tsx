import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Plus, X } from 'lucide-react'
import { useDB } from '@/store/db'
import { Switch, Field } from '@/components/ui'
import type { LiveConfig } from '@/data/types'
import { useMyLiveConfig } from './common'
import { cls } from '@/lib/format'
import { toast } from '@/store/session'

const TABS = [['room', '直播间设置'], ['channel', '透出渠道'], ['comment', '评论设置'], ['goods', '商品设置'], ['push', '自动推品'], ['gift', '送礼设置']] as const
type Tab = typeof TABS[number][0]

function Radio({ value, onChange, label, desc }: { value: boolean; onChange: (v: boolean) => void; label: string; desc: string }) {
  return (
    <div className="py-5 border-b border-ink-100 last:border-0">
      <div className="flex items-center gap-2 flex-wrap"><span className="font-medium">{label}</span><span className="text-xs text-ink-500">{desc}</span></div>
      <div className="mt-3 flex items-center gap-6 text-sm">{[[true, '开启'], [false, '关闭']].map(([v, l]) => <label key={String(v)} className="flex items-center gap-1.5 cursor-pointer"><span className={cls('w-4 h-4 rounded-full border-[5px]', value === v ? 'border-ink-900' : 'border-ink-300 bg-white')} onClick={() => onChange(v as boolean)} />{l as string}</label>)}</div>
    </div>
  )
}

function ListEditor({ title, desc, items, onChange, placeholder, btn = '添加' }: { title: string; desc: string; items: string[]; onChange: (v: string[]) => void; placeholder: string; btn?: string }) {
  const [v, setV] = useState('')
  return (
    <div className="py-5 border-b border-ink-100 last:border-0">
      <div className="flex items-center gap-2 flex-wrap"><span className="font-medium">{title}</span><span className="text-xs text-ink-500">{desc}</span></div>
      <div className="mt-3 flex flex-wrap gap-2">{items.map((it, i) => <span key={i} className="flex items-center gap-1 rounded-md bg-ink-50 px-2.5 h-8 text-sm">{it}<button aria-label="删除" onClick={() => onChange(items.filter((_, j) => j !== i))}><X className="w-3.5 h-3.5 text-ink-400" /></button></span>)}
        <div className="flex items-center gap-1"><input value={v} onChange={e => setV(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && v.trim()) { onChange([...items, v.trim()]); setV('') } }} placeholder={placeholder} className="input-qn h-8 w-48 text-sm" /><button onClick={() => { if (v.trim()) { onChange([...items, v.trim()]); setV('') } }} className="btn-outline btn-sm h-8 gap-1"><Plus className="w-3.5 h-3.5" />{btn}</button></div></div>
    </div>
  )
}

export function LiveSettings() {
  const [sp] = useSearchParams()
  const base = useMyLiveConfig()
  const upsert = useDB(s => s.upsertLiveConfig)
  const [tab, setTab] = useState<Tab>((sp.get('tab') as Tab) || 'room')
  const [cfg, setCfg] = useState<LiveConfig>(base)
  useEffect(() => { setCfg(base) }, [base])
  const set = (patch: Partial<LiveConfig>) => { const n = { ...cfg, ...patch }; setCfg(n); upsert(n) }
  const [qa, setQa] = useState({ q: '', a: '' })
  return (
    <div className="max-w-[1260px]">
      <h1 className="text-xl font-semibold">直播设置</h1>
      <div className="mt-4 flex items-center gap-6 border-b border-ink-200 overflow-x-auto no-scrollbar">{TABS.map(([k, l]) => <button key={k} onClick={() => setTab(k)} className={cls('relative pb-3 text-[15px] whitespace-nowrap', tab === k ? 'font-semibold text-ink-900 after:absolute after:left-0 after:right-0 after:bottom-0 after:h-0.5 after:bg-ink-900' : 'text-ink-600 hover:text-ink-900')}>{l}</button>)}</div>
      <div className="card mt-4 px-5">
        {tab === 'room' && <>
          <div className="py-5 border-b border-ink-100"><div className="flex items-center gap-2 flex-wrap"><span className="font-medium">店铺客服设置</span><span className="text-xs text-ink-500">您可以绑定客服店铺，方便在直播中和主播个人主页进行售前的售后客服的承接</span></div><div className="mt-3 text-sm flex items-center gap-3"><span className="font-medium">已绑定客服</span><a href="/seller/service" className="link">去修改</a></div></div>
          <div className="py-5 border-b border-ink-100 grid grid-cols-2 max-md:!grid-cols-1 gap-4"><Field label="主播昵称" hint="直播间左上角展示"><input value={cfg.nickname} onChange={e => set({ nickname: e.target.value.slice(0, 20) })} className="input-qn" /></Field><Field label="直播间介绍" hint="观众进入直播间时展示的欢迎语"><input value={cfg.intro} onChange={e => set({ intro: e.target.value.slice(0, 80) })} className="input-qn" /></Field></div>
          <Radio value={cfg.aiCard} onChange={v => set({ aiCard: v })} label="AI手卡" desc="开启后，直播讲解时将展示商品的AI手卡，可直接查看使用，无需提前生成和保存手卡" />
          <Radio value={cfg.strategy} onChange={v => set({ strategy: v })} label="播中策略建议" desc="开启后，直播过程中将根据实时数据为您推送个性化货品建议" />
          {cfg.strategy && <div className="pb-5 -mt-2 text-sm"><div className="text-ink-700 flex items-center gap-2">↳ <span className="font-medium">建议类型</span><span className="text-xs text-ink-500">您可按需选择需要的建议类型，关闭后该类型建议将不再为您推送</span></div><label className="mt-2 ml-5 flex items-center gap-1.5"><input type="checkbox" defaultChecked className="accent-brand-500" />流量券建议</label></div>}
          <div className="py-5 border-b border-ink-100"><div className="font-medium">推流画质</div><div className="mt-3 flex items-center gap-3 text-sm flex-wrap">{(['low', 'mid', 'high'] as const).map(qv => <button key={qv} onClick={() => set({ quality: qv })} className={cls('rounded-lg border px-4 py-2', cfg.quality === qv ? 'border-brand-500 bg-brand-50 text-brand-600' : 'border-ink-200')}>{qv === 'low' ? '流畅 (约 220kbps)' : qv === 'mid' ? '标清 (约 420kbps)' : '高清 (约 800kbps)'}</button>)}</div><div className="text-xs text-ink-500 mt-2">PC 开播时浏览器会按此码率编码，网络较差时请选择流畅</div></div>
        </>}
        {tab === 'channel' && <>
          {([['search', '搜索', '直播间可被淘宝搜索、直播广场搜索召回'], ['feed', '推荐信息流', '首页猜你喜欢、直播广场推荐位透出'], ['shop', '店铺首页', '店铺首页顶部直播入口'], ['detail', '商品详情页', '货盘内商品详情页展示"直播中"入口'], ['outside', '站外分享', '允许复制链接分享到站外']] as const).map(([k, l, d]) => <div key={k} className="py-5 border-b border-ink-100 last:border-0 flex items-center gap-3"><div className="flex-1"><div className="font-medium">{l}</div><div className="text-xs text-ink-500 mt-1">{d}</div></div><Switch checked={cfg.channels[k]} onChange={v => set({ channels: { ...cfg.channels, [k]: v } })} accent="brand" /></div>)}
        </>}
        {tab === 'comment' && <>
          <Radio value={cfg.aiReply} onChange={v => set({ aiReply: v })} label="AI直播间问答助手" desc="开启后，AI问答助手将会对消费者评论进行回复。AI回复的内容可以在评论区-AI助理查看" />
          <Radio value={cfg.hideNames} onChange={v => set({ hideNames: v })} label="直播间隐藏用户信息" desc="对于直播间参与评论的消费者昵称做脱敏展示，如张三展示为张**" />
          <div className="py-5 border-b border-ink-100"><div className="flex items-center gap-2 flex-wrap"><span className="font-medium">自动回复</span><span className="text-xs text-ink-500">预设评论语句和自动回复内容，当消费者评论与预设语义相似时，自动回复您设置的回复内容</span></div>
            <div className="mt-3 space-y-2">{cfg.autoReplies.map((r, i) => <div key={i} className="flex items-center gap-2 text-sm"><span className="rounded bg-ink-50 px-2 py-1">问：{r.q}</span><span className="rounded bg-brand-50 text-brand-700 px-2 py-1 flex-1 truncate">答：{r.a}</span><button aria-label="删除" onClick={() => set({ autoReplies: cfg.autoReplies.filter((_, j) => j !== i) })}><X className="w-4 h-4 text-ink-400" /></button></div>)}
              <div className="flex items-center gap-2 flex-wrap"><input value={qa.q} onChange={e => setQa({ ...qa, q: e.target.value })} placeholder="触发关键词，如：发货" className="input-qn h-8 w-40 text-sm" /><input value={qa.a} onChange={e => setQa({ ...qa, a: e.target.value })} placeholder="自动回复内容" className="input-qn h-8 flex-1 min-w-[200px] text-sm" /><button onClick={() => { if (!qa.q || !qa.a) return; set({ autoReplies: [...cfg.autoReplies, qa] }); setQa({ q: '', a: '' }) }} className="btn-outline btn-sm h-8">设置回复</button></div></div></div>
          <ListEditor title="快捷评论" desc="设置需要快捷回复内容，在直播间评论区输入 / 后可直接选择您设置的快捷回复" items={cfg.quickReplies} onChange={v => set({ quickReplies: v })} placeholder="快捷回复内容" btn="设置回复" />
          <ListEditor title="关键词屏蔽" desc="设置需要被屏蔽的关键词，含关键词的评论将在直播过程中屏蔽" items={cfg.blockWords} onChange={v => set({ blockWords: v })} placeholder="关键词" btn="设置关键词" />
          <div className="py-5 border-b border-ink-100"><div className="flex items-center gap-2 flex-wrap"><span className="font-medium">禁言用户管理</span><span className="text-xs text-ink-500">管理被单场和永久禁言的粉丝</span></div><div className="mt-3 text-sm text-ink-600">{cfg.mutedUsers.length ? <div className="flex flex-wrap gap-2">{cfg.mutedUsers.map(u => <span key={u} className="rounded bg-ink-50 px-2 py-1 flex items-center gap-1">{u}<button aria-label="解除" onClick={() => set({ mutedUsers: cfg.mutedUsers.filter(x => x !== u) })}><X className="w-3.5 h-3.5 text-ink-400" /></button></span>)}</div> : '暂无禁言用户，可在中控台评论区对用户禁言'}</div></div>
          <div className="py-5"><div className="flex items-center gap-2 flex-wrap"><span className="font-medium">直播间介绍</span><span className="text-xs text-ink-500">为您提供直播间打招呼的能力，您可以自定义内容或开启AI介绍您直播间的特色与精彩内容</span></div><div className="mt-3 flex gap-2"><input value={cfg.intro} onChange={e => set({ intro: e.target.value.slice(0, 80) })} className="input-qn flex-1" /><button onClick={() => set({ intro: `欢迎来到${cfg.nickname}，今天全场直播专享价，关注主播整点抽免单～` })} className="btn-outline">AI生成</button></div></div>
        </>}
        {tab === 'goods' && <>
          {([['showPrice', '展示直播专享价', '商品卡片展示划线原价与直播价'], ['showSales', '展示销量', '商品卡片展示已售件数，营造氛围']] as const).map(([k, l, d]) => <div key={k} className="py-5 border-b border-ink-100 flex items-center gap-3"><div className="flex-1"><div className="font-medium">{l}</div><div className="text-xs text-ink-500 mt-1">{d}</div></div><Switch checked={cfg.goods[k]} onChange={v => set({ goods: { ...cfg.goods, [k]: v } })} accent="brand" /></div>)}
          <div className="py-5 text-sm text-ink-600">商品讲解、置顶与上下架请在直播中控台「商品」面板操作。</div>
        </>}
        {tab === 'push' && <>
          <div className="py-5 border-b border-ink-100 flex items-center gap-3"><div className="flex-1"><div className="font-medium">自动推品</div><div className="text-xs text-ink-500 mt-1">开播后按设定间隔自动轮播讲解货盘商品，主播无需手动操作</div></div><Switch checked={cfg.goods.autoPush} onChange={v => set({ goods: { ...cfg.goods, autoPush: v } })} accent="brand" /></div>
          <div className="py-5"><div className="font-medium">推品间隔</div><div className="mt-3 flex items-center gap-3 text-sm">{[3, 5, 10, 15].map(n => <button key={n} onClick={() => set({ goods: { ...cfg.goods, pushInterval: n } })} className={cls('rounded-lg border px-4 py-2', cfg.goods.pushInterval === n ? 'border-brand-500 bg-brand-50 text-brand-600' : 'border-ink-200')}>{n} 分钟</button>)}</div></div>
        </>}
        {tab === 'gift' && <>
          <Radio value={cfg.gift} onChange={v => set({ gift: v })} label="直播间送礼" desc="开启后观众可在直播间送出小心心等虚拟礼物（打赏型主播适用）" />
          <div className="py-5 text-sm text-ink-600">礼物收益按平台规则结算，演示环境仅展示动效。</div>
        </>}
      </div>
      <div className="mt-3 text-xs text-ink-400">设置自动保存 · <button onClick={() => toast('已同步至直播间')} className="link">同步至直播中</button></div>
    </div>
  )
}
