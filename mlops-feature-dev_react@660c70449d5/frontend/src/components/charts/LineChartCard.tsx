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

type LineConfig = {
    key: string
    label: string
    color: string
    strokeWidth?: number
    dash?: string
}

type LineChartCardProps = {
    title: string
    description?: string
    data: Array<Record<string, any>>
    lines: LineConfig[]
    yLabel?: string
}

export default function LineChartCard({ title, description, data, lines, yLabel }: LineChartCardProps) {
    return (
        <div className="card-outline p-5 border border-white/10">
            <div className="flex items-center justify-between mb-4">
                <div>
                    <h3 className="text-lg font-semibold text-white">{title}</h3>
                    {description && <p className="text-sm text-slate-400">{description}</p>}
                </div>
            </div>
            <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={data}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                        <XAxis dataKey="date" tick={{ fill: '#9ca3af', fontSize: 11 }} />
                        <YAxis
                            tick={{ fill: '#9ca3af', fontSize: 11 }}
                            label={
                                yLabel
                                    ? { value: yLabel, angle: -90, position: 'insideLeft', fill: '#9ca3af' }
                                    : undefined
                            }
                        />
                        <Tooltip
                            contentStyle={{
                                background: '#0f1015',
                                border: '1px solid rgba(206, 17, 38, 0.3)',
                                color: '#e5e7eb',
                            }}
                        />
                        <Legend />
                        {lines.map((line) => (
                            <Line
                                key={line.key}
                                type="monotone"
                                dataKey={line.key}
                                name={line.label}
                                stroke={line.color}
                                strokeWidth={line.strokeWidth ?? 2}
                                strokeDasharray={line.dash}
                                dot={{ r: 2 }}
                                activeDot={{ r: 4 }}
                            />
                        ))}
                    </LineChart>
                </ResponsiveContainer>
            </div>
        </div>
    )
}
