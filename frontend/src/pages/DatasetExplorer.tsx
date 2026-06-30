import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Database, Trash2, Eye, BarChart3, Plus } from 'lucide-react'
import { Link } from 'react-router-dom'
import { datasetsApi } from '../lib/api'
import toast from 'react-hot-toast'
import { useState } from 'react'

// ── helpers ───────────────────────────────────────────────────────────────────

/**
 * FIX 3a: Backend returns status as uppercase enum string: READY / PROCESSING / FAILED
 * The previous code compared against lowercase "ready" / "processing" so badge
 * colours never matched and always showed grey.
 */
function statusBadge(status: string) {
  const s = (status || '').toUpperCase()
  if (s === 'READY')      return 'bg-emerald-500/20 text-emerald-400'
  if (s === 'PROCESSING') return 'bg-amber-500/20  text-amber-400'
  if (s === 'FAILED')     return 'bg-red-500/20    text-red-400'
  return 'bg-slate-700 text-slate-400'
}

function statusLabel(status: string) {
  return (status || 'unknown').toLowerCase()
}

export default function DatasetExplorer() {
  const qc = useQueryClient()
  const [selected, setSelected] = useState<any>(null)

  // FIX 3b: datasetsApi.list() now calls '/datasets/' (trailing slash) so
  //         FastAPI does NOT issue a 307 redirect and the Auth header is kept.
  const { data: datasets, isLoading } = useQuery({
    queryKey: ['datasets'],
    queryFn:  () => datasetsApi.list().then(r => r.data),
    // Poll every 10 s while any dataset is still processing
    refetchInterval: (data: any) =>
      Array.isArray(data) && data.some((d: any) => d.status?.toUpperCase() === 'PROCESSING')
        ? 10_000
        : false,
  })

  const { data: stats } = useQuery({
    queryKey: ['dataset-stats', selected?.id],
    queryFn:  () => datasetsApi.stats(selected.id).then(r => r.data),
    enabled:  !!selected?.id,
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => datasetsApi.delete(id),
    onSuccess: () => {
      toast.success('Dataset deleted')
      setSelected(null)
      qc.invalidateQueries({ queryKey: ['datasets'] })
    },
    onError: () => toast.error('Delete failed'),
  })

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Datasets</h1>
          <p className="text-slate-400 mt-1">{datasets?.length || 0} datasets</p>
        </div>
        <Link to="/upload" className="btn-primary flex items-center gap-2">
          <Plus size={16} />Upload
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Dataset list */}
        <div className="space-y-3">
          {!datasets || datasets.length === 0 ? (
            <div className="card p-12 text-center">
              <Database size={40} className="mx-auto text-slate-700 mb-3" />
              <p className="text-slate-400">No datasets yet</p>
              <Link to="/upload" className="text-indigo-400 text-sm mt-2 inline-block">
                Upload your first dataset →
              </Link>
            </div>
          ) : (
            datasets.map((ds: any, i: number) => (
              <motion.div
                key={ds.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                onClick={() => setSelected(ds)}
                className={`card p-4 cursor-pointer hover:border-slate-700 transition-all ${
                  selected?.id === ds.id ? 'border-indigo-500/50' : ''
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 bg-indigo-500/20 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Database size={16} className="text-indigo-400" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      {/*
                        FIX 3c: Show user-supplied name (ds.name).
                        Previous screenshots showed "string" because ds.name was
                        the raw Python type name — that means the backend was
                        returning the Python str type, not the value.
                        If ds.name is empty, fall back to ds.file_name.
                      */}
                      <p className="font-medium text-slate-200 truncate">
                        {ds.name || ds.file_name || 'Untitled'}
                      </p>
                      {/* FIX 3d: status badge now uses uppercase comparison */}
                      <span className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 ${statusBadge(ds.status)}`}>
                        {statusLabel(ds.status)}
                      </span>
                    </div>

                    {/*
                      FIX 3e: Use ds.row_count and ds.column_count (exact DB field names).
                      file_type comes from DB as "csv"/"xlsx" etc — always lowercase.
                    */}
                    <p className="text-xs text-slate-500 mt-0.5">
                      {(ds.row_count ?? 0).toLocaleString()} rows
                      · {ds.column_count ?? 0} cols
                      · {(ds.file_type || '').toUpperCase()}
                    </p>

                    {ds.data_quality_score > 0 && (
                      <div className="flex items-center gap-2 mt-1.5">
                        <div className="flex-1 h-1 bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-emerald-500 rounded-full"
                            style={{ width: `${ds.data_quality_score}%` }}
                          />
                        </div>
                        <span className="text-xs text-slate-500">
                          {ds.data_quality_score.toFixed(0)}% quality
                        </span>
                      </div>
                    )}
                  </div>

                  <button
                    onClick={e => { e.stopPropagation(); deleteMut.mutate(ds.id) }}
                    className="text-slate-600 hover:text-red-400 transition-colors p-1"
                    title="Delete dataset"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </motion.div>
            ))
          )}
        </div>

        {/* Dataset detail panel */}
        <div>
          {selected ? (
            <div className="card p-5 space-y-4 sticky top-0">
              {/* FIX 3f: title uses corrected name field */}
              <h3 className="font-semibold text-slate-200">
                {selected.name || selected.file_name || 'Untitled'}
              </h3>

              <div className="grid grid-cols-2 gap-3">
                {[
                  ['Rows',     (selected.row_count ?? 0).toLocaleString()],
                  ['Columns',  selected.column_count ?? 0],
                  ['Quality',  `${(selected.data_quality_score ?? 0).toFixed(1)}%`],
                  ['Outliers', selected.outliers_detected ?? 0],
                ].map(([k, v]) => (
                  <div key={k} className="bg-slate-800/50 rounded-xl p-3">
                    <p className="text-xs text-slate-500">{k}</p>
                    <p className="font-semibold text-slate-200 mt-0.5">{v}</p>
                  </div>
                ))}
              </div>

              {/* Columns */}
              {selected.columns_info && Object.keys(selected.columns_info).length > 0 && (
                <div>
                  <p className="text-xs text-slate-500 mb-2">Columns</p>
                  <div className="flex flex-wrap gap-1.5">
                    {Object.keys(selected.columns_info).slice(0, 12).map((col: string) => (
                      <span key={col} className="text-xs bg-slate-800 text-slate-400 px-2 py-0.5 rounded-md">
                        {col}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Preview row */}
              {selected.preview_data?.length > 0 && (
                <div>
                  <p className="text-xs text-slate-500 mb-2">Preview (first row)</p>
                  <div className="bg-slate-800/50 rounded-xl p-3 text-xs text-slate-400 overflow-x-auto">
                    <pre>{JSON.stringify(selected.preview_data[0], null, 2)}</pre>
                  </div>
                </div>
              )}

              {/* Status badge in detail panel */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500">Status:</span>
                <span className={`text-xs px-2 py-0.5 rounded-full ${statusBadge(selected.status)}`}>
                  {statusLabel(selected.status)}
                </span>
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <Link
                  to={`/analytics?dataset=${selected.id}`}
                  className="btn-secondary flex-1 text-center text-sm flex items-center justify-center gap-1"
                >
                  <BarChart3 size={14} /> Analyze
                </Link>
                <Link
                  to={`/predictions?dataset=${selected.id}`}
                  className="btn-primary flex-1 text-center text-sm flex items-center justify-center gap-1"
                >
                  Predict
                </Link>
              </div>
            </div>
          ) : (
            <div className="card p-12 text-center text-slate-600">
              <Eye size={32} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm">Select a dataset to view details</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}