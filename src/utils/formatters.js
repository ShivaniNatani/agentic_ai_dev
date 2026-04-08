/**
 * Shared number / date / label formatting utilities.
 * Used by OptimixIKSInsights, PayerResponseAnalytics, and Optimix.
 */

export const formatCurrency = (value) => {
    if (value === null || value === undefined || Number.isNaN(Number(value))) return '-'
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: 0,
    }).format(value)
}

export const formatCurrencyCompact = (value) => {
    const number = Number(value)
    if (!Number.isFinite(number)) return '-'
    const absolute = Math.abs(number)
    if (absolute >= 1_000_000_000) return `$${(number / 1_000_000_000).toFixed(1)}B`
    if (absolute >= 1_000_000) return `$${(number / 1_000_000).toFixed(1)}M`
    if (absolute >= 1_000) return `$${(number / 1_000).toFixed(0)}K`
    return formatCurrency(number)
}

export const formatNumber = (value) => {
    if (value === null || value === undefined || Number.isNaN(Number(value))) return '-'
    return new Intl.NumberFormat('en-US').format(value)
}

export const formatPercent = (value, decimals = 1) => {
    if (value === null || value === undefined || Number.isNaN(Number(value))) return 'N/A'
    return `${(Number(value) * 100).toFixed(decimals)}%`
}

export const formatDays = (value) =>
    Number.isFinite(Number(value)) ? `${Number(value).toFixed(1)} days` : 'N/A'

export const formatShortDate = (value) => {
    if (!value) return 'N/A'
    const parsed = new Date(value)
    if (Number.isNaN(parsed.getTime())) return value
    return parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export const formatDateTime = (value) => {
    if (!value) return 'N/A'
    const parsed = new Date(value)
    if (Number.isNaN(parsed.getTime())) return value
    return parsed.toLocaleString()
}

export const formatMonthLabel = (value) => {
    if (!value) return 'N/A'
    const parsed = new Date(`${value}-01T00:00:00`)
    if (Number.isNaN(parsed.getTime())) return value
    return parsed.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
}

export const formatWeekTickLabel = (value) => {
    if (!value) return 'N/A'
    const [start] = String(value).split('/')
    const parsed = new Date(start)
    if (Number.isNaN(parsed.getTime())) return value
    return parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export const formatWeekRangeLabel = (value) => {
    if (!value) return 'N/A'
    const [start, end] = String(value).split('/')
    const startDate = new Date(start)
    const endDate = new Date(end)
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return value
    return `${startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} to ${endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
}

export const truncateLabel = (value, maxLength = 24) => {
    if (!value) return 'N/A'
    const text = String(value)
    if (text.length <= maxLength) return text
    return `${text.slice(0, maxLength - 1)}...`
}

export const isFiniteNumber = (value) => Number.isFinite(Number(value))

export const hasDisplayValue = (value) => {
    if (value === null || value === undefined) return false
    if (typeof value === 'number') return Number.isFinite(value)
    if (typeof value === 'string') return value.trim() !== '' && value.trim().toUpperCase() !== 'N/A'
    return true
}
