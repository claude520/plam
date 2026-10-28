// 收银台：余额 / Apple Pay / Google Pay / PayOS（越南 VietQR）
import { useCallback, useEffect, useRef, useState } from 'react'
import { Check, ExternalLink, Loader2, Wallet, Smartphone, RefreshCw } from 'lucide-react'
import QRCode from 'qrcode'
import { useDB } from '@/store/db'
import { sync } from '@/store/sync'
import { useCurrentUser } from '@/lib/hooks'
import { cls, money } from '@/lib/format'
import type { Order } from '@/data/types'

interface Channels { payos: { configured: boolean }; applepay: { configured: boolean }; googlepay: { configured: boolean; merchantId: string; environment: 'TEST' | 'PRODUCTION' } }
type GPayClient = { isReadyToPay: (r: unknown) => Promise<{ result: boolean }>; loadPaymentData: (r: unknown) => Promise<unknown>; createButton: (o: Record<string, unknown>) => HTMLElement }
type W = Window & { ApplePaySession?: { new (v: number, req: unknown): ApplePaySessionLike; canMakePayments: () => boolean; STATUS_SUCCESS: number; STATUS_FAILURE: number }; google?: { payments: { api: { PaymentsClient: new (o: unknown) => GPayClient } } } }
interface ApplePaySessionLike { onvalidatemerchant: (e: { validationURL: string }) => void; onpaymentauthorized: (e: { payment: { token: unknown } }) => void; oncancel: () => void; completeMerchantValidation: (m: unknown) => void; completePayment: (s: number) => void; abort: () => void; begin: () => void }

const post = async <T,>(url: string, body: unknown): Promise<{ ok: boolean; status: number; data: T }> => {
  const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
  return { ok: r.ok, status: r.status, data: (await r.json().catch(() => ({}))) as T }
}
let gpayScript: Promise<void> | null = null
const loadGPay = () => gpayScript ??= new Promise((res, rej) => { const s = document.createElement('script'); s.src = 'https://pay.google.com/gp/p/js/pay.js'; s.async = true; s.onload = () => res(); s.onerror = () => { gpayScript = null; rej(new Error('Google Pay 脚本加载失败')) }; document.head.appendChild(s) })

const LOGO: Record<string, React.ReactNode> = {
  balance: <Wallet className="w-5 h-5" />,
  applepay: <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor" aria-hidden><path d="M16.37 12.6c-.02-2.18 1.78-3.23 1.86-3.28-1.02-1.49-2.6-1.69-3.15-1.71-1.34-.14-2.62.79-3.3.79-.68 0-1.73-.77-2.84-.75-1.46.02-2.81.85-3.56 2.16-1.52 2.63-.39 6.52 1.09 8.66.72 1.04 1.58 2.21 2.71 2.17 1.09-.04 1.5-.7 2.82-.7 1.31 0 1.68.7 2.83.68 1.17-.02 1.91-1.06 2.63-2.11.83-1.21 1.17-2.38 1.19-2.44-.03-.01-2.27-.87-2.29-3.47zM14.2 6.2c.6-.73 1-1.73.89-2.74-.86.03-1.91.58-2.53 1.3-.55.64-1.04 1.67-.91 2.65.96.07 1.95-.49 2.55-1.21z" /></svg>,
  googlepay: <span className="font-bold text-[15px]">G</span>,
  payos: <span className="font-bold text-[13px]">pay<span className="opacity-80">OS</span></span>,
}

