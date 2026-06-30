// Charts.tsx
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { analyticsApi, datasetsApi } from '../lib/api'
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { LineChart as LCIcon } from 'lucide-react'

const COLORS = ['#6366f1', '#a855f7', '#ec4899', '#f59e0b', '#10b981', '#06b6d4']

export function Charts() {
  const [datasetId, setDatasetId] = useState('')
  const [xCol, setXCol] = useState('')
  const [yCol, setYCol] = useState('')

  const { data: datasets } = useQuery({ queryKey: ['datasets'], queryFn: () => datasetsApi.list().then(r => r.data) })
  const { data: chart } = useQuery({ queryKey: ['chart-data', datasetId, xCol, yCol], queryFn: () => analyticsApi.chartData(datasetId, { x_col: xCol, y_col: yCol, limit: 100 }).then(r => r.data), enabled: !!datasetId })

  const data = chart?.data || []

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold text-slate-100">Charts</h1><p className="text-slate-400 mt-1">Interactive data visualizations</p></div>
      <div className="card p-4 flex flex-wrap gap-3">
        <select value={datasetId} onChange={e => { setDatasetId(e.target.value); setXCol(''); setYCol('') }} className="input-field w-48">
          <option value="">Dataset</option>
          {datasets?.filter((d: any) => d.status === 'ready').map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        <select value={xCol} onChange={e => setXCol(e.target.value)} className="input-field w-36" disabled={!chart?.columns?.length}>
          <option value="">X axis</option>
          {chart?.columns?.map((c: string) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={yCol} onChange={e => setYCol(e.target.value)} className="input-field w-36" disabled={!chart?.numeric_columns?.length}>
          <option value="">Y axis</option>
          {chart?.numeric_columns?.map((c: string) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {data.length > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {[
            { title: 'Line Chart', Component: ({ children }: any) => <LineChart data={data}>{children}<Line type="monotone" dataKey={yCol} stroke="#6366f1" dot={false} strokeWidth={2} /></LineChart> },
            { title: 'Area Chart', Component: ({ children }: any) => <AreaChart data={data}>{children}<Area type="monotone" dataKey={yCol} stroke="#a855f7" fill="#a855f720" strokeWidth={2} /></AreaChart> },
            { title: 'Bar Chart', Component: ({ children }: any) => <BarChart data={data.slice(0, 30)}>{children}<Bar dataKey={yCol} fill="#6366f1" radius={[4, 4, 0, 0]} /></BarChart> },
            { title: 'Pie Chart', Component: () => <PieChart><Pie data={data.slice(0, 10)} dataKey={yCol} nameKey={xCol} cx="50%" cy="50%" outerRadius={90} label>{data.slice(0, 10).map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}</Pie><Tooltip /><Legend /></PieChart> },
          ].map(({ title, Component }) => (
            <div key={title} className="card p-5">
              <h3 className="text-sm font-semibold text-slate-300 mb-4">{title}</h3>
              <ResponsiveContainer width="100%" height={220}>
                <Component>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey={xCol} tick={{ fontSize: 10, fill: '#64748b' }} />
                  <YAxis tick={{ fontSize: 10, fill: '#64748b' }} />
                  <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8 }} />
                </Component>
              </ResponsiveContainer>
            </div>
          ))}
        </div>
      ) : (
        <div className="card p-16 text-center"><LCIcon size={48} className="mx-auto text-slate-700 mb-3" /><p className="text-slate-400">Select a dataset and columns to generate charts</p></div>
      )}
    </div>
  )
}

export default Charts
