import type { DataRecord, SummaryMetric } from '../services/api'

export const formatMetricLabel = (name?: string) => {
    if (!name) return 'Metric'
    return name.replace(/_/g, ' ')
}

export const toDateKey = (value: string) => value.split('T')[0]

export const buildSeries = (
    records: DataRecord[],
    metricName: string,
    clientFilter?: string,
    window = 1
): { data: Array<Record<string, any>>; seriesKeys: string[] } => {
    const buckets = new Map<string, any>()
    const seriesSet = new Set<string>()

    records
        .filter((row) => row.metric_name === metricName)
        .forEach((row) => {
            if (!row.date_of_model_refresh) return
            const dateKey = toDateKey(row.date_of_model_refresh)
            const seriesKey =
                clientFilter && clientFilter !== 'All Clients'
                    ? clientFilter
                    : row.client_name || 'Unknown'

            seriesSet.add(seriesKey)

            if (!buckets.has(dateKey)) {
                buckets.set(dateKey, { date: dateKey, _sums: {}, _counts: {}, threshold: null })
            }
            const bucket = buckets.get(dateKey)
            const value = Number(row.metric_value)
            if (!Number.isFinite(value)) return

            bucket._sums[seriesKey] = (bucket._sums[seriesKey] || 0) + value
            bucket._counts[seriesKey] = (bucket._counts[seriesKey] || 0) + 1

            if (row.threshold !== undefined && row.threshold !== null) {
                bucket.threshold =
                    bucket.threshold === null ? Number(row.threshold) : (bucket.threshold + Number(row.threshold)) / 2
            }
        })

    let data = Array.from(buckets.values())
        .map((bucket) => {
            const next: Record<string, any> = { date: bucket.date, threshold: bucket.threshold }
            Object.keys(bucket._sums).forEach((key) => {
                next[key] = bucket._sums[key] / bucket._counts[key]
            })
            return next
        })
        .sort((a, b) => (a.date > b.date ? 1 : -1))

    if (window > 1 && data.length > 0) {
        data = data.map((row, idx) => {
            const next = { ...row }
            Array.from(seriesSet).forEach((key) => {
                const slice = data
                    .slice(Math.max(0, idx - window + 1), idx + 1)
                    .map((item) => Number(item[key]))
                    .filter((value) => Number.isFinite(value))
                if (slice.length > 0) {
                    next[key] = slice.reduce((sum, val) => sum + val, 0) / slice.length
                }
            })
            return next
        })
    }

    return { data, seriesKeys: Array.from(seriesSet) }
}

export const buildSummaryCards = (summary: SummaryMetric[]) => {
    return summary.map((metric) => {
        const latest = metric.latest ?? metric.mean ?? 0
        const delta = metric.delta ?? 0
        const status =
            delta > 0 ? 'Improving' : delta < 0 ? 'Declining' : 'Stable'
        return {
            label: formatMetricLabel(metric.metric_name),
            value: Number.isFinite(latest) ? latest.toFixed(2) : 'n/a',
            delta: Number.isFinite(delta) ? delta.toFixed(2) : 'n/a',
            status,
        }
    })
}
