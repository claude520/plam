// 搜索引擎：中文分词（词典正向最大匹配 + 二元切分兜底）、同义词扩展、拼写纠错、
// 字段加权 BM25 相关性、类目预测、综合排序（相关性 × 商品质量 × 个性化）、搜索联想
import type { Category, Product, Shop } from '@/data/types'

/** 同义词组：组内任一词命中即视为同一意图（第一个为规范词） */
export const SYNONYMS: string[][] = [
  ['手机', '智能手机', '旗舰手机', 'phone'], ['华为', 'huawei'], ['苹果', 'apple'], ['iphone', '苹果手机'], ['小米', 'xiaomi'], ['平板', 'ipad', '平板电脑'],
  ['笔记本', '笔记本电脑', 'macbook', 'laptop'], ['耳机', '蓝牙耳机', '降噪耳机', 'buds', '耳麦'], ['手表', '智能手表', 'watch', '手环'], ['显卡', 'rtx', 'gpu'],
  ['键盘', '机械键盘'], ['音箱', '音响', '智能音箱'], ['外套', '大衣', '夹克'], ['毛衣', '针织衫', '羊毛衫'], ['连衣裙', '裙子', '长裙', '半身裙'], ['婚纱', '礼服', '拖尾'],
  ['t恤', 't血', '短袖'], ['保暖', '加绒', '保温'], ['帐篷', '天幕', '露营'], ['背包', '双肩包', '登山包'], ['零食', '小吃', '休闲食品'], ['坚果', '每日坚果', '果仁'],
  ['床', '双人床', '床架'], ['桌', '书桌', '餐桌', '办公桌'], ['沙发', '布艺沙发'], ['护肤', '保湿', '补水'], ['精华', '精华液', '小棕瓶', '小黑瓶'], ['面霜', '乳霜', '眼霜'],
  ['爽肤水', '化妆水', '神仙水', '水乳'], ['手链', '手镯', '手串'], ['戒指', '对戒', '钻戒'], ['项链', '吊坠'], ['玩具', '积木', '拼装'], ['盲盒', '手办', '谷子', '吧唧'],
  ['翻译', 'deepl', 'translate'], ['贴纸', '手账', '胶带'], ['本子', '笔记本子', '记事本', '笔记本本'], ['会员', 'pro会员', 'vip'], ['便宜', '平价', '特价', '低价'],
]
/** 常见品牌（用于分词与品牌识别） */
const BRANDS = ['华为', '苹果', '小米', '优衣库', '三只松鼠', '源氏木语', '雅诗兰黛', '兰蔻', 'SK-II', '欧莱雅', '乐高', '泡泡玛特', '探路者', '小鹰', 'Osprey', '华硕', 'ROG', '罗技', '雷蛇', '耐克', '阿迪达斯', '李宁', '安踏']

const SYN_MAP = new Map<string, string[]>()
for (const g of SYNONYMS) for (const w of g) SYN_MAP.set(w.toLowerCase(), g.map(x => x.toLowerCase()))

const CJK = /[㐀-鿿]/
/** 全角转半角、小写、去多余空白 */
export function normalize(s: string): string {
  return s.replace(/[！-～]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xfee0)).replace(/　/g, ' ').toLowerCase().replace(/\s+/g, ' ').trim()
}

// ---------- 索引 ----------
interface Doc { p: Product; fields: [string, number][]; text: string; len: number }
export interface SearchIndex { docs: Doc[]; dict: Set<string>; maxLen: number; df: Map<string, number>; avgLen: number; vocab: Map<string, number>; catName: Map<string, string> }

const cache = new WeakMap<Product[], SearchIndex>()

