import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { ChevronLeft, ChevronRight, X, Check, AlertCircle, Info, Search, Inbox } from 'lucide-react'
import { cls } from '@/lib/format'
import { useUI } from '@/store/session'

// ---------- Toast ----------
export function Toaster() {
  const toasts = useUI(s => s.toasts)
  return createPortal(
    <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[9999] flex flex-col gap-2 pointer-events-none">
      {toasts.map(t => (
        <div key={t.id} className="animate-fadeUp flex items-center gap-2 rounded-lg bg-ink-900/90 text-white px-4 py-2.5 shadow-pop text-sm">
          {t.type === 'success' && <Check className="w-4 h-4 text-emerald-400" />}
          {t.type === 'error' && <AlertCircle className="w-4 h-4 text-red-400" />}
          {t.type === 'info' && <Info className="w-4 h-4 text-sky-300" />}
          {t.text}
        </div>
      ))}
    </div>, document.body,
  )
}

// ---------- Modal ----------
export function Modal({ open, onClose, title, children, footer, width = 560 }: { open: boolean; onClose: () => void; title?: ReactNode; children: ReactNode; footer?: ReactNode; width?: number }) {
  useEffect(() => {
    if (!open) return
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', h)
    document.body.style.overflow = 'hidden'
    return () => { window.removeEventListener('keydown', h); document.body.style.overflow = '' }
  }, [open, onClose])
  if (!open) return null
  return createPortal(
    <div className="fixed inset-0 z-[9000] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-ink-900/40 backdrop-blur-[2px]" onClick={onClose} />
      <div role="dialog" aria-modal="true" className="relative bg-white rounded-2xl shadow-pop w-full max-h-[90vh] flex flex-col animate-fadeUp" style={{ maxWidth: width }}>
        {title && (
          <div className="flex items-center justify-between px-6 h-14 border-b border-ink-100">
            <h3 className="font-semibold text-base">{title}</h3>
            <button aria-label="关闭" onClick={onClose} className="p-1.5 rounded-md hover:bg-ink-100 text-ink-500"><X className="w-4 h-4" /></button>
          </div>
        )}
        <div className="px-6 py-5 overflow-auto">{children}</div>
        {footer && <div className="px-6 py-4 border-t border-ink-100 flex justify-end gap-2">{footer}</div>}
      </div>
    </div>, document.body,
  )
}

export function Confirm({ open, onClose, onOk, title = '确认操作', desc, danger }: { open: boolean; onClose: () => void; onOk: () => void; title?: string; desc?: string; danger?: boolean }) {
  return (
    <Modal open={open} onClose={onClose} width={420} footer={<><button className="btn-outline" onClick={onClose}>取消</button><button className={cls('btn', danger ? 'bg-red-500 hover:bg-red-600 text-white' : 'btn-primary')} onClick={() => { onOk(); onClose() }}>确定</button></>}>
      <div className="flex gap-3">
        <AlertCircle className={cls('w-6 h-6 shrink-0', danger ? 'text-red-500' : 'text-amber-500')} />
        <div><div className="font-semibold">{title}</div>{desc && <div className="text-ink-500 mt-1 text-sm">{desc}</div>}</div>
      </div>
    </Modal>
  )
}

// ---------- Tabs ----------
export function Tabs<T extends string>({ items, value, onChange, accent = 'brand', size = 'md', className }: { items: { key: T; label: ReactNode; count?: number }[]; value: T; onChange: (k: T) => void; accent?: 'brand' | 'qn'; size?: 'md' | 'lg'; className?: string }) {
  return (
    <div className={cls('flex items-center gap-6 border-b border-ink-100', className)} role="tablist">
      {items.map(it => (
        <button key={it.key} role="tab" aria-selected={value === it.key} onClick={() => onChange(it.key)}
          className={cls('relative py-3 font-medium transition-colors whitespace-nowrap', size === 'lg' ? 'text-base' : 'text-sm', value === it.key ? (accent === 'brand' ? 'text-brand-500' : 'text-qn-600') : 'text-ink-600 hover:text-ink-900')}>
          {it.label}{it.count !== undefined && it.count > 0 && <span className="ml-1 text-brand-500 font-num">{it.count}</span>}
          {value === it.key && <span className={cls('absolute left-0 right-0 -bottom-px h-0.5 rounded-full', accent === 'brand' ? 'bg-brand-500' : 'bg-qn-500')} />}
        </button>
      ))}
    </div>
  )
}

