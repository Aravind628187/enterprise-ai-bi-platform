import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { motion, AnimatePresence } from 'framer-motion'
import { Upload, FileText, CheckCircle, AlertCircle, X } from 'lucide-react'
import { datasetsApi } from '../lib/api'
import toast from 'react-hot-toast'
import { useNavigate } from 'react-router-dom'

export default function DataUpload() {
  const [file, setFile] = useState<File | null>(null)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const navigate = useNavigate()

  const onDrop = useCallback((accepted: File[]) => {
    if (accepted[0]) {
      setFile(accepted[0])
      setName(accepted[0].name.replace(/\.[^/.]+$/, ''))
    }
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop, accept: { 'text/csv': ['.csv'], 'application/json': ['.json'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls'] },
    maxFiles: 1, maxSize: 100 * 1024 * 1024,
  })

  const handleUpload = async () => {
    if (!file || !name.trim()) { toast.error('Please select a file and enter a name'); return }
    setUploading(true)
    setProgress(0)
    const formData = new FormData()
    formData.append('file', file)
    formData.append('name', name)
    if (description) formData.append('description', description)
    try {
      const interval = setInterval(() => setProgress(p => Math.min(p + 10, 90)), 200)
      await datasetsApi.upload(formData)
      clearInterval(interval)
      setProgress(100)
      toast.success('Dataset uploaded! Processing in background...')
      setTimeout(() => navigate('/datasets'), 1000)
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Upload failed')
      setProgress(0)
    } finally {
      setUploading(false)
    }
  }

  const formatSize = (bytes: number) => bytes > 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${(bytes / 1024).toFixed(0)} KB`

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-100">Upload Dataset</h1>
        <p className="text-slate-400 mt-1">Support for CSV, Excel, and JSON files up to 100MB</p>
      </div>

      {/* Dropzone */}
      <div {...getRootProps()} className={`border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all duration-200 ${isDragActive ? 'border-indigo-500 bg-indigo-500/10' : 'border-slate-700 hover:border-slate-600 bg-slate-900/50'}`}>
        <input {...getInputProps()} />
        <Upload size={40} className={`mx-auto mb-4 ${isDragActive ? 'text-indigo-400' : 'text-slate-600'}`} />
        {isDragActive ? (
          <p className="text-indigo-400 font-medium">Drop your file here</p>
        ) : (
          <>
            <p className="text-slate-300 font-medium mb-1">Drag & drop your file here</p>
            <p className="text-slate-500 text-sm">or click to browse</p>
            <p className="text-slate-600 text-xs mt-3">CSV, Excel, JSON • Max 100MB</p>
          </>
        )}
      </div>

      {/* File preview */}
      <AnimatePresence>
        {file && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="card p-4 flex items-center gap-3">
            <FileText size={20} className="text-indigo-400 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-200 truncate">{file.name}</p>
              <p className="text-xs text-slate-500">{formatSize(file.size)}</p>
            </div>
            <button onClick={() => setFile(null)} className="text-slate-600 hover:text-slate-400"><X size={16} /></button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Form */}
      <div className="card p-6 space-y-4">
        <div>
          <label className="text-sm text-slate-400 mb-1 block">Dataset Name *</label>
          <input value={name} onChange={e => setName(e.target.value)} className="input-field" placeholder="My Sales Data" />
        </div>
        <div>
          <label className="text-sm text-slate-400 mb-1 block">Description (optional)</label>
          <textarea value={description} onChange={e => setDescription(e.target.value)}
            className="input-field resize-none" rows={3} placeholder="Describe your dataset..." />
        </div>

        {uploading && (
          <div>
            <div className="flex justify-between text-xs text-slate-400 mb-1">
              <span>Uploading...</span><span>{progress}%</span>
            </div>
            <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
              <motion.div className="h-full bg-indigo-500 rounded-full" animate={{ width: `${progress}%` }} />
            </div>
          </div>
        )}

        <button onClick={handleUpload} disabled={!file || uploading} className="btn-primary w-full py-3">
          {uploading ? 'Uploading...' : 'Upload Dataset'}
        </button>
      </div>
    </div>
  )
}
