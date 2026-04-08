import { useState, useEffect } from 'react'
import './SandboxEmbed.css'

function SandboxEmbed({ agent, clientLabel }) {
    const [isLoading, setIsLoading] = useState(true)
    const [isFullscreen, setIsFullscreen] = useState(false)
    const [key, setKey] = useState(0) // Used to force reload iframe

    const sandboxUrl = agent.sandboxUrl || `https://stackblitz.com/edit/react-ts-iks-demo?embed=1&file=App.tsx&hideExplorer=1&hideNavigation=1&view=preview`

    const handleRefresh = () => {
        setIsLoading(true)
        setKey(prev => prev + 1)
    }

    const toggleFullscreen = () => {
        setIsFullscreen(!isFullscreen)
    }

    // Default loading time simulation for smoother UX
    useEffect(() => {
        if (isLoading) {
            const timer = setTimeout(() => setIsLoading(false), 2000)
            return () => clearTimeout(timer)
        }
    }, [isLoading, key])

    return (
        <div className={`sandbox-embed ${isFullscreen ? 'sandbox-embed--fullscreen' : ''}`}>
            <div className="RO-sandbox-header">
                <div className="sandbox-header-left">
                    <span className="sandbox-status-dot"></span>
                    <span className="sandbox-title">Live Demo Environment</span>
                    {clientLabel && <span className="sandbox-client-badge">{clientLabel} Configuration</span>}
                </div>
                <div className="sandbox-header-actions">
                    <button
                        className="sandbox-action-btn"
                        onClick={handleRefresh}
                        title="Restart Sandbox"
                    >
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M23 4v6h-6" />
                            <path d="M1 20v-6h6" />
                            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                        </svg>
                    </button>
                    <button
                        className="sandbox-action-btn"
                        onClick={toggleFullscreen}
                        title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
                    >
                        {isFullscreen ? (
                            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3" />
                            </svg>
                        ) : (
                            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
                            </svg>
                        )}
                    </button>
                </div>
            </div>

            <div className="sandbox-viewport">
                {isLoading && (
                    <div className="sandbox-loader">
                        <div className="sandbox-spinner"></div>
                        <p>Initializing secure environment...</p>
                    </div>
                )}

                <iframe
                    key={key}
                    src={sandboxUrl}
                    title={`${agent.name} Sandbox`}
                    className="sandbox-iframe"
                    allow="accelerometer; ambient-light-sensor; camera; encrypted-media; geolocation; gyroscope; hid; microphone; midi; payment; usb; vr; xr-spatial-tracking"
                    sandbox="allow-forms allow-modals allow-popups allow-presentation allow-same-origin allow-scripts"
                    onLoad={() => setIsLoading(false)}
                />

                <div className="sandbox-overlay-gradient"></div>
            </div>

            <div className="sandbox-footer">
                <div className="sandbox-stats">
                    <div className="sandbox-stat">
                        <span className="sandbox-stat-label">Latency</span>
                        <span className="sandbox-stat-value">42ms</span>
                    </div>
                    <div className="sandbox-stat">
                        <span className="sandbox-stat-label">Memory</span>
                        <span className="sandbox-stat-value">128MB</span>
                    </div>
                </div>
                <div className="sandbox-console-trigger">
                    <span>View Logs</span>
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="6 9 12 15 18 9" />
                    </svg>
                </div>
            </div>
        </div>
    )
}

export default SandboxEmbed
