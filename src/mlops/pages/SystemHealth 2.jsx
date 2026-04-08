import React, { useMemo } from 'react'
import { Activity, AlertTriangle, ShieldCheck, TrendingDown, TrendingUp, Zap, Server, Database, Heart } from 'lucide-react'
import { useSystemHealth } from '../hooks/useSystemHealth'
import GenAIChatOverlay from '../components/GenAIChatOverlay'

export default function SystemHealth() {
    const { data, isLoading, error } = useSystemHealth()

    const sortedHealth = useMemo(() => {
        if (!data?.health) return []
        return [...data.health].sort((a, b) => b.health_score - a.health_score)
    }, [data])

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-96">
                <div className="relative">
                    <div className="w-16 h-16 border-4 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin"></div>
                    <div className="absolute inset-0 flex items-center justify-center">
                        <Activity className="w-6 h-6 text-cyan-400 animate-pulse" />
                    </div>
                </div>
            </div>
        )
    }

    if (error || !data) {
        return (
            <div className="flex items-center justify-center h-64 border border-red-500/20 bg-red-900/10 rounded-xl m-6">
                <div className="text-center">
                    <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
                    <h3 className="text-white font-bold">System Health Data Unavailable</h3>
                    <p className="text-red-400 text-sm mt-2">Check backend connection.</p>
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-8 pb-20 relative">
            <GenAIChatOverlay />

            {/* Header Section */}
            <div className="bg-[#050505] border border-[#1A1A1A] rounded-2xl p-8 relative overflow-hidden shadow-2xl">
                <div className="absolute top-0 right-0 p-8 opacity-10">
                    <Heart className="w-32 h-32 text-pink-500 transform -rotate-12" />
                </div>

                <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div>
                        <div className="flex items-center gap-2 mb-2">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-pink-500/10 text-pink-400 border border-pink-500/20 uppercase tracking-widest">
                                Health Monitor
                            </span>
                        </div>
                        <h2 className="text-3xl font-display font-black text-white tracking-tight">
                            System Health
                        </h2>
                        <p className="text-gray-400 mt-2 text-sm max-w-xl leading-relaxed">
                            Real-time infrastructure and model telemetry.
                        </p>
                    </div>
                    {data.summary && (
                        <div className="flex gap-4">
                            <div className="text-right">
                                <div className="text-[10px] uppercase text-gray-500 font-bold tracking-widest mb-1">Health Score</div>
                                <div className="text-3xl font-black text-emerald-400">{data.summary.avg_health.toFixed(1)}</div>
                            </div>
                            <div className="w-px bg-[#222]" />
                            <div className="text-right">
                                <div className="text-[10px] uppercase text-gray-500 font-bold tracking-widest mb-1">Active Models</div>
                                <div className="text-3xl font-black text-white">{data.summary.total}</div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* KPI Grid */}
            {data.summary && (
                <div className="grid gap-6 md:grid-cols-4">
                    <KPICard
                        icon={ShieldCheck}
                        label="Overall Health"
                        value={data.summary.avg_health.toFixed(1)}
                        suffix="/ 100"
                        percent={data.summary.avg_health}
                        color="indigo"
                    />
                    <KPICard
                        icon={Zap}
                        label="Healthy Models"
                        value={data.summary.healthy_count}
                        suffix={`/ ${data.summary.total}`}
                        percent={(data.summary.healthy_count / data.summary.total) * 100}
                        color="emerald"
                    />
                    <KPICard
                        icon={Database}
                        label="Fresh Data"
                        value={data.summary.fresh_count}
                        suffix={`/ ${data.summary.total}`}
                        percent={(data.summary.fresh_count / data.summary.total) * 100}
                        color="cyan"
                    />
                    <KPICard
                        icon={Server}
                        label="Stable Models"
                        value={data.summary.stable_count}
                        suffix={`/ ${data.summary.total}`}
                        percent={(data.summary.stable_count / data.summary.total) * 100}
                        color="amber"
                    />
                </div>
            )}

            {/* Live Model Telemetry */}
            <div className="bg-[#050505] rounded-2xl border border-[#1A1A1A] p-6 shadow-xl">
                <div className="flex items-center gap-3 mb-6">
                    <h3 className="text-sm font-bold text-white uppercase tracking-widest flex items-center gap-2">
                        <Activity className="w-4 h-4 text-cyan-500" />
                        Live Model Telemetry
                    </h3>
                </div>

                <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
                    {sortedHealth.map((row) => (
                        <ModelCard key={`${row.model}-${row.client}`} row={row} />
                    ))}
                </div>
            </div>

            {/* Predictive Insights */}
            <div className="bg-[#050505] rounded-2xl border border-[#1A1A1A] p-6 shadow-xl">
                <div className="flex items-center gap-3 mb-6">
                    <h3 className="text-sm font-bold text-white uppercase tracking-widest flex items-center gap-2">
                        <TrendingUp className="w-4 h-4 text-purple-500" />
                        Predictive Insights
                    </h3>
                </div>

                {data.predictive.length === 0 ? (
                    <div className="p-12 rounded-xl bg-[#0A0A0A] border border-[#1A1A1A] text-center">
                        <ShieldCheck className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                        <p className="text-gray-400 italic">No critical trends predicted. Systems behaving nominally.</p>
                    </div>
                ) : (
                    <div className="grid gap-4 md:grid-cols-3">
                        {data.predictive.map((item, idx) => (
                            <div key={idx} className="relative group overflow-hidden p-6 rounded-xl bg-[#0A0A0A] border border-[#1A1A1A] hover:border-purple-500/30 transition-all duration-300">
                                <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/5 rounded-full blur-2xl group-hover:bg-purple-500/10 transition-all" />
                                <div className="relative z-10">
                                    <div className="flex justify-between items-start mb-4">
                                        <h4 className="text-white font-bold text-sm">{item.model}</h4>
                                        <span className="text-[10px] uppercase font-mono px-2 py-1 rounded bg-[#151515] text-gray-400 border border-[#222]">{item.client}</span>
                                    </div>
                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between text-xs">
                                            <span className="text-gray-500">Trend</span>
                                            <span className="text-orange-400 font-bold">{item.trend?.strength} {item.trend?.direction}</span>
                                        </div>
                                        {item.breach?.will_breach ? (
                                            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center gap-3 text-red-400 text-xs font-bold">
                                                <AlertTriangle className="w-4 h-4 shrink-0 animate-pulse" />
                                                <span>Breach likely in {item.breach?.days_to_breach} days</span>
                                            </div>
                                        ) : (
                                            <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-3 text-emerald-400 text-xs font-bold">
                                                <ShieldCheck className="w-4 h-4 shrink-0" />
                                                <span>Trajectory safe</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}

function KPICard({ icon: Icon, label, value, suffix, percent, color }) {
    const colors = {
        indigo: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20',
        emerald: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
        cyan: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20',
        amber: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
    }
    const barColors = {
        indigo: 'bg-indigo-500',
        emerald: 'bg-emerald-500',
        cyan: 'bg-cyan-500',
        amber: 'bg-amber-500',
    }


    return (
        <div className="relative p-6 rounded-xl bg-[#0A0A0A] border border-[#1A1A1A] hover:border-[#333] transition-all group overflow-hidden">
            <div className="flex justify-between items-start mb-4">
                <div className={`p-3 rounded-lg ${colors[color]} border`}>
                    <Icon className="w-5 h-5" />
                </div>
                <div className="text-right">
                    <p className="text-2xl font-black text-white tracking-tight">{value}</p>
                    <p className="text-[10px] text-gray-500 font-mono mt-1">{suffix}</p>
                </div>
            </div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">{label}</p>
            <div className="w-full h-1 bg-[#1A1A1A] rounded-full overflow-hidden">
                <div className={`h-full ${barColors[color]} rounded-full transition-all duration-1000`} style={{ width: `${percent}%` }} />
            </div>
        </div>
    )
}

function ModelCard({ row }) {
    return (
        <div className="group relative p-6 rounded-xl bg-[#0A0A0A] border border-[#1A1A1A] hover:border-indigo-500/30 transition-all duration-300">
            <div className="flex justify-between items-start mb-6">
                <div>
                    <h4 className="text-sm font-bold text-white group-hover:text-indigo-400 transition-colors">{row.model}</h4>
                    <p className="text-[10px] font-mono text-gray-500 mt-1 uppercase tracking-wider">{row.client}</p>
                </div>
                <div className="relative">
                    <GradientGauge value={row.health_score} size={48} />
                </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-lg bg-[#111] border border-[#222]">
                    <div className="flex items-center gap-2 mb-1 text-[10px] text-gray-500 uppercase tracking-wider">
                        <Activity className="w-3 h-3 text-cyan-500" />
                        Freshness
                    </div>
                    <div className="text-sm font-bold text-white">{row.freshness?.toFixed(0) ?? '-'}%</div>
                </div>
                <div className="p-3 rounded-lg bg-[#111] border border-[#222]">
                    <div className="flex items-center gap-2 mb-1 text-[10px] text-gray-500 uppercase tracking-wider">
                        <ShieldCheck className="w-3 h-3 text-emerald-500" />
                        Stability
                    </div>
                    <div className="text-sm font-bold text-white">{row.stability?.toFixed(0) ?? '-'}%</div>
                </div>
            </div>
        </div>
    )
}

function GradientGauge({ value, size = 60 }) {
    const radius = size / 2 - 4
    const circumference = 2 * Math.PI * radius
    const offset = circumference - (value / 100) * circumference
    const id = useMemo(() => Math.random().toString(36).substr(2, 9), [])

    return (
        <div className="relative flex items-center justify-center">
            <svg width={size} height={size} className="transform -rotate-90">
                <defs>
                    <linearGradient id={`gradient-${id}`} x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#818cf8" />
                        <stop offset="100%" stopColor="#22d3ee" />
                    </linearGradient>
                </defs>
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    className="stroke-[#222] fill-none"
                    strokeWidth="3"
                />
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    stroke={`url(#gradient-${id})`}
                    fill="none"
                    strokeWidth="3"
                    strokeDasharray={circumference}
                    strokeDashoffset={offset}
                    strokeLinecap="round"
                    className="transition-all duration-1000 ease-out"
                />
            </svg>
            <span className="absolute text-[10px] font-bold text-white">{value.toFixed(0)}</span>
        </div>
    )
}