/** 构建索引：字段权重 标题 3 / 标签 2 / 类目 2 / 品牌属性 1.5 / 店铺 1 */
export function buildIndex(products: Product[], categories: Category[], shops: Shop[]): SearchIndex {
  const hit = cache.get(products)
  if (hit) return hit
  const catName = new Map(categories.map(c => [c.id, c.name]))
  const shopName = new Map(shops.map(s => [s.id, s.name]))
  const docs: Doc[] = products.map(p => {
    const top = p.categoryId.split('-')[0]
    const fields: [string, number][] = [
      [normalize(p.title + ' ' + (p.subtitle ?? '')), 3], [normalize(p.tags.join(' ')), 2],
      [normalize(`${catName.get(top) ?? ''} ${catName.get(p.categoryId) ?? ''} ${p.pub?.catPath.join(' ') ?? ''}`), 2],
      [normalize(`${p.pub?.brand ?? ''} ${p.attrs.map(a => a.name + ' ' + a.values.join(' ')).join(' ')}`), 1.5], [normalize(shopName.get(p.shopId) ?? ''), 1],
    ]
    const text = fields.map(f => f[0]).join(' | ')
    return { p, fields, text, len: fields.reduce((a, [t, w]) => a + t.length * w, 0) / 3 }
  })
  // 词典：类目名、品牌、同义词、标签，以及在 ≥2 个标题中出现的 2~4 字片段（新词发现）
  const dict = new Set<string>()
  categories.forEach(c => dict.add(normalize(c.name)))
  BRANDS.forEach(b => dict.add(normalize(b)))
  SYNONYMS.flat().forEach(w => dict.add(w.toLowerCase()))
  const gram = new Map<string, Set<string>>()
  for (const d of docs) {
    for (const t of d.p.tags) dict.add(normalize(t))
    for (const run of d.fields[0][0].match(/[㐀-鿿]+/g) ?? []) for (let n = 2; n <= 4; n++) for (let i = 0; i + n <= run.length; i++) { const g = run.slice(i, i + n); if (!gram.has(g)) gram.set(g, new Set()); gram.get(g)!.add(d.p.id) }
    for (const w of d.fields[0][0].match(/[a-z0-9][a-z0-9+\-.]*/g) ?? []) if (w.length >= 2) dict.add(w)
  }
  for (const [g, ids] of gram) if (ids.size >= 2) dict.add(g)
  const vocab = new Map<string, number>()
  for (const w of dict) vocab.set(w, docs.filter(d => d.text.includes(w)).length)
  const idx: SearchIndex = { docs, dict, maxLen: Math.max(...[...dict].map(w => w.length), 2), df: new Map(), avgLen: docs.reduce((a, d) => a + d.len, 0) / Math.max(1, docs.length), vocab, catName }
  cache.set(products, idx)
  return idx
}

// ---------- 分词 ----------
/** 正向最大匹配分词；词典外的连续汉字按二元切分 */
export function tokenize(q: string, idx: SearchIndex): string[] {
  const out: string[] = []
  for (const part of normalize(q).split(/[\s,，、;；/|]+/).filter(Boolean)) {
    for (const seg of part.match(/[㐀-鿿]+|[a-z0-9][a-z0-9+\-.]*/g) ?? []) {
      if (!CJK.test(seg)) { out.push(seg); continue }
      let i = 0, pending = ''
      const flush = () => { if (!pending) return; if (pending.length <= 2) out.push(pending); else for (let k = 0; k + 2 <= pending.length; k++) out.push(pending.slice(k, k + 2)); pending = '' }
      while (i < seg.length) {
        let len = Math.min(idx.maxLen, seg.length - i)
        while (len > 1 && !idx.dict.has(seg.slice(i, i + len))) len--
        if (len > 1) { flush(); out.push(seg.slice(i, i + len)); i += len } else { pending += seg[i]; i++ }
      }
      flush()
    }
  }
  return [...new Set(out)]
}

// ---------- 纠错 ----------
function editDistance(a: string, b: string, cap = 3): number {
  if (Math.abs(a.length - b.length) > cap) return cap + 1
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j)
  for (let i = 1; i <= a.length; i++) {
    const cur = [i]
    let best = i
    for (let j = 1; j <= b.length; j++) { cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); best = Math.min(best, cur[j]) }
    if (best > cap) return cap + 1
    prev = cur
  }
  return prev[b.length]
}

