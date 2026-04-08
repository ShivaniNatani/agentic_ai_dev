import React, { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiService } from '../api/api'
import '../styles/mlops-compat.css'

export default function Incidents() {
    const queryClient = useQueryClient()
    const [showForm, setShowForm] = useState(false)
    const [formData, setFormData] = useState({
        title: '',
        description: '',
        severity: 'medium',
        category: 'model_performance',
        model: '',
        client: '',
    })

    const { data, isLoading, error } = useQuery({
        queryKey: ['incidents'],
        queryFn: () => apiService.fetchIncidents({ days: 30 })
    })

    const createMutation = useMutation({
        mutationFn: (payload) => apiService.createIncident(payload),
        onSuccess: () => {
            queryClient.invalidateQueries(['incidents'])
            setShowForm(false)
            setFormData({ title: '', description: '', severity: 'medium', category: 'model_performance', model: '', client: '' })
        }
    })

    const resolveMutation = useMutation({
        mutationFn: ({ id, resolution }) => apiService.resolveIncident(id, resolution),
        onSuccess: () => queryClient.invalidateQueries(['incidents'])
    })

    const handleSubmit = (e) => {
        e.preventDefault()
        createMutation.mutate(formData)
    }

    const handleResolve = (id) => {
        const resolution = window.prompt('Enter resolution notes:')
        if (resolution) {
            resolveMutation.mutate({ id, resolution })
        }
    }

    // Stats calculation
    const stats = useMemo(() => {
        if (!data?.incidents) return { total: 0, active: 0, resolved: 0 }
        const incidents = data.incidents
        return {
            total: incidents.length,
            active: incidents.filter(i => i.status === 'active' || i.status === 'open').length,
            resolved: incidents.filter(i => i.status === 'resolved').length,
        }
    }, [data])

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-96">
                <div className="text-center">
                    <div className="w-12 h-12 border-4 border-orange-500/20 border-t-orange-500 rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-slate-400">Loading incidents...</p>
                </div>
            </div>
        )
    }

    if (error) {
        return (
            <div className="flex items-center justify-center h-96">
                <div className="text-center text-red-400">
                    <p className="text-xl font-bold mb-2">Unable to load incidents</p>
                    <p className="text-sm">Check backend connectivity</p>
                </div>
            </div>
        )
    }

    const incidents = data?.incidents || []

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="card-outline p-6 border border-white/10">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div>
                        <h2 className="text-3xl font-bold text-white">
                            Incident <span className="text-orange-400">Tracker</span>
                        </h2>
                        <p className="text-slate-400 mt-2 text-sm">
                            Track and manage operational incidents across model deployments.
                        </p>
                    </div>
                    <button
                        onClick={() => setShowForm(!showForm)}
                        className="px-4 py-2 rounded bg-orange-600 text-white text-sm font-medium hover:bg-orange-500 transition-colors"
                    >
                        {showForm ? 'Cancel' : '+ Log Incident'}
                    </button>
                </div>
            </div>

            {/* Stats */}
            <div className="grid gap-4 md:grid-cols-3">
                <div className="card-outline p-5 border-l-4 border-l-slate-500">
                    <p className="text-xs uppercase tracking-widest text-slate-400">Total (30d)</p>
                    <p className="text-3xl font-bold text-white mt-2">{stats.total}</p>
                </div>
                <div className="card-outline p-5 border-l-4 border-l-orange-500">
                    <p className="text-xs uppercase tracking-widest text-slate-400">Active</p>
                    <p className="text-3xl font-bold text-white mt-2">{stats.active}</p>
                </div>
                <div className="card-outline p-5 border-l-4 border-l-emerald-500">
                    <p className="text-xs uppercase tracking-widest text-slate-400">Resolved</p>
                    <p className="text-3xl font-bold text-white mt-2">{stats.resolved}</p>
                </div>
            </div>

            {/* New Incident Form */}
            {showForm && (
                <form onSubmit={handleSubmit} className="card-outline p-5 space-y-4">
                    <h3 className="text-lg font-semibold text-white">Log New Incident</h3>
                    <div className="grid gap-4 md:grid-cols-2">
                        <input
                            type="text"
                            placeholder="Incident Title"
                            value={formData.title}
                            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                            className="w-full px-3 py-2 rounded bg-slate-800 border border-white/10 text-white text-sm"
                            required
                        />
                        <select
                            value={formData.severity}
                            onChange={(e) => setFormData({ ...formData, severity: e.target.value })}
                            className="w-full px-3 py-2 rounded bg-slate-800 border border-white/10 text-white text-sm"
                        >
                            <option value="low">Low</option>
                            <option value="medium">Medium</option>
                            <option value="high">High</option>
                            <option value="critical">Critical</option>
                        </select>
                    </div>
                    <textarea
                        placeholder="Description"
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        className="w-full px-3 py-2 rounded bg-slate-800 border border-white/10 text-white text-sm h-24"
                    />
                    <button
                        type="submit"
                        disabled={createMutation.isLoading}
                        className="px-4 py-2 rounded bg-cyan-600 text-white text-sm font-medium hover:bg-cyan-500 transition-colors disabled:opacity-50"
                    >
                        {createMutation.isLoading ? 'Creating...' : 'Create Incident'}
                    </button>
                </form>
            )}

            {/* Incidents List */}
            <div className="card-outline p-5">
                <h3 className="text-lg font-semibold text-white mb-4">Recent Incidents</h3>

                {incidents.length === 0 ? (
                    <p className="text-slate-400 text-sm">No incidents recorded in the last 30 days.</p>
                ) : (
                    <div className="space-y-3">
                        {incidents.slice(0, 10).map((incident, idx) => (
                            <motion.div
                                key={incident.id || idx}
                                className="p-4 rounded-lg bg-slate-800/50 border border-white/10"
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: idx * 0.03 }}
                            >
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className={`text-sm ${getSeverityIcon(incident.severity)}`}>
                                                {incident.severity === 'critical' ? '🔴' :
                                                    incident.severity === 'high' ? '🟠' :
                                                        incident.severity === 'medium' ? '🟡' : '🟢'}
                                            </span>
                                            <p className="text-white font-medium">{incident.title}</p>
                                        </div>
                                        <p className="text-xs text-slate-400">
                                            {incident.created_at?.split('T')[0]} · {incident.category}
                                        </p>
                                        {incident.description && (
                                            <p className="text-sm text-slate-300 mt-2">{incident.description}</p>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className={`px-2 py-0.5 rounded text-xs font-bold ${getStatusStyle(incident.status)}`}>
                                            {incident.status}
                                        </span>
                                        {incident.status !== 'resolved' && (
                                            <button
                                                onClick={() => handleResolve(incident.id)}
                                                className="px-3 py-1 rounded text-xs bg-emerald-600 text-white hover:bg-emerald-500"
                                            >
                                                Resolve
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}

function getSeverityIcon(severity) {
    if (severity === 'critical') return 'text-red-400'
    if (severity === 'high') return 'text-orange-400'
    if (severity === 'medium') return 'text-yellow-400'
    return 'text-emerald-400'
}

function getStatusStyle(status) {
    if (status === 'resolved') return 'bg-emerald-500/20 text-emerald-400'
    if (status === 'active' || status === 'open') return 'bg-orange-500/20 text-orange-400'
    return 'bg-slate-500/20 text-slate-400'
}
