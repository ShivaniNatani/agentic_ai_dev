import React, { useMemo, useState } from 'react'
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
            if (row.threshold_range_label) {
                ranges.add(row.threshold_range_label)
            }
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
                [`${filters.client}_forecast`]: value,
            }
        })
        return [...driftSeries.data, ...forecastPoints]
    }, [showForecast, driftSeries, filters.client])

    const driftSummary = useMemo(() => {
        if (!data?.records) return { avgAbs: 0 }
        const vals = driftSeries.data.flatMap((row) =>
            driftSeries.seriesKeys.map((k) => Math.abs(Number(row[k]))).filter((v) => Number.isFinite(v))
        )
        const avgAbs = vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : 0
        return { avgAbs }
    }, [data, driftSeries])

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-96">
                <div className="text-center">
                    <div className="w-12 h-12 border-4 border-cyan-500/20 border-t-cyan-500 rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-slate-400">Loading drift data...</p>
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
        <div className="space-y-6">
            {/* Header */}
            <div className="card-outline p-6 border border-white/10">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div>
                        <span className="px-2 py-0.5 rounded text-xs font-bold bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 uppercase tracking-widest">
                            Predictive Analysis
                        </span>
                        <h2 className="text-3xl font-bold text-white mt-2">
                            Drift Analytics
                        </h2>
                        <p className="text-slate-400 mt-2 text-sm">
                            Monitor variance between expected and actual model output.
                        </p>
                    </div>
                </div>
            </div>

            <FilterPanel rangeOptions={rangeOptions} availableMetrics={data.available_metrics || []} showAdvanced />

            {/* Drift Chart with Controls */}
            <div className="card-outline p-5">
                <div className="flex items-center justify-between mb-4 pb-4 border-b border-white/10">
                    <div>
                        <h3 className="text-lg font-semibold text-white">Drift Trend Analysis</h3>
                        <p className="text-sm text-slate-400">Relative deviation. Negative = degradation.</p>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="text-right">
                            <span className="text-xs text-slate-400 uppercase block">Avg Abs Drift</span>
                            <span className="text-2xl font-mono font-bold text-white">{driftSummary.avgAbs.toFixed(3)}</span>
                        </div>
                        <button
                            type="button"
                            onClick={() => setShowForecast((v) => !v)}
                            className={`px-4 py-2 rounded text-xs font-bold transition-all ${showForecast
                                    ? 'bg-yellow-500 text-black'
                                    : 'bg-slate-800 text-slate-400 border border-white/10 hover:text-white'
                                }`}
                        >
                            {showForecast ? 'Hide Forecast' : 'Show 7-Day Forecast'}
                        </button>
                    </div>
                </div>

                <LineChartCard
                    title=""
                    description=""
                    data={forecastedData}
                    lines={[
                        ...driftSeries.seriesKeys.map((key, index) => ({
                            key,
                            label: key,
                            color: palette[index % palette.length],
                        })),
                        ...(filters.client !== 'All Clients' && showForecast
                            ? [{
                                key: `${filters.client}_forecast`,
                                label: `${filters.client} Forecast`,
                                color: '#f5b700',
                                dash: '4 4',
                            }]
                            : []),
                    ]}
                    yLabel="Drift"
                />

                {/* Warning Box */}
                <div className="mt-4 p-4 rounded bg-red-900/10 border border-red-500/20 flex items-start gap-3">
                    <span className="text-red-500 text-xl">⚠️</span>
                    <div>
                        <h4 className="text-sm font-bold text-red-400 uppercase tracking-wider">Drift Threshold Warning</h4>
                        <p className="text-xs text-red-200/50 mt-1">
                            Continuous drift exceeding 0.15 deviation for more than 3 refresh cycles may trigger automated retraining pipelines.
                            Current average drift is <span className="font-mono font-bold text-white">{driftSummary.avgAbs.toFixed(3)}</span>.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    )
}
