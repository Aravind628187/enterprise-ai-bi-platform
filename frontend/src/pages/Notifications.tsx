import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Bell, CheckCheck, Info, AlertTriangle, CheckCircle } from 'lucide-react'
import { notifApi } from '../lib/api'
import toast from 'react-hot-toast'
import { formatDistanceToNow } from 'date-fns'

export default function Notifications() {
  const qc = useQueryClient()
  const { data: notifications, isLoading } = useQuery({ queryKey: ['notifications'], queryFn: () => notifApi.list().then(r => r.data) })
  const markAllMut = useMutation({ mutationFn: () => notifApi.markAllRead(), onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }) })
  const markMut = useMutation({ mutationFn: (id: string) => notifApi.markRead(id), onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }) })

  const typeIcon = (t: string) => t === 'success' ? <CheckCircle size={16} className="text-emerald-400" /> : t === 'warning' ? <AlertTriangle size={16} className="text-amber-400" /> : <Info size={16} className="text-indigo-400" />

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-100">Notifications</h1>
        <button onClick={() => markAllMut.mutate()} className="btn-secondary flex items-center gap-1.5 text-sm"><CheckCheck size={14} />Mark all read</button>
      </div>
      {isLoading ? <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" /></div>
        : (!notifications || notifications.length === 0) ? (
          <div className="card p-16 text-center"><Bell size={40} className="mx-auto text-slate-700 mb-3" /><p className="text-slate-400">No notifications</p></div>
        ) : notifications.map((n: any) => (
          <div key={n.id} onClick={() => !n.is_read && markMut.mutate(n.id)}
            className={`card p-4 flex gap-3 cursor-pointer hover:border-slate-700 transition-all ${!n.is_read ? 'border-indigo-500/30' : ''}`}>
            <div className="mt-0.5">{typeIcon(n.notification_type)}</div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-slate-200">{n.title}</p>
                {!n.is_read && <span className="w-2 h-2 bg-indigo-500 rounded-full flex-shrink-0" />}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">{n.message}</p>
              <p className="text-xs text-slate-600 mt-1">{formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}</p>
            </div>
          </div>
        ))}
    </div>
  )
}
