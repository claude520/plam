import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Sparkles, Radio, ChevronRight, Monitor, Smartphone, Zap, TrendingUp, Target, BookOpen, FileText, Ticket, Palette, Calendar } from 'lucide-react'
import { useDB } from '@/store/db'
import { Img } from '@/components/ui'
import { LiveForm, useMyLives, LIVE_STATUS } from './common'
import { cls, fmtDate, compact, money } from '@/lib/format'
import { toast } from '@/store/session'

const TICKER = ['华', '老', '皮', '裤', '缘', '起', '萌', '暴', '桂', '小', '张', '花'].map((n, i) => `新主播${n}**完成任务，获得${i % 3 === 2 ? 50 : 100}流量券`)

export function LiveHome() {
  const nav = useNavigate()
  const lives = useMyLives()
  const orders = useDB(s => s.orders)
  const [create, setCreate] = useState(false)
  const current = lives.find(l => l.status === 'live')
  const next = lives.filter(l => l.status === 'scheduled').sort((a, b) => a.plannedAt.localeCompare(b.plannedAt))[0]
  const first = useMemo(() => lives.filter(l => l.status === 'ended').sort((a, b) => a.startedAt!.localeCompare(b.startedAt!))[0], [lives])
  const daysSince = first ? Math.floor((Date.now() - new Date(first.startedAt!).getTime()) / 864e5) : -1
  const steps = ['入驻', '首播(满30分钟)', '首播后第15天', '首播后第30天', '首播后第60天', '首播后第90天']
  const reached = daysSince < 0 ? 0 : daysSince >= 90 ? 5 : daysSince >= 60 ? 4 : daysSince >= 30 ? 3 : daysSince >= 15 ? 2 : 1
  const gmv = orders.filter(o => o.liveId && lives.some(l => l.id === o.liveId) && o.status !== 'unpaid' && o.status !== 'closed').reduce((a, o) => a + o.payAmount, 0)
  const [ti, setTi] = useState(0)
  useEffect(() => { const t = setInterval(() => setTi(i => (i + 1) % TICKER.length), 3000); return () => clearInterval(t) }, [])
  const focus = current ?? next
  return (
    <div className="space-y-4 max-w-[1260px]">
      <section className="card p-5 relative overflow-hidden bg-gradient-to-r from-rose-50 via-white to-white">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-4xl">🦀</span>
          <h1 className="text-lg md:text-xl font-bold text-ink-900">恭喜成为Plam主播，新主播 <span className="text-brand-500 text-2xl font-black">90</span> 日黄金成长期专属流量扶持已开启！</h1>
          <Link to="/seller/live/grow" className="tag bg-fuchsia-100 text-fuchsia-700 h-6 px-2 gap-1"><Sparkles className="w-3 h-3" />AI成长诊断</Link>
          <div className="ml-auto text-xs text-ink-500 flex items-center gap-1.5"><span>🧑‍🚀</span>{TICKER[ti].split('，')[0]}，<span className="text-brand-500">{TICKER[ti].split('，')[1]}</span></div>
        </div>
        <div className="mt-5 bg-white rounded-xl border border-ink-100 px-5 py-4">
          <div className="relative flex justify-between">
            <div className="absolute left-3 right-3 top-2 h-0.5 bg-ink-100"><div className="h-full bg-brand-500 transition-all" style={{ width: `${(reached / 5) * 100}%` }} /></div>
            {steps.map((s, i) => <div key={s} className="relative flex flex-col items-center text-xs text-ink-600 min-w-0"><span className={cls('w-4 h-4 rounded-full border-2 z-10', i <= reached ? 'border-brand-500 bg-brand-500' : 'border-ink-200 bg-white')} />{i === 1 && reached < 1 && <span className="absolute -top-5 text-[11px] text-brand-500 whitespace-nowrap">▲ 坚持播，开播就给流量</span>}<span className="mt-2 whitespace-nowrap max-md:text-[10px]">{s}</span></div>)}
          </div>
          <Link to="/seller/live/grow" className="inline-flex items-center mt-3 ml-8 rounded bg-brand-500 text-white text-[11px] px-2 py-1">已解锁百万成交助力福利<ChevronRight className="w-3 h-3" /></Link>
        </div>
      </section>

      <Link to="/seller/live/multi" className="rounded-xl2 overflow-hidden relative bg-gradient-to-r from-[#ff3d3d] to-[#ff7a59] text-white px-5 md:px-8 py-4 flex items-center gap-3 flex-wrap"><span className="text-lg md:text-xl font-black">新主播多平台智能开播</span><span className="text-xs md:text-sm opacity-90">完成直播能力认证，即享受流量扶持</span><span className="ml-auto bg-white text-brand-600 font-semibold rounded-full px-5 py-1.5 text-sm">去认证</span></Link>

      {focus && (
        <section className="card p-5 flex items-center gap-4 flex-wrap">
          <div className="relative w-20 h-24 rounded-lg overflow-hidden bg-ink-100 shrink-0"><Img src={focus.cover} alt="" w={160} h={200} className="w-full h-full object-cover" /></div>
          <div className="min-w-0 flex-1"><div className="flex items-center gap-2"><span className={LIVE_STATUS[focus.status].cls}>{LIVE_STATUS[focus.status].label}</span><span className="font-semibold truncate">{focus.title}</span></div><div className="text-xs text-ink-500 mt-1 flex items-center gap-1"><Calendar className="w-3.5 h-3.5" />{current ? `开播于 ${fmtDate(current.startedAt)}` : `计划 ${fmtDate(focus.plannedAt)}`} · {focus.productIds.length} 件商品</div>{current && <div className="text-xs text-ink-500 mt-1">在线 {compact(current.stats.viewers)} · 成交 ¥{money(current.stats.gmv)} · 订单 {current.stats.orders}</div>}</div>
          <Link to={`/seller/live/studio/${focus.id}`} className="btn-primary gap-1"><Radio className="w-4 h-4" />{current ? '进入中控台' : '开播'}</Link>
          <Link to="/seller/live/plan" className="btn-outline">直播计划</Link>
        </section>
      )}

      <div className="flex items-center gap-2 text-base flex-wrap"><span className="font-semibold">直播经营</span><span className="text-sm text-ink-600">同期新主播<span className="text-brand-500">50%</span>已首播，专属流量红利限量抢占不等人！</span></div>
      <div className="grid grid-cols-3 max-lg:!grid-cols-1 gap-4 items-start">
        <section className="card p-5">
          <h2 className="font-semibold text-base flex items-center gap-2"><Monitor className="w-5 h-5" />开直播</h2>
          <div className="mt-4 font-medium">试播</div>
          <div className="mt-2 flex items-center gap-3 rounded-lg bg-ink-50 p-3"><span className="w-10 h-10 rounded-lg bg-brand-100 text-brand-500 flex items-center justify-center shrink-0"><Zap className="w-5 h-5" /></span><div className="flex-1 text-sm"><div>小二专业诊断，完成得350PV</div><div className="text-xs text-ink-500 mt-0.5">提前检测设备性能，违规，布景</div></div><Link to="/seller/live/tools?tab=test" className="btn-primary btn-sm h-8">立即试播</Link></div>
          <div className="mt-5 font-medium">3步正式开播</div>
          <div className="mt-2 rounded-md bg-brand-50 text-brand-600 text-xs px-3 py-2">首播满30分钟立享200PV。可解锁连续14天冷启流量扶持</div>
          <ol className="mt-3 space-y-3 text-sm">
            <li className="flex items-center gap-3"><span className="text-brand-500 font-num font-bold">01</span><span className="flex-1">创建直播计划</span><button onClick={() => setCreate(true)} className="btn-outline btn-sm">创建直播</button></li>
            <li className="flex items-center gap-3"><span className="text-brand-500 font-num font-bold">02</span><span className="flex-1">添加商品</span><Link to="/seller/live/goods" className="btn-outline btn-sm">去添加</Link></li>
            <li className="flex items-center gap-3 flex-wrap"><span className="text-brand-500 font-num font-bold">03</span><span className="flex-1">选择开播端</span><button onClick={() => toast('APP 开播请使用 Plam 主播版，演示环境请选择 PC 开播')} className="btn-outline btn-sm gap-1"><Smartphone className="w-3.5 h-3.5" />APP开播</button><button onClick={() => nav(focus ? `/seller/live/studio/${focus.id}` : '/seller/live/plan')} className="btn-primary btn-sm gap-1"><Monitor className="w-3.5 h-3.5" />PC开播</button></li>
          </ol>
          <div className="mt-5 font-medium">开播功能教学</div>
          <ul className="mt-2 space-y-2 text-sm">{[['PC直播工作台安装及开播指南', 24940], ['中控台功能全解', 21573]].map(([t, n]) => <li key={t as string} className="flex items-center gap-2"><BookOpen className="w-4 h-4 text-ink-400 shrink-0" /><Link to="/seller/live/classroom" className="flex-1 hover:text-brand-500 truncate">{t}</Link><span className="text-xs text-ink-400 shrink-0">{n}的人学习过</span></li>)}</ul>
          <div className="mt-5 font-medium">开播工具</div>
          <div className="mt-2 grid grid-cols-2 keep-cols gap-2 text-sm">
            <Link to="/seller/live/tools?tab=card" className="rounded-lg bg-ink-50 p-3 hover:bg-ink-100"><div className="flex items-center gap-1.5 font-medium"><FileText className="w-4 h-4" />智能手卡</div><div className="text-xs text-ink-500 mt-1">卖点精简提炼 · 脚本无门槛跟读</div></Link>
            <Link to="/seller/live/tools?tab=decorate" className="rounded-lg bg-ink-50 p-3 hover:bg-ink-100"><div className="flex items-center gap-1.5 font-medium"><Palette className="w-4 h-4" />直播装修</div><div className="text-xs text-ink-500 mt-1">美化直播间·提升视觉效果</div></Link>
          </div>
        </section>
        <section className="card p-5">
          <h2 className="font-semibold text-base flex items-center gap-2"><TrendingUp className="w-5 h-5" />拿流量</h2>
          <Link to="/seller/live/grow" className="mt-4 font-medium flex items-center">首播任务<ChevronRight className="w-4 h-4" /></Link>
          <div className="mt-2 space-y-3">{[[50, '查看新主播必知规则', '完播率达70%立享流量奖励', '/seller/live/classroom'], [100, '填写全网直播平台经验', '精准推流，起量加速', '/seller/live/settings']].map(([n, t, d, to]) => <div key={t as string} className="flex items-center gap-3 rounded-lg border border-ink-100 p-3"><div className="text-center w-12 shrink-0"><div className="text-2xl font-num font-bold text-brand-500">{n as number}</div><div className="text-[11px] text-brand-500">观看</div></div><div className="flex-1 text-sm min-w-0"><div>{t as string}</div><div className="text-xs text-ink-500 mt-0.5">{d as string}</div></div><Link to={to as string} className="btn-outline btn-sm h-8">去完成</Link></div>)}</div>
          <div className="mt-5 font-medium">加码流量</div>
          <div className="mt-2 flex items-center gap-3 rounded-lg bg-gradient-to-r from-amber-50 to-rose-50 p-3 text-sm"><div className="flex-1"><div className="font-medium">12周成为百万成交主播</div><div className="text-xs text-ink-500 mt-0.5">多场域曝光、流量直线飙升</div></div><Link to="/seller/live/activity" className="btn-primary btn-sm h-8">去参与</Link></div>
          <div className="mt-5 font-medium">流量获取技巧</div>
          <ul className="mt-2 space-y-2 text-sm">{[['新主播专属流量如何拿？', 86254], ['推荐流量解读-热度分机制介绍', 7010]].map(([t, n]) => <li key={t as string} className="flex items-center gap-2"><BookOpen className="w-4 h-4 text-ink-400 shrink-0" /><Link to="/seller/live/classroom" className="flex-1 hover:text-brand-500 truncate">{t}</Link><span className="text-xs text-ink-400 shrink-0">{n}的人学习过</span></li>)}</ul>
          <div className="mt-5 font-medium">流量工具</div>
          <div className="mt-2 grid grid-cols-2 keep-cols gap-2 text-sm">{[['主播档案', '补全"站外信息"，可解锁评级获取加倍激励', '/seller/live/settings'], ['我的流量券', '全面掌握流量券获取及消耗情况', '/seller/live/data/coupon']].map(([t, d, to]) => <Link key={t} to={to} className="rounded-lg bg-ink-50 p-3 hover:bg-ink-100"><div className="flex items-center gap-1.5 font-medium"><Ticket className="w-4 h-4" />{t}</div><div className="text-xs text-ink-500 mt-1 line-clamp-2">{d}</div></Link>)}</div>
        </section>
        <section className="card p-5">
          <h2 className="font-semibold text-base flex items-center gap-2"><Target className="w-5 h-5" />拉成交</h2>
          <div className="mt-4 rounded-lg bg-ink-50 p-3 text-sm flex items-center justify-between"><span>直播累计成交</span><span className="price text-lg">¥{money(gmv || lives.reduce((a, l) => a + l.stats.gmv, 0))}</span></div>
          <Link to="/seller/live/classroom" className="mt-5 font-medium flex items-center">优质成交案例<ChevronRight className="w-4 h-4" /></Link>
          <div className="mt-2 space-y-2">{[['店播案例-绿庄东方礼', 7447], ['店播案例-翡翠之家闲置回流珠宝', 1072]].map(([t, n]) => <Link key={t as string} to="/seller/live/classroom" className="flex items-center gap-3 rounded-lg border border-ink-100 p-3 text-sm hover:bg-ink-50"><span className="w-10 h-10 rounded-lg bg-rose-100 text-rose-500 flex items-center justify-center shrink-0"><BookOpen className="w-5 h-5" /></span><div className="flex-1 min-w-0"><div className="truncate">{t as string}</div><div className="text-xs text-ink-500 mt-0.5">{n}的人学习过</div></div><ChevronRight className="w-4 h-4 text-ink-400" /></Link>)}</div>
          <div className="mt-5 font-medium">营销工具</div>
          <div className="mt-2 space-y-2">{[['直播闪降', '直播渠道限价热卖，助力商品及进店转化'], ['限时秒杀', '直播内限时限量限价的秒杀通道'], ['万能红包', '多人群投放，站外引流到直播间']].map(([t, d]) => <Link key={t} to="/seller/live/interaction" className="flex items-center gap-3 rounded-lg bg-ink-50 p-3 text-sm hover:bg-ink-100"><span className="w-9 h-9 rounded-lg bg-brand-100 text-brand-500 flex items-center justify-center shrink-0"><Zap className="w-4 h-4" /></span><div className="flex-1 min-w-0"><div className="font-medium">{t}</div><div className="text-xs text-ink-500 mt-0.5 truncate">{d}</div></div></Link>)}</div>
        </section>
      </div>
      <LiveForm open={create} onClose={() => setCreate(false)} />
    </div>
  )
}
