import { useSearchParams } from 'react-router-dom'
import { ChevronRight, Info, Plus, Hand, MessageSquare, Repeat, Zap, Monitor, Package, Clock, Bot, Users, GitFork, Settings } from 'lucide-react'
import { useDB } from '@/store/db'
import { useCurrentShop } from '@/lib/hooks'
import { Tabs, Switch, Stat } from '@/components/ui'
import { cls, fmtDate, money } from '@/lib/format'
import { toast } from '@/store/session'
import { TrendLine, days } from '@/components/Charts'

export function CsOverview() {
  const shop = useCurrentShop()
  const [sp, setSp] = useSearchParams()
  const tab = sp.get('tab') ?? 'overview'
  const { refunds, messages, orders } = useDB()
  const pendingRefund = refunds.filter(r => r.shopId === shop.id && r.status === 'pending').length
  const unread = messages.filter(m => m.shopId === shop.id && m.to === shop.id && !m.read).length
  const inquiry = orders.filter(o => o.shopId === shop.id).length
  const tools = [['欢迎语', 'bg-qn-500', <Hand />], ['聊天记录', 'bg-emerald-500', <MessageSquare />], ['互动服务窗', 'bg-teal-500', <Repeat />], ['快捷短语', 'bg-brand-500', <Zap />], ['离线公告', 'bg-emerald-600', <Monitor />], ['补货提醒', 'bg-orange-500', <Package />], ['离线消息设置', 'bg-teal-600', <Clock />], ['机器人设置', 'bg-brand-600', <Bot />]]
  const yesterday = fmtDate(new Date(Date.now() - 864e5).toISOString(), false)
  if (tab === 'kpi') return <Kpi />
  if (tab === 'dispatch' || tab === 'onsite') return <Dispatch tab={tab} />
  if (tab === 'robot' || tab === 'setting') return <Robot tab={tab} />
  return (
    <div className="card">
      <div className="px-5"><Tabs items={[{ key: 'overview', label: '服务数据' }, { key: 'quality', label: '服务质量明细' }, { key: 'team', label: '团队评级数据' }]} value={tab} onChange={k => setSp({ tab: k })} accent="qn" size="lg" /></div>
      <div className="p-5 grid grid-cols-[1fr_350px] gap-8 items-start">
        <div className="space-y-5">
          <div className="rounded-lg bg-qn-50 border border-qn-100 px-4 py-2.5 text-xs text-ink-700 flex items-center gap-2"><Info className="w-4 h-4 text-qn-500" />双11优+服务标准及新增免费工具讲解 <span className="text-qn-600">点此学习</span></div>
          <div><div className="font-semibold mb-3">客服待办任务</div><div className="rounded-xl bg-gradient-to-r from-qn-50 via-sky-50 to-qn-50 grid grid-cols-5 py-5">{[['待分配任务', unread], ['处理中任务', 0], ['待售后', pendingRefund], ['待处理投诉', 0], ['违规', 0]].map(([l, n]) => <div key={l as string} className="text-center"><div className="text-3xl font-num font-bold">{n as number}</div><div className="text-xs text-ink-600 mt-1">{l as string}</div></div>)}</div></div>
          <div>
            <div className="flex items-center justify-between"><div><div className="font-semibold">服务数据</div><div className="text-xs text-ink-500 mt-1">昨日数据 <span className="text-ink-400">{yesterday} 数据</span></div></div><button className="text-xs text-ink-500 flex items-center gap-1"><Plus className="w-3.5 h-3.5 border border-ink-400 rounded-sm" />指标<ChevronRight className="w-3.5 h-3.5" /></button></div>
            <div className="grid grid-cols-4 gap-3 mt-3">
              {[['消息拒收点击率', '0.8%', '-0.2%', ''], ['旺旺满意度', '98.2%', '+0.5%', '如何优化'], ['3分钟人工响应率', '96.4%', '+1.1%', '如何优化', '体验分'], ['真实体验分', '92.1', '+0.3', '', '体验分']].map(([l, v, d, link, badge]) => <div key={l} className="bg-ink-50 rounded-xl p-4"><div className="text-xs text-ink-500 flex items-center gap-1">{l} ⓘ {badge && <span className="tag-blue">{badge}</span>}</div><div className="text-2xl font-num font-semibold mt-1">{v}</div><div className="text-xs text-ink-400 mt-1 flex items-center justify-between"><span>较昨日 <span className={d.startsWith('+') ? 'text-emerald-700' : 'text-red-600'}>{d}</span></span>{link && <span className="text-qn-600">{link}</span>}</div></div>)}
              {[['客服销售额', `¥${money(inquiry * 86.5)}`], ['客服销售占比', '31.2%'], ['接待人数', String(inquiry + 42)], ['询单转化率', '34.5%', '延']].map(([l, v, b]) => <div key={l} className="bg-ink-50 rounded-xl p-4"><div className="text-xs text-ink-500 flex items-center gap-1">{b && <span className="tag bg-brand-500 text-white">{b}</span>}{l} ⓘ</div><div className="text-2xl font-num font-semibold mt-1">{v}</div><div className="text-xs text-qn-600 mt-1 flex items-center">添加统计客服<ChevronRight className="w-3 h-3" /></div></div>)}
            </div>
          </div>
          <div><div className="flex items-center gap-2 font-semibold">实时数据<span className="text-xs text-ink-400 font-normal">数据更新时间：{fmtDate(new Date().toISOString())}</span></div><div className="grid grid-cols-5 gap-3 mt-3">{[['未挂起/在线客服', '2 / 3', '人员管理'], ['接待人数', '18', '较昨日 +3'], ['实时询单转化率', '36.8%', '较昨日 +2.3%'], ['询单付款金额', `¥${money(1286)}`, '较昨日 +12%'], ['付款人数', '9', '较昨日 +1']].map(([l, v, d]) => <div key={l} className="border border-ink-100 rounded-xl p-3"><div className="text-xs text-ink-500">{l}</div><div className="text-xl font-num font-semibold mt-1">{v}</div><div className="text-xs text-ink-400 mt-1">{d}</div></div>)}</div></div>
          <div><div className="font-semibold mb-3">服务建议</div><div className="grid grid-cols-3 gap-3">{[['设置买家进线欢迎语', '配置常见问答欢迎语，买家进入咨询自动展示', '去设置'], ['服务满意度提升', '学习满意度提升的产品、流程及场景策略', '去学习'], ['话术规范建议', '规范店铺客服话术，避免消息过多，影响买家咨询体验', '去学习']].map(([t, d, b]) => <div key={t} className="rounded-xl border border-ink-100 p-4"><span className="tag-blue">服务体验</span><div className="font-medium mt-2">{t}</div><div className="text-xs text-ink-500 mt-1 h-8 line-clamp-2">{d}</div><button onClick={() => toast(`${t}：已打开`, 'info')} className="btn-sm btn bg-qn-50 text-qn-600 mt-3">{b}</button></div>)}</div></div>
        </div>
        <div className="space-y-5">
          <div><div className="font-semibold flex items-center gap-2">月度考核结果<span className="text-xs text-ink-400 font-normal">每月1日更新</span></div>
            <div className="mt-3 rounded-xl bg-gradient-to-br from-qn-50 to-sky-50 p-4"><div className="flex items-center justify-between text-qn-700 font-semibold">9月基础考核 ⓘ<ChevronRight className="w-4 h-4" /></div><div className="text-xs mt-2 flex items-center justify-between"><span>▪ 消息拒收点击率</span><span className="bg-white rounded px-2 py-0.5 text-ink-500">不考核 ›</span></div></div>
            <div className="mt-3 rounded-xl bg-gradient-to-br from-qn-50 to-sky-50 p-4"><div className="flex items-center justify-between text-qn-700 font-semibold">9月团队考核 ⓘ<ChevronRight className="w-4 h-4" /></div><div className="mt-2 flex items-center gap-3"><span className="w-10 h-10 rounded-full bg-white border-2 border-qn-200 flex items-center justify-center text-qn-500">☺</span><div><div className="text-sm font-medium text-qn-700">普通客服团队</div><div className="text-xs text-ink-500">提升评级以获得客服金标</div></div></div></div>
          </div>
          <div><div className="flex items-center justify-between font-semibold">常用接待工具<span className="text-xs text-ink-400 font-normal">⚙ 自定义</span></div><div className="grid grid-cols-4 gap-3 mt-3">{tools.map(([l, c, ic]) => <button key={l as string} onClick={() => toast(`${l as string} 已打开`, 'info')} className="flex flex-col items-center gap-1.5 text-xs text-ink-700"><span className={cls('w-12 h-12 rounded-full text-white flex items-center justify-center [&>svg]:w-5 [&>svg]:h-5', c as string)}>{ic as React.ReactNode}</span>{l as string}</button>)}</div></div>
          <div><div className="font-semibold mb-3">动态</div><ul className="space-y-2.5 text-sm">{[['学习', '店小蜜接入AI大模型 智能客服提效全攻略'], ['学习', '优+服务升级实战指南：好服务带来新增长'], ['通知', '开通「不满意挽回」满意度提升10%+'], ['学习', '客服满意度提升方法（持续更新中）'], ['动态', '官方客服绩效工具和插件升级并免费']].map(([t, x]) => <li key={x} className="flex items-center gap-2 hover:text-qn-600 cursor-pointer" onClick={() => toast(x, 'info')}><span className={cls('tag shrink-0', t === '通知' ? 'tag-red' : t === '学习' ? 'tag-blue' : 'tag-green')}>{t}</span><span className="truncate">{x}</span></li>)}</ul></div>
        </div>
      </div>
    </div>
  )
}

