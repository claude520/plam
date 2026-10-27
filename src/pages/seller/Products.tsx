import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ChevronDown, Plus, Trash2, ArrowUpDown, Image as ImageIcon, Sparkles, Package } from 'lucide-react'
import { useDB, genId } from '@/store/db'
import { useCurrentShop } from '@/lib/hooks'
import { Confirm, Empty, Field, Img, PageHeader, Pagination, Select, Stat, Tabs } from '@/components/ui'
import { cls, fmtDate, money, PRODUCT_STATUS } from '@/lib/format'
import { toast } from '@/store/session'
import type { Product, Sku } from '@/data/types'
import { img } from '@/data/seed'

export function ProductList() {
  const shop = useCurrentShop()
  const [sp, setSp] = useSearchParams()
  const nav = useNavigate()
  const tab = sp.get('tab') ?? 'all'
  const { products, categories, upsertProduct, removeProduct } = useDB()
  const [q, setQ] = useState(sp.get('q') ?? '')
  const [pid, setPid] = useState('')
  const [cat, setCat] = useState('')
  const [sort, setSort] = useState<'created' | 'price' | 'stock' | 'sales'>('created')
  const [sel, setSel] = useState<string[]>([])
  const [del, setDel] = useState<string[] | null>(null)
  const [page, setPage] = useState(1)
  const my = useMemo(() => products.filter(p => p.shopId === shop.id), [products, shop.id])
  const list = useMemo(() => {
    let r = my
    if (tab === 'on') r = r.filter(p => p.status === 'on')
    else if (tab === 'off') r = r.filter(p => p.status === 'off' || p.status === 'pending')
    else if (tab === 'draft') r = r.filter(p => p.status === 'draft')
    else if (tab === 'violation') r = r.filter(p => p.status === 'rejected')
    else if (tab === 'recycle') r = []
    if (q) r = r.filter(p => p.title.includes(q))
    if (pid) r = r.filter(p => pid.split(/[\s,，]+/).includes(p.id))
    if (cat) r = r.filter(p => p.categoryId === cat)
    return [...r].sort((a, b) => sort === 'price' ? b.price - a.price : sort === 'stock' ? b.stock - a.stock : sort === 'sales' ? b.sales - a.sales : b.createdAt.localeCompare(a.createdAt))
  }, [my, tab, q, pid, cat, sort])
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
          <input aria-label="商家编码" className="input-qn" placeholder="商家编码" />
          <select aria-label="店铺分类" className="input-qn" value={cat} onChange={e => setCat(e.target.value)}><option value="">店铺分类 请选择</option>{categories.filter(c => c.parentId && my.some(p => p.categoryId === c.id)).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
          <div className="flex gap-2"><button className="btn-qn" onClick={() => toast(`找到 ${list.length} 件商品`, 'info')}>搜索</button><button className="btn-ghost" onClick={() => { setQ(''); setPid(''); setCat('') }}>重置</button><button className="btn-ghost text-ink-500">排序 展开<ChevronDown className="w-3.5 h-3.5" /></button></div>
        </div>
        <div className="px-5 pb-3 flex items-center gap-2">
          <Link to="/seller/products/new" className="btn-qn h-10 px-5"><Plus className="w-4 h-4" />发布商品</Link>
          <Link to="/seller/inventory?tab=sku" className="btn-outline h-10 relative">SKU管理<span className="absolute -top-2 -right-2 tag bg-brand-500 text-white">new</span></Link>
          <Link to="/seller/shop?tab=decorate" className="btn-outline h-10">商品装修</Link>
          <div className="relative group"><button className="btn-outline h-10">更多批量操作<ChevronDown className="w-3.5 h-3.5" /></button><div className="absolute left-0 top-full pt-1 hidden group-hover:block z-20"><div className="bg-white shadow-float rounded-lg py-1 w-36 text-sm"><button onClick={() => batch('on')} className="block w-full text-left px-3 py-2 hover:bg-ink-50">批量上架</button><button onClick={() => batch('off')} className="block w-full text-left px-3 py-2 hover:bg-ink-50">批量下架</button><button onClick={() => { if (!sel.length) return toast('请先勾选商品', 'error'); setDel(sel) }} className="block w-full text-left px-3 py-2 hover:bg-ink-50 text-red-500">批量删除</button></div></div></div>
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
                <td className="px-3 py-3"><span className={PRODUCT_STATUS[p.status].cls}>{PRODUCT_STATUS[p.status].label}</span></td>
                <td className="px-3 py-3"><div className="flex flex-col gap-1 text-xs"><button onClick={() => nav(`/seller/products/${p.id}/edit`)} className="link text-left">编辑</button>{p.status === 'on' ? <button onClick={() => { upsertProduct({ ...p, status: 'off' }); toast('已下架') }} className="link text-left text-ink-500">下架</button> : p.status !== 'pending' && <button onClick={() => { upsertProduct({ ...p, status: 'pending' }); toast('已提交审核') }} className="link text-left text-emerald-600">上架</button>}<button onClick={() => setDel([p.id])} className="link text-left text-red-500">删除</button></div></td>
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
      <div className="grid grid-cols-4 gap-3 mb-4"><Stat label="店铺平均质量分" value="86.4" accent="text-qn-600" big /><Stat label="优秀商品" value={products.filter((_, i) => i % 3 === 0).length} /><Stat label="待优化商品" value={products.filter((_, i) => i % 3 !== 0).length} accent="text-amber-600" /><Stat label="行业均分" value="78.2" /></div>
      <div className="card p-5"><table className="w-full text-sm"><thead><tr className="bg-ink-50 text-ink-600 text-left"><th className="px-3 py-2.5 font-medium">商品</th><th className="px-3 py-2.5 font-medium">质量分</th><th className="px-3 py-2.5 font-medium">图片</th><th className="px-3 py-2.5 font-medium">标题</th><th className="px-3 py-2.5 font-medium">属性</th><th className="px-3 py-2.5 font-medium">评价</th><th className="px-3 py-2.5 font-medium">建议</th></tr></thead><tbody>{products.map((p, i) => { const s = 70 + ((i * 13) % 28); return <tr key={p.id} className="border-b border-ink-100"><td className="px-3 py-2.5"><div className="flex gap-2 items-center"><Img src={p.images[0]} alt="" w={40} h={40} className="w-10 h-10 rounded" /><span className="line-clamp-1 max-w-xs">{p.title}</span></div></td><td className="px-3 py-2.5"><span className={cls('font-num font-semibold text-base', s >= 85 ? 'text-emerald-600' : s >= 75 ? 'text-amber-600' : 'text-red-500')}>{s}</span></td>{[5, 3, 7, 2].map((k, j) => <td key={j} className="px-3 py-2.5"><div className="w-16 h-1.5 bg-ink-100 rounded-full overflow-hidden"><div className="h-full bg-qn-500" style={{ width: `${60 + ((i * k) % 40)}%` }} /></div></td>)}<td className="px-3 py-2.5 text-xs text-ink-500">{s < 85 ? '补充 3 张以上主图，完善属性' : '保持'}</td></tr> })}</tbody></table></div>
    </div>
  )
}

