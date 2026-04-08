import React from 'react'
import { useDashboardContext } from '../context/DashboardContext'
import '../styles/mlops-compat.css'

export default function Settings() {
    const { filters, meta } = useDashboardContext()

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="card-outline p-6 border border-white/10">
                <h2 className="text-3xl font-bold text-white">
                    Environment <span className="text-slate-400">Settings</span>
                </h2>
                <p className="text-slate-400 mt-2 text-sm">
                    Operational context, data sources, and support contacts.
                </p>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
                {/* Data Context */}
                <div className="card-outline p-5">
                    <h3 className="text-lg font-semibold text-white mb-4">Data Context</h3>
                    <div className="space-y-3 text-sm">
                        <div className="flex justify-between p-3 bg-slate-800/50 rounded">
                            <span className="text-slate-400">Data source</span>
                            <span className="text-white font-mono">{meta?.data_source ?? 'snapshot'}</span>
                        </div>
                        <div className="flex justify-between p-3 bg-slate-800/50 rounded">
                            <span className="text-slate-400">Selected window</span>
                            <span className="text-white font-mono">{filters.startDate} to {filters.endDate}</span>
                        </div>
                        <div className="flex justify-between p-3 bg-slate-800/50 rounded">
                            <span className="text-slate-400">Model scope</span>
                            <span className="text-white font-mono">{filters.model}</span>
                        </div>
                        <div className="flex justify-between p-3 bg-slate-800/50 rounded">
                            <span className="text-slate-400">Client</span>
                            <span className="text-white font-mono">{filters.client}</span>
                        </div>
                        <div className="flex justify-between p-3 bg-slate-800/50 rounded">
                            <span className="text-slate-400">Latest refresh</span>
                            <span className="text-white font-mono">{meta?.latest_data_point?.split('T')[0] || 'N/A'}</span>
                        </div>
                    </div>
                </div>

                {/* Support */}
                <div className="card-outline p-5">
                    <h3 className="text-lg font-semibold text-white mb-4">Support</h3>
                    <p className="text-sm text-slate-300 mb-4">
                        Reach the observability team for anomaly reviews, alert tuning, or telemetry walkthroughs.
                    </p>
                    <div className="space-y-3">
                        <div className="p-3 bg-slate-800/50 rounded">
                            <span className="text-slate-400 text-xs uppercase tracking-widest">Email</span>
                            <p className="text-cyan-400 font-mono">support@ikshealth.com</p>
                        </div>
                        <div className="p-3 bg-slate-800/50 rounded">
                            <span className="text-slate-400 text-xs uppercase tracking-widest">Phone</span>
                            <p className="text-white font-mono">+1 (800) 555-0199</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* API Info */}
            <div className="card-outline p-5">
                <h3 className="text-lg font-semibold text-white mb-4">API Configuration</h3>
                <div className="grid gap-4 md:grid-cols-2">
                    <div className="p-3 bg-slate-800/50 rounded">
                        <span className="text-slate-400 text-xs uppercase tracking-widest">Backend URL</span>
                        <p className="text-white font-mono">http://localhost:8510</p>
                    </div>
                    <div className="p-3 bg-slate-800/50 rounded">
                        <span className="text-slate-400 text-xs uppercase tracking-widest">Status</span>
                        <p className="text-emerald-400 font-mono">Connected</p>
                    </div>
                </div>
            </div>
        </div>
    )
}
