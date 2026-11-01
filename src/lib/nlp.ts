// 评价文本分析：属性-情感抽取，生成「大家都在说」印象标签
const ASPECTS: [string, string[]][] = [
  ['质量', ['质量', '品质', '做工', '材质', '面料', '用料']], ['物流', ['物流', '快递', '发货', '送货', '到货']], ['性价比', ['性价比', '价格', '划算', '实惠', '便宜']],
  ['包装', ['包装', '盒子', '礼盒']], ['客服', ['客服', '服务', '态度', '商家']], ['外观', ['颜值', '外观', '好看', '漂亮', '颜色', '款式']], ['尺码', ['尺码', '大小', '合身', '尺寸']],
  ['效果', ['效果', '好用', '功能', '保湿', '吸收']], ['口感', ['味道', '口感', '好吃', '新鲜']], ['音质', ['音质', '降噪', '声音']], ['续航', ['续航', '电池', '充电']], ['屏幕', ['屏幕', '显示', '画质']],
]
const POS = ['好', '快', '棒', '赞', '满意', '喜欢', '不错', '优秀', '惊喜', '划算', '实惠', '值', '精美', '耐心', '舒服', '清晰', '新鲜', '好吃', '好看', '漂亮', '合身', '推荐', '回购']
const NEG = ['差', '慢', '烂', '失望', '不好', '一般', '退', '破', '坏', '假', '贵', '不值', '难', '小了', '大了', '褪色', '异味', '掉']
const NEG_PREFIX = /(不|没|没有|不太|并不)$/

export interface ReviewTag { aspect: string; label: string; positive: boolean; count: number }

/** 按句切分，句中出现属性词即判定该句情感（否定前缀翻转），聚合为标签，按次数排序 */
export function reviewTags(contents: { content: string; rating: number }[], limit = 6): ReviewTag[] {
  const agg = new Map<string, { pos: number; neg: number }>()
  for (const { content, rating } of contents) {
    for (const sent of content.split(/[，,。.!！?？；;\n~～]/)) {
      for (const [aspect, words] of ASPECTS) {
        const w = words.find(x => sent.includes(x))
        if (!w) continue
        let score = 0
        for (const p of POS) { const i = sent.indexOf(p); if (i >= 0) score += NEG_PREFIX.test(sent.slice(0, i)) ? -1 : 1 }
        for (const n of NEG) if (sent.includes(n)) score -= 1
        if (score === 0) score = rating >= 4 ? 1 : rating <= 2 ? -1 : 0
        if (!score) continue
        const a = agg.get(aspect) ?? { pos: 0, neg: 0 }
        if (score > 0) a.pos++; else a.neg++
        agg.set(aspect, a)
      }
    }
  }
  const label = (aspect: string, pos: boolean) => (pos ? { 质量: '质量很好', 物流: '物流很快', 性价比: '性价比高', 包装: '包装精美', 客服: '客服态度好', 外观: '颜值很高', 尺码: '尺码合适', 效果: '效果不错', 口感: '味道很好', 音质: '音质很棒', 续航: '续航给力', 屏幕: '屏幕清晰' } : { 质量: '质量一般', 物流: '物流较慢', 性价比: '价格偏贵', 包装: '包装简陋', 客服: '服务待提升', 外观: '外观一般', 尺码: '尺码不准', 效果: '效果一般', 口感: '口感一般', 音质: '音质一般', 续航: '续航较短', 屏幕: '屏幕一般' })[aspect as '质量'] ?? aspect
  const out: ReviewTag[] = []
  for (const [aspect, { pos, neg }] of agg) {
    if (pos) out.push({ aspect, label: label(aspect, true), positive: true, count: pos })
    if (neg) out.push({ aspect, label: label(aspect, false), positive: false, count: neg })
  }
  return out.sort((a, b) => Number(b.positive) - Number(a.positive) || b.count - a.count).slice(0, limit)
}
