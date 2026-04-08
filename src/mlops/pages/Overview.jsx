import React, { useMemo } from 'react'
import { motion } from 'framer-motion'
import { Activity, TrendingUp, Users, AlertTriangle, Zap, Shield, ArrowRight } from 'lucide-react'
import { useDashboardContext } from '../context/DashboardContext'
import { useDashboardData } from '../hooks/useDashboardData'
import { useSystemHealth } from '../hooks/useSystemHealth'
import { useAlerts } from '../hooks/useAlerts'
import FilterPanel from '../components/FilterPanel'
import LineChartCard from '../components/LineChartCard'
import GenAIChatOverlay from '../components/GenAIChatOverlay'
import { buildSeries, buildSummaryCards } from '../utils/metrics'
import '../styles/mlops-compat.css'

const palette = ['#22d3ee', '#f472b6', '#a78bfa', '#34d399', '#facc15']

export default function Overview() {
    const { filters, meta } = useDashboardContext()

    const params = useMemo(() => ({
        model: filters.model,
        client: filters.client,
        version: filters.version,
        start_date: filters.startDate,
        end_date: filters.endDate,
        threshold_mode: filters.thresholdMode,
        ranges: filters.ranges.join(','),
        metrics: filters.metrics.join(','),
    }), [filters])

    const { data, isLoading, error } = useDashboardData(params)
    const { data: healthData } = useSystemHealth()
    const { data: alertData } = useAlerts({ model: filters.model, client: filters.client })

    const rangeOptions = useMemo(() => {
        if (!data?.records) return ['All ranges']
        const ranges = new Set()
        data.records.forEach((row) => {
            if (row.threshold_range_label) ranges.add(row.threshold_range_label)
        })
        return ['All ranges', ...Array.from(ranges)]
    }, [data])

    const summaryCards = useMemo(() => buildSummaryCards(data?.summary ?? []), [data])

    const accuracySeries = useMemo(() => {
        if (!data?.records) return { data: [], seriesKeys: [] }
        return buildSeries(data.records, 'Overall_Accuracy', filters.client, filters.trendWindow)
    }, [data, filters.client, filters.trendWindow])

    // Key metrics for hero section
    const heroMetrics = useMemo(() => {
        const healthScore = healthData?.summary?.avg_health || 0
        const alertCount = alertData?.alerts?.status_tally?.active || 0
        const totalClients = data?.records ? new Set(data.records.map(r => r.client_name)).size : 0
        const latestAccuracy = summaryCards.length > 0 ? parseFloat(summaryCards[0].value) || 0 : 0

        return { healthScore, alertCount, totalClients, latestAccuracy }
    }, [healthData, alertData, data, summaryCards])

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-96">
                <div className="text-center">
                    <div className="relative w-16 h-16 mx-auto mb-4">
                        <div className="absolute inset-0 border-4 border-cyan-500/20 rounded-full"></div>
                        <div className="absolute inset-0 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin"></div>
                        <Activity className="absolute inset-0 m-auto w-6 h-6 text-cyan-400" />
                    </div>
                    <p className="text-slate-400">Loading dashboard...</p>
                </div>
            </div>
        )
    }

    if (error || !data) {
        return (
            <div className="flex items-center justify-center h-96">
                <div className="text-center text-red-400">
                    <p className="text-xl font-bold mb-2">Unable to load dashboard</p>
                    <p className="text-sm">Check backend connectivity at http://localhost:8510</p>
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-6 pb-20">
            <GenAIChatOverlay />

            {/* Hero Section */}
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 to-slate-800 border border-white/10 p-6">
                <div className="absolute top-0 right-0 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
                <div className="absolute bottom-0 left-0 w-64 h-64 bg-purple-500/5 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2"></div>

                <div className="relative">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
                        <div>
                            <p className="text-xs uppercase tracking-widest text-cyan-400 font-bold mb-2">ML Observatory</p>
                            <h1 className="text-4xl font-bold text-white">
                                {filters.model || 'Model'} <span className="text-slate-400">Dashboard</span>
                            </h1>
                            <p className="text-slate-400 mt-2 flex items-center gap-2">
                                <span className="pill">{filters.client}</span>
                                {filters.version !== 'All Versions' && <span className="pill">{filters.version}</span>}
                                <span className="text-sm">· {filters.startDate} to {filters.endDate}</span>
                            </p>
                        </div>

                        {/* Quick Stats */}
                        <div className="flex flex-wrap gap-3">
                            <QuickStat
                                icon={Shield}
                                label="Health"
                                value={`${heroMetrics.healthScore.toFixed(0)}%`}
                                color={heroMetrics.healthScore >= 80 ? 'emerald' : heroMetrics.healthScore >= 60 ? 'yellow' : 'red'}
                            />
                            <QuickStat
                                icon={AlertTriangle}
                                label="Active Alerts"
                                value={heroMetrics.alertCount}
                                color={heroMetrics.alertCount > 0 ? 'red' : 'emerald'}
                            />
                            <QuickStat
                                icon={Users}
                                label="Clients"
                                value={heroMetrics.totalClients}
                                color="blue"
                            />
                        </div>
                    </div>
                </div>
            </div>

            <FilterPanel rangeOptions={rangeOptions} availableMetrics={data.available_metrics} showAdvanced showMetrics />

            {/* Summary Cards */}
            {summaryCards.length > 0 && (
                <div className="grid gap-4 md:grid-cols-3">
                    {summaryCards.slice(0, 3).map((card, idx) => (
                        <motion.div
                            key={card.label}
                            className="card-outline p-5 relative overflow-hidden"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: idx * 0.05 }}
                        >
                            <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-cyan-500/10 to-transparent rounded-full blur-2xl"></div>
                            <p className="text-xs uppercase tracking-widest text-slate-400 font-semibold">{card.label}</p>
                            <div className="mt-3 flex items-end justify-between">
                                <span className="text-4xl font-bold text-white">{card.value}</span>
                                <span className={`text-sm font-semibold px-3 py-1 rounded-full flex items-center gap-1 ${card.status === 'Improving' ? 'bg-emerald-500/20 text-emerald-400' :
                                        card.status === 'Declining' ? 'bg-red-500/20 text-red-400' :
                                            'bg-slate-500/20 text-slate-400'
                                    }`}>
                                    {card.status === 'Improving' ? <TrendingUp className="w-4 h-4" /> :
                                        card.status === 'Declining' ? <TrendingUp className="w-4 h-4 rotate-180" /> : null}
                                    {card.status}
                                </span>
                            </div>
                            <p className="text-sm text-slate-500 mt-3">
                                Delta: <span className={card.delta > 0 ? 'text-emerald-400' : card.delta < 0 ? 'text-red-400' : ''}>
                                    {card.delta > 0 ? '+' : ''}{card.delta}%
                                </span> from last refresh
                            </p>
                        </motion.div>
                    ))}
                </div>
            )}

            {/* Main Chart - Using LineChartCard component */}
            <LineChartCard
                title="Accuracy Trend"
                description="Performance over time with threshold reference"
                data={accuracySeries.data}
                lines={[
                    ...accuracySeries.seriesKeys.map((key, index) => ({
                        key,
                        label: key,
                        color: palette[index % palette.length],
                    })),
                    { key: 'threshold', label: 'Threshold', color: '#f5b700', dash: '4 4' },
                ]}
                yLabel="Accuracy"
            />

            {/* Quick Nav */}
            <div className="grid gap-4 md:grid-cols-2">
                <QuickNavCard
                    title="Coverage Snapshot"
                    metric={`${heroMetrics.totalClients} Clients`}
                    description="Models deployed across clients"
                    color="cyan"
                />
                <QuickNavCard
                    title="Drift Report"
                    metric="View Analysis"
                    description="Monitor model degradation signals"
                    color="purple"
                    link="/dashboard/mlops/drift"
                />
            </div>
        </div>
    )
}

