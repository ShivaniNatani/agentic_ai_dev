import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { useDashboardContext } from '../context/DashboardContext'
import { useDashboardData } from '../hooks/useDashboardData'
import FilterPanel from '../components/filters/FilterPanel'
import LineChartCard from '../components/charts/LineChartCard'
import { buildSeries, buildSummaryCards } from '../utils/metrics'

const palette = ['#ce1126', '#ffcc33', '#3b82f6', '#22d3ee', '#94a3b8']

export default function Overview() {
    const { filters, meta } = useDashboardContext()
    const params = {
        model: filters.model,
        client: filters.client,
        version: filters.version,
        start_date: filters.startDate,
        end_date: filters.endDate,
        threshold_mode: filters.thresholdMode,
        ranges: filters.ranges.join(','),
        metrics: filters.metrics.join(','),
    }
    const { data, isLoading, error } = useDashboardData(params)

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

    const summaryCards = useMemo(() => buildSummaryCards(data?.summary ?? []), [data])

    const accuracySeries = useMemo(() => {
        if (!data?.records) return { data: [], seriesKeys: [] }
        return buildSeries(data.records, 'Overall_Accuracy', filters.client, filters.trendWindow)
    }, [data, filters.client, filters.trendWindow])

    const heroStats = useMemo(() => {
        const latestSummary = data?.summary?.[0]
        return [
            {
                label: 'Latest Refresh',
                value: meta?.latest_data_point?.split('T')[0] || 'n/a',
                tone: 'text-primary-500',
            },
            {
                label: 'Data Source',
                value: meta?.data_source || 'local',
                tone: 'text-slate-200',
            },
            {
                label: 'Primary Metric',
                value: latestSummary?.metric_name || 'Overall_Accuracy',
                tone: 'text-slate-200',
            },
            {
                label: 'Latest Score',
                value: latestSummary?.latest ? `${latestSummary.latest.toFixed(2)}` : 'n/a',
                tone: 'text-primary-500',
            },
        ]
    }, [data?.summary, meta])

    if (isLoading) {
        return <div className="text-white">Loading dashboard...</div>
    }
    if (error || !data) {
        return <div className="text-error">Unable to load dashboard data.</div>
    }

    return (
        <div className="space-y-6">
            <div className="card-outline p-6 border border-primary-500/30">
                <div className="flex flex-col gap-4">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                        <div>
                            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Model Monitoring</p>
                            <h2 className="text-3xl font-display font-bold text-white flex items-center gap-3">
                                {filters.model || 'Active Deployment'}
                                <span className="pill border-primary-500/40 bg-primary-500/10 text-primary-50">
                                    {filters.client}
                                </span>
                                <span className="pill border-white/10 bg-dark-750 text-slate-300">
                                    {filters.version || 'Latest'}
                                </span>
                            </h2>
                            <p className="text-slate-400 mt-2">
                                Drift, latency, and stability snapshot inspired by a command center layout.
                            </p>
                        </div>
                        <div className="flex flex-wrap gap-3 justify-end">
                            {heroStats.map((stat) => (
                                <div
                                    key={stat.label}
                                    className="px-4 py-2 rounded-lg bg-dark-800 border border-white/10 min-w-[140px]"
                                >
                                    <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">
                                        {stat.label}
                                    </p>
                                    <p className={`text-lg font-semibold ${stat.tone}`}>{stat.value}</p>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="grid gap-3 md:grid-cols-4">
                        <SummaryPill label="Health" value="5 / 10" tone="text-primary-500" />
                        <SummaryPill label="High Risk" value="3" tone="text-error" />
                        <SummaryPill label="Medium Risk" value="2" tone="text-warning" />
                        <SummaryPill label="No Risk" value="2" tone="text-success" />
                    </div>
                </div>
            </div>

            <FilterPanel rangeOptions={rangeOptions} availableMetrics={data.available_metrics} showAdvanced showMetrics />

            <div className="grid gap-4 md:grid-cols-3">
                {summaryCards.slice(0, 3).map((card, idx) => (
                    <motion.div
                        key={card.label}
                        className="card-outline p-5"
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.4, delay: idx * 0.08 }}
                    >
                        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">{card.label}</p>
                        <div className="mt-3 flex items-end justify-between">
                            <span className="text-3xl font-bold text-white">{card.value}</span>
                            <span className="text-xs text-slate-400">{card.status}</span>
                        </div>
                        <div className="mt-2 text-xs text-slate-500">Delta {card.delta}</div>
                    </motion.div>
                ))}
            </div>

            <LineChartCard
                title={`${filters.model || 'Model'} Overall Accuracy`}
                description="Trend of overall accuracy across refresh cycles."
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

            <div className="grid gap-4 md:grid-cols-2">
                <div className="card-outline p-5">
                    <h3 className="text-lg font-semibold text-white">Coverage</h3>
                    <p className="text-sm text-slate-400 mt-2">
                        Tracking {new Set(data.records.map((row) => row.client_name)).size} clients between{' '}
                        {filters.startDate} and {filters.endDate}.
                    </p>
                </div>
                <div className="card-outline p-5">
                    <h3 className="text-lg font-semibold text-white">Observations</h3>
                    <p className="text-sm text-slate-400 mt-2">
                        Key takeaways from recent refresh cycles and operational health.
                    </p>
                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                        <div className="glass-card p-4 border border-white/10">
                            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">MLOps Modules</p>
                            <ul className="mt-2 space-y-2 text-slate-200 text-sm">
                                <li>1) Model Management</li>
                                <li>2) Model Deployment</li>
                                <li>3) Model Governance</li>
                                <li>4) Model Monitoring</li>
                            </ul>
                        </div>
                        <div className="glass-card p-4 border border-white/10">
                            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Risk Bands</p>
                            <p className="text-sm text-slate-300 mt-2">
                                Use the filters above to isolate drift, accuracy, and latency risk by client or model.
                                The red band highlights high-risk refreshes; yellow indicates medium attention.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

function SummaryPill({ label, value, tone }: { label: string; value: string; tone: string }) {
    return (
        <div className="flex items-center justify-between bg-dark-800 border border-white/10 rounded-lg px-4 py-3">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">{label}</p>
            <p className={`text-lg font-semibold ${tone}`}>{value}</p>
        </div>
    )
}
