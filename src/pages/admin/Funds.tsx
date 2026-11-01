// 资金中心：担保交易资金概览、资金流水、商家结算明细、提现审核、人工调账
import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Download, Check, X, Landmark, Wallet, ShieldCheck, ArrowDownToLine } from 'lucide-react'
import { useDB } from '@/store/db'
import { useCurrentUser } from '@/lib/hooks'
import { Avatar, Modal, PageHeader, SearchInput, Select, Stat, Table, Tabs, Field, type Column } from '@/components/ui'
import { cls, fmtDate, money } from '@/lib/format'
import { toast } from '@/store/session'
import { TrendArea, days } from '@/components/Charts'
import type { LedgerEntry, LedgerType, Order, Withdrawal } from '@/data/types'

/** 担保中：已付款、尚未结算、仍在履约（待发货 / 已发货 / 售后中）的订单 */
export const inEscrow = (o: Order) => !!o.paidAt && !o.settledAt && (o.status === 'paid' || o.status === 'shipped' || o.status === 'refunding')

export const LEDGER_TYPE: Record<LedgerType, { l: string; c: string; sign: 1 | -1 }> = {
  escrow: { l: '买家付款（进入担保）', c: 'tag-blue', sign: 1 },
  settle: { l: '货款结算', c: 'tag-green', sign: -1 },
  commission: { l: '平台佣金', c: 'tag-red', sign: 1 },
  refund: { l: '退款', c: 'tag-gold', sign: -1 },
  withdraw: { l: '提现打款', c: 'tag-gray', sign: -1 },
  adjust: { l: '人工调账', c: 'tag-gray', sign: -1 },
}

