import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { FileText, Plus, Download, Clock, CheckCircle, XCircle } from 'lucide-react'
import { reportsApi, datasetsApi } from '../lib/api'
import toast from 'react-hot-toast'

export default function Reports() {
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', description: '', report_type: 'comprehensive', file_type: 'pdf', dataset_id: '' })

  const { data: reports } = useQuery({ queryKey: ['reports'], queryFn: () => reportsApi.list().then(r => r.data), refetchInterval: 5000 })
  const { data: datasets } = useQuery({ queryKey: ['datasets'], queryFn: () => datasetsApi.list().then(r => r.data) })

  const createMut = useMutation({
    mutationFn: () => reportsApi.create(form),
    onSuccess: () => { toast.success('Report generation started!'); setShowForm(false); qc.invalidateQueries({ queryKey: ['reports'] }) },
    onError: () => toast.error('Failed to create report'),
  })

  const download = async (id: string, name: string, type: string) => {
    try {
      const res = await reportsApi.download(id)
      const url = URL.createObjectURL(new Blob([res.data]))
      const a = document.createElement('a'); a.href = url; a.download = `${name}.${type}`; a.click()
    } catch { toast.error('Download failed') }
  }

  const statusIcon = (s: string) => s === 'ready' ? <CheckCircle size={14} className="text-emerald-400" /> : s === 'generating' || s === 'pending' ? <Clock size={14} className="text-amber-400 animate-spin" /> : <XCircle size={14} className="text-red-400" />

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-slate-100">Reports</h1><p className="text-slate-400 mt-1">Generate PDF, Excel, and CSV reports with AI summaries</p></div>
        <button onClick={() => setShowForm(!showForm)} className="btn-primary flex items-center gap-2"><Plus size={16} />New Report</button>
      </div>

      {showForm && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="card p-6 space-y-4">
          <h3 className="font-semibold text-slate-200">Create Report</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><label className="text-xs text-slate-400 mb-1 block">Name</label><input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="input-field" placeholder="Q2 Sales Report" /></div>
            <div><label className="text-xs text-slate-400 mb-1 block">Dataset</label>
              <select value={form.dataset_id} onChange={e => setForm(f => ({ ...f, dataset_id: e.target.value }))} className="input-field">
                <option value="">No dataset</option>
                {datasets?.filter((d: any) => d.status === 'ready').map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div><label className="text-xs text-slate-400 mb-1 block">Format</label>
              <select value={form.file_type} onChange={e => setForm(f => ({ ...f, file_type: e.target.value }))} className="input-field">
                {[['pdf', 'PDF'], ['csv', 'CSV'], ['xlsx', 'Excel']].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div><label className="text-xs text-slate-400 mb-1 block">Description</label><input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className="input-field" placeholder="Optional..." /></div>
          </div>
          <div className="flex gap-3">
            <button onClick={() => createMut.mutate()} disabled={!form.name || createMut.isPending} className="btn-primary">Generate Report</button>
            <button onClick={() => setShowForm(false)} className="btn-secondary">Cancel</button>
          </div>
        </motion.div>
      )}

      <div className="space-y-3">
        {(!reports || reports.length === 0) ? (
          <div className="card p-16 text-center"><FileText size={48} className="mx-auto text-slate-700 mb-3" /><p className="text-slate-400">No reports yet</p></div>
        ) : reports.map((r: any, i: number) => (
          <motion.div key={r.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="card p-4">
            <div className="flex items-center gap-3">
              {statusIcon(r.status)}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-slate-200 truncate">{r.name}</p>
                  <span className="text-xs px-2 py-0.5 bg-slate-800 text-slate-400 rounded-full flex-shrink-0">{r.file_type.toUpperCase()}</span>
                </div>
                {r.ai_summary && <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{r.ai_summary}</p>}
              </div>
              {r.status === 'ready' && (
                <button onClick={() => download(r.id, r.name, r.file_type)} className="btn-secondary text-xs flex items-center gap-1"><Download size={12} />Download</button>
              )}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  )
}
