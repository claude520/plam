// 复刻 item.upload.taobao.com/sell/v2/publish.htm —— 宝贝发布表单
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, ArrowRight, ChevronDown, ChevronUp, CircleHelp, Flame, Image as ImageIcon, Info, Loader2, Mail, Plus, Settings2, Trash2, Upload, Video, X, Eye, Save, CheckCircle2, Smartphone } from 'lucide-react'
import { useDB, genId } from '@/store/db'
import { useCurrentShop } from '@/lib/hooks'
import { Modal, Switch } from '@/components/ui'
import { cls, money } from '@/lib/format'
import { toast } from '@/store/session'
import type { DetailBlock, Product, PublishInfo, Sku } from '@/data/types'
import { PUB_FIRST, isLeaf, pubPath, pubPathNames, pubTemplate, pubToBuyerCategory, SHOP_CATS_DEFAULT, type PubTemplate } from '@/data/pubcats'
import { AiBubble, ImageSpace, PubShell, takePrefill } from './common'
import { charLen, clampChars, cropToRatio, pickFiles, uploadDataUrl, uploadImageFile } from '@/lib/upload'

// ---------- 默认值 ----------
const defaultPub = (catId: string, brand: string, tpl: PubTemplate): PublishInfo => ({
  catId, catPath: pubPathNames(catId), brand, props: {}, customProps: [], isCustom: false, purchaseFrom: 'cn', guideTitle: '', buyNotes: '', sellerCode: '',
  multiDiscount: { enabled: false, count: 2, discount: 9.5 }, stockMode: 'order', listing: 'now', shipTime: tpl.shipTime ?? '48h', shipBySku: false, delivery: false, freightTemplate: '包邮',
  regionLimit: 'none', warranty: false, sevenDays: tpl.sevenDays, images34: [], video: '', whiteImage: '', detailBlocks: [], shopCats: [], skuMode: 'standard', skuImages: {}, template: '',
})
const newProduct = (id: string, shopId: string): Product => ({ id, title: '', subtitle: '', images: [], price: 0, categoryId: '', shopId, sales: 0, stock: 1, rating: 5, reviewCount: 0, tags: [], attrs: [], skus: [], status: 'draft', createdAt: new Date().toISOString(), freeShipping: true, detail: '', views: 0, favorites: 0 })
const DRAFT = (id: string) => `plam-pub-draft:${id}`
/** 老数据（没有发布信息）回推一个发布类目 */
function guessCatId(categoryId: string) {
  for (const f of PUB_FIRST) for (const s of f.children ?? []) { const leaf = s.children?.length ? s.children[0] : s; if (pubToBuyerCategory(leaf.id) === categoryId) return leaf.id }
  return 'pc106-11-1'
}
const htmlToBlocks = (html: string): DetailBlock[] => { const out: DetailBlock[] = []; const re = /<img[^>]+src="([^"]+)"/g; let m: RegExpExecArray | null; while ((m = re.exec(html))) out.push({ id: genId('blk'), type: 'image', value: m[1] }); const text = html.replace(/<img[^>]*>/g, '').replace(/<[^>]+>/g, '\n').replace(/\n{2,}/g, '\n').trim(); if (text) out.unshift({ id: genId('blk'), type: 'text', value: text }); return out }
const blocksToHtml = (b: DetailBlock[]) => b.map(x => x.type === 'image' ? `<p><img src="${x.value}" alt="" /></p>` : x.value.split('\n').filter(Boolean).map(l => `<p>${l.replace(/</g, '&lt;')}</p>`).join('')).join('')

// ---------- 填写助手内容 ----------
const HELP: Record<string, { title: string; sections: { h: string; items: ReactNode[] }[] }> = {
  main: { title: '1:1主图', sections: [{ h: '基础上传要求', items: ['1、宽高比为1:1', <>2、<span className="text-brand-500">推荐尺寸1440x1440</span></>, '3、最多可上传5张', '4、图片格式支持png、jpg、jpeg'] }, { h: '应用场景', items: ['1:1主图有机会在首页信息流、搜索、微详情、购后等场景展示', <>若商品图片满足<span className="text-brand-500">AI试穿</span>素材规范，商品有机会支持AI试穿。<span className="text-qn-600">点击此处查看</span>AI试穿介绍、适用范围、素材规范。</>] }] },
  title: { title: '宝贝标题', sections: [{ h: '填写规范', items: ['1、最多允许输入30个汉字（60字符）', '2、推荐结构：品牌 + 品类词 + 核心卖点 + 规格', '3、不得使用极限词、特殊符号，避免关键词堆砌'] }, { h: '提升曝光', items: ['含核心关键词的标题更容易被搜索命中，可点击「AI推荐」生成'] }] },
  guide: { title: '导购标题', sections: [{ h: '填写规范', items: ['1、最多输入30字符（15个汉字）', '2、标题结构推荐：品牌 + 品类词 + 利益点'] }, { h: '应用场景', items: ['导购标题会在首页推荐、搜索卡片等场景替代长标题展示'] }] },
  props: { title: '类目属性', sections: [{ h: '填写建议', items: ['1、属性填写越完整，搜索/推荐匹配越精准', '2、品牌需与商品实际一致，无品牌请选择【无品牌/无注册商标】', '3、自定义属性最多 5 组'] }] },
  sku: { title: '销售规格', sections: [{ h: '创建方式', items: ['1、自定义填写规格：自由输入规格名', '2、选择标准属性构建规格：按颜色分类 / 尺码等标准属性组合生成 SKU', '3、勾选「添加图片」可为每个颜色设置 SKU 图'] }] },
  price: { title: '一口价', sections: [{ h: '填写规范', items: ['1、一口价为商品默认售价，SKU 可单独定价', '2、价格需大于 0，最多两位小数', '3、设置多件优惠需先填写一口价'] }] },
  stock: { title: '总库存', sections: [{ h: '说明', items: ['1、有 SKU 时总库存为各 SKU 库存之和', '2、总库存不包含新增批次库存', '3、库存扣减方式可在「展开收起项」中设置'] }] },
  discount: { title: '多件优惠', sections: [{ h: '说明', items: ['1、设置2件优惠，折扣力度5.0-9.9折', '2、优惠会在详情/下单/购物车表达', '3、可分摊运费成本，提升客单价'] }] },
  listing: { title: '上架时间', sections: [{ h: '说明', items: ['1、立刻上架：提交后直接出售', '2、定时上架：到达设定时间自动上架，之前可在「仓库中的宝贝」编辑', '3、放入仓库：仅保存，不展示'] }] },
  ship: { title: '发货时间', sections: [{ h: '说明', items: ['1、24小时内发货可获得「提升转化」标识', '2、按规格单独设置：不同 SKU 可设置不同发货时效', '3、超时未发货将影响店铺评分'] }] },
  delivery: { title: '提取方式', sections: [{ h: '说明', items: ['1、全网商品须设置运费模板', '2、包邮模板可提升转化', '3、官方寄件集合多家运力，一键发货'] }] },
  main34: { title: '3:4主图', sections: [{ h: '基础上传要求', items: ['1、宽高比为3:4', <>2、<span className="text-brand-500">推荐尺寸1440x1920</span></>, '3、最多可上传5张', '4、可从1:1主图一键裁剪'] }, { h: '应用场景', items: ['3:4主图用于手淘首页推荐、搜索大图等场景'] }] },
  video: { title: '商品视频', sections: [{ h: '上传要求', items: ['1、时长5秒-5分钟', '2、宽高比支持1:1、3:4、9:16', '3、最多可上传5个'] }, { h: '说明', items: ['9:16视频商品详情页不展示，可在首页推荐、微详情等展示'] }] },
  white: { title: '白底图', sections: [{ h: '上传要求', items: ['1、尺寸800x800', '2、纯白背景、商品主体清晰完整', '3、审核通过后用于频道、活动等场景'] }] },
  detail: { title: '宝贝详情', sections: [{ h: '说明', items: ['1、宝贝详情图【高/宽≤2】，超出将被裁剪', '2、建议宽度≥1440像素', '3、未添加任何内容时提交后将用主图自动填充'] }, { h: '技巧', items: ['拖动模块可调整顺序，可保存为模板复用'] }] },
  shopcat: { title: '店铺中分类', sections: [{ h: '说明', items: ['1、最多支持选择20项分类', '2、分类在店铺首页/分类导航展示'] }] },
}

const SIZE_HINT = { c: 'grid grid-cols-[110px_1fr] md:grid-cols-[130px_1fr] gap-3 md:gap-4 py-3.5' }

// ---------- 表单公共组件（模块级，避免输入时重建导致失焦） ----------
type Exp = { basic: boolean; sale: boolean; logi: boolean }
interface Ctx { onlyReq: boolean; setHelp: (k: string) => void; errors: Record<string, string>; uploading: string | null; addImages: (t: 'main' | '34' | 'white' | 'detail', files: File[]) => Promise<void>; setSpace: (s: { target: 'main' | '34' | 'white' | 'detail' | 'sku'; key?: string }) => void; expandAll: boolean; exp: Exp; setExp: (f: (x: Exp) => Exp) => void }
const PubCtx = createContext<Ctx>(null as unknown as Ctx)

