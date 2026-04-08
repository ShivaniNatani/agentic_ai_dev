import React from 'react'
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts'

export default function LineChartCard({ title, description, data, lines, yLabel }) {
    return (
        <div className="relative p-6 rounded-xl bg-dark-800/50 border border-white/10 backdrop-blur-md shadow-lg">
            <div className="mb-6">
                <h3 className="text-lg font-bold text-white mb-1">{title}</h3>
                <p className="text-sm text-slate-400">{description}</p>
            </div>

            <div style={{ height: 300, width: '100%' }}>
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                        <XAxis
                            dataKey="date"
                            stroke="#94a3b8"
                            fontSize={12}
                            tickLine={false}
                            axisLine={false}
                        />
                        <YAxis
                            stroke="#94a3b8"
                            fontSize={12}
                            tickLine={false}
                            axisLine={false}
                            label={{ value: yLabel, angle: -90, position: 'insideLeft', style: { fill: '#94a3b8' } }}
                        />
                        <Tooltip
                            contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '8px' }}
                            itemStyle={{ color: '#e2e8f0' }}
                        />
                        <Legend />
                        {lines.map((line) => (
                            <Line
                                key={line.key}
                                type="monotone"
                                dataKey={line.key}
                                stroke={line.color}
                                strokeWidth={2}
                                dot={{ r: 3, fill: line.color }}
                                activeDot={{ r: 6 }}
                                strokeDasharray={line.dash}
                                name={line.label}
                            />
                        ))}
                    </LineChart>
                </ResponsiveContainer>
            </div>
        </div>
    )
}
