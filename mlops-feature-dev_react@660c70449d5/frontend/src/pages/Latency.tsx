import { useMemo } from 'react'
import { useDashboardContext } from '../context/DashboardContext'
import { useDashboardData } from '../hooks/useDashboardData'
import FilterPanel from '../components/filters/FilterPanel'
import LineChartCard from '../components/charts/LineChartCard'
import { buildSeries } from '../utils/metrics'
import { type DataRecord } from '../services/api'

const palette = ['#ce1126', '#3a57d1', '#f5b700', '#1ac98a']

export default function Latency() {
    const { filters } = useDashboardContext()
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

    const latencySeries = useMemo(() => {
        if (!data?.records) return { data: [], seriesKeys: [] }
        const latencyRecords = data.records
            .filter(
                (row): row is DataRecord & { latency_hours: number } =>
                    row.latency_hours !== null && row.latency_hours !== undefined
            )
            .map((row) => ({
                ...row,
                metric_name: 'Latency',
                metric_value: row.latency_hours,
            }))
        return buildSeries(latencyRecords, 'Latency', filters.client, filters.trendWindow)
    }, [data, filters.client, filters.trendWindow])

    const avgLatency = useMemo(() => {
        if (!latencySeries.data.length) return 0
        const values = latencySeries.data.flatMap((row) =>
            latencySeries.seriesKeys.map((key) => Number(row[key])).filter((v) => Number.isFinite(v))
        )
        if (values.length === 0) return 0
        return values.reduce((sum, val) => sum + val, 0) / values.length
    }, [latencySeries])

    if (isLoading || !data) {
        return <div className="text-white">Loading latency...</div>
    }

    return (
        <div className="space-y-6">
            <div className="card-outline p-6">
                <h2 className="text-3xl font-display font-bold text-white">
                    Latency <span className="gradient-text">Signals</span>
                </h2>
                <p className="text-slate-400 mt-2">
                    Track data freshness and pipeline response time across clients.
                </p>
            </div>

            <FilterPanel rangeOptions={rangeOptions} availableMetrics={data.available_metrics} showAdvanced />

            <LineChartCard
                title="Data Refresh Latency"
                description="Latency in hours between refresh completion and availability."
                data={latencySeries.data}
                lines={latencySeries.seriesKeys.map((key, index) => ({
                    key,
                    label: key,
                    color: palette[index % palette.length],
                }))}
                yLabel="Hours"
            />

            <div className="card-outline p-5">
                <h3 className="text-lg font-semibold text-white">Average Latency</h3>
                <p className="text-3xl font-bold text-white mt-2">{avgLatency.toFixed(2)} hrs</p>
                <p className="text-sm text-slate-400 mt-2">
                    Keep latency stable to ensure monitoring signals remain fresh.
                </p>
            </div>
        </div>
    )
}
