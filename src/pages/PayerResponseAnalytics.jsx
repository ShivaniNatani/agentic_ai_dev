import { startTransition, useDeferredValue, useEffect, useMemo, useState } from 'react'
import {
    Area,
    AreaChart,
    Bar,
    BarChart,
    CartesianGrid,
    Cell,
    ComposedChart,
    Legend,
    Line,
    ReferenceLine,
    ResponsiveContainer,
    Scatter,
    ScatterChart,
    Tooltip,
    XAxis,
    YAxis,
    ZAxis
} from 'recharts'
import './PayerResponseAnalytics.css'

const formatCurrency = (value) => {
    if (value === null || value === undefined || Number.isNaN(Number(value))) return '-'
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: 0
    }).format(value)
}

const formatCurrencyCompact = (value) => {
    const number = Number(value)
    if (!Number.isFinite(number)) return '-'
    const absolute = Math.abs(number)
    if (absolute >= 1_000_000_000) return `$${(number / 1_000_000_000).toFixed(1)}B`
    if (absolute >= 1_000_000) return `$${(number / 1_000_000).toFixed(1)}M`
    if (absolute >= 1_000) return `$${(number / 1_000).toFixed(0)}K`
    return formatCurrency(number)
}

const formatNumber = (value) => {
    if (value === null || value === undefined || Number.isNaN(Number(value))) return '-'
    return new Intl.NumberFormat('en-US').format(value)
}

const formatIntegerInput = (value) => {
    if (value === null || value === undefined || value === '') return ''
    const numeric = Number(value)
    if (!Number.isFinite(numeric)) return ''
    return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(numeric)
}

const parseIntegerInput = (value) => {
    const digits = String(value || '').replace(/[^\d]/g, '')
    return digits ? Number(digits) : 0
}

const formatPercent = (value) => {
    if (value === null || value === undefined || Number.isNaN(Number(value))) return 'N/A'
    return `${(Number(value) * 100).toFixed(1)}%`
}

