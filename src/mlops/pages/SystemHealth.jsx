import React, { useMemo } from 'react'
import { motion } from 'framer-motion'
import { Activity, Heart, Shield, Clock, TrendingUp, AlertTriangle, CheckCircle, Zap } from 'lucide-react'
import { useSystemHealth } from '../hooks/useSystemHealth'
import { useDashboardData } from '../hooks/useDashboardData'
import { useDashboardContext } from '../context/DashboardContext'
import FilterPanel from '../components/FilterPanel'
import LineChartCard from '../components/LineChartCard'
import { buildSeries } from '../utils/metrics'
import '../styles/mlops-compat.css'

const palette = ['#10b981', '#22d3ee', '#8b5cf6', '#f59e0b', '#ef4444']

export default function SystemHealth() {
    const { filters } = useDashboardContext()
    const { data: healthData, isLoading: healthLoading } = useSystemHealth()
    const { data: dashData, isLoading: dashLoading } = useDashboardData({
        model: filters.model,
        client: filters.client,
        start_date: filters.startDate,
        end_date: filters.endDate,
    })

    const isLoading = healthLoading || dashLoading

    // Calculate health metrics
    const healthMetrics = useMemo(() => {
        if (!healthData?.summary) return null
        const s = healthData.summary
        return {
            overallHealth: s.avg_health?.toFixed(1) || 0,
            healthyCount: s.healthy_count || 0,
            freshData: s.fresh_data_count || 0,
            stableModels: s.stable_count || 0,
            total: s.total || 0,
            criticalCount: s.critical_count || 0,
        }
    }, [healthData])

    // Health trend data from dashboard records - using buildSeries for consistency
    const healthSeries = useMemo(() => {
        if (!dashData?.records) return { data: [], seriesKeys: [] }
        return buildSeries(dashData.records, 'Overall_Accuracy', filters.client, filters.trendWindow)
    }, [dashData, filters.client, filters.trendWindow])

    // Model health breakdown
    const modelHealth = useMemo(() => {
        if (!healthData?.details) return []
        return healthData.details
            .slice(0, 8)
            .map(d => ({
                name: `${d.model_name?.substring(0, 12)}...`,
                fullName: d.model_name,
                client: d.client_name,
                score: d.health_score || 0,
                status: d.health_status || 'unknown',
            }))
    }, [healthData])

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-96">
                <div className="text-center">
                    <div className="relative w-16 h-16 mx-auto mb-4">
                        <div className="absolute inset-0 border-4 border-emerald-500/20 rounded-full"></div>
                        <div className="absolute inset-0 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
                        <Heart className="absolute inset-0 m-auto w-6 h-6 text-emerald-400" />
                    </div>
                    <p className="text-slate-400">Loading system health...</p>
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-6 pb-20">
            {/* Header */}
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-emerald-900/30 to-cyan-900/30 border border-emerald-500/20 p-6">
                <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
                <div className="relative">
                    <div className="flex items-center gap-3 mb-2">
                        <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-bold uppercase tracking-widest border border-emerald-500/30 flex items-center gap-2">
                            <Activity className="w-3 h-3" /> Live Monitoring
                        </span>
                    </div>
                    <h1 className="text-4xl font-bold text-white">System Health</h1>
                    <p className="text-slate-400 mt-2 max-w-xl">Real-time health monitoring across all model deployments with predictive analytics.</p>
                </div>
            </div>

            <FilterPanel rangeOptions={['All ranges']} availableMetrics={[]} showAdvanced />

            {/* Health Score Cards */}
            {healthMetrics && (
                <div className="grid gap-4 md:grid-cols-5">
                    <HealthCard icon={Heart} label="Overall Health" value={`${healthMetrics.overallHealth}%`} color="emerald" pulse />
                    <HealthCard icon={CheckCircle} label="Healthy Models" value={healthMetrics.healthyCount} subtext={`of ${healthMetrics.total}`} color="emerald" />
                    <HealthCard icon={Clock} label="Fresh Data" value={healthMetrics.freshData} subtext="within SLA" color="blue" />
                    <HealthCard icon={Shield} label="Stable" value={healthMetrics.stableModels} subtext="consistent" color="purple" />
                    <HealthCard icon={AlertTriangle} label="Critical" value={healthMetrics.criticalCount || 0} subtext="need attention" color="red" />
                </div>
            )}

            {/* Health Trend Chart - Using LineChartCard */}
            <LineChartCard
                title="Health Trend"
                description="Last 14 days average accuracy"
                data={healthSeries.data}
                lines={healthSeries.seriesKeys.map((key, index) => ({
                    key,
                    label: key,
                    color: palette[index % palette.length],
                }))}
                yLabel="Health %"
            />

            {/* Model Health Leaderboard */}
            <div className="card-outline p-5">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                        <TrendingUp className="w-5 h-5 text-cyan-400" /> Model Health Leaderboard
                    </h3>
                    <span className="text-xs text-slate-400">{modelHealth.length} models</span>
                </div>

                {modelHealth.length === 0 ? (
                    <p className="text-slate-400 text-sm">No model health data available</p>
                ) : (
                    <div className="space-y-3">
                        {modelHealth.map((model, idx) => (
                            <motion.div
                                key={`${model.fullName}-${model.client}`}
                                className="p-4 rounded-xl bg-slate-800/30 border border-white/5 hover:border-white/10 transition-colors"
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: idx * 0.05 }}
                            >
                                <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-2 h-2 rounded-full ${getStatusColor(model.status)}`}></div>
                                        <div>
                                            <p className="text-white font-medium text-sm">{model.fullName}</p>
                                            <p className="text-xs text-slate-400">{model.client}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${getStatusBadge(model.status)}`}>
                                            {model.status}
                                        </span>
                                        <span className="text-lg font-bold text-white">{model.score.toFixed(0)}%</span>
                                    </div>
                                </div>
                                <div className="w-full h-2 bg-slate-700/50 rounded-full overflow-hidden">
                                    <motion.div
                                        className={`h-full ${getProgressColor(model.score)}`}
                                        initial={{ width: 0 }}
                                        animate={{ width: `${Math.min(model.score, 100)}%` }}
                                        transition={{ delay: idx * 0.05 + 0.2, duration: 0.5 }}
                                    />
                                </div>
                            </motion.div>
                        ))}
                    </div>
                )}
            </div>

            {/* Predictive Insights */}
            {healthData?.predictions && healthData.predictions.length > 0 && (
                <div className="card-outline p-5 border border-yellow-500/20 bg-yellow-900/5">
                    <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                        <Zap className="w-5 h-5 text-yellow-400" /> Predictive Insights
                    </h3>
                    <div className="grid gap-3 md:grid-cols-2">
                        {healthData.predictions.map((p, idx) => (
                            <div key={idx} className="p-4 rounded-xl bg-yellow-900/20 border border-yellow-500/20">
                                <p className="text-sm text-yellow-200">
                                    <span className="font-bold text-white">{p.model}</span> may breach threshold in{' '}
                                    <span className="font-bold text-yellow-400">{p.days_until_breach} days</span>
                                </p>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}

function HealthCard({ icon: Icon, label, value, subtext, color, pulse }) {
    const colors = {
        emerald: 'border-l-emerald-500 bg-emerald-500/5',
        blue: 'border-l-blue-500 bg-blue-500/5',
        purple: 'border-l-purple-500 bg-purple-500/5',
        red: 'border-l-red-500 bg-red-500/5',
    }
    const iconColors = {
        emerald: 'text-emerald-400',
        blue: 'text-blue-400',
        purple: 'text-purple-400',
        red: 'text-red-400',
    }

    return (
        <motion.div
            className={`card-outline p-4 border-l-4 ${colors[color]}`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
        >
            <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg bg-white/5 ${pulse ? 'animate-pulse' : ''}`}>
                    <Icon className={`w-5 h-5 ${iconColors[color]}`} />
                </div>
                <div>
                    <p className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold">{label}</p>
                    <div className="flex items-baseline gap-1">
                        <span className="text-2xl font-bold text-white">{value}</span>
                        {subtext && <span className="text-xs text-slate-400">{subtext}</span>}
                    </div>
                </div>
            </div>
        </motion.div>
    )
}

function getStatusColor(status) {
    if (status === 'healthy') return 'bg-emerald-500'
    if (status === 'warning') return 'bg-yellow-500'
    return 'bg-red-500'
}

function getStatusBadge(status) {
    if (status === 'healthy') return 'bg-emerald-500/20 text-emerald-400'
    if (status === 'warning') return 'bg-yellow-500/20 text-yellow-400'
    return 'bg-red-500/20 text-red-400'
}

function getProgressColor(score) {
    if (score >= 80) return 'bg-gradient-to-r from-emerald-600 to-emerald-400'
    if (score >= 60) return 'bg-gradient-to-r from-yellow-600 to-yellow-400'
    return 'bg-gradient-to-r from-red-600 to-red-400'
}
