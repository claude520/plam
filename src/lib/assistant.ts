// 店小蜜（AI 客服）：意图识别 + 基于店铺 / 商品 / 订单上下文的回答。
// 优先调用 Workers AI 大模型（/api/assistant），失败时用规则引擎按意图作答，保证总有回复。
import type { Coupon, Order, Product, Shop } from '@/data/types'
import { ORDER_STATUS, money } from './format'

export type Intent = 'greet' | 'logistics' | 'refund' | 'size' | 'price' | 'stock' | 'invoice' | 'quality' | 'human' | 'complaint' | 'other'

const RULES: [Intent, RegExp][] = [
  ['human', /人工|真人|转接|找客服|活人/],
  ['complaint', /投诉|差评|骗|垃圾|太差|气死|举报|假货/],
  ['logistics', /物流|快递|发货|到哪|几天到|单号|什么时候到|没收到|派送|揽收/],
  ['refund', /退货|退款|换货|退换|七天|7天|无理由|售后|运费险/],
  ['size', /尺码|多大|大小|身高|体重|码数|偏大|偏小|合身|尺寸|颜色|规格|型号|参数|配置|款式|哪个色/],
  ['price', /优惠|便宜|打折|券|红包|满减|活动|降价|最低|包邮|价格/],
  ['stock', /有货|库存|现货|缺货|补货|还有吗/],
  ['invoice', /发票|开票|专票|普票/],
  ['quality', /正品|质量|保修|材质|真假|质保|保质期|效果|怎么样|好用吗|耐用/],
  ['greet', /^(你好|在吗|在不在|hi|hello|您好|亲)[!！?？。~～]*$/i],
]
export const INTENT_NAME: Record<Intent, string> = { greet: '问候', logistics: '物流咨询', refund: '退换货', size: '尺码 / 规格', price: '优惠活动', stock: '库存', invoice: '发票', quality: '质量 / 正品', human: '转人工', complaint: '投诉 / 负面情绪', other: '其他' }

export function classify(text: string): Intent {
  const t = text.trim()
  for (const [k, re] of RULES) if (re.test(t)) return k
  return 'other'
}

export interface AssistantCtx { shop: Shop; products: Product[]; orders: Order[]; coupons: Coupon[]; item?: Product }

/** 拼接给大模型的系统提示：店铺政策、在售商品、该买家在本店的订单 */
export function systemPrompt(c: AssistantCtx): string {
  const list = (c.item ? [c.item, ...c.products.filter(p => p.id !== c.item!.id)] : c.products).slice(0, 15)
  const prods = list.map(p => `- ${p.title}｜¥${money(p.price)}｜库存${p.skus.reduce((a, s) => a + s.stock, 0)}｜${p.freeShipping ? '包邮' : '不包邮'}${p.attrs.length ? '｜规格：' + p.attrs.map(a => `${a.name}(${a.values.join('/')})`).join('，') : ''}`).join('\n')
  const ords = c.orders.slice(0, 5).map(o => `- 订单${o.id}：${o.items.map(i => i.title.slice(0, 20)).join('、')}，状态「${ORDER_STATUS[o.status].label}」${o.logistics ? `，${o.logistics.company}${o.logistics.no ? ' ' + o.logistics.no : ''}，最新：${o.logistics.traces.at(-1)?.text ?? ''}` : ''}`).join('\n') || '（该买家在本店暂无订单）'
  const cps = c.coupons.filter(x => x.status === 'active' && (!x.shopId || x.shopId === c.shop.id)).slice(0, 5).map(x => `- ${x.name}${x.threshold ? `：满${x.threshold}减${x.value}` : ''}`).join('\n') || '（暂无可用优惠券）'
  return `你是淘宝风格电商平台 Plam 上「${c.shop.name}」的智能客服“店小蜜”。用简体中文、亲切简洁地回复买家（以“亲”开头，不超过 80 字），只根据下面的信息回答，不确定的不要编造，引导买家联系人工客服。不要使用 Markdown。
店铺政策：付款后 48 小时内发货；支持 7 天无理由退换（定制、虚拟商品除外），质量问题来回运费由店铺承担；可开具电子普通发票。
${c.shop.ai?.faq ? '商家补充知识库：' + c.shop.ai.faq + '\n' : ''}${c.item ? `买家正在咨询的宝贝：${c.item.title}\n` : ''}在售商品：
${prods}
店铺优惠：
${cps}
买家在本店的订单：
${ords}`
}

