// 复刻 item.upload.taobao.com/sell/ai/category.htm —— 发布第一步：搜索发品 / 以图发品 / 选择类目
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Camera, ChevronLeft, ChevronRight, ChevronDown, CircleHelp, Info, Menu, Search, X, ScanSearch, TriangleAlert, ImagePlus, Loader2 } from 'lucide-react'
import { useDB } from '@/store/db'
import { useCurrentShop } from '@/lib/hooks'
import { cls } from '@/lib/format'
import { toast } from '@/store/session'
import { PUB_GROUPS, PUB_FIRST, pubNode, pubFindByName, pubPath, isLeaf, searchPubCats, pubTemplate, pubToBuyerCategory, type PubNode, type PubHit } from '@/data/pubcats'
import { AiBubble, ImageSpace, PubShell, setPrefill } from './common'
import { pickFiles, compressImage } from '@/lib/upload'
import { Img } from '@/components/ui'

const CASE = [['商品正面图', 'front'], ['模特上身图', 'model'], ['商品背面图', 'back'], ['尺码表', 'size'], ['商品吊牌', 'tag']] as const

export default function PublishCategory() {
  const nav = useNavigate()
  const [sp] = useSearchParams()
  const editId = sp.get('id') ?? ''
  const shop = useCurrentShop()
  const products = useDB(s => s.products)
  const [mode, setMode] = useState<'search' | 'image'>('search')
  const [q, setQ] = useState('')
  const [hits, setHits] = useState<PubHit[] | null>(null)
  const [resTab, setResTab] = useState<'all' | 'cat' | 'spu'>('all')
  const [cascade, setCascade] = useState(true)
  const [sel, setSel] = useState<string[]>([]) // 各级选中的 id
  const [brand, setBrand] = useState('')
  const [brandQ, setBrandQ] = useState('')
  const [brandOpen, setBrandOpen] = useState(false)
  const [filters, setFilters] = useState(['', '', ''])
  const [spuTab, setSpuTab] = useState('')
  const [spuBrand, setSpuBrand] = useState('')
  const [spuPick, setSpuPick] = useState<string | null>(null)
  const histRef = useRef<HTMLDivElement>(null)

  const leafId = sel.length ? sel[sel.length - 1] : ''
  const leaf = pubNode(leafId)
  const leafOk = isLeaf(leaf)
  const path = pubPath(leafId)
  const tpl = pubTemplate(leafId)
  const brands = useMemo(() => { const l = tpl.brands.filter(b => !brandQ || b.toLowerCase().includes(brandQ.toLowerCase())); return l }, [tpl, brandQ])
  const history = useMemo(() => {
    const ids = products.filter(p => p.shopId === shop.id && p.pub?.catId).map(p => p.pub!.catId)
    const uniq = ids.filter((v, i, a) => a.indexOf(v) === i)
    // 与真实页面「发布历史」一致的兜底项
    const fallback = ['收钱码/收款码/收款牌', 'STEAM', '其它网络相关', 'CPU', '网卡', '娱乐办公显示器/随心屏/移动屏', '数码收纳整理包', '麦克风/话筒', '棉衣/棉服', 'VR设备', '有线鼠标', '键盘'].map(n => pubFindByName(n)?.id).filter(Boolean) as string[]
    return [...uniq, ...fallback.filter(f => !uniq.includes(f))].map(id => pubNode(id)).filter(Boolean).slice(0, 14) as PubNode[]
  }, [products, shop.id])
  const columns = useMemo(() => {
    const cols: PubNode[][] = [PUB_FIRST]
    sel.forEach(id => { const n = pubNode(id); if (n?.children?.length) cols.push(n.children) })
    return cols.slice(0, 3)
  }, [sel])
  const pick = (depth: number, id: string) => { setSel([...sel.slice(0, depth), id]); setBrand(''); setCascade(true) }
  const choosePath = (h: PubHit) => { setSel(h.path.map(p => p.id)); setBrand(''); setCascade(true); setHits(null); setTimeout(() => document.getElementById('cascade')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50) }
  const search = () => {
    const kw = q.trim()
    if (!kw) return toast('请输入产品名称、类目关键词或条码信息', 'error')
    const r = searchPubCats(kw)
    setHits(r); setResTab('all'); setCascade(false); setSpuTab(''); setSpuBrand('')
    if (!r.length) toast('未匹配到类目，可通过「选择类目」手动选择', 'info')
  }
  // 标准产品：平台上已有的同款商品（标题命中关键词，或属于匹配类目对应的买家分类）
  const spus = useMemo(() => { const kw = q.trim(); if (!kw || !hits) return []; const cats = new Set(hits.filter(h => !h.tmall).map(h => pubToBuyerCategory(h.leaf.id))); return products.filter(p => p.status === 'on' && (p.title.includes(kw) || cats.has(p.categoryId))).sort((x, y) => Number(y.title.includes(kw)) - Number(x.title.includes(kw)) || y.sales - x.sales).slice(0, 40) }, [q, hits, products])
  const spuLeaves = useMemo(() => hits?.filter(h => !h.tmall).slice(0, 4).map(h => h.leaf.name) ?? [], [hits])
  const spuBrands = useMemo(() => { const b = spus.map(p => p.pub?.brand || p.tags[0] || '悦智人心').filter((v, i, a) => a.indexOf(v) === i); return b.slice(0, 16) }, [spus])
  const spuList = spus.filter(p => !spuBrand || (p.pub?.brand || p.tags[0] || '悦智人心') === spuBrand)
  const useSpu = (pid: string) => {
    const p = products.find(x => x.id === pid)!
    const h = hits?.find(x => !x.tmall)
    const catId = p.pub?.catId ?? h?.leaf.id
    if (!catId) return
    setPrefill({ title: p.title, images: p.images.slice(0, 5), brand: p.pub?.brand, price: p.price, subtitle: p.subtitle })
    nav(`/seller/publish?catId=${catId}&brand=${encodeURIComponent(p.pub?.brand ?? '')}${editId ? `&id=${editId}` : ''}`)
  }
  const confirm = () => {
    if (!leafOk) return toast('请选择到最末级类目', 'error')
    if (!brand) return toast('请选择品牌', 'error')
    if (path.some(p => p.tmall)) return toast('该类目为天猫专用，当前店铺无发布权限', 'error')
    nav(`/seller/publish?catId=${leafId}&brand=${encodeURIComponent(brand)}${editId ? `&id=${editId}` : ''}`)
  }
  useEffect(() => { if (!brandOpen) setBrandQ('') }, [brandOpen])

  // ---------- 以图发品 ----------
  const [imgs, setImgs] = useState<string[]>([])
  const [space, setSpace] = useState(false)
  const [recog, setRecog] = useState<null | 'loading' | { catId: string; title: string; brand: string }>(null)
  const recognize = (list: string[], names: string[]) => {
    setRecog('loading')
    setTimeout(() => {
      const kw = names.join(' ')
      let hit = PUB_FIRST.flatMap(f => f.children ?? []).find(n => n.name.length > 1 && kw.includes(n.name.slice(0, 2)))
      if (!hit) { const sum = list[0].length % 7; const pool = PUB_FIRST.filter(f => f.group === '服装鞋包'); const f = pool[sum % pool.length]; hit = f.children![sum % f.children!.length] }
      const t = pubTemplate(hit.id)
      setRecog({ catId: hit.id, title: `${t.brands[1] ?? ''} ${hit.name} 2026新款 ${pubPath(hit.id)[0]?.name.split('/')[0] ?? ''}`.trim(), brand: t.brands[1] ?? '无品牌/无注册商标' })
    }, 1600)
  }
  const addLocal = async () => {
    const files = await pickFiles('image/*', true)
    if (!files.length) return
    const list: string[] = []
    for (const f of files.slice(0, 20 - imgs.length)) list.push(await compressImage(f, 1000))
    const all = [...imgs, ...list]; setImgs(all)
    recognize(all, files.map(f => f.name))
  }
  const confirmImage = () => {
    if (!recog || recog === 'loading') return
    setPrefill({ title: recog.title, images: imgs.slice(0, 5), brand: recog.brand })
    nav(`/seller/publish?catId=${recog.catId}&brand=${encodeURIComponent(recog.brand)}${editId ? `&id=${editId}` : ''}`)
  }

  return (
    <PubShell className="pb-24">
      <div className="max-w-[1100px] mx-auto px-3 md:px-4 pt-5">
        <div className="rounded-lg bg-[#eef3fe] px-4 py-2.5 text-xs text-ink-700 flex items-center gap-2"><Info className="w-3.5 h-3.5 text-qn-500" />亲，欢迎使用新版商品发布，<a href="#" onClick={e => { e.preventDefault(); toast('使用教程：搜索发品 → 选择类目/品牌 → 填写发布表单（演示）', 'info') }} className="text-qn-600">点击查看使用教程</a></div>

        {/* 搜索发品 / 以图发品 大卡片 */}
        <div className="mt-4 rounded-2xl bg-white shadow-card overflow-hidden">
          <div className={cls('grid', mode === 'search' ? 'grid-cols-[1fr_180px]' : 'grid-cols-[180px_1fr]')}>
            {mode === 'search' ? <>
              <div className="h-14 flex items-center justify-center text-lg font-semibold text-ink-900 border-b-2 border-qn-500 rounded-t-2xl border-x-2 border-t-2">搜索发品</div>
              <button onClick={() => setMode('image')} className="h-14 flex items-center justify-center gap-1 bg-ink-100/70 text-ink-800 text-lg hover:bg-ink-100"><ScanSearch className="w-4 h-4" />以图发品</button>
            </> : <>
              <button onClick={() => setMode('search')} className="h-14 flex items-center justify-center gap-1 bg-ink-100/70 text-ink-800 text-lg hover:bg-ink-100"><Search className="w-4 h-4" />搜索发品</button>
              <div className="h-14 flex items-center justify-center text-lg font-semibold text-ink-900 border-b-2 border-qn-500 rounded-t-2xl border-x-2 border-t-2">以图发品</div>
            </>}
          </div>

          {mode === 'search' && (
            <div className="p-4 md:p-6">
              <div className="flex gap-2">
                <div className="relative flex-1"><input aria-label="搜索发品" className="input-qn h-11 pr-10 text-[15px]" placeholder="可输入产品名称、类目关键词、条码信息" value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => e.key === 'Enter' && search()} /><button aria-label="拍照搜索" onClick={() => setMode('image')} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-600 hover:text-qn-600"><Camera className="w-4.5 h-4.5 w-[18px] h-[18px]" /></button></div>
                <button onClick={search} className="btn-qn h-11 px-6 text-[15px]">搜索</button>
                <button onClick={() => { setCascade(c => !c || !!hits); setHits(null) }} className="btn h-11 px-5 bg-ink-100 text-ink-800 hover:bg-ink-200 text-[15px]"><Menu className="w-4 h-4" />选择类目</button>
              </div>

              {hits && (
                <div className="mt-4">
                  <div className="flex gap-6 border-b border-ink-100 text-sm">{([['all', '全部'], ['cat', '类目'], ['spu', '标准产品']] as const).map(([k, l]) => <button key={k} onClick={() => setResTab(k)} className={cls('pb-2 -mb-px border-b-2', resTab === k ? 'border-qn-500 text-qn-600' : 'border-transparent text-ink-700')}>{l}</button>)}</div>
                  {resTab !== 'spu' && (
                    <div className="mt-3">
                      <div className="flex items-center justify-between"><div className="font-medium text-ink-900">类目</div>{hits.length > 5 && resTab === 'all' && <button onClick={() => setResTab('cat')} className="text-xs text-ink-500 hover:text-qn-600">更多 ›</button>}</div>
                      <div className="mt-2 space-y-1.5 text-sm">
                        {(resTab === 'all' ? hits.slice(0, 5) : hits).map(h => (
                          <button key={h.leaf.id} onClick={() => h.tmall ? toast('该类目为天猫专用，当前店铺无发布权限', 'error') : choosePath(h)} className={cls('flex items-center gap-1 text-left hover:bg-ink-50 rounded px-1 py-0.5', h.tmall ? 'text-ink-400' : 'text-ink-700')}>
                            {h.path.map((p, i) => <span key={p.id} className="flex items-center gap-1">{i > 0 && <span className="text-ink-300">›</span>}<span className={cls(i === h.path.length - 1 && 'text-qn-600')}>{p.name}</span></span>)}
                            {h.tmall ? <TriangleAlert className="w-3.5 h-3.5 text-amber-500 ml-1" /> : <CircleHelp className="w-3.5 h-3.5 text-ink-300 ml-1" />}
                          </button>
                        ))}
                        {!hits.length && <div className="text-ink-400 text-xs py-4">未匹配到类目，请尝试其他关键词或手动选择类目</div>}
                      </div>
                    </div>
                  )}
                  {resTab !== 'cat' && (
                    <div className="mt-5">
                      <div className="flex items-center justify-between"><div className="font-medium text-ink-900">标准产品</div>{resTab === 'all' && spus.length > 8 && <button onClick={() => setResTab('spu')} className="text-xs text-ink-500 hover:text-qn-600">更多 ›</button>}</div>
                      <div className="mt-2 flex gap-1 border-b border-ink-100">{(spuLeaves.length ? spuLeaves : [q]).map((t, i) => <button key={t} onClick={() => setSpuTab(t)} className={cls('px-4 h-9 text-sm rounded-t-lg border border-b-0', (spuTab || spuLeaves[0] || q) === t ? 'bg-white border-ink-200 text-qn-600 -mb-px' : 'bg-ink-50 border-transparent text-ink-600')}>{t}{i === 0 && ''}</button>)}</div>
                      <div className="mt-3 flex items-center gap-2 text-sm"><span className="text-ink-500 shrink-0">品牌</span><div className="flex gap-2 overflow-x-auto no-scrollbar">{spuBrands.map(b => <button key={b} onClick={() => setSpuBrand(spuBrand === b ? '' : b)} className={cls('px-3 h-7 rounded-md border text-xs whitespace-nowrap', spuBrand === b ? 'border-qn-500 text-qn-600 bg-qn-50' : 'border-transparent bg-ink-100 text-ink-700')}>{b}</button>)}</div><span className="text-ink-300 shrink-0"><ChevronLeft className="w-3.5 h-3.5 inline" /><ChevronRight className="w-3.5 h-3.5 inline" /></span></div>
                      <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
                        {(resTab === 'all' ? spuList.slice(0, 12) : spuList).map(p => (
                          <button key={p.id} onClick={() => setSpuPick(p.id)} className={cls('text-left rounded-xl border p-2 hover:shadow-card transition', spuPick === p.id ? 'border-qn-500 ring-2 ring-qn-100' : 'border-ink-200')}>
                            <Img src={p.images[0]} alt="" w={200} h={200} className="w-full aspect-square rounded-lg" />
                            <div className="text-xs text-ink-800 line-clamp-2 mt-2 h-8">{(p.pub?.brand || p.tags[0] || '悦智人心')} {p.title}</div>
                            <div className="text-[11px] text-ink-400 mt-1">已有 {Math.max(1, Math.round(p.sales / 7))} 个商家发布</div>
                          </button>
                        ))}
                        {!spuList.length && <div className="col-span-full text-ink-400 text-xs py-6 text-center">暂无匹配的标准产品，可直接选择类目发布</div>}
                      </div>
                      {spuPick && <div className="mt-3 flex items-center justify-end gap-2 text-sm"><span className="text-ink-500">选择标准产品后，标题、主图、品牌将自动带入</span><button onClick={() => useSpu(spuPick)} className="btn-qn">使用该标准产品发布</button></div>}
                    </div>
                  )}
                </div>
              )}

              {cascade && (
                <div id="cascade" className="mt-4">
                  <div className="flex items-start gap-2 text-xs text-ink-600">
                    <span className="shrink-0 pt-1">发布历史:</span>
                    <div ref={histRef} className="flex gap-x-1 overflow-hidden flex-1 pt-1 whitespace-nowrap">{history.map((h, i) => <span key={h.id} className="flex items-center">{i > 0 && <span className="text-ink-300 mx-1">|</span>}<button onClick={() => setSel(pubPath(h.id).map(p => p.id))} className="hover:text-qn-600">{h.name}</button></span>)}</div>
                    <span className="shrink-0 text-ink-300 pt-1"><ChevronLeft className="w-3.5 h-3.5 inline" /><ChevronRight className="w-3.5 h-3.5 inline" /></span>
                    <button aria-label="关闭" onClick={() => setCascade(false)} className="ml-3 text-ink-500 hover:text-ink-900"><X className="w-4 h-4" /></button>
                  </div>
                  <div className="mt-3 grid grid-cols-1 gap-0 border border-ink-200 rounded-lg overflow-hidden md:h-[460px] md:[grid-template-columns:var(--cols)]" style={{ ['--cols' as string]: `${columns.map(() => columns.length > 2 ? '220px' : '250px').join(' ')} 1fr` }}>
                    {columns.map((col, depth) => (
                      <div key={depth} className="border-b md:border-b-0 md:border-r border-ink-200 overflow-auto p-3 bg-white max-h-[240px] md:max-h-none">
                        <div className="relative mb-2"><input aria-label="筛选类目" className="input-qn h-9 pr-8 text-xs" placeholder="名称/拼音首字母" value={filters[depth]} onChange={e => setFilters(filters.map((f, i) => i === depth ? e.target.value : f))} /><Search className="w-3.5 h-3.5 text-ink-300 absolute right-3 top-1/2 -translate-y-1/2" /></div>
                        {depth === 0 ? PUB_GROUPS.map(g => {
                          const items = g.cats.filter(c => !filters[0] || c.name.includes(filters[0]))
                          if (!items.length) return null
                          return <div key={g.name} className="mb-1"><div className="text-xs text-qn-600 py-1 flex items-center gap-0.5">{g.name}<ChevronDown className="w-3 h-3" /></div>{items.map(c => <CatItem key={c.id} n={c} active={sel[0] === c.id} onClick={() => pick(0, c.id)} />)}</div>
                        }) : col.filter(c => !filters[depth] || c.name.includes(filters[depth])).map(c => <CatItem key={c.id} n={c} active={sel[depth] === c.id} onClick={() => pick(depth, c.id)} />)}
                      </div>
                    ))}
                    {leafOk && (
                      <div className="p-4 bg-white overflow-auto">
                        <div className="flex items-start gap-2 text-xs"><span className="shrink-0 text-ink-800 pt-0.5"><span className="text-red-500">*</span> 品牌</span><div className="text-ink-400 leading-4">正确填写品牌信息有助于提升曝光，请正确填写，若未找到品牌，请<button onClick={() => { const b = prompt('新增品牌（品牌名）'); if (b) setBrand(b) }} className="text-qn-600">[新增品牌]</button>或选择【无品牌/无注册商标】</div></div>
                        <div className="relative mt-3 w-full max-w-[220px]">
                          <button onClick={() => setBrandOpen(o => !o)} className={cls('input-qn h-9 text-left text-sm flex items-center justify-between', !brand && 'text-ink-400')}>{brand || '请选择'}<ChevronDown className={cls('w-3.5 h-3.5 text-ink-400 transition', brandOpen && 'rotate-180')} /></button>
                          {brandOpen && <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-ink-200 rounded-lg shadow-float z-20 p-2"><div className="relative"><input autoFocus aria-label="搜索品牌" className="input-qn h-8 text-xs pr-7" value={brandQ} onChange={e => setBrandQ(e.target.value)} /><Search className="w-3.5 h-3.5 text-ink-300 absolute right-2.5 top-1/2 -translate-y-1/2" /></div><div className="max-h-56 overflow-auto mt-1 text-sm">{brands.map(b => <button key={b} onClick={() => { setBrand(b); setBrandOpen(false) }} className={cls('block w-full text-left px-2 py-1.5 rounded hover:bg-ink-50', brand === b && 'text-qn-600 bg-qn-50')}>{b}</button>)}{!brands.length && <div className="text-xs text-ink-400 px-2 py-3">无匹配品牌，可点击上方 [新增品牌]</div>}</div></div>}
                        </div>
                        {leaf?.tmall && <div className="mt-3 text-xs text-amber-700 flex items-center gap-1"><TriangleAlert className="w-3.5 h-3.5" />该类目为天猫专用，当前店铺无发布权限</div>}
                      </div>
                    )}
                    {!leafOk && <div className="hidden md:block bg-white" />}
                  </div>
                </div>
              )}
            </div>
          )}

          {mode === 'image' && (
            <div className="p-4 md:p-6">
              <div className="text-sm"><span className="font-medium text-ink-900">图片上传</span><span className="text-xs text-ink-500 ml-2">传入商品主图、包装图、营销成分表、条形码图，可智能识别生成标题、属性信息。</span></div>
              <div className="mt-3 rounded-xl border border-ink-200 p-6 flex flex-col items-center gap-3">
                {imgs.length > 0 && <div className="flex gap-2 flex-wrap justify-center">{imgs.map((u, i) => <div key={i} className="relative w-20 h-20 rounded-lg overflow-hidden group"><img src={u} alt="" className="w-full h-full object-cover" /><button aria-label="删除" onClick={() => setImgs(imgs.filter((_, j) => j !== i))} className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-black/60 text-white hidden group-hover:flex items-center justify-center"><X className="w-3 h-3" /></button></div>)}</div>}
                {!imgs.length && <ImagePlus className="w-8 h-8 text-ink-400" />}
                <div className="text-xs text-ink-400">推荐上传商品展示图片、模特上身图、尺码图、材质细节图、商品吊牌、条形码。最多20张</div>
                <div className="flex gap-2"><button onClick={addLocal} className="btn-qn h-9 px-5">从本地上传</button><button onClick={() => setSpace(true)} className="btn-outline h-9 px-5 border-qn-500 text-qn-600">从图片空间上传</button></div>
              </div>
              {recog && (
                <div className="mt-4 rounded-xl bg-gradient-to-r from-qn-50 to-indigo-50 border border-qn-100 p-4 text-sm">
                  {recog === 'loading' ? <div className="flex items-center gap-2 text-ink-700"><Loader2 className="w-4 h-4 animate-spin text-qn-500" />AI 正在识别商品类目与属性…</div> : <>
                    <div className="grid sm:grid-cols-[auto_1fr] gap-x-6 gap-y-2">
                      <span className="text-ink-500">识别类目</span><span className="text-ink-900">{pubPath(recog.catId).map(p => p.name).join(' > ')}</span>
                      <span className="text-ink-500">识别标题</span><span className="text-ink-900">{recog.title}</span>
                      <span className="text-ink-500">识别品牌</span><span className="text-ink-900">{recog.brand}</span>
                    </div>
                    <div className="text-xs text-ink-500 mt-3">识别结果仅供参考，可在下一步修改类目与属性。</div>
                  </>}
                </div>
              )}
              <div className="mt-6 text-sm font-medium text-ink-900">优质案例</div>
              <div className="mt-2 flex gap-3 flex-wrap">{CASE.map(([l, k]) => <div key={k} className="w-24 text-center"><div className="w-24 h-24 rounded-lg overflow-hidden bg-ink-100"><img src={`https://picsum.photos/seed/case-${k}/200/200`} alt="" loading="lazy" className="w-full h-full object-cover" /></div><div className="text-xs text-ink-600 mt-1">{l}</div></div>)}</div>
              <ImageSpace open={space} onClose={() => setSpace(false)} max={20} onPick={u => { const all = [...imgs, ...u].slice(0, 20); setImgs(all); recognize(all, []) }} />
            </div>
          )}
        </div>
      </div>

      {/* 底部栏 */}
      <div className="fixed bottom-0 left-0 right-0 h-14 bg-white border-t border-ink-200 z-30">
        <div className="max-w-[1100px] mx-auto px-4 h-full flex items-center justify-between text-sm">
          <div className="flex items-center gap-1 text-ink-700 min-w-0">{mode === 'search' ? <>类目: <span className="text-ink-900 truncate">{path.length ? path.map(p => p.name).join(' > ') : '请选择类目'}</span>{leafOk && <CircleHelp className="w-3.5 h-3.5 text-ink-300" />}</> : <>以图发品：{imgs.length ? `已上传 ${imgs.length} 张图片` : '请上传商品图片'}</>}</div>
          {mode === 'search' ? <button onClick={confirm} disabled={!leafOk || !brand} className={cls('btn h-9 px-5', leafOk && brand ? 'btn-qn' : 'bg-ink-100 text-ink-400 cursor-not-allowed')}>确认，下一步</button> : <button onClick={confirmImage} disabled={!recog || recog === 'loading'} className={cls('btn h-9 px-5', recog && recog !== 'loading' ? 'btn-qn' : 'bg-ink-100 text-ink-400 cursor-not-allowed')}>确认，下一步</button>}
        </div>
      </div>
      <AiBubble />
    </PubShell>
  )
}

function CatItem({ n, active, onClick }: { n: PubNode; active: boolean; onClick: () => void }) {
  const [hover, setHover] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => { if (active) ref.current?.scrollIntoView({ block: 'nearest' }) }, [active])
  return (
    <div ref={ref} className="relative" onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
      <button onClick={onClick} className={cls('w-full text-left px-2 py-1.5 rounded text-[13px] flex items-center justify-between', active ? 'bg-ink-100 text-ink-900 border-l-2 border-qn-500 pl-1.5' : 'text-ink-800 hover:bg-ink-50')}>{n.name}{n.children?.length ? <ChevronRight className="w-3.5 h-3.5 text-ink-400" /> : null}</button>
      {hover && n.tip && <div className="absolute left-0 top-full mt-1 z-20 bg-white shadow-float border border-ink-100 rounded-lg px-3 py-2 text-xs text-ink-700 whitespace-nowrap">{n.tip}</div>}
    </div>
  )
}
