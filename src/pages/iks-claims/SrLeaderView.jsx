/**
 * SrLeaderView — Sr. Leader persona sections for the IKS Claims tab.
 *
 * Sections:
 *   1. ROI Hero  — Touchless Automation Rate + Cost to Collect
 *   2. Model Trust — Payment Accuracy donut, Denial Accuracy donut, Prediction Bias
 *   3. Financial Health — Cash Collected MTD + Total A/R Impact stacked bar
 *   4. Write-off Risk Exposure — 90+ Day AR (91–120d + 120+d) + 6-mo trend
 */
import { useEffect, useState } from 'react'
import {
    Bar, BarChart, CartesianGrid, Cell,
    PieChart, Pie, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend,
} from 'recharts'
import { formatCurrencyCompact, formatPercent } from '../../utils/formatters'
import { LEADER_MOCK } from './mockData'

// ─── Internal helpers ─────────────────────────────────────────────────────────

function SparkLine({ values, color }) {
    const max = Math.max(...values, 1)
    return (
        <div className="iks-leader-spark">
            {values.map((v, i) => (
                <div
                    key={i}
                    className="iks-leader-spark-bar"
                    style={{
                        height: `${Math.max(12, (v / max) * 100)}%`,
                        background: i === values.length - 1 ? color : 'rgba(255,255,255,0.12)',
                    }}
                />
            ))}
        </div>
    )
}

function ProgressBar({ value, target, color }) {
    const pct = Math.min(100, (value / target) * 100)
    return (
        <div className="iks-leader-progress-track">
            <div className="iks-leader-progress-fill" style={{ width: `${pct}%`, background: color }} />
            <div className="iks-leader-progress-target" style={{ left: '100%' }} />
        </div>
    )
}

// Donut chart for Model Trust section
function AccuracyDonut({ label, value, color }) {
    const data = [
        { name: label, value },
        { name: 'rest', value: 1 - value },
    ]
    return (
        <div className="iks-leader-donut-card">
            <div className="iks-leader-donut-label">{label}</div>
            <div className="iks-leader-donut-wrap">
                <ResponsiveContainer width="100%" height={120}>
                    <PieChart>
                        <Pie
                            data={data}
                            dataKey="value"
                            cx="50%"
                            cy="50%"
                            innerRadius={36}
                            outerRadius={52}
                            startAngle={90}
                            endAngle={-270}
                            strokeWidth={0}
                        >
                            <Cell fill={color} />
                            <Cell fill="rgba(255,255,255,0.07)" />
                        </Pie>
                    </PieChart>
                </ResponsiveContainer>
                <div className="iks-leader-donut-center" style={{ color }}>
                    {(value * 100).toFixed(1)}%
                </div>
            </div>
            <div className="iks-leader-donut-sub" style={{ color }}>
                {value >= 0.9 ? 'Green — on track' : value >= 0.8 ? 'Amber — monitor' : 'Red — review'}
            </div>
        </div>
    )
}

