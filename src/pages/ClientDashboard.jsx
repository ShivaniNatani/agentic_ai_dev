import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { clients } from '../data/clients'
import './ClientDashboard.css'

function ClientDashboard() {
    const { id } = useParams()
    const [client, setClient] = useState(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        setLoading(true)
        // Simulate API fetch delay
        setTimeout(() => {
            const foundClient = clients.find(c => c.id === id) || clients[0] // Default to first if not found for demo
            setClient(foundClient)
            setLoading(false)
        }, 500)
    }, [id])

    if (loading) {
        return (
            <div className="client-loading">
                <div className="client-spinner"></div>
            </div>
        )
    }

    if (!client) return <div>Client not found</div>

    return (
        <div className="client-dashboard">
            <div className="client-bg">
                <div className="client-bg-orb client-bg-orb--1"></div>
            </div>

            <div className="container">
                {/* Header */}
                <div className="client-header animate-fade-in-up">
                    <div className="client-header-main">
                        <div className="client-logo-wrapper">
                            {client.logo}
                        </div>
                        <div className="client-info">
                            <h1 className="client-name">{client.name}</h1>
                            <div className="client-meta">
                                <span className={`client-status client-status--${client.status}`}>
                                    <span className="client-status-dot"></span>
                                    {client.status}
                                </span>
                                <span className="client-tier">{client.tier}</span>
                                <span className="client-since">Since {client.since}</span>
                            </div>
                        </div>
                    </div>
                    <div className="client-actions">
                        <button className="btn btn-secondary">Settings</button>
                        <button className="btn btn-primary">New Project</button>
                    </div>
                </div>

                {/* Stats Grid */}
                <div className="client-stats-grid animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
                    <div className="client-stat-card">
                        <span className="client-stat-icon">✨</span>
                        <div className="client-stat-content">
                            <span className="client-stat-label">Auth Success Rate</span>
                            <span className="client-stat-value">{client.stats.authSuccess}</span>
                        </div>
                    </div>
                    <div className="client-stat-card">
                        <span className="client-stat-icon">💰</span>
                        <div className="client-stat-content">
                            <span className="client-stat-label">Est. Savings</span>
                            <span className="client-stat-value">{client.stats.savings}</span>
                        </div>
                    </div>
                    <div className="client-stat-card">
                        <span className="client-stat-icon">⚡</span>
                        <div className="client-stat-content">
                            <span className="client-stat-label">Tasks Automated</span>
                            <span className="client-stat-value">{client.stats.tasksAutomated}</span>
                        </div>
                    </div>
                    <div className="client-stat-card">
                        <span className="client-stat-icon">🤖</span>
                        <div className="client-stat-content">
                            <span className="client-stat-label">Active Agents</span>
                            <span className="client-stat-value">{client.activeAgents.length}</span>
                        </div>
                    </div>
                </div>

                <div className="client-grid-layout">
                    {/* Main Column */}
                    <div className="client-main-col">

                        {/* Deployment Status */}
                        <div className="client-section animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
                            <h3 className="client-section-title">Deployment Status</h3>
                            <div className="deployment-grid">
                                {client.activeAgents.map((agent, index) => (
                                    <div key={index} className="deployment-card">
                                        <div className="deployment-header">
                                            <span className="deployment-name">{agent}</span>
                                            <span className="deployment-status deployment-status--live">Live</span>
                                        </div>
                                        <div className="deployment-health">
                                            <div className="health-bar">
                                                <div className="health-fill" style={{ width: '98%' }}></div>
                                            </div>
                                            <span className="health-label">98% Health</span>
                                        </div>
                                    </div>
                                ))}
                                <div className="deployment-card deployment-card--add">
                                    <span className="add-icon">+</span>
                                    <span>Deploy New Agent</span>
                                </div>
                            </div>
                        </div>

                        {/* Projects */}
                        <div className="client-section animate-fade-in-up" style={{ animationDelay: '0.3s' }}>
                            <h3 className="client-section-title">Active Projects</h3>
                            <div className="client-projects-list">
                                {client.projects.map(project => (
                                    <div key={project.id} className="client-project-row">
                                        <div className="project-info">
                                            <span className="project-name">{project.name}</span>
                                            <div className="project-progress-wrapper">
                                                <div className="project-progress-bar">
                                                    <div
                                                        className="project-progress-fill"
                                                        style={{ width: `${project.progress}%` }}
                                                    ></div>
                                                </div>
                                                <span className="project-progress-value">{project.progress}%</span>
                                            </div>
                                        </div>
                                        <div className="project-meta">
                                            <span className={`project-badge project-badge--${project.status}`}>
                                                {project.status}
                                            </span>
                                            <button className="btn-icon-only">
                                                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                                                    <path d="M5 12h14M12 5l7 7-7 7" />
                                                </svg>
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                    </div>

                    {/* Side Column */}
                    <div className="client-side-col animate-fade-in-up" style={{ animationDelay: '0.4s' }}>

                        {/* Company Detail */}
                        <div className="client-card-glass">
                            <h4 className="client-card-title">About Client</h4>
                            <p className="client-desc">{client.description}</p>
                            <div className="client-contact-info">
                                <div className="contact-row">
                                    <span className="contact-icon">📍</span>
                                    <span>Albany, NY</span>
                                </div>
                                <div className="contact-row">
                                    <span className="contact-icon">🌐</span>
                                    <span>{client.id}.com</span>
                                </div>
                                <div className="contact-row">
                                    <span className="contact-icon">👥</span>
                                    <span>~500 Employees</span>
                                </div>
                            </div>
                        </div>

                        {/* Recent Activity */}
                        <div className="client-card-glass">
                            <h4 className="client-card-title">Recent Activity</h4>
                            <div className="activity-feed">
                                <div className="activity-item">
                                    <div className="activity-dot"></div>
                                    <div className="activity-content">
                                        <p className="activity-text">Prior Auth volume spike detected</p>
                                        <span className="activity-time">2h ago</span>
                                    </div>
                                </div>
                                <div className="activity-item">
                                    <div className="activity-dot"></div>
                                    <div className="activity-content">
                                        <p className="activity-text">Claims agent deployed to prod</p>
                                        <span className="activity-time">1d ago</span>
                                    </div>
                                </div>
                                <div className="activity-item">
                                    <div className="activity-dot"></div>
                                    <div className="activity-content">
                                        <p className="activity-text">Quarterly business review</p>
                                        <span className="activity-time">3d ago</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                    </div>
                </div>
            </div>
        </div>
    )
}

export default ClientDashboard
