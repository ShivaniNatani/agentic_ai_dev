import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTheme } from '../../context/ThemeContext'
import './CommandPalette.css'

export default function CommandPalette() {
    const [isOpen, setIsOpen] = useState(false)
    const [query, setQuery] = useState('')
    const [selectedIndex, setSelectedIndex] = useState(0)
    const navigate = useNavigate()
    const { toggleTheme, theme } = useTheme()
    const inputRef = useRef(null)

    // Detect Platform for Hints (Mac vs Win)
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0
    const ctrlKey = isMac ? '⌘' : 'Ctrl'

    // ACTIONS DEFINITION
    const actions = [
        // Navigation
        { id: 'nav-dash', title: 'Go to Dashboard', group: 'Navigation', icon: '🏠', action: () => navigate('/') },
        { id: 'nav-agents', title: 'Viewing Agents', group: 'Navigation', icon: '🤖', action: () => navigate('/agents') },
        { id: 'nav-projects', title: 'Projects Overview', group: 'Navigation', icon: '📂', action: () => navigate('/projects') },
        { id: 'nav-releases', title: 'Release Notes', group: 'Navigation', icon: '🚀', action: () => navigate('/releases') },
        { id: 'nav-sandbox', title: 'AI Sandbox', group: 'Navigation', icon: '⚡', action: () => navigate('/sandbox') },

        // System / Tools
        { id: 'sys-theme', title: `Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`, group: 'System', icon: theme === 'dark' ? '☀️' : '🌙', action: () => toggleTheme() },
        { id: 'sys-reload', title: 'Reload Application', group: 'System', icon: '🔄', action: () => window.location.reload() },

        // Projects (Quick Jump) - In a real app, this would be dynamic
        { id: 'proj-ortho', title: 'Open OrthoNY Project', group: 'Projects', icon: '🦴', action: () => navigate('/projects/orthony') },
        { id: 'proj-cdphp', title: 'Open CDPHP Payer', group: 'Projects', icon: '🏥', action: () => navigate('/projects/cdphp') },
    ]

    // Filter Actions
    const filteredActions = actions.filter(action =>
        action.title.toLowerCase().includes(query.toLowerCase()) ||
        action.group.toLowerCase().includes(query.toLowerCase())
    )

    // Keyboard Listener
    useEffect(() => {
        const handleKeyDown = (e) => {
            // Toggle Command Palette (Cmd+K or Ctrl+K)
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault()
                setIsOpen(prev => !prev)
                setQuery('')
                setSelectedIndex(0)
            }

            // Navigation within Palette
            if (isOpen) {
                if (e.key === 'ArrowDown') {
                    e.preventDefault()
                    setSelectedIndex(prev => (prev + 1) % filteredActions.length)
                } else if (e.key === 'ArrowUp') {
                    e.preventDefault()
                    setSelectedIndex(prev => (prev - 1 + filteredActions.length) % filteredActions.length)
                } else if (e.key === 'Enter') {
                    e.preventDefault()
                    if (filteredActions[selectedIndex]) {
                        filteredActions[selectedIndex].action()
                        setIsOpen(false)
                    }
                } else if (e.key === 'Escape') {
                    e.preventDefault()
                    setIsOpen(false)
                }
            }
        }

        // Allow external components to open the palette via custom event
        const handleOpenPalette = () => {
            setIsOpen(true)
            setQuery('')
            setSelectedIndex(0)
        }

        window.addEventListener('keydown', handleKeyDown)
        window.addEventListener('open-command-palette', handleOpenPalette)
        return () => {
            window.removeEventListener('keydown', handleKeyDown)
            window.removeEventListener('open-command-palette', handleOpenPalette)
        }
    }, [isOpen, filteredActions, selectedIndex])

    // Auto-focus input when opened
    useEffect(() => {
        if (isOpen && inputRef.current) {
            setTimeout(() => inputRef.current.focus(), 50)
        }
    }, [isOpen])

    if (!isOpen) return null

    return (
        <div className="cmd-palette-overlay" onClick={() => setIsOpen(false)}>
            <div className="cmd-palette-modal" onClick={e => e.stopPropagation()}>
                {/* Search Bar */}
                <div className="cmd-palette-search">
                    <span className="cmd-search-icon">🔎</span>
                    <input
                        ref={inputRef}
                        type="text"
                        className="cmd-input"
                        placeholder="Type a command or search..."
                        value={query}
                        onChange={e => {
                            setQuery(e.target.value)
                            setSelectedIndex(0)
                        }}
                    />
                    <span className="cmd-esc-hint">ESC</span>
                </div>

                {/* Results */}
                <div className="cmd-palette-results">
                    {filteredActions.length > 0 ? (
                        <>
                            {['Navigation', 'System', 'Projects'].map(group => {
                                const groupItems = filteredActions.filter(a => a.group === group)
                                if (groupItems.length === 0) return null
                                return (
                                    <div key={group}>
                                        <div className="cmd-group-title">{group}</div>
                                        {groupItems.map(action => {
                                            const index = filteredActions.indexOf(action)
                                            return (
                                                <div
                                                    key={action.id}
                                                    className={`cmd-item ${index === selectedIndex ? 'selected' : ''}`}
                                                    onClick={() => {
                                                        action.action()
                                                        setIsOpen(false)
                                                    }}
                                                    onMouseEnter={() => setSelectedIndex(index)}
                                                >
                                                    <div className="cmd-item-left">
                                                        <div className="cmd-item-icon">{action.icon}</div>
                                                        <span className="cmd-item-label">{action.title}</span>
                                                    </div>
                                                    {action.id.startsWith('sys') && (
                                                        <span className="cmd-item-shortcut">Enter</span>
                                                    )}
                                                </div>
                                            )
                                        })}
                                    </div>
                                )
                            })}
                        </>
                    ) : (
                        <div className="cmd-empty">
                            No results found for "{query}"
                        </div>
                    )}
                </div>

                {/* Footer (Optional hints) */}
                <div style={{ padding: '8px 16px', background: 'var(--glass-bg)', borderTop: '1px solid var(--glass-border)', fontSize: '10px', color: 'var(--text-muted)', display: 'flex', gap: '12px' }}>
                    <span>Select <strong style={{ color: 'var(--text-primary)' }}>↵</strong></span>
                    <span>Navigate <strong style={{ color: 'var(--text-primary)' }}>↑↓</strong></span>
                </div>
            </div>
        </div>
    )
}
