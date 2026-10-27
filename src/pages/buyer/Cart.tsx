import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Minus, Plus, ShoppingCart, Trash2, Heart, ChevronRight } from 'lucide-react'
import { useDB } from '@/store/db'
import { Img, Empty, Confirm } from '@/components/ui'
import { cls, money } from '@/lib/format'
import { toast } from '@/store/session'
import { ProductCard } from '@/components/ProductCard'

export default function Cart() {
  const nav = useNavigate()
  const { cart, products, shops, updateCart, removeCart, toggleAllCart, toggleFavorite, coupons } = useDB()
  const [tab, setTab] = useState<'all' | 'discount' | 'drop'>('all')
  const [q, setQ] = useState('')
  const [confirm, setConfirm] = useState<string[] | null>(null)
  const rows = useMemo(() => cart.map(c => { const p = products.find(x => x.id === c.productId); const sku = p?.skus.find(s => s.id === c.skuId); return p && sku ? { c, p, sku, shop: shops.find(s => s.id === p.shopId)! } : null }).filter(Boolean) as { c: typeof cart[0]; p: typeof products[0]; sku: typeof products[0]['skus'][0]; shop: typeof shops[0] }[], [cart, products, shops])
  const filtered = rows.filter(r => (tab === 'all' || (tab === 'discount' ? r.p.tags.some(t => t.includes('立减')) : r.p.originalPrice)) && (!q || r.p.title.includes(q)))
  const groups = useMemo(() => { const m = new Map<string, typeof rows>(); filtered.forEach(r => { m.set(r.shop.id, [...(m.get(r.shop.id) ?? []), r]) }); return [...m.entries()] }, [filtered])
  const checked = rows.filter(r => r.c.checked)
  const total = checked.reduce((a, r) => a + r.sku.price * r.c.qty, 0)
  const discount = checked.reduce((a, r) => { const c = coupons.find(x => x.shopId === r.shop.id && x.status === 'active' && x.type === 'full'); return a + (c && r.sku.price * r.c.qty >= c.threshold ? c.value : 0) }, 0)
  const allChecked = rows.length > 0 && rows.every(r => r.c.checked)
  const shopChecked = (sid: string) => rows.filter(r => r.shop.id === sid).every(r => r.c.checked)
  const checkout = () => { if (checked.length === 0) return toast('请先选择要结算的宝贝', 'error'); const sids = new Set(checked.map(r => r.shop.id)); if (sids.size > 1) return toast('暂不支持跨店合并结算，请选择同一店铺的宝贝', 'error'); nav('/checkout?from=cart') }

  return (
    <div className="bg-[#f5f5f7] min-h-full">
      <div className="bg-gradient-to-b from-brand-50 to-[#f5f5f7]">
        <div className="container-x pt-2 flex items-center gap-4 text-sm">
          <span className="text-brand-600 font-bold text-lg">双11开门红</span><span className="text-brand-600 font-semibold">叠券低至7.2折起</span>
        </div>
      </div>
      <div className="container-x py-4 grid grid-cols-[1fr_340px] gap-4 items-start">
        <div>
          <div className="flex items-center gap-6 border-b border-ink-200 mb-3 text-[15px]">
            {([['all', `全部商品(${rows.length})`], ['discount', '⚡ 官方立减'], ['drop', '⚡ 降价']] as const).map(([k, l]) => <button key={k} onClick={() => setTab(k)} className={cls('py-2.5 font-semibold relative', tab === k ? 'text-brand-500' : 'text-ink-700')}>{l}{tab === k && <span className="absolute left-0 right-0 bottom-0 h-0.5 bg-brand-500 rounded-full" />}</button>)}
          </div>
          <div className="flex items-center gap-3 mb-3 text-sm">
            <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" className="accent-brand-500 w-4 h-4" checked={allChecked} onChange={e => toggleAllCart(e.target.checked)} />全选</label>
            <button onClick={() => { if (!checked.length) return toast('请先选择宝贝', 'error'); checked.forEach(r => toggleFavorite(r.p.id)); removeCart(checked.map(r => r.c.id)); toast('已移入收藏夹') }} className="btn-ghost btn-sm">移入收藏</button>
            <button onClick={() => { if (!checked.length) return toast('请先选择宝贝', 'error'); setConfirm(checked.map(r => r.c.id)) }} className="btn-ghost btn-sm">删除</button>
            <input aria-label="搜索购物车" value={q} onChange={e => setQ(e.target.value)} placeholder="搜索购物车内商品" className="input h-8 w-56 ml-auto text-xs" />
          </div>
          {groups.length === 0 && <div className="card"><Empty text="购物车空空如也，快去挑选心仪的宝贝吧" icon={<ShoppingCart className="w-6 h-6" />} /></div>}
          <div className="space-y-3">
            {groups.map(([sid, items]) => {
              const shop = items[0].shop
              return (
                <div key={sid} className="card p-4">
                  <div className="flex items-center gap-2 mb-2 text-sm">
                    <input type="checkbox" aria-label="选择店铺" className="accent-brand-500 w-4 h-4" checked={shopChecked(sid)} onChange={e => items.forEach(r => updateCart(r.c.id, { checked: e.target.checked }))} />
                    <span className={cls('tag text-white', shop.type === 'tmall' ? 'bg-brand-500' : 'bg-brand-400')}>{shop.type === 'tmall' ? '天猫' : 'Plam'}</span>
                    <Link to={`/shop/${shop.id}`} className="font-semibold hover:text-brand-500">{shop.name}</Link>
                    <span className="text-qn-500 text-xs">💬</span>
                    {coupons.find(x => x.shopId === sid && x.status === 'active') && <span className="ml-2 text-xs text-brand-500 border border-brand-200 rounded px-1.5 py-0.5">店铺优惠：{coupons.filter(x => x.shopId === sid && x.status === 'active').map(c => c.type === 'full' ? `满${c.threshold}减${c.value}` : `${c.value * 10}折`).join(' · ')}</span>}
                  </div>
                  <div className="divide-y divide-ink-100">
                    {items.map(({ c, p, sku }) => (
                      <div key={c.id} className="py-4 grid grid-cols-[24px_96px_1fr_140px_150px_120px_80px] gap-3 items-center">
                        <input type="checkbox" aria-label="选择" className="accent-brand-500 w-4 h-4" checked={c.checked} onChange={e => updateCart(c.id, { checked: e.target.checked })} />
                        <Link to={`/item/${p.id}`} className="w-24 h-24 rounded-lg overflow-hidden"><Img src={p.images[0]} alt={p.title} w={96} h={96} className="w-full h-full" /></Link>
                        <div className="min-w-0">
                          <Link to={`/item/${p.id}`} className="text-sm text-ink-900 line-clamp-2 hover:text-brand-500">{p.tags[0] && <span className="text-brand-500 font-semibold mr-1">双11</span>}{p.title}</Link>
                          <div className="text-xs text-ink-400 mt-1">{p.attrs.map(a => `${a.name}：${sku.attrs[a.name]}`).join('  ')}</div>
                          <div className="flex gap-1.5 mt-1.5">{p.tags.slice(0, 3).map(t => <span key={t} className="text-[11px] text-brand-500">{t}</span>)}{p.freeShipping && <span className="text-[11px] text-ink-500">包邮</span>}</div>
                        </div>
                        <div className="text-xs"><div className="text-brand-500">平台加补后 <span className="price text-sm">¥{money(sku.price * 0.9)}</span> ›</div><div className="text-brand-500 mt-0.5">距加入降 ¥{money(sku.price * 0.1)}</div><div className="text-ink-400 mt-0.5">¥ {money(sku.price)}</div></div>
                        <div className="flex items-center justify-center"><div className="flex items-center border border-ink-200 rounded-lg overflow-hidden"><button aria-label="减少" onClick={() => updateCart(c.id, { qty: Math.max(1, c.qty - 1) })} className="w-8 h-8 hover:bg-ink-50 flex items-center justify-center"><Minus className="w-3.5 h-3.5" /></button><span className="w-10 text-center font-num text-sm">{c.qty}</span><button aria-label="增加" onClick={() => updateCart(c.id, { qty: Math.min(sku.stock, c.qty + 1) })} className="w-8 h-8 hover:bg-ink-50 flex items-center justify-center"><Plus className="w-3.5 h-3.5" /></button></div></div>
                        <div className="text-right price text-base">¥{money(sku.price * c.qty)}</div>
                        <div className="text-xs text-ink-500 flex flex-col items-end gap-1.5"><button onClick={() => { toggleFavorite(p.id); removeCart([c.id]); toast('已移入收藏夹') }} className="hover:text-brand-500 flex items-center gap-0.5"><Heart className="w-3 h-3" />移入收藏</button><button onClick={() => setConfirm([c.id])} className="hover:text-brand-500 flex items-center gap-0.5"><Trash2 className="w-3 h-3" />删除</button></div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
          <div className="mt-8"><div className="font-semibold text-lg mb-3">你可能还喜欢</div><div className="grid grid-cols-4 gap-3">{products.filter(p => p.status === 'on').slice(20, 28).map(p => <ProductCard key={p.id} p={p} />)}</div></div>
        </div>

        <div className="card p-5 sticky top-4">
          <div className="font-semibold text-base mb-4">结算明细</div>
          {checked.length === 0 ? (
            <div className="py-8 text-center"><div className="w-24 h-24 mx-auto rounded-full bg-brand-50 flex items-center justify-center"><ShoppingCart className="w-10 h-10 text-brand-300" /></div><div className="text-brand-500 font-semibold mt-4">选择商品查看实际支付价格</div></div>
          ) : (
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-ink-500">已选宝贝 {checked.reduce((a, r) => a + r.c.qty, 0)} 件</span><span className="font-num">¥{money(total)}</span></div>
              <div className="flex justify-between"><span className="text-ink-500">店铺优惠</span><span className="font-num text-brand-500">-¥{money(discount)}</span></div>
              <div className="flex justify-between"><span className="text-ink-500">运费</span><span className="font-num">¥0.00</span></div>
            </div>
          )}
          <div className="divider my-4" />
          <div className="flex items-center justify-between"><span className="font-semibold">合计：</span><span className="price text-2xl">¥{money(Math.max(0, total - discount))}</span></div>
          <button onClick={checkout} className="btn-primary btn-lg w-full mt-4 text-base">结算{checked.length ? `(${checked.length})` : ''}</button>
          <Link to="/" className="flex items-center justify-center gap-1 text-xs text-ink-500 mt-3 hover:text-brand-500">继续逛逛<ChevronRight className="w-3 h-3" /></Link>
        </div>
      </div>
      <Confirm open={!!confirm} onClose={() => setConfirm(null)} onOk={() => { removeCart(confirm!); toast('已删除') }} title="确定删除所选宝贝？" desc="删除后可在收藏夹或足迹中找回" danger />
    </div>
  )
}
