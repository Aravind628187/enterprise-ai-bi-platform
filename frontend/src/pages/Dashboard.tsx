import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import {
  Database, Brain, FileText, Activity,
  Upload, MessageSquare,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { analyticsApi } from '../lib/api'
import { useAuthStore } from '../store/authStore'
import KPICard from '../components/dashboard/KPICard'
import {
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, AreaChart, Area,
} from 'recharts'

// ── helpers ───────────────────────────────────────────────────────────────────

/**
 * FIX 2a: Backend returns status as uppercase "READY" / "PROCESSING" / "FAILED"
 * (DatasetStatus enum).  All previous comparisons used lowercase "ready" /
 * "processing" so the badge colour never matched and always fell through to grey.
 */
function statusBadge(status: string) {
  const s = (status || '').toUpperCase()
  if (s === 'READY')      return 'bg-emerald-500/20 text-emerald-400'
  if (s === 'PROCESSING') return 'bg-amber-500/20  text-amber-400'
  if (s === 'FAILED')     return 'bg-red-500/20    text-red-400'
  return 'bg-slate-700 text-slate-400'
}

function statusLabel(status: string) {
  return (status || '').toLowerCase()
}

export default function Dashboard() {
  const { user } = useAuthStore()

  const { data: dashData, isLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn:  () => analyticsApi.dashboard().then(r => r.data),
    // Refetch every 30 s so freshly-uploaded datasets appear quickly
    refetchInterval: 30_000,
  })

  const stats          = dashData?.stats          || {}
  const recentDatasets = dashData?.recent_datasets || []

  // Deterministic activity data (no random so chart doesn't flicker on re-render)
  const activityData = Array.from({ length: 14 }, (_, i) => ({
    day:         `Day ${i + 1}`,
    uploads:     [3, 6, 4, 7, 5, 6, 4, 3, 5, 7, 4, 6, 3, 5][i] ?? 0,
    predictions: [2, 4, 3, 5, 4, 5, 3, 2, 4, 5, 3, 5, 2, 4][i] ?? 0,
  }))

  const quickActions = [
    { icon: Upload,        label: 'Upload Dataset',   to: '/upload',      color: 'bg-indigo-600'  },
    { icon: Brain,         label: 'Run Prediction',   to: '/predictions', color: 'bg-purple-600'  },
    { icon: MessageSquare, label: 'AI Chat',          to: '/chat',        color: 'bg-pink-600'    },
    { icon: FileText,      label: 'Generate Report',  to: '/reports',     color: 'bg-emerald-600' },
  ]

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <motion.h1
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="text-2xl font-bold text-slate-100"
        >
          Welcome back, {user?.full_name?.split(' ')[0]} 👋
        </motion.h1>
        <p className="text-slate-400 mt-1">Here's what's happening with your data today.</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard name="Total Datasets"     value={stats.total_datasets    || 0} icon={<Database size={18} />} color="indigo"  delay={0.10} trend="up"     change_percent={12.5} />
        <KPICard name="Predictions Run"    value={stats.total_predictions || 0} icon={<Brain    size={18} />} color="purple"  delay={0.15} trend="up"     change_percent={8.2}  />
        <KPICard name="Storage Used"       value={parseFloat((stats.storage_used_mb || 0).toFixed(1))} unit="MB" icon={<Activity size={18} />} color="cyan" delay={0.20} trend="stable" change_percent={0} />
        <KPICard name="Reports Generated"  value={stats.total_reports     || 0} icon={<FileText size={18} />} color="emerald" delay={0.25} trend="up"     change_percent={5.1}  />
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-lg font-semibold text-slate-200 mb-3">Quick Actions</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {quickActions.map(({ icon: Icon, label, to, color }) => (
            <Link key={to} to={to}>
              <motion.div
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.98 }}
                className="card p-4 flex items-center gap-3 cursor-pointer hover:border-slate-700 transition-colors"
              >
                <div className={`w-10 h-10 ${color} rounded-xl flex items-center justify-center`}>
                  <Icon size={18} className="text-white" />
                </div>
                <span className="text-sm font-medium text-slate-300">{label}</span>
              </motion.div>
            </Link>
          ))}
        </div>
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Activity chart */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="card p-5"
        >
          <h3 className="text-sm font-semibold text-slate-300 mb-4">Activity Overview (14 days)</h3>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={activityData}>
              <defs>
                <linearGradient id="uploads" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#6366f1" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0}   />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="day"         tick={{ fontSize: 11, fill: '#64748b' }} />
              <YAxis                       tick={{ fontSize: 11, fill: '#64748b' }} />
              <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8 }} />
              <Area type="monotone" dataKey="uploads"     stroke="#6366f1" fill="url(#uploads)" strokeWidth={2} name="Uploads"     />
              <Area type="monotone" dataKey="predictions" stroke="#a855f7" fill="none"           strokeWidth={2} name="Predictions" />
            </AreaChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Recent Datasets */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="card p-5"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-slate-300">Recent Datasets</h3>
            <Link to="/datasets" className="text-xs text-indigo-400 hover:text-indigo-300">View all →</Link>
          </div>

          {recentDatasets.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-slate-500">
              <Database size={32} className="mb-2 opacity-30" />
              <p className="text-sm">No datasets yet</p>
              <Link to="/upload" className="text-xs text-indigo-400 mt-1">Upload your first dataset →</Link>
            </div>
          ) : (
            <div className="space-y-2">
              {recentDatasets.map((ds: any) => (
                <div key={ds.id} className="flex items-center gap-3 p-3 bg-slate-800/50 rounded-xl">
                  <Database size={16} className="text-indigo-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    {/*
                      FIX 2b: Backend stores the user-supplied name in ds.name
                      and the original filename in ds.file_name.
                      Use ds.name first (user label), fall back to ds.file_name.
                    */}
                    <p className="text-sm font-medium text-slate-200 truncate">
                      {ds.name || ds.file_name || 'Untitled'}
                    </p>
                    {/*
                      FIX 2c: Field is row_count (integer from DB), not ds.rows.
                      Previous code showed "undefined rows" → rendered as "0 rows".
                    */}
                    <p className="text-xs text-slate-500">
                      {(ds.row_count ?? 0).toLocaleString()} rows
                    </p>
                  </div>
                  {/*
                    FIX 2d: Backend returns status as uppercase "READY"/"PROCESSING"/"FAILED".
                    Previous badge check used lowercase "ready"/"processing" — never matched.
                    Now we normalise with statusBadge() / statusLabel() helpers.
                  */}
                  <span className={`text-xs px-2 py-0.5 rounded-full ${statusBadge(ds.status)}`}>
                    {statusLabel(ds.status)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      </div>
    </div>
  )
}