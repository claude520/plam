import { useMemo, useState } from 'react'
import { Plus, ShieldCheck, Trash2, RotateCcw, Save, Download, AlertTriangle, Database, Globe } from 'lucide-react'
import { useDB, genId } from '@/store/db'
import { Modal, Field, PageHeader, SearchInput, Select, Stat, Switch, Table, Confirm, type Column } from '@/components/ui'
import { cls, fmtDate } from '@/lib/format'
import { toast } from '@/store/session'
import { PERMISSIONS } from '@/data/seed'
import type { AdminRole, AuditLog } from '@/data/types'

export function Roles() {
  const { adminRoles, upsertRole, removeRole, log } = useDB()
  const [editing, setEditing] = useState<AdminRole | null>(null)
  const [del, setDel] = useState<string | null>(null)
  const has = (r: AdminRole, p: string) => r.permissions.includes('*') || r.permissions.includes(p) || r.permissions.includes(p.split('.')[0] + '.*')
  return (
    <div>
      <PageHeader title="角色权限" desc="基于角色的访问控制（RBAC），管理后台各模块的操作权限。" extra={<button onClick={() => setEditing({ id: genId('r'), name: '', permissions: [], members: 0 })} className="btn-qn"><Plus className="w-4 h-4" />新建角色</button>} />
      <div className="grid grid-cols-[280px_1fr] gap-4 items-start">
        <div className="space-y-3">{adminRoles.map(r => <div key={r.id} className="card p-4"><div className="flex items-center gap-2"><ShieldCheck className={cls('w-5 h-5', r.permissions.includes('*') ? 'text-brand-500' : 'text-qn-500')} /><span className="font-semibold">{r.name}</span><span className="ml-auto text-xs text-ink-400">{r.members} 人</span></div><div className="text-xs text-ink-500 mt-2 line-clamp-2">{r.permissions.includes('*') ? '全部权限' : r.permissions.join('、')}</div><div className="flex gap-2 mt-3 text-xs"><button onClick={() => setEditing(r)} className="link">编辑</button>{!r.permissions.includes('*') && <button onClick={() => setDel(r.id)} className="link text-red-500">删除</button>}</div></div>)}</div>
        <div className="card p-5 overflow-auto"><div className="font-semibold mb-3">权限矩阵</div><table className="w-full text-sm"><thead><tr className="bg-ink-50 text-ink-600 text-left"><th className="px-3 py-2.5 font-medium">权限点</th>{adminRoles.map(r => <th key={r.id} className="px-3 py-2.5 font-medium text-center">{r.name}</th>)}</tr></thead><tbody>{PERMISSIONS.map(g => <><tr key={g.group} className="bg-ink-50/50"><td colSpan={adminRoles.length + 1} className="px-3 py-1.5 text-xs text-ink-500 font-medium">{g.group}</td></tr>{g.items.map(p => <tr key={p} className="border-b border-ink-100"><td className="px-3 py-2 font-num text-xs">{p}</td>{adminRoles.map(r => <td key={r.id} className="px-3 py-2 text-center">{has(r, p) ? <span className="inline-block w-5 h-5 rounded-full bg-emerald-50 text-emerald-600 text-xs leading-5">✓</span> : <span className="text-ink-200">-</span>}</td>)}</tr>)}</>)}</tbody></table></div>
      </div>
      <Modal open={!!editing} onClose={() => setEditing(null)} title="角色" width={620} footer={<><button className="btn-outline" onClick={() => setEditing(null)}>取消</button><button className="btn-qn" disabled={!editing?.name} onClick={() => { upsertRole(editing!); log('admin', '更新角色', editing!.id); setEditing(null); toast('已保存') }}>保存</button></>}>{editing && <div className="space-y-4"><Field label="角色名称" required><input className="input-qn" value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })} /></Field><div className="text-sm text-ink-600 mb-1">权限</div><div className="space-y-3">{PERMISSIONS.map(g => <div key={g.group}><div className="text-xs text-ink-500 mb-1.5">{g.group}</div><div className="flex gap-2 flex-wrap">{g.items.map(p => { const on = editing.permissions.includes('*') || editing.permissions.includes(p); return <button key={p} onClick={() => setEditing({ ...editing, permissions: on ? editing.permissions.filter(x => x !== p && x !== '*') : [...editing.permissions, p] })} className={cls('btn-sm btn border font-num', on ? 'border-qn-500 text-qn-600 bg-qn-50' : 'border-ink-200')}>{p}</button> })}</div></div>)}</div></div>}</Modal>
      <Confirm open={!!del} onClose={() => setDel(null)} onOk={() => { removeRole(del!); toast('已删除') }} title="删除角色？" desc="该角色下的成员将失去对应权限" danger />
    </div>
  )
}

