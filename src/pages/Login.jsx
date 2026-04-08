import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import './Login.css'

function Login() {
    const [username, setUsername] = useState('admin')
    const [password, setPassword] = useState('admin')
    const [showPassword, setShowPassword] = useState(false)
    const [error, setError] = useState('')
    const [isLoading, setIsLoading] = useState(false)

    const { login, isAuthenticated } = useAuth()
    const navigate = useNavigate()

    // Redirect if fully authenticated
    useEffect(() => {
        if (isAuthenticated) {
            navigate('/dashboard')
        }
    }, [isAuthenticated, navigate])



    // Handle credential submission (Step 1)
    const handleSubmit = async (e) => {
        e.preventDefault()
        setError('')
        setIsLoading(true)

        await new Promise(resolve => setTimeout(resolve, 800))

        const result = await login(username || 'user', password || 'user')
        if (!result.success) {
            setError(result.error)
            const form = document.querySelector('.login-card')
            form?.classList.add('shake')
            setTimeout(() => form?.classList.remove('shake'), 500)
        } else {
            navigate('/dashboard')
        }
        setIsLoading(false)
    }




    // Standard Login Screen (MFA removed)
    return (
        <div className="login-page">
            <div className="login-bg">
                <div className="login-bg-gradient"></div>
                <div className="login-bg-grid"></div>
                <div className="login-bg-orbs">
                    <div className="login-orb login-orb-1"></div>
                    <div className="login-orb login-orb-2"></div>
                </div>
            </div>

            <div className="login-container">
                <div className="login-branding">
                    <div className="login-branding-content">
                        <div className="login-logo">
                            <span className="login-logo-text">IKS Health</span>
                        </div>
                        <h1 className="login-headline">
                            <span className="login-headline-gradient">AI Agents</span>
                            <span className="login-headline-sub">Platform</span>
                        </h1>
                        <p className="login-tagline">
                            Transforming Healthcare Operations with Intelligent Automation
                        </p>
                    </div>
                </div>

                <div className="login-form-section">
                    <div className="login-card">
                        <div className="login-card-header">
                            <h2>Welcome Back</h2>
                            <p>Sign in to access your dashboard</p>
                        </div>

                        {error && (
                            <div className="login-error">
                                <span>{error}</span>
                            </div>
                        )}

                        <form className="login-form" onSubmit={handleSubmit}>
                            <div className="login-field">
                                <label htmlFor="username">Username</label>
                                <div className="login-input-wrapper">
                                    <input
                                        id="username"
                                        type="text"
                                        value={username}
                                        onChange={(e) => setUsername(e.target.value)}
                                        placeholder="Enter your username"
                                        required
                                        autoComplete="username"
                                    />
                                </div>
                            </div>

                            <div className="login-field">
                                <label htmlFor="password">Password</label>
                                <div className="login-input-wrapper">
                                    <input
                                        id="password"
                                        type={showPassword ? 'text' : 'password'}
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        placeholder="Enter your password"
                                        required
                                        autoComplete="current-password"
                                    />
                                    <button
                                        type="button"
                                        className="login-password-toggle"
                                        onClick={() => setShowPassword(!showPassword)}
                                    >
                                        {showPassword ? 'Hide' : 'Show'}
                                    </button>
                                </div>
                            </div>

                            <button
                                type="submit"
                                className="login-submit"
                                disabled={isLoading}
                            >
                                {isLoading ? <span className="login-spinner"></span> : 'Continue →'}
                            </button>
                        </form>


                    </div>
                </div>
            </div>
        </div>
    )
}

export default Login
