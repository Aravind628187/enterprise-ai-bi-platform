import { motion } from 'framer-motion'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

interface KPICardProps {
  name: string
  value: number | string
  unit?: string
  trend?: 'up' | 'down' | 'stable'
  change_percent?: number
  icon?: React.ReactNode
  color?: string
  delay?: number
}

export default function KPICard({ name, value, unit, trend, change_percent, icon, color = 'indigo', delay = 0 }: KPICardProps) {
  const trendColors = { up: 'text-emerald-400', down: 'text-red-400', stable: 'text-slate-400' }
  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus

  const gradients: Record<string, string> = {
    indigo: 'from-indigo-500/20 to-indigo-600/5 border-indigo-500/20',
    purple: 'from-purple-500/20 to-purple-600/5 border-purple-500/20',
    emerald: 'from-emerald-500/20 to-emerald-600/5 border-emerald-500/20',
    pink: 'from-pink-500/20 to-pink-600/5 border-pink-500/20',
    amber: 'from-amber-500/20 to-amber-600/5 border-amber-500/20',
    cyan: 'from-cyan-500/20 to-cyan-600/5 border-cyan-500/20',
  }

  const iconBg: Record<string, string> = {
    indigo: 'bg-indigo-500/20 text-indigo-400',
    purple: 'bg-purple-500/20 text-purple-400',
    emerald: 'bg-emerald-500/20 text-emerald-400',
    pink: 'bg-pink-500/20 text-pink-400',
    amber: 'bg-amber-500/20 text-amber-400',
    cyan: 'bg-cyan-500/20 text-cyan-400',
  }

  const formattedValue = typeof value === 'number'
    ? value >= 1_000_000 ? `${(value / 1_000_000).toFixed(1)}M`
      : value >= 1_000 ? `${(value / 1_000).toFixed(1)}K`
      : value.toFixed(2)
    : value

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4 }}
      className={`bg-gradient-to-br ${gradients[color]} border rounded-2xl p-5 hover:scale-[1.02] transition-transform duration-200`}
    >
      <div className="flex items-start justify-between mb-3">
        <p className="text-sm text-slate-400 font-medium">{name}</p>
        {icon && (
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${iconBg[color]}`}>
            {icon}
          </div>
        )}
      </div>
      <div className="flex items-end justify-between">
        <div>
          <p className="text-2xl font-bold text-slate-100">
            {unit === '$' && '$'}{formattedValue}{unit && unit !== '$' && <span className="text-sm text-slate-400 ml-1">{unit}</span>}
          </p>
        </div>
        {trend && (
          <div className={`flex items-center gap-1 text-sm font-medium ${trendColors[trend]}`}>
            <TrendIcon size={14} />
            <span>{Math.abs(change_percent || 0).toFixed(1)}%</span>
          </div>
        )}
      </div>
    </motion.div>
  )
}
