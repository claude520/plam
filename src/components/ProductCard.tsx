import { Link } from 'react-router-dom'
import type { Product } from '@/data/types'
import { Img } from '@/components/ui'
import { compact, money } from '@/lib/format'
import { useDB } from '@/store/db'

export function ProductCard({ p, size = 'md' }: { p: Product; size?: 'sm' | 'md' }) {
  const shop = useDB(s => s.shops.find(x => x.id === p.shopId))
  return (
    <Link to={`/item/${p.id}`} className="group card overflow-hidden hover:shadow-float transition-shadow block">
      <div className="relative aspect-square overflow-hidden">
        <Img src={p.images[0]} alt={p.title} className="w-full h-full group-hover:scale-105 transition-transform duration-500" />
        {p.tags[0] && <span className="absolute left-2 top-2 tag bg-brand-500 text-white shadow">{p.tags[0]}</span>}
      </div>
      <div className={size === 'sm' ? 'p-2.5' : 'p-3'}>
        <div className="flex items-baseline gap-1">
          <span className="price text-xs">¥</span>
          <span className="price text-lg">{money(p.price, p.price % 1 ? 2 : 0)}</span>
          {p.originalPrice && <span className="text-ink-400 text-xs line-through font-num">¥{money(p.originalPrice, 0)}</span>}
        </div>
        <div className="text-[13px] text-ink-800 line-clamp-2 leading-[18px] mt-1 min-h-[36px]">
          {shop?.type === 'tmall' && <span className="tag bg-brand-500 text-white mr-1 align-middle">天猫</span>}{p.title}
        </div>
        <div className="flex items-center justify-between mt-2 text-xs text-ink-400">
          <span className="truncate max-w-[60%]">{shop?.name}</span>
          <span>{compact(p.sales)}人付款</span>
        </div>
        {p.tags.length > 1 && <div className="flex gap-1 mt-1.5 flex-wrap">{p.tags.slice(1, 3).map(t => <span key={t} className="tag-red">{t}</span>)}</div>}
      </div>
    </Link>
  )
}

export function ProductGrid({ items, cols = 5 }: { items: Product[]; cols?: number }) {
  return (
    <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
      {items.map(p => <ProductCard key={p.id} p={p} />)}
    </div>
  )
}
