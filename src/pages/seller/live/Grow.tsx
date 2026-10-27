import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { BookOpen, Calendar, ChevronRight, Flag, Play, Sparkles, Trophy } from 'lucide-react'
import { Img } from '@/components/ui'
import { useMyLives, Panel } from './common'
import { cls, compact, fmtDate, money } from '@/lib/format'
import { toast } from '@/store/session'
import { img } from '@/data/seed'

export function Grow() {
  const lives = useMyLives()
  const ended = lives.filter(l => l.status === 'ended')
  const score = useMemo(() => Math.min(100, Math.round(ended.length * 12 + ended.reduce((a, l) => a + l.stats.duration, 0) / 30 + ended.reduce((a, l) => a + l.stats.gmv, 0) / 2000)), [ended])
  const level = score >= 80 ? 'V3' : score >= 50 ? 'V2' : 'V1'
  const dims = [['开播稳定性', Math.min(100, ended.length * 25)], ['内容质量', Math.min(100, 40 + ended.reduce((a, l) => a + l.stats.likes, 0) / 300)], ['交易能力', Math.min(100, ended.reduce((a, l) => a + l.stats.gmv, 0) / 500)], ['粉丝运营', Math.min(100, ended.reduce((a, l) => a + l.stats.newFans, 0) / 5)], ['合规经营', 100]] as const
  return (
    <div className="max-w-[1260px]">
      <h1 className="text-xl font-semibold">账号成长</h1>
      {!ended.length ? <div className="card mt-4 py-20 text-center"><div className="text-5xl">📄</div><div className="mt-3 font-semibold">成长分次日更新</div><div className="text-xs text-ink-500 mt-1">今天的开播与成交，明天即可查看最新分数</div><Link to="/seller/live/plan" className="btn-primary mt-5">去开播</Link></div> : (
        <div className="mt-4 grid grid-cols-[1fr_380px] lg-stack gap-4">
          <div className="space-y-4">
            <div className="card p-6 bg-gradient-to-r from-amber-50 to-rose-50 flex items-center gap-6 flex-wrap"><div><div className="text-xs text-ink-500">主播成长分</div><div className="text-5xl font-num font-bold mt-1">{score}</div><div className="text-xs text-ink-500 mt-1">数据更新：{fmtDate(new Date(Date.now() - 864e5).toISOString(), false)}</div></div><div className="flex items-center gap-3"><span className="tag bg-amber-400 text-white h-7 px-3 text-sm">{level}</span><span className="text-sm text-ink-600">距离下一等级还差 <b className="text-brand-500">{score >= 80 ? 0 : (score >= 50 ? 80 : 50) - score}</b> 分</span></div><button onClick={() => toast('AI 诊断：建议提高开播频次至每周 3 场，并在开播前发布预告')} className="ml-auto btn-primary gap-1"><Sparkles className="w-4 h-4" />AI成长诊断</button></div>
            <Panel title="成长维度"><div className="space-y-4">{dims.map(([l, v]) => <div key={l} className="flex items-center gap-4 text-sm"><span className="w-20 text-ink-600">{l}</span><div className="flex-1 h-2 rounded-full bg-ink-100 overflow-hidden"><div className="h-full rounded-full bg-gradient-to-r from-amber-400 to-brand-500" style={{ width: `${Math.round(v)}%` }} /></div><span className="w-10 text-right font-num">{Math.round(v)}</span></div>)}</div></Panel>
            <Panel title="近期场次"><div className="divide-y divide-ink-50">{ended.slice(0, 5).map(l => <div key={l.id} className="py-3 flex items-center gap-3 text-sm"><Img src={l.cover} alt="" w={80} h={100} className="w-10 h-12 rounded object-cover" /><div className="flex-1 min-w-0"><div className="truncate">{l.title}</div><div className="text-xs text-ink-500">{fmtDate(l.startedAt)} · {l.stats.duration} 分钟</div></div><div className="text-xs text-ink-600 text-right">观看 {compact(l.stats.views)}<br />成交 ¥{money(l.stats.gmv, 0)}</div></div>)}</div></Panel>
          </div>
          <div className="space-y-4">
            <Panel title="等级权益"><ul className="text-sm space-y-2">{[['V1', '基础流量扶持、直播广场曝光'], ['V2', '搜索加权、直播互动工具全开放'], ['V3', '频道推荐位、官方活动优先报名'], ['V4', '专属小二、品牌合作资源'], ['V5', '超级直播补贴、年度主播盛典']].map(([lv, d]) => <li key={lv} className={cls('flex items-center gap-2 rounded-lg px-3 py-2', lv === level ? 'bg-amber-50' : '')}><Trophy className={cls('w-4 h-4', lv <= level ? 'text-amber-500' : 'text-ink-300')} /><b className="w-7">{lv}</b><span className="text-ink-600">{d}</span></li>)}</ul></Panel>
            <Panel title="成长任务"><div className="space-y-2 text-sm">{[['本周开播 3 场', Math.min(3, lives.filter(l => l.status !== 'scheduled' && new Date(l.startedAt ?? l.plannedAt).getTime() > Date.now() - 7 * 864e5).length), 3], ['单场时长 ≥ 60 分钟', ended.filter(l => l.stats.duration >= 60).length ? 1 : 0, 1], ['发布直播预告', lives.filter(l => l.trailer && l.status === 'scheduled').length ? 1 : 0, 1], ['新增 100 粉丝', Math.min(100, ended.reduce((a, l) => a + l.stats.newFans, 0)), 100]].map(([t, c, m]) => <div key={t as string} className="flex items-center gap-3"><span className="flex-1">{t as string}</span><span className="text-xs text-ink-500 font-num">{c as number}/{m as number}</span>{(c as number) >= (m as number) ? <span className="tag-green">已完成</span> : <Link to="/seller/live/plan" className="btn-outline btn-sm">去完成</Link>}</div>)}</div></Panel>
          </div>
        </div>
      )}
    </div>
  )
}

