/**
 * OpsManagerExtendedView — new KPI sections added to the IKS Claims tab
 * for the Ops Manager persona. These render BELOW the existing hero grid,
 * ops flow, calendar, and trend tabs.
 *
 * Sections:
 *   1. Workable Inventory (7 stat cards)
 *   2. AR Resolution & Touch Efficiency (aging bars + lag heatmap)
 *   3. AR Efficiency placeholder (BLOCKED)
 *   4. Appeals & Denial Recovery
 *   5. Disposition Analysis
 *   6. AR Inflow Analysis
 *   7. Cash Impact (Cash from AR Effort + Associate drill-down)
 */
import { useEffect, useState } from 'react'
import {
    Bar, BarChart, CartesianGrid, Cell, ComposedChart,
    Label, Legend, Line, Pie, PieChart, ReferenceLine, ResponsiveContainer,
    Tooltip, XAxis, YAxis,
} from 'recharts'
import { formatCurrencyCompact, formatCurrency, formatNumber, formatPercent } from '../../utils/formatters'
import { OPS_MOCK, AR_OPS_MOCK, getLagRag, getAppealRag } from './mockData'

// Lightweight tooltip reused across all charts
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

// Horizontal bar row used in aging / touch sections
function HBar({ label, pct, color, subLabel }) {
    return (
        <div className="iks-ops-hbar-row">
            <div className="iks-ops-hbar-label">{label}</div>
            <div className="iks-ops-hbar-track">
                <div className="iks-ops-hbar-fill" style={{ width: `${pct * 100}%`, background: color }} />
            </div>
            <div className="iks-ops-hbar-val" style={{ color }}>
                {(pct * 100).toFixed(0)}%
                {subLabel && <span className="iks-ops-hbar-sub">{subLabel}</span>}
            </div>
        </div>
    )
}

// Spark bar strip
function SparkBar({ values, activeColor, maxOverride }) {
    const max = maxOverride || Math.max(...values, 1)
    return (
        <div className="iks-ops-spark">
            {values.map((v, i) => (
                <div
                    key={i}
                    className="iks-ops-spark-bar"
                    style={{
                        height: `${Math.max(10, (v / max) * 100)}%`,
                        background: i === values.length - 1 ? activeColor : 'rgba(255,255,255,0.14)',
                    }}
                />
            ))}
        </div>
    )
}