/** CSV 导出（Excel 可直接打开，带 BOM） */
export function downloadCsv(name: string, rows: (string | number)[][]) {
  const csv = '﻿' + rows.map(r => r.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n')
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  a.download = name
  a.click()
  URL.revokeObjectURL(a.href)
}

export function Funds() {
  const [sp, setSp] = useSearchParams()
  const tab = sp.get('tab') ?? 'overview'
  const { orders, ledger, withdrawals, shops, users, settings } = useDB()
  const pendingW = withdrawals.filter(w => w.status === 'pending')
  // 担保中：已付款、未结算、未关闭的订单
  const escrow = orders.filter(inEscrow)
  const sum = (t: LedgerType, from = 0) => ledger.filter(e => e.type === t && Date.parse(e.at) >= from).reduce((a, e) => a + e.amount, 0)
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const sellerFunds = users.filter(u => u.role === 'seller').reduce((a, u) => a + u.balance, 0)
  return (
    <div>
      <PageHeader title="资金中心" desc="担保交易：买家付款先进入平台担保账户，买家确认收货（或超时自动确认）后扣除佣金结算给商家，商家申请提现经财务审核后打款。" />
      <div className="grid grid-cols-5 max-md:!grid-cols-2 gap-3 mb-4">
        <Stat label="担保中资金" value={`¥${money(escrow.reduce((a, o) => a + o.payAmount, 0), 0)}`} sub={`${escrow.length} 笔订单`} accent="text-qn-600" />
        <Stat label="今日结算给商家" value={`¥${money(sum('settle', today.getTime()), 0)}`} accent="text-emerald-700" />
        <Stat label="佣金收入（累计）" value={`¥${money(sum('commission'), 0)}`} sub={`费率 ${settings.commissionRate}%`} accent="text-brand-500" />
        <Stat label="商家可提现余额" value={`¥${money(sellerFunds, 0)}`} />
        <Stat label="待审核提现" value={pendingW.length} sub={`¥${money(pendingW.reduce((a, w) => a + w.amount, 0))}`} accent={pendingW.length ? 'text-red-600' : undefined} onClick={() => setSp({ tab: 'withdraw' })} />
      </div>
      <div className="card">
        <div className="px-5"><Tabs items={[{ key: 'overview', label: '资金概览' }, { key: 'ledger', label: '资金流水', count: ledger.length }, { key: 'settle', label: '结算明细' }, { key: 'withdraw', label: '提现审核', count: pendingW.length }]} value={tab} onChange={k => setSp({ tab: k })} accent="qn" /></div>
        {tab === 'overview' && <Overview />}
        {tab === 'ledger' && <Ledger />}
        {tab === 'settle' && <SettleDetail />}
        {tab === 'withdraw' && <Withdrawals />}
      </div>
      <div className="hidden">{shops.length}</div>
    </div>
  )
}

function Overview() {
  const { ledger, orders } = useDB()
  const trend = useMemo(() => days(14, i => {
    const d = new Date(Date.now() - (13 - i) * 864e5).toDateString()
    const on = (t: LedgerType) => Math.round(ledger.filter(e => e.type === t && new Date(e.at).toDateString() === d).reduce((a, e) => a + e.amount, 0))
    return { 付款进入担保: on('escrow'), 结算给商家: on('settle'), 退款: on('refund'), 佣金: on('commission') }
  }), [ledger])
  const flow = [
    ['买家付款', '进入平台担保账户，商家看得到订单但拿不到钱'],
    ['商家发货', '买家收货确认，或发货后超时自动确认'],
    ['自动结算', '扣除平台佣金后打入商家余额，生成结算流水'],
    ['商家提现', '提交提现申请，余额转为提现中'],
    ['财务审核', '审核通过打款至商家银行账户；驳回退回余额'],
  ]
  return (
    <div className="p-5 space-y-5">
      <div className="grid grid-cols-5 max-md:!grid-cols-1 gap-2">{flow.map(([t, d], i) => <div key={t} className="rounded-xl bg-ink-50 p-3 relative"><div className="text-xs text-qn-600 font-num">STEP {i + 1}</div><div className="font-medium mt-0.5">{t}</div><div className="text-xs text-ink-500 mt-1">{d}</div></div>)}</div>
      <div><div className="font-semibold mb-2">近 14 天资金流向</div><TrendArea data={trend} keys={['付款进入担保', '结算给商家', '退款', '佣金']} height={260} /></div>
      <div className="grid grid-cols-3 max-md:!grid-cols-1 gap-3 text-sm">
        <div className="rounded-xl border border-ink-100 p-4"><div className="text-ink-500 text-xs">待发货（担保中）</div><div className="font-num text-xl mt-1">{orders.filter(o => o.status === 'paid' && !o.settledAt).length} 笔</div></div>
        <div className="rounded-xl border border-ink-100 p-4"><div className="text-ink-500 text-xs">已发货待收货（担保中）</div><div className="font-num text-xl mt-1">{orders.filter(o => o.status === 'shipped' && !o.settledAt).length} 笔</div></div>
        <div className="rounded-xl border border-ink-100 p-4"><div className="text-ink-500 text-xs">售后中（暂停结算）</div><div className="font-num text-xl mt-1">{orders.filter(o => o.status === 'refunding').length} 笔</div></div>
      </div>
    </div>
  )
}

function Ledger() {
  const { ledger, shops, users } = useDB()
  const [type, setType] = useState('')
  const [q, setQ] = useState('')
  const list = useMemo(() => ledger.filter(e => (!type || e.type === type) && (!q || e.orderId?.includes(q) || e.shopId === q || shops.find(s => s.id === e.shopId)?.name.includes(q) || users.find(u => u.id === e.userId)?.nickname.includes(q))), [ledger, type, q, shops, users])
  const name = (e: LedgerEntry) => shops.find(s => s.id === e.shopId)?.name ?? users.find(u => u.id === e.userId)?.nickname ?? '-'
  const cols: Column<LedgerEntry>[] = [
    { key: 'at', title: '时间', render: e => <span className="text-xs font-num">{fmtDate(e.at)}</span> },
    { key: 'type', title: '类型', render: e => <span className={LEDGER_TYPE[e.type].c}>{LEDGER_TYPE[e.type].l}</span> },
    { key: 'who', title: '商家 / 用户', render: e => <span className="text-xs">{name(e)}</span> },
    { key: 'order', title: '关联订单', render: e => e.orderId ? <Link to={`/admin/orders?q=${e.orderId}`} className="link text-xs font-num">{e.orderId}</Link> : '-' },
    { key: 'amount', title: '金额', render: e => <span className={cls('font-num font-medium', e.type === 'adjust' ? (e.amount > 0 ? 'text-emerald-700' : 'text-red-600') : '')}>{e.type === 'adjust' && e.amount > 0 ? '+' : ''}¥{money(e.amount)}</span> },
    { key: 'note', title: '说明', render: e => <span className="text-xs text-ink-500">{e.note}</span> },
  ]
  return (
    <div>
      <div className="px-5 py-3 flex gap-2 flex-wrap items-center"><SearchInput value={q} onChange={setQ} placeholder="订单号 / 店铺 / 用户" className="w-64" /><Select value={type} onChange={setType} options={[{ value: '', label: '全部类型' }, ...Object.entries(LEDGER_TYPE).map(([v, x]) => ({ value: v, label: x.l }))]} /><button onClick={() => downloadCsv(`资金流水-${new Date().toISOString().slice(0, 10)}.csv`, [['时间', '类型', '商家/用户', '订单号', '金额', '说明'], ...list.map(e => [fmtDate(e.at), LEDGER_TYPE[e.type].l, name(e), e.orderId ?? '', e.amount, e.note ?? ''])])} className="btn-outline ml-auto"><Download className="w-4 h-4" />导出 CSV</button></div>
      <div className="px-5 pb-5"><Table columns={cols} data={list} pageSize={15} empty="暂无资金流水（买家付款、确认收货、退款、提现都会产生流水）" /></div>
    </div>
  )
}

function SettleDetail() {
  const { shops, orders, users } = useDB()
  const rows = useMemo(() => shops.map(s => {
    const os = orders.filter(o => o.shopId === s.id && o.paidAt)
    const settled = os.filter(o => o.settledAt)
    const pending = os.filter(inEscrow)
    const gross = settled.reduce((a, o) => a + o.payAmount, 0)
    const fee = settled.reduce((a, o) => a + (o.commission ?? 0), 0)
    return { id: s.id, s, owner: users.find(u => u.id === s.ownerId), settled: settled.length, gross, fee, net: gross - fee, pending: pending.reduce((a, o) => a + o.payAmount, 0), pendingN: pending.length }
  }).filter(r => r.settled || r.pendingN).sort((a, b) => b.gross - a.gross), [shops, orders, users])
  type Row = typeof rows[0]
  const cols: Column<Row>[] = [
    { key: 's', title: '商家', render: r => <div className="flex items-center gap-2"><Avatar src={r.s.logo} name="" size={28} /><div><div className="font-medium">{r.s.name}</div><div className="text-xs text-ink-400">{r.owner?.username}</div></div></div> },
    { key: 'settled', title: '已结算订单', render: r => <span className="font-num">{r.settled}</span> },
    { key: 'gross', title: '结算成交额', render: r => <span className="font-num">¥{money(r.gross)}</span> },
    { key: 'fee', title: '平台佣金', render: r => <span className="font-num text-ink-500">¥{money(r.fee)}</span> },
    { key: 'net', title: '已结算给商家', render: r => <span className="font-num font-semibold text-emerald-700">¥{money(r.net)}</span> },
    { key: 'pending', title: '担保中（待结算）', render: r => <span className="font-num text-qn-600">¥{money(r.pending)} <span className="text-xs text-ink-400">/ {r.pendingN} 笔</span></span> },
    { key: 'bal', title: '商家当前余额', render: r => <span className="font-num">¥{money(r.owner?.balance ?? 0)}</span> },
  ]
  return <div className="p-5"><div className="text-xs text-ink-500 mb-3">结算由系统在买家确认收货时自动完成（无需人工打款）；本页统计每个商家的结算与担保中金额。上线担保交易前的历史订单不计入结算统计。</div><Table columns={cols} data={rows} pageSize={12} /></div>
}

function Withdrawals() {
  const { withdrawals, shops, users, reviewWithdraw, ledger } = useDB()
  const me = useCurrentUser()
  const [tab, setTab] = useState('pending')
  const [cur, setCur] = useState<Withdrawal | null>(null)
  const [note, setNote] = useState('')
  const list = withdrawals.filter(w => tab === 'all' || w.status === tab)
  // 风控提示：提现金额与近 30 天结算额对比、新店、频繁提现
  const risk = (w: Withdrawal) => {
    const tips: string[] = []
    const settled30 = ledger.filter(e => e.type === 'settle' && e.shopId === w.shopId && Date.now() - Date.parse(e.at) < 30 * 864e5).reduce((a, e) => a + e.amount, 0)
    if (w.amount > Math.max(5000, settled30 * 2)) tips.push(`金额超过近 30 天结算额（¥${money(settled30, 0)}）的 2 倍`)
    const shop = shops.find(s => s.id === w.shopId)
    if (shop && Date.now() - Date.parse(shop.createdAt) < 30 * 864e5) tips.push('开店不足 30 天')
    if (withdrawals.filter(x => x.shopId === w.shopId && Date.now() - Date.parse(x.createdAt) < 864e5).length >= 3) tips.push('24 小时内提现 ≥3 次')
    return tips
  }
  const cols: Column<Withdrawal>[] = [
    { key: 'id', title: '申请单', render: w => <div><div className="font-num text-xs">{w.id}</div><div className="text-xs text-ink-400">{fmtDate(w.createdAt)}</div></div> },
    { key: 'shop', title: '商家', render: w => <span className="text-sm">{shops.find(s => s.id === w.shopId)?.name}</span> },
    { key: 'amount', title: '提现金额', render: w => <span className="font-num font-semibold">¥{money(w.amount)}</span> },
    { key: 'account', title: '到账账户', render: w => <span className="text-xs">{w.account}</span> },
    { key: 'risk', title: '风控', render: w => { const t = risk(w); return t.length ? <span className="tag bg-red-50 text-red-600" title={t.join('；')}>{t[0]}</span> : <span className="text-xs text-emerald-700">正常</span> } },
    { key: 'status', title: '状态', render: w => <span className={w.status === 'pending' ? 'tag-gold' : w.status === 'paid' ? 'tag-green' : 'tag-red'}>{{ pending: '待审核', paid: '已打款', rejected: '已驳回' }[w.status]}</span> },
    { key: 'op', title: '操作', render: w => w.status === 'pending' ? <button onClick={() => { setCur(w); setNote('') }} className="btn-qn btn-sm">审核</button> : <span className="text-xs text-ink-400">{w.reviewer} · {w.reviewedAt && fmtDate(w.reviewedAt, false)}</span> },
  ]
  return (
    <div>
      <div className="px-5 py-3"><Tabs items={[{ key: 'pending', label: '待审核' }, { key: 'paid', label: '已打款' }, { key: 'rejected', label: '已驳回' }, { key: 'all', label: '全部' }]} value={tab} onChange={setTab} accent="qn" /></div>
      <div className="px-5 pb-5"><Table columns={cols} data={list} pageSize={12} empty="暂无提现申请（商家在千牛「资金管理 → 提现」发起）" /></div>
      <Modal open={!!cur} onClose={() => setCur(null)} title="提现审核" width={520} footer={<><button className="btn-outline" onClick={() => setCur(null)}>取消</button><button className="btn-outline text-red-600" onClick={() => { if (!note.trim()) return toast('驳回需填写原因', 'error'); reviewWithdraw(cur!.id, false, me?.nickname ?? 'admin', note.trim()); setCur(null); toast('已驳回，金额退回商家余额') }}><X className="w-4 h-4" />驳回</button><button className="btn-qn" onClick={() => { reviewWithdraw(cur!.id, true, me?.nickname ?? 'admin', note.trim()); setCur(null); toast('审核通过，已打款') }}><Check className="w-4 h-4" />通过并打款</button></>}>
        {cur && <div className="space-y-3 text-sm">
          <div className="grid grid-cols-[90px_1fr] gap-y-2"><span className="text-ink-500">商家</span><span>{shops.find(s => s.id === cur.shopId)?.name}（{users.find(u => u.id === cur.userId)?.username}）</span><span className="text-ink-500">金额</span><span className="font-num text-lg font-semibold">¥{money(cur.amount)}</span><span className="text-ink-500">到账账户</span><span>{cur.account}</span><span className="text-ink-500">申请时间</span><span className="font-num">{fmtDate(cur.createdAt)}</span></div>
          {risk(cur).length > 0 ? <div className="rounded-lg bg-red-50 text-red-700 p-3 text-xs"><ShieldCheck className="w-3.5 h-3.5 inline mr-1" />风控提示：{risk(cur).join('；')}</div> : <div className="rounded-lg bg-emerald-50 text-emerald-700 p-3 text-xs">风控检查通过</div>}
          <Field label="审核备注（驳回必填）"><textarea className="input h-20 py-2" value={note} onChange={e => setNote(e.target.value)} placeholder="例：银行账户信息与实名不一致" /></Field>
        </div>}
      </Modal>
    </div>
  )
}

/** 人工调账（用户管理页使用） */
export function AdjustModal({ userId, onClose }: { userId: string | null; onClose: () => void }) {
  const { users, adjustBalance } = useDB()
  const me = useCurrentUser()
  const u = users.find(x => x.id === userId)
  const [dir, setDir] = useState<'1' | '-1'>('1')
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const ok = () => {
    const v = Number(amount) * Number(dir)
    if (!Number(amount) || Number(amount) <= 0) return toast('请输入金额', 'error')
    if (!note.trim()) return toast('请填写调账原因', 'error')
    if (u && u.balance + v < 0) return toast('扣减后余额不能为负', 'error')
    adjustBalance(userId!, v, note.trim(), me?.nickname ?? 'admin')
    toast('调账成功，已记录资金流水与操作日志'); setAmount(''); setNote(''); onClose()
  }
  return (
    <Modal open={!!u} onClose={onClose} title="人工调账" width={460} footer={<><button className="btn-outline" onClick={onClose}>取消</button><button className="btn-qn" onClick={ok}><Landmark className="w-4 h-4" />确认调账</button></>}>
      {u && <div className="space-y-3 text-sm">
        <div className="flex items-center gap-3 rounded-lg bg-ink-50 p-3"><Avatar src={u.avatar} name="" size={36} /><div><div className="font-medium">{u.nickname}</div><div className="text-xs text-ink-500">当前余额 <span className="font-num">¥{money(u.balance)}</span></div></div><Wallet className="w-5 h-5 text-ink-400 ml-auto" /></div>
        <Field label="方向"><Select value={dir} onChange={v => setDir(v as '1' | '-1')} options={[{ value: '1', label: '增加（补偿 / 赔付）' }, { value: '-1', label: '扣减（追回 / 罚款）' }]} /></Field>
        <Field label="金额（元）"><input type="number" min={0} step="0.01" className="input" value={amount} onChange={e => setAmount(e.target.value)} /></Field>
        <Field label="原因（写入流水与日志）"><input className="input" value={note} onChange={e => setNote(e.target.value)} placeholder="例：工单 #123 物流丢件赔付" /></Field>
        <div className="text-xs text-ink-400 flex items-center gap-1"><ArrowDownToLine className="w-3 h-3" />调账立即生效，并记录操作人。</div>
      </div>}
    </Modal>
  )
}
