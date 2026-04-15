import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowRight, ChevronDown, FileText, LayoutGrid, ListTodo, TrendingUp, TrendingDown, Activity } from 'lucide-react'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { formatCurrencyCompact, formatNumber } from '../../utils/formatters'
import './WorkPlanView.css'

const formatClaimPool = (value, { plus = false } = {}) => {
    const number = Number(value || 0)
    if (!Number.isFinite(number) || number <= 0) return plus ? '0+' : '0'
    if (number >= 1_000_000) {
        const scaled = number / 1_000_000
        const rounded = scaled.toFixed(1)
        return `${rounded.replace(/\.0$/, '')}M${plus ? '+' : ''}`
    }
    if (number >= 1_000) {
        const scaled = number / 1_000
        const rounded = scaled.toFixed(1)
        return `${rounded.replace(/\.0$/, '')}K${plus ? '+' : ''}`
    }
    return `${formatNumber(number)}${plus ? '+' : ''}`
}

const isAllPhaseSelection = (value) => {
    const normalized = String(value || '').trim().toLowerCase()
    return !normalized || normalized === 'all' || normalized === 'all phases' || normalized === 'all clients'
}

const formatItttDate = (value) => {
    if (!value) return 'Not scheduled'
    const parsed = new Date(`${value}T00:00:00`)
    if (Number.isNaN(parsed.getTime())) return value
    return parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

const formatMonthLabel = (value) => {
    if (!value) return 'Live AR snapshot'
    const parsed = new Date(`${value}-01T00:00:00`)
    if (Number.isNaN(parsed.getTime())) return value
    return parsed.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
}

const formatAveragePaymentDate = (lastBillDate, avgPaymentDays) => {
    const days = Number(avgPaymentDays)
    if (!lastBillDate || !Number.isFinite(days)) return '--'
    const parsed = new Date(`${lastBillDate}T00:00:00`)
    if (Number.isNaN(parsed.getTime())) return '--'
    parsed.setDate(parsed.getDate() + Math.round(days))
    return parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

const formatItttWindow = (startValue, endValue) => {
    if (!startValue) return 'Waiting for the next pending prediction date.'
    const startLabel = formatItttDate(startValue)
    if (!endValue || endValue === startValue) return 'Next pending prediction date in the later backlog.'
    const endLabel = formatItttDate(endValue)
    return `Window through ${endLabel}.`
}

const buildLaterItttDetail = (anchorDate, nextValue, endValue) => {
    if (anchorDate && nextValue && anchorDate !== nextValue) {
        const nextLabel = formatItttDate(nextValue)
        if (endValue && endValue !== nextValue) {
            return `Next pending backlog window starts ${nextLabel} and runs through ${formatItttDate(endValue)}.`
        }
        return `Next pending backlog date is ${nextLabel}.`
    }
    return formatItttWindow(nextValue, endValue)
}

const formatPercent = (value, digits = 1) => {
    const numeric = Number(value || 0)
    if (!Number.isFinite(numeric)) return '0%'
    return `${numeric.toFixed(digits).replace(/\.0$/, '')}%`
}

const formatDeltaPoints = (value) => {
    const numeric = Number(value || 0)
    if (!Number.isFinite(numeric) || numeric === 0) return '0 pts'
    return `${numeric > 0 ? '+' : ''}${numeric.toFixed(1).replace(/\.0$/, '')} pts`
}

const resolveFreshnessTone = (bucket) => {
    if (bucket === '0-15d') return 'fresh'
    if (bucket === '16-37d') return 'core'
    if (bucket === '38-60d') return 'risk'
    return 'tail'
}

const formatDetailValue = (value, fallback = '') => {
    const text = String(value || '').trim()
    if (!text || text.toLowerCase() === 'unknown') return fallback
    return text
}

const formatAgeDays = (value) => {
    const numeric = Number(value)
    if (!Number.isFinite(numeric)) return '--'
    return `${formatNumber(Math.max(0, Math.round(numeric)))}d`
}

const coerceNumber = (...values) => {
    for (const value of values) {
        const number = Number(value)
        if (Number.isFinite(number)) return number
    }
    return 0
}

const normalizeWorkPlanScopedDate = (selectedDate = '', asOfValue = '') => {
    const scopedDate = String(selectedDate || '').slice(0, 10)
    const asOfDate = String(asOfValue || '').slice(0, 10)

    if (!scopedDate) return asOfDate
    if (!asOfDate) return scopedDate
    return scopedDate > asOfDate ? asOfDate : scopedDate
}

const buildDenialHeadline = (currentTop, baselineTop, emergent, baselineWindow) => {
    if (currentTop?.code && baselineTop?.code && currentTop.code !== baselineTop.code) {
        return `${currentTop.code} has overtaken ${baselineTop.code} as the leading denial code in the current window.`
    }
    if (currentTop?.code && emergent?.code && emergent.code !== currentTop.code) {
        return `${currentTop.code} remains on top, while ${emergent.code} is rising fastest versus ${baselineWindow}.`
    }
    if (currentTop?.code) {
        return `${currentTop.code} remains the dominant denial code versus ${baselineWindow}.`
    }
    return 'Live denial-code comparison will appear here when the current scope has posted denials.'
}

const buildFallbackData = (status = 'Loading live AR data...') => ({
    heading: 'WORK PLAN',
    inventory: {
        title: 'TOTAL INVENTORY',
        subtitle: 'Work Plan Claims',
        metaLabel: 'Total AR encounters',
        metaValue: '--',
        volume: '--',
        spotlightTags: [
            { label: 'Total AR', value: '--' },
        ],
        metrics: [
            { label: 'Work Plan', value: '--', tone: 'info', detail: '--' },
            { label: 'Worked in 45D', value: '--', tone: 'default', detail: '--' },
            { label: 'Worked (All Time)', value: '--', tone: 'default', detail: '--' },
            { label: 'NPNR', value: '--', tone: 'warning', detail: '--' },
            { label: 'Open Balance', value: '--', tone: 'info', detail: '--' },
        ],
        cadence: [
            { label: 'Day', value: '--', detail: '--' },
            { label: 'Week', value: '--', detail: '--' },
            { label: 'Month', value: '--', detail: '--' },
            { label: 'Quarter', value: '--', detail: '--' },
            { label: 'Year', value: '--', detail: '--' },
        ],
    },
    today: {
        title: 'TODAY',
        badge: 'LIVE',
        subtitle: 'Actionable AR as of today',
        progress: 0,
        primaryLabel: 'Actionable Claims',
        primaryValue: '--',
        secondaryLabel: 'Risk $',
        secondaryValue: '--',
        buckets: [
            { label: 'Denials', tone: 'warning', meta: 'Actual', value: '--' },
            { label: 'NPNR', tone: 'info', meta: '>37D / no post', value: '--' },
        ],
    },
    later: {
        title: 'LATER',
        subtitle: 'Remaining work plan after today’s actionable queue',
        volumeLabel: 'Remaining actionable claims',
        backlog: '--',
        itttDate: {
            label: 'Scope',
            anchorDate: '',
            value: 'Live AR snapshot',
            detail: 'Remaining AR work plan after today’s denials and NPNR split.',
            linkLabel: 'Open calendar view',
            linkHref: '/dashboard/optimix-iks#iks-calendar-panel',
        },
        items: [
            { label: 'Remaining Balance', detail: 'Open AR still left in Work Plan', value: '--', flag: 'AR', tone: 'default' },
            { label: 'Not Worked', detail: 'Open AR with no worked signal', value: '--', flag: 'AR', tone: 'default' },
            { label: 'Worked >45D', detail: 'Touched, but outside the last 45 days', value: '--', flag: 'AR', tone: 'muted' },
        ],
    },
    breakdown: {
        title: 'Total Open AR Breakdown',
        age: [
            { label: '< 1 Year', count: 0, value: '--', share: '0%', color: '#36d3e0' },
            { label: '> 1 Year', count: 0, value: '--', share: '0%', color: '#8b5cf6' },
        ],
        propensity: [
            { label: 'Predicted to Pay', count: 0, value: '--', share: '0%', color: '#38e1d4' },
            { label: 'Predicted to Deny', count: 0, value: '--', share: '0%', color: '#fb923c' },
            { label: 'Unclassified', count: 0, value: '--', share: '0%', color: '#94a3b8' },
        ],
    },
    workedStatus: {
        title: 'Worked Status (Total Open AR)',
        totalLabel: 'Total Open AR',
        totalValue: '--',
        cards: [
            { label: 'Worked', value: '--', share: '0%' },
            { label: 'Not Worked', value: '--', share: '0%' },
        ],
        breakdown: [
            { label: 'Worked in last 45 days', value: '--', share: '0%' },
            { label: 'Worked more than 45 days', value: '--', share: '0%' },
        ],
        footnote: 'All breakdowns are derived from Total Open AR.',
    },
    aboutKpis: {
        title: "About These KPI's",
        text: 'Propensity to Pay and Propensity to Deny are derived from Total Open AR encounters using the prediction mapping.',
    },
    npnr: {
        title: 'NPNR Payer Detail',
        subtitle: 'Live AR NPNR detail using encounter, transaction, payer, and entity joins.',
        sourceLabel: 'Live BQ',
        summaryCards: [
            { label: 'AR NPNR Total', value: '--' },
            { label: 'Live Detail Rows', value: '--' },
            { label: 'Unique Payers', value: '--' },
            { label: 'Total Amount', value: '--' },
            { label: 'Avg Claim Age', value: '--' },
        ],
    },
    notes: {
        title: 'QUICK NOTES',
        placeholder: 'Live data is loading for this work-plan view...',
    },
    protocol: {
        title: 'NPNR DEFINITION PROTOCOL',
        items: [
            {
                tag: 'WORKPLAN',
                text: 'Open AR claims not worked in the last 45 days.',
            },
            {
                tag: 'NPNR',
                text: 'WorkPlan claims with no transaction date and last billed date older than 45 days.',
            },
        ],
    },
    freshness: {
        title: 'Fresh vs Aging Pressure',
        subtitle: 'Open workable inventory today and entry mix versus the trailing baseline',
        insight: 'Waiting for live claim-age pressure signals.',
        signals: [
            { label: 'Fresh Entry Share', value: '0%', detail: '0 pts vs baseline', tone: 'neutral' },
            { label: 'Aging Entry Share', value: '0%', detail: '0 pts vs baseline', tone: 'neutral' },
        ],
        openBuckets: [
            { bucket: '0-15d', label: 'Fresh Window', count: '0', balance: '$0', shareLabel: '0%', shareValue: 0, tone: 'fresh' },
            { bucket: '16-37d', label: 'Core Window', count: '0', balance: '$0', shareLabel: '0%', shareValue: 0, tone: 'core' },
            { bucket: '38-60d', label: 'Aging Risk', count: '0', balance: '$0', shareLabel: '0%', shareValue: 0, tone: 'risk' },
            { bucket: '60+d', label: 'Long Tail', count: '0', balance: '$0', shareLabel: '0%', shareValue: 0, tone: 'tail' },
        ],
    },
    denialShift: {
        title: 'Emerging Denial Pattern',
        subtitle: 'Current denial-code mix against the trailing three-month baseline',
        headline: 'Waiting for live denial-code drift.',
        highlights: [
            { label: 'Current Top', value: '--', detail: 'No current denial signal yet.', tone: 'neutral' },
            { label: 'Past Top', value: '--', detail: 'No historical baseline yet.', tone: 'neutral' },
            { label: 'Emerging', value: '--', detail: 'No emergent code yet.', tone: 'neutral' },
        ],
        rows: [],
    },
    payers: [],
})

const formatCompactCount = (value, options = {}) => formatClaimPool(value, options)
const hasTrendValue = (value) => Number.isFinite(Number(value))
const formatShareOfTotal = (value, total, digits = 1) => (
    total > 0 ? formatPercent((coerceNumber(value, 0) / total) * 100, digits) : '0%'
)

const buildDonutGradient = (items) => {
    const total = items.reduce((sum, item) => sum + coerceNumber(item.count, 0), 0)
    if (total <= 0) return 'conic-gradient(rgba(148, 163, 184, 0.16) 0% 100%)'

    let cursor = 0
    const segments = []

    items.forEach((item) => {
        const count = coerceNumber(item.count, 0)
        if (count <= 0) return
        const pct = (count / total) * 100
        const nextCursor = cursor + pct
        segments.push(`${item.color} ${cursor}% ${nextCursor}%`)
        cursor = nextCursor
    })

    if (cursor < 100) {
        segments.push(`rgba(148, 163, 184, 0.12) ${cursor}% 100%`)
    }

    return `conic-gradient(${segments.join(', ')})`
}

const mapWorkPlanPayload = (payload, selectedMonth, npnrDetailSummary = null, selectedDate = '', dayActionableMetrics = null) => {
    if (!payload) return buildFallbackData('Live AR data unavailable.')

    const detailSummary = npnrDetailSummary || {}
    const detailNpnrCount = coerceNumber(detailSummary.total_grouped_rows, detailSummary.total_claims, 0)
    const totalClaims = coerceNumber(payload.inventory?.claims_pool, 0)
    const totalBalance = coerceNumber(payload.inventory?.balance, 0)
    const summary = payload.summary || {}
    const arTotalCount = coerceNumber(summary.ar_total_count, totalClaims)
    const workedTotalCount = coerceNumber(summary.worked_total_count, 0)
    const workplanTotalCount = coerceNumber(summary.workplan_total_count, totalClaims)
    const workplanTotalBalance = coerceNumber(summary.workplan_total_balance, totalBalance)
    const workedLast45Count = coerceNumber(summary.worked_last_45_count, Math.max(arTotalCount - workplanTotalCount, 0))
    const arNpnrCount = coerceNumber(summary.npnr_total_count, 0)
    const arNpnrBalance = coerceNumber(summary.npnr_total_balance, 0)
    const workedMoreThan45Count = coerceNumber(summary.worked_more_than_45_count, 0)
    const notWorkedCount = coerceNumber(summary.not_worked_count, 0)
    const totalArEncounters = coerceNumber(summary.total_ar_encounters, totalClaims)
    const asOfDate = payload.as_of ? String(payload.as_of).slice(0, 10) : ''
    const scopedDate = normalizeWorkPlanScopedDate(selectedDate, asOfDate)
    const hasScopedDayMetrics = Boolean(scopedDate && dayActionableMetrics)
    const denialsToday = hasScopedDayMetrics
        ? coerceNumber(dayActionableMetrics.denials, payload.today?.denials, 0)
        : coerceNumber(payload.today?.denials, 0)
    const hasLiveNpnrDetail = npnrDetailSummary !== null && detailSummary.source === 'live_bq'
    const visibleNpnrCount = hasLiveNpnrDetail ? coerceNumber(detailSummary.total_claims, 0) : arNpnrCount
    const npnrToday = hasScopedDayMetrics
        ? coerceNumber(dayActionableMetrics.npnr, payload.today?.npnr, arNpnrCount)
        : coerceNumber(payload.today?.npnr, arNpnrCount)
    const workableCount = hasScopedDayMetrics
        ? coerceNumber(dayActionableMetrics.workable, denialsToday + npnrToday)
        : coerceNumber(payload.today?.workable_count, denialsToday + npnrToday)
    const workableBalance = coerceNumber(
        hasScopedDayMetrics ? dayActionableMetrics.workableBalance : null,
        payload.today?.workable_balance,
        coerceNumber(payload.today?.denials_balance, 0) + arNpnrBalance,
    )

    // Helper to calculate trend from new backend fields
    const calculateTrend = (current, prev) => {
        const c = coerceNumber(current, 0)
        const p = coerceNumber(prev, 0)
        if (p <= 0) return null
        return ((c - p) / p * 100).toFixed(1)
    }
    const remainingLaterCount = Math.max(workplanTotalCount - workableCount, 0)
    const remainingLaterBalance = Math.max(workplanTotalBalance - workableBalance, 0)
    const scopedMonthLabel = selectedMonth ? formatMonthLabel(selectedMonth) : 'Live AR snapshot'
    const scopeAnchorDate = scopedDate || asOfDate
    const progressPct = hasScopedDayMetrics
        ? (workplanTotalCount ? (workableCount / workplanTotalCount) * 100 : 0)
        : Number(payload.today?.progress_pct || 0)
    const freshnessData = payload.trends?.freshness || {}
    const entryMix = freshnessData.entry_mix || {}
    const baselineWindow = freshnessData.baseline_window_label || 'baseline'
    const freshnessBuckets = Array.isArray(freshnessData.open_buckets) ? freshnessData.open_buckets : []
    const openBuckets = freshnessBuckets.length > 0
        ? freshnessBuckets.map((bucket) => ({
            bucket: bucket.bucket,
            label: bucket.label,
            count: formatCompactCount(bucket.count || 0),
            balance: formatCurrencyCompact(bucket.balance || 0),
            shareLabel: formatPercent(bucket.share_pct || 0),
            shareValue: Number(bucket.share_pct || 0),
            tone: resolveFreshnessTone(bucket.bucket),
        }))
        : buildFallbackData().freshness.openBuckets
    const dominantBucket = openBuckets.reduce((best, bucket) => (
        !best || bucket.shareValue > best.shareValue ? bucket : best
    ), null)
    const freshDelta = Number(entryMix.fresh_delta_pct_points || 0)
    const agingDelta = Number(entryMix.aging_delta_pct_points || 0)
    const cadence = summary.cadence || {}
    const cadenceCards = [
        { key: 'day', label: 'Day' },
        { key: 'week', label: 'Week' },
        { key: 'month', label: 'Month' },
        { key: 'quarter', label: 'Quarter' },
        { key: 'year', label: 'Year' },
    ].map(({ key, label }) => {
        const bucket = cadence[key] || {}
        const trend = calculateTrend(bucket.count, bucket.count_prev)
        return {
            label,
            value: formatCompactCount(coerceNumber(bucket.count, 0)),
            detail: formatCurrencyCompact(coerceNumber(bucket.balance, 0)),
            trend: trend,
        }
    })
    const denialShiftData = payload.trends?.denial_shift || {}
    const currentTopReason = denialShiftData.current_top_reason
    const baselineTopReason = denialShiftData.baseline_top_reason
    const emergentReason = denialShiftData.emergent_reason
    const missingDenialCodeSummary = denialShiftData.missing_code_summary || {}
    const missingCurrentCount = coerceNumber(missingDenialCodeSummary.current_count, 0)
    const missingBaselineCount = coerceNumber(missingDenialCodeSummary.baseline_count, 0)
    const missingCodeNote = (missingCurrentCount || missingBaselineCount)
        ? `Missing-code bucket: ${formatNumber(missingCurrentCount)} current and ${formatNumber(missingBaselineCount)} baseline denials have no usable posted denial code.`
        : ''
    const denialBaselineWindow = denialShiftData.baseline_window_label || baselineWindow
    const denialRows = Array.isArray(denialShiftData.rows)
        ? denialShiftData.rows.map((row) => ({
            code: row.code || '--',
            currentCount: formatNumber(row.current_count || 0),
            currentShare: formatPercent(row.current_share_pct || 0, 1),
            baselineShare: formatPercent(row.baseline_share_pct || 0, 1),
            deltaLabel: formatDeltaPoints(row.delta_share_pct_points || 0),
            deltaValue: Number(row.delta_share_pct_points || 0),
            state: row.trend_state || 'Stable',
        }))
        : []
    const ageItems = [
        {
            label: '< 1 Year',
            count: coerceNumber(summary.ar_less_than_1_year, 0),
            value: formatCompactCount(coerceNumber(summary.ar_less_than_1_year, 0)),
            share: formatShareOfTotal(coerceNumber(summary.ar_less_than_1_year, 0), arTotalCount),
            color: '#36d3e0',
        },
        {
            label: '> 1 Year',
            count: coerceNumber(summary.ar_greater_than_1_year, 0),
            value: formatCompactCount(coerceNumber(summary.ar_greater_than_1_year, 0)),
            share: formatShareOfTotal(coerceNumber(summary.ar_greater_than_1_year, 0), arTotalCount),
            color: '#8b5cf6',
        },
    ]
    const propensityItems = [
        {
            label: 'Predicted to Pay',
            count: coerceNumber(summary.ar_predicted_to_pay, 0),
            value: formatCompactCount(coerceNumber(summary.ar_predicted_to_pay, 0)),
            share: formatShareOfTotal(coerceNumber(summary.ar_predicted_to_pay, 0), arTotalCount),
            color: '#38e1d4',
        },
        {
            label: 'Predicted to Deny',
            count: coerceNumber(summary.ar_predicted_to_deny, 0),
            value: formatCompactCount(coerceNumber(summary.ar_predicted_to_deny, 0)),
            share: formatShareOfTotal(coerceNumber(summary.ar_predicted_to_deny, 0), arTotalCount),
            color: '#fb923c',
        },
        {
            label: 'Unclassified',
            count: coerceNumber(summary.unclassified_open_ar, 0),
            value: formatCompactCount(coerceNumber(summary.unclassified_open_ar, 0)),
            share: formatShareOfTotal(coerceNumber(summary.unclassified_open_ar, 0), arTotalCount),
            color: '#94a3b8',
        },
    ]
    return {
        heading: 'WORK PLAN',
        inventory: {
            title: 'AR OVERVIEW',
            subtitle: 'Total Open AR = Work Plan + Worked',
            metaLabel: 'Total AR Encounters',
            metaValue: formatCompactCount(totalArEncounters),
            volume: formatCompactCount(arTotalCount),
            spotlightTags: [
                { label: '< 1 Yr', value: formatCompactCount(coerceNumber(summary.ar_less_than_1_year, 0)) },
                { label: '> 1 Yr', value: formatCompactCount(coerceNumber(summary.ar_greater_than_1_year, 0)) },
                { label: 'Predicted to Pay', value: formatCompactCount(coerceNumber(summary.ar_predicted_to_pay, 0)) },
                { label: 'Predicted to Deny', value: formatCompactCount(coerceNumber(summary.ar_predicted_to_deny, 0)) },
            ],
            metrics: [
                { label: 'Work Plan', value: formatCompactCount(workplanTotalCount), amount: formatCurrencyCompact(workplanTotalBalance), tone: 'info', detail: 'Not worked in the last 45 days = No worked signal + Worked >45D' },
                { label: 'Worked in 45D', value: formatCompactCount(workedLast45Count), amount: formatCurrencyCompact(coerceNumber(summary.worked_45d_balance, 0)), tone: 'default', detail: 'Open AR claims touched within the last 45 days' },
                { label: 'Worked (All Time)', value: formatCompactCount(workedTotalCount), tone: 'default', detail: 'Any worked signal = Worked in 45D + Worked >45D' },
                {
                    label: 'NPNR',
                    value: formatCompactCount(visibleNpnrCount),
                    amount: formatCurrencyCompact(
                        hasLiveNpnrDetail
                            ? coerceNumber(detailSummary.total_amount, 0)
                            : arNpnrBalance,
                    ),
                    tone: 'warning',
                    detail: hasLiveNpnrDetail
                        ? 'Live NPNR detail total from the payer-detail section below'
                        : 'No Payment No Response claims',
                },
                { label: 'Open Balance', value: formatCurrencyCompact(totalBalance), tone: 'info', detail: 'Total outstanding AR balance' },
            ],
            cadence: cadenceCards,
        },
        today: {
            title: 'TODAY',
            badge: 'LIVE',
            subtitle: hasScopedDayMetrics
                ? `Actionable AR for ${formatItttDate(scopedDate)}`
                : 'Actionable AR as of today',
            progress: Math.max(0, Math.min(100, Math.round(progressPct))),
            primaryLabel: 'Actionable Claims',
            primaryValue: formatCompactCount(workableCount),
            secondaryLabel: 'Risk $',
            secondaryValue: formatCurrencyCompact(workableBalance),
            buckets: [
                {
                    label: 'Denials',
                    tone: 'warning',
                    meta: 'Not worked 45D',
                    value: formatCompactCount(denialsToday),
                },
                {
                    label: 'NPNR',
                    tone: 'info',
                    meta: 'No txn • >45D',
                    value: formatCompactCount(npnrToday),
                },
            ],
        },
        later: {
            title: 'LATER',
            subtitle: `Remaining work plan after today’s actionable queue • ${formatCurrencyCompact(remainingLaterBalance)}`,
            volumeLabel: 'Remaining actionable claims',
            backlog: formatCompactCount(remainingLaterCount),
            itttDate: {
                label: 'Scope',
                anchorDate: scopeAnchorDate,
                value: selectedMonth ? scopedMonthLabel : (scopeAnchorDate ? formatItttDate(scopeAnchorDate) : 'Live AR snapshot'),
                detail: selectedMonth
                    ? `AR work plan scoped through ${scopedMonthLabel}. Remaining inventory is after today’s Denials + NPNR split.`
                    : 'Current AR remainder after today’s denials and NPNR split.',
                linkLabel: scopeAnchorDate
                    ? `Open ${formatItttDate(scopeAnchorDate)} calendar view`
                    : 'Open calendar view',
                linkHref: '/dashboard/optimix-iks#iks-calendar-panel',
            },
            items: [
                {
                    label: 'Remaining Balance',
                    detail: 'Open AR balance still left in Work Plan',
                    value: formatCurrencyCompact(remainingLaterBalance),
                    flag: 'AR',
                    tone: 'default',
                },
                {
                    label: 'Not Worked',
                    detail: 'Open AR with no worked signal',
                    value: formatCompactCount(notWorkedCount),
                    flag: 'AR',
                    tone: 'default',
                },
                {
                    label: 'Worked >45D',
                    detail: 'Touched, but outside the last 45 days',
                    value: formatCompactCount(workedMoreThan45Count),
                    flag: 'AR',
                    tone: 'muted',
                },
            ],
        },
        breakdown: {
            title: 'Total Open AR Breakdown',
            age: ageItems,
            propensity: propensityItems,
        },
        workedStatus: {
            title: 'Worked Status (Total Open AR)',
            totalLabel: 'Total Open AR',
            totalValue: formatCompactCount(arTotalCount),
            cards: [
                {
                    label: 'Worked in 45D',
                    value: formatCompactCount(workedLast45Count),
                    share: formatShareOfTotal(workedLast45Count, arTotalCount),
                },
                {
                    label: 'Not Worked in 45D',
                    value: formatCompactCount(workplanTotalCount),
                    share: formatShareOfTotal(workplanTotalCount, arTotalCount),
                },
            ],
            breakdown: [
                {
                    label: 'No worked signal',
                    value: formatCompactCount(notWorkedCount),
                    share: formatShareOfTotal(notWorkedCount, workplanTotalCount),
                },
                {
                    label: 'Worked more than 45 days',
                    value: formatCompactCount(workedMoreThan45Count),
                    share: formatShareOfTotal(workedMoreThan45Count, workplanTotalCount),
                },
            ],
            footnote: `${formatCompactCount(notWorkedCount)} no-worked-signal + ${formatCompactCount(workedMoreThan45Count)} worked >45D = ${formatCompactCount(workplanTotalCount)} Not Worked in 45D. Add ${formatCompactCount(workedLast45Count)} worked in 45D to reconcile to ${formatCompactCount(arTotalCount)} Total Open AR.`,
        },
        aboutKpis: {
            title: "About These KPI's",
            text: 'Propensity to Pay and Propensity to Deny are derived by mapping Total Open AR encounters to the denial prediction model using PredictedFlag and AccuracyFlag.',
        },
        npnr: {
            title: 'NPNR Payer Detail',
            subtitle: 'Live AR NPNR detail using encounter, transaction, payer, and entity joins.',
            sourceLabel: 'Live BQ',
            summaryCards: [
                { label: 'NPNR Claims', value: formatCompactCount(visibleNpnrCount) },
                { label: 'Grouped Payers', value: formatCompactCount(detailNpnrCount) },
                { label: 'Unique Payers', value: formatCompactCount(coerceNumber(detailSummary.unique_payers, 0)) },
                { label: 'Open Balance', value: formatCurrencyCompact(coerceNumber(detailSummary.total_amount, 0)) },
                {
                    label: 'Avg Claim Age',
                    value: detailNpnrCount > 0
                        ? `${coerceNumber(detailSummary.avg_claim_age_days, 0).toFixed(1).replace(/\.0$/, '')}d`
                        : '--',
                },
            ],
        },
        notes: {
            title: 'QUICK NOTES',
            placeholder: payload.as_of
                ? `Live AR view refreshed ${new Date(payload.as_of).toLocaleString('en-US', { timeZone: 'America/New_York', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })} EST. WorkPlan excludes claims worked in the last 45 days. AR NPNR uses no transaction date plus last billed older than 45 days.${hasLiveNpnrDetail ? ' Payer NPNR detail below is live from patient encounter, main encounter, and transaction joins.' : ''}`
                : 'Live AR view is connected.',
        },
        protocol: {
            title: 'NPNR DEFINITION PROTOCOL',
            items: [
                {
                    tag: 'WORKPLAN',
                    text: payload.protocol?.workplan_rule || 'Open AR claims not worked in the last 45 days.',
                },
                {
                    tag: 'NPNR',
                    text: hasLiveNpnrDetail
                        ? 'AR NPNR total and the lower payer-detail section both use live 45-day no-transaction logic.'
                        : (payload.protocol?.npnr_rule || 'WorkPlan claims with no transaction date and last billed date older than 45 days.'),
                },
            ],
        },
        freshness: {
            title: 'Fresh vs Aging Pressure',
            subtitle: 'Open actionable claims inventory today and entry mix versus the trailing baseline',
            insight: dominantBucket
                ? `${dominantBucket.label} carries ${dominantBucket.shareLabel} of today's open actionable claims inventory.`
                : 'Live claim-age pressure will appear here when actionable claims inventory is available.',
            signals: [
                {
                    label: 'Fresh Entry Share',
                    value: formatPercent(entryMix.fresh_share_pct || 0),
                    detail: `${formatDeltaPoints(freshDelta)} vs ${baselineWindow}`,
                    tone: freshDelta >= 0 ? 'positive' : 'warning',
                },
                {
                    label: 'Aging Entry Share',
                    value: formatPercent(entryMix.aging_share_pct || 0),
                    detail: `${formatDeltaPoints(agingDelta)} vs ${baselineWindow}`,
                    tone: agingDelta > 0 ? 'warning' : 'positive',
                },
            ],
            openBuckets,
        },
        denialShift: {
            title: 'Emerging Denial Pattern',
            subtitle: 'Current denial-code mix against the trailing three-month baseline',
            headline: buildDenialHeadline(currentTopReason, baselineTopReason, emergentReason, denialBaselineWindow),
            note: missingCodeNote,
            highlights: [
                {
                    label: 'Current Top',
                    value: currentTopReason?.code || '--',
                    detail: currentTopReason
                        ? `${formatPercent(currentTopReason.current_share_pct || 0, 1)} share • ${formatNumber(currentTopReason.current_count || 0)} denials`
                        : 'No current denial signal yet.',
                    tone: 'neutral',
                },
                {
                    label: 'Past Top',
                    value: baselineTopReason?.code || '--',
                    detail: baselineTopReason
                        ? `${formatPercent(baselineTopReason.baseline_share_pct || 0, 1)} share • ${formatNumber(baselineTopReason.baseline_count || 0)} denials`
                        : 'No historical baseline yet.',
                    tone: 'neutral',
                },
                {
                    label: 'Emerging',
                    value: emergentReason?.code || '--',
                    detail: emergentReason
                        ? `${formatDeltaPoints(emergentReason.delta_share_pct_points || 0)} vs ${denialBaselineWindow}`
                        : 'No emergent code yet.',
                    tone: Number(emergentReason?.delta_share_pct_points || 0) > 0 ? 'warning' : 'neutral',
                },
            ],
            rows: denialRows,
        },
    }
}

function ProgressRing({ value }) {
    return (
        <div
            className="iks-workplan-ring"
            style={{ '--iks-workplan-progress': `${value}%` }}
        >
            <div className="iks-workplan-ring__inner">
                <span>{value}%</span>
            </div>
        </div>
    )
}

function BreakdownDonut({ title, items }) {
    const total = items.reduce((sum, item) => sum + coerceNumber(item.count, 0), 0)
    let currentStop = 0
    const donutStops = items
        .filter((item) => coerceNumber(item.count, 0) > 0)
        .map((item) => {
            const share = total > 0 ? (coerceNumber(item.count, 0) / total) * 100 : 0
            const start = currentStop
            currentStop += share
            return `${item.color} ${start}% ${currentStop}%`
        })
    const donutStyle = {
        '--iks-workplan-donut-gradient': donutStops.length
            ? `conic-gradient(${donutStops.join(', ')})`
            : 'conic-gradient(rgba(148, 163, 184, 0.2) 0 100%)',
    }

    return (
        <div className="iks-workplan__breakdown-block">
            <div className="iks-workplan__breakdown-title">{title}</div>
            <div className="iks-workplan__breakdown-content">
                <div className="iks-workplan__donut" style={donutStyle} aria-hidden="true">
                    <div className="iks-workplan__donut-center" />
                </div>
                <div className="iks-workplan__legend">
                    {items.map((item) => (
                        <div key={item.label} className="iks-workplan__legend-row">
                            <i className="iks-workplan__legend-dot" style={{ backgroundColor: item.color }} />
                            <div className="iks-workplan__legend-copy">
                                <span>{item.label}</span>
                                <div className="iks-workplan__legend-values">
                                    <strong>{item.value}</strong>
                                    <small>{item.share}</small>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}

function DenialShiftRow({ row }) {
    const toneClass = row.deltaValue > 0 ? 'is-rising' : row.deltaValue < 0 ? 'is-cooling' : 'is-flat'
    return (
        <div className={`iks-workplan__denial-row ${toneClass}`}>
            <div className="iks-workplan__denial-code">{row.code}</div>
            <div className="iks-workplan__denial-copy">
                <span>{row.state}</span>
                <small>{row.currentShare} current vs {row.baselineShare} baseline</small>
            </div>
            <div className="iks-workplan__denial-values">
                <strong>{row.currentCount}</strong>
                <span>{row.deltaLabel}</span>
            </div>
        </div>
    )
}

function FreshnessBucketRow({ bucket }) {
    return (
        <div className={`iks-workplan__freshness-row iks-workplan__freshness-row--${bucket.tone}`}>
            <div className="iks-workplan__freshness-header">
                <div className="iks-workplan__freshness-title">
                    <span>{bucket.label}</span>
                    <small>{bucket.bucket}</small>
                </div>
                <div className="iks-workplan__freshness-stats">
                    <span className="iks-workplan__freshness-stat-label">Claims</span>
                    <strong>{bucket.count}</strong>
                    <span className="iks-workplan__freshness-stat-label" style={{ marginTop: 4 }}>Billed Amt</span>
                    <span className="iks-workplan__freshness-balance">{bucket.balance}</span>
                </div>
            </div>
            <div className="iks-workplan__freshness-track">
                <div className="iks-workplan__freshness-fill" style={{ width: `${Math.max(bucket.shareValue, 2)}%` }} />
                <span className="iks-workplan__freshness-pct">{bucket.shareLabel}</span>
            </div>
        </div>
    )
}

function NpnrDetailRow({ record }) {
    const [isExpanded, setIsExpanded] = useState(false)
    const hasEncounters = Array.isArray(record.encounters) && record.encounters.length > 0

    const payerName = formatDetailValue(record.payer_name, 'Unknown payer')
    const payerId = formatDetailValue(record.payer_id, '')
    const financialClass = formatDetailValue(record.financial_class, 'Unmapped')
    const financialClass2 = formatDetailValue(record.financial_class_2, '')
    const lastBillDate = formatDetailValue(record.last_bill_date ? formatItttDate(record.last_bill_date) : null, '--')
    const avgPaymentDaysLabel = Number.isFinite(Number(record.avg_payment_days))
        ? `${Number(record.avg_payment_days).toFixed(1).replace(/\.0$/, '')}d`
        : '--'
    const avgPaymentDateLabel = formatAveragePaymentDate(record.last_bill_date, record.avg_payment_days)
    const claimAgeLabel = formatAgeDays(record.claim_age_in_days)
    const amountLabel = formatCurrencyCompact(record.amount || 0)

    return (
        <>
            <div
                className={`iks-workplan-table__row iks-workplan-table__row--detail entity-${record.responsible_entity || 0} ${hasEncounters ? 'iks-row-expandable' : ''} ${isExpanded ? 'iks-row-expanded' : ''}`}
                onClick={() => { if (hasEncounters) setIsExpanded(!isExpanded) }}
                title={hasEncounters ? "Click to view individual accounts" : ""}
                style={{ cursor: hasEncounters ? 'pointer' : 'default' }}
            >
                <div className="iks-workplan-table__detail-cell iks-workplan-table__detail-cell--encounter">
                    <div className="iks-workplan-table__payer-copy">
                        <div className="iks-workplan-table__payer" title={payerName}>
                            {hasEncounters && <span className="iks-expand-icon">{isExpanded ? '▼' : '▶'}</span>} {payerName}
                            <span style={{ opacity: 0.5, fontSize: '0.85em', fontWeight: 500, marginLeft: '6px' }}>({record.count})</span>
                        </div>
                        <div className="iks-workplan-table__state" style={{ opacity: 0.8 }}>
                            {record.count} Claims • {payerId || record.payer_detail}
                        </div>
                    </div>
                </div>
                <div className="iks-workplan-table__detail-cell">
                    <div className="iks-workplan-table__payer-copy">
                        <div className="iks-workplan-table__payer" title={financialClass}>{financialClass}</div>
                        <div className="iks-workplan-table__state" title={financialClass2}>{financialClass2}</div>
                    </div>
                </div>
                <div className="iks-workplan-table__detail-cell iks-workplan-table__detail-cell--entity">
                    <span className={`iks-workplan__entity-badge entity-${record.responsible_entity || 0}`}>
                        {formatDetailValue(record.entity_label, 'Unknown')}
                    </span>
                </div>
                <div className="iks-workplan-table__detail-cell" title={lastBillDate}>
                    <span>{lastBillDate}</span>
                    {record.count > 0 ? (
                        <span className="iks-workplan__date-enc-count">{formatNumber(record.count)} enc</span>
                    ) : null}
                </div>
                <div className="iks-workplan-table__detail-cell iks-workplan-table__detail-cell--numeric iks-workplan-table__detail-cell--timing" title={`${avgPaymentDateLabel}${avgPaymentDaysLabel !== '--' ? ` • ${avgPaymentDaysLabel}` : ''}`}>
                    <span>{avgPaymentDateLabel}</span>
                    {avgPaymentDaysLabel !== '--' ? <small className="iks-workplan__timing-meta">{avgPaymentDaysLabel}</small> : null}
                </div>
                <div className="iks-workplan-table__detail-cell iks-workplan-table__detail-cell--numeric" title={claimAgeLabel}>
                    {claimAgeLabel}
                </div>
                <div className="iks-workplan-table__detail-cell iks-workplan-table__detail-cell--numeric iks-workplan-table__detail-cell--amount" title={amountLabel}>
                    {amountLabel}
                </div>
            </div>

            {isExpanded && hasEncounters && (
                <div className="iks-workplan-nested-container">
                    <div className="iks-workplan-nested-header">
                        <div className="nested-cell">Account / Enc</div>
                        <div className="nested-cell">Financial Class</div>
                        <div className="nested-cell">Entity</div>
                        <div className="nested-cell">Last Bill</div>
                        <div className="nested-cell nested-numeric">Avg Pay Date</div>
                        <div className="nested-cell nested-numeric">Age</div>
                        <div className="nested-cell nested-numeric">Amount</div>
                    </div>
                    <div className="iks-workplan-nested-body">
                        {record.encounters.map(enc => (
                             <div key={`${enc.encounter_number}-${enc.amount}`} className="iks-workplan-nested-row">
                                <div className="nested-cell" title={enc.encounter_number}>{formatDetailValue(enc.encounter_number)}</div>
                                <div className="nested-cell" title={enc.financial_class}>{formatDetailValue(enc.financial_class, 'Unmapped')}</div>
                                <div className="nested-cell" title={enc.entity_label}>{formatDetailValue(enc.entity_label, 'Unknown')}</div>
                                <div className="nested-cell">{enc.last_bill_date ? formatItttDate(enc.last_bill_date) : '--'}</div>
                                <div className="nested-cell nested-numeric nested-cell--timing">
                                    <span>{formatAveragePaymentDate(enc.last_bill_date, enc.avg_payment_days)}</span>
                                    {Number.isFinite(Number(enc.avg_payment_days))
                                        ? <small className="iks-workplan__timing-meta">{`${Number(enc.avg_payment_days).toFixed(1).replace(/\.0$/, '')}d`}</small>
                                        : null}
                                </div>
                                <div className="nested-cell nested-numeric nested-cell--age">{formatAgeDays(enc.claim_age_in_days)}</div>
                                <div className="nested-cell nested-numeric nested-cell--amount">{formatCurrencyCompact(enc.amount)}</div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </>
    )
}

export default function WorkPlanView({ selectedMonth = '', selectedClient = '', refreshToken = 0, onOpenCalendarView = null, onContextChange = null, selectedDate = '', dayActionableMetrics = null }) {
    const [payload, setPayload] = useState(null)
    const [liveDayMetrics, setLiveDayMetrics] = useState(null)
    const [granularity, setGranularity] = useState('day')
    const [error, setError] = useState('')
    const [isLoading, setIsLoading] = useState(true)
    const hasLoadedRef = useRef(false)
    const [npnrDetail, setNpnrDetail] = useState(null)
    const [npnrDetailError, setNpnrDetailError] = useState('')
    const [npnrDetailLoading, setNpnrDetailLoading] = useState(true)
    const [npnrSearch, setNpnrSearch] = useState('')
    const [npnrPage, setNpnrPage] = useState(1)
    const [npnrEntityFilter, setNpnrEntityFilter] = useState('')
    const [npnrBalanceFilter, setNpnrBalanceFilter] = useState('open')
    const [collapsedPanels, setCollapsedPanels] = useState({
        freshness: false,
        denialShift: false,
    })
    const workPlanCacheRef = useRef(new Map())
    const dayMetricsCacheRef = useRef(new Map())
    const npnrDetailCacheRef = useRef(new Map())
    const deferredNpnrSearch = useDeferredValue(npnrSearch.trim())

    useEffect(() => {
        let isActive = true
        let controller = null

        // Reset loaded state on month/client change so we show loading indicator
        hasLoadedRef.current = false

        const loadWorkPlan = () => {
            const cacheKey = [selectedMonth || 'live', isAllPhaseSelection(selectedClient) ? 'all' : selectedClient || 'all', granularity, refreshToken].join('::')
            const cachedPayload = workPlanCacheRef.current.get(cacheKey)

            if (cachedPayload) {
                hasLoadedRef.current = true
                setPayload(cachedPayload)
                setError('')
                setIsLoading(false)
                return
            }

            if (controller) controller.abort()
            controller = new AbortController()

            if (!hasLoadedRef.current) {
                setIsLoading(true)
            }

            const params = new URLSearchParams()
            if (selectedMonth) params.set('month', selectedMonth)
            params.set('granularity', granularity)
            if (!isAllPhaseSelection(selectedClient)) params.set('phase', selectedClient)
            if (refreshToken > 0) params.set('refresh', 'true')

            fetch(`/api/optimix/iks/ar-workplan${params.toString() ? `?${params.toString()}` : ''}`, {
                signal: controller.signal,
            })
                .then((response) => response.ok ? response.json() : Promise.reject(new Error(`Failed to load AR work plan (${response.status})`)))
                .then((data) => {
                    if (!isActive) return
                    if (data?.error) throw new Error(data.error)
                    hasLoadedRef.current = true
                    workPlanCacheRef.current.set(cacheKey, data)
                    setPayload(data)
                    setError('')
                })
                .catch((err) => {
                    if (!isActive || err.name === 'AbortError') return
                    console.warn('AR work plan fetch failed:', err)
                    setError(err.message || 'Unable to load live AR work-plan data.')
                })
                .finally(() => {
                    if (isActive) {
                        setIsLoading(false)
                    }
                })
        }

        loadWorkPlan()

        return () => {
            isActive = false
            if (controller) controller.abort()
        }
    }, [selectedMonth, selectedClient, granularity, refreshToken])

    useEffect(() => {
        let isActive = true
        const controller = new AbortController()
        const detailKey = [
            isAllPhaseSelection(selectedClient) ? 'all' : selectedClient || 'all',
            selectedMonth || 'live',
            deferredNpnrSearch || '',
            npnrEntityFilter || '',
            npnrBalanceFilter || 'open',
            npnrPage,
            refreshToken,
        ].join('::')
        const cachedDetail = npnrDetailCacheRef.current.get(detailKey)

        if (cachedDetail) {
            setNpnrDetail(cachedDetail)
            setNpnrDetailError(cachedDetail?.error || '')
            setNpnrDetailLoading(false)
            return () => {
                isActive = false
                controller.abort()
            }
        }

        setNpnrDetailLoading(true)
        setNpnrDetailError('')

        const params = new URLSearchParams()
        if (deferredNpnrSearch) params.set('search', deferredNpnrSearch)
        if (npnrEntityFilter) params.set('entity', npnrEntityFilter)
        if (npnrBalanceFilter === 'zero') params.set('balance_zero', 'true')
        if (!isAllPhaseSelection(selectedClient)) params.set('phase', selectedClient)
        if (selectedMonth) params.set('month', selectedMonth)
        params.set('page', String(npnrPage))
        params.set('per_page', '12')
        if (refreshToken) params.set('refresh', 'true')

        fetch(`/api/optimix/iks/npnr-data?${params.toString()}`, {
            signal: controller.signal,
        })
            .then((response) => response.ok ? response.json() : Promise.reject(new Error(`Failed to load NPNR detail (${response.status})`)))
            .then((data) => {
                if (!isActive) return
                npnrDetailCacheRef.current.set(detailKey, data)
                setNpnrDetail(data)
                setNpnrDetailError(data?.error || '')
            })
                .catch((err) => {
                    if (!isActive || err.name === 'AbortError') return
                    console.warn('NPNR detail fetch failed:', err)
                    setNpnrDetailError(err.message || 'Unable to load live NPNR detail.')
                })
            .finally(() => {
                if (isActive) {
                    setNpnrDetailLoading(false)
                }
            })

        return () => {
            isActive = false
            controller.abort()
        }
    }, [deferredNpnrSearch, npnrPage, npnrEntityFilter, npnrBalanceFilter, selectedClient, selectedMonth, refreshToken])

    const normalizedSelectedDate = useMemo(
        () => normalizeWorkPlanScopedDate(selectedDate, payload?.as_of || ''),
        [selectedDate, payload?.as_of],
    )

    useEffect(() => {
        const scopedDate = normalizedSelectedDate
        if (!scopedDate) {
            setLiveDayMetrics(null)
            return
        }

        let isActive = true
        const controller = new AbortController()
        const cacheKey = [scopedDate, isAllPhaseSelection(selectedClient) ? 'all' : selectedClient || 'all', refreshToken].join('::')
        const cachedMetrics = dayMetricsCacheRef.current.get(cacheKey)

        if (cachedMetrics) {
            setLiveDayMetrics(cachedMetrics)
            return () => {
                isActive = false
                controller.abort()
            }
        }

        const params = new URLSearchParams()
        params.set('date', scopedDate)
        if (!isAllPhaseSelection(selectedClient)) params.set('phase', selectedClient)
        if (refreshToken) params.set('refresh', 'true')

        fetch(`/api/optimix/iks/ar-workable?${params.toString()}`, {
            signal: controller.signal,
        })
            .then((response) => response.ok ? response.json() : Promise.reject(new Error(`Failed to load AR workable day metrics (${response.status})`)))
            .then((data) => {
                if (!isActive || data?.error) return
                const normalized = {
                    denials: Number(data.total_denials ?? data.actual_deny ?? 0),
                    npnr: Number(data.npnr || 0),
                    workable: Number(data.workable ?? data.total_workable ?? 0),
                    workableBalance: Number(data.workable_charged_amt || 0),
                    source: 'live_ar_workable',
                }
                dayMetricsCacheRef.current.set(cacheKey, normalized)
                setLiveDayMetrics(normalized)
            })
            .catch((err) => {
                if (!isActive || err.name === 'AbortError') return
                console.warn('AR workable day metrics fetch failed:', err)
                setLiveDayMetrics(null)
            })

        return () => {
            isActive = false
            controller.abort()
        }
    }, [normalizedSelectedDate, selectedClient, refreshToken])

    const npnrEntityRows = Array.isArray(npnrDetail?.by_entity) ? npnrDetail.by_entity : []
    const npnrRecords = Array.isArray(npnrDetail?.records) ? npnrDetail.records : []

    const viewData = useMemo(
        () => mapWorkPlanPayload(payload, selectedMonth, npnrDetail?.summary || null, normalizedSelectedDate, liveDayMetrics || dayActionableMetrics),
        [payload, selectedMonth, npnrDetail?.summary, normalizedSelectedDate, liveDayMetrics, dayActionableMetrics],
    )

    const chatContextPayload = useMemo(() => {
        if (!payload) return null
        return {
            source: payload.source || 'live_bq',
            as_of: payload.as_of || null,
            selected_month: selectedMonth || null,
            selected_date: normalizedSelectedDate || null,
            summary: payload.summary || {},
            today: payload.today || {},
            later: payload.later || {},
            inventory: payload.inventory || {},
            protocol: payload.protocol || {},
            trends: {
                freshness: payload.trends?.freshness || {},
                denial_shift: payload.trends?.denial_shift || {},
            },
            npnr_detail_summary: npnrDetail?.summary || {},
            npnr_detail_filters: {
                search: deferredNpnrSearch || '',
                entity: npnrEntityFilter || '',
                balance_scope: npnrBalanceFilter,
            },
        }
    }, [payload, selectedMonth, normalizedSelectedDate, npnrDetail?.summary, deferredNpnrSearch, npnrEntityFilter, npnrBalanceFilter])

    useEffect(() => {
        if (typeof onContextChange !== 'function') return undefined
        onContextChange(chatContextPayload)
        return () => {
            onContextChange(null)
        }
    }, [chatContextPayload, onContextChange])

    const displayTrendData = useMemo(() => {
        const trendData = payload?.trends?.main_trend || []
        if (trendData.length === 0) return []
        if (granularity === 'day') return trendData.slice(-31)
        if (granularity === 'week') return trendData.slice(-12)
        if (granularity === 'month') return trendData.slice(-12)
        if (granularity === 'quarter') return trendData.slice(-8)
        return trendData
    }, [payload?.trends?.main_trend, granularity])

    const togglePanel = (panelKey) => {
        setCollapsedPanels((current) => ({
            ...current,
            [panelKey]: !current[panelKey],
        }))
    }

    const handleOpenCalendarView = () => {
        if (typeof onOpenCalendarView === 'function') {
            onOpenCalendarView(viewData.later.itttDate.anchorDate)
        }
    }

    if (!payload && isLoading) {
        return (
            <section className="iks-workplan" aria-label="AR workable work plan">
                {error && <div className="iks-workplan__error">{error}</div>}
                <div className="iks-workplan__loading">Refreshing live Work Plan data...</div>
            </section>
        )
    }

    return (
        <section className="iks-workplan" aria-label="AR workable work plan">
            {error && <div className="iks-workplan__error">{error}</div>}

            <div className="iks-workplan__hero">
                <div className="iks-workplan__hero-band" />
                <div className="iks-workplan__top">
                    <div className="iks-workplan__inventory-card iks-workplan-card iks-workplan-card--expanded">
                        <div className="iks-workplan__eyebrow">
                            <span>{viewData.inventory.title}</span>
                            <span>{viewData.inventory.subtitle}</span>
                        </div>
                        <div className="iks-workplan__inventory-value-box iks-workplan__inventory-value-box--redesign">
                            <div className="iks-workplan__inventory-value-group">
                                <div className="iks-workplan__inventory-value" title="All open AR regardless of timeframe">
                                    <span>{viewData.inventory.volume}</span>
                                </div>
                                <div className="iks-workplan__inventory-meta">
                                    <span>{viewData.inventory.metaLabel}</span>
                                    <strong>{viewData.inventory.metaValue}</strong>
                                </div>
                                {viewData.inventory.spotlightTags?.length > 0 && (
                                    <div className="iks-workplan__volume-lines">
                                        {viewData.inventory.spotlightTags.map((line) => (
                                            <span key={line.label} className="iks-workplan__volume-tag">
                                                <span className="iks-workplan__volume-tag-label">{line.label}:</span> {line.value}
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>
                            <div className="iks-workplan__inventory-content-grid">
                                <div className="iks-workplan__inventory-summary-list">
                                    {viewData.inventory.metrics.map((metric) => (
                                        <div
                                            key={metric.label}
                                            className={`iks-workplan__summary-row iks-workplan__summary-row--${metric.tone}`}
                                            title={metric.detail || ''}
                                        >
                                            <span className="iks-workplan__summary-label">{metric.label}</span>
                                            <strong className="iks-workplan__summary-value">
                                                {metric.value}
                                                {metric.amount ? <span className="iks-workplan__summary-balance">{metric.amount}</span> : null}
                                            </strong>
                                            {metric.detail ? <small className="iks-workplan__summary-detail">{metric.detail}</small> : null}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>


                    <div className="iks-workplan__arrow" aria-hidden="true">
                        <ArrowRight size={20} />
                    </div>

                    <div className="iks-workplan__plan-group">
                        <div className="iks-workplan__heading">
                            <LayoutGrid size={14} />
                            <span>{viewData.heading}</span>
                            {payload?.as_of && (
                                <span className="iks-workplan__heading-ts">
                                    Data as of: {new Date(payload.as_of).toLocaleString('en-US', { timeZone: 'America/New_York', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })} EST
                                </span>
                            )}
                        </div>

                        <div className="iks-workplan__plan-grid">
                            <div className="iks-workplan__today-card iks-workplan-card">
                                <div className="iks-workplan-card__header">
                                    <div>
                                        <h3>{viewData.today.title}</h3>
                                        <p>{viewData.today.subtitle}</p>
                                    </div>
                                    <span className="iks-workplan-card__badge">{viewData.today.badge}</span>
                                </div>
                                <div className="iks-workplan__today-body">
                                    <div className="iks-workplan__ring-block">
                                        <ProgressRing value={viewData.today.progress} />
                                    </div>
                                    <div className="iks-workplan__today-stats">
                                        <div className="iks-workplan__today-kpis">
                                            <div className="iks-workplan__kv">
                                                <span>{viewData.today.primaryLabel}</span>
                                                <strong>{viewData.today.primaryValue}</strong>
                                            </div>
                                            <div className="iks-workplan__kv">
                                                <span>{viewData.today.secondaryLabel}</span>
                                                <strong>{viewData.today.secondaryValue}</strong>
                                            </div>
                                        </div>
                                        <div className="iks-workplan__bucket-list">
                                            {viewData.today.buckets.map((bucket) => (
                                                <div key={bucket.label} className={`iks-workplan__bucket iks-workplan__bucket--${bucket.tone}`}>
                                                    <div className="iks-workplan__bucket-copy">
                                                        <span>{bucket.label}</span>
                                                        <small>{bucket.meta}</small>
                                                    </div>
                                                    <strong>{bucket.value}</strong>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="iks-workplan__later-card iks-workplan-card iks-workplan-card--expanded">
                                <div className="iks-workplan__later-backdrop" aria-hidden="true" />
                                <div className="iks-workplan-card__header">
                                    <div>
                                        <h3>{viewData.later.title}</h3>
                                        <p>{viewData.later.subtitle}</p>
                                    </div>
                                </div>
                                <div className="iks-workplan__later-volume-label">{viewData.later.volumeLabel}</div>
                                <div className="iks-workplan__later-volume">{viewData.later.backlog}</div>
                                <div className="iks-workplan__later-ittt">
                                    <span>{viewData.later.itttDate.label}</span>
                                    <strong>{viewData.later.itttDate.value}</strong>
                                    <small>{viewData.later.itttDate.detail}</small>
                                    {viewData.later.itttDate.linkLabel && typeof onOpenCalendarView === 'function' ? (
                                        <button
                                            type="button"
                                            className="iks-workplan__later-link"
                                            onClick={handleOpenCalendarView}
                                        >
                                            {viewData.later.itttDate.linkLabel}
                                        </button>
                                    ) : viewData.later.itttDate.linkLabel ? (
                                        <a
                                            className="iks-workplan__later-link"
                                            href={viewData.later.itttDate.linkHref}
                                            target="_blank"
                                            rel="noreferrer"
                                        >
                                            {viewData.later.itttDate.linkLabel}
                                        </a>
                                    ) : null}
                                </div>
                            <div className="iks-workplan__later-list">
                                {viewData.later.items.map((item) => (
                                    <div key={item.label} className="iks-workplan__later-item">
                                        <div className="iks-workplan__later-copy">
                                            <span>{item.label}</span>
                                                <small>{item.detail}</small>
                                            </div>
                                            <div className="iks-workplan__later-value-stack">
                                                <strong className={item.tone === 'muted' ? 'muted' : ''}>{item.value}</strong>
                                                <span className="iks-workplan__later-flag">{item.flag}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <div className="iks-workplan__about-card iks-workplan__about-card--compact">
                                    <div className="iks-workplan__about-title">{viewData.aboutKpis.title}</div>
                                    <p>{viewData.aboutKpis.text}</p>
                                </div>
                            </div>

                            <div className="iks-workplan__worked-card iks-workplan-card">
                                <div className="iks-workplan__worked-section">
                                    <div className="iks-workplan__section-title">{viewData.breakdown.title}</div>
                                    <div className="iks-workplan__inventory-breakdown-grid iks-workplan__inventory-breakdown-grid--hero">
                                        <BreakdownDonut title="By Age" items={viewData.breakdown.age} />
                                        <BreakdownDonut title="By Propensity" items={viewData.breakdown.propensity} />
                                    </div>
                                </div>
                                <div className="iks-workplan__worked-section">
                                    <div className="iks-workplan__section-title">{viewData.workedStatus.title}</div>
                                <div className="iks-workplan__worked-grid">
                                    {viewData.workedStatus.cards.map((card) => (
                                        <div key={card.label} className="iks-workplan__worked-pill">
                                            <span>{card.label}</span>
                                            <strong>{card.value}</strong>
                                            <small>{card.share}</small>
                                        </div>
                                    ))}
                                </div>
                                <div className="iks-workplan__worked-breakdown">
                                    {viewData.workedStatus.breakdown.map((item) => (
                                        <div key={item.label} className="iks-workplan__worked-breakdown-card">
                                            <span>{item.label}</span>
                                            <strong>{item.value}</strong>
                                            <small>{item.share}</small>
                                        </div>
                                    ))}
                                </div>
                                <div className="iks-workplan__worked-footnote">{viewData.workedStatus.footnote}</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="iks-workplan__main-trend-row">
                <div className="iks-workplan-card iks-workplan__main-trend-card">
                    <div className="iks-workplan-card__header">
                        <div className="iks-workplan__trend-title-box">
                            <div className="iks-workplan__trend-icon"><Activity size={18} /></div>
                            <div>
                                <h3>Actionable Claims Trend</h3>
                                <p>Historical visibility of Denials and NPNR buckets by period</p>
                            </div>
                        </div>
                        <div className="iks-workplan__granularity-switcher">
                            {['day', 'week', 'month', 'quarter', 'year'].map((g) => (
                                <button
                                    key={g}
                                    type="button"
                                    className={granularity === g ? 'active' : ''}
                                    onClick={() => setGranularity(g)}
                                >
                                    {g.charAt(0).toUpperCase() + g.slice(1)}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="iks-workplan__trend-chart-box">
                        <div className="iks-workplan__trend-overlay">
                            <div className="iks-workplan__trend-overlay-header">
                                <span className="iks-workplan__trend-overlay-title">AR Balance Trends</span>
                            </div>
                            <div className="iks-workplan__trend-overlay-grid">
                                {viewData.inventory.cadence.map((item) => {
                                    const trendValue = Number(item.trend)
                                    const hasTrend = hasTrendValue(item.trend)
                                    return (
                                        <div key={item.label} className="iks-workplan__trend-overlay-card">
                                            <span className="iks-workplan__trend-overlay-label">{item.label}</span>
                                            <strong className="iks-workplan__trend-overlay-value">{item.value}</strong>
                                            <div className="iks-workplan__trend-overlay-meta">
                                                {hasTrend ? (
                                                    <span className={`iks-workplan__trend-overlay-trend ${trendValue >= 0 ? 'is-up' : 'is-down'}`}>
                                                        {trendValue >= 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                                                        {Math.abs(trendValue).toFixed(1)}%
                                                    </span>
                                                ) : (
                                                    <span className="iks-workplan__trend-overlay-trend is-flat">No change</span>
                                                )}
                                                <small className="iks-workplan__trend-overlay-detail">{item.detail}</small>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                        <ResponsiveContainer width="100%" height={260}>
                            <AreaChart data={displayTrendData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#68eeff" stopOpacity={0.3}/>
                                        <stop offset="95%" stopColor="#68eeff" stopOpacity={0}/>
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                                <XAxis
                                    dataKey="period"
                                    stroke="rgba(255,255,255,0.4)"
                                    fontSize={10}
                                    tickLine={false}
                                    axisLine={false}
                                    tickFormatter={(str) => {
                                        if (!str) return '';
                                        try {
                                            if (granularity === 'day') return str.slice(8, 10);
                                            const date = new Date(str + (str.length === 10 ? 'T00:00:00' : ''));
                                            if (isNaN(date.getTime())) return str;
                                            if (granularity === 'month') return date.toLocaleDateString('en-US', { month: 'short' });
                                            if (granularity === 'quarter') {
                                                const q = Math.floor(date.getMonth() / 3) + 1;
                                                return `Q${q}`;
                                            }
                                            if (granularity === 'year') return date.getFullYear().toString();
                                            return str.slice(0, 10);
                                        } catch (e) {
                                            return str;
                                        }
                                    }}
                                />
                                <YAxis
                                    stroke="rgba(255,255,255,0.4)"
                                    fontSize={10}
                                    tickLine={false}
                                    axisLine={false}
                                    tickFormatter={(val) => formatClaimPool(val)}
                                />
                                <Tooltip
                                    contentStyle={{ backgroundColor: 'rgba(30, 41, 59, 0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', fontSize: '12px' }}
                                    itemStyle={{ color: '#fff' }}
                                />
                                <Area
                                    type="monotone"
                                    dataKey="count"
                                    stroke="#68eeff"
                                    strokeWidth={3}
                                    fillOpacity={1}
                                    fill="url(#colorCount)"
                                    animationDuration={1500}
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            <div className="iks-workplan__trend-grid">
                <div className={`iks-workplan-card iks-workplan__trend-card ${collapsedPanels.freshness ? 'is-collapsed' : ''}`}>
                    <div className="iks-workplan-card__header">
                        <div>
                            <h3>{viewData.freshness.title}</h3>
                            <p>{viewData.freshness.subtitle}</p>
                        </div>
                        <button
                            type="button"
                            className={`iks-workplan__panel-toggle ${collapsedPanels.freshness ? 'is-collapsed' : ''}`}
                            onClick={() => togglePanel('freshness')}
                            aria-expanded={!collapsedPanels.freshness}
                        >
                            <span>{collapsedPanels.freshness ? 'Expand' : 'Collapse'}</span>
                            <ChevronDown size={16} />
                        </button>
                    </div>
                    {!collapsedPanels.freshness && (
                        <>
                            <div className="iks-workplan__trend-insight">{viewData.freshness.insight}</div>
                            <div className="iks-workplan__signal-strip">
                                {viewData.freshness.signals.map((signal) => (
                                    <div
                                        key={signal.label}
                                        className={`iks-workplan__signal-card iks-workplan__signal-card--${signal.tone}`}
                                    >
                                        <span>{signal.label}</span>
                                        <strong>{signal.value}</strong>
                                        <small>{signal.detail}</small>
                                    </div>
                                ))}
                            </div>
                            <div className="iks-workplan__freshness-list">
                                {viewData.freshness.openBuckets.map((bucket) => (
                                    <FreshnessBucketRow key={bucket.bucket} bucket={bucket} />
                                ))}
                            </div>
                        </>
                    )}
                </div>

                <div className={`iks-workplan-card iks-workplan__denial-card ${collapsedPanels.denialShift ? 'is-collapsed' : ''}`}>
                    <div className="iks-workplan-card__header">
                        <div>
                            <h3>{viewData.denialShift.title}</h3>
                            <p>{viewData.denialShift.subtitle}</p>
                        </div>
                        <button
                            type="button"
                            className={`iks-workplan__panel-toggle ${collapsedPanels.denialShift ? 'is-collapsed' : ''}`}
                            onClick={() => togglePanel('denialShift')}
                            aria-expanded={!collapsedPanels.denialShift}
                        >
                            <span>{collapsedPanels.denialShift ? 'Expand' : 'Collapse'}</span>
                            <ChevronDown size={16} />
                        </button>
                    </div>
                    {!collapsedPanels.denialShift && (
                        <>
                            <div className="iks-workplan__denial-headline">{viewData.denialShift.headline}</div>
	                            <div className="iks-workplan__signal-strip iks-workplan__signal-strip--tight">
	                                {viewData.denialShift.highlights.map((highlight) => (
	                                    <div
	                                        key={highlight.label}
                                        className={`iks-workplan__signal-card iks-workplan__signal-card--${highlight.tone}`}
                                    >
                                        <span>{highlight.label}</span>
                                        <strong>{highlight.value}</strong>
                                        <small>{highlight.detail}</small>
	                                    </div>
	                                ))}
	                            </div>
	                            {viewData.denialShift.note ? (
	                                <div className="iks-workplan__denial-note">{viewData.denialShift.note}</div>
	                            ) : null}
	                            <div className="iks-workplan__denial-list">
                                {viewData.denialShift.rows.length > 0 ? viewData.denialShift.rows.map((row) => (
                                    <DenialShiftRow key={row.code} row={row} />
                                )) : (
                                    <div className="iks-workplan__denial-empty">No posted denial-code pattern found for the current scope.</div>
                                )}
                            </div>
                        </>
                    )}
                </div>
            </div>

            <div className="iks-workplan__bottom">
                <div className="iks-workplan__side-stack">
                    <div className="iks-workplan-card iks-workplan__notes-card">
                        <div className="iks-workplan-section__title">
                            <FileText size={14} />
                            <span>{viewData.notes.title}</span>
                        </div>
                        <div className="iks-workplan__note-box">{viewData.notes.placeholder}</div>
                    </div>

                    <div className="iks-workplan-card iks-workplan__protocol-card">
                        <div className="iks-workplan-section__title">
                            <ListTodo size={14} />
                            <span>{viewData.protocol.title}</span>
                        </div>
                        <div className="iks-workplan__protocol-list">
                            {viewData.protocol.items.map((item) => (
                                <div key={item.tag} className="iks-workplan__protocol-item">
                                    <span className="iks-workplan__protocol-tag">{item.tag}</span>
                                    <div className="iks-workplan__protocol-copy">
                                        <p>{item.text}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="iks-workplan-card iks-workplan__table-card">
                    <div className="iks-workplan-card__header">
                        <div>
                            <h3>{viewData.npnr.title}</h3>
                            <p>{viewData.npnr.subtitle}</p>
                        </div>
                        <div className="iks-workplan__table-source">
                            <span>{viewData.npnr.sourceLabel}</span>
                        </div>
                    </div>

                    <div className="iks-workplan__npnr-summary-grid">
                        {viewData.npnr.summaryCards.map((card) => (
                            <div key={card.label} className="iks-workplan__npnr-summary-card">
                                <span>{card.label}</span>
                                <strong>{card.value}</strong>
                            </div>
                        ))}
                    </div>

                    {npnrEntityRows.length > 0 ? (
                        <div className="iks-workplan__entity-strip">
                            {npnrEntityRows.map((entity) => (
                                <div key={entity.entity} className="iks-workplan__entity-chip">
                                    <span>{entity.entity_label}</span>
                                    <strong>{formatNumber(entity.claim_count)}</strong>
                                    <small>
                                        {formatNumber(entity.unique_payers || 0)} payers • {formatCurrencyCompact(entity.total_amount || 0)}
                                    </small>
                                </div>
                            ))}
                            {npnrDetail?.summary?.patient_responsibility?.count > 0 && (
                                <div className="iks-workplan__entity-chip iks-workplan__entity-chip--patient-resp">
                                    <span>{npnrDetail.summary.patient_responsibility.label || 'Patient Responsibility'}</span>
                                    <strong>{formatNumber(npnrDetail.summary.patient_responsibility.count)}</strong>
                                    <small>
                                        Excluded from NPNR • {formatCurrencyCompact(npnrDetail.summary.patient_responsibility.amount || 0)}
                                    </small>
                                </div>
                            )}
                        </div>
                    ) : null}

                    <div className="iks-workplan__npnr-controls">
                        <input
                            type="text"
                            className="iks-workplan__npnr-search"
                            placeholder="Search encounter, payer, subgroup, or class"
                            value={npnrSearch}
                            onChange={(event) => {
                                setNpnrSearch(event.target.value)
                                setNpnrPage(1)
                            }}
                        />
                        <select
                            className="iks-workplan__npnr-select"
                            value={npnrEntityFilter}
                            onChange={(event) => {
                                setNpnrEntityFilter(event.target.value)
                                setNpnrPage(1)
                            }}
                        >
                            <option value="">All Entities</option>
                            {npnrEntityRows.map((entity) => (
                                <option key={entity.entity} value={entity.entity}>
                                    {entity.entity_label}
                                </option>
                            ))}
                        </select>
                        <select
                            className="iks-workplan__npnr-select"
                            value={npnrBalanceFilter}
                            onChange={(event) => {
                                setNpnrBalanceFilter(event.target.value)
                                setNpnrPage(1)
                            }}
                        >
                            <option value="open">Open Balance Only</option>
                            <option value="zero">Zero Balance Only</option>
                        </select>
                    </div>

                    {npnrDetailError ? (
                        <div className="iks-workplan__error" style={{ marginTop: '12px' }}>{npnrDetailError}</div>
                    ) : null}

        <div className="iks-workplan-table">
            <div className="iks-workplan-table__header iks-workplan-table__header--detail">
                <span>Payer Detail</span>
                <span>Financial Class</span>
                <span>Responsible Entity</span>
                <span>Last Bill</span>
                <span className="iks-workplan-table__header-cell--numeric">Avg Pay Date</span>
                <span className="iks-workplan-table__header-cell--numeric">Claim Age</span>
                <span className="iks-workplan-table__header-cell--numeric iks-workplan-table__header-cell--amount">Amount</span>
            </div>
                        <div className="iks-workplan-table__body">
                            {npnrDetailLoading && !npnrRecords.length ? (
                                <div className="iks-workplan-table__empty">Loading live NPNR detail...</div>
                            ) : null}
                            {!npnrDetailLoading && npnrRecords.length > 0 ? npnrRecords.map((record) => (
                                <NpnrDetailRow
                                    key={`${record.payer_name || record.encounter_number}-${record.responsible_entity || 0}-${record.count || 0}`}
                                    record={record}
                                />
                            )) : null}
                            {!npnrDetailLoading && !npnrRecords.length ? (
                                <div className="iks-workplan-table__empty">
                                    No NPNR detail rows found for the current filters{npnrBalanceFilter === 'zero' ? ' in the zero-balance view' : ''}.
                                </div>
                            ) : null}
                        </div>
                    </div>

                    {Number(npnrDetail?.total_pages || 0) > 1 ? (
                        <div className="iks-workplan__pagination">
                            <button
                                type="button"
                                disabled={npnrPage <= 1}
                                onClick={() => setNpnrPage((current) => Math.max(1, current - 1))}
                            >
                                Prev
                            </button>
                            <span>
                                Page {npnrDetail?.page || npnrPage} of {npnrDetail?.total_pages || 1}
                                {' '}({formatNumber(npnrDetail?.total_records || 0)} records)
                            </span>
                            <button
                                type="button"
                                disabled={npnrPage >= Number(npnrDetail?.total_pages || 1)}
                                onClick={() => setNpnrPage((current) => current + 1)}
                            >
                                Next
                            </button>
                        </div>
                    ) : null}
                </div>
            </div>
        </section>
    )
}
