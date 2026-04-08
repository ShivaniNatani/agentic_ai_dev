import React, { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { TrendingUp, AlertTriangle, Eye, EyeOff, Zap, Target, Activity } from 'lucide-react'
import { useDashboardContext } from '../context/DashboardContext'
import { useDashboardData } from '../hooks/useDashboardData'
import FilterPanel from '../components/FilterPanel'
import LineChartCard from '../components/LineChartCard'
import { buildSeries, toDateKey } from '../utils/metrics'
import '../styles/mlops-compat.css'

const palette = ['#06b6d4', '#f59e0b', '#3b82f6', '#8b5cf6', '#10b981']

const linearForecast = (values, horizon) => {
    if (values.length < 3) return []
    const n = values.length
    const xs = Array.from({ length: n }, (_, i) => i)
    const meanX = xs.reduce((a, b) => a + b, 0) / n
    const meanY = values.reduce((a, b) => a + b, 0) / n
    const numerator = xs.reduce((sum, x, i) => sum + (x - meanX) * (values[i] - meanY), 0)
    const denominator = xs.reduce((sum, x) => sum + (x - meanX) ** 2, 0)
    const slope = denominator === 0 ? 0 : numerator / denominator
    const intercept = meanY - slope * meanX
    return Array.from({ length: horizon }, (_, i) => slope * (n + i) + intercept)
}

export default function Drift() {
    const { filters } = useDashboardContext()
    const [showForecast, setShowForecast] = useState(false)

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

    const driftSeries = useMemo(() => {
        if (!data?.records) return { data: [], seriesKeys: [] }
        const driftRecords = data.records
            .filter((row) => row.metric_name === 'Overall_Accuracy')
            .map((row) => ({
                ...row,
                metric_name: 'drift',
                metric_value: (row.metric_value ?? 0) - (row.threshold ?? 0),
            }))
        return buildSeries(driftRecords, 'drift', filters.client, filters.trendWindow)
    }, [data, filters.client, filters.trendWindow])

    const forecastedData = useMemo(() => {
        if (!showForecast) return driftSeries.data
        const key = filters.client === 'All Clients' ? 'aggregate' : filters.client
        const values = driftSeries.data
            .map((row) => {
                if (filters.client === 'All Clients') {
                    const vals = driftSeries.seriesKeys.map((k) => Number(row[k])).filter((v) => Number.isFinite(v))
                    if (vals.length === 0) return NaN
                    return vals.reduce((a, b) => a + b, 0) / vals.length
                }
                return Number(row[key])
            })
            .filter((v) => Number.isFinite(v))
        const forecast = linearForecast(values, 7)
        if (forecast.length === 0) return driftSeries.data
        const lastDate = driftSeries.data.length
            ? new Date(driftSeries.data[driftSeries.data.length - 1].date)
            : new Date()
        const forecastPoints = forecast.map((value, idx) => {
            const futureDate = new Date(lastDate)
            futureDate.setDate(futureDate.getDate() + idx + 1)
            return {
                date: toDateKey(futureDate),
                forecast: value,
            }
        })
        return [...driftSeries.data, ...forecastPoints]
    }, [showForecast, driftSeries, filters.client])

    const driftStats = useMemo(() => {
        if (!driftSeries.data.length) return { avgAbs: 0, max: 0, min: 0, breachCount: 0 }
        const vals = driftSeries.data.flatMap((row) =>
            driftSeries.seriesKeys.map((k) => Number(row[k])).filter((v) => Number.isFinite(v))
        )
        if (vals.length === 0) return { avgAbs: 0, max: 0, min: 0, breachCount: 0 }
        const absVals = vals.map(Math.abs)
        const avgAbs = absVals.reduce((a, b) => a + b, 0) / absVals.length
        const max = Math.max(...vals)
        const min = Math.min(...vals)
        const breachCount = vals.filter(v => Math.abs(v) > 0.15).length
        return { avgAbs, max, min, breachCount }
    }, [driftSeries])

    // Build lines array with optional forecast
    const chartLines = useMemo(() => {
        const lines = driftSeries.seriesKeys.map((key, index) => ({
            key,
            label: key,
            color: palette[index % palette.length],
        }))
        if (showForecast) {
            lines.push({ key: 'forecast', label: 'Forecast', color: '#f59e0b', dash: '4 4' })
        }
        return lines
    }, [driftSeries.seriesKeys, showForecast])

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-96">
                <div className="text-center">
                    <div className="relative w-16 h-16 mx-auto mb-4">
                        <div className="absolute inset-0 border-4 border-cyan-500/20 rounded-full"></div>
                        <div className="absolute inset-0 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin"></div>
                        <TrendingUp className="absolute inset-0 m-auto w-6 h-6 text-cyan-400" />
                    </div>
                    <p className="text-slate-400">Analyzing drift patterns...</p>
                </div>
            </div>
        )
    }

    if (error || !data) {
        return (
            <div className="flex items-center justify-center h-96">
                <div className="text-center text-red-400">
                    <p className="text-xl font-bold mb-2">Unable to load drift data</p>
                    <p className="text-sm">Check backend connectivity</p>
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-6 pb-20">
            {/* Header */}
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-cyan-900/30 to-blue-900/30 border border-cyan-500/20 p-6">
                <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
                <div className="relative">
                    <div className="flex items-center gap-3 mb-2">
                        <span className="px-3 py-1 rounded-full bg-yellow-500/20 text-yellow-400 text-xs font-bold uppercase tracking-widest border border-yellow-500/30 flex items-center gap-2">
                            <Zap className="w-3 h-3" /> Predictive Analysis
                        </span>
                    </div>
                    <h1 className="text-4xl font-bold text-white">Drift Analytics</h1>
                    <p className="text-slate-400 mt-2 max-w-xl">Monitor variance between expected and actual model output with forecasting.</p>
                </div>
            </div>

            <FilterPanel rangeOptions={rangeOptions} availableMetrics={data.available_metrics || []} showAdvanced />

            {/* Drift KPIs */}
            <div className="grid gap-4 md:grid-cols-4">
                <DriftKPI icon={Activity} label="Avg Abs Drift" value={driftStats.avgAbs.toFixed(3)} color="cyan" />
                <DriftKPI icon={TrendingUp} label="Max Drift" value={driftStats.max.toFixed(3)} color={driftStats.max > 0 ? 'emerald' : 'red'} />
                <DriftKPI icon={TrendingUp} label="Min Drift" value={driftStats.min.toFixed(3)} color={driftStats.min < 0 ? 'red' : 'emerald'} />
                <DriftKPI icon={AlertTriangle} label="Threshold Breaches" value={driftStats.breachCount} subtext="> 0.15 deviation" color="orange" />
            </div>

            {/* Forecast Toggle */}
            <div className="card-outline p-4 flex items-center justify-between">
                <div>
                    <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                        <Target className="w-5 h-5 text-cyan-400" /> Drift Trend Analysis
                    </h3>
                    <p className="text-sm text-slate-400">Relative deviation from threshold. Negative = degradation</p>
                </div>
                <button
                    onClick={() => setShowForecast((v) => !v)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-all ${showForecast
                            ? 'bg-yellow-500 text-black shadow-lg shadow-yellow-500/30'
                            : 'bg-slate-800 text-slate-300 border border-white/10 hover:border-white/20'
                        }`}
                >
                    {showForecast ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                    {showForecast ? 'Hide' : '7-Day'} Forecast
                </button>
            </div>

            {/* Drift Chart - Using LineChartCard */}
            <LineChartCard
                title=""
                description=""
                data={forecastedData}
                lines={chartLines}
                yLabel="Drift"
                hideLegend
            />

            {/* Threshold Warning */}
            <motion.div
                className="card-outline p-5 border border-red-500/20 bg-red-900/10"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
            >
                <div className="flex items-start gap-4">
                    <div className="p-3 rounded-xl bg-red-500/20 border border-red-500/30">
                        <AlertTriangle className="w-6 h-6 text-red-400" />
                    </div>
                    <div>
                        <h4 className="text-lg font-bold text-red-400">Drift Threshold Warning</h4>
                        <p className="text-sm text-red-200/70 mt-2 leading-relaxed">
                            Continuous drift exceeding <span className="font-mono font-bold text-white">±0.15</span> deviation
                            for more than 3 refresh cycles may trigger automated retraining pipelines.
                            Current average absolute drift is <span className="font-mono font-bold text-white">{driftStats.avgAbs.toFixed(3)}</span>.
                        </p>
                        {driftStats.breachCount > 0 && (
                            <p className="mt-2 text-sm text-red-400 font-semibold">
                                ⚠️ {driftStats.breachCount} data point(s) currently exceed threshold
                            </p>
                        )}
                    </div>
                </div>
            </motion.div>
        </div>
    )
}

function DriftKPI({ icon: Icon, label, value, subtext, color }) {
    const colors = {
        cyan: 'border-l-cyan-500 bg-cyan-500/5',
        emerald: 'border-l-emerald-500 bg-emerald-500/5',
        red: 'border-l-red-500 bg-red-500/5',
        orange: 'border-l-orange-500 bg-orange-500/5',
    }
    const iconColors = {
        cyan: 'text-cyan-400',
        emerald: 'text-emerald-400',
        red: 'text-red-400',
        orange: 'text-orange-400',
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
                        <span className="text-2xl font-bold font-mono text-white">{value}</span>
                        {subtext && <span className="text-xs text-slate-400">{subtext}</span>}
                    </div>
                </div>
            </div>
        </motion.div>
    )
}
