import { useState, useEffect, useRef } from 'react'
import './PredictiveMonitor.css'

export default function PredictiveMonitor() {
    const [dataPoints, setDataPoints] = useState([])
    const [status, setStatus] = useState('healthy') // healthy, warning
    const [prediction, setPrediction] = useState('Stable')
    const maxPoints = 50
    const canvasRef = useRef(null)

    // SIMULATED DATA STREAM
    useEffect(() => {
        // Initialize
        const initial = Array(maxPoints).fill(50)
        setDataPoints(initial)

        const interval = setInterval(() => {
            setDataPoints(prev => {
                const last = prev[prev.length - 1]
                // Random fluctuation
                let change = (Math.random() - 0.5) * 10

                // Occasional Spike Simulation
                if (Math.random() > 0.95) change += 30
                if (Math.random() > 0.95) change -= 30

                let next = Math.max(10, Math.min(90, last + change))

                // Update Status based on threshold
                if (next > 80 || next < 20) {
                    setStatus('warning')
                    setPrediction('Anomaly Detected')
                } else {
                    setStatus('healthy')
                    setPrediction('Stable')
                }

                return [...prev.slice(1), next]
            })
        }, 100) // 100ms update

        return () => clearInterval(interval)
    }, [])

    // Generate Path for SVG
    const getPath = () => {
        if (dataPoints.length === 0) return ''
        const width = 100 // percent
        const step = width / (maxPoints - 1)

        // Map points to SVG coordinates (0-100 viewbox)
        const points = dataPoints.map((val, i) => {
            const x = i * step
            const y = 100 - val // Invert Y
            return `${x},${y}`
        })

        return `M ${points.join(' L ')}`
    }

    return (
        <div className="predictive-monitor-container">
            <div className="monitor-header">
                <div className="monitor-title">
                    <span style={{ fontSize: '1.2rem' }}>🔮</span>
                    Predictive Health Monitor
                </div>
                <div className={`monitor-status status-${status}`}>
                    {prediction}
                </div>
            </div>

            <div className="monitor-chart-area">
                <svg className="ekg-svg" viewBox="0 0 100 100" preserveAspectRatio="none">
                    {/* Grid */}
                    <line x1="0" y1="20" x2="100" y2="20" className="grid-line" />
                    <line x1="0" y1="50" x2="100" y2="50" className="grid-line" />
                    <line x1="0" y1="80" x2="100" y2="80" className="grid-line" />

                    {/* Data Line */}
                    <path
                        d={getPath()}
                        className={`ekg-line ${status}`}
                        vectorEffect="non-scaling-stroke"
                    />
                </svg>
            </div>

            <div className="monitor-stats">
                <div className="stat-item">
                    <span className="stat-label">Confidence</span>
                    <span className="stat-value">99.2%</span>
                </div>
                <div className="stat-item">
                    <span className="stat-label">Latency Forecast</span>
                    <span className="stat-value">~45ms</span>
                </div>
                <div className="stat-item">
                    <span className="stat-label">Next Anomaly</span>
                    <span className="stat-value">&gt; 24h</span>
                </div>
            </div>
        </div>
    )
}