export function ProductEdit() {
  const { id } = useParams()
  const nav = useNavigate()
  const shop = useCurrentShop()
  const { products, categories, upsertProduct } = useDB()
  const exist = products.find(p => p.id === id)
  const [f, setF] = useState<Product>(exist ?? { id: genId('p'), title: '', subtitle: '', images: [], price: 0, originalPrice: undefined, categoryId: '', shopId: shop.id, sales: 0, stock: 0, rating: 5, reviewCount: 0, tags: [], attrs: [{ name: '颜色', values: ['默认'] }], skus: [], status: 'draft', createdAt: new Date().toISOString(), freeShipping: true, detail: '', views: 0, favorites: 0 })
  const [step, setStep] = useState(0)
  const top = categories.filter(c => !c.parentId)
  const parent = categories.find(c => c.id === f.categoryId)?.parentId ?? ''
  const [topCat, setTopCat] = useState(parent)
  const [catQ, setCatQ] = useState('')
  const catMatches = useMemo(() => categories.filter(c => c.parentId && c.name.includes(catQ)), [categories, catQ])
  const genSkus = () => {
    const skus: Sku[] = []
    const walk = (i: number, cur: Record<string, string>) => { if (i === f.attrs.length) { const old = f.skus.find(s => JSON.stringify(s.attrs) === JSON.stringify(cur)); skus.push(old ?? { id: `${f.id}-sku${skus.length + 1}`, attrs: cur, price: f.price || 0, stock: 0 }); return } f.attrs[i].values.filter(Boolean).forEach(v => walk(i + 1, { ...cur, [f.attrs[i].name]: v })) }
    walk(0, {}); setF({ ...f, skus })
  }
  const save = (status: Product['status']) => {
    if (!f.title || !f.categoryId || !f.price) return toast('请填写标题、类目和价格', 'error')
    const images = f.images.length ? f.images : [img(`${f.id}-1`, 800, 800), img(`${f.id}-2`, 800, 800), img(`${f.id}-3`, 800, 800)]
    const skus = f.skus.length ? f.skus : [{ id: `${f.id}-sku1`, attrs: { 规格: '默认' }, price: f.price, stock: f.stock }]
    upsertProduct({ ...f, images, skus, stock: skus.reduce((a, s) => a + s.stock, 0), status, createdAt: exist?.createdAt ?? new Date().toISOString() })
    toast(status === 'draft' ? '已保存草稿' : '已提交，等待平台审核'); nav('/seller/products')
  }
  return (
    <div>
      <PageHeader title={exist ? '编辑商品' : '发布商品'} desc="填写商品信息，提交后由平台审核上架。" extra={<><button onClick={() => save('draft')} className="btn-outline">保存草稿</button><button onClick={() => save('pending')} className="btn-qn">提交审核</button></>} />
      <div className="grid grid-cols-[200px_1fr] gap-4 items-start">
        <div className="card p-3 sticky top-20">{['基本信息', '图片与详情', '规格与库存', '物流与服务'].map((s, i) => <button key={s} onClick={() => setStep(i)} className={cls('block w-full text-left px-3 py-2.5 rounded-lg text-sm', step === i ? 'bg-qn-50 text-qn-600 font-medium' : 'hover:bg-ink-50')}>{i + 1}. {s}</button>)}</div>
        <div className="card p-6 space-y-5">
          {step === 0 && <>
            <div className="rounded-lg bg-qn-50 border border-qn-100 px-4 py-2 text-xs text-ink-700">ⓘ 亲，欢迎使用新版商品发布，<span className="text-qn-600">点击查看使用教程</span></div>
            <div className="rounded-xl border-2 border-qn-500 overflow-hidden">
              <div className="grid grid-cols-[1fr_160px]"><div className="h-12 flex items-center justify-center font-semibold text-lg border-b-2 border-qn-500">搜索发品</div><button onClick={() => toast('以图发品：上传图片后 AI 自动识别类目（演示）', 'info')} className="h-12 flex items-center justify-center bg-ink-50 text-ink-700 font-medium">⇄ 以图发品</button></div>
              <div className="p-4">
                <div className="flex gap-2"><input aria-label="类目搜索" className="input-qn h-11" placeholder="可输入产品名称、类目关键词、条码信息" value={catQ} onChange={e => setCatQ(e.target.value)} /><button className="btn-qn h-11 px-6" onClick={() => toast(`匹配到 ${catMatches.length} 个类目`, 'info')}>搜索</button><button className="btn-outline h-11 bg-ink-50" onClick={() => setCatQ('')}>☰ 选择类目</button></div>
                <div className="text-xs text-ink-500 mt-3 flex items-center gap-2 flex-wrap">发布历史: {categories.filter(c => c.parentId && products.some(p => p.shopId === shop.id && p.categoryId === c.id)).slice(0, 8).map(c => <button key={c.id} onClick={() => { setTopCat(c.parentId!); setF({ ...f, categoryId: c.id }) }} className="hover:text-qn-600">{c.name}</button>)}</div>
                <div className="grid grid-cols-[250px_250px_1fr] gap-3 mt-3 h-64">
                  <div className="border border-ink-200 rounded-lg overflow-auto p-2"><input aria-label="筛选" className="input-qn h-8 mb-2" placeholder="名称/拼音首字母" value={catQ} onChange={e => setCatQ(e.target.value)} />{(catQ ? top.filter(c => catMatches.some(m => m.parentId === c.id)) : top).map(c => <button key={c.id} onClick={() => { setTopCat(c.id); setF({ ...f, categoryId: '' }) }} className={cls('w-full text-left px-2 py-1.5 rounded text-sm flex items-center justify-between', topCat === c.id ? 'bg-qn-50 text-qn-600' : 'hover:bg-ink-50')}>{c.name}<span className="text-ink-300">›</span></button>)}</div>
                  <div className="border border-ink-200 rounded-lg overflow-auto p-2">{categories.filter(c => c.parentId === topCat && (!catQ || c.name.includes(catQ))).map(c => <button key={c.id} onClick={() => setF({ ...f, categoryId: c.id })} className={cls('w-full text-left px-2 py-1.5 rounded text-sm', f.categoryId === c.id ? 'bg-qn-50 text-qn-600' : 'hover:bg-ink-50')}>{c.name}</button>)}{!topCat && <div className="text-xs text-ink-400 p-2">请先选择左侧一级类目</div>}</div>
                  <div className="rounded-lg bg-ink-50 p-4 text-sm">{f.categoryId ? <><div className="text-xs text-ink-500">已选类目</div><div className="font-semibold mt-1 text-qn-700">{top.find(c => c.id === topCat)?.name} › {categories.find(c => c.id === f.categoryId)?.name}</div><div className="text-xs text-ink-500 mt-3">该类目需缴纳保证金 ¥{shop.type === 'tmall' ? '100,000' : '2,000'}（已缴纳）</div><div className="text-xs text-emerald-600 mt-1">✓ 资质审核通过，可直接发布</div></> : <div className="text-ink-400 text-xs">选择类目后，系统将自动匹配该类目的属性模板与资质要求。<br /><br />💡 问 商品类目怎么选</div>}</div>
                </div>
              </div>
            </div>
            <Field label="商品标题" required hint={`${f.title.length}/60 字，含核心关键词可提升搜索曝光`}><input className="input-qn" maxLength={60} value={f.title} onChange={e => setF({ ...f, title: e.target.value })} placeholder="品牌 + 品类 + 卖点 + 规格" /></Field>
            <Field label="商品卖点"><input className="input-qn" value={f.subtitle ?? ''} onChange={e => setF({ ...f, subtitle: e.target.value })} placeholder="一句话卖点，展示在标题下方" /></Field>
            <div className="grid grid-cols-3 gap-4"><Field label="一口价" required><input type="number" className="input-qn" value={f.price || ''} onChange={e => setF({ ...f, price: Number(e.target.value) })} /></Field><Field label="划线价"><input type="number" className="input-qn" value={f.originalPrice ?? ''} onChange={e => setF({ ...f, originalPrice: Number(e.target.value) || undefined })} /></Field><Field label="总库存"><input type="number" className="input-qn" value={f.stock || ''} onChange={e => setF({ ...f, stock: Number(e.target.value) })} /></Field></div>
            <Field label="营销标签"><div className="flex gap-2 flex-wrap">{['官方立减15%', '国家补贴', '包邮', '退货宝', '3期免息', '大促价保', '消费券', '新品'].map(t => <button key={t} onClick={() => setF({ ...f, tags: f.tags.includes(t) ? f.tags.filter(x => x !== t) : [...f.tags, t] })} className={cls('btn-sm btn border', f.tags.includes(t) ? 'border-qn-500 text-qn-600 bg-qn-50' : 'border-ink-200')}>{t}</button>)}</div></Field>
          </>}
          {step === 1 && <>
            <Field label="商品主图" required hint="建议 800×800 以上，最多 5 张；演示环境点击自动生成"><div className="flex gap-3 flex-wrap">{f.images.map((s, i) => <div key={s} className="relative w-28 h-28 rounded-lg overflow-hidden group"><Img src={s} alt="" w={112} h={112} className="w-full h-full" /><button onClick={() => setF({ ...f, images: f.images.filter((_, j) => j !== i) })} className="absolute inset-0 bg-black/40 text-white opacity-0 group-hover:opacity-100 flex items-center justify-center"><Trash2 className="w-5 h-5" /></button></div>)}{f.images.length < 5 && <button onClick={() => setF({ ...f, images: [...f.images, img(`${f.id}-${f.images.length + 1}-${Date.now()}`, 800, 800)] })} className="w-28 h-28 rounded-lg border-2 border-dashed border-ink-300 flex flex-col items-center justify-center text-ink-400 hover:border-qn-500 hover:text-qn-600"><ImageIcon className="w-6 h-6" /><span className="text-xs mt-1">上传图片</span></button>}</div></Field>
            <Field label="商品详情" hint="支持 HTML，可用 AI 一键生成"><div className="flex gap-2 mb-2"><button onClick={() => setF({ ...f, detail: `<p>${f.title || '本商品'}</p><p>${shop.name} 出品，品质保障。支持 7 天无理由退换，部分商品支持退货宝。</p><p>材质用料考究，工艺精细，适合日常使用与馈赠。</p>` })} className="btn-outline btn-sm"><Sparkles className="w-3.5 h-3.5 text-qn-500" />AI 生成详情</button></div><textarea className="input-qn h-56 py-2 font-mono text-xs" value={f.detail} onChange={e => setF({ ...f, detail: e.target.value })} /></Field>
          </>}
          {step === 2 && <>
            <Field label="销售属性" hint="多个属性值用逗号分隔，修改后点击生成 SKU"><div className="space-y-2">{f.attrs.map((a, i) => <div key={i} className="flex gap-2 items-center"><input className="input-qn w-32" value={a.name} onChange={e => setF({ ...f, attrs: f.attrs.map((x, j) => j === i ? { ...x, name: e.target.value } : x) })} /><input className="input-qn flex-1" value={a.values.join(',')} onChange={e => setF({ ...f, attrs: f.attrs.map((x, j) => j === i ? { ...x, values: e.target.value.split(/[,，]/) } : x) })} /><button onClick={() => setF({ ...f, attrs: f.attrs.filter((_, j) => j !== i) })} className="btn-ghost btn-sm text-red-500"><Trash2 className="w-3.5 h-3.5" /></button></div>)}<div className="flex gap-2"><button onClick={() => setF({ ...f, attrs: [...f.attrs, { name: '尺码', values: ['S', 'M', 'L'] }] })} className="btn-outline btn-sm"><Plus className="w-3.5 h-3.5" />添加属性</button><button onClick={genSkus} className="btn-qn btn-sm">生成 SKU</button></div></div></Field>
            {f.skus.length > 0 && <table className="w-full text-sm"><thead><tr className="bg-ink-50 text-left text-ink-600">{f.attrs.map(a => <th key={a.name} className="px-3 py-2 font-medium">{a.name}</th>)}<th className="px-3 py-2 font-medium">价格</th><th className="px-3 py-2 font-medium">库存</th><th className="px-3 py-2 font-medium">SKU 编码</th></tr></thead><tbody>{f.skus.map((s, i) => <tr key={s.id} className="border-b border-ink-100">{f.attrs.map(a => <td key={a.name} className="px-3 py-2">{s.attrs[a.name]}</td>)}<td className="px-3 py-2"><input type="number" className="input-qn h-8 w-28" value={s.price} onChange={e => setF({ ...f, skus: f.skus.map((x, j) => j === i ? { ...x, price: Number(e.target.value) } : x) })} /></td><td className="px-3 py-2"><input type="number" className="input-qn h-8 w-24" value={s.stock} onChange={e => setF({ ...f, skus: f.skus.map((x, j) => j === i ? { ...x, stock: Number(e.target.value) } : x) })} /></td><td className="px-3 py-2 text-xs text-ink-400 font-num">{s.id}</td></tr>)}</tbody></table>}
          </>}
          {step === 3 && <>
            <Field label="运费"><div className="flex gap-2">{[[true, '包邮'], [false, '按运费模板（默认 ¥10）']].map(([v, l]) => <button key={String(v)} onClick={() => setF({ ...f, freeShipping: v as boolean })} className={cls('btn-sm btn border', f.freeShipping === v ? 'border-qn-500 text-qn-600 bg-qn-50' : 'border-ink-200')}>{l as string}</button>)}</div></Field>
            <Field label="发货地"><input className="input-qn" defaultValue={shop.address} /></Field>
            <Field label="服务承诺"><div className="space-y-2 text-sm">{['7 天无理由退换', '退货宝（运费险）', '假一赔十', '48 小时内发货'].map(s => <label key={s} className="flex items-center gap-2"><input type="checkbox" defaultChecked className="accent-qn-500" />{s}</label>)}</div></Field>
          </>}
          <div className="flex justify-between pt-3 border-t border-ink-100"><button disabled={step === 0} onClick={() => setStep(s => s - 1)} className="btn-outline">上一步</button>{step < 3 ? <button onClick={() => setStep(s => s + 1)} className="btn-qn">下一步</button> : <button onClick={() => save('pending')} className="btn-qn">提交审核</button>}</div>
        </div>
      </div>
    </div>
  )
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
      <div className="grid grid-cols-4 gap-3 mb-4"><Stat label="SKU 总数" value={my.reduce((a, p) => a + p.skus.length, 0)} /><Stat label="总库存" value={my.reduce((a, p) => a + p.stock, 0)} /><Stat label="低库存 SKU" value={my.flatMap(p => p.skus).filter(s => s.stock < 20 && s.stock > 0).length} accent="text-amber-600" /><Stat label="缺货 SKU" value={my.flatMap(p => p.skus).filter(s => s.stock === 0).length} accent="text-red-500" /></div>
      <div className="card p-5">
        <div className="flex gap-2 mb-4"><input aria-label="搜索" className="input-qn w-72" placeholder="商品标题" value={q} onChange={e => setQ(e.target.value)} /><Select value={filter} onChange={setFilter} options={[{ value: 'all', label: '全部' }, { value: 'low', label: '低库存 (<20)' }, { value: 'out', label: '缺货' }]} /><button onClick={() => toast('库存已导出')} className="btn-outline ml-auto">导出</button></div>
        <table className="w-full text-sm"><thead><tr className="bg-ink-50 text-ink-600 text-left"><th className="px-3 py-2.5 font-medium">商品</th><th className="px-3 py-2.5 font-medium">SKU</th><th className="px-3 py-2.5 font-medium">规格</th><th className="px-3 py-2.5 font-medium">价格</th><th className="px-3 py-2.5 font-medium">库存</th><th className="px-3 py-2.5 font-medium">状态</th><th className="px-3 py-2.5 font-medium">操作</th></tr></thead>
          <tbody>{rows.slice(0, 60).map(({ p, s }) => <tr key={s.id} className="border-b border-ink-100"><td className="px-3 py-2"><div className="flex gap-2 items-center"><Img src={p.images[0]} alt="" w={36} h={36} className="w-9 h-9 rounded" /><span className="line-clamp-1 max-w-[260px]">{p.title}</span></div></td><td className="px-3 py-2 font-num text-xs text-ink-500">{s.id}</td><td className="px-3 py-2 text-xs">{Object.values(s.attrs).join(' / ')}</td><td className="px-3 py-2 font-num">¥{money(s.price)}</td><td className="px-3 py-2"><input type="number" aria-label="库存" className="input-qn h-8 w-24" value={s.stock} onChange={e => { const skus = p.skus.map(x => x.id === s.id ? { ...x, stock: Number(e.target.value) } : x); upsertProduct({ ...p, skus, stock: skus.reduce((a, x) => a + x.stock, 0) }) }} /></td><td className="px-3 py-2">{s.stock === 0 ? <span className="tag-red">缺货</span> : s.stock < 20 ? <span className="tag-gold">低库存</span> : <span className="tag-green">正常</span>}</td><td className="px-3 py-2"><button onClick={() => { const skus = p.skus.map(x => x.id === s.id ? { ...x, stock: x.stock + 100 } : x); upsertProduct({ ...p, skus, stock: skus.reduce((a, x) => a + x.stock, 0) }); toast('已补货 +100') }} className="link">补货 +100</button></td></tr>)}</tbody></table>
        {rows.length === 0 && <Empty text="暂无 SKU" />}
      </div>
    </div>
  )
}