// ---------- Table ----------
export interface Column<T> { key: string; title: ReactNode; render?: (row: T, idx: number) => ReactNode; width?: number | string; align?: 'left' | 'center' | 'right' }
export function Table<T extends { id: string }>({ columns, data, pageSize = 10, selectable, selected, onSelect, empty = '暂无数据', rowKey }: { columns: Column<T>[]; data: T[]; pageSize?: number; selectable?: boolean; selected?: string[]; onSelect?: (ids: string[]) => void; empty?: string; rowKey?: (r: T) => string }) {
  const [page, setPage] = useState(1)
  const pages = Math.max(1, Math.ceil(data.length / pageSize))
  useEffect(() => { if (page > pages) setPage(1) }, [pages, page])
  const rows = data.slice((page - 1) * pageSize, page * pageSize)
  const key = rowKey ?? ((r: T) => r.id)
  const allChecked = rows.length > 0 && rows.every(r => selected?.includes(key(r)))
  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-ink-50 text-ink-500 text-left">
              {selectable && <th className="px-3 py-2.5 w-10"><input type="checkbox" aria-label="全选" className="accent-qn-500" checked={allChecked} onChange={e => onSelect?.(e.target.checked ? Array.from(new Set([...(selected ?? []), ...rows.map(key)])) : (selected ?? []).filter(id => !rows.some(r => key(r) === id)))} /></th>}
              {columns.map(c => <th key={c.key} className={cls('px-3 py-2.5 font-medium whitespace-nowrap', c.align === 'right' && 'text-right', c.align === 'center' && 'text-center')} style={{ width: c.width }}>{c.title}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={key(r)} className="border-b border-ink-100 last:border-0 hover:bg-ink-50/60 transition-colors">
                {selectable && <td className="px-3 py-3"><input type="checkbox" aria-label="选择" className="accent-qn-500" checked={selected?.includes(key(r)) ?? false} onChange={e => onSelect?.(e.target.checked ? [...(selected ?? []), key(r)] : (selected ?? []).filter(id => id !== key(r)))} /></td>}
                {columns.map(c => <td key={c.key} className={cls('px-3 py-3 align-middle', c.align === 'right' && 'text-right', c.align === 'center' && 'text-center')}>{c.render ? c.render(r, i) : (r as Record<string, unknown>)[c.key] as ReactNode}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <Empty text={empty} />}
      </div>
      {data.length > pageSize && <Pagination page={page} pages={pages} onChange={setPage} total={data.length} />}
    </div>
  )
}

export function Pagination({ page, pages, onChange, total }: { page: number; pages: number; onChange: (p: number) => void; total?: number }) {
  const nums = useMemo(() => {
    const arr: number[] = []
    for (let i = Math.max(1, page - 2); i <= Math.min(pages, page + 2); i++) arr.push(i)
    return arr
  }, [page, pages])
  return (
    <div className="flex items-center justify-end gap-1 py-3 text-sm">
      {total !== undefined && <span className="text-ink-400 mr-3">共 {total} 条</span>}
      <button aria-label="上一页" className="btn-ghost btn-sm" disabled={page <= 1} onClick={() => onChange(page - 1)}><ChevronLeft className="w-4 h-4" /></button>
      {nums[0] > 1 && <><button className="btn-ghost btn-sm" onClick={() => onChange(1)}>1</button><span className="text-ink-400">…</span></>}
      {nums.map(n => <button key={n} className={cls('btn-sm btn', n === page ? 'bg-ink-900 text-white' : 'btn-ghost')} onClick={() => onChange(n)}>{n}</button>)}
      {nums[nums.length - 1] < pages && <><span className="text-ink-400">…</span><button className="btn-ghost btn-sm" onClick={() => onChange(pages)}>{pages}</button></>}
      <button aria-label="下一页" className="btn-ghost btn-sm" disabled={page >= pages} onClick={() => onChange(page + 1)}><ChevronRight className="w-4 h-4" /></button>
    </div>
  )
}

export function Empty({ text = '暂无数据', icon }: { text?: string; icon?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center py-14 text-ink-400">
      <div className="w-14 h-14 rounded-full bg-ink-100 flex items-center justify-center mb-3">{icon ?? <Inbox className="w-6 h-6" />}</div>
      <div className="text-sm">{text}</div>
    </div>
  )
}

// ---------- Stat ----------
export function Stat({ label, value, sub, accent, onClick, big }: { label: ReactNode; value: ReactNode; sub?: ReactNode; accent?: string; onClick?: () => void; big?: boolean }) {
  return (
    <div onClick={onClick} className={cls('bg-ink-50 rounded-xl px-5 py-4 flex flex-col gap-1', onClick && 'cursor-pointer hover:bg-ink-100 transition-colors')}>
      <div className="text-ink-500 text-xs">{label}</div>
      <div className={cls('font-num font-semibold', big ? 'text-3xl' : 'text-2xl', accent)}>{value}</div>
      {sub && <div className="text-xs text-ink-400">{sub}</div>}
    </div>
  )
}

// ---------- Form controls ----------
export function Field({ label, children, required, hint, inline }: { label: ReactNode; children: ReactNode; required?: boolean; hint?: string; inline?: boolean }) {
  return (
    <label className={cls('block', inline && 'flex items-center gap-4')}>
      <div className={cls('text-sm text-ink-600 mb-1.5', inline && 'w-24 text-right shrink-0 mb-0')}>{required && <span className="text-red-500 mr-0.5">*</span>}{label}</div>
      <div className="flex-1">{children}{hint && <div className="text-xs text-ink-400 mt-1">{hint}</div>}</div>
    </label>
  )
}

export function Switch({ checked, onChange, accent = 'qn' }: { checked: boolean; onChange: (v: boolean) => void; accent?: 'qn' | 'brand' }) {
  return (
    <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)}
      className={cls('relative w-10 h-[22px] rounded-full transition-colors', checked ? (accent === 'qn' ? 'bg-qn-500' : 'bg-brand-500') : 'bg-ink-300')}>
      <span className={cls('absolute top-[3px] w-4 h-4 bg-white rounded-full shadow transition-all', checked ? 'left-[21px]' : 'left-[3px]')} />
    </button>
  )
}

