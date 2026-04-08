import { useState } from 'react'
import { AlertTriangle, Mail } from 'lucide-react'
import { useDashboardContext } from '../context/DashboardContext'
import FilterPanel from '../components/filters/FilterPanel'
import { useAlerts } from '../hooks/useAlerts'
import { apiService } from '../services/api'

export default function Alerts() {
    const { filters } = useDashboardContext()
    const [sending, setSending] = useState<string | null>(null)
    const [aiInsights, setAiInsights] = useState<Record<string, { text?: string; loading: boolean; error?: string }>>({})

    const { data, isLoading, error } = useAlerts({
        model: filters.model,
        client: filters.client,
        start_date: filters.startDate,
        end_date: filters.endDate,
        include_root_cause: true,
    })

    const handleSend = async (type: 'summary' | 'client' | 'consolidated') => {
        setSending(type)
        const payload = {
            model: filters.model,
            client: filters.client,
            start_date: filters.startDate,
            end_date: filters.endDate,
            period_label: `${filters.startDate} to ${filters.endDate}`,
        }
        try {
            if (type === 'summary') {
                await apiService.sendSummaryEmail(payload)
            } else if (type === 'client') {
                await apiService.sendClientEmails(payload)
            } else {
                await apiService.sendConsolidatedEmail(payload)
            }
        } finally {
            setSending(null)
        }
    }

    const handleAiInsight = async (key: string, report: any) => {
        setAiInsights((prev) => ({ ...prev, [key]: { ...prev[key], loading: true, error: undefined } }))
        try {
            const question = `Provide a concise root-cause deep dive and next steps for this alert:\n${JSON.stringify(
                report
            )}`
            const res = await apiService.chat({
                message: question,
                context: { model: filters.model, client: filters.client },
                history: [],
            })
            setAiInsights((prev) => ({ ...prev, [key]: { loading: false, text: res.response || res.error } }))
        } catch (err: any) {
            setAiInsights((prev) => ({
                ...prev,
                [key]: { loading: false, error: err?.message || 'AI insight failed' },
            }))
        }
    }

    if (isLoading) {
        return <div className="text-white">Loading alerts...</div>
    }
    if (error || !data) {
        return <div className="text-error">Unable to load alerts.</div>
    }

    const { status_tally, severity_tally, rows, deepest_breach } = data.alerts

    return (
        <div className="space-y-6">
            <div className="card-outline p-6">
                <h2 className="text-3xl font-display font-bold text-white">
                    Alert Center <span className="gradient-text">Signals</span>
                </h2>
                <p className="text-slate-400 mt-2">
                    Threshold breaches, predictive warnings, and automated diagnostics.
                </p>
            </div>

            <FilterPanel rangeOptions={['All ranges']} availableMetrics={[]} />

            <div className="grid gap-4 md:grid-cols-4">
                <SummaryCard label="Active" value={status_tally?.active ?? 0} tone="warning" />
                <SummaryCard label="Acknowledged" value={status_tally?.acknowledged ?? 0} tone="primary" />
                <SummaryCard label="Resolved" value={status_tally?.resolved ?? 0} tone="success" />
                <SummaryCard label="High Severity" value={severity_tally?.high ?? 0} tone="error" />
            </div>

            {deepest_breach && (
                <div className="card-outline p-5">
                    <p className="text-sm text-slate-300">
                        Deepest breach: {deepest_breach.metric} for {deepest_breach.client} is{' '}
                        {deepest_breach.breach.toFixed(2)} below target.
                    </p>
                </div>
            )}

            <div className="card-outline p-5">
                <div className="flex flex-wrap gap-3 items-center justify-between">
                    <h3 className="text-lg font-semibold text-white">Alert Table</h3>
                    <div className="flex flex-wrap gap-2">
                        <button
                            type="button"
                            className="btn-primary flex items-center gap-2"
                            onClick={() => handleSend('summary')}
                            disabled={sending !== null}
                        >
                            <Mail className="w-4 h-4" />
                            Send Summary
                        </button>
                        <button
                            type="button"
                            className="btn-primary flex items-center gap-2"
                            onClick={() => handleSend('client')}
                            disabled={sending !== null}
                        >
                            Send Client Emails
                        </button>
                        <button
                            type="button"
                            className="btn-primary flex items-center gap-2"
                            onClick={() => handleSend('consolidated')}
                            disabled={sending !== null}
                        >
                            Send Consolidated
                        </button>
                    </div>
                </div>

                <div className="mt-4 space-y-3">
                    {rows.length === 0 && <p className="text-slate-400 text-sm">No alerts in this window.</p>}
                    {rows.map((row, idx) => (
                        <div key={idx} className="p-4 rounded-xl bg-white/5 border border-white/10">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                                <div className="flex items-center gap-2">
                                    <AlertTriangle className={`w-4 h-4 ${toneClass(row.severity)}`} />
                                    <div>
                                        <p className="text-white font-semibold">{row.signal}</p>
                                        <p className="text-xs text-slate-400">
                                            {row.model} · {row.client}
                                        </p>
                                    </div>
                                </div>
                                <span className="text-xs text-slate-400">{row.timestamp?.split('T')[0]}</span>
                            </div>
                            <div className="grid gap-2 mt-3 text-sm text-slate-300 md:grid-cols-3">
                                <div>Observed: {row.observed?.toFixed(2)}</div>
                                <div>Threshold: {row.threshold?.toFixed(2)}</div>
                                <div>Status: {row.status}</div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {data.root_cause.length > 0 && (
                <div className="card-outline p-5 border border-primary-500/20 shadow-glow">
                    <div className="flex items-center justify-between">
                        <h3 className="text-lg font-semibold text-white">Root Cause Analysis</h3>
                        <span className="pill border-primary-500/40 bg-primary-500/10 text-primary-50">
                            Automated Insights
                        </span>
                    </div>
                    <div className="mt-4 space-y-4">
                        {data.root_cause.map((report, idx) => (
                            <div
                                key={idx}
                                className="p-4 rounded-xl bg-gradient-glass border border-white/10 shadow-glass space-y-2"
                            >
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                    <p className="text-sm text-slate-300 font-semibold">
                                        {report.model} · {report.client}
                                    </p>
                                    {report.alert && (
                                        <span className="pill border-error/30 bg-error/10 text-error text-xs">
                                            {report.alert}
                                        </span>
                                    )}
                                </div>
                                {report.root_cause && (
                                    <div className="text-sm text-slate-200 space-y-1">
                                        <p className="text-primary-500 font-semibold">
                                            {report.root_cause.check}
                                        </p>
                                        <p className="text-slate-200">{report.root_cause.description}</p>
                                        <p className="text-slate-400">{report.root_cause.recommendation}</p>
                                    </div>
                                )}
                                <div className="flex items-center justify-between pt-2">
                                    <button
                                        type="button"
                                        className="px-3 py-1 rounded-full text-xs border border-white/10 bg-dark-850 text-slate-200"
                                        onClick={() => handleAiInsight(`${idx}`, report)}
                                        disabled={aiInsights[`${idx}`]?.loading}
                                    >
                                        {aiInsights[`${idx}`]?.loading ? 'Analyzing...' : 'AI deep dive'}
                                    </button>
                                    {aiInsights[`${idx}`]?.text && (
                                        <span className="text-xs text-primary-50">Insight ready</span>
                                    )}
                                    {aiInsights[`${idx}`]?.error && (
                                        <span className="text-xs text-error">{aiInsights[`${idx}`]?.error}</span>
                                    )}
                                </div>
                                {aiInsights[`${idx}`]?.text && (
                                    <div className="mt-2 text-sm text-slate-200 bg-dark-750/70 border border-white/10 rounded-lg p-3">
                                        {aiInsights[`${idx}`]?.text}
                                    </div>
                                )}
                                {report.actions && Array.isArray(report.actions) && report.actions.length > 0 && (
                                    <div className="mt-2 text-xs text-slate-300 space-y-1">
                                        <p className="text-slate-400 uppercase tracking-[0.2em]">Next Steps</p>
                                        <ul className="list-disc list-inside space-y-1">
                                            {report.actions.map((step: string, i: number) => (
                                                <li key={i}>{step}</li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}

function SummaryCard({ label, value, tone }: { label: string; value: number; tone: string }) {
    const tones: Record<string, string> = {
        warning: 'bg-warning/20 text-warning',
        primary: 'bg-primary-600/20 text-white',
        success: 'bg-success/20 text-success',
        error: 'bg-error/20 text-error',
    }
    return (
        <div className={`card-outline p-4 ${tones[tone] || tones.primary}`}>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">{label}</p>
            <p className="text-2xl font-bold mt-2">{value}</p>
        </div>
    )
}

function toneClass(severity: string) {
    if (severity === 'high') return 'text-error'
    if (severity === 'medium') return 'text-warning'
    return 'text-success'
}
