import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { adminApi } from '../lib/api'
import { Shield, Users, Database, FileText, Brain, UserCheck, UserX } from 'lucide-react'
import toast from 'react-hot-toast'
import KPICard from '../components/dashboard/KPICard'

export default function AdminDashboard() {
  const qc = useQueryClient()
  const { data: stats } = useQuery({ queryKey: ['admin-stats'], queryFn: () => adminApi.stats().then(r => r.data) })
  const { data: users } = useQuery({ queryKey: ['admin-users'], queryFn: () => adminApi.users().then(r => r.data) })
  const { data: logs } = useQuery({ queryKey: ['audit-logs'], queryFn: () => adminApi.auditLogs().then(r => r.data) })

  const roleMut = useMutation({ mutationFn: ({ id, role }: any) => adminApi.updateRole(id, role), onSuccess: () => { toast.success('Role updated'); qc.invalidateQueries({ queryKey: ['admin-users'] }) } })
  const toggleMut = useMutation({ mutationFn: (id: string) => adminApi.toggleActive(id), onSuccess: () => { toast.success('Status updated'); qc.invalidateQueries({ queryKey: ['admin-users'] }) } })

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-gradient-to-br from-red-500 to-orange-600 rounded-xl flex items-center justify-center"><Shield size={20} className="text-white" /></div>
        <div><h1 className="text-2xl font-bold text-slate-100">Admin Dashboard</h1><p className="text-slate-400 text-sm">Platform management & monitoring</p></div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard name="Total Users" value={stats?.users || 0} icon={<Users size={16} />} color="indigo" />
        <KPICard name="Datasets" value={stats?.datasets || 0} icon={<Database size={16} />} color="purple" />
        <KPICard name="Predictions" value={stats?.predictions || 0} icon={<Brain size={16} />} color="emerald" />
        <KPICard name="Reports" value={stats?.reports || 0} icon={<FileText size={16} />} color="amber" />
      </div>

      <div className="card p-5">
        <h3 className="font-semibold text-slate-200 mb-4">User Management</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-xs text-slate-500 uppercase">{['Name', 'Email', 'Role', 'Status', 'Actions'].map(h => <th key={h} className="text-left py-2 pr-4">{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-slate-800">
              {users?.map((u: any) => (
                <tr key={u.id}>
                  <td className="py-3 pr-4 text-slate-200 font-medium">{u.full_name}</td>
                  <td className="py-3 pr-4 text-slate-400">{u.email}</td>
                  <td className="py-3 pr-4">
                    <select value={u.role} onChange={e => roleMut.mutate({ id: u.id, role: e.target.value })}
                      className="bg-slate-800 border border-slate-700 text-slate-300 rounded px-2 py-1 text-xs">
                      {['admin', 'manager', 'analyst', 'viewer'].map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </td>
                  <td className="py-3 pr-4">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${u.is_active ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>{u.is_active ? 'Active' : 'Inactive'}</span>
                  </td>
                  <td className="py-3">
                    <button onClick={() => toggleMut.mutate(u.id)} className="text-xs text-slate-400 hover:text-slate-200 transition-colors">
                      {u.is_active ? <UserX size={14} /> : <UserCheck size={14} />}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {logs && logs.length > 0 && (
        <div className="card p-5">
          <h3 className="font-semibold text-slate-200 mb-4">Recent Audit Logs</h3>
          <div className="space-y-2">
            {logs.slice(0, 20).map((log: any) => (
              <div key={log.id} className="flex items-center gap-3 text-xs py-2 border-b border-slate-800">
                <span className="text-slate-600 w-36 flex-shrink-0">{new Date(log.created_at).toLocaleString()}</span>
                <span className="text-indigo-400 w-24 flex-shrink-0">{log.action}</span>
                <span className="text-slate-400">{log.resource_type}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
