// 国际化收货地址：国家 + 区号 + 各国手机号长度规则 + 邮编规则
import type { Address } from '@/data/types'
import { getLang } from '@/lib/i18n'

export interface Country { code: string; name: string; en: string; flag: string; dial: string; /** 本地号码位数（去掉区号与开头的 0） */ len: [number, number]; /** 首位数字限制 */ start?: RegExp; zip?: RegExp; zipHint?: string }

export const COUNTRIES: Country[] = [
  { code: 'CN', name: '中国', en: 'China', flag: '🇨🇳', dial: '86', len: [11, 11], start: /^1/, zip: /^\d{6}$/, zipHint: '6 位数字' },
  { code: 'VN', name: '越南', en: 'Vietnam', flag: '🇻🇳', dial: '84', len: [9, 10], start: /^[35789]/, zip: /^\d{5,6}$/, zipHint: '5–6 位数字' },
  { code: 'MY', name: '马来西亚', en: 'Malaysia', flag: '🇲🇾', dial: '60', len: [9, 10], start: /^1/, zip: /^\d{5}$/, zipHint: '5 位数字' },
  { code: 'SG', name: '新加坡', en: 'Singapore', flag: '🇸🇬', dial: '65', len: [8, 8], start: /^[89]/, zip: /^\d{6}$/, zipHint: '6 位数字' },
  { code: 'TH', name: '泰国', en: 'Thailand', flag: '🇹🇭', dial: '66', len: [9, 9], start: /^[689]/, zip: /^\d{5}$/, zipHint: '5 位数字' },
  { code: 'ID', name: '印度尼西亚', en: 'Indonesia', flag: '🇮🇩', dial: '62', len: [9, 12], start: /^8/, zip: /^\d{5}$/, zipHint: '5 位数字' },
  { code: 'PH', name: '菲律宾', en: 'Philippines', flag: '🇵🇭', dial: '63', len: [10, 10], start: /^9/, zip: /^\d{4}$/, zipHint: '4 位数字' },
  { code: 'JP', name: '日本', en: 'Japan', flag: '🇯🇵', dial: '81', len: [10, 10], start: /^[789]/, zip: /^\d{3}-?\d{4}$/, zipHint: '如 100-0001' },
  { code: 'KR', name: '韩国', en: 'South Korea', flag: '🇰🇷', dial: '82', len: [9, 10], start: /^1/, zip: /^\d{5}$/, zipHint: '5 位数字' },
  { code: 'HK', name: '中国香港', en: 'Hong Kong', flag: '🇭🇰', dial: '852', len: [8, 8], start: /^[4-9]/ },
  { code: 'MO', name: '中国澳门', en: 'Macau', flag: '🇲🇴', dial: '853', len: [8, 8], start: /^6/ },
  { code: 'TW', name: '中国台湾', en: 'Taiwan', flag: '🇹🇼', dial: '886', len: [9, 9], start: /^9/, zip: /^\d{3}(\d{2,3})?$/, zipHint: '3 或 5–6 位数字' },
  { code: 'AE', name: '阿联酋（迪拜）', en: 'United Arab Emirates', flag: '🇦🇪', dial: '971', len: [9, 9], start: /^5/ },
  { code: 'SA', name: '沙特阿拉伯', en: 'Saudi Arabia', flag: '🇸🇦', dial: '966', len: [9, 9], start: /^5/, zip: /^\d{5}$/, zipHint: '5 位数字' },
  { code: 'QA', name: '卡塔尔', en: 'Qatar', flag: '🇶🇦', dial: '974', len: [8, 8], start: /^[3-7]/ },
  { code: 'KW', name: '科威特', en: 'Kuwait', flag: '🇰🇼', dial: '965', len: [8, 8], start: /^[569]/, zip: /^\d{5}$/, zipHint: '5 位数字' },
  { code: 'RU', name: '俄罗斯', en: 'Russia', flag: '🇷🇺', dial: '7', len: [10, 10], start: /^9/, zip: /^\d{6}$/, zipHint: '6 位数字' },
  { code: 'FR', name: '法国', en: 'France', flag: '🇫🇷', dial: '33', len: [9, 9], start: /^[67]/, zip: /^\d{5}$/, zipHint: '5 位数字' },
  { code: 'DE', name: '德国', en: 'Germany', flag: '🇩🇪', dial: '49', len: [10, 11], start: /^1/, zip: /^\d{5}$/, zipHint: '5 位数字' },
  { code: 'GB', name: '英国', en: 'United Kingdom', flag: '🇬🇧', dial: '44', len: [10, 10], start: /^7/, zip: /^[A-Za-z0-9 ]{5,8}$/, zipHint: '如 SW1A 1AA' },
  { code: 'IT', name: '意大利', en: 'Italy', flag: '🇮🇹', dial: '39', len: [9, 10], start: /^3/, zip: /^\d{5}$/, zipHint: '5 位数字' },
  { code: 'ES', name: '西班牙', en: 'Spain', flag: '🇪🇸', dial: '34', len: [9, 9], start: /^[67]/, zip: /^\d{5}$/, zipHint: '5 位数字' },
  { code: 'US', name: '美国', en: 'United States', flag: '🇺🇸', dial: '1', len: [10, 10], start: /^[2-9]/, zip: /^\d{5}(-\d{4})?$/, zipHint: '5 位数字' },
  { code: 'CA', name: '加拿大', en: 'Canada', flag: '🇨🇦', dial: '1', len: [10, 10], start: /^[2-9]/, zip: /^[A-Za-z]\d[A-Za-z] ?\d[A-Za-z]\d$/, zipHint: '如 K1A 0B1' },
  { code: 'AU', name: '澳大利亚', en: 'Australia', flag: '🇦🇺', dial: '61', len: [9, 9], start: /^4/, zip: /^\d{4}$/, zipHint: '4 位数字' },
  { code: 'IN', name: '印度', en: 'India', flag: '🇮🇳', dial: '91', len: [10, 10], start: /^[6-9]/, zip: /^\d{6}$/, zipHint: '6 位数字' },
]
export const countryOf = (code?: string) => COUNTRIES.find(c => c.code === code) ?? COUNTRIES[0]

