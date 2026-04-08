import React, { useMemo } from 'react'
import { ClipboardList, CheckCircle, Clock, AlertTriangle, ShieldAlert } from 'lucide-react'
import { useDashboardContext } from '../context/DashboardContext'
import { useIncidents } from '../hooks/useIncidents'
import FilterPanel from '../components/FilterPanel'
import GenAIChatOverlay from '../components/GenAIChatOverlay'

export default function Incidents() {
    const { filters } = useDashboardContext()
    const { data, isLoading } = useIncidents({
        model: filters.model,
        client: filters.client
    })

    const incidents = useMemo(() => data?.incidents || [], [data])

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-64 border border-indigo-500/20 bg-indigo-900/10 rounded-xl m-6">
                <div className="text-center">
                    <Clock className="w-12 h-12 text-indigo-500 mx-auto mb-4 animate-pulse" />
                    <h3 className="text-white font-bold">Loading Incidents...</h3>
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-6 pb-20 relative">
            <GenAIChatOverlay />

            {/* Header Block */}
            <div className="bg-[#050505] p-8 rounded-2xl border border-[#1A1A1A] shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 p-8 opacity-10">
                    <ShieldAlert className="w-32 h-32 text-red-500 transform -rotate-12" />
                </div>

                <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                    <div>
                        <div className="flex items-center gap-2 mb-2">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-500/10 text-red-400 border border-red-500/20 uppercase tracking-widest">
                                Incident Response
                            </span>
                        </div>
                        <h2 className="text-3xl font-display font-black text-white tracking-tight">
                            Incident History
                        </h2>
                        <p className="text-gray-400 text-sm mt-2 max-w-xl leading-relaxed">
                            Track resolution of model performance issues and anomalies.
                        </p>
                    </div>

                    <div className="flex gap-4">
                        <div className="text-right">
                            <div className="text-[10px] uppercase text-gray-500 font-bold tracking-widest mb-1">Open</div>
                            <div className="text-3xl font-black text-red-500">{incidents.filter(i => i.status !== 'resolved').length}</div>
                        </div>
                        <div className="w-px bg-[#222]" />
                        <div className="text-right">
                            <div className="text-[10px] uppercase text-gray-500 font-bold tracking-widest mb-1">Total</div>
                            <div className="text-3xl font-black text-white">{incidents.length}</div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="bg-[#050505] rounded-xl border border-[#1A1A1A] p-2">
                <FilterPanel availableMetrics={[]} showAdvanced={false} />
            </div>

            <div className="bg-[#050505] rounded-2xl border border-[#1A1A1A] shadow-xl overflow-hidden min-h-[500px]">
                {/* Toolbar */}
                <div className="p-4 border-b border-[#1A1A1A] bg-[#0A0A0A] flex justify-between items-center">
                    <div className="flex items-center gap-4">
                        <h3 className="font-bold text-white text-xs uppercase tracking-[0.2em] flex items-center gap-2">
                            <ClipboardList className="w-4 h-4 text-orange-500" /> Incident Log
                        </h3>
                    </div>
                </div>

                {incidents.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-96 opacity-50">
                        <CheckCircle className="w-16 h-16 text-emerald-500 mb-4" />
                        <p className="text-xl text-white font-bold">No Active Incidents</p>
                        <p className="text-sm text-gray-500 mt-2">No incidents recorded for this period.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-[#080808] border-b border-[#1A1A1A]">
                                <tr>
                                    <th className="px-6 py-4 text-[10px] uppercase font-bold text-gray-500 tracking-wider">Status</th>
                                    <th className="px-6 py-4 text-[10px] uppercase font-bold text-gray-500 tracking-wider">ID</th>
                                    <th className="px-6 py-4 text-[10px] uppercase font-bold text-gray-500 tracking-wider w-1/3">Title</th>
                                    <th className="px-6 py-4 text-[10px] uppercase font-bold text-gray-500 tracking-wider">Severity</th>
                                    <th className="px-6 py-4 text-[10px] uppercase font-bold text-gray-500 tracking-wider">Assigned To</th>
                                    <th className="px-6 py-4 text-[10px] uppercase font-bold text-gray-500 tracking-wider text-right">Created</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[#1A1A1A]">
                                {incidents.map((inc, i) => (
                                    <tr key={i} className="hover:bg-[#0A0A0A] transition-colors group">
                                        <td className="px-6 py-4">
                                            <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold border ${inc.status === 'resolved'
                                                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                                    : 'bg-orange-500/10 text-orange-400 border-orange-500/20'
                                                }`}>
                                                {inc.status === 'resolved' ? <CheckCircle className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                                                <span className="capitalize">{inc.status}</span>
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 font-mono text-xs text-gray-500">{inc.id}</td>
                                        <td className="px-6 py-4">
                                            <span className="text-white font-medium text-sm block group-hover:text-indigo-400 transition-colors">
                                                {inc.title}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider ${inc.severity === 'high'
                                                    ? 'text-red-400 bg-red-500/10 border border-red-500/20'
                                                    : 'text-blue-400 bg-blue-500/10 border border-blue-500/20'
                                                }`}>
                                                {inc.severity}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2">
                                                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-gray-700 to-gray-800 flex items-center justify-center text-[10px] text-white font-bold border border-gray-600">
                                                    {(inc.assignee || 'U').charAt(0)}
                                                </div>
                                                <span className="text-sm text-gray-300">{inc.assignee || 'Unassigned'}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-right text-gray-500 text-xs font-mono">
                                            {new Date(inc.created_at).toLocaleDateString()}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    )
}
