import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Boxes, Package, Warehouse, MapPinOff, ListChecks, Truck, Stethoscope, Layers, ChevronRight, Info, Flame, Upload, Settings2 } from 'lucide-react'
import { useDB } from '@/store/db'
import { useCurrentShop } from '@/lib/hooks'
import { Empty, Img, Select, Switch, Tabs } from '@/components/ui'
import { cls, money, fmtDate } from '@/lib/format'
import { toast } from '@/store/session'

const INV_TABS = [['home', '库存首页'], ['manage', '库存管理'], ['negative', '负卖库存管理'], ['channel', '渠道库存设置'], ['region', '区域限售管理'], ['warehouse', '仓库管理'], ['priority', '仓库优先级设置'], ['diagnose', '库存诊断']] as const

export function Inventory() {
  const shop = useCurrentShop()
  const [sp, setSp] = useSearchParams()
  if (sp.get('tab') === 'sku') return <SkuCenter />
  const tab = (sp.get('tab') ?? 'home') as typeof INV_TABS[number][0]
  const { products, upsertProduct } = useDB()
  const my = products.filter(p => p.shopId === shop.id)
  const skus = my.flatMap(p => p.skus.map(s => ({ p, s })))
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState('all')
  const [mode, setMode] = useState<'sale' | 'fulfil' | 'after'>('sale')
  const rows = skus.filter(({ p, s }) => (!q || p.title.includes(q)) && (filter === 'all' || (filter === 'low' ? s.stock < 20 && s.stock > 0 : s.stock === 0)))
  const stat = [['今日在架商品数', my.filter(p => p.status === 'on').length], ['今日缺货商品数', my.filter(p => p.stock === 0).length], ['今日低库存商品数', my.filter(p => p.stock > 0 && p.stock < 50).length], ['今日热销sku缺货商品数', my.filter(p => p.sales > 10000 && p.skus.some(s => s.stock === 0)).length], ['今日发货时间商品数', my.filter(p => !p.freeShipping).length]]
  return (
    <div className="card">
      <div className="mx-5 mt-4 rounded-lg bg-qn-50 border border-qn-100 px-4 py-2.5 text-xs text-ink-700 flex items-start gap-2"><Info className="w-4 h-4 text-qn-500 shrink-0 mt-0.5" /><span><span className="text-brand-500">【通知】2026年10月7日20:00:00-2026年11月11日23:59:59期间10月超级88大促商品，禁止新增、增加、减小直播流量渠道库存。</span>为保障双十一大促期间系统稳定，2026年10月15日 15:00:00到2026年10月15日 20:30:00、2026年10月20日 15:00:00到2026年10月20日 22:00:00禁止新建、编辑、删除仓库信息，禁止修改仓覆盖范围等，请您见谅</span><span className="ml-auto text-ink-400 whitespace-nowrap">‹ 1 / 2 ›</span></div>
      <div className="px-5"><Tabs items={INV_TABS.map(([k, l]) => ({ key: k, label: l }))} value={tab} onChange={k => setSp({ tab: k })} accent="qn" /></div>
      <div className="p-5">
        {tab === 'home' && (
          <div className="grid grid-cols-[1fr_280px] gap-5 items-start">
            <div className="space-y-5">
              <div className="rounded-xl border border-ink-100 p-5"><div className="flex items-center justify-between"><div className="font-semibold flex items-center gap-2">库存数据<span className="text-xs text-ink-400 font-normal">除了标识"今日"的为实时数据，其他是昨日数据</span></div><button className="text-xs text-ink-500 flex items-center gap-1">⊞ 指标</button></div><div className="grid grid-cols-5 mt-4">{stat.map(([l, v]) => <div key={l as string}><div className="text-xs text-ink-500">{l as string} ⓘ</div><div className="text-2xl font-num font-semibold mt-1">{v as number}</div><div className="text-xs text-ink-400 mt-1">--</div></div>)}</div></div>
              <div className="rounded-xl bg-ink-50 px-5 py-3 flex items-center gap-2 font-semibold"><Flame className="w-4 h-4 text-brand-500" />为您推荐功能<span className="text-xs text-ink-500 font-normal">切换不同库存模式，查看对应功能，轻松管理库存～</span></div>
              <div className="flex items-center justify-between"><div className="flex gap-2">{([['sale', '销售', <Boxes className="w-5 h-5" />], ['fulfil', '履约', <Truck className="w-5 h-5" />], ['after', '售后', <Package className="w-5 h-5" />]] as const).map(([k, l, ic]) => <button key={k} onClick={() => setMode(k)} className={cls('flex items-center gap-3 px-5 h-12 rounded-lg border-b-2 transition', mode === k ? 'border-qn-500 text-qn-600 bg-qn-50/50' : 'border-transparent text-ink-600 hover:bg-ink-50')}>{l}<span className="text-qn-400">{ic}</span></button>)}</div><div className="text-sm border border-ink-200 rounded-lg px-3 h-9 flex items-center gap-2">普通商品库存 <span className="text-qn-600">已开通</span> ▾</div></div>
              <div className="font-semibold text-lg">{mode === 'sale' ? '卖多少' : mode === 'fulfil' ? '发多快' : '退到哪'}</div>
              <div className="grid grid-cols-2 gap-4">{(mode === 'sale' ? [['现货库存', '适用于最简单的库存管理模式', '基于规格编辑库存', true, 'bg-emerald-500'], ['商品批次库存', '将非现货的库存提前售卖，增加销售机会。需设置批次库存的发货时间，按时履约', '多批次库存 · 先现货后批次无缝切换', true, 'bg-amber-500'], ['负卖库存', '库存为 0 后继续售卖，适合定制/预售商品', '按承诺发货时间履约', false, 'bg-violet-500'], ['渠道库存', '为直播、分销等渠道独立分配库存', '渠道独立计数', false, 'bg-qn-500']] : mode === 'fulfil' ? [['多仓发货', '按买家地址就近仓发货，缩短物流时长', '仓库优先级自动匹配', true, 'bg-sky-500'], ['区域限售', '限制部分区域不可售，避免无法履约', '按省市区设置', false, 'bg-rose-500']] : [['退货仓', '设置统一退货地址与仓库', '自动同步到售后单', true, 'bg-teal-500'], ['退货入库', '退货签收后自动回补库存', '可按 SKU 核对', true, 'bg-emerald-500']]).map(([t, d, s, on, c]) => <div key={t as string} className="rounded-xl bg-ink-50 p-4 flex gap-3"><span className={cls('w-10 h-10 rounded-xl text-white flex items-center justify-center shrink-0', c as string)}><Warehouse className="w-5 h-5" /></span><div className="flex-1"><div className="font-medium">{t as string} <span className="text-xs text-qn-600 font-normal ml-1">操作说明</span></div><div className="text-xs text-ink-500 mt-1">{d as string}</div><div className="text-xs text-ink-400 mt-2 bg-white rounded px-2 py-1 inline-block">{s as string}</div></div><Switch checked={on as boolean} onChange={() => toast('库存模式已更新')} /></div>)}</div>
            </div>
            <div className="space-y-4">
              <div className="rounded-xl bg-gradient-to-br from-qn-50 to-sky-50 border border-qn-100 p-4"><div className="flex items-center justify-between font-semibold"><span className="flex items-center gap-1.5"><Stethoscope className="w-4 h-4 text-qn-500" />诊断咨询助手</span><span className="text-xs text-qn-600 font-normal flex items-center">进入<ChevronRight className="w-3 h-3" /></span></div><span className="inline-block mt-2 tag bg-qn-500 text-white">猜你想问</span><div className="mt-2 bg-white/70 rounded-lg p-3 text-xs text-ink-600 space-y-2">{['有哪些商品当前缺货？', '有库存却提示已卖光？', '设置了区域限售但未生效？'].map(x => <div key={x} className="cursor-pointer hover:text-qn-600" onClick={() => toast(`AI 诊断：${x.replace('？', '')} → 已为您定位 ${my.filter(p => p.stock === 0).length} 个相关商品`, 'info')}>{x}</div>)}</div></div>
              <div><div className="font-semibold mb-3">更多功能</div><div className="grid grid-cols-3 gap-3">{[[<Boxes />, '库存管理', 'manage', 'bg-teal-400'], [<MapPinOff />, '区域限售', 'region', 'bg-cyan-500'], [<Layers />, '渠道库存', 'channel', 'bg-qn-500'], [<Warehouse />, '仓库管理', 'warehouse', 'bg-violet-500'], [<ListChecks />, '批量任务历史', 'manage', 'bg-qn-600'], [<Flame />, '错失商机', 'diagnose', 'bg-brand-500'], [<Settings2 />, '优先级', 'priority', 'bg-indigo-500'], [<Upload />, '批量导入', 'manage', 'bg-emerald-500'], [<Truck />, '发货设置', 'fulfil', 'bg-orange-500']].map(([ic, l, t, c]) => <button key={l as string} onClick={() => setSp({ tab: t as string })} className="flex flex-col items-center gap-1.5 text-xs text-ink-700"><span className={cls('w-11 h-11 rounded-xl text-white flex items-center justify-center [&>svg]:w-5 [&>svg]:h-5', c as string)}>{ic as React.ReactNode}</span>{l as string}</button>)}</div></div>
            </div>
          </div>
        )}
        {(tab === 'manage' || tab === 'negative' || tab === 'channel') && (
          <div>
            <div className="flex gap-2 mb-4"><input aria-label="搜索" className="input-qn w-72" placeholder="商品标题 / SKU 编码" value={q} onChange={e => setQ(e.target.value)} /><Select value={filter} onChange={setFilter} options={[{ value: 'all', label: '全部' }, { value: 'low', label: '低库存 (<20)' }, { value: 'out', label: '缺货' }]} /><button className="btn-qn" onClick={() => toast(`找到 ${rows.length} 个 SKU`, 'info')}>搜索</button><button onClick={() => toast('库存已导出')} className="btn-outline ml-auto">导出</button><button onClick={() => toast('批量导入任务已创建')} className="btn-outline">批量导入</button></div>
            <table className="w-full text-sm"><thead><tr className="bg-ink-50 text-ink-600 text-left"><th className="px-3 py-2.5 font-medium">商品</th><th className="px-3 py-2.5 font-medium">SKU</th><th className="px-3 py-2.5 font-medium">规格</th><th className="px-3 py-2.5 font-medium">价格</th><th className="px-3 py-2.5 font-medium">{tab === 'channel' ? '直播渠道库存' : tab === 'negative' ? '负卖上限' : '现货库存'}</th><th className="px-3 py-2.5 font-medium">状态</th><th className="px-3 py-2.5 font-medium">操作</th></tr></thead>
              <tbody>{rows.slice(0, 60).map(({ p, s }) => <tr key={s.id} className="border-b border-ink-100"><td className="px-3 py-2"><div className="flex gap-2 items-center"><Img src={p.images[0]} alt="" w={36} h={36} className="w-9 h-9 rounded" /><span className="line-clamp-1 max-w-[260px]">{p.title}</span></div></td><td className="px-3 py-2 font-num text-xs text-ink-500">{s.id}</td><td className="px-3 py-2 text-xs">{Object.values(s.attrs).join(' / ')}</td><td className="px-3 py-2 font-num">¥{money(s.price)}</td><td className="px-3 py-2"><input type="number" aria-label="库存" className="input-qn h-8 w-24" value={s.stock} onChange={e => { const skus = p.skus.map(x => x.id === s.id ? { ...x, stock: Number(e.target.value) } : x); upsertProduct({ ...p, skus, stock: skus.reduce((a, x) => a + x.stock, 0) }) }} /></td><td className="px-3 py-2">{s.stock === 0 ? <span className="tag-red">缺货</span> : s.stock < 20 ? <span className="tag-gold">低库存</span> : <span className="tag-green">正常</span>}</td><td className="px-3 py-2"><button onClick={() => { const skus = p.skus.map(x => x.id === s.id ? { ...x, stock: x.stock + 100 } : x); upsertProduct({ ...p, skus, stock: skus.reduce((a, x) => a + x.stock, 0) }); toast('已补货 +100') }} className="link">补货 +100</button></td></tr>)}</tbody></table>
            {rows.length === 0 && <Empty text="暂无 SKU" />}
          </div>
        )}
        {tab === 'region' && <div className="space-y-3"><div className="text-sm text-ink-500">设置后，限售区域的买家将无法下单该商品。</div>{['新疆 / 西藏 / 内蒙古（偏远地区）', '港澳台地区', '海外地区'].map((r, i) => <div key={r} className="flex items-center gap-3 rounded-xl border border-ink-100 p-4"><MapPinOff className="w-5 h-5 text-rose-500" /><div className="flex-1 font-medium">{r}</div><span className="text-xs text-ink-400">应用于 {i === 0 ? my.length : 0} 件商品</span><Switch checked={i === 0} onChange={() => toast('区域限售规则已更新')} /></div>)}</div>}
        {(tab === 'warehouse' || tab === 'priority') && <div><div className="flex justify-end mb-3"><button onClick={() => toast('仓库已新建')} className="btn-qn btn-sm">+ 新建仓库</button></div><table className="w-full text-sm"><thead><tr className="bg-ink-50 text-ink-600 text-left"><th className="px-3 py-2.5 font-medium">优先级</th><th className="px-3 py-2.5 font-medium">仓库名称</th><th className="px-3 py-2.5 font-medium">仓库地址</th><th className="px-3 py-2.5 font-medium">覆盖区域</th><th className="px-3 py-2.5 font-medium">库存占比</th><th className="px-3 py-2.5 font-medium">状态</th></tr></thead><tbody>{[['主仓', shop.address, '全国', 70], ['华南分仓', '广东 东莞', '广东 / 广西 / 福建 / 海南', 20], ['华北分仓', '河北 廊坊', '京津冀 / 山东 / 山西', 10]].map(([n, a, r, pct], i) => <tr key={n as string} className="border-b border-ink-100"><td className="px-3 py-3"><span className="w-6 h-6 rounded-md bg-qn-500 text-white inline-flex items-center justify-center text-xs">{i + 1}</span></td><td className="px-3 py-3 font-medium">{n as string}</td><td className="px-3 py-3">{a as string}</td><td className="px-3 py-3 text-xs">{r as string}</td><td className="px-3 py-3"><div className="flex items-center gap-2"><div className="w-24 h-1.5 bg-ink-100 rounded-full overflow-hidden"><div className="h-full bg-qn-500" style={{ width: `${pct}%` }} /></div><span className="text-xs font-num">{pct as number}%</span></div></td><td className="px-3 py-3"><span className="tag-green">启用</span></td></tr>)}</tbody></table></div>}
        {tab === 'diagnose' && <div className="grid grid-cols-3 gap-4">{[['缺货商品', my.filter(p => p.stock === 0).length, '近 7 天因缺货错失约 ¥' + money(1280), 'text-red-600'], ['低库存预警', my.filter(p => p.stock > 0 && p.stock < 50).length, '建议 3 天内补货', 'text-amber-700'], ['库存积压', my.filter(p => p.stock > 800).length, '30 天动销率低于 5%', 'text-ink-600']].map(([t, n, d, c]) => <div key={t as string} className="rounded-xl border border-ink-100 p-5"><div className="text-sm text-ink-500">{t as string}</div><div className={cls('text-3xl font-num font-bold mt-1', c as string)}>{n as number}</div><div className="text-xs text-ink-400 mt-2">{d as string}</div><button onClick={() => setSp({ tab: 'manage' })} className="link text-xs mt-3">查看明细 ›</button></div>)}<div className="col-span-3 text-xs text-ink-400">诊断时间：{fmtDate(new Date().toISOString())}</div></div>}
      </div>
    </div>
  )
}