/** 规则兜底回答 */
export function ruleAnswer(intent: Intent, c: AssistantCtx): string {
  const o = c.orders[0]
  const p = c.item ?? c.products[0]
  switch (intent) {
    case 'greet': return `亲，在的呢～我是${c.shop.name}的智能客服店小蜜，请问有什么可以帮您？`
    case 'logistics': return o ? `亲，您的订单 ${o.id} 当前状态「${ORDER_STATUS[o.status].label}」${o.logistics ? `，${o.logistics.company}${o.logistics.no ? ' ' + o.logistics.no : ''}，最新进度：${o.logistics.traces.at(-1)?.text ?? '已发出'}` : '，我们会在付款后 48 小时内发货哦'}。` : '亲，本店付款后 48 小时内发货，发货后可在「我的订单」查看物流进度哦～'
    case 'refund': return '亲，本店支持 7 天无理由退换（定制和虚拟商品除外），在「我的订单」点击「申请售后」即可；质量问题来回运费由店铺承担～'
    case 'size': return p?.attrs.length ? `亲，「${p.title.slice(0, 16)}」可选 ${p.attrs.map(a => `${a.name}：${a.values.join(' / ')}`).join('；')}。拿不准的话告诉我身高体重或使用场景，帮您推荐～` : '亲，具体规格请参考宝贝详情页的参数表哦～'
    case 'price': { const cp = c.coupons.find(x => x.status === 'active' && (!x.shopId || x.shopId === c.shop.id)); return cp ? `亲，店铺现在有「${cp.name}」${cp.threshold ? `（满${cp.threshold}减${cp.value}）` : ''}，在宝贝页领券后下单自动抵扣哦～` : '亲，当前价格已是活动价啦，关注店铺可第一时间收到优惠通知～' }
    case 'stock': { const n = p?.skus.reduce((a, s) => a + s.stock, 0) ?? 0; return p ? (n > 0 ? `亲，「${p.title.slice(0, 16)}」目前有现货（${n} 件），下单后 48 小时内发出～` : '亲，这款暂时缺货，可以先收藏，补货后会提醒您～') : '亲，页面能选的规格都是有货的哦～' }
    case 'invoice': return '亲，本店支持开具电子普通发票，确认收货后在订单详情点击「申请开票」填写抬头即可～'
    case 'quality': return `亲，${c.shop.type === 'tmall' ? '天猫店铺所售均为品牌正品，' : ''}本店商品均经过质检，支持假一赔四，收到后有任何问题都可以联系我们处理～`
    case 'human': return '亲，已为您转接人工客服，请稍候，客服上线后会第一时间回复您～'
    case 'complaint': return '亲，非常抱歉给您带来不好的体验！已为您优先转接人工客服处理，我们一定给您满意的解决方案。'
    default: return '亲，您的问题我已记录，人工客服会尽快回复您；也可以试试问我：物流、退换货、尺码、优惠～'
  }
}

/** 生成回复：投诉 / 转人工直接走规则（并标记需人工），其余优先大模型 */
export async function answer(text: string, history: { role: 'user' | 'assistant'; content: string }[], c: AssistantCtx): Promise<{ text: string; intent: Intent; handoff: boolean; model?: string }> {
  const intent = classify(text)
  const handoff = intent === 'human' || intent === 'complaint'
  if (handoff || intent === 'greet') return { text: ruleAnswer(intent, c), intent, handoff }
  try {
    const r = await fetch('/api/assistant', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ system: systemPrompt(c), messages: [...history.slice(-8), { role: 'user', content: text }] }) })
    if (r.ok) { const d = (await r.json()) as { text?: string; model?: string }; if (d.text) return { text: d.text.slice(0, 300), intent, handoff, model: d.model } }
  } catch { /* 走规则兜底 */ }
  return { text: ruleAnswer(intent, c), intent, handoff }
}