export function SearchInput({ value, onChange, placeholder = '搜索', className, accent = 'qn' }: { value: string; onChange: (v: string) => void; placeholder?: string; className?: string; accent?: 'qn' | 'brand' }) {
  return (
    <div className={cls('relative', className)}>
      <Search className="w-4 h-4 text-ink-400 absolute left-3 top-1/2 -translate-y-1/2" />
      <input aria-label={placeholder} className={cls(accent === 'qn' ? 'input-qn' : 'input', 'pl-9')} placeholder={placeholder} value={value} onChange={e => onChange(e.target.value)} />
    </div>
  )
}

export function Badge({ n, className }: { n: number; className?: string }) {
  if (!n) return null
  return <span className={cls('inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-brand-500 text-white text-[11px] font-num leading-none', className)}>{n > 99 ? '99+' : n}</span>
}

export function Avatar({ src, name, size = 36, className }: { src?: string; name: string; size?: number; className?: string }) {
  return <img src={src} alt={name} width={size} height={size} loading="lazy" className={cls('rounded-full bg-ink-100 object-cover shrink-0', className)} style={{ width: size, height: size }} />
}

export function Rating({ value, size = 12 }: { value: number; size?: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`评分 ${value.toFixed(1)}`}>
      {[1, 2, 3, 4, 5].map(i => (
        <svg key={i} width={size} height={size} viewBox="0 0 24 24" fill={i <= Math.round(value) ? '#ff5000' : '#e4e7ec'}><path d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 21 12 17.77 5.82 21 7 14.14l-5-4.87 6.91-1.01z" /></svg>
      ))}
    </span>
  )
}

export function Img({ src, alt, className, w = 400, h = 400, eager }: { src: string; alt: string; className?: string; w?: number; h?: number; eager?: boolean }) {
  return <img src={src} alt={alt} width={w} height={h} loading={eager ? 'eager' : 'lazy'} decoding="async" className={cls('bg-ink-100 object-cover', className)} />
}

export function PageHeader({ title, desc, extra }: { title: ReactNode; desc?: ReactNode; extra?: ReactNode }) {
  return (
    <div className="flex items-start justify-between mb-4">
      <div><h1 className="text-xl font-semibold text-ink-900">{title}</h1>{desc && <p className="text-ink-500 text-sm mt-1">{desc}</p>}</div>
      {extra && <div className="flex gap-2">{extra}</div>}
    </div>
  )
}

export function Section({ title, extra, children, className, padding = true }: { title?: ReactNode; extra?: ReactNode; children: ReactNode; className?: string; padding?: boolean }) {
  return (
    <section className={cls('card', className)}>
      {title && <div className="flex items-center justify-between px-5 pt-4 pb-2"><h2 className="font-semibold text-[15px] text-ink-900">{title}</h2>{extra}</div>}
      <div className={cls(!!padding && 'px-5 pb-5', !title && !!padding && 'pt-5')}>{children}</div>
    </section>
  )
}

export function Select({ value, onChange, options, className, accent = 'qn' }: { value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; className?: string; accent?: 'qn' | 'brand' }) {
  return (
    <select aria-label="选择" className={cls(accent === 'qn' ? 'input-qn' : 'input', 'w-auto pr-8', className)} value={value} onChange={e => onChange(e.target.value)}>
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  )
}

export function Steps({ steps, current }: { steps: string[]; current: number }) {
  return (
    <ol className="flex items-center w-full">
      {steps.map((s, i) => (
        <li key={s} className={cls('flex items-center', i < steps.length - 1 && 'flex-1')}>
          <div className="flex items-center gap-2">
            <span className={cls('w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold', i < current ? 'bg-emerald-500 text-white' : i === current ? 'bg-brand-500 text-white' : 'bg-ink-200 text-ink-500')}>{i < current ? <Check className="w-4 h-4" /> : i + 1}</span>
            <span className={cls('text-sm whitespace-nowrap', i <= current ? 'text-ink-900 font-medium' : 'text-ink-400')}>{s}</span>
          </div>
          {i < steps.length - 1 && <div className={cls('flex-1 h-px mx-3', i < current ? 'bg-emerald-400' : 'bg-ink-200')} />}
        </li>
      ))}
    </ol>
  )
}
