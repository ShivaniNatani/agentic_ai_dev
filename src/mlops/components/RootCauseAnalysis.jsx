import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, AlertTriangle, ArrowRight, CheckCircle, BarChart2, Activity } from 'lucide-react'

export default function RootCauseAnalysis({ isOpen, onClose, alertData }) {
    if (!isOpen || !alertData) return null

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                {/* Backdrop */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={onClose}
                    className="absolute inset-0 bg-black/80 backdrop-blur-sm"
                />

                {/* Modal */}
                <motion.div
                    initial={{ scale: 0.95, opacity: 0, y: 20 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ scale: 0.95, opacity: 0, y: 20 }}
                    className="relative w-full max-w-4xl bg-[#111111] border border-gray-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
                >
                    {/* Header */}
                    <div className="p-6 border-b border-gray-800 bg-[#151515] flex justify-between items-start">
                        <div>
                            <div className="flex items-center gap-3 mb-2">
                                <span className={`px-3 py-0.5 rounded textxs font-bold uppercase tracking-wider ${alertData.severity === 'critical' ? 'bg-red-500/20 text-red-400 border border-red-500/30' :
                                        'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                                    }`}>
                                    {alertData.severity} Incident
                                </span>
                                <span className="text-gray-500 text-sm font-mono">{new Date().toLocaleDateString()}</span>
                            </div>
                            <h2 className="text-2xl font-bold text-white mb-1">Root Cause Analysis</h2>
                            <p className="text-gray-400 text-sm">Automated investigation for <span className="text-white font-mono">{alertData.metric}</span> anomaly.</p>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-white/10 rounded-lg transition-colors text-gray-400 hover:text-white"
                        >
                            <X className="w-6 h-6" />
                        </button>
                    </div>

                    {/* Content */}
                    <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">

                        {/* 1. Summary Block */}
                        <div className="grid md:grid-cols-3 gap-4">
                            <div className="p-4 bg-[#1A1A1A] rounded-xl border border-gray-800">
                                <h4 className="text-xs text-gray-500 uppercase font-bold mb-2">Impacted Model</h4>
                                <div className="text-white font-semibold">{alertData.model}</div>
                                <div className="text-xs text-gray-400 mt-1">{alertData.client}</div>
                            </div>
                            <div className="p-4 bg-[#1A1A1A] rounded-xl border border-gray-800">
                                <h4 className="text-xs text-gray-500 uppercase font-bold mb-2">Deviation</h4>
                                <div className="flex items-end gap-2">
                                    <span className="text-2xl font-bold text-red-400">-12.4%</span>
                                    <span className="text-xs text-gray-400 mb-1">vs Threshold</span>
                                </div>
                            </div>
                            <div className="p-4 bg-[#1A1A1A] rounded-xl border border-gray-800">
                                <h4 className="text-xs text-gray-500 uppercase font-bold mb-2">Primary Factor</h4>
                                <div className="text-cyan-400 font-semibold flex items-center gap-2">
                                    <BarChart2 className="w-4 h-4" /> Feature Drift
                                </div>
                            </div>
                        </div>

                        {/* 2. Feature Witness Chart (Mock) */}
                        <div className="p-6 bg-[#1A1A1A] rounded-xl border border-gray-800">
                            <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                                <Activity className="w-5 h-5 text-purple-400" /> Feature Contribution Analysis
                            </h3>
                            <div className="space-y-4">
                                <FeatureBar label="Payer_Category" value={85} color="bg-red-500" warning />
                                <FeatureBar label="Diagnosis_Code_Primary" value={45} color="bg-orange-500" />
                                <FeatureBar label="Patient_Age_Group" value={20} color="bg-blue-500" />
                                <FeatureBar label="Facility_Type" value={12} color="bg-gray-600" />
                            </div>
                            <p className="text-xs text-gray-500 mt-4 text-center italic">
                                * Shapiro-Wilk test indicates <span className="text-white font-bold">Payer_Category</span> has shifted significantly (p &lt; 0.05).
                            </p>
                        </div>

                        {/* 3. Recommended Actions */}
                        <div>
                            <h3 className="text-lg font-bold text-white mb-4">Recommended Recovery Actions</h3>
                            <div className="space-y-3">
                                <ActionStep
                                    step={1}
                                    title="Retrain with recent data"
                                    desc="Include the last 7 days of adjudicated claims to capture the new payer behavior."
                                    primary
                                />
                                <ActionStep
                                    step={2}
                                    title="Adjust Thresholds"
                                    desc="Temporarily lower accuracy threshold to 75% to reduce noise while retraining."
                                />
                                <ActionStep
                                    step={3}
                                    title="Notify Downstream Consumers"
                                    desc="Alert the Prior Auth team that auto-approval rates may drop."
                                />
                            </div>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="p-6 border-t border-gray-800 bg-[#151515] flex justify-end gap-3">
                        <button onClick={onClose} className="px-4 py-2 text-sm font-semibold text-gray-300 hover:text-white transition-colors">
                            Dismiss
                        </button>
                        <button className="px-6 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-sm font-bold transition-colors flex items-center gap-2">
                            Execute Automated Fix <ArrowRight className="w-4 h-4" />
                        </button>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    )
}

function FeatureBar({ label, value, color, warning }) {
    return (
        <div className="flex items-center gap-4">
            <div className="w-48 text-sm text-gray-300 font-mono truncate text-right">{label}</div>
            <div className="flex-1 h-3 bg-gray-800 rounded-full overflow-hidden relative">
                <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${value}%` }}
                    transition={{ duration: 1, ease: 'easeOut' }}
                    className={`h-full ${color}`}
                />
            </div>
            <div className="w-12 text-sm text-gray-400 font-bold">{value}%</div>
            {warning && <AlertTriangle className="w-4 h-4 text-red-500 animate-pulse" />}
        </div>
    )
}

function ActionStep({ step, title, desc, primary }) {
    return (
        <div className={`flex items-start gap-4 p-4 rounded-xl border transition-colors ${primary ? 'bg-cyan-900/10 border-cyan-500/30' : 'bg-[#1A1A1A] border-gray-800'
            }`}>
            <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${primary ? 'bg-cyan-500 text-black' : 'bg-gray-700 text-gray-300'
                }`}>
                {step}
            </div>
            <div>
                <h4 className={`font-bold text-sm ${primary ? 'text-cyan-400' : 'text-gray-200'}`}>{title}</h4>
                <p className="text-gray-500 text-xs mt-1 leading-relaxed">{desc}</p>
            </div>
            {primary && <CheckCircle className="w-5 h-5 text-cyan-500 ml-auto self-center" />}
        </div>
    )
}
