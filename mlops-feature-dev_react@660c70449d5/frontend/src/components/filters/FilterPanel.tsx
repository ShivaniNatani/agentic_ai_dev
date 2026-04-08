import { format, subDays } from 'date-fns'
import { RefreshCw } from 'lucide-react'
import { useDashboardContext } from '../../context/DashboardContext'
import { useState } from 'react'

type FilterPanelProps = {
    rangeOptions: string[]
    availableMetrics: string[]
    showMetrics?: boolean
    showAdvanced?: boolean
}

const toIsoDate = (value?: string) => {
    if (!value) return ''
    return value.split('T')[0]
}

export default function FilterPanel({ rangeOptions, availableMetrics, showMetrics, showAdvanced }: FilterPanelProps) {
    const { filters, setFilters, options, refreshData } = useDashboardContext()
    const [advancedOpen, setAdvancedOpen] = useState(false)

    const handleQuickRange = (value: string) => {
        if (value === 'All') {
            setFilters({ quickRange: value })
            return
        }
        const days = value === '7d' ? 7 : 30
        const end = new Date()
        const start = subDays(end, days)
        setFilters({
            quickRange: value,
            startDate: format(start, 'yyyy-MM-dd'),
            endDate: format(end, 'yyyy-MM-dd'),
        })
    }

    return (
        <div className="card-outline p-5 space-y-4">
            <div className="grid gap-4 md:grid-cols-12 items-end">
                <div className="md:col-span-3">
                    <label className="text-xs uppercase tracking-[0.2em] text-slate-400">Model</label>
                    <select
                        className="input mt-1"
                        value={filters.model}
                        onChange={(e) =>
                            setFilters({
                                model: e.target.value,
                                client: 'All Clients',
                                metrics: [],
                            })
                        }
                    >
                        {options.models.map((model) => (
                            <option key={model} value={model}>
                                {model}
                            </option>
                        ))}
                    </select>
                </div>
                <div className="md:col-span-3">
                    <label className="text-xs uppercase tracking-[0.2em] text-slate-400">Client</label>
                    <select
                        className="input mt-1"
                        value={filters.client}
                        onChange={(e) => setFilters({ client: e.target.value })}
                    >
                        <option value="All Clients">All Clients</option>
                        {options.clients.map((client) => (
                            <option key={client} value={client}>
                                {client}
                            </option>
                        ))}
                    </select>
                </div>
                <div className="md:col-span-2">
                    <label className="text-xs uppercase tracking-[0.2em] text-slate-400">Version</label>
                    <select
                        className="input mt-1"
                        value={filters.version}
                        onChange={(e) => setFilters({ version: e.target.value })}
                    >
                        <option value="All Versions">All Versions</option>
                        {options.versions.map((version) => (
                            <option key={version} value={version}>
                                {version}
                            </option>
                        ))}
                    </select>
                </div>
                <div className="md:col-span-2">
                    <label className="text-xs uppercase tracking-[0.2em] text-slate-400">Start</label>
                    <input
                        type="date"
                        className="input mt-1"
                        value={toIsoDate(filters.startDate)}
                        onChange={(e) => setFilters({ startDate: e.target.value })}
                    />
                </div>
                <div className="md:col-span-2">
                    <label className="text-xs uppercase tracking-[0.2em] text-slate-400">End</label>
                    <input
                        type="date"
                        className="input mt-1"
                        value={toIsoDate(filters.endDate)}
                        onChange={(e) => setFilters({ endDate: e.target.value })}
                    />
                </div>
                <div className="md:col-span-12 flex flex-wrap gap-2 items-center justify-between">
                    <div className="flex gap-2">
                        {['7d', '30d', 'All'].map((option) => (
                            <button
                                key={option}
                                type="button"
                                onClick={() => handleQuickRange(option)}
                                className={`px-3 py-2 rounded-full text-xs border ${
                                    filters.quickRange === option
                                        ? 'border-primary-500 text-white bg-primary-500/20'
                                        : 'border-white/10 text-slate-400 bg-dark-850'
                                }`}
                            >
                                {option}
                            </button>
                        ))}
                    </div>
                    <div className="flex gap-2">
                        {showAdvanced && (
                            <button
                                type="button"
                                onClick={() => setAdvancedOpen((v) => !v)}
                                className="px-3 py-2 rounded-lg border border-white/10 text-sm text-slate-200 bg-dark-850"
                            >
                                {advancedOpen ? 'Hide advanced' : 'Show advanced'}
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={() => refreshData()}
                            className="btn-primary flex items-center gap-2"
                        >
                            <RefreshCw className="w-4 h-4" />
                            Refresh
                        </button>
                    </div>
                </div>
            </div>

            {showAdvanced && advancedOpen && (
                <div className="grid gap-4 md:grid-cols-4">
                    <div>
                        <label className="text-xs uppercase tracking-[0.2em] text-slate-400">Threshold Range</label>
                        <select
                            multiple
                            className="input mt-1 h-24"
                            value={filters.ranges}
                            onChange={(e) =>
                                setFilters({
                                    ranges: Array.from(e.target.selectedOptions).map((opt) => opt.value),
                                })
                            }
                        >
                            {rangeOptions.map((range) => (
                                <option key={range} value={range}>
                                    {range}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="text-xs uppercase tracking-[0.2em] text-slate-400">Threshold Mode</label>
                        <select
                            className="input mt-1"
                            value={filters.thresholdMode}
                            onChange={(e) => setFilters({ thresholdMode: e.target.value })}
                        >
                            <option value="All data">All data</option>
                            <option value="Above threshold">Above threshold</option>
                            <option value="Below threshold">Below threshold</option>
                        </select>
                    </div>
                    <div>
                        <label className="text-xs uppercase tracking-[0.2em] text-slate-400">Trend Window</label>
                        <input
                            type="range"
                            min={1}
                            max={10}
                            value={filters.trendWindow}
                            onChange={(e) => setFilters({ trendWindow: Number(e.target.value) })}
                            className="w-full mt-4"
                        />
                        <div className="text-xs text-slate-400 mt-2">{filters.trendWindow} refreshes</div>
                    </div>
                    {showMetrics && (
                        <div>
                            <label className="text-xs uppercase tracking-[0.2em] text-slate-400">Additional Metrics</label>
                            <select
                                multiple
                                className="input mt-1 h-24"
                                value={filters.metrics}
                                onChange={(e) =>
                                    setFilters({
                                        metrics: Array.from(e.target.selectedOptions).map((opt) => opt.value),
                                    })
                                }
                            >
                                {availableMetrics.map((metric) => (
                                    <option key={metric} value={metric}>
                                        {metric.replace(/_/g, ' ')}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
