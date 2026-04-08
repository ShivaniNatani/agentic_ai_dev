import { useState } from 'react'
import './APIExplorer.css'

function APIExplorer({ agent }) {
    const defaultEndpoint = agent.endpoints ? agent.endpoints[0] : null
    const [selectedEndpoint, setSelectedEndpoint] = useState(defaultEndpoint)
    const [response, setResponse] = useState(null)
    const [isLoading, setIsLoading] = useState(false)
    const [activeTab, setActiveTab] = useState('params') // params, headers, body

    if (!agent.endpoints || agent.endpoints.length === 0) {
        return (
            <div className="api-empty">
                <span className="api-empty-icon">🔌</span>
                <h3>No endpoints defined</h3>
                <p>This agent doesn't have any public API endpoints configured yet.</p>
            </div>
        )
    }

    const handleRun = () => {
        setIsLoading(true)
        setResponse(null)

        // Simulate API call
        setTimeout(() => {
            setIsLoading(false)
            setResponse({
                status: 200,
                statusText: 'OK',
                time: '142ms',
                size: '1.2KB',
                data: {
                    success: true,
                    transaction_id: `txn_${Math.random().toString(36).substr(2, 9)}`,
                    timestamp: new Date().toISOString(),
                    data: {
                        processed: true,
                        confidence_score: 0.98,
                        prediction: "APPROVED",
                        factors: [
                            "Medical necessity criteria met",
                            "Provider in network",
                            "Service code covered"
                        ]
                    }
                }
            })
        }, 1500)
    }

    return (
        <div className="api-explorer">
            <div className="api-sidebar">
                <h3 className="api-sidebar-title">Endpoints</h3>
                <div className="api-endpoint-list">
                    {agent.endpoints.map((ep, index) => (
                        <button
                            key={index}
                            className={`api-endpoint-btn ${selectedEndpoint === ep ? 'api-endpoint-btn--active' : ''}`}
                            onClick={() => {
                                setSelectedEndpoint(ep)
                                setResponse(null)
                            }}
                        >
                            <span className={`api-method api-method--${ep.method.toLowerCase()}`}>
                                {ep.method}
                            </span>
                            <span className="api-path">{ep.path}</span>
                        </button>
                    ))}
                </div>
            </div>

            <div className="api-content">
                <div className="api-header">
                    <div className="api-header-main">
                        <span className={`api-badge-method api-badge-method--${selectedEndpoint.method.toLowerCase()}`}>
                            {selectedEndpoint.method}
                        </span>
                        <h2 className="api-title">{selectedEndpoint.path}</h2>
                    </div>
                    <p className="api-desc">{selectedEndpoint.description}</p>
                </div>

                <div className="api-playground">
                    <div className="api-request">
                        <div className="api-request-header">
                            <div className="api-tabs">
                                <button
                                    className={`api-tab ${activeTab === 'params' ? 'api-tab--active' : ''}`}
                                    onClick={() => setActiveTab('params')}
                                >
                                    Params
                                </button>
                                <button
                                    className={`api-tab ${activeTab === 'headers' ? 'api-tab--active' : ''}`}
                                    onClick={() => setActiveTab('headers')}
                                >
                                    Headers
                                </button>
                                <button
                                    className={`api-tab ${activeTab === 'body' ? 'api-tab--active' : ''}`}
                                    onClick={() => setActiveTab('body')}
                                >
                                    Body
                                </button>
                            </div>
                            <button
                                className="api-run-btn"
                                onClick={handleRun}
                                disabled={isLoading}
                            >
                                {isLoading ? (
                                    <span className="api-spinner"></span>
                                ) : (
                                    <>
                                        <span>Send Request</span>
                                        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                                            <polygon points="5 3 19 12 5 21 5 3" />
                                        </svg>
                                    </>
                                )}
                            </button>
                        </div>

                        <div className="api-request-body">
                            {activeTab === 'body' ? (
                                <div className="api-code-editor">
                                    <pre>{JSON.stringify({
                                        patient_id: "PT-12345",
                                        service_code: "99213",
                                        diagnosis: "J01.90"
                                    }, null, 2)}</pre>
                                </div>
                            ) : (
                                <div className="api-empty-state">
                                    No {activeTab} configuraton needed for this endpoint.
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="api-response">
                        <div className="api-response-header">
                            <span className="api-label">Response</span>
                            {response && (
                                <div className="api-meta">
                                    <span className="api-meta-item api-meta-status">{response.status} {response.statusText}</span>
                                    <span className="api-meta-item">{response.time}</span>
                                    <span className="api-meta-item">{response.size}</span>
                                </div>
                            )}
                        </div>

                        <div className="api-response-body">
                            {isLoading ? (
                                <div className="api-loading-overlay">
                                    <div className="api-pulse-loader"></div>
                                </div>
                            ) : response ? (
                                <div className="api-code-block">
                                    <pre>{JSON.stringify(response.data, null, 2)}</pre>
                                </div>
                            ) : (
                                <div className="api-response-placeholder">
                                    Click "Send Request" to see the response
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default APIExplorer
