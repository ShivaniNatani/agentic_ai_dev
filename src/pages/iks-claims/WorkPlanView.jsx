import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowRight, ChevronDown, FileText, LayoutGrid, ListTodo } from 'lucide-react'
import { formatCurrencyCompact, formatNumber } from '../../utils/formatters'
import './WorkPlanView.css'

const formatClaimPool = (value, { plus = false } = {}) => {
    const number = Number(value || 0)
    if (!Number.isFinite(number) || number <= 0) return plus ? '0+' : '0'
    if (number >= 1_000_000) {
        const scaled = number / 1_000_000
        const rounded = scaled >= 10 ? scaled.toFixed(0) : scaled.toFixed(1)
        return `${rounded.replace(/\.0$/, '')}M${plus ? '+' : ''}`
    }
    if (number >= 1_000) {
        const scaled = number / 1_000
        const rounded = scaled >= 10 ? scaled.toFixed(0) : scaled.toFixed(1)
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

const coerceNumber = (...values) => {
    for (const value of values) {
        const number = Number(value)
        if (Number.isFinite(number)) return number
    }
    return 0
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
        volume: '--',
        metrics: [
            { label: 'AR Total', value: '--', tone: 'default' },
            { label: 'Worked Total', value: '--', tone: 'default' },
            { label: 'Worked 45D', value: '--', tone: 'default' },
            { label: 'NPNR', value: '--', tone: 'info' },
            { label: 'Open Balance', value: '--', tone: 'default', fullWidth: true },
        ],
    },
    today: {
        title: 'TODAY',
        badge: 'LIVE',
        subtitle: 'Actionable AR as of today',
        progress: 0,
        primaryLabel: 'Workable',
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
        subtitle: 'Remaining work plan after NPNR',
        volumeLabel: 'Remaining workable claims',
        backlog: '--',
        itttDate: {
            label: 'ITTT Date',
            anchorDate: '',
            value: 'Not scheduled',
            detail: 'Waiting for the next pending prediction date.',
            linkLabel: 'Open detailed calendar view',
            linkHref: '/dashboard/optimix-iks#iks-calendar-panel',
        },
        items: [
            { label: 'Future ITTT Queue', detail: 'Pending ITTT date', value: '--', flag: 'ITTT', tone: 'default' },
            { label: 'Propensity to Pay', detail: 'Pending ITTT date', value: '--', flag: 'PRED', tone: 'default' },
            { label: 'Denial Prediction', detail: 'Pending ITTT date', value: '--', flag: 'PRED', tone: 'muted' },
        ],
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

const mapWorkPlanPayload = (payload, selectedMonth, npnrDetailSummary = null) => {
    if (!payload) return buildFallbackData('Live AR data unavailable.')

    const detailSummary = npnrDetailSummary || {}
    const detailNpnrCount = coerceNumber(detailSummary.total_claims, 0)
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
    const denialsToday = coerceNumber(payload.today?.denials, 0)
    const hasLiveNpnrDetail = npnrDetailSummary !== null && detailSummary.source === 'live_bq'
    const npnrToday = coerceNumber(payload.today?.npnr, arNpnrCount)
    const workableCount = denialsToday + npnrToday
    const workableBalance = coerceNumber(payload.today?.workable_balance, 0)
    const remainingLaterCount = coerceNumber(
        summary.later_workplan_count,
        Math.max(workplanTotalCount - arNpnrCount, 0),
    )
    const remainingLaterBalance = coerceNumber(
        summary.later_workplan_balance,
        Math.max(workplanTotalBalance - arNpnrBalance, 0),
    )
    const futureCount = coerceNumber(payload.later?.future_total_count, 0)
    const futureBalance = coerceNumber(payload.later?.future_total_balance, 0)
    const scopedMonthLabel = selectedMonth ? selectedMonth : 'pending ITTT'
    const nextItttDate = payload.later?.next_ittt_date || ''
    const lastItttDate = payload.later?.last_ittt_date || ''
    const asOfDate = payload.as_of ? String(payload.as_of).slice(0, 10) : ''
    const useAsOfDateForCalendar = asOfDate && (!selectedMonth || asOfDate.startsWith(selectedMonth))
    const calendarAnchorDate = useAsOfDateForCalendar ? asOfDate : (nextItttDate || asOfDate)
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
    const denialShiftData = payload.trends?.denial_shift || {}
    const currentTopReason = denialShiftData.current_top_reason
    const baselineTopReason = denialShiftData.baseline_top_reason
    const emergentReason = denialShiftData.emergent_reason
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

    return {
        heading: 'WORK PLAN',
        inventory: {
            title: 'TOTAL INVENTORY',
            subtitle: 'Work Plan Claims',
            volume: formatCompactCount(workplanTotalCount),
            metrics: [
                { label: 'AR Total', value: `${formatCompactCount(arTotalCount)} / ${formatCurrencyCompact(coerceNumber(summary.ar_total_balance, totalBalance))}`, tone: 'default' },
                { label: 'Worked Total', value: `${formatCompactCount(workedTotalCount)} / ${formatCurrencyCompact(coerceNumber(summary.worked_total_balance, 0))}`, tone: 'default' },
                { label: 'Worked 45D', value: `${formatCompactCount(workedLast45Count)} / ${formatCurrencyCompact(coerceNumber(summary.worked_45d_balance, 0))}`, tone: 'default' },
                { label: 'NPNR', value: `${formatCompactCount(arNpnrCount)} / ${formatCurrencyCompact(arNpnrBalance)}`, tone: 'info' },
                { label: 'Open Balance', value: formatCurrencyCompact(workplanTotalBalance), tone: 'default', fullWidth: true },
            ],
        },
        today: {
            title: 'TODAY',
            badge: 'LIVE',
            subtitle: 'Actionable AR as of today',
            progress: Math.max(0, Math.min(100, Math.round(Number(payload.today?.progress_pct || 0)))),
            primaryLabel: 'Workable',
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
            subtitle: `Remaining work plan after NPNR • ${formatCurrencyCompact(remainingLaterBalance)}`,
            volumeLabel: 'Remaining workable claims',
            backlog: formatCompactCount(remainingLaterCount),
            itttDate: {
                label: 'ITTT Date',
                anchorDate: calendarAnchorDate,
                value: formatItttDate(calendarAnchorDate),
                detail: buildLaterItttDetail(calendarAnchorDate, nextItttDate, lastItttDate),
                linkLabel: `Open ${formatItttDate(calendarAnchorDate)} calendar view`,
                linkHref: '/dashboard/optimix-iks#iks-calendar-panel',
            },
            items: [
                {
                    label: 'Future ITTT Queue',
                    detail: `Scoped to ${scopedMonthLabel}`,
                    value: formatCompactCount(futureCount),
                    flag: 'ITTT',
                    tone: 'default',
                },
                {
                    label: 'Propensity to Pay',
                    detail: `From scheduled queue in ${scopedMonthLabel}`,
                    value: formatCompactCount(payload.later?.propensity_to_pay || 0),
                    flag: 'PRED',
                    tone: 'default',
                },
                {
                    label: 'Denial Prediction',
                    detail: `Future queue risk ${formatCurrencyCompact(futureBalance)}`,
                    value: formatCompactCount(payload.later?.denial_prediction || 0),
                    flag: 'PRED',
                    tone: 'muted',
                },
            ],
        },
        npnr: {
            title: 'NPNR Payer Detail',
            subtitle: 'Live AR NPNR detail using encounter, transaction, payer, and entity joins.',
            sourceLabel: 'Live BQ',
            summaryCards: [
                { label: 'AR NPNR Total', value: formatCompactCount(arNpnrCount) },
                { label: 'Live Detail Rows', value: formatCompactCount(detailNpnrCount) },
                { label: 'Unique Payers', value: formatCompactCount(coerceNumber(detailSummary.unique_payers, 0)) },
                { label: 'Total Amount', value: formatCurrencyCompact(coerceNumber(detailSummary.total_amount, 0)) },
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
            subtitle: 'Open workable inventory today and entry mix versus the trailing baseline',
            insight: dominantBucket
                ? `${dominantBucket.label} carries ${dominantBucket.shareLabel} of today's open workable inventory.`
                : 'Live claim-age pressure will appear here when workable inventory is available.',
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

    const encounter = formatDetailValue(record.encounter_number)
    const personId = formatDetailValue(record.person_id, '')
    const payerName = formatDetailValue(record.payer_name, 'Unknown payer')
    const payerId = formatDetailValue(record.payer_id, '')
    const subgroup1 = formatDetailValue(record.payer_subgrouping, '')
    const subgroup2 = formatDetailValue(record.payer_subgrouping_2, '')
    const financialClass = formatDetailValue(record.financial_class, '')
    const financialClass2 = formatDetailValue(record.financial_class_2, '')
    const lastBillDate = formatDetailValue(record.last_bill_date ? formatItttDate(record.last_bill_date) : null, '')
    const claimAgeLabel = `${formatNumber(record.claim_age_in_days || 0)}d`
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
                        <div className="iks-workplan-table__payer" style={{ fontSize: '15px' }} title={payerName}>
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
                        <div className="nested-cell nested-numeric">Age</div>
                        <div className="nested-cell nested-numeric">Amount</div>
                    </div>
                    <div className="iks-workplan-nested-body">
                        {record.encounters.map(enc => (
                             <div key={`${enc.encounter_number}-${enc.amount}`} className="iks-workplan-nested-row">
                                <div className="nested-cell" title={enc.encounter_number}>{formatDetailValue(enc.encounter_number)}</div>
                                <div className="nested-cell" title={enc.financial_class}>{formatDetailValue(enc.financial_class)}</div>
                                <div className="nested-cell"></div>
                                <div className="nested-cell">{enc.last_bill_date ? formatItttDate(enc.last_bill_date) : 'N/A'}</div>
                                <div className="nested-cell nested-numeric">{Math.round(enc.claim_age_in_days)}d</div>
                                <div className="nested-cell nested-numeric">{formatCurrencyCompact(enc.amount)}</div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </>
    )
}

export default function WorkPlanView({ selectedMonth = '', selectedClient = '', refreshToken = 0, onOpenCalendarView = null }) {
    const [payload, setPayload] = useState(null)
    const [error, setError] = useState('')
    const [isLoading, setIsLoading] = useState(true)
    const hasLoadedRef = useRef(false)
    const [npnrDetail, setNpnrDetail] = useState(null)
    const [npnrDetailError, setNpnrDetailError] = useState('')
    const [npnrDetailLoading, setNpnrDetailLoading] = useState(true)
    const [npnrSearch, setNpnrSearch] = useState('')
    const [npnrPage, setNpnrPage] = useState(1)
    const [npnrEntityFilter, setNpnrEntityFilter] = useState('')
    const [collapsedPanels, setCollapsedPanels] = useState({
        freshness: false,
        denialShift: false,
    })

    useEffect(() => {
        let isActive = true
        let controller = null

        // Reset loaded state on month/client change so we show loading indicator
        hasLoadedRef.current = false

        const loadWorkPlan = () => {
            if (controller) controller.abort()
            controller = new AbortController()

            if (!hasLoadedRef.current) {
                setIsLoading(true)
            }

            const params = new URLSearchParams()
            if (selectedMonth) params.set('month', selectedMonth)
            if (!isAllPhaseSelection(selectedClient)) params.set('phase', selectedClient)
            params.set('refresh', 'true')

            fetch(`/api/optimix/iks/ar-workplan${params.toString() ? `?${params.toString()}` : ''}`, {
                signal: controller.signal,
                cache: 'no-store',
            })
                .then((response) => response.ok ? response.json() : Promise.reject(new Error(`Failed to load AR work plan (${response.status})`)))
                .then((data) => {
                    if (!isActive) return
                    if (data?.error) throw new Error(data.error)
                    hasLoadedRef.current = true
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

        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                loadWorkPlan()
            }
        }

        const handleWindowFocus = () => {
            loadWorkPlan()
        }

        loadWorkPlan()
        document.addEventListener('visibilitychange', handleVisibilityChange)
        window.addEventListener('focus', handleWindowFocus)

        return () => {
            isActive = false
            if (controller) controller.abort()
            document.removeEventListener('visibilitychange', handleVisibilityChange)
            window.removeEventListener('focus', handleWindowFocus)
        }
    }, [selectedMonth, selectedClient, refreshToken])

    useEffect(() => {
        let isActive = true
        const controller = new AbortController()

        setNpnrDetailLoading(true)
        setNpnrDetailError('')

        const params = new URLSearchParams()
        if (npnrSearch.trim()) params.set('search', npnrSearch.trim())
        if (npnrEntityFilter) params.set('entity', npnrEntityFilter)
        if (!isAllPhaseSelection(selectedClient)) params.set('phase', selectedClient)
        params.set('page', String(npnrPage))
        params.set('per_page', '12')

        fetch(`/api/optimix/iks/npnr-data?${params.toString()}`, {
            signal: controller.signal,
            cache: 'no-store',
        })
            .then((response) => response.ok ? response.json() : Promise.reject(new Error(`Failed to load NPNR detail (${response.status})`)))
            .then((data) => {
                if (!isActive) return
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
    }, [npnrSearch, npnrPage, npnrEntityFilter, selectedClient, refreshToken])

    const npnrEntityRows = Array.isArray(npnrDetail?.by_entity) ? npnrDetail.by_entity : []
    const npnrRecords = Array.isArray(npnrDetail?.records) ? npnrDetail.records : []

    const viewData = useMemo(
        () => mapWorkPlanPayload(payload, selectedMonth, npnrDetail?.summary || null),
        [payload, selectedMonth, npnrDetail?.summary],
    )

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
                    <div className="iks-workplan__inventory-card iks-workplan-card">
                        <div className="iks-workplan__eyebrow">
                            <span>{viewData.inventory.title}</span>
                            <span>{viewData.inventory.subtitle}</span>
                        </div>
                    <div className="iks-workplan__inventory-value">
                        <span>{viewData.inventory.volume}</span>
                    </div>
                    <div className="iks-workplan__inventory-metrics">
                        {viewData.inventory.metrics.map((metric) => (
                            <div
                                key={metric.label}
                                className={`iks-workplan__inventory-metric iks-workplan__inventory-metric--${metric.tone}${metric.fullWidth ? ' iks-workplan__inventory-metric--full' : ''}`}
                            >
                                <span>{metric.label}</span>
                                <strong>{metric.value}</strong>
                            </div>
                        ))}
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
                                        <div className="iks-workplan__kv">
                                            <span>{viewData.today.primaryLabel}</span>
                                            <strong>{viewData.today.primaryValue}</strong>
                                        </div>
                                        <div className="iks-workplan__kv">
                                            <span>{viewData.today.secondaryLabel}</span>
                                            <strong>{viewData.today.secondaryValue}</strong>
                                        </div>
                                        <div className="iks-workplan__bucket-list">
                                            {viewData.today.buckets.map((bucket) => (
                                                <div key={bucket.label} className={`iks-workplan__bucket iks-workplan__bucket--${bucket.tone}`}>
                                                    <div>
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

                            <div className="iks-workplan__later-card iks-workplan-card">
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
                                    {typeof onOpenCalendarView === 'function' ? (
                                        <button
                                            type="button"
                                            className="iks-workplan__later-link"
                                            onClick={handleOpenCalendarView}
                                        >
                                            {viewData.later.itttDate.linkLabel}
                                        </button>
                                    ) : (
                                        <a
                                            className="iks-workplan__later-link"
                                            href={viewData.later.itttDate.linkHref}
                                            target="_blank"
                                            rel="noreferrer"
                                        >
                                            {viewData.later.itttDate.linkLabel}
                                        </a>
                                    )}
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
                            </div>
                        </div>
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
                <span className="iks-workplan-table__header-cell--numeric">Claim Age</span>
                <span className="iks-workplan-table__header-cell--numeric iks-workplan-table__header-cell--amount">Amount</span>
            </div>
                        <div className="iks-workplan-table__body">
                            {npnrDetailLoading && !npnrRecords.length ? (
                                <div className="iks-workplan-table__empty">Loading live NPNR detail...</div>
                            ) : null}
                            {!npnrDetailLoading && npnrRecords.length > 0 ? npnrRecords.map((record) => (
                                <NpnrDetailRow
                                    key={`${record.optimix_enc_number || record.ds_enc_number || record.encounter_number}-${record.last_status_code || 'none'}`}
                                    record={record}
                                />
                            )) : null}
                            {!npnrDetailLoading && !npnrRecords.length ? (
                                <div className="iks-workplan-table__empty">No NPNR detail rows found for the current filters.</div>
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