function QuickStat({ icon: Icon, label, value, color }) {
    const colors = {
        emerald: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400',
        red: 'bg-red-500/10 border-red-500/20 text-red-400',
        yellow: 'bg-yellow-500/10 border-yellow-500/20 text-yellow-400',
        blue: 'bg-blue-500/10 border-blue-500/20 text-blue-400',
    }
    return (
        <div className={`px-4 py-3 rounded-xl border ${colors[color]}`}>
            <div className="flex items-center gap-2">
                <Icon className="w-4 h-4" />
                <span className="text-xs uppercase tracking-wider">{label}</span>
            </div>
            <p className="text-2xl font-bold text-white mt-1">{value}</p>
        </div>
    )
}

function QuickNavCard({ title, metric, description, color, link }) {
    const colors = {
        cyan: 'border-cyan-500/20 hover:border-cyan-500/40',
        purple: 'border-purple-500/20 hover:border-purple-500/40',
    }
    const iconColors = {
        cyan: 'text-cyan-400',
        purple: 'text-purple-400',
    }

    return (
        <motion.div
            className={`card-outline p-5 border ${colors[color]} transition-colors cursor-pointer group`}
            whileHover={{ scale: 1.01 }}
        >
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-lg font-semibold text-white">{title}</h3>
                    <p className="text-3xl font-bold text-white mt-2">{metric}</p>
                    <p className="text-sm text-slate-400 mt-1">{description}</p>
                </div>
                <ArrowRight className={`w-6 h-6 ${iconColors[color]} group-hover:translate-x-1 transition-transform`} />
            </div>
        </motion.div>
    )
}
