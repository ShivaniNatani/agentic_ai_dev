import { useMemo, useState } from 'react'
import { useDashboardContext } from '../context/DashboardContext'
import { useDashboardData } from '../hooks/useDashboardData'
import FilterPanel from '../components/filters/FilterPanel'
import LineChartCard from '../components/charts/LineChartCard'
import { buildSeries, buildSummaryCards } from '../utils/metrics'

const palette = ['#ce1126', '#ffcc33', '#3b82f6', '#22d3ee', '#a855f7', '#f97316']

export default function Performance() {
    const { filters, options } = useDashboardContext()
    const [compareModels, setCompareModels] = useState<string[]>([])

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
    const { data, isLoading } = useDashboardData(params)

    const comparisonParams = {
        model: '',
        client: filters.client,
        start_date: filters.startDate,
        end_date: filters.endDate,
        metrics: 'Overall_Accuracy',
    }
    const { data: comparisonData } = useDashboardData(comparisonParams)

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

    const accuracyPctSeries = useMemo(() => {
        if (!data?.records) return { data: [], seriesKeys: [] }
        return buildSeries(data.records, 'Accuracy_pct', filters.client, filters.trendWindow)
    }, [data, filters.client, filters.trendWindow])

    const benchmarkSeries = useMemo(() => {
        if (!comparisonData?.records || compareModels.length === 0) {
            return { data: [], seriesKeys: [] }
        }
        const transformed = comparisonData.records
            .filter((row) => compareModels.includes(row.model_name))
            .map((row) => ({ ...row, client_name: row.model_name }))
        return buildSeries(transformed, 'Overall_Accuracy', undefined, filters.trendWindow)
    }, [comparisonData, compareModels, filters.trendWindow])

    if (isLoading || !data) {
        return <div className="text-white">Loading performance...</div>
    }

    return (
        <div className="space-y-6">
            <div className="card-outline p-6 border border-primary-500/30 shadow-glow">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div>
                        <h2 className="text-3xl font-display font-bold text-white">
                            Performance <span className="gradient-text">Analytics</span>
                        </h2>
                        <p className="text-slate-400 mt-2">
                            Accuracy, threshold adherence, and client-specific performance signals.
                        </p>
                    </div>
                    <div className="pill border-primary-500/40 bg-primary-500/10 text-primary-50">
                        Trend window: {filters.trendWindow} refreshes
                    </div>
                </div>
            </div>

            <FilterPanel rangeOptions={rangeOptions} availableMetrics={data.available_metrics} showAdvanced showMetrics />

            <div className="grid gap-4 md:grid-cols-3">
                {summaryCards.slice(0, 3).map((card) => (
                    <div key={card.label} className="card-outline p-5 bg-dark-850/80 border border-white/10 shadow-glass">
                        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">{card.label}</p>
                        <div className="mt-3 flex items-end justify-between">
                            <span className="text-3xl font-bold text-white">{card.value}</span>
                            <span className="text-xs text-slate-400">{card.status}</span>
                        </div>
                        <div className="mt-2 text-xs text-slate-500">Delta {card.delta}</div>
                        <div className="w-full h-2 rounded-full bg-white/5 overflow-hidden mt-3">
                            <div
                                className="h-2 rounded-full bg-gradient-primary"
                                style={{ width: `${Math.min(Number(card.value), 100)}%` }}
                            />
                        </div>
                    </div>
                ))}
            </div>

            <LineChartCard
                title="Overall Accuracy"
                description="Accuracy trend with threshold reference."
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

            <LineChartCard
                title="Accuracy pct"
                description="Directly reported accuracy percentage."
                data={accuracyPctSeries.data}
                lines={accuracyPctSeries.seriesKeys.map((key, index) => ({
                    key,
                    label: key,
                    color: palette[index % palette.length],
                }))}
                yLabel="Accuracy pct"
            />

            {filters.metrics
                .filter((metric) => metric !== 'Overall_Accuracy' && metric !== 'Accuracy_pct')
                .map((metric) => {
                    const series = buildSeries(data.records, metric, filters.client, filters.trendWindow)
                    return (
                        <LineChartCard
                            key={metric}
                            title={`${metric.replace(/_/g, ' ')} Trend`}
                            description="Rolling refresh trend."
                            data={series.data}
                            lines={series.seriesKeys.map((key, index) => ({
                                key,
                                label: key,
                                color: palette[index % palette.length],
                            }))}
                            yLabel={metric.replace(/_/g, ' ')}
                        />
                    )
                })}

            <div className="card-outline p-5 space-y-4">
                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="text-lg font-semibold text-white">Comparative Benchmarking</h3>
                        <p className="text-sm text-slate-400">Compare accuracy trends across multiple models.</p>
                    </div>
                    <button
                        type="button"
                        className="px-3 py-2 rounded-lg border border-white/10 text-xs text-slate-300"
                        onClick={() => setCompareModels([])}
                    >
                        Clear
                    </button>
                </div>
                <div className="flex flex-wrap gap-2">
                    {options.models.map((model, idx) => {
                        const active = compareModels.includes(model)
                        return (
                            <button
                                key={model}
                                type="button"
                                onClick={() =>
                                    setCompareModels((prev) =>
                                        prev.includes(model) ? prev.filter((m) => m !== model) : [...prev, model]
                                    )
                                }
                                className={`px-3 py-2 rounded-full text-sm border ${
                                    active
                                        ? 'border-primary-500 bg-primary-500/20 text-white'
                                        : 'border-white/10 bg-dark-850 text-slate-300'
                                }`}
                                style={active ? { boxShadow: `0 0 12px ${palette[idx % palette.length]}55` } : {}}
                            >
                                {model}
                            </button>
                        )
                    })}
                </div>
                {compareModels.length > 0 ? (
                    <LineChartCard
                        title="Model Comparison"
                        description="Multi-model accuracy trend."
                        data={benchmarkSeries.data}
                        lines={benchmarkSeries.seriesKeys.map((key, index) => ({
                            key,
                            label: key,
                            color: palette[index % palette.length],
                        }))}
                        yLabel="Accuracy"
                    />
                ) : (
                    <p className="text-sm text-slate-400">Select models above to view the comparison.</p>
                )}
            </div>
        </div>
    )
}
