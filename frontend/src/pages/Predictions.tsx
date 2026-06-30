// Predictions.tsx
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Brain, Plus, CheckCircle, Clock, XCircle, Trash2, Download } from 'lucide-react'
import { predictionsApi, datasetsApi } from '../lib/api'
import toast from 'react-hot-toast'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { motion } from 'framer-motion'

// ✅ Fix #11 — Proper TypeScript interfaces instead of `any`
interface ColumnInfo {
  dtype: string
  [key: string]: any
}

interface Dataset {
  id: string
  name: string
  status: string
  columns_info: Record<string, ColumnInfo>
}

interface Metrics {
  accuracy?: number
  r2_score?: number
  [key: string]: any
}

interface Prediction {
  id: string
  name: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  model_type: string
  target_column: string
  metrics: Metrics | null
  feature_importance: Record<string, number> | null
}

interface PredictionForm {
  name: string
  model_type: string
  target_column: string
  feature_columns: string[]
  dataset_id: string
  // ✅ Fix #1 — model_config (not `config`) to match backend schema
  model_config: Record<string, any>
}

const INITIAL_FORM: PredictionForm = {
  name: '',
  model_type: 'regression',
  target_column: '',
  feature_columns: [],
  dataset_id: '',
  model_config: {},
}

// ✅ Fix #13 — Model type metadata for validation guidance
const MODEL_TYPES = [
  { value: 'regression',       label: 'Regression',       hint: 'Numeric target column' },
  { value: 'classification',   label: 'Classification',   hint: 'Categorical target column' },
  { value: 'clustering',       label: 'Clustering',       hint: 'No target needed' },
  { value: 'forecasting',      label: 'Forecasting',      hint: 'Date + numeric target' },
]

