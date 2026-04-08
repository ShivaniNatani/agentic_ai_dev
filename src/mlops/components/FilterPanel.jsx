import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, ChevronUp, Filter, RotateCw, Calendar, Sliders } from 'lucide-react'
import { useDashboardContext } from '../context/DashboardContext'
import '../styles/mlops-compat.css'

export default function FilterPanel({ rangeOptions = [], availableMetrics = [], showAdvanced = false, showMetrics = false }) {
    const { filters, setFilters, options, refreshData, meta } = useDashboardContext()
    const [isExpanded, setIsExpanded] = useState(false)

    const quickDateRanges = [
        { label: '7D', days: 7 },
        { label: '30D', days: 30 },
        { label: '90D', days: 90 },
    ]

    const setQuickRange = (days) => {
        const end = new Date()
        const start = new Date()
        start.setDate(start.getDate() - days)
        setFilters({
            startDate: start.toISOString().split('T')[0],
            endDate: end.toISOString().split('T')[0],
        })
    }

    return (
        <div className="card-outline overflow-hidden">
            {/* Collapsed Header */}
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full p-4 flex items-center justify-between hover:bg-white/5 transition-colors"
            >
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-cyan-500/10 border border-cyan-500/20">
                        <Filter className="w-4 h-4 text-cyan-400" />
                    </div>
                    <div className="text-left">
                        <h3 className="text-sm font-semibold text-white">Filters</h3>
                        <p className="text-xs text-slate-400">
                            {filters.model} · {filters.client} · {filters.startDate} to {filters.endDate}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    {meta?.latest_data_point && (
                        <span className="text-xs text-slate-500 bg-slate-800 px-2 py-1 rounded">
                            Data: {meta.latest_data_point.split('T')[0]}
                        </span>
                    )}
                    <motion.div
                        animate={{ rotate: isExpanded ? 180 : 0 }}
                        transition={{ duration: 0.2 }}
                    >
                        <ChevronDown className="w-5 h-5 text-slate-400" />
                    </motion.div>
                </div>
            </button>

            {/* Expanded Content */}
            <AnimatePresence>
                {isExpanded && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                    >
                        <div className="p-4 pt-0 border-t border-white/5">
                            {/* Quick Date Ranges */}
                            <div className="flex items-center gap-2 mb-4">
                                <Calendar className="w-4 h-4 text-slate-400" />
                                <span className="text-xs text-slate-400 mr-2">Quick:</span>
                                {quickDateRanges.map((range) => (
                                    <button
                                        key={range.label}
                                        onClick={() => setQuickRange(range.days)}
                                        className="px-3 py-1 rounded text-xs font-medium bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white transition-colors border border-white/5"
                                    >
                                        {range.label}
                                    </button>
                                ))}
                            </div>

                            {/* Main Filters Grid */}
                            <div className="grid gap-4 md:grid-cols-4">
                                {/* Model */}
                                <div>
                                    <label className="text-[10px] uppercase tracking-widest text-slate-500 block mb-1.5 font-semibold">Model</label>
                                    <select
                                        value={filters.model}
                                        onChange={(e) => setFilters({ model: e.target.value })}
                                        className="w-full px-3 py-2 rounded-lg bg-slate-800/50 border border-white/10 text-white text-sm focus:border-cyan-500/50 focus:outline-none transition-colors"
                                    >
                                        {options.models.map(m => <option key={m} value={m}>{m}</option>)}
                                    </select>
                                </div>

                                {/* Client */}
                                <div>
                                    <label className="text-[10px] uppercase tracking-widest text-slate-500 block mb-1.5 font-semibold">Client</label>
                                    <select
                                        value={filters.client}
                                        onChange={(e) => setFilters({ client: e.target.value })}
                                        className="w-full px-3 py-2 rounded-lg bg-slate-800/50 border border-white/10 text-white text-sm focus:border-cyan-500/50 focus:outline-none transition-colors"
                                    >
                                        <option value="All Clients">All Clients</option>
                                        {options.clients.map(c => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                </div>

                                {/* Start Date */}
                                <div>
                                    <label className="text-[10px] uppercase tracking-widest text-slate-500 block mb-1.5 font-semibold">Start Date</label>
                                    <input
                                        type="date"
                                        value={filters.startDate}
                                        onChange={(e) => setFilters({ startDate: e.target.value })}
                                        className="w-full px-3 py-2 rounded-lg bg-slate-800/50 border border-white/10 text-white text-sm focus:border-cyan-500/50 focus:outline-none transition-colors"
                                    />
                                </div>

                                {/* End Date */}
                                <div>
                                    <label className="text-[10px] uppercase tracking-widest text-slate-500 block mb-1.5 font-semibold">End Date</label>
                                    <input
                                        type="date"
                                        value={filters.endDate}
                                        onChange={(e) => setFilters({ endDate: e.target.value })}
                                        className="w-full px-3 py-2 rounded-lg bg-slate-800/50 border border-white/10 text-white text-sm focus:border-cyan-500/50 focus:outline-none transition-colors"
                                    />
                                </div>
                            </div>

                            {/* Advanced Filters */}
                            {showAdvanced && (
                                <div className="mt-4 pt-4 border-t border-white/5">
                                    <div className="flex items-center gap-2 mb-3">
                                        <Sliders className="w-4 h-4 text-slate-400" />
                                        <span className="text-xs text-slate-400 font-semibold">Advanced</span>
                                    </div>
                                    <div className="grid gap-4 md:grid-cols-4">
                                        {/* Version */}
                                        <div>
                                            <label className="text-[10px] uppercase tracking-widest text-slate-500 block mb-1.5 font-semibold">Version</label>
                                            <select
                                                value={filters.version}
                                                onChange={(e) => setFilters({ version: e.target.value })}
                                                className="w-full px-3 py-2 rounded-lg bg-slate-800/50 border border-white/10 text-white text-sm focus:border-cyan-500/50 focus:outline-none transition-colors"
                                            >
                                                <option value="All Versions">All Versions</option>
                                                {(options.versions || []).map(v => <option key={v} value={v}>{v}</option>)}
                                            </select>
                                        </div>

                                        {/* Threshold Mode */}
                                        <div>
                                            <label className="text-[10px] uppercase tracking-widest text-slate-500 block mb-1.5 font-semibold">Threshold</label>
                                            <select
                                                value={filters.thresholdMode}
                                                onChange={(e) => setFilters({ thresholdMode: e.target.value })}
                                                className="w-full px-3 py-2 rounded-lg bg-slate-800/50 border border-white/10 text-white text-sm focus:border-cyan-500/50 focus:outline-none transition-colors"
                                            >
                                                <option value="All data">All data</option>
                                                <option value="Above threshold">Above threshold</option>
                                                <option value="Below threshold">Below threshold</option>
                                            </select>
                                        </div>

                                        {/* Trend Window */}
                                        <div>
                                            <label className="text-[10px] uppercase tracking-widest text-slate-500 block mb-1.5 font-semibold">Trend Window</label>
                                            <select
                                                value={filters.trendWindow}
                                                onChange={(e) => setFilters({ trendWindow: Number(e.target.value) })}
                                                className="w-full px-3 py-2 rounded-lg bg-slate-800/50 border border-white/10 text-white text-sm focus:border-cyan-500/50 focus:outline-none transition-colors"
                                            >
                                                <option value="3">3 Points</option>
                                                <option value="5">5 Points</option>
                                                <option value="7">7 Points</option>
                                                <option value="14">14 Points</option>
                                            </select>
                                        </div>

                                        {/* Range */}
                                        {rangeOptions.length > 1 && (
                                            <div>
                                                <label className="text-[10px] uppercase tracking-widest text-slate-500 block mb-1.5 font-semibold">Range</label>
                                                <select
                                                    value={filters.ranges?.[0] || 'All ranges'}
                                                    onChange={(e) => setFilters({ ranges: [e.target.value] })}
                                                    className="w-full px-3 py-2 rounded-lg bg-slate-800/50 border border-white/10 text-white text-sm focus:border-cyan-500/50 focus:outline-none transition-colors"
                                                >
                                                    {rangeOptions.map(r => <option key={r} value={r}>{r}</option>)}
                                                </select>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Metrics Selection */}
                            {showMetrics && availableMetrics && availableMetrics.length > 0 && (
                                <div className="mt-4 pt-4 border-t border-white/5">
                                    <label className="text-[10px] uppercase tracking-widest text-slate-500 block mb-2 font-semibold">Metrics</label>
                                    <div className="flex flex-wrap gap-2">
                                        {availableMetrics.map((metric) => {
                                            const isSelected = filters.metrics?.includes(metric)
                                            return (
                                                <button
                                                    key={metric}
                                                    onClick={() => {
                                                        const current = filters.metrics || []
                                                        if (isSelected) {
                                                            setFilters({ metrics: current.filter(m => m !== metric) })
                                                        } else {
                                                            setFilters({ metrics: [...current, metric] })
                                                        }
                                                    }}
                                                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${isSelected
                                                            ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40'
                                                            : 'bg-slate-800/50 text-slate-400 border border-white/10 hover:text-white hover:border-white/20'
                                                        }`}
                                                >
                                                    {metric.replace(/_/g, ' ')}
                                                </button>
                                            )
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* Actions */}
                            <div className="mt-4 pt-4 border-t border-white/5 flex justify-between items-center">
                                <button
                                    onClick={() => setFilters({
                                        client: 'All Clients',
                                        version: 'All Versions',
                                        thresholdMode: 'All data',
                                        ranges: ['All ranges'],
                                    })}
                                    className="text-xs text-slate-400 hover:text-white transition-colors"
                                >
                                    Reset Filters
                                </button>
                                <button
                                    onClick={refreshData}
                                    className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-medium transition-colors flex items-center gap-2"
                                >
                                    <RotateCw className="w-4 h-4" />
                                    Refresh Data
                                </button>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}