export function SkuCenter() {
  const shop = useCurrentShop()
  const { products } = useDB()
  const my = useMemo(() => products.filter(p => p.shopId === shop.id), [products, shop.id])
  const [cur, setCur] = useState(my[0]?.id ?? '')
  const [code, setCode] = useState('')
  const [status, setStatus] = useState('')
  const p = my.find(x => x.id === cur)
  const rows = (p?.skus ?? []).filter(s => (!code || s.id.includes(code)) && (!status || (status === 'on' ? s.stock > 0 : s.stock === 0)))
  const total = my.reduce((a, x) => a + x.skus.length, 0)
  return (
    <div className="card">
      <div className="px-5"><Tabs items={[{ key: 'all', label: `全部SKU(${total})` }]} value="all" onChange={() => {}} accent="qn" size="lg" /></div>
      <div className="px-5 py-4 grid grid-cols-[1fr_1fr_1fr_1fr_auto] gap-3">
        <input aria-label="SKU商家编码" className="input-qn" placeholder="SKU商家编码" value={code} onChange={e => setCode(e.target.value)} />
        <select aria-label="SKU状态" className="input-qn" value={status} onChange={e => setStatus(e.target.value)}><option value="">SKU状态 请选择</option><option value="on">在售</option><option value="off">售罄</option></select>
        <select aria-label="SKU分类" className="input-qn"><option>SKU分类 请选择</option><option>颜色</option><option>尺码</option></select>
        <select aria-label="SKU动销" className="input-qn"><option>SKU动销 请选择</option><option>动销</option><option>滞销</option></select>
        <div className="flex gap-2"><button className="btn-qn" onClick={() => toast(`找到 ${rows.length} 个 SKU`, 'info')}>搜索</button><button className="btn-ghost" onClick={() => { setCode(''); setStatus('') }}>重置</button><button className="btn-ghost text-ink-500">排序 展开 ▾</button></div>
      </div>
      <div className="px-5 pb-3 flex gap-2">{['素材批量导入', 'SKU素材托管设置', '批量上下架', '批量删除素材'].map(b => <button key={b} onClick={() => toast(`${b}：任务已创建`)} className="btn-outline h-10">{b}</button>)}</div>
      <div className="mx-5 mb-4 rounded-lg border border-ink-200 px-4 py-2.5 text-xs text-ink-600">📢 SKU管理页全新上线！批量编辑、一键上下架、素材批量上传能力已就绪，<span className="text-qn-600">查看操作说明</span>，快速上手。<span className="text-qn-600">点此进行建议反馈</span></div>
      <div className="px-5 pb-5 grid grid-cols-[290px_1fr] gap-4">
        <div className="bg-ink-50 rounded-lg p-3 max-h-[560px] overflow-auto"><div className="flex items-center justify-between font-medium mb-2 px-1"><span className="flex items-center gap-1.5"><Package className="w-4 h-4" />商品</span><span className="text-ink-400">⇤</span></div>{my.map(x => <button key={x.id} onClick={() => setCur(x.id)} className={cls('w-full text-left flex gap-2 items-center p-2 rounded-lg', cur === x.id ? 'bg-white shadow-card' : 'hover:bg-white/60')}><Img src={x.images[0]} alt="" w={40} h={40} className="w-10 h-10 rounded" /><div className="min-w-0"><div className="text-xs line-clamp-2">{x.title}</div><div className="text-[10px] text-ink-400">{x.skus.length} 个 SKU</div></div></button>)}</div>
        <div><table className="w-full text-sm"><thead><tr className="bg-ink-50 text-ink-600 text-left"><th className="px-3 py-2.5 font-medium">SKU信息</th><th className="px-3 py-2.5 font-medium">搜索主图</th><th className="px-3 py-2.5 font-medium">搜索标题</th><th className="px-3 py-2.5 font-medium">价格</th><th className="px-3 py-2.5 font-medium">数量</th><th className="px-3 py-2.5 font-medium">属性</th></tr></thead><tbody>{p && rows.map((s, i) => <tr key={s.id} className="border-b border-ink-100"><td className="px-3 py-2.5"><div className="text-xs"><div className="font-num">{s.id}</div><div className="text-ink-400">{s.stock > 0 ? '在售' : '售罄'}</div></div></td><td className="px-3 py-2.5"><Img src={p.images[i % p.images.length]} alt="" w={48} h={48} className="w-12 h-12 rounded" /></td><td className="px-3 py-2.5 text-xs max-w-[240px]"><div className="line-clamp-2">{p.title} {Object.values(s.attrs).join(' ')}</div></td><td className="px-3 py-2.5 font-num">¥{money(s.price)}</td><td className="px-3 py-2.5 font-num">{s.stock}</td><td className="px-3 py-2.5 text-xs">{Object.entries(s.attrs).map(([k, v]) => <div key={k}>{k}：{v}</div>)}</td></tr>)}</tbody></table>{(!p || rows.length === 0) && <Empty text="暂无数据" />}</div>
      </div>
    </div>
  )
}
