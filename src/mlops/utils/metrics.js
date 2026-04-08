import { format } from 'date-fns'

export const buildSummaryCards = (summaryMetrics) => {
    if (!summaryMetrics || summaryMetrics.length === 0) return []

    return summaryMetrics.map((m) => {
        let status = 'Stable'
        if (m.delta && m.delta < -5) status = 'Declining'
        if (m.delta && m.delta > 5) status = 'Improving'

        return {
            label: m.metric_name.replace(/_/g, ' '),
            value: m.latest ? m.latest.toFixed(2) : 'N/A',
            delta: m.delta ? (m.delta > 0 ? `+${m.delta.toFixed(2)}` : m.delta.toFixed(2)) : '0.00',
            status,
            raw: m
        }
    })
}

export const buildSeries = (records, metricName, clientFilter, trendWindow) => {
    // Basic implementation for line chart data
    // Group records by date
    const byDate = {}
    const allDates = new Set()

    const normalize = (s) => s ? s.toLowerCase().replace(/_/g, '').replace(/ /g, '') : ''
    const target = normalize(metricName)

    records.forEach(r => {
        if (!r.date_of_model_refresh) return
        const d = r.date_of_model_refresh.split('T')[0]

        // Filter by metric name (robust)
        if (target && normalize(r.metric_name) !== target) return

        // If client filter is active, only show that client
        if (clientFilter !== 'All Clients' && r.client_name !== clientFilter) return

        allDates.add(d)
        if (!byDate[d]) byDate[d] = {}

        // Use client name as key for multi-line
        byDate[d][r.client_name || 'Value'] = r.metric_value
        byDate[d]['threshold'] = r.threshold
    })

    const sortedDates = Array.from(allDates).sort()
    const data = sortedDates.map(date => ({
        date,
        ...byDate[date]
    }))

    const seriesKeys = new Set()
    records.forEach(r => {
        if (target && normalize(r.metric_name) !== target) return
        if (clientFilter === 'All Clients' || r.client_name === clientFilter) {
            seriesKeys.add(r.client_name || 'Value')
        }
    })

    return {
        data,
        seriesKeys: Array.from(seriesKeys)
    }
}

export const toDateKey = (dateInput) => {
    if (!dateInput) return ''
    // Handle Date objects
    if (dateInput instanceof Date) {
        return dateInput.toISOString().split('T')[0]
    }
    // Handle ISO strings
    if (typeof dateInput === 'string') {
        return dateInput.split('T')[0]
    }
    return ''
}
