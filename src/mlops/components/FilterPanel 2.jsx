import React from 'react'
import { useDashboardContext } from '../context/DashboardContext'
import { Filter, RefreshCw, Calendar, ChevronDown } from 'lucide-react'
import '../styles/mlops-compat.css'

export default function FilterPanel({ rangeOptions = [], availableMetrics = [], showAdvanced = false, showMetrics = false }) {
    const { filters, setFilters, options, refreshData, meta } = useDashboardContext()

    return (
        <div className="dashboard-card p-6">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                    <Filter className="w-5 h-5 text-primary-400" />
                    Filters
                </h3>
                <div className="text-xs text-slate-400">
                    {meta?.latest_data_point ? `Data: ${meta.latest_data_point.split('T')[0]}` : 'No data'}
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Model Selector */}
                <div className="space-y-1">
                    <label className="text-xs uppercase tracking-wider text-slate-500 font-semibold">Model</label>
                    <div className="relative">
                        <select
                            className="w-full bg-dark-900 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-primary-500 outline-none appearance-none cursor-pointer hover:border-white/20 transition-colors"
                            value={filters.model}
                            onChange={(e) => setFilters({ model: e.target.value })}
                        >
                            {options.models.map(m => <option key={m} value={m}>{m}</option>)}
                        </select>
                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
                    </div>
                </div>

                {/* Client Selector */}
                <div className="space-y-1">
                    <label className="text-xs uppercase tracking-wider text-slate-500 font-semibold">Client</label>
                    <div className="relative">
                        <select
                            className="w-full bg-dark-900 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-primary-500 outline-none appearance-none cursor-pointer hover:border-white/20 transition-colors"
                            value={filters.client}
                            onChange={(e) => setFilters({ client: e.target.value })}
                        >
                            <option value="All Clients">All Clients</option>
                            {options.clients.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
                    </div>
                </div>

                {/* Start Date */}
                <div className="space-y-1">
                    <label className="text-xs uppercase tracking-wider text-slate-500 font-semibold">Start Date</label>
                    <div className="relative">
                        <input
                            type="date"
                            className="w-full bg-dark-900 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-primary-500 outline-none cursor-pointer hover:border-white/20 transition-colors"
                            value={filters.startDate}
                            onChange={(e) => setFilters({ startDate: e.target.value })}
                        />
                        <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
                    </div>
                </div>

                {/* End Date */}
                <div className="space-y-1">
                    <label className="text-xs uppercase tracking-wider text-slate-500 font-semibold">End Date</label>
                    <div className="relative">
                        <input
                            type="date"
                            className="w-full bg-dark-900 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-primary-500 outline-none cursor-pointer hover:border-white/20 transition-colors"
                            value={filters.endDate}
                            onChange={(e) => setFilters({ endDate: e.target.value })}
                        />
                        <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
                    </div>
                </div>
            </div>

            {showAdvanced && (
                <div className="mt-4 pt-4 border-t border-white/5 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                        <label className="text-xs uppercase tracking-wider text-slate-500 font-semibold">Threshold Mode</label>
                        <div className="relative">
                            <select
                                className="w-full bg-dark-900 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-primary-500 outline-none appearance-none cursor-pointer hover:border-white/20 transition-colors"
                                value={filters.thresholdMode}
                                onChange={(e) => setFilters({ thresholdMode: e.target.value })}
                            >
                                <option value="All data">All data</option>
                                <option value="Above threshold">Above threshold</option>
                                <option value="Below threshold">Below threshold</option>
                            </select>
                            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
                        </div>
                    </div>
                    <div className="space-y-1">
                        <label className="text-xs uppercase tracking-wider text-slate-500 font-semibold">Trend Window</label>
                        <div className="relative">
                            <select
                                className="w-full bg-dark-900 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-primary-500 outline-none appearance-none cursor-pointer hover:border-white/20 transition-colors"
                                value={filters.trendWindow}
                                onChange={(e) => setFilters({ trendWindow: Number(e.target.value) })}
                            >
                                <option value="3">3 Points</option>
                                <option value="5">5 Points</option>
                                <option value="7">7 Points</option>
                            </select>
                            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
                        </div>
                    </div>
                </div>
            )}

            <div className="mt-6 flex justify-end border-t border-white/5 pt-4">
                <button
                    onClick={refreshData}
                    className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-500 text-white rounded-lg transition-colors shadow-lg shadow-primary-900/20"
                >
                    <RefreshCw className="w-4 h-4" />
                    <span>Refresh Data</span>
                </button>
            </div>
        </div>
    )
}