function Row({ k, label, required, children, hint }: { k: string; label: ReactNode; required?: boolean; children: ReactNode; hint?: ReactNode }) {
  const c = useContext(PubCtx)
  if (c.onlyReq && !required) return null
  const e = c.errors[k]
  return (
    <div id={`row-${k}`} className={SIZE_HINT.c} onFocusCapture={() => HELP[k] && c.setHelp(k)} onClickCapture={() => HELP[k] && c.setHelp(k)}>
      <div className="text-sm text-ink-900 pt-1.5 flex items-start gap-0.5">{label}{required && <span className="text-red-500">*</span>}</div>
      <div className="min-w-0">{hint && <div className="text-xs text-ink-500 mb-2">{hint}</div>}{children}{e && <div className="text-xs text-red-500 mt-1">{e}</div>}</div>
    </div>
  )
}
function Slots({ list, max, target, onChange }: { list: string[]; max: number; target: 'main' | '34' | 'white' | 'detail'; onChange: (l: string[]) => void }) {
  const c = useContext(PubCtx)
  const box = target === '34' ? 'w-[88px] h-[118px]' : 'w-[88px] h-[88px]'
  return (
    <div className="flex gap-3 flex-wrap">
      {list.map((u, i) => (
        <div key={u + i} className={cls('relative rounded-lg overflow-hidden border border-ink-200 group bg-ink-50', box)}>
          <img src={u} alt="" className="w-full h-full object-cover" />
          {i === 0 && max > 1 && <span className="absolute left-0 top-0 tag bg-qn-500 text-white rounded-none rounded-br">主图</span>}
          <div className="absolute inset-x-0 bottom-0 h-7 bg-black/55 hidden group-hover:flex items-center justify-center gap-2 text-white">
            <button aria-label="左移" disabled={i === 0} onClick={() => { const l = [...list]; [l[i - 1], l[i]] = [l[i], l[i - 1]]; onChange(l) }} className="disabled:opacity-30"><ArrowLeft className="w-3.5 h-3.5" /></button>
            <button aria-label="删除" onClick={() => onChange(list.filter((_, j) => j !== i))}><Trash2 className="w-3.5 h-3.5" /></button>
            <button aria-label="右移" disabled={i === list.length - 1} onClick={() => { const l = [...list]; [l[i + 1], l[i]] = [l[i], l[i + 1]]; onChange(l) }} className="disabled:opacity-30"><ArrowRight className="w-3.5 h-3.5" /></button>
          </div>
        </div>
      ))}
      {Array.from({ length: Math.max(0, max - list.length) }).map((_, i) => (
        <div key={`e${i}`} className={cls('relative rounded-lg border border-dashed border-ink-300 bg-white flex flex-col items-center justify-center text-ink-500 text-xs hover:border-qn-500 hover:text-qn-600 group', box)}>
          {c.uploading === target && i === 0 ? <Loader2 className="w-5 h-5 animate-spin text-qn-500" /> : <>
            <button onClick={async () => c.addImages(target, await pickFiles('image/*', max > 1))} className="flex flex-col items-center gap-1 flex-1 justify-center w-full"><ImageIcon className="w-4 h-4" />上传图片</button>
            {i === 0 && <button onClick={() => c.setSpace({ target })} className="absolute bottom-0 inset-x-0 h-5 text-[10px] bg-ink-50 text-ink-500 hidden group-hover:block">图片空间</button>}
          </>}
        </div>
      ))}
    </div>
  )
}
function Collapse({ k, summary }: { k: keyof Exp; summary: string }) {
  const c = useContext(PubCtx)
  if (c.expandAll) return null
  return (
    <div className="pt-2 pb-1 flex items-center gap-3 text-sm">
      <button onClick={() => c.setExp(x => ({ ...x, [k]: !x[k] }))} className="text-ink-600 hover:text-qn-600 flex items-center gap-0.5">{c.exp[k] ? <>收起<ChevronUp className="w-3.5 h-3.5" /></> : <>展开<ChevronDown className="w-3.5 h-3.5" /></>}</button>
      {!c.exp[k] && <span className="text-xs text-ink-500">{summary}</span>}
    </div>
  )
}
const Tpl = ({ k, value, onChange }: { k: string; value: string; onChange: (v: string) => void }) => <label className="flex items-center gap-2 text-xs text-ink-600"><span>模板</span><select aria-label="模板" className="input-qn h-8 w-40 text-xs" value={value.startsWith(k) ? value : ''} onChange={e => { if (e.target.value) { onChange(e.target.value); toast(`已应用模板「${e.target.value}」（演示）`) } }}><option value="">请选择</option><option value={`${k}-默认模板`}>{k}-默认模板</option><option value={`${k}-爆款模板`}>{k}-爆款模板</option></select></label>
const Radio = ({ on, onClick, children, disabled }: { on: boolean; onClick?: () => void; children: ReactNode; disabled?: boolean }) => <button type="button" disabled={disabled} onClick={onClick} className={cls('inline-flex items-center gap-1.5 text-sm', disabled ? 'text-ink-400 cursor-not-allowed' : 'text-ink-800')}><span className={cls('w-4 h-4 rounded-full border-[1.5px] flex items-center justify-center', on ? 'border-qn-500' : 'border-ink-300')}>{on && <span className="w-2 h-2 rounded-full bg-qn-500" />}</span>{children}</button>
const Check = ({ on, onClick, children, disabled }: { on: boolean; onClick?: () => void; children: ReactNode; disabled?: boolean }) => <button type="button" disabled={disabled} onClick={onClick} className={cls('inline-flex items-center gap-1.5 text-sm', disabled ? 'text-ink-400 cursor-not-allowed' : 'text-ink-800')}><span className={cls('w-4 h-4 rounded border-[1.5px] flex items-center justify-center', on ? 'bg-qn-500 border-qn-500 text-white' : 'border-ink-300 bg-white', disabled && on && 'bg-ink-300 border-ink-300')}>{on && <CheckCircle2 className="w-3 h-3" />}</span>{children}</button>
const Count = ({ v, max }: { v: string; max: number }) => <span className={cls('text-xs shrink-0', charLen(v) > max ? 'text-red-500' : 'text-ink-400')}>{charLen(v)}/{max}</span>
const Hq = () => <CircleHelp className="w-3.5 h-3.5 text-ink-300 inline ml-0.5" />

