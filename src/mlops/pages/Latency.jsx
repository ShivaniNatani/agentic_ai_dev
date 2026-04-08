import React, { useMemo } from 'react'
import { motion } from 'framer-motion'
import { Clock, Timer, TrendingUp, Gauge, Activity, Globe, Zap, AlertCircle } from 'lucide-react'
import { useDashboardContext } from '../context/DashboardContext'
import { useDashboardData } from '../hooks/useDashboardData'
import FilterPanel from '../components/FilterPanel'
import LineChartCard from '../components/LineChartCard'
import { buildSeries } from '../utils/metrics'
import '../styles/mlops-compat.css'

const palette = ['#06b6d4', '#f59e0b', '#8b5cf6', '#10b981', '#ec4899']

export default function Latency() {
    const { filters } = useDashboardContext()

    const params = useMemo(() => ({
        model: filters.model,
        client: filters.client,
        version: filters.version,
        start_date: filters.startDate,
        end_date: filters.endDate,
        threshold_mode: filters.thresholdMode,
        ranges: filters.ranges.join(','),
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

    const latencySeries = useMemo(() => {
        if (!data?.records) return { data: [], seriesKeys: [] }
        const latencyRecords = data.records
            .filter(row => row.latency_hours !== null && row.latency_hours !== undefined)
            .map(row => ({
                ...row,
                metric_name: 'Latency',
                metric_value: row.latency_hours,
            }))
        return buildSeries(latencyRecords, 'Latency', filters.client, filters.trendWindow)
    }, [data, filters.client, filters.trendWindow])

    // Calculate latency statistics
    const latencyStats = useMemo(() => {
        if (!latencySeries.data.length) return { avg: 0, min: 0, max: 0, p95: 0 }
        const values = latencySeries.data.flatMap(row =>
            latencySeries.seriesKeys.map(key => Number(row[key])).filter(v => Number.isFinite(v))
        )
        if (values.length === 0) return { avg: 0, min: 0, max: 0, p95: 0 }

        const sorted = [...values].sort((a, b) => a - b)
        const avg = values.reduce((sum, val) => sum + val, 0) / values.length
        const min = sorted[0]
        const max = sorted[sorted.length - 1]
        const p95Index = Math.floor(sorted.length * 0.95)
        const p95 = sorted[p95Index] || max

        return { avg, min, max, p95 }
    }, [latencySeries])

    // Regional latency breakdown (from clients)
    const regionalLatency = useMemo(() => {
        if (!data?.records) return []
        const byClient = {}
        data.records.forEach(r => {
            if (r.latency_hours == null) return
            if (!byClient[r.client_name]) byClient[r.client_name] = []
            byClient[r.client_name].push(r.latency_hours)
        })
        return Object.entries(byClient)
            .map(([name, values]) => ({
                name: name.substring(0, 15),
                latency: values.reduce((a, b) => a + b, 0) / values.length,
            }))
            .sort((a, b) => b.latency - a.latency)
            .slice(0, 6)
    }, [data])

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-96">
                <div className="text-center">
                    <div className="relative w-16 h-16 mx-auto mb-4">
                        <div className="absolute inset-0 border-4 border-blue-500/20 rounded-full"></div>
                        <div className="absolute inset-0 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                        <Clock className="absolute inset-0 m-auto w-6 h-6 text-blue-400" />
                    </div>
                    <p className="text-slate-400">Measuring latency...</p>
                </div>
            </div>
        )
    }

    if (error || !data) {
        return (
            <div className="flex items-center justify-center h-96">
                <div className="text-center text-red-400">
                    <p className="text-xl font-bold mb-2">Unable to load latency data</p>
                    <p className="text-sm">Check backend connectivity</p>
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-6 pb-20">
            {/* Header */}
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-900/30 to-indigo-900/30 border border-blue-500/20 p-6">
                <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
                <div className="relative">
                    <div className="flex items-center gap-3 mb-2">
                        <span className="px-3 py-1 rounded-full bg-blue-500/20 text-blue-400 text-xs font-bold uppercase tracking-widest border border-blue-500/30 flex items-center gap-2">
                            <Timer className="w-3 h-3" /> Response Time
                        </span>
                    </div>
                    <h1 className="text-4xl font-bold text-white">Latency Signals</h1>
                    <p className="text-slate-400 mt-2 max-w-xl">Track data freshness and pipeline response time across clients and regions.</p>
                </div>
            </div>

            <FilterPanel rangeOptions={rangeOptions} availableMetrics={data.available_metrics || []} showAdvanced />

            {/* Latency KPIs */}
            <div className="grid gap-4 md:grid-cols-4">
                <LatencyKPI icon={Timer} label="Avg Latency" value={`${latencyStats.avg.toFixed(2)}h`} color="blue" />
                <LatencyKPI icon={TrendingUp} label="Min Latency" value={`${latencyStats.min.toFixed(2)}h`} color="emerald" />
                <LatencyKPI icon={Gauge} label="Max Latency" value={`${latencyStats.max.toFixed(2)}h`} color="orange" />
                <LatencyKPI icon={Activity} label="P95 Latency" value={`${latencyStats.p95.toFixed(2)}h`} color="purple" />
            </div>

            {/* Main Latency Chart - Using LineChartCard */}
            <LineChartCard
                title="Data Refresh Latency"
                description="Hours between refresh completion and data availability"
                data={latencySeries.data}
                lines={latencySeries.seriesKeys.map((key, index) => ({
                    key,
                    label: key,
                    color: palette[index % palette.length],
                }))}
                yLabel="Hours"
            />

            {/* Client Latency Breakdown */}
            <div className="card-outline p-5">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                            <Globe className="w-5 h-5 text-cyan-400" /> Client Latency Breakdown
                        </h3>
                        <p className="text-xs text-slate-400">Average latency by client</p>
                    </div>
                </div>

                {regionalLatency.length === 0 ? (
                    <p className="text-slate-400 text-sm">No client latency data available</p>
                ) : (
                    <div className="space-y-3">
                        {regionalLatency.map((client, idx) => (
                            <motion.div
                                key={client.name}
                                className="flex items-center gap-4"
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: idx * 0.05 }}
                            >
                                <span className="text-sm text-slate-300 w-32 truncate">{client.name}</span>
                                <div className="flex-1 h-3 bg-slate-800 rounded-full overflow-hidden">
                                    <motion.div
                                        className="h-full bg-gradient-to-r from-blue-600 to-cyan-400"
                                        initial={{ width: 0 }}
                                        animate={{ width: `${Math.min((client.latency / latencyStats.max) * 100, 100)}%` }}
                                        transition={{ delay: idx * 0.05 + 0.2, duration: 0.5 }}
                                    />
                                </div>
                                <span className="text-sm font-mono text-white w-16 text-right">{client.latency.toFixed(2)}h</span>
                            </motion.div>
                        ))}
                    </div>
                )}
            </div>

            {/* SLA Warning */}
            {latencyStats.p95 > 6 && (
                <motion.div
                    className="card-outline p-5 border border-orange-500/20 bg-orange-900/10"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                >
                    <div className="flex items-start gap-4">
                        <div className="p-3 rounded-xl bg-orange-500/20 border border-orange-500/30">
                            <AlertCircle className="w-6 h-6 text-orange-400" />
                        </div>
                        <div>
                            <h4 className="text-lg font-bold text-orange-400">SLA Warning</h4>
                            <p className="text-sm text-orange-200/70 mt-2 leading-relaxed">
                                P95 latency of <span className="font-mono font-bold text-white">{latencyStats.p95.toFixed(2)}h</span> exceeds the 6-hour SLA target.
                                Consider investigating pipeline bottlenecks or data source delays.
                            </p>
                        </div>
                    </div>
                </motion.div>
            )}
        </div>
    )
}

function LatencyKPI({ icon: Icon, label, value, color }) {
    const colors = {
        blue: 'border-l-blue-500 bg-blue-500/5',
        emerald: 'border-l-emerald-500 bg-emerald-500/5',
        orange: 'border-l-orange-500 bg-orange-500/5',
        purple: 'border-l-purple-500 bg-purple-500/5',
    }
    const iconColors = {
        blue: 'text-blue-400',
        emerald: 'text-emerald-400',
        orange: 'text-orange-400',
        purple: 'text-purple-400',
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
                    <span className="text-2xl font-bold text-white">{value}</span>
                </div>
            </div>
        </motion.div>
    )
}
