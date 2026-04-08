import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import {
    ResponsiveContainer,
    LineChart,
    Line,
    BarChart,
    Bar,
    AreaChart,
    Area,
    CartesianGrid,
    XAxis,
    YAxis,
    Tooltip,
    Legend,
    ReferenceLine,
    ScatterChart,
    Scatter,
    ZAxis,
    ComposedChart
} from 'recharts'
import {
    Zap,
    BookOpen,
    MessageSquare,
    Calendar as CalendarIcon,
    BarChart2,
    Search,
    X,
    Filter,
    ArrowLeft,
    ChevronDown,
    ChevronUp,
    Mic
} from 'lucide-react'
import VoiceAssistant from '../components/Voice/VoiceAssistant'
import './OptimixIKSInsights.css'
import IksPersonaSwitcher from './iks-claims/IksPersonaSwitcher'
import OpsManagerExtendedView from './iks-claims/OpsManagerExtendedView'
import SrLeaderView from './iks-claims/SrLeaderView'
import WorkPlanView from './iks-claims/WorkPlanView'
import './iks-claims/IksClaimsPersona.css'

const generateMockDaily = (yearMonth, cutoffDay = 0) => {
    const [y, m] = yearMonth.split('-').map(Number)
    const daysInMonth = new Date(y, m, 0).getDate()
    return Array.from({ length: daysInMonth }, (_, i) => {
        const day = i + 1
        const date = `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`
        const weekDay = new Date(y, m - 1, day).getDay()
        const isWeekend = weekDay === 0 || weekDay === 6
        const base = isWeekend ? 0.3 : 1
        const isDayForecast = cutoffDay > 0 && day > cutoffDay
        return {
            date,
            is_forecast_day: isDayForecast,
            total_prediction: isDayForecast ? 0 : Math.floor((Math.random() * 50000 + 20000) * base),
            total_response: isDayForecast ? 0 : Math.floor((Math.random() * 40000 + 15000) * base),
            total_workable: Math.floor((Math.random() * 4000 + 500) * base),
            ittt_workable: Math.floor((Math.random() * 3000 + 800) * base),
            payment_prediction: Math.floor((Math.random() * 30000 + 10000) * base),
            payment_actual: isDayForecast ? 0 : Math.floor((Math.random() * 28000 + 9000) * base),
            denial_prediction: Math.floor((Math.random() * 5000 + 1000) * base),
            denial_actual: isDayForecast ? 0 : Math.floor((Math.random() * 5500 + 800) * base),
            third_prediction_expired_no_response: Math.floor((Math.random() * 1000 + 100) * base)
        }
    })
}

const generateMockMonth = (yearMonth, label, isForecast, totals, cards, cutoffDay = 0) => ({
    label,
    is_forecast: isForecast,
    totals,
    cards,
    daily: generateMockDaily(yearMonth, cutoffDay)
})

const MOCK_INSIGHTS = {
    available_months: [
        '2026-05', '2026-04', '2026-03', '2026-02', '2026-01', '2025-12'
    ],
    default_month: '2026-02',
    months: {
        '2026-02': generateMockMonth('2026-02', 'Feb 2026', false,
            { Total_Prediction: 1250000, Total_Workable: 45000, Total_Response: 850000 },
            {
                payment: { title: 'Payment Accuracy', prediction: 850000, accuracy_pct: 92.5, accuracy_delta_pct_points: 1.2 },
                denial: { title: 'Denial', prediction: 150000, accuracy_pct: 88.4, accuracy_delta_pct_points: -0.5 },
                ittt: { title: 'ITTT', prediction: 45000, accuracy_pct: 95.1, accuracy_delta_pct_points: 0.8 },
                denial_prevention: { title: 'Appeal', prediction: 25000, accuracy_pct: 91.2, accuracy_delta_pct_points: 2.1 }
            }, 23),
        '2026-01': generateMockMonth('2026-01', 'Jan 2026', false,
            { Total_Prediction: 1180000, Total_Workable: 42000, Total_Response: 810000 },
            {
                payment: { title: 'Payment Accuracy', prediction: 810000, accuracy_pct: 91.8, accuracy_delta_pct_points: 0.5 },
                denial: { title: 'Denial', prediction: 145000, accuracy_pct: 89.1, accuracy_delta_pct_points: 1.0 },
                ittt: { title: 'ITTT', prediction: 42000, accuracy_pct: 94.5, accuracy_delta_pct_points: -0.2 },
                denial_prevention: { title: 'Appeal', prediction: 22000, accuracy_pct: 90.5, accuracy_delta_pct_points: 0.5 }
            }),
        '2025-12': generateMockMonth('2025-12', 'Dec 2025', false,
            { Total_Prediction: 1150000, Total_Workable: 40000, Total_Response: 790000 },
            {
                payment: { title: 'Payment Accuracy', prediction: 790000, accuracy_pct: 90.2, accuracy_delta_pct_points: -0.3 },
                denial: { title: 'Denial', prediction: 140000, accuracy_pct: 87.5, accuracy_delta_pct_points: 0.7 },
                ittt: { title: 'ITTT', prediction: 40000, accuracy_pct: 93.8, accuracy_delta_pct_points: 0.4 },
                denial_prevention: { title: 'Appeal', prediction: 20000, accuracy_pct: 89.0, accuracy_delta_pct_points: -0.1 }
            }),
        '2026-03': generateMockMonth('2026-03', 'Mar 2026', true,
            { Total_Prediction: 1300000, Total_Workable: 48000, Total_Response: 880000 },
            {
                payment: { title: 'Payment Accuracy', prediction: 880000, accuracy_pct: 93.0, accuracy_delta_pct_points: 0.5 },
                denial: { title: 'Denial', prediction: 155000, accuracy_pct: 89.5, accuracy_delta_pct_points: 1.1 },
                ittt: { title: 'ITTT', prediction: 48000, accuracy_pct: 95.5, accuracy_delta_pct_points: 0.4 },
                denial_prevention: { title: 'Appeal', prediction: 27000, accuracy_pct: 91.8, accuracy_delta_pct_points: 0.6 }
            }),
        '2026-04': generateMockMonth('2026-04', 'Apr 2026', true,
            { Total_Prediction: 1280000, Total_Workable: 46000, Total_Response: 860000 },
            {
                payment: { title: 'Payment Accuracy', prediction: 860000, accuracy_pct: 92.8, accuracy_delta_pct_points: -0.2 },
                denial: { title: 'Denial', prediction: 152000, accuracy_pct: 88.9, accuracy_delta_pct_points: -0.6 },
                ittt: { title: 'ITTT', prediction: 46000, accuracy_pct: 94.8, accuracy_delta_pct_points: -0.7 },
                denial_prevention: { title: 'Appeal', prediction: 26000, accuracy_pct: 91.0, accuracy_delta_pct_points: -0.8 }
            }),
        '2026-05': generateMockMonth('2026-05', 'May 2026', true,
            { Total_Prediction: 1350000, Total_Workable: 50000, Total_Response: 900000 },
            {
                payment: { title: 'Payment Accuracy', prediction: 900000, accuracy_pct: 93.5, accuracy_delta_pct_points: 0.7 },
                denial: { title: 'Denial', prediction: 160000, accuracy_pct: 90.0, accuracy_delta_pct_points: 1.1 },
                ittt: { title: 'ITTT', prediction: 50000, accuracy_pct: 96.0, accuracy_delta_pct_points: 1.2 },
                denial_prevention: { title: 'Appeal', prediction: 28000, accuracy_pct: 92.0, accuracy_delta_pct_points: 1.0 }
            })
    }
}

const DAY_LABELS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']
const CARD_ORDER = ['payment', 'denial', 'ittt', 'denial_prevention']
const CARD_ICONS = {
    payment: '💳',
    denial: '🚫',
    ittt: '⏱️',
    denial_prevention: '🛡️'
}
const GIA_PHASE_CLIENT_OPTIONS = [
    'All Phases',
    'Phase 1',
    'Phase 2',
    'Phase 5',
    'Phase 6',
    'Phase 8',
    'Phase 9'
]
const ALL_PHASES_LABEL = 'All Phases'
const ENABLE_IKS_MOCK_FALLBACK = import.meta.env.DEV && String(import.meta.env.VITE_ENABLE_IKS_MOCK_FALLBACK || '').toLowerCase() === 'true'
const IKS_LAST_SUCCESS_STORAGE_KEY = 'optimix-iks-last-success'

const isAllPhaseSelection = (value) => {
    const normalized = String(value || '').trim().toLowerCase()
    return !normalized || normalized === 'all' || normalized === 'all phases' || normalized === 'all clients'
}

const toUiPhaseValue = (value) => (isAllPhaseSelection(value) ? ALL_PHASES_LABEL : String(value || '').trim())

const toUiPhaseOptions = (values) => {
    const specific = Array.from(new Set(
        (Array.isArray(values) ? values : [])
            .map((value) => toUiPhaseValue(value))
            .filter((value) => value && !isAllPhaseSelection(value))
    ))
    return [ALL_PHASES_LABEL, ...specific]
}

const loadStoredInsights = () => {
    if (typeof window === 'undefined') return null
    try {
        const raw = window.sessionStorage.getItem(IKS_LAST_SUCCESS_STORAGE_KEY)
        if (!raw) return null
        const parsed = JSON.parse(raw)
        return parsed && parsed.months ? parsed : null
    } catch {
        return null
    }
}

const storeInsightsSnapshot = (payload) => {
    if (typeof window === 'undefined' || !payload?.months) return
    try {
        window.sessionStorage.setItem(IKS_LAST_SUCCESS_STORAGE_KEY, JSON.stringify(payload))
    } catch {
        // best-effort only
    }
}

const CHATBOT_SUGGESTIONS = [
    'What does ITTT Predicted mean?',
    'Show Total Workable for Feb 2026',
    'Which month has highest workable?',
    'Explain the hover formula',
    'What do the graphs mean?'
]

const ORBIT_QUICK_ACTIONS = [
    { label: '📊 Summarize Month', query: 'Give me a full summary of the current month' },
    { label: '🔍 Flag Anomalies', query: 'Which days have unusual workable spikes or drops?' },
    { label: '📈 Compare Months', query: 'Compare this month accuracy with the previous month' }
]

const SELLING_POINT_ITEMS = [
    {
        title: 'Predictive Operations',
        detail: '12-month workable forecast from trailing behavior to plan before bottlenecks hit.'
    },
    {
        title: 'Explainable Day Logic',
        detail: 'Each calendar day is auditable with formula-level breakdown, not a black-box score.'
    },
    {
        title: 'Outcome Calibration',
        detail: 'Prediction vs actual validation for payment and denial helps catch drift early.'
    }
]

const USER_PLAYBOOK_ITEMS = [
    {
        title: 'Determine Scope',
        icon: <Filter size={18} />,
        text: 'Select Client, Year, and Month to define your analysis window.'
    },
    {
        title: 'Assess KPIs',
        icon: <BarChart2 size={18} />,
        text: 'Review accuracy metrics and trend arrows to spot high-level performance shifts.'
    },
    {
        title: 'Inspect Calendar',
        icon: <CalendarIcon size={18} />,
        text: 'Click on high-intensity days to drill down into specific claim volume drivers.'
    },
    {
        title: 'Validate Trends',
        icon: <Zap size={18} />,
        text: 'Exam charts below to correlate prediction accuracy with actual outcomes.'
    }
]

const METRIC_COLUMNS = [
    { label: 'Total Billed', dayKey: 'total_billed', totalKey: 'Total_Billed', tooltip: 'Total claims billed on that particular day — think of it as the number of invoices we sent to insurance companies today.' },
    { label: 'Total Prediction (ITTT)', dayKey: 'total_prediction', totalKey: 'Total_Prediction', tooltip: 'Total claims which have their ITTT date on that date. The ITTT date is the deadline by which we expect to receive a response from the insurer.' },
    { label: 'ITTT Predicted', dayKey: 'ittt_workable', totalKey: 'ITTT_Workable', tooltip: 'Total claims with their ITTT date on that date — responses are expected to be received by this date. Think of it like a homework due date.' },
    { label: 'Total Response', dayKey: 'total_response', totalKey: 'Total_Response', tooltip: 'Total claims where the responses are received by that date — these are claims where the insurance company actually sent us an answer.' },
    {
        label: 'Third Prediction Expired No Response',
        dayKey: 'third_prediction_expired_no_response',
        totalKey: 'ThirdPredictionExpired_NoResponse',
        tooltip: 'Total claims where no response was received even after 3 predictions — these become workable. Like asking someone 3 times and still getting no answer.'
    },
    { label: 'Payment Prediction', dayKey: 'payment_prediction', totalKey: 'Payment_Prediction', tooltip: 'Total claims predicted to be paid — this is a subset of total ITTT. Our AI thinks these claims will result in payment.' },
    { label: 'Payment Actual', dayKey: 'payment_actual', totalKey: 'Payment_Actual', tooltip: 'Claims actually paid out of the ones we predicted. Comparing this with Payment Prediction shows how accurate our prediction was.' },
    { label: 'Denial Prediction', dayKey: 'denial_prediction', totalKey: 'Denial_Prediction', tooltip: 'Total claims predicted to be denied — this is a subset of total ITTT. Our AI thinks these claims will be rejected by the insurer.' },
    { label: 'Denial Actual', dayKey: 'denial_actual', totalKey: 'Denial_Actual', tooltip: 'Claims actually denied in the selected ITTT cohort. This includes claims we predicted as denial and claims we predicted as payment but that were still denied.' },
    { label: 'Payment But Denied', dayKey: 'payment_but_denied', totalKey: 'Payment_But_Denied', tooltip: 'Claims predicted to be paid, but actually denied. This is a tracked subset of Denial Actual, not an extra denial bucket.' }
]

const formatNumber = (value) => new Intl.NumberFormat('en-US').format(Number(value || 0))

