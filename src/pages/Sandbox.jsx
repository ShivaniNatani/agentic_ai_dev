import { useState } from 'react'
import { Link } from 'react-router-dom'
import { sandboxConfig } from '../data/sandbox-config'
import SandboxEmbed from '../components/agent/SandboxEmbed'
import './Sandbox.css'

function Sandbox() {
    const [selectedAgentId, setSelectedAgentId] = useState(null)
    const [viewMode, setViewMode] = useState('grid') // 'grid' | 'embed'

    const handleLaunch = (agentId) => {
        setSelectedAgentId(agentId)
        setViewMode('embed')
    }

    const handleClose = () => {
        setSelectedAgentId(null)
        setViewMode('grid')
    }

    const availableAgents = Object.values(sandboxConfig.agents)
    const activeAgent = selectedAgentId ? sandboxConfig.agents[selectedAgentId] : null

    return (
        <div className="sandbox-page">
            <div className="sandbox-bg">
                <div className="sandbox-bg-orb sandbox-bg-orb--1"></div>
                <div className="sandbox-bg-orb sandbox-bg-orb--2"></div>
            </div>

            <div className="container">
                {/* Header */}
                <div className="sandbox-header animate-fade-in-up">
                    <div className="sandbox-header-content">
                        <span className="section-kicker">Developer Hub</span>
                        <h1 className="sandbox-title">Sandbox Environments</h1>
                        <p className="sandbox-subtitle">
                            Touch, test, and break our agents in safe, isolated playground environments.
                            Experiment with different configurations and payloads.
                        </p>
                    </div>
                </div>

                {/* Main Content */}
                {viewMode === 'grid' ? (
                    <div className="sandbox-grid animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
                        {availableAgents.map((agent) => (
                            <div key={agent.id} className="sandbox-card">
                                <div className="sandbox-card-header">
                                    <div className="sandbox-card-icon">⚡</div>
                                    <div className="sandbox-card-badges">
                                        <span className="sandbox-badge">{agent.environment}</span>
                                    </div>
                                </div>
                                <h3 className="sandbox-card-title">{agent.name}</h3>
                                <p className="sandbox-card-desc">{agent.description}</p>

                                <div className="sandbox-features">
                                    {agent.features.map((feature, i) => (
                                        <div key={i} className="sandbox-feature">
                                            <span className="sc-dot"></span>
                                            {feature}
                                        </div>
                                    ))}
                                </div>

                                <button
                                    className="btn btn-primary btn-block"
                                    onClick={() => handleLaunch(agent.id)}
                                >
                                    Launch Sandbox
                                </button>
                            </div>
                        ))}

                        {/* Coming Soon Card */}
                        <div className="sandbox-card sandbox-card--empty">
                            <div className="empty-icon">🚧</div>
                            <h3>More Coming Soon</h3>
                            <p>We are adding new agent playgrounds weekly.</p>
                        </div>
                    </div>
                ) : (
                    <div className="sandbox-active-view animate-zoom-in">
                        <div className="active-sandbox-header">
                            <button className="btn-back" onClick={handleClose}>
                                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M19 12H5M12 19l-7-7 7-7" />
                                </svg>
                                Back to Hub
                            </button>
                            <h2 className="active-sandbox-title">
                                {activeAgent?.name} <span className="text-muted">/ Playground</span>
                            </h2>
                        </div>

                        {activeAgent && (
                            <div className="active-sandbox-wrapper">
                                <SandboxEmbed agent={activeAgent} clientLabel="Test Env" />
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}

export default Sandbox