export default function Publish() {
  const nav = useNavigate()
  const [sp] = useSearchParams()
  const shop = useCurrentShop()
  const { products, upsertProduct } = useDB()
  const qId = sp.get('id') ?? ''
  const qCat = sp.get('catId') ?? ''
  const qBrand = sp.get('brand') ?? ''
  const exist = useMemo(() => products.find(p => p.id === qId), [products, qId])

  // ---------- 初始化（编辑 / 草稿 / 新建 + 预填） ----------
  const [f, setF] = useState<Product>(() => {
    const id = qId || genId('p')
    let base: Product = exist ? { ...exist } : newProduct(id, shop.id)
    try { const d = localStorage.getItem(DRAFT(id)); if (d) { const saved = JSON.parse(d) as Product; if (!exist || saved.pub) base = { ...base, ...saved } } } catch { /* ignore */ }
    const catId = qCat || base.pub?.catId || guessCatId(base.categoryId)
    const tpl = pubTemplate(catId)
    const pub: PublishInfo = base.pub ? { ...base.pub, catId, catPath: pubPathNames(catId), brand: qBrand || base.pub.brand, props: base.pub.catId === catId ? base.pub.props : {}, sevenDays: base.pub.catId === catId ? base.pub.sevenDays : tpl.sevenDays } : { ...defaultPub(catId, qBrand || '无品牌/无注册商标', tpl), detailBlocks: base.detail ? htmlToBlocks(base.detail) : [], shopCats: [] }
    const pre = takePrefill()
    if (pre) { if (pre.title) base.title = pre.title; if (pre.images?.length) base.images = pre.images; if (pre.brand) pub.brand = pre.brand; if (pre.price) base.price = pre.price; if (pre.subtitle) pub.guideTitle = clampChars(pre.subtitle, 30) }
    return { ...base, pub }
  })
  const pub = f.pub!
  const tpl = pubTemplate(pub.catId)
  const up = useCallback((patch: Partial<Product>) => setF(x => ({ ...x, ...patch })), [])
  const upPub = useCallback((patch: Partial<PublishInfo>) => setF(x => ({ ...x, pub: { ...x.pub!, ...patch } })), [])

  // ---------- 自动保存草稿 ----------
  const [savedAt, setSavedAt] = useState<Date | null>(null)
  const first = useRef(true)
  useEffect(() => {
    if (first.current) { first.current = false; return }
    const t = setTimeout(() => { try { localStorage.setItem(DRAFT(f.id), JSON.stringify(f)); setSavedAt(new Date()) } catch { /* ignore */ } }, 800)
    return () => clearTimeout(t)
  }, [f])
  const draftsCount = products.filter(p => p.shopId === shop.id && p.status === 'draft').length

  // ---------- 页面状态 ----------
  const [help, setHelp] = useState('main')
  const [expandAll, setExpandAll] = useState(false)
  const [onlyReq, setOnlyReq] = useState(false)
  const [exp, setExp] = useState({ basic: false, sale: false, logi: false })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [active, setActive] = useState('basic')
  const [spec, setSpec] = useState(false)
  const [space, setSpace] = useState<null | { target: 'main' | '34' | 'white' | 'detail' | 'sku'; key?: string }>(null)
  const [aiOpen, setAiOpen] = useState<null | 'title' | 'guide'>(null)
  const [preview, setPreview] = useState(false)
  const [uploading, setUploading] = useState<string | null>(null)
  const isExp = (k: keyof typeof exp) => expandAll || exp[k]
  const err = (k: string) => errors[k]
  useEffect(() => {
    const ids = ['basic', 'sale', 'logi', 'desc']
    const h = () => { const y = window.scrollY + 140; let cur = 'basic'; ids.forEach(id => { const el = document.getElementById(`sec-${id}`); if (el && el.offsetTop <= y) cur = id }); setActive(cur) }
    window.addEventListener('scroll', h, { passive: true }); return () => window.removeEventListener('scroll', h)
  }, [])
  const jump = (id: string) => { const el = document.getElementById(`sec-${id}`); if (el) window.scrollTo({ top: el.offsetTop - 120, behavior: 'smooth' }) }

  // ---------- 图片 ----------
  const addImages = async (target: 'main' | '34' | 'white' | 'detail', files: File[]) => {
    if (!files.length) return
    setUploading(target)
    try {
      const urls: string[] = []
      for (const file of files) urls.push(await uploadImageFile(file, target === 'detail' ? 1440 : 1200))
      if (target === 'main') up({ images: [...f.images, ...urls].slice(0, 5) })
      else if (target === '34') upPub({ images34: [...pub.images34, ...urls].slice(0, 5) })
      else if (target === 'white') upPub({ whiteImage: urls[0] })
      else upPub({ detailBlocks: [...pub.detailBlocks, ...urls.map(u => ({ id: genId('blk'), type: 'image' as const, value: u }))] })
    } catch (e) { toast((e as Error).message, 'error') } finally { setUploading(null) }
  }
  const fromSpace = (urls: string[]) => {
    if (!space) return
    if (space.target === 'main') up({ images: [...f.images, ...urls].slice(0, 5) })
    else if (space.target === '34') upPub({ images34: [...pub.images34, ...urls].slice(0, 5) })
    else if (space.target === 'white') upPub({ whiteImage: urls[0] })
    else if (space.target === 'sku') upPub({ skuImages: { ...pub.skuImages, [space.key!]: urls[0] } })
    else upPub({ detailBlocks: [...pub.detailBlocks, ...urls.map(u => ({ id: genId('blk'), type: 'image' as const, value: u }))] })
  }
  const crop34 = async () => {
    if (!f.images.length) return toast('请先上传 1:1 主图', 'error')
    setUploading('34')
    try { const out: string[] = []; for (const u of f.images.slice(0, 5)) out.push(await uploadDataUrl(await cropToRatio(u, 3 / 4))); upPub({ images34: out }); toast('已从 1:1 主图裁剪生成 3:4 主图') } catch { toast('裁剪失败：图片跨域不可读取，请重新上传', 'error') } finally { setUploading(null) }
  }
  const crop11 = async () => {
    if (!pub.images34.length) return toast('请先上传 3:4 主图', 'error')
    setUploading('main')
    try { const out: string[] = []; for (const u of pub.images34.slice(0, 5)) out.push(await uploadDataUrl(await cropToRatio(u, 1))); up({ images: out }); toast('已从 3:4 主图裁剪生成 1:1 主图') } catch { toast('裁剪失败：图片跨域不可读取，请重新上传', 'error') } finally { setUploading(null) }
  }
  const genWhite = async () => {
    if (!f.images.length) return toast('请先上传主图', 'error')
    setUploading('white')
    try { const u = await cropToRatio(f.images[0], 1, 800); upPub({ whiteImage: await uploadDataUrl(u) }); toast('已从主图生成白底图（演示：AI 抠图）') } catch { upPub({ whiteImage: f.images[0] }) } finally { setUploading(null) }
  }

  // ---------- AI 推荐标题 ----------
  const aiTitles = useMemo(() => {
    const leaf = pub.catPath[pub.catPath.length - 1] ?? '商品'
    const b = pub.brand && !pub.brand.startsWith('无品牌') ? pub.brand.split('/')[0] : ''
    const p1 = Object.entries(pub.props).filter(([, v]) => v).slice(0, 2).map(([, v]) => v).join(' ')
    return [
      clampChars(`${b} ${leaf} 2026新款 ${p1} 官方正品 ${shop.name.replace(/的小店.*$/, '')}`.replace(/\s+/g, ' ').trim(), 60),
      clampChars(`${b}${leaf} ${p1} 高品质 热销爆款 现货速发 包邮`.replace(/\s+/g, ' ').trim(), 60),
      clampChars(`新品上市 ${b} ${leaf} ${p1} 限时特惠 多件优惠 送礼自用`.replace(/\s+/g, ' ').trim(), 60),
    ]
  }, [pub.catPath, pub.brand, pub.props, shop.name])
  const aiGuides = useMemo(() => { const leaf = pub.catPath[pub.catPath.length - 1] ?? '商品'; const b = pub.brand && !pub.brand.startsWith('无品牌') ? pub.brand.split('/')[0] : ''; return [clampChars(`${b}${leaf} 立减优惠`, 30), clampChars(`${leaf} 新品尝鲜价`, 30), clampChars(`${b}${leaf} 包邮到家`, 30)] }, [pub.catPath, pub.brand])

  // ---------- SKU ----------
  const totalStock = f.skus.length ? f.skus.reduce((a, s) => a + s.stock, 0) : f.stock
  const setSku = (i: number, patch: Partial<Sku>) => up({ skus: f.skus.map((s, j) => j === i ? { ...s, ...patch } : s) })
  const applySpec = (attrs: { name: string; values: string[] }[], mode: 'custom' | 'standard', images: Record<string, string>) => {
    const skus: Sku[] = []
    const walk = (i: number, cur: Record<string, string>) => { if (i === attrs.length) { const old = f.skus.find(s => JSON.stringify(s.attrs) === JSON.stringify(cur)); skus.push(old ?? { id: `${f.id}-sku${skus.length + 1}`, attrs: cur, price: f.price || 0, stock: 0 }); return } attrs[i].values.forEach(v => walk(i + 1, { ...cur, [attrs[i].name]: v })) }
    if (attrs.length) walk(0, {})
    setF(x => ({ ...x, attrs, skus, pub: { ...x.pub!, skuMode: mode, skuImages: images } }))
    setSpec(false)
    if (skus.length) toast(`已生成 ${skus.length} 个 SKU，请填写价格与库存`)
  }

  // ---------- 校验 / 提交 ----------
  const validate = () => {
    const e: Record<string, string> = {}
    if (!f.images.length) e.main = '请至少上传 1 张 1:1 主图'
    if (!f.title.trim()) e.title = '请填写宝贝标题'
    if (charLen(f.title) > 60) e.title = '标题最多 30 个汉字（60 字符）'
    if (!pub.brand) e.brand = '请选择品牌'
    tpl.attrs.filter(a => a.required).forEach(a => { if (!pub.props[a.name]) e[`prop-${a.name}`] = `请填写${a.name}` })
    if (!(f.price > 0)) e.price = '一口价必须大于 0'
    if (f.skus.length ? f.skus.some(s => !(s.price > 0)) : false) e.sku = '请填写每个 SKU 的价格'
    if (totalStock < 0 || Number.isNaN(totalStock)) e.stock = '请填写总库存'
    if (pub.listing === 'timed' && !pub.listAt) e.listing = '请选择定时上架时间'
    if (!pub.delivery) e.delivery = '请选择提取方式'
    setErrors(e)
    const k = Object.keys(e)[0]
    if (k) { const el = document.getElementById(`row-${k.startsWith('prop-') ? 'brand' : k}`); el?.scrollIntoView({ behavior: 'smooth', block: 'center' }); toast(Object.values(e)[0], 'error') }
    return !k
  }
  const buildProduct = (status: Product['status']): Product => {
    const blocks = pub.detailBlocks.length ? pub.detailBlocks : f.images.map(u => ({ id: genId('blk'), type: 'image' as const, value: u }))
    const skus = f.skus.length ? f.skus : [{ id: `${f.id}-sku1`, attrs: { 规格: '默认' }, price: f.price, stock: f.stock }]
    const attrs = f.attrs.length ? f.attrs : [{ name: '规格', values: ['默认'] }]
    const tags = f.tags.filter(t => t !== '包邮' && t !== '多件优惠' && t !== '7天无理由')
    if (pub.freightTemplate === '包邮' && pub.delivery) tags.push('包邮')
    if (pub.multiDiscount.enabled) tags.push('多件优惠')
    if (pub.sevenDays) tags.push('7天无理由')
    return { ...f, pub: { ...pub, detailBlocks: blocks }, subtitle: pub.guideTitle || f.subtitle, categoryId: pubToBuyerCategory(pub.catId), freeShipping: pub.freightTemplate === '包邮', detail: blocksToHtml(blocks), skus, attrs, stock: skus.reduce((a, s) => a + s.stock, 0), tags, status, createdAt: exist?.createdAt ?? new Date().toISOString() }
  }
  const [submitting, setSubmitting] = useState(false)
  const submit = () => {
    if (!validate()) return
    setSubmitting(true)
    setTimeout(() => {
      const status: Product['status'] = pub.listing === 'now' ? 'on' : 'off'
      upsertProduct(buildProduct(status))
      try { localStorage.removeItem(DRAFT(f.id)) } catch { /* ignore */ }
      toast(pub.listing === 'now' ? '发布成功，宝贝已上架出售' : pub.listing === 'timed' ? `发布成功，将于 ${pub.listAt?.replace('T', ' ')} 自动上架` : '发布成功，宝贝已放入仓库')
      nav(pub.listing === 'now' ? '/seller/products?tab=on' : '/seller/products?tab=off')
    }, 600)
  }
  const saveDraft = () => {
    const p = buildProduct('draft')
    upsertProduct({ ...p, status: exist && exist.status !== 'draft' ? exist.status : 'draft' })
    try { localStorage.removeItem(DRAFT(f.id)) } catch { /* ignore */ }
    toast('草稿已保存至「我的商品 - 草稿」')
    setSavedAt(new Date())
  }

  // ---------- 渲染 ----------
  const ctx = useMemo<Ctx>(() => ({ onlyReq, setHelp, errors, uploading, addImages, setSpace, expandAll, exp, setExp }), [onlyReq, errors, uploading, expandAll, exp]) // eslint-disable-line
  const helpCur = HELP[help] ?? HELP.main

  return (
    <PubCtx.Provider value={ctx}>
    <PubShell className="pb-24">
      <div className="max-w-[1480px] mx-auto px-3 md:px-4 pt-4 flex gap-4 items-start">
        {/* 填写助手 */}
        <aside className="hidden lg:block w-[240px] shrink-0 sticky top-[72px]">
          <div className="rounded-xl bg-white shadow-card overflow-hidden">
            <div className="h-10 px-4 flex items-center justify-between bg-[#eef3fe] text-qn-700 font-medium text-sm"><span className="flex items-center gap-1.5"><CircleHelp className="w-4 h-4" />填写助手</span><ChevronUp className="w-4 h-4" /></div>
            <div className="p-4 text-xs text-ink-700 leading-5 space-y-3 animate-fadeUp" key={help}>
              <div className="text-sm text-ink-900">{helpCur.title}</div>
              {helpCur.sections.map(s => <div key={s.h}><div className="text-sm text-ink-900 mb-1">{s.h}</div>{s.items.map((it, i) => <div key={i}>{it}</div>)}</div>)}
              <div><div className="text-sm text-ink-900 mb-1">更多问题请看</div><button onClick={() => toast('帮助中心（演示）', 'info')} className="text-qn-600">点击查看详情</button></div>
            </div>
          </div>
        </aside>

        <main className="flex-1 min-w-0">
          {/* 锚点 + 开关 */}
          <div className="sticky top-14 z-30 bg-white rounded-xl shadow-card h-12 px-4 flex items-center gap-1 md:gap-2">
            {[['basic', '基础信息'], ['sale', '销售信息'], ['logi', '物流服务'], ['desc', '图文描述']].map(([k, l]) => <button key={k} onClick={() => jump(k)} className={cls('px-2 md:px-3 h-8 rounded-lg text-sm whitespace-nowrap', active === k ? 'bg-[#eef3fe] text-qn-600' : 'text-ink-800 hover:bg-ink-50')}>{l}</button>)}
            <div className="ml-auto flex items-center gap-4 text-xs text-ink-700"><label className="flex items-center gap-2"><Switch checked={expandAll} onChange={setExpandAll} /><span className="hidden sm:inline">展开收起项</span></label><label className="flex items-center gap-2"><Switch checked={onlyReq} onChange={setOnlyReq} /><span className="hidden sm:inline">只看必填</span></label></div>
          </div>

          {/* 当前类目 */}
          <div className="mt-3 rounded-xl bg-white shadow-card px-5 py-3.5 grid grid-cols-[110px_1fr] md:grid-cols-[130px_1fr] gap-4 items-center">
            <div className="text-sm text-ink-900">当前类目<span className="text-red-500">*</span></div>
            <div className="text-sm text-ink-900 flex items-center gap-3 flex-wrap"><span>{pub.catPath.join('>>')}</span><button onClick={() => nav(`/seller/publish/category?id=${f.id}`)} className="text-qn-600 text-xs hover:underline">切换类目</button>{!isLeaf(pubPath(pub.catId).slice(-1)[0]) && <span className="text-xs text-red-500">请选择到最末级类目</span>}</div>
          </div>

          {/* ===== 基础信息 ===== */}
          <section id="sec-basic" className="mt-3 rounded-xl bg-white shadow-card px-5 py-4">
            <div className="flex items-center justify-between"><h2 className="text-lg font-medium text-ink-900">基础信息</h2><Tpl k="基础信息" value={pub.template} onChange={v => upPub({ template: v })} /></div>
            <div className="divide-y divide-ink-50 mt-1">
              {isExp('basic') && <Row k="type" label="宝贝类型" required><div className="text-xs text-ink-500 mb-2">该类目下，所有淘宝卖家，只能发布全新宝贝</div><Radio on disabled>全新</Radio></Row>}
              <Row k="main" label="1:1主图" required>
                <div className="text-xs text-ink-500 mb-2 flex items-center gap-2 flex-wrap"><span className="bg-amber-50 text-brand-600 px-1.5 py-0.5 rounded">已设置商品详情页优先展示1:1主图</span><span>图片要求：比例为1:1，<span className="text-brand-500">推荐尺寸1440x1440及以上；</span>至多可上传5张，拖拽可调整顺序</span><button onClick={crop11} className="text-qn-600">从3:4主图裁剪</button></div>
                <Slots list={f.images} max={5} target="main" onChange={l => up({ images: l })} />
              </Row>
              <Row k="title" label="宝贝标题" required>
                <div className="relative"><input aria-label="宝贝标题" className="input-qn h-10 pr-28" placeholder="最多允许输入30个汉字（60字符）" value={f.title} onChange={e => up({ title: e.target.value })} /><div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2"><Count v={f.title} max={60} /><button onClick={() => setAiOpen(aiOpen === 'title' ? null : 'title')} className="text-xs text-qn-600 font-medium bg-qn-50 px-1.5 h-6 rounded">AI推荐</button></div>
                  {aiOpen === 'title' && <div className="absolute right-0 top-full mt-1 w-full sm:w-[420px] bg-white border border-ink-200 rounded-xl shadow-float z-20 p-2 text-sm"><div className="text-xs text-ink-500 px-2 py-1">根据类目、品牌与属性生成，点击使用</div>{aiTitles.map(t => <button key={t} onClick={() => { up({ title: t }); setAiOpen(null) }} className="block w-full text-left px-2 py-2 rounded-lg hover:bg-qn-50">{t}</button>)}</div>}
                </div>
              </Row>
              <Row k="guide" label={<>导购标题<Hq /></>}>
                <div className="text-xs text-ink-500 mb-2">标题结构推荐：品牌 + 品类词 + 利益点</div>
                <div className="relative"><input aria-label="导购标题" className="input-qn h-10 pr-28" placeholder="最多输入30字符（15个汉字）" value={pub.guideTitle} onChange={e => upPub({ guideTitle: e.target.value })} /><div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2"><Count v={pub.guideTitle} max={30} /><button onClick={() => setAiOpen(aiOpen === 'guide' ? null : 'guide')} className="text-xs text-qn-600 font-medium bg-qn-50 px-1.5 h-6 rounded">AI推荐</button></div>
                  {aiOpen === 'guide' && <div className="absolute right-0 top-full mt-1 w-full sm:w-[360px] bg-white border border-ink-200 rounded-xl shadow-float z-20 p-2 text-sm">{aiGuides.map(t => <button key={t} onClick={() => { upPub({ guideTitle: t }); setAiOpen(null) }} className="block w-full text-left px-2 py-2 rounded-lg hover:bg-qn-50">{t}</button>)}</div>}
                </div>
              </Row>
              <Row k="props" label="类目属性">
                <div className="rounded-xl bg-[#f7f8fa] p-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-x-5 gap-y-4">
                  <div id="row-brand"><div className="text-xs text-ink-700 mb-1.5">品牌</div><input aria-label="品牌" list="brand-list" className="input-qn h-9 text-sm bg-white" placeholder="请输入" value={pub.brand} onChange={e => upPub({ brand: e.target.value })} /><datalist id="brand-list">{tpl.brands.map(b => <option key={b} value={b} />)}</datalist><div className="text-[11px] text-ink-400 leading-4 mt-1">正确填写品牌信息有助于提升曝光，请正确填写，若未找到品牌，请<button onClick={() => { const b = prompt('新增品牌'); if (b) upPub({ brand: b }) }} className="text-qn-600">[新增品牌]</button>或选择【无品牌/无注册商标】</div>{err('brand') && <div className="text-xs text-red-500 mt-1">{err('brand')}</div>}</div>
                  {tpl.attrs.map(a => (
                    <div key={a.name}><div className="text-xs text-ink-700 mb-1.5">{a.name}{a.required && <span className="text-red-500">*</span>}</div>
                      {a.type === 'select' ? <select aria-label={a.name} className={cls('input-qn h-9 text-sm bg-white', !pub.props[a.name] && 'text-ink-400')} value={pub.props[a.name] ?? ''} onChange={e => upPub({ props: { ...pub.props, [a.name]: e.target.value } })}><option value="">请选择</option>{a.options!.map(o => <option key={o} value={o}>{o}</option>)}</select>
                        : <input aria-label={a.name} className="input-qn h-9 text-sm bg-white" placeholder="请输入" value={pub.props[a.name] ?? ''} onChange={e => upPub({ props: { ...pub.props, [a.name]: e.target.value } })} />}
                      {err(`prop-${a.name}`) && <div className="text-xs text-red-500 mt-1">{err(`prop-${a.name}`)}</div>}
                    </div>
                  ))}
                </div>
              </Row>
              <Row k="custom" label="自定义商品属性">
                <div className="text-xs text-ink-500 mb-2">您最多可添加5组自定义属性，可参考如下2组示例：工艺：磨毛；图案：千鸟格</div>
                <div className="space-y-2">{pub.customProps.map((c, i) => <div key={i} className="flex gap-2 items-center"><input aria-label="属性名" className="input-qn h-9 w-36 text-sm" placeholder="属性名" value={c.name} onChange={e => upPub({ customProps: pub.customProps.map((x, j) => j === i ? { ...x, name: e.target.value } : x) })} /><span className="text-ink-400">：</span><input aria-label="属性值" className="input-qn h-9 w-56 text-sm" placeholder="属性值" value={c.value} onChange={e => upPub({ customProps: pub.customProps.map((x, j) => j === i ? { ...x, value: e.target.value } : x) })} /><button aria-label="删除" onClick={() => upPub({ customProps: pub.customProps.filter((_, j) => j !== i) })} className="text-ink-400 hover:text-red-500"><Trash2 className="w-4 h-4" /></button></div>)}</div>
                <div className="flex items-center gap-3 mt-2"><button disabled={pub.customProps.length >= 5} onClick={() => upPub({ customProps: [...pub.customProps, { name: '', value: '' }] })} className="btn h-8 px-4 bg-ink-100 text-ink-800 hover:bg-ink-200 text-xs disabled:opacity-50">添加属性</button><span className="text-xs text-ink-400">属性总数最多 5 组</span></div>
              </Row>
              <Row k="isCustom" label="是否定制"><div className="flex gap-6"><Radio on={pub.isCustom} onClick={() => upPub({ isCustom: true })}>是</Radio><Radio on={!pub.isCustom} onClick={() => upPub({ isCustom: false })}>否</Radio></div></Row>
              <Row k="purchase" label="采购地" required><div className="flex gap-6 flex-wrap"><Radio on={pub.purchaseFrom === 'cn'} onClick={() => upPub({ purchaseFrom: 'cn' })}>中国内地（大陆）</Radio><Radio on={pub.purchaseFrom === 'abroad'} onClick={() => upPub({ purchaseFrom: 'abroad' })}>中国港澳台地区及其他国家和地区</Radio></div></Row>
            </div>
            <Collapse k="basic" summary="宝贝类型：全新" />
          </section>

          {/* ===== 销售信息 ===== */}
          <section id="sec-sale" className="mt-3 rounded-xl bg-white shadow-card px-5 py-4">
            <div className="flex items-center justify-between gap-3 flex-wrap"><h2 className="text-lg font-medium text-ink-900">销售信息</h2><div className="flex items-center gap-3"><button onClick={() => toast('批量导入：支持 Excel 导入 SKU 价格/库存（演示）', 'info')} className="btn h-8 px-3 border border-ink-200 bg-white text-xs text-ink-800 relative"><Upload className="w-3.5 h-3.5" />批量导入<span className="absolute -top-2 -right-1 tag bg-qn-500 text-white">AI</span></button><Tpl k="销售信息" value={pub.template} onChange={v => upPub({ template: v })} /></div></div>
            <div className="divide-y divide-ink-50 mt-1">
              <Row k="sku" label={<>销售规格<Hq /></>}>
                <div className="text-xs text-ink-500 mb-2">近期已升级SKU面板，优化SKU创建流程提升操作体验。 <button onClick={() => setHelp('sku')} className="text-qn-600">查看详情</button> 。</div>
                <div className="flex items-center gap-2"><button onClick={() => setSpec(true)} className="btn h-8 px-3 bg-ink-100 text-ink-800 hover:bg-ink-200 text-xs"><Plus className="w-3.5 h-3.5" />{f.skus.length ? '修改规格' : '创建规格'}</button>{f.skus.length > 0 && <span className="text-xs text-ink-500">{f.attrs.map(a => `${a.name} ${a.values.length}`).join(' × ')} · 共 {f.skus.length} 个 SKU</span>}</div>
                {f.skus.length > 0 && <SkuTable f={f} pub={pub} setSku={setSku} up={up} onPickImage={k => setSpace({ target: 'sku', key: k })} upPub={upPub} />}
              </Row>
              <Row k="price" label="一口价" required><div className="flex items-center gap-2"><input aria-label="一口价" type="number" min={0} step={0.01} className="input-qn h-10 w-72" value={f.price || ''} onChange={e => { const v = Number(e.target.value); up({ price: v, skus: f.skus.map(s => s.price ? s : { ...s, price: v }) }) }} /><span className="text-sm text-ink-700">元</span></div></Row>
              <Row k="stock" label="总库存" required>
                <div className="flex items-center gap-2"><input aria-label="总库存" type="number" min={0} readOnly={f.skus.length > 0} className={cls('input-qn h-10 w-72', f.skus.length > 0 && 'bg-ink-50 text-ink-500')} value={totalStock} onChange={e => up({ stock: Number(e.target.value) })} /><span className="text-sm text-ink-700">件</span></div>
                <div className="text-xs text-ink-500 mt-1.5">总库存不包含新增批次库存 <button onClick={() => toast('批次库存：按批次设置不同发货时效（演示）', 'info')} className="text-qn-600">设置批次库存发货时效</button></div>
              </Row>
              <Row k="notes" label={<>购买须知<Hq /></>}><div className="relative"><input aria-label="购买须知" className="input-qn h-10 pr-14" value={pub.buyNotes} onChange={e => upPub({ buyNotes: e.target.value })} placeholder="如：定制商品不支持退换，下单后 3 天内发货" /><span className="absolute right-3 top-1/2 -translate-y-1/2"><Count v={pub.buyNotes} max={60} /></span></div></Row>
              <Row k="code" label="商家编码"><div className="relative"><input aria-label="商家编码" className="input-qn h-10 pr-14" value={pub.sellerCode} onChange={e => upPub({ sellerCode: e.target.value })} /><span className="absolute right-3 top-1/2 -translate-y-1/2"><Count v={pub.sellerCode} max={64} /></span></div></Row>
              <Row k="discount" label={<>多件优惠<Flame className="w-3.5 h-3.5 text-brand-500 inline ml-0.5" /><Hq /></>}>
                <div className="text-xs text-ink-500 mb-2">设置2件优惠，折扣力度5.0-9.9折；折扣力度越大，提客单价和销量效果越佳；且可在详情/下单/购物车表达优惠、还能分摊运费成本，快去设置吧~</div>
                <div className="flex items-center gap-3 flex-wrap"><Check on={pub.multiDiscount.enabled} disabled={!(f.price > 0)} onClick={() => upPub({ multiDiscount: { ...pub.multiDiscount, enabled: !pub.multiDiscount.enabled } })}>启用</Check><select aria-label="件数" disabled={!(f.price > 0)} className="input-qn h-9 w-32 text-sm disabled:bg-ink-50 disabled:text-ink-400" value={pub.multiDiscount.count} onChange={e => upPub({ multiDiscount: { ...pub.multiDiscount, count: Number(e.target.value) } })}>{[2, 3, 4, 5].map(n => <option key={n} value={n}>满{n}件打折</option>)}</select><input aria-label="折扣" type="number" min={5} max={9.9} step={0.1} disabled={!(f.price > 0)} className="input-qn h-9 w-20 text-sm disabled:bg-ink-50 disabled:text-ink-400" value={pub.multiDiscount.discount} onChange={e => upPub({ multiDiscount: { ...pub.multiDiscount, discount: Math.min(9.9, Math.max(5, Number(e.target.value) || 9.5)) } })} /><span className="text-sm text-ink-700">折</span></div>
                {!(f.price > 0) ? <div className="mt-2 rounded-lg bg-[#eef3fe] px-3 py-2 text-xs text-ink-700 flex items-center gap-1.5"><Info className="w-3.5 h-3.5 text-qn-500" />一口价必须大于0，请先设置</div> : pub.multiDiscount.enabled && <div className="mt-2 text-xs text-ink-500">买家购买 {pub.multiDiscount.count} 件及以上享 {pub.multiDiscount.discount} 折，单件约 ¥{money(f.price * pub.multiDiscount.discount / 10)}</div>}
              </Row>
              {isExp('sale') && <Row k="stockMode" label="库存扣减方式" required><div className="flex gap-6"><Radio on={pub.stockMode === 'order'} onClick={() => upPub({ stockMode: 'order' })}>拍下减库存<Hq /></Radio><Radio on={pub.stockMode === 'pay'} onClick={() => upPub({ stockMode: 'pay' })}>付款减库存<Hq /></Radio></div></Row>}
              {isExp('sale') && <Row k="listing" label="上架时间" required>
                <div className="text-xs text-ink-500 mb-2">定时上架的商品在上架前请到“仓库中的宝贝”里编辑商品。</div>
                <div className="flex gap-6 flex-wrap items-center"><Radio on={pub.listing === 'now'} onClick={() => upPub({ listing: 'now' })}>立刻上架</Radio><Radio on={pub.listing === 'timed'} onClick={() => upPub({ listing: 'timed' })}>定时上架</Radio>{pub.listing === 'timed' && <input aria-label="上架时间" type="datetime-local" className="input-qn h-9 w-56 text-sm" value={pub.listAt ?? ''} onChange={e => upPub({ listAt: e.target.value })} />}<Radio on={pub.listing === 'warehouse'} onClick={() => upPub({ listing: 'warehouse' })}>放入仓库</Radio></div>
              </Row>}
            </div>
            <Collapse k="sale" summary={`库存扣减方式：${pub.stockMode === 'order' ? '拍下减库存' : '付款减库存'} · 上架时间：${pub.listing === 'now' ? '立刻上架' : pub.listing === 'timed' ? '定时上架' : '放入仓库'}`} />
          </section>

          {/* ===== 物流服务 ===== */}
          <section id="sec-logi" className="mt-3 rounded-xl bg-white shadow-card px-5 py-4">
            <div className="flex items-center justify-between"><h2 className="text-lg font-medium text-ink-900">物流服务</h2><Tpl k="物流服务" value={pub.template} onChange={v => upPub({ template: v })} /></div>
            <div className="divide-y divide-ink-50 mt-1">
              <Row k="ship" label="发货时间" required>
                <div className="flex gap-6"><Radio on={!pub.shipBySku} onClick={() => upPub({ shipBySku: false })}>按商品统一设置</Radio><Radio on={pub.shipBySku} onClick={() => upPub({ shipBySku: true })}>按规格单独设置</Radio></div>
                {!pub.shipBySku ? <div className="mt-2 rounded-lg bg-[#f7f8fa] px-4 py-3 flex gap-6 flex-wrap"><Radio on={pub.shipTime === '24h'} onClick={() => upPub({ shipTime: '24h' })}>24小时内发货<span className="text-brand-500 ml-1">提升转化</span><Hq /></Radio><Radio on={pub.shipTime === '48h'} onClick={() => upPub({ shipTime: '48h' })}>48小时内发货</Radio><Radio on={pub.shipTime === 'gt48h'} onClick={() => upPub({ shipTime: 'gt48h' })}>大于48小时发货</Radio></div> : <div className="mt-2 text-xs text-ink-500">{f.skus.length ? '请在上方 SKU 表格中为每个规格设置发货时间' : '请先创建规格后在 SKU 表格中设置'}</div>}
              </Row>
              <Row k="delivery" label="提取方式" required>
                <div className="flex items-start gap-2"><Check on={pub.delivery} onClick={() => upPub({ delivery: !pub.delivery })}>使用物流配送</Check><div className="text-xs text-ink-500 leading-5">为了提升消费者购物体验，淘宝要求全网商品设置运费模板，如何使用模板，<button onClick={() => toast('视频教程（演示）', 'info')} className="text-qn-600">查看视频教程</button><div>使用官方寄件，集合多家运力，一键发货更便捷、全程保障价更低。<button onClick={() => nav('/seller/logistics?tab=send')} className="text-qn-600">点击体验</button></div></div></div>
                {pub.delivery && <div className="mt-2 flex items-center gap-2 flex-wrap text-sm"><span className="text-ink-700">运费模板</span><select aria-label="运费模板" className="input-qn h-9 w-64 text-sm" value={pub.freightTemplate} onChange={e => upPub({ freightTemplate: e.target.value })}>{['包邮', '按件计费（首件 ¥10，续件 ¥5）', '按重量计费（首重 ¥8）', '偏远地区不包邮', '运费到付'].map(o => <option key={o} value={o}>{o}</option>)}</select><button onClick={() => nav('/seller/logistics/service')} className="text-qn-600 text-xs">新建运费模板</button></div>}
                <div className="mt-3 flex items-center gap-2"><Check on disabled>电子交易凭证</Check><span className="text-xs text-ink-500">您未开通电子凭证，<button onClick={() => toast('已提交电子凭证开通申请（演示）')} className="text-qn-600">申请开通</button></span></div>
              </Row>
              {isExp('logi') && <Row k="region" label="区域限售">
                <div className="flex gap-6 flex-wrap"><Radio on={pub.regionLimit === 'none'} onClick={() => upPub({ regionLimit: 'none' })}>不设置商品维度区域限售模板</Radio><Radio on={pub.regionLimit === 'template'} onClick={() => upPub({ regionLimit: 'template' })}>选择商品维度区域限售模板</Radio></div>
                <div className="text-xs text-ink-500 mt-2 leading-5">若是后续设置了全店维度区域限售模板，当前商品也会生效，此处会有文案进行提示。可以前往区域限售页面，设置全店维度限售模板，或者批量给一批商品设置商品维度限售模板，<button onClick={() => nav('/seller/logistics/service')} className="text-qn-600">去设置</button></div>
              </Row>}
              {isExp('logi') && <Row k="after" label="售后服务">
                <div className="space-y-2"><Check on={pub.warranty} onClick={() => upPub({ warranty: !pub.warranty })}>保修服务</Check>
                  {tpl.sevenDays ? <Check on={pub.sevenDays} onClick={() => upPub({ sevenDays: !pub.sevenDays })}>服务承诺：7天无理由退换货</Check> : <Check on disabled>服务承诺：该类商品，不支持【七天退货】服务</Check>}
                </div>
              </Row>}
            </div>
            <Collapse k="logi" summary={`区域限售：${pub.regionLimit === 'none' ? '不设置' : '已选模板'} · 售后：${pub.warranty ? '保修 ' : ''}${pub.sevenDays ? '7天无理由' : '不支持七天退货'}`} />
          </section>

          {/* ===== 图文描述 ===== */}
          <section id="sec-desc" className="mt-3 rounded-xl bg-white shadow-card px-5 py-4">
            <h2 className="text-lg font-medium text-ink-900">图文描述</h2>
            <div className="mt-3 rounded-lg bg-[#f7f8fa] px-4 py-2.5 text-sm text-ink-900">基础素材</div>
            <div className="divide-y divide-ink-50">
              <Row k="main34" label="3:4主图">
                <div className="text-xs text-ink-500 mb-2">图片要求：宽高比为3:4，<span className="text-brand-500">推荐尺寸1440x1920及以上；</span>至多可上传5张，拖拽可调整顺序 <button onClick={crop34} className="text-qn-600">从1:1主图裁剪</button></div>
                <Slots list={pub.images34} max={5} target="34" onChange={l => upPub({ images34: l })} />
              </Row>
              <Row k="video" label="商品视频">
                <div className="text-xs text-ink-500 mb-2">视频要求：时长5秒-5分钟；宽高比支持1:1、3:4、9:16（<span className="text-brand-500">9:16视频商品详情页不展示，可在首页推荐、微详情等展示</span>）最多可上传5个 <button onClick={() => toast('智能模板视频：用主图自动生成 15s 视频（演示）', 'info')} className="text-qn-600">智能模板视频</button> <button onClick={() => toast('视频一键剪辑（演示）', 'info')} className="text-qn-600">视频一键剪辑</button></div>
                {pub.video ? <div className="w-[88px] h-[88px] rounded-lg bg-ink-900 text-white flex flex-col items-center justify-center text-xs relative group"><Video className="w-5 h-5 mb-1" />{pub.video}<button aria-label="删除视频" onClick={() => upPub({ video: '' })} className="absolute top-1 right-1 hidden group-hover:block"><X className="w-3.5 h-3.5" /></button></div>
                  : <button onClick={async () => { const [file] = await pickFiles('video/*'); if (!file) return; if (file.size > 200 * 1024 * 1024) return toast('视频不能超过 200MB', 'error'); upPub({ video: `${Math.max(5, Math.round(file.size / 350000))}s` }); toast('视频已上传，转码完成后在详情页展示（演示）') }} className="w-[88px] h-[88px] rounded-lg border border-dashed border-ink-300 flex flex-col items-center justify-center text-ink-500 text-xs hover:border-qn-500 hover:text-qn-600"><Video className="w-4 h-4 mb-1" />上传视频</button>}
              </Row>
            </div>
            <div className="mt-2 rounded-lg bg-[#f7f8fa] px-4 py-2.5 text-sm text-ink-900">导购素材</div>
            <div className="divide-y divide-ink-50">
              <Row k="white" label={<>白底图<Hq /></>}>
                <div className="text-xs text-ink-500 mb-2">图片要求：要求尺寸800x800，纯白背景、商品主体清晰完整。审核通过图片将用于频道、活动等场景，可获得更多场域曝光机会。 <button onClick={genWhite} className="text-qn-600">从主图生成</button></div>
                <Slots list={pub.whiteImage ? [pub.whiteImage] : []} max={1} target="white" onChange={l => upPub({ whiteImage: l[0] ?? '' })} />
              </Row>
              <Row k="detail" label="宝贝详情" required>
                <div className="flex items-start justify-between gap-3 text-xs text-ink-500 mb-2"><span>填写宝贝详情可提升商品转化。若您未添加任何图片/文字，提交后将用商品主图自动填充至图文详情（添加后删除不会自动填充）</span><button onClick={() => toast('旧版图文描述已下线（演示）', 'info')} className="text-qn-600 shrink-0">返回旧版图文描述</button></div>
                <div className="rounded-lg bg-[#eef3fe] px-3 py-2 text-xs text-ink-700 flex items-center gap-1.5 mb-3"><Info className="w-3.5 h-3.5 text-qn-500" />宝贝详情图【高/宽≤ 2】，超出将被裁剪。建议宽度≥1440像素以确保清晰。</div>
                <DetailEditor blocks={pub.detailBlocks} onChange={b => upPub({ detailBlocks: b })} onUpload={async () => addImages('detail', await pickFiles('image/*', true))} onSpace={() => setSpace({ target: 'detail' })} uploading={uploading === 'detail'} product={f} onPreview={() => setPreview(true)} shopName={shop.name} />
              </Row>
              <Row k="shopcat" label="店铺中分类">
                <div className="text-xs text-ink-500 mb-2">最多支持选择20项分类，<button onClick={() => nav('/seller/shop?tab=decorate')} className="text-qn-600">查看店铺分类</button></div>
                <ShopCatSelect value={pub.shopCats} onChange={v => upPub({ shopCats: v })} />
              </Row>
            </div>
          </section>
        </main>
      </div>

      {/* 底部操作栏 */}
      <div className="fixed bottom-0 left-0 right-0 h-16 bg-white border-t border-ink-200 z-30">
        <div className="h-full flex items-center justify-center gap-3 px-3 text-sm">
          <button onClick={submit} disabled={submitting} className="btn-qn h-11 px-6 rounded-full text-[15px]">{submitting && <Loader2 className="w-4 h-4 animate-spin" />}提交宝贝信息</button>
          <div className="flex items-center h-11 rounded-full bg-ink-100 overflow-hidden"><button onClick={() => nav('/seller/products?tab=draft')} className="h-full px-4 flex items-center gap-1.5 text-ink-800 hover:bg-ink-200"><Mail className="w-4 h-4" />{draftsCount}</button><span className="w-px h-5 bg-ink-300" /><button onClick={saveDraft} className="h-full px-4 text-ink-800 hover:bg-ink-200 flex items-center gap-1"><Save className="w-4 h-4 md:hidden" />保存草稿</button></div>
          {savedAt && <span className="hidden sm:flex items-center gap-1 text-xs text-ink-500"><CheckCircle2 className="w-4 h-4 text-emerald-500" />最后保存于{savedAt.getFullYear()}-{String(savedAt.getMonth() + 1).padStart(2, '0')}-{String(savedAt.getDate()).padStart(2, '0')} {String(savedAt.getHours()).padStart(2, '0')}:{String(savedAt.getMinutes()).padStart(2, '0')}</span>}
        </div>
      </div>

      <SpecDrawer open={spec} onClose={() => setSpec(false)} tpl={tpl} attrs={f.attrs} mode={pub.skuMode} images={pub.skuImages} price={f.price} onConfirm={applySpec} onPickImage={k => setSpace({ target: 'sku', key: k })} />
      <ImageSpace open={!!space} onClose={() => setSpace(null)} multiple={space?.target !== 'white' && space?.target !== 'sku'} max={space?.target === 'detail' ? 20 : 5} onPick={fromSpace} />
      <Modal open={preview} onClose={() => setPreview(false)} title="详情预览" width={420}><Phone product={f} blocks={pub.detailBlocks} shopName={shop.name} tab="详情" /></Modal>
      <AiBubble />
    </PubShell>
    </PubCtx.Provider>
  )
}

