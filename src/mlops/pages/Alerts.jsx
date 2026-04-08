import React, { useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
    AlertTriangle, Check, ChevronRight, ChevronDown,
    X, RefreshCw, Info, AlertCircle, AlertOctagon, Shield, CheckCircle, Activity
} from 'lucide-react'
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    AreaChart, Area, Legend
} from 'recharts'
import { useDashboardContext } from '../context/DashboardContext'
import { useAlerts } from '../hooks/useAlerts'
import '../styles/mlops-compat.css'

// Generate overall stacked chart data (all severities)
const generateOverallChartData = () => {
    const data = []
    const now = new Date()
    for (let i = 0; i < 24; i++) {
        const time = new Date(now.getTime() - (24 - i) * 3600000)
        data.push({
            hour: `${time.getHours()}:00`,
            critical: Math.floor(Math.random() * 3),
            high: Math.floor(Math.random() * 8),
            medium: Math.floor(Math.random() * 5),
            low: Math.floor(Math.random() * 4),
        })
    }
    return data
}

// --- Severity Configuration ---
const SEVERITY_CONFIG = {
    critical: {
        label: 'Critical',
        bg: '#7f1d1d',
        border: '#dc2626',
        text: '#fca5a5',
        headerBg: '#450a0a',
        icon: AlertOctagon,
        chartColor: '#ef4444'
    },
    high: {
        label: 'High',
        bg: '#78350f',
        border: '#f59e0b',
        text: '#fcd34d',
        headerBg: '#451a03',
        icon: AlertTriangle,
        chartColor: '#f59e0b'
    },
    medium: {
        label: 'Medium',
        bg: '#1e3a5f',
        border: '#3b82f6',
        text: '#93c5fd',
        headerBg: '#172554',
        icon: Info,
        chartColor: '#3b82f6'
    },
    low: {
        label: 'Low',
        bg: '#14532d',
        border: '#22c55e',
        text: '#86efac',
        headerBg: '#052e16',
        icon: CheckCircle,
        chartColor: '#22c55e'
    },
}

// Generate chart data for a specific severity
const generateSeverityChartData = () => {
    const data = []
    const now = new Date()
    for (let i = 0; i < 24; i++) {
        const time = new Date(now.getTime() - (24 - i) * 3600000)
        data.push({
            hour: `${time.getHours()}:00`,
            events: Math.floor(Math.random() * 5)
        })
    }
    return data
}

