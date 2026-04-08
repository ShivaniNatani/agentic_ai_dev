import './TurnaroundTime.css'

function TurnaroundTime({ agent }) {
    const metrics = [
        {
            label: 'Average Response Time',
            value: agent.avgResponseTime,
            icon: '⚡',
            color: 'green'
        },
        {
            label: 'P95 Latency',
            value: agent.p95Latency,
            icon: '📊',
            color: 'blue'
        },
        {
            label: 'Throughput',
            value: agent.throughput,
            icon: '🚀',
            color: 'purple'
        },
        {
            label: 'Uptime SLA',
            value: agent.sla,
            icon: '🛡️',
            color: 'red'
        }
    ]

    return (
        <div className="turnaround">
            <div className="turnaround__metrics">
                {metrics.map((metric, index) => (
                    <div
                        key={index}
                        className={`turnaround__metric turnaround__metric--${metric.color}`}
                    >
                        <span className="turnaround__metric-icon">{metric.icon}</span>
                        <div className="turnaround__metric-content">
                            <span className="turnaround__metric-label">{metric.label}</span>
                            <span className="turnaround__metric-value">{metric.value}</span>
                        </div>
                    </div>
                ))}
            </div>

            <div className="turnaround__details glass-card">
                <h3 className="turnaround__heading">Performance Details</h3>

                <div className="turnaround__chart">
                    <div className="turnaround__bar-group">
                        <span className="turnaround__bar-label">Response Time Distribution</span>
                        <div className="turnaround__bar-container">
                            <div className="turnaround__bar turnaround__bar--p50" style={{ width: '40%' }}>
                                <span>P50: 0.8s</span>
                            </div>
                            <div className="turnaround__bar turnaround__bar--p90" style={{ width: '70%' }}>
                                <span>P90: 2.1s</span>
                            </div>
                            <div className="turnaround__bar turnaround__bar--p99" style={{ width: '90%' }}>
                                <span>P99: 4.5s</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="turnaround__info-grid">
                    <div className="turnaround__info-item">
                        <h4>Processing Pipeline</h4>
                        <ul>
                            <li>Request validation: ~50ms</li>
                            <li>AI model inference: ~800ms</li>
                            <li>Payer API call: ~500ms</li>
                            <li>Response formatting: ~30ms</li>
                        </ul>
                    </div>

                    <div className="turnaround__info-item">
                        <h4>Rate Limits</h4>
                        <ul>
                            <li>Standard tier: 100 req/min</li>
                            <li>Professional: 1,000 req/min</li>
                            <li>Enterprise: 10,000 req/min</li>
                            <li>Burst capacity: 2x for 30s</li>
                        </ul>
                    </div>

                    <div className="turnaround__info-item">
                        <h4>Availability Zones</h4>
                        <ul>
                            <li>US East (Virginia)</li>
                            <li>US West (Oregon)</li>
                            <li>EU West (Frankfurt)</li>
                            <li>Automatic failover enabled</li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default TurnaroundTime