// ---------- SKU 表格 ----------
function SkuTable({ f, pub, setSku, up, onPickImage, upPub }: { f: Product; pub: PublishInfo; setSku: (i: number, p: Partial<Sku>) => void; up: (p: Partial<Product>) => void; onPickImage: (k: string) => void; upPub: (p: Partial<PublishInfo>) => void }) {
  const [bp, setBp] = useState(''); const [bs, setBs] = useState('')
  const withImg = f.attrs[0] && Object.keys(pub.skuImages).length > 0
  const shipKey = (s: Sku) => `ship:${s.id}`
  return (
    <div className="mt-3 rounded-lg border border-ink-200 overflow-hidden">
      <div className="bg-[#f7f8fa] px-3 py-2 flex items-center gap-2 text-xs text-ink-700 flex-wrap"><span>批量设置</span><input aria-label="批量价格" type="number" className="input-qn h-7 w-24 text-xs" placeholder="价格" value={bp} onChange={e => setBp(e.target.value)} /><input aria-label="批量库存" type="number" className="input-qn h-7 w-24 text-xs" placeholder="库存" value={bs} onChange={e => setBs(e.target.value)} /><button onClick={() => { up({ skus: f.skus.map(s => ({ ...s, price: bp ? Number(bp) : s.price, stock: bs ? Number(bs) : s.stock })) }); toast('已应用到全部 SKU') }} className="btn h-7 px-3 bg-qn-500 text-white text-xs">应用</button><span className="ml-auto text-ink-400">共 {f.skus.length} 个 SKU</span></div>
      <table className="w-full text-sm">
        <thead><tr className="text-left text-ink-600 bg-white border-b border-ink-100">{withImg && <th className="px-3 py-2 font-normal">SKU图片</th>}{f.attrs.map(a => <th key={a.name} className="px-3 py-2 font-normal">{a.name}</th>)}<th className="px-3 py-2 font-normal">价格(元)<span className="text-red-500">*</span></th><th className="px-3 py-2 font-normal">库存(件)<span className="text-red-500">*</span></th><th className="px-3 py-2 font-normal">商家编码</th>{pub.shipBySku && <th className="px-3 py-2 font-normal">发货时间</th>}<th className="px-3 py-2 font-normal">状态</th></tr></thead>
        <tbody>{f.skus.map((s, i) => {
          const k = s.attrs[f.attrs[0]?.name]
          return <tr key={s.id} className="border-b border-ink-50">
            {withImg && <td className="px-3 py-1.5">{pub.skuImages[k] ? <img src={pub.skuImages[k]} alt="" className="w-9 h-9 rounded object-cover" /> : <button onClick={() => onPickImage(k)} className="w-9 h-9 rounded border border-dashed border-ink-300 text-ink-400 flex items-center justify-center"><ImageIcon className="w-3.5 h-3.5" /></button>}</td>}
            {f.attrs.map(a => <td key={a.name} className="px-3 py-1.5 text-ink-800">{s.attrs[a.name]}</td>)}
            <td className="px-3 py-1.5"><input aria-label="价格" type="number" min={0} step={0.01} className="input-qn h-8 w-24 text-sm" value={s.price || ''} onChange={e => setSku(i, { price: Number(e.target.value) })} /></td>
            <td className="px-3 py-1.5"><input aria-label="库存" type="number" min={0} className="input-qn h-8 w-20 text-sm" value={s.stock} onChange={e => setSku(i, { stock: Number(e.target.value) })} /></td>
            <td className="px-3 py-1.5"><input aria-label="商家编码" className="input-qn h-8 w-28 text-sm" placeholder={pub.sellerCode ? `${pub.sellerCode}-${i + 1}` : ''} /></td>
            {pub.shipBySku && <td className="px-3 py-1.5"><select aria-label="发货时间" className="input-qn h-8 w-32 text-xs" value={pub.props[shipKey(s)] ?? pub.shipTime} onChange={e => upPub({ props: { ...pub.props, [shipKey(s)]: e.target.value } })}><option value="24h">24小时内</option><option value="48h">48小时内</option><option value="gt48h">大于48小时</option></select></td>}
            <td className="px-3 py-1.5 text-xs"><span className={s.stock > 0 ? 'tag-green' : 'tag-gray'}>{s.stock > 0 ? '可售' : '无库存'}</span></td>
          </tr>
        })}</tbody>
      </table>
    </div>
  )
}

