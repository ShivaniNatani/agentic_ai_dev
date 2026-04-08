import { Link } from 'react-router-dom'
import './Setup.css'

const setupSteps = [
    {
        id: 1,
        title: 'Prerequisites',
        icon: '📋',
        items: [
            'Node.js v18+ or Python 3.9+',
            'API credentials (obtain from admin portal)',
            'Network access to api.aiagents.com',
            'HIPAA-compliant environment for production',
            'SSL/TLS certificates for secure connections'
        ]
    },
    {
        id: 2,
        title: 'Installation',
        icon: '⚙️',
        code: `# Using npm
npm install @aiagents/sdk

# Using pip
pip install aiagents-sdk

# Using Docker
docker pull aiagents/sdk:latest`,
        language: 'bash'
    },
    {
        id: 3,
        title: 'Configuration',
        icon: '🔧',
        code: `// config.js
export const config = {
  apiKey: process.env.AIAGENTS_API_KEY,
  baseUrl: 'https://api.aiagents.com/v1',
  environment: 'production',
  timeout: 30000,
  retries: 3
};`,
        language: 'javascript'
    },
    {
        id: 4,
        title: 'Authentication Setup',
        icon: '🔐',
        code: `import { AIAgentsClient } from '@aiagents/sdk';

const client = new AIAgentsClient({
  apiKey: config.apiKey,
  // Or use OAuth2
  oauth: {
    clientId: 'your-client-id',
    clientSecret: 'your-client-secret',
    tokenUrl: 'https://auth.aiagents.com/token'
  }
});`,
        language: 'javascript'
    },
    {
        id: 5,
        title: 'First API Call',
        icon: '🚀',
        code: `// Submit a prior authorization request
const response = await client.priorAuth.submit({
  patient: {
    memberId: 'MEM123456789',
    firstName: 'John',
    lastName: 'Doe'
  },
  serviceRequest: {
    procedureCode: '27447',
    diagnosisCodes: ['M17.11']
  }
});

console.log(response.authorizationNumber);`,
        language: 'javascript'
    },
    {
        id: 6,
        title: 'EHR Integration',
        icon: '🏥',
        items: [
            'Configure EHR connection in admin portal',
            'Set up webhooks for real-time updates',
            'Map custom fields to standard schema',
            'Enable writeback for status updates',
            'Test with sandbox environment first'
        ]
    }
]

const systemRequirements = [
    { label: 'CPU', value: '4+ cores recommended' },
    { label: 'RAM', value: '8GB minimum, 16GB recommended' },
    { label: 'Storage', value: '10GB for SDK and logs' },
    { label: 'Network', value: '100Mbps+ stable connection' },
    { label: 'OS', value: 'Linux, macOS, Windows Server' }
]

function Setup() {
    return (
        <div className="setup">
            <section className="setup__hero">
                <div className="setup__hero-bg"></div>
                <div className="container">
                    <Link to="/agents" className="setup__back">
                        ← Back to Agents
                    </Link>
                    <h1 className="setup__title">
                        <span className="setup__icon">🛠️</span>
                        Setup & Installation
                    </h1>
                    <p className="setup__description">
                        Get started with AI Agents in minutes. Follow this guide to install,
                        configure, and make your first API call.
                    </p>
                </div>
            </section>

            <section className="setup__content section">
                <div className="container">
                    <div className="setup__grid">
                        <div className="setup__main">
                            <div className="setup__steps">
                                {setupSteps.map((step) => (
                                    <div key={step.id} className="setup__step">
                                        <div className="setup__step-header">
                                            <span className="setup__step-number">{step.id}</span>
                                            <span className="setup__step-icon">{step.icon}</span>
                                            <h3 className="setup__step-title">{step.title}</h3>
                                        </div>

                                        {step.items && (
                                            <ul className="setup__step-list">
                                                {step.items.map((item, i) => (
                                                    <li key={i}>{item}</li>
                                                ))}
                                            </ul>
                                        )}

                                        {step.code && (
                                            <div className="setup__code-block">
                                                <div className="setup__code-header">
                                                    <span>{step.language}</span>
                                                    <button className="setup__copy-btn">📋 Copy</button>
                                                </div>
                                                <pre><code>{step.code}</code></pre>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>

                        <aside className="setup__sidebar">
                            <div className="setup__sidebar-card glass-card">
                                <h4>System Requirements</h4>
                                <div className="setup__requirements">
                                    {systemRequirements.map((req, i) => (
                                        <div key={i} className="setup__requirement">
                                            <span className="setup__requirement-label">{req.label}</span>
                                            <span className="setup__requirement-value">{req.value}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="setup__sidebar-card glass-card">
                                <h4>Quick Links</h4>
                                <nav className="setup__quick-links">
                                    <a href="#">📖 Full Documentation</a>
                                    <a href="#">💬 Developer Discord</a>
                                    <a href="#">🎫 Support Tickets</a>
                                    <a href="#">📺 Video Tutorials</a>
                                </nav>
                            </div>

                            <div className="setup__sidebar-card glass-card setup__sidebar-card--cta">
                                <h4>Need Help?</h4>
                                <p>Our team is ready to assist with your integration.</p>
                                <button className="btn btn-primary">Contact Support</button>
                            </div>
                        </aside>
                    </div>
                </div>
            </section>
        </div>
    )
}

export default Setup