const formatDollar = (value) => {
    const num = Number(value || 0)
    if (num >= 1_000_000) return `$${(num / 1_000_000).toFixed(2)}M`
    if (num >= 1_000) return `$${(num / 1_000).toFixed(1)}K`
    return `$${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

const formatPercent = (value) => {
    if (value === null || value === undefined || Number.isNaN(Number(value))) return 'N/A'
    return `${Number(value).toFixed(2)}%`
}

const formatAxisDate = (dateString) => {
    try {
        const date = new Date(dateString)
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    } catch (error) {
        return dateString
    }
}

const formatCompactDayTick = (value) => {
    if (!value) return ''
    const parsed = new Date(value)
    if (!Number.isNaN(parsed.getTime())) {
        return String(parsed.getDate())
    }
    const parts = String(value).trim().split(' ')
    return parts.length > 1 ? parts[parts.length - 1] : String(value)
}

const splitOpsFlowLabel = (label) => {
    const normalized = String(label || '').trim()
    const overrides = {
        'ITTT Predicted': ['ITTT', 'Predicted'],
        'Responses Received': ['Responses', 'Received'],
        'Total Denials': ['Total', 'Denials']
    }
    if (overrides[normalized]) return overrides[normalized]
    const parts = normalized.split(' ')
    if (parts.length <= 1) return [normalized]
    const midpoint = Math.ceil(parts.length / 2)
    return [parts.slice(0, midpoint).join(' '), parts.slice(midpoint).join(' ')]
}

const formatMonthKeyLabel = (monthKey) => {
    if (!monthKey) return ''
    try {
        const date = new Date(`${monthKey}-01T00:00:00`)
        if (Number.isNaN(date.getTime())) return monthKey
        return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
    } catch (error) {
        return monthKey
    }
}

// Helper to calculate cumulative AR Backlog for a specific day or month
const getCalculatedBacklog = (arBacklogTrend, dateStr, type = 'day') => {
    if (!arBacklogTrend || !Array.isArray(arBacklogTrend) || arBacklogTrend.length === 0) return 0;

    // dateStr example day: '2026-02-04'
    // dateStr example month: '2026-02'
    const targetMonthPrefix = type === 'day' ? dateStr.substring(0, 7) : dateStr;

    // Filter trend to only items in this month
    const monthItems = arBacklogTrend.filter(item => item.date.startsWith(targetMonthPrefix));

    if (type === 'day') {
        // Sum counts for dates up to AND including the selected date
        return monthItems
            .filter(item => item.date <= dateStr)
            .reduce((sum, item) => sum + (item.backlog_count || 0), 0);
    } else {
        // Sum counts for the entire month
        return monthItems.reduce((sum, item) => sum + (item.backlog_count || 0), 0);
    }
}

// Helper to get per-phase breakdown for a specific day or month
const getPhaseBreakdownForDate = (phaseTrend, dateStr, type = 'day') => {
    if (!phaseTrend || typeof phaseTrend !== 'object') return {}
    const result = {}
    const targetMonthPrefix = type === 'day' ? dateStr.substring(0, 7) : dateStr

    for (const [phase, entries] of Object.entries(phaseTrend)) {
        if (!Array.isArray(entries)) continue
        const monthItems = entries.filter(item => item.date.startsWith(targetMonthPrefix))
        const total = type === 'day'
            ? monthItems.filter(item => item.date <= dateStr).reduce((sum, item) => sum + (item.count || 0), 0)
            : monthItems.reduce((sum, item) => sum + (item.count || 0), 0)
        if (total > 0) result[phase] = total
    }
    return result
}

// Helper to calculate cumulative AR Backlog dollar value (Insurance Balance) for a specific day or month
const getCalculatedBacklogBalance = (arBacklogTrend, dateStr, type = 'day') => {
    if (!arBacklogTrend || !Array.isArray(arBacklogTrend) || arBacklogTrend.length === 0) return 0
    const targetMonthPrefix = type === 'day' ? dateStr.substring(0, 7) : dateStr
    const monthItems = arBacklogTrend.filter(item => item.date.startsWith(targetMonthPrefix))
    if (type === 'day') {
        return monthItems
            .filter(item => item.date <= dateStr)
            .reduce((sum, item) => sum + (item.backlog_balance || 0), 0)
    }
    return monthItems.reduce((sum, item) => sum + (item.backlog_balance || 0), 0)
}

const getTrendClass = (delta) => {
    if (delta === null || delta === undefined) return ''
    if (delta > 0) return 'positive'
    if (delta < 0) return 'negative'
    return ''
}

const getTrendArrow = (delta) => {
    if (delta === null || delta === undefined) return ''
    if (delta > 0) return '↑'
    if (delta < 0) return '↓'
    return '→'
}

const MONTH_TOKEN_MAP = {
    jan: '01',
    january: '01',
    feb: '02',
    february: '02',
    mar: '03',
    march: '03',
    apr: '04',
    april: '04',
    may: '05',
    jun: '06',
    june: '06',
    jul: '07',
    july: '07',
    aug: '08',
    august: '08',
    sep: '09',
    sept: '09',
    september: '09',
    oct: '10',
    october: '10',
    nov: '11',
    november: '11',
    dec: '12',
    december: '12'
}



const getWorkableFormulaParts = (row) => {
    const thirdExpired = Number(
        row?.third_prediction_expired_no_response
        ?? row?.ThirdPredictionExpired_NoResponse
        ?? 0
    )
    const denialActual = Number(
        row?.denial_actual
        ?? row?.Denial_Actual
        ?? 0
    )
    const paymentPrediction = Number(
        row?.payment_prediction
        ?? row?.Payment_Prediction
        ?? 0
    )
    const paymentActual = Number(
        row?.payment_actual
        ?? row?.Payment_Actual
        ?? 0
    )
    const paymentButDenied = Number(
        row?.payment_but_denied
        ?? row?.Payment_But_Denied
        ?? 0
    )
    const paymentGap = paymentPrediction - paymentActual
    const actionableResult = thirdExpired + denialActual
    const rawTotal = row?.total_workable ?? row?.Total_Workable
    const liveTotal = rawTotal === null || rawTotal === undefined || rawTotal === ''
        ? null
        : Number(rawTotal)
    const result = liveTotal ?? actionableResult

    return {
        thirdExpired,
        denialActual,
        paymentPrediction,
        paymentActual,
        paymentGap,
        paymentButDenied,
        actionableResult,
        result,
        liveTotal
    }
}

const getDisplayedWorkableValue = (row) => getWorkableFormulaParts(row).result

// --- Restored Logic: Yearly Forecast Aggregation ---
const calculateYearlyForecast = (monthsData) => {
    // Logic to aggregate monthly data into a yearly view
    const totals = {
        Total_Prediction: 0,
        Total_Workable: 0,
        Total_Response: 0
    }
    Object.values(monthsData).forEach(month => {
        if (month.totals) {
            totals.Total_Prediction += month.totals.Total_Prediction || 0
            totals.Total_Workable += getDisplayedWorkableValue(month.totals)
            totals.Total_Response += month.totals.Total_Response || 0
        }
    })
    return totals
}

// --- Restored Logic: Excel Fallback Stub ---
const loadExcelFallback = async () => {
    console.warn('Attempting to load fallback Excel data...')
    // In a real implementation, this would fetch a local .xlsx file
    // For now, it returns the detailed mock data structure which mimics the Excel sheet
    return MOCK_INSIGHTS
}

const getMonthBacklogCount = (arBacklog) => Number(arBacklog?.ar_backlog_count || 0)
const getMonthBacklogBalance = (arBacklog) => Number(arBacklog?.ar_backlog_balance || 0)

const buildWorkableFormulaTooltip = (row) => {
    const parts = getWorkableFormulaParts(row)
    return [
        'Business Reference Formula:',
        `${parts.thirdExpired} (Third Prediction Expired No Response)`,
        `+ ${parts.denialActual} (Denial Actual)`,
        `+ (${parts.paymentPrediction} - ${parts.paymentActual}) = ${parts.paymentGap} (Payment Pred - Payment Actual)`,
        `= ${parts.result}`,
        '',
        `Live SQL-backed workable on dashboard: ${parts.liveTotal}`,
        `Tracked separately: ${parts.paymentButDenied} Payment But Denied`
    ].join('\n')
}

const pickMonthKeyFromQuery = (question, monthKeys, fallbackMonth) => {
    const text = String(question || '').toLowerCase()
    const yearMatch = text.match(/\b(20\d{2})\b/)
    const year = yearMatch ? yearMatch[1] : null

    let monthNum = null
    for (const [token, value] of Object.entries(MONTH_TOKEN_MAP)) {
        if (text.includes(token)) {
            monthNum = value
            break
        }
    }

    if (year && monthNum) {
        const key = `${year}-${monthNum}`
        if (monthKeys.includes(key)) return key
    }

    if (monthNum) {
        const withMonth = monthKeys.find((key) => key.endsWith(`-${monthNum}`))
        if (withMonth) return withMonth
    }

    if (year) {
        const withYear = monthKeys.find((key) => key.startsWith(`${year}-`))
        if (withYear) return withYear
    }

    return fallbackMonth
}

const generateChatbotReply = ({
    question,
    insights,
    selectedMonth,
    selectedMonthData,
    selectedDayData
}) => {
    const text = String(question || '').trim()
    const q = text.toLowerCase()
    if (!text) return 'Please type a question so I can help.'

    const monthKeys = insights?.available_months || []
    const monthKey = pickMonthKeyFromQuery(q, monthKeys, selectedMonth)
    const monthData = insights?.months?.[monthKey]
    const monthLabel = monthData?.label || formatMonthKeyLabel(monthKey)

    // --- Greeting & general help ---
    if (q.includes('hello') || q.includes('hi') || q === 'hey' || q.includes('help')) {
        return 'Hi! 👋 I can answer questions about this dashboard. Try asking:\n• "What is Total Workable?"\n• "Show me accuracy for this month"\n• "What does the formula mean?"\n• "Show billed for Feb 2026"\n• "Which month had the most work?"\n• "What is ITTT?"\n• "Explain the KPI cards"\n• "What does the calendar show?"'
    }

    // --- What is this dashboard ---
    if ((q.includes('what') && q.includes('dashboard')) || q.includes('purpose') || q.includes('about this')) {
        return 'This dashboard tracks insurance claims — requests sent to insurance companies to pay for medical services. It shows how many claims were sent, what our AI predicted would happen, and what actually happened. The goal is to identify which claims need follow-up action.'
    }

    // --- What is ITTT ---
    if (q.includes('ittt')) {
        return 'ITTT stands for the expected response deadline — the date by which we expect the insurance company (payer) to respond to a claim.\n\n• Total Prediction (ITTT) = Total claims with their ITTT date on that day\n• Payment Prediction = Claims predicted to be paid (subset of total ITTT)\n• Denial Prediction = Claims predicted to be denied (subset of total ITTT)\n• The "ITTT" KPI card shows overall prediction accuracy for these claims.\n\nThink of ITTT like a homework due date — it tells us when answers should arrive.'
    }

    // --- KPI cards explanation ---
    if (q.includes('kpi') || (q.includes('card') && (q.includes('top') || q.includes('show') || q.includes('mean') || q.includes('explain')))) {
        return 'The 4 cards at the top are scorecards:\n• Payment Accuracy — how often our AI correctly predicts a claim will be paid\n• Denial — how well we spot claims that will be rejected\n• ITTT — overall prediction accuracy for the ITTT client\n• Appeal — claims being re-submitted after denial\n\nHigher accuracy % = our predictions are more reliable. The arrow (↑/↓) shows change vs last month.'
    }

    // --- Formula / calculation / hover ---
    if (q.includes('formula') || q.includes('hover') || q.includes('calculation') || q.includes('how is it calculated')) {
        return 'The actionable workable logic shown in the UI is:\n\n🔧 Total Workable = ⏰ Third Prediction Expired No Response + ❌ Denial Actual\n\nThis matches the live SQL-backed actionable count used in the ops flow.'
    }

    // --- Graph / chart explanation ---
    if (q.includes('graph') || q.includes('chart') || q.includes('trend')) {
        return 'The charts at the bottom show how things change over time:\n\n📈 Prediction vs Response — compares how many claims we sent vs how many answers we got. A big gap means many claims are still unanswered.\n\n💰 Payment & Denial Outcomes — shows actual money received vs claims rejected each day. Helps you tell if collections are healthy.\n\n📊 Workable Trend — shows how many claims need follow-up. Rising line = growing backlog.'
    }

    // --- Calendar explanation ---
    if (q.includes('calendar') || (q.includes('what') && q.includes('month'))) {
        return 'The calendar shows your daily work queue — how many claims need follow-up each day. Click any day to see its detailed breakdown on the right. Color intensity shows how busy each day is — darker = more work.'
    }

    // --- Where to start ---
    if (q.includes('where') && (q.includes('start') || q.includes('explore') || q.includes('begin'))) {
        return 'Here\'s how to explore this dashboard:\n1️⃣ Check the KPI cards at top — are accuracy percentages going up or down?\n2️⃣ Pick a month from the calendar — click any day to see details\n3️⃣ Look at the Day Snapshot — it shows exactly what happened that day\n4️⃣ Scroll down to charts — look for gaps between predictions and actual results\n5️⃣ Check Total Workable — lower is better (fewer claims need follow-up)'
    }

    // --- Total Billed query ---
    if ((q.includes('total billed') || q.includes('billed')) && monthData) {
        return 'Total Billed is not part of the current IKS source set, so this view ignores it and focuses on ITTT volume, responses, denials, NPNR, workable, and AR backlog.'
    }

    // --- Total Workable for month ---
    if ((q.includes('total workable') || q.includes('workable')) && monthData && (q.includes('for') || q.includes('month'))) {
        return `🔧 Total Workable for ${monthLabel}: ${formatNumber(getDisplayedWorkableValue(monthData?.totals))} claims need a person to take follow-up action.`
    }

    // --- Highest workable month ---
    if (q.includes('highest') && q.includes('workable')) {
        const monthEntries = Object.entries(insights?.months || {})
        if (!monthEntries.length) return 'No month data is available yet.'

        const top = monthEntries.reduce((best, [key, value]) => {
            const workable = getDisplayedWorkableValue(value?.totals)
            if (!best || workable > best.workable) {
                return { key, workable, label: value?.label || formatMonthKeyLabel(key) }
            }
            return best
        }, null)

        return `📊 The busiest month was ${top.label} with ${formatNumber(top.workable)} claims needing follow-up — that\'s the highest Total Workable across all months.`
    }

    // --- Accuracy ---
    if (q.includes('accuracy') || q.includes('accurate') || q.includes('score')) {
        const cards = selectedMonthData?.cards || {}
        return `📊 Accuracy for ${selectedMonthData?.label || formatMonthKeyLabel(selectedMonth)}:\n• Payment Accuracy: ${formatPercent(cards?.payment?.accuracy_pct)} — how often AI correctly predicts payments\n• Denial Accuracy: ${formatPercent(cards?.denial?.accuracy_pct)} — how well AI spots rejections\n• ITTT Overall: ${formatPercent(cards?.ittt?.accuracy_pct)} — the ITTT client\'s overall prediction accuracy\n• Appeal: ${formatPercent(cards?.denial_prevention?.accuracy_pct)} — success rate on re-submitted claims`
    }

    // --- Day snapshot ---
    if (q.includes('day') || q.includes('today') || q.includes('snapshot') || q.includes('selected date')) {
        if (!selectedDayData) {
            return 'No day is selected yet. Click any day on the calendar to see its snapshot — it will show exactly how many claims were billed, responded to, and need follow-up.'
        }
        return `📅 Day Snapshot for ${formatAxisDate(selectedDayData.date)}:\n• ITTT Predicted: ${formatNumber(selectedDayData.total_prediction)}\n• Responses Received: ${formatNumber(selectedDayData.total_response)}\n• Follow-up Tasks: ${formatNumber(selectedDayData.total_workable)}\n\nThis means ${formatNumber(selectedDayData.total_workable)} claims still need someone to take action.`
    }

    // --- AR Backlog ---
    if (q.includes('backlog') || q.includes('ar ') || q.includes('pending')) {
        return 'AR Workable Backlog is the list of claims from past days that still need follow-up. Think of it as your "to-do list" — claims that piled up and haven\'t been resolved yet. The phase breakdown below it shows which client phases have the most pending items.'
    }

    // --- Phase ---
    if (q.includes('phase') || q.includes('client')) {
        return 'Phases represent different groups of claims (like different departments or business units). You can use the "Client" dropdown at the top to filter the dashboard by phase. The AR Backlog section also shows a per-phase breakdown so you can see which phase has the most work.'
    }

    // --- Pipeline ---
    if (q.includes('pipeline') || q.includes('operations')) {
        return 'The Operations Pipeline shows the journey of claims through stages:\n• INCOMING — total claims received today\n• DUE TODAY — claims where a response was expected today\n• RESOLVED — claims that got resolved (paid or denied)\n• BACKLOG — claims that still need follow-up action\n\nIf BACKLOG keeps growing, it means workload is piling up faster than it\'s being handled.'
    }

    // --- Denial appeal ---
    if (q.includes('denial appeal') || q.includes('appeal a denial') || q.includes('appeal')) {
        return 'An appeal is when we ask the insurance company to reconsider a denied claim. We submit more evidence or correct errors. The "Appeal" KPI card shows how successful our appeals are — higher accuracy means more overturned denials, which means more money recovered.'
    }

    // --- Denial + ITTT ---
    if (q.includes('denial') && q.includes('ittt')) {
        return 'When we talk about denials in the ITTT context, we mean claims from the ITTT client that were rejected by their insurance payers. Our AI tries to predict these denials early so we can fix issues before the rejection happens — saving time and money.'
    }

    // --- Denial general ---
    if (q.includes('denial') || q.includes('denied') || q.includes('rejected')) {
        return 'A denial means an insurance company refused to pay a claim. The "Denial Prediction" shows what our AI thinks will be rejected, and "Denial Actual" shows what was truly rejected. If our prediction is close to actual, our AI is working well.'
    }

    // --- Payment ---
    if (q.includes('payment') || q.includes('paid')) {
        return 'Payment means an insurance company approved and paid a claim. "Payment Prediction" is our AI\'s guess for which claims will be paid, and "Payment Actual" is real payment received. Comparing these two tells us how reliable our AI\'s payment forecasts are.'
    }

    // --- What do these terms mean ---
    if (q.includes('what') && (q.includes('mean') || q.includes('definition') || q.includes('terms'))) {
        return 'Here are the official definitions:\n• ITTT Date = Total claims which have their ITTT date on that date (responses to be received by that date)\n• Total Response = Total claims where the responses are received by that date\n• Third Prediction Expired No Response = Total claims where no response was received — these become workable\n• Payment Prediction = Total claims predicted to be paid, as a subset of total ITTT\n• Payment Actual = Claims actually paid out of predicted\n• Denial Prediction = Total claims predicted to be denied, as a subset of total ITTT\n• Denial Actual = Claims actually denied in the ITTT cohort\n• Payment But Denied = Claims predicted as Payment but actually resulted in a denial\n• Actionable workable shown in UI = Third Prediction Expired No Response + Denial Actual'
    }

    // --- Total Workable explanation ---
    if (q.includes('total workable') || q.includes('workable formula') || q.includes('workable')) {
        return '🔧 UI formula: claims with expired no response + denial actual.\n\nThis matches the live SQL-backed actionable workable total.'
    }

    // --- Forecast ---
    if (q.includes('forecast') || q.includes('future') || q.includes('predict')) {
        return 'The "Forecast" months (purple tags) show our AI\'s best guess for upcoming months based on past patterns. These aren\'t real data yet — they\'re predictions. Months with green data are actual recorded results.'
    }

    // --- Comparison / compare ---
    if (q.includes('compare') || q.includes('vs') || q.includes('versus') || q.includes('difference')) {
        return 'To compare months: look at the month cards in the Workable Forecast section — each shows Total Workable, prediction volume, and response volume. Or check the KPI accuracy arrows (↑/↓) to see if things improved or got worse compared to the previous month.'
    }

    return '🤔 I\'m not sure about that one. Try asking about:\n• "What is Total Workable?" or "Explain the formula"\n• "Show accuracy for this month"\n• "What does the calendar show?"\n• "Which month had the most work?"\n• "What is ITTT?" or "Explain the KPI cards"\n• "What does the pipeline show?"\n• "What is AR backlog?"'
}

