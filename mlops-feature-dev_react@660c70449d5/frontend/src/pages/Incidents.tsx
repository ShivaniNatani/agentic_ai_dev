import { useState } from 'react'
import { CheckCircle2 } from 'lucide-react'
import { useIncidents } from '../hooks/useIncidents'
import { apiService } from '../services/api'

export default function Incidents() {
    const { data, isLoading, error, refetch } = useIncidents({ days: 30 })
    const [submitting, setSubmitting] = useState(false)

    const handleCreate = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault()
        const form = new FormData(event.currentTarget)
        setSubmitting(true)
        try {
            await apiService.createIncident({
                title: String(form.get('title') || ''),
                description: String(form.get('description') || ''),
                severity: String(form.get('severity') || 'medium'),
                category: String(form.get('category') || 'incident'),
                model: String(form.get('model') || ''),
                client: String(form.get('client') || ''),
            })
            event.currentTarget.reset()
            await refetch()
        } finally {
            setSubmitting(false)
        }
    }

    const handleResolve = async (id: string) => {
        await apiService.resolveIncident(id, 'Resolved')
        await refetch()
    }

    if (isLoading) {
        return <div className="text-white">Loading incidents...</div>
    }
    if (error || !data) {
        return <div className="text-error">Unable to load incidents.</div>
    }

    return (
        <div className="space-y-6">
            <div className="card-outline p-6">
                <h2 className="text-3xl font-display font-bold text-white">
                    Incident History <span className="gradient-text">Timeline</span>
                </h2>
                <p className="text-slate-400 mt-2">Track outages, regressions, and operational incidents.</p>
            </div>

            <div className="grid gap-4 md:grid-cols-4">
                <StatCard label="Total (30d)" value={data.stats.total_incidents} />
                <StatCard label="Active" value={data.stats.active_incidents} tone="warning" />
                <StatCard label="Resolved" value={data.stats.resolved_incidents} tone="success" />
                <StatCard label="Avg Resolution (hrs)" value={data.stats.avg_resolution_hours.toFixed(1)} />
            </div>

            <div className="card-outline p-5">
                <h3 className="text-lg font-semibold text-white">Incident Timeline</h3>
                <div className="mt-4 space-y-2">
                    {data.timeline.length === 0 && <p className="text-slate-400 text-sm">No timeline data.</p>}
                    {data.timeline.map((item: any, idx: number) => (
                        <div key={idx} className="flex items-center justify-between border-b border-white/5 py-2">
                            <div>
                                <p className="text-white text-sm font-semibold">{item.title || item.type}</p>
                                <p className="text-xs text-slate-400">{item.category || item.type}</p>
                            </div>
                            <div className="text-xs text-slate-400">{item.timestamp?.split('T')[0]}</div>
                        </div>
                    ))}
                </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
                <div className="card-outline p-5 space-y-4">
                    <h3 className="text-lg font-semibold text-white">Recent Incidents</h3>
                    {data.recent.length === 0 && <p className="text-slate-400 text-sm">No recent incidents.</p>}
                    {data.recent.map((incident) => (
                        <div key={incident.id} className="p-4 rounded-xl bg-white/5 border border-white/10">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                                <div>
                                    <p className="text-white font-semibold">{incident.title || incident.type}</p>
                                    <p className="text-xs text-slate-400">
                                        {incident.model} · {incident.client} · {incident.category || incident.type}
                                    </p>
                                </div>
                                <span className="text-xs text-slate-400">{incident.timestamp.split('T')[0]}</span>
                            </div>
                            <p className="text-sm text-slate-300 mt-2">{incident.description}</p>
                            <div className="flex items-center justify-between mt-3 text-xs text-slate-400">
                                <span>Status: {incident.status}</span>
                                {incident.status !== 'resolved' && (
                                    <button
                                        type="button"
                                        onClick={() => handleResolve(incident.id)}
                                        className="flex items-center gap-1 text-success"
                                    >
                                        <CheckCircle2 className="w-3 h-3" />
                                        Resolve
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>

                <div className="card-outline p-5">
                    <h3 className="text-lg font-semibold text-white mb-4">Log New Incident</h3>
                    <form onSubmit={handleCreate} className="space-y-3">
                        <input className="input" name="title" placeholder="Title" required />
                        <textarea className="input min-h-[80px]" name="description" placeholder="Description" required />
                        <select className="input" name="severity" defaultValue="medium">
                            <option value="low">Low</option>
                            <option value="medium">Medium</option>
                            <option value="high">High</option>
                            <option value="critical">Critical</option>
                        </select>
                        <select className="input" name="category" defaultValue="model_performance">
                            <option value="model_performance">Model Performance</option>
                            <option value="data_pipeline">Data Pipeline</option>
                            <option value="infrastructure">Infrastructure</option>
                            <option value="latency">Latency</option>
                            <option value="other">Other</option>
                        </select>
                        <input className="input" name="model" placeholder="Model (optional)" />
                        <input className="input" name="client" placeholder="Client (optional)" />
                        <button type="submit" className="btn-primary w-full" disabled={submitting}>
                            {submitting ? 'Saving...' : 'Log Incident'}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    )
}

function StatCard({ label, value, tone = 'primary' }: { label: string; value: number | string; tone?: 'primary' | 'warning' | 'success' }) {
    const tones: Record<string, string> = {
        primary: 'bg-primary-600/20 text-white',
        warning: 'bg-warning/20 text-warning',
        success: 'bg-success/20 text-success',
    }
    return (
        <div className={`card-outline p-4 ${tones[tone] || tones.primary}`}>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">{label}</p>
            <p className="text-2xl font-bold mt-2">{value}</p>
        </div>
    )
}
