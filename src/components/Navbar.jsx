import { useState, useEffect, useRef } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import './Navbar.css'
import './Modals.css'

function Navbar() {
    const { user, logout, hasPermission } = useAuth()
    const { theme, toggleTheme } = useTheme()
    const location = useLocation()
    const navigate = useNavigate()
    const [isScrolled, setIsScrolled] = useState(false)
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
    const [isProfileOpen, setIsProfileOpen] = useState(false)
    const profileRef = useRef(null)

    // Modal states
    const [showProfileModal, setShowProfileModal] = useState(false)
    const [showPreferencesModal, setShowPreferencesModal] = useState(false)
    const [showHelpModal, setShowHelpModal] = useState(false)

    // Preference states
    const [notificationsEnabled, setNotificationsEnabled] = useState(true)
    const [emailUpdates, setEmailUpdates] = useState(true)

    // Navigation items with proper permission mapping
    // - Admin (permissions: 'all') sees everything
    // - MLOps (permissions: 'dashboard', 'mlops', 'alerts', 'system-health', 'release-notes')
    // - Agentic (permissions: 'dashboard', 'agents', 'sandbox', 'demos', 'release-notes')
    // - Developer (permissions: 'dashboard', 'agents', 'demos', 'api-docs', 'sandbox', 'release-notes')
    // - User (permissions: 'dashboard', 'agents', 'release-notes')
    const navItems = [
        { path: '/about', label: 'About IKS', icon: '🏢', permission: 'about' },
        { path: '/dashboard', label: 'Dashboard', icon: '📊', permission: 'dashboard' },
        { path: '/agents', label: 'AI Agents', icon: '🤖', permission: 'agents' },
        { path: '/project-overview', label: 'Projects', icon: '📁', permission: 'project-overview' },
        { path: '/sandbox', label: 'Sandbox', icon: '⚡', permission: 'sandbox' },
        { path: '/release-notes', label: 'Releases', icon: '📝', permission: 'release-notes' },
        { path: '/stakeholder-releases', label: 'Stakeholder', icon: '📣', permission: 'stakeholder-releases' },
    ]

    // Filter nav items based on permissions
    const visibleNavItems = navItems.filter(item => hasPermission(item.permission))

    // Scroll effect
    useEffect(() => {
        const handleScroll = () => {
            setIsScrolled(window.scrollY > 20)
        }
        window.addEventListener('scroll', handleScroll)
        return () => window.removeEventListener('scroll', handleScroll)
    }, [])

    // Close mobile menu on route change
    useEffect(() => {
        setIsMobileMenuOpen(false)
    }, [location.pathname])

    // Close profile dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (profileRef.current && !profileRef.current.contains(event.target)) {
                setIsProfileOpen(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    const handleLogout = () => {
        logout()
        navigate('/login')
    }

    const isActive = (path) => {
        if (path === '/dashboard') {
            return location.pathname === '/dashboard' || location.pathname.startsWith('/dashboard/')
        }
        return location.pathname === path || location.pathname.startsWith(path + '/')
    }

    const openModal = (modalType) => {
        setIsProfileOpen(false)
        if (modalType === 'profile') setShowProfileModal(true)
        if (modalType === 'preferences') setShowPreferencesModal(true)
        if (modalType === 'help') setShowHelpModal(true)
    }

    return (
        <>
            <header className={`navbar ${isScrolled ? 'navbar--scrolled' : ''}`}>
                <div className="navbar__container">
                    {/* Logo */}
                    <Link to="/dashboard" className="navbar__logo">
                        <div className="navbar__logo-icon">
                            <svg viewBox="0 0 40 40" fill="none">
                                <path
                                    d="M20 4L4 12v16l16 8 16-8V12L20 4z"
                                    stroke="url(#navLogoGradient)"
                                    strokeWidth="1.5"
                                    fill="none"
                                />
                                <path
                                    d="M20 12l-8 4v8l8 4 8-4v-8l-8-4z"
                                    fill="url(#navLogoGradient)"
                                    opacity="0.3"
                                />
                                <path
                                    d="M20 16l-4 2v4l4 2 4-2v-4l-4-2z"
                                    fill="url(#navLogoGradient)"
                                />
                                <defs>
                                    <linearGradient id="navLogoGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                                        <stop offset="0%" stopColor="#00f5d4" />
                                        <stop offset="100%" stopColor="#a855f7" />
                                    </linearGradient>
                                </defs>
                            </svg>
                        </div>
                        <span className="navbar__logo-text">
                            <span className="navbar__logo-iks">IKS</span>
                            <span className="navbar__logo-health">Health</span>
                        </span>
                    </Link>

                    {/* Desktop Navigation */}
                    <nav className="navbar__nav">
                        {visibleNavItems.map((item) => (
                            <Link
                                key={item.path}
                                to={item.path}
                                className={`navbar__link ${isActive(item.path) ? 'navbar__link--active' : ''}`}
                            >
                                <span className="navbar__link-icon">{item.icon}</span>
                                <span className="navbar__link-text">{item.label}</span>
                                {isActive(item.path) && <span className="navbar__link-indicator" />}
                            </Link>
                        ))}
                    </nav>

                    {/* Right Section */}
                    <div className="navbar__actions">
                        {/* Quick Search */}
                        <button className="navbar__search" aria-label="Search" onClick={() => window.dispatchEvent(new Event('open-command-palette'))}>
                            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
                                <circle cx="11" cy="11" r="8" />
                                <line x1="21" y1="21" x2="16.65" y2="16.65" />
                            </svg>
                            <span className="navbar__search-hint">⌘K</span>
                        </button>

                        {/* Notifications */}
                        <button className="navbar__notification" aria-label="Notifications">
                            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                            </svg>
                            <span className="navbar__notification-badge">3</span>
                        </button>

                        {/* Theme Toggle */}
                        <button onClick={toggleTheme} className="navbar__theme-toggle" aria-label="Toggle Theme">
                            <span style={{ fontSize: '1.2rem' }}>{theme === 'dark' ? '☀️' : '🌙'}</span>
                        </button>

                        {/* User Profile */}
                        <div className="navbar__profile" ref={profileRef}>
                            <button
                                className="navbar__profile-trigger"
                                onClick={() => setIsProfileOpen(!isProfileOpen)}
                                aria-expanded={isProfileOpen}
                            >
                                <div className="navbar__avatar">
                                    {user?.avatar || 'U'}
                                </div>
                                <div className="navbar__profile-info">
                                    <span className="navbar__profile-name">{user?.displayName || 'User'}</span>
                                    <span className="navbar__profile-role">{user?.roleLabel || 'Guest'}</span>
                                </div>
                                <svg
                                    className={`navbar__profile-chevron ${isProfileOpen ? 'navbar__profile-chevron--open' : ''}`}
                                    viewBox="0 0 24 24"
                                    width="16"
                                    height="16"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                >
                                    <polyline points="6 9 12 15 18 9" />
                                </svg>
                            </button>

                            {/* Profile Dropdown */}
                            {isProfileOpen && (
                                <div className="navbar__dropdown">
                                    <div className="navbar__dropdown-header">
                                        <div className="navbar__dropdown-avatar">
                                            {user?.avatar || 'U'}
                                        </div>
                                        <div className="navbar__dropdown-user">
                                            <span className="navbar__dropdown-name">{user?.displayName}</span>
                                            <span className="navbar__dropdown-email">{user?.email}</span>
                                        </div>
                                    </div>

                                    <div className="navbar__dropdown-divider" />

                                    {user?.clientName && (
                                        <>
                                            <div className="navbar__dropdown-item navbar__dropdown-item--info">
                                                <span className="navbar__dropdown-icon">🏥</span>
                                                <span>Client: {user.clientName}</span>
                                            </div>
                                            <div className="navbar__dropdown-divider" />
                                        </>
                                    )}

                                    <button className="navbar__dropdown-item" onClick={() => openModal('profile')}>
                                        <span className="navbar__dropdown-icon">👤</span>
                                        <span>Profile Settings</span>
                                    </button>
                                    <button className="navbar__dropdown-item" onClick={() => openModal('preferences')}>
                                        <span className="navbar__dropdown-icon">🎨</span>
                                        <span>Preferences</span>
                                    </button>
                                    <button className="navbar__dropdown-item" onClick={() => openModal('help')}>
                                        <span className="navbar__dropdown-icon">❓</span>
                                        <span>Help & Support</span>
                                    </button>

                                    <div className="navbar__dropdown-divider" />

                                    <button
                                        className="navbar__dropdown-item navbar__dropdown-item--danger"
                                        onClick={handleLogout}
                                    >
                                        <span className="navbar__dropdown-icon">🚪</span>
                                        <span>Sign Out</span>
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Mobile Menu Toggle */}
                        <button
                            className={`navbar__mobile-toggle ${isMobileMenuOpen ? 'navbar__mobile-toggle--open' : ''}`}
                            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                            aria-label="Toggle menu"
                        >
                            <span className="navbar__hamburger">
                                <span />
                                <span />
                                <span />
                            </span>
                        </button>
                    </div>
                </div>

                {/* Mobile Menu */}
                <div className={`navbar__mobile-menu ${isMobileMenuOpen ? 'navbar__mobile-menu--open' : ''}`}>
                    <nav className="navbar__mobile-nav">
                        {visibleNavItems.map((item) => (
                            <Link
                                key={item.path}
                                to={item.path}
                                className={`navbar__mobile-link ${isActive(item.path) ? 'navbar__mobile-link--active' : ''}`}
                                onClick={() => setIsMobileMenuOpen(false)}
                            >
                                <span className="navbar__mobile-icon">{item.icon}</span>
                                <span>{item.label}</span>
                            </Link>
                        ))}
                    </nav>

                    <div className="navbar__mobile-footer">
                        <button
                            className="navbar__mobile-logout"
                            onClick={handleLogout}
                        >
                            <span>🚪</span>
                            <span>Sign Out</span>
                        </button>
                    </div>
                </div>

                {/* Mobile Overlay */}
                {isMobileMenuOpen && (
                    <div
                        className="navbar__overlay"
                        onClick={() => setIsMobileMenuOpen(false)}
                    />
                )}
            </header>

            {/* Profile Settings Modal */}
            {showProfileModal && (
                <div className="modal-overlay" onClick={() => setShowProfileModal(false)}>
                    <div className="modal-container" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>👤 Profile Settings</h2>
                            <button className="modal-close" onClick={() => setShowProfileModal(false)}>×</button>
                        </div>
                        <div className="modal-body">
                            <div className="profile-info">
                                <div className="profile-avatar-large">{user?.avatar || 'U'}</div>
                                <div className="profile-details">
                                    <h3>{user?.displayName}</h3>
                                    <p>{user?.email}</p>
                                    <p>@{user?.username}</p>
                                    <span className="profile-role-badge">{user?.roleLabel}</span>
                                </div>
                            </div>
                            <div className="settings-section">
                                <h4>Account Information</h4>
                                <div className="settings-row">
                                    <div className="settings-row-label">
                                        <span className="settings-row-icon">📧</span>
                                        <span className="settings-row-text">Email</span>
                                    </div>
                                    <span style={{ color: 'var(--text-secondary)' }}>{user?.email}</span>
                                </div>
                                <div className="settings-row">
                                    <div className="settings-row-label">
                                        <span className="settings-row-icon">🔐</span>
                                        <span className="settings-row-text">Role</span>
                                    </div>
                                    <span style={{ color: 'var(--text-secondary)' }}>{user?.roleLabel}</span>
                                </div>
                                <div className="settings-row">
                                    <div className="settings-row-label">
                                        <span className="settings-row-icon">🕐</span>
                                        <span className="settings-row-text">Login Time</span>
                                    </div>
                                    <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                                        {user?.loginTime ? new Date(user.loginTime).toLocaleString() : '-'}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Preferences Modal */}
            {showPreferencesModal && (
                <div className="modal-overlay" onClick={() => setShowPreferencesModal(false)}>
                    <div className="modal-container" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>🎨 Preferences</h2>
                            <button className="modal-close" onClick={() => setShowPreferencesModal(false)}>×</button>
                        </div>
                        <div className="modal-body">
                            <div className="settings-section">
                                <h4>Appearance</h4>
                                <div className="settings-row">
                                    <div className="settings-row-label">
                                        <span className="settings-row-icon">{theme === 'dark' ? '🌙' : '☀️'}</span>
                                        <span className="settings-row-text">Dark Mode</span>
                                    </div>
                                    <div
                                        className={`toggle-switch ${theme === 'dark' ? 'active' : ''}`}
                                        onClick={toggleTheme}
                                    />
                                </div>
                            </div>
                            <div className="settings-section">
                                <h4>Notifications</h4>
                                <div className="settings-row">
                                    <div className="settings-row-label">
                                        <span className="settings-row-icon">🔔</span>
                                        <span className="settings-row-text">Push Notifications</span>
                                    </div>
                                    <div
                                        className={`toggle-switch ${notificationsEnabled ? 'active' : ''}`}
                                        onClick={() => setNotificationsEnabled(!notificationsEnabled)}
                                    />
                                </div>
                                <div className="settings-row">
                                    <div className="settings-row-label">
                                        <span className="settings-row-icon">📧</span>
                                        <span className="settings-row-text">Email Updates</span>
                                    </div>
                                    <div
                                        className={`toggle-switch ${emailUpdates ? 'active' : ''}`}
                                        onClick={() => setEmailUpdates(!emailUpdates)}
                                    />
                                </div>
                            </div>
                            <div className="settings-section">
                                <h4>Language</h4>
                                <div className="settings-row">
                                    <div className="settings-row-label">
                                        <span className="settings-row-icon">🌐</span>
                                        <span className="settings-row-text">Display Language</span>
                                    </div>
                                    <span style={{ color: 'var(--text-secondary)' }}>English (US)</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Help & Support Modal */}
            {showHelpModal && (
                <div className="modal-overlay" onClick={() => setShowHelpModal(false)}>
                    <div className="modal-container" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>❓ Help & Support</h2>
                            <button className="modal-close" onClick={() => setShowHelpModal(false)}>×</button>
                        </div>
                        <div className="modal-body">
                            <div className="help-section">
                                <h4>Frequently Asked Questions</h4>
                                <div className="faq-item">
                                    <h5>How do I switch between dashboards?</h5>
                                    <p>Use the toggle buttons on the main dashboard to switch between Agentic AI and MLOps views.</p>
                                </div>
                                <div className="faq-item">
                                    <h5>What is the MFA code?</h5>
                                    <p>For demo purposes, use <strong>123456</strong> as the MFA code when logging in.</p>
                                </div>
                                <div className="faq-item">
                                    <h5>How do I access AI Agents?</h5>
                                    <p>Navigate to the "AI Agents" tab in the top navigation to view and interact with available agents.</p>
                                </div>
                            </div>
                            <div className="help-section">
                                <h4>Contact Support</h4>
                                <a href="mailto:support@ikshealth.com" className="help-link">
                                    <span>📧</span>
                                    <span>support@ikshealth.com</span>
                                </a>
                                <a href="https://ikshealth.com/contact-us/" target="_blank" rel="noopener noreferrer" className="help-link">
                                    <span>🌐</span>
                                    <span>Contact Form</span>
                                </a>
                            </div>
                            <div className="help-section">
                                <h4>Resources</h4>
                                <Link to="/about" className="help-link" onClick={() => setShowHelpModal(false)}>
                                    <span>🏢</span>
                                    <span>About IKS Health</span>
                                </Link>
                                <a href="https://ikshealth.com/insights/" target="_blank" rel="noopener noreferrer" className="help-link">
                                    <span>📰</span>
                                    <span>News & Insights</span>
                                </a>
                            </div>
                            <div className="version-info">
                                IKS Health Dashboard v3.0.0
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    )
}

export default Navbar
