import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { QrCode, ShieldCheck, Store, User, Shield } from 'lucide-react'
import { useDB } from '@/store/db'
import { useSession, toast } from '@/store/session'
import { Logo } from '@/layouts/BuyerLayout'
import { cls } from '@/lib/format'
import type { Role } from '@/data/types'

export default function Login({ register }: { register?: boolean }) {
  const nav = useNavigate()
  const [sp] = useSearchParams()
  const users = useDB(s => s.users)
  const registerUser = useDB(s => s.registerUser)
  const login = useSession(s => s.login)
  const [tab, setTab] = useState<'pwd' | 'sms'>('pwd')
  const [u, setU] = useState('')
  const [p, setP] = useState('')
  const [agree, setAgree] = useState(true)
  const go = (role: Role) => { const dest = sp.get('to') ?? (role === 'admin' ? '/admin' : role === 'seller' ? '/seller' : '/my'); nav(dest) }
  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!agree) return toast('请先同意服务协议', 'error')
    const user = users.find(x => x.username === u.trim() || x.phone === u.trim() || x.email === u.trim())
    if (!user) {
      if (register) {
        if (!u.trim() || !p) return toast('请填写账号和密码', 'error')
        const id = `u-${Date.now().toString(36)}`
        registerUser({ id, username: u.trim(), nickname: u.trim(), avatar: `https://api.dicebear.com/9.x/notionists/svg?seed=${encodeURIComponent(u.trim())}`, role: 'buyer', phone: /^1\d{10}$/.test(u.trim()) ? u.trim() : '', vip: false, level: 1, status: 'active', balance: 1000, coins: 0 })
        login(id, 'buyer'); toast('注册成功，欢迎加入 Plam（已赠送 ¥1000 体验金）'); return go('buyer')
      }
      return toast('账号不存在，可使用下方演示账号', 'error')
    }
    if (user.status === 'frozen') return toast('该账号已被冻结，请联系客服', 'error')
    login(user.id, user.role); toast(`欢迎回来，${user.nickname}`); go(user.role)
  }
  const quick = (id: string, role: Role) => { login(id, role); toast('登录成功'); go(role) }
  return (
    <div className="min-h-screen bg-[#f2f3f5] flex flex-col">
      <div className="container-x py-5"><Logo /></div>
      <div className="flex-1 flex items-center justify-center pb-20">
        <div className="bg-white rounded-2xl shadow-float w-[860px] grid grid-cols-2 overflow-hidden">
          <div className="p-10 flex flex-col items-center justify-center border-r border-ink-100 bg-gradient-to-b from-white to-ink-50">
            <div className="font-semibold text-lg mb-4">手机扫码登录</div>
            <div className="w-44 h-44 bg-white border border-ink-200 rounded-xl flex items-center justify-center relative"><QrCode className="w-36 h-36 text-ink-800" /><span className="absolute w-9 h-9 rounded-lg bg-brand-500 text-white flex items-center justify-center font-black">P</span></div>
            <div className="text-xs text-ink-500 mt-4">打开 Plam APP，点击左上角扫一扫</div>
            <div className="text-xs text-ink-400 mt-10">怎么扫码登录？</div>
          </div>
          <div className="p-10">
            <div className="flex items-center gap-6 mb-6">
              {([['pwd', '密码登录'], ['sms', '短信登录']] as const).map(([k, l]) => <button key={k} onClick={() => setTab(k)} className={cls('text-lg font-semibold relative pb-1', tab === k ? 'text-brand-500' : 'text-ink-700')}>{l}{tab === k && <span className="absolute left-0 right-0 bottom-0 h-0.5 bg-brand-500" />}</button>)}
              <span className="ml-auto text-xs text-ink-400">企业账号登录 ›</span>
            </div>
            <form onSubmit={submit} className="space-y-4">
              <input aria-label="账号" className="input h-11" placeholder={tab === 'pwd' ? '账号名/邮箱/手机号' : '手机号'} value={u} onChange={e => setU(e.target.value)} />
              {tab === 'pwd' ? <input aria-label="密码" type="password" className="input h-11" placeholder="请输入登录密码" value={p} onChange={e => setP(e.target.value)} /> : <div className="flex gap-2"><input aria-label="验证码" className="input h-11" placeholder="短信验证码" /><button type="button" onClick={() => toast('验证码已发送（演示：任意输入）', 'info')} className="btn-outline h-11 whitespace-nowrap">获取验证码</button></div>}
              <button type="submit" className="btn-primary btn-lg w-full text-base">{register ? '注册并登录' : '登录'}</button>
              <div className="flex items-center justify-between text-xs text-ink-500"><span>忘记账号 · 忘记密码</span><Link to={register ? '/login' : '/register'} className="text-brand-500">{register ? '已有账号，去登录' : '免费注册'}</Link></div>
              <label className="flex items-start gap-1.5 text-[11px] text-ink-500"><input type="checkbox" className="accent-brand-500 mt-0.5" checked={agree} onChange={e => setAgree(e.target.checked)} />已阅读并同意以下协议 Plam 平台服务协议、隐私权政策、法律声明、支付宝及客户端服务协议</label>
            </form>
            <div className="mt-6 pt-5 border-t border-ink-100">
              <div className="text-xs text-ink-400 mb-2 flex items-center gap-1"><ShieldCheck className="w-3.5 h-3.5" />演示账号一键登录</div>
              <div className="grid grid-cols-3 gap-2">
                <button onClick={() => quick('u-buyer-1', 'buyer')} className="btn-outline btn-sm"><User className="w-3.5 h-3.5" />买家 xiyan</button>
                <button onClick={() => quick('u-seller-12', 'seller')} className="btn-outline btn-sm"><Store className="w-3.5 h-3.5" />商家 seller12</button>
                <button onClick={() => quick('u-admin-1', 'admin')} className="btn-outline btn-sm"><Shield className="w-3.5 h-3.5" />管理员 admin</button>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="text-center text-xs text-ink-400 pb-6">© 2026 Plam Mall · 演示站点</div>
    </div>
  )
}
