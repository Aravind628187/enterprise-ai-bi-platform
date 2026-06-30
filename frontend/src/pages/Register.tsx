import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Zap } from 'lucide-react'
import { authApi } from '../lib/api'
import toast from 'react-hot-toast'

export default function Register() {
  const navigate = useNavigate()
  const [form, setForm] = useState({ email: '', username: '', full_name: '', password: '' })
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      await authApi.register(form)
      toast.success('Account created! Please sign in.')
      navigate('/login')
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-gradient-to-br from-purple-900/20 via-slate-950 to-indigo-900/20" />
      <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} className="relative w-full max-w-md">
        <div className="glass-card">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center">
              <Zap size={20} className="text-white" />
            </div>
            <h1 className="text-xl font-bold text-slate-100">Enterprise BI</h1>
          </div>
          <h2 className="text-2xl font-bold text-slate-100 mb-1">Create account</h2>
          <p className="text-slate-400 text-sm mb-6">Start your analytics journey</p>
          <form onSubmit={handleSubmit} className="space-y-4">
            {[
              { key: 'full_name', label: 'Full Name', placeholder: 'John Doe', type: 'text' },
              { key: 'username', label: 'Username', placeholder: 'johndoe', type: 'text' },
              { key: 'email', label: 'Email', placeholder: 'you@company.com', type: 'email' },
              { key: 'password', label: 'Password', placeholder: '••••••••', type: 'password' },
            ].map(({ key, label, placeholder, type }) => (
              <div key={key}>
                <label className="text-sm text-slate-400 mb-1 block">{label}</label>
                <input type={type} value={(form as any)[key]}
                  onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                  className="input-field" placeholder={placeholder} required />
              </div>
            ))}
            <button type="submit" disabled={loading} className="btn-primary w-full py-2.5">
              {loading ? 'Creating account...' : 'Create account'}
            </button>
          </form>
          <p className="text-center text-sm text-slate-500 mt-6">
            Already have an account? <Link to="/login" className="text-indigo-400 hover:text-indigo-300">Sign in</Link>
          </p>
        </div>
      </motion.div>
    </div>
  )
}
