/**
 * Static mock data for the IKS Claims persona views.
 * Ops Manager and Sr. Leader sections use this until real API feeds are wired.
 * Sprint plan: S1 (B1, B2, B4, B6, B7) | S2 (B5, Sr. Leader assembly)
 */

export const OPS_MOCK = {
    inventory: {
        workable: 34820,        workable_delta: 0.12,
        ar_backlog: 4280000,    ar_backlog_delta: 0.08,
        total_npnr: 18940,      npnr_delta: -0.03,
        total_denials: 15880,   denials_delta: 0.05,
        pending_payer: 9923,    pending_delta: 0.02,
        resolved_mtd: 6240,     resolved_delta: 0.18,
        action_rate: 0.72,      action_delta: 0.04,
        workable_spark: [28000, 30000, 32000, 36000, 34000, 34820],
        backlog_spark:  [3100000, 3400000, 3700000, 4100000, 4000000, 4280000],
    },
    aging_resolution: [
        { bucket: '0–30d',   pct: 0.56, color: '#10b981' },
        { bucket: '31–60d',  pct: 0.44, color: '#00c49a' },
        { bucket: '61–90d',  pct: 0.38, color: '#3b82f6' },
        { bucket: '91–120d', pct: 0.29, color: '#f59e0b' },
        { bucket: '120+d',   pct: 0.18, color: '#ef4444' },
    ],
    aging_liquidation: [
        { bucket: '0–30d',   pct: 0.61, amt: 820000,  color: '#10b981' },
        { bucket: '31–60d',  pct: 0.48, amt: 640000,  color: '#00c49a' },
        { bucket: '61–90d',  pct: 0.35, amt: 410000,  color: '#3b82f6' },
        { bucket: '91–120d', pct: 0.24, amt: 290000,  color: '#f59e0b' },
        { bucket: '120+d',   pct: 0.16, amt: 180000,  color: '#ef4444' },
    ],
    touch_distribution: [
        { label: '1 touch',    pct: 0.48, color: '#10b981' },
        { label: '2 touches',  pct: 0.29, color: '#00c49a' },
        { label: '3 touches',  pct: 0.15, color: '#f59e0b' },
        { label: '3+ touches', pct: 0.08, color: '#ef4444' },
    ],
    lag_table: {
        months:  ['Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar'],
        buckets: ['0–45d', '46–90d', '91–120d', '120+d'],
        data: [
            [0.62, 0.58, 0.31, 0.09],
            [0.64, 0.60, 0.29, 0.07],
            [0.66, 0.62, 0.27, 0.05],
            [0.52, 0.49, 0.22, 0.11], // Jan drop — red row
            [0.56, 0.51, 0.24, 0.09],
            [0.58, 0.53, 0.26, 0.08],
        ],
    },
    appeal_monthly: [
        { month: 'Oct', rate: 0.50 },
        { month: 'Nov', rate: 0.48 },
        { month: 'Dec', rate: 0.44 },
        { month: 'Jan', rate: 0.34 },
        { month: 'Feb', rate: 0.36 },
        { month: 'Mar', rate: 0.38 },
    ],
    denial_recovery: [
        { month: 'Oct', resolved_pct: 0.72, payment_pct: 0.68 },
        { month: 'Nov', resolved_pct: 0.74, payment_pct: 0.70 },
        { month: 'Dec', resolved_pct: 0.71, payment_pct: 0.67 },
        { month: 'Jan', resolved_pct: 0.65, payment_pct: 0.61 },
        { month: 'Feb', resolved_pct: 0.68, payment_pct: 0.64 },
        { month: 'Mar', resolved_pct: 0.70, payment_pct: 0.66 },
    ],
    disp_flags: [
        { label: 'CO-4 Late Filing',    count: 412 },
        { label: 'CO-97 Contractual',   count: 298 },
        { label: 'PR-1 Deductible',     count: 187 },
        { label: 'CO-22 Coordination',  count: 134 },
        { label: 'PR-2 Coinsurance',    count: 96  },
    ],
    collectible_weekly: [
        { week: 'W1', collectible: 0.74, non_coll: 0.26 },
        { week: 'W2', collectible: 0.72, non_coll: 0.28 },
        { week: 'W3', collectible: 0.70, non_coll: 0.30 },
        { week: 'W4', collectible: 0.75, non_coll: 0.25 },
        { week: 'W5', collectible: 0.78, non_coll: 0.22 },
        { week: 'W6', collectible: 0.78, non_coll: 0.22 },
    ],
    cash_ar_effort: 0.082,
    cash_spark: [0.065, 0.071, 0.076, 0.074, 0.080, 0.082],
    associate_performance: [
        { name: 'Priya S.',  cash: 148000 },
        { name: 'Amit K.',   cash: 134000 },
        { name: 'Neha R.',   cash: 121000 },
        { name: 'Ravi M.',   cash: 109000 },
        { name: 'Sunita P.', cash: 94000  },
        { name: 'Deepak T.', cash: 76000  },
    ],
    inflow: [
        { period: 'W−5',   denials: 2100, npnr: 1800 },
        { period: 'W−4',   denials: 2300, npnr: 1900 },
        { period: 'W−3',   denials: 2200, npnr: 2100 },
        { period: 'W−2',   denials: 2500, npnr: 2300 },
        { period: 'W−1',   denials: 2400, npnr: 2200 },
        { period: 'This W', denials: 2600, npnr: 2400 },
    ],
}