function Kpi() {
  return (
    <div className="card p-5"><div className="font-semibold text-lg mb-4">绩效考核</div><div className="grid grid-cols-4 gap-3 mb-5"><Stat label="平均首响" value="18s" accent="text-emerald-700" /><Stat label="平均响应" value="42s" /><Stat label="满意度" value="98.2%" /><Stat label="询单转化率" value="34.5%" /></div><table className="w-full text-sm"><thead><tr className="bg-ink-50 text-left text-ink-600"><th className="px-3 py-2.5 font-medium">客服</th><th className="px-3 py-2.5 font-medium">接待人数</th><th className="px-3 py-2.5 font-medium">首响</th><th className="px-3 py-2.5 font-medium">满意度</th><th className="px-3 py-2.5 font-medium">询单转化</th><th className="px-3 py-2.5 font-medium">销售额</th><th className="px-3 py-2.5 font-medium">评级</th></tr></thead><tbody>{[['kefu01 小李', 86, '15s', '98.8%', '36.2%', 4860, '金牌'], ['kefu02 小王', 72, '21s', '97.5%', '33.1%', 3920, '银牌'], ['yunying 阿强', 12, '48s', '96.0%', '28.4%', 760, '普通']].map(([n, c, f, s, z, m, g]) => <tr key={n as string} className="border-b border-ink-100"><td className="px-3 py-2.5 font-medium">{n as string}</td><td className="px-3 py-2.5 font-num">{c as number}</td><td className="px-3 py-2.5 font-num">{f as string}</td><td className="px-3 py-2.5 font-num">{s as string}</td><td className="px-3 py-2.5 font-num">{z as string}</td><td className="px-3 py-2.5 font-num">¥{money(m as number)}</td><td className="px-3 py-2.5"><span className={g === '金牌' ? 'tag-gold' : g === '银牌' ? 'tag-blue' : 'tag-gray'}>{g as string}</span></td></tr>)}</tbody></table><div className="mt-5"><div className="font-semibold mb-2">近 7 天接待趋势</div><TrendLine data={days(7, i => ({ 接待量: 40 + ((i * 17) % 30), 满意度: 95 + (i % 4) }))} keys={['接待量', '满意度']} height={220} /></div></div>
  )
}

