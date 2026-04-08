import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import Navbar from './components/Navbar'
import Hero from './components/Hero'
import Benefits from './components/Benefits'
import TransactionTypes from './components/TransactionTypes'
import WhyAddAPI from './components/WhyAddAPI'
import Testimonials from './components/Testimonials'
import GetStarted from './components/GetStarted'
import Footer from './components/Footer'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import ProjectOverview from './pages/ProjectOverview'
import AgentsLanding from './pages/AgentsLanding'
import AgentDetail from './pages/AgentDetail'
import Setup from './pages/Setup'
import Contact from './pages/Contact'
import ReleaseNotes from './pages/ReleaseNotes'
import StakeholderReleaseNotes from './pages/StakeholderReleaseNotes'
import ClientDashboard from './pages/ClientDashboard'
import Sandbox from './pages/Sandbox'
import Broadcast from './pages/Broadcast'
import About from './pages/About'

function HomePage() {
    return (
        <>
            <Hero />
            <Benefits />
            <TransactionTypes />
            <WhyAddAPI />
            <Testimonials />
            <GetStarted />
        </>
    )
}

function AppLayout({ children }) {
    return (
        <div className="app">
            <Navbar />
            <main>{children}</main>
            <Footer />
        </div>
    )
}

import { ThemeProvider } from './context/ThemeContext'

import CommandPalette from './components/CommandPalette/CommandPalette'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useLocation } from 'react-router-dom'
import { useAuth } from './context/AuthContext'

const queryClient = new QueryClient()

function TelemetryTracker() {
    const location = useLocation()
    const { user } = useAuth()
    
    useEffect(() => {
        if (user && user.email) {
            fetch('/api/access-control/telemetry', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: user.email, action: 'navigate', detail: location.pathname })
            }).catch(e => console.error('Telemetry failed:', e))
        }
    }, [location.pathname, user])
    return null
}

function App() {
    return (
        <AuthProvider>
            <ThemeProvider>
                <BrowserRouter>
                    <CommandPalette />
                    <TelemetryTracker />
                    <Routes>
                        {/* Public Routes */}
                        <Route path="/login" element={<Login />} />

                        {/* Protected Routes */}
                        <Route path="/" element={
                            <ProtectedRoute requiredPermission="dashboard">
                                <Navigate to="/dashboard" replace />
                            </ProtectedRoute>
                        } />
                        <Route path="/dashboard" element={
                            <ProtectedRoute requiredPermission="dashboard">
                                <AppLayout><Dashboard /></AppLayout>
                            </ProtectedRoute>
                        } />
                        <Route path="/dashboard/:view" element={
                            <ProtectedRoute requiredPermission="dashboard">
                                <AppLayout><Dashboard /></AppLayout>
                            </ProtectedRoute>
                        } />
                        <Route path="/project-overview" element={
                            <ProtectedRoute requiredPermission="project-overview">
                                <AppLayout><ProjectOverview /></AppLayout>
                            </ProtectedRoute>
                        } />
                        <Route path="/agents" element={
                            <ProtectedRoute requiredPermission="agents">
                                <AppLayout><AgentsLanding /></AppLayout>
                            </ProtectedRoute>
                        } />
                        <Route path="/agents/:agentId" element={
                            <ProtectedRoute requiredPermission="agents">
                                <AppLayout><AgentDetail /></AppLayout>
                            </ProtectedRoute>
                        } />
                        <Route path="/setup" element={
                            <ProtectedRoute requiredPermission="setup">
                                <AppLayout><Setup /></AppLayout>
                            </ProtectedRoute>
                        } />
                        <Route path="/contact" element={
                            <ProtectedRoute requiredPermission="contact">
                                <AppLayout><Contact /></AppLayout>
                            </ProtectedRoute>
                        } />
                        <Route path="/release-notes" element={
                            <ProtectedRoute requiredPermission="release-notes">
                                <AppLayout><ReleaseNotes /></AppLayout>
                            </ProtectedRoute>
                        } />
                        <Route path="/stakeholder-releases" element={
                            <ProtectedRoute requiredPermission="stakeholder-releases">
                                <AppLayout><StakeholderReleaseNotes /></AppLayout>
                            </ProtectedRoute>
                        } />
                        <Route path="/clients/:id" element={
                            <ProtectedRoute requiredPermission="clients">
                                <AppLayout><ClientDashboard /></AppLayout>
                            </ProtectedRoute>
                        } />
                        <Route path="/sandbox" element={
                            <ProtectedRoute requiredPermission="sandbox">
                                <AppLayout><Sandbox /></AppLayout>
                            </ProtectedRoute>
                        } />
                        <Route path="/about" element={
                            <ProtectedRoute requiredPermission="about">
                                <AppLayout><About /></AppLayout>
                            </ProtectedRoute>
                        } />
                        <Route path="/broadcast" element={
                            <ProtectedRoute requiredPermission="broadcast">
                                <Broadcast />
                            </ProtectedRoute>
                        } />

                        {/* Catch all - redirect to login */}
                        <Route path="*" element={<Navigate to="/login" replace />} />
                    </Routes>
                </BrowserRouter>
            </ThemeProvider>
        </AuthProvider>
    )
}

export default App
