import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ChevronDown, CircleHelp, MessageSquareText, X, Sparkles } from 'lucide-react'
import { useCurrentShop, useCurrentUser } from '@/lib/hooks'
import { Avatar, Modal } from '@/components/ui'
import { cls } from '@/lib/format'
import { img } from '@/data/seed'
import { useDB } from '@/store/db'
import { toast } from '@/store/session'

/** 商品发布独立页壳（复刻千牛「商品发布」页头） */
export function PubShell({ children, className }: { children: ReactNode; className?: string }) {
  const shop = useCurrentShop()
  const user = useCurrentUser()
  return (
    <div className="min-h-screen bg-[#f4f6fa] flex flex-col">
      <header className="h-14 bg-white border-b border-ink-200 flex items-center px-4 md:px-6 gap-3 sticky top-0 z-40">
        <Link to="/seller" className="flex items-center gap-2 shrink-0"><span className="w-7 h-7 rounded-lg bg-qn-500 text-white font-bold flex items-center justify-center">P</span><span className="font-semibold text-lg text-ink-900">Plam</span></Link>
        <span className="text-ink-300">|</span><span className="text-ink-800 text-base">商品发布</span>
        <div className="ml-auto flex items-center gap-5 text-[11px] text-ink-600">
          <Link to="/seller/service/overview" className="flex flex-col items-center gap-0.5 hover:text-qn-600"><CircleHelp className="w-4 h-4" />帮助</Link>
          <button onClick={() => toast('感谢反馈！我们会持续优化商品发布体验（演示）')} className="flex flex-col items-center gap-0.5 hover:text-qn-600"><MessageSquareText className="w-4 h-4" />反馈</button>
          <Link to="/seller" className="flex items-center gap-2 pl-3 border-l border-ink-200"><Avatar src={shop.logo} name={shop.name} size={30} /><div className="leading-tight text-left hidden sm:block"><div className="text-[13px] text-ink-900">{shop.name}</div><div className="text-ink-500">{user?.username ?? 'seller'}</div></div><ChevronDown className="w-3.5 h-3.5 text-ink-400" /></Link>
        </div>
      </header>
      <div className={cls('flex-1', className)}>{children}</div>
    </div>
  )
}

/** 右下角「问 …」AI 助手气泡（复刻页面右下角的智能助手） */
const AI_QA: { q: string; a: string }[] = [
  { q: '商品类目怎么选', a: '类目决定搜索曝光与资质要求。优先用「搜索发品」输入产品名、类目关键词或条码，系统会按历史发布和同款商品推荐最匹配的叶子类目；带 ⚠ 的为天猫专用类目，淘宝店铺不可发布。' },
  { q: 'SKU图片设置', a: '在「创建规格」里选择「选择标准属性构建规格」并勾选「添加图片」，每个颜色分类可单独上传一张 SKU 图，买家切换规格时商品主图会随之变化。' },
  { q: '优先展示1:1主图', a: '已默认开启「商品详情页优先展示 1:1 主图」。1:1 主图有机会在首页信息流、搜索、微详情、购后等场景展示，推荐尺寸 1440×1440。' },
  { q: '主图尺寸要求', a: '1:1 主图比例 1:1，推荐 1440×1440 及以上；3:4 主图比例 3:4，推荐 1440×1920 及以上；白底图要求 800×800 纯白背景。均最多 5 张，拖拽可调整顺序。' },
  { q: '详情批量投放', a: '在「宝贝详情」编辑器点「保存为模板」，之后在其他商品的「模板」里一键套用；也可在「我的商品」勾选多件商品后批量投放同一详情模板。' },
  { q: '多件优惠怎么用', a: '设置 2 件优惠（折扣 5.0–9.9 折）后，优惠会在详情、下单、购物车表达，提升客单价并分摊运费成本。需先填写一口价。' },
]
export function AiBubble() {
  const [open, setOpen] = useState(false)
  const [i, setI] = useState(0)
  const [cur, setCur] = useState<number | null>(null)
  useEffect(() => { const t = setInterval(() => setI(x => (x + 1) % AI_QA.length), 4000); return () => clearInterval(t) }, [])
  return (
    <div className="fixed right-4 md:right-10 bottom-16 md:bottom-14 z-30 flex items-center gap-2">
      {!open && <button onClick={() => { setOpen(true); setCur(i) }} className="hidden sm:flex items-center gap-1 bg-white border border-qn-200 shadow-float rounded-lg px-3 h-8 text-sm text-ink-800 animate-fadeUp"><span className="tag bg-qn-50 text-qn-600 border border-qn-200 h-4">问</span>{AI_QA[i].q}</button>}
      <button aria-label="AI助手" onClick={() => setOpen(o => !o)} className="w-12 h-12 rounded-full bg-gradient-to-br from-qn-500 via-indigo-500 to-fuchsia-500 shadow-pop flex items-center justify-center text-white ring-4 ring-white"><Sparkles className="w-5 h-5" /></button>
      {open && (
        <div className="absolute right-0 bottom-14 w-80 bg-white rounded-2xl shadow-pop border border-ink-100 overflow-hidden animate-fadeUp">
          <div className="h-11 px-4 flex items-center justify-between bg-gradient-to-r from-qn-50 to-indigo-50"><div className="font-medium text-sm flex items-center gap-1.5"><Sparkles className="w-4 h-4 text-qn-500" />发品智能助手</div><button aria-label="关闭" onClick={() => setOpen(false)}><X className="w-4 h-4 text-ink-400" /></button></div>
          <div className="p-3 space-y-2 max-h-80 overflow-auto">
            {cur !== null && <div className="rounded-xl bg-ink-50 p-3 text-xs text-ink-700 leading-5"><div className="font-medium text-ink-900 mb-1">{AI_QA[cur].q}</div>{AI_QA[cur].a}</div>}
            <div className="text-[11px] text-ink-400 px-1">猜你想问</div>
            <div className="flex flex-wrap gap-1.5">{AI_QA.map((x, k) => <button key={x.q} onClick={() => setCur(k)} className={cls('px-2.5 h-7 rounded-full text-xs border', cur === k ? 'border-qn-500 text-qn-600 bg-qn-50' : 'border-ink-200 text-ink-600 hover:border-qn-300')}>{x.q}</button>)}</div>
          </div>
        </div>
      )}
    </div>
  )
}