function Dispatch({ tab }: { tab: string }) {
  return (
    <div className="card p-5"><div className="font-semibold text-lg mb-1 flex items-center gap-2">{tab === 'onsite' ? <><Users className="w-5 h-5 text-qn-500" />现场管理</> : <><GitFork className="w-5 h-5 text-qn-500" />客服分流</>}</div><div className="text-xs text-ink-500 mb-4">{tab === 'onsite' ? '实时查看客服在线状态与接待负载' : '按商品/关键词/买家等级将咨询分配到不同客服组'}</div>
      {tab === 'onsite' ? <div className="grid grid-cols-3 gap-4">{[['kefu01 小李', '在线', 6, 'bg-emerald-500'], ['kefu02 小王', '在线', 4, 'bg-emerald-500'], ['yunying 阿强', '挂起', 0, 'bg-amber-500']].map(([n, s, c, col]) => <div key={n as string} className="rounded-xl border border-ink-100 p-4 flex items-center gap-3"><span className={cls('w-2.5 h-2.5 rounded-full', col as string)} /><div className="flex-1"><div className="font-medium">{n as string}</div><div className="text-xs text-ink-500">{s as string} · 当前接待 {c as number} 人</div></div><button onClick={() => toast('已提醒')} className="btn-outline btn-sm">提醒</button></div>)}</div>
        : <div className="space-y-3">{[['售前组', '默认接待 · 商品咨询 / 活动', 2, true], ['售后组', '关键词：退款、退货、发票、物流', 1, true], ['VIP 组', '88VIP 买家优先分配', 1, false]].map(([n, d, c, on]) => <div key={n as string} className="rounded-xl border border-ink-100 p-4 flex items-center gap-3"><div className="flex-1"><div className="font-medium">{n as string}</div><div className="text-xs text-ink-500">{d as string} · {c as number} 名客服</div></div><Switch checked={on as boolean} onChange={() => toast('分流规则已更新')} /></div>)}<button onClick={() => toast('分流组已创建')} className="btn-qn btn-sm">+ 新建分流组</button></div>}
    </div>
  )
}

