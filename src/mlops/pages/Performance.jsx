import React, { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { TrendingUp, Target, BarChart3, Layers, Activity, Gauge, ArrowUp, ArrowDown } from 'lucide-react'
import { useDashboardContext } from '../context/DashboardContext'
import { useDashboardData } from '../hooks/useDashboardData'
import FilterPanel from '../components/FilterPanel'
import LineChartCard from '../components/LineChartCard'
import { buildSeries, buildSummaryCards } from '../utils/metrics'
import '../styles/mlops-compat.css'

const palette = ['#8b5cf6', '#ec4899', '#06b6d4', '#10b981', '#f59e0b', '#ef4444']

export default function Performance() {
    const { filters, options } = useDashboardContext()
    const [compareModels, setCompareModels] = useState([])

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
            if (row.threshold_range_label) ranges.add(row.threshold_range_label)
        })
        return ['All ranges', ...Array.from(ranges)]
    }, [data])

    const summaryCards = useMemo(() => buildSummaryCards(data?.summary ?? []), [data])

    const accuracySeries = useMemo(() => {
        if (!data?.records) return { data: [], seriesKeys: [] }
        return buildSeries(data.records, 'Overall_Accuracy', filters.client, filters.trendWindow)
    }, [data, filters.client, filters.trendWindow])

    // Benchmark series for comparison
    const benchmarkSeries = useMemo(() => {
        if (!data?.records || compareModels.length === 0) return { data: [], seriesKeys: [] }
        const filtered = data.records.filter(r => compareModels.includes(r.model_name) && r.metric_name === 'Overall_Accuracy')
        return buildSeries(filtered, 'Overall_Accuracy', filters.client, filters.trendWindow)
    }, [data, compareModels, filters.client, filters.trendWindow])

    // Calculate performance metrics
    const perfMetrics = useMemo(() => {
        if (!accuracySeries.data.length) return { avg: 0, min: 0, max: 0, trend: 'stable' }
        const allValues = accuracySeries.data.flatMap(row =>
            accuracySeries.seriesKeys.map(key => Number(row[key])).filter(v => Number.isFinite(v))
        )
        if (allValues.length === 0) return { avg: 0, min: 0, max: 0, trend: 'stable' }

        const avg = allValues.reduce((a, b) => a + b, 0) / allValues.length
        const min = Math.min(...allValues)
        const max = Math.max(...allValues)

        // Calculate trend from first half vs second half
        const midpoint = Math.floor(allValues.length / 2)
        const firstHalf = allValues.slice(0, midpoint)
        const secondHalf = allValues.slice(midpoint)
        const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / (firstHalf.length || 1)
        const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / (secondHalf.length || 1)
        const trend = secondAvg > firstAvg + 1 ? 'improving' : secondAvg < firstAvg - 1 ? 'declining' : 'stable'

        return { avg, min, max, trend }
    }, [accuracySeries])

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-96">
                <div className="text-center">
                    <div className="relative w-16 h-16 mx-auto mb-4">
                        <div className="absolute inset-0 border-4 border-purple-500/20 rounded-full"></div>
                        <div className="absolute inset-0 border-4 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
                        <TrendingUp className="absolute inset-0 m-auto w-6 h-6 text-purple-400" />
                    </div>
                    <p className="text-slate-400">Analyzing performance...</p>
                </div>
            </div>
        )
    }

    if (error || !data) {
        return (
            <div className="flex items-center justify-center h-96">
                <div className="text-center text-red-400">
                    <p className="text-xl font-bold mb-2">Unable to load performance data</p>
                    <p className="text-sm">Check backend connectivity</p>
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-6 pb-20">
            {/* Header */}
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-purple-900/30 to-pink-900/30 border border-purple-500/20 p-6">
                <div className="absolute top-0 right-0 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
                <div className="relative">
                    <div className="flex items-center gap-3 mb-2">
                        <span className="px-3 py-1 rounded-full bg-purple-500/20 text-purple-400 text-xs font-bold uppercase tracking-widest border border-purple-500/30 flex items-center gap-2">
                            <BarChart3 className="w-3 h-3" /> Analytics Engine
                        </span>
                    </div>
                    <h1 className="text-4xl font-bold text-white">Performance Analytics</h1>
                    <p className="text-slate-400 mt-2 max-w-xl">Accuracy metrics, threshold adherence, and client-specific performance signals.</p>
                </div>
            </div>

            <FilterPanel rangeOptions={rangeOptions} availableMetrics={data.available_metrics} showAdvanced showMetrics />

            {/* Performance KPIs */}
            <div className="grid gap-4 md:grid-cols-4">
                <KPICard icon={Gauge} label="Avg Accuracy" value={`${perfMetrics.avg.toFixed(1)}%`} trend={perfMetrics.trend} color="purple" />
                <KPICard icon={ArrowUp} label="Peak Performance" value={`${perfMetrics.max.toFixed(1)}%`} color="emerald" />
                <KPICard icon={ArrowDown} label="Min Performance" value={`${perfMetrics.min.toFixed(1)}%`} color="orange" />
                <KPICard icon={Activity} label="Data Points" value={accuracySeries.data.length} subtext="time series" color="blue" />
            </div>

            {/* Summary Cards */}
            {summaryCards.length > 0 && (
                <div className="grid gap-4 md:grid-cols-3">
                    {summaryCards.slice(0, 3).map((card, idx) => (
                        <motion.div
                            key={card.label}
                            className="card-outline p-5 relative overflow-hidden"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: idx * 0.05 }}
                        >
                            <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-purple-500/10 to-transparent rounded-full blur-2xl"></div>
                            <p className="text-xs uppercase tracking-widest text-slate-400 font-semibold">{card.label}</p>
                            <div className="mt-2 flex items-end justify-between">
                                <span className="text-3xl font-bold text-white">{card.value}</span>
                                <span className={`text-xs font-semibold px-2 py-1 rounded-full ${card.status === 'Improving' ? 'bg-emerald-500/20 text-emerald-400' :
                                        card.status === 'Declining' ? 'bg-red-500/20 text-red-400' :
                                            'bg-slate-500/20 text-slate-400'
                                    }`}>
                                    {card.status === 'Improving' ? '↑' : card.status === 'Declining' ? '↓' : '→'} {card.status}
                                </span>
                            </div>
                            <p className="text-xs text-slate-500 mt-2">Delta: {card.delta > 0 ? '+' : ''}{card.delta}%</p>
                        </motion.div>
                    ))}
                </div>
            )}

            {/* Main Accuracy Chart - Using LineChartCard */}
            <LineChartCard
                title="Accuracy Trend"
                description="Performance over time with threshold reference"
                data={accuracySeries.data}
                lines={[
                    ...accuracySeries.seriesKeys.map((key, index) => ({
                        key,
                        label: key,
                        color: palette[index % palette.length],
                    })),
                    { key: 'threshold', label: 'Threshold', color: '#f5b700', dash: '4 4' },
                ]}
                yLabel="Accuracy"
            />

            {/* Model Benchmarking */}
            <div className="card-outline p-5">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                            <Layers className="w-5 h-5 text-pink-400" /> Comparative Benchmarking
                        </h3>
                        <p className="text-xs text-slate-400">Select models to compare</p>
                    </div>
                    {compareModels.length > 0 && (
                        <button
                            onClick={() => setCompareModels([])}
                            className="text-xs text-slate-400 hover:text-white transition-colors"
                        >
                            Clear
                        </button>
                    )}
                </div>
                <div className="flex flex-wrap gap-2 mb-4">
                    {options.models.map((model) => {
                        const isActive = compareModels.includes(model)
                        return (
                            <button
                                key={model}
                                onClick={() =>
                                    setCompareModels((prev) =>
                                        prev.includes(model)
                                            ? prev.filter((m) => m !== model)
                                            : [...prev, model]
                                    )
                                }
                                className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-all ${isActive
                                        ? 'border-pink-500 bg-pink-500/20 text-white'
                                        : 'border-white/10 bg-slate-800/50 text-slate-400 hover:text-white hover:border-white/20'
                                    }`}
                            >
                                {model}
                            </button>
                        )
                    })}
                </div>
                {compareModels.length > 0 ? (
                    <LineChartCard
                        title=""
                        description=""
                        data={benchmarkSeries.data}
                        lines={benchmarkSeries.seriesKeys.map((key, index) => ({
                            key,
                            label: key,
                            color: palette[index % palette.length],
                        }))}
                        yLabel="Accuracy"
                        hideLegend
                    />
                ) : (
                    <div className="p-8 rounded-xl bg-slate-800/30 border border-white/5 text-center">
                        <Layers className="w-10 h-10 text-slate-600 mx-auto mb-2" />
                        <p className="text-slate-500 text-sm">Select models above to compare their performance</p>
                    </div>
                )}
            </div>
        </div>
    )
}

function KPICard({ icon: Icon, label, value, subtext, trend, color }) {
    const colors = {
        purple: 'border-l-purple-500 bg-purple-500/5',
        emerald: 'border-l-emerald-500 bg-emerald-500/5',
        orange: 'border-l-orange-500 bg-orange-500/5',
        blue: 'border-l-blue-500 bg-blue-500/5',
    }
    const iconColors = {
        purple: 'text-purple-400',
        emerald: 'text-emerald-400',
        orange: 'text-orange-400',
        blue: 'text-blue-400',
    }

    return (
        <motion.div
            className={`card-outline p-4 border-l-4 ${colors[color]}`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
        >
            <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-white/5">
                    <Icon className={`w-5 h-5 ${iconColors[color]}`} />
                </div>
                <div>
                    <p className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold">{label}</p>
                    <div className="flex items-baseline gap-1">
                        <span className="text-2xl font-bold text-white">{value}</span>
                        {subtext && <span className="text-xs text-slate-400">{subtext}</span>}
                        {trend && (
                            <span className={`text-xs ml-1 ${trend === 'improving' ? 'text-emerald-400' :
                                    trend === 'declining' ? 'text-red-400' : 'text-slate-400'
                                }`}>
                                {trend === 'improving' ? '↑' : trend === 'declining' ? '↓' : '→'}
                            </span>
                        )}
                    </div>
                </div>
            </div>
        </motion.div>
    )
}
