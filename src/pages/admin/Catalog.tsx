import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Check, X, Plus, Trash2, Edit3, ChevronRight, FolderTree, ArrowDown, ArrowUp } from 'lucide-react'
import { useDB, genId } from '@/store/db'
import { Img, Modal, Field, PageHeader, SearchInput, Select, Stat, Table, Tabs, Confirm, Switch, type Column } from '@/components/ui'
import { cls, compact, fmtDate, money, PRODUCT_STATUS } from '@/lib/format'
import { toast } from '@/store/session'
import type { Category, Product } from '@/data/types'

export function Products() {
  const [sp] = useSearchParams()
  const { products, shops, categories, upsertProduct, removeProduct, log } = useDB()
  const [tab, setTab] = useState(sp.get('tab') ?? 'all')
  const [q, setQ] = useState('')
  const [shop, setShop] = useState('')
  const [sel, setSel] = useState<string[]>([])
  const [reject, setReject] = useState<Product | null>(null)
  const [reason, setReason] = useState('商品信息不完整')
  const [del, setDel] = useState<string[] | null>(null)
  const list = useMemo(() => products.filter(p => (tab === 'all' || p.status === tab) && (!shop || p.shopId === shop) && (!q || p.title.includes(q) || p.id.includes(q))).sort((a, b) => (a.status === 'pending' ? -1 : 1) - (b.status === 'pending' ? -1 : 1)), [products, tab, q, shop])
  const approve = (p: Product) => { upsertProduct({ ...p, status: 'on' }); log('admin', '审核通过商品', p.id); toast('已通过审核并上架') }
  const cols: Column<Product>[] = [
    { key: 'p', title: '商品', render: p => <div className="flex gap-2 items-center"><Img src={p.images[0]} alt="" w={48} h={48} className="w-12 h-12 rounded" /><div className="max-w-[300px]"><Link to={`/item/${p.id}`} className="line-clamp-2 hover:text-qn-600">{p.title}</Link><div className="text-xs text-ink-400 font-num">{p.id} · {categories.find(c => c.id === p.categoryId)?.name}</div></div></div> },
    { key: 'shop', title: '店铺', render: p => <span className="text-xs">{shops.find(s => s.id === p.shopId)?.name}</span> },
    { key: 'price', title: '价格', render: p => <span className="font-num">¥{money(p.price)}</span> },
    { key: 'stock', title: '库存', render: p => <span className="font-num">{p.stock}</span> },
    { key: 'sales', title: '销量', render: p => <span className="font-num">{compact(p.sales)}</span> },
    { key: 'createdAt', title: '创建时间', render: p => <span className="text-xs">{fmtDate(p.createdAt, false)}</span> },
    { key: 'status', title: '状态', render: p => <span className={PRODUCT_STATUS[p.status].cls}>{PRODUCT_STATUS[p.status].label}</span> },
    { key: 'op', title: '操作', render: p => <div className="flex gap-1.5 text-xs">{p.status === 'pending' ? <><button onClick={() => approve(p)} className="btn-qn btn-sm"><Check className="w-3 h-3" />通过</button><button onClick={() => setReject(p)} className="btn-outline btn-sm"><X className="w-3 h-3" />驳回</button></> : <>{p.status === 'on' ? <button onClick={() => { upsertProduct({ ...p, status: 'off' }); log('admin', '下架商品', p.id); toast('已强制下架') }} className="link text-amber-700">下架</button> : <button onClick={() => approve(p)} className="link text-emerald-700">上架</button>}<button onClick={() => setDel([p.id])} className="link text-red-600">删除</button></>}</div> },
  ]
  return (
    <div>
      <PageHeader title="商品审核与管理" desc="平台全量商品的审核、上下架与违规处理。" />
      <div className="grid grid-cols-5 gap-3 mb-4"><Stat label="商品总数" value={products.length} /><Stat label="在售" value={products.filter(p => p.status === 'on').length} accent="text-emerald-700" /><Stat label="待审核" value={products.filter(p => p.status === 'pending').length} accent="text-amber-700" /><Stat label="已驳回" value={products.filter(p => p.status === 'rejected').length} accent="text-red-600" /><Stat label="仓库中" value={products.filter(p => p.status === 'off').length} /></div>
      <div className="card">
        <div className="px-5"><Tabs items={[{ key: 'all', label: '全部' }, { key: 'pending', label: '待审核', count: products.filter(p => p.status === 'pending').length }, { key: 'on', label: '在售' }, { key: 'off', label: '仓库中' }, { key: 'rejected', label: '已驳回' }, { key: 'draft', label: '草稿' }]} value={tab} onChange={setTab} accent="qn" /></div>
        <div className="px-5 py-3 flex gap-2 items-center"><SearchInput value={q} onChange={setQ} placeholder="商品标题 / ID" className="w-72" /><Select value={shop} onChange={setShop} options={[{ value: '', label: '全部店铺' }, ...shops.map(s => ({ value: s.id, label: s.name }))]} />{sel.length > 0 && <span className="text-sm text-ink-500 ml-auto">已选 {sel.length} <button onClick={() => { sel.forEach(id => { const p = products.find(x => x.id === id); if (p?.status === 'pending') approve(p) }); setSel([]) }} className="link ml-2">批量通过</button><button onClick={() => { sel.forEach(id => { const p = products.find(x => x.id === id); if (p) upsertProduct({ ...p, status: 'off' }) }); toast('已批量下架'); setSel([]) }} className="link ml-2 text-amber-700">批量下架</button></span>}</div>
        <div className="px-5 pb-5"><Table columns={cols} data={list} selectable selected={sel} onSelect={setSel} pageSize={12} /></div>
      </div>
      <Modal open={!!reject} onClose={() => setReject(null)} title="驳回商品" width={440} footer={<><button className="btn-outline" onClick={() => setReject(null)}>取消</button><button className="btn bg-red-600 text-white hover:bg-red-600" onClick={() => { upsertProduct({ ...reject!, status: 'rejected' }); log('admin', `驳回商品(${reason})`, reject!.id); setReject(null); toast('已驳回') }}>确认驳回</button></>}><Field label="驳回原因"><select className="input-qn" value={reason} onChange={e => setReason(e.target.value)}>{['商品信息不完整', '图片违规/含水印', '类目错放', '价格异常', '涉嫌侵权', '违禁品'].map(r => <option key={r}>{r}</option>)}</select></Field></Modal>
      <Confirm open={!!del} onClose={() => setDel(null)} onOk={() => { del!.forEach(id => { removeProduct(id); log('admin', '删除商品', id) }); toast('已删除') }} title="删除商品？" desc="删除后不可恢复，商家端同步移除" danger />
    </div>
  )
}

