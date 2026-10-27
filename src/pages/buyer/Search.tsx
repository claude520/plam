import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ChevronDown, LayoutGrid, List, MapPin, Store } from 'lucide-react'
import { useDB } from '@/store/db'
import { ProductCard } from '@/components/ProductCard'
import { Avatar, Empty, Img, Pagination } from '@/components/ui'
import { cls, compact, money } from '@/lib/format'

export default function Search() {
  const [sp, setSp] = useSearchParams()
  const q = sp.get('q') ?? ''
  const cat = sp.get('cat') ?? ''
  const type = sp.get('type') ?? ''
  const { products, categories, shops } = useDB()
  const [sort, setSort] = useState<'default' | 'sales' | 'price-asc' | 'price-desc' | 'new'>('default')
  const [view, setView] = useState<'grid' | 'list'>('grid')
  const [filters, setFilters] = useState<{ free: boolean; tmall: boolean; min: string; max: string; shop?: string }>({ free: false, tmall: false, min: '', max: '' })
  const [page, setPage] = useState(1)
  const catNode = categories.find(c => c.id === cat)
  const matchQ = (text: string) => !q || q.split(/\s+/).filter(Boolean).every(k => text.toLowerCase().includes(k.toLowerCase()))

  const list = useMemo(() => {
    let r = products.filter(p => p.status === 'on')
    if (cat) r = r.filter(p => p.categoryId === cat || p.categoryId.startsWith(cat + '-'))
    if (q) r = r.filter(p => matchQ(p.title + ' ' + (shops.find(s => s.id === p.shopId)?.name ?? '') + ' ' + p.tags.join(' ')))
    if (filters.free) r = r.filter(p => p.freeShipping)
    if (filters.tmall) r = r.filter(p => shops.find(s => s.id === p.shopId)?.type === 'tmall')
    if (filters.min) r = r.filter(p => p.price >= Number(filters.min))
    if (filters.max) r = r.filter(p => p.price <= Number(filters.max))
    if (filters.shop) r = r.filter(p => p.shopId === filters.shop)
    if (sort === 'sales') r = [...r].sort((a, b) => b.sales - a.sales)
    if (sort === 'price-asc') r = [...r].sort((a, b) => a.price - b.price)
    if (sort === 'price-desc') r = [...r].sort((a, b) => b.price - a.price)
    if (sort === 'new') r = [...r].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    return r
  }, [products, shops, q, cat, filters, sort])
  const shopList = useMemo(() => shops.filter(s => s.status === 'open' && matchQ(s.name)), [shops, q])
  const pageSize = 20
  const pages = Math.max(1, Math.ceil(list.length / pageSize))
  const rows = list.slice((page - 1) * pageSize, page * pageSize)
  const relatedCats = useMemo(() => {
    const ids = new Set(list.map(p => p.categoryId))
    return categories.filter(c => ids.has(c.id)).slice(0, 8)
  }, [list, categories])
  const relatedShops = useMemo(() => { const ids = new Set(list.map(p => p.shopId)); return shops.filter(s => ids.has(s.id)).slice(0, 6) }, [list, shops])

  if (type === 'shop') {
    return (
      <div className="container-x py-4">
        <div className="text-sm text-ink-500 mb-3">共找到 <span className="text-brand-500 font-num">{shopList.length}</span> 家店铺</div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {shopList.map(s => (
            <div key={s.id} className="card p-4 flex items-center gap-4">
              <Avatar src={s.logo} name={s.name} size={56} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2"><span className="font-semibold">{s.name}</span>{s.type === 'tmall' && <span className="tag bg-brand-500 text-white">天猫</span>}</div>
                <div className="text-xs text-ink-500 mt-1 flex items-center gap-3"><span>粉丝 {compact(s.fans)}</span><span><MapPin className="w-3 h-3 inline" /> {s.address}</span><span>描述 {s.score.desc.toFixed(1)} · 服务 {s.score.service.toFixed(1)} · 物流 {s.score.logistics.toFixed(1)}</span></div>
              </div>
              <Link to={`/shop/${s.id}`} className="btn-outline btn-sm">进店逛逛</Link>
            </div>
          ))}
        </div>
        {shopList.length === 0 && <Empty text="没有找到相关店铺" icon={<Store className="w-6 h-6" />} />}
      </div>
    )
  }

  return (
    <div className="container-x py-4 mobile-pb">
      {/* 面包屑 & 相关 */}
      <div className="card px-5 py-3 mb-3 text-sm">
        <div className="flex items-center gap-2 text-ink-500 flex-wrap">
          <span>所有分类</span>
          {catNode && <><span>›</span><span className="text-ink-900 font-medium">{catNode.name}</span></>}
          {q && <><span>›</span><span className="text-ink-900 font-medium">“{q}”</span></>}
          <span className="ml-auto">共 <b className="text-brand-500 font-num">{list.length}</b> 件相关宝贝</span>
        </div>
        {relatedCats.length > 0 && (
          <div className="flex items-center gap-2 mt-2 flex-wrap"><span className="text-ink-400 w-16">相关分类：</span>{relatedCats.map(c => <button key={c.id} onClick={() => { setSp({ cat: c.id }); setPage(1) }} className={cls('px-2.5 h-6 rounded text-xs', cat === c.id ? 'bg-brand-500 text-white' : 'bg-ink-50 hover:bg-brand-50 hover:text-brand-500')}>{c.name}</button>)}</div>
        )}
        {relatedShops.length > 0 && (
          <div className="flex items-center gap-2 mt-2 flex-wrap"><span className="text-ink-400 w-16">相关店铺：</span>{relatedShops.map(s => <button key={s.id} onClick={() => { setFilters(f => ({ ...f, shop: f.shop === s.id ? undefined : s.id })); setPage(1) }} className={cls('px-2.5 h-6 rounded text-xs', filters.shop === s.id ? 'bg-brand-500 text-white' : 'bg-ink-50 hover:bg-brand-50 hover:text-brand-500')}>{s.name}</button>)}</div>
        )}
      </div>

      {/* 排序条 */}
      <div className="card px-3 md:px-4 min-h-[48px] py-1 mb-3 flex items-center gap-1 text-sm flex-wrap">
        {([['default', '综合'], ['sales', '销量'], ['new', '新品'], ['price-asc', '价格↑'], ['price-desc', '价格↓']] as const).map(([k, l]) => (
          <button key={k} onClick={() => setSort(k)} className={cls('px-3 h-8 rounded-md', sort === k ? 'bg-brand-500 text-white' : 'hover:bg-ink-100')}>{l}</button>
        ))}
        <span className="mx-2 h-5 w-px bg-ink-200" />
        <label className="flex items-center gap-1 px-2 cursor-pointer"><input type="checkbox" className="accent-brand-500" checked={filters.free} onChange={e => setFilters(f => ({ ...f, free: e.target.checked }))} />包邮</label>
        <label className="flex items-center gap-1 px-2 cursor-pointer"><input type="checkbox" className="accent-brand-500" checked={filters.tmall} onChange={e => setFilters(f => ({ ...f, tmall: e.target.checked }))} />天猫</label>
        <span className="mx-2 h-5 w-px bg-ink-200" />
        <div className="flex items-center gap-1 text-ink-500">价格<input aria-label="最低价" className="input h-7 w-16 text-xs" placeholder="¥" value={filters.min} onChange={e => setFilters(f => ({ ...f, min: e.target.value }))} /> - <input aria-label="最高价" className="input h-7 w-16 text-xs" placeholder="¥" value={filters.max} onChange={e => setFilters(f => ({ ...f, max: e.target.value }))} /></div>
        <div className="ml-auto flex items-center gap-1 text-ink-500">
          <span className="text-xs mr-2">{page}/{pages}</span>
          <button aria-label="网格视图" onClick={() => setView('grid')} className={cls('p-1.5 rounded', view === 'grid' ? 'bg-ink-100 text-ink-900' : '')}><LayoutGrid className="w-4 h-4" /></button>
          <button aria-label="列表视图" onClick={() => setView('list')} className={cls('p-1.5 rounded', view === 'list' ? 'bg-ink-100 text-ink-900' : '')}><List className="w-4 h-4" /></button>
        </div>
      </div>

      {rows.length === 0 ? <div className="card"><Empty text={`没有找到与“${q || catNode?.name || ''}”相关的宝贝，换个关键词试试`} /></div> : view === 'grid' ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2 md:gap-3">{rows.map(p => <ProductCard key={p.id} p={p} />)}</div>
      ) : (
        <div className="space-y-3">
          {rows.map(p => {
            const shop = shops.find(s => s.id === p.shopId)
            return (
              <Link key={p.id} to={`/item/${p.id}`} className="card p-3 md:p-4 flex gap-3 md:gap-4 hover:shadow-float transition-shadow">
                <div className="w-28 h-28 md:w-40 md:h-40 rounded-lg overflow-hidden shrink-0"><Img src={p.images[0]} alt={p.title} w={160} h={160} className="w-full h-full" /></div>
                <div className="flex-1 min-w-0">
                  <div className="text-[15px] text-ink-900 line-clamp-2">{shop?.type === 'tmall' && <span className="tag bg-brand-500 text-white mr-1">天猫</span>}{p.title}</div>
                  <div className="mt-2 flex items-baseline gap-2"><span className="price text-xs">¥</span><span className="price text-2xl">{money(p.price)}</span>{p.originalPrice && <span className="text-ink-400 line-through text-xs">¥{money(p.originalPrice)}</span>}</div>
                  <div className="mt-2 flex gap-1.5">{p.tags.map(t => <span key={t} className="tag-red">{t}</span>)}{p.freeShipping && <span className="tag-gray">包邮</span>}</div>
                  <div className="mt-3 text-xs text-ink-500 flex items-center gap-4"><span>{compact(p.sales)}人付款</span><span>{p.reviewCount} 条评价</span><span className="flex items-center gap-1"><Store className="w-3 h-3" />{shop?.name}</span><span><MapPin className="w-3 h-3 inline" />{shop?.address}</span></div>
                </div>
              </Link>
            )
          })}
        </div>
      )}
      {list.length > pageSize && <div className="card mt-3 px-4"><Pagination page={page} pages={pages} onChange={p => { setPage(p); window.scrollTo(0, 0) }} total={list.length} /></div>}
      <div className="hidden"><ChevronDown /></div>
    </div>
  )
}