// ---------- 创建规格抽屉 ----------
const MAIN_COLORS = ['黑色', '白色', '灰色', '红色', '粉色', '橙色', '黄色', '绿色', '青色', '蓝色', '紫色', '棕色', '米色', '卡其色', '藏青色', '银色', '金色', '透明', '花色', '其他']
function SpecDrawer({ open, onClose, tpl, attrs, mode: mode0, images: images0, price, onConfirm, onPickImage }: { open: boolean; onClose: () => void; tpl: PubTemplate; attrs: Product['attrs']; mode: 'custom' | 'standard'; images: Record<string, string>; price: number; onConfirm: (attrs: { name: string; values: string[] }[], mode: 'custom' | 'standard', images: Record<string, string>) => void; onPickImage: (k: string) => void }) {
  const [mode, setMode] = useState(mode0)
  const [custom, setCustom] = useState<string[]>([])
  const [customIn, setCustomIn] = useState('')
  const [useProps, setUseProps] = useState<string[]>([])
  const [vals, setVals] = useState<Record<string, string[]>>({})
  const [withImg, setWithImg] = useState(false)
  const [images, setImages] = useState<Record<string, string>>({})
  const [color, setColor] = useState(''); const [note, setNote] = useState(''); const [other, setOther] = useState<Record<string, string>>({})
  useEffect(() => {
    if (!open) return
    setMode(mode0); setImages(images0); setWithImg(Object.keys(images0).length > 0)
    if (mode0 === 'custom') { setCustom(attrs[0]?.values ?? []); setUseProps([tpl.saleProps[0].name]); setVals({}) }
    else { const names = attrs.length ? attrs.map(a => a.name) : [tpl.saleProps[0].name]; setUseProps(names); setVals(Object.fromEntries(attrs.map(a => [a.name, a.values]))); setCustom([]) }
    setColor(''); setNote(''); setOther({})
  }, [open]) // eslint-disable-line
  // 外部图片空间选择结果同步
  useEffect(() => { if (open) setImages(x => ({ ...x, ...images0 })) }, [images0, open])
  if (!open) return null
  const addVal = (name: string, v: string) => { if (!v.trim()) return; setVals(x => ({ ...x, [name]: [...(x[name] ?? []).filter(y => y !== v.trim()), v.trim()] })) }
  const reset = () => { setCustom([]); setVals({}); setImages({}); setUseProps([tpl.saleProps[0].name]) }
  const confirm = () => {
    if (mode === 'custom') { if (!custom.length) return toast('请至少添加一个规格', 'error'); onConfirm([{ name: '商品规格', values: custom }], 'custom', {}); return }
    const out = useProps.map(n => ({ name: n, values: vals[n] ?? [] })).filter(a => a.values.length)
    if (!out.length) return toast('请至少为一个属性添加值', 'error')
    onConfirm(out, 'standard', withImg ? images : {})
  }
  const total = mode === 'custom' ? custom.length : useProps.reduce((a, n) => a * Math.max(1, (vals[n] ?? []).length), 1)
  return (
    <div className="fixed inset-0 z-[8000]">
      <div className="absolute inset-0 bg-ink-900/40" onClick={onClose} />
      <div className="absolute right-0 top-0 bottom-0 w-full md:w-[1000px] bg-white shadow-pop flex flex-col animate-fadeUp">
        <div className="h-14 px-6 flex items-center justify-between border-b border-ink-100"><div className="text-base text-ink-900">设置</div><button aria-label="关闭" onClick={onClose}><X className="w-5 h-5 text-ink-500" /></button></div>
        <div className="flex-1 overflow-auto p-6 grid md:grid-cols-[220px_1fr] gap-8">
          <div className="hidden md:block">
            <div className="w-[200px] h-[400px] rounded-[28px] bg-ink-900 p-2 shadow-pop"><div className="w-full h-full rounded-[22px] bg-white overflow-hidden flex flex-col text-[9px]">
              <div className="h-6 flex items-center justify-between px-3 text-[8px] text-ink-700"><span>9:41</span><span>●●● ▲ ▮</span></div>
              <div className="text-center font-medium text-[10px] py-1">确认订单</div>
              <div className="mx-2 rounded-lg bg-ink-50 p-2"><div className="text-ink-900">⌾ 海小宝 浙江省杭州市XXXXXXX</div><div className="text-ink-400 text-[8px] mt-0.5">快递 包邮 预计今天发货</div></div>
              <div className="mx-2 mt-2 flex gap-2"><div className="w-12 h-12 rounded bg-gradient-to-br from-amber-100 to-brand-100" /><div className="flex-1"><div className="text-brand-500"><span className="text-[8px]">实付 ¥</span><span className="text-sm font-semibold">{price || 348}</span></div><div className="text-[8px] text-brand-500 bg-brand-50 inline-block px-1 rounded">总优惠 ¥10</div><div className="text-[8px] text-ink-500 mt-0.5 text-right">－ 1 ＋</div></div></div>
              <div className="mx-2 mt-2 text-ink-700">{mode === 'custom' ? '规格' : '参数1'}</div>
              <div className="mx-2 mt-1 grid grid-cols-3 gap-1">{(mode === 'custom' ? (custom.length ? custom : ['自定义创建SKU名称1', '自定义创建SKU名称2', '自定义创建SKU名称3', '自定义创建SKU名称4', '自定义创建SKU名称5']) : (vals[useProps[0]]?.length ? vals[useProps[0]] : ['内容1', '内容2', '内容3', '内容4', '内容5', '内容6', '内容7'])).slice(0, 9).map(v => <div key={v} className="h-4 rounded bg-ink-100 text-[7px] text-ink-600 flex items-center justify-center truncate px-1">{v}</div>)}</div>
              <div className="mt-auto mx-2 mb-3 h-7 rounded-md bg-brand-500 text-white flex items-center justify-center">立即支付</div>
            </div></div>
            <div className="text-xs text-ink-500 text-center mt-2 w-[200px]">详情展示示意</div>
          </div>
          <div>
            <div className="text-sm text-ink-900">选择展示模式 <span className="text-brand-500 ml-2">详情展示</span></div>
            <div className="mt-3 rounded-xl bg-[#f7f8fa] p-4">
              <div className="flex gap-8 text-sm"><button onClick={() => setMode('custom')} className="inline-flex items-center gap-1.5"><span className={cls('w-4 h-4 rounded-full border-[1.5px] flex items-center justify-center', mode === 'custom' ? 'border-qn-500' : 'border-ink-300')}>{mode === 'custom' && <span className="w-2 h-2 rounded-full bg-qn-500" />}</span>自定义填写规格</button><button onClick={() => setMode('standard')} className="inline-flex items-center gap-1.5"><span className={cls('w-4 h-4 rounded-full border-[1.5px] flex items-center justify-center', mode === 'standard' ? 'border-qn-500' : 'border-ink-300')}>{mode === 'standard' && <span className="w-2 h-2 rounded-full bg-qn-500" />}</span>选择标准属性构建规格</button></div>
              {mode === 'standard' && <div className="mt-4 pt-4 border-t border-ink-100"><div className="flex items-center justify-between text-sm"><span>属性 {useProps.length}/{tpl.saleProps.length}:</span><span className="text-xs text-ink-400">排序</span></div><div className="mt-2 flex gap-2 flex-wrap">{tpl.saleProps.map(p => { const on = useProps.includes(p.name); return <button key={p.name} onClick={() => setUseProps(on ? useProps.filter(x => x !== p.name) : [...useProps, p.name])} className={cls('px-2 h-7 rounded border text-xs', on ? 'border-qn-500 text-qn-600 bg-qn-50' : 'border-ink-300 text-ink-700 bg-white')}>{p.name}</button> })}</div></div>}
            </div>

            {mode === 'custom' ? (
              <div className="mt-4">
                <div className="flex items-center justify-between text-sm"><span>商品规格({custom.length})</span><span className="text-xs text-ink-400">排序</span></div>
                <div className="mt-2 flex items-center gap-2"><span className="w-9 h-9 rounded border border-ink-200 flex items-center justify-center text-ink-400"><ImageIcon className="w-4 h-4" /></span><input aria-label="输入规格" className="input-qn h-9 w-48 text-sm" placeholder="输入规格" value={customIn} onChange={e => setCustomIn(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && customIn.trim()) { setCustom([...custom.filter(x => x !== customIn.trim()), customIn.trim()]); setCustomIn('') } }} /><button aria-label="添加" onClick={() => { if (customIn.trim()) { setCustom([...custom.filter(x => x !== customIn.trim()), customIn.trim()]); setCustomIn('') } }} className={cls('w-9 h-9 rounded flex items-center justify-center', customIn.trim() ? 'bg-qn-500 text-white' : 'bg-ink-100 text-ink-400')}><Plus className="w-4 h-4" /></button></div>
                <div className="mt-3 flex gap-2 flex-wrap">{custom.map(v => <span key={v} className="inline-flex items-center gap-1 px-2.5 h-8 rounded-lg bg-white border border-ink-200 text-sm">{v}<button aria-label="删除" onClick={() => setCustom(custom.filter(x => x !== v))}><X className="w-3.5 h-3.5 text-ink-400" /></button></span>)}</div>
              </div>
            ) : useProps.map((name, idx) => {
              const sp = tpl.saleProps.find(p => p.name === name)!
              const isColor = /颜色|机身颜色/.test(name)
              return (
                <div key={name} className="mt-5">
                  <div className="flex items-center justify-between text-sm"><div className="flex items-center gap-3"><span>{name} ({(vals[name] ?? []).length})<CircleHelp className="w-3.5 h-3.5 text-ink-300 inline ml-0.5" /></span>{idx === 0 && <label className="inline-flex items-center gap-1.5 text-sm"><input type="checkbox" className="accent-qn-500" checked={withImg} onChange={e => setWithImg(e.target.checked)} />添加图片</label>}</div><span className="text-xs text-ink-400">排序</span></div>
                  <div className="mt-2 flex items-center gap-2 flex-wrap">
                    {isColor ? <><input aria-label="主色" list={`colors-${name}`} className="input-qn h-9 w-48 text-sm" placeholder="主色(必选)" value={color} onChange={e => setColor(e.target.value)} /><datalist id={`colors-${name}`}>{MAIN_COLORS.map(c => <option key={c} value={c} />)}</datalist><input aria-label="备注" className="input-qn h-9 w-40 text-sm" placeholder="备注(可选)" value={note} onChange={e => setNote(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && color) { addVal(name, note ? `${color}(${note})` : color); setColor(''); setNote('') } }} /><button aria-label="添加" onClick={() => { if (!color) return toast('请选择主色', 'error'); addVal(name, note ? `${color}(${note})` : color); setColor(''); setNote('') }} className={cls('w-9 h-9 rounded flex items-center justify-center', color ? 'bg-qn-500 text-white' : 'bg-ink-100 text-ink-400')}><Plus className="w-4 h-4" /></button></>
                      : <><input aria-label={name} list={`vals-${name}`} className="input-qn h-9 w-48 text-sm" placeholder={`输入或选择${name}`} value={other[name] ?? ''} onChange={e => setOther({ ...other, [name]: e.target.value })} onKeyDown={e => { if (e.key === 'Enter') { addVal(name, other[name] ?? ''); setOther({ ...other, [name]: '' }) } }} /><datalist id={`vals-${name}`}>{sp.values.map(v => <option key={v} value={v} />)}</datalist><button aria-label="添加" onClick={() => { addVal(name, other[name] ?? ''); setOther({ ...other, [name]: '' }) }} className={cls('w-9 h-9 rounded flex items-center justify-center', (other[name] ?? '').trim() ? 'bg-qn-500 text-white' : 'bg-ink-100 text-ink-400')}><Plus className="w-4 h-4" /></button><div className="flex gap-1 flex-wrap">{sp.values.slice(0, 8).map(v => <button key={v} onClick={() => addVal(name, v)} className="px-2 h-7 rounded border border-ink-200 text-xs text-ink-700 bg-white hover:border-qn-400">{v}</button>)}</div></>}
                  </div>
                  <div className="mt-3 flex gap-2 flex-wrap">{(vals[name] ?? []).map(v => <span key={v} className="inline-flex items-center gap-1.5 pl-1.5 pr-2 h-9 rounded-lg bg-white border border-ink-200 text-sm">{withImg && idx === 0 && (images[v] ? <img src={images[v]} alt="" className="w-6 h-6 rounded object-cover" /> : <button onClick={() => onPickImage(v)} className="w-6 h-6 rounded border border-dashed border-ink-300 text-ink-400 flex items-center justify-center"><ImageIcon className="w-3 h-3" /></button>)}{v}<button aria-label="删除" onClick={() => setVals(x => ({ ...x, [name]: x[name].filter(y => y !== v) }))}><X className="w-3.5 h-3.5 text-ink-400" /></button></span>)}</div>
                </div>
              )
            })}
          </div>
        </div>
        <div className="h-16 px-6 flex items-center justify-end gap-3 border-t border-ink-100 text-sm"><span className="mr-auto text-xs text-ink-500">将生成 {total} 个 SKU</span><button onClick={reset} className="text-qn-600">重置</button><button onClick={confirm} className="btn-qn h-9 px-4 rounded-full">确认创建</button><button onClick={onClose} className="btn h-9 px-4 rounded-full bg-ink-100 text-ink-700">取消</button></div>
      </div>
    </div>
  )
}

