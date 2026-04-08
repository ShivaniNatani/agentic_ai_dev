import { useMemo, useState } from 'react'
import { useDashboardContext } from '../context/DashboardContext'
import { useDashboardData } from '../hooks/useDashboardData'
import FilterPanel from '../components/filters/FilterPanel'
import LineChartCard from '../components/charts/LineChartCard'
import { buildSeries, toDateKey } from '../utils/metrics'

const palette = ['#ce1126', '#3a57d1', '#f5b700', '#1ac98a']

const linearForecast = (values: number[], horizon: number) => {
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

    const params = {
        model: filters.model,
        client: filters.client,
        version: filters.version,
        start_date: filters.startDate,
        end_date: filters.endDate,
        threshold_mode: filters.thresholdMode,
        ranges: filters.ranges.join(','),
    }
    const { data, isLoading } = useDashboardData(params)

    const rangeOptions = useMemo(() => {
        if (!data?.records) return ['All ranges']
        const ranges = new Set<string>()
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
            const nextDate = new Date(lastDate)
            nextDate.setDate(lastDate.getDate() + idx + 1)
            return {
                date: toDateKey(nextDate.toISOString()),
                [`${key}_forecast`]: value,
            }
        })
        return [...driftSeries.data, ...forecastPoints]
    }, [showForecast, driftSeries, filters.client])

    const driftSummary = useMemo(() => {
        if (!data?.records) return { avgAbs: 0, worst: null }
        const driftValues = driftSeries.data.flatMap((row) =>
            driftSeries.seriesKeys.map((key) => Number(row[key])).filter((v) => Number.isFinite(v))
        )
        const avgAbs =
            driftValues.length > 0
                ? driftValues.reduce((sum, val) => sum + Math.abs(val), 0) / driftValues.length
                : 0
        return { avgAbs }
    }, [data, driftSeries])

    if (isLoading || !data) {
        return <div className="text-white">Loading drift analytics...</div>
    }

    return (
        <div className="space-y-6">
            <div className="card-outline p-6">
                <h2 className="text-3xl font-display font-bold text-white">
                    Drift <span className="gradient-text">Analytics</span>
                </h2>
                <p className="text-slate-400 mt-2">
                    Monitor actual vs expected performance and spot deviations before they impact outcomes.
                </p>
            </div>

            <FilterPanel rangeOptions={rangeOptions} availableMetrics={data.available_metrics} showAdvanced />

            <div className="card-outline p-5">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h3 className="text-lg font-semibold text-white">Actual vs Expected Drift</h3>
                        <p className="text-sm text-slate-400">
                            Drift is calculated as actual minus threshold. Negative values indicate under-performance.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={() => setShowForecast((v) => !v)}
                        className={`px-3 py-2 rounded-full text-xs border ${
                            showForecast
                                ? 'border-primary-500 text-white bg-primary-500/20'
                                : 'border-white/10 text-slate-400 bg-dark-850'
                        }`}
                    >
                        {showForecast ? 'Hide forecast' : 'Show 7-day forecast'}
                    </button>
                </div>
                <LineChartCard
                    title="Drift Trend"
                    description="Zero line marks expected performance."
                    data={forecastedData}
                    lines={[
                        ...driftSeries.seriesKeys.map((key, index) => ({
                            key,
                            label: key,
                            color: palette[index % palette.length],
                        })),
                        filters.client !== 'All Clients' && showForecast
                            ? {
                                  key: `${filters.client}_forecast`,
                                  label: `${filters.client} Forecast`,
                                  color: '#f5b700',
                                  dash: '4 4',
                              }
                            : null,
                    ].filter(Boolean) as any}
                    yLabel="Drift"
                />
                <p className="text-xs text-slate-500 mt-3">Average absolute drift: {driftSummary.avgAbs.toFixed(2)}.</p>
            </div>
        </div>
    )
}