export const LEADER_MOCK = {
    touchless_rate:      0.184,
    touchless_target:    0.25,
    touchless_spark:     [0.152, 0.163, 0.171, 0.178, 0.181, 0.184],
    cost_to_collect:     4.62,
    cost_target:         4.00,
    cost_spark:          [5.20, 5.00, 4.90, 4.80, 4.70, 4.62],
    payment_accuracy:    0.914,
    denial_accuracy:     0.887,
    prediction_bias:     +0.023,   // (Predicted_Rate / Actual_Rate) - 1 = 2.3% over-prediction
    payment_predicted_rate: 0.521, // countif(PredictedFlag='Payment') / count()
    payment_actual_rate:    0.509, // countif(ActualFlag=0) / count() — ratio = 1.024
    cash_collected_mtd:  9400000,
    cash_monthly_target: 10000000,
    cash_spark:          [7200000, 7800000, 8400000, 8900000, 9100000, 9400000],
    ar_impact_total:     34600000,
    ar_impact_denial:    18200000,
    ar_impact_npnr:      16400000,
    ar_impact_trend: [
        { month: 'Oct', denial: 14800000, npnr: 12900000 },
        { month: 'Nov', denial: 15400000, npnr: 13600000 },
        { month: 'Dec', denial: 16200000, npnr: 14800000 },
        { month: 'Jan', denial: 17400000, npnr: 15600000 },
        { month: 'Feb', denial: 17900000, npnr: 15900000 },
        { month: 'Mar', denial: 18200000, npnr: 16400000 },
    ],
    ar_90plus_total: 8200000,
    ar_91_120:       4900000,
    ar_120plus:      3300000,
    ar_risk_trend: [
        { month: 'Oct', r91_120: 3200000, r120plus: 1800000 },
        { month: 'Nov', r91_120: 3500000, r120plus: 2100000 },
        { month: 'Dec', r91_120: 3800000, r120plus: 2400000 },
        { month: 'Jan', r91_120: 4200000, r120plus: 2800000 },
        { month: 'Feb', r91_120: 4600000, r120plus: 3000000 },
        { month: 'Mar', r91_120: 4900000, r120plus: 3300000 },
    ],
}

/**
 * AR_OPS_MOCK — same shape as OPS_MOCK but every metric is derived from
 * AR-workable perspective (open-balance aging) rather than ITTT prediction expiry.
 * Used when calcBasis === 'ar' in the Ops Manager view.
 */
