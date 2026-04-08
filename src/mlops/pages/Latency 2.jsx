import React, { useMemo } from 'react'
import { Clock, Activity, Zap, Server } from 'lucide-react'
import { useDashboardContext } from '../context/DashboardContext'
import { useDashboardData } from '../hooks/useDashboardData'
import FilterPanel from '../components/FilterPanel'
import LineChartCard from '../components/LineChartCard'
import GenAIChatOverlay from '../components/GenAIChatOverlay'
import { buildSeries } from '../utils/metrics'

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
        const ranges = new Set()
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
                (row) =>
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
        return (
            <div className="flex items-center justify-center h-64 border border-amber-500/20 bg-amber-900/10 rounded-xl m-6">
                <div className="text-center">
                    <Clock className="w-12 h-12 text-amber-500 mx-auto mb-4 animate-pulse" />
                    <h3 className="text-white font-bold">Loading Latency Metrics...</h3>
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-6 pb-20 relative">
            <GenAIChatOverlay />

            {/* Header Block */}
            <div className="bg-[#050505] p-8 rounded-2xl border border-[#1A1A1A] shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 p-8 opacity-10">
                    <Clock className="w-32 h-32 text-amber-500 transform -rotate-12" />
                </div>

                <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                    <div>
                        <div className="flex items-center gap-2 mb-2">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20 uppercase tracking-widest">
                                Pipeline Telemetry
                            </span>
                        </div>
                        <h2 className="text-3xl font-display font-black text-white tracking-tight">
                            Latency Signals
                        </h2>
                        <p className="text-gray-400 text-sm mt-2 max-w-xl leading-relaxed">
                            Track data freshness and pipeline response time across clients.
                        </p>
                    </div>
                    <div className="px-6 py-3 rounded-2xl bg-gradient-to-br from-[#111] to-[#050505] border border-[#222] text-right shadow-lg">
                        <div className="text-[10px] uppercase text-gray-500 font-bold tracking-widest mb-1">Avg Latency</div>
                        <div className="text-3xl font-black text-amber-400">{avgLatency.toFixed(2)} <span className="text-sm text-gray-500 font-medium">hrs</span></div>
                    </div>
                </div>
            </div>

            <div className="bg-[#050505] rounded-xl border border-[#1A1A1A] p-2">
                <FilterPanel rangeOptions={rangeOptions} availableMetrics={data.available_metrics} showAdvanced />
            </div>

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

            <div className="bg-[#050505] p-6 border border-[#1A1A1A] rounded-2xl shadow-xl flex items-center justify-between">
                <div>
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                        <Zap className="w-5 h-5 text-amber-500" />
                        Latency Insight
                    </h3>
                    <p className="text-sm text-gray-400 mt-1 max-w-2xl">
                        Consistent latency ensures reliable monitoring signals. Spikes may indicate data pipeline bottlenecks or provider delays.
                    </p>
                </div>
                <div className="hidden md:block">
                    <Server className="w-12 h-12 text-gray-800" />
                </div>
            </div>
        </div>
    )
}
