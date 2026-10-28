// 全站多语言：运行时扫描页面中的中文文本（含动态数据，如商品标题），
// 通过 /api/translate（Workers AI + D1 缓存）翻译后替换；结果再缓存到浏览器本地。
// 原文保存在 WeakMap 中，DOM 变化由 MutationObserver 增量处理。

export interface Lang { code: string; label: string; en: string; rtl?: boolean }
export const LANGS: Lang[] = [
  { code: 'zh', label: '简体中文', en: 'Chinese' },
  { code: 'en', label: 'English', en: 'English' },
  { code: 'vi', label: 'Tiếng Việt', en: 'Vietnamese' },
  { code: 'fr', label: 'Français', en: 'French' },
  { code: 'ko', label: '한국어', en: 'Korean' },
  { code: 'ja', label: '日本語', en: 'Japanese' },
  { code: 'ms', label: 'Bahasa Melayu', en: 'Malay' },
  { code: 'ru', label: 'Русский', en: 'Russian' },
  { code: 'ar', label: 'العربية', en: 'Arabic', rtl: true },
]
const KEY = 'plam-lang'
const CJK = /[㐀-鿿]/
const ATTRS = ['placeholder', 'title', 'aria-label', 'alt'] as const
const SKIP = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEXTAREA', 'CODE', 'PRE'])

export function getLang(): string {
  try { const l = localStorage.getItem(KEY); if (l && LANGS.some(x => x.code === l)) return l } catch { /* ignore */ }
  return 'zh'
}
export function setLang(code: string) {
  try { localStorage.setItem(KEY, code) } catch { /* ignore */ }
  // 切换语言时整页重载：从中文原文重新翻译，避免译文二次翻译
  location.reload()
}

// ---------- 数字模板化：「共 4 件」「共 9 件」共享同一条译文 ----------
// 「N折」中的数字保留原值（模型需要据此换算成 X% off），其余数字模板化
const NUM = /\d+(?:[.,]\d+)*(?!\d|[.,]\d|\s*折)/g
const PH = (i: number) => String(9001 + i)
function templ(s: string): { key: string; nums: string[] } {
  const nums: string[] = []
  const key = s.replace(NUM, m => { nums.push(m); return PH(nums.length - 1) })
  return { key, nums }
}
function fill(t: string, nums: string[]): string {
  let out = t
  nums.forEach((n, i) => { out = out.split(PH(i)).join(n) })
  return out
}

// ---------- 缓存 ----------
let lang = 'zh'
let cache: Record<string, string> = {}
const pending = new Set<string>()
const inflight = new Set<string>()
const loadCache = () => { try { cache = JSON.parse(localStorage.getItem(`${KEY}-cache-${lang}`) ?? '{}') } catch { cache = {} } }
let saveTimer = 0
const saveCache = () => { clearTimeout(saveTimer); saveTimer = window.setTimeout(() => { try { localStorage.setItem(`${KEY}-cache-${lang}`, JSON.stringify(cache)) } catch { /* 超出配额时忽略 */ } }, 800) }

// ---------- DOM 处理 ----------
const origText = new WeakMap<Text, string>()
const lastSet = new WeakMap<Text, string>()
const origAttr = new WeakMap<Element, Record<string, string>>()

function translateString(src: string): string | null {
  const lead = src.match(/^\s*/)![0], tail = src.match(/\s*$/)![0]
  const core = src.trim()
  if (!core || !CJK.test(core)) return src
  const { key, nums } = templ(core)
  const hit = cache[key]
  if (hit === undefined) { if (!inflight.has(key)) pending.add(key); return null }
  return lead + fill(hit, nums) + tail
}