// ---------- 宝贝详情编辑器 + 手机预览 ----------
function DetailEditor({ blocks, onChange, onUpload, onSpace, uploading, product, onPreview, shopName }: { blocks: DetailBlock[]; onChange: (b: DetailBlock[]) => void; onUpload: () => void; onSpace: () => void; uploading: boolean; product: Product; onPreview: () => void; shopName: string }) {
  const [tab, setTab] = useState<'宝贝' | '评价' | '详情' | '推荐'>('详情')
  const [src, setSrc] = useState(false)
  const [srcText, setSrcText] = useState('')
  const move = (i: number, d: -1 | 1) => { const b = [...blocks]; const j = i + d; if (j < 0 || j >= b.length) return; [b[i], b[j]] = [b[j], b[i]]; onChange(b) }
  const addText = () => onChange([...blocks, { id: genId('blk'), type: 'text', value: '' }])
  const smart = () => { const leaf = product.pub?.catPath.slice(-1)[0] ?? '商品'; onChange([...blocks, { id: genId('blk'), type: 'text', value: `【${product.title || leaf}】\n${shopName} 出品，品质保障。\n${Object.entries(product.pub?.props ?? {}).filter(([, v]) => v).map(([k, v]) => `${k}：${v}`).join('　')}\n支持 ${product.pub?.sevenDays ? '7 天无理由退换，' : ''}${product.pub?.shipTime === '24h' ? '24 小时' : '48 小时'}内发货。` }, ...product.images.filter(u => !blocks.some(b => b.value === u)).map(u => ({ id: genId('blk'), type: 'image' as const, value: u }))]); toast('智能详情已生成：根据标题、属性与主图自动排版') }
  const importSrc = () => { const imgs = [...srcText.matchAll(/<img[^>]+src="([^"]+)"/g)].map(m => ({ id: genId('blk'), type: 'image' as const, value: m[1] })); const text = srcText.replace(/<img[^>]*>/g, '').replace(/<[^>]+>/g, '\n').replace(/\n{2,}/g, '\n').trim(); onChange([...blocks, ...(text ? [{ id: genId('blk'), type: 'text' as const, value: text }] : []), ...imgs]); setSrc(false); setSrcText(''); toast(`已导入 ${imgs.length} 张图片${text ? '和文字' : ''}`) }
  return (
    <div className="rounded-xl border border-ink-200 bg-[#f7f8fa] p-3">
      <div className="flex items-center justify-between text-xs text-ink-500 px-1"><span>拖动模块可以调整顺序，可将现有模块存为模板下次快速使用</span><div className="flex items-center gap-3"><button onClick={() => toast('已保存为详情模板「默认模板」（演示）')} className="flex items-center gap-1 hover:text-qn-600"><Save className="w-3.5 h-3.5" />保存为模板</button><button onClick={onPreview} className="flex items-center gap-1 hover:text-qn-600"><Eye className="w-3.5 h-3.5" />预览</button></div></div>
      <div className="mt-3 grid grid-cols-1 lg:grid-cols-[100px_1fr_260px] gap-3">
        <div className="rounded-lg bg-white p-2"><div className="flex items-center justify-between text-xs text-ink-700 px-1 mb-1"><span>添加</span><Settings2 className="w-3.5 h-3.5 text-ink-400" /></div>
          <div className="grid grid-cols-3 lg:grid-cols-1 gap-1.5">{[['图片', onUpload], ['文字', addText], ['源码导入', () => setSrc(true)], ['模板', () => toast('暂无详情模板，可先「保存为模板」', 'info')], ['高级编辑', () => toast('高级编辑器（演示）', 'info')], ['智能详情', smart]].map(([l, fn], i) => <button key={l as string} onClick={fn as () => void} className="relative h-8 rounded border border-ink-200 text-xs text-ink-800 bg-white hover:border-qn-400">{l as string}{i === 5 && <span className="absolute -top-1.5 -right-1 tag bg-brand-500 text-white h-3.5 text-[9px]">new</span>}</button>)}</div>
          <button onClick={onSpace} className="mt-2 w-full h-7 rounded text-[11px] text-qn-600 bg-qn-50">图片空间</button>
        </div>
        <div className="rounded-lg bg-white p-3 min-h-[320px] space-y-2">
          {uploading && <div className="flex items-center gap-2 text-xs text-ink-500"><Loader2 className="w-4 h-4 animate-spin text-qn-500" />图片上传中…</div>}
          {!blocks.length && !uploading && <div className="h-full min-h-[280px] flex flex-col items-center justify-center text-ink-400 text-xs gap-2"><ImageIcon className="w-8 h-8" />点击左侧「图片」「文字」添加详情模块，或使用「智能详情」一键生成</div>}
          {blocks.map((b, i) => (
            <div key={b.id} className="group relative rounded-lg border border-ink-100 hover:border-qn-300 p-2">
              {b.type === 'image' ? <img src={b.value} alt="" className="max-w-full max-h-72 mx-auto rounded" /> : <textarea aria-label="文字" className="input-qn text-sm py-2 min-h-[72px]" placeholder="输入文字" value={b.value} onChange={e => onChange(blocks.map(x => x.id === b.id ? { ...x, value: e.target.value } : x))} />}
              <div className="absolute top-2 right-2 hidden group-hover:flex gap-1"><button aria-label="上移" onClick={() => move(i, -1)} className="w-7 h-7 rounded bg-white shadow border border-ink-200 flex items-center justify-center"><ChevronUp className="w-3.5 h-3.5" /></button><button aria-label="下移" onClick={() => move(i, 1)} className="w-7 h-7 rounded bg-white shadow border border-ink-200 flex items-center justify-center"><ChevronDown className="w-3.5 h-3.5" /></button><button aria-label="删除" onClick={() => onChange(blocks.filter(x => x.id !== b.id))} className="w-7 h-7 rounded bg-white shadow border border-ink-200 flex items-center justify-center text-red-500"><Trash2 className="w-3.5 h-3.5" /></button></div>
              <div className="absolute left-2 top-2 tag bg-ink-900/60 text-white hidden group-hover:inline-flex">{b.type === 'image' ? '图片' : '文字'} · {i + 1}</div>
            </div>
          ))}
        </div>
        <div className="hidden lg:block"><Phone product={product} blocks={blocks} shopName={shopName} tab={tab} onTab={setTab} /></div>
      </div>
      <Modal open={src} onClose={() => setSrc(false)} title="源码导入" width={640} footer={<><button className="btn-outline" onClick={() => setSrc(false)}>取消</button><button className="btn-qn" onClick={importSrc}>导入</button></>}><div className="text-xs text-ink-500 mb-2">粘贴 HTML 源码，系统将自动提取图片与文字模块</div><textarea aria-label="源码" className="input-qn font-mono text-xs h-64 py-2" value={srcText} onChange={e => setSrcText(e.target.value)} placeholder={'<p>商品介绍</p>\n<img src="https://..." />'} /></Modal>
    </div>
  )
}

function Phone({ product, blocks, shopName, tab, onTab }: { product: Product; blocks: DetailBlock[]; shopName: string; tab: '宝贝' | '评价' | '详情' | '推荐'; onTab?: (t: '宝贝' | '评价' | '详情' | '推荐') => void }) {
  return (
    <div className="mx-auto w-[260px] rounded-[26px] bg-ink-900 p-2 shadow-pop"><div className="rounded-[20px] bg-white overflow-hidden h-[460px] flex flex-col">
      <div className="h-9 flex items-center justify-around text-xs border-b border-ink-100">{(['宝贝', '评价', '详情', '推荐'] as const).map(t => <button key={t} onClick={() => onTab?.(t)} className={cls('h-full px-1 border-b-2', tab === t ? 'border-qn-500 text-qn-600' : 'border-transparent text-ink-600')}>{t}</button>)}</div>
      <div className="flex-1 overflow-auto">
        {tab === '宝贝' && <div>{product.images[0] ? <img src={product.images[0]} alt="" className="w-full aspect-square object-cover" /> : <div className="w-full aspect-square bg-ink-100 flex items-center justify-center text-ink-400 text-xs">暂无主图</div>}<div className="p-2"><div className="text-brand-500 font-semibold">¥{money(product.price || 0)}</div><div className="text-xs text-ink-900 line-clamp-2 mt-1">{product.title || '宝贝标题'}</div><div className="text-[10px] text-ink-400 mt-1">{shopName}</div></div></div>}
        {tab === '评价' && <div className="p-3 text-xs text-ink-400 text-center pt-10">宝贝发布后，买家评价将在此展示</div>}
        {tab === '详情' && <div className="text-xs">{blocks.length ? blocks.map(b => b.type === 'image' ? <img key={b.id} src={b.value} alt="" className="w-full" /> : <p key={b.id} className="px-3 py-2 whitespace-pre-wrap text-ink-800 leading-5">{b.value}</p>) : product.images.length ? product.images.map(u => <img key={u} src={u} alt="" className="w-full" />) : <div className="p-3 text-ink-400 text-center pt-10 flex flex-col items-center gap-2"><Smartphone className="w-6 h-6" />添加图片/文字后在此预览</div>}</div>}
        {tab === '推荐' && <div className="p-2 grid grid-cols-2 gap-2">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="rounded-lg bg-ink-50 aspect-[3/4]" />)}</div>}
      </div>
    </div></div>
  )
}

function ShopCatSelect({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="relative w-full max-w-[300px]">
      <button onClick={() => setOpen(o => !o)} className={cls('input-qn h-9 text-left text-sm flex items-center justify-between', !value.length && 'text-ink-400')}><span className="truncate">{value.length ? value.join('、') : '选择分类'}</span><ChevronDown className="w-3.5 h-3.5 text-ink-400 shrink-0" /></button>
      {open && <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-ink-200 rounded-lg shadow-float z-20 p-2 max-h-60 overflow-auto text-sm">{SHOP_CATS_DEFAULT.map(c => <label key={c} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-ink-50"><input type="checkbox" className="accent-qn-500" checked={value.includes(c)} onChange={e => onChange(e.target.checked ? (value.length < 20 ? [...value, c] : value) : value.filter(x => x !== c))} />{c}</label>)}</div>}
    </div>
  )
}

