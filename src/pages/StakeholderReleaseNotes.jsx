import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
    Zap,
    Award,
    TrendingUp,
    Users,
    CheckCircle,
    AlertCircle,
    ArrowRight,
    Download,
    Calendar,
    Activity,
    Shield
} from 'lucide-react'
import { jsPDF } from 'jspdf'
import { releases as STATIC_RELEASES } from '../data/releases'
import './StakeholderReleaseNotes.css'

// --- Utility Functions ---
const normalizeInlineText = (value) => String(value || '')
    .replace(/\r/g, '\n')
    .replace(/[^\x20-\x7E\n]/g, ' ')
    .replace(/\s*\n+\s*/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()

const splitTextList = (value) => {
    if (!value) return []
    const rawItems = Array.isArray(value) ? value : [value]
    const expanded = rawItems.flatMap((item) => String(item || '').split(/\||\n+/))
    return Array.from(new Set(expanded.map((item) => normalizeInlineText(item.replace(/^[-*•]\s*/, ''))).filter(Boolean)))
}

const parseDateValue = (value) => {
    const ts = new Date(value || '').getTime()
    return Number.isNaN(ts) ? 0 : ts
}

const formatDate = (dateString) => {
    if (!dateString) return 'N/A'
    const date = new Date(dateString)
    return Number.isNaN(date.getTime()) ? dateString : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

// --- Mock KPI Data ---
const MOCK_KPIS = {
    velocity: { value: '2.4', label: 'Releases / Month', trend: '+12%', status: 'positive' },
    features: { value: '42', label: 'Meaningful Features', trend: 'YTD', status: 'neutral' },
    quality: { value: '99.8%', label: 'Uptime Stability', trend: '+0.2%', status: 'positive' },
    adoption: { value: '85%', label: 'Feature Adoption', trend: '+5%', status: 'positive' }
}

function StakeholderReleaseNotes() {
    const [releases, setReleases] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [selectedReleaseId, setSelectedReleaseId] = useState(null)
    const [pdfGenerating, setPdfGenerating] = useState(false)
    const timelineRef = useRef(null)

    // --- Data Normalization ---
    const normalizeReleaseRows = useCallback((rows = []) => {
        return rows.map((rawRow, index) => {
            const id = rawRow.id || `release-${index + 1}`
            const version = rawRow.version || '1.0.0'
            const date = rawRow.date || 'N/A'
            const title = rawRow.title || 'Release Update'
            const type = rawRow.type || 'minor'

            return {
                ...rawRow,
                id,
                version,
                date,
                title,
                type,
                displayDate: formatDate(date),
                ts: parseDateValue(date),
                highlights: splitTextList(rawRow.highlights),
                fixes: splitTextList(rawRow.fixes),
                links: splitTextList(rawRow.links),
                description: rawRow.description || ''
            }
        }).sort((a, b) => b.ts - a.ts)
    }, [])

    // --- Load Data ---
    useEffect(() => {
        const load = async () => {
            try {
                // Determine source (mock or API)
                let data = STATIC_RELEASES
                // Simulate API call if needed, or stick to static for now as per original code
                const normalized = normalizeReleaseRows(data)
                setReleases(normalized)
                if (normalized.length > 0) setSelectedReleaseId(normalized[0].id)
            } catch (err) {
                console.error('Failed to load releases:', err)
                setError('Failed to load release data.')
            } finally {
                setLoading(false)
            }
        }
        load()
    }, [normalizeReleaseRows])

    const selectedRelease = useMemo(
        () => releases.find((r) => r.id === selectedReleaseId) || releases[0],
        [releases, selectedReleaseId]
    )

    // --- Impact Categorization Logic ---
    const impactCards = useMemo(() => {
        if (!selectedRelease) return []

        const capabilities = selectedRelease.highlights || []
        const quality = selectedRelease.fixes || []

        // Simple heuristic: Long items go to capabilities, short items to quality
        // In a real app, this would be tagged in the data

        return [
            {
                title: 'Strategic Capabilities',
                icon: <Zap size={18} color="#38bdf8" />,
                badge: 'High Impact',
                badgeClass: 'high',
                items: capabilities.slice(0, Math.ceil(capabilities.length / 2) + 1)
            },
            {
                title: 'Operational Efficiency',
                icon: <Activity size={18} color="#f59e0b" />,
                badge: 'Med Impact',
                badgeClass: 'medium',
                items: capabilities.slice(Math.ceil(capabilities.length / 2) + 1)
            },
            {
                title: 'Quality & Stability',
                icon: <Shield size={18} color="#10b981" />,
                badge: 'Maintenance',
                badgeClass: 'low',
                items: quality
            }
        ].filter(card => card.items.length > 0)
    }, [selectedRelease])

    // --- PDF Generation ---
    const handleDownloadPdf = async () => {
        if (!selectedRelease || pdfGenerating) return
        setPdfGenerating(true)

        try {
            const doc = new jsPDF()
            let y = 20

            doc.setFontSize(22)
            doc.setTextColor(10, 50, 90)
            doc.text(`Executive Brief: ${selectedRelease.version}`, 20, y)
            y += 10

            doc.setFontSize(12)
            doc.setTextColor(100, 100, 100)
            doc.text(`${selectedRelease.title} — ${selectedRelease.displayDate}`, 20, y)
            y += 15

            doc.setLineWidth(0.5)
            doc.line(20, y, 190, y)
            y += 15

            const addSection = (title, items) => {
                if (!items?.length) return
                if (y > 250) { doc.addPage(); y = 20 }

                doc.setFontSize(16)
                doc.setTextColor(0, 0, 0)
                doc.text(title, 20, y)
                y += 10

                doc.setFontSize(11)
                doc.setTextColor(60, 60, 60)
                items.forEach(item => {
                    const lines = doc.splitTextToSize(`• ${item}`, 170)
                    if (y + lines.length * 7 > 280) { doc.addPage(); y = 20 }
                    doc.text(lines, 20, y)
                    y += lines.length * 7
                })
                y += 10
            }

            addSection('Key Capabilities', selectedRelease.highlights)
            addSection('System Quality Improvements', selectedRelease.fixes)

            doc.save(`Release_Brief_${selectedRelease.version}.pdf`)
        } catch (err) {
            console.error('PDF Generation Error:', err)
            alert('Failed to generate PDF.')
        } finally {
            setPdfGenerating(false)
        }
    }

    if (loading) return <div className="stakeholder-release-page">Loading Executive View...</div>
    if (error) return <div className="stakeholder-release-page"><div className="stakeholder-error-banner">{error}</div></div>

    return (
        <div className="stakeholder-release-page">

            {/* Header Block */}
            <header className="stakeholder-header-block">
                <div className="stakeholder-header-content">
                    <h1>Executive Release Briefing</h1>
                    <p>High-level overview of system evolution, strategic capabilities, and operational impact.</p>
                </div>
                <div className="stakeholder-header-actions">
                    <button className="stakeholder-btn secondary" disabled>
                        <Users size={16} style={{ marginRight: 8 }} /> Stakeholder View
                    </button>
                </div>
            </header>

            {/* KPI Strip */}
            <section className="stakeholder-kpi-strip">
                <div className="stakeholder-kpi-card">
                    <span className="stakeholder-kpi-label">Release Velocity</span>
                    <span className="stakeholder-kpi-value">{MOCK_KPIS.velocity.value}</span>
                    <span className="stakeholder-kpi-trend positive"><TrendingUp size={14} /> {MOCK_KPIS.velocity.trend}</span>
                </div>
                <div className="stakeholder-kpi-card">
                    <span className="stakeholder-kpi-label">Features Delivered</span>
                    <span className="stakeholder-kpi-value">{MOCK_KPIS.features.value}</span>
                    <span className="stakeholder-kpi-trend neutral"><Activity size={14} /> {MOCK_KPIS.features.trend}</span>
                </div>
                <div className="stakeholder-kpi-card">
                    <span className="stakeholder-kpi-label">System Quality</span>
                    <span className="stakeholder-kpi-value">{MOCK_KPIS.quality.value}</span>
                    <span className="stakeholder-kpi-trend positive"><CheckCircle size={14} /> {MOCK_KPIS.quality.trend}</span>
                </div>
                <div className="stakeholder-kpi-card">
                    <span className="stakeholder-kpi-label">User Adoption</span>
                    <span className="stakeholder-kpi-value">{MOCK_KPIS.adoption.value}</span>
                    <span className="stakeholder-kpi-trend positive"><Users size={14} /> {MOCK_KPIS.adoption.trend}</span>
                </div>
            </section>

            {/* Timeline Navigation */}
            <section className="stakeholder-timeline-track" ref={timelineRef}>
                <div className="stakeholder-timeline-scroll">
                    {releases.map((rel) => (
                        <div
                            key={rel.id}
                            className={`stakeholder-timeline-node ${selectedReleaseId === rel.id ? 'active' : ''}`}
                            onClick={() => setSelectedReleaseId(rel.id)}
                        >
                            <span className={`stakeholder-node-tag ${rel.type}`}>{rel.type}</span>
                            <div className="stakeholder-node-marker"></div>
                            <span className="stakeholder-node-version">v{rel.version}</span>
                            <span className="stakeholder-node-date">{rel.displayDate}</span>
                            {rel.title && <span className="stakeholder-node-title">{rel.title}</span>}
                            <div className="stakeholder-timeline-line"></div>
                        </div>
                    ))}
                </div>
            </section>

            {/* Main Content Grid */}
            <main className="stakeholder-content-grid">

                {/* Review Sidebar */}
                <aside className="stakeholder-release-sidebar">
                    <span className="stakeholder-release-badge">Currently Viewing</span>
                    <h2 className="stakeholder-sidebar-title">v{selectedRelease?.version}</h2>
                    {selectedRelease?.title && <p className="stakeholder-sidebar-release-name">{selectedRelease.title}</p>}
                    {selectedRelease?.description && <p className="stakeholder-sidebar-description">{selectedRelease.description}</p>}
                    <div className="stakeholder-sidebar-date">
                        <Calendar size={16} /> {selectedRelease?.displayDate}
                    </div>

                    <div className="stakeholder-sidebar-stats">
                        <div className="stakeholder-stat-row">
                            <span className="stakeholder-stat-label">Impact Items</span>
                            <span className="stakeholder-stat-val">{selectedRelease?.highlights?.length || 0}</span>
                        </div>
                        <div className="stakeholder-stat-row">
                            <span className="stakeholder-stat-label">Fixes</span>
                            <span className="stakeholder-stat-val">{selectedRelease?.fixes?.length || 0}</span>
                        </div>
                        <div className="stakeholder-stat-row">
                            <span className="stakeholder-stat-label">Type</span>
                            <span className="stakeholder-stat-val" style={{ textTransform: 'capitalize' }}>{selectedRelease?.type}</span>
                        </div>
                    </div>

                    <button
                        className="stakeholder-download-btn"
                        onClick={handleDownloadPdf}
                        disabled={pdfGenerating}
                    >
                        {pdfGenerating ? 'Generating...' : (
                            <><Download size={16} /> Download Brief</>
                        )}
                    </button>
                </aside>

                {/* Impact Cards Grid */}
                <div className="stakeholder-impact-grid">
                    {impactCards.map((card, idx) => (
                        <article key={idx} className="stakeholder-impact-card">
                            <div className="stakeholder-card-header">
                                <div className="stakeholder-card-title">
                                    <div className="stakeholder-card-icon">{card.icon}</div>
                                    {card.title}
                                </div>
                                <span className={`stakeholder-impact-badge ${card.badgeClass}`}>{card.badge}</span>
                            </div>
                            <ul className="stakeholder-card-list">
                                {card.items.map((item, i) => (
                                    <li key={i} className="stakeholder-card-item">{item}</li>
                                ))}
                            </ul>
                        </article>
                    ))}

                    {/* Operational Link Card */}
                    <div className="stakeholder-ops-link">
                        <div className="stakeholder-ops-text">
                            <h4>View Operational Metrics</h4>
                            <p>Deep dive into claims data for this period.</p>
                        </div>
                        <Link to="/optimix/iks-insights" className="stakeholder-ops-btn">
                            Go to IKS Claims <ArrowRight size={14} style={{ display: 'inline', marginLeft: 4 }} />
                        </Link>
                    </div>
                </div>

            </main>
        </div>
    )
}

export default StakeholderReleaseNotes
