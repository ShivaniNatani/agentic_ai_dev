import React, { useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
    AlertCircle, AlertTriangle, CheckCircle, Clock, Bell, Filter,
    Search, Zap, Activity, ChevronDown, ChevronRight, X
} from 'lucide-react'
import { useDashboardContext } from '../context/DashboardContext'
import { useAlerts } from '../hooks/useAlerts'
import FilterPanel from '../components/FilterPanel'
import RootCauseAnalysis from '../components/RootCauseAnalysis'
import GenAIChatOverlay from '../components/GenAIChatOverlay'

const severityIcon = {
    critical: <AlertCircle className="w-4 h-4 text-red-500" />,
    warning: <AlertTriangle className="w-4 h-4 text-amber-400" />,
    info: <CheckCircle className="w-4 h-4 text-cyan-400" />,
}

export default function Alerts() {
    const { filters } = useDashboardContext()
    const [selectedAlert, setSelectedAlert] = useState(null)
    const [viewMode, setViewMode] = useState('list') // 'list' or 'grid'

    const params = {
        model: filters.model,
        client: filters.client,
        start_date: filters.startDate,
        end_date: filters.endDate,
    }
    const { data: alertsData, isLoading } = useAlerts(params)

    // Map backend data to frontend structure
    const alerts = useMemo(() => {
        if (!alertsData?.alerts?.rows) return []
        return alertsData.alerts.rows.map(row => ({
            id: Math.random().toString(36).substr(2, 9),
            severity: row.severity,
            metric: row.signal,
            message: `${row.signal} observed ${row.observed?.toFixed(2)} vs threshold ${row.threshold?.toFixed(2)}`,
            model: row.model || filters.model || 'Unknown',
            client: row.client || filters.client || 'Unknown',
            timestamp: row.date_of_model_refresh || new Date().toISOString(),
            status: 'open'
        }))
    }, [alertsData, filters.model, filters.client])

    if (!alertsData) {
        return (
            <div className="flex items-center justify-center h-64 border border-red-500/20 bg-red-900/10 rounded-xl m-6">
                <div className="text-center">
                    <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
                    <h3 className="text-white font-bold">Unable to fetch alerts</h3>
                    <p className="text-red-400 text-sm mt-2">Check backend connection.</p>
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-6 pb-20">
            {/* Features */}
            <RootCauseAnalysis
                isOpen={!!selectedAlert}
                onClose={() => setSelectedAlert(null)}
                alertData={selectedAlert}
            />
            <GenAIChatOverlay />

            {/* Header Block */}
            <div className="bg-[#050505] p-8 rounded-2xl border border-[#1A1A1A] shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 p-8 opacity-10">
                    <Bell className="w-32 h-32 text-indigo-500 transform -rotate-12" />
                </div>

                <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                    <div>
                        <div className="flex items-center gap-2 mb-2">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 uppercase tracking-widest">
                                Command Center
                            </span>
                        </div>
                        <h2 className="text-3xl font-display font-black text-white tracking-tight">
                            Alert Console
                        </h2>
                        <p className="text-gray-400 text-sm mt-2 max-w-xl leading-relaxed">
                            Real-time anomaly detection stream. Select any alert to trigger <span className="text-cyan-400 font-bold">Automated Root Cause Analysis</span>.
                        </p>
                    </div>

                    <div className="flex gap-4">
                        <div className="text-right">
                            <div className="text-[10px] uppercase text-gray-500 font-bold tracking-widest mb-1">Critical</div>
                            <div className="text-3xl font-black text-red-500">{alerts.filter(a => a.severity === 'critical').length}</div>
                        </div>
                        <div className="w-px bg-[#222]" />
                        <div className="text-right">
                            <div className="text-[10px] uppercase text-gray-500 font-bold tracking-widest mb-1">Total</div>
                            <div className="text-3xl font-black text-white">{alerts.length}</div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="bg-[#050505] rounded-xl border border-[#1A1A1A] p-2">
                <FilterPanel availableMetrics={[]} showAdvanced={false} />
            </div>

            {/* Organized List */}
            <div className="bg-[#050505] rounded-2xl border border-[#1A1A1A] shadow-xl overflow-hidden min-h-[500px]">
                {/* Toolbar */}
                <div className="p-4 border-b border-[#1A1A1A] bg-[#0A0A0A] flex justify-between items-center">
                    <div className="flex items-center gap-4">
                        <h3 className="font-bold text-white text-xs uppercase tracking-[0.2em] flex items-center gap-2">
                            <Activity className="w-4 h-4 text-cyan-500" /> Live Feed
                        </h3>
                        <div className="h-4 w-px bg-[#222]" />
                        <span className="text-xs text-gray-500">{alerts.length} events found</span>
                    </div>
                    <div className="flex gap-2">
                        <button className="px-4 py-2 text-xs font-bold text-gray-300 bg-[#151515] border border-gray-700 rounded-lg hover:bg-gray-800 transition-colors flex items-center gap-2">
                            <CheckCircle className="w-3 h-3" /> Dismiss All
                        </button>
                    </div>
                </div>

                {alerts.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-96 opacity-50">
                        <CheckCircle className="w-16 h-16 text-emerald-500 mb-4" />
                        <p className="text-xl text-white font-bold">All Systems Nominal</p>
                        <p className="text-sm text-gray-500 mt-2">No active alerts detected in the current window.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-[#080808] border-b border-[#1A1A1A]">
                                <tr>
                                    <th className="px-6 py-4 text-[10px] uppercase font-bold text-gray-500 tracking-wider">Severity</th>
                                    <th className="px-6 py-4 text-[10px] uppercase font-bold text-gray-500 tracking-wider">Signal Metric</th>
                                    <th className="px-6 py-4 text-[10px] uppercase font-bold text-gray-500 tracking-wider w-1/3">Analysis Message</th>
                                    <th className="px-6 py-4 text-[10px] uppercase font-bold text-gray-500 tracking-wider">Context</th>
                                    <th className="px-6 py-4 text-[10px] uppercase font-bold text-gray-500 tracking-wider text-right">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[#1A1A1A]">
                                {alerts.map((alert, i) => (
                                    <motion.tr
                                        key={alert.id}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: i * 0.05 }}
                                        className="hover:bg-[#0A0A0A] transition-colors group cursor-pointer"
                                        onClick={() => setSelectedAlert(alert)}
                                    >
                                        <td className="px-6 py-5">
                                            <div className="flex items-center gap-3">
                                                <div className={`p-2 rounded-lg ${alert.severity === 'critical' ? 'bg-red-500/10 text-red-500' :
                                                        alert.severity === 'warning' ? 'bg-amber-500/10 text-amber-500' : 'bg-cyan-500/10 text-cyan-500'
                                                    }`}>
                                                    {severityIcon[alert.severity] || severityIcon.info}
                                                </div>
                                                <span className={`font-bold text-xs uppercase ${alert.severity === 'critical' ? 'text-red-400' :
                                                        alert.severity === 'warning' ? 'text-amber-400' : 'text-cyan-400'
                                                    }`}>
                                                    {alert.severity}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-5">
                                            <div className="font-mono text-xs text-white bg-[#151515] px-2 py-1 rounded border border-[#222] inline-block">
                                                {alert.metric}
                                            </div>
                                        </td>
                                        <td className="px-6 py-5">
                                            <span className="text-gray-300 text-sm font-medium leading-relaxed block max-w-md">
                                                {alert.message}
                                            </span>
                                        </td>
                                        <td className="px-6 py-5">
                                            <div className="flex flex-col gap-1">
                                                <div className="flex items-center gap-2">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
                                                    <span className="text-white text-xs font-bold">{alert.model}</span>
                                                </div>
                                                <div className="flex items-center gap-2 pl-3.5">
                                                    <span className="text-[10px] text-gray-500 uppercase tracking-wider">{alert.client}</span>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-5 text-right">
                                            <button
                                                className="opacity-0 group-hover:opacity-100 px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold transition-all flex items-center gap-2 ml-auto shadow-lg shadow-cyan-900/20"
                                            >
                                                <Zap className="w-3 h-3" /> Analyze
                                            </button>
                                        </td>
                                    </motion.tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    )
}
