import { useEffect, useRef, useState } from 'react'
import { Check, ChevronDown, Globe } from 'lucide-react'
import { LANGS, getLang, setLang } from '@/lib/i18n'
import { cls } from '@/lib/format'

/** 语言切换（data-no-i18n：菜单内各语言名称保持本族语写法，不被翻译） */
export function LanguageMenu({ variant = 'bar', className }: { variant?: 'bar' | 'icon'; className?: string }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const cur = getLang()
  const meta = LANGS.find(l => l.code === cur)!
  useEffect(() => {
    if (!open) return
    const h = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h)
  }, [open])
  return (
    <div ref={ref} data-no-i18n className={cls('relative', className)} onMouseEnter={() => variant === 'bar' && setOpen(true)} onMouseLeave={() => variant === 'bar' && setOpen(false)}>
      <button type="button" aria-label="Language" aria-expanded={open} onClick={() => setOpen(o => !o)} className={cls('flex items-center gap-1', variant === 'icon' ? 'flex-col gap-0.5 px-2 md:px-3 py-1 rounded-lg hover:bg-ink-50 text-[11px] text-ink-700' : 'hover:text-brand-500')}>
        {variant === 'icon' ? <><Globe className="w-5 h-5" /><span className="whitespace-nowrap">{cur === 'zh' ? 'Language' : meta.label}</span></> : <><Globe className="w-3.5 h-3.5" />{cur === 'zh' ? 'Language' : meta.label}<ChevronDown className="w-3 h-3" /></>}
      </button>
      {open && (
        <div className={cls('absolute top-full z-[60] pt-1', variant === 'icon' ? 'right-0' : 'left-0')}>
          <div className="bg-white shadow-float rounded-xl py-1.5 w-48 text-[13px] border border-ink-100">
            {LANGS.map(l => (
              <button key={l.code} type="button" onClick={() => { setOpen(false); if (l.code !== cur) setLang(l.code) }} className={cls('w-full px-3 py-2 flex items-center justify-between hover:bg-ink-50 text-left', l.code === cur ? 'text-brand-600 font-medium' : 'text-ink-800')}>
                <span dir={l.rtl ? 'rtl' : 'ltr'}>{l.label}</span>
                <span className="flex items-center gap-1.5 text-[11px] text-ink-400">{l.en}{l.code === cur && <Check className="w-3.5 h-3.5 text-brand-500" />}</span>
              </button>
            ))}
            <div className="px-3 pt-1.5 mt-1 border-t border-ink-100 text-[11px] text-ink-400 leading-4">Machine translation · 机器翻译</div>
          </div>
        </div>
      )}
    </div>
  )
}
