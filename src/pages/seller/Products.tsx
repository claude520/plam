import { useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ChevronDown, Plus, ArrowUpDown, Package } from 'lucide-react'
import { useDB } from '@/store/db'
import { useCurrentShop } from '@/lib/hooks'
import { Confirm, Empty, Img, PageHeader, Pagination, Select, Stat, Tabs } from '@/components/ui'
import { cls, fmtDate, money, PRODUCT_STATUS } from '@/lib/format'
import { toast } from '@/store/session'
import type { Product } from '@/data/types'

export function ProductList() {
  const shop = useCurrentShop()
  const [sp, setSp] = useSearchParams()
  const nav = useNavigate()
  const tab = sp.get('tab') ?? 'all'
  const { products, categories, upsertProduct, removeProduct } = useDB()
  const [q, setQ] = useState(sp.get('q') ?? '')
  const [pid, setPid] = useState('')
  const [code, setCode] = useState('')
  const [cat, setCat] = useState('')
  const [sort, setSort] = useState<'created' | 'price' | 'stock' | 'sales'>('created')
  const [sel, setSel] = useState<string[]>([])
  const [del, setDel] = useState<string[] | null>(null)
  const [page, setPage] = useState(1)
  const my = useMemo(() => products.filter(p => p.shopId === shop.id), [products, shop.id])
  // 定时上架：到点自动从仓库上架
  useEffect(() => {
    const now = Date.now()
    my.filter(p => p.status === 'off' && p.pub?.listing === 'timed' && p.pub.listAt && new Date(p.pub.listAt).getTime() <= now).forEach(p => { upsertProduct({ ...p, status: 'on', pub: { ...p.pub!, listing: 'now' } }); toast(`「${p.title.slice(0, 12)}」已到定时上架时间，自动上架`) })
  }, [my]) // eslint-disable-line
  const list = useMemo(() => {
    let r = my
    if (tab === 'on') r = r.filter(p => p.status === 'on')
    else if (tab === 'off') r = r.filter(p => p.status === 'off' || p.status === 'pending')
    else if (tab === 'draft') r = r.filter(p => p.status === 'draft')
    else if (tab === 'violation') r = r.filter(p => p.status === 'rejected')
    else if (tab === 'recycle') r = []
    if (q) r = r.filter(p => p.title.includes(q))
    if (pid) r = r.filter(p => pid.split(/[\s,，]+/).includes(p.id))
    if (code) r = r.filter(p => (p.pub?.sellerCode ?? '').includes(code))
    if (cat) r = r.filter(p => p.categoryId === cat)
    return [...r].sort((a, b) => sort === 'price' ? b.price - a.price : sort === 'stock' ? b.stock - a.stock : sort === 'sales' ? b.sales - a.sales : b.createdAt.localeCompare(a.createdAt))
  }, [my, tab, q, pid, code, cat, sort])
  const cnt = (f: (p: Product) => boolean) => my.filter(f).length
  const tabs = [{ key: 'all', label: `全部(${my.length})` }, { key: 'on', label: `出售中(${cnt(p => p.status === 'on')})` }, { key: 'off', label: `仓库中(${cnt(p => p.status === 'off' || p.status === 'pending')})` }, { key: 'draft', label: `草稿(${cnt(p => p.status === 'draft')})` }, { key: 'recycle', label: '回收站(0)' }, { key: 'violation', label: `违规(${cnt(p => p.status === 'rejected')})` }]
  const pageSize = 20
  const rows = list.slice((page - 1) * pageSize, page * pageSize)
  const batch = (status: Product['status']) => { if (!sel.length) return toast('请先勾选商品', 'error'); sel.forEach(id => { const p = my.find(x => x.id === id); if (p) upsertProduct({ ...p, status }) }); toast(`已${status === 'on' ? '上架' : '下架'} ${sel.length} 件商品`); setSel([]) }
  const Th = ({ k, label }: { k: typeof sort; label: string }) => <button onClick={() => setSort(k)} className={cls('inline-flex items-center gap-0.5', sort === k && 'text-qn-600')}>{label}<ArrowUpDown className="w-3 h-3" /></button>

  if (tab === 'quality') return <QualityScore />
  return (
    <div>
      <div className="card">
        <div className="px-5"><Tabs items={tabs} value={tab} onChange={k => { setSp({ tab: k }); setPage(1); setSel([]) }} accent="qn" size="lg" /></div>
        <div className="px-5 py-4 grid grid-cols-[1fr_1fr_1fr_1fr_auto] gap-3">
          <input aria-label="商品标题" className="input-qn" placeholder="商品标题" value={q} onChange={e => setQ(e.target.value)} />
          <input aria-label="商品ID" className="input-qn" placeholder="商品ID 多个ID以逗号或空格分隔" value={pid} onChange={e => setPid(e.target.value)} />
          <input aria-label="商家编码" className="input-qn" placeholder="商家编码" value={code} onChange={e => setCode(e.target.value)} />
          <select aria-label="店铺分类" className="input-qn" value={cat} onChange={e => setCat(e.target.value)}><option value="">店铺分类 请选择</option>{categories.filter(c => c.parentId && my.some(p => p.categoryId === c.id)).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
          <div className="flex gap-2"><button className="btn-qn" onClick={() => toast(`找到 ${list.length} 件商品`, 'info')}>搜索</button><button className="btn-ghost" onClick={() => { setQ(''); setPid(''); setCode(''); setCat('') }}>重置</button><button className="btn-ghost text-ink-500">排序 展开<ChevronDown className="w-3.5 h-3.5" /></button></div>
        </div>
        <div className="px-5 pb-3 flex items-center gap-2">
          <Link to="/seller/publish/category" className="btn-qn h-10 px-5"><Plus className="w-4 h-4" />发布商品</Link>
          <Link to="/seller/inventory?tab=sku" className="btn-outline h-10 relative">SKU管理<span className="absolute -top-2 -right-2 tag bg-brand-500 text-white">new</span></Link>
          <Link to="/seller/shop?tab=decorate" className="btn-outline h-10">商品装修</Link>
          <div className="relative group"><button className="btn-outline h-10">更多批量操作<ChevronDown className="w-3.5 h-3.5" /></button><div className="absolute left-0 top-full pt-1 hidden group-hover:block z-20"><div className="bg-white shadow-float rounded-lg py-1 w-36 text-sm"><button onClick={() => batch('on')} className="block w-full text-left px-3 py-2 hover:bg-ink-50">批量上架</button><button onClick={() => batch('off')} className="block w-full text-left px-3 py-2 hover:bg-ink-50">批量下架</button><button onClick={() => { if (!sel.length) return toast('请先勾选商品', 'error'); setDel(sel) }} className="block w-full text-left px-3 py-2 hover:bg-ink-50 text-red-600">批量删除</button></div></div></div>
          <span className="text-sm text-ink-500">已选 {sel.length}</span>
          <span className="ml-auto text-sm text-ink-500">共{list.length}件商品</span>
          <Pagination page={page} pages={Math.max(1, Math.ceil(list.length / pageSize))} onChange={setPage} />
        </div>
        <div className="px-5 pb-5">
          <table className="w-full text-sm">
            <thead><tr className="bg-ink-50 text-ink-600 text-left"><th className="px-3 py-3 w-10"><input type="checkbox" aria-label="全选" className="accent-qn-500" checked={rows.length > 0 && rows.every(r => sel.includes(r.id))} onChange={e => setSel(e.target.checked ? [...new Set([...sel, ...rows.map(r => r.id)])] : sel.filter(id => !rows.some(r => r.id === id)))} /></th><th className="px-3 py-3 font-medium">商品名称</th><th className="px-3 py-3 font-medium"><Th k="price" label="价格" /></th><th className="px-3 py-3 font-medium"><Th k="stock" label="库存" /></th><th className="px-3 py-3 font-medium"><Th k="sales" label="累计销量" /></th><th className="px-3 py-3 font-medium">30日销量</th><th className="px-3 py-3 font-medium"><Th k="created" label="创建时间" /></th><th className="px-3 py-3 font-medium">发布时间</th><th className="px-3 py-3 font-medium">状态</th><th className="px-3 py-3 font-medium">操作</th></tr></thead>
            <tbody>{rows.map(p => (
              <tr key={p.id} className="border-b border-ink-100 hover:bg-ink-50/60">
                <td className="px-3 py-3"><input type="checkbox" aria-label="选择" className="accent-qn-500" checked={sel.includes(p.id)} onChange={e => setSel(e.target.checked ? [...sel, p.id] : sel.filter(x => x !== p.id))} /></td>
                <td className="px-3 py-3"><div className="flex gap-3 items-center"><Img src={p.images[0]} alt="" w={56} h={56} className="w-14 h-14 rounded-lg" /><div className="max-w-[320px]"><Link to={`/item/${p.id}`} className="line-clamp-2 text-ink-900 hover:text-qn-600">{p.title}</Link><div className="text-xs text-ink-400 mt-0.5 font-num">ID: {p.id} · {p.skus.length} 个SKU</div></div></div></td>
                <td className="px-3 py-3 font-num">¥{money(p.price)}</td><td className="px-3 py-3 font-num">{p.stock}</td><td className="px-3 py-3 font-num">{p.sales}</td><td className="px-3 py-3 font-num">{Math.round(p.sales * 0.12)}</td>
                <td className="px-3 py-3 text-xs text-ink-500">{fmtDate(p.createdAt)}</td><td className="px-3 py-3 text-xs text-ink-500">{p.status === 'on' ? fmtDate(p.createdAt) : '-'}</td>
                <td className="px-3 py-3"><span className={PRODUCT_STATUS[p.status].cls}>{PRODUCT_STATUS[p.status].label}</span>{p.status === 'off' && p.pub?.listing === 'timed' && p.pub.listAt && <div className="text-[11px] text-amber-700 mt-1 whitespace-nowrap">定时 {p.pub.listAt.replace('T', ' ')}</div>}</td>
                <td className="px-3 py-3"><div className="flex flex-col gap-1 text-xs"><button onClick={() => nav(`/seller/products/${p.id}/edit`)} className="link text-left">编辑</button>{p.status === 'on' ? <button onClick={() => { upsertProduct({ ...p, status: 'off' }); toast('已下架') }} className="link text-left text-ink-500">下架</button> : p.status !== 'pending' && <button onClick={() => { upsertProduct({ ...p, status: 'pending' }); toast('已提交审核') }} className="link text-left text-emerald-700">上架</button>}<button onClick={() => setDel([p.id])} className="link text-left text-red-600">删除</button></div></td>
              </tr>
            ))}</tbody>
          </table>
          {rows.length === 0 && <Empty text="没有数据" icon={<Package className="w-6 h-6" />} />}
          <div className="flex items-center justify-center gap-3 py-3 text-sm text-ink-500">共{list.length}件商品<Pagination page={page} pages={Math.max(1, Math.ceil(list.length / pageSize))} onChange={setPage} /></div>
        </div>
      </div>
      <Confirm open={!!del} onClose={() => setDel(null)} onOk={() => { del!.forEach(removeProduct); toast('已删除'); setSel([]) }} title={`删除 ${del?.length ?? 0} 件商品？`} desc="删除后商品将移入回收站，30 天后彻底删除" danger />
    </div>
  )
}

function QualityScore() {
  const shop = useCurrentShop()
  const allProducts = useDB(s => s.products)
  const products = useMemo(() => allProducts.filter(p => p.shopId === shop.id), [allProducts, shop.id])
  return (
    <div>
      <PageHeader title="商品质量分" desc="综合图片、标题、属性完整度与评价表现，影响搜索权重。" />
      <div className="grid grid-cols-4 gap-3 mb-4"><Stat label="店铺平均质量分" value="86.4" accent="text-qn-600" big /><Stat label="优秀商品" value={products.filter((_, i) => i % 3 === 0).length} /><Stat label="待优化商品" value={products.filter((_, i) => i % 3 !== 0).length} accent="text-amber-700" /><Stat label="行业均分" value="78.2" /></div>
      <div className="card p-5"><table className="w-full text-sm"><thead><tr className="bg-ink-50 text-ink-600 text-left"><th className="px-3 py-2.5 font-medium">商品</th><th className="px-3 py-2.5 font-medium">质量分</th><th className="px-3 py-2.5 font-medium">图片</th><th className="px-3 py-2.5 font-medium">标题</th><th className="px-3 py-2.5 font-medium">属性</th><th className="px-3 py-2.5 font-medium">评价</th><th className="px-3 py-2.5 font-medium">建议</th></tr></thead><tbody>{products.map((p, i) => { const s = 70 + ((i * 13) % 28); return <tr key={p.id} className="border-b border-ink-100"><td className="px-3 py-2.5"><div className="flex gap-2 items-center"><Img src={p.images[0]} alt="" w={40} h={40} className="w-10 h-10 rounded" /><span className="line-clamp-1 max-w-xs">{p.title}</span></div></td><td className="px-3 py-2.5"><span className={cls('font-num font-semibold text-base', s >= 85 ? 'text-emerald-700' : s >= 75 ? 'text-amber-700' : 'text-red-600')}>{s}</span></td>{[5, 3, 7, 2].map((k, j) => <td key={j} className="px-3 py-2.5"><div className="w-16 h-1.5 bg-ink-100 rounded-full overflow-hidden"><div className="h-full bg-qn-500" style={{ width: `${60 + ((i * k) % 40)}%` }} /></div></td>)}<td className="px-3 py-2.5 text-xs text-ink-500">{s < 85 ? '补充 3 张以上主图，完善属性' : '保持'}</td></tr> })}</tbody></table></div>
    </div>
  )
}

/** 旧编辑路由 → 新发布页（带商品 id 进入编辑态） */
export function EditRedirect() {
  const { id } = useParams()
  return <Navigate to={`/seller/publish?id=${id}`} replace />
}

export function Inventory() {
  const shop = useCurrentShop()
  const [sp] = useSearchParams()
  const { products, upsertProduct } = useDB()
  const my = products.filter(p => p.shopId === shop.id)
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState('all')
  const rows = my.flatMap(p => p.skus.map(s => ({ p, s }))).filter(({ p, s }) => (!q || p.title.includes(q)) && (filter === 'all' || (filter === 'low' ? s.stock < 20 : s.stock === 0)))
  const sku = sp.get('tab') === 'sku'
  return (
    <div>
      <PageHeader title={sku ? 'SKU 管理' : '仓储库存'} desc="按 SKU 维度管理库存，低库存自动预警。" />
      <div className="grid grid-cols-4 gap-3 mb-4"><Stat label="SKU 总数" value={my.reduce((a, p) => a + p.skus.length, 0)} /><Stat label="总库存" value={my.reduce((a, p) => a + p.stock, 0)} /><Stat label="低库存 SKU" value={my.flatMap(p => p.skus).filter(s => s.stock < 20 && s.stock > 0).length} accent="text-amber-700" /><Stat label="缺货 SKU" value={my.flatMap(p => p.skus).filter(s => s.stock === 0).length} accent="text-red-600" /></div>
      <div className="card p-5">
        <div className="flex gap-2 mb-4"><input aria-label="搜索" className="input-qn w-72" placeholder="商品标题" value={q} onChange={e => setQ(e.target.value)} /><Select value={filter} onChange={setFilter} options={[{ value: 'all', label: '全部' }, { value: 'low', label: '低库存 (<20)' }, { value: 'out', label: '缺货' }]} /><button onClick={() => toast('库存已导出')} className="btn-outline ml-auto">导出</button></div>
        <table className="w-full text-sm"><thead><tr className="bg-ink-50 text-ink-600 text-left"><th className="px-3 py-2.5 font-medium">商品</th><th className="px-3 py-2.5 font-medium">SKU</th><th className="px-3 py-2.5 font-medium">规格</th><th className="px-3 py-2.5 font-medium">价格</th><th className="px-3 py-2.5 font-medium">库存</th><th className="px-3 py-2.5 font-medium">状态</th><th className="px-3 py-2.5 font-medium">操作</th></tr></thead>
          <tbody>{rows.slice(0, 60).map(({ p, s }) => <tr key={s.id} className="border-b border-ink-100"><td className="px-3 py-2"><div className="flex gap-2 items-center"><Img src={p.images[0]} alt="" w={36} h={36} className="w-9 h-9 rounded" /><span className="line-clamp-1 max-w-[260px]">{p.title}</span></div></td><td className="px-3 py-2 font-num text-xs text-ink-500">{s.id}</td><td className="px-3 py-2 text-xs">{Object.values(s.attrs).join(' / ')}</td><td className="px-3 py-2 font-num">¥{money(s.price)}</td><td className="px-3 py-2"><input type="number" aria-label="库存" className="input-qn h-8 w-24" value={s.stock} onChange={e => { const skus = p.skus.map(x => x.id === s.id ? { ...x, stock: Number(e.target.value) } : x); upsertProduct({ ...p, skus, stock: skus.reduce((a, x) => a + x.stock, 0) }) }} /></td><td className="px-3 py-2">{s.stock === 0 ? <span className="tag-red">缺货</span> : s.stock < 20 ? <span className="tag-gold">低库存</span> : <span className="tag-green">正常</span>}</td><td className="px-3 py-2"><button onClick={() => { const skus = p.skus.map(x => x.id === s.id ? { ...x, stock: x.stock + 100 } : x); upsertProduct({ ...p, skus, stock: skus.reduce((a, x) => a + x.stock, 0) }); toast('已补货 +100') }} className="link">补货 +100</button></td></tr>)}</tbody></table>
        {rows.length === 0 && <Empty text="暂无 SKU" />}
      </div>
    </div>
  )
}
