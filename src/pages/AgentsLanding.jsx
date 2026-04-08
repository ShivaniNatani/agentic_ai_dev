import { useState } from 'react'
import { Link } from 'react-router-dom'
import { agents } from '../data/agents'
import './AgentsLanding.css'

// Projects data for all agents
const allProjects = [
    {
        id: 1,
        agentId: 'browser-agent-pa',
        agentName: 'Browser Agent PA',
        agentIcon: '💻',
        name: 'Aetna Integration Expansion',
        description: 'Expanding prior auth coverage to include all Aetna commercial plans.',
        status: 'active',
        statusLabel: 'In Progress',
        priority: 'high',
        progress: 72,
        lastUpdated: 'Jan 5, 2024',
        team: ['AC', 'MS', 'JW'],
    },
    {
        id: 2,
        agentId: 'browser-agent-pa',
        agentName: 'Browser Agent PA',
        agentIcon: '💻', // Fixed icon
        name: 'Provider Network Expansion',
        description: 'Adding 10,000+ new specialists to the referral network.',
        status: 'active',
        statusLabel: 'In Progress',
        priority: 'high',
        progress: 55,
        lastUpdated: 'Jan 5, 2024',
        team: ['LP', 'TH', 'JW'],
    },
    {
        id: 3,
        agentId: 'writeback',
        agentName: 'Writeback',
        agentIcon: '📝',
        name: 'Athenahealth Integration',
        description: 'Full bidirectional sync support for Athenahealth EHR.',
        status: 'active',
        statusLabel: 'In Progress',
        priority: 'high',
        progress: 68,
        lastUpdated: 'Jan 6, 2024',
        team: ['CM', 'RG'],
    },
    {
        id: 4,
        agentId: 'browser-agent-pa',
        agentName: 'Browser Agent PA',
        agentIcon: '💻',
        name: 'FHIR R4 Compliance Update',
        description: 'Upgrading all endpoints to meet FHIR R4 specification.',
        status: 'review',
        statusLabel: 'In Review',
        priority: 'low',
        progress: 90,
        lastUpdated: 'Jan 6, 2024',
        team: ['SK', 'DL'],
    },
    {
        id: 5,
        agentId: 'writeback',
        agentName: 'Writeback',
        agentIcon: '📝',
        name: 'Real-time Audit Dashboard',
        description: 'Building real-time monitoring dashboard for all writeback ops.',
        status: 'review',
        statusLabel: 'In Review',
        priority: 'medium',
        progress: 88,
        lastUpdated: 'Jan 5, 2024',
        team: ['MG', 'CB'],
    }
]

