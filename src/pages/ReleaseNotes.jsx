import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import './ReleaseNotes.css'

// Fallback data if API fetch fails
import { releases as STATIC_RELEASES } from '../data/releases'

function ReleaseNotes() {
    const [searchTerm, setSearchTerm] = useState('')
    const [filter, setFilter] = useState('all') // 'all', 'major', 'minor', 'patch'
    const [showFeedbackModal, setShowFeedbackModal] = useState(false)
    const [releases, setReleases] = useState(STATIC_RELEASES)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [lastUpdated, setLastUpdated] = useState('')
    const [selectedProject, setSelectedProject] = useState(null)
    const [selectedClient, setSelectedClient] = useState(null)
    const [selectedRelease, setSelectedRelease] = useState(null)
    const [dataSource, setDataSource] = useState('')

    // Fetch release notes from backend (Google Sheets powered)
    const loadReleases = useCallback(async (refresh = false) => {
        setLoading(true)
        setError('')
        try {
            const ts = Date.now()
            const query = refresh ? `?refresh=true&_=${ts}` : `?_=${ts}`
            const resp = await fetch(`/api/releases${query}`)
            if (!resp.ok) throw new Error('Failed to load releases')
            const data = await resp.json()
            if (data?.releases && data.releases.length > 0) {
                // Normalize incoming sheet rows
                const normalized = data.releases.map((r) => {
                    const splitList = (val) => {
                        if (!val) return []
                        if (Array.isArray(val)) return val
                        return String(val)
                            .split('|')
                            .map(s => s.trim())
                            .filter(Boolean)
                    }
                    const client = r.client || r.payer || ''
                    const projectId = r.projectId || client || 'General'
                    return {
                        ...r,
                        category: r.category || projectId || 'Other Updates',
                        projectId,
                        client,
                        highlights: splitList(r.highlights),
                        fixes: splitList(r.fixes),
                        links: splitList(r.links),
                    }
                })
                setReleases(normalized)
                setLastUpdated(data.last_updated || '')
                setDataSource(data.source || '')
            } else {
                throw new Error('No releases returned from API')
            }
        } catch (err) {
            setError('Unable to load latest releases. Showing saved data.')
            setReleases(STATIC_RELEASES)
            setLastUpdated('')
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        let cancelled = false
            ; (async () => {
                if (!cancelled) await loadReleases(false)
            })()
        return () => { cancelled = true }
    }, [loadReleases])

    const handleRefresh = () => {
        if (!loading) {
            loadReleases(true)
        }
    }

    // Calculate stats safely
    const stats = {
        major: releases.filter(r => r.type === 'major').length,
        minor: releases.filter(r => r.type === 'minor').length,
        patch: releases.filter(r => r.type === 'patch').length,
        total: releases.length
    }

    // Filter + flat sort for card feed
    const filteredReleases = releases
        .filter(release => {
            const matchesSearch =
                (release.title || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                (release.agent || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                (release.description || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                (release.projectId || '').toLowerCase().includes(searchTerm.toLowerCase())

            const matchesFilter = filter === 'all' || release.type === filter
            return matchesSearch && matchesFilter
        })
        .sort((a, b) => {
            const da = new Date(a.date || 0).getTime()
            const db = new Date(b.date || 0).getTime()
            return isNaN(db - da) ? 0 : db - da
        })

    // Keep a selected release in sync if it still exists in filtered list, otherwise deselect
    useEffect(() => {
        if (filteredReleases.length === 0) {
            setSelectedRelease(null)
            setSelectedProject(null)
            setSelectedClient(null)
            return
        }
        const currentStillExists = selectedRelease && filteredReleases.find(r => r.id === selectedRelease.id)
        if (!currentStillExists) {
            setSelectedRelease(null)
            setSelectedProject(null)
            setSelectedClient(null)
        }
    }, [filteredReleases, selectedRelease])

    return (
        <div className="releases-page">
            <div className="releases-bg">
                <div className="releases-bg-orb releases-bg-orb--1"></div>
            </div>

            <div className="container-fluid">
                {/* Header Section */}
                <div className="releases-hero">
                    <div className="releases-hero-content">
                        <span className="section-label">WHAT'S NEW</span>
                        <h1 className="releases-hero-title">Release Notes</h1>
                        <p className="releases-hero-subtitle">
                            A premium, searchable feed of everything shipping across our AI Agents. Filter by release type, browse PDFs, and dive into timelines.
                        </p>

                        <div className="releases-stats-bar">
                            <span className="stat-pill">Major: {stats.major}</span>
                            <span className="stat-pill">Minor: {stats.minor}</span>
                            <span className="stat-pill">Patch: {stats.patch}</span>
                            <span className="stat-pill">Total: {stats.total}</span>
                        </div>
                    </div>

                    <div className="releases-hero-action">
                        <div className="feedback-cta">
                            <span className="feedback-label">Have a feature idea?</span>
                            <button
                                className="btn btn-primary"
                                onClick={() => setShowFeedbackModal(true)}
                            >
                                Share feedback
                            </button>
                        </div>
                    </div>
                </div>

                {/* Filter & Search Bar */}
                <div className="releases-controls">
                    <div className="search-wrapper">
                        <span className="search-icon">🔍</span>
                        <input
                            type="text"
                            placeholder="Search releases, agents, or highlights..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="search-input"
                        />
                    </div>

                    <div className="filter-group">
                        <button
                            className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
                            onClick={() => setFilter('all')}
                        >All</button>
                        <button
                            className={`filter-btn ${filter === 'major' ? 'active' : ''}`}
                            onClick={() => setFilter('major')}
                        >Major</button>
                        <button
                            className={`filter-btn ${filter === 'minor' ? 'active' : ''}`}
                            onClick={() => setFilter('minor')}
                        >Minor</button>
                        <button
                            className={`filter-btn ${filter === 'patch' ? 'active' : ''}`}
                            onClick={() => setFilter('patch')}
                        >Patch</button>
                    </div>
                    <button
                        className="filter-btn"
                        style={{ minWidth: '140px' }}
                        onClick={handleRefresh}
                        disabled={loading}
                    >
                        {loading ? '⏳ Refreshing...' : '🔄 Refresh'}
                    </button>
                </div>
                <div className="releases-layout">
                    {/* LEFT: LIST */}
                    <div className="releases-list">
                        {loading && (
                            <div className="empty-state">
                                <p>Loading release notes…</p>
                            </div>
                        )}

                        {!loading && lastUpdated && (
                            <div className="empty-state" style={{ color: '#555', marginTop: '-12px' }}>
                                <p>Last updated: {new Date(lastUpdated).toLocaleString()}</p>
                            </div>
                        )}

                        {error && !loading && (
                            <div className="empty-state" style={{ color: '#c0392b' }}>
                                <p>{error}</p>
                            </div>
                        )}

                        {(() => {
                            const CATEGORY_ORDER = ['Writeback', 'Optimix', 'Browser Agents', 'Other Updates']
                            const CATEGORY_MAP = {
                                cdphp: 'Writeback',
                                orthonywritebacks: 'Writeback',
                                orthonyevenotes: 'Writeback',
                                recommendednextbestaction: 'Optimix',
                                denial: 'Optimix',
                                appeal: 'Optimix',
                                ittt: 'Optimix',
                                cmmcarelon: 'Browser Agents',
                                carelon: 'Browser Agents',
                                pa: 'Browser Agents',
                                priorauth: 'Browser Agents',
                                referral: 'Browser Agents',
                                wissen: 'Browser Agents',
                                pkb: 'Browser Agents',
                            }
                            const normalizeCategory = (release) => {
                                const explicit = (release.category || '').trim()
                                if (explicit) return explicit
                                const agent = (release.agent || '').toLowerCase()
                                const project = release.projectId
                                const normProject = (project || '').toLowerCase().replace(/[^a-z0-9]/g, '')
                                const mapped = CATEGORY_MAP[normProject]
                                if (mapped) return mapped
                                if (agent.includes('writeback')) return 'Writeback'
                                if (agent.includes('optimix')) return 'Optimix'
                                if (
                                    agent.includes('browser') ||
                                    agent.includes('referral') ||
                                    agent.includes('pa') ||
                                    agent.includes('pkb')
                                ) return 'Browser Agents'
                                return 'Other Updates'
                            }

                            const grouped = filteredReleases.reduce((acc, rel) => {
                                const cat = normalizeCategory(rel)
                                if (!acc[cat]) acc[cat] = {}
                                const project = rel.projectId || 'General'
                                if (!acc[cat][project]) acc[cat][project] = {}
                                const client = (rel.client || rel.payer || 'Client: N/A').trim()
                                if (!acc[cat][project][client]) acc[cat][project][client] = []
                                acc[cat][project][client].push(rel)
                                return acc
                            }, {})

                            const sortedCats = Object.keys(grouped).sort((a, b) => {
                                const ai = CATEGORY_ORDER.indexOf(a)
                                const bi = CATEGORY_ORDER.indexOf(b)
                                const aRank = ai === -1 ? CATEGORY_ORDER.length : ai
                                const bRank = bi === -1 ? CATEGORY_ORDER.length : bi
                                if (aRank === bRank) return a.localeCompare(b)
                                return aRank - bRank
                            })

                            return sortedCats.map((cat) => (
                                <div key={cat} className="category-block">
                                    <h3 className="category-header">{cat}</h3>
                                    {Object.entries(grouped[cat]).map(([project, clientGroups]) => (
                                        <div key={project}>
                                            {project !== 'General' && (
                                                <div
                                                    className="project-header clickable"
                                                    onClick={() => {
                                                        const firstClient = Object.keys(clientGroups)[0]
                                                        setSelectedProject(project)
                                                        setSelectedClient(firstClient)
                                                        const firstRelease = clientGroups[firstClient][0]
                                                        setSelectedRelease(firstRelease)
                                                    }}
                                                >
                                                    {project}
                                                </div>
                                            )}
                                            {Object.entries(clientGroups).map(([clientName, items]) => (
                                                <div key={clientName}>
                                                    <div
                                                        className="client-header clickable"
                                                        onClick={() => {
                                                            setSelectedProject(project)
                                                            setSelectedClient(clientName)
                                                            setSelectedRelease(items[0])
                                                        }}
                                                    >
                                                        {clientName}
                                                    </div>
                                                    {items.map((release, index) => {
                                                        const cardId = `${project}-${clientName}-${index}-${release.title}`
                                                        const isSelected = selectedRelease?.id === release.id
                                                        const clientLabel = (release.client || release.payer || 'Client: N/A').trim()
                                                        return (
                                                            <div
                                                                key={cardId}
                                                                className={`release-card clickable ${isSelected ? 'selected' : ''}`}
                                                                onClick={() => {
                                                                    setSelectedProject(release.projectId)
                                                                    setSelectedClient(clientName)
                                                                    setSelectedRelease(release)
                                                                }}
                                                            >
                                                                <div className="release-card-header">
                                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                                        <span className="release-type-pill">{release.type}</span>
                                                                        <span className="release-date">{release.date}</span>
                                                                    </div>
                                                                </div>

                                                                <h2 className="release-title">{release.title}</h2>
                                                                <div className="release-meta">
                                                                    {release.projectId ? `${release.projectId}` : 'General'}
                                                                    {clientLabel ? ` • Client: ${clientLabel}` : ''}
                                                                    {release.agent ? ` • ${release.agent}` : ''}
                                                                    {release.owner ? ` • Owner: ${release.owner}` : ''}
                                                                </div>
                                                            </div>
                                                        )
                                                    })}
                                                </div>
                                            ))}
                                        </div>
                                    ))}
                                </div>
                            ))
                        })()}

                        {filteredReleases.length === 0 && (
                            <div className="empty-state">
                                <p>No releases found matching your criteria.</p>
                            </div>
                        )}
                    </div>

                    {/* RIGHT: DETAILS (all releases for selected project) */}
                    <div className="release-details-pane">
                        {loading && !selectedRelease ? (
                            <div className="skeleton-details">
                                <div className="skeleton-line" style={{ width: '30%', height: 24, marginBottom: 12 }}></div>
                                <div className="skeleton-line" style={{ width: '60%', height: 32, marginBottom: 16 }}></div>
                                <div className="skeleton-line" style={{ width: '40%', marginBottom: 24 }}></div>
                                <div className="skeleton-block" style={{ height: 80, marginBottom: 24 }}></div>
                                <div className="skeleton-block" style={{ height: 120 }}></div>
                            </div>
                        ) : selectedRelease ? (
                            (() => {
                                const rel = selectedRelease
                                const clientLabel = (rel.client || rel.payer || 'Client: N/A').trim()
                                const history = releases
                                    .filter(r => r.projectId === rel.projectId)
                                    .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0))
                                return (
                                    <div className="detail-card">
                                        <div className="detail-header">
                                            <span className={`release-type-pill ${rel.type}`}>{rel.type}</span>
                                            <span className="release-date">{rel.date}</span>
                                            <span className="release-card-badge">v{rel.version}</span>
                                        </div>
                                        <h2 className="detail-title">{rel.title}</h2>
                                        <div className="detail-submeta">
                                            {rel.projectId || 'General'} • Client: {clientLabel}{rel.agent ? ` • ${rel.agent}` : ''}{rel.owner ? ` • Owner: ${rel.owner}` : ''}
                                        </div>
                                        {rel.description && (
                                            <p className="detail-description">{rel.description}</p>
                                        )}

                                        {/* Links Section */}
                                        {rel.links && rel.links.length > 0 && (
                                            <div className="detail-links-section">
                                                {rel.links.map((link, i) => {
                                                    // Simple heuristic to extract URL vs Label if formatted like "Label|URL" or just "URL"
                                                    // But splitList in backend handles | inside the list logic, so here we might just get strings.
                                                    // Let's assume the string itself is the link or try to find a URL in it.
                                                    let url = link
                                                    let label = 'View Resource'

                                                    // Check for markdown-style [Label](Url) or just URL
                                                    const mdMatch = link.match(/\[(.*?)\]\((.*?)\)/)
                                                    if (mdMatch) {
                                                        label = mdMatch[1]
                                                        url = mdMatch[2]
                                                    } else if (link.startsWith('http')) {
                                                        label = 'Open Link'
                                                    }

                                                    return (
                                                        <a
                                                            key={i}
                                                            href={url}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="detail-link-pill"
                                                        >
                                                            🔗 {label === 'Open Link' ? url.substring(0, 30) + '...' : label}
                                                        </a>
                                                    )
                                                })}
                                            </div>
                                        )}

                                        <div className="detail-content-scroll">
                                            {rel.highlights && rel.highlights.length > 0 && (
                                                <div className="detail-section-wrapper">
                                                    <div className="release-section-title">✨ What's New</div>
                                                    <ul className="release-list highlights">
                                                        {rel.highlights.map((h, i) => (
                                                            <li key={i}>{h}</li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            )}
                                            {rel.fixes && rel.fixes.length > 0 && (
                                                <div className="detail-section-wrapper">
                                                    <div className="release-section-title">🐛 Bug Fixes</div>
                                                    <ul className="release-list fixes">
                                                        {rel.fixes.map((f, i) => (
                                                            <li key={i}>{f}</li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            )}
                                        </div>

                                        {history.length > 1 && (
                                            <div className="history-section">
                                                <div className="release-section-title">Version History</div>
                                                <p className="history-subtitle">Previous updates for this project</p>
                                                <ul className="history-list">
                                                    {history.map((h, i) => (
                                                        <li
                                                            key={`${h.id}-${i}`}
                                                            className={h.id === rel.id ? 'history-active' : ''}
                                                            onClick={(e) => {
                                                                e.stopPropagation()
                                                                setSelectedProject(h.projectId)
                                                                setSelectedClient((h.client || h.payer || '').trim() || null)
                                                                setSelectedRelease(h)
                                                                // Scroll to top of details pane
                                                                const pane = document.querySelector('.release-details-pane')
                                                                if (pane) pane.scrollTop = 0
                                                            }}
                                                        >
                                                            <div className="history-top">
                                                                <span className={`history-type-dot ${h.type || 'minor'}`}></span>
                                                                <span className="history-version">v{h.version}</span>
                                                                <span className="release-date">{h.date}</span>
                                                            </div>
                                                            <div className="history-title">{h.title}</div>
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}
                                    </div>
                                )
                            })()
                        ) : (
                            <div className="empty-state">
                                <div className="empty-state-icon">👈</div>
                                <p>Select a release from the list to view details</p>
                            </div>
                        )}
                    </div>
                </div>

                <div className="feedback-bar">Send us your feedback</div>

                {/* Mock Feedback Modal */}
                {showFeedbackModal && (
                    <div className="modal-overlay">
                        <div className="modal-card">
                            <div className="modal-header">
                                <h3>Share Feedback</h3>
                                <button className="close-btn" onClick={() => setShowFeedbackModal(false)}>✕</button>
                            </div>
                            <div className="modal-body">
                                <textarea
                                    className="feedback-input"
                                    placeholder="Tell us what you'd like to see next..."
                                    rows="4"
                                ></textarea>
                            </div>
                            <div className="modal-footer">
                                <button className="btn btn-primary w-full" onClick={() => setShowFeedbackModal(false)}>Send Feedback</button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}

export default ReleaseNotes