export function Activity() {
  const [tab, setTab] = useState('全部')
  const [joined, setJoined] = useState<string[]>([])
  const acts = [['双11 直播狂欢季', '平台活动', '2026-10-20 ~ 2026-11-11', '报名直播场次≥3场，赠 10 万 PV 流量券', true], ['闪降闪赠专场', '营销活动', '2026-10-25 ~ 2026-11-05', '货盘商品设置闪降价，流量加权 30%', true], ['新主播成长营', '成长活动', '2026-10-01 ~ 2026-12-31', '首播 30 分钟得 200PV，连播 14 天冷启扶持', true], ['12周百万成交主播计划', '成长活动', '2026-09-01 ~ 2026-11-30', '多场域曝光、流量直线飙升', true], ['服饰秋冬上新周', '行业活动', '2026-10-15 ~ 2026-10-31', '服饰类目主播专属频道推荐位', false], ['美妆双11 预售', '行业活动', '2026-10-21 ~ 2026-10-31', '美妆类目直播间预售加权', false], ['家电焕新节', '行业活动', '2026-11-01 ~ 2026-11-15', '家电数码类目专属流量包', false], ['食品生鲜产地直播', '行业活动', '2026-10-28 ~ 2026-11-20', '产地直播间认证 + 频道曝光', false]] as const
  const tabs = ['全部', '平台活动', '营销活动', '成长活动', '行业活动']
  return (
    <div className="max-w-[1260px]">
      <h1 className="text-xl font-semibold">活动广场</h1>
      <div className="mt-3 rounded-xl2 overflow-hidden bg-gradient-to-r from-[#ff3d3d] to-[#ff8a4c] text-white p-6 md:p-8 flex items-center gap-4 flex-wrap"><div><div className="text-2xl md:text-3xl font-black">双11 直播狂欢季</div><div className="text-sm opacity-90 mt-1">报名即享流量扶持，直播间专享价商品加权推荐</div></div><button onClick={() => { setJoined(j => [...new Set([...j, '双11 直播狂欢季'])]); toast('报名成功') }} className="ml-auto bg-white text-brand-600 font-semibold rounded-full px-6 py-2">{joined.includes('双11 直播狂欢季') ? '已报名' : '立即报名'}</button></div>
      <div className="mt-4 flex items-center gap-1 text-sm">{tabs.map(t => <button key={t} onClick={() => setTab(t)} className={cls('px-3 h-8 rounded-md', tab === t ? 'bg-brand-50 text-brand-600' : 'text-ink-700 hover:bg-ink-100')}>{t}</button>)}</div>
      <div className="mt-4 grid grid-cols-2 max-md:!grid-cols-1 gap-4">{acts.filter(a => tab === '全部' || a[1] === tab).map(([t, c, d, desc, open], i) => <div key={t} className="card p-4 flex gap-4"><div className="w-28 h-28 rounded-lg overflow-hidden bg-ink-100 shrink-0"><Img src={img(`act-${i}`, 200, 200)} alt="" w={200} h={200} className="w-full h-full object-cover" /></div><div className="flex-1 min-w-0 flex flex-col"><div className="flex items-center gap-2"><span className="font-semibold truncate">{t}</span><span className="tag-gray shrink-0">{c}</span>{open ? <span className="tag-green shrink-0">报名中</span> : <span className="tag-gold shrink-0">即将开始</span>}</div><div className="text-xs text-ink-500 mt-1 flex items-center gap-1"><Calendar className="w-3.5 h-3.5" />{d}</div><div className="text-sm text-ink-600 mt-2 line-clamp-2">{desc}</div><div className="mt-auto pt-2"><button onClick={() => { if (!open) return toast('活动尚未开始报名'); setJoined(j => [...new Set([...j, t])]); toast('报名成功') }} className={cls('btn-sm h-8', joined.includes(t) ? 'btn-ghost text-emerald-600' : 'btn-primary')}>{joined.includes(t) ? '已报名' : '去报名'}</button></div></div></div>)}</div>
    </div>
  )
}

