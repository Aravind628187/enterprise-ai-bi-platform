import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Eye, EyeOff, Zap, Mail, Lock } from 'lucide-react'
import { useAuthStore } from '../store/authStore'
import toast from 'react-hot-toast'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPwd, setShowPwd] = useState(false)
  const { login, isLoading } = useAuthStore()
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await login(email, password)
      toast.success('Welcome back!')
      navigate('/dashboard')
    } catch (err: any) {
      const detail = err?.response?.data?.detail;

     if (Array.isArray(detail)) {
      toast.error(detail[0].msg);
    } else {
      toast.error(detail || "Login failed");
    }
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-900/20 via-slate-950 to-purple-900/20" />
      <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} className="relative w-full max-w-md">
        <div className="glass-card">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center">
              <Zap size={20} className="text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-100">Enterprise BI</h1>
              <p className="text-xs text-slate-500">AI Analytics Platform</p>
            </div>
          </div>
          <h2 className="text-2xl font-bold text-slate-100 mb-1">Sign in</h2>
          <p className="text-slate-400 text-sm mb-6">Access your analytics dashboard</p>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-sm text-slate-400 mb-1 block">Email</label>
              <div className="relative">
                <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                  className="input-field pl-9" placeholder="you@company.com" required />
              </div>
            </div>
            <div>
              <label className="text-sm text-slate-400 mb-1 block">Password</label>
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input type={showPwd ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
                  className="input-field pl-9 pr-9" placeholder="••••••••" required />
                <button type="button" onClick={() => setShowPwd(!showPwd)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                  {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            <button type="submit" disabled={isLoading} className="btn-primary w-full py-2.5">
              {isLoading ? 'Signing in...' : 'Sign in'}
            </button>
          </form>
          <p className="text-center text-sm text-slate-500 mt-6">
            No account? <Link to="/register" className="text-indigo-400 hover:text-indigo-300">Create one</Link>
          </p>
          <div className="mt-4 p-3 bg-slate-800/50 rounded-lg text-xs text-slate-500">
            <p className="font-medium text-slate-400 mb-1">Demo credentials:</p>
            <p>Email: admin@enterprise.com</p>
            <p>Password: admin123!</p>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
