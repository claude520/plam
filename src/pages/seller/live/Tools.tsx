import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Bot, Camera, Check, CheckCircle2, ChevronRight, Mic, Monitor, Palette, Sparkles, Wifi, Shield, AlertTriangle, Wrench, BookOpen, Video, Users, Rocket, Zap } from 'lucide-react'
import { useDB } from '@/store/db'
import { useCurrentShop } from '@/lib/hooks'
import { Img, Modal } from '@/components/ui'
import { useMyLiveConfig, useMyLives, Panel } from './common'
import { cls, compact } from '@/lib/format'
import { toast } from '@/store/session'
import { img } from '@/data/seed'

const TOOL_TABS = [['screen', '公屏管理'], ['card', '智能手卡'], ['sticker', '前景贴片（新）'], ['decorate', '直播装修'], ['multi', '1+N直播'], ['test', '试播诊断']] as const

export function DeviceTest({ onDone }: { onDone?: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [level, setLevel] = useState(0)
  const [err, setErr] = useState('')
  const [net, setNet] = useState<number | null>(null)
  useEffect(() => {
    let raf = 0; let ctx: AudioContext | null = null
    navigator.mediaDevices?.getUserMedia({ video: { width: 640, height: 360 }, audio: true }).then(s => {
      setStream(s); if (videoRef.current) videoRef.current.srcObject = s
      ctx = new AudioContext(); const src = ctx.createMediaStreamSource(s); const an = ctx.createAnalyser(); an.fftSize = 256; src.connect(an); const buf = new Uint8Array(an.frequencyBinCount)
      const loop = () => { an.getByteFrequencyData(buf); setLevel(Math.min(100, Math.round(buf.reduce((a, b) => a + b, 0) / buf.length * 1.5))); raf = requestAnimationFrame(loop) }; loop()
    }).catch(e => setErr(String(e?.message ?? e)))
    const t0 = performance.now(); fetch('/api/version', { cache: 'no-store' }).then(() => setNet(Math.round(performance.now() - t0))).catch(() => setNet(-1))
    return () => { cancelAnimationFrame(raf); ctx?.close(); }
  }, [])
  useEffect(() => () => { stream?.getTracks().forEach(t => t.stop()) }, [stream])
  const ok = !!stream
  return (
    <div className="grid grid-cols-[320px_1fr] max-md:!grid-cols-1 gap-5">
      <div className="rounded-xl overflow-hidden bg-black aspect-[9/14] relative"><video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover" />{!ok && <div className="absolute inset-0 flex items-center justify-center text-white/70 text-sm px-6 text-center">{err ? `无法访问摄像头：${err}` : '正在请求摄像头与麦克风权限…'}</div>}</div>
      <div className="space-y-3">
        {[[<Camera className="w-4 h-4" />, '摄像头', ok ? `正常 · ${stream?.getVideoTracks()[0]?.getSettings().width ?? 640}×${stream?.getVideoTracks()[0]?.getSettings().height ?? 360}` : err ? '不可用' : '检测中', ok], [<Mic className="w-4 h-4" />, '麦克风', ok ? <span className="flex items-center gap-2">正常 <span className="w-32 h-2 rounded bg-ink-100 overflow-hidden"><span className="block h-full bg-emerald-500 transition-all" style={{ width: `${level}%` }} /></span></span> : '检测中', ok], [<Wifi className="w-4 h-4" />, '网络', net === null ? '检测中' : net < 0 ? '离线（本地模式）' : `${net} ms · ${net < 200 ? '适合高清推流' : '建议选择流畅画质'}`, net !== null && net >= 0], [<Monitor className="w-4 h-4" />, '浏览器编码', typeof MediaRecorder !== 'undefined' ? '支持 MediaRecorder（webm/vp8+opus）' : '不支持视频编码，将以关键帧模式推流', typeof MediaRecorder !== 'undefined']].map(([ic, l, v, good], i) => <div key={i} className="flex items-center gap-3 rounded-lg border border-ink-100 p-3 text-sm"><span className="w-8 h-8 rounded-lg bg-ink-50 flex items-center justify-center text-ink-600">{ic as React.ReactNode}</span><span className="w-24 font-medium">{l as string}</span><span className="flex-1 text-ink-600">{v as React.ReactNode}</span>{good ? <CheckCircle2 className="w-5 h-5 text-emerald-500" /> : <AlertTriangle className="w-5 h-5 text-amber-500" />}</div>)}
        <div className="rounded-lg bg-ink-50 p-3 text-xs text-ink-600 space-y-1"><div>✓ 布景检测：画面光线充足，背景整洁</div><div>✓ 违规预检：未检测到违禁词与敏感画面</div><div>✓ 建议：竖屏直播请将手机 / 摄像头竖向放置</div></div>
        {onDone && <button onClick={onDone} className="btn-primary">诊断完成，去开播</button>}
      </div>
    </div>
  )
}

export function LiveTools() {
  const [sp, setSp] = useSearchParams()
  const tab = (sp.get('tab') as typeof TOOL_TABS[number][0]) || 'screen'
  const cfg = useMyLiveConfig()
  const upsert = useDB(s => s.upsertLiveConfig)
  const shop = useCurrentShop()
  const products = useDB(s => s.products).filter(p => p.shopId === shop.id && p.status === 'on')
  const [agree, setAgree] = useState(false)
  const [cardP, setCardP] = useState(products[0]?.id ?? '')
  const [dec, setDec] = useState(0)
  const [style, setStyle] = useState('全部')
  const nav = useNavigate()
  const lives = useMyLives()
  const p = products.find(x => x.id === cardP)
  const card = p ? [`【${p.title.slice(0, 12)}】今天直播间专享价只要 ${p.price} 元，拍下立减`, `卖点一：${p.tags[0] ?? '品质保障'}，${p.subtitle ?? '用过都说好'}`, `卖点二：${p.freeShipping ? '全国包邮' : '顺丰速达'}，7 天无理由退换，放心拍`, `互动：想要的宝宝扣 1，满 50 人我们上福利款`, `逼单：库存只有 ${p.stock} 件，直播间下单前 20 名送小礼物`] : []
  const templates = ['商家版-服饰12.3周三特卖日贴纸', '寻乌脐橙节', '商家版-服饰11.29开新日贴纸', '总裁直播装修', '双11 主会场贴片', '好物抢先看', '清仓倒计时', '新粉福利']
  return (
    <div className="max-w-[1260px]">
      <div className="bg-white -mx-3 md:-mx-6 -mt-3 md:-mt-6 px-3 md:px-6 border-b border-ink-200 flex items-center gap-6 overflow-x-auto no-scrollbar">{TOOL_TABS.map(([k, l]) => <button key={k} onClick={() => setSp({ tab: k })} className={cls('relative py-4 text-[15px] whitespace-nowrap', tab === k ? 'font-semibold text-ink-900 after:absolute after:left-0 after:right-0 after:bottom-0 after:h-0.5 after:bg-ink-900' : 'text-ink-600 hover:text-ink-900')}>{l}</button>)}</div>
      {tab === 'screen' && (
        <div className="mt-8 text-center">
          <h1 className="text-2xl md:text-3xl font-bold">AI智能公屏管理，增强观众互动粘性</h1>
          <div className="mt-3 text-sm text-ink-600 flex items-center justify-center gap-6 flex-wrap"><span><b className="text-ink-900">{cfg.publicScreenAI ? 1 : 0}位</b> 主播已开启</span><span>近一个月累计回复 <b className="text-ink-900">{cfg.publicScreenAI ? 128 : 0}条</b></span><span>近一个月累计发起互动 <b className="text-ink-900">{cfg.publicScreenAI ? 36 : 0}次</b></span></div>
          <div className="mt-8 grid grid-cols-3 max-md:!grid-cols-1 gap-5 text-left">
            {[['AI自动回复', '可用率 90%+ · 响应 50ms', '实时理解公屏弹幕，秒级智能回复', ['自动读取商详及宝贝口袋，覆盖12类问题回复', '支持上传私有知识库，让AI回复范围更广、更精准'], '这款鸭鸭羽绒服是2026新款，有黑色和粉色可选，适合2~14岁的孩子'], ['辅助回复', '单品词条 不限 · 匹配 <1s', '商品问答精准匹配，秒级触发', ['按SKU维度配置问答对，个数不限', '播中秒级回复配置内容，减少重复工作'], '466号清风至今套餐有多种组合包装，最少24包，最多60包，您可以按需挑选购买'], ['智能互动', '多达 15+ · 互动率 3x+', '千人千面主动互动，全方位激活直播间', ['AI生成欢迎语，智能个性化打招呼', '关注引导、转评分享、AI帮你引导直播互动'], '欢迎来到直播间的宝宝们，我的每场直播都是精心准备的，关注上会可享受更多福利优惠~']].map(([t, m, h, pts, demo]) => <div key={t as string} className="card p-5"><div className="flex items-center justify-between"><span className="tag-red h-6 px-2">{t as string}</span><span className="text-xs text-ink-500">{m as string}</span></div><div className="mt-3 text-lg font-semibold">{h as string}</div><ul className="mt-2 space-y-1.5 text-sm text-ink-600">{(pts as string[]).map(x => <li key={x} className="flex items-start gap-1.5"><Check className="w-4 h-4 text-brand-500 shrink-0 mt-0.5" />{x}</li>)}</ul><div className="mt-4 rounded-lg bg-ink-50 p-3 text-xs"><div className="text-ink-400 mb-1">AI小助手</div><div className="rounded-md bg-ink-700 text-white p-2 leading-relaxed">{demo as string}</div></div></div>)}
          </div>
          <label className="mt-8 inline-flex items-center gap-2 text-sm"><input type="checkbox" checked={agree || cfg.publicScreenAI} onChange={e => setAgree(e.target.checked)} className="accent-brand-500" />我已阅读并同意《AI智能公屏管理功能使用须知》</label>
          <div className="mt-4"><button onClick={() => { if (!agree && !cfg.publicScreenAI) return toast('请先阅读并同意使用须知', 'error'); upsert({ ...cfg, publicScreenAI: !cfg.publicScreenAI, aiReply: !cfg.publicScreenAI }); toast(cfg.publicScreenAI ? '已关闭AI公屏' : 'AI公屏已开启，直播间评论将由AI助理自动回复') }} className="btn-primary btn-lg">{cfg.publicScreenAI ? '关闭AI公屏' : '开启AI公屏'}</button></div>
        </div>
      )}
      {tab === 'card' && (
        <div className="mt-5 grid grid-cols-[320px_1fr] max-md:!grid-cols-1 gap-4 items-start">
          <Panel title="选择商品"><div className="space-y-1 max-h-[520px] overflow-auto">{products.map(x => <button key={x.id} onClick={() => setCardP(x.id)} className={cls('w-full flex items-center gap-2 rounded-lg p-2 text-left text-sm', cardP === x.id ? 'bg-brand-50' : 'hover:bg-ink-50')}><Img src={x.images[0]} alt="" w={80} h={80} className="w-10 h-10 rounded object-cover" /><span className="flex-1 truncate">{x.title}</span></button>)}</div></Panel>
          <Panel title={<span className="flex items-center gap-2"><Sparkles className="w-4 h-4 text-fuchsia-500" />智能手卡</span>} extra={<button onClick={() => { navigator.clipboard?.writeText(card.join('\n')); toast('手卡已复制') }} className="btn-outline btn-sm">复制脚本</button>}>
            {p ? <div className="space-y-3">{card.map((line, i) => <div key={i} className="flex gap-3 rounded-lg bg-ink-50 p-3 text-sm leading-relaxed"><span className="w-6 h-6 rounded-full bg-fuchsia-100 text-fuchsia-700 text-xs flex items-center justify-center shrink-0 font-num">{i + 1}</span>{line}</div>)}<div className="text-xs text-ink-500">手卡会在中控台讲解该商品时自动展示（需在直播设置中开启 AI 手卡）</div></div> : <div className="text-sm text-ink-500">暂无商品</div>}
          </Panel>
        </div>
      )}
      {tab === 'sticker' && (
        <Panel className="mt-5" title="前景贴片（新）" extra={<span className="text-xs text-ink-500">叠加在直播画面上的活动贴纸</span>}>
          <div className="grid grid-cols-4 max-md:!grid-cols-2 gap-4">{['双11 狂欢', '新粉福利', '限时秒杀', '关注抽免单', '整点红包', '包邮到家', '清仓 1 折起', '主播推荐'].map((t, i) => <div key={t} className="rounded-xl border border-ink-100 overflow-hidden"><div className={cls('aspect-[4/3] flex items-center justify-center text-white font-black text-xl', ['bg-gradient-to-br from-rose-500 to-orange-400', 'bg-gradient-to-br from-fuchsia-500 to-indigo-500', 'bg-gradient-to-br from-amber-400 to-rose-500', 'bg-gradient-to-br from-emerald-400 to-cyan-500'][i % 4])}>{t}</div><div className="p-3 flex items-center justify-between text-sm"><span>{t}</span><button onClick={() => toast(`已应用贴片「${t}」，开播后在画面上展示`)} className="btn-outline btn-sm">使用</button></div></div>)}</div>
        </Panel>
      )}
      {tab === 'decorate' && (
        <div className="mt-5 card overflow-hidden">
          <div className="bg-[#1f1f23] text-white px-5 h-12 flex items-center justify-between"><span className="font-medium">直播装修市场</span><button onClick={() => toast('我的素材库：共 0 个素材')} className="text-sm opacity-90 flex items-center gap-1"><Palette className="w-4 h-4" />我的素材库</button></div>
          <div className="px-5 pt-4 flex items-center gap-6 border-b border-ink-100 text-sm">{['前置贴片（即将下线）', '主播信息卡', '互动组件排序', '绿幕背景'].map((t, i) => <button key={t} onClick={() => setDec(i)} className={cls('relative pb-3', dec === i ? 'font-semibold text-ink-900 after:absolute after:left-0 after:right-0 after:bottom-0 after:h-0.5 after:bg-brand-500' : 'text-ink-600')}>{t}</button>)}<span className="ml-auto text-xs text-ink-500 pb-3">💡 操作说明</span></div>
          <div className="px-5 py-3 flex items-center gap-3 text-xs text-ink-600 flex-wrap"><span>风格：</span>{['全部', '双十一', '内容型', '主播信息', '氛围'].map(s => <button key={s} onClick={() => setStyle(s)} className={cls('px-2 py-1 rounded', style === s ? 'bg-brand-50 text-brand-600' : 'hover:bg-ink-50')}>{s}</button>)}<span className="ml-auto">排序：<b className="text-ink-900">最近上传</b> · 最多使用</span></div>
          <div className="px-5 pb-5 grid grid-cols-4 max-md:!grid-cols-2 gap-4">{templates.map((t, i) => <div key={t} className="rounded-lg border border-ink-100 overflow-hidden group"><div className="relative aspect-[3/4] bg-ink-50"><Img src={img(`deco-${i}`, 300, 400)} alt={t} w={300} h={400} className="w-full h-full object-cover" /><span className="absolute top-2 right-2 tag bg-ink-900/80 text-white">官方</span><button onClick={() => toast(`已应用装修模板「${t}」`)} className="absolute inset-x-3 bottom-3 btn-primary btn-sm opacity-0 group-hover:opacity-100 transition">应用</button></div><div className="p-2.5 text-sm truncate">{t}</div></div>)}</div>
        </div>
      )}
      {tab === 'multi' && (
        <Panel className="mt-5" title="1+N 直播" extra={<span className="text-xs text-ink-500">一个主直播间 + N 个分发直播间同步推流</span>}>
          <div className="grid grid-cols-3 max-md:!grid-cols-1 gap-4">{[['主直播间', lives.find(l => l.status === 'live')?.title ?? '未开播', '当前 PC 开播画面'], ['分发直播间 A', '店铺号同步', '同步主直播间画面与商品'], ['分发直播间 B', '达人合作', '共享讲解与互动']].map(([t, s, d]) => <div key={t} className="rounded-xl border border-ink-100 p-4"><div className="flex items-center gap-2"><Video className="w-4 h-4 text-brand-500" /><span className="font-medium">{t}</span></div><div className="mt-2 text-sm">{s}</div><div className="text-xs text-ink-500 mt-1">{d}</div><button onClick={() => toast('演示环境：已绑定')} className="mt-3 btn-outline btn-sm">{t === '主直播间' ? '管理' : '绑定'}</button></div>)}</div>
        </Panel>
      )}
      {tab === 'test' && <Panel className="mt-5" title="试播诊断" extra={<span className="text-xs text-ink-500">提前检测设备性能、违规、布景 · 完成得 350PV</span>}><DeviceTest onDone={() => { const l = lives.find(x => x.status !== 'ended'); nav(l ? `/seller/live/studio/${l.id}` : '/seller/live/plan') }} /></Panel>}
    </div>
  )
}

const INTERACTIONS = [
  ['排位赛', '拉新涨粉', '激励粉丝参与排位赛冲榜获得福利，同时拉动成交', '立即使用'], ['新客加速', '拉新涨粉', '为店铺提供的高效拉新工具，面向新客的首单礼金，在订单完结后，针对有使用权益的订单按照「新客拉新费率」收取一定的软件服务费', '立即使用'], ['福利抽奖记录', '时长提升', '通过用户拉新助力的方式产生裂变促进涨粉、提升用户停留时长和增加流量', '点击查看'],
  ['限时秒杀', '商品转化', '实现商品基于直播内限时限量限价的秒杀通道，促进转粉、提升时长，并完成高效的商品及进店转化', '立即使用'], ['绿幕模板', '商品转化', '基于绿幕和蓝幕的新型演示工具，商家通过上传素材或使用官方模板，在直播间背景中展示宝贝相关信息', '立即使用'], ['抽免单', '商品转化', '0元抽免单可以引导用户下单，提升商品成交和用户停留', '查看记录'], ['直播闪降', '商品转化', '实现商品基于直播渠道限价热卖的营销工具，促进转粉、提升时长，并完成高效的商品及进店转化', '立即使用'], ['主播专属券', '商品转化', '主播在直播间发放的专属优惠券，领取后结算自动抵扣', '查看记录'],
  ['红包模板采买管理', '人群营销', '主播可以进行红包模板采买和管理', '创建红包模板'], ['万能红包', '人群营销', '万能红包&主播新客红包&主播口令红包在此配置，支持针对不同人群投放不同类型红包，同时支持站外引流到直播间', '立即使用'], ['新客商品专区', '人群营销', '通过专属商品（专区商品仅对目标用户群体可见），引导用户完成下单转化，从而提高直播间留存', '立即使用'], ['主播免定卡', '人群营销', '用户下单抵扣定金至0元', '立即使用'],
  ['直播间许愿', '内容营销', '主播可使用此工具进行测款，获得相关数据，决定是否要上架该商品。收集用户最近想要购买的商品，提高粉丝互动率与黏性', '立即使用'], ['直播间随搭', '内容营销', '主播可使用此工具配置活动图片和跳转链接，灵活展示玩法攻略、直播日历及部分权益领取入口', '立即使用'],
  ['粉丝团', '私域运营', '打赏型主播高价值粉丝增长维护利器！（仅限打赏直播间可用）', '立即使用'], ['粉丝专区', '私域运营', '主播可以针对不同粉丝等级用户设置不同权益，权益到指定时间可领取', '立即使用'],
]

export function Interaction() {
  const [cat, setCat] = useState('全部')
  const lives = useMyLives()
  const nav = useNavigate()
  const cur = lives.find(l => l.status === 'live') ?? lives.find(l => l.status === 'scheduled')
  const cats = ['全部', '拉新涨粉', '时长提升', '商品转化', '人群营销', '内容营销', '私域运营']
  return (
    <div className="max-w-[1260px]">
      <div className="flex items-center justify-between flex-wrap gap-2"><h1 className="text-xl font-semibold">直播互动</h1><button onClick={() => toast('权益配置：新粉券 ¥5 / 铁粉券 ¥10 已生效')} className="btn-primary">权益配置</button></div>
      <div className="mt-4 flex items-center gap-1 text-sm flex-wrap">{cats.map(c => <button key={c} onClick={() => setCat(c)} className={cls('px-3 h-8 rounded-md', cat === c ? 'bg-brand-50 text-brand-600' : 'text-ink-700 hover:bg-ink-100')}>{c}</button>)}</div>
      <div className="mt-4 grid grid-cols-3 max-lg:!grid-cols-2 max-md:!grid-cols-1 gap-x-6 gap-y-8">
        {INTERACTIONS.filter(x => cat === '全部' || x[1] === cat).map(([t, tag, d, btn], i) => <div key={t} className="flex gap-4"><div className="w-[120px] h-[210px] rounded-lg overflow-hidden bg-ink-100 shrink-0"><Img src={img(`inter-${i}`, 240, 420)} alt={t} w={240} h={420} className="w-full h-full object-cover" /></div><div className="flex flex-col min-w-0"><div className="flex items-center gap-2 flex-wrap"><span className="font-semibold text-base">{t}</span><span className="tag-gray">#{tag}</span></div><p className="mt-2 text-sm text-ink-600 line-clamp-4 leading-relaxed">{d}</p><button onClick={() => { if (['限时秒杀', '直播闪降', '主播专属券', '万能红包'].includes(t)) nav(cur ? `/seller/live/studio/${cur.id}?tool=${t}` : '/seller/live/plan'); else toast(`${t}：演示环境已开启`) }} className="mt-auto self-start rounded-md bg-brand-50 text-brand-600 text-sm px-3 py-1.5 hover:bg-brand-100">{btn}</button></div></div>)}
      </div>
    </div>
  )
}

export function Promote() {
  const [tab, setTab] = useState<'live' | 'content'>('live')
  const [sub, setSub] = useState<'in' | 'out'>('in')
  const lives = useMyLives()
  const items = sub === 'in' ? [['超级直播', '一站式直播推广工具，提供直播/人群/货品三大场景解决方案，提升直播间流量与成交！'], ['超级直播-商品打爆', '预算确定性花费在指定商品，放大直播间价格权益优势，助力单品成交爆发！'], ['超级直播-拉新涨粉', '直播全链路精准人群触达，新客获取（新客观看、新客获取）-老客收割（复购、资产转化）一站式收割，直播效率up！'], ['超级直播-全站推广', '付免联动增加单场次直播间的总成交，实现全站成交最大化！'], ['短直联动', '直播短视频种收一体、全域击穿，交付直播短视频成交最大化'], ['超级互动城', '在天猫农场、金币庄园、省钱消消消等，通过任务机制的有效设计，吸引消费者主动、深度交互，15S超长停留时间助力品牌心智建设']] : [['站外引流-短链', '生成直播间短链投放至微信、微博、抖音等站外渠道'], ['站外引流-海报', '一键生成带二维码的直播预告海报'], ['站外引流-口令', '生成淘口令，复制即可分享']]
  return (
    <div className="max-w-[1260px]">
      <div className="bg-white -mx-3 md:-mx-6 -mt-3 md:-mt-6 px-3 md:px-6 border-b border-ink-200 flex items-center gap-6">{(['live', 'content'] as const).map(k => <button key={k} onClick={() => setTab(k)} className={cls('relative py-4 text-[15px]', tab === k ? 'font-semibold text-ink-900 after:absolute after:left-0 after:right-0 after:bottom-0 after:h-0.5 after:bg-ink-900' : 'text-ink-600')}>{k === 'live' ? '直播推广' : '内容引流'}</button>)}</div>
      <h1 className="mt-5 text-xl font-semibold">{tab === 'live' ? '直播推广' : '内容引流'}</h1>
      <div className="mt-3 flex items-center gap-1 text-sm">{(['in', 'out'] as const).map(k => <button key={k} onClick={() => setSub(k)} className={cls('px-3 h-8 rounded-md', sub === k ? 'bg-brand-50 text-brand-600' : 'text-ink-700 hover:bg-ink-100')}>{k === 'in' ? '站内推广' : '站外引流'}</button>)}</div>
      <div className="mt-4 grid grid-cols-3 max-lg:!grid-cols-2 max-md:!grid-cols-1 gap-x-6 gap-y-8">{items.map(([t, d], i) => <div key={t} className="flex gap-4"><div className="w-[120px] h-[210px] rounded-lg shrink-0 bg-gradient-to-b from-sky-100 to-indigo-100 flex flex-col items-center justify-center text-center p-3"><Rocket className="w-8 h-8 text-indigo-500" /><div className="mt-2 text-sm font-bold text-indigo-700">{t}</div><div className="text-[10px] text-indigo-500 mt-1">{['一站式直播推广工具', '助力单品成交爆发', '直播全链路精准人群', '实现全站成交最大化', '直播短视频成交最大化', '15S超长停留'][i % 6]}</div></div><div className="flex flex-col"><div className="flex items-center gap-2"><span className="font-semibold text-base">{t}</span><span className="tag-gray">#{sub === 'in' ? '站内推广' : '站外引流'}</span></div><p className="mt-2 text-sm text-ink-600 line-clamp-4 leading-relaxed">{d}</p><button onClick={() => { if (sub === 'out') { const l = lives.find(x => x.status !== 'ended'); navigator.clipboard?.writeText(`${location.origin}/live/${l?.id ?? ''}`); toast('直播间链接已复制，可投放至站外') } else toast(`${t}：已跳转推广中心（演示）`) }} className="mt-auto self-start rounded-md bg-brand-50 text-brand-600 text-sm px-3 py-1.5 hover:bg-brand-100">立即使用</button></div></div>)}</div>
      <Panel className="mt-8" title="权益中心">
        <div className="grid grid-cols-3 max-md:!grid-cols-1 gap-4">
          <div className="rounded-lg bg-ink-50 p-4"><div className="text-sm font-medium">流量奖励</div><div className="text-xs text-ink-500 mt-1">当前已获取权益低于50%的同类商家，建议加大投放获取更多激励</div><Link to="/seller/live/data/coupon" className="link text-xs mt-2 inline-block">奖励详情</Link></div>
          <div className="rounded-lg bg-ink-50 p-4"><div className="text-sm font-medium">官方补贴</div><div className="text-xs text-ink-500 mt-1">活动奖励观看量</div><div className="text-2xl font-num font-semibold mt-1">{compact(lives.reduce((a, l) => a + Math.round(l.stats.views * 0.12), 0))}</div></div>
          <div className="rounded-lg bg-ink-50 p-4"><div className="text-sm font-medium">已获权益</div><div className="text-xs text-ink-500 mt-1">您可参与超级直播官方活动获得专属流量激励～</div><Link to="/seller/live/activity" className="link text-xs mt-2 inline-block">查看详情</Link></div>
        </div>
      </Panel>
    </div>
  )
}

export function Physical() {
  const lives = useMyLives()
  const [quiz, setQuiz] = useState(true)
  const [answered, setAnswered] = useState<string | null>(null)
  const [checked, setChecked] = useState(false)
  const [ai, setAi] = useState('')
  const [chat, setChat] = useState<string[]>([])
  const violations = 0
  const score = 100
  const code = lives.some(l => l.status === 'ended') ? '绿码' : '灰码'
  const tasks = [[0.3, '合规学习打卡', '完成1次答题，每次可获得0.3分抵扣卡，自然月内最多可得15次', `${checked ? 1 : 0}/15`], [3, '自然月预检工具使用率达标（次月1-3日发放）', '自然月预检工具使用率>=0.3且近60天内开播时长大于等于60分的场次>=20场', '0/1'], [0.5, '使用封面图预检3天', '自然月内累计使用封面图预检3天及以上可获得一次抵扣卡', '0/1'], [0.5, '使用文本预检工具3天', '自然月内累计使用文本预检3天及以上可获得一次抵扣卡', '0/1'], [0.5, '使用1次预检工具', '自然月内使用文本/封面图/挂品预检工具任意1次，每个自然月上限0.5分', '0/1'], [0.5, '使用挂品预检工具3天', '自然月内累计使用挂品预检3天及以上可获得一次抵扣卡', '0/1'], [0.5, '直播课堂合规学习', '完整阅读一篇直播课堂规则专区的文章，自然月内参与上限为4次，1天最多1次', '0/4'], [5, '完成互联网营销师考试认证', '完成人社部/平台互联网营销师认证考核，该任务权益仅发放一次', '0/1'], [1, '订阅安全码打卡', '订阅后可每日接收合规打卡提醒，该任务权益仅发放一次', '0/1'], [3, '保持直播合规60天', '近60天内>=60分钟的开播场次>=20场，且持续无违规，自然月内仅发放1次', '0/1']]
  const rules = [['关于直播间运营者定期信息核验公告', '2026/08/05 22:51:56', '1.8万'], ['Plam直播关于合规推广盲盒商品的通知', '2026/03/26 12:23:19', '2.3万'], ['廉正举报官方入口', '2026/01/19 16:34:01', '2.0万'], ['Plam直播管理规则详解', '2024/05/29 14:54:15', '11.0万'], ['新人主播绿色合规开播', '2023/06/28 15:17:32', '46.1万'], ['快速！一张图读懂直播合规指南', '2023/04/03 16:03:56', '42.3万'], ['关于未成年人保护相关规则更新的通知', '2022/08/10 14:46:14', '5.8万'], ['关于直播间营销人员需完成身份认证的通知', '2021/08/09 11:38:37', '8.6万']]
  return (
    <div className="max-w-[1260px]">
      <h1 className="text-xl font-semibold">直播体检</h1>
      <div className="mt-4 grid grid-cols-[1fr_400px] lg-stack gap-4 items-start">
        <div className="space-y-4">
          <div className="card p-5 bg-gradient-to-r from-[#2b2f3a] to-[#4a4f5e] text-white">
            <div className="flex items-start justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3"><span className="w-12 h-12 rounded-lg bg-white/15 flex items-center justify-center"><Shield className="w-6 h-6" /></span><div><div className="flex items-center gap-2 text-lg font-semibold">{lives[0]?.hostId ? 'seller12' : ''}<span className={cls('tag', code === '绿码' ? 'bg-emerald-500 text-white' : 'bg-white/30 text-white')}>{code}</span></div><div className="text-xs opacity-80 mt-0.5">{code === '绿码' ? '已达绿码标准，继续保持' : '未达到绿码标准，去查看 ›'}</div></div></div>
              <div className="text-right"><div className="text-xs opacity-80">超过同等级主播 <b>{code === '绿码' ? '86%' : '--%'}</b> ▲ · 超过同类目主播 <b>{code === '绿码' ? '79%' : '--%'}</b> ▲</div><div className="text-5xl font-num font-bold mt-1">{score}</div><div className="text-xs opacity-80">当前安全分</div></div>
            </div>
            <div className="mt-5 relative h-1.5 rounded-full bg-white/20"><div className="absolute left-0 top-0 h-full rounded-full bg-gradient-to-r from-slate-300 via-red-400 via-amber-400 to-emerald-400" style={{ width: code === '绿码' ? '100%' : '25%' }} /></div>
            <div className="mt-1.5 flex justify-between text-[11px] opacity-80"><span>灰码</span><span>红码</span><span>黄码</span><span>绿码</span></div>
          </div>
          <Panel title="码色权益">
            <div className="grid grid-cols-4 max-md:!grid-cols-2 gap-3">{[['缴纳违约金解限', '绿码/黄码/红码解锁'], ['优播违规预警', '绿码解锁'], ['黄牛拦截工具', '绿码解锁'], ['闪淘发布', '绿码解锁'], ['评论屏蔽300词', '绿码解锁'], ['直播营销准入', '绿码解锁'], ['V5等级晋升', '绿码解锁'], ['内容主播结算', '绿码解锁'], ['使用抵扣卡', '绿码/黄码/红码解锁']].map(([t, s]) => <div key={t} className="text-center"><div className={cls('mx-auto w-10 h-10 rounded-full flex items-center justify-center', code === '绿码' ? 'bg-emerald-100 text-emerald-600' : 'bg-ink-100 text-ink-400')}><Shield className="w-5 h-5" /></div><div className="text-sm mt-2">{t}</div><div className="text-[11px] text-ink-400 mt-0.5">{s}</div></div>)}</div>
          </Panel>
          <Panel title={<span>违规处理 <span className="text-xs font-normal text-ink-500 ml-1">了解直播违规的情况</span></span>} extra={<Link to="/seller/live/classroom" className="link text-xs">查看全部</Link>}>
            <div className="grid grid-cols-[200px_1fr] max-md:!grid-cols-1 gap-6 items-center">
              <div className="flex gap-10 justify-center"><div className="text-center"><div className="text-4xl font-num font-bold">{violations}</div><div className="text-xs text-ink-500 mt-1">待处理</div></div><div className="text-center"><div className="text-4xl font-num font-bold">{violations}</div><div className="text-xs text-ink-500 mt-1">今日新增</div></div></div>
              <div className="space-y-3 text-sm">{[['特别严重违规', 1], ['严重违规', 6], ['一般违规', 0]].map(([l, max]) => <div key={l as string} className="flex items-center gap-3"><span className="w-24 text-ink-600">{l as string}</span><div className="flex-1 h-1.5 rounded bg-ink-100 overflow-hidden"><div className="h-full bg-brand-500" style={{ width: '0%' }} /></div><span className="text-xs text-brand-500 w-16 text-right">0次/{max ? `${max}次` : '无上限'}</span></div>)}</div>
            </div>
          </Panel>
          <Panel title="直播工具箱"><div className="grid grid-cols-6 max-md:!grid-cols-3 gap-3">{[['挂品预检', Wrench], ['直播预检', Video], ['规则学习', BookOpen], ['用户禁言', Users], ['关键词屏蔽', Shield], ['黄牛防控', AlertTriangle], ['出镜备案', Camera], ['年检任务', CheckCircle2]].map(([t, I]) => { const Icon = I as typeof Shield; return <button key={t as string} onClick={() => { setChecked(true); toast(`${t}：检测通过，未发现风险`) }} className="rounded-lg bg-ink-50 hover:bg-ink-100 p-3 text-center"><Icon className="w-5 h-5 mx-auto text-ink-700" /><div className="text-xs mt-2">{t as string}</div></button> })}</div></Panel>
          <Panel title="规则专区">
            <div className="flex items-center gap-4 text-sm border-b border-ink-100 pb-2 mb-2 overflow-x-auto no-scrollbar">{['直播规则', '治理公告', '内容规范', '商品规范', '系列课程', '政策动态', '机构规则'].map((t, i) => <span key={t} className={cls('whitespace-nowrap', i === 0 ? 'font-semibold text-ink-900' : 'text-ink-500')}>{t}</span>)}</div>
            <ul className="divide-y divide-ink-50">{rules.map(([t, d, n]) => <li key={t} className="py-2.5 flex items-center gap-3 text-sm"><Link to="/seller/live/classroom" className="flex-1 truncate hover:text-brand-500">{t}</Link><span className="text-xs text-ink-400 font-num">{d}</span><span className="text-xs text-ink-400 w-12 text-right">{n}</span></li>)}</ul>
          </Panel>
        </div>
        <div className="space-y-4">
          <div className="card p-4 bg-gradient-to-br from-indigo-50 to-fuchsia-50">
            <div className="flex items-center gap-2 text-sm"><Bot className="w-5 h-5 text-indigo-500" /><span className="text-indigo-600 font-medium">你好!</span> 我是直播合规智能助手！</div>
            <div className="mt-3 flex gap-2">{['违规学习', '风险报告'].map(t => <button key={t} onClick={() => setChat(c => [...c, `${t}：近 30 天无违规记录，安全分 100，继续保持！`])} className="btn-outline btn-sm bg-white">{t}</button>)}</div>
            {chat.length > 0 && <div className="mt-3 space-y-2 text-xs">{chat.map((c, i) => <div key={i} className="rounded-lg bg-white p-2.5">{c}</div>)}</div>}
            <div className="mt-3 flex items-center bg-white rounded-full border border-indigo-200 h-10 pl-4 pr-1"><input value={ai} onChange={e => setAi(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && ai.trim()) { setChat(c => [...c, `问：${ai}`, '答：请参考《直播管理规则》第 3 章，直播中不得宣传绝对化功效；如需人工协助可联系直播客服。']); setAi('') } }} placeholder="有什么问题，请在这里输入吧" className="flex-1 bg-transparent outline-none text-sm" /><button aria-label="发送" onClick={() => { if (ai.trim()) { setChat(c => [...c, `问：${ai}`, '答：请参考《直播管理规则》，如需人工协助可联系直播客服。']); setAi('') } }} className="w-8 h-8 rounded-full bg-indigo-500 text-white flex items-center justify-center"><ChevronRight className="w-4 h-4" /></button></div>
          </div>
          <Panel title={<span>安全码任务 <span className="text-xs font-normal text-ink-500">完成 <span className="text-brand-500">{checked ? 1 : 0}/10</span> 个任务 ›</span></span>} extra={<button onClick={() => toast('任务已刷新')} className="text-xs text-brand-500">刷新任务</button>}>
            <div className="space-y-3">{tasks.map(([n, t, d, p], i) => <div key={i} className={cls('rounded-lg p-3', i === 0 ? 'bg-gradient-to-r from-rose-50 to-orange-50' : 'bg-ink-50')}><div className="flex items-center gap-2 text-sm"><span className="text-amber-600 font-semibold">🪙 {n as number}分抵扣卡</span><span className="font-medium truncate">{t as string}</span>{i === 0 && <span className="ml-auto text-xs text-ink-500 whitespace-nowrap">本月已打卡 <b className="text-brand-500">{checked ? 1 : 0}</b> 天</span>}</div><div className="text-xs text-ink-500 mt-1 line-clamp-2">{d as string}</div><div className="mt-2 flex items-center gap-3"><div className="flex-1 h-1 rounded bg-white overflow-hidden"><div className="h-full bg-brand-500" style={{ width: i === 0 && checked ? '7%' : '0%' }} /></div><span className="text-xs text-ink-500 font-num">{p as string}</span>{i === 0 ? <button onClick={() => setQuiz(true)} className="btn-primary btn-sm">今日合规打卡</button> : <button onClick={() => toast('去完成：演示环境')} className="btn-outline btn-sm bg-white">去完成</button>}</div></div>)}</div>
          </Panel>
        </div>
      </div>
      <Modal open={quiz} onClose={() => setQuiz(false)} title="今日合规学习打卡" width={560}>
        <div className="text-center font-semibold">普通化妆品不可宣传下列哪项功效?</div>
        <div className="mt-4 space-y-2">{['A. 修护', 'B. 保湿', 'C. 防晒', 'D. 控油'].map(o => <button key={o} onClick={() => { setAnswered(o); if (o.startsWith('C')) { setChecked(true); toast('回答正确，获得 0.3 分抵扣卡'); setTimeout(() => setQuiz(false), 800) } else toast('回答错误，再想想', 'error') }} className={cls('w-full text-left rounded-lg px-4 py-3 text-sm border', answered === o ? (o.startsWith('C') ? 'border-emerald-400 bg-emerald-50' : 'border-brand-400 bg-brand-50') : 'border-ink-100 bg-ink-50 hover:bg-ink-100')}>{o}</button>)}</div>
      </Modal>
    </div>
  )
}

export function DigitalHuman() {
  const [list, setList] = useState<{ name: string; voice: string }[]>([])
  const [name, setName] = useState('')
  return (
    <div className="max-w-[1260px]">
      <h1 className="text-xl font-semibold">数字人管理</h1>
      <div className="mt-4 grid grid-cols-[1fr_360px] lg-stack gap-4">
        <Panel title="我的数字人" extra={<span className="text-xs text-ink-500">数字人可在无人值守时段自动讲解货盘商品</span>}>
          {list.length ? <div className="grid grid-cols-3 max-md:!grid-cols-2 gap-3">{list.map((d, i) => <div key={i} className="rounded-xl border border-ink-100 p-4 text-center"><div className="mx-auto w-16 h-16 rounded-full bg-gradient-to-br from-fuchsia-200 to-indigo-200 flex items-center justify-center"><Bot className="w-8 h-8 text-indigo-600" /></div><div className="mt-2 font-medium">{d.name}</div><div className="text-xs text-ink-500">{d.voice}</div><button onClick={() => toast('演示环境：数字人已排期')} className="mt-3 btn-outline btn-sm">安排开播</button></div>)}</div> : <div className="py-10 text-center text-sm text-ink-500"><Bot className="w-10 h-10 mx-auto text-ink-300" /><div className="mt-2">还没有数字人，右侧创建一个吧</div></div>}
        </Panel>
        <Panel title="创建数字人">
          <div className="space-y-3"><input value={name} onChange={e => setName(e.target.value)} placeholder="数字人昵称" className="input-qn" /><select className="input-qn" id="voice"><option>温柔女声</option><option>活力女声</option><option>沉稳男声</option></select><div className="grid grid-cols-3 keep-cols gap-2">{['形象 A', '形象 B', '形象 C'].map(a => <div key={a} className="rounded-lg bg-gradient-to-br from-ink-50 to-ink-100 aspect-[3/4] flex items-end justify-center pb-2 text-xs text-ink-600">{a}</div>)}</div><button onClick={() => { if (!name.trim()) return toast('请输入昵称', 'error'); setList(l => [...l, { name: name.trim(), voice: (document.getElementById('voice') as HTMLSelectElement).value }]); setName(''); toast('数字人已创建（演示）') }} className="btn-primary w-full">创建</button></div>
        </Panel>
      </div>
    </div>
  )
}

export function MultiLive() {
  const [step, setStep] = useState(0)
  return (
    <div className="max-w-[1100px] mx-auto">
      <div className="card p-8 md:p-12 text-center relative overflow-hidden"><div className="absolute -right-10 -top-10 w-64 h-64 rounded-full bg-rose-100/60 blur-3xl" />
        <h1 className="text-2xl md:text-4xl font-black"><span className="text-brand-500">新主播多平台智能开播</span> 火热招募中！</h1>
        <div className="mt-3 text-sm text-ink-600">平台超高流量扶持，更有直通新超星特权</div>
        <div className="mt-10 grid grid-cols-3 max-md:!grid-cols-1 gap-4 text-left">{[['01.', '冷启期', '冷启快人一步', '新开播快速起号！多开专属权益，认证即享5级主播权益，每日开播即享 800PV 流量券！', Zap], ['02.', '成长期', '成长持续加码', '解锁「新星计划」，首月+次月连续扶持，单月最高可拿 200万 PV精准流量，冲榜额圈！', Rocket], ['03.', '冲榜期', '优质商家冲顶', '综合指标达标商家，直通暑期店播打榜赛，额外加码流量+专属权益，抢占类目潜力新商曝光位！', Users]].map(([n, p, t, d, I], i) => { const Icon = I as typeof Zap; return <div key={n as string} className={cls('rounded-xl border p-5 bg-white/80', step > i ? 'border-emerald-300' : 'border-ink-100')}><div className="text-3xl font-black text-ink-200">{n as string}</div><Icon className="w-6 h-6 text-brand-500 mt-2" /><div className="text-xs text-ink-500 mt-3">{p as string}</div><div className="font-semibold text-lg">{t as string}</div><div className="text-xs text-ink-600 mt-2 leading-relaxed">{d as string}</div></div> })}</div>
        <div className="mt-8 text-xs text-ink-400">冷启期权益将结合线上实际表现进行权益优化调整，具体以平台规则为准</div>
        <button onClick={() => { setStep(s => Math.min(3, s + 1)); toast(step >= 2 ? '认证完成，权益已生效' : '认证进度已更新') }} className="mt-5 btn-primary btn-lg px-10">{step >= 3 ? '已认证' : '立即认证'}</button>
      </div>
    </div>
  )
}

