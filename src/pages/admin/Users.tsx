import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Download, Lock, Unlock, Eye, Store, Users as UsersIcon, Check, X } from 'lucide-react'
import { useDB } from '@/store/db'
import { Avatar, Modal, PageHeader, SearchInput, Select, Stat, Table, Tabs, Confirm, type Column } from '@/components/ui'
import { compact, fmtDate, money } from '@/lib/format'
import { toast } from '@/store/session'
import type { Shop, User } from '@/data/types'

export function Users() {
  const [sp] = useSearchParams()
  const { users, orders, updateUser, log } = useDB()
  const [tab, setTab] = useState(sp.get('tab') ?? 'all')
  const [q, setQ] = useState('')
  const [role, setRole] = useState('')
  const [sel, setSel] = useState<string[]>([])
  const [detail, setDetail] = useState<User | null>(null)
  const [freeze, setFreeze] = useState<User | null>(null)
  const list = useMemo(() => users.filter(u => (tab === 'all' || (tab === 'frozen' ? u.status === 'frozen' : tab === 'vip' ? u.vip : u.role === tab)) && (!role || u.role === role) && (!q || u.username.includes(q) || u.nickname.includes(q) || u.phone.includes(q) || u.id.includes(q))), [users, tab, q, role])
  const cols: Column<User>[] = [
    { key: 'u', title: '用户', render: u => <div className="flex items-center gap-2"><Avatar src={u.avatar} name="" size={32} /><div><div className="font-medium flex items-center gap-1">{u.nickname}{u.vip && <span className="tag-gold">88VIP</span>}</div><div className="text-xs text-ink-400">{u.username} · {u.id}</div></div></div> },
    { key: 'role', title: '角色', render: u => <span className={u.role === 'admin' ? 'tag-red' : u.role === 'seller' ? 'tag-blue' : 'tag-gray'}>{{ buyer: '买家', seller: '商家', admin: '管理员' }[u.role]}</span> },
    { key: 'phone', title: '手机', render: u => <span className="font-num">{u.phone}</span> },
    { key: 'level', title: '等级', render: u => `LV${u.level}` },
    { key: 'balance', title: '余额', render: u => <span className="font-num">¥{money(u.balance)}</span> },
    { key: 'orders', title: '订单数', render: u => <span className="font-num">{orders.filter(o => o.userId === u.id).length}</span> },
    { key: 'createdAt', title: '注册时间', render: u => <span className="text-xs">{fmtDate(u.createdAt, false)}</span> },
    { key: 'status', title: '状态', render: u => u.status === 'active' ? <span className="tag-green">正常</span> : <span className="tag-red">已冻结</span> },
    { key: 'op', title: '操作', render: u => <div className="flex gap-2 text-xs"><button onClick={() => setDetail(u)} className="link flex items-center gap-0.5"><Eye className="w-3 h-3" />详情</button>{u.role !== 'admin' && (u.status === 'active' ? <button onClick={() => setFreeze(u)} className="link text-red-500 flex items-center gap-0.5"><Lock className="w-3 h-3" />冻结</button> : <button onClick={() => { updateUser(u.id, { status: 'active' }); log('admin', '解冻用户', u.id); toast('已解冻') }} className="link text-emerald-600 flex items-center gap-0.5"><Unlock className="w-3 h-3" />解冻</button>)}</div> },
  ]
  return (
    <div>
      <PageHeader title="用户管理" desc="买家、商家与管理员账号的统一管理。" extra={<button onClick={() => toast(`已导出 ${list.length} 条用户`)} className="btn-outline"><Download className="w-4 h-4" />导出</button>} />
      <div className="grid grid-cols-4 gap-3 mb-4"><Stat label="用户总数" value={compact(users.length * 1283)} /><Stat label="今日新增" value={128} accent="text-emerald-600" /><Stat label="88VIP 会员" value={compact(users.filter(u => u.vip).length * 412)} /><Stat label="冻结账号" value={users.filter(u => u.status === 'frozen').length} accent="text-red-500" /></div>
      <div className="card">
        <div className="px-5"><Tabs items={[{ key: 'all', label: '全部' }, { key: 'buyer', label: '买家' }, { key: 'seller', label: '商家' }, { key: 'admin', label: '管理员' }, { key: 'vip', label: '88VIP' }, { key: 'frozen', label: '已冻结', count: users.filter(u => u.status === 'frozen').length }]} value={tab} onChange={setTab} accent="qn" /></div>
        <div className="px-5 py-3 flex gap-2 items-center"><SearchInput value={q} onChange={setQ} placeholder="用户名 / 昵称 / 手机 / ID" className="w-72" /><Select value={role} onChange={setRole} options={[{ value: '', label: '全部角色' }, { value: 'buyer', label: '买家' }, { value: 'seller', label: '商家' }, { value: 'admin', label: '管理员' }]} />{sel.length > 0 && <span className="text-sm text-ink-500 ml-auto">已选 {sel.length} <button onClick={() => { sel.forEach(id => updateUser(id, { status: 'frozen' })); toast('已批量冻结'); setSel([]) }} className="link ml-2 text-red-500">批量冻结</button></span>}</div>
        <div className="px-5 pb-5"><Table columns={cols} data={list} selectable selected={sel} onSelect={setSel} pageSize={12} /></div>
      </div>
      <Modal open={!!detail} onClose={() => setDetail(null)} title="用户详情" width={640}>{detail && <div><div className="flex items-center gap-4"><Avatar src={detail.avatar} name="" size={64} /><div><div className="text-lg font-semibold">{detail.nickname}</div><div className="text-sm text-ink-500">{detail.username} · {detail.email ?? '未绑定邮箱'} · {detail.phone}</div></div></div><div className="grid grid-cols-4 gap-3 mt-5"><Stat label="余额" value={`¥${money(detail.balance)}`} /><Stat label="淘金币" value={detail.coins} /><Stat label="订单" value={orders.filter(o => o.userId === detail.id).length} /><Stat label="消费总额" value={`¥${money(orders.filter(o => o.userId === detail.id && o.status !== 'unpaid' && o.status !== 'closed').reduce((a, o) => a + o.payAmount, 0), 0)}`} /></div><div className="mt-5 text-sm font-semibold mb-2">最近订单</div><table className="w-full text-sm"><tbody>{orders.filter(o => o.userId === detail.id).slice(0, 5).map(o => <tr key={o.id} className="border-b border-ink-100"><td className="py-2 font-num text-xs">{o.id}</td><td className="py-2 truncate max-w-[260px]">{o.items[0].title}</td><td className="py-2 font-num">¥{money(o.payAmount)}</td><td className="py-2 text-xs text-ink-400">{fmtDate(o.createdAt, false)}</td></tr>)}</tbody></table></div>}</Modal>
      <Confirm open={!!freeze} onClose={() => setFreeze(null)} onOk={() => { updateUser(freeze!.id, { status: 'frozen' }); log('admin', '冻结用户', freeze!.id); toast('已冻结该账号') }} title={`冻结用户 ${freeze?.nickname}？`} desc="冻结后用户无法登录与下单，可随时解冻" danger />
    </div>
  )
}