function AgentsLanding() {
    const [activeTab, setActiveTab] = useState('agents')
    const [searchTerm, setSearchTerm] = useState('')
    // Update IDs to match the new structure in agents.js
    const featuredAgentIds = ['pkb', 'writeback', 'browser-agent-pa']
    const featuredAgents = agents.filter((agent) => featuredAgentIds.includes(agent.id))

    // Filter agents based on search
    const filteredAgents = featuredAgents.filter(agent =>
        agent.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        agent.shortDesc.toLowerCase().includes(searchTerm.toLowerCase())
    )

    return (
        <div className="agents-landing">
            {/* Hero Section */}
            <section className="agents-hero">
                <div className="agents-hero-bg">
                    <div className="agents-hero-orb agents-hero-orb--1"></div>
                    <div className="agents-hero-orb agents-hero-orb--2"></div>
                    <div className="agents-hero-orb agents-hero-orb--3"></div>
                    <div className="agents-hero-grid"></div>
                </div>

                <div className="container">
                    <div className="agents-hero-content">
                        <span className="agents-hero-badge">
                            <span className="agents-hero-badge-dot"></span>
                            AI-Powered Healthcare
                        </span>
                        <h1 className="agents-hero-title">
                            Intelligent <span className="text-gradient">AI Agents</span>
                        </h1>
                        <p className="agents-hero-subtitle">
                            Transform your healthcare operations with our suite of AI agents designed
                            to automate complex workflows, reduce administrative burden, and improve
                            patient outcomes.
                        </p>

                        {/* Stats */}
                        <div className="agents-hero-stats">
                            <div className="agents-hero-stat">
                                <span className="agents-hero-stat-value">98.5%</span>
                                <span className="agents-hero-stat-label">Avg Accuracy</span>
                            </div>
                            <div className="agents-hero-stat">
                                <span className="agents-hero-stat-value">&lt;2s</span>
                                <span className="agents-hero-stat-label">Response Time</span>
                            </div>
                            <div className="agents-hero-stat">
                                <span className="agents-hero-stat-value">500+</span>
                                <span className="agents-hero-stat-label">Payer Integrations</span>
                            </div>
                            <div className="agents-hero-stat">
                                <span className="agents-hero-stat-value">99.9%</span>
                                <span className="agents-hero-stat-label">Uptime SLA</span>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Tab Navigation */}
            <section className="agents-tabs">
                <div className="container">
                    <div className="agents-tabs-header">
                        <div className="agents-tabs-nav">
                            <button
                                className={`agents-tabs-btn ${activeTab === 'agents' ? 'agents-tabs-btn--active' : ''}`}
                                onClick={() => setActiveTab('agents')}
                            >
                                <span className="agents-tabs-btn-icon">🤖</span>
                                AI Agents
                                <span className="agents-tabs-btn-count">{featuredAgents.length}</span>
                            </button>
                            <button
                                className={`agents-tabs-btn ${activeTab === 'projects' ? 'agents-tabs-btn--active' : ''}`}
                                onClick={() => setActiveTab('projects')}
                            >
                                <span className="agents-tabs-btn-icon">📁</span>
                                Ongoing Projects
                                <span className="agents-tabs-btn-count">{allProjects.length}</span>
                            </button>
                        </div>

                        {activeTab === 'agents' && (
                            <div className="agents-search">
                                <svg className="agents-search-icon" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
                                    <circle cx="11" cy="11" r="8" />
                                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                                </svg>
                                <input
                                    type="text"
                                    placeholder="Search agents..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                        )}
                    </div>

                    {/* Agents Tab Content */}
                    {activeTab === 'agents' && (
                        <div className="agents-grid">
                            {filteredAgents.map((agent, index) => (
                                <Link
                                    key={agent.id}
                                    to={`/agents/${agent.id}`}
                                    className="agent-card"
                                    style={{ animationDelay: `${index * 0.08}s` }}
                                >
                                    <div className="agent-card-glow"></div>
                                    <div className="agent-card-header">
                                        <div className="agent-card-icon">{agent.icon}</div>
                                        <div className="agent-card-badge">
                                            <span className="agent-card-badge-dot"></span>
                                            Live
                                        </div>
                                    </div>
                                    <div className="agent-card-content">
                                        <h3 className="agent-card-title">{agent.name}</h3>
                                        <p className="agent-card-description">{agent.shortDesc}</p>
                                    </div>
                                    <div className="agent-card-meta">
                                        <span className="agent-card-version">v{agent.version}</span>
                                        <span className="agent-card-accuracy">{agent.accuracy} accuracy</span>
                                    </div>
                                    <div className="agent-card-arrow">
                                        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
                                            <line x1="5" y1="12" x2="19" y2="12" />
                                            <polyline points="12 5 19 12 12 19" />
                                        </svg>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    )}

                    {/* Projects Tab Content */}
                    {activeTab === 'projects' && (
                        <div className="projects-grid">
                            {allProjects.map((project, index) => (
                                <div
                                    key={project.id}
                                    className="project-card"
                                    style={{ animationDelay: `${index * 0.08}s` }}
                                >
                                    <div className="project-card-header">
                                        <div className="project-card-agent">
                                            <span className="project-card-agent-icon">{project.agentIcon}</span>
                                            <span className="project-card-agent-name">{project.agentName}</span>
                                        </div>
                                        <span className={`project-card-status project-card-status--${project.status}`}>
                                            {project.statusLabel}
                                        </span>
                                    </div>

                                    <h4 className="project-card-name">{project.name}</h4>
                                    <p className="project-card-description">{project.description}</p>

                                    <div className="project-card-progress">
                                        <div className="project-card-progress-header">
                                            <span className={`project-card-priority project-card-priority--${project.priority}`}>
                                                {project.priority === 'high' && '🔴'}
                                                {project.priority === 'medium' && '🟡'}
                                                {project.priority === 'low' && '🟢'}
                                                {project.priority.charAt(0).toUpperCase() + project.priority.slice(1)}
                                            </span>
                                            <span className="project-card-progress-value">{project.progress}%</span>
                                        </div>
                                        <div className="project-card-progress-bar">
                                            <div
                                                className="project-card-progress-fill"
                                                style={{ width: `${project.progress}%` }}
                                            />
                                        </div>
                                    </div>

                                    <div className="project-card-footer">
                                        <div className="project-card-team">
                                            {project.team.map((member, i) => (
                                                <span key={i} className="project-card-team-member">{member}</span>
                                            ))}
                                        </div>
                                        <span className="project-card-date">{project.lastUpdated}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </section>

            {/* Features Section */}
            <section className="agents-features">
                <div className="container">
                    <div className="agents-features-header">
                        <span className="section-kicker">Why Choose Us</span>
                        <h2 className="section-title">Enterprise-Grade AI Agents</h2>
                        <p className="section-subtitle">
                            Built for healthcare, designed for scale, and engineered for reliability.
                        </p>
                    </div>

                    <div className="agents-features-grid">
                        <div className="feature-card">
                            <div className="feature-card-icon">⚡</div>
                            <h3 className="feature-card-title">Lightning Fast</h3>
                            <p className="feature-card-desc">Sub-second response times with 99.9% uptime SLA</p>
                        </div>
                        <div className="feature-card">
                            <div className="feature-card-icon">🔒</div>
                            <h3 className="feature-card-title">HIPAA Compliant</h3>
                            <p className="feature-card-desc">Enterprise-grade security with full audit trails</p>
                        </div>
                        <div className="feature-card">
                            <div className="feature-card-icon">🔗</div>
                            <h3 className="feature-card-title">Easy Integration</h3>
                            <p className="feature-card-desc">RESTful APIs with comprehensive documentation</p>
                        </div>
                        <div className="feature-card">
                            <div className="feature-card-icon">📊</div>
                            <h3 className="feature-card-title">Real Analytics</h3>
                            <p className="feature-card-desc">Track performance with detailed dashboards</p>
                        </div>
                    </div>
                </div>
            </section>
        </div>
    )
}

export default AgentsLanding
