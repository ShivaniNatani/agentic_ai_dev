import React, { useState } from 'react'
import {
    Activity,
    AlertTriangle,
    ClipboardList,
    Clock,
    LayoutDashboard,
    Menu,
    Settings as SettingsIcon,
    TrendingUp,
    LogOut
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { DashboardProvider } from '../context/DashboardContext'
import Overview from '../pages/Overview'
import SystemHealth from '../pages/SystemHealth'
import Performance from '../pages/Performance'
import Drift from '../pages/Drift'
import Latency from '../pages/Latency'
import Alerts from '../pages/Alerts'
import Incidents from '../pages/Incidents'
import Settings from '../pages/Settings'

// Import strict layout styles
import '../styles/MLOpsLayout.css'
import '../styles/mlops-compat.css'

export default function MLOpsLayout() {
    const [sidebarOpen, setSidebarOpen] = useState(false)
    const [currentView, setCurrentView] = useState('overview')

    const renderContent = () => {
        switch (currentView) {
            case 'overview': return <Overview />
            case 'system-health': return <SystemHealth />
            case 'performance': return <Performance />
            case 'drift': return <Drift />
            case 'latency': return <Latency />
            case 'alerts': return <Alerts />
            case 'incidents': return <Incidents />
            case 'settings': return <Settings />
            default: return <Overview />
        }
    }

    const getViewTitle = () => {
        return currentView.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
    }

    return (
        <DashboardProvider>
            <div className="mlops-root">
                {/* Mobile Overlay */}
                {sidebarOpen && (
                    <div
                        className="mlops-mobile-overlay md:hidden"
                        onClick={() => setSidebarOpen(false)}
                    />
                )}

                {/* Sidebar */}
                <aside className={`mlops-sidebar ${sidebarOpen ? 'open' : ''}`}>
                    <div className="mlops-brand">
                        <span>ML</span> Observatory
                    </div>

                    <nav className="flex-1 space-y-1">
                        <NavItem
                            label="Overview"
                            icon={LayoutDashboard}
                            isActive={currentView === 'overview'}
                            onClick={() => { setCurrentView('overview'); setSidebarOpen(false); }}
                        />
                        <NavItem
                            label="System Health"
                            icon={Activity}
                            isActive={currentView === 'system-health'}
                            onClick={() => { setCurrentView('system-health'); setSidebarOpen(false); }}
                        />
                        <NavItem
                            label="Performance"
                            icon={TrendingUp}
                            isActive={currentView === 'performance'}
                            onClick={() => { setCurrentView('performance'); setSidebarOpen(false); }}
                        />
                        <NavItem
                            label="Drift Analysis"
                            icon={TrendingUp}
                            isActive={currentView === 'drift'}
                            onClick={() => { setCurrentView('drift'); setSidebarOpen(false); }}
                        />
                        <NavItem
                            label="Latency"
                            icon={Clock}
                            isActive={currentView === 'latency'}
                            onClick={() => { setCurrentView('latency'); setSidebarOpen(false); }}
                        />
                        <NavItem
                            label="Alert Console"
                            icon={AlertTriangle}
                            isActive={currentView === 'alerts'}
                            onClick={() => { setCurrentView('alerts'); setSidebarOpen(false); }}
                        />
                        <NavItem
                            label="Incidents"
                            icon={ClipboardList}
                            isActive={currentView === 'incidents'}
                            onClick={() => { setCurrentView('incidents'); setSidebarOpen(false); }}
                        />
                        <NavItem
                            label="Settings"
                            icon={SettingsIcon}
                            isActive={currentView === 'settings'}
                            onClick={() => { setCurrentView('settings'); setSidebarOpen(false); }}
                        />
                    </nav>

                    <div className="mt-8 border-t border-white/10 pt-4">
                        <Link to="/dashboard" className="mlops-nav-item text-slate-400 hover:text-white">
                            <LogOut className="mlops-nav-icon" />
                            <span>Exit MLOps</span>
                        </Link>
                    </div>
                </aside>

                {/* Main Content */}
                <main className="mlops-content">
                    <div className="flex items-center gap-4 mb-6 md:hidden">
                        <button
                            className="p-2 bg-slate-800 rounded-lg text-white"
                            onClick={() => setSidebarOpen(true)}
                        >
                            <Menu className="w-5 h-5" />
                        </button>
                        <h2 className="text-xl font-bold text-white">{getViewTitle()}</h2>
                    </div>

                    <div className="max-w-7xl mx-auto pb-20">
                        {renderContent()}
                    </div>
                </main>
            </div>
        </DashboardProvider>
    )
}

function NavItem({ label, icon: Icon, isActive, onClick }) {
    return (
        <button
            onClick={onClick}
            className={`mlops-nav-item w-full ${isActive ? 'active' : ''}`}
        >
            <Icon className={`mlops-nav-icon ${isActive ? 'text-primary-400' : ''}`} />
            <span>{label}</span>
        </button>
    )
}