function Robot({ tab }: { tab: string }) {
  return (
    <div className="card p-5"><div className="font-semibold text-lg mb-1 flex items-center gap-2">{tab === 'robot' ? <><Bot className="w-5 h-5 text-qn-500" />机器人主页</> : <><Settings className="w-5 h-5 text-qn-500" />接待设置</>}</div><div className="text-xs text-ink-500 mb-4">{tab === 'robot' ? '店小蜜 AI 大模型智能客服' : '欢迎语、离线公告与自动回复'}</div>
      {tab === 'robot' ? <><div className="grid grid-cols-4 gap-3 mb-5"><Stat label="今日机器人接待" value={128} /><Stat label="自动解决率" value="76%" accent="text-emerald-700" /><Stat label="转人工" value={31} /><Stat label="知识库问答" value={214} /></div><div className="space-y-3">{[['自动接待', '买家首次进线自动欢迎并推荐商品', true], ['智能应答', '基于知识库自动回复常见问题', true], ['夜间托管', '22:00 - 08:00 由 AI 全权接待', false], ['催付提醒', '下单 15 分钟未付款自动提醒', true]].map(([t, d, v]) => <div key={t as string} className="flex items-center gap-4 border border-ink-100 rounded-xl p-4"><Bot className="w-5 h-5 text-qn-500" /><div className="flex-1"><div className="font-medium">{t as string}</div><div className="text-xs text-ink-500 mt-0.5">{d as string}</div></div><Switch checked={v as boolean} onChange={() => toast('配置已保存')} /></div>)}</div></>
        : <div className="max-w-2xl space-y-4">{[['进线欢迎语', '亲，欢迎光临 ' + '本店，有什么可以帮您？双11 期间全场叠券低至 7.2 折～'], ['离线公告', '客服工作时间 9:00-23:00，离线期间留言会在上线后第一时间回复。'], ['自动回复（关键词：发货）', '付款后 48 小时内发货，默认顺丰/中通，节假日顺延哦～']].map(([l, v]) => <div key={l}><div className="text-sm text-ink-600 mb-1.5">{l}</div><textarea className="input-qn h-20 py-2" defaultValue={v} /></div>)}<button onClick={() => toast('接待设置已保存')} className="btn-qn">保存设置</button></div>}
    </div>
  )
}