const formatShortDate = (value) => {
    if (!value) return 'N/A'
    const parsed = new Date(value)
    if (Number.isNaN(parsed.getTime())) return value
    return parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

const formatDateTime = (value) => {
    if (!value) return 'N/A'
    const parsed = new Date(value)
    if (Number.isNaN(parsed.getTime())) return value
    return parsed.toLocaleString('en-US', { timeZone: 'America/New_York', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true }) + ' EST'
}

const formatMonthLabel = (value) => {
    if (!value) return 'N/A'
    const parsed = new Date(`${value}-01T00:00:00`)
    if (Number.isNaN(parsed.getTime())) return value
    return parsed.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
}

const formatWeekTickLabel = (value) => {
    if (!value) return 'N/A'
    const [start] = String(value).split('/')
    const parsed = new Date(start)
    if (Number.isNaN(parsed.getTime())) return value
    return parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

const formatWeekRangeLabel = (value) => {
    if (!value) return 'N/A'
    const [start, end] = String(value).split('/')
    const startDate = new Date(start)
    const endDate = new Date(end)
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return value
    return `${startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} to ${endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
}

const truncateLabel = (value, maxLength = 24) => {
    if (!value) return 'N/A'
    const text = String(value)
    if (text.length <= maxLength) return text
    return `${text.slice(0, maxLength - 1)}...`
}

const isFiniteNumber = (value) => Number.isFinite(Number(value))
const hasDisplayValue = (value) => {
    if (value === null || value === undefined) return false
    if (typeof value === 'number') return Number.isFinite(value)
    if (typeof value === 'string') return value.trim() !== '' && value.trim().toUpperCase() !== 'N/A'
    return true
}

const formatDays = (value) => (isFiniteNumber(value) ? `${Number(value).toFixed(1)} days` : 'N/A')
const clamp = (value, min = 0, max = 1) => {
    const numeric = Number(value)
    if (!Number.isFinite(numeric)) return min
    return Math.min(max, Math.max(min, numeric))
}
const formatSignedPercentPoints = (value) => {
    const numeric = Number(value)
    if (!Number.isFinite(numeric)) return 'N/A'
    const points = numeric * 100
    const prefix = points > 0 ? '+' : ''
    return `${prefix}${points.toFixed(1)} pts`
}
const toShareRows = (rows, metricKeys) =>
    rows.map((row) => {
        const total = metricKeys.reduce((sum, key) => sum + (Number(row[key]) || 0), 0)
        const nextRow = { ...row }
        metricKeys.forEach((key) => {
            nextRow[key] = total > 0 ? (Number(row[key]) || 0) / total : 0
        })
        return nextRow
    })

const getNextMonthProbability = (analytics) => {
    const rows = analytics?.payment_timing?.by_submit_month || []
    if (!rows.length) return 0

    let lagOnePaid = 0
    let totalLagPaid = 0
    rows.forEach((row) => {
        totalLagPaid += row.paid_amt || 0
        if (row.month_lag === 1) lagOnePaid += row.paid_amt || 0
    })

    return totalLagPaid > 0 ? lagOnePaid / totalLagPaid : 0
}

const getTimingRecommendation = (timingRows) => {
    if (!timingRows?.length) return null
    const best = [...timingRows].sort((a, b) => (b.same_month_pct || 0) - (a.same_month_pct || 0))[0]
    const worst = [...timingRows].sort((a, b) => (a.same_month_pct || 0) - (b.same_month_pct || 0))[0]
    return { best, worst }
}

const buildPayerAnalyticsUrl = ({
    client,
    payer = 'All',
    submitStart = '',
    submitEnd = '',
    includeUnknownRankings = false,
    refresh = false
}) => {
    const url = new URL('/api/optimix/payer-response-analytics', window.location.origin)
    url.searchParams.set('client', client)
    if (payer && payer !== 'All') {
        url.searchParams.append('payer', payer)
    }
    if (submitStart) {
        url.searchParams.set('submit_start', submitStart)
    }
    if (submitEnd) {
        url.searchParams.set('submit_end', submitEnd)
    }
    if (includeUnknownRankings) {
        url.searchParams.set('include_unknown', 'true')
    }
    if (refresh) {
        url.searchParams.set('refresh', 'true')
    }
    return url
}

const requestPayerAnalytics = async ({
    client,
    payer = 'All',
    submitStart = '',
    submitEnd = '',
    includeUnknownRankings = false,
    refresh = false,
    signal
}) => {
    const response = await fetch(
        buildPayerAnalyticsUrl({
            client,
            payer,
            submitStart,
            submitEnd,
            includeUnknownRankings,
            refresh
        }),
        { signal }
    )
    const payload = await response.json().catch(() => null)
    if (!response.ok) {
        const error = new Error(payload?.error || `Failed to fetch payer response data (${response.status})`)
        error.status = response.status
        error.payload = payload
        throw error
    }
    return payload
}

const COLORS = {
    primary: '#818cf8',
    secondary: '#c084fc',
    accent1: '#fb923c',
    accent2: '#fb7185',
    accent3: '#f87171',
    accent4: '#e879f9',
    accent5: '#fbbf24',
    surface: 'rgba(10, 8, 22, 0.85)',
    border: 'rgba(255, 255, 255, 0.12)',
    text: '#ffffff',
    muted: '#e2e8f0',
    grid: 'rgba(167, 139, 250, 0.18)',
    section1Fast: '#a78bfa',
    section1Pulse: '#818cf8',
    section1Warm: '#fb923c',
    section1Reference: 'rgba(251, 146, 60, 0.6)',
    operatingGood: '#818cf8',
    operatingMid: '#c084fc',
    operatingRisk: '#fbbf24'
}

const GRAPH_COLORS = {
    responseDays: {
        claimsFill: 'rgba(129, 140, 248, 0.2)',
        avg: '#f97316',
        median: '#c084fc'
    },
    collectionTrend: {
        paid: '#a855f7',
        rate: '#ec4899'
    },
    section1: {
        speedTop: '#8b5cf6',
        speedRest: '#6366f1',
        volume: '#818cf8',
        variability: '#f97316'
    },
    charged: '#a855f7',
    paid: '#f97316',
    responseTiming: {
        same: '#6366f1',
        later: '#fb7185'
    },
    lagBreakdown: {
        lag0: '#818cf8',
        lag1: '#c084fc',
        lag2: '#f59e0b',
        lag3: '#fb7185'
    },
    paymentMonth: {
        lag0: '#7c3aed',
        lag1: '#f97316',
        lag2: '#fb7185',
        lag3: '#6366f1'
    },
    receiptPattern: {
        bar: '#f59e0b',
        area: '#8b5cf6',
        areaFill: 'rgba(139, 92, 246, 0.14)'
    },
    paymentWom: {
        lag0: '#818cf8',
        lag1: '#a855f7',
        lag2: '#f59e0b',
        lag3: '#fb7185'
    },
    responseWeek: '#ec4899',
    weekLag: ['#6366f1', '#8b5cf6', '#f59e0b', '#fb7185', '#c084fc', '#f97316', '#be185d', '#7c3aed'],
    sameMonthRate: '#6366f1',
    plannerTop: '#8b5cf6',
    plannerRest: '#f97316'
}

const DEFAULT_CLIENT_CATALOG = [
    { client: 'GIA', label: 'GIA', available: true, status: 'available' }
]
const PRA_UI_RELEASE = 'payer-response-command-center-2026-04-16'

// ─── Payer Response fallback mock (shown when API is unavailable) ─────────────
const PAYERS_MOCK = ['Aetna', 'UnitedHealth', 'BCBS', 'Cigna', 'Humana', 'Medicare', 'Medicaid', 'Anthem']
const PRA_MOCK_WEEK_PROFILES = [
    { submit_wom: 1, claims: 4680, same_month_pct: 0.74, avg_days: 16.8, median_days: 13.0, p90_days: 36.0, paid_amt: 17400000, lag_weights: [0.74, 0.17, 0.06, 0.03], week_lag_weights: [0.18, 0.24, 0.19, 0.14, 0.10, 0.07, 0.05, 0.02, 0.01] },
    { submit_wom: 2, claims: 4920, same_month_pct: 0.71, avg_days: 18.6, median_days: 14.0, p90_days: 39.0, paid_amt: 16800000, lag_weights: [0.71, 0.19, 0.07, 0.03], week_lag_weights: [0.16, 0.22, 0.20, 0.15, 0.11, 0.08, 0.05, 0.02, 0.01] },
    { submit_wom: 3, claims: 4650, same_month_pct: 0.65, avg_days: 21.3, median_days: 17.0, p90_days: 43.0, paid_amt: 15100000, lag_weights: [0.65, 0.23, 0.08, 0.04], week_lag_weights: [0.13, 0.19, 0.19, 0.16, 0.12, 0.09, 0.06, 0.04, 0.02] },
    { submit_wom: 4, claims: 4170, same_month_pct: 0.59, avg_days: 24.1, median_days: 19.0, p90_days: 48.0, paid_amt: 13200000, lag_weights: [0.59, 0.25, 0.10, 0.06], week_lag_weights: [0.11, 0.17, 0.18, 0.16, 0.13, 0.10, 0.08, 0.05, 0.02] }
]
const PRA_MOCK_MONTH_PROFILES = [
    { submit_month: '2025-10', charged_amt: 11600000, paid_amt: 9800000, claims: 3020 },
    { submit_month: '2025-11', charged_amt: 11900000, paid_amt: 10100000, claims: 3090 },
    { submit_month: '2025-12', charged_amt: 12300000, paid_amt: 10400000, claims: 3140 },
    { submit_month: '2026-01', charged_amt: 12600000, paid_amt: 10700000, claims: 3145 },
    { submit_month: '2026-02', charged_amt: 12800000, paid_amt: 10800000, claims: 3040 },
    { submit_month: '2026-03', charged_amt: 13600000, paid_amt: 10600000, claims: 2985 },
]
const PRA_MOCK_MONTH_LAG_SHARES = [
    { month_lag: 0, share: 0.68 },
    { month_lag: 1, share: 0.22 },
    { month_lag: 2, share: 0.07 },
    { month_lag: 3, share: 0.03 },
]
const PRA_MOCK_TIMING_COUNTS = PRA_MOCK_WEEK_PROFILES.map((week) => {
    const sameMonth = Math.round(week.claims * week.same_month_pct)
    const later = week.claims - sameMonth
    const breakdown = [
        { submit_wom: week.submit_wom, month_lag: 0, count: sameMonth },
        { submit_wom: week.submit_wom, month_lag: 1, count: Math.round(later * 0.58) },
        { submit_wom: week.submit_wom, month_lag: 2, count: Math.round(later * 0.27) },
        { submit_wom: week.submit_wom, month_lag: 3, count: later - Math.round(later * 0.58) - Math.round(later * 0.27) }
    ]
    return {
        submit_wom: week.submit_wom,
        total: week.claims,
        same_month: sameMonth,
        later,
        same_month_pct: week.same_month_pct,
        breakdown
    }
})
const PRA_MOCK_PAYMENT_BY_SUBMIT_MONTH = PRA_MOCK_MONTH_PROFILES.flatMap((month) => (
    PRA_MOCK_MONTH_LAG_SHARES.map((lag) => ({
        submit_month: month.submit_month,
        month_lag: lag.month_lag,
        paid_amt: Math.round(month.paid_amt * lag.share)
    }))
))
const PRA_MOCK_PAYMENT_BY_SUBMIT_WOM = PRA_MOCK_WEEK_PROFILES.flatMap((week) => (
    week.lag_weights.map((share, monthLag) => ({
        submit_wom: week.submit_wom,
        month_lag: monthLag,
        paid_amt: Math.round(week.paid_amt * share)
    }))
))
const PRA_MOCK_PAYMENT_BY_SUBMIT_WOM_WEEK_LAG = PRA_MOCK_WEEK_PROFILES.flatMap((week) => (
    week.week_lag_weights.map((share, weekLag) => ({
        submit_wom: week.submit_wom,
        week_lag: weekLag,
        paid_amt: Math.round(week.paid_amt * share)
    }))
))
const PRA_MOCK_RESPONSE_PATTERN_COUNTS = [2740, 2860, 3010, 3180, 2560, 2070]
const PRA_MOCK_RESPONSE_RECEIPT_PATTERN = [
    '2026-01-06/2026-01-12',
    '2026-01-20/2026-01-26',
    '2026-02-03/2026-02-09',
    '2026-02-17/2026-02-23',
    '2026-03-03/2026-03-09',
    '2026-03-17/2026-03-23'
].map((resp_wom, index) => ({
    resp_wom,
    count: PRA_MOCK_RESPONSE_PATTERN_COUNTS[index],
    pct: PRA_MOCK_RESPONSE_PATTERN_COUNTS[index] / PRA_MOCK_RESPONSE_PATTERN_COUNTS.reduce((sum, value) => sum + value, 0)
}))
const PRA_MOCK_PAYMENT_BY_RESPONSE_WEEK_AMOUNTS = [8200000, 9100000, 10500000, 11700000, 11200000, 11500000]
const PRA_MOCK_PAYMENT_BY_RESPONSE_WEEK = PRA_MOCK_RESPONSE_RECEIPT_PATTERN.map((row, index) => ({
    resp_week: row.resp_wom,
    paid_amt: PRA_MOCK_PAYMENT_BY_RESPONSE_WEEK_AMOUNTS[index],
    pct_of_total_paid: PRA_MOCK_PAYMENT_BY_RESPONSE_WEEK_AMOUNTS[index] / PRA_MOCK_PAYMENT_BY_RESPONSE_WEEK_AMOUNTS.reduce((sum, value) => sum + value, 0)
}))
const PRA_MOCK_RESPONSE_DAYS_PATTERN = {
    by_submit_wom: PRA_MOCK_WEEK_PROFILES.map((week) => ({
        submit_wom: week.submit_wom,
        claims: week.claims,
        avg_days: week.avg_days,
        median_days: week.median_days,
        p90_days: week.p90_days,
    }))
}
const PRA_MOCK_COLLECTION_TREND = {
    by_response_month: [
        { resp_month: '2025-10', paid_amt: 8900000, charged_amt: 10900000, claims: 2760, collect_rate: 0.8165 },
        { resp_month: '2025-11', paid_amt: 9400000, charged_amt: 11300000, claims: 2890, collect_rate: 0.8319 },
        { resp_month: '2025-12', paid_amt: 10100000, charged_amt: 11900000, claims: 3010, collect_rate: 0.8487 },
        { resp_month: '2026-01', paid_amt: 10800000, charged_amt: 12700000, claims: 3140, collect_rate: 0.8504 },
        { resp_month: '2026-02', paid_amt: 11100000, charged_amt: 13100000, claims: 3210, collect_rate: 0.8473 },
        { resp_month: '2026-03', paid_amt: 12200000, charged_amt: 14500000, claims: 3410, collect_rate: 0.8414 },
    ]
}
const PRA_MOCK_SUMMARY_TABLE = PAYERS_MOCK.map((payer, index) => {
    const charged_amt = 9350000 - index * 700000
    const paid_amt = 7800000 - index * 620000
    return {
        Payer_name: payer,
        claims: 2300 - index * 180,
        avg_days: 14 + index * 2.5,
        std_days: 4.8 + index * 0.5,
        charged_amt,
        paid_amt,
        denial_count: 190 + index * 24,
        prediction_rows: 1600 - index * 110,
        prediction_matches: 1240 - index * 96,
        collection_rate: paid_amt / charged_amt,
        denial_rate: 0.08 + index * 0.01,
        open_balance: charged_amt - paid_amt,
    }
})
const PRA_MOCK = {
    meta: {
        client: 'GIA',
        client_catalog: DEFAULT_CLIENT_CATALOG,
        total_records: 18420,
        filtered_records: 18420,
        loaded_at: new Date().toISOString(),
        coverage: { submit_start: '2025-04-01', submit_end: '2026-03-17' },
        filtered_coverage: { submit_start: '2025-04-01', submit_end: '2026-03-17' },
        source_name: 'Latest available payer-response analytics',
        notes: ['Live payer-response source is unavailable. Showing the latest available analytics shape.'],
    },
    kpis: {
        total_claims: 18420,
        total_charged: 74800000,
        total_paid: 62500000,
        collection_rate: 0.836,
        avg_response_days: 22.4,
        appeal_avg_response_days: 29.8,
        first_time_avg_response_days: 18.6,
        appeal_response_count: 4120,
        first_time_response_count: 14300,
        median_response_days: 18.0,
        same_month_response_rate: 0.68,
        next_month_cash_share: 0.22,
    },
    filters: {
        payer_options: PAYERS_MOCK.map((p, i) => ({
            value: p, label: p, claims: 2300 - i * 180, charged_amt: 9350000 - i * 700000, paid_amt: 7800000 - i * 620000, is_unknown: false,
        })),
    },
    payer_performance: {
        by_charged: PAYERS_MOCK.map((p, i) => ({
            Payer_name: p, charged_amt: 9350000 - i * 700000, paid_amt: 7800000 - i * 620000,
            collection_rate: 0.84 - i * 0.01, denial_rate: 0.08 + i * 0.01, open_balance: 1550000 - i * 80000,
        })),
        by_paid: PAYERS_MOCK.map((p, i) => ({
            Payer_name: p, paid_amt: 7800000 - i * 620000, collection_rate: 0.84 - i * 0.01,
        })),
        by_speed: PAYERS_MOCK.map((p, i) => ({
            Payer_name: p, avg_days: 14 + i * 2.5, claims: 2300 - i * 180,
        })),
        consistency: PAYERS_MOCK.map((p, i) => ({
            Payer_name: p, avg_days: 14 + i * 2.5, charged_amt: 9350000 - i * 700000,
            paid_amt: 7800000 - i * 620000, open_balance: 1550000 - i * 80000,
        })),
        summary_table: PRA_MOCK_SUMMARY_TABLE,
    },
    response_days_pattern: PRA_MOCK_RESPONSE_DAYS_PATTERN,
    collection_trend: PRA_MOCK_COLLECTION_TREND,
    timing_counts: PRA_MOCK_TIMING_COUNTS,
    response_receipt_pattern: PRA_MOCK_RESPONSE_RECEIPT_PATTERN,
    payment_timing: {
        by_submit_month: PRA_MOCK_PAYMENT_BY_SUBMIT_MONTH,
        by_submit_wom: PRA_MOCK_PAYMENT_BY_SUBMIT_WOM,
        by_response_week: PRA_MOCK_PAYMENT_BY_RESPONSE_WEEK,
        by_submit_wom_week_lag: PRA_MOCK_PAYMENT_BY_SUBMIT_WOM_WEEK_LAG,
    },
    planner_baseline: {
        historical_efficiency: 0.91,
        weekly_weights: [1, 2, 3, 4].map((w) => ({ week: w, weight: [0.25, 0.35, 0.28, 0.12][w - 1] })),
        daily_weights: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].map((label, index) => ({
            day_index: index,
            label,
            weight: [0.18, 0.24, 0.23, 0.21, 0.14][index]
        }))
    },
}
const buildPayerFallback = ({ client = 'GIA', message = '', clientCatalog = null } = {}) => ({
    ...PRA_MOCK,
    meta: {
        ...PRA_MOCK.meta,
        client,
        client_catalog: clientCatalog || PRA_MOCK.meta.client_catalog,
        loaded_at: new Date().toISOString(),
        source_name: message ? `Latest available analytics (${message})` : PRA_MOCK.meta.source_name,
        notes: [
            ...(PRA_MOCK.meta.notes || []),
            ...(message ? [message] : [])
        ],
    },
})
const getFallbackPayerOptions = () => PRA_MOCK.filters.payer_options.map((option) => ({ ...option }))
const UNKNOWN_PAYER = 'Unknown'
const PLANNER_SCOPE_CURRENT = '__current_scope__'
const PLANNER_SCOPE_ALL = '__all_payers__'
const HIDDEN_PAYOR_RESPONSE_CARD_LABELS = new Set(['Total Charged Amount', 'Total Paid Amount'])

const getCollectionTone = (value) => {
    const rate = Number(value)
    if (!Number.isFinite(rate)) return COLORS.muted
    if (rate >= 0.35) return COLORS.operatingGood
    if (rate >= 0.2) return COLORS.operatingMid
    return COLORS.operatingRisk
}

const CustomTooltip = ({ active, payload, label, formatter, labelFormatter }) => {
    if (!active || !payload || payload.length === 0) return null
    const displayLabel = labelFormatter ? labelFormatter(label, payload) : label

    return (
        <div className="pra-tooltip">
            <p className="pra-tooltip-label">{displayLabel}</p>
            {payload.map((entry) => (
                <p key={`${entry.name}-${entry.dataKey}`} style={{ color: entry.color || entry.fill }}>
                    {entry.name}: {formatter ? formatter(entry.value, entry.name) : entry.value}
                </p>
            ))}
        </div>
    )
}

const PlannerSplitTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null
    const row = payload[0].payload
    return (
        <div className="pra-tooltip">
            <strong>{row.full_name}</strong>
            <p>Collection target: {formatCurrency(row.target_collections)}</p>
            <p>Required gross charges: {formatCurrency(row.required_gross)}</p>
            <p>Payer cash share: {formatPercent(row.pct)}</p>
        </div>
    )
}

function StatCard({ label, value, supporting, highlight = false }) {
    return (
        <div className={`pra-kpi-card ${highlight ? 'highlight' : ''}`}>
            <div className="pra-kpi-label">{label}</div>
            <div className="pra-kpi-value">{value}</div>
            {supporting ? <div className="pra-kpi-support">{supporting}</div> : null}
        </div>
    )
}

function EmptyState({ message }) {
    return <div className="pra-empty-state">{message}</div>
}

function MissingDataNotice({ summary, reason, requiredFields = [] }) {
    return (
        <details className="pra-missing-data">
            <summary>
                <span>{summary}</span>
                <small>Show details</small>
            </summary>
            <p>{reason}</p>
            {requiredFields.length ? (
                <div className="pra-missing-tags">
                    {requiredFields.map((field) => (
                        <span key={field}>{field}</span>
                    ))}
                </div>
            ) : null}
        </details>
    )
}

function SummaryCard({ title, value, detail }) {
    return (
        <div className="pra-summary-card">
            <span className="pra-summary-title">{title}</span>
            <strong>{value}</strong>
            <small>{detail}</small>
        </div>
    )
}

function PlannerWowCard({ eyebrow, value, label, detail, accent = 'primary' }) {
    return (
        <div className={`pra-wow-card pra-wow-card--${accent}`}>
            <span className="pra-wow-eyebrow">{eyebrow}</span>
            <strong className="pra-wow-value">{value}</strong>
            <span className="pra-wow-label">{label}</span>
            <p className="pra-wow-detail">{detail}</p>
        </div>
    )
}

function BenchmarkRow({ label, value, detail, tone = 'neutral' }) {
    return (
        <div className="pra-wow-benchmark-row">
            <div className="pra-wow-benchmark-top">
                <span className="pra-wow-benchmark-label">{label}</span>
                <strong className={`pra-wow-benchmark-value ${tone}`}>{value}</strong>
            </div>
            <small className="pra-wow-benchmark-detail">{detail}</small>
        </div>
    )
}

function ChartSummary({ items }) {
    const visibleItems = (items || []).filter(Boolean)
    if (!visibleItems.length) return null

    return (
        <div className="pra-chart-summary" aria-label="Chart summary">
            <span className="pra-chart-summary-label">Quick read</span>
            {visibleItems.map((item) => (
                <p key={item}>{item}</p>
            ))}
        </div>
    )
}

function OperatingPriorityTooltip({ active, payload }) {
    if (!active || !payload?.length) return null
    const row = payload[0].payload

    return (
        <div className="pra-tooltip">
            <p className="pra-tooltip-label">{row.Payer_name}</p>
            <p style={{ color: row.bubble_fill || COLORS.operatingMid }}>Open balance: {formatCurrency(row.open_balance)}</p>
            <p>Average response: {formatDays(row.avg_days)}</p>
            <p>Claims: {formatNumber(row.claims)}</p>
            <p>Collection rate: {formatPercent(row.collection_rate)}</p>
        </div>
    )
}

function GlowBubbleShape({ cx, cy, size, payload }) {
    if (!isFiniteNumber(cx) || !isFiniteNumber(cy)) return null
    const fill = payload?.bubble_fill || COLORS.section1Pulse
    const radius = Math.max(8, Math.min(22, Math.sqrt(Number(size) || 144) / 2.1))

    return (
        <g>
            <circle cx={cx} cy={cy} r={radius + 5} fill={fill} opacity={0.12} />
            <circle cx={cx} cy={cy} r={radius} fill={fill} fillOpacity={0.84} stroke="#f5f3ff" strokeOpacity={0.72} strokeWidth={1.6} />
        </g>
    )
}

const wrapAxisLabel = (value, maxChars = 8) => {
    const text = String(value || '')
    if (text.length <= maxChars) return [text]

    const words = text.split(' ')
    if (words.length > 1) {
        const lines = []
        let current = ''
        words.forEach((word) => {
            const next = current ? `${current} ${word}` : word
            if (next.length <= maxChars || !current) {
                current = next
            } else if (lines.length < 1) {
                lines.push(current)
                current = word
            }
        })
        if (current) lines.push(current)
        return lines.slice(0, 2).map((line, index, arr) => (index === arr.length - 1 && line.length > maxChars ? `${line.slice(0, maxChars - 1)}...` : line))
    }

    return [text.slice(0, maxChars), `${text.slice(maxChars, maxChars * 2 - 1)}...`]
}

function WrappedAxisTick({ x, y, payload }) {
    const lines = wrapAxisLabel(payload?.value, 9)

    return (
        <text x={x} y={y + 10} textAnchor="middle" fill={COLORS.text} fontSize="10">
            {lines.map((line, index) => (
                <tspan key={`${payload?.value}-${line}-${index}`} x={x} dy={index === 0 ? 0 : 12}>
                    {line}
                </tspan>
            ))}
        </text>
    )
}

function RankedAmountList({ rows, valueKey, color, valueLabel }) {
    const visibleRows = (rows || []).filter((row) => Number(row?.[valueKey]) > 0).slice(0, 10)
    if (!visibleRows.length) {
        return <EmptyState message="No payer rows are available for the current scope." />
    }

    const maxValue = Math.max(...visibleRows.map((row) => Number(row[valueKey]) || 0), 1)

    return (
        <div className="pra-ranked-list">
            {visibleRows.map((row, index) => {
                const value = Number(row[valueKey]) || 0
                const width = Math.max((value / maxValue) * 100, 6)

                return (
                    <div key={`${row.Payer_name}-${valueKey}-${index}`} className="pra-ranked-row">
                        <div className="pra-ranked-rank">{index + 1}</div>
                        <div className="pra-ranked-card">
                            <div className="pra-ranked-head">
                                <div>
                                    <strong title={row.Payer_name}>{truncateLabel(row.Payer_name, 38)}</strong>
                                    <span>{valueLabel}</span>
                                </div>
                                <div className="pra-ranked-value">{formatCurrency(value)}</div>
                            </div>
                            <div className="pra-ranked-track">
                                <div className="pra-ranked-fill" style={{ width: `${width}%`, background: color }} />
                            </div>
                            <div className="pra-ranked-meta">
                                <span>{formatNumber(row.claims)} claims</span>
                                <span>{formatPercent(row.collection_rate)} collected</span>
                                <span>{Number(row.avg_days || 0).toFixed(1)} avg days</span>
                            </div>
                        </div>
                    </div>
                )
            })}
        </div>
    )
}

function PayerResponseAnalytics({ embedded = false }) {
    const [data, setData] = useState(null)
    const [loading, setLoading] = useState(true)
    const [refreshing, setRefreshing] = useState(false)
    const [error, setError] = useState('')
    const [selectedClient, setSelectedClient] = useState('GIA')
    const [selectedPayer, setSelectedPayer] = useState('All')
    const [payerSearch, setPayerSearch] = useState('')
    const [submitStart, setSubmitStart] = useState('')
    const [submitEnd, setSubmitEnd] = useState('')
    const [includeUnknownRankings, setIncludeUnknownRankings] = useState(false)
    const [plannerMode, setPlannerMode] = useState('target')
    const [plannerCadence, setPlannerCadence] = useState('week')
    const [plannerView, setPlannerView] = useState('core')
    const [plannerPayerScope, setPlannerPayerScope] = useState(PLANNER_SCOPE_CURRENT)
    const [plannerScopedAnalytics, setPlannerScopedAnalytics] = useState({ key: '', payload: null })
    const [plannerScopeLoading, setPlannerScopeLoading] = useState(false)
    const [plannerScopeError, setPlannerScopeError] = useState('')
    const [portfolioAnalytics, setPortfolioAnalytics] = useState({ key: '', payload: null })
    const [portfolioLoading, setPortfolioLoading] = useState(false)
    const [portfolioError, setPortfolioError] = useState('')
    const [targetCollection, setTargetCollection] = useState(1_000_000)
    const [targetCollectionInput, setTargetCollectionInput] = useState(() => formatIntegerInput(1_000_000))
    const [grossChargesInput, setGrossChargesInput] = useState(5_000_000)
    const [grossChargesInputText, setGrossChargesInputText] = useState(() => formatIntegerInput(5_000_000))
    const [weekLagCap, setWeekLagCap] = useState(8)

    const deferredPayerSearch = useDeferredValue(payerSearch)

    const fetchAnalytics = async ({ refresh = false, signal } = {}) => {
        try {
            if (refresh) {
                setRefreshing(true)
            } else if (!data) {
                setLoading(true)
            }
            setError('')

            const payload = await requestPayerAnalytics({
                client: selectedClient,
                payer: selectedPayer,
                submitStart,
                submitEnd,
                includeUnknownRankings,
                refresh,
                signal
            })
            setData(payload)
        } catch (err) {
            if (err?.name === 'AbortError') return
            console.warn('Payer Response API unavailable, using mock data:', err.message)
            setData(buildPayerFallback({
                client: selectedClient,
                message: err?.message || 'Live payer-response source unavailable.',
                clientCatalog: err?.payload?.meta?.client_catalog || null
            }))
            setError(err?.message || 'Live payer-response source unavailable.')
        } finally {
            setLoading(false)
            setRefreshing(false)
        }
    }

    useEffect(() => {
        if (submitStart && submitEnd && submitStart > submitEnd) return
        const controller = new AbortController()
        fetchAnalytics({ signal: controller.signal })
        return () => controller.abort()
    }, [selectedClient, selectedPayer, includeUnknownRankings, submitStart, submitEnd])

    const handleTargetCollectionChange = (rawValue) => {
        const parsed = parseIntegerInput(rawValue)
        setTargetCollectionInput(rawValue ? formatIntegerInput(parsed) : '')
        startTransition(() => {
            setTargetCollection(parsed)
        })
    }

    const handleGrossChargesChange = (rawValue) => {
        const parsed = parseIntegerInput(rawValue)
        setGrossChargesInputText(rawValue ? formatIntegerInput(parsed) : '')
        startTransition(() => {
            setGrossChargesInput(parsed)
        })
    }

    const clientCatalog = (data?.meta?.client_catalog || DEFAULT_CLIENT_CATALOG).filter(c => c.client !== 'AXIA')
    const meta = data?.meta || {}
    const submitCoverageStart = meta?.coverage?.submit_start || ''
    const submitCoverageEnd = meta?.coverage?.submit_end || ''
    const dateRangeError = submitStart && submitEnd && submitStart > submitEnd
        ? 'Submission start date must be on or before the end date.'
        : ''
    const kpis = data?.kpis || {}
    const payerPerformance = data?.payer_performance || {}
    const timingCounts = data?.timing_counts || []
    const plannerBaseline = data?.planner_baseline || {}
    const payerOptions = useMemo(() => {
        if (Array.isArray(data?.filters?.payer_options) && data.filters.payer_options.length) {
            return data.filters.payer_options
        }

        if (Array.isArray(data?.filters?.payers) && data.filters.payers.length) {
            return data.filters.payers.map((payer) => ({
                value: payer,
                label: payer === UNKNOWN_PAYER ? 'Unknown / Missing payer name' : payer,
                claims: null,
                charged_amt: null,
                paid_amt: null,
                is_unknown: payer === UNKNOWN_PAYER
            }))
        }

        return getFallbackPayerOptions()
    }, [data])

    const unknownPayerRow = useMemo(() => {
        const sources = [
            ...(payerPerformance.by_charged || []),
            ...(payerPerformance.by_paid || []),
            ...(payerPerformance.consistency || [])
        ]
        return sources.find((row) => row?.Payer_name === UNKNOWN_PAYER) || null
    }, [payerPerformance.by_charged, payerPerformance.by_paid, payerPerformance.consistency])

    const quality = useMemo(() => {
        if (meta?.data_quality) return meta.data_quality

        const totalClaims = Number(kpis.total_claims) || Number(timingCounts.reduce((sum, row) => sum + (Number(row.total) || 0), 0)) || 0
        const totalCharged = Number(kpis.total_charged) || 0
        const totalPaid = Number(kpis.total_paid) || 0
        const missingRows = Number(unknownPayerRow?.claims) || 0
        const missingCharged = Number(unknownPayerRow?.charged_amt) || 0
        const missingPaid = Number(unknownPayerRow?.paid_amt) || 0

        return {
            missing_payer_rows: missingRows,
            missing_payer_pct: totalClaims > 0 ? missingRows / totalClaims : null,
            missing_payer_charged_pct: totalCharged > 0 ? missingCharged / totalCharged : null,
            missing_payer_paid_pct: totalPaid > 0 ? missingPaid / totalPaid : null,
            known_payer_count: payerOptions.filter((option) => !option.is_unknown).length,
            payment_flag_zero_paid_rows: null,
            denial_rows: null,
            prediction_rows: null
        }
    }, [meta?.data_quality, kpis.total_claims, kpis.total_charged, kpis.total_paid, timingCounts, unknownPayerRow, payerOptions])

    useEffect(() => {
        if (selectedPayer === 'All') return
        const validPayers = new Set(payerOptions.map((option) => option.value))
        if (!validPayers.has(selectedPayer)) {
            setSelectedPayer('All')
        }
    }, [payerOptions, selectedPayer])

    const visiblePayerOptions = useMemo(() => {
        const normalizedQuery = deferredPayerSearch.trim().toLowerCase()
        let options = payerOptions

        if (normalizedQuery) {
            options = options.filter((option) => option.label.toLowerCase().includes(normalizedQuery))
        }

        if (selectedPayer !== 'All') {
            const selectedOption = payerOptions.find((option) => option.value === selectedPayer)
            if (selectedOption && !options.some((option) => option.value === selectedPayer)) {
                options = [selectedOption, ...options]
            }
        }

        return options.slice(0, 250)
    }, [deferredPayerSearch, payerOptions, selectedPayer])

    const selectedPayerOption = useMemo(
        () => payerOptions.find((option) => option.value === selectedPayer) || null,
        [payerOptions, selectedPayer]
    )
    const currentPageScopeLabel = selectedPayer === 'All'
        ? 'All payers'
        : (selectedPayerOption?.label || selectedPayer)
    const plannerScopeResolvedPayer = plannerPayerScope === PLANNER_SCOPE_CURRENT
        ? selectedPayer
        : plannerPayerScope === PLANNER_SCOPE_ALL
            ? 'All'
            : plannerPayerScope
    const plannerUsesMainData = plannerScopeResolvedPayer === selectedPayer
    const plannerScopeLabel = plannerPayerScope === PLANNER_SCOPE_CURRENT
        ? `Current page scope: ${currentPageScopeLabel}`
        : plannerPayerScope === PLANNER_SCOPE_ALL
            ? 'All payers'
            : (payerOptions.find((option) => option.value === plannerPayerScope)?.label || plannerScopeResolvedPayer)
    const plannerScopeNarrative = plannerPayerScope === PLANNER_SCOPE_CURRENT
        ? `the current page scope (${currentPageScopeLabel})`
        : plannerPayerScope === PLANNER_SCOPE_ALL
            ? 'all payers'
            : plannerScopeLabel
    const plannerScopeOptions = useMemo(
        () => [
            {
                value: PLANNER_SCOPE_CURRENT,
                label: `Current page scope (${currentPageScopeLabel})`
            },
            ...(selectedPayer === 'All'
                ? []
                : [{ value: PLANNER_SCOPE_ALL, label: 'All payers' }]),
            ...payerOptions
                .filter((option) => option.value !== selectedPayer)
                .map((option) => ({
                    value: option.value,
                    label: option.label
                }))
        ],
        [currentPageScopeLabel, payerOptions, selectedPayer]
    )
    const activeFilterChips = useMemo(() => {
        const chips = []
        if (selectedPayer !== 'All') {
            chips.push(`Payer: ${selectedPayerOption?.label || selectedPayer}`)
        }
        if (submitStart || submitEnd) {
            chips.push(`Submit dates: ${submitStart || 'Start'} to ${submitEnd || 'End'}`)
        }
        if (includeUnknownRankings) {
            chips.push('Unknown payer bucket included')
        }
        return chips
    }, [selectedPayer, selectedPayerOption, submitStart, submitEnd, includeUnknownRankings])
    const hasActiveFilters = activeFilterChips.length > 0

    useEffect(() => {
        if (plannerPayerScope === PLANNER_SCOPE_CURRENT || plannerPayerScope === PLANNER_SCOPE_ALL) return
        const validPlannerPayers = new Set(payerOptions.map((option) => option.value))
        if (!validPlannerPayers.has(plannerPayerScope)) {
            setPlannerPayerScope(PLANNER_SCOPE_CURRENT)
        }
    }, [payerOptions, plannerPayerScope])

    const plannerScopeRequestKey = [
        selectedClient,
        plannerScopeResolvedPayer,
        submitStart,
        submitEnd,
        includeUnknownRankings ? 'include-unknown' : 'known-only',
        meta.loaded_at || '',
        meta.source_last_modified || ''
    ].join('::')

    useEffect(() => {
        if (plannerUsesMainData || dateRangeError) {
            setPlannerScopeLoading(false)
            setPlannerScopeError('')
            return
        }

        const controller = new AbortController()
        let isCancelled = false

        setPlannerScopeLoading(true)
        setPlannerScopeError('')

        requestPayerAnalytics({
            client: selectedClient,
            payer: plannerScopeResolvedPayer,
            submitStart,
            submitEnd,
            includeUnknownRankings,
            signal: controller.signal
        })
            .then((payload) => {
                if (isCancelled) return
                setPlannerScopedAnalytics({ key: plannerScopeRequestKey, payload })
            })
            .catch((err) => {
                if (isCancelled || err?.name === 'AbortError') return
                setPlannerScopedAnalytics({ key: '', payload: null })
                setPlannerScopeError(err?.message || 'Unable to load the selected planner scope.')
            })
            .finally(() => {
                if (!isCancelled) {
                    setPlannerScopeLoading(false)
                }
            })

        return () => {
            isCancelled = true
            controller.abort()
        }
    }, [
        dateRangeError,
        includeUnknownRankings,
        plannerScopeRequestKey,
        plannerScopeResolvedPayer,
        plannerUsesMainData,
        selectedClient,
        submitEnd,
        submitStart
    ])

    const plannerScopedPayload = !plannerUsesMainData && plannerScopedAnalytics.key === plannerScopeRequestKey
        ? plannerScopedAnalytics.payload
        : null
    const plannerScopePending = !dateRangeError && !plannerUsesMainData && plannerScopeLoading && !plannerScopedPayload
    const plannerScopeUnavailable = !dateRangeError && !plannerUsesMainData && !plannerScopeLoading && !plannerScopedPayload
    const plannerData = plannerUsesMainData ? data : plannerScopedPayload
    const portfolioUsesMainData = selectedPayer === 'All'
    const portfolioUsesPlannerData = !portfolioUsesMainData && plannerScopeResolvedPayer === 'All'
    const portfolioRequestKey = [
        selectedClient,
        'All',
        submitStart,
        submitEnd,
        includeUnknownRankings ? 'include-unknown' : 'known-only',
        meta.loaded_at || '',
        meta.source_last_modified || ''
    ].join('::')

    useEffect(() => {
        if (portfolioUsesMainData || portfolioUsesPlannerData || dateRangeError) {
            setPortfolioLoading(false)
            setPortfolioError('')
            return
        }

        const controller = new AbortController()
        let isCancelled = false

        setPortfolioLoading(true)
        setPortfolioError('')

        requestPayerAnalytics({
            client: selectedClient,
            payer: 'All',
            submitStart,
            submitEnd,
            includeUnknownRankings,
            signal: controller.signal
        })
            .then((payload) => {
                if (isCancelled) return
                setPortfolioAnalytics({ key: portfolioRequestKey, payload })
            })
            .catch((err) => {
                if (isCancelled || err?.name === 'AbortError') return
                setPortfolioAnalytics({ key: '', payload: null })
                setPortfolioError(err?.message || 'Unable to load the all-payer benchmark.')
            })
            .finally(() => {
                if (!isCancelled) {
                    setPortfolioLoading(false)
                }
            })

        return () => {
            isCancelled = true
            controller.abort()
        }
    }, [
        dateRangeError,
        includeUnknownRankings,
        portfolioRequestKey,
        portfolioUsesMainData,
        portfolioUsesPlannerData,
        selectedClient,
        submitEnd,
        submitStart
    ])

    const portfolioScopedPayload = !portfolioUsesMainData && !portfolioUsesPlannerData && portfolioAnalytics.key === portfolioRequestKey
        ? portfolioAnalytics.payload
        : null
    const portfolioData = portfolioUsesMainData
        ? data
        : portfolioUsesPlannerData
            ? plannerData
            : portfolioScopedPayload
    const portfolioPending = !dateRangeError && (
        (portfolioUsesPlannerData && plannerScopePending && !plannerData) ||
        (!portfolioUsesMainData && !portfolioUsesPlannerData && portfolioLoading && !portfolioScopedPayload)
    )
    const portfolioUnavailable = !dateRangeError && !portfolioPending && !portfolioData && !portfolioUsesMainData

    const paymentMonthPivot = useMemo(() => {
        if (!data?.payment_timing?.by_submit_month) return []
        const monthMap = {}
        data.payment_timing.by_submit_month.forEach((row) => {
            if (!monthMap[row.submit_month]) {
                monthMap[row.submit_month] = {
                    submit_month: row.submit_month,
                    submit_month_label: formatMonthLabel(row.submit_month),
                    lag_0: 0,
                    lag_1: 0,
                    lag_2: 0,
                    lag_3_plus: 0
                }
            }
            const lagKey = row.month_lag >= 3 ? 'lag_3_plus' : `lag_${row.month_lag}`
            monthMap[row.submit_month][lagKey] = (monthMap[row.submit_month][lagKey] || 0) + row.paid_amt
        })
        return Object.values(monthMap).sort((a, b) => a.submit_month.localeCompare(b.submit_month))
    }, [data])

    const paymentWomPivot = useMemo(() => {
        if (!data?.payment_timing?.by_submit_wom) return []
        const womMap = {}
        data.payment_timing.by_submit_wom.forEach((row) => {
            if (!womMap[row.submit_wom]) {
                womMap[row.submit_wom] = {
                    submit_wom: row.submit_wom,
                    lag_0: 0,
                    lag_1: 0,
                    lag_2: 0,
                    lag_3_plus: 0
                }
            }
            const lagKey = row.month_lag >= 3 ? 'lag_3_plus' : `lag_${row.month_lag}`
            womMap[row.submit_wom][lagKey] = (womMap[row.submit_wom][lagKey] || 0) + row.paid_amt
        })
        return Object.values(womMap).sort((a, b) => a.submit_wom - b.submit_wom)
    }, [data])

    const paymentByResponseWeek = useMemo(
        () => data?.payment_timing?.by_response_week || [],
        [data]
    )

    const rawWeekLagRows = data?.payment_timing?.by_submit_wom_week_lag || []
    const maxWeekLag = useMemo(() => {
        if (!rawWeekLagRows.length) return 0
        return rawWeekLagRows.reduce((maxValue, row) => Math.max(maxValue, Number(row.week_lag) || 0), 0)
    }, [rawWeekLagRows])

    useEffect(() => {
        if (!maxWeekLag) return
        const bounded = Math.max(2, Math.min(weekLagCap, maxWeekLag))
        if (bounded !== weekLagCap) {
            setWeekLagCap(bounded)
        }
    }, [maxWeekLag, weekLagCap])

    const paymentWeekLagPivot = useMemo(() => {
        if (!rawWeekLagRows.length) return []
        const womMap = {}
        rawWeekLagRows.forEach((row) => {
            if (!womMap[row.submit_wom]) {
                womMap[row.submit_wom] = { submit_wom: row.submit_wom }
            }
            const weekLag = Number(row.week_lag) || 0
            const bucket = weekLag >= weekLagCap ? `lag_${weekLagCap}_plus` : `lag_${weekLag}`
            womMap[row.submit_wom][bucket] = (womMap[row.submit_wom][bucket] || 0) + row.paid_amt
        })
        return Object.values(womMap).sort((a, b) => a.submit_wom - b.submit_wom)
    }, [rawWeekLagRows, weekLagCap])

    const weekLagBuckets = useMemo(() => {
        const buckets = new Set()
        rawWeekLagRows.forEach((row) => {
            const weekLag = Number(row.week_lag) || 0
            buckets.add(weekLag >= weekLagCap ? `lag_${weekLagCap}_plus` : `lag_${weekLag}`)
        })
        return Array.from(buckets).sort((left, right) => {
            const leftValue = left.endsWith('_plus') ? weekLagCap + 100 : Number(left.replace('lag_', ''))
            const rightValue = right.endsWith('_plus') ? weekLagCap + 100 : Number(right.replace('lag_', ''))
            return leftValue - rightValue
        })
    }, [rawWeekLagRows, weekLagCap])

    const weekLagCapOptions = useMemo(() => {
        const cappedMax = Math.max(2, Math.min(12, maxWeekLag || 2))
        return Array.from({ length: cappedMax - 1 }, (_, index) => index + 2)
    }, [maxWeekLag])

    const plannerOdds = useMemo(
        () => ({ nextMonthProb: getNextMonthProbability(data) }),
        [data]
    )

    const receiptPatternWithCumulative = useMemo(() => {
        const pattern = data?.response_receipt_pattern || []
        let cumulative = 0
        return pattern.map((item) => {
            cumulative += item.pct || 0
            return {
                ...item,
                cumulative_pct: cumulative
            }
        })
    }, [data])

    const simulatorPlannerBaseline = plannerData?.planner_baseline || data?.planner_baseline || PRA_MOCK.planner_baseline || {}
    const simulatorTimingCounts = plannerData?.timing_counts || data?.timing_counts || []
    const simulatorPayerPerformance = plannerData?.payer_performance || data?.payer_performance || {}
    const simulatorPlannerOdds = useMemo(
        () => ({ nextMonthProb: getNextMonthProbability(plannerData) || getNextMonthProbability(data) || 0.68 }),
        [plannerData, data]
    )
    const portfolioPlannerBaseline = portfolioData?.planner_baseline || {}
    const portfolioTimingCounts = portfolioData?.timing_counts || []
    const portfolioPlannerOdds = useMemo(
        () => ({ nextMonthProb: getNextMonthProbability(portfolioData) }),
        [portfolioData]
    )

    const reverseEstimate = useMemo(() => {
        const efficiency = simulatorPlannerBaseline.historical_efficiency || 0
        const velocity = simulatorPlannerOdds.nextMonthProb || 0
        if (!efficiency || !velocity || !grossChargesInput) return null
        return grossChargesInput * efficiency * velocity
    }, [simulatorPlannerBaseline, simulatorPlannerOdds, grossChargesInput])

    const requiredGrossCharges = useMemo(() => {
        const efficiency = simulatorPlannerBaseline.historical_efficiency || 0
        const velocity = simulatorPlannerOdds.nextMonthProb || 0
        if (!efficiency || !velocity || !targetCollection) return null
        return targetCollection / (efficiency * velocity)
    }, [simulatorPlannerBaseline, simulatorPlannerOdds, targetCollection])

    const plannerAllocationRows = useMemo(() => {
        const weights = plannerCadence === 'day'
            ? simulatorPlannerBaseline?.daily_weights || []
            : simulatorPlannerBaseline?.weekly_weights || []

        const totalGrossToAllocate = plannerMode === 'target'
            ? (requiredGrossCharges || 0)
            : grossChargesInput

        if (!weights.length || !totalGrossToAllocate) return []

        return weights.map((slot, index) => ({
            slot_key: plannerCadence === 'day' ? slot.label : `Week ${slot.week}`,
            slot_label: plannerCadence === 'day' ? slot.label : `Week ${slot.week}`,
            amount: totalGrossToAllocate * (Number(slot.weight) || 0),
            weight_pct: (Number(slot.weight) || 0) * 100,
            highlight: index === 0
        }))
    }, [plannerCadence, simulatorPlannerBaseline, plannerMode, requiredGrossCharges, grossChargesInput])

    const scenarioBands = useMemo(() => {
        const efficiency = simulatorPlannerBaseline.historical_efficiency || 0
        const velocity = simulatorPlannerOdds.nextMonthProb || 0
        if (!efficiency || !velocity || !targetCollection) return null
        return {
            optimistic: targetCollection / ((efficiency * 1.15) * velocity),
            base: targetCollection / (efficiency * velocity),
            pessimistic: targetCollection / ((efficiency * 0.85) * velocity),
        }
    }, [simulatorPlannerBaseline, simulatorPlannerOdds, targetCollection])

    const payerWiseSplit = useMemo(() => {
        const rows = (simulatorPayerPerformance.by_paid || [])
            .filter((r) => r.Payer_name !== UNKNOWN_PAYER && Number(r.paid_amt) > 0)
            .slice(0, 8)
        if (!rows.length || !targetCollection) return []
        const totalPaid = rows.reduce((sum, r) => sum + Number(r.paid_amt || 0), 0)
        const requiredGross = requiredGrossCharges || 0
        return rows.map((r) => ({
            name: truncateLabel(r.Payer_name, 26),
            full_name: r.Payer_name,
            pct: totalPaid > 0 ? Number(r.paid_amt) / totalPaid : 0,
            target_collections: totalPaid > 0 ? targetCollection * (Number(r.paid_amt) / totalPaid) : 0,
            required_gross: totalPaid > 0 && requiredGross ? requiredGross * (Number(r.paid_amt) / totalPaid) : 0,
        }))
    }, [simulatorPayerPerformance.by_paid, targetCollection, requiredGrossCharges])

    const plannerModeOptions = useMemo(
        () => [
            { value: 'target', label: 'Collections target', detail: 'Start from the cash goal you want to hit.' },
            { value: 'capacity', label: 'Gross charges plan', detail: 'Start from the submission volume you can push now.' }
        ],
        []
    )

    const plannerCadenceOptions = useMemo(
        () => [
            { value: 'week', label: 'Weekly', detail: 'Allocate volume by week-of-month.' },
            { value: 'day', label: 'Day-wise', detail: 'Allocate volume by historical business-day mix.' }
        ],
        []
    )
    const plannerViewOptions = useMemo(() => {
        const base = [
            { value: 'core', label: 'Core plan', detail: 'Main simulator and split.' },
            { value: 'timing', label: 'Timing', detail: 'Best submission window.' }
        ]

        if (plannerMode === 'target') {
            return [
                ...base,
                { value: 'scenario', label: 'Bands', detail: 'Efficiency sensitivity view.' },
                { value: 'payers', label: 'Payers', detail: 'Target split across payers.' }
            ]
        }

        return base
    }, [plannerMode])

    const plannerInputLabel = plannerMode === 'target'
        ? 'Desired next-month collections'
        : 'Gross charges available to submit'
    const plannerInputValue = plannerMode === 'target' ? targetCollectionInput : grossChargesInputText
    const plannerInputNumericValue = plannerMode === 'target' ? targetCollection : grossChargesInput
    const plannerResultLabel = plannerMode === 'target'
        ? 'Required gross charges to submit now'
        : 'Expected next-month collections'
    const plannerResultValue = plannerMode === 'target' ? requiredGrossCharges : reverseEstimate
    const plannerResultSubtext = plannerMode === 'target'
        ? `Based on the lag mix and paid-to-charged efficiency for ${plannerScopeNarrative}.`
        : `${formatCurrency(grossChargesInput)} gross charges × ${formatPercent(simulatorPlannerBaseline.historical_efficiency)} efficiency × ${formatPercent(simulatorPlannerOdds.nextMonthProb)} next-month cash share.`
    const plannerBreakdownTitle = `${plannerMode === 'target' ? 'Suggested' : 'Planned'} ${plannerCadence === 'day' ? 'day-wise' : 'weekly'} submission split`
    const plannerBreakdownDetail = plannerCadence === 'day'
        ? `Uses the historical Monday-to-Friday submit mix from ${plannerScopeNarrative}.`
        : `Uses the historical week-of-month submit mix from ${plannerScopeNarrative}.`

    useEffect(() => {
        if (!plannerViewOptions.some((option) => option.value === plannerView)) {
            setPlannerView('core')
        }
    }, [plannerView, plannerViewOptions])

    const submissionTimingRec = useMemo(
        () => getTimingRecommendation(simulatorTimingCounts),
        [simulatorTimingCounts]
    )
    const portfolioTimingRec = useMemo(
        () => getTimingRecommendation(portfolioTimingCounts),
        [portfolioTimingCounts]
    )
    const simulatorCashCaptureRate = useMemo(
        () => clamp((simulatorPlannerBaseline.historical_efficiency || 0) * (simulatorPlannerOdds.nextMonthProb || 0)),
        [simulatorPlannerBaseline.historical_efficiency, simulatorPlannerOdds.nextMonthProb]
    )
    const simulatorCaptureBand = useMemo(
        () => ({
            pessimistic: clamp(simulatorCashCaptureRate * 0.85),
            base: clamp(simulatorCashCaptureRate),
            optimistic: clamp(simulatorCashCaptureRate * 1.15)
        }),
        [simulatorCashCaptureRate]
    )
    const scenarioOutcomeBand = useMemo(() => {
        if (plannerMode === 'target') {
            if (!scenarioBands) return null
            return {
                title: 'Required gross band',
                detail: 'Range of gross charges needed at +/-15% efficiency.',
                optimistic: scenarioBands.optimistic,
                base: scenarioBands.base,
                pessimistic: scenarioBands.pessimistic
            }
        }

        if (!grossChargesInput || !simulatorCashCaptureRate) return null

        return {
            title: 'Expected cash band',
            detail: 'Cash outcome if realized efficiency shifts +/-15%.',
            optimistic: grossChargesInput * simulatorCaptureBand.optimistic,
            base: grossChargesInput * simulatorCaptureBand.base,
            pessimistic: grossChargesInput * simulatorCaptureBand.pessimistic
        }
    }, [grossChargesInput, plannerMode, scenarioBands, simulatorCaptureBand, simulatorCashCaptureRate])
    const wowImpactCards = useMemo(() => {
        const rangeLow = scenarioOutcomeBand
            ? Math.min(scenarioOutcomeBand.optimistic, scenarioOutcomeBand.base, scenarioOutcomeBand.pessimistic)
            : null
        const rangeHigh = scenarioOutcomeBand
            ? Math.max(scenarioOutcomeBand.optimistic, scenarioOutcomeBand.base, scenarioOutcomeBand.pessimistic)
            : null

        return [
            {
                eyebrow: plannerMode === 'target' ? 'Cash target' : 'Expected cash',
                value: plannerMode === 'target'
                    ? (targetCollection > 0 ? formatCurrency(targetCollection) : 'N/A')
                    : (reverseEstimate != null && grossChargesInput > 0 ? formatCurrency(reverseEstimate) : 'N/A'),
                label: plannerMode === 'target' ? 'Next-month collections goal' : 'Projected next-month collections',
                detail: plannerMode === 'target'
                    ? (requiredGrossCharges != null
                        ? `Base plan requires ${formatCurrency(requiredGrossCharges)} gross charges from ${plannerScopeNarrative}.`
                        : 'More scoped payment history is needed to size the required gross charges.')
                    : `${formatPercent(simulatorCashCaptureRate)} of submitted gross is expected to convert into next-month cash.`,
                accent: 'primary'
            },
            {
                eyebrow: 'Best timing window',
                value: submissionTimingRec ? `Week ${submissionTimingRec.best.submit_wom}` : 'N/A',
                label: submissionTimingRec
                    ? `${formatPercent(submissionTimingRec.best.same_month_pct)} same-month response`
                    : 'Waiting for timing history',
                detail: submissionTimingRec
                    ? `Urgent AR should avoid Week ${submissionTimingRec.worst.submit_wom}, which trails at ${formatPercent(submissionTimingRec.worst.same_month_pct)}.`
                    : 'Historical submission-week performance is needed to recommend a timing window.',
                accent: 'timing'
            },
            {
                eyebrow: scenarioOutcomeBand?.title || 'Scenario swing',
                value: rangeLow != null && rangeHigh != null
                    ? `${formatCurrency(rangeLow)} - ${formatCurrency(rangeHigh)}`
                    : 'N/A',
                label: plannerMode === 'target' ? 'Range to hit the target' : 'Forecast range at current volume',
                detail: scenarioOutcomeBand
                    ? `${scenarioOutcomeBand.detail} Base view: ${formatCurrency(scenarioOutcomeBand.base)}.`
                    : 'Scenario ranges appear once the simulator has enough efficiency and lag history.',
                accent: 'range'
            }
        ]
    }, [
        grossChargesInput,
        plannerMode,
        plannerScopeNarrative,
        requiredGrossCharges,
        reverseEstimate,
        scenarioOutcomeBand,
        simulatorCashCaptureRate,
        submissionTimingRec,
        targetCollection
    ])
    const wowDialItems = useMemo(() => {
        if (!scenarioOutcomeBand) return []

        return [
            {
                key: 'pessimistic',
                label: 'Pessimistic',
                rate: simulatorCaptureBand.pessimistic,
                value: scenarioOutcomeBand.pessimistic
            },
            {
                key: 'base',
                label: 'Base',
                rate: simulatorCaptureBand.base,
                value: scenarioOutcomeBand.base
            },
            {
                key: 'optimistic',
                label: 'Optimistic',
                rate: simulatorCaptureBand.optimistic,
                value: scenarioOutcomeBand.optimistic
            }
        ]
    }, [scenarioOutcomeBand, simulatorCaptureBand])
    const benchmarkInsights = useMemo(() => {
        if (plannerScopeResolvedPayer === 'All') {
            return {
                badge: 'Portfolio benchmark',
                tone: 'neutral',
                summary: `You are already viewing the all-payer benchmark for ${selectedClient} in the current date scope.`,
                rows: [
                    {
                        label: 'Historical efficiency',
                        value: formatPercent(portfolioPlannerBaseline.historical_efficiency),
                        detail: 'All-payer paid-to-charged baseline',
                        tone: 'neutral'
                    },
                    {
                        label: 'Next-month cash share',
                        value: formatPercent(portfolioPlannerOdds.nextMonthProb),
                        detail: 'Share of paid cash landing in month +1',
                        tone: 'neutral'
                    },
                    {
                        label: 'Best timing window',
                        value: portfolioTimingRec ? `Week ${portfolioTimingRec.best.submit_wom}` : 'N/A',
                        detail: portfolioTimingRec
                            ? `${formatPercent(portfolioTimingRec.best.same_month_pct)} same-month response at the portfolio level`
                            : 'Not enough history for a portfolio timing recommendation',
                        tone: 'neutral'
                    }
                ]
            }
        }

        if (!portfolioData) return null

        const efficiencyDelta = Number(simulatorPlannerBaseline.historical_efficiency || 0) - Number(portfolioPlannerBaseline.historical_efficiency || 0)
        const cashShareDelta = Number(simulatorPlannerOdds.nextMonthProb || 0) - Number(portfolioPlannerOdds.nextMonthProb || 0)
        const timingDelta = Number(submissionTimingRec?.best?.same_month_pct || 0) - Number(portfolioTimingRec?.best?.same_month_pct || 0)
        const score = efficiencyDelta + cashShareDelta + timingDelta
        const badge = score > 0.015 ? 'Ahead of portfolio' : score < -0.015 ? 'Behind portfolio' : 'Near portfolio'
        const tone = score > 0.015 ? 'positive' : score < -0.015 ? 'negative' : 'neutral'

        return {
            badge,
            tone,
            summary: `${plannerScopeLabel} versus all payers under the same client and submit-date filters.`,
            rows: [
                {
                    label: 'Historical efficiency',
                    value: formatSignedPercentPoints(efficiencyDelta),
                    detail: `${formatPercent(simulatorPlannerBaseline.historical_efficiency)} vs ${formatPercent(portfolioPlannerBaseline.historical_efficiency)}`,
                    tone: efficiencyDelta > 0.002 ? 'positive' : efficiencyDelta < -0.002 ? 'negative' : 'neutral'
                },
                {
                    label: 'Next-month cash share',
                    value: formatSignedPercentPoints(cashShareDelta),
                    detail: `${formatPercent(simulatorPlannerOdds.nextMonthProb)} vs ${formatPercent(portfolioPlannerOdds.nextMonthProb)}`,
                    tone: cashShareDelta > 0.002 ? 'positive' : cashShareDelta < -0.002 ? 'negative' : 'neutral'
                },
                {
                    label: 'Best-week edge',
                    value: formatSignedPercentPoints(timingDelta),
                    detail: submissionTimingRec && portfolioTimingRec
                        ? `Week ${submissionTimingRec.best.submit_wom} vs Week ${portfolioTimingRec.best.submit_wom}`
                        : 'Timing comparison needs more history',
                    tone: timingDelta > 0.002 ? 'positive' : timingDelta < -0.002 ? 'negative' : 'neutral'
                }
            ]
        }
    }, [
        plannerScopeLabel,
        plannerScopeResolvedPayer,
        portfolioData,
        portfolioPlannerBaseline.historical_efficiency,
        portfolioPlannerOdds.nextMonthProb,
        portfolioTimingRec,
        selectedClient,
        simulatorPlannerBaseline.historical_efficiency,
        simulatorPlannerOdds.nextMonthProb,
        submissionTimingRec
    ])

    const payerSummaryRows = useMemo(() => {
        if (payerPerformance.summary_table?.length) {
            return payerPerformance.summary_table.slice(0, 12)
        }

        return (payerPerformance.by_charged || [])
            .filter((row) => row.Payer_name !== UNKNOWN_PAYER)
            .slice(0, 12)
            .map((row) => ({
                ...row,
                collection_rate: isFiniteNumber(row.collection_rate)
                    ? row.collection_rate
                    : Number(row.charged_amt) > 0
                        ? Number(row.paid_amt || 0) / Number(row.charged_amt)
                        : null,
                denial_rate: isFiniteNumber(row.denial_rate) ? row.denial_rate : null,
                open_balance: isFiniteNumber(row.open_balance)
                    ? row.open_balance
                    : Number(row.charged_amt || 0) - Number(row.paid_amt || 0)
            }))
    }, [payerPerformance.summary_table, payerPerformance.by_charged])
    const responseDaysBySubmitWeek = useMemo(
        () => (data?.response_days_pattern?.by_submit_wom || []).map((row) => ({
            ...row,
            submit_wom_label: `Week ${row.submit_wom}`
        })),
        [data]
    )
    const collectionTrend = useMemo(
        () => (data?.collection_trend?.by_response_month || []).map((row) => ({
            ...row,
            resp_month_label: formatMonthLabel(row.resp_month)
        })),
        [data]
    )
    const fastestPayers = useMemo(
        () => (payerPerformance.by_speed || []).slice(0, 12).map((row) => ({
            ...row,
            short_name: truncateLabel(row.Payer_name, 22)
        })),
        [payerPerformance.by_speed]
    )
    const consistencyRows = useMemo(
        () => (payerPerformance.consistency || []).filter((row) => row.Payer_name !== UNKNOWN_PAYER).slice(0, 12).map((row) => ({
            ...row,
            short_name: truncateLabel(row.Payer_name, 16)
        })),
        [payerPerformance.consistency]
    )
    const chargedLeaderboard = useMemo(
        () => (payerPerformance.by_charged || []).filter((row) => row.Payer_name !== UNKNOWN_PAYER && Number(row.charged_amt) > 0).slice(0, 10),
        [payerPerformance.by_charged]
    )
    const paidLeaderboard = useMemo(
        () => (payerPerformance.by_paid || []).filter((row) => row.Payer_name !== UNKNOWN_PAYER && Number(row.paid_amt) > 0).slice(0, 10),
        [payerPerformance.by_paid]
    )
    const chargedChartRows = useMemo(
        () => chargedLeaderboard.map((row) => ({ ...row, short_name: truncateLabel(row.Payer_name, 22) })),
        [chargedLeaderboard]
    )
    const paidChartRows = useMemo(
        () => paidLeaderboard.map((row) => ({ ...row, short_name: truncateLabel(row.Payer_name, 22) })),
        [paidLeaderboard]
    )
    const denialChartRows = useMemo(() => {
        return [...payerSummaryRows]
            .filter((row) => row.Payer_name !== UNKNOWN_PAYER && isFiniteNumber(row.denial_rate) && Number(row.claims) > 10)
            .sort((a, b) => Number(b.denial_rate || 0) - Number(a.denial_rate || 0))
            .slice(0, 10)
            .map((row) => ({
                ...row,
                short_name: truncateLabel(row.Payer_name, 22),
                payment_rate: Math.max(0, 1 - Number(row.denial_rate || 0))
            }))
    }, [payerSummaryRows])
    const operatingMapRows = useMemo(
        () =>
            payerSummaryRows.map((row) => ({
                ...row,
                short_name: truncateLabel(row.Payer_name, 20),
                bubble_fill: getCollectionTone(row.collection_rate)
            })),
        [payerSummaryRows]
    )
    const lagBreakdownRows = useMemo(
        () =>
            timingCounts.map((row) => {
                const lagCounts = Object.fromEntries((row.breakdown || []).map((item) => [item.month_lag, item.count]))
                const lag3Plus = (row.breakdown || [])
                    .filter((item) => Number(item.month_lag) >= 3)
                    .reduce((sum, item) => sum + (Number(item.count) || 0), 0)

                return {
                    submit_wom: row.submit_wom,
                    lag_0: lagCounts[0] || 0,
                    lag_1: lagCounts[1] || 0,
                    lag_2: lagCounts[2] || 0,
                    lag_3_plus: lag3Plus
                }
            }),
        [timingCounts]
    )
    const responseTimingShareRows = useMemo(
        () =>
            timingCounts.map((row) => ({
                submit_wom: row.submit_wom,
                total_claims: Number(row.total) || 0,
                same_month_share: Number(row.total) ? Number(row.same_month || 0) / Number(row.total) : 0,
                later_share: Number(row.total) ? Number(row.later || 0) / Number(row.total) : 0
            })),
        [timingCounts]
    )
    const paymentByResponseWeekChart = useMemo(
        () =>
            paymentByResponseWeek.map((row) => ({
                ...row,
                resp_week_label: formatWeekTickLabel(row.resp_week)
            })),
        [paymentByResponseWeek]
    )
    const paymentMonthShareChart = useMemo(
        () => toShareRows(paymentMonthPivot, ['lag_0', 'lag_1', 'lag_2', 'lag_3_plus']),
        [paymentMonthPivot]
    )
    const paymentWomShareChart = useMemo(
        () => toShareRows(paymentWomPivot, ['lag_0', 'lag_1', 'lag_2', 'lag_3_plus']),
        [paymentWomPivot]
    )
    const paymentWeekLagChart = useMemo(
        () =>
            paymentWeekLagPivot.map((row) => {
                const normalized = { submit_wom: row.submit_wom }
                weekLagBuckets.forEach((bucket) => {
                    normalized[bucket] = Number(row[bucket]) || 0
                })
                return normalized
            }),
        [paymentWeekLagPivot, weekLagBuckets]
    )
    const paymentWeekLagShareChart = useMemo(
        () => toShareRows(paymentWeekLagChart, weekLagBuckets),
        [paymentWeekLagChart, weekLagBuckets]
    )
    const operatingGuides = useMemo(() => {
        if (!operatingMapRows.length) return { openBalance: null, avgDays: null }

        return {
            openBalance: operatingMapRows.reduce((sum, row) => sum + (Number(row.open_balance) || 0), 0) / operatingMapRows.length,
            avgDays: operatingMapRows.reduce((sum, row) => sum + (Number(row.avg_days) || 0), 0) / operatingMapRows.length
        }
    }, [operatingMapRows])

    const derivedCollectionRate = useMemo(() => {
        if (isFiniteNumber(kpis.collection_rate)) return Number(kpis.collection_rate)
        if (isFiniteNumber(kpis.total_charged) && Number(kpis.total_charged) > 0) {
            return Number(kpis.total_paid || 0) / Number(kpis.total_charged)
        }
        return null
    }, [kpis.collection_rate, kpis.total_charged, kpis.total_paid])

    const derivedSameMonthRate = useMemo(() => {
        if (isFiniteNumber(kpis.same_month_response_rate)) return Number(kpis.same_month_response_rate)
        const total = timingCounts.reduce((sum, row) => sum + (Number(row.total) || 0), 0)
        const sameMonth = timingCounts.reduce((sum, row) => sum + (Number(row.same_month) || 0), 0)
        return total > 0 ? sameMonth / total : null
    }, [kpis.same_month_response_rate, timingCounts])

    const derivedNextMonthCashShare = useMemo(() => {
        if (isFiniteNumber(kpis.next_month_cash_share)) return Number(kpis.next_month_cash_share)
        return plannerOdds.nextMonthProb || null
    }, [kpis.next_month_cash_share, plannerOdds.nextMonthProb])

    const metaCards = useMemo(() => {
        const cards = []
        const coverageStart = meta.filtered_coverage?.submit_start || meta.coverage?.submit_start || submitCoverageStart || PRA_MOCK.meta.filtered_coverage.submit_start
        const coverageEnd = meta.filtered_coverage?.submit_end || meta.coverage?.submit_end || submitCoverageEnd || PRA_MOCK.meta.filtered_coverage.submit_end

        if (coverageStart || coverageEnd) {
            cards.push({
                label: 'Client coverage',
                value: `${formatShortDate(coverageStart)} to ${formatShortDate(coverageEnd)}`,
                detail: 'Submit dates in current scope'
            })
        } else if (paymentMonthPivot.length) {
            cards.push({
                label: 'Billing coverage',
                value: `${paymentMonthPivot[0].submit_month_label} to ${paymentMonthPivot[paymentMonthPivot.length - 1].submit_month_label}`,
                detail: 'Based on available submit-month payment timing'
            })
        }

        if (meta.source_last_modified) {
            cards.push({
                label: 'Source file updated',
                value: formatDateTime(meta.source_last_modified),
                detail: meta.source_name || 'CSV source'
            })
        }

        if (meta.loaded_at || meta.filtered_records) {
            cards.push({
                label: 'Dashboard loaded',
                value: meta.loaded_at ? formatDateTime(meta.loaded_at) : `${formatNumber(meta.filtered_records || kpis.total_claims)} rows`,
                detail: `${formatNumber(meta.filtered_records || kpis.total_claims)} filtered records`
            })
        }

        if (isFiniteNumber(quality.missing_payer_pct) || isFiniteNumber(quality.known_payer_count)) {
            cards.push({
                label: 'Known payer coverage',
                value: isFiniteNumber(quality.missing_payer_pct) ? formatPercent(1 - Number(quality.missing_payer_pct)) : 'N/A',
                detail: isFiniteNumber(quality.known_payer_count) ? `${formatNumber(quality.known_payer_count)} distinct named payers` : 'Named payer count unavailable'
            })
        }

        return cards
    }, [meta.filtered_coverage, meta.coverage, meta.source_last_modified, meta.source_name, meta.loaded_at, meta.filtered_records, submitCoverageStart, submitCoverageEnd, paymentMonthPivot, kpis.total_claims, quality.missing_payer_pct, quality.known_payer_count])
    const fallbackMetaCards = [
        {
            label: 'Client coverage',
            value: `${formatShortDate(submitCoverageStart || PRA_MOCK.meta.filtered_coverage.submit_start)} to ${formatShortDate(submitCoverageEnd || PRA_MOCK.meta.filtered_coverage.submit_end)}`,
            detail: 'Submit dates in current scope'
        },
        {
            label: 'Dashboard loaded',
            value: meta.loaded_at ? formatDateTime(meta.loaded_at) : formatDateTime(new Date().toISOString()),
            detail: `${formatNumber(meta.filtered_records || kpis.total_claims || PRA_MOCK.kpis.total_claims)} filtered records`
        },
        {
            label: 'Known payer coverage',
            value: isFiniteNumber(quality.missing_payer_pct) ? formatPercent(1 - Number(quality.missing_payer_pct)) : '100.0%',
            detail: isFiniteNumber(quality.known_payer_count) ? `${formatNumber(quality.known_payer_count)} distinct named payers` : `${formatNumber(payerOptions.filter((option) => !option.is_unknown).length)} distinct named payers`
        }
    ]
    const visibleMetaCards = [
        ...metaCards,
        ...fallbackMetaCards.filter((fallback) => !metaCards.some((card) => card.label === fallback.label))
    ].slice(0, 4)

    const kpiCards = useMemo(() => {
        const cards = [
            {
                label: 'Total Claim Volume',
                value: formatNumber(kpis.total_claims),
                supporting: `${formatNumber(meta.total_records || kpis.total_claims)} total rows for ${meta.client || selectedClient}`
            },
            isFiniteNumber(kpis.avg_payment_days)
                ? {
                    label: 'Average Days to Pay',
                    value: formatDays(kpis.avg_payment_days),
                    supporting: 'Mean days from bill date to posted payment'
                }
                : null,
            isFiniteNumber(kpis.appeal_avg_response_days)
                ? {
                    label: 'Avg Days to Pay (Appeals)',
                    value: formatDays(kpis.appeal_avg_response_days),
                    supporting: `${formatNumber(kpis.appeal_response_count || 0)} appeal responses in current scope`,
                    highlight: true
                }
                : null,
            isFiniteNumber(kpis.first_time_avg_response_days)
                ? {
                    label: 'Avg Days to Pay (First-Pass)',
                    value: formatDays(kpis.first_time_avg_response_days),
                    supporting: `${formatNumber(kpis.first_time_response_count || 0)} first-pass responses in current scope`
                }
                : null,
            isFiniteNumber(kpis.median_response_days)
                ? {
                    label: 'Median Days to Pay',
                    value: formatDays(kpis.median_response_days),
                    supporting: 'Middle response day after sorting all rows'
                }
                : null,
            isFiniteNumber(kpis.p90_response_days)
                ? {
                    label: '90th Percentile (SLA Window)',
                    value: formatDays(kpis.p90_response_days),
                    supporting: 'Most claims respond within this many days'
                }
                : null,
            isFiniteNumber(kpis.total_charged)
                ? {
                    label: 'Total Charged Amount',
                    value: formatCurrency(kpis.total_charged),
                    supporting: 'Current filtered scope'
                }
                : null,
            isFiniteNumber(kpis.total_paid)
                ? {
                    label: 'Total Paid Amount',
                    value: formatCurrency(kpis.total_paid),
                    supporting: 'Posted payments in current scope'
                }
                : null,
            isFiniteNumber(derivedCollectionRate)
                ? {
                    label: 'Collection Rate',
                    value: formatPercent(derivedCollectionRate),
                    supporting: 'Paid amount divided by charged amount',
                    highlight: true
                }
                : null,
            isFiniteNumber(derivedSameMonthRate)
                ? {
                    label: 'Same-Month Adjudication %',
                    value: formatPercent(derivedSameMonthRate),
                    supporting: 'Claim share with a month lag of 0'
                }
                : null,
            isFiniteNumber(derivedNextMonthCashShare)
                ? {
                    label: 'Next-Month Cash Distribution %',
                    value: formatPercent(derivedNextMonthCashShare),
                    supporting: 'Paid dollars landing in lag month 1'
                }
                : null,
            isFiniteNumber(kpis.prediction_accuracy)
                ? {
                    label: 'AI Prediction Accuracy',
                    value: formatPercent(kpis.prediction_accuracy),
                    supporting: `${formatNumber(quality.prediction_rows)} rows with actual and predicted flags`
                }
                : null,
            isFiniteNumber(kpis.denial_rate)
                ? {
                    label: 'Overall Denial Rate',
                    value: formatPercent(kpis.denial_rate),
                    supporting: 'Share of filtered rows marked as denial'
                }
                : null
        ]

        return cards.filter((card) => card && !HIDDEN_PAYOR_RESPONSE_CARD_LABELS.has(card.label))
    }, [kpis, meta.total_records, meta.client, selectedClient, derivedCollectionRate, derivedSameMonthRate, derivedNextMonthCashShare, quality.prediction_rows])
    const fallbackKpiCards = [
        {
            label: 'Total Claim Volume',
            value: formatNumber(PRA_MOCK.kpis.total_claims),
            supporting: `Latest available total rows for ${meta.client || selectedClient}`
        },
        {
            label: 'Avg Days to Pay (Appeals)',
            value: formatDays(PRA_MOCK.kpis.appeal_avg_response_days),
            supporting: 'Average days for appeal response'
        },
        {
            label: 'Avg Days to Pay (First-Pass)',
            value: formatDays(PRA_MOCK.kpis.first_time_avg_response_days),
            supporting: 'Average days for first response'
        },
        {
            label: 'Median Days to Pay',
            value: formatDays(PRA_MOCK.kpis.median_response_days),
            supporting: 'Middle response day after sorting all rows'
        },
        {
            label: 'Collection Rate',
            value: formatPercent(PRA_MOCK.kpis.collection_rate),
            supporting: 'Paid amount divided by charged amount',
            highlight: true
        },
        {
            label: 'Same-Month Adjudication %',
            value: formatPercent(PRA_MOCK.kpis.same_month_response_rate),
            supporting: 'Share with response in the billed month'
        },
        {
            label: 'Next-Month Cash Distribution %',
            value: formatPercent(PRA_MOCK.kpis.next_month_cash_share),
            supporting: 'Paid dollars landing in lag month 1'
        }
    ]
    const visibleKpiCards = [
        ...kpiCards,
        ...fallbackKpiCards.filter((fallback) => !kpiCards.some((card) => card.label === fallback.label))
    ]

    const executiveSummary = useMemo(() => {
        const fastest = payerPerformance.by_speed?.[0]
        const slowest = payerPerformance.by_slowest?.[0]
        const largestPaid = (payerPerformance.by_paid || []).find((row) => row.Payer_name !== UNKNOWN_PAYER)
        const peakReceiptWeek = [...paymentByResponseWeek].sort((left, right) => (right.pct_of_total_paid || 0) - (left.pct_of_total_paid || 0))[0]

        return [
            fastest
                ? {
                    title: 'Top Performing Payer (Turnaround Time)',
                    value: fastest.Payer_name,
                    detail: `${Number(fastest.avg_days).toFixed(1)} average response days across ${formatNumber(fastest.claims)} claims`
                }
                : null,
            slowest
                ? {
                    title: 'Payer with Highest Adjudication Lag',
                    value: slowest.Payer_name,
                    detail: `${Number(slowest.avg_days).toFixed(1)} average response days across ${formatNumber(slowest.claims)} claims`
                }
                : null,
            largestPaid
                ? {
                    title: 'Lead Payer by Remittance Volume',
                    value: largestPaid.Payer_name,
                    detail: `${formatCurrency(largestPaid.paid_amt)} paid across ${formatNumber(largestPaid.claims)} claims`
                }
                : null,
            peakReceiptWeek
                ? {
                    title: 'Maximum Revenue Inflow Period',
                    value: formatWeekRangeLabel(peakReceiptWeek.resp_week),
                    detail: `${formatPercent(peakReceiptWeek.pct_of_total_paid)} of paid dollars landed in that week`
                }
                : null,
            quality.missing_payer_rows
                ? {
                    title: 'Unclassified Payer Variance',
                    value: `${formatNumber(quality.missing_payer_rows)} rows`,
                    detail: `${formatPercent(quality.missing_payer_charged_pct || 0)} of charged dollars and ${formatPercent(quality.missing_payer_paid_pct || 0)} of paid dollars`
                }
                : null
        ].filter(Boolean)
    }, [payerPerformance.by_paid, payerPerformance.by_slowest, payerPerformance.by_speed, paymentByResponseWeek, quality])
    const fallbackExecutiveSummary = [
        {
            title: 'Fastest Responding Payer',
            value: PRA_MOCK.payer_performance.by_speed?.[0]?.Payer_name || 'Aetna',
            detail: `${formatDays(PRA_MOCK.payer_performance.by_speed?.[0]?.avg_days)} average response time across current scope`
        },
        {
            title: 'Highest Cash Collection Week',
            value: formatWeekRangeLabel(PRA_MOCK.payment_timing.by_response_week?.[0]?.resp_week),
            detail: `${formatPercent(PRA_MOCK.payment_timing.by_response_week?.[0]?.pct_of_total_paid)} of paid dollars landed in that week`
        }
    ]
    const visibleExecutiveSummary = [
        ...executiveSummary,
        ...fallbackExecutiveSummary.filter((fallback) => !executiveSummary.some((item) => item.title === fallback.title))
    ].slice(0, 4)

    const chartSummaries = useMemo(() => {
        const summaries = {}

        if (responseDaysBySubmitWeek.length) {
            const fastestWeek = [...responseDaysBySubmitWeek].sort((left, right) => left.avg_days - right.avg_days)[0]
            const slowestWeek = [...responseDaysBySubmitWeek].sort((left, right) => right.avg_days - left.avg_days)[0]
            const medians = responseDaysBySubmitWeek.map((row) => Number(row.median_days)).filter(Number.isFinite)

            summaries.responseDays = [
                fastestWeek && slowestWeek
                    ? `${fastestWeek.submit_wom_label} is the quickest visible submission week at ${formatDays(fastestWeek.avg_days)}, while ${slowestWeek.submit_wom_label} is slowest at ${formatDays(slowestWeek.avg_days)}.`
                    : null,
                medians.length
                    ? `Median response time stays between ${formatDays(Math.min(...medians))} and ${formatDays(Math.max(...medians))} across the weeks shown.`
                    : null
            ]
        }

        if (collectionTrend.length) {
            const peakPaidMonth = [...collectionTrend].sort((left, right) => (right.paid_amt || 0) - (left.paid_amt || 0))[0]
            const bestRateMonth = [...collectionTrend]
                .filter((row) => isFiniteNumber(row.collect_rate))
                .sort((left, right) => (right.collect_rate || 0) - (left.collect_rate || 0))[0]

            summaries.collectionTrend = [
                peakPaidMonth ? `${peakPaidMonth.resp_month_label} has the highest paid dollars at ${formatCurrency(peakPaidMonth.paid_amt)}.` : null,
                bestRateMonth ? `${bestRateMonth.resp_month_label} shows the strongest collection rate at ${formatPercent(bestRateMonth.collect_rate)}.` : null
            ]
        }

        if (fastestPayers.length) {
            const first = fastestPayers[0]
            const last = fastestPayers[fastestPayers.length - 1]
            summaries.fastestPayers = [
                first ? `${first.Payer_name} is the fastest visible named payer at ${formatDays(first.avg_days)}.` : null,
                first && last ? `Across the ranked list shown, average response time ranges from ${formatDays(first.avg_days)} to ${formatDays(last.avg_days)}.` : null
            ]
        }

        if (consistencyRows.length) {
            const highestVolume = [...consistencyRows].sort((left, right) => (right.claims || 0) - (left.claims || 0))[0]
            const mostVariable = [...consistencyRows].sort((left, right) => (right.std_days || 0) - (left.std_days || 0))[0]
            summaries.consistency = [
                highestVolume ? `${highestVolume.Payer_name} has the highest visible claim volume at ${formatNumber(highestVolume.claims)} claims.` : null,
                mostVariable ? `${mostVariable.Payer_name} shows the widest response-time spread at ${formatDays(mostVariable.std_days)} standard deviation.` : null
            ]
        }

        if (chargedChartRows.length) {
            const top = chargedChartRows[0]
            const topThree = chargedChartRows.slice(0, 3).reduce((sum, row) => sum + (Number(row.charged_amt) || 0), 0)
            summaries.charged = [
                top ? `${top.Payer_name} is the highest billed named payer at ${formatCurrency(top.charged_amt)}.` : null,
                chargedChartRows.length >= 3 ? `The top 3 billed payers shown contribute ${formatCurrency(topThree)} in charged dollars.` : null
            ]
        }

        if (paidChartRows.length) {
            const top = paidChartRows[0]
            const topThree = paidChartRows.slice(0, 3).reduce((sum, row) => sum + (Number(row.paid_amt) || 0), 0)
            summaries.paid = [
                top ? `${top.Payer_name} is the highest paid named payer at ${formatCurrency(top.paid_amt)}.` : null,
                paidChartRows.length >= 3 ? `The top 3 paid payers shown account for ${formatCurrency(topThree)} in posted cash.` : null
            ]
        }

        if (timingCounts.length) {
            const bestSameMonth = [...timingCounts].sort((left, right) => (right.same_month_pct || 0) - (left.same_month_pct || 0))[0]
            const weakestSameMonth = [...timingCounts].sort((left, right) => (left.same_month_pct || 0) - (right.same_month_pct || 0))[0]
            summaries.responseTiming = [
                bestSameMonth ? `Week ${bestSameMonth.submit_wom} has the highest same-month response rate at ${formatPercent(bestSameMonth.same_month_pct)}.` : null,
                weakestSameMonth ? `Week ${weakestSameMonth.submit_wom} has the lowest same-month response rate at ${formatPercent(weakestSameMonth.same_month_pct)}.` : null
            ]
        }

        if (lagBreakdownRows.length) {
            const lag0Leads = lagBreakdownRows.filter((row) => (row.lag_0 || 0) >= (row.lag_1 || 0)).length
            const firstLagShift = lagBreakdownRows.find((row) => (row.lag_1 || 0) > (row.lag_0 || 0))
            summaries.lagBreakdown = [
                `Lag 0 remains the largest response bucket in ${lag0Leads} of ${lagBreakdownRows.length} submission weeks shown.`,
                firstLagShift
                    ? `Lag 1 first overtakes same-month responses in Week ${firstLagShift.submit_wom}.`
                    : 'Lag 1 never overtakes same-month responses in the weeks shown.'
            ]
        }

        if (paymentMonthPivot.length) {
            const totalLag0 = paymentMonthPivot.reduce((sum, row) => sum + (Number(row.lag_0) || 0), 0)
            const totalLag1 = paymentMonthPivot.reduce((sum, row) => sum + (Number(row.lag_1) || 0), 0)
            const totalCash = paymentMonthPivot.reduce(
                (sum, row) => sum + (Number(row.lag_0) || 0) + (Number(row.lag_1) || 0) + (Number(row.lag_2) || 0) + (Number(row.lag_3_plus) || 0),
                0
            )
            const strongestSameMonth = [...paymentMonthShareChart]
                .map((row) => ({
                    ...row,
                    later_share: (Number(row.lag_1) || 0) + (Number(row.lag_2) || 0) + (Number(row.lag_3_plus) || 0)
                }))
                .sort((left, right) => (right.lag_0 || 0) - (left.lag_0 || 0))[0]

            summaries.paymentMonth = [
                totalCash > 0 ? `${formatPercent(totalLag0 / totalCash)} of visible paid cash lands in the same submit month, with ${formatPercent(totalLag1 / totalCash)} landing in the next month.` : null,
                strongestSameMonth ? `${strongestSameMonth.submit_month_label} has the strongest same-month realization mix at ${formatPercent(strongestSameMonth.lag_0)}.` : null
            ]
        }

        if (receiptPatternWithCumulative.length) {
            const peakWeek = [...receiptPatternWithCumulative].sort((left, right) => (right.pct || 0) - (left.pct || 0))[0]
            const lastWeek = receiptPatternWithCumulative[receiptPatternWithCumulative.length - 1]
            summaries.receiptPattern = [
                peakWeek ? `Week ${peakWeek.resp_wom} is the largest response-arrival week at ${formatPercent(peakWeek.pct)}.` : null,
                lastWeek ? `By Week ${lastWeek.resp_wom}, cumulative response arrivals reach ${formatPercent(lastWeek.cumulative_pct)}.` : null
            ]
        }

        if (paymentWomShareChart.length) {
            const highestLag0Week = [...paymentWomShareChart].sort((left, right) => (right.lag_0 || 0) - (left.lag_0 || 0))[0]
            const highestLag1Week = [...paymentWomShareChart].sort((left, right) => (right.lag_1 || 0) - (left.lag_1 || 0))[0]
            summaries.paymentWom = [
                highestLag0Week ? `Same-month cash share is strongest for Week ${highestLag0Week.submit_wom} submissions at ${formatPercent(highestLag0Week.lag_0)}.` : null,
                highestLag1Week ? `Next-month cash share is heaviest for Week ${highestLag1Week.submit_wom} submissions at ${formatPercent(highestLag1Week.lag_1)}.` : null
            ]
        }

        if (operatingMapRows.length) {
            const largestOpenBalance = [...operatingMapRows].sort((left, right) => (right.open_balance || 0) - (left.open_balance || 0))[0]
            const highestPriority = [...operatingMapRows]
                .map((row) => ({
                    ...row,
                    priority_score: (Number(row.open_balance) || 0) * (Number(row.avg_days) || 0)
                }))
                .sort((left, right) => (right.priority_score || 0) - (left.priority_score || 0))[0]

            summaries.operatingMap = [
                largestOpenBalance ? `${largestOpenBalance.Payer_name} carries the largest visible open balance at ${formatCurrency(largestOpenBalance.open_balance)}.` : null,
                highestPriority ? `${highestPriority.Payer_name} is the strongest operating-priority candidate when open balance and response delay are viewed together.` : null
            ]
        }

        if (paymentByResponseWeekChart.length) {
            const peakWeek = [...paymentByResponseWeekChart].sort((left, right) => (right.pct_of_total_paid || 0) - (left.pct_of_total_paid || 0))[0]
            const topThree = paymentByResponseWeekChart
                .slice()
                .sort((left, right) => (right.pct_of_total_paid || 0) - (left.pct_of_total_paid || 0))
                .slice(0, 3)
                .reduce((sum, row) => sum + (Number(row.pct_of_total_paid) || 0), 0)
            summaries.responseWeekCash = [
                peakWeek ? `${formatWeekRangeLabel(peakWeek.resp_week)} is the peak paid-cash week at ${formatPercent(peakWeek.pct_of_total_paid)} of visible paid dollars.` : null,
                topThree > 0 ? `The top 3 response weeks shown account for ${formatPercent(topThree)} of visible paid cash.` : null
            ]
        }

        if (paymentWeekLagChart.length && weekLagBuckets.length) {
            const totalVisiblePaid = paymentWeekLagChart.reduce(
                (sum, row) => sum + weekLagBuckets.reduce((bucketSum, bucket) => bucketSum + (Number(row[bucket]) || 0), 0),
                0
            )
            const totalsByBucket = weekLagBuckets.map((bucket) => ({
                bucket,
                share: totalVisiblePaid > 0
                    ? paymentWeekLagChart.reduce((sum, row) => sum + (Number(row[bucket]) || 0), 0) / totalVisiblePaid
                    : 0
            }))
            const dominantBucket = totalsByBucket.sort((left, right) => right.share - left.share)[0]
            const highestDelayedWeek = [...paymentWeekLagShareChart]
                .map((row) => ({
                    ...row,
                    delayed_share: weekLagBuckets
                        .filter((bucket) => bucket !== 'lag_0')
                        .reduce((sum, bucket) => sum + (Number(row[bucket]) || 0), 0)
                }))
                .sort((left, right) => (right.delayed_share || 0) - (left.delayed_share || 0))[0]

            summaries.weekLag = [
                dominantBucket
                    ? `The largest visible payment-lag bucket is ${dominantBucket.bucket.endsWith('_plus') ? `${weekLagCap}+ weeks` : `${dominantBucket.bucket.replace('lag_', '')} weeks`} at ${formatPercent(dominantBucket.share)} of visible paid cash.`
                    : null,
                highestDelayedWeek ? `Week ${highestDelayedWeek.submit_wom} submissions show the highest delayed-cash mix at ${formatPercent(highestDelayedWeek.delayed_share)} beyond the same week.` : null
            ]
        }

        if (timingCounts.length) {
            const best = [...timingCounts].sort((left, right) => (right.same_month_pct || 0) - (left.same_month_pct || 0))[0]
            const worst = [...timingCounts].sort((left, right) => (left.same_month_pct || 0) - (right.same_month_pct || 0))[0]
            summaries.sameMonthRate = [
                best ? `Week ${best.submit_wom} has the highest same-month resolution rate at ${formatPercent(best.same_month_pct)}.` : null,
                worst ? `Week ${worst.submit_wom} drops to ${formatPercent(worst.same_month_pct)}, which is the weakest same-month performance in the visible scope.` : null
            ]
        }

        if (plannerAllocationRows.length) {
            const topSlot = [...plannerAllocationRows].sort((left, right) => (right.amount || 0) - (left.amount || 0))[0]
            const totalSuggested = plannerAllocationRows.reduce((sum, row) => sum + (Number(row.amount) || 0), 0)
            const cadenceLabel = plannerCadence === 'day' ? 'day-wise' : 'weekly'
            summaries.planner = [
                topSlot ? `${topSlot.slot_label} gets the largest suggested ${cadenceLabel} submission share at ${formatCurrency(topSlot.amount)}.` : null,
                totalSuggested > 0 ? `The suggested ${cadenceLabel} split covers ${formatCurrency(totalSuggested)} in gross charges across the selected plan.` : null
            ]
        }

        return summaries
    }, [
        collectionTrend,
        consistencyRows,
        chargedChartRows,
        fastestPayers,
        lagBreakdownRows,
        paymentByResponseWeek,
        paymentByResponseWeekChart,
        paymentMonthPivot,
        paymentMonthShareChart,
        paymentWeekLagChart,
        paymentWeekLagShareChart,
        paymentWomPivot,
        paymentWomShareChart,
        receiptPatternWithCumulative,
        responseDaysBySubmitWeek,
        operatingMapRows,
        plannerAllocationRows,
        plannerCadence,
        timingCounts,
        weekLagBuckets,
        weekLagCap,
        paidChartRows
    ])

    const missingPayerSeverity = quality.missing_payer_pct >= 0.5 ? 'danger' : quality.missing_payer_pct >= 0.2 ? 'warning' : 'info'
    const showingFilteredScope = selectedPayer !== 'All'

    const tooltipFormatter = (value, name) => {
        if (name && /rate|pct|accuracy|prob|share|readiness/i.test(name)) return formatPercent(value)
        if (name && /charged|paid|balance|amount|cash/i.test(name)) return formatCurrency(value)
        if (name && /day|spread/i.test(name)) return `${Number(value).toFixed(1)} days`
        return formatNumber(value)
    }

    const hasRenderableMetrics = (rows, metricKeys = []) => {
        if (!rows || rows.length === 0) return false
        if (!metricKeys.length) return true

        return rows.some((row) =>
            metricKeys.some((key) => {
                const value = typeof key === 'function' ? key(row) : row?.[key]
                return Number.isFinite(Number(value)) && Number(value) > 0
            })
        )
    }

    const renderChart = (rows, chart, { metricKeys = [], emptySummary, emptyReason, requiredFields = [] } = {}) => {
        if (!hasRenderableMetrics(rows, metricKeys)) {
            return (
                <MissingDataNotice
                    summary={emptySummary || 'Unavailable for the current payload'}
                    reason={emptyReason || 'This chart needs additional aggregated fields from the payer response API before it can render.'}
                    requiredFields={requiredFields}
                />
            )
        }
        return chart
    }

    if (loading && !data) {
        return (
            <div className={`pra-container ${embedded ? 'embedded' : ''}`}>
                <div className="pra-loading">
                    <div className="loading-spinner"></div>
                    <p>Loading payer response analytics...</p>
                </div>
            </div>
        )
    }

    if (error && !data) {
        return (
            <div className={`pra-container ${embedded ? 'embedded' : ''}`}>
                <div className="pra-error">
                    <strong>Unable to load payer response analytics.</strong>
                    <span>{error}</span>
                    <button type="button" className="pra-refresh-btn" onClick={() => fetchAnalytics({ refresh: true })}>
                        Retry
                    </button>
                </div>
            </div>
        )
    }

    return (
        <div className={`pra-container ${embedded ? 'embedded' : ''}`} data-ui-release={PRA_UI_RELEASE}>
            <div className="pra-header-row">
                <div>
                    <h2>Payer Response Analytics</h2>
                    <p className="pra-subtitle">
                        Operational payer response, cash timing, and data quality signals for the active client scope.
                        {data && (
                            <span style={{ marginLeft: '12px', fontSize: '12px', color: '#10b981', fontWeight: 500, letterSpacing: '0.02em' }}>
                                • Live Mode Refreshed: {new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZoneName: 'short' })}
                            </span>
                        )}
                    </p>
                </div>
                <div className="pra-header-actions">
                    {showingFilteredScope ? (
                        <div className="pra-scope-chip">
                            Scoped to <strong>{selectedPayerOption?.label || selectedPayer}</strong>
                        </div>
                    ) : null}
                    <button
                        type="button"
                        className="pra-refresh-btn"
                        onClick={() => fetchAnalytics({ refresh: true })}
                        disabled={refreshing}
                    >
                        {refreshing ? 'Refreshing...' : 'Refresh'}
                    </button>
                </div>
            </div>

            {error ? (
                <div className="pra-inline-warning">
                    <strong>Using latest available payer analytics.</strong>
                    <span>{error ? `${error}. ` : ''}Controls and KPI layout remain available while the live source refreshes.</span>
                </div>
            ) : null}

            <div className="pra-controls-panel">
                <div className="pra-filter-stage-head">
                    <div>
                        <span className="pra-filter-eyebrow">Refine view</span>
                        <h3>Filters</h3>
                    </div>
                    <div className="pra-controls-summary">
                        <div className="pra-filter-chip">{formatNumber(visiblePayerOptions.length)} of {formatNumber(payerOptions.length)} payer options shown</div>
                        {submitCoverageStart || submitCoverageEnd ? (
                            <div className="pra-filter-chip">
                                Coverage: {formatShortDate(submitCoverageStart)} to {formatShortDate(submitCoverageEnd)}
                            </div>
                        ) : null}
                        <div className="pra-filter-chip">{includeUnknownRankings ? 'Unknown bucket included' : 'Named payer rankings only'}</div>
                    </div>
                </div>

                <div className="pra-filter-toolbar">
                    <div className="pra-client-stage">
                        <span className="pra-control-label">Client</span>
                        <div className="pra-client-switch">
                            {clientCatalog.map((client) => (
                                <button
                                    key={client.client}
                                    type="button"
                                    className={selectedClient === client.client ? 'active' : ''}
                                    onClick={() => {
                                        if (!client.available) return
                                        setSelectedClient(client.client)
                                        setSelectedPayer('All')
                                        setPayerSearch('')
                                    }}
                                    disabled={!client.available}
                                    title={client.available ? `${client.client} payer data` : `${client.client} source not available yet`}
                                >
                                    <span>{client.label || client.client}</span>
                                    {!client.available ? <small>Coming soon</small> : null}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="pra-filter-grid">
                        <div className="pra-filter-card pra-filter-card-search">
                            <label htmlFor="pra-payer-search" className="pra-control-label">Payer search</label>
                            <input
                                id="pra-payer-search"
                                type="search"
                                className="pra-search-input"
                                placeholder="Search payer names"
                                value={payerSearch}
                                onChange={(event) => setPayerSearch(event.target.value)}
                            />
                        </div>

                        <div className="pra-filter-card">
                            <label htmlFor="pra-payer-select" className="pra-control-label">Payer scope</label>
                            <select
                                id="pra-payer-select"
                                value={selectedPayer}
                                className="pra-select"
                                onChange={(event) => setSelectedPayer(event.target.value)}
                            >
                                <option value="All">All payers</option>
                                {visiblePayerOptions.map((option) => (
                                    <option key={option.value} value={option.value}>
                                        {option.label} ({formatNumber(option.claims)} claims)
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="pra-filter-card pra-filter-card-range">
                            <label htmlFor="pra-submit-start" className="pra-control-label">Submit date range</label>
                            <div className="pra-date-range-row">
                                <input
                                    id="pra-submit-start"
                                    type="date"
                                    className="pra-input-field pra-input-date"
                                    aria-label="Submit date from"
                                    value={submitStart}
                                    min={submitCoverageStart || undefined}
                                    max={submitEnd || submitCoverageEnd || undefined}
                                    onChange={(event) => setSubmitStart(event.target.value)}
                                />
                                <span className="pra-date-range-separator">to</span>
                                <input
                                    id="pra-submit-end"
                                    type="date"
                                    className="pra-input-field pra-input-date"
                                    aria-label="Submit date to"
                                    value={submitEnd}
                                    min={submitStart || submitCoverageStart || undefined}
                                    max={submitCoverageEnd || undefined}
                                    onChange={(event) => setSubmitEnd(event.target.value)}
                                />
                            </div>
                            <span className="pra-control-hint">Uses submission date coverage.</span>
                        </div>

                        <div className="pra-filter-card pra-filter-card-toggle">
                            <label className={`pra-toggle-card ${selectedPayer !== 'All' ? 'disabled' : ''}`}>
                                <input
                                    type="checkbox"
                                    checked={includeUnknownRankings}
                                    disabled={selectedPayer !== 'All'}
                                    onChange={(event) => setIncludeUnknownRankings(event.target.checked)}
                                />
                                <div>
                                    <strong>Include missing payer bucket</strong>
                                    <span>Payer leaderboards only.</span>
                                </div>
                            </label>
                        </div>
                    </div>
                </div>

                <div className="pra-filter-footer">
                    <div className="pra-active-filters">
                        {hasActiveFilters ? (
                            activeFilterChips.map((chip) => (
                                <div key={chip} className="pra-filter-chip active">{chip}</div>
                            ))
                        ) : (
                            <div className="pra-filter-chip subtle">No additional filters applied</div>
                        )}
                    </div>

                    <div className="pra-control-actions">
                        {hasActiveFilters || payerSearch ? (
                            <button
                                type="button"
                                className="pra-secondary-btn"
                                onClick={() => {
                                    setSelectedPayer('All')
                                    setPayerSearch('')
                                    setSubmitStart('')
                                    setSubmitEnd('')
                                    setIncludeUnknownRankings(false)
                                }}
                            >
                                Clear filters
                            </button>
                        ) : null}
                    </div>
                </div>

                {dateRangeError ? (
                    <div className="pra-inline-error">
                        {dateRangeError}
                    </div>
                ) : null}
            </div>

            {error ? (
                <div className="pra-inline-error">
                    Showing the latest loaded data. Refresh failed: {error}
                </div>
            ) : null}

            {visibleMetaCards.length ? (
                <div className="pra-meta-grid">
                    {visibleMetaCards.map((card) => (
                        <div key={card.label} className="pra-meta-card">
                            <span className="pra-meta-label">{card.label}</span>
                            <strong>{card.value}</strong>
                            <small>{card.detail}</small>
                        </div>
                    ))}
                </div>
            ) : null}

            {isFiniteNumber(quality.missing_payer_rows) || isFiniteNumber(quality.missing_payer_pct) ? (
                <div className={`pra-callout ${missingPayerSeverity}`}>
                    <strong>Data quality</strong>
                    <p>
                        {isFiniteNumber(quality.missing_payer_pct) ? formatPercent(quality.missing_payer_pct) : formatNumber(quality.missing_payer_rows)} of records have no payer name.
                        {selectedPayer === 'All' && !includeUnknownRankings
                            ? ' Leaderboards exclude those rows by default so rankings stay interpretable.'
                            : ' Those rows are included in the current scope.'}
                    </p>
                    <div className="pra-callout-metrics">
                        <span>Missing payer rows: {formatNumber(quality.missing_payer_rows)}</span>
                        <span>Charged dollars in missing bucket: {formatPercent(quality.missing_payer_charged_pct || 0)}</span>
                        <span>Paid dollars in missing bucket: {formatPercent(quality.missing_payer_paid_pct || 0)}</span>
                        {isFiniteNumber(quality.payment_flag_zero_paid_rows) ? (
                            <span>Payment-flag rows with $0 paid: {formatNumber(quality.payment_flag_zero_paid_rows)}</span>
                        ) : null}
                    </div>
                </div>
            ) : null}

            {meta.notes?.length ? (
                <div className="pra-notes-row">
                    {meta.notes.map((note) => (
                        <div key={note} className="pra-note-chip">{note}</div>
                    ))}
                </div>
            ) : null}

            {visibleExecutiveSummary.length ? (
                <div className="pra-summary-grid">
                    {visibleExecutiveSummary.map((item) => (
                        <SummaryCard key={item.title} title={item.title} value={item.value} detail={item.detail} />
                    ))}
                </div>
            ) : null}

            {visibleKpiCards.length ? (
                <div className="pra-kpi-grid">
                    {visibleKpiCards.map((card) => (
                        <StatCard
                            key={card.label}
                            label={card.label}
                            value={card.value}
                            supporting={card.supporting}
                            highlight={card.highlight}
                        />
                    ))}
                </div>
            ) : null}

            <div className="pra-section-grid pra-section-grid-feature">
                <div className="pra-chart-box pra-span-7">
                    <div className="pra-section-head">
                        <div>
                            <h3>Response days by submission week</h3>
                            <p>Average and median response days by the week-of-month in which claims were submitted.</p>
                        </div>
                    </div>
                    {renderChart(
                        responseDaysBySubmitWeek,
                        <div className="pra-chart-wrapper hero">
                            <ResponsiveContainer width="100%" height="100%">
                                <ComposedChart data={responseDaysBySubmitWeek} margin={{ top: 16, right: 18, bottom: 12, left: 8 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke={COLORS.grid} vertical={false} />
                                    <XAxis dataKey="submit_wom_label" stroke={COLORS.text} tick={{ fontSize: 11 }} />
                                    <YAxis yAxisId="left" stroke={COLORS.text} tick={{ fontSize: 11 }} />
                                    <YAxis yAxisId="right" orientation="right" stroke={GRAPH_COLORS.responseDays.avg} tick={{ fontSize: 11 }} />
                                    <Tooltip content={<CustomTooltip formatter={tooltipFormatter} />} />
                                    <Legend />
                                    <Bar yAxisId="left" dataKey="claims" name="Claims" fill={GRAPH_COLORS.responseDays.claimsFill} radius={[8, 8, 0, 0]} />
                                    <Line yAxisId="right" type="monotone" dataKey="avg_days" name="Average Days" stroke={GRAPH_COLORS.responseDays.avg} strokeWidth={3} />
                                    <Line yAxisId="right" type="monotone" dataKey="median_days" name="Median Days" stroke={GRAPH_COLORS.responseDays.median} strokeWidth={3} />
                                </ComposedChart>
                            </ResponsiveContainer>
                        </div>,
                        {
                            metricKeys: ['claims', 'avg_days', 'median_days'],
                            emptySummary: 'Response-day trend unavailable in current API payload',
                            emptyReason: 'This view needs response-day aggregates by submission week. The live payload currently only includes timing counts by month lag, not average or median response days by week.',
                            requiredFields: ['response_days_pattern.by_submit_wom[].claims', 'response_days_pattern.by_submit_wom[].avg_days', 'response_days_pattern.by_submit_wom[].median_days']
                        }
                    )}
                    <ChartSummary items={chartSummaries.responseDays} />
                </div>

            </div>

            <div className="pra-section-grid">
                <div className="pra-chart-box pra-span-5">
                    <div className="pra-section-head">
                        <div>
                            <h3>Fastest named payers</h3>
                            <p>Average response days for payer groups with at least 50 claims.</p>
                        </div>
                    </div>
                    {renderChart(
                        fastestPayers,
                        <div className="pra-chart-wrapper tall">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart
                                    data={fastestPayers}
                                    layout="vertical"
                                    margin={{ top: 8, right: 24, left: 128, bottom: 8 }}
                                >
                                    <CartesianGrid strokeDasharray="3 3" stroke={COLORS.grid} horizontal={false} />
                                    <XAxis
                                        type="number"
                                        stroke={COLORS.text}
                                        tick={{ fontSize: 11 }}
                                        tickFormatter={(value) => `${Number(value).toFixed(0)}d`}
                                    />
                                    <YAxis
                                        type="category"
                                        dataKey="short_name"
                                        stroke={COLORS.text}
                                        width={108}
                                        tick={{ fontSize: 11 }}
                                        interval={0}
                                    />
                                    <Tooltip
                                        content={
                                            <CustomTooltip
                                                formatter={tooltipFormatter}
                                                labelFormatter={(_, payload) => payload?.[0]?.payload?.Payer_name || _}
                                            />
                                        }
                                    />
                                    <Bar dataKey="avg_days" name="Avg Response Days" radius={[0, 6, 6, 0]}>
                                        {fastestPayers.map((row, index) => (
                                            <Cell key={`${row.Payer_name}-speed`} fill={index < 3 ? GRAPH_COLORS.section1.speedTop : GRAPH_COLORS.section1.speedRest} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    , { metricKeys: ['avg_days'] })}
                    <ChartSummary items={chartSummaries.fastestPayers} />
                </div>

                <div className="pra-chart-box pra-span-7">
                    <div className="pra-section-head">
                        <div>
                            <h3>Volume vs variability</h3>
                            <p>Claim volume against response-time spread for the largest named payer groups.</p>
                        </div>
                    </div>
                    {renderChart(
                        consistencyRows,
                        <div className="pra-chart-wrapper">
                            <ResponsiveContainer width="100%" height="100%">
                                <ComposedChart data={consistencyRows} margin={{ top: 16, right: 18, bottom: 56, left: 12 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke={COLORS.grid} vertical={false} />
                                    <XAxis
                                        dataKey="short_name"
                                        stroke={COLORS.text}
                                        tick={<WrappedAxisTick />}
                                        height={52}
                                        interval={0}
                                    />
                                    <YAxis yAxisId="left" stroke={COLORS.text} tick={{ fontSize: 11 }} />
                                    <YAxis yAxisId="right" orientation="right" stroke={GRAPH_COLORS.section1.variability} tick={{ fontSize: 11 }} />
                                    <Tooltip
                                        content={
                                            <CustomTooltip
                                                formatter={tooltipFormatter}
                                                labelFormatter={(_, payload) => payload?.[0]?.payload?.Payer_name || _}
                                            />
                                        }
                                    />
                                    <Legend />
                                    <Bar yAxisId="left" dataKey="claims" name="Claims" fill={GRAPH_COLORS.section1.volume} radius={[6, 6, 0, 0]} />
                                    <Line yAxisId="right" type="monotone" dataKey="std_days" name="Std Dev (Days)" stroke={GRAPH_COLORS.section1.variability} strokeWidth={3} dot={{ r: 3, fill: GRAPH_COLORS.section1.variability }} />
                                </ComposedChart>
                            </ResponsiveContainer>
                        </div>
                    , { metricKeys: ['claims', 'std_days'] })}
                    <ChartSummary items={chartSummaries.consistency} />
                </div>
            </div>

            <div className="pra-section-grid pra-section-grid-duo">
                <div className="pra-chart-box pra-span-6">
                    <div className="pra-section-head">
                        <div>
                            <h3>Charged dollars by payer</h3>
                            <p>Largest named payer buckets by billed volume. Unknown payer rows are tracked separately below.</p>
                        </div>
                    </div>
                    {renderChart(
                        chargedChartRows,
                        <div className="pra-chart-wrapper tall">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={chargedChartRows} layout="vertical" margin={{ top: 8, right: 24, left: 120, bottom: 8 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke={COLORS.grid} horizontal={false} />
                                    <XAxis type="number" stroke={COLORS.text} tickFormatter={formatCurrencyCompact} tick={{ fontSize: 11 }} />
                                    <YAxis type="category" dataKey="short_name" stroke={COLORS.text} width={102} tick={{ fontSize: 11 }} interval={0} />
                                    <Tooltip
                                        content={
                                            <CustomTooltip
                                                formatter={tooltipFormatter}
                                                labelFormatter={(_, payload) => payload?.[0]?.payload?.Payer_name || _}
                                            />
                                        }
                                    />
                                    <Bar dataKey="charged_amt" name="Charged Amount" fill={GRAPH_COLORS.charged} radius={[0, 6, 6, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>,
                        {
                            metricKeys: ['charged_amt'],
                            emptySummary: 'Charged-by-payer chart unavailable',
                            emptyReason: 'We need named payer rows with charged amounts to rank billed dollars clearly.',
                            requiredFields: ['payer_performance.by_charged[].Payer_name', 'payer_performance.by_charged[].charged_amt']
                        }
                    )}
                    <ChartSummary items={chartSummaries.charged} />
                </div>

                <div className="pra-chart-box pra-span-6">
                    <div className="pra-section-head">
                        <div>
                            <h3>Paid dollars by payer</h3>
                            <p>Largest named payer buckets by posted paid amount. Unknown payer rows are tracked separately below.</p>
                        </div>
                    </div>
                    {renderChart(
                        paidChartRows,
                        <div className="pra-chart-wrapper tall">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={paidChartRows} layout="vertical" margin={{ top: 8, right: 24, left: 120, bottom: 8 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke={COLORS.grid} horizontal={false} />
                                    <XAxis type="number" stroke={COLORS.text} tickFormatter={formatCurrencyCompact} tick={{ fontSize: 11 }} />
                                    <YAxis type="category" dataKey="short_name" stroke={COLORS.text} width={102} tick={{ fontSize: 11 }} interval={0} />
                                    <Tooltip
                                        content={
                                            <CustomTooltip
                                                formatter={tooltipFormatter}
                                                labelFormatter={(_, payload) => payload?.[0]?.payload?.Payer_name || _}
                                            />
                                        }
                                    />
                                    <Bar dataKey="paid_amt" name="Paid Amount" fill={GRAPH_COLORS.paid} radius={[0, 6, 6, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>,
                        {
                            metricKeys: ['paid_amt'],
                            emptySummary: 'Paid-by-payer chart unavailable',
                            emptyReason: 'We need named payer rows with paid amounts to show posted dollars by payer.',
                            requiredFields: ['payer_performance.by_paid[].Payer_name', 'payer_performance.by_paid[].paid_amt']
                        }
                    )}
                    <ChartSummary items={chartSummaries.paid} />
                </div>
            </div>

            <div className="pra-section-grid">
                <div className="pra-chart-box pra-span-12">
                    <div className="pra-section-head">
                        <div>
                            <h3>Denial rate by payer</h3>
                            <p>Highest denial rates among named payers (with at least 10 claims).</p>
                        </div>
                    </div>
                    {renderChart(
                        denialChartRows,
                        <div className="pra-chart-wrapper tall">
                            <ResponsiveContainer width="100%" height={280}>
                                <BarChart data={denialChartRows} layout="vertical" margin={{ top: 8, right: 24, left: 120, bottom: 8 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke={COLORS.grid} horizontal={false} />
                                    <XAxis type="number" stroke={COLORS.text} domain={[0, 1]} tickFormatter={formatPercent} tick={{ fontSize: 11 }} />
                                    <YAxis type="category" dataKey="short_name" stroke={COLORS.text} width={102} tick={{ fontSize: 11 }} interval={0} />
                                    <Tooltip
                                        content={
                                            <CustomTooltip
                                                formatter={formatPercent}
                                                labelFormatter={(_, payload) => payload?.[0]?.payload?.Payer_name || _}
                                            />
                                        }
                                    />
                                    <Legend />
                                    <Bar dataKey="denial_rate" name="Denial Rate" stackId="a" fill={COLORS.accent3} radius={[0, 0, 0, 0]} />
                                    <Bar dataKey="payment_rate" name="Payment Rate" stackId="a" fill={COLORS.operatingGood} radius={[0, 6, 6, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>,
                        {
                            metricKeys: ['denial_rate'],
                            emptySummary: 'Denial rate chart unavailable',
                            emptyReason: 'We need valid denial rates for the top payers to display this breakdown.',
                            requiredFields: ['payer_performance.by_charged[].Payer_name', 'payer_performance.by_charged[].denial_rate']
                        }
                    )}
                </div>
            </div>

            {unknownPayerRow ? (
                <div className="pra-callout warning pra-chart-note">
                    <strong>Unknown payer bucket</strong>
                    <p>
                        Unknown payer rows are excluded from the payer charts so the rankings remain readable.
                    </p>
                    <div className="pra-callout-metrics">
                        <span>{formatNumber(unknownPayerRow.claims)} claims</span>
                        <span>{formatCurrency(unknownPayerRow.charged_amt)} charged</span>
                        <span>{formatCurrency(unknownPayerRow.paid_amt)} paid</span>
                    </div>
                </div>
            ) : null}

            <div className="pra-section-grid">
                <div className="pra-chart-box pra-span-5">
                    <div className="pra-section-head">
                        <div>
                            <h3>Response timing by submission week</h3>
                            <p>Share of claims in each submission week that resolve in the same month versus later. Use the lag breakdown next to it for raw counts.</p>
                        </div>
                    </div>
                    {renderChart(
                        responseTimingShareRows,
                        <div className="pra-chart-wrapper">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={responseTimingShareRows} margin={{ top: 20, right: 24, left: 8, bottom: 12 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke={COLORS.grid} vertical={false} />
                                    <XAxis dataKey="submit_wom" stroke={COLORS.text} tickFormatter={(value) => `Week ${value}`} tick={{ fontSize: 11 }} />
                                    <YAxis stroke={COLORS.text} tickFormatter={formatPercent} tick={{ fontSize: 11 }} />
                                    <Tooltip
                                        content={
                                            <CustomTooltip
                                                formatter={tooltipFormatter}
                                                labelFormatter={(label, payload) => {
                                                    const total = payload?.[0]?.payload?.total_claims
                                                    return total ? `Week ${label} • ${formatNumber(total)} claims` : `Week ${label}`
                                                }}
                                            />
                                        }
                                    />
                                    <Legend />
                                    <Bar dataKey="same_month_share" name="Same-Month Share" stackId="a" fill={GRAPH_COLORS.responseTiming.same} radius={[6, 6, 0, 0]} />
                                    <Bar dataKey="later_share" name="Later Share" stackId="a" fill={GRAPH_COLORS.responseTiming.later} radius={[6, 6, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    , { metricKeys: ['same_month_share', 'later_share'] })}
                    <ChartSummary items={chartSummaries.responseTiming} />
                </div>

                <div className="pra-chart-box pra-span-7">
                    <div className="pra-section-head">
                        <div>
                            <h3>Claim lag breakdown</h3>
                            <p>Claim counts by exact month lag. This is a response-count view, not a payment-dollar view.</p>
                        </div>
                    </div>
                    {renderChart(
                        lagBreakdownRows,
                        <div className="pra-chart-wrapper">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={lagBreakdownRows} margin={{ top: 20, right: 24, left: 8, bottom: 12 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke={COLORS.grid} vertical={false} />
                                    <XAxis dataKey="submit_wom" stroke={COLORS.text} tickFormatter={(value) => `Week ${value}`} tick={{ fontSize: 11 }} />
                                    <YAxis stroke={COLORS.text} tick={{ fontSize: 11 }} />
                                    <Tooltip content={<CustomTooltip formatter={tooltipFormatter} />} />
                                    <Legend />
                                    <Bar dataKey="lag_0" name="Lag 0" stackId="b" fill={GRAPH_COLORS.lagBreakdown.lag0} radius={[6, 6, 0, 0]} />
                                    <Bar dataKey="lag_1" name="Lag 1" stackId="b" fill={GRAPH_COLORS.lagBreakdown.lag1} radius={[6, 6, 0, 0]} />
                                    <Bar dataKey="lag_2" name="Lag 2" stackId="b" fill={GRAPH_COLORS.lagBreakdown.lag2} radius={[6, 6, 0, 0]} />
                                    <Bar dataKey="lag_3_plus" name="Lag 3+" stackId="b" fill={GRAPH_COLORS.lagBreakdown.lag3} radius={[6, 6, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    , { metricKeys: ['lag_0', 'lag_1', 'lag_2', 'lag_3_plus'] })}
                    <ChartSummary items={chartSummaries.lagBreakdown} />
                </div>
            </div>

            <div className="pra-section-grid pra-section-grid-feature">
                <div className="pra-chart-box pra-span-7">
                    <div className="pra-section-head">
                        <div>
                            <h3>Paid cash timing by submit month</h3>
                            <p>When billed cash is actually realized, shown as percentage share by the month the claim was submitted.</p>
                        </div>
                    </div>
                    {renderChart(
                        paymentMonthShareChart,
                        <div className="pra-chart-wrapper">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={paymentMonthShareChart} margin={{ top: 16, right: 18, bottom: 12, left: 8 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke={COLORS.grid} vertical={false} />
                                    <XAxis dataKey="submit_month_label" stroke={COLORS.text} tick={{ fontSize: 11 }} />
                                    <YAxis stroke={COLORS.text} domain={[0, 1]} tickFormatter={formatPercent} tick={{ fontSize: 11 }} />
                                    <Tooltip content={<CustomTooltip formatter={tooltipFormatter} />} />
                                    <Legend />
                                    <Area type="monotone" dataKey="lag_0" name="Lag 0 Share" stackId="cash" stroke={GRAPH_COLORS.paymentMonth.lag0} fill={GRAPH_COLORS.paymentMonth.lag0} fillOpacity={0.56} />
                                    <Area type="monotone" dataKey="lag_1" name="Lag 1 Share" stackId="cash" stroke={GRAPH_COLORS.paymentMonth.lag1} fill={GRAPH_COLORS.paymentMonth.lag1} fillOpacity={0.48} />
                                    <Area type="monotone" dataKey="lag_2" name="Lag 2 Share" stackId="cash" stroke={GRAPH_COLORS.paymentMonth.lag2} fill={GRAPH_COLORS.paymentMonth.lag2} fillOpacity={0.42} />
                                    <Area type="monotone" dataKey="lag_3_plus" name="Lag 3+ Share" stackId="cash" stroke={GRAPH_COLORS.paymentMonth.lag3} fill={GRAPH_COLORS.paymentMonth.lag3} fillOpacity={0.36} />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    , { metricKeys: ['lag_0', 'lag_1', 'lag_2', 'lag_3_plus'] })}
                    <ChartSummary items={chartSummaries.paymentMonth} />
                </div>

                <div className="pra-chart-box pra-span-5">
                    <div className="pra-section-head">
                        <div>
                            <h3>Response arrival distribution</h3>
                            <p>Observed weekly arrival mix and cumulative readiness within a month. This is descriptive, not a predictive model.</p>
                        </div>
                    </div>
                    {renderChart(
                        receiptPatternWithCumulative,
                        <div className="pra-chart-wrapper">
                            <ResponsiveContainer width="100%" height="100%">
                                <ComposedChart data={receiptPatternWithCumulative} margin={{ top: 16, right: 18, bottom: 12, left: 8 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke={COLORS.grid} vertical={false} />
                                    <XAxis dataKey="resp_wom" stroke={COLORS.text} tickFormatter={(value) => `Week ${value}`} tick={{ fontSize: 11 }} />
                                    <YAxis yAxisId="left" stroke={COLORS.text} tickFormatter={formatPercent} tick={{ fontSize: 11 }} />
                                    <YAxis yAxisId="right" orientation="right" stroke={GRAPH_COLORS.receiptPattern.area} tickFormatter={formatPercent} tick={{ fontSize: 11 }} />
                                    <Tooltip content={<CustomTooltip formatter={formatPercent} />} />
                                    <Legend />
                                    <Bar yAxisId="left" dataKey="pct" name="Weekly Arrival Share" fill={GRAPH_COLORS.receiptPattern.bar} radius={[6, 6, 0, 0]} />
                                    <Area yAxisId="right" type="monotone" dataKey="cumulative_pct" name="Cumulative Readiness" stroke={GRAPH_COLORS.receiptPattern.area} fill={GRAPH_COLORS.receiptPattern.areaFill} strokeWidth={3} />
                                </ComposedChart>
                            </ResponsiveContainer>
                        </div>
                    , { metricKeys: ['pct', 'cumulative_pct'] })}
                    <ChartSummary items={chartSummaries.receiptPattern} />
                </div>
            </div>

            <div className="pra-section-grid">
                <div className="pra-chart-box pra-span-7">
                    <div className="pra-section-head">
                        <div>
                            <h3>Paid cash by submit week-of-month</h3>
                            <p>For claims submitted in each week, what percentage of paid cash lands in the same month versus later months.</p>
                        </div>
                    </div>
                    {renderChart(
                        paymentWomShareChart,
                        <div className="pra-chart-wrapper">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={paymentWomShareChart} margin={{ top: 20, right: 24, left: 8, bottom: 12 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke={COLORS.grid} vertical={false} />
                                    <XAxis dataKey="submit_wom" stroke={COLORS.text} tickFormatter={(value) => `Week ${value}`} tick={{ fontSize: 11 }} />
                                    <YAxis stroke={COLORS.text} domain={[0, 1]} tickFormatter={formatPercent} tick={{ fontSize: 11 }} />
                                    <Tooltip content={<CustomTooltip formatter={tooltipFormatter} />} />
                                    <Legend />
                                    <Bar dataKey="lag_0" name="Lag 0 Share" stackId="wom" fill={GRAPH_COLORS.paymentWom.lag0} radius={[6, 6, 0, 0]} />
                                    <Bar dataKey="lag_1" name="Lag 1 Share" stackId="wom" fill={GRAPH_COLORS.paymentWom.lag1} radius={[6, 6, 0, 0]} />
                                    <Bar dataKey="lag_2" name="Lag 2 Share" stackId="wom" fill={GRAPH_COLORS.paymentWom.lag2} radius={[6, 6, 0, 0]} />
                                    <Bar dataKey="lag_3_plus" name="Lag 3+ Share" stackId="wom" fill={GRAPH_COLORS.paymentWom.lag3} radius={[6, 6, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    , { metricKeys: ['lag_0', 'lag_1', 'lag_2', 'lag_3_plus'] })}
                    <ChartSummary items={chartSummaries.paymentWom} />
                </div>

                <div className="pra-chart-box pra-span-5">
                    <div className="pra-section-head">
                        <div>
                            <h3>Payer operating table</h3>
                            <p>Open balance is charged minus paid. Use this to prioritize high-dollar, slow-moving payer buckets.</p>
                        </div>
                    </div>
                    {payerSummaryRows.length ? (
                        <div className="pra-table-wrapper">
                            <table className="pra-table">
                                <thead>
                                    <tr>
                                        <th>Payer</th>
                                        <th>Claims</th>
                                        <th>Avg Days</th>
                                        <th>Collection</th>
                                        <th>Denial Rate</th>
                                        <th>Open Balance</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {payerSummaryRows.map((row) => (
                                        <tr key={row.Payer_name}>
                                            <td>{row.Payer_name}</td>
                                            <td>{formatNumber(row.claims)}</td>
                                            <td>{row.avg_days ? Number(row.avg_days).toFixed(1) : '0.0'}</td>
                                            <td>{formatPercent(row.collection_rate)}</td>
                                            <td>{formatPercent(row.denial_rate)}</td>
                                            <td>{formatCurrency(row.open_balance)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <EmptyState message="No named payer rows are available for the operating table." />
                    )}
                    <div className="pra-embedded-chart-block">
                        <div className="pra-section-head pra-embedded-head">
                            <div>
                                <h4>Operating priority map</h4>
                                <p>Right means higher open balance, up means slower response, bigger bubbles mean more claims, and color reflects collection rate.</p>
                            </div>
                        </div>
                        {renderChart(
                            operatingMapRows,
                            <div className="pra-chart-wrapper tall">
                                <ResponsiveContainer width="100%" height="100%">
                                    <ScatterChart margin={{ top: 16, right: 18, bottom: 16, left: 12 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke={COLORS.grid} />
                                        <XAxis
                                            type="number"
                                            dataKey="open_balance"
                                            stroke={COLORS.text}
                                            tick={{ fontSize: 11 }}
                                            tickFormatter={formatCurrencyCompact}
                                            name="Open balance"
                                        />
                                        <YAxis
                                            type="number"
                                            dataKey="avg_days"
                                            stroke={COLORS.text}
                                            tick={{ fontSize: 11 }}
                                            tickFormatter={(value) => `${Number(value).toFixed(0)}d`}
                                            name="Average response days"
                                        />
                                        <ZAxis type="number" dataKey="claims" range={[120, 420]} />
                                        <Tooltip content={<OperatingPriorityTooltip />} />
                                        {isFiniteNumber(operatingGuides.openBalance) ? (
                                            <ReferenceLine x={operatingGuides.openBalance} stroke={COLORS.section1Reference} strokeDasharray="4 4" />
                                        ) : null}
                                        {isFiniteNumber(operatingGuides.avgDays) ? (
                                            <ReferenceLine y={operatingGuides.avgDays} stroke={COLORS.section1Reference} strokeDasharray="4 4" />
                                        ) : null}
                                        <Scatter data={operatingMapRows} name="Operating priority" shape={<GlowBubbleShape />} />
                                    </ScatterChart>
                                </ResponsiveContainer>
                            </div>,
                            { metricKeys: ['open_balance', 'avg_days', 'claims'] }
                        )}
                        <div className="pra-bubble-legend" aria-label="Operating priority legend">
                            <span><i className="pra-legend-dot good" /> stronger collection</span>
                            <span><i className="pra-legend-dot mid" /> stable collection</span>
                            <span><i className="pra-legend-dot risk" /> weaker collection</span>
                            <span>Bubble size shows claim count</span>
                        </div>
                        <ChartSummary items={chartSummaries.operatingMap} />
                    </div>
                </div>
            </div>

            <div className="pra-section-grid">
                <div className="pra-chart-box pra-span-7">
                    <div className="pra-section-head">
                        <div>
                            <h3>Payment receipt lag by submission week</h3>
                            <p>How the paid-cash share is received in the same week or subsequent weeks after submission.</p>
                        </div>
                        {maxWeekLag ? (
                            <label className="pra-inline-select">
                                <span>Cap lag at</span>
                                <select value={weekLagCap} onChange={(event) => setWeekLagCap(Number(event.target.value))}>
                                    {weekLagCapOptions.map((option) => (
                                        <option key={option} value={option}>{option} weeks</option>
                                    ))}
                                </select>
                            </label>
                        ) : null}
                    </div>
                    {renderChart(
                        paymentWeekLagShareChart,
                        <div className="pra-chart-wrapper">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={paymentWeekLagShareChart} margin={{ top: 20, right: 24, left: 8, bottom: 12 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke={COLORS.grid} vertical={false} />
                                    <XAxis dataKey="submit_wom" stroke={COLORS.text} tickFormatter={(value) => `Week ${value}`} tick={{ fontSize: 11 }} />
                                    <YAxis stroke={COLORS.text} domain={[0, 1]} tickFormatter={formatPercent} tick={{ fontSize: 11 }} />
                                    <Tooltip content={<CustomTooltip formatter={tooltipFormatter} />} />
                                    <Legend />
                                    {weekLagBuckets.map((bucket, index) => {
                                        const label = bucket.endsWith('_plus')
                                            ? `${weekLagCap}+ weeks share`
                                            : `${bucket.replace('lag_', '')} weeks share`
                                        return (
                                            <Bar
                                                key={bucket}
                                                dataKey={bucket}
                                                name={label}
                                                stackId="weekLag"
                                                fill={GRAPH_COLORS.weekLag[index % GRAPH_COLORS.weekLag.length]}
                                            />
                                        )
                                    })}
                                </BarChart>
                            </ResponsiveContainer>
                        </div>,
                        {
                            metricKeys: weekLagBuckets,
                            emptySummary: 'Week-lag cash view unavailable in current API payload',
                            emptyReason: 'This chart needs paid amounts bucketed by submit week and week lag. The current payload provides month-lag timing, but not week-lag payment aggregates.',
                            requiredFields: ['payment_timing.by_submit_wom_week_lag[].submit_wom', 'payment_timing.by_submit_wom_week_lag[].week_lag', 'payment_timing.by_submit_wom_week_lag[].paid_amt']
                        }
                    )}
                    <ChartSummary items={chartSummaries.weekLag} />
                </div>
            </div>

            <div className="pra-section-grid">
                <div className="pra-chart-box pra-span-5">
                    <div className="pra-section-head">
                        <div>
                            <h3>Same-month response rate</h3>
                            <p>Exact same-month response probability by submission week.</p>
                        </div>
                    </div>
                    {renderChart(
                        timingCounts,
                        <div className="pra-chart-wrapper">
                            <ResponsiveContainer width="100%" height="100%">
                                <ComposedChart data={timingCounts} margin={{ top: 16, right: 18, bottom: 12, left: 8 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke={COLORS.grid} vertical={false} />
                                    <XAxis dataKey="submit_wom" stroke={COLORS.text} tickFormatter={(value) => `Week ${value}`} tick={{ fontSize: 11 }} />
                                    <YAxis stroke={COLORS.text} tickFormatter={formatPercent} tick={{ fontSize: 11 }} />
                                    <Tooltip content={<CustomTooltip formatter={formatPercent} />} />
                                    <Line type="monotone" dataKey="same_month_pct" name="Same-Month Rate" stroke={GRAPH_COLORS.sameMonthRate} strokeWidth={4} dot={{ r: 4, fill: GRAPH_COLORS.sameMonthRate }} />
                                </ComposedChart>
                            </ResponsiveContainer>
                        </div>
                    , { metricKeys: ['same_month_pct'] })}
                    <ChartSummary items={chartSummaries.sameMonthRate} />
                </div>
            </div>

            <div className="pra-callout info pra-chart-note">
                <strong>How to read the timing views</strong>
                <div className="pra-definition-list">
                    <div className="pra-definition-item">
                        <strong>Response timing</strong>
                        <span>Claim counts based on when a response posted, using the billing date as the submission start.</span>
                    </div>
                    <div className="pra-definition-item">
                        <strong>Paid cash timing</strong>
                        <span>Dollar-weighted views based on `Paid_Amount`, so payment charts can differ from response-count charts.</span>
                    </div>
                    <div className="pra-definition-item">
                        <strong>Week lag</strong>
                        <span>Computed as `floor(response_days / 7)`, matching the original Streamlit logic for payment receipt lag.</span>
                    </div>
                    <div className="pra-definition-item">
                        <strong>Unknown payer handling</strong>
                        <span>Missing payer names stay in totals but are excluded from payer rankings unless you explicitly include them.</span>
                    </div>
                </div>
            </div>

            <div className="pra-planner-panel">
                <div className="pra-section-head">
                    <div>
                        <h3>Collections planning estimate</h3>
                        <p>
                            This uses historical efficiency and next-month cash share from {plannerScopeNarrative}. Treat it as a scenario estimate, not a forecast guarantee.
                        </p>
                    </div>
                </div>

                <div className="pra-planner-toolbar">
                    <div className="pra-planner-toggle-group">
                        <span className="pra-control-label">Forecast scope</span>
                        <select
                            className="pra-select"
                            value={plannerPayerScope}
                            onChange={(event) => setPlannerPayerScope(event.target.value)}
                            aria-label="Planner payer scope"
                        >
                            {plannerScopeOptions.map((option) => (
                                <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                        </select>
                    </div>

                    <div className="pra-planner-toggle-group">
                        <span className="pra-control-label">Simulator</span>
                        <div className="pra-planner-toggle">
                            {plannerModeOptions.map((option) => (
                                <button
                                    key={option.value}
                                    type="button"
                                    className={plannerMode === option.value ? 'active' : ''}
                                    onClick={() => setPlannerMode(option.value)}
                                >
                                    <strong>{option.label}</strong>
                                    <small>{option.detail}</small>
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="pra-planner-toggle-group">
                        <span className="pra-control-label">Cadence</span>
                        <div className="pra-planner-toggle pra-planner-toggle--compact">
                            {plannerCadenceOptions.map((option) => (
                                <button
                                    key={option.value}
                                    type="button"
                                    className={plannerCadence === option.value ? 'active' : ''}
                                    onClick={() => setPlannerCadence(option.value)}
                                >
                                    <strong>{option.label}</strong>
                                    <small>{option.detail}</small>
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="pra-planner-toggle-group">
                        <span className="pra-control-label">View</span>
                        <div className="pra-planner-toggle pra-planner-toggle--views">
                            {plannerViewOptions.map((option) => (
                                <button
                                    key={option.value}
                                    type="button"
                                    className={plannerView === option.value ? 'active' : ''}
                                    onClick={() => setPlannerView(option.value)}
                                >
                                    <strong>{option.label}</strong>
                                    <small>{option.detail}</small>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {plannerScopePending ? (
                    <div className="pra-loading">
                        <div className="loading-spinner"></div>
                        <p>Loading planner forecast for {plannerScopeLabel}...</p>
                    </div>
                ) : plannerScopeUnavailable ? (
                    <div className="pra-error">
                        <strong>Unable to load planner forecast.</strong>
                        <span>{plannerScopeError || `No scoped planner data is available for ${plannerScopeLabel}.`}</span>
                    </div>
                ) : (
                    <>
                        <div className="pra-wow-grid">
                            <div className="pra-wow-impact-strip">
                                {wowImpactCards.map((card) => (
                                    <PlannerWowCard
                                        key={`${card.eyebrow}-${card.label}`}
                                        eyebrow={card.eyebrow}
                                        value={card.value}
                                        label={card.label}
                                        detail={card.detail}
                                        accent={card.accent}
                                    />
                                ))}
                            </div>

                            <div className="pra-wow-side-stack">
                                <div className="pra-wow-dial-card">
                                    <div className="pra-wow-panel-head">
                                        <div>
                                            <h4>30-day cash capture</h4>
                                            <p>
                                                Visual confidence meter for next-month cash conversion, with
                                                {' '}
                                                {plannerMode === 'target' ? 'gross-needed' : 'cash-outcome'}
                                                {' '}
                                                scenarios.
                                            </p>
                                        </div>
                                    </div>
                                    <div className="pra-wow-dial-shell">
                                        <div
                                            className="pra-wow-dial-ring"
                                            style={{ '--pra-dial-progress': `${clamp(simulatorCashCaptureRate) * 360}deg` }}
                                        >
                                            <div className="pra-wow-dial-core">
                                                <span>Base rate</span>
                                                <strong>{formatPercent(simulatorCashCaptureRate)}</strong>
                                                <small>gross to next-month cash</small>
                                            </div>
                                        </div>
                                        <div className="pra-wow-dial-legend">
                                            {wowDialItems.length ? wowDialItems.map((item) => (
                                                <div key={item.key} className={`pra-wow-dial-row pra-wow-dial-row--${item.key}`}>
                                                    <div className="pra-wow-dial-meta">
                                                        <span className={`pra-wow-dial-dot pra-wow-dial-dot--${item.key}`} />
                                                        <div>
                                                            <strong>{item.label}</strong>
                                                            <small>{formatPercent(item.rate)} capture rate</small>
                                                        </div>
                                                    </div>
                                                    <span className="pra-wow-outcome">{formatCurrency(item.value)}</span>
                                                </div>
                                            )) : (
                                                <div className="pra-wow-empty">
                                                    More scoped efficiency history is needed to render the confidence dial.
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div className="pra-wow-compare-card">
                                    <div className="pra-wow-panel-head">
                                        <div>
                                            <h4>What changed vs all payers</h4>
                                            <p>Portfolio benchmark for the selected forecast scope under the same date filters.</p>
                                        </div>
                                        {benchmarkInsights ? (
                                            <span className={`pra-wow-badge pra-wow-badge--${benchmarkInsights.tone}`}>{benchmarkInsights.badge}</span>
                                        ) : null}
                                    </div>
                                    {portfolioPending ? (
                                        <div className="pra-wow-empty">Loading the all-payer benchmark...</div>
                                    ) : portfolioUnavailable ? (
                                        <div className="pra-wow-empty">{portfolioError || 'All-payer benchmark data is not available for this scope.'}</div>
                                    ) : benchmarkInsights ? (
                                        <>
                                            <p className="pra-wow-compare-summary">{benchmarkInsights.summary}</p>
                                            <div className="pra-wow-benchmark-grid">
                                                {benchmarkInsights.rows.map((row) => (
                                                    <BenchmarkRow
                                                        key={row.label}
                                                        label={row.label}
                                                        value={row.value}
                                                        detail={row.detail}
                                                        tone={row.tone}
                                                    />
                                                ))}
                                            </div>
                                        </>
                                    ) : (
                                        <div className="pra-wow-empty">Switch the forecast scope to a payer to compare it against the all-payer portfolio baseline.</div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {plannerView === 'core' ? (
                            <div className="pra-planner-grid">
                                <div className="pra-planner-input-area">
                                    <label htmlFor="pra-planner-primary-input" className="pra-control-label">{plannerInputLabel}</label>
                                    <div className="pra-planner-input-shell">
                                        <span className="pra-planner-input-prefix">$</span>
                                        <input
                                            id="pra-planner-primary-input"
                                            type="text"
                                            inputMode="numeric"
                                            className="pra-input-field pra-planner-amount-input"
                                            value={plannerInputValue}
                                            onChange={(event) => {
                                                if (plannerMode === 'target') {
                                                    handleTargetCollectionChange(event.target.value)
                                                } else {
                                                    handleGrossChargesChange(event.target.value)
                                                }
                                            }}
                                            placeholder="0"
                                            aria-label={plannerInputLabel}
                                        />
                                    </div>
                                    <div className="pra-planner-facts">
                                        <span>Forecast scope: {plannerScopeLabel}</span>
                                        <span>Historical efficiency: {formatPercent(simulatorPlannerBaseline.historical_efficiency)}</span>
                                        <span>Next-month cash share: {formatPercent(simulatorPlannerOdds.nextMonthProb)}</span>
                                        <span>{plannerCadence === 'day' ? 'Day-wise split uses Mon-Fri submit mix' : 'Weekly split uses week-of-month submit mix'}</span>
                                    </div>
                                </div>

                                <div className="pra-planner-results">
                                    <div className="pra-result-box">
                                        <div className="result-label">{plannerResultLabel}</div>
                                        <div className="result-value">
                                            {plannerResultValue != null && plannerInputNumericValue > 0
                                                ? formatCurrency(plannerResultValue)
                                                : 'N/A'}
                                        </div>
                                        <div className="pra-result-subtext">
                                            {plannerResultSubtext}
                                        </div>
                                    </div>

                                    <div className="pra-chart-box planner-breakdown">
                                        <h4>{plannerBreakdownTitle}</h4>
                                        <p>{plannerBreakdownDetail}</p>
                                        {plannerAllocationRows.length ? (
                                            <div className="pra-chart-wrapper compact">
                                                <ResponsiveContainer width="100%" height="100%">
                                                    <BarChart data={plannerAllocationRows} layout="vertical" margin={{ top: 10, right: 18, left: 10, bottom: 10 }}>
                                                        <XAxis type="number" stroke={COLORS.text} tickFormatter={formatCurrencyCompact} tick={{ fontSize: 11 }} />
                                                        <YAxis type="category" dataKey="slot_label" stroke={COLORS.text} width={84} tick={{ fontSize: 12 }} />
                                                        <Tooltip content={<CustomTooltip formatter={tooltipFormatter} />} />
                                                        <Bar dataKey="amount" name="Required Charges" radius={[0, 4, 4, 0]}>
                                                            {plannerAllocationRows.map((entry, index) => (
                                                                <Cell key={entry.slot_key} fill={index === 0 ? GRAPH_COLORS.plannerTop : GRAPH_COLORS.plannerRest} />
                                                            ))}
                                                        </Bar>
                                                    </BarChart>
                                                </ResponsiveContainer>
                                            </div>
                                        ) : (
                                            <EmptyState message="More payment history is needed to compute a planning split." />
                                        )}
                                        <ChartSummary items={chartSummaries.planner} />
                                    </div>
                                </div>
                            </div>
                        ) : null}

                        {plannerView === 'scenario' && plannerMode === 'target' && (
                            <>
                                <div className="pra-planner-divider">
                                    <span>Scenario Bands</span>
                                    <small>Gross charges needed to hit your target at ±15% efficiency variance</small>
                                </div>
                                {scenarioBands ? (
                                    <div className="pra-scenario-grid">
                                        <div className="pra-scenario-card pra-scenario-card--optimistic">
                                            <div className="pra-scenario-label">Optimistic</div>
                                            <div className="pra-scenario-note">+15% efficiency</div>
                                            <div className="pra-scenario-value">{formatCurrency(scenarioBands.optimistic)}</div>
                                            <div className="pra-scenario-sub">gross charges needed</div>
                                        </div>
                                        <div className="pra-scenario-card pra-scenario-card--base">
                                            <div className="pra-scenario-label">Base</div>
                                            <div className="pra-scenario-note">Historical efficiency</div>
                                            <div className="pra-scenario-value">{formatCurrency(scenarioBands.base)}</div>
                                            <div className="pra-scenario-sub">gross charges needed</div>
                                        </div>
                                        <div className="pra-scenario-card pra-scenario-card--pessimistic">
                                            <div className="pra-scenario-label">Pessimistic</div>
                                            <div className="pra-scenario-note">−15% efficiency</div>
                                            <div className="pra-scenario-value">{formatCurrency(scenarioBands.pessimistic)}</div>
                                            <div className="pra-scenario-sub">gross charges needed</div>
                                        </div>
                                    </div>
                                ) : (
                                    <EmptyState message="Efficiency data is needed to compute scenario bands." />
                                )}
                            </>
                        )}

                        {plannerView === 'payers' && plannerMode === 'target' ? (
                            payerWiseSplit.length > 0 ? (
                                <>
                                    <div className="pra-planner-divider">
                                        <span>Payer-wise Target Split</span>
                                        <small>Based on each payer's historical share of collected cash</small>
                                    </div>
                                    <div className="pra-chart-box">
                                        <h4>Required gross charges by payer</h4>
                                        <p>Distributes the {formatCurrency(targetCollection)} target across the payers in {plannerScopeNarrative}. Hover a bar to see each payer's collection target and historical cash share.</p>
                                        <div className="pra-chart-wrapper" style={{ height: Math.max(260, payerWiseSplit.length * 60) }}>
                                            <ResponsiveContainer width="100%" height="100%">
                                                <BarChart data={payerWiseSplit} layout="vertical" margin={{ top: 8, right: 36, left: 8, bottom: 8 }}>
                                                    <CartesianGrid horizontal={false} stroke={COLORS.grid} />
                                                    <XAxis type="number" stroke={COLORS.text} tickFormatter={formatCurrencyCompact} tick={{ fontSize: 11 }} />
                                                    <YAxis type="category" dataKey="name" stroke={COLORS.text} width={196} tick={{ fontSize: 12 }} />
                                                    <Tooltip content={<PlannerSplitTooltip />} />
                                                    <Bar dataKey="required_gross" name="Required Gross Charges" fill={GRAPH_COLORS.plannerRest} radius={[0, 6, 6, 0]} />
                                                </BarChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </div>
                                </>
                            ) : (
                                <EmptyState message="No payer cash history is available for the selected forecast scope." />
                            )
                        ) : null}

                        {plannerView === 'timing' ? (
                            submissionTimingRec ? (
                                <>
                                    <div className="pra-planner-divider">
                                        <span>Submission Timing Recommendation</span>
                                        <small>When to submit claims to maximise same-month cash collection</small>
                                    </div>
                                    <div className="pra-timing-rec-grid">
                                        <div className="pra-timing-rec-card pra-timing-rec-card--best">
                                            <div className="pra-timing-badge pra-timing-badge--best">Best window</div>
                                            <div className="pra-timing-week">Week {submissionTimingRec.best.submit_wom}</div>
                                            <div className="pra-timing-value">{formatPercent(submissionTimingRec.best.same_month_pct)} same-month response</div>
                                            <div className="pra-timing-note">For {plannerScopeNarrative}, Week {submissionTimingRec.best.submit_wom} has the highest probability of same-month payer response and cash receipt.</div>
                                        </div>
                                        <div className="pra-timing-rec-card pra-timing-rec-card--avoid">
                                            <div className="pra-timing-badge pra-timing-badge--avoid">Avoid for urgent AR</div>
                                            <div className="pra-timing-week">Week {submissionTimingRec.worst.submit_wom}</div>
                                            <div className="pra-timing-value">{formatPercent(submissionTimingRec.worst.same_month_pct)} same-month response</div>
                                            <div className="pra-timing-note">Week {submissionTimingRec.worst.submit_wom} is the weakest same-month timing window for this forecast scope. Plan for next-month cash on urgent submissions.</div>
                                        </div>
                                        <div className="pra-timing-rec-card">
                                            <div className="pra-timing-badge">Context</div>
                                            <div className="pra-timing-week">Portfolio avg</div>
                                            <div className="pra-timing-value">{formatPercent(simulatorPlannerOdds.nextMonthProb)} lands next month</div>
                                            <div className="pra-timing-note">Within {plannerScopeNarrative}, {formatPercent(simulatorPlannerOdds.nextMonthProb)} of collected cash lands in the month after submission.</div>
                                        </div>
                                    </div>
                                </>
                            ) : (
                                <EmptyState message="More timing history is needed to recommend a payer-specific submission window." />
                            )
                        ) : null}
                    </>
                )}
            </div>
        </div>
    )
}

export default PayerResponseAnalytics
