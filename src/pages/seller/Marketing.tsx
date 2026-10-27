import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Plus, Flame, Ticket, Percent, Layers, Clock, Rocket, Eye, MousePointerClick, Wallet, TrendingUp } from 'lucide-react'
import { useDB, genId } from '@/store/db'
import { useCurrentShop } from '@/lib/hooks'
import { Empty, Field, Img, Modal, PageHeader, Switch, Table, Tabs, type Column } from '@/components/ui'
import { cls, fmtDate, money } from '@/lib/format'
import { toast } from '@/store/session'
import type { Coupon } from '@/data/types'
import { Bars, TrendArea, days, Donut } from '@/components/Charts'

export function Marketing() {
  const shop = useCurrentShop()
  const [sp, setSp] = useSearchParams()
  const tab = sp.get('tab') ?? 'tools'
  const { campaigns, coupons, products, upsertCoupon, upsertCampaign } = useDB()
  const [newCoupon, setNewCoupon] = useState<Coupon | null>(null)
  const [toolTab, setToolTab] = useState<'promo' | 'traffic' | 'user' | 'all'>('promo')
  const my = products.filter(p => p.shopId === shop.id && p.status === 'on')
  const myCoupons = coupons.filter(c => c.shopId === shop.id)
  const blank = (): Coupon => ({ id: genId('cp'), name: '', shopId: shop.id, type: 'full', threshold: 100, value: 10, total: 1000, used: 0, startAt: new Date().toISOString(), endAt: new Date(Date.now() + 30 * 864e5).toISOString(), status: 'active' })
  const cols: Column<Coupon>[] = [
    { key: 'name', title: '券名称', render: c => <div><div className="font-medium">{c.name}</div><div className="text-xs text-ink-400 font-num">{c.id}</div></div> },
    { key: 'face', title: '面额', render: c => <span className="price">{c.type === 'discount' ? `${c.value * 10}折` : `¥${c.value}`}</span> },
    { key: 'threshold', title: '门槛', render: c => c.threshold ? `满 ¥${c.threshold}` : '无门槛' },
    { key: 'use', title: '领取/总量', render: c => <div><div className="font-num">{c.used} / {c.total}</div><div className="w-24 h-1.5 bg-ink-100 rounded-full mt-1 overflow-hidden"><div className="h-full bg-qn-500" style={{ width: `${Math.min(100, (c.used / c.total) * 100)}%` }} /></div></div> },
    { key: 'time', title: '有效期', render: c => <span className="text-xs">{fmtDate(c.startAt, false)} ~ {fmtDate(c.endAt, false)}</span> },
    { key: 'status', title: '状态', render: c => <Switch checked={c.status === 'active'} onChange={v => { upsertCoupon({ ...c, status: v ? 'active' : 'paused' }); toast(v ? '已启用' : '已暂停') }} /> },
  ]
  const tools = [
    ['价格计划', '官方调价工具', '直接设置到手价，自动配置优惠', 'promo', true, 'bg-qn-500'],
    ['搭配购', '搭配促销 · 提升客单', '商品搭配购买，享受优惠', 'promo', true, 'bg-violet-500'],
    ['优惠券', '促销必备 · 多场景', '在多场景的优惠凭证工具', 'promo', false, 'bg-brand-500'],
    ['单品宝-设标价', '提转化 · 以价换量', '单品标价工具，限时限量提转化', 'promo', false, 'bg-teal-500'],
    ['多件优惠（原店铺宝）', '提客单 · 店铺优惠', '满件或满元的合并下单优惠工具', 'promo', false, 'bg-amber-500'],
    ['赠品', '非价格类权益促转化', '下单即赠，满元满件赠，提主品转化', 'promo', false, 'bg-pink-500'],
    ['评价有礼', '积累有效评价', '官方评价运营工具，提商品转化', 'user', false, 'bg-rose-500'],
    ['单品立减', '多SKU调价', '支持sku级设置，精准调整单品券后价', 'promo', false, 'bg-red-500'],
    ['客服专属优惠', '客服提转化', '客服向买家发送的商品立减优惠', 'user', false, 'bg-sky-500'],
    ['店铺引流宝', '店铺引流', '首页/搜索流量加权，拉新促活', 'traffic', false, 'bg-emerald-500'],
    ['会员专享价', '用户营销', '对店铺会员开放专属价格', 'user', false, 'bg-indigo-500'],
    ['关注有礼', '店铺引流', '关注店铺即送优惠券/积分', 'traffic', false, 'bg-cyan-500'],
  ] as const
  const openTool = (name: string) => { if (name === '优惠券') return setSp({ tab: 'coupon' }); if (name === '搭配购') return setSp({ tab: 'bundle' }); if (name.includes('多件')) return setSp({ tab: 'full' }); if (name.includes('单品')) return setSp({ tab: 'discount' }); toast(`${name}：已打开配置面板（演示）`, 'info') }
  const subTitles: Record<string, string> = { enroll: '活动报名', voucher: '消费券', subsidy: '百亿补贴', flash: '限时秒杀', super: '超级立减', coins: '金币', brand: '品牌新享', bid: '爆款竞价', price: '价保管理', refund: '自动退差', risk: '营销风险', overseas: '海外增长', more: '更多玩法', coupon: '店铺优惠券', discount: '限时折扣', full: '满减满折', bundle: '搭配套餐', presale: '预售' }
  const descs: Record<string, string> = { discount: '对指定商品设置折扣价并限定时间，提升转化。', full: '设置满 N 元减 M 元 / 打折，提高客单价。', bundle: '多件商品组合优惠出售。', presale: '定金 + 尾款模式，提前锁定订单。', price: '大促期间价格保护，降价自动补差。', refund: '买家付款后降价自动退差价，减少纠纷。', risk: '监测异常优惠叠加，避免资损。', overseas: '一键开通跨境销售，触达海外买家。', more: '直播专享价、拼团、砍价等更多玩法。' }
  const isCampaignTab = ['campaign', 'enroll', 'voucher', 'subsidy', 'flash', 'super', 'coins', 'brand', 'bid'].includes(tab)
  const isListTab = !!descs[tab]
  return (
    <div>
      {tab === 'tools' ? (
        <div className="space-y-4">
          <div className="card px-5 py-3 flex items-center gap-3"><span className="tag-red">新升级</span><span className="font-semibold">营销助手</span><span className="text-xs text-ink-500 truncate">免费，30万优秀商家使用 · 手动算价易资损？优惠叠加规则记不住？大促活动报名麻烦？营销助手一键搞定！</span><button onClick={() => toast('营销助手已开通')} className="ml-auto btn btn-sm bg-red-600 text-white hover:bg-red-700 shrink-0">立即体验（免费）</button><span className="text-xs text-ink-500 ml-2 shrink-0">🔖 钉钉答疑群 · 📘 产品说明书</span></div>
          <div className="rounded-lg bg-qn-50 border border-qn-100 px-4 py-2.5 text-xs text-ink-700">ⓘ 评价有礼红包活动已于2026.10.08下线，红包活动无法新建和充值。建议尽快迁移至手动现金/智能托管活动，且支持您一键将红包活动迁移至现金，原有活动配置可一键继承，无需重新设置。<span className="text-qn-600 ml-2">查看公告</span></div>
          <div className="card p-5">
            <div className="flex items-center gap-3 mb-4"><div className="font-semibold text-lg">营销工具</div><span className="text-xs text-ink-500">优惠促销、店铺引流、用户营销</span><button onClick={() => setNewCoupon(blank())} className="btn-qn btn-sm ml-auto"><Plus className="w-3.5 h-3.5" />新建优惠券</button></div>
            <div className="flex gap-2 mb-4">{([['promo', '优惠促销'], ['traffic', '店铺引流'], ['user', '用户营销'], ['all', '全部工具']] as const).map(([k, l]) => <button key={k} onClick={() => setToolTab(k)} className={cls('px-4 h-9 rounded-lg text-sm font-medium', toolTab === k ? 'bg-ink-900 text-white' : 'bg-ink-50 text-ink-700 hover:bg-ink-100')}>{l}</button>)}</div>
            <div className="grid grid-cols-3 gap-4">{tools.filter(t => toolTab === 'all' || t[3] === toolTab).map(([n, sub, d, , isNew, c]) => <button key={n} onClick={() => openTool(n)} className="text-left rounded-xl border border-ink-100 p-4 hover:shadow-card hover:border-qn-200 transition flex gap-3"><span className={cls('w-10 h-10 rounded-xl text-white flex items-center justify-center shrink-0', c)}><Ticket className="w-5 h-5" /></span><div className="min-w-0"><div className="font-semibold flex items-center gap-2">{isNew && <span className="tag bg-brand-500 text-white">NEW</span>}{n} <span className="text-ink-300 font-normal text-xs">ⓘ</span></div><div className="text-xs text-qn-600 mt-1">{sub}</div><div className="text-xs text-ink-500 mt-1">{d}</div></div></button>)}</div>
          </div>
          <div className="card p-5">
            <div className="flex gap-2 mb-4 text-sm items-center">{['活动查询', '商品查询', '订单优惠查询', '营销风险'].map((x, i) => <span key={x} className={cls('px-3 h-8 rounded-lg inline-flex items-center', i === 0 ? 'bg-qn-50 text-qn-600 font-medium' : 'text-ink-600')}>{x}{i === 3 && <span className="ml-1 tag-gray">0</span>}</span>)}<div className="ml-auto flex gap-2"><input aria-label="搜索" className="input-qn w-56" placeholder="活动名称 / 活动ID" /><button className="btn-qn">搜索</button><button onClick={() => toast('数据已导出')} className="btn-outline">导出数据</button></div></div>
            <table className="w-full text-sm"><thead><tr className="bg-ink-50 text-left text-ink-600"><th className="px-3 py-2.5 font-medium">活动类型</th><th className="px-3 py-2.5 font-medium">活动名称</th><th className="px-3 py-2.5 font-medium">活动ID</th><th className="px-3 py-2.5 font-medium">活动状态</th><th className="px-3 py-2.5 font-medium">操作</th></tr></thead><tbody>{myCoupons.map(c => <tr key={c.id} className="border-b border-ink-100"><td className="px-3 py-2.5">店铺券</td><td className="px-3 py-2.5">{c.name}</td><td className="px-3 py-2.5 font-num">{c.id}</td><td className="px-3 py-2.5">{c.status === 'active' ? <span className="text-emerald-600">生效中</span> : <span className="text-ink-400">已暂停</span>}</td><td className="px-3 py-2.5"><button onClick={() => setSp({ tab: 'coupon' })} className="link">查看详情</button></td></tr>)}{campaigns.filter(c => c.products.some(id => my.some(p => p.id === id))).map(c => <tr key={c.id} className="border-b border-ink-100"><td className="px-3 py-2.5">平台活动</td><td className="px-3 py-2.5">{c.name}</td><td className="px-3 py-2.5 font-num">{c.id}</td><td className="px-3 py-2.5">{c.status === 'running' ? <span className="text-emerald-600">生效中</span> : c.status === 'enrolling' ? <span className="text-qn-600">报名中</span> : <span className="text-ink-400">已结束</span>}</td><td className="px-3 py-2.5"><button onClick={() => setSp({ tab: 'enroll' })} className="link">查看详情</button></td></tr>)}</tbody></table>
            <div className="text-center text-xs text-ink-500 py-3">共 {myCoupons.length + campaigns.filter(c => c.products.some(id => my.some(p => p.id === id))).length} 项数据 · 上一页 1 下一页</div>
          </div>
        </div>
      ) : (
        <>
          <PageHeader title={subTitles[tab] ?? '营销活动'} desc="活动报名、店铺优惠券、限时折扣与满减工具。" extra={<><button onClick={() => setSp({ tab: 'tools' })} className="btn-outline">← 营销工具</button><button onClick={() => setNewCoupon(blank())} className="btn-qn"><Plus className="w-4 h-4" />新建优惠券</button></>} />
          <div className="card">
            <div className="px-5"><Tabs items={[{ key: 'enroll', label: '活动报名' }, { key: 'coupon', label: '店铺优惠券' }, { key: 'discount', label: '限时折扣' }, { key: 'full', label: '满减满折' }, { key: 'bundle', label: '搭配套餐' }, { key: 'presale', label: '预售' }]} value={isCampaignTab ? 'enroll' : tab} onChange={k => setSp({ tab: k })} accent="qn" /></div>
            <div className="p-5">
              {isCampaignTab && (
                <div className="grid grid-cols-2 gap-4">
                  {campaigns.filter(c => c.status !== 'draft').map(c => { const enrolled = c.products.filter(id => my.some(p => p.id === id)).length; return (
                    <div key={c.id} className="rounded-xl border border-ink-200 overflow-hidden hover:shadow-card transition">
                      <div className={cls('h-24 p-4 text-white flex flex-col justify-end', c.type === 'festival' ? 'bg-gradient-to-r from-brand-500 to-rose-500' : c.type === 'subsidy' ? 'bg-gradient-to-r from-rose-500 to-pink-500' : c.type === 'flash' ? 'bg-gradient-to-r from-amber-500 to-orange-500' : 'bg-gradient-to-r from-qn-500 to-violet-500')}><div className="text-xs opacity-80 flex items-center gap-1"><Flame className="w-3.5 h-3.5" />{c.type === 'festival' ? '大促活动' : c.type === 'subsidy' ? '百亿补贴' : c.type === 'flash' ? '限时秒杀' : '优惠券活动'}</div><div className="text-xl font-bold">{c.name}</div></div>
                      <div className="p-4 text-sm"><div className="flex items-center justify-between text-ink-600"><span>活动时间</span><span className="text-xs">{fmtDate(c.startAt, false)} ~ {fmtDate(c.endAt, false)}</span></div><div className="flex items-center justify-between text-ink-600 mt-1.5"><span>活动折扣</span><span className="price">{c.discount * 10} 折</span></div><div className="flex items-center justify-between text-ink-600 mt-1.5"><span>已报名商品</span><span className="font-num">{enrolled} 件</span></div><div className="mt-3 flex gap-2"><button onClick={() => { const add = my.filter(p => !c.products.includes(p.id)).slice(0, 3).map(p => p.id); if (!add.length) return toast('店铺商品已全部报名', 'info'); upsertCampaign({ ...c, products: [...c.products, ...add] }); toast(`已报名 ${add.length} 件商品`) }} className={cls('btn-sm flex-1', c.status === 'enrolling' ? 'btn-qn' : 'btn-outline')}>{c.status === 'enrolling' ? '立即报名' : '追加商品'}</button><button className="btn-outline btn-sm">活动规则</button></div></div>
                    </div>
                  ) })}
                </div>
              )}
              {tab === 'coupon' && <Table columns={cols} data={myCoupons} empty="还没有创建优惠券" />}
              {isListTab && (
                <div>
                  <div className="flex items-center gap-3 rounded-xl bg-qn-50 border border-qn-100 p-4 mb-4"><span className="w-10 h-10 rounded-xl bg-qn-500 text-white flex items-center justify-center">{tab === 'discount' ? <Percent className="w-5 h-5" /> : tab === 'full' ? <Ticket className="w-5 h-5" /> : tab === 'bundle' ? <Layers className="w-5 h-5" /> : <Clock className="w-5 h-5" />}</span><div className="text-sm"><div className="font-semibold">{subTitles[tab]}</div><div className="text-ink-500 text-xs">{descs[tab]}</div></div><button onClick={() => toast('活动已创建（演示）')} className="btn-qn ml-auto"><Plus className="w-4 h-4" />创建活动</button></div>
                  <table className="w-full text-sm"><thead><tr className="bg-ink-50 text-left text-ink-600"><th className="px-3 py-2.5 font-medium">商品</th><th className="px-3 py-2.5 font-medium">原价</th><th className="px-3 py-2.5 font-medium">活动价</th><th className="px-3 py-2.5 font-medium">活动时间</th><th className="px-3 py-2.5 font-medium">状态</th></tr></thead><tbody>{my.slice(0, 6).map((p, i) => <tr key={p.id} className="border-b border-ink-100"><td className="px-3 py-2.5"><div className="flex gap-2 items-center"><Img src={p.images[0]} alt="" w={40} h={40} className="w-10 h-10 rounded" /><span className="line-clamp-1 max-w-xs">{p.title}</span></div></td><td className="px-3 py-2.5 font-num text-ink-400 line-through">¥{money(p.price)}</td><td className="px-3 py-2.5 price">¥{money(p.price * 0.85)}</td><td className="px-3 py-2.5 text-xs">{fmtDate(new Date().toISOString(), false)} ~ {fmtDate(new Date(Date.now() + 7 * 864e5).toISOString(), false)}</td><td className="px-3 py-2.5">{i < 3 ? <span className="tag-green">进行中</span> : <span className="tag-gray">未开始</span>}</td></tr>)}</tbody></table>
                  {my.length === 0 && <Empty text="暂无参与商品" />}
                </div>
              )}
            </div>
          </div>
        </>
      )}
      <Modal open={!!newCoupon} onClose={() => setNewCoupon(null)} title="新建店铺优惠券" footer={<><button className="btn-outline" onClick={() => setNewCoupon(null)}>取消</button><button className="btn-qn" disabled={!newCoupon?.name} onClick={() => { upsertCoupon(newCoupon!); setNewCoupon(null); toast('优惠券已创建') }}>创建</button></>}>
        {newCoupon && <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2"><Field label="券名称" required><input className="input-qn" value={newCoupon.name} onChange={e => setNewCoupon({ ...newCoupon, name: e.target.value })} placeholder="如：店铺满 200 减 30" /></Field></div>
          <Field label="类型"><select className="input-qn" value={newCoupon.type} onChange={e => setNewCoupon({ ...newCoupon, type: e.target.value as Coupon['type'] })}><option value="full">满减券</option><option value="discount">折扣券</option><option value="cash">无门槛现金券</option></select></Field>
          <Field label={newCoupon.type === 'discount' ? '折扣（0.9 = 9 折）' : '面额（元）'}><input type="number" step="0.01" className="input-qn" value={newCoupon.value} onChange={e => setNewCoupon({ ...newCoupon, value: Number(e.target.value) })} /></Field>
          <Field label="使用门槛（元）"><input type="number" className="input-qn" value={newCoupon.threshold} onChange={e => setNewCoupon({ ...newCoupon, threshold: Number(e.target.value) })} /></Field>
          <Field label="发放总量"><input type="number" className="input-qn" value={newCoupon.total} onChange={e => setNewCoupon({ ...newCoupon, total: Number(e.target.value) })} /></Field>
          <Field label="开始时间"><input type="date" className="input-qn" value={newCoupon.startAt.slice(0, 10)} onChange={e => setNewCoupon({ ...newCoupon, startAt: new Date(e.target.value).toISOString() })} /></Field>
          <Field label="结束时间"><input type="date" className="input-qn" value={newCoupon.endAt.slice(0, 10)} onChange={e => setNewCoupon({ ...newCoupon, endAt: new Date(e.target.value).toISOString() })} /></Field>
        </div>}
      </Modal>
    </div>
  )
}