/** 图片空间（素材中心）选择器 */
export function ImageSpace({ open, onClose, onPick, multiple = true, max = 5 }: { open: boolean; onClose: () => void; onPick: (urls: string[]) => void; multiple?: boolean; max?: number }) {
  const shop = useCurrentShop()
  const products = useDB(s => s.products)
  const mine = useMemo(() => products.filter(p => p.shopId === shop.id).flatMap(p => p.images).filter((v, i, a) => a.indexOf(v) === i).slice(0, 24), [products, shop.id])
  const pool = useMemo(() => [...mine, ...Array.from({ length: 18 }).map((_, i) => img(`space-${shop.id}-${i}`, 800, 800))], [mine, shop.id])
  const [sel, setSel] = useState<string[]>([])
  const [folder, setFolder] = useState('全部图片')
  useEffect(() => { if (open) setSel([]) }, [open])
  return (
    <Modal open={open} onClose={onClose} title="图片空间" width={860} footer={<><span className="mr-auto text-xs text-ink-500">已选 {sel.length}/{max}，支持 jpg / png，单张 ≤ 3MB</span><button className="btn-outline" onClick={onClose}>取消</button><button className="btn-qn" disabled={!sel.length} onClick={() => { onPick(sel); onClose() }}>确定</button></>}>
      <div className="grid grid-cols-[150px_1fr] gap-4">
        <div className="text-sm space-y-1">{['全部图片', '商品主图', '详情图', '直播素材', '活动图', '最近上传'].map(f => <button key={f} onClick={() => setFolder(f)} className={cls('block w-full text-left px-3 py-2 rounded-lg', folder === f ? 'bg-qn-50 text-qn-600' : 'hover:bg-ink-50')}>{f}</button>)}<div className="text-[11px] text-ink-400 px-3 pt-2">已用 128MB / 1GB</div></div>
        <div className="grid grid-cols-6 gap-2 max-h-[420px] overflow-auto pr-1">{pool.map(u => { const on = sel.includes(u); return <button key={u} onClick={() => setSel(s => s.includes(u) ? s.filter(x => x !== u) : multiple ? (s.length < max ? [...s, u] : s) : [u])} className={cls('relative aspect-square rounded-lg overflow-hidden border-2', on ? 'border-qn-500' : 'border-transparent hover:border-ink-300')}><img src={u} alt="" loading="lazy" className="w-full h-full object-cover" />{on && <span className="absolute top-1 right-1 w-5 h-5 rounded-full bg-qn-500 text-white text-[11px] flex items-center justify-center">{sel.indexOf(u) + 1}</span>}</button> })}</div>
      </div>
    </Modal>
  )
}

export const PUB_PREFILL_KEY = 'plam-pub-prefill'
export interface PubPrefill { title?: string; images?: string[]; brand?: string; price?: number; subtitle?: string }
export const setPrefill = (p: PubPrefill) => { try { sessionStorage.setItem(PUB_PREFILL_KEY, JSON.stringify(p)) } catch { /* ignore */ } }
export const takePrefill = (): PubPrefill | null => { try { const s = sessionStorage.getItem(PUB_PREFILL_KEY); sessionStorage.removeItem(PUB_PREFILL_KEY); return s ? JSON.parse(s) : null } catch { return null } }
