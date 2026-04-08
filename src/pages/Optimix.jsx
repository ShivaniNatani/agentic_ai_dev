import { useState, useEffect, useCallback } from 'react'
import {
    AreaChart,
    Area,
    BarChart,
    Bar,
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell
} from 'recharts'
import OptimixIKSInsights from './OptimixIKSInsights'
import PayerResponseAnalytics from './PayerResponseAnalytics'
import './Optimix.css'

const COLORS = ['#00D4AA', '#7C3AED', '#F59E0B', '#EF4444', '#3B82F6', '#10B981']

// ─── DS Inventory fallback mock (shown when API is unavailable) ───────────────
const makeDailyRow = (date, base) => ({
    date,
    total_open_claims: Math.round(base * 1.4),
    workable_claims: base,
    cash_collected_today: base * 12,
    sar_worked_today: base * 18,
    claims_worked_today: Math.round(base * 0.8),
    workable_claims_backlog: Math.round(base * 0.35),
    workable_sar_backlog: base * 0.35 * 18,
})
const DS_INVENTORY_MOCK = {
    GIA: [
        makeDailyRow('2026-03-11', 3200),
        makeDailyRow('2026-03-12', 3350),
        makeDailyRow('2026-03-13', 3180),
        makeDailyRow('2026-03-14', 3420),
        makeDailyRow('2026-03-17', 3510),
    ]
}
const DS_SUMMARY_MOCK = {
    GIA: {
        latest_date: '2026-03-17',
        total_open_claims: 4914,
        model_eligible_claims: 4200,
        workable_claims: 3510,
        workable_sar: 63180,
        pct_inventory_workable: 0.714,
        pct_sar_workable: 0.701,
        workable_claims_backlog: 1228,
        workable_sar_backlog: 22104,
        cash_collected_today: 42120,
        sar_worked_today: 63180,
        claims_worked_today: 2808,
        expected_cash: 38500,
        burn_rate: 0.35,
        trends: { cash_collected_change: 4.2, claims_worked_change: 2.8 },
    }
}