export function Promotion() {
  const [sp, setSp] = useSearchParams()
  const tab = sp.get('tab') ?? 'center'
  const shop = useCurrentShop()
  const allProducts = useDB(s => s.products)
  const products = useMemo(() => allProducts.filter(p => p.shopId === shop.id && p.status === 'on'), [allProducts, shop.id])
  const [budget, setBudget] = useState(200)
  const [picked, setPicked] = useState<string[]>(products.slice(0, 2).map(p => p.id))
  const [scene, setScene] = useState('关键词推广')
  const [daysN, setDaysN] = useState(7)
  const [coupon, setCoupon] = useState(true)
  const trend = useMemo(() => days(14, i => ({ 展现: 800 + ((i * 331) % 900), 点击: 40 + ((i * 97) % 80), 花费: 60 + ((i * 53) % 120) })), [])
  const plans = products.slice(0, 5).map((p, i) => ({ id: p.id, p, status: i < 3 ? '推广中' : '已暂停', budget: 100 + i * 50, spend: 23.5 + i * 31, show: 1200 + i * 800, click: 56 + i * 40, roi: (2.1 + i * 0.6).toFixed(2) }))
  const hot = products[0]
  const cost = Math.max(0, picked.length * daysN * 10 - (coupon ? 100 : 0))
  const titles: Record<string, string> = { center: '推广中心', all: '货品全站推', keyword: '关键词推广', crowd: '人群推广', content: '内容推广', union: '联盟推广', tools: '推广工具', data: '推广数据' }
  if (tab === 'center') return (
    <div className="space-y-4">
      <div className="card overflow-hidden">
        <div className="h-[72px] bg-gradient-to-r from-[#ff2d79] via-[#ff5a9e] to-[#ffb3d1] flex items-center px-7 text-white relative"><span className="text-2xl font-black tracking-wide">抢夺商品成交机会</span><div className="flex gap-2 ml-5">{['成交托管', '官方保障', '智能诊断'].map(x => <span key={x} className="tag bg-white/25 text-white h-6 px-2.5">◉ {x}</span>)}</div><Link to="/seller/promotion?tab=tools" className="ml-auto border border-white/80 rounded-full px-4 py-1 text-sm">前往万相台 ›</Link><Rocket className="w-14 h-14 ml-6 opacity-90 -rotate-45" /></div>
        <div className="p-6">
          <div className="rounded-2xl bg-gradient-to-r from-pink-50 to-violet-50 p-4 grid grid-cols-[230px_1fr] gap-4 items-center">
            <div className="relative bg-white rounded-xl p-3 flex gap-3 items-center shadow-card"><span className="absolute -top-3 left-3 tag bg-violet-600 text-white">🔔 商机提醒</span>{hot && <><Img src={hot.images[0]} alt="" w={44} h={44} className="w-11 h-11 rounded" /><div className="text-xs"><div className="line-clamp-2 text-ink-900">{hot.title}</div><div className="text-ink-400 font-num mt-0.5">ID:{hot.id.toUpperCase()}2026</div></div></>}</div>
            <div className="bg-white rounded-xl p-4 shadow-card text-sm"><div className="grid grid-cols-[70px_1fr_1fr] gap-4 items-center"><span className="font-semibold">商机信息</span><div><div className="text-xs text-ink-500">商品浏览数</div><div className="font-num text-2xl font-bold">{Math.max(1, Math.round((hot?.views ?? 0) / 1000))} <span className="text-xs font-normal">个</span></div></div><div><div className="text-xs text-ink-500">正在浏览相似商品的用户数</div><div className="font-num text-2xl font-bold">5325 <span className="text-xs font-normal">个</span></div></div></div><div className="grid grid-cols-[70px_1fr] gap-4 items-center mt-2"><span className="font-semibold">流量机会</span><div className="bg-violet-50 rounded px-3 py-1.5 text-xs text-ink-700">👥 这些人群正在浏览相似商品：李**6、s**g、j**u</div></div></div>
          </div>
          <div className="mt-6 grid grid-cols-[80px_1fr] gap-y-6 items-center text-sm">
            <span className="text-ink-600">专属权益</span>
            <button onClick={() => setCoupon(c => !c)} className="w-[320px] h-[72px] rounded-xl bg-gradient-to-r from-red-500 to-rose-500 text-white flex items-center overflow-hidden text-left"><div className="w-28 h-full flex items-center justify-center bg-white/15 border-r border-dashed border-white/50"><span className="font-num text-3xl font-bold">100</span><span className="text-xs mt-2 ml-0.5">元</span></div><div className="px-4 flex-1"><div className="font-bold text-base">惊喜回归券</div><div className="text-xs opacity-90">下单自动领券</div></div><span className="pr-4 text-xs flex items-center gap-1">{coupon ? '已选' : '未选'}<span className={cls('w-4 h-4 rounded-full border-2 border-white', coupon && 'bg-white')} /></span></button>
            <span className="text-ink-600 self-start pt-2">添加商品</span>
            <div className="grid grid-cols-4 gap-3">{products.slice(0, 8).map(p => <button key={p.id} onClick={() => setPicked(s => s.includes(p.id) ? s.filter(x => x !== p.id) : [...s, p.id])} className={cls('rounded-xl border-2 p-2 flex gap-2 items-center text-left', picked.includes(p.id) ? 'border-pink-500 bg-pink-50/40' : 'border-ink-200')}><Img src={p.images[0]} alt="" w={44} h={44} className="w-11 h-11 rounded" /><div className="text-xs line-clamp-2">{p.title}</div></button>)}</div>
            <span className="text-ink-600">推广场景</span>
            <div className="flex items-center gap-8"><div className="flex gap-2">{['关键词推广', '人群推广', '货品全站推'].map(s => <button key={s} onClick={() => setScene(s)} className={cls('btn-sm btn border', scene === s ? 'border-pink-500 text-pink-600 bg-pink-50' : 'border-ink-200')}>{s}</button>)}</div><span className="text-ink-600">推广时长</span><div className="flex gap-2">{[3, 7, 15, 30].map(d => <button key={d} onClick={() => setDaysN(d)} className={cls('btn-sm btn border', daysN === d ? 'border-pink-500 text-pink-600 bg-pink-50' : 'border-ink-200')}>{d}天</button>)}</div></div>
          </div>
        </div>
        <div className="border-t border-ink-100 px-6 h-16 flex items-center justify-end gap-4 text-sm"><span className="text-xs text-red-500 bg-red-50 rounded px-2 py-1">🎁 限时领取100元权益</span><span className="text-ink-500">需支付 <span className="price text-xl">¥{money(cost)}</span></span><span className="text-ink-500">优惠减 <span className="font-num text-ink-800">¥-{coupon ? 100 : 0}</span></span><button onClick={() => toast(`已创建${scene}计划：${picked.length} 件商品 · ${daysN} 天`)} className="btn btn-lg bg-gradient-to-r from-red-500 to-pink-500 text-white px-10 font-semibold hover:opacity-90">立即抢占成交机会</button></div>
      </div>
    </div>
  )
  return (
    <div>
      <PageHeader title={titles[tab] ?? '推广'} desc="万相台 / 直通车 / 引力魔方 一站式投放。" extra={<button onClick={() => toast('推广计划已创建')} className="btn-qn"><Rocket className="w-4 h-4" />新建计划</button>} />
      <div className="card mb-4"><div className="px-5"><Tabs items={[{ key: 'all', label: '货品全站推' }, { key: 'keyword', label: '关键词推广' }, { key: 'crowd', label: '人群推广' }, { key: 'content', label: '内容推广' }, { key: 'union', label: '联盟推广' }, { key: 'data', label: '推广数据' }]} value={tab === 'tools' ? 'all' : tab} onChange={k => setSp({ tab: k })} accent="qn" /></div>
        <div className="p-5">
          <div className="grid grid-cols-5 gap-3 mb-5">
            {[[<Wallet />, '账户余额', '¥1,286.40'], [<Eye />, '今日展现', '12,380'], [<MousePointerClick />, '今日点击', '486'], [<TrendingUp />, '投产比 ROI', '3.42'], [<Flame />, '今日花费', '¥168.20']].map(([ic, l, v]) => <div key={l as string} className="bg-ink-50 rounded-xl p-4 flex items-center gap-3"><span className="w-10 h-10 rounded-xl bg-white text-qn-600 flex items-center justify-center [&>svg]:w-5 [&>svg]:h-5 shadow-card">{ic as React.ReactNode}</span><div><div className="text-xs text-ink-500">{l as string}</div><div className="font-num font-semibold text-lg">{v as string}</div></div></div>)}
          </div>
          {tab === 'data' ? <div className="grid grid-cols-[1fr_320px] gap-4"><div><div className="font-semibold mb-2">近 14 天投放趋势</div><TrendArea data={trend} keys={['展现', '点击', '花费']} height={260} /></div><div><div className="font-semibold mb-2">流量来源</div><Donut data={[{ name: '搜索', value: 46 }, { name: '推荐', value: 32 }, { name: '直播', value: 12 }, { name: '其他', value: 10 }]} /></div></div> : (
            <>
              <div className="flex items-center gap-4 rounded-xl border border-ink-200 p-4 mb-4"><div className="text-sm font-medium">智能投放日预算</div><input type="range" min={50} max={2000} step={50} value={budget} onChange={e => setBudget(Number(e.target.value))} className="flex-1 accent-qn-500" aria-label="预算" /><span className="font-num font-semibold w-20">¥{budget}</span><button onClick={() => toast(`日预算已设置为 ¥${budget}`)} className="btn-qn btn-sm">保存</button></div>
              <table className="w-full text-sm"><thead><tr className="bg-ink-50 text-left text-ink-600"><th className="px-3 py-2.5 font-medium">推广商品</th><th className="px-3 py-2.5 font-medium">状态</th><th className="px-3 py-2.5 font-medium">日预算</th><th className="px-3 py-2.5 font-medium">今日花费</th><th className="px-3 py-2.5 font-medium">展现</th><th className="px-3 py-2.5 font-medium">点击</th><th className="px-3 py-2.5 font-medium">ROI</th><th className="px-3 py-2.5 font-medium">操作</th></tr></thead><tbody>{plans.map(pl => <tr key={pl.id} className="border-b border-ink-100"><td className="px-3 py-2.5"><div className="flex gap-2 items-center"><Img src={pl.p.images[0]} alt="" w={40} h={40} className="w-10 h-10 rounded" /><span className="line-clamp-1 max-w-xs">{pl.p.title}</span></div></td><td className="px-3 py-2.5">{pl.status === '推广中' ? <span className="tag-green">推广中</span> : <span className="tag-gray">已暂停</span>}</td><td className="px-3 py-2.5 font-num">¥{pl.budget}</td><td className="px-3 py-2.5 font-num">¥{money(pl.spend)}</td><td className="px-3 py-2.5 font-num">{pl.show}</td><td className="px-3 py-2.5 font-num">{pl.click}</td><td className="px-3 py-2.5 font-num text-emerald-600">{pl.roi}</td><td className="px-3 py-2.5"><button onClick={() => toast(pl.status === '推广中' ? '已暂停' : '已开启')} className="link">{pl.status === '推广中' ? '暂停' : '开启'}</button></td></tr>)}</tbody></table>
              <div className="mt-5"><div className="font-semibold mb-2">近 14 天展现 / 点击</div><Bars data={trend} keys={['展现', '点击']} height={220} /></div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
