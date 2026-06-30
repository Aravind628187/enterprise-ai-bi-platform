import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { TrendingUp, Plus } from 'lucide-react'
import { predictionsApi, datasetsApi } from '../lib/api'
import toast from 'react-hot-toast'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'

export default function Forecasting() {
  const qc = useQueryClient()
  const [datasetId, setDatasetId] = useState('')
  const [targetCol, setTargetCol] = useState('')
  const [periods, setPeriods] = useState(30)
  const [result, setResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  const { data: datasets } = useQuery({ queryKey: ['datasets'], queryFn: () => datasetsApi.list().then(r => r.data) })
  const { data: selDataset } = useQuery({ queryKey: ['dataset', datasetId], queryFn: () => datasetsApi.get(datasetId).then(r => r.data), enabled: !!datasetId })

  const numericCols = Object.entries(selDataset?.columns_info || {})
    .filter(([, info]: any) => ['float', 'integer', 'int64', 'float64'].includes(info.dtype?.split('64')[0] + (info.dtype?.includes('64') ? '64' : '')))
    .map(([col]) => col)

  const allCols = Object.keys(selDataset?.columns_info || {})

  const runForecast = async () => {
    if (!datasetId || !targetCol) { toast.error('Select dataset and target column'); return }
    setLoading(true)
    try {
      const res = await predictionsApi.create({
        name: `Forecast - ${targetCol}`,
        model_type: 'forecasting',
        target_column: targetCol,
        feature_columns: [],
        dataset_id: datasetId,
        model_config: { forecast_periods: periods },
      })
      // Poll for result
      const predId = res.data.id
      let attempts = 0
      const poll = setInterval(async () => {
        attempts++
        const pr = await predictionsApi.get(predId)
        if (pr.data.status === 'completed' || pr.data.status === 'failed' || attempts > 30) {
          clearInterval(poll)
          setResult(pr.data)
          setLoading(false)
        }
      }, 2000)
    } catch {
      toast.error('Forecast failed')
      setLoading(false)
    }
  }

  const histData = (result?.predictions_data || []).map((d: any) => ({ ...d, ds: d.ds?.slice(0, 10) }))
  const foreData = (result?.forecast_data || []).map((d: any) => ({ ...d, ds: d.ds?.slice(0, 10) }))
  const combined = [...histData.slice(-30), ...foreData].map((d: any, i: number) => ({
    date: d.ds, value: d.y ?? d.yhat, forecast: d.yhat, lower: d.yhat_lower, upper: d.yhat_upper, isForecast: i >= histData.length,
  }))

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold text-slate-100">Forecasting</h1><p className="text-slate-400 mt-1">Time-series forecasting with Prophet</p></div>

      <div className="card p-5">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
          <div className="md:col-span-1">
            <label className="text-xs text-slate-400 mb-1 block">Dataset</label>
            <select value={datasetId} onChange={e => { setDatasetId(e.target.value); setTargetCol('') }} className="input-field">
              <option value="">Select dataset</option>
              {datasets?.filter((d: any) => d.status === 'ready').map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Target Column</label>
            <select value={targetCol} onChange={e => setTargetCol(e.target.value)} className="input-field" disabled={!allCols.length}>
              <option value="">Select column</option>
              {allCols.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Forecast Periods</label>
            <input type="number" min={7} max={365} value={periods} onChange={e => setPeriods(+e.target.value)} className="input-field" />
          </div>
          <div className="flex items-end">
            <button onClick={runForecast} disabled={!datasetId || !targetCol || loading} className="btn-primary w-full flex items-center justify-center gap-2">
              {loading ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Running...</> : <><TrendingUp size={16} />Run Forecast</>}
            </button>
          </div>
        </div>
      </div>

      {result && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-200">Forecast Results</h3>
            {result.metrics?.mae && <span className="text-xs text-slate-500">MAE: {result.metrics.mae.toFixed(4)}</span>}
          </div>
          {combined.length > 0 ? (
            <ResponsiveContainer width="100%" height={320}>
              <LineChart data={combined}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#64748b' }} />
                <YAxis tick={{ fontSize: 10, fill: '#64748b' }} />
                <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8 }} />
                <Line type="monotone" dataKey="value" stroke="#6366f1" dot={false} strokeWidth={2} name="Historical" />
                <Line type="monotone" dataKey="forecast" stroke="#f59e0b" dot={false} strokeWidth={2} strokeDasharray="5 5" name="Forecast" />
              </LineChart>
            </ResponsiveContainer>
          ) : <p className="text-slate-500 text-sm text-center py-8">{result.metrics?.error || 'No chart data available'}</p>}
        </motion.div>
      )}

      {!result && !loading && (
        <div className="card p-16 text-center"><TrendingUp size={48} className="mx-auto text-slate-700 mb-3" /><p className="text-slate-400">Configure and run a forecast above</p></div>
      )}
    </div>
  )
}