const buildCalendarCells = (monthKey, dailyRecords) => {
    if (!monthKey) return []
    const [year, month] = monthKey.split('-').map(Number)
    if (!year || !month) return []

    const firstDay = new Date(year, month - 1, 1)
    const daysInMonth = new Date(year, month, 0).getDate()
    const firstDayMondayIndex = (firstDay.getDay() + 6) % 7
    const dailyMap = new Map((dailyRecords || []).map((item) => [item.date, item]))

    const cells = []
    for (let i = 0; i < firstDayMondayIndex; i += 1) {
        cells.push({ empty: true, key: `lead-${i}` })
    }

    for (let day = 1; day <= daysInMonth; day += 1) {
        const date = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
        const found = dailyMap.get(date)
        const formulaParts = getWorkableFormulaParts(found)
        const weekDay = new Date(year, month - 1, day).getDay()
        cells.push({
            empty: false,
            key: date,
            day,
            date,
            isWeekend: weekDay === 0 || weekDay === 6,
            hasData: Boolean(found),
            totalWorkable: formulaParts.result,
            liveTotalWorkable: Number(found?.total_workable || 0),
            formulaResult: formulaParts.result,
            formulaTooltip: found ? buildWorkableFormulaTooltip(found) : ''
        })
    }

    while (cells.length % 7 !== 0) {
        cells.push({ empty: true, key: `trail-${cells.length}` })
    }

    return cells
}

