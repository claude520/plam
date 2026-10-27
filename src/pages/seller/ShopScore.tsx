import { useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Download, ChevronRight, ChevronLeft, Info, Star, TrendingUp, Sparkles } from 'lucide-react'
import { useDB } from '@/store/db'
import { useCurrentShop } from '@/lib/hooks'
import { Avatar, Tabs } from '@/components/ui'
import { cls, fmtDate } from '@/lib/format'
import { toast } from '@/store/session'
import { TrendLine, days } from '@/components/Charts'

const TABS = [['score', '真实体验分'], ['pxi', '商品体验分(PXI)'], ['issue', '体验问题订单率(试运行)'], ['wanqiu', '万求指数'], ['service', '服务体验分析'], ['review', '评价洞察'], ['consult', '咨询洞察']] as const

export function ShopScore() {
  const shop = useCurrentShop()
  const [sp, setSp] = useSearchParams()
  const tab = sp.get('tab') ?? 'score'
  const { orders, shops } = useDB()
  const my = orders.filter(o => o.shopId === shop.id && o.status !== 'unpaid' && o.status !== 'closed')
  const has = my.length >= 30
  const score = has ? (shop.score.desc + shop.score.service + shop.score.logistics) / 3 : 0
  const yesterday = fmtDate(new Date(Date.now() - 2 * 864e5).toISOString(), false)
  const dims = [['宝贝质量', shop.score.desc, 'desc'], ['物流速度', shop.score.logistics, 'logistics'], ['服务保障', shop.score.service, 'service']] as const
  const rank = useMemo(() => [...shops].filter(s => s.status === 'open').sort((a, b) => (b.score.desc + b.score.service + b.score.logistics) - (a.score.desc + a.score.service + a.score.logistics)).slice(0, 10), [shops])
  const myRank = rank.findIndex(s => s.id === shop.id)
  const metrics = [['首次品退率', '1.9%', '2.4%', '优于同行'], ['48小时揽收及时率', '97.8%', '92.1%', '优于同行'], ['物流到货时长', '2.1天', '2.6天', '优于同行'], ['纠纷率', '0.08%', '0.15%', '优于同行'], ['3分钟人工响应率', '95.6%', '90.0%', '优于同行'], ['退款自主完结时长', '0.6天', '1.2天', '优于同行'], ['评价满意度', '98.1%', '96.5%', '优于同行'], ['仅退款率', '0.9%', '1.5%', '优于同行']]
  const news = [['规则', '住宅家具_床垫新增“送装一体”附加分', '于2026年10月20日考核日起生效'], ['工具', '全新「AI质检」帮你看清服务', '内置售前询单客服执行诊断、不满意根因、好服务案例等模板'], ['学习', '运动户外类目全新上线专属「客服专业认证」', '加入该服务的商品将在详情页展示“运动顾问”'], ['工具', 'AI用户洞察全新上线', '减少询单流失、降低退款率、提升体验分'], ['规则', '关于自然灾害影响地区发货及考核调整公告', '相关考核指标将自动剔除，不纳入考核统计'], ['学习', '店铺真实体验分 | 详情解读及介绍', '全面了解真实体验分的指标解读、诊断提升建议']]
  return (
    <div className="card">
      <div className="px-5 flex items-center"><Tabs items={TABS.map(([k, l]) => ({ key: k, label: l }))} value={tab} onChange={k => setSp({ tab: k })} accent="qn" className="flex-1 border-0" /><button onClick={() => toast('报表已生成，正在下载')} className="text-sm text-qn-600 flex items-center gap-1"><Download className="w-4 h-4" />下载中心</button></div>
      <div className="mx-5 rounded-lg bg-qn-50 border border-qn-100 px-4 py-2.5 text-xs text-ink-700 flex items-center gap-2"><Info className="w-4 h-4 text-qn-500" />住宅家具_床垫新增"送装一体"附加分，于2026年10月20日考核日起生效 <span className="text-qn-600">| 点此详见</span><span className="ml-auto text-ink-400 flex items-center gap-1"><ChevronLeft className="w-3 h-3" />2/2<ChevronRight className="w-3 h-3" /></span></div>
      <div className="p-5 grid grid-cols-[1fr_340px] gap-5 items-start">
        <div className="space-y-5">
          <div className="rounded-xl border border-ink-100 p-5">
            <div className="flex items-center justify-between"><div className="font-semibold">店铺表现 <span className="text-xs text-ink-400 font-normal ml-2">| 考核类目：{has ? '综合' : '-'}</span></div><div className="text-xs text-ink-500 flex items-center gap-2">更新时间：<span className="input-qn h-8 w-32 flex items-center text-ink-700">{yesterday}</span></div></div>
            <div className="mt-4 grid grid-cols-[200px_1fr_1fr_1fr] gap-2 items-center">
              <div className="rounded-xl bg-gradient-to-br from-qn-50 to-sky-50 p-4 text-center relative"><span className="absolute top-2 right-2 text-[10px] text-qn-600 flex items-center gap-0.5"><TrendingUp className="w-3 h-3" />趋势</span><div className="text-sm text-ink-600">真实体验分</div><div className="text-3xl font-num font-bold mt-1">{has ? (score * 20).toFixed(1) : '-'}</div><div className="flex justify-center gap-0.5 mt-1">{[1, 2, 3, 4, 5].map(i => <Star key={i} className={cls('w-3.5 h-3.5', has && i <= Math.round(score) ? 'fill-amber-400 text-amber-400' : 'text-ink-200')} />)}</div><div className="text-xs text-ink-500 mt-1">超过{has ? '78%' : '-'}同行</div></div>
              {dims.map(([l, v], i) => <div key={l} className="text-center relative"><span className="absolute -left-2 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-qn-50 text-qn-500 text-xs flex items-center justify-center">{i === 0 ? '=' : '+'}</span><div className="text-sm text-ink-600">{l}</div><div className="text-2xl font-num font-bold mt-1">{has ? v.toFixed(2) : '-'} <span className="text-ink-300 text-xs">⌄</span></div><div className="text-xs text-ink-500 mt-1">超过{has ? `${70 + i * 6}%` : '-'}同行</div></div>)}
            </div>
            <div className="mt-5 flex items-center justify-between text-sm"><span className="font-semibold">专属权益 <span className="text-ink-300 text-xs font-normal">ⓘ</span></span><span className="text-qn-600 text-xs flex items-center">权益详情<ChevronRight className="w-3 h-3" /></span></div>
            <div className="mt-2 h-2 rounded-full bg-ink-100 overflow-hidden"><div className="h-full bg-gradient-to-r from-qn-400 to-qn-600" style={{ width: `${(score / 5) * 100}%` }} /></div>
            <div className="flex justify-between text-xs text-ink-500 mt-1"><span>0.00</span><span>5.00</span></div>
          </div>
          <div className="rounded-xl border border-ink-100 p-5">
            <div className="flex items-center justify-between"><div className="font-semibold">指标表现</div><div className="text-xs text-ink-500">更新时间：{yesterday} <button onClick={() => toast('已导出')} className="text-qn-600 ml-2">↑ 导出</button></div></div>
            {has ? <table className="w-full text-sm mt-3"><thead><tr className="bg-ink-50 text-left text-ink-600"><th className="px-3 py-2.5 font-medium">指标</th><th className="px-3 py-2.5 font-medium">本店</th><th className="px-3 py-2.5 font-medium">同行均值</th><th className="px-3 py-2.5 font-medium">对比</th><th className="px-3 py-2.5 font-medium">趋势</th></tr></thead><tbody>{metrics.map(([m, v, avg, c]) => <tr key={m} className="border-b border-ink-100"><td className="px-3 py-2.5">{m}</td><td className="px-3 py-2.5 font-num font-medium">{v}</td><td className="px-3 py-2.5 font-num text-ink-500">{avg}</td><td className="px-3 py-2.5"><span className="tag-green">{c}</span></td><td className="px-3 py-2.5 text-emerald-600 text-xs">↗ 上升</td></tr>)}</tbody></table>
              : <div className="py-10 text-center text-ink-400 text-sm">有效订单量不足 30 单，暂无指标数据，请提升成交量</div>}
            <div className="mt-5"><div className="text-sm font-semibold mb-2">近 30 天体验分趋势</div><TrendLine data={days(30, i => ({ 体验分: Math.round((88 + Math.sin(i / 3) * 4) * 10) / 10 }))} keys={['体验分']} height={200} /></div>
          </div>
        </div>
        <div className="space-y-4">
          <div className="rounded-xl bg-gradient-to-br from-orange-50 to-amber-50 border border-orange-100 p-4"><div className="flex items-center justify-between font-semibold">向消费者展示<span className="text-xs text-qn-600 font-normal flex items-center">查看规则<ChevronRight className="w-3 h-3" /></span></div><div className="mt-3 bg-white rounded-xl p-3 shadow-card"><div className="flex items-center gap-2"><Avatar src={shop.logo} name="" size={28} /><span className="text-sm font-medium truncate">{shop.name}</span>{has && <span className="tag-gold ml-auto">体验优选</span>}</div><div className="mt-2 grid grid-cols-3 text-center text-[11px] text-ink-500">{dims.map(([l, v]) => <div key={l}>{l}<div className="font-num text-ink-800 font-semibold">{has ? v.toFixed(1) : '-'}</div></div>)}</div>{!has && <div className="text-xs text-ink-400 text-center bg-ink-50 rounded py-1.5 mt-2">店铺暂未透出体验标签</div>}</div><div className="text-[11px] text-ink-500 mt-2">{has ? '店铺已满足体验标签透出要求，正在首页展示' : '店铺暂未满足体验标签透出要求，请努力提升获取店铺首页透出机会'}</div></div>
          <div className="rounded-xl border border-ink-100 p-4"><div className="flex items-center justify-between font-semibold">体验分同行同层TOP10榜单<span className="text-xs text-qn-600 font-normal flex items-center">详情<ChevronRight className="w-3 h-3" /></span></div><div className="mt-3 flex items-center gap-2"><Avatar src={shop.logo} name="" size={36} /><div className="text-xs"><div className="text-ink-900">{myRank >= 0 && has ? `第 ${myRank + 1} 名` : '-'}</div><div className="text-ink-500">{myRank >= 0 && has ? '较昨日 持平' : '暂无排名 ⓘ - 持平'}</div></div></div><div className="mt-3 space-y-1.5">{rank.map((s, i) => <div key={s.id} className={cls('flex items-center gap-2 text-xs rounded px-2 py-1', s.id === shop.id && 'bg-qn-50')}><span className={cls('w-5 h-5 rounded flex items-center justify-center font-num font-bold', i < 3 ? 'bg-brand-500 text-white' : 'bg-ink-100 text-ink-600')}>{i + 1}</span><Avatar src={s.logo} name="" size={20} /><span className="flex-1 truncate">{s.name}</span><span className="font-num text-ink-700">{((s.score.desc + s.score.service + s.score.logistics) / 3 * 20).toFixed(1)}</span></div>)}</div></div>
          <div className="rounded-xl border border-ink-100 p-4"><div className="flex items-center justify-between font-semibold">产品动态<span className="text-xs text-ink-400 font-normal">更多 ›</span></div><ul className="mt-3 space-y-3">{news.map(([t, h, d]) => <li key={h} className="cursor-pointer" onClick={() => toast(h, 'info')}><div className="flex items-center gap-2 text-sm"><span className={cls('tag shrink-0', t === '规则' ? 'tag-red' : t === '工具' ? 'tag-blue' : 'tag-green')}>{t}</span><span className="truncate text-ink-900">{h}</span></div><div className="text-xs text-ink-400 mt-0.5 line-clamp-1 pl-9">{d}</div></li>)}</ul></div>
          <div className="rounded-xl bg-gradient-to-br from-qn-500 to-violet-600 text-white p-4"><div className="flex items-center gap-2 font-semibold"><Sparkles className="w-4 h-4" />提升小课堂</div><ul className="mt-2 text-xs space-y-1.5 opacity-90"><li>· 店铺真实体验分重大升级</li><li>· 首次品退率介绍</li><li>· 48小时揽收及时率介绍</li></ul></div>
        </div>
      </div>
    </div>
  )
}
