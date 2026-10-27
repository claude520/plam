import { useState } from 'react'
import { Truck, MapPin, Timer, CheckSquare, Barcode, BarChart3, Home, Search, Wrench, Package, Send, Route, Printer, Zap, FileText, Boxes, Warehouse, Wallet } from 'lucide-react'
import { Tabs } from '@/components/ui'
import { cls } from '@/lib/format'
import { toast } from '@/store/session'

const GROUPS: { title: string; desc: string; items: [string, string, React.ReactNode, string][] }[] = [
  { title: '基础工具', desc: '常用工具', items: [['运费模板设置', '配置商品运费信息', <Truck />, 'bg-brand-500'], ['地址库', '设置店铺的发货地址与收货地址', <MapPin />, 'bg-emerald-500'], ['时效履约诊断', '诊断时效问题、一键优化表达，帮店铺把"快"做成信任和转化', <Timer />, 'bg-teal-500'], ['核销工具', '核销自配送的商品订单', <CheckSquare />, 'bg-emerald-600'], ['识别码查询工具', '查询商品条形码', <Barcode />, 'bg-sky-500'], ['快递情况分析', '分析平台快递数据', <BarChart3 />, 'bg-qn-500'], ['承诺上门配置', '设置承诺上门的方式和规则', <Home />, 'bg-violet-500'], ['验机结果查询工具', '查询百亿补贴验机订单结果', <Search />, 'bg-rose-500'], ['配送安装费用配置', '为配送安装费用使用', <Wrench />, 'bg-amber-500'], ['为商品配置服务', '商品配置服务使用', <Package />, 'bg-cyan-500'], ['裹裹寄件', '裹裹寄件发货平台', <Send />, 'bg-qn-600'], ['物流追踪信息', '物流追踪使用', <Route />, 'bg-indigo-500'], ['打单工具', '官方打单工具（永久免费）', <Printer />, 'bg-ink-700']] },
  { title: '消费者物流体验', desc: '为消费者物流体验保驾护航，帮助提升店铺DSR和消费者物流满意度', items: [['消费者选快递', '卖家承诺按订单约定的快递公司发货，提升买家购物物流体验，减少店铺物流差评，增加买家的二次购买率。', <Boxes />, 'bg-sky-500'], ['电子面单', '打印速度是传统纸质面单的4-6倍，提高发货效率。', <FileText />, 'bg-emerald-500'], ['自配送物流信息接入', '不使用市场主流物流服务商，且自己具备配送能力的商家，能力只限服务于该运营主体的关联店铺产生的订单', <Truck />, 'bg-indigo-500'], ['官方物流送货上门', '平台对快递服务商进行上门服务能力集采、认证和服务水平监管，为消费者带来确定性末端上门履约服务，不上门包赔。', <Home />, 'bg-brand-500'], ['官方集运', '官方集运服务再升级，享受增量市场红利', <Route />, 'bg-teal-500'], ['物流时效表达', '平台为商家提供一套时效产品，免费订购后将在搜索、商详、下单等环节透出今日发、24小时发、今日达、明日达等。', <Timer />, 'bg-amber-500'], ['极速上门', '以"顺丰包邮"的服务为基础，在近 300 城的 3000 条次日达线路上可实现送货上门', <Zap />, 'bg-rose-500']] },
  { title: '仓配物流服务', desc: '我们精心选择仓配物流服务，为您解决物流后顾之忧', items: [['云仓', '提供全国经济型仓配网络，新商0元试发100单，仓配一体低至1.6元/单，30天周转免仓租', <Warehouse />, 'bg-qn-500']] },
  { title: '供应链增值服务', desc: '', items: [['极速回款', '发货即回款，无需等待买家确认收货！帮助商家缩短账期、加速资金周转，符合条件的订单一经发货即可提前收到款项', <Wallet />, 'bg-emerald-600']] },
]

export function LogisticsService() {
  const [tab, setTab] = useState<'all' | 'history' | 'ticket'>('all')
  const [opened, setOpened] = useState<string[]>(['运费模板设置', '地址库', '电子面单', '打单工具'])
  return (
    <div className="space-y-4">
      <div className="rounded-xl2 h-24 bg-gradient-to-r from-orange-50 via-amber-50 to-rose-50 border border-orange-100 flex items-center px-8 relative overflow-hidden"><div><div className="flex items-center gap-4"><span className="text-2xl font-black italic text-brand-600">新疆包邮体验提升计划通知</span><button onClick={() => toast('已查看计划详情', 'info')} className="btn btn-sm bg-brand-500 text-white rounded-full">立即查看</button></div><div className="flex gap-5 mt-2 text-sm text-ink-700">{['纯增量市场拉新', '平台补贴', '流量加持', '店铺综合分部分指标豁免', '无需入仓'].map(x => <span key={x} className="flex items-center gap-1"><span className="w-4 h-4 rounded-full bg-brand-100 text-brand-600 text-[10px] flex items-center justify-center">✓</span>{x}</span>)}</div></div><Truck className="absolute right-10 top-1/2 -translate-y-1/2 w-16 h-16 text-brand-200" /></div>
      <div className="card">
        <div className="px-5"><Tabs items={[{ key: 'all', label: '全部' }, { key: 'history', label: '获取历史' }, { key: 'ticket', label: '工单' }]} value={tab} onChange={setTab} accent="qn" /></div>
        <div className="p-5">
          {tab === 'all' && GROUPS.map((g, gi) => (
            <div key={g.title} className={cls(gi > 0 && 'mt-8')}>
              <div className="flex items-center gap-3 mb-4"><span className="font-semibold text-lg">{g.title}</span><span className="text-sm text-ink-500">{g.desc}</span>{gi === 0 && <span className="ml-auto text-sm text-ink-500">更多基础工具 ⌄</span>}</div>
              <div className="grid grid-cols-4 gap-4">{g.items.map(([n, d, ic, c]) => { const on = opened.includes(n); return (
                <div key={n} className="rounded-xl border border-ink-100 p-5 hover:shadow-card transition flex flex-col"><div className="flex items-start justify-between"><span className={cls('w-12 h-12 rounded-xl text-white flex items-center justify-center [&>svg]:w-5 [&>svg]:h-5', c)}>{ic}</span><button onClick={() => { if (!on) setOpened(o => [...o, n]); toast(on ? `${n}：已打开` : `${n}：开通成功`, 'info') }} className={cls('btn-sm h-8 px-4', on ? 'btn-outline' : 'btn-qn')}>{on ? '查看' : '开通'}</button></div><div className="font-semibold text-base mt-6">{n}</div><div className="text-xs text-ink-500 mt-1.5 line-clamp-2 leading-5">{d}</div></div>
              ) })}</div>
            </div>
          ))}
          {tab === 'history' && <div className="space-y-2">{opened.map((n, i) => <div key={n} className="flex items-center gap-3 rounded-xl border border-ink-100 p-4 text-sm"><span className="w-2 h-2 rounded-full bg-emerald-500" /><span className="font-medium flex-1">{n}</span><span className="text-xs text-ink-400">开通于 2026-{String(10 - (i % 3)).padStart(2, '0')}-{String(28 - i * 3).padStart(2, '0')}</span><span className="tag-green">已开通</span></div>)}</div>}
          {tab === 'ticket' && <div className="text-center text-ink-400 text-sm py-12">1天内暂无导入或导出的文件</div>}
        </div>
      </div>
    </div>
  )
}