export function Categories() {
  const { categories, products, upsertCategory, removeCategory, log } = useDB()
  const [cur, setCur] = useState(categories.find(c => !c.parentId)?.id ?? '')
  const [editing, setEditing] = useState<Category | null>(null)
  const [del, setDel] = useState<Category | null>(null)
  const top = categories.filter(c => !c.parentId).sort((a, b) => a.sort - b.sort)
  const subs = categories.filter(c => c.parentId === cur).sort((a, b) => a.sort - b.sort)
  const count = (id: string) => products.filter(p => p.categoryId === id || p.categoryId.startsWith(id + '-')).length
  const move = (c: Category, dir: -1 | 1) => { const sib = categories.filter(x => x.parentId === c.parentId).sort((a, b) => a.sort - b.sort); const i = sib.findIndex(x => x.id === c.id); const j = i + dir; if (j < 0 || j >= sib.length) return; upsertCategory({ ...c, sort: sib[j].sort }); upsertCategory({ ...sib[j], sort: c.sort }) }
  return (
    <div>
      <PageHeader title="类目管理" desc="两级类目树，支持排序、启停与新增。" extra={<button onClick={() => setEditing({ id: genId('c'), name: '', sort: top.length + 1, status: 'on' })} className="btn-qn"><Plus className="w-4 h-4" />新增一级类目</button>} />
      <div className="grid grid-cols-[320px_1fr] gap-4 items-start">
        <div className="card p-3"><div className="px-2 py-1.5 text-xs text-ink-400 flex items-center gap-1"><FolderTree className="w-3.5 h-3.5" />一级类目（{top.length}）</div>{top.map(c => <div key={c.id} onClick={() => setCur(c.id)} className={cls('group flex items-center gap-2 px-3 py-2.5 rounded-lg cursor-pointer text-sm', cur === c.id ? 'bg-qn-50 text-qn-600 font-medium' : 'hover:bg-ink-50')}><span className="flex-1">{c.name}</span><span className="text-xs text-ink-400">{count(c.id)}</span>{c.status === 'off' && <span className="tag-gray">停用</span>}<span className="hidden group-hover:flex gap-1"><button aria-label="上移" onClick={e => { e.stopPropagation(); move(c, -1) }} className="text-ink-400 hover:text-qn-600"><ArrowUp className="w-3.5 h-3.5" /></button><button aria-label="下移" onClick={e => { e.stopPropagation(); move(c, 1) }} className="text-ink-400 hover:text-qn-600"><ArrowDown className="w-3.5 h-3.5" /></button><button aria-label="编辑" onClick={e => { e.stopPropagation(); setEditing(c) }} className="text-ink-400 hover:text-qn-600"><Edit3 className="w-3.5 h-3.5" /></button></span><ChevronRight className="w-4 h-4 text-ink-400" /></div>)}</div>
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4"><div className="font-semibold">{top.find(c => c.id === cur)?.name} · 二级类目（{subs.length}）</div><div className="flex gap-2"><button onClick={() => setEditing({ id: `${cur}-${subs.length + 1}`, name: '', parentId: cur, sort: subs.length + 1, status: 'on' })} className="btn-outline btn-sm"><Plus className="w-3.5 h-3.5" />新增二级类目</button><button onClick={() => setDel(top.find(c => c.id === cur) ?? null)} className="btn-outline btn-sm text-red-600"><Trash2 className="w-3.5 h-3.5" />删除一级类目</button></div></div>
          <table className="w-full text-sm"><thead><tr className="bg-ink-50 text-left text-ink-600"><th className="px-3 py-2.5 font-medium w-16">排序</th><th className="px-3 py-2.5 font-medium">名称</th><th className="px-3 py-2.5 font-medium">ID</th><th className="px-3 py-2.5 font-medium">商品数</th><th className="px-3 py-2.5 font-medium">启用</th><th className="px-3 py-2.5 font-medium">操作</th></tr></thead><tbody>{subs.map(c => <tr key={c.id} className="border-b border-ink-100"><td className="px-3 py-2.5 font-num text-ink-500">{c.sort}</td><td className="px-3 py-2.5 font-medium">{c.name}</td><td className="px-3 py-2.5 font-num text-xs text-ink-400">{c.id}</td><td className="px-3 py-2.5 font-num">{count(c.id)}</td><td className="px-3 py-2.5"><Switch checked={c.status === 'on'} onChange={v => { upsertCategory({ ...c, status: v ? 'on' : 'off' }); toast(v ? '已启用' : '已停用') }} /></td><td className="px-3 py-2.5 text-xs flex gap-2"><button onClick={() => move(c, -1)} className="link">上移</button><button onClick={() => move(c, 1)} className="link">下移</button><button onClick={() => setEditing(c)} className="link">编辑</button><button onClick={() => setDel(c)} className="link text-red-600">删除</button></td></tr>)}</tbody></table>
        </div>
      </div>
      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.name ? '编辑类目' : '新增类目'} width={420} footer={<><button className="btn-outline" onClick={() => setEditing(null)}>取消</button><button className="btn-qn" disabled={!editing?.name} onClick={() => { upsertCategory(editing!); log('admin', '修改类目', editing!.id); setEditing(null); toast('已保存') }}>保存</button></>}>{editing && <div className="space-y-4"><Field label="类目名称" required><input className="input-qn" value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })} /></Field><Field label="排序"><input type="number" className="input-qn" value={editing.sort} onChange={e => setEditing({ ...editing, sort: Number(e.target.value) })} /></Field></div>}</Modal>
      <Confirm open={!!del} onClose={() => setDel(null)} onOk={() => { removeCategory(del!.id); log('admin', '删除类目', del!.id); if (del!.id === cur) setCur(top.find(c => c.id !== del!.id)?.id ?? ''); toast('已删除') }} title={`删除类目「${del?.name}」？`} desc={`该类目下有 ${del ? count(del.id) : 0} 件商品，删除后商品需重新归类`} danger />
    </div>
  )
}
