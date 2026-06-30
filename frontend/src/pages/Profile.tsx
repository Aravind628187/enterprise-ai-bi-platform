import { useState } from 'react'
import { useAuthStore } from '../store/authStore'
import { authApi } from '../lib/api'
import toast from 'react-hot-toast'
import { User, Mail, Shield, Edit3 } from 'lucide-react'

export default function Profile() {
  const { user, fetchMe } = useAuthStore()
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({ full_name: user?.full_name || '' })
  const [loading, setLoading] = useState(false)
  const [pwdForm, setPwdForm] = useState({ old: '', new: '' })

  const saveProfile = async () => {
    setLoading(true)
    try {
      await authApi.updateMe(form)
      await fetchMe()
      toast.success('Profile updated')
      setEditing(false)
    } catch { toast.error('Update failed') }
    finally { setLoading(false) }
  }

  const changePwd = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await authApi.changePassword(pwdForm.old, pwdForm.new)
      toast.success('Password changed')
      setPwdForm({ old: '', new: '' })
    } catch (err: any) { toast.error(err?.response?.data?.detail || 'Failed') }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-slate-100">Profile</h1>
      <div className="card p-6">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center text-2xl font-bold text-white">
            {user?.full_name?.[0]?.toUpperCase()}
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-100">{user?.full_name}</h2>
            <p className="text-slate-400 text-sm">{user?.email}</p>
            <span className="text-xs bg-indigo-500/20 text-indigo-400 px-2 py-0.5 rounded-full capitalize">{user?.role}</span>
          </div>
          <button onClick={() => setEditing(!editing)} className="ml-auto btn-secondary flex items-center gap-1.5 text-sm"><Edit3 size={14} />Edit</button>
        </div>
        {editing && (
          <div className="space-y-3 border-t border-slate-800 pt-4">
            <div><label className="text-xs text-slate-400 mb-1 block">Full Name</label>
              <input value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} className="input-field" /></div>
            <div className="flex gap-2">
              <button onClick={saveProfile} disabled={loading} className="btn-primary text-sm">Save</button>
              <button onClick={() => setEditing(false)} className="btn-secondary text-sm">Cancel</button>
            </div>
          </div>
        )}
        <div className="grid grid-cols-3 gap-3 border-t border-slate-800 pt-4 mt-4">
          {[['Email', user?.email, Mail], ['Username', user?.username, User], ['Role', user?.role, Shield]].map(([label, val, Icon]: any) => (
            <div key={label} className="bg-slate-800/50 rounded-xl p-3">
              <div className="flex items-center gap-1.5 mb-1"><Icon size={12} className="text-slate-500" /><p className="text-xs text-slate-500">{label}</p></div>
              <p className="text-sm font-medium text-slate-200 truncate capitalize">{val}</p>
            </div>
          ))}
        </div>
      </div>
      <div className="card p-6">
        <h3 className="font-semibold text-slate-200 mb-4">Change Password</h3>
        <form onSubmit={changePwd} className="space-y-3">
          <div><label className="text-xs text-slate-400 mb-1 block">Current Password</label><input type="password" value={pwdForm.old} onChange={e => setPwdForm(f => ({ ...f, old: e.target.value }))} className="input-field" required /></div>
          <div><label className="text-xs text-slate-400 mb-1 block">New Password</label><input type="password" value={pwdForm.new} onChange={e => setPwdForm(f => ({ ...f, new: e.target.value }))} className="input-field" required minLength={8} /></div>
          <button type="submit" className="btn-primary text-sm">Update Password</button>
        </form>
      </div>
    </div>
  )
}
