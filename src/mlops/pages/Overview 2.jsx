import React, { useMemo } from 'react'
import { motion } from 'framer-motion'
import { useDashboardContext } from '../context/DashboardContext'
import { useDashboardData } from '../hooks/useDashboardData'
import FilterPanel from '../components/FilterPanel'
import LineChartCard from '../components/LineChartCard'
import GenAIChatOverlay from '../components/GenAIChatOverlay'
import { buildSeries, buildSummaryCards } from '../utils/metrics'
import '../styles/mlops-compat.css'

const palette = ['#22d3ee', '#f472b6', '#a78bfa', '#34d399', '#facc15']

export default function Overview() {
    const { filters, meta } = useDashboardContext()

    const params = useMemo(() => ({
        model: filters.model,
        client: filters.client,
        version: filters.version,
        start_date: filters.startDate,
        end_date: filters.endDate,
        threshold_mode: filters.thresholdMode,
        ranges: filters.ranges.join(','),
        metrics: filters.metrics.join(','),
    }), [filters])

    const { data, isLoading, error } = useDashboardData(params)

    const rangeOptions = useMemo(() => {
        if (!data?.records) return ['All ranges']
        const ranges = new Set()
        data.records.forEach((row) => {
            if (row.threshold_range_label) {
                ranges.add(row.threshold_range_label)
            }
        })
        return ['All ranges', ...Array.from(ranges)]
    }, [data])

    const summaryCards = useMemo(() => buildSummaryCards(data?.summary ?? []), [data])

    const accuracySeries = useMemo(() => {
        if (!data?.records) return { data: [], seriesKeys: [] }
        return buildSeries(data.records, 'Overall_Accuracy', filters.client, filters.trendWindow)
    }, [data, filters.client, filters.trendWindow])

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-96">
                <div className="text-center">
                    <div className="w-12 h-12 border-4 border-cyan-500/20 border-t-cyan-500 rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-slate-400">Loading dashboard...</p>
                </div>
            </div>
        )
    }

    if (error || !data) {
        return (
            <div className="flex items-center justify-center h-96">
                <div className="text-center text-red-400">
                    <p className="text-xl font-bold mb-2">Unable to load dashboard</p>
                    <p className="text-sm">Check backend connectivity at http://localhost:8510</p>
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            <GenAIChatOverlay />

            {/* Header Section */}
            <div className="card-outline p-6 border border-white/10">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div>
                        <p className="text-xs uppercase tracking-widest text-slate-400 mb-1">Model Monitoring</p>
                        <h2 className="text-3xl font-bold text-white flex flex-wrap items-center gap-3">
                            {filters.model || 'Active Deployment'}
                            <span className="pill">{filters.client}</span>
                            {filters.version && <span className="pill">{filters.version}</span>}
                        </h2>
                        <p className="text-slate-400 mt-2 text-sm">
                            Drift, latency, and stability snapshot for model performance.
                        </p>
                    </div>
                    <div className="flex flex-wrap gap-3">
                        <StatPill label="Latest Refresh" value={meta?.latest_data_point?.split('T')[0] || 'n/a'} />
                        <StatPill label="Data Source" value={meta?.data_source || 'local'} />
                    </div>
                </div>
            </div>

            {/* Filters */}
            <FilterPanel rangeOptions={rangeOptions} availableMetrics={data.available_metrics} showAdvanced showMetrics />

            {/* Summary Cards */}
            {summaryCards.length > 0 && (
                <div className="grid gap-4 md:grid-cols-3">
                    {summaryCards.slice(0, 3).map((card, idx) => (
                        <motion.div
                            key={card.label}
                            className="card-outline p-5"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: idx * 0.05 }}
                        >
                            <p className="text-xs uppercase tracking-widest text-slate-400 font-semibold">{card.label}</p>
                            <div className="mt-2 flex items-end justify-between">
                                <span className="text-3xl font-bold text-white">{card.value}</span>
                                <span className={`text-xs font-semibold px-2 py-0.5 rounded ${card.status === 'Improving' ? 'bg-emerald-500/20 text-emerald-400' :
                                        card.status === 'Declining' ? 'bg-red-500/20 text-red-400' :
                                            'bg-slate-500/20 text-slate-400'
                                    }`}>{card.status}</span>
                            </div>
                            <p className="text-xs text-slate-500 mt-2">Delta: {card.delta > 0 ? '+' : ''}{card.delta}%</p>
                        </motion.div>
                    ))}
                </div>
            )}

            {/* Main Chart */}
            <LineChartCard
                title="Accuracy Trend"
                description="Performance over time vs Threshold"
                data={accuracySeries.data}
                lines={[
                    ...accuracySeries.seriesKeys.map((key, index) => ({
                        key,
                        label: key,
                        color: palette[index % palette.length],
                    })),
                    { key: 'threshold', label: 'Threshold', color: '#ef4444', dash: '4 4' },
                ]}
                yLabel="Accuracy"
            />

            {/* Quick Stats */}
            <div className="grid md:grid-cols-2 gap-6">
                <div className="card-outline p-5">
                    <h3 className="text-lg font-semibold text-white mb-4">Coverage Snapshot</h3>
                    <div className="flex items-center gap-6">
                        <div>
                            <p className="text-xs uppercase tracking-widest text-slate-400">Total Clients</p>
                            <p className="text-3xl font-bold text-white mt-1">
                                {new Set(data.records.map((row) => row.client_name)).size}
                            </p>
                        </div>
                        <div className="flex-1">
                            <p className="text-xs text-slate-400 mb-1">Active Coverage</p>
                            <div className="w-full h-2 bg-slate-700 rounded-full overflow-hidden">
                                <div className="h-full bg-cyan-500 w-[94%]" />
                            </div>
                        </div>
                    </div>
                </div>
                <div className="card-outline p-5">
                    <h3 className="text-lg font-semibold text-white mb-4">Quick Actions</h3>
                    <div className="grid grid-cols-2 gap-2">
                        {['Drift Report', 'Raw Data', 'Alerts Config', 'System Logs'].map((action) => (
                            <button key={action} className="p-3 rounded-lg bg-slate-800/50 border border-white/5 hover:bg-slate-700/50 text-left transition-colors">
                                <span className="text-white text-sm font-medium">{action}</span>
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    )
}

function StatPill({ label, value }) {
    return (
        <div className="px-4 py-2 rounded-lg bg-slate-800 border border-white/10">
            <p className="text-[10px] uppercase tracking-widest text-slate-400">{label}</p>
            <p className="text-sm font-semibold text-white">{value}</p>
        </div>
    )
}
