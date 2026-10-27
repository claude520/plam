import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend } from 'recharts'

export const PALETTE = ['#3d6dff', '#ff5000', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4']
const tip = { contentStyle: { borderRadius: 10, border: '1px solid #e4e7ec', boxShadow: '0 8px 24px rgba(16,24,40,.12)', fontSize: 12 } }

export function TrendArea({ data, keys, height = 240, colors = PALETTE, labels }: { data: Record<string, unknown>[]; keys: string[]; height?: number; colors?: string[]; labels?: Record<string, string> }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 10, right: 10, left: -16, bottom: 0 }}>
        <defs>{keys.map((k, i) => <linearGradient key={k} id={`g-${k}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={colors[i]} stopOpacity={0.25} /><stop offset="100%" stopColor={colors[i]} stopOpacity={0} /></linearGradient>)}</defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#eef0f3" vertical={false} />
        <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#98a2b3' }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 11, fill: '#98a2b3' }} axisLine={false} tickLine={false} />
        <Tooltip {...tip} />
        {keys.length > 1 && <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />}
        {keys.map((k, i) => <Area key={k} type="monotone" dataKey={k} name={labels?.[k] ?? k} stroke={colors[i]} strokeWidth={2} fill={`url(#g-${k})`} />)}
      </AreaChart>
    </ResponsiveContainer>
  )
}

export function TrendLine({ data, keys, height = 240, colors = PALETTE, labels }: { data: Record<string, unknown>[]; keys: string[]; height?: number; colors?: string[]; labels?: Record<string, string> }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 10, right: 10, left: -16, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#eef0f3" vertical={false} />
        <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#98a2b3' }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 11, fill: '#98a2b3' }} axisLine={false} tickLine={false} />
        <Tooltip {...tip} />
        {keys.length > 1 && <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />}
        {keys.map((k, i) => <Line key={k} type="monotone" dataKey={k} name={labels?.[k] ?? k} stroke={colors[i]} strokeWidth={2} dot={false} />)}
      </LineChart>
    </ResponsiveContainer>
  )
}

export function Bars({ data, keys, height = 240, colors = PALETTE, labels, stacked }: { data: Record<string, unknown>[]; keys: string[]; height?: number; colors?: string[]; labels?: Record<string, string>; stacked?: boolean }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 10, right: 10, left: -16, bottom: 0 }} barSize={keys.length > 1 ? 12 : 22}>
        <CartesianGrid strokeDasharray="3 3" stroke="#eef0f3" vertical={false} />
        <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#98a2b3' }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 11, fill: '#98a2b3' }} axisLine={false} tickLine={false} />
        <Tooltip {...tip} cursor={{ fill: '#f7f8fa' }} />
        {keys.length > 1 && <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />}
        {keys.map((k, i) => <Bar key={k} dataKey={k} name={labels?.[k] ?? k} fill={colors[i]} radius={[6, 6, 0, 0]} stackId={stacked ? 'a' : undefined} />)}
      </BarChart>
    </ResponsiveContainer>
  )
}

export function Donut({ data, height = 220, colors = PALETTE }: { data: { name: string; value: number }[]; height?: number; colors?: string[] }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" innerRadius="55%" outerRadius="80%" paddingAngle={2} stroke="none">{data.map((_, i) => <Cell key={i} fill={colors[i % colors.length]} />)}</Pie>
        <Tooltip {...tip} />
        <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
      </PieChart>
    </ResponsiveContainer>
  )
}

export const days = (n: number, fn: (i: number) => Record<string, number>) => Array.from({ length: n }, (_, i) => { const d = new Date(Date.now() - (n - 1 - i) * 864e5); return { name: `${d.getMonth() + 1}/${d.getDate()}`, ...fn(i) } })
export const hours = (fn: (i: number) => Record<string, number>) => Array.from({ length: 24 }, (_, i) => ({ name: `${i}:00`, ...fn(i) }))
