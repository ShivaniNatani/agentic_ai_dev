import { useEffect, useMemo, useState } from 'react'
import ErrorBoundary from '../components/ErrorBoundary'
import { Link, useParams } from 'react-router-dom'

import { useAuth } from '../context/AuthContext'
import GlobalMap from '../components/GlobalMap/GlobalMap'
import PredictiveMonitor from '../components/PredictiveMonitor/PredictiveMonitor'
import MLOpsLayout from '../mlops/components/MLOpsLayout'
import Optimix from './Optimix'
import './Dashboard.css'

const CATEGORY_CONFIG = [
    {
        id: 'PKB Agent',
        clients: ['PKB', 'UHC', 'Orchid Pay', 'Generic']
    },
    {
        id: 'Writeback Agent',
        clients: ['CDPHP', 'OrthoNY', 'AHN', 'PHMG', 'Revere']
    },
    {
        id: 'Browser Agent PA',
        clients: ['BCBS', 'Premera', 'Regence', 'Well Care', 'UHC', 'Cigna', 'Carelon']
    }
]

const STATUS_DEFS = [
    { key: 'success', label: 'Successful', color: 'var(--status-success)' },
    { key: 'failure', label: 'Failure', color: 'var(--status-error)' },
    { key: 'pending', label: 'Pending', color: 'var(--status-warning)' }
]

const METRIC_CARDS = [
    { key: 'total', label: 'Total', icon: '📊', gradient: 'primary' },
    { key: 'success', label: 'Success', icon: '✅', gradient: 'success' },
    { key: 'failure', label: 'Failed', icon: '❌', gradient: 'error' },
    { key: 'pending', label: 'Pending', icon: '⏳', gradient: 'warning' }
]

const parseCsv = (text) => {
    const lines = text.trim().split(/\r?\n/).filter(Boolean)
    if (lines.length < 2) return []
    const headers = lines[0].split(',').map((h) => h.trim())
    return lines.slice(1).map((line) => {
        const values = line.split(',').map((v) => v.trim())
        const row = {}
        headers.forEach((h, i) => { row[h] = values[i] ?? '' })
        row.submission_count = Number(row.submission_count || 0)
        row.status = (row.status || '').toLowerCase()
        return row
    })
}