export default function Alerts() {
    const { filters, setFilters, options, refreshData } = useDashboardContext()
    const [expandedSeverity, setExpandedSeverity] = useState(null)
    const [expandedAlert, setExpandedAlert] = useState(null)

    const { data, isLoading } = useAlerts({
        model: filters.model || undefined,
        client: filters.client !== 'All Clients' ? filters.client : undefined,
        start_date: filters.startDate,
        end_date: filters.endDate,
        include_root_cause: true,
    })

    const alertData = data?.alerts || {}
    const { rows } = alertData

    // Group alerts by severity
    const groupedAlerts = useMemo(() => {
        if (!rows) return { critical: [], high: [], medium: [], low: [] }
        return {
            critical: rows.filter(r => r.severity?.toLowerCase() === 'critical'),
            high: rows.filter(r => r.severity?.toLowerCase() === 'high'),
            medium: rows.filter(r => r.severity?.toLowerCase() === 'medium'),
            low: rows.filter(r => r.severity?.toLowerCase() === 'low' || !r.severity),
        }
    }, [rows])

    const toggleSeverity = (sev) => {
        setExpandedSeverity(expandedSeverity === sev ? null : sev)
        setExpandedAlert(null)
    }

    const handleClientChange = (e) => {
        setFilters({ client: e.target.value })
    }
    const handleModelChange = (e) => {
        setFilters({ model: e.target.value === 'All Models' ? '' : e.target.value })
    }

    const handleRefresh = async () => {
        try {
            await refreshData()
            window.location.reload()
        } catch (err) {
            console.error('Refresh failed:', err)
        }
    }

    return (
        <div className="min-h-screen bg-[#0b0c0e] text-[#c7d0d9] font-sans text-sm pb-20">
            {/* Header */}
            <div className="px-6 py-6 pb-3">
                <h1 className="text-2xl font-normal text-white mb-2">Alert Console</h1>
                <p className="text-sm text-[#9fa7b3]">Alerts organized by severity level. Click to expand each category.</p>
            </div>

            {/* Simple Filter Bar */}
            <div className="px-6 py-3 flex items-center gap-4 flex-wrap border-b border-[#202226] mb-6">
                <span className="text-sm text-[#9fa7b3]">Filter:</span>

                <select
                    value={filters.client || 'All Clients'}
                    onChange={handleClientChange}
                    className="bg-[#181b1f] border border-[#343741] rounded px-3 py-1.5 text-xs text-white focus:outline-none focus:border-[#56a6fa]"
                >
                    <option>All Clients</option>
                    {(options.clients || []).map(c => <option key={c}>{c}</option>)}
                </select>

                <select
                    value={filters.model || 'All Models'}
                    onChange={handleModelChange}
                    className="bg-[#181b1f] border border-[#343741] rounded px-3 py-1.5 text-xs text-white focus:outline-none focus:border-[#56a6fa]"
                >
                    <option>All Models</option>
                    {(options.models || []).map(m => <option key={m}>{m}</option>)}
                </select>

                <button
                    onClick={() => setFilters({ client: 'All Clients', model: '' })}
                    className="flex items-center gap-1.5 px-3 py-1.5 hover:bg-[#181b1f] rounded text-xs text-[#9fa7b3] transition-colors"
                >
                    <X className="w-3 h-3" /> Clear
                </button>

                <div className="ml-auto flex items-center gap-2">
                    {isLoading && <span className="text-xs text-[#56a6fa] animate-pulse">Loading...</span>}
                    <button onClick={handleRefresh} className="p-1.5 hover:bg-[#181b1f] rounded" title="Refresh data from BigQuery">
                        <RefreshCw className="w-4 h-4 text-[#9fa7b3]" />
                    </button>
                </div>
            </div>

            {/* Overall Alerts Chart */}
            <div className="px-6 mb-6">
                <div className="bg-[#131519] border border-[#202226] rounded-lg p-4">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                            <Activity className="w-4 h-4 text-[#56a6fa]" />
                            <h3 className="text-sm font-semibold text-white">Alert Activity - Last 24 Hours</h3>
                        </div>
                        <div className="flex items-center gap-4 text-[10px]">
                            <span className="flex items-center gap-1.5"><span className="w-3 h-2 rounded-sm bg-[#ef4444]"></span> Critical</span>
                            <span className="flex items-center gap-1.5"><span className="w-3 h-2 rounded-sm bg-[#f59e0b]"></span> High</span>
                            <span className="flex items-center gap-1.5"><span className="w-3 h-2 rounded-sm bg-[#3b82f6]"></span> Medium</span>
                            <span className="flex items-center gap-1.5"><span className="w-3 h-2 rounded-sm bg-[#22c55e]"></span> Low</span>
                        </div>
                    </div>
                    <div style={{ height: '160px', width: '100%' }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={generateOverallChartData()}>
                                <defs>
                                    <linearGradient id="criticalGradient" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#ef4444" stopOpacity={0.8} />
                                        <stop offset="95%" stopColor="#ef4444" stopOpacity={0.1} />
                                    </linearGradient>
                                    <linearGradient id="highGradient" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.8} />
                                        <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.1} />
                                    </linearGradient>
                                    <linearGradient id="mediumGradient" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8} />
                                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.1} />
                                    </linearGradient>
                                    <linearGradient id="lowGradient" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#22c55e" stopOpacity={0.8} />
                                        <stop offset="95%" stopColor="#22c55e" stopOpacity={0.1} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#22252b" vertical={false} />
                                <XAxis
                                    dataKey="hour"
                                    tick={{ fill: '#9fa7b3', fontSize: 10 }}
                                    axisLine={false}
                                    tickLine={false}
                                    interval={3}
                                />
                                <YAxis hide />
                                <Tooltip
                                    contentStyle={{
                                        backgroundColor: '#181b1f',
                                        borderColor: '#343741',
                                        color: '#c7d0d9',
                                        fontSize: '11px',
                                        borderRadius: '6px'
                                    }}
                                />
                                <Area type="monotone" dataKey="critical" stackId="1" stroke="#ef4444" fill="url(#criticalGradient)" />
                                <Area type="monotone" dataKey="high" stackId="1" stroke="#f59e0b" fill="url(#highGradient)" />
                                <Area type="monotone" dataKey="medium" stackId="1" stroke="#3b82f6" fill="url(#mediumGradient)" />
                                <Area type="monotone" dataKey="low" stackId="1" stroke="#22c55e" fill="url(#lowGradient)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* Severity Categories */}
            <div className="px-6 space-y-3">
                {Object.entries(SEVERITY_CONFIG).map(([key, config]) => {
                    const alerts = groupedAlerts[key] || []
                    const isExpanded = expandedSeverity === key
                    const Icon = config.icon
                    const chartData = generateSeverityChartData()

                    return (
                        <div key={key} className="rounded-lg overflow-hidden border" style={{ borderColor: config.border }}>
                            {/* Category Header */}
                            <button
                                onClick={() => toggleSeverity(key)}
                                className="w-full flex items-center justify-between px-4 py-3 transition-colors"
                                style={{ backgroundColor: config.headerBg }}
                            >
                                <div className="flex items-center gap-3">
                                    {isExpanded ? (
                                        <ChevronDown className="w-5 h-5" style={{ color: config.text }} />
                                    ) : (
                                        <ChevronRight className="w-5 h-5" style={{ color: config.text }} />
                                    )}
                                    <Icon className="w-5 h-5" style={{ color: config.text }} />
                                    <span className="text-base font-semibold" style={{ color: config.text }}>
                                        {config.label}
                                    </span>
                                </div>
                                <span
                                    className="px-3 py-1 rounded-full text-xs font-bold"
                                    style={{ backgroundColor: config.bg, color: config.text, border: `1px solid ${config.border} ` }}
                                >
                                    {alerts.length} Alert{alerts.length !== 1 ? 's' : ''}
                                </span>
                            </button>

                            {/* Expanded Content */}
                            <AnimatePresence>
                                {isExpanded && (
                                    <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: 'auto', opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        transition={{ duration: 0.2 }}
                                        className="overflow-hidden bg-[#0b0c0e]"
                                    >
                                        <div className="p-4 border-t" style={{ borderColor: config.border }}>
                                            {/* Category Chart */}
                                            <div className="mb-6">
                                                <h4 className="text-xs font-semibold text-[#9fa7b3] uppercase mb-3">
                                                    {config.label} Alerts - Last 24 Hours
                                                </h4>
                                                <div style={{ height: '100px', width: '100%' }}>
                                                    <ResponsiveContainer width="100%" height="100%">
                                                        <BarChart data={chartData}>
                                                            <CartesianGrid vertical={false} stroke="#22252b" strokeDasharray="3 3" />
                                                            <XAxis
                                                                dataKey="hour"
                                                                tick={{ fill: '#9fa7b3', fontSize: 9 }}
                                                                axisLine={false}
                                                                tickLine={false}
                                                                interval={3}
                                                            />
                                                            <YAxis hide />
                                                            <Tooltip contentStyle={{ backgroundColor: '#181b1f', borderColor: '#343741', color: '#c7d0d9', fontSize: '11px' }} />
                                                            <Bar dataKey="events" fill={config.chartColor} radius={[2, 2, 0, 0]} />
                                                        </BarChart>
                                                    </ResponsiveContainer>
                                                </div>
                                            </div>

                                            {/* Alerts Table - Proper HTML Table */}
                                            {alerts.length === 0 ? (
                                                <p className="text-center text-[#9fa7b3] py-4">No {config.label.toLowerCase()} alerts</p>
                                            ) : (
                                                <div className="overflow-x-auto">
                                                    <table className="w-full" style={{ borderCollapse: 'separate', borderSpacing: '0 8px' }}>
                                                        <thead>
                                                            <tr className="text-left">
                                                                <th className="px-3 py-2 text-[10px] font-semibold text-[#9fa7b3] uppercase w-8"></th>
                                                                <th className="px-3 py-2 text-[10px] font-semibold text-[#9fa7b3] uppercase w-40">Timestamp</th>
                                                                <th className="px-3 py-2 text-[10px] font-semibold text-[#9fa7b3] uppercase">Alert Rule</th>
                                                                <th className="px-3 py-2 text-[10px] font-semibold text-[#9fa7b3] uppercase w-32">Client</th>
                                                                <th className="px-3 py-2 text-[10px] font-semibold text-[#9fa7b3] uppercase w-48">Model</th>
                                                                <th className="px-3 py-2 text-[10px] font-semibold text-[#9fa7b3] uppercase w-20 text-center">Status</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {alerts.map((alert, idx) => (
                                                                <AlertTableRow
                                                                    key={idx}
                                                                    alert={alert}
                                                                    config={config}
                                                                    isExpanded={expandedAlert === `${key} -${idx} `}
                                                                    onToggle={() => setExpandedAlert(expandedAlert === `${key} -${idx} ` ? null : `${key} -${idx} `)}
                                                                />
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            )}
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}

// --- Alert Table Row Component ---
function AlertTableRow({ alert, config, isExpanded, onToggle }) {
    return (
        <>
            <tr
                onClick={onToggle}
                className="cursor-pointer hover:bg-[#131519] transition-colors"
                style={{ backgroundColor: isExpanded ? '#131519' : 'transparent' }}
            >
                <td className="px-3 py-3 rounded-l-lg">
                    {isExpanded ? (
                        <ChevronDown className="w-4 h-4" style={{ color: config.text }} />
                    ) : (
                        <ChevronRight className="w-4 h-4 text-[#9fa7b3]" />
                    )}
                </td>
                <td className="px-3 py-3 text-[11px] font-mono text-[#c7d0d9]">
                    {alert.timestamp?.replace('T', ' ').slice(0, 16)}
                </td>
                <td className="px-3 py-3">
                    <span className="text-sm font-medium" style={{ color: config.text }}>
                        {alert.signal || 'Unknown Alert'}
                    </span>
                </td>
                <td className="px-3 py-3">
                    <span className="inline-block px-2 py-1 rounded text-[10px] bg-[#181b1f] border border-[#343741] text-[#c7d0d9]">
                        {alert.client}
                    </span>
                </td>
                <td className="px-3 py-3 text-xs text-[#9fa7b3]">
                    {alert.model}
                </td>
                <td className="px-3 py-3 rounded-r-lg text-center">
                    <span
                        className="inline-block w-3 h-3 rounded-full"
                        style={{ backgroundColor: config.chartColor }}
                    ></span>
                </td>
            </tr>

            {/* Expanded Details Row */}
            {isExpanded && (
                <tr style={{ backgroundColor: '#0f1114' }}>
                    <td colSpan={6} className="px-0 py-0">
                        <div
                            className="mx-3 mb-2 p-4 rounded-lg border-l-4"
                            style={{ borderColor: config.border, backgroundColor: '#131519' }}
                        >
                            <div className="flex gap-8">
                                {/* State Transition */}
                                <div className="flex-1">
                                    <p className="text-[10px] text-[#9fa7b3] font-semibold mb-2 uppercase tracking-wide">State Transition</p>
                                    <div className="flex items-center gap-2 text-sm">
                                        <span className="flex items-center gap-1.5 text-[#73bf69] font-medium">
                                            <Check className="w-4 h-4" /> Normal
                                        </span>
                                        <span className="text-[#9fa7b3] text-lg">→</span>
                                        <span className="flex items-center gap-1.5 font-medium" style={{ color: config.text }}>
                                            <AlertTriangle className="w-4 h-4" /> {config.label}
                                        </span>
                                    </div>
                                </div>

                                {/* Threshold Values */}
                                <div className="flex-1">
                                    <p className="text-[10px] text-[#9fa7b3] font-semibold mb-2 uppercase tracking-wide">Threshold</p>
                                    <div className="flex items-center gap-4">
                                        <div className="text-center">
                                            <p className="text-[10px] text-[#9fa7b3]">Value</p>
                                            <p className="text-lg font-mono font-bold" style={{ color: config.text }}>
                                                {alert.observed?.toFixed(2)}
                                            </p>
                                        </div>
                                        <div className="text-2xl text-[#9fa7b3]">/</div>
                                        <div className="text-center">
                                            <p className="text-[10px] text-[#9fa7b3]">Limit</p>
                                            <p className="text-lg font-mono font-bold text-[#c7d0d9]">
                                                {alert.threshold?.toFixed(2)}
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {/* Labels */}
                                <div className="flex-1">
                                    <p className="text-[10px] text-[#9fa7b3] font-semibold mb-2 uppercase tracking-wide">Labels</p>
                                    <div className="flex flex-wrap gap-2">
                                        <span
                                            className="inline-flex items-center px-2.5 py-1 rounded text-[10px] font-mono"
                                            style={{ backgroundColor: config.bg, color: config.text, border: `1px solid ${config.border} ` }}
                                        >
                                            client={alert.client}
                                        </span>
                                        <span
                                            className="inline-flex items-center px-2.5 py-1 rounded text-[10px] font-mono"
                                            style={{ backgroundColor: config.bg, color: config.text, border: `1px solid ${config.border} ` }}
                                        >
                                            model={alert.model}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </td>
                </tr>
            )}
        </>
    )
}
