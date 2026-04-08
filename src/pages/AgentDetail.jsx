import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { agents } from '../data/agents'
import { releases } from '../data/releases'
import SandboxEmbed from '../components/agent/SandboxEmbed'
import APIExplorer from '../components/agent/APIExplorer'
import NeuralTrace from '../components/NeuralTrace/NeuralTrace'
import './AgentDetail.css'
import './ReleaseNotes.css'

function AgentDetail() {
    const { agentId } = useParams()
    const [selectedProject, setSelectedProject] = useState(null)
    const [activeTab, setActiveTab] = useState('model-card')
    const [agent, setAgent] = useState(null)
    const [loading, setLoading] = useState(true)

    // Scroll to top on mount
    useEffect(() => {
        window.scrollTo(0, 0)
    }, [agentId])

    useEffect(() => {
        setLoading(true)
        setSelectedProject(null) // Reset selection on agent change
        setTimeout(() => {
            const foundAgent = agents.find((a) => a.id === agentId) || agents[0]
            setAgent(foundAgent)
            setLoading(false)
        }, 500)
    }, [agentId])

    if (loading) {
        return (
            <div className="agent-loading">
                <div className="agent-loading-spinner"></div>
            </div>
        )
    }

    if (!agent) return <div className="agent-not-found">Agent not found</div>

    return (
        <div className="agent-detail-page">
            <div className="agent-bg-orb orb-1"></div>
            <div className="agent-bg-orb orb-2"></div>

            <div className="container">
                {/* Header */}
                <div className="agent-header animate-fade-in-up">
                    <div className="header-top-row">
                        <Link to="/agents" className="back-link">
                            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M19 12H5M12 19l-7-7 7-7" />
                            </svg>
                            All Agents
                        </Link>
                        {selectedProject && (
                            <button onClick={() => setSelectedProject(null)} className="back-link" style={{ marginLeft: '1rem' }}>
                                <span style={{ marginRight: '4px' }}>←</span> Back to Projects
                            </button>
                        )}
                        <div className="header-actions">
                            <span className={`status-badge status-${agent.status}`}>{agent.status}</span>
                            <button className="btn btn-primary">Deploy Agent</button>
                        </div>
                    </div>

                    <div className="agent-identity">
                        <div className="agent-icon-box">{agent.icon}</div>
                        <div className="agent-title-block">
                            <h1 className="agent-name">
                                {selectedProject ? selectedProject.name : agent.name}
                            </h1>
                            <p className="agent-short-desc">
                                {selectedProject ? `Project Client: ${selectedProject.client} • Status: ${selectedProject.status}` : agent.shortDesc}
                            </p>
                        </div>
                    </div>
                </div>

                {/* VIEW 1: PROJECT SELECTION (Default) */}
                {!selectedProject && (
                    <div className="projects-selection-view animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
                        <div className="section-title-row">
                            <h2>Select a Project</h2>
                            <p className="text-muted">Choose a project to view its model card, API docs, and performance.</p>
                        </div>

                        <div className="projects-grid mt-6">
                            {agent.projects?.map((proj, i) => (
                                <div
                                    key={i}
                                    className="detail-card project-card-hover"
                                    onClick={() => setSelectedProject(proj)}
                                    role="button"
                                    tabIndex={0}
                                >
                                    <div className="project-card-header">
                                        <h4>{proj.name}</h4>
                                        <span className={`badge-sm status-${proj.status}`}>{proj.status}</span>
                                    </div>
                                    <div className="project-meta">
                                        <p className="text-muted">Client: <strong className="text-white">{proj.client}</strong></p>
                                        <p className="text-muted text-sm mt-2">{proj.date === 'Live' ? '🟢 Live' : `🗓 Date: ${proj.date}`}</p>
                                    </div>
                                    <div className="project-arrow-hover">View Details →</div>
                                </div>
                            ))}
                            {(!agent.projects || agent.projects.length === 0) && (
                                <div className="empty-state">
                                    <p>No active projects linked to this agent.</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* VIEW 2: PROJECT DETAILS (Tabs) */}
                {selectedProject && (
                    <>
                        <div className="agent-tabs-wrapper animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
                            <div className="agent-tabs">
                                <button
                                    className={`tab-btn ${activeTab === 'model-card' ? 'active' : ''}`}
                                    onClick={() => setActiveTab('model-card')}
                                >
                                    <span className="tab-icon">📋</span> Model Card
                                </button>
                                <button
                                    className={`tab-btn ${activeTab === 'api-docs' ? 'active' : ''}`}
                                    onClick={() => setActiveTab('api-docs')}
                                >
                                    <span className="tab-icon">🔌</span> API Docs
                                </button>
                                <button
                                    className={`tab-btn ${activeTab === 'payloads' ? 'active' : ''}`}
                                    onClick={() => setActiveTab('payloads')}
                                >
                                    <span className="tab-icon">📦</span> Payloads
                                </button>
                                <button
                                    className={`tab-btn ${activeTab === 'performance' ? 'active' : ''}`}
                                    onClick={() => setActiveTab('performance')}
                                >
                                    <span className="tab-icon">⚡</span> Performance
                                </button>
                                <button
                                    className={`tab-btn ${activeTab === 'neural-trace' ? 'active' : ''}`}
                                    onClick={() => setActiveTab('neural-trace')}
                                >
                                    <span className="tab-icon">🧠</span> Neural Trace
                                </button>
                                <button
                                    className={`tab-btn ${activeTab === 'demo' ? 'active' : ''}`}
                                    onClick={() => setActiveTab('demo')}
                                >
                                    <span className="tab-icon">🎬</span> Demo
                                </button>
                                <button
                                    className={`tab-btn ${activeTab === 'releases' ? 'active' : ''}`}
                                    onClick={() => setActiveTab('releases')}
                                >
                                    <span className="tab-icon">🚀</span> Release Notes
                                </button>
                            </div>
                        </div>

                        {/* Tab Content */}
                        <div className="agent-content-area animate-fade-in-up" style={{ animationDelay: '0.2s' }}>

                            {/* --- MODEL CARD --- */}
                            {activeTab === 'model-card' && (
                                <div className="tab-pane model-card-pane">
                                    <div className="card-grid">
                                        <div className="detail-card info-card">
                                            <h3>ℹ️ System Information</h3>
                                            <div className="info-row">
                                                <span className="label">Version</span>
                                                <span className="value">v{agent.version}</span>
                                            </div>
                                            <div className="info-row">
                                                <span className="label">Architecture</span>
                                                <span className="value">{agent.modelInfo?.architecture}</span>
                                            </div>
                                            <div className="info-row">
                                                <span className="label">Context Window</span>
                                                <span className="value">{agent.modelInfo?.contextWindow}</span>
                                            </div>
                                            <div className="info-row">
                                                <span className="label">Last Training</span>
                                                <span className="value">{agent.modelInfo?.lastRetrained}</span>
                                            </div>
                                        </div>

                                        <div className="detail-card payers-card">
                                            <h3>🏥 Supported Payers</h3>
                                            <div className="payers-table-wrapper">
                                                <table className="payers-table">
                                                    <thead>
                                                        <tr>
                                                            <th>Payer Name</th>
                                                            <th>Method</th>
                                                            <th>Success Rate</th>
                                                            <th>Status</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {agent.payers?.map((payer, idx) => (
                                                            <tr key={idx}>
                                                                <td>{payer.name}</td>
                                                                <td>{payer.method}</td>
                                                                <td className="text-success">{payer.successRate}</td>
                                                                <td>
                                                                    <span className="badge-sm badge-live">{payer.status}</span>
                                                                </td>
                                                            </tr>
                                                        ))}
                                                        {(!agent.payers || agent.payers.length === 0) && (
                                                            <tr>
                                                                <td colSpan="4" className="text-center text-muted">No specific payer configs listed.</td>
                                                            </tr>
                                                        )}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="detail-card description-card">
                                        <h3>Project & Agent Scope</h3>
                                        <p>{agent.fullDesc}</p>
                                    </div>
                                </div>
                            )}

                            {/* --- API DOCS --- */}
                            {activeTab === 'api-docs' && (
                                <div className="tab-pane">
                                    <APIExplorer agent={agent} />
                                </div>
                            )}

                            {/* --- PAYLOADS --- */}
                            {activeTab === 'payloads' && (
                                <div className="tab-pane payloads-pane">
                                    <div className="payload-grid">
                                        <div className="detail-card">
                                            <h3>⬇️ Sample Request</h3>
                                            <div className="code-block">
                                                <pre>{JSON.stringify(agent.payloads?.request || {}, null, 2)}</pre>
                                            </div>
                                        </div>
                                        <div className="detail-card">
                                            <h3>⬆️ Sample Response</h3>
                                            <div className="code-block">
                                                <pre>{JSON.stringify(agent.payloads?.response || {}, null, 2)}</pre>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* --- PERFORMANCE --- */}
                            {activeTab === 'performance' && (
                                <div className="tab-pane performance-pane">
                                    <div className="detail-card chart-card">
                                        <h3>📊 Performance Metrics (Last 7 Days)</h3>
                                        <div className="mock-chart-container">
                                            <div className="css-chart">
                                                {agent.performance?.map((p, i) => (
                                                    <div key={i} className="chart-col">
                                                        <div
                                                            className="chart-bar"
                                                            style={{ height: `${(p.latency / 500) * 100}%` }}
                                                            title={`Latency: ${p.latency}ms`}
                                                        ></div>
                                                        <span className="chart-label">{p.date}</span>
                                                    </div>
                                                ))}
                                                {(!agent.performance || agent.performance.length === 0) && (
                                                    <p className="text-muted">No performance data available.</p>
                                                )}
                                            </div>
                                            <div className="chart-legend">
                                                <span className="legend-item"><span className="dot"></span> Avg Latency (ms)</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* --- DEMO --- */}
                            {activeTab === 'neural-trace' && (
                                <div className="tab-pane animate-fade-in-up">
                                    <h3 className="mb-4">Live Logic Graph</h3>
                                    <p className="text-muted mb-6">Real-time visualization of the agent's reasoning process, policy checks, and decision pathways.</p>
                                    <NeuralTrace />
                                </div>
                            )}

                            {activeTab === 'demo' && (
                                <div className="tab-pane demo-pane">
                                    <div className="detail-card video-card">
                                        <h3>🎥 Agent Walkthrough</h3>
                                        {agent.demoVideoUrl ? (
                                            <div className="video-wrapper">
                                                <video
                                                    controls
                                                    className="agent-video"
                                                    src={agent.demoVideoUrl}
                                                    poster="/artifacts/agentic_ai/video_poster.jpg"
                                                >
                                                    Your browser does not support the video tag.
                                                </video>
                                            </div>
                                        ) : (
                                            <div className="video-placeholder">
                                                <div className="play-button">▶</div>
                                                <p>No Demo Video Available</p>
                                            </div>
                                        )}
                                    </div>

                                    <div className="sandbox-section mt-6">
                                        <h3>🕹️ Interactive Sandbox</h3>
                                        <SandboxEmbed agent={agent} />
                                    </div>
                                </div>
                            )}

                            {/* --- RELEASE NOTES --- */}
                            {activeTab === 'releases' && (
                                <div className="tab-pane releases-pane">
                                    <div className="releases-timeline" style={{ margin: '0', padding: '0', maxWidth: '100%' }}>
                                        {releases.filter(r => r.projectId === selectedProject.id).map((release, index) => (
                                            <div key={index} className="timeline-item animate-fade-in-up" style={{ animationDelay: `${index * 0.1}s` }}>
                                                {/* Left: Date & Version */}
                                                <div className="timeline-left">
                                                    <span className="timeline-date">{release.date}</span>
                                                    <span className={`timeline-version-badge type-${release.type}`}>v{release.version}</span>
                                                </div>

                                                {/* Center: Line */}
                                                <div className="timeline-divider">
                                                    <div className={`timeline-dot type-${release.type}`}></div>
                                                    <div className="timeline-line"></div>
                                                </div>

                                                {/* Right: Card */}
                                                <div className="timeline-content">
                                                    <div className="release-card feed-card">
                                                        <div className="release-card-header">
                                                            <div className="agent-identity">
                                                                <div className="agent-icon">{release.icon}</div>
                                                                <div>
                                                                    <div className="agent-name">{release.title}</div>
                                                                    <div className="owner-text">Owner: {release.owner}</div>
                                                                </div>
                                                            </div>
                                                            <span className="release-status-live">Live</span>
                                                        </div>

                                                        <p className="release-desc-text">{release.description}</p>

                                                        {/* Highlights */}
                                                        {release.highlights && release.highlights.length > 0 && (
                                                            <div className="release-highlights mt-4">
                                                                <span className="release-card-desc-title">✨ What's New</span>
                                                                <ul className="release-features-list">
                                                                    {release.highlights.map((h, i) => (
                                                                        <li key={i}>{h}</li>
                                                                    ))}
                                                                </ul>
                                                            </div>
                                                        )}

                                                        {/* Fixes */}
                                                        {release.fixes && release.fixes.length > 0 && (
                                                            <div className="release-fixes mt-4">
                                                                <span className="release-card-desc-title">🐛 Fixes</span>
                                                                <ul className="release-features-list">
                                                                    {release.fixes.map((f, i) => (
                                                                        <li key={i}>{f}</li>
                                                                    ))}
                                                                </ul>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}

                                        {releases.filter(r => r.projectId === selectedProject.id).length === 0 && (
                                            <div className="empty-state">
                                                <div style={{ textAlign: 'center', padding: '40px', color: '#888' }}>
                                                    <span style={{ fontSize: '24px', display: 'block', marginBottom: '10px' }}>📭</span>
                                                    <p>No release notes found for this project yet.</p>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                        </div>
                    </>
                )}
            </div>
        </div>
    )
}

export default AgentDetail