function Dashboard() {
    const { view } = useParams()
    const { user, hasProject } = useAuth()
    const activeView = view || 'home'
    const showAgentic = activeView === 'agentic'
    const showMLOps = activeView === 'mlops'
    const showOptimix = activeView === 'optimix' || activeView === 'optimix-iks'

    const [selectedCategory, setSelectedCategory] = useState(CATEGORY_CONFIG[0].id)
    const [selectedClient, setSelectedClient] = useState(null) // New: specific payer selection
    const [rows, setRows] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [expandedCategories, setExpandedCategories] = useState([CATEGORY_CONFIG[0].id]) // Keep first open by default

    // Greeting based on time
    const getGreeting = () => {
        const hour = new Date().getHours()
        if (hour < 12) return 'Good morning'
        if (hour < 18) return 'Good afternoon'
        return 'Good evening'
    }

    useEffect(() => {
        if (!showAgentic) {
            setRows([])
            setLoading(false)
            return
        }
        let isActive = true
        setLoading(true)
        const load = async () => {
            try {
                const response = await fetch('/artifacts/agentic_ai/agent-submission-data.csv')
                if (!response.ok) throw new Error(`CSV load failed (${response.status})`)
                const text = await response.text()
                if (isActive) setRows(parseCsv(text))
            } catch (err) {
                if (isActive) setError(err.message)
            } finally {
                if (isActive) setLoading(false)
            }
        }
        load()
        return () => { isActive = false }
    }, [showAgentic])

    const categoryClients = useMemo(() => {
        const match = CATEGORY_CONFIG.find((c) => c.id === selectedCategory)
        return match ? match.clients : []
    }, [selectedCategory])

    // Toggle category expansion
    const toggleCategory = (catId) => {
        if (expandedCategories.includes(catId)) {
            setExpandedCategories(expandedCategories.filter(id => id !== catId))
        } else {
            setExpandedCategories([...expandedCategories, catId])
        }
        setSelectedCategory(catId)
        setSelectedClient(null) // Reset client when switching category (optional)
    }

    const metrics = useMemo(() => {
        const totals = { total: 0, success: 0, failure: 0, pending: 0 }

        // Filter by category AND client if selected
        const filtered = rows.filter((r) => {
            const catMatch = r.category === selectedCategory
            const clientMatch = selectedClient ? r.client === selectedClient : true
            // If mock data doesn't have 'client' column, we might need to simulate it or careful
            // For now assuming rows have 'category' and 'client' or we accept broad match
            return catMatch && clientMatch
        })

        filtered.forEach((row) => {
            const count = Number(row.submission_count) || 0
            totals.total += count
            if (totals[row.status] !== undefined) totals[row.status] += count
        })
        return totals
    }, [rows, selectedCategory, selectedClient])

    const successRate = metrics.total ? Math.round((metrics.success / metrics.total) * 100) : 0

    return (
        <div className="dashboard">
            {/* Hero Section */}
            {!showMLOps && !showOptimix && (
                <section className="dashboard-hero">
                    <div className="dashboard-hero-bg">
                        <div className="dashboard-hero-orb dashboard-hero-orb--1"></div>
                        <div className="dashboard-hero-orb dashboard-hero-orb--2"></div>
                        <div className="dashboard-hero-grid"></div>
                    </div>

                    <div className="container">
                        <div className="dashboard-hero-content">
                            <div className="dashboard-hero-text">
                                <span className="dashboard-hero-badge">
                                    <span className="dashboard-hero-badge-dot"></span>
                                    Admin Console
                                </span>
                                <h1 className="dashboard-hero-title">
                                    {getGreeting()}, <span className="text-gradient">{user?.displayName || 'User'}</span>
                                </h1>
                                <p className="dashboard-hero-subtitle">
                                    {activeView === 'home'
                                        ? 'Select a dashboard below to explore live operational insights.'
                                        : showAgentic
                                            ? 'Monitor submission health, throughput, and client performance in real time.'
                                            : showOptimix
                                                ? 'Track GIA and AXIA client inventory and claims performance.'
                                                : 'Track model operations, pipeline health, and deployment readiness.'
                                    }
                                </p>
                            </div>

                            {/* Quick Stats */}
                            {showAgentic && (
                                <div className="dashboard-quick-stats">
                                    <div className="dashboard-quick-stat">
                                        <span className="dashboard-quick-stat-value">{metrics.total.toLocaleString()}</span>
                                        <span className="dashboard-quick-stat-label">Total Records</span>
                                    </div>
                                    <div className="dashboard-quick-stat dashboard-quick-stat--success">
                                        <span className="dashboard-quick-stat-value">{successRate}%</span>
                                        <span className="dashboard-quick-stat-label">Success Rate</span>
                                    </div>
                                    <div className="dashboard-quick-stat">
                                        <span className="dashboard-quick-stat-value">{categoryClients.length}</span>
                                        <span className="dashboard-quick-stat-label">Active Clients</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </section>
            )}

            {/* Dashboard Tiles - Home View */}
            {
                activeView === 'home' && (
                    <section className="dashboard-tiles">
                        <div className="container">
                            <div className="dashboard-tiles-grid">
                                {/* Agentic AI Tile */}
                                {hasProject('agentic') && (
                                <Link to="/dashboard/agentic" className="dashboard-tile dashboard-tile--agentic">
                                    <div className="dashboard-tile-glow"></div>
                                    <div className="dashboard-tile-icon">🤖</div>
                                    <div className="dashboard-tile-content">
                                        <h3 className="dashboard-tile-title">Agentic AI</h3>
                                        <p className="dashboard-tile-subtitle">Submission Dashboard</p>
                                        <p className="dashboard-tile-desc">
                                            Live submission health and throughput across all agent categories.
                                        </p>
                                    </div>
                                    <div className="dashboard-tile-stats">
                                        <div className="dashboard-tile-stat">
                                            <span className="dashboard-tile-stat-value">142</span>
                                            <span className="dashboard-tile-stat-label">Active Agents</span>
                                        </div>
                                        <div className="dashboard-tile-stat">
                                            <span className="dashboard-tile-stat-value">98.5%</span>
                                            <span className="dashboard-tile-stat-label">Uptime</span>
                                        </div>
                                    </div>
                                    <div className="dashboard-tile-badge">
                                        <span className="dashboard-tile-badge-dot"></span>
                                        Live
                                    </div>
                                    <div className="dashboard-tile-arrow">
                                        <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <line x1="5" y1="12" x2="19" y2="12" />
                                            <polyline points="12 5 19 12 12 19" />
                                        </svg>
                                    </div>
                                </Link>
                                )}

                                {/* MLOps Tile */}
                                {hasProject('mlops') && (
                                <Link to="/dashboard/mlops" className="dashboard-tile dashboard-tile--mlops">
                                    <div className="dashboard-tile-glow"></div>
                                    <div className="dashboard-tile-icon">📊</div>
                                    <div className="dashboard-tile-content">
                                        <h3 className="dashboard-tile-title">MLOps</h3>
                                        <p className="dashboard-tile-subtitle">Operations Dashboard</p>
                                        <p className="dashboard-tile-desc">
                                            Model operations, pipeline visibility, and deployment readiness.
                                        </p>
                                    </div>
                                    <div className="dashboard-tile-stats">
                                        <div className="dashboard-tile-stat">
                                            <span className="dashboard-tile-stat-value">42ms</span>
                                            <span className="dashboard-tile-stat-label">Avg Inference</span>
                                        </div>
                                        <div className="dashboard-tile-stat">
                                            <span className="dashboard-tile-stat-value">12</span>
                                            <span className="dashboard-tile-stat-label">Models</span>
                                        </div>
                                    </div>
                                    <div className="dashboard-tile-badge dashboard-tile-badge--mlops">
                                        <span className="dashboard-tile-badge-dot"></span>
                                        Live
                                    </div>
                                    <div className="dashboard-tile-arrow">
                                        <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <line x1="5" y1="12" x2="19" y2="12" />
                                            <polyline points="12 5 19 12 12 19" />
                                        </svg>
                                    </div>
                                </Link>
                                )}

                                {/* Optimix Tile */}
                                {hasProject('optimix') && (
                                <Link to="/dashboard/optimix" className="dashboard-tile dashboard-tile--optimix">
                                    <div className="dashboard-tile-glow"></div>
                                    <div className="dashboard-tile-icon">🎯</div>
                                    <div className="dashboard-tile-content">
                                        <h3 className="dashboard-tile-title">Optimix</h3>
                                        <p className="dashboard-tile-subtitle">DS Inventory Dashboard</p>
                                        <p className="dashboard-tile-desc">
                                            Daily claims and $AR tracking for GIA and AXIA clients.
                                        </p>
                                    </div>
                                    <div className="dashboard-tile-stats">
                                        <div className="dashboard-tile-stat">
                                            <span className="dashboard-tile-stat-value">2</span>
                                            <span className="dashboard-tile-stat-label">Clients</span>
                                        </div>
                                        <div className="dashboard-tile-stat">
                                            <span className="dashboard-tile-stat-value">Daily</span>
                                            <span className="dashboard-tile-stat-label">Updates</span>
                                        </div>
                                    </div>
                                    <div className="dashboard-tile-badge dashboard-tile-badge--optimix">
                                        <span className="dashboard-tile-badge-dot"></span>
                                        Live
                                    </div>
                                    <div className="dashboard-tile-arrow">
                                        <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <line x1="5" y1="12" x2="19" y2="12" />
                                            <polyline points="12 5 19 12 12 19" />
                                        </svg>
                                    </div>
                                </Link>
                                )}

                            </div>

                            {/* Quick Links */}
                            <div className="dashboard-quick-links">
                                <Link to="/agents" className="dashboard-quick-link">
                                    <span className="dashboard-quick-link-icon">🤖</span>
                                    <span>View All Agents</span>
                                </Link>
                                <Link to="/project-overview" className="dashboard-quick-link">
                                    <span className="dashboard-quick-link-icon">📁</span>
                                    <span>Projects</span>
                                </Link>
                                <Link to="/release-notes" className="dashboard-quick-link">
                                    <span className="dashboard-quick-link-icon">📝</span>
                                    <span>Release Notes</span>
                                </Link>
                                <Link to="/contact" className="dashboard-quick-link">
                                    <span className="dashboard-quick-link-icon">📬</span>
                                    <span>Contact</span>
                                </Link>
                            </div>
                        </div>
                    </section>
                )
            }

            {/* Agentic AI Dashboard */}
            {
                showAgentic && (
                    <section className="dashboard-agentic">
                        <div className="container">
                            {/* Back Button */}
                            <Link to="/dashboard" className="dashboard-back">
                                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
                                    <line x1="19" y1="12" x2="5" y2="12" />
                                    <polyline points="12 19 5 12 12 5" />
                                </svg>
                                Back to Dashboard
                            </Link>

                            {/* Section Header */}
                            <div className="dashboard-section-header">
                                <div>
                                    <h2 className="dashboard-section-title">
                                        <span className="dashboard-section-icon">🤖</span>
                                        Agent Submission Dashboard
                                    </h2>
                                    <p className="dashboard-section-subtitle">
                                        Track submission capacity across agent categories, monitor outcomes, and surface the clients driving the most workflow volume.
                                    </p>
                                </div>
                            </div>

                            {/* Metric Cards */}
                            <div className="dashboard-metrics">
                                {METRIC_CARDS.map((card, index) => (
                                    <div
                                        key={card.key}
                                        className={`dashboard-metric dashboard-metric--${card.gradient}`}
                                        style={{ animationDelay: `${index * 0.1}s` }}
                                    >
                                        <div className="dashboard-metric-icon">{card.icon}</div>
                                        <div className="dashboard-metric-content">
                                            <span className="dashboard-metric-value">
                                                {metrics[card.key].toLocaleString()}
                                            </span>
                                            <span className="dashboard-metric-label">{card.label}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Controls & Charts */}
                            <div className="dashboard-grid">
                                {/* Category Selector */}
                                <div className="dashboard-card dashboard-card--controls">
                                    <h3 className="dashboard-card-title">Agent Category</h3>
                                    <div className="dashboard-category-list">
                                        {CATEGORY_CONFIG.map((cat) => {
                                            const isExpanded = expandedCategories.includes(cat.id)
                                            const isActive = selectedCategory === cat.id

                                            return (
                                                <div key={cat.id} className="dashboard-category-group">
                                                    <button
                                                        className={`dashboard-category-btn ${isActive ? 'dashboard-category-btn--active' : ''}`}
                                                        onClick={() => toggleCategory(cat.id)}
                                                    >
                                                        <div className="dashboard-category-btn-content">
                                                            <span className="dashboard-category-icon">
                                                                {cat.id.includes('PA') ? '🔐' :
                                                                    cat.id.includes('Referr') ? '🔄' :
                                                                        cat.id.includes('Payer') ? '👁️' : '📝'}
                                                            </span>
                                                            <span className="dashboard-category-name">{cat.id}</span>
                                                        </div>
                                                        <span className={`dashboard-category-chevron ${isExpanded ? 'open' : ''}`}>▼</span>
                                                    </button>

                                                    {/* Payer/Client List (Dropdown) */}
                                                    {isExpanded && (
                                                        <div className="dashboard-client-dropdown animate-fade-in-up">
                                                            {cat.clients.map(client => (
                                                                <button
                                                                    key={client}
                                                                    className={`dashboard-client-btn ${selectedClient === client ? 'dashboard-client-btn--active' : ''}`}
                                                                    onClick={() => setSelectedClient(client)}
                                                                >
                                                                    <span className="dashboard-client-dot"></span>
                                                                    {client}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            )
                                        })}
                                    </div>

                                    {loading && <p className="dashboard-status">Loading data...</p>}
                                    {error && <p className="dashboard-status dashboard-status--error">{error}</p>}
                                </div>

                                {/* Status Distribution */}
                                <div className="dashboard-card dashboard-card--status">
                                    <h3 className="dashboard-card-title">Status Distribution</h3>
                                    <div className="dashboard-status-bar">
                                        {STATUS_DEFS.map((status) => {
                                            const value = metrics[status.key] || 0
                                            const percent = metrics.total ? Math.round((value / metrics.total) * 100) : 0
                                            return (
                                                <div
                                                    key={status.key}
                                                    className="dashboard-status-segment"
                                                    style={{
                                                        width: `${Math.max(percent, 2)}%`,
                                                        backgroundColor: status.color
                                                    }}
                                                    title={`${status.label}: ${value.toLocaleString()} (${percent}%)`}
                                                />
                                            )
                                        })}
                                    </div>
                                    <div className="dashboard-status-legend">
                                        {STATUS_DEFS.map((status) => {
                                            const value = metrics[status.key] || 0
                                            const percent = metrics.total ? Math.round((value / metrics.total) * 100) : 0
                                            return (
                                                <div key={status.key} className="dashboard-status-legend-item">
                                                    <span
                                                        className="dashboard-status-legend-dot"
                                                        style={{ backgroundColor: status.color }}
                                                    />
                                                    <span className="dashboard-status-legend-label">{status.label}</span>
                                                    <span className="dashboard-status-legend-value">{percent}%</span>
                                                </div>
                                            )
                                        })}
                                    </div>
                                </div>

                                {/* Client List */}
                                <div className="dashboard-card dashboard-card--clients">
                                    <h3 className="dashboard-card-title">Active Clients</h3>
                                    <div className="dashboard-client-list">
                                        {categoryClients.map((client, index) => (
                                            <div
                                                key={client}
                                                className="dashboard-client"
                                                style={{ animationDelay: `${index * 0.05}s` }}
                                            >
                                                <div className="dashboard-client-avatar">
                                                    {client.slice(0, 2).toUpperCase()}
                                                </div>
                                                <span className="dashboard-client-name">{client}</span>
                                                <span className="dashboard-client-status">
                                                    <span className="dashboard-client-status-dot"></span>
                                                    Active
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Global Map Section */}
                            <div className="mt-8" style={{ marginTop: '3rem' }}>
                                <h3 className="section-title mb-4" style={{ marginBottom: '1rem', fontSize: '1.2rem', color: 'var(--text-primary)' }}>Global Deployment Matrix</h3>
                                <GlobalMap />
                            </div>
                        </div>
                    </section>
                )
            }

            {/* MLOps Dashboard */}
            {showMLOps && (
                <section className="dashboard-mlops" style={{ padding: 0, maxWidth: '100vw' }}>
                    <ErrorBoundary>
                        <MLOpsLayout />
                    </ErrorBoundary>
                </section>
            )}

            {/* Optimix Dashboard */}
            {showOptimix && (
                <section className="dashboard-optimix" style={{ padding: 0, maxWidth: '100vw' }}>
                    <ErrorBoundary>
                        <Optimix initialTab={activeView === 'optimix-iks' ? 'claims' : 'inventory'} />
                    </ErrorBoundary>
                </section>
            )}
        </div >
    )
}

export default Dashboard