/** 对没有任何商品包含的词，在词典里找编辑距离最近且最常见的词 */
function correctTerm(t: string, idx: SearchIndex): string | null {
  const cap = CJK.test(t) ? 1 : t.length <= 5 ? 1 : 2
  let best: [string, number, number] | null = null
  for (const [w, df] of idx.vocab) {
    if (df === 0 || w === t || Math.abs(w.length - t.length) > cap) continue
    const d = editDistance(t, w, cap)
    if (d <= cap && (!best || d < best[1] || (d === best[1] && df > best[2]))) best = [w, d, df]
  }
  return best?.[0] ?? null
}

// ---------- 查询理解 ----------
export interface Term { word: string; forms: string[]; idf: number }
export interface ParsedQuery { raw: string; terms: Term[]; corrected?: string; predictedCat?: string }

const contains = (d: Doc, f: string) => d.text.includes(f)

export function parseQuery(q: string, idx: SearchIndex, noCorrect = false): ParsedQuery {
  const N = idx.docs.length || 1
  const whole = normalize(q).replace(/\s+/g, '')
  // 整个查询能被直接命中（如「冰糖烤梨」这类长尾词）时作为一个整体词，优先短语匹配
  let words = whole && idx.docs.some(d => contains(d, whole)) && whole.length <= 12 ? [whole] : tokenize(q, idx)
  let corrected: string | undefined
  if (!noCorrect) {
    const fixed = words.map(w => (idx.docs.some(d => contains(d, w)) || SYN_MAP.has(w) ? w : correctTerm(w, idx) ?? w))
    if (fixed.some((w, i) => w !== words[i])) { corrected = fixed.reduce((a, w) => a + (a && !(CJK.test(a.slice(-1)) && CJK.test(w[0])) ? ' ' : '') + w, ''); words = [...new Set(fixed)] }
  }
  const terms = words.map(word => {
    const forms = [...new Set([word, ...(SYN_MAP.get(word) ?? [])])]
    const df = idx.docs.filter(d => forms.some(f => contains(d, f))).length
    return { word, forms, idf: Math.log(1 + (N - df + 0.5) / (df + 0.5)) }
  })
  return { raw: q, terms, corrected }
}

// ---------- 打分 ----------
const K1 = 1.2, B = 0.75
function bm25(d: Doc, t: Term, avgLen: number): number {
  let tf = 0
  for (const [text, w] of d.fields) for (const f of t.forms) {
    if (!f) continue
    let i = text.indexOf(f), n = 0
    while (i >= 0 && n < 5) { n++; i = text.indexOf(f, i + f.length) }
    // 同义词命中打 0.7 折
    tf += n * w * (f === t.word ? 1 : 0.7)
  }
  if (!tf) return 0
  return t.idf * (tf * (K1 + 1)) / (tf + K1 * (1 - B + B * d.len / avgLen))
}

/** 商品质量分 0~1：销量（对数）、评分、收藏率 */
export function quality(p: Product, maxSales: number): number {
  const s = Math.log10(1 + p.sales) / Math.log10(1 + Math.max(1, maxSales))
  const r = Math.max(0, Math.min(1, (p.rating - 4) / 1))
  const fav = Math.min(1, p.favorites / Math.max(1, p.views) * 10)
  return 0.55 * s + 0.3 * r + 0.15 * fav
}

export interface Hit { p: Product; score: number; rel: number; matched: number }
export interface SearchResult { hits: Hit[]; parsed: ParsedQuery; predictedCat?: string }

/**
 * 综合排序 = 0.6×相关性 + 0.25×质量 + 0.15×个性化，类目预测命中再 ×1.15。
 * 词数 ≤2 时要求全部命中，更多词时至少命中 2/3（容错长查询）。
 */