export function Classroom() {
  const [sp] = useSearchParams()
  const [cat, setCat] = useState('全部')
  const q = sp.get('q') ?? ''
  const courses = [['PC直播工作台安装及开播指南', '开播入门', 24940, 12], ['中控台功能全解', '开播入门', 21573, 18], ['新主播专属流量如何拿？', '流量获取', 86254, 9], ['推荐流量解读-热度分机制介绍', '流量获取', 7010, 15], ['店播案例-绿庄东方礼', '优质案例', 7447, 22], ['店播案例-翡翠之家闲置回流珠宝', '优质案例', 1072, 20], ['新人主播绿色合规开播', '规则专区', 461000, 8], ['快速！一张图读懂直播合规指南', '规则专区', 423000, 5], ['讲解话术：3 分钟讲透一款商品', '话术技巧', 32100, 11], ['直播间灯光与布景', '开播入门', 15400, 14], ['粉丝运营：从新粉到铁粉', '私域运营', 9800, 16], ['闪降闪赠玩法详解', '营销工具', 12600, 10]] as const
  const cats = ['全部', '开播入门', '流量获取', '优质案例', '规则专区', '话术技巧', '私域运营', '营销工具']
  const list = courses.filter(c => (cat === '全部' || c[1] === cat) && (!q || c[0].includes(q)))
  const [watching, setWatching] = useState<string | null>(null)
  return (
    <div className="max-w-[1260px]">
      <div className="flex items-center justify-between flex-wrap gap-2"><h1 className="text-xl font-semibold">主播课堂</h1>{q && <span className="text-sm text-ink-500">搜索"{q}"的结果</span>}</div>
      <div className="mt-4 flex items-center gap-1 text-sm flex-wrap">{cats.map(t => <button key={t} onClick={() => setCat(t)} className={cls('px-3 h-8 rounded-md', cat === t ? 'bg-brand-50 text-brand-600' : 'text-ink-700 hover:bg-ink-100')}>{t}</button>)}</div>
      {watching && <div className="card mt-4 p-4 flex items-center gap-4"><div className="w-40 aspect-video rounded-lg bg-ink-900 flex items-center justify-center text-white"><Play className="w-8 h-8" /></div><div className="flex-1"><div className="font-medium">{watching}</div><div className="text-xs text-ink-500 mt-1">正在学习 · 演示环境不包含视频内容</div><div className="mt-2 h-1.5 w-64 rounded bg-ink-100 overflow-hidden"><div className="h-full w-1/3 bg-brand-500" /></div></div><button onClick={() => { setWatching(null); toast('已完成学习，合规任务进度 +1') }} className="btn-outline btn-sm">完成学习</button></div>}
      <div className="mt-4 grid grid-cols-4 max-lg:!grid-cols-2 gap-4">{list.map(([t, c, n, m], i) => <div key={t} className="card overflow-hidden group"><div className="relative aspect-video bg-ink-100"><Img src={img(`course-${i}`, 400, 225)} alt="" w={400} h={225} className="w-full h-full object-cover" /><span className="absolute bottom-2 right-2 tag bg-black/60 text-white">{m} 分钟</span><button onClick={() => setWatching(t)} className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition bg-black/30"><span className="w-12 h-12 rounded-full bg-white/90 flex items-center justify-center"><Play className="w-5 h-5 text-brand-500 fill-current" /></span></button></div><div className="p-3"><div className="text-sm font-medium line-clamp-1">{t}</div><div className="text-xs text-ink-500 mt-1 flex items-center justify-between"><span className="flex items-center gap-1"><BookOpen className="w-3.5 h-3.5" />{c}</span><span>{compact(n)}的人学习过</span></div></div></div>)}</div>
      <div className="mt-6 card p-4 flex items-center gap-3 text-sm"><Flag className="w-5 h-5 text-brand-500" /><span>新主播必学：</span>{['开播入门', '规则专区'].map(c => <button key={c} onClick={() => setCat(c)} className="link">{c}</button>)}<ChevronRight className="w-4 h-4 text-ink-400" /></div>
    </div>
  )
}

