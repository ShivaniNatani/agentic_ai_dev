import { useState, useEffect, useRef } from 'react'
import './NeuralTrace.css'

export default function NeuralTrace() {
    const [logs, setLogs] = useState([])
    const [activeNode, setActiveNode] = useState(null)
    const logsEndRef = useRef(null)

    // SIMULATION DATA
    const nodes = [
        { id: 'ingest', x: 100, y: 300, label: 'Ingest (PDF/HL7)' },
        { id: 'ocr', x: 300, y: 150, label: 'OCR Extraction' },
        { id: 'nlp', x: 300, y: 450, label: 'NLP Reasoning' },
        { id: 'policy', x: 500, y: 300, label: 'Policy Check' },
        { id: 'output', x: 700, y: 300, label: 'Final Output' }
    ]

    const edges = [
        { from: 'ingest', to: 'ocr' },
        { from: 'ingest', to: 'nlp' },
        { from: 'ocr', to: 'policy' },
        { from: 'nlp', to: 'policy' },
        { from: 'policy', to: 'output' }
    ]

    // LOGIC SIMULATION LOOP
    useEffect(() => {
        let step = 0
        const steps = [
            { node: 'ingest', msg: 'Receiving Payload: Claim #4921', type: 'info' },
            { node: 'ingest', msg: 'Validating Input Format...', type: 'process' },
            { node: 'ocr', msg: 'Extracting Clinical Entities...', type: 'process' },
            { node: 'nlp', msg: 'Analyzing Medical Necessity...', type: 'process' },
            { node: 'policy', msg: 'Cross-referencing Payer Policy 1.0.4', type: 'info' },
            { node: 'policy', msg: 'Policy Check PASSED (Confidence: 98%)', type: 'success' },
            { node: 'output', msg: 'Generating Response Payload', type: 'process' },
            { node: 'output', msg: 'Transmission Complete.', type: 'success' },
            { node: null, msg: 'Waiting for next request...', type: 'info' } // Idle
        ]

        const interval = setInterval(() => {
            const currentStep = steps[step]

            // Highlight Node
            setActiveNode(currentStep.node)

            // Add Log
            addLog(currentStep.msg, currentStep.type)

            // Advance
            step = (step + 1) % steps.length
        }, 1500) // 1.5s per step

        return () => clearInterval(interval)
    }, [])

    const addLog = (msg, type) => {
        const timestamp = new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })
        setLogs(prev => [...prev.slice(-15), { id: Date.now(), timestamp, msg, type }])
    }

    // Auto-scroll removed to prevent fighting user scroll
    // logsEndRef.current?.scrollIntoView({ behavior: 'smooth' })

    return (
        <div className="neural-trace-container">
            {/* Visual Graph */}
            <div className="neural-graph-area">
                <svg className="neural-svg" viewBox="0 0 800 600">
                    {/* Definitions for Glows */}
                    <defs>
                        <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
                            <feGaussianBlur stdDeviation="4" result="coloredBlur" />
                            <feMerge>
                                <feMergeNode in="coloredBlur" />
                                <feMergeNode in="SourceGraphic" />
                            </feMerge>
                        </filter>
                    </defs>

                    {/* Edges */}
                    {edges.map((edge, i) => {
                        const start = nodes.find(n => n.id === edge.from)
                        const end = nodes.find(n => n.id === edge.to)
                        // Simple logic to activate edge if start node was just active (approximation for demo)
                        const isActive = activeNode === edge.from

                        return (
                            <g key={i}>
                                <line
                                    x1={start.x} y1={start.y}
                                    x2={end.x} y2={end.y}
                                    className={`trace-edge ${isActive ? 'active' : ''}`}
                                />
                                {/* Packet Animation if active */}
                                {isActive && (
                                    <circle r="4" className="trace-packet">
                                        <animateMotion
                                            dur="1s"
                                            repeatCount="1"
                                            path={`M${start.x},${start.y} L${end.x},${end.y}`}
                                        />
                                    </circle>
                                )}
                            </g>
                        )
                    })}

                    {/* Nodes */}
                    {nodes.map(node => (
                        <g
                            key={node.id}
                            className={`trace-node ${activeNode === node.id ? 'active' : ''}`}
                            onClick={() => addLog(`User clicked on: ${node.label}`, 'info')}
                        >
                            <circle cx={node.x} cy={node.y} r="20" />
                            {activeNode === node.id && (
                                <circle cx={node.x} cy={node.y} r="30" stroke="rgba(0, 245, 212, 0.3)" fill="none">
                                    <animate attributeName="r" from="20" to="40" dur="1.5s" repeatCount="indefinite" />
                                    <animate attributeName="opacity" from="1" to="0" dur="1.5s" repeatCount="indefinite" />
                                </circle>
                            )}
                            <text x={node.x} y={node.y + 40}>{node.label}</text>
                        </g>
                    ))}
                </svg>
            </div>

            {/* Live Logs */}
            <div className="neural-logs-panel">
                <div className="neural-logs-header">
                    <h4>Live Reasoning Trace</h4>
                    <span className="live-indicator"><div className="live-dot"></div> LIVE</span>
                </div>
                <div className="logs-feed">
                    {logs.map(log => (
                        <div key={log.id} className={`log-entry type-${log.type}`}>
                            <span className="log-timestamp">[{log.timestamp}]</span>
                            <span className="log-message">{log.msg}</span>
                        </div>
                    ))}
                    <div ref={logsEndRef} />
                </div>
            </div>
        </div>
    )
}