function Optimix({ initialTab = 'inventory' }) {
    const [activeModule, setActiveModule] = useState(() => {
        if (initialTab === 'claims' || initialTab === 'inventory') return initialTab
        return localStorage.getItem('optimix-module') || 'inventory'
    })
    const [selectedClient, setSelectedClient] = useState(() => localStorage.getItem('optimix-client') || 'GIA')
    const [viewMode, setViewMode] = useState(() => localStorage.getItem('optimix-view') || 'graphs') // default to graphs
    const [data, setData] = useState({ GIA: [] })
    const [summary, setSummary] = useState(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const [lastUpdated, setLastUpdated] = useState(null)
    const [inventoryOpen, setInventoryOpen] = useState(true)
    const [throughputOpen, setThroughputOpen] = useState(true)

    const fetchData = useCallback(async (refresh = false) => {
        try {
            setLoading(true)
            setError(null)

            const [dataRes, summaryRes] = await Promise.all([
                fetch(`/api/optimix/data${refresh ? '?refresh=true' : ''}`),
                fetch('/api/optimix/summary')
            ])

            if (!dataRes.ok || !summaryRes.ok) {
                throw new Error('Failed to fetch data')
            }

            const dataJson = await dataRes.json()
            const summaryJson = await summaryRes.json()

            setData(dataJson.clients || { GIA: [] })
            setSummary(summaryJson.clients || {})
            setLastUpdated(dataJson.last_updated)
        } catch (err) {
            console.warn('DS Inventory API unavailable, using mock data:', err.message)
            setData(DS_INVENTORY_MOCK)
            setSummary(DS_SUMMARY_MOCK)
            setLastUpdated(new Date().toISOString())
            setError('')
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        fetchData()
        // Poll every 5 minutes
        const interval = setInterval(() => fetchData(), 5 * 60 * 1000)
        return () => clearInterval(interval)
    }, [fetchData])

    useEffect(() => {
        if (initialTab === 'claims' || initialTab === 'inventory') {
            setActiveModule(initialTab)
        }
    }, [initialTab])

    const handleRefresh = () => {
        fetchData(true)
    }

    const updateClient = (client) => {
        setSelectedClient(client)
        localStorage.setItem('optimix-client', client)
    }

    const updateView = (mode) => {
        setViewMode(mode)
        localStorage.setItem('optimix-view', mode)
    }

    const updateModule = (module) => {
        setActiveModule(module)
        localStorage.setItem('optimix-module', module)
    }

    const formatCurrency = (value) => {
        if (value === null || value === undefined) return '-'
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(value)
    }

    const formatNumber = (value) => {
        if (value === null || value === undefined) return '-'
        return new Intl.NumberFormat('en-US').format(value)
    }

    const formatPercent = (value) => {
        if (value === null || value === undefined) return '-'
        return `${(value * 100).toFixed(1)}%`
    }

    const getClientData = () => {
        return data['GIA'] || []
    }

    const getClientSummary = (client) => {
        return summary?.[client] || {}
    }

    const renderKPICard = (title, value, change, format = 'number', icon = '📊') => {
        const formattedValue = format === 'currency' ? formatCurrency(value)
            : format === 'percent' ? formatPercent(value)
                : formatNumber(value)

        const changeClass = change > 0 ? 'positive' : change < 0 ? 'negative' : ''

        return (
            <div className="optimix-kpi-card">
                <div className="kpi-icon">{icon}</div>
                <div className="kpi-content">
                    <div className="kpi-title">{title}</div>
                    <div className="kpi-value">{formattedValue}</div>
                    {change !== null && change !== undefined && (
                        <div className={`kpi-change ${changeClass}`}>
                            {change > 0 ? '↑' : change < 0 ? '↓' : '→'} {Math.abs(change)}
                        </div>
                    )}
                </div>
            </div>
        )
    }

    const renderClientSection = (client) => {
        const clientSummary = getClientSummary(client)
        const clientData = data[client] || []

        if (!clientData.length) {
            return (
                <div className="optimix-client-section">
                    <h3 className="client-title">{client}</h3>
                    <div className="no-data">No data available</div>
                </div>
            )
        }

        return (
            <div className="optimix-client-section">
                <h3 className="client-title">
                    <span className={`client-badge ${client.toLowerCase()}`}>{client}</span>
                    <span className="client-date">Latest: {clientSummary.latest_date || 'N/A'}</span>
                </h3>

                {/* KPI Cards or Graphs */}
                {viewMode === 'cards' ? (
                    <>
                        <div className="optimix-ribbon">
                            {renderKPICard('Open Claims', clientSummary.total_open_claims, null, 'number', '📋')}
                            {renderKPICard('Workable Claims', clientSummary.workable_claims, null, 'number', '⚡')}
                            {renderKPICard('Cash Today', clientSummary.cash_collected_today, clientSummary.trends?.cash_collected_change, 'currency', '🏦')}
                            {renderKPICard('Burn Rate', clientSummary.burn_rate, null, 'number', '🔥')}
                        </div>

                        <div className="kpi-group">
                            <div className="kpi-group-header" onClick={() => setInventoryOpen(!inventoryOpen)}>
                                <span>Inventory</span>
                                <span>{inventoryOpen ? '▾' : '▸'}</span>
                            </div>
                            {inventoryOpen && (
                                <div className="optimix-kpi-grid compact">
                                    {renderKPICard('Total Open Claims', clientSummary.total_open_claims, null, 'number', '📋')}
                                    {renderKPICard('Total Open $AR', clientSummary.total_open_sar, null, 'currency', '💰')}
                                    {renderKPICard('Model-Eligible Claims', clientSummary.model_eligible_claims, null, 'number', '🤖')}
                                    {renderKPICard('Model-Eligible $AR', clientSummary.model_eligible_sar, null, 'currency', '🧠')}
                                    {renderKPICard('Workable Claims', clientSummary.workable_claims, null, 'number', '⚡')}
                                    {renderKPICard('Workable $AR', clientSummary.workable_sar, null, 'currency', '💵')}
                                    {renderKPICard('% Inventory Workable', clientSummary.pct_inventory_workable, null, 'percent', '📈')}
                                    {renderKPICard('% $AR Workable', clientSummary.pct_sar_workable, null, 'percent', '📊')}
                                    {renderKPICard('Workable Claims Backlog', clientSummary.workable_claims_backlog, null, 'number', '📦')}
                                    {renderKPICard('Workable $ Backlog', clientSummary.workable_sar_backlog, null, 'currency', '💼')}
                                </div>
                            )}
                        </div>

                        <div className="kpi-group">
                            <div className="kpi-group-header" onClick={() => setThroughputOpen(!throughputOpen)}>
                                <span>Throughput & Yield</span>
                                <span>{throughputOpen ? '▾' : '▸'}</span>
                            </div>
                            {throughputOpen && (
                                <div className="optimix-kpi-grid compact">
                                    {renderKPICard('Claims Worked Today', clientSummary.claims_worked_today,
                                        clientSummary.trends?.claims_worked_change, 'number', '✅')}
                                    {renderKPICard('$AR Worked Today', clientSummary.sar_worked_today, null, 'currency', '🛠️')}
                                    {renderKPICard('Cash Collected', clientSummary.cash_collected_today,
                                        clientSummary.trends?.cash_collected_change, 'currency', '🏦')}
                                    {renderKPICard('Expected Cash (Worked Claims)', clientSummary.expected_cash, null, 'currency', '🔮')}
                                    {renderKPICard('Workable Inventory Burn Rate', clientSummary.burn_rate, null, 'number', '🔥')}
                                </div>
                            )}
                        </div>
                    </>
                ) : (
                    <div className="optimix-mini-charts">
                        <div className="mini-chart-card">
                            <h4>Claims vs Workable</h4>
                            <ResponsiveContainer width="100%" height={180}>
                                <LineChart data={clientData}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                                    <XAxis dataKey="date" stroke="#888" fontSize={11} />
                                    <YAxis stroke="#888" fontSize={11} />
                                    <Tooltip />
                                    <Legend />
                                    <Line type="monotone" dataKey="total_open_claims" stroke="#00D4AA" name="Total Open" />
                                    <Line type="monotone" dataKey="workable_claims" stroke="#7C3AED" name="Workable" />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                        <div className="mini-chart-card">
                            <h4>$AR vs Workable $AR</h4>
                            <ResponsiveContainer width="100%" height={180}>
                                <LineChart data={clientData}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                                    <XAxis dataKey="date" stroke="#888" fontSize={11} />
                                    <YAxis stroke="#888" fontSize={11} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}K`} />
                                    <Tooltip formatter={(v) => formatCurrency(v)} />
                                    <Legend />
                                    <Line type="monotone" dataKey="total_open_sar" stroke="#F59E0B" name="Total $AR" />
                                    <Line type="monotone" dataKey="workable_sar" stroke="#EF4444" name="Workable $AR" />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                        <div className="mini-chart-card">
                            <h4>Cash & $AR Worked</h4>
                            <ResponsiveContainer width="100%" height={180}>
                                <BarChart data={clientData}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                                    <XAxis dataKey="date" stroke="#888" fontSize={11} />
                                    <YAxis stroke="#888" fontSize={11} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}K`} />
                                    <Tooltip formatter={(v) => formatCurrency(v)} />
                                    <Legend />
                                    <Bar dataKey="sar_worked_today" fill="#10B981" name="$AR Worked" />
                                    <Bar dataKey="cash_collected_today" fill="#6366F1" name="Cash Collected" />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                        <div className="mini-chart-card">
                            <h4>Efficiency & Burn</h4>
                            <ResponsiveContainer width="100%" height={180}>
                                <LineChart data={clientData}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                                    <XAxis dataKey="date" stroke="#888" fontSize={11} />
                                    <YAxis stroke="#888" fontSize={11} />
                                    <Tooltip formatter={(v, name) => name.includes('%') ? formatPercent(v) : formatNumber(v)} />
                                    <Legend />
                                    <Line type="monotone" dataKey="pct_inventory_workable" stroke="#22D3EE" name="% Inventory Workable" />
                                    <Line type="monotone" dataKey="pct_sar_workable" stroke="#F472B6" name="% $AR Workable" />
                                    <Line type="monotone" dataKey="burn_rate" stroke="#F97316" name="Burn Rate" />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                )}

                {/* Charts */}
                <div className="optimix-charts-grid">
                    {/* Claims Trend Chart */}
                    <div className="optimix-chart-card">
                        <h4>Claims Trend</h4>
                        <ResponsiveContainer width="100%" height={250}>
                            <AreaChart data={clientData}>
                                <defs>
                                    <linearGradient id={`colorClaims${client}`} x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#00D4AA" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#00D4AA" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                                <XAxis dataKey="date" stroke="#888" fontSize={12} />
                                <YAxis stroke="#888" fontSize={12} />
                                <Tooltip
                                    contentStyle={{
                                        backgroundColor: 'rgba(30, 30, 50, 0.95)',
                                        border: '1px solid rgba(255,255,255,0.1)',
                                        borderRadius: '8px'
                                    }}
                                />
                                <Area
                                    type="monotone"
                                    dataKey="total_open_claims"
                                    stroke="#00D4AA"
                                    fill={`url(#colorClaims${client})`}
                                    name="Total Open Claims"
                                />
                                <Area
                                    type="monotone"
                                    dataKey="workable_claims"
                                    stroke="#7C3AED"
                                    fill="rgba(124, 58, 237, 0.2)"
                                    name="Workable Claims"
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>

                    {/* $AR Trend Chart */}
                    <div className="optimix-chart-card">
                        <h4>$AR Trend</h4>
                        <ResponsiveContainer width="100%" height={250}>
                            <LineChart data={clientData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                                <XAxis dataKey="date" stroke="#888" fontSize={12} />
                                <YAxis stroke="#888" fontSize={12} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}K`} />
                                <Tooltip
                                    contentStyle={{
                                        backgroundColor: 'rgba(30, 30, 50, 0.95)',
                                        border: '1px solid rgba(255,255,255,0.1)',
                                        borderRadius: '8px'
                                    }}
                                    formatter={(value) => formatCurrency(value)}
                                />
                                <Line
                                    type="monotone"
                                    dataKey="total_open_sar"
                                    stroke="#F59E0B"
                                    strokeWidth={2}
                                    dot={{ fill: '#F59E0B', strokeWidth: 2 }}
                                    name="Total Open $AR"
                                />
                                <Line
                                    type="monotone"
                                    dataKey="workable_sar"
                                    stroke="#EF4444"
                                    strokeWidth={2}
                                    dot={{ fill: '#EF4444', strokeWidth: 2 }}
                                    name="Workable $AR"
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>

                    {/* Daily Activity Bar Chart */}
                    <div className="optimix-chart-card">
                        <h4>Daily Activity</h4>
                        <ResponsiveContainer width="100%" height={250}>
                            <BarChart data={clientData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                                <XAxis dataKey="date" stroke="#888" fontSize={12} />
                                <YAxis stroke="#888" fontSize={12} />
                                <Tooltip
                                    contentStyle={{
                                        backgroundColor: 'rgba(30, 30, 50, 0.95)',
                                        border: '1px solid rgba(255,255,255,0.1)',
                                        borderRadius: '8px'
                                    }}
                                />
                                <Legend />
                                <Bar dataKey="claims_worked_today" fill="#00D4AA" name="Claims Worked" />
                                <Bar dataKey="sar_worked_today" fill="#7C3AED" name="$AR Worked" />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>

                    {/* Backlog Chart */}
                    <div className="optimix-chart-card">
                        <h4>Backlog (EOD)</h4>
                        <ResponsiveContainer width="100%" height={250}>
                            <AreaChart data={clientData}>
                                <defs>
                                    <linearGradient id={`colorBacklog${client}`} x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#EF4444" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#EF4444" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                                <XAxis dataKey="date" stroke="#888" fontSize={12} />
                                <YAxis stroke="#888" fontSize={12} />
                                <Tooltip
                                    contentStyle={{
                                        backgroundColor: 'rgba(30, 30, 50, 0.95)',
                                        border: '1px solid rgba(255,255,255,0.1)',
                                        borderRadius: '8px'
                                    }}
                                />
                                <Area
                                    type="monotone"
                                    dataKey="workable_claims_backlog"
                                    stroke="#EF4444"
                                    fill={`url(#colorBacklog${client})`}
                                    name="Workable Claims Backlog"
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>
        )
    }

    if (activeModule === 'inventory' && loading && !data.GIA?.length && !data.AXIA?.length) {
        return (
            <div className="optimix-container">
                <div className="optimix-loading">
                    <div className="loading-spinner"></div>
                    <p>Loading Optimix data...</p>
                </div>
            </div>
        )
    }

    return (
        <div className="optimix-container">
            {/* Header */}
            <div className="optimix-header">
                <div className="optimix-title">
                    <h1>🎯 Optimix Dashboard</h1>
                    <p>
                        {activeModule === 'inventory'
                            ? 'Daily DS Inventory Tracking for GIA'
                            : activeModule === 'claims' 
                                ? 'IKS claim insights with prediction quality, calendar view, and trend analytics'
                                : 'Payer Response speed and payment forecasting metrics'}
                    </p>
                </div>
                <div className="optimix-controls">
                    <div className="module-selector">
                        <button
                            className={activeModule === 'inventory' ? 'active' : ''}
                            onClick={() => updateModule('inventory')}
                        >
                            DS Inventory
                        </button>
                        <button
                            className={activeModule === 'claims' ? 'active' : ''}
                            onClick={() => updateModule('claims')}
                        >
                            IKS Claims
                        </button>
                        <button
                            className={activeModule === 'payer-response' ? 'active' : ''}
                            onClick={() => updateModule('payer-response')}
                        >
                            Payer Response
                        </button>
                    </div>

                    {activeModule === 'inventory' && (
                        <>
                            <div className="view-toggle">
                                <button
                                    className={viewMode === 'cards' ? 'active' : ''}
                                    onClick={() => updateView('cards')}
                                >
                                    KPI Cards
                                </button>
                                <button
                                    className={viewMode === 'graphs' ? 'active' : ''}
                                    onClick={() => updateView('graphs')}
                                >
                                    KPI Graphs
                                </button>
                            </div>
                            <button className="refresh-btn" onClick={handleRefresh} disabled={loading}>
                                {loading ? '⏳ Refreshing...' : '🔄 Refresh Data'}
                            </button>
                        </>
                    )}
                </div>
            </div>

            {activeModule === 'inventory' ? (
                <>
                    {/* Last Updated */}
                    {lastUpdated && (
                        <div className="optimix-last-updated">
                            Last updated: {new Date(lastUpdated).toLocaleString()}
                        </div>
                    )}

                    {/* Error Display */}
                    {error && (
                        <div className="optimix-error">
                            ⚠️ {error}
                        </div>
                    )}

                    {/* Client Sections */}
                    <div className="optimix-content">
                        {renderClientSection('GIA')}
                    </div>
                </>
            ) : activeModule === 'claims' ? (
                <div className="optimix-claims-section">
                    <OptimixIKSInsights embedded />
                </div>
            ) : (
                <div className="optimix-payer-section">
                    <PayerResponseAnalytics embedded />
                </div>
            )}
        </div>
    )
}

export default Optimix
