import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Zap, BarChart3, Brain, Shield, TrendingUp, MessageSquare, ArrowRight, Database } from 'lucide-react'

const features = [
  { icon: Brain, title: 'AI-Powered Analytics', desc: 'AutoML pipelines with XGBoost, LightGBM, Prophet forecasting, and SHAP explainability.', color: 'text-indigo-400' },
  { icon: BarChart3, title: 'Interactive Dashboards', desc: 'Real-time charts, KPI cards, heatmaps, and correlation matrices built with Recharts.', color: 'text-purple-400' },
  { icon: MessageSquare, title: 'AI Chat with Data', desc: 'Ask questions about your dataset in natural language powered by GPT-4 / Gemini.', color: 'text-pink-400' },
  { icon: TrendingUp, title: 'Time-Series Forecasting', desc: 'Prophet-based forecasting with confidence intervals and trend decomposition.', color: 'text-emerald-400' },
  { icon: Database, title: 'Multi-Format Support', desc: 'Upload CSV, Excel, and JSON datasets up to 100MB with automated data profiling.', color: 'text-cyan-400' },
  { icon: Shield, title: 'Enterprise Security', desc: 'JWT authentication, RBAC with 4 roles, rate limiting, and full audit logs.', color: 'text-amber-400' },
]

export default function Landing() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-900/30 via-slate-950 to-purple-900/20 pointer-events-none" />

      {/* Nav */}
      <nav className="relative flex items-center justify-between px-8 py-5 border-b border-slate-800/50">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center">
            <Zap size={18} className="text-white" />
          </div>
          <span className="font-bold text-slate-100">Enterprise BI</span>
        </div>
        <div className="flex items-center gap-3">
          <Link to="/login" className="text-slate-400 hover:text-slate-100 text-sm px-4 py-2">Sign in</Link>
          <Link to="/register" className="btn-primary text-sm">Get started</Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative text-center py-24 px-6">
        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
          <div className="inline-flex items-center gap-2 bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 text-xs px-3 py-1.5 rounded-full mb-6">
            <Zap size={12} /> AI-Powered Business Intelligence Platform
          </div>
          <h1 className="text-5xl md:text-6xl font-extrabold mb-6 leading-tight">
            Turn Data into<br />
            <span className="gradient-text">AI-Powered Insights</span>
          </h1>
          <p className="text-lg text-slate-400 max-w-2xl mx-auto mb-10">
            Upload datasets, run AutoML pipelines, chat with your data using AI, generate reports, and forecast trends — all in one enterprise platform.
          </p>
          <div className="flex items-center justify-center gap-4">
            <Link to="/register" className="btn-primary px-8 py-3 text-base flex items-center gap-2">
              Start for free <ArrowRight size={16} />
            </Link>
            <Link to="/login" className="btn-secondary px-8 py-3 text-base">Sign in</Link>
          </div>
        </motion.div>
      </section>

      {/* Features */}
      <section className="relative px-6 pb-24 max-w-6xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map(({ icon: Icon, title, desc, color }, i) => (
            <motion.div key={title} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
              className="glass-card hover:border-slate-700 transition-all duration-300">
              <Icon size={28} className={`${color} mb-4`} />
              <h3 className="font-semibold text-slate-100 mb-2">{title}</h3>
              <p className="text-sm text-slate-400 leading-relaxed">{desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      <footer className="relative text-center pb-8 text-slate-600 text-sm">
        Enterprise AI BI Platform — Built with FastAPI, React, and love.
      </footer>
    </div>
  )
}
