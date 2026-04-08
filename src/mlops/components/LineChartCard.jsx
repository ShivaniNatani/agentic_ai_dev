import React from 'react'
import {
    CartesianGrid,
    Line,
    LineChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
    Legend,
} from 'recharts'
import { Zap, BarChart3 } from 'lucide-react'

export default function LineChartCard({ title, description, data, lines, yLabel, hideLegend = false }) {
    // Debug: Log data to console
    console.log('LineChartCard:', { title, dataLength: data?.length, lineKeys: lines?.map(l => l.key), sampleData: data?.[0] })

    if (!data || data.length === 0) {
        return (
            <div className="card-outline p-5 border border-white/10">
                {title && (
                    <div className="mb-4">
                        <h3 className="text-lg font-semibold text-white">{title}</h3>
                        {description && <p className="text-sm text-slate-400">{description}</p>}
                    </div>
                )}
                <div style={{ height: '288px' }} className="flex flex-col items-center justify-center text-slate-500">
                    <Zap className="w-8 h-8 mb-2 opacity-50" />
                    <p>No telemetry data available</p>
                </div>
            </div>
        )
    }

    // Filter out lines whose keys don't exist in the data
    const validLines = lines.filter(line => {
        const hasKey = data.some(d => d[line.key] !== undefined && d[line.key] !== null)
        return hasKey
    })

    // If no valid lines, show message with available keys
    if (validLines.length === 0) {
        const availableKeys = data[0] ? Object.keys(data[0]).filter(k => k !== 'date') : []
        return (
            <div className="card-outline p-5 border border-white/10">
                {title && (
                    <div className="mb-4">
                        <h3 className="text-lg font-semibold text-white">{title}</h3>
                        {description && <p className="text-sm text-slate-400">{description}</p>}
                    </div>
                )}
                <div style={{ height: '288px' }} className="flex flex-col items-center justify-center text-slate-500">
                    <BarChart3 className="w-8 h-8 mb-2 opacity-50" />
                    <p>No matching series keys</p>
                    <p className="text-xs mt-2">Available: {availableKeys.join(', ')}</p>
                </div>
            </div>
        )
    }

    return (
        <div className="card-outline p-5 border border-white/10">
            {!hideLegend && title && (
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h3 className="text-lg font-semibold text-white">{title}</h3>
                        {description && <p className="text-sm text-slate-400">{description}</p>}
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {validLines.slice(0, 5).map((line) => (
                            <div key={line.key} className="flex items-center gap-1.5 px-2 py-1 bg-slate-800/50 rounded text-xs">
                                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: line.color }}></div>
                                <span className="text-slate-300">{line.label}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
            {/* Chart container with explicit height using style attribute */}
            <div style={{ width: '100%', height: '288px', minHeight: '288px' }}>
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                        <XAxis
                            dataKey="date"
                            tick={{ fill: '#9ca3af', fontSize: 11 }}
                            tickLine={false}
                            axisLine={{ stroke: '#333' }}
                        />
                        <YAxis
                            tick={{ fill: '#9ca3af', fontSize: 11 }}
                            tickLine={false}
                            axisLine={{ stroke: '#333' }}
                            label={
                                yLabel
                                    ? { value: yLabel, angle: -90, position: 'insideLeft', fill: '#9ca3af', fontSize: 11 }
                                    : undefined
                            }
                        />
                        <Tooltip
                            contentStyle={{
                                background: '#0f1015',
                                border: '1px solid rgba(6, 182, 212, 0.3)',
                                borderRadius: '8px',
                                color: '#e5e7eb',
                            }}
                            labelStyle={{ color: '#9ca3af', marginBottom: '4px' }}
                        />
                        {!hideLegend && <Legend />}
                        {validLines.map((line) => (
                            <Line
                                key={line.key}
                                type="monotone"
                                dataKey={line.key}
                                name={line.label}
                                stroke={line.color}
                                strokeWidth={line.strokeWidth ?? 2}
                                strokeDasharray={line.dash}
                                dot={{ r: 3, fill: line.color }}
                                activeDot={{ r: 5, strokeWidth: 0 }}
                                animationDuration={1000}
                                connectNulls
                            />
                        ))}
                    </LineChart>
                </ResponsiveContainer>
            </div>
        </div>
    )
}