function handleText(n: Text) {
  const cur = n.data
  if (lastSet.get(n) === cur) return
  // React 重新渲染后文本可能已变化：以当前值作为新的原文
  origText.set(n, cur)
  const t = translateString(cur)
  if (t !== null && t !== cur) { lastSet.set(n, t); n.data = t }
}
function handleEl(el: Element) {
  for (const a of ATTRS) {
    const v = el.getAttribute(a)
    if (!v || !CJK.test(v)) continue
    const rec = origAttr.get(el) ?? {}
    rec[a] = v; origAttr.set(el, rec)
    const t = translateString(v)
    if (t !== null && t !== v) el.setAttribute(a, t)
  }
}
function walk(root: Node) {
  if (root.nodeType === Node.TEXT_NODE) { if (CJK.test((root as Text).data)) handleText(root as Text); return }
  if (root.nodeType !== Node.ELEMENT_NODE) return
  const el = root as Element
  if (SKIP.has(el.tagName) || (el as HTMLElement).isContentEditable || el.closest('[data-no-i18n]')) return
  handleEl(el)
  const tw = document.createTreeWalker(el, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, {
    acceptNode: n => {
      if (n.nodeType === Node.ELEMENT_NODE) { const e = n as Element; return SKIP.has(e.tagName) || e.hasAttribute('data-no-i18n') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT }
      return CJK.test((n as Text).data) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP
    },
  })
  let n: Node | null
  while ((n = tw.nextNode())) { if (n.nodeType === Node.TEXT_NODE) handleText(n as Text); else handleEl(n as Element) }
}

// ---------- 批量请求 ----------
let fetching = false
let bar: HTMLDivElement | null = null
function busy(on: boolean) {
  if (!bar) { bar = document.createElement('div'); bar.setAttribute('data-no-i18n', ''); bar.className = 'i18n-bar'; document.body.appendChild(bar) }
  bar.style.opacity = on ? '1' : '0'
}
async function flush() {
  if (fetching || !pending.size) { if (!fetching) busy(false); return }
  fetching = true
  busy(true)
  const batch = [...pending].slice(0, 60)
  batch.forEach(k => { pending.delete(k); inflight.add(k) })
  try {
    const r = await fetch('/api/translate', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ to: lang, texts: batch }) })
    if (r.ok) {
      const { map } = (await r.json()) as { map: Record<string, string> }
      Object.assign(cache, map)
      // 翻译失败的原文按原样缓存，避免反复请求
      batch.forEach(k => { if (cache[k] === undefined) cache[k] = k })
      saveCache()
    } else batch.forEach(k => { cache[k] = k })
  } catch { batch.forEach(k => { cache[k] = k }) }
  batch.forEach(k => inflight.delete(k))
  fetching = false
  walk(document.body)
  if (pending.size) flush(); else busy(false)
}

let queued = false
const dirty = new Set<Node>()
function schedule(n: Node) {
  dirty.add(n)
  if (queued) return
  queued = true
  setTimeout(() => {
    queued = false
    const list = [...dirty]; dirty.clear()
    list.forEach(x => { if (x.isConnected) walk(x) })
    if (pending.size) setTimeout(flush, 60)
  }, 30)
}

export function initI18n() {
  lang = getLang()
  const meta = LANGS.find(l => l.code === lang)!
  document.documentElement.lang = lang === 'zh' ? 'zh-CN' : lang
  document.documentElement.dir = meta.rtl ? 'rtl' : 'ltr'
  if (lang === 'zh') return
  document.documentElement.classList.add('i18n-on')
  loadCache()
  const title = document.title
  const mo = new MutationObserver(muts => {
    for (const m of muts) {
      if (m.type === 'characterData') schedule(m.target)
      else if (m.type === 'attributes') schedule(m.target)
      else m.addedNodes.forEach(n => schedule(n))
    }
    if (document.title !== title && CJK.test(document.title)) { const t = translateString(document.title); if (t) document.title = t }
  })
  const start = () => {
    mo.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: [...ATTRS] })
    schedule(document.body)
  }
  if (document.body) start(); else document.addEventListener('DOMContentLoaded', start)
}