function OptimixIKSInsights({ embedded = false }) {
    const [insights, setInsights] = useState(null)
    const [availableClients, setAvailableClients] = useState(GIA_PHASE_CLIENT_OPTIONS)
    const [selectedClient, setSelectedClient] = useState(GIA_PHASE_CLIENT_OPTIONS[0])
    const [selectedMonth, setSelectedMonth] = useState('')
    const [selectedYear, setSelectedYear] = useState('')
    const [selectedDate, setSelectedDate] = useState('')
    const [showCalendar, setShowCalendar] = useState(false)
    const [detailsView, setDetailsView] = useState('day')
    const [expandedPipelineNode, setExpandedPipelineNode] = useState(null)
    const [showGuide, setShowGuide] = useState(false)
    const [tipIndex, setTipIndex] = useState(0)
    const [showChartsExpanded, setShowChartsExpanded] = useState(true)
    const [showAdvancedGraphs, setShowAdvancedGraphs] = useState(false)
    const [isChatOpen, setIsChatOpen] = useState(false)
    const [chatInput, setChatInput] = useState('')
    const [chatMicListening, setChatMicListening] = useState(false)
    const chatMicRef = useRef(null)
    const [chatMessages, setChatMessages] = useState([
        {
            role: 'assistant',
            text: 'ASK CLAIM is ready. Ask about totals, trends, formulas, and what to explore first.'
        }
    ])
    const [loading, setLoading] = useState(true)
    const [refreshing, setRefreshing] = useState(false)
    const [personaRefreshToken, setPersonaRefreshToken] = useState(0)
    const [error, setError] = useState('')
    const [formulaPopover, setFormulaPopover] = useState(null)
    const kpiRef = useRef(null)
    const chatLogRef = useRef(null)

    const [arBacklog, setArBacklog] = useState(null)
    const [activeTab, setActiveTab] = useState('trends')
    const [persona, setPersona] = useState('ops-manager') // 'ops-manager' | 'sr-leader' | 'work-plan'
    const [calcBasis, setCalcBasis] = useState('ittt')    // 'ittt' | 'ar'
    const [opsFlowLive, setOpsFlowLive] = useState(null)  // live ops-flow API result

    const fetchInsights = async (refresh = false, clientOverride = null) => {
        try {
            if (refresh) {
                setRefreshing(true)
            } else {
                setLoading(true)
            }
            setError('')

            const requestedClient = toUiPhaseValue(clientOverride || selectedClient || GIA_PHASE_CLIENT_OPTIONS[0])
            const params = new URLSearchParams()
            if (refresh) params.set('refresh', 'true')
            if (!isAllPhaseSelection(requestedClient)) params.set('phase', requestedClient)

            const response = await fetch(`/api/optimix/iks/insights?${params.toString()}`, {
                cache: 'no-store',
            })
            if (!response.ok) {
                throw new Error(`Failed to load IKS insights (${response.status})`)
            }

            const payload = await response.json()
            setInsights(payload)
            storeInsightsSnapshot(payload)
            if (refresh) {
                setPersonaRefreshToken(Date.now())
            }

            // Use dynamic phases from the API if available
            const apiPhases = payload?.available_phases
            if (apiPhases && apiPhases.length > 0) {
                setAvailableClients(toUiPhaseOptions(apiPhases))
            } else {
                setAvailableClients(GIA_PHASE_CLIENT_OPTIONS)
            }
            setSelectedClient(toUiPhaseValue(payload?.selected_client || requestedClient))

            const allKnownMonthKeys = payload?.available_months || []
            const previousMonth = selectedMonth
            const shouldKeepPreviousMonth = !refresh && !clientOverride && previousMonth && allKnownMonthKeys.includes(previousMonth)
            const nextMonth = shouldKeepPreviousMonth
                ? previousMonth
                : (payload?.default_month || allKnownMonthKeys[0] || '')

            setSelectedMonth(nextMonth)

            const nextYear = String(nextMonth || '').split('-')[0]
            if (nextYear) {
                setSelectedYear(nextYear)
            } else {
                setSelectedYear('')
            }
        } catch (err) {
            console.warn('IKS insights fetch failed:', err)
            const storedInsights = !insights ? loadStoredInsights() : null
            if (storedInsights) {
                setInsights(storedInsights)
                setAvailableClients(toUiPhaseOptions(storedInsights?.available_phases || GIA_PHASE_CLIENT_OPTIONS))
                setSelectedClient(toUiPhaseValue(storedInsights?.selected_client || clientOverride || selectedClient || GIA_PHASE_CLIENT_OPTIONS[0]))
                const fallbackMonth = storedInsights?.default_month || storedInsights?.available_months?.[0] || ''
                setSelectedMonth(fallbackMonth)
                setSelectedYear(String(fallbackMonth || '').split('-')[0] || '')
                setError('Unable to load live IKS insights right now. Showing the last successful cached data.')
            } else if (ENABLE_IKS_MOCK_FALLBACK && !insights) {
                const fallbackData = await loadExcelFallback()
                setInsights(fallbackData)
                setAvailableClients(GIA_PHASE_CLIENT_OPTIONS)
                setSelectedClient(toUiPhaseValue(clientOverride || selectedClient || GIA_PHASE_CLIENT_OPTIONS[0]))

                const defaultMonth = MOCK_INSIGHTS.default_month
                setSelectedMonth(defaultMonth)
                setSelectedYear(defaultMonth.split('-')[0])
                setError('Unable to load live IKS insights right now. Showing local fallback data.')
            } else {
                setError('Unable to load live IKS insights right now. Start or restart the API service and retry.')
            }
        } finally {
            setLoading(false)
            setRefreshing(false)
        }
    }

    // Fetch AR backlog whenever the selected client (phase) or month changes
    const fetchArBacklog = useCallback(async (phase, monthKey, refresh = false) => {
        try {
            const params = new URLSearchParams()
            if (!isAllPhaseSelection(phase)) params.set('phase', phase)
            // Pass end-of-month date so backlog reflects the selected period
            if (monthKey) {
                const [y, m] = monthKey.split('-').map(Number)
                const lastDay = new Date(y, m, 0).getDate()
                params.set('as_of_date', `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`)
            }
            if (refresh) params.set('refresh', 'true')
            const resp = await fetch(`/api/optimix/iks/ar-backlog?${params.toString()}`, {
                cache: 'no-store',
            })
            if (resp.ok) {
                const data = await resp.json()
                setArBacklog(data)
            }
        } catch (err) {
            console.warn('AR backlog fetch failed:', err)
        }
    }, [])

    // Fetch live ops-flow data from the dedicated endpoint for the active basis
    const fetchOpsFlow = useCallback(async (monthKey, dateKey, refresh = false) => {
        try {
            const params = new URLSearchParams()
            if (dateKey) {
                params.set('date', dateKey)
            } else if (monthKey) {
                params.set('month', monthKey)
            } else {
                return
            }
            if (!isAllPhaseSelection(selectedClient)) {
                params.set('phase', selectedClient)
            }
            if (refresh) {
                params.set('refresh', 'true')
            }
            const endpoint = calcBasis === 'ar'
                ? '/api/optimix/iks/ar-workable'
                : '/api/optimix/iks/ops-flow'
            const res = await fetch(`${endpoint}?${params.toString()}`, {
                cache: 'no-store',
            })
            if (res.ok) {
                const data = await res.json()
                if (!data.error) setOpsFlowLive(data)
            }
        } catch (err) {
            console.warn('ops-flow fetch failed:', err)
        }
    }, [calcBasis, selectedClient])

    useEffect(() => {
        fetchInsights(false)
    }, [])

    // Re-fetch AR backlog when client/phase or selected month changes
    useEffect(() => {
        if (selectedClient) {
            fetchArBacklog(selectedClient, selectedMonth, personaRefreshToken > 0)
        }
    }, [selectedClient, selectedMonth, personaRefreshToken, fetchArBacklog])

    // Re-fetch ops-flow live data when month, selected date, or basis changes
    useEffect(() => {
        setOpsFlowLive(null)  // clear stale data immediately on change
        const dateKey = detailsView === 'day' && selectedDate ? selectedDate : null
        fetchOpsFlow(selectedMonth, dateKey, personaRefreshToken > 0)
    }, [selectedMonth, selectedDate, detailsView, calcBasis, selectedClient, personaRefreshToken, fetchOpsFlow])

    const openArWorkableCalendarView = useCallback((anchorDate = '') => {
        const targetMonth = anchorDate && String(anchorDate).length >= 7 ? String(anchorDate).slice(0, 7) : selectedMonth

        setPersona('ops-manager')
        setCalcBasis('ar')
        setShowCalendar(true)

        if (targetMonth && targetMonth !== selectedMonth) {
            setSelectedMonth(targetMonth)
        }
        if (anchorDate) {
            setSelectedDate(anchorDate)
        }

        const scrollToCalendar = () => {
            document.getElementById('iks-calendar-panel')?.scrollIntoView({
                behavior: 'smooth',
                block: 'start',
            })
        }

        if (typeof window !== 'undefined') {
            window.requestAnimationFrame(() => {
                window.requestAnimationFrame(scrollToCalendar)
            })
        } else {
            scrollToCalendar()
        }
    }, [selectedMonth])

    const selectedMonthData = useMemo(
        () => (selectedMonth && insights?.months ? insights.months[selectedMonth] : null),
        [insights, selectedMonth]
    )

    const allMonthKeys = useMemo(() => {
        const keys = new Set(insights?.available_months || [])
        return Array.from(keys).sort((a, b) => {
            const aDate = new Date(`${a}-01T00:00:00`).getTime()
            const bDate = new Date(`${b}-01T00:00:00`).getTime()
            if (Number.isNaN(aDate) || Number.isNaN(bDate)) {
                return String(b).localeCompare(String(a))
            }
            return bDate - aDate
        })
    }, [insights])

    const monthBuckets = useMemo(() => {
        const buckets = {}
        allMonthKeys.forEach((monthKey) => {
            const [yearPart, monthPart] = String(monthKey).split('-')
            if (!yearPart || !monthPart) return

            if (!buckets[yearPart]) buckets[yearPart] = []
            const monthDate = new Date(`${monthKey}-01T00:00:00`)
            const monthLabel = Number.isNaN(monthDate.getTime())
                ? monthKey
                : monthDate.toLocaleDateString('en-US', { month: 'short' })

            buckets[yearPart].push({
                key: monthKey,
                month: Number(monthPart),
                label: monthLabel
            })
        })

        Object.values(buckets).forEach((monthList) => {
            monthList.sort((a, b) => b.month - a.month)
        })
        return buckets
    }, [allMonthKeys])

    const availableYears = useMemo(
        () => Object.keys(monthBuckets).sort((a, b) => Number(b) - Number(a)),
        [monthBuckets]
    )

    const calendarCells = useMemo(
        () => buildCalendarCells(selectedMonth, selectedMonthData?.daily || []),
        [selectedMonth, selectedMonthData]
    )

    const chartData = useMemo(() => {
        return (selectedMonthData?.daily || []).map((item) => {
            const actual = (item.payment_actual || 0) + (item.denial_actual || 0)
            const expected = item.total_prediction || 0
            const formulaWorkable = getDisplayedWorkableValue(item)

            let mape = 0
            let bias = 0
            let ae_ratio = 0

            if (actual > 0) {
                mape = Math.abs(expected - actual) / actual * 100
                bias = (expected - actual) / actual * 100
            } else if (expected > 0) {
                mape = 100 // Map up to 100% if actual is 0 but we expected volume
                bias = 100
            }

            if (expected > 0) {
                ae_ratio = actual / expected
            }

            // Proxy probability bin for calibration curve based on predicted payment proportion
            const prob_bin = expected > 0 ? Math.min(100, Math.round(((item.payment_prediction || 0) / expected) * 100)) : 0

            return {
                ...item,
                day_label: formatAxisDate(item.date),
                total_workable: formulaWorkable,
                total_actual: actual,
                mape: parseFloat(mape.toFixed(1)),
                bias: parseFloat(bias.toFixed(1)),
                ae_ratio: parseFloat(ae_ratio.toFixed(2)),
                calibration_prob: prob_bin
            }
        })
    }, [selectedMonthData])

    useEffect(() => {
        if (!chartData.length) {
            setSelectedDate('')
            return
        }
        setSelectedDate((prev) => (
            chartData.some((item) => item.date === prev) ? prev : chartData[0].date
        ))
    }, [chartData])

    const selectedDayData = useMemo(
        () => chartData.find((item) => item.date === selectedDate) || null,
        [chartData, selectedDate]
    )

    const denseDayAxisProps = useMemo(() => ({
        tick: { fill: '#64748b', fontSize: 11 },
        tickMargin: 8,
        minTickGap: 14,
        interval: chartData.length > 24 ? 3 : chartData.length > 16 ? 1 : 0,
        tickFormatter: formatCompactDayTick,
    }), [chartData.length])

    const yearMonthOptions = monthBuckets[selectedYear] || []

    const workableByMonth = useMemo(() => {
        const map = {}
        allMonthKeys.forEach((monthKey) => {
            map[monthKey] = getDisplayedWorkableValue(insights?.months?.[monthKey]?.totals)
        })
        return map
    }, [insights, allMonthKeys])

    const monthOverviewOptions = useMemo(() => {
        return [...yearMonthOptions].sort((a, b) => {
            const aDate = new Date(`${a.key}-01T00:00:00`).getTime()
            const bDate = new Date(`${b.key}-01T00:00:00`).getTime()
            if (Number.isNaN(aDate) || Number.isNaN(bDate)) return String(b.key).localeCompare(String(a.key))
            return bDate - aDate
        })
    }, [yearMonthOptions])

    useEffect(() => {
        if (!availableYears.length) return

        const monthYear = String(selectedMonth || '').split('-')[0]

        if (!selectedYear || !availableYears.includes(selectedYear)) {
            const fallbackYear = monthYear && availableYears.includes(monthYear) ? monthYear : availableYears[0]
            setSelectedYear(fallbackYear)
            return
        }

        if (monthYear && monthYear !== selectedYear && availableYears.includes(monthYear)) {
            setSelectedYear(monthYear)
        }

        const allowedMonthKeys = monthOverviewOptions.map((item) => item.key)
        if (!allowedMonthKeys.length) return

        if (!allowedMonthKeys.includes(selectedMonth)) {
            setSelectedMonth(allowedMonthKeys[0])
        }
    }, [selectedMonth, availableYears, selectedYear, monthOverviewOptions])

    // --- Restored Logic: Yearly Forecast Calculation ---
    const yearlyForecast = useMemo(() => {
        if (!insights?.months || !selectedYear) return null
        const relevantMonths = Object.entries(insights.months)
            .filter(([key]) => key.startsWith(selectedYear))
            .reduce((acc, [key, val]) => ({ ...acc, [key]: val }), {})

        const totals = calculateYearlyForecast(relevantMonths)
        return {
            year: selectedYear,
            ...totals
        }
    }, [insights, selectedYear])

    const handleChatSend = async (queryText) => {
        if (!queryText.trim()) return

        // 1. Add User Message
        const userMsg = { role: 'user', text: queryText }
        setChatMessages((prev) => [...prev, userMsg])
        setChatInput('')
        // Assuming setIsChatOpen is defined elsewhere and needs to be called here
        // setIsChatOpen(true) // Uncomment if setIsChatOpen is a state setter

        // 2. Add Typing Indicator
        const typingId = Date.now() // Generate a unique ID for the typing message
        const typingMsg = { role: 'assistant', text: '✦ Thinking...', typing: true, id: typingId }
        setChatMessages((prev) => [...prev, typingMsg])

        // 3. Build Rich Context (now including all months for cross-month queries)
        const allMonthsTotals = {}
        if (insights?.months) {
            Object.entries(insights.months).forEach(([mKey, mData]) => {
                allMonthsTotals[mKey] = {
                    label: mData.label || formatMonthKeyLabel(mKey),
                    totals: mData.totals || {}
                }
            })
        }

        const context = {
            client: selectedClient,
            month_label: selectedMonthData?.label || formatMonthKeyLabel(selectedMonth),
            month_key: selectedMonth,
            year: selectedYear,
            // Full monthly totals for the selected month
            totals: selectedMonthData?.totals || {},
            // ALL available months' totals (for trend/comparison queries)
            all_months: allMonthsTotals,
            // KPI cards
            cards: selectedMonthData?.cards || {},
            // Current day data (if a day is selected)
            selected_day: selectedDayData || null,
            // AR Backlog with phase breakdown
            ar_backlog: arBacklog ? {
                total_count: arBacklog.ar_backlog_count,
                total_balance: arBacklog.ar_backlog_balance,
                by_phase: arBacklog.by_phase || {},
                phase: arBacklog.phase,
            } : null,
            // Forecast info
            is_forecast: selectedMonthData?.is_forecast || false,
            is_fully_forecast: selectedMonthData?.is_fully_forecast || false,
            // Daily records for the month (all days)
            daily_records: (selectedMonthData?.daily || []).slice(0, 31),
            // Record count
            record_count: selectedMonthData?.record_count || 0,
        }

        try {
            // Send to the backend endpoint (which wraps Vertex AI)
            const response = await fetch('/api/orbit-chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: queryText, context })
            })

            if (response.ok) {
                const data = await response.json()
                setChatMessages((prev) =>
                    prev.filter(m => !(m.typing && m.id === typingId)).concat({
                        role: 'assistant',
                        text: data.reply,
                        source: data.source // 'vertex-ai' or 'mock'
                    })
                )
                return
            }
        } catch {
            // Network error — fall through to local fallback
        }

        // Local fallback when backend is unreachable
        const reply = generateChatbotReply({
            question: text,
            insights,
            selectedMonth,
            selectedMonthData,
            selectedDayData
        })
        setChatMessages((prev) =>
            prev.filter(m => !(m.typing && m.id === typingId)).concat({
                role: 'assistant',
                text: reply,
                source: 'local'
            })
        )
    }

    const monthCards = useMemo(
        () => monthOverviewOptions.map((month) => {
            const monthData = insights?.months?.[month.key]
            const billed = Number(monthData?.totals?.Total_Billed || 0)
            const workable = getDisplayedWorkableValue(monthData?.totals)
            const monthLabel = monthData?.label || formatMonthKeyLabel(month.key)
            return {
                key: month.key,
                label: monthLabel,
                billed,
                workable,
                isForecast: Boolean(monthData?.is_forecast),
                isFullyForecast: Boolean(monthData?.is_fully_forecast)
            }
        }),
        [monthOverviewOptions, insights, selectedYear]
    )

    const handleYearChange = (year) => {
        setSelectedYear(year)
        setShowCalendar(true)
        const monthsForYear = monthBuckets[year] || []
        if (monthsForYear.length) {
            setSelectedMonth(monthsForYear[0].key)
        }
    }

    // --- Intelligent Command Center Insight ---
    const commandCenterInsight = useMemo(() => {
        if (!selectedMonthData) return null
        const label = selectedMonthData?.label || formatMonthKeyLabel(selectedMonth)
        const workable = getDisplayedWorkableValue(selectedMonthData?.totals)
        const cards = selectedMonthData?.cards || {}
        const paymentAcc = Number(cards?.payment?.accuracy_pct || 0)
        const denialAcc = Number(cards?.denial?.accuracy_pct || 0)

        // Find previous month for comparison
        const currentIdx = allMonthKeys.indexOf(selectedMonth)
        const prevMonthKey = currentIdx < allMonthKeys.length - 1 ? allMonthKeys[currentIdx + 1] : null
        const prevWorkable = prevMonthKey ? getDisplayedWorkableValue(insights?.months?.[prevMonthKey]?.totals) : 0
        const workableDelta = prevWorkable > 0 ? ((workable - prevWorkable) / prevWorkable * 100).toFixed(1) : null

        // Count anomaly days
        const daily = selectedMonthData?.daily || []
        const workableValues = daily.map((d) => getDisplayedWorkableValue(d)).filter(v => v > 0)
        const mean = workableValues.length ? workableValues.reduce((a, b) => a + b, 0) / workableValues.length : 0
        const stdDev = workableValues.length > 1
            ? Math.sqrt(workableValues.reduce((sum, v) => sum + (v - mean) ** 2, 0) / workableValues.length)
            : 0
        const anomalyCount = workableValues.filter(v => Math.abs(v - mean) > 1.5 * stdDev).length

        let primary = `${label}: ${formatNumber(workable)} Total Workable in current scope`
        if (workableDelta !== null) {
            const arrow = Number(workableDelta) > 0 ? '↑' : Number(workableDelta) < 0 ? '↓' : '→'
            primary += ` — ${arrow}${Math.abs(Number(workableDelta))}% vs last month`
        }

        let alerts = []
        if (paymentAcc < 85) alerts.push(`Payment accuracy at ${paymentAcc.toFixed(1)}% ⚠️`)
        if (denialAcc < 85) alerts.push(`Denial accuracy at ${denialAcc.toFixed(1)}% ⚠️`)
        if (anomalyCount > 0) alerts.push(`${anomalyCount} day${anomalyCount > 1 ? 's' : ''} flagged for review`)

        return { primary, alerts, paymentAcc, denialAcc, anomalyCount }
    }, [selectedMonthData, selectedMonth, allMonthKeys, insights])

    // --- Anomaly Detection for Calendar Days ---
    const anomalyDays = useMemo(() => {
        const daily = selectedMonthData?.daily || []
        const workableValues = daily.map((d) => getWorkableFormulaParts(d).result).filter(v => v > 0)
        const mean = workableValues.length ? workableValues.reduce((a, b) => a + b, 0) / workableValues.length : 0
        const stdDev = workableValues.length > 1
            ? Math.sqrt(workableValues.reduce((sum, v) => sum + (v - mean) ** 2, 0) / workableValues.length)
            : 0
        const threshold = 1.5 * stdDev
        const flagged = new Set()
        daily.forEach(d => {
            const val = getWorkableFormulaParts(d).result
            if (val > 0 && Math.abs(val - mean) > threshold) flagged.add(d.date)
        })
        return flagged
    }, [selectedMonthData])

    // --- Heatmap Intensity (0-4 scale) ---
    const heatmapRange = useMemo(() => {
        const daily = selectedMonthData?.daily || []
        const vals = daily.map((d) => getWorkableFormulaParts(d).result).filter(v => v > 0)
        if (!vals.length) return { min: 0, max: 1 }
        return { min: Math.min(...vals), max: Math.max(...vals) }
    }, [selectedMonthData])

    const getHeatmapLevel = useCallback((value) => {
        if (!value || value <= 0) return 0
        const range = heatmapRange.max - heatmapRange.min
        if (range <= 0) return 2
        const normalized = (value - heatmapRange.min) / range
        if (normalized < 0.25) return 1
        if (normalized < 0.5) return 2
        if (normalized < 0.75) return 3
        return 4
    }, [heatmapRange])

    // --- Enhanced Chatbot: auto-scroll on new message ---
    useEffect(() => {
        if (chatLogRef.current) {
            chatLogRef.current.scrollTop = chatLogRef.current.scrollHeight
        }
    }, [chatMessages])

    // --- RAG threshold helpers ---
    const getRAGColor = (value, thresholds = { green: 90, amber: 80 }) => {
        if (value >= thresholds.green) return 'rag-green'
        if (value >= thresholds.amber) return 'rag-amber'
        return 'rag-red'
    }

    // --- Build priority actions from current data ---
    const priorityActions = useMemo(() => {
        if (!selectedMonthData) return []
        const actions = []
        const daily = selectedMonthData?.daily || []
        const totalDenialActual = daily.reduce((sum, d) => sum + Number(d.denial_actual || 0), 0)
        const totalNoResponse = daily.reduce((sum, d) => sum + Number(d.third_prediction_expired_no_response || 0), 0)
        const paymentAcc = Number(selectedMonthData?.cards?.payment?.accuracy_pct || 0)
        const denialAcc = Number(selectedMonthData?.cards?.denial?.accuracy_pct || 0)

        if (totalDenialActual > 0) {
            actions.push({ color: 'red', text: `${formatNumber(totalDenialActual)} denials need rework` })
        }
        if (totalNoResponse > 0) {
            actions.push({ color: 'amber', text: `${formatNumber(totalNoResponse)} claims expired — no response` })
        }
        if (paymentAcc > 0 && paymentAcc < 80) {
            actions.push({ color: 'yellow', text: `Payment accuracy below 80% threshold` })
        }
        if (denialAcc > 0 && denialAcc < 70) {
            actions.push({ color: 'yellow', text: `Denial accuracy below 70% threshold` })
        }
        return actions
    }, [selectedMonthData])

    // --- SVG Radial Ring Component ---
    const RadialRing = ({ value, ragClass, size = 80 }) => {
        const r = (size - 12) / 2
        const circumference = 2 * Math.PI * r
        const offset = circumference - (Math.min(value, 100) / 100) * circumference
        return (
            <div className="iks-radial-ring" style={{ width: size, height: size }}>
                <svg width={size} height={size}>
                    <circle className="ring-bg" cx={size / 2} cy={size / 2} r={r} />
                    <circle
                        className={`ring-fill ${ragClass}`}
                        cx={size / 2} cy={size / 2} r={r}
                        strokeDasharray={circumference}
                        strokeDashoffset={offset}
                    />
                </svg>
                <div className="ring-value">{formatPercent(value)}</div>
            </div>
        )
    }

    // --- Tooltip Component ---
    const Tip = ({ text }) => (
        <span className="iks-tooltip-trigger" title={text}>?</span>
    )

    // --- Workable delta vs previous month ---
    const workableDelta = useMemo(() => {
        if (calcBasis === 'ar') return null
        const currentIdx = allMonthKeys.indexOf(selectedMonth)
        const prevKey = currentIdx < allMonthKeys.length - 1 ? allMonthKeys[currentIdx + 1] : null
        const prevWorkable = prevKey ? getDisplayedWorkableValue(insights?.months?.[prevKey]?.totals) : 0
        const currentWorkable = getDisplayedWorkableValue(selectedMonthData?.totals)
        if (prevWorkable > 0) {
            return ((currentWorkable - prevWorkable) / prevWorkable * 100).toFixed(1)
        }
        return null
    }, [calcBasis, selectedMonthData, selectedMonth, allMonthKeys, insights])

    const displayedWorkableFormulaParts = useMemo(
        () => getWorkableFormulaParts(detailsView === 'day' && selectedDayData ? selectedDayData : selectedMonthData?.totals),
        [detailsView, selectedDayData, selectedMonthData]
    )

    // --- Ops flow data for month/day (switches between ITTT and AR basis) ---
    const opsFlowData = useMemo(() => {
        const isDay = detailsView === 'day' && selectedDayData

        // Use the dedicated live endpoints for AR workable and ITTT ops flow.
        if (opsFlowLive && !opsFlowLive.error) {
            const dateToUse = isDay ? selectedDate : null
            const liveIsDay = Boolean(dateToUse)
            if (calcBasis === 'ar') {
                return {
                    itttDue:   Number(opsFlowLive.total_prediction ?? opsFlowLive.ittt_predicted ?? 0),
                    responded: Number(opsFlowLive.responses_received ?? opsFlowLive.response_received ?? 0),
                    denials:   Number(opsFlowLive.total_denials ?? opsFlowLive.actual_deny ?? 0),
                    npnr:      Number(opsFlowLive.npnr || 0),
                    workable:  Number(opsFlowLive.workable ?? opsFlowLive.total_workable ?? 0),
                    backlog:   getCalculatedBacklog(arBacklog?.trend, liveIsDay ? dateToUse : selectedMonth, liveIsDay ? 'day' : 'month'),
                    _labels: ['Total Prediction', 'Response Received', 'Actual Deny', 'NPNR', 'AR Workable'],
                    _subs:   ['AR workflow claims in selected ITTT period', 'Claims with a recorded payer response', 'Claims actually denied in the AR cohort', 'Third prediction expired with no response', 'Actual deny + expired no-response'],
                    _source: 'live',
                }
            }
            return {
                itttDue:   opsFlowLive.ittt_predicted,
                responded: opsFlowLive.responses_received,
                denials:   opsFlowLive.total_denials,
                npnr:      opsFlowLive.npnr,
                workable:  Number(opsFlowLive.workable || 0),
                backlog:   getCalculatedBacklog(arBacklog?.trend, liveIsDay ? opsFlowLive.period : selectedMonth, liveIsDay ? 'day' : 'month'),
                _labels: ['ITTT Predicted', 'Responses Received', 'Total Denials', 'NPNR', 'Workable'],
                _subs:   ['Claims predicted to respond by today', 'Payment + denial actuals', 'Actual payer denials', 'No payer no response (3rd ITTT expired)', 'Total denials + expired no-response'],
                _source: 'live',
            }
        }

        if (calcBasis === 'ar') {
            return {
                itttDue: 0,
                responded: 0,
                denials: 0,
                npnr: 0,
                workable: 0,
                backlog: getCalculatedBacklog(arBacklog?.trend, isDay ? selectedDayData?.date : selectedMonth, isDay ? 'day' : 'month'),
                _labels: ['Total Prediction', 'Response Received', 'Actual Deny', 'NPNR', 'AR Workable'],
                _subs: ['AR workflow claims in selected ITTT period', 'Claims with a recorded payer response', 'Claims actually denied in the AR cohort', 'Third prediction expired with no response', 'Actual deny + expired no-response'],
                _source: 'pending',
            }
        }

        // Fallback: compute from cached insights data
        // NOTE on field choice:
        //  • Total_Response is grouped by Post_Date (responses arrived on that day from ANY claim)
        //    — this makes it incomparable to Total_Prediction (ITTT_Date bounded). DO NOT use it.
        //  • Payment_Actual + Denial_Actual are both JOIN'ed to ITTT predictions by Encounter_Number
        //    and grouped by ITTT_Date — they ARE bounded to the same population as Total_Prediction. ✓
        //  • Total_Workable is a daily-snapshot metric summed across the month = meaningless.
        //    Workable = Denial_Actual + ThirdPredictionExpired_NoResponse is the correct computation. ✓
        const src = isDay ? selectedDayData : selectedMonthData?.totals || {}
        const _denials = Number(isDay ? src.denial_actual                        : src.Denial_Actual                        || 0)
        const _npnr    = Number(isDay ? src.third_prediction_expired_no_response : src.ThirdPredictionExpired_NoResponse    || 0)

        return {
            itttDue:   Number(isDay ? src.total_prediction   : src.Total_Prediction   || 0),
            // Responses = Payment_Actual + Denial_Actual (ITTT_Date-bounded, not Post_Date-bounded)
            responded: Number(isDay
                ? (src.payment_actual || 0) + (src.denial_actual || 0)
                : (src.Payment_Actual || 0) + (src.Denial_Actual || 0)
            ),
            denials:   _denials,
            npnr:      _npnr,
            workable:  getDisplayedWorkableValue(src),
            backlog:   getCalculatedBacklog(arBacklog?.trend, isDay ? selectedDayData?.date : selectedMonth, isDay ? 'day' : 'month'),
            _labels: ['ITTT Predicted', 'Responses Received', 'Total Denials', 'NPNR', 'Workable'],
            _subs:   ['Claims predicted to respond by today', 'Payment + denial actuals', 'Actual payer denials', 'No payer no response (3rd ITTT expired)', 'Total denials + expired no-response'],
            _source: 'cached',
        }
    }, [selectedMonthData, selectedDayData, detailsView, arBacklog, selectedMonth, calcBasis, opsFlowLive])

    const workableFormulaParts = useMemo(() => {
        if (calcBasis !== 'ar' && opsFlowData?._source === 'live') {
            return {
                thirdExpired: Number(opsFlowData.npnr || 0),
                denialActual: Number(opsFlowData.denials || 0),
                result: Number(opsFlowData.workable || 0),
            }
        }
        return displayedWorkableFormulaParts
    }, [calcBasis, opsFlowData, displayedWorkableFormulaParts])

    if (loading && !insights) {
        return (
            <div className={`optimix-iks-container ${embedded ? 'embedded' : ''}`}>
                <div className="optimix-iks-loading">Loading IKS claim insights...</div>
            </div>
        )
    }

    if (!loading && !insights) {
        return (
            <div className={`optimix-iks-container ${embedded ? 'embedded' : ''}`}>
                <div className={`optimix-iks-header-row ${embedded ? 'embedded' : ''}`}>
                    <div>
                        {!embedded && (
                            <Link to="/dashboard" className="optimix-iks-back-link">← Back to Dashboard</Link>
                        )}
                        <h1 className="optimix-iks-title">
                            IKS Claim Insights
                            <span className="iks-live-dot" />
                        </h1>
                        <p className="optimix-iks-inline-subtitle">
                            Track every claim from billing to payment with live ITTT, denial, workable, and AR backlog data.
                        </p>
                    </div>
                </div>
                {error && <div className="optimix-iks-error">{error}</div>}
                <div className="optimix-iks-empty-state">
                    <h3>IKS insights are temporarily unavailable</h3>
                    <p>The page is blocking zero-value placeholders until the live API responds again.</p>
                    <button type="button" className="optimix-iks-refresh-btn" onClick={() => fetchInsights(true)} disabled={refreshing}>
                        {refreshing ? 'Retrying...' : 'Retry'}
                    </button>
                </div>
            </div>
        )
    }

    return (
        <div className={`optimix-iks-container ${embedded ? 'embedded' : ''}`}>
            {/* ══════ ZONE 1: Compact Header ══════ */}
            <div className={`optimix-iks-header-row ${embedded ? 'embedded' : ''}`}>
                <div>
                    {!embedded && (
                        <Link to="/dashboard" className="optimix-iks-back-link">← Back to Dashboard</Link>
                    )}
                    <h1 className="optimix-iks-title">
                        IKS Claim Insights
                        <span className="iks-live-dot" />
                    </h1>
                    {insights?.cache?.last_updated ? (
                        <p className="optimix-iks-last-updated">Last synced: {new Date(insights.cache.last_updated).toLocaleString('en-US', { timeZone: 'America/New_York', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })} EST (Offline Mock)</p>
                    ) : (
                        <p className="optimix-iks-last-updated" style={{ color: '#10b981', fontWeight: 500 }}>
                            • Live Data Refreshed: {new Date().toLocaleTimeString('en-US', { timeZone: 'America/New_York', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })} EST
                        </p>
                    )}
                    {embedded && (
                        <p className="optimix-iks-inline-subtitle">
                            Track every claim from billing to payment — see what our AI predicted and what actually happened, day by day.
                        </p>
                    )}
                </div>
                <div className="optimix-iks-controls">
                    <label htmlFor="iks-client-select" className="optimix-iks-control-label">Client</label>
                    <select
                        id="iks-client-select"
                        value={selectedClient}
                        onChange={(e) => {
                            const nextClient = e.target.value
                            setSelectedClient(nextClient)
                            setShowCalendar(true)
                            fetchInsights(false, nextClient)
                        }}
                        disabled={refreshing || availableClients.length <= 1}
                    >
                        {availableClients.map((client) => (
                            <option key={client} value={client}>{client}</option>
                        ))}
                    </select>
                    <label htmlFor="iks-year-select" className="optimix-iks-control-label">Year</label>
                    <select
                        id="iks-year-select"
                        value={selectedYear}
                        onChange={(e) => handleYearChange(e.target.value)}
                    >
                        {availableYears.map((year) => (
                            <option key={year} value={year}>{year}</option>
                        ))}
                    </select>
                    <label htmlFor="iks-month-select" className="optimix-iks-control-label">Month</label>
                    <select
                        id="iks-month-select"
                        value={selectedMonth}
                        onChange={(e) => {
                            setSelectedMonth(e.target.value)
                            setShowCalendar(true)
                        }}
                    >
                        {monthOverviewOptions.map((month) => (
                            <option key={month.key} value={month.key}>
                                {insights?.months?.[month.key]?.label || formatMonthKeyLabel(month.key)}
                            </option>
                        ))}
                    </select>
                    <button type="button" className="optimix-iks-refresh-btn" onClick={() => fetchInsights(true)} disabled={refreshing}>
                        {refreshing ? 'Refreshing...' : 'Refresh'}
                    </button>
                </div>
            </div>

            {/* Persona Switcher */}
            <IksPersonaSwitcher persona={persona} setPersona={setPersona} />

            {error && <div className="optimix-iks-error">{error}</div>}

            {persona === 'ops-manager' && (
            <>

            {/* Calc Basis Toggle — ITTT vs AR perspective, controls hero + ops flow + all KPI sections */}
            <div className="iks-calc-basis-bar">
                <span className="iks-calc-basis-label">Calc Basis</span>
                <div className="iks-calc-basis-switch">
                    <button
                        type="button"
                        className={calcBasis === 'ittt' ? 'active' : ''}
                        onClick={() => setCalcBasis('ittt')}
                    >
                        DS Model Workable
                    </button>
                    <button
                        type="button"
                        className={calcBasis === 'ar' ? 'active' : ''}
                        onClick={() => setCalcBasis('ar')}
                    >
                        AR Bucket Workable
                    </button>
                </div>
                <span className="iks-calc-basis-desc">
                    {calcBasis === 'ittt'
                        ? 'DS Model — Third Prediction Expired No Response + Denial Actual'
                        : 'AR Bucket — Actual Deny + Third Prediction Expired No Response from the AR workflow cohort'}
                </span>
            </div>

            {/* ══════ ZONE 2: Hero Metrics with RAG Radial Rings ══════ */}
            <div className="iks-hero-grid">
                {/* Total Workable / AR Workable */}
                <div className="iks-hero-card iks-hero-card--workable">
                    <div className="iks-hero-label">
                        {calcBasis === 'ar'
                            ? <>AR Workable <Tip text="Claims needing follow-up in the AR workflow cohort: Actual Deny + Third Prediction Expired No Response." /></>
                            : <>Total Workable <Tip text="Actionable workable: Third Prediction Expired No Response + Denial Actual." /></>
                        }
                    </div>
                    <div className="iks-hero-value iks-hero-value--cyan">
                        {calcBasis === 'ar'
                            ? formatNumber(opsFlowData.workable)
                            : formatNumber(workableFormulaParts.result)
                        }
                    </div>
                    {workableDelta !== null && (
                        <div className={`iks-hero-delta ${Number(workableDelta) > 0 ? 'negative' : Number(workableDelta) < 0 ? 'positive' : 'neutral'}`}>
                            {Number(workableDelta) > 0 ? '↑' : Number(workableDelta) < 0 ? '↓' : '→'}{Math.abs(Number(workableDelta))}% vs last month
                        </div>
                    )}
                    <div className="iks-hero-subtitle">
                        {calcBasis === 'ar' ? 'Claims needing AR follow-up' : 'Claims needing follow-up'}
                    </div>
                </div>

                {/* Payment Accuracy */}
                <div className="iks-hero-card iks-hero-card--payment">
                    <div className="iks-hero-label">
                        Payment Accuracy <Tip text="How often our AI correctly predicts a claim will be paid" />
                    </div>
                    <div className="iks-radial-ring-wrap">
                        <RadialRing
                            value={Number(selectedMonthData?.cards?.payment?.accuracy_pct || 0)}
                            ragClass={getRAGColor(Number(selectedMonthData?.cards?.payment?.accuracy_pct || 0), { green: 50, amber: 50 })}
                        />
                        <div className="iks-radial-ring-info">
                            <div className={`iks-hero-delta ${getTrendClass(selectedMonthData?.cards?.payment?.accuracy_delta_pct_points)}`}>
                                {getTrendArrow(selectedMonthData?.cards?.payment?.accuracy_delta_pct_points)} {selectedMonthData?.cards?.payment?.accuracy_delta_pct_points != null ? Math.abs(selectedMonthData.cards.payment.accuracy_delta_pct_points).toFixed(2) : 'N/A'}
                            </div>
                            <div className="iks-hero-subtitle">{formatNumber(selectedMonthData?.cards?.payment?.prediction || 0)} predicted</div>
                        </div>
                    </div>
                </div>

                {/* Denial Accuracy */}
                <div className="iks-hero-card iks-hero-card--denial">
                    <div className="iks-hero-label">
                        Denial Accuracy <Tip text="How well our AI spots claims that will be rejected" />
                    </div>
                    <div className="iks-radial-ring-wrap">
                        <RadialRing
                            value={Number(selectedMonthData?.cards?.denial?.accuracy_pct || 0)}
                            ragClass={getRAGColor(Number(selectedMonthData?.cards?.denial?.accuracy_pct || 0), { green: 50, amber: 50 })}
                        />
                        <div className="iks-radial-ring-info">
                            <div className={`iks-hero-delta ${getTrendClass(selectedMonthData?.cards?.denial?.accuracy_delta_pct_points)}`}>
                                {getTrendArrow(selectedMonthData?.cards?.denial?.accuracy_delta_pct_points)} {selectedMonthData?.cards?.denial?.accuracy_delta_pct_points != null ? Math.abs(selectedMonthData.cards.denial.accuracy_delta_pct_points).toFixed(2) : 'N/A'}
                            </div>
                            <div className="iks-hero-subtitle">{formatNumber(selectedMonthData?.cards?.denial?.prediction || 0)} predicted</div>
                        </div>
                    </div>
                </div>

                {/* AR Backlog */}
                <div className="iks-hero-card iks-hero-card--backlog">
                    <div className="iks-hero-label">
                        AR Backlog (Total Outstanding) <Tip text="Total outstanding insurance balance on claims that still need follow-up" />
                    </div>
                    <div className="iks-hero-value iks-hero-value--amber">
                        {formatDollar(getMonthBacklogBalance(arBacklog))}
                    </div>
                    <div className="iks-hero-subtitle">{formatNumber(getMonthBacklogCount(arBacklog))} encounters</div>
                </div>
            </div>

            {/* ══════ ZONE 2.5: Priority Actions Strip ══════ */}
            {priorityActions.length > 0 && (
                <div className="iks-priority-strip">
                    <span className="iks-priority-label">⚡ Priority Actions</span>
                    {priorityActions.map((action, i) => (
                        <span key={i} className="iks-priority-item">
                            <span className={`iks-priority-dot ${action.color}`} />
                            {action.text}
                        </span>
                    ))}
                </div>
            )}

            {/* ══════ ZONE 3: Operations Flow + Calendar ══════ */}
            <div className="iks-zone3-grid">
                {/* Operations Flow Sankey Diagram */}
                <div className="iks-ops-flow-panel">
                    <h3 className="iks-ops-flow-title" style={{ paddingLeft: '8px', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                        Operations Flow
                        {opsFlowData._source === 'live' && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ fontSize: '10px', fontWeight: 600, background: 'rgba(16,185,129,0.12)', color: '#10b981', border: '1px solid rgba(16,185,129,0.3)', borderRadius: '20px', padding: '2px 8px' }}>
                                    live
                                </span>
                                <span style={{ fontSize: '12px', color: '#9ca3af', fontWeight: 400, letterSpacing: '0.02em' }}>
                                    Refreshed: {new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZoneName: 'short' })}
                                </span>
                            </div>
                        )}
                    </h3>
                    <div style={{ width: '100%', height: '100%', padding: '0 8px' }}>
                        {(() => {
                            const VIEW_W = 860;
                            const VIEW_H = 320;
                            const NODE_W = 124;

                            // Accent colors per stage
                            const STAGE_COLORS = ['#22d3ee', '#818cf8', '#ef4444', '#f59e0b', '#34d399'];

                            const _l = opsFlowData._labels || ['ITTT Predicted', 'Responses Received', 'Total Denials', 'NPNR', 'Workable']
                            const _s = opsFlowData._subs  || ['Claims predicted to respond by today', 'Payment + denial actuals', 'Actual payer denials', 'No payer no response', 'Total denials + NPNR']
                            const flowData = [
                                { label: _l[0], value: opsFlowData.itttDue,   sub: _s[0] },
                                { label: _l[1], value: opsFlowData.responded, sub: _s[1] },
                                { label: _l[2], value: opsFlowData.denials,   sub: _s[2] },
                                { label: _l[3], value: opsFlowData.npnr,      sub: _s[3] },
                                { label: _l[4], value: opsFlowData.workable,  sub: _s[4] },
                            ];

                            const GAP = (VIEW_W - (flowData.length * NODE_W)) / (flowData.length - 1);
                            const maxVal = Math.max(...flowData.map(d => d.value), 1);
                            const itttPredicted = flowData[0].value || 1;
                            const minH = 60;
                            const maxH = 240;

                            const nodes = flowData.map((d, i) => {
                                const h = minH + (d.value / maxVal) * (maxH - minH);
                                const y = (VIEW_H - h) / 2;
                                const x = i * (NODE_W + GAP);
                                const pctOfPredicted = i > 0 && itttPredicted > 0 ? (d.value / itttPredicted * 100).toFixed(1) : '–';
                                return { ...d, x, y, w: NODE_W, h, pctOfPredicted, color: STAGE_COLORS[i], labelLines: splitOpsFlowLabel(d.label) };
                            });

                            const links = [];
                            for (let i = 0; i < nodes.length - 1; i++) {
                                const n1 = nodes[i];
                                const n2 = nodes[i + 1];
                                const x1 = n1.x + n1.w;
                                const x2 = n2.x;
                                const cp = (x2 - x1) / 2;
                                const path = `M ${x1} ${n1.y} C ${x1+cp} ${n1.y}, ${x2-cp} ${n2.y}, ${x2} ${n2.y} L ${x2} ${n2.y+n2.h} C ${x2-cp} ${n2.y+n2.h}, ${x1+cp} ${n1.y+n1.h}, ${x1} ${n1.y+n1.h} Z`;
                                links.push({ path, id: `link-${i}` });
                            }

                            return (
                                <div style={{ width: '100%', marginTop: '0.5rem' }}>
                                    {/* Sankey SVG */}
                                    <div style={{ width: '100%', aspectRatio: '800/300', position: 'relative' }}>
                                        <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} style={{ width: '100%', height: '100%', display: 'block', overflow: 'visible' }}>
                                            <defs>
                                                <linearGradient id="sankeyLinkGrad" x1="0" y1="0" x2="1" y2="0">
                                                    <stop offset="0%" stopColor="#2dd4bf" stopOpacity="0.3" />
                                                    <stop offset="100%" stopColor="#0f766e" stopOpacity="0.4" />
                                                </linearGradient>
                                                <linearGradient id="sankeyNodeGrad" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="0%" stopColor="#1e2d3e" stopOpacity="0.97" />
                                                    <stop offset="100%" stopColor="#111827" stopOpacity="0.97" />
                                                </linearGradient>
                                                <filter id="nodeShadow" x="-10%" y="-10%" width="120%" height="120%">
                                                    <feDropShadow dx="0" dy="3" stdDeviation="5" floodColor="#000" floodOpacity="0.3" />
                                                </filter>
                                            </defs>

                                            {/* Links */}
                                            {links.map(l => (
                                                <g key={l.id}>
                                                    <path d={l.path} fill="url(#sankeyLinkGrad)" style={{ transition: 'all 0.5s ease-out' }} />
                                                </g>
                                            ))}

                                            {/* Nodes */}
                                            {nodes.map((n, i) => (
                                                <g key={n.label} style={{ cursor: 'pointer' }} onClick={() => setActiveTab('dayDetail')}>
                                                    <rect x={n.x} y={n.y} width={n.w} height={n.h} rx={10}
                                                        fill="url(#sankeyNodeGrad)"
                                                        stroke={n.color} strokeWidth={1.5} strokeOpacity={0.5}
                                                        filter="url(#nodeShadow)" style={{ transition: 'all 0.5s ease-out' }}
                                                    />
                                                    {/* Top accent bar */}
                                                    <rect x={n.x + 10} y={n.y} width={n.w - 20} height={3} rx={2} fill={n.color} opacity={0.8} />
                                                    <foreignObject x={n.x} y={n.y} width={n.w} height={n.h}>
                                                        <div xmlns="http://www.w3.org/1999/xhtml" style={{
                                                            width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
                                                            alignItems: 'center', justifyContent: 'center', gap: '4px',
                                                            fontFamily: 'system-ui, -apple-system, sans-serif', padding: '8px 6px',
                                                            textAlign: 'center',
                                                        }}>
                                                            <div style={{ fontSize: '10px', color: n.color, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', lineHeight: 1.2 }}>
                                                                {n.labelLines.map((line) => (
                                                                    <div key={line}>{line}</div>
                                                                ))}
                                                            </div>
                                                            <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#f8fafc', letterSpacing: '-0.02em', lineHeight: 1.05 }}>{formatNumber(n.value)}</div>
                                                            {i > 0 && (
                                                                <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.45)', marginTop: '1px', lineHeight: 1.2 }}>
                                                                    {n.pctOfPredicted}% of ITTT
                                                                </div>
                                                            )}
                                                        </div>
                                                    </foreignObject>
                                                </g>
                                            ))}
                                        </svg>
                                    </div>

                                    <div className="iks-ops-flow-breakdown">
                                        <span className="iks-ops-flow-breakdown-label">{calcBasis === 'ar' ? 'AR Workable' : 'Workable'}</span>
                                        <span>{formatNumber(calcBasis === 'ar' ? opsFlowData.npnr : workableFormulaParts.thirdExpired)} expired no-response</span>
                                        <span>+</span>
                                        <span>{formatNumber(calcBasis === 'ar' ? opsFlowData.denials : workableFormulaParts.denialActual)} denial actual</span>
                                        <span>=</span>
                                        <strong>{formatNumber(calcBasis === 'ar' ? opsFlowData.workable : getDisplayedWorkableValue(detailsView === 'day' && selectedDayData ? selectedDayData : selectedMonthData?.totals))}</strong>
                                    </div>
                                </div>
                            )
                        })()}
                    </div>
                </div>

                {/* Calendar Heatmap */}
                <div className="iks-calendar-panel" id="iks-calendar-panel">
                    <h3 className="iks-calendar-title">
                        Calendar Heatmap
                        <small>{selectedMonthData?.label || formatMonthKeyLabel(selectedMonth)}</small>
                    </h3>
                    <div className="iks-calendar-note">
                        Calendar values use the workable total for each day.
                    </div>
                    <div className={`iks-calendar-compact ${selectedMonthData?.is_forecast ? 'forecast-month' : ''}`}>
                        <div className="optimix-iks-weekdays">
                            {DAY_LABELS.map((label) => (
                                <div key={label} className="optimix-iks-weekday">{label}</div>
                            ))}
                        </div>
                        <div className="optimix-iks-days-grid">
                            {calendarCells.map((cell) => {
                                if (cell.empty) {
                                    return <div key={cell.key} className="optimix-iks-day empty" />
                                }
                                const isAnomaly = anomalyDays.has(cell.date)
                                const heatLevel = cell.hasData ? getHeatmapLevel(cell.totalWorkable) : 0
                                return (
                                    <button
                                        key={cell.key}
                                        type="button"
                                        disabled={!cell.hasData}
                                        className={`optimix-iks-day ${cell.hasData ? 'has-data' : ''} ${selectedDate === cell.date ? 'selected' : ''} ${cell.isWeekend ? 'weekend' : ''} ${isAnomaly ? 'anomaly' : ''}`}
                                        data-heat={heatLevel}
                                        onClick={() => {
                                            setSelectedDate(cell.date)
                                            setDetailsView('day')
                                            setActiveTab('dayDetail')
                                        }}
                                        onMouseEnter={(e) => {
                                            if (!cell.hasData) return
                                            const rect = e.currentTarget.getBoundingClientRect()
                                            const sourceRow = selectedMonthData?.daily?.find(d => d.date === cell.date)
                                            setFormulaPopover({
                                                x: rect.left + rect.width / 2,
                                                y: rect.top - 8,
                                                parts: getWorkableFormulaParts(sourceRow),
                                                result: cell.formulaResult
                                            })
                                        }}
                                        onMouseLeave={() => setFormulaPopover(null)}
                                    >
                                        <span className="optimix-iks-day-number">{cell.day}</span>
                                        <span className="optimix-iks-day-value">
                                            {cell.hasData ? formatNumber(cell.totalWorkable) : '--'}
                                        </span>
                                    </button>
                                )
                            })}
                        </div>
                    </div>
                </div>
            </div>

            {/* Formula Popover (fixed position) */}
            {formulaPopover && (
                <div
                    className="optimix-iks-formula-popover"
                    style={{ left: formulaPopover.x, top: formulaPopover.y }}
                >
                    <div className="optimix-iks-fp-title">Workable Breakdown</div>
                    <div className="optimix-iks-fp-row"><span>Third Pred. Expired No Response</span><strong>{formatNumber(formulaPopover.parts.thirdExpired)}</strong></div>
                    <div className="optimix-iks-fp-row"><span>+ Denial Actual</span><strong>{formatNumber(formulaPopover.parts.denialActual)}</strong></div>
                    <div className="optimix-iks-fp-result"><span>= Workable</span><strong>{formatNumber(formulaPopover.parts.result)}</strong></div>
                </div>
            )}

            {/* ══════ ZONE 4: Tabbed Detail Panel ══════ */}
            <div className="iks-tabs-panel">
                <div className="iks-tab-header">
                    <button className={`iks-tab-btn ${activeTab === 'trends' ? 'active' : ''}`} onClick={() => setActiveTab('trends')}>
                        📈 Trends
                    </button>
                    <button className={`iks-tab-btn ${activeTab === 'dayDetail' ? 'active' : ''}`} onClick={() => setActiveTab('dayDetail')}>
                        📋 Day Detail
                    </button>
                    <button className={`iks-tab-btn ${activeTab === 'advanced' ? 'active' : ''}`} onClick={() => setActiveTab('advanced')}>
                        🔬 Advanced
                    </button>
                </div>

                <div className="iks-tab-content">
                    {/* ── TRENDS TAB ── */}
                    {activeTab === 'trends' && (
                        <div className="iks-charts-grid">
                            {/* Prediction vs Response */}
                            <div className="iks-chart-card">
                                <h4>Prediction vs Response Trend</h4>
                                <p>Claims sent vs answers received vs follow-up needed each day</p>
                                <ResponsiveContainer width="100%" height={220}>
                                    <LineChart data={chartData}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                                        <XAxis dataKey="day_label" {...denseDayAxisProps} />
                                        <YAxis tick={{ fill: '#64748b', fontSize: 11 }} />
                                        <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#e2e8f0' }} />
                                        <Legend />
                                        <Line type="monotone" dataKey="total_prediction" name="Prediction" stroke="#22d3ee" dot={false} strokeWidth={2} />
                                        <Line type="monotone" dataKey="total_response" name="Response" stroke="#34d399" dot={false} strokeWidth={2} />
                                        <Line type="monotone" dataKey="total_workable" name="Workable" stroke="#f59e0b" dot={false} strokeWidth={2} />
                                    </LineChart>
                                </ResponsiveContainer>
                                {chartData.length > 1 && (() => {
                                    const last = chartData[chartData.length - 1]
                                    const first = chartData[0]
                                    const gap = (last?.total_prediction || 0) - (last?.total_response || 0)
                                    const prevGap = (first?.total_prediction || 0) - (first?.total_response || 0)
                                    return gap > prevGap ? (
                                        <div className="iks-chart-insight"><strong>Explore:</strong> widening gap between Prediction and Response over multiple days indicates follow-up backlog risk.</div>
                                    ) : null
                                })()}
                            </div>

                            {/* Payment and Denial Outcomes */}
                            <div className="iks-chart-card">
                                <h4>Payment and Denial Outcomes</h4>
                                <p>Actual payments vs denials each day — shows collection health</p>
                                <ResponsiveContainer width="100%" height={220}>
                                    <BarChart data={chartData}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                                        <XAxis dataKey="day_label" {...denseDayAxisProps} />
                                        <YAxis tick={{ fill: '#64748b', fontSize: 11 }} />
                                        <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#e2e8f0' }} />
                                        <Legend />
                                        <Bar dataKey="denial_actual" name="Denial Actual" fill="#fb923c" radius={[2, 2, 0, 0]} />
                                        <Bar dataKey="payment_actual" name="Payment Actual" fill="#22d3ee" radius={[2, 2, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>

                            {/* Workable Trend */}
                            <div className="iks-chart-card">
                                <h4>Workable Trend</h4>
                                <p>Total workable claims over the month — rising line = growing backlog</p>
                                <ResponsiveContainer width="100%" height={220}>
                                    <AreaChart data={chartData}>
                                        <defs>
                                            <linearGradient id="workableGrad" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                                                <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.02} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                                        <XAxis dataKey="day_label" {...denseDayAxisProps} />
                                        <YAxis tick={{ fill: '#64748b', fontSize: 11 }} />
                                        <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#e2e8f0' }} />
                                        <Area type="monotone" dataKey="total_workable" name="Total Workable" stroke="#f59e0b" fill="url(#workableGrad)" strokeWidth={2} />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>

                            {/* Denial vs Payment Predicted */}
                            <div className="iks-chart-card">
                                <h4>Denial Predicted vs Payment Predicted</h4>
                                <p>Side-by-side predicted outcomes — shows AI confidence distribution</p>
                                <ResponsiveContainer width="100%" height={220}>
                                    <BarChart data={chartData}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                                        <XAxis dataKey="day_label" {...denseDayAxisProps} />
                                        <YAxis tick={{ fill: '#64748b', fontSize: 11 }} />
                                        <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#e2e8f0' }} />
                                        <Legend />
                                        <Bar dataKey="denial_prediction" name="Denial Predicted" fill="#f87171" radius={[2, 2, 0, 0]} />
                                        <Bar dataKey="payment_prediction" name="Payment Predicted" fill="#34d399" radius={[2, 2, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>

                            {/* AR Backlog Trend */}
                            {arBacklog?.trend && arBacklog.trend.length > 0 && (
                                <div className="iks-chart-card">
                                    <h4>AR Workable Backlog Aging Trend</h4>
                                    <p>How the backlog changes over time — helps spot buildup</p>
                                    <ResponsiveContainer width="100%" height={220}>
                                        <BarChart data={arBacklog.trend}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                                            <XAxis dataKey="date" tickFormatter={formatCompactDayTick} tick={{ fill: '#64748b', fontSize: 11 }} tickMargin={8} minTickGap={14} interval={arBacklog?.trend?.length > 24 ? 3 : arBacklog?.trend?.length > 16 ? 1 : 0} />
                                            <YAxis tick={{ fill: '#64748b', fontSize: 11 }} />
                                            <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#e2e8f0' }} />
                                            <Bar dataKey="backlog_count" name="Backlog Count" fill="#8b5cf6" radius={[2, 2, 0, 0]} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            )}
                        </div>
                    )}

                    {/* ── DAY DETAIL TAB ── */}
                    {activeTab === 'dayDetail' && (
                        <>
                            <div className="iks-day-detail-header">
                                <h3>{detailsView === 'day'
                                    ? `${selectedDayData ? formatAxisDate(selectedDayData.date) : 'Select a day'}${selectedDayData?.is_forecast_day ? ' (Forecast)' : ''}`
                                    : `${selectedMonthData?.label || formatMonthKeyLabel(selectedMonth)} — Month Summary`
                                }</h3>
                                <div className="iks-detail-toggle">
                                    <button className={detailsView === 'day' ? 'active' : ''} onClick={() => setDetailsView('day')}>Day</button>
                                    <button className={detailsView === 'month' ? 'active' : ''} onClick={() => setDetailsView('month')}>Month</button>
                                </div>
                            </div>

                            {detailsView === 'day' && !selectedDayData ? (
                                <p className="iks-no-data-msg">Click a day on the calendar to see its detailed breakdown.</p>
                            ) : (
                                <>
                                    <div className="iks-metric-groups">
                                        {/* Billing & Response Group */}
                                        <div className="iks-metric-group iks-metric-group--billing">
                                            <h5>ITTT & Response</h5>
                                            <div className="iks-metric-row">
                                                <span>Total Response <Tip text={METRIC_COLUMNS[3].tooltip} /></span>
                                                <strong>{formatNumber(detailsView === 'day' ? selectedDayData?.total_response : selectedMonthData?.totals?.Total_Response)}</strong>
                                            </div>
                                            <div className="iks-metric-row">
                                                <span>ITTT Predicted <Tip text={METRIC_COLUMNS[1].tooltip} /></span>
                                                <strong>{formatNumber(detailsView === 'day' ? selectedDayData?.total_prediction : selectedMonthData?.totals?.Total_Prediction)}</strong>
                                            </div>
                                        </div>

                                        {/* Predictions vs Actuals Group */}
                                        <div className="iks-metric-group iks-metric-group--predictions">
                                            <h5>Predictions vs Actuals</h5>
                                            <div className="iks-metric-row">
                                                <span>Payment Pred <Tip text={METRIC_COLUMNS[5].tooltip} /></span>
                                                <strong>{formatNumber(detailsView === 'day' ? selectedDayData?.payment_prediction : selectedMonthData?.totals?.Payment_Prediction)}</strong>
                                            </div>
                                            <div className="iks-metric-row">
                                                <span>
                                                    Payment Actual <Tip text={METRIC_COLUMNS[6].tooltip} />
                                                </span>
                                                <strong className={(() => {
                                                    const pred = Number(detailsView === 'day' ? selectedDayData?.payment_prediction : selectedMonthData?.totals?.Payment_Prediction || 0)
                                                    const actual = Number(detailsView === 'day' ? selectedDayData?.payment_actual : selectedMonthData?.totals?.Payment_Actual || 0)
                                                    return pred > 0 && actual < pred * 0.5 ? 'iks-actual-bad' : ''
                                                })()}>
                                                    {formatNumber(detailsView === 'day' ? selectedDayData?.payment_actual : selectedMonthData?.totals?.Payment_Actual)}
                                                </strong>
                                            </div>
                                            <div className="iks-metric-row">
                                                <span>Denial Pred <Tip text={METRIC_COLUMNS[7].tooltip} /></span>
                                                <strong>{formatNumber(detailsView === 'day' ? selectedDayData?.denial_prediction : selectedMonthData?.totals?.Denial_Prediction)}</strong>
                                            </div>
                                            <div className="iks-metric-row">
                                                <span>Denial Actual <Tip text={METRIC_COLUMNS[8].tooltip} /></span>
                                                <strong>{formatNumber(detailsView === 'day' ? selectedDayData?.denial_actual : selectedMonthData?.totals?.Denial_Actual)}</strong>
                                            </div>
                                        </div>

                                        {/* Workable Breakdown Group */}
                                        <div className="iks-metric-group iks-metric-group--workable">
                                            <h5>Workable Breakdown</h5>
                                            <div className="iks-metric-row">
                                                <span>No Response (Expired) <Tip text={METRIC_COLUMNS[4].tooltip} /></span>
                                                <strong>{formatNumber(detailsView === 'day' ? selectedDayData?.third_prediction_expired_no_response : selectedMonthData?.totals?.ThirdPredictionExpired_NoResponse)}</strong>
                                            </div>
                                            <div className="iks-metric-row">
                                                <span>Denial Actual</span>
                                                <strong>{formatNumber(detailsView === 'day' ? selectedDayData?.denial_actual : selectedMonthData?.totals?.Denial_Actual)}</strong>
                                            </div>
                                            <div className="iks-metric-row">
                                                <span>Payment But Denied <Tip text={METRIC_COLUMNS[9].tooltip} /></span>
                                                <strong>{formatNumber(detailsView === 'day' ? selectedDayData?.payment_but_denied : selectedMonthData?.totals?.Payment_But_Denied)}</strong>
                                            </div>
                                            <div className="iks-metric-row total">
                                                <span>Total Workable</span>
                                                <strong>{formatNumber(detailsView === 'day' ? selectedDayData?.total_workable : workableFormulaParts.result)}</strong>
                                            </div>
                                            <div className="iks-formula-text">
                                                Actionable workable: {formatNumber(detailsView === 'day' ? selectedDayData?.third_prediction_expired_no_response : selectedMonthData?.totals?.ThirdPredictionExpired_NoResponse || 0)} + {formatNumber(detailsView === 'day' ? selectedDayData?.denial_actual : selectedMonthData?.totals?.Denial_Actual || 0)}
                                            </div>
                                            <div className="iks-formula-text">
                                                Actionable workable total = {formatNumber(workableFormulaParts.result)}
                                            </div>
                                            <div className="iks-formula-text">
                                                This matches the live SQL-backed workable total shown above.
                                            </div>
                                        </div>
                                    </div>

                                    {/* AR Backlog + Phase Breakdown */}
                                    {arBacklog && (
                                        <div className="iks-phase-breakdown">
                                            <h5>
                                                AR Backlog Phase Breakdown
                                                <Tip text="Distribution of workable backlog across client phases" />
                                            </h5>
                                            <div className="iks-phase-bars">
                                                {(() => {
                                                    const phases = detailsView === 'day' && selectedDayData
                                                        ? (arBacklog?.phase_trend ? getPhaseBreakdownForDate(arBacklog.phase_trend, selectedDayData.date, 'day') : arBacklog?.by_phase || {})
                                                        : (arBacklog?.by_phase || {})
                                                    return Object.entries(phases)
                                                        .sort(([a], [b]) => a.localeCompare(b))
                                                        .map(([phase, count]) => (
                                                            <div key={phase} className="iks-phase-bar">
                                                                <span className="iks-phase-bar-label">{phase}</span>
                                                                <span className="iks-phase-bar-value">{formatNumber(count)}</span>
                                                            </div>
                                                        ))
                                                })()}
                                            </div>
                                        </div>
                                    )}

                                    {/* Backlog Dollar Value */}
                                    {arBacklog?.trend && (
                                        <div style={{ marginTop: '0.5rem', display: 'flex', gap: '1rem', fontSize: '0.82rem' }}>
                                            <span style={{ color: '#94a3b8' }}>Total Workable ($) <Tip text="Cumulative insurance balance of AR Workable Backlog" /></span>
                                            <strong style={{ color: '#34d399' }}>
                                                {formatDollar(
                                                    detailsView === 'day' && selectedDayData
                                                        ? getCalculatedBacklogBalance(arBacklog.trend, selectedDayData.date, 'day')
                                                        : getMonthBacklogBalance(arBacklog)
                                                )}
                                            </strong>
                                        </div>
                                    )}
                                </>
                            )}
                        </>
                    )}

                    {/* ── ADVANCED TAB ── */}
                    {activeTab === 'advanced' && (
                        <>
                            {/* Yearly Forecast */}
                            {yearlyForecast && (
                                <div className="iks-yearly-summary">
                                    <h4>Yearly Forecast ({yearlyForecast.year})</h4>
                                    <div className="iks-yearly-grid">
                                        <div className="iks-yearly-card">
                                            <div className="label">Total Predicted Volume</div>
                                            <div className="value">{formatNumber(yearlyForecast.Total_Prediction)}</div>
                                        </div>
                                        <div className="iks-yearly-card">
                                            <div className="label">Total Workable Volume</div>
                                            <div className="value">{formatNumber(yearlyForecast.Total_Workable)}</div>
                                        </div>
                                        <div className="iks-yearly-card">
                                            <div className="label">Total Response Volume</div>
                                            <div className="value">{formatNumber(yearlyForecast.Total_Response)}</div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            <h4 className="iks-advanced-section-title">Model Performance Analytics</h4>
                            <div className="iks-charts-grid">
                                {/* MAPE */}
                                <div className="iks-chart-card">
                                    <h4>Mean Absolute Percentage Error (MAPE)</h4>
                                    <p>Lower is better — measures prediction accuracy</p>
                                    <ResponsiveContainer width="100%" height={200}>
                                        <AreaChart data={chartData}>
                                            <defs>
                                                <linearGradient id="mapeGrad" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                                                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.02} />
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                                            <XAxis dataKey="day_label" {...denseDayAxisProps} />
                                            <YAxis tick={{ fill: '#64748b', fontSize: 11 }} />
                                            <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#e2e8f0' }} />
                                            <Area type="monotone" dataKey="mape" name="MAPE %" stroke="#8b5cf6" fill="url(#mapeGrad)" strokeWidth={2} />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </div>

                                {/* Prediction Bias */}
                                <div className="iks-chart-card">
                                    <h4>Prediction Bias %</h4>
                                    <p>Positive = over-predicting, Negative = under-predicting</p>
                                    <ResponsiveContainer width="100%" height={200}>
                                        <LineChart data={chartData}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                                            <XAxis dataKey="day_label" {...denseDayAxisProps} />
                                            <YAxis tick={{ fill: '#64748b', fontSize: 11 }} />
                                            <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#e2e8f0' }} />
                                            <ReferenceLine y={0} stroke="rgba(255,255,255,0.2)" strokeDasharray="3 3" />
                                            <Line type="monotone" dataKey="bias" name="Bias %" stroke="#f97316" dot={false} strokeWidth={2} />
                                        </LineChart>
                                    </ResponsiveContainer>
                                </div>

                                {/* Calibration Curve */}
                                <div className="iks-chart-card">
                                    <h4>Calibration Curve</h4>
                                    <p>Scatter of predicted vs actual probability bins</p>
                                    <ResponsiveContainer width="100%" height={200}>
                                        <ScatterChart>
                                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                                            <XAxis dataKey="calibration_prob" name="Predicted %" tick={{ fill: '#64748b', fontSize: 11 }} />
                                            <YAxis dataKey="ae_ratio" name="A/E Ratio" tick={{ fill: '#64748b', fontSize: 11 }} />
                                            <ZAxis range={[30, 80]} />
                                            <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#e2e8f0' }} />
                                            <Scatter name="Calibration" data={chartData} fill="#22d3ee" />
                                        </ScatterChart>
                                    </ResponsiveContainer>
                                </div>

                                {/* A/E Ratio */}
                                <div className="iks-chart-card">
                                    <h4>Actual vs Expected (A/E) Ratio</h4>
                                    <p>Values close to 1.0 = well-calibrated predictions</p>
                                    <ResponsiveContainer width="100%" height={200}>
                                        <ComposedChart data={chartData}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                                            <XAxis dataKey="day_label" {...denseDayAxisProps} />
                                            <YAxis tick={{ fill: '#64748b', fontSize: 11 }} />
                                            <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#e2e8f0' }} />
                                            <ReferenceLine y={1} stroke="rgba(52, 211, 153, 0.4)" label={{ value: 'Perfect', fill: '#34d399', fontSize: 10 }} strokeDasharray="4 4" />
                                            <Bar dataKey="ae_ratio" name="A/E Ratio" fill="#6366f1" radius={[2, 2, 0, 0]} />
                                        </ComposedChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>

                        </>
                    )}
                </div>
            </div>

            {/* BigQuery Source */}
            {insights?.bigquery_sql && (
                <details className="optimix-iks-query-block">
                    <summary>📊 BigQuery Source Query</summary>
                    <pre>{insights.bigquery_sql}</pre>
                </details>
            )}

            {/* Ops Manager extended KPI sections */}
            <OpsManagerExtendedView
                calcBasis={calcBasis}
                selectedMonth={selectedMonth}
                selectedClient={selectedClient}
                refreshToken={personaRefreshToken}
            />

            </>
            )}

            {/* Sr. Leader view */}
            {persona === 'sr-leader' && (
                <SrLeaderView
                    selectedMonth={selectedMonth}
                    selectedClient={selectedClient}
                    selectedMonthData={selectedMonthData}
                    refreshToken={personaRefreshToken}
                />
            )}

            {persona === 'work-plan' && (
                <WorkPlanView
                    selectedMonth={selectedMonth}
                    selectedClient={selectedClient}
                    refreshToken={personaRefreshToken}
                    onOpenCalendarView={openArWorkableCalendarView}
                />
            )}

            {/* ══════ CHATBOT PORTAL (kept as-is) ══════ */}
            {createPortal(
                <div className="optimix-iks-orbit-portal">
                    <div className={`optimix-iks-chat-widget ${isChatOpen ? 'open' : ''}`}>
                        <div className="optimix-iks-chatbot-panel">
                            <div className="optimix-iks-chatbot-header">
                                <div className="optimix-iks-chatbot-header-title">
                                    <h3>ASK CLAIM <small>AI Assistant</small></h3>
                                    <span>Ask about metrics, trends, and what to explore</span>
                                </div>
                                <button className="optimix-iks-chatbot-close" onClick={() => setIsChatOpen(false)}>
                                    <X size={16} />
                                </button>
                            </div>

                            <div className="optimix-iks-orbit-quick-actions">
                                {ORBIT_QUICK_ACTIONS.map((action) => (
                                    <button key={action.label} className="optimix-iks-orbit-action-btn" onClick={() => handleChatSend(action.query)}>
                                        {action.label}
                                    </button>
                                ))}
                            </div>

                            <div className="optimix-iks-chatbot-log" ref={chatLogRef}>
                                {chatMessages.map((msg, i) => (
                                    <div key={i} className={`optimix-iks-chatbot-msg ${msg.role} ${msg.typing ? 'typing' : ''}`}>
                                        <strong>{msg.role === 'user' ? 'You' : 'CLAIM AI'}</strong>
                                        <div className="optimix-iks-chatbot-bubble">
                                            <p>{renderChatText(msg.text)}</p>
                                        </div>
                                        {msg.source && (
                                            <span className="optimix-iks-chatbot-source">Source: {msg.source}</span>
                                        )}
                                    </div>
                                ))}
                            </div>

                            <div className="optimix-iks-chatbot-suggestions">
                                {CHATBOT_SUGGESTIONS.map((s) => (
                                    <button key={s} className="optimix-iks-chat-suggest-chip" onClick={() => handleChatSend(s)}>
                                        {s}
                                    </button>
                                ))}
                            </div>

                            <div className="optimix-iks-chatbot-input-row">
                                <input
                                    type="text"
                                    value={chatInput}
                                    onChange={(e) => setChatInput(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleChatSend(chatInput)}
                                    placeholder="Ask about claims, metrics, trends..."
                                />
                                <button className="optimix-iks-chat-mic-btn" onClick={() => chatMicRef.current?.startListening()} title="Voice Search">
                                    <Mic size={18} />
                                </button>
                                <VoiceAssistant
                                    onVoiceInput={(text) => { setChatInput(text); handleChatSend(text) }}
                                    embedded={true}
                                    micRef={chatMicRef}
                                />
                            </div>
                        </div>
                    </div>
                    <button
                        className={`optimix-iks-chatbot-fab ${isChatOpen ? 'open' : ''}`}
                        onClick={() => setIsChatOpen(prev => !prev)}
                        title="ASK CLAIM"
                    >
                        {isChatOpen ? <X size={22} /> : <MessageSquare size={22} />}
                    </button>
                </div>,
                document.body
            )}
        </div>
    )
}

// --- Helper to parse simple markdown bold tags ---
const renderChatText = (text) => {
    if (!text) return null;
    const parts = text.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, index) => {
        if (part.startsWith('**') && part.endsWith('**')) {
            return <strong key={index} style={{ color: 'inherit', fontWeight: 600 }}>{part.slice(2, -2)}</strong>;
        }
        return part;
    });
};

export default OptimixIKSInsights
