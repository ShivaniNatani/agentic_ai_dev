import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

function ProtectedRoute({ children, requiredPermission, requiredProject, requiredClient }) {
    const { user, isLoading, hasPermission, hasProject, hasClient } = useAuth()

    if (isLoading) {
        return (
            <div className="loading-screen">
                <div className="loading-spinner"></div>
            </div>
        )
    }

    if (!user) {
        return <Navigate to="/login" replace />
    }

    // If a specific page permission is required, check it
    if (requiredPermission && !hasPermission(requiredPermission)) {
        if (requiredPermission === 'dashboard') {
            return (
                <div style={{ padding: '2rem', textAlign: 'center', color: '#ff4444' }}>
                    <h2>Access Denied</h2>
                    <p>You don't have permission to view this page. Please contact your administrator.</p>
                </div>
            )
        }
        return <Navigate to="/dashboard" replace />
    }

    // If a specific project permission is required
    if (requiredProject && !hasProject(requiredProject)) {
        return <Navigate to="/dashboard" replace />
    }

    // If a specific client permission is required
    if (requiredClient && !hasClient(requiredClient)) {
        return <Navigate to="/dashboard" replace />
    }

    return children
}

export default ProtectedRoute