/** 按界面语言给出默认国家 */
export function defaultCountry(): string {
  return ({ vi: 'VN', ms: 'MY', ja: 'JP', ko: 'KR', ru: 'RU', ar: 'AE', fr: 'FR', en: 'US' } as Record<string, string>)[getLang()] ?? 'CN'
}

/** 规范化本地手机号：只保留数字，去掉用户误填的区号和开头的 0 */
export function normPhone(raw: string, c: Country): string {
  let d = raw.replace(/\D/g, '')
  if (raw.trim().startsWith('+') || (d.startsWith(c.dial) && d.length > c.len[1])) { if (d.startsWith(c.dial)) d = d.slice(c.dial.length) }
  if (d.startsWith('0') && c.code !== 'IT') d = d.replace(/^0+/, '')
  return d
}

export interface AddrErrors { name?: string; country?: string; phone?: string; region?: string; detail?: string; zip?: string }
export function validateAddress(a: Address): AddrErrors {
  const e: AddrErrors = {}
  const c = countryOf(a.country)
  if (!a.name.trim()) e.name = '请填写收货人姓名'
  else if (a.name.trim().length < 2) e.name = '姓名至少 2 个字符'
  if (!a.country) e.country = '请选择所在国家'
  const local = normPhone(a.phone, c)
  if (!local) e.phone = '请填写手机号'
  else if (local.length < c.len[0] || local.length > c.len[1]) e.phone = `${c.name}手机号应为 ${c.len[0] === c.len[1] ? c.len[0] : `${c.len[0]}–${c.len[1]}`} 位（不含区号 +${c.dial}）`
  else if (c.start && !c.start.test(local)) e.phone = `${c.name}手机号格式不正确，请检查号码`
  if (!a.region?.trim()) e.region = '请填写所在城市'
  if (!a.detail.trim()) e.detail = '请填写详细地址'
  else if (a.detail.trim().length < 5) e.detail = '详细地址太短，请写到街道和门牌号'
  if (a.zip?.trim() && c.zip && !c.zip.test(a.zip.trim())) e.zip = `邮编格式不正确（${c.zipHint}）`
  return e
}

/** 展示用：+84 902 663 061 */
export function fmtPhone(a: Pick<Address, 'phone' | 'country'>): string {
  if (!a.country) return a.phone
  const c = countryOf(a.country)
  const d = normPhone(a.phone, c)
  return `+${c.dial} ${d.replace(/(\d{3})(?=\d{3,})/g, '$1 ')}`
}
/** 展示用：国家 城市 详细地址 邮编 */
export function fmtAddr(a: Pick<Address, 'region' | 'detail' | 'country' | 'zip'>): string {
  const c = a.country ? countryOf(a.country) : null
  return [c && `${c.flag} ${c.name}`, a.region, a.detail, a.zip].filter(Boolean).join(' ')
}