function ChartTooltip({ active, payload, label, fmt }) {
    if (!active || !payload?.length) return null
    return (
        <div className="iks-ops-tooltip">
            <p className="iks-ops-tooltip-label">{label}</p>
            {payload.map((entry) => (
                <p key={entry.dataKey} style={{ color: entry.color || entry.fill }}>
                    {entry.name}: {fmt ? fmt(entry.value) : entry.value}
                </p>
            ))}
        </div>
    )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function SrLeaderView({ selectedMonth = '', selectedClient = '', selectedMonthData = null, refreshToken = 0 }) {
    const m = LEADER_MOCK

    // Live accuracy from ITTT_PP_Output (/ittt-accuracy)
    const [liveAccuracy,  setLiveAccuracy]  = useState(null)
    // Live financial from ITTT_PP_Output (/ittt-financial)
    const [liveFinancial, setLiveFinancial] = useState(null)

    useEffect(() => {
        const params = new URLSearchParams()
        if (selectedMonth) params.set('month', selectedMonth)
        if (selectedClient && !['all', 'all clients', 'all phases'].includes(String(selectedClient).trim().toLowerCase())) {
            params.set('phase', selectedClient)
        }
        if (refreshToken) params.set('refresh', 'true')
        const query = params.toString() ? `?${params.toString()}` : ''

        fetch(`/api/optimix/iks/ittt-accuracy${query}`, {
            cache: 'no-store',
        })
            .then((r) => r.ok ? r.json() : null)
            .then((d) => { if (d && !d.error) setLiveAccuracy(d) })
            .catch(() => {})

        fetch(`/api/optimix/iks/ittt-financial${query}`, {
            cache: 'no-store',
        })
            .then((r) => r.ok ? r.json() : null)
            .then((d) => { if (d && !d.error) setLiveFinancial(d) })
            .catch(() => {})
    }, [selectedMonth, selectedClient, refreshToken])

    // Model accuracy: prefer ITTT_PP_Output live data, then insights API, then mock
    const livePaymentAccuracy = liveAccuracy?.payment_accuracy
        ?? (selectedMonthData?.cards?.payment?.accuracy_pct != null
            ? selectedMonthData.cards.payment.accuracy_pct / 100
            : m.payment_accuracy)
    const liveDenialAccuracy = liveAccuracy?.denial_accuracy
        ?? (selectedMonthData?.cards?.denial?.accuracy_pct != null
            ? selectedMonthData.cards.denial.accuracy_pct / 100
            : m.denial_accuracy)
    const livePredictionBias = liveAccuracy?.prediction_bias ?? m.prediction_bias

    const paymentDelta = selectedMonthData?.cards?.payment?.accuracy_delta_pct_points
    const denialDelta  = selectedMonthData?.cards?.denial?.accuracy_delta_pct_points
    const isLiveAccuracy = !!(liveAccuracy || selectedMonthData?.cards?.payment?.accuracy_pct != null)

    // Financial: prefer ITTT_PP_Output live data, then mock
    const cashCollectedMtd  = liveFinancial?.cash_collected_mtd  ?? m.cash_collected_mtd
    const arImpactTotal     = liveFinancial?.ar_impact_total      ?? m.ar_impact_total
    const arImpactDenial    = liveFinancial?.ar_impact_denial     ?? m.ar_impact_denial
    const arImpactNpnr      = liveFinancial?.ar_impact_npnr       ?? m.ar_impact_npnr
    const arImpactTrend     = liveFinancial?.trend?.map((t) => ({
        month: t.month, denial: t.ar_impact_denial, npnr: t.ar_impact_npnr,
    })) ?? m.ar_impact_trend
    const isLiveFinancial   = !!liveFinancial

    // Format context label for the header
    const contextLabel = [selectedClient, selectedMonth].filter(Boolean).join(' · ')

    // RAG helpers
    const touchlessRag = m.touchless_rate >= m.touchless_target ? '#10b981'
        : m.touchless_rate >= m.touchless_target * 0.75 ? '#f59e0b' : '#ef4444'
    const costRag = m.cost_to_collect <= m.cost_target ? '#10b981'
        : m.cost_to_collect <= m.cost_target * 1.2 ? '#f59e0b' : '#ef4444'

    return (
        <div className="iks-leader-view">

            {/* Context bar — shows selected month / phase */}
            {contextLabel && (
                <div className="iks-leader-context-bar">
                    <span className="iks-leader-context-label">Viewing:</span>
                    <span className="iks-leader-context-value">{contextLabel}</span>
                    <span style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
                        {isLiveAccuracy  && <span className="iks-ops-source-badge iks-ops-source-live">● Live — Model Trust</span>}
                        {isLiveFinancial && <span className="iks-ops-source-badge iks-ops-source-live">● Live — Financial</span>}
                        {!isLiveAccuracy && !isLiveFinancial && <span className="iks-ops-source-badge iks-ops-source-mock">○ Mock data</span>}
                    </span>
                </div>
            )}

            {/* ═══════════════════════════════════════════
                SECTION 1 — ROI HERO
            ═══════════════════════════════════════════ */}
            <div className="iks-ops-section">
                <div className="iks-ops-section-head">
                    <h3>Automation ROI</h3>
                    <p>Strategic KPIs measuring touchless throughput and collection efficiency. (Mock — backend endpoint pending)</p>
                </div>
                <div className="iks-leader-hero-grid">

                    {/* Touchless Automation Rate */}
                    <div className="iks-leader-hero-card">
                        <div className="iks-leader-hero-eyebrow">Touchless Automation Rate</div>
                        <div className="iks-leader-hero-value" style={{ color: touchlessRag }}>
                            {(m.touchless_rate * 100).toFixed(1)}%
                        </div>
                        <div className="iks-leader-hero-target">
                            Target: {(m.touchless_target * 100).toFixed(0)}%
                        </div>
                        <ProgressBar value={m.touchless_rate} target={m.touchless_target} color={touchlessRag} />
                        <SparkLine values={m.touchless_spark} color={touchlessRag} />
                        <div className="iks-leader-hero-sub">
                            Claims fully resolved without human touch / Total claims received
                        </div>
                    </div>

                    {/* Cost to Collect */}
                    <div className="iks-leader-hero-card">
                        <div className="iks-leader-hero-eyebrow">Cost to Collect</div>
                        <div className="iks-leader-hero-value" style={{ color: costRag }}>
                            ${m.cost_to_collect.toFixed(2)}
                        </div>
                        <div className="iks-leader-hero-target">
                            Target: ${m.cost_target.toFixed(2)} per claim
                        </div>
                        <ProgressBar value={m.cost_target} target={m.cost_to_collect} color={costRag} />
                        <SparkLine values={m.cost_spark} color={costRag} />
                        <div className="iks-leader-hero-sub">
                            Total AR operations cost / Claims resolved MTD. Downtrend = improvement.
                        </div>
                    </div>
                </div>
            </div>

            {/* ═══════════════════════════════════════════
                SECTION 2 — MODEL TRUST
            ═══════════════════════════════════════════ */}
            <div className="iks-ops-section">
                <div className="iks-ops-section-head">
                    <h3>
                        Model Trust
                        <span className={`iks-ops-source-badge iks-ops-source-${isLiveAccuracy ? 'live' : 'mock'}`} style={{ marginLeft: 10 }}>
                            {isLiveAccuracy ? '● Live' : '○ Mock'}
                        </span>
                    </h3>
                    <p>
                        AI prediction accuracy and calibration for payment and denial models.
                        {isLiveAccuracy ? ` Showing live data for ${selectedMonth}${selectedClient ? ` · ${selectedClient}` : ''}.` : ' No live data for selected period — showing mock.'}
                    </p>
                </div>
                <div className="iks-leader-trust-grid">
                    <AccuracyDonut
                        label={`Payment Accuracy${paymentDelta != null ? `  ${paymentDelta >= 0 ? '↑' : '↓'}${Math.abs(paymentDelta).toFixed(2)}pp` : ''}`}
                        value={livePaymentAccuracy}
                        color={livePaymentAccuracy >= 0.9 ? '#10b981' : '#f59e0b'}
                    />
                    <AccuracyDonut
                        label={`Denial Accuracy${denialDelta != null ? `  ${denialDelta >= 0 ? '↑' : '↓'}${Math.abs(denialDelta).toFixed(2)}pp` : ''}`}
                        value={liveDenialAccuracy}
                        color={liveDenialAccuracy >= 0.9 ? '#10b981' : '#f59e0b'}
                    />
                    <div className="iks-leader-donut-card">
                        <div className="iks-leader-donut-label">Prediction Bias</div>
                        <div className="iks-leader-donut-wrap iks-leader-bias-wrap">
                            <div
                                className="iks-leader-bias-value"
                                style={{ color: Math.abs(livePredictionBias || 0) <= 0.02 ? '#10b981' : '#f59e0b' }}
                            >
                                {(livePredictionBias || 0) >= 0 ? '+' : ''}{((livePredictionBias || 0) * 100).toFixed(1)}%
                            </div>
                            <div className="iks-leader-bias-label">
                                {(livePredictionBias || 0) > 0 ? 'Over-prediction' : (livePredictionBias || 0) < 0 ? 'Under-prediction' : 'Calibrated'}
                            </div>
                            <div className="iks-leader-bias-rates">
                                <span>Predicted: {((liveAccuracy?.payment_predicted_rate || m.payment_predicted_rate || 0) * 100).toFixed(1)}%</span>
                                <span>Actual: {((liveAccuracy?.payment_actual_rate || m.payment_actual_rate || 0) * 100).toFixed(1)}%</span>
                            </div>
                        </div>
                        <div className="iks-leader-donut-sub" style={{ color: '#9ca3af' }}>
                            Predicted ÷ Actual payment rate · Target ratio ≤ 1.02
                        </div>
                    </div>
                </div>
            </div>

            {/* ═══════════════════════════════════════════
                SECTION 3 — FINANCIAL HEALTH
            ═══════════════════════════════════════════ */}
            <div className="iks-ops-section">
                <div className="iks-ops-section-head">
                    <h3>Financial Health</h3>
                    <p>Cash collection progress vs target and total A/R impact by denial and NPNR categories.</p>
                </div>
                <div className="iks-leader-finance-grid">

                    {/* Cash Collected MTD */}
                    <div className="iks-ops-chart-card iks-leader-cash-card">
                        <div className="iks-leader-cash-label">Cash Collected MTD</div>
                        <div className="iks-leader-cash-value" style={{ color: '#10b981' }}>
                            {formatCurrencyCompact(cashCollectedMtd)}
                        </div>
                        <div className="iks-leader-cash-target">
                            Target: {formatCurrencyCompact(m.cash_monthly_target)} / month
                        </div>
                        <div className="iks-leader-cash-pct">
                            {((cashCollectedMtd / m.cash_monthly_target) * 100).toFixed(1)}% of target
                        </div>
                        <ProgressBar value={cashCollectedMtd} target={m.cash_monthly_target} color="#10b981" />
                        <SparkLine values={liveFinancial?.trend?.map((t) => t.cash_collected) || m.cash_spark} color="#10b981" />
                    </div>

                    {/* Total A/R Impact stacked bar */}
                    <div className="iks-ops-chart-card">
                        <h4>Total A/R Impact — Denial $ vs NPNR $</h4>
                        <p className="iks-ops-chart-sub">
                            Combined: {formatCurrencyCompact(arImpactTotal)} (Denial: {formatCurrencyCompact(arImpactDenial)} · NPNR: {formatCurrencyCompact(arImpactNpnr)})
                            {isLiveFinancial && <span className="iks-ops-source-badge iks-ops-source-live" style={{ marginLeft: 8 }}>● Live</span>}
                        </p>
                        <div className="iks-ops-chart-wrap">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={arImpactTrend} margin={{ top: 14, right: 16, left: 0, bottom: 4 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                                    <XAxis dataKey="month" stroke="#9ca3af" tick={{ fontSize: 11 }} />
                                    <YAxis stroke="#9ca3af" tick={{ fontSize: 11 }} tickFormatter={(v) => formatCurrencyCompact(v)} />
                                    <Tooltip content={<ChartTooltip fmt={formatCurrencyCompact} />} />
                                    <Legend wrapperStyle={{ fontSize: '11px', color: '#9ca3af' }} />
                                    <Bar dataKey="denial" name="Denial $" stackId="ar" fill="#ef4444" />
                                    <Bar dataKey="npnr"   name="NPNR $"   stackId="ar" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>
            </div>



        </div>
    )
}