export function search(q: string, idx: SearchIndex, opts: { personal?: (p: Product) => number; noCorrect?: boolean } = {}): SearchResult {
  let parsed = parseQuery(q, idx, opts.noCorrect)
  const run = (pq: ParsedQuery) => {
    const need = pq.terms.length <= 2 ? pq.terms.length : Math.ceil(pq.terms.length * 2 / 3)
    const out: Hit[] = []
    for (const d of idx.docs) {
      let rel = 0, matched = 0
      for (const t of pq.terms) { const s = bm25(d, t, idx.avgLen); if (s > 0) { matched++; rel += s } }
      if (matched >= need && matched > 0) out.push({ p: d.p, score: 0, rel, matched })
    }
    return out
  }
  let hits = run(parsed)
  // 纠错后无结果则退回原词
  if (!hits.length && parsed.corrected) { parsed = parseQuery(q, idx, true); hits = run(parsed) }
  const maxRel = Math.max(1e-9, ...hits.map(h => h.rel))
  const maxSales = Math.max(1, ...hits.map(h => h.p.sales))
  // 类目预测：相关性前 10 的类目加权投票
  const vote = new Map<string, number>()
  ;[...hits].sort((a, b) => b.rel - a.rel).slice(0, 10).forEach(h => vote.set(h.p.categoryId, (vote.get(h.p.categoryId) ?? 0) + h.rel))
  const predictedCat = [...vote].sort((a, b) => b[1] - a[1])[0]?.[0]
  for (const h of hits) {
    h.score = 0.6 * (h.rel / maxRel) + 0.25 * quality(h.p, maxSales) + 0.15 * (opts.personal?.(h.p) ?? 0)
    if (h.p.categoryId === predictedCat && vote.size > 1) h.score *= 1.15
  }
  hits.sort((a, b) => b.score - a.score)
  parsed.predictedCat = predictedCat
  return { hits, parsed, predictedCat }
}

// ---------- 联想 ----------
export interface Suggestion { text: string; cat?: string; hot?: boolean }
/** 搜索下拉联想：词典词 + 标题短语 + 热搜词，前缀命中优先，按文档频次/热度排序 */
export function suggest(prefix: string, idx: SearchIndex, hot: { q: string; n: number }[] = [], limit = 10): Suggestion[] {
  const q = normalize(prefix)
  if (!q) return hot.slice(0, limit).map(h => ({ text: h.q, hot: true }))
  const scored = new Map<string, number>()
  const add = (w: string, s: number) => { if (w !== q && w.length <= 20) scored.set(w, Math.max(scored.get(w) ?? 0, s)) }
  for (const [w, df] of idx.vocab) if (df > 0 && w.includes(q)) add(w, (w.startsWith(q) ? 2 : 1) * Math.log2(2 + df))
  for (const h of hot) { const w = normalize(h.q); if (w.includes(q)) add(w, (w.startsWith(q) ? 3 : 1.5) * Math.log2(2 + h.n)) }
  // 从标题里截取以输入开头的短语（直到空格或 8 字）
  for (const d of idx.docs) { const t = d.fields[0][0]; const i = t.indexOf(q); if (i >= 0) { const m = t.slice(i).match(/^[^\s|]+(?: [^\s|]+)?/); const ph = m?.[0].slice(0, 14).trim(); if (ph && ph.length > q.length) add(ph, 1.2 * Math.log2(2 + d.p.sales / 1000)) } }
  const list = [...scored].sort((a, b) => b[1] - a[1]).slice(0, limit).map(([text]) => ({ text, hot: hot.some(h => normalize(h.q) === text) }) as Suggestion)
  // 第一条附带类目预测：「在 手机 分类中搜索」
  const r = search(q, idx, { noCorrect: true })
  if (r.predictedCat && r.hits.length) list.unshift({ text: q, cat: r.predictedCat })
  return list.slice(0, limit)
}
