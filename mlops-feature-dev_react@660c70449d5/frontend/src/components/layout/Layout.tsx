import { useState, type ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import {
    Activity,
    AlertTriangle,
    ClipboardList,
    Clock,
    LayoutDashboard,
    Menu,
    Settings,
    TrendingUp,
} from 'lucide-react'
import ChatAssistant from '../chat/ChatAssistant'
import { useDashboardContext } from '../../context/DashboardContext'

export default function Layout({ children }: { children: ReactNode }) {
    const [sidebarOpen, setSidebarOpen] = useState(false)
    const { filters } = useDashboardContext()

    return (
        <div className="flex min-h-screen relative bg-gradient-dark">
            <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
            <main className="flex-1 p-6 md:p-10 md:ml-64 relative z-10">
                <div className="max-w-7xl mx-auto space-y-6">
                    <div className="flex items-center justify-between">
                        <button
                            type="button"
                            onClick={() => setSidebarOpen(true)}
                            className="md:hidden glass-card px-3 py-2 text-white flex items-center gap-2"
                        >
                            <Menu className="w-4 h-4" />
                            Menu
                        </button>
                    </div>
                    {children}
                </div>
            </main>
            <ChatAssistant
                context={{
                    model: filters.model,
                    client: filters.client,
                    version: filters.version,
                    start_date: filters.startDate,
                    end_date: filters.endDate,
                    metrics: filters.metrics,
                    ranges: filters.ranges,
                    threshold_mode: filters.thresholdMode,
                    quick_range: filters.quickRange,
                    period: `${filters.startDate} to ${filters.endDate}`,
                }}
            />
        </div>
    )
}

function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
    return (
        <div
            className={`fixed inset-y-0 left-0 w-64 glass-card border-r border-white/10 z-50 transform transition-transform duration-300 ${
                open ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
            }`}
        >
            <div className="p-6 flex flex-col h-full bg-dark-900/80 rounded-xl">
                <div className="flex items-center justify-between mb-8">
                    <h1 className="text-2xl font-bold text-white">
                        <span className="text-primary-500">ML</span> Observatory
                    </h1>
                    <button type="button" onClick={onClose} className="md:hidden text-slate-400 hover:text-white">
                        Close
                    </button>
                </div>
                <nav className="space-y-2">
                    <NavItem to="/" icon={LayoutDashboard} label="Overview" />
                    <NavItem to="/system-health" icon={Activity} label="System Health" />
                    <NavItem to="/performance" icon={TrendingUp} label="Performance" />
                    <NavItem to="/drift" icon={TrendingUp} label="Drift" />
                    <NavItem to="/latency" icon={Clock} label="Latency" />
                    <NavItem to="/alerts" icon={AlertTriangle} label="Alerts" />
                    <NavItem to="/incidents" icon={ClipboardList} label="Incident History" />
                    <NavItem to="/settings" icon={Settings} label="Settings" />
                </nav>

                <div className="mt-auto">
                    <div className="glass-card p-4 bg-dark-750/80 border border-white/5">
                        <p className="text-xs text-slate-400 uppercase tracking-[0.2em]">System Pulse</p>
                        <div className="flex items-center gap-2 mt-3">
                            <div className="w-2 h-2 rounded-full bg-success animate-pulse"></div>
                            <span className="text-xs font-mono text-success">Live</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

function NavItem({ to, icon: Icon, label }: any) {
    const location = useLocation()
    const isActive = location.pathname === to

    return (
        <Link to={to}>
            <div
                className={`flex items-center gap-3 px-4 py-3 rounded-lg border transition-all duration-200 ${
                    isActive
                        ? 'bg-dark-750 text-white border-primary-500 shadow-glow'
                        : 'text-slate-400 hover:text-white hover:bg-dark-800 border-transparent'
                }`}
            >
                <Icon className={`w-5 h-5 ${isActive ? 'text-primary-500' : ''}`} />
                <span className="font-medium">{label}</span>
            </div>
        </Link>
    )
}