export function PayBox({ order, onPaid, initialProvider, autoPoll }: { order: Order; onPaid: (provider: string) => void; initialProvider?: string; autoPoll?: boolean }) {
  const all = useDB(s => s.paymentProviders)
  const remote = useDB(s => s._remote)
  const providers = all.filter(p => p.enabled)
  const user = useCurrentUser()
  const payOrder = useDB(s => s.payOrder)
  const [provider, setProvider] = useState(initialProvider && providers.some(p => p.code === initialProvider) ? initialProvider : providers[0]?.code ?? 'balance')
  const [ch, setCh] = useState<Channels | null>(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ type: 'info' | 'error'; text: string } | null>(null)
  const [payos, setPayos] = useState<null | { demo?: boolean; amount: number; qr?: string; checkoutUrl?: string; accountNumber?: string; accountName?: string }>(null)
  const [polling, setPolling] = useState(!!autoPoll)
  const gpayRef = useRef<HTMLDivElement>(null)
  const done = useRef(false)

  useEffect(() => { if (remote) fetch('/api/pay/channels').then(r => r.json()).then(setCh).catch(() => setCh(null)) }, [remote])
  useEffect(() => { setMsg(null); setPayos(null) }, [provider])

  const finish = useCallback(async (p: string) => {
    if (done.current) return
    done.current = true
    await sync.refresh()
    onPaid(p)
  }, [onPaid])

  // ---------- 余额 ----------
  const payBalance = () => {
    if (!user) return
    if (user.balance < order.payAmount) return setMsg({ type: 'error', text: `余额不足（可用 ¥${money(user.balance)}），请选择其他支付方式` })
    payOrder(order.id, 'balance') // reducer 内扣减余额
    done.current = true
    onPaid('balance')
  }

  // ---------- Apple Pay ----------
  const W = window as W
  const appleAvailable = !!W.ApplePaySession && (() => { try { return W.ApplePaySession!.canMakePayments() } catch { return false } })()
  const payApple = async (demo = false) => {
    if (demo || !appleAvailable || !ch?.applepay.configured) {
      setBusy(true)
      const r = await post<{ ok: boolean }>('/api/pay/applepay/confirm', { orderId: order.id })
      setBusy(false)
      if (r.ok && r.data.ok) finish('applepay'); else setMsg({ type: 'error', text: '支付失败，请重试' })
      return
    }
    const AP = W.ApplePaySession!
    const session = new AP(3, { countryCode: 'CN', currencyCode: 'CNY', supportedNetworks: ['visa', 'masterCard', 'amex', 'chinaUnionPay', 'jcb'], merchantCapabilities: ['supports3DS'], total: { label: 'Plam', amount: order.payAmount.toFixed(2) } })
    session.onvalidatemerchant = async e => {
      const r = await post<unknown>('/api/pay/applepay/validate', { validationURL: e.validationURL })
      if (r.ok) session.completeMerchantValidation(r.data)
      else { session.abort(); setMsg({ type: 'error', text: '商户验证失败，请联系平台' }) }
    }
    session.onpaymentauthorized = async e => {
      const r = await post<{ ok: boolean }>('/api/pay/applepay/confirm', { orderId: order.id, token: e.payment.token })
      session.completePayment(r.ok && r.data.ok ? AP.STATUS_SUCCESS : AP.STATUS_FAILURE)
      if (r.ok && r.data.ok) finish('applepay')
    }
    session.oncancel = () => setMsg({ type: 'info', text: '已取消 Apple Pay 支付' })
    session.begin()
  }

  // ---------- Google Pay ----------
  useEffect(() => {
    if (provider !== 'googlepay' || !ch || !gpayRef.current) return
    let cancelled = false
    const env = ch.googlepay.environment
    const card = { type: 'CARD', parameters: { allowedAuthMethods: ['PAN_ONLY', 'CRYPTOGRAM_3DS'], allowedCardNetworks: ['VISA', 'MASTERCARD', 'AMEX', 'JCB', 'DISCOVER'] }, tokenizationSpecification: { type: 'PAYMENT_GATEWAY', parameters: { gateway: 'example', gatewayMerchantId: 'exampleGatewayMerchantId' } } }
    const base = { apiVersion: 2, apiVersionMinor: 0 }
    loadGPay().then(async () => {
      if (cancelled || !W.google) return
      const client = new W.google.payments.api.PaymentsClient({ environment: env })
      const ready = await client.isReadyToPay({ ...base, allowedPaymentMethods: [{ type: 'CARD', parameters: card.parameters }] }).catch(() => ({ result: false }))
      if (cancelled || !gpayRef.current) return
      gpayRef.current.innerHTML = ''
      if (!ready.result) { setMsg({ type: 'info', text: '当前浏览器未登录 Google 账号或不支持 Google Pay，请在 Chrome / Android 上使用' }); return }
      const btn = client.createButton({
        buttonColor: 'black', buttonType: 'pay', buttonSizeMode: 'fill', buttonLocale: 'zh',
        onClick: async () => {
          try {
            const data = await client.loadPaymentData({ ...base, allowedPaymentMethods: [card], merchantInfo: { merchantName: 'Plam', ...(ch.googlepay.merchantId ? { merchantId: ch.googlepay.merchantId } : {}) }, transactionInfo: { totalPriceStatus: 'FINAL', totalPrice: order.payAmount.toFixed(2), currencyCode: 'CNY', countryCode: 'CN' } })
            setBusy(true)
            const r = await post<{ ok: boolean }>('/api/pay/googlepay/confirm', { orderId: order.id, paymentData: data })
            setBusy(false)
            if (r.ok && r.data.ok) finish('googlepay'); else setMsg({ type: 'error', text: '支付确认失败，请重试' })
          } catch (e) { const err = e as { statusCode?: string }; if (err.statusCode !== 'CANCELED') setMsg({ type: 'error', text: 'Google Pay 支付未完成' }) }
        },
      })
      gpayRef.current.appendChild(btn)
    }).catch(err => setMsg({ type: 'error', text: (err as Error).message }))
    return () => { cancelled = true }
  }, [provider, ch, order.id, order.payAmount, finish]) // eslint-disable-line

  // ---------- PayOS ----------
  const startPayos = async () => {
    setBusy(true); setMsg(null)
    try {
      const r = await post<{ demo?: boolean; amount: number; qrCode?: string; checkoutUrl?: string; accountNumber?: string; accountName?: string; paid?: boolean; error?: string }>('/api/pay/payos/create', { orderId: order.id })
      if (r.data.paid) return finish('payos')
      if (!r.ok) { setMsg({ type: 'error', text: r.data.error ?? 'PayOS 下单失败' }); return }
      const qr = r.data.qrCode ? await QRCode.toDataURL(r.data.qrCode, { margin: 1, width: 240 }) : undefined
      setPayos({ demo: r.data.demo, amount: r.data.amount, qr, checkoutUrl: r.data.checkoutUrl, accountNumber: r.data.accountNumber, accountName: r.data.accountName })
      if (!r.data.demo) setPolling(true)
    } catch { setMsg({ type: 'error', text: '网络异常，请重试' }) } finally { setBusy(false) }
  }
  useEffect(() => {
    if (!polling || provider !== 'payos') return
    const t = setInterval(async () => {
      const r = await fetch(`/api/pay/payos/status?orderId=${order.id}`).then(x => x.json()).catch(() => null) as { status?: string } | null
      if (r?.status === 'PAID') { clearInterval(t); finish('payos') }
      else if (r?.status === 'CANCELLED' || r?.status === 'EXPIRED') { clearInterval(t); setPolling(false); setPayos(null); setMsg({ type: 'info', text: r.status === 'EXPIRED' ? '支付链接已过期，请重新发起' : '已取消支付' }) }
    }, 3000)
    return () => clearInterval(t)
  }, [polling, provider, order.id, finish])
  const payosDemo = async () => { setBusy(true); const r = await post<{ ok: boolean }>('/api/pay/payos/demo', { orderId: order.id }); setBusy(false); if (r.ok && r.data.ok) finish('payos'); else setMsg({ type: 'error', text: '模拟支付失败' }) }

  // 无后端（纯前端模式）：外部渠道走本地模拟
  const localDemo = () => { payOrder(order.id, provider); done.current = true; onPaid(provider) }
  const demoTag = <span className="tag-gold ml-1">演示</span>

  return (
    <div>
      <div className="font-semibold mb-3">选择支付方式</div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {providers.map(p => (
          <button key={p.id} onClick={() => setProvider(p.code)} className={cls('flex items-center gap-3 rounded-xl border-2 p-4 text-left transition', provider === p.code ? 'border-brand-500 bg-brand-50/40' : 'border-ink-200 hover:border-ink-300')}>
            <span className="w-10 h-10 rounded-lg flex items-center justify-center text-white shrink-0" style={{ background: p.logoColor }}>{LOGO[p.code] ?? p.name.slice(0, 1)}</span>
            <div className="min-w-0"><div className="font-medium flex items-center">{p.name}{remote && ch && ((p.code === 'payos' && !ch.payos.configured) || (p.code === 'applepay' && !ch.applepay.configured) || (p.code === 'googlepay' && !ch.googlepay.merchantId)) && <span className="tag-gray ml-1.5 text-[10px]">{p.code === 'googlepay' ? 'TEST' : '演示'}</span>}</div><div className="text-xs text-ink-500 truncate">{p.code === 'balance' ? `可用余额 ¥${money(user?.balance ?? 0)}` : p.desc}</div></div>
            {provider === p.code && <Check className="w-5 h-5 text-brand-500 ml-auto shrink-0" />}
          </button>
        ))}
      </div>

      <div className="mt-5">
        {msg && <div className={cls('mb-3 rounded-lg px-3 py-2 text-sm', msg.type === 'error' ? 'bg-red-50 text-red-600' : 'bg-qn-50 text-qn-700')}>{msg.text}</div>}

        {provider === 'balance' && <button onClick={payBalance} className="btn-primary btn-lg px-10">确认付款 ¥{money(order.payAmount)}</button>}

        {provider !== 'balance' && !remote && <div className="rounded-xl border border-dashed border-ink-300 p-5 bg-ink-50 text-sm text-ink-600">当前为纯前端演示模式（未连接服务端），无法调用真实支付接口。<div className="mt-3"><button onClick={localDemo} className="btn-primary">模拟支付成功</button></div></div>}

        {remote && provider === 'applepay' && (
          <div className="rounded-xl border border-ink-200 p-5">
            {appleAvailable && ch?.applepay.configured
              ? <button onClick={() => payApple()} className="w-full sm:w-72 h-12 rounded-lg bg-black text-white flex items-center justify-center gap-1.5 text-lg" aria-label="Apple Pay">{LOGO.applepay}<span className="font-medium">Pay</span></button>
              : <div className="text-sm text-ink-600 space-y-3">
                  <div className="flex items-start gap-2"><Smartphone className="w-4 h-4 mt-0.5 text-ink-400" /><span>{appleAvailable ? 'Apple Pay 商户证书尚未在平台配置，当前为演示模式。' : 'Apple Pay 需在 iPhone / iPad / Mac 的 Safari 中使用，并已在钱包中添加银行卡。'}{!ch?.applepay.configured && ' 管理员在「支付渠道」配置商户 ID 与证书后即可真实收款。'}</span></div>
                  {!ch?.applepay.configured && <button disabled={busy} onClick={() => payApple(true)} className="h-11 px-6 rounded-lg bg-black text-white inline-flex items-center gap-1.5">{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : LOGO.applepay}模拟 Apple Pay 支付{demoTag}</button>}
                </div>}
          </div>
        )}

        {remote && provider === 'googlepay' && (
          <div className="rounded-xl border border-ink-200 p-5">
            <div ref={gpayRef} className="w-full sm:w-72 h-12">{!ch && <Loader2 className="w-5 h-5 animate-spin text-ink-400" />}</div>
            {busy && <div className="text-xs text-ink-500 mt-2 flex items-center gap-1"><Loader2 className="w-3.5 h-3.5 animate-spin" />正在确认支付…</div>}
            {ch && !ch.googlepay.merchantId && <div className="text-xs text-ink-500 mt-3">当前为 Google Pay <b>TEST</b> 环境：会弹出真实的 Google Pay 窗口，但使用测试卡、不会扣款。管理员在「支付渠道」填写 Google Pay 商户 ID 后切换为正式环境。</div>}
          </div>
        )}

        {remote && provider === 'payos' && (
          <div className="rounded-xl border border-ink-200 p-5">
            {!payos && !polling && <div className="flex flex-wrap items-center gap-3"><button disabled={busy} onClick={startPayos} className="btn h-11 px-6 text-white" style={{ background: '#0a5edc' }}>{busy && <Loader2 className="w-4 h-4 animate-spin" />}使用 PayOS 付款</button><span className="text-xs text-ink-500">支持越南各大银行 App 扫 VietQR 付款，按 VND 结算</span></div>}
            {polling && !payos && <div className="text-sm text-ink-600 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin text-qn-500" />正在确认 PayOS 到账结果…<button onClick={startPayos} className="link text-xs">重新发起</button></div>}
            {payos && (
              <div className="flex flex-col sm:flex-row gap-5 items-start">
                <div className="w-44 h-44 rounded-xl border border-ink-200 bg-white flex items-center justify-center overflow-hidden shrink-0">
                  {payos.qr ? <img src={payos.qr} alt="VietQR" className="w-full h-full" /> : <div className="text-center text-xs text-ink-400 px-3">演示模式<br />配置 PayOS 密钥后<br />此处显示真实 VietQR</div>}
                </div>
                <div className="text-sm text-ink-700 space-y-1.5">
                  <div className="font-semibold text-ink-900">请用越南银行 App 扫码支付{payos.demo && demoTag}</div>
                  <div>应付金额：<b className="font-num text-lg text-brand-600">{payos.amount.toLocaleString('vi-VN')} ₫</b><span className="text-xs text-ink-400 ml-2">（¥{money(order.payAmount)}）</span></div>
                  {payos.accountNumber && <div className="text-xs text-ink-500">收款账户：{payos.accountName} · {payos.accountNumber}</div>}
                  {payos.checkoutUrl && <a href={payos.checkoutUrl} target="_blank" rel="noreferrer" className="link inline-flex items-center gap-1 text-sm">打开 PayOS 支付页<ExternalLink className="w-3.5 h-3.5" /></a>}
                  {!payos.demo && <div className="text-xs text-ink-500 flex items-center gap-1.5 pt-1"><RefreshCw className="w-3.5 h-3.5 animate-spin" />付款后自动确认，无需刷新</div>}
                  {payos.demo && <div className="pt-2"><button disabled={busy} onClick={payosDemo} className="btn-primary">{busy && <Loader2 className="w-4 h-4 animate-spin" />}模拟银行到账</button><div className="text-xs text-ink-400 mt-1.5">PayOS 的 Client ID / API Key / Checksum Key 未配置，当前为演示模式。</div></div>}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