export function Logs() {
  const { auditLogs } = useDB()
  const [q, setQ] = useState('')
  const [actor, setActor] = useState('')
  const actors = useMemo(() => [...new Set(auditLogs.map(l => l.actor))], [auditLogs])
  const list = auditLogs.filter(l => (!actor || l.actor === actor) && (!q || l.action.includes(q) || l.target.includes(q))).sort((a, b) => b.time.localeCompare(a.time))
  const cols: Column<AuditLog>[] = [
    { key: 'time', title: '时间', render: l => <span className="font-num text-xs">{fmtDate(l.time)}</span> },
    { key: 'actor', title: '操作人', render: l => <span className="font-medium">{l.actor}</span> },
    { key: 'action', title: '操作' },
    { key: 'target', title: '对象', render: l => <span className="font-num text-xs text-ink-500">{l.target}</span> },
    { key: 'ip', title: 'IP', render: l => <span className="font-num text-xs text-ink-400">{l.ip}</span> },
    { key: 'result', title: '结果', render: () => <span className="tag-green">成功</span> },
  ]
  return (
    <div>
      <PageHeader title="操作日志" desc="管理后台所有敏感操作的审计记录，不可删除。" extra={<button onClick={() => toast('日志已导出')} className="btn-outline"><Download className="w-4 h-4" />导出</button>} />
      <div className="card p-5"><div className="flex gap-2 mb-4"><SearchInput value={q} onChange={setQ} placeholder="操作 / 对象" className="w-72" /><Select value={actor} onChange={setActor} options={[{ value: '', label: '全部操作人' }, ...actors.map(a => ({ value: a, label: a }))]} /></div><Table columns={cols} data={list} pageSize={15} /></div>
    </div>
  )
}

export function SettingsPage() {
  const { settings, updateSettings, resetAll, log } = useDB()
  const [f, setF] = useState(settings)
  const [reset, setReset] = useState(false)
  return (
    <div>
      <PageHeader title="系统设置" desc="平台基础参数、交易规则与运维工具。" />
      <div className="grid grid-cols-[1fr_360px] gap-4 items-start">
        <div className="card p-6 space-y-5">
          <div className="font-semibold flex items-center gap-2"><Globe className="w-4 h-4 text-qn-500" />基础信息</div>
          <div className="grid grid-cols-2 gap-4"><Field label="平台名称"><input className="input-qn" value={f.siteName} onChange={e => setF({ ...f, siteName: e.target.value })} /></Field><Field label="Slogan"><input className="input-qn" value={f.slogan} onChange={e => setF({ ...f, slogan: e.target.value })} /></Field></div>
          <div className="divider" />
          <div className="font-semibold">交易规则</div>
          <div className="grid grid-cols-3 gap-4"><Field label="平台佣金率（%）" hint="商家结算时扣除"><input type="number" step="0.1" className="input-qn" value={f.commissionRate} onChange={e => setF({ ...f, commissionRate: Number(e.target.value) })} /></Field><Field label="默认运费（元）"><input type="number" className="input-qn" value={f.freightDefault} onChange={e => setF({ ...f, freightDefault: Number(e.target.value) })} /></Field><Field label="自动确认收货（天）"><input type="number" className="input-qn" value={f.autoConfirmDays} onChange={e => setF({ ...f, autoConfirmDays: Number(e.target.value) })} /></Field></div>
          <div className="divider" />
          <div className="flex items-center justify-between"><div><div className="font-semibold flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-amber-500" />维护模式</div><div className="text-xs text-ink-500 mt-1">开启后前台显示维护提示，仅管理员可访问</div></div><Switch checked={f.maintenance} onChange={v => setF({ ...f, maintenance: v })} /></div>
          <div className="flex gap-2 pt-2"><button onClick={() => { updateSettings(f); log('admin', '更新系统设置', 'settings'); toast('设置已保存') }} className="btn-qn"><Save className="w-4 h-4" />保存设置</button><button onClick={() => setF(settings)} className="btn-outline">重置</button></div>
        </div>
        <div className="space-y-4">
          <div className="card p-5"><div className="font-semibold flex items-center gap-2 mb-3"><Database className="w-4 h-4 text-qn-500" />数据与运维</div><div className="space-y-2 text-sm"><div className="flex justify-between text-ink-600"><span>存储引擎</span><span className="font-num">Cloudflare D1 / 本地缓存</span></div><div className="flex justify-between text-ink-600"><span>当前版本</span><span className="font-num">v1.0.0</span></div><div className="flex justify-between text-ink-600"><span>部署环境</span><span className="font-num">Cloudflare Pages</span></div></div><div className="divider my-4" /><button onClick={() => setReset(true)} className="btn-outline w-full text-red-500"><RotateCcw className="w-4 h-4" />重置为演示数据</button><div className="text-xs text-ink-400 mt-2">将清空所有变更并恢复初始种子数据。</div></div>
          <div className="card p-5"><div className="font-semibold mb-3">快捷统计</div><div className="grid grid-cols-2 gap-2"><Stat label="佣金率" value={`${settings.commissionRate}%`} /><Stat label="默认运费" value={`¥${settings.freightDefault}`} /></div></div>
          <div className="hidden"><Trash2 /></div>
        </div>
      </div>
      <Confirm open={reset} onClose={() => setReset(false)} onOk={() => { resetAll(); toast('已重置为演示数据'); setF(useDB.getState().settings) }} title="重置全部数据？" desc="所有订单、商品、用户变更都会被清除，恢复到初始状态" danger />
    </div>
  )
}