export default function OpsManagerExtendedView({ calcBasis = 'ittt', selectedMonth = '', selectedClient = '', refreshToken = 0 }) {
    const isAllPhasesSelection = !String(selectedClient || '').trim()
        || ['all phases', 'all clients', 'all'].includes(String(selectedClient).trim().toLowerCase())

    // Live snapshot — point-in-time inventory from /workable-snapshot
    const [liveSnap,    setLiveSnap]    = useState(null)
    const [snapSource,  setSnapSource]  = useState('loading')

    // Live analytics from ITTT_PP_Output endpoints
    const [liveAging,   setLiveAging]   = useState(null)
    const [liveInflow,  setLiveInflow]  = useState(null)
    const [liveOpsFlow, setLiveOpsFlow] = useState(null)

    useEffect(() => {
        if (calcBasis !== 'ittt') { setSnapSource('mock'); return }
        setSnapSource('loading')
        const params = new URLSearchParams()
        if (!isAllPhasesSelection) params.set('phase', selectedClient)
        if (refreshToken) params.set('refresh', 'true')
        fetch(`/api/optimix/iks/workable-snapshot${params.toString() ? `?${params.toString()}` : ''}`, {
            cache: 'no-store',
        })
            .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
            .then((data) => {
                if (data.error) { setSnapSource('mock'); return }
                setLiveSnap(data)
                setSnapSource('live')
            })
            .catch(() => setSnapSource('mock'))
    }, [calcBasis, selectedClient, refreshToken])

    // Fetch aging + inflow + ops-flow from ITTT_PP_Output whenever month changes
    useEffect(() => {
        if (calcBasis !== 'ittt') return
        const searchParams = new URLSearchParams()
        if (selectedMonth) searchParams.set('month', selectedMonth)
        if (!isAllPhasesSelection) searchParams.set('phase', selectedClient)
        if (refreshToken) searchParams.set('refresh', 'true')
        const params = searchParams.toString() ? `?${searchParams.toString()}` : ''

        fetch(`/api/optimix/iks/ittt-aging${params}`, { cache: 'no-store' })
            .then((r) => r.ok ? r.json() : null)
            .then((d) => { if (d && !d.error) setLiveAging(d) })
            .catch(() => {})

        fetch(`/api/optimix/iks/ittt-inflow${params}`, { cache: 'no-store' })
            .then((r) => r.ok ? r.json() : null)
            .then((d) => { if (d && !d.error) setLiveInflow(d) })
            .catch(() => {})

        fetch(`/api/optimix/iks/ops-flow${params}`, { cache: 'no-store' })
            .then((r) => r.ok ? r.json() : null)
            .then((d) => { if (d && !d.error) setLiveOpsFlow(d) })
            .catch(() => {})
    }, [calcBasis, selectedMonth, selectedClient, isAllPhasesSelection, refreshToken])

    // Switch entire data source based on calc basis
    const MOCK = calcBasis === 'ar' ? AR_OPS_MOCK : OPS_MOCK
    const inv = MOCK.inventory

    // Overlay live snapshot values onto mock when available (ITTT mode only)
    const liveInv = snapSource === 'live' && liveSnap ? {
        ...inv,
        workable:      liveSnap.workable_inventory ?? inv.workable,
        ar_backlog:    liveSnap.ar_backlog_amount ?? liveOpsFlow?.workable_charged_amt ?? inv.ar_backlog,
        total_npnr:    liveOpsFlow?.npnr             ?? liveSnap.total_npnr            ?? inv.total_npnr,
        total_denials: liveOpsFlow?.total_denials    ?? liveSnap.total_denials         ?? inv.total_denials,
    } : inv

    // Live aging buckets (fall back to mock)
    const agingResolution = liveAging?.buckets?.map((b) => ({
        bucket: b.bucket, pct: b.pct, color: b.color,
    })) || MOCK.aging_resolution

    const agingLiquidation = liveAging?.buckets?.map((b) => ({
        bucket: b.bucket, pct: b.liquidation_pct, amt: b.charged_amt, color: b.color,
    })) || MOCK.aging_liquidation

    // Live inflow (fall back to mock)
    const inflowData = liveInflow?.weeks || MOCK.inflow

    // Labels and tooltips aligned to official BigQuery query definitions
    const inventoryCards = calcBasis === 'ar'
        ? [
            {
                label: 'AR Workable Claims', value: inv.workable, delta: inv.workable_delta, fmt: 'number',
                spark: inv.workable_spark, maxSpark: 25000, warnUp: false,
                tip: 'Open-balance claims workable by AR-aging criteria — not written off, actionable this period',
            },
            {
                label: 'AR Backlog ($)', value: inv.ar_backlog, delta: inv.ar_backlog_delta, fmt: 'currency',
                spark: inv.backlog_spark, maxSpark: 3500000, warnUp: true,
                tip: 'SUM(Insurance_Balance) from main_ar_workflow for open AR backlog encounters requiring collection action',
            },
            {
                label: 'AR NPNR (Open)', value: inv.total_npnr, delta: inv.npnr_delta, fmt: 'number',
                spark: null, maxSpark: null, warnUp: true,
                tip: 'NPNR claims open by AR aging — ITTT_Date expired, Post_Date IS NULL (3rd prediction, no payer response)',
            },
            {
                label: 'AR Denials (Open)', value: inv.total_denials, delta: inv.denials_delta, fmt: 'number',
                spark: null, maxSpark: null, warnUp: true,
                tip: 'Actual denials open in AR — Denial_Prediction_Encounter_Data WHERE ActualFlag = 1',
            },
        ]
        : [
            {
                label: 'Workable Inventory', value: liveInv.workable, delta: inv.workable_delta, fmt: 'number',
                spark: inv.workable_spark, maxSpark: 40000, warnUp: false,
                tip: 'NPNR after 3rd ITTT (PredictionLabel=\'Third\', ITTT_Date < TODAY, Post_Date IS NULL) + Total Denials (ActualFlag=1)',
            },
            {
                label: 'A/R Backlog ($)', value: liveInv.ar_backlog, delta: inv.ar_backlog_delta, fmt: 'currency',
                spark: inv.backlog_spark, maxSpark: 4500000, warnUp: true,
                tip: 'Total AR backlog balance from main_ar_workflow for the selected phase and period',
            },
            {
                label: 'Total NPNR', value: liveInv.total_npnr, delta: inv.npnr_delta, fmt: 'number',
                spark: null, maxSpark: null, warnUp: true,
                tip: 'Third ITTT prediction with no payer response — PredictionLabel=\'Third\', DATE(ITTT_Date) < CURRENT_DATE(), Post_Date IS NULL',
            },
            {
                label: 'Total Denials', value: liveInv.total_denials, delta: inv.denials_delta, fmt: 'number',
                spark: null, maxSpark: null, warnUp: true,
                tip: 'Actual denials — Denial_Prediction_Encounter_Data WHERE ActualFlag = 1',
            },
        ]

    return (
        <div className="iks-ops-extended">

            {/* ═══════════════════════════════════════════
                SECTION 1 — WORKABLE INVENTORY
            ═══════════════════════════════════════════ */}
            <div className="iks-ops-section">
                <div className="iks-ops-section-head">
                    <h3>
                        {calcBasis === 'ar' ? 'AR Workable Inventory' : 'Workable Inventory'}
                        {calcBasis === 'ittt' && (
                            <span className={`iks-ops-source-badge iks-ops-source-${snapSource}`}>
                                {snapSource === 'live' ? '● Live' : snapSource === 'loading' ? '○ Loading…' : '○ Mock'}
                            </span>
                        )}
                    </h3>
                    <p>
                        {calcBasis === 'ar'
                            ? 'Open AR requiring action today. Claims workable by AR-aging criteria (open balance, not written off). MTD & MoM deltas shown.'
                            : 'Open AR requiring action today. Inventory = NPNR after 3rd ITTT + Total Denials. MTD & MoM deltas shown.'}
                        {(selectedClient || selectedMonth) && (
                            <span style={{ marginLeft: 8, color: '#818cf8', fontWeight: 600 }}>
                                {[selectedClient, selectedMonth].filter(Boolean).join(' · ')}
                            </span>
                        )}
                    </p>
                </div>
                <div className="iks-ops-inventory-grid">
                    {inventoryCards.map((card) => {
                        const isUp = card.delta >= 0
                        const ragColor = card.warnUp
                            ? (isUp ? '#ef4444' : '#10b981')
                            : (isUp ? '#10b981' : '#ef4444')
                        const displayVal = card.fmt === 'currency'
                            ? formatCurrencyCompact(card.value)
                            : card.fmt === 'percent'
                                ? `${(card.value * 100).toFixed(1)}%`
                                : formatNumber(card.value)
                        return (
                            <div key={card.label} className="iks-ops-stat-card" title={card.tip || ''}>
                                <div className="iks-ops-stat-label">
                                    {card.label}
                                    {card.tip && <span className="iks-ops-stat-tip" title={card.tip}>ⓘ</span>}
                                </div>
                                <div className="iks-ops-stat-big">{displayVal}</div>
                                <div className="iks-ops-stat-delta" style={{ color: ragColor }}>
                                    {isUp ? '↑' : '↓'} {Math.abs(card.delta * 100).toFixed(1)}% MoM
                                </div>
                                {card.spark && (
                                    <SparkBar values={card.spark} activeColor={ragColor} maxOverride={card.maxSpark} />
                                )}
                            </div>
                        )
                    })}
                </div>
            </div>

            {/* ═══════════════════════════════════════════
                SECTION 2 — AR RESOLUTION & TOUCH EFFICIENCY
            ═══════════════════════════════════════════ */}
            <div className="iks-ops-section">
                <div className="iks-ops-section-head">
                    <h3>AR Resolution &amp; Touch Efficiency</h3>
                    <p>Resolution rate vs. dollar liquidation per aging bucket, touch distribution breakdown, and month-on-month lag analysis.</p>
                </div>
                <div className="iks-ops-resolution-grid">
                    {/* Left — combined charts */}
                    <div className="iks-ops-res-left">
                        {/* Combined aging grouped bar chart */}
                        {(() => {
                            const agingData = agingResolution.map((r, i) => ({
                                bucket: r.bucket,
                                resolution: +(r.pct * 100).toFixed(1),
                                liquidation: +((agingLiquidation[i]?.pct || 0) * 100).toFixed(1),
                                liq_amt: agingLiquidation[i]?.amt || 0,
                                color: r.color,
                            }))
                            return (
                                <div className="iks-ops-chart-card">
                                    <h4>Resolution % vs Liquidation % by Aging Bucket</h4>
                                    <p className="iks-ops-chart-sub">
                                        Grouped bars per bucket — resolution rate (darker) vs dollar liquidation rate (lighter). Dollar recovered shown above liquidation bar.
                                    </p>
                                    <div className="iks-ops-chart-wrap" style={{ height: 220 }}>
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={agingData} margin={{ top: 18, right: 12, left: 0, bottom: 4 }} barCategoryGap="22%">
                                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
                                                <XAxis dataKey="bucket" stroke="#9ca3af" tick={{ fontSize: 10 }} />
                                                <YAxis tickFormatter={(v) => `${v}%`} stroke="#9ca3af" tick={{ fontSize: 10 }} domain={[0, 100]} />
                                                <Tooltip
                                                    content={({ active, payload, label }) => {
                                                        if (!active || !payload?.length) return null
                                                        const row = agingData.find((d) => d.bucket === label)
                                                        return (
                                                            <div className="iks-ops-tooltip">
                                                                <p className="iks-ops-tooltip-label">{label}</p>
                                                                <p style={{ color: '#10b981' }}>Resolution: {payload[0]?.value}%</p>
                                                                <p style={{ color: '#60a5fa' }}>Liquidation: {payload[1]?.value}%</p>
                                                                {row && <p style={{ color: '#9ca3af' }}>Recovered: {formatCurrencyCompact(row.liq_amt)}</p>}
                                                            </div>
                                                        )
                                                    }}
                                                />
                                                <Bar dataKey="resolution" name="Resolution %" radius={[3, 3, 0, 0]} maxBarSize={22}>
                                                    {agingData.map((d) => <Cell key={d.bucket} fill={d.color} />)}
                                                </Bar>
                                                <Bar dataKey="liquidation" name="Liquidation %" radius={[3, 3, 0, 0]} maxBarSize={22}>
                                                    {agingData.map((d) => <Cell key={d.bucket} fill={d.color} fillOpacity={0.4} />)}
                                                </Bar>
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                    <div className="iks-ops-chart-legend-row">
                                        <span><span className="iks-ops-legend-dot" style={{ background: '#10b981' }} />Resolution %</span>
                                        <span><span className="iks-ops-legend-dot" style={{ background: '#10b981', opacity: 0.4 }} />Liquidation %</span>
                                        <span className="iks-ops-chart-sub" style={{ marginLeft: 'auto' }}>120+ claims at timely-filing risk</span>
                                    </div>
                                </div>
                            )
                        })()}

                        {/* Touch distribution donut */}
                        {(() => {
                            const total = MOCK.touch_distribution.reduce((s, d) => s + d.pct, 0)
                            const oneTouch = MOCK.touch_distribution.find((d) => d.label === '1 touch')
                            return (
                                <div className="iks-ops-chart-card iks-ops-touch-card">
                                    <h4>Resolution by # of Touches</h4>
                                    <p className="iks-ops-chart-sub">1-touch resolution is most efficient. 3+ touches benchmark: &lt;20%.</p>
                                    <div className="iks-ops-touch-layout">
                                        <div className="iks-ops-touch-donut">
                                            <ResponsiveContainer width={160} height={160}>
                                                <PieChart>
                                                    <Pie
                                                        data={MOCK.touch_distribution}
                                                        dataKey="pct"
                                                        nameKey="label"
                                                        cx="50%" cy="50%"
                                                        innerRadius={48}
                                                        outerRadius={72}
                                                        strokeWidth={0}
                                                    >
                                                        {MOCK.touch_distribution.map((d) => (
                                                            <Cell key={d.label} fill={d.color} />
                                                        ))}
                                                        <Label
                                                            content={({ viewBox }) => {
                                                                const { cx, cy } = viewBox
                                                                return (
                                                                    <>
                                                                        <text x={cx} y={cy - 6} textAnchor="middle" dominantBaseline="middle" fill="#e2e8f0" fontSize={20} fontWeight={700}>
                                                                            {oneTouch ? `${(oneTouch.pct * 100).toFixed(0)}%` : '—'}
                                                                        </text>
                                                                        <text x={cx} y={cy + 14} textAnchor="middle" dominantBaseline="middle" fill="#9ca3af" fontSize={10}>
                                                                            1-touch
                                                                        </text>
                                                                    </>
                                                                )
                                                            }}
                                                        />
                                                    </Pie>
                                                    <Tooltip formatter={(v) => `${(v * 100).toFixed(0)}%`} />
                                                </PieChart>
                                            </ResponsiveContainer>
                                        </div>
                                        <div className="iks-ops-touch-legend">
                                            {MOCK.touch_distribution.map((d) => (
                                                <div key={d.label} className="iks-ops-touch-legend-row">
                                                    <span className="iks-ops-touch-dot" style={{ background: d.color }} />
                                                    <span className="iks-ops-touch-lbl">{d.label}</span>
                                                    <span className="iks-ops-touch-pct" style={{ color: d.color }}>
                                                        {(d.pct * 100).toFixed(0)}%
                                                    </span>
                                                    {d.label === '3+ touches' && d.pct > 0.20 && (
                                                        <span className="iks-ops-touch-flag">↑ above 20% target</span>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )
                        })()}
                    </div>

                    {/* Right — Touch-to-Resolution lag heatmap */}
                    <div className="iks-ops-res-right">
                        <div className="iks-ops-chart-card iks-ops-lag-card">
                            <h4>Touch-to-Resolution Lag</h4>
                            <p className="iks-ops-chart-sub">% resolved within each time window from first touch. Red = drop vs prior month. 0–45d target &gt;60%.</p>
                            <div className="iks-ops-lag-wrap">
                                <table className="iks-ops-lag-table">
                                    <thead>
                                        <tr>
                                            <th></th>
                                            {MOCK.lag_table.buckets.map((b) => <th key={b}>{b}</th>)}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {MOCK.lag_table.months.map((month, mi) => (
                                            <tr key={month}>
                                                <td className="iks-ops-lag-month">{month}</td>
                                                {MOCK.lag_table.data[mi].map((val, bi) => {
                                                    const { bg, color } = getLagRag(val)
                                                    const prev = mi > 0 ? MOCK.lag_table.data[mi - 1][bi] : null
                                                    const dropped = prev !== null && val < prev - 0.03
                                                    return (
                                                        <td key={bi} className="iks-ops-lag-cell" style={{ background: bg, color }}>
                                                            {(val * 100).toFixed(0)}%{dropped ? ' ↓' : ''}
                                                        </td>
                                                    )
                                                })}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            <div className="iks-ops-lag-legend">
                                <span style={{ color: '#10b981' }}>■ Green &gt;60%</span>
                                <span style={{ color: '#f59e0b' }}>■ Amber 45–60%</span>
                                <span style={{ color: '#ef4444' }}>■ Red &lt;45%</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* ═══════════════════════════════════════════
                SECTION 3 — APPEALS & DENIAL RECOVERY
            ═══════════════════════════════════════════ */}
            <div className="iks-ops-section">
                <div className="iks-ops-section-head">
                    <h3>Appeals &amp; Denial Recovery</h3>
                </div>
                <div className="iks-ops-duo-grid">
                    <div className="iks-ops-chart-card">
                        <h4>Denial Overturn Rate (Monthly)</h4>
                        <p className="iks-ops-chart-sub">Denials successfully appealed &amp; paid ÷ Total Denials — from Appeal_Prioritization_data (Actual_Appeal_Status=1). Dashed line = 45% target.</p>
                        <div className="iks-ops-chart-wrap">
                            <ResponsiveContainer width="100%" height="100%">
                                <ComposedChart data={MOCK.appeal_monthly} margin={{ top: 14, right: 16, left: 0, bottom: 4 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                                    <XAxis dataKey="month" stroke="#9ca3af" tick={{ fontSize: 11 }} />
                                    <YAxis tickFormatter={(v) => `${(v * 100).toFixed(0)}%`} stroke="#9ca3af" tick={{ fontSize: 11 }} domain={[0, 0.7]} />
                                    <Tooltip content={<ChartTooltip fmt={(v) => `${(v * 100).toFixed(1)}%`} />} />
                                    <ReferenceLine y={0.45} stroke="#f59e0b" strokeDasharray="5 3" label={{ value: '45%', position: 'insideTopRight', fontSize: 10, fill: '#f59e0b' }} />
                                    <Bar dataKey="rate" name="Appeal Res. Rate" radius={[4, 4, 0, 0]}>
                                        {MOCK.appeal_monthly.map((entry) => (
                                            <Cell key={entry.month} fill={getAppealRag(entry.rate)} />
                                        ))}
                                    </Bar>
                                </ComposedChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    <div className="iks-ops-chart-card">
                        <h4>Denial Recovery Rate</h4>
                        <p className="iks-ops-chart-sub">Solid = resolved denials / total. Dashed = payments / total denial $.</p>
                        <div className="iks-ops-chart-wrap">
                            <ResponsiveContainer width="100%" height="100%">
                                <ComposedChart data={MOCK.denial_recovery} margin={{ top: 14, right: 16, left: 0, bottom: 4 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                                    <XAxis dataKey="month" stroke="#9ca3af" tick={{ fontSize: 11 }} />
                                    <YAxis tickFormatter={(v) => `${(v * 100).toFixed(0)}%`} stroke="#9ca3af" tick={{ fontSize: 11 }} domain={[0.5, 0.9]} />
                                    <Tooltip content={<ChartTooltip fmt={(v) => `${(v * 100).toFixed(1)}%`} />} />
                                    <Line type="monotone" dataKey="resolved_pct" name="Resolution Rate" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} />
                                    <Line type="monotone" dataKey="payment_pct" name="Payment Rate" stroke="#3b82f6" strokeWidth={2} strokeDasharray="5 3" dot={{ r: 3 }} />
                                </ComposedChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>
            </div>

            {/* ═══════════════════════════════════════════
                SECTION 4 — AR INFLOW ANALYSIS
            ═══════════════════════════════════════════ */}
            <div className="iks-ops-section">
                <div className="iks-ops-section-head">
                    <h3>AR Inflow Analysis</h3>
                </div>
                <div className="iks-ops-duo-grid">
                    <div className="iks-ops-chart-card">
                        <h4>New Inflow WoW (Denials vs NPNR)</h4>
                        <p className="iks-ops-chart-sub">Rising bars = growing backlog risk.</p>
                        <div className="iks-ops-chart-wrap">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={inflowData} margin={{ top: 14, right: 16, left: 0, bottom: 4 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                                    <XAxis dataKey="period" stroke="#9ca3af" tick={{ fontSize: 11 }} />
                                    <YAxis stroke="#9ca3af" tick={{ fontSize: 11 }} tickFormatter={formatNumber} />
                                    <Tooltip content={<ChartTooltip fmt={formatNumber} />} />
                                    <Legend wrapperStyle={{ fontSize: '11px', color: '#9ca3af' }} />
                                    <Bar dataKey="denials" name="Denials" fill="#ef4444" radius={[3, 3, 0, 0]} />
                                    <Bar dataKey="npnr"    name="NPNR"    fill="#f59e0b" radius={[3, 3, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    <div className="iks-ops-chart-card">
                        <h4>Collectible vs Non-Collectible Touches</h4>
                        <p className="iks-ops-chart-sub">Stacked weekly. Collectible target &gt;75%.</p>
                        <div className="iks-ops-chart-wrap">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={MOCK.collectible_weekly} margin={{ top: 14, right: 16, left: 0, bottom: 4 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                                    <XAxis dataKey="week" stroke="#9ca3af" tick={{ fontSize: 11 }} />
                                    <YAxis tickFormatter={(v) => `${(v * 100).toFixed(0)}%`} stroke="#9ca3af" tick={{ fontSize: 11 }} domain={[0, 1]} />
                                    <Tooltip content={<ChartTooltip fmt={(v) => `${(v * 100).toFixed(1)}%`} />} />
                                    <Legend wrapperStyle={{ fontSize: '11px', color: '#9ca3af' }} />
                                    <Bar dataKey="collectible" name="Collectible"     stackId="a" fill="#10b981" />
                                    <Bar dataKey="non_coll"    name="Non-Collectible" stackId="a" fill="#ef4444" radius={[3, 3, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>

                {/* AR New vs Old pie chart + NPNR Trend */}
                <div className="iks-ops-duo-grid" style={{ marginTop: '16px' }}>
                    <div className="iks-ops-chart-card">
                        <h4>AR New vs Old</h4>
                        <p className="iks-ops-chart-sub">New = recent inflow (denials + NPNR this period). Old = carried-over backlog.</p>
                        <div className="iks-ops-chart-wrap">
                            {(() => {
                                const totalInflow = inflowData.reduce((sum, w) => sum + (w.denials || 0) + (w.npnr || 0), 0)
                                const totalWorkable = calcBasis === 'ar' ? (inv.workable || 0) : (liveInv.workable || inv.workable || 0)
                                const arNew = Math.min(totalInflow, totalWorkable)
                                const arOld = Math.max(0, totalWorkable - arNew)
                                const pieData = [
                                    { name: 'AR New', value: arNew, fill: '#6366f1' },
                                    { name: 'AR Old', value: arOld, fill: '#f59e0b' },
                                ]
                                return (
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie
                                                data={pieData}
                                                dataKey="value"
                                                nameKey="name"
                                                cx="50%" cy="50%"
                                                innerRadius={50} outerRadius={80}
                                                paddingAngle={4}
                                                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                                            >
                                                {pieData.map((entry) => (
                                                    <Cell key={entry.name} fill={entry.fill} />
                                                ))}
                                            </Pie>
                                            <Tooltip formatter={(v) => formatNumber(v)} />
                                            <Legend wrapperStyle={{ fontSize: '11px', color: '#9ca3af' }} />
                                        </PieChart>
                                    </ResponsiveContainer>
                                )
                            })()}
                        </div>
                    </div>

                    <div className="iks-ops-chart-card">
                        <h4>NPNR Trend (Weekly)</h4>
                        <p className="iks-ops-chart-sub">No Payer No Response claims trend — claims with 3rd ITTT prediction expired, no response received.</p>
                        <div className="iks-ops-chart-wrap">
                            <ResponsiveContainer width="100%" height="100%">
                                <ComposedChart data={inflowData} margin={{ top: 14, right: 16, left: 0, bottom: 4 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                                    <XAxis dataKey="period" stroke="#9ca3af" tick={{ fontSize: 11 }} />
                                    <YAxis stroke="#9ca3af" tick={{ fontSize: 11 }} tickFormatter={formatNumber} />
                                    <Tooltip content={<ChartTooltip fmt={formatNumber} />} />
                                    <Bar dataKey="npnr" name="NPNR Count" fill="rgba(245,158,11,0.3)" radius={[3, 3, 0, 0]} />
                                    <Line type="monotone" dataKey="npnr" name="NPNR Trend" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3, fill: '#f59e0b' }} />
                                </ComposedChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>
            </div>

            {/* ═══════════════════════════════════════════
                SECTION 5 — CASH IMPACT
            ═══════════════════════════════════════════ */}
            <div className="iks-ops-section">
                <div className="iks-ops-section-head">
                    <h3>Cash Impact</h3>
                </div>
                <div className="iks-ops-cash-grid iks-ops-cash-grid--single">
                    {/* Cash from AR Effort hero card */}
                    <div className="iks-ops-chart-card iks-ops-cash-hero">
                        <div className="iks-ops-cash-label">Cash from AR Effort %</div>
                        {(() => {
                            const pct = MOCK.cash_ar_effort
                            const rag = pct >= 0.09 ? '#10b981' : pct >= 0.07 ? '#f59e0b' : '#ef4444'
                            return (
                                <>
                                    <div className="iks-ops-cash-value" style={{ color: rag }}>
                                        {(pct * 100).toFixed(1)}%
                                    </div>
                                    <div className="iks-ops-cash-sub">Cash collected via AR touches / Total cash collected MTD</div>
                                    <SparkBar values={MOCK.cash_spark} activeColor={rag} />
                                    <div className="iks-ops-rag-chips">
                                        <span style={{ color: '#10b981' }}>■ Green &gt;9%</span>
                                        <span style={{ color: '#f59e0b' }}>■ Amber 7–9%</span>
                                        <span style={{ color: '#ef4444' }}>■ Red &lt;7%</span>
                                    </div>
                                </>
                            )
                        })()}
                    </div>
                </div>
            </div>

        </div>
    )
}
