import React from 'react'
import { Save, Bell, Mail, Shield, Sliders } from 'lucide-react'
import { apiService } from '../api/api'
import GenAIChatOverlay from '../components/GenAIChatOverlay'

export default function Settings() {
    return (
        <div className="space-y-6 pb-20 relative">
            <GenAIChatOverlay />

            {/* Header Block */}
            <div className="bg-[#050505] p-8 rounded-2xl border border-[#1A1A1A] shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 p-8 opacity-10">
                    <Sliders className="w-32 h-32 text-gray-500 transform -rotate-12" />
                </div>

                <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                    <div>
                        <div className="flex items-center gap-2 mb-2">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-gray-500/10 text-gray-400 border border-gray-500/20 uppercase tracking-widest">
                                Configuration
                            </span>
                        </div>
                        <h2 className="text-3xl font-display font-black text-white tracking-tight">
                            MLOps Settings
                        </h2>
                        <p className="text-gray-400 text-sm mt-2 max-w-xl leading-relaxed">
                            Configure alert thresholds, notification preferences, and monitoring defaults.
                        </p>
                    </div>
                    <button className="flex items-center gap-2 px-6 py-3 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl transition-all font-bold shadow-lg shadow-cyan-900/20">
                        <Save className="w-4 h-4" />
                        Save Changes
                    </button>
                </div>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
                {/* Notification Settings */}
                <div className="bg-[#050505] p-6 border border-[#1A1A1A] rounded-2xl shadow-xl space-y-6">
                    <h3 className="text-sm font-bold text-white uppercase tracking-widest flex items-center gap-2">
                        <Bell className="w-4 h-4 text-cyan-500" />
                        Notification Channels
                    </h3>
                    <div className="space-y-3">
                        <label className="flex items-center gap-4 p-4 rounded-xl bg-[#0A0A0A] border border-[#222] cursor-pointer hover:border-gray-700 transition-colors group">
                            <input type="checkbox" defaultChecked className="w-5 h-5 accent-cyan-500 bg-[#111] border-gray-700 rounded" />
                            <div className="flex-1">
                                <span className="block text-sm font-bold text-white group-hover:text-cyan-400 transition-colors">Email Notifications</span>
                                <span className="text-xs text-gray-500">Daily digests and critical alerts</span>
                            </div>
                            <Mail className="w-5 h-5 text-gray-600 group-hover:text-cyan-500 transition-colors" />
                        </label>
                        <label className="flex items-center gap-4 p-4 rounded-xl bg-[#0A0A0A] border border-[#222] cursor-pointer hover:border-gray-700 transition-colors group">
                            <input type="checkbox" defaultChecked className="w-5 h-5 accent-cyan-500 bg-[#111] border-gray-700 rounded" />
                            <div className="flex-1">
                                <span className="block text-sm font-bold text-white group-hover:text-green-400 transition-colors">Slack Integration</span>
                                <span className="text-xs text-gray-500">Real-time #mlops-alerts channel</span>
                            </div>
                            <span className="text-[10px] font-bold bg-green-500/10 text-green-400 px-2 py-1 rounded border border-green-500/20 uppercase tracking-wider">Connected</span>
                        </label>
                    </div>
                </div>

                {/* Threshold Defaults */}
                <div className="bg-[#050505] p-6 border border-[#1A1A1A] rounded-2xl shadow-xl space-y-6">
                    <h3 className="text-sm font-bold text-white uppercase tracking-widest flex items-center gap-2">
                        <Shield className="w-4 h-4 text-purple-500" />
                        Global Thresholds
                    </h3>
                    <div className="space-y-6">
                        <div>
                            <div className="flex justify-between mb-2">
                                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Accuracy Warning Threshold</label>
                                <span className="text-xs font-mono text-cyan-400 font-bold">80%</span>
                            </div>
                            <input type="range" className="w-full accent-cyan-500 bg-[#222] h-2 rounded-full appearance-none cursor-pointer" />
                            <div className="flex justify-between text-[10px] text-gray-600 font-mono mt-1">
                                <span>60%</span>
                                <span>90%</span>
                            </div>
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 block">Drift Sensitivity</label>
                            <select className="w-full bg-[#0A0A0A] border border-[#222] rounded-xl px-4 py-3 text-sm text-white focus:border-cyan-500/50 outline-none transition-colors appearance-none">
                                <option>Standard (3-sigma)</option>
                                <option>High (2-sigma)</option>
                                <option>Low (5-sigma)</option>
                            </select>
                        </div>
                    </div>
                </div>

                {/* Reports & Delivery */}
                <div className="bg-[#050505] p-6 border border-[#1A1A1A] rounded-2xl shadow-xl space-y-6 md:col-span-2">
                    <div className="flex items-center justify-between">
                        <h3 className="text-sm font-bold text-white uppercase tracking-widest flex items-center gap-2">
                            <Mail className="w-4 h-4 text-emerald-500" />
                            Reports & Delivery
                        </h3>
                        <span className="text-xs text-gray-500">Trigger on-demand reports</span>
                    </div>

                    <div className="flex flex-wrap gap-4">
                        <button onClick={async () => {
                            try {
                                await apiService.sendSummaryEmail({ model: 'All Models', client: 'All Clients' })
                                alert('Summary email sent successfully!')
                            } catch (e) { alert('Failed to send email: ' + e.message) }
                        }} className="px-6 py-3 bg-[#0A0A0A] hover:bg-[#151515] border border-[#222] hover:border-gray-700 rounded-xl text-sm font-bold text-white transition-all shadow-lg flex items-center gap-2">
                            <Mail className="w-4 h-4 text-gray-400" />
                            Send Daily Summary
                        </button>
                        <button onClick={async () => {
                            try {
                                await apiService.sendClientEmails({ start_date: new Date().toISOString().split('T')[0] })
                                alert('Client reports queued!')
                            } catch (e) { alert('Failed to send reports: ' + e.message) }
                        }} className="px-6 py-3 bg-[#0A0A0A] hover:bg-[#151515] border border-[#222] hover:border-gray-700 rounded-xl text-sm font-bold text-white transition-all shadow-lg flex items-center gap-2">
                            <Mail className="w-4 h-4 text-gray-400" />
                            Send Client Report
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
