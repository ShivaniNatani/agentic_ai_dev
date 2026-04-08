import { createContext, useContext, useState, useEffect, useCallback } from 'react'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null)
    const [isLoading, setIsLoading] = useState(true)

    const [mfaPending, setMfaPending] = useState(false)
    const [pendingUser, setPendingUser] = useState(null)
    const [useLDAP, setUseLDAP] = useState(true)

    useEffect(() => {
        // No auto-login
        localStorage.removeItem('iks_user')
        setIsLoading(false)
    }, [])

    // Fetch dynamic permissions from Access Control server given an email
    const fetchUserPermissions = async (email) => {
        try {
            const res = await fetch(`/api/access-control/check?email=${encodeURIComponent(email)}`);
            if (!res.ok) throw new Error('Access control server error');
            const data = await res.json();
            
            if (!data.allowed) {
                return { success: false, error: `Access Denied: ${data.reason}` };
            }
            return { success: true, role: data.role, permissions: data.permissions };
        } catch (error) {
            console.error('Error fetching permissions:', error);
            return { success: false, error: 'Could not verify access permissions. Is the access server running?' };
        }
    };

    // LDAP Login (Primary)
    const loginWithLDAP = useCallback(async (username, password) => {
        try {
            const controller = new AbortController()
            const id = setTimeout(() => controller.abort(), 5000)

            const response = await fetch('/api/auth/ldap', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password }),
                signal: controller.signal
            })
            clearTimeout(id)

            const data = await response.json()

            if (data.success && data.user) {
                const accessCheck = await fetchUserPermissions(data.user.email);
                if (!accessCheck.success) {
                    return { success: false, error: accessCheck.error };
                }

                const userData = {
                    ...data.user,
                    role: accessCheck.role,
                    roleLabel: accessCheck.role.toUpperCase(),
                    permissions: accessCheck.permissions,
                    canWrite: accessCheck.role === 'admin',
                    loginTime: new Date().toISOString()
                }
                
                fetch('/api/access-control/telemetry', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: data.user.email, action: 'login' })
                }).catch(() => {});

                setUser(userData)
                localStorage.setItem('iks_user', JSON.stringify(userData))
                return { success: true, mfaRequired: false }
            }

            return { success: false, error: data.error || 'LDAP authentication failed' }
        } catch (error) {
            console.error('LDAP error:', error)
            return { success: false, error: 'Unable to connect to authentication server' }
        }
    }, [])

    // Access Control Login (Fallback / External)
    const loginWithAccessControl = useCallback(async (username, password) => {
        try {
            // Assume username might be email, or construct an email if it's just a handle
            const email = username.includes('@') ? username : `${username}@ikshealth.com`;

            const res = await fetch('/api/access-control/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });
            const data = await res.json();

            if (data.success && data.user) {
                const userData = {
                    username: username,
                    displayName: username.split('@')[0], // derived display name
                    email: data.user.email,
                    avatar: username.substring(0,2).toUpperCase(),
                    role: data.user.role,
                    roleLabel: data.user.role.toUpperCase(),
                    permissions: data.permissions,
                    canWrite: data.user.role === 'admin',
                    authMethod: 'custom',
                    loginTime: new Date().toISOString()
                }
                
                fetch('/api/access-control/telemetry', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: data.user.email, action: 'login' })
                }).catch(() => {});

                setUser(userData)
                localStorage.setItem('iks_user', JSON.stringify(userData))
                return { success: true, mfaRequired: false }
            }

            return { success: false, error: data.message || 'Invalid external credentials' }
        } catch (error) {
            console.error('Access Control Login Error:', error);
            return { success: false, error: 'Unable to connect to Access Control center' };
        }
    }, []);

    const login = useCallback(async (username, password) => {
        // LOCAL DEVELOPMENT BYPASS
        const mockUser = {
            username: username || 'admin',
            displayName: 'Local Bypass',
            email: 'admin@ikshealth.com',
            avatar: 'DEV',
            role: 'admin',
            roleLabel: 'ADMIN',
            permissions: { pages: ['all'], projects: ['all'], clients: ['all'] },
            canWrite: true,
            authMethod: 'bypass',
            loginTime: new Date().toISOString()
        };
        setUser(mockUser);
        localStorage.setItem('iks_user', JSON.stringify(mockUser));
        return { success: true };
    }, [])

    const verifyMfa = useCallback((_code) => {
        return { success: true }
    }, [])

    const cancelMfa = useCallback(() => {
        setMfaPending(false)
        setPendingUser(null)
    }, [])

    const logout = useCallback(() => {
        setUser(null)
        setMfaPending(false)
        setPendingUser(null)
        localStorage.removeItem('iks_user')
    }, [])

    // Permission Checkers
    const hasPermission = useCallback((permission) => {
        if (!user || (!user.permissions && !user.permissions?.pages)) return false
        if (user.role === 'admin') return true; 
        return user.permissions.pages.includes(permission)
    }, [user])

    const hasProject = useCallback((project) => {
        if (!user || (!user.permissions && !user.permissions?.projects)) return false
        if (user.role === 'admin') return true;
        return user.permissions.projects.includes(project)
    }, [user])

    const hasClient = useCallback((client) => {
        if (!user || (!user.permissions && !user.permissions?.clients)) return false
        if (user.role === 'admin') return true;
        if (user.permissions.clients.includes('all')) return true;
        return user.permissions.clients.includes(client)
    }, [user])

    const value = {
        user,
        isLoading,
        isAuthenticated: !!user,
        mfaPending,
        pendingUser,
        useLDAP,
        setUseLDAP,
        login,
        loginWithLDAP,
        loginWithDemo: loginWithAccessControl, // map old demo func to new external custom login to fix Login screen quick buttons
        verifyMfa,
        cancelMfa,
        logout,
        hasPermission,
        hasProject,
        hasClient
    }

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    )
}

export const useAuth = () => {
    const context = useContext(AuthContext)
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider')
    }
    return context
}

export default AuthContext