export function Shops() {
  const [sp] = useSearchParams()
  const { shops, users, orders, products, updateShop, log } = useDB()
  const [tab, setTab] = useState(sp.get('tab') ?? 'all')
  const [q, setQ] = useState('')
  const [detail, setDetail] = useState<Shop | null>(null)
  const list = useMemo(() => shops.filter(s => (tab === 'all' || s.status === tab || (tab === 'tmall' && s.type === 'tmall')) && (!q || s.name.includes(q) || s.id.includes(q))), [shops, tab, q])
  const gmvOf = (id: string) => orders.filter(o => o.shopId === id && o.status !== 'unpaid' && o.status !== 'closed').reduce((a, o) => a + o.payAmount, 0)
  const cols: Column<Shop>[] = [
    { key: 's', title: '店铺', render: s => <div className="flex items-center gap-2"><Avatar src={s.logo} name="" size={36} /><div><div className="font-medium flex items-center gap-1">{s.name}{s.type === 'tmall' && <span className="tag bg-brand-500 text-white">天猫</span>}</div><div className="text-xs text-ink-400">{s.id} · 店主 {users.find(u => u.id === s.ownerId)?.username}</div></div></div> },
    { key: 'level', title: '等级', render: s => `L${s.level}` },
    { key: 'score', title: '体验分', render: s => <span className="font-num">{((s.score.desc + s.score.service + s.score.logistics) / 3 * 20).toFixed(1)}</span> },
    { key: 'products', title: '商品数', render: s => <span className="font-num">{products.filter(p => p.shopId === s.id).length}</span> },
    { key: 'gmv', title: 'GMV', render: s => <span className="font-num">¥{money(gmvOf(s.id), 0)}</span> },
    { key: 'deposit', title: '保证金', render: s => <span className="font-num">¥{money(s.deposit, 0)}</span> },
    { key: 'fans', title: '粉丝', render: s => compact(s.fans) },
    { key: 'status', title: '状态', render: s => s.status === 'open' ? <span className="tag-green">营业中</span> : s.status === 'pending' ? <span className="tag-gold">待审核</span> : <span className="tag-red">已关闭</span> },
    { key: 'op', title: '操作', render: s => <div className="flex gap-2 text-xs">{s.status === 'pending' ? <><button onClick={() => { updateShop(s.id, { status: 'open' }); log('admin', '审核通过商家', s.id); toast('已通过入驻审核') }} className="btn-qn btn-sm"><Check className="w-3 h-3" />通过</button><button onClick={() => { updateShop(s.id, { status: 'closed' }); toast('已驳回') }} className="btn-outline btn-sm"><X className="w-3 h-3" />驳回</button></> : <><button onClick={() => setDetail(s)} className="link">详情</button><Link to={`/shop/${s.id}`} className="link">前台</Link>{s.status === 'open' ? <button onClick={() => { updateShop(s.id, { status: 'closed' }); log('admin', '关闭店铺', s.id); toast('已关闭店铺') }} className="link text-red-500">关店</button> : <button onClick={() => { updateShop(s.id, { status: 'open' }); toast('已恢复营业') }} className="link text-emerald-600">恢复</button>}</>}</div> },
  ]
  return (
    <div>
      <PageHeader title="商家管理" desc="商家入驻审核、店铺状态与经营数据。" />
      <div className="grid grid-cols-4 gap-3 mb-4"><Stat label="商家总数" value={shops.length} /><Stat label="天猫旗舰店" value={shops.filter(s => s.type === 'tmall').length} /><Stat label="待审核" value={shops.filter(s => s.status === 'pending').length} accent="text-amber-600" /><Stat label="保证金总额" value={`¥${money(shops.reduce((a, s) => a + s.deposit, 0), 0)}`} /></div>
      <div className="card"><div className="px-5"><Tabs items={[{ key: 'all', label: '全部' }, { key: 'open', label: '营业中' }, { key: 'pending', label: '待审核', count: shops.filter(s => s.status === 'pending').length }, { key: 'closed', label: '已关闭' }, { key: 'tmall', label: '天猫' }]} value={tab} onChange={setTab} accent="qn" /></div><div className="px-5 py-3"><SearchInput value={q} onChange={setQ} placeholder="店铺名 / ID" className="w-72" /></div><div className="px-5 pb-5"><Table columns={cols} data={list} /></div></div>
      <Modal open={!!detail} onClose={() => setDetail(null)} title="店铺详情" width={640}>{detail && <div><div className="flex items-center gap-4"><Avatar src={detail.logo} name="" size={64} /><div><div className="text-lg font-semibold">{detail.name}</div><div className="text-sm text-ink-500">{detail.address} · 开店于 {fmtDate(detail.createdAt, false)}</div></div></div><div className="grid grid-cols-3 gap-3 mt-5"><Stat label="描述" value={detail.score.desc.toFixed(2)} /><Stat label="服务" value={detail.score.service.toFixed(2)} /><Stat label="物流" value={detail.score.logistics.toFixed(2)} /></div><p className="text-sm text-ink-600 mt-4">{detail.description}</p><div className="hidden"><Store /><UsersIcon /></div></div>}</Modal>
    </div>
  )
}
