import { useMemo } from 'react'
import { Activity, AlertTriangle, ShieldCheck, TrendingDown, TrendingUp } from 'lucide-react'
import { useSystemHealth } from '../hooks/useSystemHealth'

export default function SystemHealth() {
    const { data, isLoading, error } = useSystemHealth()

    const sortedHealth = useMemo(() => {
        if (!data?.health) return []
        return [...data.health].sort((a, b) => b.health_score - a.health_score)
    }, [data])

    if (isLoading) {
        return <div className="text-white">Loading system health...</div>
    }
    if (error || !data) {
        return <div className="text-error">System health data unavailable.</div>
    }

    return (
        <div className="space-y-6">
            <div className="card-outline p-6 border border-primary-500/30 shadow-glow">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div>
                        <h2 className="text-3xl font-display font-bold text-white">
                            System Health <span className="gradient-text">Scoreboard</span>
                        </h2>
                        <p className="text-slate-400 mt-2">
                            Composite scoring across accuracy, freshness, and stability with trend signals.
                        </p>
                    </div>
                    {data.summary && (
                        <div className="flex flex-wrap gap-3">
                            <StatusPill label="Health" value={data.summary.avg_health} icon={ShieldCheck} />
                            <StatusPill label="Fresh" value={data.summary.fresh_count} total={data.summary.total} icon={Activity} />
                            <StatusPill label="Stable" value={data.summary.stable_count} total={data.summary.total} icon={AlertTriangle} />
                        </div>
                    )}
                </div>
            </div>

            {data.summary && (
                <div className="grid gap-4 md:grid-cols-4">
                    <SummaryCard
                        icon={ShieldCheck}
                        label="Overall Health"
                        value={`${data.summary.avg_health.toFixed(1)}/100`}
                        percent={data.summary.avg_health}
                    />
                    <SummaryCard
                        icon={Activity}
                        label="Healthy Models"
                        value={`${data.summary.healthy_count}/${data.summary.total}`}
                        percent={(data.summary.healthy_count / data.summary.total) * 100}
                    />
                    <SummaryCard
                        icon={Activity}
                        label="Fresh Data"
                        value={`${data.summary.fresh_count}/${data.summary.total}`}
                        percent={(data.summary.fresh_count / data.summary.total) * 100}
                    />
                    <SummaryCard
                        icon={AlertTriangle}
                        label="Stable Models"
                        value={`${data.summary.stable_count}/${data.summary.total}`}
                        percent={(data.summary.stable_count / data.summary.total) * 100}
                    />
                </div>
            )}

            <div className="card-outline p-5">
                <h3 className="text-lg font-semibold text-white mb-3">Model Health Leaderboard</h3>
                <div className="grid gap-3 md:grid-cols-2">
                    {sortedHealth.map((row) => (
                        <div
                            key={`${row.model}-${row.client}`}
                            className="p-4 rounded-xl bg-dark-800/60 border border-white/10 shadow-glass space-y-2"
                        >
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-white font-semibold">{row.model}</p>
                                    <p className="text-xs text-slate-400">{row.client}</p>
                                </div>
                                <span className="pill bg-dark-750 border-white/10 text-slate-200">{row.status}</span>
                            </div>
                            <ProgressRow label="Health" value={row.health_score} tone="primary" />
                            <div className="grid grid-cols-2 gap-2 text-xs text-slate-300">
                                <span>Freshness {row.freshness?.toFixed(0) ?? 'n/a'}</span>
                                <span>Stability {row.stability?.toFixed(0) ?? 'n/a'}</span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <div className="card-outline p-5">
                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="text-lg font-semibold text-white">Predictive Insights</h3>
                        <p className="text-sm text-slate-400 mt-1">Models trending toward threshold breach.</p>
                    </div>
                </div>
                {data.predictive.length === 0 && (
                    <p className="text-sm text-slate-500 mt-3">No declining trends detected.</p>
                )}
                <div className="mt-4 grid gap-3 md:grid-cols-3">
                    {data.predictive.map((item, idx) => (
                        <div key={idx} className="p-4 rounded-xl bg-gradient-glass border border-white/10 shadow-glass space-y-2">
                            <div className="flex items-center justify-between">
                                <p className="text-white font-semibold">
                                    {item.model} · {item.client}
                                </p>
                                <span className="pill border-primary-500/40 bg-primary-500/10 text-primary-50">
                                    {item.trend?.direction}
                                </span>
                            </div>
                            <p className="text-xs text-slate-400">Trend strength: {item.trend?.strength}</p>
                            {item.breach?.will_breach ? (
                                <p className="text-xs text-warning flex items-center gap-1">
                                    <TrendingDown className="w-4 h-4" /> Breach in ~{item.breach?.days_to_breach} days
                                </p>
                            ) : (
                                <p className="text-xs text-success flex items-center gap-1">
                                    <TrendingUp className="w-4 h-4" /> No breach predicted
                                </p>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}

function SummaryCard({ icon: Icon, label, value, percent }: any) {
    return (
        <div className="card-outline p-4 flex flex-col gap-3 bg-dark-850/80 border border-white/10 shadow-glass">
            <div className="flex items-center gap-3">
                <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                    <Icon className="w-5 h-5 text-primary-500" />
                </div>
                <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-400">{label}</p>
                    <p className="text-xl font-bold text-white mt-1">{value}</p>
                </div>
            </div>
            {typeof percent === 'number' && (
                <div className="w-full h-2 rounded-full bg-white/5 overflow-hidden">
                    <div
                        className="h-2 rounded-full bg-gradient-primary"
                        style={{ width: `${Math.min(Math.max(percent, 0), 100)}%` }}
                    />
                </div>
            )}
        </div>
    )
}

function ProgressRow({ label, value, tone }: { label: string; value: number; tone?: string }) {
    const width = Math.min(Math.max(value, 0), 100)
    const color = tone === 'primary' ? 'bg-primary-500' : 'bg-success'
    return (
        <div>
            <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                <span>{label}</span>
                <span className="text-slate-200">{value.toFixed(1)}</span>
            </div>
            <div className="w-full h-2 rounded-full bg-white/5 overflow-hidden">
                <div className={`h-2 rounded-full ${color}`} style={{ width: `${width}%` }} />
            </div>
        </div>
    )
}

function StatusPill({
    label,
    value,
    total,
    icon: Icon,
}: {
    label: string
    value: number
    total?: number
    icon: any
}) {
    return (
        <div className="pill flex items-center gap-2 border-primary-500/40 bg-primary-500/10 text-primary-50">
            <Icon className="w-4 h-4" />
            <span className="text-sm font-semibold">
                {label}: {total ? `${value}/${total}` : value.toFixed ? value.toFixed(1) : value}
            </span>
        </div>
    )
}