export const AR_OPS_MOCK = {
    // Funnel nodes for ops-flow SVG (AR mode)
    flow: {
        total_ar:     { value: 29840, label: 'Total AR Open',   sub: 'All open-balance claims'  },
        ar_workable:  { value: 22450, label: 'AR Workable',     sub: 'Actionable this period'   },
        ar_touched:   { value: 12820, label: 'AR Touched',      sub: 'Worked this period'       },
        ar_resolved:  { value: 5840,  label: 'AR Resolved MTD', sub: 'Closed / collected MTD'   },
    },
    inventory: {
        workable: 22450,           workable_delta: 0.09,
        ar_backlog: 2820000,       ar_backlog_delta: 0.06,
        total_npnr: 13680,         npnr_delta: -0.04,
        total_denials: 8770,       denials_delta: 0.03,
        pending_payer: 7240,       pending_delta: 0.01,
        resolved_mtd: 5840,        resolved_delta: 0.14,
        action_rate: 0.68,         action_delta: 0.03,
        workable_spark: [17000, 18500, 20200, 21500, 22000, 22450],
        backlog_spark:  [1900000, 2100000, 2350000, 2600000, 2720000, 2820000],
    },
    aging_resolution: [
        { bucket: '0–30d',   pct: 0.72, color: '#10b981' },
        { bucket: '31–60d',  pct: 0.61, color: '#00c49a' },
        { bucket: '61–90d',  pct: 0.44, color: '#3b82f6' },
        { bucket: '91–120d', pct: 0.28, color: '#f59e0b' },
        { bucket: '120+d',   pct: 0.14, color: '#ef4444' },
    ],
    aging_liquidation: [
        { bucket: '0–30d',   pct: 0.72, amt: 1200000, color: '#10b981' },
        { bucket: '31–60d',  pct: 0.58, amt: 820000,  color: '#00c49a' },
        { bucket: '61–90d',  pct: 0.41, amt: 480000,  color: '#3b82f6' },
        { bucket: '91–120d', pct: 0.26, amt: 240000,  color: '#f59e0b' },
        { bucket: '120+d',   pct: 0.15, amt: 80000,   color: '#ef4444' },
    ],
    touch_distribution: [
        { label: '1 touch',    pct: 0.52, color: '#10b981' },
        { label: '2 touches',  pct: 0.31, color: '#00c49a' },
        { label: '3 touches',  pct: 0.12, color: '#f59e0b' },
        { label: '3+ touches', pct: 0.05, color: '#ef4444' },
    ],
    lag_table: {
        months:  ['Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar'],
        buckets: ['0–45d', '46–90d', '91–120d', '120+d'],
        data: [
            [0.71, 0.62, 0.28, 0.07],
            [0.73, 0.64, 0.26, 0.06],
            [0.74, 0.66, 0.24, 0.05],
            [0.58, 0.51, 0.21, 0.09],   // Jan drop
            [0.61, 0.54, 0.22, 0.08],
            [0.64, 0.57, 0.24, 0.07],
        ],
    },
    appeal_monthly: [
        { month: 'Oct', rate: 0.54 },
        { month: 'Nov', rate: 0.52 },
        { month: 'Dec', rate: 0.48 },
        { month: 'Jan', rate: 0.38 },
        { month: 'Feb', rate: 0.41 },
        { month: 'Mar', rate: 0.43 },
    ],
    denial_recovery: [
        { month: 'Oct', resolved_pct: 0.75, payment_pct: 0.71 },
        { month: 'Nov', resolved_pct: 0.77, payment_pct: 0.73 },
        { month: 'Dec', resolved_pct: 0.74, payment_pct: 0.70 },
        { month: 'Jan', resolved_pct: 0.68, payment_pct: 0.64 },
        { month: 'Feb', resolved_pct: 0.71, payment_pct: 0.67 },
        { month: 'Mar', resolved_pct: 0.73, payment_pct: 0.69 },
    ],
    disp_flags: [
        { label: 'Timely Filing',  count: 384 },
        { label: 'Missing Auth',   count: 267 },
        { label: 'Coordination',   count: 198 },
        { label: 'Medical Nec.',   count: 142 },
        { label: 'Coverage Lapse', count: 87  },
    ],
    collectible_weekly: [
        { week: 'W1', collectible: 0.78, non_coll: 0.22 },
        { week: 'W2', collectible: 0.76, non_coll: 0.24 },
        { week: 'W3', collectible: 0.74, non_coll: 0.26 },
        { week: 'W4', collectible: 0.79, non_coll: 0.21 },
        { week: 'W5', collectible: 0.82, non_coll: 0.18 },
        { week: 'W6', collectible: 0.82, non_coll: 0.18 },
    ],
    cash_ar_effort: 0.092,
    cash_spark: [0.071, 0.077, 0.082, 0.079, 0.088, 0.092],
    associate_performance: [
        { name: 'Priya S.',  cash: 162000 },
        { name: 'Amit K.',   cash: 148000 },
        { name: 'Neha R.',   cash: 133000 },
        { name: 'Ravi M.',   cash: 118000 },
        { name: 'Sunita P.', cash: 102000 },
        { name: 'Deepak T.', cash: 83000  },
    ],
    inflow: [
        { period: 'W−5',    denials: 1800, npnr: 2100 },
        { period: 'W−4',    denials: 1950, npnr: 2200 },
        { period: 'W−3',    denials: 1850, npnr: 2350 },
        { period: 'W−2',    denials: 2100, npnr: 2500 },
        { period: 'W−1',    denials: 2000, npnr: 2400 },
        { period: 'This W', denials: 2200, npnr: 2600 },
    ],
}

/** RAG helpers shared by both views */
export const getLagRag = (val) => {
    if (val >= 0.60) return { bg: 'rgba(16,185,129,0.18)', color: '#10b981' }
    if (val >= 0.45) return { bg: 'rgba(245,158,11,0.18)', color: '#f59e0b' }
    return { bg: 'rgba(239,68,68,0.18)', color: '#ef4444' }
}

export const getAppealRag = (val) => {
    if (val >= 0.45) return '#10b981'
    if (val >= 0.35) return '#f59e0b'
    return '#ef4444'
}
