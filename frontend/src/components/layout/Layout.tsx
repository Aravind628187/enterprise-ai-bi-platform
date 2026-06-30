import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useState } from 'react'
import {
  LayoutDashboard, BarChart3, Upload, Database, Brain, TrendingUp,
  MessageSquare, FileText, LineChart, Bell, Settings, User,
  LogOut, ChevronLeft, ChevronRight, Shield, Zap, Menu, X
} from 'lucide-react'
import { useAuthStore } from '../../store/authStore'
import { notifApi } from '../../lib/api'
import { useQuery } from '@tanstack/react-query'

const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/analytics', icon: BarChart3, label: 'Analytics' },
  { to: '/upload', icon: Upload, label: 'Upload Data' },
  { to: '/datasets', icon: Database, label: 'Datasets' },
  { to: '/predictions', icon: Brain, label: 'Predictions' },
  { to: '/forecasting', icon: TrendingUp, label: 'Forecasting' },
  { to: '/chat', icon: MessageSquare, label: 'AI Chat' },
  { to: '/reports', icon: FileText, label: 'Reports' },
  { to: '/charts', icon: LineChart, label: 'Charts' },
]

const bottomItems = [
  { to: '/notifications', icon: Bell, label: 'Notifications' },
  { to: '/profile', icon: User, label: 'Profile' },
  { to: '/settings', icon: Settings, label: 'Settings' },
]

export default function Layout() {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()

  const { data: notifCount } = useQuery({
    queryKey: ['notif-count'],
    queryFn: () => notifApi.count().then(r => r.data.count),
    refetchInterval: 30000,
  })

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className={`flex items-center gap-3 px-4 py-5 border-b border-slate-800 ${collapsed ? 'justify-center' : ''}`}>
        <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center flex-shrink-0">
          <Zap size={16} className="text-white" />
        </div>
        {!collapsed && <span className="font-bold text-slate-100 text-sm">Enterprise BI</span>}
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink key={to} to={to} className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''} ${collapsed ? 'justify-center' : ''}`}>
            <Icon size={18} className="flex-shrink-0" />
            {!collapsed && <span>{label}</span>}
          </NavLink>
        ))}
        {user?.role === 'admin' && (
          <NavLink to="/admin" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''} ${collapsed ? 'justify-center' : ''}`}>
            <Shield size={18} className="flex-shrink-0" />
            {!collapsed && <span>Admin</span>}
          </NavLink>
        )}
      </nav>

      {/* Bottom */}
      <div className="p-3 border-t border-slate-800 space-y-1">
        {bottomItems.map(({ to, icon: Icon, label }) => (
          <NavLink key={to} to={to} className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''} ${collapsed ? 'justify-center' : ''} relative`}>
            <Icon size={18} className="flex-shrink-0" />
            {!collapsed && <span>{label}</span>}
            {to === '/notifications' && notifCount > 0 && (
              <span className="absolute top-1.5 left-5 w-4 h-4 bg-red-500 rounded-full text-xs flex items-center justify-center text-white font-bold">
                {notifCount}
              </span>
            )}
          </NavLink>
        ))}
        <button onClick={handleLogout} className={`sidebar-link w-full text-red-400 hover:text-red-300 hover:bg-red-900/20 ${collapsed ? 'justify-center' : ''}`}>
          <LogOut size={18} className="flex-shrink-0" />
          {!collapsed && <span>Logout</span>}
        </button>
      </div>
    </div>
  )

  return (
    <div className="flex h-screen bg-slate-950 overflow-hidden">
      {/* Mobile overlay */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 z-40 lg:hidden"
            onClick={() => setMobileOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Mobile sidebar */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.aside
            initial={{ x: -280 }} animate={{ x: 0 }} exit={{ x: -280 }}
            transition={{ type: 'spring', damping: 25 }}
            className="fixed left-0 top-0 h-full w-64 bg-slate-900 border-r border-slate-800 z-50 lg:hidden"
          >
            <SidebarContent />
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Desktop sidebar */}
      <motion.aside
        animate={{ width: collapsed ? 68 : 240 }}
        transition={{ duration: 0.2 }}
        className="hidden lg:block flex-shrink-0 bg-slate-900 border-r border-slate-800 relative overflow-hidden"
      >
        <SidebarContent />
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="absolute top-5 -right-3 w-6 h-6 bg-slate-700 border border-slate-600 rounded-full flex items-center justify-center hover:bg-slate-600 z-10"
        >
          {collapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
        </button>
      </motion.aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top navbar */}
        <header className="h-14 bg-slate-900/80 backdrop-blur border-b border-slate-800 flex items-center px-4 gap-4 flex-shrink-0">
          <button onClick={() => setMobileOpen(true)} className="lg:hidden text-slate-400 hover:text-slate-100">
            <Menu size={20} />
          </button>
          <div className="flex-1" />
          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-medium text-slate-200">{user?.full_name}</p>
              <p className="text-xs text-slate-500 capitalize">{user?.role}</p>
            </div>
            <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center text-sm font-bold text-white">
              {user?.full_name?.[0]?.toUpperCase() || 'U'}
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto p-6">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <Outlet />
          </motion.div>
        </main>
      </div>
    </div>
  )
}
