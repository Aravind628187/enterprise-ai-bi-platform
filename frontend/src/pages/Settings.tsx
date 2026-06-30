import { useState } from 'react'
import { useAuthStore } from '../store/authStore'
import { Settings as SettingsIcon, Bell, Palette, Globe } from 'lucide-react'

export function Settings() {
  const { user } = useAuthStore()
  const [notifications, setNotifications] = useState({ email: true, push: false, reports: true })
  const [theme, setTheme] = useState('dark')

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-slate-100">Settings</h1>
      <div className="card p-6">
        <div className="flex items-center gap-2 mb-4"><Bell size={18} className="text-indigo-400" /><h3 className="font-semibold text-slate-200">Notifications</h3></div>
        {[['email', 'Email notifications', 'Receive updates via email'], ['push', 'Push notifications', 'Browser push notifications'], ['reports', 'Report ready alerts', 'Get notified when reports complete']].map(([key, label, desc]) => (
          <div key={key} className="flex items-center justify-between py-3 border-b border-slate-800 last:border-0">
            <div><p className="text-sm text-slate-200">{label}</p><p className="text-xs text-slate-500">{desc}</p></div>
            <button onClick={() => setNotifications(n => ({ ...n, [key]: !n[key as keyof typeof n] }))}
              className={`relative w-11 h-6 rounded-full transition-colors ${notifications[key as keyof typeof notifications] ? 'bg-indigo-600' : 'bg-slate-700'}`}>
              <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${notifications[key as keyof typeof notifications] ? 'translate-x-5' : 'translate-x-0.5'}`} />
            </button>
          </div>
        ))}
      </div>
      <div className="card p-6">
        <div className="flex items-center gap-2 mb-4"><Palette size={18} className="text-purple-400" /><h3 className="font-semibold text-slate-200">Appearance</h3></div>
        <div className="grid grid-cols-3 gap-3">
          {['dark', 'darker', 'midnight'].map(t => (
            <button key={t} onClick={() => setTheme(t)}
              className={`p-3 rounded-xl border text-sm font-medium transition-all ${theme === t ? 'border-indigo-500 bg-indigo-600/20 text-indigo-400' : 'border-slate-700 text-slate-400 hover:border-slate-600'}`}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
      </div>
      <div className="card p-6">
        <div className="flex items-center gap-2 mb-4"><Globe size={18} className="text-emerald-400" /><h3 className="font-semibold text-slate-200">Platform Info</h3></div>
        <div className="space-y-2 text-sm text-slate-400">
          <p>Version: 1.0.0</p>
          <p>Environment: Production</p>
          <p>API: /api/v1</p>
        </div>
      </div>
    </div>
  )
}

export default Settings
