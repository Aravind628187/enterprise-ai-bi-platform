import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { analyticsApi, datasetsApi } from '../lib/api'
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ScatterChart, Scatter } from 'recharts'
import { BarChart3, TrendingUp, AlertTriangle, CheckCircle, Info } from 'lucide-react'
import KPICard from '../components/dashboard/KPICard'

export default function Analytics() {
  const [datasetId, setDatasetId] = useState('')
  const [xCol, setXCol] = useState('')
  const [yCol, setYCol] = useState('')

  const { data: datasets } = useQuery({ queryKey: ['datasets'], queryFn: () => datasetsApi.list().then(r => r.data) })
  const { data: kpisData } = useQuery({ queryKey: ['kpis', datasetId], queryFn: () => analyticsApi.kpis(datasetId).then(r => r.data), enabled: !!datasetId })
  const { data: insightsData } = useQuery({ queryKey: ['insights', datasetId], queryFn: () => analyticsApi.insights(datasetId).then(r => r.data), enabled: !!datasetId })
  const { data: chartData } = useQuery({ queryKey: ['chart', datasetId, xCol, yCol], queryFn: () => analyticsApi.chartData(datasetId, { x_col: xCol, y_col: yCol }).then(r => r.data), enabled: !!datasetId })
  const { data: corrData } = useQuery({ queryKey: ['corr', datasetId], queryFn: () => analyticsApi.correlation(datasetId).then(r => r.data), enabled: !!datasetId })

  const kpis = kpisData?.kpis || []
  const insights = insightsData?.insights || []
  const chart = chartData || {}
  const colors = ['indigo', 'purple', 'emerald', 'pink', 'amber', 'cyan']

  const insightIcon = (type: string) => {
    if (type === 'anomaly') return <AlertTriangle size={14} className="text-amber-400" />
    if (type === 'data_quality') return <AlertTriangle size={14} className="text-red-400" />
    if (type === 'correlation') return <TrendingUp size={14} className="text-indigo-400" />
    if (type === 'summary') return <CheckCircle size={14} className="text-emerald-400" />
    return <Info size={14} className="text-slate-400" />
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-slate-100">Analytics</h1><p className="text-slate-400 mt-1">Explore and visualize your data</p></div>
        <select value={datasetId} onChange={e => { setDatasetId(e.target.value); setXCol(''); setYCol('') }}
          className="input-field w-64">
          <option value="">Select a dataset</option>
          {datasets?.filter((d: any) => d.status === 'ready').map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
      </div>

      {!datasetId && (
        <div className="card p-16 text-center"><BarChart3 size={48} className="mx-auto text-slate-700 mb-3" /><p className="text-slate-400">Select a dataset to begin analysis</p></div>
      )}

      {datasetId && (
        <>
          {/* KPIs */}
          {kpis.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-slate-400 mb-3 uppercase tracking-wide">Detected KPIs</h2>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {kpis.map((kpi: any, i: number) => (
                  <KPICard key={i} name={kpi.name} value={kpi.value} unit={kpi.unit} trend={kpi.trend} change_percent={kpi.change_percent} color={colors[i % colors.length] as any} delay={i * 0.05} />
                ))}
              </div>
            </div>
          )}

          {/* Chart controls */}
          <div className="card p-5">
            <div className="flex flex-wrap items-center gap-3 mb-4">
              <h3 className="font-semibold text-slate-200 flex-1">Data Visualization</h3>
              <select value={xCol} onChange={e => setXCol(e.target.value)} className="input-field w-36 text-sm">
                <option value="">X axis</option>
                {chart.columns?.map((c: string) => <option key={c} value={c}>{c}</option>)}
              </select>
              <select value={yCol} onChange={e => setYCol(e.target.value)} className="input-field w-36 text-sm">
                <option value="">Y axis</option>
                {chart.numeric_columns?.map((c: string) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            {chart.data?.length > 0 ? (
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={chart.data}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey={chart.x_col} tick={{ fontSize: 11, fill: '#64748b' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
                  <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8 }} />
                  <Line type="monotone" dataKey={chart.y_col} stroke="#6366f1" dot={false} strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            ) : <div className="h-40 flex items-center justify-center text-slate-600 text-sm">Select columns to visualize</div>}
          </div>

          {/* Insights */}
          {insights.length > 0 && (
            <div className="card p-5">
              <h3 className="font-semibold text-slate-200 mb-4">AI Insights</h3>
              <div className="space-y-3">
                {insights.map((ins: any, i: number) => (
                  <div key={i} className="flex gap-3 p-3 bg-slate-800/50 rounded-xl">
                    <div className="mt-0.5">{insightIcon(ins.type)}</div>
                    <div><p className="text-sm font-medium text-slate-200">{ins.title}</p><p className="text-xs text-slate-400 mt-0.5">{ins.description}</p></div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Correlation */}
          {corrData?.columns?.length > 0 && (
            <div className="card p-5">
              <h3 className="font-semibold text-slate-200 mb-4">Correlation Matrix</h3>
              <div className="overflow-x-auto">
                <table className="text-xs text-slate-400 w-full">
                  <thead>
                    <tr><th></th>{corrData.columns.map((c: string) => <th key={c} className="px-2 py-1 text-right truncate max-w-16">{c.slice(0, 8)}</th>)}</tr>
                  </thead>
                  <tbody>
                    {corrData.columns.map((row: string) => (
                      <tr key={row}>
                        <td className="pr-2 font-medium truncate max-w-20">{row.slice(0, 10)}</td>
                        {corrData.columns.map((col: string) => {
                          const val = corrData.matrix[row]?.[col] ?? 0
                          const abs = Math.abs(val)
                          const bg = val > 0 ? `rgba(99,102,241,${abs * 0.7})` : `rgba(239,68,68,${abs * 0.7})`
                          return <td key={col} className="px-2 py-1 text-center rounded" style={{ background: bg }}>{val.toFixed(2)}</td>
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