export function Predictions() {
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [selected, setSelected] = useState<Prediction | null>(null)
  const [form, setForm] = useState<PredictionForm>(INITIAL_FORM)

  // ✅ Fix #14 — Track isLoading to show proper loader
  // ✅ Fix #8 & #16 — Smart polling: only poll when jobs are running; stop when all complete
  const { data: predictions, isLoading: predictionsLoading } = useQuery({
    queryKey: ['predictions'],
    queryFn: () => predictionsApi.list().then((r: any) => r.data as Prediction[]),
    refetchInterval: (query) => {
      const running = (query.state.data as Prediction[] | undefined)?.some(
        (p) => p.status === 'running' || p.status === 'pending'
      )
      return running ? 3000 : false
    },
  })

  const { data: datasets } = useQuery({
    queryKey: ['datasets'],
    queryFn: () => datasetsApi.list().then((r: any) => r.data as Dataset[]),
  })

  // ✅ Fix #4 — Ensure GET /datasets/{id} is called correctly
  const { data: selDataset } = useQuery({
    queryKey: ['dataset', form.dataset_id],
    queryFn: () => datasetsApi.get(form.dataset_id).then((r: any) => r.data as Dataset),
    enabled: !!form.dataset_id,
  })

  const columns = Object.keys(selDataset?.columns_info || {})

  // ✅ Fix #2 — Show actual backend error message in toast
  const createMut = useMutation({
    mutationFn: () => predictionsApi.create(form),
    onSuccess: () => {
      // ✅ Fix #7 — Descriptive success message
      toast.success('Prediction queued. Training started in background.')
      setShowForm(false)
      setForm(INITIAL_FORM)
      qc.invalidateQueries({ queryKey: ['predictions'] })
    },
    onError: (err: any) => {
      toast.error(
        err?.response?.data?.detail ||
        err?.message ||
        'Failed to start prediction'
      )
    },
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => predictionsApi.delete(id),
    onSuccess: () => {
      toast.success('Prediction deleted.')
      setSelected(null)
      qc.invalidateQueries({ queryKey: ['predictions'] })
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.detail || 'Failed to delete prediction')
    },
  })

  const statusIcon = (s: string) => {
    if (s === 'completed') return <CheckCircle size={14} className="text-emerald-400" />
    if (s === 'running')   return <Clock size={14} className="text-amber-400 animate-spin" />
    return <XCircle size={14} className="text-red-400" />
  }

  // ✅ Fix #9 & #10 — Safe optional chaining on metrics and feature_importance
  const fiData = selected?.feature_importance
    ? Object.entries(selected.feature_importance)
        .slice(0, 10)
        .map(([k, v]) => ({ feature: k.slice(0, 12), importance: +(v * 100).toFixed(2) }))
    : []

  // ✅ Fix #15 — Download metrics as JSON
  const handleDownloadMetrics = () => {
    if (!selected?.metrics) return
    const blob = new Blob([JSON.stringify(selected.metrics, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${selected.name}_metrics.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  // ✅ Fix #13 — Clustering has no target column
  const isClustering = form.model_type === 'clustering'

  const canSubmit =
    !!form.name &&
    !!form.dataset_id &&
    (isClustering || !!form.target_column) &&
    (isClustering || form.feature_columns.length > 0) &&
    !createMut.isPending

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Predictions</h1>
          <p className="text-slate-400 mt-1">AutoML pipelines with XGBoost, LightGBM &amp; more</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="btn-primary flex items-center gap-2"
        >
          <Plus size={16} />
          New Prediction
        </button>
      </div>

      {showForm && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="card p-6 space-y-4"
        >
          <h3 className="font-semibold text-slate-200">Configure Model</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Name */}
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Name</label>
              <input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className="input-field"
                placeholder="My Model"
              />
            </div>

            {/* Model Type */}
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Model Type</label>
              <select
                value={form.model_type}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    model_type: e.target.value,
                    target_column: '',
                    feature_columns: [],
                  }))
                }
                className="input-field"
              >
                {MODEL_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
              {/* ✅ Fix #13 — Show hint per model type */}
              <p className="text-xs text-slate-500 mt-1">
                {MODEL_TYPES.find((t) => t.value === form.model_type)?.hint}
              </p>
            </div>

            {/* Dataset */}
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Dataset</label>
              <select
                value={form.dataset_id}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    dataset_id: e.target.value,
                    target_column: '',
                    feature_columns: [],
                  }))
                }
                className="input-field"
              >
                <option value="">Select dataset</option>
                {/* ✅ Fix #3 — Case-insensitive status comparison */}
                {datasets
                  ?.filter((d) => d.status?.toLowerCase() === 'ready')
                  .map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
              </select>
            </div>

            {/* Target Column — hidden for clustering */}
            {!isClustering && (
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Target Column</label>
                <select
                  value={form.target_column}
                  // ✅ Fix #5 — Remove selected target from feature list on change
                  onChange={(e) => {
                    const value = e.target.value
                    setForm((f) => ({
                      ...f,
                      target_column: value,
                      feature_columns: f.feature_columns.filter((c) => c !== value),
                    }))
                  }}
                  className="input-field"
                  disabled={!columns.length}
                >
                  <option value="">Select target</option>
                  {columns.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Feature Columns */}
          {columns.length > 0 && !isClustering && (
            <div>
              <label className="text-xs text-slate-400 mb-1 block">
                Feature Columns (select multiple)
              </label>
              <div className="flex flex-wrap gap-2">
                {columns
                  .filter((c) => c !== form.target_column)
                  .map((c) => (
                    // ✅ Fix #6 — type="button" to prevent accidental form submit
                    <button
                      key={c}
                      type="button"
                      onClick={() =>
                        setForm((f) => ({
                          ...f,
                          feature_columns: f.feature_columns.includes(c)
                            ? f.feature_columns.filter((x) => x !== c)
                            : [...f.feature_columns, c],
                        }))
                      }
                      className={`text-xs px-2.5 py-1 rounded-lg border transition-colors ${
                        form.feature_columns.includes(c)
                          ? 'bg-indigo-600/20 border-indigo-500/50 text-indigo-400'
                          : 'bg-slate-800 border-slate-700 text-slate-400'
                      }`}
                    >
                      {c}
                    </button>
                  ))}
              </div>
            </div>
          )}

          {/* ✅ Fix #12 — Empty columns message */}
          {form.dataset_id && columns.length === 0 && (
            <p className="text-xs text-slate-500 italic">
              No columns found for this dataset. Check if the dataset is fully processed.
            </p>
          )}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => createMut.mutate()}
              disabled={!canSubmit}
              className="btn-primary"
            >
              {/* ✅ Fix #7 — Dynamic button text */}
              {createMut.isPending ? 'Training...' : 'Start Training'}
            </button>
            <button
              type="button"
              onClick={() => { setShowForm(false); setForm(INITIAL_FORM) }}
              className="btn-secondary"
            >
              Cancel
            </button>
          </div>
        </motion.div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="space-y-3">
          {/* ✅ Fix #14 — Show loading state properly */}
          {predictionsLoading ? (
            <div className="card p-12 text-center">
              <Clock size={40} className="mx-auto text-slate-600 mb-3 animate-spin" />
              <p className="text-slate-400">Loading predictions...</p>
            </div>
          ) : !predictions || predictions.length === 0 ? (
            <div className="card p-12 text-center">
              <Brain size={40} className="mx-auto text-slate-700 mb-3" />
              <p className="text-slate-400">No predictions yet</p>
              <p className="text-slate-600 text-xs mt-1">Click "New Prediction" to get started</p>
            </div>
          ) : (
            predictions.map((p, i) => (
              <motion.div
                key={p.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                onClick={() => setSelected(p)}
                className={`card p-4 cursor-pointer hover:border-slate-700 transition-all ${
                  selected?.id === p.id ? 'border-indigo-500/50' : ''
                }`}
              >
                <div className="flex items-center gap-3">
                  {statusIcon(p.status)}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-200 text-sm truncate">{p.name}</p>
                    <p className="text-xs text-slate-500">
                      {p.model_type} · target: {p.target_column || '—'}
                    </p>
                  </div>
                  {p.metrics?.accuracy != null && (
                    <span className="text-xs font-mono text-emerald-400">
                      {(p.metrics.accuracy * 100).toFixed(1)}%
                    </span>
                  )}
                  {p.metrics?.r2_score != null && (
                    <span className="text-xs font-mono text-emerald-400">
                      R²:{p.metrics.r2_score}
                    </span>
                  )}
                </div>
              </motion.div>
            ))
          )}
        </div>

        {/* ✅ Fix #9, #10, #15 — Safe metrics access + download + delete */}
        {selected && (
          <div className="card p-5 space-y-4">
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-semibold text-slate-200">{selected.name}</h3>
              <div className="flex gap-2 shrink-0">
                {selected.metrics && (
                  <button
                    type="button"
                    onClick={handleDownloadMetrics}
                    title="Download metrics"
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-700 transition-colors"
                  >
                    <Download size={14} />
                  </button>
                )}
                {/* ✅ Fix #15 — Delete prediction */}
                <button
                  type="button"
                  onClick={() => deleteMut.mutate(selected.id)}
                  disabled={deleteMut.isPending}
                  title="Delete prediction"
                  className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-400/10 transition-colors"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {Object.entries(selected.metrics || {})
                .filter(([k]) => k !== 'error' && k !== 'best_model')
                .map(([k, v]) => (
                  <div key={k} className="bg-slate-800/50 rounded-xl p-3">
                    <p className="text-xs text-slate-500">{k.replace(/_/g, ' ')}</p>
                    <p className="font-semibold text-slate-200 mt-0.5">
                      {typeof v === 'number' ? v.toFixed(4) : String(v)}
                    </p>
                  </div>
                ))}
            </div>

            {fiData.length > 0 && (
              <div>
                <p className="text-sm font-medium text-slate-300 mb-3">Feature Importance</p>
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={fiData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis type="number" tick={{ fontSize: 10, fill: '#64748b' }} />
                    <YAxis
                      type="category"
                      dataKey="feature"
                      tick={{ fontSize: 10, fill: '#64748b' }}
                      width={70}
                    />
                    <Tooltip
                      contentStyle={{
                        background: '#0f172a',
                        border: '1px solid #1e293b',
                        borderRadius: 8,
                      }}
                    />
                    <Bar dataKey="importance" fill="#6366f1" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default Predictions
